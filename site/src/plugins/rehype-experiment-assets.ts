import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTES.md files live *outside* the site root (they belong to the research
// threads, up in the repo), so images they reference with relative paths
// ("./photos/grip.jpg", "figure.png") would 404 in a normal Astro build.
//
// This rehype plugin rewrites those relative <img> sources to point at the
// /experiment-assets/[...path] endpoint (src/pages/experiment-assets/), which
// serves files straight out of the repo at build time. Absolute URLs,
// data: URIs, and anchors are left alone.

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function isRelativeAsset(src: string): boolean {
  return !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(src);
}

export function rehypeExperimentAssets() {
  return (tree: HastNode, file: { path?: string }) => {
    const mdPath = file.path;
    if (!mdPath) return;
    const mdDir = path.dirname(mdPath);

    const walk = (node: HastNode) => {
      if (node.tagName === 'img' && node.properties) {
        const src = node.properties.src;
        if (typeof src === 'string' && isRelativeAsset(src)) {
          const abs = path.resolve(mdDir, decodeURIComponent(src));
          const rel = path.relative(REPO_ROOT, abs);
          // Only rewrite paths that stay inside the repo.
          if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
            node.properties.src =
              '/experiment-assets/' + rel.split(path.sep).join('/');
          }
        }
      }
      for (const child of node.children ?? []) walk(child);
    };

    walk(tree);
  };
}
