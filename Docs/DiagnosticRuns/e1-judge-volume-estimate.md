# E1 judge-volume estimate (pre-run)

> **Status**: pre-run estimate, 2026-10-08 (ADR-021 SO5-08). Written by `scripts/e1-judge-volume-cli.ts` from the file trees below; no judge call was made. This is the "pre-run volume estimate" that `Docs/judge-preregistration.md` compares measured calls per usage window against (BR-U4-OPS-04). Not a result.

Reproduce from the repository root: `npx tsx scripts/e1-judge-volume-cli.ts --spec specs/clean-arch.yaml --project fixture-correct-reference=fixtures/correct-reference --project pilot-none=../daedalus-e1-outcomes/pilot/claude-opus-5-5/task-management/none/run-0 --project pilot-minimal-prose=../daedalus-e1-outcomes/pilot/claude-opus-5-5/task-management/minimal-prose/run-0 --project pilot-full-aac=../daedalus-e1-outcomes/pilot/claude-opus-5-5/task-management/full-aac/run-0 --cross-check fixture-correct-reference=10,4 --date 2026-10-08`

## Method

- Judge units are counted with U4's own builders over a BR-U4-SEL-01 candidate list of each tree (spec `specs/clean-arch.yaml`): FF-N02 `intent-alignment` judges file units, FF-N01 `architectural-integrity` module units (BR-U4-SEL-02, SEL-03).
- Judged units per function = min(`unitCap` 20, units) (SEL-04; the E1 `unitCap` never changes, OPS-04).
- Calls per full-mode evaluation = 1 init probe + `runsPerEvaluation` 3 × (FF-N01 units + FF-N02 units), the shape of the SEN-01 ledger lines. No cassette hit is assumed (every E1 project is new).
- E1 = 54 cells, all assumed `ok` (not-run cells are not judged, so this is the upper case). Central = mean of the pilot projects × 54 (rounded up); low and high = their min and max × 54; ceiling = every cell capped on both functions.
- Time = calls × the measured median `duration_ms` 6570 ms (6.6 s, effort `high`, Gate H), sequential and at `maxConcurrency` 3.

## Evidence projects

| Project | Source | `.ts` files | Candidates | FF-N02 file units (judged) | FF-N01 module units (judged) | Calls per evaluation |
|---|---|---|---|---|---|---|
| fixture-correct-reference | `fixtures/correct-reference` | 10 | 10 | 10 (10) | 4 (4) | 43 |
| pilot-none | `../daedalus-e1-outcomes/pilot/claude-opus-5-5/task-management/none/run-0` | 13 | 13 | 13 (13) | 3 (3) | 49 |
| pilot-minimal-prose | `../daedalus-e1-outcomes/pilot/claude-opus-5-5/task-management/minimal-prose/run-0` | 40 | 40 | 40 (20) | 13 (13) | 100 |
| pilot-full-aac | `../daedalus-e1-outcomes/pilot/claude-opus-5-5/task-management/full-aac/run-0` | 36 | 36 | 36 (20) | 12 (12) | 97 |

**Cross-check of the counting against live runs**:

- fixture-correct-reference: recorded 10 file units and 4 module units; counted 10 and 4: **equal**.

## E1 estimate

| Case | Judge calls | Sequential judge time (h) | At concurrency 3 (h) |
|---|---|---|---|
| Low (smallest pilot × 54) | 2646 | 4.8 | 1.6 |
| Central (pilot mean × 54) | 4428 | 8.1 | 2.7 |
| High (largest pilot × 54) | 5400 | 9.9 | 3.3 |
| Cap ceiling (54 × (1 + 3 × 2 × 20)) | 6534 | 11.9 | 4.0 |

## Usage-window risk

Calls per usage window on the subscription are **unmeasured** (build-and-test summary §8; `USAGE_LIMIT` patterns unverified, ADR-018 item 5). Windows needed for the central and ceiling cases under hypothetical window sizes:

| Calls per window | Central (4428 calls) | Ceiling (6534 calls) |
|---|---|---|
| 50 | 89 | 131 |
| 100 | 45 | 66 |
| 200 | 23 | 33 |
| 400 | 12 | 17 |

- The degradation ladder cannot shrink E1: its unit cap, judge model, `runsPerEvaluation` and rubric never change mid-study (BR-U4-OPS-04). Only step 3 (effort `high` → `medium`, with a full re-record) reaches E1, and only at a usage-window boundary before any E1 score is viewed.
- A usage stop inside an evaluation ends that entry `incomplete` (`usage-limit`, U4 exit 3), which is resumable; it is not a rejection. The E1 run therefore spans several windows whenever the window size is below the figures above, and the number of windows is a schedule risk, not a validity risk.
- The evidence is narrow: three pilot projects, one model (`claude-opus-5-5`) and one task (`task-management`), plus the fixture. Sonnet, Haiku and `order-fulfilment` trees may differ in size; the cap ceiling bounds every case.
- Before the E1 run, the measured calls per window (from the pilot or the first E1 window) are compared against this estimate, as `Docs/judge-preregistration.md` requires; that comparison is dated there, not here.
