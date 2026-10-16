# v1.3 gap-closing plan: SO2–SO5 to the single Study 2 run

**2026-10-16. Status: plan for the author and the director meeting. Documentation only. Nothing here has run. This is not a pre-registration.** It is the P1 item of the night plan (`aidlc-docs/construction/plans/v1.3-night-2026-10-16-plan.md:95`).

**Sources.** Every PR opened into `v1.3` on 2026-10-15/16 was read, #87–#191: 105 PRs. On GitHub, 54 are closed (all merged) and 51 are open. #135 is listed open but was merged into `v1.3` by the late merge train (`3292ebed`). Citations work like this:

- `path:line` is on `origin/v1.3` (tip `db75b708`).
- `branch:path:line` is on the head branch of a PR that is still **open**. Such a number is **not on v1.3 yet**.

Numbers are quoted from the docs. Where no run exists the plan says **pending**. Effort figures are this plan's estimates, not measurements.

**Owners.**

- **[A]** author decision.
- **[C]** cloud job: an AI session; no login or key the cloud lacks; never touches sealed material.
- **[L]** local run: the author's machine, logins or keys, Neo4j, or sealed material.

**Fixed constraints.**

- Study 2 runs exactly once.
- Labels from the author or the director carry little authority, so validity rests on non-human evidence.
- Side tracks (frontend, product polish) are parked.

**Gate.** The readiness gate exists only on open PR #146 (`v1.3-study2-readiness:Docs/v1.3/study2-readiness-gate.md`). It is not on `v1.3`, and merging it is step P0 below.

---

## 0. One-screen summary

