# Open tracks and built capabilities (2026-10-21)

**What this page is.** A living inventory, written at the point where chapter drafting starts, after the Study 2b scoring pass (`Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`). Part A lists every unfinished line of work and tags it. Part B lists what the instrument and its tooling can do today, with evidence and maturity. Paths are repo-relative. `[br]` marks a path that exists only on an unmerged exploratory branch.

**Sources.** `origin/main` at `527c3f54`, plus the branches `pilot/hexddd-01`, `explore/detect-01` and `explore/puzzle-01`. Every row cites its evidence. This page adds no new measurement.

**Tags**

| Tag | Meaning |
|---|---|
| **[FRIDAY]** | Needed for the Study 2b deliverable (2026-10-23) |
| **[DRAFT-NEXT]** | Can progress in the weeks after the first chapter draft |
| **[FUTURE-WORK]** | Belongs in the thesis future-work section |
| **[DROPPED]** | Explicitly abandoned |

**Maturity**

| Level | Meaning |
|---|---|
| **VALIDATED** | Confirmatory or external evidence |
| **DEV** | Development evidence only |
| **PROTOTYPE** | Unmerged exploratory branch |
| **SPEC-ONLY** | Designed, not built |

---

## Part A: open tracks

### A1. Study 2b deliverable (confirmatory, SO5)

| Item | Status, with evidence | What remains | Tag |
|---|---|---|---|
| Scoring and results | Done. One registered pass. H1 exact p 0.0132 and H2 0.0001, both supported under D and D†. H3 p 0.43, not rejected. E fails (`Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`). Ledger rows C8035–C8064; nulls M175–M186 | Write the full report and the chapter | [FRIDAY] |
| Per-file archive manifests | Committed with the scored results (`results/v1.4-study2b/archive/`, 30 manifests) | — | done |
| Evasion item 5: blind read of the moved-only diffs | Not run (addendum 3, DA11) | A human read | [FRIDAY] |
| Evasion item 4: literal view | Not run. No tool exists at the tag | Register a tool, or report it as not run | [DRAFT-NEXT] |
| Stale status lines | Conflicts K263–K272 (`Docs/v1.3/compendium/open-items.md` §7), and the list at the end of Part A | Fix them | [FRIDAY] |

### A2. Neuro-symbolic interpretation: C4, C1d, D_sem, complementarity (SO3)

**The semantic layer today:**
- **Exploratory evidence:** the 2a Claude run, and the DETECT-01 semantic prototypes.
- **Confirmatory evidence:** none yet. D_sem is registered as a secondary for 2b and has not run.

| Item | Status, with evidence | What remains | Tag |
|---|---|---|---|
| C4 pilot (pairs 1–2), then the six-case set | Built (`scripts/v1.4/c4-run.ts`, `tests/fixtures/v1.4-c4/`). Never run against a seeded key. The bars are in `ops/notes/sem-01-semantic-validity-plan.md` §2 | Pilot 8 calls (cap 16), then six cases 32 (cap 64) | [FRIDAY] (prerequisite) |
| D_sem on 2b | Registered secondary, not run (results §5; M185) | `dsem-provenance.ts`, then `study2b-analyse.ts --dsem --dsem-nonagent`. Run only if the C4 bars pass; otherwise report "not run" | [FRIDAY] stretch |
| C1d on the 12-snapshot 2b sample | Not run | Fix and date the cap first | [FRIDAY] stretch / [DRAFT-NEXT] |
| 2a semantic run (Claude) | Exploratory (`Docs/DiagnosticRuns/v1.4-exploratory-semantic-claude-2026-10-20.md`). C1d stopped at its cap, after 8 of 12 snapshots. 45 SEM-MISPLACED verdicts: 39 are a layer-mapping artefact, leaving 6 candidates. C4: 17/17 stable, 0 exception claims | A new cap decision for the 4 remaining snapshots. The 6 candidates have no key | [DRAFT-NEXT] |
| Gemini semantic swap arm | Not run; quota resets about 2026-10-25 | Report agreement between configurations, not accuracy | [DRAFT-NEXT] |
| SEM-01 battery: metamorphic, known groups, prompt sensitivity, doc-free control | Designed (sem-01 §2) | Small builds, about 24–300 calls per item | [DRAFT-NEXT] |
| C1d six cases with twins | 2-case pilot only. Gemini passed; Claude had 1 twin false positive (`Docs/DiagnosticRuns/v1.4-c1d-pilot-2026-10-19.md`) | About 210 calls per vendor (cap 360), two vendors | [DRAFT-NEXT] |
| Complementarity hypothesis | Argued from dev evidence. NS-01 tally of 26 seeds: 12 K0, 4 K1, 9 K2s, 1 K3 (`ops/notes/ns-01-what-rules-cannot-see.md`). DETECT-01 map: 6 of 9 misses symbolically reachable, 3 semantic-only | A test on held-out cases | [DRAFT-NEXT] (design) / [FUTURE-WORK] (at scale) |
| NS1–NS3 studies at scale (about 800 calls) | Cut (`ops/01-instrument-map.md` §8) | — | [FUTURE-WORK] |
| Judge v1/v2.x as the SO3 mechanism | Replaced by C4 + C1d (`ops/notes/c4-01-interpretation-design.md` §2) | Kept as the reason for the redesign | [DROPPED] |

