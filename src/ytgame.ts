/**
 * YouTube Playables SDK integration with a localStorage fallback for local play.
 */

export interface YTGameSDK {
  game: {
    firstFrameReady: () => void;
    gameReady: () => void;
    loadData?: () => Promise<string>;
    saveData?: (data: string) => Promise<void>;
  };
  system?: {
    onAudioEnabledChange?: (callback: (enabled: boolean) => void) => void;
    isAudioEnabled?: () => boolean;
    onPause?: (callback: () => void) => void;
    onResume?: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    ytgame?: YTGameSDK;
  }
}

const LOCAL_KEY = 'single_line_save_v1';

class YouTubePlayablesService {
  private sdk: YTGameSDK | null = null;
  private audioCallback: ((enabled: boolean) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.ytgame) {
      this.sdk = window.ytgame;
      try {
        this.sdk.system?.onAudioEnabledChange?.((enabled) => this.audioCallback?.(enabled));
      } catch (e) {
        console.warn('[YouTube Playables] Failed to bind audio listener', e);
      }
    }
  }

  get inPlayables() {
    return this.sdk !== null;
  }

  notifyFirstFrameReady() {
    this.sdk?.game?.firstFrameReady?.();
  }

  notifyGameReady() {
    this.sdk?.game?.gameReady?.();
  }

  isAudioEnabled(): boolean {
    try {
      return this.sdk?.system?.isAudioEnabled?.() ?? true;
    } catch {
      return true;
    }
  }

  onAudioChange(cb: (enabled: boolean) => void) {
    this.audioCallback = cb;
  }

  async save(data: string): Promise<void> {
    try {
      if (this.sdk?.game?.saveData) await this.sdk.game.saveData(data);
      else localStorage.setItem(LOCAL_KEY, data);
    } catch {
      // Saving is best-effort; the game keeps working without it
    }
  }

  async load(): Promise<string> {
    try {
      if (this.sdk?.game?.loadData) return (await this.sdk.game.loadData()) || '';
      return localStorage.getItem(LOCAL_KEY) || '';
    } catch {
      return '';
    }
  }
}

export const ytService = new YouTubePlayablesService();
