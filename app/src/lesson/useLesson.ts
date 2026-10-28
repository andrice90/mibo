import { useCallback, useEffect, useRef, useState } from 'react';

import type { Puppet, Segment } from '../puppet/mibo';
import { playClip, preload, stopAudio, wavFile, type Clip } from '../voice/player';
import { CLIP_AUDIO, CLIPS } from './clips.generated';
import { LESSON_1, MAX_ATTEMPTS, type ClipId, type Exercise } from './content';

export type Tap = 'got' | 'tricky' | 'skip';
export type Phase = 'idle' | 'loading' | 'talking' | 'listening' | 'thinking' | 'done';
export type LessonUi = { phase: Phase; step: number; ex: Exercise | null; stars: number; live: string };

class Stopped extends Error {}

// local copies of the bundled clips, filled by preload() before the lesson starts
let local: Record<string, string> = {};
const bundled = (id: ClipId | string): Clip =>
  ({ source: local[id] ? { uri: local[id] } : CLIP_AUDIO[id], ...CLIPS[id] });

/**
 * Runs Lesson 1 on a puppet. Bundled clips carry the lesson; after each try
 * the grown-up taps how it sounded, Mibo plays a quick "Ooh!" while the live
 * reply is written and spoken, then either models the word again or moves on.
 */
export function useLesson(puppet: Puppet) {
  const [ui, setUi] = useState<LessonUi>({ phase: 'idle', step: 0, ex: null, stars: 0, live: '' });
  const tap = useRef<((t: Tap) => void) | null>(null);
  const run = useRef(0);

  const set = (u: Partial<LessonUi>) => setUi(prev => ({ ...prev, ...u }));

  const start = useCallback(async () => {
    const id = ++run.current;
    const alive = () => { if (run.current !== id) throw new Stopped(); };
    const play = async (c: ClipId | Clip, extra?: Partial<Segment>) => {
      alive();
      await playClip(puppet, typeof c === 'string' ? bundled(c) : c, extra);
      alive();
    };
    const waitTap = () => new Promise<Tap>(resolve => { tap.current = resolve; });

    const tryExercise = async (ex: Exercise) => {
      set({ ex });
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        set({ phase: 'talking' });
        puppet.setMood('neutral');
        if (attempt === 1) await play('watch');
        await play(ex.model, { watchAll: true });
        // Both possible replies are written and spoken while the child has a
        // go, so the right one is usually ready by the time the grown-up taps.
        const ask = (mark: 'got' | 'tricky') => fetchReply({
          sound: ex.sound, target: ex.target, mark, attempt, willRetry: mark === 'tricky' && attempt < MAX_ATTEMPTS,
        });
        const replies = { got: ask('got'), tricky: ask('tricky') };
        await play(attempt === 1 ? ex.prompt : 'yourTurn');
        puppet.setMood('listening');
        set({ phase: 'listening' });
        const t = await waitTap();
        alive();
        if (t === 'skip') { puppet.setMood('happy'); return; }

        set({ phase: 'thinking' });
        puppet.setMood('thinking');
        const [reply] = await Promise.all([replies[t], play(t === 'got' ? 'ooh' : 'hmm')]);
        alive();
        set({ phase: 'talking', live: reply.source });
        puppet.setMood(reply.mood);
        if (t === 'got') { puppet.act('hop'); setUi(p => ({ ...p, stars: p.stars + 1 })); }
        for (const c of reply.clips) await play(c);
        if (t === 'got' || attempt === MAX_ATTEMPTS) return;
      }
    };

    try {
      setUi({ phase: 'loading', step: 0, ex: null, stars: 0, live: '' });
      if (!Object.keys(local).length) local = await preload(CLIP_AUDIO).catch(() => ({}));
      alive();
      set({ phase: 'talking' });
      for (let i = 0; i < LESSON_1.length; i++) {
        const s = LESSON_1[i];
        set({ step: i, ex: null });
        if (s.kind === 'line') {
          if (s.mood) puppet.setMood(s.mood);
          if (s.act) puppet.act(s.act);
          await play(s.clip);
        } else if (s.kind === 'model') {
          await play(s.clip, { watchAll: true });
        } else if (s.kind === 'try') {
          await tryExercise(s.ex);
        } else {
          puppet.setMood('happy');
          puppet.act('celebrate');
          await play(s.clip);
        }
      }
      puppet.setMood('happy');
      set({ phase: 'done', ex: null });
    } catch (e) {
      if (!(e instanceof Stopped)) throw e;
    }
  }, [puppet]);

  const stop = useCallback(() => {
    run.current++;
    tap.current = null;
    stopAudio();
    puppet.stop();
    puppet.setMood('neutral');
    setUi(p => ({ ...p, phase: 'idle', ex: null }));
  }, [puppet]);

  const answer = useCallback((t: Tap) => {
    const f = tap.current;
    tap.current = null;
    f?.(t);
  }, []);

  useEffect(() => () => { run.current++; stopAudio(); }, []);

  return { ui, start, stop, answer, total: LESSON_1.length };
}

type ReplyIn = { sound: string; target: string; mark: 'got' | 'tricky'; attempt: number; willRetry: boolean };
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
