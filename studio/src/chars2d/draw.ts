// 2D "cartoon character in a 3D world" renderer.
// Characters are drawn with canvas vector paths every frame: big oval head, thick ink,
// rubber-hose stick limbs, shaded costume, expressive face, squash & stretch.
// Char space: x right, y UP, origin between the feet. ~1000 units tall.

export type Expr = 'neutral' | 'angry' | 'happy' | 'sad' | 'shock' | 'smug' | 'scared' | 'cry';

export type Costume =
  | {kind: 'doom'; bot?: boolean}
  | {kind: 'guard'}
  | {kind: 'baron'}
  | {kind: 'peasant'; shirt: string; pants?: string; hat?: string | null; hair?: string | null; beard?: string | null}
  | {kind: 'mother'}
  | {kind: 'father'}
  | {kind: 'villager'; shawl: string; dress: string; hair?: string};

export type Pose2D = {
  t: number;
  walk?: number; // phase radians
  stride?: number; // 0..1 (1.6 run)
  talk?: number; // 0..1 mouth openness
  expr?: Expr;
  look?: number; // -1..1 eyes/face turn
  tilt?: number; // head tilt radians
  armL?: number; // shoulder angle (0 = down, + = out to the side / up)
  armR?: number;
  bendL?: number; // elbow bend -1..1
  bendR?: number;
  wind?: number;
  eyeGlow?: number; // doom
  holdSpear?: boolean;
  holdBaby?: boolean;
  crouch?: number;
  breathe?: number;
};

const INK = '#0b0b0f';

type C = CanvasRenderingContext2D;

const ell = (c: C, x: number, y: number, rx: number, ry: number, rot = 0) => {
  c.beginPath();
  c.ellipse(x, -y, rx, ry, rot, 0, Math.PI * 2);
};

const INK_SCALE = 1.4;
const fillStroke = (c: C, fill: string | CanvasGradient, lw = 9) => {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw * INK_SCALE;
  c.strokeStyle = INK;
  c.stroke();
};

const lin = (c: C, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => {
  const g = c.createLinearGradient(x0, -y0, x1, -y1);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  return g;
};
const rad = (c: C, x: number, y: number, r0: number, r1: number, stops: [number, string][], ox = 0, oy = 0) => {
  const g = c.createRadialGradient(x + ox, -(y + oy), r0, x, -y, r1);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  return g;
};

/** rubber-hose limb from (x0,y0) to (x1,y1) bowing by `bend` */
const hose = (c: C, x0: number, y0: number, x1: number, y1: number, bend: number, lw: number, color = INK, inner?: string) => {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bend * len * 0.35;
  const cy = my + (dx / len) * bend * len * 0.35;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x0, -y0);
  c.quadraticCurveTo(cx, -cy, x1, -y1);
  if (inner) {
    c.lineWidth = lw + 13;
    c.strokeStyle = INK;
    c.stroke();
  }
  c.lineWidth = inner ? lw : lw * 1.25;
  c.strokeStyle = color;
  c.stroke();
  if (inner) {
    c.lineWidth = lw * 0.32;
    c.strokeStyle = inner;
    c.beginPath();
    c.moveTo(x0 - 3, -y0 - 3);
    c.quadraticCurveTo(cx - 3, -cy - 3, x1 - 3, -y1 - 3);
    c.stroke();
  }
};

const bean = (c: C, cx: number, y0: number, h: number, wTop: number, wBot: number) => {
  // torso shape: rounded top, fuller bottom
  const t = y0 + h;
  c.beginPath();
  c.moveTo(cx - wTop / 2, -(t - 40));
  c.bezierCurveTo(cx - wTop / 2, -(t + 15), cx + wTop / 2, -(t + 15), cx + wTop / 2, -(t - 40));
  c.bezierCurveTo(cx + wTop / 2 + 10, -(t - h * 0.45), cx + wBot / 2 + 6, -(y0 + 30), cx + wBot / 2 - 16, -y0);
  c.bezierCurveTo(cx + wBot / 4, -(y0 - 14), cx - wBot / 4, -(y0 - 14), cx - wBot / 2 + 16, -y0);
  c.bezierCurveTo(cx - wBot / 2 - 6, -(y0 + 30), cx - wTop / 2 - 10, -(t - h * 0.45), cx - wTop / 2, -(t - 40));
  c.closePath();
};

