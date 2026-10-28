/**
 * POST /api/reply: Mibo's live line after a try (PROJECT #45).
 * In:  { sound, target, mark, attempt, willRetry }  (lesson state only)
 * Out: { say, mood, source, parts?: [{ text, audio, visemes, seconds }] }
 * The line is spoken sentence by sentence, all synthesised at once: Gemini
 * TTS is not streamed, so shorter pieces arrive sooner (docs/06 §5.2).
 * When the line is a fallback, or TTS fails, there are no parts and the app
 * plays the bundled clip for that fallback.
 */
import { MAX_ATTEMPTS, TARGETS } from '@/lesson/content';
import { writeReply, type Turn } from '@/server/reply';
import { speak, speechVisemes, toBase64 } from '@/server/tts';

/** Sentences, with very short ones ("Wow!") joined to the next so each piece sounds natural. */
function pieces(say: string): string[] {
  const out: string[] = [];
  for (const s of say.match(/[^.!?]+[.!?]*/g) ?? [say]) {
    const t = s.trim();
    if (!t) continue;
    const prev = out[out.length - 1];
    if (prev && prev.split(' ').length < 3) out[out.length - 1] = `${prev} ${t}`;
    else out.push(t);
  }
  return out;
}

export async function POST(req: Request) {
  let t: Turn;
  try {
    const b = await req.json();
    t = { sound: b.sound, target: b.target, mark: b.mark, attempt: Number(b.attempt), willRetry: !!b.willRetry };
    if (!['s', 'th'].includes(t.sound) || !TARGETS.has(t.target) || !['got', 'tricky'].includes(t.mark)
      || !(t.attempt >= 1 && t.attempt <= MAX_ATTEMPTS)) throw new Error('bad turn');
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }

  const t0 = Date.now();
  const reply = await writeReply(t);
  if (reply.source === 'fallback') return Response.json(reply);
  const t1 = Date.now();
  try {
    const parts = await Promise.all(pieces(reply.say).map(async text => {
      const s = await speak(text);
      return { text, audio: toBase64(s.wav), visemes: speechVisemes(s, text), seconds: s.seconds };
    }));
    console.log(`[reply] llm ${t1 - t0}ms tts ${Date.now() - t1}ms x${parts.length} "${reply.say}"`);
    return Response.json({ ...reply, parts });
  } catch (e) {
    console.warn('[reply] tts failed:', (e as Error).message);
    return Response.json({ ...reply, source: 'fallback' });
  }
}
