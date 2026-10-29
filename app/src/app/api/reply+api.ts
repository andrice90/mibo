/**
 * POST /api/reply: Mibo's live line after a try (PROJECT #45).
 * In:  { sound, target, mark, attempt, willRetry, heard?, avoid? }  (lesson state only;
 *      heard is the on-device check's label, avoid is Mibo's own last lines)
 * Out: { say, mood, source, parts?: [{ text, audio, visemes, seconds }] }
 * The line is spoken sentence by sentence, all synthesised at once: Gemini
 * TTS is not streamed, so shorter pieces arrive sooner (docs/06 §5.2).
 * When the line is a fallback, or TTS fails, there are no parts and the app
 * plays the bundled clip for that fallback.
 */
import { MAX_ATTEMPTS, TARGETS } from '@/lesson/content';
import { fallbackReply, writeReply, type Turn } from '@/server/reply';
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

// Spend guard: each call costs an LLM line plus TTS. A lesson makes ~2 calls
// per try (both replies are prefetched), so these limits never touch a real
// lesson but stop a loop or a stranger on the network from burning credit.
// In-memory, so per server process; a public deploy also needs an app token.
const PER_CALLER = { max: 60, windowMs: 10 * 60 * 1000 };
const PER_DAY = 1500;
const calls = new Map<string, number[]>();
let day = { date: '', n: 0 };

function overLimit(req: Request): boolean {
  const now = Date.now(), today = new Date(now).toISOString().slice(0, 10);
  if (day.date !== today) day = { date: today, n: 0 };
  if (++day.n > PER_DAY) return true;
  const who = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  const recent = (calls.get(who) ?? []).filter(t => now - t < PER_CALLER.windowMs);
  recent.push(now);
  calls.set(who, recent);
  return recent.length > PER_CALLER.max;
}

export async function POST(req: Request) {
  let t: Turn;
  try {
    const b = await req.json();
    t = { sound: b.sound, target: b.target, mark: b.mark, attempt: Number(b.attempt), willRetry: !!b.willRetry };
    if (b.heard !== undefined) {
      if (!['s', 'th', 'sh', 'stop'].includes(b.heard)) throw new Error('bad heard');
      t.heard = b.heard;
    }
    // Mibo's own recent lines (the app got them from this route); short and few, never child text
    if (Array.isArray(b.avoid)) t.avoid = b.avoid.slice(-4).map((x: unknown) => String(x).slice(0, 140));
    if (!['s', 'th'].includes(t.sound) || !TARGETS.has(t.target) || !['got', 'tricky'].includes(t.mark)
      || !(t.attempt >= 1 && t.attempt <= MAX_ATTEMPTS)) throw new Error('bad turn');
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }

  const t0 = Date.now();
  if (overLimit(req)) { console.warn('[reply] over the spend limit: bundled line'); return Response.json(fallbackReply(t)); }
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
