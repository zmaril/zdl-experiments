/**
 * Reidemeister moves R1, R2, R3 on closed diagrams.
 *
 * R1/R2 are implemented as *reducing* moves (remove a kink / remove a poke)
 * plus `addKink` for the inverse R1 direction. R3 is implemented as the
 * triangle slide. `simplify` greedily applies reducing R1/R2 moves and
 * explores R3 slides up to a bounded depth to unlock further reductions.
 *
 * HONESTY NOTES
 * -------------
 * - `simplify` is NOT a decision procedure for knot/link equivalence: it
 *   never applies crossing-increasing moves, and some unknot diagrams
 *   require them (Goeritz-style hard unknots). It canonicalizes the small
 *   diagrams this project produces; certify inequivalence with invariants
 *   (Jones, linking number), not with failure to simplify.
 * - Bigon/triangle detection uses faces of the combinatorial rotation
 *   system implied by the PD structure; for genuinely planar diagrams this
 *   is exactly the set of diagram faces.
 * - The R3 search deduplicates diagrams syntactically (sorted crossing
 *   tuples), not up to isomorphism, so the depth bound is what actually
 *   limits the search.
 */

import {
  type Crossing,
  type Diagram,
  type Edge,
  ccwEdges,
  edgeSet,
  faces,
  spliceEdges,
} from './diagram.js';

type Level = 'over' | 'under';

function levelOf(c: Crossing, e: Edge): Level {
  if (c.overIn === e || c.overOut === e) return 'over';
  if (c.underIn === e || c.underOut === e) return 'under';
  throw new Error(`edge ${e} is not incident to the crossing`);
}

function slotValue(c: Crossing, level: Level, dir: 'in' | 'out'): Edge {
  return level === 'over' ? (dir === 'in' ? c.overIn : c.overOut) : dir === 'in' ? c.underIn : c.underOut;
}

function withSlot(c: Crossing, level: Level, dir: 'in' | 'out', e: Edge): Crossing {
  const copy = { ...c };
  if (level === 'over') {
    if (dir === 'in') copy.overIn = e;
    else copy.overOut = e;
  } else {
    if (dir === 'in') copy.underIn = e;
    else copy.underOut = e;
  }
  return copy;
}

// ---------------------------------------------------------------------------
// R1
// ---------------------------------------------------------------------------

/** Crossing indices carrying a removable kink (a loop edge). */
export function detectR1(d: Diagram): number[] {
  const out: number[] = [];
  d.crossings.forEach((c, i) => {
    if (c.overOut === c.underIn || c.underOut === c.overIn) out.push(i);
  });
  return out;
}

/** Remove the kink at crossing `ci` (must be a detectR1 site). */
export function applyR1(d: Diagram, ci: number): Diagram {
  const c = d.crossings[ci];
  if (c === undefined) throw new Error(`no crossing ${ci}`);
  const rest = d.crossings.filter((_, i) => i !== ci);
  const loopA = c.overOut === c.underIn;
  const loopB = c.underOut === c.overIn;
  if (!loopA && !loopB) throw new Error(`crossing ${ci} is not an R1 kink`);
  if (loopA && loopB) {
    // One-crossing unknot component: both edges vanish into a single circle.
    return { crossings: rest, freeLoops: d.freeLoops + 1 };
  }
  // Loop edge aside, the strand enters via p and leaves via q; fuse them.
  const p = loopA ? c.overIn : c.underIn;
  const q = loopA ? c.underOut : c.overOut;
  const { crossings, newFreeLoops } = spliceEdges(rest, [[p, q]]);
  return { crossings, freeLoops: d.freeLoops + newFreeLoops };
}

/**
 * Inverse R1: insert a kink on edge `e` with the given crossing sign
 * (writhe changes by `sign`). The new crossing is laid out so the strand
 * passes over first ("loop edge" = overOut -> underIn), which is realizable
 * for either sign.
 */
export function addKink(d: Diagram, e: Edge, sign: 1 | -1): Diagram {
  let next = Math.max(0, ...edgeSet(d)) + 1;
  const loop = next++;
  const tail = next++;
  // Find the crossing where e is an incoming edge and reroute it to `tail`.
  const idx = d.crossings.findIndex((c) => c.underIn === e || c.overIn === e);
  if (idx === -1) throw new Error(`edge ${e} has no incoming occurrence (is the diagram closed?)`);
  const target = d.crossings[idx]!;
  const fixed = target.overIn === e ? withSlot(target, 'over', 'in', tail) : withSlot(target, 'under', 'in', tail);
  const kink: Crossing = { overIn: e, overOut: loop, underIn: loop, underOut: tail, sign };
  const crossings = d.crossings.map((c, i) => (i === idx ? fixed : c));
  return { crossings: [...crossings, kink], freeLoops: d.freeLoops };
}

