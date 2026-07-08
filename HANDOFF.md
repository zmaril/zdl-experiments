# HANDOFF — Phases 1 + 2 (knot math core, dance model, census) → Phase 3

Branch `knot-models` contains the complete phase-1 and phase-2
deliverables: a dependency-free TypeScript knot-theory core in `src/core`,
the dance→formalism model in `src/model`, the census/enumeration layer in
`src/enumerate` (entry: `npm run enumerate`), 128 passing tests
(`npm test`), building with plain `tsc` (`npm run build` / `npm run
typecheck`). `master` has the scaffold only. See NOTES.md for project
framing, the census reconstruction (all six blog counts reproduced;
"impossible" rule documented as a guess), the refinement findings, and the
npm survey (conclusion: nothing usable exists; everything here is written
from scratch, MIT, no vendored code — KnotFolio is GPL and was consulted
for ideas only).

## What exists

```
src/core/
  laurent.ts       exact Laurent polynomials (bigint coefficients)
  diagram.ts       oriented planar diagrams, PD codes, faces, linking number
  bracket.ts       Kauffman bracket -> Jones polynomial
  reidemeister.ts  R1/R2/R3 moves + bounded simplification
  braid.ts         braid words, word problem (bounded), braid closure
  tangle.ts        labeled-boundary tangles: compose, close, reverse strand
  index.ts         re-exports everything
src/model/
  partitions.ts    the 15 hand partitions (Bell enumeration + names)
  census.ts        240 candidates -> 6 categories, 157 feasible (blog counts)
  tangles.ts       census cell -> tangle: torso bars, chains, hammerlock wraps
  positions.ts     named positions (open, handshake, crossed, hammerlock, cuddle)
  moves.ts         moves as braid words on the four arms + word-problem helpers
src/enumerate/
  invariants.ts    fingerprints: linking sums + Jones of canonical closure
  refine.ts        per-cell/per-partition refinement, [lower, upper] brackets
  run.ts           npm run enumerate: summary + results/enumeration.json
web/               phase 3 (empty, .gitkeep)
results/enumeration.json   full machine-readable census + refinement table
```

Tests are colocated (`src/core/*.test.ts`, vitest) and double as usage
examples; `tangle.test.ts` ends with a dance-shaped smoke test (four arms,
eight endpoints, handshake grip).

## Core API surface

### Laurent polynomials (`laurent.ts`)
```ts
class Laurent {
  static ZERO; static ONE;
  static monomial(coeff: bigint|number, exp: number): Laurent;
  static fromTerms(pairs: Iterable<[number, bigint|number]>): Laurent;
  add/sub/mul(other): Laurent;  neg(): Laurent;  pow(k: number): Laurent;
  equals(other): boolean;  isZero(): boolean;
  substitutePower(k): Laurent;      // x -> x^k; k = -1 is the mirror map
  rescaleExponents(d): Laurent;     // divide exps by d, throws if impossible
  termList(): [exp, coeff][];  coefficient(exp): bigint;
  toString(variable = 't', expDenominator = 1): string;
}
```

### Diagrams (`diagram.ts`)
```ts
type Edge = number;
interface Crossing { underIn; underOut; overIn; overOut: Edge; sign: 1|-1 }
interface Diagram  { crossings: Crossing[]; freeLoops: number }
UNKNOT_DIAGRAM: Diagram;
validateDiagram(d): void;                    // throws on structural errors
writhe(d): number;
edgeComponents(d): { component: Map<Edge, number>; count: number };
componentCount(d): number;                   // includes freeLoops
linkingNumber(d): number;                    // exactly-2-component links
toPDCode(d): [a,b,c,d][];                    // CCW from incoming under-edge
fromPDCode(tuples): Diagram;                 // KnotAtlas convention; knots only
faces(d): Dart[][];  faceEdges(d, face): Edge[];
ccwSlots(c) / ccwEdges(c);                   // PD tuple order of a crossing
spliceEdges(crossings, unions, extraOcc?);   // shared gluing/removal engine
```
Orientation convention: `sign = +1` iff rotating the over-strand direction
90° counterclockwise gives the under-strand direction. `Diagram` is
*oriented PD data*: converters `toPDCode`/`fromPDCode` bridge to classical
notation.

