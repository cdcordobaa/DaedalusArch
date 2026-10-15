# Study 2: informal outline (firewall in the loop over successive feature steps)

> **NOT A PRE-REGISTRATION.** This is an informal outline written on 2026-10-15 to support FR-V12 (Study 2 design).
> By the author's decision, nothing is pre-registered yet. Nothing here is binding, hashed or listed in
> `corpus/prereg.json`, and no prereg tooling was touched. Every number below is a working guess, to be replaced
> before any registration. Study 2 is not run in v1.3 (METH-V1).
>
> **Tasks.** The Study 2 tasks are sealed outside the repository (`Docs/v1.3/sealed-hashes.md`). This outline does not
> name, paraphrase or derive them. The harness and its tests use only a made-up demo task (`experiments/loop-demo/`).

Related: `Docs/prereg-drafts/firewall-in-the-loop.md` (an earlier single-shot draft, three arms incl.
`context-graph`), `Docs/v1.3/validation-protocol.md`, `aidlc-docs/inception/requirements/v1.3-validity-requirements.md`.

## 1. Research question

**Does firewall feedback during generation reduce architectural erosion over successive feature steps?**

E1 and the single-shot draft look at one generation. Real projects grow: each new feature is a chance to break the
architecture a little more. Study 2 measures that drift and asks whether feedback from the firewall, given while the
agent works, slows it down.

Sub-questions (all informal):

- **Q1 (main).** Is the erosion slope (blocking violations per step) lower with feedback than without?
- **Q2.** Does it matter how the feedback arrives: tools the agent may query (`daedalus-mcp`) versus a gate that
  reports blocking findings after each step and grants one repair turn (`gate`)?
- **Q3.** How often does the gate's repair turn clear the findings, and what does it cost (tokens, money, time)?
- **Q4.** Does any effect reach rules the agent was never shown (held-out rules) and an independent measure
  (dependency-cruiser), or is it only compliance with the rules it saw?

## 2. Design in one paragraph

A **task** is a sequence of k feature steps applied to the **same** project directory: step 1 creates the system,
steps 2..k extend it. One **run** is one (model, task, arm, replicate). Within a run, the steps go in order, and each
step starts from the tree the previous step left. After every step, the harness takes a snapshot of the project (a git
commit in a store outside the agent's cwd), type-checks it, and scores it with the firewall (v1.3 scoring, symbolic
only). The unit of analysis is the step within the run; runs are nested in tasks.

The harness exists: `scripts/loop-harness-cli.ts` (`scripts/lib/loop/`). It reuses the E1 generator confinement
(Claude Code and Codex adapters), its retry and usage-limit pause policy, and the skeleton install. It is resumable,
and `--dry-run` runs the whole loop with a stub generator and a stub firewall:

```
npx tsx scripts/loop-harness-cli.ts --plan experiments/loop-demo/plan.dry-run.json --dry-run \
  --out-root <abs> --harness-root <abs> --binary <any>
```

## 3. Arms

| Arm | During each step | After each step |
|---|---|---|
| `none` | The E1 confinement argv, byte for byte. There is no MCP server. | Snapshot, type-check and score (measurement only; the agent sees nothing). |
| `daedalus-mcp` | The DaedalusArch MCP server with the 7 spec-only tools (`check_file`, `check_diff`, `suggest_placement`, `which_layer`, `check_import`, `explain_violation`, `get_architecture_spec`). `evaluate_project` is denied. One matched tool sentence is added to the prompt. | Same as `none`. |
| `gate` | The `none` argv (no tools). | Score. If there are **blocking** findings, the agent gets them (rule, file, line, message; at most 40 listed) in **one** repair turn. Then snapshot, type-check and score again. The step's outcome is the post-repair snapshot. |

Notes:

- Every arm uses the same step prompt frame (`scripts/lib/loop/prompts.ts`, a draft wording). The step text comes from
  the sealed task file at run time.
- `context-graph` (from the single-shot draft) is left out of this outline to keep the design small. It could come
  back as a fourth arm if a provider passes the confinement probes.
- **Placebo for the extra turn (open).** The `gate` arm gets one more turn than the other arms on failing steps. A
  "self-review" control (one extra turn with a generic "review your architecture" prompt and no findings) would
  separate *feedback content* from *extra compute*. It is worth considering if the budget allows.

## 4. Outcomes

All outcomes come from the stored per-step records (`steps/step-NN.json`), so none needs a model call.

