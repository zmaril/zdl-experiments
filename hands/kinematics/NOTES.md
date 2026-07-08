# Grips as Machines: a functional classification of the hands

The set-partition model answered *which hands are connected* (B(4) = 15 holds,
157 with hammerlocks). This experiment asks the next question down, at the
scale of the hands themselves: **what does each grip let you DO?**

The bet: a grip is a machine. Specifically, it's a *kinematic pair* — the same
object mechanism theory uses to classify joints. A door hinge is a revolute
pair, a piston in a cylinder is a cylindrical pair, a ball-and-socket is a
spherical pair. An underarm turn works only because the grip swivels; a firm
handshake resists rotation; a fingertip hold transmits pull but folds under
push. Classify grips by shape and you get anatomy. Classify them by what
motions and forces they permit, and moves become *requirements you can check
against a grip* — mechanically, by code.

## The model

Every grip gets a grip-local frame: the **grip axis** runs forearm-to-forearm
through the clasp (this is also the pull/push line), **vertical** is vertical,
and **lateral** is the third axis. Then:

- **Five motion axes** — rotation about grip / vertical / lateral, translation
  along the axial line, and shear across it — each in one of three states:
  `free` (swivels/slides), `resisted` (moves against friction), `locked`
  (geometrically blocked).
- **Five force channels** — tension, compression, and torque about each
  rotation axis — each flagged *usable for leading* or not. "Usable" is a
  threshold call: a light clasp technically resists rotation, but you can't
  lead a torque through it, so its torque flags are off.
- **Closure regime**, straight from robotics grasp analysis: `form` (geometry
  alone holds it — interlaced fingers, a hand collaring a wrist), `force`
  (exists only while someone squeezes — handshake), `none` (bare contact —
  hand-on-top).
- **Release mode**: `unilateral` (someone can dissolve it alone) or `mutual`
  (exits must be negotiated).

## Enumerate, then filter

Same move as the hammerlock census: write down the whole abstract space, then
throw out what physics forbids.

- **Raw combinations: 46,656** (3⁵ motion × 2⁵ forces × 3 closures × 2 releases).
- **Mechanically consistent: 2,195** after eight explicit rules
  (`src/rules.ts`, each with its physical justification). The big ones:
  - *Free axes transmit nothing* — torque into a free swivel just spins the swivel.
  - *Locked axes transmit fully* — a geometric lock carries whatever you feed it.
  - *Only geometry locks* — friction resists; a strong enough partner always
    overpowers a squeeze. `locked` requires form closure.
  - *You can't pull on a surface you're only resting on* — bare contact pushes,
    never pulls.
  - *Mutual release needs mutual geometry* — only interlocks built by both
    hands can require both dancers to exit. (Converse false: a wrist hold is
    form closure, but the holder can always open their hand alone.)
- **Cells occupied by real grips: 10 of 2,195.** Partner dancing lives in a
  vanishingly small corner of what hands could mechanically be doing.

## The catalog (10 grips, 10 distinct cells)

| Grip | Kinematic pair | One line |
|---|---|---|
| Handshake | spherical pair, friction preload | the all-rounder: leads everything a little, locks nothing |
| Cross/pistol grip | revolute about the grip axis | built-in swivel; pull and push stay live |
| Loose palm clasp | spherical pair, light preload | tension and frame, no usable torque |
| Fingertip hold | ball joint on a string | pure tension telegraph |
| Hook grip | open chain link | hang your weight without squeezing |
| Cup/sandwich | clamped planar pair | press and steer; nothing to pull on |
| Hand-on-top | flat-on-flat contact | weight cues only; presence without commitment |
| Interlaced fingers | rigid (zero-DOF) pair | everything leads, nothing turns |
| Wrist hold | cylindrical pair (collar on shaft) | control the arm, not the hand |
| Forearm/double-wrist | two collars, mutually caged | the handshake you can't fumble |

Fun structural fact the model surfaced: **wrist hold and forearm hold are the
same machine** — identical motion states, identical force channels — differing
*only* in release mode. The functional difference every dancer feels (one is
escapable, one is a negotiation) lives entirely in that one coordinate.

