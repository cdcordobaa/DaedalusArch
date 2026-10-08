# AI-DLC State Tracking

## Project Information
- **Project Name**: Architectural Firewall (DaedalusArch)
- **Project Type**: Greenfield
- **Start Date**: 2026-03-27T16:00:00Z
- **Current Stage**: v1.2 Evaluation-Readiness cycle — CONSTRUCTION — lane 3 Code Generation in progress: U5a merged at 23a2055 (PR #6, 2026-10-08); U3 merged at c4d7bc4 (PR #5, 2026-10-08); lane 2 COMPLETE (U2 merged at f7ae34b, PR #2; U1 merged at eee25fb, PR #3; U0 merged at 2050193; ADR-016 settlements 2026-10-08). Next: U4 code generation (hand-offs H8–H11 in `construction/v1.2E-u3-evaluation-scoring-report/code/handoffs.md`); then U5b (U5a hand-offs OI-U5a-5, 12, 16, 17 before U5b Code Generation); U5a Build and Test obligations and the DV-U5a-22 author decision in `construction/v1.2E-u5a-mutation-manifest-generator/code/code-summary.md`.
- **Product Name**: Architectonic Firewall
- **CLI Name**: firewall (unchanged from v1.0)

## Workspace State
- **Existing Code**: Yes — 106 TypeScript files under `src/` plus `tests/` (npm build). NOTE: originally recorded as No on 2026-03-27 when the workspace was empty; the project is brownfield in fact as of v1.0 Construction. Reverse Engineering remains SKIPPED (artifacts exist under `inception/reverse-engineering/`).
- **Reverse Engineering Needed**: No (greenfield project with comprehensive PRD + ADR)
- **Workspace Root**: /Volumes/Life-OS/Users/Arkatechie/Development/Archi-Firewall/DaedalusArch

## Pre-existing Artifacts
- **PRD**: `Docs/PRD — Architectural Firewall Spec-Driven Compliance.md` (13 segments, comprehensive)
- **ADR**: `Docs/ADR — Architectural Decision Records Firewall Tech.md` (14 ADRs, all Accepted)
- **Product Vision**: `Docs/Product Vision - Architectural Firewall` (post-thesis commercial vision)
- **Config Files**: `package.json` (name: "symphony" — legacy), `tsconfig.json`, `jest.config.cjs`

## Extension Configuration
| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | Yes | Requirements Analysis (v1.2 Evaluation-Readiness, 2026-10-05, Q3-A) |

## Code Location Rules
- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Stage Progress
### INCEPTION PHASE
- [x] Workspace Detection
- [ ] Reverse Engineering — SKIPPED (greenfield)
- [x] Requirements Analysis — COMPLETE (17 FR, 6 NFR, 3 METH, partial security)
- [x] User Stories — COMPLETE (81 stories, 3 personas, 17 epics)
- [x] Workflow Planning — COMPLETE (all stages execute, no skips)
- [x] Application Design — COMPLETE (11 components, 6 services, DDD hardening, VCR, concurrency governor)
- [x] Units Generation — COMPLETE (8 units: U0-U7, bottom-up, 81 stories mapped)

### CONSTRUCTION PHASE
- [ ] Per-Unit Loop
  - [x] U0 — Infrastructure Scaffolding (Code Generation COMPLETE)
  - [x] U1 — Shared Domain + Validation (Code Generation COMPLETE)
  - [x] U2 — APG Extractor (Functional Design + Code Generation COMPLETE)
  - [x] U3 — Spec Parser + Fitness Compiler (Functional Design + Code Generation COMPLETE)
  - [x] U4 — Neo4j + Persistence (Functional Design + Code Generation COMPLETE)
  - [x] U5 — Router + Evaluation Engine (Functional Design + Code Generation COMPLETE)
  - [x] U6 — Scoring + Reports (Functional Design + Code Generation COMPLETE)
  - [x] U7 — CLI + CI/CD (Functional Design + Code Generation COMPLETE)
- [x] Build and Test — COMPLETE (29 suites, 312 tests, 0 failures, 76% coverage)

### v1.1 INCEPTION PHASE
- [x] Requirements Analysis — COMPLETE (10 FRs: 4 Track A, 2 Track B, 3 Shared + FR-15 NEW)
- [x] User Stories — COMPLETE (18 stories, 3 epics: E-INIT, E-DASH, E-LLM)
- [x] Workflow Planning — COMPLETE (App Design + Units Gen EXECUTE, NFR/Infra SKIP, parallel worktrees at code gen)
- [x] Application Design — COMPLETE (C12 + C13 new, C3/C4/C7/C8/C9 extended, skill non-code)
- [x] Units Generation — COMPLETE (4 units: U0 Shared, U1 Track A, U2 Track B, U3 Gemini)

### v1.1 CONSTRUCTION PHASE
- [x] Per-Unit Loop — COMPLETE
  - [x] U0 — Shared Extensions (Functional Design + Code Generation COMPLETE — 33 suites, 341 tests, 0 failures)
  - [x] U1 — Track A Spec Generation (Functional Design + Code Generation COMPLETE — 38 suites, 376 tests, 0 failures)
  - [x] U2 — Track B Demo Dashboard (Functional Design + Code Generation COMPLETE — 42 suites, 413 tests at merge)
  - [x] U3 — Gemini Integration (Code Generation COMPLETE — 43 suites, 421 tests, 0 failures)
- [x] Build and Test — COMPLETE (43 suites, 421 tests, 0 failures, end-to-end validated against dev-nest)

### v1.1 POST-CONSTRUCTION FIXES
- [x] S-LLM-02 gap closed — dashboard now explicit about neuro-symbolic evaluation (5 new sections)
- [x] Scoring-engine warning-dropping defect fixed (pipeline warnings now flow to report)
- [x] Real-repo demo validation — dev-nest (NestJS, 260 APG nodes, 371 edges) — AHS 87.9%/89.0% symbolic/combined

### v1.1 STATUS
- **COMPLETE** — demo-ready, all scoped FRs + stories closed
- **Next**: v1.2 INCEPTION underway (see below)

### v1.2 INCEPTION PHASE
- **Scope draft**: `inception/plans/v1.2-pending-units-plan.md` (5 deferred FRs: FR-05, FR-08, FR-10, FR-11, FR-12) — DRAFT, not yet approved
- **New addition (this cycle)**: provisional **FR-16 — Graph JSON Export** (write APG to a flat JSON file). **Re-scoped to MINIMAL depth** — reuse existing `extractAPG` + snapshot-store serialization + `baseline`/`report` CLI pattern (~30 lines, no Neo4j/contract changes, additive & opt-in). NOT a from-scratch backend; FR-12 (in-memory backend) remains separate/deferred.
- **Entry gate (2026-09-07)**: User asked to start Inception from the v1.0 PRD. Reconciliation found that PRD already fully consumed by v1.0 Inception (17 FR / 81 stories / 8 units, all built) and by v1.1. Re-running Inception would overwrite approved artifacts, so it was NOT started. Four-question entry decision presented in `inception/requirements/v1.2-inception-entry-questions.md` (re-entry intent, PRD-vs-built delta scope, FR numbering namespace, security opt-in). GATE: awaiting user answers.
- **Known ID collision**: provisional "FR-16 Graph JSON Export" clashes with v1.0 FR-16 (Batch Runner). Resolution deferred to entry-gate Question 3.
- [ ] Requirements Analysis — **IN PROGRESS** (FR-16, Minimal depth) — minimal scope decision presented (`inception/requirements/v1.2-graph-export-verification-questions.md`): delivery surface + JSON shape. Recommended: new `firewall graph` command + single-file JSON. Security extension judged N/A (internal read-only export). GATE: awaiting user pick.
- [ ] User Stories
- [ ] Workflow Planning
- [ ] Application Design
- [ ] Units Generation

### OPERATIONS PHASE
- [ ] Operations (PLACEHOLDER)

### v1.2 EVALUATION-READINESS CYCLE (started 2026-10-05)
- **Source**: read-only audit of commit `7cd15b4` (Notion: "Evaluation readiness audit and data-generation plan (Chapters 7–9)", page 3f150d308227812c9073e29fb963892f) and the six design decisions the user took the same day (Package nodes + specifier/line on IMPORTS edges; renormalise weights over executed dimensions; optional line/target on violations; dataset 8–10 projects / 80–120 instances; author-only labelling; Anthropic provider via Claude-account OAuth profile, model `claude-opus-5-5`, cassettes committed).
- **Scope of this cycle**: WP0 (freeze the ground) + WP1 (engine fixes that precede any measurement). WP2–WP7 (golden dataset, matching scorer, ablation tooling, neural path, tag and run, analysis) are later cycles.
- [x] Workspace Detection (resume, 2026-10-05)
- [ ] Reverse Engineering — SKIPPED (artefacts exist)
- [x] Requirements Analysis — COMPLETE and APPROVED 2026-10-06 (Standard depth; 26 FR + 6 NFR after adding minimal proposal compliance FR-19..23 and experiment tooling FR-24..26 in `inception/requirements/v1.2-evaluation-readiness-requirements.md`; questions answered all-A)
- [x] User Stories — SKIPPED (one persona, no workflow change)
- [x] Workflow Planning — APPROVED 2026-10-06 after adversarial review (plan revision 2; review in `inception/plans/v1.2E-execution-plan-adversarial-review.md`)
- [x] Application Design — APPROVED 2026-10-07 (`inception/application-design/v1.2E-*.md`, 16 components, 3 new)
- [x] Units Generation — APPROVED 2026-10-07 (7 units: U0, U1, U2, U3, U4, U5a, U5b; lanes U0 | U1+U2 | U3+U4+U5a | U5b)
### v1.2E CONSTRUCTION PHASE
- [x] U0 Foundation — COMPLETE and merged 2026-10-07 (PR #1, 2050193) (code-summary in construction/v1.2E-u0-foundation/code/) (`construction/plans/v1.2E-u0-foundation-code-generation-plan.md`) (U0 Foundation; U1 Spec+compiler; U2 Extractor+graph; U3 Evaluation+scoring+report; U4 Neural path; U5 Experiment tooling)
- [x] Lane 2 Functional Design U1 Spec+compiler (BR-U1-01..46) + U2 Extractor+graph (BR-U2-01..47) — COMPLETE 2026-10-08, auto-approved under standing approval; settlements ADR-016; record `construction/plans/v1.2E-lane2-functional-design-clarifications.md`. Next: code-generation plans U2, then U1
- [x] U2 Extractor+graph — Code Generation COMPLETE and merged 2026-10-08 (PR #2, merge commit f7ae34b; 808 tests / 63 suites; golden 17/17 with snapshots unchanged at f5fed3f (G0); Gate G-CI run 37732537181 green) (code-summary in construction/v1.2E-u2-extractor-graph/code/) (`construction/plans/v1.2E-u2-extractor-graph-code-generation-plan.md`). Next: U1 rebases or merges onto this v1.2e
- [x] U1 Spec+compiler — Code Generation COMPLETE and merged 2026-10-08 (PR #3, merge commit eee25fb; 1277 tests / 94 suites; golden 38/38, 0 skipped; snapshots changed only in K2, K3, K4, K5, K6, K12, K13, each in tests/golden/CHANGES.md; PR CI run 37758444791 green incl. Golden regression suite and Golden change log; merge push run 37758784666 green) (code-summary in construction/v1.2E-u1-spec-compiler/code/) (`construction/plans/v1.2E-u1-spec-compiler-code-generation-plan.md`). Interim post-U1 AHS/verdicts: correct-reference 0.958 pass, variant-a 0.422 hard-block, variant-b 0.595 soft-block, variant-c 0.412 hard-block, variant-d 0.538 soft-block
- [x] Lane 2 (U1 + U2) — COMPLETE 2026-10-08. Next: lanes 3/4 code generation (U3, U4, U5a; then U5b)
- [x] U3 Evaluation+scoring+report — Code Generation COMPLETE and merged 2026-10-08 (PR #5, merge commit c4d7bc4; 1712 tests / 119 suites; golden 74/74, 0 skipped; snapshots changed only in U3-R2, R4, R5, R6, R7, R8, R9, each in tests/golden/CHANGES.md; PR CI run 37786297526 green incl. Golden change log; merge push run 37786728598 green; final AHS .958 / .442 / .575 / .391 / .558, verdicts pass / hard / soft / hard / soft) (code-summary and handoffs in construction/v1.2E-u3-evaluation-scoring-report/code/) (`construction/plans/v1.2E-u3-evaluation-scoring-report-code-generation-plan.md`). Open hand-offs: U4 (neural rows, JUDGE_NO_UNITS functionId, C9 hunks, U4-K5 router), U5a (discriminator enum, BR-U3-66 test), lane-2/lane-3 record owners, Build and Test; lane container daedalus-neo4j-u3 kept until the orchestrator's word
- [x] U5a Mutation+manifest+generator — Code Generation COMPLETE and merged 2026-10-08 (PR #6, merge commit 23a2055; 2155 tests / 152 suites (1712 + 443 U5a); golden 74/74, 0 skipped; no snapshot change, no CHANGES.md line; PR CI runs 37792356596 / 37792363516 green; merge push run 37793341718 green; v1.2e (U3) synced into the branch at 0748b83, DV-U5a-25) (code-summary in construction/v1.2E-u5a-mutation-manifest-generator/code/) (`construction/plans/v1.2E-u5a-mutation-manifest-generator-code-generation-plan.md`). Author decision open: DV-U5a-22 (BR-U5a-37 cap) at the freeze review. Open hand-offs: U5b OI-U5a-5, 12, 16, 17; lane-3 record owner OI-U5a-4, U3 H16 (b); Build and Test obligations 1–10; U3 handoffs H3/H4 closed by U5a (file update: orchestrator); lane container daedalus-neo4j-u5a and worktree kept until the orchestrator's word
- CONSTRUCTION: Functional Design EXECUTE U1–U5 / SKIP U0; NFR Requirements EXECUTE light (in U0); NFR Design, Infrastructure Design SKIP; Code Generation and Build and Test EXECUTE
