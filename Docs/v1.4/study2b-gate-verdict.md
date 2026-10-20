# Study 2b readiness gate: verdict

**2026-10-20. Verdict: GO-READY-FOR-AUTHOR.** Every never-waived (NW) requirement holds, and every other line is green, fixed now, or registered as a dated deviation before the run with what is lost. No line is NO-GO. One line waits on the author: D10's OSF deposit (PENDING-AUTHOR), which the pre-registration places before the first 2b call; its package is ready in `ops/osf-deposit-2b/`. The author's actions before the run are therefore two: the deposit, and the go. This verdict is not the go: under gate rule 4 and GO-2B the go is the author's, given after the author has seen this verdict. Zero generator calls were made to produce it.

| Status | Lines |
|---|---|
| GREEN | 25 (plus the "Run once" row) |
| PENDING-AUTHOR | 0 (D10 deposited 2026-10-20, https://osf.io/wctnh) |
| FIXED | 2 (S12, D12) |
| REGISTERED-DEVIATION | 14 (V3, V4, V5, V7, V8, V9, V10, V11, S1, S3, S10, D1, D8, D16) |
| NO-GO | 0 |

**Sources.** The gate is §6 of the pre-registration (`Docs/v1.4/study2b-preregistration.md`, registered 2026-10-20T12:36:37Z; its sha256 equals `Docs/v1.4/study2b-preregistration.registered.sha256`), with the line definitions of `Docs/v1.3/study2-readiness-gate.md` and the rule of GO-2B (`ops/decisions.md`). The new deviations are DA1 to DA7 in `Docs/v1.4/study2b-preregistration-addendum-1.md`, dated before any 2b call, because the pre-registration is already dated (its §5 rule). The coordinator's decisions behind them are DELEG12 in `ops/decisions.md`.

**Evidence base.** Taken on the branch of this verdict, which is `main` after PR #316 (merged at `a672d35d`) plus this change. The commands were run from this branch with the frozen trees at the tag (`<shared>/daedalus-study2b/instrument-4d28d280/`, `daedalus-build/4d28d280/`). The outputs are in `results/v1.3-study2-gate/pre-run-2026-10-20/`. Gate rule 3 still applies: the zero-call checks are re-run at the run commit by the run session, and the live S4 re-run (9 calls) is part of the run, after the go.

**Hard constraints kept.** No generator call. Nothing under `../daedalus-sealed/` was opened or printed: scripts read it in-process and printed sha256s and counts only. `results/v1.3-meaning/mean-01-sample.*` was not touched. No change to `scripts/v1.3`, `src`, `presets` or the freeze tag (`git diff --stat v1.4-freeze-2026-10-20 -- src presets scripts/lib scripts/v1.3` is empty). No Neo4j. No `HEAVY_ADMISSION_BYPASS`.

## 1. The 42 lines

NW = never waived under GO-2B. Evidence paths are relative to the repository root; `E/` stands for `results/v1.3-study2-gate/pre-run-2026-10-20/`.

| Line | NW | Status | Evidence | What is lost (deviations only) |
|---|---|---|---|---|
| V1 construct answers | **NW** | GREEN | ADR-V13-03 accepted under DELEG2; freeze F1–F6 OK in the dry run (`E/freeze-check-dry-run.txt`, see §3); freeze record `Docs/DiagnosticRuns/v1.4-freeze-2026-10-20.md` | — |
| V2 tiers and sources at sealed hashes | **NW** | GREEN | `rule-tiers.md` 290794e0…, `style-rule-sources.md` 7ce49c63…, equal to `Docs/v1.3/sealed-hashes.md` (freeze dry run F6 OK) | — |
| V3 hold-out run once at X | — | REGISTERED-DEVIATION | DV2 (§8); DELEG-H4: the aborted attempt-3 run (0 findings, no figure) does not spend the hold-out; F-RF applies to 2b (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md` §9–§10) | No hold-out figure before 2b: Layered recall is "characterised on the development set, not validated on a hold-out" |
| V4 V4 bar per style | — | REGISTERED-DEVIATION | ADR-V14-04 (V4-ACC); route F-RF (addendum 2 §2, on main with its hash row); parts A and B as amended (§4) | No instrument-accuracy claim; Layered is confirmatory for the between-arm contrast only, conditional on part B |
| V5 independent rater | — | REGISTERED-DEVIATION | Timing deviation, drift record §7 | Independent labels come after the study; no human label backs a 2b claim at the time of the run |
| V6 one κ definition | — | GREEN | The three V6 pointer lines (DELEG2) in `Docs/v1.3/validation-protocol.md`, `labelling.md`, `human-labelling-protocol.md` point to one definition, dated before any label | — |
| V7 judge [W] | — | REGISTERED-DEVIATION | [W] waiver: the judge is dropped (drift record §7) | No judge dimension in 2b |
| V8 per-snapshot coverage | — | REGISTERED-DEVIATION | **DA3**; 2a: 89 of 90 snapshots pass L1, no barrel, `require` or `import()` (`E/D13.txt`) | Fidelity is checked after the run, at ≤ 10 % unmapped (not ≥ 0.95 coverage), and the E1 adjudication waits for V5 |
| V9 MCP tools agree with full evaluation | — | REGISTERED-DEVIATION | **DA1**; on 2a, `check_diff` agrees with the full evaluation at the tag on 78/78 step diffs, fast path and `cypher-interp` (`E/V9/v9-2a.md`); the composition-root gap of the §4 probe stays (fix needs `src/`) | On edges from Q25-exempt files the MCP arm is stricter than D; H2 is read through D† |
| V10 (a) non-Claude, (b) [W], (c) writer split | — | REGISTERED-DEVIATION | (a) DV1, Gemini deferred; (b) [W], external set reported as agreement-only; (c) met by the seal record | The cross-vendor claim and V10(a) are deferred to the Gemini extension |
| V11 no leakage | — | REGISTERED-DEVIATION | **DA5**; `E/V11.txt`, `E/V11-tasks.txt`: no leak in the repository, the main checkout or the 2b shared root (longest shared run 18 words over the whole sealed set, 14 over `tasks.json`; the leak rule is ≥ 20); positive control ok. Under HOME, the session-transcript store holds 2,386 of the 2,601 task-text 8-grams, and one transcript a 211-word run | The transcript store under HOME holds the task text; with HOME isolation off, only read confinement keeps it from the agent |
| S1 usage limits | — | REGISTERED-DEVIATION | **DA7**; pause recorded in the step record; D14 live kill-and-resume green | The pause path is not exercised live; a missed limit becomes a logged, counted resume |
| S2 CLI pinned | — | GREEN | Private binary sha256 b9ac5374… and `--version` 2.1.304 checked (`E/dry-run-real-plans.txt`); harness refuses a mismatch (`LOOP_CLI_VERSION_MISMATCH`); outside the auto-updater's reach (DELEG6) | — |
| S3 isolation | — | REGISTERED-DEVIATION | Pre-registration §2 "Environment": per-run HOME isolation off, as declared for 2a; DELEG3 customizations-off flags | Ambient HOME files are outside the cwd but not absent; this is the location of the V11 residual |
| S4 confinement per CLI × arm | **NW** | GREEN | Claude `none` and `daedalus-mcp` PASS (Run 2, `Docs/DiagnosticRuns/v1.4-claude-s4-mcp-2026-10-20.md`); re-run at the run commit (gate rule 3) by the run session, 9 calls, after the go | — |
| S5 no-layout-hint arm | — | GREEN | L1 declared not run (drift record §2) | — |
| S6 advisory per rule | — | GREEN | `advisoryByRule` on 90/90 2a step evaluations; FF-CV05 out of the advisory secondary (drift record §7) | — |
| S7 0 evaluation errors | — | GREEN | 0 evaluation errors on all 2a and rehearsal step records (`E/S7.txt`); the rehearsal re-score at the tag had 0 evaluation failures; in-run procedure in runbook addendum A | — |
| S8 every model live | — | GREEN | Sonnet live in 2a (78 live turns, 1 turn with type-check errors) and in D14 | — |
| S9 one harness root per lane | — | GREEN | The real-plan dry run used three harness roots (`h-l2`, `h-a`, `h-b`), one per lane, lanes alternating (`E/dry-run-real-plans.txt`) | — |
| S10 `--check-prereg` in CI | — | REGISTERED-DEVIATION | **DA2**; CI step "Study 2b registered-artefact hash gate" added (`.github/workflows/ci.yml`; `Docs/v1.4/study2b-registered-artefacts.sha256`) | CI checks the bytes of the registered artefacts, not the filled plans against the pre-registration |
| S11 tunables hashed | **NW** | GREEN | `study2-tunables.ts verify`: ok, 197 entries (also a CI step) | — |
| S12 out-roots archived, path-free | — | FIXED | Runbook addendum C (archive, verify, path-free check per out-root); exercised on the rehearsal `mcp@L2` out-root: 115 files, verify OK (`E/S12.txt`) | — |
| S13 the author's dated words | **NW** | GREEN | GO-2B records the author's go for 2b, dated 2026-10-20 (about 05:30 UTC), conditional on a green gate; the pre-registration is dated before any call. This verdict is shown to the author before the run, and the go after it is the author's | — |
| S14 retired list intact, unread | **NW** | GREEN | 2b `tasks.json` sha256 6ac21079… and `MANIFEST.sha256` e680aeb0… equal to the seal record; no agent opened the sealed set (hashes and counts only); retired list hash checked by the domain examiner (seal record) | — |
| S15 no model labeller | — | GREEN | Labels by the deterministic `check-correct.ts`; the semantic layer is a post-run secondary with its own caps (§4) | — |
| D1 pilot | — | REGISTERED-DEVIATION | DV3: 2a stands in for the pilot | The pilot bar's per-generator lines |
| D2 no banned term | — | GREEN | Sealed hint audit 0 FAIL (seal record); frames identical within a rung (frame tests) | — |
| D3 power ≥ 0.80 | — | GREEN | N = 40 (DELEG7, DV7), §3 | — |
| D4 cost and budget | — | GREEN | 520 step turns, redraw allowance 780 (§3, DELEG7); from 2a's 90 turns (mean 67 s) about 40 min per replicate and 6.7 h for the run before pauses (`E/D4.txt`) | — |
| D5 MCP latency live | — | GREEN | 2a call logs: 38 calls, p95 38 ms per call (bar 1 s), tool time at most 0.12 % of a step's wall time (bar 5 %); rehearsal 6 calls, p95 23 ms (`E/D5/`) | — |
| D6 telemetry checker | — | GREEN | `loop-telemetry-check.ts` on the 2a out-roots: `none@L2` and `none@L3` 0 problems; `mcp@L2` exactly 12 lines, 2 per run, all the inherited `step-01` record (rehearsal finding F3, expected); call logs in `calls/`, outside the agent's `work/` (`E/D6.txt`) | — |
| D7 pins, byte-identical re-score | **NW** | GREEN | Freeze cross-check byte-identical; frozen paths equal to X; argv.ts sha256 0ed7c13b… and `presets/layered.yaml` f0d9045d… equal to P5 and the plan pin | — |
| D8 engine of record | — | REGISTERED-DEVIATION | **DA4**; runbook §6 "Engine parity" | Parity on a post-run sample, not on every snapshot before the run |
| D9 one analysis script | — | GREEN | `study2b-analyse.ts`, 2a reproduced, planted effect recovered (§4); P8 hashes equal to the files | — |
| D10 pre-registration | **NW** | GREEN (deposited 2026-10-20, https://osf.io/wctnh; addendum 2) | The never-waived part holds: dated 2026-10-20T12:36:37Z, before any 2b call; file sha256 equals the registered one; on `main` (PR #316, merged at `a672d35d`). Open: the OSF deposit under embargo, carrying that sha256, which the pre-registration places before the first 2b call. It is an action on the author's OSF account; the package is ready in `ops/osf-deposit-2b/` (files, `SHA256SUMS`, README with the steps) | — (nothing waived; the line turns GREEN when the deposit is recorded) |
| D11 arm set | — | GREEN | 3 cells, shared start (§2); the real plans load and dry-run for all three | — |
| D12 acceptance checks, no waiver | — | FIXED | Post-run runner committed (`scripts/v1.4/post-run-acceptance.ts`, DA6) and checked on the rehearsal: 15/15 stored step snapshots built, started and passed (`E/D12/acceptance-rehearsal.json`) | — |
| D13 coverage and import-kind counts | — | GREEN | `snapshot-coverage.ts` on 90 2a snapshots: reproduces Stage C exactly (`E/D13.txt`, `E/D13-coverage.json`); computed on every 2b snapshot after the run (runbook addendum B) | — |
| D14 live kill-and-resume | — | GREEN | Practice task, 2 calls, redraw logged and counted (`results/v1.4-study2b-prereg/d14-kill-resume.md`) | — |
| D15 DDD spec mode | — | GREEN | Not applicable: no DDD task in 2b (DDD-BETA) | — |
| D16 held-out rules | — | REGISTERED-DEVIATION | Secondary, after the run (pre-registration §6) | The circularity check is not available when the run starts |
| Run once | **NW** | GREEN | The sealed tasks were never run: the rehearsal and D14 used practice tasks; the dry run below used stubs (no model) | — |

### Every NW line

V1 GREEN · V2 GREEN · S4 GREEN · S11 GREEN · S13 GREEN · S14 GREEN · D7 GREEN · D10 GREEN (deposited on OSF; the NW part, the pre-registration dated before the run, holds) · Run once GREEN.

## 2. Zero-call dry run of the real 2b plans

`E/dry-run-real-plans.txt` (wrapper `E/dry-run-real-plans.sh.txt`), 2026-10-20 16:24–16:25Z.

- **Hashes.** Sealed `tasks.json` sha256 `6ac2107916d40b2b8b261613828211f71f39f9581927a6a7286c629ce444c5fc`: **match**. Pinned CLI `<shared>/daedalus-study2b/bin/claude-2.1.304` sha256 `b9ac5374839f14abf3f1f45610637c332b5daee5ce0d1634726cef87aab78e6a`: **match**, `--version` 2.1.304. `MANIFEST.sha256` e680aeb0…, equal to the seal record. The tag is X; the MCP build's `layered.yaml` is f0d9045d…; the tag's argv emits `--disable-slash-commands`.
- **Fill** (`study2b-plans.ts --replicate r`, r = 1..10, sealed acceptance root): exit 0 for every replicate. Each prints `tasks: 4; steps per task: 5`, `acceptance files present: 20 of 20; tasks with every step file: 4 of 4`, and plans with `maxCalls` 20, 16 and 16 (total 52); the run index is r − 1. `tasks with acceptance.startCommand: 0 of 4` is expected: that line is replaced by the DELEG6 rule (runbook addendum DELEG6).
- **Dry run** (§5 commands with `--dry-run`, lanes alternating, branch cells from the replicate's dry `none@L2`): **30 of 30 grids exit 0**, each with `completed` = `runs` = 4 and step turns = `maxCalls` (20, 16, 16), 0 repair turns; 520 stub step turns in all.
- **Cleanup.** `<shared>/daedalus-study2b/run-dry/` (stub snapshots and the filled dry plans) was deleted afterwards, as the runbook requires. No plan file was opened.

## 3. Build checks

- `npm run typecheck` and `tsc -p tsconfig.scripts.json`: exit 0. `jest tests/unit/scripts/v1.4 tests/unit/scripts/loop --maxWorkers=2`: 32 suites, 361 tests, all passed (the new `study2b-gate-checks.test.ts` has 14). `lint:citations`: OK. `lint:protocol`: OK (10 documents agree with the drift record). `sha256sum -c` of the registered-artefact files: every line OK.
- **Freeze-check dry run** (`E/freeze-check-dry-run.txt`): F1–F6 and F13 OK, F14 skipped (no Neo4j). F7–F12 report "unmet" because the dry run treats `HEAD` as the candidate X, and `scripts/v1.4/` holds post-tag additive scripts (the pre-registration's own and this verdict's). That is the expected reading after the freeze; the 2b check is that the frozen inputs equal X, and `git diff --stat v1.4-freeze-2026-10-20 -- src presets scripts/lib scripts/v1.3` is empty. The run uses the instrument tree built from the tag.

## 4. Before the first 2b call (not gate lines; listed so nothing is missed)

1. **The author's go**, after seeing this verdict (gate rule 4, GO-2B).
2. **The OSF deposit** of the pre-registration with its registered sha256, the analysis script and addendum 1, under embargo (pre-registration header): package and steps in `ops/osf-deposit-2b/README.md` (D10, PENDING-AUTHOR).
3. **At the run commit:** re-run the zero-call lines (gate rule 3) and the live S4 re-run for both arms (9 calls; S4 is NW).
4. **The D_sem provenance classifier and D_sem writer** (sem-01 §6 and §8 item 1) are committed and tested before the first 2b call, as the pre-registration requires (§4, "Semantic layer"). They do not exist yet. If they are not committed in time, the two-way D_sem is a deviation that turns that reading exploratory (sem-01 T1); 2b is not held for the semantic layer.
5. **Gate note, the CLI-created `telemetry/` directory.** Claude CLI 2.1.304 once created an empty `telemetry/` directory in the judge config dir, and the judge route's isolation pre-flight refused a call (2a semantic run). The 2b generator is not exposed: the loop runs that listing check only for plans with a `generatorIsolation` block, and the 2b plans have none. The post-run semantic layer (C4, C1d) uses the judge route and is exposed; the check-and-remove step (names only, `rmdir` of an empty directory, anything else a stop) is in runbook addendum D. The judge config dir holds no `telemetry/` entry today.
6. **Optional, the author's choice (DA5):** move the session transcripts that hold the task text outside the user's HOME for the duration of the run, or add a read-outside-cwd probe to the S4 re-run. Neither is required by the gate.

## 5. New deviations and what each loses

| # | Line | Loss |
|---|---|---|
| DA1 | V9 | On presentation → persistence edges from Q25-exempt files, the MCP arm is told "violation" while D does not count them; H2 is then read through D† |
| DA2 | S10 | CI checks registered bytes, not filled-plan semantics; plan fidelity rests on the filler's fill-time checks and the dry run |
| DA3 | V8 | No pre-run fidelity guarantee on 2b code; a weaker per-snapshot bar (≤ 10 % unmapped); adjudication after the study |
| DA4 | D8 | Engine parity is shown on a post-run sample only; a difference forces a recompute on Neo4j before any contrast is read |
| DA5 | V11 | For the session-transcript store under HOME, "no agent could read sealed text" rests on read confinement, not absence; the guard sees refused attempts only |
| DA6 | D12 | None (implementation of the registered procedure) |
| DA7 | S1 | The usage-limit pause path is not exercised live; a missed limit becomes a logged, counted resume |

## Files

- This verdict; `Docs/v1.4/study2b-preregistration-addendum-1.md` (DA1–DA7); runbook addendum (`Docs/v1.4/study2b-runbook.md`, in-run and post-run checks, archiving).
- Scripts (all additive, zero calls): `scripts/v1.4/post-run-acceptance.ts` and `lib/post-run-acceptance.ts` (D12); `scripts/v1.4/leakage-scan.ts` and `lib/leakage-scan.ts` (V11); `scripts/v1.4/mcp-latency-live.ts` (D5); `scripts/v1.4/v9-2a.ts` (V9); test `tests/unit/scripts/v1.4/study2b-gate-checks.test.ts`.
- CI: `.github/workflows/ci.yml` (hash gate), `Docs/v1.4/study2b-registered-artefacts.sha256`.
- Evidence: `results/v1.3-study2-gate/pre-run-2026-10-20/`.
- OSF deposit package (D10, for the author's account): `ops/osf-deposit-2b/` (README, `SHA256SUMS`).


**Update 2026-10-20T18:50:13Z.** The OSF deposit is made (https://osf.io/wctnh; `study2b-preregistration-addendum-2.md`). D10 is GREEN. The one remaining author action before the run is the go.