## The payoff: moves as requirements

Six canonical moves defined purely as predicates on the grip (`src/moves.ts`),
matrix derived by code, never hand-written:

```
             underarmTurn  hammerlockEntry  dipSupport  redirection  freeSpinRegrip  weightShareLean
handshake    yes           yes              yes         yes          yes             yes
pistol       yes           yes              yes         yes          yes             yes
looseClasp   yes           yes              .           yes          yes             yes
fingertip    yes           yes              .           yes          yes             .
hook         yes           yes              .           yes          yes             yes
cup          .             .                yes         .            yes             .
handOnTop    .             .                .           .            yes             .
interlaced   .             .                yes         yes          .               yes
wristHold    .             .                yes         yes          yes             yes
forearmHold  .             .                yes         yes          .               yes
```

Headlines:

1. **The handshake is the universal adapter (6/6), and the model says why:**
   every axis `resisted`, every channel usable. Friction is the magic — it
   transmits *up to a threshold* and slips past it, so nothing is ever
   forbidden, just effortful. The pistol grip ties it by trading forearm-roll
   torque (which no move here needs) for a clean swivel.
2. **A clean two-regime split.** Friction grips (handshake family) own the
   rotation moves; form-closed grips (interlaced, wrist, forearm) own the
   load-bearing moves and *cannot do turns at all* — every turning move dies
   on a locked vertical axis. Turn-richness and load-bearing trade off through
   closure regime.
3. **Hand-on-top is barely a grip (1/6)** — and that's its job. It transmits
   weight and nothing else; ballroom keeps it because the real connection
   lives in the frame, and the hand is just where the frame is parked.
4. **Empty cells are legion (2,185 consistent, unoccupied).** Nameable ones:
   the **hinge grip** (free about vertical, welded elsewhere — underarm turns
   on rails; hands can't build it, a swivel-bearing grip aid could); the
   **trombone grip** (a prismatic pair — rotationally welded, slides freely;
   dance never uses it because we lead distance through exactly the pull/push
   channel it deletes); the **torque-only clamp** (steer your partner's wrist
   orientation but never move them through space — leading pure shape, not
   travel). Whether these are undiscovered vocabulary or correctly rejected
   junk is exactly the kind of question this method is for.

## Honest idealizations

- **Grips are continuously modulated.** Real dancers slide along the
  free–resisted–locked spectrum within a single phrase — a handshake firms up
  for the dip and melts for the turn. The ternary states are keyframes, not
  the film.
- **Friction is graded, not ternary,** and "usable for leading" is a threshold
  judgment on a continuum. The loose clasp vs. handshake distinction (same
  motion states, different torque flags) is real but its boundary is fuzzy.
- **Wrist compliance blurs the axes.** The wrist adds its own ~3 rotational
  DOF in series with the grip; a "locked" grip axis can still feel rotatable
  because the wrist gives. This model isolates the clasp itself.
- **Direction-blind axes.** Each axis is symmetric, but real constraints are
  often one-sided: two interlocked finger-rings block pulling apart yet allow
  pushing together. Our ternary can't say "locked one way, free the other" —
  tension/compression flags recover this for the axial line only. This is why
  the hook grip files as force closure here despite its geometric flavor.
- **Release is really a spectrum of effort and asymmetry** (the wrist-holder
  releases alone; the held dancer can also *yank* free if the grip is loose).
  Two values is a coarse start.

## Hook for the braid/dynamics layer

The sibling session (branch `knot-models`) models positions as tangles and
moves as braid words — *where the arms go in space*. This layer is the gate in
front of it: **a move sequence is executable only if every grip along the way
permits the required rotations and forces.** A braid generator that turns the
follower under the clasped hands needs `rotVert ≠ locked` and live tension at
that clasp; a braid word containing it is dance-legal only for grips whose row
in the compatibility matrix says yes. Eventually: braid word × grip assignment
→ executable / not, computed the same way this matrix is.

## Running it

```
cd hands/kinematics
npm install
npm test      # enumeration + 15 assertions
npm run report  # full catalog, counts, matrix, empty cells
```
