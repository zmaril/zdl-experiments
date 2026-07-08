/**
 * Canonical moves as REQUIREMENTS on the grip.
 *
 * A move does not care what the grip looks like; it cares which relative
 * motions the grip permits and which forces it can carry. Each move below is
 * a predicate over GripState. The grips x moves compatibility matrix is
 * DERIVED by evaluating these predicates against the catalog — nothing is
 * hand-written.
 */

import { GripState } from "./types.js";

export interface Move {
  id: string;
  name: string;
  /** Requirement, in dancer terms. */
  requires: string;
  compatible(s: GripState): boolean;
}

export const MOVES: Move[] = [
  {
    id: "underarmTurn",
    name: "Underarm turn",
    requires:
      "The clasp must swivel about vertical (free or resisted, not locked) while carrying tension to shape the turn.",
    compatible: (s) => s.motion.rotVert !== "locked" && s.forces.tension,
  },
  {
    id: "hammerlockEntry",
    name: "Hammerlock entry",
    requires:
      "The arm folds behind the back: the clasp must swivel about vertical AND roll about the grip axis (neither locked), with tension maintained through the wrap.",
    compatible: (s) =>
      s.motion.rotVert !== "locked" && s.motion.rotGrip !== "locked" && s.forces.tension,
  },
  {
    id: "dipSupport",
    name: "Dip support (at the hand)",
    requires:
      "Compression must transmit, the grip must brace torque about the lateral (hinge) axis, and shear must not slide (partner's weight cannot skate off the contact).",
    compatible: (s) =>
      s.forces.compression && s.forces.torqueLat && s.motion.transShear !== "free",
  },
  {
    id: "redirection",
    name: "Redirection / check",
    requires: "A brief tension pulse must transmit: any usable pull channel suffices.",
    compatible: (s) => s.forces.tension,
  },
  {
    id: "freeSpinRegrip",
    name: "Free spin with regrip",
    requires:
      "One dancer must be able to dissolve the grip alone, mid-move, and catch again: unilateral release.",
    compatible: (s) => s.release === "unilateral",
  },
  {
    id: "weightShareLean",
    name: "Weight-sharing lean",
    requires:
      "Sustained bilateral tension: the pull channel must be live and the clasp must not slide off sideways (shear not free).",
    compatible: (s) => s.forces.tension && s.motion.transShear !== "free",
  },
];
