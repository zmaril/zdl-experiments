import { describe, expect, it } from 'vitest';
import { Laurent } from './laurent.js';
import { LOOP_VALUE, jonesInT, jonesPolynomial, kauffmanBracket } from './bracket.js';
import { UNKNOT_DIAGRAM, fromPDCode, type Diagram } from './diagram.js';
import { braid, braidClosure } from './braid.js';
import { FIGURE8_PD, TREFOIL_PD } from './diagram.test.js';

const JONES_LEFT_TREFOIL = Laurent.fromTerms([
  [-4, -1],
  [-3, 1],
  [-1, 1],
]); // -t^-4 + t^-3 + t^-1

const JONES_RIGHT_TREFOIL = Laurent.fromTerms([
  [4, -1],
  [3, 1],
  [1, 1],
]); // -t^4 + t^3 + t

const JONES_FIGURE8 = Laurent.fromTerms([
  [-2, 1],
  [-1, -1],
  [0, 1],
  [1, -1],
  [2, 1],
]); // t^-2 - t^-1 + 1 - t + t^2

describe('Kauffman bracket', () => {
  it('unknot bracket is 1; extra loops multiply by delta', () => {
    expect(kauffmanBracket(UNKNOT_DIAGRAM).equals(Laurent.ONE)).toBe(true);
    const twoLoops: Diagram = { crossings: [], freeLoops: 2 };
    expect(kauffmanBracket(twoLoops).equals(LOOP_VALUE)).toBe(true);
  });

  it('a positive kink contributes -A^3 (R1 calibration)', () => {
    const kinkPlus: Diagram = {
      crossings: [{ underIn: 1, underOut: 2, overIn: 2, overOut: 1, sign: 1 }],
      freeLoops: 0,
    };
    expect(kauffmanBracket(kinkPlus).equals(Laurent.monomial(-1n, 3))).toBe(true);
    const kinkMinus: Diagram = {
      crossings: [{ underIn: 1, underOut: 2, overIn: 2, overOut: 1, sign: -1 }],
      freeLoops: 0,
    };
    expect(kauffmanBracket(kinkMinus).equals(Laurent.monomial(-1n, -3))).toBe(true);
  });

  it('guards against exponential blowup', () => {
    const d = braidClosure(braid(2, Array(6).fill(1)));
    expect(() => kauffmanBracket(d, { maxCrossings: 4 })).toThrow(/maxCrossings/);
  });
});

describe('Jones polynomial', () => {
  it('unknot Jones is 1 (also via a 1-crossing diagram)', () => {
    expect(jonesInT(UNKNOT_DIAGRAM).equals(Laurent.ONE)).toBe(true);
    const kinked = braidClosure(braid(2, [1])); // closure of sigma_1 = unknot
    expect(jonesInT(kinked).equals(Laurent.ONE)).toBe(true);
  });

  it('left trefoil (PD code): -t^-4 + t^-3 + t^-1', () => {
    const v = jonesInT(fromPDCode(TREFOIL_PD));
    expect(v.toString('t')).toBe('-t^-4 + t^-3 + t^-1');
    expect(v.equals(JONES_LEFT_TREFOIL)).toBe(true);
  });

  it('figure-eight (PD code): t^-2 - t^-1 + 1 - t + t^2, palindromic (amphichiral)', () => {
    const v = jonesInT(fromPDCode(FIGURE8_PD));
    expect(v.equals(JONES_FIGURE8)).toBe(true);
    expect(v.substitutePower(-1).equals(v)).toBe(true);
  });

  it('braid closure of sigma_1^3 in B2 is the right trefoil', () => {
    const v = jonesInT(braidClosure(braid(2, [1, 1, 1])));
    expect(v.equals(JONES_RIGHT_TREFOIL)).toBe(true);
  });

  it('braid closure of sigma_1^-3 matches the PD-code left trefoil', () => {
    const v = jonesInT(braidClosure(braid(2, [-1, -1, -1])));
    expect(v.equals(JONES_LEFT_TREFOIL)).toBe(true);
    expect(v.equals(JONES_RIGHT_TREFOIL.substitutePower(-1))).toBe(true);
  });

  it('positive Hopf link: -t^1/2 - t^5/2 (in q = t^1/4: -q^2 - q^10)', () => {
    const v = jonesPolynomial(braidClosure(braid(2, [1, 1])));
    expect(
      v.equals(
        Laurent.fromTerms([
          [2, -1],
          [10, -1],
        ]),
      ),
    ).toBe(true);
    expect(() => jonesInT(braidClosure(braid(2, [1, 1])))).toThrow(/not a multiple/);
    // Mirror: negative Hopf link.
    const vm = jonesPolynomial(braidClosure(braid(2, [-1, -1])));
    expect(vm.equals(v.substitutePower(-1))).toBe(true);
  });

  it('Markov stabilization preserves the closure (sigma_1^3 vs sigma_1^3 sigma_2)', () => {
    // Markov move: the closure of w in B_n equals the closure of w*sigma_n in
    // B_{n+1}, so both diagrams below are the right trefoil.
    const a = jonesInT(braidClosure(braid(2, [1, 1, 1])));
    const b = jonesInT(braidClosure(braid(3, [1, 1, 1, 2])));
    expect(b.equals(a)).toBe(true);
  });
});
