/**
 * Mechanical consistency rules: the filter between "writable" and "buildable".
 *
 * The abstract space is every combination of per-axis motion states, force
 * flags, closure regime, and release mode. Most combinations describe grips
 * that cannot exist — torque led through a free swivel, a pull on a surface
 * you are merely resting on. Each rule below is one such impossibility,
 * stated as an implication and documented with its physical justification.
 *
 * A state is CONSISTENT iff it violates no rule.
 */

import {
  GripState,
  ROT_AXES,
  AXES,
  TORQUE_OF_ROT,
} from "./types.js";

export interface Rule {
  id: string;
  name: string;
  /** Physical justification, in words. */
  doc: string;
  /** Returns true if the state SATISFIES the rule. */
  holds(s: GripState): boolean;
}

export const RULES: Rule[] = [
  {
    id: "R1",
    name: "free-axis-transmits-nothing",
    doc:
      "You cannot lead a force through a joint that moves freely along that " +
      "channel: torque about a free-swiveling axis just spins the swivel, and " +
      "pull/push along a freely sliding axis just slides it. Free rotation " +
      "implies no torque on that axis; free axial translation implies neither " +
      "tension nor compression.",
    holds(s) {
      for (const r of ROT_AXES) {
        if (s.motion[r] === "free" && s.forces[TORQUE_OF_ROT[r]]) return false;
      }
      if (s.motion.transAxial === "free" && (s.forces.tension || s.forces.compression)) {
        return false;
      }
      return true;
    },
  },
  {
    id: "R2",
    name: "locked-axis-transmits-fully",
    doc:
      "A geometric lock carries whatever you put through it: if relative " +
      "rotation about an axis is blocked by geometry, torque about that axis " +
      "passes to the partner whether anyone wants it to or not; if axial " +
      "translation is geometrically blocked in both directions, both tension " +
      "and compression transmit. (This is why locked joints are honest and " +
      "tiring: nothing is filtered.)",
    holds(s) {
      for (const r of ROT_AXES) {
        if (s.motion[r] === "locked" && !s.forces[TORQUE_OF_ROT[r]]) return false;
      }
      if (s.motion.transAxial === "locked" && !(s.forces.tension && s.forces.compression)) {
        return false;
      }
      return true;
    },
  },
  {
    id: "R3",
    name: "only-geometry-locks",
    doc:
      "Friction can resist, only geometry can lock. A squeeze (force closure) " +
      "or bare contact can make motion costly, but a sufficiently strong " +
      "partner can always overpower friction — 'locked' (motion impossible " +
      "without breaking the grip) requires interlocking geometry, i.e. form " +
      "closure. Any locked axis implies closure = form.",
    holds(s) {
      const anyLocked = AXES.some((a) => s.motion[a] === "locked");
      return !anyLocked || s.closure === "form";
    },
  },
  {
    id: "R4",
    name: "form-closure-locks-something",
    doc:
      "Form closure that constrains no axis is not form closure. If geometry " +
      "alone maintains the grip, that geometry must geometrically block at " +
      "least one relative motion. Closure = form implies at least one locked " +
      "axis. (Caveat, documented in NOTES.md: one-directional cages like two " +
      "interlocked finger-rings are blocked in only half of an axis; our " +
      "ternary axes cannot express that, so such grips classify as force " +
      "closure here.)",
    holds(s) {
      if (s.closure !== "form") return true;
      return AXES.some((a) => s.motion[a] === "locked");
    },
  },
  {
    id: "R5",
    name: "force-closure-resists-something",
    doc:
      "A squeeze that resists nothing is not closure. If the grip exists only " +
      "by active muscular effort, that effort must show up as friction " +
      "resistance on at least one axis; otherwise the state is " +
      "indistinguishable from no grip at all. Closure = force implies at " +
      "least one resisted axis.",
    holds(s) {
      if (s.closure !== "force") return true;
      return AXES.some((a) => s.motion[a] === "resisted");
    },
  },
  {
    id: "R6",
    name: "contact-cannot-pull",
    doc:
      "You cannot pull on a surface you are only resting on. Bare contact " +
      "(closure = none) supports pushes — surfaces oppose interpenetration — " +
      "but tension requires either interlocking geometry or an active squeeze " +
      "to hang on with. Closure = none implies no tension transmission.",
    holds(s) {
      return s.closure !== "none" || !s.forces.tension;
    },
  },
  {
    id: "R7",
    name: "contact-releases-freely",
    doc:
      "With bare contact, either dancer just moves away: nothing cages " +
      "anything. Closure = none implies unilateral release.",
    holds(s) {
      return s.closure !== "none" || s.release === "unilateral";
    },
  },
  {
    id: "R8",
    name: "mutual-release-needs-mutual-geometry",
    doc:
      "Only mutually interlocking geometry can require mutual consent to " +
      "exit. Under force closure the squeezer can always simply relax (their " +
      "own hand opening dissolves the constraint), and bare contact holds " +
      "nobody — so release = mutual implies closure = form. Note the converse " +
      "is false: form closure produced by ONE hand's geometry (a hand " +
      "encircling a wrist) is releasable by that hand's owner alone.",
    holds(s) {
      return s.release !== "mutual" || s.closure === "form";
    },
  },
];

/** IDs of rules the state violates (empty array = mechanically consistent). */
export function violations(s: GripState): string[] {
  return RULES.filter((r) => !r.holds(s)).map((r) => r.id);
}

export function isConsistent(s: GripState): boolean {
  return RULES.every((r) => r.holds(s));
}
