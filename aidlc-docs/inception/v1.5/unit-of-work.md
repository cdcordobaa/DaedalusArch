# v1.5 Semantic Instrument: Units of Work

**Inputs:** `workflow-plan.md` (seven units, semantic first), `application-design.md` (components S1–S5, EG, H3), `requirements.md`. **Decided:** 2026-10-22, under the author's standing delegation for gate-level calls. No decomposition question is open (the order and the code location were settled as Q1 = A and Q2 = A), so no `[Answer]:` plan was issued. The rule's dependency file and story map are folded in here; User Stories was skipped, so the map is to FRs.

Each unit is tested on its own first (`ops/04-north-star.md`, layer 1) and passes its gate before a later unit builds on it. A unit that calls a model has a thinking note and a call cap before its first call; the cap is never raised; every call is in a ledger and every answer in a cassette (NFR-2, NFR-3). Until a unit passes, its code lives under `experiments/` (Q2 = A).

## Units, in order

| Order | Unit | FRs | Inputs | Outputs | Own test (part, truth, metric) | Gate | Calls |
|---|---|---|---|---|---|---|---|
| 1 | **U3: S1 severity calibration** | FR-7 | C4 (`c4-v0.2`, frozen, read-only); the v1.4 six-case set; new severity pairs | Rubric prompt variant `experiments/v15-u3/`; new pairs with answers written first; ledger, cassettes; `Docs/DiagnosticRuns/v15-u3-severity-*.md` | **C4 Interpret**: cases and twins with answers written first; severity agreement, exception and intent accuracy, twin discrimination, stability, grounding, abstention | New set ≥ 5/6 cases and ≥ 5/6 twins correct, severity agreement ≥ 18/24 runs, 0 false claims on twins, 0 hallucinated citations; the original set does not regress (`ops/notes/v15-u3-severity-note.md` §8) | cap 60 |
| 2 | **U4: S3 facts and S2 confirmation** | FR-8, FR-9 | U3's calibrated C4; the 13 human DDD repositories (`ops/notes/detect-02-precision-note.md`); the D5 candidates and the precision fixtures (`experiments/detect-02/`) | Aggregate and ownership facts (A2 shape, cited); confirm or reject per candidate; DETECT-02 re-run with the facts | **C1d Enrich** (facts against declared specs) and **C3 Detect** (rules plus facts against the fixtures' truth) | S3: the false hits fall and the true hit stays on the human repos; S2: lift in precision or recall over the rules alone on the dev fixtures and their twins, with twins clean | cap set in its note (~70) |
| 3 | **U6: evaluation harness and puzzles** | FR-12, FR-13 | U3, U4 (the "both" arm); DETECT-02 rules; puzzles P1–P2 | Three-arm harness (symbolic, semantic, both); P3 restored, a cross-context puzzle, a harder Layered puzzle; answer keys that resist gaming | **Whole-instrument dev check** (SO3): per family recall, twin discrimination, false positives on legitimate patterns; `verify.ts` marks every puzzle VALID | All puzzles VALID; the comparison reports every family; "both" vs each arm reported as development evidence, not a claim | ~100 (comparison) |
| 4 | **U1: graph facts and rules into `src/`** | FR-1, FR-2, FR-3, FR-6 | `experiments/detect-02/` facts and rules; U4's facts contract | Extractor emits the DETECT-02 facts (write footprint, context ownership, port calls to adapters); R-D4 and R-XCTX in the catalogue with spec allowances; remaining families verified; the DA1 composition-root fix | **C1a/b fidelity** (hand-checked truth; tsc parity holds) and **C2/C3** (precision fixtures, trap trees) | 0 false positives on the precision fixtures; 19/19 trap trees; each other family passes its fixtures or is documented as left out; MCP check and scorer agree on every Q25 exempt file | 0 |
| 5 | **U2: delivery** | FR-4, FR-5, FR-11 | U1's rules; `ops/notes/v15-edit-gate-design.md`; U3's interpretation (S5 hints) | `check_consistency` and actionable messages in the real MCP server; the edit gate (PostToolUse and Stop hooks, relay, warm hub); grounded fix hints behind a flag | **C6 Control**: scripted tool calls with expected answers; the edit-gate smoke with zero calls; latency | Tool tests pass; under 200 ms per symbolic call; p95 under 2 s per edit; one puzzle pilot after the build (grounded vs templated hint) | 0 to build; pilot capped in its note |
| 6 | **U5: spec inference (BF-01 v3)** | FR-10 | U1's compiler path; U3's interpretation; ISE majority and outlier signals (`src/ise/`) | Infer → compile → run → interpret → refine; inferred spec with provenance per rule | **C2 derived**: the hidden-spec test on seeds and puzzles with planted debt; the declared spec is the truth | The inferred spec recovers the declared one **and** flags the planted debt rather than absorbing it | ~40 |
| 7 | **U7: release v1.5 and the final-study design draft** | FR-14 (and Q6) | Every unit passed; the v1.4 protection list | Version bump, changelog, tag `v1.5`; the final-study design draft (spec × tool, Layered and DDD, > 4 tasks, the chosen delivery mode, D_sem, a second vendor) | **Release check**: CI hash gate green; the v1.4 tag and the 2b artefacts unchanged | Tag pushed; hash gate green; the draft is not registered until v1.5 is trusted | 0 |

## Dependencies

| Unit | Depends on | Why |
|---|---|---|
| U3 | none | first unit; C4 as frozen in v1.4 |
| U4 | U3 | S2 uses the calibrated C4 |
| U6 | U3, U4 | the "both" arm uses them |
| U1 | U4 (facts contract) | the extractor's new facts follow the shape U4 settles |
| U2 | U1; U3 (for S5) | the edit gate runs U1's rules; hints use C4's reading |
| U5 | U1, U3 | the compiler path and the interpretation feedback |
| U7 | all | the release comes last |

```text
U3 --> U4 --> U6
 |      |
 |      +--> U1 --> U2
 |            |
 +------------+--> U5
                      all --> U7
```

Text alternative: U3 comes first; U4 depends on U3; U6 on U3 and U4; U1 on U4; U2 on U1 (and U3 for hints); U5 on U1 and U3; U7 on all.

## FR coverage

FR-1, 2, 3, 6 → U1. FR-4, 5, 11 → U2. FR-7 → U3. FR-8, 9 → U4. FR-10 → U5. FR-12, 13 → U6. FR-14 → U7. Every FR has one unit; NFR-1 to NFR-5 apply to every unit and are checked in each unit's code-generation plan.

## Per-unit stages (from `workflow-plan.md`)

Functional Design runs for U3, U4 and U5 (new logic); for U3 the thinking note (`ops/notes/v15-u3-severity-note.md`) is that design. The other units use their existing design notes. Code Generation runs per unit; Build and Test after all units.

## Changelog
- 2026-10-22: v1.
