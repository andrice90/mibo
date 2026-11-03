// Large peek icons for video: 2048px, square and rounded. Run with MIBO_PX=4096 so Mibo is drawn at 2x the output.
import path from 'node:path';
import { icon, ARTS, render } from './icons.mjs';

const DEST = 'D:/code-projects/mibo-speech/branding/app-icon';
for (const [name, file] of [['peek', 'peek'], ['peekBig', 'peek-big']]) {
  const a = ARTS[name]();
  render(icon({ art: a }), path.join(DEST, `mibo-icon-${file}-2048.png`), 2048);
  render(icon({ art: a, mask: true }), path.join(DEST, `mibo-icon-${file}-squircle-2048.png`), 2048);
}
