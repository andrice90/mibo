/* Mibo puppet: a parametric, code-drawn Mibo.
 *
 * Three layers, kept apart so they port to React Native Skia + Reanimated:
 *   1. Rig      drawMibo(ctx, P)   pure: a flat parameter object -> canvas drawing
 *   2. Presets  VISEMES, MOODS     plain data: parameter targets
 *   3. Puppet   puppet.update(dt)  springs + idle life + one-shot moves + talking
 *
 * The rig draws through a "pen": CleanPen is crisp vector, SketchPen is
 * watercolour washes + coloured pencil with boiling lines (style A/B test).
 *
 * Units are character space: ground at y = 0, top of the head at y = -990,
 * body about 1000 wide. Shapes and colours are traced from
 * assets/character/mibo-idle.png so the look stays the founder's Mibo.
 */
(function (root) {
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);

const COLORS = {
  body: '#76ffc2', outline: '#0b0b0b', eye: '#0c0c0f', eyeLow: '#3d3d46',
  blush: '255,128,160', mouth: '#4a1820', tongue: '#ff8aa8', teeth: '#ffffff',
  shadow: '20,40,30',
};

// Body outline anchors (clockwise from the top), traced from the idle pose.
const BODY = [
  [0, -990], [215, -950], [360, -830], [440, -650], [470, -450], [492, -285],
  [515, -125], [470, -22], [300, 3], [0, 8], [-300, 3], [-452, -12], [-512, -92],
  [-506, -205], [-478, -305], [-470, -450], [-440, -650], [-360, -830], [-215, -950],
];
const FACE = {
  eyeL: [-205, -605], eyeR: [215, -605], eyeR0: 108,
  mouth: [10, -450], blushL: [-300, -505], blushR: [312, -505],
  glint: [[-350, -760], [-302, -830], [-218, -878], [-122, -896]],
  dot: [-332, -705], lowGlint: [-486, -150],
};
// Arm angles: degrees from straight down, positive swings away from the body.
const ARMS = {
  // ext: how far the arm's base reaches back into the body (fraction of len),
  // so the shoulder end never crosses the body outline and leaves a notch.
  L: { root: [-330, -405], len: 235, w: 104, side: -1, ext: 0.12 },  // front arm, resting on the belly
  R: { root: [452, -335], len: 228, w: 104, side: 1, ext: 0.45 },    // side arm
};

// ------------------------------------------------------------------ presets

const DEFAULTS = {
  x: 0, y: 0, sy: 1, spread: 0, lean: 0, jelly: 0, tilt: 0,
  camZoom: 1, camX: 0, camY: -540,
  lookX: 0, lookY: 0,
  open: 1, winkL: 0, winkR: 0, happy: 0, topLid: 0, eyeScale: 1, sparkle: 1,
  browRaise: 0, browAngle: 0, browAsym: 0,
  mw: 150, mh: 0, round: 0, smile: 0.55, square: 0, teethTop: 0, teethBot: 0,
  tongueUp: 0, tongueOut: 0, bite: 0, mx: 0,
  blush: 0.55,
  armL: -8, armR: 38, armLBend: 0.35, armRBend: -0.1,
  think: 0, listen: 0, mouthBoost: 1,
};
const MOUTH_KEYS = ['mw', 'mh', 'round', 'smile', 'square', 'teethTop', 'teethBot',
  'tongueUp', 'tongueOut', 'bite', 'mx'];

// Teaching mouths. Sizes are roughly 2-3x the old sprite mouths so a child
// can read them on a phone. Everything not listed falls back to DEFAULTS.
const VISEMES = {
  rest: { mw: 150, mh: 0, smile: 0.55 },
  mbp: { mw: 150, mh: 0, smile: 0.05 },
  ah: { mw: 240, mh: 215, round: 0.1, smile: 0.25, teethTop: 0.3 },
  ee: { mw: 290, mh: 72, square: 1, smile: 0.6, teethTop: 1, teethBot: 1 },
  eh: { mw: 240, mh: 130, square: 0.4, smile: 0.3, teethTop: 0.6, teethBot: 0.2 },
  oh: { mw: 200, mh: 190, round: 0.6, smile: 0 },
  oo: { mw: 210, mh: 105, round: 0.95, smile: -0.05 },
  s: { mw: 275, mh: 56, square: 0.9, smile: 0.45, teethTop: 1, teethBot: 1 },
  sh: { mw: 205, mh: 120, round: 0.7, smile: 0, teethTop: 0.62, teethBot: 0.55 },
  th: { mw: 235, mh: 76, smile: 0.2, teethTop: 0.7, teethBot: 0.45, tongueOut: 1 },
  f: { mw: 220, mh: 30, smile: 0.15, teethTop: 1, bite: 1 },
  l: { mw: 225, mh: 160, smile: 0.2, teethTop: 0.45, tongueUp: 1 },
  dt: { mw: 210, mh: 55, smile: 0.3, teethTop: 0.8, teethBot: 0.5 },
  kg: { mw: 210, mh: 95, smile: 0.2, teethTop: 0.4 },
  rr: { mw: 175, mh: 80, round: 0.55 },
  gap: { mw: 170, mh: 28, smile: 0.4 },
};
const TEACHING = ['s', 'th', 'sh', 'f', 'mbp', 'ah', 'ee', 'eh', 'oh', 'oo', 'l'];

const MOODS = {
  neutral: {},
  happy: { happy: 0.55, smile: 0.95, mw: 230, mh: 85, teethTop: 0.55, square: 0.2,
    blush: 0.85, browRaise: 0.35, sy: 1.03, sparkle: 1.15 },
  listening: { camZoom: 1.08, eyeScale: 1.12, sparkle: 1.25, browRaise: 0.55, mw: 95,
    mh: 22, round: 0.6, smile: 0.15, tilt: -7, lean: -0.02, listen: 1, armR: 70 },
  thinking: { lookX: 0.65, lookY: -0.7, topLid: 0.22, browAsym: 0.9, browRaise: 0.15,
    mw: 95, mh: 0, smile: -0.15, mx: 45, armL: -80, armLBend: 0.6, think: 1, tilt: 4 },
  surprised: { eyeScale: 1.25, sparkle: 1.3, browRaise: 1, mw: 120, mh: 115, round: 0.8,
    smile: 0, sy: 1.07, armL: 55, armR: 80, blush: 0.35 },
  gentle: { browAngle: 0.55, browRaise: 0.25, happy: 0.25, smile: 0.45, lookY: 0.12,
    tilt: 6, blush: 0.7, armL: -25 },
  silly: { winkL: 1, tongueOut: 1, mw: 220, mh: 70, smile: 0.8, teethTop: 0.7, happy: 0.3,
    tilt: -8, blush: 0.9, browAsym: -0.6 },
};

// ------------------------------------------------------------------ geometry

function bodyDeformer(P) {
  const sy = P.sy, sx = 1 + (1 - sy) * 0.9;
  const fn = (x, y) => {
    const h = clamp(-y / 990, 0, 1.3);
    const spread = 1 + P.spread * (1 - Math.min(h, 1)) ** 2;
    return [
      x * sx * spread + P.lean * 990 * Math.pow(h, 1.5) + P.jelly * 70 * Math.sin(Math.PI * Math.min(h, 1)),
      y * sy + Math.abs(P.lean) * 160 * h * h,
    ];
  };
  fn.scaleAt = y => {
    const h = clamp(-y / 990, 0, 1);
    return [sx * (1 + P.spread * (1 - h) ** 2), sy];
  };
  return fn;
}

const bez = (a, b, c, d, t) => {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};
function quadPts(a, c, b, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}
function ellipsePts(cx, cy, rx, ry, n = 40) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = i / n * TAU; out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]); }
  return out;
}
function arcPts(cx, cy, r, a0, a1, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = lerp(a0, a1, i / n); out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
  return out;
}
/** Closed Catmull-Rom spline through the anchors, sampled to points. */
function splinePts(anchors, per = 10) {
  const out = [], n = anchors.length;
  for (let i = 0; i < n; i++) {
    const p0 = anchors[(i - 1 + n) % n], p1 = anchors[i], p2 = anchors[(i + 1) % n], p3 = anchors[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = 0; k < per; k++) out.push(bez(p1, c1, c2, p2, k / per));
  }
  return out;
}
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
const orient = pts => signedArea(pts) < 0 ? pts.slice().reverse() : pts;
function bbox(pts, pad = 40) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
}
function toPath(pts, closed = true) {
  const p = new Path2D();
  pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
  if (closed) p.closePath();
  return p;
}

