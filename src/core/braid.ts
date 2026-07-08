/**
 * Braid words: Artin generators, free reduction, braid relations, a bounded
 * word-problem solver, and braid closure to a link diagram.
 *
 * CONVENTIONS
 * -----------
 * A braid on n strands is a word in the letters +i / -i (1 <= i <= n-1),
 * read left to right = bottom to top. The letter +i is the Artin generator
 * sigma_i: the strand in position i passes OVER the strand in position i+1
 * (positions are 1-based) and they swap; -i is its inverse (passes under).
 * With all strands oriented upward, sigma_i produces a crossing of sign +1,
 * so the closure of sigma_1^3 in B_2 is the right-handed trefoil (writhe +3).
 *
 * WORD PROBLEM: `braidEqual` is honest about its limits. It returns
 *   false     — proved unequal by an invariant (strand count, permutation,
 *               exponent sum),
 *   true      — proved equal by finding a rewrite path to the empty word
 *               using free reduction + commutation + braid relations,
 *   'unknown' — the bounded search was exhausted. The rewrite moves never
 *               increase word length, so the search is NOT complete: equal
 *               words that require a length-increasing detour are reported
 *               'unknown'. For genuinely small cases (short words, few
 *               strands) it works well; a complete solution would need e.g.
 *               Garside/handle-reduction normal forms.
 */

import { type Diagram, type Crossing } from './diagram.js';
import { spliceEdges } from './diagram.js';

export interface Braid {
  /** Number of strands, n >= 1. */
  strands: number;
  /** Letters +i (sigma_i) / -i (sigma_i^-1), 1 <= i <= n-1, bottom to top. */
  word: number[];
}

export function braid(strands: number, word: number[]): Braid {
  if (!Number.isInteger(strands) || strands < 1) throw new Error(`invalid strand count ${strands}`);
  for (const x of word) {
    if (!Number.isInteger(x) || x === 0 || Math.abs(x) > strands - 1) {
      throw new Error(`letter ${x} is not a valid generator for ${strands} strands`);
    }
  }
  return { strands, word: [...word] };
}

/** Concatenation (stacking): ab means "do a, then b". */
export function concatBraids(a: Braid, b: Braid): Braid {
  if (a.strands !== b.strands) throw new Error('cannot concatenate braids with different strand counts');
  return { strands: a.strands, word: [...a.word, ...b.word] };
}

export function inverseBraid(b: Braid): Braid {
  return { strands: b.strands, word: [...b.word].reverse().map((x) => -x) };
}

/** Cancel adjacent sigma_i sigma_i^-1 pairs until none remain. */
export function freeReduce(word: readonly number[]): number[] {
  const out: number[] = [];
  for (const x of word) {
    if (out.length > 0 && out[out.length - 1] === -x) out.pop();
    else out.push(x);
  }
  return out;
}

/**
 * The permutation induced on strand positions, as an array `p` with
 * p[start] = end (0-based positions).
 */
export function braidPermutation(b: Braid): number[] {
  // strandAt[pos] = index of the strand currently at pos.
  const strandAt = Array.from({ length: b.strands }, (_, i) => i);
  for (const x of b.word) {
    const i = Math.abs(x) - 1;
    const tmp = strandAt[i]!;
    strandAt[i] = strandAt[i + 1]!;
    strandAt[i + 1] = tmp;
  }
  const perm = new Array<number>(b.strands);
  strandAt.forEach((strand, pos) => {
    perm[strand] = pos;
  });
  return perm;
}

export function exponentSum(b: Braid): number {
  return b.word.reduce((s, x) => s + Math.sign(x), 0);
}

export interface BraidEqualOptions {
  /** Cap on distinct words explored by the rewrite search. */
  maxStates?: number;
}

/**
 * Bounded word-problem solver; see module header for semantics of
 * true / false / 'unknown'.
 */
export function braidEqual(a: Braid, b: Braid, opts: BraidEqualOptions = {}): boolean | 'unknown' {
  if (a.strands !== b.strands) return false;
  const w = freeReduce([...a.word, ...inverseBraid(b).word]);
  if (w.length === 0) return true;
  const asBraid: Braid = { strands: a.strands, word: w };
  if (braidPermutation(asBraid).some((p, i) => p !== i)) return false;
  if (exponentSum(asBraid) !== 0) return false;
  return searchTrivial(w, opts.maxStates ?? 50_000) ? true : 'unknown';
}

