import Phaser from 'phaser';
import type { LevelData } from './levels';
import type { Puzzle } from './puzzle';
import { COLORS, type YarnColor } from './constants';
import { drawGuide, drawPin, drawYarn } from './ui';

export interface Point {
  x: number;
  y: number;
}

/**
 * Draws a puzzle (pins, running-stitch guides, yarn) into a fixed box.
 * Used by both the game board and the animated demo on the title screen.
 */
export class BoardView {
  readonly positions: Point[];
  readonly spacing: number;
  readonly yarnWidth: number;
  readonly pinRadius: number;
  readonly container: Phaser.GameObjects.Container;
  private guideG: Phaser.GameObjects.Graphics;
  private yarnG: Phaser.GameObjects.Graphics;
  private pinG: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private level: LevelData,
    private yarn: YarnColor,
    box: { cx: number; cy: number; w: number; h: number; maxSpacing: number }
  ) {
    const sx = level.cols > 1 ? box.w / (level.cols - 1) : Infinity;
    const sy = level.rows > 1 ? box.h / (level.rows - 1) : Infinity;
    this.spacing = Math.min(sx, sy, box.maxSpacing);
    this.positions = level.nodes.map(([x, y]) => ({
      x: box.cx + (x - (level.cols - 1) / 2) * this.spacing,
      y: box.cy + (y - (level.rows - 1) / 2) * this.spacing,
    }));
    this.yarnWidth = Phaser.Math.Clamp(this.spacing * 0.12, 9, 18);
    this.pinRadius = Phaser.Math.Clamp(this.spacing * 0.1, 9, 16);

    this.container = scene.add.container(0, 0);
    this.guideG = scene.add.graphics();
    this.yarnG = scene.add.graphics();
    this.pinG = scene.add.graphics();
    this.container.add([this.guideG, this.yarnG, this.pinG]);
  }

  /** Offset for the two lanes of an edge that must be stitched twice. */
  laneEnds(edge: number, lane: number, passes: number): [Point, Point] {
    const [a, b] = this.level.edges[edge];
    const A = this.positions[a];
    const B = this.positions[b];
    if (passes < 2) return [A, B];
    const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    // Normal is computed from the lower-index node so both directions agree
    const nx = -(B.y - A.y) / len;
    const ny = (B.x - A.x) / len;
    const off = (lane === 0 ? -1 : 1) * this.yarnWidth * 0.68;
    return [
      { x: A.x + nx * off, y: A.y + ny * off },
      { x: B.x + nx * off, y: B.y + ny * off },
    ];
  }

  redraw(puzzle: Puzzle, opts: { showCurrent?: boolean } = {}) {
    const { guideG, yarnG, pinG } = this;
    guideG.clear();
    yarnG.clear();
    pinG.clear();

    const guideW = Math.max(3.5, this.yarnWidth * 0.32);
    this.level.edges.forEach((e, i) => {
      const passes = e[2];
      const done = puzzle.passesDone(i);
      for (let lane = done; lane < passes; lane++) {
        const [p, q] = this.laneEnds(i, lane, passes);
        drawGuide(guideG, p, q, guideW, passes > 1 ? 0.62 : 0.5);
      }
    });

    // Yarn in the order it was laid, so the newest strand sits on top
    const laneUsed = new Map<number, number>();
    puzzle.steps.forEach((edge) => {
      const lane = laneUsed.get(edge) ?? 0;
      laneUsed.set(edge, lane + 1);
      const [p, q] = this.laneEnds(edge, lane, this.level.edges[edge][2]);
      drawYarn(yarnG, p, q, this.yarn, this.yarnWidth);
    });

    const cur = puzzle.current;
    this.positions.forEach((p, i) => drawPin(pinG, p.x, p.y, this.pinRadius, opts.showCurrent !== false && i === cur));

    if (cur !== null && opts.showCurrent !== false) {
      const p = this.positions[cur];
      pinG.lineStyle(3, COLORS.LINEN, 0.9);
      pinG.strokeCircle(p.x, p.y, this.pinRadius + 9);
    }
  }

  /** Index of the nearest node within `radius` of (x, y), or -1. */
  nodeAt(x: number, y: number, radius: number): number {
    let best = -1;
    let bestD = radius;
    this.positions.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
}
