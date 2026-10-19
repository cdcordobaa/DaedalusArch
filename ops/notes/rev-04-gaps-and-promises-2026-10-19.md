# REV-04: what is still open, in the instrument map and in the thesis promises

**2026-10-19.** Read-only review, no model calls, no sealed read. It merges two audits: the gaps in the instrument map, with the readiness gate re-tallied against main today, and the proposal's promises (Proposal V4 in Notion, page `35450d30…`, plus the compliance register `3f150d30…`) against the evidence. Every status claim cites its source. "P#" ids are path items (§2) and "GO/SO#" ids are proposal promises (§5). Comment with `> AUTHOR:` lines.

## 0. Bottom line

1. **Study 2 is not a proposal promise.**
   - The proposal is descriptive DSR with "no inferential hypothesis testing" (Proposal, Framework, "Approach").
   - Its contingency says the minimum viable thesis is SO1 to SO4.
   - So Study 2 strengthens the thesis, but the thesis does not depend on it.
   - Moving to inferential testing (Study 1's permutation and Holm tests, Study 2's H1–H3) is **undeclared** (X-1).
2. **The most exposed promise is human labelling.** The proposal states it four times:
   - judge κ against humans;
   - independent ground truth;
   - one independent evaluator;
   - evaluators recruited by milestone W10.

   We have 0 labels (N114, N81). This matters more at the defence than a second Study 2 style.
3. **The readiness gate, re-tallied today: 1 GREEN, 1 PARTIAL, 20 AMBER, 20 RED, 0 UNKNOWN.** On 10-16 it was 1, 1, 32 red and 8 unknown.
   - Most moves to AMBER come from tooling merged on 10-16 that has never run live.
   - Gate rule 3 says nothing turns GREEN until it is re-verified at the run commit.
4. **The style question was already answered on 10-18 by the drift design**, [`s2d-01-study2-drift-design.md`](s2d-01-study2-drift-design.md) (board decision M3):
   - Layered is confirmatory.
   - DDD is confirmatory only if D15 is decided **and** DDD passes the pilot bar.
   - Clean and Hexagonal are not run; their zeros are reported as a finding.
   - Generators: Claude Sonnet plus Gemini (CDX).

   **But M3 has no dated deviation record yet,** so the registered protocol still says "level outcome Y at k = 4, Codex" (P1).
5. **A conflict that only the author can settle: which tasks Study 2 runs.**
   - s2d-01 writes 4 new Layered tasks plus 2 DDD, and calls the sealed list "retired" (`s2d-01:31`).
   - The gate, the protocol and today's F23 all treat the sealed list as the confirmatory tasks (P4).
6. **Layered, the only stratum that escapes the floor, will probably not pass V4 on the hold-out.**
   - Development blind recall is 0.70, or 0.80 once the available fixes are applied. P(point estimate ≥ 0.90) is about 0.01–0.09.
   - The misses are analysed (`Docs/DiagnosticRuns/v1.3-blind-recall-gap-2026-10-18.md`). Two are layer-level cycles that can't be fixed admissibly; one miss and four false alarms are fixable (U6, P9).
   - So the V4 ADR has to say in advance what a "characterised" Layered result allows Study 2 to claim (P11).

## 1. Decisions only the author can make (in the order they unblock work)