| Outcome | Definition (informal) |
|---|---|
| **Blocking violations per step** | `blockingViolationCount` of the step's final snapshot (v1.3 tiers, `Docs/v1.3/rule-tiers.md`). It is also reported per KLOC (LOC = non-blank `src/**/*.ts` lines, the SO5 rule). |
| **Erosion slope** | Per run, the slope of blocking violations (or violations per KLOC) on the step index 1..k. This is the main contrast between arms. |
| **AHS trajectory** | The v1.2E symbolic AHS and the blocking-only AHS per step: their level at step k, their slope, and the area under the curve. |
| **Repair success** (`gate` only) | The share of failing steps whose repair turn cleared every blocking finding (`repair.cleared`), the mean reduction `blockingBefore − blockingAfter`, and new findings introduced by the repair. |
| **Cost** | Per step and per run: input, output and cache tokens, `total_cost_usd` (API-equivalent), agent turns, and wall time. Usage-limit pauses are recorded apart, and repair turns are counted separately. |
| Guards | Type-check errors per step. Skeleton integrity. Files and LOC per step (did the agent delete features to pass?). Held-out rule violations. Dependency-cruiser violations under the same spec (ADR-030 translation). Layer-coverage share (files that match no layer glob). |
| Process | For `daedalus-mcp`: tool calls per step and the first call before or after the first write (this needs the call log, §7). For `gate`: the findings shown. |

**Feature completeness is the weak spot.** An agent can lower its violations by dropping features. Per-step acceptance
checks (a small behavioural test per step, written together with the sealed tasks and never shown to the agent) would
close this hole. Without them, LOC and file trajectories are the only guard.

## 5. Candidate analysis

These are candidates only; the choice would be made at registration.

1. **Slope comparison (simple, robust).** Compute one erosion slope per run (OLS of blocking violations on step). The
   arms are compared within blocks (task × model × replicate, with every arm in a block), using a paired sign-flip
   permutation test. Signs are flipped within tasks, and the statistic is the mean within-block difference. The
   interval comes from a cluster bootstrap that resamples tasks, then blocks within tasks. Contrasts: `daedalus-mcp`
   vs `none`, and `gate` vs `none`, with Holm across the two. `gate` vs `daedalus-mcp` is secondary.
2. **Mixed model (uses every step).** A count GLMM (negative binomial, log link, offset log KLOC as a sensitivity) of
   blocking violations on `arm × step`. It has a random intercept and step slope by task, a random intercept by run
   (nested in task), and model as a fixed effect (few levels). The arm × step interaction is the erosion effect.
   AHS goes through the same structure in a linear mixed model.
3. **Clustering.** Inference is clustered by task. With only a handful of tasks, cluster-robust sandwich errors are
   unreliable. Use the permutation or wild cluster bootstrap and report the task-level effects (a forest plot per
   task) next to the pooled estimate.
4. **Missing steps.** A step that fails (agent error or timeout) still leaves a tree, which is snapshotted and scored,
   so later steps continue. A run that stops for a harness reason is resumed, not dropped. Per arm, report the steps
   whose type-check failed and the evaluator failures (re-scorable from the kept snapshots).
5. Cost and repair outcomes are descriptive, with bootstrap intervals and no confirmatory test.

## 6. Rough sample size and power intuition

Working grid: **tasks × models × replicates × arms**.

| Factor | Working value | Why |
|---|---|---|
| Tasks | 6 (the sealed list) | The bottleneck for generalisation; the task is the cluster. |
| Models | 2–3 (for example 2 Claude pins and 1 Codex pin) | Vendor spread; few enough to keep model fixed. |
| Replicates | 3 | Within-cell variance. |
| Arms | 3 | §3 (4 with the self-review placebo). |
| Steps per task | k ≈ 4–6 | Set by the sealed tasks. |

With 6 × 3 × 3 = **54 blocks** and 3 arms, that is **162 runs**, roughly 650–970 step turns plus the gate's repair
turns (perhaps another 30–60 % of the `gate` steps).

**Power intuition (paired, per contrast).** For a within-block slope difference with standardised effect d_z, two
contrasts under Holm (α = 0.025 at the strictest step, z ≈ 2.24) and power 0.80 (z ≈ 0.84), n ≈ ((2.24 + 0.84) / d_z)².
So 54 blocks detect d_z ≈ **0.42**, and 36 blocks (2 models) detect d_z ≈ **0.51**. These are medium effects. Feedback
that halves the slope would plausibly be that large, but a 10–20 % reduction would not be detectable.

Caveats that lower the effective n:

- Blocks share 6 tasks. If the arm effect varies by task (arm × task interaction), the effective n moves toward the
  number of tasks, not blocks. With 6 tasks only a large, consistent effect is detectable, so the per-task
  consistency of the sign matters as much as the pooled p-value.
- The slopes are noisy at small k. Each extra step helps more than an extra replicate when the erosion is roughly
  linear.

**Pilot first, on non-study tasks.** A small pilot on demo-style tasks (never the sealed ones) would estimate the SD of
per-run slopes, the cost per step and the repair rate. R, k and the model count would be set from that, never from
arm differences.

**Cost guess.** At about 2–6 USD API-equivalent per step turn, the grid comes to roughly 1.5k–6k USD API-equivalent.
Under subscription logins, the binding limit is usage windows; wall time is about 1–3 days sequential. NFR-V4 requires
escalation before any run above pilot size.

## 7. Threats (informal)

| Threat | Note and possible mitigation |
|---|---|
| **Circularity** | The rules that give the feedback also give the score. Mitigations: held-out rules, the dependency-cruiser measure, and a blind human review of a sample of final trees. |
| **Gaming** | The agent may satisfy the checker without better structure: files outside every layer glob, `require()` or dynamic imports, barrels. Guard with the layer-coverage share and the counts of dynamic imports and barrels. |
| **Feature dropping** | Fewer features means fewer violations. Mitigations: per-step acceptance checks (§4), LOC and file trajectories. |
| **Extra compute in `gate`** | The repair turn is more model time. Mitigations: the self-review placebo (§3), and reporting cost-adjusted effects. |
| **Path dependence** | Steps are not independent; an early repair changes every later start. That is the treatment, so analyse at the run level (slopes) or model it (random slope by run). |
| **Scoring leakage** | `gate` shows blocking findings, so the agent learns the objective. That is the arm by design. `evaluate_project` stays denied for `daedalus-mcp`. Q4 tests whether the effect generalises. |
| **Tool adoption** | The agent may ignore the MCP tools. Analyse ITT; the call log gives per-protocol figures. |
| **Confinement** | An MCP server widens the agent's surface. The Codex `daedalus-mcp` wiring (`-c mcp_servers.*` overrides) is **untested by a live probe**, and Codex runs MCP servers outside its sandbox. Re-run the E1 confinement probes for both CLIs with the server attached. |
| **Model and CLI drift** | Pin model ids and CLI versions. Arms are interleaved within seeded blocks (`orderSeed`). |
| **Few clusters** | 6 tasks. Report per-task effects and use permutation or wild bootstrap inference. Make no claim beyond these task types. |
| **Instrument validity** | If the firewall's blocking rules are imprecise on generated code, erosion is mis-measured. This is why §8 comes first. |
| **External validity** | Greenfield TypeScript, one style family, headless agents. Make no brownfield claim. |

## 8. Prerequisites from the v1.3 validity gate (must pass first)

Study 2 should not start, nor be registered, until:

1. **The FR-V11 validation report passes**, with every target met or waived in writing:
   - link 1: adjudicated import-edge precision and recall ≥ 0.95, and file-to-layer accuracy ≥ 0.95;
   - link 3: blocking-rule recall ≥ 0.90 per style;
   - links 3+4: blocking-rule precision (*correct*) ≥ 0.90;
   - *meaningful* precision reported;
   - labeller κ ≥ 0.60 against the author audit.
2. **The tiers are frozen.** `Docs/v1.3/rule-tiers.md` stays at its sealed hash, and the blocking set used by `gate`
   and by the outcomes is exactly that table.
3. **The tool agrees with the graph.** On the reference projects, `check_file` and `check_diff` match the graph's
   blocking-rule verdicts. Otherwise `daedalus-mcp` is a different treatment from the one scored.
4. **The confinement probes pass with the MCP server attached**, for each CLI and arm. This includes the Codex MCP
   wiring and whether the server runs outside the Codex sandbox.
5. **The call log is in place** (outside the cwd) for `daedalus-mcp` tool use.
6. **The harness is green.** The loop unit tests pass, and a pilot on non-study tasks runs end to end, with resume
   exercised.
7. **The frozen tunables are hashed** (validation protocol §4): templates, tiers, extractor flags, judge prompts (no
   judge in the outcomes), spec presets, the step and repair prompt frames, and the MCP tool descriptions.
8. **The sealed tasks are untouched.** Their sha256 still matches, and no v1.3 generation used them.
9. **Acceptance checks per step** (§4), if adopted, are written with the sealed tasks and sealed in the same way.

Only then would a real pre-registration be drafted, as a separate, author-approved step.