/** Arm outline: one side root -> tip, round cap, other side back to the root. */
function armGeom(arm, angleDeg, bend, d) {
  // The front arm slides out to the body edge as it lifts, so raised arms clear the body.
  const lift = arm.side < 0 ? clamp((angleDeg - 20) / 100, 0, 1) : 0;
  const rootPt = d(lerp(arm.root[0], -425, lift), lerp(arm.root[1], -450, lift));
  const a = angleDeg * Math.PI / 180;
  const dir = [Math.sin(a) * arm.side, Math.cos(a)];
  const nrm = [-dir[1], dir[0]];
  const N = 10, left = [], right = [], center = [], us = [];
  const ext = arm.ext || 0;
  const curl = bend * arm.len * 0.35 * arm.side;  // positive bend curls the tip inward
  for (let i = 0; i <= N; i++) {
    const u = -ext + (1 + ext) * i / N, off = curl * Math.max(u, 0) ** 2;
    us.push(u);
    center.push([rootPt[0] + dir[0] * arm.len * u + nrm[0] * off, rootPt[1] + dir[1] * arm.len * u + nrm[1] * off]);
  }
  for (let i = 0; i <= N; i++) {
    const a0 = center[Math.max(0, i - 1)], a1 = center[Math.min(N, i + 1)];
    let tx = a1[0] - a0[0], ty = a1[1] - a0[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const u = us[i];
    const hw = arm.w * (u < 0 ? 1 + 0.3 * (-u / ext) : 1 - 0.16 * u) / 2;  // flares into the body like goo
    left.push([center[i][0] - ty * hw, center[i][1] + tx * hw]);
    right.push([center[i][0] + ty * hw, center[i][1] - tx * hw]);
  }
  const tip = center[N];
  const capStart = Math.atan2(left[N][1] - tip[1], left[N][0] - tip[0]);
  // left side -> forward -> right side is a decreasing angle on a y-down canvas
  const cap = arcPts(tip[0], tip[1], arm.w * 0.84 / 2, capStart, capStart - Math.PI, 10).slice(1, -1);
  return { pts: [...left, ...cap, ...right.slice().reverse()] };
}

function mouthGeom(P, k, sx, sy) {
  const w = P.mw * k * sx, h = Math.max(0, P.mh) * k * sy;
  const round = clamp(P.round, 0, 1), sq = clamp(P.square, 0, 1);
  const we = w * (1 - 0.5 * round);
  const pexp = 2 + sq * 3;
  const topR = 0.3 - 0.08 * round;  // the jaw drops: most of the opening goes down, away from the eyes
  const lift = P.smile * we * 0.2;
  const pts = [], N = 64;
  for (let i = 0; i < N; i++) {
    const t = i / N * TAU, c = Math.cos(t), s = Math.sin(t);
    const ex = Math.sign(c) * Math.abs(c) ** (2 / pexp);
    const ey = Math.sign(s) * Math.abs(s) ** (2 / pexp);
    pts.push([ex * we / 2, (s < 0 ? ey * h * topR : ey * h * (1 - topR)) - lift * ex * ex]);
  }
  return { pts, we, h, topR, lift };
}

// ------------------------------------------------------------------ pens
// A pen turns point lists into marks. CleanPen is the crisp vector look.
// SketchPen wobbles every contour ("line boil": a new wobble per drawn frame),
// paints shapes as layered translucent washes with pooled edges and paper
// granulation, shades with pencil hatching, and draws outlines as grainy
// coloured-pencil strokes. No canvas filters: iOS Safari lacks them, and these
// same steps map onto Skia path effects and shaders.

const SKETCH = {
  body: '#79e6b6', bodyDeep: '#4fbf92', pencil: '#24332e', hatch: '#2c7a5c',
  eye: '#28232f', eyeLow: '#544e61', glint: '#fffdf6', mouth: '#6a2a3d', tongue: '#f293ab',
  teeth: '#fffdf6', blush: '238,112,146', shadow: '74,98,88', paper: '#fbf6ec',
};

const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise1 = x => { const i = Math.floor(x), f = x - i; return lerp(hash(i), hash(i + 1), f * f * (3 - 2 * f)) * 2 - 1; };

/** Offset each point along its normal by smooth noise; closed shapes use periodic noise so there is no seam. */
function wobble(pts, closed, amp, seed, freq = 0.011) {
  const n = pts.length;
  if (!amp || n < 3) return pts;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0);
  const R = total * freq / TAU, s1 = seed * 7.31, s2 = seed * 5.13 + 50;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    let o;
    if (closed) {
      const th = cum[i] / total * TAU;
      o = noise1(R * Math.cos(th) + s1) * 0.7 + noise1(R * Math.sin(th) + s2) * 0.7
        + 0.35 * noise1(R * 3 * Math.cos(th) + s2 + 9);
    } else {
      o = noise1(cum[i] * freq + s1) + 0.4 * noise1(cum[i] * freq * 3 + s2);
    }
    out[i] = [pts[i][0] - ty * o * amp, pts[i][1] + tx * o * amp];
  }
  return out;
}

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}
const TEX = new WeakMap();
function textures(ctx) {
  if (TEX.has(ctx)) return TEX.get(ctx);
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // watercolour granulation: fine dark speckles plus soft pigment blotches
  const g = makeCanvas(256, 256), gx = g.getContext('2d');
  const gi = gx.createImageData(256, 256);
  for (let i = 0; i < gi.data.length; i += 4) {
    const v = rnd(), a = v > 0.8 ? (v - 0.8) * 1.2 : v < 0.04 ? 0.25 : 0;
    gi.data[i] = 10; gi.data[i + 1] = 95; gi.data[i + 2] = 70; gi.data[i + 3] = a * 255;
  }
  gx.putImageData(gi, 0, 0);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 18 + rnd() * 50;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {  // wrap so the tile has no seams
      const rg = gx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      rg.addColorStop(0, 'rgba(10,95,70,0.10)'); rg.addColorStop(1, 'rgba(10,95,70,0)');
      gx.fillStyle = rg; gx.fillRect(0, 0, 256, 256);
    }
  }
  // coloured pencil: pigment catching on paper tooth, so alpha breaks up
  const p = makeCanvas(96, 96), px = p.getContext('2d');
  const pi = px.createImageData(96, 96);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const tooth = 0.5 + 0.5 * Math.sin(x * 1.7 + Math.sin(y * 0.9) * 2) * Math.sin(y * 1.3 + x * 0.4);
    const a = clamp(0.35 + 0.75 * rnd() * (0.55 + 0.45 * tooth), 0, 1);
    const k = (y * 96 + x) * 4;
    pi.data[k] = 36; pi.data[k + 1] = 51; pi.data[k + 2] = 46; pi.data[k + 3] = a * 255;
  }
  px.putImageData(pi, 0, 0);
  const t = { grain: ctx.createPattern(g, 'repeat'), pencil: ctx.createPattern(p, 'repeat') };
  TEX.set(ctx, t);
  return t;
}

