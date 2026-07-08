/**
 * Moves as braid words.
 *
 * The braid layer works on the four ARM strands only, in the canonical
 * order [LL, LR, FL, FR] (bottom = shoulders, top = hands). A position's
 * grip pattern caps the top ends; a move composes a braid word below the
 * caps. Composing moves = concatenating words; "these moves undo each
 * other" = the braid word problem, answered by `braidEqual` within its
 * honest limits (it can return 'unknown').
 *
 * DIVISION OF LABOR (documented limitation): this layer sees arm-arm
 * entanglement only. Torso obstacles — hammerlocks, wraps, cuddles — live
 * in the tangle layer (model/tangles.ts), where turns that wrap an arm
 * around a torso change the chain-torso linking sums. A braid-layer turn
 * word records what the arms do to EACH OTHER during the move.
 */

import {
  braid,
  braidClosure,
  braidEqual,
  concatBraids,
  inverseBraid,
  jonesPolynomial,
  Laurent,
  type Braid,
} from '../core/index.js';
import type { Hand } from './partitions.js';

export const MOVE_STRANDS: readonly Hand[] = ['LL', 'LR', 'FL', 'FR'];

export interface Move {
  id: string;
  name: string;
  /** Braid word on [LL, LR, FL, FR]; letter +-i crosses strands i-1, i (0-based). */
  word: number[];
  description: string;
}

export const MOVES: readonly Move[] = [
  {
    id: 'cross',
    name: 'cross the holds',
    word: [2],
    description:
      'The inner arms (leader R, follower L) pass each other, leader arm in ' +
      'front: turns the open two-hand hold into the crossed two-hand hold.',
  },
  {
    id: 'duck',
    name: 'duck back out',
    word: [-2],
    description: 'Inverse pass of the inner arms: undoes "cross".',
  },
  {
    id: 'follower-turn',
    name: 'follower full turn (arms kept low)',
    word: [3, 3],
    description:
      'The follower rotates 360 degrees without releasing; her two arms take ' +
      'a full twist around each other (sigma_3^2).',
  },
  {
    id: 'follower-turn-reverse',
    name: 'follower full turn, other way',
    word: [-3, -3],
    description: 'Inverse full twist of the follower arms.',
  },
  {
    id: 'leader-turn',
    name: 'leader full turn (arms kept low)',
    word: [1, 1],
    description: 'Full twist of the leader arms (sigma_1^2).',
  },
  {
    id: 'leader-turn-reverse',
    name: 'leader full turn, other way',
    word: [-1, -1],
    description: 'Inverse full twist of the leader arms.',
  },
];

export function moveById(id: string): Move {
  const m = MOVES.find((x) => x.id === id);
  if (!m) throw new Error(`no move "${id}"`);
  return m;
}

/** The arm-braid of a sequence of moves, starting from the identity (open). */
export function movesBraid(ids: readonly string[]): Braid {
  return ids.reduce(
    (b, id) => concatBraids(b, braid(4, moveById(id).word)),
    braid(4, []),
  );
}

/** Jones polynomial of the n-component unlink, in q. */
function unlinkJones(n: number): Laurent {
  const delta = Laurent.monomial(-1, 2).add(Laurent.monomial(-1, -2)); // -q^2 - q^-2
  return delta.pow(n - 1);
}

/**
 * Braid equality with one extra sound negative certificate on top of
 * `braidEqual`: if a == b then a.b^-1 is the trivial braid, whose closure
 * is the n-component unlink; so a non-unlink Jones polynomial of the
 * closure of a.b^-1 proves a != b. When neither test decides, the honest
 * answer stays 'unknown'.
 */
export function braidsEqualWithJonesCheck(a: Braid, b: Braid): boolean | 'unknown' {
  const direct = braidEqual(a, b);
  if (direct !== 'unknown') return direct;
  const diff = concatBraids(a, inverseBraid(b));
  if (diff.word.length <= 16) {
    const closure = braidClosure(diff);
    if (!jonesPolynomial(closure).equals(unlinkJones(diff.strands))) return false;
  }
  return 'unknown';
}

/** Does the move sequence return the arms to the trivial braid? */
export function sequenceUnwinds(ids: readonly string[]): boolean | 'unknown' {
  return braidsEqualWithJonesCheck(movesBraid(ids), braid(4, []));
}

/** Are two move sequences the same arm-braid? */
export function sequencesEqual(
  a: readonly string[],
  b: readonly string[],
): boolean | 'unknown' {
  return braidsEqualWithJonesCheck(movesBraid(a), movesBraid(b));
}

export function inverseSequence(ids: readonly string[]): Braid {
  return inverseBraid(movesBraid(ids));
}
