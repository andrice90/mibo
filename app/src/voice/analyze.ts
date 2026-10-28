/**
 * Mouth shapes from audio, for voices that return no timing (Gemini TTS).
 * A TypeScript port of analyze() / mouth_track() in tools/tts_eval.py
 * (docs/06 §4), emitting the puppet's viseme keys instead of sprite poses.
 *
 * Every 10 ms frame gets a class: silence, a vowel by formants (LPC), a
 * fricative by spectral centroid, or other voiced/unvoiced sound. Runs of
 * equal classes become { v, d } steps the puppet plays like a text timeline.
 * Pure TS with no React Native imports: it runs in API routes and in Node.
 */

export const HOP = 0.01;
const WIN = 0.025;

export type FrameClass =
  | 'silence' | 'ah' | 'ee' | 'eh' | 'oh' | 'oo' | 'vowel'
  | 'fric_s' | 'fric_sh' | 'fric_flat' | 'voiced_other' | 'noise_other';

export type Frame = { t: number; rms: number; cls: FrameClass; centroid?: number };
export type Viseme = { v: string; d: number; i?: number; hold?: boolean };

// ------------------------------------------------------------------ dsp

function fftPow(re: Float64Array, im: Float64Array) {
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
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** Halve the sample rate with a short windowed-sinc low-pass. */
function decimate2(x: Float32Array): Float32Array {
  const taps = 15, h: number[] = [];
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const m = i - (taps - 1) / 2;
    const v = (m === 0 ? 0.5 : Math.sin(Math.PI * 0.5 * m) / (Math.PI * m)) * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (taps - 1)));
    h.push(v); sum += v;
  }
  const out = new Float32Array(Math.floor(x.length / 2));
  for (let o = 0; o < out.length; o++) {
    let acc = 0;
    for (let k = 0; k < taps; k++) {
      const idx = 2 * o + k - (taps - 1) / 2;
      if (idx >= 0 && idx < x.length) acc += x[idx] * h[k];
    }
    out[o] = acc / sum;
  }
  return out;
}

/** Formant peaks (Hz) of the LPC envelope; enough to tell ee / oo / ah apart. */
function lpcFormants(frame: Float32Array, sr: number, order = 12): number[] {
  const n = frame.length, x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const pre = i ? frame[i] - 0.63 * frame[i - 1] : frame[0];
    x[i] = pre * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1)));
  }
  const r = new Float64Array(order + 1);
  for (let l = 0; l <= order; l++) { let s = 0; for (let i = l; i < n; i++) s += x[i] * x[i - l]; r[l] = s; }
  if (r[0] <= 0) return [];
  const a = new Float64Array(order + 1); a[0] = 1;
  let err = r[0];
  for (let i = 1; i <= order; i++) {  // Levinson-Durbin
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / err;
    const prev = a.slice();
    for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k;
    err *= 1 - k * k;
    if (err <= 0) return [];
  }
  // Peaks of 1/|A(f)| instead of polynomial roots: no complex root finder needed.
  const step = 20, env: number[] = [], fs: number[] = [];
  for (let f = 150; f <= 4000; f += step) {
    const w = 2 * Math.PI * f / sr;
    let re = 0, im = 0;
    for (let j = 0; j <= order; j++) { re += a[j] * Math.cos(w * j); im -= a[j] * Math.sin(w * j); }
    env.push(-Math.log(re * re + im * im + 1e-12)); fs.push(f);
  }
  const out: number[] = [];
  for (let i = 1; i < env.length - 1; i++) {
    if (env[i] > env[i - 1] && env[i] >= env[i + 1]) {
      // keep only clear resonances: the peak stands above its neighbourhood
      const lo = Math.min(...env.slice(Math.max(0, i - 15), i)), hi = Math.min(...env.slice(i + 1, i + 16));
      if (env[i] - Math.max(lo, hi) > 0.6 && fs[i] > 200) out.push(fs[i]);
    }
  }
  return out;
}

function vowelFromFormants(f: number[]): FrameClass {
  if (f.length < 2) return 'vowel';
  const [f1, f2] = f;
  if (f1 < 420 && f2 > 1900) return 'ee';
  if (f1 < 480 && f2 < 1250) return 'oo';
  if (f1 >= 680) return 'ah';
  if (f2 < 1250) return 'oh';
  return 'eh';
}

// ------------------------------------------------------------------ analysis

