# Contract Test Instructions — DaedalusArch v1.2E

> **New in v1.2E** (no v1.0 counterpart). **Cycle**: v1.2 Evaluation-Readiness, Build and Test (plan Step 8). **Date**: 2026-10-08.

DaedalusArch has no service-to-service API. Its contracts are the frozen JSON schemas that the CLI and the experiment harness write and read, and the pre-registration that freezes the experiment inputs.

## 1. Frozen schemas

| Schema | Producer → consumer | Validator | Tests |
|---|---|---|---|
| `schemas/report.schema.json` (frozen at U3-R10) | CLI `evaluate` → U5b scoring, re-scoring, aggregation | `validateReport` (`src/scoring-engine/report-schema-validator.ts`, Ajv over the embedded schema) | `tests/unit/scoring-engine/**`, `report-io.test.ts` |
| `schemas/manifest.schema.json` | U5a `mutate` / `generate-projects` → U5b `score-golden` | `loadManifest` (`scripts/lib/manifest.ts`) | `tests/unit/scripts/mutation/**`, `score-golden-*.test.ts` |
| `scripts/lib/schemas/prereg.schema.json` | `register-prereg` → `--check-prereg` gate | `validatePreRegistration` (`scripts/lib/prereg.ts`) | `prereg.test.ts`, `register-prereg.test.ts` |
| `scripts/lib/schemas/run-record.schema.json` | `run-experiment` → `aggregate`, `score-golden`, results guard | `validateRunRecord` (`scripts/run-experiment.ts`) | `run-experiment.test.ts`, `guards.test.ts` |
| `scripts/lib/schemas/experiment-plan.schema.json` | `experiments/<id>/plan.json` → `run-experiment` | `loadPlan` | `run-experiment.test.ts` |
| `scripts/lib/schemas/environment-record.schema.json` | `record-env` → `RunRecord.envRecordId` | `record-env.ts` | `record-env.test.ts` |
| `scripts/lib/schemas/corpus.schema.json` | `corpus/corpus.json` → `fetch-corpus`, `prepare-bases` | `validateCorpus` (`scripts/lib/corpus.ts`) | `corpus-json.test.ts` |

Run them all:

```bash
npx jest tests/unit/scoring-engine tests/unit/scripts
```

A schema change is a contract change: it needs a design decision (ADR) and, for the report schema, an attributed golden step.

## 2. Report acceptance (BR-U5b-45, OI-U4-8)

`acceptReport` (`scripts/lib/report-io.ts`) rejects, in this order: `schema-invalid`, `function-timeout`, `function-failed`, `function-truncated`, `metric-failed`, `judge-model-mismatch`, `seeded-list-nonempty` (non-empty `judge.seededList`, BR-U4-SEL-06), `missing-baseline-selection` (a paired variant whose neural rows do not reuse the baseline's `selectedUnitIds`, BR-U4-SEL-07). `score-golden` applies the pairing check after the provenance checks of BR-U5b-25.

## 3. Pre-registration and the `--check-prereg` rule (BR-U5b-50, 51)

```bash
npx tsx scripts/run-experiment-cli.ts --check-prereg experiments/<plan id>/plan.json
```

It passes only when (a) `corpus/prereg.json` is committed and the working file equals its blob, (b) its commit is older than the plan's first run under that version, and (c) every registered artefact (the BR-U5b-51 set: matching rule, analysis plan, operator catalogue, generator protocol and prompts, corpus criteria, labeller prompts, `corpus/corpus.json`, overlays, corpus specs, every `experiments/*/plan.json`, `corpus/frozen-instrument.json`) still has its registered sha256. Specs must be corpus specs or listed in `FIXTURE_SPECS`.

Bump procedure (only with a reason; refused with uncommitted registered artefacts):

```bash
npx tsx scripts/register-prereg-cli.ts --reason "<label>: <why>" --dry-run   # inspect
npx tsx scripts/register-prereg-cli.ts --reason "<label>: <why>"
git add corpus/prereg.json && git commit -m "docs(prereg): pre-registration v<N+1> (<reason>)"
npx tsx scripts/run-experiment-cli.ts --check-prereg experiments/fixtures/plan.json   # v<N+1> ok
```

Planned bumps in Build and Test: P-1 (catalogue and protocol freeze), P-2 (only on a cycle-strategy flip), P-3 (sensitivity entries), P-4 (judge freeze).

## 4. Golden change-log contract (FR-30)

`tests/golden/check-changes-log.ts` is the contract between a snapshot change and its attribution; see integration-test-instructions.md §2 for the line grammar and the CI condition.