let PAPER = null;
/** Paper background in screen space, for the hand-drawn stage. */
function drawPaper(ctx, w, h, grain = 0.6) {
  if (!PAPER) {
    const c = makeCanvas(384, 384), x = c.getContext('2d');
    x.fillStyle = SKETCH.paper; x.fillRect(0, 0, 384, 384);
    const im = x.getImageData(0, 0, 384, 384);
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < im.data.length; i += 4) {
      const n = (rnd() - 0.5) * 18;
      im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n * 1.1;
    }
    x.putImageData(im, 0, 0);
    x.strokeStyle = 'rgba(120,100,70,0.06)'; x.lineWidth = 1;
    for (let i = 0; i < 160; i++) {
      const a = rnd() * 384, b = rnd() * 384, l = 6 + rnd() * 22, t = rnd() * TAU;
      x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.cos(t) * l, b + Math.sin(t) * l); x.stroke();
    }
    PAPER = c;
  }
  ctx.save();
  ctx.fillStyle = SKETCH.paper; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = grain; ctx.fillStyle = ctx.createPattern(PAPER, 'repeat'); ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  // a faint pale wash for the floor, like a background painted behind the character
  const g = ctx.createLinearGradient(0, h * 0.55, 0, h);
  g.addColorStop(0, 'rgba(240,200,160,0)'); g.addColorStop(1, 'rgba(240,200,160,0.28)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

class CleanPen {
  constructor(ctx, o) { this.ctx = ctx; this.LW = o.outline || 13; }
  shape(pts, closed = true) { return toPath(pts, closed); }
  fill(pts, role) {
    const p = this.shape(pts, true);
    this.ctx.fillStyle = { eye: COLORS.eye, eyeLow: COLORS.eyeLow, glint: '#fff', mouth: COLORS.mouth,
      tongue: COLORS.tongue, teeth: COLORS.teeth, paper: '#fff' }[role] || role;
    this.ctx.fill(p);
    return p;
  }
  line(pts, closed, width, role = 'ink') {
    const c = this.ctx;
    c.strokeStyle = { ink: COLORS.outline, eye: COLORS.eye, divider: 'rgba(60,40,45,0.35)', tongueLine: 'rgba(150,40,70,0.5)' }[role] || role;
    c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round';
    c.stroke(this.shape(pts, closed));
  }
  silhouette(body, armR, armL, d) {
    const c = this.ctx, LW = this.LW;
    const B = toPath(body), R = toPath(armR.pts), L = toPath(armL.pts);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // Outline pass then fill pass: body and arms merge into one gooey silhouette.
    c.strokeStyle = COLORS.outline; c.lineWidth = LW * 2;
    c.stroke(R); c.stroke(B); c.stroke(L);
    c.fillStyle = COLORS.body; c.fill(R); c.fill(B); c.fill(L);
    // Each part is shaded under its own clip: a union clip leaves holes where
    // the paths wind in opposite directions. Arms only where they leave the body.
    const f = this.f || 1, top = d(0, -990), bot = d(0, 0), sc = d(520 * f, -260);
    const g = c.createLinearGradient(top[0], top[1], bot[0], bot[1]);
    g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(18,140,95,0.24)');
    const rg = c.createRadialGradient(sc[0], sc[1], 40, sc[0], sc[1], 560);
    rg.addColorStop(0, 'rgba(18,140,95,0.2)'); rg.addColorStop(1, 'rgba(18,140,95,0)');
    const outsideBody = new Path2D(); outsideBody.rect(-3000, -3000, 6000, 6000); outsideBody.addPath(B);
    for (const part of [R, B, L]) {
      c.save(); c.clip(part);
      if (part !== B) c.clip(outsideBody, 'evenodd');
      c.fillStyle = g; c.fillRect(-1400, -1600, 2800, 1800);
      c.fillStyle = rg; c.fillRect(-1400, -1600, 2800, 1800);
      c.restore();
    }
    // Front arm: its contour shows where it lies over the belly.
    c.save(); c.clip(B);
    c.strokeStyle = COLORS.outline; c.lineWidth = LW; c.stroke(toPath(armL.pts, false));
    c.restore();
  }
  glint(streak, dot, low) {
    const c = this.ctx, p = toPath(streak, false);
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 36; c.stroke(p);
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 14; c.stroke(p);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.arc(dot[0], dot[1], 19, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.ellipse(low[0], low[1], 11, 18, 0.3, 0, TAU); c.fill();
  }
  blush(x, y, rx, ry, a) {
    const c = this.ctx, rg = c.createRadialGradient(x, y, 5, x, y, rx * 0.92);
    rg.addColorStop(0, `rgba(${COLORS.blush},${0.75 * a})`);
    rg.addColorStop(0.6, `rgba(${COLORS.blush},${0.45 * a})`);
    rg.addColorStop(1, `rgba(${COLORS.blush},0)`);
    c.fillStyle = rg; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill();
  }
  shadow(x, w, h, a) {
    const c = this.ctx;
    c.fillStyle = `rgba(${COLORS.shadow},${a})`;
    c.beginPath(); c.ellipse(x, 12, w, h, 0, 0, TAU); c.fill();
  }
}

class SketchPen extends CleanPen {
  constructor(ctx, o) {
    super(ctx, o);
    this.seed = o.seed || 0;
    this.amp = 5 * (o.boil === undefined ? 1 : o.boil);
    this.bleed = o.bleed === undefined ? 1 : o.bleed;
    this.tex = textures(ctx);
    try { this.tex.pencil.setTransform(new DOMMatrix().translate(this.seed * 37, this.seed * 53)); } catch (e) {}
  }
  shape(pts, closed = true, ampMul = 1, variant = 0) {
    return toPath(wobble(pts, closed, this.amp * ampMul, this.seed * 5 + variant), closed);
  }
  wash(path, box, color, strength = 1, edge = 12) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = 0.78 * strength; c.fillStyle = color; c.fill(path);
    c.clip(path);
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = 0.5 * strength; c.strokeStyle = color; c.lineWidth = edge; c.stroke(path);  // pigment pools at the edge
    c.globalAlpha = 0.3; c.fillStyle = this.tex.grain; c.fillRect(...box);
    c.restore();
  }
  fill(pts, role) {
    const c = this.ctx, col = SKETCH[role] || role;
    const dark = role === 'eye' || role === 'mouth';
    const main = this.shape(pts, true, role === 'glint' || role === 'teeth' ? 0.3 : 0.45);
    if (role === 'glint' || role === 'teeth' || role === 'paper') {
      c.fillStyle = SKETCH[role] || SKETCH.paper; c.fill(main); return main;
    }
    if (role === 'tongue') { c.fillStyle = col; c.fill(main); }  // solid base so it reads as one object, not a glaze
    this.wash(main, bbox(pts), col, dark ? 1.15 : 1, dark ? 8 : 10);
    c.save(); c.globalAlpha = 0.28; c.fillStyle = col;
    c.fill(this.shape(pts, true, 0.9, 1)); c.restore();
    return main;
  }
  line(pts, closed, width, role = 'ink') {
    const c = this.ctx;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (role === 'ink') {
      c.strokeStyle = this.tex.pencil;
      c.globalAlpha = 0.95; c.lineWidth = width * 0.62; c.stroke(this.shape(pts, closed, 0.55));
      c.globalAlpha = 0.6; c.lineWidth = width * 0.34; c.stroke(this.shape(pts, closed, 1, 2));
    } else {
      c.strokeStyle = { eye: SKETCH.eye, divider: 'rgba(90,60,70,0.35)', tongueLine: 'rgba(160,50,80,0.45)' }[role] || role;
      c.lineWidth = width; c.globalAlpha = 0.9; c.stroke(this.shape(pts, closed, 0.5));
    }
    c.restore();
  }
  silhouette(body, armR, armL, d) {
    const c = this.ctx, LW = this.LW;
    const parts = [armR.pts, body, armL.pts].map(orient);
    const union = (amp, v) => { const p = new Path2D(); for (const q of parts) p.addPath(this.shape(q, true, amp, v)); return p; };
    const all = parts.flat(), box = bbox(all, 80);
    // Washes sit slightly off the pencil line, like colour laid in by hand.
    c.save();
    c.translate(this.bleed * 10, -this.bleed * 7);
    const u = union(1.3, 0);
    c.save(); c.globalAlpha = 0.9; c.fillStyle = SKETCH.body; c.fill(u); c.restore();
    // Pigment pools only along the outer silhouette: each part's edge is hidden inside the others.
    const outside = q => { const p = new Path2D(); p.rect(-4000, -4000, 8000, 8000); p.addPath(toPath(q)); return p; };
    c.save(); c.clip(u); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.45;
    c.strokeStyle = SKETCH.body; c.lineWidth = 30;
    parts.forEach((q, i) => {
      c.save();
      parts.forEach((o, j) => { if (j !== i) c.clip(outside(o), 'evenodd'); });
      c.stroke(this.shape(q, true, 1.3, 0));
      c.restore();
    });
    c.globalAlpha = 0.3; c.fillStyle = this.tex.grain; c.fillRect(...box);
    c.restore();
    c.save(); c.globalAlpha = 0.22; c.fillStyle = SKETCH.body; c.fill(union(2, 1)); c.restore();
    c.save(); c.clip(u);
    // wet-in-wet: a light top and a deeper pool low on the body
    const f = this.f || 1, hi = d(-190 * f, -760), lo = d(220 * f, -120);
    let g = c.createRadialGradient(hi[0], hi[1], 20, hi[0], hi[1], 420);
    g.addColorStop(0, 'rgba(255,255,250,0.55)'); g.addColorStop(1, 'rgba(255,255,250,0)');
    c.fillStyle = g; c.fillRect(...box);
    g = c.createRadialGradient(lo[0], lo[1], 40, lo[0], lo[1], 620);
    g.addColorStop(0, 'rgba(60,170,125,0.42)'); g.addColorStop(1, 'rgba(60,170,125,0)');
    c.fillStyle = g; c.fillRect(...box);
    // pencil hatching for the shadow side
    const sc = d(360 * f, -170);
    c.beginPath(); c.ellipse(sc[0], sc[1], 370, 260, -0.3, 0, TAU); c.clip();
    c.strokeStyle = SKETCH.hatch; c.lineCap = 'round';
    const dir = [0.5 * f, -0.866], perp = [0.866 * f, 0.5];
    for (let k = -20; k <= 20; k++) {
      if (hash(k * 3.1 + this.seed) < 0.18) continue;
      const cx = sc[0] + perp[0] * k * 21, cy = sc[1] + perp[1] * k * 21;
      const len = 260 + hash(k + 11.7 + this.seed) * 260;
      const ln = [];
      for (let i = 0; i <= 8; i++) { const t = (i / 8 - 0.5) * len; ln.push([cx + dir[0] * t, cy + dir[1] * t]); }
      c.globalAlpha = 0.18 + 0.14 * hash(k * 1.7 + this.seed);
      c.lineWidth = 3.4; c.stroke(this.shape(ln, false, 0.35, k));
    }
    c.restore();
    c.restore();
    // Pencil outline of the merged silhouette, hidden the same way.
    c.save(); c.clip(outside(armR.pts), 'evenodd'); c.clip(outside(armL.pts), 'evenodd');
    this.line(body, true, LW * 1.25); c.restore();
    c.save(); c.clip(outside(body), 'evenodd'); this.line(armR.pts, true, LW * 1.25); c.restore();
    this.line(armL.pts, false, LW * 1.15);
  }
  glint(streak, dot, low) {
    const c = this.ctx;
    c.save(); c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,253,246,0.7)'; c.lineWidth = 26; c.stroke(this.shape(streak, false, 0.8));
    c.strokeStyle = 'rgba(255,253,246,0.95)'; c.lineWidth = 11; c.stroke(this.shape(streak, false, 1.2, 3));
    c.fillStyle = 'rgba(255,253,246,0.9)'; c.fill(this.shape(ellipsePts(dot[0], dot[1], 18, 17, 16), true, 0.4));
    c.restore();
  }
  blush(x, y, rx, ry, a) {
    const c = this.ctx;
    c.save();
    for (let i = 0; i < 3; i++) {
      c.globalAlpha = (0.2 + 0.06 * i) * a;
      c.fillStyle = `rgb(${SKETCH.blush})`;
      c.fill(this.shape(ellipsePts(x + (i - 1) * 6, y + (i % 2) * 4, rx * (0.95 - i * 0.18), ry * (0.95 - i * 0.15), 28), true, 1.6, 10 + i));
    }
    c.restore();
  }
  shadow(x, w, h, a) {
    const c = this.ctx, pts = ellipsePts(x, 14, w, h, 48), p = this.shape(pts, true, 2.2);
    c.save(); c.globalAlpha = a * 1.3; c.fillStyle = `rgb(${SKETCH.shadow})`; c.fill(p);
    c.clip(p); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.4; c.fillStyle = this.tex.grain; c.fillRect(...bbox(pts));
    c.restore();
  }
}

