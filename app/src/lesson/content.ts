/**
 * The lessons: every line Mibo says and every step, for
 *   Lesson 1  the snake sound /s/ and the tongue sound /θ/ (TH as in thumb)
 *   Lesson 2  the quiet sound /ʃ/ (sh)
 *   Lesson 3  the buzzy bee sound /z/
 *   Rhyme time
 *   Twisty words  long, hard-to-say words, taken chunk by chunk (docs/08)
 * Plans and word choices: docs/07-lessons-2-to-4.md.
 *
 * Everything Mibo says here is bundled Leda audio made by scripts/make-clips.ts,
 * so the lessons run offline. Only the reply after each try is live (Muse Spark
 * writes it, Leda speaks it); when that fails a bundled fallback line plays.
 * Model clips (the hiss and each word said slowly) are checked takes, never
 * live audio (PROJECT #45).
 */

/**
 * What a step practises: a sound the check can hear, rhyming, or a long
 * twisty word. Twisty tries get their own check (voice/wordcheck.ts):
 * the said word is matched against the target word's template, so a
 * different word does not pass; a muddled try at the right word does.
 */
/** `custom`: a word from a grown-up-made lesson whose first sound the check cannot hear yet; any clear try passes and the grown-up's arrows override. */
export type Sound = 's' | 'th' | 'sh' | 'z' | 'rhyme' | 'twisty' | 'custom';

