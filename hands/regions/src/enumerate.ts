/**
 * Explicit bounded enumeration of contact sets with monotone-rule pruning.
 *
 * The raw space is 2^(nA*nB) - astronomically large even at coarse
 * granularity (2^36), so explicit enumeration is bounded by a maximum
 * contact-set size K (every named dance grip we model fits comfortably:
 * the largest coarse mapping uses 6 pairs).
 *
 * Rules R1/R2/R4 are monotone (any superset of a violating set violates), so
 * they prune the DFS. R3 (connected interface) is not monotone and is
 * evaluated per visited set.
 */

import { categorizeIdx, type Category, CATEGORIES } from './categorize.js';
import type { GripModel } from './model.js';
import { isConnected, type RuleToggles } from './rules.js';

export interface EnumOptions {
  maxSize: number;
  toggles: RuleToggles;
  /** compute category/symmetry tallies (slower); default false */
  classify?: boolean;
}

export interface EnumResult {
  maxSize: number;
  /** number of feasible nonempty sets of size <= maxSize */
  feasible: number;
  /** feasible count by set size (index = size, entry 0 unused) */
  bySize: number[];
  /** raw (unfiltered) count of nonempty sets of size <= maxSize */
  rawBounded: number;
  byCategory?: Record<Category, number>;
  symmetric?: number;
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

export function rawBoundedCount(nPairs: number, maxSize: number): number {
  let total = 0;
  for (let k = 1; k <= maxSize; k++) total += binomial(nPairs, k);
  return total;
}

export function enumerateGrips(model: GripModel, opts: EnumOptions): EnumResult {
  const { maxSize, toggles } = opts;
  const classify = opts.classify ?? false;
  const nA = model.regionsA.length;
  const nB = model.regionsB.length;
  const nPairs = model.nPairs;
  const { pairA, pairB, pairOrientMask, regionsA, regionsB, spanCap } = model;

  // precomputed per-pair flags for incremental R2/R4
  const aSmall = new Uint8Array(nPairs);
  const bSmall = new Uint8Array(nPairs);
  const aExempt = new Uint8Array(nPairs); // A-region multiDigit (exempt from R2)
  const bExempt = new Uint8Array(nPairs);
  const bIsPalmar = new Uint8Array(nPairs); // B-region is palmar zone (counts against A-region)
  const bIsDorsal = new Uint8Array(nPairs);
  const aIsPalmar = new Uint8Array(nPairs);
  const aIsDorsal = new Uint8Array(nPairs);
  for (let p = 0; p < nPairs; p++) {
    const ra = regionsA[pairA[p]!]!;
    const rb = regionsB[pairB[p]!]!;
    aSmall[p] = ra.small ? 1 : 0;
    bSmall[p] = rb.small ? 1 : 0;
    aExempt[p] = ra.multiDigit ? 1 : 0;
    bExempt[p] = rb.multiDigit ? 1 : 0;
    bIsPalmar[p] = rb.palmarZone ? 1 : 0;
    bIsDorsal[p] = rb.isDorsum ? 1 : 0;
    aIsPalmar[p] = ra.palmarZone ? 1 : 0;
    aIsDorsal[p] = ra.isDorsum ? 1 : 0;
  }

  // incremental state
  const aPalmarCnt = new Int32Array(nA); // partner palmar zones touched by A-region
  const aDorsalCnt = new Int32Array(nA);
  const bPalmarCnt = new Int32Array(nB);
  const bDorsalCnt = new Int32Array(nB);
  const degA = new Int32Array(nA);
  const degB = new Int32Array(nB);
  const chosen: number[] = [];

  const bySize = new Array<number>(maxSize + 1).fill(0);
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  let symmetric = 0;
  let feasible = 0;

  const fullMask = (1 << 9) - 1;

  function rec(start: number, mask: number): void {
    for (let p = start; p < nPairs; p++) {
      const ai = pairA[p]!;
      const bi = pairB[p]!;
      let newMask = mask;
      if (toggles.orientation) {
        newMask = mask & pairOrientMask[p]!;
        if (newMask === 0) continue;
      }
      if (toggles.smallRegionSpan) {
        if (aSmall[p] && degA[ai]! + 1 > spanCap) continue;
        if (bSmall[p] && degB[bi]! + 1 > spanCap) continue;
      }
      if (toggles.oppositeFaces) {
        if (
          !aExempt[p] &&
          ((bIsPalmar[p] && aDorsalCnt[ai]! > 0) || (bIsDorsal[p] && aPalmarCnt[ai]! > 0))
        ) {
          continue;
        }
        if (
          !bExempt[p] &&
          ((aIsPalmar[p] && bDorsalCnt[bi]! > 0) || (aIsDorsal[p] && bPalmarCnt[bi]! > 0))
        ) {
          continue;
        }
      }
      // apply
      chosen.push(p);
      degA[ai]!++;
      degB[bi]!++;
      aPalmarCnt[ai]! += bIsPalmar[p]!;
      aDorsalCnt[ai]! += bIsDorsal[p]!;
      bPalmarCnt[bi]! += aIsPalmar[p]!;
      bDorsalCnt[bi]! += aIsDorsal[p]!;

      const connectedOK = !toggles.connectedInterface || isConnected(model, chosen);
      if (connectedOK) {
        feasible++;
        bySize[chosen.length]!++;
        if (classify) {
          const cat = categorizeIdx(model, chosen);
          byCategory[cat.category]++;
          if (cat.symmetric) symmetric++;
        }
      }
      if (chosen.length < maxSize) rec(p + 1, newMask);

      // undo
      chosen.pop();
      degA[ai]!--;
      degB[bi]!--;
      aPalmarCnt[ai]! -= bIsPalmar[p]!;
      aDorsalCnt[ai]! -= bIsDorsal[p]!;
      bPalmarCnt[bi]! -= aIsPalmar[p]!;
      bDorsalCnt[bi]! -= aIsDorsal[p]!;
    }
  }

  rec(0, fullMask);

  const result: EnumResult = {
    maxSize,
    feasible,
    bySize,
    rawBounded: rawBoundedCount(nPairs, maxSize),
  };
  if (classify) {
    result.byCategory = byCategory;
    result.symmetric = symmetric;
  }
  return result;
}
