# Grips as mini-tangles

Research notes on modeling the grip itself — what two hands actually do to
each other — as a small tangle, one level below the arm-scale models in this
repository.

## Why zoom in on the grip

Maril's "A New Kind of Dance Science" (zacksdancelab.com) classifies
two-dancer hand connections as set partitions of the four hands: Bell number
B(4) = 15 holds. The arm-level work in this repository refines that with
knot theory: arms become strands of a tangle, and each hand connection is
abstracted to a "symmetric fusion" of strand endpoints — a black box where
two strands are declared joined.

These notes open the black box. A handshake, a hook grip, and interlaced
fingers are all "the same" at the partition level (two hands in one block)
and the same at the arm level (one fusion point). But dancers know they are
different: they transmit force differently, they fail differently, and you
can transition between some of them without letting go. The claim developed
here is that the difference is, in large part, *small-scale topology*, and
that it can be modeled with the same tangle tools used at arm scale — just
miniaturized.

## The model

### Objects

- **Palm bar.** Each hand, minus its digits, is modeled as a rigid segment —
  a bar that strands can pass in front of or behind, but never through.
  In diagrams the two bars are parallel chords of a disk (bar A below,
  bar B above). One end of each bar continues out of the disk into the
  wrist/forearm; that end is the interface to the arm-level model.
- **Digit strands.** Each hand contributes 5 short strands anchored at
  knuckle points along its bar: four fingers plus a distinguished thumb.
  Strands exit the knuckles on the palm side (the side facing the other
  hand).
- **Zones.** The bars cut the diagram into three regions: behind hand A
  (zone 0), the palm corridor between the hands (zone 1), and behind hand B
  (zone 2). Crossing a bar in the diagram means passing in front of
  (**over**) or behind (**under**) that hand — never through it.
- **Fingertips.** A strand ends either **free** (a loose fingertip) or
  **attached** — pressed against one of the two bars, on its palm side or
  its back side. Attachment is the model of "held": the fingertip contact
  point is treated as a temporary fixed point.

A **grip** is such a diagram; two grips are **equivalent** when one can be
isotoped to the other *rel the palm bars, knuckles, and attachment points*
(bars are fixed obstacles; strand endpoints do not move).

### The encoding

`src/model.ts` implements a Gauss-code variant: each strand is a sequence of
events — wall crossings `(bar, over/under)` and strand-strand crossings
`(shared label, over/under, sign)` — plus an end marker (`free` or
`attach(bar, side)`). Zone bookkeeping validates that a code is physically
coherent (e.g. a strand cannot cross bar B from behind hand A).

### What makes a grip nontrivial — an honest accounting

A strand with a free tip can **always** be fully retracted: nothing pins a
loose end, so the tip can be pulled back along the strand's own path,
undoing every crossing it participates in. This is a theorem of the model,
implemented as the retraction normalization and exercised in tests. The
consequence is stark and physically right:

> **A grip that is not held is not a grip.** All topological content lives
> in the strands whose fingertips are pressed against something.

Three modeling decisions make the remaining content well-defined; each is a
simplification and worth stating plainly:

1. **Fingertip contact = attachment.** A "held tight" grip is modeled by
   fixing each pressing fingertip to a point on a bar. Releasing a
   fingertip is *not* a move of the calculus — it is leaving the category.
   Physically: the classification is of grips as they are held; slipping
   out is a different (dynamic, force-dependent) question.
2. **Bars span the disk ("wide palm / snug loop").** A closed finger loop
   around a bar cannot slide off the bar's end inside the diagram. The
   justification: a real palm is wide, and a snugly held finger loop cannot
   open wider than the hand to escape sideways. A loosely held loop can —
   but loose loops have free tips and retract anyway.
3. **Positions along the bars are abstracted away (v1).** The model records
   *that* a strand crosses or attaches to a bar and on which side, not
   *where along the bar* relative to the knuckle slots. See "what
   interlacing is made of" below for the price paid.

