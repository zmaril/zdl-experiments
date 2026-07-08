/**
 * Grips as mini-tangles: core data model.
 *
 * A grip between two hands is a small tangle diagram:
 *   - Two rigid "palm bars" (walls): bar A (one hand) and bar B (the other),
 *     drawn as two parallel chords of a disk. Strands can cross a bar
 *     over ("in front of the hand") or under ("behind the hand") but can
 *     never pass through it, terminate in the middle of nowhere on it, or
 *     slide off its ends (the "wide palm / snug loop" assumption — see NOTES.md).
 *   - Up to 10 finger strands (4 fingers + 1 distinguished thumb per hand),
 *     each anchored at a knuckle point on its own bar and exiting on the
 *     palm side (the side facing the other hand).
 *   - Each strand ends either FREE (loose fingertip) or ATTACHED to a bar
 *     (fingertip pressed against a palm bar, on its palm side or back side).
 *
 * The diagram is encoded Gauss-code style: each strand is a sequence of
 * events (wall crossings and strand-strand crossings, the latter with
 * shared labels, over/under flags and signs), plus an end marker.
 *
 * Zones (regions of the projection plane, separated by the bars):
 *   zone 0 = behind bar A (back of hand A)
 *   zone 1 = the palm corridor between the bars
 *   zone 2 = behind bar B (back of hand B)
 * Every strand starts in zone 1 (knuckles exit on the palm side).
 *
 * Caveat (documented in NOTES.md): Gauss codes are not all planar-realizable;
 * we do not verify realizability. Hand-encoded grips are realizable by
 * construction; enumeration works at the invariant level.
 */

export type BarId = "A" | "B";
export type Side = "palm" | "back";
export type OU = "over" | "under";
export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";

export const FINGERS: Finger[] = ["thumb", "index", "middle", "ring", "pinky"];
export const FOUR_FINGERS: Finger[] = ["index", "middle", "ring", "pinky"];

export type Ev =
  | { t: "wall"; bar: BarId; ou: OU }
  | { t: "cross"; label: number; ou: OU; sign: 1 | -1 };

export type End =
  | { t: "free" }
  | { t: "attach"; bar: BarId; side: Side };

export interface Strand {
  hand: BarId; // which hand this digit belongs to (= its own bar)
  finger: Finger;
  events: Ev[];
  end: End;
}

export interface Grip {
  strands: Strand[];
}

export function strandKey(s: { hand: BarId; finger: Finger }): string {
  return `${s.hand}.${s.finger}`;
}

const FINGER_ORDER: Record<Finger, number> = {
  thumb: 0,
  index: 1,
  middle: 2,
  ring: 3,
  pinky: 4,
};

export function compareStrands(a: Strand, b: Strand): number {
  if (a.hand !== b.hand) return a.hand < b.hand ? -1 : 1;
  return FINGER_ORDER[a.finger] - FINGER_ORDER[b.finger];
}

/** Zone in which a strand must sit to attach at (bar, side). */
export function attachZone(bar: BarId, side: Side): number {
  if (bar === "A") return side === "palm" ? 1 : 0;
  return side === "palm" ? 1 : 2;
}

/**
 * Walk a strand's events and return the sequence of zones occupied
 * (starting at zone 1), or null if some wall crossing is impossible
 * (e.g. crossing bar B while in zone 0).
 */
export function zoneTrace(s: Strand): number[] | null {
  let z = 1;
  const trace = [z];
  for (const ev of s.events) {
    if (ev.t === "wall") {
      if (ev.bar === "A") {
        if (z !== 0 && z !== 1) return null;
        z = 1 - z;
      } else {
        if (z !== 1 && z !== 2) return null;
        z = 3 - z;
      }
    }
    trace.push(z);
  }
  return trace;
}

export interface ValidationError {
  strand?: string;
  msg: string;
}

