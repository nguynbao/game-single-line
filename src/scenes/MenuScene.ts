import Phaser from 'phaser';
import { BoardView } from '../board';
import { COLORS, GAME_WIDTH, HEX, YARNS } from '../constants';
import { LEVELS } from '../levels';
import { Puzzle } from '../puzzle';
import { progress } from '../progress';
import { sound } from '../audio/SoundManager';
import { ytService } from '../ytgame';
import { addFeltBackground, createButton, createIconButton, REDUCED_MOTION, textStyle } from '../ui';

let firstBoot = true;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.cameras.main.fadeIn(200, 24, 59, 55);
    addFeltBackground(this);
    const halo = this.add.graphics();
    halo.fillStyle(COLORS.FELT_DEEP, 0.35);
    halo.fillEllipse(GAME_WIDTH / 2, 335, 430, 450);

    // Hero: the envelope house stitching itself, on a loop
    this.buildDemo();

    this.add.text(GAME_WIDTH / 2, 640, 'Single Line', textStyle(104, '800', HEX.LINEN)).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 722, 'Draw all lines in one continuous stroke.', textStyle(28, '600', HEX.LINEN_DIM))
      .setOrigin(0.5);

    const next = progress.nextLevel();
    const allDone = progress.doneCount === LEVELS.length;
    const playLabel = progress.doneCount === 0 ? 'Play Game' : allDone ? 'Replay Level 50' : `Play Level ${next + 1}`;

    const play = createButton(this, GAME_WIDTH / 2, 880, 440, 104, () => this.go('GameScene', { level: next }), {
      fill: YARNS[0].dark,
      radius: 52,
      depth: 9,
    });
    play.face.add(this.add.text(0, -2, playLabel, textStyle(40, '800', HEX.LINEN)).setOrigin(0.5));

    const pick = createButton(this, GAME_WIDTH / 2, 1012, 440, 88, () => this.go('LevelSelectScene', {}), {
      radius: 44,
    });
    pick.face.add(this.add.text(0, -2, 'Select Level', textStyle(32, '800', HEX.LINEN)).setOrigin(0.5));

    this.add
      .text(GAME_WIDTH / 2, 1120, `Completed ${progress.doneCount}/${LEVELS.length} levels`, textStyle(24, '600', HEX.LINEN_DIM))
      .setOrigin(0.5);

    const soundBtn = createIconButton(this, GAME_WIDTH - 82, 82, sound.isMuted() ? 'muted' : 'sound', () => {
      const m = !sound.isMuted();
      sound.setMuted(m);
      progress.setMuted(m);
      soundBtn.setIcon(m ? 'muted' : 'sound');
      sound.tap();
    });

    if (firstBoot) {
      firstBoot = false;
      ytService.notifyFirstFrameReady();
      ytService.notifyGameReady();
    }
  }

  private go(scene: string, data: object) {
    sound.tap();
    this.cameras.main.fadeOut(160, 24, 59, 55);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene, data));
  }

  private buildDemo() {
    const level = LEVELS[4];
    const puzzle = new Puzzle(level);
    const view = new BoardView(this, level, YARNS[0], { cx: GAME_WIDTH / 2, cy: 330, w: 260, h: 330, maxSpacing: 120 });
    const route = puzzle.solve() ?? [];

    if (REDUCED_MOTION) {
      puzzle.start(route[0]);
      route.slice(1).forEach((n) => puzzle.moveTo(n));
      view.redraw(puzzle, { showCurrent: false });
      return;
    }

    let i = 0;
    const tick = () => {
      if (i === 0) {
        puzzle.reset();
        puzzle.start(route[0]);
        view.container.setAlpha(1);
      } else {
        puzzle.moveTo(route[i]);
      }
      view.redraw(puzzle);
      i++;
      if (i < route.length) {
        this.time.delayedCall(320, tick);
      } else {
        view.redraw(puzzle, { showCurrent: false });
        this.tweens.add({
          targets: view.container,
          alpha: 0,
          delay: 1400,
          duration: 400,
          onComplete: () => {
            i = 0;
            tick();
          },
        });
      }
    };
    tick();
  }
}
