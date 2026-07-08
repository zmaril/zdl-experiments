/**
 * Test suite: runs the enumeration and asserts the model's load-bearing facts.
 * Exits nonzero on any failure. `npm test` runs this file.
 */

import { strict as assert } from "node:assert";
import { GRIPS, GRIP_BY_ID } from "./grips.js";
import { MOVES } from "./moves.js";
import { enumerate, EMPTY_CELL_EXAMPLES } from "./enumerate.js";
import { compatibilityMatrix, versatility } from "./matrix.js";
import { isConsistent, violations } from "./rules.js";
import { stateKey } from "./types.js";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

const res = enumerate();
const matrix = compatibilityMatrix();
const compat = (g: string, mv: string): boolean => {
  assert.ok(GRIP_BY_ID[g], `unknown grip ${g}`);
  assert.ok(MOVES.some((m) => m.id === mv), `unknown move ${mv}`);
  return matrix[g]![mv]!;
};

// ---- enumeration counts are stable ----------------------------------------
check("raw state space is 3^5 * 2^5 * 3 * 2 = 46656", () => {
  assert.equal(res.raw, 3 ** 5 * 2 ** 5 * 3 * 2);
  assert.equal(res.raw, 46656);
});

check("mechanically consistent states: 2195", () => {
  // Derivation (see NOTES.md): closure=none contributes 162, closure=force
  // 269, closure=form 882 * 2 release modes = 1764; total 2195.
  assert.equal(res.consistent, 2195);
});

check("every consistent state actually passes every rule", () => {
  for (const s of res.consistentStates) assert.deepEqual(violations(s), []);
});

// ---- catalog sanity --------------------------------------------------------
check("catalog has 10 grips, all mechanically consistent", () => {
  assert.equal(GRIPS.length, 10);
  for (const g of GRIPS) {
    assert.ok(isConsistent(g.state), `${g.id} violates ${violations(g.state).join(",")}`);
  }
});

check("all 10 grips occupy distinct cells (occupied = 10)", () => {
  assert.equal(res.occupied, 10);
  const keys = new Set(GRIPS.map((g) => stateKey(g.state)));
  assert.equal(keys.size, GRIPS.length);
});

check("wristHold and forearmHold differ ONLY in release mode", () => {
  const w = GRIP_BY_ID["wristHold"]!.state;
  const f = GRIP_BY_ID["forearmHold"]!.state;
  assert.deepEqual(w.motion, f.motion);
  assert.deepEqual(w.forces, f.forces);
  assert.equal(w.closure, f.closure);
  assert.notEqual(w.release, f.release);
});

// ---- dance-obvious compatibility spot checks -------------------------------
check("underarm turn: works with handshake-ish swivel grips", () => {
  assert.equal(compat("handshake", "underarmTurn"), true);
  assert.equal(compat("pistol", "underarmTurn"), true);
  assert.equal(compat("fingertip", "underarmTurn"), true);
  assert.equal(compat("hook", "underarmTurn"), true);
});

check("underarm turn: fails with interlaced fingers and wrist-collar grips (vertical swivel locked)", () => {
  assert.equal(compat("interlaced", "underarmTurn"), false);
  assert.equal(compat("wristHold", "underarmTurn"), false);
  assert.equal(compat("forearmHold", "underarmTurn"), false);
});

check("free spin with regrip: unilateral-release grips only", () => {
  assert.equal(compat("handshake", "freeSpinRegrip"), true); // you drop a handshake and re-catch all the time
  assert.equal(compat("wristHold", "freeSpinRegrip"), true); // the holder can always let go alone
  assert.equal(compat("interlaced", "freeSpinRegrip"), false); // mutual cage: no one exits alone
  assert.equal(compat("forearmHold", "freeSpinRegrip"), false);
});

check("dip support: needs compression + lateral torque brace + non-sliding shear", () => {
  assert.equal(compat("cup", "dipSupport"), true);
  assert.equal(compat("handshake", "dipSupport"), true);
  assert.equal(compat("interlaced", "dipSupport"), true);
  assert.equal(compat("handOnTop", "dipSupport"), false); // no usable torque through resting contact
  assert.equal(compat("fingertip", "dipSupport"), false); // no compression at all
  assert.equal(compat("looseClasp", "dipSupport"), false); // preload below torque threshold
});

check("redirection/check: any tension channel; push-only grips fail", () => {
  assert.equal(compat("fingertip", "redirection"), true);
  assert.equal(compat("cup", "redirection"), false);
  assert.equal(compat("handOnTop", "redirection"), false);
});

check("weight-sharing lean: tension + shear that won't skate", () => {
  assert.equal(compat("hook", "weightShareLean"), true); // the classic no-thumb counterbalance
  assert.equal(compat("forearmHold", "weightShareLean"), true);
  assert.equal(compat("fingertip", "weightShareLean"), false); // slides off sideways
  assert.equal(compat("handOnTop", "weightShareLean"), false);
});

check("hammerlock entry: needs vertical + grip-axis swivel with tension", () => {
  assert.equal(compat("handshake", "hammerlockEntry"), true);
  assert.equal(compat("pistol", "hammerlockEntry"), true);
  assert.equal(compat("interlaced", "hammerlockEntry"), false);
  assert.equal(compat("wristHold", "hammerlockEntry"), false);
});

// ---- versatility headline --------------------------------------------------
check("handshake and pistol are maximally versatile (6/6); handOnTop is minimal (1/6)", () => {
  const v = Object.fromEntries(versatility(matrix).map((x) => [x.gripId, x.count]));
  assert.equal(v["handshake"], 6);
  assert.equal(v["pistol"], 6);
  assert.equal(v["handOnTop"], 1);
  assert.equal(v["cup"], 2);
});

// ---- empty cells -----------------------------------------------------------
check("named empty cells are consistent AND unoccupied", () => {
  const occupiedKeys = new Set(res.occupancy.keys());
  for (const e of EMPTY_CELL_EXAMPLES) {
    assert.ok(isConsistent(e.state), `${e.id} violates ${violations(e.state).join(",")}`);
    assert.ok(!occupiedKeys.has(stateKey(e.state)), `${e.id} unexpectedly occupied`);
  }
});

console.log(`\nState space: raw=${res.raw} consistent=${res.consistent} occupied=${res.occupied}`);
console.log(`${passed} checks passed.`);
