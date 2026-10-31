/**
 * Did the child say the twisty word, or a different word? On-device check
 * for the Twisty Words lesson (docs/08), where judge.ts's hiss check cannot
 * score a whole multi-chunk word.
 *
 * The child's try is compared by dynamic time warping over MFCC frames
 * against templates made from Mibo's own bundled model clips (the whole
 * word at the end of each "Spa... ghe... tti! Spaghetti!", templated by
 * scripts/make-word-templates.ts). A try passes when the target word is
 * the closest template and close enough in absolute terms: a muddled try
 * ("pasghetti") stays closest to its own word, while a different word —
 * another twisty word, or an unrelated one — lands closer to something
 * else or nowhere near anything. Like judge.ts, the audio is analysed in
 * memory and dropped (PROJECT #10); only the verdict is kept.
 *
 * Thresholds come from the synthetic calibration set
 * (scripts/wordcheck-test.ts, Leda and Puck saying right, muddled and
 * wrong words). Adult and TTS voices are not children's voices: the bars
 * are set loose, and the grown-up's ▶ arrow still overrides a miss.
 */
import templatesJson from '../lesson/word-templates.json';
import { mfcc } from './features';

export type WordVerdict = {
  speech: boolean;
  match: boolean | null;   // null: nothing judgeable heard
  best?: string;           // closest template word, for the [hear] log
  dists?: Record<string, number>;
};

const TEMPLATES = templatesJson as Record<string, number[][]>;
export const TWISTY_WORDS = Object.keys(TEMPLATES);

/**
 * Pass bars: target distance, and target vs runner-up distance. On the
 * calibration set, right and muddled tries land at 11-22 from their word;
 * wrong words that happen to land closest are 23+ away or within 8% of
 * the runner-up.
 */
export const WORD_T = { abs: 24, ratio: 0.92 };

const HOP_S = 0.01, WIN_S = 0.02;

/**
 * Loud-enough runs of speech, as sample ranges: gaps under 250 ms are
 * joined (a word said chunk by chunk stays one run), runs under 150 ms
 * are dropped. The same windowing as judgeTry in judge.ts.
 */
export function speechRuns(x: Float32Array, sr: number): [number, number][] {
  const hop = Math.round(HOP_S * sr), win = Math.round(WIN_S * sr);
  const dbs: number[] = [];
  for (let s = 0; s + win <= x.length; s += hop) {
    let e = 0;
    for (let k = 0; k < win; k++) e += x[s + k] * x[s + k];
    dbs.push(10 * Math.log10(e / win + 1e-12));
  }
  if (dbs.length < 10) return [];
  const sorted = [...dbs].sort((a, b) => a - b);
  const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const floor = pct(0.1), peak = pct(0.98);
  if (peak - floor < 15) return [];
  const gate = Math.max(floor + 10, peak - 35);
  const runs: [number, number][] = [];
  for (let i = 0, s = -1, quiet = 0; i <= dbs.length; i++) {
    const loud = i < dbs.length && dbs[i] > gate;
    if (loud) { if (s < 0) s = i; quiet = 0; continue; }
    if (s >= 0 && (++quiet > 25 || i === dbs.length)) {
      const a = s, b = i - quiet + 1;
      if (b - a >= 15) runs.push([a * hop, Math.min(x.length, b * hop + win)]);
      s = -1; quiet = 0;
    }
  }
  return runs;
}

/** MFCC frames of one attempt, with the quiet edges trimmed off. */
function framesOf(x: Float32Array, sr: number): Float64Array[] {
  const feats = mfcc(x, sr);
  let a = feats.findIndex(f => f[12] > -8);
  if (a < 0) return [];
  let b = feats.length - 1;
  while (b > a && feats[b][12] <= -8) b--;
  return feats.slice(a, b + 1);
}

/** Warping distance between two frame sequences, normalised by length. */
function dtw(a: Float64Array[], b: number[][]): number {
  const n = a.length, m = b.length;
  if (!n || !m) return Infinity;
  let prev = new Float64Array(m + 1).fill(Infinity), cur = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur[0] = Infinity;
    for (let j = 1; j <= m; j++) {
      let s = 0;
      const fa = a[i - 1], fb = b[j - 1];
      for (let k = 0; k < 12; k++) { const d = fa[k] - fb[k]; s += d * d; }
      cur[j] = Math.sqrt(s) + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m] / (n + m);
}

/**
 * Judge one listening window against `target` (one of TWISTY_WORDS).
 * Every speech run is tried, plus all runs spliced together, so both a
 * whole-word try and a chunk-by-chunk try get their chance; the attempt
 * closest to the target decides.
 */
export function judgeWord(x: Float32Array, sr: number, target: string): WordVerdict {
  const runs = speechRuns(x, sr);
  if (!runs.length || !TEMPLATES[target]) return { speech: false, match: null };
  const pad = Math.round(0.05 * sr);
  const candidates = runs.map(([a, b]) => x.subarray(Math.max(0, a - pad), Math.min(x.length, b + pad)));
  if (runs.length > 1) {
    const joined = new Float32Array(runs.reduce((n, [a, b]) => n + b - a, 0));
    let at = 0;
    for (const [a, b] of runs) { joined.set(x.subarray(a, b), at); at += b - a; }
    candidates.push(joined);
  }
  let best: WordVerdict | null = null;
  for (const c of candidates) {
    const feats = framesOf(c, sr);
    if (feats.length < 15) continue;
    const dists = Object.fromEntries(TWISTY_WORDS.map(w => [w, +dtw(feats, TEMPLATES[w]).toFixed(2)]));
    const ranked = Object.entries(dists).sort((p, q) => p[1] - q[1]);
    const [word, d] = ranked[0], second = ranked[1]?.[1] ?? Infinity;
    const v: WordVerdict = {
      speech: true, best: word, dists,
      match: word === target && d <= WORD_T.abs && d <= second * WORD_T.ratio,
    };
    if (!best || (dists[target] ?? Infinity) < (best.dists?.[target] ?? Infinity)) best = v;
  }
  return best ?? { speech: true, match: null };
}
