# zdl-experiments — knot theory for partner-dance connections

Experiments extending the set-partition model of two-dancer hand connections
from Zack Maril's
["A New Kind of Dance Science"](https://www.zacksdancelab.com/blog/a-new-kind-of-dance-science)
(15 hand partitions × hammerlock states → 240 candidates → 157 feasible
positions) with the spatial entanglement data that model deliberately drops:
crossed vs uncrossed arms, over/under, wraps behind the back.

Three formalisms, built from scratch in dependency-free TypeScript:

- **Tangles** (`src/core/tangle.ts`, `src/model/tangles.ts`) — arms as open
  strands, torsos as obstacle bars, grips fusing hand endpoints;
- **Braids** (`src/core/braid.ts`, `src/model/moves.ts`) — dance moves as
  braid words, "does this sequence unwind?" as the word problem;
- **Links** (`src/core/diagram.ts`, `bracket.ts`) — closures with exact
  invariants (linking number, Kauffman bracket → Jones polynomial) that
  prove positions distinct.

Headline results: all six census counts from the blog post reproduced
exactly (the unpublished "impossible" rule is a documented reconstruction);
the topology refines the 157 feasible states into **[167, 223] entanglement
classes across 298 enumerated diagrams** within a stated crossing bound.
Details, caveats, and findings in [NOTES.md](NOTES.md).

## Run it

```
npm install
npm test           # 128 tests
npm run enumerate  # reproduce the census + refinement table
npm run dev        # interactive 3D/2D visualization (Vite + three.js)
```

MIT licensed; no vendored code.