function makePen(ctx, opts) { return opts.style === 'sketch' ? new SketchPen(ctx, opts) : new CleanPen(ctx, opts); }

// ------------------------------------------------------------------ rig

function drawEye(pen, cx, cy, r, sx, sy, E, f = 1) {
  const ctx = pen.ctx;
  const rx = r * sx, ryFull = r * sy, ry = ryFull * clamp(E.open, 0, 1.2);
  if (E.open < 0.14) {
    // closed: a little curve; upside-down when happy
    const bow = ryFull * 0.3 * (E.happy > 0.4 ? -1 : 1);
    pen.line(quadPts([cx - rx * 0.8, cy], [cx, cy + bow], [cx + rx * 0.8, cy]), false, r * 0.17, 'eye');
    return;
  }
  ctx.save();
  if (E.happy > 0.01) {
    // cheeks push up: cut the eye with a wide ellipse from below -> smiling eye arcs
    const hp = new Path2D();
    hp.rect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4);
    hp.ellipse(cx, cy + ry + ry * (1.25 - 1.8 * E.happy), rx * 1.35, ry * 1.25, 0, 0, TAU);
    ctx.clip(hp, 'evenodd');
  }
  if (E.topLid > 0.01) {
    const lp = new Path2D();
    lp.rect(cx - rx * 2, cy - ry + 2 * ry * E.topLid * 0.9, rx * 4, ry * 4);
    ctx.clip(lp);
  }
  const eye = pen.fill(ellipsePts(cx, cy, rx, ry, 44), 'eye');
  ctx.clip(eye);
  pen.fill(ellipsePts(cx, cy + ry * 0.45, rx * 0.7, ry * 0.42, 36), 'eyeLow');
  // glints keep the light top-left on screen, even when Mibo faces the other way
  const gx = -E.lookX * rx * 0.06;
  pen.fill(ellipsePts(cx + f * (-rx * 0.3) + gx, cy - ry * 0.3, rx * 0.24 * E.sparkle, rx * 0.24 * E.sparkle, 24), 'glint');
  pen.fill(ellipsePts(cx + f * (rx * 0.34) + gx, cy - ry * 0.34, rx * 0.11 * E.sparkle, rx * 0.11 * E.sparkle, 16), 'glint');
  ctx.restore();
}

function drawBrow(pen, ex, ey, r, sx, sy, inner, raise, angle) {
  // inner = +1 when the face centre is to the right of this eye
  const by = ey - r * 1.5 * sy - raise * 62 * sy;
  const half = 58 * sx, tiltY = angle * 30 * sy;
  pen.line(quadPts([ex - inner * half, by + tiltY * 0.6], [ex, by - 16 * sy - tiltY * 0.2], [ex + inner * half, by - tiltY], 12),
    false, pen.LW * 1.35);
}

/** A path covering everything except pts: clip to it to hide marks inside a shape. */
function outsideOf(pts) {
  const p = new Path2D(); p.rect(-4000, -4000, 8000, 8000); p.addPath(toPath(pts)); return p;
}
function domePts(halfW, yBase, yTop, n = 10) {
  // a rounded hump from (-halfW, yBase) up to (0, yTop) and back down
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    L.push(bez([-halfW, yBase], [-halfW, yTop + (yBase - yTop) * 0.25], [-halfW * 0.45, yTop], [0, yTop], t));
    R.push(bez([0, yTop], [halfW * 0.45, yTop], [halfW, yTop + (yBase - yTop) * 0.25], [halfW, yBase], t));
  }
  return [...L, ...R.slice(1), [halfW, yBase + 400], [-halfW, yBase + 400]];
}

/**
 * Keep the mouth below the eyes: returns how far to slide it down so no
 * point of the mouth sits inside an eye's keep-out ellipse. Uses the eyes'
 * full size (not blink-squashed) so the mouth does not jump during blinks.
 */
function eyeClearance(pts, ox, oy, eyes, margin) {
  let dy = 0;
  for (const [x, y] of pts) {
    const X = ox + x, Y = oy + y;
    for (const e of eyes) {
      const u = (X - e.x) / (e.rx + margin);
      if (Math.abs(u) >= 1) continue;
      const bottom = e.y + (e.ry + margin) * Math.sqrt(1 - u * u);
      if (Y < bottom) dy = Math.max(dy, bottom - Y);
    }
  }
  return dy;
}