/** Talk lines. Keys are clip ids. */
export const LINES = {
  // the first screen, before the grown-up's checklist
  welcome: "Hello! I'm Mibo. First, grab your mom or dad so they can look at the instructions on the screen here. Then we can start learning fun new words!",
  // after "Hi {name}! I'm Mibo." (src/lesson/name.ts), the same intro without its hello
  welcomeRest: 'First, grab your mom or dad so they can look at the instructions on the screen here. Then we can start learning fun new words!',
  watch: 'Watch my mouth.',
  yourTurn: 'Your turn!',
  youTry: 'You try!',
  nowYou: 'Now you!',
  sayIt: 'Can you say it?',
  yourGo: 'Your go! Say it!',
  canYou: 'Can you do it too?',
  ooh: 'Ooh!',
  yay: 'Yay!',
  wow: 'Wow!',
  woohoo: 'Woo-hoo!',
  hmm: 'Hmm!',
  close: 'Ooh, close!',
  okay: 'Okay!',
  // after a wrong tap in a picture game, before the question again
  again: "Let's listen again.",
  // fallbacks when the live reply is slow or offline (same text as src/server/reply.ts)
  fb_got_1: 'Yes! You did it! Super sound!',
  fb_got_2: 'Wow! That was amazing!',
  fb_got_3: 'Hooray! You got it!',
  fb_tricky_1: "Ooh, so close! Let's try again.",
  fb_tricky_2: 'Good trying! One more time.',
  fb_tricky_3: "Nice and slow. Let's try again!",

  // Lesson 1
  hello: "Hi friend! I'm Mibo. Today we're playing with two sounds: the snake sound, and the tongue sound!",
  warmup: "First, let's wake up our mouths! Big smile... now wiggle your tongue!",
  s_intro: "Here's the snake sound. Teeth together, big smile, and blow.",
  s_turn: 'Now you! Make a long snake sound.',
  s_words: "Let's put the snake sound in some words.",
  th_intro: 'Now the tongue sound! Your tongue peeks out between your teeth, and you blow.',
  th_turn: 'Now you! Tongue out, and blow.',
  th_words: "Let's find the tongue sound in some words.",
  switch: "Wow, you're a snake sound star! Now let's try a new sound.",
  bye: "You did it! You practised the snake sound and the tongue sound. Here's a sticker for you!",

  // Lesson 2: the quiet sound
  sh_hello: "Hi friend! Today we're learning the quiet sound. It's the sound we make when a baby is sleeping!",
  sh_warmup: "First, let's wake up our mouths! Make a big kiss face... now a big smile! Kiss... smile!",
  sh_intro: "Here's the quiet sound. Push your lips out like a kiss, keep your teeth close, and blow.",
  sh_turn: 'Now you! Lips out, and make a long quiet sound.',
  sh_words: "Let's put the quiet sound in some words.",
  sh_game: "Now a listening game! I'll say two words. Tap the one with the quiet sound.",
  sh_pick_shoe: 'Sock... or shoe? Which one has the quiet sound?',
  sh_ans_shoe: 'Shoe! It starts with the quiet sound.',
  sh_pick_ship: 'Ship... or sun? Which one has the quiet sound?',
  sh_ans_ship: 'Ship! It starts with the quiet sound.',
  sh_end: 'The quiet sound can hide at the end of words too. Listen!',
  sh_bye: "You did it! You made the quiet sound at the start and the end of words. Here's a sticker for you!",

  // Lesson 3: the buzzy bee sound
  z_hello: "Hi friend! Today we're learning the buzzy bee sound!",
  z_warmup: "First, let's wake up our voices! Put your hand on your neck and hum. Can you feel it tickle?",
  z_intro: "Here's the buzzy sound. It's like the snake sound, but your voice turns on. Teeth together, smile, and buzz!",
  z_turn: 'Now you! Make a long buzzy bee sound.',
  z_words: "Let's buzz in some words.",
  z_game: "Now a listening game! I'll say two words. Tap the one with the buzzy sound.",
  z_pick_zebra: 'Zebra... or fish? Which one has the buzzy sound?',
  z_ans_zebra: 'Zebra! It starts with the buzzy sound.',
  z_pick_zip: 'Sip... or zip? Which one has the buzzy sound?',
  z_ans_zip: 'Zip! Your voice buzzes in zip.',
  z_end: 'The buzzy sound can hide at the end of words too. Listen!',
  z_bye: "You did it! You buzzed like a busy bee. Here's a sticker for you!",

  // Rhyme time
  rh_hello: "Hi friend! It's rhyme time! Rhyming words sound the same at the end.",
  listen: 'Listen!',
  rh_say: 'Now you say them both!',
  rh_cat_hat: 'Cat... hat!',
  rh_bee_tree: 'Bee... tree!',
  rh_frog_log: 'Frog... log!',
  rh_game: "Now a rhyme game! I'll say a word. Tap the picture that rhymes.",
  rh_pick_sock: 'What rhymes with sock? Clock... or fish?',
  rh_ans_sock: 'Sock, clock! They rhyme!',
  rh_pick_mouse: 'What rhymes with mouse? Moon... or house?',
  rh_ans_mouse: 'Mouse, house! They rhyme!',
  rh_pick_cake: 'What rhymes with cake? Snake... or ball?',
  rh_ans_cake: 'Cake, snake! They rhyme!',
  rh_pick_star: 'What rhymes with star? Sock... or car?',
  rh_ans_star: 'Star, car! They rhyme!',
  rh_bye: "You did it! You're a rhyme time star. Here's a sticker for you!",

  // Twisty words: long, wiggly words taken chunk by chunk (docs/08).
  // Child-facing lines never name a condition or say a word is "hard for you":
  // the words are twisty for everybody, and that is the game (PROJECT #1).
  tw_hello: "Hi friend! Today we're playing Twisty Words! Some words are long and wiggly, and we take them one little chunk at a time.",
  tw_warmup: "First, let's wake up our mouths! Stick your tongue out... wiggle it... now make the silliest face you can!",
  tw_intro: "Here's the game. I say a word slowly, chunk by chunk, like a little train. Then we put the chunks together and say the whole word!",
  tw_words: "Let's load the word train! First chunk... next chunk...",
  tw_game: "Now a listening game! I'll say a twisty word. Tap its picture!",
  tw_pick_spaghetti: 'Which one is spaghetti? Elephant... or spaghetti?',
  tw_ans_spaghetti: 'Spaghetti! Long and wiggly and yummy!',
  tw_pick_butterfly: 'Which one is butterfly? Butterfly... or umbrella?',
  tw_ans_butterfly: 'Butterfly! It flutters by!',
  tw_finale: "Now the longest, wiggliest word of all. Ready? Let's take it chunk by chunk!",
  tw_bye: "You did it! You said the long, twisty words chunk by chunk. Here's a sticker for you!",
} as const;

