/**
 * Mibo's mouth track for a line of his own speech. Uses the forced aligner
 * trained on Leda's voice (src/voice/phone-model.json, from
 * scripts/train-aligner.ts); without a trained model, or when alignment
 * fails, falls back to the coarse text-and-audio warp in ./align.
 */
import { alignVisemes } from './align';
import { lipSync, type PhoneModel } from './aligner';
import { analyze, type Viseme } from './analyze';
import trained from './phone-model.json';

const MODEL = trained as PhoneModel;

export function mouthTrack(text: string, samples: Float32Array, sr: number, model: PhoneModel = MODEL): Viseme[] {
  if (Object.keys(model.phones).length) {
    const v = lipSync(text, samples, sr, model);
    if (v) return v;
  }
  return alignVisemes(text, analyze(samples, sr));
}
