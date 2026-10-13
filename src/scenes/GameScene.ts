import Phaser from 'phaser';
import { BoardView, type Point } from '../board';
import { BOARD, CHAPTERS, COLORS, GAME_WIDTH, HEX, LEVELS_PER_CHAPTER, chapterOf, yarnFor, type YarnColor } from '../constants';
import { LEVELS } from '../levels';
import { Puzzle } from '../puzzle';
import { progress } from '../progress';
import { sound } from '../audio/SoundManager';
import {
  REDUCED_MOTION,
  addFeltBackground,
  createButton,
  createIconButton,
  dashedPolyline,
  drawYarn,
  roundedRectPoints,
  textStyle,
} from '../ui';

const TUTORIAL_TIPS: Record<number, string> = {
  0: 'Touch a pin and drag along the lines.',
  1: 'Stuck? Try starting from a corner with three lines connected.',
  2: 'Drag backwards to undo the last stitch.',
};

export class GameScene extends Phaser.Scene {
  private levelIndex = 0;
  private puzzle!: Puzzle;
  private board!: BoardView;
  private yarn!: YarnColor;
  private liveG!: Phaser.GameObjects.Graphics;
  private hintG!: Phaser.GameObjects.Graphics;
  private hintTween?: Phaser.Tweens.Tween;
  private counter!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;
  private tipText = '';
  private toastTimer?: Phaser.Time.TimerEvent;
  private undoBtn!: ReturnType<typeof createIconButton>;
  private restartBtn!: ReturnType<typeof createIconButton>;
  private dragging = false;
  private lastPointer: Point | null = null;
  private usedHint = false;
  private finished = false;

  constructor() {
    super('GameScene');
  }

  init(data: { level?: number }) {
    this.levelIndex = Phaser.Math.Clamp(data.level ?? 0, 0, LEVELS.length - 1);
    this.dragging = false;
    this.lastPointer = null;
    this.usedHint = false;
    this.finished = false;
  }

  create() {
    this.cameras.main.fadeIn(200, 24, 59, 55);
    addFeltBackground(this);

    const level = LEVELS[this.levelIndex];
    const chapter = chapterOf(this.levelIndex);
    this.yarn = yarnFor(this.levelIndex);
    this.puzzle = new Puzzle(level);

    // --- Header ---
    createIconButton(this, 82, 82, 'grid', () => this.leave('LevelSelectScene', { chapter }));
    const soundBtn = createIconButton(this, GAME_WIDTH - 82, 82, sound.isMuted() ? 'muted' : 'sound', () => {
      const m = !sound.isMuted();
      sound.setMuted(m);
      progress.setMuted(m);
      soundBtn.setIcon(m ? 'muted' : 'sound');
      sound.tap();
    });
    this.add.text(GAME_WIDTH / 2, 66, `Level ${this.levelIndex + 1}`, textStyle(46, '800')).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 112, CHAPTERS[chapter].name, textStyle(22, '600', this.yarn.hex))
      .setOrigin(0.5);

    this.counter = this.add.text(GAME_WIDTH / 2, 200, '', textStyle(26, '600', HEX.LINEN_DIM)).setOrigin(0.5);

    // --- Board ---
    this.board = new BoardView(this, level, this.yarn, {
      cx: BOARD.CENTER_X,
      cy: BOARD.CENTER_Y,
      w: BOARD.MAX_W,
      h: BOARD.MAX_H - 60,
      maxSpacing: BOARD.MAX_SPACING,
    });
    this.hintG = this.add.graphics();
    this.liveG = this.add.graphics();

    // --- Tip line ---
    const firstOfChapter = this.levelIndex % LEVELS_PER_CHAPTER === 0;
    this.tipText = TUTORIAL_TIPS[this.levelIndex] ?? (firstOfChapter ? CHAPTERS[chapter].tip : '');
    this.tip = this.add
      .text(GAME_WIDTH / 2, 1015, this.tipText, { ...textStyle(25, '600', HEX.LINEN), align: 'center', wordWrap: { width: 600 } })
      .setOrigin(0.5);

