# Errata to style-rule-sources.md (sealed; this file corrects without editing it)

**2026-10-16.** These come from the source verification in `Docs/v1.3/rule-source-verification.md`. The sealed file keeps its hash. Thesis text must use the corrected references below.

| Row | Correction |
|---|---|
| Clean FF-P03 (repository/gateway placement) | Add Martin 2017 ch. 23 "Database Gateways" (p. 214) and ch. 17 as locators. Ch. 11 (DIP) also constrains code that *uses* a concrete class, so it is not only about the implementer. |
| ADP FF-S02 | Martin defines components in ch. 12 and states ADP in ch. 14 (p. 112). Ch. 13 is Component Cohesion. Cite ch. 12 and ch. 14. |
| Layered (FF-S01/S03) | Add the POSA locator: vol. 1, ch. 2 §2.2 "Layers" (about pp. 31–51). POSA describes a "Relaxed Layered System" variant: strict no-skip is the strict variant only. |
| Hexagonal (core isolation, port-adapter) | Cockburn's article states no explicit source-dependency rule, and the phrase "application core" does not appear in it. Cite the "Intent" and "Nature of the Solution" sections. The adapter-isolation reading is an inference, not a quotation. |
| DDD isolated domain | Add Evans, *DDD Reference* (2015), p. 10 for the "framework-free" wording. In the 2003 book (ch. 4), infrastructure sits *below* the domain. |
| DDD bounded-context isolation | Add Vernon 2013 ch. 13. Evans also allows Shared Kernel and Conformist relationships, and the anticorruption layer "talks to the other system through its existing interface" (Reference 2015, p. 34). |
| Missing rows | FF-P02, FF-P04, FF-P05, FF-P06, FF-DT05, FF-DS01, FF-DS02 and FF-S04 (in DDD) have no source row. Any of them that blocks needs one before the freeze. |

Wording marked *(recalled)* in the verification file must be checked in print before thesis use.

## Supplement for the missing rows (2026-10-16)

The missing rows are in `Docs/v1.3/style-rule-sources-supplement.md`. That file uses the same table format and changes no tier. The findings for the author:
- **FF-DS01** (blocking in the DDD preset, with no sealed tier row by id) has only a weak source basis. Decide its tier by ADR before the freeze, or report it outside the blocking verdict.
- **FF-DS02** maps to the sealed "DDD, bounded-context isolation" row. Its tier is defensible if it is declared stricter than Evans.
- **FF-P06** and **FF-S04** are defensible as blocking in Clean (and FF-P06 in DDD and Hexagonal). In NestJS they rest on the preset's Clean reading, not on the NestJS docs.
- The **FF-DT05** source (DDD Reference 2015, pp. 10 and 13) is stronger than its advisory reason states.
- The sealed advisory reasons for **FF-P04** and **FF-P05** understate Martin. Advisory still holds on proxy and P2 grounds.
- **FF-S04 in DDD** needs no row: the DDD preset does not declare it (construct-decisions Q11 A).