function drawMouth(pen, cx, cy, sx, sy, P, eyes) {
  const ctx = pen.ctx, LW = pen.LW, k = P.mouthBoost;
  const M = mouthGeom(P, k, sx, sy);
  const { we, h, topR, lift } = M;
  const ox = cx + P.mx * k * sx;
  const yTop = -h * topR, yBot = h * (1 - topR);
  const ttop = yTop + clamp(P.teethTop, 0, 1) * h * 0.5;
  const curve = y => quadPts([-we / 2, y - lift], [0, y + lift], [we / 2, y - lift], 12);
  const band = (y, dir) => {
    // a teeth band whose free edge follows the smile curve
    const far = y + dir * 400;
    return [[-we, far], [-we, y - lift], ...curve(y), [we, y - lift], [we, far]];
  };

  // Parts that cross the lip line are drawn as one outline with the mouth.
  // /th/ and silly: the tongue slides out from under the top teeth.
  let tongue = null;
  if (P.tongueOut > 0.02 && h > 6) {
    const tw = we * 0.22, reach = yBot + (18 + 34 * P.tongueOut) * k * sy;
    const top = Math.max(ttop, yBot - h * 0.55);  // starts low in the mouth, under the top teeth
    // rounded top inside the mouth, straight sides, round tip outside
    tongue = quadPts([-tw, top + tw * 0.5], [-tw, top], [0, top], 6);
    tongue.push(...quadPts([0, top], [tw, top], [tw, top + tw * 0.5], 6).slice(1));
    tongue.push([tw, reach - tw]);
    for (let i = 1; i < 14; i++) { const a = i / 14 * Math.PI; tongue.push([Math.cos(a) * tw, reach - tw + Math.sin(a) * tw]); }
    tongue.push([-tw, reach - tw]);
  }
  // /f/: the top teeth rest on the lower lip.
  let bite = null;
  if (P.bite > 0.02) {
    const bw = we * (0.32 + 0.14 * P.bite), y1 = yBot + 15 * P.bite * k * sy;
    const rc = Math.min(18, (y1 - yTop) * 0.45);  // soft corners and a slightly curved biting edge
    bite = [[-bw, yTop - 2], [-bw, y1 - rc], ...quadPts([-bw, y1 - rc], [-bw, y1], [-bw + rc, y1], 5),
      ...quadPts([-bw + rc, y1], [0, y1 + 8], [bw - rc, y1], 8).slice(1, -1),
      [bw - rc, y1], ...quadPts([bw - rc, y1], [bw, y1], [bw, y1 - rc], 5), [bw, yTop - 2]];
  }

  const all = [...M.pts, ...(tongue || []), ...(bite || [])];
  const dy = Math.min(eyeClearance(all, ox, cy, eyes, 22 + LW), 220);
  ctx.save();
  ctx.translate(ox, cy + dy);
  if (h > 1) {
    ctx.save();
    const inside = pen.fill(M.pts, 'mouth');
    ctx.clip(inside);
    if (h > 24 && !tongue) {
      // tongue: a soft dome on the floor of the mouth; it rises (and narrows) for /l/
      const up = clamp(P.tongueUp, 0, 1);
      const tTop = yBot - h * (0.34 + 0.4 * up);
      pen.fill(domePts(we * (0.36 - 0.1 * up), yBot + 6, tTop), 'tongue');
      pen.line([[0, tTop + h * 0.1], [0, tTop + h * (0.22 + 0.06 * up)]], false, LW * 0.35, 'tongueLine');
    }
    if (P.teethBot > 0.01) pen.fill(band(yBot - clamp(P.teethBot, 0, 1) * h * 0.5, 1), 'teeth');
    ctx.restore();
  }
  if (tongue) {
    pen.fill(tongue, 'tongue');
    pen.line([[0, yBot - 4], [0, yBot + (8 + 16 * P.tongueOut) * k * sy]], false, LW * 0.35, 'tongueLine');
  }
  if (h > 1 && P.teethTop > 0.01) {
    ctx.save(); ctx.clip(toPath(M.pts));
    pen.fill(band(ttop, -1), 'teeth');
    if (P.teethTop > 0.8 && P.teethBot > 0.8 && h > 8) pen.line(curve(ttop), false, LW * 0.35, 'divider');
    ctx.restore();
  }
  if (bite) pen.fill(bite, 'teeth');

  // Outlines: the lip line breaks where the tongue or teeth cross it.
  ctx.save();
  if (tongue) ctx.clip(outsideOf(tongue), 'evenodd');
  if (bite) ctx.clip(outsideOf(bite), 'evenodd');
  pen.line(M.pts, true, LW * 0.95);
  ctx.restore();
  for (const part of [tongue, bite]) {
    if (!part) continue;
    ctx.save(); ctx.clip(outsideOf(M.pts), 'evenodd');
    pen.line(part, true, LW * (part === bite ? 0.7 : 0.85));
    ctx.restore();
  }
  if (bite) {
    // the lower lip tucked under the teeth
    const y1 = yBot + 15 * P.bite * k * sy, bw = we * (0.32 + 0.14 * P.bite);
    pen.line(quadPts([-bw * 0.8, y1 + 16], [0, y1 + 30], [bw * 0.8, y1 + 16], 10), false, LW * 0.5);
  }
  ctx.restore();
}

/**
 * Draw Mibo for parameter set P in character space (ground at y = 0).
 * opts: style 'clean' | 'sketch', outline, brows, mouthScale; sketch also
 * takes seed (boil frame), boil (wobble amount) and bleed (wash offset).
 */
function drawMibo(ctx, P, opts = {}) {
  const pen = makePen(ctx, opts);
  const f = P.facing || 1;
  pen.f = f;
  const lx = P.lookX * f;  // gaze is in screen space; convert into the (possibly mirrored) body
  const lift = clamp(-P.y / 500, 0, 1);
  pen.shadow(P.x, 470 * (1 + (1 - P.sy) * 0.9) * (1 + P.spread * 0.6) * (1 - lift * 0.45), 42 * (1 - lift * 0.4), 0.18 * (1 - lift * 0.6));
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.translate(0, -470); ctx.rotate(P.tilt * Math.PI / 180); ctx.translate(0, 470);
  ctx.scale(f, 1);  // facing: f = -1 puts the other arm in front
  const d = bodyDeformer(P);
  const body = splinePts(BODY.map(p => d(p[0], p[1])), 10);
  const armR = armGeom(ARMS.R, P.armR, P.armRBend, d);
  const armL = armGeom(ARMS.L, P.armL, P.armLBend, d);
  pen.silhouette(body, armR, armL, d);
  const g = FACE.glint.map(p => d(p[0] * f - lx * 10, p[1]));
  const streak = [];
  for (let i = 0; i <= 16; i++) streak.push(bez(g[0], g[1], g[2], g[3], i / 16));
  pen.glint(streak, d(FACE.dot[0] * f, FACE.dot[1]), d(FACE.lowGlint[0] * f, FACE.lowGlint[1]));

  // Face. Features shift with the gaze (parallax) and ride the body deformation.
  const feat = (pt, px, py) => d(pt[0] + lx * px, pt[1] + P.lookY * py);
  const [fsx, fsy] = d.scaleAt(-605);
  for (const pt of [FACE.blushL, FACE.blushR]) {
    const [bx, by] = feat(pt, 36, 22);
    pen.blush(bx, by - P.happy * 10, 78 * fsx, 42 * fsy, clamp(P.blush, 0, 1));
  }
  const r = FACE.eyeR0 * P.eyeScale;
  const eyeZones = [];
  for (const [pt, wink, inner, side] of [[FACE.eyeL, P.winkL, 1, -1], [FACE.eyeR, P.winkR, -1, 1]]) {
    const [ex, ey] = feat(pt, 42, 30);
    eyeZones.push({ x: ex, y: ey, rx: r * fsx, ry: r * fsy });
    drawEye(pen, ex, ey, r, fsx, fsy, {
      open: P.open * (1 - clamp(wink, 0, 1)), happy: clamp(P.happy, 0, 1), topLid: clamp(P.topLid, 0, 1),
      sparkle: P.sparkle, lookX: lx,
    }, f);
    if (opts.brows !== false) drawBrow(pen, ex, ey, r, fsx, fsy, inner, P.browRaise + P.browAsym * side * 0.6, P.browAngle);
  }
  const [mx, my] = feat(FACE.mouth, 52, 32);
  const [msx, msy] = d.scaleAt(-450);
  const ms = opts.mouthScale || 1;
  drawMouth(pen, mx, my, msx * ms, msy * ms, P, eyeZones);
  ctx.restore();
}

