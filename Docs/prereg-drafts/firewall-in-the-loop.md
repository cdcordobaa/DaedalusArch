# Pre-registration draft — v1.3 firewall in the loop (DRAFT, NOT REGISTERED)

> **Status: DRAFT. Not registered.** Written 2026-10-12 on branch `v1.3-mcp-loop`, with the MCP tools of
> `src/mcp-server/` and the arm harness of `scripts/lib/generators/arms.ts`, before any generation of this
> experiment. Nothing here is in `REGISTERED_ARTEFACTS` (`scripts/lib/prereg.ts`); `corpus/prereg.json` is
> unchanged; no arm has been run and no model has been called. It becomes binding only through a new
> `corpus/prereg.json` version with a reason (BR-U5b-50), after the open items of §11 are closed and this status
> line is replaced. Until then every number below is a proposal.
> **Relation to earlier text.** Refines `Docs/mcp-firewall-in-the-loop.md` (the v1.3 design note): the A3 arm
> (`evaluate_project` available to the agent) is dropped for scoring leakage (§9, T4), so there are three arms; the
> primary outcome is symbolic-only; outcomes, analysis, threats and budget are made specific.
> **Conventions.** Follows `Docs/analysis-plan.md`: permutation tests with registered seeds, Holm families, cluster
> bootstrap intervals, effect sizes with Cliff's δ, stored figures at full precision, `ci_method` named on every
> interval. Where this draft is silent, the registered plan's rule applies.
> **Instrument.** The scorer is the frozen v1.2E instrument (instrument v2, `corpus/frozen-instrument.json`), spec
> `specs/clean-arch.yaml`, `evaluate` symbolic-only, the E1 per-run tsconfig (ADR-032). This experiment changes no
> rule, template, weight, threshold or spec.

Sections: §1 research questions; §2 arms; §3 design and size; §4 outcomes; §5 analysis; §6 missingness and
exclusions; §7 process data; §8 what the treatment is; §9 threats and mitigations; §10 budget; §11 open items before
registration; §12 what is fixed by registration.

## 1. Research questions

E1 gives a coding agent the architecture once, in the prompt (spec levels `none`, `minimal-prose`, `full-aac`). This
experiment manipulates a second channel: **architecture feedback the agent can query while it writes code.**

| Id | Question | Contrast | Status |
|---|---|---|---|
| **RQ1** | Does in-loop architecture feedback reduce the violations the frozen firewall finds in the finished project? | A2 `daedalus-mcp` vs A0 `none` | confirmatory |
| **RQ2** | Does in-loop feedback (constraints and verdicts) beat a context-only tool (project structure, no rules)? | A2 vs A1 `context-graph` | confirmatory |
| RQ3 | Does a context-only tool by itself change violations? | A1 vs A0 | secondary |
| RQ4 | Does the effect reach rules the tools do not check (held-out rules)? | A2 vs A0 on the held-out count | secondary |
| RQ5 | What does the feedback cost (tokens, money, wall time, turns)? | A2 vs A0, A2 vs A1 | secondary |

Hypotheses (two-sided tests; the direction is stated for interpretation only): H1, A2 has higher `ahsDeterministic`
and fewer violations per KLOC than A0; H2, A2 has higher `ahsDeterministic` and fewer violations per KLOC than A1.

## 2. Arms

Same tasks, models, spec levels, prompts and confinement in every arm. The manipulated factor is the MCP server
loaded and one tool sentence appended to the frozen E1 prompt (`ARM_TOOL_SENTENCES`, matched in length within 5 %).

