/**
 * Named dance positions: curated (partition, hammerlock, variant) triples
 * with canonical builds. This is the catalog a visualization (phase 3) can
 * render from: each entry yields a BuiltPosition whose strand order, braid
 * word, chain caps and closure pattern fully describe a drawable diagram.
 */

import { partitionById } from './partitions.js';
import type { Hand } from './partitions.js';
import {
  buildPositionTangle,
  lockedVariants,
  planPosition,
  type BuiltPosition,
  type PositionPlan,
  type VariantChoice,
} from './tangles.js';

export interface NamedPosition {
  id: string;
  title: string;
  partitionId: string;
  hammerlocks: Hand[];
  /** Omitted = first locked variant (canonical pick). */
  variant?: VariantChoice;
  notes: string;
}

/**
 * Canonical variant sign conventions are arbitrary but fixed; mirrored
 * variants (all signs flipped) are the same hold with the other arm in
 * front / wrapped the other way.
 */
export const NAMED_POSITIONS: readonly NamedPosition[] = [
  {
    id: 'open-two-hand',
    title: 'open position (two-hand hold)',
    partitionId: 'LL.FR|LR.FL',
    hammerlocks: [],
    variant: { signs: [], twist: 0 },
    notes: 'Both straight holds, no crossings: closure is a 4-component unlink.',
  },
  {
    id: 'open-single',
    title: 'open position (single hold, leader L - follower R)',
    partitionId: 'LL.FR',
    hammerlocks: [],
    variant: { signs: [], twist: 0 },
    notes: 'One straight hold, topologically trivial.',
  },
  {
    id: 'handshake',
    title: 'handshake hold (right to right)',
    partitionId: 'LR.FR',
    hammerlocks: [],
    variant: { signs: [], twist: 0 },
    notes:
      'Right-to-right grip. With the free arms out of play it is topologically ' +
      'as trivial as the straight single hold — only the partition differs.',
  },
  {
    id: 'crossed-two-hand',
    title: 'crossed two-hand hold',
    partitionId: 'LL.FL|LR.FR',
    hammerlocks: [],
    variant: { signs: [1], twist: 0 },
    notes:
      'The two chains are forced to cross once. The mirror variant (signs [-1]) ' +
      'is the same hold with the other pair of arms in front; the string-linking ' +
      'sum (+1 vs -1) distinguishes them while Jones of the closure does not.',
  },
  {
    id: 'hammerlock-follower',
    title: 'hammerlock (follower L behind follower back, held by leader R)',
    partitionId: 'LR.FL',
    hammerlocks: ['FL'],
    notes:
      'The grip chain encloses the follower torso bar: linking sum +-2 with FT, ' +
      'closure contains a Hopf link. Topologically locked BECAUSE of the torso ' +
      'obstacle; without the torso strand the chain is an unknotted arc.',
  },
  {
    id: 'cuddle-sweetheart',
    title: 'cuddle / sweetheart wrap',
    partitionId: 'LL.FR|LR.FL',
    hammerlocks: ['FL', 'FR'],
    notes:
      'Both chains wrapped around the follower torso. Topologically this cell ' +
      'is identical to "both follower hands hammerlocked": whether the wrapped ' +
      'grips sit at the waist facing out (cuddle) or behind the back facing in ' +
      '(double hammerlock) is orientation/geometry the topology does not see.',
  },
];

export interface BuiltNamedPosition extends NamedPosition {
  variant: VariantChoice;
  plan: PositionPlan;
  built: BuiltPosition;
}

export function buildNamedPosition(id: string): BuiltNamedPosition {
  const spec = NAMED_POSITIONS.find((p) => p.id === id);
  if (!spec) throw new Error(`no named position "${id}"`);
  const r = planPosition({
    partition: partitionById(spec.partitionId),
    hammerlocks: new Set(spec.hammerlocks),
  });
  if (!r.ok) throw new Error(`named position "${id}" failed to plan: ${r.reason}`);
  const variant = spec.variant ?? lockedVariants(r.plan)[0];
  if (!variant) throw new Error(`named position "${id}" has no locked variant`);
  return { ...spec, variant, plan: r.plan, built: buildPositionTangle(r.plan, variant) };
}
