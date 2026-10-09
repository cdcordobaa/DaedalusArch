# Build and Test Summary — DaedalusArch v1.2E (Evaluation-Readiness)

> **Supersedes** the v1.0 summary (8 units U0–U7, about 280 tests), which stays in git history.
> **Cycle**: v1.2 Evaluation-Readiness · **Stage**: CONSTRUCTION — Build and Test · **Date**: 2026-10-08
> **Plan**: `aidlc-docs/construction/plans/v1.2E-build-and-test-plan.md` (groups BT-A..BT-G, Steps 0–51) · **Rule**: `.aidlc-rule-details/construction/build-and-test.md` Step 7
> **Branch**: `v1.2e-build-and-test` (worktree `<WT>`), base `BT_BASE` = `e9c24c4`, merged into `v1.2e` by PRs #9–#13 and PR-5 (this summary). `main` is untouched (`7cd15b4`).
> **Standing approval** (author): gates passed without pausing; only genuine conflicts are escalated (§7, E-1 and E-2).

**Overall status: stopped at Step 49 with E-1 and E-2 open.** Every step that does not depend on the two escalations is done, and every gate is green. The FR-18 re-baseline (BT-B), the H13 latency gate (BT-D), the sensitivity run (BT-E Steps 28–33), the catalogue freeze and P-1 (Steps 42–43), and the judge freeze, final export, P-4 and the L0 baseline (Steps 44–46) wait for the author. Under plan §2, the orchestrator now escalates.

---

## 1. Build status

| Item | Value |
|---|---|
| Toolchain | Node v24.5.0, npm 11.5.1, TypeScript (lock), ts-morph, neo4j-driver, Jest (versions in `build-instructions.md`) |
| Install | `npm ci` clean in `<WT>` and `<MAIN>`; `npm ls --depth=0` exit 0; `npm ls canvas` empty (BR-U5b-71) |
| Gate T (types) | clean on all five configs: `typecheck`, `typecheck:u0-tests`, `tsconfig.scripts.json`, `tsconfig.u3-tests.json`, `tsconfig.u4-tests.json`. The last three are now blocking CI steps (Step 5; OI-U5b-P2-1, D-U4-14) |
| Build | `npm run build` exit 0 (1.8 s wall time at the BT-G head); `npx tsx bin/firewall.ts --help` lists `evaluate`, `batch`, `drift`, `validate`, `baseline`, `report` |
| Artefacts | `dist/` (CLI); no package published |
| Lane | `daedalus-neo4j-bt`, `neo4j:5.26-community@sha256:f66304b9…096435` (= CI pin), `127.0.0.1:7693` / `127.0.0.1:7479` only, APOC `5.26.24`, credentials only from `~/.daedalus-bt.env` (mode 600) |

## 2. Test execution

### 2.1 Unit and integration tests (Gate U)

| Point | Tests / suites | Delta and source |
|---|---|---|
| `U_BT` (Step 3, `BT_BASE`) | 2864 / 199 | U5b merge state |
| Step 4 | 2869 / 199 | +5: OI-U4-8 consumer side (`f997b79`, DV-BT-5) |
| Step 5 | 2885 / 200 | +16: change-log BT grammar (+8), results guard (+2), prereg bump tool (+6) |
| Step 6 | 2888 / 201 | +3: triaged audit gate |
| Step 15 + 18 | 2900 / 203 | +10 baseline-selection projection, +2 base measurement |
| Step 27 | 2901 / 203 | +1: layered fixture spec admitted |
| Step 35 / 41 | 2903 / 203 | +2: canary fixture tests |
| **BT-G head** | **2903 / 203, 0 failed** | no test added in BT-G |

