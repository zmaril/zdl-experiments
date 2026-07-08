/**
 * The catalog: named grips from actual partner dancing, each classified by
 * what it lets the two dancers do, with its closest kinematic-pair analog
 * from mechanism theory.
 *
 * Frame reminder: rotGrip = about the forearm-to-forearm line; rotVert =
 * about vertical; rotLat = the third axis; transAxial = the pull/push line;
 * transShear = sliding across the palms.
 */

import { Grip, GripState } from "./types.js";

function grip(
  id: string,
  name: string,
  kinematicPair: string,
  affordance: string,
  state: GripState,
  notes?: string,
): Grip {
  return { id, name, kinematicPair, affordance, state, notes };
}

export const GRIPS: Grip[] = [
  grip(
    "handshake",
    "Handshake",
    "spherical pair with friction preload (friction ball joint)",
    "The all-rounder: leads everything a little, locks nothing.",
    {
      motion: {
        rotGrip: "resisted",
        rotVert: "resisted",
        rotLat: "resisted",
        transAxial: "resisted",
        transShear: "resisted",
      },
      forces: { tension: true, compression: true, torqueGrip: true, torqueVert: true, torqueLat: true },
      closure: "force",
      release: "unilateral",
    },
    "A firm handshake feels 'locked', but that is friction, not geometry: crank hard enough and every axis slips. All five channels transmit up to the slip threshold.",
  ),
  grip(
    "pistol",
    "Cross / pistol grip",
    "revolute pair about the grip axis, friction elsewhere",
    "A handshake with a built-in swivel: turns roll through the clasp while pull and push stay live.",
    {
      motion: {
        rotGrip: "free",
        rotVert: "resisted",
        rotLat: "resisted",
        transAxial: "resisted",
        transShear: "resisted",
      },
      forces: { tension: true, compression: true, torqueGrip: false, torqueVert: true, torqueLat: true },
      closure: "force",
      release: "unilateral",
    },
    "The rotated hand orientation aligns the clasp so forearm roll spins freely — which is exactly why you can't lead a forearm-roll torque through it.",
  ),
  grip(
    "looseClasp",
    "Loose palm clasp (closed-position hold)",
    "spherical pair, light preload",
    "Presence with pull: enough connection for tension and frame, too light to lead any torque.",
    {
      motion: {
        rotGrip: "resisted",
        rotVert: "resisted",
        rotLat: "resisted",
        transAxial: "resisted",
        transShear: "resisted",
      },
      forces: { tension: true, compression: true, torqueGrip: false, torqueVert: false, torqueLat: false },
      closure: "force",
      release: "unilateral",
    },
    "Same motion signature as the handshake, but the preload is below the usable-torque threshold on every rotation axis — the flags are what differ. This is the model's argument for keeping force flags semi-independent of motion states.",
  ),
  grip(
    "fingertip",
    "Fingertip hold",
    "spherical pair plus unilateral cable (ball joint on a string)",
    "A pure tension telegraph: every rotation spins free, only the pull speaks.",
    {
      motion: {
        rotGrip: "free",
        rotVert: "free",
        rotLat: "free",
        transAxial: "resisted",
        transShear: "free",
      },
      forces: { tension: true, compression: false, torqueGrip: false, torqueVert: false, torqueLat: false },
      closure: "force",
      release: "unilateral",
    },
    "Curled fingertips collapse under push and slide under shear: tension-only, and only while both keep the light curl.",
  ),
  grip(
    "hook",
    "Hook grip (fingers hooked, no thumb)",
    "open chain-link pair (near-spherical freedom, unilateral tension)",
    "Hang your weight without squeezing: tension you can trust, zero torque.",
    {
      motion: {
        rotGrip: "free",
        rotVert: "free",
        rotLat: "free",
        transAxial: "resisted",
        transShear: "resisted",
      },
      forces: { tension: true, compression: false, torqueGrip: false, torqueVert: false, torqueLat: false },
      closure: "force",
      release: "unilateral",
    },
    "Deeper purchase than fingertips (shear is resisted), but still an open hook: it needs the curl maintained, so force closure; straightening the fingers releases it instantly.",
  ),
  grip(
    "cup",
    "Cup / sandwich grip",
    "planar contact pair with clamp preload",
    "Press and steer: support and torque without asking the partner to grip anything.",
    {
      motion: {
        rotGrip: "resisted",
        rotVert: "resisted",
        rotLat: "resisted",
        transAxial: "resisted",
        transShear: "resisted",
      },
      forces: { tension: false, compression: true, torqueGrip: true, torqueVert: true, torqueLat: true },
      closure: "force",
      release: "unilateral",
    },
    "One dancer's hand pressed between the other's palm(s): the clamp transmits push and steering torques, but there is no interlock to pull with — release the press and it's gone.",
  ),
  grip(
    "handOnTop",
    "Ballroom hand-on-top",
    "planar contact pair (flat-on-flat, gravity preload)",
    "Presence without commitment: weight and lightness cues only, everything else stays yours.",
    {
      motion: {
        rotGrip: "resisted",
        rotVert: "free",
        rotLat: "resisted",
        transAxial: "resisted",
        transShear: "resisted",
      },
      forces: { tension: false, compression: true, torqueGrip: false, torqueVert: false, torqueLat: false },
      closure: "none",
      release: "unilateral",
    },
    "The follower's hand rests on the leader's: compression (weight) transmits, the resting hand pivots freely about vertical, and the light gravity-friction on the other axes stays below any usable-torque threshold.",
  ),
  grip(
    "interlaced",
    "Interlaced fingers",
    "rigid (zero-DOF) pair — a welded flange",
    "Total transmission, zero articulation: everything leads, nothing turns.",
    {
      motion: {
        rotGrip: "locked",
        rotVert: "locked",
        rotLat: "locked",
        transAxial: "locked",
        transShear: "locked",
      },
      forces: { tension: true, compression: true, torqueGrip: true, torqueVert: true, torqueLat: true },
      closure: "form",
      release: "mutual",
    },
    "Fully meshed fingers cage each other: geometry holds without squeeze (form closure), and neither dancer can dissolve it alone if the other keeps their fingers curled.",
  ),
  grip(
    "wristHold",
    "Wrist hold (one hand encircles the other's wrist)",
    "cylindrical pair (loose collar on a shaft)",
    "Control the arm, not the hand: steer the whole limb while the partner keeps their fingers.",
    {
      motion: {
        rotGrip: "resisted",
        rotVert: "locked",
        rotLat: "locked",
        transAxial: "resisted",
        transShear: "locked",
      },
      forces: { tension: true, compression: true, torqueGrip: true, torqueVert: true, torqueLat: true },
      closure: "form",
      release: "unilateral",
    },
    "The encircling hand is a collar around the forearm shaft: off-axis rotations and shear are geometrically caged (form closure), while the shaft can still twist and slide inside the collar against friction. Tension catches on the widening hand. The HOLDER can always open their hand alone — form closure made by one side's geometry is unilaterally releasable.",
  ),
  grip(
    "forearmHold",
    "Forearm / double-wrist hold (each grips the other's forearm)",
    "two cylindrical pairs in series, mutually caged",
    "The handshake you can't fumble: weight-sharing and torque on tap, but exits must be negotiated.",
    {
      motion: {
        rotGrip: "resisted",
        rotVert: "locked",
        rotLat: "locked",
        transAxial: "resisted",
        transShear: "locked",
      },
      forces: { tension: true, compression: true, torqueGrip: true, torqueVert: true, torqueLat: true },
      closure: "form",
      release: "mutual",
    },
    "Same motion signature as the single wrist hold, but each hand collars the other's forearm: releasing your own grip still leaves you collared, so full release takes both. Release mode is the ONLY cell coordinate separating this from wristHold — the functional difference is real and the model captures it.",
  ),
];

export const GRIP_BY_ID: Record<string, Grip> = Object.fromEntries(GRIPS.map((g) => [g.id, g]));
