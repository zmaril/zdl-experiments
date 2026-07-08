/**
 * Planar link diagrams, in an oriented-PD-equivalent representation.
 *
 * REPRESENTATION
 * --------------
 * A diagram is a set of crossings plus a count of crossing-free unknotted
 * circles (`freeLoops`). Edges are arbitrary integer ids; an edge is the arc
 * between two consecutive crossing passages. Each crossing records which edge
 * enters/leaves on the under-strand and over-strand, plus an explicit sign:
 *
 *   sign +1  <=>  rotating the OVER direction counterclockwise by 90 degrees
 *                 gives the UNDER direction (the usual positive crossing).
 *
 * This is exactly the information in an *oriented* PD code, but stored with
 * named fields so it is hard to misuse. Converters to/from classical PD
 * tuples X(a,b,c,d) (edges counterclockwise, starting at the incoming
 * under-strand edge) are provided.
 *
 * In a valid *closed* diagram every edge id occurs exactly twice: once as an
 * incoming slot (underIn/overIn) and once as an outgoing slot
 * (underOut/overOut). Open-ended variants (tangles) add boundary endpoints;
 * see tangle.ts.
 */

export type Edge = number;

export type SlotName = 'underIn' | 'underOut' | 'overIn' | 'overOut';

export interface Crossing {
  underIn: Edge;
  underOut: Edge;
  overIn: Edge;
  overOut: Edge;
  sign: 1 | -1;
}

export interface Diagram {
  crossings: Crossing[];
  /** Number of crossing-free unknotted circles, split from the rest. */
  freeLoops: number;
}

export function crossing(sign: 1 | -1, c: Omit<Crossing, 'sign'>): Crossing {
  return { ...c, sign };
}

export function emptyDiagram(freeLoops = 0): Diagram {
  return { crossings: [], freeLoops };
}

export const UNKNOT_DIAGRAM: Diagram = { crossings: [], freeLoops: 1 };

/** All edge ids used by the crossings of a diagram. */
export function edgeSet(d: Diagram): Set<Edge> {
  const s = new Set<Edge>();
  for (const c of d.crossings) {
    s.add(c.underIn);
    s.add(c.underOut);
    s.add(c.overIn);
    s.add(c.overOut);
  }
  return s;
}

/**
 * Counterclockwise slot order around a crossing, starting at the incoming
 * under-strand edge — i.e. the PD tuple (a, b, c, d).
 *
 * Derivation (over-strand SW->NE for +, SE->NW for -):
 *   positive: a=underIn(SE), b=overOut(NE), c=underOut(NW), d=overIn(SW)
 *   negative: a=underIn(SW), b=overIn(SE),  c=underOut(NE), d=overOut(NW)
 */
export function ccwSlots(c: Crossing): [SlotName, SlotName, SlotName, SlotName] {
  return c.sign === 1
    ? ['underIn', 'overOut', 'underOut', 'overIn']
    : ['underIn', 'overIn', 'underOut', 'overOut'];
}

export function ccwEdges(c: Crossing): [Edge, Edge, Edge, Edge] {
  const [a, b, cc, dd] = ccwSlots(c);
  return [c[a], c[b], c[cc], c[dd]];
}

/** Export as classical PD tuples X(a,b,c,d), one per crossing. */
export function toPDCode(d: Diagram): Array<[number, number, number, number]> {
  return d.crossings.map((c) => ccwEdges(c));
}

/**
 * Import a classical PD code in the KnotAtlas convention: tuples
 * X(a,b,c,d) counterclockwise from the incoming under-strand edge, with edge
 * labels 1..2n numbered consecutively along the (single) component.
 *
 * LIMITATION: the over-strand orientation is inferred from label adjacency
 * (overIn is the label whose successor mod 2n is the other over label). This
 * is unambiguous for knots with >= 2 crossings; for multi-component links
 * (whose labels restart per component) it may throw — build those diagrams
 * directly, or as braid closures.
 */
export function fromPDCode(tuples: ReadonlyArray<readonly [number, number, number, number]>): Diagram {
  const n = tuples.length;
  const maxLabel = 2 * n;
  const succ = (x: number) => (x % maxLabel) + 1;
  const crossings: Crossing[] = tuples.map(([a, b, c, dd]) => {
    const dToB = succ(dd) === b;
    const bToD = succ(b) === dd;
    if (dToB && bToD) {
      throw new Error(`ambiguous over-strand orientation in PD tuple (${a},${b},${c},${dd})`);
    }
    if (dToB) {
      // over-strand d -> b: positive pattern (a,b,c,d) = (uIn, oOut, uOut, oIn)
      return { underIn: a, underOut: c, overIn: dd, overOut: b, sign: 1 };
    }
    if (bToD) {
      // over-strand b -> d: negative pattern (a,b,c,d) = (uIn, oIn, uOut, oOut)
      return { underIn: a, underOut: c, overIn: b, overOut: dd, sign: -1 };
    }
    throw new Error(
      `cannot orient over-strand of PD tuple (${a},${b},${c},${dd}); ` +
        `only single-component KnotAtlas-numbered PD codes are supported`,
    );
  });
  return { crossings, freeLoops: 0 };
}

