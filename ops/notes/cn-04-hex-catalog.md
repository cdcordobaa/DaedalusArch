# CN-04: Hexagonal rows H06, H08 and the new H11, and the HCAL-04 admission design

Date: 2026-10-28. Written and committed before any CN-04 rule change and before any HCAL-04 case exists. Same procedure
as CN-03 and HCAL-03 (`ops/notes/cn-03-hex-catalog.md`).

## Why

HCAL-03 admitted 8 of 10 Hexagonal rows (`Docs/DiagnosticRuns/v15-hcal03-admission-2026-10-28.md`). Not admitted: H06
(business rule in an adapter, no rule) and H08 (service locator, 3/4: a free-function wrapper around the registry hid
the call). TRAPRATE-01 (arm `none` on the study tasks, `results/v1.5-traprate-01/scores/`) found a third gap: in 4 of
the 6 functional Hexagonal trap failures the agent imported nothing from the vendor SDK but re-declared the vendor's
vocabulary in the core (decline codes and match-precision codes as string-literal types, branched on in the service).
The oracle failed those runs; no rule saw them.

Disclosure: the H11 construct below was motivated by reading those TRAPRATE-01 outputs (two study tasks, f2 and f14).
The rule is developed on fixtures and the earlier calibration sets; the TRAPRATE-01 trees are used only as a
development check and are named as such in the report. Admission rests on HCAL-04 alone.

## Rows

| Row | Construct (what a positive does) |
|---|---|
| H06 | an adapter decides a business rule: code in an inbound or outbound adapter that branches on domain state or domain values to accept, reject, price or change something, where that decision belongs in the domain or a use case (validation of the transport shape, such as a missing field or a malformed date, is not a business rule) |
| H08 | unchanged construct; the rule also follows calls into a function or method that itself performs the container, registry or static-provider lookup |
| H11 | domain, application or port code re-declares a vendor's vocabulary: a string-literal union, an enum, a constant set or a field set whose values or names are copied from an external SDK's types (status, decline, error or precision codes; the vendor's field names), so the core speaks the vendor's language without importing it |

## Rule changes in CN-04 (development, before the seal)

- H06: new rule R-ADAPTER-RULE: a conditional in an adapter whose condition reads a domain entity's or value object's
  state (or compares a domain value against a constant) and whose branch throws or returns a domain error, rejects,
  changes domain state, or computes a business amount. Transport validation (type checks, presence, parsing) is not
  reported.
- H08: R-LOCATOR follows one level of call into an in-tree function or method that performs a locator lookup, and
  reports at the caller.
- H11: new rule R-MIRROR: a type in domain, application or port code whose string-literal values (at least 2) or
  property names (at least 3, excluding `id`) are all found in one type exported by an external package that an adapter
  of the same tree imports. Reports the core type and the vendor type it mirrors.

Development checks before the seal: the precision fixtures, CAL-01, CAL-02, CAL-03, HCAL-01, HCAL-02, HCAL-03, the
study tasks' clean and trap solutions, and the recorded agent trees (DRIFT-01, PUZZLE-04, TRAPRATE-01): no new finding
on a clean case, no lost hit, and the CAL-03 and HCAL-03 records identical except for findings of the new rules.

## HCAL-04 set

- 2 new domains, none used before: **veterinary clinic** and **community radio station**. Each has a clean Hexagonal
  base with in and out ports, at least two outbound adapters (one of them wrapping a local fake vendor SDK package with
  its own exported types), one inbound adapter, and a composition root.
- Built by 2 fresh sessions, one per domain, given only the construct text of H06, H08 and H11, the spec format and the
  case and label layout of HCAL-03. They get none of the rules, this note's rule section, or any earlier case.
- Per row and domain: 2 positives, 2 twins and 1 legitimate case (3 rows × 5 × 2 = 30 cases), with the shape-variety
  sentence of the earlier briefs.
- Checks before the seal: both bases pass pre-flight and score clean under every rule; per-row count checked; seal by
  SHA-256 manifest plus `RULES-FROZEN.sha256`.

## Frozen before scoring

- The rules on `main` at the seal commit. The Hexagonal row map in `experiments/cal-01/score.ts` with H06 R-ADAPTER-RULE
  (in place of R-D5, R-D3), H08 R-LOCATOR, H11 R-MIRROR.
- HCAL-03 is re-run at the new rule hash as a regression: rows H01–H05, H07, H09, H10 keep their admission only if
  their HCAL-03 record is identical; CAL-03 likewise for the DDD rows.

## Bars, unchanged

Per row: recall 4/4 and 0/6 false positives. Family: pooled recall over the admitted rows ≥ 0.90 with Wilson lower
bound ≥ 0.80, and 0 incorrect findings on the admitted rows' clean cases.

## Use

Scored once, zero model calls. Report `Docs/DiagnosticRuns/v15-hcal04-admission-<date>.md`. Rows admitted here join
the Hexagonal confirmatory family of the final-study registration, which is committed after this scoring and before any
final-study call.
