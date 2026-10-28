/**
 * Forced alignment of Mibo's own lines, for lip sync. Gemini TTS returns no
 * timings, so we find them: each phoneme of the text (CMU dictionary) is a
 * left-to-right run of 3 HMM states sharing one Gaussian over MFCC features,
 * optional silences sit between words, and Viterbi finds the most likely
 * timing. The Gaussians are trained on Leda's own voice (scripts/train-aligner.ts)
 * by Viterbi training from an evenly spaced first guess.
 *
 * The 3 states give every phoneme at least 30 ms, so mouth shapes never
 * flicker, and the timing follows the audio to the 10 ms frame.
 */
import { DIM, mfcc } from './features';
import { PHONE_VISEMES, textToWords, VOWELS, type Word } from './g2p';
import type { Viseme } from './analyze';

type Gauss = { mean: number[]; ivar: number[]; norm: number; n: number };
export type PhoneModel = { dim: number; phones: Record<string, Gauss> };

const STATES = 3;
// Rare phonemes borrow a close neighbour's model until they have enough data.
const BACKOFF: Record<string, string> = {
  ZH: 'SH', JH: 'CH', CH: 'SH', OY: 'OW', UH: 'UW', AW: 'AA', DH: 'TH', NG: 'N', AO: 'AA', AE: 'EH', ER: 'R',
  EY: 'EH', AY: 'AA', OW: 'AO', Z: 'S', V: 'F', G: 'K', B: 'P', TH: 'F', HH: 'SIL', Y: 'IY', W: 'UW', SP: 'SIL',
};
const MIN_FRAMES = 20;

function gaussFor(model: PhoneModel, p: string): Gauss {
  for (let q: string | undefined = p, hops = 0; q && hops < 4; q = BACKOFF[q], hops++) {
    const g = model.phones[q];
    if (g && g.n >= MIN_FRAMES) return g;
  }
  return model.phones[VOWELS.has(p) ? 'AH' : 'SIL'] ?? Object.values(model.phones)[0];
}

function loglik(g: Gauss, x: Float64Array) {
  let s = g.norm;
  for (let k = 0; k < x.length; k++) { const d = x[k] - g.mean[k]; s -= 0.5 * d * d * g.ivar[k]; }
  return s;
}

// ------------------------------------------------------------------ graph

type State = { phone: string; unit: number; optional: boolean };
type Unit = { phone: string; word: number; i: number; held?: boolean; kind: 'phone' | 'sil' };

/** States in order; each can be entered from the previous state or by skipping optional silences. */
function buildGraph(words: Word[]) {
  const units: Unit[] = [{ phone: 'SIL', word: -1, i: 0, kind: 'sil' }];
  words.forEach((w, k) => {
    for (const ph of w.phones) units.push({ phone: ph.p, word: k, i: ph.i, held: ph.held, kind: 'phone' });
    units.push({ phone: k === words.length - 1 ? 'SIL' : 'SP', word: k, i: w.i, kind: 'sil' });
  });
  const states: State[] = [];
  units.forEach((u, ui) => {
    const n = u.kind === 'sil' ? 1 : STATES;
    for (let s = 0; s < n; s++) states.push({ phone: u.phone, unit: ui, optional: u.kind === 'sil' });
  });
  // prev[s]: states that can move into s (besides s itself)
  const prev: number[][] = states.map(() => []);
  for (let s = 1; s < states.length; s++) {
    prev[s].push(s - 1);
    // skip an optional silence: come straight from the state before it
    if (!states[s].optional && states[s - 1].optional && s >= 2) prev[s].push(s - 2);
  }
  const starts = states[0].optional ? [0, 1] : [0];
  const last = states.length - 1;
  const ends = states[last].optional ? [last, last - 1] : [last];
  return { units, states, prev, starts, ends };
}

