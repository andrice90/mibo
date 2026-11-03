/**
 * POST /api/lesson-voice: Leda speaks an accepted plan (OpenRouter TTS).
 * In:  { plan }  (a plan from /api/lesson-plan, re-validated here)
 * Out: { clips: { [clipId]: { text, audio, visemes, seconds } } }
 * The app saves these WAVs on the phone, so the lesson then runs with no
 * rebuild and no further voice calls for its teaching lines.
 */
import { clipTexts, validatePlan } from '@/lesson/plan';
import { speak, speechVisemes, toBase64 } from '@/server/tts';

const calls = new Map<string, number[]>();
let day = { date: '', n: 0 };
function overLimit(req: Request): boolean {
  const now = Date.now(), today = new Date(now).toISOString().slice(0, 10);
  if (day.date !== today) day = { date: today, n: 0 };
  if (++day.n > 200) return true;
  const who = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const recent = (calls.get(who) ?? []).filter(t => now - t < 10 * 60 * 1000);
  recent.push(now); calls.set(who, recent);
  return recent.length > 10;
}

export async function POST(req: Request) {
  let body: { plan?: unknown; topic?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: 'bad request' }, { status: 400 }); }
  const raw = (body.plan ?? body) as { topic?: unknown };
  const plan = validatePlan(raw, String(raw?.topic ?? 'My lesson'));
  if (!plan) return Response.json({ error: 'That plan is not quite right — make a new one.' }, { status: 400 });
  if (overLimit(req)) return Response.json({ error: 'Too many lessons just now — try again in a bit.' }, { status: 429 });
  try {
    const texts = clipTexts(plan);
    const entries = await Promise.all(Object.entries(texts).map(async ([id, text]) => {
      const s = await speak(text);
      return [id, { text, audio: toBase64(s.wav), visemes: speechVisemes(s, text), seconds: s.seconds }] as const;
    }));
    console.log(`[lesson-voice] ${entries.length} clips for "${plan.title}"`);
    return Response.json({ plan, clips: Object.fromEntries(entries) });
  } catch (e) {
    console.warn('[lesson-voice] failed:', (e as Error).message);
    return Response.json({ error: "Mibo's voice failed just now. Try again." }, { status: 502 });
  }
}
