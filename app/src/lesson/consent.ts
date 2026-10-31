/**
 * The grown-up's consent, given once on this phone (first app start):
 * the supervision checklist, "I'm a grown-up" tick, and whether Mibo may
 * listen. Kept on this phone only (PROJECT #17), like progress. After
 * this, lessons start without asking again.
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export type Consent = { at: number; hear: boolean };

const KEY = 'mibo-consent-v1';

export function loadConsent(): Consent | null {
  try {
    if (Platform.OS === 'web') return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null');
    const f = new File(Paths.document, `${KEY}.json`);
    return f.exists ? JSON.parse(f.textSync()) : null;
  } catch {
    return null;
  }
}

export const hasConsent = () => loadConsent() !== null;

export function saveConsent(hear: boolean) {
  try {
    const json = JSON.stringify({ at: Date.now(), hear });
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(KEY, json); return; }
    const f = new File(Paths.document, `${KEY}.json`);
    f.create({ overwrite: true });
    f.writeSync(json);
  } catch { /* if it cannot be kept, the app simply asks again next start */ }
}
