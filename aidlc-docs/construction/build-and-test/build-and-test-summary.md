# Build and Test Summary — DaedalusArch v1.2E (Evaluation-Readiness)

> **Supersedes** the v1.0 summary (8 units U0–U7, about 280 tests), which stays in git history.
> **Cycle**: v1.2 Evaluation-Readiness · **Stage**: CONSTRUCTION — Build and Test · **Date**: 2026-10-08, refreshed 2026-10-09 (BT-G, after the E-1 and E-2 resolutions)
> **Plan**: `aidlc-docs/construction/plans/v1.2E-build-and-test-plan.md` (groups BT-A..BT-H, Steps 0–60) · **Rule**: `.aidlc-rule-details/construction/build-and-test.md` Step 7
> **Branch**: `v1.2e-build-and-test`, merged into `v1.2e` by PRs #9–#13, #15, #20, #35, #36 and #37 (BT-F, pending at this writing) and the PR of this refresh. `main` is untouched.
> **Standing approval** (author): gates passed without pausing; decisions taken by the orchestrator are recorded in ADR-019, ADR-020, ADR-021 and ADR-022.

**Overall status: Ready for experiments: yes** (§12). Every Build and Test step is done. E-1 was resolved by ADR-019 (k = 2, 85 held-out instances), and E-2 by ADR-019 item 5 (SEN-01 ran in full). The instrument is frozen and registered: catalogue (P-1), sensitivity decisions (P-3, P-E) and judge (P-4, prereg **v7**). The L0 baseline is committed. No experiment (SO4 held-out, E7, E1, live labelling) has run. Those runs follow the runbook (`experiment-runbook.md`).

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
| BT-G (2026-10-08) | 2903 / 203 | — |
| U6 merge (PR #34) and BT-H | 3213 / 228 | U6 lanes; base preparation +8; E7 generator +4 |
| BT-B..BT-F resume (2026-10-09) | **3252 / 233**, 0 failed; integration 15 / 2 | +39: runbook tooling (so2 profile, so4 entries, E7 volume), path relativisation, `--sensitivity` and collateral probes, SP forced sites and copies CLI, `--judge-cli` |

CI runs Unit and Integration separately; every BT PR in this refresh was green on push and on PR before merge. Coverage is not measured by this stage (the v1.0 coverage figure is not comparable and is not repeated).

Observation at the BT-G head: two of three local full runs had one suite "failed to run" because a Jest worker was killed with `SIGSEGV` (`tests/unit/scripts/generators/prompt.test.ts` in the captured run; Node v24.5.0). The suite passes 6 / 6 in isolation three times, and the third full run passed 2903 / 203. No test failed an assertion. Recorded as **OI-BT-G1** (local Jest-worker crash, not a test defect); CI did not show it.

### 2.2 Golden suite (Gate G) and the full-mode lane

| Suite | Result |
|---|---|
| `GOLDEN_REQUIRED=1 npm run test:golden` | **`N_G` = 80 tests / 7 suites, 0 skipped** |
| Snapshots | unchanged through BT-B (FR-18 line `BT-B1`); **changed once**, by `BT-E1` (`4e94cea`, ADR-016 b): FF-CV01 and FF-CV04 disabled. The two vacuous passes leave each fixture's convention row, AHS −0.004, verdicts unchanged, one line per case |
| FR-18 acceptance | FF-SO02 fails on variant-b and variant-c; `ITaskRepository CONTAINS` = 8, so BR-U1-39 does not apply (ADR-016 f) |
| Full-mode lane `npm run test:golden:full` | 7 / 7, Mock replay with `PATH` emptied, zero misses; **L0 baseline committed** (`53cfaed`, `BT-F1`, frozen rubric `f8b2dabb…eac5a`) |
| CAS-11 message test | `re-record: <n> missing keys` (Step 46) |

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
| Gate L (lint ratchet) | **496** errors (was 497), 0 on every new or edited file under its tsconfig |
| Gate B (test type-error budget) | 80, 0 `TS2688` |
| Gate P (no secret in a commit) | 0 / 0 at every commit |
| Change-log checker | green (`golden change log ok: 473 commits`) |
| Results guard (BR-U5b-56) | green with the committed `results/pre-tag/`, `results/latency-gate/` and `results/sensitivity/` trees; absolute-path and password counts 0 over all of them |
| Pre-registration gate (CI, ADR-021 item 7) | `--check-prereg` prints `pre-registration v7 ok: 65 registered artefacts unchanged` for all seven plans |

## 3. Performance

| Item | Result |
|---|---|
| FR-18 fixture timings (NFR-02: symbolic-only < 5 000 ms; the plan text says NFR-03) | 575–673 ms per fixture, compiled build (`results/pre-tag/fixtures-*.json`). A contended first attempt (load 55–61) was discarded |
| H13 latency gate (`experiments/latency-gate`, ghostfolio `apps/api`, 241 files, 30 000 ms, ADR-016 e) | **pass**: FF-S02 547 ms, universal cycle metric 1 346 ms, total 5 343 ms (`results/latency-gate/so2/gate.json`). **`CYCLE_STRATEGY` stays `'cypher'`**, P-2 unused |
| PROFILE rows (3 repetitions after a warm-up) | ghostfolio FF-S02 594–654 ms / metric 1 396–1 415 ms; realworld 2–4 ms; truthy-demo 42–84 ms; dry-run-test 57–94 ms; none truncated or timed out (`Docs/DiagnosticRuns/bt-latency-profile.md`) |
| Long cycles (BR-U1-28, 31) | no SCC component larger than 10 files on the four bases (largest 4) |
| E7 judge volume (runbook 0c) | 760 calls (cap ceiling 847), about 0.5 h at concurrency 3 (`Docs/DiagnosticRuns/e7-judge-volume.md`); E1: `Docs/DiagnosticRuns/e1-judge-volume-estimate.md` |

## 4. Security

| Item | Result |
|---|---|
| Secrets | Gate P 0 / 0 at every commit; the lane password was generated and written through a pipe, never printed or on argv; no `.env`, `~/.claude` or judge-config content was read or printed |
| Scrub checks (NFR-05, NFR-08) | live cassettes, canary result, model-usage envelopes, selections and corpus records: `grep -c` for home path, `/Users/`, `/Volumes/`, `/private/`, the password, `sk-ant`, Bearer, session and message ids = 0 |
| Dependency audit (NFR-06, SECURITY-10; Step 6) | whole tree 50 → 46 (high 37 → 32, critical 1 → 0); runtime tree high 8 → 5 by a lock-only update; one root advisory left (`braces` GHSA-vfj7-8cjw-p6xm, no fixed release, accepted residual). New **blocking** step "Dependency audit gate (triaged)" (`scripts/audit-gate.ts`, allow-list of one); plain `npm audit` stays report-only (DV-BT-8). Record `Docs/DiagnosticRuns /bt-audit-triage.md` |
| Judge isolation (ADR-018; ADR-022 item 5) | The author's `claude` moved to `2.1.295`. The pinned judge CLI `2.1.294` is installed by exact version under `~/.firewall/judge-cli` (mode 700), and the judge uses it by default (`--judge-cli`). Init probe passes (`[StructuredOutput]`, no MCP, `apiKeySource none`, `claude-opus-5-5`). Before the check, the allow-list failed closed on four entries from a non-judge session; they were quarantined, not deleted |
| Labeller pin | `agy --version` = `1.3.2` = `AGY_PINNED_VERSION` (`Docs/labeller-route.md`, registered by P-U6) |
| ISO-07 canary (Step 35, 3 calls) | neutral-cwd negative clean (rule condition met). Under the judge argv from an ancestor cwd the ancestor `CLAUDE.md` token appeared, unlike U4: that channel is closed only by BR-U4-ISO-05 (fresh neutral cwd, fail closed on an ancestor `CLAUDE.md`/`.claude`), which the production path always applies (**OI-BT-F1**) |
| Generator confinement (SECURITY-11, ADR-017 item 8; Step 39) | 5 / 5 probes pass (escape write, `node_modules` overwrite, tsc flag injection, command chaining, allowed command); the Bash protocol stands |
| Stale credentials in docs (Step 7) | the quoted former compose-default password replaced by a placeholder in `.claude/commands/firewall-init.md` and `Docs/Use Agent Playbook.md` (both now 0 matches) |

## 5. Contracts and live-call ledgers

### 5.1 Contract tests and registration
Frozen schemas and their validators are exercised by Gate U. Bumps made in this stage, each committed alone and with per-artefact reasons in `Docs/prereg-reasons.md`:
- **P-1 = v2** (`02fbb2f`): catalogue FROZEN, k = 2, `orderSeed` 20261008, generated E7 specs.
- **P-3 = v5** (`1689249`): sensitivity entries, spec header.
- **P-E = v6** (`65ae471`): the ADR-016 b exclusions, the regenerated E7 specs, `fixAttempts`.
- **P-4 = v7** (`2ead570`): judge freeze; the `--final` export is byte-identical.

P-M (v3) and P-U6 (v4) came from other lanes. P-2 stays reserved and unused, because there was no cycle-strategy flip.

### 5.2 Live-call ledgers (`Docs/DiagnosticRuns /bt-live-call-ledger.md`)

| Ledger | Cap | Used | Steps |
|---|---|---|---|
| Judge (Claude CLI, ADR-018) | **200** (ADR-019 item 5; was 40) | **57**, no retry | 35 canary 3; 37 SEN-01 FF-N01 17; pinned-CLI check 2; 38 SEN-01 FF-N02 35 |
| Generator (Claude Code sessions) | 11 + 3 retries | 11, 0 retries | 39 confinement 5; 40 model usage 3; 41 pilot 3 |

**SEN-01 passed for both neural functions** by the unit-level criterion:
- FF-N01: the I copy's `src/domain/entities` unit fails.
- FF-N02: the S copy's `Task.ts` unit fails (.97), with the violation on `Task.ts`.
- On the base copy, no covering unit fails.

The cassettes are in `tests/fixtures/judge-cassettes-live/correct-reference/`. None of this is ever quoted as a result (BR-U4-POL-02).

## 6. Changes made by this stage

### 6.1 Snapshot changes
- `BT-B1` (observation line): FR-18 re-baseline, snapshots unchanged.
- **`BT-E1`** (`4e94cea`): five golden snapshots, ADR-016 b exclusions; see §2.2.
- **`BT-F1`** (`53cfaed`): the five full-lane L0 snapshots (new).

### 6.2 Commits by group (step commits on `v1.2e-build-and-test`)

| Group | Commits | PR, merge commit |
|---|---|---|
| BT-A | `f997b79` (Step 4 fix), `49cc2bc` (5), `142927e` (6), `b2b00bd` (7), `0d307c5` (8) | #9, `00114de` |
| BT-C | `8e6b94d` (14), `bd13765` (15), `2b6ed60` (18), `e77bed2` (19), `b81cd21` (20) | #10, `bb97a7e` |
| BT-E (pre) | `4044948` (26), `b67b584` (27) | #11, `5020099` |
| BT-F | `80f24f0` (34), `2895a69` (35), `bba0b9c` (36), `eec1e72` (37), `e8e3999` (38), `244d86a` (39), `d97d4c5` (40), `4405d21` (41) | #12, `c8abcf4` |
| BT-F lane | `69cbe3a` (46, lane code and CAS-11 test) | #13, `6bcb3bb` |
| BT-G | `8410dd4` (48), first summary (49) | PR-5 |
| BT-H (E-1) | `54fc438`, `ef89bf3`, `36d067f`, `054f993`, `4f56a1c`, `a90f3e3`, `03c000a`, `949db1f`, `51b89c0`, `02fbb2f` (P-1) | #20, `a258db0` |
| Runbook fixes | `0c6a0de` (stages 0b and 0c, profile per base, `../daedalus-so4`, E7 volume) | #35, `b68e0a7` |
| BT-B, BT-D, BT-E | `79e2eaa`, `4aa9281`, `f3fe474`, `1bace26`, `aa8da14`, `0fac5b9`, `6998cbe`, `20a5049`, `1689249` (P-3), `747950c`, `9c146cb`, `6bf460d`, `fbef4f1`, `165ec73`, `4e94cea` (BT-E1), `b045757` (ADR-022), `65ae471` (P-E), `bf2855d`, `30cae31` | #36, `f6664db` |
| BT-F | `5514351` (`--judge-cli`), `d7a57e7`, `bbc9526` (SEN-01 FF-N02), `e8a2caf` (rubric freeze), `2ead570` (P-4), `53cfaed` (L0), `427907c` (SO1 rerun) | #37 |

### 6.3 Records produced
`Docs/DiagnosticRuns /` (quoted folder name, DV-BT-7): `bt-audit-triage.md`, `u5a-base-typecheck.{json,md}`, `u5a-site-feasibility.{json,md}`, `u5a-freeze-gate-a.{json,md}`, `bt-live-call-ledger.md`, `bt-sen01.md`, `bt-sen01-seeds/`; `Docs/DiagnosticRuns/u5a-model-usage-<model>.json`. `Docs/corpus.md` (§5 FR-22 rubric commit; "Fetched and prepared bases"), `corpus/selections/*.json` (4), `Docs/generator-protocol.md` (**FROZEN 2026-10-08**), ADR-005 amendment, `tests/fixtures/judge-cassettes-live/correct-reference/` (15 scrubbed live entries), Mock cassettes for variant-a..d, `tests/fixtures/claude-cli/canary-result-bt-2026-10-08.json`. Instruction files: `build-instructions.md`, `unit-test-instructions.md`, `integration-test-instructions.md`, `performance-test-instructions.md`, `security-test-instructions.md`, `contract-test-instructions.md`.

### 6.4 Corpus
Seven frozen held-out bases: realworld-test, ghostfolio-test `apps/api` (prepared under ADR-019 item 2), truthy-demo, dry-run-test, zhuravlevma__nestjs-active-record, nestjslatam__ddd, v-aguiar__valex. The E7 specs are generated by the registered rule `Docs/e7-spec-rule.md`. **One feasibility count**: k = 2 → 85, k = 3 → 126, so **k = 2**. A verification re-run after BT-E1 gave identical rows. Excluded and not repaired: dev-nest and eryzerz (type errors) and MarvinRF (suspected report-schema defect with zero judge units, handed to U6). Details in `Docs/corpus.md`.

## 7. Remaining author decisions and open items

**Resolved since the first summary:**
- (a) and E-1, by ADR-019 items 1–3 and 6 (k = 2).
- E-2, by ADR-019 item 5.
- (b) the labeller route: ADR-019 item 4 amendment and P-U6 (`agy` 1.3.2, `gemini-3.1-pro-high`).
- OI-12: the E7 specs, generated by the registered rule.
- OI-BT-C3: ghostfolio, by ADR-019 item 2.
- OI-BT-E1: the layered fixture spec is registered as an artefact.
- OI-BT-F3: `orderSeed` 20261008.
- The cannot-fire checks: ADR-022.

| # | Item | Holds | Evidence |
|---|---|---|---|
| OI-BT-B1 | The package `bin` (`dist/cli/index.js`) only re-exports `main` and never calls it. The installed `daedalus-arch` command does nothing; `bin/firewall.ts` works | packaging, not an experiment | Step 11 |
| MarvinRF | A full-mode report with zero judge units fails the frozen schema (`ahsNeuronal`). This is a suspected schema defect. Re-admission needs a dated registered decision | U6 | Step 56 |
| — | The `business-logic-model.md` §2.3 key table still shows MO-CV02's FF-CV01 collateral (now disabled) | U5a record owner | `4e94cea` |
| — | A judge config dir session at 04:12 left `plugins/`, `history.jsonl` and a transcript, which are now quarantined. Whoever logs in under that dir should use a separate dir, or remove these afterwards (ADR-018 item 1) | operator | ledger row 4 |
| — | **Rotate the local `.env` Neo4j password** (U0 residual; DV-BT-G2) | — | — |
| — | The author-install `DISABLE_AUTOUPDATER` switch matters less now: the judge no longer uses the author install (ADR-022 item 5) | — | — |
| — | A logged-in throwaway config dir, to positively control the user `CLAUDE.md` and `UserPromptSubmit` canary channels | — | Step 35 |
| OI-BT-C1, C2 | realworld lock mirror; truthy-demo install-dependent tree hash | corpus reproducibility | Step 13 |
| OI-BT-F1, F2, G1 | ancestor `CLAUDE.md` channel closed only by ISO-05; FF-N01 application unit on the clean fixture; local Jest `SIGSEGV` | threats | §8 |

## 8. Residual threats to validity

**Judge and isolation (U4)**
- **Canary channels**: the user `CLAUDE.md` and the `UserPromptSubmit` hook are not positively controlled (no logged-in throwaway config dir). The ancestor `CLAUDE.md` channel is closed only by ISO-05 (OI-BT-F1).
- **USAGE_LIMIT**: the classifier patterns and the calls per usage window are unverified. Provoking a limit would spend calls.
- **Mock record provenance `model`**: the replay side now reports the requested model (Step 46 check). The Mock cassette entries still store `resolvedModel: "mock-model"` next to the requested `model` (162 committed Mock entries), so Mock cassettes must never be read as evidence of a resolved judge model; the live cassettes store the resolved `claude-opus-5-5`.
- **ADR prose absent from the judge prompt**: no registered spec supplies `adrProse`, so the `## ADR context` section is always absent (declared limitation, Step 34).
- **Judge-probe base shared with SEN-01**: MO-X02 / MO-X03 and SEN-01 both use `correct-reference`, so probe detection is dev-split only.
- **SEN-01 scope**: each neural function was probed with the other disabled in a scratch spec (DV-BT-3). Both fired on one development fixture only.
- The **U4 §8 list**: judge self-preference on Claude-generated E1 projects; effort; `JUDGE_MAX_TOKENS` ignored by the CLI; CLI version drift; persona and verdict-schema wording; dropped verdict paths; 3 runs per evaluation; unit validity; the > 1/2 aggregation threshold; instability and uncalibrated confidence; selection (`unitCap` 20; FF-N02 capped at 20 on all four prepared bases); token budgets and excerpts; rubric wording; the E1 evaluator spec seen by `full-aac`; timeouts; cassette reuse; the degradation ladder.

**Symbolic engine (U1, U3)**
- **Cycles longer than 10 files** are not detected (BR-U1-28). No SCC larger than 10 files exists on the four measured bases. The E7 additions were not profiled.
- The **U3 §8 list**: correlated checks (one injection fires FF-S01, FF-S04, FF-P06); merged-row evidence; warning cap 50; verdict thresholds reused across modes; metric empty-result definitions; FF-P06 data-flow under `structural`; injection rows without a line; frozen evidence and id conventions; hybrid neural suppression; dropped dimensions without rows; `no-judge-units`; row weights in full mode.
- **U1 threats 2–6**: author tag classification; the frozen `pattern` grammar near the 0.80 cut-off; the author's `layered` applicability table; self-spec deviations from preset defaults; FF-S03 disabled for clean-architecture and nestjs. FF-CV01 and FF-CV04 are excluded after failed frozen probes, and FF-CV06 is fixed (ADR-022). Because of that, the convention dimension rests on four functions, and two (FF-CV02, FF-CV05) carry it on most bases.

**Extractor (U2)**
- Decorators are never ingested (FF-CV04 needs its own FR); duplicates from declaration merging are not detected before ingestion; the dashboard totals now count Package and interface Method nodes and the new edges (no golden coverage); the stale `import-resolution.feature` scenario.

**Corpus and process**
- **Corpus licences**: dev-nest MIT in the README vs ISC in `package.json`, no licence file; realworld-test ISC only in `package.json`.
- Corpus install reproducibility: OI-BT-C1 (realworld lock mirror) and OI-BT-C2 (truthy-demo install-dependent tree hash).
- **Floor-motivated corpus decisions** (Ch7): the domain-layer remap, the ghostfolio preparation and the E7 specs. **Style imbalance**: five nestjs bases, one clean-architecture, one layered.
- **Post-hoc tooling fixes** (ADR-022 item 3) change no measured value, and each is declared.
- **The frozen E1 `full-aac` prompt** still lists FF-CV01 and FF-CV04 as rules (freeze-commit preset, ADR-022 item 1).
- **Lint ratchet** at 496 errors (`dot-notation` 114, `no-non-null-assertion` 91, `restrict-template-expressions` 67, …), non-blocking.
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
| DV-BT-G1 | 48 | H13 was not closed in Step 48 (Step 24 was held). It closed on 2026-10-09 with the Step 24 pass and no flip |
| DV-BT-B1 | 11 | FR-18 runs call `main()` of `dist/cli/index.js` from a scratch module, because the package `bin` does nothing (OI-BT-B1) |
| DV-BT-E2 | 28 | The SP forced sites moved from a unit test into code; the probe copies come from a CLI |
| DV-BT-E3 | 30–31 | The sensitivity re-run goes to `results/sensitivity/step31` (`--out-dir`). The P-3 run stays as the record of the failed frozen probes |
| DV-BT-F3 | 38, 44–46 | The judge uses a dedicated pinned CLI under its own prefix rather than the author's install (ADR-022 item 5) |

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
SO4 held-out (runbook §3), E7 (§4), E1 and the FR-28 acceptance cell (§5), the registered `fixtures` full-mode plan, live labelling (§6), the APG ablation (§1.4–1.5), and the per-project alias-name listing in `Docs/corpus.md`.

## 12. Overall status and next steps

| Item | Status | Evidence |
|---|---|---|
| Build | **Success** | §1 |
| Tests | **Pass** | Gate U 3252 / 233 plus integration 15; Gate G 80 / 7; full-mode lane 7 / 7 with L0; Gate B 80; Gate L 496 |
| Performance gate (H13, NFR-02, NFR-07) | **Pass** | §3; `cypher` kept, P-2 unused |
| Sensitivity (ADR-016 b) | **Done** | 25 / 25 probes decided: 23 fire, FF-CV01 and FF-CV04 `excludedAfterFail` (`results/sensitivity/step31/agg/function_sensitivity.csv`) |
| Instrument freeze | **Done** | catalogue FROZEN (k = 2, orderSeed 20261008); generator protocol FROZEN; judge pre-registration FROZEN (`FROZEN_SHA256 f8b2dabb…eac5a`); `--final` export; prereg **v7**, `--check-prereg` ok on all seven plans |
| Judge and labeller pins | **Hold** | judge `2.1.294` (dedicated prefix), `agy` `1.3.2` |
| SO1 | **Done** | layered acceptance accepted and `so1-metrics` at the post-freeze commit (`results/pre-tag/*-53cfaed4a313.json`) |
| **Ready for experiments** | **Yes** | runbook stage 0b satisfied (P-4 and L0), stage 0c committed (E7 volume); judge ledger 57 / 200 used in Build and Test |

**Next** (runbook order; every run starts with `--check-prereg`):
1. §1.4–1.5 APG ablation and §1.6 NFR-07 table.
2. §3 SO4 held-out: prepare into `../daedalus-so4`, mutate at k = 2, seeded entries, bump, run, score.
3. §4 E7.
4. §5 E1, starting with the FR-28 acceptance cell.
5. §6 labelling with the sealed audit allocation in `../daedalus-sealed/`.
6. §7 aggregation and figures.

Each registered plan change is a dated bump with reasons before its run.

The lanes are kept: `daedalus-neo4j-bt`, `~/.daedalus-bt.env`, the worktree, `../daedalus-corpus`, `../daedalus-sp-probes`, `../daedalus-e1-outcomes`, `~/.firewall/judge-cli`.
