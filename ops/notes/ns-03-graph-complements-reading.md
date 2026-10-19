# NS-03: the graph must complement reading, not replace it

**Status:** finding from the brownfield LLM pilot and re-pilot, 2026-10-19. The substitution is confirmed and the design rule is provisionally supported. The drift interpretation is **not** supported (see Update). Source: `Docs/DiagnosticRuns/v1.3-brownfield-llm-pilot-2026-10-19.md`.

## What we saw

In the brownfield pilot, arm G (graph tools plus files) scored below arm R (files only) on the "scored" variant: rules 18/36 vs 28/36. Three causes:
1. **One G session cited nothing** (luizomf G-r3). The scored variant drops every unit without evidence, so that spec collapsed. As written, G is at parity with R or better: mapping 0.83/0.92 vs 0.82/0.87, blocking findings 27/27 in both.
2. **"Rules" means rules applied to the right layers.** Every session had the same 27 preset rules. The model chooses the layer map and the layer order.
3. **The graph replaced reading.** On luizomf, all 3 R sessions read `README.md` and no G session did. G called `folder_dependency_matrix` once, then only listed files. It never used Cypher and never cited a graph statistic.

## What it means (hypothesis until confirmed)

- **A model given a compact structured tool tends to substitute it for reading.** This is partly a design failure and partly a prompting one.
- **The graph shows what the code is; the docs show what it was meant to be.** The reference spec A was written by a Claude session reading the same README, so R's agreement with A is partly shared source and shared prior. G's disagreements may be places where the code differs from the declared intent, which is drift and not error.

## Design rule (applies wherever a model meets the graph)

1. **Same reading in every arm.** The model reads the code and the docs (README, ADRs, comments). The graph is added on top.
2. **Use the graph to check and quantify.** Every proposed layer, rule, fact or verdict is checked against graph statistics, and those statistics are cited.
3. **Cite both kinds of evidence.** A unit with no citation fails at run time.
4. **Score against two references:** declared intent (docs, spec) and code reality (graph). Disagreement between the two is a measurement of drift.

## Where it applies

| Part | Change | Where it lands |
|---|---|---|
| C1d semantic enrichment | prompts require code plus the graph slice; each fact cites both | AI-DLC U3, amendment A1 (after PR #254) |
| C4 interpretation | receives the docs and ADRs, not only the subgraph, because intent is written in prose | AI-DLC U3, amendment A1 |
| C1c efficiency test (M5) | the arms become **files plus graph** vs **files only**, not graph only vs files | AI-DLC U8, amendment A1 |
| C2 brownfield norm derivation | the redesigned pilot (bf-01 v2) | re-pilot after your OK |

## Update 2026-10-19: re-pilot (`Docs/DiagnosticRuns/v1.3-brownfield-llm-repilot-2026-10-19.md`)
- **The mechanism diff (v1, zero calls):** none of G's differences from A were "right about the code", and none were plain errors. **G's v1 problem was omission:** it never opened a file. The substitution half of NS-03 holds. The drift interpretation ("G measured intent vs code") is **not supported**.
- **Re-pilot v2:** 9 valid sessions out of 18 planned (5 G-v2, 4 R-v2), all passing the citation gate. With the same reading procedure, **G-v2 ties R-v2 or beats it.** On luizomf both arms reach κ 0.90 against A, and G-v2 recovers 27/27 findings. On zeldaplay G-v2 has 1 extra finding against R-v2's 9, and slightly higher κ against A and against code reality. **NS-03's design rule is provisionally supported.** This is a tiny sample, and the Gemini arm hasn't run yet.

- **Morning 2026-10-19, Claude arms complete (6 G-v2, 6 R-v2):** luizomf a tie; zeldaplay G-v2 closer to A (verdict 1/3 vs 0/3, κ median 0.48 vs 0.39, 3 extra findings vs 12). Pooled finding precision 0.90 vs 0.69. R-v2 rarely opens a file (0 tools on zeldaplay), so it is effectively "docs in the prompt". Still one vendor: the Gemini arm's call path works on small prompts but stalls on the real one (re-pilot report §9).

- **Afternoon 2026-10-19, Gemini arm X 6/6** (re-pilot report §10). X has docs and the file list, with no graph and no tools. It reproduced A's findings exactly: precision 1.00, verdict 6/6, 0 extra findings on zeldaplay. **The graph's added value is not shown in this pilot.** G-v2's lead over R-v2 may come from a weak Claude R arm. The design rule (same reading in every arm, graph on top) stands. The claim "the graph improves derivation" does not.

## What would show we're wrong

- The diff shows G's differences from A are plain errors, not matches with the real import structure.
- In the redesigned pilot, G with forced reading still scores below R.
- The Gemini arm shows the same pattern, which would rule out a Claude-specific habit, or the opposite pattern, which would point to a prompt artefact.

## Changelog
- 2026-10-19: first version.