/** Best state for every frame, or null if the audio is too short for the text. */
function viterbi(feats: Float64Array[], g: ReturnType<typeof buildGraph>, model: PhoneModel): Int32Array | null {
  const T = feats.length, S = g.states.length;
  if (T < S / 2) return null;
  const gauss = g.states.map(s => gaussFor(model, s.phone));
  const NEG = -1e30;
  let cur = new Float64Array(S).fill(NEG), nxt = new Float64Array(S);
  const back = new Int32Array(T * S);
  for (const s of g.starts) cur[s] = loglik(gauss[s], feats[0]);
  for (let t = 1; t < T; t++) {
    nxt.fill(NEG);
    for (let s = 0; s < S; s++) {
      let best = cur[s], from = s;
      for (const p of g.prev[s]) if (cur[p] > best) { best = cur[p]; from = p; }
      if (best <= NEG) continue;
      nxt[s] = best + loglik(gauss[s], feats[t]);
      back[t * S + s] = from;
    }
    [cur, nxt] = [nxt, cur];
  }
  let end = g.ends[0];
  for (const e of g.ends) if (cur[e] > cur[end]) end = e;
  if (cur[end] <= NEG) return null;
  const path = new Int32Array(T);
  for (let t = T - 1, s = end; t >= 0; t--) { path[t] = s; s = back[t * S + s]; }
  return path;
}

type Seg = { unit: Unit; start: number; end: number };
function segments(path: Int32Array, g: ReturnType<typeof buildGraph>): Seg[] {
  const out: Seg[] = [];
  for (let t = 0; t < path.length; t++) {
    const u = g.states[path[t]].unit, last = out[out.length - 1];
    if (last && last.unit === g.units[u]) last.end = t + 1;
    else out.push({ unit: g.units[u], start: t, end: t + 1 });
  }
  return out;
}

// ------------------------------------------------------------------ training

export type Utterance = { text: string; samples: Float32Array; sr: number };

function estimate(stats: Map<string, { n: number; s: Float64Array; q: Float64Array }>, floor: Float64Array): PhoneModel {
  const phones: Record<string, Gauss> = {};
  for (const [p, st] of stats) {
    if (st.n < 3) continue;
    const mean = Array.from(st.s, v => v / st.n);
    const ivar = Array.from(st.q, (v, k) => 1 / Math.max(v / st.n - mean[k] * mean[k], floor[k]));
    const norm = 0.5 * ivar.reduce((a, v) => a + Math.log(v), 0) - 0.5 * DIM * Math.log(2 * Math.PI);
    phones[p] = { mean, ivar, norm, n: st.n };
  }
  return { dim: DIM, phones };
}

/** First guess: silence outside the loud part, phonemes spread evenly inside it. */
function evenPath(feats: Float64Array[], g: ReturnType<typeof buildGraph>): Int32Array {
  const T = feats.length, e = feats.map(v => v[12]);
  let a = e.findIndex(v => v > -7), b = T - 1 - [...e].reverse().findIndex(v => v > -7);
  if (a < 0) { a = 0; b = T - 1; }
  const inner = g.states.map((s, i) => i).filter(i => !g.states[i].optional);
  const w = inner.map(i => (g.units[g.states[i].unit].held ? 6 : VOWELS.has(g.states[i].phone) ? 1.6 : 1));
  const total = w.reduce((x, y) => x + y, 0);
  const path = new Int32Array(T);
  let acc = 0, k = 0;
  for (let t = 0; t < T; t++) {
    if (t < a) { path[t] = 0; continue; }
    if (t > b) { path[t] = g.states.length - 1; continue; }
    const pos = (t - a) / Math.max(1, b - a + 1) * total;
    while (k < inner.length - 1 && acc + w[k] <= pos) { acc += w[k]; k++; }
    path[t] = inner[k];
  }
  return path;
}

