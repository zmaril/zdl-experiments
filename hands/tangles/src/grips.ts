/**
 * Named grips from partner dancing, encoded as grip-tangle diagrams.
 *
 * Conventions used in the encodings (see NOTES.md for the dance reading):
 *   - Bar A = one dancer's hand, bar B = the other's. Fingers exit knuckles
 *     on the palm side (zone 1, the corridor between the two hands).
 *   - "Held tight" is modeled as fingertip attachment: a curled finger
 *     whose tip presses a palm bar becomes an arc with both ends fixed.
 *   - Loose digits are encoded as FREE strands (they retract to nothing).
 */

import {
  type BarId,
  type End,
  type Ev,
  type Finger,
  type Grip,
  type Side,
  type Strand,
  FOUR_FINGERS,
  freshLabel,
  mirror,
} from "./model.ts";
import { homotopyWord } from "./invariants.ts";
import {
  type Atom,
  type Rel,
  type RelLetter,
  attachZoneRel,
  minWallCost,
  relWordToString,
} from "./enumerate.ts";

function strand(hand: BarId, finger: Finger, events: Ev[], end: End): Strand {
  return { hand, finger, events, end };
}

function att(bar: BarId, side: Side): End {
  return { t: "attach", bar, side };
}

const FREE: End = { t: "free" };

function loose(hand: BarId, fingers: Finger[]): Strand[] {
  return fingers.map((f) => strand(hand, f, [], FREE));
}

/**
 * Fingertip hold: minimal contact. Fingertips rest against the partner's
 * palm; nothing wraps anything. (The model attaches tips to the partner's
 * palm bar since tips can only attach to bars — tip-to-tip contact is
 * approximated by mutual palm contact.)
 */
export function fingertipHold(): Grip {
  return {
    strands: [
      ...FOUR_FINGERS.map((f) => strand("A", f, [], att("B", "palm"))),
      ...FOUR_FINGERS.map((f) => strand("B", f, [], att("A", "palm"))),
      strand("A", "thumb", [], FREE),
      strand("B", "thumb", [], FREE),
    ],
  };
}

/**
 * Handshake: mutual palm wrap. Each hand's four fingers hook UNDER the
 * other's palm bar and press against the back of the other's hand; each
 * thumb presses the other's palm from the front.
 * Per finger homotopy word: one meridian of the partner's bar.
 */
export function handshake(): Grip {
  return {
    strands: [
      ...FOUR_FINGERS.map((f) =>
        strand("A", f, [{ t: "wall", bar: "B", ou: "under" }], att("B", "back")),
      ),
      strand("A", "thumb", [], att("B", "palm")),
      ...FOUR_FINGERS.map((f) =>
        strand("B", f, [{ t: "wall", bar: "A", ou: "under" }], att("A", "back")),
      ),
      strand("B", "thumb", [], att("A", "palm")),
    ],
  };
}

/**
 * Hook grip: curled fingers interlocking, thumbs out. Each finger curls
 * back to its own palm (a closed loop based on its own bar); opposite
 * fingers thread each other's loops. Two mutual crossings of equal sign
 * per finger pair: relative linking number ±2 raw sum (i.e. Hopf-linked
 * loops), no bar is wrapped at all.
 */
export function hookGrip(fingers: Finger[] = FOUR_FINGERS): Grip {
  const strands: Strand[] = [];
  for (const f of fingers) {
    const l1 = freshLabel();
    const l2 = freshLabel();
    strands.push(
      strand(
        "A",
        f,
        [
          { t: "cross", label: l1, ou: "over", sign: 1 },
          { t: "cross", label: l2, ou: "under", sign: 1 },
        ],
        att("A", "palm"),
      ),
      strand(
        "B",
        f,
        [
          { t: "cross", label: l1, ou: "under", sign: 1 },
          { t: "cross", label: l2, ou: "over", sign: 1 },
        ],
        att("B", "palm"),
      ),
    );
  }
  strands.push(...loose("A", ["thumb"]), ...loose("B", ["thumb"]));
  const unused = FOUR_FINGERS.filter((f) => !fingers.includes(f));
  strands.push(...loose("A", unused), ...loose("B", unused));
  return { strands };
}

/** Hook grip performed with a single finger pair (index to index). */
export function singleFingerHook(): Grip {
  return hookGrip(["index"]);
}