| # | Decision | Options | Why it matters | Source |
|---|---|---|---|---|
| A1 | **Study 2 outcome: drift (M3, decided) or the registered level outcome?** | Write M3's dated deviation with REV-03's fixes, or reverse M3 | Until it's written, the protocol, the gate and the power simulation disagree. The drift power mode isn't built | P1; `deviations-v14.md:16`; `rev-03:38-40` |
| A2 | **Confirmatory tasks: the sealed list, or new agent-written tasks (s2d-01)?** | (a) the sealed 6, as F23 assumed; (b) 4 new Layered + 2 DDD, sealed at the freeze, with the writer never running or scoring | Sets what F23 protected, how S14/D2/V11 are read, and who writes the tasks | P4; `s2d-01:31` |
| A3 | **Styles** | s2d-01: Layered confirmatory, DDD conditional (D15 + pilot), Clean/Hex zeros as a finding | Two confirmatory styles happen only if DDD passes. Clean/Hex can't be confirmatory: their floor is near 0 | P3, §4 |
| A4 | **V4: how the hold-out bar is read, and what "characterised" allows** | ADR before the freeze: does the Wilson lower bound block or not; can a characterised style still be a Study 2 stratum? | Layered is likely characterised (point ≥ 0.90 at P ≈ 0.01–0.09), and `outline-v2:302` then bars it | P11; F23 note §2.4 |
| A5 | **Generator: record CDX; OK the Gemini S4 probe** (24 calls, cap 30) | Gemini replaces Codex now, or wait for Codex (about Nov 9) | V10(a) has no waiver. The Gemini coding-agent route isn't live (only the one-shot route works) | P2, P27 |
| A6 | **Human labels: the rater and the V5 deviation** | Free rater: 60 meaning labels + K3 cases (+ about 30–40 Semantic/Integrity units for SO3-5); or a declared deviation | Covers SO4-7 and SO3-5, the proposal's most repeated promise, and gate V5/V6 | P12, P13; §5 |
| A7 | **Sign what is already decided but not on file** | Construct answers + ADR-V13-03 (V1, 0/25 written); the 9 adjudication rows; ADR-V14-01/02 parts Q-A to Q-E; MEAN-01 §12 | All of them must happen before the freeze | P7, P8, P10, P12 |
| A8 | **V8, graph fidelity on generated code** | Adjudicate the 2,135 cells, or restate V8 in a dated deviation as "matched to the compiler" (D6) | V8 has no waiver as written | P24 |
| A9 | **Declare the methodology change (X-1)** | One deviation: "descriptive core, inferential additions pre-registered" | Otherwise an examiner finds a silent switch | §5 X-1 |
| A10 | **Adopt SO3-a (7 → 5 symbolic dimensions, no Security)** | Adopt the drafted deviation (`g13 §3`), or add rules (kill list says no) | It is a named promise in Table 1 | §5 SO3-3 |
| A11 | **Small written decisions** | S5 (no-layout-hint arm), S9 (one lane), V7 (keep judge v1 or drop it), D15 (DDD spec mode) | Gate lines | P31 |
| A12 | **F23 second pass** on tide-tables and stamp-catalogue | By eye, or the examiner script | Blocks only re-running the stub replay | P5 |

## 2. Path to Study 2: open items in dependency order

"Calls" means model calls. Everything at 0 can be done now, once its decision is made.