// ---------------------------------------------------------------- faces
const humanFace = (c: C, hx: number, hy: number, rx: number, ry: number, p: Pose2D, blink: boolean, opts: {brows?: string; mustache?: string | null} = {}) => {
  const e = p.expr ?? 'neutral';
  const lk = (p.look ?? 0) * rx * 0.22;
  const ex = 0.36 * rx, ey = hy + ry * 0.12;
  const er = e === 'shock' || e === 'scared' ? rx * 0.24 : rx * 0.19;
  for (const sd of [-1, 1]) {
    const x = hx + lk + sd * ex;
    if (blink) {
      c.beginPath();
      c.moveTo(x - er, -ey);
      c.quadraticCurveTo(x, -(ey - er * 0.5), x + er, -ey);
      c.lineWidth = 7;
      c.strokeStyle = INK;
      c.stroke();
    } else if (e === 'happy') {
      c.beginPath();
      c.moveTo(x - er, -(ey - er * 0.2));
      c.quadraticCurveTo(x, -(ey + er * 1.1), x + er, -(ey - er * 0.2));
      c.lineWidth = 8;
      c.strokeStyle = INK;
      c.stroke();
    } else {
      ell(c, x, ey, er, er * 1.08);
      fillStroke(c, '#fbfaf6', 6.5);
      const pr = e === 'shock' || e === 'scared' ? er * 0.3 : er * 0.42;
      ell(c, x + lk * 0.35, ey - er * 0.05, pr, pr);
      c.fillStyle = INK;
      c.fill();
      ell(c, x + lk * 0.35 - pr * 0.35, ey + pr * 0.4, pr * 0.3, pr * 0.3);
      c.fillStyle = '#fff';
      c.fill();
    }
    // brows
    const by = ey + er + 18;
    const ang = e === 'angry' ? -0.45 : e === 'sad' || e === 'scared' || e === 'cry' ? 0.4 : e === 'smug' ? (sd > 0 ? -0.25 : 0.1) : e === 'shock' ? 0 : 0.05;
    c.save();
    c.translate(x, -(by + (e === 'shock' ? 14 : 0)));
    c.rotate(ang * sd);
    c.beginPath();
    c.moveTo(-er * 1.1, 0);
    c.quadraticCurveTo(0, -8, er * 1.1, 0);
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.strokeStyle = opts.brows ?? INK;
    c.stroke();
    c.restore();
  }
  // mouth
  const mx = hx + lk * 1.1, my = hy - ry * 0.42;
  const open = p.talk ?? 0;
  c.lineCap = 'round';
  if (open > 0.08 || e === 'shock' || e === 'scared') {
    const o = Math.max(open, e === 'shock' ? 0.7 : e === 'scared' ? 0.5 : 0);
    const w = rx * (e === 'happy' ? 0.42 : 0.3);
    c.beginPath();
    c.moveTo(mx - w, -(my + 4));
    c.quadraticCurveTo(mx, -(my + 4 - (e === 'sad' ? -10 : 6)), mx + w, -(my + 4));
    c.quadraticCurveTo(mx + w * 0.6, -(my - 40 * o - 6), mx, -(my - 46 * o - 6));
    c.quadraticCurveTo(mx - w * 0.6, -(my - 40 * o - 6), mx - w, -(my + 4));
    c.closePath();
    fillStroke(c, '#3a1014', 7);
    // tongue
    ell(c, mx, my - 30 * o, w * 0.45, 9 * o + 2);
    c.fillStyle = '#c2464e';
    c.fill();
  } else {
    const curve = e === 'happy' || e === 'smug' ? 22 : e === 'sad' || e === 'cry' ? -16 : e === 'angry' ? -6 : 4;
    const w = rx * (e === 'happy' ? 0.36 : 0.22);
    c.beginPath();
    c.moveTo(mx - w, -(my + (e === 'smug' ? 6 : 0)));
    c.quadraticCurveTo(mx, -(my - curve), mx + w, -(my + (e === 'smug' ? 14 : 0)));
    c.lineWidth = 8;
    c.strokeStyle = INK;
    c.stroke();
  }
  if (opts.mustache) {
    c.fillStyle = opts.mustache;
    for (const sd of [-1, 1]) {
      c.beginPath();
      c.moveTo(mx, -(my + 22));
      c.quadraticCurveTo(mx + sd * 40, -(my + 34), mx + sd * 72, -(my + 8));
      c.quadraticCurveTo(mx + sd * 40, -(my + 14), mx, -(my + 12));
      c.closePath();
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = INK;
      c.stroke();
    }
  }
  if (e === 'cry') {
    c.fillStyle = 'rgba(120,190,255,0.9)';
    for (const sd of [-1, 1]) {
      const tx = hx + lk + sd * ex, ty = ey - er - ((p.t * 120) % 60);
      ell(c, tx, ty, 7, 11);
      c.fill();
    }
  }
};

const whiteHead = (c: C, hx: number, hy: number, rx: number, ry: number, tilt: number) => {
  c.save();
  c.translate(hx, -hy);
  c.rotate(tilt);
  c.translate(-hx, hy);
  ell(c, hx, hy, rx, ry);
  fillStroke(c, rad(c, hx, hy, rx * 0.1, rx * 1.15, [[0, '#ffffff'], [0.6, '#f1ece2'], [1, '#c9c0b0']], -rx * 0.35, ry * 0.4), 9);
};

