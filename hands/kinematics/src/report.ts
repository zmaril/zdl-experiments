/** Full report: enumeration counts, catalog, derived compatibility matrix, empty cells. */

import { GRIPS } from "./grips.js";
import { MOVES } from "./moves.js";
import { enumerate, EMPTY_CELL_EXAMPLES } from "./enumerate.js";
import { compatibilityMatrix, renderMatrix, versatility } from "./matrix.js";
import { describeState, stateKey } from "./types.js";
import { RULES, violations } from "./rules.js";

const res = enumerate();

console.log("=== hands/kinematics: functional grip classification ===\n");

console.log("Consistency rules:");
for (const r of RULES) console.log(`  ${r.id} ${r.name}`);
console.log();

console.log("State space:");
console.log(`  raw combinations:          ${res.raw}`);
console.log(`  mechanically consistent:   ${res.consistent}`);
console.log(`  cells occupied by catalog: ${res.occupied} (from ${GRIPS.length} grips)`);
console.log();

console.log("Catalog:");
for (const g of GRIPS) {
  const v = violations(g.state);
  console.log(`  ${g.name}  [${g.kinematicPair}]`);
  console.log(`    ${g.affordance}`);
  console.log(`    ${describeState(g.state)}`);
  if (v.length) console.log(`    !! INCONSISTENT: violates ${v.join(", ")}`);
}
console.log();

const m = compatibilityMatrix();
console.log("Grips x moves compatibility (derived from move requirements):\n");
console.log(renderMatrix(m));
console.log();

console.log("Versatility (moves supported):");
for (const { gripId, count } of versatility(m)) {
  console.log(`  ${gripId.padEnd(14)} ${count}/${MOVES.length}`);
}
console.log();

console.log("Interesting empty cells (consistent, unoccupied, nameable):");
for (const e of EMPTY_CELL_EXAMPLES) {
  const occupied = res.occupancy.has(stateKey(e.state));
  console.log(`  ${e.name}${occupied ? "  (WARNING: actually occupied!)" : ""}`);
  console.log(`    ${describeState(e.state)}`);
  console.log(`    ${e.speculation}`);
}
