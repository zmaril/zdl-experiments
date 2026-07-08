/**
 * Sanity checks in the style of the ZDL set-partition work: every named
 * partner-dance grip must map to a contact set that passes ALL feasibility
 * rules, at both granularities, and must land in the expected category.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categorize } from '../src/categorize.js';
import { buildModel } from '../src/model.js';
import { NAMED_GRIPS } from '../src/named-grips.js';
import { coarseHand, fineHand } from '../src/regions.js';
import { ALL_RULES, checkGrip } from '../src/rules.js';
import { COARSE_MAX_SIZE } from '../src/results.js';

const coarse = buildModel(coarseHand());
const fine = buildModel(fineHand());
const coarseWrist = buildModel(coarseHand({ includeWrist: true }));
const fineWrist = buildModel(fineHand({ includeWrist: true }));

for (const grip of NAMED_GRIPS) {
  const cm = grip.needsWrist ? coarseWrist : coarse;
  const fm = grip.needsWrist ? fineWrist : fine;

  test(`${grip.name}: coarse contact set is feasible under all rules`, () => {
    const check = checkGrip(cm, grip.coarse, ALL_RULES);
    assert.equal(check.feasible, true, `failed rules: ${check.failed.join(', ')}`);
    assert.ok(check.orientations.length > 0, 'at least one compatible orientation');
  });

  test(`${grip.name}: fine contact set is feasible under all rules`, () => {
    const check = checkGrip(fm, grip.fine, ALL_RULES);
    assert.equal(check.feasible, true, `failed rules: ${check.failed.join(', ')}`);
  });

  test(`${grip.name}: categorized as ${grip.expectedCategory}, symmetric=${grip.expectedSymmetric}`, () => {
    const cc = categorize(cm, grip.coarse);
    assert.equal(cc.category, grip.expectedCategory, 'coarse category');
    assert.equal(cc.symmetric, grip.expectedSymmetric, 'coarse symmetry');
    const fc = categorize(fm, grip.fine);
    assert.equal(fc.category, grip.expectedCategory, 'fine category');
    assert.equal(fc.symmetric, grip.expectedSymmetric, 'fine symmetry');
  });
}

test('wrist hold requires the optional wrist region (explicit limitation)', () => {
  const grip = NAMED_GRIPS.find((g) => g.id === 'wristHold')!;
  assert.throws(() => checkGrip(coarse, grip.coarse), /unknown region/);
});

test('every non-wrist coarse named grip fits inside the enumeration bound', () => {
  for (const grip of NAMED_GRIPS) {
    if (grip.needsWrist) continue;
    assert.ok(
      grip.coarse.length <= COARSE_MAX_SIZE,
      `${grip.name} uses ${grip.coarse.length} > ${COARSE_MAX_SIZE} coarse pairs`,
    );
  }
});
