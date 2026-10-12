import { LEVELS } from '../src/levels';
import { Puzzle } from '../src/puzzle';

// Sanity check: every level must be solvable via the hint solver, and the
// hint must recover from random dead ends.
let ok = 0;
LEVELS.forEach((lv, i) => {
  const p = new Puzzle(lv);
  const route = p.solve();
  if (!route || route.length !== p.totalPasses + 1) throw new Error(`Level ${i + 1}: bad route`);
  p.start(route[0]);
  for (const n of route.slice(1)) if (p.moveTo(n) < 0) throw new Error(`Level ${i + 1}: route move failed`);
  if (!p.isComplete()) throw new Error(`Level ${i + 1}: not complete`);

  // Random scribbles, then follow hints to the end
  for (let t = 0; t < 30; t++) {
    p.reset();
    p.start(Math.floor(Math.random() * lv.nodes.length));
    for (;;) {
      const opts = p.adj[p.current!].filter((l) => p.left[l.edge] > 0);
      if (!opts.length) break;
      p.moveTo(opts[Math.floor(Math.random() * opts.length)].to);
    }
    while (!p.isComplete()) {
      let r = p.solve();
      while (!r && p.undo()) r = p.solve();
      if (!r) throw new Error(`Level ${i + 1}: hint found nothing`);
      if (p.current === null) p.start(r[0]);
      else if (p.moveTo(r[1]) < 0) throw new Error(`Level ${i + 1}: hint move failed`);
    }
  }
  ok++;
});
console.log(`All ${ok} levels solvable; hints recover from dead ends.`);
