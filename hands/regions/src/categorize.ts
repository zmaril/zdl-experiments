/**
 * Categorization of feasible grips. Categories are heuristic labels in the
 * grip-taxonomy tradition (power vs precision vs hook), assigned by the first
 * matching predicate:
 *
 *  power      - some hand X has its palm in contact AND its fingers reaching
 *               the far side of the partner hand (dorsum/edge/wrist): palm
 *               plus finger wrap. Handshake, pistol grip, wrist grab.
 *  hook       - some hand X engages with finger curl segments while its palm
 *               and thumb stay out of contact: load hangs on hooked fingers.
 *  precision  - all contact regions on both hands are digits (thumb or
 *               fingers): the grip is manipulated by digit pads only.
 *  edge-dorsal- every contact region is an edge, the dorsum, or the wrist:
 *               blade/back-of-hand connections (e.g., back-to-back hands).
 *  platform   - a palm is involved but nothing wraps: resting/cradling
 *               contact (ballroom hand-on-top, cupped hands).
 *  other      - anything else.
 *
 * Orthogonally: a grip is `symmetric` when swapping the two hands under the
 * natural mirror correspondence (same region id on the other hand) leaves
 * the contact set unchanged - the hold feels the same to both dancers.
 */

import type { ContactPair, GripModel } from './model.js';

export type Category = 'power' | 'hook' | 'precision' | 'edge-dorsal' | 'platform' | 'other';

export const CATEGORIES: Category[] = [
  'power',
  'hook',
  'precision',
  'edge-dorsal',
  'platform',
  'other',
];

export interface Categorization {
  category: Category;
  symmetric: boolean;
}

export function categorizeIdx(model: GripModel, idx: number[]): Categorization {
  let palmA = false;
  let palmB = false;
  let thumbA = false;
  let thumbB = false;
  let curlA = false;
  let curlB = false;
  let fingerFarA = false; // A's fingers/tips touch B's dorsum/edge/wrist
  let fingerFarB = false;
  let allDigits = true;
  let allEdgeDorsal = true;

  for (const p of idx) {
    const ra = model.regionsA[model.pairA[p]!]!;
    const rb = model.regionsB[model.pairB[p]!]!;
    if (ra.palmarZone) palmA = true;
    if (rb.palmarZone) palmB = true;
    if (ra.isThumb) thumbA = true;
    if (rb.isThumb) thumbB = true;
    if (ra.isCurlSegment) curlA = true;
    if (rb.isCurlSegment) curlB = true;
    if (ra.isFinger && (rb.isDorsum || rb.isEdge || rb.isWrist)) fingerFarA = true;
    if (rb.isFinger && (ra.isDorsum || ra.isEdge || ra.isWrist)) fingerFarB = true;
    for (const r of [ra, rb]) {
      if (!(r.isFinger || r.isThumb)) allDigits = false;
      if (!(r.isEdge || r.isDorsum || r.isWrist)) allEdgeDorsal = false;
    }
  }

  let category: Category;
  if ((palmA && fingerFarA) || (palmB && fingerFarB)) category = 'power';
  else if ((curlA && !palmA && !thumbA) || (curlB && !palmB && !thumbB)) category = 'hook';
  else if (idx.length > 0 && allDigits) category = 'precision';
  else if (idx.length > 0 && allEdgeDorsal) category = 'edge-dorsal';
  else if (palmA || palmB) category = 'platform';
  else category = 'other';

  // symmetric: set equals its transpose under the mirror correspondence
  const nB = model.regionsB.length;
  const present = new Set(idx);
  let symmetric = true;
  for (const p of idx) {
    const transposed = model.pairB[p]! * nB + model.pairA[p]!;
    if (!present.has(transposed)) {
      symmetric = false;
      break;
    }
  }

  return { category, symmetric };
}

export function categorize(model: GripModel, pairs: ContactPair[]): Categorization {
  const nB = model.regionsB.length;
  const idx = pairs.map((p) => {
    const ai = model.regionIndexA.get(p.a);
    const bi = model.regionIndexB.get(p.b);
    if (ai === undefined || bi === undefined) throw new Error(`unknown region in ${p.a}~${p.b}`);
    return ai * nB + bi;
  });
  return categorizeIdx(model, idx);
}
