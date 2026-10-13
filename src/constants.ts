// Single Line — shared constants
//
// Visual concept: stitching a single thread through brass pins on a felt board.
// The yarn is the one bold element; everything around it stays quiet.

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// Board area (where the puzzle is laid out), in game pixels
export const BOARD = {
  CENTER_X: GAME_WIDTH / 2,
  CENTER_Y: 640,
  MAX_W: 560,
  MAX_H: 700,
  MAX_SPACING: 190, // keeps tiny early levels from looking blown up
};

export const COLORS = {
  FELT: 0x23524c, // board / background
  FELT_DEEP: 0x183b37, // shadows, recesses, outlines
  FELT_LIGHT: 0x2e6760, // raised surfaces (buttons, panels)
  LINEN: 0xf3e9d2, // text, pin heads, unstitched guide
  BRASS: 0xd8a657, // pin bodies, accents
  BRASS_DARK: 0xa87a33,
};

export const HEX = {
  FELT: '#23524c',
  FELT_DEEP: '#183b37',
  LINEN: '#f3e9d2',
  LINEN_DIM: '#a9c2b9',
  BRASS: '#d8a657',
};

export interface YarnColor {
  main: number;
  light: number;
  dark: number;
  hex: string;
}

// One yarn colour per chapter
export const YARNS: YarnColor[] = [
  { main: 0xf07461, light: 0xffa696, dark: 0xb9493a, hex: '#f07461' }, // Coral
  { main: 0xf4b942, light: 0xffd885, dark: 0xb9821a, hex: '#f4b942' }, // Saffron
  { main: 0x74c0e3, light: 0xb2e0f4, dark: 0x3f8db0, hex: '#74c0e3' }, // Sky
  { main: 0xc193e0, light: 0xe0c6f2, dark: 0x8a5cab, hex: '#c193e0' }, // Plum
  { main: 0x95d48a, light: 0xc8edbf, dark: 0x5c9b52, hex: '#95d48a' }, // Leaf
];

export const LEVELS_PER_CHAPTER = 10;

export const CHAPTERS = [
  { name: 'First Stitch', tip: 'Connect all lines in a single stroke without lifting your finger.' },
  { name: 'Diagonal Weave', tip: 'Two odd pins? Start at one of them and finish at the other.' },
  { name: 'Narrow Pathways', tip: 'Never block your way back. Save your exits for last.' },
  { name: 'Double Loop', tip: 'Double lines must be crossed twice.' },
  { name: 'Master Tailor', tip: 'You have mastered the craft. Good luck!' },
];

export function chapterOf(levelIndex: number) {
  return Math.min(Math.floor(levelIndex / LEVELS_PER_CHAPTER), CHAPTERS.length - 1);
}

export function yarnFor(levelIndex: number): YarnColor {
  return YARNS[chapterOf(levelIndex) % YARNS.length];
}

export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';