| SO | Claim (short) | Now | Gap | Closing move |
|---|---|---|---|---|
| SO1 | specs and style libraries | met ("met with margin" is the author's status; the docs say "met": `v1.3-research-gaps:Docs/v1.3/research/research-gaps-and-evidence.md:32`) | none blocking (8 blocking rules without a source row, `:32`; open #136) | none needed; out of scope here |
| SO2 | property graph | met but reframed (data flow → type flow) | real-world value of type flow has no precision figure | one deterministic precision check on the wild type-flow rows ([C]) |
| SO3 | neuro-symbolic gate | 16/21 = 0.76 vs 0.80; v2/v2.2 not better; DDD judged only on open #191 | below target; registered headline (judge vs panel) is empty | stop tuning; narrow the claim to complementarity; one real panel run ([L]) |
| SO4 | validity | sealed hold-out not run; no labels | the one unrun step, plus "meaningful" | construct sheet → freeze → hold-out once ([A]→[L]); non-human evidence pack ([C]) |
| SO5 | spec level vs architecture | done but weak (folder hint in `none`; E1 floor) | floor persists in every probe; power 0.54 | fix pilot T1, apply the memo's pre-committed §5 rule, task design, rehearse, run Study 2 once |

---

## 1. Per objective: claim, evidence, gap, steps

### SO3: the neuro-symbolic gate (LLM judge)

**Target claim.** The judge catches planted anti-patterns at a rate of at least 0.80, reported per operator. Source: `aidlc-docs/inception/requirements/v1.3-validity-requirements.md:47` ("| Judge | Catch rate on anti-pattern seeds | ≥ 0.80 (reported per operator) |"). This is a requirements exit target, not a pre-registration (`Docs/v1.3/judge-catch-frozen.md:3`).

The registered SO3 headline is different. It is judge-vs-panel agreement on E1 units (`Docs/analysis-plan.md:220`).

**Evidence in hand.**

Catch rate (merged on `v1.3`):

- **Defensible claim: 16/21 = 0.76 [0.55, 0.89].** These are FRAMEWORK-LEAK and PERSIST-IN-DOMAIN, both rounds pooled. Round 2 alone is 13/16 = 0.81 [0.57, 0.93]. "Neither lower bound reaches 0.80." Sources: `Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md:4-7`, and the same note in `…judge-catch-round2-2026-10-15.md:5` and `…duprule-v2-2026-10-15.md:5`.
- The pooled 30/35 = 0.86 [0.71, 0.94] "is not a construct-sensitivity estimate" (`…judge-catch-2026-10-15.md:3`).

Judge versions:

- **Judge v2.1 on CHECK:** catch 14/14 vs v1 13/14. Clean false fails 4/26 vs 2/26. "CHECK does not show v2.1 is better or worse than v1" (`Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md:98-99,125`). The CHECK split is spent (`:182`).
- **Judge v2.2 on CHECK-2 (open #191): NOT CANDIDATE. Check D1 fails.** Layered business clean units false-fail 7/21 under v2.2 against 10/21 under v1, where the rule needs ≤ 1 (`v1.3-judge-v22-run:Docs/DiagnosticRuns/v1.3-judge-v22-check2-2026-10-16.md:9,14`).
  - Both judges catch 40/40.
  - Clean false fails are v1 16/48 = 0.33 and v2.2 8/48 = 0.17 (`:62-63`).
  - CHECK-2 has "no usable FF-N01 evidence" (`:106`).

DDD:

- **On v1.3:** "the DDD preset was never judged" (`…duprule-v2-2026-10-15.md:3`).
- **On open #191:** first judged DDD run. v1 catches 4/4 with clean false fail 1/6 = 0.17 [0.03, 0.56]; v2.2 catches 4/4 with 0/6 (`v1.3-judge-v22-run:…check2-2026-10-16.md:122-123`).

Complementarity (open #179):

- Judge catch given that the symbolic arm is blind: **22/26 = 0.85 [0.66, 0.94]** (`v1.3-complementarity-matrix:Docs/DiagnosticRuns/v1.3-complementarity-2026-10-16.md:49`).
- On the restricted FRAMEWORK-LEAK cut it is 8/12 = 0.67 [0.39, 0.86] (`:53`).
- Judge false fail given that the symbolic arm passes: 3/60 = 0.05 (`:96`).

Selective prediction (open #165):

- The rule is not met. v1 scores 0.883 with a lower bound of 0.778; v2.1 scores 0.900 with a lower bound of 0.7985 (`v1.3-judge-selective-prediction:Docs/DiagnosticRuns/v1.3-judge-selective-2026-10-16.md:50-51`).
- Errors are "systematic, not stochastic" (`:66`).

Registered headline and labels:

- Judge-vs-panel agreement is **empty** (n = 0, `results/e1-grid/agg/agreement.csv:3-4`).
- The panel harness exists but has only been dry-run: "No real model has been called" (`Docs/v1.3/model-panel.md:3`).
- Codex meaningful labels: "Not measured … usage limit" (`Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md:7`).

**Remaining gap.**

1. The catch target is not met at the point estimate on the defensible cut, and not met at any lower bound.
2. Two tuning rounds (v2.1, v2.2) did not beat v1, and both check splits are spent.
3. The registered headline has no data.
4. DDD evidence exists only on an open branch.

**Minimal steps, in order.**

| # | Step | Owner | Effort (est.) | Pass criterion (fixed now) |
|---|---|---|---|---|
| 3.1 | Decide the SO3 claim. Recommended: v1 stays the frozen judge and SO3 is reported as **"below target (0.76 < 0.80), complementary to the symbolic arm"**, with 22/26 and the #165 negative result. No v2.3/CHECK-3. (Decision 2) | [A] | 30 min | Decision committed as a dated note before the freeze (gate V7 is [W]: it may be closed by a written waiver, `v1.3-study2-readiness:Docs/v1.3/study2-readiness-gate.md:21`). |
| 3.2 | Merge #179 and #165 as **exploratory results**; neither touches `src/`. #191 is not docs-only: it changes 9 `src/` files, adding `judge-v22.ts` and `context-v22.ts` and changing `llm-critic.ts`, `judge-stage.ts`, `judge-v2.ts`, `types.ts`, `cli.ts`, `llm-options.ts` and `evaluation.ts`. That code adds an opt-in `--judge-version v2.2` and keeps `v1 (frozen, default)`. So either merge #191 whole as opt-in code, or take only its result docs. Either way the step must land **before the freeze**. This puts the first DDD judgement and the complementarity number on `v1.3`. | [C] merge train | 1–2 h | Docs on `v1.3`; `npm test` green; #179 and #165 change no file under `src/`; if #191's code is merged: the default judge is still `v1`, and default `evaluate` output (no `--judge-version`) is byte-identical on the 71 reference variants before and after the merge. |
| 3.3 | Real model-panel run (Gemini, OpenAI/Codex and Claude) on the union sheet plus 15+15 decoys. This yields the meaningful label and the registered judge-vs-panel headline, both from non-human raters. It needs a new Gemini key (night-plan decision 7). | [L] | half a day plus a few USD (est. from `Docs/v1.3/model-panel.md:198-208`) | Panel authority rule `panel-authority-v1` as already committed (`Docs/v1.3/model-panel.md:3`); report judge-vs-panel κ with its interval whatever its value. **Pass = the number exists and is reported.** No threshold is invented now. |
| 3.4 | Write the SO3 section from 3.1–3.3: limits, same-vendor threat V10. | [C] | 2 h | Every number cites a committed file; the words "met" or "validated" do not appear for SO3. |

### SO4: validity of the findings

**Target claim.** Blocking findings are valid on unseen projects. Per the hold-out pre-spec (`Docs/v1.3/holdout-prespec.md:65-67`):

- M1 blocking recall per style ≥ 0.90;
- M2 and M3 blocking precision ≥ 0.90;
- M7 adjudicated edges and layers ≥ 0.95.

Each is checked at the point estimate and at the Wilson lower bound.

**Evidence in hand.**

The hold-out has not run:

- It is sealed: 207 cases, hashes recorded late (`Docs/v1.3/sealed-hashes.md:11,25`).
- The pre-spec is "draft, to be frozen" (`Docs/v1.3/holdout-prespec.md:3`).
- The freeze dry run (open #164) reports "9 of 14 unmet: F1, F2, F3, F4, F8, F9, F10, F11, F12" (`v1.3-freeze-dryrun:Docs/v1.3/freeze-runbook.md:299`).
- On a synthetic stand-in, the runner recovers the planted miss (M1 = 0.929, 13/14; `:343`).

The construct sheet is unanswered. All 25 questions are open; the high-stakes ones are Q3, Q5, Q10, Q2, Q8+Q14, Q6 and Q13 (`Docs/v1.3/construct-decisions.md:32-38`).

Labels: there are none.

- Meaningful labels are not measured (`Docs/DiagnosticRuns/v1.3-labelling-2026-10-15.md:7`).
- Fidelity `human_verdict` is empty in all 2,135 rows (`v1.3-fidelity-adjudication:Docs/DiagnosticRuns/v1.3-fidelity-adjudication-prep-2026-10-16.md:9`).
- The wild review sheet has 68 candidates and no verdicts (`Docs/DiagnosticRuns/v1.3-wild-2026-10-16.md:276`).

**Non-human evidence already produced** (exploratory unless noted):

- **Convergent validity (merged #166).** κ of our findings against three other tools, per corpus (`Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md:17-19`):

  | κ, ours vs | reference | external | wild |
  |---|---|---|---|
  | dependency-cruiser | 1.000 | 0.961 | 0.913 |
  | eslint-plugin-boundaries | 1.000 | 0.930 | 1.000 |
  | ArchUnitTS | 1.000 | 0.918 | 0.950 |

  57 of 89 rule×style rows cannot be expressed in any of the three tools (`:34-38`). "Agreement is not correctness" (`:354`).
- **External correctness (open #167; criterion fixed before the check).** "Pass criterion (§1): met. 283 of 283 labelled". All blocking findings: 283 correct, 1.000 [0.987, 1.000] (`v1.3-external-correctness:Docs/DiagnosticRuns/v1.3-external-correctness-2026-10-16.md:40,44`). The negative control passed (`:55`).
- **External set wave 2 (open #181).** 342 more blocking findings. The pooled fail rate over 35 projects is 0.857 (0.706 to 0.937), with 625 blocking findings (`v1.3-external-set-2:Docs/DiagnosticRuns/v1.3-external-set-2-2026-10-16.md:241`). Their correctness check is **pending**.
- **Metamorphic testing (open #185).** "637 of 655 applicable cases are invariant (0.973)" (`v1.3-metamorphic:Docs/DiagnosticRuns/v1.3-metamorphic-2026-10-16.md:98`).
- **Rule mutation (open #190).** The validation set kills "90 of the 273 (33%)" strictly (`v1.3-rule-mutation:Docs/DiagnosticRuns/v1.3-rule-mutation-2026-10-16.md:9`), with "14 items" of real blind spots (`:16`).
- **Mined fixes (open #168; protocol fixed first).** "**No robust validity signal.**" The 2.65× ratio "rests on **one commit**" (`v1.3-validity-fixes-mined:Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md:9`).
- **K2 spec-author reliability (open #186; criterion fixed first).** "**Not reliable at this threshold.** Pooled file-to-layer κ = **0.77** … **4 of 15** repos reach κ ≥ 0.80" (`v1.3-spec-author-reliability:Docs/DiagnosticRuns/v1.3-spec-author-reliability.md:8-9`).
- **Graph fidelity under the views `evaluate` actually uses** (open #149): 1.000 / 1.000 against tsc on 15 projects (`v1.3-default-view-coverage:Docs/DiagnosticRuns/v1.3-default-view-coverage-2026-10-16.md:14-17`).

**Remaining gap.**

1. The sealed hold-out, the step on which "construct and criterion validity … depend" (`v1.3-validity-strategy:Docs/v1.3/validity-strategy.md:44-46`), has not run.
2. "Meaningful" is unmeasured.
3. M7 asks for *adjudicated* fidelity, and no adjudication exists.
4. Structural limit: with n < 35 expected blocking findings in a style, the lower-bound check "cannot pass, even with a perfect result" (`Docs/v1.3/holdout-prespec.md:73`). The dev stand-in had n = 8–13 per style (`results/v1.3-reference/holdout-runner-standin/README.md:18-19`). The hold-out's per-style n is filled at the freeze (`<N_PER_STYLE>`) and is **pending**.

**Minimal steps, in order.**

| # | Step | Owner | Effort (est.) | Pass criterion (fixed now) |
|---|---|---|---|---|
| 4.1 | Answer the score-free construct sheet (#129): the 7 high-stakes questions by hand; accept the listed safe defaults for Q1, Q4, Q7, Q9, Q11, Q12 and Q17–Q24 (`Docs/v1.3/construct-decisions.md:40`). (Decision 1) | [A] | 2–3 h | Every `[Answer]:` filled in `Docs/v1.3/construct-decisions-answer-sheet.md`; committed before any further dev-set score is seen. |
| 4.2 | Write ADR-V13-03 from 4.1; set the construct switches (#124) to the answers; run the single dev-set runs required by Q16 and Q25. | [C] code + [L] dev runs | 1 day | ADR-V13-03 "Accepted"; freeze-check F4 OK. |
| 4.3 | Decide M7's oracle (Decision 3). Recommended: M7 rests on mechanical agreement with `tsc` (#149) and dependency-cruiser (#166), and the 235-item human review sheet is dropped as the authority. | [A] | 30 min | Dated addendum to `holdout-prespec.md` committed **before the freeze**. |
| 4.4 | Merge train for the freeze tooling and evidence: #164 (runbook, freeze-check), #133+#167 (external set and correctness), #175 (leakage), #173 (tunables), #174 (unsealer). | [C] | half a day | Each merged with tests green; `freeze-check` runs on `v1.3`. |
| 4.5 | Freeze (commits X and Y per `holdout-prespec.md:18`); fill `<N_PER_STYLE>` from the sealed counts. | [L] | 2 h | `freeze-check`: 14/14 OK (F14 included); `git diff X Y -- src scripts presets specs` empty. |
| 4.6 | **Run the hold-out once** (Neo4j engine of record) plus the determinism repeat; commit the outputs before any reading; blind re-score. | [L] | half a day | Pre-spec M1–M7 as written. A miss is reported as "characterised", never tuned (`holdout-prespec.md:87-91`). |
| 4.7 | Deterministic correctness check of the wave-2 342 findings, reusing the #167 checker and criterion. | [C] | 2 h | Same §1 criterion as #167, committed before the check. |
| 4.8 | The external non-Claude arm the pre-spec recommends (`holdout-prespec.md:27`): the #166 dependency-cruiser translations scored on the external set as a separate arm. | [C] | already measured; 1 h to report | Reported as a separate arm; not pooled with the hold-out. |
| 4.9 | Meaningful label from the panel (step 3.3; one run serves both SO3 and SO4). | [L] | see 3.3 | Per-rule meaningful rate with Wilson interval, reported under the committed authority rule. |
| 4.10 | SO4 validity synthesis (night-plan C1): one table of strands, with hold-out, convergent, external correctness, metamorphic, mutation, mined fixes (negative) and K2 (failed). | [C] | 3 h | The negatives (#168, #186, #190's 33%) appear in the table with their own numbers. |

### SO5: spec level vs generated architecture

**Target claim.** The spec level given to a generator changes the architecture it produces. Study 1 (E1) is descriptive. Study 2 runs the firewall in the loop, exactly once.

**Evidence in hand.**

E1:

- **The E1 floor.** "The count is 0 of 65 accepted cells, and 0 of all 72" (`Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md:88`). The direction "lives entirely in the advisory tier" (`:91-94`).
- **The folder hint in `none`.** "Claims about how LLMs behave 'without any spec' … are **not tested** by E1" (`Docs/v1.3/study1-addenda.md:15`). See also `Docs/generator-protocol.md:75`.

Floor probes:

- **Floor probe 1 (merged #161):** "14 / 28 (50 %): hexagonal 0 / 14, layered 14 / 14" (`Docs/DiagnosticRuns/v1.3-floor-probe-2026-10-16.md:15`). This is a step-1 level effect, not an erosion slope (`:22`).
- **Floor probe 2 (open #182):** C1 1/8, C2 0/8, C3 0/8 (`v1.3-floor-probe-2:Docs/DiagnosticRuns/v1.3-floor-probe-2-2026-10-16.md:16-18`). This is below the pre-stated ≥ 3/8, so the plan's rule says "keep the frame and move the lever to task design (W3-3)" (`v1.3-floor-probe-2:…floor-probe-2-plan.md:85-87`).
- **Precedent probe (open #189):** 0/8 planted vs 0/8 control, "Null" (`v1.3-precedent-probe:Docs/DiagnosticRuns/v1.3-precedent-probe-2026-10-16.md:16-18`).

Pilot (open #170):

- "**The §5 decision is not reached.**" (`v1.3-pilot-run:Docs/DiagnosticRuns/v1.3-loop-pilot-2026-10-16.md:7`).
- The DDD snapshots are unscored because of tool defect T1, the frozen spec inferring no aggregates (`:25`).
- Cost was "6.34 USD in total" (`:76`).

Power:

- Option B gives gate 0.54 and mcp 0.18; option C gives 0.77 and 0.33 (`Docs/v1.3/study2-power-notes.md:81-82`).
- The fallback (advisory) outcome has "almost no power" (`:99-102`); the rehearsal confirms ≈ 0.05 (`v1.3-study2-analysis-rehearsal:Docs/v1.3/study2-analysis-rehearsal.md:160-162`).

Gate and rehearsal:

- **Gate:** "NO-GO. 1 of 42 lines is green (V2), 1 is partly green (D14), 32 are red and 8 unknown" (`v1.3-study2-readiness:Docs/v1.3/study2-readiness-gate.md:3`). Statuses were taken at `4339bad5`, before #142 and several open PRs.
- **Analysis rehearsal (open #160):** "Assertions: 30 of 30 pass" on synthetic telemetry (`v1.3-study2-analysis-rehearsal:Docs/v1.3/study2-analysis-rehearsal.md:109`).

**Remaining gap.**

1. Study 2's primary (blocking) outcome is likely at the floor for hexagonal and Clean.
2. The only escape seen is a layered step-1 level effect.
3. The fallback outcome has no power.
4. The pilot did not reach its decision.
5. The S5 no-hint question is open.
6. The gate is 1/42.

**Minimal steps, in order.**

| # | Step | Owner | Effort (est.) | Pass criterion (fixed now) |
|---|---|---|---|---|
| 5.1 | Fix freezer defect T1 (DDD aggregates) on the dev set; re-freeze each DDD pilot run from its **same** recorded step-1 commit; score the 8 kept snapshots. This is option 1 at `v1.3-pilot-run:…loop-pilot-2026-10-16.md:32`. No new generation. (Decision 4) | [C] fix + [L] score | half a day | 8/8 DDD snapshots scored with 0 `evaluationError`; memo §5 decision written by the pre-fixed rule (`:19`). |
| 5.2 | Apply the pilot memo's pre-committed rule (Decision 5). This is not a free choice. If DDD `none` has 0 new blocking findings at steps 2–4, "the zero branch applies: Study 2's primary outcome moves to the advisory-tier erosion rate" (`v1.3-pilot-run:…loop-pilot-2026-10-16.md:19`; memo §5 at `Docs/v1.3/pilot-outcome-memo.md:52`). If it has 1 or more correct findings, the positive branch applies. The author's decision is only how to frame the zero branch; see Decision 5. | [A] | 1 h | Branch recorded mechanically from 5.1; framing addendum dated before the rehearsal; no relaxation of §5. |
| 5.3 | S5: keep the layout frame and record "no-spec" (thesis §16.1) as **not tested** in both studies. This follows the pre-stated rule of probe 2. (Decision 6) | [A] | 15 min | Gate S5 closed by a dated decision. |
| 5.4 | Task design W3-3: tasks whose natural implementation crosses a layer (the only lever not yet ruled out). Check against the sealed list; banned-term audit with #174. | [C] draft + [A] approve | 1 day | Unsealer audit FAIL 0 on the new tasks; author approval committed. |
| 5.5 | Re-run the power simulation with the pilot's θ and the chosen design; choose the grid (Decision 7). | [C] | 2 h | Gate D3: power ≥ 0.80 for the gate contrast, or a dated decision accepting less, with the number stated. |
| 5.6 | Close the open loop-harness lines: merge #171 (pins, isolation) and #180 (fault drills, 11/13), fix #180's R1–R4, and fix the MCP tool gap (`Docs/v1.3/loop-replay.md:135-139`; gate V9). | [C] | 1–2 days | #180 drills 13/13; V9 parity check green (#176's criteria at `v1.3-mcp-interp-parity:Docs/v1.3/mcp-interp-parity.md:100-121`). |
| 5.7 | **Dress rehearsal** per #146: 9 runs with 3 arms or 15 with 5, at the candidate run commit, 72–216 or 126–378 USD (`v1.3-study2-readiness:Docs/v1.3/study2-dress-rehearsal.md:45-46,120-121`). | [L] | 2 calendar days (`:130`) | Exit report `Docs/DiagnosticRuns/v1.3-study2-rehearsal-<date>.md`; every line it can turn green (`:140`) is green; 0 evaluation errors (S7). |
| 5.8 | Pre-registration (D10), its hash checked in CI (S10), tunables manifest written (S11). | [C] draft + [A] sign | 1 day | `study2-tunables.ts verify` passes; pre-registration hash committed before the go. |
| 5.9 | Gate re-verification at the run commit; [W] lines closed only by dated waivers; the author signs the go. | [L] + [A] | half a day | All 42 lines green or waived (only [W] lines), evidence in `results/v1.3-study2-gate/<id>.txt` (`study2-readiness-gate.md:22-23`). |
| 5.10 | **Study 2, once.** | [L] | per the chosen grid | As pre-registered. |

### SO2: real-world value of the property graph

**Target claim.** The APG represents architecture faithfully on real code and expresses relations that an import graph cannot.

**Evidence in hand.**

The reframing:

- Data flow is "near-empty on real projects" (`Docs/ADR — Architectural Decision Records Firewall Tech.md:1053`), with `edges_flows_to = 0` on every corpus project (`:1059`).
- Type flow (`SIGNATURE_USES`) replaces it (`Docs/v1.3/apg2-design.md:16,68-72`).
- APG v2 is OFF by default, "an author decision for later" (`apg2-design.md:33`).
- No doc states the reframing in one sentence. The thesis text should do so.

Wild set (merged #114; 14 public backends):

- v1.3 literal view: "0 scoped disagreements" with both references (`Docs/DiagnosticRuns/v1.3-wild-2026-10-16.md:108`).
- Type flow an import graph cannot see: "77 of immich's 191 type-flow rows … and 3 of medplum's 8" (`:225`).
- "No precision" (`:276`).

Engine and scale:

- **Interpreter parity (merged #128):** "65,254 statements, 79 projects: 0 content, 0 error, 0 unsupported" (`Docs/v1.3/cypher-interpreter.md:16`).
- **Fuzz (open #183):** 0 mismatches over 836,000 statements (`v1.3-interp-fuzz:Docs/v1.3/cypher-interp-fuzz.md:13`).
- **Scale (open #188):** median wall time falls from 51.2–77.2 s to 8.8–19.8 s (`v1.3-scale:Docs/v1.3/scale.md:8`).
  - Outputs are byte-identical on the 71 reference cases and 5 golden fixtures, and the APGs are byte-identical on the six large projects (`:12,86`).
  - Large-project **reports do change**, wherever a query that used to time out now completes. Verdicts follow: for example typeorm goes from `pass` to `hard-block` (`:91`).
  - So #188 changes evaluation results on large repos and counts as a tool change for the freeze.

APG v2 on the dev set: it "adds no planted catch that the v1.3 rules miss" (`Docs/DiagnosticRuns/apg2-live-2026-10-15.md:21`).

**Remaining gap.** On `v1.3` itself, the evidence for fidelity on real code is the merged wild run (#114, 0 scoped disagreements on 14 repositories) and the merged interpreter parity (#128). The external-set fidelity (#133, #149), the fuzz (#183) and the scale results (#188) are still on open branches. The graph's distinctive real-world value, type flow invisible to imports, has counts but **no precision**. No precision figure exists for APG v2 detections on real code.

**Minimal steps.**

| # | Step | Owner | Effort (est.) | Pass criterion (fixed now) |
|---|---|---|---|---|
| 2.1 | Deterministic check of the 80 wild type-flow rows with `_importGraphSees: false` (77 immich + 3 medplum): does the declared signature type resolve, via the TypeScript checker, to the cross-layer type the row names? Same design as #167, with a negative control. | [C] | half a day | Criterion committed before the check: precision-of-correctness reported with Wilson 95%; negative control of perturbed rows all "incorrect". Correct is not meaningful; that limit is stated. |
| 2.2 | Decide whether APG v2 / type flow is on at the freeze (Decision 8). Recommended: **off** for the hold-out and Study 2; report type flow as SO2 evidence only. | [A] | 15 min | Recorded before the freeze (freeze-check). |
| 2.3 | One sentence in the SO2 chapter stating the reframing, citing ADR-023 `:1053-1075` and `apg2-design.md:16`. | [C] | 30 min | Present; no claim of data-flow coverage on DI-style code. |

---

## 2. Critical path from today to the single Study 2 run

The order follows the gate's fixed rule 5: pilot → freeze/hold-out → rehearsal → pre-registration → gate → Study 2 (`v1.3-study2-readiness:Docs/v1.3/study2-readiness-gate.md:24`). Steps on the same line can run in parallel.

```text
P0  [C] Merge #146 (gate + rehearsal docs) and re-baseline the 42 lines on v1.3 tip
     |
P1  [A] Director meeting: decisions 1-8 below
     |
     +--> P2a [A] Construct sheet (4.1) --> [C]/[L] ADR-V13-03 + Q16/Q25 runs (4.2)
     +--> P2b [C]/[L] Pilot T1 fix + DDD re-score (5.1) --> memo §5 branch (5.2)
     +--> P2c [C] Merge train: #164 #133 #167 #175 #173 #174 #171 #180 #191 #179 #165
     +--> P2d [C] Wave-2 correctness (4.7), type-flow check (2.1)
     |
P3  [A] Pre-freeze addenda: M7 oracle (4.3), APG v2 off (2.2), SO3 claim (3.1), S5 (5.3)
     |
P4  [L] FREEZE (4.5)  -- freeze-check 14/14
     |
P5  [L] HOLD-OUT, ONCE (4.6)  -->  [L] Panel run (3.3/4.9)
     |
P6  [C]+[A] Task design W3-3 (5.4) --> [C] power re-run (5.5) --> [C] harness lines (5.6)
     |
P7  [L] DRESS REHEARSAL at candidate run commit (5.7)
     |      any code change after P7 re-reddens the affected gate lines
P8  [C]+[A] Pre-registration + CI hash + tunables manifest (5.8)
     |
P9  [L]+[A] Gate re-verify, all 42 green or [W]-waived; author signs the go (5.9)
     |
P10 [L] STUDY 2 -- exactly once (5.10)
```

**Notes on the path.**

- **The hold-out precedes the rehearsal.** The gate requires this. The hold-out does not depend on the Study 2 task design, so P5 and P6 can overlap.
- **The panel run (P5) is off the Study 2 critical path.** Gate V5/V6 needs an independent rater, so it must finish before P9.
- **Re-baselining the gate (P0) matters.** The 1/42 figure predates the merges of #142, #161 and #166. For example, S6 `advisoryByRule` is now on `v1.3` via #142.
- **The longest chain** is P2a → P4 → P5 and P6 → P7 → P8 → P9. The rehearsal's two calendar days and the author's construct sheet are the two items no cloud job can shorten.

---

## 3. Decisions only the author can take (for the director meeting)

Each decision gives its options and a recommendation.

1. **Construct sheet (25 questions, #129).**
   - Options: (a) answer all 25 by hand; (b) answer the 7 high-stakes questions by hand and accept the listed safe defaults for the rest; (c) defer.
   - **Recommend (b).** Deferring blocks the freeze, the hold-out and Study 2.
2. **SO3 claim.**
   - Options: (a) narrow the claim: v1 frozen, report 0.76 as **below target** and 22/26 as complementarity, closing gate V7 by a written waiver; (b) build v2.3 with a new CHECK-3 split, as #191's next steps propose; (c) drop SO3 to a design contribution.
   - **Recommend (a).** Two tuning rounds failed their own pre-stated rules (#126, #191), and #165 says the errors are systematic. Option (b) spends a third split and invites a forking-paths critique. Distinction readiness also says leaving this open is not defensible (`v1.3-distinction-readiness:Docs/v1.3/research/distinction-readiness.md:563-564`).
3. **Authority for M7 graph fidelity and for "meaningful".**
   - Options: (a) human adjudication by the author: 235 items plus 2,135 rows; (b) mechanical oracles for M7 (`tsc` and dependency-cruiser agreement) and the multi-vendor model panel for "meaningful"; (c) pay two external architects (the 80-item rating in `v1.3-validity-strategy:Docs/v1.3/validity-strategy.md:357`).
   - **Recommend (b), with (c) only if budget allows.** Option (a) carries little authority under your own constraint. Whatever is chosen must be written into the pre-spec before the freeze.
4. **Pilot T1.**
   - Options (`v1.3-pilot-run:…loop-pilot-2026-10-16.md:32-34`): (1) re-freeze from the same step-1 commits and score; (2) re-run DDD from scratch; (3) let the pilot stand on 2 tasks.
   - **Recommend (1).** No new generation and no memo change, and it reaches the pre-fixed §5 decision.
5. **Study 2 under the zero branch.** The outcome itself is fixed by the pilot memo §5 (step 5.2). If DDD scores 0, the primary outcome becomes the advisory erosion rate. That outcome has power ≈ 0.05 under default assumptions, a "costly null by design" (`v1.3-study2-analysis-rehearsal:Docs/v1.3/study2-analysis-rehearsal.md:160-162`). The pilot's advisory slopes without FF-CV05 in `none` were negative: −0.50 and −0.58 (`v1.3-pilot-run:…loop-pilot-2026-10-16.md:57,59`).
   - Options: (a) run Study 2 anyway on the advisory outcome, with the null pre-declared as interpretable, per G4: success is "a correctly run, pre-specified study whose result is reported"; (b) amend the memo by a dated addendum before the DDD score is seen. This is weak, because the Clean and Hexagonal pilot results are already known; (c) do not run Study 2 and report the design and readiness evidence as future work, per G4 (`v1.3-distinction-readiness:Docs/v1.3/research/distinction-readiness.md:489-507`).
   - **Recommend:** score DDD first (Decision 4), and do not touch §5. Under the positive branch, proceed. Under the zero branch, choose (a) only if the power re-run (5.5) at the largest affordable grid gives a defensible number; otherwise (c). Do not choose (b).
6. **S5 no-hint arm.**
   - Options: (a) keep the layout frame and record the no-spec claim as not tested; (b) add a no-hint arm.
   - **Recommend (a).** Probe 2 failed the ≥ 3/8 pre-stated trigger for (b). Its C2 zero is partly invisibility: 19/28 unmapped files.
7. **Study 2 size, given power.**
   - Options: (a) option B, with gate power 0.54; (b) option C, 0.77; (c) more tasks or blocks after the pilot-θ re-run.
   - **Recommend deciding on the 5.5 re-run.** At the pilot's measured cost (6.34 USD for 6 runs), budget is not the constraint it was assumed to be (`v1.3-pilot-run:…loop-pilot-2026-10-16.md:76`), so prefer the largest grid that passes D3.
8. **APG v2 / type flow at the freeze.**
   - Options: (a) off, with type flow reported as SO2 evidence only; (b) on.
   - **Recommend (a).** It "adds no planted catch" on the dev set, and turning it on changes the instrument the hold-out validates.
9. **External keys and logins.** A Gemini key and the panel logins (night-plan decision 7) are needed for 3.3/4.9 and for the V10 same-vendor threat.
   - **Recommend:** obtain them this week. The panel is the only non-human route to "meaningful".
10. **Publication** (outside SO1–SO5 but binding for the degree).
    - Distinction readiness: "A submitted indexed-journal article is a degree requirement" (`v1.3-distinction-readiness:Docs/v1.3/research/distinction-readiness.md:28`); there are four drafts and no submission (`:27`).
    - Options: (a) submit Paper 1 to EMSE now; (b) wait for the hold-out.
    - **Recommend (a).** Paper 1 does not depend on Study 2.

---

## 4. What NOT to do

None of the following moves SO2–SO5 or a gate line. Most are on the backlog's kill list (`Docs/v1.3/night-backlog-2026-10-16.md:718-734`; item 9 at `:728`: "None touches SO3–SO5 or the gate").

- **No more judge tuning.** No v2.3, no CHECK-3, no further selective-prediction variants, and no ap-hosts judge run: about 730 calls with no score script (`Docs/v1.3/ap-hosts-notes.md:60`). This holds unless Decision 2 picks (b).
- **No more floor probes on frame or style sentences.** Probe 2's pre-stated rule already moved the lever to task design.
- **No more "wild" or external-set waves beyond wave 2.** Check the 342 wave-2 findings instead (4.7).
- **No author or director labelling as validity evidence.** That includes the 40-item audit sheet and the 235-item fidelity sheet, unless Decision 3 picks (a).
- **No tool changes after the freeze**, and no opt-in features flipped to default before the freeze without a decision. This covers:
  - #185's MT-B1 fix, which needs an ADR-V13-01 amendment (`v1.3-metamorphic:…metamorphic-2026-10-16.md:197`);
  - #139's advisory post-filters;
  - #144's rule-gap catalogue;
  - #143's fix hints, which would also change the gate arm's feedback.
- **Do not merge #159 as is.** R01, the one blocking post-merge finding, is already closed on `v1.3` by #142, and #159 conflicts with `v1.3` in 7 files. Take only the still-relevant fixes, case by case.
- **Parked side tracks**, product or demo with no objective attached:
  - #138 CI action;
  - #140 HTML report;
  - #150 init/infer onboarding;
  - #155 dogfood;
  - #187 user guide;
  - #154 SDD demo;
  - #172 tool landscape;
  - #177 ideas triage;
  - presentation-kit figures (#115/#118/#123/#125);
  - ontology v1;
  - Neo4j GDS;
  - any frontend or dashboard.
- **No interpreter work beyond parity.** Neo4j "stays the reference engine for every reported number" (`Docs/v1.3/cypher-interpreter.md:3-4`). #183 and #188 are enough. #188 changes large-repo reports (see SO2), so it merges before the freeze or not at all. Do not switch the MCP default (#176) before Study 2.
- **No Study 2 "practice" runs on the real grid.** The pilot and the dress rehearsal are the only allowed loop runs before the single run. Per distinction readiness G4: "If the gate is not green by the writing deadline: do not run Study 2." (`v1.3-distinction-readiness:Docs/v1.3/research/distinction-readiness.md:489-507`).