/** All words reachable from `w` by one non-increasing rewrite, freely reduced. */
function neighbors(w: readonly number[]): number[][] {
  const out: number[][] = [];
  const push = (v: number[]) => out.push(freeReduce(v));
  for (let k = 0; k < w.length - 1; k++) {
    const x = w[k]!;
    const y = w[k + 1]!;
    // Commutation: far-apart generators commute.
    if (Math.abs(Math.abs(x) - Math.abs(y)) >= 2) {
      const v = [...w];
      v[k] = y;
      v[k + 1] = x;
      push(v);
    }
    if (k + 2 < w.length) {
      const z = w[k + 2]!;
      const i = Math.abs(x);
      const j = Math.abs(y);
      if (Math.abs(i - j) === 1) {
        const repl = (r: [number, number, number]) => {
          const v = [...w];
          [v[k], v[k + 1], v[k + 2]] = r;
          push(v);
        };
        // sigma_i sigma_j sigma_i = sigma_j sigma_i sigma_j (both letters the
        // same sign; holds verbatim for the inverse generators too):
        if (z === x && Math.sign(x) === Math.sign(y)) repl([y, x, y]);
        // Derived conjugation forms for z = -x (i, j > 0, |i-j| = 1):
        //   [ i,  j, -i] -> [-j,  i,  j]      [-i, -j,  i] -> [ j, -i, -j]
        //   [-i,  j,  i] -> [ j,  i, -j]      [ i, -j, -i] -> [-j, -i,  j]
        // In letter form: same-sign x,y -> [-y, x, y]; mixed -> [y, -x, -y].
        if (z === -x) {
          if (Math.sign(x) === Math.sign(y)) repl([-y, x, y]);
          else repl([y, -x, -y]);
        }
      }
    }
  }
  return out;
}

function searchTrivial(start: readonly number[], maxStates: number): boolean {
  const key = (w: readonly number[]) => w.join(',');
  const seen = new Set<string>([key(start)]);
  const queue: number[][] = [[...start]];
  while (queue.length > 0 && seen.size <= maxStates) {
    const w = queue.shift()!;
    if (w.length === 0) return true;
    for (const v of neighbors(w)) {
      const k = key(v);
      if (!seen.has(k)) {
        seen.add(k);
        if (v.length === 0) return true;
        queue.push(v);
      }
    }
  }
  return false;
}

/**
 * Braid closure: join the top of each strand position to the bottom of the
 * same position, producing a link diagram. Positions untouched by any
 * crossing close into free loops.
 */
export function braidClosure(b: Braid): Diagram {
  let nextEdge = b.strands; // 0..strands-1 are the bottom edges
  const cur = Array.from({ length: b.strands }, (_, i) => i);
  const crossings: Crossing[] = [];
  for (const x of b.word) {
    const p = Math.abs(x) - 1; // left position (0-based)
    const q = p + 1;
    const eLeftOut = nextEdge++;
    const eRightOut = nextEdge++;
    if (x > 0) {
      // Strand at p goes OVER, ends at position q; strand at q goes under to p.
      crossings.push({
        overIn: cur[p]!,
        overOut: eLeftOut,
        underIn: cur[q]!,
        underOut: eRightOut,
        sign: 1,
      });
      cur[q] = eLeftOut;
      cur[p] = eRightOut;
    } else {
      // Strand at p goes UNDER, ends at position q; strand at q goes over to p.
      crossings.push({
        underIn: cur[p]!,
        underOut: eRightOut,
        overIn: cur[q]!,
        overOut: eLeftOut,
        sign: -1,
      });
      cur[q] = eRightOut;
      cur[p] = eLeftOut;
    }
  }
  // Close up: top edge at position p fuses with bottom edge p.
  const unions = cur.map((top, p) => [p, top] as const);
  const { crossings: closed, newFreeLoops } = spliceEdges(crossings, unions);
  return { crossings: closed, freeLoops: newFreeLoops };
}
