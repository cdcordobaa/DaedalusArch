# Study 2b pre-registration: confirmatory drift study (Layered, Claude Sonnet)

<!-- study2-protocol: primary=D-new-blocking-identities-steps-2-to-k; k=5; arms=none,daedalus-mcp; cells=none@L2,none@L3,mcp@L2; start=shared-step-1; unit=distinct-edge; tasks=new-4-layered-2-ddd-sealed-at-freeze; fallback=run-exploratory; order=freeze,hold-out,pilot-and-rehearsal,pre-registration,gate,run; generators=claude-sonnet-5-5,gemini-pin -->

**Status: DRAFT, review answered (2026-10-20). Not yet dated as registered.** It becomes the pre-registration when the Fable re-check of the answers returns GO (§9 step 3). The status line then carries the UTC time, and the file's sha256 at that commit goes in P8. The OSF deposit under embargo follows, before the first 2b call.

- **The protocol source.** The confirmatory protocol is the drift record, [`study2-deviation-2026-10-19-drift.md`](study2-deviation-2026-10-19-drift.md), and its `study2-protocol` block (§2 there). The line above repeats that block. Where this file and the drift record disagree, the drift record wins unless a deviation in §8 says otherwise.
- **How it was written.** AI sessions wrote it with zero model calls. The only calls were the D14 kill-and-resume on a practice task (§4) and the Fable review and re-checks. No session read anything under `daedalus-sealed/` (`shasum` only) or the MEAN-01 sample, and no session names a sealed task. The decisions it applies are the author's, or were delegated by the author: M3, TASKS, GEN, STY, EXP, EXPT, DELEG, DELEG-Q10, DELEG2 to DELEG11, GO-2B and V4-ACC in `ops/decisions.md`. **N, the run order and the analysis rules of the review answers were chosen by the coordinator under that delegation (DELEG7 to DELEG11), not by the author.** The author's dated go (S13, GO-2B) precedes the run.
- **What had been seen.** Everything in drift record §3. Also 2a Stages A, B and C on the 2a tasks only (`Docs/DiagnosticRuns/v1.4-exploratory-stage-a-2026-10-19.md`, `…-stage-b-2026-10-20.md`, `v1.4-exploratory-report-2026-10-20.md`), the hold-out attempts (no figure), and the dress rehearsal on practice tasks. No confirmatory task, and no output on one, has been seen by any agent.
- **Disclosure (review item 16).** Hold-out attempt 1 printed 34 sealed hold-out variant paths into the coordinator's transcript (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`). The same coordinator runs 2b. Those paths belong to the hold-out set, a different sealed set from 2b's confirmatory tasks, and name no 2b task, so 2b is not affected.
- **Lint.** `npm run lint:protocol` checks the documents listed in `scripts/v1.3/protocol-consistency-check.mjs`. This file is not in that list, because that list is a frozen input (`FROZEN_PATHS`), which GO-2B never waives. The file still carries the canonical line and cites the drift record, so `checkDoc` passes on it. It joins the lint list at the next freeze, if there is one.
- **Scripts added after the tag.** All additive, under `scripts/v1.4/`, none at X changed: the power aids (`study2b-power.ts`, `study2b-pilot-power.ts`), the plan filler (`study2b-plans.ts`, with `--replicate`), D† (`d-dagger.ts`), the exemption probe (`cr-exemption-probe.ts`) and the analysis script (`study2b-analyse.ts`). `scripts/v1.3`, `scripts/lib`, `src`, `presets` and the rules are byte-identical to X (`git diff --stat v1.4-freeze-2026-10-20 -- src presets scripts/lib scripts/v1.3` is empty). A frozen-path check at the run commit lists the additions, and the coordinator records it at the gate.

## 1. Hypotheses

D is a count of new violations, so lower is better. Every hypothesis is about the 2b population: the 4 sealed Layered tasks, Claude Sonnet, from a shared step-1 tree.

| Id | Contrast | Predicted direction | Test |
|---|---|---|---|
| **H1** | none@L3 vs none@L2 (SO5: does spec delivery in prose cut drift?) | D(none@L3) **<** D(none@L2) | two-sided (§4) |
| **H2** | mcp@L2 vs none@L2, **"delivery plus checking"** (the MCP tools deliver the spec and also check it, so H2 does not isolate checking; REV-03 finding 4) | D(mcp@L2) **<** D(none@L2) | two-sided |
| **H3** | mcp@L2 vs none@L3 | **none** | two-sided |
| **E** | none@L3 vs mcp@L2, equivalence (drift record §2, "Registered equivalence") | within ±Δ (§3, P4) | two one-sided bounds (§4) |

- **Directional hypotheses, two-sided tests.** The drift record registers two-sided tests (§2, "Confirmatory contrasts"). They are kept: a one-sided test would be a deviation that makes rejection easier.
- **When H1 or H2 is "supported" (review finding 2).** Only if **all** of these hold: (a) it is rejected after Holm under D; (b) its estimate has the predicted sign under D; (c) the Holm decision and the sign are the same under **D†** (below). If (a) and (b) hold but (c) fails, the result is reported as "holds under the composition-root exemption only", and the claim is scoped to that reading. A rejection in the other direction is reported as a finding against the hypothesis.
- **H3 and E answer different questions.** H3 asks whether the two cells differ. E is the only registered way to claim "the firewall adds only spec delivery". A non-rejected H3 is never read as equivalence.

### Primary outcome: D, exactly as the drift record defines it

> **D** per cell: distinct blocking identities present at step j (2 ≤ j ≤ 5) and absent from the shared step-1 tree and from every earlier step of that cell, summed over steps 2–5. Identities follow the pilot memo's identity rule. The unit is the distinct edge (or a cycle as its sorted file set). Only findings that `check-correct.ts` labels `correct` count. The blocking tier is the sealed tiers plus the declared post-seal overlay (ADR-V14-01, -02). Every snapshot is scored (ITT).

- **What D measures.** How far the inherited step-1 pattern spreads into new slices (drift record §2).
- **Y₁ = 0 blocks (finding 8e).** A block whose shared step-1 tree has no counted identity is **expected** to contribute little or nothing to D. That is what probe 1 and 2a showed; it is not a property of D, which counts any new identity. So: the share of blocks with Y₁ = 0 is reported, D is always reported next to Y₁, and a registered sensitivity drops the Y₁ = 0 blocks (§4).
- **The Layered blocking set at the freeze construct.** FF-S01, FF-S02 (cross-layer cycles only) and FF-S03 (`Docs/v1.4/exposure-definitions.md` §6b).
- **Q10 = D and FF-P01 (finding 12).** FF-P01 (framework purity) is not in Layered's blocking set at the tag. It left on 2026-10-20 under decision **DELEG-Q10**: the pre-dated G0.9 Q10 refutation criterion was met on the external Layered set (2 new FF-S01 `express` rows judged incorrect by the C3 checker), and the coordinator applied it as written rather than override it after seeing data. The suspected checker limit is stated there: the checker "does not reach express (literal view)", and the same imports were labelled correct as FF-P01 rows. So D at the tag cannot count a framework import in the business layer, and it cannot be recomputed with FF-P01 at the tag. This narrows the construct, decided before any 2b data. Per-rule exposure (§1, secondary) reports FF-P01 as "not compiled", never as conformant.

### D†, the registered sensitivity primary (finding 2)

**D†** per cell: new distinct presentation → persistence import edges at steps 2–5, **from any file, with no composition-root exemption**, under the identity rule of D (edge grain, ρ from `git diff -M50%`, renames continue; `driftRun` with `STUDY2_S2D01`). The edges are read from each snapshot's evaluated graph: the FF-S03 opportunity edges of `scripts/v1.4/lib/exposure.ts` (the compiled no-layer-skip Cypher with its violation predicate deleted), run with `excludePatterns` emptied. At the tag, the patterns emptied are exactly the five Q25 = B composition-root globs (`main.ts`, `*.module.ts`, `*Container.ts`, `*container.ts`, `composition-root/`). Script: `scripts/v1.4/d-dagger.ts` (helpers `scripts/v1.4/lib/d-dagger.ts`), zero calls.

