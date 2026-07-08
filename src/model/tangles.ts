/**
 * Dance position -> tangle construction.
 *
 * Frame convention (documented, load-bearing):
 *
 *   The two dancers stand in canonical facing stance. Each torso is modeled
 *   as a vertical obstacle bar running floor to ceiling — a strand with both
 *   ends fixed on the boundary that arms can never pass through (and, since
 *   the bar is extended to floor and ceiling, arms may not pass over the
 *   head or under the feet either; over-the-head escapes are deliberately
 *   outside this model and are discussed in NOTES.md).
 *
 *   All strands are drawn braid-style, bottom to top, in a strip. The
 *   canonical left-to-right strand order is
 *
 *       [LT, LL, LR, FL, FR, FT]
 *
 *   (leader torso, leader arms, follower arms, follower torso). Arms are
 *   strands from a shoulder anchor on the bottom boundary to a hand at the
 *   top; grips fuse two hand ends into one "chain" strand running
 *   shoulder-to-shoulder. The region left of LT is "behind the leader's
 *   back", right of FT "behind the follower's back", between the torsos is
 *   the shared front zone. A hammerlocked grip lives in the behind-zone of
 *   the hammerlocked hand's owner, which forces the chain to cross that
 *   torso bar twice — once per flank. Opposite-flank passes enclose the
 *   torso (the chain-torso linking number becomes +-1: topologically
 *   locked); same-flank passes are removable (a "fake" hammerlock,
 *   topologically equal to the front grip).
 *
 *   With this order, the parity of forced arm-arm crossings matches dance
 *   reality: the open two-hand hold (LL-FR, LR-FL) needs zero crossings,
 *   the crossed two-hand hold (LL-FL, LR-FR) needs an odd number.
 *
 * Free (ungripped) arms carry no strand: an unheld arm can always be moved
 * freely (including out of a hammerlock), so it contributes no topology.
 * Its hammerlock bit is recorded as geometric-only data.
 *
 * Representability limits (both flagged, not fudged):
 *   - grips of 3+ hands make the position a spatial GRAPH, not a link;
 *     the link-based toolkit does not refine those ("multi-grip");
 *   - a 2-hand grip whose two hands are BOTH hammerlocked needs the grip
 *     behind both backs at once — impossible facing, back-to-back otherwise;
 *     facing orientation is fixed in this model ("back-to-back").
 */

import {
  braid,
  braidPermutation,
  closeTangle,
  composeTangles,
  reverseStrand,
  tangleFromBraid,
  trivialTangle,
  mapLabels,
  type Diagram,
  type Tangle,
} from '../core/index.js';
import { owner, type Hand } from './partitions.js';
import type { Hammerlocks } from './census.js';
import type { HandPartition } from './partitions.js';

export type StrandName = Hand | 'LT' | 'FT';
export type Zone = 'front' | 'behindLeader' | 'behindFollower';

export interface ChainSpec {
  /** hands[0] keeps its shoulder->hand orientation; hands[1] is reversed. */
  hands: [Hand, Hand];
  zone: Zone;
}

export function chainName(c: ChainSpec): string {
  return `grip:${c.hands[0]}.${c.hands[1]}`;
}

export interface PlanLetter {
  pair: [StrandName, StrandName];
  kind: 'torsoPass' | 'armPass';
}

export interface PositionPlan {
  /** Initial bottom-to-top strand order, left to right. */
  strands: StrandName[];
  /** Final (top) strand order after routing. */
  target: StrandName[];
  /** Routing crossings, in application order; signs are variant choices. */
  letters: PlanLetter[];
  chains: ChainSpec[];
  /**
   * When two front chains sit side by side with no forced crossing, an
   * optional full twist (clasp) between these two adjacent strands is the
   * one decoration within the crossing bound; null otherwise.
   */
  twistPair: [StrandName, StrandName] | null;
  /** Hammerlocked hands with no grip: geometric data only, no strand. */
  geometricHammerlocks: Hand[];
}

export type PlanFailure = 'multi-grip' | 'back-to-back';
export type PlanResult = { ok: true; plan: PositionPlan } | { ok: false; reason: PlanFailure };

const ARM_ORDER: readonly Hand[] = ['LL', 'LR', 'FL', 'FR'];

