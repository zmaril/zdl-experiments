/**
 * The census, refined: enumerate topological realizations of every
 * feasible-or-boring census cell within a bounded crossing budget and
 * count entanglement classes per cell / per partition.
 *
 * CROSSING BOUND (stated, not hidden): enumerated diagrams contain
 *   - the routing crossings forced by the cell (one crossing per strand
 *     pair that must exchange sides, two torso-bar crossings per
 *     hammerlocked grip), each with a free over/under choice; and
 *   - for two undisturbed side-by-side front chains, one optional full
 *     twist (clasp, +-2 crossings).
 * So every pair of strand objects (chain vs chain, chain vs torso bar)
 * carries at most 2 crossings. Knotted arcs and longer wraps (3+ crossings
 * per pair) are outside the bound.
 *
 * HONESTY OF THE COUNTS: classes are counted two ways.
 *   - classesLower = number of distinct invariant fingerprints. Distinct
 *     fingerprints PROVE distinct positions; equal fingerprints prove
 *     nothing, so this is a lower bound.
 *   - classesUpper = number of distinct constructed diagrams (after exact
 *     deduplication). Every class contains at least one enumerated
 *     diagram, so this bounds the class count of enumerated diagrams from
 *     above; some distinct diagrams may well be isotopic.
 *   The true number of entanglement classes reachable within the bound
 *   lies in [classesLower, classesUpper].
 *
 * PROJECTION: forgetting the entanglement data of any enumerated
 * realization returns exactly the census cell (partition + hammerlocks)
 * it was built from; forgetting hammerlocks too returns the partition.
 * Tests assert both collapses are exact.
 */

import {
  allCandidateStates,
  hammerlockKey,
  type CandidateState,
  type Category,
} from '../model/census.js';
import { ALL_PARTITIONS, type Hand } from '../model/partitions.js';
import {
  buildPositionTangle,
  isLockedVariant,
  planPosition,
  variantSpace,
  type PlanFailure,
} from '../model/tangles.js';
import { fingerprint, fingerprintKey } from './invariants.js';

export interface CellRefinement {
  partitionId: string;
  hammerlocks: Hand[];
  category: Category;
  representable: boolean;
  reason?: PlanFailure;
  /** Census realizations: locked variants enumerated within the bound. */
  diagrams: number;
  /** Sign combinations dropped as degenerate (fake hammerlocks). */
  degenerate: number;
  /** Distinct invariant fingerprints among the diagrams (lower bound). */
  classesLower: number;
  fingerprints: string[];
  /** Key identifying the constructed diagram set (for cross-cell dedup). */
  constructionKeys: string[];
}

export function refineCell(state: CandidateState): CellRefinement {
  const base = {
    partitionId: state.partition.id,
    hammerlocks: [...state.hammerlocks].sort(),
    category: state.category,
  };
  const r = planPosition(state);
  if (!r.ok) {
    return {
      ...base,
      representable: false,
      reason: r.reason,
      diagrams: 0,
      degenerate: 0,
      classesLower: 0,
      fingerprints: [],
      constructionKeys: [],
    };
  }
  const fps = new Set<string>();
  const keys = new Set<string>();
  let diagrams = 0;
  let degenerate = 0;
  for (const v of variantSpace(r.plan)) {
    const built = buildPositionTangle(r.plan, v);
    if (!isLockedVariant(built)) {
      degenerate++;
      continue;
    }
    diagrams++;
    fps.add(fingerprintKey(fingerprint(built)));
    // Construction key: the diagram is a function of (strand set, word,
    // chain caps); free-hand hammerlock bits do not enter, so cells that
    // differ only in geometric hammerlocks share keys.
    keys.add(
      `${r.plan.strands.join(',')}#${built.word.join('.')}#${r.plan.chains
        .map((c) => c.hands.join('-'))
        .join('|')}`,
    );
  }
  return {
    ...base,
    representable: true,
    diagrams,
    degenerate,
    classesLower: fps.size,
    fingerprints: [...fps].sort(),
    constructionKeys: [...keys].sort(),
  };
}

