/**
 * End-to-end census: reproduces the partition-model counts, refines every
 * cell topologically, runs the move-word demos, prints a summary and
 * writes results/enumeration.json. Entry point of `npm run enumerate`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refineAll } from './refine.js';
import { fingerprint, fingerprintKey } from './invariants.js';
import { buildNamedPosition, NAMED_POSITIONS } from '../model/positions.js';
import { sequencesEqual, sequenceUnwinds } from '../model/moves.js';

function main(): void {
  const { summary, cells } = refineAll();

  const line = (s = '') => process.stdout.write(s + '\n');
  line('=== zdl-experiments: knot-theoretic census of two-dancer hand connections ===');
  line();
  line('--- Partition model (Maril, "A New Kind of Dance Science") ---');
  line(`hand partitions (Bell(4)):            ${summary.partitions}`);
  line(`candidate states (x 2^4 hammerlocks): ${summary.candidates}`);
  const c = summary.census;
  line(
    `census: impossible ${c.impossible} | weird ${c.weird} | boring ${c.boring} | ` +
      `stable ${c.stable} | mixed ${c.mixed} | transition ${c.transition}`,
  );
  line(`feasible (stable+mixed+transition):   ${c.feasible}`);
  line(
    '(all six category counts match the blog post; the "impossible" rule is a',
  );
  line(
    ' documented reconstruction — both hands of one dancer hammerlocked in one grip)',
  );
  line();
  line('--- Topological refinement (this project) ---');
  line(
    'Crossing bound: <= 2 crossings per strand-object pair (forced routing',
  );
  line(
    'crossings with over/under choices + one optional front clasp). Class');
  line(
    'counts are brackets [invariant lower bound, distinct-diagram upper bound]:',
  );
  line(
    'equal invariants prove nothing, so the truth lies between the two.');
  line();
  line(`cells refined (feasible + boring):    ${summary.refinedCells}`);
  line(
    `  representable as links:             ${summary.representableCells}`,
  );
  line(
    `  multi-hand grips (spatial graphs):  ${summary.unrepresentable.multiGrip}  (not refined: 3+/4-hand grips are trivalent graphs, not links)`,
  );
  line(
    `  back-to-back double hammerlocks:    ${summary.unrepresentable.backToBack}  (grip behind both backs: needs non-facing orientation, out of frame)`,
  );
  line();
  line('per-partition refinement (classes among representable cells):');
  const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
  line(
    pad('partition', 14) +
      pad('classes', 12) +
      pad('diagrams', 10) +
      pad('cells b/s/m/t', 15) +
      'name',
  );
  for (const p of summary.perPartition) {
    const classes =
      p.representableCells === 0
        ? 'n/a'
        : p.classesLower === p.classesUpper
          ? `${p.classesLower}`
          : `[${p.classesLower}, ${p.classesUpper}]`;
    const cc = p.cells;
    line(
      pad(p.partitionId, 14) +
        pad(classes, 12) +
        pad(String(p.diagrams), 10) +
        pad(`${cc.boring}/${cc.stable}/${cc.mixed}/${cc.transition}`, 15) +
        p.name,
    );
  }
  const t = summary.totals;
  line(
    `TOTALS: entanglement classes in [${t.classesLower}, ${t.classesUpper}] across ${t.diagrams} enumerated diagrams`,
  );
  line();
  line('projection checks (asserted in tests):');
  line('  - forgetting entanglement returns each diagram to its census cell;');
  line('  - forgetting hammerlocks returns exactly the 15 partitions;');
  line('  - free-hand hammerlocks (all transition cells) are topologically');
  line('    invisible: the census distinguishes them, the tangles do not;');
  line('  - fake (same-flank) hammerlock wraps collapse to the front grip.');
  line();
  line('--- Named positions ---');
  for (const spec of NAMED_POSITIONS) {
    const np = buildNamedPosition(spec.id);
    line(`${pad(np.id, 22)} ${fingerprintKey(fingerprint(np.built))}`);
  }
  line();
  line('--- Moves (braid words on the four arms) ---');
  const show = (label: string, v: boolean | 'unknown') => line(`  ${pad(label, 58)} ${v}`);
  show('cross then duck unwinds:', sequenceUnwinds(['cross', 'duck']));
  show('cross alone unwinds:', sequenceUnwinds(['cross']));
  show(
    'follower turn + reverse turn unwinds:',
    sequenceUnwinds(['follower-turn', 'follower-turn-reverse']),
  );
  show('two same-way follower turns unwind:', sequenceUnwinds(['follower-turn', 'follower-turn']));
  show(
    'leader turn == follower turn:',
    sequencesEqual(['leader-turn'], ['follower-turn']),
  );
  show(
    'leader/follower turns commute:',
    sequencesEqual(['leader-turn', 'follower-turn'], ['follower-turn', 'leader-turn']),
  );
  show(
    'follower turn commutes with cross:',
    sequencesEqual(['follower-turn', 'cross'], ['cross', 'follower-turn']),
  );
  line();

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, '..', '..', 'results');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'enumeration.json');
  writeFileSync(outFile, JSON.stringify({ summary, cells }, null, 2) + '\n');
  line(`full table written to ${outFile}`);
}

main();
