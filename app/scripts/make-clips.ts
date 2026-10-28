/// <reference types="node" />
/**
 * Generates Lesson 1's bundled voice: every line and model clip in
 * src/lesson/content.ts, spoken by Leda, with a mouth track per clip.
 *
 *   npx tsx scripts/make-clips.ts              # only clips that are missing
 *   npx tsx scripts/make-clips.ts --only th_hold,word_thumb --force
 *   npx tsx scripts/make-clips.ts --reanalyze     # new mouth tracks, no API calls
 *
 * Model clips get up to --takes takes; a take passes when it holds a hiss for
 * at least 0.5 s (the acoustic check from docs/06 §5). The longest passing
 * hiss is kept. Listen to the /θ/ clips by ear: the check cannot tell /θ/
 * from /f/.
 *
 * Writes assets/voice/<id>.wav, assets/voice/clips.json and
 * src/lesson/clips.generated.ts. Needs OPENROUTER_API_KEY in app/.env.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { LINES, MODELS, type ClipId } from '../src/lesson/content';
import { speak, SAMPLE_RATE } from '../src/server/tts';
import { analyze, HOP, longestFricative, pcm16ToFloat, pcmToWav, trimEdges, type Frame, type Viseme } from '../src/voice/analyze';
import { mouthTrack } from '../src/voice/lipsync';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'voice');
const MANIFEST = path.join(OUT, 'clips.json');
const GENERATED = path.join(ROOT, 'src', 'lesson', 'clips.generated.ts');

type Entry = { text: string; seconds: number; visemes: Viseme[]; hiss?: number; takes?: number; pass?: boolean };

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

process.loadEnvFile(path.join(ROOT, '.env'));
mkdirSync(OUT, { recursive: true });

const manifest: Record<string, Entry> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const only = opt('--only')?.split(',');
const takes = Number(opt('--takes') || 3);

/**
 * Cut a phrase take down to its longest hiss. The air kept either side is
 * silence only: when Leda runs the hiss straight into the next word
 * ("Ssssss-sun"), the cut lands right where the hiss ends, so no vowel
 * leaks in (an earlier fixed 0.1 s tail left "sssss-a"). Ends are faded so
 * the cut does not click.
 */
function trimToHiss(pcm: Uint8Array, frames: Frame[]): Uint8Array {
  let best = [0, 0], start = -1;
  frames.forEach((f, i) => {
    const fric = f.cls.startsWith('fric');
    if (fric && start < 0) start = i;
    if ((!fric || i === frames.length - 1) && start >= 0) {
      const end = fric ? i + 1 : i;
      if (end - start > best[1] - best[0]) best = [start, end];
      start = -1;
    }
  });
  let [a, b] = best;
  for (let k = 0; k < 10 && a > 0 && frames[a - 1].cls === 'silence'; k++) a--;
  for (let k = 0; k < 10 && b < frames.length && frames[b].cls === 'silence'; k++) b++;
  const out = pcm.slice(Math.round(a * HOP * SAMPLE_RATE) * 2, Math.min(pcm.length, Math.round(b * HOP * SAMPLE_RATE) * 2));
  return fadeEdges(out, 0.015, 0.03);
}

/** Short linear fades on 16-bit PCM so cut ends never click. */
function fadeEdges(pcm: Uint8Array, inS: number, outS: number): Uint8Array {
  const n = pcm.length / 2, dv = new DataView(pcm.buffer, pcm.byteOffset, pcm.length);
  const fi = Math.min(n, Math.round(inS * SAMPLE_RATE)), fo = Math.min(n, Math.round(outS * SAMPLE_RATE));
  for (let i = 0; i < fi; i++) dv.setInt16(i * 2, Math.round(dv.getInt16(i * 2, true) * i / fi), true);
  for (let i = 0; i < fo; i++) { const j = n - 1 - i; dv.setInt16(j * 2, Math.round(dv.getInt16(j * 2, true) * i / fo), true); }
  return pcm;
}

async function makeLine(id: string, text: string): Promise<Entry> {
  const s = await speak(text);
  writeFileSync(path.join(OUT, `${id}.wav`), s.wav);
  return { text, seconds: +s.seconds.toFixed(2), visemes: mouthTrack(text, s.samples, SAMPLE_RATE) };
}

