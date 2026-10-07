# AI-DLC State Tracking

## Project Information
- **Project Name**: Architectural Firewall (DaedalusArch)
- **Project Type**: Greenfield
- **Start Date**: 2026-03-27T16:00:00Z
- **Current Stage**: v1.2 Evaluation-Readiness cycle — CONSTRUCTION — U0 COMPLETE (merged into v1.2e at 2050193); next: Functional Design U1 + U2.
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
- CONSTRUCTION: Functional Design EXECUTE U1–U5 / SKIP U0; NFR Requirements EXECUTE light (in U0); NFR Design, Infrastructure Design SKIP; Code Generation and Build and Test EXECUTE
