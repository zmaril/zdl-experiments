# HANDOFF — Phase 1 (knot math core) → Phases 2 and 3

Branch `knot-models` contains the complete phase-1 deliverable: a
dependency-free TypeScript knot-theory core in `src/core`, 87 passing tests
(`npm test`), building with plain `tsc` (`npm run build` / `npm run
typecheck`). `master` has the scaffold only. See NOTES.md for project
framing and the npm survey (conclusion: nothing usable exists; everything
here is written from scratch, MIT, no vendored code — KnotFolio is GPL and
was consulted for ideas only).

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
src/model/         phase 2 stub (dance -> formalism mapping)
src/enumerate/     phase 2 stub (position/entanglement enumeration)
web/               phase 3 (empty, .gitkeep)
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
  and their "invariants" are not link invariants. Phase 2 must keep gluing
  patterns planar (or add a boundary-order layer — a good early phase-2
  hardening task).

## What phase 2 should build (src/model + src/enumerate)

- **Model layer**: arms as 4 strands with the 8 boundary labels (the smoke
  test in `tangle.test.ts` sketches the naming), grips = out→in gluings
  after `reverseStrand`, torsos as obstacle strands/components (a hammerlock
  = arm strand wrapped relative to the torso strand — linking number against
  the torso component detects it). Map the blog post's 15 partitions × 2^4
  hammerlock states to tangle constructions; moves as braid words
  (`tangleFromBraid` + `composeTangles` stack like word concatenation).
- **Enumerate layer**: generate candidate positions, close them
  (`closeTangle`), classify with `linkingNumber` / `jonesPolynomial` /
  `simplify`, reconcile counts against the 157-state census.
- Keep NOTES.md's **Future extensions** section alive in whatever the final
  NOTES.md becomes — especially (1) the joint-limits/config-space
  feasibility filter and (2) whole-body orientation (relative torso facing
  as a discrete state the tangle boundary frames / move layer are
  parameterized by). Phase 2's data model should at least not preclude
  either.

## What phase 3 should build (web/)

- Vite app under `web/` (deliberately not scaffolded; nothing in the root
  tsconfig/package.json blocks a nested Vite project). Render diagrams from
  the core types — `toPDCode` + `faces()` give enough combinatorics for a
  planar layout; braid tangles have an obvious strand-grid drawing. Phase 3
  opens the PR.
