# Study 2 readiness gate (go/no-go)

**2026-10-16. Status: NO-GO. 1 of 42 lines is green (V2), 1 is partly green (D14), 32 are red and 8 unknown.** Study 2 runs once. It starts only when **every line below is green** at the commit that will run it. This document is **not a pre-registration** and creates none. It names nothing from the sealed Study 2 task list, and no sealed directory was opened to write it. The companion plan, `Docs/v1.3/study2-dress-rehearsal.md`, describes the one small rehearsal that turns most of the operational lines green.

**Evidence base.** Statuses were taken on `origin/v1.3` at `4339bad5`. Where the evidence sits on an open, unmerged branch, the citation reads `origin/<branch>:<path>:<line>` with its PR number. A line that depends on unmerged work stays red until that work is merged and the check is re-run on `v1.3`. Study 1 incidents are cited from `aidlc-docs/audit.md`, `Docs/threats-to-validity.md` (registered v1.2E register, "TV-nn"), the ADR file (`Docs/ADR — Architectural Decision Records Firewall Tech.md`, "ADR file") and `Docs/v1.3/study1-addenda.md`. v1.3 threats are cited from the draft register on PR #130 (`origin/v1.3-threats:Docs/v1.3/threats-register.md`, "V13-TV-xx").

Commands verified while writing this gate (2026-10-16, cloud container, Node 22, no Neo4j, no model):

```bash
npx jest tests/unit/scripts/loop tests/unit/scripts/v1.3/study2-power.test.ts --maxWorkers=2
# → 5 suites, 61 tests, all passed
npx tsx scripts/loop-harness-cli.ts --plan experiments/loop-pilot/plan.json --dry-run --out-root "$(mktemp -d)/dry"
# → exit 0; 24 step turns, 6 repair turns, 6 cleared; callBudget maxCalls 36
sha256sum Docs/v1.3/rule-tiers.md Docs/v1.3/style-rule-sources.md
# → 290794e0…f27a and 7ce49c63…c28, equal to Docs/v1.3/sealed-hashes.md:8-9
```

## 0. Rules of the gate

1. **Pass criteria are fixed by this commit.** A criterion may later be made stricter. It may never be relaxed after any Study 2 rehearsal or pilot number has been seen, except by a dated addendum that states the reason and was written before the data it would excuse. This answers Study 1's post-hoc changes (item S11 below).
2. **No line is waived silently.** A line marked **[W]** may be closed by a written author decision instead of by the check. The decision is dated, names the line, states the residual threat, and is committed before the gate is declared green. Lines without **[W]** have no waiver.
3. **Green means re-verified on the run commit.** Every command below is re-run at the commit that will run Study 2 (the "run commit"), and its output is stored in `results/v1.3-study2-gate/<line-id>.txt`. A status from an earlier commit does not carry over.
4. **The author signs the go.** The final go is one commit that lists every line, its evidence file and its sha256, and carries an explicit author statement. An AI session cannot declare the go under a delegation (S13).
5. **Order.** The pilot (`Docs/v1.3/pilot-outcome-memo.md`) runs first. Then the instrument freeze and the hold-out (V-lines). Then the dress rehearsal. Then the pre-registration is written (D10). Then this gate. Then Study 2. *(2026-10-16: the validation pilot of the declared deviation runs after the pilot and before the freeze.)*

**Note on rule 1 (2026-10-16).** The Study 2 primary outcome was switched to the level outcome Y by a declared deviation (`Docs/v1.3/study2-deviation-2026-10-16.md`), after the loop pilot and the floor probes were seen. That switch **does not use** rule 1's exception (an addendum written before the data it would excuse), and it does not claim to. It is reported as a deviation, with its timeline. Lines D1, D3, D10 and D11 are restated below for the new outcome; no restatement removes a check, lowers a threshold or adds a waiver, and V10(a), D1, D3 and V4 keep no waiver.

<!-- study2-protocol: primary=D-new-blocking-identities-steps-2-to-k; k=5; arms=none,daedalus-mcp; cells=none@L2,none@L3,mcp@L2; start=shared-step-1; unit=distinct-edge; tasks=new-4-layered-2-ddd-sealed-at-freeze; fallback=run-exploratory; order=freeze,hold-out,pilot-and-rehearsal,pre-registration,gate,run; generators=claude-sonnet-5-5,gemini-pin -->

> **Protocol superseded 2026-10-19.** Study 2's protocol is now the drift record `Docs/v1.4/study2-deviation-2026-10-19-drift.md` (primary D over steps 2–5, k = 5, three cells, new tasks, Claude Sonnet + Gemini, exploratory fallback). Where this document states the level outcome, k = 4, five cells, the sealed tasks, `do-not-run` or the Codex pin, the drift record wins.

## 1. Summary

