import type { LevelData } from './levels';

interface Link {
  edge: number;
  to: number;
}

/**
 * Pure puzzle state: which edges still need thread, and the path drawn so far.
 * No rendering here, so it is easy to reason about (and to test).
 */
export class Puzzle {
  readonly level: LevelData;
  readonly adj: Link[][];
  readonly totalPasses: number;
  left: number[];
  /** Node sequence of the thread. Empty = not started. */
  path: number[] = [];
  /** Edge index used for each step (path.length - 1 entries). */
  steps: number[] = [];

  constructor(level: LevelData) {
    this.level = level;
    this.adj = level.nodes.map(() => []);
    level.edges.forEach(([a, b], i) => {
      this.adj[a].push({ edge: i, to: b });
      this.adj[b].push({ edge: i, to: a });
    });
    this.left = level.edges.map((e) => e[2]);
    this.totalPasses = level.edges.reduce((s, e) => s + e[2], 0);
  }

  get current(): number | null {
    return this.path.length ? this.path[this.path.length - 1] : null;
  }

  get donePasses(): number {
    return this.steps.length;
  }

  isComplete(): boolean {
    return this.steps.length === this.totalPasses;
  }

  passesDone(edge: number): number {
    return this.level.edges[edge][2] - this.left[edge];
  }

  start(node: number): boolean {
    if (this.path.length) return false;
    this.path.push(node);
    return true;
  }

  /** Edge index that can take thread from the current node to `node`, or -1. */
  openEdgeTo(node: number): number {
    const cur = this.current;
    if (cur === null) return -1;
    const link = this.adj[cur].find((l) => l.to === node && this.left[l.edge] > 0);
    return link ? link.edge : -1;
  }

  moveTo(node: number): number {
    const edge = this.openEdgeTo(node);
    if (edge < 0) return -1;
    this.left[edge]--;
    this.steps.push(edge);
    this.path.push(node);
    return edge;
  }

  /** Is `node` the one we just came from? (dragging back = undo) */
  isPrevious(node: number): boolean {
    return this.path.length >= 2 && this.path[this.path.length - 2] === node;
  }

  undo(): boolean {
    if (this.steps.length) {
      const edge = this.steps.pop()!;
      this.left[edge]++;
      this.path.pop();
      return true;
    }
    if (this.path.length) {
      this.path = [];
      return true;
    }
    return false;
  }

  reset() {
    this.left = this.level.edges.map((e) => e[2]);
    this.path = [];
    this.steps = [];
  }

  /**
   * Remaining one-stroke route from the current position (Hierholzer's algorithm),
   * or null if the current state is a dead end. When nothing is drawn yet it picks
   * a valid starting node.
   */
  solve(): number[] | null {
    const n = this.level.nodes.length;
    const deg = new Array(n).fill(0);
    this.level.edges.forEach(([a, b], i) => {
      deg[a] += this.left[i];
      deg[b] += this.left[i];
    });
    const remaining = this.left.reduce((s, c) => s + c, 0);
    const cur = this.current;
    if (remaining === 0) return cur === null ? [] : [cur];

    const odd: number[] = [];
    deg.forEach((d, i) => d % 2 && odd.push(i));

    let start: number;
    if (cur === null) {
      start = odd.length ? odd[0] : deg.findIndex((d) => d > 0);
    } else {
      if (deg[cur] === 0) return null;
      if (odd.length === 2 && !odd.includes(cur)) return null;
      start = cur;
    }
    if (odd.length !== 0 && odd.length !== 2) return null;

    // Every node that still has thread to take must be reachable from start
    const seen = new Set<number>([start]);
    const stack = [start];
    while (stack.length) {
      const v = stack.pop()!;
      for (const l of this.adj[v]) {
        if (this.left[l.edge] > 0 && !seen.has(l.to)) {
          seen.add(l.to);
          stack.push(l.to);
        }
      }
    }
    for (let i = 0; i < n; i++) if (deg[i] > 0 && !seen.has(i)) return null;

    const count = this.left.slice();
    const st = [start];
    const circuit: number[] = [];
    while (st.length) {
      const v = st[st.length - 1];
      const l = this.adj[v].find((x) => count[x.edge] > 0);
      if (l) {
        count[l.edge]--;
        st.push(l.to);
      } else {
        circuit.push(st.pop()!);
      }
    }
    return circuit.reverse();
  }
}
