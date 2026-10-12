// Level generator for Single Line.
// Run with `npm run levels` — it rewrites src/levels.ts.
//
// Levels 1–5 are hand-drawn shapes. Levels 6–50 are produced by a seeded random
// walk on a grid: the walk itself is a valid one-stroke solution, so every level
// is solvable by construction. Among many candidate walks we keep the one whose
// "random player success rate" is closest to the target difficulty for that level.
// Finally every level is re-validated (Euler condition + clean geometry).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const TOTAL_LEVELS = 50;
const SEED = 20261012;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Hand-drawn openers (grid coordinates). edges: [a, b, passes]
// ---------------------------------------------------------------------------
const HAND_LEVELS = [
  // 1. Triangle — a closed loop, start anywhere
  { nodes: [[1, 0], [0, 2], [2, 2]], edges: [[0, 1, 1], [1, 2, 1], [2, 0, 1]] },
  // 2. Square with one diagonal — teaches that the start point matters
  {
    nodes: [[0, 0], [2, 0], [2, 2], [0, 2]],
    edges: [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 0, 1], [0, 2, 1]],
  },
  // 3. Bow tie
  {
    nodes: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    edges: [[0, 1, 1], [0, 2, 1], [1, 2, 1], [3, 4, 1], [3, 2, 1], [4, 2, 1]],
  },
  // 4. Domino (two squares sharing a side)
  {
    nodes: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
    edges: [[0, 1, 1], [1, 2, 1], [3, 4, 1], [4, 5, 1], [0, 3, 1], [1, 4, 1], [2, 5, 1]],
  },
  // 5. The classic envelope house
  {
    nodes: [[1, 0], [0, 1], [2, 1], [1, 2], [0, 3], [2, 3]],
    edges: [
      [0, 1, 1], [0, 2, 1], [1, 2, 1], [1, 4, 1], [2, 5, 1], [4, 5, 1],
      [1, 3, 1], [3, 5, 1], [2, 3, 1], [3, 4, 1],
    ],
  },
];

// ---------------------------------------------------------------------------
// Difficulty curve for generated levels
// ---------------------------------------------------------------------------
function paramsFor(level) {
  const t = (level - 6) / (TOTAL_LEVELS - 6); // 0..1
  let cols, rows;
  if (level <= 10) [cols, rows] = [3, 4];
  else if (level <= 16) [cols, rows] = [4, 4];
  else if (level <= 25) [cols, rows] = [4, 5];
  else if (level <= 38) [cols, rows] = [5, 5];
  else [cols, rows] = [5, 6];

  const diag = level >= 11; // Chapter 2 introduces diagonals
  const maxDoubles = level < 31 ? 0 : level <= 35 ? 1 : level <= 42 ? 2 : 3; // Chapter 4+
  const steps = Math.round(8 + 30 * Math.pow(t, 0.9));
  const targetRate = 0.55 * Math.pow(1 - t, 1.6) + 0.015; // chance a random scribbler wins
  return { cols, rows, diag, maxDoubles, steps, targetRate };
}

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRS8 = [...DIRS4, [1, 1], [-1, -1], [1, -1], [-1, 1]];

