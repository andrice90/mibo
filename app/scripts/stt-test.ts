/// <reference types="node" />
/**
 * Speech-to-text transcript matching for made lessons.
 *   npx tsx scripts/stt-test.ts
 * Any word can pass — short, clustered or multi-syllable — when the
 * recogniser hears it; a different word must not. Short words are exact
 * ("some" is not "sun"). Exits nonzero on failure.
 */
import { matchTranscript } from '../src/voice/stt-match';
import { startStt } from '../src/voice/stt';

let fails = 0;
const is = (alts: string[], target: string, want: boolean) => {
  const got = matchTranscript(alts, target);
  if (got !== want) { fails++; console.log(`FAIL "${alts[0]}" vs ${target}: got ${got}, want ${want}`); }
  else console.log(`ok "${alts[0]}" vs ${target} -> ${got}`);
};

// right words, incl. multi-syllable and mis-hearings
is(['strawberry'], 'strawberry', true);
is(['straw berry'], 'strawberry', true);
is(['strawbery'], 'strawberry', true);
is(['sunflower'], 'sunflower', true);
is(['a sunflower'], 'sunflower', true);
is(['elephant'], 'elephant', true);
is(['banana', 'bandana'], 'banana', true);   // an alternative can carry it
is(['sun'], 'sun', true);
is(['ship'], 'ship', true);

// wrong words must not pass
is(['banana'], 'strawberry', false);
is(['some'], 'sun', false);
is(['fun'], 'sun', false);
is(['soap'], 'sun', false);
is([''], 'sun', false);

// No native module in this environment (like Expo Go): importing stt must
// not throw ("Cannot find native module 'ExpoSpeechRecognition'") and the
// session must come back null, so lessons fall back instead of crashing.
if (startStt('sun') !== null) { fails++; console.log('FAIL startStt should be null without a recogniser'); }
else console.log('ok startStt -> null without a recogniser (no import crash)');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