/**
 * Interlaced fingers ("prayer clasp"): palms together, fingers alternate
 * through each other's finger gaps and curl over the back of the other's
 * hand. Each finger wraps the partner's bar exactly as in a handshake,
 * AND corresponding fingers of the two hands cross each other once on the
 * way (they travel the same corridor in opposite directions), giving a
 * pairwise crossing sum of +1 per finger pair — which is what
 * distinguishes the clasp from a mutual handshake wrap in this model.
 */
export function interlacedFingers(): Grip {
  const strands: Strand[] = [];
  for (const f of FOUR_FINGERS) {
    const c = freshLabel();
    strands.push(
      strand(
        "A",
        f,
        [
          { t: "cross", label: c, ou: "over", sign: 1 },
          { t: "wall", bar: "B", ou: "under" },
        ],
        att("B", "back"),
      ),
      strand(
        "B",
        f,
        [
          { t: "cross", label: c, ou: "under", sign: 1 },
          { t: "wall", bar: "A", ou: "under" },
        ],
        att("A", "back"),
      ),
    );
  }
  strands.push(strand("A", "thumb", [], att("B", "palm")), strand("B", "thumb", [], att("A", "palm")));
  return { strands };
}

/**
 * Thumb wrap: thumb around thumb (as in an arm-wrestling or "soul shake"
 * start). Topologically the hook grip performed by the thumbs: the two
 * thumbs curl to their own palms and thread each other's loops. Fingers
 * loose.
 */
export function thumbWrap(): Grip {
  const t1 = freshLabel();
  const t2 = freshLabel();
  return {
    strands: [
      strand(
        "A",
        "thumb",
        [
          { t: "cross", label: t1, ou: "over", sign: 1 },
          { t: "cross", label: t2, ou: "under", sign: 1 },
        ],
        att("A", "palm"),
      ),
      strand(
        "B",
        "thumb",
        [
          { t: "cross", label: t1, ou: "under", sign: 1 },
          { t: "cross", label: t2, ou: "over", sign: 1 },
        ],
        att("B", "palm"),
      ),
      ...loose("A", FOUR_FINGERS),
      ...loose("B", FOUR_FINGERS),
    ],
  };
}

/**
 * Cross grip (e.g. right-to-right where a left-to-right hold is standard):
 * modeled as the MIRROR IMAGE of the handshake. Every finger passes in
 * front of the partner's bar instead of behind it before pressing the back
 * of the partner's hand: all homotopy words become trivial while the
 * boundary data stays the same — a chirality pair with the handshake.
 */
export function crossGrip(): Grip {
  return mirror(handshake());
}

/** A closed fist pressed against the partner's palm — a baseline non-grip. */
export function fistOnPalm(): Grip {
  return {
    strands: [
      ...FOUR_FINGERS.map((f) => strand("A", f, [], att("A", "palm"))),
      ...loose("A", ["thumb"]),
      ...loose("B", ["thumb", ...FOUR_FINGERS]),
    ],
  };
}

export interface NamedGrip {
  name: string;
  blurb: string;
  grip: Grip;
}

export function namedGrips(): NamedGrip[] {
  return [
    { name: "fingertip hold", blurb: "minimal contact, tips on the partner's palm", grip: fingertipHold() },
    { name: "handshake", blurb: "mutual palm wrap, fingers behind the partner's hand", grip: handshake() },
    { name: "hook grip", blurb: "curled fingers interlocked, thumbs out", grip: hookGrip() },
    { name: "interlaced fingers", blurb: "alternating weave, tips on the partner's back", grip: interlacedFingers() },
    { name: "thumb wrap", blurb: "thumb around thumb, fingers loose", grip: thumbWrap() },
    { name: "cross grip", blurb: "mirror-image handshake (chirality partner)", grip: crossGrip() },
  ];
}

// ---------------------------------------------------------------------------
// Bridging diagrams to the enumeration's invariant-level classes
// ---------------------------------------------------------------------------

/** Hand-agnostic atom of a single (attached) strand of a diagram. */
export function strandAtom(s: Strand): Atom {
  if (s.end.t !== "attach") throw new Error("atom of a free strand is trivial");
  const rel: Rel = s.end.bar === s.hand ? "own" : "other";
  const word: RelLetter[] = homotopyWord(s).map((l) => ({
    bar: l.bar === s.hand ? "s" : "p",
    sign: l.sign,
  }));
  const cost = minWallCost(word, attachZoneRel(rel, s.end.side));
  return { rel, side: s.end.side, word, wordStr: relWordToString(word), cost };
}