| id | item | status | closes by | calls | blocks S2 | depends on |
|---|---|---|---|---|---|---|
| P1 | M3 dated deviation; drift power mode (`level-power-sim.ts` has no drift mode) | RED | record + simulation + director | 0 | yes | director |
| P2 | CDX on the deviation list and in the protocol line | RED | dated entry, protocol lint | 0 | yes | P1 |
| P3 | Styles | OPEN | A3 | 0 | yes | P1, P11 |
| P4 | Confirmatory tasks (sealed vs new) | CONFLICT | A2; write, hint-audit, seal | 0 | yes | P1 |
| P5 | F23 on the 2 new domains | OPEN | author | 0 | no | — |
| P6 | Deviation row: a Claude-family examiner read the sealed list | not listed | add to `deviations-v14.md` | 0 | yes (disclosure) | — |
| P7 | V1 construct answers committed + ADR-V13-03, then `apply-construct-answers.ts` | RED (0/25 on file) | author | 0 | yes | — |
| P8 | 9 spec–manifest adjudication rows signed | RED | author, before the freeze | 0 | yes | — |
| P9 | U6 recall fixes (Q5 D, Q6 B, Q10 C/D, Q12 B) with ADRs, Gate 0, one dev re-run on Neo4j | NOT BUILDABLE yet (G0.1–G0.10 unticked) | build | 0 | yes (V4 odds) | P7, P8 |
| P10 | ADR-V14-01/02 parts Q-A to Q-E signed | AMBER | author | 0 | yes | — |
| P11 | V4 ADR | RED | write before the freeze | 0 | yes | P3 |
| P12 | V6 κ definition: MEAN-01 §12 signed, three older κ docs repointed | RED | author + 1 edit | 0 | yes | — |
| P13 | Rater session: 60 meaning labels + K3 cases (+ SO3-5 units) | RED (0 labels) | about 2 h 25 min + | 0 | yes (V5) | P12, A6 |
| P14 | Three threat-register rows pasted (`g15-threat-rows.md`) | AMBER | paste | 0 | yes (before pre-reg) | — |
| P15 | DDD: apply declared aggregates (D-c/D15); **B2** and **T1** re-scores; memo §5 branch final. The pilot has **8** snapshots, not 12 | NOT DONE | agent + Neo4j re-score; author signs | 0 | yes (D1, D15, S7) | P7 |
| P16 | `layered` loop style (missing in `style.ts:20`); ice-rink frame passes the hint audit; DDD/Layered L3/L4 frames | RED | build + audit + hash | 0 | yes | — |
| P17 | Per-task MCP spec (`plan.ts:235`) | RED | code | 0 | yes | — |
| P18 | k-fixtures hashed (k = 5 under M3) | OPEN | commit | 0 | yes | P1 |
| P19 | V9 fast path = full evaluation (interpreter option off by default) | AMBER | decide the default; check per style on rehearsal snapshots | 0 | yes | P10 |
| P20 | **Validation pilot** (Layered + DDD base rates, go rule) | NOT RUN | run | about 24 step turns + repairs (uncounted) | yes | P15–P19 (+P27 for both generators) |
| P21 | Power re-run with the pilot's mean and θ | NOT RUN | simulation | 0 | yes | P20, P1 |
| P22 | **Freeze** (runbook 9/14 unmet; prespec placeholders empty) | RED | runbook | 0 | yes | P7–P11, P19 |
| P23 | **Hold-out once on Neo4j** + FR-V11 report | NOT RUN | run | 0 | yes (V3, V4) | P22 |
| P24 | V8 fidelity (2,135 empty cells) | RED | A8 | 0 | yes | — |
| P26 | Claude CLI pin and isolation turned on; canary | AMBER | plan settings + rehearsal | 0 | yes (S2, S3) | — |
| P27 | Gemini generator: S4 probe code + run, homes, model pin, one live turn | RED | author OK | 24 (cap 30) | yes (V10a, S4, S8) | P2 |
| P28 | Claude S4 with the MCP server attached | RED | run locally | UNKNOWN | yes | P26 |
| P29 | Harness: S1 pause durations, S10 CI for v1.4, S11 tunables file, S12 archive step, D6 telemetry checker | RED/AMBER | code | 0 | yes | — |
| P30 | Evasion margins (REV-03 finding 5); D12 acceptance checks per confirmatory task | AMBER | with the tasks | 0 | yes | P4 |
| P31 | S5, S9, V7, D15 written | RED | A11 | 0 | yes | — |
| P32 | Dress rehearsal, every cell, both generators | PLAN ONLY | run | UNKNOWN | yes | P22–P31 |
| P33 | Pre-registration on OSF (embargo), hashed and checked in CI | NONE | agent drafts, author signs | 0 | yes | P32 |
| P34 | Gate re-verified at the run commit; author's go | — | author | 0 | yes | P33 |
| P35 | **Study 2, once** | — | — | 32 drift blocks (s2d-01) | — | P34 |

Not on the Study 2 path:
- P25: extractor re-runs on msc29 and felixle.
- P36: the NS 2-case pilot, about 26 calls.
- P37: EFF-01, 150 sessions.
- P38: the full BF-01 run, about 90 sessions.
- P39: the N123 survival re-score with the identity module.

## 3. Readiness gate, re-tallied today

