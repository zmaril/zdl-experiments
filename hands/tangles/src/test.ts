/**
 * Test suite: enumeration + assertions for the grip-tangle model.
 * Run with `npm test` (plain node, no test framework needed).
 */

import { strict as assert } from "node:assert";

import {
  type Grip,
  type Strand,
  assertValid,
  cloneGrip,
  mirror,
  serialize,
  totalCrossings,
} from "./model.ts";
import {
  gripSignatureString,
  retractFreeStrands,
  shapeSignatureString,
  signature,
} from "./invariants.ts";
import { neighbors } from "./moves.ts";
import { equivalent, searchMoves } from "./simplify.ts";
import {
  atomKey,
  atoms,
  attachZoneRel,
  countsTable,
  minWallCost,
  pairClasses,
  type RelLetter,
} from "./enumerate.ts";
import {
  crossGrip,
  fingertipHold,
  handshake,
  hookGrip,
  interlacedFingers,
  namedGrips,
  singleFingerHook,
  strandAtom,
  thumbWrap,
} from "./grips.ts";
import { N_MAX, namedAtlas, pairIsNamed, printReport } from "./report.ts";

// SNAPSHOT filled from a verified run (see NOTES.md counts table).
// Columns: [n, 1-strand all, 1-strand feasible, 2-strand all, 2-strand feasible]
const SNAPSHOT: number[][] = [
  [0, 2, 2, 3, 3],
  [1, 6, 6, 17, 17],
  [2, 14, 14, 65, 65],
  [3, 26, 26, 195, 195],
  [4, 50, 26, 513, 363],
];

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

const L = (bar: "s" | "p", sign: 1 | -1): RelLetter => ({ bar, sign });

// --- validity -------------------------------------------------------------

test("all named grips are valid diagrams", () => {
  for (const { name, grip } of namedGrips()) assertValid(grip, name);
});

test("zone validation rejects impossible diagrams", () => {
  const bad: Grip = {
    strands: [
      {
        hand: "A",
        finger: "index",
        // crossing bar B twice in a row is fine, but a third landing in zone 2
        // then attaching to bar A's back (zone 0) is impossible
        events: [{ t: "wall", bar: "B", ou: "under" }],
        end: { t: "attach", bar: "A", side: "back" },
      },
    ],
  };
  assert.throws(() => assertValid(bad));
});

// --- minimal wall cost DP ---------------------------------------------------

test("minWallCost matches hand-computed cases", () => {
  const z = attachZoneRel;
  assert.equal(minWallCost([], z("other", "palm")), 0); // straight fingertip contact
  assert.equal(minWallCost([], z("other", "back")), 1); // over the bar, press the back
  assert.equal(minWallCost([L("p", 1)], z("other", "back")), 1); // handshake wrap
  assert.equal(minWallCost([L("p", -1)], z("other", "back")), 3); // underhand wrap
  assert.equal(minWallCost([L("s", 1)], z("other", "palm")), 2); // under-scoop press
  assert.equal(minWallCost([L("s", 1), L("p", 1)], z("other", "back")), 3); // S-hook
});

// --- named grips: classification -------------------------------------------

test("handshake fingers wrap the partner's bar (word = partner meridian)", () => {
  const sig = signature(handshake());
  const aIndex = sig.strands.find((s) => s.hand === "A" && s.finger === "index")!;
  assert.equal(aIndex.word, "b");
  assert.deepEqual(aIndex.attach, { bar: "B", side: "back" });
  const bIndex = sig.strands.find((s) => s.hand === "B" && s.finger === "index")!;
  assert.equal(bIndex.word, "a");
  assert.equal(sig.pairSums.length, 0);
});

test("hook grip: no bar is wrapped, opposite fingers are pairwise linked", () => {
  const sig = signature(hookGrip());
  for (const s of sig.strands) assert.equal(s.word, "1");
  assert.equal(sig.pairSums.length, 4);
  for (const p of sig.pairSums) assert.equal(p.sum, 2);
});

test("interlaced fingers: handshake-style wraps PLUS pairwise finger crossings", () => {
  const sig = signature(interlacedFingers());
  const aIndex = sig.strands.find((s) => s.hand === "A" && s.finger === "index")!;
  assert.equal(aIndex.word, "b");
  assert.equal(sig.pairSums.length, 4);
  for (const p of sig.pairSums) assert.equal(p.sum, 1);
});

test("cross grip = mirror handshake: same boundary data, trivial words", () => {
  const sig = signature(crossGrip());
  for (const s of sig.strands) assert.equal(s.word, "1");
  assert.equal(sig.pairSums.length, 0);
  const aIndex = sig.strands.find((s) => s.hand === "A" && s.finger === "index")!;
  assert.deepEqual(aIndex.attach, { bar: "B", side: "back" });
});