async function makeModel(id: string, m: { text: string; sound: string; trim: boolean }): Promise<Entry> {
  let best: { pcm: Uint8Array; frames: Frame[]; hiss: number } | null = null;
  let n = 0;
  for (; n < takes; n++) {
    const s = await speak(m.text, !m.trim);
    let pcm = s.wav.subarray(44), frames = s.frames;
    if (m.trim) { pcm = trimToHiss(pcm, frames); frames = analyze(pcm16ToFloat(pcm), SAMPLE_RATE); }
    const hiss = longestFricative(frames);
    console.log(`  ${id} take ${n + 1}: hiss ${hiss}s`);
    if (!best || hiss > best.hiss) best = { pcm, frames, hiss };
    if (hiss >= 0.7) break;  // a clear hold; no need to spend more takes
  }
  writeFileSync(path.join(OUT, `${id}.wav`), pcmToWav(best!.pcm, SAMPLE_RATE));
  const text = m.trim ? m.text.split('...')[0] : m.text;
  return {
    text, seconds: +(best!.pcm.length / 2 / SAMPLE_RATE).toFixed(2), hiss: best!.hiss, takes: n + (n < takes ? 1 : 0),
    pass: best!.hiss >= 0.5, visemes: mouthTrack(text, pcm16ToFloat(best!.pcm), SAMPLE_RATE),
  };
}

/**
 * Recompute every mouth track from the WAVs on disk, after a change to the
 * analysis or the aligner. Also trims dead air off the ends of each clip
 * (rewriting the WAV), which is safe to repeat.
 */
function reanalyze() {
  for (const [id, e] of Object.entries(manifest)) {
    const file = path.join(OUT, `${id}.wav`);
    if (!existsSync(file)) continue;
    const m = (MODELS as Record<string, { sound: string; trim: boolean }>)[id];
    let pcm: Uint8Array = new Uint8Array(readFileSync(file)).subarray(44);
    // hiss-only clips are re-cut to the hiss; everything else just loses dead air
    pcm = m?.trim ? trimToHiss(pcm, analyze(pcm16ToFloat(pcm), SAMPLE_RATE)) : trimEdges(pcm, SAMPLE_RATE);
    writeFileSync(file, pcmToWav(pcm, SAMPLE_RATE));
    const samples = pcm16ToFloat(pcm), frames = analyze(samples, SAMPLE_RATE);
    e.seconds = +(pcm.length / 2 / SAMPLE_RATE).toFixed(2);
    e.visemes = mouthTrack(e.text, samples, SAMPLE_RATE);
    if (m) { e.hiss = longestFricative(frames); e.pass = e.hiss >= 0.5; }
    console.log(`re ${id}${m ? ` hiss ${e.hiss}s` : ''}`);
  }
}

async function main() {
  if (flag('--reanalyze')) { reanalyze(); return write(); }
  const jobs: [ClipId, () => Promise<Entry>][] = [
    ...Object.entries(LINES).map(([id, text]) => [id, () => makeLine(id, text)] as [ClipId, () => Promise<Entry>]),
    ...Object.entries(MODELS).map(([id, m]) => [id, () => makeModel(id, m)] as [ClipId, () => Promise<Entry>]),
  ].filter(([id]) => (only ? only.includes(id) : true))
    .filter(([id]) => flag('--force') || !manifest[id] || !existsSync(path.join(OUT, `${id}.wav`)));

  console.log(`${jobs.length} clips to make`);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const [id, run] = jobs[next++];
      try {
        manifest[id] = await run();
        const e = manifest[id];
        console.log(`ok ${id} ${e.seconds}s${e.hiss !== undefined ? ` hiss ${e.hiss}s ${e.pass ? 'PASS' : 'CHECK'}` : ''}`);
      } catch (err) {
        console.error(`FAILED ${id}: ${(err as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  write();
}

function write() {
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  const ids = Object.keys(manifest).sort();
  writeFileSync(GENERATED, [
    '// Generated by scripts/make-clips.ts. Do not edit.',
    "import type { Viseme } from '../voice/analyze';",
    '',
    "import manifest from '../../assets/voice/clips.json';",
    '',
    'export const CLIP_AUDIO: Record<string, number> = {',
    ...ids.map(id => `  ${id}: require('../../assets/voice/${id}.wav'),`),
    '};',
    '',
    'export const CLIPS = manifest as Record<string, { text: string; seconds: number; visemes: Viseme[]; hiss?: number; pass?: boolean }>;',
    '',
  ].join('\n'));
  const failing = ids.filter(id => manifest[id].pass === false);
  if (failing.length) console.log(`\nListen to these, the hiss check did not pass: ${failing.join(', ')}`);
}

main();
