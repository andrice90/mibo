// Renders the real Mibo puppet (prototypes/mibo-puppet/mibo-puppet.js) headless,
// through @napi-rs/canvas standing in for the browser canvas.
import fs from 'node:fs';
import vm from 'node:vm';
import { createCanvas, Path2D, DOMMatrix } from '@napi-rs/canvas';

// Skia's addPath here *extends* (joins the added path to the current point with a line);
// the browser appends. Move to the added path's start first so the join is zero-length.
const addPath = Path2D.prototype.addPath;
Path2D.prototype.addPath = function (p, m) {
  const start = p.toSVGString().match(/^M\s*(-?[\d.e+-]+)[ ,]+(-?[\d.e+-]+)/);
  if (start && !m) this.moveTo(+start[1], +start[2]);
  return addPath.call(this, p, m);
};
globalThis.Path2D = Path2D;
globalThis.DOMMatrix = DOMMatrix;
globalThis.OffscreenCanvas = class { constructor(w, h) { return createCanvas(w, h); } };
vm.runInThisContext(fs.readFileSync('D:/code-projects/mibo-speech/prototypes/mibo-puppet/mibo-puppet.js', 'utf8'));
const M = globalThis.Mibo;

/**
 * Draw Mibo onto a transparent square canvas of `px` pixels that maps to a
 * 1024-unit icon. `at` = [x, y] icon position of Mibo's ground point, `s` = icon units per character unit.
 */
export function miboPNG({ pose = {}, at = [512, 900], s = 0.6, px = +process.env.MIBO_PX || 2048, seed = 0, shadow = true, outline = 18 } = {}) {
  const c = createCanvas(px, px), ctx = c.getContext('2d');
  const k = px / 1024;
  ctx.setTransform(k * s, 0, 0, k * s, k * at[0], k * at[1]);
  const P = { ...M.DEFAULTS, ...pose };
  const opts = { ...M.STYLE, seed, outline };
  if (!shadow) P.y = -1e-6; // keep shadow call harmless; shadow is faint anyway
  M.drawMibo(ctx, P, opts);
  return c.toBuffer('image/png');
}

export const POSES = {
  wave: { ...M.MOODS.happy, armR: 150, armRBend: 0.2, happy: 0.45, mw: 220, mh: 80, smile: 0.95, teethTop: 0.5, tilt: 6, blush: 0.8, browRaise: 0.4 },
  peek: { ...M.MOODS.happy, lookX: -0.7, lookY: -0.7, tilt: -24, happy: 0.2, mw: 200, mh: 70, smile: 0.9, teethTop: 0.5, blush: 0.85, browRaise: 0.5, armL: 165, armLBend: 0.2, armR: 34 },
};
// No "m" to look at, so he looks out at you.
POSES.peekBig = { ...POSES.peek, lookX: -0.3, lookY: -0.2 };
export { M };
