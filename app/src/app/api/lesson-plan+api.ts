/**
 * POST /api/lesson-plan: Meta AI writes a lesson plan for grown-up review.
 * In:  { topic }  (the grown-up's own words, e.g. "s words about animals")
 * Out: { plan }   (see src/lesson/plan.ts; no voice yet, nothing stored)
 */
import { validTopic } from '@/lesson/plan';
import { generatePlan } from '@/server/lesson-plan';

const calls = new Map<string, number[]>();
let day = { date: '', n: 0 };
function overLimit(req: Request): boolean {
  const now = Date.now(), today = new Date(now).toISOString().slice(0, 10);
  if (day.date !== today) day = { date: today, n: 0 };
  if (++day.n > 300) return true;
  const who = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const recent = (calls.get(who) ?? []).filter(t => now - t < 10 * 60 * 1000);
  recent.push(now); calls.set(who, recent);
  return recent.length > 20;
}

export async function POST(req: Request) {
  let topic = '';
  try { topic = String((await req.json()).topic ?? '').trim(); } catch { /* bad body */ }
  if (!validTopic(topic)) return Response.json({ error: 'Tell Mibo what words to work on (a few words).' }, { status: 400 });
  if (overLimit(req)) return Response.json({ error: 'Too many plans just now — try again in a bit.' }, { status: 429 });
  try {
    return Response.json({ plan: await generatePlan(topic) });
  } catch (e) {
    console.warn('[lesson-plan] failed:', (e as Error).message);
    return Response.json({ error: 'Mibo could not dream up that lesson. Try different words.' }, { status: 502 });
  }
}