/** Per-10ms frame classes for mono samples in [-1, 1] at 24 kHz (any even rate works). */
export function analyze(x: Float32Array, sr: number): Frame[] {
  const win = Math.round(WIN * sr), hop = Math.round(HOP * sr);
  const sr2 = sr / 2, x2 = decimate2(x), w2 = Math.round(WIN * sr2), h2 = Math.round(HOP * sr2);
  let peak = 1e-6;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const floor = peak * 0.04;  // about -28 dB re peak
  const N = 1 << Math.ceil(Math.log2(win));
  const re = new Float64Array(N), im = new Float64Array(N);
  const lagLo = Math.floor(sr2 / 400), lagHi = Math.floor(sr2 / 75);
  const frames: Frame[] = [];
  for (let i = 0, start = 0; start < Math.max(1, x.length - win); i++, start += hop) {
    let e = 0;
    for (let k = 0; k < win; k++) { const v = x[start + k] || 0; e += v * v; }
    const rms = Math.sqrt(e / win);
    const fr: Frame = { t: +(i * HOP).toFixed(3), rms, cls: 'silence' };
    frames.push(fr);
    // /θ/ and /f/ are much softer than vowels, so quiet frames still get a
    // look: they count as a hiss if their energy is mostly high-band.
    const quiet = rms < floor;
    if (rms < floor * 0.2) continue;

    re.fill(0); im.fill(0);
    for (let k = 0; k < win; k++) re[k] = (x[start + k] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / (win - 1)));
    fftPow(re, im);
    let total = 1e-12, hf = 0, cent = 0;
    for (let b = 0; b <= N / 2; b++) {
      const p = re[b] * re[b] + im[b] * im[b], f = b * sr / N;
      total += p; cent += f * p;
      if (f >= 3500) hf += p;
    }
    const hfr = hf / total;
    fr.centroid = cent / total;
    if (quiet) {
      if (hfr >= 0.5) fr.cls = fr.centroid > 5200 ? 'fric_s' : fr.centroid > 3000 ? 'fric_sh' : 'fric_flat';
      continue;
    }

    // voicing from autocorrelation on the half-rate signal
    const s2 = i * h2, seg = x2.subarray(s2, s2 + w2);
    let mean = 0;
    for (let k = 0; k < seg.length; k++) mean += seg[k];
    mean /= seg.length || 1;
    let ac0 = 0, best = 0;
    for (let k = 0; k < seg.length; k++) ac0 += (seg[k] - mean) ** 2;
    for (let lag = lagLo; lag < Math.min(lagHi, seg.length); lag++) {
      let s = 0;
      for (let k = lag; k < seg.length; k++) s += (seg[k] - mean) * (seg[k - lag] - mean);
      if (s > best) best = s;
    }
    const voicing = ac0 > 0 ? best / ac0 : 0;

    if (voicing > 0.45 && hfr < 0.35) {
      fr.cls = seg.length === w2 ? vowelFromFormants(lpcFormants(seg, sr2).slice(0, 3)) : 'vowel';
    } else if (hfr >= 0.35) {
      // fricative place from the centroid: /s,z/ highest, /sh/ mid, /f,th/ flat
      const c = fr.centroid;
      fr.cls = c > 5200 ? 'fric_s' : c > 3000 ? 'fric_sh' : 'fric_flat';
    } else {
      fr.cls = voicing > 0.45 ? 'voiced_other' : 'noise_other';
    }
  }
  return frames;
}

const MOUTH: Record<FrameClass, string> = {
  silence: 'rest', ah: 'ah', ee: 'ee', eh: 'eh', oh: 'oh', oo: 'oo', vowel: 'eh',
  fric_s: 's', fric_sh: 'sh', fric_flat: 'f', voiced_other: 'dt', noise_other: 'dt',
};

type Run = { v: string; n: number; fric: number };

/**
 * Frames -> puppet viseme steps. `fricative` overrides the mouth for every
 * fricative frame (a /θ/ model clip shows the tongue-out 'th' pose, which the
 * centroid cannot tell from /f/), and long fricative runs become holds, so
 * the puppet zooms in for "watch my mouth". `text` spreads caption positions
 * over the sounding time.
 *
 * Raw frame classes flicker (the vowel guess jumps between ah, eh and ee
 * every 10 ms), which made the mouth swap shapes 8-9 times a second. So the
 * track is smoothed like hand-drawn lip sync: a mode filter first, then any
 * shape held for less than `minHold` seconds is folded into its neighbour.
 */
