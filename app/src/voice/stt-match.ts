/**
 * Did the recogniser hear the target word? Pure transcript matching for
 * speech-to-text tries (src/voice/stt.ts), so any word — short, long or
 * multi-syllable — is checked the same way and no word is gated out by
 * what an acoustic checker happens to support.
 *
 * A try passes when a transcript (or an alternative) names the word:
 * exactly, squashed together ("straw berry"), or near enough for a small
 * mis-hearing on a longer word ("strawbery"). Short words must be exact:
 * "some" must not pass for "sun".
 */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(' ').filter(Boolean);

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const similarity = (a: string, b: string) =>
  (Math.max(a.length, b.length) - editDistance(a, b)) / Math.max(a.length, b.length);

/** True when any alternative transcript says `target` (one word). */
export function matchTranscript(alternatives: string[], target: string): boolean {
  const want = norm(target).replace(/ /g, '');
  if (!want) return false;
  for (const alt of alternatives) {
    const words = tokens(alt);
    if (words.includes(want) || words.join('') === want) return true;
    if (want.length >= 4 && words.some(w => similarity(w, want) >= 0.8)) return true;
  }
  return false;
}