function bubbleLetters(from: StrandName[], to: StrandName[]): PlanLetter[] {
  const targetIdx = new Map(to.map((s, i) => [s, i]));
  const arr = [...from];
  const letters: PlanLetter[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i + 1 < arr.length; i++) {
      const a = arr[i]!;
      const b = arr[i + 1]!;
      if (targetIdx.get(a)! > targetIdx.get(b)!) {
        letters.push({
          pair: [a, b],
          kind: a === 'LT' || a === 'FT' || b === 'LT' || b === 'FT' ? 'torsoPass' : 'armPass',
        });
        arr[i] = b;
        arr[i + 1] = a;
        changed = true;
      }
    }
  }
  return letters;
}

/** Chain zone from the hammerlock bits of its two hands. */
function chainZone(hands: [Hand, Hand], ham: Hammerlocks): Zone | 'both' {
  const sides = new Set(hands.filter((h) => ham.has(h)).map((h) => owner(h)));
  if (sides.size === 2) return 'both';
  if (sides.has('leader')) return 'behindLeader';
  if (sides.has('follower')) return 'behindFollower';
  return 'front';
}

/** True iff the two index pairs interleave (a1 < b1 < a2 < b2 pattern). */
function interleaved(a: [number, number], b: [number, number]): boolean {
  const [a1, a2] = [Math.min(...a), Math.max(...a)];
  const [b1, b2] = [Math.min(...b), Math.max(...b)];
  return (a1 < b1 && b1 < a2 && a2 < b2) || (b1 < a1 && a1 < b2 && b2 < a2);
}

export function planPosition(state: {
  partition: { blocks: HandPartition };
  hammerlocks: Hammerlocks;
}): PlanResult {
  const grips = state.partition.blocks.filter((b) => b.length >= 2);
  if (grips.some((b) => b.length > 2)) return { ok: false, reason: 'multi-grip' };

  const chains: ChainSpec[] = [];
  for (const grip of grips) {
    const hands = [...grip].sort((a, b) => ARM_ORDER.indexOf(a) - ARM_ORDER.indexOf(b)) as [
      Hand,
      Hand,
    ];
    const zone = chainZone(hands, state.hammerlocks);
    if (zone === 'both') return { ok: false, reason: 'back-to-back' };
    chains.push({ hands, zone });
  }

  const gripped = new Set(chains.flatMap((c) => c.hands));
  const strands: StrandName[] = [
    'LT',
    ...ARM_ORDER.filter((h) => gripped.has(h)),
    'FT',
  ];

  // Target order by zone: [behind-leader][LT][front][FT][behind-follower].
  const zoneArms = (zone: Zone): StrandName[] => {
    const zchains = chains.filter((c) => c.zone === zone);
    if (zone !== 'front') {
      // Behind a back: each chain's two arms side by side.
      return zchains.flatMap((c) => c.hands);
    }
    // Front zone: canonical arm order, with one swap if two front chains
    // interleave (the forced crossing of the crossed two-hand hold).
    const arms = ARM_ORDER.filter((h) => zchains.some((c) => c.hands.includes(h)));
    if (zchains.length === 2) {
      const pos = (c: ChainSpec): [number, number] => [
        arms.indexOf(c.hands[0]),
        arms.indexOf(c.hands[1]),
      ];
      if (interleaved(pos(zchains[0]!), pos(zchains[1]!))) {
        const fixed = [...arms];
        [fixed[1], fixed[2]] = [fixed[2]!, fixed[1]!];
        return fixed;
      }
    }
    return arms;
  };

  const target: StrandName[] = [
    ...zoneArms('behindLeader'),
    'LT',
    ...zoneArms('front'),
    'FT',
    ...zoneArms('behindFollower'),
  ];

  const letters = bubbleLetters(strands, target);

  // Twist decoration: only for two undisturbed side-by-side front chains.
  let twistPair: [StrandName, StrandName] | null = null;
  if (chains.length === 2 && chains.every((c) => c.zone === 'front') && letters.length === 0) {
    const chainOf = new Map<StrandName, number>();
    chains.forEach((c, i) => c.hands.forEach((h) => chainOf.set(h, i)));
    for (let i = 0; i + 1 < target.length; i++) {
      const a = target[i]!;
      const b = target[i + 1]!;
      if (chainOf.has(a) && chainOf.has(b) && chainOf.get(a) !== chainOf.get(b)) {
        twistPair = [a, b];
        break;
      }
    }
  }

  const geometricHammerlocks = [...state.hammerlocks].filter((h) => !gripped.has(h));

  return {
    ok: true,
    plan: { strands, target, letters, chains, twistPair, geometricHammerlocks },
  };
}

