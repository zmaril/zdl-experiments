/**
 * 2D tangle-diagram view: a classical braid-style strand diagram driven by
 * the same layout data as the 3D scene. Strands run bottom (shoulders) to
 * top (grips); at each crossing the under-strand is drawn with a gap;
 * torso bars are thick; grip caps are arcs joining the two hand endpoints
 * of each chain; zone bands mark front / behind-back regions.
 */

import type { BuiltPosition, Hand } from '@model';
import { layoutBraid, strandColor, type BraidLayout } from './layout.js';

const COL_W = 74;
const ROW_H = 60;
const MARGIN_X = 84;
const TOP_PAD = 84;
const BOTTOM_PAD = 64;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderDiagramSVG(built: BuiltPosition): string {
  const layout = layoutBraid(built);
  const { steps, columns } = layout;
  const capHeadroom =
    layout.caps.length > 0
      ? Math.max(...layout.caps.map((c) => 26 + 30 * c.depth + 4 * (c.bCol - c.aCol))) + 30
      : 0;
  const braidH = Math.max(steps, 1) * ROW_H;
  const width = MARGIN_X * 2 + (columns - 1) * COL_W;
  const height = TOP_PAD + capHeadroom + braidH + BOTTOM_PAD;

  const x = (col: number) => MARGIN_X + col * COL_W;
  // Braid runs bottom-to-top: step 0 at the bottom.
  const yBottom = height - BOTTOM_PAD;
  const yTop = yBottom - braidH;
  const y = (step: number) => yBottom - (step / Math.max(steps, 1)) * braidH;

  const parts: string[] = [];

  // Zone bands. The behind-back zones are bounded by the torso STRANDS,
  // which lean inward when arms pass them, so each band edge follows the
  // torso path rather than a straight line.
  const bandY = yTop - capHeadroom - 12;
  const bandBottom = yBottom + 6;
  const ltStrand = layout.strands.find((s) => s.name === 'LT')!;
  const ftStrand = layout.strands.find((s) => s.name === 'FT')!;
  const torsoEdge = (s: (typeof layout.strands)[number], down: boolean): string => {
    const pts: Array<[number, number]> = [[x(s.cols[s.cols.length - 1]!), bandY]];
    for (let k = Math.max(steps, 1); k >= 0; k--) {
      pts.push([x(s.cols[Math.min(k, s.cols.length - 1)]!), y(k)]);
    }
    pts.push([x(s.cols[0]!), bandBottom]);
    const seq = down ? pts : pts.reverse();
    return seq.map(([px, py]) => `L ${px} ${py}`).join(' ');
  };
  const leftEdge = MARGIN_X - 44;
  const rightEdge = width - MARGIN_X + 44;
  parts.push(
    // behind leader: from the left edge to the LT strand.
    `<path d="M ${leftEdge} ${bandY} ${torsoEdge(ltStrand, true)} L ${leftEdge} ${bandBottom} Z" fill="#231d2a" opacity="0.5"/>`,
    // front: between the two torso strands.
    `<path d="M ${x(ltStrand.cols[ltStrand.cols.length - 1]!)} ${bandY} ${torsoEdge(ltStrand, true)} ${torsoEdge(ftStrand, false)} Z" fill="#1c2433" opacity="0.55"/>`,
    // behind follower: from the FT strand to the right edge.
    `<path d="M ${rightEdge} ${bandY} ${torsoEdge(ftStrand, true)} L ${rightEdge} ${bandBottom} Z" fill="#231d2a" opacity="0.5"/>`,
    // The front zone is widest at the bottom (torso bars lean inward as
    // arms pass them), so its label anchors there.
    `<text x="${(x(ltStrand.cols[0]!) + x(ftStrand.cols[0]!)) / 2}" y="${bandBottom - 8}" class="zone">front</text>`,
    `<text x="${(leftEdge + x(ltStrand.cols[ltStrand.cols.length - 1]!)) / 2}" y="${bandY + 14}" class="zone">behind leader</text>`,
    `<text x="${(x(ftStrand.cols[ftStrand.cols.length - 1]!) + rightEdge) / 2}" y="${bandY + 14}" class="zone">behind follower</text>`,
  );

  // Strand segments. Draw under-halves (with gaps) first, then plain
  // segments, then over-halves on top.
  const under: string[] = [];
  const plain: string[] = [];
  const over: string[] = [];

  for (const s of layout.strands) {
    const w = s.isTorso ? 11 : 5;
    const col = strandColor(s.name);
    const attr = `stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none"`;
    for (let step = 0; step < Math.max(steps, 1); step++) {
      const c0 = s.cols[Math.min(step, s.cols.length - 1)]!;
      const c1 = s.cols[Math.min(step + 1, s.cols.length - 1)]!;
      const x0 = x(c0);
      const x1 = x(c1);
      const y0 = y(step);
      const y1 = y(step + 1);
      const cross = layout.crossings.find(
        (c) => c.step === step && (c.left === s.name || c.right === s.name),
      );
      if (!cross || c0 === c1) {
        plain.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" ${attr}/>`);
        continue;
      }
      const amIOver = (cross.over === 'left') === (cross.left === s.name);
      // Smooth S-curve for the diagonal.
      const path = `M ${x0} ${y0} C ${x0} ${(y0 + y1) / 2}, ${x1} ${(y0 + y1) / 2}, ${x1} ${y1}`;
      if (amIOver) {
        over.push(`<path d="${path}" ${attr}/>`);
      } else {
        // Under-strand: central gap via a normalized dash pattern
        // (dash to just before the midpoint, gap, dash to the end).
        const midGap = s.isTorso ? 26 : 20;
        under.push(
          `<path d="${path}" ${attr} pathLength="100" stroke-dasharray="${50 - midGap / 2} ${midGap} 100"/>`,
        );
      }
    }
  }
  parts.push(...under, ...plain, ...over);

  // Grip caps: arcs joining the two hand endpoints of each chain.
  for (const cap of layout.caps) {
    const ax = x(cap.aCol);
    const bx = x(cap.bCol);
    const h = 26 + 30 * cap.depth + 4 * (cap.bCol - cap.aCol);
    const apexX = (ax + bx) / 2;
    const apexY = yTop - h;
    const handAtA = layout.topOrder[cap.aCol]!;
    const handAtB = layout.topOrder[cap.bCol]!;
    parts.push(
      `<path d="M ${ax} ${yTop} Q ${ax} ${apexY}, ${apexX} ${apexY}" stroke="${strandColor(handAtA)}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      `<path d="M ${bx} ${yTop} Q ${bx} ${apexY}, ${apexX} ${apexY}" stroke="${strandColor(handAtB)}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      `<circle cx="${apexX}" cy="${apexY}" r="6" fill="#e8ecf3"/>`,
      `<text x="${apexX}" y="${apexY - 10}" class="grip">${esc(cap.hands.join('–'))}${cap.zone !== 'front' ? ' (behind back)' : ''}</text>`,
    );
  }

  // Endpoint labels.
  for (const [i, name] of layout.bottomOrder.entries()) {
    const isTorso = name === 'LT' || name === 'FT';
    parts.push(
      `<text x="${x(i)}" y="${yBottom + 20}" class="lbl" fill="${strandColor(name)}">${esc(name)}</text>`,
      `<text x="${x(i)}" y="${yBottom + 34}" class="sub">${isTorso ? 'torso' : 'shoulder'}</text>`,
    );
  }
  for (const [i, name] of layout.topOrder.entries()) {
    if (name === 'LT' || name === 'FT') {
      parts.push(`<text x="${x(i)}" y="${yTop - 8}" class="sub">${esc(name)} ↑</text>`);
    }
  }

  // Geometric hammerlocks note (free hands: no strand, no topology).
  if (layout.geometricHammerlocks.length > 0) {
    parts.push(
      `<text x="${width / 2}" y="${height - 12}" class="note">free hand(s) behind back, no strand: ${esc(
        layout.geometricHammerlocks.join(', '),
      )} — topologically invisible</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <style>
      .lbl { font: 600 13px ui-monospace, monospace; text-anchor: middle; }
      .sub { font: 10px system-ui, sans-serif; text-anchor: middle; fill: #9aa7b8; }
      .grip { font: 600 11px ui-monospace, monospace; text-anchor: middle; fill: #e8ecf3; }
      .zone { font: 10px system-ui, sans-serif; text-anchor: middle; fill: #7c8798; letter-spacing: 1px; text-transform: uppercase; }
      .note { font: italic 11px system-ui, sans-serif; text-anchor: middle; fill: #9aa7b8; }
    </style>
    ${parts.join('\n    ')}
  </svg>`;
}

/** Message shown instead of a diagram for flagged (out-of-frame) cells. */
export function renderFlagMessage(reason: 'multi-grip' | 'back-to-back'): string {
  const text =
    reason === 'multi-grip'
      ? 'Grips of three or more hands turn the position into a spatial graph (trivalent vertices), not a link — the tangle/link toolkit does not draw or refine these. Spatial-graph invariants (e.g. the Yamada polynomial) are future work.'
      : 'Both ends of this grip are hammerlocked, so the joined hands would have to sit behind both backs at once. That is impossible in the facing stance this model fixes; it is a real position only for non-facing orientations (a whole-body-orientation extension).';
  return `<div class="unrepresentable-msg"><strong>Not drawable in this frame.</strong><br/><br/>${text}</div>`;
}

export type { BraidLayout };
export { layoutBraid };
export type SvgHand = Hand;
