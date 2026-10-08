# Golden snapshot change log (C16, FR-30)

The snapshots in `tests/golden/__snapshots__/` record the observable output of the
symbolic pipeline for the five fixture projects against `specs/clean-arch.yaml`.

Rule: **every change to a snapshot file names the FR that causes it and the commit
that makes it.** A snapshot change without an entry here is a regression, not an
update. Regenerate only with `UPDATE_GOLDEN=1 GOLDEN_REQUIRED=1 npm run test:golden`
(never in CI) and add one line per change:

```
<date> <commit> <case id(s)> — <FR id>: <what changed and why>
```

Observations (verdict gaps against the spec header, truncated `no-cyclic-deps`
results, unexecuted functions) are recorded here too, marked `observation`.

U1 lines use the label `U1-Kn` in place of the commit hash (recover it with `git log --grep 'U1-Kn'`), in the grammar of the U1 code-generation plan D-U1-7.

## Entries

2026-10-07 baseline @7cd15b4 all — FR-30: snapshots of current behaviour (symbolic-only, `specs/clean-arch.yaml`); generated three times with Neo4j 5.26.24 restarted between runs, byte-identical.

2026-10-07 observation all — 17 of 24 compiled symbolic functions execute. FF-CV02, FF-CV03, FF-CV04, FF-P01, FF-SO01, FF-SO02 and FF-SO03 fail with `EVAL_001` (unbound parameters `pattern`, `forbiddenImports`, `maxPublicMethods`/`maxDependencies`, `maxInterfaceMethods`, `maxDepth`); fixed by FR-07 in U1. Each case also carries 26 `SPEC_002` override warnings. No `no-cyclic-deps` result reaches the 100-row cap (no `truncatedFunctions`).

2026-10-07 observation verdicts vs spec header (`specs/clean-arch.yaml:9-14`, figures from the spike repo):
- correct-reference: warning, AHS 0.787 (header: 0.85 pass)
- variant-a-structural: hard-block, 0.308 (header: 0.54 soft-block)
- variant-b-pattern: soft-block, 0.517 (header: 0.58 soft-block)
- variant-c-everything: hard-block, 0.396 (header: 0.33 hard-block)
- variant-d-subtle: hard-block, 0.362 (header: 0.66 warning)
Only variant-b and variant-c match the header verdict. U0 fixes nothing; the re-baseline in Build and Test explains the gaps.