export interface VariantChoice {
  /** One sign per plan letter (+1 = left strand passes in front). */
  signs: ReadonlyArray<1 | -1>;
  /** Full-twist decoration between twistPair strands (0 = none). */
  twist: -1 | 0 | 1;
}

/** All variant choices for a plan (2^letters, x3 when a twist slot exists). */
export function variantSpace(plan: PositionPlan): VariantChoice[] {
  const out: VariantChoice[] = [];
  const twists: Array<-1 | 0 | 1> = plan.twistPair ? [-1, 0, 1] : [0];
  const n = plan.letters.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const signs = Array.from({ length: n }, (_, i) => ((mask >> i) & 1 ? 1 : -1) as 1 | -1);
    for (const twist of twists) out.push({ signs, twist });
  }
  return out;
}

export interface BuiltPosition {
  tangle: Tangle;
  plan: PositionPlan;
  variant: VariantChoice;
  /** Braid word actually used (core convention: letter +-i acts at positions i-1,i). */
  word: number[];
  /** Closure pairing (out-label, in-label) used by closePosition. */
  closurePairs: Array<[string, string]>;
  /** Boundary 'in' label -> component name ('LT', 'FT', 'grip:A.B'). */
  componentOf: Map<string, string>;
}

/**
 * Build the tangle: braid the routing word, relabel boundary points
 * semantically, reverse the second arm of each chain, and fuse hand pairs
 * with tiny cap strands. Boundary afterwards: LT.bot/LT.top, FT.bot/FT.top,
 * and one <hand>.sh per gripped arm.
 */
export function buildPositionTangle(plan: PositionPlan, variant: VariantChoice): BuiltPosition {
  if (variant.signs.length !== plan.letters.length) {
    throw new Error(
      `variant has ${variant.signs.length} signs for ${plan.letters.length} letters`,
    );
  }
  const n = plan.strands.length;

  // Replay the bubble routing, now emitting signed braid letters.
  const targetIdx = new Map(plan.target.map((s, i) => [s, i]));
  const arr = [...plan.strands];
  const word: number[] = [];
  let li = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i + 1 < arr.length; i++) {
      if (targetIdx.get(arr[i]!)! > targetIdx.get(arr[i + 1]!)!) {
        const sign = variant.signs[li]!;
        li++;
        word.push(sign * (i + 1));
        [arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!];
        changed = true;
      }
    }
  }

  if (plan.twistPair && variant.twist !== 0) {
    const [a, b] = plan.twistPair;
    const ia = plan.target.indexOf(a);
    const ib = plan.target.indexOf(b);
    if (Math.abs(ia - ib) !== 1) throw new Error('twist pair not adjacent in target order');
    const letter = (Math.min(ia, ib) + 1) * (variant.twist > 0 ? 1 : -1);
    word.push(letter, letter); // sigma^{+-2}: a clasp, not removable by R2
  }

  const bt = tangleFromBraid(braid(n, word), 'b', 't');
  const perm = braidPermutation(braid(n, word));
  const bottomName = new Map<string, string>();
  const topName = new Map<string, string>();
  plan.strands.forEach((s, i) => {
    const isTorso = s === 'LT' || s === 'FT';
    bottomName.set(`b${i}`, isTorso ? `${s}.bot` : `${s}.sh`);
    topName.set(`t${perm[i]!}`, isTorso ? `${s}.top` : `${s}.hd`);
  });
  let t: Tangle = mapLabels(bt, (l) => bottomName.get(l) ?? topName.get(l) ?? l);

  // Reverse the second arm of each chain so its hand end becomes 'in'.
  for (const c of plan.chains) t = reverseStrand(t, `${c.hands[1]}.hd`);

  // Fuse hand pairs with cap strands.
  if (plan.chains.length > 0) {
    const capT = trivialTangle(plan.chains.map((_, i) => [`cap${i}i`, `cap${i}o`]));
    const gluing: Array<[string, string]> = [];
    plan.chains.forEach((c, i) => {
      gluing.push([`${c.hands[0]}.hd`, `cap${i}i`]);
      gluing.push([`${c.hands[1]}.hd`, `cap${i}o`]);
    });
    t = composeTangles(t, capT, gluing);
  }

  // Closure pattern (always planar in this frame; see module docs).
  const closurePairs: Array<[string, string]> = [
    ['LT.top', 'LT.bot'],
    ['FT.top', 'FT.bot'],
  ];
  if (plan.chains.length === 1) {
    const c = plan.chains[0]!;
    closurePairs.push([`${c.hands[1]}.sh`, `${c.hands[0]}.sh`]);
  } else if (plan.chains.length === 2) {
    const [c1, c2] = plan.chains as [ChainSpec, ChainSpec];
    const pos = (h: Hand) => plan.strands.indexOf(h);
    const p1: [number, number] = [pos(c1.hands[0]), pos(c1.hands[1])];
    const p2: [number, number] = [pos(c2.hands[0]), pos(c2.hands[1])];
    if (interleaved(p1, p2)) {
      // Separate closure arcs would cross; concatenate the chains instead.
      closurePairs.push([`${c1.hands[1]}.sh`, `${c2.hands[0]}.sh`]);
      closurePairs.push([`${c2.hands[1]}.sh`, `${c1.hands[0]}.sh`]);
    } else {
      closurePairs.push([`${c1.hands[1]}.sh`, `${c1.hands[0]}.sh`]);
      closurePairs.push([`${c2.hands[1]}.sh`, `${c2.hands[0]}.sh`]);
    }
  }

  const componentOf = new Map<string, string>([
    ['LT.bot', 'LT'],
    ['FT.bot', 'FT'],
  ]);
  for (const c of plan.chains) componentOf.set(`${c.hands[0]}.sh`, chainName(c));

  return { tangle: t, plan, variant, word, closurePairs, componentOf };
}

