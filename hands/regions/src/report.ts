/**
 * Console report: raw / analytic / bounded-enumeration counts at both
 * granularities, sensitivity sweep, and the named-grip table.
 * Run with: npm run report
 */

import { sci } from './analytic.js';
import { CATEGORIES } from './categorize.js';
import { computeResults, type GranularityResults } from './results.js';

function line(s = ''): void {
  console.log(s);
}

function header(s: string): void {
  line();
  line(`=== ${s} ${'='.repeat(Math.max(0, 60 - s.length))}`);
}

function fmt(n: number | bigint): string {
  return n.toLocaleString('en-US');
}

function granularityReport(label: string, g: GranularityResults): void {
  header(`${label} granularity (${g.model.regionsA.length} regions/hand, ${g.nPairs} contact pairs)`);
  line(`raw space (all sizes):        2^${g.nPairs} = ${sci(g.rawAllSizes)}`);
  line(`orientation-feasible (exact, all sizes): ${fmt(g.analyticOrientation)} (${sci(g.analyticOrientation)})`);
  if (g.analyticOrientationOpposite !== undefined) {
    line(`orientation+oppositeFaces (exact, all sizes): ${fmt(g.analyticOrientationOpposite)}`);
  }
  line();
  line(`bounded enumeration, contact sets of size 1..${g.maxSize}:`);
  line(`  raw:      ${fmt(g.rawBounded)}`);
  line(`  feasible: ${fmt(g.baseline.feasible)} (all rules)`);
  line(`  by size:  ${g.baseline.bySize.slice(1).map((n, i) => `${i + 1}:${fmt(n)}`).join('  ')}`);
  if (g.baseline.byCategory) {
    line(`  by category: ${CATEGORIES.map((c) => `${c}:${fmt(g.baseline.byCategory![c])}`).join('  ')}`);
    line(`  symmetric: ${fmt(g.baseline.symmetric!)}`);
  }
  line();
  line('sensitivity (feasible count, sets of size 1..' + g.maxSize + '):');
  const w = Math.max(...g.sensitivity.map((r) => r.label.length));
  for (const row of g.sensitivity) {
    line(`  ${row.label.padEnd(w)}  ${fmt(row.feasible)}`);
  }
}

const res = computeResults();

line('Contact-region combinatorics of a single grip (leader R hand x follower L hand)');
line('Raw space = all sets of cross-hand contact pairs; empty set (no contact) excluded from counts.');

granularityReport('COARSE', res.coarse);
granularityReport('FINE', res.fine);

header('COARSE + optional wrist region (7 regions/hand, 49 pairs)');
line(`raw space (all sizes): 2^49 = ${sci(res.coarseWrist.rawAllSizes)}`);
line(`feasible (all rules, sizes 1..${res.coarseWrist.baseline.maxSize}): ${fmt(res.coarseWrist.baseline.feasible)} (vs ${fmt(res.coarse.baseline.feasible)} without wrist)`);

header('Named dance grips (sanity checks)');
for (const n of res.namedGrips) {
  const c = n.coarseCheck.feasible ? 'feasible' : `INFEASIBLE(${n.coarseCheck.failed.join(',')})`;
  const f = n.fineCheck.feasible ? 'feasible' : `INFEASIBLE(${n.fineCheck.failed.join(',')})`;
  line(
    `${n.grip.name.padEnd(32)} coarse[${n.grip.coarse.length} pairs]: ${c}, ${n.coarseCategory}${n.coarseSymmetric ? ', symmetric' : ''}` +
      ` | fine[${n.grip.fine.length} pairs]: ${f}, ${n.fineCategory}${n.fineSymmetric ? ', symmetric' : ''}` +
      (n.grip.needsWrist ? ' | wrist-enabled model' : ''),
  );
}
line();
