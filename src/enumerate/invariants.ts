/**
 * Fingerprints used to distinguish position tangles.
 *
 * Combines two genuine isotopy invariants (see model/tangles.ts for the
 * string-linking sums):
 *
 *  - string-link linking sums between chains and torso bars;
 *  - Jones polynomial and component count of the canonical closure (the
 *    closure pattern is determined by the position's chain structure, so
 *    isotopic tangles of the same cell have isotopic closures).
 *
 * IMPORTANT: equality of these invariants is NECESSARY but NOT SUFFICIENT
 * for tangle equivalence. Distinct fingerprints prove positions distinct;
 * equal fingerprints prove nothing. Class counts derived from fingerprints
 * are therefore lower bounds. The heuristic `simplify` is deliberately NOT
 * part of the fingerprint: its output is not an invariant and would split
 * classes spuriously.
 */

import { componentCount, jonesPolynomial, simplify, type Diagram } from '../core/index.js';
import {
  closePosition,
  stringLinkingSums,
  type BuiltPosition,
} from '../model/tangles.js';

export interface Fingerprint {
  /** Component count of the canonical closure. */
  components: number;
  /** Sorted nonzero string-linking sums, e.g. ["FT|grip:LR.FL=2"]. */
  linking: string[];
  /** Jones polynomial of the canonical closure, in q = t^(1/4). */
  jones: string;
}

export function fingerprint(built: BuiltPosition): Fingerprint {
  const closure = closePosition(built);
  const linking = [...stringLinkingSums(built)].map(([k, v]) => `${k}=${v}`).sort();
  return {
    components: componentCount(closure),
    linking,
    jones: jonesPolynomial(closure).toString('q'),
  };
}

export function fingerprintKey(fp: Fingerprint): string {
  return `c${fp.components};lk[${fp.linking.join(',')}];J=${fp.jones}`;
}

/** Heuristic (NOT an invariant): crossings left after greedy simplification. */
export function simplifiedCrossingCount(d: Diagram): number {
  return simplify(d).crossings.length;
}
