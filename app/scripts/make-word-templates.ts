/// <reference types="node" />
/**
 * Builds the twisty-word templates the on-device word check compares
 * against: MFCC frames of just the whole word at the end of each bundled
 * model clip ("Spa... ghe... tti! Spaghetti!" -> the "Spaghetti!").
 *
 *   npx tsx scripts/make-word-templates.ts
 *
 * Run after scripts/make-clips.ts makes new word_* clips. Writes
 * src/lesson/word-templates.json (checked in: it is part of the app bundle).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { pcm16ToFloat } from '../src/voice/analyze';
import { mfcc } from '../src/voice/features';
import { speechRuns } from '../src/voice/wordcheck';

const ROOT = path.resolve(__dirname, '..');
const WORDS = ['spaghetti', 'elephant', 'dinosaur', 'butterfly', 'umbrella', 'hippopotamus'];
const OUT = path.join(ROOT, 'src', 'lesson', 'word-templates.json');

const templates: Record<string, number[][]> = {};
for (const w of WORDS) {
  const bytes = new Uint8Array(readFileSync(path.join(ROOT, 'assets', 'voice', `word_${w}.wav`)));
  const sr = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(24, true);
  const x = pcm16ToFloat(bytes.subarray(44));
  const runs = speechRuns(x, sr);
  const [a, b] = runs[runs.length - 1];   // the whole word comes last in every model clip
  const frames = mfcc(x.subarray(a, b), sr).map(f => [...f.slice(0, 12)].map(v => +v.toFixed(2)));
  templates[w] = frames;
  console.log(`${w}: runs ${runs.map(([s, e]) => ((e - s) / sr).toFixed(2) + 's').join(' ')} -> template ${frames.length} frames (${(frames.length / 100).toFixed(2)}s)`);
}
writeFileSync(OUT, JSON.stringify(templates));
console.log(`wrote ${OUT}`);
