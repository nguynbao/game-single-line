import { LEVELS } from './levels';
import { ytService } from './ytgame';

/**
 * Player progress: which levels are finished, and whether each was finished
 * without using a hint ("clean"). Kept in memory and saved after every change.
 */
interface SaveShape {
  v: 1;
  done: string; // one char per level: 0 = not done, 1 = done with hints, 2 = done clean
  muted: boolean;
}

class Progress {
  private done: number[] = new Array(LEVELS.length).fill(0);
  muted = false;

  async load() {
    const raw = await ytService.load();
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as SaveShape;
      if (data.v === 1 && typeof data.done === 'string') {
        for (let i = 0; i < LEVELS.length; i++) this.done[i] = Number(data.done[i] || 0) || 0;
        this.muted = !!data.muted;
      }
    } catch {
      // Corrupt save: start fresh
    }
  }

  private persist() {
    const data: SaveShape = { v: 1, done: this.done.join(''), muted: this.muted };
    void ytService.save(JSON.stringify(data));
  }

  isDone(i: number) {
    return this.done[i] > 0;
  }

  isClean(i: number) {
    return this.done[i] === 2;
  }

  isUnlocked(i: number) {
    return i === 0 || this.isDone(i) || this.isDone(i - 1);
  }

  complete(i: number, clean: boolean) {
    this.done[i] = Math.max(this.done[i], clean ? 2 : 1);
    this.persist();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.persist();
  }

  get doneCount() {
    return this.done.filter((d) => d > 0).length;
  }

  /** The level the "Continue" button should open. */
  nextLevel(): number {
    const i = this.done.findIndex((d) => d === 0);
    return i === -1 ? LEVELS.length - 1 : i;
  }
}

export const progress = new Progress();
