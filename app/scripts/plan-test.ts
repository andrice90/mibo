/// <reference types="node" />
/**
 * Made-lesson plans keep every word the grown-up asked for.
 *   npx tsx scripts/plan-test.ts
 * Multi-syllable and cluster words (strawberry, sunflower, spider) are
 * practised like any other: tries are judged by speech-to-text
 * (scripts/stt-test.ts), so validatePlan must not drop, rewrite or
 * downgrade them. Exits nonzero on failure.
 */
import { soundForWord, validatePlan } from '../src/lesson/plan';

let fails = 0;
const is = (word: string, want: string) => {
  const got = soundForWord(word);
  if (got !== want) { fails++; console.log(`FAIL ${word}: got ${got}, want ${want}`); }
  else console.log(`ok ${word} -> ${got}`);
};

// opening sound, for reply tips/colouring only (never a gate)
for (const w of ['sun', 'strawberry', 'spider']) is(w, 's');
for (const w of ['ship', 'sheep']) is(w, 'sh');
for (const w of ['thumb', 'think']) is(w, 'th');
for (const w of ['zoo', 'zebra']) is(w, 'z');
for (const w of ['ball', 'banana', 'cheese']) is(w, 'custom');

const plan = validatePlan({
  title: 'Garden Words', subtitle: 'Outdoor words', emoji: '🌻',
  introLine: 'Hi friend! Garden words today!', warmupLine: 'Wiggle your tongue!', byeLine: 'You did it!',
  words: [
    { word: 'sun', emoji: '☀️', modelText: 'Sssss... sun!' },
    { word: 'strawberry', emoji: '🍓', modelText: 'Straw... ber... ry! Strawberry!' },
    { word: 'sunflower', emoji: '🌻', modelText: 'Sun... flow... er! Sunflower!' },
    { word: 'banana', emoji: '🍌', modelText: 'Ba... na... na! Banana!' },
  ],
}, 'multi-syllable garden words');
if (!plan) { fails++; console.log('FAIL plan rejected'); }
else {
  for (const w of ['sun', 'strawberry', 'sunflower', 'banana']) {
    if (!plan.words.some(x => x.word === w)) { fails++; console.log(`FAIL ${w} dropped from plan`); }
    else console.log(`ok ${w} kept in plan`);
  }
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
