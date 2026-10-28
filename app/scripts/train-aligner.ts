/// <reference types="node" />
/**
 * Trains the lip-sync aligner on Leda's voice (src/voice/aligner.ts) and
 * writes src/voice/phone-model.json.
 *
 *   npx tsx scripts/train-aligner.ts --gen    # make any missing corpus audio first (~$0.05)
 *   npx tsx scripts/train-aligner.ts          # train on what is on disk
 *
 * Training audio: every bundled lesson clip, plus CORPUS below, short
 * sentences in Mibo's register chosen so every US English phoneme turns up a
 * good number of times. Corpus audio goes to train-audio/ (git-ignored); only
 * the small model is committed. After training, run
 * `npx tsx scripts/make-clips.ts --reanalyze` to rebuild the clips' mouth tracks.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { speak, SAMPLE_RATE } from '../src/server/tts';
import { train, type Utterance } from '../src/voice/aligner';
import { pcm16ToFloat } from '../src/voice/analyze';

const ROOT = path.resolve(__dirname, '..');
const CLIPS = path.join(ROOT, 'assets', 'voice');
const TRAIN = path.join(ROOT, 'train-audio');
const MODEL = path.join(ROOT, 'src', 'voice', 'phone-model.json');

const CORPUS = [
  'Look at the big brown cow jumping over the moon.',
  'The happy dog found a shiny red ball in the garden.',
  'Can you hop like a bunny? One, two, three, hop!',
  'My favourite fruit is a juicy orange.',
  'The yellow duck swims on the pond with her ducklings.',
  'Nine noisy monkeys are eating bananas in the jungle.',
  'Good morning! Did you sleep well last night?',
  'We put on our boots and splash in the puddles.',
  'The little boy is playing with his toy boat.',
  'Thank you for helping me find my shoe.',
  'Zebras have black and white stripes.',
  'Every evening the owl hoots in the old oak tree.',
  'Measure the treasure with your ruler, please.',
  'Joy and George enjoyed the orange juice.',
  'Which way is the cheerful cheetah running?',
  'The rain is falling on the window. Pitter patter.',
  'Wow, what a wonderful rainbow!',
  'Under the bridge lives a grumpy green troll.',
  'Can you think of something that starts with sss?',
  'Mother bear, father bear, and baby bear went for a walk.',
  'The cat sat on the mat and took a long nap.',
  'Point your finger at the moon and the stars.',
  'I like to sing songs and ring the bell.',
  'Hello! How are you today? I am feeling great.',
  'Your nose, your toes, and your knees.',
  'Seven silly snakes slide down the sandy hill.',
  'Three thin thumbs think about things.',
  'She sells shells by the sea shore.',
  'The kitten is curled up in a cozy basket.',
  'Push the button and the music will play.',
  'Bring your blue blanket to bed.',
  'Vroom vroom! The van is very fast.',
  'Quick, quack, the quiet duck is quacking.',
  'The giraffe has a long neck and a gentle face.',
  'Open your mouth wide and say ahh.',
  'Now close your lips and hum, mmm.',
  'Round lips, oooh. Big smile, eeee.',
  'The lion yawned and laid down in the sun.',
  'Our garden has roses, daisies and tulips.',
  'Nothing is better than a warm hug.',
];

const args = process.argv.slice(2);
process.loadEnvFile(path.join(ROOT, '.env'));
mkdirSync(TRAIN, { recursive: true });

const readWav = (f: string) => pcm16ToFloat(new Uint8Array(readFileSync(f)).subarray(44));

async function main() {
  if (args.includes('--gen')) {
    const todo = CORPUS.map((t, i) => [t, path.join(TRAIN, `c${String(i).padStart(2, '0')}.wav`)] as const)
      .filter(([, f]) => !existsSync(f));
    console.log(`${todo.length} corpus lines to synthesise`);
    let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < todo.length) {
        const [text, file] = todo[next++];
        try { writeFileSync(file, (await speak(text)).wav); console.log(`ok ${path.basename(file)}`); }
        catch (e) { console.error(`FAILED ${text}: ${(e as Error).message}`); }
      }
    }));
  }

  const utts: Utterance[] = [];
  const manifest = JSON.parse(readFileSync(path.join(CLIPS, 'clips.json'), 'utf8')) as Record<string, { text: string }>;
  for (const [id, e] of Object.entries(manifest)) {
    const f = path.join(CLIPS, `${id}.wav`);
    if (existsSync(f)) utts.push({ text: e.text, samples: readWav(f), sr: SAMPLE_RATE });
  }
  CORPUS.forEach((text, i) => {
    const f = path.join(TRAIN, `c${String(i).padStart(2, '0')}.wav`);
    if (existsSync(f)) utts.push({ text, samples: readWav(f), sr: SAMPLE_RATE });
  });
  const seconds = utts.reduce((a, u) => a + u.samples.length / u.sr, 0);
  console.log(`training on ${utts.length} lines, ${seconds.toFixed(0)} s of audio`);

  const model = train(utts, 10, console.log);
  const round = (v: number) => +v.toPrecision(5);
  for (const g of Object.values(model.phones)) { g.mean = g.mean.map(round); g.ivar = g.ivar.map(round); g.norm = round(g.norm); }
  writeFileSync(MODEL, JSON.stringify(model));
  console.log(Object.entries(model.phones).sort((a, b) => a[1].n - b[1].n).map(([p, g]) => `${p}:${g.n}`).join(' '));
  console.log(`wrote ${path.relative(ROOT, MODEL)}`);
}

main();