/**
 * Model clips. `text` is what Leda reads; `sound` sets the mouth for the
 * hiss (the analysis cannot tell /θ/ from /f/, so the clip says which).
 * `trim` cuts a phrase take down to the hiss: /θ/ and /z/ only come out
 * right inside a phrase like "Thhhh... thumb!" (docs/06 §5.2). End-of-word
 * models split the word so the hiss stands on its own ("Fi... shhhhh. Fish!").
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

  sh_hold: { text: 'Shhhhhhh... shoe!', sound: 'sh', trim: true },
  word_shoe: { text: 'Shhhhh... shoe!', sound: 'sh', trim: false },
  word_ship: { text: 'Shhhhh... ship!', sound: 'sh', trim: false },
  word_sheep: { text: 'Shhhhh... sheep!', sound: 'sh', trim: false },
  word_shell: { text: 'Shhhhh... shell!', sound: 'sh', trim: false },
  word_fish: { text: 'Fi... shhhhh. Fish!', sound: 'sh', trim: false },
  word_brush: { text: 'Bru... shhhhh. Brush!', sound: 'sh', trim: false },

  z_hold: { text: 'Zzzzzzz... zoo!', sound: 'z', trim: true },
  word_zoo: { text: 'Zzzzz... zoo!', sound: 'z', trim: false },
  word_zebra: { text: 'Zzzzz... zebra!', sound: 'z', trim: false },
  word_zero: { text: 'Zzzzz... zero!', sound: 'z', trim: false },
  word_zip: { text: 'Zzzzz... zip!', sound: 'z', trim: false },
  word_bees: { text: 'Bee... zzzzz. Bees!', sound: 'z', trim: false },
  word_cheese: { text: 'Chee... zzzzz. Cheese!', sound: 'z', trim: false },

  // Twisty words: chunked slowly, then the whole word (docs/08). No hiss to
  // trim to, so `trim` stays false and the hiss check does not gate these.
  word_spaghetti: { text: 'Spa... ghe... tti! Spaghetti!', sound: 'twisty', trim: false },
  word_elephant: { text: 'El... e... phant! Elephant!', sound: 'twisty', trim: false },
  word_dinosaur: { text: 'Di... no... saur! Dinosaur!', sound: 'twisty', trim: false },
  word_butterfly: { text: 'But... ter... fly! Butterfly!', sound: 'twisty', trim: false },
  word_umbrella: { text: 'Um... brel... la! Umbrella!', sound: 'twisty', trim: false },
  word_hippopotamus: { text: 'Hip... po... pot... a... mus! Hippopotamus!', sound: 'twisty', trim: false },
} as const;

export type LineId = keyof typeof LINES;

/**
 * Lines that say the same thing, so Mibo does not repeat himself: each use
 * takes the next one in the group (founder, 2026-10-28: at least 3 each).
 */
export const VARIANTS = {
  watch: ['watch'],   // founder's pick (take B); one line, no rotation
  yourTurn: ['yourTurn', 'youTry', 'nowYou'],
  sayIt: ['sayIt', 'yourGo', 'canYou'],
  yay: ['yay', 'ooh', 'wow', 'woohoo'],
  hmm: ['hmm', 'close', 'okay'],
} as const satisfies Record<string, readonly LineId[]>;

const BUZZ = "Make a real buzzing z sound with your voice switched on, like a bee, and hold it. Never say the letter name 'zee'.";

/** Per-clip delivery notes for Leda, for clips that come out wrong without one. */
export const NOTES: Partial<Record<ClipId, string>> = {
  watch: "Say 'watch' clearly as 'wotch' (rhymes with 'notch'): no r sound in it.",
  hello: "Say 'friend' as one short, bright word with a simple happy rise, no wobble or drawn-out ending.",
  z_hold: BUZZ, word_zoo: BUZZ, word_zebra: BUZZ, word_zero: BUZZ, word_zip: BUZZ,
  word_bees: `Say 'Bee', pause, then the buzz, then the whole word. ${BUZZ}`,
  word_cheese: `Say 'Chee', pause, then the buzz, then the whole word. ${BUZZ}`,
  word_fish: "Say 'Fi', pause, then a long quiet shhh sound, then the whole word 'fish'.",
  word_brush: "Say 'Bru', pause, then a long quiet shhh sound, then the whole word 'brush'.",
  rh_cat_hat: 'Two words with a little pause between them, both clear and bouncy.',
  rh_bee_tree: 'Two words with a little pause between them, both clear and bouncy.',
  rh_frog_log: 'Two words with a little pause between them, both clear and bouncy.',
  word_spaghetti: 'Say each chunk slowly and clearly with a pause, then the whole word once, bright and proud. Spaghetti is pronounced spa-GET-ee.',
  word_elephant: 'Say each chunk slowly and clearly with a pause, then the whole word once, bright and proud.',
  word_dinosaur: 'Say each chunk slowly and clearly with a pause, then the whole word once, bright and proud.',
  word_butterfly: 'Say each chunk slowly and clearly with a pause, then the whole word once, bright and proud.',
  word_umbrella: 'Say each chunk slowly and clearly with a pause, then the whole word once, bright and proud.',
  word_hippopotamus: 'Say each of the five chunks slowly and clearly with a pause, then the whole long word once, bright and proud, like the grand finale.',
};
export type ModelId = keyof typeof MODELS;
export type ClipId = LineId | ModelId;

