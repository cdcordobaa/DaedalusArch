# U7 Code Generation Plan: meaning analysis script (C3m)

**Unit:** U7, map part C3m meaning (P3). **Design:** `aidlc-docs/construction/v1.4/U7/functional-design/design.md` (BR-xx ids below refer to it). **Spec:** `ops/notes/mean-01-codebook-and-sample.md` §4 and §9.
**Depth:** minimal. **Language:** TypeScript (`tsx`), jest. **Machine limits:** `jest --maxWorkers=2`; no Neo4j, no network, no model or API calls.
**Not touched:** `ops/`, `aidlc-docs/audit.md`, `aidlc-docs/aidlc-state.md`, `scripts/lib/stats.ts`, `src/`, `results/v1.3-meaning/labels/`, the v1.3 and v1.2e branches.

## Step 1: Contracts and loader

- [x] 1.1 Create `scripts/v1.3/lib/meaning/types.ts` with `Answer`, `ReasonCode`, `Field`, `SampleItem`, `AnswerRow`, `Sheet`, `AnalysisConfig`, `MeaningAnalysis` (design §3).
- [x] 1.2 Create `scripts/v1.3/lib/meaning/load.ts`: `loadSample(text)`, `loadSheet(text, role, path)`, `MeaningInputError` (collects every problem). Reuse `parseCsv` from `scripts/v1.3/lib/labelling/audit.ts`. Implement BR-01 (sample integrity, weights from `N_h / n_h`, strict `True`/`False` flags, optional expected sample sha256), BR-02 (answer values), BR-03 (codes; warning on code without `no`), BR-04 (ids, duplicates, calibration ids), BR-05 (rater column, `simulated`), BR-06 (same file twice), BR-07 (sha256 via `node:crypto`, over the meaning files plus `scripts/lib/stats.ts` and `scripts/v1.3/lib/labelling/audit.ts`; the library takes contents, the CLI reads them), BR-09 (BOM strip, exact header, strict per-row cell count with line numbers, in `load.ts`; `audit.ts` is not edited).

## Step 2: Bootstrap

- [x] 2.1 Create `scripts/v1.3/lib/meaning/bootstrap.ts`: `itemBootstrap(items, stat, {seed, resamples})` (BR-40) and `stratifiedClusterBootstrap(items, stat, {seed, resamples})` with (stratum, project) cells, strata and cells in sorted order (BR-41); both on `createRng` and `quantileSorted` from `scripts/lib/stats.ts`, one fresh RNG per call, undefined resamples and resamples with an empty stratum counted, interval `undefined` when no resample is defined, never `quantileSorted([])` (BR-42).

## Step 3: Agreement

- [x] 3.1 Create `scripts/v1.3/lib/meaning/agreement.ts`: `agreement(sample, rater, author, field, config)` returning the 2×2 and 3×3 tables, dropped ids, status (BR-11, BR-12), κ with undefined handling via `Number.isFinite` and the n = 0 path (BR-13), gate with 1e-9 tolerance (BR-14), item and cluster bootstrap intervals (BR-15), p_o with Wilson, AC1, prevalence, bias, PABAK, 3×3 κ (BR-16), the prevalence note, also when κ is undefined (BR-17), unsure rates and 15 % flag (BR-18), no-unsure sensitivity κ and per-style counts (BR-19). Use `cohenKappa`, `gwetAC1`, `wilson` from `scripts/lib/stats.ts`.

## Step 4: Precision

