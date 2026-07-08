import { describe, expect, it } from 'vitest';
import { braid, braidEqual, braidPermutation, freeReduce } from '../core/index.js';
import { movesBraid, sequencesEqual, sequenceUnwinds } from './moves.js';

describe('moves as braid words', () => {
  it('cross then duck unwinds (word problem: trivial)', () => {
    expect(sequenceUnwinds(['cross', 'duck'])).toBe(true);
    expect(freeReduce(movesBraid(['cross', 'duck']).word)).toEqual([]);
  });

  it('cross alone does NOT unwind: it moves arms to the crossed hold', () => {
    expect(sequenceUnwinds(['cross'])).toBe(false);
    // Its permutation swaps the inner arms — that is the crossed-hold cap pattern.
    expect(braidPermutation(movesBraid(['cross']))).toEqual([0, 2, 1, 3]);
  });

  it('crossed hold is reachable from open by "cross"', () => {
    const crossedHold = braid(4, [2]);
    expect(braidEqual(movesBraid(['cross']), crossedHold)).toBe(true);
  });

  it('a follower turn does not unwind, but turn + reverse turn does', () => {
    expect(sequenceUnwinds(['follower-turn'])).toBe(false);
    expect(sequenceUnwinds(['follower-turn', 'follower-turn-reverse'])).toBe(true);
    expect(
      sequenceUnwinds(['follower-turn', 'follower-turn', 'follower-turn-reverse', 'follower-turn-reverse']),
    ).toBe(true);
  });

  it('two same-direction follower turns wind up double: not trivial, not a single turn', () => {
    expect(sequenceUnwinds(['follower-turn', 'follower-turn'])).toBe(false);
    expect(sequencesEqual(['follower-turn', 'follower-turn'], ['follower-turn'])).toBe(false);
  });

  it('leader and follower turns commute (disjoint arms) but differ from each other', () => {
    expect(sequencesEqual(['leader-turn', 'follower-turn'], ['follower-turn', 'leader-turn'])).toBe(
      true,
    );
    expect(sequencesEqual(['leader-turn'], ['follower-turn'])).toBe(false);
  });

  it('turns do not commute with crossing the holds', () => {
    // After crossing, the "follower's arms" strands are no longer adjacent,
    // so turning before vs after crossing gives different braids.
    expect(sequencesEqual(['follower-turn', 'cross'], ['cross', 'follower-turn'])).toBe(false);
  });
});
