# CAL-03: per-rule admission gate for the DDD confirmatory family, after the CN-02 revision

Date: 2026-10-27, written and committed before any CAL-03 case exists. Same gate as CAL-02
(`ops/notes/cal-02-admission-design.md`, deviation C1b in `ops/decisions.md`), on fresh cases, for the rules as revised
in CN-02 (`Docs/DiagnosticRuns/v15-cn02-dev-2026-10-27.md`). CAL-02 is now development evidence: CN-02 was written
while reading its misses.

## Why a new set

CN-02 changed `src/v15-instrument/facts.ts` and added two rules after reading the CAL-02 cases, so CAL-02 can no longer
admit anything. CAL-02 also showed that rows passing every development case can fail on fresh cases (9 rows). CAL-03
is the one test of the revised rules.

## Set

- 2 new domains, none used before in CAL-01, CAL-02, HCAL-01, HCAL-02, the PUZZLE tasks, the floor probes or the
  trap-family study tasks: **theatre productions** (productions, cast bookings, rehearsal rooms) and **drone survey
  bureau** (survey jobs, pilots, flight permits). Each has three bounded contexts and declared aggregates.
- Built by 2 fresh sessions, one per domain. Each session gets only:
  - the construct text of K01–K16 (catalog §3, the "construct" column, without the rule ids or the detection columns);
  - the spec format, including `ddd.invariants` (a uniqueness invariant has `enforced_by: store` and no owner);
  - the case layout and label format of CAL-02.
  It gets none of the rules, the CN-02 report, the CAL-01 or CAL-02 cases, or this document's row map.
- Per row and domain: 2 positives, 2 twins and 1 legitimate case, overlaid on a clean base (5 cases per row and domain,
  10 per row in total, 160 cases).
- Shape variety, the one addition to the CAL-02 brief, given in the same words for every row: within a domain the two
  positives of a row must differ in code shape (for example inline versus through a local, a plain number versus a
  value object, a field versus a getter, a service versus a controller, throwing versus returning an error result,
  synchronous versus async), and the twins must be as close to the positives as the construct allows.
- K04 positives must include at least one method that a command calls; the other may be uncalled.

## Checks before the seal

1. Each base passes pre-flight (`scripts/v15-preflight.ts`) with 0 errors, and scores clean under every v1.5 rule and
   every frozen rule. A base that fails is repaired, and its cases are rebuilt on the repaired base.
2. Per-row count check: 16 rows × 5 cases × 2 domains present after any repair.
3. Seal: SHA-256 manifest of every case and base file, plus `RULES-FROZEN.sha256` of the rule sources (`src/v15-instrument/**`
   and the scorer). Committed before scoring; both hashes re-verified immediately before scoring.

## Frozen before scoring

- The rules as merged in the CN-02 PR (`main` at the seal commit). No rule change after the seal; a change means CAL-04.
- The row map in `experiments/cal-01/score.ts` at the seal commit:
  K01 FF-DS02; K02 FF-DT04, FF-S01, FF-S03, R-H5, R-PURE; K03 R-D4; K04 R-D4, R-D4R; K05 R-XCTX, R-D4; K06 R-D4,
  R-XCTX; K07 R-RTX; K08 R-D5; K09 R-D5; K10 R-D5S, R-D5; K11 R-LOCK; K12 R-D3; K13 R-H5; K14 R-D9; K15 R-INJ;
  K16 R-REF.
- A positive passes when a mapped rule fires on the labelled file (as in CAL-02).

## Admission bar (per row), unchanged

- Recall: 4 of 4 positives.
- False positives: 0 of 6 clean cases (4 twins + 2 legitimate).

All 16 rows are scored, including the 7 that CAL-02 admitted. Their facts did not change in CN-02, but the sealed rule
hash did, so they must pass again: a row admitted by CAL-02 that fails CAL-03 leaves the confirmatory family.

## Family bar, unchanged

- Pooled recall over the admitted rows ≥ 0.90 with Wilson lower bound ≥ 0.80.
- 0 incorrect blocking findings on clean cases of the admitted rows.
- If the admitted rows cover fewer than 3 of the 7 Pareto rules, DDD stays exploratory.

The target stated before building (7 of 7 Pareto rules, at least 13 of 16 rows) is a goal, not a bar: whatever CAL-03
admits is the confirmatory DDD family, registered before the study runs.

## Labels

The labels come from the builders. A label disputed after scoring is reported as disputed and counted as the builder
labelled it; it is never relabelled to pass.

## Use

Scored once. The result goes to `Docs/DiagnosticRuns/v15-cal03-admission-<date>.md` and the matrix
(`Docs/v1.5/ddd-detection-paths.md`), and the admitted rules become the DDD confirmatory outcome in the study
registration.
