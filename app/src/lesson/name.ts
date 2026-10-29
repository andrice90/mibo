/**
 * The child's optional first name and Mibo's four lines that use it
 * (PROJECT #49). The name goes to the voice service once, to make these
 * clips, and never to the reply LLM. The clips are saved on this phone
 * with the lesson's progress, so resuming does not send the name again.
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { wavFile, type Clip } from '../voice/player';
import { NAME_RE } from './name-rule';
import type { SavedClip } from './progress';

export type NameLine = 'hi' | 'got' | 'tricky' | 'bye';
type Lines = Record<NameLine, SavedClip>;
let current: { name: string; lines: Lines } | null = null;

// ---- names learned before, kept on this phone so they never have to be sent again

type Saved = { name: string; lines: Lines; at: number };
const KEY = 'mibo-names-v1';

function readSaved(): Saved[] {
  try {
    if (Platform.OS === 'web') return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
    const f = new File(Paths.document, `${KEY}.json`);
    return f.exists ? JSON.parse(f.textSync()) : [];
  } catch {
    return [];
  }
}

function writeSaved(list: Saved[]) {
  try {
    const json = JSON.stringify(list);
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(KEY, json); return; }
    const f = new File(Paths.document, `${KEY}.json`);
    f.create({ overwrite: true });
    f.writeSync(json);
  } catch { /* a convenience only */ }
}

const filesExist = (lines: Lines) => Platform.OS === 'web' || Object.values(lines).every(l => new File(l.uri).exists);

/** Names learned on this phone whose clips are still there, most recent first. */
export function learnedNames(): string[] {
  return readSaved().filter(x => filesExist(x.lines)).sort((a, b) => b.at - a.at).map(x => x.name);
}

/** Use a learned name for this lesson: no network, its clips are already here. */
export function pickLearnedName(name: string): boolean {
  const hit = readSaved().find(x => x.name === name);
  if (!hit || !filesExist(hit.lines)) return false;
  current = { name: hit.name, lines: hit.lines };
  writeSaved(readSaved().map(x => (x.name === name ? { ...x, at: Date.now() } : x)));
  return true;
}

/** Forget a learned name and delete its clips from the phone. */
export function forgetLearnedName(name: string) {
  const list = readSaved();
  const hit = list.find(x => x.name === name);
  if (hit && Platform.OS !== 'web') for (const l of Object.values(hit.lines)) { try { new File(l.uri).delete(); } catch { /* gone */ } }
  writeSaved(list.filter(x => x.name !== name));
  if (current?.name === name) current = null;
}

export const validName = (s: string) => NAME_RE.test(s.trim().replace(/\s+/g, ' '));
export const childName = () => current?.name ?? null;
export const savedName = () => current;
export const forgetName = () => { current = null; };

export function nameClip(k: NameLine): Clip | null {
  const c = current?.lines[k];
  return c ? { source: { uri: c.uri }, text: c.text, visemes: c.visemes, seconds: c.seconds } : null;
}

/** Brings back a saved name if its clips are still on the phone. */
export function restoreName(name?: string, lines?: Lines): boolean {
  if (!name || !lines) { current = null; return false; }
  const ok = Platform.OS === 'web' || Object.values(lines).every(l => new File(l.uri).exists);
  current = ok ? { name, lines } : null;
  return ok;
}

/** Asks the server for the four name lines. Resolves false if anything fails: the lesson just stays generic. */
export async function makeNameLines(raw: string): Promise<boolean> {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!validName(name)) return false;
  try {
    const r = await fetch('/api/name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!r.ok) return false;
    const b = await r.json() as Record<NameLine, { text: string; audio: string; visemes: SavedClip['visemes']; seconds: number }>;
    const lines = {} as Lines;
    for (const k of ['hi', 'got', 'tricky', 'bye'] as const) {
      const src = wavFile(b[k].audio, `name-${k}`, Platform.OS === 'web' ? undefined : Paths.document) as { uri: string };
      lines[k] = { uri: src.uri, text: b[k].text, visemes: b[k].visemes, seconds: b[k].seconds };
    }
    current = { name, lines };
    writeSaved([...readSaved().filter(x => x.name !== name), { name, lines, at: Date.now() }]);
    return true;
  } catch {
    return false;
  }
}
