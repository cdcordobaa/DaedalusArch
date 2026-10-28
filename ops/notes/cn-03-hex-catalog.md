# CN-03: Hexagonal row catalog extension (H08–H10) and HCAL-03 admission design

Date: 2026-10-27. Written and committed before any CN-03 rule change and before any HCAL-03 case exists. Same procedure
as CAL-03 (`ops/notes/cal-03-admission-design.md`), for the Hexagonal family.

## Why

HCAL-02 admitted 4 of 7 Hexagonal rows (H01, H02, H04, H05; `Docs/DiagnosticRuns/v15-hcal02-admission-2026-10-27.md`).
A literature pass on Hexagonal and dependency-injection violations found three violation kinds that the rubric does
not name and that a static rule can see. The rubric grows to 10 rows; the misses of H03 and H07 are revised.

## Sources

- Laigner et al., *Cataloging Dependency Injection Anti-Patterns in Software Systems* (arXiv 2109.04256): 12 Java DI
  anti-patterns, measured by a static analyzer on 4 open-source Spring projects. Concrete class injection, static
  dependence providers (Service Locator) and direct container calls occur in 3 or 4 of the 4 projects.
- M. Seemann, *Dependency Injection Principles, Practices, and Patterns*, ch. 5 (Control Freak, Service Locator,
  Ambient Context, Constrained Construction); *Service Locator is an Anti-Pattern* (blog.ploeh.dk, 2010).
- arXiv 2512.04273, a pilot (5 runs per model) of LLM generation under a "Hexagonal trap" (pure domain, then a
  caching demand): the violations are infrastructure or standard-library I/O modules imported into the domain.
- Practitioner sources (Netguru, Allegro tech blog, foojay, Manning *Clean Applications with Hexagonal Architecture*
  ch. 5): business logic in adapters, ports shaped by adapter APIs, one model shared by controller, domain and
  persistence.

Kinds found and not added: fat DI class, useless injection, open-window injection, too many ports (code smells or
over-engineering, not boundary violations); cycles (already FF-S02).

## Rows

H01–H07 keep their construct text (`Docs/v1.5/ddd-detection-paths.md` §6). New rows:

| Row | Construct (what a positive does) |
|---|---|
| H08 | code outside the composition root obtains a dependency from a container, registry or static provider at run time (`container.get`, `resolve`, a static `getInstance` of an adapter) instead of receiving it through its constructor |
| H09 | domain or application code performs I/O without a port: network, file system, environment variables, a database or cache client, or a child process, by a global call or an I/O module |
| H10 | an inbound adapter uses a domain entity or aggregate as its transport shape: the response body or the request type is the domain type, not a DTO |

H06 (business logic in an adapter) stays a measured row with no new rule in CN-03.

## Rule changes in CN-03 (development, before the seal)

- H03: R-AXA also counts type-only imports between adapter packages (both HCAL-02 misses were `import type`).
- H07: R-TRANSPORT also sees status-named fields, parameters and constructor arguments with HTTP codes, and imports of
  HTTP packages in domain, application and port code (the three HCAL-02 misses).
- H08: new rule R-LOCATOR.
- H09: new rule R-COREIO, reusing the I/O module classifier of R-PURE plus the global I/O calls.
- H10: new rule R-ENTITY-OUT, reusing the entity-exposure facts of R-D9 on inbound adapters.

HCAL-02 becomes development evidence for H03 and H07. Development checks before the seal: the precision fixtures,
HCAL-01, HCAL-02, CAL-01, CAL-02 and the recorded agent trees, with no new finding on a clean case and no lost hit.

## HCAL-03 set

- 2 new domains, none used before in any calibration set, PUZZLE task or study task: **museum loans** and **community
  solar co-op**. Each has a clean Hexagonal base with in and out ports, at least two out-adapters and one in-adapter.
- Built by 2 fresh sessions, one per domain, given only the construct text of H01–H10, the spec format and the case
  and label layout of HCAL-02. They get none of the rules, this note's rule section, or any earlier case.
- Per row and domain: 2 positives, 2 twins and 1 legitimate case (10 rows × 5 × 2 = 100 cases), with the CAL-03 shape
  variety sentence.
- Checks before the seal: both bases pass pre-flight and score clean under every rule; per-row count checked; seal by
  SHA-256 manifest of cases and bases plus `RULES-FROZEN.sha256` of the rule sources and the scorer.

## Frozen before scoring

- The rules on `main` at the seal commit. No rule change after the seal; a change means HCAL-04.
- The Hexagonal row map in `experiments/cal-01/score.ts` at the seal commit, with H08 R-LOCATOR, H09 R-COREIO and
  H10 R-ENTITY-OUT added.
- All 10 rows are scored, including the 4 that HCAL-02 admitted: the rule hash changes, so they must pass again.

## Bars, unchanged from HCAL-02

- Per row: recall 4/4 and 0/6 false positives.
- Family: pooled recall over the admitted rows ≥ 0.90 with Wilson lower bound ≥ 0.80, and 0 incorrect blocking
  findings.
- H06 is scored and reported and cannot be admitted.
- Labels come from the builders; a disputed label is reported and counted as labelled.

## Use

Scored once, zero model calls. Result in `Docs/DiagnosticRuns/v15-hcal03-admission-<date>.md` and the matrix; the
admitted rows become the Hexagonal confirmatory outcome in the registration. The study tasks do not change: their
traps sit on rows already admitted (`experiments/trap-families/_checks/visibility-2026-10-27.json`).
