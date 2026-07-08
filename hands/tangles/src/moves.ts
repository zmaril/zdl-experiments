/**
 * Moves on grip diagrams: Reidemeister-style rewrites valid rel palm bars.
 *
 * Simplifying (crossing-removing) moves:
 *   R1-      remove an adjacent self-crossing kink
 *   R2-      remove an adjacent cancelling pair of strand-strand crossings
 *   R2w-     remove an adjacent same-side double crossing of a bar
 *            (strand pokes across a bar and comes straight back on the
 *            same front/back side: retractable, no wrap)
 *
 * Complicating (crossing-adding) moves, used by the bounded search:
 *   R1+, R2+, R2w+   inverses of the above
 *
 * Sliding moves:
 *   R3       slide a strand across a crossing of two other strands
 *            (uniformly over or uniformly under both)
 *   R3w      slide a strand across the point where another strand
 *            crosses a bar (uniformly over or under both strand and bar)
 *
 * COMPLETENESS CAVEATS (see NOTES.md):
 *   - Gauss-code moves cannot check planar realizability of insertion
 *     sites, so R2+/R1+ are generated liberally ("virtual" slop). The
 *     equivalence checker therefore only trusts move-search for POSITIVE
 *     equivalence when the invariant signatures already agree, and trusts
 *     signatures (sound invariants) for NEGATIVE results.
 *   - The move set is not proven complete for this tangle category; the
 *     brute-force search is a bounded semi-decision procedure.
 */

import {
  type Ev,
  type Grip,
  type OU,
  cloneGrip,
  freshLabel,
  totalCrossings,
  validate,
  zoneTrace,
} from "./model.ts";

export interface Move {
  name: string;
  apply(g: Grip): Grip;
}

function ok(g: Grip): boolean {
  return validate(g).length === 0;
}