function randomWalk(p, rng) {
  const idx = (x, y) => y * p.cols + x;
  const used = new Map(); // "a|b" -> passes
  const diagCells = new Map(); // "cx|cy" -> '\\' | '/'
  const visited = new Set();
  let x = Math.floor(rng() * p.cols);
  let y = Math.floor(rng() * p.rows);
  visited.add(idx(x, y));
  let lastKey = null;
  let doubles = 0;
  let steps = 0;

  while (steps < p.steps) {
    const cands = [];
    for (const [dx, dy] of p.diag ? DIRS8 : DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= p.cols || ny >= p.rows) continue;
      const a = idx(x, y);
      const b = idx(nx, ny);
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (key === lastKey) continue;
      const c = used.get(key) || 0;
      let cellKey = null;
      let kind = null;
      if (dx !== 0 && dy !== 0) {
        cellKey = `${Math.min(x, nx)}|${Math.min(y, ny)}`;
        kind = dx * dy > 0 ? '\\' : '/';
        const other = diagCells.get(cellKey);
        if (other && other !== kind) continue; // would cross the other diagonal
      }
      let w = 0;
      if (c === 0) {
        w = visited.has(b) ? 1 : 2.2;
        if (dx !== 0 && dy !== 0) w *= 0.8;
      } else if (c === 1 && doubles < p.maxDoubles) {
        w = 0.35;
      }
      if (w > 0) cands.push({ nx, ny, key, c, cellKey, kind, w });
    }
    if (!cands.length) break;
    let r = rng() * cands.reduce((s, cd) => s + cd.w, 0);
    let pick = cands[cands.length - 1];
    for (const cd of cands) {
      r -= cd.w;
      if (r <= 0) {
        pick = cd;
        break;
      }
    }
    used.set(pick.key, pick.c + 1);
    if (pick.c === 1) doubles++;
    if (pick.cellKey) diagCells.set(pick.cellKey, pick.kind);
    x = pick.nx;
    y = pick.ny;
    visited.add(idx(x, y));
    lastKey = pick.key;
    steps++;
  }

  // Convert to compact level: only used nodes, cropped to bounding box
  const ids = new Set();
  for (const k of used.keys()) k.split('|').forEach((s) => ids.add(+s));
  const list = [...ids].sort((a, b) => a - b);
  const xs = list.map((i) => i % p.cols);
  const ys = list.map((i) => Math.floor(i / p.cols));
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const remap = new Map(list.map((id, i) => [id, i]));
  const nodes = list.map((id) => [(id % p.cols) - minX, Math.floor(id / p.cols) - minY]);
  const edges = [...used.entries()].map(([k, c]) => {
    const [a, b] = k.split('|').map(Number);
    return [remap.get(a), remap.get(b), c];
  });
  return { nodes, edges, steps };
}

// ---------------------------------------------------------------------------
// Analysis helpers
// ---------------------------------------------------------------------------
function degrees(level) {
  const deg = new Array(level.nodes.length).fill(0);
  for (const [a, b, c] of level.edges) {
    deg[a] += c;
    deg[b] += c;
  }
  return deg;
}

function isConnected(level) {
  const adj = level.nodes.map(() => []);
  for (const [a, b] of level.edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const n = stack.pop();
    for (const m of adj[n]) if (!seen.has(m)) seen.add(m), stack.push(m);
  }
  return seen.size === level.nodes.length;
}

// Probability that someone picking random available edges (from a valid start) finishes.
function randomSuccessRate(level, rng, trials = 400) {
  const deg = degrees(level);
  const odd = deg.map((d, i) => (d % 2 ? i : -1)).filter((i) => i >= 0);
  const starts = odd.length ? odd : level.nodes.map((_, i) => i);
  const total = level.edges.reduce((s, e) => s + e[2], 0);
  let wins = 0;
  for (let t = 0; t < trials; t++) {
    const left = level.edges.map((e) => e[2]);
    let cur = starts[Math.floor(rng() * starts.length)];
    let done = 0;
    for (;;) {
      const opts = [];
      level.edges.forEach(([a, b], i) => {
        if (left[i] > 0 && (a === cur || b === cur)) opts.push(i);
      });
      if (!opts.length) break;
      const i = opts[Math.floor(rng() * opts.length)];
      left[i]--;
      done++;
      cur = level.edges[i][0] === cur ? level.edges[i][1] : level.edges[i][0];
    }
    if (done === total) wins++;
  }
  return wins / trials;
}

function cross(o, a, b) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function onSegment(p, a, b) {
  return (
    cross(a, b, p) === 0 &&
    Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1])
  );
}

