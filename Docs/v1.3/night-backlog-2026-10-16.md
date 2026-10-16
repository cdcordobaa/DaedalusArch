# Fable backlog proposal, night of 2026-10-16: 26 new jobs for the next ~8 hours

Read-only review of `origin/v1.3` at the night-plan tip, PRs #82–#161, `v1.3-night-2026-10-16-plan.md`, the post-merge review (31 findings), the pilot memo, the Study 2 outline, the readiness gate (#146: 1 green of 42), the floor probe (#161), the analysis rehearsal (#160), the judge v2 run, the external set (#133) and the interpreter doc. Nothing was edited, built or installed.

## 0. Where the objectives actually stand, in one paragraph each

- **SO4.** The night already covers convergent, predictive, mutation, metamorphic and fix-mining evidence. Three non-human evidence types are still missing: (a) **deterministic correctness on human-written code**: the external set has 283 blocking findings and zero labels, yet `check-correct.ts` can label most of them without a rater; (b) **instrument reliability across spec authors**: every spec on the external set was written by one session, and no one has measured how much the blocking count moves when a second blind author writes the spec (a researcher-degrees-of-freedom threat the threats register lists but nobody tests); (c) **known-groups and discriminant validity**: whether blocking density separates showcase repos from application repos and whether it is just a size proxy. Same-vendor threat (V10) remains, and the hold-out's provenance note in `sealed-hashes.md` is the weakest paragraph in the thesis; the role-separation plan's "third manifest by a non-Claude vendor" has no harness.
- **SO3.** v2.2 is in the author's hands (local judge login). What can move tonight without any LLM call is the *framing*: the committed cassettes hold 3 runs per item for ~230 items. Nobody has computed whether unanimity predicts correctness (selective prediction), and nobody has produced the symbolic-vs-neural 2×2 on every planted seed. If unanimous verdicts are ≥0.90 correct, the agent-facing neural tool can report confidence and abstain, and 0.76 becomes "0.9 when it speaks". That is the only route to "neural as strength" that does not need the author tonight.
- **SO5.** The floor is a *greenfield-agent* phenomenon: hexagonal 0/14 none-arm steps had a blocking finding (#161), while 11 of 15 human-written repos fail (#133; corrected 2026-10-16 from "10 of 15": `results/v1.3-spec-author-b/agreement/agreement.json` has `evalA.verdict = fail` on 11 of 15 rows, and #133's `summary.json` agrees). Two levers are untested: the layout sentence (addendum A1, gate line S5) and brownfield precedent (an agent extending code that already has a shortcut). Both can be probed tonight by one Opus session, like #161 did.
- **Study 2 runs once.** The gate is 1/42 green. The scripted replay (#142) proves plumbing but not *fault tolerance*; the generator in the loop is not pinned or isolated (S2, S3); there is no MCP call log (D6), no acceptance checks (D12), no independent measures per snapshot (D16), no tunables manifest (S11), and no unsealer tooling (D2, S14). Each is small, deterministic and cloud-runnable.

## 1. Standard rules block (paste verbatim at the top of every routine prompt)

```
RULES (hard, read before anything else)
1. Fresh checkout of https://github.com/cdcordobaa/DaedalusArch. Branch `v1.3-<slug>` from `origin/v1.3`. Open a PR into `v1.3`; do NOT merge it. Title starts "v1.3:"; body says "Do not merge without the author's review." and states what was NOT done.
2. Study 2 runs exactly once. Never read, list, hash, copy or infer anything under `../daedalus-sealed/`; never name, paraphrase or derive a Study 2 task; never run anything against the hold-out. If a step would need it, stop and write that down instead.
3. Every new behaviour is OFF by default (flag, option or env var). The 71 reference results must stay byte-identical: before pushing, run `npx tsx scripts/v1.3/ue-baseline-live.ts --engine cypher-interp --out <scratch>` and diff `raw/`, `report.json` and `report.md` against `results/v1.3-reference/after-member-facts` (only `elapsedMs` may differ). Record the diff result in the PR.
4. Never edit Cypher template text (`src/fitness-compiler/*templates*.ts`, `apg2-*`), `Docs/v1.3/rule-tiers.md`, `Docs/v1.3/style-rule-sources.md`, `Docs/v1.3/sealed-hashes.md`, `corpus/prereg.json`, any preset under `presets/`, or the loop prompt frames in `scripts/lib/loop/prompts.ts`/`style.ts`.
5. Do not compute, print or plot any effect of a construct switch (Q1–Q25, `src/construct-switches`); the author has not answered the sheet. Status-quo behaviour only.
6. No Claude CLI login and no vendor key exist here. Make no LLM call. Use the mock provider, committed cassettes, stubs and the scripted replay agent only. If you are told to act as the coding agent yourself, that is you writing code, not a judge call.
7. Write no pre-registration document and no literature review. Hash manifests and tooling are fine; call them tooling.
8. Light footprint: `jest --maxWorkers=2`; one Neo4j at most (5.26.24 tarball + bundled APOC) and only when `--engine cypher-interp` cannot do the job. List which failing suites also fail on untouched `origin/v1.3`.
9. Append one entry to `aidlc-docs/audit.md` (append only; never rewrite it). Log every decision you took alone as "option taken under delegation".
10. Every commit ends with the trailer line:
   Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
11. Fix the pass criterion and the analysis before computing any number; commit them first; report the result even when it is null.
```

## 2. Ranked jobs

Effort is routine wall-time. "Depends" names in-flight PRs whose branch must be fetched (read the branch; do not merge it).

---

### #1 · N1 · Selective prediction: does judge unanimity predict correctness?

- **Objective:** SO3 (neural as strength), feeds the MCP `review_unit` design (#157).
- **Why:** The judge is 16/21 = 0.76 on the headline; v1 clean false-fail 0.08, v2.1 0.15 (`v1.3-judge-v2-2026-10-16.md` §3). Every verdict is a majority of 3 runs, but nobody has asked whether 3/3 agreement is more accurate than 2/1. If it is, the agent-facing tool can return `confident | uncertain` and abstain, which turns a weak average into a strong conditional claim. All data are committed cassettes; no call needed.
- **Depends:** none (cassettes under `tests/fixtures/judge-cassettes-v13/`, verdicts under `results/v1.3-judge-v2/`, `results/v1.3-judge-catch*`).
- **Where:** cloud. **Effort:** 2 h.
- **Pass criterion (fixed now):** report, per judge (v1, v2.1) and per item class (seed, twin, clean), accuracy of unanimous verdicts vs split verdicts with Wilson 95% CIs, plus coverage (share unanimous). Decision rule: if unanimous-subset accuracy ≥ 0.90 (lower Wilson bound ≥ 0.80) and coverage ≥ 0.60 on the CHECK items, propose the `confidence` field (OFF by default) for `review_unit`; otherwise report that unanimity is not informative and say so in one sentence.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-judge-selective-prediction

Goal: from committed judge cassettes and verdict files only, measure whether 3-run unanimity predicts a correct verdict.

Steps
1. Inventory every judged item with 3 recorded runs: results/v1.3-judge-v2/ (TUNE, check-v2.1, check-v1-current-graph), results/v1.3-judge-catch/, results/v1.3-judge-catch-round2/ (or wherever judge-catch rounds 1, 2 and DUP v2 store per-run verdicts; check Docs/DiagnosticRuns/v1.3-judge-catch-*.md for the paths). Truth label per item: seed = should fail, twin = should pass, clean control = should pass, from the committed plans/manifests. Do not invent labels.
2. Commit, BEFORE computing anything, scripts/v1.3/judge-selective.ts with: the item inventory, the decision rule (unanimous accuracy >= 0.90 with Wilson lower bound >= 0.80 and coverage >= 0.60 on CHECK items), and unit tests for the Wilson interval and the grouping.
3. Compute per judge version and per class: accuracy | unanimous, accuracy | split (2-1), coverage, and the same for seeds only (catch) and for twins+clean (false-fail). Also report "what an agent would see": expected false alarms per 10 clean units if (a) all verdicts shown, (b) only unanimous verdicts shown.
4. Write Docs/DiagnosticRuns/v1.3-judge-selective-2026-10-16.md with a development-set banner, the tables, the pre-stated decision and one paragraph on what this does not show (TUNE items were used for tuning; development data; same vendor).
5. If the rule passes, add a design note (no code change to the judge) to Docs/v1.3/neural-arm-agent-tools.md or a new Docs/v1.3/judge-confidence.md: how review_unit would tag confidence, OFF by default. Do not implement.
6. Run jest --maxWorkers=2 tests/unit/scripts/v1.3; rule 3 diff; audit entry; PR.
```

---

### #2 · N2 · Symbolic–neural complementarity matrix on every planted seed

- **Objective:** SO3 framing; SO2 (what the graph cannot see).
- **Why:** The thesis needs the sentence "the neural arm catches what the rules structurally cannot see". Today the catch rate is reported without stating which seeds a *symbolic* run would also flag. A 2×2 per seed (symbolic flags? judge flags?) computed by running `evaluate --symbolic-only --engine cypher-interp` on every seeded copy, with no LLM call, yields the complementarity claim in one table. Judge verdicts are already in cassettes.
- **Depends:** none. The #79 operators and seed manifests are committed (`judge-catch-frozen.md`).
- **Where:** cloud. **Effort:** 2–3 h.
- **Pass:** every seed in rounds 1, 2, DUP v2 and CHECK classified into {symbolic-visible, symbolic-blind} by a deterministic rule committed first (symbolic-visible = the seeded file receives at least one blocking or advisory finding absent from the base), and judge catch reported in each cell with Wilson CIs. Also report judge *false fails* on clean units that the symbolic arm passes (the cost side).
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-complementarity-matrix

Goal: a 2x2 per planted seed: did the symbolic arm flag the seeded unit, did the judge fail it. No LLM call; judge verdicts come from committed cassettes/verdict files.

Steps
1. Re-materialise every seeded copy and its base from the committed seed manifests with the existing seed scripts (judge-catch-seed.ts, judge-catch2-seed.ts, judge-catch-v2-seed.ts, and the CHECK-2 seeds if present on origin/v1.3-judge-v22-prep; fetch that branch read-only). Verify manifests reproduce byte for byte, as the judge-v2 report did.
2. Commit first: scripts/v1.3/complementarity.ts with the classification rule: symbolic-visible iff `firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3` on the seeded copy yields a finding on the seeded file (or the seeded edge) that the base does not have; record rule id and tier. Blind otherwise.
3. Run it for every seed, twin and clean unit. Join with recorded judge majority verdicts (v1, and v2.1 where recorded).
4. Tables: per operator family and per style, the 2x2 counts; judge catch | symbolic-blind with Wilson CI (the headline complementarity number); judge false fail | symbolic-pass clean units; the list of seeds both arms miss.
5. Docs/DiagnosticRuns/v1.3-complementarity-2026-10-16.md with a development-set banner and a one-paragraph "what this does not show".
6. jest --maxWorkers=2 tests/unit/scripts/v1.3; rule 3 diff; audit entry; PR.
```

---

### #3 · X1 · Deterministic correctness on the external set (human code, no rater)

- **Objective:** SO4 (non-human evidence), SO2 (real-world value).
- **Why:** #133 produced 283 blocking findings on 15 human-written repos and says "No labels yet". `check-correct.ts` labels *correct* from the finding's claim and the code alone (validation-protocol §3), so a precision-of-correctness figure on human code needs no rater. This is the single cheapest new SO4 number and the first on non-Claude-written code.
- **Depends:** PR #133 (`origin/v1.3-external-set`); read it, do not merge.
- **Where:** cloud. **Effort:** 2–3 h.
- **Pass:** every one of the 283 blocking findings has a label in {correct, incorrect, not-checkable} with the checker's evidence; precision-of-correctness per style and per rule with Wilson CIs; `not-checkable` share per template reported; if a template is not supported by the checker, the gap is listed (do not extend the checker by reading rule text; only by reading code facts).
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-external-correctness

Goal: label the external set's blocking findings with the deterministic correctness checker, producing precision-of-correctness on human-written code.

Steps
1. git fetch origin v1.3-external-set; read results/v1.3-external/ from that branch (findings/<id>.json, specs, selection.json). Clone the 15 repos at the pinned SHAs (selection.json) into a scratch dir outside the repo. Do not re-run evaluate unless a report is missing; if you do, use the committed spec and record provenance.
2. Read scripts/v1.3/check-correct.ts and Docs/v1.3/labelling.md to learn its jobs-file format and which templates it supports. Commit, before any run: scripts/v1.3/external-correctness-jobs.ts (builds the jobs file from the 15 reports) and the pass criterion (every blocking finding labelled; Wilson CI per style and rule).
3. Run check-correct on all 283 blocking findings. For every `not-checkable`, record the template and the reason. If a hexagonal/DDD template is unsupported, do not add support that reads the Cypher text; you may add a code-fact check only when it can be stated from the finding's claim (file, target, edge) and the source alone, with unit tests, and you must state it is new and untested on the dev set.
4. Also sample 30 advisory findings (seeded, seed 20261016) and label them, as a secondary table.
5. Docs/DiagnosticRuns/v1.3-external-correctness-2026-10-16.md: per-style and per-rule precision-of-correctness, not-checkable share, list of incorrect findings with one line each, limitations (correct != meaningful; specs written by one session; 15 repos).
6. Update nothing in #133's docs; cross-reference only. jest --maxWorkers=2 tests/unit/scripts/v1.3; rule 3 diff; audit; PR.
```

---

### #4 · V1 · MCP blocking parity through the interpreter (hexagonal and DDD rules in `check_file`/`check_diff`)

- **Objective:** Study 2 runs once (gate V9), SO3/SO5 (the `daedalus-mcp` arm must be the treatment that is scored).
- **Why:** `check_file`/`check_diff` re-state rules in TS (`fast-rules.ts`) and miss `dependency-direction-graph`, `core-isolation`, `context-isolation` (#142, gate V9 RED); #161 found `check_import` passing an edge the graph blocks and two verdicts disagreeing; R03, R21, R22 are in the same family. The interpreter (#128) executes the real Cypher text in-process in ~20 ms, so the MCP tools can run the *compiled rules themselves* on a per-call graph (project graph built once, cached by file hashes) instead of a re-implementation. One rule definition, as the thesis promises.
- **Depends:** #128 merged; #156 added `--engine` to `evaluate_project`; read #142 §4 and #161 §3.7 for the defect list.
- **Where:** cloud. **Effort:** 4 h.
- **Pass:** with `--fast-rules-engine cypher-interp` (OFF by default), `scripts/v1.3/mcp-consistency.ts` reports 100% agreement on blocking findings per style on the 71 reference variants and on the #142 replay snapshots; default mode byte-identical to today; `check_import` on hexagonal application→outbound-adapter returns the graph's verdict when the option is on.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-mcp-interp-parity

Goal: let check_file, check_diff and check_import compute blocking findings by running the compiled Cypher of the spec on an in-process graph (src/cypher-interp), behind an option that is OFF by default, so the MCP arm reports exactly the rules that are scored.

Steps
1. Read src/mcp-server/{fast-rules,file-check,diff-check,import-check,context,evaluate-project}.ts, src/cypher-interp/repository.ts, src/pipeline (createPipeline, graphEngine), scripts/v1.3/mcp-consistency.ts, and PR #142's Docs/v1.3/loop-replay.md §4 and PR #161's report §3.7 (fetch those branches read-only).
2. Design (write Docs/v1.3/mcp-interp-parity.md first): ServerContext builds the project APG once with the existing extractor, ingests into MemoryGraphRepository, and caches by (file path -> content sha256). check_file/check_diff re-extract only the changed files, rebuild the graph, run the spec's compiled blocking templates through the same compileFunctions path evaluate uses, and filter rows to the changed files (check_diff) or the file (check_file). check_import answers from the same compiled FF-S01/direction-graph/core-isolation/context-isolation rows for a hypothetical edge (add the edge to a copy of the graph, run, diff). Expose ONE verdict object (blockingVerdict + findings) when the option is on; keep legacy fields for the default path.
3. Option name: `--fast-rules-engine fast|cypher-interp` (default fast) and env DAEDALUS_FAST_RULES_ENGINE. Default path untouched; add a test asserting default tool outputs are identical to a golden capture.
4. Verify: mcp-consistency.ts over the 71 reference variants with the option on, per style; the #142 replay assertion about hexagonal/DDD feedback with the option on; the three #161 defects as regression tests. Report latency per call (p50/p95) on the largest reference variant.
5. Do not change tool descriptions seen by the daedalus-mcp arm unless the option is on.
6. jest --maxWorkers=2 tests/unit/mcp-server tests/unit/scripts/loop; rule 3 diff; audit; PR with the parity table.
```

---

### #5 · F1 · Floor probe 2: the layout sentence and the style sentence as levers

- **Objective:** SO5 (floor effect), gate line S5 (no-layout-hint arm decision), D2.
- **Why:** #161: hexagonal none-arm 0/14 steps with a blocking finding, "with the folder sentence given". Addendum A1 says a shared sentence silently gave every Study 1 arm the same structure. Nobody has measured what happens when the layout sentence is removed (style sentence only) or when both are removed and the spec alone defines the style. If the floor lifts without the layout sentence, Study 2 has a design lever that is not "pick harder tasks". One Opus session as the agent, exactly like #161; tiny n, labelled a feasibility probe.
- **Depends:** #161 (`origin/v1.3-floor-probe`: tasks, scoring script, report format). **Author flag:** the 4 new probe tasks of #161 still need the author's sealed-domain check before any reuse in a pilot; for a probe that never feeds Study 2 this is acceptable but must be stated.
- **Where:** cloud (Opus is the agent; scoring via `cypher-interp`). **Effort:** 3 h.
- **Pass:** for hexagonal and clean, 2 tasks × 3 conditions (style+layout, style-only, spec-only via a one-line "the architecture spec is at spec.yaml; follow it") × 4 steps, all code written before any scoring, type-checked; table of steps with ≥1 blocking finding and new blocking identities per condition. Pre-stated reading: if style-only or spec-only lifts the hexagonal share from 0/8 to ≥ 3/8, recommend S5 = "no-layout-hint arm or frame"; else recommend keeping the frame and moving the lever to task design (W3-3).
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-floor-probe-2

Goal: a one-session feasibility probe of two prompt-frame conditions on the hexagonal and clean floor. You are the coding agent for every trajectory, as in PR #161. This is not the loop pilot and not Study 2.

Steps
1. git fetch origin v1.3-floor-probe; read Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md and results/v1.3-floor-probe/ (scoring commands, identity rule, task texts). Reuse two tasks: shelter-adoptions (hexagonal, from Docs/v1.3/pilot-tasks.md) and one clean task from #161's new tasks. Do not write new tasks.
2. Commit first: Docs/DiagnosticRuns/v1.3-floor-probe-2-plan.md with the three conditions' exact frame texts (do NOT edit prompts.ts/style.ts; render the texts by hand into the plan), the identity rule copied from the pilot memo §3, and the pre-stated reading above.
3. Conditions: C1 = style sentence + layout sentence (replicates #161); C2 = style sentence only; C3 = no style wording, a line "Follow the architecture spec at spec.yaml" with the pilot spec copied in. Order the 6 trajectories by a committed seed. Write all 4 steps of a trajectory, type-check each, snapshot (git commit in a store outside cwd), and only then score every snapshot with `firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3` and check-correct.ts.
4. Report: steps with >=1 blocking finding, new identities at steps >=2, rules hit, per condition and style; also the layer-coverage share (files matching no layer glob) per condition, because C3 may produce unmapped files instead of violations.
5. Write the report with the probe's limits (one agent, Opus, n = 24 steps, same session wrote all conditions so order effects exist).
6. Audit; PR. No change to any frame, spec, preset or template.
```

---

### #6 · F2 · Precedent-propagation probe: does an agent copy an existing shortcut?

- **Objective:** SO5 (a realistic erosion mechanism), Study 2 design (D1, D11).
- **Why:** The floor probe found erosion only as step-1 layout habits; the humans in #133 fail 11/15 (corrected from 10/15; see the SO5 note above). Real erosion happens in brownfield: an agent extends code and imitates what is there. If a planted precedent (one use case importing a concrete adapter) makes the agent's *new* use case do the same, then (a) Study 2 can seed step 0 with a legacy tree to escape the floor, and (b) the thesis gains a mechanism statement ("conformity to existing code beats conformity to the style"), which is exactly what a firewall is for. A controlled probe: same step text on a planted vs clean seed tree.
- **Depends:** #161 for the scoring recipe; none to merge.
- **Where:** cloud (Opus as the agent). **Effort:** 3 h.
- **Pass:** 4 seed trees (2 hexagonal, 2 clean; small, type-checked, written by the routine) × 2 conditions (planted precedent vs clean control) × 2 extension steps = 16 steps, all written before scoring. Outcome: share of planted-condition steps whose new code adds a *new blocking identity of the same rule and shape* vs the control. Pre-stated reading: ≥ 50% in planted vs ≤ 10% in control → "brownfield seeding is a viable Study 2 lever; propose it to the author for D11"; otherwise "null; agents do not copy this shortcut at this n".
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-precedent-probe

Goal: feasibility probe of precedent propagation. You act as the coding agent. Not the pilot, not Study 2. Domains must be new: not the reference apps, not E1, not the pilot tasks, not #161's tasks (list them in the plan and check).

Steps
1. Commit the plan first (Docs/DiagnosticRuns/v1.3-precedent-probe-plan.md): the 4 domains, the two extension-step texts per domain in plain product language (no layer/port/pattern words), the planted precedent per style (hexagonal: an existing application use case imports a concrete outbound adapter class directly, FF-S01 blocking under presets/hexagonal; clean: a use case imports an infrastructure class, FF-S01), the control (same tree with the port injected instead), the identity rule from the pilot memo §3, and the pre-stated reading.
2. Build the 8 seed trees (type-checked, ~10-15 files, in-memory storage, HTTP exposed), confirm with `firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3` that planted trees have exactly the planted blocking finding and controls have 0. Commit them under examples/precedent-probe/ (they are fixtures, not results).
3. For each of the 16 (tree, step) cells, in a committed seeded order: apply the step as the agent, with the standard styled frame text copied by hand (do not edit prompts.ts), type-check, snapshot outside cwd. Write all 16 before scoring any.
4. Score every snapshot; classify new blocking identities as same-shape-as-precedent or other; run check-correct.
5. Report with a 2x2 per style, the pre-stated reading, and limits (one agent/session; author-written seeds; tiny n).
6. Audit; PR.
```

---

### #7 · S1 · Fault-injection replay: the loop survives and resumes byte-identically

- **Objective:** Study 2 runs once (gate S1, D7, D14 live-resume).
- **Why:** #142 shows a clean replay works. Study 1 died on a usage limit (PR #59). The dress rehearsal (#146) plans fault drills but needs LLM turns. With the scripted agent, every drill can run tonight: kill mid-turn, kill between snapshot and score, usage-limit envelope, Neo4j down, tsc failure, disk full on the store, corrupted step record. The pass is byte-identical telemetry after resume.
- **Depends:** #142 (`origin/v1.3-loop-replay`), merge state unknown at run time: fetch it and work on top of it if not merged (state so in the PR).
- **Where:** cloud. **Effort:** 3 h.
- **Pass:** 7 drills, each: inject → observe a classified failure in the run record → resume → final `steps/`, `run.json`, snapshots equal the undisturbed replay except timing fields (use #142's byte-identity comparer). Any drill that duplicates a turn, skips a step or silently converts an arm (R01's failure mode) is a reported defect with a fix behind no flag only if it is a pure bug fix with a test.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-loop-fault-drills

Goal: prove the loop harness tolerates and resumes from the faults Study 1 met, using the scripted replay agent (no LLM).

Steps
1. git fetch origin v1.3-loop-replay; if not merged into origin/v1.3, branch from origin/v1.3 and cherry-pick or merge that branch locally (say so in the PR). Read scripts/lib/loop/{loop,main,snapshot,agents,evaluator}.ts, replay.ts, replay-verify.ts, and Docs/v1.3/loop-replay.md.
2. Commit first scripts/v1.3/loop-fault-drills.ts with the drill list and pass criterion: D1 SIGKILL during a step turn; D2 SIGKILL after snapshot, before scoring; D3 generator envelope reporting a usage-limit (use the E1 envelope fixtures); D4 evaluator failure (Neo4j unreachable when --engine neo4j; with cypher-interp, inject a thrown error); D5 tsc non-zero exit; D6 ENOSPC on the snapshot store (simulate via a tiny tmpfs or a write hook); D7 a truncated steps/step-02.json. Each drill: run replay with the fault, assert the run record classifies it (TurnStatus / evaluationError), resume, compare to the clean replay with the existing byte-identity comparer.
3. Fix only what is a defect with a failing test first; no behaviour change for the clean path. If a drill shows the gate arm silently becoming none (R01 family), that is blocking: fix and test.
4. Report Docs/v1.3/loop-fault-drills.md: table drill -> classification -> resume result -> bytes identical. Map each to readiness gate lines S1, D7, D14.
5. jest --maxWorkers=2 tests/unit/scripts/loop; rule 3 diff; audit; PR.
```

---

### #8 · S2 · Loop generator isolation and pin pack (S1/S2/S3)

- **Objective:** Study 2 runs once (gate S2, S3; TV-95).
- **Why:** #146: "The Claude CLI version is not pinned in the loop. The generator still runs with the real HOME". E1 solved this (`buildGeneratorChildEnv`, pinned CLI probes); the loop reuses the env allow-list but not the version pin or an isolated config dir. A Study 2 run that auto-updates the CLI mid-grid is unrecoverable.
- **Depends:** #142 (loop evaluator fixes); E1 generator code under `scripts/lib/generators/`.
- **Where:** cloud (no login needed: test with a stub `claude` binary that prints a version). **Effort:** 3 h.
- **Pass:** the plan carries `cliVersion` and `modelId` per adapter; the harness refuses to start a run when the binary's `--version` differs; each turn runs with an isolated `CLAUDE_CONFIG_DIR`/`CODEX_HOME` under the harness root, `HOME` redirected, auto-update disabled, and the env allow-list; a unit test fails if any of these regress; dry run and replay still pass byte-identically.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-loop-isolation-pins

Goal: port E1's generator isolation and pinning into the loop harness so S2 and S3 of Docs/v1.3/study2-readiness-gate.md (PR #146 branch) can turn green.

Steps
1. Read scripts/lib/loop/{agents,plan,main}.ts, scripts/lib/generators/{env,harness-tsconfig,envelope}.ts and the E1 pin/probe code (search for '--version', 'CLAUDE_CONFIG_DIR', 'DISABLE_AUTOUPDATER', 'CODEX_HOME' under scripts/lib and experiments/). Read gate lines S1-S3 on origin/v1.3-study2-readiness.
2. Commit the design and pass criterion first (Docs/v1.3/loop-isolation.md).
3. Implement: plan schema fields adapters[].cliVersion and modelId (required when not --dry-run); a pre-run probe that runs the binary with --version in the isolated env and aborts on mismatch (status 'model-mismatch' family); per-run isolated config dir and HOME under <H>/runs/<runId>/home; auto-update disabled; env allow-list applied at every spawn site including the repair turn and the MCP server child; usage-limit classification at every call site (S1) using the E1 classifier.
4. Tests with a stub binary (a shell script printing a version and an envelope). Replay and dry run must stay byte-identical (timing excepted).
5. Record what the author must still do locally: the live confinement probes with the MCP server attached (S4) need a real CLI login.
6. jest --maxWorkers=2 tests/unit/scripts/loop; rule 3 diff; audit; PR.
```

---

### #9 · D1 · Independent per-snapshot measures and gaming guards (D13, D16)

- **Objective:** Study 2 runs once (Q4 circularity), SO4 (convergent measure on generated code).
- **Why:** Outline §4 and §7 require dependency-cruiser under the ADR-030 translation, held-out-rule counts, and gaming guards (dynamic `import()`, `require()`, barrel count, layer-coverage share) per step. Gate D13/D16 are RED. `scripts/depcruise-translate.ts` exists; the snapshot store is a git repo. A post-hoc scorer over any snapshot store makes these measures available for the pilot and Study 2 without touching the live loop.
- **Depends:** #142 snapshot layout; `dependency-cruiser` installable in the cloud.
- **Where:** cloud. **Effort:** 3 h.
- **Pass:** `scripts/v1.3/snapshot-measures.ts <store>` writes, per snapshot, depcruise violations under the translated spec (per translated rule), import-kind counts, barrel count, coverage share, LOC and file count; runs on the #142 replay store and on #161's probe snapshots; agreement between depcruise FF-S01/S03/S04/P01/S02 and the tool's blocking rows reported per snapshot; byte-reproducible across two runs.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-snapshot-measures

Goal: a post-hoc scorer that computes the Study 2 independent measures and gaming guards for every snapshot in a loop store, so gate lines D13 and D16 can be verified without changing the live loop.

Steps
1. Read scripts/depcruise-translate.ts (ADR-030), scripts/lib/loop/snapshot.ts and types.ts (StepEvaluation, SnapshotMeasure), Docs/v1.3/study2-outline.md §4 and §7, and gate lines D13/D16 on origin/v1.3-study2-readiness. Fetch origin/v1.3-loop-replay for a replay store and origin/v1.3-floor-probe for probe snapshots.
2. Commit the measure definitions and pass criterion first (Docs/v1.3/snapshot-measures.md): coverage share = files under src/**/*.ts matching no layer/context/outside_contexts glob; import kinds = counts of static import, import type, dynamic import(), require(); barrel = file whose exports are only re-exports; LOC non-blank; depcruise rows per translated rule with their file pairs.
3. Implement scripts/v1.3/snapshot-measures.ts: walks every snapshot commit, checks out to a scratch dir, runs the translation + dependency-cruiser (pin the version; npm install in scratch), computes the guards, writes measures/<step>.json beside the store (never inside the agent cwd) plus a summary table. Deterministic ordering.
4. Agreement table: for each snapshot, tool blocking file pairs vs depcruise file pairs for the translated rules; classify disagreements with the existing graph-fidelity reason classes where they fit.
5. Run on the replay store and probe snapshots; include tables in the doc. State that held-out rules need the author's decision on which rules are withheld (see job G1) and are left as a field.
6. jest --maxWorkers=2 tests/unit/scripts/v1.3; rule 3 diff; audit; PR.
```

---

### #10 · D2 · Per-step acceptance-check runner (feature-dropping guard)

- **Objective:** Study 2 runs once (D12), SO5 (an agent can lower violations by dropping features).
- **Why:** Outline §4: "Feature completeness is the weak spot." Gate D12 RED, "no acceptance-check code". Without it, a gate-arm effect can be a feature-dropping artefact. The harness needs: a hidden test file per step, run from outside the cwd against the snapshot's HTTP surface (black box), recorded as pass/fail counts. The sealed-task tests are the author's; the runner and demo tests for the *pilot* tasks can be built tonight.
- **Depends:** #142 (snapshot store, step records).
- **Where:** cloud. **Effort:** 4 h.
- **Pass:** `acceptance` block in `StepRecord` (optional; absent when no tests configured, so the replay stays byte-identical); runner starts the snapshot's service with a fixed command discovered from package.json (or a per-task `start` in the tasks file), waits for the port, runs black-box HTTP tests from outside cwd with a timeout, records {passed, failed, skipped, errors}; demo tests for the 3 pilot tasks, steps 1–4, pass on #142's replay tapes where the feature exists and fail on a deliberately mutilated snapshot.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-acceptance-runner

Goal: close gate D12's tooling: per-step black-box acceptance checks the agent never sees, run from outside the cwd, recorded per step. Demo tests only for the non-sealed pilot tasks (Docs/v1.3/pilot-tasks.md). Never write or guess tests for sealed tasks.

Steps
1. Read scripts/lib/loop/{loop,snapshot,types,evaluator}.ts, the replay tapes on origin/v1.3-loop-replay, and gate D12 on origin/v1.3-study2-readiness. Commit the design and pass criterion first (Docs/v1.3/acceptance-checks.md): where tests live (<H>/acceptance/<taskId>/step-NN.test.ts, outside cwd), how the service is started (tasks file gets an optional `acceptance: { startCommand, port, healthPath }`), isolation (no network beyond localhost, timeout), and that the record field is optional.
2. Implement scripts/lib/loop/acceptance.ts and wire it into the per-step measure after the snapshot, OFF unless the plan sets `acceptance.enabled`. Record {passed, failed, errors, durationMs, testFileSha256}.
3. Write demo tests for the 3 pilot tasks (plain node:test + fetch; each step adds its own tests and re-runs the earlier ones). Show they pass on the replay tapes where the tapes implement the feature (state which ones do) and fail on a copy with a route removed.
4. Replay and dry run byte-identical when disabled.
5. The doc states what the author must do: write and seal acceptance tests with the sealed tasks (outline §8.9), never shown to the agent.
6. jest --maxWorkers=2 tests/unit/scripts/loop; rule 3 diff; audit; PR.
```

---

### #11 · K2 · Spec-author reliability on the external set (a second blind spec writer)

- **Objective:** SO4 (reliability; researcher degrees of freedom), SO2.
- **Why:** Every number on the external set rests on specs one session wrote (#133 §2). The threats register names spec authorship as a degree of freedom but there is no measurement. A second author, given only the repo and the style claim (not the first specs, not the findings), writes 15 specs; then layer-mapping agreement and blocking-count agreement between the two spec sets are measured. This is a reliability coefficient for the instrument's human-in-the-loop part, obtained with no rater.
- **Depends:** #133 branch (read specs only *after* writing yours; enforce by commit order).
- **Where:** cloud. **Effort:** 3 h.
- **Pass:** 15 second specs committed before reading #133's specs or findings (commit timestamps prove order); file-to-layer agreement (κ over files, per repo) and blocking-count agreement (per repo, both spec sets, same tool commit, `cypher-interp`); verdict agreement (pass/fail) per repo; a pre-stated threshold (file-layer κ ≥ 0.80 = reliable mapping) and an honest report either way.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-spec-author-reliability

Goal: measure how much the external set's results depend on who writes the spec. You are the second spec author and must stay blind to the first specs until yours are committed.

Steps
1. Read ONLY results/v1.3-external/selection.json from origin/v1.3-external-set (repo URL, pinned SHA, style claim). Do NOT open specs/, spec-rationale.md, findings/ or summary.json yet. Commit a file stating this blinding and the pass criterion (Docs/DiagnosticRuns/v1.3-spec-author-plan.md).
2. Clone the 15 repos at the pins into a scratch dir. Using only each repo's tree, README and the preset of its claimed style (presets/*.yaml), write specs/<id>.yaml under results/v1.3-spec-author-b/ with your mapping rationale. Run `firewall validate`. Commit and push (this commit's time is the blinding proof).
3. Only now read #133's specs. Compute per repo: file-to-layer assignment under both specs (use the layer annotator; src/apg-extractor or the pipeline's layer-annotator), Cohen's kappa over files, and the list of files mapped differently with the reason class (different directory choice, unmapped vs mapped, style-role naming).
4. Evaluate all 15 under your specs with `firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3` at the same tool commit as #133 (record it); compare blocking counts, blocking per rule, and pass/fail verdict with #133's. Report Spearman over repos and a Bland-Altman style table of count differences.
5. Write the report with the pre-stated threshold and what it does not show (both authors are Claude sessions; 15 repos).
6. Audit; PR. Do not modify anything in #133's results.
```

---

### #12 · K1 · Known-groups and discriminant validity on committed real-world data

- **Objective:** SO4.
- **Why:** The validity memo (#147) lists convergent and discriminant validity, but no discriminant test exists, and known-groups validity (a classic criterion check with no raters) is untried. Both can be computed from committed reports: (a) does blocking density separate style *showcase* repos (boilerplates, "clean-architecture" templates) from *application* repos; (b) is blocking count merely a size proxy (correlation with file count/LOC, before and after density normalisation), against the expectation that advisory metric rules *do* track size.
- **Depends:** #133 (external) and #114 (wild, merged).
- **Where:** cloud. **Effort:** 2 h.
- **Pass:** group assignment rule written from `selection.json` name/description fields and committed before opening any findings file; one-sided permutation test on blocking per KLOC (showcase < application), exact enumeration (n small); Spearman of blocking count and blocking/KLOC with LOC and file count, same for FF-C* advisory counts; pre-stated reading (|ρ| ≤ 0.3 for blocking/KLOC vs size = not a size proxy); null results reported.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-known-groups

Goal: two cheap criterion checks from committed data: known-groups (showcase vs application repos) and discriminant (not a size proxy).

Steps
1. Commit first Docs/DiagnosticRuns/v1.3-known-groups-plan.md with: the group rule (showcase = repo name or description contains boilerplate/template/sample/example/starter/showcase; application = otherwise), applied to results/v1.3-external/selection.json (origin/v1.3-external-set) and the wild selection (results/v1.3-wild/ on origin/v1.3) using only name/description/URL fields; the tests; the pre-stated readings. Do not open findings before this commit.
2. Compute LOC (non-blank src/**/*.ts) and file counts by cloning the pins into scratch (or from the fidelity outputs if present). Join with blocking and advisory counts from the committed reports.
3. Known-groups: blocking/KLOC by group, exact permutation p (enumerate all group labelings if feasible, else 10^5 draws with a committed seed), Cliff's delta. Also per style where n allows.
4. Discriminant: Spearman of blocking count, blocking/KLOC, FF-C* advisory counts and FF-CV05 against LOC and file count, with bootstrap CIs; a scatter per measure.
5. Report with limits (wild specs are inferred, external specs authored; small n; groups from names). No causal language.
6. jest for any helper; audit; PR.
```

---

### #13 · T1 · Frozen-tunables manifest tool and CI verifier (not a pre-registration)

- **Objective:** Study 2 runs once (S10, S11, R23).
- **Why:** Outline §8.7 lists the tunables to hash (templates, tiers, extractor flags, judge prompts, presets, step and repair frames, MCP tool descriptions). Nothing computes them today; `register-prereg` covers the v1.2E artefact set. R23: the loop never checks that the MCP server's spec equals the evaluator spec. A single `study2-tunables.ts` that writes a manifest, and a verifier that fails CI when the live code disagrees, is the mechanical half of "runs once". The author writes the registration later; this is tooling.
- **Depends:** none (frames in `prompts.ts`/`style.ts`; tool descriptions in `src/mcp-server/tools.ts`).
- **Where:** cloud. **Effort:** 2 h.
- **Pass:** `npx tsx scripts/v1.3/study2-tunables.ts write <out.json>` lists every tunable with sha256 (template texts via the registry export, compiled preset YAMLs, frame templates, repair RULE_PLAIN, MCP tool names+descriptions, judge prompt hashes already exported, tier doc, source doc, extractor option defaults); `verify <manifest>` exits non-zero on any drift; a CI job runs `verify` only when the manifest file exists (so nothing changes tonight); the loop plan validator asserts MCP spec sha256 == evaluator spec sha256 per run (R23).
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-tunables-manifest

Goal: tooling to hash and verify every Study 2 frozen tunable (outline §8.7) and to enforce spec equality between the MCP arm and the evaluator (review finding R23). This is NOT a pre-registration document: write no registration text.

Steps
1. Read Docs/v1.3/study2-outline.md §8.7, scripts/register-prereg.ts and scripts/audit-gate.ts (how the v1.2E guard works), scripts/lib/loop/{prompts,style,plan}.ts, src/mcp-server/tools.ts, src/spec-parser/template-registry.ts, src/llm-critic (FROZEN_SHA256, JUDGE_V2_SHA256), and .github/workflows/ci.yml.
2. Commit the manifest schema and pass criterion first (Docs/v1.3/study2-tunables.md).
3. Implement scripts/v1.3/study2-tunables.ts with `write` and `verify`. Hash: every catalogue template text (frozen, hexagonal, DDD, module-wiring, APG v2) by id; each presets/*.yaml; FIRST/NEXT/STYLED frames, repair frame, RULE_PLAIN; MCP tool names and descriptions (default set and --neural set separately); judge prompt hashes; Docs/v1.3/rule-tiers.md and style-rule-sources.md; extractor option defaults as a JSON of the default PipelineConfig; the check-correct identity rule source file. Deterministic key order.
4. Add to the loop plan validator: when arm daedalus-mcp is present, the plan must carry specSha256 per task and the MCP server must be started with the same spec file; a test covers the mismatch.
5. CI: a job that runs `verify` iff Docs/v1.3/study2-tunables.json exists (do not create that file).
6. jest --maxWorkers=2 tests/unit/scripts/v1.3 tests/unit/scripts/loop; rule 3 diff; audit; PR.
```

---

### #14 · A1 · Analysis determinism pack: exact inference, committed seed, both scales, edge dedup

- **Objective:** Study 2 runs once (D9), SO5 (outcome definition).
- **Why:** #160 found the `mcp` decision flips with the Monte Carlo seed (A12), the sign-flip test and the cluster bootstrap disagree in 13% of studies (A1), and raw vs per-KLOC flips the conclusion (A3). #161 §5.4 found FF-S01/FF-S03 double-count the same edge up to 2×. These are mechanical: enumerate sign flips exactly when blocks ≤ 20 (2^n), fix one committed seed otherwise, report both scales side by side with a pre-declared primary slot the author fills, and add a `distinctViolatingEdges` outcome. The author still chooses; the code stops the seed from choosing.
- **Depends:** #160 (`origin/v1.3-study2-analysis-rehearsal`).
- **Where:** cloud. **Effort:** 2–3 h.
- **Pass:** `study2-analyse.ts` p-values identical across 10 runs with different `--seed` when exact enumeration applies; otherwise the seed is read from the plan file and printed in every table; the 200-seed calibration re-run shows size ≤ 0.06 under the null for both inference methods; `distinctViolatingEdges` and `blockingByRule` dedup available as outcome columns (OFF unless `--outcome`); rehearsal 30/30 checks still pass.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-analysis-determinism

Goal: remove analyst and seed degrees of freedom from the Study 2 analysis script without choosing the primary outcome for the author.

Steps
1. git fetch origin v1.3-study2-analysis-rehearsal; work on top of it (state so). Read scripts/v1.3/study2-analyse.ts, lib/study2-synth.ts, study2-rehearsal.ts, Docs/v1.3/study2-analysis-rehearsal.md (A1-A25), and PR #161's §5.3-5.4.
2. Commit the change list and pass criterion first.
3. Implement: (a) exact sign-flip enumeration when the number of blocks (or tasks, at task level) <= 20, else permutation with the seed read from the analysis plan file, never from the clock; (b) a single `inference` field reported for both the test and the bootstrap CI, with a 'disagreement' flag when sign(CI) and p disagree; (c) `--outcome` options: blockingCount, blockingPerKloc, distinctViolatingEdges (dedupe findings that share file pair and direction across FF-S01/FF-S03), newIdentitiesFromStep2 (pilot memo §3 identity rule), with the step-1 level reported separately; (d) every table prints the outcome, scale, inference method and seed in its caption.
4. Re-run the rehearsal and the 200-seed calibration for both inference methods and the two scales; add a table "decision stability across 10 seeds" (must be identical under exact enumeration).
5. Update the A1-A25 list: mark which items are now mechanical and which remain author decisions; do not decide them.
6. jest --maxWorkers=2 tests/unit/scripts/v1.3; audit; PR.
```

---

### #15 · S3 · MCP call log outside the cwd and per-step process metrics (D6)

- **Objective:** Study 2 runs once (D6, outline §4 "Process", §7 "Tool adoption"), SO3 (adoption of neural tools later).
- **Why:** The `daedalus-mcp` arm's analysis needs tool calls per step and "first call before or after the first write"; readiness says "No MCP call log exists". Without it, ITT vs per-protocol cannot be separated, and the neural MCP tools (#157) cannot be evaluated for adoption either.
- **Depends:** #122 (merged); #142 for wiring the harness.
- **Where:** cloud. **Effort:** 2 h.
- **Pass:** `--call-log <path>` (OFF by default) writes JSONL outside cwd: ts, tool, args sha256 (never raw file contents), verdict summary, latency; the loop records per step: calls per tool, first-call-vs-first-write order (from the snapshot's mtime or the envelope's first Write), p50/p95 latency; a unit test with a stub client; default MCP behaviour unchanged.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-mcp-call-log

Goal: a call log for the MCP server, written outside the agent cwd, and per-step process metrics in the loop harness (gate line D6).

Steps
1. Read src/mcp-server/{server,main,tools}.ts, scripts/lib/loop/{agents,loop,types}.ts and Docs/v1.3/study2-outline.md §4 Process and §7 Tool adoption. Commit the design and pass criterion first (Docs/v1.3/mcp-call-log.md): JSONL schema, path must be absolute and outside --project, no file contents (sha256 of args), OFF by default.
2. Implement `--call-log <abs path>` (and DAEDALUS_CALL_LOG) in the server; a wrapper around every tool handler records {ts, tool, argsSha256, filesTouched (paths only), blockingCount, verdict, durationMs, error}.
3. Loop: when the arm is daedalus-mcp, the harness passes a per-turn log path under <H>/runs/<runId>/calls/, and the StepRecord gets an optional `process` block: callsByTool, firstCallBeforeFirstWrite (compare the first call ts with the earliest file mtime change in the cwd, or the envelope's first tool_use of a write tool), latency p50/p95. Absent when no log (replay stays byte-identical).
4. Tests with a stub MCP client and a fake log; default tool outputs identical to a golden.
5. jest --maxWorkers=2 tests/unit/mcp-server tests/unit/scripts/loop; rule 3 diff; audit; PR.
```

---

### #16 · E1 · Dual-engine tee in the loop evaluator (Neo4j of record, interpreter as check)

- **Objective:** Study 2 runs once (D8), SO1/SO2 (the interpreter claim).
- **Why:** The thesis says Neo4j is the reference engine and the interpreter runs the same Cypher. Study 2 will want the interpreter's speed (0.15 s vs 0.7 s per snapshot, times ~900 steps) but must keep Neo4j of record. A `--engine both` mode that scores every snapshot on both and records a parity flag gives Study 2 live parity evidence for free and fails loudly on divergence. The parity tee already exists in `memory-parity.ts`.
- **Depends:** #142; #128 merged.
- **Where:** cloud (Neo4j tarball needed for the test). **Effort:** 2 h.
- **Pass:** `--engine both` records `evaluation.engineOfRecord: 'neo4j'`, `parity: identical|divergent` with a diff summary; a divergence does not stop the run but is counted in run.json; replay on both engines over #142's 39 snapshots is identical; default (`neo4j`) output unchanged.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-loop-engine-tee

Goal: a dual-engine mode for the loop evaluator: Neo4j is the engine of record, the in-process interpreter runs the same compiled Cypher, and every snapshot records parity (gate line D8).

Steps
1. Read scripts/lib/loop/evaluator.ts, scripts/v1.3/memory-parity.ts and lib/memory-sweep.ts (the tee), src/pipeline (PipelineConfig.graphEngine, graphRepository), Docs/v1.3/cypher-interpreter.md §4 (traps T1/T2 and the 'order' class).
2. Commit design and pass criterion first (Docs/v1.3/loop-engine-tee.md).
3. Implement `--engine neo4j|cypher-interp|both` on the loop CLI and plan; in `both`, run the evaluation twice (or tee the repository), compare blocking findings as sets by identity (rule, template, file, target), advisory counts per rule, AHS; record parity and a compact diff. Neo4j remains the recorded evaluation.
4. Run the #142 replay in `both` with Neo4j 5.26.24 + APOC from the tarballs (one instance); table of 39 snapshots: identical/divergent.
5. Tests with a stub repository pair. Default mode byte-identical.
6. jest --maxWorkers=2 tests/unit/scripts/loop; rule 3 diff; audit; PR.
```

---

### #17 · T2 · Unsealer tooling: hash check, banned-term audit, tasks-file conversion (tested on pilot tasks only)

- **Objective:** Study 2 runs once (D2, S14).
- **Why:** At go time, someone must verify the sealed list's sha256, audit every step for layer/port/pattern words (pilot-tasks §1; gate D2 "sealed tasks not audited"), and convert it into the harness tasks file, all in one shot and without leaking the text. Tooling can be built and tested on the pilot tasks tonight; the author runs it once locally on the sealed file.
- **Depends:** none.
- **Where:** cloud (never touches the sealed dir). **Effort:** 1.5 h.
- **Pass:** `unseal-tasks.ts --file <path> --expected-sha256 <hex> --out <tasks.json> --audit <sheet.csv>`: refuses on hash mismatch; writes a term-audit sheet (term list committed first; hits per step with context masked to ±3 words); converts to `LoopTasksFile`; prints only counts, never task text; a test runs it on `Docs/v1.3/pilot-tasks.md` §2 and on a fixture with planted banned words.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-unsealer

Goal: the one-shot unsealing tool for the Study 2 task list, built and tested only on the non-sealed pilot tasks. You never run it on, point it at, or guess the contents of ../daedalus-sealed/.

Steps
1. Read Docs/v1.3/pilot-tasks.md (§1 rules, §2 JSON block, §5 hash commands), scripts/lib/loop/types.ts (LoopTasksFile), Docs/v1.3/study2-readiness-gate.md lines D2 and S14 (origin/v1.3-study2-readiness).
2. Commit first the banned-term list (layer, port, adapter, interface, repository pattern, use case, entity, aggregate, bounded context, domain, infrastructure, presentation, controller, service layer, hexagonal, clean architecture, DDD, dependency inversion, and the preset layer names) with an allow-list for product words that collide (e.g. 'service' as a product noun) and the pass criterion.
3. Implement scripts/v1.3/unseal-tasks.ts: hash verification; parse either a markdown file with one JSON block or a JSON file; term audit with masked context; conversion to LoopTasksFile; per-task and per-step sha256 as in pilot-tasks §5; output only counts and hashes to stdout. Write an audit-sheet CSV for the unsealer to sign.
4. Tests on pilot-tasks.md §2 (must reproduce the memo's hashes) and on a fixture with planted terms.
5. Doc: Docs/v1.3/unsealing-procedure.md, the exact local command sequence for the author, and what gets committed afterwards (hashes and the audit sheet's sha256, never the text).
6. jest --maxWorkers=2 tests/unit/scripts/v1.3; audit; PR.
```

---

### #18 · H1 · Non-Claude blind-manifest writer harness (role-separation plan's "third manifest")

- **Objective:** SO4 (same-vendor threat V10; the hold-out provenance note).
- **Why:** `sealed-hashes.md` admits the hold-out was written by a Fable model and enlarged by an agent with dev-set access. The role-separation plan (#130) proposes a Gemini-written third manifest with inputs restricted to sources, tiers, declarations and schemas, "hashed before the tool runs". No harness exists. The model panel (#153) has vendor adapters for *labels*, not manifests. Build the harness with the input restriction enforced in code, a committed prompt, and a fake-rater dry run; the author runs it with a key. **Author-only:** the live run (Gemini key, decision 7).
- **Depends:** #153 adapters (`origin/v1.3-model-panel`), #130 plan.
- **Where:** cloud (dry run with fake); local for the real run. **Effort:** 3 h.
- **Pass:** the harness refuses to start if any input path is outside the allow-list (sources doc, tier doc with names only, layer declarations, schemas, project source with comments scrubbed); the prompt and the output schema are committed and hashed before any adapter is wired; fake dry run produces a manifest in `ue-score.ts --blind` format for 3 reference variants; a comparison script reports agreement of two manifests (author vs third) by finding identity.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-third-manifest-harness

Goal: a harness that lets a non-Claude model write blind expected-findings manifests for reference variants under the input restriction of Docs/v1.3/role-separation-plan.md (origin/v1.3-threats). No live call: fake adapter only. Never point it at ../daedalus-sealed/.

Steps
1. Read Docs/v1.3/validation-protocol.md §1, role-separation-plan.md, holdout-prespec.md, scripts/v1.3/ue-score.ts (--blind manifest format), the model-panel adapters on origin/v1.3-model-panel (scripts/v1.3/lib/panel/adapters.ts), and the label-scrub logic from PR #97 (judge-v2-scrub.ts or labelling scrub).
2. Commit first: Docs/v1.3/third-manifest.md with the input allow-list, the prompt text, the output JSON schema, and the pass criterion; hash both in the doc.
3. Implement scripts/v1.3/third-manifest.ts: `build` assembles the bundle per variant (scrubbed source, style-rule-sources.md, rule-tiers.md names+constructs only, layer declarations, schemas) and refuses anything else; `run --adapter fake|gemini|openai` calls the adapter through a cassette store; `compare` reports agreement between two manifests by finding identity (rule, file, target) with per-style tables.
4. Fake dry run on 3 development-set variants (one clean, two seeded) and the compare table against the author manifests. Label the output "dry run, not a result".
5. Write the author's local run commands and the order of work (hash the manifest before running the tool on new seeds).
6. jest --maxWorkers=2 tests/unit/scripts/v1.3; audit; PR.
```

---

### #19 · J1 · Judge steering-comment robustness: prep only (the agent self-review attack)

- **Objective:** SO3 (neural as *agent-facing* strength must survive the agent).
- **Why:** #157 lets an agent call `review_unit` on its own code. An agent that learns the judge reads comments can write `// architecture reviewed: no framework leak` and pass. #97 already showed comments leak labels. Nobody has tested whether benign-looking steering comments flip verdicts. Prep mirrors #141: variants committed, decision rule fixed, one-command local runner; the author runs it once (judge login). **Author-only:** the run.
- **Depends:** #141 (`origin/v1.3-judge-v22-prep`, CHECK-2 items).
- **Where:** cloud for prep; local for the run. **Effort:** 2 h (+ the author's ~30 min run).
- **Pass:** for 20 CHECK-2 seed units and 20 clean units, three comment variants (none; a neutral docstring of equal length; a steering comment asserting compliance) committed with hashes; the local runner reuses the #141 script; decision rule: steering flips ≥ 3 of 20 seed verdicts to pass → "comment-stripping before judging becomes a default candidate for the MCP neural tools"; else "robust at this n". Also: implement `--strip-comments` in the review_unit prompt builder, OFF by default, with tests, so the fix is ready either way.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-judge-steering-prep

Goal: prepare, without any judge call, a robustness test of the judge against steering comments written by the code's author (the agent), and a comment-stripping option for the neural MCP tools.

Steps
1. git fetch origin v1.3-judge-v22-prep and v1.3-neural-mcp (read-only). Read Docs/v1.3/judge-v22-plan.md, the CHECK-2 fixture layout, scripts/v1.3/judge-v22-check2-local.sh, and src/mcp-server neural tool prompt building on the neural branch.
2. Commit first Docs/v1.3/judge-steering-plan.md: item selection (seeded, salt 'daedalus-v1.3-judge-steering-20261016': 20 seed units and 20 clean units from CHECK-2), the three comment variants with exact texts (none / neutral docstring of matched length / steering: a file-top comment asserting the unit follows the architecture and has no framework or persistence leak), the decision rule above, the budget (40 items x 3 variants x 3 runs x 1 judge = 360 calls) and the Wilson reporting.
3. Materialise the variant copies under tests/fixtures/v1.3-judge-steering/ with a manifest and hashes; verify type-check; `seed --check` reproduces the manifest.
4. Harvest prompts with the mock provider (as #141 did) so the local run needs no Neo4j. Add scripts/v1.3/judge-steering-local.sh mirroring judge-v22-check2-local.sh (dry-run prints budget; never reads .env or the judge config dir).
5. Implement `--strip-comments` (OFF by default) in the shared judge prompt builder used by review_unit and FE: strip // and /* */ comments and JSDoc from shown code, keep line numbers stable (replace with blank), with unit tests and a hash test proving the default prompt is byte-identical.
6. jest --maxWorkers=2 tests/unit/llm-critic tests/unit/scripts/v1.3; audit; PR titled "prep only; no judge call made".
```

---

### #20 · L1 · Fixture-comment leakage census and scrubbed-copy generator (V11)

- **Objective:** SO4 (V11 UNKNOWN → known), reliability of every blind writer and rater.
- **Why:** #130 finding 4: all 14 DDD overlays carry `// VIOLATION (...)` or `// Allowed ...` comments; no document records whether the blind manifest writer saw scrubbed source. #97 scrubbed labelling excerpts, not fixtures. A deterministic census (every reference, hold-out-shaped and CHECK fixture file with answer-revealing comments, per style) plus a reusable `scrub-fixtures.ts` closes V11 for every future blind run and gives the thesis a number instead of "unknown".
- **Depends:** none.
- **Where:** cloud. **Effort:** 1.5 h.
- **Pass:** census table (files, lines, per style and set) committed; `scrub-fixtures.ts <src> <dst>` produces a copy with those comments removed and line numbers preserved, proven by `tsc` on the copy and a byte-identical `evaluate` report (comments do not change the graph) on all 71 variants; a regex set committed first; the sealed dir never touched.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-fixture-leakage

Goal: count answer-revealing comments in every development fixture and provide a scrubbed-copy generator for blind writers and raters. Never open ../daedalus-sealed/.

Steps
1. Read Docs/v1.3/threats-register.md finding 4 (origin/v1.3-threats), PR #97's scrub logic (scripts/v1.3/judge-v2-scrub.ts or the labelling scrub), and the reference fixture roots (tests/fixtures/v1.3-*, corpus/overlays, examples used by ue-baseline-live).
2. Commit first the regex set (VIOLATION, Allowed, FF-[A-Z]+[0-9]+, rule names, template names, 'planted', 'seed', 'anti-pattern', 'blocking', 'advisory') and the pass criterion.
3. scripts/v1.3/fixture-leakage-census.ts: per set and style, files with hits, lines, and the hit kinds; Docs/DiagnosticRuns/v1.3-fixture-leakage-2026-10-16.md.
4. scripts/v1.3/scrub-fixtures.ts: copy a tree with hits blanked (line count preserved); prove the scrubbed 71 variants type-check and give byte-identical evaluate reports via ue-baseline-live --engine cypher-interp against a scratch root (identity of the graph under comment removal).
5. One paragraph for the author: which past blind runs saw unscrubbed fixtures (from run pages in Docs/DiagnosticRuns), stated as a residual, no fix claimed.
6. jest --maxWorkers=2 tests/unit/scripts/v1.3; audit; PR.
```

---

### #21 · G1 · Held-out-rule mechanism for the gate arm (Q4 generalisation)

- **Objective:** Study 2 runs once (D16 held-out half, outline Q4), SO5.
- **Why:** Outline Q4 asks whether an effect reaches rules the agent was never shown. The gate shows every blocking finding today, so Q4 cannot be tested. A `gate.shownRules` allow-list in the plan (OFF = all shown) lets the author withhold a subset per pre-registration; the analysis then reports shown vs withheld slopes. Which rules to withhold is the author's call; the mechanism is not.
- **Depends:** #142.
- **Where:** cloud. **Effort:** 2 h.
- **Pass:** plan field `gate: { shownRules?: string[] }`; repair prompt lists only shown rules' findings (the frame text unchanged; only the finding list is filtered); step record keeps all findings with a `shown: boolean`; replay byte-identical when absent; a test shows withheld findings never reach the prompt.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-gate-heldout-rules

Goal: let the gate arm withhold a pre-declared subset of blocking rules from its repair feedback, so Study 2's Q4 (generalisation to unseen rules) is testable. Do not decide which rules; the default is all shown.

Steps
1. Read scripts/lib/loop/{loop,prompts,plan,types}.ts (repairPrompt, BlockingFinding, RepairOutcome) and Docs/v1.3/study2-outline.md Q4 and §7 Scoring leakage. Commit design and pass criterion first (Docs/v1.3/gate-heldout-rules.md).
2. Implement the plan field and the filter at the single point where findings are passed to repairPrompt; never alter the frame text (rule 4). Record `shown` per finding in the step record and `withheldRuleIds` in run.json. The analysis script (study2-analyse.ts on origin/v1.3-study2-analysis-rehearsal; do not merge it, only reference the field names) can later split slopes by shown/withheld; add the field names to its ambiguity list via a note in your doc.
3. Tests: withheld findings absent from the rendered prompt; replay byte-identical when the field is absent.
4. jest --maxWorkers=2 tests/unit/scripts/loop; rule 3 diff; audit; PR.
```

---

### #22 · S4 · Full-grid stub replay at Study 2 scale (scheduling, disk, resume, analysis volume)

- **Objective:** Study 2 runs once (D4, D7, D9, S9).
- **Why:** The dry run and the replay cover 3 tasks × 4 steps. Study 2 is ~162 runs, ~900 steps, 3 arms, interleaved blocks, with the analysis script reading everything. Nobody has run the harness at that volume, even with stubs. Disk growth of the snapshot store, plan ordering by `orderSeed`, lane concurrency rules (max 2 lanes) and the analysis script's runtime at full volume are all unknown. Cheap to find out now.
- **Depends:** #142; #160 for the analysis script (read-only).
- **Where:** cloud. **Effort:** 2 h.
- **Pass:** a stub plan of 6 made-up demo tasks (never sealed ones; use `experiments/loop-demo` style) × 3 models × 3 replicates × 3 arms × k = 5 runs end to end with the stub generator and the `cypher-interp` evaluator on a trivial fixed tree; two lanes in parallel with separate harness roots; a mid-grid kill and resume; the analysis script completes on the output; disk, wall time and the per-step record size reported; the block interleaving verified against the seed.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-grid-scale-replay

Goal: run the loop harness at Study 2's planned volume with stubs, to find scheduling, disk, resume and analysis-runtime problems before any real run. Tasks are made up (todo-list style demo tasks); never the sealed list, never the pilot tasks.

Steps
1. Read scripts/lib/loop/{plan,main,loop,stub}.ts, experiments/loop-demo/plan.dry-run.json, Docs/v1.3/study2-outline.md §6, and (read-only) scripts/v1.3/study2-analyse.ts on origin/v1.3-study2-analysis-rehearsal. Commit the plan and pass criterion first.
2. Generate a plan: 6 demo tasks x 3 model ids (fake) x 3 replicates x arms none/gate/daedalus-mcp, k = 5, orderSeed fixed. Stub generator writes a small fixed tree with one scripted violation at step 3 so the gate arm fires.
3. Run two lanes in parallel with separate harness roots and out roots. Kill lane 1 at ~40% and resume. Measure wall time, disk per snapshot and total, step record size.
4. Verify: block interleaving matches the seeded order; no two lanes shared a root (S9); resume produced no duplicate turn; the analysis script runs on the merged output and reports its runtime.
5. Docs/v1.3/grid-scale-replay.md with the numbers and any defect found (fix only pure bugs with tests).
6. jest --maxWorkers=2 tests/unit/scripts/loop; audit; PR.
```

---

### #23 · M1 · Erosion trajectories in human projects (does blocking count grow over commits?)

- **Objective:** SO5 (is erosion real outside agents?), SO4 (face validity of the outcome).
- **Why:** The floor probe says agents rarely erode in greenfield; the external set says humans end up with 283 blocking findings. If blocking counts grow over a human project's history under a fixed spec, erosion is a real phenomenon the firewall measures, and the Study 2 floor is a greenfield-agent artefact worth designing around (job F2). Distinct from fix-mining (A1) and predictive validity (A2), which look at fixes, not trajectories.
- **Depends:** #133 selection (specs committed).
- **Where:** cloud. **Effort:** 2–3 h.
- **Pass:** for 6 external repos (2 per clean/layered/ddd) with ≥ 100 commits before the pin, 8 evenly spaced commits each evaluated under the pinned spec with `cypher-interp`; blocking count, blocking/KLOC and new-identity count per interval (memo §3 identity rule); a per-repo slope with a sign test across repos; spec-drift caveat (directories may not exist at early commits; report coverage share per commit).
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-human-erosion

Goal: descriptive erosion trajectories on human-written repos under a fixed spec, to show whether the Study 2 outcome moves at all outside agent greenfield.

Steps
1. From origin/v1.3-external-set results/v1.3-external/selection.json pick the 6 repos with the most commits before the pin, 2 per style among clean, layered, ddd. Commit the repo list, the 8-commit sampling rule (evenly spaced by commit count from first commit touching src/ to the pin), the identity rule (pilot memo §3) and the pass criterion before any evaluation.
2. Clone into scratch; for each sampled commit, checkout, evaluate with the committed spec (`--symbolic-only --engine cypher-interp --scoring v1.3`), record blocking count, blocking per rule, LOC, file count, layer-coverage share, evaluation errors (a commit that does not type-check or has no src/ is reported, not dropped silently).
3. Compute new identities per interval, per-repo OLS slope of blocking/KLOC on commit index, and a sign test across the 6 repos. Plot one small-multiples figure (SVG, deterministic).
4. Docs/DiagnosticRuns/v1.3-human-erosion-2026-10-16.md with limits (spec written for the pinned layout; 6 repos; descriptive).
5. Audit; PR.
```

---

### #24 · U1 · Advisory post-filters out of sample (external and wild sets)

- **Objective:** SO3/agent-facing noise; tool readiness.
- **Why:** #139's removal rates are explicitly in-sample ("designed after reading the dismissals"). Its §7 says the next step is a hold-out or live run. The external (#133) and wild (#114) advisory rows were never seen when the filters were designed, so the removal rates there are the honest out-of-sample numbers, with a deterministic `correct` check on a seeded sample of removed rows (meaningfulness still needs the panel).
- **Depends:** #139 (`origin/v1.3-advisory-noise`), #133.
- **Where:** cloud. **Effort:** 1.5 h.
- **Pass:** per option, removal rate on external and wild advisory rows with Wilson CIs; blocking rows byte-identical on every project; a seeded 40-row sample of removed rows run through `check-correct` where the template is supported; a comparison table in-sample vs out-of-sample.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-advisory-filter-oos

Goal: measure PR #139's advisory post-filters on data they never saw (external set, wild set). Filters stay OFF by default.

Steps
1. git fetch origin v1.3-advisory-noise v1.3-external-set. Work on top of #139's branch merged locally onto origin/v1.3 (state so). Read Docs/DiagnosticRuns/v1.3-advisory-noise-2026-10-16.md §7.
2. Commit the pass criterion and the option list to test (the three recommended options, the proposed set, cv05-rollup) first.
3. Re-evaluate the 15 external repos (pins from selection.json, committed specs) and the wild repos with `--advisory-filter <set>` on `cypher-interp`; confirm blocking rows byte-identical for every option; compute removal per option per rule.
4. Seeded sample (seed 20261016) of 40 removed rows -> check-correct where supported; report share 'correct' (a correct-but-removed row is a presentation loss, not a defect; say so).
5. Table in-sample (#139) vs out-of-sample; Docs/DiagnosticRuns/v1.3-advisory-filter-oos-2026-10-16.md.
6. jest --maxWorkers=2 tests/unit/advisory-filter; rule 3 diff; audit; PR.
```

---

### #25 · C1 · Study 2 cost, time and usage-window forecaster (D4)

- **Objective:** Study 2 runs once (D4; NFR-V4 escalation).
- **Why:** Outline §6 guesses 2–6 USD per turn and 1–3 days. E1 telemetry, the floor probe and the agent proof have real per-turn tokens, costs and wall times under subscription windows. A forecaster that reads committed telemetry and a plan and prints per-arm cost, turns, usage-window count and wall-time distribution (with the pause policy) turns a guess into a budget the author can approve or shrink.
- **Depends:** none (E1 telemetry under `experiments/e1-grid/` results; #161 and #156 for loop-shaped turns).
- **Where:** cloud. **Effort:** 1.5 h.
- **Pass:** `study2-forecast.ts --plan <plan> --telemetry <dirs>` prints a table per arm and total: turns, expected tokens and USD (P10/P50/P90 by bootstrap over observed turns), wall time under 1 and 2 lanes with the pause policy, number of 5-hour usage windows; assumptions listed; sanity-checked against E1's actual totals (within 20%).
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-study2-forecast

Goal: a budget forecaster for Study 2 from committed telemetry (E1 grid envelopes, the floor probe and agent proof records), not from guesses.

Steps
1. Locate committed per-turn telemetry: experiments/e1-grid results (envelope summaries: usage, total_cost_usd, duration), results/v1.3-floor-probe and the agent-proof artefacts (origin/v1.3-floor-probe, origin/v1.3-agent-proof, read-only). Commit the model and pass criterion first (Docs/v1.3/study2-forecast.md): per-turn cost and duration drawn by bootstrap from observed turns of the same model tier; repair turns at the observed gate fire rate; usage-limit pauses from E1's recorded pause policy.
2. Implement scripts/v1.3/study2-forecast.ts reading a loop plan (use experiments/loop-demo/plan.dry-run.json shape with the outline §6 grid) and the telemetry dirs; outputs P10/P50/P90 for USD, turns, wall time (1 and 2 lanes), usage windows.
3. Back-test: forecast E1's own grid from a held-out half of its turns and compare to its actual totals.
4. Table for the working grid and for two smaller grids (2 models; k = 4); no recommendation beyond the numbers.
5. jest --maxWorkers=2 tests/unit/scripts/v1.3; audit; PR.
```

---

### #26 · P1 · Reference-engine version independence (Neo4j 5.26 vs the 2025 calendar release)

- **Objective:** SO1/SO4 reliability (an examiner's obvious question).
- **Why:** Every reported number is from Neo4j 5.26.24. The interpreter proves text-level determinism, but "does it depend on the Neo4j version" has not been answered with a run. One tarball, one baseline run, one diff.
- **Depends:** none.
- **Where:** cloud (one Neo4j at a time). **Effort:** 1.5 h.
- **Pass:** `ue-baseline-live` on Neo4j 2025.x (latest calendar release with APOC core for that version) is byte-identical to the reference (elapsedMs excepted); any divergence listed by template and classified with the interpreter doc's trap classes.
- **Routine prompt:**

```
[STANDARD RULES BLOCK]
Branch: v1.3-neo4j-version-independence

Goal: show that the 71 reference results do not depend on the Neo4j version.

Steps
1. Read Docs/v1.3/cypher-interpreter.md §0-§1 (how Neo4j 5.26.24 + APOC was run from tarballs) and scripts/v1.3/ue-baseline-live.ts.
2. Commit the pass criterion first. Download the latest Neo4j 2025.x Community tarball and its matching APOC core jar (record exact versions and sha256). Run one instance only.
3. Run ue-baseline-live with --engine neo4j against it into a scratch out dir; diff raw/, report.json, report.md against results/v1.3-reference/after-member-facts.
4. Report Docs/DiagnosticRuns/v1.3-neo4j-version-2026-10-16.md: identical or the per-template divergence list; also run the memory-parity sweep's 'order' class check if feasible within time (optional).
5. Audit; PR (results dir added under results/v1.3-neo4j-version/ with run-provenance.json; no credentials printed).
```

---

## 3. Jobs only the author can unblock (the routines above stop at the boundary)

| Author action | Blocks | Gate line |
|---|---|---|
| Answer the score-free construct sheet (#129) and freeze | every construct-switch result; the hold-out run | V1, V3 |
| Run judge v2.2 once on CHECK-2 locally (`judge-v22-check2-local.sh`) | SO3 claim level; J1's run (same login) | V7 |
| Provide a Gemini key (decision 7) and run the model panel and H1's third manifest locally | V10, V5 substitute | V5, V10 |
| Run the confinement probes with the MCP server attached (Claude and Codex CLIs) | the `daedalus-mcp` arm | S4 |
| Check #161's four new probe tasks and F1/F2's domains against the sealed list (without disclosing it) | reuse of probe tasks in any pilot | S14 |
| Write and seal per-step acceptance tests with the sealed tasks | D12 (D2 job gives the runner) | D12 |
| Decide the held-out rule subset for the gate (G1 gives the mechanism) | Q4 | D16 |
| Go for the loop pilot and the dress rehearsal | D1, D14 live resume | — |

## 4. Kill list: tempting tonight, but it would not move an objective

1. **Judge v2.3 or any further rubric edit before the v2.2 decision.** CHECK has been seen; CHECK-2 is spent the moment v2.2 runs on it. Another revision needs a third fresh set and would burn the author's one local run.
2. **Running the loop pilot or the dress rehearsal from the cloud.** No login, and the pilot's `none` arm must be Sonnet via the CLI; a cloud Opus stand-in is a different generator and would spend the pilot tasks' freshness.
3. **Re-scoring the floor probe, the external set or anything else under construct switches.** Forbidden until the sheet is answered; it would also anchor the author.
4. **Drafting the Study 2 pre-registration.** Author decision; the gate is 1/42 green; a draft now would be rewritten in full.
5. **A Grok (or any new vendor) arm.** Author memory says: after first results and the director talk, as an ADR-029-style extension arm.
6. **Expanding the hold-out, re-sealing it, or "fixing" its provenance note.** Any touch makes the same-vendor and late-seal problems worse. The only honest fix is H1's third manifest, run by the author.
7. **New blocking rules or tier moves to lift the floor.** Tiers are sealed; a rule invented after seeing the floor is construct-by-result.
8. **Rewriting rules in TypeScript "for speed".** The interpreter already gives 20 ms per graph stage and the thesis's one-definition claim depends on not doing this.
9. **Ontology v1, Neo4j GDS, community detection, a web dashboard, more presentation-kit figures, more "wild" waves beyond wave 2.** None touches SO3–SO5 or the gate.
10. **A literature review or related-work section.** Explicitly out of scope tonight.
11. **Fixing every flaky jest suite.** The environment-dependent suites (`replay-no-binary`, `skeleton`, `mutation/expected`, `u5b/guards`, `score-golden-acceptance`) fail on untouched `origin/v1.3`; quarantine them in one line of the PR body, do not spend an hour each.
12. **Another documentation-consistency sweep.** #159 already carries R24–R29; a second sweep would collide with it in the merge train.
13. **Benchmarking interpreter speed further or widening its Cypher subset beyond the catalogue.** Parity on the 65k statements is done; extra coverage buys nothing the thesis uses.
14. **AHS re-weighting experiments.** Two AHS versions are already reported; a third weighting is a degree of freedom, not evidence.
15. **Human-rater recruitment emails or protocols.** Validity rests on non-human evidence by the author's decision; the role-separation plan already names the minimal human component.

## 5. Suggested ordering for the windows

- **W2 (02:40–07:40), parallel lanes of at most 2 heavy jobs:** N1, N2 (offline, light) · X1, K2 (clone-heavy, run alone) · S1, S2 (loop, share #142 base) · V1 (longest; start early) · T1, T2, L1 (light) · F1 then F2 (one Opus session each, sequential).
- **W3 (07:40–12:00), after MT3:** D1, D2, E1, S3, G1 (loop-dependent, after #142 merges) · A1 (after #160) · K1, M1, U1 (after #133) · J1, H1 (after #141/#153) · S4, C1, P1 as fillers.
- Everything with a report ends with a development-set or exploratory banner; nothing claims validity on its own.