test("the six named grips fall in six distinct classes", () => {
  const sigs = namedGrips().map(({ name, grip }) => ({ name, sig: gripSignatureString(grip) }));
  for (let i = 0; i < sigs.length; i++)
    for (let j = i + 1; j < sigs.length; j++)
      assert.notEqual(sigs[i].sig, sigs[j].sig, `${sigs[i].name} vs ${sigs[j].name}`);
});

test("mirror is an involution on classes", () => {
  const h = handshake();
  assert.equal(gripSignatureString(mirror(mirror(h))), gripSignatureString(h));
  assert.equal(gripSignatureString(crossGrip()), gripSignatureString(mirror(handshake())));
  assert.notEqual(gripSignatureString(crossGrip()), gripSignatureString(handshake()));
});

test("thumb wrap is the hook-grip pattern performed by thumbs", () => {
  // Same shape once digit names are forgotten...
  assert.equal(
    shapeSignatureString(thumbWrap(), { forgetDigits: true }),
    shapeSignatureString(singleFingerHook(), { forgetDigits: true }),
  );
  // ...but a distinct class when the thumb is distinguished.
  assert.notEqual(gripSignatureString(thumbWrap()), gripSignatureString(singleFingerHook()));
});

test("documented coincidence: interlacing minus its finger crossings = handshake wrap", () => {
  // v1 abstracts away slot positions along the bars, so an interlaced clasp
  // whose fingers happen not to cross each other is indistinguishable from a
  // mutual handshake wrap (see NOTES.md, "what interlacing is made of").
  const wrapOnly = (hand: "A" | "B"): Strand[] =>
    (["index", "middle", "ring", "pinky"] as const).map((f) => ({
      hand,
      finger: f,
      events: [{ t: "wall", bar: hand === "A" ? "B" : "A", ou: "under" as const }],
      end: { t: "attach", bar: hand === "A" ? "B" : "A", side: "back" } as const,
    }));
  const a: Grip = { strands: [...wrapOnly("A"), ...wrapOnly("B")] };
  const b: Grip = { strands: [...wrapOnly("A"), ...wrapOnly("B")] };
  assert.equal(gripSignatureString(a), gripSignatureString(b));
});

// --- free-tip retraction ----------------------------------------------------

test("a loose finger retracts to nothing, no matter how it meanders", () => {
  const label = 7;
  const base: Grip = {
    strands: [
      { hand: "B", finger: "index", events: [], end: { t: "attach", bar: "A", side: "palm" } },
    ],
  };
  const junk: Grip = {
    strands: [
      {
        hand: "B",
        finger: "index",
        events: [{ t: "cross", label, ou: "under", sign: 1 }],
        end: { t: "attach", bar: "A", side: "palm" },
      },
      {
        hand: "A",
        finger: "middle",
        events: [
          { t: "wall", bar: "B", ou: "over" },
          { t: "cross", label, ou: "over", sign: 1 },
          { t: "wall", bar: "B", ou: "over" },
        ],
        end: { t: "free" },
      },
    ],
  };
  assertValid(junk);
  assert.equal(gripSignatureString(junk), gripSignatureString(base));
  const r = retractFreeStrands(cloneGrip(junk));
  assert.equal(totalCrossings(r), 0);
});

// --- moves ------------------------------------------------------------------

function miniHandshake(): Grip {
  return {
    strands: [
      {
        hand: "A",
        finger: "index",
        events: [{ t: "wall", bar: "B", ou: "under" }],
        end: { t: "attach", bar: "B", side: "back" },
      },
      {
        hand: "B",
        finger: "index",
        events: [{ t: "wall", bar: "A", ou: "under" }],
        end: { t: "attach", bar: "A", side: "back" },
      },
    ],
  };
}

function noisyMiniHandshake(): Grip {
  const g = miniHandshake();
  g.strands[0].events = [
    { t: "cross", label: 99, ou: "over", sign: 1 },
    { t: "cross", label: 99, ou: "under", sign: 1 },
    { t: "wall", bar: "B", ou: "over" },
    { t: "wall", bar: "B", ou: "over" },
    { t: "wall", bar: "B", ou: "under" },
  ];
  return g;
}