Only bar-attachments are modeled: a fingertip pressed against another
finger (tip-to-tip holds, half-curled hooks) is approximated by the nearest
bar attachment. This is the v1 analogue of the arm model's deferred
"symmetric fusion" — smaller, but still a simplification.

### Invariants (the sound part)

Two quantities are genuine isotopy invariants and do the classification
work (`src/invariants.ts`):

- **Homotopy word.** The complement of two rigid rods has free fundamental
  group F₂ = ⟨a, b⟩ (meridians of the two bars). Each attached strand,
  as a path with fixed endpoints, has a well-defined class: read off the
  strand's *under*-crossings with the bars, signed by direction, and
  freely reduce. The word says how the finger *wraps the hands*.
- **Pairwise crossing sums.** For each pair of attached strands, the sum of
  the signs of their mutual crossings — a relative linking number. It says
  how fingers *wrap each other*.

Together with the boundary data (which digit attaches to which bar, which
side), these form the **signature**. Signatures are provably invariant
under all implemented moves (tested), so *different signature ⇒ different
grip* is sound. The converse is not: the signature does not see knotted
single strands or Borromean-style higher linking — patterns that need more
crossings than short fingers can produce (see feasibility), but this is a
believed-not-proved completeness at small sizes.

### Moves and equivalence checking (the best-effort part)

`src/moves.ts` implements Reidemeister-style rewrites valid rel the bars:
kink removal (R1), cancelling strand pairs (R2), same-side double bar
crossings (R2-wall: a poke across a bar that comes straight back), slides
(R3 and R3-wall), and their crossing-increasing inverses for a bounded
brute-force search (`src/simplify.ts`). Caveats, stated honestly:

- Gauss codes cannot verify planar realizability of an insertion site, so
  the complicating moves are generated liberally ("virtual" slop).
- The move set is not proven complete for this tangle category.
- Therefore: **negative answers come from signatures (sound); positive
  answers come from the bounded search meeting in the middle; everything
  else is reported "unknown".**

At the sizes that occur in real grips (a handful of crossings) the search
comfortably undoes injected noise (tested: a handshake with a kink and a
bar-poke added simplifies back to the handshake).

### Feasibility: fingers are short

A finger can curl roughly one full turn around a bar or another finger —
no more. Model: each strand may carry at most `MAX_CURL` crossings
(wall + strand crossings combined). `MAX_CURL = 3` is the default
(a full wrap around a bar costs 2 wall crossings; budget 3 = one wrap plus
an approach; a double wrap costs 4 and is excluded). The bound is a
parameter everywhere it is used, and the enumeration reports counts with
and without it. A pleasant corollary: the feasibility bound alone rules out
knotted fingers — an overhand knot needs ≥ 3 self-crossings plus the length
to close it. You cannot tie your finger in a knot; now there's a bound
that says so.

## Enumeration: how many grips are there?

