/**
 * Model-level tests: orientation semantics, and brute-force cross-validation
 * of both counting engines (bounded DFS enumeration and inclusion-exclusion
 * analytics) on a reduced region set where all 2^16 subsets can be checked
 * directly against the rule predicates.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analyticCount } from '../src/analytic.js';
import { enumerateGrips } from '../src/enumerate.js';
import { buildModel, orientationMask, pairIndex } from '../src/model.js';
import { coarseHand, restrictHand } from '../src/regions.js';
import {
  ALL_RULES,
  checkGrip,
  isConnected,
  violatesOppositeFaces,
  violatesSpan,
  type RuleToggles,
} from '../src/rules.js';

const coarse = buildModel(coarseHand());
const region = (id: string) => {
  const r = coarse.regionsA.find((x) => x.id === id);
  assert.ok(r, `region ${id}`);
  return r!;
};

test('orientation masks: rigid faces pin the orientation', () => {
  const palm = region('palm');
  const dorsum = region('dorsum');
  // palm-to-palm realizable only at (P,P); back-to-back only at (D,D)
  assert.equal(orientationMask(palm, palm).toString(2).split('1').length - 1, 1);
  assert.equal(orientationMask(dorsum, dorsum).toString(2).split('1').length - 1, 1);
  assert.equal(orientationMask(palm, palm) & orientationMask(dorsum, dorsum), 0);
  // A's palm on B's palm vs A's palm on B's dorsum are also incompatible
  assert.equal(orientationMask(palm, palm) & orientationMask(palm, dorsum), 0);
});

test('orientation masks: mobile regions wrap to the far side', () => {
  const fingers = region('fingers');
  const dorsum = region('dorsum');
  const palm = region('palm');
  // handshake: palms facing, fingers reach the partner dorsum
  const mask = orientationMask(palm, palm) & orientationMask(fingers, dorsum);
  assert.notEqual(mask, 0, 'fingers wrap to dorsum while palms face');
  // grab-from-behind: A palm on B dorsum while A fingers curl to B palm
  const mask2 = orientationMask(palm, dorsum) & orientationMask(fingers, palm);
  assert.notEqual(mask2, 0);
});

test('headline exclusion: palm-to-palm + back-to-back is infeasible', () => {
  const check = checkGrip(coarse, [
    { a: 'palm', b: 'palm' },
    { a: 'dorsum', b: 'dorsum' },
  ]);
  assert.equal(check.feasible, false);
  assert.deepEqual(check.failed, ['orientation']);
});

test('pinch grip survives (opposition + slab-thickness adjacency)', () => {
  const check = checkGrip(coarse, [
    { a: 'thumb', b: 'palm' },
    { a: 'fingertips', b: 'dorsum' },
  ]);
  assert.equal(check.feasible, true, `failed rules: ${check.failed.join(',')}`);
});

test('mutual C-grip survives connectivity (anti-over-filtering regression)', () => {
  const check = checkGrip(coarse, [
    { a: 'fingertips', b: 'palm' },
    { a: 'palm', b: 'fingertips' },
  ]);
  assert.equal(check.feasible, true, `failed rules: ${check.failed.join(',')}`);
});

test('oppositeFaces: thumb cannot touch both faces; finger group can', () => {
  const thumbBoth = checkGrip(coarse, [
    { a: 'thumb', b: 'palm' },
    { a: 'thumb', b: 'dorsum' },
  ]);
  assert.equal(thumbBoth.feasible, false);
  assert.ok(thumbBoth.failed.includes('oppositeFaces'));

  const fingersBoth = checkGrip(coarse, [
    { a: 'fingers', b: 'palm' },
    { a: 'fingers', b: 'dorsum' },
  ]);
  assert.equal(fingersBoth.feasible, true, `failed: ${fingersBoth.failed.join(',')}`);
});

test('smallRegionSpan: fingertips capped at 3 partner regions (coarse)', () => {
  const overSpan = checkGrip(coarse, [
    { a: 'fingertips', b: 'palm' },
    { a: 'fingertips', b: 'fingers' },
    { a: 'fingertips', b: 'fingertips' },
    { a: 'fingertips', b: 'thumb' },
  ]);
  assert.equal(overSpan.feasible, false);
  assert.ok(overSpan.failed.includes('smallRegionSpan'));
});

test('empty set: vacuously passes rules but is excluded from counts', () => {
  const check = checkGrip(coarse, []);
  assert.equal(check.feasible, true);
  const res = enumerateGrips(coarse, { maxSize: 1, toggles: ALL_RULES });
  assert.equal(res.bySize[0], 0);
});

/* ------------------------------------------------------------------ */
/* Brute-force cross-validation on a reduced model                     */
/* ------------------------------------------------------------------ */

