/**
 * Text -> phonemes for lip sync, from the CMU Pronouncing Dictionary
 * (ARPAbet, US English), with letter rules for words it lacks.
 * Server and scripts only: the dictionary is 4 MB and never ships in the app.
 */
import { dictionary } from 'cmu-pronouncing-dictionary';

export type Phone = { p: string; i: number; held?: boolean };  // i: character position for captions
export type Word = { phones: Phone[]; i: number; pauseAfter: 0 | 1 | 2 };  // 1 = comma, 2 = sentence end

// Teaching sounds written stretched: "Sssss", "Thhhh", "Shhhh", "Mmmm".
const STRETCH: [RegExp, string][] = [
  [/^s{3,}$/, 'S'], [/^z{3,}$/, 'Z'], [/^sh{3,}$/, 'SH'], [/^th{3,}$/, 'TH'], [/^f{3,}$/, 'F'], [/^m{3,}$/, 'M'],
];

// Words the dictionary lacks or says differently from Mibo.
const LEXICON: Record<string, string> = {
  mibo: 'M IY B OW', ssss: 'S', ooh: 'UW', hmm: 'HH M',
};

const LETTERS: [string, string[]][] = [
  ['sh', ['SH']], ['ch', ['CH']], ['th', ['TH']], ['ng', ['NG']], ['ph', ['F']], ['ck', ['K']], ['ee', ['IY']],
  ['ea', ['IY']], ['oo', ['UW']], ['oa', ['OW']], ['ai', ['EY']], ['ay', ['EY']], ['ou', ['AW']], ['ow', ['OW']],
  ['a', ['AE']], ['e', ['EH']], ['i', ['IH']], ['o', ['AA']], ['u', ['AH']], ['y', ['IY']], ['b', ['B']],
  ['c', ['K']], ['d', ['D']], ['f', ['F']], ['g', ['G']], ['h', ['HH']], ['j', ['JH']], ['k', ['K']], ['l', ['L']],
  ['m', ['M']], ['n', ['N']], ['p', ['P']], ['q', ['K']], ['r', ['R']], ['s', ['S']], ['t', ['T']], ['v', ['V']],
  ['w', ['W']], ['x', ['K', 'S']], ['z', ['Z']],
];

function byLetters(w: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < w.length;) {
    if (w[i] === w[i - 1] && !'aeiou'.includes(w[i])) { i++; continue; }  // doubled consonant
    if (w[i] === 'e' && i === w.length - 1 && i > 1) { i++; continue; }      // silent final e
    const hit = LETTERS.find(([g]) => w.startsWith(g, i));
    if (!hit) { i++; continue; }
    out.push(...hit[1]);
    i += hit[0].length;
  }
  return out;
}

export function textToWords(text: string): Word[] {
  const words: Word[] = [];
  const re = /[A-Za-z']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0].toLowerCase().replace(/^'+|'+$/g, '');
    const at = m.index;
    if (!raw) continue;
    const stretch = STRETCH.find(([r]) => r.test(raw));
    let phones: Phone[];
    if (stretch) phones = [{ p: stretch[1], i: at, held: true }];
    else {
      const pron = LEXICON[raw] ?? dictionary[raw] ?? dictionary[raw.replace(/'/g, '')];
      const list = pron ? pron.split(' ').map(p => p.replace(/\d/g, '')) : byLetters(raw);
      phones = list.map((p, k) => ({ p, i: at + Math.min(raw.length - 1, Math.floor(k * raw.length / list.length)) }));
    }
    // what follows the word: a comma-like or sentence-ending pause?
    const tail = text.slice(at + m[0].length, re.lastIndex + 8).match(/^[^A-Za-z']*/)?.[0] ?? '';
    const pauseAfter = /[.!?…]|\.\.\./.test(tail) ? 2 : /[,;:]/.test(tail) ? 1 : 0;
    if (phones.length) words.push({ phones, i: at, pauseAfter });
  }
  return words;
}

/**
 * ARPAbet -> Mibo's mouth shapes. Diphthongs glide between two shapes; the
 * first gets most of the time. HH takes the shape of the vowel after it.
 */
export const PHONE_VISEMES: Record<string, [string, number][]> = {
  AA: [['ah', 1]], AE: [['ah', 1]], AH: [['uh', 1]], AO: [['oh', 1]], AW: [['ah', 0.6], ['oo', 0.4]],
  AY: [['ah', 0.6], ['ee', 0.4]], EH: [['eh', 1]], ER: [['rr', 1]], EY: [['eh', 0.6], ['ee', 0.4]], IH: [['ih', 1]],
  IY: [['ee', 1]], OW: [['oh', 0.7], ['w', 0.3]], OY: [['oh', 0.6], ['ee', 0.4]], UH: [['oo', 1]], UW: [['oo', 1]],
  B: [['mbp', 1]], P: [['mbp', 1]], M: [['mbp', 1]], F: [['f', 1]], V: [['f', 1]], TH: [['th', 1]], DH: [['th', 1]],
  S: [['s', 1]], Z: [['s', 1]], SH: [['sh', 1]], ZH: [['sh', 1]], CH: [['sh', 1]], JH: [['sh', 1]],
  T: [['dt', 1]], D: [['dt', 1]], N: [['n', 1]], NG: [['kg', 1]], K: [['kg', 1]], G: [['kg', 1]],
  L: [['l', 1]], R: [['rr', 1]], W: [['w', 1]], Y: [['ee', 1]], HH: [],
};

export const VOWELS = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);
