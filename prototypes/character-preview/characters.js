// Three new Mibo concepts. Same teaching job as the current puppet:
// big readable mouth, visible teeth + tongue, front-facing, no beak.
// Hand-drawn timing from PROJECT #46: body held at 6 fps, mouth swaps
// faster over the held body, pencil lines boil at 3 fps.
'use strict';

function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function j(seed, i, amt) { return (hash(seed * 91 + i * 17) - 0.5) * 2 * amt; }

// A wobbly closed shape: points around a centre, jittered by the boil seed.
function blob(ctx, cx, cy, pts, boil, amt) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = cx + x + j(boil, i, amt), py = cy + y + j(boil + 40, i, amt);
    if (i === 0) ctx.moveTo(px, py);
    else {
      const [lx, ly] = pts[i - 1];
      ctx.quadraticCurveTo(cx + lx + j(boil, i - 1, amt), cy + ly + j(boil + 40, i - 1, amt), px, py);
    }
  });
  ctx.closePath();
}
function circlePts(rx, ry, n = 14, squash = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * rx, Math.sin(a) * ry + Math.abs(Math.cos(a)) * squash]);
  }
  return pts;
}
function paint(ctx, cx, cy, pts, boil, fill, ink) {
  blob(ctx, cx, cy, pts, boil, 3); ctx.fillStyle = fill; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
  blob(ctx, cx + 4, cy + 5, pts, boil + 7, 4); ctx.fillStyle = fill; ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
  blob(ctx, cx, cy, pts, boil, 3); ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
  blob(ctx, cx, cy, pts, boil + 99, 4); ctx.strokeStyle = ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.6; ctx.stroke(); ctx.globalAlpha = 1;
}
function hatch(ctx, x, y, n, boil, ink) {
  ctx.strokeStyle = ink; ctx.globalAlpha = 0.16; ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const hx = x + j(boil, i + 200, 26), hy = y + i * 9 + j(boil, i + 300, 3);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 22 + j(boil, i, 6), hy + 4); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function eye(ctx, x, y, r, blink, look, ink) {
  const h = blink ? r * 0.12 : r;
  ctx.beginPath(); ctx.ellipse(x, y, r, h, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 3.5; ctx.stroke();
  if (!blink) {
    ctx.beginPath(); ctx.arc(x + look * r * 0.35, y + r * 0.1, r * 0.48, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
    ctx.beginPath(); ctx.arc(x + look * r * 0.35 + r * 0.18, y - r * 0.12, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  }
}
function brows(ctx, x, y, w, raise, ink) {
  ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
  [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(x + s * w - 18, y - raise); ctx.quadraticCurveTo(x + s * w, y - 12 - raise, x + s * w + 18, y - raise); ctx.stroke(); });
}
// Mouth: w/h in px, teeth 0..1, tongue 'none'|'out'|'up', round 0..1
const MOUTHS = {
  rest: { label: 'rest', w: 54, h: 10, teeth: 0, tongue: 'none' },
  s:    { label: 'sss — sun', w: 96, h: 20, teeth: 1, tongue: 'none' },
  th:   { label: 'th — thumb', w: 84, h: 26, teeth: 0.7, tongue: 'out' },
  ee:   { label: 'ee — sheep', w: 102, h: 26, teeth: 1, tongue: 'none' },
  ah:   { label: 'ah — hat', w: 82, h: 66, teeth: 0.35, tongue: 'none' },
  oo:   { label: 'oo — zoo', w: 44, h: 38, teeth: 0, tongue: 'none' },
  sh:   { label: 'sh — shoe', w: 62, h: 42, teeth: 0.6, tongue: 'none' },
  l:    { label: 'l — log', w: 78, h: 52, teeth: 0.4, tongue: 'up' },
};
const TALK = ['rest', 's', 's', 'ee', 'ah', 'th', 'oo', 'sh', 'l', 'rest'];
function mouth(ctx, x, y, m, ink) {
  ctx.beginPath(); ctx.ellipse(x, y, m.w / 2, Math.max(m.h / 2, 6), 0, 0, Math.PI * 2);
  ctx.fillStyle = '#7c2d3e'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 3.5; ctx.stroke();
  if (m.teeth > 0) {
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#fffbeF';
    ctx.fillRect(x - m.w / 2, y - m.h / 2, m.w, m.h * 0.42 * m.teeth);
    ctx.fillRect(x - m.w / 2, y + m.h / 2 - m.h * 0.34 * m.teeth, m.w, m.h * 0.34 * m.teeth);
    ctx.strokeStyle = 'rgba(60,40,45,.35)'; ctx.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * m.w * 0.22, y - m.h / 2); ctx.lineTo(x + i * m.w * 0.22, y - m.h * 0.08); ctx.stroke(); }
    ctx.restore();
  }
  if (m.tongue === 'out') {
    ctx.beginPath(); ctx.ellipse(x, y + m.h * 0.42, m.w * 0.26, m.h * 0.34, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ef7d9b'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
  } else if (m.tongue === 'up') {
    ctx.beginPath(); ctx.ellipse(x, y - m.h * 0.22, m.w * 0.2, m.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ef7d9b'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
  } else if (m.h > 34) {
    ctx.beginPath(); ctx.ellipse(x, y + m.h * 0.28, m.w * 0.3, m.h * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ef7d9b'; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
  }
}
function cheeks(ctx, x, y, spread) {
  ctx.fillStyle = '#f49bb4'; ctx.globalAlpha = 0.55;
  [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(x + s * spread, y, 17, 10, s * 0.3, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1;
}
function arm(ctx, x, y, len, angle, colour, ink, boil) {
  const ex = x + Math.sin(angle) * len, ey = y + Math.cos(angle) * len;
  ctx.strokeStyle = ink; ctx.lineWidth = 17; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.sin(angle) * len * 0.5 + j(boil, 5, 4), y + Math.cos(angle) * len * 0.55, ex, ey); ctx.stroke();
  ctx.strokeStyle = colour; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.sin(angle) * len * 0.5, y + Math.cos(angle) * len * 0.55, ex, ey); ctx.stroke();
  ctx.beginPath(); ctx.arc(ex, ey, 10, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.stroke();
}
// Shared pose from the held 6 fps motion frame + button-triggered action.
// action: null | 'wave' | 'hop' | 'cheer', actionT = seconds since it started.
function pose(frame, action, actionT) {
  const breathe = Math.sin(frame * 0.9) * 4;
  let hopY = 0, armL = 0.65, armR = -0.65, squash = 1 + Math.sin(frame * 0.9) * 0.015;
  if (action === 'wave') { armR = -2.35 + Math.sin(actionT * 10) * 0.45; }
  if (action === 'hop') { hopY = -Math.abs(Math.sin(Math.min(actionT * 4.2, Math.PI))) * 52; squash = 1 - Math.abs(Math.sin(Math.min(actionT * 4.2, Math.PI))) * 0.06; }
  if (action === 'cheer') { hopY = -Math.abs(Math.sin(Math.min(actionT * 5, Math.PI * 1.6))) * 62; armL = 2.5; armR = -2.5; }
  return { breathe, hopY, armL, armR, squash };
}

const INK = '#3d2b2b';

// --- A: Pudding Bear -------------------------------------------------------
// Squat honey bear. The cream muzzle IS the mouth stage: biggest, clearest
// mouth of the three, ears give an instant silhouette at app-icon size.
function drawBear(ctx, S) {
  const { boil, frame, m, blink, look } = S, p = pose(frame, S.action, S.actionT);
  const cx = 220, cy = 238 + p.breathe + p.hopY;
  ctx.save(); ctx.translate(cx, cy + 92); ctx.scale(1, p.squash); ctx.translate(-cx, -(cy + 92));
  [-1, 1].forEach(s => paint(ctx, cx + s * 88, cy - 108, circlePts(40, 38), boil + s, '#e8a35f', INK)); // ears
  [-1, 1].forEach(s => paint(ctx, cx + s * 88, cy - 108, circlePts(20, 18), boil + s + 3, '#f7d3a1', INK));
  paint(ctx, cx, cy, circlePts(118, 104, 16, 14), boil, '#f0b26b', INK); // body
  hatch(ctx, cx - 82, cy + 18, 5, boil, INK);
  paint(ctx, cx, cy + 52, circlePts(66, 46), boil + 5, '#fbe3bb', INK); // belly
  arm(ctx, cx - 104, cy + 6, 62, p.armL, '#f0b26b', INK, boil);
  arm(ctx, cx + 104, cy + 6, 62, p.armR, '#f0b26b', INK, boil);
  [-1, 1].forEach(s => paint(ctx, cx + s * 56, cy + 102, circlePts(30, 15), boil + s, '#e8a35f', INK)); // feet
  paint(ctx, cx, cy - 6, circlePts(108, 88, 16, 10), boil + 2, '#f0b26b', INK); // head
  paint(ctx, cx, cy + 24, circlePts(62, 44), boil + 8, '#fff3da', INK); // muzzle
  ctx.beginPath(); ctx.ellipse(cx, cy - 4, 15, 10, 0, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill(); // nose
  eye(ctx, cx - 38, cy - 34, 15, blink, look, INK); eye(ctx, cx + 38, cy - 34, 15, blink, look, INK);
  brows(ctx, cx, cy - 58, 38, S.mood === 'wow' ? 8 : 2, INK);
  cheeks(ctx, cx, cy + 8, 76);
  mouth(ctx, cx, cy + 32, m, INK);
  ctx.restore();
  if (S.action === 'cheer') stars(ctx, cx, cy, S.actionT, boil);
}

// --- B: Sprout Dragon ------------------------------------------------------
// Teal dragon with a sprout on its head, cream belly, stub wings and a
// curling tail. Horns/spikes read "dragon" without a snout or beak, so the
// flat big mouth (teeth + tongue) still works for s / th / l.
function drawDragon(ctx, S) {
  const { boil, frame, m, blink, look } = S, p = pose(frame, S.action, S.actionT);
  const cx = 220, cy = 242 + p.breathe + p.hopY;
  const wag = Math.sin(frame * 0.9) * 9;
  ctx.save(); ctx.translate(cx, cy + 92); ctx.scale(1, p.squash); ctx.translate(-cx, -(cy + 92));
  ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = 'round'; // tail
  ctx.beginPath(); ctx.moveTo(cx + 96, cy + 72); ctx.quadraticCurveTo(cx + 158, cy + 78 + wag, cx + 142, cy + 22 + wag); ctx.stroke();
  ctx.strokeStyle = '#57b8a2'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(cx + 96, cy + 72); ctx.quadraticCurveTo(cx + 158, cy + 78 + wag, cx + 142, cy + 22 + wag); ctx.stroke();
  [-1, 1].forEach(s => { // stub wings
    ctx.beginPath(); ctx.moveTo(cx + s * 92, cy - 48); ctx.quadraticCurveTo(cx + s * 138, cy - 78 + Math.sin(frame + s) * 7, cx + s * 104, cy - 6); ctx.closePath();
    ctx.fillStyle = '#f28b82'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke();
  });
  [-1, 1].forEach(s => paint(ctx, cx + s * 62, cy - 128, [[0, 26], [13, -16], [24, 24]], boil + s, '#ffe6a7', INK)); // horns
  paint(ctx, cx, cy, circlePts(104, 100, 16, 16), boil, '#57b8a2', INK); // body
  for (let i = 0; i < 3; i++) paint(ctx, cx, cy - 118 + i * 4, [[-13, 12], [0, -15 - i * 2], [13, 12]], boil + i, '#f5b921', INK); // back spikes peeking
  paint(ctx, cx, cy + 46, circlePts(56, 52), boil + 5, '#eaf7ee', INK); // belly
  ctx.strokeStyle = 'rgba(61,43,43,.3)'; ctx.lineWidth = 2;
  [-18, 6, 30].forEach(dy => { ctx.beginPath(); ctx.arc(cx, cy + dy, 44, 0.35, Math.PI - 0.35); ctx.stroke(); });
  arm(ctx, cx - 92, cy + 10, 58, p.armL, '#57b8a2', INK, boil);
  arm(ctx, cx + 92, cy + 10, 58, p.armR, '#57b8a2', INK, boil);
  [-1, 1].forEach(s => paint(ctx, cx + s * 50, cy + 100, circlePts(28, 14), boil + s, '#57b8a2', INK));
  // sprout
  ctx.strokeStyle = '#3e7d4e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy - 100); ctx.quadraticCurveTo(cx + 4, cy - 122, cx + 2, cy - 132); ctx.stroke();
  [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(cx + s * 17, cy - 136, 19, 9, s * 0.55, 0, Math.PI * 2); ctx.fillStyle = '#7bc47f'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(); });
  eye(ctx, cx - 36, cy - 36, 16, blink, look, INK); eye(ctx, cx + 36, cy - 36, 16, blink, look, INK);
  brows(ctx, cx, cy - 62, 36, S.mood === 'wow' ? 8 : 2, INK);
  cheeks(ctx, cx, cy + 2, 72);
  mouth(ctx, cx, cy + 26, m, INK);
  ctx.restore();
  if (S.action === 'cheer') stars(ctx, cx, cy, S.actionT, boil);
}

// --- C: Cloud Sheep --------------------------------------------------------
// A walking cloud: wool made of overlapping puffs, peach face in the middle,
// droopy ears, tiny dark legs. Softest silhouette; the face patch keeps the
// mouth large and high-contrast even though the body is pale.
function drawSheep(ctx, S) {
  const { boil, frame, m, blink, look } = S, p = pose(frame, S.action, S.actionT);
  const cx = 220, cy = 240 + p.breathe + p.hopY;
  ctx.save(); ctx.translate(cx, cy + 92); ctx.scale(1, p.squash); ctx.translate(-cx, -(cy + 92));
  [-1, 1].forEach(s => paint(ctx, cx + s * 42, cy + 96, circlePts(13, 24), boil + s, '#5b4a5a', INK)); // legs
  arm(ctx, cx - 100, cy + 22, 52, p.armL, '#fdfbf5', INK, boil);
  arm(ctx, cx + 100, cy + 22, 52, p.armR, '#fdfbf5', INK, boil);
  const puffs = [[-78, 6, 52], [-44, -52, 58], [8, -68, 64], [58, -48, 56], [82, 8, 50], [38, 38, 58], [-38, 40, 58], [0, -8, 72]];
  puffs.forEach(([x, y, r], i) => paint(ctx, cx + x, cy + y, circlePts(r, r * 0.86), boil + i * 3, i % 2 ? '#fdfbf5' : '#f3ede0', INK));
  hatch(ctx, cx - 96, cy + 44, 4, boil, INK);
  [-1, 1].forEach(s => paint(ctx, cx + s * 74, cy - 34, circlePts(15, 30), boil + s + 4, '#f6c9a0', INK)); // ears
  paint(ctx, cx, cy - 6, circlePts(66, 58, 14, 6), boil + 6, '#ffd9b3', INK); // face
  paint(ctx, cx, cy - 66, circlePts(40, 20), boil + 9, '#fdfbf5', INK); // wool tuft
  eye(ctx, cx - 28, cy - 20, 13, blink, look, INK); eye(ctx, cx + 28, cy - 20, 13, blink, look, INK);
  brows(ctx, cx, cy - 40, 28, S.mood === 'wow' ? 7 : 2, INK);
  cheeks(ctx, cx, cy + 10, 56);
  mouth(ctx, cx, cy + 22, m, INK);
  ctx.restore();
  if (S.action === 'cheer') stars(ctx, cx, cy, S.actionT, boil);
}

function stars(ctx, cx, cy, t, boil) {
  ctx.fillStyle = '#f5b921';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + t, r = 118 + Math.sin(t * 3 + i) * 10;
    const x = cx + Math.cos(a) * r, y = cy - 30 + Math.sin(a) * r * 0.72;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + t); ctx.globalAlpha = 0.9;
    ctx.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? 5 : 12, aa = k * Math.PI / 5; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
}

const DESIGNS = { bear: drawBear, dragon: drawDragon, sheep: drawSheep };
