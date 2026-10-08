# BR-U4-SEN-01 sensitivity check — Build and Test record

> **Status**: FF-N01 **fired** (2026-10-08, BT-F Step 37). FF-N02 **not run**: held by E-2 (Step 38; 35 live calls needed, 20 left under the 40-call cap). Development set only (`fixtures/correct-reference`); never quoted as a result (BR-U4-POL-02). Seeds and the probe-independence review line: `bt-sen01-seeds/`.

## Run settings

| Item | Value |
|---|---|
| Provider | `claude-cli`, CLI `2.1.294` (= `PINNED_CLI_VERSION`), model `claude-opus-5-5` (resolved `claude-opus-5-5` on all 15 entries), effort `high`, 3 runs per unit, repetition 0, ADR-018 isolation (preflight and init probe passed) |
| Spec | scratch copy of `specs/clean-arch.yaml` with FF-N02 `enabled: false` (DV-BT-3); FF-N01 keys verified equal to the full-spec keys under Mock (Step 36) |
| Rubric | draft BR-U4-RUB-01 text; `FROZEN_SHA256` (draft) `f8b2dabb865107b5f315c82f7917a3ae1ee265136ffcc733db4f530c76eaec5a`; `src/llm-critic/rubric.ts` sha256 `52960e02663363a38c62bfe101fa899c05424394d7ef80fc9717ee291dcfefc8` |
| Cassettes | `tests/fixtures/judge-cassettes-live/correct-reference/` (15 entries: 12 base + 3 I-copy `src/domain/entities`; all `outcome.kind = valid`, `attempts = 1`); replayed with `claude` absent from `PATH`: `neuralResults` equal to the live record on both copies |
| Live calls | 15 cassette attempts + 2 init probes = 17 (ledger 3 → 20 / 40) |
| Copies | uncapped on both (`unitsSelected` 4, `unitsCapped` 0) |

## FF-N01 `architectural-integrity` (copy I)

| Copy | Covering unit | Unit verdict | Violation paths in that unit | Function result (information only) |
|---|---|---|---|---|
| base | `src/domain/entities` (`Category.ts`, `Task.ts`) | `pass` (confidence .88) | none | `passed: true`, 3 violations (all in `src/application/use-cases`) |
| I | `src/domain/entities` (`Category.ts`, `DateUtils.ts`, `NotificationFormatter.ts`, `Task.ts`) | `fail` (confidence .88) | `src/domain/entities/DateUtils.ts`, `src/domain/entities/NotificationFormatter.ts` | `passed: true`, 5 violations |

**Unit-level criterion (BR-U4-SEN-01; BR-U5a-26; BR-U5b-23)**: on I the covering module unit fails with violations on both added files; on the base the same unit (its pre-existing files) passes. **Fired: yes.** No rubric revision was made.

**Observation (not a result, not a criterion input)**: on the unmodified base the `src/application/use-cases` unit also fails (all three runs; the use cases do not declare `implements` of their ports, and `CreateTaskUseCase.execute` takes a `CreateTaskInput` where the port lists three parameters). It does not cover a seeded file, so it does not affect the criterion; it is listed for the author as OI-BT-F2 (a fixture-level judge finding on the "zero violations" reference).

## FF-N02 `intent-alignment` (copy S)

Not run. Required: 30 base + 3 seeded entries + 2 init probes = 35 live calls (Step 36); remaining after Step 37: 20. **E-2 open.** ADR-016 b exclusion does not apply (no failed criterion; a budget is not a criterion).