### Bracket / Jones (`bracket.ts`)
```ts
LOOP_VALUE: Laurent;                              // delta = -A^2 - A^-2
kauffmanBracket(d, {maxCrossings=20}?): Laurent;  // in A, <unknot> = 1
jonesPolynomial(d, opts?): Laurent;               // in q = t^(1/4)
jonesInT(d, opts?): Laurent;                      // integer powers of t (knots)
```
Calibration pinned by tests: positive kink ⇒ bracket −A³; left trefoil ⇒
−t⁻⁴+t⁻³+t⁻¹; figure-eight ⇒ t⁻²−t⁻¹+1−t+t²; positive Hopf ⇒ −t^½−t^(5/2).

### Reidemeister (`reidemeister.ts`)
```ts
detectR1(d): number[];            applyR1(d, ci): Diagram;
addKink(d, edge, sign): Diagram;  // inverse R1
detectR2(d): R2Site[];            applyR2(d, site): Diagram;
detectR3(d): R3Site[];            applyR3(d, site): Diagram;
reduceR1R2(d): Diagram;           // greedy reducing moves only
simplify(d, {r3Depth=3}?): Diagram;
```

### Braids (`braid.ts`)
```ts
interface Braid { strands: number; word: number[] }  // letters ±i = σ_i^±1
braid(strands, word); concatBraids(a,b); inverseBraid(b);
freeReduce(word): number[];
braidPermutation(b): number[];    // p[start] = end, 0-based positions
exponentSum(b): number;
braidEqual(a, b, {maxStates=50000}?): boolean | 'unknown';
braidClosure(b): Diagram;         // σ_i is a positive crossing
```

### Tangles (`tangle.ts`)
```ts
interface BoundaryPoint { label: string; edge: Edge; dir: 'in'|'out' }
interface Tangle { crossings: Crossing[]; freeLoops: number;
                   boundary: BoundaryPoint[] }
validateTangle(t): void;
trivialTangle(strands: [from,to][]): Tangle;
tangleFromBraid(b, bottomPrefix='b', topPrefix='t'): Tangle;
mapLabels(t, fn): Tangle;
reverseStrand(t, label): Tangle;  // flips endpoint dirs + crossing signs
composeTangles(t1, t2, gluing: [label1,label2][]): Tangle;
closeTangle(t, pairs: [labelA,labelB][]): Diagram;
```

## Design decisions

- **Oriented crossings with named slots + explicit sign** instead of raw PD
  tuples: harder to misuse, orientation is needed for writhe/linking anyway,
  and the classical tuple order is recoverable (`ccwEdges`). The planar
  embedding (rotation system) is implied by sign + slot order; `faces()`
  materializes it.
- **Exact arithmetic everywhere** (bigint coefficients, integer exponents in
  q = t^(1/4)). No floats anywhere in the math.
- **One splicing engine.** R1/R2 removal, braid closure, tangle
  composition/closure all reduce to "merge these edge pairs, count orphaned
  classes as new free loops" (`spliceEdges`), which keeps the fiddly
  free-loop bookkeeping in one tested place.
- **Strand orientation is load-bearing in tangles.** Gluing requires
  out→in; `reverseStrand` exists precisely because dance grips join two
  hand-ends of shoulder→hand oriented arms (out+out). Reversal flips the
  signs of crossings the strand meets once — tests pin this via plat
  closures.

## Known limitations (all documented in-source too)

- `kauffmanBracket` is a 2^n state sum; guarded at 20 crossings by default.
  Fine for this project's diagram sizes.
- `simplify` is a greedy/bounded heuristic, NOT an equivalence decision
  procedure; failure to simplify proves nothing. Use invariants to separate
  positions.
- `braidEqual` returns 'unknown' when its length-nonincreasing rewrite
  search is exhausted; complete solutions need Garside/handle reduction
  (a candidate phase-2+ improvement if needed).
- `fromPDCode` infers over-strand orientation from label adjacency, so it
  only accepts single-component (knot) PD codes in KnotAtlas numbering.
  Links are built directly or via braids/tangles.
- `Tangle` does not store a cyclic boundary order, so it cannot reject
  non-planar gluings; closures of non-planar gluings are virtual diagrams
  and their "invariants" are not link invariants. Phase 2 keeps gluing
  patterns planar by construction: positions are built braid-style with
  caps consuming adjacent top ends, and closures pair boundary points
  non-crossingly (chains close separately when nested, concatenated when
  interleaved). Any new closure patterns must preserve this discipline.

