import { LESSON_1 } from './content';

export type LessonInfo = {
  id: string; title: string; subtitle: string; emoji: string; steps: number;
  bg: string; deep: string; ready: boolean;
};

/** The home screen's list. Only Lesson 1 exists so far; the rest show what is coming. */
export const LESSONS: LessonInfo[] = [
  { id: 's-th', title: 'Lesson 1', subtitle: 'Snake sound and tongue sound', emoji: '🐍', steps: LESSON_1.length,
    bg: '#9ff0cf', deep: '#2fa57a', ready: true },
  { id: 'sh', title: 'Lesson 2', subtitle: 'The quiet "sh" sound', emoji: '🤫', steps: 0, bg: '#e4dbff', deep: '#7b61d1', ready: false },
  { id: 'z', title: 'Lesson 3', subtitle: 'Buzzy bee "z"', emoji: '🐝', steps: 0, bg: '#ffe999', deep: '#d9a514', ready: false },
  { id: 'rhyme', title: 'Rhyme time', subtitle: 'Words that sound alike', emoji: '🎵', steps: 0, bg: '#ffd2bd', deep: '#ec7d55', ready: false },
];