| Id | Check | Status |
|---|---|---|
| **V. Validity prerequisites** | | |
| V1 | Construct decisions Q1–Q25 answered and frozen | RED |
| V2 | Rule tiers and rule sources at their sealed hashes | **GREEN** |
| V3 | Sealed hold-out run once at the freeze commit, outputs committed | RED |
| V4 | Hold-out claim level reached for every Study 2 style; FR-V11 report written | RED |
| V5 | Human labels by an independent second rater who is not the director | RED |
| V6 | One κ definition fixed before any label | RED |
| V7 | Judge v2.2 decision taken; Study 2 judge version frozen | RED |
| V8 | Graph fidelity on generated code (barrels, `require`, dynamic `import()`) | RED |
| V9 | MCP tools agree with the full evaluation for every Study 2 style | RED |
| V10 | Same-vendor threat bounded (non-Claude generator, external set, role split) | RED |
| V11 | No label leakage into any model or rater input | UNKNOWN |
| **S. Study 1 incident controls** | | |
| S1 | Usage limits classified, paused and resumed at every call site; pause time recorded | RED |
| S2 | CLI versions and model ids pinned and checked by the harness | RED |
| S3 | Generator isolation (config dir, HOME, auto-update, env allow-list) | RED |
| S4 | Confinement probes pass with the MCP server attached, per CLI and arm | RED |
| S5 | Decision on a no-layout-hint arm (addendum A1) | RED |
| S6 | FF-CV05 excluded from the advisory outcome; advisory counts per rule recorded | RED |
| S7 | Live evaluator scores real generated trees with zero evaluation errors | RED |
| S8 | Every Study 2 model tier exercised live (type-check failure rate known) | RED |
| S9 | No two lanes share a harness root | UNKNOWN |
| S10 | Pre-registration hash gate runs in CI on `v1.3` | RED |
| S11 | Every frozen tunable hashed before the first Study 2 call | RED |
| S12 | Raw outputs archived, hashed, path-free | UNKNOWN |
| S13 | Explicit author decision on every sealed or registered artefact | RED |
| S14 | Sealed task list intact and access controlled | UNKNOWN |
| S15 | Model-based labeller or judge routes: tools off, quota for the full volume | UNKNOWN |
| **D. Study 2 design requirements** | | |
| D1 | Outcome variance shown in the pilot (no floor effect) | RED |
| D2 | Task prompts and frames audited for hidden structure hints | UNKNOWN |
| D3 | Power: required N ≤ budgeted N | RED |
| D4 | Cost and time budget per run, under subscription and usage limits | RED |
| D5 | MCP latency per step within bounds in the live loop | UNKNOWN |
| D6 | Loop telemetry complete, including the MCP call log | RED |
| D7 | Reproducibility: pins, deterministic re-score, replay | RED |
| D8 | Neo4j is the engine of record; interpreter parity on Study 2 snapshots | UNKNOWN |
| D9 | Analysis script run end to end on rehearsal data, producing every final table | RED |
| D10 | Pre-registration content complete | RED |
| D11 | Arm set resolved (placebo, gate under the advisory branch, per-task MCP spec) | RED |
| D12 | Feature-dropping guard (per-step acceptance checks) | RED |
| D13 | Gaming guards recorded per step | RED |
| D14 | Harness green: unit tests, dry run, live resume | **PARTIAL** (2 of 3 parts green) |
| D15 | DDD spec-freeze failure mode decided | RED |
| D16 | Q4 independent measures (held-out rules, dependency-cruiser) computed per step | RED |
| **Total** | 42 lines: 1 green (V2), 1 partly green (D14: unit tests and dry run green, live resume red), 32 red, 8 unknown (D5's bench part is green) | **NO-GO** |

---

## 2. V. Validity prerequisites

### V1. Construct decisions answered and frozen

- **Check.** Every question Q1–Q25 of `Docs/v1.3/construct-decisions.md` has an answer, each answer that changes code is applied through `construct-switches`, and the ADRs are merged before the freeze commit X of `holdout-prespec.md` §1. This includes the deferred FF-DS01 tier (Q15) and the FF-P06 halves (Q8, Q14).
- **Why.** The blocking set is Study 2's primary outcome (`study2-outline.md:72`, `:168-170`). Q1–Q13 move blocking rows, and Q3 alone decides every planted FF-S02 cycle (V13-TV-C8, `origin/v1.3-threats:Docs/v1.3/threats-register.md:190-201`). Study 1 changed its scoring after seeing results (ADR-025, `aidlc-docs/audit.md:1243`; ADR-026, `:1251`), which this line prevents for Study 2.
- **Verify.** `grep -c '^\[Answer\]: *[A-Z]' Docs/v1.3/construct-decisions.md` returns 25; `git log --format='%h %ci' -- Docs/v1.3/construct-decisions.md` shows the answering commit before X; the answers file passed to `node --import tsx scripts/v1.3/apply-construct-answers.ts <answers.json>` (`construct-switches.md:12`) is committed with its sha256.
- **Pass.** 25/25 answered by the author (not "AI default"), dated before X, ADRs merged, no deferred tier left in the Study 2 blocking set.
- **Status.** RED. `construct-decisions.md:3` "Status: open, for the author to fill in"; all 25 `[Answer]:` lines are empty (e.g. `:114`, `:794`). `construct-switches.md:3-6`: every switch at A, nothing answered.

### V2. Rule tiers and rule sources at their sealed hashes

- **Check.** `Docs/v1.3/rule-tiers.md` and `Docs/v1.3/style-rule-sources.md` are byte-identical to their sealed hashes; the blocking set used by `gate` and by the outcomes is exactly that table (`study2-outline.md:168-170`).
- **Why.** Tiers were sealed before labelling so that observed precision could not move a rule (`validation-protocol.md:40-42`). Study 1 had no a-priori tiers, and its whole spec-level reversal later turned out to live in rules now classed advisory (`study1-addenda.md:16`).
- **Verify.** `sha256sum Docs/v1.3/rule-tiers.md Docs/v1.3/style-rule-sources.md` against `Docs/v1.3/sealed-hashes.md:8-9`.
- **Pass.** Both hashes equal at the run commit; any tier change since then is an ADR with a construct reason, and V1 re-runs.
- **Status.** **GREEN** at `4339bad5` (290794e0…f27a, 7ce49c63…c28). Re-verify at the run commit.

### V3. Sealed hold-out run once at the freeze commit

- **Check.** `holdout-prespec.md` is frozen (placeholders filled, sha256 in `sealed-hashes.md`), the hold-out is run once at X with `scripts/v1.3/holdout-run.ts`, and the outputs and `run-provenance.json` are committed unchanged before any labelling (`holdout-prespec.md:29-34`).
- **Why.** Development-set figures are fit figures (V13-TV-I3, `threats-register.md:253-268`); the validation protocol makes the hold-out the only source of validity figures (`validation-protocol.md:58-62`). The hold-out was enlarged after tuning and hashed late (`sealed-hashes.md:30`, `holdout-prespec.md:23`), so this run is the last clean validity measurement available.
- **Verify.** `git diff X Y -- src scripts presets specs` empty (`holdout-prespec.md:18`); `ls results/v1.3-holdout/run-1/run-provenance.json`; `Docs/DiagnosticRuns/v1.3-holdout-<date>.md` exists.
- **Pass.** One run at X, outputs committed before any label, report present. A determinism repeat, if made, is identical or logged as a defect (§2.3 of the prespec).
- **Status.** RED. `holdout-prespec.md:3` "Status: draft, to be frozen"; `<FREEZE_SHA>`, `<HOLDOUT_PATH>`, `<N_PER_STYLE>` unfilled (`:11-12`, `:73`); no `results/v1.3-holdout`. Only a development-set stand-in exists (`results/v1.3-reference/holdout-runner-standin/README.md`, "Not a hold-out result").

### V4. Hold-out claim level reached for every Study 2 style

- **Check.** The FR-V11 validation report exists and, for every style used by a sealed Study 2 task, M1 blocking recall and M3 blocking precision (correct) reach at least "validated at the point estimate" (≥ 0.90) and M7 adjudicated import-edge precision, recall and file-to-layer accuracy reach ≥ 0.95 (`holdout-prespec.md:59-81`).
- **Why.** If the blocking rules are imprecise on generated code, erosion is mis-measured (`study2-outline.md:155`). Study 1 reported baseline precision 0.328 from informal agent spot checks (`aidlc-docs/audit.md:1243`, `:1312`) and had to correct a precision claim post hoc (ADR-033, `audit.md:1357-1360`).
- **Verify.** Read the claim-level table of `Docs/DiagnosticRuns/v1.3-holdout-<date>.md`. The person who unseals the task list confirms, without writing it down, which styles the sealed tasks use, and signs a one-line statement "every Study 2 style is validated at the point estimate or better".
- **Pass.** As in Check, for every Study 2 style. A style that is only "characterised" makes this line red; Study 2 then cannot use blocking counts as its outcome for that style. No waiver. The lower-bound check is reported but is not part of the pass, because with fewer than 35 expected findings per style it cannot pass even with a perfect result (`holdout-prespec.md:73`; V13-TV-S1).
- **Status.** RED: depends on V3, V5 and V8. The FR-V11 report does not exist.

### V5. Human labels with an independent second rater who is not the director

- **Check.** A second rater meeting `human-labelling-protocol.md` §5 (professional TypeScript developer, no part in the tool, the manifests or the thesis; `:52`) is named, has signed the conflict declaration, and has completed the hold-out labelling. The director is not that rater.
- **Why.** "Meaningful" was never measured in v1.3 (the model labeller hit its limit; `Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md:7-10`). No independent second rater has been named yet, and whoever is named must meet the protocol's own qualification (`human-labelling-protocol.md:52`; V13-TV-D1 in `threats-register.md`). In Study 1, all "real-code precision" came from agent spot checks (`audit.md:1243`).
- **Verify.** The rater's signed declaration is stored outside the public repo, and its sha256 and date are committed; `results/v1.3-holdout/labels/` holds the second rater's sheet; `scripts/v1.3` union-agreement output (PR #119) is committed.
- **Pass.** Second rater ≠ author ≠ director; labelling complete on the protocol's option A or B; κ under V6's definition computed and reported (its value is reported, not gated here, beyond V6).
- **Status.** RED. `human-labelling-protocol.md:3` "Status: defined; nothing labelled yet"; no rater named (`:44`).

### V6. One κ definition fixed before any label

- **Check.** One κ definition (binary split, AC1 alongside, point-estimate rule) is written in the frozen prespec and the three conflicting documents point to it.
- **Why.** The κ gate is defined three ways (V13-TV-R2 and Appendix A3, `threats-register.md:504-515`, `:621`; `validation-protocol.md:32`, `labelling.md:142`, `human-labelling-protocol.md:61`). Choosing among them after the labels exist is a researcher degree of freedom.
- **Verify.** `grep -n "κ" Docs/v1.3/validation-protocol.md Docs/v1.3/labelling.md Docs/v1.3/human-labelling-protocol.md` shows one definition, dated before the first label commit.
- **Pass.** One definition, dated before any label.
- **Status.** RED (three definitions on `v1.3`).

### V7. Judge v2.2 decision taken; Study 2 judge version frozen  [W]

- **Check.** CHECK-2 has run once and `decide` (`scripts/v1.3/judge-v22-check2.ts`) has produced `results/v1.3-judge-v22/check2-decision.json`; the Study 2 design names the judge version (v1 frozen, or v2.2 after its own confirmation), its pinned CLI, model and effort, and states that the judge is never in the primary outcome.
- **Why.** v2.1 false-failed closed layering on CHECK (`origin/v1.3-judge-v22-prep:Docs/v1.3/judge-v22-plan.md:9-15`). In Study 1 the judge never failed an E1 unit, so κ was 0 by prevalence (`audit.md:1397`, `:1451`), and judge CLI isolation was set after the fact (`audit.md:967`; ADR-018 in the ADR file, `:810-825`). The judge catch is 16/21 = 0.76, below its 0.80 target (V13-TV-C3, `threats-register.md:128`), and DDD was never judged (V13-TV-C4).
- **Verify.** `cat results/v1.3-judge-v22/check2-decision.json`; the judge row of the pre-registration's frozen-tunables table (D10).
- **Pass.** Decision file committed; judge version, CLI pin `2.1.294` (or a newer pin recorded with its own canary run), model and effort frozen; judge dimensions declared secondary and not reported for DDD unless a DDD judge config is validated. **[W]**: the author may instead drop the judge from Study 2 entirely, in writing.
- **Status.** RED. PR #141 is open; "Written … before any v2.2 judge call" (`judge-v22-plan.md:3`); no `results/v1.3-judge-v22`.

### V8. Graph fidelity on generated code

- **Check.** On every rehearsal snapshot, the graph `evaluate` actually uses agrees with tsc on edges among `src/**` files at coverage ≥ 0.95, or the Study 2 outcome uses the view that does; each step records its counts of dynamic `import()`, `require()` and barrel-routed edges; the 39 E1 disagreement rows and the agreement samples are adjudicated by the independent rater (validation protocol §2).
- **Why.** Study 1 had no fidelity check: dynamic `import()` gave no edge, so DaedalusArch caught 0/6 MO-X01 seeds where dependency-cruiser caught 6/6 (`audit.md:1235`, `:1344`, `:1451`), and E1 never exercised `dynamicImports` at all (`Docs/DiagnosticRuns/v1.3-graph-fidelity-2026-10-14.md:28`). On 15 human-written projects the default view reached only 0.926 coverage and 0.904 confirmation pooled, 0.67–0.89 on the 9 barrel-heavy ones, against 1.000 for the literal view (PR #133, `origin/v1.3-external-set:Docs/DiagnosticRuns/v1.3-external-set-2026-10-16.md:170-176`). Agents can route around rules through barrels, `require` or dynamic imports (gaming, `study2-outline.md:146`). The fidelity sheets are unadjudicated (V13-TV-C6, `threats-register.md:156-173`).
- **Verify.** `node --import tsx scripts/v1.3/graph-fidelity.ts project --views` on each rehearsal snapshot (as in PR #133 §4), summarised to `results/v1.3-study2-gate/V8.txt`; adjudication CSVs with no empty `human_verdict`.
- **Pass.** Per snapshot coverage ≥ 0.95 for the view of record, pooled ≥ 0.98; guard counts present in every step record (D13); adjudication complete.
- **Status.** RED, for two reasons only: no fidelity run on any loop snapshot, and the adjudication sheets are empty. (Corrected 2026-10-16: the 0.926 pooled figure from PR #133 is the frozen v1.2E graph, which `evaluate` on v1.3 does not use. Merged PR #149 measured the v1.3 literal view, read by the direction, cycle, layer, metric and context templates, at 1.000 / 1.000 on the external set, and the resolved view, read by four usage templates, at 0.927 / 0.904 by design under ADR-V13-01; `Docs/DiagnosticRuns/v1.3-default-view-coverage-2026-10-16.md` §3.)

### V9. MCP tools agree with the full evaluation for every Study 2 style

- **Check.** On the reference projects and on every rehearsal snapshot, `check_file` and `check_diff` report the same blocking findings as the full evaluation, for every style and template in the Study 2 blocking set (outline prerequisite 3, `study2-outline.md:170-171`).
- **Why.** Otherwise `daedalus-mcp` is a different treatment from the one scored. The loop replay found that the tools check only the layered import rules and miss `dependency-direction-graph`, `core-isolation` and `context-isolation`; in hexagonal and DDD the MCP agent got no feedback where the evaluation reported blocking findings (PR #142, `origin/v1.3-loop-replay:Docs/v1.3/loop-replay.md:135-139`).
- **Verify.** `npx tsx scripts/v1.3/mcp-consistency.ts` over the reference set, plus the replay assertion flipped (`npm run test:loop-replay`, PR #142).
- **Pass.** 100 % agreement on blocking findings per style, or a style is left out of `daedalus-mcp` by a pre-registered decision.
- **Status.** RED (gap confirmed by PR #142; no fix).

### V10. Same-vendor threat bounded  [W]

- **Check.** (a) At least one Study 2 generator is not Claude-family and passes S4; (b) the human-written external set (PR #133) is labelled by the second rater and reported as a separate arm; (c) the coordinator that wrote the sealed tasks does not run, monitor or score Study 2 generation.
- **Why.** Every reference, key, hold-out case and the judge are Claude-family (V13-TV-I1, `threats-register.md:207-235`; `holdout-prespec.md:22`); the coordinator session wrote and knows the sealed tasks (`audit.md:1483`). Study 1 already recorded vendor confounds (TV-100 and TV-103, `Docs/threats-to-validity.md:199`, `:202`).
- **Verify.** The plan's `adapters` list; the external-set labelling sheet with the rater's columns filled; a role matrix in the go commit.
- **Pass.** (a), (b) and (c) all hold. **[W]** for (b) only: the external set may be reported unlabelled as agreement-only, with the residual stated.
- **Status.** RED. PR #133 open and unlabelled ("No labels yet", `v1.3-external-set-2026-10-16.md:196`); the Codex MCP wiring is untested live (`study2-outline.md:152`).

### V11. No label leakage into any model or rater input

- **Check.** No artefact that a Study 2 model or rater reads carries an answer: no `VIOLATION`/`Allowed` comments, no plant-describing names, no task commentary. Acceptance checks, specs, frames and repair text are scanned; the person who unseals the tasks scans them by the same rule.
- **Why.** Fixture comments told labellers the answer (`Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md:174-178`, fixed by PR #97); all 14 DDD overlays name their construct, so the blind DDD keys may be leaked (V13-TV-I4, `threats-register.md:270-296`); a Study 1 file name hinted at its seeded rule (TV-112, `Docs/threats-to-validity.md:211`).
- **Verify.** `grep -rniE "violation|anti-?pattern|seed|twin|leak|bypass|judge|smell|correct|bad" <materialised inputs>` returns nothing (the CHECK-2 rule, `judge-v22-plan.md:59`); the unsealer's signed "clean" statement.
- **Pass.** Zero hits on every model- or rater-facing input, and the statement signed.
- **Status.** UNKNOWN. The sealed tasks cannot be checked from the repo; the rehearsal inputs do not exist yet.

---

## 3. S. Study 1 incident controls

### S1. Usage limits classified, paused and resumed at every call site

- **Check.** A usage limit at a step turn, a repair turn, an init probe, the judge and any labeller is classified `usage-limit`, consumes no attempt, pauses and resumes; each pause's start, end and duration is stored in the turn record and reported apart from wall time.
- **Why.** In E1 pass 1, a usage limit at the judge's init probe was recorded as `transport-error`, so the registered pause never applied (`audit.md:1380-1381`; fixed in PR #59, `04dc7c0e`). The classifier patterns were already flagged unverified (TV-38, `Docs/threats-to-validity.md:117`). Usage limits also stopped the v1.3 judge CHECK (`results/v1.3-judge-v2/call-ledger.json` on PR #126) and the Codex labeller (`v1.3-labelling-2026-10-15.md:7`). The pilot memo needs pauses "shown separately" (`pilot-outcome-memo.md:47`), but `GenerationInterruption` holds only `{at, subtype, movedTo}` (`scripts/lib/generators/types.ts:132-136`).
- **Verify.** `npx jest tests/unit/scripts/loop tests/unit/generators` (retry policy, `scripts/lib/generators/retry.ts:5-9`, `:35-41`), plus the rehearsal's injected usage limit (rehearsal §4.3) with the pause visible in the step record.
- **Pass.** Every call site covered by a test using the recorded real usage-limit text; the rehearsal's injected limit pauses and resumes without a new attempt; pause durations recorded.
- **Status.** RED. The classifier and pause policy exist and are tested; the pause duration is not recorded, and the policy has not been exercised in the loop with a real CLI.

### S2. CLI versions and model ids pinned and checked by the harness

- **Check.** The loop refuses to start if `claude --version` or `codex --version` differs from the pinned value, or if the served model id differs from the plan (`agents.ts:94-98` already checks the model).
- **Why.** The judge CLI auto-updated from 2.1.293 during a login, and auto-update was not off on the author's install (`audit.md:967`; `Docs/judge-preregistration.md:15-18`; TV-37, `Docs/threats-to-validity.md:116`). The Claude loop adapter checks only that `--version` answers (`scripts/lib/loop/agents.ts:206-209`); the memo's `<CLAUDE_CLI_VERSION>` is unfilled (`pilot-outcome-memo.md:92`). Codex is pinned (`agents.ts:291-295`).
- **Verify.** A unit test where a different version string makes the plan refuse; `DISABLE_AUTOUPDATER=1` (or the CLI's current switch) shown in the run env record.
- **Pass.** Both CLIs pinned and refused on mismatch; auto-update verified off on the machine that runs Study 2.
- **Status.** RED (Claude CLI not pinned in the loop).

### S3. Generator isolation

- **Check.** The Claude generator child runs with a dedicated config dir and HOME, no user-level `CLAUDE.md`, hooks, skills or plugins, auto-update off, the production env allow-list, and a canary probe before the first call.
- **Why.** In E1 the generator child got the real `HOME`, so ambient `~/.claude` content "can reach every one of the 54 generations" (TV-95, `Docs/threats-to-validity.md:194`); the judge canary found an ancestor token (`audit.md:1171`). E7's first attempt failed "Not logged in" because the env allow-list dropped `USER` (`audit.md:1283`). The Codex adapter already uses a dedicated empty HOME (`scripts/lib/generators/codex-cli.ts:84-90`).
- **Verify.** The canary probe of `scripts/generator/probes/confinement-cli.ts` with the loop's env; the env dump of one rehearsal turn.
- **Pass.** Canary finds no ambient token; first live rehearsal turn authenticates with the exact production env.
- **Status.** RED (Claude path unchanged from TV-95).

### S4. Confinement probes pass with the MCP server attached

- **Check.** The E1 confinement probes pass for each CLI × arm with `daedalus-mcp` attached, including the Codex `-c mcp_servers.*` wiring and whether the server runs outside the Codex sandbox (outline prerequisite 4, `study2-outline.md:172-173`).
- **Why.** An MCP server widens the agent's surface (`study2-outline.md:152`). Study 1's labeller used tools after they were "disabled" (`audit.md:1376`; TV-109), and Codex could see it was inside an experiment (TV-101, `Docs/threats-to-validity.md:200`).
- **Verify.** `npx tsx scripts/generator/probes/confinement-cli.ts` and `codex-confinement-cli.ts` per arm; results committed.
- **Pass.** All probes pass for every CLI × arm in the plan.
- **Status.** RED (no probe with MCP attached; `Docs/v1.3/mcp-smoke.md:40` "cannot be done in the cloud environment").

### S5. Decision on a no-layout-hint arm

- **Check.** The Study 2 design either includes an arm with no layout hint, or states in writing that §16.1 ("without any spec") is not tested by Study 2.
- **Why.** Study 1's `none` arm carried the three-folder hint (`Docs/generator-protocol.md:75`; addendum A1, `study1-addenda.md:5-17`), so "no spec" claims are "not tested". The loop's styled frames carry a layout sentence in every arm (`loop-pilot-readiness.md:12-18`).
- **Verify.** The arm table of the pre-registration (D10).
- **Pass.** Decision written before the rehearsal, so the rehearsal runs the same arm set.
- **Status.** RED (no decision).

### S6. FF-CV05 excluded from the advisory outcome; per-rule counts recorded

- **Check.** Every step record carries advisory counts per rule, and the advisory outcome is computed without FF-CV05 (memo §4-§5).
- **Why.** FF-CV05 made 1184 of 1423 E1 findings (`Docs/v1.3/labelling.md:57`; "83 % of findings", `audit.md:1368`). On `v1.3` the step evaluation keeps only `advisoryViolationCount` (verified on the dry-run record: keys `blockingByRule`, `blockingFindings`, `advisoryViolationCount`, no per-rule advisory); PR #142 adds `advisoryByRule` (`loop-replay.md:126-128`).
- **Verify.** `jq '.turns[0].snapshot.evaluation.advisoryByRule' steps/step-01.json` is non-null on every rehearsal step.
- **Pass.** Present on 100 % of step records.
- **Status.** RED (PR #142 open).

### S7. Live evaluator scores real generated trees with zero evaluation errors

- **Check.** Every rehearsal snapshot is type-checked and evaluated with the pinned per-run tsconfig, and no snapshot has an `evaluationError` other than a recorded, decided DDD freeze failure (D15).
- **Why.** Every pass-1 E1 record was discarded because cells lacked a tsconfig (ADR-032, ADR file `:1415-1429`; PR #52). The loop had the same bug: the live evaluator read `<project>/tsconfig.json` and would have failed every pilot snapshot with `TSCONFIG_NOT_FOUND`; the dry run did not catch it (`loop-replay.md:115-117`).
- **Verify.** `jq -r '.turns[].snapshot.evaluation | select(.evaluationError)' runs/*/*/*/*/*/steps/*.json` over the rehearsal out-root is empty.
- **Pass.** 0 evaluation errors on real-agent snapshots.
- **Status.** RED (fix only in PR #142; never run with a real agent).

### S8. Every Study 2 model tier exercised live

- **Check.** Each model in the Study 2 plan has completed at least one full rehearsal run (all steps), and its type-check failure rate per step is known before R is fixed.
- **Why.** 7 of E1's cells failed type-check, all `claude-haiku-4-5`, which unbalanced cells and confounded model with spec level (`audit.md:1352`; TV-25). Codex ran on a free plan that "may also switch model" (TV-102, `Docs/threats-to-validity.md:201`).
- **Verify.** Rehearsal per-model table (D9 output).
- **Pass.** Every model completes; a model whose share of type-check-failing final snapshots exceeds 25 % in the rehearsal is replaced or dropped before registration.
- **Status.** RED (no live loop run).

### S9. No two lanes share a harness root  [W]

- **Check.** Each concurrent lane has its own `--harness-root`, or Study 2 runs strictly sequentially.
- **Why.** Concurrent lanes reinstalled the shared skeleton five times in E1 (ADR-029, `audit.md:1333-1336`).
- **Verify.** The run script lists one harness root per lane; `schedule.json` start/finish times show no overlap within a root.
- **Pass.** As in Check. **[W]**: not applicable if the author commits to one sequential lane.
- **Status.** UNKNOWN (no Study 2 run script).

### S10. Pre-registration hash gate runs in CI on `v1.3`

- **Check.** CI runs `--check-prereg` on every Study 2 plan for PRs into the Study 2 base branch.
- **Why.** In Study 1, plans ran against changed registered artefacts and "no CI step runs the check" (TV-91, `Docs/threats-to-validity.md:190`; refusals at `audit.md:1155`, `:1211`). The current CI step runs only when `github.base_ref == 'v1.2e'` (`.github/workflows/ci.yml:123-136`).
- **Verify.** `grep -n "check-prereg" -A4 .github/workflows/ci.yml` shows the Study 2 base branch; a deliberately broken artefact in a throw-away PR is refused.
- **Pass.** CI refuses a plan whose registered artefact changed.
- **Status.** RED.

### S11. Every frozen tunable hashed before the first Study 2 call

- **Check.** Templates, tiers, extractor flags, judge texts, spec presets, step and repair frames, tool sentence and MCP tool descriptions are hashed in the pre-registration (outline prerequisite 7, `study2-outline.md:177-178`), and `planCallBudget` matches the plan.
- **Why.** Study 1 changed instrument and scoring after spot checks (ADR-026, TV-97, `Docs/threats-to-validity.md:196`; ADR-025, DV-TV-5). The pilot memo still holds `<PILOT_SHA>`, `<FRAME_SHA256>`, `<SPEC_SHA256>` (`pilot-outcome-memo.md:87-92`).
- **Verify.** A script recomputes every listed hash at the run commit and diffs it against the pre-registration table (D10).
- **Pass.** Every hash equal.
- **Status.** RED.

### S12. Raw outputs archived, hashed, path-free

- **Check.** The rehearsal and Study 2 out-roots are archived (tar of `runs/`, `schedule.json`, snapshot stores), their sha256 committed, and no committed result holds an absolute path or secret.
- **Why.** Study 1 raw outcomes sat outside the repo at absolute `/Volumes/...` paths and could not be re-scored (`Docs/DiagnosticRuns/v1.3-repro-audit-2026-10-16/group-E.md:229-230`; `reproduction-audit-2026-10-10.md:211-215`); a latency run with absolute paths was discarded (ADR file `:1039`); a password reached a summary (`audit.md:1179`).
- **Verify.** `sha256sum <archive>` equals the committed value; `grep -rE "/(Users|home|Volumes)/" results/<study2>/` is empty; the repo's secret scan passes.
- **Pass.** As in Verify.
- **Status.** UNKNOWN (no archive step defined for the loop).

### S13. Explicit author decision on every sealed or registered artefact

- **Check.** Every sealing, enlargement, registration and go decision has an audit entry whose user input is the author's own words, not "(none; option A taken under 'max progress')", with timestamps taken from the commit.
- **Why.** The hold-out was enlarged by the AI "without an explicit author decision" (`holdout-prespec.md:23`; `sealed-hashes.md:30`); audit timestamps do not match commits (`sealed-hashes.md:32`, and out-of-order entries such as `audit.md:1185`).
- **Verify.** `git log` of the gate, prespec and pre-registration commits; matching audit entries.
- **Pass.** Every such artefact carries an author decision dated before use.
- **Status.** RED (the hold-out history already fails this; it must be declared, and every future artefact must pass).

### S14. Sealed task list intact and access controlled

- **Check.** The person who unseals the Study 2 tasks verifies their sha256 against `sealed-hashes.md:7` (`82a2f512…169c`) and states that no v1.3 generation used them; the tasks file is materialised outside the repo and outside every agent cwd; the agent never receives its path.
- **Why.** The pilot's sealed-list check and the coordinator's knowledge of the tasks (`pilot-tasks.md:8`; V13-TV-I5, `threats-register.md:298-312`); outline prerequisite 8 (`study2-outline.md:179`).
- **Verify.** `sha256sum ../daedalus-sealed/v1.3-study2-tasks.md` **run by the unsealer, not by an agent**, output committed; the plan's `tasksFile` path is outside the repo.
- **Pass.** Hash equal; signed statement.
- **Status.** UNKNOWN (not verifiable from the repo; not opened for this gate).

### S15. Model-based labeller or judge routes

- **Check.** Any model used to label or judge Study 2 output runs on a route whose tools are verified off, with its account tier and quota confirmed for the full planned volume before the first call.
- **Why.** The Gemini CLI halted on its tier (`audit.md:1195`); the labeller route changed mid-study (ADR-035, `audit.md:1389`); tools ran although "disabled" (`audit.md:1376`); the Codex labeller hit a limit with "try again at Nov 9th" (`v1.3-labelling-2026-10-15.md:143`); experiment A stopped on its budget rule with an averaging defect (`audit.md:1413`).
- **Verify.** A tools-off probe log and a quota statement per route.
- **Pass.** As in Check, or no model labeller is used (the primary labelling is the deterministic `check-correct.ts`, memo §3).
- **Status.** UNKNOWN.

---

## 4. D. Study 2 design requirements

### D1. Outcome variance shown in the pilot

- **Check.** The pilot has run, its memo §3 primary outcome is reported per task, and the §5 decision (blocking or advisory primary outcome) is recorded; the pilot gives the SD of per-run slopes and the count dispersion θ.
- **Why.** E1 had zero blocking findings in all 65 accepted cells (`study1-addenda.md:16`; `Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md:83-90`): a floor effect that made the primary contrast unmeasurable. Power depends most on θ (`study2-power-notes.md:122-123`).
- **Verify.** The pilot report and its per-run slope table.
- **Pass.** Pilot complete; §5 decision recorded; if the advisory branch is taken, the pilot shows the advisory density growing per step (the fallback "is only useful if a pilot shows advisory density growing fast per step", `study2-power-notes.md:99-102`), otherwise this line is red.
- **Restated 2026-10-16 (deviation record §2).** The advisory branch is no longer a Study 2 primary, so it cannot be run as one. D1 passes only if all of: (i) the memo §5 branch is recorded from the DDD re-score on `v1.3` (Neo4j); (ii) the validation pilot (`floor-escape-design-2026-10-16.md` §4) has run under its pre-committed rule and at least one confirmatory stratum passes its escape and validity criteria; (iii) the pilot reports the step-4 Y mean and θ per stratum. If no stratum passes, this line stays red and Study 2 does not run.
- **Status.** RED. The loop pilot ran (#170); the §5 branch is zero on the #229 re-score, not yet on `v1.3`; the validation pilot has not run.

### D2. Task prompts and frames audited for hidden structure hints

- **Check.** The sealed tasks, the step and repair frames, the tool sentence and any acceptance-check text are audited against `pilot-tasks.md` §1 ("never name a layer, a port, an interface or a pattern", `:10`); the frames are identical across arms apart from each arm's declared sentence.
- **Why.** Addendum A1: a shared sentence silently gave every Study 1 arm the same structure. The repair prompt now adds plain-language rule lines (`loop-pilot-readiness.md:31`), which must describe the rule and never name a fix.
- **Verify.** For the frames: `npx jest tests/unit/scripts/loop/pilot.test.ts` (frame and argv identity). For the sealed tasks: the unsealer's audit sheet (term list, verdict per step), stored outside the repo with its sha256 committed.
- **Pass.** No banned term in any task step; frame identity tests pass. *(2026-10-16: frames are identical across arms **within each spec rung**; the rung content (L2, L3, L4) differs by design and is hint-audited per rung.)*
- **Status.** UNKNOWN (frames tested; sealed tasks not audited).

### D3. Power: required N ≤ budgeted N

- **Check.** The power simulation is re-run with the pilot's θ, slope SD and erosion rate, and the chosen design reaches power ≥ 0.80 for each confirmatory contrast under the chosen correction, within the approved budget. *(2026-10-16: for Y, the simulation is `scripts/v1.3/level-power-sim.ts` with the validation pilot's mean and θ per stratum; a contrast below 0.80 is demoted to secondary before D10, so it is not a confirmatory contrast. The pass rule is unchanged.)*
- **Why.** At the outline's working grid (option B, 162 runs) power is 0.54 for `gate` halving the slope and 0.18 for `mcp` at a quarter; no option reaches 0.80 except under Poisson counts; the task-level test has power 0 with 6 tasks because the smallest two-sided p is 0.031 (`study2-power-notes.md:79-85`, `:106-123`). Study 1's SO4 already fell under its own floor (N = 75 < 80, `audit.md:1235`; TV-17).
- **Verify.** `npx tsx scripts/v1.3/study2-power.ts --sims 400 --flips 999 --seed <seed> --out results/v1.3-study2-gate/power.json --md-out results/v1.3-study2-gate/power.md` with the pilot parameters.
- **Pass.** Power ≥ 0.80 for every confirmatory contrast at the registered N; budgeted N (D4) ≥ 1.1 × the required N (margin for failed runs); the confirmatory unit (block or task) and the correction stated so the test can attain significance with 6 clusters.
- **Status.** RED (0.54 at the working grid; `mcp` undetectable).

### D4. Cost and time budget per run

- **Check.** From the rehearsal, the cost (API-equivalent USD), tokens incl. cache, wall time, repair-turn share and usage-limit pauses per step turn are measured per model; the projected Study 2 total, its calendar time under the subscription's usage windows, and a stop rule are approved in writing (NFR-V4 escalation, `study2-outline.md:137-139`).
- **Why.** The outline guesses 2–6 USD per turn and 1.5k–6k USD for the grid (`study2-outline.md:137`); Study 1's experiment A ran out on its registered budget with 25/42 valid reviews (`audit.md:1413`); the judge CHECK stopped on a session limit (`call-ledger.json`, PR #126).
- **Verify.** The rehearsal cost table (D9 output); the approval commit.
- **Pass.** Projected total ≤ approved budget with ≥ 20 % margin; projected calendar time written; the stop rule says what happens on budget exhaustion (complete blocks only, never partial arms).
- **Status.** RED (no measured per-turn cost).

### D5. MCP latency per step

- **Check.** In the live loop, each `daedalus-mcp` tool call's latency is logged, and per step the tool time stays small next to the model turn.
- **Why.** If tools are slow the agent may abandon them, which turns a treatment into non-adoption (`study2-outline.md:151`).
- **Verify.** Bench: `npm run build && npx tsx scripts/v1.3/mcp-latency.ts --runs 5 --infer-runs 3 --stdio --check` (`mcp-v2.md:222`). Live: the MCP call log (D6) of the rehearsal.
- **Pass.** p95 per call ≤ 1 s, and total tool time ≤ 5 % of the step's wall time, on the rehearsal.
- **Status.** UNKNOWN. Bench part green: p95 `check_file` 15.7 ms, `check_diff` 45.2 ms, stdio start-up 788 ms (`mcp-v2.md:183-199`); replay ~1 ms warm (`loop-replay.md:107`). No live measurement.

### D6. Loop telemetry complete, including the MCP call log

- **Check.** A completeness checker passes over the out-root: every live turn has non-null tokens (input, output, cache read, cache creation), `costUsd`, `numTurns`, wall time, attempts, interruptions with pause durations, prompt sha256 and text; every gate step has `repair` and `repairOutcome`; every `daedalus-mcp` turn has its call log (tool, args digest, latency, before/after first write) stored outside the agent's cwd.
- **Why.** Outline prerequisite 5 (`study2-outline.md:174`); Q3 and the process outcomes need the call log (`:78`); the step-level cost sum omits cache tokens (`scripts/lib/loop/loop.ts:382-387`); the MCP server writes no log (`src/mcp-server`, no append or jsonl writer); Study 1 lost judge joins because cassette keys were shared across cells (`audit.md:1352`).
- **Verify.** A `loop-telemetry-check` script (to be written) with exit 0 on the rehearsal out-root.
- **Pass.** Exit 0; zero missing fields; one call-log line per tool call reported by the CLI envelope.
- **Status.** RED (no checker, no call log).

### D7. Reproducibility

- **Check.** Model ids, CLI versions (S2), Node, `package-lock.json`, the Neo4j image digest and APOC version are recorded in every run's provenance; re-scoring every kept snapshot from its commit gives byte-identical evaluations; the scripted replay passes on the run commit.
- **Why.** Generation cannot be replayed; the snapshots are the record. PR #142 found snapshot commits were not reproducible (clock dates) and that step records could not support the memo's outcomes (`loop-replay.md:122-131`). Study 1's reproduction audit found hybrid tables and code drift (`reproduction-audit-2026-10-10.md:185-222`).
- **Verify.** `npm run loop:replay -- --report <tmp>/replay.json` and `npm run test:loop-replay` (PR #142); a re-score of the rehearsal snapshots compared with `diff -r` ignoring only timing keys.
- **Pass.** Replay exit 0; re-score byte-identical apart from timing keys; provenance complete. Environment pins per `Docs/environment.md:30-32` (`neo4j:5.26-community@sha256:f66304b9…`, kernel and APOC 5.26.24).
- **Status.** RED (PR #142 open; Claude CLI unpinned).

### D8. Neo4j is the engine of record; interpreter parity on Study 2 snapshots

- **Check.** The pre-registration names Neo4j 5.26.24 (pinned digest) as the engine for every reported number. If the in-process interpreter is used anywhere in the loop (for example inside the MCP server or after PR #135 makes it a default), parity is shown on every rehearsal snapshot.
- **Why.** "Neo4j stays the reference engine for every reported number" (`Docs/v1.3/cypher-interpreter.md:3-4`); its parity evidence is development-set only (`:14-19`). A different engine in the treatment (MCP) than in the outcome would recreate the V9 problem.
- **Verify.** `node --import tsx scripts/v1.3/memory-parity.ts --engine cypher-interp --out results/v1.3-study2-gate/parity` over the rehearsal snapshots (`cypher-interpreter.md:153`).
- **Pass.** 0 content, 0 error, 0 unsupported differences; engine of record in the provenance of every step.
- **Status.** UNKNOWN (CLI default is `neo4j`, `src/cli/cli.ts:188`; no parity on loop snapshots).

### D9. Analysis script run end to end on rehearsal data

- **Check.** One committed script reads an out-root and produces every final table and figure of the planned report: per-run slopes, the paired sign-flip test with the registered correction, the cluster bootstrap, the task forest plot, the GLMM if registered, repair success, cost, guards, held-out measures, per-model and per-arm missingness.
- **Why.** Nothing turns step records into tables today (only `pilot-metrics.ts` on PR #142). Study 1's SO4 table mixed two scoring regimes and its summary carried an averaging defect (`reproduction-audit-2026-10-10.md:185-193`; `audit.md:1413`).
- **Verify.** `npx tsx scripts/v1.3/study2-analyse.ts --out-root <rehearsal> --out results/v1.3-study2-rehearsal/tables` (name to be fixed), plus the same on a synthetic out-root with a planted effect (the power simulator's generator), where the planted effect is recovered.
- **Pass.** Every table named in the pre-registration is produced; the planted-effect check recovers its effect within the simulation's interval; the script's hash is frozen (S11).
- **Status.** RED (script does not exist).

### D10. Pre-registration content complete

- **Check.** The pre-registration (written later, as its own author-approved step) contains: hypotheses and the confirmatory contrasts; the primary outcome Y as defined in the deviation record (`study2-deviation-2026-10-16.md` §2), with the memo §5 branch result and the memo §5 outcomes as registered secondaries, and the deviation itself disclosed with its timeline (amended 2026-10-16; the original text said the primary outcome was the memo's); arms (D11, S5); tasks by hash only; models and pins; R, k and the N justification (D3); analysis, correction and confirmatory unit; exclusions, missing steps and resume rules (`study2-outline.md:100-103`); the stop rule (D4); the frozen-tunables table (S11); deviations procedure; this gate's go commit.
- **Why.** Study 1 needed 25 prereg versions and several post-hoc ADRs (`corpus/prereg.json`, version 25; ADR-024/025/026/032/033).
- **Verify.** A checklist review against this list, by the author and one other reader, recorded in the go commit.
- **Pass.** Every item present.
- **Status.** RED (no pre-registration exists, by the author's decision; `study2-outline.md:3-6`).

### D11. Arm set resolved

- **Check.** Decided before the rehearsal: (a) the self-review placebo for `gate` (in or out); (b) under the advisory branch of memo §5, whether `gate` gets the advisory subset or is dropped (`pilot-outcome-memo.md:64`); (c) a per-task spec for `daedalus-mcp`, which a plan with `taskProfiles` currently refuses (`loop-pilot-readiness.md:73`); (d) S5.
- **Why.** The extra repair turn confounds feedback with compute (`study2-outline.md:62-65`, `:148`). Without (c), Study 2 cannot run `daedalus-mcp` on styled tasks at all.
- **Verify.** The rehearsal plan loads with every chosen arm and every style (`loadLoopPlan` exits 0).
- **Pass.** All four decided in writing; the plan loads.
- **Status.** RED. 2026-10-16: (a) placebo out and (b) `gate` dropped, both by the deviation record; the arms are `none` and `daedalus-mcp`. (c) per-task MCP spec and (d) S5 are still open.

### D12. Feature-dropping guard  [W]

- **Check.** Per-step acceptance checks (small behavioural tests per step, never shown to the agent) are written with the sealed tasks and sealed the same way, and the harness runs them on every snapshot.
- **Why.** An agent can lower violations by dropping features (`study2-outline.md:80-82`, `:147`).
- **Verify.** Acceptance results present in every rehearsal step record.
- **Pass.** As in Check. **[W]**: the author may rely on LOC and file trajectories only, declaring the residual in writing.
- **Status.** RED (no acceptance-check code).

### D13. Gaming guards recorded per step

- **Check.** Each step records the layer-coverage share (files matching no layer, context or `outside_contexts` glob), skeleton integrity, files and LOC, and the counts of dynamic `import()`, `require()` and barrel files.
- **Why.** `study2-outline.md:146`; the Study 1 coverage gaps of V8.
- **Verify.** `jq` over the rehearsal step records.
- **Pass.** Present on 100 % of records.
- **Status.** RED (on `v1.3` the evaluation record has no coverage share or import-kind counts; PR #142 adds the coverage share).

### D14. Harness green: unit tests, dry run, live resume

- **Check.** Loop unit tests pass; the dry run completes; a live run killed mid-step resumes from its last snapshot with no duplicated or lost step (outline prerequisite 6, `study2-outline.md:175-176`).
- **Why.** Study 1 had a Jest SIGSEGV in 2 of 3 full runs (`audit.md:1179`) and a dry run that used fixtures and so missed the tsconfig gap (ADR-032).
- **Verify.** The three commands at the top of this file; the rehearsal's resume drill (rehearsal §4.3).
- **Pass.** All three.
- **Status.** PARTIAL. Unit tests GREEN (61/61) and dry run GREEN (exit 0, 24 step and 6 repair turns) on 2026-10-16; live resume RED (never exercised). Note: `loop-pilot-readiness.md:101` says 4 repair turns; the dry run now makes 6 (as PR #142 also notes).

### D15. DDD spec-freeze failure mode decided

- **Check.** A written decision on what happens when a DDD run's step-1 tree cannot yield a valid frozen spec (single context, flat domain files).
- **Why.** The freeze then fails and the run is recorded but unscored (`loop-replay.md:140-143`); in the real study that would be a missing run whose rate may differ by arm.
- **Verify.** The decision text in the pre-registration; a rehearsal DDD run shows the chosen behaviour.
- **Pass.** Decision written; freeze failure rate reported per arm by D9.
- **Status.** RED.

### D16. Q4 independent measures computed per step

- **Check.** Held-out rules and dependency-cruiser violations under the same spec (ADR-030 translation) are computed for every snapshot.
- **Why.** Circularity: the rules that give feedback also give the score (`study2-outline.md:145`); Q4 needs these measures (`:28-29`, `:77`). In Study 1 dependency-cruiser caught what the tool missed (`audit.md:1344`).
- **Verify.** Presence in the step records or in a post-hoc scorer run over the snapshots, before any arm comparison is read.
- **Pass.** Present for every rehearsal snapshot; held-out rule list hashed (S11).
- **Status.** RED (not in the loop).

---

## 5. What the go commit contains

1. This file with every status GREEN (or a dated **[W]** waiver where allowed).
2. `results/v1.3-study2-gate/<line-id>.txt` for each line, regenerated at the run commit.
3. The run commit sha, the pre-registration sha256, and the sealed-task hash check output (S14).
4. The author's statement: "All lines of the Study 2 readiness gate are green at `<sha>`. Go." No AI session writes this sentence.