// ------------------------------------------------------------------ text -> mouth shapes

const VOWEL = { a: 'ah', e: 'eh', i: 'eh', o: 'oh', u: 'ah' };
const CONS = { m: 'mbp', b: 'mbp', p: 'mbp', f: 'f', v: 'f', s: 's', z: 's', x: 's', l: 'l',
  t: 'dt', d: 'dt', n: 'dt', k: 'kg', g: 'kg', q: 'kg', h: 'kg', r: 'rr', w: 'oo', j: 'sh' };
const HOLDABLE = new Set(['s', 'sh', 'th', 'f', 'ah', 'ee', 'eh', 'oh', 'oo', 'mbp', 'l']);

/** Rough grapheme-to-viseme timeline. Stretched letters ("Sssss") become holds. */
function textToVisemes(text, speed = 1) {
  const out = [];
  const s = text.toLowerCase();
  const push = (v, d, i, hold) => out.push({ v, d: d / speed, i, hold: !!hold });
  for (let i = 0; i < s.length;) {
    const c = s[i], two = s.slice(i, i + 2);
    if (/\s/.test(c)) { push('gap', 0.05, i); i++; continue; }
    if (s.startsWith('...', i) || c === '…') { push('rest', 0.55, i); i += c === '…' ? 1 : 3; continue; }
    if (',;:'.includes(c)) { push('rest', 0.26, i); i++; continue; }
    if ('.!?'.includes(c)) { push('rest', 0.36, i); i++; continue; }
    if (!/[a-z']/.test(c)) { i++; continue; }
    let v, len = 1;
    if (two === 'sh' || two === 'ch') { v = 'sh'; len = 2; }
    else if (two === 'th') { v = 'th'; len = 2; }
    else if (two === 'ee' || two === 'ea') { v = 'ee'; len = 2; }
    else if (two === 'oo') { v = 'oo'; len = 2; }
    else if (two === 'ou' || two === 'ow') { v = 'oh'; len = 2; }
    else if (c === 'y') v = 'ee';
    else if (c === 'c') v = 'ei'.includes(s[i + 1]) ? 's' : 'kg';
    else if (c === "'") { i++; continue; }
    else if (VOWEL[c]) {
      // silent final e ("make", "nice")
      if (c === 'e' && !/[a-z]/.test(s[i + 1] || '') && i > 1 && !'aeiou'.includes(s[i - 1])) { i++; continue; }
      v = VOWEL[c];
    } else v = CONS[c] || 'dt';
    // count stretched repeats of the last letter: "sssss", "thhhh", "ahhh"
    let j = i + len;
    const rep = s[i + len - 1];
    while (s[j] === rep) j++;
    const extra = j - (i + len);
    const vowel = ['ah', 'eh', 'ee', 'oh', 'oo'].includes(v);
    let d = vowel ? 0.12 : 0.075;
    const hold = extra >= 2 && HOLDABLE.has(v);
    if (extra > 0) d += Math.min(extra, 8) * (hold ? 0.17 : 0.03);
    push(v, d, i, hold);
    i = j;
  }
  return out;
}

// ------------------------------------------------------------------ puppet

const GROUP = {
  x: 'body', y: 'body', sy: 'jelly', spread: 'jelly', lean: 'jelly', jelly: 'jelly', tilt: 'body',
  camZoom: 'cam', camX: 'cam', camY: 'cam', armL: 'arm', armR: 'arm', armLBend: 'arm', armRBend: 'arm',
  mouthBoost: 'cam',
};
MOUTH_KEYS.forEach(k => { GROUP[k] = 'mouth'; });

class Puppet {
  constructor() {
    this.P = { ...DEFAULTS };
    this.s = {};
    for (const k in DEFAULTS) this.s[k] = { v: DEFAULTS[k], vel: 0 };
    this.mood = 'neutral';
    this.held = null; this.heldWatch = false;
    this.actions = [];
    this.queue = []; this.seg = null; this.speech = null;
    this.t = 0;
    this.energy = 0.7; this.bounce = 0.55; this.talkSpeed = 1;
    this.blinkAt = 1.5; this.blinkT = -1;
    this.lookAt = 1; this.look = [0, 0];
    this.fidgetAt = 6;
    this.pointer = null; this.pointerT = -10;
    this.lastPoke = 0;
    this.particles = [];
    this.watch = 0;
    this.facing = 1;
    this.onCaption = null;
  }

  // --- public controls
  setMood(m) { this.mood = MOODS[m] ? m : 'neutral'; }
  hold(v, watch) { this.held = v; this.heldWatch = !!watch; }
  act(name) {
    const A = ACTIONS[name];
    if (!A) return;
    this.actions = this.actions.filter(a => a.name !== name);
    this.actions.push({ name, t: 0, dur: A.dur, fn: A.fn, fired: {} });
  }
  /** Queue a script: strings, or segments {say}, {model, hold, watch}, {mood}, {act}, {wait}. */
  play(script, onDone) {
    this.queue = script.map(x => typeof x === 'string' ? { say: x } : { ...x });
    if (onDone) this.queue.push({ call: onDone });
    this.seg = null; this.speech = null;
  }
  stop() { this.queue = []; this.seg = null; this.speech = null; this.watch = 0; this.caption('', -1); }
  say(text) { this.play([{ say: text }]); }
  get busy() { return !!(this.seg || this.queue.length); }
  poke(x, y) {
    this.pointer = [x, y]; this.pointerT = this.t;
    if (Math.hypot(x - this.P.x, (y - this.P.y + 480) * 1.05) < 520) {
      this.act('boop'); this.lastPoke = this.t;
      for (let i = 0; i < 4; i++) this.spawn('heart', x + (Math.random() - 0.5) * 120, y - 40);
      return true;
    }
    return false;
  }
  point(x, y) { this.pointer = [x, y]; this.pointerT = this.t; }
  caption(text, i) { if (this.onCaption) this.onCaption(text, i); }

  spawn(kind, x, y) {
    const cols = ['#ffd166', '#ef476f', '#4cc9f0', '#76ffc2', '#b388ff', '#ff9f1c'];
    const p = { kind, x, y, life: 1, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10,
      color: cols[(Math.random() * cols.length) | 0] };
    if (kind === 'confetti') {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 900 + Math.random() * 900;
      Object.assign(p, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: 18 + Math.random() * 14, h: 10 + Math.random() * 8, ttl: 2.2 });
    } else if (kind === 'star') {
      const a = Math.random() * TAU, sp = 350 + Math.random() * 450;
      Object.assign(p, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 300, size: 24 + Math.random() * 22, ttl: 1.2, color: '#ffd166' });
    } else {
      Object.assign(p, { vx: (Math.random() - 0.5) * 160, vy: -260 - Math.random() * 160, size: 26 + Math.random() * 16, ttl: 1.3, color: '#ff6f91' });
    }
    p.max = p.ttl;
    this.particles.push(p);
  }

  // --- frame update
  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.t += dt;
    const T = { ...DEFAULTS, ...MOODS[this.mood] };
    const add = {};
    const plus = (k, v) => { add[k] = (add[k] || 0) + v; };

    // script queue
    this.runScript(dt, T, plus);

    // a held teaching mouth wins over everything else on the mouth
    if (this.held) Object.assign(T, mouthOf(this.held));
    const watching = (this.held && this.heldWatch) || (this.seg && this.seg.watch);
    this.watch = lerp(this.watch, watching ? 1 : 0, 1 - Math.exp(-dt * 6));
    if (watching) {
      Object.assign(T, { camZoom: 1.85, camY: -450, camX: 10, lookX: 0, lookY: 0, browRaise: 0.4, mouthBoost: 1.15, tilt: 0, lean: 0 });
    }

    // one-shot moves
    const direct = {};
    for (const a of this.actions) {
      a.t += dt;
      const u = clamp(a.t / a.dur, 0, 1);
      const o = a.fn(u, a, this) || {};
      if (o.set) Object.assign(T, o.set);
      if (o.add) for (const k in o.add) plus(k, o.add[k]);
      if (o.direct) Object.assign(direct, o.direct);
    }
    this.actions = this.actions.filter(a => a.t < a.dur);

    // idle life, damped while teaching
    const life = this.energy * (1 - this.watch * 0.85);
    const tt = this.t;
    plus('sy', life * 0.016 * Math.sin(TAU * tt / 3.3));
    plus('spread', life * 0.012 * Math.sin(TAU * tt / 3.3 + 0.6));
    plus('lean', life * 0.012 * Math.sin(TAU * tt / 5.3));
    plus('armR', life * 4 * Math.sin(TAU * tt / 3.3 + 1));
    plus('armL', life * 3 * Math.sin(TAU * tt / 3.3 + 2));

    // gaze: follow a recent pointer, else small saccades
    const pointerFresh = this.pointer && this.t - this.pointerT < 2.5;
    if (pointerFresh) {
      const [px, py] = this.pointer;
      this.look = [clamp((px - this.P.x) / 420, -1, 1), clamp((py - (this.P.y - 600)) / 420, -1, 1)];
      this.lookAt = this.t + 1;
    } else if (this.t > this.lookAt) {
      const r = 0.12 + life * 0.3;
      this.look = Math.random() < 0.35 ? [0, 0] : [(Math.random() - 0.5) * 2 * r, (Math.random() - 0.5) * r];
      this.lookAt = this.t + 0.7 + Math.random() * 2.4;
    }
    if (!watching && this.mood !== 'thinking') { plus('lookX', this.look[0]); plus('lookY', this.look[1] * 0.8); }

    // fidgets keep the screen alive between turns
    if (!this.busy && !this.held && !this.actions.length && this.t > this.fidgetAt && life > 0.05) {
      if (this.mood === 'neutral' || this.mood === 'happy') {
        const pick = ['glance', 'sway', 'minihop', 'armswing', 'hum', 'blinkdouble', 'turn', 'turn'];
        this.act(pick[(Math.random() * pick.length) | 0]);
      }
      this.fidgetAt = this.t + (5 + Math.random() * 6) / Math.max(this.energy, 0.2);
    }

    // springs
    const zj = 0.18 + 0.6 * (1 - this.bounce), za = 0.3 + 0.5 * (1 - this.bounce);
    const SPR = {
      body: [160, 0.8], jelly: [190, zj], cam: [30, 1], arm: [150, za], mouth: [1300, 0.85], face: [230, 0.75],
    };
    const steps = Math.ceil(dt / (1 / 240));
    const h = dt / steps;
    for (const k in this.s) {
      const sp = this.s[k], [K, Z] = SPR[GROUP[k] || 'face'];
      const target = T[k], c = 2 * Z * Math.sqrt(K);
      for (let i = 0; i < steps; i++) {
        sp.vel += (K * (target - sp.v) - c * sp.vel) * h;
        sp.v += sp.vel * h;
      }
    }
    for (const k in direct) { this.s[k].v = direct[k]; this.s[k].vel = 0; }
    for (const k in this.s) this.P[k] = this.s[k].v + (add[k] || 0);
    this.P.facing = this.facing;
    this.P.camY += this.P.y * 0.7;

    // blinks
    if (this.t > this.blinkAt && this.blinkT < 0) this.blinkT = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const b = this.blinkT;
      const m = b < 0.07 ? 1 - b / 0.07 : b < 0.11 ? 0 : b < 0.2 ? (b - 0.11) / 0.09 : 1;
      this.P.open *= m;
      if (b >= 0.2) {
        this.blinkT = -1;
        this.blinkAt = this.t + (Math.random() < 0.18 ? 0.25 : 1.8 + Math.random() * 3.6);
      }
    }

    // particles
    for (const p of this.particles) {
      p.ttl -= dt;
      const drag = p.kind === 'confetti' ? 2.2 : 1.2;
      p.vx -= p.vx * drag * dt; p.vy -= p.vy * drag * dt;
      p.vy += (p.kind === 'heart' ? -40 : 900) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter(p => p.ttl > 0);
  }

  runScript(dt, T, plus) {
    if (!this.seg && this.queue.length) {
      this.seg = this.queue.shift();
      this.seg.t = 0;
      const g = this.seg;
      if (g.mood) this.setMood(g.mood);
      if (g.act) this.act(g.act);
      if (g.call) { g.call(); this.seg = null; return; }
      if (g.say) {
        this.speech = { list: textToVisemes(g.say, this.talkSpeed), idx: 0, at: 0 };
        this.speech.total = this.speech.list.reduce((a, b) => a + b.d, 0);
        this.caption(g.say, 0);
      } else if (g.model) {
        this.caption(g.caption || g.model, -1);
      } else if (g.caption !== undefined) {
        this.caption(g.caption, -1);
      }
    }
    const g = this.seg;
    if (!g) return;
    g.t += dt;
    if (g.say) {
      const sp = this.speech;
      while (sp.idx < sp.list.length && g.t > sp.at + sp.list[sp.idx].d) { sp.at += sp.list[sp.idx].d; sp.idx++; sp.bumped = false; }
      if (sp.idx >= sp.list.length) { this.seg = null; this.speech = null; return; }
      const cur = sp.list[sp.idx];
      Object.assign(T, mouthOf(cur.v));
      T.smile = T.smile + (MOODS[this.mood].smile || 0.4) * 0.25;
      if (cur.hold && g.watchHolds !== false) { g.watch = true; } else if (!g.watchAll) { g.watch = false; }
      if (g.watchAll) g.watch = true;
      // talking body language: a little bounce on each vowel, brows on '!' and '?'
      if (!sp.bumped && ['ah', 'eh', 'ee', 'oh', 'oo'].includes(cur.v)) {
        sp.bumped = true;
        this.s.sy.vel += 0.32 * this.energy;
        this.s.tilt.vel += (Math.random() - 0.5) * 30 * this.energy;
      }
      if (/!/.test(g.say)) plus('browRaise', 0.35);
      if (/\?/.test(g.say)) { plus('tilt', 5); plus('browRaise', 0.25); }
      this.caption(g.say, cur.i);
    } else if (g.model) {
      Object.assign(T, mouthOf(g.model));
      g.watch = g.watch !== false;
      if (g.t > (g.hold || 1.5)) this.seg = null;
    } else if (g.t >= (g.wait || 0)) {
      this.seg = null;
    }
    if (!this.seg && !this.queue.length) this.caption('', -1);
  }
}