/**
 * One thing for the child to say. `kind` tells the check where the sound is:
 * a held sound, the start of a word, or the end of a word. `cue` is the line
 * before the model (default "Watch my mouth").
 */
export type Exercise = {
  sound: Sound; target: string; model: string; prompt: string; emoji: string;
  kind: 'hold' | 'word' | 'end'; cue?: string;
  /** `stt`: judge by speech-to-text transcript (made lessons: any word can be checked). Default: the acoustic hiss check. */
  check?: 'stt';
};

/** A picture game: Mibo asks, the child taps one of two pictures. */
export type Choice = { word: string; emoji: string };
export type Pick = { sound: Sound; ask: string; answer: string; choices: [Choice, Choice]; right: 0 | 1; word?: Choice };

/** Clip ids are bundled ids for built-in lessons, or `dyn_*` ids resolved from a made lesson's saved voice (src/lesson/custom.ts). */
export type Step =
  | { kind: 'line'; clip: string; mood?: string; act?: string; sound?: Sound }
  | { kind: 'model'; clip: string }
  | { kind: 'try'; ex: Exercise }
  | { kind: 'pick'; pick: Pick }
  | { kind: 'end'; clip: string };

const word = (sound: Sound, w: string, emoji: string, kind: 'word' | 'end' = 'word'): Exercise =>
  ({ sound, target: w, model: `word_${w}` as ModelId, prompt: 'sayIt', emoji, kind });
const hold = (sound: Sound, target: string, emoji: string): Exercise =>
  ({ sound, target, model: `${sound}_hold` as ModelId, prompt: `${sound}_turn` as LineId, emoji, kind: 'hold' });
const pair = (a: string, b: string, emoji: string): Exercise =>
  ({ sound: 'rhyme', target: `${a}, ${b}`, model: `rh_${a}_${b}` as LineId, prompt: 'rh_say', emoji, kind: 'word', cue: 'listen' });
const c = (w: string, emoji: string): Choice => ({ word: w, emoji });

export const LESSON_1: Step[] = [
  { kind: 'line', clip: 'hello', mood: 'happy', act: 'wave' },
  { kind: 'line', clip: 'warmup', mood: 'silly' },
  { kind: 'line', clip: 's_intro', mood: 'neutral' },
  { kind: 'try', ex: hold('s', 'the snake sound', '🐍') },
  { kind: 'line', clip: 's_words', mood: 'happy' },
  { kind: 'try', ex: word('s', 'sun', '☀️') },
  { kind: 'try', ex: word('s', 'sock', '🧦') },
  { kind: 'try', ex: word('s', 'soap', '🧼') },
  { kind: 'try', ex: word('s', 'seal', '🦭') },
  { kind: 'line', clip: 'switch', mood: 'happy', act: 'hop', sound: 's' },
  { kind: 'line', clip: 'th_intro', mood: 'neutral' },
  { kind: 'try', ex: hold('th', 'the tongue sound', '👅') },
  { kind: 'line', clip: 'th_words', mood: 'happy' },
  { kind: 'try', ex: word('th', 'thumb', '👍') },
  { kind: 'try', ex: word('th', 'three', '3️⃣') },
  { kind: 'try', ex: word('th', 'think', '💭') },
  { kind: 'end', clip: 'bye' },
];

