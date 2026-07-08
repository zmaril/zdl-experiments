/**
 * Exact analytic counts over ALL set sizes (not bounded by K) for the
 * monotone, orientation-structured rules, via inclusion-exclusion over the
 * 9 relative orientations.
 *
 * Let P_o be the set of contact pairs realizable at orientation o. A set is
 * ORIENTATION-feasible iff it is a subset of some P_o, so the count of
 * feasible sets (including the empty set) is |union_o 2^(P_o)| =
 *   sum over nonempty S subseteq O of (-1)^(|S|+1) * 2^(|Q_S|),
 * where Q_S = pairs realizable at every o in S (mask superset test).
 *
 * For ORIENTATION + OPPOSITE_FACES at coarse granularity the R2 constraints
 * that can actually fire inside a single Q_S are "forbidden couples" of
 * pairs {q1, q2} (a non-exempt region touching both the partner's palm and
 * dorsum). Each active couple replaces a factor 2^2 with 3 (all subsets of
 * {q1,q2} except both). Couples active in the same Q_S are verified to be
 * pairwise disjoint, so factors multiply. (Rigid regions' couples are never
 * co-realizable at one orientation, so at coarse granularity only the two
 * thumb couples ever activate.)
 */

import type { GripModel } from './model.js';

export interface AnalyticOptions {
  /** additionally apply OPPOSITE_FACES (supported when each hand has a single palmar zone) */
  withOppositeFaces?: boolean;
}

interface Couple {
  q1: number;
  q2: number;
}

function r2Couples(model: GripModel): Couple[] {
  const couples: Couple[] = [];
  const nB = model.regionsB.length;
  const palmarB = model.regionsB.flatMap((r, i) => (r.palmarZone ? [i] : []));
  const dorsalB = model.regionsB.flatMap((r, i) => (r.isDorsum ? [i] : []));
  const palmarA = model.regionsA.flatMap((r, i) => (r.palmarZone ? [i] : []));
  const dorsalA = model.regionsA.flatMap((r, i) => (r.isDorsum ? [i] : []));
  if (palmarB.length !== 1 || dorsalB.length !== 1 || palmarA.length !== 1 || dorsalA.length !== 1) {
    throw new Error(
      'analytic OPPOSITE_FACES requires exactly one palmar zone and one dorsum per hand (coarse granularity)',
    );
  }
  for (let ai = 0; ai < model.regionsA.length; ai++) {
    if (model.regionsA[ai]!.multiDigit) continue;
    couples.push({ q1: ai * nB + palmarB[0]!, q2: ai * nB + dorsalB[0]! });
  }
  for (let bi = 0; bi < nB; bi++) {
    if (model.regionsB[bi]!.multiDigit) continue;
    couples.push({ q1: palmarA[0]! * nB + bi, q2: dorsalA[0]! * nB + bi });
  }
  return couples;
}

/**
 * Exact number of NONEMPTY orientation-feasible contact sets (all sizes),
 * optionally also filtered by OPPOSITE_FACES.
 */
export function analyticCount(model: GripModel, opts: AnalyticOptions = {}): bigint {
  const nOrient = 9;
  const masks = model.pairOrientMask;
  const couples = opts.withOppositeFaces ? r2Couples(model) : [];

  let total = 0n;
  for (let s = 1; s < 1 << nOrient; s++) {
    // Q_s = pairs whose mask contains every orientation in s
    let inQ: (p: number) => boolean;
    let sizeQ = 0;
    {
      const flags = new Uint8Array(model.nPairs);
      for (let p = 0; p < model.nPairs; p++) {
        if ((masks[p]! & s) === s) {
          flags[p] = 1;
          sizeQ++;
        }
      }
      inQ = (p) => flags[p] === 1;
    }

    let term: bigint;
    if (couples.length === 0) {
      term = 1n << BigInt(sizeQ);
    } else {
      // active couples: both members inside Q_s
      const active = couples.filter((c) => inQ(c.q1) && inQ(c.q2));
      // verify disjointness so the factors multiply independently
      const used = new Set<number>();
      for (const c of active) {
        if (used.has(c.q1) || used.has(c.q2)) {
          throw new Error('active OPPOSITE_FACES couples overlap; analytic count invalid');
        }
        used.add(c.q1);
        used.add(c.q2);
      }
      let term2 = 1n << BigInt(sizeQ - 2 * active.length);
      for (let i = 0; i < active.length; i++) term2 *= 3n;
      term = term2;
    }

    const bits = popcount(s);
    total += bits % 2 === 1 ? term : -term;
  }
  return total - 1n; // exclude the empty set
}

function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** 2^(nA*nB) as a bigint, the raw size of the contact-set space. */
export function rawSpaceSize(model: GripModel): bigint {
  return 1n << BigInt(model.nPairs);
}

/** Render a bigint in scientific notation for reporting. */
export function sci(x: bigint, digits = 3): string {
  const s = x.toString();
  if (s.length <= 15) return s;
  const mantissa = `${s[0]}.${s.slice(1, 1 + digits)}`;
  return `${mantissa}e${s.length - 1}`;
}
