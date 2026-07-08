/**
 * Enumerate-then-filter over the abstract grip space.
 *
 * Raw space = per-axis motion states x force flags x closure x release:
 *   3^5 axes x 2^5 force channels x 3 closures x 2 releases = 46,656 states.
 * Then filter by the mechanical consistency rules (rules.ts), and see which
 * consistent cells the real cataloged grips occupy.
 */

import {
  AXES,
  Axis,
  CLOSURES,
  GripState,
  MOTION_STATES,
  MotionState,
  RELEASES,
  stateKey,
} from "./types.js";
import { isConsistent } from "./rules.js";
import { GRIPS } from "./grips.js";

const BOOLS = [false, true] as const;

export function* allStates(): Generator<GripState> {
  const motions: MotionState[] = new Array(AXES.length);
  function* motionCombos(i: number): Generator<Record<Axis, MotionState>> {
    if (i === AXES.length) {
      const rec = {} as Record<Axis, MotionState>;
      AXES.forEach((a, j) => (rec[a] = motions[j]!));
      yield rec;
      return;
    }
    for (const m of MOTION_STATES) {
      motions[i] = m;
      yield* motionCombos(i + 1);
    }
  }
  for (const motion of motionCombos(0)) {
    for (const tension of BOOLS)
      for (const compression of BOOLS)
        for (const torqueGrip of BOOLS)
          for (const torqueVert of BOOLS)
            for (const torqueLat of BOOLS)
              for (const closure of CLOSURES)
                for (const release of RELEASES)
                  yield {
                    motion: { ...motion },
                    forces: { tension, compression, torqueGrip, torqueVert, torqueLat },
                    closure,
                    release,
                  };
  }
}

export interface EnumerationResult {
  raw: number;
  consistent: number;
  occupied: number;
  consistentStates: GripState[];
  /** Map from cell key to grip ids occupying it. */
  occupancy: Map<string, string[]>;
}

export function enumerate(): EnumerationResult {
  let raw = 0;
  const consistentStates: GripState[] = [];
  for (const s of allStates()) {
    raw++;
    if (isConsistent(s)) consistentStates.push(s);
  }
  const occupancy = new Map<string, string[]>();
  for (const g of GRIPS) {
    const k = stateKey(g.state);
    occupancy.set(k, [...(occupancy.get(k) ?? []), g.id]);
  }
  return {
    raw,
    consistent: consistentStates.length,
    occupied: occupancy.size,
    consistentStates,
    occupancy,
  };
}

/**
 * Interesting empty cells: states that pass the consistency filter, that no
 * cataloged grip occupies, and that we can name — theoretically buildable
 * grips nobody dances with. Each is verified consistent-and-unoccupied by
 * the test suite.
 */
export interface EmptyCellExample {
  id: string;
  name: string;
  speculation: string;
  state: GripState;
}

export const EMPTY_CELL_EXAMPLES: EmptyCellExample[] = [
  {
    id: "hingeGrip",
    name: "Hinge grip (revolute about vertical, welded elsewhere)",
    speculation:
      "A grip that turns like a door hinge but transmits everything else: underarm turns would feel bolted-on-rails — full frame, full push/pull, one silky axis. Closest real thing is a gymnast's swivel-bearing grip aid; hands alone can't build it because finger interlocks that cage four axes always cage the fifth.",
    state: {
      motion: {
        rotGrip: "locked",
        rotVert: "free",
        rotLat: "locked",
        transAxial: "locked",
        transShear: "locked",
      },
      forces: { tension: true, compression: true, torqueGrip: true, torqueVert: false, torqueLat: true },
      closure: "form",
      release: "mutual",
    },
  },
  {
    id: "tromboneGrip",
    name: "Trombone grip (prismatic pair)",
    speculation:
      "Hands slide freely along the grip axis but are rotationally welded: you could lead every turn by torque while the connection breathes in and out with no tension at all. It would look like both hands loosely collaring a short smooth baton. No dance uses it — partner dancing leads distance changes through exactly the pull/push channel this grip deletes.",
    state: {
      motion: {
        rotGrip: "locked",
        rotVert: "locked",
        rotLat: "locked",
        transAxial: "free",
        transShear: "locked",
      },
      forces: { tension: false, compression: false, torqueGrip: true, torqueVert: true, torqueLat: true },
      closure: "form",
      release: "mutual",
    },
  },
  {
    id: "compressionFingertip",
    name: "Compression fingertip (push-only ball joint)",
    speculation:
      "The mirror image of the fingertip hold: all rotations free, and the only live channel is push. Palm-heel balanced against palm-heel — contact improvisation touches this cell in passing, but no codified partner-dance grip lives there, because sustained compression through free-spinning fingertips buckles.",
    state: {
      motion: {
        rotGrip: "free",
        rotVert: "free",
        rotLat: "free",
        transAxial: "resisted",
        transShear: "free",
      },
      forces: { tension: false, compression: true, torqueGrip: false, torqueVert: false, torqueLat: false },
      closure: "force",
      release: "unilateral",
    },
  },
  {
    id: "torqueOnlyClamp",
    name: "Torque-only clamp (slipping collar)",
    speculation:
      "Rotations resisted with usable torque on all three axes, but the axial slide transmits neither pull nor push — like gripping your partner's hand through a silk sleeve. You could steer their wrist orientation yet never move them through space. A grip for leading pure shape, not travel.",
    state: {
      motion: {
        rotGrip: "resisted",
        rotVert: "resisted",
        rotLat: "resisted",
        transAxial: "resisted",
        transShear: "resisted",
      },
      forces: { tension: false, compression: false, torqueGrip: true, torqueVert: true, torqueLat: true },
      closure: "force",
      release: "unilateral",
    },
  },
];
