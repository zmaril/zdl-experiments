/**
 * Hands and hand partitions.
 *
 * The ZDL blog post ("A New Kind of Dance Science", zacksdancelab.com) models
 * a two-dancer hand connection as a set partition of the four hands
 * {leader-left, leader-right, follower-left, follower-right}: hands in the
 * same block are joined in one grip. There are Bell(4) = 15 such partitions.
 *
 * This module enumerates the partitions programmatically (generic set
 * partition enumeration, specialized to the four hands) and attaches stable
 * ids and dance-flavored names.
 */

export type Hand = 'LL' | 'LR' | 'FL' | 'FR';
export type Dancer = 'leader' | 'follower';

export const HANDS: readonly Hand[] = ['LL', 'LR', 'FL', 'FR'];

export function owner(hand: Hand): Dancer {
  return hand.startsWith('L') ? 'leader' : 'follower';
}

/** A block is a set of hands joined in one grip (canonically sorted). */
export type Block = readonly Hand[];
/** A partition is a set of disjoint blocks covering all four hands. */
export type HandPartition = readonly Block[];

const HAND_INDEX = new Map<Hand, number>(HANDS.map((h, i) => [h, i]));

function sortBlock(block: readonly Hand[]): Hand[] {
  return [...block].sort((a, b) => HAND_INDEX.get(a)! - HAND_INDEX.get(b)!);
}

/** Canonical form: hands sorted within blocks, blocks sorted by first hand. */
export function canonicalPartition(blocks: ReadonlyArray<readonly Hand[]>): HandPartition {
  return blocks
    .map(sortBlock)
    .sort((a, b) => HAND_INDEX.get(a[0]!)! - HAND_INDEX.get(b[0]!)!);
}

/** Stable id, e.g. "LL.FR|LR.FL"; singleton blocks are omitted ("" = no contact). */
export function partitionId(p: HandPartition): string {
  const grips = canonicalPartition(p).filter((b) => b.length >= 2);
  return grips.length === 0 ? 'none' : grips.map((b) => b.join('.')).join('|');
}

/** All set partitions of `items` (order-insensitive, no canonicalization). */
export function setPartitions<T>(items: readonly T[]): T[][][] {
  if (items.length === 0) return [[]];
  const [first, ...rest] = items as [T, ...T[]];
  const out: T[][][] = [];
  for (const p of setPartitions(rest)) {
    for (let i = 0; i < p.length; i++) {
      out.push(p.map((blk, j) => (i === j ? [first, ...blk] : blk)));
    }
    out.push([[first], ...p]);
  }
  return out;
}

export interface PartitionInfo {
  id: string;
  blocks: HandPartition;
  name: string;
  /** Sizes of the grip blocks (size >= 2), descending. */
  gripSizes: number[];
  /** True if some block joins two hands of one dancer with nobody else. */
  hasSelfGrip: boolean;
}

const NAMES: Record<string, string> = {
  'none': 'no contact',
  'LL.FL': 'cross hold (left to left)',
  'LL.FR': 'open single hold (leader L, follower R)',
  'LR.FL': 'open single hold (leader R, follower L)',
  'LR.FR': 'handshake hold (right to right)',
  'LL.LR': 'leader holds own hands',
  'FL.FR': 'follower holds own hands',
  'LL.FR|LR.FL': 'open two-hand hold',
  'LL.FL|LR.FR': 'crossed two-hand hold',
  'LL.LR|FL.FR': 'each dancer holds own hands',
  'LL.LR.FL': 'three-hand grip (both leader hands + follower L)',
  'LL.LR.FR': 'three-hand grip (both leader hands + follower R)',
  'LL.FL.FR': 'three-hand grip (leader L + both follower hands)',
  'LR.FL.FR': 'three-hand grip (leader R + both follower hands)',
  'LL.LR.FL.FR': 'four-hand grip',
};

function selfGrip(b: Block): boolean {
  return b.length === 2 && owner(b[0]!) === owner(b[1]!);
}

/** The 15 hand partitions, canonical order (sorted by id). */
export const ALL_PARTITIONS: readonly PartitionInfo[] = setPartitions(HANDS)
  .map((blocks) => canonicalPartition(blocks))
  .map((blocks) => {
    const id = partitionId(blocks);
    return {
      id,
      blocks,
      name: NAMES[id] ?? id,
      gripSizes: blocks
        .filter((b) => b.length >= 2)
        .map((b) => b.length)
        .sort((a, b) => b - a),
      hasSelfGrip: blocks.some(selfGrip),
    };
  })
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export function partitionById(id: string): PartitionInfo {
  const p = ALL_PARTITIONS.find((x) => x.id === id);
  if (!p) throw new Error(`no partition with id "${id}"`);
  return p;
}
