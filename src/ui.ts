import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, HEX, type YarnColor } from './constants';

export const REDUCED_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Pt = { x: number; y: number };

export function textStyle(
  size: number,
  weight: '500' | '600' | '800' = '800',
  color: string = HEX.LINEN
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color };
}

// ---------------------------------------------------------------------------
// Dashed "running stitch" lines
// ---------------------------------------------------------------------------
export function dashedPolyline(
  g: Phaser.GameObjects.Graphics,
  pts: Pt[],
  dash: number,
  gap: number,
  closed = false
) {
  const list = closed ? [...pts, pts[0]] : pts;
  let drawing = true;
  let remain = dash;
  for (let i = 0; i < list.length - 1; i++) {
    let ax = list[i].x;
    let ay = list[i].y;
    const bx = list[i + 1].x;
    const by = list[i + 1].y;
    let segLen = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / (segLen || 1);
    const uy = (by - ay) / (segLen || 1);
    while (segLen > 0) {
      const step = Math.min(remain, segLen);
      const nx = ax + ux * step;
      const ny = ay + uy * step;
      if (drawing) g.lineBetween(ax, ay, nx, ny);
      ax = nx;
      ay = ny;
      segLen -= step;
      remain -= step;
      if (remain <= 0.0001) {
        drawing = !drawing;
        remain = drawing ? dash : gap;
      }
    }
  }
}

export function roundedRectPoints(x: number, y: number, w: number, h: number, r: number): Pt[] {
  const pts: Pt[] = [];
  const corners = [
    { cx: x + w - r, cy: y + r, a0: -Math.PI / 2 },
    { cx: x + w - r, cy: y + h - r, a0: 0 },
    { cx: x + r, cy: y + h - r, a0: Math.PI / 2 },
    { cx: x + r, cy: y + r, a0: Math.PI },
  ];
  for (const c of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = c.a0 + (i / 6) * (Math.PI / 2);
      pts.push({ x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r });
    }
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Felt background with a stitched border
// ---------------------------------------------------------------------------
function ensureFeltTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('felt')) return;
  const size = 256;
  const tex = scene.textures.createCanvas('felt', size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.fillStyle = HEX.FELT;
  ctx.fillRect(0, 0, size, size);
  // Deterministic fibres so the texture looks the same every run
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const a = rnd() * Math.PI;
    const len = 3 + rnd() * 7;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  tex.refresh();
}

export function addFeltBackground(scene: Phaser.Scene) {
  ensureFeltTexture(scene);
  scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'felt').setOrigin(0);
  const g = scene.add.graphics();
  g.lineStyle(3, COLORS.LINEN, 0.28);
  dashedPolyline(g, roundedRectPoints(20, 20, GAME_WIDTH - 40, GAME_HEIGHT - 40, 26), 14, 10, true);
  return g;
}

// ---------------------------------------------------------------------------
// Puzzle pieces
// ---------------------------------------------------------------------------

/** Unstitched path: a faint running-stitch guide. */
export function drawGuide(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, width = 5, alpha = 0.5) {
  g.lineStyle(width, COLORS.LINEN, alpha);
  dashedPolyline(g, [a, b], 13, 10);
}

/** Thread laid down: a fat yarn strand with twist marks. */
export function drawYarn(g: Phaser.GameObjects.Graphics, a: Pt, b: Pt, yarn: YarnColor, width = 16, alpha = 1) {
  g.lineStyle(width + 6, COLORS.FELT_DEEP, 0.55 * alpha);
  g.lineBetween(a.x, a.y + 3, b.x, b.y + 3);
  g.lineStyle(width, yarn.dark, alpha);
  g.lineBetween(a.x, a.y, b.x, b.y);
  g.lineStyle(width - 5, yarn.main, alpha);
  g.lineBetween(a.x, a.y, b.x, b.y);

  // Twist marks: short slanted strokes across the strand
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const nx = -uy;
  const ny = ux;
  const half = (width - 6) / 2;
  g.lineStyle(2.5, yarn.light, 0.75 * alpha);
  for (let d = 9; d < len - 6; d += 11) {
    const cx = a.x + ux * d;
    const cy = a.y + uy * d;
    g.lineBetween(cx + nx * half - ux * 3, cy + ny * half - uy * 3, cx - nx * half + ux * 3, cy - ny * half + uy * 3);
  }
}

