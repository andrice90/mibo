/* Mibo puppet: a parametric, code-drawn Mibo.
 *
 * Three layers, kept apart so they port to React Native Skia + Reanimated:
 *   1. Rig      drawMibo(ctx, P)   pure: a flat parameter object -> canvas drawing
 *   2. Presets  VISEMES, MOODS     plain data: parameter targets
 *   3. Puppet   puppet.update(dt)  springs + idle life + one-shot moves + talking
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
  L: { root: [-330, -405], len: 235, w: 104, side: -1 },  // front arm, resting on the belly
  R: { root: [452, -335], len: 228, w: 104, side: 1 },    // side arm
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
  sh: { mw: 215, mh: 115, round: 0.75, square: 0.3, teethTop: 1, teethBot: 1 },
  th: { mw: 235, mh: 72, smile: 0.2, teethTop: 0.8, teethBot: 0.5, tongueOut: 1 },
  f: { mw: 235, mh: 32, smile: 0.15, teethTop: 1, bite: 1 },
  l: { mw: 225, mh: 150, smile: 0.2, teethTop: 0.5, tongueUp: 1 },
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

// ------------------------------------------------------------------ rig

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

function smoothClosed(pts) {
  const p = new Path2D(), n = pts.length;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  p.closePath();
  return p;
}

function armPaths(arm, angleDeg, bend, d) {
  // The front arm slides out to the body edge as it lifts, so raised arms clear the body.
  const lift = arm.side < 0 ? clamp((angleDeg - 20) / 100, 0, 1) : 0;
  const rootPt = d(lerp(arm.root[0], -425, lift), lerp(arm.root[1], -450, lift));
  const a = angleDeg * Math.PI / 180;
  const dir = [Math.sin(a) * arm.side, Math.cos(a)];
  const nrm = [-dir[1], dir[0]];
  const N = 8, left = [], right = [], center = [];
  const curl = bend * arm.len * 0.35 * arm.side;  // positive bend curls the tip inward
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const off = curl * u * u;
    center.push([rootPt[0] + dir[0] * arm.len * u + nrm[0] * off,
      rootPt[1] + dir[1] * arm.len * u + nrm[1] * off]);
  }
  for (let i = 0; i <= N; i++) {
    const a0 = center[Math.max(0, i - 1)], a1 = center[Math.min(N, i + 1)];
    let tx = a1[0] - a0[0], ty = a1[1] - a0[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const hw = arm.w * (1 - 0.16 * (i / N)) / 2;
    left.push([center[i][0] - ty * hw, center[i][1] + tx * hw]);
    right.push([center[i][0] + ty * hw, center[i][1] - tx * hw]);
  }
  const tip = center[N], last = left[N];
  const capStart = Math.atan2(last[1] - tip[1], last[0] - tip[0]);
  const hwTip = arm.w * 0.84 / 2;
  const trace = (p, closed) => {
    p.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i <= N; i++) p.lineTo(left[i][0], left[i][1]);
    // left side -> forward -> right side is a decreasing angle on a y-down canvas
    p.arc(tip[0], tip[1], hwTip, capStart, capStart - Math.PI, true);
    for (let i = N; i >= 0; i--) p.lineTo(right[i][0], right[i][1]);
    if (closed) p.closePath();
  };
  const closed = new Path2D(); trace(closed, true);
  const open = new Path2D(); trace(open, false);
  return { closed, open, tip };
}

function drawEye(ctx, cx, cy, r, sx, sy, E) {
  const rx = r * sx, ryFull = r * sy, ry = ryFull * clamp(E.open, 0, 1.2);
  ctx.save();
  if (E.open < 0.14) {
    // closed: a little curve; upside-down when happy
    const bow = ryFull * 0.3 * (E.happy > 0.4 ? -1 : 1);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.8, cy);
    ctx.quadraticCurveTo(cx, cy + bow, cx + rx * 0.8, cy);
    ctx.lineWidth = r * 0.17; ctx.strokeStyle = COLORS.eye; ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (E.happy > 0.01) {
    // cheeks push up: cut the eye with a wide ellipse from below -> smiling eye arcs
    const hp = new Path2D();
    hp.rect(cx - rx * 2, cy - ry * 2, rx * 4, ry * 4);
    hp.ellipse(cx, cy + ry + ry * (1.25 - 1.8 * E.happy), rx * 1.35, ry * 1.25, 0, 0, TAU);
    ctx.clip(hp, 'evenodd');
  }
  if (E.topLid > 0.01) {
    const yl = cy - ry + 2 * ry * E.topLid * 0.9;
    const lp = new Path2D();
    lp.rect(cx - rx * 2, yl, rx * 4, ry * 4);
    ctx.clip(lp);
  }
  const eye = new Path2D();
  eye.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fillStyle = COLORS.eye; ctx.fill(eye);
  ctx.clip(eye);
  ctx.fillStyle = COLORS.eyeLow;
  ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.45, rx * 0.7, ry * 0.42, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  const gx = -E.lookX * rx * 0.06;
  ctx.beginPath(); ctx.arc(cx - rx * 0.3 + gx, cy - ry * 0.3, rx * 0.24 * E.sparkle, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + rx * 0.34 + gx, cy - ry * 0.34, rx * 0.11 * E.sparkle, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawBrow(ctx, ex, ey, r, sx, sy, inner, raise, angle, LW) {
  // inner = +1 when the face centre is to the right of this eye
  const by = ey - r * 1.5 * sy - raise * 62 * sy;
  const half = 58 * sx, tiltY = angle * 30 * sy;
  ctx.beginPath();
  ctx.moveTo(ex - inner * half, by + tiltY * 0.6);
  ctx.quadraticCurveTo(ex, by - 16 * sy - tiltY * 0.2, ex + inner * half, by - tiltY);
  ctx.lineWidth = LW * 1.35; ctx.strokeStyle = COLORS.outline; ctx.lineCap = 'round';
  ctx.stroke();
}

function mouthOutline(P, k, sx, sy) {
  const w = P.mw * k * sx, h = Math.max(0, P.mh) * k * sy;
  const round = clamp(P.round, 0, 1), sq = clamp(P.square, 0, 1);
  const we = w * (1 - 0.5 * round);
  const pexp = 2 + sq * 3;
  const topR = 0.38 - 0.1 * round;
  const lift = P.smile * we * 0.2;
  const path = new Path2D(), N = 64;
  for (let i = 0; i <= N; i++) {
    const t = i / N * TAU, c = Math.cos(t), s = Math.sin(t);
    const ex = Math.sign(c) * Math.abs(c) ** (2 / pexp);
    const ey = Math.sign(s) * Math.abs(s) ** (2 / pexp);
    const x = ex * we / 2;
    const y = (s < 0 ? ey * h * topR : ey * h * (1 - topR)) - lift * ex * ex;
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  path.closePath();
  return { path, we, h, topR, lift };
}

function drawMouth(ctx, cx, cy, sx, sy, P, LW) {
  const k = P.mouthBoost;
  const M = mouthOutline(P, k, sx, sy);
  const { we, h, topR, lift } = M;
  const yTop = -h * topR, yBot = h * (1 - topR);
  const band = (y, dir) => {
    // a teeth band whose free edge follows the smile curve
    const p = new Path2D(), far = y + dir * 400;
    p.moveTo(-we, far);
    p.lineTo(-we, y - lift); p.lineTo(-we / 2, y - lift);
    p.quadraticCurveTo(0, y + lift, we / 2, y - lift);
    p.lineTo(we, y - lift); p.lineTo(we, far);
    p.closePath();
    return p;
  };
  ctx.save();
  ctx.translate(cx + P.mx * k * sx, cy);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const ttop = yTop + clamp(P.teethTop, 0, 1) * h * 0.5;
  if (h > 1) {
    ctx.save();
    ctx.fillStyle = COLORS.mouth; ctx.fill(M.path);
    ctx.clip(M.path);
    if (h > 24) {
      ctx.fillStyle = COLORS.tongue;
      ctx.beginPath();
      ctx.ellipse(0, yBot - h * 0.16 - clamp(P.tongueUp, 0, 1) * h * 0.42, we * 0.3, h * 0.33, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.teeth;
    if (P.teethTop > 0.01) ctx.fill(band(ttop, -1));
    if (P.teethBot > 0.01) ctx.fill(band(yBot - clamp(P.teethBot, 0, 1) * h * 0.5, 1));
    if (P.teethTop > 0.8 && P.teethBot > 0.8 && h > 8) {
      ctx.strokeStyle = 'rgba(60,40,45,0.35)'; ctx.lineWidth = LW * 0.35;
      ctx.beginPath(); ctx.moveTo(-we / 2, ttop - lift); ctx.quadraticCurveTo(0, ttop + lift, we / 2, ttop - lift); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.strokeStyle = COLORS.outline; ctx.lineWidth = LW * 0.95;
  ctx.stroke(M.path);
  if (P.tongueOut > 0.02 && h > 6) {
    // /th/: tongue tip slides out from under the top teeth, over the lower lip
    ctx.save();
    const cl = new Path2D(); cl.rect(-we, ttop + 2, we * 2, 600); ctx.clip(cl);
    const ry = (24 + 22 * P.tongueOut) * k * sy;
    const tp = new Path2D(); tp.ellipse(0, yBot + ry * 0.15, we * 0.21, ry, 0, 0, TAU);
    ctx.fillStyle = COLORS.tongue; ctx.fill(tp);
    ctx.lineWidth = LW * 0.7; ctx.stroke(tp);
    ctx.strokeStyle = 'rgba(150,40,70,0.5)'; ctx.lineWidth = LW * 0.35;
    ctx.beginPath(); ctx.moveTo(0, yBot - ry * 0.3); ctx.lineTo(0, yBot + ry * 0.5); ctx.stroke();
    ctx.restore();
  }
  if (P.bite > 0.02) {
    // /f/: top teeth rest on the lower lip
    const bw = we * 0.34, y0 = yTop - 4, y1 = yBot + 16 * P.bite * k * sy;
    const tp = new Path2D();
    tp.moveTo(-bw, y0); tp.lineTo(-bw, y1 - 8); tp.quadraticCurveTo(-bw, y1, -bw + 8, y1);
    tp.lineTo(bw - 8, y1); tp.quadraticCurveTo(bw, y1, bw, y1 - 8); tp.lineTo(bw, y0);
    ctx.fillStyle = COLORS.teeth; ctx.fill(tp);
    ctx.strokeStyle = COLORS.outline; ctx.lineWidth = LW * 0.6; ctx.stroke(tp);
  }
  ctx.restore();
}

function drawShadow(ctx, P) {
  const lift = clamp(-P.y / 500, 0, 1);
  const w = 470 * (1 + (1 - P.sy) * 0.9) * (1 + P.spread * 0.6) * (1 - lift * 0.45);
  ctx.fillStyle = `rgba(${COLORS.shadow},${0.18 * (1 - lift * 0.6)})`;
  ctx.beginPath(); ctx.ellipse(P.x, 12, w, 42 * (1 - lift * 0.4), 0, 0, TAU); ctx.fill();
}

/** Draw Mibo for parameter set P in character space (ground at y = 0). */
function drawMibo(ctx, P, opts = {}) {
  const LW = opts.outline || 13;
  drawShadow(ctx, P);
  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.translate(0, -470); ctx.rotate(P.tilt * Math.PI / 180); ctx.translate(0, 470);
  const d = bodyDeformer(P);
  const body = smoothClosed(BODY.map(p => d(p[0], p[1])));
  const armR = armPaths(ARMS.R, P.armR, P.armRBend, d);
  const armL = armPaths(ARMS.L, P.armL, P.armLBend, d);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // Outline pass then fill pass: body and arms merge into one gooey silhouette.
  ctx.strokeStyle = COLORS.outline; ctx.lineWidth = LW * 2;
  ctx.stroke(armR.closed); ctx.stroke(body); ctx.stroke(armL.closed);
  ctx.fillStyle = COLORS.body;
  ctx.fill(armR.closed); ctx.fill(body); ctx.fill(armL.closed);

  // Soft shading and the glossy highlight, all riding the deformation.
  // Each part is shaded under its own clip: a union clip would leave holes
  // where the arm and body paths wind in opposite directions.
  const top = d(0, -990), bot = d(0, 0), sc = d(520, -260);
  const g = ctx.createLinearGradient(top[0], top[1], bot[0], bot[1]);
  g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(18,140,95,0.24)');
  const rg = ctx.createRadialGradient(sc[0], sc[1], 40, sc[0], sc[1], 560);
  rg.addColorStop(0, 'rgba(18,140,95,0.2)'); rg.addColorStop(1, 'rgba(18,140,95,0)');
  const outsideBody = new Path2D(); outsideBody.rect(-3000, -3000, 6000, 6000); outsideBody.addPath(body);
  for (const part of [armR.closed, body, armL.closed]) {
    ctx.save(); ctx.clip(part);
    if (part !== body) ctx.clip(outsideBody, 'evenodd');  // arms only where they leave the body
    ctx.fillStyle = g; ctx.fillRect(-1400, -1600, 2800, 1800);
    ctx.fillStyle = rg; ctx.fillRect(-1400, -1600, 2800, 1800);
    ctx.restore();
  }

  const glint = FACE.glint.map(p => d(p[0] - P.lookX * 10, p[1]));
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 36;
  ctx.beginPath(); ctx.moveTo(glint[0][0], glint[0][1]);
  ctx.bezierCurveTo(glint[1][0], glint[1][1], glint[2][0], glint[2][1], glint[3][0], glint[3][1]);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 14; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const dot = d(FACE.dot[0], FACE.dot[1]);
  ctx.beginPath(); ctx.arc(dot[0], dot[1], 19, 0, TAU); ctx.fill();
  const lg = d(FACE.lowGlint[0], FACE.lowGlint[1]);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(lg[0], lg[1], 11, 18, 0.3, 0, TAU); ctx.fill();

  // Front arm: its contour shows where it lies over the belly.
  ctx.save(); ctx.clip(body);
  ctx.strokeStyle = COLORS.outline; ctx.lineWidth = LW; ctx.stroke(armL.open);
  ctx.restore();

  // Face. Features shift with the gaze (parallax) and ride the body deformation.
  const feat = (pt, px, py) => d(pt[0] + P.lookX * px, pt[1] + P.lookY * py);
  const [fsx, fsy] = d.scaleAt(-605);
  for (const [pt, side] of [[FACE.blushL, -1], [FACE.blushR, 1]]) {
    const [bx, by] = feat(pt, 36, 22);
    const a = clamp(P.blush, 0, 1);
    const rg2 = ctx.createRadialGradient(bx, by - P.happy * 10, 5, bx, by - P.happy * 10, 72 * fsx);
    rg2.addColorStop(0, `rgba(${COLORS.blush},${0.75 * a})`);
    rg2.addColorStop(0.6, `rgba(${COLORS.blush},${0.45 * a})`);
    rg2.addColorStop(1, `rgba(${COLORS.blush},0)`);
    ctx.fillStyle = rg2;
    ctx.beginPath(); ctx.ellipse(bx, by - P.happy * 10, 78 * fsx, 42 * fsy, 0, 0, TAU); ctx.fill();
  }
  const r = FACE.eyeR0 * P.eyeScale;
  const eyes = [[FACE.eyeL, P.winkL, 1, -1], [FACE.eyeR, P.winkR, -1, 1]];
  for (const [pt, wink, inner, side] of eyes) {
    const [ex, ey] = feat(pt, 42, 30);
    drawEye(ctx, ex, ey, r, fsx, fsy, {
      open: P.open * (1 - clamp(wink, 0, 1)), happy: clamp(P.happy, 0, 1), topLid: clamp(P.topLid, 0, 1),
      sparkle: P.sparkle, lookX: P.lookX,
    });
    if (opts.brows !== false) {
      drawBrow(ctx, ex, ey, r, fsx, fsy, inner, P.browRaise + P.browAsym * side * 0.6, P.browAngle, LW);
    }
  }
  const [mx, my] = feat(FACE.mouth, 52, 32);
  const [msx, msy] = d.scaleAt(-450);
  drawMouth(ctx, mx, my, msx * (opts.mouthScale || 1), msy * (opts.mouthScale || 1), P, LW);
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
        const pick = ['glance', 'sway', 'minihop', 'armswing', 'hum', 'blinkdouble'];
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

function drawParticles(ctx, parts) {
  for (const p of parts) {
    const a = clamp(p.ttl / Math.min(p.max, 0.6), 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.kind === 'confetti') ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    else if (p.kind === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? p.size * 0.45 : p.size, t = i / 10 * TAU - Math.PI / 2;
        ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r);
      }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.rotate(-p.rot); const s = p.size;
      ctx.beginPath(); ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.4, -s, 0, -s * 0.45);
      ctx.bezierCurveTo(s * 0.4, -s, s, -s * 0.3, 0, s * 0.35);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Thought dots and "I'm listening" waves, faded in by P.think / P.listen. */
function drawFx(ctx, P, t, accent) {
  const th = clamp(P.think, 0, 1), li = clamp(P.listen, 0, 1);
  if (th > 0.02) {
    const dots = [[300, -1050, 22], [385, -1125, 30], [490, -1215, 40]];
    dots.forEach(([x, y, r], i) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5 - i * 0.9);
      ctx.globalAlpha = th * (0.35 + 0.65 * pulse);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = COLORS.outline; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(P.x + x, P.y + y - pulse * 8, r * (0.9 + pulse * 0.15), 0, TAU); ctx.fill(); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }
  if (li > 0.02) {
    ctx.lineCap = 'round'; ctx.strokeStyle = accent; ctx.lineWidth = 14;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i / 3) % 1;
        ctx.globalAlpha = li * (1 - ph) * 0.9;
        const r = 70 + ph * 120;
        const cx = P.x + side * 520, cy = P.y - 640;
        ctx.beginPath();
        ctx.arc(cx, cy, r, side > 0 ? -0.6 : Math.PI - 0.6, side > 0 ? 0.6 : Math.PI + 0.6);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

root.Mibo = { DEFAULTS, VISEMES, TEACHING, MOODS, ACTIONS, MOUTH_KEYS, drawMibo, drawParticles, drawFx, textToVisemes, Puppet };
})(typeof window !== 'undefined' ? window : globalThis);
