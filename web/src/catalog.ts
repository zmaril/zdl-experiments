/**
 * Position catalog for the picker: named presets, the 15 holds, hammerlock
 * states, and flagged out-of-frame examples. Every entry resolves through
 * the phase-2 model (planPosition / lockedVariants / buildPositionTangle),
 * so the picker is driven by the same code the census enumeration uses.
 */

import {
  ALL_PARTITIONS,
  NAMED_POSITIONS,
  buildPositionTangle,
  classify,
  lockedVariants,
  partitionById,
  planPosition,
  variantSpace,
  type BuiltPosition,
  type Category,
  type Hand,
  type PartitionInfo,
  type PlanFailure,
  type PositionPlan,
  type VariantChoice,
} from '@model';

export interface CatalogEntry {
  id: string;
  group: string;
  label: string;
  partitionId: string;
  hammerlocks: Hand[];
  /** Preselect this variant when present (named-position canonical picks). */
  preferredVariant?: VariantChoice;
  notes?: string;
}

export interface ResolvedEntry {
  entry: CatalogEntry;
  partition: PartitionInfo;
  hammerlocks: Set<Hand>;
  category: Category;
  representable: boolean;
  reason?: PlanFailure;
  plan?: PositionPlan;
  /** Locked (non-degenerate) variants, i.e. the census-refined diagrams. */
  variants: VariantChoice[];
  /** Variant sign choices dropped as degenerate (fake hammerlocks). */
  degenerateCount: number;
}

const HAND_WORDS: Record<Hand, string> = {
  LL: 'leader left',
  LR: 'leader right',
  FL: 'follower left',
  FR: 'follower right',
};

export function handWords(h: Hand): string {
  return HAND_WORDS[h];
}

function hamLabel(hams: Hand[]): string {
  return hams.map((h) => HAND_WORDS[h]).join(' + ');
}

export function buildCatalog(): CatalogEntry[] {
  const entries: CatalogEntry[] = [];

  // Group 1: named presets from the model.
  for (const np of NAMED_POSITIONS) {
    entries.push({
      id: `named:${np.id}`,
      group: 'Named holds',
      label: np.title,
      partitionId: np.partitionId,
      hammerlocks: [...np.hammerlocks],
      preferredVariant: np.variant,
      notes: np.notes,
    });
  }

  // Group 2: all 15 holds, no hammerlock (the blog's "boring" baseline).
  for (const p of ALL_PARTITIONS) {
    entries.push({
      id: `hold:${p.id}`,
      group: 'The 15 holds (no hammerlock)',
      label: p.name,
      partitionId: p.id,
      hammerlocks: [],
    });
  }

  // Group 3: hammerlock states (a representative spread over categories).
  const hamStates: Array<{ pid: string; hams: Hand[]; note?: string }> = [
    { pid: 'LR.FL', hams: ['FL'], note: 'The classic hammerlock: the held follower-left arm is pinned behind the follower’s back.' },
    { pid: 'LR.FL', hams: ['LR'], note: 'Same grip, but the leader’s own arm is behind the leader’s back.' },
    { pid: 'LR.FR', hams: ['FR'], note: 'Handshake grip with the follower’s right arm hammerlocked.' },
    { pid: 'LL.FL', hams: ['FL'], note: 'Cross hold with the follower’s left arm hammerlocked.' },
    { pid: 'LL.FR|LR.FL', hams: ['FL'], note: 'Two-hand hold, one arm wrapped: a half-wrap on the way to cuddle position.' },
    { pid: 'LL.FL|LR.FR', hams: ['FL'], note: 'Crossed two-hand hold with one follower arm hammerlocked.' },
    { pid: 'LR.FR', hams: ['FL'], note: 'Free (unheld) hand tucked behind the back: a transition-flavored hammerlock the topology cannot see.' },
    { pid: 'LL.FR', hams: ['LR', 'FL'], note: 'Both free hands tucked behind backs; held hands in front. All hammerlocks here are on unheld arms.' },
    { pid: 'LR.FR', hams: ['FR', 'FL'], note: 'Handshake hammerlock plus a free hand tucked: one locked wrap, one invisible one (a mixed state).' },
  ];
  for (const s of hamStates) {
    const p = partitionById(s.pid);
    entries.push({
      id: `ham:${s.pid}:${s.hams.join(',')}`,
      group: 'Hammerlock states',
      label: `${p.name} — ${hamLabel(s.hams)} behind back`,
      partitionId: s.pid,
      hammerlocks: s.hams,
      notes: s.note,
    });
  }

  // Group 4: out-of-frame cells, shown flagged rather than fudged.
  entries.push(
    {
      id: 'flag:back-to-back',
      group: 'Out of frame (flagged)',
      label: 'handshake hold — both gripped hands behind backs (back-to-back)',
      partitionId: 'LR.FR',
      hammerlocks: ['LR', 'FR'],
      notes:
        'Feasible in the census, but the grip would sit behind both backs at once — ' +
        'impossible while facing. Needs the whole-body-orientation extension.',
    },
    {
      id: 'flag:multi-grip-ham',
      group: 'Out of frame (flagged)',
      label: 'three-hand grip (leader R + both follower hands) — follower L behind back',
      partitionId: 'LR.FL.FR',
      hammerlocks: ['FL'],
      notes:
        'Grips of three or more hands make the position a spatial graph (a trivalent ' +
        'vertex), not a link; the link toolkit does not refine these.',
    },
  );

  return entries;
}

