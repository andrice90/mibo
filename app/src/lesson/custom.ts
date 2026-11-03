/**
 * Grown-up-made lessons, kept on this phone only (PROJECT #17): the plan the
 * grown-up accepted plus Mibo's voice lines for it, saved as files. That is
 * what makes a new lesson playable with no app rebuild — the lesson player
 * reads these steps and clips exactly like a bundled lesson's.
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Clip } from '../voice/player';
import type { Step } from './content';
import { soundForWord, type LessonPlan } from './plan';
import type { SavedClip } from './progress';

export type CustomLesson = {
  id: string; createdAt: number; plan: LessonPlan;
  clips: Record<string, SavedClip>;
};

const KEY = 'mibo-custom-lessons-v1';

function read(): CustomLesson[] {
  try {
    if (Platform.OS === 'web') return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
    const f = new File(Paths.document, `${KEY}.json`);
    return f.exists ? JSON.parse(f.textSync()) : [];
  } catch { return []; }
}

function write(list: CustomLesson[]) {
  try {
    const json = JSON.stringify(list);
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(KEY, json); return; }
    const f = new File(Paths.document, `${KEY}.json`);
    f.create({ overwrite: true });
    f.writeSync(json);
  } catch { /* a convenience store; create screen reports save failure via playback check */ }
}

export const listCustomLessons = (): CustomLesson[] =>
  read().filter(l => l?.plan && l.clips).sort((a, b) => b.createdAt - a.createdAt);

export const getCustomLesson = (id: string): CustomLesson | null =>
  listCustomLessons().find(l => l.id === id) ?? null;

export function saveCustomLesson(lesson: CustomLesson) {
  write([lesson, ...read().filter(l => l.id !== lesson.id)]);
}

export function deleteCustomLesson(id: string) {
  const hit = read().find(l => l.id === id);
  if (hit && Platform.OS !== 'web') {
    for (const c of Object.values(hit.clips)) { try { new File(c.uri).delete(); } catch { /* gone */ } }
  }
  write(read().filter(l => l.id !== id));
}

export const newLessonId = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/** The steps the lesson player runs for a made lesson. */
export function buildSteps(plan: LessonPlan): Step[] {
  const steps: Step[] = [
    { kind: 'line', clip: 'dyn_intro', mood: 'happy', act: 'wave' },
    { kind: 'line', clip: 'dyn_warmup', mood: 'silly' },
  ];
  for (const w of plan.words) {
    steps.push({
      kind: 'try',
      // re-derived at play time, so lessons saved before a checker fix still get it
      ex: { sound: soundForWord(w.word), target: w.word, model: `dyn_word_${w.word}`, prompt: 'sayIt', emoji: w.emoji, kind: 'word', check: 'stt' },
    });
  }
  steps.push({
    kind: 'pick',
    pick: {
      sound: plan.words[0] ? soundForWord(plan.words[0].word) : 'custom', ask: 'dyn_pick_ask', answer: 'dyn_pick_answer',
      choices: plan.pick.choices, right: plan.pick.right,
    },
  });
  steps.push({ kind: 'end', clip: 'dyn_bye' });
  return steps;
}

/** Saved voice files as playable clips, keyed by the step clip ids. */
export function dynClips(lesson: CustomLesson): Record<string, Clip> {
  return Object.fromEntries(Object.entries(lesson.clips).map(([id, c]) =>
    [id, { source: { uri: c.uri }, text: c.text, visemes: c.visemes, seconds: c.seconds }]));
}
