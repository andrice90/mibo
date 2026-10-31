/// <reference types="node" />
/**
 * Calibration set for the attempt checker (src/voice/judge.ts).
 *
 *   npx tsx scripts/judge-test.ts --gen   # synthesise the set (~$0.02), then score it
 *   npx tsx scripts/judge-test.ts         # score whatever is in train-audio/judge/
 *
 * Files are named <who>_<heard>_<kind>_<word>[_<target>].wav, where <heard>
 * is what a listener would hear (s, th, sh, z, stop), <kind> is word, end or
 * hold, and <target> is the sound the lesson asked for (default: <heard>, or
 * s for a stop). Drop real recordings in with the same naming (e.g.
 * me_th_word_sun_s.wav for a lisped "sun") and they are scored too. The
 * folder is git-ignored: real voices never go in the repo.
 *
 * A /z/ heard as /s/ counts as right when the target is z: the check accepts
 * an unvoiced /z/ (src/voice/judge.ts).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { speak } from '../src/server/tts';
import { pcm16ToFloat } from '../src/voice/analyze';
import { judge, type Heard, type Kind, type Target } from '../src/voice/judge';

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'train-audio', 'judge');

// [heard, kind, text, word, target?]: correct and substituted forms of the lessons' targets
const SET: [Heard, Kind, string, string, Target?][] = [
  ['s', 'word', 'sun.', 'sun'], ['th', 'word', 'thun.', 'thun'], ['sh', 'word', 'shun.', 'shun'], ['stop', 'word', 'tun.', 'tun'],
  ['s', 'word', 'sock.', 'sock'], ['th', 'word', 'thock.', 'thock'], ['sh', 'word', 'shock.', 'shock'], ['stop', 'word', 'tock.', 'tock'],
  ['s', 'word', 'seal.', 'seal'], ['th', 'word', 'theel.', 'theel'],
  ['th', 'word', 'thumb.', 'thumb'], ['s', 'word', 'sumb.', 'sumb'], ['th', 'word', 'three.', 'three'], ['s', 'word', 'sree.', 'sree'],
  ['th', 'word', 'think.', 'think'], ['s', 'word', 'sink.', 'sink'],
  ['s', 'hold', 'Sssssss.', 'sss'], ['sh', 'hold', 'Shhhhhh.', 'shh'],
  // Lesson 2: sh at the start and the end, and /s/ said for it
  ['sh', 'word', 'shoe.', 'shoe'], ['s', 'word', 'sue.', 'sue', 'sh'], ['sh', 'word', 'ship.', 'ship'], ['s', 'word', 'sip.', 'sip', 'sh'],
  ['sh', 'word', 'sheep.', 'sheep'], ['sh', 'word', 'shell.', 'shell'],
  ['sh', 'end', 'fish.', 'fish'], ['s', 'end', 'fiss.', 'fiss', 'sh'], ['sh', 'end', 'brush.', 'brush'], ['s', 'end', 'bruss.', 'bruss', 'sh'],
  // Lesson 3: z at the start and the end, a tongue-out th for it, and an unvoiced z
  ['z', 'word', 'zoo.', 'zoo'], ['th', 'word', 'thoo.', 'thoo', 'z'], ['z', 'word', 'zebra.', 'zebra'], ['z', 'word', 'zip.', 'zip'],
  ['z', 'word', 'zero.', 'zero'], ['th', 'word', 'thero.', 'thero', 'z'],
  ['z', 'end', 'bees.', 'bees'], ['z', 'end', 'cheese.', 'cheese'], ['th', 'end', 'beeth.', 'beeth', 'z'],
  ['z', 'hold', 'Zzzzzzz.', 'zzz'],
];
const VOICES = ['Leda', 'Puck'];

async function gen() {
  mkdirSync(DIR, { recursive: true });
  process.loadEnvFile(path.join(ROOT, '.env'));
  const jobs = VOICES.flatMap(v => SET.map(([h, k, text, w, t]) => ({ file: path.join(DIR, `${v.toLowerCase()}_${h}_${k}_${w}${t ? `_${t}` : ''}.wav`), text, v })))
    .filter(j => !existsSync(j.file));
  console.log(`${jobs.length} to synthesise`);
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < jobs.length) {
      const j = jobs[i++];
      try {
        // plain reading, not Mibo's teaching style: the swapped words must come out as written
        writeFileSync(j.file, (await speak(j.text, true, 'Read the word exactly as spelled, once, plainly.', j.v)).wav);
      } catch (e) { console.error(`FAILED ${j.file}: ${(e as Error).message}`); }
    }
  }));
}

function score() {
  if (!existsSync(DIR)) { console.log('no files yet: run with --gen'); return; }
  const rows = readdirSync(DIR).filter(f => f.endsWith('.wav')).sort();
  let right = 0, total = 0;
  const confusion: Record<string, Record<string, number>> = {};
  for (const f of rows) {
    const [, heard, kind, , t] = f.replace('.wav', '').split('_') as [string, Heard, Kind, string, Target?];
    const target: Target = t ?? (heard === 'stop' || heard === 'none' ? 's' : heard);
    const bytes = new Uint8Array(readFileSync(path.join(DIR, f)));
    const sr = new DataView(bytes.buffer).getUint32(24, true);
    const v = judge(pcm16ToFloat(bytes.subarray(44)), sr, target, kind);
    const ok = v.heard === heard || (target === 'z' && heard === 'z' && v.heard === 's');
    right += +ok; total++;
    (confusion[heard] ??= {})[v.heard] = (confusion[heard][v.heard] ?? 0) + 1;
    const ft = v.feats;
    console.log(`${ok ? 'ok ' : 'XX '} ${f.padEnd(30)} heard ${v.heard.padEnd(4)}`
      + (ft ? ` ${String(ft.ms).padStart(4)}ms cen ${ft.centroid} pk ${ft.peak} flat ${ft.flatness} rel ${ft.relDb}dB` : ''));
  }
  console.log(`\n${right}/${total} right`);
  for (const [h, row] of Object.entries(confusion)) console.log(`  said ${h.padEnd(4)} -> ${Object.entries(row).map(([k, n]) => `${k}:${n}`).join(' ')}`);
}

(async () => { if (process.argv.includes('--gen')) await gen(); score(); })();