    // --- Tools ---
    this.undoBtn = createIconButton(this, GAME_WIDTH / 2 - 190, 1125, 'undo', () => this.undo(), { caption: 'Undo' });
    this.restartBtn = createIconButton(this, GAME_WIDTH / 2, 1125, 'restart', () => this.restart(), { caption: 'Restart' });
    createIconButton(this, GAME_WIDTH / 2 + 190, 1125, 'hint', () => this.hint(), { caption: 'Hint' });

    // --- Input ---
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.keyboard?.on('keydown-Z', () => this.undo());
    this.input.keyboard?.on('keydown-BACKSPACE', () => this.undo());
    this.input.keyboard?.on('keydown-R', () => this.restart());
    this.input.keyboard?.on('keydown-H', () => this.hint());
    this.input.keyboard?.on('keydown-ESC', () => this.leave('LevelSelectScene', { chapter }));

    this.refresh();
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------
  private refresh() {
    this.board.redraw(this.puzzle, { showCurrent: !this.finished });
    const p = this.puzzle;
    this.counter.setText(`${p.donePasses}/${p.totalPasses} lines`);
    const hasPath = p.path.length > 0;
    this.undoBtn.setEnabled(hasPath && !this.finished);
    this.restartBtn.setEnabled(hasPath && !this.finished);
  }

  private get hitRadius() {
    return Math.max(34, this.board.spacing * 0.42);
  }

  private drawLive(pointer: Point | null) {
    this.liveG.clear();
    const cur = this.puzzle.current;
    if (!pointer || cur === null || !this.dragging) return;
    const from = this.board.positions[cur];
    if (Math.hypot(pointer.x - from.x, pointer.y - from.y) < this.board.pinRadius) return;
    drawYarn(this.liveG, from, pointer, this.yarn, this.board.yarnWidth * 0.8, 0.55);
  }

