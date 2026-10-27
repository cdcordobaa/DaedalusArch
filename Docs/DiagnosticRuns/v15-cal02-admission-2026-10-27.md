# v1.5 CAL-02: per-rule admission of the DDD confirmatory family

Date: 2026-10-27. Zero model calls. Scored once, under the bar in `ops/notes/cal-02-admission-design.md`.

## Order of events (from the commits)

| Step | Commit | Time (−05:00) |
|---|---|---|
| Admission design committed (before any case existed) | `8a8365794` (PR 392, merged) | 2026-10-27 00:13 |
| Cases built by 4 blind sessions; both bases repaired to clean; per-row count 16 × 5 × 2 checked | — | 00:14–00:30 |
| Seal: SHA-256 of 304 files, plus the frozen rule sources (`RULES-FROZEN.sha256`, hash `c8482e5c…`) | `26e52e246` | 00:31 |
| Scoring, after the design was on main; seal and rule hashes re-verified first | this report | after PR 392 merged |

The first seal attempt was discarded before commit: the base repairs had dropped the K09–K16 cases. They were
rebuilt on the repaired bases before the seal above. Nothing was scored before the seal.

## Result

Scorer: `experiments/cal-01/score.ts --dir experiments/cal-02` (rules as sealed). Record: `experiments/cal-02/result.json`.

| Row | Recall | FP | Admitted |
|---|---|---|---|
| K01 context internals | 4/4 | 0/6 | **yes** |
| K02 domain purity | 3/4 | 0/6 | no |
| K03 two aggregates per command | 4/4 | 0/6 | **yes** |
| K04 repository persists two | 0/4 | 0/6 | no (see below) |
| K05 cross-context write | 4/4 | 0/6 | **yes** |
| K06 write in the composition-root facade | 0/4 | 0/6 | no |
| K07 remote call in a transaction | 4/4 | 0/6 | **yes** |
| K08 single-instance rule outside | 2/4 | 0/6 | no |
| K09 duplicated rule | 0/4 | 0/6 | no |
| K10 declared set invariant outside its owner | 0/4 | 0/6 | no |
| K11 lock standing in for a boundary | 0/4 | 0/6 | no |
| K12 calculation outside the aggregate | 0/4 | 0/6 | no |
| K13 technology in a port | 0/4 | 0/6 | no |
| K14 entity in a published contract | 4/4 | 0/6 | **yes** |
| K15 concrete adapter injected | 4/4 | 0/6 | **yes** |
| K16 aggregate holds another aggregate | 4/4 | 0/6 | **yes** |

- **Family bar: met.**
  - Admitted rows K01, K03, K05, K07, K14, K15 and K16: pooled recall 28/28, Wilson lower bound ≈ 0.88 (bar 0.80).
  - 0 false positives on their 42 clean cases.
  - They cover 5 of the 7 Pareto rules (1, 3, 4, 6, 7; the bar was ≥ 3).
- **DDD enters the final study as a confirmatory style, scored on the admitted rows.** The other nine rows are scored
  and reported as exploratory.
- **No row produced a false positive.** Every failure is a miss.

## Why the non-admitted rows failed (read from the evidence; nothing changed)

- **K04:** R-D4 fires at the command that calls the two-aggregate save (`ClaimService:49`, `WorkOrderService:61`).
  The label points at the repository file. By the pre-registration the label stands, so the row is not admitted. It is
  a location mismatch, not a missed violation.
- **K12 (and likely K08–K11):** the CAL-01 revisions were too narrow, fitted to the development cases' shapes. For
  example, R-D3 follows a computed number handed straight to the aggregate, but here the value is wrapped in a value
  object first (`claim.applyDeductible(Money.of(cents))`). The pattern is the same for the rules that passed CAL-01 at
  2/2 and fail here at 0/4: development calibration on one set does not carry to fresh cases. This is what the sealed
  set is for.
- **K06, K13 and K02** need a per-case read before a revision. Any revision is development work and needs a fresh
  sealed set (CAL-03) before a row can be admitted.

## What this means for the study

- **DDD confirmatory outcome = findings of the admitted rules only:** FF-DS02, R-D4, R-XCTX, R-RTX, R-D9, R-INJ and
  R-REF. This is registered before the study runs.
- The remaining rules still run and are reported as exploratory.
- The confirmatory DDD tasks should centre on traps the admitted rows can see: one aggregate per command (P1 family),
  cross-context writes (P2 and P5 families), remote calls in a transaction and boundary imports. P1's in-aggregate rule
  (K08) and the invariant traps are scored exploratory.
