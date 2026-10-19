# Track 1: the instrument (SO1, SO2, SO3)

**As of 2026-10-18, main @ `612b3727`.** No new measurement. Every figure comes from the compendium (`Docs/v1.3/compendium/README.md`) or from a null or limit row (`Nxx`) in `Docs/v1.3/compendium/nulls-and-limits.md`. Two facts bound everything below: **the sealed hold-out has not been run**, and almost all evidence is **development material**, which the tool was tuned on. The exception is the set of 15 external human-written projects.

The track is read three ways:
- **A**, per objective;
- **B**, per link of the chain;
- **C**, applied to a few projects.

The same evidence shows up in more than one view. That is deliberate: a weak link shows up as a weak objective, and as a project where the result can't be trusted.

---

## Bottom line

> The **deterministic core is strong**. Code→graph (Link 1) and rules (Link 3) match the compiler and three independent tools, and every blocking finding checked on human code is correct.
>
> The instrument is **weakest exactly where the thesis claim lives**:
> - **Spec (Link 2):** who writes the spec changes a third of the verdicts.
> - **Meaning (Link 4):** no label of any kind exists yet.
> - **Neural (Link 5):** below target, the registered headline has n = 0, and the semantic layer has never run on a real model.
>
> "Neuro-symbolic" is currently argued, not shown. That is why the next work in this track is thinking and designing on Link 5, not more runs.

---

## A. Per objective

### SO1: specifications and style libraries. Overall: **GREEN for existence, AMBER for authority, RED for construct answers**

| Measure | Result | Status |
|---|---|---|
| Five libraries (clean, layered, NestJS, hexagonal, DDD), with a priori tiers, hashed before any v1.3 measurement | exist, sealed (`rule-tiers.md`, `sealed-hashes.md`). Fixed after the Study 1 data | GREEN |
| Rules trace to the literature | some rows verbatim, others paraphrased or only partly supported. A supplement adds the missing rows. **No independent expert review** | AMBER |
| Construct questions (25) | proposed answers are written and adversarially reviewed (decision sheet, Notion). **Not yet confirmed by you** | RED until confirmed |
| Known rule defects | DDD has no cycle rule, so a real 3-file cycle goes unreported (N17). FF-CV03 matches "Repo" inside "Report" (N18). G6 fires on every clean layered and NestJS variant (N14). FF-S03 double counts FF-S01 (N20) | AMBER |

### SO2: the architectural property graph and its tooling. Overall: **GREEN core, AMBER beyond imports**

| Measure | Result | Status |
|---|---|---|
| Import graph vs the compiler | Jaccard 0.988 vs dependency-cruiser (E1) and 0.913 vs tsc (SO4 corpus). On the 15 external repos, the literal view matches tsc at 1.000 / 1.000 | GREEN |
| Engine independence | 73/73 files identical across Neo4j 5.26.24, 2025.12.1 and the in-process interpreter. Reference outputs are 71/71 byte-identical without Neo4j | GREEN |
| Edge fidelity, adjudicated | the edge rows are agent-proposed; **the human verdict column is empty** | AMBER |
| Silent gaps | `baseUrl` bare imports become external packages (N32). A `paths` alias was missed, so one verdict was computed on half its graph (N33) | AMBER |
| Beyond imports (type flow, APG v2) | FLOWS_TO has 0 edges on real code (N40). APG v2 catches 25/27 against a required 27/27 (N41). Developer behaviour gives it no support (N42) | AMBER, reframed |
| Scale | the blocking cycle rule FF-S02 did not finish on the 3 largest wild repos (N45) | AMBER |

### SO3: the neuro-symbolic gate. Overall: **AMBER for the judge, RED for the combination claim**

| Measure | Result | Status |
|---|---|---|
| Judge catch on seeded semantic defects (target ≥ 0.80) | 16/21 = 0.76 [0.55, 0.89], on the two operators with working twins (N63) | AMBER (dev) |
| Rules miss what the judge catches (complementarity b) | 22/26 = 0.85, but **8/12 = 0.67** on the fair cut without the confounded DUP-RULE seeds (N91) | AMBER (dev) |
| A model alone misses what rules catch (complementarity a) | weak and mixed. No experiment gives the same model the code with and without the graph | RED |
| Combination beats either alone (complementarity c) | the 31/35 union is arithmetic only. The cost (10/55 twin false fails, N72) is ignored | RED |
| Registered headline: judge vs cross-vendor panel | **n = 0** (N81) | RED |
| Judge improvements | v2.1 is not better (N73). v2.2 was rejected by its own rule (N77). Three-run unanimity doesn't predict correctness (N82) | RED (null) |
| Effect on verdicts | at its registered 8 % weight, the judge changed 0 of 65 E1 verdicts (N85) | RED (null) |
| Neural semantic layer (Ontology v0) | **mock-only**. The deterministic proxies catch 0/3 planted ontology defects (N100) | RED |

---

## B. Per link of the chain

The chain is code → graph → spec → rules → meaning, plus a neural link and a delivery link. Links 1–4 are the names the director deck and the Study 2 outline already use (`Docs/v1.3/study2-outline.md` §8). Links 5 and 6 are added here so that SO3 and the MCP arm have a place.

