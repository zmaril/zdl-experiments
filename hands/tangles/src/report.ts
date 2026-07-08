/**
 * Enumeration + classification report for grip-tangles.
 * Run: node src/report.ts   (also executed by `npm test` via test.ts)
 */

import { totalCrossings } from "./model.ts";
import { signature, signatureString } from "./invariants.ts";
import {
  type PairClass,
  DEFAULT_MAX_CURL,
  atomKey,
  atoms,
  countsTable,
  describeAtom,
  describePair,
  pairClassKey,
  pairClasses,
} from "./enumerate.ts";
import { namedGrips, strandAtom } from "./grips.ts";
import { retractFreeStrands } from "./invariants.ts";
import { cloneGrip, strandKey } from "./model.ts";

export const N_MAX = 4;

export interface Atlas {
  atomKeys: Set<string>;
  pairKeys: Set<string>;
}

/** Atom + pair patterns occurring in the named grips. */
export function namedAtlas(): Atlas {
  const atomKeys = new Set<string>();
  const pairKeys = new Set<string>();
  for (const { grip } of namedGrips()) {
    const h = retractFreeStrands(cloneGrip(grip));
    const attached = h.strands.filter((s) => s.end.t === "attach");
    const byKey = new Map(attached.map((s) => [strandKey(s), s]));
    for (const s of attached) atomKeys.add(atomKey(strandAtom(s)));
    for (const ps of signature(grip).pairSums) {
      const a1 = strandAtom(byKey.get(ps.pair[0])!);
      const a2 = strandAtom(byKey.get(ps.pair[1])!);
      const [x, y] = atomKey(a1) <= atomKey(a2) ? [a1, a2] : [a2, a1];
      pairKeys.add(`${atomKey(x)} & ${atomKey(y)} @k=${ps.sum}`);
    }
  }
  return { atomKeys, pairKeys };
}

export function pairIsNamed(p: PairClass, atlas: Atlas): boolean {
  if (p.k === 0)
    return atlas.atomKeys.has(atomKey(p.a1)) && atlas.atomKeys.has(atomKey(p.a2));
  return atlas.pairKeys.has(pairClassKey(p));
}

export function printReport(): void {
  console.log("=== Grip-tangles: enumeration report ===\n");

  console.log(
    `Classes of grip-tangles with total crossing number <= n (crossings = finger-finger + finger-bar).`,
  );
  console.log(
    `"feasible" applies the finger-length bound: each strand may carry at most MAX_CURL = ${DEFAULT_MAX_CURL} crossings (~ one full turn).`,
  );
  console.log(`Counted at invariant resolution; see NOTES.md for caveats.\n`);

  const t3 = countsTable(N_MAX, DEFAULT_MAX_CURL);
  const t2 = countsTable(N_MAX, 2);
  console.log(
    "  n | 1-strand all | feasible(curl<=3) | feasible(curl<=2) | 2-strand all | feasible(curl<=3) | feasible(curl<=2)",
  );
  console.log("  --|--------------|-------------------|-------------------|--------------|-------------------|------------------");
  for (let n = 0; n <= N_MAX; n++) {
    const r3 = t3[n];
    const r2 = t2[n];
    console.log(
      `  ${n} | ${String(r3.one.all).padStart(12)} | ${String(r3.one.feasible).padStart(17)} | ${String(
        r2.one.feasible,
      ).padStart(17)} | ${String(r3.two.all).padStart(12)} | ${String(r3.two.feasible).padStart(
        17,
      )} | ${String(r2.two.feasible).padStart(17)}`,
    );
  }

  console.log("\n=== Named grips: where each lands ===\n");
  for (const { name, blurb, grip } of namedGrips()) {
    const sig = signature(grip);
    const h = retractFreeStrands(cloneGrip(grip));
    const attached = h.strands.filter((s) => s.end.t === "attach");
    const atomsUsed = [...new Set(attached.map((s) => atomKey(strandAtom(s))))];
    console.log(`- ${name} (${blurb})`);
    console.log(`    crossings in diagram: ${totalCrossings(h)}`);
    console.log(`    signature: ${signatureString(sig)}`);
    console.log(`    strand atoms: ${atomsUsed.join(" ; ")}`);
    if (sig.pairSums.length > 0)
      console.log(
        `    linked pairs: ${sig.pairSums.map((p) => `${p.pair[0]}~${p.pair[1]} (k=${p.sum})`).join(", ")}`,
      );
    console.log();
  }

  console.log("=== Candidate grips with no dance name (feasible, unnamed patterns) ===\n");
  const atlas = namedAtlas();
  const curated: { title: string; find: () => string | undefined; desc: string }[] = [
    {
      title: "threaded ring",
      find: () => {
        const p = pairClasses(2).find(
          (q) =>
            q.k === 1 &&
            [atomKey(q.a1), atomKey(q.a2)].sort().join() === ["other/palm:1", "own/palm:1"].sort().join(),
        );
        return p && pairClassKey(p);
      },
      desc: "One dancer curls a finger into a closed ring against their own palm; the partner slides a finger through that ring and presses the first dancer's palm.",
    },
    {
      title: "under-scoop press",
      find: () => {
        const a = atoms(2).find((x) => atomKey(x) === "other/palm:s");
        return a && atomKey(a);
      },
      desc: "A finger dives behind its own palm bar, comes back around in front, and presses the partner's palm — the fingertip arrives at the same place as a fingertip hold, but the finger is threaded around its own hand.",
    },
    {
      title: "underhand wrap",
      find: () => {
        const a = atoms(3).find((x) => atomKey(x) === "other/back:p'");
        return a && atomKey(a);
      },
      desc: "A finger slips in front of the partner's palm bar, hooks back underneath it from behind, and presses the back of the partner's hand from below — the reverse-direction cousin of the handshake wrap.",
    },
    {
      title: "braided handshake",
      find: () => {
        const p = pairClasses(4).find(
          (q) => q.k === 2 && atomKey(q.a1) === "other/back:p" && atomKey(q.a2) === "other/back:p",
        );
        return p && pairClassKey(p);
      },
      desc: "Both dancers hook the other's palm bar as in a handshake, but the two hooking fingers also wrap once around each other on the way — a handshake with a twist braided into it.",
    },
  ];
  for (const c of curated) {
    const key = c.find();
    console.log(`- ${c.title}  [${key ?? "NOT FOUND"}]`);
    console.log(`    ${c.desc}\n`);
  }

  const feas = pairClasses(3).filter((p) => !pairIsNamed(p, atlas));
  console.log(
    `(${feas.length} feasible-cost 2-strand patterns with total crossings <= 3 are unnamed in the atlas; the four above are curated examples.)`,
  );
}

// Allow use both as a module and as a script.
if (import.meta.url === `file://${process.argv[1]}`) {
  printReport();
}
