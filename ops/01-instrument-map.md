# The instrument map: its parts, their state, and the work left

**Revised 2026-10-26: replaces the earlier version; reflects Study 2b closure and the v1.5 exploratory results.**

This page is the working surface for the instrument. Drive the remaining work from §5. Comment inline with `> AUTHOR:`.

**How to read it**
- Objective numbering follows the thesis objectives table (Kap3, `tab:fw-objectives`): **SO1** spec format, **SO2** APG pipeline, **SO3** gate and bounded model role, **SO4** validation, **SO5** spec effect on agent-built architecture. The earlier version of this page used an older numbering; that numbering is superseded.
- Ledger ids: `C…` rows are in `Docs/v1.3/compendium/claims-ledger/`; `N…`, `L…` and `M…` rows are in `Docs/v1.3/compendium/nulls-and-limits.md`. Where no id exists, the report path is given.
- Everything labelled v1.5 is development evidence: n = 3 to 5 per cell, one generator (`claude-sonnet-5-5`), code in `experiments/`, nothing pre-registered (`Docs/DiagnosticRuns/v1.5-exploratory-synthesis-2026-10-23.md`).
- The v1.4 freeze tag `v1.4-freeze-2026-10-20` and the registered Study 2b artefacts stay as they are.

**Contents**
1. What changed since the 2026-10-18 version
2. The map: planes and parts
3. Component table
4. Status by objective, SO1–SO5
5. Drive from here
6. Open author decisions that touch the instrument
7. Chain of trust and conditions for a confirmatory claim
8. Risks
9. Changelog

---

## 1. What changed since the 2026-10-18 version

- **Study 2b is closed.** It ran once under the OSF pre-registration (osf.io/wctnh). H1 and H2 are supported, H3 is not rejected, and equivalence fails (C8039–C8053). The old four-week path to "Study 2, once" is done and removed.
- **The hold-out was attempted, not scored.** Three attempts on 2026-10-20 aborted on the spec format. The hold-out is not spent (C7592–C7619, L177, L178). It now needs a spec-format addendum.
- **v1.5 added prototype parts.** New graph facts, new rules, an edit gate (push delivery), a C4 severity rubric and model-grounded aggregate roots. All live in `experiments/` and are development evidence only.
- **The LLM judge is dropped.** C4 and C1d replace it (judge catch 0.76, N63; 0/65 verdicts changed, N85).
- **The objective numbering changed** to the Kap3 table. The old §7b table is replaced by §4.
- **The old work list (§8, four weeks) is replaced** by the ordered steps in §5.

---

## 2. The map: planes and parts

The four planes from the earlier version still hold. v1.5 adds parts inside them; it adds no plane.

```
                code at commits t0 ... tn
                          |
                          v
+-----------------------------------------------------------+
| P1 REPRESENTATION                                         |
|   APG extract + graph (C1a-C1c)   v1.5 graph facts        |
|   C1d semantic facts (N1)         S3 aggregate roots      |
|   violation identity (C1e)                                |
+-----------------------------------------------------------+
        | A1 graph G(t)          | A2 facts file
        v                        v
+-----------------------------------------------------------+
| P2 NORMS                                                  |
|   spec format + 5 style libraries (C2 declared)           |
|   rule mining / spec proposal (C2 mined)                  |
+-----------------------------------------------------------+
        | A3 norm set
        v
+-----------------------------------------------------------+
| P3 JUDGEMENT                                              |
|   rules (C3)   v1.5 rules   C4 interpretation (N3)        |
|   S2 confirmation   C3m meaning (human labels)            |
+-----------------------------------------------------------+
        | A4 findings, A5 verdicts
        v
+-----------------------------------------------------------+
| P4 USE                                                    |
|   MCP server (pull)   edit gate (push)   CI gate          |
|   drift metrics D, D-dagger   loop harness                |
+-----------------------------------------------------------+
        |              A6 run record (per study)
        +----> next commit (back to P1)
```

Text alternative: code is turned into a graph and a facts file (P1). The spec and style libraries give the norms (P2). Rules and the semantic layer judge the graph against the norms (P3). The findings reach the agent through MCP, the edit gate or CI, and the drift metrics score what the agent builds (P4).

**Design rules that still hold**
- A part reads another part's artifact, never its internals. Rules do not care whether a fact came from the parser or a model.
- The model reads code and docs, then uses the graph to check and quantify (`ops/notes/ns-03-graph-complements-reading.md`).
- The model supplies facts and interpretations. It cannot overturn a rule verdict (C4 design, `ops/notes/c4-01-interpretation-design.md`).
- The semantic configuration (model and route for N1 and N3) is a named run parameter, recorded in every A2 and A5 record (DELEG11, `ops/decisions.md`).

