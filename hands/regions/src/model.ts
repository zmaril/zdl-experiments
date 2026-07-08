/**
 * The grip model.
 *
 * A grip between hand A (leader's right) and hand B (follower's left) is a
 * SET of contact pairs (region of A, region of B). The raw space is therefore
 * 2^(|A| x |B|) subsets. We exclude self-contacts (A-A or B-B pairs) and we
 * exclude the empty set from all "grip" counts (it is the unique no-contact
 * state); both decisions are argued in NOTES.md.
 *
 * Orientation model (the engine behind the ORIENTATION rule):
 * Each hand presents one of three facings toward the other hand:
 *   P = palmar side toward partner, D = dorsal side toward partner,
 *   E = edge-on. A relative orientation is a pair (fA, fB) - 9 total.
 * A rigid region can only make contact when its own surface faces the
 * partner. Perimeter regions (edges, wrist) present some surface in every
 * facing. Mobile regions (digit segments) can contact whenever their own
 * palmar side is not pointed fully away (fX != D), AND - crucially - a mobile
 * region that can make contact may WRAP to touch any surface of the partner
 * hand, waiving the partner's facing requirement for that pair. This is what
 * lets handshake fingers reach the partner's dorsum while palms face.
 */

import type { Facing, HandSpec, Region } from './regions.js';
import { FACINGS } from './regions.js';

export interface ContactPair {
  a: string;
  b: string;
}

export interface GripModel {
  granularity: 'coarse' | 'fine';
  handA: HandSpec; // specs are identical for both hands (mirror correspondence)
  handB: HandSpec;
  regionsA: Region[];
  regionsB: Region[];
  regionIndexA: Map<string, number>;
  regionIndexB: Map<string, number>;
  /** all cross-hand pairs, index p = ai * nB + bi */
  nPairs: number;
  pairA: Int32Array; // pair index -> region index in A
  pairB: Int32Array;
  /** 9-bit orientation mask per pair (bit o set = pair realizable at ORIENTATIONS[o]) */
  pairOrientMask: Int32Array;
  /** pair adjacency matrix (nPairs x nPairs), for CONNECTED_INTERFACE */
  pairAdj: Uint8Array;
  /** region adjacency matrices */
  adjA: Uint8Array;
  adjB: Uint8Array;
  spanCap: number;
}

export const ORIENTATIONS: ReadonlyArray<readonly [Facing, Facing]> = FACINGS.flatMap(
  (fA) => FACINGS.map((fB) => [fA, fB] as const),
);

/** Can region r make contact at all when its hand's facing toward the partner is f? */
export function strictOK(r: Region, f: Facing): boolean {
  if (r.surface === 'any') return true; // perimeter: edge, wrist
  if (r.mobile) return f !== 'D'; // digits curl palmar-ward; useless when dorsum squarely faces partner
  return r.surface === 'palmar' ? f === 'P' : f === 'D';
}

/**
 * Is the contact pair (a of A, b of B) realizable at orientation (fA, fB)?
 * Either both regions strictly face each other, or one side is a mobile
 * region that itself can contact (strict) and wraps to reach the other
 * region regardless of that region's facing.
 */
export function pairAllowedAt(a: Region, b: Region, fA: Facing, fB: Facing): boolean {
  const SA = strictOK(a, fA);
  const SB = strictOK(b, fB);
  return (SA && SB) || (SA && a.mobile) || (SB && b.mobile);
}

export function orientationMask(a: Region, b: Region): number {
  let mask = 0;
  for (let o = 0; o < ORIENTATIONS.length; o++) {
    const [fA, fB] = ORIENTATIONS[o]!;
    if (pairAllowedAt(a, b, fA, fB)) mask |= 1 << o;
  }
  return mask;
}

function adjacencyMatrix(spec: HandSpec, index: Map<string, number>): Uint8Array {
  const n = spec.regions.length;
  const m = new Uint8Array(n * n);
  for (const ed of spec.adjacency) {
    const i = index.get(ed.a);
    const j = index.get(ed.b);
    if (i === undefined || j === undefined) continue;
    m[i * n + j] = 1;
    m[j * n + i] = 1;
  }
  return m;
}

export function buildModel(spec: HandSpec): GripModel {
  const regionsA = spec.regions;
  const regionsB = spec.regions; // identical spec; mirror correspondence by id
  const nA = regionsA.length;
  const nB = regionsB.length;
  const regionIndexA = new Map(regionsA.map((r, i) => [r.id, i] as const));
  const regionIndexB = new Map(regionsB.map((r, i) => [r.id, i] as const));
  const nPairs = nA * nB;
  const pairA = new Int32Array(nPairs);
  const pairB = new Int32Array(nPairs);
  const pairOrientMask = new Int32Array(nPairs);
  for (let ai = 0; ai < nA; ai++) {
    for (let bi = 0; bi < nB; bi++) {
      const p = ai * nB + bi;
      pairA[p] = ai;
      pairB[p] = bi;
      pairOrientMask[p] = orientationMask(regionsA[ai]!, regionsB[bi]!);
    }
  }
  const adjA = adjacencyMatrix(spec, regionIndexA);
  const adjB = adjacencyMatrix(spec, regionIndexB);
  // pair adjacency: (a,b) ~ (a',b') iff (a=a' or adjA) and (b=b' or adjB)
  const pairAdj = new Uint8Array(nPairs * nPairs);
  for (let p = 0; p < nPairs; p++) {
    const ap = pairA[p]!;
    const bp = pairB[p]!;
    for (let q = 0; q < nPairs; q++) {
      if (p === q) continue;
      const aq = pairA[q]!;
      const bq = pairB[q]!;
      const aOK = ap === aq || adjA[ap * nA + aq] === 1;
      const bOK = bp === bq || adjB[bp * nB + bq] === 1;
      if (aOK && bOK) pairAdj[p * nPairs + q] = 1;
    }
  }
  return {
    granularity: spec.granularity,
    handA: spec,
    handB: spec,
    regionsA,
    regionsB,
    regionIndexA,
    regionIndexB,
    nPairs,
    pairA,
    pairB,
    pairOrientMask,
    pairAdj,
    adjA,
    adjB,
    spanCap: spec.spanCap,
  };
}

export function pairIndex(model: GripModel, pair: ContactPair): number {
  const ai = model.regionIndexA.get(pair.a);
  const bi = model.regionIndexB.get(pair.b);
  if (ai === undefined) throw new Error(`unknown region on hand A: ${pair.a}`);
  if (bi === undefined) throw new Error(`unknown region on hand B: ${pair.b}`);
  return ai * model.regionsB.length + bi;
}

export function pairFromIndex(model: GripModel, p: number): ContactPair {
  return { a: model.regionsA[model.pairA[p]!]!.id, b: model.regionsB[model.pairB[p]!]!.id };
}
