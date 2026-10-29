/**
 * Listens for one try on the device's microphone (PROJECT #10, #48).
 *
 * Uses expo-audio's recorder, which keeps the audio session in
 * play-and-record, so Mibo can talk straight after. (The live PCM stream
 * we used first switched iOS to record-only on every start, which silenced
 * Mibo and left the first try of a lesson unheard.) The try is written to a
 * temporary WAV in the app's cache, read back into memory for judge(), and
 * deleted at once: nothing is kept and nothing leaves the phone.
 *
 * Recording starts while Mibo is still saying "your turn" (so a child who
 * jumps in is caught), but nothing before `arm()` counts: that is Mibo's own
 * voice. After it, the level meter waits for the child to speak and then
 * for a real pause, so several goes ("seal... seal!") land in one window
 * for judgeTry() to look through.
 */
import { AudioModule, AudioQuality, IOSOutputFormat, requestRecordingPermissionsAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { audioMode } from './player';

export type Heard = { samples: Float32Array; sr: number; speech: boolean };
/** `arm()`: Mibo has finished talking; only what comes after counts. */
export type Listening = { done: Promise<Heard>; stop: () => void; arm: () => void };

type Recorder = {
  prepareToRecordAsync(): Promise<void>; record(): void; stop(): Promise<void>;
  getStatus(): { metering?: number; isRecording: boolean }; uri: string | null; release?: () => void;
};
type RecorderCtor = new (o: object) => Recorder;

// 16-bit mono PCM in a WAV container, flattened the way expo-audio's own
// createRecordingOptions does for iOS.
const OPTIONS = {
  extension: '.wav', sampleRate: 44100, numberOfChannels: 1, bitRate: 705600, isMeteringEnabled: true,
  outputFormat: IOSOutputFormat.LINEARPCM, audioQuality: AudioQuality.MAX,
  linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false,
};

const Ctor = () => (AudioModule as unknown as { AudioRecorder?: RecorderCtor }).AudioRecorder;

/** Whether this build can listen (iOS for now; web cannot). */
export function canListen(): boolean {
  return Platform.OS === 'ios' && typeof Ctor() === 'function';
}

let micReady: Promise<boolean> | null = null;
/** Asks for the microphone once and switches the audio session to play-and-record. */
export function enableMic(): Promise<boolean> {
  micReady ??= (async () => {
    if (!canListen()) return false;
    const p = await requestRecordingPermissionsAsync();
    if (!p.granted) return false;
    await audioMode(true);
    return true;
  })().catch(() => false);
  return micReady;
}

/** 16-bit PCM WAV bytes -> mono float samples (skips any extra chunks iOS adds). */
function readWav(bytes: Uint8Array): { samples: Float32Array; sr: number } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sr = 44100, channels = 1, at = 12;
  while (at + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
    const size = dv.getUint32(at + 4, true);
    if (id === 'fmt ') { channels = dv.getUint16(at + 10, true); sr = dv.getUint32(at + 12, true); }
    if (id === 'data') {
      const n = Math.floor(Math.min(size, bytes.length - at - 8) / 2 / channels);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = dv.getInt16(at + 8 + i * 2 * channels, true) / 32768;
      return { samples: out, sr };
    }
    at += 8 + size + (size % 2);
  }
  return { samples: new Float32Array(0), sr };
}

/**
 * Starts recording now. Pass `armed: false` when Mibo is still talking and
 * call `arm()` when he stops. `onLevel` gets 0..1 about 20 times a second.
 * Ends after `pause` seconds of quiet once the child has spoken, after
 * `maxTry` seconds of trying, or after `maxWait` seconds with no speech.
 */
export function listen(opts: {
  onLevel?: (v: number) => void; armed?: boolean; maxWait?: number; maxTry?: number; pause?: number;
} = {}): Listening {
  const { onLevel, maxWait = 6, maxTry = 8, pause = 1.2 } = opts;
  const rec = new (Ctor()!)(OPTIONS);
  let t0 = Date.now(), armedAt = -1, floor = -55, startAt = -1, quietSince = -1, stopped = false, recording = false;
  let wantArm = opts.armed !== false;
  let finish: (h: Heard) => void = () => {};
  const done = new Promise<Heard>(res => { finish = res; });
  const now = () => (Date.now() - t0) / 1000;

  const end = async (speech: boolean) => {
    if (stopped) return;
    stopped = true;
    clearInterval(poll);
    let heard: Heard = { samples: new Float32Array(0), sr: 44100, speech: false };
    try {
      if (recording) await rec.stop();
      const uri = rec.uri;
      if (uri) {
        const f = new File(uri);
        if (speech && f.exists) {
          const { samples, sr } = readWav(await f.bytes());
          // everything after Mibo stopped talking (a little before, for a child who jumped in)
          heard = { samples: samples.subarray(Math.max(0, Math.round((armedAt - 0.1) * sr))), sr, speech: true };
        }
        try { f.delete(); } catch { /* already gone */ }   // the recording never outlives the check
      }
    } catch { /* treat as nothing heard */ }
    try { rec.release?.(); } catch { /* fine */ }
    audioMode(true);   // leave the session in play-and-record for Mibo
    finish(heard);
  };

  const poll = setInterval(() => {
    if (stopped || !recording) return;
    const t = now();
    if (armedAt < 0) { if (wantArm) armedAt = t; else return; }   // Mibo is still talking
    const level = rec.getStatus().metering ?? -160;
    if (level < floor) floor = 0.9 * floor + 0.1 * level;   // settles on the room once Mibo's voice is gone
    else floor = Math.min(floor + 0.02, -35);              // and drifts up slowly if the room gets louder
    const speaking = level > Math.max(floor + 14, -50);
    if (speaking) { if (startAt < 0) startAt = t; quietSince = -1; } else if (startAt >= 0 && quietSince < 0) quietSince = t;
    onLevel?.(Math.max(0, Math.min(1, (level - floor) / 35)));
    if (startAt >= 0 && ((quietSince >= 0 && t - quietSince > pause) || t - armedAt > maxTry)) end(true);
    else if (startAt < 0 && t - armedAt > maxWait) end(false);
  }, 50);

  (async () => {
    try {
      await rec.prepareToRecordAsync();
      if (stopped) return;
      rec.record();
      t0 = Date.now();   // times are measured from the moment recording starts, matching the file
      recording = true;
    } catch {
      end(false);
    }
  })();

  return { done, stop: () => { end(startAt >= 0); }, arm: () => { wantArm = true; } };
}