// ---------------------------------------------------------------- Doom pieces
const doomMask = (c: C, hx: number, hy: number, rx: number, ry: number, p: Pose2D) => {
  const lk = (p.look ?? 0) * rx * 0.18;
  // mask plate
  ell(c, hx, hy, rx, ry);
  fillStroke(c, rad(c, hx, hy, rx * 0.05, rx * 1.2, [[0, '#f2f5f8'], [0.35, '#b7c0ca'], [0.8, '#6c7681'], [1, '#3e454d']], -rx * 0.4, ry * 0.45), 10);
  // jaw plate seam
  c.beginPath();
  c.moveTo(hx - rx * 0.86, -(hy - ry * 0.25));
  c.quadraticCurveTo(hx + lk, -(hy - ry * 0.55), hx + rx * 0.86, -(hy - ry * 0.25));
  c.lineWidth = 5;
  c.strokeStyle = 'rgba(20,24,30,0.7)';
  c.stroke();
  // brow ridge
  c.beginPath();
  c.moveTo(hx + lk - rx * 0.78, -(hy + ry * 0.3));
  c.quadraticCurveTo(hx + lk, -(hy + ry * 0.12), hx + lk + rx * 0.78, -(hy + ry * 0.3));
  c.lineWidth = 17;
  c.strokeStyle = INK;
  c.stroke();
  c.lineWidth = 5;
  c.strokeStyle = 'rgba(255,255,255,0.6)';
  c.beginPath();
  c.moveTo(hx + lk - rx * 0.72, -(hy + ry * 0.36));
  c.quadraticCurveTo(hx + lk, -(hy + ry * 0.2), hx + lk + rx * 0.72, -(hy + ry * 0.36));
  c.stroke();
  // eye slits (angled = menacing)
  const g = p.eyeGlow ?? 0.8;
  for (const sd of [-1, 1]) {
    const x = hx + lk + sd * rx * 0.38, y = hy + ry * 0.08;
    c.save();
    c.translate(x, -y);
    c.rotate(sd * 0.16);
    c.beginPath();
    c.moveTo(-rx * 0.27, -6);
    c.lineTo(rx * 0.27, -14 * sd > 0 ? -2 : -2);
    c.lineTo(rx * 0.22, 14);
    c.lineTo(-rx * 0.24, 10);
    c.closePath();
    c.fillStyle = '#020303';
    c.fill();
    if (g > 0) {
      c.shadowColor = `rgba(90,255,120,${Math.min(1, g)})`;
      c.shadowBlur = 30 * g;
      ell(c, 0, -4, rx * 0.15, 5.5);
      c.fillStyle = `rgba(150,255,160,${Math.min(1, 0.4 + g)})`;
      c.fill();
      c.shadowBlur = 0;
    }
    c.restore();
  }
  // nose ridge
  c.beginPath();
  c.moveTo(hx + lk * 1.1, -(hy + ry * 0.05));
  c.lineTo(hx + lk * 1.2, -(hy - ry * 0.28));
  c.lineWidth = 9;
  c.strokeStyle = 'rgba(15,18,22,0.9)';
  c.stroke();
  // mouth grille
  for (let k = 0; k < 4; k++) {
    const y = hy - ry * 0.47 - k * 13;
    const w = rx * (0.34 - k * 0.04);
    c.beginPath();
    c.moveTo(hx + lk * 1.15 - w, -y);
    c.lineTo(hx + lk * 1.15 + w, -y);
    c.lineWidth = 9;
    c.strokeStyle = INK;
    c.stroke();
  }
  // rivets
  for (const sd of [-1, 1])
    for (const [ax, ay] of [[0.8, 0.15], [0.72, -0.3], [0.5, -0.66]]) {
      ell(c, hx + sd * rx * ax, hy + ry * ay, 7, 7);
      fillStroke(c, rad(c, hx + sd * rx * ax, hy + ry * ay, 1, 8, [[0, '#e8ecf0'], [1, '#5a626b']], -2, 2), 3);
    }
};

const hoodBack = (c: C, hx: number, hy: number, rx: number, ry: number, col: string, colD: string) => {
  c.beginPath();
  c.moveTo(hx - rx * 1.32, -(hy - ry * 1.2));
  c.bezierCurveTo(hx - rx * 1.55, -(hy + ry * 0.6), hx - rx * 0.9, -(hy + ry * 1.5), hx, -(hy + ry * 1.42));
  c.bezierCurveTo(hx + rx * 0.9, -(hy + ry * 1.5), hx + rx * 1.55, -(hy + ry * 0.6), hx + rx * 1.32, -(hy - ry * 1.2));
  c.closePath();
  fillStroke(c, lin(c, hx - rx, hy + ry, hx + rx, hy - ry, [[0, col], [1, colD]]), 10);
};
const hoodFront = (c: C, hx: number, hy: number, rx: number, ry: number, col: string, colD: string) => {
  // rim of the hood framing the mask
  c.beginPath();
  c.moveTo(hx - rx * 1.18, -(hy - ry * 1.0));
  c.bezierCurveTo(hx - rx * 1.3, -(hy + ry * 0.5), hx - rx * 0.8, -(hy + ry * 1.32), hx, -(hy + ry * 1.28));
  c.bezierCurveTo(hx + rx * 0.8, -(hy + ry * 1.32), hx + rx * 1.3, -(hy + ry * 0.5), hx + rx * 1.18, -(hy - ry * 1.0));
  c.lineTo(hx + rx * 0.95, -(hy - ry * 0.95));
  c.bezierCurveTo(hx + rx * 1.08, -(hy + ry * 0.4), hx + rx * 0.7, -(hy + ry * 1.02), hx, -(hy + ry * 1.0));
  c.bezierCurveTo(hx - rx * 0.7, -(hy + ry * 1.02), hx - rx * 1.08, -(hy + ry * 0.4), hx - rx * 0.95, -(hy - ry * 0.95));
  c.closePath();
  fillStroke(c, lin(c, hx - rx, hy + ry, hx + rx * 0.5, hy, [[0, col], [1, colD]]), 8);
  // fold line
  c.beginPath();
  c.moveTo(hx - rx * 0.2, -(hy + ry * 1.25));
  c.quadraticCurveTo(hx - rx * 0.05, -(hy + ry * 1.12), hx + rx * 0.1, -(hy + ry * 1.02));
  c.lineWidth = 4;
  c.strokeStyle = 'rgba(0,0,0,0.4)';
  c.stroke();
};

