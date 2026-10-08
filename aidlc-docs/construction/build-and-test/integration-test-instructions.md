# Integration Test Instructions — DaedalusArch v1.2E

> **Supersedes** the v1.0 integration-test instructions. The earlier text stays in git history.
> **Cycle**: v1.2 Evaluation-Readiness, Build and Test (plan Steps 4 and 8). **Date**: 2026-10-08.

All scenarios make **zero live LLM calls**. They need the lane Neo4j (build-instructions.md §3) and the lane preamble.

## 1. Lane Neo4j setup and teardown

```bash
# setup: see build-instructions.md §3 (daedalus-neo4j-bt, 127.0.0.1:7693 / 7479)
docker ps --filter name=daedalus-neo4j-bt --format '{{.Status}} {{.Ports}}'   # both ports on 127.0.0.1 only
set -a; . ~/.daedalus-bt.env; set +a

# teardown (end of the stage; the env file is removed with it)
docker rm -f daedalus-neo4j-bt
rm -f ~/.daedalus-bt.env
```

Commands that write the lane graph run under the lane lock, so two runs never share a database:

```bash
mkdir "$HOME/.daedalus-7693.lock" && { <command>; rmdir "$HOME/.daedalus-7693.lock"; }
```

## 2. Golden suite (Gate G, FR-30)

```bash
set -a; . ~/.daedalus-bt.env; set +a
GOLDEN_REQUIRED=1 npm run test:golden          # 80 tests / 7 suites, 0 skipped
shasum -a 256 tests/golden/__snapshots__/*.json  # must equal BT_SNAPSHOT_HASHES unless the step is a declared snapshot step
npx tsx tests/golden/check-changes-log-cli.ts    # golden change log ok
```

`BT_SNAPSHOT_HASHES` (Build and Test Step 3, equal to U5b G0): correct-reference `a9dbd9cc…`, variant-a `8836db1f…`, variant-b `61327e59…`, variant-c `fbbdcbf5…`, variant-d `17a7b632…`.

A snapshot change is allowed only in a commit whose subject carries a label (`BT-<A–G><n>:` in this stage) and which adds exactly one attributed line per changed case to `tests/golden/CHANGES.md`:

```text
<date> BT-<G><n> [baseline |observation |re-record, cause <commit/FR> ]<case ids|all> — <FR/ADR id>: <text>
```

CI runs the checker on PRs from `v1.2e-u1-*`, `v1.2e-u3-*`, `v1.2e-u4-*` and `v1.2e-build-and-test*`, after proving its `--self-test` fails.

## 3. Cross-unit scenarios (Build and Test Step 4)

### Scenario 1 — U1 → U2 → U3 symbolic pipeline
The golden suite above: spec compile (U1), extraction and ingestion (U2), evaluation, scoring and report (U3) on the five fixtures.

### Scenario 2 — U3 + U4 full mode, replayed Mock judge
```bash
set -a; . ~/.daedalus-bt.env; set +a
npx tsx bin/firewall.ts evaluate --format json --spec specs/clean-arch.yaml \
  --project fixtures/correct-reference \
  --llm-provider mock --cassette-mode replay \
  --cassette-dir tests/fixtures/judge-cassettes/correct-reference > "$SCRATCH/full.json"
```
Expected: exit 0, empty stderr, schema-valid report, `neuralResults` FF-N01 4 units + FF-N02 10 units = 14 judged units, `judge.seededList` `[]`, AHS deterministic .958 / combined .962 / neuronal 1, verdict pass, accepted by `acceptReport`. A replay miss fails with `re-record: <n> missing keys` (BR-U4-CAS-11).

### Scenario 3 — U5a → U5b, one forced FR-24 entry
```bash
npx tsx scripts/mutate.ts --base fixtures/correct-reference --spec specs/clean-arch.yaml --operator MO-S01 \
  --manifest "$SCRATCH/case/manifest.json" --out "$SCRATCH/copies" --split dev \
  --site '{"filePath":"src/domain/entities/Task.ts","line":1,"detail":{"targetFile":"src/infrastructure/repositories/InMemoryTaskRepository.ts","symbol":"InMemoryTaskRepository"}}'
# evaluate fixtures/correct-reference and the seeded copy (symbolic-only) into $SCRATCH/case/reports/{baseline,MO-S01}.json,
# write their RunRecords (*.run.json; the seeded one carries seed.baselineReportPath), then:
npx tsx scripts/score-golden-cli.ts --case "$SCRATCH/case" --out "$SCRATCH/score.json"
```
Expected (Step 4): 1 row, 0 rejections; seeded copy exit 1 (blocked); score exit 0, status `matched`, detectedBy 2, collateral 2 (FF-S02 cycles), undeclared new 0, dev strict TP 1 / FP 0 / FN 0.

### Scenario 4 — U5b harness on the fixture plan
```bash
npx jest tests/unit/scripts/u5b/aggregate.test.ts tests/unit/scripts/u5b/run-experiment.test.ts --verbose
```
Expected: the full CSV set is written, `runs.csv` lists the two injected failures (`tests/fixtures/u5b/injected/function-failed.json`, `function-truncated.json`) as rejected, and one SVG per figure spec (`ahs-by-project.svg`) renders byte-identically.

## 4. Hand-off checks (read-only)

| Hand-off | Check |
|---|---|
| H8 | `src/llm-critic/neural-result-rows.ts` exports `toNeuralResultRows`; `judgeProvenanceOf` in `src/llm-critic/provenance.ts` |
| H9 | `src/llm-critic/llm-critic.ts` emits `JUDGE_NO_UNITS` with `context.functionId` |
| H10 | `requireEnvForCli('NEO4J_PASSWORD')` in `src/cli/cli.ts`; no default password (`NEO4J_USER ?? 'neo4j'` is a user-name default, DV-BT-6) |
| H11 | `U4-K5` router test in `tests/unit/neuro-symbolic-router/router-modes.test.ts` |
| OI-U4-8 | `acceptReport` reasons `seeded-list-nonempty`, `missing-baseline-selection` and the `judge.model` check (`scripts/lib/report-io.ts`; DV-BT-5) |
| OI-U5a-5, OI-U5a-17 | `scripts/prepare-bases.ts` measures `tscVersion` from `tscPath` and hashes the overlaid file |
| BR-U3-66 | `tests/unit/scripts/mutation/u3-discriminators.test.ts` |
