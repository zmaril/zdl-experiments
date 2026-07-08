/**
 * Enumeration of grip-tangle classes at the invariant level.
 *
 * A grip class with all fingertips attached is described (to the resolution
 * of the sound invariants — see invariants.ts) by:
 *   - per attached strand: an ATOM = (attachment target, attachment side,
 *     homotopy word in the two bar meridians), taken hand-agnostically
 *     (own bar = "s", partner bar = "p");
 *   - per strand pair: the crossing-sign sum k (relative linking number).
 *
 * The crossing COST of a class is the minimum number of diagram crossings
 * needed to realize it:
 *   - each word letter is one under-crossing of a bar;
 *   - zone bookkeeping may force extra over-crossings (computed exactly by
 *     a shortest-path search over (letter position, zone) states);
 *   - each unit of |k| is one strand-strand crossing.
 *
 * Enumerated configurations:
 *   - 1 active strand (all other digits loose, hence retracted/trivial);
 *   - 2 active strands, one per hand, counted up to swapping the hands.
 *
 * FEASIBILITY (finger-length bound): a real finger is short — it can curl
 * at most about one full turn around another strand or a palm bar. Model:
 * each strand's total event count (wall crossings + strand crossings) is
 * bounded by MAX_CURL (default 3: a full wrap around a bar costs 2 wall
 * crossings, so budget 3 = "one wrap plus a little", while a double wrap
 * costs 4 and is excluded). The bound is a parameter.
 *
 * Honest limits (see NOTES.md): classes are counted at signature
 * resolution, so knotted single strands and higher-order linking patterns
 * (which need more crossings than short fingers allow anyway) are not
 * counted; slot positions along the bars are abstracted away.
 */

export const DEFAULT_MAX_CURL = 3;

export type Rel = "own" | "other";
export type SideRel = "palm" | "back";

/** Hand-agnostic word letter: s = own bar meridian, p = partner bar meridian. */
export interface RelLetter {
  bar: "s" | "p";
  sign: 1 | -1;
}

export function relWordToString(w: RelLetter[]): string {
  if (w.length === 0) return "1";
  return w.map((l) => l.bar + (l.sign > 0 ? "" : "'")).join("");
}

/** Zones relative to a strand's hand: 0 = own back, 1 = palm corridor, 2 = partner back. */
function letterTransition(l: RelLetter): { from: number; to: number } {
  if (l.bar === "s") return l.sign > 0 ? { from: 1, to: 0 } : { from: 0, to: 1 };
  return l.sign > 0 ? { from: 1, to: 2 } : { from: 2, to: 1 };
}

export function attachZoneRel(rel: Rel, side: SideRel): number {
  if (rel === "own") return side === "palm" ? 1 : 0;
  return side === "palm" ? 1 : 2;
}

/**
 * Minimum number of wall crossings realizing a given reduced word with the
 * strand ending in `endZone`. Exact shortest path over (letterIdx, zone):
 * emitting a letter costs 1 (an under-crossing); moving between adjacent
 * zones without emitting costs 1 (an over-crossing).
 */
export function minWallCost(word: RelLetter[], endZone: number): number {
  const N = word.length;
  const INF = Infinity;
  // dist[letterIdx][zone]
  const dist: number[][] = Array.from({ length: N + 1 }, () => [INF, INF, INF]);
  dist[0][1] = 0; // strands start in the palm corridor
  // simple Bellman-style relaxation (graph is tiny and acyclic in letterIdx,
  // but zone moves stay within a letterIdx layer)
  for (let li = 0; li <= N; li++) {
    // relax zone moves within the layer until stable (3 zones -> 2 passes)
    for (let pass = 0; pass < 3; pass++) {
      for (const [z1, z2] of [
        [0, 1],
        [1, 0],
        [1, 2],
        [2, 1],
      ]) {
        if (dist[li][z1] + 1 < dist[li][z2]) dist[li][z2] = dist[li][z1] + 1;
      }
    }
    if (li < N) {
      const { from, to } = letterTransition(word[li]);
      if (dist[li][from] + 1 < dist[li + 1][to]) dist[li + 1][to] = dist[li][from] + 1;
    }
  }
  return dist[N][endZone];
}

export interface Atom {
  rel: Rel;
  side: SideRel;
  word: RelLetter[];
  wordStr: string;
  cost: number; // minimum wall crossings
}

export function atomKey(a: Atom): string {
  return `${a.rel}/${a.side}:${a.wordStr}`;
}

/** All reduced words over {s, s', p, p'} of length <= maxLen. */
export function reducedWords(maxLen: number): RelLetter[][] {
  const letters: RelLetter[] = [
    { bar: "s", sign: 1 },
    { bar: "s", sign: -1 },
    { bar: "p", sign: 1 },
    { bar: "p", sign: -1 },
  ];
  const out: RelLetter[][] = [[]];
  let frontier: RelLetter[][] = [[]];
  for (let len = 1; len <= maxLen; len++) {
    const next: RelLetter[][] = [];
    for (const w of frontier) {
      for (const l of letters) {
        const top = w[w.length - 1];
        if (top && top.bar === l.bar && top.sign === -l.sign) continue; // not reduced
        next.push([...w, l]);
      }
    }
    out.push(...next);
    frontier = next;
  }
  return out;
}