export const LESSON_SH: Step[] = [
  { kind: 'line', clip: 'sh_hello', mood: 'happy', act: 'wave' },
  { kind: 'line', clip: 'sh_warmup', mood: 'silly' },
  { kind: 'line', clip: 'sh_intro', mood: 'neutral' },
  { kind: 'try', ex: hold('sh', 'the quiet sound', '🤫') },
  { kind: 'line', clip: 'sh_words', mood: 'happy' },
  { kind: 'try', ex: word('sh', 'shoe', '👟') },
  { kind: 'try', ex: word('sh', 'ship', '🚢') },
  { kind: 'try', ex: word('sh', 'sheep', '🐑') },
  { kind: 'try', ex: word('sh', 'shell', '🐚') },
  { kind: 'line', clip: 'sh_game', mood: 'happy', act: 'hop' },
  { kind: 'pick', pick: { sound: 'sh', ask: 'sh_pick_shoe', answer: 'sh_ans_shoe', choices: [c('sock', '🧦'), c('shoe', '👟')], right: 1 } },
  { kind: 'pick', pick: { sound: 'sh', ask: 'sh_pick_ship', answer: 'sh_ans_ship', choices: [c('ship', '🚢'), c('sun', '☀️')], right: 0 } },
  { kind: 'line', clip: 'sh_end', mood: 'neutral' },
  { kind: 'try', ex: word('sh', 'fish', '🐟', 'end') },
  { kind: 'try', ex: word('sh', 'brush', '🪥', 'end') },
  { kind: 'end', clip: 'sh_bye' },
];

export const LESSON_Z: Step[] = [
  { kind: 'line', clip: 'z_hello', mood: 'happy', act: 'wave' },
  { kind: 'line', clip: 'z_warmup', mood: 'silly' },
  { kind: 'line', clip: 'z_intro', mood: 'neutral' },
  { kind: 'try', ex: hold('z', 'the buzzy sound', '🐝') },
  { kind: 'line', clip: 'z_words', mood: 'happy' },
  { kind: 'try', ex: word('z', 'zoo', '🦒') },
  { kind: 'try', ex: word('z', 'zebra', '🦓') },
  { kind: 'try', ex: word('z', 'zero', '0️⃣') },
  { kind: 'try', ex: word('z', 'zip', '🤐') },
  { kind: 'line', clip: 'z_game', mood: 'happy', act: 'hop' },
  { kind: 'pick', pick: { sound: 'z', ask: 'z_pick_zebra', answer: 'z_ans_zebra', choices: [c('zebra', '🦓'), c('fish', '🐟')], right: 0 } },
  { kind: 'pick', pick: { sound: 'z', ask: 'z_pick_zip', answer: 'z_ans_zip', choices: [c('sip', '🥤'), c('zip', '🤐')], right: 1 } },
  { kind: 'line', clip: 'z_end', mood: 'neutral' },
  { kind: 'try', ex: word('z', 'bees', '🐝', 'end') },
  { kind: 'try', ex: word('z', 'cheese', '🧀', 'end') },
  { kind: 'end', clip: 'z_bye' },
];

export const RHYME_TIME: Step[] = [
  { kind: 'line', clip: 'rh_hello', mood: 'happy', act: 'wave' },
  { kind: 'try', ex: pair('cat', 'hat', '🐱🎩') },
  { kind: 'try', ex: pair('bee', 'tree', '🐝🌳') },
  { kind: 'try', ex: pair('frog', 'log', '🐸🪵') },
  { kind: 'line', clip: 'rh_game', mood: 'happy', act: 'hop' },
  { kind: 'pick', pick: { sound: 'rhyme', ask: 'rh_pick_sock', answer: 'rh_ans_sock', choices: [c('clock', '🕐'), c('fish', '🐟')], right: 0, word: c('sock', '🧦') } },
  { kind: 'pick', pick: { sound: 'rhyme', ask: 'rh_pick_mouse', answer: 'rh_ans_mouse', choices: [c('moon', '🌙'), c('house', '🏠')], right: 1, word: c('mouse', '🐭') } },
  { kind: 'pick', pick: { sound: 'rhyme', ask: 'rh_pick_cake', answer: 'rh_ans_cake', choices: [c('snake', '🐍'), c('ball', '⚽')], right: 0, word: c('cake', '🎂') } },
  { kind: 'pick', pick: { sound: 'rhyme', ask: 'rh_pick_star', answer: 'rh_ans_star', choices: [c('sock', '🧦'), c('car', '🚗')], right: 1, word: c('star', '⭐') } },
  { kind: 'end', clip: 'rh_bye' },
];

