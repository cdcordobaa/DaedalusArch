# U6 lane SO1 (ADR-021)

**Date**: 2026-10-09. **Branch**: `v1.2e-u6-so1`. **Findings closed**: SO1-B, SO1-D, SO1-E, X-7 (`Docs/DiagnosticRuns/so-readiness-audit-2026-10-08.json`). SO1-C (the style column) belongs to lane SO4 and is not done here. No live LLM call and no so4-heldout, e7-corpus, e1-grid or labelling run. Neo4j: only the shared `daedalus-neo4j-bt` (7693), under the lane lock.

## What changed

| Finding | Change |
|---|---|
| SO1-B | `scripts/lib/layered-acceptance.ts` (pure: counts, disabled functions with reasons, identities I1/I2, acceptance) and `scripts/so1-layered-acceptance.ts` / `-cli.ts` (with `--self-test`) turn one `evaluate --symbolic-only --format json` report into the FR-v1.2E-20 record. The run used the public layered E7 project `v-aguiar__valex` (`f6f99ea`, `corpus/specs/v-aguiar__valex.yaml` as committed by BT-H in `a258db0`) at tool commit `8d0a37b41009`. Result: `results/pre-tag/layered-8d0a37b41009.json`, with the scrubbed report beside it. Counts: declared 27, compiled 18, disabled 9 (each with its reason), skipped by mode 2, executed 16 = compiled − skippedByMode, failed 0. I1/I2 hold, accepted; verdict `soft-block`, AHS (deterministic) 0.553. The spec hash is unchanged on `v1.2e` at this merge. |
| SO1-D | `REGISTERED_ARTEFACTS` (`scripts/lib/prereg.ts`) adds `specs/clean-arch.yaml`, `tests/fixtures/u5a/layered/firewall.spec.yaml` (via `FIXTURE_SPECS`) and `presets/*.yaml` (`PRESET_PATTERN`). `corpus/prereg.json` keeps its version. A registration made before this change stays valid, because its paths are a subset. |
| SO1-E, X-7 | `scripts/lib/so1-metrics.ts` (pure) and `scripts/so1-metrics.ts` / `-cli.ts` (with `--self-test`) report three things. First, the validator first-pass rate per spec group (corpus, fixture, preset): the version in the commit that added each spec, put through the spec part of `validate`, with a Wilson 95 % interval and the first-failure error codes. Second, the current pass rate. Third, template coverage per built-in style library, compiled ÷ declared per spec style, and spec line counts (total, blank, comment, content). The definitions are in `Docs/analysis-plan.md` §3 (a new SO1-instrument row and paragraph). A dry run at this merge gave: first-pass corpus 6/10, fixture 1/2, preset 1/3; current pass 100 %; template coverage 27/27 for each of the three libraries. |

## Files

- New: `scripts/lib/layered-acceptance.ts`, `scripts/so1-layered-acceptance.ts`, `scripts/so1-layered-acceptance-cli.ts`, `scripts/lib/so1-metrics.ts`, `scripts/so1-metrics.ts`, `scripts/so1-metrics-cli.ts`, `results/pre-tag/layered-8d0a37b41009.json`, `results/pre-tag/layered-8d0a37b41009.report.json`, this note.
- Changed: `scripts/lib/prereg.ts`, the BR-U5b-51 row of `aidlc-docs/construction/v1.2E-u5b-scoring-harness/functional-design/business-rules.md` (it lists the registry again, incl. `corpus/label-plan-config.json`; not a registered artefact), `Docs/analysis-plan.md` (one table row and one paragraph; when merging with P-M's ADR-020 item 7 SO5 row, both rows were kept).
- Tests: new `tests/unit/scripts/u6/layered-acceptance.test.ts` (7) and `tests/unit/scripts/u6/so1-metrics.test.ts` (14), both with hand-computed fixtures. `tests/unit/scripts/u5b/prereg.test.ts` gains 3 cases: the registry list, a registration without them staying valid, and a changed fixture spec being refused once registered.
- Gates: T clean; U `npm test -- --maxWorkers=2` 222 suites / 3103 tests passed; L no new errors (the lane's test files lint clean, and the CLIs sit outside `eslint src tests` like the other `scripts/*-cli.ts`); G `GOLDEN_REQUIRED=1 npm run test:golden` 80 / 7 passed under the lane lock, no snapshot change and no `CHANGES.md` line. Both `--self-test` runs exit 1, as expected.

## Registered artefacts touched (the P-U6 bump must cover them)

1. `Docs/analysis-plan.md`: the SO1-instrument row and paragraph change its hash, so P-U6 must re-hash it. It is also changed by P-M.
2. `specs/clean-arch.yaml`, `tests/fixtures/u5a/layered/firewall.spec.yaml`, `presets/clean-architecture.yaml`, `presets/layered.yaml`, `presets/nestjs.yaml`: these are newly matched by `REGISTERED_ARTEFACTS` and are not yet hashed in `corpus/prereg.json`. P-U6 must add them.
3. `REGISTERED_ARTEFACTS` (code): it gains the entries above. The list keeps P-1's and SO5-gen's entries.

## Open items

- `results/pre-tag/layered-*.json` was recorded at the pre-merge tool commit `8d0a37b41009`. If the FR-20 record must name the tagged commit, rerun `so1-layered-acceptance-cli.ts` after P-U6 (one symbolic-only run, under the lane lock).
- No committed `so1-metrics-<sha>.json` yet. Produce it at the tag, with `npx tsx scripts/so1-metrics-cli.ts --out results/pre-tag/so1-metrics-<sha>.json`.
- The fixture first-pass is 1 of 2 and the preset first-pass is 1 of 3, as measured from git history. These are descriptive values, reported as they are.