2026-10-08 U1-K2 correct-reference — FR-07 + FR-08 (Q1 grammar, Q2, Q5): typed FR-07 fields and BR-SPEC-10 bind FF-P01, FF-SO01–03, FF-CV02–04; `unexecutedFunctionIds` 7 → 0, the 7 `EVAL_001` warnings removed, `functionResults` 17 → 24 rows, `functionCount` 17 → 24 in every dimension row; FF-CV02 fails with 2 violations (`CompleteTaskUseCase`, `CreateTaskUseCase` do not match `*Service`); AHS 0.787 → 0.802, verdict warning → pass.
2026-10-08 U1-K2 variant-a-structural — FR-07 + FR-08 (Q1 grammar, Q2, Q5): typed FR-07 fields and BR-SPEC-10 bind FF-P01, FF-SO01–03, FF-CV02–04; `unexecutedFunctionIds` 7 → 0, the 7 `EVAL_001` warnings removed, `functionResults` 17 → 24 rows, `functionCount` 17 → 24 in every dimension row; FF-CV02 fails with 1 violation (`CreateTaskUseCase`); AHS 0.308 → 0.353, verdict hard-block unchanged.
2026-10-08 U1-K2 variant-b-pattern — FR-07 + FR-08 (Q1 grammar, Q2, Q5): typed FR-07 fields and BR-SPEC-10 bind FF-P01, FF-SO01–03, FF-CV02–04; `unexecutedFunctionIds` 7 → 0, the 7 `EVAL_001` warnings removed, `functionResults` 17 → 24 rows, `functionCount` 17 → 24 in every dimension row; FF-CV02 fails with 2 violations (`CompleteTaskUseCase`, `CreateTaskUseCase`); FF-SO02 fails with 1 violation (`ITaskRepository` above `max_interface_methods` 5, through U2 Interface CONTAINS Method, BR-U2-47, ADR-016 f); AHS 0.517 → 0.528, verdict soft-block unchanged.
2026-10-08 U1-K2 variant-c-everything — FR-07 + FR-08 (Q1 grammar, Q2, Q5): typed FR-07 fields and BR-SPEC-10 bind FF-P01, FF-SO01–03, FF-CV02–04; `unexecutedFunctionIds` 7 → 0, the 7 `EVAL_001` warnings removed, `functionResults` 17 → 24 rows, `functionCount` 17 → 24 in every dimension row; FF-CV02 fails with 1 violation (`CreateTaskUseCase`); FF-SO01 fails with 1 violation (`GodTask`); FF-SO02 fails with 1 violation (`ITaskRepository`, BR-U2-47, ADR-016 f); AHS 0.396 → 0.374, verdict hard-block unchanged.
2026-10-08 U1-K2 variant-d-subtle — FR-07 + FR-08 (Q1 grammar, Q2, Q5): typed FR-07 fields and BR-SPEC-10 bind FF-P01, FF-SO01–03, FF-CV02–04; `unexecutedFunctionIds` 7 → 0, the 7 `EVAL_001` warnings removed, `functionResults` 17 → 24 rows, `functionCount` 17 → 24 in every dimension row; FF-CV02 fails with 1 violation (`CreateTaskUseCase`); AHS 0.362 → 0.407, verdict hard-block unchanged.
2026-10-08 U1-K2 observation all — FR-07 + FR-08 (Q1 grammar, Q2, Q5): FF-P01 passes vacuously until U3's FR-11 rewrite matches Package nodes, although variant-b and variant-c import `@nestjs/common` / `express` in the domain (`fixtures/variant-b-pattern/src/domain/entities/Task.ts:2`).
2026-10-08 U1-K2 observation all — FR-07 + FR-08 (Q1 grammar, Q2, Q5): FF-SO02 could not match at HEAD (no Interface→Method `CONTAINS` edge); U2 adds it (BR-U2-47, ADR-016 f), so it fires on variant-b and variant-c from K2 on. FF-CV01 always passes (`'.*'` defaults) and FF-CV04 cannot match (`c.decorators` is never ingested). Each is decided by the Build and Test sensitivity check: fixed if it can be made to fire, else excluded from the denominator and declared (BR-U1-39, ADR-016 b).
2026-10-08 U1-K2 observation all — FR-07 + FR-08 (Q1 grammar, Q2, Q5): `default_exclude_paths` in `presets/clean-architecture.yaml` and `presets/nestjs.yaml` stays an unknown key, ignored with `SPEC_001` (U1 Q20 A, D-U1-13).
2026-10-08 U1-K2 observation correct-reference — FR-07 + FR-08 (Q1 grammar, Q2, Q5): the verdict flips warning → pass at K2 partly through FF-P01's vacuous pass; recorded as a cut-off sensitivity threat (business-rules.md §8).

2026-10-08 U1-K3 correct-reference — ADR-015 item 10 (U1 Q21 B): FF-CV02 pattern `*Service|*UseCase` in the four shipped YAMLs (BR-U1-38); use cases no longer read as misnamed services, FF-CV02 passes (2 violations removed: `CompleteTaskUseCase`, `CreateTaskUseCase`); AHS 0.802 → 0.811, verdict pass unchanged.
2026-10-08 U1-K3 variant-a-structural — ADR-015 item 10 (U1 Q21 B): FF-CV02 pattern `*Service|*UseCase` in the four shipped YAMLs (BR-U1-38); use cases no longer read as misnamed services, FF-CV02 passes (1 violation removed: `CreateTaskUseCase`); AHS 0.353 → 0.362, verdict hard-block unchanged.
2026-10-08 U1-K3 variant-b-pattern — ADR-015 item 10 (U1 Q21 B): FF-CV02 pattern `*Service|*UseCase` in the four shipped YAMLs (BR-U1-38); use cases no longer read as misnamed services, FF-CV02 passes (2 violations removed: `CompleteTaskUseCase`, `CreateTaskUseCase`); AHS 0.528 → 0.537, verdict soft-block unchanged.
2026-10-08 U1-K3 variant-c-everything — ADR-015 item 10 (U1 Q21 B): FF-CV02 pattern `*Service|*UseCase` in the four shipped YAMLs (BR-U1-38); use cases no longer read as misnamed services, FF-CV02 passes (1 violation removed: `CreateTaskUseCase`); AHS 0.374 → 0.382, verdict hard-block unchanged.
2026-10-08 U1-K3 variant-d-subtle — ADR-015 item 10 (U1 Q21 B): FF-CV02 pattern `*Service|*UseCase` in the four shipped YAMLs (BR-U1-38); use cases no longer read as misnamed services, FF-CV02 passes (1 violation removed: `CreateTaskUseCase`); AHS 0.407 → 0.416, verdict hard-block unchanged.