### A3. Graph enrichment (P1, beyond imports)

| Item | Status, with evidence | What remains | Tag |
|---|---|---|---|
| DETECT-01 extractor facts and 7 Cypher rules | PROTOTYPE `[br] explore/detect-01`. The new facts are port-method calls, external types in signatures, statement guards and return shapes. All 6 reachable hand-read cases are found and 0 twins flagged. One rule was adjusted after a miss, so the result is partly fitted (`ops/notes/explore-01-research-log.md`, entry 7) | Promote as a versioned instrument change after 2b, then evaluate on fresh sealed cases | [DRAFT-NEXT] |
| APG v2: FLOWS_TO, SIGNATURE_USES | FLOWS_TO has 0 edges on real code (N40). APG v2 catches 25/27 against a required 27/27 (N41). No support from developer behaviour (N42). Kept behind `apg2` | Reframed | [FUTURE-WORK] |
| Model-supplied facts (K2m, K3) | C1d built. SEM-DUP did not arise on agent code. SEM-FRAG needs declared contexts | See A2 | [DRAFT-NEXT] |
| A2 loader on Neo4j | Never run (`ops/03-build-list.md`, C1d row) | One smoke run | [DRAFT-NEXT] |
| N33 and N38 re-runs | Fixes merged (#253); the re-runs are pending | Zero calls | [DRAFT-NEXT] |

### A4. Brownfield rule inference (C2 derived, C2r)

| Item | Status, with evidence | What remains | Tag |
|---|---|---|---|
| BF-01 LLM derivation | Piloted and re-piloted. A docs-only arm reproduced the reference 6/6, so the graph's added value is not shown (`ops/notes/ns-03-graph-complements-reading.md`). Moved to a separate later study (`ops/notes/trust-01-path-to-a-trusted-instrument.md` §2) | Full 15-repo run, about 90 sessions | [FUTURE-WORK] |
| Deterministic mined baseline | Done. Rule recall 0.41 at precision 0.86; blocking findings 6/273 (`Docs/DiagnosticRuns/v1.3-brownfield-mined-baseline-2026-10-18.md`) | Write it up | [DRAFT-NEXT] |
| C2r spec-author reliability | κ 0.21 between two model sessions, which is an upper bound (N02) | State it as a limit | [FUTURE-WORK] |

### A5. Puzzles and agent experiments

| Item | Status, with evidence | What remains | Tag |
|---|---|---|---|
| PUZZLE-01, 4 dev puzzles with independent oracles | PROTOTYPE `[br] explore/puzzle-01`, all 4 VALID. Instrument view of the traps: P1 invisible, P2 partial, P3 invisible, P4 visible | — | [DRAFT-NEXT] |
| PUZZLE-01 baseline (agent alone) | Running in the cloud: 20 sessions, cap 72 calls, after an adversarial review | Read the results, then decide the next arm | [DRAFT-NEXT] |
| Tool arm with DETECT-01 detections, and the placebo arm | Design only (`ops/notes/puzzle-01-design.md` [br] §4, §9) | Build an exploratory instrument version that serves the prototype rules through MCP. Each arm needs its own approval | [DRAFT-NEXT] |
| HEXDDD-01 elicitation | Pilot failed its pass bar. The blind hand read found 9 violations; the instrument caught 0 (`[br] pilot/hexddd-01`; log entries 2–6) | The author decides on the one allowed revision (a real-repo seed). Fix the S1 seed `.gitignore` gap | [DRAFT-NEXT] |
| 2b Gemini extension arm | Gemini failed S4 (runs 1–3); quota resets about Oct 25 | S4 run 4, then N = 40 under a dated addendum | [DRAFT-NEXT] |
| More tasks, other styles, DDD/Hexagonal confirmatory tasks | Not in the registered protocol. 2 DDD tasks unsealed; DDD is a beta instrument (`Docs/v1.4/confirmatory-tasks-seal.md`) | A DDD capability study first | [FUTURE-WORK] |
| Further vendor arms | Not registered | A registered extension arm | [FUTURE-WORK] |

### A6. Validity at scale (SO4)

| Item | Status, with evidence | What remains | Tag |
|---|---|---|---|
| Sealed hold-out | Not scored. Two attempts stopped at the structure check; the third aborted at the spec schema. Fallback F-RF applies (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`; DELEG-H4) | Either fix the spec format under its own addendum (that run would count as the first scoring), or report "not scored" | [DRAFT-NEXT] |
| V5 independent labels | Moved to after the study | A rater session | [DRAFT-NEXT] |
| Developer-acknowledged truth (about 8 repos) | Route identified (`ops/track-2-scale.md`) | 3–4 agent-days, zero calls | [FUTURE-WORK] |
| FP/FN root-cause review | Decided, tied to the hold-out | — | [DRAFT-NEXT] |

### A7. Meaning (C3m)

| Item | Status, with evidence | What remains | Tag |
|---|---|---|---|
| MEAN-01 human labels (60 items) | Codebook, packet and sample hash ready; 0 labels (`ops/notes/mean-01-codebook-and-sample.md`) | A rater session of about 2.5 h; target 2026-11-30 | [DRAFT-NEXT] |
| MEAN-02 agentic meaning | Designed and reviewed twice; not built (`ops/notes/mean-02-agentic-meaning-design.md`) | A pilot of 22 sessions | [DRAFT-NEXT] / [FUTURE-WORK] |

### A8. Efficiency, delivery, case bank and release

| Item | Status, with evidence | What remains | Tag |
|---|---|---|---|
| EFF-01: graph tools vs files | Harness merged (#259); run not done (`ops/notes/eff-01-efficiency-design.md`). Status conflict: M5 makes it a thesis result, but the instrument map's cut list puts it in future work | 150 sessions, or move it to future work | [DRAFT-NEXT] or [FUTURE-WORK] |
| MCP composition-root gap (V9, DA1) | A registered limitation; the fix needs `src/` | Next freeze | [DRAFT-NEXT] |
| Isolation pre-flight vs a CLI-created `telemetry/` dir | Gap found in the 2a semantic run (§2) | Next freeze | [DRAFT-NEXT] |
| Case bank | 13 cards (`[br] explore/puzzle-01:experiments/puzzle-01/case-bank/`). The design note is not written | Write `ops/notes/case-bank-design.md`; add the instrument verdicts from log entry 6 | [DRAFT-NEXT] |
| C5 drift on human histories | Descriptive run done | A registered study | [FUTURE-WORK] |
| Release reproducibility (tag, DOI, path scrub) | RED (open-items G5). Software Heritage request 2566612 is pending | Record the SWHID; release tag | [DRAFT-NEXT] |

### Status files that disagree (fix before quoting any of them)

1. **`ops/00-overview.md` is stale.** It still says "Study 2 earliest Nov 18–22", "Running now: nothing", and an old waiting list.
2. **X-1 and SO3-a.** `ops/notes/deviations-v14.md` rows 12–13 say "drafted, unsigned"; `ops/decisions.md` D8 says signed.
3. **F3 rewording.** `Docs/v1.3/contribution-statement.md` says "NOT ADOPTED UNTIL SIGNED" and "Study 2 is not part of the statement". Both are out of date after 2b.
4. **Construct questions.** The compendium README still says 0/25 answered, but V1 is GREEN (ADR-V13-03 accepted). The README's SO5 rows are also merged into one broken table row.
5. **Adjudication rows.** `ops/decisions.md` "Still open" lists 9 rows; DELEG records the signing desk at 61/61.
6. **Hold-out "spent".** DELEG-H4 says it is not spent; the run note says it is open for the author.
7. **Turn budget.** `ops/05-plan-to-friday-2026-10-23.md` says about 104 turns; the run used 520, as registered.
8. **Snapshots from Oct 18–19 are stale:** `ops/track-1-instrument.md`, `ops/track-2-scale.md`, `ops/03-build-list.md` and `ops/04-north-star.md`.
   - They show the hold-out as "not run" with no attempt, C1d as never run live, and C4 as "built as the judge".
   - `ops/notes/trust-01-path-to-a-trusted-instrument.md` L7 also says C4 is not designed, though C4 was built in PR #282.

---

## Part B: capabilities built

### P1. Representation

| Capability | Evidence | Maturity |
|---|---|---|
| TypeScript extraction (`src/apg-extractor`, ts-morph): imports, classes and members, injection edges, CALLS | Literal view equals tsc at 1.000/1.000 on 15 external repos (`Docs/DiagnosticRuns/v1.3-default-view-coverage-2026-10-16.md`). Jaccard 0.988 vs dependency-cruiser (dev) | VALIDATED for imports; DEV for DDD class facts |
| Per-snapshot coverage check (`scripts/v1.4/snapshot-coverage.ts`) | 591 of 600 2b snapshots pass | VALIDATED |
| Property graph on Neo4j, and the in-process interpreter (`src/cypher-interp`) | 72,388 statements identical over 81 projects (`Docs/v1.3/cypher-interpreter.md`). 2b D8: 30 of 30 identical | VALIDATED |
| Violation identity and rename tracking (`scripts/lib/drift/identity.ts`, `git-rename.ts`) | The basis of D in 2b | VALIDATED |
| C1d semantic facts (`src/apg-enrich/ontology/`: SEM-MISPLACED, SEM-DUP, SEM-FRAG) | 2-case pilot. 2a: 692 cassettes, replayable at 0 calls, 1 hallucination rejected | DEV |
| APG v2 (FLOWS_TO, SIGNATURE_USES) | N40, N41 | DEV (reframed) |
| DETECT-01 experimental extractor and 7 rules | Log entry 7 | PROTOTYPE |

### P2. Norms

| Capability | Evidence | Maturity |
|---|---|---|
| 5 style presets (`presets/*.yaml`): Clean, Layered, NestJS, Hexagonal, DDD | 35 rule ids (`ops/notes/g13-so1-rule-count-deviation.md`). Tiers sealed (`Docs/v1.3/sealed-hashes.md`) | VALIDATED as sealed artefacts. Sources not expert-reviewed |
| Blocking/advisory tiers and construct switches (`src/construct-switches`) | ADR-V13-03 accepted. 197 tunables hashed | VALIDATED (in force) |
| Spec levels and spec parser (`src/spec-parser`) | Define the 2b cells L2 and L3 | VALIDATED |
| Deterministic rule mining (`src/rule-mining`) | 24/52 plants (N07). Brownfield baseline: recall 0.41, precision 0.86 | DEV |
| Spec proposal (`propose_spec`) | Mislabels flagship DDD repos (N11) | DEV |

### P3. Judgement

| Capability | Evidence | Maturity |
|---|---|---|
| Rule detection with check-correct | 283/283 correct on human code, repo-level interval [0.741, 1]. 1,392/1,392 correct in 2b. Dev blind recall 54/65. No hold-out figure | VALIDATED for precision; DEV for recall |
| Agreement with external tools | κ 0.913–1.000 against dependency-cruiser, eslint-plugin-boundaries and ArchUnitTS; lower on some rules (N130) | VALIDATED |
| Seeded operators and mutation and metamorphic suites | Kill rate 33% → 60%. 2b seeded recall 71/71, 76/76, 71/71 (V4 part B) | VALIDATED in 2b; suites DEV |
| C4 interpretation (`src/apg-enrich/ontology/c4-*`): exception claims, severity; cannot overturn a verdict | 2a: 34 calls, all stable. Not yet run against a seeded key | DEV |
| Judge v1/v2.2 (`src/llm-critic`, frozen) | Catch 0.76 (N63) | DEV (dropped) |

### P4. Use and delivery

| Capability | Evidence | Maturity |
|---|---|---|
| MCP server (`src/mcp-server`) | 11 tools: `get_architecture_spec`, `which_layer`, `check_import`, `check_file`, `check_diff`, `suggest_placement`, `explain_finding`/`explain_violation`, `propose_rules`, `evaluate_project`, `propose_spec`. `--neural` adds `review_unit` and `explain_and_fix`. `--confine` passes S4. p95 latency 38 ms. Used in 160/160 2b steps | VALIDATED (the 2b treatment) |
| CI gate (`src/ci-gate`) | Exact on 197/203 with Neo4j (N57) | DEV |
| Drift metrics D, D†, Y, repair (`scripts/lib/drift/study2-d.ts`, `scripts/v1.4/d-dagger.ts`) | Study 2b | VALIDATED |
| Exposure count (`scripts/v1.4/exposure-count.ts`) | 2a and 2b. Layered specs only | VALIDATED (Layered) |

### Experiment harness

| Capability | Evidence | Maturity |
|---|---|---|
| Loop harness (`scripts/lib/loop`): plans, replicates, lanes, kill-and-resume, call ledger, telemetry checker | 2b: 520 turns, 0 failures, 0 redraws | VALIDATED |
| Pinned CLI by binary sha256; a version mismatch refuses to run | 2b pre-run checks, re-checked per replicate | VALIDATED |
| Customizations-off flags (DELEG3) | Equivalence check passed | VALIDATED |
| S4 confinement probes (no-MCP and MCP) | Claude 9/9. Gemini failed | VALIDATED (Claude) |
| Post-run acceptance runner (`scripts/v1.4/post-run-acceptance.ts`) | 0.740 / 0.750 / 0.755 per cell | VALIDATED |
| Cloud-sandbox runs (HEXDDD-01, DETECT-01, PUZZLE-01) | Smoke and confinement passed in the sandbox | DEV |

### Statistics, pre-registration and integrity

| Capability | Evidence | Maturity |
|---|---|---|
| Analysis script (`scripts/v1.4/study2b-analyse.ts`): sign-flip (MC and exact), Holm, equivalence E, bootstrap, sensitivities | Planted effect recovered; 2a reproduced; ran once on 2b | VALIDATED |
| Power simulation (`scripts/v1.4/study2b-power.ts`) | Sized N = 40 | VALIDATED |
| Hash gates: registered artefacts in CI (27/27), freeze checks, tunables | 2b results §1 | VALIDATED |
| Leakage scan, archive with path scrub, citation lint | 0 hits | VALIDATED |
| Claims ledger and checker (`scripts/v1.3/claims-ledger-check.mjs`) | 8,000+ rows with conflict ids | VALIDATED (bookkeeping) |
| Replication (`npm run replicate:v1.3`) | 5,154 numbers re-derived | VALIDATED |
| Pre-registration and OSF deposit procedure | `Docs/v1.4/study2b-preregistration.md`, osf.io/wctnh | VALIDATED |
| Hold-out runner and blind adapter | Never scored | SPEC-ONLY in effect |

### Exploratory prototypes (unmerged)

| Prototype | Branch | Evidence |
|---|---|---|
| DETECT-01 semantic questions | `explore/detect-01` | 32 calls, all citations grounded, twin discrimination 9/11 |
| PUZZLE-01 puzzles, oracles, verifier, hint audit | `explore/puzzle-01` | 4/4 valid |
| Case bank, 13 cards | `explore/puzzle-01` | Seeded; the design note is pending |
| MEAN-02 and EFF-01 runs | — | SPEC-ONLY (the EFF-01 harness is built) |

---

## Strongest claims the evidence supports today

1. **Study 2b.** One generator (claude-sonnet-5-5), 4 sealed Layered tasks, scoped to FF-S03. Both the richer spec (RR 0.62) and the MCP tool (RR 0.48) reduce new blocking violations relative to `none@L2`, supported under D and D†. The effect is uneven across tasks, and it shrinks across the run order (M180).
2. **Detection is correct on human code:** 283/283, with the repo-level interval [0.741, 1]. Correct does not mean meaningful.
3. **The engine is independent of the database:** Neo4j and the interpreter agree on 72,388 statements, and the import graph equals tsc on 15 external repos.
4. **Study 1 (registered):** the spec-level effect runs in reverse, and through project size (F1).
5. **Under Layered, agent drift is concentrated in one habit:** presentation-root wiring. FF-S01 and FF-S02 were exercised and gave 0 violations (M175, M176).
6. **Symbolic and semantic paths look complementary (dev, n = 2).** The instrument missed 9 of 9 hand-read Hexagonal/DDD violations. Prototypes reach 6 symbolically, given new facts, and 3 only semantically. This is a hypothesis, not a test.
7. **The semantic layer runs reproducibly:** grounded, replayable at 0 calls, with abstention. Its accuracy is unmeasured.
8. **Methodology:** a run-once pre-registration with dated deviations, hash integrity and an OSF deposit.

## Chapter-to-evidence map

| Chapter | Evidence |
|---|---|
| Ch. 3, design and deviations | The proposal-vs-delivered table carries X-1 and SO3-a (`ops/notes/deviations-v14.md`) |
| Ch. 4, instrument | Follows the planes P1–P4 (`ops/01-instrument-map.md` §8). Part B of this page is its inventory |
| Ch. 7–9, evaluation | The compendium, ledger and nulls (`Docs/v1.3/compendium/`); Study 2b (`Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`). Limitations come from `nulls-and-limits.md` |
| Contributions F1–F3 | `Docs/v1.3/contribution-statement.md`. Update the F3 status and add 2b first |
| Threats | `Docs/v1.3/threats-register.md`, plus the three rows ready in `ops/notes/g15-threat-rows.md` |
| Discussion and future work | Part A of this page: every [FUTURE-WORK] row, and the exploratory thread (`ops/notes/explore-01-research-log.md`) |

## Changelog
- 2026-10-21: first version, written at the start of chapter drafting.
