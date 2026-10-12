import Phaser from 'phaser';
import { CHAPTERS, COLORS, GAME_WIDTH, HEX, LEVELS_PER_CHAPTER, YARNS, chapterOf } from '../constants';
import { LEVELS } from '../levels';
import { progress } from '../progress';
import { sound } from '../audio/SoundManager';
import { addFeltBackground, createIconButton, dashedPolyline, drawIcon, textStyle } from '../ui';

const CHAPTER_COUNT = Math.ceil(LEVELS.length / LEVELS_PER_CHAPTER);

/**
 * Level picker. One chapter (10 levels) per page; each level is a sewing button.
 * Finished levels are filled with the chapter's yarn colour.
 */
export class LevelSelectScene extends Phaser.Scene {
  private page = 0;
  private pageLayer!: Phaser.GameObjects.Container;
  private dots: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('LevelSelectScene');
  }

  init(data: { chapter?: number }) {
    this.page = data.chapter ?? chapterOf(progress.nextLevel());
  }

  create() {
    this.cameras.main.fadeIn(200, 24, 59, 55);
    addFeltBackground(this);

    createIconButton(this, 82, 82, 'back', () => this.go('MenuScene', {}));
    this.add.text(GAME_WIDTH / 2, 82, 'Chọn màn', textStyle(44, '800')).setOrigin(0.5);

    this.pageLayer = this.add.container(0, 0);

    // Chapter arrows
    createIconButton(this, 82, 1110, 'back', () => this.turn(-1), { size: 80 });
    createIconButton(this, GAME_WIDTH - 82, 1110, 'next', () => this.turn(1), { size: 80 });

    // Chapter dots
    for (let c = 0; c < CHAPTER_COUNT; c++) {
      const g = this.add.graphics({ x: GAME_WIDTH / 2 + (c - (CHAPTER_COUNT - 1) / 2) * 44, y: 1110 });
      g.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains);
      g.on('pointerup', () => this.showPage(c, c > this.page ? 1 : -1));
      this.dots.push(g);
    }

    // Swipe between chapters
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.upX - p.downX;
      if (Math.abs(dx) > 90 && Math.abs(p.upY - p.downY) < 120) this.turn(dx < 0 ? 1 : -1);
    });

    this.input.keyboard?.on('keydown-LEFT', () => this.turn(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.turn(1));
    this.input.keyboard?.on('keydown-ESC', () => this.go('MenuScene', {}));

    this.showPage(this.page, 0);
  }

  private turn(dir: number) {
    const next = Phaser.Math.Clamp(this.page + dir, 0, CHAPTER_COUNT - 1);
    if (next !== this.page) this.showPage(next, dir);
  }

  private showPage(c: number, dir: number) {
    if (dir !== 0) sound.tap();
    this.page = c;
    const old = this.pageLayer;
    this.pageLayer = this.add.container(dir * 80, 0).setAlpha(dir ? 0 : 1);
    this.buildPage(this.pageLayer, c);
    if (dir) {
      this.tweens.add({ targets: old, x: -dir * 80, alpha: 0, duration: 160, onComplete: () => old.destroy() });
      this.tweens.add({ targets: this.pageLayer, x: 0, alpha: 1, duration: 200, ease: 'Cubic.Out' });
    } else {
      old.destroy();
    }

    this.dots.forEach((g, i) => {
      g.clear();
      const yarn = YARNS[i % YARNS.length];
      g.fillStyle(i === c ? yarn.main : COLORS.FELT_DEEP, 1);
      g.fillCircle(0, 0, i === c ? 13 : 10);
      if (i !== c) {
        g.lineStyle(2, yarn.main, 0.8);
        g.strokeCircle(0, 0, 10);
      }
    });
  }

  private buildPage(layer: Phaser.GameObjects.Container, c: number) {
    const yarn = YARNS[c % YARNS.length];
    const first = c * LEVELS_PER_CHAPTER;
    const last = Math.min(first + LEVELS_PER_CHAPTER, LEVELS.length);
    let done = 0;
    for (let i = first; i < last; i++) if (progress.isDone(i)) done++;

    // Spool of this chapter's yarn
    const spool = this.add.graphics({ x: GAME_WIDTH / 2, y: 270 });
    spool.fillStyle(COLORS.FELT_DEEP, 0.6);
    spool.fillRoundedRect(-58, -66, 116, 140, 14);
    spool.fillStyle(COLORS.BRASS_DARK, 1);
    spool.fillRoundedRect(-62, -74, 124, 20, 8);
    spool.fillRoundedRect(-62, 50, 124, 20, 8);
    spool.fillStyle(yarn.dark, 1);
    spool.fillRect(-46, -54, 92, 104);
    spool.lineStyle(5, yarn.main, 1);
    for (let y = -48; y <= 44; y += 9) spool.lineBetween(-44, y, 44, y + 5);
    spool.lineStyle(2, yarn.light, 0.7);
    for (let y = -44; y <= 44; y += 18) spool.lineBetween(-44, y, 44, y + 5);
    layer.add(spool);

    layer.add(this.add.text(GAME_WIDTH / 2, 410, `Chương ${c + 1}: ${CHAPTERS[c].name}`, textStyle(38, '800')).setOrigin(0.5));
    layer.add(
      this.add
        .text(GAME_WIDTH / 2, 458, `Đã xong ${done}/${last - first} màn`, textStyle(24, '600', HEX.LINEN_DIM))
        .setOrigin(0.5)
    );

    // Sewing buttons: 5 per row
    const cols = 5;
    const gap = 128;
    for (let i = first; i < last; i++) {
      const k = i - first;
      const x = GAME_WIDTH / 2 + ((k % cols) - (cols - 1) / 2) * gap;
      const y = 600 + Math.floor(k / cols) * 150;
      layer.add(this.levelButton(i, x, y));
    }

    const legend = this.add
      .text(GAME_WIDTH / 2, 930, 'Chấm vàng: giải không cần gợi ý', textStyle(22, '600', HEX.LINEN_DIM))
      .setOrigin(0.5);
    layer.add(legend);
  }

  private levelButton(i: number, x: number, y: number) {
    const yarn = YARNS[chapterOf(i) % YARNS.length];
    const unlocked = progress.isUnlocked(i);
    const done = progress.isDone(i);
    const r = 50;
    const c = this.add.container(x, y);
    const g = this.add.graphics();

    g.fillStyle(COLORS.FELT_DEEP, 1);
    g.fillCircle(0, 6, r);
    g.fillStyle(done ? yarn.main : unlocked ? COLORS.FELT_LIGHT : COLORS.FELT_DEEP, 1);
    g.fillCircle(0, 0, r);
    g.lineStyle(2.5, done ? yarn.dark : COLORS.LINEN, done ? 0.9 : unlocked ? 0.55 : 0.18);
    const ring: { x: number; y: number }[] = [];
    for (let a = 0; a < 32; a++) ring.push({ x: Math.cos((a / 32) * Math.PI * 2) * (r - 9), y: Math.sin((a / 32) * Math.PI * 2) * (r - 9) });
    dashedPolyline(g, ring, 7, 6, true);
    c.add(g);

    if (unlocked) {
      const color = done ? HEX.FELT_DEEP : HEX.LINEN;
      c.add(this.add.text(0, -2, String(i + 1), textStyle(40, '800', color)).setOrigin(0.5));
    } else {
      const lock = this.add.graphics();
      drawIcon(lock, 'lock', COLORS.LINEN, 1.1);
      lock.setAlpha(0.35);
      c.add(lock);
    }

    if (progress.isClean(i)) {
      const pin = this.add.graphics();
      pin.fillStyle(COLORS.BRASS_DARK, 1);
      pin.fillCircle(r * 0.68, -r * 0.68, 11);
      pin.fillStyle(COLORS.BRASS, 1);
      pin.fillCircle(r * 0.68, -r * 0.68, 8.5);
      c.add(pin);
    }

    if (unlocked) {
      const zone = this.add.zone(0, 3, r * 2 + 10, r * 2 + 16).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => (g.y = 4));
      zone.on('pointerout', () => (g.y = 0));
      zone.on('pointerup', (p: Phaser.Input.Pointer) => {
        g.y = 0;
        if (Math.abs(p.upX - p.downX) > 30) return; // was a swipe
        this.go('GameScene', { level: i });
      });
      c.add(zone);
    }
    return c;
  }

  private go(scene: string, data: object) {
    sound.tap();
    this.cameras.main.fadeOut(160, 24, 59, 55);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }
}
