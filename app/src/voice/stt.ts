/**
 * Speech-to-text for one try: the recogniser's words, never the audio
 * (PROJECT #10, #45). Made lessons judge tries this way, so any word —
 * including long multi-syllable ones — can be practised and checked.
 *
 * Uses expo-speech-recognition: on iOS it wraps SFSpeechRecognizer with
 * on-device recognition where the device supports it (audio stays on the
 * phone); on web it wraps the Web Speech API. It needs a dev build on
 * iOS — in Expo Go the native module is absent, and the package throws
 * the moment it is imported, so it is loaded lazily inside a try/catch:
 * `startStt` returns null there and the caller falls back to its other
 * check instead of blocking or crashing.
 */
type SttModule = typeof import('expo-speech-recognition');

let cached: SttModule | null | undefined;
function loadModule(): SttModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: a static import throws where the native module is absent (Expo Go)
      cached = require('expo-speech-recognition') as SttModule;
    } catch {
      cached = null;   // Expo Go: "Cannot find native module 'ExpoSpeechRecognition'"
    }
  }
  return cached;
}

export type SttSession = {
  start: () => void;
  /** Resolves with transcript alternatives, or null when nothing was heard. */
  done: Promise<string[] | null>;
  stop: () => void;
};

type Sub = { remove: () => void };

/** Whether a recogniser can run in this build at all. */
export function sttAvailable(): boolean {
  const mod = loadModule();
  if (!mod) return false;
  try {
    return mod.ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

let permission: Promise<boolean> | null = null;
function askPermission(mod: SttModule): Promise<boolean> {
  permission ??= mod.ExpoSpeechRecognitionModule.requestPermissionsAsync()
    .then(p => p.granted)
    .catch(() => false);
  return permission;
}

/**
 * A recognition session for `target` (used only to bias the recogniser,
 * via contextualStrings). Call `start()` when Mibo stops talking.
 */
export function startStt(target: string): SttSession | null {
  const mod = loadModule();
  if (!mod || !sttAvailable()) return null;
  const Module = mod.ExpoSpeechRecognitionModule;
  let resolve: (v: string[] | null) => void = () => {};
  const done = new Promise<string[] | null>(res => { resolve = res; });
  let subs: Sub[] = [], heard: string[] = [], settled = false, timer: ReturnType<typeof setTimeout> | undefined;

  const settle = (v: string[] | null) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    subs.forEach(s => { try { s.remove(); } catch { /* already gone */ } });
    subs = [];
    resolve(v && v.length ? v : null);
  };

  return {
    done,
    start: () => {
      if (settled || subs.length) return;
      try {
        subs = [
          Module.addListener('result', e => {
            if (e.isFinal) heard = (e.results ?? []).map(r => r.transcript).filter(Boolean);
            if (e.isFinal && heard.length) settle(heard);
          }),
          Module.addListener('error', () => settle(heard.length ? heard : null)),
          Module.addListener('end', () => settle(heard.length ? heard : null)),
        ];
      } catch { settle(null); return; }
      timer = setTimeout(() => { try { Module.stop(); } catch { /* ignore */ } settle(heard.length ? heard : null); }, 9000);
      void askPermission(mod).then(granted => {
        if (settled) return;
        if (!granted) { settle(null); return; }
        try {
          let onDevice = false;
          try { onDevice = Module.supportsOnDeviceRecognition(); } catch { /* web */ }
          Module.start({
            lang: 'en-US', interimResults: false, maxAlternatives: 3, addsPunctuation: false,
            contextualStrings: [target], continuous: false,
            ...(onDevice ? { requiresOnDeviceRecognition: true } : {}),
          });
        } catch { settle(null); }
      });
    },
    stop: () => {
      try { Module.abort(); } catch { /* ignore */ }
      settle(null);
    },
  };
}