const cloak = (c: C, cx: number, shoulderY: number, p: Pose2D, col: string, colD: string) => {
  const t = p.t, w = (p.wind ?? 0.4) + (p.stride ?? 0) * 0.5;
  const top = shoulderY + 10;
  const n = 7;
  c.beginPath();
  c.moveTo(cx - 120, -top);
  c.bezierCurveTo(cx - 200 - w * 40, -(top - 220), cx - 250 - w * 60, -(top - 420), cx - 260 - w * 70, -(30 + Math.sin(t * 2.3) * 12));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = cx - 260 - w * 70 + u * (520 + w * 40);
    const y = 18 + Math.sin(t * 3 + u * 9) * (14 + w * 18) + (i % 2 ? 22 : 0);
    c.lineTo(x, -y);
  }
  c.bezierCurveTo(cx + 250, -(top - 420), cx + 200, -(top - 220), cx + 120, -top);
  c.closePath();
  fillStroke(c, lin(c, cx - 200, top, cx + 220, 0, [[0, col], [0.6, colD], [1, '#08180c']]), 10);
  // folds
  c.lineWidth = 5;
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  for (const fx of [-150, -60, 70, 160]) {
    c.beginPath();
    c.moveTo(cx + fx * 0.5, -(top - 60));
    c.quadraticCurveTo(cx + fx * 1.1 + Math.sin(t * 2 + fx) * 15, -(top - 300), cx + fx * 1.35 - w * 30, -60);
    c.stroke();
  }
};

// ---------------------------------------------------------------- main
export type DrawOpts = {costume: Costume; pose: Pose2D};

export const CANVAS_W = 1024;
export const CANVAS_H = 1280;
export const UNITS = 1150; // char-space height mapped to the canvas

