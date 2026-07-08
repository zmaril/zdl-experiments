/** Derived grips x moves compatibility matrix. Nothing here is hand-written. */

import { GRIPS } from "./grips.js";
import { MOVES } from "./moves.js";

export type CompatibilityMatrix = Record<string, Record<string, boolean>>;

export function compatibilityMatrix(): CompatibilityMatrix {
  const m: CompatibilityMatrix = {};
  for (const g of GRIPS) {
    m[g.id] = {};
    for (const mv of MOVES) {
      m[g.id]![mv.id] = mv.compatible(g.state);
    }
  }
  return m;
}

export function renderMatrix(m: CompatibilityMatrix): string {
  const gripCol = Math.max(...GRIPS.map((g) => g.id.length), 4) + 2;
  const cols = MOVES.map((mv) => mv.id);
  const header = " ".repeat(gripCol) + cols.map((c) => c.padEnd(c.length + 2)).join("");
  const lines = [header];
  for (const g of GRIPS) {
    let line = g.id.padEnd(gripCol);
    for (const mv of MOVES) {
      const cell = m[g.id]![mv.id] ? "yes" : ".";
      line += cell.padEnd(mv.id.length + 2);
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export function versatility(m: CompatibilityMatrix): { gripId: string; count: number }[] {
  return GRIPS.map((g) => ({
    gripId: g.id,
    count: MOVES.filter((mv) => m[g.id]![mv.id]).length,
  })).sort((a, b) => b.count - a.count);
}
