# U3 amendment A1: the graph complements reading, it doesn't replace it

**Date:** 2026-10-19. **Requested by:** the author, after the brownfield pilot. **Source:** `ops/notes/ns-03-graph-complements-reading.md`.
**Status:** approved by the author for inclusion. PR #254 (already built): applied as a follow-up commit on the same branch, after the author reviews.

## Why
In the brownfield pilot, the arm with graph tools stopped reading the docs and code, and used the folder matrix instead. That dropped evidence and changed what the model compared against. Wherever a model meets the graph, the graph must be added to reading, never put in its place.

## Change
- **C1d (semantic enrichment):** every model prompt supplies the graph slice **and** the relevant code, plus the docs where they exist. Each fact in the A2 facts file cites at least one code or doc location **and** one graph statistic or query, where one applies. A fact with no citation is rejected when it is written, not at scoring.
- **C4 (interpretation through facts):** the model receives the project's docs, ADRs and comments near the finding, not only the subgraph, because intent and declared exceptions are written in prose.
- **Tests:** a mock-model test showing that a fact with no citation is rejected, and that the prompt builder includes both code and graph context.

## Done when
The design reflects this section, the tests above exist and pass, and the PR description lists A1.
