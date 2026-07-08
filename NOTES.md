# zdl-experiments: Knot Theory for Partner Dance Connections

## Project intro

Zack Maril's ["A New Kind of Dance Science"](https://www.zacksdancelab.com/blog/a-new-kind-of-dance-science)
models two-dancer hand connections as **set partitions** of the four hands
{leader-left, leader-right, follower-left, follower-right}: Bell number B(4) = 15
partition classes, times 2^4 hammerlock (arm-behind-back) states per arm = 240
candidate positions, filtered down to 157 physically feasible states (70 stable,
56 mixed, 31 transition; the rest impossible/weird/boring).

That model deliberately ignores *how* the connections sit in space: crossed vs
straight arms, which arm passes over or under which, wraps behind the back.
Two positions with identical partition + hammerlock data can be topologically
distinct (you cannot move between them without breaking a grip).

This project recovers that entanglement data with knot theory, in three formalisms:

1. **Tangles** — each arm is an open strand: 4 strands, 8 boundary points
   (shoulders and hands). Shoulders are fixed to the torsos; grips fuse
   hand-endpoints together. Positions are tangles up to isotopy rel boundary.
2. **Braids** — dance moves (turns, passes) are words in braid generators;
   composing moves is concatenation; "same position" is the braid word problem.
3. **Links** — close arms + torsos into loops and compute classical invariants
   (linking number, Kauffman bracket / Jones polynomial) to *prove* two
   positions are inequivalent.

**Torsos as obstacles**: torsos are modeled as thick vertical bars / extra
fixed strands that arms cannot pass through. That is exactly what makes a
hammerlock (arm behind the back) topologically distinct from the same grip in
front: relative to the torso strand, the arm is wrapped. In the tangle/link
picture the torso becomes an extra closed component (or fixed strand pair) and
wrapping shows up in linking numbers / bracket polynomials.

## npm survey (2026-07-08, ~15 min)

Searched npm for: `knot-theory`, `knot`, `braid group`, `braid-group`,
`jones polynomial`, `kauffman`, `reidemeister`, `tangle`, `knotfolio`.

**Conclusion: nothing usable exists on npm.** Everything returned is
name-collision noise: `knot.js` (event emitter), `braid-design-system` /
`braid-ui` (React UI kits), `@tangle-network/*` (blockchain tooling),
polynomial packages that are numeric/ML (floating point, single-variable
calculus), not exact Laurent polynomial arithmetic. No package provides PD
codes, Reidemeister moves, bracket/Jones computation, or braid words.