function mouthOf(v) {
  const m = { ...VISEMES[v] };
  for (const k of MOUTH_KEYS) if (m[k] === undefined) m[k] = k === 'mw' ? 150 : 0;
  return m;
}

// --- one-shot moves. u runs 0..1 over dur seconds.
const ACTIONS = {
  hop: { dur: 1.05, fn(u, a, pp) {
    const out = { set: {} };
    if (u < 0.2) out.set = { sy: 0.8, spread: 0.18, armL: 20, armR: 60 };
    else if (u < 0.66) {
      const k = (u - 0.2) / 0.46;
      out.direct = { y: -280 * Math.sin(Math.PI * k) };
      out.set = { sy: k < 0.5 ? 1.16 : 1.04, armL: 70, armR: 110, happy: 0.45, mh: 60, smile: 0.9, mw: 200, teethTop: 0.4 };
    } else if (u < 0.8) out.set = { sy: 0.78, spread: 0.26 };
    if (u >= 0.66 && !a.fired.land) { a.fired.land = true; pp.s.y.v = 0; pp.s.y.vel = 0; }
    return out;
  } },
  wave: { dur: 2.3, fn(u) {
    const env = Math.min(1, u * 6, (1 - u) * 5);
    return { set: { armR: lerp(38, 150, env) + Math.sin(u * 2.3 * TAU * 2.2) * 26 * env, armRBend: 0.2,
      happy: 0.45 * env, mw: 220, mh: 80 * env, smile: 0.95, teethTop: 0.5, tilt: 6 * env, blush: 0.8, browRaise: 0.4 * env } };
  } },
  celebrate: { dur: 2.6, fn(u, a, pp) {
    const out = { set: { happy: 0.9, mw: 250, mh: 150, smile: 1, teethTop: 0.6, blush: 1, browRaise: 0.6, sparkle: 1.3 } };
    if (u < 0.12) Object.assign(out.set, { sy: 0.74, spread: 0.3, armL: 40, armR: 60 });
    else if (u < 0.5) {
      const k = (u - 0.12) / 0.38;
      out.direct = { y: -320 * Math.sin(Math.PI * k), tilt: 360 * ease(k) };
      Object.assign(out.set, { sy: 1.12, armL: 135, armR: 145, armLBend: -0.2, armRBend: -0.2 });
      if (!a.fired.burst) {
        a.fired.burst = true;
        for (let i = 0; i < 70; i++) pp.spawn('confetti', (Math.random() - 0.5) * 300, -700);
        for (let i = 0; i < 10; i++) pp.spawn('star', 0, -600);
      }
    } else if (u < 0.62) {
      Object.assign(out.set, { sy: 0.75, spread: 0.3, armL: 125, armR: 135 });
      if (!a.fired.land) { a.fired.land = true; pp.s.tilt.v = 0; pp.s.tilt.vel = 0; pp.s.y.v = 0; pp.s.y.vel = 0; }
    } else {
      const k = (u - 0.62) / 0.38;
      Object.assign(out.set, { armL: 130 + Math.sin(k * TAU * 3) * 18, armR: 140 - Math.sin(k * TAU * 3) * 18, jelly: Math.sin(k * TAU * 3) * 0.4 * (1 - k) });
    }
    return out;
  } },
  wiggle: { dur: 1.8, fn(u) {
    const env = Math.min(1, u * 5, (1 - u) * 4);
    const w = Math.sin(u * 1.8 * TAU * 3);
    return { set: { lean: w * 0.13 * env, jelly: -w * 0.5 * env, winkL: u < 0.5 ? env : 0, winkR: u >= 0.5 ? env : 0,
      tongueOut: env, mw: 220, mh: 70, smile: 0.8, teethTop: 0.7, blush: 0.95, armL: 30 + w * 30, armR: 60 - w * 30, tilt: w * 5 * env } };
  } },
  boop: { dur: 0.9, fn(u) {
    const env = Math.min(1, u * 8, (1 - u) * 3);
    return { set: { sy: u < 0.15 ? 0.84 : 1.04, spread: u < 0.15 ? 0.15 : 0, happy: 0.85 * env, blush: 1, mw: 230,
      mh: 110 * env, smile: 1, teethTop: 0.5, armL: -40, armR: 20 },
      add: { x: Math.sin(u * TAU * 7) * 12 * env, tilt: Math.sin(u * TAU * 5) * 4 * env } };
  } },
  // turn around: squash, hop, flip at the top behind a blink, land
  turn: { dur: 0.85, fn(u, a, pp) {
    const out = { set: {} };
    if (u < 0.28) {
      out.set = { sy: 0.86, spread: 0.12 };
      out.add = { lookX: -0.8 * pp.facing * Math.min(1, u * 5) };  // eyes lead the turn
    } else if (u < 0.66) {
      const k = (u - 0.28) / 0.38;
      out.direct = { y: -75 * Math.sin(Math.PI * k) };
      out.set = { sy: 1.07, armL: 30, armR: 60 };
      if (!a.fired.flip && k > 0.4) { a.fired.flip = true; pp.facing *= -1; pp.blinkT = 0.07; }
    } else {
      out.set = { sy: 0.9, spread: 0.1 };
      if (!a.fired.land) { a.fired.land = true; pp.s.y.v = 0; pp.s.y.vel = 0; }
    }
    return out;
  } },
  // small fidgets
  glance: { dur: 2.2, fn(u) {
    const side = u < 0.5 ? -0.9 : 0.9, env = Math.min(1, u * 5, (1 - u) * 5);
    return { set: { lookX: side * env, lookY: -0.1 * env, tilt: side * 4 * env } };
  } },
  sway: { dur: 2.4, fn(u) { return { add: { lean: Math.sin(u * TAU) * 0.05, tilt: Math.sin(u * TAU) * 3 } }; } },
  minihop: { dur: 0.7, fn(u, a, pp) {
    const out = {};
    if (u < 0.25) out.set = { sy: 0.88 };
    else if (u < 0.75) { out.direct = { y: -90 * Math.sin(Math.PI * (u - 0.25) / 0.5) }; out.set = { sy: 1.06 }; }
    else { out.set = { sy: 0.9 }; if (!a.fired.l) { a.fired.l = true; pp.s.y.v = 0; pp.s.y.vel = 0; } }
    return out;
  } },
  armswing: { dur: 1.6, fn(u) { const e = Math.sin(u * Math.PI); return { set: { armR: 38 + 50 * e + Math.sin(u * TAU * 2) * 15 * e } }; } },
  hum: { dur: 1.6, fn(u) {
    const e = Math.min(1, u * 6, (1 - u) * 6);
    return { set: { mw: 110, mh: 10 * e, round: 0.5, happy: 0.35 * e, smile: 0.3 }, add: { tilt: Math.sin(u * TAU * 2) * 4 * e } };
  } },
  blinkdouble: { dur: 0.5, fn(u, a, pp) { if (!a.fired.b) { a.fired.b = true; pp.blinkAt = pp.t; } return {}; } },
};

