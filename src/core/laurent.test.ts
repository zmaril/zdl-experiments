import { describe, expect, it } from 'vitest';
import { Laurent } from './laurent.js';

describe('Laurent', () => {
  it('builds and normalizes terms', () => {
    const p = Laurent.fromTerms([
      [2, 3],
      [2, -3],
      [0, 1],
    ]);
    expect(p.equals(Laurent.ONE)).toBe(true);
    expect(Laurent.monomial(0, 5).isZero()).toBe(true);
  });

  it('adds and subtracts', () => {
    const p = Laurent.fromTerms([
      [1, 1],
      [-1, 2],
    ]);
    const q = Laurent.fromTerms([
      [1, -1],
      [0, 7],
    ]);
    expect(p.add(q).termList()).toEqual([
      [-1, 2n],
      [0, 7n],
    ]);
    expect(p.sub(p).isZero()).toBe(true);
  });

  it('multiplies exactly with negative exponents', () => {
    // (x + x^-1)^2 = x^2 + 2 + x^-2
    const p = Laurent.fromTerms([
      [1, 1],
      [-1, 1],
    ]);
    expect(p.mul(p).termList()).toEqual([
      [-2, 1n],
      [0, 2n],
      [2, 1n],
    ]);
    expect(p.pow(2).equals(p.mul(p))).toBe(true);
    expect(p.pow(0).equals(Laurent.ONE)).toBe(true);
  });

  it('substitutes powers and rescales exponents', () => {
    const p = Laurent.fromTerms([
      [4, 1],
      [-8, 2],
    ]);
    expect(p.substitutePower(-1).termList()).toEqual([
      [-4, 1n],
      [8, 2n],
    ]);
    expect(p.rescaleExponents(4).termList()).toEqual([
      [-2, 2n],
      [1, 1n],
    ]);
    expect(() => Laurent.monomial(1, 2).rescaleExponents(4)).toThrow(/not a multiple/);
  });

  it('prints readable strings', () => {
    const jonesTrefoil = Laurent.fromTerms([
      [-4, -1],
      [-3, 1],
      [-1, 1],
    ]);
    expect(jonesTrefoil.toString('t')).toBe('-t^-4 + t^-3 + t^-1');
    expect(Laurent.ZERO.toString()).toBe('0');
    expect(Laurent.fromTerms([[2, -1], [10, -1]]).toString('t', 4)).toBe('-t^1/2 - t^5/2');
  });
});
