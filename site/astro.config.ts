import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeExperimentAssets } from './src/plugins/rehype-experiment-assets';

// Static site for Zack's Dance Lab experiments.
//
// The site lives in site/ inside the zdl-experiments repo. At build time it
// globs the *parent* repo for NOTES.md files (see src/content.config.ts) and
// renders each one as an experiment page. Research threads never have to do
// anything site-specific: drop a NOTES.md in your experiment directory and it
// shows up here on the next build.
//
// Deploy note: for GitHub Pages under a project path, set `site` and `base`
// here (e.g. site: 'https://zmaril.github.io', base: '/zdl-experiments') and
// see site/README.md for the one-flip workflow change.
export default defineConfig({
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      // Renders $...$ / $$...$$ TeX in NOTES.md via KaTeX (CSS imported in
      // the base layout).
      rehypeKatex,
      // Rewrites relative image paths in NOTES.md (which live outside the
      // site root) to the /experiment-assets/ endpoint that serves them.
      rehypeExperimentAssets,
    ],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
