/**
 * What did the child's hiss sound like? On-device acoustic check of one try
 * (PROJECT #10: the audio is analysed in memory and dropped, never stored
 * or sent; PROJECT #12: this is a sound-level check, not word recognition).
 *
 * A speech recogniser would hide exactly the errors we care about: it hears
 * "thun" and writes "sun". The sounds differ physically, though:
 *   /s/  strong, compact hiss with its peak high up (above ~5 kHz)
 *   /θ/  weak, flat, spread-out noise (the interdental lisp)
 *   /ʃ/  hiss peaking lower, ~2.5-4.5 kHz (also a palatal/lateral-ish /s/)
 *   /t/  a short burst instead of a held hiss ("tun" for "sun")
 *   /z/  an /s/ with the voice on: the same high hiss over a buzz
 * So we find the hiss (before the first vowel for a word, after the last
 * vowel for an end-of-word sound, the longest one for a held sound) and
 * measure its spectrum and loudness relative to the vowel. The verdict is a suggestion for the grown-up, who confirms with
 * one tap (PROJECT #6); thresholds come from calibration recordings.
 */

export type Heard = 's' | 'th' | 'sh' | 'z' | 'stop' | 'none';
/** The sounds a lesson can ask for. */
export type Target = 's' | 'th' | 'sh' | 'z';
/** Where the sound is: held on its own, at the start of a word, or at the end of one. */
export type Kind = 'hold' | 'word' | 'end';
export type Verdict = {
  heard: Heard;
  match: boolean | null;  // null: could not tell (no speech, too noisy)
  speech: boolean;
  feats?: { ms: number; centroid: number; peak: number; flatness: number; relDb: number; levelDb: number };
};

const HOP = 0.01, WIN = 0.02;
const VOWEL_RUN = 5;   // frames (50 ms)

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

type F = { db: number; voiced: boolean; hf: number; spec: Float64Array };

function frames(x: Float32Array, sr: number) {
  const win = Math.round(WIN * sr), hop = Math.round(HOP * sr);
  const N = 1 << Math.ceil(Math.log2(win));
  const re = new Float64Array(N), im = new Float64Array(N);
  const binHz = sr / N, lo = Math.ceil(1000 / binHz), hi = Math.min(N / 2 - 1, Math.floor(Math.min(11000, sr / 2 - 500) / binHz));
  const split = Math.round(2500 / binHz);
  const lagLo = Math.floor(sr / 400), lagHi = Math.floor(sr / 75);
  const out: F[] = [];
  for (let s = 0; s + win <= x.length; s += hop) {
    let e = 0, mean = 0;
    for (let k = 0; k < win; k++) { e += x[s + k] * x[s + k]; mean += x[s + k]; }
    mean /= win;
    const db = 10 * Math.log10(e / win + 1e-12);
    // voicing: normalised autocorrelation peak over plausible pitch lags (every 2nd sample is plenty)
    let ac0 = 0, best = 0;
    for (let k = 0; k < win; k += 2) ac0 += (x[s + k] - mean) ** 2;
    for (let lag = lagLo; lag < Math.min(lagHi, win - 1); lag += 2) {
      let c = 0;
      for (let k = lag; k < win; k += 2) c += (x[s + k] - mean) * (x[s + k - lag] - mean);
      if (c > best) best = c;
    }
    re.fill(0); im.fill(0);
    for (let k = 0; k < win; k++) re[k] = x[s + k] * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / (win - 1)));
    fft(re, im);
    const spec = new Float64Array(hi - lo + 1);
    let low = 1e-12, high = 1e-12;
    for (let b = 1; b <= N / 2; b++) {
      const p = re[b] * re[b] + im[b] * im[b];
      if (b < split) low += p; else high += p;
      if (b >= lo && b <= hi) spec[b - lo] = p;
    }
    out.push({ db, voiced: ac0 > 0 && best / ac0 > 0.5, hf: high / (low + high), spec });
  }
  return { out, binHz, lo };
}

const pct = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? -120; };

/**
 * Judge one try. `kind`: 'word' finds the hiss before the first vowel
 * ("sun"); 'end' the one after the last vowel ("fish"); 'hold' takes the
 * longest hiss anywhere ("Sssss").
 *
 * For /z/ a voiced hiss counts too, and an /s/ passes: the teeth and tongue
 * were right, and the buzz often drops out (always, nearly, at the end of a
 * word). What the check is for is a tongue-out or shushy sound.
 */