export function train(utts: Utterance[], iterations = 8, log: (s: string) => void = () => {}): PhoneModel {
  const data = utts.map(u => {
    const feats = mfcc(u.samples, u.sr);
    return { feats, g: buildGraph(textToWords(u.text)) };
  });
  const all = data.flatMap(d => d.feats);
  const gm = new Float64Array(DIM), gq = new Float64Array(DIM);
  for (const v of all) for (let k = 0; k < DIM; k++) { gm[k] += v[k]; gq[k] += v[k] * v[k]; }
  const floor = gq.map((q, k) => Math.max(1e-4, 0.03 * (q / all.length - (gm[k] / all.length) ** 2)));

  let paths = data.map(d => evenPath(d.feats, d.g));
  let model: PhoneModel = { dim: DIM, phones: {} };
  for (let it = 0; it < iterations; it++) {
    const stats = new Map<string, { n: number; s: Float64Array; q: Float64Array }>();
    data.forEach((d, u) => {
      const path = paths[u];
      d.feats.forEach((v, t) => {
        const ph = d.g.states[path[t]].phone, key = ph === 'SP' ? 'SIL' : ph;
        let st = stats.get(key);
        if (!st) stats.set(key, (st = { n: 0, s: new Float64Array(DIM), q: new Float64Array(DIM) }));
        st.n++;
        for (let k = 0; k < DIM; k++) { st.s[k] += v[k]; st.q[k] += v[k] * v[k]; }
      });
    });
    model = estimate(stats, floor);
    let changed = 0, total = 0;
    paths = data.map((d, u) => {
      const p = viterbi(d.feats, d.g, model) ?? paths[u];
      for (let t = 0; t < p.length; t++) { total++; if (p[t] !== paths[u][t]) changed++; }
      return p;
    });
    log(`iteration ${it + 1}: ${(100 * changed / total).toFixed(1)}% of frames moved, ${Object.keys(model.phones).length} phonemes`);
  }
  return model;
}

// ------------------------------------------------------------------ lip sync

/**
 * Mibo's mouth track for a line: aligned phonemes become mouth shapes.
 * Returns null when the text has no words or the audio cannot fit it.
 */
export function lipSync(text: string, samples: Float32Array, sr: number, model: PhoneModel, minHold = 0.05): Viseme[] | null {
  const words = textToWords(text);
  if (!words.length) return null;
  const feats = mfcc(samples, sr);
  const g = buildGraph(words);
  const path = viterbi(feats, g, model);
  if (!path) return null;
  const segs = segments(path, g);

  // `held`: the shape includes a stretched teaching sound ("Sssss"). The
  // aligner may hand part of that hiss to the word after it ("sun" also
  // starts with /s/), so the flag rides along through every merge and the
  // zoom-in hold is decided on the merged length at the end.
  type Out = { v: string; d: number; i: number; held: boolean };
  const out: Out[] = [];
  const push = (v: string, d: number, i: number, held = false) => {
    const last = out[out.length - 1];
    if (last && last.v === v) { last.d += d; last.held ||= held; return; }
    out.push({ v, d, i, held });
  };
  segs.forEach((s, k) => {
    const d = (s.end - s.start) * 0.01, u = s.unit;
    if (u.kind === 'sil') { push(d > 0.15 ? 'rest' : 'gap', d, u.i); return; }
    let shapes = PHONE_VISEMES[u.phone] ?? [['dt', 1]];
    if (!shapes.length) {
      // /h/ is breath through the next vowel's mouth
      const next = segs.slice(k + 1).find(x => x.unit.kind === 'phone' && VOWELS.has(x.unit.phone));
      shapes = next ? [[PHONE_VISEMES[next.unit.phone][0][0], 1]] : [['uh', 1]];
    }
    if (u.held) { push(shapes[0][0], d, u.i, true); return; }
    for (const [v, w] of shapes) push(v, d * w, u.i);
  });

  // fold slivers into a neighbour so each drawing holds for at least minHold
  for (;;) {
    let at = -1;
    out.forEach((x, i) => { if (x.d < minHold && out.length > 1 && (at < 0 || x.d < out[at].d)) at = i; });
    if (at < 0) break;
    const a = out[at - 1], b = out[at + 1];
    const into = !a ? b : !b ? a : a.d >= b.d ? a : b;
    into.d += out[at].d; into.held ||= out[at].held;
    out.splice(at, 1);
    for (let i = out.length - 1; i > 0; i--) {
      if (out[i].v === out[i - 1].v) { out[i - 1].d += out[i].d; out[i - 1].held ||= out[i].held; out.splice(i, 1); }
    }
  }
  return out.map(({ v, d, i, held }) => ({ v, d: +d.toFixed(3), i, ...(held && d >= 0.35 ? { hold: true } : {}) }));
}