**Artifacts A1–A6, current state**

| Artifact | Producer | State |
|---|---|---|
| A1 graph G(t) | APG extract | exists; v1.5 adds facts in `experiments/detect-02/` |
| A2 facts file | C1d, S3 | exists; 692 replayable cassettes from Study 2a (C8009–C8021) |
| A3 norm set | spec parser | exists; per-rule origin and acceptance tags not added |
| A4 findings | rules | exists (`schemas/report.schema.json`) |
| A5 verdicts | C4 | exists for 2b secondary and U3 (C8445–C8466, C9024–C9061) |
| A6 run record | each study | exists for Study 1, 2a, 2b and the v1.5 runs |

---

## 3. Component table

Maturity: **validated** (passed a registered or external test), **prototype** (built and run on development material), **dev** (in `src/` or scripts, evidence on development material only), **spec-only** (designed, not run), **dropped**.

| Component (old part) | Obj. | Maturity | Code | Evidence (ledger ids, reports) | Next action |
|---|---|---|---|---|---|
| Spec format + 5 style libraries, levels L1–L4, spec parser (C2 declared) | SO1 | validated as sealed artefacts; sources not expert-reviewed | `src/spec-parser/`, `src/fitness-compiler/` | 35 rule ids vs the promised 30+ over 7 dimensions, declared deviation (`ops/notes/g13-so1-rule-count-deviation.md`); construct answers accepted, gate V1 green (ADR-V13-03); mapping κ 0.77 on 4/15 repos (N01); blind-author verdict κ 0.21, both authors Claude (N02); rule defects N14, N17 (fixed by ADR-V14-01), N18, N20 | hold-out spec-format addendum (§5 step 2) |
| APG extraction + property graph, Neo4j and in-process Cypher (C1a–C1c) | SO2 | validated for imports; dev for DDD class facts; FLOWS_TO dev | `src/apg-extractor/`, `src/neo4j-ingestion/`, `src/cypher-interp/` | imports = tsc 1.000 on 15 external repos; 72,388 statements identical over 81 projects (`Docs/v1.3/cypher-interpreter.md:20`); 2b D8 parity 30/30 (`Docs/DiagnosticRuns/v1.4-study2b-results-2026-10-21.md`); alias gaps N32, N33; FF-S02 timeouts N45; FLOWS_TO 0 edges on real code (N40); edge rows not human-adjudicated (L29) | calls through ports and the DA1 mismatch (§5 step 1) |
| v1.5 graph facts: write footprint, context ownership, `callers`, `who_writes`, receiver typing | SO2 | prototype | `experiments/detect-02/` | Medusa `callers` and `who_writes` 100%/100% (was 0–17%); Backstage `callers` 94–100% (C10131–C10180); inferred write facts are heuristics | promote to `src/` with the FR-1 fidelity test (§5 step 1) |
| Fitness functions / Cypher rules, blocking and advisory tiers (C3) | SO2, validity SO4 | validated for precision; dev for recall | `src/fitness-compiler/`, `src/evaluation-engine/` | 283/283 correct on 15 external repos, repo-level Wilson [0.741, 1] (C1522–C2491); blind recall 50/64 = 0.78, four styles below 0.90 (N105); convergent κ 0.913–1.000 (N130); HEXDDD-01 hand read: 0/9 violations caught (C8641–C8665) | score the hold-out (§5 step 2) |
| v1.5 rules: DETECT-01 (7 rules), DETECT-02 R-D4, R-XCTX, `check_consistency` | SO2, SO3 | prototype, partly fitted on dev | `experiments/detect-01/`, `experiments/detect-02/` | 19/19 trap trees flagged, 0 FP on dev (C9068–C9081); DDD fixtures 0/20 FP after 3 logged revisions; 12 false hits on human DDD repos with inferred roots (C9082–C9091); DETECT-01 6/9 misses reachable (C8703–C8751) | DETECT-02 sealed held-out check once, then promote (§5 step 1) |
| MCP server, 11 tools, `--confine`, `--neural` (pull delivery; C6) | SO3 delivery, SO5 treatment | validated for Claude on Layered | `src/mcp-server/` | used in 160/160 mcp@L2 steps in 2b (C8022–C8131); S4 confinement Claude 9/9, Gemini failed; fast path disagrees on 7/71 variants (N54); missed feedback twice in replay (N51) | fix DA1 (the MCP check flags files the scorer exempts) (§5 step 1) |
| Edit gate: hooks + root-side hub (push delivery) | SO3 | prototype | `experiments/edit-gate/` | 12/12, then 20/20 unit tests; 0 canaries leaked; hub p95 171–451 ms; 0 fail-open (C8993–C9021, C9301–C9308) | delivery choice (§5 step 4) |
| CI gate | SO3 | dev | `src/ci-gate/` | exact on 197/203 with Neo4j (N57); lexical version 50.9% (N56); the repo's own firewall CI check is a known failure | none before the final study |
| C1d semantic facts N1 (SEM-MISPLACED, SEM-DUP, SEM-FRAG) | SO3 | dev | `src/apg-enrich/ontology/` | 2-case pilot: Gemini clean, Claude 1 FP on the twin (C6888–C6895); 2a hit the 700-call cap (C8009–C8021); accuracy against a key unmeasured | register in the final study (§5 step 3) |
| C4 interpretation N3 (exception, severity; cannot overturn a verdict) | SO3 | dev | `src/apg-enrich/ontology/c4-runner.ts`, `scripts/v1.4/c4-run.ts`; U3 rubric in `experiments/v15-u3/` | 2b six-case set 5/6, so D_sem not run (C8445–C8466); U3 rubric 24/24 on a designed set, same-session author (C9024–C9061, C9108–C9120) | promote the U3 rubric; register D_sem (§5 step 3) |
| S3 aggregate-root facts, S2 finding confirmation | SO3 | prototype | `experiments/v15-u4/` | S3 pass: 22/23 declared roots, 0 wrong; S2 fail: D5 recall 11/16, 4 added FP (C10041–C10109) | D5 construct decision (§6) |
| LLM judge v1/v2.2 (`llm-critic`) | SO3 | dropped (frozen) | `src/llm-critic/` | catch 16/21 = 0.76 vs a 0.80 target (N63); 0/65 verdicts changed (N85); panel n = 0 (N81) | none; report as a null |
| Drift metrics D, D-dagger, Y; violation identity and rename tracking (C1e, C5) | SO4, SO5 | validated (Study 2b) | `scripts/lib/drift/` | basis of the 2b outcome (C8022–C8131); D_v15 (frozen + R-D4 + R-XCTX) in DRIFT-01 is exploratory (C9941–C10017) | define D_v15 for the final study after step 1 |
| Loop harness, pinned CLI, S4 probes, acceptance runner, analysis, power sim, hash gates, claims ledger | SO4, SO5 method | validated | `scripts/`, `experiments/study2b/`, `ops/osf-deposit-2b/` | 2b: 520 turns, 0 failures, 0 redraws (C8022–C8131); the hold-out runner has never scored (C7592–C7619) | scripted confinement check for a second vendor (§5 step 5) |
| Rule mining / spec proposal (C2 mined) | SO1, SO2 | dev | `src/rule-mining/` | 24/52 plants, DDD 1/12 (N07); brownfield baseline recall 0.41, precision 0.86 (C6137–C6219); `propose_spec` mislabels DDD repos (N11) | future work |
| C3m meaning labels | SO4 | spec-only (0 labels) | no code; `ops/notes/mean-01-codebook-and-sample.md` | 0 labels (N114); registered real-code precision 0.328 [0.132, 0.609] (N115); 51/60 style-claiming human repos fail (N116) | 60 rater labels, target 2026-11-30 (§6) |

