import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The publishing convention, in one place.
//
// At build time we glob the repo (the parent of site/) for experiment notes:
//
//   NOTES.md          -> the repo-root experiment (currently knot-models)
//   */NOTES.md        -> e.g. knot-models/NOTES.md
//   */*/NOTES.md      -> e.g. hands/regions/NOTES.md
//
// Each NOTES.md becomes a page at /experiments/<id>/, where <id> is the
// directory path with slashes turned into dashes (hands/regions -> the id
// "hands-regions"). The repo-root NOTES.md is special-cased to the id
// "knot-models", because that is the experiment it documents; if a
// knot-models/NOTES.md ever appears it takes over that id naturally.
//
// Frontmatter is OPTIONAL. A NOTES.md with no meta block at all is fully
// supported: the title falls back to the first `# heading`, the summary to
// the first paragraph, and the status to "in progress". If present, we honor:
//
//   ---
//   title: Grips as kinematic pairs
//   summary: One-line description shown on the landing-page card.
//   status: complete        # or "in progress" (the default)
//   ---
const experiments = defineCollection({
  loader: glob({
    pattern: [
      'NOTES.md',
      '*/NOTES.md',
      '*/*/NOTES.md',
      // Never treat the site itself, dependencies, or build output as
      // experiments.
      '!site/**',
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/.git/**',
    ],
    base: '..',
    generateId: ({ entry }) => {
      const normalized = entry.replace(/\\/g, '/');
      if (normalized === 'NOTES.md') return 'knot-models';
      return normalized.replace(/\/NOTES\.md$/, '').replace(/\//g, '-');
    },
  }),
  schema: z
    .object({
      title: z.string().optional(),
      summary: z.string().optional(),
      // Kept as a free string and normalized in src/lib/experiments.ts so a
      // stray value ("done", "wip") never breaks the build.
      status: z.string().optional(),
    })
    .passthrough(),
});

export const collections = { experiments };
