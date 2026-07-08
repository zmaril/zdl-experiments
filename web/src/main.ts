/**
 * App entry: position picker -> (3D scene, 2D diagram, info panel).
 * All census/topology data comes live from src/model + src/core; the
 * invariants shown (string-linking sums, Jones polynomial of the canonical
 * closure) are computed in the browser with exact bigint arithmetic.
 */

import { componentCount, jonesPolynomial } from '@core';
import {
  closePosition,
  stringLinkingSums,
  type BuiltPosition,
} from '@model';
import {
  buildCatalog,
  buildVariant,
  handWords,
  resolveEntry,
  sameVariant,
  variantLabel,
  type CatalogEntry,
  type ResolvedEntry,
} from './catalog.js';
import { DanceScene } from './scene3d.js';
import { renderDiagramSVG, renderFlagMessage } from './svgview.js';

const positionSelect = document.getElementById('position-select') as HTMLSelectElement;
const variantSelect = document.getElementById('variant-select') as HTMLSelectElement;
const infoPanel = document.getElementById('info-panel') as HTMLDivElement;
const svgHost = document.getElementById('svg-host') as HTMLDivElement;
const canvasHost = document.getElementById('canvas-host') as HTMLDivElement;

const scene = new DanceScene(canvasHost);
const catalog = buildCatalog();
const byId = new Map(catalog.map((e) => [e.id, e]));

// Bare facing dancers (the "no contact" cell) shown for flagged states.
const bareDancers = buildVariant(
  resolveEntry({ id: 'bare', group: '', label: '', partitionId: 'none', hammerlocks: [] }),
  0,
);

// --- populate picker ---------------------------------------------------
{
  const groups = new Map<string, CatalogEntry[]>();
  for (const e of catalog) {
    if (!groups.has(e.group)) groups.set(e.group, []);
    groups.get(e.group)!.push(e);
  }
  for (const [group, entries] of groups) {
    const og = document.createElement('optgroup');
    og.label = group;
    for (const e of entries) {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.label;
      og.appendChild(opt);
    }
    positionSelect.appendChild(og);
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function categoryChip(resolved: ResolvedEntry): string {
  const cls = ['stable', 'mixed', 'transition', 'boring'].includes(resolved.category)
    ? resolved.category
    : 'flagged';
  return `<span class="chip ${cls}">${resolved.category}</span>`;
}

function invariantRows(built: BuiltPosition): string {
  const sums = [...stringLinkingSums(built)].map(([k, v]) => `${k} = ${v}`).sort();
  const closure = closePosition(built);
  const jones = jonesPolynomial(closure).toString('q');
  return `
    <dt>linking sums</dt><dd>${
      sums.length > 0 ? sums.map((s) => `<code>${esc(s)}</code>`).join('<br/>') : 'all zero (nothing enlaced)'
    }</dd>
    <dt>closure</dt><dd>${componentCount(closure)} components</dd>
    <dt>Jones (closure)</dt><dd><code>${esc(jones)}</code></dd>`;
}

function renderInfo(resolved: ResolvedEntry, built: BuiltPosition | null): void {
  const e = resolved.entry;
  const grips = resolved.partition.blocks.filter((b) => b.length >= 2);
  const hams = [...resolved.hammerlocks];
  const rows: string[] = [
    `<dt>partition</dt><dd><code>${esc(resolved.partition.id)}</code><br/>${esc(resolved.partition.name)}</dd>`,
    `<dt>grips</dt><dd>${
      grips.length > 0 ? grips.map((b) => b.join('–')).join(' , ') : 'none'
    }</dd>`,
    `<dt>hammerlocks</dt><dd>${
      hams.length > 0 ? hams.map((h) => `${h} (${handWords(h)})`).join('<br/>') : 'none'
    }</dd>`,
    `<dt>census</dt><dd>${categoryChip(resolved)}</dd>`,
  ];
  if (resolved.representable) {
    rows.push(
      `<dt>entanglement</dt><dd>${resolved.variants.length} locked diagram${
        resolved.variants.length === 1 ? '' : 's'
      } within the crossing bound${
        resolved.degenerateCount > 0
          ? `; ${resolved.degenerateCount} degenerate over/under choice${
              resolved.degenerateCount === 1 ? '' : 's'
            } dropped (fake hammerlocks)`
          : ''
      }</dd>`,
    );
    if (built) rows.push(invariantRows(built));
  }
  const flag = !resolved.representable
    ? `<p class="flag-reason">${
        resolved.reason === 'multi-grip'
          ? 'Multi-hand grip: a spatial graph, not a link — flagged, not drawn.'
          : 'Back-to-back double hammerlock: the grip would sit behind both backs at once — impossible in the facing stance this model fixes.'
      }</p>`
    : '';
  const note = e.notes ? `<p class="note">${esc(e.notes)}</p>` : '';
  const honesty = resolved.representable
    ? '<p class="note">Distinct invariants prove positions distinct; equal invariants prove nothing.</p>'
    : '';
  infoPanel.innerHTML = `<h2>${esc(e.label)}</h2><dl>${rows.join('')}</dl>${flag}${note}${honesty}`;
}

// --- selection logic ----------------------------------------------------

let resolved: ResolvedEntry | null = null;

function refreshVariantSelect(preferredIndex: number): void {
  variantSelect.innerHTML = '';
  if (!resolved || !resolved.representable || resolved.variants.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '—';
    variantSelect.appendChild(opt);
    variantSelect.disabled = true;
    return;
  }
  resolved.variants.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i + 1} / ${resolved!.variants.length}: ${variantLabel(resolved!, v)}`;
    variantSelect.appendChild(opt);
  });
  variantSelect.disabled = resolved.variants.length < 2;
  variantSelect.value = String(preferredIndex);
}

function updateViews(): void {
  if (!resolved) return;
  if (!resolved.representable || resolved.variants.length === 0) {
    scene.setPosition(bareDancers);
    svgHost.innerHTML = renderFlagMessage(resolved.reason ?? 'multi-grip');
    renderInfo(resolved, null);
    return;
  }
  const idx = Math.min(Number(variantSelect.value) || 0, resolved.variants.length - 1);
  const built = buildVariant(resolved, idx);
  scene.setPosition(built);
  svgHost.innerHTML = renderDiagramSVG(built);
  renderInfo(resolved, built);
}

function selectPosition(id: string): void {
  const entry = byId.get(id);
  if (!entry) return;
  resolved = resolveEntry(entry);
  let preferred = 0;
  if (entry.preferredVariant && resolved.representable) {
    const i = resolved.variants.findIndex((v) => sameVariant(v, entry.preferredVariant!));
    if (i >= 0) preferred = i;
  }
  refreshVariantSelect(preferred);
  updateViews();
}

positionSelect.addEventListener('change', () => selectPosition(positionSelect.value));
variantSelect.addEventListener('change', updateViews);

positionSelect.value = 'named:crossed-two-hand';
selectPosition(positionSelect.value);
