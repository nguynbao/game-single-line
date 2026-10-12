import Phaser from 'phaser';
// Fonts are bundled (inlined by Vite) so the game stays self-contained for YouTube Playables
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/vietnamese-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/vietnamese-800.css';
import { MenuScene } from './scenes/MenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { GameScene } from './scenes/GameScene';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './constants';
import { progress } from './progress';
import { sound } from './audio/SoundManager';
import { ytService } from './ytgame';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: COLORS.FELT,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER, // Centering is handled by CSS flexbox
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [MenuScene, LevelSelectScene, GameScene],
};

// Canvas text needs fonts ready before first draw; never block longer than 1.5s
async function loadFonts() {
  const loads = Promise.all([
    document.fonts.load('800 64px "Baloo 2"', 'Single Line Màn'),
    document.fonts.load('600 20px "Baloo 2"', 'Chọn màn đường'),
  ]);
  const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
  try {
    await Promise.race([loads, timeout]);
  } catch {
    // Fall back to system fonts
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadFonts(), progress.load()]);
  sound.setMuted(progress.muted || !ytService.isAudioEnabled());
  ytService.onAudioChange((enabled) => sound.setMuted(!enabled || progress.muted));
  new Phaser.Game(config);
});
