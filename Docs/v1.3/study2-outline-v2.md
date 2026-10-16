# Study 2: outline v2 (firewall in the loop over successive feature steps)

> **NOT A PRE-REGISTRATION.** Written on 2026-10-16 as a revision of `Docs/v1.3/study2-outline.md` (v1, kept unchanged).
> By the author's decision nothing is pre-registered yet. Nothing here is binding, hashed or listed in
> `corpus/prereg.json`, and no prereg tooling was touched. Where v2 says **defined**, it is a proposal written down so
> that the pre-registration can copy or reject it. It is not a decision the author has signed.
>
> **Study 2 runs exactly once** (the author's rule). This revision is organised around that rule: every open point is
> either fixed here, named as **pending** with what it waits on, or listed in §11 as a reason the one run could fail.
>
> **Tasks.** The Study 2 tasks are sealed outside the repository (`Docs/v1.3/sealed-hashes.md`). This outline does not
> name, paraphrase or derive them, and no sealed directory was read to write it.
>
> **Numbers.** Every number is quoted from a committed file, cited by path. A number that sits on a branch whose PR is
> still open is cited `branch:path` and is **not on `v1.3` yet**. Nothing is estimated here. Where no run exists, the
> text says **pending**.

Status words used below:

- **Defined**: written down here as the proposal for the pre-registration.
- **Pending**: waits on a named run, merge or fix.
- **Author decision**: only the author can take it. A recommendation may be given.

## 0. What changed from v1

| Topic | v1 (2026-10-15) | v2 (this file) |
|---|---|---|
| Floor effect | Not anticipated. Primary outcome = blocking violations per step. | Four probes and the pilot found almost no blocking erosion (§1). The primary outcome follows the pilot memo's pre-committed rule, and that rule's decision is **pending** (§4). |
| Arms | `none`, `daedalus-mcp` (7 tools), `gate`; placebo open | Same three arms. `daedalus-mcp` uses the 9 spec-only tools the harness allow-lists. The neural MCP tools are **not** part of it (§3). |
| Task design | Sealed tasks, k ≈ 4–6 | Requirements written from the floor evidence (§5). The task-design guide is **pending**. |
| Sample size | Working grid 6 × 3 × 3, normal approximation | Power simulation (PR #119) figures. No option reaches 0.80 for `gate` under the base assumptions. Final N **pending** (§6). |
| Analysis | Two candidates, many open points | Candidate 1 is confirmatory. A fix for each of the 25 ambiguities found by the rehearsal (PR #160), plus one more (§7). |
| Go/no-go | Nine prerequisites | The 42-line readiness gate (PR #146) is the only go criterion (§9). |
| Run once | Implicit | Made operational (§2), with a risk list and a mitigation for each risk (§11). |

## 1. Evidence base (tonight's work, 2026-10-15/16)

| Evidence | Where | State | What it says for Study 2 |
|---|---|---|---|
| **Agent proof** | PR #156, `v1.3-agent-proof:Docs/v1.3/agent-proof-2026-10-16.md` | open | A headless Claude Code agent (`claude-opus-5-5`) built a hexagonal service with the MCP tools. It had **0 blocking (defining) violations after each of 5 realistic tasks**, including tasks built to tempt shortcuts (reporting, urgent hotfix, cross-feature reuse). On a 6th task, planted with 3 blocking violations, it found and fixed 3 of 3. One run, one agent, one domain: illustrative only. |
| **Floor probe 1** | PR #161 (merged), `Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` | merged | `none`-arm steps with ≥ 1 blocking finding: **14 / 28**. Hexagonal **0 / 14**, layered **14 / 14**. New blocking findings after step 1: **4 / 22**, all layered, all copies of step-1 layout habits. All 96 findings `correct`. "None of the targeted pressures … caused a violation in either style". It also found MCP tool defects (§3.3 below) and FF-S01/FF-S03 double counting in layered. |
| **Floor probe 2** | PR #182, `v1.3-floor-probe-2:Docs/DiagnosticRuns/v1.3-floor-probe-2-2026-10-16.md` | open | Style + layout sentence 1 / 8 steps with a blocking finding; style only 0 / 8; spec only 0 / 8. The pre-stated rule says: keep the frame and move the lever to task design. Dropping the layout sentence left 19 / 28 hexagonal files outside every layer glob. |
| **Precedent probe** | PR #189, `v1.3-precedent-probe:Docs/DiagnosticRuns/v1.3-precedent-probe-2026-10-16.md` | open | A shortcut planted in the tree was copied in 0 / 8 planted cells, and in 0 / 8 controls. This gives no support for brownfield seeding as a floor-lifter. |
| **Loop pilot** | PR #170, `v1.3-pilot-run:Docs/DiagnosticRuns/v1.3-loop-pilot-2026-10-16.md` | ran; open | Clean `none`: **0** new blocking findings at steps 2–4. Hexagonal `none`: **0**. DDD: **unscored**, because of tool defect T1 (the frozen spec has no aggregates, `BR-SPEC-10`). **The memo §5 decision is not reached.** Advisory slope per KLOC without FF-CV05 in `none`: −0.50 (Clean) and −0.58 (Hexagonal). Cost 6.34 USD for 24 step turns, with 0 repair turns used. `daedalus-mcp` was out. |
| **Task-design guide** | branch `v1.3-task-design` | **pending** | The branch did not exist on `origin` when this was written. §5 states the requirements from the evidence above. The guide must meet them, or it replaces them by a dated note. |
| **Analysis rehearsal** | PR #160, `v1.3-study2-analysis-rehearsal:Docs/v1.3/study2-analysis-rehearsal.md` | open | The D9 analysis script ran end to end on synthetic telemetry: 30 / 30 assertions pass. It lists **25 ambiguities (A1–A25)**. Power at the working grid is 0.54–0.60 (`gate`) and 0.17–0.20 (`daedalus-mcp`). The fallback outcome has power ≈ 0.05. |
| **Readiness gate** | PR #146, `v1.3-study2-readiness:Docs/v1.3/study2-readiness-gate.md` | open | **NO-GO: 1 of 42 lines green (V2), 1 partly green (D14), 32 red, 8 unknown** at `4339bad5`. The author signs the go. |
| **Validity strategy** | PR #147, `v1.3-validity-strategy:Docs/v1.3/validity-strategy.md` | open | Reliability and mechanical correctness are strongly evidenced. Construct and criterion validity are moderate, and they depend on the unrun sealed hold-out. Predictive validity and judge validity are not yet evidenced. |
| Convergent validity | PR #166 (merged), `Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md` | merged | κ against dependency-cruiser: 1.000 / 0.961 / 0.913 (reference / external / wild). 0 of 253 disagreements are classed as our bug. 4 blocking rules (7 style rows) cannot be expressed in any of the three tools. |
| Fixes mined | PR #168, `v1.3-validity-fixes-mined:Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md` | open | **No robust validity signal.** The pooled ratio 2.65 rests on one commit; without it, 0.93 (0.61–1.43). Blocking findings mostly survive in human projects. |
| Predictive validity | `git show 0cd79b88:Docs/v1.3/predictive-validity-prespec.md`, addenda through `879c3abe`; first exposure output `f47f590c` (branch `v1.3-validity-predictive`, which has never had a PR; pinned 2026-10-16) | prespec only | Analysis committed before the first exposure output on an unmerged branch, not registered or reviewed; **no result yet (pending)**. |
| **Judge v2.2 CHECK-2** | PR #191, `v1.3-judge-v22-run:Docs/DiagnosticRuns/v1.3-judge-v22-check2-2026-10-16.md` | ran; open | **NOT CANDIDATE.** Check D1 fails: layered business clean units false-fail 7 / 21 against a rule of ≤ 1. **v1 stays the frozen judge.** Both judges catch 40 / 40. Clean false fails: v1 16 / 48, v2.2 8 / 48. |
| **Neural MCP tools** | PR #157 (merged), `Docs/v1.3/neural-arm-agent-tools.md` | merged | `review_unit` and `explain_and_fix` exist behind `--neural`, OFF by default. "No experiment arm allow-lists them" (`src/mcp-server/server.ts`, `NEURAL_TOOL_NAMES`). |
| **Power simulation** | PR #119 (merged), `Docs/v1.3/study2-power-notes.md` | merged | Option B (working grid): `gate` 0.54, `mcp` at a quarter reduction 0.18. No option reaches 0.80 for `gate` at base assumptions; under Poisson counts B reaches 0.94. A task-level test with 6 tasks has power 0. |
| Gap-closing plan | PR #192, `v1.3-gap-plan:Docs/v1.3/gap-closing-plan.md` | open | Critical path to the single run and the author decisions it needs. Cited for decisions only. |

**Reading of the floor evidence, in one paragraph.** In E1, every arm of the floor probes and the pilot, and in the agent proof, agents given a style sentence and a folder layout wrote Clean and hexagonal code with no blocking violation, at any step, under any pressure the tasks applied. The only blocking findings came from layered step-1 layout habits (a level, not a slope), and from one intra-layer cycle (probe 2). Every probe agent was a strong Claude model, and most knew the instrument, which biases toward the floor. Still, nothing tonight shows blocking-tier erosion arising by itself in plain product language.

## 2. What "runs exactly once" means

Defined:

1. **The run starts** with the first Study 2 model call at the commit the author signed as "go" (§9). Before that, only the loop pilot and the one dress rehearsal (`v1.3-study2-readiness:Docs/v1.3/study2-dress-rehearsal.md`) may run loops. Neither uses a sealed task.
2. **An interruption is resumed, never restarted.** Usage limits, crashes and machine loss are resumed from the harness state on the same out-root (`--resume`). No run directory is deleted or regenerated.
3. **A step that cannot be scored is re-scored, not regenerated.** Every step commit is kept in `snapshots.git`. Scoring is deterministic, so a scoring defect found after the run is fixed on the development set and the kept snapshots are re-scored. A re-score is reported as such, with the defect and the fix.
4. **A failed or degenerate study is reported, not repeated.** A null, a floor, a budget stop at a complete block, or a defect that leaves an arm uninterpretable is the result of Study 2. A second Study 2 on the same question would be a new study with its own pre-registration, and the thesis would report both.
5. **Nothing seen in the run changes the plan.** Outcome, arms, analysis and exclusions are fixed at registration. Changes after the first call are dated addenda that the thesis reports as deviations.

## 3. Arms

### 3.1 Arm table (defined, with pending parts named)

| Arm | During each step | After each step | Status |
|---|---|---|---|
| `none` | The E1 confinement argv. Styled step frame **with** the layout sentence. No MCP server. | Snapshot, type-check, score. The agent sees nothing. | Defined. The no-layout-hint question (gate S5) is an **author decision**. Recommendation, from probe 2's pre-stated rule: keep the layout sentence and record "no spec" as not tested by Study 2. |
| `daedalus-mcp` | The DaedalusArch MCP server with the **9 spec-only tools** the harness allow-lists (`scripts/lib/generators/arms.ts`, `DAEDALUS_ARM_TOOLS`, pinned equal to `SPEC_TOOL_NAMES`): `get_architecture_spec`, `which_layer`, `check_import`, `explain_violation`, `check_file`, `check_diff`, `suggest_placement`, `infer_spec`, `explain_finding`. `evaluate_project` is denied. One matched tool sentence in the prompt. | Same as `none`. | Defined, **conditional on §3.3**. v1 listed 7 tools; the harness now allows 9 (MCP v2). |
| `gate` | The `none` argv. | Score. If there are **blocking** findings, one repair turn with them (at most 40). Then snapshot, type-check, score again. The outcome is the post-repair snapshot. | Defined for the **positive** branch of §4. Under the **zero** branch it is an **author decision** (§3.4). |

Not in Study 2:

- `context-graph`: out, as in v1.
- The **self-review placebo**: **pending author decision** (gate D11a). The floor evidence weakens the case for it: in the pilot the gate fired on 0 of 8 scored steps, and in probe 1 it would have fired once per layered task, at step 1. A placebo for a turn that almost never happens buys little. Recommendation: leave it out, and report the gate's extra turns and their cost (T7, T8 of the rehearsal).

### 3.2 Are the neural MCP tools part of the MCP arm? No (defined)

`review_unit` and `explain_and_fix` (PR #157) are **not** in the `daedalus-mcp` arm, and the server runs **without** `--neural`. Reasons:

1. **The code already says so.** `NEURAL_TOOL_NAMES` are "never spec tools and no experiment arm allow-lists them" (`src/mcp-server/server.ts`). Without `--neural`, the tool list and descriptions are byte-identical to before (`Docs/v1.3/neural-arm-agent-tools.md` §1). Adding them would change the frozen tool descriptions (gate S11) after the tools were built.
2. **The judge is not validated for this use.** The frozen judge is v1, because v2.2 is NOT CANDIDATE (PR #191). The catch rate on the defensible cut is 16 / 21 = 0.76, below the 0.80 target (`v1.3-gap-plan:Docs/v1.3/gap-closing-plan.md`, SO3). v1 false-fails 16 / 48 clean CHECK-2 units. Feeding that into the treatment puts an unvalidated second model inside the arm.
3. **It would be a different treatment, which Study 2 cannot power.** Spec tools plus an LLM reviewer is a neuro-symbolic treatment. The power simulation already finds a weaker `mcp` effect undetectable (≤ 0.33 at a quarter reduction, any option). A fourth arm, or a mixed MCP arm, would split the same budget further.
4. **Latency and vendor.** The tools' expected latency on the Claude route is 20–90 s per call, and they answer `pending` beyond 20 s (`neural-arm-agent-tools.md` §6). Their effect on a step's wall time and cost in the live loop has not been measured (**pending**, gate D5). The judge is Claude-family, like the generator (gate V10).

The neural arm still enters Study 2 in one place: the judge dimensions FF-N01 and FF-N02 are scored **offline** on the kept snapshots, after all runs, with frozen judge v1. They are secondary, never primary, never blocking, and not reported for DDD unless a DDD judge configuration is validated (gate V7). An agent-facing neural arm is future work, or a separate exploratory study, outside the single run.

### 3.3 Conditions on `daedalus-mcp` (pending)

The arm runs only if all of the following hold at the run commit. Otherwise the pre-registration drops it, or drops the failing style from it, before the first call (gate V9 allows this):

- **Tool–graph agreement (gate V9).** Probe 1 found that `check_import` does not apply the hexagonal graph rules. For application → outbound adapter it returns `allowed` / `pass`, while the graph scores FF-S01 blocking. It also found that `check_file` and `check_diff` carry two verdicts that disagree: the legacy `verdict` against `blockingVerdict` (`Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md` §3.7). The loop replay found the tools miss `dependency-direction-graph`, `core-isolation` and `context-isolation` (`Docs/v1.3/loop-replay.md`). **Pending:** a fix, and 100 % blocking agreement per Study 2 style.
- **Per-task spec (gate D11c, ambiguity A25).** The plan loader refuses `taskProfiles` together with `daedalus-mcp` (`scripts/lib/loop/plan.ts`). **Pending:** a harness change, or one style per MCP server configuration.
- **Confinement with the server attached (gate S4)**, for each CLI. **Pending.** The pilot left the arm out for this reason.
- **Call log outside the cwd (gate D6).** **Pending.**

### 3.4 `gate` under the zero branch (author decision)

If §4 lands on the advisory outcome, the gate as designed reacts only to blocking findings. In the rehearsal's floor scenario it fires on 0 steps, so `gate − none` tests nothing (`study2-analysis-rehearsal.md` §4.4). Options, from memo §5 and ambiguity A11:

- (a) keep it as designed;
- (b) show it the advisory subset;
- (c) drop it.

**Recommendation: (c).** Option (b) designs a new treatment after the pilot has been seen, and advisory feedback is mostly FF-CV05 noise. If `gate` is dropped, Holm runs over one contrast.

## 4. Primary outcome under the floor evidence

### 4.1 The rule (pre-committed, not reopened here)

`Docs/v1.3/pilot-outcome-memo.md` §5 fixed the rule before any pilot run:

- **Positive branch.** At least one new blocking finding, labelled `correct`, in the `none` arm after step 1, in any pilot task. Then Study 2 keeps blocking violations per step and their slope as the primary outcome.
- **Zero branch.** No new blocking finding in the `none` arm in **any** of the 3 tasks. Then the primary outcome moves to the advisory-tier erosion rate: the per-run OLS slope of advisory findings per KLOC, with FF-CV05 excluded.
- No other pilot result may change the primary outcome.

### 4.2 Where the decision stands: PENDING

The pilot ran (PR #170). Clean and hexagonal `none` had 0 new blocking findings. DDD is unscored (T1). Neither branch's condition is met. **The decision is still pending.** Until it is taken, the pilot report fixes the default: Study 2 keeps the blocking outcome.

What resolves it:

1. Fix the freezer for T1 on the development set.
2. Re-freeze each DDD pilot run's spec from its **same** recorded step-1 commit.
3. Score the 8 kept DDD snapshots. This is the pilot report's option 1, and the gap plan's recommendation. It needs no new generation and no memo change.
4. Apply §5 mechanically. If DDD `none` has 0 new blocking findings at steps 2–4, the zero branch applies. If it has 1 or more labelled `correct`, the positive branch applies.

v2 does **not** amend §5. That includes adding tasks, swapping in the new task designs (§5) or counting probe results. Those were seen after the memo was fixed, and the memo allows no other input.

### 4.3 The outcome under each branch (defined, so both are ready before the decision)

**Positive branch: primary = blocking erosion slope.**

- Per run, the OLS slope of the step's raw `blockingViolationCount` on steps 1..k (A3, A4). Blocking means `Docs/v1.3/rule-tiers.md` at its sealed hash.
- Reported beside it: the step-1 blocking count on its own, and the count of **new** blocking identities at steps ≥ 2. Probe 1 showed layered findings are a step-1 level that later steps copy. A slope alone would mix that level into "erosion".
- If any Study 2 style is layered, the FF-S01/FF-S03 double count (probe 1 §3.7.3) is an **author decision** before the freeze: keep the raw count (as the tiers define it) and report distinct violating edges as a sensitivity, or change the count. Recommendation: keep raw and report the sensitivity. Changing the count changes the construct.
- **Known risk:** the slope may be ~0 in every arm (§11, R1).

**Zero branch: primary = advisory erosion rate.**

- Per run, the OLS slope over steps 1..k of advisory findings per KLOC, FF-CV05 excluded. LOC is non-blank `src/**/*.ts` lines.
- **Now computable.** PR #142 merged `advisoryByRule` into the loop's step evaluation (`scripts/lib/loop/evaluator.ts`). The rehearsal's A10 concern is closed in the code. **Pending:** a rehearsal re-run on the post-#142 record format, to prove it end to end.
- **What this branch costs, stated now:**
  - Power is ≈ 0.05 under the base assumptions (rehearsal §3.2).
  - The pilot's `none` slopes without FF-CV05 were **negative** in both scored tasks (−0.50, −0.58).
  - Gate line D1 requires, under the advisory branch, that "the pilot shows the advisory density growing per step". The line has no waiver. **Unless the DDD runs change that picture, D1 cannot turn green under the zero branch, and Study 2 does not start (§9).**
  - The gap plan's Decision 5 lists the options: (a) run anyway, with the null pre-declared as interpretable; (c) do not run, and report the design and the readiness evidence. It advises against (b), amending the memo. Choosing between (a) and (c) is an **author decision**. Under the current gate text, (a) needs D1 to be green, so as written only (c) is open.

Under either branch: the judge dimensions, cost, repair success and the guards are secondary (§8).

## 5. Task design requirements

The task-design guide (`v1.3-task-design`) is **pending**. These requirements come from the floor evidence. A Study 2 task set, sealed or new, must meet each one, or the author waives it in writing with the residual stated.

**Which tasks.** The sealed list was written before tonight's evidence. Whether it is kept, or replaced or extended by tasks written to these requirements, is an **author decision** (gap plan step 5.4). New tasks must be checked against the sealed domains without disclosing them, sealed the same way (sha256 in `sealed-hashes.md`) and audited before the dress rehearsal. Changing tasks does not reopen memo §5 (§4.2).

| # | Requirement | Evidence |
|---|---|---|
| T1 | **Aim the pressure at blocking-tier edges of each style.** In hexagonal, design steps where the cheapest path is: a use case calling a concrete adapter; domain logic needing request or framework data; a handler needing a global held by the composition root; or shared code across use cases that invites a cycle. | Probe 1 §5.2 and §3.6. In hexagonal, the reporting shortcut is FF-S03, which is **advisory** there. Probe 2: the only finding was a cycle. |
| T2 | **Drop pressures that only reach advisory rules** as floor-lifters (for example a reporting endpoint in hexagonal). They may stay as realism, but they are not counted on to lift the floor. | Probe 1 §3.3. |
| T3 | **Prefer styles whose defining rules conflict with an agent's default layout** (strict layering, DDD context isolation), or report the expected zeros for the others as such. | Probe 1 §5.1. |
| T4 | **Plain product language.** Never name a layer, port, interface or pattern. No answer-carrying names or comments. Banned-term audit with zero hits. | `Docs/v1.3/pilot-tasks.md` §1; gate D2, V11; unsealer audit (PR #174). |
| T5 | **Same frame in every arm**, with the layout sentence (S5 recommendation). | Probe 2: without it, 19 / 28 hexagonal files fell outside every glob; "spec only" carries the layout too. |
| T6 | **k as large as the tasks allow** (k = 6 if possible). One more step buys more power per turn than one more replicate. | Power notes reading 4: option E (k = 6) 0.71 against B 0.54. |
| T7 | **Each step must leave a scoreable tree for every style.** In particular, a DDD step 1 must yield a spec the pipeline accepts (aggregates present), or the D15 rule decides in advance what happens. | Pilot T1; gate D15. |
| T8 | **Per-step acceptance checks** (small behavioural tests, never shown to the agent), written and sealed with the tasks. Without them, only LOC and file trajectories guard against feature dropping. **Author decision** (D12 has a [W]). | v1 §4; gate D12. |
| T9 | **Do not rely on brownfield precedent seeding** as a lever. | Precedent probe: 0 / 8 against 0 / 8. |
| T10 | **No pilot or probe task** (or derivative) is a Study 2 task. | Memo §6; probe 1 §2.1. |

## 6. Sample size

### 6.1 From the power simulation (PR #119, `Docs/v1.3/study2-power-notes.md`)

Blocking outcome, power under Holm over two contrasts, block-level sign-flip, base assumptions (θ = 2, erosion 1.0 per step):

| Option | Tasks × models × replicates | k | Blocks | Runs | Step turns | `gate` halves the slope (`mcp` quarter) | `mcp` at 0.25 |
|---|---|---|---|---|---|---|---|
| A | 6 × 2 × 3 | 5 | 36 | 108 | 540 | 0.37 | 0.11 |
| B (working grid) | 6 × 3 × 3 | 5 | 54 | 162 | 810 | 0.54 | 0.18 |
| C | 6 × 3 × 5 | 5 | 90 | 270 | 1350 | 0.77 | 0.33 |
| D | 6 × 3 × 3 | 4 | 54 | 162 | 648 | 0.36 | 0.11 |
| E | 6 × 3 × 3 | 6 | 54 | 162 | 972 | 0.71 | 0.26 |
| F (12 tasks) | 12 × 3 × 2 | 5 | 72 | 216 | 1080 | 0.66 | 0.21 |

Further readings from the same notes:

- B under Poisson counts reaches 0.94. At θ = 0.8 it falls to 0.31.
- With slow erosion (0.5 per step) B gives 0.27.
- With 6 tasks, a task-level test has power 0: the smallest two-sided p is 0.031 > 0.025.
- The advisory fallback has power ≤ 0.08 in every option.

### 6.2 What is fixed and what is pending

- **Defined: the confirmatory unit is the block** (task × model × replicate). The task-level forest plot is descriptive (A2).
- **Defined: if `gate` is dropped (§3.4), Holm runs over one contrast.** Power must then be recomputed for that design.
- **Pending: the final grid** (gap plan Decision 7, gate D3). Gate D3 requires power ≥ 0.80 for each confirmatory contrast, with budgeted N ≥ 1.1 × required N. **No option in the table meets that** for `gate` at the base assumptions, and `mcp` is below it everywhere.
- **Pending, and possibly not obtainable: the pilot's θ and slope SD.** D3 says to re-run the simulation "with the pilot's θ, slope SD and erosion rate". The two scored pilot tasks had a blocking count of 0 at every step, so they carry no information on blocking dispersion. The dress rehearsal "estimates no arm effect, and … informs nothing about erosion". Unless the DDD runs show blocking counts, the power re-run must rest on stated assumptions. The pre-registration must say which, and that the pilot could not supply them.
- **Budget evidence (not a budget).** The pilot measured 6.34 USD API-equivalent for 24 Sonnet step turns (0.15–0.42 USD per turn), about 10× below v1's guess. It also ran under the subscription login with no usage-limit pause. Other models and the MCP and repair turns are not measured (gate D4, **pending**). The gap plan concludes that budget is less binding than assumed, so the largest grid that passes D3 is preferred.

## 7. Analysis: a fix for every rehearsal ambiguity

Confirmatory analysis (defined): **outline candidate 1**. One OLS slope per run, the within-block difference arm − `none`, and a paired two-sided sign-flip permutation test at the block level, with Holm over the confirmatory contrasts. The analysis script is `scripts/v1.3/study2-analyse.ts` (PR #160). Its constants are set to the values below and its sha256 is frozen with the tunables (gate S11).

| # | Ambiguity (rehearsal §5) | Fix in v2 | Status |
|---|---|---|---|
| A1 | Which inference decides | The **block sign-flip p under Holm decides**. The two-stage bootstrap CI is reported as descriptive and labelled so. A disagreement between them is reported and does not change the decision. | Defined |
| A2 | Block or task as the unit | **Block** (54 at option B). The task forest plot and task-level p are descriptive, with the smallest attainable p shown. | Defined |
| A3 | Raw or per KLOC | **Raw count** is primary for the blocking branch. Per KLOC is secondary. (The zero branch is per KLOC by the memo's definition.) | Defined |
| A4 | Slope definition | OLS on steps **1..k**, regressor values 1..k. The step-1 level and new identities at steps ≥ 2 are reported beside it (§4.3). | Defined |
| A5 | A step without an outcome | First **re-score from the kept commit**. If it still fails, drop that step and fit on the rest. A run needs **≥ 3 scored steps** for a slope. Dropped steps per arm go in T10. | Defined |
| A6 | Incomplete blocks | Drop the block **for that contrast only**. Report n per contrast (T2). | Defined |
| A7 | Finding identity | Identity = rule + template + file + target; for a cycle, the sorted file set. `BlockingFinding` now carries `template` (`scripts/lib/loop/types.ts`, PR #142). **Pending:** check that the cycle file set is recorded, or derive it from the kept snapshot by a fixed script. | Defined; check pending |
| A8 | `check-correct` labels for "new" | Label file format `{identity: label}`. Labels are complete **before** any branch or count is computed. `not-checkable` counts only with the author's one-line confirmation. `incorrect` is logged as a tool defect and not counted. | Defined |
| A9 | Findings beyond the listing cap | Use the uncapped findings list (PR #142, per the dress-rehearsal entry list). Assert, per step, listed findings = `blockingViolationCount`, and flag any step where they differ. **Pending:** confirm on a real record. | Defined; check pending |
| A10 | Fallback not computable | `advisoryByRule` is on `v1.3` (PR #142). Compute the fallback as defined. Re-run the rehearsal on the new format. | Code done; rehearsal re-run pending |
| A11 | `gate` under the advisory branch | Recommendation: drop it (§3.4). | Author decision |
| A12 | Monte Carlo precision of the sign-flip p | **99 999 flips** (the rehearsal's minimum), seed fixed in the pre-registration. If the p lies within its Monte Carlo SE of the Holm threshold, report that, and use the exact test where it is feasible. | Defined; seed value pending |
| A13 | Bootstrap details | Two stages (tasks, then blocks within tasks), percentile, **4 999 resamples** (the rehearsal's minimum), seed fixed in the pre-registration. Over-coverage (0.97–0.99 in rehearsal) is stated. | Defined; seed value pending |
| A14 | Effect size | Report the **mean difference and d_z**. Report the relative reduction (1 − mean arm / mean `none`) only when the CI of the `none` mean slope excludes 0. | Defined |
| A15 | One- or two-sided | **Two-sided**, α = 0.05. | Defined |
| A16 | Slopes or GLMM | **Slopes (candidate 1)** are confirmatory. The GLMM is omitted unless it is fully specified (family, link, random effects, offset, software and version) in the pre-registration as a sensitivity analysis. | Defined |
| A17 | AHS AUC | Trapezoid over 1..k divided by (k − 1). Null AHS steps dropped. | Defined |
| A18 | Repair success | Denominator = repairs with an evaluated outcome. "Introduced" = new identities (`repairOutcome.introduced`). | Defined |
| A19 | Cost with null Codex USD; pause time | USD per model, tokens for every model. Wall time minus the recorded pause durations (needs gate S1's pause field; **pending**). | Defined; field pending |
| A20 | Model fixed: pooled or stratified | **Pooled** block differences. Per-model contrasts (T5) are descriptive. | Defined |
| A21 | Turns not `completed` | **Included (ITT)**, counts per arm (T9). | Defined |
| A22 | Pairing within blocks | By **`runIndex`** (replicate r of every arm), as the schedule pairs. | Defined |
| A23 | Steps that fail type-check | **Included**, with the type-check guard reported. | Defined |
| A24 | Blocking primary, but Study 2 at the floor | **Report a degenerate null.** No switch after the run. The report states that the contrast had nothing to detect. | Defined |
| A25 | `taskProfiles` with `daedalus-mcp` | Harness change, or one style per server configuration, decided before the freeze (§3.3). | Pending |
| A26 *(added by v2)* | FF-S01/FF-S03 double count in layered | Raw count, with a distinct-edge sensitivity, if any style is layered (§4.3). | Author decision |

Items the step records cannot give (rehearsal §6) need a harness field or a fixed re-scoring script, run over the kept snapshots **before any arm comparison is read**. They are: held-out rules and dependency-cruiser (Q4, gate D16); layer coverage, dynamic imports and barrels (D13); the MCP call log (D6); acceptance checks (D12); and the judge dimensions. **Pending.**

## 8. Secondary outcomes and the neural arm results

As in v1 §4, with these changes:

- **Judge dimensions** (FF-N01, FF-N02). Frozen judge **v1**, offline, secondary. v2.2 is NOT CANDIDATE (PR #191), so there is no v2.2 run. The pinned CLI, model and effort are frozen (gate V7). CHECK-2 judged DDD for the first time (v1 catch 4 / 4, clean false fail 1 / 6, on open PR #191). That is development evidence only; DDD judge dimensions are reported only if gate V7's DDD condition is met.
- **Advisory per KLOC without FF-CV05.** Primary under the zero branch, secondary otherwise. FF-CV05 was 71–100 % of advisory findings per pilot step.
- **Guards.** Type-check errors, skeleton integrity, files and LOC per step, layer-coverage share, and dynamic-import, `require` and barrel counts. The coverage share is required, not optional: probe 2 showed a zero can mean "outside the globs".
- **Gate repair rate.** Pilot: undefined (0 / 0). Reported descriptively.

## 9. Go/no-go: the readiness gate

**Study 2 starts only when every line of the readiness gate is green at the run commit.** A line marked [W] may instead be closed by a dated author waiver. **The author signs the go; no AI session does** (`v1.3-study2-readiness:Docs/v1.3/study2-readiness-gate.md` §0 and §5). This outline adds no line and relaxes none.

- **The gate is on an open PR (#146).** Merging it into `v1.3` comes first (gap plan P0).
- **Status at its writing: NO-GO** (1 green, 1 partly green, 32 red, 8 unknown, at `4339bad5`).
- **The gate's order:** pilot → instrument freeze and hold-out → dress rehearsal → pre-registration → gate → Study 2.

Tonight's evidence touches these lines. Each stays at its recorded status until it is re-verified at the run commit (gate rule 3).

| Line | New evidence | Effect |
|---|---|---|
| D1 (no floor in the pilot) | Pilot ran; §5 not reached; zero-branch slopes negative | Still red. Under the zero branch, likely unpassable as written (§4.3). |
| D3 (power) | Pilot gave no blocking dispersion | Red. θ may have to be assumed (§6.2). |
| D9 (analysis rehearsal) | PR #160: 30 / 30 assertions | Red until it is merged and re-run on the post-#142 format at the run commit. |
| D11 (arm set) | §3 proposes it | Red until the author decides (a)–(d). |
| D14 (harness) | Fault drills PR #180: 11 / 13 resume byte-identical | Partial. |
| D15 (DDD freeze failure) | Pilot T1 reproduced it on real trees | Red until decided and the fix is tested. |
| S5 (no-hint arm) | Probe 2's pre-stated rule | Red until the author decides. |
| S6 (per-rule advisory) | `advisoryByRule` merged (#142) | To be re-verified on a live record. |
| V7 (judge) | CHECK-2 ran: NOT CANDIDATE | Decision input exists. Red until v1 is frozen in writing ([W] allows dropping the judge). |
| V9 (MCP agreement) | Probe 1 found the `check_import` defect and the two-verdict defect | Red. |

**Validity dependency (gate V3–V6, V8, V10).** The blocking outcome means "violations of the declared rules", and that meaning rests on the sealed hold-out, which has **not run** (validity strategy §1, 2.3). The non-human strands so far are:

- mechanical correctness: 0 incorrect of 2,669 checkable, development data;
- engine parity: 0 content differences;
- convergent agreement: κ 0.913–1.000;
- mined fixes: no robust signal;
- predictive validity: pending.

Study 2 may claim effects on **rule violations**, and on "architectural quality" only as far as the validity chapter supports it. Gate V4 is per style and has no waiver. A Study 2 style that the hold-out only "characterises" cannot use the blocking outcome.

## 10. Research question (unchanged from v1)

Q1 (main): does feedback reduce the erosion slope? Q2: tools against gate. Q3: repair rate and cost. Q4: generalisation to held-out rules and dependency-cruiser.

The floor evidence changes what a likely answer looks like, not the questions. If the zero branch holds, Q1 is asked of the advisory rate. If Study 2 does not run (§4.3), the questions are reported with the design and readiness evidence as future work.

## 11. What could still make us run it twice

Each risk names the event that would tempt a second run, and the mitigation that keeps the single run usable or stops it before it starts. "Gate" names the readiness-gate line that carries the mitigation.

| # | Risk | Why it would tempt a re-run | Mitigation |
|---|---|---|---|
| R1 | **Floor in every arm.** No arm produces blocking erosion, so the contrast is degenerate. | "The tasks were too easy; run again with harder ones." | Task requirements T1–T3 before sealing; the pilot decision (§4) taken first; A24: a degenerate null is the pre-declared result. Gate D1 stops a run that the pilot shows is at the floor. |
| R2 | **The primary outcome is changed after data are seen.** | Re-running "with the right outcome". | Memo §5 is applied mechanically (§4.2). v2 amends nothing. Gate rule 1: criteria cannot be relaxed after data. |
| R3 | **Runs or steps cannot be scored** (a T1-like freeze or pipeline failure on real trees). | Lost cells look like a failed study. | Gate D15 and S7 (0 evaluation errors on real trees in the dress rehearsal); task requirement T7; keep every snapshot; re-score, never regenerate (§2.3). |
| R4 | **Telemetry is missing** (advisory per rule, coverage, call log, Q4 measures, pause time). | Tables cannot be produced. | Gates S6, D6, D13, D16, S1 must be green in the dress rehearsal; fixed re-scoring scripts are hashed before the run; the analysis script reads only the out-root. |
| R5 | **Interruption mid-run** (usage limit, crash, machine loss). | Restarting from scratch "for cleanliness". | Resume on the same out-root (§2.2); gate D14 live resume; finish the #180 fault drills (11 / 13 today) to 13 / 13; usage-limit pause policy (S1). |
| R6 | **CLI or model drift during the run.** | Mixed versions make cells incomparable. | Pinned versions refused on mismatch, auto-update off (gate S2, PR #171); arms interleaved in seeded blocks. |
| R7 | **Ambient configuration reaches the generator** (as TV-95 in E1). | Contaminated runs. | Gate S3 isolation (dedicated config dir and HOME, env allow-list, canary probe). |
| R8 | **The MCP tools disagree with the scorer.** | `daedalus-mcp` turns out to be a different treatment. | Gate V9 and §3.3: fix and prove 100 % agreement per style, or drop the arm or style before the first call. |
| R9 | **A confinement breach with the MCP server attached.** | The arm's runs are invalid. | Gate S4 for each CLI; drop an untested CLI from the arm. |
| R10 | **The instrument changes after the freeze** (a fix found mid-run). | "Re-run on the fixed tool". | Tunables manifest and verifier (PR #173, gate S11). Fixes go to the development set; kept snapshots are re-scored and the re-score reported (§2.3); no flags flipped (gap plan §4). |
| R11 | **The hold-out fails for a Study 2 style after Study 2.** | The outcome's meaning collapses for that style. | Hold-out before the dress rehearsal (gate order; V3, V4 with no waiver). A style that is not validated does not use the blocking outcome. |
| R12 | **Underpowered null.** | "Run a bigger one". | Gate D3 before the run. Choose the largest affordable grid (§6.2), and pre-declare that a null at the registered N is the answer. |
| R13 | **Analysts disagree on the numbers.** | Re-analysis disputes can look like a failed study. | A1–A26 fixed (§7); script hashed; rehearsal re-run at the run commit (D9); seeds and flips fixed (A12, A13). |
| R14 | **Sealed tasks leaked or contaminated.** | The run is compromised. | Gates S14, V11, D2; unsealer audit (PR #174); the coordinator who wrote the tasks does not run, monitor or score generation (V10c). |
| R15 | **Feature dropping or gaming** lowers violations. | The effect is not credible. | Acceptance checks (T8, gate D12), coverage share and import-kind guards (D13), reported beside every count. |
| R16 | **The budget runs out mid-grid.** | A partial grid. | Gate D4 stop rule: complete blocks only, never partial arms; ≥ 20 % budget margin; ≥ 1.1 × N (D3). |
| R17 | **The judge changes, or is questioned.** | Secondary outcomes are disputed. | v1 frozen (V7). The judge is never primary. No v2.3 or CHECK-3 (gap plan Decision 2). |
| R18 | **The engine of record differs from the interpreter.** | Numbers do not reproduce. | Neo4j is the engine of record; interpreter parity on Study 2 snapshots (gate D8). |
| R19 | **Construct decisions answered after the data.** | Re-scoring "with the right construct". | Gate V1: Q1–Q25 answered before the freeze; ADRs merged. |
| R20 | **Critique on vendor or same-agent grounds.** | "Replicate with a non-Claude generator". | Gate V10 ([W] only for b): a non-Claude generator inside the single run; limits stated. A replication would be a separate, labelled study. |
| R21 | **The decision flips on the Monte Carlo seed.** | Re-running the analysis until it "settles". | A12: fixed seed, 99 999 flips, rule for p near α. |
| R22 | **The DDD pilot decision is never reached.** | Running Study 2 with the outcome undecided, then switching. | Fix T1 and score DDD before the pre-registration (§4.2). Until then the blocking default holds, and no outcome switch is allowed after the Study 2 data. |

## 12. Pending items (summary)

1. DDD pilot scoring after the T1 fix → memo §5 branch (§4.2).
2. The task-design guide (`v1.3-task-design`) and the author's decision on the task set (§5).
3. A power re-run, its source for θ, and the grid (§6.2).
4. Arm-set decisions: S5, placebo, `gate` under the zero branch, per-task MCP spec (§3).
5. MCP tool fixes and agreement (V9), confinement (S4), call log (D6) (§3.3).
6. A rehearsal re-run on the post-#142 record format, plus the A7 and A9 checks (§7).
7. The sealed hold-out run and the FR-V11 report (V3, V4); the predictive-validity result.
8. The gate PR #146 merged, then every line green or waived at the run commit, and signed by the author (§9).
9. Only then the pre-registration (a separate, author-approved step), and Study 2, once.
