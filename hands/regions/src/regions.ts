/**
 * Anatomical region sets for one hand, at two granularities.
 *
 * Conventions:
 *  - Hand A is the leader's right hand, hand B is the follower's left hand.
 *    Because a right hand and a left hand meeting palm-to-palm align like a
 *    mirror image, the SAME region id on both hands corresponds under the
 *    natural (mirror) correspondence: thenar meets thenar, radial edge meets
 *    radial edge, index meets index. This is what makes the "symmetric grip"
 *    notion well-defined (see categorize.ts) and is exactly why partner dance
 *    favors right-to-left holds.
 *  - `surface` says which way a region's contact surface points when the hand
 *    is flat: 'palmar', 'dorsal', or 'any' (perimeter regions that present
 *    some surface in every relative orientation).
 *  - `mobile` regions are digit segments: they flex/curl, so they can wrap
 *    around to the far side of the partner's hand (see orientation.ts).
 *  - Adjacency edges carry a kind:
 *      'structural' - regions that border each other on the flat hand,
 *      'flex'       - regions brought together by curling/opposition
 *                     (fingertips reach the palm in a fist; the thumb pad
 *                     opposes every fingertip and the palm),
 *      'thickness'  - opposite faces of the palm slab (palm and dorsum are
 *                     surface-opposite but only ~25-30mm apart in space,
 *                     which is what makes a pinch a single coherent grip).
 */

export type Facing = 'P' | 'D' | 'E';
export const FACINGS: readonly Facing[] = ['P', 'D', 'E'] as const;

export type SurfaceKind = 'palmar' | 'dorsal' | 'any';
export type AdjacencyKind = 'structural' | 'flex' | 'thickness';

export interface Region {
  id: string;
  name: string;
  surface: SurfaceKind;
  /** digit segment: can flex/curl/wrap */
  mobile: boolean;
  /** small contact patch, subject to the SMALL_REGION_SPAN cap */
  small: boolean;
  /** a group of >=2 digits (coarse only): exempt from OPPOSITE_FACES */
  multiDigit: boolean;
  /** counts as palm surface for rules + categorization */
  palmarZone: boolean;
  isDorsum: boolean;
  /** any part of digits 2-5 */
  isFinger: boolean;
  /** proximal/middle finger segments (or the coarse fingers group): what a hook engages */
  isCurlSegment: boolean;
  isThumb: boolean;
  /** distal segment(s) / fingertip pads */
  isTip: boolean;
  isEdge: boolean;
  isWrist: boolean;
}

export interface AdjacencyEdge {
  a: string;
  b: string;
  kind: AdjacencyKind;
}

export interface HandSpec {
  granularity: 'coarse' | 'fine';
  regions: Region[];
  adjacency: AdjacencyEdge[];
  /** SMALL_REGION_SPAN: max partner regions a `small` region may touch */
  spanCap: number;
}

type RegionOpts = Partial<Omit<Region, 'id' | 'name'>>;

function mk(id: string, name: string, opts: RegionOpts): Region {
  return {
    id,
    name,
    surface: opts.surface ?? 'palmar',
    mobile: opts.mobile ?? false,
    small: opts.small ?? false,
    multiDigit: opts.multiDigit ?? false,
    palmarZone: opts.palmarZone ?? false,
    isDorsum: opts.isDorsum ?? false,
    isFinger: opts.isFinger ?? false,
    isCurlSegment: opts.isCurlSegment ?? false,
    isThumb: opts.isThumb ?? false,
    isTip: opts.isTip ?? false,
    isEdge: opts.isEdge ?? false,
    isWrist: opts.isWrist ?? false,
  };
}

function e(a: string, b: string, kind: AdjacencyKind = 'structural'): AdjacencyEdge {
  return { a, b, kind };
}

/* ------------------------------------------------------------------ */
/* Coarse: 6 regions (+ optional wrist)                                */
/* ------------------------------------------------------------------ */

