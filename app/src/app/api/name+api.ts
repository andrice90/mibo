/**
 * POST /api/name: Mibo's four lines with the child's first name, in Leda's voice.
 * In:  { name }   (typed by the grown-up; first name only)
 * Out: { hi, got, tricky, bye: { text, audio, visemes, seconds } }
 *
 * PROJECT #49: the first name goes to the voice service only, once, to make
 * these clips. It is not logged here and never goes to the reply LLM. Only
 * a plain first name is accepted, so this cannot be used to speak other text.
 */
import { NAME_RE } from '@/lesson/name-rule';
import { speak, speechVisemes, toBase64 } from '@/server/tts';

const LINES = (n: string) => ({
  hi: `Hi ${n}! I'm Mibo.`,
  got: `Yes, ${n}! You did it!`,
  tricky: `Good try, ${n}!`,
  bye: `Great job, ${n}!`,
});

// A name is made once per child, so a handful per caller per hour is plenty.
const calls = new Map<string, number[]>();
function overLimit(req: Request) {
  const now = Date.now(), who = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const recent = (calls.get(who) ?? []).filter(t => now - t < 3600_000);
  recent.push(now);
  calls.set(who, recent);
  return recent.length > 10;
}

export async function POST(req: Request) {
  let name = '';
  try { name = String((await req.json()).name ?? '').trim().replace(/\s+/g, ' '); } catch { /* bad body */ }
  if (!NAME_RE.test(name)) return Response.json({ error: 'bad name' }, { status: 400 });
  if (overLimit(req)) return Response.json({ error: 'try later' }, { status: 429 });
  try {
    const lines = LINES(name);
    const out = await Promise.all(Object.entries(lines).map(async ([k, text]) => {
      const s = await speak(text, true, 'Say the name warmly and clearly, like greeting a friend.');
      return [k, { text, audio: toBase64(s.wav), visemes: speechVisemes(s, text), seconds: s.seconds }] as const;
    }));
    return Response.json(Object.fromEntries(out));
  } catch {
    console.warn('[name] voice lines failed');   // never log the name itself
    return Response.json({ error: 'voice failed' }, { status: 502 });
  }
}
