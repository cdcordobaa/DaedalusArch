# CAL-02: per-rule admission gate for the DDD confirmatory family

Date: 2026-10-27, written and committed before any CAL-02 case exists. Decision context: DDD confirmatory through
per-rule admission (deviation C1b from the C1 fallback, recorded in `ops/decisions.md`). Catalog:
`Docs/v1.5/ddd-detection-paths.md`. Development calibration: `Docs/DiagnosticRuns/v15-cal01-2026-10-27.md`.

## Set

- 2 new domains (none used before: not banking, hotels, ferries, loyalty, shipping, libraries, workshops, orders,
  clinics, warehouses, rentals, ticketing, courses or payments).
- Built by 2 fresh sessions given only the construct text of K01–K16 and the spec format, and none of the rules.
- Per row and domain: 2 positives, 2 twins and 1 legitimate case, overlaid on a clean base (5 cases per row and domain,
  10 per row in total).
- K04 positives call the multi-root method from a command, as ruling B1 requires.
- Both base apps must score clean under all rules before any case is scored; a base that is not clean is a set defect,
  and that domain is rebuilt before scoring.
- Sealed by SHA-256 manifest, committed before scoring. The scorer is `experiments/cal-01/score.ts` pointed at the CAL-02
  directory, unchanged.

## Frozen before scoring

The rules as merged in PR 391 (`main` at the seal commit). No rule change after the seal; a change means CAL-03.

## Admission bar (per row)

- Recall: 4 of 4 positives.
- False positives: 0 of 6 clean cases (4 twins + 2 legitimate).

A row that passes enters the DDD confirmatory family; a row that fails is scored and reported as exploratory.

## Family bar

- Pooled recall over the admitted rows ≥ 0.90 with Wilson lower bound ≥ 0.80.
- 0 incorrect blocking findings on clean cases of the admitted rows.
- If the admitted rows cover fewer than 3 of the 7 Pareto rules, DDD stays exploratory.

## Labels

The labels come from the builders. A label disputed after scoring is reported as disputed and counted as the builder
labelled it; it is never relabelled to pass.