## Phase-2 model API (what phase 3 renders from)

Everything below re-exports through `src/model/index.ts` and
`src/enumerate/index.ts`.

```ts
// partitions.ts
ALL_PARTITIONS: PartitionInfo[]            // the 15, with ids + dance names
partitionById(id)                          // e.g. 'LL.FR|LR.FL'
// census.ts
allCandidateStates(): CandidateState[]     // 240, each with .category
censusCounts()                             // 23/45/15/70/56/31, feasible 157
feasibleStates()                           // the 157
// tangles.ts  — the viz-facing construction
planPosition({partition, hammerlocks})     // -> {ok, plan} | {ok:false, reason}
variantSpace(plan) / lockedVariants(plan)  // over/under + twist choices
buildPositionTangle(plan, variant): BuiltPosition
closePosition(built): Diagram              // canonical closure for invariants
stringLinkingSums(built)                   // chain/torso linking data
// positions.ts
NAMED_POSITIONS / buildNamedPosition(id)   // 'open-two-hand', 'handshake',
                                           // 'crossed-two-hand',
                                           // 'hammerlock-follower',
                                           // 'cuddle-sweetheart', ...
// moves.ts
MOVES / movesBraid(ids) / sequenceUnwinds(ids) / sequencesEqual(a, b)
// enumerate
fingerprint(built) / fingerprintKey(fp)
refineAll(): { summary, cells }            // the whole census table
```

**`BuiltPosition` is the render contract.** It contains everything a
drawing needs, in braid-grid form:

- `plan.strands` — bottom boundary order, e.g. `['LT','LR','FL','FT']`
  (torso bars at the outside; only gripped arms carry strands);
- `word` — braid letters bottom-to-top (core convention: letter ±i crosses
  the strands at positions i−1, i; positive = left strand in front), which
  gives every crossing's position AND over/under directly;
- `plan.chains` — which hand pairs are fused at the top (draw a grip cap
  joining the two strand tops), plus each chain's `zone`
  (front / behindLeader / behindFollower) for placing the grip point;
- `plan.geometricHammerlocks` — free hammerlocked hands (no strand; draw
  the arm posed behind the back, no topology);
- `closurePairs` — how arms/torsos close up when the invariant view wants
  full loops;
- `tangle` — the underlying labeled-boundary tangle if the viz prefers
  PD-style layout (`toPDCode` + `faces()` in core).

So: **given a position id** (a named position, or any census cell via
`planPosition` + a variant), **the model returns strand geometry**: strand
order, crossing list with over/under, grip caps, torso bars. A strand-grid
drawing (x = strand position, y = word index) is enough; no planar
embedding solver needed.

## What phase 3 should build (web/)

- Vite app under `web/` (deliberately not scaffolded; nothing in the root
  tsconfig/package.json blocks a nested Vite project). Phase 3 opens the PR.
- Two stylized facing dancers; torso bars drawn as the bodies; arm tubes
  following the braid-grid strand paths with over/under gaps at crossings
  (sign of the braid letter = which tube is in front).
- Position picker: the 15 partitions (`ALL_PARTITIONS`), then hammerlock
  states (`feasibleStates()` filtered by partition), then entanglement
  variants (`lockedVariants`) — mirroring the census → refinement drill-down
  in `results/enumeration.json`. Named positions as presets.
- Flag rather than draw the out-of-frame cells: multi-grip (3+/4-hand
  grips) and back-to-back double hammerlocks (`planPosition` returns the
  reason).
- Optional: move player — apply a move word (`MOVES`), animate the braid
  concatenation, show `sequenceUnwinds` verdicts.

## Notes for later phases

- Keep NOTES.md's **Future extensions** section alive — especially (1) the
  joint-limits/config-space feasibility filter and (2) whole-body
  orientation. Phase 2 sharpened both: the 30 back-to-back cells and the
  cuddle-vs-double-hammerlock ambiguity are exactly orientation states.
- The census "impossible" rule is a documented reconstruction
  (`src/model/census.ts`); if the blog's actual classifier ever surfaces,
  reconcile there and re-pin the tests.