export const COARSE_REGIONS: Region[] = [
  mk('palm', 'palm (palmar metacarpal surface incl. thenar/hypothenar)', {
    surface: 'palmar', palmarZone: true,
  }),
  mk('dorsum', 'back of hand (dorsal metacarpal surface)', {
    surface: 'dorsal', isDorsum: true,
  }),
  mk('thumb', 'thumb (digit 1, all surfaces)', {
    mobile: true, small: true, isThumb: true,
  }),
  mk('fingers', 'fingers as a group (digits 2-5, proximal+middle segments)', {
    mobile: true, multiDigit: true, isFinger: true, isCurlSegment: true,
  }),
  mk('fingertips', 'fingertip pads (distal segments of digits 2-5)', {
    mobile: true, small: true, multiDigit: true, isFinger: true, isTip: true,
  }),
  mk('edge', 'hand edges (radial edge + thumb web, ulnar/blade edge)', {
    surface: 'any', isEdge: true,
  }),
];

export const COARSE_ADJACENCY: AdjacencyEdge[] = [
  e('palm', 'fingers'),
  e('palm', 'thumb'),
  e('palm', 'edge'),
  e('palm', 'dorsum', 'thickness'),
  e('palm', 'fingertips', 'flex'), // fist curl: tips reach the palm
  e('dorsum', 'fingers'),
  e('dorsum', 'thumb'),
  e('dorsum', 'edge'),
  e('fingers', 'fingertips'),
  e('fingers', 'thumb', 'flex'), // opposition
  e('fingers', 'edge'),
  e('fingertips', 'thumb', 'flex'), // opposition
  e('thumb', 'edge'),
];

/* ------------------------------------------------------------------ */
/* Fine: 20 regions (+ optional wrist)                                 */
/* ------------------------------------------------------------------ */

const FINGERS = [
  ['i', 'index'],
  ['m', 'middle'],
  ['r', 'ring'],
  ['p', 'pinky'],
] as const;

function fineRegions(): Region[] {
  const regions: Region[] = [
    mk('thenar', 'thenar eminence (thumb-side palm pad)', { palmarZone: true }),
    mk('palmCenter', 'central palm (metacarpal hollow)', { palmarZone: true }),
    mk('hypothenar', 'hypothenar eminence (pinky-side palm pad / heel)', { palmarZone: true }),
    mk('dorsum', 'back of hand (dorsal metacarpus)', { surface: 'dorsal', isDorsum: true }),
    mk('radialEdge', 'radial edge incl. first web space', { surface: 'any', isEdge: true }),
    mk('ulnarEdge', 'ulnar / blade edge', { surface: 'any', isEdge: true }),
    mk('thumbProx', 'thumb proximal (metacarpal+proximal phalanx)', { mobile: true, isThumb: true, isCurlSegment: false }),
    mk('thumbTip', 'thumb distal pad', { mobile: true, small: true, isThumb: true, isTip: true }),
  ];
  for (const [k, name] of FINGERS) {
    regions.push(
      mk(`${k}Prox`, `${name} finger proximal phalanx`, { mobile: true, isFinger: true, isCurlSegment: true }),
      mk(`${k}Mid`, `${name} finger middle phalanx`, { mobile: true, isFinger: true, isCurlSegment: true }),
      mk(`${k}Tip`, `${name} finger distal pad`, { mobile: true, small: true, isFinger: true, isTip: true }),
    );
  }
  return regions;
}