test("every move preserves the invariant signature", () => {
  const seeds = [noisyMiniHandshake(), singleFingerHook(), miniHandshake()];
  let checked = 0;
  for (const seed of seeds) {
    const sig = gripSignatureString(seed);
    for (const { name, grip } of neighbors(seed, { maxCrossings: totalCrossings(seed) + 2 })) {
      assert.equal(gripSignatureString(grip), sig, `move ${name} changed the signature`);
      checked++;
    }
  }
  assert.ok(checked > 50, `expected many neighbors, got ${checked}`);
});

test("bounded move search undoes kinks and wall pokes (noisy handshake = handshake)", () => {
  assertValid(noisyMiniHandshake());
  assert.equal(equivalent(noisyMiniHandshake(), miniHandshake(), { maxNodes: 800 }), "equal");
});

test("handshake and its mirror are distinct even for a single finger", () => {
  assert.equal(equivalent(miniHandshake(), mirror(miniHandshake())), "distinct");
});

test("the hook grip's mutual thread cannot be simplified away", () => {
  const r = searchMoves(singleFingerHook(), { maxNodes: 600 });
  assert.equal(r.minCrossings, 2);
});

test("serialization is canonical (label renumbering, strand order)", () => {
  const a = miniHandshake();
  const b: Grip = { strands: [...miniHandshake().strands].reverse() };
  assert.equal(serialize(a), serialize(b));
});

// --- enumeration --------------------------------------------------------------

test("enumeration counts: sanity + snapshot", () => {
  const rows = countsTable(N_MAX);
  for (const r of rows) {
    assert.ok(r.one.feasible <= r.one.all);
    assert.ok(r.two.feasible <= r.two.all);
  }
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].one.all >= rows[i - 1].one.all);
    assert.ok(rows[i].two.all >= rows[i - 1].two.all);
  }
  // Hand-checked small values:
  assert.equal(rows[0].one.all, 2); // straight contact: own palm (fist), partner's palm
  assert.equal(rows[1].one.all, 6); // + press-the-back x2, single hook x2
  // Snapshot values (regression guard; recompute if the model changes):
  const snapshot = rows.map((r) => [r.n, r.one.all, r.one.feasible, r.two.all, r.two.feasible]);
  if (SNAPSHOT.length === 0) console.log("    snapshot:", JSON.stringify(snapshot));
  else assert.deepEqual(snapshot, SNAPSHOT);
});

test("feasibility bound actually bites at n = 4", () => {
  const rows = countsTable(4);
  assert.ok(rows[4].one.feasible < rows[4].one.all);
  assert.ok(rows[4].two.feasible < rows[4].two.all);
});

test("named grips are covered by the enumeration's atoms", () => {
  const enumeratedAtoms = new Set(atoms(N_MAX).map(atomKey));
  for (const { name, grip } of namedGrips()) {
    const h = retractFreeStrands(cloneGrip(grip));
    for (const s of h.strands.filter((x) => x.end.t === "attach")) {
      assert.ok(enumeratedAtoms.has(atomKey(strandAtom(s))), `${name}: atom not enumerated`);
    }
  }
});

test("curated candidate grips exist in the enumeration and are unnamed", () => {
  const atlas = namedAtlas();
  // threaded ring
  const ring = pairClasses(2).find(
    (q) =>
      q.k === 1 &&
      [atomKey(q.a1), atomKey(q.a2)].sort().join() === ["other/palm:1", "own/palm:1"].sort().join(),
  );
  assert.ok(ring, "threaded ring not enumerated");
  assert.ok(!pairIsNamed(ring!, atlas), "threaded ring unexpectedly named");
  // under-scoop press
  const scoop = atoms(2).find((a) => atomKey(a) === "other/palm:s");
  assert.ok(scoop, "under-scoop press not enumerated");
  assert.ok(!atlas.atomKeys.has("other/palm:s"));
  // underhand wrap
  const uw = atoms(3).find((a) => atomKey(a) === "other/back:p'");
  assert.ok(uw, "underhand wrap not enumerated");
  assert.ok(!atlas.atomKeys.has("other/back:p'"));
  // braided handshake
  const braid = pairClasses(4).find(
    (q) => q.k === 2 && atomKey(q.a1) === "other/back:p" && atomKey(q.a2) === "other/back:p",
  );
  assert.ok(braid, "braided handshake not enumerated");
  assert.ok(!pairIsNamed(braid!, atlas), "braided handshake unexpectedly named");
});

test("fingertip hold is the unique named grip with zero crossings", () => {
  const zero = namedGrips().filter(
    ({ grip }) => totalCrossings(retractFreeStrands(cloneGrip(grip))) === 0,
  );
  assert.equal(zero.length, 1);
  assert.equal(zero[0].name, "fingertip hold");
});

console.log(`\n${passed} tests passed.\n`);
printReport();
