/**
 * Functional grip model: what a grip lets two dancers DO, not what it looks like.
 *
 * A grip is modeled as a kinematic pair (mechanism-theory sense) between the
 * two hands/forearms. We deliberately avoid full SE(3) machinery and instead
 * give each relative-motion axis a ternary state, plus explicit force channels
 * and a closure regime (robotics grasp analysis: form vs force closure).
 *
 * Frame convention (grip-local, idealized):
 *   - GRIP axis: the line through the clasp, roughly forearm-to-forearm.
 *     This is also the tension/compression line.
 *   - VERT axis: vertical through the clasp (the axis an underarm turn
 *     rotates about when the clasped hands are overhead).
 *   - LAT axis: the third orthogonal axis (lateral/hinge).
 */

/** How relative motion along/about one axis behaves. */
export type MotionState =
  | "free" // moves with negligible resistance (a swivel, a slide)
  | "resisted" // moves, but against friction/effort; motion is available at a cost
  | "locked"; // geometrically blocked; no relative motion without breaking the grip

export const MOTION_STATES: readonly MotionState[] = ["free", "resisted", "locked"];

/** Rotation axes of relative motion at the clasp. */
export type RotAxis = "rotGrip" | "rotVert" | "rotLat";
/** Translation axes: along the tension/compression line, and shear across it. */
export type TransAxis = "transAxial" | "transShear";
export type Axis = RotAxis | TransAxis;

export const ROT_AXES: readonly RotAxis[] = ["rotGrip", "rotVert", "rotLat"];
export const TRANS_AXES: readonly TransAxis[] = ["transAxial", "transShear"];
export const AXES: readonly Axis[] = [...ROT_AXES, ...TRANS_AXES];

/**
 * Force channels: can a USABLE force be led through this channel?
 * "Usable" is a threshold judgment: enough transmission to lead a partner,
 * not merely nonzero physics. A light touch resists rotation a little but you
 * cannot lead a torque through it; its torque flag is false.
 */
export interface ForceChannels {
  /** Pull along the grip axis (stretch the connection). */
  tension: boolean;
  /** Push along the grip axis (compress the connection). */
  compression: boolean;
  /** Torque about the grip axis (forearm roll). */
  torqueGrip: boolean;
  /** Torque about the vertical axis (steering in the horizontal plane). */
  torqueVert: boolean;
  /** Torque about the lateral axis (hinge/dip-brace direction). */
  torqueLat: boolean;
}

export const TORQUE_OF_ROT: Record<RotAxis, keyof ForceChannels> = {
  rotGrip: "torqueGrip",
  rotVert: "torqueVert",
  rotLat: "torqueLat",
};

/**
 * Closure regime, from robotics grasp analysis:
 *   - "form":  geometry alone maintains the constraint (interlaced fingers,
 *              a hand encircling a wrist). No muscle required to keep it.
 *   - "force": the constraint exists only while someone actively squeezes
 *              (handshake, fingertip curl). Relax and it evaporates.
 *   - "none":  bare contact; surfaces touch and can push, nothing holds.
 */
export type Closure = "form" | "force" | "none";
export const CLOSURES: readonly Closure[] = ["none", "force", "form"];

/**
 * Release semantics:
 *   - "unilateral": at least one dancer can dissolve the grip alone.
 *   - "mutual":     dissolving the grip requires both dancers' cooperation
 *                   (each side's geometry cages the other).
 */
export type Release = "unilateral" | "mutual";
export const RELEASES: readonly Release[] = ["unilateral", "mutual"];

/** One abstract grip state: a cell in the combinatorial space. */
export interface GripState {
  motion: Record<Axis, MotionState>;
  forces: ForceChannels;
  closure: Closure;
  release: Release;
}

/** A cataloged, named, real-world grip occupying one cell. */
export interface Grip {
  id: string;
  name: string;
  /** Closest standard kinematic pair / mechanical joint. */
  kinematicPair: string;
  /** One-line dance affordance. */
  affordance: string;
  state: GripState;
  notes?: string;
}

/** Canonical string key for a state (cell identity in the space). */
export function stateKey(s: GripState): string {
  return [
    AXES.map((a) => s.motion[a][0]).join(""),
    [s.forces.tension, s.forces.compression, s.forces.torqueGrip, s.forces.torqueVert, s.forces.torqueLat]
      .map((b) => (b ? "1" : "0"))
      .join(""),
    s.closure[0],
    s.release[0],
  ].join("|");
}

export function describeState(s: GripState): string {
  const m = AXES.map((a) => `${a}=${s.motion[a]}`).join(" ");
  const f = Object.entries(s.forces)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(",");
  return `${m} | transmits: ${f || "nothing"} | closure=${s.closure} release=${s.release}`;
}
