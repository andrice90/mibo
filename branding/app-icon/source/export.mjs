// Writes the final icon files into branding/app-icon.
import fs from 'node:fs';
import path from 'node:path';
import { icon, ARTS, render, DEFS } from './icons.mjs';

const DEST = 'D:/code-projects/mibo-speech/branding/app-icon';
fs.mkdirSync(DEST, { recursive: true });
const out = (f) => path.join(DEST, f);

for (const [name, file] of [['wave', 'wave'], ['peek', 'peek'], ['peekBig', 'peek-big']]) {
  const a = ARTS[name]();
  render(icon({ art: a }), out(`mibo-icon-${file}.png`));
  render(icon({ art: a, mask: true }), out(`mibo-icon-${file}-squircle.png`));
  render(icon({ art: a }), out(`mibo-icon-${file}-favicon.png`), 48);
}

// Android adaptive icon (wave only): Mibo inside the 66% safe zone on a transparent layer, plus the paper layer.
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${DEFS}</defs>
  <g transform="translate(512 512) scale(0.66) translate(-512 -512)">${ARTS.wave()}</g></svg>`;
render(fg, out('mibo-icon-wave-android-foreground.png'));
render(icon({ art: '' }), out('mibo-icon-android-background.png'));
