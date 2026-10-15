# The five v1.3 reference projects (development set)

Small greenfield TypeScript projects, one per architecture style, written for the v1.3 development set. Each has a clean variant, near-miss variants (suspicious-looking code that is fine under the style), and violation variants that plant one defect each. Every expected finding was written into a manifest from the style definition before the tool was run on it (author-manifests). A separate agent wrote blind manifests from the source and the style sources only.

**Say on the slide:** these projects are AI-written and are the cases the v1.3 fixes were made against. They are not a validity estimate.

| Style | Domain of the project | Source files (clean) | Variants | clean / near-miss / planted | Expected blocking findings (author) | Expected blocking findings (blind, expanded) | Canonical source |
|---|---|---|---|---|---|---|---|
| clean-architecture | library loans (books, members, loans, fines) | 29 | 14 | 1 / 3 / 10 | 13 | 15 | Martin 2017, *Clean Architecture* |
| layered | orders (catalogue, customers, orders, discounts) | 27 | 13 | 1 / 3 / 9 | 11 | 10 | Fowler 2002, *PoEAA*; Buschmann et al. 1996 |
| nestjs | workshop registrations (three feature modules + `src/domain`) | 29 | 14 | 1 / 3 / 10 | 11 | 14 | NestJS documentation |
| hexagonal | hotel room booking (driving and driven ports) | 30 | 15 | 1 / 3 / 11 | 13 | 19 | Cockburn 2005, *Hexagonal architecture* |
| ddd | two bounded contexts, `ordering` and `billing`, a shared kernel, an anti-corruption layer | 31 | 15 | 1 / 2 / 12 | 9 | 9 | Evans 2003; Vernon 2013 (see the DDD notes) |
| **total** | | **146** | **71** | **5 / 14 / 52** | **57** | **67** | |

The DDD project includes three probes added after the first tool run (g01, g02, g03), each testing one known limit; g02 is a near-miss, g01 and g03 are planted.

## Where each number comes from

| Number | Source |
|---|---|
| Domains, file counts (clean-architecture 29, layered 27, nestjs 29, hexagonal 30) and canonical sources | `Docs/v1.3-reference-notes.md` §3, "Sources and style definitions" |
| DDD domain and 31 files | `tests/fixtures/v1.3-reference/ddd/README.md` (first paragraph); `Docs/v1.3-ddd-notes.md` |
| File counts again, and the total of 146 | `Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md` §5 table ("Files" column, Total 146) |
| Variants per style (14, 13, 14, 15, 15) | `results/v1.3-reference/after-member-facts/report.md`, first table ("Variants") |
| Planted per style (10, 9, 10, 11, 12) | same table, "Planted detected" denominators |
| Near-misses per style (3, 3, 3, 3, 2) and clean variants (5) | `Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md` §1, "Negative control, near-misses, planted rule" |
| Expected blocking findings, author (13, 11, 11, 13, 9; 57) | `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §3, "Per style, author view" (recall denominators) |
| Expected blocking findings, blind expanded (15, 10, 14, 19, 9; 67) | same doc §3, "Per style, blind (expanded), blocking" (recall denominators) |
| DDD probes g01–g03 | `tests/fixtures/v1.3-reference/ddd/README.md`, "Probes added after the first tool run" |

The blind manifests themselves are sealed outside the repository and were not opened for this kit; only their committed scores are quoted.