---

## 4. Status by objective, SO1–SO5

Confirmatory means registered before the data, or an external test chosen before the results. Everything else is exploratory.

### SO1 spec format

- **Established.** Five sealed style libraries and the spec format, used unchanged in Study 2b. Construct answers accepted (gate V1, ADR-V13-03). Study 1 found a spec-level effect in the reverse direction: `none` 0.951 best, Holm p = 0.0003 (N141); no model effect, p = 0.438 (N142).
- **Exploratory only.** Brownfield norm derivation (BF-01, C6137–C6219). No SO1 change in the v1.5 cycle.
- **Missing.** Expert review of the style libraries. A human spec author (spec-author agreement is κ 0.21 between two Claude sessions, N02). The 30+ rules over 7 dimensions promise, now a declared deviation (`ops/notes/g13-so1-rule-count-deviation.md`). The hold-out spec format (§5 step 2). A comparison with the Ford/Richards ADL.

### SO2 APG pipeline

- **Established.** Import graph = tsc at 1.000 on 15 external repos. Engine parity on 72,388 statements over 81 projects (`Docs/v1.3/cypher-interpreter.md:20`). Blocking findings 283/283 correct on 15 external repos, repo-level Wilson [0.741, 1] (C1522–C2491). The frozen instrument scored Study 2b.
- **Exploratory only.** GRAPH-SCALE facts on Medusa, Novu and Backstage (C10131–C10180). DETECT-02 facts (C9068–C9091). COMPREHEND-01: files plus graph tools were not more accurate (0.900 vs 0.933) but were cheaper, token ratio 0.835 (C8941–C8983). Repo scout: 82 repos, 3 qualifying trees (C9733–C9808).
- **Missing.** The v1.5 facts in `src/`. Calls through ports linked in the extractor. Data-flow edges (FLOWS_TO has 0 edges on real code, N40). Human adjudication of edge rows (L29). A written deviation for the dropped Neo4j GDS metrics.