const REDUCED_IDS = ['palm', 'dorsum', 'thumb', 'fingers'];
const reduced = buildModel(restrictHand(coarseHand(), REDUCED_IDS));

function bruteForceCount(toggles: RuleToggles): number {
  const n = reduced.nPairs; // 16
  let count = 0;
  for (let s = 1; s < 1 << n; s++) {
    const idx: number[] = [];
    for (let p = 0; p < n; p++) if (s & (1 << p)) idx.push(p);
    let ok = true;
    if (toggles.orientation) {
      let mask = (1 << 9) - 1;
      for (const p of idx) mask &= reduced.pairOrientMask[p]!;
      if (mask === 0) ok = false;
    }
    if (ok && toggles.oppositeFaces && violatesOppositeFaces(reduced, idx)) ok = false;
    if (ok && toggles.connectedInterface && !isConnected(reduced, idx)) ok = false;
    if (ok && toggles.smallRegionSpan && violatesSpan(reduced, idx)) ok = false;
    if (ok) count++;
  }
  return count;
}

const CONFIGS: Array<[string, RuleToggles]> = [
  ['orientation only', { orientation: true, oppositeFaces: false, connectedInterface: false, smallRegionSpan: false }],
  ['orientation+oppositeFaces', { orientation: true, oppositeFaces: true, connectedInterface: false, smallRegionSpan: false }],
  ['all rules', ALL_RULES],
  ['connectivity only', { orientation: false, oppositeFaces: false, connectedInterface: true, smallRegionSpan: false }],
];

for (const [label, toggles] of CONFIGS) {
  test(`reduced 4x4 model: DFS enumeration matches brute force (${label})`, () => {
    const brute = bruteForceCount(toggles);
    const dfs = enumerateGrips(reduced, { maxSize: reduced.nPairs, toggles }).feasible;
    assert.equal(dfs, brute);
  });
}

test('reduced 4x4 model: inclusion-exclusion analytics match brute force', () => {
  const bruteR1 = bruteForceCount(CONFIGS[0]![1]);
  assert.equal(analyticCount(reduced), BigInt(bruteR1));
  const bruteR1R2 = bruteForceCount(CONFIGS[1]![1]);
  assert.equal(analyticCount(reduced, { withOppositeFaces: true }), BigInt(bruteR1R2));
});

test('checkGrip agrees with brute-force predicates on all reduced subsets', () => {
  const n = reduced.nPairs;
  for (let s = 1; s < 1 << n; s++) {
    const pairs = [];
    for (let p = 0; p < n; p++) {
      if (s & (1 << p)) {
        pairs.push({
          a: reduced.regionsA[reduced.pairA[p]!]!.id,
          b: reduced.regionsB[reduced.pairB[p]!]!.id,
        });
      }
    }
    const viaCheck = checkGrip(reduced, pairs, ALL_RULES).feasible;
    const idx = pairs.map((pr) => pairIndex(reduced, pr));
    let mask = (1 << 9) - 1;
    for (const p of idx) mask &= reduced.pairOrientMask[p]!;
    const direct =
      mask !== 0 &&
      !violatesOppositeFaces(reduced, idx) &&
      isConnected(reduced, idx) &&
      !violatesSpan(reduced, idx);
    assert.equal(viaCheck, direct);
  }
});
