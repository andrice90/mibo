/**
 * Server-only: Mibo's voice, Gemini 3.8 Flash TTS with Leda via OpenRouter
 * (PROJECT #37). Runs in API routes and in scripts/make-clips.ts. The key
 * comes from OPENROUTER_API_KEY and never reaches the app bundle.
 */
import { analyze, pcm16ToFloat, pcmToWav, trimEdges, type Frame, type Viseme } from '../voice/analyze';
import { mouthTrack } from '../voice/lipsync';

const API = 'https://openrouter.ai/api/v1';
export const TTS_MODEL = 'google/gemini-3.8-flash-tts';
export const VOICE = 'Leda';
export const SAMPLE_RATE = 24000;

// Same delivery note as tools/tts_eval.py, so the app sounds like the bake-off.
export const MIBO_STYLE =
  'You are Mibo, a warm, playful cartoon teacher for 4 to 7 year olds. ' +
  'Speak clearly, a little slowly, smiling. When the text shows a ' +
  "stretched sound such as 'Sssss' or 'Thhhh', make that actual mouth " +
  'sound and hold it for about two seconds. Never say the letter name.';


function key() {
  const k = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_LLM_API_KEY;
  if (!k) throw new Error('OPENROUTER_API_KEY is not set');
  return k;
}

export type Speech = { wav: Uint8Array; samples: Float32Array; frames: Frame[]; seconds: number; ttfb: number };

/**
 * Synthesise one line in Leda's voice. Returns WAV bytes plus per-frame
 * analysis. `trim` cuts the dead air at both ends (off for model-clip takes,
 * which are trimmed to the hiss instead). `note` adds a delivery direction
 * for this line only.
 */
export async function speak(text: string, trim = true, note = ''): Promise<Speech> {
  const t0 = Date.now();
  const r = await fetch(`${API}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: TTS_MODEL, input: text, voice: VOICE, instructions: note ? `${MIBO_STYLE} ${note}` : MIBO_STYLE, response_format: 'pcm' }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const ttfb = (Date.now() - t0) / 1000;
  let pcm: Uint8Array = new Uint8Array(await r.arrayBuffer());
  if (pcm[0] === 0x52 && pcm[1] === 0x49 && pcm[2] === 0x46 && pcm[3] === 0x46) pcm = pcm.subarray(44);  // already WAV
  pcm = pcm.subarray(0, pcm.length - (pcm.length % 2));
  if (trim) pcm = trimEdges(pcm, SAMPLE_RATE);
  const samples = pcm16ToFloat(pcm);
  const frames = analyze(samples, SAMPLE_RATE);
  return { wav: pcmToWav(pcm, SAMPLE_RATE), samples, frames, seconds: pcm.length / 2 / SAMPLE_RATE, ttfb };
}

export function speechVisemes(s: Speech, text: string): Viseme[] {
  return mouthTrack(text, s.samples, SAMPLE_RATE);
}

/** Plain base64, so the route runs on any server runtime (Node or a Worker). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
