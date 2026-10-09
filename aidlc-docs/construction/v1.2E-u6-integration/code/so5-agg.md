# U6 lane SO5-agg (ADR-021)

**Date**: 2026-10-09. **Branch**: `v1.2e-u6-so5agg`, PR #33. **Findings closed**: SO5-07, X-3 and THR-4 (`Docs/DiagnosticRuns/so-readiness-audit-2026-10-08.json`). No live LLM call, no generation, no E1, E7, SO4 or labelling run.

## What changed

| Finding | Change |
|---|---|
| X-3, SO5-07 (density, latency) | `scripts/lib/so5-size.ts` (pure functions, plus `treeLoc` and `readGenerationEffort`, which read the tree). LOC is the number of non-blank lines of the `src/**/*.ts` files that `fileCount` counts. `sourceFilePaths` was factored out of `countSourceFiles` in `scripts/lib/generators/outcome.ts`, so both use one file set. `joinOutcome` (`scripts/run-experiment.ts`) stores `loc`, `generationDurationMs`, `numTurns` and `totalCostUsd` on a joined cell only. These are new optional fields of `GenerationCell` and of the run-record schema. `so5_grid.csv` appends `loc`, `violations_deterministic`, `violations_total`, `violations_per_kloc`, `violations_total_per_kloc`, `generation_ms`, `generation_turns`, `generation_cost_usd` and `eval_total_ms` (the report's `timings.totalMs`). `so5_tests.csv` gains the exploratory family `secondary:violations_per_kloc`. |
| THR-4 | `aggregate.ts` `so5Stratum(task, other)`. Model labels are permuted within (task, spec level) and spec-level labels within (task, model). The directional check is permuted within (task, spec level). The interaction keeps task blocks. `stats.ts` is unchanged. The selection threat is registered in analysis plan §8, with valid-generation yield as its mitigation. |
| SO5-07 (open coding, deviation) | `scripts/so5-open-coding.ts` and `scripts/so5-open-coding-cli.ts` (`--self-test` exits 1), with `scripts/lib/so5-open-coding.ts`. They write `open-coding-input.json` and `open-coding-key.csv`. The input holds the E1 P3 `TP` and `unseeded-TP` items and the P4 `fail` items. Condition terms and ids are redacted, and the order is a seeded shuffle (seed 6104) with ids `OC-0001…`. The key maps each id to its item, run, cell, rule, FPAT family and weight 1 / p. The procedure is registered in analysis plan §6: the agy panel proposes codes, and the author, declared non-blind, consolidates them. It is exploratory only. The generator temperature/seed deviation is in §6, TV-78 and the deviation table. |
| SO5-gen open item | Analysis plan §1 now documents the join codes `GEN-MISSING` and `GEN-PROTOCOL-MISMATCH` beside the `genCodes` table. The machine block is unchanged. |
| Not-run cell helper | It was already wired by SO5-gen (PR #25, #30: `so5Records`, `completeE1Cells`, `missingE1Record`). The new columns stay empty on not-run cells, except `loc` and the effort fields, which only a joined outcome records. |

## Files

- New: `scripts/lib/so5-size.ts`, `scripts/lib/so5-open-coding.ts`, `scripts/so5-open-coding.ts`, `scripts/so5-open-coding-cli.ts`, `tests/unit/scripts/u6/so5-agg.test.ts`.
- Changed: `scripts/aggregate.ts`, `scripts/run-experiment.ts`, `scripts/lib/generators/outcome.ts`, `scripts/lib/report-io.ts`, `scripts/lib/schemas/run-record.schema.json`, `tests/unit/scripts/u5b/run-experiment.test.ts`, `tests/fixtures/u6/figures/so5_grid.csv` (header extended), `Docs/analysis-plan.md`, `Docs/threats-to-validity.md` (TV-25, TV-30, TV-77, TV-78 and one deviation line).

## Tests

- `so5-agg.test.ts` has 16 tests, all hand-computed:
  - non-blank lines and tree LOC (5 over a tree with `.js`, `node_modules` and out-of-`src` decoys);
  - density (3 per 1500 LOC = 2), effort extraction, the grid columns for a valid and a not-run cell, and the density family;
  - THR-4 on a confounded unbalanced design: stratified model p = 1 against ≈ 34/70 within task only. A real effect gives p < 0.02, and the directional check gives p = 1;
  - open coding: 3 of 8 labels coded, redaction, key weights 2 and 4, a refusal, and the CLI with `--self-test`.
- `run-experiment.test.ts` checks that a joined cell carries `loc` 3 and the envelope effort, and that the record validates against the schema.
- Full `npm test -- --maxWorkers=2` under the lane lock: 3231 passed and 1 failed. The failure is `tests/unit/cli/cli.test.ts` "defaults neo4j-uri". The lane preamble exports `NEO4J_URI`, and the test passes without it (environment only). Gate T is clean (`typecheck`, `tsconfig.scripts.json`, `tsconfig.u4-tests.json`). Gate L shows no new errors in the changed `src` and `tests` files. Gate G: the golden is unchanged and there is no CHANGES.md line.

## Registered artefacts touched (the P-U6 bump must cover them)

1. `Docs/analysis-plan.md`: §1 join-code paragraph, §3 SO5 row and size/latency definitions, §6 strata, directional check, temperature/seed deviation and open-coding procedure, §8 selection threat, §10 B4, and five §11 rows. Its hash changes, so the gate refuses every plan (`artefact-changed`) until P-U6 re-hashes it.
2. `Docs/threats-to-validity.md`: rows TV-25, TV-30, TV-77 and TV-78 and the deviation table. It is registered by P-U6 (TV-02).
3. No change to `corpus/prereg.json`, `REGISTERED_ARTEFACTS` or any plan file. The run-record schema is not a registered artefact.

## Open items

- `latency.csv` of `aggregate.ts` reports `total_ms` from the report's `durationMs`, which is the scoring-stage time (`scoring-engine.ts`), not the pipeline total. `so5_grid.csv` `eval_total_ms` uses `timings.totalMs`. The SO2 lane's `so2-metrics` `latency.csv` is the registered SO2 output, so this lane leaves the aggregate column as it is. P-U6 or SO2 should say which `total_ms` is meant.
- Open-coding step 2 (the agy panel's proposal) needs live calls. It is not run here. It uses the 300-call label budget only if budget remains after P1–P4.
- E1 records written before this lane carry no `loc` or effort. The E1 grid has not been run, so nothing needs a backfill. The existing pilot outcomes are never joined.
