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
and not packaged for npm. We take *ideas* from it (PD-code-centric design,
state-sum bracket computation, greedy Reidemeister simplification) but vendor
**no code**, both for license hygiene (this repo is MIT) and because we need a
typed library API, not an app.

Decision: implement the core from scratch in TypeScript (`src/core`), exact
integer (bigint) coefficients throughout, no runtime dependencies.

## Layout

- `src/core` — knot math: Laurent polynomials, planar diagrams (oriented PD),
  Reidemeister moves, Kauffman bracket → Jones, linking number, braid words +
  closure, tangles with labeled boundary. Phase 1.
- `src/model` — dance → formalism mapping (hands/arms/torsos → strands,
  grips → gluings, moves → braid words). Phase 2.
- `src/enumerate` — enumeration of positions/entanglement classes, reconciling
  with the 157-state census. Phase 2.
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

## Section stubs

### Tangle formalism for positions (phase 2)
TODO: fix the boundary labeling convention for the 8 arm endpoints; map the 15
partitions × hammerlock states to gluing patterns; torso obstacle strands.

### Braid formalism for moves (phase 2)
TODO: catalog of basic moves as braid words; which strand index is which arm;
when moves commute.

### Link invariants of closed positions (phase 2)
TODO: closure conventions (arm+torso loops); which invariants separate which
positions; table of invariants for the 157 states.

### Visualization (phase 3)
TODO: web app under `web/`; render diagrams from PD codes; interactive moves.
