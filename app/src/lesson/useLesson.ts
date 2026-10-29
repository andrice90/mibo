import { useCallback, useEffect, useRef, useState } from 'react';

import type { Puppet, Segment } from '../puppet/mibo';
import { judgeTry, type Verdict } from '../voice/judge';
import { enableMic, listen, type Listening } from '../voice/listen';
import { playClip, stopAudio, wavFile, type Clip } from '../voice/player';
import { bundled, preloadClips } from './clips';
import { nameClip } from './name';
import { LESSON_1, MAX_ATTEMPTS, VARIANTS, type ClipId, type Exercise, type LineId } from './content';

export type Nav = 'fwd' | 'back';
export type Phase = 'idle' | 'loading' | 'talking' | 'listening' | 'thinking' | 'done';
export type LessonUi = {
  phase: Phase; step: number; ex: Exercise | null; stars: number; live: string;
  mic: boolean;            // listening with the microphone (else the arrows stand in)
  level: number;           // live mic level 0..1 while listening
  heard: Verdict | null;   // the last try's on-device check, for the grown-up's eyes only
};

class Stopped extends Error {}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Runs Lesson 1 on a puppet.
 *
 * Each try: Mibo shows the sound, says "your turn", and listens. The on-device
 * check (src/voice/judge.ts) decides: the right sound gets praise and a star;
 * a different sound gets a gentle live reply that knows what it heard, then
 * Mibo shows it again (up to 2 re-models, then moves on smiling).
 *
 * The grown-up's arrows are always there in case the check gets it wrong:
 * while Mibo listens, ▶ means "they did it" and ◀ means "show it again";
 * at any other moment they jump to the next or previous step.
 */
