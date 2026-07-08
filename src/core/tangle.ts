/**
 * Tangles: diagrams with open strand ends on a labeled boundary.
 *
 * A tangle is a set of crossings plus free loops (as in Diagram) plus a set
 * of labeled boundary points where strands end. This is the datatype for the
 * dance model: each arm is a strand with two boundary points (shoulder,
 * hand) — four strands / eight boundary points for two dancers — and grips
 * are gluings of hand-endpoints. Torso obstacles can be added as extra
 * strands or closed components.
 *
 * ORIENTATION: strands are oriented. A boundary point with dir 'in' is where
 * a strand enters the tangle (the edge's tail); dir 'out' is where a strand
 * leaves (the edge's head). Gluing must match an 'out' to an 'in'; to glue
 * two 'out' ends (e.g. two hands, with arms oriented shoulder-to-hand), first
 * reverse one strand with `reverseStrand`, which also fixes crossing signs.
 *
 * PLANARITY: like Diagram, a Tangle stores combinatorial data only; it does
 * not record a cyclic order of boundary points, so it cannot itself check
 * that a gluing is planar. Callers (phase 2) are responsible for gluing
 * patterns that are realizable in the plane/disk; invariants computed from
 * closures of non-planar gluings describe virtual diagrams, not links.
 */

import {
  type Crossing,
  type Diagram,
  type Edge,
  spliceEdges,
} from './diagram.js';
import { type Braid } from './braid.js';

export type BoundaryDir = 'in' | 'out';

export interface BoundaryPoint {
  label: string;
  edge: Edge;
  dir: BoundaryDir;
}

export interface Tangle {
  crossings: Crossing[];
  freeLoops: number;
  boundary: BoundaryPoint[];
}

/**
 * Structural validity: every edge occurs exactly once as a head (crossing
 * in-slot or boundary 'out') and once as a tail (crossing out-slot or
 * boundary 'in'); boundary labels are unique.
 */
export function validateTangle(t: Tangle): void {
  const heads = new Map<Edge, number>();
  const tails = new Map<Edge, number>();
  const bump = (m: Map<Edge, number>, e: Edge) => m.set(e, (m.get(e) ?? 0) + 1);
  for (const c of t.crossings) {
    bump(heads, c.underIn);
    bump(heads, c.overIn);
    bump(tails, c.underOut);
    bump(tails, c.overOut);
  }
  const labels = new Set<string>();
  for (const b of t.boundary) {
    if (labels.has(b.label)) throw new Error(`duplicate boundary label "${b.label}"`);
    labels.add(b.label);
    bump(b.dir === 'out' ? heads : tails, b.edge);
  }
  const all = new Set([...heads.keys(), ...tails.keys()]);
  for (const e of all) {
    if ((heads.get(e) ?? 0) !== 1 || (tails.get(e) ?? 0) !== 1) {
      throw new Error(
        `edge ${e} has ${heads.get(e) ?? 0} head(s) and ${tails.get(e) ?? 0} tail(s) (each must be exactly 1)`,
      );
    }
  }
}

function edgeIds(t: Tangle): Set<Edge> {
  const s = new Set<Edge>();
  for (const c of t.crossings) {
    s.add(c.underIn);
    s.add(c.underOut);
    s.add(c.overIn);
    s.add(c.overOut);
  }
  for (const b of t.boundary) s.add(b.edge);
  return s;
}

function boundaryPoint(t: Tangle, label: string): BoundaryPoint {
  const b = t.boundary.find((x) => x.label === label);
  if (!b) throw new Error(`no boundary point labeled "${label}"`);
  return b;
}

/** Crossing-free tangle: one strand per [from, to] label pair. */
export function trivialTangle(strands: ReadonlyArray<readonly [string, string]>): Tangle {
  const boundary: BoundaryPoint[] = [];
  strands.forEach(([from, to], i) => {
    boundary.push({ label: from, edge: i, dir: 'in' });
    boundary.push({ label: to, edge: i, dir: 'out' });
  });
  const t = { crossings: [], freeLoops: 0, boundary };
  validateTangle(t);
  return t;
}

/**
 * The tangle of a braid word (strands oriented bottom to top). Boundary
 * labels: `bottomPrefix + position` (dir 'in') and `topPrefix + position`
 * (dir 'out'), positions 0-based.
 */
