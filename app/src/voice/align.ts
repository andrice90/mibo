/**
 * Lip sync from text + audio, the way animators do it: the words say which
 * mouth shapes to use, the audio says when.
 *
 * The audio alone only tells a few shapes apart (rest, a vowel, a hiss), and
 * vowel guesses from formants are shaky on Leda's higher voice, so most of
 * the time the mouth cycled between two or three shapes. Here the text is
 * turned into the puppet's own viseme sequence (textToVisemes from
 * prototypes/mibo-puppet, the same one the lab uses), and that sequence is
 * stretched over the audio frames with dynamic time warping: each shape
 * lands on frames that sound like it (vowels on voiced frames, /s/ on a
 * high hiss, lips closed on a quiet gap, pauses on silence).
 */
import { HOP, toVisemes, type Frame, type FrameClass, type Viseme } from './analyze';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../../../prototypes/mibo-puppet/mibo-puppet.js');
const textToVisemes = (globalThis as unknown as { Mibo: { textToVisemes(t: string, speed?: number): Viseme[] } })
  .Mibo.textToVisemes;

type Group = 'pause' | 'vowel' | 's' | 'sh' | 'flat' | 'stop' | 'liquid';
const GROUP: Record<string, Group> = {
  rest: 'pause', gap: 'pause',
  ah: 'vowel', ee: 'vowel', eh: 'vowel', oh: 'vowel', oo: 'vowel',
  s: 's', sh: 'sh', f: 'flat', th: 'flat',
  mbp: 'stop', dt: 'stop', kg: 'stop', l: 'liquid', rr: 'liquid',
};
type Kind = 'silence' | 'vowel' | 'fric_s' | 'fric_sh' | 'fric_flat' | 'voiced_other' | 'noise_other';
const kind = (c: FrameClass): Kind =>
  (['ah', 'ee', 'eh', 'oh', 'oo', 'vowel'].includes(c) ? 'vowel' : c) as Kind;

// How badly a mouth shape fits a frame of audio (0 = perfect). Closures of
// /b, d, k/ are near-silent, so stops sit cheaply on silence and murmur.
const COST: Record<Group, Record<Kind, number>> = {
  pause: { silence: 0, noise_other: 0.6, voiced_other: 0.8, vowel: 1, fric_s: 1, fric_sh: 1, fric_flat: 0.9 },
  vowel: { vowel: 0, voiced_other: 0.3, noise_other: 0.7, silence: 0.9, fric_s: 1, fric_sh: 1, fric_flat: 0.9 },
  s: { fric_s: 0, fric_sh: 0.3, fric_flat: 0.4, noise_other: 0.5, silence: 0.6, voiced_other: 0.6, vowel: 1 },
  sh: { fric_sh: 0, fric_s: 0.3, fric_flat: 0.4, noise_other: 0.5, silence: 0.6, voiced_other: 0.6, vowel: 1 },
  flat: { fric_flat: 0, fric_s: 0.3, fric_sh: 0.3, noise_other: 0.3, silence: 0.5, voiced_other: 0.6, vowel: 0.9 },
  stop: { voiced_other: 0.1, noise_other: 0.2, silence: 0.3, vowel: 0.5, fric_s: 0.6, fric_sh: 0.6, fric_flat: 0.5 },
  liquid: { voiced_other: 0.1, vowel: 0.3, noise_other: 0.4, silence: 0.6, fric_s: 0.8, fric_sh: 0.8, fric_flat: 0.7 },
};

/**
 * Align `text`'s visemes to the audio frames. `minHold` folds shapes shorter
 * than that (seconds) into a neighbour, so single 10 ms slivers never reach
 * the 24 fps mouth clock.
 */
