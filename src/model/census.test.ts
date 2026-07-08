import { describe, expect, it } from 'vitest';
import {
  ALL_PARTITIONS,
  partitionById,
  partitionId,
  setPartitions,
} from './partitions.js';
import {
  allCandidateStates,
  censusCounts,
  classify,
  feasibleStates,
} from './census.js';

describe('hand partitions', () => {
  it('there are Bell(4) = 15 partitions of the four hands', () => {
    expect(ALL_PARTITIONS).toHaveLength(15);
    const ids = new Set(ALL_PARTITIONS.map((p) => p.id));
    expect(ids.size).toBe(15);
  });

  it('generic set partition counts follow Bell numbers', () => {
    expect(setPartitions([])).toHaveLength(1);
    expect(setPartitions([1])).toHaveLength(1);
    expect(setPartitions([1, 2])).toHaveLength(2);
    expect(setPartitions([1, 2, 3])).toHaveLength(5);
    expect(setPartitions([1, 2, 3, 4])).toHaveLength(15);
    expect(setPartitions([1, 2, 3, 4, 5])).toHaveLength(52);
  });

  it('names the classic holds', () => {
    expect(partitionById('LL.FR|LR.FL').name).toBe('open two-hand hold');
    expect(partitionById('LL.FL|LR.FR').name).toBe('crossed two-hand hold');
    expect(partitionById('LR.FR').name).toBe('handshake hold (right to right)');
    expect(partitionById('none').gripSizes).toEqual([]);
  });

  it('partition ids are canonical regardless of input order', () => {
    expect(partitionId([['FR', 'LL'], ['FL', 'LR']])).toBe('LL.FR|LR.FL');
  });
});

describe('census reconstruction (ZDL blog counts)', () => {
  it('has 240 candidate states', () => {
    expect(allCandidateStates()).toHaveLength(240);
  });

  it('reproduces all six published category counts', () => {
    const c = censusCounts();
    // Published in the blog post; the "impossible" rule is a documented
    // reconstruction (see census.ts) — if these ever drift, do NOT adjust
    // the expectations to match; fix or re-document the rule.
    expect(c.impossible).toBe(23);
    expect(c.weird).toBe(45);
    expect(c.boring).toBe(15);
    expect(c.stable).toBe(70);
    expect(c.mixed).toBe(56);
    expect(c.transition).toBe(31);
    expect(c.total).toBe(240);
    expect(c.feasible).toBe(157);
  });

  it('feasible = stable + mixed + transition = 157', () => {
    expect(feasibleStates()).toHaveLength(157);
  });

  it('classifies spot-check examples', () => {
    const open = partitionById('LL.FR|LR.FL');
    // No hammerlock: boring, whatever the partition.
    expect(classify(open, new Set())).toBe('boring');
    // Hammerlocked hand inside a cross grip: stable.
    expect(classify(open, new Set(['FL']))).toBe('stable');
    // Handshake + hammerlocked free hand: transition (locked hand not connected).
    expect(classify(partitionById('LR.FL'), new Set(['FR']))).toBe('transition');
    // One connected + one free hammerlock: mixed.
    expect(classify(partitionById('LR.FL'), new Set(['FL', 'FR']))).toBe('mixed');
    // Self-grip partition with any hammerlock: weird.
    expect(classify(partitionById('LL.LR'), new Set(['LL']))).toBe('weird');
    // Both leader hands hammerlocked inside the same (four-hand) grip: impossible.
    expect(classify(partitionById('LL.LR.FL.FR'), new Set(['LL', 'LR']))).toBe('impossible');
    // Both leader hands hammerlocked in different grips: allowed (stable).
    expect(classify(partitionById('LL.FL|LR.FR'), new Set(['LL', 'LR']))).toBe('stable');
  });
});
