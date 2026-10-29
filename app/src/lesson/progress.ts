/**
 * Where each lesson was left off, kept on this phone only (PROJECT #17):
 * the step, the stars, and the optional first name with Mibo's name clips
 * (saved files, so resuming never sends the name anywhere again).
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Viseme } from '../voice/analyze';

export type SavedClip = { uri: string; text: string; visemes: Viseme[]; seconds: number };
export type Progress = {
  step: number; stars: number; at: number;
  name?: string; nameLines?: Record<'hi' | 'got' | 'tricky' | 'bye', SavedClip>;
};
type Store = Record<string, Progress>;

const KEY = 'mibo-progress-v1';

function read(): Store {
  try {
    if (Platform.OS === 'web') return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}');
    const f = new File(Paths.document, `${KEY}.json`);
    return f.exists ? JSON.parse(f.textSync()) : {};
  } catch {
    return {};
  }
}

function write(s: Store) {
  try {
    const json = JSON.stringify(s);
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(KEY, json); return; }
    const f = new File(Paths.document, `${KEY}.json`);
    f.create({ overwrite: true });
    f.writeSync(json);
  } catch { /* progress is a convenience; never break the lesson over it */ }
}

export const loadProgress = (lesson: string): Progress | null => read()[lesson] ?? null;

export function saveProgress(lesson: string, p: Partial<Progress>) {
  const s = read();
  s[lesson] = { ...{ step: 0, stars: 0 }, ...s[lesson], ...p, at: Date.now() } as Progress;
  write(s);
}

/** Clears a lesson's place (finished, or started over), keeping nothing about the child. */
export function clearProgress(lesson: string) {
  const s = read();
  delete s[lesson];
  write(s);
}
