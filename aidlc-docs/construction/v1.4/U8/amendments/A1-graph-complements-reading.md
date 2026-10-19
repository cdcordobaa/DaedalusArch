# U8 amendment A1: the graph complements reading, it doesn't replace it

**Date:** 2026-10-19. **Requested by:** the author, after the brownfield pilot. **Source:** `ops/notes/ns-03-graph-complements-reading.md`.
**Status:** approved by the author for inclusion. Built in U8 (PR #259): design §2.9 (DR-A1-1 to DR-A1-6) and plan step 10a.

## Why
In the brownfield pilot, the arm with graph tools stopped reading the docs and code, and used the folder matrix instead. That dropped evidence and changed what the model compared against. Wherever a model meets the graph, the graph must be added to reading, never put in its place.

## Change
- **Arms:** the comparison is **files plus graph tools** vs **files only**. Both arms share the same reading procedure (docs and code). The graph arm adds the MCP tools, with instructions to check and quantify answers with them. There is no graph-only arm.
- **Scoring:** answers are also checked for whether the graph arm cites graph evidence, so a graph tool that was never used shows up as such.
- **Call count:** unchanged in shape. Re-state it in the design.

## Done when
The design reflects this section, the tests above exist and pass, and the PR description lists A1.