export function tangleFromBraid(b: Braid, bottomPrefix = 'b', topPrefix = 't'): Tangle {
  let nextEdge = b.strands;
  const cur = Array.from({ length: b.strands }, (_, i) => i);
  const crossings: Crossing[] = [];
  for (const x of b.word) {
    const p = Math.abs(x) - 1;
    const q = p + 1;
    const eLeftOut = nextEdge++;
    const eRightOut = nextEdge++;
    if (x > 0) {
      crossings.push({ overIn: cur[p]!, overOut: eLeftOut, underIn: cur[q]!, underOut: eRightOut, sign: 1 });
      cur[q] = eLeftOut;
      cur[p] = eRightOut;
    } else {
      crossings.push({ underIn: cur[p]!, underOut: eRightOut, overIn: cur[q]!, overOut: eLeftOut, sign: -1 });
      cur[q] = eRightOut;
      cur[p] = eLeftOut;
    }
  }
  const boundary: BoundaryPoint[] = [];
  for (let i = 0; i < b.strands; i++) {
    boundary.push({ label: `${bottomPrefix}${i}`, edge: i, dir: 'in' });
    boundary.push({ label: `${topPrefix}${i}`, edge: cur[i]!, dir: 'out' });
  }
  const t = { crossings, freeLoops: 0, boundary };
  validateTangle(t);
  return t;
}

/** Rename boundary labels (must stay unique). */
export function mapLabels(t: Tangle, fn: (label: string) => string): Tangle {
  const out: Tangle = {
    crossings: t.crossings.map((c) => ({ ...c })),
    freeLoops: t.freeLoops,
    boundary: t.boundary.map((b) => ({ ...b, label: fn(b.label) })),
  };
  validateTangle(out);
  return out;
}

/**
 * Reverse the orientation of the open strand that starts or ends at the
 * given boundary label. Swaps in/out roles along the strand, flips the two
 * endpoint dirs, and flips the sign of every crossing the strand passes
 * exactly once (self-crossings of the strand keep their sign) — the standard
 * effect of reversing one component's orientation.
 */
export function reverseStrand(t: Tangle, label: string): Tangle {
  const start = boundaryPoint(t, label);

  // Passages: (crossing index, level) in walk order.
  const passages: Array<[number, 'over' | 'under']> = [];
  const strandEdges = new Set<Edge>();
  let endLabel: string;

  if (start.dir === 'in') {
    let e = start.edge;
    strandEdges.add(e);
    for (;;) {
      const bp = t.boundary.find((x) => x.edge === e && x.dir === 'out');
      if (bp) {
        endLabel = bp.label;
        break;
      }
      const ci = t.crossings.findIndex((c) => c.underIn === e || c.overIn === e);
      if (ci === -1) throw new Error(`strand walk broke at edge ${e}`);
      const c = t.crossings[ci]!;
      const level: 'over' | 'under' = c.overIn === e ? 'over' : 'under';
      passages.push([ci, level]);
      e = level === 'over' ? c.overOut : c.underOut;
      strandEdges.add(e);
    }
  } else {
    // Walk backwards from the head end.
    let e = start.edge;
    strandEdges.add(e);
    for (;;) {
      const bp = t.boundary.find((x) => x.edge === e && x.dir === 'in');
      if (bp) {
        endLabel = bp.label;
        break;
      }
      const ci = t.crossings.findIndex((c) => c.underOut === e || c.overOut === e);
      if (ci === -1) throw new Error(`strand walk broke at edge ${e}`);
      const c = t.crossings[ci]!;
      const level: 'over' | 'under' = c.overOut === e ? 'over' : 'under';
      passages.push([ci, level]);
      e = level === 'over' ? c.overIn : c.underIn;
      strandEdges.add(e);
    }
  }

  // Count passages per crossing to decide sign flips.
  const passCount = new Map<number, number>();
  for (const [ci] of passages) passCount.set(ci, (passCount.get(ci) ?? 0) + 1);

  const crossings = t.crossings.map((c, ci) => {
    const n = passCount.get(ci) ?? 0;
    if (n === 0) return { ...c };
    const copy = { ...c };
    for (const [pci, level] of passages) {
      if (pci !== ci) continue;
      if (level === 'over') {
        const tmp = copy.overIn;
        copy.overIn = copy.overOut;
        copy.overOut = tmp;
      } else {
        const tmp = copy.underIn;
        copy.underIn = copy.underOut;
        copy.underOut = tmp;
      }
    }
    if (n === 1) copy.sign = copy.sign === 1 ? -1 : 1;
    return copy;
  });

  const flip = (l: string) => l === label || l === endLabel;
  const boundary = t.boundary.map((b) =>
    flip(b.label) && strandEdges.has(b.edge) ? { ...b, dir: (b.dir === 'in' ? 'out' : 'in') as BoundaryDir } : { ...b },
  );
  const out = { crossings, freeLoops: t.freeLoops, boundary };
  validateTangle(out);
  return out;
}

