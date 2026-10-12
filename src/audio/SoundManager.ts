// Synthesised sounds (Web Audio API) — no audio files to download.
// Each stitch plucks the next note of a pentatonic scale, so a finished
// puzzle sounds like a little melody.

const PENTATONIC = [0, 2, 4, 7, 9]; // semitone offsets

export class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = false;

  private context(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  isMuted() {
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noteFreq(step: number) {
    const octave = Math.floor(step / PENTATONIC.length);
    const semis = PENTATONIC[step % PENTATONIC.length] + 12 * octave;
    return 293.66 * Math.pow(2, semis / 12); // from D4
  }

  /** Thread pulled to the next pin. `step` = how many stitches so far. */
  stitch(step: number) {
    const f = this.noteFreq(step % 15);
    this.tone(f, 0.22, 'triangle', 0.16);
    this.tone(f * 2, 0.12, 'sine', 0.05);
  }

  pickUp() {
    this.tone(520, 0.07, 'sine', 0.1, 0, 700);
  }

  undo() {
    this.tone(330, 0.09, 'sine', 0.09, 0, 220);
  }

  blocked() {
    this.tone(150, 0.12, 'square', 0.04);
  }

  hint() {
    this.tone(880, 0.16, 'sine', 0.08);
    this.tone(1320, 0.2, 'sine', 0.05, 0.08);
  }

  tap() {
    this.tone(640, 0.05, 'triangle', 0.08);
  }

  win() {
    [0, 2, 4, 5, 7].forEach((s, i) => {
      const f = this.noteFreq(5 + s);
      this.tone(f, 0.45, 'triangle', 0.14, i * 0.08);
      this.tone(f * 2, 0.3, 'sine', 0.04, i * 0.08);
    });
  }
}

export const sound = new SoundManager();