export function toVisemes(
  frames: Frame[],
  opts: { fricative?: string; text?: string; holdAfter?: number; minHold?: number; smooth?: number } = {},
): Viseme[] {
  const holdAfter = opts.holdAfter ?? 0.35;
  const minN = Math.round((opts.minHold ?? 0.11) / HOP);
  const r = opts.smooth ?? 4;  // mode filter half-width, in frames
  const raw = frames.map(f => (f.cls.startsWith('fric') && opts.fricative ? opts.fricative : MOUTH[f.cls]));
  const isFric = frames.map(f => f.cls.startsWith('fric'));

  const keys = raw.map((_, i) => {
    const count: Record<string, number> = {};
    let best = raw[i];
    for (let j = Math.max(0, i - r); j <= Math.min(raw.length - 1, i + r); j++) {
      count[raw[j]] = (count[raw[j]] || 0) + (j === i ? 1.5 : 1);  // ties keep the frame's own shape
      if (count[raw[j]] > count[best]) best = raw[j];
    }
    return best;
  });

  let runs: Run[] = [];
  keys.forEach((v, i) => {
    const last = runs[runs.length - 1];
    if (last && last.v === v) { last.n++; last.fric += +isFric[i]; } else runs.push({ v, n: 1, fric: +isFric[i] });
  });

  // Fold the shortest too-short run into its longer neighbour until none are left.
  for (;;) {
    let k = -1;
    runs.forEach((x, i) => { if (x.n < minN && runs.length > 1 && (k < 0 || x.n < runs[k].n)) k = i; });
    if (k < 0) break;
    const a = runs[k - 1], b = runs[k + 1];
    const into = !a ? b : !b ? a : a.n >= b.n ? a : b;
    into.n += runs[k].n; into.fric += runs[k].fric;
    runs.splice(k, 1);
    const merged: Run[] = [];
    for (const x of runs) {
      const last = merged[merged.length - 1];
      if (last && last.v === x.v) { last.n += x.n; last.fric += x.fric; } else merged.push(x);
    }
    runs = merged;
  }
  const sounding = frames.filter(f => f.cls !== 'silence').length || 1;
  const len = opts.text ? opts.text.length : 0;
  let heard = 0;
  return runs.map(x => {
    const out: Viseme = { v: x.v, d: +(x.n * HOP).toFixed(3) };
    if (len) out.i = Math.min(len - 1, Math.floor(heard / sounding * len));
    if (x.v !== 'rest') heard += x.n;
    if (opts.fricative && x.fric > x.n / 2 && x.n * HOP >= holdAfter) out.hold = true;
    return out;
  });
}

/** Longest stretch of fricative frames, in seconds: the model-clip check from docs/06 §5. */
export function longestFricative(frames: Frame[]): number {
  let best = 0, cur = 0;
  for (const f of frames) { cur = f.cls.startsWith('fric') ? cur + 1 : 0; best = Math.max(best, cur); }
  return +(best * HOP).toFixed(2);
}

/**
 * Cut dead air from both ends of a clip (16-bit PCM bytes), keeping a short
 * breath either side. Leda leaves up to 0.7 s of silence after a line, and
 * back to back that read as awkward waiting.
 */
export function trimEdges(pcm: Uint8Array, sr: number, lead = 0.05, tail = 0.12): Uint8Array {
  const frames = analyze(pcm16ToFloat(pcm), sr);
  const first = frames.findIndex(f => f.cls !== 'silence');
  if (first < 0) return pcm;
  let last = frames.length - 1;
  while (last > first && frames[last].cls === 'silence') last--;
  const a = Math.max(0, Math.round((first * HOP - lead) * sr)) * 2;
  const b = Math.min(pcm.length, Math.round(((last + 1) * HOP + WIN + tail) * sr) * 2);
  return pcm.slice(a, b);
}

// ------------------------------------------------------------------ wav

/** 16-bit little-endian PCM bytes -> float samples. */
export function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const n = Math.floor(bytes.length / 2), out = new Float32Array(n);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
  for (let i = 0; i < n; i++) out[i] = dv.getInt16(i * 2, true) / 32768;
  return out;
}

/** Wrap raw mono 16-bit PCM in a WAV header so any player can open it. */
export function pcmToWav(pcm: Uint8Array, sr: number): Uint8Array {
  const out = new Uint8Array(44 + pcm.length), dv = new DataView(out.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length, true); str(8, 'WAVE');
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}