/** Draw a character. ctx must be CANVAS_W x CANVAS_H. glowCtx (optional) receives emissive parts. */
export const drawCharacter = (ctx: C, o: DrawOpts, glowCtx?: C | null) => {
  const {costume: cos, pose: p} = o;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const k = (CANVAS_H - 70) / UNITS;
  const t = p.t;
  const st = p.stride ?? 0;
  const ph = p.walk ?? 0;
  // squash & stretch + bob (the "alive" wobble)
  const step = Math.abs(Math.sin(ph));
  const bob = st > 0.02 ? step * 22 * Math.min(st, 1.4) : Math.sin(t * 2.1) * 5;
  const squash = st > 0.02 ? 1 + (step - 0.5) * 0.07 * Math.min(st, 1.4) : 1 + Math.sin(t * 2.1) * 0.012 + (p.talk ?? 0) * 0.015;
  const sway = st > 0.02 ? Math.sin(ph) * 0.05 * Math.min(st, 1.2) : Math.sin(t * 1.3) * 0.02;
  ctx.setTransform(k / Math.sqrt(squash), 0, 0, k * squash, CANVAS_W / 2, CANVAS_H - 40);

  const isDoom = cos.kind === 'doom';
  const crouch = p.crouch ?? 0;
  const hipY = 300 - crouch * 80 + bob;
  const torsoH = isDoom ? 330 : 300;
  const shoulderY = hipY + torsoH - 40;
  const headRx = isDoom ? 150 : 165, headRy = isDoom ? 172 : 168;
  const headY = shoulderY + 175 + Math.sin(t * 2.1 + 0.6) * 4 + (p.talk ?? 0) * 6;
  const headX = Math.sin(t * 1.3) * 6 + sway * 200;
  const tilt = (p.tilt ?? 0) + sway * 0.6 + (p.talk ?? 0) * Math.sin(t * 9) * 0.03;

  // ---- colors per costume
  let torsoFill: [string, string] = ['#888', '#555'];
  let limb = INK, limbInner: string | undefined;
  let hand = '#f4f0e8';
  let shoe = INK;
  if (cos.kind === 'doom') {
    torsoFill = cos.bot ? ['#3b4a40', '#1c2820'] : ['#2f8c49', '#13461f'];
    limb = '#2a3038';
    limbInner = '#9aa6b2';
    hand = 'steel';
    shoe = 'steel';
  } else if (cos.kind === 'guard') torsoFill = ['#9aa0a8', '#4d535b'];
  else if (cos.kind === 'baron') torsoFill = ['#6a1f2b', '#2e0b12'];
  else if (cos.kind === 'peasant') torsoFill = [cos.shirt, shade(cos.shirt, -0.45)];
  else if (cos.kind === 'mother') torsoFill = ['#6b2a4a', '#2c0d1e'];
  else if (cos.kind === 'father') torsoFill = ['#6a5038', '#2e2116'];
  else if (cos.kind === 'villager') torsoFill = [cos.dress, shade(cos.dress, -0.45)];

  const steelHand = (x: number, y: number, r: number) => {
    ell(ctx, x, y, r, r * 1.05);
    fillStroke(ctx, rad(ctx, x, y, 1, r * 1.3, [[0, '#eef2f5'], [0.5, '#9aa4ae'], [1, '#434a52']], -r * 0.4, r * 0.4), 7);
  };
  const drawHand = (x: number, y: number) => {
    if (hand === 'steel') steelHand(x, y, 30);
    else {
      ell(ctx, x, y, 24, 25);
      fillStroke(ctx, rad(ctx, x, y, 1, 30, [[0, '#ffffff'], [1, '#d6cfc2']], -6, 6), 7);
    }
  };

  // ---- cloak (behind everything)
  if (isDoom) cloak(ctx, headX * 0.3, shoulderY, p, cos.kind === 'doom' && cos.bot ? '#203026' : '#1f5c30', '#0f3219');

  // ---- arms (computed) shoulder points
  const shL = {x: -95 + sway * 120, y: shoulderY - 20};
  const shR = {x: 95 + sway * 120, y: shoulderY - 20};
  const armLen = isDoom ? 290 : 270;
  const swing = Math.sin(ph) * 0.55 * Math.min(st, 1.4);
  const aL = (p.armL ?? 0.18) + (p.armL === undefined ? swing : 0) + Math.sin(t * 1.7) * 0.03;
  const aR = (p.armR ?? 0.18) - (p.armR === undefined ? swing : 0) + Math.sin(t * 1.9 + 1) * 0.03;
  const handL = {x: shL.x - Math.sin(aL) * armLen, y: shL.y - Math.cos(aL) * armLen};
  const handR = {x: shR.x + Math.sin(aR) * armLen, y: shR.y - Math.cos(aR) * armLen};
  if (p.holdBaby) {
    handL.x = -40; handL.y = shoulderY - 170;
    handR.x = 60; handR.y = shoulderY - 150;
  }

  // ---- legs
  const legW = isDoom ? 26 : 15;
  for (const sd of [-1, 1]) {
    const phase = ph + (sd > 0 ? 0 : Math.PI);
    const fx = sd * 48 + Math.sin(phase) * 95 * Math.min(st, 1.5) * 0.8;
    const lift = Math.max(0, Math.cos(phase)) * 55 * Math.min(st, 1.5);
    const fy = 18 + lift;
    hose(ctx, sd * 45, hipY + 10, fx, fy, sd * (0.15 + crouch * 0.8) + Math.sin(phase) * 0.1, legW, limb, limbInner);
    // shoe / boot
    if (shoe === 'steel') {
      ctx.beginPath();
      ctx.moveTo(fx - 34, -(fy - 6));
      ctx.quadraticCurveTo(fx - 36, -(fy + 40), fx, -(fy + 40));
      ctx.quadraticCurveTo(fx + 44 * sd, -(fy + 30), fx + 52 * sd, -(fy - 8));
      ctx.closePath();
      fillStroke(ctx, lin(ctx, fx - 30, fy + 40, fx + 30, fy, [[0, '#d4dae0'], [1, '#4b535c']]), 7);
      // green boot cuff
      ctx.beginPath();
      ctx.ellipse(fx, -(fy + 46), 30, 12, 0, 0, Math.PI * 2);
      fillStroke(ctx, '#1d5c2e', 6);
    } else {
      ell(ctx, fx + sd * 10, fy - 2, 32, 15);
      fillStroke(ctx, shoe, 5);
    }
  }

  // ---- back arm
  hose(ctx, shL.x, shL.y, handL.x, handL.y, (p.bendL ?? 0.25) * -1, isDoom ? 30 : 15, limb, limbInner);
  drawHand(handL.x, handL.y);

  // ---- torso / costume
  const tW = isDoom ? 250 : 215, bW = isDoom ? 300 : 265;
  ctx.save();
  ctx.translate(sway * 60, 0);
  if (cos.kind === 'mother' || cos.kind === 'villager') {
    // long dress to the ground
    ctx.beginPath();
    ctx.moveTo(-110, -(shoulderY + 20));
    ctx.bezierCurveTo(-130, -(hipY + 40), -200, -120, -210 - Math.sin(t * 2) * 8, -10);
    ctx.quadraticCurveTo(0, 18, 210 + Math.sin(t * 2.2) * 8, -10);
    ctx.bezierCurveTo(200, -120, 130, -(hipY + 40), 110, -(shoulderY + 20));
    ctx.closePath();
    fillStroke(ctx, lin(ctx, -150, shoulderY, 180, 0, [[0, torsoFill[0]], [1, torsoFill[1]]]), 9);
    // shawl
    const sh = cos.kind === 'mother' ? '#2a1830' : cos.shawl;
    ctx.beginPath();
    ctx.moveTo(-135, -(shoulderY + 30));
    ctx.quadraticCurveTo(0, -(shoulderY + 80), 135, -(shoulderY + 30));
    ctx.quadraticCurveTo(150, -(shoulderY - 140), 0, -(shoulderY - 210));
    ctx.quadraticCurveTo(-150, -(shoulderY - 140), -135, -(shoulderY + 30));
    fillStroke(ctx, lin(ctx, -130, shoulderY + 40, 130, shoulderY - 200, [[0, shade(sh, 0.25)], [1, shade(sh, -0.4)]]), 8);
    // embroidery band
    ctx.lineWidth = 6;
    ctx.strokeStyle = cos.kind === 'mother' ? '#c9a24a' : '#d7c9a0';
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(-180, -60);
    ctx.quadraticCurveTo(0, -30, 180, -60);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    bean(ctx, 0, hipY - 20, torsoH, tW, bW);
    fillStroke(ctx, lin(ctx, -tW / 2, hipY + torsoH, tW / 2, hipY, [[0, torsoFill[0]], [1, torsoFill[1]]]), 9);
    ctx.save();
    bean(ctx, 0, hipY - 20, torsoH, tW, bW);
    ctx.clip();
    costumeDetails(ctx, cos, hipY, torsoH, tW, bW, t);
    // rim light (moon) on the left edge
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(190,215,255,0.18)';
    bean(ctx, -6, hipY - 18, torsoH, tW, bW);
    ctx.stroke();
    ctx.restore();
    bean(ctx, 0, hipY - 20, torsoH, tW, bW);
    ctx.lineWidth = 9;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  ctx.restore();

  if (p.holdBaby) {
    // swaddled baby cradled in the arms
    ell(ctx, 10, shoulderY - 150, 95, 52, -0.15);
    fillStroke(ctx, lin(ctx, -80, shoulderY - 110, 90, shoulderY - 200, [[0, '#efe3c6'], [1, '#a8987a']]), 7);
    ell(ctx, -60, shoulderY - 128, 48, 46);
    fillStroke(ctx, rad(ctx, -60, shoulderY - 128, 2, 55, [[0, '#ffffff'], [1, '#d8cfc0']], -10, 10), 6);
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-60 + sd * 16 - 7, -(shoulderY - 120));
      ctx.quadraticCurveTo(-60 + sd * 16, -(shoulderY - 126), -60 + sd * 16 + 7, -(shoulderY - 120));
      ctx.stroke();
    }
  }

  // ---- head
  ctx.save();
  if (isDoom) {
    ctx.translate(headX, -headY);
    ctx.rotate(tilt);
    ctx.translate(-headX, headY);
    const hc = cos.bot ? '#1a2a1f' : '#1b5229', hcd = cos.bot ? '#0c140f' : '#0b2914';
    if (!cos.bot) hoodBack(ctx, headX, headY, headRx, headRy, hc, hcd);
    doomMask(ctx, headX, headY, headRx, headRy, p);
    if (!cos.bot) hoodFront(ctx, headX, headY, headRx, headRy, hc, hcd);
    if (glowCtx) {
      // emissive eyes for bloom
      glowCtx.setTransform(ctx.getTransform());
      const lk = (p.look ?? 0) * headRx * 0.18;
      glowCtx.shadowColor = '#7dff95';
      glowCtx.shadowBlur = 20;
      for (const sd of [-1, 1]) {
        glowCtx.beginPath();
        glowCtx.ellipse(headX + lk + sd * headRx * 0.38, -(headY + headRy * 0.08) + 4, headRx * 0.15, 6, sd * 0.16, 0, Math.PI * 2);
        glowCtx.fillStyle = `rgba(140,255,150,${Math.min(1, p.eyeGlow ?? 0.8)})`;
        glowCtx.fill();
      }
      glowCtx.shadowBlur = 0;
    }
  } else {
    whiteHead(ctx, headX, headY, headRx, headRy, tilt);
    const blink = (t % 3.7) < 0.12 || ((t + 1.3) % 5.3) < 0.1;
    const hairCol = cos.kind === 'peasant' ? cos.hair : cos.kind === 'mother' ? '#1b120e' : cos.kind === 'father' ? '#3b2a1c' : cos.kind === 'villager' ? cos.hair ?? '#4a3020' : cos.kind === 'baron' ? '#d9d4c8' : null;
    if (hairCol && cos.kind !== 'guard') {
      // hair cap
      ctx.beginPath();
      ctx.ellipse(headX, -(headY + headRy * 0.35), headRx * 1.0, headRy * 0.72, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(headX + headRx * 0.2, -(headY + headRy * 0.55), headX - headRx * 0.95, -(headY + headRy * 0.2));
      fillStroke(ctx, lin(ctx, headX - headRx, headY + headRy, headX + headRx, headY, [[0, shade(hairCol, 0.2)], [1, shade(hairCol, -0.3)]]), 8);
    }
    const beard = cos.kind === 'father' ? '#3b2a1c' : cos.kind === 'peasant' ? cos.beard : null;
    if (beard) {
      ctx.beginPath();
      ctx.moveTo(headX - headRx * 0.85, -(headY - headRy * 0.05));
      ctx.quadraticCurveTo(headX - headRx * 0.8, -(headY - headRy * 1.15), headX, -(headY - headRy * 1.18));
      ctx.quadraticCurveTo(headX + headRx * 0.8, -(headY - headRy * 1.15), headX + headRx * 0.85, -(headY - headRy * 0.05));
      ctx.quadraticCurveTo(headX, -(headY - headRy * 0.5), headX - headRx * 0.85, -(headY - headRy * 0.05));
      fillStroke(ctx, lin(ctx, headX, headY, headX, headY - headRy, [[0, shade(beard, 0.15)], [1, shade(beard, -0.3)]]), 7);
    }
    humanFace(ctx, headX, headY, headRx, headRy, p, blink, {mustache: cos.kind === 'baron' ? '#d9d4c8' : null});
    if (cos.kind === 'guard') guardHelmet(ctx, headX, headY, headRx, headRy);
    if (cos.kind === 'baron') crown(ctx, headX, headY, headRx, headRy);
    if (cos.kind === 'mother') hoodFront(ctx, headX, headY + 10, headRx * 1.02, headRy, '#3a1e40', '#160a1a');
    if (cos.kind === 'peasant' && cos.hat) {
      ell(ctx, headX, headY + headRy * 0.72, headRx * 1.3, 26);
      fillStroke(ctx, shade(cos.hat, -0.2), 7);
      ctx.beginPath();
      ctx.moveTo(headX - headRx * 0.75, -(headY + headRy * 0.75));
      ctx.quadraticCurveTo(headX, -(headY + headRy * 1.55), headX + headRx * 0.75, -(headY + headRy * 0.75));
      ctx.closePath();
      fillStroke(ctx, lin(ctx, headX - headRx, headY + headRy * 1.4, headX + headRx, headY, [[0, cos.hat], [1, shade(cos.hat, -0.4)]]), 7);
    }
  }
  ctx.restore();

  // ---- front arm + hand (+ spear)
  if (p.holdSpear) {
    const sx = handR.x + 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, -20);
    ctx.lineTo(sx + 12, -(headY + 380));
    ctx.lineWidth = 16;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#7a5530';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx + 12, -(headY + 470));
    ctx.lineTo(sx + 34, -(headY + 370));
    ctx.lineTo(sx - 10, -(headY + 370));
    ctx.closePath();
    fillStroke(ctx, lin(ctx, sx - 10, headY + 470, sx + 30, headY + 370, [[0, '#f3f5f7'], [1, '#6b737c']]), 6);
  }
  hose(ctx, shR.x, shR.y, handR.x, handR.y, p.bendR ?? 0.25, isDoom ? 30 : 15, limb, limbInner);
  drawHand(handR.x, handR.y);
};

