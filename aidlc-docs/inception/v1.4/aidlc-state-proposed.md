# PROPOSED replacement for `aidlc-docs/aidlc-state.md`

> **Status: proposal, 2026-10-18.** Not yet applied. The orchestrator applies it to `aidlc-docs/aidlc-state.md` and logs the change in `aidlc-docs/audit.md`. Everything below the line is the proposed file. The full v1.0 to v1.2E history stays readable in git and in `aidlc-docs/construction/`; this version keeps a one-line summary per cycle.

---

# AI-DLC State Tracking

## Project Information
- **Project Name**: Architectural Firewall (DaedalusArch)
- **Project Type**: Brownfield (greenfield at start, 2026-03-27; existing code since v1.0 Construction)
- **Start Date**: 2026-03-27T16:00:00Z
- **Current Stage**: v1.4 Instrument-Alignment cycle, INCEPTION, Units Generation complete; awaiting approval to enter CONSTRUCTION (2026-10-18)
- **Product Name**: Architectonic Firewall
- **CLI Name**: firewall

## Workspace State
- **Existing Code**: Yes, TypeScript under `src/`, scripts under `scripts/`, tests under `tests/`
- **Reverse Engineering Needed**: No (artifacts exist under `inception/reverse-engineering/`; `ops/01-instrument-map.md` is the current system description)
- **Workspace Root**: the repository root

## Extension Configuration
| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | Yes | Requirements Analysis (v1.2 Evaluation-Readiness, 2026-10-05, Q3-A); carried into v1.4 |

## Code Location Rules
- **Application Code**: workspace root (never in aidlc-docs/)
- **Documentation**: aidlc-docs/ only; plans, status and decisions for the thesis live in `ops/`

## Cycle History (closed)
- [x] **v1.0**: Inception and Construction complete (8 units U0 to U7; Build and Test 29 suites, 312 tests)
- [x] **v1.1**: complete, demo-ready (4 units; 43 suites, 421 tests)
- [x] **v1.2 (pending units / FR-16 graph export)**: **CLOSED, superseded.** Requirements Analysis was never approved; the entry gate is withdrawn
- [x] **v1.2E Evaluation-Readiness**: **CLOSED, superseded.** Code generation of all seven units merged (U0, U1, U2, U3, U4, U5a, U5b). Build and Test stopped at Step 49 with E-1 (SO4 floor, CAT_SHORTFALL) and E-2 (SEN-01 live judge calls) open. Frozen as **Study 1**. E-1 and E-2 are not resumed; the v1.3 validity work and the v1.4 build list replace them. Record: `construction/build-and-test/build-and-test-summary.md`
- [x] **v1.3 Validity**: **CLOSED, done outside AI-DLC.** Tool-validity work ran as night plans and PRs (`construction/plans/v1.3-night-2026-10-16-plan.md`); its Inception stages were not completed in this file. Its results are recorded in `Docs/v1.3/`, `Docs/DiagnosticRuns/` and the claims ledger, and summarised by part in `ops/01-instrument-map.md` §4

## v1.4 INSTRUMENT-ALIGNMENT CYCLE (started 2026-10-18)
- **Requirements sources**: `ops/01-instrument-map.md` (v3), `ops/03-build-list.md`, `ops/04-north-star.md`, `ops/decisions.md`
- **Depth**: minimal. **Artifacts**: `inception/v1.4/`
- **Standing rules**: no model or external API calls in construction (mock or dry-run only); `jest --maxWorkers=2`; never start Neo4j (in-process interpreter `src/cypher-interp`); max 2 build lanes; new behaviour off by default; each unit ends in an unmerged PR, and the author's PR review is the code-approval gate

### v1.4 INCEPTION PHASE
- [x] Workspace Detection (resume)
- [x] Reverse Engineering: SKIPPED (artifacts exist)
- [x] Requirements Analysis: minimal (`inception/v1.4/requirements.md`, FR-1 to FR-14, NFR-1 to NFR-6)
- [x] User Stories: SKIPPED (one persona, no workflow change)
- [x] Workflow Planning (`inception/v1.4/workflow-plan.md`)
- [x] Application Design: SKIPPED (design notes in `ops/notes/`)
- [x] Units Generation: minimal (`inception/v1.4/unit-of-work.md`, U1 to U8)
- [ ] Author approval of the v1.4 Inception artifacts

### v1.4 CONSTRUCTION PHASE
- [ ] Per-Unit Loop
  - [ ] U1: Extractor fixes N33 and N38 (C1a/b). In progress in its own PR
  - [ ] U2: DDD cycle rule (D5) and application purity Q26 (N3) (C2 declared)
    - [ ] Functional Design
    - [ ] Code Generation (unmerged PR)
  - [ ] U3: Semantic facts into A2, one-context fragmentation, Gemini route (mock), true K3 case-06 (C1d)
    - [ ] Functional Design
    - [ ] Code Generation (unmerged PR)
  - [ ] U4: Violation identity module (C1e) and drift metric D (C5)
    - [ ] Functional Design
    - [ ] Code Generation (unmerged PR)
  - [ ] U5: Evasion check (M6) and Gemini generator adapter (CDX), dry-run (C6)
    - [ ] Functional Design
    - [ ] Code Generation (unmerged PR)
  - [ ] U6: Recall-fix options and ADR drafts Q5 D, Q6 B, Q10 C + Q12 B (C3). Design only until the 9 rows are adjudicated
  - [ ] U7: Meaning analysis script, κ and meaningful precision (C3m)
    - [ ] Functional Design
    - [ ] Code Generation (unmerged PR)
  - [ ] U8: Efficiency harness, driver and scorer (C1c, M5)
    - [ ] Functional Design
    - [ ] Code Generation (unmerged PR)
- [ ] Build and Test (minimal; `--maxWorkers=2`; Neo4j-only tests skipped and listed)
- NFR Requirements, NFR Design, Infrastructure Design: SKIPPED for all units

### After v1.4 (tracked in `ops/03-build-list.md`, outside AI-DLC)
- [ ] Freeze
- [ ] Hold-out once (after F23)
- [ ] Meaning labels (after L4)
- [ ] C1d 2-case pilot (after NS01)
- [ ] Efficiency test (after the author's OK)
- [ ] Study 2, once

### Waiting on the author
- L4, D1 changes, F23, NS01, the 9 disagreement rows (C3)

### OPERATIONS PHASE
- [ ] Operations (PLACEHOLDER)