| Link | What it does | Objective | Target (where one exists) | Where it stands | Status |
|---|---|---|---|---|---|
| **1. Code → graph** | ts-morph builds the property graph | SO2 | adjudicated edge precision and recall ≥ 0.95; file-to-layer ≥ 0.95 | matches tsc 1.000 / 1.000 on 15 external repos; 57/60 external projects match (N31). **Not adjudicated by a human** | GREEN, formally AMBER |
| **2. Spec** | a human, or the inferrer, declares layers, contexts and the style | SO1 | spec-author κ ≥ 0.80 on 12 of 15 repos | κ 0.77, **4/15** (N01). Verdict κ 0.21 between two blind spec authors (N02). The style name alone gives κ 0.33 (N04). Mined specs fall to 24/52 plants (N07). Both spec authors were AI sessions | **RED for brownfield**. For greenfield Study 2 the spec is author-declared, so this matters less there |
| **3. Rules** | Cypher fitness functions over the graph | SO1 + SO2 | blocking recall ≥ 0.90 per style; precision (correct) ≥ 0.90 | author view 54/54. **Blind view 50/64 = 0.78**, with four styles below 0.90 (N105). Correct: 2,669/2,669 (dev) and 283/283 (external). Mutation kill 33 % → 60 % (N134). Convergent κ 0.91–1.00, but low per rule for FF-C04 and FF-S02 (N130) | GREEN for correctness, AMBER for recall |
| **4. Meaning** | is a correct finding architecturally meaningful? | (SO4 in the repo) | labeller κ ≥ 0.60; meaningful precision reported | **0 labels** (N114). Registered real-code precision in v1.2E was 0.328 (N115). 51 of 60 style-claiming human projects fail (N116), so either human code erodes or the rules are too strict, and we can't tell which yet | **RED** |
| **5. Neural** | the LLM judge, and the semantic layer that adds edges | SO3 | catch ≥ 0.80; panel agreement | see SO3 above | **RED for the claim**, AMBER for the judge |
| **6. Delivery** | MCP tools for the agent; the CI gate | (used by SO5) | `check_file`/`check_diff` match the full evaluation | without a project root, the fast path disagrees on 7/71 variants (N54). No blocking feedback at two loop-replay steps (N51). The lexical CI gate finds 50.9 % (N56); with Neo4j it is exact on 197/203 (N57) | AMBER |

**Reading the chain.** A chain is as strong as its weakest link. For **greenfield DDD and Layered**, which is your focus, the binding links are:
- **Link 4 (meaning)**, because Y counts blocking edges, and nobody has said a blocking edge matters;
- **Link 6 (delivery)**, because the MCP arm *is* the treatment.

Link 2 mostly drops out, because you declare the spec.

---

## C. Applied to a few projects

| Set | What it is | What the instrument showed | Trust |
|---|---|---|---|
| **Reference, 71 variants** | hand-built trees, 5 styles, planted violations | recall 54/54 (author view), 50/64 blind; 0 incorrect findings. Plants number 52 against a protocol floor of 20 per style (N112) | dev, tuned on it |
| **devset-b, 131 trees** | 84 violation, 37 look-alike, 10 clean | recall 109/116 literal, precision 109/115, look-alike false alarms 1/37 (`DR/v1.3-devset-b-2026-10-16.md`) | dev, Claude-written |
| **External, 15 human repos** | chosen before their specs were written | 283/283 blocking findings correct, Wilson [0.987, 1.000]. Clustered: 3 repos hold 214 of them. Verdicts depend on the spec author (N02) | **the best evidence we have** |
| **Wild, 14 TS backends** | inferred specs, no ground truth | convergent κ holds. FF-S02 times out on the 3 largest (N45). The style inferrer mislabels flagship DDD repos (N11) | descriptive |
| **Self-application** | the tool run on its own source | 10 false positives or traps in advisory rules (N59). Inference found no style (N12) | descriptive |
| **Loop replay, 10 scripted cases** | the agent loop without a live model | replays 10/10, but the fast MCP tools missed blocking feedback twice (N51) | harness check |

**What this view says.** On the few projects where we have truth, the instrument is *correct*. We have not yet shown that it is *complete* (blind recall 0.78) or *meaningful* (no labels), and every external figure rests on AI-written specs.

---

## What to do next, per objective

Ordered by what unblocks most. **Cost** is in model calls; "0" means zero model calls.

| # | Objective | Move | Cost | Owner |
|---|---|---|---|---|
| 1 | SO1 | Confirm the construct answers on the decision sheet (`decisions.md` D1) | 0 | you |
| 2 | SO3 | **Thinking note on Link 5:** each missed defect, the knowledge it needs, a framing, related work (IRIS, LLift), a pre-mortem. No runs | 0 | agent, then you read it |
| 3 | Link 4 | Settle how meaning gets labelled without paying (`decisions.md` D3): a free classmate rater, developer-acknowledged ground truth, or both | 0 until labelling starts | you |
| 4 | SO2 | Adjudicate the agent-proposed fidelity edge rows, or register Link 1 as "matched to tsc, not human-adjudicated" | your time, or 0 | you |
| 5 | SO1 | DDD cycle rule (N17): the tiers are sealed, so either register it as a limit or add a declared post-seal rule. **Not a silent fix** | 0 | you decide, agent writes it |
| 6 | SO3 | NS1–NS3, only after note #2: NS1 487 calls, NS2 415, NS3 about 312 (its six-case subset about 110) | about 800 + optional Gemini 330 | your OK per study |
| 7 | Link 6 | Make the MCP fast path match the full evaluation for DDD and Layered (N51, N54), because Study 2 depends on it | 0 | agent |

## Changelog
- 2026-10-18: first version.
