# Decisions

The working copy is the decision board, a private claude.ai artifact the author uses. This file is the record kept in the repo. Each settled item is also logged, with its date, in `aidlc-docs/audit.md`. The ids match the board. The context and options behind each item are in [`01-instrument-map.md`](01-instrument-map.md) (v3) and [`02-defensibility-conditions.md`](02-defensibility-conditions.md).

---

## Still open (yours)

- **The 9 spec–manifest disagreement rows (C3).** U6 will deliver a short adjudication sheet.
- ~~**F23.**~~ *Done 2026-10-19:* the author and an examiner compared the domains with the sealed list; two demo tasks were replaced (`Docs/DiagnosticRuns/v1.3-f23-and-v4-count-2026-10-18.md`, Part 3).

## Settled in chat, 2026-10-19

| Id | Decision | Work it creates |
|---|---|---|
| **M3 record** | Study 2 measures drift D, as declared in `Docs/v1.4/study2-deviation-2026-10-19-drift.md` | Done (PR #270): the protocol source moved, and the deviation list was updated |
| **TASKS** | New confirmatory tasks (4 Layered + 2 DDD), written by a separate session that never runs or scores. The sealed list is retired | Task writing, hint audit, acceptance checks, sealing at the freeze |
| **FB** | If the pilot bar fails, the main run still goes ahead, labelled exploratory | In the drift record §2 |
| **GEN** | Generators: Claude Sonnet + Gemini (CDX) | The Gemini coding-agent adapter goes live, plus its S4 probe (24 calls) |
| **STY** | Layered confirmatory. DDD continues to its pilot and is confirmatory only if it passes. Clean/Hex zeros reported as a finding | — |
| **LAB** | Human labels (meaning, judge κ) after the study: V5 timing deviation | In the drift record §7 |
| **V4** | Option (c). V4 governs the instrument-accuracy claim. A style below the bar can stay a confirmatory Study 2 stratum only if the missed violations are non-differential between arms, checked by a pre-registered per-arm comparison of rule families. The ADR is dated before the hold-out | V4 ADR draft |
| **U6** | Apply the recall fixes before the freeze. **Principle (author):** rules are never hand-written and never tuned to the misses. Every construct answer must follow from the style's spec and rule sources, whatever the dev-set figure does. G0.9's refutation criteria are written first | Gate 0 sheet; ADR(s); one Neo4j dev re-run (freeze runbook step 3) |
| **SIGN** | Sign V1, ADR-V14 Q-A to Q-E and the 9 adjudication rows from a one-page sheet. Each default comes with its spec evidence and its consequence | The signing sheet |
| **D15** | Static DDD spec with declared aggregates (evaluator only), confirmed after the B2 numbers | Pending B2 (local agent) |
| **FPFN** | The SO4-4 FP/FN review is done by an automated root-cause classification: mechanical checks plus an agent explanation per item, declared as AI-assisted. The author reviews the summary, not each item | Classifier run after the hold-out |
| **EXP** | **A separate exploratory study runs first** (its own registration, estimands, a staged stop rule, no confirmatory claims). The confirmatory Study 2 (the drift record) follows, designed from its results | Exploratory registration; the drift record stays the confirmatory protocol |
| **EXPT** | The exploratory study runs on rehearsal, probe and exploratory-only tasks. The confirmatory tasks are written blind and sealed before exploratory results are read | Task plan in the registration |
| **SEM** | **Everything semantic is in scope now:** C1d semantic facts into the graph, C4 interpretation and the agentic meaning protocol (MEAN-02). The instrument is neuro-symbolic, so no semantic path is deferred. In the exploratory study the semantic paths score the snapshots, and an in-loop semantic cell is added if its MCP tool is ready and confined | Builds, pilots, the registration |
| **F3** | F3 is rewritten around C4 + C1d (models supply facts and interpretation), replacing the judge | Contribution statement edit |
| **AUTO** | Author away until the evening of 2026-10-19: progress without blockers. Approved: zero-call builds and docs; the capped live pilots of the instrument (C1d ≤ 40 per vendor, C4 ≤ 24 per vendor, Gemini S4 ≤ 30, Claude S4 with MCP, counted first); merging green PRs. **Not approved: any study run** | — |
| **D1** | Claude CLI 2.1.303 is allowed for exploratory runs only (as agy 1.4.2); the frozen pin 2.1.294 is unchanged. Both CLIs are re-pinned once at the freeze, with auto-update off | Exploratory allowance in the judge route |
| **D2** | Gemini C1d/C4 results carry the exploratory label; a dated agy 1.4.2 pin is signed at the freeze | — |
| **D4** | C4 case keys: the author signs the 6 author-written cases; X1/X2 are keyed blind by a Gemini session | Blind keying |
| **D5** | DDD runs strategic-only in the exploratory study (3 tactical rules cannot fire on agent code, TIER-A3); class/member grain is decided from its results | — |
| **D6** | MEAN-02 sample: 18 items (6 per carrying stratum) | about +48 sessions |
| **D7** | The exploratory registration is approved as written (confirmatory tasks sealed before Stage A; order; counts) | Task writing starts |
| **D8** | Signed: F3 rewording, X-1, SO3-a. The V4 ADR's bar option and margins go to the decision surface | — |
| **SIGNUI** | The signing sheet is decided through an easier decision surface (plain-language cards, one choice each), not the raw sheet | Decision page |
| **DDD-BETA** | DDD is a **beta instrument**. Before DDD enters any study, the capability itself is measured: can the instrument represent a real DDD project (contexts, aggregates, value objects, repositories, events, ACL, shared kernel), and can it enforce each DDD rule on it (reach, seeded recall, twin false fires)? DDD-only signing items stay defaulted until then | Capability study `Docs/DiagnosticRuns/v1.4-ddd-beta-capability-2026-10-19.md` (cloud, zero calls) |
| **D12a** | The confirmatory step requests name their HTTP routes, so the hidden acceptance tests share an API contract with the agent (D12 option a). Start convention: the harness default (`npm start` with `{{port}}`) | Recorded in the seal record |
| **DELEG** | **Delegated to the coordinator by the author ("I don't want any more decisions", 2026-10-19), each the recommended answer:** G0.8 = (b), no scorer change; G0.9 refutation criteria for Q5, Q6, Q10 and Q12 as drafted (A). C1d: a SEM-fact confidence threshold of 0.75, declared before the six-case run and reported both ways (with and without it). C4 case keys: a blind Gemini session keys all cases as a second rater; disagreements are reported, never resolved. Generator config dir: the research dir, reused (the loop's isolation now tolerates the CLI-synced skills and plugins, inert under --safe-mode) | Signing desk 61/61 |
| **DELEG2** | **Delegated to the coordinator by the author ("i really dont want signing anymore", 2026-10-20):** ADR-V13-03 is accepted under delegation once the Q10 = D re-run is merged; the MEAN-01 sample sha256 is recorded by the coordinator with `shasum` only, the file never opened (it matches the expected prefix d4697ec5377d6fdc); the three V6 κ pointer lines are added as a delegated edit. V6 is not needed before the 2b run (drift record: before the first label). Q10 = D: the pre-dated G0.9 criterion applied as written; the suspected checker limit is reported | — |
| **GO-2B** | **The author's go for the confirmatory 2b run (2026-10-20, about 05:30 UTC): "run if the gate is green".** The run starts only when every readiness-gate item is green after the freeze, the hold-out, the pre-registration (with a Fable review) and the dress rehearsal on practice tasks. A red item is first made green where that is realistic. If it cannot be, it is registered as a dated deviation before the run, with what is lost (which claim weakens, and how the report states it). The run then goes ahead without that piece if the claim still stands. Never waived, so a red here stops the run and the author is told: the freeze tag and frozen inputs unchanged; the sealed tasks unread by any agent, with their hashes matching; generator confinement (S4 for each arm that runs); the pre-registration dated before the run; the run-once rule (the sealed tasks are not run for practice). 2b is Claude-only; Gemini is a dated extension arm (deadline plan `ops/05-plan-to-friday-2026-10-23.md`) | — |

## Settled in chat, 2026-10-18 (late)
- **D1:** confirm the decision sheet **as written**, with no changes.
- **L4:** **practitioner reading**: a finding is meaningful if a competent developer of that style would ask for it to change in review. Style fidelity is recorded as a second field.
- **Standing OK for three counted runs.** Each one is still reported with its count before it starts:
  - the brownfield pilot, 12 sessions (at most 14);
  - the NS pilot, 26 calls (cap 40);
  - the efficiency test, 150 sessions.
- **NS-01 reading:** no longer a gate. Your answers to N1–N4 settled its questions.

## Settled on 2026-10-18 (decision board, v2)

**These differ from my recommendation**, so each one comes with the work it creates:

| Id | Decision | Work it creates |
|---|---|---|
| **M3** | **Study 2 is redesigned around drift.** Confirmed in chat, knowing that the registered simulation puts trend outcomes at power ≤ 0.08 | A design note first (working mode). Then a new primary outcome, a new power simulation, and updates to the deviation record and readiness gate before the freeze, all taken to the director at design stage |
| **M5** | The efficiency test (graph tools vs raw files) becomes a thesis result | A design note: fixed questions, repo sizes, tool sets and caps, a call count, and a falsifier |
| **D2b** | Layered keeps counting wiring-code imports; no composition slot | Keeps the base rate at 5.33 and the power. The count includes imports from correct wiring code, and this is stated as a construct limit |
| **D5** | DDD gets a declared post-seal cycle rule, with an ADR | An ADR plus the rule. It counts as a deviation and changes the tiers Study 2 is scored on |
| **N3** | Q26, application purity, is added as a declared post-seal rule, with an ADR | An ADR plus the rule. The 12 framework-leak seeds become rule hits, and the K-tally is redone |
| **D1** | Confirm the decision sheet, with changes | The changes are still to come (see above) |

**Clarified by the author on 2026-10-18:** norms come from two sources. In **greenfield** they are declared from the spec and the style library: this is the current focus. In **brownfield** an LLM derives them from the graph, the code, the style and the docs: this is an exploratory track that **runs in parallel now**, so it produces results (author, 2026-10-18).

**These match my recommendation:**
- **D2a:** run F23 now.
- **D3:** the free rater labels meaning on about 60 findings, plus the K3 cases. Confirmed in chat.
- **M1:** the claim is F1–F3 plus Study 2. Tacit knowledge goes in the discussion. Confirmed in chat.
- **M2:** confirmatory claims only where norms are declared (greenfield). Changed in chat from "both".
- **M4:** the model interprets before detection, as facts.
- **M6:** pre-register an evasion check.
- **N1:** the model supplies facts, not verdicts.
- **N2:** report complementarity by knowledge level.
- **N4:** the fragmentation check works within one bounded context.
- **V4:** an ADR redefines V4 per Study 2 style, if the count shows a shortfall.
- **CDX:** register Gemini as the Codex substitute, with its own S4 probe.
- **PRE:** pre-register on OSF with an embargo.
- **S2S:** keep the registered rule, and let the pilot decide DDD.
- **D6:** register Link 1 as matched to the compiler.
- **D7:** keep `ops/` in the public repo and commit it.

Settled earlier: **D4**, the thinking note first (NS-01).

**Post-seal changes now pending: M3, D5, N3 (and V4 if the count triggers it).** Each one is a declared deviation. The examiner review flags the count of deviations as a risk in its own right. I'll write them up together as one dated list, so the director sees all of them at once.

## Changelog
- 2026-10-19 (evening): F23 marked done under "Still open" (REV-04 §6 item 7).
- 2026-10-19: the drift record, tasks, fallback, generators, styles, label timing, V4 (c), U6 under the spec-derived principle, the signing sheet, D15 (pending B2) and the automated FP/FN review.
- 2026-10-18: all board decisions recorded except L4, plus the D1 changes. M2, M3, D3 and M1 were confirmed in chat.
- 2026-10-18: D4 settled.
- 2026-10-18: first version, D1–D7.