- **On 2a** (`results/v1.4-study2b-prereg/d-dagger-2a/`): D† = D in all 18 runs, because no 2a wiring sat in an exempt file. The exempt-file share of presentation → persistence edges at step 5 is 0 in every cell, and no run renamed a file to an exempt name.

### Secondary outcomes (no confirmatory claim; no Holm)

| Outcome | Definition |
|---|---|
| **Y₅, the end state** | Distinct blocking identities at step 5 (the first deviation's primary). Also the share of blocks with Y₅ = 0 per cell |
| **Repair** | Inherited step-1 identities that are absent at step j, per cell and step. Also **D \| R = 0**, D in blocks with no inherited removal (2a estimand 3). 2a showed that L3 and MCP often remove the whole step-1 pattern at step 2, which D does not count |
| **Y₁** | Step-1 identities per block (shared by all cells), and the share of blocks with Y₁ = 0 |
| **Per-rule exposure** | For each Layered blocking rule and cell: opportunities, violations, and violations per opportunity, by `scripts/v1.4/exposure-count.ts` at the freeze tag, with the definitions in `exposure-definitions.md`. A rule with 0 opportunities is reported as **not exercised**, never as conformant |
| **Tool-call telemetry** (mcp@L2) | Calls per tool, per step and per run, from the MCP call logs. Share of steps with ≥ 1 `get_architecture_spec` call and with ≥ 1 `check_*` call. Any call to a denied tool is reported as such |
| **The drift record's other secondaries** | The memo §5 slope outcomes; advisory per KLOC without FF-CV05; the seven evasion items (§4, "Evasion"); the acceptance pass rate (D12, §4) |
| **Cost** | Turns, redraws, pauses, pause durations and wall time per cell |
| **Composition-root placement** | Per cell: the share of presentation → persistence edges at step 5 that leave a Q25-exempt file, and the runs with a ρ-mapped rename of a non-exempt file to an exempt name (both from `d-dagger.ts`). They feed the evasion bar (§4). Reported with the count per block. See §7 item 9 |

## 2. Design

| Item | Value | Source |
|---|---|---|
| Tasks | The **4 sealed Layered confirmatory tasks**. `tasks.json` sha256 `6ac2107916d40b2b8b261613828211f71f39f9581927a6a7286c629ce444c5fc`; `MANIFEST.sha256` sha256 `e680aeb06e8c0297c158aa87241bb66e6ba2638ff77e4b1e3bd6c02e02b3abbf` (24 files: tasks, 20 acceptance tests, design notes, audit sheet, hint audit). Written blind (V10c), hint audit 0 FAIL, domain examiner GO. Each hash is re-checked before step 1, and a mismatch stops the run | `confirmatory-tasks-seal.md` |
| Styles | Layered only. The 2 DDD confirmatory tasks are not sealed, and DDD is deferred (DDD-BETA), so the drift record's "otherwise 4 Layered" applies | drift record §2, Blocks |
| Cells | `none@L2` (minimal spec); `none@L3` (minimal spec plus one plain sentence per blocking rule); `mcp@L2` (minimal spec plus the 9 spec-only MCP tools, `evaluate_project` denied). No L1, no L4 | drift record §2 |
| Start | **Shared step 1.** Each block runs step 1 once, in `none@L2`. All three cells branch from that tree at step 2 (`--shared-start-from`, as in 2a Stage B). The step-1 trajectory continues as the block's `none@L2` cell | drift record §2 |
| Horizon | k = 5. Steps 2–5 each add a vertical slice or an outside adapter | drift record §2 |
| Block | One task × one replicate (one shared step-1 tree). **N = 40 blocks, r = 10** (§3, DELEG7) | — |
| Generator | `claude-sonnet-5-5` through Claude Code CLI **2.1.304**, run from the private copy `<shared>/daedalus-study2b/bin/claude-2.1.304` (sha256 `b9ac5374839f14abf3f1f45610637c332b5daee5ce0d1634726cef87aab78e6a`), passed as `--binary`, outside the auto-updater's reach. The run stops on any version or hash mismatch (DELEG6). The plan probe also checks `--version` (`LOOP_CLI_VERSION_MISMATCH`) | DELEG6, P5 |
| Generator argv | The freeze tag's `buildGeneratorArgs` (`scripts/lib/generators/argv.ts`, sha256 at X `0ed7c13b46c79c1b96fd6b92f5cfc8df3c9dc17385d68b25b120accfd50b90de`): `-p`, `--model`, `--output-format json`, `--permission-mode`, `--disallowedTools`, **`--no-session-persistence`**, and the customizations-off set of DELEG3 (`--setting-sources ""`, `--settings {"autoMemoryEnabled":false,"disableAllHooks":true}`, `--disable-slash-commands`). MCP comes only through `--strict-mcp-config`: no server in `none`, and exactly `daedalus-arch` in `daedalus-mcp`. `--bare`, `--add-dir` and `--dangerously-skip-permissions` are never emitted | DELEG3 |
| The `--safe-mode` bridge (review item 13) | The 2a `none@L2` cells that feed P1–P4 ran under `--safe-mode`; 2b runs under the explicit set above. DELEG3 bridges them by a 2-call equivalence check (same tools, servers, plugins and permission mode; no skill or CLAUDE.md). The power inputs are taken across that bridge, as declared | DELEG3 |
| MCP server | Built **at the freeze tag** `v1.4-freeze-2026-10-20` (X = `4d28d2803bec018e48f848e6a0f27ff87b3babf2`), outside every agent cwd, and started with `--confine`. The build commit is recorded in every `mcp@L2` run record | freeze record |
| Confinement | S4 passed for the Claude `daedalus-mcp` arm under the DELEG3 flags (Run 2, 9/9, plus no-MCP probes 1–5; `Docs/DiagnosticRuns/v1.4-claude-s4-mcp-2026-10-20.md`). It is re-run at the run commit (gate rule 3) | S4 |
| **Run order (finding 4, DELEG9)** | **Per replicate.** For r = 1..10: fill the R = 1 plans of replicate r (`study2b-plans.ts --replicate r`: run index r − 1 through the harness's own `firstRun`, at the tag); run `none@L2` replicate r (steps 1–5 of the 4 tasks, 20 turns); then `none@L3` r and `mcp@L2` r (16 turns each) in **two lanes at once**, each branching from replicate r's `none@L2` out-root. Lanes alternate: lane A runs `none@L3` for odd r and `mcp@L2` for even r, lane B the other cell. Within a plan, the task order is the harness's seeded draw from `orderSeed` **20261019** (`scheduleLoopRuns`). So the three cells of a block run hours apart, not days, and no cell sits on one lane. A zero-call dry run on the practice task showed the frozen harness runs this order with no `scripts/` change (`results/v1.4-study2b-prereg/per-replicate-dry-run.md`) | DELEG9, runbook §5 |
| Environment | One instrument tree; one harness root per lane plus one for `none@L2` (S9). Per-run HOME isolation off, as declared for 2a (S3) | S9, S3 |
| Recorded covariates (findings 4, 11) | Per turn (one turn per step, no repair turns): start and end timestamps (step record `startedAt`, `finishedAt`, and the turn's `wallMs`), the model string the CLI JSON result reports (`modelUsage` keys and `canonicalModel`), the lane and the replicate. They are recorded, not adjusted for; the time and lane sensitivities of §4 read them | — |
| Acceptance (D12) | In-loop acceptance stays **enabled** in the plans. Its records are expected to be `no-start-command` (the skeleton has no `start` script; rehearsal F2) and are not failures. The registered acceptance outcome is the post-run procedure of §4 (DELEG6, DELEG8) | DELEG6, DELEG8 |
| Run once | The sealed tasks are run once, here. They are never run for practice: the dress rehearsal and the D14 check used practice tasks only | GO-2B |

### Gemini: a dated extension arm (declared deviation)

- **What.** The drift record registers `generators=claude-sonnet-5-5,gemini-pin`, one lane each. 2b runs **Claude only** (GO-2B; `ops/05-plan-to-friday-2026-10-23.md`).
- **When.** Gemini runs later as a **dated extension arm**: after its quota resets (about 2026-10-25), on the same sealed tasks and cells, **with N = 40 (r = 10) and the same run order**, **only if** its own S4 passes (Gemini failed S4 under agy 1.4.2: exploratory registration, amendment 1 item 2). Its addendum (P9: model id, agy pin, S4 result, date) is dated **before its first call** (review item 17).
- **What is lost.**
  1. **The cross-vendor claim is deferred.** 2b's confirmatory claims hold for Claude Sonnet only.
  2. The registered falsifier "sign agreement between generators" cannot be applied in 2b.
  3. V10(a), a non-Claude generator, is not met by 2b.
  4. The pooled 32-block design becomes 40 Claude blocks.
- **How the extension is analysed.** Separately, with the same tests and the same script. It is never pooled into 2b's Holm family after 2b's results are seen. The sign agreement with 2b is reported descriptively.

## 3. Sample size

**The method is fixed here and the numbers come from 2a Stage C** (every 2a cell re-scored at the freeze tag with `check-correct`). The pre-freeze previews are **not** used: they mix two constructs (the Stage B note, last paragraph).

### P1: per-cell variance (filled from 2a Stage C)

**Source.** The registered D of 2a Stage C, re-scored at the freeze tag with only `check-correct` `correct` findings: `results/v1.4-exploratory/stage-c/rescore/runs.json` (`registered.D`, `registered.Y1`), and `Docs/DiagnosticRuns/v1.4-exploratory-report-2026-10-20.md` §3. The block order is hive-health r1, r2, ice-rink r1, r2, youth-league r1, r2. Computed by `scripts/v1.4/study2b-power.ts`; output `results/v1.4-study2b-power/resampling/{power.json,tables.md}`.

| Cell (2a, 6 blocks) | D per block | mean D | SD D | NB θ (moments) | P(D = 0) | mean Y₁ |
|---|---|---|---|---|---|---|
| none@L2 | 1, 0, 1, 3, 2, 2 | 1.50 | 1.05 | **undefined**: variance 1.10 < mean 1.50, no overdispersion | 0.17 (1/6) | 2.00 (Y₁ = 1, 1, 4, 4, 1, 1) |
| none@L3 | 2, 0, 0, 2, 0, 0 | 0.67 | 1.03 | 1.11 | 0.67 (4/6) | — |
| mcp@L2 | 1, 0, 0, 0, 0, 2 | 0.50 | 0.84 | 1.25 | 0.67 (4/6) | — |

- **SD** is the sample SD (n − 1). **θ by moments** is mean² / (variance − mean).
- **Y₁** is shared by the cells of a block. Y₁ = 0 in 0 of 6 blocks.

### P2: paired differences (filled from 2a Stage C)

d_b = D(reference cell) − D(other cell), per block.

| Contrast | d_b per block | p₀ = share of d_b = 0 | q = P(d_b > 0 \| d_b ≠ 0) | mean d | SD d |
|---|---|---|---|---|---|
| H1: none@L2 − none@L3 | −1, 0, 1, 1, 2, 2 | 0.17 (1/6) | 0.80 (4/5) | 0.83 | 1.17 |
| H2: none@L2 − mcp@L2 | 0, 0, 1, 3, 2, 0 | 0.50 (3/6) | 1.00 (3/3) | 1.00 | 1.26 |
| H3: none@L3 − mcp@L2 | 1, 0, 0, 2, 0, −2 | 0.50 (3/6) | 0.67 (2/3) | 0.17 | 1.33 |

### Computation (in this order)

1. **A floor from exactness.** A two-sided sign-flip test over n non-zero paired differences cannot give p below 2 × 2⁻ⁿ. Holm's thresholds over 3 tests are 0.05/3, 0.05/2 and 0.05. So the minimum number of **non-zero** pairs is 7, 7 and 6 at the three Holm steps. Zero differences carry no information, so the blocks needed are at least 7 / (1 − p₀) for H1 and H2.
2. **The registered power rule (drift record §4), binding.** `pilotPower` (`scripts/v1.3/lib/level-power-sim.ts`) with the 2a none@L2 D as the pilot, `--lower-bound 0.8 --theta-band 1,4,inf --sims 2000 --seed 20261018` (`Docs/v1.4/drift-power-sim.md` §3). Power is read at RR 0.25 under **independent** cells, and a contrast below 0.80 for any θ of the band is demoted before dating. The **shared** correlation model is reported beside it, as the drift record §4 requires. The registered entry runs a fixed 4 × 4 × generators grid; the extended grid is run by `scripts/v1.4/study2b-pilot-power.ts`, which calls the same `pilotPower` with its own `grid` argument (4 tasks × r replicates × 1 generator). At N = 16 it reproduces the registered entry's table row for row.
3. **Power at the actual grid, by resampling 2a's paired differences.** For N ∈ `STUDY2B_GRID` = {8, 12, 16, 20, 24, 32, 40}: draw N block differences with replacement from P2, apply the sign-flip test at **α′ = 0.0167**, 2,000 simulations, seed `20261021`, at the 2a size and at half size (each d_b → round(d_b / 2), ties randomised by the seed). **Step 3 for H2 is an upper bound by construction (finding 8d):** 2a's H2 differences have no negative value (q = 1.00), so a resample can never contain one. Step 2 is the binding step.
4. **Replicates and turns.** r = N / 4. Turns = N × (1 + 3 × 4) = 13N. **No repair turns exist** (the templates set `maxRepairTurns` 0; no `gate` arm). The turn cap of 1.5 × 13N is an allowance for **resume redraws** of partial steps (finding 10, review item 15), not for repair turns. N is never lowered after a power figure is seen, and a contrast is never kept confirmatory below 0.80.
5. **H3 is not powered.** Its power at the chosen N is reported as it comes.

### P3: results (computed from P1 and P2)

**Step 1, the floor.** Blocks needed, 7 / (1 − p₀): H1 8.4, H2 14.0, H3 14.0.

**Step 2, `pilotPower` on the extended grid** (`results/v1.4-study2b-power/level-power-sim-grid/{power.json,tables.md}`; the registered 16-block run is in `level-power-sim/`). Lower bound of the pilot mean: n = 6, mean 1.50, SD 1.05, t₀.₈,₅ = 0.9195, so **1.11**. Power at RR 0.25, θ 1 / 4 / ∞:

| N (blocks) | r | H1 independent | H2 independent | H1 shared | H2 shared | Keep (independent, every θ ≥ 0.80) |
|---|---|---|---|---|---|---|
| 8 | 2 | 0.02 / 0.06 / 0.08 | 0.03 / 0.06 / 0.08 | 0.03 / 0.06 / 0.08 | 0.02 / 0.06 / 0.08 | no |
| 12 | 3 | 0.18 / 0.34 / 0.38 | 0.17 / 0.33 / 0.39 | 0.22 / 0.35 / 0.41 | 0.21 / 0.35 / 0.41 | no |
| 16 | 4 | 0.34 / 0.53 / 0.61 | 0.34 / 0.52 / 0.60 | 0.48 / 0.58 / 0.63 | 0.48 / 0.58 / 0.63 | no |
| 20 | 5 | 0.51 / 0.68 / 0.78 | 0.49 / 0.69 / 0.78 | 0.67 / 0.76 / 0.78 | 0.66 / 0.77 / 0.78 | no |
| 24 | 6 | 0.62 / 0.83 / 0.89 | 0.64 / 0.82 / 0.88 | 0.80 / 0.87 / 0.89 | 0.80 / 0.88 / 0.89 | no |
| 32 | 8 | 0.78 / 0.93 / 0.97 | 0.79 / 0.93 / 0.97 | 0.94 / 0.96 / 0.97 | 0.93 / 0.97 / 0.97 | no |
| **40** | **10** | **0.91 / 0.98 / 0.99** | **0.90 / 0.98 / 0.99** | 0.98 / 0.99 / 0.99 | 0.98 / 0.99 / 0.99 | **yes** |

**Step 3, resampling** (`results/v1.4-study2b-power/resampling/`; exact sign-flip p over all 2ᴺ patterns; H1 and H2 count only rejections with T > 0, H3 any rejection):

| Contrast | Size | N = 8 | 12 | 16 | 20 | 24 | 32 | 40 | Smallest N ≥ 0.80 |
|---|---|---|---|---|---|---|---|---|---|
| H1 | 2a size | 0.122 | 0.305 | 0.519 | 0.688 | 0.810 | 0.936 | 0.986 | 24 |
| H1 | half size | 0.026 | 0.197 | 0.309 | 0.446 | 0.569 | 0.746 | **0.879** | **40** |
| H2 | 2a size | 0.040 | 0.393 | 0.790 | 0.953 | 0.989 | 1.000 | 1.000 | 20 (upper bound) |
| H2 | half size | 0.015 | 0.209 | 0.554 | 0.805 | 0.943 | 0.993 | **1.000** | 20 (upper bound) |
| H3 | 2a size | 0.001 | 0.021 | 0.030 | 0.030 | 0.031 | 0.048 | 0.060 | — (not powered) |
| H3 | half size | 0.000 | 0.003 | 0.013 | 0.015 | 0.017 | 0.025 | 0.032 | — (not powered) |

**N = 40, r = 10; turns 13 × 40 = 520; redraw allowance cap 1.5 × 520 = 780 (DELEG7).** N is the smallest grid value at which step 2 (binding) and step 3 (half size) both reach 0.80 for H1 and H2. **The coordinator chose N under DELEG7** (delegated under GO-2B, dated 10:49Z on 2026-10-20, before this file is dated and before any 2b call). N was raised, not lowered. No test, α, Holm rule, power bar or θ band changed. The grid extension itself is deviation **DV7** (§8). H1 and H2 stay confirmatory; H3 is in the Holm family and not powered (0.060 at N = 40, 2a size).

### P4: equivalence margin Δ (filled from 2a Stage C)

Δ is set from 2a's estimand 6 margins, as the exploratory registration §11 assigns. It is stated in D units per block (mean paired difference). It must be ≤ half of the none@L2 lower-bound mean from step 2, so that "equivalent" cannot cover an effect as large as H1's minimum detectable effect.

**Δ = 0.55 D per block.**
- **The cap.** Step 2's lower bound is 1.11 (1.1063), so the cap is 0.553. Δ is that cap, rounded down to two decimals. 2a's estimand 6 produced no margin in D units, so the cap is the rule's only data-derived bound.
- **What Δ means in relative terms (finding 7).** 2a's treated-cell means are 0.50 (`mcp@L2`) and 0.67 (`none@L3`) D per block. A margin of 0.55 is about as large as either. So "within ±0.55" allows one treated cell to carry about twice the drift of the other and still read "equivalent". The report states E in these terms.
- **A secondary margin, Δ₂ = 0.28** (a quarter of the lower bound), reported descriptively next to E. No claim rests on it.
- **The "not established" rule.** E is reported as **not established**, whatever the interval shows, if the pooled treated-cell mean D (the mean of none@L3 and mcp@L2 D over the complete blocks) is below Δ. A margin as large as the signal cannot show equivalence.
- **Precision at N = 40.** With an SD near 1.3, the 90 % interval's half-width is about 1.645 × 1.3 / √40 ≈ 0.34.
- **Context only.** 2a's mean none@L3 − mcp@L2 difference is 0.17, SD 1.33, over 6 blocks.

## 4. Analysis plan

**Scoring.** Every 2b snapshot is scored **once, at the freeze tag** `v1.4-freeze-2026-10-20` (X = `4d28d280…`), by the runbook §6 path. The engine of record is the one gate D8 names: Neo4j 5.26.24 at the compose pin digest. If `cypher-interp` is used, as in 2a, its parity with Neo4j is shown on 2b snapshots first (D8). In-loop evaluator figures are telemetry only. Only findings that `check-correct.ts` labels `correct` are counted; a finding labelled otherwise is listed with its label and excluded from every count.

**The analysis script (finding 1, D9).** **The analysis script is `scripts/v1.4/study2b-analyse.ts` (helpers `scripts/v1.4/lib/study2b-analyse.ts`, test `tests/unit/scripts/v1.4/study2b-analyse.test.ts`), sha256 in P8. It was tested on 2a data with a planted effect on 2026-10-20.** It reads the Stage C `rescore/runs.json` (and `analysis.json`), the seeded-recall outputs, the D† output and the MCP telemetry, and emits every table of this section (`analysis.json`, `tables.md`).
- **2a reproduction.** Run on 2a Stage C with `--reproduce-2a`, it reproduces the 2a report §3 exactly: D per block, ΣD 9 / 4 / 3, means 1.50 [0.50, 2.00], 0.67 [0.00, 1.00] and 0.50 [0.00, 1.00] (task-clustered, seed 20261019), the ratios 0.44 [0.00, 2.00] and 0.33 [0.00, 1.00], and the mean paired differences −0.83 [−2.00, 0.50] and −1.00 [−2.00, 0.00] (`results/v1.4-study2b-prereg/analyse-2a/tables.md` §8).
- **Planted effect.** A 40-block set drawn from 2a's none@L2 blocks, with each treated identity kept with probability 0.25 (RR ≈ 0.25): H1 and H2 are rejected after Holm with the predicted sign (exact p 1.5 × 10⁻⁸ and 1.9 × 10⁻⁹), H3 is not, and E reads "not established" (pooled treated mean 0.34 < Δ). The null set (independent redraws, no effect) rejects nothing (`analyse-planted-effect/`, `analyse-planted-null/`).

**Pairing.** The unit of analysis is the block, b = task × replicate, which is one shared step-1 tree. For a contrast (c, c′), d_b = D_b(c) − D_b(c′). Only complete blocks enter a contrast: all three cells must have steps 2–5 scored (§5).

**The test.** For each of H1, H2 and H3:
- **Statistic and method.** T = Σ_b d_b, paired **two-sided** sign-flip test (drift record §2): 99,999 random sign assignments, seed `20261021`, p = (1 + #{|T*| ≥ |T|}) / (1 + 99,999).
- **Exact p at every N (finding 8c).** The exact p over all 2ᴺ sign patterns (`exactSignFlipP`, by convolution) is reported beside the Monte Carlo p, at any N. Holm is run on both. **If the two Holm decisions differ for any contrast, the exact-p decisions govern** (declared under DELEG10; it is stricter or equal, since the exact p is the quantity the Monte Carlo p estimates).
- **Zeros.** Blocks with d_b = 0 are kept. They do not change T.
- **Robustness (finding 8a).** T is driven by magnitude, and with zero-inflated integer differences one block with d = 3 can decide it. So an exact Wilcoxon signed-rank test (midranks) and an exact sign test are reported beside the primary. They are robustness lines: they change no decision, and a disagreement is reported next to the result.
- **Task strata.** The task is a fixed effect with 4 levels. Flipping signs within task strata is the same test, because flips are per block. **The task-level sign-flip over the 4 task sums is descriptive only (finding 8b):** its smallest two-sided p is 2/16 = 0.125, so it can never reject.

**Multiplicity (finding 8f).** Holm over {H1, H2, H3} at familywise α = 0.05. H3 stays in the family because the drift record's familywise guarantee covers every pairwise test among the three cells, and H3 is one. The cost is stated: with H3 at about 0.06 power it will usually hold the largest p, so H1 and H2 meet α′ = 0.0167 and 0.025 instead of 0.025 and 0.05. The power figures of §3 already use α′ = 0.0167, so the cost is priced in. E is an intersection-union test and takes no Holm adjustment.

**Equivalence E.** none@L3 and mcp@L2 are declared equivalent if the **90 %** within-task block-bootstrap interval of the mean paired difference (none@L3 − mcp@L2) lies inside (−Δ, +Δ), Δ = 0.55: the two one-sided tests at α = 0.05 each. The "not established" rule of P4 applies first. Δ₂ = 0.28 is reported beside it. If E holds and H3 is not rejected, the thesis may write "within ±Δ D per block of each other", with Δ's relative meaning (P4). If E fails, nothing is claimed about the two cells being equal.

**Effect sizes and intervals.**
- **RR.** RR = ΣD(c) / ΣD(none@L2) for H1 and H2, and ΣD(mcp@L2) / ΣD(none@L3) for H3. RR is undefined, and reported as such, when the denominator is 0.
- **Mean paired difference**, d̄.
- **Intervals.** Both get a 95 % percentile bootstrap, 10,000 resamples, seed `20261021`: (a) blocks resampled within task, and (b) a task-cluster bootstrap. **The task-cluster bootstrap has only 4 clusters, so it takes few distinct values and its bounds are coarse** (finding 8f). The within-task interval is the one quoted first.

**Full distributions.** 2a showed all-or-nothing behaviour, so means alone are not reported. The per-block table (task, replicate, Y₁, and D and Y₅ in each cell); the distribution of D per cell; P(D = 0) per cell with a Wilson interval; for each contrast, the 2 × 2 count of blocks by (D = 0 or not). They are reported whatever the tests show.

**Sensitivity (all registered, all reported, none changes a decision except the D† rule of §1).**
1. **D†** (§1): the same tests, Holm and estimates on D†. The §1 rule for "supported" reads it.
2. **Y₁ = 0 blocks dropped** (finding 8e): the tests and Holm on the blocks with Y₁ ≥ 1.
3. **Signed-rank and sign tests** (finding 8a), above.
4. **Run-index halves** (finding 4): D of `none@L2`, and d̄ of each contrast, in replicates 1–5 against 6–10. A sign reversal of d̄ between the halves is reported next to the primary.
5. **By lane** (finding 4): mean D of each treated cell by lane, from the run-order file (§2, lanes alternate).
6. **Unmapped-file flag** (§5): the tests on the blocks without a flagged snapshot.
7. **Time.** Per-turn timestamps and the pause durations between a block's cells are reported per cell (§2 covariates).

**Reading the result.**
- H1 or H2 supported: the §1 rule (Holm, sign, D and D† agree).
- Not rejected: "no difference detected at RR ≤ 0.25 MDE". Never "no effect": the design detects only an arm that cuts drift to about a quarter (drift record §4).

### V4 consequence (ADR-V14-04 §4, with the amendments below)

**r_f comes from fallback F-RF.** Hold-out attempts 1 and 2 both stopped at the structure check, and no hold-out figure exists (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`). So part A takes r_f from **hold-out prespec addendum 2, §2** (`Docs/v1.3/holdout-prespec-addendum-2-2026-10-20.md`, DELEG5; on main since PR #315; its `Docs/v1.3/sealed-hashes.md` row has sha256 `f901beea0667507abc4fc988b2451e0d93dfc394df9cb0f15b406a000c06b0d3`, equal to the file). r_f = tp / (tp + fn) per blocking rule family in `results/v1.3-reference/after-construct-answers/scores.json` at X (view `blind-primary`, style `layered`): FF-S01 2/3, FF-S02 2/2, FF-S03 3/3; a family with n = 0 gets the pooled 7/8. A development-set estimate, not validity evidence.

Layered is confirmatory in 2b only if the non-differential miss check passes for every contrast pair:
- **Part A: exposure-weighted miss rates within 0.05.** m_c = Σ_f s_c(f)(1 − r_f), with s_c(f) the share of cell c's counted identities in family f.
  - **A cell with ΣD_c = 0** has s_c(f) = 0 for every family. Part A then passes vacuously for its pairs, and that is noted.
  - **Part A is uninformative** when a single family carries ≥ 90 % of counted identities in every cell (finding 5). It is still reported, and part B carries the non-differential check. On 2a, FF-S03 carries 100 % in every cell, so m_c = 0 in all cells and part A is uninformative.
- **Part B: seeded recall on non-exempt sites.** Seeded recall per cell of the operators keyed to the blocking families that carry counted identities, **on non-exempt sites only** (sites outside the Q25 = B composition-root globs). The snapshot-clustered bootstrap interval of each pair's difference must cover 0 and |difference| ≤ 0.10; seed `20261021`, 10,000 resamples. **The exempt-site share per cell is reported beside it.** On 2a: MO-S03 detected 9/9, 11/11 and 10/10 non-exempt seeds (none@L2, none@L3, mcp@L2), with exempt-site shares 2/11, 1/12 and 2/12; every pair passes.

If part B fails or cannot be run, 2b is reported under the drift record's fallback, **labelled exploratory**: no Holm claims, RRs with intervals only. **V4 status: route registered (F-RF on main; parts A and B as amended).**

### Evasion: the seven s2d-01 §5 items (finding 9), with their bars

Computed post hoc on the kept snapshots, before any arm comparison is read (`Docs/v1.4/evasion-check.md`).

| # | Item | Bar, or what is reported | Tool |
|---|---|---|---|
| 1 | Acceptance pass rate (D12) | Pass rate of each treated cell within **10 points** of `none@L2` over paired blocks; both readings (one-sided gap ≤ 10, two-sided \|gap\| ≤ 10). Otherwise H2 (or H1) reads "fewer violations by doing less" | post-run acceptance (below); `study2b-analyse.ts --acceptance` |
| 2 | Size | LOC and file trajectories per cell (descriptive) | `snapshot-coverage.ts` |
| 3 | Coverage (D13) | Unmapped share per step (flag above 10 %); files outside the layout globs that import persistence; `import()`, `require()` and barrels per cell | `snapshot-coverage.ts`, evasion A3 |
| 4 | Literal view | Re-score every step-5 snapshot with the literal view; evasion is flagged if a treated cell's mean per-block gap (literal − default D) exceeds `none@L2`'s by **more than one identity** | the Stage C re-score at the literal view |
| 5 | Moved-only read | 10 `mcp@L2` and 10 `none@L2` diffs, blind. **Bar: 0 moved-only cases in `mcp@L2`**; both class sets reported (moved-only; moved-only or wrapped/inlined). **New class (finding 2): "renamed the entry file to an exempt name"**, from the ρ renames of `d-dagger.ts` | evasion A2 + the blind read |
| 6 | Mechanism | MCP tool use in **≥ 80 %** of `mcp@L2` steps, or the result is reported as "no mechanism" | `mcp-telemetry.ts`; `study2b-analyse.ts --telemetry` |
| 7 | Concentration | If D without the dominant family loses the effect, the claim is scoped to that family. **Pre-stated: if ≥ 90 % of counted identities are FF-S03 wiring, the claim is scoped to composition-root wiring (G12)**, as the 2a report §14 item 4 anticipated. Then D without FF-S03 is identically 0 and its RR undefined: that is the expected reading, not a failure | `study2b-analyse.ts --analysis` |

**The evasion bar of the composition-root channel (finding 2).** Per cell: (a) the share of presentation → persistence edges at step 5 that leave a Q25-exempt file, and (b) the share of runs with a ρ-mapped rename of a non-exempt file to an exempt name. **If either share differs by more than 0.20 between the cells of a contrast, that contrast is flagged**, and it is reported with D† as the primary reading. On 2a both shares are 0 in every cell.

**What the arms are told about the exemption (zero-call probe, finding 2 item 3).** `scripts/v1.4/cr-exemption-probe.ts` drove the frozen MCP build (`<shared>/daedalus-study2b/daedalus-build/4d28d280/`, launched as the harness launches it, `--confine`) and the in-process scorer on one synthetic Layered project, with a presentation → persistence import in each of 14 file names (`results/v1.4-study2b-prereg/cr-exemption-probe.json`).
- **`mcp@L2` is told it is a violation, in every file name.** `check_import` from `src/presentation/main.ts` and from `src/presentation/server.ts` both return `verdict: violation`, FF-S03, blocking: "presentation may not import persistence: closed layering allows only business>persistence, presentation>business". `check_file` on either file returns 1 FF-S03 blocking violation with the fix "Go through business: call a business service that wraps what you need from persistence, or move that type into business." The MCP FF-S03 check applies **no** composition-root exemption.
- **The scorer exempts 6 of the 14 names.** It counts 0 FF-S03 rows from `main.ts`, `container.ts`, `AppContainer.ts`, `app.container.ts`, `app.module.ts` and `composition-root/index.ts`, and 1 from each of the others (`server.ts`, `app.ts`, `index.ts`, `composition.ts`, `bootstrap.ts`, `di.ts`, `composition-root.ts`, `compositionRoot.ts`).
- **So the MCP arm is never told that `main.ts` is exempt**: its checks flag there what the scorer does not count. The `none` arms are told nothing about composition roots: L2 names the layers, and L3's sentence reads "It is a violation when a layer imports a layer that is not directly below it, such as presentation code importing persistence code", with no exemption.
- **Name-pattern disagreements.** Between the scorer's Q25 globs and the MCP fast-hint exemption (`APG2_COMPOSITION_ROOT_NAME_PATTERNS`, used only by the advisory fast hints, not by the FF-S03 check): `bootstrap.ts`, `di.ts`, `composition-root.ts` and `compositionRoot.ts` are hint-exempt but counted by the scorer; `AppContainer.ts` (`*Container.ts`) and files under `composition-root/` are scorer-exempt but not hint-exempt. Between the scorer and the MCP FF-S03 check, every one of the 6 scorer-exempt names disagrees (MCP flags, scorer exempts).

### Post-run acceptance (D12; DELEG6 as refined by DELEG8)

Zero model calls, after the run, on every stored step snapshot (step 1 to 5 of every run). **Never a filter on D, and never an exclusion.**
1. **Build.** Copy the snapshot to a scratch directory outside every out-root and type-check it with the harness's `tsc` and the harness tsconfig (the step's own type-check command). A failure is recorded `build-failed` and counts as failing.
2. **Entry (DELEG8).** The first that exists of: the `package.json` `main` field, if it names an existing file under `src/`; then DELEG6's list, `src/main.ts`, `src/server.ts`, `src/index.ts`, `src/app.ts`, `main.ts`, `server.ts`, `index.ts`; then `src/presentation/server.ts`, `src/presentation/main.ts`, `src/presentation/app.ts`, `src/presentation/index.ts`. *Why refined:* every Layered task requires the source under `src/persistence`, `src/business` and `src/presentation`, and DELEG6's list names no `src/presentation/` path, so as stated it would record almost every snapshot `not-started`. The added names are the review's suggestion, fixed before any 2b output.
3. **Start.** `npx tsx <entry>` with `PORT` set by the runner to a free port. Readiness: poll the base URL every 250 ms, up to 20 s. A snapshot with no entry, or that never answers, is recorded `not-started` and counts as failing.
4. **Tests.** The sealed step files `<acceptance root>/<task>/step-01..step-j.test.mjs` for step j, each in its own `node --test` process with `BASE_URL`, timeout 60 s per file (the runner's default at X).
5. **Outcome.** Pass rate per cell (a step passes iff every test file passes). It is evasion item 1's input (bar above) and the D12 feature-dropping reading.

In-loop acceptance stays enabled in the plans, and its `no-start-command` records are expected and not failures.

### No stopping-rule change; usage limits and resume (finding 10)

- There is no interim analysis and no look at any 2b outcome before every block is scored. There is no early stop for efficacy or futility. N is fixed by §3.
- **A usage-limit pause resumes and is not a stop** (S1). The pause duration, and the time between a block's cells, are recorded and reported per cell.
- **A redraw is logged and counted.** A resume that discards a partial step redraws it (`restarts.jsonl`, reason `redraw`). That is a second model sample for that step. It is logged, counted and reported per cell. It is not a second run of a sealed task: the run itself is not repeated, and no finished step is redrawn.
- **The live check (D14).** **Done, green (2026-10-20, practice task, 2 calls).** The rehearsal's ice-rink practice task, cut to step 1, ran under the pinned binary (sha256 checked) as `none@L2` replicate 5 (run index 4). Call 1 started at 11:31:04Z; at 11:31:56Z, with 3 source files already in the agent's cwd, the harness process group was killed (`SIGKILL`, exit 137; no CLI process left). Re-running the same command at 11:31:59Z resumed the run: `restarts.jsonl` holds one line, reason `redraw`, `resumeAtStep` 1, `discardedChanges` 6, the partial attempt set aside under `discarded/restart-1`; call 2 redrew step 1, which was committed and scored, and the console summary counts `redraws: 1`. Exit 0 at 11:33:29Z. The served model string in the redrawn turn's envelope is `claude-sonnet-5-5` (`modelUsage` key and `canonicalModel`). Record: `results/v1.4-study2b-prereg/d14-kill-resume.md`.
- The only stops are the GO-2B never-waived failures (§5). A stop means no partial result is reported as confirmatory.

## 5. Exclusions and deviations

**Never excluded (ITT).**
- Agent behaviour never removes a snapshot or a block. A failed type-check, an incomplete step, deleted files, a refusal or an off-task step are all scored as they stand.
- Unmapped files above 10 % flag the snapshot. The primary analysis keeps it; a sensitivity analysis drops flagged blocks (§4).

**Harness failures only.** A failure is a harness failure if the turn never reached the agent, or the instrument failed: a CLI crash before the first tool call, a usage limit that S1 cannot resume, an `evaluationError`, a lost snapshot.
- The turn is resumed from the same committed state (the harness resume). A partial step is redrawn, logged and counted (§4).
- If it fails again, the block is **incomplete**. It is reported in full and left out of every paired test, in all cells.
- Incomplete blocks are not replaced, because a replacement would be a second draw chosen after the fact.
- If more than 1 block in 4 is incomplete, the run is reported under the exploratory label.

**Not counted (filtering, not exclusion).**
- Findings not labelled `correct` by `check-correct.ts`.
- Non-blocking tiers.
- Findings in test files, for the evasion moved-only read (drift record §6).

**Stops (GO-2B, never waived).** The run stops, and the author is told, if any of these happens:
- a frozen input changes;
- a sealed hash mismatches, or an agent reads a sealed file outside its run;
- S4 fails for an arm that runs;
- the pre-registration is not dated before the first call;
- a sealed task is run twice;
- the CLI binary's version or sha256 differs from the pin (DELEG6).

**Deviations after dating.** Any change after dating is a numbered, dated deviation that states what had been seen. A change to the primary outcome, a test, the Holm family, N, an exclusion rule or Δ **after any 2b output is seen** is reported as a deviation and makes the affected claim exploratory.

## 6. Readiness gate: the 42 lines

- **Two status columns.** The first is the dashboard's (`Docs/v1.3/study2-readiness-dashboard.md` §3, taken **2026-10-16**), copied as it stands. The second gives the later evidence on file. Neither column is a gate verdict. Every line is re-verified at the run commit (gate rule 3), with its evidence in `results/v1.3-study2-gate/`.
- **The NW column.** NW marks the lines that GO-2B says can never be waived.
- **Any other red line** is made green where realistic. If it can't be, it is registered as a dated deviation before the run (§8), with what is lost.

| Line | Dashboard 2026-10-16 | On file since | NW |
|---|---|---|---|
| V1 construct answers, ADR-V13-03 | RED | ADR-V13-03 accepted under delegation; freeze F1–F14 OK (freeze record §1–2) | **NW** (frozen inputs) |
| V2 tiers and sources at sealed hashes | GREEN | — | **NW** (frozen inputs) |
| V3 hold-out run once at X | RED | **Not scored.** Attempts 1 and 2 stopped at the structure check; no figure seen, "run once" unspent (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`) | — |
| V4 V4 bar per style | RED | ADR-V14-04 accepted (option 1). **Route registered:** F-RF (addendum 2 §2, on main with its hash row); parts A and B as amended in §4 | — |
| V5 independent rater | RED | Timing deviation: labels after the study (drift record §7) | — |
| V6 one κ definition | RED | Pointers added (DELEG2); needed before the first label, not the run | — |
| V7 judge [W] | RED | Waived: the judge is dropped (drift record §7) | — |
| V8 per-snapshot coverage | RED | Kept for generated code; computed on 2b snapshots | — |
| V9 MCP tools agree with full evaluation | RED | Not re-taken. The probe of §4 shows one known disagreement: the MCP FF-S03 check flags composition-root files the scorer exempts | — |
| V10 (a) non-Claude, (b) [W], (c) writer split | RED | (a) **deviation**: Gemini deferred (§2); (c) met by the seal record | — |
| V11 no leakage | AMBER | Not re-taken | — |
| S1 usage limits | RED | Pause resumes, not a stop (§4); redraws counted. A live kill-and-resume passed (D14); no live usage-limit pause has been injected | — |
| S2 CLI pinned | RED | DELEG6: private 2.1.304 binary, sha256 checked, stop on mismatch; P5 | — |
| S3 isolation | RED | Per-run HOME isolation **off** as in 2a (keychain finding), DELEG3 flags on | — |
| S4 confinement per CLI × arm | RED | Claude `none` and `daedalus-mcp` PASS (Run 2, 2026-10-20) | **NW** |
| S5 no-layout-hint arm | RED | Met: L1 declared not run | — |
| S6 advisory per rule | AMBER | Secondary only (drift record §7) | — |
| S7 0 evaluation errors | RED | 2a Layered steps all scored; DDD not in 2b | — |
| S8 every model live | RED | Sonnet live in 2a (78 turns) and the D14 check | — |
| S9 one harness root per lane | AMBER | Two lanes plus the `none@L2` phase, one harness root each (§2, DV8) | — |
| S10 `--check-prereg` in CI for the Study 2 base | RED | CI checks only `v1.2e` PRs; tunables verify now in CI | — |
| S11 tunables hashed | RED | `Docs/v1.3/study2-tunables.json`, 197 entries, verify exit 0 (freeze record §2) | **NW** (frozen inputs) |
| S12 out-roots archived, path-free | RED | Not re-taken | — |
| S13 the author's dated words | RED | Go is delegated except the author's go (GO-2B); gate rule 4 says an AI cannot declare it | **NW** (pre-reg dated) |
| S14 retired list intact, unread | AMBER | Restated; hash checked by the domain examiner (seal record) | **NW** (sealed unread) |
| S15 no model labeller | AMBER | Met | — |
| D1 pilot | RED | **Deviation**: 2a stands in for the pilot (§8, DV3) | — |
| D2 no banned term; frames identical | AMBER | Sealed hint audit 0 FAIL (seal record) | — |
| D3 power ≥ 0.80 | RED | **GREEN at N = 40** (DELEG7, DV7): step 2 independent 0.90–0.99 for H1 and H2, step 3 half size H1 0.879, H2 1.000 (§3) | — |
| D4 cost and budget | AMBER | 520 turns, redraw cap 780 (§3); 2a cost on file | — |
| D5 MCP latency live | AMBER | 2a `mcp@L2` live; not measured against the bar | — |
| D6 telemetry checker; call log outside cwd | RED | 2a call logs exist outside the cwd; checker not re-taken | — |
| D7 pins, byte-identical re-score | RED | Freeze cross-check byte-identical | **NW** (frozen inputs) |
| D8 engine of record | AMBER | §4 scoring | — |
| D9 one analysis script, planted effect | AMBER | **Met**: `study2b-analyse.ts`, 2a §3 reproduced, planted effect recovered, null not rejected (§4); sha256 in P8 | — |
| D10 pre-registration | RED | **This file**; red until dated | **NW** |
| D11 arm set | RED | Restated: 3 cells, shared start | — |
| D12 acceptance checks, no waiver | RED | Post-run procedure fixed (DELEG6, DELEG8; §4); the post-run runner is written and checked on the rehearsal snapshots before the first 2b snapshot is scored | — |
| D13 coverage and import-kind counts | RED | Not re-taken | — |
| D14 live kill-and-resume | AMBER | **GREEN**: live kill-and-resume on a practice task, 2 calls, redraw logged and counted (§4) | — |
| D15 DDD spec mode | RED | N/A for 2b (Layered only) | — |
| D16 held-out rules | RED | Deviation: secondary, after the run | — |
| Run once | — | Sealed tasks never run for practice | **NW** |

## 7. Limitations, stated before the run

1. **One firing rule.** Every blocking finding in 2a was FF-S03 (layer skip). D in 2b may be a measure of one rule's propagation. Per-rule exposure (§1) shows which rules had opportunities; a rule never exercised supports no claim. The concentration item (§4) scopes the claim.
2. **One style.** Layered only. Clean and Hexagonal sit at the floor (reported as a finding), and DDD is deferred. No claim reaches another style.
3. **One generator.** Claude Sonnet only, in the same vendor family as the instrument's authoring sessions. The cross-vendor claim is deferred to the Gemini extension.
4. **Small n.** 4 tasks and 40 blocks. Tasks are fixed effects, and the claim covers these 4 tasks. The MDE is RR ≤ 0.25. With many zero differences, the effective n is the count of non-zero blocks.
5. **The legitimate claims (finding 5).** Layered is confirmatory **for the between-arm contrast**, conditional on V4 part B. There is **no instrument-accuracy claim**. Absolute D is an under-count of unknown size. The instrument's recall for Layered is **"characterised on the development set, not validated on a hold-out"** (F-RF), and r_f from the development set is likely optimistic.
6. **H2 is "delivery plus checking"**, not checking alone.
7. **2a informed the design.** The design was set after 2a was seen on other tasks. The confirmatory tasks were sealed before 2a Stage A, so 2a could not tune them.
8. **Construct limit.** Layered counts imports from wiring code (D2b). FF-P01 is not compiled for Layered (Q10 = D, §1).
9. **D depends on the agent's entry-file name** (2a report §5 and §8).
   - **The rule.** Under Q25 = B (frozen at X), a composition root named `main.ts` (also `*.module.ts`, `*Container.ts`, `*container.ts` or under `composition-root/`; `CONSTRUCT_COMPOSITION_ROOT_GLOBS`) is exempt from the layer rules.
   - **What 2a showed.** Every counted 2a identity was FF-S03 wiring from a presentation composition root named `server.ts`, `app.ts` or `composition.ts`, and so it counted. The 5 MO-S03 seeds that went undetected were all planted in an exempt `src/presentation/main.ts`.
   - **What follows for D.** A cell that moves its wiring into `main.ts`, or renames its entry file to it, lowers D without changing the dependency structure.
   - **How 2b handles it.** D† (no exemption) as a registered sensitivity primary that gates "supported" (§1); the evasion bar on the exempt share and on renames (§4); the rename class in the moved-only read (§4); part B on non-exempt sites (§4). The MCP arm's checks flag the import in `main.ts` too (§4 probe), so the tool does not point to the exemption. The rule itself is not changed: Q25 = B is a frozen input.

## 8. Deviations of the drift record (filed as one dated deviation before dating)

| # | Drift record says | 2b does | Stricter or weaker | What is lost |
|---|---|---|---|---|
| DV1 | Generators: Claude Sonnet and Gemini, one lane each; 32 blocks | Claude only; Gemini a dated extension arm at N = 40 | weaker | The cross-vendor claim, the generator sign-agreement falsifier and V10(a), all deferred |
| DV2 | Order: hold-out before the pilot | Hold-out attempted twice, no figure (V3) | weaker | V4 rests on F-RF (development-set r_f) and part B |
| DV3 | Pilot: 2 tasks × 3 replicates per generator, pilot bar | 2a (3 tasks × 2 replicates, Claude) stands in for the pilot bar and the power input (exploratory registration amendment 1 item 7; §14) | weaker (smaller input, other tasks) | The pilot bar's per-generator lines |
| DV4 | Holm over 2 (H1, H2) | Holm over 3 (adds H3, two-sided) | stricter | α′ for H1 and H2 (§4, Multiplicity) |
| DV5 | Blocks = 4 × 4 × 2 | 4 × 10 × 1 (DELEG7) | stricter (N 32 → 40) | — |
| DV6 | Effect interval: block bootstrap | Within-task block bootstrap, plus a task-cluster interval | equal | — |
| **DV7** | The registered power script's grid: 4 tasks × 4 replicates × generators | **The grid is extended to 4 × r × 1, r ∈ {2, 3, 4, 5, 6, 8, 10}** (`study2b-pilot-power.ts` calls the same `pilotPower`; `STUDY2B_GRID` extended to 32 and 40). N fixed before any 2b call (DELEG7) | stricter (N raised) | — |
| **DV8** | One lane per generator | Two concurrent lanes for the one generator, cells alternating between lanes by replicate; per-replicate order (§2, DELEG9) | stricter (the cells of a block run close in time; lane crossed with cell) | — |
| **DV9** | The exact sign-flip p: not named | Exact p reported at every N; it governs when the MC and exact Holm decisions differ (DELEG10) | stricter or equal | — |
| **DV10** | D is the only confirmatory reading | "Supported" also needs D† to agree (§1, DELEG10) | stricter | — |

## 9. Procedure to registration

1. **Fill the numbers.** Done: P1–P4 and P11 (§3).
2. **File the deviation.** DV1–DV10 go into one dated deviation of the drift record. The `study2-protocol` block changes only if a block value changes; none does.
3. **Review.** The Fable adversarial review (`ops/review/2026-10-20/fable-2b-prereg-review.md`, GO-WITH-FIXES, 18 findings) is answered in this file (see the changelog), and a Fable re-check of the answers (`ops/review/2026-10-20/fable-2b-prereg-recheck.md`) must return GO.
4. **Dress rehearsal and D9.** The dress rehearsal ran on practice tasks only. D9 is met (§4).
5. **Date and deposit.** Fill the date, the OSF id and the embargo. The deposited text is this file's sha256 at the go commit (P8).
6. **Gate and go.** The gate is re-verified at the run commit. Then the author's go (GO-2B), and 2b runs once.

## 10. Placeholders

| Id | What | Status | Who fills it, and when |
|---|---|---|---|
| P1 | Per-cell mean, SD, θ, P(D = 0), Y₁ | **filled** (§3) | — |
| P2 | Paired-difference p₀, q, mean and SD per contrast | **filled** (§3) | — |
| P3 | Power results, N, r, turns, turn cap; which contrasts stay confirmatory | **filled** (§3): **N = 40, r = 10, 520 turns, redraw cap 780; H1 and H2 confirmatory** (DELEG7, DV7) | — |
| P4 | Equivalence margin Δ | **filled** (§3): Δ = 0.55, with its relative meaning, Δ₂ = 0.28 and the "not established" rule | — |
| P5 | Dated confirmatory pin record | **filled**: Claude Code CLI 2.1.304, private binary sha256 `b9ac5374…78e6a` (DELEG6); `argv.ts` at X sha256 `0ed7c13b…0de`. **The CLI's JSON result exposes no dated model id**: in the 90 2a turn envelopes with a `modelUsage` block, the only key is `claude-sonnet-5-5`, and `canonicalModel` is the same alias. So the alias is the pin, and the per-turn model string and timestamps are recorded as covariates (§2) | — |
| P6 | The V4 route | **filled**: F-RF (addendum 2 §2, on main, hash row present) with parts A and B as amended (§4) | — |
| P7 | The run order and its seed | **filled**: per-replicate order with alternating lanes (§2, DELEG9); `orderSeed` 20261019 for the task order within a plan | — |
| P8 | Registration date, OSF id, embargo, go commit, run commit, this file's sha256; the analysis script's sha256 | Analysis (frozen at this commit, D9): `scripts/v1.4/study2b-analyse.ts` sha256 `53447bd9da41481832f8f79bfcdb2b4212473f83da80af79898299f1fdbb8eeb`; `scripts/v1.4/lib/study2b-analyse.ts` `1cd57eafda5040c75eda680b0c4e4b1fd4b86dc95df10c485f5c89346ed1a1a4`; `scripts/v1.4/lib/study2b-power.ts` (its `exactSignFlipP`) `64838be18bff14f3f792f81ae1a904b55d15bf172ea2398c8479741534d88a52`; D†: `scripts/v1.4/d-dagger.ts` `417e20362cf02b62ec48c5712c9ccad849634f40678129e59eb8630a7ba8e65e`, `scripts/v1.4/lib/d-dagger.ts` `ea4b9dfe651ce2b3516da62c6401ca117ba5495d635efd0a1243b4d4012b5c2c`. Date, file sha256: at registration. OSF id, embargo, run commit: open | the coordinator, at registration (§9 step 5) |
| P9 | Gemini extension: model id, agy pin, S4 result, date | open | the coordinator, before the extension's first call (after about 2026-10-25) |
| P10 | Fable review reference and responses | **filled**: the review and its 18 responses (changelog); the re-check (§9 step 3) | — |
| P11 | The P3 reading | **closed by DELEG7** | — |

Seeds fixed now: sign-flip and bootstrap `20261021`; the power script `20261018`; the resampling power `20261021`; `orderSeed` `20261019`. No cell-order seed exists: the cells of a block run in the fixed order of §2.

## Changelog
- 2026-10-20: **Fable review answered** (`ops/review/2026-10-20/fable-2b-prereg-review.md`, GO-WITH-FIXES). Each finding and its response:
  1. *No analysis script.* `scripts/v1.4/study2b-analyse.ts` written and tested; reproduces the 2a report §3; planted effect recovered; sha256 in P8 (§4).
  2. *Composition-root exemption.* D† added as a registered sensitivity primary that gates "supported" (§1, DV10); evasion bar at 0.20 on the exempt share and on renames to exempt names (§4); zero-call probe of the frozen MCP build recorded, with the name-pattern disagreements (§4); rename class in the moved-only read (§4).
  3. *DELEG7 not reproducible.* `STUDY2B_GRID` extended to 32 and 40; `study2b-pilot-power.ts` committed; both steps' tables at every grid value, both correlation models for step 2 (§3); DV7 added; P3 and D3 fixed; the coordinator's choice under DELEG7 stated.
  4. *Run order.* Per-replicate order with alternating lanes, checked on the frozen harness by a zero-call dry run (§2, DELEG9, DV8); covariates and the time and lane sensitivities registered (§2, §4); P7 filled.
  5. *V4 route.* F-RF cited from main with its hash row; part A's uninformative rule and s_c = 0; part B on non-exempt sites with the exempt share beside it; the legitimate claims in §7 item 5.
  6. *D12 start rule.* DELEG6 cited; the post-run procedure registered in full, with the entry rule refined as DELEG8 (§4); in-loop acceptance stays on, `no-start-command` expected.
  7. *Δ.* Relative meaning, Δ₂ = 0.28, the "not established" rule, half-width at N = 40 (P4).
  8. *Statistics gaps.* (a) signed-rank and sign tests; (b) the task-level test is descriptive; (c) exact p at every N, exact governs on disagreement (DV9); (d) step 3 for H2 an upper bound, step 2 binding, shared model reported; (e) Y₁ = 0 reworded, share and sensitivity; (f) H3's reason and cost, the 4-cluster bootstrap (§3, §4).
  9. *Evasion.* The seven items with their bars and the FF-S03 concentration scoping sentence (§4).
  10. *Usage limits and resume.* Pause resumes, redraws logged and counted (§4, §5); the live D14 check (§4).
  11. *Model pin.* The CLI exposes no dated id; alias plus per-turn covariates; `argv.ts` sha256 at X (P5).
  12. *Q10 = D.* Paragraph in §1.
  13. *Environment.* `--no-session-persistence` listed; the `--safe-mode` bridge stated (§2).
  14. *P7 and seeds.* `orderSeed` 20261019 named; no cell-order seed (§10).
  15. *Repair turns.* None exist; the cap is a redraw allowance (§3).
  16. *Disclosure.* The 34 hold-out paths line (header).
  17. *Gemini.* Addendum dated before its first call, N = 40 (§2).
  18. *Changelog and P10.* This entry; the file's sha256 at the go commit goes in P8.
- 2026-10-20: **DELEG7.** P11 closed: N = 40 (r = 10, 520 turns, cap 780), where both power steps pass for H1 and H2.
- 2026-10-20: P1–P4 filled from 2a Stage C at the freeze tag (zero model calls). Step 2 through the registered script; step 3 through `scripts/v1.4/study2b-power.ts`. The main.ts / Q25 = B finding added as limitation 9.
- 2026-10-20: first draft (DRAFT, not registered). Zero model calls.