export function alignVisemes(text: string, frames: Frame[], opts: { minHold?: number } = {}): Viseme[] {
  // rest at both ends soaks up the silence before and after the speech
  const seq: Viseme[] = [{ v: 'rest', d: 0.1, i: 0 }, ...textToVisemes(text), { v: 'rest', d: 0.1, i: Math.max(0, text.length - 1) }];
  const N = seq.length, M = frames.length;
  if (M < N) return toVisemes(frames, { text });  // too little audio for the text: use the audio alone
  const kinds = frames.map(f => kind(f.cls));
  const g = seq.map(s => GROUP[s.v] ?? 'stop');
  // Where each shape should sit: the text timeline stretched to the clip's
  // length. Every vowel shape fits every voiced frame, so without this one
  // vowel could swallow a whole word and its neighbours vanish.
  const total = seq.reduce((a, s) => a + s.d, 0);
  const scale = M / total;
  const mid: number[] = [], half: number[] = [];
  let acc = 0;
  for (const s of seq) { mid.push((acc + s.d / 2) * scale); half.push(s.d * scale / 2); acc += s.d; }
  const SLACK = 15;  // frames of free drift (150 ms) before the prior bites
  const prior = (i: number, j: number) => 0.01 * Math.max(0, Math.abs(j - mid[i]) - half[i] - SLACK);
  // the audio's own vowel guess, when it agrees with the text, is a small bonus
  const fit = (i: number, j: number) => {
    const c = COST[g[i]][kinds[j]];
    return g[i] === 'vowel' && kinds[j] === 'vowel' && frames[j].cls !== seq[i].v && frames[j].cls !== 'vowel' ? c + 0.15 : c;
  };
  // a pause between words may be skipped when the speaker runs words together
  const skippable = seq.map((s, i) => i > 0 && i < N - 1 && s.v === 'gap');

  const INF = 1e9;
  const D = new Float64Array(N * M).fill(INF);
  const back = new Int8Array(N * M);  // 0 stay, 1 from previous shape, 2 skipped a gap
  D[0] = fit(0, 0) + prior(0, 0);
  for (let j = 1; j < M; j++) {
    for (let i = 0; i < Math.min(N, j + 1); i++) {
      let best = D[i * M + j - 1], from = 0;
      if (i > 0 && D[(i - 1) * M + j - 1] < best) { best = D[(i - 1) * M + j - 1]; from = 1; }
      if (i > 1 && skippable[i - 1] && D[(i - 2) * M + j - 1] < best) { best = D[(i - 2) * M + j - 1]; from = 2; }
      if (best >= INF) continue;
      D[i * M + j] = best + fit(i, j) + prior(i, j);
      back[i * M + j] = from;
    }
  }

  // walk back from the last shape on the last frame
  const owner = new Int32Array(M);
  for (let i = N - 1, j = M - 1; j >= 0; j--) {
    owner[j] = i;
    const b = back[i * M + j];
    if (b === 1) i -= 1; else if (b === 2) i -= 2;
  }

  type Run = { k: number; n: number };
  let runs: Run[] = [];
  for (let j = 0; j < M; j++) {
    const last = runs[runs.length - 1];
    if (last && last.k === owner[j]) last.n++; else runs.push({ k: owner[j], n: 1 });
  }
  const minN = Math.round((opts.minHold ?? 0.06) / HOP);
  for (;;) {
    let at = -1;
    runs.forEach((r, i) => { if (r.n < minN && runs.length > 1 && (at < 0 || r.n < runs[at].n)) at = i; });
    if (at < 0) break;
    const a = runs[at - 1], b = runs[at + 1];
    (!a ? b : !b ? a : a.n >= b.n ? a : b).n += runs[at].n;
    runs.splice(at, 1);
  }
  // neighbouring runs can now show the same shape; join them
  const out: Viseme[] = [];
  for (const r of runs) {
    const s = seq[r.k], last = out[out.length - 1];
    const d = r.n * HOP;
    // a real pause closes the mouth; 'gap' is only the brief part between words
    const shape = s.v === 'gap' && d > 0.15 ? 'rest' : s.v;
    if (last && last.v === shape) { last.d = +(last.d + d).toFixed(3); continue; }
    const v: Viseme = { v: shape, d: +d.toFixed(3), i: s.i };
    if (s.hold && d >= 0.35) v.hold = true;
    out.push(v);
  }
  return out;
}
