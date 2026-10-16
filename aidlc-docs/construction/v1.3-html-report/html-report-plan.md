# v1.3 — Architect HTML report (`evaluate --html`): requirements and plan

**Branch:** `v1.3-html-report` from `origin/v1.3`; one PR into `v1.3`, not merged.
**Depth:** minimal requirements (the request is a complete spec), one unit, no user stories (single persona: the architect reading a run), no application design beyond this page (one new module inside `src/report/`).

## Requirements (from the request)

- R1 `evaluate --html <out.html>`: one static file, no network, inline JS/CSS, any library vendored and pinned.
- R2 Layer diagram with violating edges highlighted.
- R3 Per finding: rule in plain words, defining vs warning tier, code excerpt with line numbers, edge path, fix hint if v1.3 has a hints feature.
- R4 Filters by tier, rule, layer, file.
- R5 Summary of score and verdict, explaining what blocks the verdict.
- R6 Labels 'defining rule (can fail)' and 'warning (never fails)'; rule ids in tooltips only.
- R7 Snapshot tests on 3 reference variants (1 clean, 2 violating); Playwright render with no overflow and no console errors.
- R8 Docs/v1.3/html-report.md with screenshots under docs/images.
- Constraints: no .env or secrets read; main and v1.2e untouched; no Cypher template text or rule tier edited; default outputs of existing commands unchanged without the flag; jest --maxWorkers=2; engine Neo4j 5.26 + APOC from the tarball (`--engine cypher-interp` is not on v1.3).

## Decisions

- Tiers: v1.3 `blocking` → "defining rule (can fail)", `advisory` → "warning (never fails)", the FF-P06 N/A part → "not counted (not applicable)". Resolved with the scoring's own lookup (ruleTier, construct-switch resolver, partial split).
- Fix hint: v1.3 has no separate hints feature; the existing `actionable-formatter` `fix` text is used.
- No third-party library: the diagram is SVG generated server-side, so nothing needs vendoring; a CSP meta blocks network.
- Reference variants: `fixtures/correct-reference` (clean), `fixtures/variant-a-structural`, `fixtures/variant-b-pattern` with `specs/clean-arch.yaml`.

## Plan

- [x] Model builder (`src/report/architect/model.ts`), rule text, safe excerpt reader
- [x] Renderer: summary, SVG layer diagram, finding cards, filters (inline CSS/JS)
- [x] `evaluate --html` wiring in `src/cli/cli.ts`
- [x] Fixture capture script (Neo4j 5.26.24 + APOC 5.26.24 tarball) and committed inputs
- [x] Snapshot + model tests (`tests/unit/report/architect-html.test.ts`)
- [x] Playwright browser tests at 1280/768/375 px (`tests/integration/report/architect-html.browser.test.ts`)
- [x] Default-output check: json/human/csv of the 3 variants identical before/after with run-variable fields (runId, timings) masked; exit codes identical
- [x] Docs/v1.3/html-report.md and screenshots in docs/images
