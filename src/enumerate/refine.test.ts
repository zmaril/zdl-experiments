import { describe, expect, it } from 'vitest';
import { feasibleStates, stateKey } from '../model/census.js';
import { ALL_PARTITIONS } from '../model/partitions.js';
import { cellKey, refineAll } from './refine.js';

// refineAll is fast (~200ms); compute once for the whole suite.
const { summary, cells } = refineAll();

describe('census refinement summary', () => {
  it('anchors: 15 partitions, 240 candidates, 157 feasible', () => {
    expect(summary.partitions).toBe(15);
    expect(summary.candidates).toBe(240);
    expect(summary.census.feasible).toBe(157);
    expect(summary.census).toMatchObject({
      impossible: 23,
      weird: 45,
      boring: 15,
      stable: 70,
      mixed: 56,
      transition: 31,
    });
  });

  it('refines all feasible + boring cells (157 + 15 = 172)', () => {
    expect(summary.refinedCells).toBe(172);
    expect(cells).toHaveLength(172);
  });

  it('accounts for every cell: representable, multi-grip, or back-to-back', () => {
    const u = summary.unrepresentable;
    expect(summary.representableCells + u.multiGrip + u.backToBack).toBe(172);
    // Pinned honest values for this crossing bound / frame:
    expect(summary.representableCells).toBe(85);
    expect(u.multiGrip).toBe(57); // 3- and 4-hand grips: spatial graphs, not links
    expect(u.backToBack).toBe(30); // grip behind both backs: outside the facing frame
  });

  it('pins the headline refinement bracket (regression, bound-dependent)', () => {
    expect(summary.totals.diagrams).toBe(298);
    expect(summary.totals.classesLower).toBe(167);
    expect(summary.totals.classesUpper).toBe(223);
  });
});

describe('projection checks', () => {
  it('forgetting hammerlocks collapses refined cells onto exactly the 15 partitions', () => {
    const ids = new Set(cells.map((c) => c.partitionId));
    expect(ids).toEqual(new Set(ALL_PARTITIONS.map((p) => p.id)));
    expect(ids.size).toBe(15);
  });

  it('forgetting entanglement collapses refined feasible cells onto exactly the 157 feasible states', () => {
    const refinedFeasible = new Set(
      cells.filter((c) => c.category !== 'boring').map((c) => cellKey(c)),
    );
    const feasible = new Set(feasibleStates().map((s) => stateKey(s)));
    expect(refinedFeasible).toEqual(feasible);
    expect(refinedFeasible.size).toBe(157);
  });

  it('every representable cell with a grip yields at least one realization', () => {
    for (const c of cells) {
      if (!c.representable) continue;
      expect(c.diagrams).toBeGreaterThan(0);
      expect(c.classesLower).toBeGreaterThan(0);
      expect(c.classesLower).toBeLessThanOrEqual(c.diagrams);
    }
  });
});

describe('what the refinement finds', () => {
  const partition = (id: string) => {
    const p = summary.perPartition.find((x) => x.partitionId === id);
    if (!p) throw new Error(`missing partition ${id}`);
    return p;
  };

  it('each single cross-grip refines to exactly 5 classes (clean + 2x2 mirror hammerlocks)', () => {
    for (const id of ['LL.FL', 'LL.FR', 'LR.FL', 'LR.FR']) {
      const p = partition(id);
      expect(p.classesLower).toBe(5);
      expect(p.classesUpper).toBe(5);
    }
  });

  it('the no-contact partition has exactly 1 class across its 16 cells: transition states are topologically invisible', () => {
    const p = partition('none');
    expect(p.cells.transition).toBe(15);
    expect(p.classesLower).toBe(1);
    expect(p.classesUpper).toBe(1);
  });

  it('transition cells share every fingerprint with their no-hammerlock cell', () => {
    const handshakeCells = cells.filter((c) => c.partitionId === 'LR.FR');
    const boring = handshakeCells.find((c) => c.category === 'boring')!;
    for (const c of handshakeCells.filter((x) => x.category === 'transition')) {
      expect(c.fingerprints).toEqual(boring.fingerprints);
    }
  });

  it('two-hand holds refine into honest brackets (invariants cannot separate everything)', () => {
    const open = partition('LL.FR|LR.FL');
    expect([open.classesLower, open.classesUpper]).toEqual([75, 99]);
    const crossed = partition('LL.FL|LR.FR');
    expect([crossed.classesLower, crossed.classesUpper]).toEqual([66, 98]);
    // The uncrossed and crossed base holds themselves ARE distinguished
    // (see tangles.test.ts); the gap in the brackets comes from richer
    // hammerlocked cells where equal invariants leave diagrams unresolved.
    expect(open.classesLower).toBeLessThan(open.classesUpper);
  });

  it('multi-hand grips are flagged, never silently dropped or fudged', () => {
    for (const id of ['LL.LR.FL', 'LL.LR.FR', 'LL.FL.FR', 'LR.FL.FR', 'LL.LR.FL.FR']) {
      const p = partition(id);
      expect(p.representableCells).toBe(0);
      expect(p.unrepresentable.multiGrip).toBeGreaterThan(0);
      expect(p.classesLower).toBe(0);
    }
  });
});