export function judge(x: Float32Array, sr: number, target: Target, kind: Kind): Verdict {
  const { out: fr, binHz, lo } = frames(x, sr);
  if (fr.length < 10) return { heard: 'none', match: null, speech: false };
  const dbs = fr.map(f => f.db);
  const floor = pct(dbs, 0.1), peak = pct(dbs, 0.98);
  const speechGate = Math.max(floor + 12, peak - 40);
  const speech = fr.some(f => f.db > speechGate) && peak - floor > 15;
  if (!speech) return { heard: 'none', match: null, speech: false };

  const vowel = (f: F) => f.voiced && f.hf < 0.3 && f.db > speechGate;
  // /θ/ is soft, so a hiss frame only needs to clear the noise floor, not the speech gate;
  // a /z/ hiss rides on the voice, whose low hum takes a share of the energy
  const buzz = target === 'z';
  const hiss = (f: F) => (!f.voiced || buzz) && f.hf > (f.voiced ? 0.35 : 0.4) && f.db > floor + 5;
  // a vowel lasts: the short voiced blip a /z/ often starts with is not one. Its
  // loudness bar is lower than vowel()'s, as a loud hiss lifts the floor ("sree")
  const voicedRun = (f: F) => f.voiced && f.hf < 0.3 && f.db > floor + 6;
  let firstVowel = -1, lastVowel = -1;
  for (let i = 0, n = 0; i < fr.length; i++) {
    n = voicedRun(fr[i]) ? n + 1 : 0;
    if (n === VOWEL_RUN && firstVowel < 0) firstVowel = i - VOWEL_RUN + 1;
    if (n >= VOWEL_RUN) lastVowel = i;
  }
  const vowelDb = firstVowel >= 0 ? pct(fr.filter(vowel).map(f => f.db), 0.9) : NaN;

  // find the hiss run that counts
  let a = -1, b = -1;
  const runs: [number, number][] = [];
  for (let i = 0, s = -1; i <= fr.length; i++) {
    const h = i < fr.length && hiss(fr[i]);
    if (h && s < 0) s = i;
    if (!h && s >= 0) { if (i - s >= 2) runs.push([s, i]); s = -1; }
  }
  if (kind === 'word' && firstVowel >= 0) {
    // the run that ends closest before the first vowel (small gaps allowed)
    const before = runs.filter(([, e]) => e <= firstVowel + 1 && firstVowel - e < 15);
    if (before.length) [a, b] = before[before.length - 1];
  } else if (kind === 'end' && lastVowel >= 0) {
    // the first run that starts after the last vowel (children often pause first: "fi... sh")
    const after = runs.find(([s]) => s >= lastVowel - 1 && s - lastVowel < 35);
    if (after) [a, b] = after;
  } else if (runs.length) {
    [a, b] = runs.reduce((m, r) => (r[1] - r[0] > m[1] - m[0] ? r : m));
  }
  const ms = a >= 0 ? (b - a) * HOP * 1000 : 0;
  if (ms < 20) {
    // no hiss at all: a stopped sound ("tun") if a vowel follows, else nothing to judge
    return { heard: firstVowel >= 0 ? 'stop' : 'none', match: firstVowel >= 0 ? false : null, speech: true };
  }

  // average spectrum of the hiss and its shape
  const n = fr[a].spec.length, avg = new Float64Array(n);
  let levelDb = 0, voiced = 0;
  for (let i = a; i < b; i++) { for (let k = 0; k < n; k++) avg[k] += fr[i].spec[k]; levelDb += fr[i].db; voiced += +fr[i].voiced; }
  levelDb /= b - a;
  let tot = 0, m1 = 0, logSum = 0, pk = 0, pkv = 0;
  for (let k = 0; k < n; k++) {
    const hz = (k + lo) * binHz, p = avg[k] / (b - a) + 1e-14;
    tot += p; m1 += hz * p; logSum += Math.log(p);
    // smoothed peak (±3 bins) so a single spike does not win
    let sm = 0;
    for (let d = -3; d <= 3; d++) sm += avg[Math.max(0, Math.min(n - 1, k + d))];
    if (sm > pkv) { pkv = sm; pk = hz; }
  }
  const centroid = m1 / tot;
  const flatness = Math.exp(logSum / n) / (tot / n);   // 1 = perfectly flat noise, 0 = one sharp peak
  const relDb = Number.isFinite(vowelDb) ? levelDb - vowelDb : NaN;

  let heard = classify(centroid, flatness, relDb, ms, kind);
  if (heard === 's' && buzz && voiced / (b - a) > 0.3) heard = 'z';
  return {
    heard, speech: true, match: heard === target || (target === 'z' && heard === 's'),
    feats: { ms: Math.round(ms), centroid: Math.round(centroid), peak: Math.round(pk), flatness: +flatness.toFixed(3), relDb: +relDb.toFixed(1), levelDb: +levelDb.toFixed(1) },
  };
}

