# Study 2 analysis rehearsal (synthetic data)

> **NOT A PRE-REGISTRATION, AND NOT DATA.** Written on 2026-10-16 to meet readiness-gate line D9 ("analysis script
> run end to end on rehearsal data", `origin/v1.3-study2-readiness:Docs/v1.3/study2-readiness-gate.md`). Study 2 must run
> exactly once, so its analysis is proven here, before any real data exist. Every number below comes from
> **synthetic** telemetry, made by a seeded generator. Nothing here is binding, hashed or listed in `corpus/prereg.json`,
> and no prereg tooling was touched. No sealed task is named, paraphrased or used. The task ids are `synth-task-N`, the
> model ids are `synth-model-*`, and every run says `dryRun: true`.

Inputs: `Docs/v1.3/study2-outline.md` (design, §5 candidate analysis), `Docs/v1.3/pilot-outcome-memo.md` (§3 primary
outcome, §5 switch rule), `Docs/v1.3/study2-power-notes.md` and `scripts/v1.3/lib/study2-power.ts` (power model),
`scripts/lib/loop/` (harness and its step-record schema), the hold-out runner and scorer of PR #119, and the readiness
gate on `v1.3-study2-readiness`.

## 0. Reproduce

```
npx tsx scripts/v1.3/study2-rehearsal.ts --data-root <scratch dir> --out results/v1.3-study2-rehearsal \
  --seed 20261016 --calibration-sims 200 --power-sims 400          # about 1 minute; exit 0 = every check passes
npx jest tests/unit/scripts/v1.3/study2-analysis.test.ts --maxWorkers=2   # 14 tests
```

One scenario by hand:

```
npx tsx scripts/v1.3/study2-synth.ts --scenario expected --out <dir>        # <dir>/study2, <dir>/pilot, <dir>/truth.json
npx tsx scripts/v1.3/study2-analyse.ts --out-root <dir>/study2 --pilot-out-root <dir>/pilot --out <tables dir>
```

The synthetic out-roots are large (162 runs and 810 step records per scenario) and are not committed. The seed
regenerates them byte for byte. The committed outputs are in `results/v1.3-study2-rehearsal/`: one folder per scenario
(`report.md`, `report.json`, `checks.json`, the figures `F1-trajectory.svg` and `F2-forest-*.svg`), plus `summary.md`
and `summary.json`.

## 1. What was built

| File | Role |
|---|---|
| `scripts/v1.3/lib/study2-synth.ts` | Synthetic generator. It uses the power simulation's data model, variates and default assumptions, and emits the harness's own `RunRecord` / `StepRecord` types. |
| `scripts/v1.3/lib/study2-io.ts` | Writes an out-root, and reads one back through the harness's `readStepRecords` and `runDirFor` (`scripts/lib/loop/loop.ts`). |
| `scripts/v1.3/lib/study2-analysis.ts` | The analysis: step rows, per-run metrics, contrasts, the switch rule, and the descriptive tables. |
| `scripts/v1.3/lib/study2-report.ts` | Markdown tables T0–T11 and the SVG figures F1, F2. |
| `scripts/v1.3/lib/study2-rehearsal.ts` | Checks against the generating truth, and the many-seed calibration. |
| `scripts/v1.3/study2-{synth,analyse,rehearsal}.ts` | CLIs. `study2-analyse.ts` is the D9 script; it reads only an out-root and (optionally) a pilot out-root and a label file. |
| `tests/unit/scripts/v1.3/study2-analysis.test.ts` | Format conformance, building blocks, and the four scenarios. |

**The format is the harness's format.** Three things show it:

1. The generator is typed by `scripts/lib/loop/types.ts`.
2. A test runs the real harness (`runLoop` with the dry-run stubs, all three arms). It checks that the synthetic step
   records have exactly the same key paths and value types as the harness's records, and that `run.json` and
   `schedule.json` do too. The only path the dry run cannot show is a non-empty `typecheck.codes[]`.
3. The analysis never sees the in-memory records. It reads the files back through the harness's own reader.

The generator does **not** add `advisoryByRule`, because the v1.3 harness does not write it. A separately labelled
variant, `floor-advisory-by-rule`, adds it (the field PR #142 proposes) only to exercise the fallback as the memo defines
it.

**Planned tables.** These are the tables the outline (§4, §5) and gate D9 name. Each is produced from raw telemetry:

| Table | Content |
|---|---|
| T0 | The design as found. |
| T1 | The pilot switch rule (memo §3, §5), per pilot task, with the fallback verdict. |
| T2 | Primary outcome: confirmatory contrasts `gate − none` and `daedalus-mcp − none`. Columns: mean slopes, mean difference, two-stage cluster-bootstrap 95% CI, d_z, relative reduction with CI, sign-flip p, Holm p, decision. |
| T3 | Task-level effects (forest plot F2) and the task-level sign-flip test with its smallest attainable p. |
| T4 | `gate − daedalus-mcp` (secondary). |
| T5 | Per model. |
| T6 | Secondary outcomes and guards: blocking per KLOC; advisory per KLOC with and without FF-CV05; AHS and blocking-AHS level at k, slope and AUC; LOC and files at k; type-check errors. |
| T7 | Gate repair success. |
| T8 | Cost and time, with repair turns kept apart. |
| T9 | Guards. |
| T10 | Missingness per model × arm. |
| T11 | Trajectories (figure F1). |

A last section lists what the step records cannot give (§6).

## 2. Scenarios

**Design.** The planned N is the outline's working grid (option B of the power notes): 6 tasks × 3 models × 3
replicates × 3 arms, k = 5. That is 54 blocks and 162 runs. Each scenario also gets a synthetic pilot as the memo
defines it: 3 tasks × `none`/`gate` × 1 replicate, k = 4.

**Data model.** The generator uses the power simulation's model and `DEFAULT_ASSUMPTIONS`:

- negative-binomial counts with θ = 2;
- task, model and run heterogeneity;
- an arm × task interaction with SD 0.15;
- the arm effect is a relative reduction of the erosion slope;
- the advisory rules get 0.5 × the effect;
- FF-CV05 ≈ 0.9 per source file, so it swamps the advisory total as it did in E1.

**Realism.** The `gate` repair turn is generated around the final count. About 1 % of evaluations fail and about 3 % of
turns time out, to exercise the missing-outcome paths. Codex cost is null, as the Codex envelope gives none.

| Scenario | Planted reduction of the erosion slope (gate / mcp) | Blocking counts |
|---|---|---|
| `null` | 0 / 0 | As modelled |
| `small` | 0.2 / 0.1 | As modelled |
| `expected` | 0.5 / 0.25 (outline §6: "feedback that halves the slope") | As modelled |
| `floor` | 0.5 / 0.25, reaching the advisory rules at 0.5× | **All zero**, every arm and step, pilot included |

The generating truth goes to `truth.json`, outside both out-roots. It holds, per block and arm, the expected OLS slope
given the latent terms, which is exact because the expected count is linear in the step. It also holds the planted
reductions.

## 3. Results (seed 20261016)

### 3.1 Assertions: 30 of 30 pass

Full table: `results/v1.3-study2-rehearsal/summary.md`.

| Scenario | What the assertion requires | Result |
|---|---|---|
| null | No confirmatory contrast rejected under Holm, and both CIs contain 0. | gate − none: +0.105 [−0.300, 0.534], Holm p 1.00. mcp − none: −0.039 [−0.426, 0.341], Holm p 1.00. **Null reported.** |
| small | The CI covers the generating difference, the estimate has the planted sign, and the relative-reduction CI covers the planted reduction. | gate: truth −0.090, estimate −0.094 [−0.593, 0.361]. mcp: truth −0.214, estimate −0.101 [−0.689, 0.374]. **Recovered, but not significant** (power ≈ 0.1, §3.2). |
| expected | Same as small. | gate: truth −0.510, estimate −0.705 [−1.942, 0.061], relative reduction 0.60 [−0.12, 0.79] against the planted 0.50, sign-flip p 0.004, Holm p 0.007, **rejected**. mcp: truth −0.287, estimate −0.632, relative reduction 0.54 against the planted 0.25, Holm p 0.0495, **rejected** (see A12: this decision depends on the Monte Carlo seed). |
| floor | The pilot's §3 outcome is zero, the pre-committed fallback triggers, and the report says so. | T1: "the primary outcome is ZERO … the PRE-COMMITTED FALLBACK applies". **Triggered and stated.** |
| floor (v1.3 format) | The report must also say that the fallback, as defined, cannot be computed. | "NOT computable from these step records … uses ALL advisory rules, FF-CV05 included, as a labelled surrogate". The primary metric is `advisoryTotalPerKlocSlope`, flagged *definition met: NO*. |
| floor-advisory-by-rule | The fallback is computed as defined (FF-CV05 excluded), and the CIs cover the truth. | Yes. gate: truth −0.100, estimate +0.173 [−0.547, 0.851]. Null, as the power predicts. |

### 3.2 Power at the planned N (power simulation, design B, 400 studies, block-level sign-flip, Holm, α = 0.05)

| Scenario | Outcome | Power gate | Power mcp | Either |
|---|---|---|---|---|
| null (type I) | blocking slope | 0.04 | 0.04 | 0.07 |
| small | blocking slope | 0.09 | 0.04 | 0.11 |
| **expected** | blocking slope | **0.54** | **0.17** | 0.55 |
| floor | advisory per KLOC (fallback) | 0.05 | 0.02 | 0.06 |

Monte Carlo SE ≤ 0.025. These figures agree with `study2-power-notes.md` §4 (option B: 0.54 / 0.18).

### 3.3 Calibration of the whole pipeline (200 synthetic studies per scenario: generator → files format → analysis)

| Scenario | Holm reject gate | Holm reject mcp | CI covers truth (gate / mcp) | Rel.-reduction CI covers planted (gate) | Mean estimate / mean truth (gate) | Sign-flip and bootstrap disagree |
|---|---|---|---|---|---|---|
| null | 0.04 | 0.02 | 0.98 / 0.97 | 0.97 | 0.011 / −0.002 | 0.04 |
| small | 0.14 | 0.07 | 0.99 / 0.98 | 0.97 | −0.282 / −0.263 | 0.07 |
| expected | 0.60 | 0.20 | 0.99 / 0.98 | 0.99 | −0.668 / −0.659 | 0.13 |
| floor (v1.3 format) | 0.03 | 0.03 | 0.99 / 0.97 | 0.99 | −0.389 / −0.336 | 0.04 |

The calibration used 999 resamples and 1999 flips per study. Readings:

- The estimator is unbiased.
- The test holds its size (0.04).
- The pipeline's rejection rate matches the power simulation (0.60 against 0.54, and 0.20 against 0.17, within Monte
  Carlo error).
- The two-stage bootstrap **over-covers** (0.97–0.99 for a nominal 0.95).

## 4. What the rehearsal shows, besides the ambiguities

1. **At the planned N, Study 2 is underpowered for the expected effect.** The `gate` contrast reaches 0.54–0.60 and
   `daedalus-mcp` 0.17–0.20, against gate D3's 0.80. A small effect is invisible (≈ 0.1). This repeats the power
   notes; the end-to-end pipeline confirms it rather than the simulator's own analysis.
2. **The memo §5 fallback cannot be computed from v1.3 telemetry.** `StepEvaluation` has `advisoryViolationCount`
   only. FF-CV05 cannot be removed, and in the synthetic data FF-CV05 is about 80 % of the advisory total (≈ 33 per
   KLOC against ≈ 6). Unless `advisoryByRule` (PR #142, gate S6) lands before the first Study 2 call, a floor result
   leaves Study 2 with no computable pre-committed primary outcome. A re-score from the kept snapshot commits would be
   a post-hoc pipeline.
3. **The fallback outcome has no power** (≈ 0.05 under the default assumptions). The power notes said so (§4); the
   rehearsal confirms it on the defined outcome (the `floor-advisory-by-rule` variant). Under the floor, Study 2 would
   be a costly null by design, unless the pilot shows fast advisory growth (gate D1).
4. **Under the floor the `gate` arm never fires.** T7 of `floor` reports 0 failing steps, so the gate arm is identical
   to `none` plus noise. Memo §5 already requires a decision here (gate D11b). The rehearsal makes it concrete: the
   `gate − none` contrast under the fallback tests nothing.
5. **The outline's two inference tools disagree.** The block-level sign-flip test treats the 54 blocks as exchangeable.
   The two-stage bootstrap clusters on 6 tasks. In the `expected` data set the test rejects (p 0.004) while the CI
   includes 0 ([−1.94, 0.06]). Across 200 studies they disagree 13 % of the time. Which one is confirmatory must be
   fixed (A1).
6. **The pipeline handles missing outcomes, null costs, timeouts and failed repairs without crashing.** The floor
   rehearsal found and fixed one crash: the Wilson interval with zero gate repairs.

## 5. Ambiguities that let two analysts compute different numbers (fix before the plan is locked)

Each item names where the text is open, the readings, and, where the rehearsal measured it, how much the number moves.
The analysis script implements the first reading of each, as a named option or constant, so locking an item means
fixing that value.

| # | Where | Open point | Readings | Measured effect | Proposed fix |
|---|---|---|---|---|---|
| A1 | outline §5.1 | **Which inference is confirmatory**: the block sign-flip p, or the task-cluster bootstrap CI. | (a) p decides, CI reported; (b) CI decides; (c) both must agree. | `expected`: p 0.004 rejects while the CI includes 0. They disagree in 13 % of studies (§3.3). | Name one decision rule. If the block test decides, report the CI as descriptive and say so. |
| A2 | outline §5.1 and §5.3 | **Confirmatory unit**: block (54) or task (6). With 6 tasks the smallest two-sided task-level p is 0.031 > 0.025 (Holm step 1). | (a) block; (b) task. | Task-level p in `expected`: gate 0.16. It can never reject. | Block-level test confirmatory; task forest descriptive (power notes reading 2). |
| A3 | outline §4 | **Primary scale**: raw blocking count or per KLOC ("also reported per KLOC"). | (a) raw; (b) per KLOC. | `expected` gate: p 0.004 (raw) against 0.109 (per KLOC). The relative reduction is 0.60 against 1.26. | Raw is primary, per KLOC secondary, written as such. |
| A4 | outline §5.1 | **Slope definition**: OLS on step 1..k including step 1 (level and creation), or on the change after step 1 (memo §3 counts new findings after step 1). | (a) OLS on 1..k; (b) OLS on 2..k; (c) (Y_k − Y_1)/(k − 1). | Not measured. (a) and (c) weight step 1 differently. | (a), stated with the regressor values. |
| A5 | outline §5.4 | **A step without an outcome** (evaluation failed). | (a) drop the step and fit on the rest; (b) re-score from the kept commit first; (c) drop the run. The minimum steps for a slope is unstated. | Minimum 3 → 54 blocks; minimum 5 → 44 blocks for mcp (p 0.050 → 0.048). | Re-score first; then (a) with a stated minimum (3); report dropped steps per arm (T10). |
| A6 | outline §5.1 | **Incomplete blocks** (an arm's slope missing). | (a) drop the block for that contrast only; (b) drop it for every contrast. | Contrasts can have different n. | (a), with n per contrast reported (T2 does). |
| A7 | memo §3 | **Finding identity.** The memo says rule, *template*, file, target, and for cycles the file set. `BlockingFinding` has no template field, and the harness's `repairOutcome` uses rule + file + target. | (a) harness identity; (b) memo identity, which needs the template and the cycle file set from elsewhere. | Not measured. A cycle reported from two files counts once or twice. | Add `template` (and the cycle file set) to `BlockingFinding`, or amend the memo to the harness identity. |
| A8 | memo §3 | **"New" needs `check-correct` labels** and author confirmation for `not-checkable`. Neither is in the telemetry, and the counting time is unstated. | (a) count all, provisional; (b) count only labelled `correct`. | Changes the switch verdict whenever every new finding is mislabelled (unit test). | Fix the label file format (the script accepts `{identity: label}`) and require it before the decision. |
| A9 | memo §3 | **Findings beyond the listing cap** (`blockingFindings` is capped per rule as `evaluate_project` caps it) are invisible to the identity count, though `blockingViolationCount` includes them. | (a) identities only; (b) also count unlisted increases. | Not measured. | Record the cap, and flag steps where the count exceeds the listed findings. |
| A10 | memo §5 | **The fallback outcome**, "advisory per KLOC, FF-CV05 excluded", cannot be computed from v1.3 records (§4.2). | (a) total advisory as surrogate; (b) re-score commits; (c) no primary. | The surrogate is ≈ 80 % FF-CV05. | Merge `advisoryByRule` before the first call (gate S6). |
| A11 | memo §5 | **`gate` under the advisory branch**: advisory subset, or arm dropped. | (a) keep as designed; (b) give advisory findings; (c) drop it. | Under `floor` the gate fires on 0 steps (§4.4). | Decide in the design (gate D11b). If (c), Holm is over one contrast. |
| A12 | outline §5.1 | **Monte Carlo precision of the sign-flip p.** Flips count and seed are unstated; with 54 blocks the test is not exact. | Any flips or seed. | `expected` mcp: Holm p 0.0461–0.0526 over 8 analysis seeds at 9999 flips. The decision flips on 3 of 8 seeds. | Fix the seed and flips (≥ 99 999), or use an exact or normal-approximate rule near α. Say which. |
| A13 | outline §5.1 | **Bootstrap details**: one or two stages; percentile or BCa; resamples; seed. | Many. | Two-stage percentile over-covers (0.97–0.99). | Fix stage, method, resamples (≥ 4999) and seed. |
| A14 | outline §5.1, §6 | **Effect size**: d_z (outline §6) or relative reduction ("halves the slope"); and relative reduction as a ratio of mean slopes or a mean of per-block ratios. | (a) d_z; (b) 1 − mean(arm)/mean(none); (c) mean of ratios. | Under `floor` the ratio CI is [−18, 2.7] (none slope ≈ 0). The mean of ratios is undefined when a none slope ≤ 0. | Report d_z and the mean difference. Report the relative reduction only when the none mean slope's CI excludes 0. |
| A15 | outline §5.1 | **Two-sided or one-sided.** The question is directional ("lower"); the power notes use two-sided. | (a) two-sided α 0.05; (b) one-sided 0.025. | Same p for a negative effect; differs if an arm increases erosion. | Two-sided, stated. |
| A16 | outline §5.1, §5.2 | **Which candidate is confirmatory**: slopes plus sign-flip (1) or the GLMM (2). The GLMM's random-effect structure, offset and software are open. | (1) or (2). | The GLMM was not run (not implemented here). | Choose (1). The GLMM, if kept, is a sensitivity analysis with its full specification. |
| A17 | outline §4 | **AHS AUC**: trapezoid over 1..k, raw or divided by (k − 1); a null AHS step. | Several. | Not measured. | Trapezoid divided by (k − 1) (a mean level), null steps dropped, as implemented. |
| A18 | outline §4 | **Repair success**: the denominator when the repair's evaluation failed (`cleared: null`); "new findings introduced" as `repairOutcome.introduced` (identities) or the count change. | Several. | `expected`: 2 of 233 repairs have no outcome. | Denominator = repairs with an evaluated outcome; introduced = identities. |
| A19 | outline §4 | **Cost**: Codex envelopes carry no `costUsd` (null), and per-run cost then mixes models. Usage-limit pause time sits inside `wallMs`. | (a) USD over runs with a cost only; (b) impute from tokens. | `expected`: 180 of 270 steps per arm have a cost. | Report USD per model, and tokens for every model. Subtract pause time from wall time using the interruption records. |
| A20 | outline §5.3 | **Model as a fixed factor** in candidate 1: pooled across models, or stratified. | (a) pooled block differences; (b) per-model contrasts combined. | T5 shows per-model spread. | (a) pooled; T5 descriptive. |
| A21 | outline §5.4 | **A turn that is not `completed`** (agent error, timeout) still leaves a scored tree. | (a) include, ITT; (b) exclude. | 5–14 such turns per arm in `expected`. | (a), ITT, with counts per arm (T9). |
| A22 | outline §3, §6 | **Blocks pair by `runIndex`**: replicate r of every arm. The schedule pairs this way; the outline does not say it. | (a) runIndex; (b) any pairing. | Pairing changes the differences. | State runIndex pairing. |
| A23 | outline §4 | **Type-check failures**: a step that does not compile still has a firewall score. | (a) include; (b) exclude. | 34–46 steps per arm in `expected`. | Include; guard reported. |
| A24 | memo §5 | **A blocking primary but a Study 2 floor** (the pilot found erosion, Study 2 does not). The memo forbids switching, so the contrast is degenerate. | (a) report a degenerate null; (b) switch anyway. | The script warns (T1). | State (a) explicitly. |
| A25 | readiness gate D11c | **`taskProfiles` with `daedalus-mcp`**: the harness refuses per-task specs with the MCP arm. So `evaluatorSpec` per step is absent, and the spec of record must come from the plan. | (a) one spec for every task; (b) a harness change. | Not measured. | Decide before the freeze; the analysis records the spec from the plan. |

## 6. Not computable from the step records

The analysis lists these in every report:

| Item | Why |
|---|---|
| GLMM (outline candidate 2) | Not implemented. |
| Held-out rule violations (Q4) | Not in the record. The PR #119 runner scores the hold-out *reference set* for the validity gate (V3, V4), not loop snapshots. |
| Dependency-cruiser violations (Q4) | Not in the record. |
| Layer coverage, dynamic imports and barrels (gaming guards, D13) | Not in the record. |
| MCP tool calls per step (call log, D6) | Not in the record. |
| Per-step acceptance checks (feature completeness) | Not adopted (outline §4). |
| Judge dimensions | Scored offline (memo §4). |

Each needs a re-scoring pass over the kept snapshot commits, or a harness field, before Study 2 starts. Otherwise its
table cannot be produced once the data exist.

## 7. Limits

- The synthetic data follow the power simulation's model. That model is linear erosion, with arms changing the slope
  only. Recovery is proven for that model, not for front-loaded or saturating erosion.
- The generated repair turns, costs and failure rates are plausible placeholders, not estimates.
- One analysis seed per scenario is reported. The many-seed calibration (§3.3) is the evidence on size and coverage.
- The figures are static SVG with native tooltips, drawn with the reference palette slots 1–3, light surface only.
