import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, type AudioSource } from 'expo-audio';
import { File, Paths, type Directory } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Puppet, Segment } from '../puppet/mibo';
import type { Viseme } from './analyze';

export type Clip = { source: AudioSource; text: string; visemes: Viseme[]; seconds: number };

let player: ReturnType<typeof createAudioPlayer> | null = null;
let ready: Promise<unknown> | null = null;
let recording = false;

/**
 * The one place the app sets the audio session. On iOS every call replaces
 * the whole mode (options left out go back to their defaults), so the
 * player and the microphone must always ask for the same thing: setting
 * "silent mode" alone after the mic was enabled switched recording off and
 * the first try was never heard.
 */
export function audioMode(allowsRecording = recording): Promise<unknown> {
  recording = allowsRecording;
  ready = setAudioModeAsync({ playsInSilentMode: true, allowsRecording }).catch(() => {});
  return ready;
}

function get() {
  if (!player) {
    if (!ready) audioMode();
    player = createAudioPlayer(null, { updateInterval: 50 });
  }
  return player;
}

/**
 * Downloads bundled clips to the device before the lesson. In Expo Go a
 * bundled sound is otherwise streamed from the dev server the first time it
 * plays, and the iOS player can sit buffering for seconds between lines.
 * Returns local file URIs keyed like the input.
 */
export async function preload(modules: Record<string, number>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(Object.entries(modules).map(async ([id, m]) => {
    const a = Asset.fromModule(m);
    await a.downloadAsync();
    out[id] = a.localUri ?? a.uri;
  }));
  return out;
}

/**
 * Plays one clip and has Mibo speak it: the mouth reads the clip's track
 * against the player's own position, so it stays in sync even if playback
 * starts late. Resolves as soon as the audio reaches its end: the finished
 * event, the play position or, as a last resort, a timer.
 */
export async function playClip(puppet: Puppet, clip: Clip, extra: Partial<Segment> = {}): Promise<void> {
  const p = get();
  await ready;
  p.replace(clip.source);
  return new Promise(resolve => {
    let done = false, started = false;
    const t0 = Date.now();
    const finish = () => {
      if (done) return;
      done = true;
      sub.remove(); clearInterval(poll); clearTimeout(timer);
      resolve();
    };
    const sub = p.addListener('playbackStatusUpdate', s => { if (s.didJustFinish) finish(); });
    let retried = false;
    const poll = setInterval(() => {
      const t = p.currentTime, waited = Date.now() - t0;
      if (t > 0.05) started = true;
      if (started && (t >= clip.seconds - 0.04 || (!p.playing && waited > 300))) finish();
      // never sit mouthing a line in silence: retry once, then move on
      if (!started && waited > 1500 && !retried) {
        // usually the audio session was left record-only: put our mode back, then try once more
        retried = true;
        audioMode().then(() => { if (!done) { p.replace(clip.source); p.play(); } });
      }
      if (!started && waited > 3500) { console.warn('[audio] clip never started:', clip.text); finish(); }
    }, 50);
    const timer = setTimeout(finish, (clip.seconds + 4) * 1000);
    puppet.play([{ say: clip.text, visemes: clip.visemes, clock: () => p.currentTime, ...extra }]);
    p.play();
  });
}

export function stopAudio() {
  player?.pause();
}

let n = 0;
const written: File[] = [];
/**
 * A live line from the server arrives as base64 WAV; players want a file.
 * The write is synchronous so the file is complete before any player opens
 * it (an unawaited async write left Mibo mouthing a line in silence), and
 * every file gets a new name so iOS never replays a cached older one.
 */
export function wavFile(base64: string, keep?: string, dir?: Directory): AudioSource {
  if (Platform.OS === 'web') return { uri: `data:audio/wav;base64,${base64}` };
  // `keep`: a clip the app reuses (the child's name lines), outside the rotation below
  const f = new File(dir ?? Paths.cache, keep ? `mibo-keep-${keep}-${Date.now()}.wav` : `mibo-live-${Date.now()}-${n++}.wav`);
  f.create({ overwrite: true });
  f.writeSync(base64, { encoding: 'base64' });
  if (keep) return { uri: f.uri };
  written.push(f);
  // both prefetched replies, a few sentences each, can be alive at once; keep the last 24
  while (written.length > 24) { try { written.shift()!.delete(); } catch { /* already gone */ } }
  return { uri: f.uri };
}