/** Close arms through the bodies/floor and torsos around the outside. */
export function closePosition(built: BuiltPosition): Diagram {
  return closeTangle(built.tangle, built.closurePairs);
}

/** Map every edge of a tangle to the 'in'-boundary label of its open strand. */
export function tangleEdgeComponents(t: Tangle): Map<number, string> {
  const comp = new Map<number, string>();
  for (const start of t.boundary) {
    if (start.dir !== 'in') continue;
    let e = start.edge;
    for (;;) {
      comp.set(e, start.label);
      const c = t.crossings.find((x) => x.underIn === e || x.overIn === e);
      if (!c) break; // reached a boundary 'out' point
      e = c.overIn === e ? c.overOut : c.underOut;
    }
  }
  return comp;
}

/**
 * String-link linking data: for each pair of distinct components
 * (chains/torsos) the sum of the signs of their mutual crossings. This sum
 * is invariant under isotopy rel boundary (R2 adds a cancelling pair
 * between the same two components, R1 is a self-crossing, R3 changes
 * nothing); for a closed 2-component sublink it is twice the classical
 * linking number. Keys are "A|B" with A < B; zero sums are dropped.
 */
export function stringLinkingSums(built: BuiltPosition): Map<string, number> {
  const t = built.tangle;
  const edgeComp = tangleEdgeComponents(t);
  const name = (inLabel: string): string => built.componentOf.get(inLabel) ?? inLabel;
  const sums = new Map<string, number>();
  for (const c of t.crossings) {
    const a = name(edgeComp.get(c.overIn)!);
    const b = name(edgeComp.get(c.underIn)!);
    if (a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    sums.set(key, (sums.get(key) ?? 0) + c.sign);
  }
  for (const [k, v] of sums) if (v === 0) sums.delete(k);
  return sums;
}

/**
 * A variant is "locked" when every behind-a-back chain actually encloses
 * its torso bar (linking sum +-2, i.e. opposite-flank passes). Same-flank
 * passes produce removable crossings — a "fake" hammerlock topologically
 * equal to the front-zone grip; those variants are census degenerates.
 */
export function isLockedVariant(built: BuiltPosition): boolean {
  const sums = stringLinkingSums(built);
  for (const c of built.plan.chains) {
    if (c.zone === 'front') continue;
    const torso = c.zone === 'behindLeader' ? 'LT' : 'FT';
    const name = chainName(c);
    const key = torso < name ? `${torso}|${name}` : `${name}|${torso}`;
    if (Math.abs(sums.get(key) ?? 0) !== 2) return false;
  }
  return true;
}

/** All locked variants of a plan (built and filtered). */
export function lockedVariants(plan: PositionPlan): VariantChoice[] {
  return variantSpace(plan).filter((v) => isLockedVariant(buildPositionTangle(plan, v)));
}