export function resolveEntry(entry: CatalogEntry): ResolvedEntry {
  const partition = partitionById(entry.partitionId);
  const hammerlocks = new Set<Hand>(entry.hammerlocks);
  const category = classify(partition, hammerlocks);
  const r = planPosition({ partition, hammerlocks });
  if (!r.ok) {
    return {
      entry,
      partition,
      hammerlocks,
      category,
      representable: false,
      reason: r.reason,
      variants: [],
      degenerateCount: 0,
    };
  }
  const variants = lockedVariants(r.plan);
  const degenerateCount = variantSpace(r.plan).length - variants.length;
  return {
    entry,
    partition,
    hammerlocks,
    category,
    representable: true,
    plan: r.plan,
    variants,
    degenerateCount,
  };
}

export function buildVariant(resolved: ResolvedEntry, index: number): BuiltPosition {
  const plan = resolved.plan;
  const variant = resolved.variants[index];
  if (!plan || !variant) throw new Error('entry is not representable or variant index out of range');
  return buildPositionTangle(plan, variant);
}

/** Human label for a variant: one clause per routing crossing + clasp state. */
export function variantLabel(resolved: ResolvedEntry, v: VariantChoice): string {
  const plan = resolved.plan!;
  const parts: string[] = [];
  plan.letters.forEach((letter, i) => {
    const [a, b] = letter.pair;
    const sign = v.signs[i]!;
    const front = sign > 0 ? a : b;
    if (letter.kind === 'torsoPass') {
      const torso = a === 'LT' || a === 'FT' ? a : b;
      const arm = torso === a ? b : a;
      parts.push(front === arm ? `${arm} in front of ${torso}` : `${arm} behind ${torso}`);
    } else {
      const back = front === a ? b : a;
      parts.push(`${front} over ${back}`);
    }
  });
  if (plan.twistPair) {
    const [a, b] = plan.twistPair;
    if (v.twist === 0) parts.push('no clasp');
    else parts.push(`${a}–${b} clasp (${v.twist > 0 ? '+' : '−'} full twist)`);
  }
  return parts.length > 0 ? parts.join('; ') : 'no crossings';
}

export function sameVariant(a: VariantChoice, b: VariantChoice): boolean {
  return (
    a.twist === b.twist &&
    a.signs.length === b.signs.length &&
    a.signs.every((s, i) => s === b.signs[i])
  );
}