/** All atoms with cost <= maxCost. */
export function atoms(maxCost: number): Atom[] {
  const out: Atom[] = [];
  for (const word of reducedWords(maxCost)) {
    for (const rel of ["own", "other"] as const) {
      for (const side of ["palm", "back"] as const) {
        const cost = minWallCost(word, attachZoneRel(rel, side));
        if (cost <= maxCost) {
          out.push({ rel, side, word, wordStr: relWordToString(word), cost });
        }
      }
    }
  }
  out.sort((x, y) => x.cost - y.cost || (atomKey(x) < atomKey(y) ? -1 : 1));
  return out;
}

export interface PairClass {
  a1: Atom;
  a2: Atom; // canonically atomKey(a1) <= atomKey(a2)
  k: number; // crossing-sign sum between the two strands
  cost: number; // a1.cost + a2.cost + |k|
}

export function pairClassKey(p: PairClass): string {
  return `${atomKey(p.a1)} & ${atomKey(p.a2)} @k=${p.k}`;
}

/**
 * All two-strand classes (one strand per hand) with total cost <= maxCost,
 * up to swapping which hand is which.
 */
export function pairClasses(maxCost: number): PairClass[] {
  const as = atoms(maxCost);
  const out: PairClass[] = [];
  const seen = new Set<string>();
  for (const a1 of as) {
    for (const a2 of as) {
      const base = a1.cost + a2.cost;
      if (base > maxCost) continue;
      const kMax = maxCost - base;
      for (let k = -kMax; k <= kMax; k++) {
        const [x, y] = atomKey(a1) <= atomKey(a2) ? [a1, a2] : [a2, a1];
        const p: PairClass = { a1: x, a2: y, k, cost: base + Math.abs(k) };
        const key = pairClassKey(p);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
    }
  }
  out.sort((x, y) => x.cost - y.cost || (pairClassKey(x) < pairClassKey(y) ? -1 : 1));
  return out;
}

export interface CountsRow {
  n: number;
  one: { all: number; feasible: number };
  two: { all: number; feasible: number };
}

export function atomFeasible(a: Atom, extraCrossings: number, maxCurl: number): boolean {
  return a.cost + extraCrossings <= maxCurl;
}

export function pairFeasible(p: PairClass, maxCurl: number): boolean {
  return (
    atomFeasible(p.a1, Math.abs(p.k), maxCurl) && atomFeasible(p.a2, Math.abs(p.k), maxCurl)
  );
}

/** Counts of classes with total crossing number <= n, for n = 0..nMax. */
export function countsTable(nMax: number, maxCurl: number = DEFAULT_MAX_CURL): CountsRow[] {
  const as = atoms(nMax);
  const ps = pairClasses(nMax);
  const rows: CountsRow[] = [];
  for (let n = 0; n <= nMax; n++) {
    rows.push({
      n,
      one: {
        all: as.filter((a) => a.cost <= n).length,
        feasible: as.filter((a) => a.cost <= n && atomFeasible(a, 0, maxCurl)).length,
      },
      two: {
        all: ps.filter((p) => p.cost <= n).length,
        feasible: ps.filter((p) => p.cost <= n && pairFeasible(p, maxCurl)).length,
      },
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Plain-language descriptions (for candidate-grip listings)
// ---------------------------------------------------------------------------

export function describeAtom(a: Atom): string {
  const steps: string[] = [];
  for (const l of a.word) {
    if (l.bar === "p" && l.sign > 0) steps.push("hooks under the partner's palm bar to the back of their hand");
    else if (l.bar === "p" && l.sign < 0) steps.push("comes back under the partner's palm bar from behind");
    else if (l.bar === "s" && l.sign > 0) steps.push("dives under its own palm bar to the back of its own hand");
    else steps.push("comes back under its own palm bar from behind");
  }
  const attach =
    a.rel === "own"
      ? a.side === "palm"
        ? "presses its tip into its own palm"
        : "presses its tip against the back of its own hand"
      : a.side === "palm"
        ? "presses its tip into the partner's palm"
        : "presses its tip against the back of the partner's hand";
  if (steps.length === 0) return `the finger reaches out and ${attach}`;
  return `the finger ${steps.join(", then ")}, and finally ${attach}` +
    (a.cost > a.word.length ? " (passing in front of a bar where needed)" : "");
}

export function describePair(p: PairClass): string {
  const parts = [
    `strand 1: ${describeAtom(p.a1)}`,
    `strand 2: ${describeAtom(p.a2)}`,
  ];
  if (p.k !== 0) {
    const times = Math.abs(p.k);
    parts.push(
      `the two fingers wrap around each other with net twist ${p.k} ` +
        `(${times} crossing${times > 1 ? "s" : ""} of the same handedness)`,
    );
  }
  return parts.join("; ");
}
