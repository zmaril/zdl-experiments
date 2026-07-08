# zdl-experiments site

Static [Astro](https://astro.build) site that publishes the research notes in
this repository. It lives entirely in `site/`; the experiments never depend on
it.

```sh
cd site
npm install
npm run dev     # http://localhost:4321
npm run build   # -> site/dist/
```

## Publishing convention: drop a NOTES.md in your experiment dir

The site requires **zero** work from research threads. At build time it globs
the repo (the parent of `site/`) for notes files:

- `NOTES.md` (repo root — currently the knot-models experiment)
- `*/NOTES.md` (e.g. `knot-models/NOTES.md`)
- `*/*/NOTES.md` (e.g. `hands/regions/NOTES.md`)

(`site/`, `node_modules/`, `dist/`, and `.git/` are excluded.) Every match
becomes a page at `/experiments/<id>/`, where `<id>` is the directory path
with slashes turned into dashes: `hands/regions/NOTES.md` →
`/experiments/hands-regions/`. The repo-root `NOTES.md` maps to the id
`knot-models` (that is the experiment it documents); a `knot-models/NOTES.md`
would take over that id naturally.

For each page:

- **Title** comes from the first `# heading` in the file.
- **Summary** (shown on the landing-page card) is the first paragraph.
- **Section nav** is generated from the `##`/`###` headings.
- **Math**: `$...$` and `$$...$$` TeX renders via KaTeX
  (remark-math + rehype-katex).
- **Status** defaults to *in progress*.

### Optional meta block

Never required, but honored if present as YAML frontmatter at the top of a
`NOTES.md`:

```markdown
---
title: Grips as kinematic pairs
summary: One-line description for the landing-page card.
status: complete        # anything else (or absent) reads as "in progress"
---
```

### Optional assets

Also zero-config:

- **Results tables**: any `*.csv` or `*.json` sitting directly next to a
  `NOTES.md` is rendered as a table in a "Results data" section (JSON arrays
  of flat objects become tables; other JSON is pretty-printed). Tooling files
  (`package.json`, `package-lock.json`, `tsconfig*.json`, lockfiles, dotfiles)
  are ignored. Previews are truncated at 200 rows.
- **Figures**: images (`png/jpg/jpeg/gif/svg/webp/avif`) directly next to a
  `NOTES.md` appear in a "Figures" section.
- **Inline images**: relative image references inside a `NOTES.md`
  (`![cap](./photos/grip.jpg)`) work at any depth up to 3 levels below the
  experiment dir; they are served from `/experiment-assets/<repo-path>`.
  Referenced files must be valid images — a corrupt image fails the build.

### Known threads / stubs

Research threads that are still on unmerged branches get stub cards and stub
pages, listed in `src/lib/experiments.ts` (`KNOWN_THREADS`). As soon as a
branch merges and its `NOTES.md` appears on the built branch, the real notes
replace the stub automatically — no site changes needed. Add new upcoming
threads to `KNOWN_THREADS`; remove entries only if a thread is abandoned
(entries whose notes exist are ignored anyway).

## Embedding the knot-models viewer

The knot-models thread is building a three.js viewer (`web/` in the repo).
The `/experiments/knot-models/` page has a documented placeholder section
(`id="viewer"` in `src/pages/experiments/[id].astro`) reserved for it. When
the viewer has a build, embed it either as:

1. an `<iframe>` pointing at the viewer's built output (copy it into
   `site/public/viewer/` during the build, or deploy it alongside), or
2. an Astro island (`client:only`) wrapping the viewer as a component —
   three.js needs the browser, so do not server-render it.

## Deploying

The build is plain static output (`site/dist/`) — no adapter needed.

### Cloudflare Pages (current setup)

The repo has a Cloudflare Pages Git integration (project `zdl-experiments`)
that builds every push. For it to go green, set in the Cloudflare dashboard
(Pages → zdl-experiments → Settings → Builds & deployments):

- **Root directory:** `site`
- **Build command:** `npm run build`
- **Build output directory:** `dist` (i.e. `site/dist` from the repo root)

No environment variables or adapter required. Node 20+ (Astro 5 requires it);
set `NODE_VERSION=22` in the Pages build settings if the default is older.

### GitHub Pages (alternative, one config flip)

1. In `astro.config.ts`, set `site: 'https://zmaril.github.io'` and
   `base: '/zdl-experiments'`.
2. Swap the artifact-upload step in `.github/workflows/site.yml` for
   `actions/upload-pages-artifact` + `actions/deploy-pages` (or use
   `withastro/action`), and enable Pages in the repo settings.

Internal links already respect `import.meta.env.BASE_URL`, so the base flip is
safe.

## CI

`.github/workflows/site.yml` builds the site on every push as a check and
uploads `site/dist` as an artifact. It does not deploy.
