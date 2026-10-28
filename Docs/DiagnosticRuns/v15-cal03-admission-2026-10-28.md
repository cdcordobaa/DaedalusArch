# v1.5 CAL-03: per-rule admission of the DDD confirmatory family, second sealed set

Date: 2026-10-28. Zero model calls. Scored once, under the bar in `ops/notes/cal-03-admission-design.md`.

## Order of events (from the commits)

| Step | Commit | Time (−05:00) |
|---|---|---|
| Admission design committed (before any case existed) | `8d91e6c38` | 2026-10-27 09:32 |
| Cases built by 2 blind sessions (drones survey, theatre production), brief `experiments/cal-03/BRIEF.md` | — | 2026-10-27 |
| Addendum: the K13 revision lands before the seal, written from CAL-02 misses only | `b2defa3a4` | 2026-10-27 20:22 |
| Rules on `main`: CN-02 and CN-02b (K13) | `84db3ddd5` (PR 405) | 2026-10-28 11:59 |
| Seal: SHA-256 of 328 files (`f898cfe3…`), frozen rule sources and scorer (`RULES-FROZEN.sha256`, `8bd6f578…`) | `05780dc87` | 2026-10-28 12:00 |
| Scoring; case, rule and scorer hashes re-verified first | this report | after the seal |

Checks before the seal: both bases pass pre-flight with 0 errors and score clean under every v1.5 and frozen rule;
16 rows × 5 cases × 2 domains present. The scorer's line in `RULES-FROZEN.sha256` is relative to `experiments/cal-03`.

## Result

Scorer: `experiments/cal-01/score.ts --dir experiments/cal-03`. Record: `experiments/cal-03/result.json`.

| Row | Recall | FP | Admitted | CAL-02 |
|---|---|---|---|---|
| K01 context internals | 4/4 | 0/6 | **yes** | yes |
| K02 domain purity | 4/4 | 0/6 | **yes** | no |
| K03 two aggregates per command | 4/4 | 0/6 | **yes** | yes |
| K04 repository persists two | 3/4 | 0/6 | no | no |
| K05 cross-context write | 4/4 | 0/6 | **yes** | yes |
| K06 write in the composition-root facade | 1/4 | 0/6 | no | no |
| K07 remote call in a transaction | 2/4 | 0/6 | no | yes |
| K08 single-instance rule outside | 3/4 | 2/6 | no | no |
| K09 duplicated rule | 3/4 | 1/6 | no | no |
| K10 declared set invariant outside its owner | 4/4 | 0/6 | **yes** | no |
| K11 lock standing in for a boundary | 0/4 | 0/6 | no | no |
| K12 calculation outside the aggregate | 1/4 | 0/6 | no | no |
| K13 technology in a port | 4/4 | 0/6 | **yes** | no |
| K14 entity in a published contract | 4/4 | 0/6 | **yes** | yes |
| K15 concrete adapter injected | 4/4 | 0/6 | **yes** | yes |
| K16 aggregate holds another aggregate | 4/4 | 0/6 | **yes** | yes |

- **Family bar: met.**
  - Admitted rows K01, K02, K03, K05, K10, K13, K14, K15 and K16: pooled recall 36/36, Wilson lower bound ≈ 0.90
    (bar 0.80).
  - 0 false positives on their 54 clean cases.
  - They cover all 7 Pareto rules (the bar was ≥ 3): context boundaries K01, domain purity K02, one aggregate per
    transaction K03, events between aggregates K05, invariants in the aggregate K10, neutral ports K13 and K15,
    reference by identity K16.
- **9 of 16 rows admitted.** The goal stated before building was 13; it is a goal, not a bar.
- **K07 was admitted on CAL-02 and fails here (2/4).** Every row is rescored under the new rule hash, so K07 leaves the
  confirmatory family. Its rule R-RTX still runs and is reported as exploratory.

## Findings by admitted rules on clean cases of other rows

The bar counts the admitted rows' own clean cases. These hits fall on clean cases of rows that were not admitted, and
they would count in a confirmatory outcome scored by rule:

- **R-D5** (mapped to K10 and K08): 3 of 160 cases, `drones/K08-legit`, `drones/K09-legit`, `theatre/K08-twin2`.
  On all 4 K10 positives R-D5S fires at the same line as R-D5.
- **R-D4** (K03): 1 case, `drones/K07-twin2`. The command saves the permit inside the unit of work and, on an exclusive
  error path, calls `deny`, which saves the same permit. R-D4 counts the two saves as two aggregates.

Registration choice, open: score K10's confirmatory outcome by R-D5S alone. R-D5 then stays exploratory with K08 and
K09, and the confirmatory family has 1 known cross-row false positive (R-D4 on `drones/K07-twin2`) in 160 cases.

## Misses of the rows not admitted (read after scoring; nothing changed)

- **K04** (3/4): `drones/K04-pos2`, labelled at the repository; no finding.
- **K06** (1/4): the facade in `main.ts`, the shape the rules do not model.
- **K07** (2/4): `drones/K07-pos2` and `theatre/K07-pos2`, no finding at the labelled service.
- **K08, K09** (3/4 each): one positive missed each, plus the R-D5 false positives above.
- **K11** (0/4): an in-process lock; needs structure plus runtime.
- **K12** (1/4): calculations handed back to the aggregate.

Any revision of these rows is development work and needs a fresh sealed set before admission.

## What this means for the study

- **DDD confirmatory outcome = findings of the rules of the 9 admitted rows.** This replaces the CAL-02 family
  (K07 out; K02, K10 and K13 in).
- The study task traps sit on R-D4 (all 12 tasks), R-XCTX (5) and FF-DS02 (4)
  (`experiments/trap-families/_checks/visibility-2026-10-27.json`). All three remain admitted, so the tasks do not
  change.
- Later rule changes (CN-03, Hexagonal) change the rule hash. CAL-03 is then re-run as a regression check; an
  identical record keeps this admission, any change reopens it.
