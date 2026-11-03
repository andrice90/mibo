/**
 * Server-only: turns a grown-up's words ("s words about farm animals") into
 * a lesson plan with Muse Spark on the Meta Model API (META_AI_API_KEY).
 * The plan is returned for the grown-up to accept before any voice is made.
 * Guardrails (PROJECT #1, #4, #22): teaching lines only, no diagnosis or
 * therapy language, simple words for ages 4-7, and validatePlan() has the
 * final say on sounds and safety.
 */
import { validatePlan, type LessonPlan } from '../lesson/plan';

const API = 'https://api.meta.ai/v1';
const MODEL = 'muse-spark-1.3';

const SYSTEM = `You design ONE short speech-practice lesson for Mibo, a friendly cartoon practice buddy for children aged 4-7, supervised by a grown-up. The grown-up describes the kind of words to work on. This is playful educational practice: never mention diagnosis, therapy, treatment, disorders, or that any word is hard for a particular child.

Return a lesson plan:
- title: short and fun (max 6 words). subtitle: one short line saying what the lesson practises.
- emoji: one emoji for the lesson.
- introLine: Mibo's hello for this lesson (max 22 words, warm, names the theme).
- warmupLine: a silly mouth warm-up line (max 22 words).
- byeLine: a celebration line for the end (max 22 words). Do not promise a sticker or reward beyond praise.
- words: 5 single words the child will practise, fitting the grown-up's request, common and pictureable for a 4-7 year old, each with one emoji. Follow the grown-up's request faithfully: if they ask for multi-syllable words, give multi-syllable words (strawberry, sunflower, banana, elephant). Mibo checks tries by listening for the whole word, so any word works.
- modelText for each word: how Mibo models it. For s/th/sh/z words stretch the first sound then say the word, e.g. "Sssss... sun!" or "Shhhhh... shoe!". For multi-syllable words say it chunk by chunk, then whole, e.g. "Straw... ber... ry! Strawberry!". For other words say it slowly then whole, e.g. "Buh... ball! Ball!". The word itself must appear in modelText.
Simple words a 4 year old knows. No scary, rude or medical words.`;

export async function generatePlan(topic: string, timeoutMs = 20000): Promise<LessonPlan> {
  const key = process.env.META_AI_API_KEY;
  if (!key) throw new Error('META_AI_API_KEY is not set');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${API}/chat/completions`, {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify({ wordsToWorkOn: topic }) }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'mibo_lesson_plan', strict: true,
            schema: {
              type: 'object', additionalProperties: false,
              required: ['title', 'subtitle', 'emoji', 'introLine', 'warmupLine', 'byeLine', 'words'],
              properties: {
                title: { type: 'string' }, subtitle: { type: 'string' }, emoji: { type: 'string' },
                introLine: { type: 'string' }, warmupLine: { type: 'string' }, byeLine: { type: 'string' },
                words: {
                  type: 'array',
                  items: {
                    type: 'object', additionalProperties: false, required: ['word', 'emoji', 'modelText'],
                    properties: { word: { type: 'string' }, emoji: { type: 'string' }, modelText: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
        reasoning_effort: 'minimal',
        max_tokens: 2000,
      }),
    });
    if (!r.ok) throw new Error(`Meta ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const body = await r.json();
    const plan = validatePlan(JSON.parse(body.choices?.[0]?.message?.content ?? '{}'), topic);
    if (!plan) throw new Error('plan failed validation');
    return plan;
  } finally {
    clearTimeout(timer);
  }
}