Classes are enumerated at invariant resolution (`src/enumerate.ts`):
an attached strand contributes an **atom** — (attach to own/other bar,
palm/back side, homotopy word written hand-agnostically: `s` = own bar,
`p` = partner's bar) — and each strand pair contributes a crossing sum `k`.
The minimum crossing cost of an atom is computed exactly by shortest path
(each word letter is an under-crossing; zone bookkeeping may force extra
over-crossings); each unit of |k| is one strand-strand crossing.

Configurations counted: one active strand, and two active strands (one per
hand), up to swapping which hand is which. All other digits are loose and
retract. Counts are of classes with total crossing number ≤ n
(crossings = finger–finger + finger–bar):

| n | 1-strand, all | feasible (curl ≤ 3) | feasible (curl ≤ 2) | 2-strand, all | feasible (curl ≤ 3) | feasible (curl ≤ 2) |
|---|---------------|---------------------|---------------------|----------------|---------------------|---------------------|
| 0 | 2   | 2  | 2  | 3   | 3   | 3   |
| 1 | 6   | 6  | 6  | 17  | 17  | 17  |
| 2 | 14  | 14 | 14 | 65  | 65  | 65  |
| 3 | 26  | 26 | 14 | 195 | 195 | 117 |
| 4 | 50  | 26 | 14 | 513 | 363 | 153 |

Reading it like a dancer: with a single pressing finger there are only two
zero-crossing things to do (press your own palm — a fist curl — or press
the partner's palm), six things if the finger may cross something once
(add: press the back of either hand, or hook under either bar), and the
supply of new one-finger ideas dries up fast once fingers can't wrap more
than once — the "feasible" column freezes at 26 while the unconstrained
column keeps growing. Short fingers are a strong editor.

Caveats on the counts: they are at signature resolution (knotted/exotic
patterns excluded — believed empty at these sizes but not proved), slot
positions are abstracted, and realizability of every (atom, atom, k)
combination is assumed (routing detours in a disk makes this plausible at
these sizes; not formally verified).

## Where the named grips land

All six named grips were encoded as explicit diagrams (`src/grips.ts`) and
classified (assertions in `src/test.ts`; full signatures printed by
`npm test`). All six land in distinct classes, and the *reasons* are
pleasingly complementary:

| grip | wraps hands? (words) | wraps fingers? (pair sums) | class summary |
|------|----------------------|---------------------------|----------------|
| fingertip hold | no (all trivial) | no | contact only; the unique 0-crossing named grip |
| handshake | yes: each finger = one partner-bar meridian (`p`) | no | mutual palm wrap |
| hook grip | no — no bar is wrapped at all | yes: opposite fingers Hopf-linked (k = ±2) | mutual thread |
| interlaced fingers | yes: same wraps as handshake | yes: opposite fingers cross once (k = ±1) | wrap + weave |
| thumb wrap | no | yes: thumbs Hopf-linked (k = ±2) | hook grip performed by thumbs |
| cross grip | no (mirror kills the words) | no | chirality partner of the handshake |

Findings worth calling out:

- **Handshake vs hook grip is a clean dichotomy**: the handshake is all
  hand-wrapping and no finger-linking; the hook grip is all finger-linking
  and no hand-wrapping. Two orthogonal ways to be attached.
- **Cross grip is the handshake's mirror image** (encoded literally as
  `mirror(handshake)`): same boundary data, one crossing per finger either
  way, but the invariants tell them apart. Chirality is real and the model
  sees it.
- **Thumb wrap = hook grip up to renaming digits** (asserted via a shape
  signature that forgets digit names) — but a distinct class when the thumb
  is distinguished, which it should be: thumbs oppose.
- **What interlacing is made of** (documented coincidence, asserted in
  tests): drop the finger–finger crossings from the interlaced clasp and it
  becomes *identical* to a mutual handshake wrap in this model. The
  alternating weave itself — which gap each finger occupies — is
  combinatorial boundary data that v1 abstracts away; what survives
  topologically is one crossing per opposite finger pair. Dancer's
  translation: interlacing is mostly *where* your fingers sit, plus a
  little genuine twist; it slides apart the same way a clasp does.

## Candidate grips with no dance name

The enumeration contains feasible classes whose patterns occur in no named
grip (atlas check in `src/report.ts`; existence + unnamedness asserted in
tests). Four curated examples:

- **Threaded ring** (`own/palm:1 & other/palm:1, k = ±1`, 1 crossing):
  one dancer curls a finger into a closed ring against their own palm; the
  partner slides a finger through the ring and presses that dancer's palm.
  A minimal "carabiner" grip — arguably the simplest secure grip that is
  neither a wrap nor a hook.
- **Under-scoop press** (`other/palm:s`, 2 crossings): a finger dives
  behind its *own* palm bar, comes back around in front, and presses the
  partner's palm. The tip lands exactly where a fingertip hold would put
  it, but the finger arrives threaded around its own hand — same contact,
  different class.
- **Underhand wrap** (`other/back:p'`, 3 crossings): the finger passes in
  front of the partner's bar, hooks back underneath from behind, and
  presses the back of their hand from below. The reverse-direction cousin
  of the handshake wrap — neither the handshake nor its mirror.
- **Braided handshake** (`other/back:p & other/back:p, k = ±2`,
  4 crossings): both dancers hook the other's palm as in a handshake, and
  the two hooking fingers also wrap once around each other on the way. A
  handshake with a twist braided into it; each finger uses its full curl
  budget.

At total crossing number ≤ 3 there are 183 feasible two-strand patterns
outside the named atlas (count printed by `npm run report`); the four
above were chosen for being performable on the first try.

## The composition story (tangles within tangles)

The arm-level model in this repository treats a position as a tangle of
four arm strands whose hand-connections are "symmetric fusion" points — an
admitted abstraction. Grip-tangles are the content of that abstraction:

- A grip-tangle lives in a disk whose boundary carries two distinguished
  points: the **wrist ends of the two palm bars**. That pair of points is
  the grip's *interface type*.
- An arm-level position is a tangle with fusion vertices. **Operadic
  composition**: plug a grip-tangle disk into each fusion vertex, gluing
  each arm strand to a wrist end, where it thickens into a palm bar and
  sprouts five digit strands. The result is a single (finer-grained)
  tangle: tangles within tangles.
- Equivalence is intended to be computed level by level: arm-scale isotopy
  may move a grip disk rigidly but cannot reach inside it; grip-scale
  isotopy happens rel the disk boundary. This matches dance practice —
  changing the grip and moving through space are different actions — but
  proving the two-level quotient equals the honest one-level quotient
  (nothing is gained by isotopies that mix scales) is an open question
  below.
- The partition model's blocks of 3 or 4 hands (present among Maril's 15
  holds) correspond to grip disks with 3 or 4 palm bars; the formalism
  generalizes directly (the invariant group becomes F₃/F₄), though only
  the 2-bar case is implemented.

