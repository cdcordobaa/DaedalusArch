# Study 2 floor-escape design (2026-10-16)

Synthesis of five floor-escape proposals and their ten adversarial reviews (two Fable lenses per proposal: construct validity and fairness, feasibility and run-once risk). All evidence below was reproduced by the reviewers against origin/v1.3 and the named PR branches; this document does not add new measurements. Where a proposal's claim was found wrong by a reviewer, the corrected form is used here.

## 1. The problem in numbers

Study 2 compares coding-agent arms (none, gate, daedalus-mcp) on a primary outcome that counts blocking architectural violations the agent introduces. Every measurement of agent-written code so far sits at or near zero on that outcome.

| Source | What was run | Blocking violations | Where |
|---|---|---|---|
| E1 (Study 1) | 4 models (Opus 5.5, Sonnet 5.5, Haiku 4.5, GPT-5.6) x 3 spec levels (none, minimal-prose, full-aac), Clean Architecture, layout hint in every arm | 0 in all 65 accepted cells; 0 of 72 overall | origin/v1.3: Docs/v1.3/study1-addenda.md A1; Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md; experiments/e1-grid/plan.json |
| Agent proof (PR #156) | Opus with the MCP tools, 5 tasks | 0 defining violations; the seeded 3 -> 0 case used evaluate_project, which the Study 2 arm denies; per-file tools never used | Docs/v1.3/agent-proof-2026-10-16.md |
| Loop pilot (PR #170) | Headless Sonnet 5.5, Clean and Hexagonal, none and gate, k = 4, 24 step turns, 6.34 USD | 0 at every scored step in both arms; gate fired on 0 of 8 scored steps; DDD unscored (defect T1, empty aggregates); advisory per-KLOC slopes without FF-CV05 are -0.50 and -0.58 | origin/v1.3-pilot-run: Docs/DiagnosticRuns/v1.3-loop-pilot-2026-10-16.md; experiments/loop-pilot/run-2026-10-16/analysis/steps.json |
| Floor probe 1 (PR #161, merged) | One Claude session by hand, Hexagonal and Layered, several pressure families | Hexagonal 0/14 steps; Layered 14/14 steps with a blocking finding, raw step-1 level 4/3/6 (2/2/4 distinct edges after FF-S01/FF-S03 dedup); 4/22 later-step new findings, all replications of step-1 habits; 96/96 labelled correct | Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md sections 3.2 to 3.7, 5.1 |
| Floor probe 2 (PR #182) | Layout (C1), style-only (C2), spec-only (C3) levers | 1/24 overall: C1 1/8 (one FF-S02 cycle), C2 0/8 with 19/28 hexagonal files unmapped, C3 0/8 | origin/v1.3-floor-probe-2: Docs/DiagnosticRuns/v1.3-floor-probe-2-2026-10-16.md; results/v1.3-floor-probe-2/summary.md |
| Precedent probe (PR #189) | One planted shortcut in a clean 181-224 LOC tree with an existing port, Opus | 0/8 planted vs 0/8 control; 16/16 port use | origin/v1.3-precedent-probe: Docs/DiagnosticRuns/v1.3-precedent-probe-2026-10-16.md |

Human-written code is the only place the instrument has observed blocking violations at volume: 283/283 blocking findings labelled correct on 15 wave-1 repositories (PR #167, deterministic check-correct.ts, negative control 500/500), 30 of 35 pooled projects fail with a median of 6 blocking findings per project (PR #181), with the caveat that a blind second spec author flips 5/15 verdicts (PR #186, verdict kappa 0.21) and that 189/208 FF-S02 rows are barrel-routed. PR #209 shows human violations are built in while the structure is being written, not propagated steadily during extension.

What the floor costs: the base-rate sweep in Docs/v1.3/study2-task-design.md section 5 (PR #201) needs about 1.5 new distinct blocking edges per later step at k = 6 for power 0.80 on a slope outcome, and a step-1 level of 4 drops slope power to 0.24. The advisory fallback (pilot memo section 5 zero branch) has power at or below 0.08 in every option (PR #119). Readiness gate D1 cannot pass under the zero branch. Study 2 runs once.

The common finding of all ten reviews: the floor is a property of the estimand on the tasks used so far. A strong agent given a style name and a layout sentence, writing in memory over HTTP in a clean tree, introduces no defining violations in Clean or Hexagonal. Where violations appeared (Layered, probe 1), they were set at step 1 and replicated, not accumulated. Any design that keeps an incidence slope on greenfield Clean or Hexagonal tasks stakes the single run on a zero.

## 2. Ranking of the proposals

Scores are the two reviewers' scores (validity, feasibility); the mean orders the table.

| Rank | Angle | Scores | Mean | Fatal flaws found | Verdict |
|---|---|---|---|---|---|
| 1 | horizon-spec: spec rung x arm factorial, level outcome, confirmatory strata where the style's defining rules conflict with agent defaults | 4, 6 | 5.0 | Layered base rate is partly a preset artefact (no composition-root slot in presets/layered.yaml; FF-S01 half is type-only interface imports); H2 (none@L2 vs mcp@L2) contains H1 because the MCP arm also receives the spec and an attention instruction; the reference cell withholds the rules by design; DDD base rate unmeasured and L4 undefined for the frozen-from-step-1 DDD spec; 2 models in 2 weeks infeasible; memo section 5 bypassed before its result was read | Adopt, with the repairs in section 3 |
| 2 | task-design: persistent-stack (TypeORM) task family | 4, 4 | 4.0 | Only domain-file imports of typeorm are scorable (cypher-templates.ts: domain-purity is the sole Package-edge template), so three of four pressures score nothing; the lever is one decorate-or-not decision at step 2, a level not a slope; the task is built around a package literally named in the rule; the stack sentence fails hint-audit.mjs (sql.js FAIL) and the checklist; D12, T1 and skeleton hashing are unbuilt dependencies | Do not adopt as the lever. Keep the diagnosis, the stage-0 instrument probe and the sensitivity-analysis pattern |
| 3 | agent-conditions: fast tier as stratum; reject caps, context limits, plan mode | 4, 4 | 4.0 | Adoption rule keys model inclusion to the violation count (outcome-conditioned selection); 8 later steps per model cannot decide anything; duplicates floor probe 3 with a different k; by its own verdict does not move the floor | Adopt the rejections, ITT reporting and an a priori model list; drop the pilot rule |
| 4 | brownfield: precedent dose on human repositories | 4, 4 | 4.0 | pvarentsov's 18 FF-S01 fall to 0 under author B (PR #186) and luizomf 9 -> 3, so the examples die under the proposal's own consensus filter; V >= 1, P = 0 preferentially samples contested cross-cutting mappings; the frame "follow the architecture the project already uses" instructs the control arm into the outcome; wave 2 unlabelled; 5-7 weeks of harness work | Not for Study 2. Candidate for a separately registered exploratory sub-study |
| 5 | outcome-measure: inherited-burden residual on human baselines | 4, 3 | 3.5 | Burden is distance from a preset the project never adopted (humans remove FF-S01 at 0.65x the unflagged rate, FF-S04 never, PR #168); REPAIR_TEMPLATE is a file:line work order, so gate vs anything is a tautology; filtered baseline pool is 3-4 repositories, none hexagonal; the harness cannot start from a non-skeleton tree, cannot type-check the external set and cannot run its acceptance checks; 6-10 weeks | Reject as the primary. Keep the self-review placebo, resolved-by-removal tally and co-reporting; the sub-study form is viable after Study 2 |

## 3. The recommended design

Study 2 becomes a spec-rung x arm factorial with a level outcome at horizon k, confirmatory only in strata whose defining rules conflict with an agent's default layout, with the information-held-constant contrast promoted to confirmatory and an attention sentence equalised across arms. It is the horizon-spec proposal with the repairs its reviewers asked for and three grafts.

### 3.1 Order of operations (governance first)

1. Apply pilot memo section 5 mechanically before anything else. The T1 freezer fix is merged (PR #142); the open item is the D15 construct decision (what a DDD spec says when the step-1 tree has no aggregate folder). Decide D15 on the development set, re-freeze the 8 kept DDD pilot snapshots from their recorded step-1 commits, score them, and record the section 5 branch. This costs no model call and half a day. Skipping it hands an examiner "the pre-committed rule was abandoned before its result was read".
2. Write a dated design amendment. Outline v2's header states nothing is pre-registered yet, so this changes a plan, not a registration. It cites only development-task and none-arm evidence (section 1 above), keeps the memo's slope outcome as a registered secondary, and retires the sealed 6-task greenfield list unread with the reason stated.
3. Repair the instrument where the reviewers found artefacts (3.6).
4. Run the validation pilot (section 4).
5. Write and seal the confirmatory tasks (3.3), run the power simulation (3.7), pass the readiness gate, dress-rehearse, pre-register, run once.

### 3.2 Arms

Two arms, crossed with spec rungs.

- none: the frame carries the style sentence, the layout sentence (STYLED_*_TEMPLATE, unchanged), the rung content, and one attention sentence.
- daedalus-mcp: the same frame plus the 9 spec-only MCP tools; evaluate_project denied; neural tools out (outline v2 section 3.2).

The gate arm is dropped (outline v2 section 3.4): a post-hoc repair turn lowers the count mechanically, and on the pilot it fired on 0 of 8 steps.

Attention sentence (graft from the outcome-measure review's placebo logic): arms.ts today gives only the MCP arm the instruction "use them while you work". A matched sentence goes into every arm's frame, identical across arms and rungs, for example "Check your work against the architecture described here as you go." Hint-audited. The arm difference is then tool availability alone.

### 3.3 Spec rungs and tasks

Rungs are frame content only, identical across arms within a rung, each checked by hint-audit.mjs with a rule for L3/L4 frames defined before the first pilot (today frame mode treats layer names as WARN only under --frame-may-name-layout, and L3 sentences name layers and imports).

- L1: style sentence only. Not run; declared construct-invalid on probe 2's 19/28 unmapped files.
- L2: style + layout sentence. Today's frame.
- L3: L2 + one plain sentence per blocking rule of the style, sourced from RULE_PLAIN in scripts/lib/loop/prompts.ts and rule-tiers.md at its sealed hash. No fix instructions ("move X to Y") per task-design section 3.2.
- L4: L3 + the evaluator spec file in the cwd. Labelled "spec = test oracle" (methodology review B5), with a file-read check so L3 vs L4 is interpretable.

Cells per block: none@L2, none@L3, none@L4, mcp@L2, mcp@L4. Five cells.

Strata, by a criterion fixed in advance (task-design T3, probe 1 section 5.1: defining rules conflict with the agent's default layout):

- Confirmatory: Layered (strict layering, FF-S03 blocking only there) and DDD (FF-DS02 context isolation), each conditional on passing the section 4 pilot.
- Descriptive zero control: Hexagonal at L2 only, with its expected zeros declared in advance (0/14, 0/4, 0 in the pilot). Clean is reported from E1 and the pilot as a second declared zero, not re-run.

Tasks: 4 confirmatory tasks (2 Layered, 2 DDD) written by the author to T1-T10, hint-audited, hashed, with sealed per-step acceptance checks (T8, PR #200 runner). The writer is barred from running or scoring (V10c). Domains are checked against the retired sealed list and the rehearsal fixtures. Step 1 stays in memory over HTTP (keeps the step-1 level the design measures, and the only implementation sentences, per checklist section 4.1 item 5). The in-memory limitation is declared in the outline as a threat to ecological validity, with the task-design proposal's evidence (FF-P01 34 rows, FF-DT04 24 rows in human code arise from ORM decorators the greenfield tasks cannot produce). Horizon k = 4: the outcome is a level, the probes show the signal is set at step 1, and k = 6 doubles cost for nothing.

### 3.4 Outcomes

Primary, per run: Y = distinct blocking violating edges present in the step-k snapshot.

- Blocking tier at its sealed hash. FF-S01 and FF-S03 on the same edge count once (A26); a cycle counts once as its sorted file set.
- Only findings that check-correct.ts labels correct count.
- ITT: every snapshot is scored whether or not it type-checks; completion, type-check errors, skeleton integrity and unmapped-file share (10 % flag, kept) are reported beside every count (A21, D13).
- Edge kinds are reported separately and pre-declared: in Layered, "persistence imports entity types from business" (FF-S01, type-only) and "entry file wires repositories" (FF-S03, presentation -> persistence) are different constructs, and a result driven by one kind is reported as such.

Pre-registered secondaries:

- The memo section 5 outcomes as registered: new blocking identities at steps >= 2 and the per-run slope; advisory per KLOC without FF-CV05.
- Sensitivity (graft from task-design): the primary reported with and without each dominant rule family, so no arm effect can hide inside one rule.
- Interaction: tool effect at L2 minus tool effect at L4.
- L3 vs L4: is one sentence per rule enough, or does the spec file add anything.
- Manipulation checks: MCP call log (D6, PR #196), L4 file-read log, per-tier tool-call counts. If a tool contrast holds without tool calls, it is reported as "no mechanism".
- Cost and wall time per cell.

### 3.5 Confirmatory contrasts and objective mapping

Block = task x replicate (x model if a second model runs). Paired two-sided block-level sign-flip, 99,999 flips, fixed seed, Holm over three:

- H1 (SO5, spec level): none@L2 vs none@L3. Does stating the blocking rules in one plain sentence each prevent the violations the agent otherwise commits? This is the informative SO5 contrast; L2 vs L4 is the oracle version and stays secondary.
- H2 (SO3, symbolic firewall as deployed): none@L2 vs mcp@L2. The ecological contrast, with attention equalised. Labelled the symbolic firewall contrast: the neural tools are out, so SO3's neuro-symbolic evidence comes from the judge validation work, not from this contrast.
- H3 (SO3, isolated): none@L4 vs mcp@L4. Both cells hold the spec; only checking differs. Pre-declared possible outcome: if none@L4 is already at zero, the design cannot detect an incremental firewall effect beyond a delivered spec, and the thesis reports that the firewall's value in this setting is spec delivery.

SO4 (validity) is carried by the instrument work the design depends on: check-correct labels on every counted finding, the hold-out gate V4, the preset repairs with ADRs, and the declared zero strata.

### 3.6 Instrument repairs on the critical path

- presets/layered.yaml: add a composition or entry slot (or exclude) by ADR with a construct reason; today the server file that wires repositories is forced into a layer and scored FF-S03 (34 of 65 FF-S03 instances in probe 1). Settle Q2 (type-only edges) and Q12 (upward adjacent edge) before the freeze. Add a guard for files outside the layout that import persistence, or the tool arm can park the composition root in src/main.ts uncounted.
- DDD: D15 decision (static spec with author-declared aggregates, or ISE from step 1 with a pre-step-1 spec equivalent for L4 and the MCP server). Without it there is no L4 and no mcp cell for DDD.
- scripts/lib/loop/style.ts: layered style and frame (presets/layered.yaml globs already fit layoutSentence) plus loop tests.
- prompts.ts: L3 and L4 frame slots; attention sentence in every arm; hint-audit rule for frames.
- plan.ts: per-task MCP specPath (A25); merge PR #176 (V9 parity, check_import applying graph rules; 100 % agreement required for Layered and DDD), PR #196 (D6 call log), PR #200 (acceptance runner, start convention decided by the author); local confinement probe with the MCP server attached (S4, never done).
- hint-audit.mjs vocabulary extended (orm, typeorm, database, table, column) so any future stack sentence is audited.
- Stage-0 instrument probe (graft from task-design, zero model cost): plant a decorated domain class, a version column, DataSource in a use case, Repository without a port, QueryBuilder in logic; record graph tier, check-correct, check_file and check_import. The templates predict only the decorated-domain case is blocking; record that coverage statement in the pre-registration.

### 3.7 Grid, power, cost

Realistic ceiling: Sonnet 5.5 as the generator of record (the Codex pin is unavailable until about 2026-11-09 and no Gemini loop adapter exists; see decision 3). 4 confirmatory tasks x 3 replicates = 12 blocks x 5 cells x k = 4 = 240 step turns, plus the Hexagonal control (2 tasks x {none@L2, mcp@L2} x 2 replicates x k = 4 = 32 turns). At the pilot's 0.15-0.42 USD per turn (MCP turns run 57-230 s and carry more tokens), about 50-130 USD API-equivalent, 8-14 hours on the one lane the machine allows, more under usage-window pauses. A second model doubles all of this.

Power must be simulated, not asserted: the PR #119 model simulates slopes and does not model an arm that lowers the level. Gate D3 requires a level-outcome simulation with the pilot's measured dispersion (mean and theta per style) before k and the number of replicates are fixed. With 4 tasks, inference is to these tasks; the power notes show task-level generalisation has power 0 at six tasks, and the amendment says so.

### 3.8 Why this is not rigged toward the tool

- L3 and L4 can kill the tool's advantage. If one sentence per rule removes the Layered and DDD violations, the registered conclusion is "telling the agent the rules is enough; the firewall adds nothing beyond delivering them". That outcome is written down before the run.
- H3 holds information constant: the only difference between none@L4 and mcp@L4 is the ability to check.
- The attention sentence is in every arm, so "told to care" is not the treatment.
- Strata are chosen by a criterion fixed in advance; the Hexagonal and Clean zeros are reported as declared controls.
- The instrument repairs (composition slot, type-only edge decision) remove the artefacts that inflated the Layered base rate; they work against the design's own base rate and are made before the pilot.
- Model inclusion, k, tasks and rungs are fixed before any erosion measurement on the confirmatory tasks (section 4 uses development tasks only).
- Every counted finding carries a deterministic correctness label; every count is accompanied by completion and coverage.

## 4. The validation pilot before the single run

Purpose: measure the none@L2 base rate per confirmatory stratum on development tasks, and check that the new cells are scoreable. It never touches Study 2 tasks (T10). It is folded into the existing floor probe 3 plan (origin/v1.3-floor-probe-3: repair-cafe, school-bus, vineyard x none x k = 4 x Sonnet, no results yet) so that only one Sonnet baseline exists.

Prerequisites: steps 1-3 of section 3.1 (DDD pilot scored, amendment written, layered preset repaired and layered frame built, D15 decided, L3/L4 slots and attention sentence hint-audited).

Runs:

- Base-rate runs: ice-rink (Layered) and vineyard-harvest (DDD) from fixtures/v1.3-rehearsal-tasks, none@L2, Sonnet, k = 4, 3 replicates each: 24 step turns.
- Zero control: probe 3's repair-cafe and school-bus none@L2 runs as planned (8 turns).
- Smoke runs for scoreability only: ice-rink none@L4 k = 2 and ice-rink mcp@L4 k = 2 (4 turns). Checked for coverage, evaluation errors, V9 agreement on Layered, L4 file-read log, MCP call log and confinement. Their Y is written to a hashed sealed file and not read, so the pilot never sees H1, H2 or H3.
- Stage-0 instrument probe (no model calls).

Cost: 36 step turns, about 6-15 USD API-equivalent, 0 cash under the subscription login; about 2-3 hours wall on one lane with one capped Neo4j (heap 512m, pagecache 256m) as the engine of record, matching the loop pilot's provenance.

Go/no-go rule, per style, committed before the first call:

- Escape: mean distinct blocking edges at step 4 >= 1.5 and >= 2 of 3 runs with Y >= 1.
- Validity: unmapped-file share <= 10 % in every run; type-check passes in >= 2 of 3 runs; every counted finding labelled correct by check-correct.ts; evaluation errors 0.
- Composition: if more than 80 % of the counted edges are of one edge kind, the stratum is still admitted but the pre-registration states Y in that style as that edge kind in plain words (for example "how many entry files reach stores").
- Dispersion: report mean and theta per style; these feed the D3 simulation.

Consequences, fixed in advance:

- Both styles pass: two confirmatory strata, 4 tasks, as in section 3.
- One passes: the passing style is the only confirmatory stratum with 2 tasks; the other joins the descriptive strata. Claims scope to that style and those two tasks, and the amendment says the design collapsed to one stratum.
- Neither passes: the factorial design is withdrawn, not re-tuned. No further lever is piloted. Study 2 runs the memo section 5 branch as recorded in step 1 of section 3.1, with the degenerate null A24 pre-declared, and the thesis takes the section 5 fallback below. The pilot result is reported as the fourth greenfield floor measurement.

The smoke runs' sealed Y is opened only after Study 2 pre-registration, as a provenance record.

## 5. What the thesis claims if Study 2 still lands on the floor

Planned before the run, as the registered fallback.

1. A pre-registered, construct-valid null on the generation side: across 4 models, 65 E1 cells, the loop pilot, three floor probes, the precedent probe and the Study 2 run, strong coding agents given a style name and a layout sentence did not introduce defining architectural violations in greenfield TypeScript backends at horizons up to k. The claim is scoped to those styles, tasks, models and horizon, and the mechanism is stated: violations in agent code are set at step 1 by the layout the frame induces and are replicated rather than accumulated (probe 1), and planted precedents are not copied when a compliant route exists (#189).
2. SO4 stands on the instrument's validity on human code: 283/283 blocking findings correct on wave 1 (#167, with the negative control), 30/35 human projects failing (#181), the hold-out gate V4 result, the second-author reliability limit (#186, kappa 0.21) reported as a bound on spec dependence, and the human erosion profile (#209).
3. SO5: whichever H1 result obtains is informative. If none@L3 is at zero while none@L2 is not, a one-sentence rule statement is sufficient on these styles; if both are at zero, spec level did not matter on the measured range, and E1's advisory gradient (C02 0/15 vs 15/16) is the remaining SO5 evidence.
4. SO3 narrows to what is demonstrated: the symbolic firewall detects defining violations where they exist (human code, seeded code in the agent proof, inherited debt), the neural judge's validated and unvalidated behaviour (v1 false-fails 16/48 clean; v2.2 not candidate), and the ecological-validity limitation of in-memory greenfield tasks declared in the outline. The firewall is positioned as a gate against erosion that human developers demonstrably commit and that agents in this setting did not, and as a spec-delivery channel.
5. An exploratory, separately registered brownfield sub-study after Study 2 (grafts from the brownfield and outcome-measure proposals): 3-5 wave-1 baselines whose findings survive both spec authors and check-correct, dependencies installed by hand, arms none, self-review placebo and a new-only gate ratchet, no MCP arm, no acceptance services, resolved-by-removal tallied separately, barrel-routed FF-S02 excluded. Labelled exploratory. It gives the thesis a burden-reduction observation without staking the single run on an unbuilt harness.
6. Future work, named: a persistence-stack task family (stage-0 probe results attached), long-session drift with a spec given once, and a Grok or Codex arm when available.

For a meritoria jury the defensible position is a run-once study with a pilot gate, a dated amendment, declared zero controls and a null that is itself a measured mechanism result, rather than a positive result produced by a lever chosen after the floor was seen.

## 6. Author decisions

Decision 1. Primary outcome and governance order.
A) Keep the memo section 5 slope outcome and run Study 2 on it.
B) Score the 8 kept DDD pilot snapshots after the D15 decision, record the section 5 branch, then issue a dated amendment to the level outcome Y at horizon k, keeping the slope as a registered secondary.
C) Issue the amendment now without scoring the DDD snapshots.
[Answer]:
Recommendation: B. It costs no model call and removes the strongest process objection.

Decision 2. DDD construct (gate D15), which also fixes whether DDD can be a confirmatory stratum.
A) Static DDD spec with author-declared aggregates per task, usable at L4 and by the MCP server.
B) Keep ISE-from-step-1 freezing and exclude DDD from L4 and mcp cells (DDD then cannot be confirmatory under this design).
C) Drop DDD; Layered is the only confirmatory stratum.
[Answer]:
Recommendation: A, decided on the development set, with the aggregate declaration hint-audited.

Decision 3. Model factor and gate V10(a) (one non-Claude generator, no waiver).
A) Sonnet 5.5 only, with a dated V10 waiver note and the generalisation limit stated.
B) Sonnet 5.5 plus the registered Codex pin, scheduling the run after Codex credits return (about 2026-11-09); the build, pilot and gate path lands near that date anyway.
C) Build a Gemini loop adapter and confinement-probe it (new code, new S4 probe).
[Answer]:
Recommendation: B. A is the fallback if the run date slips past the pin's availability; C is not a two-week item.

Decision 4. Persistence and the ORM lever.
A) Add the TypeORM stack to the Study 2 skeleton and a go-live step to every task.
B) Run only the stage-0 instrument probe, declare the in-memory limitation in the outline, and keep step 1 in memory.
C) Run the ORM pilot on rehearsal tasks after Study 2 as a separate probe.
[Answer]:
Recommendation: B now, C as future work. A manufactures a level out of one decision and is built around a package named in the rule.

Decision 5. Brownfield burden.
A) Brownfield baselines inside Study 2.
B) Separately registered exploratory sub-study after Study 2, as in section 5 item 5.
C) Drop brownfield entirely.
[Answer]:
Recommendation: B.