// ---------------------------------------------------------------------------
// R2
// ---------------------------------------------------------------------------

export interface R2Site {
  c1: number;
  c2: number;
  /** Bigon edge that passes over at both crossings. */
  overEdge: Edge;
  /** Bigon edge that passes under at both crossings. */
  underEdge: Edge;
}

/**
 * Removable R2 bigons: faces with exactly two (distinct) edges between two
 * distinct crossings, where one edge is on the over-strand at both ends and
 * the other on the under-strand at both ends. (A bigon where each strand is
 * over once is a clasp — not removable — and is correctly rejected.)
 */
export function detectR2(d: Diagram): R2Site[] {
  const out: R2Site[] = [];
  for (const face of faces(d)) {
    if (face.length !== 2) continue;
    const [d1, d2] = face as [{ crossing: number; slot: number }, { crossing: number; slot: number }];
    const ci1 = d1.crossing;
    const ci2 = d2.crossing;
    if (ci1 === ci2) continue;
    const e1 = ccwEdges(d.crossings[ci1]!)[d1.slot]!;
    const e2 = ccwEdges(d.crossings[ci2]!)[d2.slot]!;
    if (e1 === e2) continue;
    const c1 = d.crossings[ci1]!;
    const c2 = d.crossings[ci2]!;
    const l11 = levelOf(c1, e1);
    const l12 = levelOf(c2, e1);
    const l21 = levelOf(c1, e2);
    const l22 = levelOf(c2, e2);
    if (l11 === 'over' && l12 === 'over' && l21 === 'under' && l22 === 'under') {
      out.push({ c1: ci1, c2: ci2, overEdge: e1, underEdge: e2 });
    } else if (l11 === 'under' && l12 === 'under' && l21 === 'over' && l22 === 'over') {
      out.push({ c1: ci1, c2: ci2, overEdge: e2, underEdge: e1 });
    }
  }
  return out;
}

/** Remove the poke at an R2 site. */
export function applyR2(d: Diagram, site: R2Site): Diagram {
  const cA = d.crossings[site.c1];
  const cB = d.crossings[site.c2];
  if (!cA || !cB) throw new Error('bad R2 site');
  const e = site.overEdge;
  const f = site.underEdge;
  // Over strand: enters the bigon at the crossing where e leaves (overOut=e),
  // exits at the crossing where e arrives (overIn=e).
  const cOutE = cA.overOut === e ? cA : cB;
  const cInE = cA.overIn === e ? cA : cB;
  if (cOutE.overOut !== e || cInE.overIn !== e) throw new Error('bad R2 site: over edge mismatch');
  const overUnion: [Edge, Edge] = [cOutE.overIn, cInE.overOut];
  const cOutF = cA.underOut === f ? cA : cB;
  const cInF = cA.underIn === f ? cA : cB;
  if (cOutF.underOut !== f || cInF.underIn !== f) throw new Error('bad R2 site: under edge mismatch');
  const underUnion: [Edge, Edge] = [cOutF.underIn, cInF.underOut];
  const rest = d.crossings.filter((_, i) => i !== site.c1 && i !== site.c2);
  const { crossings, newFreeLoops } = spliceEdges(rest, [overUnion, underUnion]);
  return { crossings, freeLoops: d.freeLoops + newFreeLoops };
}

// ---------------------------------------------------------------------------
// R3
// ---------------------------------------------------------------------------

export interface R3Site {
  /** The three crossings of the triangle. */
  crossings: [number, number, number];
  /** The three triangle edges. */
  edges: [Edge, Edge, Edge];
  /** The edge of the strand being slid (over at both ends or under at both ends). */
  slideEdge: Edge;
}

/** Triangle faces admitting a Reidemeister-3 slide. */
export function detectR3(d: Diagram): R3Site[] {
  const out: R3Site[] = [];
  for (const face of faces(d)) {
    if (face.length !== 3) continue;
    const cis = face.map((dart) => dart.crossing);
    const es = face.map((dart) => ccwEdges(d.crossings[dart.crossing]!)[dart.slot]!);
    if (new Set(cis).size !== 3 || new Set(es).size !== 3) continue;
    for (const e of es) {
      // The two crossings incident to e:
      const at = cis.filter((ci) => {
        const c = d.crossings[ci]!;
        return [c.overIn, c.overOut, c.underIn, c.underOut].includes(e);
      });
      if (at.length !== 2) continue;
      const [p, q] = at as [number, number];
      if (levelOf(d.crossings[p]!, e) === levelOf(d.crossings[q]!, e)) {
        out.push({
          crossings: cis as [number, number, number],
          edges: es as [Edge, Edge, Edge],
          slideEdge: e,
        });
      }
    }
  }
  return out;
}