- [x] 4.1 Create `scripts/v1.3/lib/meaning/precision.ts`: `stratifiedShare(items, success)` (BR-22, renormalised N', empty strata named), `precision(sample, sheets, field, config)` with headline from the rater (BR-20, BR-21), stratified cluster bootstrap and single-cluster strata count (BR-23), Wilson and Kish companions, Kish weights N_h / m_h (BR-24), the five sensitivities (BR-25), per rule with the n ≥ 10 rule (BR-26, `MIN_INTERVAL_N`), per style counts (BR-27), reading guide with the 1e-9 tolerance and the undefined case (BR-28), and the single-rater path (BR-08).

## Step 5: Cross-tables

- [x] 5.1 Create `scripts/v1.3/lib/meaning/crosstab.ts`: A×B 3×3 plus blank for rater and author, with the two off-diagonal sentences (BR-30); reason-code counts among `no` items, pooled and per rule (BR-31).

## Step 6: Report

- [x] 6.1 Create `scripts/v1.3/lib/meaning/report.ts`: `renderMarkdown(analysis)` in the BR-50 section order, BR-51 number format (`undefined` as a word), BR-52 SYNTHETIC banner, BR-53 no notes and repo-relative paths (`<outside repo>/<basename>` otherwise), BR-43 NON-PROTOCOL line and no wall-clock time; `renderJson(analysis)` at full precision with stable key order.

## Step 7: Simulation

- [x] 7.1 Create `scripts/v1.3/lib/meaning/simulate.ts`: `simulateSheets(sample, {tableA, tableB, unsureRater, blank, seed})` returning two CSV texts with rater `simulated`, one seeded shuffle per field, table sums checked (BR-60). No primary field in simulation.

## Step 8: CLI

- [x] 8.1 Create `scripts/v1.3/meaning-analysis.ts` with `analyse` and `simulate` subcommands (design §6), following the `arg`/`need` idiom of `scripts/v1.3/spec-author-agreement.ts`. `--primary` required (`A_practitioner` or `B_style_fidelity`); `--seed` default 20261018; `--resamples` default 10000; `--expect-sample-sha256` optional; repo root from `git rev-parse --show-toplevel`; exit codes 0 / 1 / 2; `simulate` refuses any `--out` under `results/`, and `analyse` refuses one for a SYNTHETIC run (BR-54, BR-60).

## Step 9: Fixtures and tests

- [x] 9.1 Create `tests/fixtures/v1.3-meaning/sample-60.csv` (synthetic, real column layout, four strata, one rule n = 13, one rule n = 4) and `tests/fixtures/v1.3-meaning/sample-10.csv` (two strata, N = 90 and 10, n = 5 and 5). Add `tests/fixtures/v1.3-meaning/README.md` stating they are synthetic.
- [x] 9.2 Create `tests/unit/scripts/v1.3/meaning-analysis.test.ts` with cases T1–T22 of design §8, plus the loader check on the real `results/v1.3-meaning/mean-01-sample.csv` (60 items, 18 strata, Σ N_h = 784, 4 `testOrMock`, 2 single-project strata, Kish n_eff 38.83). That CSV is untracked today: before the PR, confirm `git ls-files results/v1.3-meaning/mean-01-sample.csv` lists it (commit it with U7 or after the MEAN-01 lane's commit). The test must fail, not skip, when the file is absent.
- [x] 9.3 Run `npx jest --maxWorkers=2 tests/unit/scripts/v1.3/meaning-analysis.test.ts` and `npx jest --maxWorkers=2 tests/unit/scripts/u5b/stats.test.ts` (no regression in the shared helpers); both green.
- [x] 9.4 Run `npx tsc -p tsconfig.scripts.json` (the root `tsconfig.json` has `rootDir: ./src` and does not cover `scripts/`; `tsconfig.scripts.json` covers `scripts/**` and `tests/unit/scripts/**`) and `npx eslint tests/unit/scripts/v1.3/meaning-analysis.test.ts` (the repo lint config covers `src` and `tests` only); no new errors against the baseline.

## Step 10: Dry run on simulated sheets

- [x] 10.1 In a scratch directory outside the repo: `simulate --table-a 20,10,5,25 --table-b 24,6,6,24 --seed 1`, then `analyse --primary A_practitioner` and `analyse --primary B_style_fidelity` on the real sample, `--out` in the scratch directory. Check: SYNTHETIC banner; primary A gives κ = 0.50 FAIL and primary B gives κ = 0.60 PASS; both fields reported; no `NaN`; repo files repo-relative and scratch files as `<outside repo>/<basename>` (no `/Users/`, `/Volumes/` or `/private/` string in either output). Nothing from this run is committed.
- [x] 10.2 Run the same dry run twice and compare `analysis.json` byte for byte (BR-43).

## Step 11: Documentation

- [x] 11.1 Create `aidlc-docs/construction/v1.4/U7/code/summary.md`: files created, the CLI usage, the test count and result, the sha256 of each script file (for the codebook's §12 record), and the open author questions. No billing figures, repo-relative paths only.

## Done when

- Every box above is ticked; tests and typecheck green with `--maxWorkers=2`.
- `ops/` and the labels directory are untouched; no real labels were read (none exist); no existing file outside the new paths is modified, so no registered figure (N115 and the ledger) changes.
- The PR for U7 is opened by the orchestrator and not merged; the author's review is the code-approval gate.