function drawParticles(ctx, parts, opts = {}) {
  const sketch = opts.style === 'sketch';
  const pen = sketch ? makePen(ctx, opts) : null;
  for (const p of parts) {
    const a = clamp(p.ttl / Math.min(p.max, 0.6), 0, 1);
    ctx.save(); ctx.globalAlpha = a * (sketch ? 0.8 : 1); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (sketch) ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = p.color;
    let pts;
    if (p.kind === 'confetti') pts = [[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]];
    else if (p.kind === 'star') {
      pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? p.size * 0.45 : p.size, t = i / 10 * TAU - Math.PI / 2;
        pts.push([Math.cos(t) * r, Math.sin(t) * r]);
      }
    } else {
      ctx.rotate(-p.rot); const s = p.size;
      pts = [...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => bez([0, s * 0.35], [-s, -s * 0.3], [-s * 0.4, -s], [0, -s * 0.45], i / 8)),
        ...[1, 2, 3, 4, 5, 6, 7].map(i => bez([0, -s * 0.45], [s * 0.4, -s], [s, -s * 0.3], [0, s * 0.35], i / 8))];
    }
    ctx.fill(sketch ? toPath(wobble(pts, true, 2.5, (opts.seed || 0) + p.max * 10)) : toPath(pts));
    ctx.restore();
  }
}

/** Thought dots and "I'm listening" waves, faded in by P.think / P.listen. */
function drawFx(ctx, P, t, accent, opts = {}) {
  const pen = makePen(ctx, opts);
  const th = clamp(P.think, 0, 1), li = clamp(P.listen, 0, 1);
  if (th > 0.02) {
    [[300, -1050, 22], [385, -1125, 30], [490, -1215, 40]].forEach(([x, y, r], i) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5 - i * 0.9);
      ctx.globalAlpha = th * (0.35 + 0.65 * pulse);
      const pts = ellipsePts(P.x + x, P.y + y - pulse * 8, r * (0.9 + pulse * 0.15), r * (0.9 + pulse * 0.15), 24);
      pen.fill(pts, 'paper');
      pen.line(pts, true, 8);
    });
    ctx.globalAlpha = 1;
  }
  if (li > 0.02) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i / 3) % 1;
        ctx.globalAlpha = li * (1 - ph) * 0.9;
        const a0 = side > 0 ? -0.6 : Math.PI - 0.6;
        pen.line(arcPts(P.x + side * 520, P.y - 640, 70 + ph * 120, a0, a0 + 1.2, 14), false, 14, accent);
      }
    }
    ctx.globalAlpha = 1;
  }
}

root.Mibo = { _test: { mouthGeom, eyeClearance, bodyDeformer, FACE }, DEFAULTS, VISEMES, TEACHING, MOODS, ACTIONS, MOUTH_KEYS, drawMibo, drawParticles, drawFx, drawPaper,
  textToVisemes, Puppet };
})(typeof window !== 'undefined' ? window : globalThis);
