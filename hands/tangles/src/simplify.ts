/**
 * Bounded brute-force search over moves: canonicalization and equivalence.
 *
 * Strategy:
 *   - normalize(): retract free strands (always valid), canonical serialize.
 *   - canonicalize(): BFS over the move graph, allowing the crossing number
 *     to rise a bounded amount above the best seen (slack), up to a node
 *     budget; return the lexicographically least serialization among
 *     minimal-crossing diagrams reached.
 *   - equivalent(): sound "distinct" via invariant signatures; "equal" via
 *     meeting of the two BFS clouds; otherwise "unknown".
 *
 * Completeness caveat: a bounded search that fails to connect two diagrams
 * proves nothing; only the signature gives sound negative answers, and the
 * move set itself is liberal about planarity (see moves.ts header).
 */

import { type Grip, cloneGrip, serialize, totalCrossings } from "./model.ts";
import { retractFreeStrands, gripSignatureString } from "./invariants.ts";
import { neighbors } from "./moves.ts";

export function normalize(g: Grip): Grip {
  return retractFreeStrands(cloneGrip(g));
}

export interface SearchResult {
  canonical: string; // least serialization among minimal-crossing states
  minCrossings: number;
  visited: Set<string>;
  exhausted: boolean; // true if the whole bounded graph was explored
}

export function searchMoves(
  g0: Grip,
  opts: { slack?: number; maxNodes?: number } = {},
): SearchResult {
  const slack = opts.slack ?? 2;
  const maxNodes = opts.maxNodes ?? 4000;
  const g = normalize(g0);
  const startSer = serialize(g);
  let best = { ser: startSer, cross: totalCrossings(g) };
  const cap = totalCrossings(g) + slack;
  const visited = new Set<string>([startSer]);
  const queue: Grip[] = [g];
  let exhausted = true;
  while (queue.length > 0) {
    if (visited.size > maxNodes) {
      exhausted = false;
      break;
    }
    const cur = queue.shift()!;
    for (const { grip: nb } of neighbors(cur, { maxCrossings: cap })) {
      const ser = serialize(nb);
      if (visited.has(ser)) continue;
      visited.add(ser);
      const c = totalCrossings(nb);
      if (c < best.cross || (c === best.cross && ser < best.ser)) best = { ser, cross: c };
      queue.push(nb);
    }
  }
  return { canonical: best.ser, minCrossings: best.cross, visited, exhausted };
}

export type Verdict = "equal" | "distinct" | "unknown";

export function equivalent(
  a: Grip,
  b: Grip,
  opts: { slack?: number; maxNodes?: number } = {},
): Verdict {
  if (gripSignatureString(a) !== gripSignatureString(b)) return "distinct";
  const na = serialize(normalize(a));
  const nb = serialize(normalize(b));
  if (na === nb) return "equal";
  const ra = searchMoves(a, opts);
  if (ra.visited.has(nb)) return "equal";
  const rb = searchMoves(b, opts);
  if (rb.visited.has(na)) return "equal";
  for (const s of rb.visited) if (ra.visited.has(s)) return "equal";
  return "unknown";
}
