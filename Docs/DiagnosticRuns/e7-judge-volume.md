# E7 judge-volume estimate (pre-run)

> **Status**: pre-run estimate, 2026-10-10 (runbook stage 0c; BR-U4-OPS-04). Written by `scripts/e1-judge-volume-cli.ts --e7` from the stored baseline selections; no judge call was made. It is the figure the E7 run (runbook §4) is compared against per usage window. Not a result.

Reproduce from the repository root: `npx tsx scripts/e1-judge-volume-cli.ts --e7 --plan experiments/e7-corpus/plan.json --selections corpus/selections --date 2026-10-10`

## Method

- Selection provenance: the four core bases from `bd13765` (BT-C Step 15), the three round-1 E7 bases from `4f56a1c` (BT-H Step 56), the two E7-x bases (ADR-027) from this re-run's commit (2026-10-10; `Docs/DiagnosticRuns/e7x-preparation.json`). Each selection is a Mock full-mode baseline with zero live calls. The 2026-10-09 figure for seven bases was 760 calls (ceiling 847).

- Plan `experiments/e7-corpus/plan.json`: one full-mode evaluation per base, judge `claude-cli` / `claude-opus-5-5`, no cassette hit assumed (every E7 entry is new).
- Judged units per function = the base's stored baseline selection (`corpus/selections/<projectId>.json`, OI-11): U4's own unit builders on the registered corpus spec, `selectedUnitIds` capped at `unitCap` 20 (BR-U4-SEL-04).
- Calls per evaluation = 1 init probe + `runsPerEvaluation` 3 × (FF-N01 + FF-N02 selected units), the SEN-01 ledger shape.
- Time = calls × the measured median `duration_ms` 6570 ms (effort `high`, Gate H), sequential and at `maxConcurrency` 3.

## Per base

| Base | Spec | FF-N01 module units (selected) | FF-N02 file units (selected) | Calls per evaluation |
|---|---|---|---|---|
| realworld-test | `corpus/specs/realworld-test.yaml` | 16 (16) | 25 (20) | 109 |
| ghostfolio-test | `corpus/specs/ghostfolio-test.yaml` | 100 (20) | 202 (20) | 121 |
| truthy-demo | `corpus/specs/truthy-demo.yaml` | 41 (20) | 72 (20) | 121 |
| dry-run-test | `corpus/specs/dry-run-test.yaml` | 79 (20) | 103 (20) | 121 |
| zhuravlevma__nestjs-active-record | `corpus/specs/zhuravlevma__nestjs-active-record.yaml` | 11 (11) | 24 (20) | 94 |
| nestjslatam__ddd | `corpus/specs/nestjslatam__ddd.yaml` | 39 (20) | 115 (20) | 121 |
| v-aguiar__valex | `corpus/specs/v-aguiar__valex.yaml` | 5 (5) | 19 (19) | 73 |
| zhuravlevma__typescript-ddd-architecture | `corpus/specs/zhuravlevma__typescript-ddd-architecture.yaml` | 84 (20) | 162 (20) | 121 |
| raouf-b-dev__ecommerce-store-api | `corpus/specs/raouf-b-dev__ecommerce-store-api.yaml` | 180 (20) | 555 (20) | 121 |

## E7 estimate

| Case | Judge calls | Sequential judge time (h) | At concurrency 3 (h) |
|---|---|---|---|
| Estimate (sum over 9 bases) | 1002 | 1.8 | 0.6 |
| Cap ceiling (9 × (1 + 3 × 2 × 20)) | 1089 | 2.0 | 0.7 |

## Usage-window risk

Calls per usage window are **unmeasured** (build-and-test summary §8). Windows needed under hypothetical window sizes:

| Calls per window | Estimate (1002 calls) | Ceiling (1089 calls) |
|---|---|---|
| 50 | 21 | 22 |
| 100 | 11 | 11 |
| 200 | 6 | 6 |
| 400 | 3 | 3 |

- The E7 degradation ladder applies only by its registered rules (`Docs/judge-preregistration.md`; `Docs/threats-to-validity.md` §4). Its step 2 (E7 `unitCap` 20 → 10) roughly halves the per-base unit term; the trigger compares measured calls per window against this estimate, dated in `Docs/judge-preregistration.md`, not here.
- For orientation only (not a ladder decision): under ladder step 2 (`unitCap` 10) the same nine selections would give 534 calls (eight bases at 1 + 3 × 20 = 61, valex 1 + 3 × 15 = 46). The 200-call live-call ledger of ADR-019 item 5 is a Build and Test budget (57 / 200 used); E7 is an experiment run outside it.
- A usage stop inside an evaluation ends that entry `incomplete` (`usage-limit`), which is resumable; it is not a rejection.
