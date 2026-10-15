# Study 1 addenda (found during v1.3; not yet in the registered threats register)

`Docs/threats-to-validity.md` is a registered v1.2E artefact, so editing it would break the pre-registration hash gate. The items below are recorded here instead. They go into the threats register at the next registration, and into the thesis now.

## A1. The E1 `none` arm was not free of architectural guidance (2026-10-15)

- **Source:** `Docs/generator-protocol.md` line 75. Every E1 prompt template, *including `none`*, contains "the shared folder-layout sentence (`src/domain`, `src/application`, `src/infrastructure`)". This was a registered design choice, not an accident.
- **Effect found:** the ISE run on E1 (`Docs/DiagnosticRuns/ise-e1-ics-2026-10-15.md`, PR #100):
  - all 65 accepted cells, including all 21 `none` cells, use exactly those three folders;
  - ISE classifies every cell as clean-architecture;
  - the inferred spec equals the given spec in every cell, so intrinsic consistency and extrinsic conformance coincide by construction.
- **Consequence for interpretation:**
  - `none` means "no specification beyond a three-folder layout hint". It does not mean "no architectural guidance".
  - The E1 spec-level contrast is therefore *folder hint* vs *folder hint + prose* vs *folder hint + full AaC spec*.
  - Claims about how LLMs behave "without any spec" (thesis §16.1) are **not tested** by E1.
- **Related finding:** under the v1.3 blocking rules, no E1 cell has a blocking violation at any spec level. The Study 1 "no spec scores best" reversal lives entirely in rules that v1.3 treats as advisory: FF-C02 fan-out, FF-P02 dependency inversion, FF-C06 abstraction ratio.
- **Action:** declare this in Ch7/Ch8. For Study 2 and the spec-influence pilot, include an arm with no layout hint at all, if §16.1 is to be tested.