/** All grips reachable from g by a single move. */
export function neighbors(g: Grip, opts: { maxCrossings?: number } = {}): { name: string; grip: Grip }[] {
  const out: { name: string; grip: Grip }[] = [];
  const cap = opts.maxCrossings ?? Infinity;
  const push = (name: string, h: Grip) => {
    if (totalCrossings(h) <= cap && ok(h)) out.push({ name, grip: h });
  };

  // --- R1- : adjacent same-label pair in one strand ---
  g.strands.forEach((s, si) => {
    for (let i = 0; i + 1 < s.events.length; i++) {
      const e1 = s.events[i];
      const e2 = s.events[i + 1];
      if (e1.t === "cross" && e2.t === "cross" && e1.label === e2.label) {
        const h = cloneGrip(g);
        h.strands[si].events.splice(i, 2);
        push("R1-", h);
      }
    }
  });

  // --- R2w- : adjacent wall crossings, same bar, same over/under ---
  g.strands.forEach((s, si) => {
    for (let i = 0; i + 1 < s.events.length; i++) {
      const e1 = s.events[i];
      const e2 = s.events[i + 1];
      if (e1.t === "wall" && e2.t === "wall" && e1.bar === e2.bar && e1.ou === e2.ou) {
        const h = cloneGrip(g);
        h.strands[si].events.splice(i, 2);
        push("R2w-", h);
      }
    }
  });

  // --- R2- : two labels adjacent in both participating strands,
  //           one strand over both, the other under both, opposite signs ---
  {
    // Index occurrences: label -> [{strand index, event index}]
    const occ = new Map<number, { si: number; ei: number; ou: OU; sign: number }[]>();
    g.strands.forEach((s, si) =>
      s.events.forEach((ev, ei) => {
        if (ev.t === "cross") {
          const l = occ.get(ev.label) ?? [];
          l.push({ si, ei, ou: ev.ou, sign: ev.sign });
          occ.set(ev.label, l);
        }
      }),
    );
    g.strands.forEach((s, si) => {
      for (let i = 0; i + 1 < s.events.length; i++) {
        const e1 = s.events[i];
        const e2 = s.events[i + 1];
        if (e1.t !== "cross" || e2.t !== "cross") continue;
        if (e1.label === e2.label) continue; // that's R1
        if (e1.ou !== e2.ou) continue; // this strand must be uniformly over or under
        if (e1.sign !== -e2.sign) continue; // cancelling pair
        const o1 = occ.get(e1.label)!.find((o) => !(o.si === si && o.ei === i))!;
        const o2 = occ.get(e2.label)!.find((o) => !(o.si === si && o.ei === i + 1))!;
        if (o1.si !== o2.si) continue; // partners must be the same strand
        if (Math.abs(o1.ei - o2.ei) !== 1) continue; // and adjacent there
        const h = cloneGrip(g);
        // Delete the four events, highest indices first per strand.
        const dels: { si: number; ei: number }[] = [
          { si, ei: i },
          { si, ei: i + 1 },
          { si: o1.si, ei: o1.ei },
          { si: o2.si, ei: o2.ei },
        ];
        dels.sort((a, b) => (a.si - b.si) * 1000 + (b.ei - a.ei));
        // Deduplicate (self-crossing pairs may repeat entries).
        const seen = new Set<string>();
        for (const d of dels) {
          const k = `${d.si}:${d.ei}`;
          if (seen.has(k)) continue;
          seen.add(k);
        }
        const uniq = [...seen]
          .map((k) => k.split(":").map(Number))
          .sort((a, b) => a[0] - b[0] || b[1] - a[1]);
        if (uniq.length !== 4) continue;
        for (const [dsi, dei] of uniq) h.strands[dsi].events.splice(dei, 1);
        push("R2-", h);
      }
    });
  }

  // --- R3 : slide strand X across a crossing r between Y and Z ---
  {
    const occ = new Map<number, { si: number; ei: number; ou: OU }[]>();
    g.strands.forEach((s, si) =>
      s.events.forEach((ev, ei) => {
        if (ev.t === "cross") {
          const l = occ.get(ev.label) ?? [];
          l.push({ si, ei, ou: ev.ou });
          occ.set(ev.label, l);
        }
      }),
    );
    g.strands.forEach((s, si) => {
      for (let i = 0; i + 1 < s.events.length; i++) {
        const e1 = s.events[i];
        const e2 = s.events[i + 1];
        if (e1.t !== "cross" || e2.t !== "cross") continue;
        if (e1.label === e2.label) continue;
        if (e1.ou !== e2.ou) continue; // X uniformly over or under the strands it slides past
        const p = occ.get(e1.label)!.find((o) => !(o.si === si && o.ei === i));
        const q = occ.get(e2.label)!.find((o) => !(o.si === si && o.ei === i + 1));
        if (!p || !q) continue;
        // Partners must themselves cross each other adjacently: find label r
        // adjacent to p in its strand and adjacent to q in its strand.
        const py = g.strands[p.si].events;
        const qz = g.strands[q.si].events;
        for (const dp of [-1, 1]) {
          const rp = py[p.ei + dp];
          if (!rp || rp.t !== "cross") continue;
          for (const dq of [-1, 1]) {
            const rq = qz[q.ei + dq];
            if (!rq || rq.t !== "cross") continue;
            if (rp.label !== rq.label) continue;
            // Triangle found: swap e1,e2 in X; move p past rp; move q past rq.
            const h = cloneGrip(g);
            const hs = h.strands[si].events;
            [hs[i], hs[i + 1]] = [hs[i + 1], hs[i]];
            const hp = h.strands[p.si].events;
            [hp[p.ei], hp[p.ei + dp]] = [hp[p.ei + dp], hp[p.ei]];
            const hq = h.strands[q.si].events;
            [hq[q.ei], hq[q.ei + dq]] = [hq[q.ei + dq], hq[q.ei]];
            push("R3", h);
          }
        }
      }
    });
  }

  // --- R3w : slide strand X across the point where Y crosses a bar ---
  {
    const occ = new Map<number, { si: number; ei: number; ou: OU }[]>();
    g.strands.forEach((s, si) =>
      s.events.forEach((ev, ei) => {
        if (ev.t === "cross") {
          const l = occ.get(ev.label) ?? [];
          l.push({ si, ei, ou: ev.ou });
          occ.set(ev.label, l);
        }
      }),
    );
    g.strands.forEach((s, si) => {
      for (let i = 0; i + 1 < s.events.length; i++) {
        const e1 = s.events[i];
        const e2 = s.events[i + 1];
        let ci = -1;
        let wi = -1;
        if (e1.t === "cross" && e2.t === "wall") [ci, wi] = [i, i + 1];
        else if (e1.t === "wall" && e2.t === "cross") [ci, wi] = [i + 1, i];
        else continue;
        const ce = g.strands[si].events[ci] as Extract<Ev, { t: "cross" }>;
        const we = g.strands[si].events[wi] as Extract<Ev, { t: "wall" }>;
        if (ce.ou !== we.ou) continue; // X uniformly over/under both strand and bar
        const p = occ.get(ce.label)!.find((o) => !(o.si === si && o.ei === ci));
        if (!p) continue;
        // Y's occurrence of the crossing must be adjacent to Y crossing the same bar.
        const ys = g.strands[p.si].events;
        for (const dp of [-1, 1]) {
          const wv = ys[p.ei + dp];
          if (!wv || wv.t !== "wall" || wv.bar !== we.bar) continue;
          const h = cloneGrip(g);
          const hs = h.strands[si].events;
          [hs[i], hs[i + 1]] = [hs[i + 1], hs[i]];
          const hy = h.strands[p.si].events;
          [hy[p.ei], hy[p.ei + dp]] = [hy[p.ei + dp], hy[p.ei]];
          push("R3w", h);
        }
      }
    });
  }

  // --- Complicating moves (bounded by cap) ---

  // R2w+ : insert wall(bar, ou) twice at any position where the zone allows.
  g.strands.forEach((s, si) => {
    const trace = zoneTrace(s);
    if (!trace) return;
    for (let i = 0; i <= s.events.length; i++) {
      const z = trace[i];
      for (const bar of ["A", "B"] as const) {
        if (bar === "A" && z !== 0 && z !== 1) continue;
        if (bar === "B" && z !== 1 && z !== 2) continue;
        for (const ou of ["over", "under"] as const) {
          const h = cloneGrip(g);
          h.strands[si].events.splice(i, 0, { t: "wall", bar, ou }, { t: "wall", bar, ou });
          push("R2w+", h);
        }
      }
    }
  });

  // R1+ : insert a kink at any position.
  g.strands.forEach((s, si) => {
    for (let i = 0; i <= s.events.length; i++) {
      for (const sign of [1, -1] as const) {
        const h = cloneGrip(g);
        const l = freshLabel();
        h.strands[si].events.splice(
          i,
          0,
          { t: "cross", label: l, ou: "over", sign },
          { t: "cross", label: l, ou: "under", sign },
        );
        push("R1+", h);
      }
    }
  });

  // R2+ : insert a cancelling pair between two strand positions.
  // (Liberal / "virtual": planar validity of the site is not checked.)
  g.strands.forEach((s, si) => {
    g.strands.forEach((t, ti) => {
      if (ti < si) return; // unordered; allow ti === si (self R2)
      for (let i = 0; i <= s.events.length; i++) {
        for (let j = 0; j <= t.events.length; j++) {
          if (si === ti && Math.abs(i - j) < 2 && i !== j) continue;
          for (const ouX of ["over", "under"] as const) {
            const ouY = ouX === "over" ? "under" : "over";
            for (const order of [1, -1]) {
              const h = cloneGrip(g);
              const l1 = freshLabel();
              const l2 = freshLabel();
              const insX: Ev[] = [
                { t: "cross", label: l1, ou: ouX, sign: 1 },
                { t: "cross", label: l2, ou: ouX, sign: -1 },
              ];
              const insY: Ev[] =
                order === 1
                  ? [
                      { t: "cross", label: l1, ou: ouY, sign: 1 },
                      { t: "cross", label: l2, ou: ouY, sign: -1 },
                    ]
                  : [
                      { t: "cross", label: l2, ou: ouY, sign: -1 },
                      { t: "cross", label: l1, ou: ouY, sign: 1 },
                    ];
              if (si === ti) {
                // insert into the same strand: higher index first
                const [hi, lo] = i > j ? [i, j] : [j, i];
                const [insHi, insLo] = i > j ? [insX, insY] : [insY, insX];
                h.strands[si].events.splice(hi, 0, ...insHi);
                h.strands[si].events.splice(lo, 0, ...insLo);
              } else {
                h.strands[si].events.splice(i, 0, ...insX);
                h.strands[ti].events.splice(j, 0, ...insY);
              }
              push("R2+", h);
            }
          }
        }
      }
    });
  });

  return out;
}

/** Only the simplifying / sliding neighbors (no insertions). */
export function simplifyingNeighbors(g: Grip): { name: string; grip: Grip }[] {
  return neighbors(g, { maxCrossings: totalCrossings(g) }).filter(
    (n) => totalCrossings(n.grip) <= totalCrossings(g),
  );
}