/**
 * Glue two tangles along pairs of boundary labels [labelInT1, labelInT2].
 * Each pair must join an 'out' end to an 'in' end. Edge ids of t2 are
 * shifted to avoid collision; remaining boundary labels of the two tangles
 * must not clash (use `mapLabels`).
 */
export function composeTangles(
  t1: Tangle,
  t2: Tangle,
  gluing: ReadonlyArray<readonly [string, string]>,
): Tangle {
  const offset = Math.max(0, ...edgeIds(t1)) + 1;
  const shift = (e: Edge) => e + offset;
  const t2s: Tangle = {
    crossings: t2.crossings.map((c) => ({
      underIn: shift(c.underIn),
      underOut: shift(c.underOut),
      overIn: shift(c.overIn),
      overOut: shift(c.overOut),
      sign: c.sign,
    })),
    freeLoops: t2.freeLoops,
    boundary: t2.boundary.map((b) => ({ ...b, edge: shift(b.edge) })),
  };

  const used1 = new Set<string>();
  const used2 = new Set<string>();
  const unions: Array<[Edge, Edge]> = [];
  for (const [l1, l2] of gluing) {
    if (used1.has(l1) || used2.has(l2)) throw new Error(`label glued twice: "${l1}" / "${l2}"`);
    used1.add(l1);
    used2.add(l2);
    const p1 = boundaryPoint(t1, l1);
    const p2 = boundaryPoint(t2s, l2);
    if (p1.dir === p2.dir) {
      throw new Error(
        `cannot glue "${l1}" (${p1.dir}) to "${l2}" (${p2.dir}): orientations clash; use reverseStrand first`,
      );
    }
    unions.push([p1.edge, p2.edge]);
  }

  const restBoundary = [
    ...t1.boundary.filter((b) => !used1.has(b.label)),
    ...t2s.boundary.filter((b) => !used2.has(b.label)),
  ];
  const labelSet = new Set<string>();
  for (const b of restBoundary) {
    if (labelSet.has(b.label)) throw new Error(`boundary label clash after gluing: "${b.label}" (use mapLabels)`);
    labelSet.add(b.label);
  }

  const boundaryOcc = new Map<Edge, number>();
  for (const b of restBoundary) boundaryOcc.set(b.edge, (boundaryOcc.get(b.edge) ?? 0) + 1);
  const allCrossings = [...t1.crossings.map((c) => ({ ...c })), ...t2s.crossings];
  const { crossings, rename, newFreeLoops } = spliceEdges(allCrossings, unions, (e) => boundaryOcc.get(e) ?? 0);
  const boundary = restBoundary.map((b) => ({ ...b, edge: rename.get(b.edge) ?? b.edge }));
  const out = {
    crossings,
    freeLoops: t1.freeLoops + t2.freeLoops + newFreeLoops,
    boundary,
  };
  validateTangle(out);
  return out;
}

/**
 * Close a tangle into a link diagram by gluing its own boundary points in
 * pairs [outLabel, inLabel] (every boundary point must appear in exactly one
 * pair, and each pair must join an 'out' to an 'in').
 */
export function closeTangle(t: Tangle, pairs: ReadonlyArray<readonly [string, string]>): Diagram {
  const used = new Set<string>();
  const unions: Array<[Edge, Edge]> = [];
  for (const [la, lb] of pairs) {
    for (const l of [la, lb]) {
      if (used.has(l)) throw new Error(`label "${l}" used twice in closure`);
      used.add(l);
    }
    const pa = boundaryPoint(t, la);
    const pb = boundaryPoint(t, lb);
    if (pa.dir === pb.dir) {
      throw new Error(`cannot close "${la}" (${pa.dir}) with "${lb}" (${pb.dir}); use reverseStrand first`);
    }
    unions.push([pa.edge, pb.edge]);
  }
  for (const b of t.boundary) {
    if (!used.has(b.label)) throw new Error(`boundary point "${b.label}" left open by closure`);
  }
  const { crossings, newFreeLoops } = spliceEdges(
    t.crossings.map((c) => ({ ...c })),
    unions,
  );
  return { crossings, freeLoops: t.freeLoops + newFreeLoops };
}
