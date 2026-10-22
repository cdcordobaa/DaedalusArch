# v1.5 Semantic Instrument: workflow plan

**Inputs:** `requirements.md` (14 FR, 5 NFR, settled scope), `ops/notes/v15-plan.md` and `ops/notes/v15-semantic-programme.md`. **Decided:** 2026-10-22, by the coordinator under the author's standing delegation for gate-level calls.

## Stages

| Stage | Decision | Why |
|---|---|---|
| User Stories | **SKIP** | A research instrument with one user role (the agent or researcher); the FRs carry the "done when" |
| Application Design | **EXECUTE, minimal** | New components: the semantic roles S1–S5, the edit gate, and the spec-inference pipeline. Their contracts with existing parts (C1d, C4, the MCP server, the fitness compiler) need one page |
| Units Generation | **EXECUTE** | Seven units, below |
| Functional Design | per unit, **EXECUTE** for U3, U4 and U5 (new logic); **SKIP** for the others, where the design notes already exist |
| NFR Requirements and NFR Design | **SKIP as stages** | NFR-1 to NFR-5 apply to every unit and are checked in each unit's code-generation plan |
| Infrastructure Design | **SKIP** | No new infrastructure |
| Code Generation | **EXECUTE** per unit | — |
| Build and Test | **EXECUTE** | — |

## Units, in order

The order is semantic first (Q1 = A). Every unit that calls a model gets a thinking note first (scenarios, edge cases, predicted result, failure criteria) and a call cap that is never raised.

| Order | Unit | FRs | Model calls | Where |
|---|---|---|---|---|
| 1 | **U3: S1 severity calibration.** Severity rubric, six-case set plus new cases | FR-7 | about 40, pilot | cloud credits |
| 2 | **U4: S3 facts and S2 confirmation.** Aggregate and ownership facts on the 13 human DDD repositories; confirmation of the D5 candidates and the precision fixtures | FR-8, FR-9 | about 70, pilots | cloud credits |
| 3 | **U6: evaluation harness and puzzles.** The three-arm comparison (symbolic, semantic, both) on development material; restored and new puzzles; answer keys that resist gaming | FR-12, FR-13 | about 100 (comparison) | local or cloud |
| 4 | **U1: graph facts and rules into `src/`.** DETECT-02 facts in the extractor, R-D4 and R-XCTX in the catalogue, the remaining families verified, the DA1 fix | FR-1, FR-2, FR-3, FR-6 | 0 | local |
| 5 | **U2: delivery.** `check_consistency` and actionable messages in the real MCP server, the edit gate, grounded fix hints | FR-4, FR-5, FR-11 | 0 to build; one puzzle pilot after the build | local, then cloud |
| 6 | **U5: spec inference (BF-01 v3).** Infer, compile, run, interpret, refine; the hidden-spec test | FR-10 | about 40, pilot | cloud credits |
| 7 | **U7: release v1.5 and the final-study design draft** | FR-14 (and Q6) | 0 | local |

**Dependencies:**
- U4 uses U3's calibrated C4.
- U6's "both" arm uses U3 and U4.
- U2's edit gate uses U1's rules.
- U5 uses U1's compiler path and U3's interpretation.
- U7 comes last.

**Gates between units:**
- Each unit passes its own test (`ops/04-north-star.md`) before the next unit builds on it.
- A failed pilot gets a note on why, and one fix, before anything reuses it.

**Budget:** the weekly subscription usage is low until the Friday reset. Before then, only the cloud-credit pilots (U3, then U4) and zero-call work run.

## Changelog
- 2026-10-22: v1.