| line | 10-16 | now | what changed / what closes it |
|---|---|---|---|
| V1 | RED | RED | 0/25 on file → P7 |
| V2 | GREEN | GREEN | hashes equal; post-seal overlay needs ADR sign-off (P10) |
| V3 | RED | RED | P22, P23 |
| V4 | RED | RED | count done, ADR missing → P11, P23 |
| V5 | RED | RED | P13 + V5 deviation |
| V6 | RED | RED | P12 |
| V7 | RED | AMBER | v2.2 NOT CANDIDATE; freeze v1 or drop |
| V8 | RED | RED | P24 |
| V9 | RED | AMBER | interpreter parity 71/71, off by default → P19 |
| V10 | RED | RED | P2, P27, P4 |
| V11 | UNKNOWN | AMBER | leakage census; examiner read the sealed list → statement |
| S1 | RED | RED | P29 |
| S2 | RED | AMBER | pin tooling unused → P26 |
| S3 | RED | AMBER | isolation tooling unused → P26 |
| S4 | RED | RED | P27, P28 |
| S5 | RED | RED | P31 |
| S6 | RED | AMBER | rehearsal check |
| S7 | RED | RED | P15 |
| S8 | RED | RED | P27, P32 |
| S9 | UNKNOWN | AMBER | written note |
| S10 | RED | RED | P29 |
| S11 | RED | AMBER | P29, P33 |
| S12 | UNKNOWN | RED | P29 |
| S13 | RED | RED | dated author declarations |
| S14 | UNKNOWN | AMBER | hash checked today; access statement; P4 |
| S15 | UNKNOWN | AMBER | "no model labeller" statement |
| D1 | RED | RED | P15, P20 |
| D2 | UNKNOWN | AMBER | P4, P16 |
| D3 | RED | RED | P21 |
| D4 | RED | AMBER | budget + stop rule approved |
| D5 | UNKNOWN | AMBER | rehearsal |
| D6 | RED | AMBER | P29 |
| D7 | RED | AMBER | rehearsal re-score |
| D8 | UNKNOWN | AMBER | parity on rehearsal snapshots |
| D9 | RED | AMBER | rehearsal data |
| D10 | RED | RED | P33 |
| D11 | RED | RED | P17, P31 |
| D12 | RED | AMBER | P30 |
| D13 | RED | AMBER | rehearsal |
| D14 | PARTIAL | PARTIAL | live resume drill |
| D15 | RED | RED | P15 |
| D16 | RED | AMBER | author's held-out subset |

**Totals:** GREEN 1, PARTIAL 1, AMBER 20, RED 20.

## 4. Styles

| style | agent code: violations? | dev blind recall (after fixes) | expected hold-out blocking n | confirmatory Study 2? |
|---|---|---|---|---|
| Layered | yes: 14/14 steps, one Opus session by hand, step-1 habits replicated (N147). No Sonnet or Gemini run yet; the loop has no Layered style | 0.70 (0.80) | 32–39 | the only stratum that escapes the floor, but V4 is likely "characterised" → A4 |
| DDD | unscored: tool defect T1 on all 8 snapshots | 9/9 = 1.00 (10/10) | 25–32: "Validated" impossible | only with D15 + pilot pass ("coin flip") |
| Hexagonal | no: 0/14, 0/8, 0/4 | 0.67 (0.83) | 26–52 | no: zeros as a finding |
| Clean | no: 0/65 E1 cells, 0/8, 0/4 | 0.86 | 30–46 | no |
| NestJS | never in the loop | 0.77 | 27–44 | no |

**Reading.** "At least two styles" is reachable two ways:
- **Two confirmatory: Layered + DDD.** This needs D15, the DDD pilot to pass, and A4 settled for Layered.
- **One confirmatory plus one floor finding: Layered + Clean/Hex.** This says "agents already follow these styles".

The second is honest, but it's not a second test of the tool.

## 5. Thesis promises (Proposal V4) against the evidence