/**
 * Thresholds, tuned on the calibration set (scripts/judge-test.ts):
 * /s/ centroid 8.1-9.2 kHz, flat < 0.25, within ~12 dB of the vowel;
 * /ʃ/ centroid 4.3-6.8 kHz; /θ/ 18-30 dB quieter than the vowel and flat;
 * a /t/ release is a 60-100 ms puff, a real /s/ in a word lasts 240 ms or more.
 * A quiet hiss is /θ/ unless it peaks low: a soft /ʃ/ ("shell") is still /ʃ/,
 * and every held /θ/ in the set sat above 6 kHz.
 */
export const T = { shCentroid: 7000, shQuietCentroid: 6000, thRel: -18, thFlat: 0.4, thCentroid: 7000, stopMs: 110 };

function classify(centroid: number, flatness: number, relDb: number, ms: number, kind: Kind): Heard {
  const quiet = Number.isFinite(relDb) && relDb < T.thRel;
  if (kind !== 'hold' && ms < T.stopMs) return quiet ? 'th' : 'stop';
  if (quiet) return centroid < T.shQuietCentroid ? 'sh' : 'th';
  if (flatness > T.thFlat && centroid > T.thCentroid) return 'th';
  if (centroid < T.shCentroid) return 'sh';
  return 's';
}

export type TryVerdict = Verdict & { words: Verdict[] };

/**
 * Judge a whole listening window that may hold several words ("seal...
 * mama... seal"): split it at pauses, check each word on its own, and pass
 * if any of them has the target sound. A child often needs a couple of goes,
 * and grown-ups chat in between; one good one is a pass.
 */
export function judgeTry(x: Float32Array, sr: number, target: Target, kind: Kind): TryVerdict {
  const hop = Math.round(HOP * sr), win = Math.round(WIN * sr);
  const dbs: number[] = [];
  for (let s = 0; s + win <= x.length; s += hop) {
    let e = 0;
    for (let k = 0; k < win; k++) e += x[s + k] * x[s + k];
    dbs.push(10 * Math.log10(e / win + 1e-12));
  }
  if (dbs.length < 10) return { heard: 'none', match: null, speech: false, words: [] };
  const floor = pct(dbs, 0.1), peak = pct(dbs, 0.98);
  if (peak - floor < 15) return { heard: 'none', match: null, speech: false, words: [] };
  // loud-enough runs, joined across gaps under 250 ms, kept if over 150 ms long
  const gate = Math.max(floor + 10, peak - 35);
  const runs: [number, number][] = [];
  for (let i = 0, s = -1, quiet = 0; i <= dbs.length; i++) {
    const loud = i < dbs.length && dbs[i] > gate;
    if (loud) { if (s < 0) s = i; quiet = 0; continue; }
    if (s >= 0 && (++quiet > 25 || i === dbs.length)) { runs.push([s, i - quiet + 1]); s = -1; quiet = 0; }
  }
  const words = runs.filter(([a, b]) => b - a >= 15).map(([a, b]) => {
    // pad each word so its soft start (/θ/, a quiet /s/) and the vowel after it are both inside
    const from = Math.max(0, (a - 30) * hop), to = Math.min(x.length, (b + 15) * hop + win);
    return judge(x.subarray(from, to), sr, target, kind);
  }).filter(v => v.speech);
  if (!words.length) return { heard: 'none', match: null, speech: true, words };
  const hit = words.find(v => v.match);
  if (hit) return { ...hit, words };
  // no match: report the most common other sound, so Mibo's reply can name it
  const counts = new Map<Heard, number>();
  for (const v of words) if (v.heard !== 'none') counts.set(v.heard, (counts.get(v.heard) ?? 0) + 1);
  const top = [...counts.entries()].sort((p, q) => q[1] - p[1])[0];
  const pick = top ? words.find(v => v.heard === top[0])! : words[0];
  return { ...pick, words };
}
