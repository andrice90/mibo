import { PLANS } from './content';

export type LessonInfo = {
  id: string; title: string; subtitle: string; emoji: string; steps: number;
  bg: string; deep: string; ready: boolean;
};

/** The home screen's list. Each id has its steps in PLANS (src/lesson/content.ts); `ready: false` shows "Soon". */
export const LESSONS: LessonInfo[] = [
  { id: 's-th', title: 'Lesson 1', subtitle: 'Snake sound and tongue sound', emoji: '🐍', steps: PLANS['s-th'].length,
    bg: '#9ff0cf', deep: '#2fa57a', ready: true },
  { id: 'sh', title: 'Lesson 2', subtitle: 'The quiet "sh" sound', emoji: '🤫', steps: PLANS.sh.length,
    bg: '#e4dbff', deep: '#7b61d1', ready: true },
  { id: 'z', title: 'Lesson 3', subtitle: 'Buzzy bee "z"', emoji: '🐝', steps: PLANS.z.length, bg: '#ffe999', deep: '#d9a514', ready: true },
  { id: 'rhyme', title: 'Rhyme time', subtitle: 'Words that sound alike', emoji: '🎵', steps: PLANS.rhyme.length,
    bg: '#ffd2bd', deep: '#ec7d55', ready: true },
  { id: 'twisty', title: 'Twisty words', subtitle: 'Long, wiggly words, chunk by chunk', emoji: '🌀', steps: PLANS.twisty.length,
    bg: '#d4efff', deep: '#2f7fb8', ready: true },
];
