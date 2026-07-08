/**
 * Invariants of grip-tangles.
 *
 * Two sound invariants of isotopy rel palm bars + attachments:
 *
 * 1. Per-strand homotopy word: the strand, as a path in the complement of
 *    the two rigid bars with fixed endpoints, has a well-defined homotopy
 *    class. The complement of two disjoint rods deformation-retracts so that
 *    pi_1 is free on two meridians a (around bar A) and b (around bar B).
 *    Reading convention (Wirtinger-style): passing UNDER a bar contributes
 *    the meridian of that bar, signed by direction of the zone change;
 *    passing OVER contributes nothing. The reduced word, together with the
 *    attachment side (part of the boundary data), is an isotopy invariant.
 *
 * 2. Pairwise crossing-sign sums: for two distinct strands with fixed
 *    endpoints, the sum of signs of their mutual crossings is invariant
 *    (crossings between disjoint arcs with fixed endpoints appear and
 *    disappear in cancelling pairs under generic isotopy). This is a
 *    relative linking number; it is what detects "my finger threads
 *    through the loop of yours".
 *
 * What the signature does NOT see (honest gaps, see NOTES.md):
 *   - knotted single strands (needs >= 3 self-crossings; excluded by the
 *     finger-length feasibility bound anyway),
 *   - higher linking (Whitehead/Borromean-style patterns with pairwise
 *     sums zero), which need more crossings than short fingers allow,
 *   - where along a bar a crossing or attachment sits (slot positions are
 *     abstracted away in v1).
 *
 * Free-tip retraction: a strand whose tip is FREE can always be pulled
 * back along itself to its knuckle (nothing pins a loose end), removing
 * every crossing it participates in. Signatures are therefore computed
 * after retracting all free strands; only attached strands carry grip
 * content. This is the crisp formal version of "a grip that isn't held
 * isn't a grip".
 */

import {
  type BarId,
  type Finger,
  type Grip,
  type Side,
  type Strand,
  cloneGrip,
  compareStrands,
  strandKey,
  zoneTrace,
} from "./model.ts";

export interface Letter {
  bar: BarId;
  sign: 1 | -1;
}

/** Free reduction of a word in F2 = <a, b>. */
export function reduceWord(w: Letter[]): Letter[] {
  const out: Letter[] = [];
  for (const l of w) {
    const top = out[out.length - 1];
    if (top && top.bar === l.bar && top.sign === -l.sign) out.pop();
    else out.push({ ...l });
  }
  return out;
}

export function wordToString(w: Letter[]): string {
  if (w.length === 0) return "1";
  return w.map((l) => (l.sign > 0 ? l.bar.toLowerCase() : l.bar.toLowerCase() + "'")).join("");
}

/**
 * Homotopy word of a strand in F2 = <a, b>.
 * Sign convention: crossing under bar A in direction zone 1 -> 0 is a^+1;
 * under bar B in direction 1 -> 2 is b^+1 (i.e. "+1 = diving from the palm
 * corridor to that hand's back side").
 */
export function homotopyWord(s: Strand): Letter[] {
  const trace = zoneTrace(s);
  if (trace === null) throw new Error(`strand ${strandKey(s)} has invalid zones`);
  const w: Letter[] = [];
  let i = 0;
  for (const ev of s.events) {
    const from = trace[i];
    const to = trace[i + 1];
    i++;
    if (ev.t !== "wall" || ev.ou !== "under") continue;
    if (ev.bar === "A") w.push({ bar: "A", sign: from === 1 && to === 0 ? 1 : -1 });
    else w.push({ bar: "B", sign: from === 1 && to === 2 ? 1 : -1 });
  }
  return reduceWord(w);
}

/**
 * Retract all free-tipped strands to bare knuckle stubs (always a valid
 * isotopy), removing their crossings from partner strands too.
 * Mutates and returns the grip.
 */
export function retractFreeStrands(g: Grip): Grip {
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of g.strands) {
      if (s.end.t !== "free" || s.events.length === 0) continue;
      const ev = s.events.pop()!;
      if (ev.t === "cross") {
        // Remove the partner occurrence of this label.
        outer: for (const t of g.strands) {
          for (let i = t.events.length - 1; i >= 0; i--) {
            const te = t.events[i];
            if (te.t === "cross" && te.label === ev.label && !(t === s && i === s.events.length)) {
              // note: s.events already popped, so index bounds are safe
              t.events.splice(i, 1);
              break outer;
            }
          }
        }
      }
      changed = true;
    }
  }
  return g;
}

export interface StrandSig {
  hand: BarId;
  finger: Finger;
  attach: { bar: BarId; side: Side };
  word: string;
}