## 7. Residual risks

- The Layered base rate may fall toward the floor once the preset gains a composition slot and the type-only edge question is settled, because probe 1's violations were partly those artefacts. The pilot measures this after the repair; if Layered fails, DDD alone carries the design (decision 2).
- DDD has never been scored on agent code. Its base rate is a guess (30-70 % of runs with Y >= 1) until the pilot runs.
- H2 remains open to the charge that an agent not told a rule breaks it and an agent given a checker does not. The attention sentence and H3 mitigate; the honest reading if H3 is null is that the firewall's value is spec delivery.
- L4 hands the agent the evaluator spec (B5). It is labelled as the test oracle; L2 vs L3 is the informative SO5 contrast.
- Power is unknown until the level-outcome simulation runs with pilot dispersion. Twelve Sonnet-only blocks may not reach 0.80 for H3; the amendment then pre-states which contrast is dropped to secondary.
- The amendment changes the memo's outcome and arm set after the pilot was seen. Some examiners will call it a deviation; the thesis says so plainly and shows the memo's branch result beside it.
- Readiness gate lines independent of this design are still red: V1 (Q1-Q25), V3/V4 hold-out (V4 has no waiver and needs about 35 expected blocking findings per style), V5 independent second rater, V9 (PR #176 open), S4 (MCP never confinement-probed), S8 (model tiers live), D15. The two-week claim is scoped to "design amended, instrument ready, pilot run"; registration follows the gate.
- Operational run-once risk: the daedalus-mcp arm has never run inside the loop harness; the layered frame, L3/L4 slots and per-task MCP spec are new code. The dress rehearsal must exercise every cell type with 0 evaluation errors.
- Generalisation is to 4 tasks and one or two models. Task-level inference is not available at this grid size.
- Machine limits (one lane, one capped Neo4j, kernel-panic history) and subscription usage-window pauses make wall time, not USD, the binding constraint; a long run may pause mid-block, so resume (D14) must be rehearsed.
- Task author exposure: the author has seen every probe result and writes the confirmatory tasks. V10c separation (never runs or scores), the fixed style criterion, hashed hint-audit sheets and a dated writing log are the mitigation; it does not remove the risk.