### SO3 gate and bounded model role

- **Established.** The MCP tool as the 2b treatment: used in 160/160 mcp@L2 steps (C8022–C8131). The model role is bounded by design: C4 cannot overturn a verdict. The registered semantic secondary D_sem was not run because its precondition failed, 5/6 (C8445–C8466). The judge null is reported (N63, N85).
- **Exploratory only.** U3 severity rubric 24/24 on a designed set (C9024–C9061). S3 roots 22/23, S2 fail (C10041–C10109). Edit gate built and used in PUZZLE-04 and DRIFT-01 (C8993–C9021, C9456–C9528). DETECT-01 semantic twin discrimination 9/11 (C9285–C9289). C1d 2-case pilot (C6888–C6895).
- **Missing.** Semantic accuracy against an independent key. A test that rules plus facts beat rules alone and the model alone (not started). A second vendor for any model role. A delivery-mode choice (pull vs push).

### SO4 validation

- **Established.** External correctness, 283/283, with the repo-level interval (C1522–C2491). Convergent agreement with three tools, κ 0.913–1.000 (N130). The developer-behaviour criteria are null and reported as null (N118, N120, N125, N128).
- **Exploratory only.** Blind recall 0.78 on the development set (N105). DETECT-02 precision fixtures (C9082–C9091). Puzzle hand reads: 17/17 oracle FAILs were traps in PUZZLE-03 (C9399–C9454). HEXDDD-01: 0/9 hand-read violations caught (C8641–C8665).
- **Missing.** The hold-out score (C7592–C7619; the set is not independent, L178). Meaning labels, 0 of 60 (N114). Human FP/FN root-cause review, which waits for the hold-out.

### SO5 spec effect on agent-built architecture

- **Established.** Study 1 as registered (N141, N142; 0/65 cells with a blocking finding, N144). Study 2b: mean D 2.75 / 1.70 / 1.32 for none@L2, none@L3, mcp@L2. H1 p = 0.0132, RR 0.62 [0.38, 0.86]; H2 p = 0.0001, RR 0.48 [0.32, 0.65]; H3 p = 0.4257; equivalence fails (C8039–C8053). Scope: 100% of counted identities are FF-S03 (C8051, C8053, M175); one generator, Layered, 4 tasks (C8042–C8044); the effect shrinks over run order (M180); the same rules gave feedback and the score (M186).
- **Exploratory only.** Puzzle pull and gate arms: P1 0/5 to 4/5 (pull), P6 0/5 to 5/5 (both arms) (C9341–C9389, C9456–C9528). DRIFT-01: sum of D_v15 on DDD 6 for `none`, 0 for pull and gate; D_frozen 0 everywhere; the gate removed inherited cross-context writes in 3/3 blocks, pull in 0/3 (C9941–C10017).
- **Missing.** A second style and a second generator in a registered study. The final study is a draft, not registered (`ops/notes/v15-final-study-draft.md`). Evidence that fewer rule hits means better architecture (C3m). An open-coding failure taxonomy.

---

## 5. Drive from here

Do the steps in this order. Steps 2 and 5 can start in parallel with step 1. The final study (task authoring, power, registration) follows these steps and is tracked in `ops/notes/v15-final-study-draft.md` §8.

### Step 1. Freeze v1.5