export interface PairSum {
  pair: [string, string]; // strand keys, sorted
  sum: number;
}

export interface Signature {
  strands: StrandSig[];
  pairSums: PairSum[];
}

/**
 * Invariant signature of a grip: computed after retracting free strands.
 * Free (retracted) strands are trivial and omitted.
 */
export function signature(g: Grip): Signature {
  const h = retractFreeStrands(cloneGrip(g));
  const attached = h.strands.filter((s) => s.end.t === "attach").sort(compareStrands);
  const strandSigs: StrandSig[] = attached.map((s) => ({
    hand: s.hand,
    finger: s.finger,
    attach: { bar: (s.end as { bar: BarId }).bar, side: (s.end as { side: Side }).side },
    word: wordToString(homotopyWord(s)),
  }));
  // Pair sums from crossing labels shared between two distinct strands.
  const owner = new Map<number, { key: string; sign: number }[]>();
  for (const s of attached) {
    for (const ev of s.events) {
      if (ev.t !== "cross") continue;
      const list = owner.get(ev.label) ?? [];
      list.push({ key: strandKey(s), sign: ev.sign });
      owner.set(ev.label, list);
    }
  }
  const sums = new Map<string, number>();
  for (const [, occs] of owner) {
    if (occs.length !== 2) continue; // dangling label (partner was free & retracted mid-copy) — ignore
    if (occs[0].key === occs[1].key) continue; // self-crossing: not part of pair sums
    const [k1, k2] = [occs[0].key, occs[1].key].sort();
    sums.set(`${k1}~${k2}`, (sums.get(`${k1}~${k2}`) ?? 0) + occs[0].sign);
  }
  const pairSums: PairSum[] = [...sums.entries()]
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => ({ pair: k.split("~") as [string, string], sum: v }))
    .sort((x, y) => (x.pair.join() < y.pair.join() ? -1 : 1));
  return { strands: strandSigs, pairSums };
}

export function signatureString(sig: Signature): string {
  const s = sig.strands
    .map((t) => `${t.hand}.${t.finger}->${t.attach.bar}/${t.attach.side}:${t.word}`)
    .join(" ");
  const p = sig.pairSums.map((ps) => `lk(${ps.pair[0]},${ps.pair[1]})=${ps.sum}`).join(" ");
  return p ? `${s} | ${p}` : s;
}

export function gripSignatureString(g: Grip): string {
  return signatureString(signature(g));
}

/**
 * Shape signature: the grip up to relabelling which hand is A/B and
 * (optionally) which digit is which. Used to detect "same grip pattern
 * performed with different fingers" (e.g. thumb wrap = hook grip done
 * with thumbs).
 */
export function shapeSignatureString(g: Grip, opts: { forgetDigits?: boolean } = {}): string {
  const sig = signature(g);
  const variants: string[] = [];
  for (const swap of [false, true]) {
    const mapHand = (h: BarId): BarId => (swap ? (h === "A" ? "B" : "A") : h);
    const strands = sig.strands.map((t) => {
      const hand = mapHand(t.hand);
      const bar = mapHand(t.attach.bar);
      const rel = bar === hand ? "own" : "other";
      // Word letters relative to this strand's hand: own-bar vs other-bar meridians.
      const word =
        t.word === "1"
          ? "1"
          : t.word
              .replace(/a/g, hand === "A" ? "s" : "p") // s = self/own bar, p = partner bar
              .replace(/b/g, hand === "A" ? "p" : "s");
      const digit = opts.forgetDigits ? "digit" : t.finger === "thumb" ? "thumb" : "finger";
      return { origKey: `${t.hand}.${t.finger}`, hand, digit, rel, side: t.attach.side, word };
    });
    const sorted = [...strands].sort((x, y) => {
      const kx = `${x.hand}|${x.digit}|${x.rel}|${x.side}|${x.word}`;
      const ky = `${y.hand}|${y.digit}|${y.rel}|${y.side}|${y.word}`;
      return kx < ky ? -1 : kx > ky ? 1 : 0;
    });
    const idx = new Map<string, number>();
    sorted.forEach((t, i) => idx.set(t.origKey, i));
    const strandPart = sorted.map((t) => `${t.hand}:${t.digit}->${t.rel}/${t.side}:${t.word}`).join(" ");
    const pairPart = sig.pairSums
      .map((ps) => {
        const i = idx.get(ps.pair[0])!;
        const j = idx.get(ps.pair[1])!;
        const [x, y] = i < j ? [i, j] : [j, i];
        return `lk(#${x},#${y})=${ps.sum}`;
      })
      .sort()
      .join(" ");
    variants.push(pairPart ? `${strandPart} | ${pairPart}` : strandPart);
  }
  variants.sort();
  return variants[0];
}
