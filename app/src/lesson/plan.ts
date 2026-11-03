/**
 * Shared shape of a grown-up-made lesson plan (the "create a lesson" flow).
 * Meta AI writes a plan from the grown-up's words; the grown-up reviews it;
 * only then does the voice route speak its lines. This module is the one
 * contract used by the plan generator (server), the voice route (server),
 * the create screen and the on-device store, so a plan that passes here
 * plays the same way everywhere. No keys or network in here.
 */
import type { Sound } from './content';

export type PlanWord = { word: string; emoji: string; sound: Sound; modelText: string };
export type PlanPick = {
  askLine: string; answerLine: string;
  choices: [{ word: string; emoji: string }, { word: string; emoji: string }]; right: 0 | 1;
};
export type LessonPlan = {
  title: string; subtitle: string; emoji: string; topic: string;
  introLine: string; warmupLine: string; byeLine: string;
  words: PlanWord[]; pick: PlanPick;
};

/**
 * The word's opening sound, for reply tips and colouring only. Made lessons
 * are judged by speech-to-text (voice/stt.ts), which checks any word —
 * short, clustered or multi-syllable — so no word is gated out here.
 */
export function soundForWord(word: string): Sound {
  const w = word.toLowerCase();
  if (w.startsWith('sh')) return 'sh';
  if (w.startsWith('th')) return 'th';
  if (w.startsWith('s')) return 's';
  if (w.startsWith('z')) return 'z';
  return 'custom';
}

const BLOCK = /\b(diagnos\w*|therap\w*|disorder|lisp|treatment|cure|wrong|stupid|dumb)\b/i;
const WORD_RE = /^[a-z][a-z'-]{0,23}$/;
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Every voice line a plan needs, by the clip id the player will use. */
export function clipTexts(plan: LessonPlan): Record<string, string> {
  const out: Record<string, string> = {
    dyn_intro: plan.introLine, dyn_warmup: plan.warmupLine, dyn_bye: plan.byeLine,
    dyn_pick_ask: plan.pick.askLine, dyn_pick_answer: plan.pick.answerLine,
  };
  for (const w of plan.words) out[`dyn_word_${w.word}`] = w.modelText;
  return out;
}

/**
 * Normalises raw model output into a safe plan, or returns null. Sounds are
 * re-derived here (the model does not get the last word on what the checker
 * can hear) and the picture game is built from the words themselves, so it
 * always points at a word Mibo actually teaches.
 */
export function validatePlan(raw: unknown, topic: string): LessonPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = clean(r.title, 60), subtitle = clean(r.subtitle, 80);
  const introLine = clean(r.introLine, 160), warmupLine = clean(r.warmupLine, 160), byeLine = clean(r.byeLine, 160);
  if (!title || !introLine || !warmupLine || !byeLine) return null;
  if ([title, subtitle, introLine, warmupLine, byeLine].some(t => BLOCK.test(t))) return null;
  if (!Array.isArray(r.words)) return null;
  const seen = new Set<string>();
  const words: PlanWord[] = [];
  for (const item of r.words) {
    if (!item || typeof item !== 'object') continue;
    const w = item as Record<string, unknown>;
    const word = clean(w.word, 24).toLowerCase();
    if (!WORD_RE.test(word) || seen.has(word)) continue;
    const modelText = clean(w.modelText, 120);
    if (!modelText || !modelText.toLowerCase().includes(word) || BLOCK.test(modelText)) continue;
    seen.add(word);
    words.push({ word, emoji: clean(w.emoji, 8) || '⭐', sound: soundForWord(word), modelText });
    if (words.length === 6) break;
  }
  if (words.length < 4) return null;
  const [a, b] = words;
  const right: 0 | 1 = a.word.length % 2 === 0 ? 0 : 1;
  const choices = (right === 0 ? [a, b] : [b, a]).map(w => ({ word: w.word, emoji: w.emoji })) as PlanPick['choices'];
  const pick: PlanPick = {
    askLine: `Which one is ${a.word}? ${cap(a.word)}... or ${b.word}?`,
    answerLine: `${cap(a.word)}! Great listening!`,
    choices, right,
  };
  return {
    title, subtitle: subtitle || topic, emoji: clean(r.emoji, 8) || '✨', topic,
    introLine, warmupLine, byeLine, words, pick,
  };
}

export const TOPIC_MAX = 80;
export const validTopic = (t: string) => { const s = t.trim(); return s.length >= 2 && s.length <= TOPIC_MAX; };