function fineAdjacency(): AdjacencyEdge[] {
  const edges: AdjacencyEdge[] = [
    // palm zones
    e('thenar', 'palmCenter'),
    e('palmCenter', 'hypothenar'),
    // edges
    e('radialEdge', 'dorsum'),
    e('ulnarEdge', 'dorsum'),
    e('radialEdge', 'thenar'),
    e('ulnarEdge', 'hypothenar'),
    e('radialEdge', 'thumbProx'),
    e('radialEdge', 'iProx'),
    e('ulnarEdge', 'pProx'),
    // dorsum borders the backs of the proximal segments and thumb base
    e('dorsum', 'iProx'),
    e('dorsum', 'mProx'),
    e('dorsum', 'rProx'),
    e('dorsum', 'pProx'),
    e('dorsum', 'thumbProx'),
    // palm slab thickness (pinch support)
    e('dorsum', 'palmCenter', 'thickness'),
    e('dorsum', 'thenar', 'thickness'),
    e('dorsum', 'hypothenar', 'thickness'),
    // thumb
    e('thumbProx', 'thumbTip'),
    e('thumbProx', 'thenar'),
    // finger bases
    e('iProx', 'palmCenter'),
    e('mProx', 'palmCenter'),
    e('rProx', 'palmCenter'),
    e('pProx', 'palmCenter'),
    e('pProx', 'hypothenar'),
    // opposition (flex): thumb pad reaches every fingertip and the palm
    e('thumbTip', 'iTip', 'flex'),
    e('thumbTip', 'mTip', 'flex'),
    e('thumbTip', 'rTip', 'flex'),
    e('thumbTip', 'pTip', 'flex'),
    e('thumbTip', 'palmCenter', 'flex'),
    e('thumbTip', 'hypothenar', 'flex'),
  ];
  // digit chains + curl flex
  for (const [k] of FINGERS) {
    edges.push(e(`${k}Prox`, `${k}Mid`), e(`${k}Mid`, `${k}Tip`));
    edges.push(e(`${k}Tip`, 'palmCenter', 'flex')); // fist curl
  }
  edges.push(e('pTip', 'hypothenar', 'flex'));
  // neighboring fingers, segment by segment
  const order = ['i', 'm', 'r', 'p'];
  for (let i = 0; i < order.length - 1; i++) {
    for (const seg of ['Prox', 'Mid', 'Tip']) {
      edges.push(e(`${order[i]}${seg}`, `${order[i + 1]}${seg}`));
    }
  }
  return edges;
}

/* ------------------------------------------------------------------ */
/* Optional wrist region                                               */
/* ------------------------------------------------------------------ */

const WRIST = mk('wrist', 'wrist (distal forearm cylinder)', {
  surface: 'any', isWrist: true,
});

const COARSE_WRIST_ADJ: AdjacencyEdge[] = [
  e('wrist', 'palm'),
  e('wrist', 'dorsum'),
  e('wrist', 'edge'),
];

const FINE_WRIST_ADJ: AdjacencyEdge[] = [
  e('wrist', 'thenar'),
  e('wrist', 'hypothenar'),
  e('wrist', 'dorsum'),
  e('wrist', 'radialEdge'),
  e('wrist', 'ulnarEdge'),
];

export interface HandSpecOptions {
  includeWrist?: boolean;
}

export function coarseHand(opts: HandSpecOptions = {}): HandSpec {
  const regions = [...COARSE_REGIONS];
  const adjacency = [...COARSE_ADJACENCY];
  if (opts.includeWrist) {
    regions.push({ ...WRIST });
    adjacency.push(...COARSE_WRIST_ADJ);
  }
  return { granularity: 'coarse', regions, adjacency, spanCap: 3 };
}

export function fineHand(opts: HandSpecOptions = {}): HandSpec {
  const regions = fineRegions();
  const adjacency = fineAdjacency();
  if (opts.includeWrist) {
    regions.push({ ...WRIST });
    adjacency.push(...FINE_WRIST_ADJ);
  }
  return { granularity: 'fine', regions, adjacency, spanCap: 4 };
}

/** Restrict a hand spec to a subset of region ids (for brute-force cross-checks). */
export function restrictHand(spec: HandSpec, ids: string[]): HandSpec {
  const keep = new Set(ids);
  return {
    ...spec,
    regions: spec.regions.filter((r) => keep.has(r.id)),
    adjacency: spec.adjacency.filter((ed) => keep.has(ed.a) && keep.has(ed.b)),
  };
}
