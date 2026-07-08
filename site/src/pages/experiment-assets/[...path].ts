import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute } from 'astro';
import {
  getExperiments,
  listServableAssets,
  REPO_ROOT,
} from '../../lib/experiments';

// Serves per-experiment assets (images, CSV, JSON) out of the repo, since
// experiment directories live outside the site root and can't use public/.
// URLs are repo-root-relative: /experiment-assets/hands/empirical/photo.jpg.
// The rehype-experiment-assets plugin rewrites relative <img> paths in
// NOTES.md to point here, and the Figures/Results sections link here too.
// This is a fully static endpoint: every asset is enumerated at build time
// and emitted into dist/.

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

export async function getStaticPaths() {
  const experiments = await getExperiments();
  const seen = new Set<string>();
  const paths: { params: { path: string } }[] = [];
  for (const experiment of experiments) {
    if (experiment.kind !== 'notes') continue;
    for (const rel of listServableAssets(experiment.dir)) {
      if (seen.has(rel)) continue;
      seen.add(rel);
      paths.push({ params: { path: rel } });
    }
  }
  return paths;
}

export const GET: APIRoute = ({ params }) => {
  const rel = params.path!;
  const abs = path.resolve(REPO_ROOT, rel);
  // Guard against traversal; getStaticPaths only emits repo-internal paths.
  if (!abs.startsWith(path.resolve(REPO_ROOT) + path.sep)) {
    return new Response('Not found', { status: 404 });
  }
  let body: Buffer;
  try {
    body = fs.readFileSync(abs);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const ext = path.extname(abs).toLowerCase();
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
    },
  });
};
