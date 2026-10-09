# Hand-computed scoring case (BR-U5b-27; U5b Step 7)

This case is committed **before** the first commit of `scripts/score-golden.ts`. Every value in `expected.canonical.json` is derived below by hand from the actual manifest rows (`manifest.json`) and the actual reports (`reports/`). The scorer must reproduce `expected.canonical.json` byte for byte (Step 10).

## 1. How the inputs were produced

- **Manifest**: U5a's `scripts/mutate.ts` on `fixtures/correct-reference` with `specs/clean-arch.yaml` (spec sha256 `9a8461a9…abc9557`), `--cycle-strategy simple-cycles` (default), one forced site per operator (`--site`, split `dev`, `siteSelection: forced`), into a scratch `--out` directory; four rows, no rejection. The file is U5a's output; the only change is `scrubDeep` with the worktree root as a known secret, which turns the absolute `typecheck.tscPath` into `[REDACTED]/node_modules/typescript/lib/tsc.js` (NFR-08; the scorer does not read this field; ajv-valid after scrubbing).

  | Row | Operator | Forced site |
  |---|---|---|
  | `correct-reference:MO-S01:0` | MO-S01 | `Task.ts` imports `InMemoryTaskRepository` (`InMemoryTaskRepository.ts`): the F-U5A-CYCLE site |
  | `correct-reference:MO-C04:0` | MO-C04 | created `src/application/use-cases/OrphanHelper.ts` |
  | `correct-reference:MO-DF01:0` | MO-DF01 | `Task` gets `private readonly repo = new InMemoryTaskRepository()` |
  | `correct-reference:MO-DF01n:0` | MO-DF01n (twin of MO-DF01) | `InMemoryTaskRepository` gets `new Category(...)` |