| id | promise | status | gap → cheapest honest fix |
|---|---|---|---|
| GO-1 | design and test the instrument | PARTIAL | no frozen tag, no hold-out → freeze + hold-out (0 calls) |
| GO-2 | fitness functions + graph + LLM judge for the semantic dimensions | PARTIAL | judge 16/21 = 0.76 vs 0.80; changed 0/65 verdicts; "argued, not shown" → claim only F3, the bounded role; NS 2-case pilot |
| SO1-1 | declarative AaC language | MET | — |
| SO1-2 | 2–3 style libraries | MET (5) | optional expert read |
| SO1-3 | ~30 lines of YAML per spec | PARTIAL | report the counts; drop "effort" |
| SO1-4 | expressiveness, coverage, validator pass rate | PARTIAL | define expressiveness as rows expressible ÷ rows |
| SO1-5 | compare with Ford/Richards ADL | NOT MET | one qualitative table (0 calls) |
| SO2-1 | graph of files, declarations, types, calls | MET | — |
| SO2-2 | "a limited set of data-flow edges" | PARTIAL | `FLOWS_TO` yields 0 edges on real code (N40) → report it as a finding |
| SO2-3 | coverage, latency < 5 s, type-resolution rate | PARTIAL | type-resolution rate already declared dropped |
| SO2-4 | five-layer APG with L5 violation nodes | PARTIAL | mapping table (writing only) |
| SO2-5 | APG vs AST ablation | MET | — |
| SO2-6 | CPG approximations (branch, k = 1) | NOT MET | declared deviation |
| SO3-1 | rules → queries → scores, AHS, report | MET | — |
| SO3-2 | LLM judge for Semantic and Integrity | MET in form, weak in evidence | see GO-2 |
| SO3-3 | "30+ rules across 7 symbolic dimensions + 2 judged" | PARTIAL | 33 rules over **5** dimensions, no Security → adopt SO3-a (A10) |
| SO3-4 | Neo4j GDS: Louvain, betweenness, SCC, PageRank | CHANGED, undeclared | Louvain in-process, SCC via FF-S02; the other two dropped → declare |
| SO3-5 | judge reliability, κ against human labels | NOT MET | rater double-labels 30–40 units; reuse the judge cassettes (0 calls) → A6 |
| SO4-1 | seeded golden dataset | MET (registered) | v1.3 hold-out unrun → P23 |
| SO4-2 | 150–300 seeded instances | PARTIAL (75) | the 207-case hold-out crosses 150 |
| SO4-3 | precision, recall, F1, FPR | MET (dev) | hold-out |
| SO4-4 | qualitative FP/FN review | PARTIAL | author codes the 21 held-out FP/FN by hand (0 calls); the file is header-only |
| SO4-5 | calibrate thresholds; dimension ablation | PARTIAL | say what was calibrated, and when |
| SO4-6 | matching protocol | MET | — |
| SO4-7 | **independent ground-truth labelling** (stated 4 times) | NOT MET | A6; at least partial delivery |
| SO4-x | taxonomy derived independently (OX/GIST) | UNKNOWN | check the threat rows |
| SO5-1 | multiple LLMs × spec levels; reproducible taxonomy | PARTIAL | one style; FPAT is a profile (TV-77); open coding never produced → author open coding (0 calls) |
| SO5-2 | GPT, Claude, open-source baseline | PARTIAL | no open-source model → declare it, or one local-model arm |
| SO5-3/4 | temperature/seed; violation density, latency | CHANGED (declared) / MET | — |
| X-1 | descriptive, "no inferential hypothesis testing" | CHANGED, **undeclared** | A9 |
| X-2 | greenfield only | MET, widened | state it as an exploratory extension |
| X-3 | CodeQL as the baseline | CHANGED | dependency-cruiser + ArchUnitTS used instead → one paragraph |
| X-4 | open artefacts, reproducible | PARTIAL | tag, DOI, scrub the paths |
| X-5 | Ch. 1 claims a "controlled quasi-experiment… detection efficacy" | **contradicts** the proposal and the evidence | rewrite to F1–F3 |

**Orphans** (promises no plan covers):
- SO1-5, the ADL comparison.
- SO2-4 L5, and SO2-6.
- SO3-4: GDS betweenness and PageRank.
- SO3-3, the 7 dimensions (draft not adopted).
- SO4-4, the human FP/FN review.
- SO5-2, the open-source model.
- SO5, the open coding.
- X-1, the inferential switch.
- X-3, CodeQL.
- SO1-4, "expressiveness".
- The OX/GIST taxonomy.
- SO3-5, judge κ against humans: the map gives the rater only meaning labels.
- X-5, the Ch. 1 overclaim.

**The five gaps an examiner hits hardest:**
1. **There is no human label anywhere** (SO4-7, SO3-5). Fix: one rater session plus a residual deviation.
2. **Every v1.3 figure is a development figure, and the instance count is under 150.** Fix: the V4 ADR, then the hold-out once.
3. **"Neuro-symbolic" is not shown.** Fix: claim only F3; report C1d as a design plus the 2-case pilot.
4. **The deviations are scattered and some are unwritten.** Fix: one dated "proposal vs delivered" table in Ch. 3, from the Notion register plus g13 §3, with SO3-a adopted and X-1 declared.
5. **SO5 is thin and Ch. 1 overclaims.** Fix: open coding, FPAT called a profile, rewrite the Ch. 1 sentence, and write the thesis to stand without Study 2. The proposal's contingency allows it.

