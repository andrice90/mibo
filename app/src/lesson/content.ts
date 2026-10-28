/**
 * Lesson 1: the snake sound /s/ and the tongue sound /θ/ (TH as in thumb).
 *
 * Everything Mibo says here is bundled Leda audio made by scripts/make-clips.ts,
 * so the lesson runs offline. Only the reply after each try is live (Muse Spark
 * writes it, Leda speaks it); when that fails a bundled fallback line plays.
 * Model clips (the hiss and each word said slowly) are checked takes, never
 * live audio (PROJECT #45).
 */

export type Sound = 's' | 'th';

/** Talk lines. Keys are clip ids. */
export const LINES = {
  hello: "Hi friend! I'm Mibo. Today we're playing with two sounds: the snake sound, and the tongue sound!",
  warmup: "First, let's wake up our mouths! Big smile... now wiggle your tongue!",
  watch: 'Watch my mouth.',
  yourTurn: 'Your turn!',
  sayIt: 'Can you say it?',
  s_intro: "Here's the snake sound. Teeth together, big smile, and blow.",
  s_turn: 'Now you! Make a long snake sound.',
  s_words: "Let's put the snake sound in some words.",
  th_intro: 'Now the tongue sound! Your tongue peeks out between your teeth, and you blow.',
  th_turn: 'Now you! Tongue out, and blow.',
  th_words: "Let's find the tongue sound in some words.",
  switch: "Wow, you're a snake sound star! Now let's try a new sound.",
  bye: "You did it! You practised the snake sound and the tongue sound. Here's a sticker for you!",
  ooh: 'Ooh!',
  hmm: 'Hmm!',
  // fallbacks when the live reply is slow or offline (same text as src/server/reply.ts)
  fb_got_1: 'Yes! You did it! Super sound!',
  fb_got_2: 'Wow! That was amazing!',
  fb_got_3: 'Hooray! You got it!',
  fb_tricky_1: "Ooh, so close! Let's try again.",
  fb_tricky_2: 'Good trying! One more time.',
  fb_tricky_3: "Nice and slow. Let's try again!",
} as const;

/**
 * Model clips. `text` is what Leda reads; `sound` sets the mouth for the
 * hiss (the analysis cannot tell /θ/ from /f/, so the clip says which).
 * `trim` cuts a phrase take down to the hiss: /θ/ only comes out right
 * inside "Thhhh... thumb!" (docs/06 §5.2).
 */
export const MODELS = {
  s_hold: { text: 'Ssssssss... sun!', sound: 's', trim: true },
  th_hold: { text: 'Thhhhhh... thumb!', sound: 'th', trim: true },
  word_sun: { text: 'Sssss... sun!', sound: 's', trim: false },
  word_sock: { text: 'Sssss... sock!', sound: 's', trim: false },
  word_soap: { text: 'Sssss... soap!', sound: 's', trim: false },
  word_seal: { text: 'Sssss... seal!', sound: 's', trim: false },
  word_thumb: { text: 'Thhhhh... thumb!', sound: 'th', trim: false },
  word_three: { text: 'Thhhhh... three!', sound: 'th', trim: false },
  word_think: { text: 'Thhhhh... think!', sound: 'th', trim: false },
} as const;

export type LineId = keyof typeof LINES;
export type ModelId = keyof typeof MODELS;
export type ClipId = LineId | ModelId;

export type Exercise = { sound: Sound; target: string; model: ModelId; prompt: LineId; emoji: string };

export type Step =
  | { kind: 'line'; clip: LineId; mood?: string; act?: string }
  | { kind: 'model'; clip: ModelId }
  | { kind: 'try'; ex: Exercise }
  | { kind: 'end'; clip: LineId };

const word = (sound: Sound, w: string, emoji: string): Exercise =>
  ({ sound, target: w, model: `word_${w}` as ModelId, prompt: 'sayIt', emoji });

export const LESSON_1: Step[] = [
  { kind: 'line', clip: 'hello', mood: 'happy', act: 'wave' },
  { kind: 'line', clip: 'warmup', mood: 'silly' },
  { kind: 'line', clip: 's_intro', mood: 'neutral' },
  { kind: 'try', ex: { sound: 's', target: 'the snake sound', model: 's_hold', prompt: 's_turn', emoji: '🐍' } },
  { kind: 'line', clip: 's_words', mood: 'happy' },
  { kind: 'try', ex: word('s', 'sun', '☀️') },
  { kind: 'try', ex: word('s', 'sock', '🧦') },
  { kind: 'try', ex: word('s', 'soap', '🧼') },
  { kind: 'try', ex: word('s', 'seal', '🦭') },
  { kind: 'line', clip: 'switch', mood: 'happy', act: 'hop' },
  { kind: 'line', clip: 'th_intro', mood: 'neutral' },
  { kind: 'try', ex: { sound: 'th', target: 'the tongue sound', model: 'th_hold', prompt: 'th_turn', emoji: '👅' } },
  { kind: 'line', clip: 'th_words', mood: 'happy' },
  { kind: 'try', ex: word('th', 'thumb', '👍') },
  { kind: 'try', ex: word('th', 'three', '3️⃣') },
  { kind: 'try', ex: word('th', 'think', '💭') },
  { kind: 'end', clip: 'bye' },
];

/** Words the reply route accepts, so the server only speaks about this lesson. */
export const TARGETS = new Set(LESSON_1.flatMap(s => (s.kind === 'try' ? [s.ex.target] : [])));

/** Up to two re-models per word, then move on smiling (docs/04 §3). */
export const MAX_ATTEMPTS = 3;