**Closest prior art: [KnotFolio](https://github.com/kmill/knotfolio)** by Kyle
Miller — an in-browser JavaScript app for drawing/identifying knot diagrams
(PD codes, invariants, KnotInfo/LinkInfo lookup). It is **GPL-2.0-or-later**
and not packaged for npm. Ideas were taken from it (PD-code-centric design,
state-sum bracket computation, greedy Reidemeister simplification) but **no
code is vendored**, both for license hygiene (this repo is MIT) and because
the project needs a typed library API, not an app.

Decision: implement the core from scratch in TypeScript (`src/core`), exact
integer (bigint) coefficients throughout, no runtime dependencies.

## Layout

- `src/core` — knot math: Laurent polynomials, planar diagrams (oriented PD),
  Reidemeister moves, Kauffman bracket → Jones, linking number, braid words +
  closure, tangles with labeled boundary. Phase 1 (done).
- `src/model` — dance → formalism mapping: partitions, the reconstructed
  census, position → tangle construction, named positions, moves as braid
  words. Phase 2 (done).
- `src/enumerate` — enumeration of positions/entanglement classes and the
  reconciliation with the 157-state census; `npm run enumerate` prints the
  summary and writes `results/enumeration.json`. Phase 2 (done).
- `web/` — visualization app (Vite). Phase 3.

## Design decisions (core)

See HANDOFF.md (on the `knot-models` branch) for the full API. Highlights:

- **Oriented diagrams.** Crossings store `underIn/underOut/overIn/overOut`
  edge ids plus an explicit `sign` (+1/−1). This is equivalent to oriented PD
  codes (converters provided) but harder to misuse. Orientation is needed for
  writhe (Jones normalization) and linking number anyway.
- **Exact arithmetic.** Laurent polynomials in one variable with `bigint`
  coefficients; Jones is computed in the variable q = t^(1/4) and rescaled to
  integer powers of t when possible.
- **Honest bounds.** The bracket is a 2^n state sum (fine for the ≤ ~16
  crossing diagrams this project needs; guarded). Reidemeister
  simplification is greedy R1/R2 reduction with optional bounded R3 search —
  it is *not* a decision procedure for knot equivalence. The braid word
  problem solver is exact for negatives it can certify (permutation /
  exponent-sum / invariant mismatch) and for positives found by bounded
  rewriting search; otherwise it answers `"unknown"`.

## The census, reproduced (and where the reconstruction had to guess)

The blog post's Python classifier is not published, so `src/model/census.ts`
is a reconstruction. Five of the six categories follow the post's own
definitions verbatim and involve no guessing:

- **boring** — no arm hammerlocked (15 states: one per partition);
- **weird** — a block that is exactly two hands of one dancer ("somebody
  holding just their own hands"), among states with at least one hammerlock
  (3 partitions × 15 = 45);
- **stable / transition / mixed** — every / no / some hammerlocked hand(s)
  connected to the other dancer's hand.

With those fixed, the base counts come out stable 85, mixed 64, transition
31 — so the unspecified **impossible** rule (the post only says "a person's
hand needs to be in two places at once") must remove exactly 15
stable-classified and 8 mixed-classified states, none from transition. The
rule adopted here:

> a state is impossible iff some block contains BOTH hands of one dancer,
> BOTH hammerlocked.

Reading: a hammerlocked left hand sits behind the back near the right hip, a
hammerlocked right hand near the left hip; one grip point cannot be in both
places, so a hand would need to be in two places at once. This is the unique
single natural predicate (from a searched catalog of block- and person-level
candidates) matching the published counts, and with it all six numbers come
out exactly: **impossible 23, weird 45, boring 15, stable 70, mixed 56,
transition 31** — 157 feasible. Two honesty notes:

- the six counts alone do **not** determine the rule uniquely (an exhaustive
  search over block-signature rules finds thousands of matching predicates);
  this one is the simplest with a physical reading, but it remains a guess;
- precedence matters: weird is checked before impossible, otherwise
  "leader holds his own hands, both hammerlocked" would be double-counted
  and impossible would exceed 23.

Notably, "back-to-back" states — a two-hand grip whose two ends are both
hammerlocked, one behind each dancer's back — are *feasible* under this
rule (the post's stable count requires it). They are physically real, but
only for non-facing orientations; see the frame limits below.

## From holds to tangles

`src/model/tangles.ts` maps a census cell (partition + hammerlocks) to a
tangle in a fixed frame:

- Strands run bottom-to-top, braid style, in the canonical left-to-right
  order **[LT, LL, LR, FL, FR, FT]** (leader torso, leader arms, follower
  arms, follower torso).
- **Torso bars** LT and FT run floor to ceiling: obstacle strands with both
  ends fixed. Arms can never pass through a torso — and because the bar is
  extended to floor and ceiling, they cannot pass over the head or under the
  feet either. (That is a deliberate modeling choice: it is what makes wraps
  and hammerlocks *topological*. Real dancers escape wraps by passing joined
  hands over the head; in this model that escape is a move that must be
  granted explicitly, not an isotopy.)
- **Grips fuse hands**: a two-hand grip turns its two arms into one "chain"
  strand running shoulder-to-shoulder. The strand order makes crossing
  parity match dance reality: the open two-hand hold (LL–FR, LR–FL) needs
  zero crossings, the crossed two-hand hold (LL–FL, LR–FR) an odd number.
- **Hammerlocked grips** live behind the owner's torso bar: the chain
  crosses the bar once per flank. Opposite-flank passes enclose the bar —
  chain–torso linking number ±1, a Hopf link in the closure: topologically
  locked. Same-flank passes are removable: a "fake" hammerlock,
  provably equal to the front grip (asserted in tests).
- **Free (ungripped) arms carry no strand.** An unheld arm can always be
  unwound, so its hammerlock bit is geometric data the topology does not
  see. This has a pleasant consequence: the blog's **transition** states
  (every hammerlocked hand unconnected) are exactly the states whose
  hammerlocks are topologically invisible — the topology *explains* why
  they are transitions (nothing holds them in place), while **stable**
  states are exactly the topologically locked ones.

Two kinds of cells are flagged as outside this frame rather than fudged:

- **multi-grip** (57 cells): grips of 3–4 hands make the position a spatial
  *graph* (trivalent vertices), not a link; the link toolkit does not apply.
  Refining these needs spatial-graph invariants (e.g. Yamada polynomial) —
  future work.
- **back-to-back** (30 cells): both ends of one chain hammerlocked puts the
  grip behind two backs at once, impossible while facing; representable only
  with a whole-body-orientation state (see future extensions).

## What each formalism counts, and where they agree

- The **partition census** counts *who holds whom* (+ hammerlock bits):
  15 partitions, 240 candidates, 157 feasible.
- The **tangle layer** counts *entanglement classes within a census cell*:
  positions separated by grip-breaking only.
- The **braid layer** counts *move words up to the braid relations*: what
  sequences of turns/passes do, and when they cancel.

Projection is exact and test-asserted: forget a tangle's entanglement data
and you land on the census cell it was built from; the refined feasible
cells collapse onto exactly the 157 feasible states, and forgetting
hammerlocks collapses onto exactly the 15 partitions. The formalisms
disagree nowhere on the coarse data — the topology strictly refines it.

Headline refinement numbers (`npm run enumerate`), within the stated
crossing bound (≤ 2 crossings per pair of strand objects: the forced
routing crossings with free over/under choices, plus one optional arm-arm
clasp for side-by-side front holds):

| partition | classes | note |
|---|---|---|
| single cross-grips (LL.FL, LL.FR, LR.FL, LR.FR) | 5 each | clean + 2 mirror hammerlocks behind either back |
| open two-hand hold | [75, 99] | crossed/clasped/wrapped variants |
| crossed two-hand hold | [66, 98] | mirror pair distinguished by linking sums |
| self-grips (weird partitions, no hammerlock) | 1–3 | own-hands loops can clasp each other |
| no contact | 1 | all 15 transition cells collapse here |
| 3/4-hand grips | n/a | flagged multi-grip |

Class counts are **brackets [lower, upper]**: the lower bound counts
distinct invariant fingerprints (string-link linking sums between chains
and torsos — a true rel-boundary invariant — plus Jones polynomial and
component count of a canonical closure); the upper bound counts distinct
constructed diagrams. Equal invariants prove nothing, so the truth lies
in between: totals **[167, 223] classes across 298 enumerated diagrams**
over the 85 representable cells. Sample honesty case: the two mirror
variants of the crossed hold have equal Jones (the single crossing dies
under any planar closure) but different linking sums ±1 — proven distinct;
some richer hammerlocked cells stay unresolved inside their brackets.

Findings a dancer can feel:

- **Crossed hold, leader's arms in front vs behind**: genuinely different
  positions; you cannot swap which forearm is on top without releasing.
- **Hammerlock vs handshake**: distinct *because of the torso bar* — every
  nontrivial invariant entry of the hammerlock involves the torso
  component; delete the torso and the arms are an unknotted arc again.
- **Two ways to lock a hammerlock**: the partner can reach around either
  flank; mirror classes, both counted.
- **Cuddle/sweetheart = double hammerlock, topologically**: both chains
  wrapped around the follower's torso. Whether the wrapped grips sit at the
  waist facing out (cuddle) or behind the back facing in (hammerlock) is
  orientation/geometry the topology cannot see — a concrete argument for
  the whole-body-orientation extension below.
- **Transition states are free**: every hammerlock on an unheld hand can be
  walked out of; the census tracks it, the topology confirms there is
  nothing there.

## Moves as braid words

`src/model/moves.ts` gives a small vocabulary on the four arm strands
[LL, LR, FL, FR]: `cross` / `duck` (the inner arms pass each other, σ₂±),
`follower-turn` / `leader-turn` and reverses (full twists σ₃², σ₁²).
Composition is concatenation; "does this sequence unwind?" is the braid
word problem, answered by the bounded solver plus one extra sound negative
certificate (if a·b⁻¹ has a non-unlink Jones closure, a ≠ b). Demos, all
test-asserted: cross+duck unwinds; a lone cross reaches exactly the crossed
hold; turn + reverse-turn unwinds while two same-way turns do not; leader
and follower turns commute with each other but not with crossing the holds.
The braid layer sees arm–arm entanglement only; torso wraps (hammerlocks,
cuddles) live in the tangle layer.

## Future extensions

Two avenues the current scope deliberately excludes; both should survive
into later phases' planning:

1. **Joint-limits / configuration-space feasibility filter.** Topological
   equivalence says which positions are *reachable without breaking grips*,
   not which are *comfortable or anatomically possible*. A future layer
   should filter enumerated entanglement classes by a kinematic feasibility
   model (shoulder/elbow/wrist ranges, arm lengths, torso clearance) — the
   knot-theoretic analogue of the blog post's impossible/weird/feasible
   census, replacing the hand-coded feasibility rules with a configuration-
   space check.
2. **Whole-body orientation.** Dancers can face each other, face away, stand
   side-to-side, etc. Within a single position the shoulders are fixed rel
   boundary, but there is a discrete orientation state — the relative facing
   of the two torsos — that the model should eventually be parameterized by.
   Concretely: tangle boundary points living on rotatable frames (one frame
   per torso, gluing patterns indexed by the frames' relative orientation),
   or an orientation-state layer composed with braid moves for transitions
   (a move can rotate a torso as well as braid the arms). Neither the
   partition model nor the phase-1 core distinguishes closed-position from
   shadow-position variants of the same grip; this extension is what would.
   Phase 2 sharpened the need: the 30 back-to-back cells are exactly the
   feasible states this model cannot represent facing, and the
   cuddle-vs-double-hammerlock ambiguity is exactly an orientation bit.
