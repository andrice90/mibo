/**
 * Server-only: writes Mibo's next line after each try, with Muse Spark on the
 * Meta Model API (PROJECT #26, #45). Only lesson state goes out (target, the
 * grown-up's tap, attempt number): no audio, no names (PROJECT #10, #11). Any
 * failure, slow answer or line that breaks the rules falls back to a bundled
 * line, so the lesson never stalls or says something unchecked.
 */

const API = 'https://api.meta.ai/v1';
// Not a "-contributor" model: those may use inputs for training.
const MODEL = 'muse-spark-1.3';

export type Mark = 'got' | 'tricky';
export type Turn = {
  sound: 's' | 'th';      // the lesson's target sound
  target: string;         // the word or sound attempted, e.g. "sun" or "the snake sound"
  mark: Mark;             // the grown-up's tap
  attempt: number;        // 1-based
  willRetry: boolean;     // the app will model the word again after this line
};
export type Reply = { say: string; mood: 'happy' | 'gentle' | 'surprised'; source: 'llm' | 'fallback'; ms?: number };

const SOUND_TIP = {
  s: 'teeth together, smile, and blow a long snake hiss',
  th: 'tongue peeks out between the teeth and blows gently',
};

const SYSTEM = `You write ONE short line for Mibo, a friendly cartoon speech-practice buddy for children aged 4-7. A grown-up is sitting with the child and taps whether the child's try sounded right.

Rules:
- Max 14 words. Simple words a 4 year old knows. Warm, playful, specific. Full natural sentences ("your tongue", not "tongue").
- Never say the child got it wrong, never "no", "wrong", "bad", "fail" or "incorrect". Praise effort.
- If the try was tricky, give ONE tiny mouth tip for the sound, then encourage. Do not ask a question.
- If the try sounded right, celebrate it and name what they did ("your teeth stayed together!").
- Do not write the sound stretched out (no "Sssss" or "Thhhh"): the app plays that clip itself.
- Never mention doctors, therapy, diagnosis, or anything about the child's body beyond the mouth tip.
- Do not ask for names or personal details. Do not say "your turn": the app says that.
Return JSON: {"say": string, "mood": "happy" | "gentle" | "surprised"}`;

const BLOCK = /\b(wrong|bad|fail|failed|incorrect|no|doctor|therap\w*|diagnos\w*|disorder|lisp|stupid|dumb)\b/i;

const FALLBACK: Record<Mark, string[]> = {
  got: ['Yes! You did it! Super sound!', 'Wow! That was amazing!', 'Hooray! You got it!'],
  tricky: ["Ooh, so close! Let's try again.", 'Good trying! One more time.', "Nice and slow. Let's try again!"],
};

export function fallbackReply(t: Turn): Reply {
  const list = FALLBACK[t.mark];
  return { say: list[(t.attempt - 1) % list.length], mood: t.mark === 'got' ? 'happy' : 'gentle', source: 'fallback' };
}

/** Checks a model line against the rules above; returns the cleaned line or null. */
export function checkLine(raw: unknown): string | null {
  const say = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!say || say.split(' ').length > 18 || BLOCK.test(say) || /(s{3,}|h{3,})/i.test(say)) return null;
  return say;
}

export async function writeReply(t: Turn, timeoutMs = 5000): Promise<Reply> {
  const key = process.env.META_AI_API_KEY;
  if (!key) { console.warn('[reply] META_AI_API_KEY is not set'); return fallbackReply(t); }
  const user = JSON.stringify({
    targetSound: t.sound === 's' ? '/s/ (snake sound)' : '/th/ as in thumb (tongue sound)',
    mouthTip: SOUND_TIP[t.sound],
    attempted: t.target,
    grownUpHeard: t.mark === 'got' ? 'sounded right' : 'still tricky',
    attemptNumber: t.attempt,
    nextStep: t.willRetry ? 'Mibo will show it again' : t.mark === 'got' ? 'move on to the next one' : 'move on, keep it happy',
  });
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${API}/chat/completions`, {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'mibo_line', strict: true,
            schema: {
              type: 'object', additionalProperties: false, required: ['say', 'mood'],
              properties: { say: { type: 'string' }, mood: { type: 'string', enum: ['happy', 'gentle', 'surprised'] } },
            },
          },
        },
        reasoning_effort: 'minimal',
        max_tokens: 400,
      }),
    });
    if (!r.ok) throw new Error(`Meta ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const body = await r.json();
    const out = JSON.parse(body.choices?.[0]?.message?.content ?? '{}');
    const say = checkLine(out.say);
    if (!say) throw new Error(`rejected line: ${out.say}`);
    const mood = ['happy', 'gentle', 'surprised'].includes(out.mood) ? out.mood : t.mark === 'got' ? 'happy' : 'gentle';
    return { say, mood, source: 'llm', ms: Date.now() - t0 };
  } catch (e) {
    console.warn('[reply] fallback:', (e as Error).message);
    return fallbackReply(t);
  } finally {
    clearTimeout(timer);
  }
}
