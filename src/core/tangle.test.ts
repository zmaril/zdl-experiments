import { describe, expect, it } from 'vitest';
import {
  closeTangle,
  composeTangles,
  mapLabels,
  reverseStrand,
  tangleFromBraid,
  trivialTangle,
  validateTangle,
} from './tangle.js';
import { braid, braidClosure } from './braid.js';
import { componentCount, linkingNumber, validateDiagram, writhe } from './diagram.js';
import { jonesInT, jonesPolynomial } from './bracket.js';
import { simplify } from './reidemeister.js';
import { Laurent } from './laurent.js';

describe('tangle basics', () => {
  it('trivial tangles validate and close into free loops', () => {
    const t = trivialTangle([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    validateTangle(t);
    const d = closeTangle(t, [
      ['b', 'a'],
      ['d', 'c'],
    ]);
    expect(d.crossings).toHaveLength(0);
    expect(d.freeLoops).toBe(2);
  });

  it('two trivial strands can close into a single circle', () => {
    const t = trivialTangle([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    const d = closeTangle(t, [
      ['b', 'c'],
      ['d', 'a'],
    ]);
    expect(d.freeLoops).toBe(1);
  });

  it('rejects duplicate labels and dangling closures', () => {
    expect(() =>
      trivialTangle([
        ['a', 'a'],
        ['c', 'd'],
      ]),
    ).toThrow(/duplicate boundary label/);
    const t = trivialTangle([['a', 'b']]);
    expect(() => closeTangle(t, [])).toThrow(/left open/);
    // in-to-in gluing must be rejected
    const t2 = trivialTangle([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(() =>
      closeTangle(t2, [
        ['a', 'c'],
        ['b', 'd'],
      ]),
    ).toThrow(/reverseStrand/);
  });
});

describe('braid tangles and composition', () => {
  it('closing a braid tangle top-to-bottom reproduces the braid closure', () => {
    const b = braid(2, [1, 1, 1]);
    const t = tangleFromBraid(b);
    const d = closeTangle(t, [
      ['t0', 'b0'],
      ['t1', 'b1'],
    ]);
    validateDiagram(d);
    expect(jonesInT(d).equals(jonesInT(braidClosure(b)))).toBe(true); // right trefoil
  });

  it('stacking braid tangles equals concatenating braid words', () => {
    const bottom = tangleFromBraid(braid(2, [1]), 'b', 'm');
    const top = tangleFromBraid(braid(2, [1]), 'm', 't');
    // Glue bottom's tops (labels m0/m1... note: bottom uses 'm' as TOP prefix,
    // top uses 'm' as BOTTOM prefix) — relabel to avoid the clash mid-compose.
    const topR = mapLabels(top, (l) => (l.startsWith('m') ? `g${l.slice(1)}` : l));
    const stacked = composeTangles(bottom, topR, [
      ['m0', 'g0'],
      ['m1', 'g1'],
    ]);
    validateTangle(stacked);
    expect(stacked.crossings).toHaveLength(2);
    const d = closeTangle(stacked, [
      ['t0', 'b0'],
      ['t1', 'b1'],
    ]);
    const hopf = braidClosure(braid(2, [1, 1]));
    expect(componentCount(d)).toBe(2);
    expect(linkingNumber(d)).toBe(linkingNumber(hopf));
    expect(jonesPolynomial(d).equals(jonesPolynomial(hopf))).toBe(true);
  });

  it('composition refuses orientation clashes and label collisions', () => {
    const a = tangleFromBraid(braid(2, [1]));
    const b = tangleFromBraid(braid(2, [1]));
    // t-labels of both are 'out': out-to-out must clash.
    expect(() => composeTangles(a, b, [['t0', 't1']])).toThrow(/orientations clash/);
  });
});

describe('reverseStrand', () => {
  it('flips endpoint directions and crossing signs of a 2-strand braid tangle', () => {
    const t = tangleFromBraid(braid(2, [1, 1])); // two +1 crossings, strands b0->t? and b1->t?
    const r = reverseStrand(t, 'b1');
    validateTangle(r);
    const b1 = r.boundary.find((x) => x.label === 'b1')!;
    expect(b1.dir).toBe('out');
    // Both crossings involve the reversed strand exactly once: signs flip.
    expect(r.crossings.map((c) => c.sign)).toEqual([-1, -1]);
    // Reversing back restores the original signs.
    const rr = reverseStrand(r, 'b1');
    expect(rr.crossings.map((c) => c.sign)).toEqual([1, 1]);
  });

  it('enables plat closure: plat of sigma_1^2 is the unknot', () => {
    // Arms-style closure: join b0-b1 at the bottom and t0-t1 at the top.
    // Both bottoms are 'in', so reverse the strand starting at b1 first.
    const t = reverseStrand(tangleFromBraid(braid(2, [1, 1])), 'b1');
    const whichT = t.boundary.filter((b) => b.label.startsWith('t'));
    expect(whichT.map((b) => b.dir).sort()).toEqual(['in', 'out']); // one flipped
    const d = closeTangle(t, [
      ['b1', 'b0'],
      [t.boundary.find((b) => b.label.startsWith('t') && b.dir === 'out')!.label,
       t.boundary.find((b) => b.label.startsWith('t') && b.dir === 'in')!.label],
    ]);
    validateDiagram(d);
    expect(componentCount(d)).toBe(1);
    expect(writhe(d)).toBe(-2); // signs flipped by the reversal
    expect(jonesInT(d).equals(Laurent.ONE)).toBe(true); // R2 unknot
    const s = simplify(d);
    expect(s.crossings).toHaveLength(0);
    expect(s.freeLoops).toBe(1);
  });

  it('plat closure of sigma_1^3 on 2 strands untwists to the unknot (caps absorb twists)', () => {
    const t = reverseStrand(tangleFromBraid(braid(2, [1, 1, 1])), 'b1');
    const tOut = t.boundary.find((b) => b.label.startsWith('t') && b.dir === 'out')!.label;
    const tIn = t.boundary.find((b) => b.label.startsWith('t') && b.dir === 'in')!.label;
    const d = closeTangle(t, [
      ['b1', 'b0'],
      [tOut, tIn],
    ]);
    validateDiagram(d);
    expect(componentCount(d)).toBe(1);
    expect(jonesInT(d).equals(Laurent.ONE)).toBe(true);
    expect(simplify(d).crossings).toHaveLength(0);
  });

  it('2-bridge plat of sigma_2^3 on 4 strands is the trefoil', () => {
    // Strand ends: S0: b0-t0, S1: b1-t2, S2: b2-t1, S3: b3-t3. Orienting
    // S1, S2 in reverse makes every cap pair out-in compatible.
    let t = tangleFromBraid(braid(4, [2, 2, 2]));
    t = reverseStrand(t, 'b1');
    t = reverseStrand(t, 'b2');
    const d = closeTangle(t, [
      ['b0', 'b1'],
      ['b2', 'b3'],
      ['t0', 't1'],
      ['t2', 't3'],
    ]);
    validateDiagram(d);
    expect(componentCount(d)).toBe(1);
    // All three crossings are between the two reversed strands S1 and S2,
    // so their signs are unchanged (+1): right trefoil.
    expect(writhe(d)).toBe(3);
    expect(jonesInT(d).toString('t')).toBe('t + t^3 - t^4');
  });
});

describe('dance-shaped smoke test: four arms, eight boundary points', () => {
  it('builds a 4-strand tangle with 8 labeled endpoints and closes it', () => {
    // Arms oriented shoulder -> hand. Leader arms strands 0,1; follower 2,3.
    const arms = trivialTangle([
      ['L.shoulder.left', 'L.hand.left'],
      ['L.shoulder.right', 'L.hand.right'],
      ['F.shoulder.left', 'F.hand.left'],
      ['F.shoulder.right', 'F.hand.right'],
    ]);
    expect(arms.boundary).toHaveLength(8);
    // Handshake grip: leader right hand holds follower right hand.
    // Hands are both 'out': reverse the follower's arm strand first.
    const prepared = reverseStrand(arms, 'F.hand.right');
    const gripped = composeTangles(prepared, trivialTangle([]), []); // no-op compose keeps API exercised
    const d = closeTangle(gripped, [
      ['L.hand.right', 'F.hand.right'], // grip (out -> in after reversal)
      ['F.shoulder.right', 'L.shoulder.right'], // close through the bodies
      ['L.hand.left', 'L.shoulder.left'],
      ['F.shoulder.left', 'F.hand.left'],
    ]);
    validateDiagram(d);
    // Handshake with no entanglement: three unknotted circles.
    expect(d.crossings).toHaveLength(0);
    expect(d.freeLoops).toBe(3);
  });
});