/**
 * Perform the R3 slide at a detected site. Along each of the three strands
 * of the triangle, the order of its two crossings swaps; combinatorially,
 * for each triangle edge m running from crossing cOut to crossing cIn on a
 * strand (g -> cOut -m-> cIn -> h), the strand becomes g -> cIn -m-> cOut
 * -> h. All updates are computed from a snapshot and applied at once. Signs
 * and over/under relations of all crossings are preserved (that is R3).
 */
export function applyR3(d: Diagram, site: R3Site): Diagram {
  const snapshot = d.crossings;
  const updated: Crossing[] = snapshot.map((c) => ({ ...c }));
  for (const m of site.edges) {
    const incident = site.crossings.filter((ci) => {
      const c = snapshot[ci]!;
      return c.overIn === m || c.overOut === m || c.underIn === m || c.underOut === m;
    });
    if (incident.length !== 2) throw new Error('bad R3 site: edge not between two triangle crossings');
    let cOutIdx = -1;
    let cInIdx = -1;
    for (const ci of incident) {
      const c = snapshot[ci]!;
      if (c.overOut === m || c.underOut === m) cOutIdx = ci;
      if (c.overIn === m || c.underIn === m) cInIdx = ci;
    }
    if (cOutIdx === -1 || cInIdx === -1 || cOutIdx === cInIdx) {
      throw new Error('bad R3 site: edge orientation inconsistent');
    }
    const cOut = snapshot[cOutIdx]!;
    const cIn = snapshot[cInIdx]!;
    const lOut = levelOf(cOut, m);
    const lIn = levelOf(cIn, m);
    const g = slotValue(cOut, lOut, 'in');
    const h = slotValue(cIn, lIn, 'out');
    // g -> cIn -m-> cOut -> h
    updated[cInIdx] = withSlot(withSlot(updated[cInIdx]!, lIn, 'in', g), lIn, 'out', m);
    updated[cOutIdx] = withSlot(withSlot(updated[cOutIdx]!, lOut, 'in', m), lOut, 'out', h);
  }
  return { crossings: updated, freeLoops: d.freeLoops };
}

// ---------------------------------------------------------------------------
// Simplification
// ---------------------------------------------------------------------------

/** Apply reducing R1/R2 moves until none remain. */
export function reduceR1R2(d: Diagram): Diagram {
  let cur = d;
  for (;;) {
    const r1 = detectR1(cur);
    if (r1.length > 0) {
      cur = applyR1(cur, r1[0]!);
      continue;
    }
    const r2 = detectR2(cur);
    if (r2.length > 0) {
      cur = applyR2(cur, r2[0]!);
      continue;
    }
    return cur;
  }
}

function diagramKey(d: Diagram): string {
  const tuples = d.crossings
    .map((c) => `${ccwEdges(c).join(',')};${c.sign}`)
    .sort()
    .join('|');
  return `${tuples}#${d.freeLoops}`;
}

export interface SimplifyOptions {
  /**
   * Number of R3 slides the search may chain between R1/R2 reductions.
   * 0 disables R3 exploration. The search is bounded and heuristic; see
   * module header.
   */
  r3Depth?: number;
}

/**
 * Greedy R1/R2 reduction with bounded R3 exploration. Returns the diagram
 * with the fewest crossings found (ties: first found).
 */
export function simplify(d: Diagram, opts: SimplifyOptions = {}): Diagram {
  const r3Depth = opts.r3Depth ?? 3;
  let best = reduceR1R2(d);
  if (r3Depth === 0) return best;
  const seen = new Set<string>([diagramKey(best)]);
  const stack: Array<[Diagram, number]> = [[best, r3Depth]];
  while (stack.length > 0) {
    const [cur, depth] = stack.pop()!;
    if (cur.crossings.length < best.crossings.length) best = cur;
    if (depth === 0 || cur.crossings.length === 0) continue;
    for (const site of detectR3(cur)) {
      const next = reduceR1R2(applyR3(cur, site));
      const key = diagramKey(next);
      if (!seen.has(key)) {
        seen.add(key);
        stack.push([next, depth - 1]);
      }
    }
  }
  return best;
}
