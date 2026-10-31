/// <reference types="node" />
/**
 * Calibration set for the twisty-word checker (src/voice/wordcheck.ts).
 *
 *   npx tsx scripts/wordcheck-test.ts --gen   # synthesise the set, then score it
 *   npx tsx scripts/wordcheck-test.ts         # score whatever is in train-audio/wordcheck/
 *
 * Files are named <who>_<target>_<expect>_<said>.wav in train-audio/wordcheck/
 * (git-ignored, like the judge set). Each twisty word gets: the word itself,
 * a muddled try a child might make ("pasghetti"), another twisty word, and an
 * unrelated word. Right and muddled tries must pass; wrong words must not.
 * Exits nonzero when a category misses its bar, so it can gate a change.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { speak } from '../src/server/tts';
import { pcm16ToFloat } from '../src/voice/analyze';
import { judgeWord } from '../src/voice/wordcheck';

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'train-audio', 'wordcheck');

// [target, said text, expect] — muddled spellings are read exactly as spelled
const MUDDLED: Record<string, string> = {
  spaghetti: 'pasghetti', elephant: 'elepant', dinosaur: 'dinosore',
  butterfly: 'buttefly', umbrella: 'umbewwa', hippopotamus: 'hippopotamuth',
};
const WORDS = Object.keys(MUDDLED);
const OTHER = ['banana', 'cat', 'pizza', 'monkey'];
const SET: [string, string, 'pass' | 'fail'][] = WORDS.flatMap((w, i) => [
  [w, w, 'pass'],
  [w, MUDDLED[w], 'pass'],
  [w, WORDS[(i + 1) % WORDS.length], 'fail'],
  [w, OTHER[i % OTHER.length], 'fail'],
] as [string, string, 'pass' | 'fail'][]);
const VOICES = ['Leda', 'Puck'];

async function gen() {
  mkdirSync(DIR, { recursive: true });
  process.loadEnvFile(path.join(ROOT, '.env'));
  const jobs = VOICES.flatMap(v => SET.map(([target, said, expect]) => ({
    file: path.join(DIR, `${v.toLowerCase()}_${target}_${expect}_${said}.wav`), text: `${said}.`, v,
  }))).filter(j => !existsSync(j.file));
  console.log(`${jobs.length} to synthesise`);
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < jobs.length) {
      const j = jobs[i++];
      try {
        writeFileSync(j.file, (await speak(j.text, true, 'Read the word exactly as spelled, once, plainly.', j.v)).wav);
      } catch (e) { console.error(`FAILED ${j.file}: ${(e as Error).message}`); }
    }
  }));
}

function score(): boolean {
  if (!existsSync(DIR)) { console.log('no files yet: run with --gen'); return false; }
  const rows = readdirSync(DIR).filter(f => f.endsWith('.wav')).sort();
  const cats: Record<string, { ok: number; n: number }> = {};
  for (const f of rows) {
    const [, target, expect] = f.replace('.wav', '').split('_');
    const bytes = new Uint8Array(readFileSync(path.join(DIR, f)));
    const sr = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(24, true);
    const v = judgeWord(pcm16ToFloat(bytes.subarray(44)), sr, target);
    const want = expect === 'pass';
    const ok = v.match === want;
    const cat = f.includes(`_${MUDDLED[target]}.`) ? 'muddled' : want ? 'right' : 'wrong';
    (cats[cat] ??= { ok: 0, n: 0 }).n++; cats[cat].ok += +ok;
    console.log(`${ok ? 'ok ' : 'XX '} ${f.padEnd(42)} match=${String(v.match)} best=${v.best ?? '-'} d=${v.dists ? Object.entries(v.dists).map(([k, d]) => `${k.slice(0, 4)}:${d.toFixed(1)}`).join(' ') : '-'}`);
  }
  let good = true;
  for (const [cat, bar] of [['right', 0.85], ['muddled', 0.7], ['wrong', 0.9]] as const) {
    const c = cats[cat] ?? { ok: 0, n: 0 };
    const rate = c.n ? c.ok / c.n : 0;
    console.log(`${cat}: ${c.ok}/${c.n} (bar ${bar})`);
    if (rate < bar) good = false;
  }
  return good;
}

(async () => { if (process.argv.includes('--gen')) await gen(); process.exit(score() ? 0 : 1); })();
