// Mibo app icons: the real puppet Mibo (sketch look) + the Yellowtail "m" logo, on cream paper.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { miboPNG, POSES } from './mibo.mjs';

const LOGO = 'C:/Users/andri/AppData/Local/Temp/claude/D--code-projects-mibo-speech/3faba2b0-6c19-4f00-a28d-f7d613de0d12/scratchpad/logo/build.mjs';
const { font, wordPath, logoSVG } = await import(pathToFileURL(LOGO).href);
const { Resvg } = await import(pathToFileURL(path.join(path.dirname(LOGO), 'node_modules/@resvg/resvg-js/index.js')).href);

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

const C = { paper: '#f6eedf', paperHi: '#fbf6ec', paperLo: '#ecdcc0', pencil: '#24332e' };
const S = 1024;
const f1 = (n) => +n.toFixed(1);

const DEFS = `
  <radialGradient id="paper" cx="0.5" cy="0.42" r="0.75">
    <stop offset="0" stop-color="${C.paperHi}"/><stop offset="0.7" stop-color="${C.paper}"/><stop offset="1" stop-color="${C.paperLo}"/>
  </radialGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/>
    <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.29  0 0 0 0 0.2  0 0 0 0.9 -0.42"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>`;

function squirclePath(size, n = 5) {
  const R = size / 2, pts = [];
  for (let i = 0; i < 256; i++) {
    const t = (i / 256) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    pts.push(`${f1(R + R * Math.sign(c) * Math.abs(c) ** (2 / n))} ${f1(R + R * Math.sign(s) * Math.abs(s) ** (2 / n))}`);
  }
  return `M${pts.join('L')}Z`;
}

/** The Yellowtail "m" in the exact logo treatment, its box at x,y with width w. */
function mGlyph(x, y, w) {
  const wp = wordPath(font('yellowtail.ttf'), 'm', 400, 0, {}, 18);
  let s = logoSVG(wp, { id: 'm', bg: null, soften: 16, outline: 11, pad: 20 });
  const [, vw, vh] = s.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/).map(Number);
  s = s.replace(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/, '<svg').replace(/width="\d+" height="\d+"/, `x="${x}" y="${y}" width="${w}" height="${f1((w * vh) / vw)}"`);
  return s;
}

const img = (png) => `<image href="data:image/png;base64,${png.toString('base64')}" x="0" y="0" width="${S}" height="${S}"/>`;

/** Mibo's washes are translucent, so lay a paper-coloured copy of his silhouette under him to hide whatever is behind. */
const KNOCKOUT = `<filter id="knockout" x="0" y="0" width="100%" height="100%">
  <feComponentTransfer in="SourceAlpha" result="a"><feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1"/></feComponentTransfer>
  <feFlood flood-color="${C.paper}"/><feComposite in2="a" operator="in"/></filter>`;
const solidImg = (png) => KNOCKOUT + img(png).replace('<image ', '<image filter="url(#knockout)" ') + img(png);

/** Little motion arcs beside a waving hand at (x, y). */
const waveLines = (x, y) => `<g fill="none" stroke="${C.pencil}" stroke-width="11" stroke-linecap="round" opacity="0.8">
  <path d="M${x + 18} ${y - 62} Q${x + 58} ${y - 52} ${x + 70} ${y - 14}"/>
  <path d="M${x + 34} ${y - 100} Q${x + 92} ${y - 86} ${x + 108} ${y - 30}"/></g>`;

const LAYOUT = {
  wave: { at: [478, 862], s: 0.69, hand: [840, 420] },
  peek: { at: [745, 1215], s: 0.8, m: [60, 110, 720] },
  peekBig: { at: [690, 1265], s: 1.0 },
};

const ARTS = {
  wave: (L = LAYOUT.wave) => img(miboPNG({ pose: POSES.wave, at: L.at, s: L.s })) + (L.hand ? waveLines(...L.hand) : ''),
  peek: (L = LAYOUT.peek) => mGlyph(...L.m) + solidImg(miboPNG({ pose: POSES.peek, at: L.at, s: L.s })),
  peekBig: (L = LAYOUT.peekBig) => img(miboPNG({ pose: POSES.peekBig, at: L.at, s: L.s })),
};

function icon({ art, bg = true, mask = false, grain = true }) {
  const clip = mask ? `<clipPath id="sq"><path d="${squirclePath(S)}"/></clipPath>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <defs>${DEFS}${clip}</defs>
  <g ${mask ? 'clip-path="url(#sq)"' : ''}>
    ${bg ? `<rect width="${S}" height="${S}" fill="url(#paper)"/>` : ''}
    ${bg && grain ? `<rect width="${S}" height="${S}" fill="#000" filter="url(#grain)" opacity="0.3"/>` : ''}
    ${art}
  </g></svg>`;
}

function render(svg, file, width = S) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'rgba(0,0,0,0)' });
  fs.writeFileSync(file, r.render().asPng());
}

const only = process.argv[2];
if (process.argv[1]?.endsWith('icons.mjs')) for (const [name, art] of Object.entries(ARTS)) {
  if (only && only !== name) continue;
  const a = art();
  render(icon({ art: a, mask: true }), path.join(OUT, `${name}-squircle.png`));
  render(icon({ art: a }), path.join(OUT, `${name}-square.png`));
}

export { icon, ARTS, LAYOUT, render, squirclePath, mGlyph, DEFS, C, OUT };