export interface PartitionRefinement {
  partitionId: string;
  name: string;
  gripSizes: number[];
  cells: Record<Category, number>;
  representableCells: number;
  unrepresentable: { multiGrip: number; backToBack: number };
  /** Distinct fingerprints across all the partition's refined cells. */
  classesLower: number;
  /** Distinct constructed diagrams across all the partition's refined cells. */
  classesUpper: number;
  diagrams: number;
}

export interface RefinementSummary {
  partitions: number;
  candidates: number;
  census: Record<Category, number> & { feasible: number };
  refinedCells: number;
  representableCells: number;
  unrepresentable: { multiGrip: number; backToBack: number };
  perPartition: PartitionRefinement[];
  totals: { diagrams: number; classesLower: number; classesUpper: number };
}

/** Categories whose cells get topological refinement (all non-filtered ones). */
const REFINED: ReadonlySet<Category> = new Set(['boring', 'stable', 'mixed', 'transition']);

export function refineAll(): { summary: RefinementSummary; cells: CellRefinement[] } {
  const states = allCandidateStates();
  const census: Record<Category, number> = {
    impossible: 0,
    weird: 0,
    boring: 0,
    stable: 0,
    mixed: 0,
    transition: 0,
  };
  for (const s of states) census[s.category]++;

  const cells: CellRefinement[] = [];
  for (const s of states) {
    if (!REFINED.has(s.category)) continue;
    cells.push(refineCell(s));
  }

  const perPartition: PartitionRefinement[] = ALL_PARTITIONS.map((p) => {
    const mine = cells.filter((c) => c.partitionId === p.id);
    const cellCounts: Record<Category, number> = {
      impossible: 0,
      weird: 0,
      boring: 0,
      stable: 0,
      mixed: 0,
      transition: 0,
    };
    for (const s of states) if (s.partition.id === p.id) cellCounts[s.category]++;
    const fps = new Set(mine.flatMap((c) => c.fingerprints));
    const keys = new Set(mine.flatMap((c) => c.constructionKeys));
    return {
      partitionId: p.id,
      name: p.name,
      gripSizes: p.gripSizes,
      cells: cellCounts,
      representableCells: mine.filter((c) => c.representable).length,
      unrepresentable: {
        multiGrip: mine.filter((c) => c.reason === 'multi-grip').length,
        backToBack: mine.filter((c) => c.reason === 'back-to-back').length,
      },
      classesLower: fps.size,
      classesUpper: keys.size,
      diagrams: mine.reduce((n, c) => n + c.diagrams, 0),
    };
  });

  const summary: RefinementSummary = {
    partitions: ALL_PARTITIONS.length,
    candidates: states.length,
    census: {
      ...census,
      feasible: census.stable + census.mixed + census.transition,
    },
    refinedCells: cells.length,
    representableCells: cells.filter((c) => c.representable).length,
    unrepresentable: {
      multiGrip: cells.filter((c) => c.reason === 'multi-grip').length,
      backToBack: cells.filter((c) => c.reason === 'back-to-back').length,
    },
    perPartition,
    // Totals sum per-partition counts: positions in different partitions
    // are different positions by definition (different grips), even when
    // their invariant fingerprints coincide (e.g. all clean single holds
    // are topologically trivial).
    totals: {
      diagrams: cells.reduce((n, c) => n + c.diagrams, 0),
      classesLower: perPartition.reduce((n, p) => n + p.classesLower, 0),
      classesUpper: perPartition.reduce((n, p) => n + p.classesUpper, 0),
    },
  };
  return { summary, cells };
}

export function cellKey(c: CellRefinement): string {
  return `${c.partitionId} / ham[${hammerlockKey(new Set(c.hammerlocks))}]`;
}
