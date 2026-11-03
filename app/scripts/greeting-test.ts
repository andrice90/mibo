/// <reference types="node" />
/**
 * One greeting per lesson.
 *   npx tsx scripts/greeting-test.ts
 * Named: "Hi {name}!" plays and the first line ("Hi friend! …") is skipped.
 * Anonymous: no name line, straight to "Hi friend!". A lesson whose first
 * step is not a spoken line never loses a step. Exits nonzero on failure.
 */
import { firstStepAfterGreeting, PLANS } from '../src/lesson/content';

let fails = 0;
const is = (got: number, want: number, label: string) => {
  if (got !== want) { fails++; console.log(`FAIL ${label}: got ${got}, want ${want}`); }
  else console.log(`ok ${label} -> ${got}`);
};

for (const [id, steps] of Object.entries(PLANS)) {
  is(firstStepAfterGreeting(steps, true), 1, `${id} named skips "Hi friend"`);
  is(firstStepAfterGreeting(steps, false), 0, `${id} anonymous keeps "Hi friend"`);
}
is(firstStepAfterGreeting([{ kind: 'try', ex: PLANS['s-th'].find(s => s.kind === 'try')!.ex }], true), 0, 'try-first lesson keeps its first step');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