/** Structural + zone validation. Returns [] when valid. */
export function validate(g: Grip): ValidationError[] {
  const errs: ValidationError[] = [];
  const seen = new Set<string>();
  for (const s of g.strands) {
    const k = strandKey(s);
    if (seen.has(k)) errs.push({ strand: k, msg: "duplicate strand" });
    seen.add(k);
  }
  // Crossing labels: exactly two occurrences, opposite over/under, same sign.
  const occ = new Map<number, { ou: OU; sign: number }[]>();
  for (const s of g.strands) {
    for (const ev of s.events) {
      if (ev.t === "cross") {
        const list = occ.get(ev.label) ?? [];
        list.push({ ou: ev.ou, sign: ev.sign });
        occ.set(ev.label, list);
      }
    }
  }
  for (const [label, list] of occ) {
    if (list.length !== 2) {
      errs.push({ msg: `crossing label ${label} occurs ${list.length} times (want 2)` });
      continue;
    }
    if (list[0].ou === list[1].ou)
      errs.push({ msg: `crossing label ${label}: both occurrences are '${list[0].ou}'` });
    if (list[0].sign !== list[1].sign)
      errs.push({ msg: `crossing label ${label}: occurrences disagree on sign` });
  }
  // Zone consistency.
  for (const s of g.strands) {
    const trace = zoneTrace(s);
    if (trace === null) {
      errs.push({ strand: strandKey(s), msg: "impossible wall crossing (wrong zone)" });
      continue;
    }
    if (s.end.t === "attach") {
      const need = attachZone(s.end.bar, s.end.side);
      const got = trace[trace.length - 1];
      if (got !== need)
        errs.push({
          strand: strandKey(s),
          msg: `attaches to ${s.end.bar}/${s.end.side} (zone ${need}) but ends in zone ${got}`,
        });
    }
  }
  return errs;
}

export function assertValid(g: Grip, what = "grip"): void {
  const errs = validate(g);
  if (errs.length > 0) {
    throw new Error(
      `invalid ${what}: ` + errs.map((e) => (e.strand ? `[${e.strand}] ` : "") + e.msg).join("; "),
    );
  }
}

/** Total crossing number of the diagram: strand-strand crossings + wall crossings. */
export function totalCrossings(g: Grip): number {
  let walls = 0;
  const labels = new Set<number>();
  for (const s of g.strands) {
    for (const ev of s.events) {
      if (ev.t === "wall") walls++;
      else labels.add(ev.label);
    }
  }
  return walls + labels.size;
}

export function cloneGrip(g: Grip): Grip {
  return {
    strands: g.strands.map((s) => ({
      hand: s.hand,
      finger: s.finger,
      events: s.events.map((e) => ({ ...e })),
      end: { ...s.end },
    })),
  };
}

/**
 * Canonical serialization: strands sorted, crossing labels renumbered
 * in first-traversal order. Two structurally identical diagrams
 * serialize identically.
 */
export function serialize(g: Grip): string {
  const strands = [...g.strands].sort(compareStrands);
  const relabel = new Map<number, number>();
  let next = 0;
  const parts: string[] = [];
  for (const s of strands) {
    for (const ev of s.events) {
      if (ev.t === "cross" && !relabel.has(ev.label)) relabel.set(ev.label, next++);
    }
  }
  for (const s of strands) {
    const evs = s.events
      .map((ev) =>
        ev.t === "wall"
          ? `w${ev.bar}${ev.ou === "over" ? "o" : "u"}`
          : `x${relabel.get(ev.label)}${ev.ou === "over" ? "o" : "u"}${ev.sign > 0 ? "+" : "-"}`,
      )
      .join(",");
    const end = s.end.t === "free" ? "free" : `att(${s.end.bar},${s.end.side})`;
    parts.push(`${strandKey(s)}:[${evs}];${end}`);
  }
  return parts.join("|");
}

/**
 * Mirror image of a grip: reflect through the projection plane.
 * Every crossing flips over<->under and its sign flips; attachments keep
 * their bar and side (the reflection is front/back, not palm/back —
 * "palm side" means "the side facing the other hand", preserved).
 */
export function mirror(g: Grip): Grip {
  const m = cloneGrip(g);
  for (const s of m.strands) {
    for (const ev of s.events) {
      ev.ou = ev.ou === "over" ? "under" : "over";
      if (ev.t === "cross") ev.sign = (ev.sign === 1 ? -1 : 1) as 1 | -1;
    }
  }
  return m;
}

let labelCounter = 1000;
export function freshLabel(): number {
  return labelCounter++;
}
