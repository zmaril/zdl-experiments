/**
 * Feasibility rules, kept as named, individually toggleable predicates so
 * sensitivity analysis (NOTES.md section 6) is a matter of flipping booleans.
 *
 * R1 ORIENTATION - there must exist at least one relative orientation
 *    (fA, fB) in {P,D,E}^2 at which every contact pair is realizable.
 *    This generalizes the headline exclusion: palm-of-A-on-palm-of-B forces
 *    (P,P), back-on-back forces (D,D), so they can never coexist. Monotone.
 *
 * R2 OPPOSITE_FACES - a single region cannot simultaneously touch the palmar
 *    zone(s) AND the dorsum of the partner's hand: one patch of skin cannot
 *    be on both sides of a rigid slab. Exempt: coarse multi-digit groups
 *    (fingers, fingertips), because four ~90mm digits genuinely can wrap
 *    around the ~30mm-thick hand edge and reach both faces (a firm
 *    handshake's fingers touch the partner's palm edge AND dorsum). At fine
 *    granularity every region is a single patch, so no exemptions. Monotone.
 *
 * R3 CONNECTED_INTERFACE - one grip is one pose: its contact patches must
 *    form a single connected interface, where "connected" is judged in the
 *    graph of 3D proximity (structural borders + flex adjacency from
 *    curl/opposition + palm-slab thickness). Two pairs are adjacent when
 *    both their A-regions and their B-regions coincide or are adjacent.
 *    The flex and thickness edges are what keep real grips alive here:
 *    mutual C-grip (A's fingertips in B's palm + B's fingertips in A's palm)
 *    is connected through fingertip~palm curl edges, and a pinch (thumb on
 *    palm + fingertips on dorsum) is connected through thumb~fingertip
 *    opposition and palm~dorsum thickness. NOT monotone (a disconnected set
 *    can become connected by adding pairs), so it is checked per set, not
 *    used for pruning.
 *
 * R4 SMALL_REGION_SPAN - a small region (thumb, fingertip pads; at fine
 *    granularity each distal pad and the thumb pad) is a small patch of skin
 *    and can only nestle against a bounded number of partner regions at
 *    once (cap: 3 coarse / 4 fine). Monotone.
 */

import type { ContactPair, GripModel } from './model.js';
import { ORIENTATIONS, pairIndex } from './model.js';

export interface RuleToggles {
  orientation: boolean;
  oppositeFaces: boolean;
  connectedInterface: boolean;
  smallRegionSpan: boolean;
}

export const ALL_RULES: RuleToggles = {
  orientation: true,
  oppositeFaces: true,
  connectedInterface: true,
  smallRegionSpan: true,
};

export const NO_RULES: RuleToggles = {
  orientation: false,
  oppositeFaces: false,
  connectedInterface: false,
  smallRegionSpan: false,
};

export const RULE_IDS = [
  'orientation',
  'oppositeFaces',
  'connectedInterface',
  'smallRegionSpan',
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export const RULE_DESCRIPTIONS: Record<RuleId, string> = {
  orientation:
    'a single relative orientation of the two hands must permit every contact pair (generalizes palm-to-palm vs back-to-back exclusion)',
  oppositeFaces:
    'no single region touches both the palmar zone(s) and the dorsum of the partner hand (multi-digit coarse groups exempt: they wrap)',
  connectedInterface:
    'the contact patches of one grip form one connected interface under 3D-proximity adjacency (structural + curl/opposition flex + palm-slab thickness)',
  smallRegionSpan:
    'small regions (thumb, fingertip pads) touch at most cap partner regions (3 coarse / 4 fine)',
};

export interface GripCheck {
  feasible: boolean;
  failed: RuleId[];
  /** orientations compatible with the whole set (indices into ORIENTATIONS) */
  orientations: number[];
}

/** Direct (non-incremental) feasibility check of an explicit contact set. */
export function checkGrip(
  model: GripModel,
  pairs: ContactPair[],
  toggles: RuleToggles = ALL_RULES,
): GripCheck {
  const idx = pairs.map((p) => pairIndex(model, p));
  const failed: RuleId[] = [];

  // R1 orientation
  let mask = (1 << ORIENTATIONS.length) - 1;
  for (const p of idx) mask &= model.pairOrientMask[p]!;
  const orientations: number[] = [];
  for (let o = 0; o < ORIENTATIONS.length; o++) if (mask & (1 << o)) orientations.push(o);
  if (toggles.orientation && idx.length > 0 && mask === 0) failed.push('orientation');

  // R2 opposite faces
  if (toggles.oppositeFaces && violatesOppositeFaces(model, idx)) failed.push('oppositeFaces');

  // R3 connected interface
  if (toggles.connectedInterface && !isConnected(model, idx)) failed.push('connectedInterface');

  // R4 small region span
  if (toggles.smallRegionSpan && violatesSpan(model, idx)) failed.push('smallRegionSpan');

  return { feasible: failed.length === 0, failed, orientations };
}

export function violatesOppositeFaces(model: GripModel, idx: number[]): boolean {
  const nA = model.regionsA.length;
  const nB = model.regionsB.length;
  // per A-region: does it touch a palmar zone / the dorsum of B? (and vice versa)
  const aPalmar = new Uint8Array(nA);
  const aDorsal = new Uint8Array(nA);
  const bPalmar = new Uint8Array(nB);
  const bDorsal = new Uint8Array(nB);
  for (const p of idx) {
    const ai = model.pairA[p]!;
    const bi = model.pairB[p]!;
    const ra = model.regionsA[ai]!;
    const rb = model.regionsB[bi]!;
    if (rb.palmarZone) aPalmar[ai] = 1;
    if (rb.isDorsum) aDorsal[ai] = 1;
    if (ra.palmarZone) bPalmar[bi] = 1;
    if (ra.isDorsum) bDorsal[bi] = 1;
  }
  for (let ai = 0; ai < nA; ai++) {
    if (aPalmar[ai] && aDorsal[ai] && !model.regionsA[ai]!.multiDigit) return true;
  }
  for (let bi = 0; bi < nB; bi++) {
    if (bPalmar[bi] && bDorsal[bi] && !model.regionsB[bi]!.multiDigit) return true;
  }
  return false;
}

export function isConnected(model: GripModel, idx: number[]): boolean {
  if (idx.length <= 1) return true;
  const n = idx.length;
  const seen = new Uint8Array(n);
  const stack = [0];
  seen[0] = 1;
  let count = 1;
  while (stack.length > 0) {
    const i = stack.pop()!;
    const row = idx[i]! * model.nPairs;
    for (let j = 0; j < n; j++) {
      if (!seen[j] && model.pairAdj[row + idx[j]!] === 1) {
        seen[j] = 1;
        count++;
        stack.push(j);
      }
    }
  }
  return count === n;
}

export function violatesSpan(model: GripModel, idx: number[]): boolean {
  const nA = model.regionsA.length;
  const nB = model.regionsB.length;
  const degA = new Int32Array(nA);
  const degB = new Int32Array(nB);
  for (const p of idx) {
    const ai = model.pairA[p]!;
    const bi = model.pairB[p]!;
    if (model.regionsA[ai]!.small && ++degA[ai]! > model.spanCap) return true;
    if (model.regionsB[bi]!.small && ++degB[bi]! > model.spanCap) return true;
  }
  return false;
}
