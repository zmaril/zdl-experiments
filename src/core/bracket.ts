/**
 * Kauffman bracket and Jones polynomial, by direct state sum.
 *
 * CONVENTIONS
 * -----------
 * The bracket <D> is a Laurent polynomial in A, normalized so <unknot> = 1
 * and each extra disjoint loop multiplies by delta = -A^2 - A^(-2).
 *
 * Smoothings, in terms of the CCW PD tuple (a,b,c,d) of a crossing (starting
 * at the incoming under-edge): the A-smoothing joins a-b and c-d; the
 * B-smoothing joins a-d and b-c. This convention is calibrated so that a
 * kink of writhe +1 contributes -A^3 (the standard R1 factor); the test
 * suite pins it against the known trefoil/figure-eight Jones polynomials.
 *
 * The Jones polynomial is V(L) = ((-A)^(-3))^w(D) * <D> with A = t^(-1/4).
 * `jonesPolynomial` returns V in the variable q = t^(1/4) (integer
 * exponents); `jonesInT` re-expresses it in integer powers of t and throws
 * if that is impossible (e.g. for even-component links, which live in
 * t^(1/2) Z).
 *
 * COMPLEXITY: the state sum is exact but exponential (2^n states for n
 * crossings). This is fine for the small diagrams this project needs; the
 * `maxCrossings` guard (default 20) protects against accidental blowups.
 */

import { Laurent } from './laurent.js';
import { type Diagram, type Edge, ccwEdges, edgeSet, writhe, UnionFind } from './diagram.js';

/** delta = -A^2 - A^(-2), the value of a disjoint loop. */
export const LOOP_VALUE: Laurent = Laurent.fromTerms([
  [2, -1n],
  [-2, -1n],
]);

export interface BracketOptions {
  /** Refuse diagrams with more crossings than this (state sum is 2^n). */
  maxCrossings?: number;
}

/** Kauffman bracket <D> as a Laurent polynomial in A. */
export function kauffmanBracket(d: Diagram, opts: BracketOptions = {}): Laurent {
  const maxCrossings = opts.maxCrossings ?? 20;
  const n = d.crossings.length;
  if (n > maxCrossings) {
    throw new Error(`kauffmanBracket: ${n} crossings exceeds maxCrossings=${maxCrossings} (state sum is 2^n)`);
  }
  const edges = [...edgeSet(d)];
  // Precompute the smoothing pairs for each crossing.
  const aPairs: Array<[[Edge, Edge], [Edge, Edge]]> = [];
  const bPairs: Array<[[Edge, Edge], [Edge, Edge]]> = [];
  for (const c of d.crossings) {
    const [a, b, cc, dd] = ccwEdges(c);
    aPairs.push([
      [a, b],
      [cc, dd],
    ]);
    bPairs.push([
      [a, dd],
      [b, cc],
    ]);
  }

  // Cache delta^k.
  const deltaPow = new Map<number, Laurent>();
  const deltaToThe = (k: number): Laurent => {
    let p = deltaPow.get(k);
    if (!p) {
      p = LOOP_VALUE.pow(k);
      deltaPow.set(k, p);
    }
    return p;
  };

  let sum = Laurent.ZERO;
  const states = 1 << n;
  for (let s = 0; s < states; s++) {
    const uf = new UnionFind<Edge>();
    for (const e of edges) uf.find(e);
    let aCount = 0;
    for (let i = 0; i < n; i++) {
      const pairs = s & (1 << i) ? bPairs[i]! : aPairs[i]!;
      if (!(s & (1 << i))) aCount++;
      uf.union(pairs[0][0], pairs[0][1]);
      uf.union(pairs[1][0], pairs[1][1]);
    }
    const roots = new Set<Edge>();
    for (const e of edges) roots.add(uf.find(e));
    const loops = roots.size + d.freeLoops;
    if (loops === 0) {
      // Empty diagram: <empty> = 1 by convention (delta^(loops-1) with loops=0
      // would be delta^(-1)). Only happens for the empty diagram.
      sum = sum.add(Laurent.monomial(1n, 2 * aCount - n));
      continue;
    }
    const term = Laurent.monomial(1n, 2 * aCount - n) // A^(#A - #B), since #B = n - #A
      .mul(deltaToThe(loops - 1));
    sum = sum.add(term);
  }
  return sum;
}

/**
 * Jones polynomial in the variable q = t^(1/4) (so exponents are integers).
 * For knots all exponents are multiples of 4; use `jonesInT` for those.
 */
export function jonesPolynomial(d: Diagram, opts: BracketOptions = {}): Laurent {
  const bracket = kauffmanBracket(d, opts);
  const w = writhe(d);
  // f(D) = (-A^(-3))^w * <D>  (Laurent in A)
  const signFactor = w % 2 === 0 ? 1n : -1n;
  const f = bracket.mul(Laurent.monomial(signFactor, -3 * w));
  // Substitute A = t^(-1/4): A-exponent m becomes q-exponent -m, q = t^(1/4).
  return f.substitutePower(-1);
}

/**
 * Jones polynomial in integer powers of t. Works for knots (and any diagram
 * whose q-exponents are all multiples of 4); throws otherwise — e.g. for
 * 2-component links, whose Jones lives in half-integer powers of t. For those
 * fall back to `jonesPolynomial` and print with `toString('t', 4)`.
 */
export function jonesInT(d: Diagram, opts: BracketOptions = {}): Laurent {
  return jonesPolynomial(d, opts).rescaleExponents(4);
}
