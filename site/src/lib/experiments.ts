import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCollection, type CollectionEntry } from 'astro:content';

// Everything the pages need to know about experiments lives here:
// - the six known research threads (used for stub cards until their branches
//   merge and their NOTES.md files start being discovered by the glob),
// - title/summary/status derivation for NOTES.md files with no frontmatter,
// - per-experiment asset discovery (images shown as figures, CSV/JSON
//   rendered as tables, and the full list served by the asset endpoint).

export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
export const REPO_URL = 'https://github.com/zmaril/zdl-experiments';

export type ExperimentStatus = 'in progress' | 'complete';

/**
 * The research threads we know are in flight on unmerged branches. Each gets
 * a stub card (and a stub page) until a NOTES.md with a matching id lands on
 * this branch — at which point the real notes replace the stub automatically,
 * with zero changes needed here.
 */
export interface KnownThread {
  id: string;
  branch: string;
  title: string;
  summary: string;
}

export const KNOWN_THREADS: KnownThread[] = [
  {
    id: 'knot-models',
    branch: 'knot-models',
    title: 'Knot theory for partner dance connections',
    summary:
      'Dance positions as tangles, braids, and links — recovering the entanglement data (crossed arms, wraps, hammerlocks) that the set-partition model ignores.',
  },
  {
    id: 'hands-regions',
    branch: 'hands-regions',
    title: 'Contact regions of the hand',
    summary:
      'Contact-region combinatorics of grips: carving the hand into regions and counting which region-to-region contacts are possible between two dancers.',
  },
  {
    id: 'hands-taxonomy',
    branch: 'hands-taxonomy',
    title: 'A taxonomy of grips',
    summary:
      'A literature survey of grasp taxonomies — from robotics and biomechanics to what actually happens in a handhold on the social dance floor.',
  },
  {
    id: 'hands-tangles',
    branch: 'hands-tangles',
    title: 'Grips as mini-tangles',
    summary:
      'Zooming the knot-theory lens all the way into a single handhold: modeling grips themselves as small tangles with their own crossing data.',
  },
  {
    id: 'hands-kinematics',
    branch: 'hands-kinematics',
    title: 'Grips as kinematic pairs',
    summary:
      'Treating each grip as a kinematic pair: what degrees of freedom it allows, and a grips-by-moves table of which moves each grip can transmit.',
  },
  {
    id: 'hands-empirical',
    branch: 'hands-empirical',
    title: 'Grips, empirically',
    summary:
      'Pose estimation (MediaPipe) on photos of real grips: checking the theoretical grip models against what dancers actually do with their hands.',
  },
];

export type Experiment =
  | {
      kind: 'notes';
      id: string;
      title: string;
      summary: string;
      status: ExperimentStatus;
      entry: CollectionEntry<'experiments'>;
      /** Absolute path of the directory containing this NOTES.md. */
      dir: string;
      branch?: string;
    }
  | {
      kind: 'stub';
      id: string;
      title: string;
      summary: string;
      status: ExperimentStatus;
      branch: string;
    };

function normalizeStatus(raw: string | undefined): ExperimentStatus {
  const s = (raw ?? '').trim().toLowerCase();
  if (['complete', 'completed', 'done', 'finished'].includes(s)) {
    return 'complete';
  }
  return 'in progress';
}

/** First `# heading` in the markdown body, sans inline markup. */
function titleFromBody(body: string): string | undefined {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? stripInlineMarkdown(m[1]) : undefined;
}

/** First non-heading paragraph, flattened to plain-ish text and truncated. */
function summaryFromBody(body: string): string {
  const blocks = body
    .replace(/^---\n[\s\S]*?\n---\n/, '') // frontmatter, if the loader left it
    .split(/\n\s*\n/);
  for (const block of blocks) {
    const t = block.trim();
    if (!t || t.startsWith('#') || t.startsWith('```') || t.startsWith('|')) {
      continue;
    }
    const text = stripInlineMarkdown(t.replace(/\n/g, ' '));
    if (text.length > 200) {
      return text.slice(0, 197).replace(/\s+\S*$/, '') + '…';
    }
    return text;
  }
  return '';
}