export function useLesson(puppet: Puppet, opts: {
  listen: boolean; from?: number; stars?: number;
  onProgress?: (step: number, stars: number) => void; onDone?: () => void;
}) {
  const [ui, setUi] = useState<LessonUi>({ phase: 'idle', step: opts.from ?? 0, ex: null, stars: opts.stars ?? 0, live: '', mic: false, level: 0, heard: null });
  const stars = useRef(opts.stars ?? 0);
  const hooks = useRef(opts);
  useEffect(() => { hooks.current = opts; });
  const run = useRef(0);
  const step = useRef(0);
  const navWait = useRef<((n: Nav) => void) | null>(null);   // set while a try is waiting on the child
  const mic = useRef<Listening | null>(null);
  const turn = useRef<Record<string, number>>({});             // rotation through VARIANTS
  const said = useRef<string[]>([]);                            // Mibo's recent live lines

  const set = (u: Partial<LessonUi>) => setUi(prev => ({ ...prev, ...u }));
  const pick = (g: keyof typeof VARIANTS): LineId => {
    const list = VARIANTS[g], n = turn.current[g] ?? 0;
    turn.current[g] = n + 1;
    return list[n % list.length];
  };
  /** Mibo's quick reaction; once the child's name lines exist they join the rotation. */
  const react = (ok: boolean): LineId | Clip => {
    const g = ok ? 'yay' : 'hmm', named = nameClip(ok ? 'got' : 'tricky');
    const n = turn.current[g] ?? 0;
    turn.current[g] = n + 1;
    const list: (LineId | Clip)[] = [...VARIANTS[g], ...(named ? [named] : [])];
    return list[n % list.length];
  };

  const runFrom = useCallback(async (from: number) => {
    const id = ++run.current;
    navWait.current = null;
    mic.current?.stop(); mic.current = null;
    stopAudio(); puppet.stop();
    const alive = () => { if (run.current !== id) throw new Stopped(); };
    const play = async (c: ClipId | Clip, extra?: Partial<Segment>) => {
      alive();
      await playClip(puppet, typeof c === 'string' ? bundled(c) : c, extra);
      alive();
    };

    /**
     * Mibo says `prompt` ("your turn") and then waits for the child's go: the
     * mic's verdict or the grown-up's arrow, whichever comes first. The mic
     * starts recording with the prompt, so a child who jumps in is caught,
     * but only what comes after Mibo stops talking is judged.
     */
    const waitTry = async (ex: Exercise, useMic: boolean, prompt: LineId | null): Promise<{ nav?: Nav; verdict?: Verdict }> => {
      const nav = new Promise<Nav>(res => { navWait.current = res; });
      let last = 0;
      const l = useMic
        ? listen({ armed: false, onLevel: v => { const now = Date.now(); if (now - last > 90) { last = now; set({ level: v }); } } })
        : null;
      mic.current = l;
      const quit = (r: { nav?: Nav; verdict?: Verdict }) => { l?.stop(); mic.current = null; navWait.current = null; set({ level: 0 }); return r; };
      if (prompt) {
        set({ phase: 'talking' });
        const early = await Promise.race([nav.then(n => ({ nav: n })), play(prompt).then(() => null)]);
        if (early) { stopAudio(); return quit(early); }
      }
      await sleep(120);   // let the room swallow the last of Mibo's voice
      l?.arm();
      puppet.setMood('listening');
      set({ phase: 'listening' });
      if (!l) return quit({ nav: await nav });
      const got = await Promise.race([nav.then(n => ({ nav: n })), l.done.then(h => ({ h }))]);
      if ('nav' in got) return quit(got);
      quit({});
      const h = got.h;
      if (!h.speech) return {};
      const verdict = judgeTry(h.samples, h.sr, ex.sound, ex.model.endsWith('_hold') ? 'hold' : 'word');
      // numbers only, for tuning against real sessions (shows in the dev server's log, never audio or words)
      console.log(`[hear] ${ex.target}: ${verdict.match ? 'PASS' : 'no'} ` + verdict.words.map(w =>
        `${w.heard}${w.match ? '✓' : ''}(${w.feats ? `${w.feats.ms}ms ${w.feats.centroid}Hz flat${w.feats.flatness} ${w.feats.relDb}dB` : '-'})`).join(' '));
      return { verdict };   // the samples go out of scope here: nothing is kept
    };

    const tryExercise = async (ex: Exercise, useMic: boolean) => {
      set({ ex, heard: null });
      for (let attempt = 1; attempt <= MAX_ATTEMPTS;) {
        set({ phase: 'talking' });
        puppet.setMood('neutral');
        if (attempt === 1) await play(pick('watch'));
        await play(ex.model, { watchAll: true });
        // Both likely replies are written and spoken while the child has a go.
        const ask = (mark: 'got' | 'tricky', heard?: string) => fetchReply({
          sound: ex.sound, target: ex.target, mark, attempt, willRetry: mark === 'tricky' && attempt < MAX_ATTEMPTS,
          heard, avoid: said.current,
        });
        const replies = { got: ask('got'), tricky: ask('tricky') };
        let result: { nav?: Nav; verdict?: Verdict } = {};
        for (let nudges = 0; ; nudges++) {
          // first "your turn" (or the nudge after a silence) plays while the mic is already recording
          const prompt = nudges === 0 ? (attempt === 1 ? ex.prompt : pick('yourTurn')) : nudges === 1 ? pick('yourTurn') : null;
          result = await waitTry(ex, useMic && nudges < 2, prompt);
          alive();
          if (result.nav || result.verdict) break;
        }
        if (result.nav === 'back') continue;            // grown-up: show it again (no "tricky" feedback)

        const v = result.verdict;
        set({ heard: v ?? null });
        const ok = result.nav === 'fwd' || !v || v.match !== false;
        set({ phase: 'thinking' });
        puppet.setMood('thinking');
        // a mismatch the check can name gets a reply that knows what it heard
        const heardElse = !ok && v && v.heard !== 'none' && v.heard !== ex.sound ? v.heard : undefined;
        const tricky = heardElse
          ? Promise.race([ask('tricky', heardElse), sleep(2500).then(() => replies.tricky)])
          : replies.tricky;
        const [reply] = await Promise.all([ok ? replies.got : tricky, play(react(ok))]);
        alive();
        set({ phase: 'talking', live: reply.source });
        puppet.setMood(reply.mood);
        if (ok) { puppet.act('hop'); stars.current++; set({ stars: stars.current }); hooks.current.onProgress?.(step.current, stars.current); }
        for (const c of reply.clips) await play(c);
        said.current = [...said.current, ...reply.clips.map(c => c.text)].slice(-4);
        if (ok || attempt === MAX_ATTEMPTS) return;
        attempt++;
      }
    };

    try {
      if (from === 0) { stars.current = 0; setUi(p => ({ ...p, stars: 0 })); }
      set({ phase: 'loading', step: from, ex: null, heard: null });
      await preloadClips();
      const useMic = opts.listen && await enableMic();
      alive();
      set({ phase: 'talking', mic: useMic });
      for (let i = from; i < LESSON_1.length; i++) {
        const s = LESSON_1[i];
        step.current = i;
        set({ step: i, ex: null });
        hooks.current.onProgress?.(i, stars.current);
        if (s.kind === 'line') {
          if (s.mood) puppet.setMood(s.mood);
          if (s.act) puppet.act(s.act);
          await play(s.clip);
        } else if (s.kind === 'model') {
          await play(s.clip, { watchAll: true });
        } else if (s.kind === 'try') {
          await tryExercise(s.ex, useMic);
        } else {
          puppet.setMood('happy');
          puppet.act('celebrate');
          const bye = nameClip('bye');      // "Great job, {name}!"
          if (bye) await play(bye);
          await play(s.clip);
        }
      }
      puppet.setMood('happy');
      set({ phase: 'done', ex: null });
      hooks.current.onDone?.();
    } catch (e) {
      if (!(e instanceof Stopped)) throw e;
    }
  }, [puppet, opts.listen]);

  const start = useCallback(() => runFrom(0), [runFrom]);
  // Start (or start again) where the lesson is: after a hot reload during
  // development the screen's start effect runs again, and this must not jump
  // back to the step the lesson was opened at.
  const resume = useCallback(() => runFrom(Math.max(step.current, hooks.current.from ?? 0)), [runFrom]);

  /** The grown-up's arrows. */
  const nav = useCallback((n: Nav) => {
    const waiting = navWait.current;
    if (waiting) { navWait.current = null; waiting(n); return; }
    const to = n === 'fwd' ? step.current + 1 : Math.max(0, step.current - 1);
    if (to >= LESSON_1.length) { runFrom(LESSON_1.length - 1); return; }
    runFrom(to);
  }, [runFrom]);

  const stop = useCallback(() => {
    run.current++;
    navWait.current = null;
    mic.current?.stop(); mic.current = null;
    stopAudio();
    puppet.stop();
    puppet.setMood('neutral');
    setUi(p => ({ ...p, phase: 'idle', ex: null }));
  }, [puppet]);

  useEffect(() => () => { run.current++; mic.current?.stop(); stopAudio(); }, []);

  return { ui, start, resume, stop, nav, total: LESSON_1.length };
}

type ReplyIn = {
  sound: string; target: string; mark: 'got' | 'tricky'; attempt: number; willRetry: boolean; heard?: string; avoid?: string[];
};
type Reply = { clips: Clip[]; mood: string; source: 'llm' | 'fallback' };
type Part = { text: string; audio: string; visemes: Clip['visemes']; seconds: number };

/** The live reply, or the matching bundled fallback line if it is slow, offline or fails. */
async function fetchReply(t: ReplyIn): Promise<Reply> {
  const fallback = (): Reply => ({
    clips: [bundled(`fb_${t.mark}_${((t.attempt - 1) % 3) + 1}`)], mood: t.mark === 'got' ? 'happy' : 'gentle', source: 'fallback',
  });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch('/api/reply', {
      method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t),
    });
    const b = await r.json();
    if (!r.ok || !b.parts?.length) return { ...fallback(), mood: b.mood || fallback().mood };
    return {
      clips: (b.parts as Part[]).map(p => ({ source: wavFile(p.audio), text: p.text, visemes: p.visemes, seconds: p.seconds })),
      mood: b.mood, source: 'llm',
    };
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