- **Reports**: the CLI (`tsx bin/firewall.ts evaluate --symbolic-only --format json --spec specs/clean-arch.yaml`, the code of `U5B_BASE` `76f04f4`, `src/` unchanged since) on the lane Neo4j, once on the unmutated base (`--project fixtures/correct-reference`, from the repository root) and once per copy (`--project correct-reference/<operator>/k-0`, relative to mutate's `--out` directory). Reports are scrubbed with `scrubDeep`; none holds an absolute path, home directory or password.
- **Run records** (`reports/<name>.run.json`): `specSha` = the spec sha256 above, `cliCommit` = `U5B_BASE` (`76f04f477af07a6a59d16ecbd6a381fef1694ec7`), `status: accepted`, `attempt: 1`, `preregVersion: 0` and `frozenHashes: {}` (test inputs, not a registered plan; D-U5b-7); seeded records carry `seed` with `split: dev`, `baseKind: fixture`, `manifestPath: manifest.json`, `baselineReportPath: reports/baseline.json`.

## 2. Acceptance and provenance (BR-U5b-25, 45)

All five reports: `functionExecution.failed = []`, no `truncated` row, no `EVAL_002` / `EVAL_003` / `METRIC_001` warning (warnings are 27 × `SPEC_002`, 1 × `COMPILER_004`), schema-valid, judge `none` (symbolic-only). All five records have the same `specSha` and `cliCommit`; all reports have `evaluationMode: symbolic-only` and the same judge. Every pair is accepted.

## 3. Baseline (`reports/baseline.json`)

15 violations, 15 distinct keys (`baselineMatchKey` = `JSON.stringify([functionId, filePath, target ?? "", discriminator ?? []])`):
- FF-C03 (`component-instability`) on 5 files: `CompleteTaskUseCase.ts`, `CreateTaskUseCase.ts`, `ICategoryRepository.ts`, `TaskController.ts`, `InMemoryTaskRepository.ts`;
- FF-CV05 (`test-file-pairing`) on all 10 source files.

`graphStats.edgeCountByType.FLOWS_TO = 0`. `functionExecution`: declared 27, adrDerived 0, compiled 26, disabled 1 (FF-S03, style), dropped [], skippedByMode 2, executed 24, failed []. I1: 27 + 0 = 26 + 1 + 0. I2: 26 = 24 + 0 + 2. Both hold.

## 4. Per row

### 4.1 MO-S01 (structural; F-U5A-CYCLE site)

- Expected functions `[FF-S01, FF-S04]`; both have a `functionResults[]` row, neither disabled nor absent → both applicable (BR-U5b-13).
- Expected keys: `(FF-S01, Task.ts, InMemoryTaskRepository.ts, [IMPORTS])` and `(FF-S04, …same…)`, `lineRule: site-line`, `line: 1`.
- Seeded report: 18 violations. Multiset difference seeded − baseline (BR-U5b-03): **4 new keys**: FF-S01 and FF-S04 at the expected keys (line 1 each), and two FF-S02 cycle rows (`Task → InMemoryTaskRepository → Task` and `Task → InMemoryTaskRepository → ITaskRepository → Task`). The other 14 seeded occurrences match the baseline → `preExistingIgnored` += **14**. One baseline key disappears (FF-C03 on `InMemoryTaskRepository.ts`, its instability changes); disappeared keys are not counted anywhere.
- Site-invalid? The expected keys are not in the baseline → no (BR-U5b-14).
- Detection: FF-S01 and FF-S04 both detect → `matched`, `detectedBy = [FF-S01, FF-S04]` (BR-U5b-05). Line: both at line 1 = key line 1 → `lineConfirmed = true`.
- Collateral: the two FF-S02 keys equal the two declared site-collateral keys (`cause: cycle`, U3 cycle-row form `filePath = String(cycle)`, `target = cycle[1]`, discriminator `[JSON.stringify(cycle)]`; OI-9) → **observed, neutral**: `collateralByFunction.FF-S02` += 2.
- Undeclared new violations: **none** → FP-strict 0.
- Tags of the applicable expected functions: FF-S01 `structural`, FF-S04 `structural` → `{structural}`. Dimension `structural`.

### 4.2 MO-C04 (coupling)

- Expected function `[FF-C04]` (`no-orphan-files`), applicable. Key `(FF-C04, src/application/use-cases/OrphanHelper.ts, "", [])`, `lineRule: none`.
- Seeded report: 17 violations; **2 new keys**: FF-C04 on `OrphanHelper.ts` and FF-CV05 on `OrphanHelper.ts`; 15 pre-existing → `preExistingIgnored` += **15**.
- Detection: FF-C04 detects → `matched`, `detectedBy = [FF-C04]`; line rule `none` → `lineConfirmed = null`.
- Collateral: FF-CV05 on `OrphanHelper.ts` equals the declared site collateral (`cause: created-without-test`) → observed, neutral: `collateralByFunction.FF-CV05` += 1.
- Undeclared new: **none**. Tag `topological`; dimension `coupling`.

### 4.3 MO-DF01 (pattern; checks data-flow)

- Expected function `[FF-P06]` (`domain-state-purity`), applicable (row present; clean-arch declares FF-P06 since the U3 merge). Key `(FF-P06, Task.ts, InMemoryTaskRepository.ts, [Task, InMemoryTaskRepository, FLOWS_TO, repo])`, `lineRule: site-line`, `line: 5`.
- Seeded report: 19 violations; **5 new keys**: FF-P06 at the expected key (line 5), FF-S01 and FF-S04 `(Task.ts, InMemoryTaskRepository.ts, [IMPORTS])` (the class import the edit adds), and the same two FF-S02 cycle rows as MO-S01; 14 pre-existing → `preExistingIgnored` += **14** (FF-C03 on `InMemoryTaskRepository.ts` disappears, as in MO-S01).
- Detection: FF-P06 detects → `matched`, `detectedBy = [FF-P06]`; line 5 = key line 5 → `lineConfirmed = true`.
- Collateral: FF-S01 and FF-S04 equal the declared **keyed operator collateral** (`kind: operator`, `cause: declared`, BR-U5a-14; OI-10) and the two FF-S02 rows equal the declared site collateral → all four observed and neutral: `collateralByFunction` FF-S01 += 1, FF-S04 += 1, FF-S02 += 2.
- Undeclared new: **none**. FF-P06 tag `structural` → tag set `{structural}`, plus the `structural/data-flow` sub-row (BR-U5b-07). Dimension `pattern` (`expected.dimension`).
- FLOWS_TO edge check (BR-U5b-22): baseline 0, seeded 1, delta 1; declared = 1 (`expectedEdges` has one FLOWS_TO entry) → **pass**.

### 4.4 MO-DF01n (twin of MO-DF01)

- `expected.negative = true`, `twinOf: MO-DF01`, `keys: []`, `collateral: []`.
- Seeded report: 15 violations, all 15 baseline keys → **0 new**; `preExistingIgnored` += **15**.
- Twin status: no undeclared new violation → **`twin-clean`** (BR-U5b-17). Twins have no dimension and no tags (`dimension: null`, `tags: []`); they enter no P/R table, only specificity.
- FLOWS_TO: baseline 0, seeded 1, delta 1, declared 1 → **pass**.

## 5. Totals

| Quantity | Value | From |
|---|---|---|
| `preExistingIgnored` | 14 + 15 + 14 + 15 = **58** | §4 |
| FP-strict | **0** (no undeclared new violation in any copy) | §4 |
| Twin specificity | clean 1 / scored 1 | §4.4 |
| `collateralByFunction` | FF-CV05 1, FF-S01 1, FF-S02 4, FF-S04 1 | §4.1–4.3 |
| `notApplicable`, `siteInvalid`, `metricCrossings`, `metricKeyExclusions`, `sccOverlapMatches`, `judgeCollateral` | empty / 0 | no such case on this fixture; metric-key flags both set (Step 2) |
| `executedFunctions` | 24 (every seeded report) | §3 |

**No undeclared new violation occurs on this fixture**, so the FP-strict branch is covered by the BR-U5b-09 unit test (Step 8), not by this case.

P/R/F1 (BR-U5b-11): every table below has FP 0 and FN 0, so precision = recall = F1 = 1 (written `1.000000`); FP-labelled and "incl. twins" are `null` (no labels, BR-U5b-10, 17); `fpUncertain` 0.

| Table | Rows (TP) |
|---|---|
| per function | FF-C04 1, FF-P06 1, FF-S01 1, FF-S04 1 (BR-U5b-06) |
| per dimension | coupling 1, pattern 1, structural 1 |
| per tag | structural 2 (MO-S01, MO-DF01), `structural/data-flow` 1 (MO-DF01), topological 1 (MO-C04) |
| overall | 3 (count-once: MO-S01 counts once although two functions detect it, BR-U5b-05) |

Strata (BR-U5b-20, 21): all rows are `split: dev`, `baseKind: fixture`, `coverage: in`, so each table appears under the three strata `["dev","all","all"]` (split total), `["dev","all","in"]` (coverage stratum) and `["dev","fixture","all"]` (base-kind stratum), with identical values. No `held-out` and no `probe` row exists.

Denominators (BR-U5b-24): one row per report (baseline `seedId: null`, then each copy by `seedId`), each declared 27, adrDerived 0, compiled 26, disabled 1, dropped 0 (ids `[]`), skippedByMode 2, executed 24, failed 0, notApplicable 0, metricKeyExcluded 0, `identityOk: true` (§3).

## 6. Canonical form of `expected.canonical.json`

Written with `scripts/lib/canonical-json.ts` (`canonicalize`, BR-U5b-26) from a hand-written value holding the numbers above: object keys sorted; maps (`perFunction`, `perDimension`, `perTag`, `overall`, `collateralByFunction`, `notApplicable`, `metricKeyExclusions`) as `[key, value]` arrays sorted by key; stratum keys `JSON.stringify([split, baseKind, coverage])`; match keys `JSON.stringify([functionId, filePath, target, discriminator])`; ratios with six decimals; `perInstance` and `edgeEvidence` sorted by `seedId`; `detectedBy`, `tags` and `collateral` sorted; `null` kept. Fields: `ruleVersion` (`1.1.0`; `1.0.0` before prereg v3), `perInstance`, `perFunction`, `perDimension`, `perTag`, `overall`, `executedFunctions`, `preExistingIgnored`, `collateralByFunction`, `notApplicable`, `siteInvalid`, `metricCrossings`, `metricKeyExclusions`, `sccOverlapMatches`, `judgeCollateral`, `twinSpecificity`, `edgeEvidence`, `judgeProbe`, `denominators`.

## 7. Amendment 2026-10-08 (ADR-020 items 2, 3, 5; matching rule 1.1.0)

No count above changes. The scorer output gained two fields, added to `expected.canonical.json` by hand from §4:

- `perInstance[].applicable`: the applicable expected functions of each seed, sorted (BR-U5b-13): MO-C04 `[FF-C04]` (§4.2), MO-DF01 `[FF-P06]` (§4.3), MO-S01 `[FF-S01, FF-S04]` (§4.1), the twin MO-DF01n `[]`. They give the (project, operator) recall cells of the per-function rows (ADR-020 item 3).
- `neuralNewByFunction`: `[]`. The reports are symbolic-only, so no neural new violation exists (MAT-19 1.1.0, ADR-020 item 5).

No case is labelled and no base is a corpus base, so MAT-10 1.1.0 (TP-class labels leave FP-labelled) and the corpus-tier strata do not change any value. `ruleVersion` is `1.1.0` from the commit that registers matching rule 1.1.0 (`corpus/prereg.json` version 3, ADR-020); no other value changes.

## 8. Amendment 2026-10-09 (ADR-021 SO4-03, SO4-05, SO4-06, SO1-C)

No count above changes. The scorer output gained three fields, added to `expected.canonical.json` from §4 and §5:

- `perInstance[].fpItems`: the FP-strict items of each scored instance, for the (project, operator) precision and F1 cells (SO4-06). No copy has an undeclared new violation (§5, FP-strict 0), so every list is `[]`; the twin MO-DF01n has `[]` too (its items are twin FPs, which are not counted in precision).
- `rejectedPairs`: `[]`. Every pair is accepted (§2), so no pair is listed as rejected (SO4-03).
- `manifestRejections`: `[]`. The manifest has no rejection (§1), so nothing is carried into the coverage table (SO4-05).

The scorer is called here without spec or corpus styles, so no `style-<s>` stratum, `specStyle`, `corpusStyle` or denominator `specStyle` appears (SO1-C). With the CLI, `specs/clean-arch.yaml` would add the `["dev","style-clean-architecture","all"]` stratum with the same values as `["dev","all","all"]`.