Sub-steps:
- **1a.** Fix the answer keys for P2 and P5 and the P5 test. P2 has a key dispute and over-rejection categories (P2-SG2-a, P1-SG1-c, P2-SG1-e; synthesis §3, `ops/notes/explore-01-research-log.md` entries 15, 16 and 18). The P5 step-3 test is under-specified: every P5 run fails only that step (`Docs/DiagnosticRuns/puzzle-04-2026-10-23.md`). Reported results stay as reported; the fix applies to later runs, with a changelog line.
- **1b.** Finish calls through ports in the extractor, and fix the composition-root mismatch DA1 (`ops/notes/v15-plan.md` rows 21–22).
- **1c.** Run the DETECT-02 sealed held-out check once (zero calls). The coordinator does not open the sealed set before the run.
- **1d.** Move the v1.5 code (`experiments/detect-01/`, `experiments/detect-02/`, `experiments/edit-gate/`, `experiments/v15-u3/`, `experiments/v15-u4/`) into `src/`. Then tag v1.5 with a changelog.

- **Depends on:** 1a and 1b have none. 1c needs the DETECT-02 precision work to be final. 1d needs 1a–1c.
- **Blocker:** human labels: the author's hand read of the P2 over-rejection categories (for 1a). The rest is engineering.
- **Done when:** keys and the P5 test are committed with a changelog; port calls link to adapters, and the FR-1 fidelity test passes; DA1 is fixed with a test; the DETECT-02 held-out result is recorded once; the dev regression on the 91 dev trees is identical (as in `Docs/DiagnosticRuns/graph-scale-2026-10-23.md`); the v1.5 tag exists; `v1.4-freeze-2026-10-20` and the 2b artefacts are unchanged.

### Step 2. Hold-out spec-format addendum, then score once

- **What.** Write an addendum that fixes the hold-out spec format only, register it before any scoring, then score the 207-case hold-out once on Neo4j (`Docs/DiagnosticRuns/v1.4-holdout-2026-10-20.md`).
- **Depends on:** nothing in step 1. The runner is the one at the freeze tag, as in the prespec, unless the addendum states otherwise.
- **Blocker:** author decision: whether a further attempt is made, and approval of the addendum. The V4 ADR applies: below about 35 expected blocking findings per style the lower bound cannot pass (`Docs/v1.4/adr-v4-holdout-bar.md`).
- **Done when:** the addendum is committed and hashed before the run; one scoring run is recorded; per-style recall and precision are reported with Wilson intervals against the prespec claim levels; any style below 0.90 is reported as characterised; no second scoring.

### Step 3. Register the semantic layer and D_sem in the final study

- **What.** Name D_sem's role in the final study from the start: the C4 prompt version (U3 rubric), the C1d and S3 fact roles, the semantic configuration parameter, and the precondition that must pass before D_sem runs.
- **Depends on:** step 1 (U3 rubric and S3 in `src/`); the D5 construct decision.
- **Blocker:** author decisions: the D5 set-invariant construct question (S2 failed, C10041–C10109), and whether D_sem is secondary or co-primary (`ops/notes/v15-final-study-draft.md` §8).
- **Done when:** the final-study draft names D_sem's role, its precondition bar and its pinned prompt and model; the precondition is tested on a case set whose answers were written first and that the rubric author did not write.

### Step 4. Choose the delivery mode: edit gate (push) or MCP (pull)

- **What.** Choose one delivery mode, or both as arms, for the final study.
- **Depends on:** step 1 (gate and `check_consistency` in `src/`); the PUZZLE-04 and DRIFT-01 hand reads.
- **Blocker:** human labels: the author's hand read of PUZZLE-04 and of the 4 DRIFT-01 identities. Then an author decision on the mode.
- **Evidence so far (dev, n = 3–5):** the gate removed inherited debt in 3/3 DRIFT-01 blocks, pull in 0/3 (C9941–C10017); pull did better on P1 (4/5 vs gate 2/5) (C9341–C9389, C9456–C9528); no placebo arm, and tool and instruction are confounded.
- **Done when:** the choice is recorded in `ops/decisions.md` with the evidence rows; every blocking rule has an actionable message; the chosen mode has passed one pilot on the `src/` code.

### Step 5. Second-vendor arm, pending a design note

- **What.** A design note for a 2-run non-Claude pilot, with a scripted confinement check. No escape or tamper prompts are sent to any model.
- **Depends on:** nothing for the note. The pilot itself needs step 1.
- **Blocker:** author decisions: the go-ahead for the note, and the route (Gemini API, OpenRouter, Grok, or free models only).
- **Done when:** the note is committed; the scripted confinement check passes for the chosen vendor; the 2-run pilot result is recorded; or the arm is declared out of scope, with a deviation line for SO5.