function validate(level, n) {
  const fail = (msg) => {
    throw new Error(`Level ${n}: ${msg}`);
  };
  const deg = degrees(level);
  const odd = deg.filter((d) => d % 2).length;
  if (odd !== 0 && odd !== 2) fail(`${odd} odd nodes — not drawable in one stroke`);
  if (!isConnected(level)) fail('graph is not connected');
  if (deg.some((d) => d === 0)) fail('isolated node');
  const seen = new Set();
  level.edges.forEach(([a, b], i) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) fail('duplicate edge');
    seen.add(key);
    const A = level.nodes[a];
    const B = level.nodes[b];
    level.nodes.forEach((P, k) => {
      if (k !== a && k !== b && onSegment(P, A, B)) fail(`edge ${i} passes through node ${k}`);
    });
    level.edges.forEach(([c, d], j) => {
      if (j <= i || c === a || c === b || d === a || d === b) return;
      const C = level.nodes[c];
      const D = level.nodes[d];
      const d1 = cross(A, B, C);
      const d2 = cross(A, B, D);
      const d3 = cross(C, D, A);
      const d4 = cross(C, D, B);
      if (d1 * d2 < 0 && d3 * d4 < 0) fail(`edges ${i} and ${j} cross`);
    });
  });
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
const rng = mulberry32(SEED);
const levels = [];
const report = [];

HAND_LEVELS.forEach((lv, i) => levels.push(lv) && report.push({ n: i + 1, rate: randomSuccessRate(lv, rng) }));

for (let n = HAND_LEVELS.length + 1; n <= TOTAL_LEVELS; n++) {
  const p = paramsFor(n);
  let best = null;
  for (let attempt = 0; attempt < 140; attempt++) {
    const cand = randomWalk(p, rng);
    if (cand.steps < p.steps * 0.92) continue;
    const doubles = cand.edges.filter((e) => e[2] > 1).length;
    if (p.maxDoubles > 0 && doubles === 0) continue; // chapter 4+ must use the mechanic
    const deg = degrees(cand);
    const branches = deg.filter((d) => d >= 3).length;
    if (branches < Math.min(2 + Math.floor(n / 8), 8)) continue;
    const rate = randomSuccessRate(cand, rng, 300);
    const score = Math.abs(Math.log((rate + 0.005) / (p.targetRate + 0.005)));
    if (!best || score < best.score) best = { ...cand, rate, score };
  }
  if (!best) throw new Error(`Could not generate level ${n}`);
  levels.push({ nodes: best.nodes, edges: best.edges });
  report.push({ n, rate: best.rate });
}

levels.forEach((lv, i) => validate(lv, i + 1));

const body = levels
  .map((lv) => {
    const cols = Math.max(...lv.nodes.map((p) => p[0])) + 1;
    const rows = Math.max(...lv.nodes.map((p) => p[1])) + 1;
    return `  { cols: ${cols}, rows: ${rows}, nodes: ${JSON.stringify(lv.nodes)}, edges: ${JSON.stringify(lv.edges)} },`;
  })
  .join('\n');

const out = `// AUTO-GENERATED by scripts/generate-levels.mjs — do not edit by hand.
// Change the generator and run \`npm run levels\` instead.

export interface LevelData {
  /** Grid size the nodes live on (used to scale the board). */
  cols: number;
  rows: number;
  /** Node positions in grid units: [x, y]. */
  nodes: [number, number][];
  /** Edges: [nodeA, nodeB, passes]. passes = 2 means the thread must go over it twice. */
  edges: [number, number, number][];
}

export const LEVELS: LevelData[] = [
${body}
];
`;

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(resolve(here, '../src/levels.ts'), out);

console.log(`Wrote ${levels.length} levels to src/levels.ts`);
for (const r of report) {
  const lv = levels[r.n - 1];
  const passes = lv.edges.reduce((s, e) => s + e[2], 0);
  const doubles = lv.edges.filter((e) => e[2] > 1).length;
  console.log(
    `  #${String(r.n).padStart(2)}  nodes ${String(lv.nodes.length).padStart(2)}  strokes ${String(passes).padStart(2)}  doubles ${doubles}  random-win ${(r.rate * 100).toFixed(1)}%`
  );
}
