# HCAL-02: per-rule admission gate for the Hexagonal confirmatory family

Date: 2026-10-27, written and committed before any HCAL-02 case exists. Same procedure as CAL-02
(`ops/notes/cal-02-admission-design.md`), for the Hexagonal rows H01–H07 (`Docs/v1.5/ddd-detection-paths.md` §6;
development calibration `Docs/DiagnosticRuns/v15-hcal01-2026-10-27.md`).

## Set

- 2 new domains (none used before), built by 2 fresh sessions given only the construct text of H01–H07 and a spec
  format example, and none of the rules.
- Per row and domain: 2 positives, 2 twins and 1 legitimate case, overlaid on a clean base (10 per row).
- Both bases must score clean under the v1.5 and frozen rules, and the per-row count (7 × 5 × 2) is checked, before the
  seal. Sealed by SHA-256 manifest of the cases and of the rule sources, committed before scoring.
- Scorer: `experiments/cal-01/score.ts --dir experiments/hcal-02 --rows hex`, with the row map as committed in PR 394.

## Bars

- Per row: recall 4/4 and 0/6 false positives.
- Family: pooled recall over the admitted rows ≥ 0.90 with Wilson lower bound ≥ 0.80, and 0 incorrect blocking findings.
- H06 is scored and reported but cannot be admitted: it has no symbolic rule.
- No rule change after the seal. Disputed labels are reported and counted as labelled.
