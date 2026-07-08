/**
 * Shared braid-grid layout, computed once from a BuiltPosition and consumed
 * by both the 3D scene and the 2D SVG diagram. Coordinates are abstract:
 * columns (strand positions, left to right) and steps (braid letters,
 * bottom to top). Over/under comes straight from the braid word: letter
 * ±i crosses the strands at positions i−1, i and a POSITIVE letter puts
 * the LEFT strand in front (the model/core convention).
 */

import type { BuiltPosition, Hand, StrandName, Zone } from '@model';

export interface LayoutStrand {
  name: StrandName;
  isTorso: boolean;
  /** Column at each step boundary; length steps + 1. */
  cols: number[];
}

export interface LayoutCrossing {
  /** The crossing occupies the band between step boundaries step and step+1. */
  step: number;
  left: StrandName;
  right: StrandName;
  /** Which of the two passes in front (over). */
  over: 'left' | 'right';
  /** True when a torso bar is involved (a behind-the-back pass). */
  torso: boolean;
}

export interface LayoutCap {
  hands: [Hand, Hand];
  zone: Zone;
  /** Top columns of the two gripped arms. */
  aCol: number;
  bCol: number;
  /** Nesting depth among caps (0 = innermost/outermost-free). */
  depth: number;
}

export interface BraidLayout {
  strands: LayoutStrand[];
  crossings: LayoutCrossing[];
  caps: LayoutCap[];
  steps: number;
  columns: number;
  bottomOrder: StrandName[];
  topOrder: StrandName[];
  /** Column indexes of the torso bars in the bottom order (they never move). */
  leaderTorsoCol: number;
  followerTorsoCol: number;
  geometricHammerlocks: Hand[];
}

export function layoutBraid(built: BuiltPosition): BraidLayout {
  const { plan, word } = built;
  const names = plan.strands;
  const steps = word.length;

  const order = [...names]; // order[c] = strand at column c
  const colOf = new Map<StrandName, number>(names.map((s, i) => [s, i]));
  const cols = new Map<StrandName, number[]>(names.map((s) => [s, [colOf.get(s)!]]));
  const crossings: LayoutCrossing[] = [];

  word.forEach((letter, step) => {
    const i = Math.abs(letter) - 1; // left column of the crossing
    const left = order[i]!;
    const right = order[i + 1]!;
    crossings.push({
      step,
      left,
      right,
      over: letter > 0 ? 'left' : 'right',
      torso: left === 'LT' || left === 'FT' || right === 'LT' || right === 'FT',
    });
    order[i] = right;
    order[i + 1] = left;
    for (const s of names) {
      const arr = cols.get(s)!;
      const c = arr[arr.length - 1]!;
      arr.push(s === left ? c + 1 : s === right ? c - 1 : c);
    }
  });

  const topCol = new Map<StrandName, number>(order.map((s, i) => [s, i]));

  const rawCaps = plan.chains.map((c) => {
    const a = topCol.get(c.hands[0])!;
    const b = topCol.get(c.hands[1])!;
    return { hands: c.hands, zone: c.zone, aCol: Math.min(a, b), bCol: Math.max(a, b) };
  });
  const caps: LayoutCap[] = rawCaps.map((cap) => ({
    ...cap,
    depth: rawCaps.filter((o) => o !== cap && o.aCol < cap.aCol && cap.bCol < o.bCol).length,
  }));

  return {
    strands: names.map((s) => ({
      name: s,
      isTorso: s === 'LT' || s === 'FT',
      cols: cols.get(s)!,
    })),
    crossings,
    caps,
    steps,
    columns: names.length,
    bottomOrder: [...names],
    topOrder: order,
    leaderTorsoCol: names.indexOf('LT'),
    followerTorsoCol: names.indexOf('FT'),
    geometricHammerlocks: [...plan.geometricHammerlocks],
  };
}

export const STRAND_COLORS: Record<string, string> = {
  LL: '#e4572e',
  LR: '#f3a712',
  FL: '#4c9be8',
  FR: '#2ec4b6',
  LT: '#8a92a3',
  FT: '#8a92a3',
};

export function strandColor(name: StrandName): string {
  return STRAND_COLORS[name] ?? '#cccccc';
}