export const TWISTY_WORDS: Step[] = [
  { kind: 'line', clip: 'tw_hello', mood: 'happy', act: 'wave' },
  { kind: 'line', clip: 'tw_warmup', mood: 'silly' },
  { kind: 'line', clip: 'tw_intro', mood: 'neutral' },
  { kind: 'line', clip: 'tw_words', mood: 'happy' },
  { kind: 'try', ex: word('twisty', 'spaghetti', '🍝') },
  { kind: 'try', ex: word('twisty', 'elephant', '🐘') },
  { kind: 'try', ex: word('twisty', 'dinosaur', '🦕') },
  { kind: 'try', ex: word('twisty', 'butterfly', '🦋') },
  { kind: 'line', clip: 'tw_game', mood: 'happy', act: 'hop' },
  { kind: 'pick', pick: { sound: 'twisty', ask: 'tw_pick_spaghetti', answer: 'tw_ans_spaghetti', choices: [c('elephant', '🐘'), c('spaghetti', '🍝')], right: 1 } },
  { kind: 'pick', pick: { sound: 'twisty', ask: 'tw_pick_butterfly', answer: 'tw_ans_butterfly', choices: [c('butterfly', '🦋'), c('umbrella', '☂️')], right: 0 } },
  { kind: 'try', ex: word('twisty', 'umbrella', '☂️') },
  { kind: 'line', clip: 'tw_finale', mood: 'happy', act: 'hop' },
  { kind: 'try', ex: word('twisty', 'hippopotamus', '🦛') },
  { kind: 'end', clip: 'tw_bye' },
];

/**
 * Where a fresh lesson starts when a greeting was already played: a named
 * child hears "Hi {name}!" instead of the first line's "Hi friend!", so
 * that first line is skipped; anonymous children start at the first line.
 */
export const firstStepAfterGreeting = (steps: Step[], hasGreeting: boolean): number =>
  (hasGreeting && steps[0]?.kind === 'line' ? 1 : 0);

/** Each lesson's steps, by the id the home screen uses (src/lesson/lessons.ts). */
export const PLANS: Record<string, Step[]> = { 's-th': LESSON_1, sh: LESSON_SH, z: LESSON_Z, rhyme: RHYME_TIME, twisty: TWISTY_WORDS };

export const planFor = (lesson: string): Step[] => PLANS[lesson] ?? LESSON_1;

/**
 * The sound each step belongs to, for the progress dots: a line takes the
 * sound of the next try or game after it, unless it names its own.
 */
export function stepSounds(steps: Step[]): Sound[] {
  const out: Sound[] = [];
  let next: Sound = 's';
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.kind === 'try') next = s.ex.sound;
    else if (s.kind === 'pick') next = s.pick.sound;
    out[i] = s.kind === 'line' && s.sound ? s.sound : next;
  }
  // the closing step has nothing after it: it keeps the last sound practised
  const last = steps.length - 1;
  if (steps[last]?.kind === 'end' && last > 0) out[last] = out[last - 1];
  return out;
}

/** Every clip a lesson can play, so only those are preloaded to the phone. */
export function clipsFor(steps: Step[]): string[] {
  const ids = new Set<string>([...Object.values(VARIANTS).flat(), 'again',
    ...(['fb_got_1', 'fb_got_2', 'fb_got_3', 'fb_tricky_1', 'fb_tricky_2', 'fb_tricky_3'] as const)]);
  for (const s of steps) {
    if (s.kind === 'line' || s.kind === 'model' || s.kind === 'end') ids.add(s.clip);
    else if (s.kind === 'try') { ids.add(s.ex.model); ids.add(s.ex.prompt); if (s.ex.cue) ids.add(s.ex.cue); }
    else { ids.add(s.pick.ask); ids.add(s.pick.answer); }
  }
  return [...ids];
}

/** Words the reply route accepts, so the server only speaks about these lessons. */
export const TARGETS = new Set(Object.values(PLANS).flatMap(p => p.flatMap(s => (s.kind === 'try' ? [s.ex.target] : []))));

/** Up to two re-models per word, then move on smiling (docs/04 §3). */
export const MAX_ATTEMPTS = 3;
/** A picture game is asked twice at most; then Mibo shows the answer. */
export const MAX_PICKS = 2;
