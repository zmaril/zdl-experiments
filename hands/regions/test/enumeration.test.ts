/**
 * Full enumeration + sensitivity run (the heavy test). Asserts structural
 * invariants of the counts (monotonicity of rule toggles, category totals,
 * size-1 base cases) and prints the headline numbers.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CATEGORIES } from '../src/categorize.js';
import { computeResults } from '../src/results.js';
import { ALL_RULES } from '../src/rules.js';

const res = computeResults();

test('raw space sizes are the advertised powers of two', () => {
  assert.equal(res.coarse.nPairs, 36);
  assert.equal(res.coarse.rawAllSizes, 1n << 36n);
  assert.equal(res.fine.nPairs, 400);
  assert.equal(res.fine.rawAllSizes, 1n << 400n);
  assert.equal(res.coarseWrist.nPairs, 49);
});

test('feasible counts are bounded by raw counts', () => {
  assert.ok(res.coarse.baseline.feasible < res.coarse.rawBounded);
  assert.ok(res.fine.baseline.feasible < res.fine.rawBounded);
  assert.ok(res.coarse.analyticOrientation < res.coarse.rawAllSizes);
  assert.ok(
    res.coarse.analyticOrientationOpposite! < res.coarse.analyticOrientation,
    'adding oppositeFaces can only shrink the count',
  );
  assert.ok(res.fine.analyticOrientation < res.fine.rawAllSizes);
});

test('size-1 feasible count = pairs with a nonempty orientation mask', () => {
  for (const g of [res.coarse, res.fine]) {
    let nonzero = 0;
    for (let p = 0; p < g.model.nPairs; p++) {
      if (g.model.pairOrientMask[p] !== 0) nonzero++;
    }
    assert.equal(g.baseline.bySize[1], nonzero);
  }
});

test('every rule filters: each leave-one-out count >= baseline, each only-one >= baseline', () => {
  for (const g of [res.coarse, res.fine]) {
    const baseline = g.sensitivity.find((r) => r.label.includes('baseline'))!.feasible;
    for (const row of g.sensitivity) {
      assert.ok(
        row.feasible >= baseline,
        `${row.label}: ${row.feasible} should be >= baseline ${baseline}`,
      );
    }
    // each rule individually removes something at these sizes; the span cap
    // can only fire when sets may exceed it (fine K=3 <= cap 4 cannot)
    for (const row of g.sensitivity) {
      if (row.label.startsWith('without ')) {
        if (row.label.includes('smallRegionSpan') && g.maxSize <= g.model.spanCap) {
          assert.equal(row.feasible, baseline, `${row.label}: span cap unreachable at K<=cap`);
        } else {
          assert.ok(
            row.feasible > baseline,
            `${row.label} should strictly exceed baseline (rule has bite)`,
          );
        }
      }
    }
    const raw = g.sensitivity.find((r) => r.label.startsWith('no rules'))!.feasible;
    assert.equal(raw, g.rawBounded);
  }
});

test('categories partition the feasible sets', () => {
  for (const g of [res.coarse, res.fine]) {
    const total = CATEGORIES.reduce((s, c) => s + g.baseline.byCategory![c], 0);
    assert.equal(total, g.baseline.feasible);
    assert.ok(g.baseline.symmetric! > 0);
    assert.ok(g.baseline.symmetric! < g.baseline.feasible);
  }
});

test('bySize sums to the feasible total', () => {
  for (const g of [res.coarse, res.fine]) {
    const sum = g.baseline.bySize.reduce((a, b) => a + b, 0);
    assert.equal(sum, g.baseline.feasible);
  }
});

test('adding the wrist region strictly enlarges the feasible space', () => {
  assert.ok(res.coarseWrist.baseline.feasible > res.coarse.baseline.feasible);
});

test('all named grips feasible (aggregate)', () => {
  for (const n of res.namedGrips) {
    assert.ok(n.coarseCheck.feasible, `${n.grip.name} coarse: ${n.coarseCheck.failed.join(',')}`);
    assert.ok(n.fineCheck.feasible, `${n.grip.name} fine: ${n.fineCheck.failed.join(',')}`);
  }
});

test('headline counts (regression snapshot + printout)', () => {
  const c = res.coarse;
  const f = res.fine;
  console.log('--- headline counts ---');
  console.log(`coarse raw (all sizes): 2^36 = ${c.rawAllSizes}`);
  console.log(`coarse orientation-feasible (exact, all sizes): ${c.analyticOrientation}`);
  console.log(`coarse orientation+oppositeFaces (exact, all sizes): ${c.analyticOrientationOpposite}`);
  console.log(`coarse feasible (all rules, sizes 1..${c.maxSize}): ${c.baseline.feasible} of raw ${c.rawBounded}`);
  console.log(`coarse by category:`, c.baseline.byCategory);
  console.log(`fine feasible (all rules, sizes 1..${f.maxSize}): ${f.baseline.feasible} of raw ${f.rawBounded}`);
  console.log(`fine by category:`, f.baseline.byCategory);
  for (const g of [c, f]) {
    console.log(`--- sensitivity (${g.model.granularity}, sizes 1..${g.maxSize}) ---`);
    for (const row of g.sensitivity) console.log(`  ${row.label}: ${row.feasible}`);
  }
  // pinned regression snapshots (recompute if the region/rule DATA changes;
  // these guard against accidental engine regressions):
  assert.ok(ALL_RULES.orientation);
  assert.equal(c.analyticOrientation, 2_153_775_113n);
  assert.equal(c.analyticOrientationOpposite, 1_212_678_153n);
  assert.equal(c.baseline.feasible, 939_856);
  assert.equal(f.baseline.feasible, 237_275);
  assert.equal(res.coarseWrist.baseline.feasible, 5_155_457);
});