  private popPin(node: number) {
    if (REDUCED_MOTION) return;
    const p = this.board.positions[node];
    const ring = this.add.graphics({ x: p.x, y: p.y });
    ring.lineStyle(4, this.yarn.light, 1);
    ring.strokeCircle(0, 0, this.board.pinRadius + 4);
    this.tweens.add({
      targets: ring,
      scale: 2.1,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
  }

  private shakePin(node: number) {
    const p = this.board.positions[node];
    const ring = this.add.graphics({ x: p.x, y: p.y });
    ring.lineStyle(4, COLORS.LINEN, 1);
    ring.strokeCircle(0, 0, this.board.pinRadius + 10);
    this.tweens.add({
      targets: ring,
      x: p.x + 6,
      yoyo: true,
      repeat: 3,
      duration: 45,
      onComplete: () => ring.destroy(),
    });
  }

  private toast(msg: string) {
    this.toastTimer?.remove();
    this.tip.setText(msg).setColor(HEX.BRASS);
    this.toastTimer = this.time.delayedCall(2600, () => this.tip.setText(this.tipText).setColor(HEX.LINEN));
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------
  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.finished) return;
    const node = this.board.nodeAt(pointer.x, pointer.y, this.hitRadius);
    if (node < 0) return;
    const p = this.puzzle;

    if (p.current === null || (p.steps.length === 0 && node !== p.current)) {
      // Fresh start (or moving the start point before any stitch is made)
      p.reset();
      p.start(node);
      sound.pickUp();
      this.clearHint();
      this.popPin(node);
    } else if (node !== p.current) {
      sound.blocked();
      this.shakePin(p.current);
      this.toast('Continue from the lit pin, or tap Restart.');
      return;
    }
    this.dragging = true;
    this.lastPointer = { x: pointer.x, y: pointer.y };
    this.refresh();
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (!this.dragging || this.finished) return;
    const to = { x: pointer.x, y: pointer.y };
    const from = this.lastPointer ?? to;
    // Sample along the motion so quick swipes don't skip over pins
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const stepLen = Math.max(8, this.hitRadius * 0.4);
    const n = Math.max(1, Math.ceil(dist / stepLen));
    for (let i = 1; i <= n && !this.finished; i++) {
      const x = from.x + ((to.x - from.x) * i) / n;
      const y = from.y + ((to.y - from.y) * i) / n;
      this.tryStep(x, y);
    }
    this.lastPointer = to;
    this.drawLive(this.finished ? null : to);
  }

  private tryStep(x: number, y: number) {
    const p = this.puzzle;
    const node = this.board.nodeAt(x, y, this.hitRadius * 0.85);
    if (node < 0 || node === p.current) return;

    const lastEdge = p.steps[p.steps.length - 1];
    if (p.isPrevious(node) && p.left[lastEdge] === 0) {
      // Dragging back along the strand just laid = unpick it
      p.undo();
      sound.undo();
      this.clearHint();
      this.refresh();
      return;
    }

    if (p.moveTo(node) >= 0) {
      sound.stitch(p.steps.length - 1);
      this.popPin(node);
      this.clearHint();
      this.refresh();
      if (p.isComplete()) this.win();
    }
  }

  private onUp() {
    this.dragging = false;
    this.lastPointer = null;
    this.liveG.clear();
  }

  // -------------------------------------------------------------------------
  // Tools
  // -------------------------------------------------------------------------
  private undo() {
    if (this.finished) return;
    if (this.puzzle.undo()) {
      sound.undo();
      this.clearHint();
      this.refresh();
    }
  }

  private restart() {
    if (this.finished || !this.puzzle.path.length) return;
    this.puzzle.reset();
    sound.undo();
    this.clearHint();
    this.refresh();
  }

  private clearHint() {
    this.hintTween?.stop();
    this.hintTween = undefined;
    this.hintG.clear().setAlpha(1);
  }

  private hint() {
    if (this.finished) return;
    const p = this.puzzle;
    this.usedHint = true;
    this.clearHint();

    let route = p.solve();
    if (!route) {
      // Dead end: unpick stitches until the rest can still be drawn in one go
      while (!route && p.undo()) route = p.solve();
      this.toast('Dead end! Unwound back to a solvable state.');
      this.refresh();
    }
    if (!route || !route.length) return;

    sound.hint();
    const g = this.hintG;
    const pos = this.board.positions;
    const start = p.current ?? route[0];
    const a = pos[start];
    g.lineStyle(4, COLORS.LINEN, 1);
    g.strokeCircle(a.x, a.y, this.board.pinRadius + 14);

    if (p.current === null) this.toast('Start at the glowing pin.');
    if (route.length > 1) {
      const b = pos[route[1]];
      g.lineStyle(this.board.yarnWidth + 8, COLORS.LINEN, 0.35);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(4, COLORS.LINEN, 0.9);
      dashedPolyline(g, [a, b], 10, 8);
      g.fillStyle(COLORS.LINEN, 1);
      g.fillCircle(b.x, b.y, 7);
    }

    if (!REDUCED_MOTION) {
      this.hintTween = this.tweens.add({ targets: g, alpha: 0.25, yoyo: true, repeat: -1, duration: 520 });
    }
  }

  // -------------------------------------------------------------------------
  // Win
  // -------------------------------------------------------------------------
  private win() {
    this.finished = true;
    this.dragging = false;
    this.liveG.clear();
    this.clearHint();
    progress.complete(this.levelIndex, !this.usedHint);
    this.refresh();
    sound.win();

    if (!REDUCED_MOTION) {
      // Pins pop one by one along the solved route
      this.puzzle.path.forEach((n, i) => this.time.delayedCall(i * 28, () => this.popPin(n)));
      this.fluff();
    }
    this.time.delayedCall(REDUCED_MOTION ? 200 : 750, () => this.showWinPanel());
  }

  /** Little yarn snippets float up from the board. */
  private fluff() {
    const colors = [this.yarn.main, this.yarn.light, COLORS.LINEN, COLORS.BRASS];
    for (let i = 0; i < 28; i++) {
      const g = this.add.graphics({
        x: BOARD.CENTER_X + Phaser.Math.Between(-280, 280),
        y: BOARD.CENTER_Y + Phaser.Math.Between(-260, 260),
      });
      g.lineStyle(5, colors[i % colors.length], 1);
      g.beginPath();
      g.arc(0, 0, Phaser.Math.Between(6, 12), 0, Math.PI * Phaser.Math.FloatBetween(0.6, 1.4));
      g.strokePath();
      g.setRotation(Math.random() * Math.PI * 2).setAlpha(0);
      this.tweens.add({
        targets: g,
        alpha: { from: 1, to: 0 },
        y: g.y - Phaser.Math.Between(80, 180),
        rotation: g.rotation + Phaser.Math.FloatBetween(-2, 2),
        delay: Phaser.Math.Between(0, 250),
        duration: Phaser.Math.Between(700, 1100),
        ease: 'Cubic.Out',
        onComplete: () => g.destroy(),
      });
    }
  }

  private showWinPanel() {
    const isLast = this.levelIndex === LEVELS.length - 1;
    const layer = this.add.container(0, 0).setDepth(10);

    const dim = this.add.rectangle(GAME_WIDTH / 2, 640, GAME_WIDTH, 1280, COLORS.FELT_DEEP, 0.72).setInteractive();
    layer.add(dim);

    const w = 560;
    const h = isLast ? 470 : 440;
    const y = 640;
    const panel = this.add.container(GAME_WIDTH / 2, y);
    const pg = this.add.graphics();
    pg.fillStyle(COLORS.FELT_DEEP, 1);
    pg.fillRoundedRect(-w / 2, -h / 2 + 10, w, h, 34);
    pg.fillStyle(COLORS.FELT_LIGHT, 1);
    pg.fillRoundedRect(-w / 2, -h / 2, w, h, 34);
    pg.lineStyle(3, this.yarn.main, 0.9);
    dashedPolyline(pg, roundedRectPoints(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 22), 12, 9, true);
    panel.add(pg);

    const title = isLast ? 'All 50 Levels Complete!' : 'Pattern Completed!';
    panel.add(this.add.text(0, -h / 2 + 82, title, textStyle(52, '800')).setOrigin(0.5));
    const sub = isLast
      ? 'You are officially a Master Tailor.'
      : this.usedHint
        ? `Level ${this.levelIndex + 1} completed.`
        : `Level ${this.levelIndex + 1} completed without hints!`;
    panel.add(this.add.text(0, -h / 2 + 146, sub, textStyle(26, '600', HEX.LINEN_DIM)).setOrigin(0.5));

    const primaryLabel = isLast ? 'Main Menu' : 'Next Level';
    const primary = createButton(
      this,
      0,
      40,
      400,
      96,
      () => {
        if (isLast) this.leave('MenuScene', {});
        else this.leave('GameScene', { level: this.levelIndex + 1 });
      },
      { fill: this.yarn.dark, radius: 48, depth: 8 }
    );
    primary.face.add(this.add.text(0, -2, primaryLabel, textStyle(36, '800')).setOrigin(0.5));
    panel.add(primary.container);

    const replay = createButton(this, -102, 160, 196, 76, () => this.leave('GameScene', { level: this.levelIndex }), {
      radius: 38,
      fill: COLORS.FELT,
    });
    replay.face.add(this.add.text(0, -2, 'Replay', textStyle(26, '800')).setOrigin(0.5));
    panel.add(replay.container);

    const levels = createButton(
      this,
      102,
      160,
      196,
      76,
      () => this.leave('LevelSelectScene', { chapter: chapterOf(Math.min(this.levelIndex + 1, LEVELS.length - 1)) }),
      { radius: 38, fill: COLORS.FELT }
    );
    levels.face.add(this.add.text(0, -2, 'Levels', textStyle(26, '800')).setOrigin(0.5));
    panel.add(levels.container);

    layer.add(panel);

    if (!REDUCED_MOTION) {
      dim.setAlpha(0);
      panel.setScale(0.85).setAlpha(0);
      this.tweens.add({ targets: dim, alpha: 1, duration: 200 });
      this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 280, ease: 'Back.Out' });
    }

    this.input.keyboard?.once('keydown-ENTER', () => {
      if (isLast) this.leave('MenuScene', {});
      else this.leave('GameScene', { level: this.levelIndex + 1 });
    });
  }

  private leave(scene: string, data: object) {
    sound.tap();
    this.finished = true;
    this.cameras.main.fadeOut(160, 24, 59, 55);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }
}
