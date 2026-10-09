# results/pre-tag

Pre-tag development outputs. **These are development numbers, not thesis numbers** (BR-U1-42; BR-U4-POL-02). No figure here enters a registered SO4, SO5 or E7 table.

| File | What | Produced by |
|---|---|---|
| `fixtures-<sha>.json` | FR-18 re-baseline: the five C16 fixtures, `specs/clean-arch.yaml`, `--symbolic-only`, one schema-valid report per fixture (scrubbed; `projectPath` repository-relative) with the extract, ingest and total stage timings | Build and Test Steps 10–11 |
| `layered-<sha>.json`, `layered-<sha>.report.json` | SO1 FR-20 layered acceptance on a public layered E7 project | `scripts/so1-layered-acceptance.ts` (ADR-021 SO1) |

`<sha>` is the 12-digit tool commit the run was built from.

## FR-18 re-baseline (`fixtures-0c6a0de0b4e1.json`, 2026-10-09)

The run used `npm run build`, then `main()` of `dist/cli/index.js` with `evaluate --project fixtures/<case> --spec specs/clean-arch.yaml --symbolic-only --format json --verbose`. It ran on the Build and Test lane database under the lane lock, at a 1-minute load average of about 2.6. The golden suite (Gate G) passed 80 / 80 on the same head, with snapshot hashes unchanged.

| Fixture | Spike AHS | Measured `ahsDeterministic` | Manifest verdict | Measured verdict | Extract (ms) | Ingest (ms) | Total (ms) |
|---|---|---|---|---|---|---|---|
| correct-reference | 0.85 | 0.958 | pass | pass | 490 | 68 | 673 |
| variant-d-subtle | 0.66 | 0.558 | warning | soft-block | 466 | 66 | 595 |
| variant-b-pattern | 0.58 | 0.575 | soft-block | soft-block | 470 | 69 | 607 |
| variant-a-structural | 0.54 | 0.442 | soft-block | hard-block | 484 | 59 | 611 |
| variant-c-everything | 0.33 | 0.391 | hard-block | hard-block | 504 | 62 | 638 |

- **Latency.** Every symbolic-only evaluation is below 5 000 ms in total, which is the NFR-02 bound for symbolic-only evaluation and APG construction. The BT plan text cites this as NFR-03, but in `requirements.md` NFR-03 is detection accuracy. An earlier attempt the same day, at a load average of 55–61 from parallel U6 lanes, gave 5.2–12.9 s totals. That attempt was discarded as contended, not reported, and the run was repeated at low load.
- **Ordering.** The clean fixture still scores highest, and the fully seeded fixture is still the only one below 0.40. variant-b and variant-d have swapped places compared with the spike (0.575 vs 0.558).
- **Why the values differ from the spike** (0.85 / 0.66 / 0.58 / 0.54 / 0.33). There are two causes:
  1. **More functions execute.** 24 compiled symbolic functions run, where the spike ran 17: FR-07 and FR-08 bind FF-P01, FF-SO01–03 and FF-CV02–04, and U3 adds FF-P06. So violations that the spike never measured now count, on every fixture.
  2. **Scoring is renormalised.** There are seven dimensions, and the verdict source is `ahsDeterministic` in symbolic-only mode.
- **variant-a-structural, hard-block where `MANIFEST.md` expects soft-block (0.50–0.64).** The seeded FF-S01 (2) and FF-S02 (2) violations are found as the manifest lists them. The verdict drops one band because of violations that the spike did not measure: FF-CV05 test-sibling (6), the coupling family FF-C01, FF-C03 and FF-C06 (1 each), and FF-S04, FF-P02 and FF-P04 (1 each). These are properties of the fixture under the larger function set, not missed or spurious detections of the seeded violations.
- **variant-d-subtle, soft-block where `MANIFEST.md` expects warning (0.65–0.79).** The seeded FF-P02 dependency-inversion and transitive FF-S01 violations are found (FF-P02 1, FF-S01 3). The same unseeded convention and coupling rows apply: FF-CV05 (7), FF-C03 (2), FF-C01 and FF-C06 (1 each). They lower the score by one band.
- **FF-SO02 acceptance (ADR-016 f).** FF-SO02 fails on variant-b and variant-c (one violation each, `src/domain/repositories/ITaskRepository.ts`). The variant-b `ITaskRepository -[:CONTAINS]-> Method` count is 8 (golden `u2-ingestion` test 4). So the BR-U1-39 exclusion does not apply.
- **Cycle strategy.** The run used the current default. The cycle-strategy decision (ADR-016 e) moved with the H13 latency gate to U6 under ADR-021 item 3. If it flips, P-2 is bumped and these rows are rerun.