/**
 * Check structural validity of a closed diagram: every edge occurs exactly
 * once as an incoming slot and once as an outgoing slot. Throws on failure.
 */
export function validateDiagram(d: Diagram): void {
  const ins = new Map<Edge, number>();
  const outs = new Map<Edge, number>();
  for (const c of d.crossings) {
    ins.set(c.underIn, (ins.get(c.underIn) ?? 0) + 1);
    ins.set(c.overIn, (ins.get(c.overIn) ?? 0) + 1);
    outs.set(c.underOut, (outs.get(c.underOut) ?? 0) + 1);
    outs.set(c.overOut, (outs.get(c.overOut) ?? 0) + 1);
  }
  const all = new Set([...ins.keys(), ...outs.keys()]);
  for (const e of all) {
    if ((ins.get(e) ?? 0) !== 1 || (outs.get(e) ?? 0) !== 1) {
      throw new Error(
        `edge ${e} occurs ${ins.get(e) ?? 0} time(s) as incoming and ` +
          `${outs.get(e) ?? 0} time(s) as outgoing (each must be exactly 1)`,
      );
    }
  }
  if (d.freeLoops < 0 || !Number.isInteger(d.freeLoops)) {
    throw new Error(`freeLoops must be a nonnegative integer, got ${d.freeLoops}`);
  }
}

/** Writhe: sum of crossing signs. */
export function writhe(d: Diagram): number {
  return d.crossings.reduce((w, c) => w + c.sign, 0);
}

// ---------------------------------------------------------------------------
// Union-find (shared by components, bracket state loops, splicing)
// ---------------------------------------------------------------------------

export class UnionFind<T> {
  private parent = new Map<T, T>();

  find(x: T): T {
    let p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }

  union(a: T, b: T): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  /** All elements ever touched, grouped by class representative. */
  classes(): Map<T, T[]> {
    const out = new Map<T, T[]>();
    for (const x of this.parent.keys()) {
      const r = this.find(x);
      const arr = out.get(r);
      if (arr) arr.push(x);
      else out.set(r, [x]);
    }
    return out;
  }
}

/**
 * Assign each edge to a link component (0-based index). Edges connected
 * through a crossing along the same strand (underIn~underOut, overIn~overOut)
 * are in the same component. `freeLoops` are extra components not represented
 * here (they have no edges).
 */
export function edgeComponents(d: Diagram): { component: Map<Edge, number>; count: number } {
  const uf = new UnionFind<Edge>();
  for (const e of edgeSet(d)) uf.find(e);
  for (const c of d.crossings) {
    uf.union(c.underIn, c.underOut);
    uf.union(c.overIn, c.overOut);
  }
  const component = new Map<Edge, number>();
  let count = 0;
  const repIndex = new Map<Edge, number>();
  for (const e of [...edgeSet(d)].sort((a, b) => a - b)) {
    const r = uf.find(e);
    let idx = repIndex.get(r);
    if (idx === undefined) {
      idx = count++;
      repIndex.set(r, idx);
    }
    component.set(e, idx);
  }
  return { component, count };
}

/** Total number of link components, including free loops. */
export function componentCount(d: Diagram): number {
  return edgeComponents(d).count + d.freeLoops;
}

/**
 * Linking number of a 2-component link diagram: half the sum of the signs of
 * crossings between the two components. Throws unless the diagram has exactly
 * two components.
 */
export function linkingNumber(d: Diagram): number {
  const { component, count } = edgeComponents(d);
  if (count + d.freeLoops !== 2) {
    throw new Error(`linking number needs exactly 2 components, got ${count + d.freeLoops}`);
  }
  let s = 0;
  for (const c of d.crossings) {
    const cu = component.get(c.underIn)!;
    const co = component.get(c.overIn)!;
    if (cu !== co) s += c.sign;
  }
  if (s % 2 !== 0) throw new Error(`inter-component sign sum ${s} is odd; invalid diagram`);
  return s / 2;
}

// ---------------------------------------------------------------------------
// Darts and faces (the planar rotation system implied by the PD structure)
// ---------------------------------------------------------------------------

/** A dart is one end of an edge: (crossing index, CCW slot position 0..3). */
export interface Dart {
  crossing: number;
  slot: number; // index into ccwSlots
}

const dartKey = (d: Dart) => d.crossing * 4 + d.slot;

