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
| **DELEG-Q10** | **Q10 = D (criterion as written), delegated to the coordinator 2026-10-20.** The G0.9 Q10 criterion was met (2 new FF-S01 `express` rows on the external layered set judged incorrect by the C3 checker). *Reason:* a pre-dated criterion is applied as written; overriding it because we suspect the checker would move the goalposts after seeing data. *Limitation:* the suspected checker defect ("does not reach express (literal view)"; the same imports were labelled correct as FF-P01 rows). The recommendation itself said C reduces to D when no package-to-layer mapping is declared | U6 re-applied once; second development run: layered blind 8/10 → 7/10, adjudicated 8/8 → 7/8 (`Docs/DiagnosticRuns/v1.4-u6-applied-2026-10-19.md` §7) |
| **DELEG2** | **Delegated to the coordinator by the author ("i really dont want signing anymore", 2026-10-20):** ADR-V13-03 is accepted under delegation once the Q10 = D re-run is merged; the MEAN-01 sample sha256 is recorded by the coordinator with `shasum` only, the file never opened (it matches the expected prefix d4697ec5377d6fdc); the three V6 κ pointer lines are added as a delegated edit. V6 is not needed before the 2b run (drift record: before the first label). Q10 = D: the pre-dated G0.9 criterion applied as written; the suspected checker limit is reported | — |
| **GO-2B** | **The author's go for the confirmatory 2b run (2026-10-20, about 05:30 UTC): "run if the gate is green".** The run starts only when every readiness-gate item is green after the freeze, the hold-out, the pre-registration (with a Fable review) and the dress rehearsal on practice tasks. A red item is first made green where that is realistic. If it cannot be, it is registered as a dated deviation before the run, with what is lost (which claim weakens, and how the report states it). The run then goes ahead without that piece if the claim still stands. Never waived, so a red here stops the run and the author is told: the freeze tag and frozen inputs unchanged; the sealed tasks unread by any agent, with their hashes matching; generator confinement (S4 for each arm that runs); the pre-registration dated before the run; the run-once rule (the sealed tasks are not run for practice). 2b is Claude-only; Gemini is a dated extension arm (deadline plan `ops/05-plan-to-friday-2026-10-23.md`) | — |
| **DELEG6** | **2b acceptance and CLI pin (delegated under GO-2B, 2026-10-20, before any 2b call).** (1) D12: the skeleton has no `start` script and the sealed tasks may carry no start command (rehearsal F2), so acceptance runs **after** the run on the stored step-5 snapshots (and per step where scored), with zero model calls, under a start rule fixed now: the service is started with `npx tsx <entry>`, where `<entry>` is the first file that exists of `src/main.ts`, `src/server.ts`, `src/index.ts`, `src/app.ts`, `main.ts`, `server.ts`, `index.ts`; with `PORT` set by the runner; readiness by polling the base URL every 250 ms up to 20 s; a snapshot with no entry file, or that never becomes ready, is recorded `not-started` and counts as failing. Acceptance pass rate stays a secondary outcome; D is unaffected. No sealed input, frozen path or the instrument changes. (2) Generator pin: Claude Code CLI **2.1.304**, run from a private copy of that binary outside the auto-updater's reach, sha256 `b9ac5374839f14abf3f1f45610637c332b5daee5ce0d1634726cef87aab78e6a`, passed as `--binary`; the run stops on any version or hash mismatch (D1 re-pin not done at the freeze: rehearsal F4) | — |
| **DELEG3** | **Delegated to the coordinator (the author asked for no more decisions), recorded as delegated, 2026-10-20: option D.** In both generator arms `--safe-mode` is replaced by an explicit set that reproduces what it disables except MCP: `--setting-sources ""`, `--settings {autoMemoryEnabled:false, disableAllHooks:true}`, `--disable-slash-commands`; MCP only through `--strict-mcp-config` (none in `none`, exactly daedalus-arch with `--confine` in `daedalus-mcp`). Reason: one environment for both arms, the arms differing only in the tool, comparable with Stages A and B (run under `--safe-mode`, equivalent for `none`). Equivalence: 2 calls, same tools, servers, plugins and permission mode, no skill or CLAUDE.md. S4 re-run: PASS | `mcp@L2` plan filled; live run not started |
| **V4-ACC** | **ADR-V14-04 accepted under the author's delegation (DELEG2, 2026-10-20; "the remaining author items are delegated", `ops/05-plan-to-friday-2026-10-23.md`).** Bar option (1): per style, M1 and M3 point ≥ 0.90 and Wilson lower bound ≥ 0.80, M7 point ≥ 0.95, against the blind manifests; margins A = 0.05, B = 0.10, as proposed. Accepted by the coordinator before the freeze tag and before the hold-out, with no hold-out figure seen. Accepted under delegation, not signed | `Docs/v1.4/adr-v4-holdout-bar.md` |
| **DELEG4** | **Delegated to the coordinator by the author, 2026-10-20 (recorded before the hold-out run, 08:53Z): the hold-out runs through a path-only blind adapter.** No scorer or runner code changes, and the freeze tag `v1.4-freeze-2026-10-20` (X = 4d28d280) stands. A separate blind `claude -p` session (no saved transcript; tools limited to reading the copy and the loader source, plus mkdir/mv/cp/ls/shasum) rearranges a script-made COPY of the sealed tree into the layout the frozen loader reads. Only paths change, never file content, and no missing file is fabricated: a style whose required file does not exist is marked incomplete and is not scorable. A script then checks that the content-hash multiset is preserved and that no file changed. The registered runner at the tag scores the copy once on one capped Neo4j 5.26.x with APOC. Only aggregate figures reach the coordinator. *Reason:* the layout is a packaging mismatch, not a construct question; moving files keeps the instrument and the reference content frozen. *Limitation:* the converted tree no longer carries the sealed tree hash, so its link to the seal rests on the copy hash check and the content-hash multiset check, not on `1379b561…` | `Docs/v1.3/holdout-prespec-addendum-2026-10-20.md`; run note `Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md` |
| **DELEG5** | **Delegated to the coordinator under GO-2B ("a red item is made green where realistic; otherwise register what is lost"), 2026-10-20, recorded 10:04Z before attempt 2: one more hold-out attempt with a header-only patch repair, plus a registered fallback for r_f.** A blind session (attempt 1 flags, plus Write on converted/) rewrites only the file-header lines of variant patches whose target is absent from the clean project into a creation against /dev/null. Every hunk line stays byte-identical, which a script verifies. If the structure check at the tag then shows 0 problems, the hold-out runs live once; otherwise STOP. *Fallback F-RF, applying whatever the outcome:* if layered has no hold-out figure, ADR-V14-04 §4 part A takes r_f from the frozen development record run (layered blind-primary per-rule blocking recall, scores.json at X). It is a development-set estimate, not validity evidence; layered stays confirmatory in 2b with that limitation stated, worded "characterised on the development set, not validated on a hold-out". *Limitation:* the repair is a declared content change to the hold-out (prespec §6) | `Docs/v1.3/holdout-prespec-addendum-2-2026-10-20.md` |

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
- 2026-10-20 (after attempt 2): DELEG5 outcome. Header repair verified (34 of 34 hunks byte-identical, header-only), but the structure check still shows 4 problems (one missing expected-findings.json per style). STOP: no live run and no hold-out figure. Fallback F-RF applies: r_f comes from the development record run, and layered stays confirmatory in 2b with the limitation stated (`Docs/v1.3/holdout-prespec-addendum-2-2026-10-20.md` §2).
- 2026-10-20 (10:04Z): DELEG5 recorded before attempt 2 (patch-header-only repair; fallback F-RF for r_f).
- 2026-10-20 (after the attempt): DELEG4 outcome. The adapter converted four styles; ddd is incomplete (patch format). Under the frozen loader 34 variants do not materialise, so the run stopped before scoring and no figure exists (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`). Open for the author: a registered fallback for r_f in ADR-V14-04 §4 part A, or layered becomes exploratory.
- 2026-10-20: DELEG4 (the hold-out through a path-only blind adapter), recorded before the run.
- 2026-10-19 (evening): F23 marked done under "Still open" (REV-04 §6 item 7).
- 2026-10-19: the drift record, tasks, fallback, generators, styles, label timing, V4 (c), U6 under the spec-derived principle, the signing sheet, D15 (pending B2) and the automated FP/FN review.
- 2026-10-18: all board decisions recorded except L4, plus the D1 changes. M2, M3, D3 and M1 were confirmed in chat.
- 2026-10-18: D4 settled.
- 2026-10-18: first version, D1–D7.
