import { preload, type Clip } from '../voice/player';
import { CLIP_AUDIO, CLIPS } from './clips.generated';

// Local copies of the bundled clips: in Expo Go each one is otherwise
// streamed from the dev server the first time it plays.
let local: Record<string, string> = {};
let all: Promise<void> | null = null;

export const bundled = (id: string): Clip =>
  ({ source: local[id] ? { uri: local[id] } : CLIP_AUDIO[id], ...CLIPS[id] });

/** Download some clips (or, with no ids, every clip once) to the device. */
export async function preloadClips(ids?: string[]): Promise<void> {
  if (!ids) {
    all ??= preload(CLIP_AUDIO).then(l => { local = { ...local, ...l }; }, () => { all = null; });
    return all;
  }
  const want = Object.fromEntries(ids.filter(id => !local[id]).map(id => [id, CLIP_AUDIO[id]]));
  local = { ...local, ...(await preload(want).catch(() => ({}))) };
}
