# v1.5 Semantic Instrument: Requirements (standard depth)

**Cycle:** AI-DLC v1.5, the "semantic instrument" cycle. **Started:** 2026-10-22. **Depth:** standard. The intent is clear, and the design work exists in `ops/`. Scope choices are settled in `requirements-questions.md`, all answered with the recommended options.

## 1. Intent

Build instrument v1.5 so that it works where v1.4 is blind, and so that its neuro-symbolic half is shown. The semantic layer is the centre of the cycle. v1.5 must:
- detect the violations coding agents actually commit (multi-aggregate and cross-context writes, rule placement, contract and port shape);
- interpret findings semantically;
- work without known rules, by inferring the spec;
- deliver its findings so that agents act on them.

At the end of the cycle, a final confirmatory study is designed. It is not registered until v1.5 is trusted.

**Sources of truth** (linked here, not copied):

| Source | What it settles |
|---|---|
| [`ops/notes/v15-plan.md`](../../../ops/notes/v15-plan.md) | The working plan: detection, delivery, puzzles, validity, spec inference, the final study, the release |
| [`ops/notes/v15-semantic-programme.md`](../../../ops/notes/v15-semantic-programme.md) | The semantic roles S1–S5, their tests, and the three-arm comparison |
| [`ops/notes/explore-01-research-log.md`](../../../ops/notes/explore-01-research-log.md) | The evidence so far (entries 1–9) |
| [`ops/notes/detect-02-design.md`](../../../ops/notes/detect-02-design.md), [`ops/notes/detect-02-precision-note.md`](../../../ops/notes/detect-02-precision-note.md) | The DETECT-02 facts and rules, and their precision revisions |
| [`ops/04-north-star.md`](../../../ops/04-north-star.md) | Each part is tested on its own, then the whole instrument |

**Classification.** A brownfield enhancement touching multiple components (extractor, rules, semantic layer, MCP server, delivery). Complex. The reverse-engineering artifacts exist and are not refreshed.

**Fixed constraints** (decided by the author):
- Study 2b stays closed at v1.4. The tag `v1.4-freeze-2026-10-20` and the registered artefacts never change.
- Everything is exploratory until the final study is designed. There is no sealed or held-out evaluation in this cycle.
- Every model-calling step has a thinking note before it runs.

## 2. Functional requirements

| FR | What | Part | Done when |
|---|---|---|---|
| FR-1 | The extractor emits the DETECT-02 facts (command write footprint, context ownership, port calls resolved to their adapters) | C1a/b | A fidelity test against hand-checked truth passes; existing tsc parity still holds |
| FR-2 | The v1.5 rules R-D4 (one command, one aggregate) and R-XCTX (cross-context write) join the rule catalogue. The spec declares allowances such as a batch command | C2/C3 | Rules pass the precision fixtures (0 false positives) and the dev trap trees |
| FR-3 | The remaining DETECT-02 families (rule placement, contract shape, port mechanism, concrete injection, remote call in a transaction) are verified family by family | C3 | Each family passes its fixtures, or is left out and documented |
| FR-4 | `check_consistency`, and actionable messages (where, rule, why, fix) for every rule, are served by the real MCP server | C6 | Tool tests pass; latency is under 200 ms per symbolic call |
| FR-5 | Edit-gate delivery: the checks run after each agent edit and appear like a compiler error | C6 | Smoke test with zero calls; per `ops/notes/v15-edit-gate-design.md` |
| FR-6 | Fix the composition-root mismatch between the MCP check and the scorer (DA1) | C6/C3 | The two agree on every Q25 exempt file |
| FR-7 | S1: C4 severity calibration, using a rubric | C4 | The six-case set plus new cases pass, with twins clean (development evidence) |
| FR-8 | S3: C1d supplies aggregate and ownership facts to the rules when the spec is silent, with grounding | C1d | On the human DDD repositories the false hits fall and the true hit stays |
| FR-9 | S2: semantic confirmation of symbolic candidates | C4/C1d | Lift over the rules alone on dev fixtures and twins |
| FR-10 | S4: the spec-inference pipeline (infer → compile → run → interpret → refine), with majority and outlier signals | C2 derived | Hidden-spec test: the declared spec is recovered and the planted debt is flagged |
| FR-11 | S5: grounded fix hints | C6 | The puzzle-arm comparison is run |
| FR-12 | A harness for the three-arm comparison (symbolic, semantic, both) | evaluation | Runs on the dev material and reports per family |
| FR-13 | Puzzles: restore P3, add a cross-context puzzle and a harder Layered puzzle, and answer keys that resist gaming | evaluation | `verify.ts` marks every puzzle VALID |
| FR-14 | Release v1.5: version bump, changelog and a tag; the v1.4 artefacts stay protected | release | Tag pushed; CI hash gate green |

## 3. Non-functional requirements

- **NFR-1, protection:** no change to the v1.4 tag or to any registered 2b artefact. The CI hash gate stays green.
- **NFR-2, determinism:** the symbolic parts are deterministic. Semantic calls are recorded and replay with zero calls. The model configuration is recorded per run, and the semantic configuration is a swappable parameter (vendor-neutral route).
- **NFR-3, budget:** every pilot has a call cap that is never raised. Heavy local work respects the machine limits (at most 2 lanes, one capped Neo4j, `jest --maxWorkers=2`) and the weekly usage. Cloud credits are used for suitable pilots.
- **NFR-4, security baseline** (extension enabled since v1.2): MCP confinement (`--confine`), no secrets in records, no personal paths in committed files, and least-privilege generator isolation in agent pilots.
- **NFR-5, records:** every run has a report under `Docs/DiagnosticRuns/` with exact numbers, so THESIS-SYNC can pick it up. Decisions are recorded neutrally.

## 4. Settled scope (from `requirements-questions.md`)

1. **Order:** semantic first. Pilots S1–S3 run on development material, then the symbolic DETECT-02 work is promoted.
2. **Code location:** code lives under `experiments/` until each part passes its own test, then moves into `src/`.
3. **Vendor:** Claude now. Gemini follows as a swap arm after its quota resets.
4. **Spec inference (S4):** a full part of v1.5, with its hidden-spec test.
5. **Delivery:** v1.5 ships both pull and the edit gate. The pilots decide the default.
6. **Final study:** a design draft is a deliverable of this cycle. Registration waits until v1.5 is trusted.
7. **Security Baseline:** stays enabled.

## Changelog
- 2026-10-22: questions answered (recommended options, standing delegation); requirements final.
- 2026-10-22: draft, before the answers.
