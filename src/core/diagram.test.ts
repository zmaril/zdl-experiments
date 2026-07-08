import { describe, expect, it } from 'vitest';
import {
  UNKNOT_DIAGRAM,
  componentCount,
  edgeComponents,
  faces,
  fromPDCode,
  linkingNumber,
  toPDCode,
  validateDiagram,
  writhe,
  type Diagram,
} from './diagram.js';
import { braid, braidClosure } from './braid.js';

/** Standard left-handed trefoil (Rolfsen 3_1), KnotAtlas PD code. */
export const TREFOIL_PD: Array<[number, number, number, number]> = [
  [1, 4, 2, 5],
  [3, 6, 4, 1],
  [5, 2, 6, 3],
];

/** Figure-eight knot (4_1), KnotAtlas PD code. */
export const FIGURE8_PD: Array<[number, number, number, number]> = [
  [4, 2, 5, 1],
  [8, 6, 1, 5],
  [6, 3, 7, 4],
  [2, 7, 3, 8],
];

describe('diagram basics', () => {
  it('parses the trefoil PD code as three negative crossings', () => {
    const d = fromPDCode(TREFOIL_PD);
    validateDiagram(d);
    expect(d.crossings).toHaveLength(3);
    expect(d.crossings.every((c) => c.sign === -1)).toBe(true);
    expect(writhe(d)).toBe(-3);
    expect(componentCount(d)).toBe(1);
  });

  it('round-trips PD codes', () => {
    const d = fromPDCode(TREFOIL_PD);
    expect(toPDCode(d)).toEqual(TREFOIL_PD);
    const f8 = fromPDCode(FIGURE8_PD);
    expect(toPDCode(f8)).toEqual(FIGURE8_PD);
  });

  it('figure-eight has writhe 0 and one component', () => {
    const d = fromPDCode(FIGURE8_PD);
    validateDiagram(d);
    expect(writhe(d)).toBe(0);
    expect(componentCount(d)).toBe(1);
  });

  it('rejects structurally broken diagrams', () => {
    const bad: Diagram = {
      crossings: [{ underIn: 1, underOut: 2, overIn: 1, overOut: 3, sign: 1 }],
      freeLoops: 0,
    };
    expect(() => validateDiagram(bad)).toThrow(/edge 1/);
  });

  it('counts faces consistently with Euler formula (connected: V - E + F = 2)', () => {
    const d = fromPDCode(TREFOIL_PD);
    const F = faces(d).length;
    // V = 3, E = 6 -> F = 5
    expect(F).toBe(5);
    const sizes = faces(d)
      .map((f) => f.length)
      .sort((a, b) => a - b);
    expect(sizes).toEqual([2, 2, 2, 3, 3]);

    const f8 = fromPDCode(FIGURE8_PD);
    // V = 4, E = 8 -> F = 6
    expect(faces(f8).length).toBe(6);
  });
});

describe('components and linking number', () => {
  it('Hopf link from braid closure: linking number matches chirality', () => {
    const hopfPlus = braidClosure(braid(2, [1, 1]));
    validateDiagram(hopfPlus);
    expect(componentCount(hopfPlus)).toBe(2);
    expect(linkingNumber(hopfPlus)).toBe(1);

    const hopfMinus = braidClosure(braid(2, [-1, -1]));
    expect(linkingNumber(hopfMinus)).toBe(-1);
  });

  it('split union of two unknots has linking number 0', () => {
    const split = braidClosure(braid(2, []));
    expect(split.freeLoops).toBe(2);
    expect(componentCount(split)).toBe(2);
    expect(linkingNumber(split)).toBe(0);
  });

  it('closure of sigma1 sigma2 sigma1 in B3 is a 2-component link with lk = 1', () => {
    const d = braidClosure(braid(3, [1, 2, 1]));
    validateDiagram(d);
    expect(componentCount(d)).toBe(2);
    expect(linkingNumber(d)).toBe(1);
  });

  it('linking number refuses non-2-component diagrams', () => {
    expect(() => linkingNumber(fromPDCode(TREFOIL_PD))).toThrow(/exactly 2 components/);
    expect(() => linkingNumber(UNKNOT_DIAGRAM)).toThrow(/exactly 2 components/);
  });

  it('assigns edges of the trefoil to a single component', () => {
    const { count } = edgeComponents(fromPDCode(TREFOIL_PD));
    expect(count).toBe(1);
  });
});