This replaces the arm model's deferred fusion abstraction with a concrete,
typed gadget: **a hold = a partition block = a fusion point = a grip-tangle
plugged in at that point.**

## Open questions

- **Chirality systematically.** Mirror classes come in pairs (handshake /
  cross grip). Which feasible classes are amphichiral? Does handedness
  correlate with which dance holds feel "same-side" vs "crossed"?
- **Slot positions (v2).** Restore where along the bar each crossing and
  attachment sits, with a slide move that pays a crossing when passing an
  anchored digit. That would distinguish weaves properly (interlaced
  fingers vs mutual wrap) and let "between which fingers" become part of
  the classification.
- **Finger-to-finger attachment.** Tips pressing fingers rather than palms
  (true tip-to-tip holds, half-curled hooks) need attachment points on
  strands, which makes the diagram category richer (vertices on strands).
- **Comfort and force.** Feasibility here is purely length/curl. Real
  grips are also constrained by joint direction (fingers curl one way),
  opposition (thumb vs fingers), and pain. A comfort functional on classes
  would prune the candidate list toward danceable suggestions.
- **Dynamics.** Transitions between grips are paths that release some
  attachments and create others — morphisms in a category whose objects
  are grip classes. Which named grips are adjacent (one release + one
  press apart)? The handshake → interlaced transition suggests weave moves
  have low cost; the model could make "grip choreography" searchable.
- **Two-level quotient.** Prove (or refute) that arm-scale + grip-scale
  equivalence rel interfaces equals plain isotopy of the composed diagram.
- **Completeness at small n.** Verify by exhaustive search over honest
  planar diagrams (not Gauss codes) that the signature is a complete
  invariant for feasible grips with n ≤ 4 crossings.

## Running

```
cd hands/tangles
npm install   # dev-only: typescript + @types/node for `npm run typecheck`
npm test      # assertions + enumeration report (plain node >= 22.18, no build step)
npm run report
```

No runtime dependencies; nothing here imports from, or depends on, the
arm-level code elsewhere in this repository.