/**
 * Faces of the diagram, as dart cycles. Each edge has exactly two darts; a
 * face is an orbit of "jump to the edge's other dart, then rotate one slot
 * counterclockwise". For a planar diagram, V - E + F = 1 + (number of
 * connected components of the underlying 4-valent graph).
 *
 * `freeLoops` are ignored (each would contribute its own two faces).
 */
export function faces(d: Diagram): Dart[][] {
  // Map each edge to its darts.
  const dartsOfEdge = new Map<Edge, Dart[]>();
  d.crossings.forEach((c, ci) => {
    ccwEdges(c).forEach((e, slot) => {
      const arr = dartsOfEdge.get(e);
      const dart = { crossing: ci, slot };
      if (arr) arr.push(dart);
      else dartsOfEdge.set(e, [dart]);
    });
  });
  for (const [e, darts] of dartsOfEdge) {
    if (darts.length !== 2) throw new Error(`edge ${e} has ${darts.length} ends; diagram is not closed`);
  }
  const other = (dart: Dart): Dart => {
    const c = d.crossings[dart.crossing]!;
    const e = ccwEdges(c)[dart.slot]!;
    const [d1, d2] = dartsOfEdge.get(e)! as [Dart, Dart];
    return dartKey(d1) === dartKey(dart) ? d2 : d1;
  };
  const next = (dart: Dart): Dart => {
    const o = other(dart);
    return { crossing: o.crossing, slot: (o.slot + 1) % 4 };
  };
  const seen = new Set<number>();
  const result: Dart[][] = [];
  for (let ci = 0; ci < d.crossings.length; ci++) {
    for (let slot = 0; slot < 4; slot++) {
      const start = { crossing: ci, slot };
      if (seen.has(dartKey(start))) continue;
      const face: Dart[] = [];
      let cur = start;
      do {
        face.push(cur);
        seen.add(dartKey(cur));
        cur = next(cur);
      } while (dartKey(cur) !== dartKey(start));
      result.push(face);
    }
  }
  return result;
}

/** Edge ids along a face (may repeat for monogons etc.). */
export function faceEdges(d: Diagram, face: Dart[]): Edge[] {
  return face.map((dart) => ccwEdges(d.crossings[dart.crossing]!)[dart.slot]!);
}

// ---------------------------------------------------------------------------
// Splicing (shared by Reidemeister moves and tangle gluing)
// ---------------------------------------------------------------------------

/**
 * Merge edges pairwise (each pair becomes a single edge) and rewrite the
 * surviving crossings accordingly. Merge classes whose edges no longer occur
 * anywhere become closed crossing-free loops.
 *
 * `occurrences(edge)` must count how many slot/boundary references the edge
 * has in the surviving structure OUTSIDE of `crossings` (e.g. tangle boundary
 * points); pass undefined for plain closed diagrams.
 *
 * Returns the rewritten crossings, an edge-renaming map (old -> new
 * representative), and the number of new free loops.
 */
export function spliceEdges(
  crossings: Crossing[],
  unions: ReadonlyArray<readonly [Edge, Edge]>,
  extraOccurrences?: (e: Edge) => number,
): { crossings: Crossing[]; rename: Map<Edge, Edge>; newFreeLoops: number } {
  const uf = new UnionFind<Edge>();
  for (const [a, b] of unions) uf.union(a, b);
  // Only edges that appear in `unions` form merge classes; leave others alone.
  const classes = uf.classes();

  // Occurrence count of each edge in the surviving crossings.
  const occByEdge = new Map<Edge, number>();
  for (const c of crossings) {
    for (const e of [c.underIn, c.underOut, c.overIn, c.overOut]) {
      occByEdge.set(e, (occByEdge.get(e) ?? 0) + 1);
    }
  }

  const rename = new Map<Edge, Edge>();
  let newFreeLoops = 0;
  for (const cls of classes.values()) {
    // Use the smallest id in the class as the surviving name.
    const name = Math.min(...cls);
    let occ = 0;
    for (const e of cls) {
      rename.set(e, name);
      occ += occByEdge.get(e) ?? 0;
      if (extraOccurrences) occ += extraOccurrences(e);
    }
    if (occ === 0) newFreeLoops += 1;
    else if (occ !== 2) {
      throw new Error(`splice produced edge class {${cls.join(',')}} with ${occ} occurrences (expected 0 or 2)`);
    }
  }

  const renamed = (e: Edge) => rename.get(e) ?? e;
  const newCrossings = crossings.map((c) => ({
    underIn: renamed(c.underIn),
    underOut: renamed(c.underOut),
    overIn: renamed(c.overIn),
    overOut: renamed(c.overOut),
    sign: c.sign,
  }));

  return { crossings: newCrossings, rename, newFreeLoops };
}