/** A brass pin. `active` = thread is currently here. */
export function drawPin(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, active = false) {
  g.fillStyle(COLORS.FELT_DEEP, 0.6);
  g.fillCircle(x, y + 4, r + 2);
  g.fillStyle(COLORS.BRASS_DARK, 1);
  g.fillCircle(x, y, r + 2);
  g.fillStyle(active ? COLORS.LINEN : COLORS.BRASS, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(0xffffff, active ? 0.9 : 0.45);
  g.fillCircle(x - r * 0.32, y - r * 0.32, r * 0.28);
}

// ---------------------------------------------------------------------------
// Buttons: raised felt patches with a stitched edge
// ---------------------------------------------------------------------------
export type IconKind = 'home' | 'sound' | 'muted' | 'undo' | 'restart' | 'hint' | 'back' | 'next' | 'lock' | 'grid';

export function drawIcon(g: Phaser.GameObjects.Graphics, kind: IconKind, color: number = COLORS.LINEN, s = 1) {
  g.clear();
  g.fillStyle(color, 1);
  g.lineStyle(4 * s, color, 1);
  switch (kind) {
    case 'home':
      g.fillTriangle(-15 * s, -1 * s, 0, -15 * s, 15 * s, -1 * s);
      g.fillRect(-10 * s, -2 * s, 20 * s, 15 * s);
      break;
    case 'sound':
    case 'muted':
      g.fillRect(-15 * s, -6 * s, 8 * s, 12 * s);
      g.fillTriangle(-8 * s, -6 * s, 2 * s, -14 * s, 2 * s, 14 * s);
      g.fillTriangle(-8 * s, -6 * s, 2 * s, 14 * s, -8 * s, 6 * s);
      if (kind === 'sound') {
        g.beginPath();
        g.arc(4 * s, 0, 7 * s, -0.85, 0.85);
        g.strokePath();
        g.beginPath();
        g.arc(4 * s, 0, 13 * s, -0.85, 0.85);
        g.strokePath();
      } else {
        g.lineBetween(8 * s, -6 * s, 18 * s, 6 * s);
        g.lineBetween(18 * s, -6 * s, 8 * s, 6 * s);
      }
      break;
    case 'undo':
      g.beginPath();
      g.arc(2 * s, 3 * s, 11 * s, Math.PI * 1.05, Math.PI * 2.35);
      g.strokePath();
      g.fillTriangle(-16 * s, -2 * s, -4 * s, -2 * s, -10 * s, 8 * s);
      break;
    case 'restart':
      g.beginPath();
      g.arc(0, 0, 12 * s, -Math.PI * 0.35, Math.PI * 1.45);
      g.strokePath();
      g.fillTriangle(4 * s, -18 * s, 14 * s, -9 * s, 3 * s, -5 * s);
      break;
    case 'hint': {
      // Sewing needle with an eye
      g.fillPoints(
        [
          new Phaser.Math.Vector2(-14 * s, 14 * s),
          new Phaser.Math.Vector2(9 * s, -13 * s),
          new Phaser.Math.Vector2(13 * s, -9 * s),
        ],
        true
      );
      g.lineStyle(3 * s, color, 1);
      g.strokeEllipse(12 * s, -12 * s, 9 * s, 9 * s);
      break;
    }
    case 'back':
      g.lineStyle(5 * s, color, 1);
      g.lineBetween(6 * s, -12 * s, -6 * s, 0);
      g.lineBetween(-6 * s, 0, 6 * s, 12 * s);
      break;
    case 'next':
      g.lineStyle(5 * s, color, 1);
      g.lineBetween(-6 * s, -12 * s, 6 * s, 0);
      g.lineBetween(6 * s, 0, -6 * s, 12 * s);
      break;
    case 'lock':
      g.lineStyle(3.5 * s, color, 1);
      g.beginPath();
      g.arc(0, -4 * s, 6 * s, Math.PI, 0);
      g.strokePath();
      g.lineBetween(-6 * s, -4 * s, -6 * s, 1 * s);
      g.lineBetween(6 * s, -4 * s, 6 * s, 1 * s);
      g.fillRoundedRect(-9 * s, 0, 18 * s, 13 * s, 3 * s);
      break;
    case 'grid':
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) g.fillCircle((i - 1) * 10 * s, (j - 1) * 10 * s, 3.4 * s);
      break;
  }
}

export interface ButtonOpts {
  fill?: number;
  radius?: number;
  depth?: number;
  stitch?: number;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  onPress: () => void,
  opts: ButtonOpts = {}
) {
  const radius = opts.radius ?? Math.min(h / 2, 30);
  const depth = opts.depth ?? 7;
  const fill = opts.fill ?? COLORS.FELT_LIGHT;
  const stitch = opts.stitch ?? COLORS.LINEN;

  const container = scene.add.container(x, y);
  const shadow = scene.add.graphics();
  shadow.fillStyle(COLORS.FELT_DEEP, 1);
  shadow.fillRoundedRect(-w / 2, -h / 2 + depth, w, h, radius);
  container.add(shadow);

  const face = scene.add.container(0, 0);
  const fg = scene.add.graphics();
  fg.fillStyle(fill, 1);
  fg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
  fg.lineStyle(2.5, stitch, 0.55);
  const inset = 7;
  dashedPolyline(fg, roundedRectPoints(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, Math.max(4, radius - inset)), 8, 6, true);
  face.add(fg);
  container.add(face);

  const zone = scene.add.zone(0, depth / 2, w, h + depth).setInteractive({ useHandCursor: true });
  container.add(zone);

  let enabled = true;
  const release = () => (face.y = 0);
  zone.on('pointerdown', () => {
    if (enabled) face.y = depth - 2;
  });
  zone.on('pointerout', release);
  zone.on('pointerup', () => {
    if (!enabled || face.y === 0) return;
    release();
    onPress();
  });

  return {
    container,
    face,
    setEnabled(on: boolean) {
      enabled = on;
      container.setAlpha(on ? 1 : 0.45);
    },
  };
}

/** Square icon button with an optional caption underneath. */
export function createIconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  kind: IconKind,
  onPress: () => void,
  opts: { size?: number; caption?: string; fill?: number } = {}
) {
  const size = opts.size ?? 72;
  const btn = createButton(scene, x, y, size, size, onPress, { radius: 20, depth: 6, fill: opts.fill });
  const icon = scene.add.graphics();
  btn.face.add(icon);
  drawIcon(icon, kind, COLORS.LINEN, size / 72);
  if (opts.caption) {
    const t = scene.add.text(0, size / 2 + 22, opts.caption, textStyle(20, '600', HEX.LINEN_DIM)).setOrigin(0.5);
    btn.container.add(t);
  }
  return { ...btn, setIcon: (k: IconKind) => drawIcon(icon, k, COLORS.LINEN, size / 72) };
}