## 6. Stale or contradictory documents (cleanup, 0 calls, agent can do)

1. REV-02 cut drift, efficiency, Q26 and the DDD cycle rule. The board then revived all four (M3, M5, D5, N3). The map and `02` still read as cut.
2. Does the Wilson lower bound block V4? `open-items.md:19` says no, citing `gate:114`. `02:13` says yes. The V4 ADR settles it.
3. `02`:
   - row 2.7 and group E contradict its own override 1;
   - `02:154` cites `decisions.md:16` for "5.33 → 2.67", but D2b keeps 5.33.
4. `00-overview.md` still says map v2, C2r weakest, and L4/D1/NS-01 pending.
5. `track-2-scale.md` says the Gemini adapter is "to be built" (it exists, #257) and that there are 12 DDD snapshots (there are 8).
6. `03-build-list.md` lines 13, 31 and 42 list merged work as open.
7. `decisions.md:10` and `open-items.md:71` list F23 as open (done today).
8. `open-items.md:75` says "Gemini arm produced nothing" (6/6 today).
9. `aidlc-docs/aidlc-state.md` has no v1.4 cycle (last updated 10-16).
10. The claims ledger (`:327`) calls 72,388/81 unmerged; it's on main.
11. MEAN-01 says L4 is unsigned; `decisions.md:14` says it's settled.
12. `s2d-01:31` calls the sealed list "retired", while the gate, the protocol and F23 use it (A2).
13. REV-03 says D12 is non-waivable; the gate still marks D12 [W].
14. V5 asks for hold-out labelling; D3/MEAN-01 labels external findings (X1 deviation unresolved).
15. `01-map:177,269` lead with "F23, then hold-out", but V4 is bound by recall, not by F23.

## 7. What can honestly be a limitation instead of closed

- **Already declared** (`02` group E, the map, decisions):
  - developer-behaviour validity null;
  - RR 0.75 undetectable;
  - the hold-out not independent (L178);
  - mostly Claude-family materials (L179);
  - TypeScript only;
  - no expert review;
  - human C2r κ is future work;
  - SO3 reported as a design plus a pilot;
  - mined-norm recall, the review-comment count, judge v2.x, NS1–NS3 at scale, cross-family C1d;
  - D2b wiring as a construct limit;
  - the type-resolution rate.
- **Waivable gate lines:** V7, V10(b), D12 (with caveat), S9.
- **Report as findings, not limitations:**
  - Clean/Hex zeros and NestJS untested;
  - Layered/DDD "characterised" if V4 fails, with the ADR saying so in advance;
  - BF-01, where the graph's added value is not shown;
  - `FLOWS_TO` yielding 0 edges on real code.

## 8. Suggested order once the decisions are made

1. **Today, author:**
   - A1, the outcome;
   - A2, the tasks;
   - A3, the styles;
   - A5, the generator;
   - A6, the rater.

   These five turn every other row into plain work.
2. **Zero-call work, agent, in parallel:**
   - §6 cleanup;
   - the P1/P2/P6 deviation records;
   - X-1 and SO3-a drafted for signing;
   - the V4 ADR draft (A4);
   - P15: the DDD aggregates, then B2 and T1;
   - P16–P18;
   - P29;
   - the P14 threat rows.
3. **Author signs:** A7 (P7, P8, P10, P12), A4, A8, A9, A10, A11.
4. **P9:** U6 fixes, Gate 0, one dev re-run on Neo4j.
5. **Calls, each with its own count first:**
   - P27, the Gemini S4 probe (24);
   - P20, the validation pilot;
   - P21, power.
6. **P22, the freeze → P23, the hold-out once → P13 rater labels** (they can also run in parallel with step 4).
7. **P32, the dress rehearsal → P33, the pre-registration → P34, the go → P35, Study 2.**
8. **In parallel, writing-only** (0 calls):
   - the proposal-vs-delivered table;
   - the SO1-5 ADL table;
   - the SO4-4 FP/FN coding;
   - the SO5 open coding;
   - the Ch. 1 rewrite.

## Changelog
- 2026-10-19: first version (two read-only audits, merged).
