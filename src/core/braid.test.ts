import { describe, expect, it } from 'vitest';
import {
  braid,
  braidClosure,
  braidEqual,
  braidPermutation,
  concatBraids,
  exponentSum,
  freeReduce,
  inverseBraid,
} from './braid.js';
import { componentCount, validateDiagram, writhe } from './diagram.js';

describe('braid words', () => {
  it('validates generators against strand count', () => {
    expect(() => braid(2, [2])).toThrow(/not a valid generator/);
    expect(() => braid(3, [0])).toThrow(/not a valid generator/);
    expect(() => braid(3, [1, -2])).not.toThrow();
  });

  it('freely reduces', () => {
    expect(freeReduce([1, -1])).toEqual([]);
    expect(freeReduce([1, 2, -2, -1])).toEqual([]);
    expect(freeReduce([1, 2, -2, 1])).toEqual([1, 1]);
    expect(freeReduce([2, 1, -1, -2, 3])).toEqual([3]);
  });

  it('computes permutations and exponent sums', () => {
    expect(braidPermutation(braid(3, [1]))).toEqual([1, 0, 2]);
    // Strand starting at position 0 goes to 1 (sigma1) then to 2 (sigma2).
    expect(braidPermutation(braid(3, [1, 2]))).toEqual([2, 0, 1]);
    expect(braidPermutation(braid(3, [1, 2, 1]))).toEqual([2, 1, 0]);
    expect(exponentSum(braid(3, [1, -2, -2]))).toBe(-1);
  });

  it('inverse and concatenation compose to the identity', () => {
    const b = braid(4, [1, -3, 2, 2]);
    const e = braidEqual(concatBraids(b, inverseBraid(b)), braid(4, []));
    expect(e).toBe(true);
  });
});

describe('braid word problem (bounded)', () => {
  it('proves the braid relation: sigma1 sigma2 sigma1 = sigma2 sigma1 sigma2', () => {
    expect(braidEqual(braid(3, [1, 2, 1]), braid(3, [2, 1, 2]))).toBe(true);
  });

  it('proves far commutation: sigma1 sigma3 = sigma3 sigma1', () => {
    expect(braidEqual(braid(4, [1, 3]), braid(4, [3, 1]))).toBe(true);
  });

  it('proves a derived conjugation identity: sigma1 sigma2 sigma1^-1 = sigma2^-1 sigma1 sigma2', () => {
    expect(braidEqual(braid(3, [1, 2, -1]), braid(3, [-2, 1, 2]))).toBe(true);
  });

  it('refutes by permutation: sigma1 != sigma2', () => {
    expect(braidEqual(braid(3, [1]), braid(3, [2]))).toBe(false);
  });

  it('refutes by exponent sum: sigma1^2 != identity', () => {
    expect(braidEqual(braid(2, [1, 1]), braid(2, []))).toBe(false);
  });

  it('refutes by strand count', () => {
    expect(braidEqual(braid(2, [1]), braid(3, [1]))).toBe(false);
  });

  it('is honest when the bounded search is too weak', () => {
    // sigma1 sigma2^-1 in B3 has infinite order; its cube has trivial
    // permutation and zero exponent sum, so no cheap invariant refutes it,
    // and the length-nonincreasing search cannot certify non-triviality
    // either: the only honest answer is 'unknown'.
    const w = braid(3, [1, -2, 1, -2, 1, -2]);
    expect(braidEqual(w, braid(3, []))).toBe('unknown');
  });
});

describe('braid closure', () => {
  it('closure of the empty braid on n strands is n free loops', () => {
    const d = braidClosure(braid(3, []));
    expect(d.crossings).toHaveLength(0);
    expect(d.freeLoops).toBe(3);
  });

  it('closure of sigma_1 in B2 is a 1-component unknot diagram with writhe 1', () => {
    const d = braidClosure(braid(2, [1]));
    validateDiagram(d);
    expect(componentCount(d)).toBe(1);
    expect(writhe(d)).toBe(1);
  });

  it('closure component count equals the number of permutation cycles', () => {
    // sigma1^3 in B2: permutation is a transposition -> 1 component.
    expect(componentCount(braidClosure(braid(2, [1, 1, 1])))).toBe(1);
    // sigma1^2 in B2: identity permutation -> 2 components.
    expect(componentCount(braidClosure(braid(2, [1, 1])))).toBe(2);
    // untouched strands close into free loops
    const d = braidClosure(braid(4, [1, 1, 1]));
    expect(d.freeLoops).toBe(2);
    expect(componentCount(d)).toBe(3);
  });

  it('closure writhe equals the word exponent sum', () => {
    const b = braid(3, [1, 1, -2, 1, -2]);
    expect(writhe(braidClosure(b))).toBe(exponentSum(b));
  });
});