**After steps 1–5** (from `ops/notes/v15-final-study-draft.md` and synthesis §5): at least 7 sealed tasks per style with behaviour tests; task-level power; the final-study decisions; MEAN-01 labels or a stated absence; registration; S4 and a dress rehearsal; then one run.

---

## 6. Open author decisions that touch the instrument

1. The D5 set-invariant construct question (U4 S2 failed). Blocks step 3.
2. Whether a further hold-out attempt is made under a spec-format addendum. Blocks step 2.
3. The delivery mode: gate, pull, or both. Needs the PUZZLE-04 and DRIFT-01 hand reads first. Blocks step 4.
4. The second-vendor route and the go-ahead for its design note. Blocks step 5.
5. The final-study choices: option A, B or C; DDD confirmatory or exploratory; start state; D_sem secondary or co-primary; brownfield arm; task author (`ops/notes/v15-final-study-draft.md` §8).
6. Booking the MEAN-01 rater. Target for labels: 2026-11-30 (`ops/notes/mean-01-codebook-and-sample.md`).
7. The one allowed HEXDDD-01 revision (real-repo seed).
8. EFF-01: run it, or move it to future work (COMPREHEND-01 partly covers it).

---

## 7. Chain of trust and conditions for a confirmatory claim

```
SO5 "spec or tool changes what the agent builds"
  <- C3m "a finding means an architectural problem"     (0 labels, N114)
       <- C3 "the findings are right"                   (283/283; hold-out not scored)
            <- A3 "the norms are right"
                 <- C2r "independent authors agree"     (κ 0.21, both Claude, N02)
                 <- C1 "the graph is the code"          (imports 1.000 vs tsc)
```

The weakest link is still C3m, then C2r. Study 2b adds one more: the same rules gave the MCP feedback and the score (M186). A downstream claim is as strong as its weakest upstream link. Greenfield claims can be confirmatory, because the norms are declared. Brownfield claims stay exploratory while C2r is red.

| Result | Condition for calling it confirmatory |
|---|---|
| Hold-out | pooled blocking recall ≥ 0.90 with Wilson lower bound ≥ 0.80; 0 incorrect blocking findings; per style, point and interval; any style below 0.90 is characterised (`ops/02-defensibility-conditions.md`) |
| External correctness | quote 283/283 with the repo-level interval [0.741, 1] |
| Meaning (C3m) | n ≥ 60; author–rater κ ≥ 0.60 under the dated definition; otherwise report the construct as unlabelled |
| Semantic layer (SO3) | a registered D_sem with a precondition passed on cases the rubric author did not write; ≥ 6 cases with twins, ≥ 5/6 correct, 0 twin false positives |
| Final study (SO5) | the 2b conditions carry over (pre-registered, power, Holm, tool use, acceptance, evasion read), plus ≥ 7 tasks per style and the five gates in synthesis §5 |

---

## 8. Risks

| Risk | It hits | Mitigation |
|---|---|---|
| Fitted prototypes. v1.5 rules were revised on the same dev cases (C9082–C9091) | final study, SO2 | step 1c sealed check; no rule change after the freeze tag |
| Rule circularity. The same rules give feedback and score (M186) | SO5 | report it; if feasible, a held-out rule set in the final study |
| Scope. 2b counts only FF-S03 (M175) | SO5 claims | quote the scope every time; final study adds a style |
| Same model family for generator and semantic roles | SO3, SO5 | step 5, or a declared limit |
| CLI drift. Hooks and pins depend on the Claude CLI version | edit gate, harness | pin the CLI per arm; record the version in A6 |
| Deviation count after registration | examiner view | anything new is a separate exploratory study |

---

## 9. Changelog

- 2026-10-26: full revision. Study 2b closed and the hold-out attempts recorded. v1.5 prototype parts added. Objectives renumbered to Kap3. New component table (§3), status by objective (§4), ordered steps (§5) and decision list (§6). Removed the four-week path, the old SO table and the question list.
- 2026-10-19 (evening): C3 and hold-out rows no longer lead with F23 (done); they point to U6 and the V4 ADR.
- 2026-10-19: corrected the neural-layer rule. The graph complements reading (NS-03).
- 2026-10-18 v3: after REV-02 and the conditions register. New part C3m (meaning). C2r corrected to two Claude sessions.
- 2026-10-18 v2: four planes, C1e, C2r, artifacts A1–A6, per-part evaluation, chain of trust, risks. Drift moved out of Study 2.
- 2026-10-18 v1: first draft, from the author's decomposition.
