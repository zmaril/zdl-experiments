import { describe, expect, it } from 'vitest';
import { addKink, applyR1, applyR2, applyR3, detectR1, detectR2, detectR3, reduceR1R2, simplify } from './reidemeister.js';
import { componentCount, fromPDCode, linkingNumber, validateDiagram, writhe } from './diagram.js';
import { jonesInT, jonesPolynomial, kauffmanBracket } from './bracket.js';
import { braid, braidClosure } from './braid.js';
import { FIGURE8_PD, TREFOIL_PD } from './diagram.test.js';
import { Laurent } from './laurent.js';

describe('R1', () => {
  it('detects and removes a kink: closure of sigma_1 in B2 -> unknot', () => {
    const d = braidClosure(braid(2, [1]));
    expect(detectR1(d)).toHaveLength(1);
    const r = applyR1(d, detectR1(d)[0]!);
    expect(r.crossings).toHaveLength(0);
    expect(r.freeLoops).toBe(1);
  });

  it('addKink inserts a removable kink and changes writhe by the sign', () => {
    const t = fromPDCode(TREFOIL_PD);
    const k = addKink(t, 1, 1);
    validateDiagram(k);
    expect(k.crossings).toHaveLength(4);
    expect(writhe(k)).toBe(writhe(t) + 1);
    expect(detectR1(k)).toHaveLength(1);
    const back = applyR1(k, detectR1(k)[0]!);
    validateDiagram(back);
    expect(back.crossings).toHaveLength(3);
  });

  it('R1 changes the bracket by -A^(+-3) but never the Jones polynomial', () => {
    const t = fromPDCode(TREFOIL_PD);
    const vt = jonesInT(t);
    for (const sign of [1, -1] as const) {
      const k = addKink(t, 1, sign);
      expect(kauffmanBracket(k).equals(kauffmanBracket(t).mul(Laurent.monomial(-1n, 3 * sign)))).toBe(true);
      expect(jonesInT(k).equals(vt)).toBe(true);
    }
  });

  it('stacked kinks all reduce away', () => {
    let d = fromPDCode(TREFOIL_PD);
    d = addKink(d, 1, 1);
    d = addKink(d, 3, -1);
    d = addKink(d, 5, -1);
    validateDiagram(d);
    expect(d.crossings).toHaveLength(6);
    const s = reduceR1R2(d);
    validateDiagram(s);
    expect(s.crossings).toHaveLength(3);
    expect(jonesInT(s).equals(jonesInT(fromPDCode(TREFOIL_PD)))).toBe(true);
  });
});

describe('R2', () => {
  it('detects the poke in closure(sigma_1 sigma_1^-1) and removes it', () => {
    const d = braidClosure(braid(2, [1, -1]));
    validateDiagram(d);
    const sites = detectR2(d);
    expect(sites.length).toBeGreaterThan(0);
    const r = applyR2(d, sites[0]!);
    expect(r.crossings).toHaveLength(0);
    expect(r.freeLoops).toBe(2); // two split unknots, as for the identity braid
  });

  it('preserves the Kauffman bracket (R2 invariance)', () => {
    const d = braidClosure(braid(2, [1, 1, 1, -1])); // Hopf link with a poke
    const sites = detectR2(d);
    expect(sites.length).toBeGreaterThan(0);
    const r = applyR2(d, sites[0]!);
    validateDiagram(r);
    expect(r.crossings).toHaveLength(2);
    expect(kauffmanBracket(r).equals(kauffmanBracket(d))).toBe(true);
    expect(jonesPolynomial(r).equals(jonesPolynomial(d))).toBe(true);
    expect(componentCount(r)).toBe(2);
    expect(linkingNumber(r)).toBe(1);
  });

  it('does not fire on a clasp: the Hopf link has bigons but no R2 site', () => {
    const hopf = braidClosure(braid(2, [1, 1]));
    expect(detectR2(hopf)).toHaveLength(0);
  });

  it('does not fire on the alternating trefoil', () => {
    expect(detectR2(fromPDCode(TREFOIL_PD))).toHaveLength(0);
  });
});

describe('R3', () => {
  it('finds a slide in closure(sigma1 sigma2 sigma1) and preserves everything it should', () => {
    const d = braidClosure(braid(3, [1, 2, 1]));
    const sites = detectR3(d);
    expect(sites.length).toBeGreaterThan(0);
    const r = applyR3(d, sites[0]!);
    validateDiagram(r);
    expect(r.crossings).toHaveLength(3);
    expect(writhe(r)).toBe(writhe(d));
    expect(kauffmanBracket(r).equals(kauffmanBracket(d))).toBe(true);
    expect(componentCount(r)).toBe(componentCount(d));
    expect(linkingNumber(r)).toBe(linkingNumber(d));
  });

  it('does not fire on the alternating trefoil (no extreme strand in its triangles)', () => {
    expect(detectR3(fromPDCode(TREFOIL_PD))).toHaveLength(0);
  });

  it('R3 is an involution up to syntax: sliding twice preserves the bracket', () => {
    const d = braidClosure(braid(3, [1, 2, 1, 2]));
    const sites = detectR3(d);
    for (const site of sites) {
      const once = applyR3(d, site);
      validateDiagram(once);
      expect(kauffmanBracket(once).equals(kauffmanBracket(d))).toBe(true);
    }
  });
});

describe('simplify', () => {
  it('reduces R1+R2-only unknot diagrams to zero crossings', () => {
    const d = braidClosure(braid(2, [1, -1, 1])); // one kink after the poke cancels
    const s = simplify(d);
    expect(s.crossings).toHaveLength(0);
    expect(s.freeLoops).toBe(1);
  });

  it('cannot reduce the trefoil or figure-eight (they are knotted)', () => {
    expect(simplify(fromPDCode(TREFOIL_PD)).crossings).toHaveLength(3);
    expect(simplify(fromPDCode(FIGURE8_PD)).crossings).toHaveLength(4);
  });

  it('reduces the commutator closure sigma1 sigma2 sigma1^-1 sigma2^-1 to the unknot', () => {
    const d = braidClosure(braid(3, [1, 2, -1, -2]));
    validateDiagram(d);
    expect(componentCount(d)).toBe(1);
    expect(jonesInT(d).equals(Laurent.ONE)).toBe(true);
    const s = simplify(d);
    expect(s.crossings).toHaveLength(0);
    expect(s.freeLoops).toBe(1);
  });

  it('uses R3 to unlock reductions: closure of (sigma1 sigma2)^2 is a 4-crossing trefoil diagram', () => {
    const d = braidClosure(braid(3, [1, 2, 1, 2]));
    validateDiagram(d);
    // Greedy R1/R2 is stuck at 4 crossings...
    expect(reduceR1R2(d).crossings).toHaveLength(4);
    // ...but an R3 slide exposes a reduction down to the minimal 3.
    const s = simplify(d);
    validateDiagram(s);
    expect(s.crossings).toHaveLength(3);
    expect(jonesInT(s).equals(jonesInT(braidClosure(braid(2, [1, 1, 1]))))).toBe(true); // right trefoil
  });

  it('simplification preserves the Jones polynomial', () => {
    const d = braidClosure(braid(3, [1, 1, 2, -1, 2]));
    const s = simplify(d);
    validateDiagram(s);
    expect(s.crossings.length).toBeLessThanOrEqual(d.crossings.length);
    expect(jonesPolynomial(s).equals(jonesPolynomial(d))).toBe(true);
  });
});
