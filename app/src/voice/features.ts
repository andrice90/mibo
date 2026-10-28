/**
 * MFCC features for the forced aligner: 12 cepstra + log energy every 10 ms,
 * mean-normalised per clip, plus their deltas (26 numbers per frame).
 * Pure TS, runs in API routes and in Node scripts.
 */

const WIN = 0.025, HOP = 0.01, MELS = 26, CEPS = 12;

const cache = new Map<string, { mel: Float64Array[]; dct: Float64Array[]; win: Float64Array; nfft: number }>();

function setup(sr: number) {
  const key = String(sr);
  const hit = cache.get(key);
  if (hit) return hit;
  const n = Math.round(WIN * sr), nfft = 1 << Math.ceil(Math.log2(n));
  const win = new Float64Array(n).map((_, i) => 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1)));
  const toMel = (f: number) => 1127 * Math.log(1 + f / 700), toHz = (m: number) => 700 * (Math.exp(m / 1127) - 1);
  const lo = toMel(80), hi = toMel(Math.min(7600, sr / 2));
  const edges = Array.from({ length: MELS + 2 }, (_, i) => toHz(lo + (hi - lo) * i / (MELS + 1)));
  const mel = Array.from({ length: MELS }, (_, m) => {
    const w = new Float64Array(nfft / 2 + 1);
    for (let b = 0; b <= nfft / 2; b++) {
      const f = b * sr / nfft;
      if (f > edges[m] && f < edges[m + 2]) w[b] = f <= edges[m + 1]
        ? (f - edges[m]) / (edges[m + 1] - edges[m]) : (edges[m + 2] - f) / (edges[m + 2] - edges[m + 1]);
    }
    return w;
  });
  const dct = Array.from({ length: CEPS }, (_, k) =>
    new Float64Array(MELS).map((_, m) => Math.cos(Math.PI * (k + 1) * (m + 0.5) / MELS)));
  const out = { mel, dct, win, nfft };
  cache.set(key, out);
  return out;
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2;
        const vr = re[q] * cr - im[q] * ci, vi = re[q] * ci + im[q] * cr;
        re[q] = re[p] - vr; im[q] = im[p] - vi; re[p] += vr; im[p] += vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

export const DIM = (CEPS + 1) * 2;

/** One feature vector per 10 ms frame. */
export function mfcc(x: Float32Array, sr: number): Float64Array[] {
  const { mel, dct, win, nfft } = setup(sr);
  const n = win.length, hop = Math.round(HOP * sr);
  const re = new Float64Array(nfft), im = new Float64Array(nfft), logMel = new Float64Array(MELS);
  const base: Float64Array[] = [];
  for (let start = 0; start + n <= x.length; start += hop) {
    re.fill(0); im.fill(0);
    let e = 0;
    for (let i = 0; i < n; i++) {
      const v = (x[start + i] - 0.97 * (start + i > 0 ? x[start + i - 1] : 0)) * win[i];
      re[i] = v; e += v * v;
    }
    fft(re, im);
    for (let m = 0; m < MELS; m++) {
      let s = 0;
      const w = mel[m];
      for (let b = 0; b <= nfft / 2; b++) if (w[b]) s += w[b] * (re[b] * re[b] + im[b] * im[b]);
      logMel[m] = Math.log(s + 1e-10);
    }
    const v = new Float64Array(DIM);
    for (let k = 0; k < CEPS; k++) { let s = 0; for (let m = 0; m < MELS; m++) s += dct[k][m] * logMel[m]; v[k] = s; }
    v[CEPS] = Math.log(e + 1e-10);
    base.push(v);
  }
  // cepstral mean normalisation; energy keeps its level relative to the clip's loudest frame
  const half = CEPS + 1, T = base.length;
  if (!T) return base;
  let eMax = -Infinity;
  for (const v of base) eMax = Math.max(eMax, v[CEPS]);
  for (let k = 0; k < CEPS; k++) {
    let mean = 0;
    for (const v of base) mean += v[k];
    mean /= T;
    for (const v of base) v[k] -= mean;
  }
  for (const v of base) v[CEPS] -= eMax;
  for (let t = 0; t < T; t++) {
    for (let k = 0; k < half; k++) {
      let num = 0;
      for (let d = 1; d <= 2; d++) num += d * (base[Math.min(T - 1, t + d)][k] - base[Math.max(0, t - d)][k]);
      base[t][half + k] = num / 10;
    }
  }
  return base;
}