2026-10-08 U1-K4 correct-reference — ADR-015 item 10 (U1 Q22 B): FF-S03 `no-layer-skip` is applicable to `layered` only (§3.1, BR-U1-18, AD-8), so it is style-disabled for `clean-architecture`; its `functionResults` row and violations leave the snapshot, `functionCount` 24 → 23 in every dimension row, structural denominator 4 → 3 (`COMPILER_004` is not routed to the snapshot); 2 FF-S03 violations removed; AHS 0.811 → 0.898, verdict pass unchanged.
2026-10-08 U1-K4 variant-a-structural — ADR-015 item 10 (U1 Q22 B): FF-S03 `no-layer-skip` is applicable to `layered` only (§3.1, BR-U1-18, AD-8), so it is style-disabled for `clean-architecture`; its `functionResults` row and violations leave the snapshot, `functionCount` 24 → 23 in every dimension row, structural denominator 4 → 3 (`COMPILER_004` is not routed to the snapshot); 4 FF-S03 violations removed; AHS 0.362 unchanged (structural AVR stays 1.0), verdict hard-block unchanged.
2026-10-08 U1-K4 variant-b-pattern — ADR-015 item 10 (U1 Q22 B): FF-S03 `no-layer-skip` is applicable to `layered` only (§3.1, BR-U1-18, AD-8), so it is style-disabled for `clean-architecture`; its `functionResults` row and violations leave the snapshot, `functionCount` 24 → 23 in every dimension row, structural denominator 4 → 3 (`COMPILER_004` is not routed to the snapshot); 3 FF-S03 violations removed; AHS 0.537 → 0.595, verdict soft-block unchanged.
2026-10-08 U1-K4 variant-c-everything — ADR-015 item 10 (U1 Q22 B): FF-S03 `no-layer-skip` is applicable to `layered` only (§3.1, BR-U1-18, AD-8), so it is style-disabled for `clean-architecture`; its `functionResults` row and violations leave the snapshot, `functionCount` 24 → 23 in every dimension row, structural denominator 4 → 3 (`COMPILER_004` is not routed to the snapshot); 2 FF-S03 violations removed; AHS 0.382 → 0.412, verdict hard-block unchanged.
2026-10-08 U1-K4 variant-d-subtle — ADR-015 item 10 (U1 Q22 B): FF-S03 `no-layer-skip` is applicable to `layered` only (§3.1, BR-U1-18, AD-8), so it is style-disabled for `clean-architecture`; its `functionResults` row and violations leave the snapshot, `functionCount` 24 → 23 in every dimension row, structural denominator 4 → 3 (`COMPILER_004` is not routed to the snapshot); 4 FF-S03 violations removed; AHS 0.416 → 0.445, verdict hard-block unchanged.

## Self-spec

2026-10-08 U1-K1 self — FR-19 (U1 Q3 B): core-modules kind: infrastructure; FF-P03, FF-P05, FF-CV01, FF-CV04 now bind infraLayer and execute.
2026-10-08 U1-K2 self — FR-07 + FR-08 (Q1 grammar, Q2, Q5): FF-C03 threshold 0.8; typed fields bind FF-P01, FF-SO01–03, FF-CV02–04.
2026-10-08 U1-K3 self — ADR-015 item 10 (U1 Q21 B): FF-CV02 pattern `*Service|*UseCase`.
2026-10-08 U1-K4 self — ADR-015 item 10 (U1 Q22 B): no change (no style; applicableStyles ignored, BR-U1-18); FF-S04, FF-P02, FF-P03, FF-P04, FF-P05, FF-C01, FF-CV04 still compile; FF-S03 not declared.
