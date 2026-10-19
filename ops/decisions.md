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