| Arm | MCP server | Tools allowed (exact names) | Tool sentence |
|---|---|---|---|
| **A0 `none`** | none (`--strict-mcp-config`, no `--mcp-config`): the E1 argv byte for byte | — | none |
| **A1 `context-graph`** | one third-party context tool, pinned (candidate: Serena's read-only symbol tools, or graphify); §11 item 1 | its read-only tools only; write, shell and network tools denied | "…tools … that describe the files, symbols and imports of this project…" |
| **A2 `daedalus-mcp`** | `daedalus-arch` (`dist/mcp-server/main.js` at a recorded commit, `--spec` = the evaluator spec, `--project` = the run cwd) | `get_architecture_spec`, `which_layer`, `check_import`, `explain_violation`, `check_file`, `check_diff`, `suggest_placement`; `evaluate_project` denied | "…tools … that check code against the architecture of this project…" |

The argv of each arm is printed, without running anything, by `npx tsx scripts/generator/arms-dry-run.ts` (`--all`
for every cell). Every arm keeps the BR-U5a-41 confinement set: `--safe-mode`, `--restricted`, the exact tool list,
the single exact Bash rule, `--permission-mode acceptEdits`, `--permission-prompts none`, `--no-session-persistence`,
`--strict-mcp-config`; `checkArmArgs` asserts no forbidden flag, one MCP config at most and exact `mcp__` rules.

**A1 is chosen for popularity, not built.** The comparison is with what a developer would install today. If no
candidate passes the confinement probes (T7) with a read-only tool subset, A1 is dropped before registration and RQ2
is reported as not tested; it is never replaced after data are seen.

## 3. Design and size

**Factors.** Arm (3) × model (3: the E1 Claude pins `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5`) ×
spec level (2: `none`, `minimal-prose`) × task (2: `task-management`, `order-fulfilment`) × run (R). `full-aac` is
not crossed: it puts the whole preset in the prompt, so A2 has nothing left to teach and the level would bias RQ1 and
RQ2 toward the null by construction. The Codex arm of E1 is not included (its MCP wiring differs; a later extension).
Style `clean-architecture`, the E1 prompt templates (`scripts/generator/prompts/*.md`, unchanged).

**Unit and blocking.** One generation in a fresh cwd. A **block** is one (model, level, task, run) tuple; its three
arms run back to back in a seeded order inside the block, so model-side drift during a session window hits all arms
of a block alike. Blocks are scheduled with a new `orderSeed` (mulberry32, as BR-U5a-51). The paired unit of every
contrast is the block; the 12 (model, level, task) combinations are strata.

**Size.** R = 3 gives 36 blocks and **108 generations**; R = 5 gives 60 blocks and **180 generations**. The draft
proposes **R = 5** and registers R = 3 as the floor if the budget (§10) binds; the choice is made at registration,
before any generation, and is never revisited.

**Size rationale.** No effect size for in-loop feedback on these tasks is known, and E1 has no registered result yet
that this draft may read, so the rationale is a minimum detectable effect, not a powered test of a guessed effect.
For a paired contrast over n blocks, two-sided, the Holm family of four (§5) taken at its strictest step
(α = 0.05 / 4 = 0.0125, z = 2.50) and power 0.80 (z = 0.84), n ≈ ((2.50 + 0.84) / d_z)², where d_z is the
standardised mean within-block difference:

| R | blocks n | minimum detectable d_z (strictest Holm step) | at the last Holm step (α = 0.05) |
|---|---|---|---|
| 3 | 36 | 0.56 | 0.47 |
| 5 | 60 | 0.43 | 0.36 |
| 8 | 96 | 0.34 | 0.29 |

The sign-flip permutation test used in §5 has power close to the paired t-test at these n. The rows assume
independent blocks; runs of one (model, level, task) share a stratum, so the effective n is lower when stratum
effects interact with arm. The pilot (§10) estimates the within-block standard deviation of `ahsDeterministic`; if
that estimate puts the R = 5 minimum detectable difference above 0.10 AHS, R is raised before registration (up to the
budget ceiling of §10), never after. The pilot's arm differences are not looked at for this decision.

## 4. Outcomes

All outcomes come from stored outputs; none needs a model call. The scorer runs on a scratch Neo4j that the agent
never reaches (A2's server has no database access: `evaluate_project` is denied and no Neo4j variable is in the child
environment).

| Role | Outcome | Definition |
|---|---|---|
| **Primary** | `ahsDeterministic` | the frozen symbolic-only AHS of the finished project (instrument v2, `specs/clean-arch.yaml`) |
| **Co-primary** | violations per KLOC | symbolic violations of every active function / (non-blank, non-comment TypeScript lines under `src/`, test files excluded, / 1000); the line counter is a registered script (§11 item 4) |
| Secondary | checked-rule violations | count of FF-S01, FF-S04, FF-P01, FF-CV02, FF-CV03 (the rules `check_file` evaluates on this spec) |
| Secondary | held-out violations (RQ4) | count of every other active symbolic function, FF-S02 cycles included; the set is fixed at registration from the compiled spec |
| Secondary | verdict | pass / warning / soft-block / hard-block, as an ordinal |
| Secondary (RQ5) | generation cost | `total_cost_usd` of the CLI envelope (API-equivalent; the runs use the subscription login, D-1), input, cached and output tokens from `modelUsage`, `num_turns` |
| Secondary (RQ5) | generation time | envelope `duration_ms` and wall-clock seconds of the CLI call, retries excluded, interruptions recorded apart |
| Guard | type-check | the E1 harness `tsc` of record passes (BR-U5a-48) |
| Guard | layer coverage | share of `src/` source files that match no layer glob (an escape route from every layer rule; T1) |
| Guard | file range | `file_count` and `file_count_in_range` as E1 |
| Guard | independent measure | violations found by dependency-cruiser 18.4.0 with the ADR-030 translation of the same spec (`scripts/depcruise-translate.ts`) |

Violations are counted, not labelled: no labeller and no judge is part of any outcome. The `full`-mode judge is not
run (it would add a Claude judge reading Claude output, T6, and calls with no bearing on the questions).

## 5. Analysis

**Confirmatory family (Holm, α = 0.05).** Four tests: {C1 A2 vs A0, C2 A2 vs A1} × {`ahsDeterministic`, violations
per KLOC}. Each is a paired sign-flip permutation test on the within-block difference (10 000 permutations, the plan's
`permutation` seed), signs flipped within the 12 strata; the statistic is the mean difference. If A1 is dropped
(§2), the family is the two C1 tests.

**Effect sizes.** Mean within-block difference with a 95 % cluster percentile bootstrap interval (10 000 resamples,
blocks resampled within strata, the plan's `bootstrap` seed; `ci_method = block-bootstrap`), and Cliff's δ between
the arms' values. Violations per KLOC is also reported as a ratio of means with the same bootstrap.

**Secondary (each its own Holm family of the listed tests, labelled exploratory).** RQ3 (A1 vs A0, two outcomes);
RQ4 (held-out count, C1 and C2); checked-rule count (C1, C2); verdict (C1, C2; a sign-flip test on the ordinal
difference); RQ5 cost and time (C1, C2; log ratio within block, bootstrap interval on the geometric-mean ratio).
Descriptive only, no test: arm × model and arm × level profiles, per-stratum means, the guards.

**Intention to treat.** Primary analysis on every valid generation as randomised, whether or not the agent called a
tool. Per-protocol (generations with at least one call to the arm's tools, from the call log, §7) is secondary and
descriptive; the gap between the two is reported as an adoption result.

**Reading the result.** RQ1 is supported when a C1 test survives Holm with a difference in the hypothesised
direction on that outcome. RQ2 likewise for C2. A C1 effect with no RQ4 effect and no dependency-cruiser effect is
reported as rule compliance on the checked rules, not as better architecture (T1).

## 6. Missingness and exclusions

A generation that fails (`GEN-*` codes of `Docs/analysis-plan.md` §1) gets no AHS. **Primary:** complete blocks only
(all arms valid); the number of incomplete blocks per arm is reported. **Sensitivity:** every valid generation,
unpaired (arm labels permuted within strata), and a worst case where a failed generation scores AHS 0 and the
95th percentile of violations per KLOC of its stratum. A generation whose MCP server failed to start (detected from the
call log or the CLI's MCP status) is `GEN-INFRA` and retried once under BR-U5a-50; a second failure is a missing cell. Cost and
time are analysed on every attempt, failed ones included. Pilot generations never enter the analysis.

## 7. Process data (needed before registration, §11 item 3)

A call log per generation, outside the cwd, append-only: tool, arguments hash, result verdict, timestamp. Derived:
calls per tool, first call before or after the first write, `check_file`/`check_diff` violations later cleared vs
left, the share of calls that returned `unknown`. Reported descriptively per arm, model and level.

## 8. What the treatment is

The treatment is the A2 server at a recorded commit, the tool names and descriptions it lists (hashed), the tool
sentence, and the allow-list. It reads the spec only. It sees the same spec the scorer uses, so under `none` the
agent can learn the full layer model through `get_architecture_spec`; the report states that A2 × `none` is "spec on
request", not "no spec".

## 9. Threats and mitigations

| Id | Threat | Mitigation |
|---|---|---|
| T1 | **Gaming the checker (construct).** The agent may satisfy `check_file` without better structure: `require()` or `import()` (counted, not modelled by the extractor), files placed outside every layer glob (layer rules do not apply), re-export barrels, string-built specifiers, aliases left `unknown`. | The scorer is the graph pipeline, not the lexical checker. Pre-registered guards: layer-coverage share, counts of `require`/`import()` calls and of barrels per project (from the stored tree), the held-out rule set (RQ4), the dependency-cruiser measure. Any guard that differs between arms at p < 0.05 (exploratory) is reported beside the primary result. `check_file` reports `require`/`import()` hits as advisories so the tool does not teach the escape. |
| T2 | **Circularity (construct).** The spec that defines the treatment also defines the score; a C1 effect can mean only that the agent followed the firewall's rules. | Held-out rules; the independent dependency-cruiser measure; a blind review of a seeded sample of 24 projects (8 per arm) by a reviewer who sees neither arm nor score, coded with a fixed rubric (§11 item 6); the write-up names the construct as rule compliance unless RQ4 and the independent measure agree. |
| T3 | **Self-preference (allegiance).** The authors built DaedalusArch and choose A1; a weak A1 setup would favour A2. Also, a Claude judge would favour Claude output. | A1 is a popular tool used as shipped, with descriptions matched in length and style (T3 of the design note), configured and probed before any A2 generation; no LLM judge in any outcome; scoring is mechanical and blind to arm (arm is joined only after scoring); this draft and the analysis code are registered before any generation. |
| T4 | **Scoring leakage.** `evaluate_project` would let the agent read the scorer's exact objective. | Denied in A2 by `--disallowedTools` and absent from the allow-list (A3 of the design note dropped). `get_architecture_spec` still exposes rule ids and thresholds: reported as part of the treatment (§8). |
| T5 | **Tool fidelity (internal).** If `check_file` disagrees with the graph, A2 is a different treatment than described. | Registered fidelity check before any generation (§11 item 2): on every import edge and class of the `fixtures/` and corpus projects, `check_file` vs the graph's FF-S01/S04/P01/CV02/CV03 verdicts; acceptance 100 % agreement on resolvable edges, the rest listed. |
| T6 | **Prompt and description confounds.** | One sentence per arm, matched in length (tested within 5 %), hashed; tool descriptions hashed; any wording change is a new version. |
| T7 | **Confinement.** An MCP server widens the agent's surface. | Server paths and spec outside the cwd (`ARM_PATH_INSIDE_CWD`), exact tool names, `--strict-mcp-config` kept, no credentials in the child env, the five E1 confinement probes re-run per arm with the server attached; whether `--tools` restricts MCP tools in the pinned CLI is verified by a probe, not assumed. |
| T8 | **Adoption.** Agents may ignore the tools. | ITT primary, per-protocol secondary, call log (§7). No extra nudge beyond the one matched sentence. |
| T9 | **Model and CLI drift.** | Pinned model ids and CLI version in the plan, recorded per run; arms interleaved within blocks. |
| T10 | **Ceiling.** If A0 already scores near the pass threshold, arms cannot separate. | The pilot reports A0's per-stratum spread (not arm differences); a stratum whose A0 pilot projects all pass with zero violations is flagged and kept (no post-hoc dropping); the report states the ceiling share. |
| T11 | **Multiplicity and forking paths.** | One confirmatory family of four tests; all other tests labelled exploratory with their own Holm families; analysis script registered with the plan. |
| T12 | **External validity.** | Two greenfield tasks, one style, TypeScript, headless Claude Code only. No claim about brownfield code, editors, other styles or other vendors. |

## 10. Budget

Generations run under the subscription login (D-1), so the binding limit is the usage window, not money;
`total_cost_usd` gives the API-equivalent figure. The E1 Claude pilot took 428 s for three generations (about 2.4 min
each, `Docs/generator-protocol.md` §10). Per-generation API-equivalent cost is **not yet measured**; the pilot
envelopes provide it. The table uses an explicit assumption, c̄ = 2 to 6 USD API-equivalent per generation averaged
over the three models, plus 30 % on the two tool arms for their extra turns (an average of +20 % over all arms), to be replaced by the measured pilot mean.

| Item | R = 3 | R = 5 |
|---|---|---|
| Generations (3 arms × 3 models × 2 levels × 2 tasks × R) | 108 | 180 |
| Pilot (one block per model, 3 arms, `task-management`, `none`), excluded from analysis | 9 | 9 |
| Confinement probes with the server attached (5 per tool arm) | 10 | 10 |
| API-equivalent cost, generations + pilot (assumption above) | about 280–840 USD | about 450–1 360 USD |
| Generation wall time at 3–8 min each, sequential | about 5–15 h | about 9–24 h |
| Scoring (symbolic-only `evaluate` + dependency-cruiser, about 2 min each) | about 4 h | about 6 h |
| Labelling, judge calls | 0 | 0 |
| Engineering before registration | A1 provider and probes; call log; fidelity check; LOC counter; analysis script (§11) | same |

Ceiling: if the pilot's measured mean puts R = 5 above the available usage windows over three weeks, R = 3 is
registered.

## 11. Open items before registration

1. **A1 provider.** Pick the context tool, pin its version, implement `ContextGraphProvider` (`scripts/lib/generators/arms.ts`), list its read-only tools, pass the confinement probes.
2. **Fidelity check (T5)** run and stored under `Docs/DiagnosticRuns/`.
3. **Call log** in the server (or a logging proxy), outside the cwd.
4. **LOC counter** script for violations per KLOC, with tests.
5. **Experiment plan** `experiments/mcp-loop/plan.json` and generator plan: model pins, CLI version, `orderSeed`, R, arms, seeds (proposal: 9101 / 9102 / 9103), the A2 server commit and the hashes of tool descriptions and sentences.
6. **Blind-review rubric** (T2) and its sampling seed.
7. **Generator protocol addendum**: the arm argv, the MCP config files, the probe results; the `generate-projects` path that runs a non-`none` arm (today only the dry run exists).
8. **Pilot** (§10), read only for cost, time, the A0 spread and process failures.

## 12. Fixed by registration

This file (finalised), the arm harness and server at their commits, tool descriptions and sentences, the experiment
and generator plans, the held-out rule set, the LOC counter, the analysis script, R, the A1 choice. Every later change
is a new `corpus/prereg.json` version with a reason; runs keep their own `preregVersion`.