const costumeDetails = (c: C, cos: Costume, hipY: number, h: number, tW: number, bW: number, t: number) => {
  if (cos.kind === 'doom') {
    // tunic seam + belt + buckle + pouch
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(-12, -(hipY + h), 24, h);
    const by = hipY + 60;
    c.fillStyle = lin(c, 0, by + 30, 0, by - 30, [[0, '#6e5226'], [1, '#2d1f0c']]);
    c.fillRect(-200, -(by + 28), 400, 56);
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.strokeRect(-200, -(by + 28), 400, 56);
    c.fillStyle = lin(c, -30, by + 30, 30, by - 30, [[0, '#ffe08a'], [1, '#8a6417']]);
    c.fillRect(-34, -(by + 34), 68, 68);
    c.strokeRect(-34, -(by + 34), 68, 68);
    c.fillStyle = '#3d2b12';
    c.fillRect(70, -(by - 20), 62, 72);
    c.strokeRect(70, -(by - 20), 62, 72);
    // chest armor neckline (steel collar)
    c.beginPath();
    c.ellipse(0, -(hipY + h - 30), 95, 50, 0, 0, Math.PI);
    c.fillStyle = lin(c, -90, hipY + h, 90, hipY + h - 60, [[0, '#dfe5ea'], [1, '#59616a']]);
    c.fill();
    c.stroke();
  } else if (cos.kind === 'guard') {
    // chainmail scales
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(30,34,40,0.55)';
    for (let y = hipY; y < hipY + h; y += 18)
      for (let x = -bW / 2; x < bW / 2; x += 22) {
        c.beginPath();
        c.arc(x + ((y / 18) % 2) * 11, -y, 10, 0, Math.PI);
        c.stroke();
      }
    // red tabard + belt
    c.fillStyle = lin(c, -60, hipY + h, 60, hipY, [[0, '#c3313b'], [1, '#5a0f16']]);
    c.fillRect(-150, -(hipY + 70), 300, 120);
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.strokeRect(-150, -(hipY + 70), 300, 120);
    c.fillStyle = '#3a2814';
    c.fillRect(-160, -(hipY + 95), 320, 30);
    c.strokeRect(-160, -(hipY + 95), 320, 30);
    c.fillStyle = '#d4b04a';
    c.fillRect(-18, -(hipY + 99), 36, 38);
    c.strokeRect(-18, -(hipY + 99), 36, 38);
    // round chest plate
    c.beginPath();
    c.arc(0, -(hipY + h * 0.62), 40, 0, Math.PI * 2);
    c.fillStyle = rad(c, 0, hipY + h * 0.62, 2, 46, [[0, '#f2f4f6'], [1, '#5c636b']], -12, 12);
    c.fill();
    c.stroke();
  } else if (cos.kind === 'baron') {
    c.fillStyle = 'rgba(255,215,120,0.9)';
    for (let y = hipY + 40; y < hipY + h - 20; y += 44) {
      c.beginPath();
      c.arc(0, -y, 9, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = INK;
      c.stroke();
    }
    c.fillStyle = '#e9e1d0';
    c.fillRect(-tW / 2, -(hipY + h - 10), tW, 46);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = -tW / 2; x < tW / 2; x += 26) c.fillRect(x, -(hipY + h - 10), 6, 46);
    c.fillStyle = '#d4b04a';
    c.fillRect(-bW / 2, -(hipY + 50), bW, 30);
  } else if (cos.kind === 'father' || cos.kind === 'peasant') {
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(-8, -(hipY + h), 16, h);
    c.fillStyle = '#2a1d12';
    c.fillRect(-bW / 2, -(hipY + 60), bW, 26);
    if (cos.kind === 'father') {
      // healer's satchel strap
      c.beginPath();
      c.moveTo(-100, -(hipY + h - 20));
      c.lineTo(110, -(hipY + 40));
      c.lineWidth = 20;
      c.strokeStyle = '#4b3420';
      c.stroke();
    }
  }
};

