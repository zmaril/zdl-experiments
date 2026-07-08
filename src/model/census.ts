/**
 * Reconstruction of the ZDL blog post's 240-state census.
 *
 * The blog post ("A New Kind of Dance Science") crosses the 15 hand
 * partitions with a hammerlock bit per arm (2^4 = 16), for 240 candidate
 * states, and sorts them into six categories with these counts:
 *
 *   impossible 23, weird 45, boring 15, stable 70, mixed 56, transition 31
 *
 * (23+45+15 = 83 filtered out; 70+56+31 = 157 "feasible" states.)
 *
 * The post gives category DESCRIPTIONS but not the classifier source, so
 * this module is a reconstruction. What is taken directly from the post:
 *
 *   - boring:     "No hammer lock" (all 15 partitions with no hammerlock).
 *   - weird:      "somebody holding just their own hands" — a block that is
 *                 exactly two hands of one dancer (applied to states with at
 *                 least one hammerlock; the no-hammerlock ones are boring).
 *   - stable:     every hammerlocked hand is connected to the other dancer's
 *                 hand (its block contains a hand of the other dancer).
 *   - transition: every hammerlocked hand is NOT connected to the other
 *                 dancer's hand.
 *   - mixed:      some hammerlocked hands connected, some not.
 *
 * GUESSED PART — the "impossible" rule. The post only says a state is
 * impossible when "a person's hand needs to be in two places at once".
 * The rule adopted here:
 *
 *   impossible iff some block contains BOTH hands of one dancer, BOTH
 *   hammerlocked.
 *
 * Reading: a hammerlocked left hand sits behind the back near the right
 * hip and a hammerlocked right hand near the left hip; one grip point
 * cannot be in both places, so a hand would have to be in two places at
 * once. This rule was selected by search: with the blog's other five
 * definitions fixed, it is the unique *single natural predicate* (out of a
 * catalog of block/person-level candidates) whose removal counts match the
 * blog exactly (15 from stable-classified, 8 from mixed-classified, 0 from
 * transition-classified states). The six counts alone do not determine the
 * rule uniquely (many block-signature combinations fit), so this remains a
 * documented guess that happens to reproduce all six published counts.
 *
 * Category precedence (needed for overlapping predicates): boring, then
 * weird, then impossible, then stable/transition/mixed. In particular a
 * weird state that also has a doubly-hammerlocked self-grip counts as
 * weird, not impossible — required to keep weird at 45 and impossible at 23.
 */

import {
  ALL_PARTITIONS,
  HANDS,
  owner,
  type Hand,
  type HandPartition,
  type PartitionInfo,
} from './partitions.js';

/** Set of hammerlocked hands (arm bent behind that dancer's own back). */
export type Hammerlocks = ReadonlySet<Hand>;

export type Category = 'impossible' | 'weird' | 'boring' | 'stable' | 'mixed' | 'transition';

export interface CandidateState {
  partition: PartitionInfo;
  hammerlocks: Hammerlocks;
  category: Category;
}

/** Hands whose block contains at least one hand of the other dancer. */
export function crossConnectedHands(partition: HandPartition): Set<Hand> {
  const cross = new Set<Hand>();
  for (const block of partition) {
    const hasLeader = block.some((h) => owner(h) === 'leader');
    const hasFollower = block.some((h) => owner(h) === 'follower');
    if (hasLeader && hasFollower) for (const h of block) cross.add(h);
  }
  return cross;
}

function hasDoublyHammerlockedSelfPairInOneBlock(
  partition: HandPartition,
  ham: Hammerlocks,
): boolean {
  for (const block of partition) {
    for (const dancer of ['leader', 'follower'] as const) {
      const hands = block.filter((h) => owner(h) === dancer);
      if (hands.length === 2 && hands.every((h) => ham.has(h))) return true;
    }
  }
  return false;
}

export function classify(partition: PartitionInfo, hammerlocks: Hammerlocks): Category {
  if (hammerlocks.size === 0) return 'boring';
  if (partition.hasSelfGrip) return 'weird';
  if (hasDoublyHammerlockedSelfPairInOneBlock(partition.blocks, hammerlocks)) return 'impossible';
  const cross = crossConnectedHands(partition.blocks);
  const locked = [...hammerlocks];
  if (locked.every((h) => cross.has(h))) return 'stable';
  if (locked.every((h) => !cross.has(h))) return 'transition';
  return 'mixed';
}

/** All 240 candidate states (15 partitions x 16 hammerlock states). */
export function allCandidateStates(): CandidateState[] {
  const out: CandidateState[] = [];
  for (const partition of ALL_PARTITIONS) {
    for (let mask = 0; mask < 1 << HANDS.length; mask++) {
      const hammerlocks = new Set<Hand>(HANDS.filter((_, i) => mask & (1 << i)));
      out.push({ partition, hammerlocks, category: classify(partition, hammerlocks) });
    }
  }
  return out;
}

export type CensusCounts = Record<Category, number> & { total: number; feasible: number };

/** Category counts over the 240 states; `feasible` = stable+mixed+transition. */
export function censusCounts(): CensusCounts {
  const counts: CensusCounts = {
    impossible: 0,
    weird: 0,
    boring: 0,
    stable: 0,
    mixed: 0,
    transition: 0,
    total: 0,
    feasible: 0,
  };
  for (const s of allCandidateStates()) {
    counts[s.category]++;
    counts.total++;
  }
  counts.feasible = counts.stable + counts.mixed + counts.transition;
  return counts;
}

/** The blog's feasible set: stable, mixed, and transition states (157). */
export function feasibleStates(): CandidateState[] {
  return allCandidateStates().filter(
    (s) => s.category === 'stable' || s.category === 'mixed' || s.category === 'transition',
  );
}

export function hammerlockKey(h: Hammerlocks): string {
  return HANDS.filter((x) => h.has(x)).join(',') || 'none';
}

export function stateKey(s: { partition: PartitionInfo; hammerlocks: Hammerlocks }): string {
  return `${s.partition.id} / ham[${hammerlockKey(s.hammerlocks)}]`;
}
