# Contact-region combinatorics of a single grip

Research notes. This is a direct methodological heir to the set-partition model
in the ZDL blog post ["A New Kind of Dance
Science"](https://www.zacksdancelab.com/blog/a-new-kind-of-dance-science) —
Maril's result that there are B(4) = 15 ways for two dancers to connect through
hands, extended to 157 feasible positions once hammerlocks are added. The recipe
here is the same one that post used: **enumerate a raw combinatorial space,
filter it by anatomical feasibility, then map named holds in as sanity checks.**
The object being counted is different, and that is the whole point.

## The gap this fills

Maril's model treats "these two hands are connected" as a single **binary**
fact. A handshake and a fingertip touch and a hook grip are all the same edge in
that model: connected or not. But every partner dancer knows those are different
holds — they transmit lead differently, they slip differently, they *feel*
different. The difference is the **shape of the contact**: which parts of one
hand touch which parts of the other.

These notes count that. A grip stops being one bit and becomes a **set of
contact pairs** between anatomical regions of the two hands. The binary
connection was the shadow; this is the object casting it.

Throughout, **hand A = leader's right hand, hand B = follower's left hand** —
the most common social-dance connection. A right hand and a left hand meeting
palm-to-palm align like mirror images, so the *same region name on both hands*
corresponds naturally (thenar meets thenar, index meets index, radial edge meets
radial edge). That mirror correspondence is what makes "is this grip symmetric?"
a well-posed question (below), and it is exactly why the right-to-left hold is
the comfortable default.

## What a grip is, formally

A grip is a **set of contact pairs** `(region of A, region of B)`. With region
sets of sizes `|A|` and `|B|`, there are `|A|·|B|` possible pairs, so the raw
space of grips is every subset of them: `2^(|A|·|B|)`.

Two modeling decisions, argued rather than assumed:

- **Self-contacts excluded.** A curled finger touching its *own* palm (inside a
  fist, or the closed side of a hook) is real, but it is a fact about *one*
  hand's posture, not about the *inter-hand* grip. Folding it in would conflate
  "how is my hand shaped" with "how are our hands connected" — and the latter is
  the quantity that carries lead between two dancers. Posture is better modeled
  as a per-hand precondition (a hand must be *able* to curl to make a hook) than
  as a contact pair. So the pair set is cross-hand only, A-to-B. Named grips
  that *rely* on self-contact for their shape (hook, fist-like holds) still
  appear — we model the inter-hand contacts they produce, and note the posture
  in prose.

- **Empty set excluded from counts.** The empty contact set is exactly Maril's
  "not connected" state — it is the one bit his model already had. Since the
  entire purpose here is to resolve *connected* into its many shapes, the counts
  below are of **non-empty** grips. The empty set is still a legal, feasible
  value in code (it vacuously passes every rule); it is simply subtracted out of
  the reported totals so "number of grips" means "number of ways to actually be
  in contact."

## The two granularities

### Coarse — 6 regions per hand

Chosen so that each region is something a dancer would actually name as a
distinct contact surface, and each carries a distinct grip role:

| region | anatomy | why it's its own region |
|---|---|---|
| `palm` | palmar metacarpal surface (incl. thenar + hypothenar) | the flat driving surface; the defining feature of power/platform holds |
| `dorsum` | back of the hand | opposite face; only surface available in back-to-back or covered holds |
| `thumb` | digit 1, all surfaces | the *opposable* digit — mechanically unlike the fingers, does the clamping |
| `fingers` | digits 2–5, proximal + middle segments | the wrapping bank of digits; what closes around a partner's hand |
| `fingertips` | distal pads of digits 2–5 | the fine-contact surface; a fingertip hold uses *only* these |
| `edge` | radial edge + thumb web, ulnar/blade edge | the perimeter; blade and hook-of-thumb-web contacts live here |

This is the granularity at which explicit enumeration with all feasibility rules
is fully tractable and every named hold maps in with ≤ 6 pairs.

### Fine — 20 regions per hand

A per-phalanx breakdown, for questions the coarse model cannot see (which
*finger* is engaged, proximal vs distal contact):

- palm split into **thenar / palm-center / hypothenar** (the thumb mound, the
  hollow, the heel — they contact independently, e.g. the heel leads while the
  center stays soft);
- **dorsum**;
- **radial edge / ulnar edge** (first-web side vs blade side);
- **thumb**: proximal (metacarpal + proximal phalanx) and distal pad;
- each of **index / middle / ring / pinky**: proximal phalanx, middle phalanx,
  distal pad — 12 finger segments.

Total 3 + 1 + 2 + 2 + 12 = **20**. (Adding the optional wrist makes 21.) The
distal interphalangeal split is dropped as a deliberate simplification — the
distal pad is treated as one contact patch, since dancers do not independently
control the fingernail-side of the last joint.

### Optional wrist

The wrist is *not* part of the hand, but a wrist hold is a real dance grip. It
is handled explicitly as an **optional extra region** (`includeWrist: true`),
kept out of the base counts so the hand model stays a hand model, and switched on
only for the wrist-hold sanity check. This is the honest way to handle "the named
thing lives just outside your region set": name the limitation, then extend the
model on purpose rather than smuggling the wrist into "edge."

## Feasibility rules (the 240→157 move)

Maril went from 240 candidate positions to 157 feasible ones by filtering with
anatomical common sense in code. The same move applies here, and the rules are
kept as four **named, independently toggleable predicates** (`src/rules.ts`) so
the sensitivity of every count to every rule is one boolean flip away.

**R1 — ORIENTATION.** There must exist at least one relative orientation of the
two hands at which *all* the contacts can happen at once. This is the
generalization of the headline exclusion in the task: palm-of-A-on-palm-of-B
requires the hands to face each other; back-of-A-on-back-of-B requires them to
face away; no single orientation does both, so that grip is impossible. The
engine (`src/model.ts`) gives each hand a **facing** toward the partner — palmar
`P`, dorsal `D`, or edge-on `E` — so 9 relative orientations. A rigid region
(palm, dorsum) can only touch when its own surface faces the partner. Perimeter
regions (edges, wrist) present a surface in every orientation. **Mobile** regions
— the digit segments — can contact whenever they are not pointed squarely away,
and, crucially, once engaged they can **wrap** to reach any surface of the
partner hand. That wrap clause is what lets a handshake's fingers reach around to
the partner's *dorsum* while the palms face each other — without it the rule
would wrongly kill the most common grip in dance.

**R2 — OPPOSITE_FACES.** One patch of skin cannot be on both sides of a rigid
slab at once, so a single region may not touch *both* the partner's palm and the
partner's dorsum. The exception is deliberate: at coarse granularity the
`fingers` and `fingertips` regions are *groups* of four ~90 mm digits, and four
long digits genuinely can wrap the ~25–30 mm-thick hand and land on both faces (a
firm handshake). Those multi-digit groups are exempt. At fine granularity every
region is a single patch, so there are no exemptions — the rule bites harder,
correctly.

**R3 — CONNECTED_INTERFACE.** One grip is one pose: its contact patches must form
a *single connected interface*, not two unrelated touch zones that could not
physically co-occur in one hand shape. "Connected" is judged in a graph of 3D
proximity that includes three kinds of adjacency:

- **structural** — regions that border each other on the flat hand;
- **flex** — regions brought together by curling or thumb opposition (every
  fingertip can reach the palm; the thumb pad opposes every fingertip and the
  palm);
- **thickness** — the palm and the dorsum are opposite faces but only ~30 mm
  apart in space, so a contact on one face is "near" a contact on the other.

Those last two edge types are load-bearing for *not over-filtering*. They are
what keep the two trickiest real grips alive:

- **Pinch** (thumb on partner's palm + fingertips on partner's dorsum) stays
  connected through thumb–fingertip opposition and the palm–dorsum thickness
  edge.
- **Mutual C-grip** (A's fingertips in B's palm *and* B's fingertips in A's
  palm) — the case the task explicitly flags — stays connected through the
  fingertip–palm curl edges. It is feasible, and the tests assert it, as a guard
  against an over-eager connectivity rule.

R3 is **not monotone** (adding a pair can *connect* a previously disconnected
set), so it is checked per candidate set rather than used to prune.

**R4 — SMALL_REGION_SPAN.** A small contact patch can only nestle against so many
partner regions at once. The thumb and the fingertip pads (and, at fine
granularity, each distal pad) are capped at 3 partner regions coarse / 4 fine.
This is a soft scale constraint; it has the least bite of the four (see below).

## Counts

Two counting engines, cross-validated against brute force on a reduced 4×4
region model (`test/model.test.ts`):

1. **Exact, all set sizes** — for the monotone, orientation-structured rules
   (R1, and R1+R2 at coarse granularity), via inclusion–exclusion over the 9
   orientations, in `BigInt`. This counts the *entire* feasible space, not a
   bounded slice.
2. **Explicit bounded enumeration** — the full rule set (R1–R4) applied to all
   contact sets up to a size bound K, with the monotone rules pruning the DFS.
   K = 6 coarse (every named coarse grip fits), K = 3 fine (the fine space is far
   too large to take further, and size-3 already exercises every rule).

### Coarse (6 regions/hand, 36 pairs), raw space 2³⁶ ≈ 6.87 × 10¹⁰

| quantity | count |
|---|---|
| raw, all sizes | 68,719,476,736 |
| **R1 orientation-feasible, all sizes (exact)** | **2,153,775,113** |
| R1+R2, all sizes (exact) | 1,212,678,153 |
| raw, sizes 1–6 | 2,391,495 |
| **feasible (all rules), sizes 1–6** | **939,856** |

R1 alone throws out **~97%** of the raw space — orientation is by far the
dominant physical constraint, just as facing conflicts dominated Maril's
impossible positions. By size: 36 / 436 / 4,421 / 32,298 / 174,551 / 728,114.

### Fine (20 regions/hand, 400 pairs), raw space 2⁴⁰⁰ ≈ 2.58 × 10¹²⁰

| quantity | count |
|---|---|
| raw, all sizes | 2^400 ≈ 2.58 × 10¹²⁰ |
| **R1 orientation-feasible, all sizes (exact)** | **≈ 1.26 × 10¹¹⁷** (a 118-digit integer, computed exactly) |
| raw, sizes 1–3 | 10,667,000 |
| **feasible (all rules), sizes 1–3** | **237,275** |

The fine raw space is astronomically large, so it is reported as a formula and an
exact big integer, with explicit enumeration only up to size 3. By size: 400 /
7,013 / 229,862.

### With the optional wrist (coarse, 7 regions/hand, 49 pairs)

Feasible grips sizes 1–6 rise from 939,856 to **5,155,457** — the wrist adds a
whole perimeter surface that pairs with everything, so it inflates the count
substantially. Reported separately for exactly that reason.

## Categories

Every feasible grip is labeled by the first matching predicate
(`src/categorize.ts`):

- **power** — a hand has its palm engaged *and* its fingers reaching the far side
  of the partner (dorsum/edge/wrist): palm + wrap. Handshake, pistol, wrist grab.
- **hook** — finger curl segments engage while palm and thumb stay out: load
  hangs on hooked fingers (swing stretch).
- **precision** — all contact is digit-to-digit (thumb/fingers only): fingertip
  holds.
- **edge-dorsal** — all contact is edges / dorsum / wrist: blade and
  back-to-back connections.
- **platform** — a palm is involved but nothing wraps: resting/cradling
  (ballroom hand-on-top, cupped hands).
- **other** — the remainder.

Coarse, sizes 1–6: power 574,008 · platform 231,310 · other 74,576 · hook 59,584
· precision 363 · edge-dorsal 15. Fine, sizes 1–3: power 37,230 · platform 83,522
· hook 109,508 · other 3,834 · precision 3,104 · edge-dorsal 77. (The category
mix shifts with granularity because at fine granularity small size-≤3 sets rarely
achieve the palm-plus-wrap that defines "power", so hook and platform dominate.)

**Symmetric vs asymmetric.** A grip is *symmetric* when swapping the two hands
under the mirror correspondence (same region id on the other hand) leaves the
contact set unchanged — it feels the same to both dancers. Symmetric grips are
rare (coarse: 1,860 of 939,856; fine: 553 of 237,275), which matches intuition:
most holds have a definite "who is holding whom."

## Named dance grips (sanity checks)

Each named hold maps to a contact set asserted feasible at *both* granularities
(`test/named-grips.test.ts`) — the same role named holds played in the ZDL post.

| grip | coarse pairs | fine pairs | category | symmetric |
|---|---|---|---|---|
| Handshake hold | 6 | 14 | power | yes |
| Cross / pistol grip | 4 | 12 | power | no |
| Fingertip hold | 1 | 4 | precision | yes |
| Hook grip | 3 | 12 | hook | yes |
| Cupped hand hold (mutual C-grip) | 2 | 8 | platform | yes |
| Ballroom hand-on-top | 2 | 12 | platform | no |
| Interlaced fingers | 5 | 20 | power | yes |
| Wrist hold | 4 | 14 | power | no (wrist-enabled model only) |

All eight are feasible. The mutual C-grip and the pinch are the deliberate
"do-not-over-filter" cases; both survive. The wrist hold only exists in the
wrist-enabled model, and the test asserts that it *errors* in the base model —
the limitation is enforced, not hidden.

## Sensitivity of the counts to the rules

Feasible counts as each rule is toggled (bounded enumeration):

| configuration | coarse (1–6) | fine (1–3) |
|---|---|---|
| all rules ON (baseline) | 939,856 | 237,275 |
| without ORIENTATION | 1,901,678 | 267,746 |
| without OPPOSITE_FACES | 994,867 | 243,247 |
| without CONNECTED_INTERFACE | 964,743 | 10,205,902 |
| without SMALL_REGION_SPAN | 955,666 | 237,275 |
| only ORIENTATION | 1,041,850 | 10,238,830 |
| only OPPOSITE_FACES | 2,002,492 | 10,619,276 |
| only CONNECTED_INTERFACE | 2,297,062 | 277,390 |
| only SMALL_REGION_SPAN | 2,362,787 | 10,667,000 |
| no rules (raw, bounded) | 2,391,495 | 10,667,000 |

Reading:

- **Connectivity (R3) is the dominant filter at fine granularity** (removing it
  balloons the fine count ~43×) but modest at coarse granularity — because fine
  regions are many and small, most random pairings are geographically scattered
  and disconnected. Orientation dominates at coarse granularity.
- **The span cap (R4) has zero effect on the fine count at K=3**, because a cap of
  4 cannot be exceeded by a set of only 3 pairs. It only bites once sets are
  larger than the cap — visible coarse (K=6), invisible fine (K=3). This is
  called out in the test suite explicitly rather than papered over.
- Removing OPPOSITE_FACES (R2) changes the coarse count only ~6%; most of its
  work is already done by orientation.

## Open questions

- **Contact ≠ force ≠ direction.** This model says *where* two hands touch, not
  how hard or which way the lead pushes. A firm handshake and a limp one are the
  same contact set here. A grip's *dynamics* — normal vs shear force, the
  direction lead is transmitted — is a richer object layered on top of contact.
- **Dynamic transitions.** Dancing is moving *between* grips. A transition is a
  path in the graph whose nodes are feasible grips and whose edges are
  single-contact make/break moves. Which grips are adjacent? Which transitions
  are smooth vs require a full release? This is the contact-level analogue of the
  transition/stable/mixed split in the ZDL 157.
- **Both hands, back to the partition lattice.** This models *one* of the (up to)
  four hand-to-hand connections. The natural sequel is to put a contact model on
  each edge of Maril's B(4) partition lattice — a grip *decoration* of each
  connected block — and ask how contact shapes compose across a two-handed hold.
- **Self-contact as posture.** Excluding self-contacts keeps the model about the
  *interface*, but a fuller treatment would carry a per-hand posture (open / cup
  / hook / fist) as a precondition and derive which inter-hand contacts each
  posture even permits.
- **Granularity between coarse and fine.** The category mix shifts noticeably
  between 6 and 20 regions; an intermediate (~10-region) model, or reporting
  counts as a function of granularity, would show whether the qualitative story
  is stable.

## Running it

```
cd hands/regions
npm install
npm test      # full enumeration + all assertions (typechecks first)
npm run report  # prints every count table above
```

Self-contained TypeScript, run through `tsx` with `node:test`; no build step.
`src/rules.ts` holds the feasibility predicates as data — flip a boolean to redo
any sensitivity row.