CI splits the same count as Unit 2888 + Integration 15 (last green push run before BT-G: PR #13). Coverage is not measured by this stage (the v1.0 coverage figure is not comparable and is not repeated).

Observation at the BT-G head: two of three local full runs had one suite "failed to run" because a Jest worker was killed with `SIGSEGV` (`tests/unit/scripts/generators/prompt.test.ts` in the captured run; Node v24.5.0). The suite passes 6 / 6 in isolation three times, and the third full run passed 2903 / 203. No test failed an assertion. Recorded as **OI-BT-G1** (local Jest-worker crash, not a test defect); CI did not show it.

### 2.2 Golden suite (Gate G) and the full-mode lane

| Suite | Result |
|---|---|
| `GOLDEN_REQUIRED=1 npm run test:golden` | **`N_G` = 80 tests / 7 suites, 0 skipped**, at every group end and at the BT-G head |
| Snapshot hashes | equal to `BT_SNAPSHOT_HASHES` (= U5b G0) throughout: correct-reference `a9dbd9cc…`, variant-a `8836db1f…`, variant-b `61327e59…`, variant-c `fbbdcbf5…`, variant-d `17a7b632…` |
| Full-mode lane `npm run test:golden:full` (Step 46, DV-BT-F2) | 7 / 7, Mock replay with `PATH` emptied, zero misses; **L0 baseline not committed (E-2)**, so the lane warns "L0 baseline pending (E-2)" instead of comparing snapshots |
| CAS-11 message test | one removed cassette entry gives `re-record: 1 missing keys`; on real data (Step 37 live cassettes, full spec, replay) `re-record: 30 missing keys` for FF-N02 |
| Mock provenance `model` | a replayed Mock record reports the requested model (`claude-opus-5-5`); U4 Step 28 deviation 3 no longer reproduces on the replay side (the stored Mock entries keep `resolvedModel: "mock-model"`, §8) |

### 2.3 Integration scenarios (Step 4, zero live calls)

| # | Scenario | Result |
|---|---|---|
| 1 | U1 → U2 → U3 symbolic pipeline | Gate G 80 / 7, hashes equal — pass |
| 2 | U3 + U4 full mode on `correct-reference`, committed Mock cassettes in replay | exit 0, schema-valid, 14 judged units (FF-N01 4 + FF-N02 10), `judge.seededList` `[]`, accepted by `acceptReport` — pass |
| 3 | U5a → U5b: forced MO-S01 site scored by `score-golden` | status `matched`, detectedBy 2, collateral 2 (FF-S02 cycles), undeclared 0, dev strict TP 1 / FP 0 / FN 0 — pass |
| 4 | U5b harness fixture plan | CSV set, one byte-identical SVG, two injected failures rejected (`function-failed`, `function-truncated`), 25 / 25 — pass |

Hand-off greps (H8–H11, OI-U4-8, OI-U5a-5, OI-U5a-17, BR-U3-66) all confirmed closed. One gap was closed here: OI-U4-8 `seeded-list-nonempty` and `missing-baseline-selection` were missing from `acceptReport` (DV-BT-5, `f997b79`).

### 2.4 Other gates

| Gate | Result |
|---|---|
| Gate L (lint ratchet) | 497 errors, 2 warnings, at every group end (`L_BT` = 497); every new or edited `scripts/**` file 0 errors under `tsconfig.scripts.json` (D-U5a-8). The ratchet stays `continue-on-error` (residual §6.4) |
| Gate B (test type-error budget) | 80, 0 `TS2688`, at every group end |
| Gate P (no secret in a commit) | 0 / 0 at every commit (lane password, main `.env` password, key patterns; counts only) |
| Change-log checker | green locally and in the PR-only CI step on every BT PR (`golden change log ok: 303 commits` at PR #9) |
| Results guard (BR-U5b-56, re-scoped in Step 5) | green; no file under `results/` was written in this stage |

## 3. Performance

| Item | Status |
|---|---|
| NFR-03 timings (per fixture < 5 000 ms) | **not measured: held by E-1** (Step 11, part of the FR-18 result file) |
| H13 latency gate (`experiments/latency-gate`, ghostfolio `apps/api`, 30 000 ms, ADR-016 e) | **not run: held by E-1** (Step 21 entry gate: `--check-prereg` refuses until P-1). `CYCLE_STRATEGY` stays `'cypher'` by default, not by a gate result; P-2 not made |
| PROFILE rows for FF-S02 and the universal cycle metric | not run (E-1) |
| NFR-07 latency table and SCC long-cycle measurement | not run (E-1) |
| Measured timings that do exist | parity checks per base 1.7–5.8 s (Step 17); base type-check 62 s for four bases (Step 18); corpus fetch 6 min 49 s (Step 13); pilot generation 428 s (Step 41). None is an NFR figure |

## 4. Security

| Item | Result |
|---|---|
| Secrets | Gate P 0 / 0 at every commit; the lane password was generated and written through a pipe, never printed or on argv; no `.env`, `~/.claude` or judge-config content was read or printed |
| Scrub checks (NFR-05, NFR-08) | live cassettes, canary result, model-usage envelopes, selections and corpus records: `grep -c` for home path, `/Users/`, `/Volumes/`, `/private/`, the password, `sk-ant`, Bearer, session and message ids = 0 |
| Dependency audit (NFR-06, SECURITY-10; Step 6) | whole tree 50 → 46 (high 37 → 32, critical 1 → 0); runtime tree high 8 → 5 by a lock-only update; one root advisory left (`braces` GHSA-vfj7-8cjw-p6xm, no fixed release, accepted residual). New **blocking** step "Dependency audit gate (triaged)" (`scripts/audit-gate.ts`, allow-list of one); plain `npm audit` stays report-only (DV-BT-8). Record `Docs/DiagnosticRuns /bt-audit-triage.md` |
| Judge isolation (ADR-018) | CLI `2.1.294` = pin; judge config dir passes the allow-list (14 items, names only); `DISABLE_AUTOUPDATER=1` in the child |
| ISO-07 canary (Step 35, 3 calls) | neutral-cwd negative clean (rule condition met). Under the judge argv from an ancestor cwd the ancestor `CLAUDE.md` token appeared, unlike U4: that channel is closed only by BR-U4-ISO-05 (fresh neutral cwd, fail closed on an ancestor `CLAUDE.md`/`.claude`), which the production path always applies (**OI-BT-F1**) |
| Generator confinement (SECURITY-11, ADR-017 item 8; Step 39) | 5 / 5 probes pass (escape write, `node_modules` overwrite, tsc flag injection, command chaining, allowed command); the Bash protocol stands |
| Stale credentials in docs (Step 7) | the quoted former compose-default password replaced by a placeholder in `.claude/commands/firewall-init.md` and `Docs/Use Agent Playbook.md` (both now 0 matches) |

## 5. Contracts and live-call ledgers

### 5.1 Contract tests
Frozen schemas and their validators (`contract-test-instructions.md` §1) are all exercised by Gate U: report (`validateReport`), manifest, prereg, run record, experiment plan, environment record, corpus. Report acceptance now includes the OI-U4-8 reasons (DV-BT-5). The `--check-prereg` rule (BR-U5b-50) is in force; the bump tool `scripts/register-prereg.ts` exists (Step 5) and has **not** been used.

Current `--check-prereg` state (registration check only, no run): `fixtures`, `latency-gate`, `sensitivity` and `e1-grid` all print `PREREG_REFUSED (artefact-changed)`, because the registered `Docs/generator-protocol.md` (Step 41 freeze) and corpus specs (Step 14 RUB-03) changed after v1. This is expected; P-1 clears it and is held by E-1.

### 5.2 Live-call ledgers (`Docs/DiagnosticRuns /bt-live-call-ledger.md`)

| Ledger | Cap | Used | Steps |
|---|---|---|---|
| Judge (Claude CLI, ADR-018) | 40, retries included | **20** (no retry) | 35 canary 3; 37 SEN-01 FF-N01 + live smoke 17 (15 cassette attempts + 2 ISO-06 init probes, DV-BT-F1) |
| Generator (Claude Code sessions, not judge calls) | 11 + 3 retries | **11**, 0 retries | 39 confinement 5; 40 model usage 3; 41 pilot 3 |

SEN-01 dry count (Step 36, Mock): FF-N01 needs 17 calls, FF-N02 needs 35. Total with the canary 55 > 40, so **E-2** is confirmed. FF-N01 fired by the BR-U4-SEN-01 unit-level criterion (I copy: `src/domain/entities` unit `fail`, violations on the two seeded files; base copy: same unit `pass`). It is never quoted as a result (BR-U4-POL-02).

## 6. Changes made by this stage

### 6.1 Snapshot changes
**None.** No file under `tests/golden/__snapshots__/` or `tests/golden/__snapshots_full__/` changed between `BT_BASE` and the BT-G head, and no `tests/golden/CHANGES.md` line was added. The planned lines (`BT-B1` FR-18 re-baseline; `BT-F1` L0 baseline; any `BT-D1` or `BT-E<n>` line) all belong to held steps.

### 6.2 Commits by group (step commits on `v1.2e-build-and-test`)

| Group | Commits | PR, merge commit |
|---|---|---|
| BT-A | `f997b79` (Step 4 fix), `49cc2bc` (5), `142927e` (6), `b2b00bd` (7), `0d307c5` (8) | #9, `00114de` |
| BT-C | `8e6b94d` (14), `bd13765` (15), `2b6ed60` (18), `e77bed2` (19), `b81cd21` (20) | #10, `bb97a7e` |
| BT-E (pre) | `4044948` (26), `b67b584` (27) | #11, `5020099` |
| BT-F | `80f24f0` (34), `2895a69` (35), `bba0b9c` (36), `eec1e72` (37), `e8e3999` (38), `244d86a` (39), `d97d4c5` (40), `4405d21` (41) | #12, `c8abcf4` |
| BT-F lane | `69cbe3a` (46, lane code and CAS-11 test) | #13, `6bcb3bb` |
| BT-G | `8410dd4` (48), this summary (49) | PR-5 |
| BT-B, BT-D | none (held by E-1; entry gates measured, no change) | — |

### 6.3 Records produced
`Docs/DiagnosticRuns /` (quoted folder name, DV-BT-7): `bt-audit-triage.md`, `u5a-base-typecheck.{json,md}`, `u5a-site-feasibility.{json,md}`, `u5a-freeze-gate-a.{json,md}`, `bt-live-call-ledger.md`, `bt-sen01.md`, `bt-sen01-seeds/`; `Docs/DiagnosticRuns/u5a-model-usage-<model>.json`. `Docs/corpus.md` (§5 FR-22 rubric commit; "Fetched and prepared bases"), `corpus/selections/*.json` (4), `Docs/generator-protocol.md` (**FROZEN 2026-10-08**), ADR-005 amendment, `tests/fixtures/judge-cassettes-live/correct-reference/` (15 scrubbed live entries), Mock cassettes for variant-a..d, `tests/fixtures/claude-cli/canary-result-bt-2026-10-08.json`. Instruction files: `build-instructions.md`, `unit-test-instructions.md`, `integration-test-instructions.md`, `performance-test-instructions.md`, `security-test-instructions.md`, `contract-test-instructions.md`.

### 6.4 Corpus (BT-C)
Ten entries fetched outside every checkout (`../daedalus-corpus`); all ten HEADs equal `corpus/corpus.json`, and the core five equal the `Docs/corpus.md` Clones table. Four bases prepared (realworld-test, ghostfolio-test `apps/api`, truthy-demo, dry-run-test); tsc measured = registered on all four; parity `OK` on all four. Base type-check: realworld 0, truthy-demo 0, dry-run-test 0, **ghostfolio-test 3 errors, so excluded from mutation inputs** (BR-U5a-07; OI-BT-C3). Site feasibility (held-out, seed 20261008): **k = 2 → 47, k = 3 → 69**, so `chooseSitesPerOperator` gives **`CAT_SHORTFALL`** (69 < 80). No k was chosen.

## 7. Remaining author decisions

| # | Decision | Holds | Evidence |
|---|---|---|---|
| (a) | **SO4 floor shortfall** (69 < 80 held-out instances at k = 3; BR-U5a-37 `CAT_SHORTFALL`) and **DV-U5a-22**. Part of it: whether the type-check-excluded ghostfolio-test counts toward k (without it 37 / 54) | E-1 | Step 19; `u5a-site-feasibility.md` |
| (b) | **Gemini labeller id** and the **route for live labelling** | live labelling (deferred to experiments) | U5b §7 |
| E-1 | Open. BR-U5a-40: catalogue (with k) and generator protocol frozen before FR-18 or the first corpus run. The generator protocol is frozen (Step 41); the catalogue cannot be frozen without (a). Alternative: an author ruling on whether BR-U5a-40 covers the fixture-only FR-18 and the symbolic latency gate | Steps 9–12, 21–25, 28–33, 42–43 | plan §2; Steps 9, 21, 28, 42 held notes |
| E-2 | Open. SEN-01 for FF-N02 needs 35 live calls and 20 are left under the 40-call cap. ADR-016 b does not allow excluding a function to fit a budget. Needs a cap that covers the count, or another author route | Steps 38, 44, 45, L0 baseline in 46 | Step 36 dry count; ledger |
| OI-12 | Specs for dev-nest and the five E7 additions, and whether an additive prereg bump for them is a deviation | E7 (deferred) | U5b §7 |
| OI-U5a-15 | `PreparedBase` field names | — | U5a §11 |
| OI-BT-C1 | realworld-test lock points 194 `resolved` URLs at the unreachable mirror `npm.styque.de`; `npm ci` fails (`INSTALL_FAILED`), 39 packages missing (tsc 3.8.3 present; the base was prepared and type-checks 0) | corpus install reproducibility | Step 13 |
| OI-BT-C2 | truthy-demo tree hash depends on install (npm rewrites the tracked `yarn.lock`); no-install value `f28724d8…` | registered tree hash | Step 13 |
| OI-BT-C3 | ghostfolio-test analysis copy misses `../../tsconfig.base.json` and the root `node_modules` (U5a `copyBase` copies only `apps/api`); in the clone, Prisma is not generated under `--ignore-scripts` | ghostfolio as a mutation base; input to (a) | Step 18 |
| OI-BT-E1 | The layered fixture spec is admitted to `FIXTURE_SPECS` but not hashed as a registered artefact (the BR-U5b-51 list is closed); hashing it would change requirement text (DV-BT-E1) | P-1 content | Step 27 |
| OI-BT-F1 | Ancestor `CLAUDE.md` channel closed only by BR-U4-ISO-05, not by the judge argv | threats section | Step 35 |
| OI-BT-F2 | On the unmodified `correct-reference` the FF-N01 `src/application/use-cases` unit fails (ports not declared via `implements`; `CreateTaskUseCase.execute` signature differs from its port). It covers no seeded file, so SEN-01 is unaffected | rubric or fixture reading, before the freeze | Step 37 |
| OI-BT-F3 | The E1 `orderSeed` is not set anywhere yet (0 used as a probe/pilot placeholder) | E1 | Step 39 |
| — | **Rotate the local `.env` Neo4j password** (U0 residual: it equals the former compose default, which is still a token in tracked files; DV-BT-G2) | — | U0 summary; Step 49 Gate P |
| — | Author-install `DISABLE_AUTOUPDATER` switch (BR-U4-ISO-09): not set in the author shell, install-level setting unverified | — | Step 34 |
| — | A logged-in throwaway config dir, to positively control the user `CLAUDE.md` and `UserPromptSubmit` canary channels | — | Step 35 |
| — | Audit step promotion: done as a separate blocking triaged gate (DV-BT-8); the plain `npm audit --audit-level=high` step stays report-only because the accepted residual still counts as high there. Confirm or change | — | Step 6 |
| — | Rename of the `Docs/DiagnosticRuns ` folder (trailing space; quoted per D-U2-5, DV-BT-7) | — | Step 6, 7 |
| — | Thesis-side NFR-04 rows not in the repository: Chapter 4 R-4.13 and the closing contract, Chapter 5 R-5.1, Appendix A field list | — | Step 7 |

## 8. Residual threats to validity

**Judge and isolation (U4)**
- **Canary channels**: the user `CLAUDE.md` and the `UserPromptSubmit` hook are not positively controlled (no logged-in throwaway config dir). The ancestor `CLAUDE.md` channel is closed only by ISO-05 (OI-BT-F1).
- **USAGE_LIMIT**: the classifier patterns and the calls per usage window are unverified. Provoking a limit would spend calls.
- **Mock record provenance `model`**: the replay side now reports the requested model (Step 46 check). The Mock cassette entries still store `resolvedModel: "mock-model"` next to the requested `model` (162 committed Mock entries), so Mock cassettes must never be read as evidence of a resolved judge model; the live cassettes store the resolved `claude-opus-5-5`.
- **ADR prose absent from the judge prompt**: no registered spec supplies `adrProse`, so the `## ADR context` section is always absent (declared limitation, Step 34).
- **Judge-probe base shared with SEN-01**: MO-X02 / MO-X03 and SEN-01 both use `correct-reference`, so probe detection is dev-split only.
- **SEN-01 scope**: FF-N01 was probed with FF-N02 disabled in a scratch spec (DV-BT-3, keys set-equal 15 = 15). FF-N02 is not probed yet (E-2).
- The **U4 §8 list**: judge self-preference on Claude-generated E1 projects; effort; `JUDGE_MAX_TOKENS` ignored by the CLI; CLI version drift; persona and verdict-schema wording; dropped verdict paths; 3 runs per evaluation; unit validity; the > 1/2 aggregation threshold; instability and uncalibrated confidence; selection (`unitCap` 20; FF-N02 capped at 20 on all four prepared bases); token budgets and excerpts; rubric wording; the E1 evaluator spec seen by `full-aac`; timeouts; cassette reuse; the degradation ladder.

**Symbolic engine (U1, U3)**
- **Cycles longer than 10 files** are not detected (BR-U1-28). The Step 25 measurement that would bound this on the corpus is held (E-1). The SCC fallback has no length bound.
- The **U3 §8 list**: correlated checks (one injection fires FF-S01, FF-S04, FF-P06); merged-row evidence; warning cap 50; verdict thresholds reused across modes; metric empty-result definitions; FF-P06 data-flow under `structural`; injection rows without a line; frozen evidence and id conventions; hybrid neural suppression; dropped dimensions without rows; `no-judge-units`; row weights in full mode.
- **U1 threats 2–6**: author tag classification; the frozen `pattern` grammar near the 0.80 cut-off; the author's `layered` applicability table; self-spec deviations from preset defaults; FF-S03 disabled for clean-architecture and nestjs. Also FF-CV01 / FF-CV04 (and FF-CV06) cannot fire until the sensitivity check fixes or excludes them (ADR-016 b, held by E-1), so the per-YAML BR-U1-39 assertion is still vacuous.

**Extractor (U2)**
- Decorators are never ingested (FF-CV04 needs its own FR); duplicates from declaration merging are not detected before ingestion; the dashboard totals now count Package and interface Method nodes and the new edges (no golden coverage); the stale `import-resolution.feature` scenario.

**Corpus and process**
- **Corpus licences**: dev-nest MIT in the README vs ISC in `package.json`, no licence file; realworld-test ISC only in `package.json`.
- Corpus install reproducibility: OI-BT-C1 (realworld lock mirror), OI-BT-C2 (truthy-demo install-dependent tree hash); ghostfolio-test excluded from mutation inputs by its type-check (OI-BT-C3).
- **Lint ratchet** at 497 errors (`dot-notation` 114, `no-non-null-assertion` 91, `restrict-template-expressions` 67, …), non-blocking.
- **Interim neural figures are never quoted** (BR-U4-POL-02): the Step 37 SEN-01 verdicts and the live smoke are instrument checks, not results.
- `braces` GHSA-vfj7-8cjw-p6xm accepted residual (local DoS at worst through tsconfig glob patterns).
- Local Jest-worker `SIGSEGV` under Node v24.5.0 (OI-BT-G1): an environment flake, not a test result.

## 9. Deviations

| # | Step | Deviation |
|---|---|---|
| DV-BT-1 | 14 | RUB-03 is the fifth corpus-spec commit, not the fourth (BR-U5b-77 already put the domain-layer remap fourth); content unchanged |
| DV-BT-2 | 15 | Baseline selections derived with the Mock provider (selection is provider-independent, SEL-04); no score, no `RunRecord`, nothing under `results/` |
| DV-BT-3 | 37 | Live smoke and SEN-01 FF-N01 use a scratch spec with FF-N02 disabled, to fit the cap; FF-N01 keys unchanged |
| DV-BT-4 | 2 | `cypher-shell` not installed; lane smoke through `neo4j-driver` with credentials from env |
| DV-BT-5 | 4 | OI-U4-8 consumer reasons added in Build and Test (`f997b79`), as approved U4 design text |
| DV-BT-6 | 4 | `?? 'neo4j'` grep not empty: 5 `NEO4J_USER` defaults, not passwords; BR-U3-80 holds |
| DV-BT-7 | 6 | The tracked folder is `Docs/DiagnosticRuns ` (trailing space); quoted, not renamed (D-U2-5) |
| DV-BT-8 | 6 | Audit promotion as a separate blocking triaged gate; plain `npm audit` stays report-only |
| DV-BT-9 | 13 | `fetch-corpus --check` refuses an existing destination, so the idempotence rerun used a fresh scratch destination |
| DV-BT-E1 | 27 | The layered spec is admitted, not hashed as a registered artefact (OI-BT-E1) |
| DV-BT-F1 | 34–38 | The ISO-06 init probe of each record-mode run is counted as a judge call |
| DV-BT-F2 | 46 | The full-mode lane is its own suite; `N_G` stays 80 / 7 |
| DV-BT-G2 | 49 | Gate P counted 1 on the first summary commit `bf31fc8`: the main `.env` password equals the former compose default, and the summary named that token (already present in 8 tracked files at `BT_BASE`). The next commit removes it from the summary; the branch is not rewritten (no force-push). Rotating the password is the author action that closes this |
| DV-BT-G1 | 48 | H13 is not closed in Step 48, as the plan expected, because Step 24 is held by E-1; its row says "Open, held by E-1" |

## 10. Record-owner items (not Build and Test)

| Item | Owner |
|---|---|
| U3 H6 (I2 `noJudgeUnits`, BR-U5b-24, 52 "24 templates") | lane-3 record owner (U5b) |
| U3 H14 (FD plan §6.3 amendments) and H15 (U1 plan `INTENT_VIOLATION` line) | lane-2 record owner |
| U3 H16 (b) U5a DE §2.2 enum text, (c) U5b DE §1 and BR-U5b-23, 24, 52, 60, (d) FD plan §1.3 pointer | lane-3 record owner |
| OI-1 clarifications | orchestrator |
| OI-U5a-4, OI-U5a-12, OI-U5a-16 | lane-3 record owner / U5b |
| U1 assertion pinning the `INTENT_VIOLATION` prefix | lane-2 record owner |
| C10 row 1 required form (`failures` optional; stale comment in `evaluation.ts`) | U3 / record owner |
| Decision log lists ADR-014 twice (observation, Step 7) | ADR owner |

## 11. Deferred to experiments (not run here, by instruction)
E1, E7, the SO4 held-out run, live labelling (decision (b)), the full-mode run of the registered `fixtures` plan (about 5 × 42 live calls), the FR-28 acceptance cell (first E1 action), and the per-project alias-name listing in `Docs/corpus.md` (after E7).

## 12. Overall status and next steps

| Item | Status |
|---|---|
| Build | **Success** |
| Tests executed in this stage | **Pass** (Gate U 2903 / 203; Gate G 80 / 7; lane 7 / 7; 4 / 4 integration scenarios) |
| Performance gate (H13, NFR-03, NFR-07) | **Not run** (E-1) |
| Instrument freeze (catalogue, prereg P-1, rubric, P-4, L0) | **Not done** (E-1, E-2); generator protocol frozen |
| Ready for experiments | **No**, until E-1 and E-2 are resolved |

Resume order once the author decides:
1. Decision (a) → Step 42 catalogue freeze → Step 43 P-1 (clears `--check-prereg` for all four plans).
2. BT-D Steps 21–25 (latency gate, ADR-016 e, P-2 on a flip) → BT-B Steps 9–12 (FR-18, `results/pre-tag/`) → BT-E Steps 28–33 (SP copies, P-3, sensitivity run, ADR-016 b decisions) → PR-3.
3. E-2 route → Step 38 SEN-01 FF-N02 → Step 44 rubric freeze → Step 45 final export and P-4 → Step 46 L0 baseline (`BT-F1` line) → PR.
4. Then the experiments (E1, E7, SO4, live labelling with decision (b)).

The lanes are kept for that resume (Step 51): `daedalus-neo4j-bt`, `~/.daedalus-bt.env`, `<WT>`, `../daedalus-corpus`, and the generator roots `../daedalus-e1-outcomes` and `../daedalus-gen-harness`. `../daedalus-sp-probes` has not been created yet (Step 28 held).