function stripInlineMarkdown(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links
    .replace(/[*_`]/g, '')
    .trim();
}

function fromEntry(entry: CollectionEntry<'experiments'>): Experiment {
  const data = (entry.data ?? {}) as {
    title?: string;
    summary?: string;
    status?: string;
  };
  const body = entry.body ?? '';
  const known = KNOWN_THREADS.find((t) => t.id === entry.id);
  return {
    kind: 'notes',
    id: entry.id,
    title: data.title ?? titleFromBody(body) ?? entry.id,
    summary: data.summary ?? summaryFromBody(body),
    status: normalizeStatus(data.status),
    entry,
    dir: entry.filePath ? path.dirname(entry.filePath) : REPO_ROOT,
    branch: known?.branch,
  };
}

/**
 * All experiments, discovered notes first (in id order), then stubs for the
 * known threads whose NOTES.md hasn't landed on this branch yet.
 */
export async function getExperiments(): Promise<Experiment[]> {
  const entries = await getCollection('experiments');
  const discovered = entries
    .map(fromEntry)
    .sort((a, b) => a.id.localeCompare(b.id));
  const discoveredIds = new Set(discovered.map((e) => e.id));
  const stubs: Experiment[] = KNOWN_THREADS.filter(
    (t) => !discoveredIds.has(t.id),
  ).map((t) => ({
    kind: 'stub',
    id: t.id,
    title: t.title,
    summary: t.summary,
    status: 'in progress',
    branch: t.branch,
  }));
  return [...discovered, ...stubs];
}

// ---------------------------------------------------------------------------
// Per-experiment assets
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
]);
const DATA_EXTENSIONS = new Set(['.csv', '.json']);

/** Tooling files that should never be rendered as "results". */
const DATA_FILE_DENYLIST = [
  /^package(-lock)?\.json$/,
  /^tsconfig.*\.json$/,
  /^deno\.json$/,
  /^bun\.lock/,
  /\.config\.json$/,
  /^\.[^.]/, // dotfiles
];

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'site',
  '.git',
  '.astro',
]);

const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_TABLE_BYTES = 512 * 1024;

function isDeniedDataFile(name: string): boolean {
  return DATA_FILE_DENYLIST.some((re) => re.test(name));
}

/**
 * Images sitting directly alongside a NOTES.md. Shown in a "Figures" section
 * on the experiment page (images referenced inline from the notes also work,
 * at any depth, via the asset endpoint + rehype rewrite).
 */
export function listImages(dir: string): string[] {
  return listDirFiles(dir).filter((f) =>
    IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()),
  );
}

/**
 * CSV/JSON results sitting directly alongside a NOTES.md, minus tooling files
 * (package.json, tsconfig.json, lockfiles, …). Rendered as tables.
 */
export function listDataFiles(dir: string): string[] {
  return listDirFiles(dir).filter(
    (f) =>
      DATA_EXTENSIONS.has(path.extname(f).toLowerCase()) &&
      !isDeniedDataFile(f),
  );
}

function listDirFiles(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort();
}

/**
 * Every servable asset under an experiment directory (depth <= 3), as paths
 * relative to the repo root. Used by the /experiment-assets endpoint so that
 * images referenced from NOTES.md in subdirectories (photos/, figures/, …)
 * resolve too.
 */
export function listServableAssets(dir: string): string[] {
  const out: string[] = [];
  const visit = (d: string, depth: number) => {
    if (depth > 3) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) visit(abs, depth + 1);
        continue;
      }
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext) && !DATA_EXTENSIONS.has(ext)) continue;
      if (isDeniedDataFile(e.name)) continue;
      try {
        if (fs.statSync(abs).size > MAX_ASSET_BYTES) continue;
      } catch {
        continue;
      }
      out.push(path.relative(REPO_ROOT, abs).split(path.sep).join('/'));
    }
  };
  visit(dir, 1);
  return out.sort();
}

// ---------------------------------------------------------------------------
// Tables from CSV / JSON results
// ---------------------------------------------------------------------------

export interface ResultTable {
  file: string;
  columns: string[];
  rows: string[][];
  /** Set when the JSON wasn't tabular; rendered as <pre> instead. */
  raw?: string;
  truncated: boolean;
}

const MAX_TABLE_ROWS = 200;

export function loadResultTable(dir: string, file: string): ResultTable | null {
  const abs = path.join(dir, file);
  let text: string;
  try {
    if (fs.statSync(abs).size > MAX_TABLE_BYTES) {
      return { file, columns: [], rows: [], raw: '(file too large to preview)', truncated: true };
    }
    text = fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
  if (file.toLowerCase().endsWith('.csv')) return csvTable(file, text);
  return jsonTable(file, text);
}

function csvTable(file: string, text: string): ResultTable {
  const rows = parseCsv(text);
  if (rows.length === 0) return { file, columns: [], rows: [], truncated: false };
  const [header, ...body] = rows;
  return {
    file,
    columns: header,
    rows: body.slice(0, MAX_TABLE_ROWS),
    truncated: body.length > MAX_TABLE_ROWS,
  };
}

/** Small RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

function jsonTable(file: string, text: string): ResultTable {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { file, columns: [], rows: [], raw: text.slice(0, 4000), truncated: text.length > 4000 };
  }
  // Array of flat objects -> table.
  if (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))
  ) {
    const records = data as Record<string, unknown>[];
    const columns = [...new Set(records.flatMap((r) => Object.keys(r)))];
    const rows = records
      .slice(0, MAX_TABLE_ROWS)
      .map((r) => columns.map((c) => cellText(r[c])));
    return { file, columns, rows, truncated: records.length > MAX_TABLE_ROWS };
  }
  // Anything else: pretty-printed JSON.
  const pretty = JSON.stringify(data, null, 2);
  return {
    file,
    columns: [],
    rows: [],
    raw: pretty.length > 4000 ? pretty.slice(0, 4000) + '\n…' : pretty,
    truncated: pretty.length > 4000,
  };
}

function cellText(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