const guardHelmet = (c: C, hx: number, hy: number, rx: number, ry: number) => {
  c.beginPath();
  c.ellipse(hx, -(hy + ry * 0.25), rx * 1.04, ry * 0.86, 0, Math.PI, Math.PI * 2);
  c.closePath();
  fillStroke(c, rad(c, hx, hy + ry * 0.6, 4, rx * 1.2, [[0, '#f0f3f6'], [0.5, '#9aa2ab'], [1, '#4c535b']], -rx * 0.3, ry * 0.3), 8);
  c.lineWidth = 4;
  c.strokeStyle = 'rgba(20,24,30,0.6)';
  for (const a of [-0.5, 0, 0.5]) {
    c.beginPath();
    c.moveTo(hx + a * rx * 0.9, -(hy + ry * 0.28));
    c.quadraticCurveTo(hx + a * rx * 0.5, -(hy + ry * 0.95), hx, -(hy + ry * 1.1));
    c.stroke();
  }
  c.beginPath();
  c.rect(hx - rx * 1.06, -(hy + ry * 0.36), rx * 2.12, 34);
  fillStroke(c, lin(c, hx, hy + ry * 0.36, hx, hy + ry * 0.2, [[0, '#d4404a'], [1, '#6d1018']]), 6);
  c.beginPath();
  c.arc(hx, -(hy + ry * 0.27), 13, 0, Math.PI * 2);
  fillStroke(c, '#e8c45a', 4);
};

const crown = (c: C, hx: number, hy: number, rx: number, ry: number) => {
  const y = hy + ry * 0.7;
  c.beginPath();
  c.moveTo(hx - rx * 0.6, -y);
  for (let i = 0; i <= 4; i++) {
    const x = hx - rx * 0.6 + (i * rx * 1.2) / 4;
    c.lineTo(x - rx * 0.075, -(y + 20));
    c.lineTo(x, -(y + (i % 2 ? 60 : 85)));
    c.lineTo(x + rx * 0.075, -(y + 20));
  }
  c.lineTo(hx + rx * 0.6, -y);
  c.closePath();
  fillStroke(c, lin(c, hx - rx, y + 80, hx + rx, y, [[0, '#ffe796'], [1, '#8b6414']]), 7);
};

export const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (x: number) => Math.round(amt >= 0 ? x + (255 - x) * amt : x * (1 + amt));
  r = f(r); g = f(g); b = f(b);
  return `rgb(${r},${g},${b})`;
};
