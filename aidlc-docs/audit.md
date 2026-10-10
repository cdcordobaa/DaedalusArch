# AI-DLC Audit Log

---

## v1.1 — Closure Reconciliation
**Timestamp**: 2026-04-20T00:00:00Z
**User Input**: "Review and make sure what is done gets closed, what is added gets synced with specs and we get to a clean point."
**AI Response**: Reconciled state vs reality. Updated aidlc-state.md to close U2, U3, and Build & Test (previously stale — these were merged days ago). Added 4 new stories (S-DASH-06..09) to v1.1-stories.md covering the post-merge dashboard clarity additions (How-It-Works panel, Symbolic vs Combined comparison, Pipeline Trace, LLM Failure Transparency). S-LLM-02 noted as "originally scoped, skipped in U2, implemented post-merge." Extended v1.1-requirements-scoped.md with Post-Merge Amendments section documenting: (1) FR-15 scope extension for neuro-symbolic explicitness, (2) scoring-engine warning-dropping defect fixed, (3) S-LLM-02 silent skip during autonomous U2 run, (4) process note for v1.2 on autonomous-mode gate enforcement. Status: v1.1 COMPLETE and demo-ready.
**Context**: v1.1 COMPLETE. 22 stories total (was 18), 43 test suites, 421 tests, 0 failures. End-to-end validated against dev-nest (real NestJS repo) with working Gemini API key.

---

## v1.1 Construction — U1 Track A Code Generation — COMPLETE
**Timestamp**: 2026-04-15T12:00:00Z
**User Input**: "Start v1.1 U1 construction"
**AI Response**: Executed full U1 construction in autonomous mode (Functional Design auto-approved + Code Generation). Created 12 new files, modified 4 existing files. All 376 tests pass (38 suites), TypeScript type-check clean.
**Context**: v1.1 Construction Phase — U1 Track A Spec Generation & Baseline — COMPLETE

### Files Created:
- `presets/clean-architecture.yaml` — Clean architecture preset (26 fitness functions, 3 layers)
- `presets/nestjs.yaml` — NestJS preset (26 fitness functions, 4 layers incl. presentation)
- `src/spec-parser/preset-loader.ts` — loadPreset(), mergeSpecs(), listPresets()
- `src/baseline/baseline-manager.ts` — Full C12 component (create, load, save, compare, generateKey)
- `src/baseline/index.ts` — Barrel exports
- `src/pipeline/commands/validate-spec-command.ts` — ValidateSpecCommand
- `src/pipeline/commands/create-baseline-command.ts` — CreateBaselineCommand
- `src/pipeline/commands/compare-baseline-command.ts` — CompareBaselineCommand
- `.claude/commands/firewall-init.md` — Skill prompt with APG mining queries
- `tests/unit/spec-parser/preset-loader.test.ts` — 9 tests
- `tests/unit/baseline/baseline-manager.test.ts` — 16 tests
- `tests/unit/pipeline/validate-spec-command.test.ts` — 2 tests
- `tests/unit/pipeline/baseline-commands.test.ts` — 3 tests
- `tests/unit/cli/validate-baseline-cli.test.ts` — 5 tests

### Files Modified:
- `src/spec-parser/index.ts` — Added exports for preset-loader and validateSpecAgainstProject
- `src/pipeline/commands/index.ts` — Added exports for 3 new commands
- `src/cli/cli.ts` — Added validate, baseline commands + --baseline flag on evaluate

### Stories Implemented:
- S-INIT-01: Skill-driven spec generation (skill prompt)
- S-INIT-02: Framework detection and preset selection (preset-loader)
- S-INIT-03: Preset template library (presets/)
- S-INIT-06: Spec validation (validate CLI command + ValidateSpecCommand)
- S-INIT-07: Baseline snapshot creation (baseline-manager + CLI)
- S-INIT-08: Baseline integration in skill flow (skill prompt includes baseline step)
- S-INIT-09: First evaluation in skill flow (skill prompt includes evaluate step)
- S-INIT-10: APG mining queries (embedded in skill prompt)

### Test Results:
- 38 suites, 376 tests, 0 failures (v1.0: 33 suites, 341 tests — all still passing)
- TypeScript: 0 type errors

---

## Construction — Unit 1 Functional Design — APPROVED
**Timestamp**: 2026-03-29T01:15:00Z
**User Input**: "User agreed to proceed with code generation."
**AI Response**: Added 12 new functions (FF-S03/S04, FF-P05, FF-C04/C05/C06, FF-SO03, FF-CV02-06) on top of 12 spike-validated ones. Full template: 24 symbolic + 2 neuronal = 26 functions total. Updated clean-arch.yaml with full set, validation status markers. Functional Design approved. Proceeding directly to Code Generation Part 1 (plan).
**Context**: Construction Phase — Unit 1 Functional Design COMPLETE, Code Generation starting

---

## Construction — Unit 1 Functional Design — Spike Corrections
**Timestamp**: 2026-03-29T01:05:00Z
**User Input**: "User chose option A and requested to test later due to time constraints."
**AI Response**: Applying corrections from spike analysis: (1) weights updated to empirically validated values from spike (structural 0.35, pattern 0.30), (2) verdict thresholds corrected (pass≥0.80, not 0.90 — clean reference scored 0.85), (3) fixtures replaced with spike's 5 ground-truth projects, (4) specs/clean-arch.yaml seeded from spike's validated spec.
**Context**: Construction Phase — Unit 1 Functional Design (corrections applied, re-presenting for approval)

---

## Construction — Unit 1 Functional Design — Complete
**Timestamp**: 2026-03-29T00:55:00Z
**AI Response**: Generated 3 functional design artifacts: domain-entities.md (all types, enums, value objects, interfaces, FirewallContext C11 with typed setters + set-once invariant, EvaluationReport contract), business-logic-model.md (DomainResult pattern, FirewallContext lifecycle, pipeline stage contracts, scoring formula AVR/AHS, fixture design), business-rules.md (12-type violation taxonomy, 17+3 fitness functions, weight constraints, spec versioning, layer annotation priority). Awaiting user approval.
**Context**: Construction Phase — Unit 1 Functional Design (all steps [x])

---

## Construction — Unit 1 Functional Design — Answers
**Timestamp**: 2026-03-29T00:45:00Z
**User Input**: "User provided explicit answers to design questions, selecting A for Q2, confirming 17 symbolic functions for Q3, and choosing DDD-like approach for Q4."
**AI Response**: Q1: Taxonomy confirmed (12 types). Q2: A — minimal fixtures (~5-8 files). Q3: 17 symbolic + 3 neuronal confirmed as starter set; note to revisit after first real project run. Q4: C — typed setters on FirewallContext class (DDD-like). Proceeding to generate functional design artifacts.
**Context**: Construction Phase — Unit 1 Functional Design (Q&A complete, generating artifacts)

---

## Construction — Unit 1 Functional Design — Questions
**Timestamp**: 2026-03-29T00:38:00Z
**AI Response**: Created unit-1-shared-domain-functional-design-plan.md with 4 targeted questions: Q1 violation taxonomy (proposed 12 types across 7 dimensions), Q2 fixture complexity (A/B/C options), Q3 clean-architecture template fitness functions (proposed 17 symbolic + 3 neuronal), Q4 FirewallContext mutability strategy (A/B/C options). Awaiting user answers.
**Context**: Construction Phase — Unit 1 Functional Design (Steps 1-4 complete, awaiting Q&A)

---

## Construction — Unit 0 Approval + Unit 1 Start
**Timestamp**: 2026-03-29T00:35:00Z
**User Input**: "User requested to proceed to the next unit."
**AI Response**: U0 approved. Proceeding to Unit 1 (Shared Domain + Validation). Starting per-unit loop: Functional Design (EXECUTE — new data models + value objects + violation taxonomy), NFR Requirements (SKIP — pure type layer), Infrastructure Design (SKIP — no infra), Code Generation (ALWAYS).
**Context**: Construction Phase — Unit 1 loop start

---

## Construction — Unit 0 Code Generation COMPLETE
**Timestamp**: 2026-03-29T00:30:00Z
**AI Response**: All 12 steps executed and verified. npm install: 726 packages, 0 vulnerabilities. npm test: exit 0, passWithNoTests. Fixed jest.config.cjs: coverageThresholds→coverageThreshold, testMatch globs, --passWithNoTests flag added to scripts.
**Context**: Construction Phase — Unit 0 Code Generation (Part 2 complete, all steps [x])

---

## Construction — Unit 0 Code Generation Start
**Timestamp**: 2026-03-29T00:00:00Z
**User Input**: "User requested to continue code generation for Unit 0."
**AI Response**: Resuming from approved unit-0-infrastructure-code-generation-plan.md. All 12 steps pending. Executing Part 2 — Generation now. Steps: package.json, tsconfig.json, jest.config.cjs, docker-compose.yml, .env.example, 11 module stubs, ESLint+Prettier, .gitignore update, tests/ structure, fixtures/ and specs/ dirs, .github/ CI scaffolding, and npm install + test verification.
**Context**: Construction Phase — Unit 0 Code Generation (Part 2 start)

---

## Workspace Detection
**Timestamp**: 2026-03-27T16:00:00Z
**User Input**: "User provided the path to existing PRD and ADR documents."
**AI Response**: Initiated workspace detection. Scanned workspace root — found configuration files (package.json, tsconfig.json, jest.config.cjs) but no source code (no src/ directory, no .ts files). Identified three documents in Docs/: PRD (13 segments), ADR (14 records), Product Vision. Classified as greenfield project. Previous aidlc-docs/inception/reverse-engineering artifacts exist from an earlier session but are stale (they analyzed the config-only workspace).
**Context**: Workspace Detection — Step 2 (Scan Workspace)

---

## Workspace Detection — Completion
**Timestamp**: 2026-03-27T16:00:05Z
**AI Response**: Workspace Detection complete. Project classified as Greenfield. No source code found. Comprehensive PRD + ADR provided by user. Proceeding to Requirements Analysis.
**Context**: Workspace Detection — Step 5 (Present Completion) + Step 6 (Auto-Proceed)

---

## Requirements Analysis — Start
**Timestamp**: 2026-03-27T16:00:10Z
**User Input**: "User approved to proceed with requirements analysis."
**AI Response**: Beginning Requirements Analysis. Loading PRD, ADR, and Product Vision documents. Depth assessment: PRD is exceptionally detailed (13 segments covering JTBD, mission, ICP, value prop, use cases, design principles, user journey, MoSCoW scope, functional spec, metrics, evaluation plan, risks, delivery plan). ADR covers 14 technical decisions all accepted and spike-validated. Assessing whether clarifying questions are needed.
**Context**: Requirements Analysis — Step 2 (Analyze User Request)

---
## Requirements Analysis — Questions Generated
**Timestamp**: 2026-03-27T16:05:00Z
**AI Response**: Created requirement-verification-questions.md with 8 questions covering: build scope, config files, project structure, Neo4j setup, spike code availability, ground truth scope, CLI framework, security extensions.
**Context**: Requirements Analysis — Step 6 (Generate Clarifying Questions)

---

## Requirements Analysis — User Answers Received
**Timestamp**: 2026-03-27T16:15:00Z
**User Input**: Answered all 8 questions:
- Q1: B — v1.0 Must-Have + some Should-Have (JSON Schema validation). Rationale: robustness for research.
- Q2: A — Start fresh. Rationale: "symphony" config is unrelated.
- Q3: B — Granular 6-module structure. Rationale: aligns with PRD Segment 9.
- Q4: B — Docker Compose for Neo4j. Rationale: reproducibility for research.
- Q5: C — Spike code exists, rewrite cleanly. Rationale: clean thesis artifact.
- Q6: C — Starter set 5-10 projects. Rationale: essential for Phase 1 validation.
- Q7: A — Commander.js. Rationale: standard and robust.
- Q8: X — Bare minimum security (SECURITY-05, 10, 12, 15 only). Rationale: CLI tool, not web service.
**AI Response**: No contradictions detected. All answers clear and consistent.
**Context**: Requirements Analysis — Step 6 Gate passed

---

## Requirements Analysis — BDD/TDD/DDD Request
**Timestamp**: 2026-03-27T16:20:00Z
**User Input**: "User requested to enforce BDD, TDD, and DDD methodologies."
**AI Response**: Incorporated BDD (Gherkin + jest-cucumber), TDD (Red-Green-Refactor, tests first), and DDD (bounded contexts per module, ubiquitous language, value objects, anti-corruption layers) as mandatory development methodology requirements (METH-01, METH-02, METH-03) in requirements.md.
**Context**: Requirements Analysis — Step 7 (Generate Requirements Document)

---

## Requirements Analysis — Completion (initial)
**Timestamp**: 2026-03-27T16:25:00Z
**AI Response**: Generated initial requirements.md. Presenting for user review.
**Context**: Requirements Analysis — Step 9 (Log and Proceed)

---

## Requirements Analysis — Critical Reframe
**Timestamp**: 2026-03-27T16:30:00Z
**User Input**: "There is something we are not capturing. Okay this project is meant to be an usable product not only to perform and validate a hypothesis that should be, if performed, on a separate or a parallel call. Here we are building a tool that any team, any person, could plug into their development cycle. That tool should be triggered automatically on pull request creation or triggered by some kind of command. Also I would prefer to delete the "thesis" term since this is not a thesis; this is a product."
**AI Response**: Critical reframe applied. Key changes:
1. Removed all "thesis" terminology — this is a product
2. Added FR-08 (CI/CD Integration): GitHub Action triggered on PR creation, posts AHS + violations as PR comment, sets check status, configurable threshold for blocking PRs, manual trigger via `/firewall` command
3. Moved hypothesis validation (H1-H4, 3×3 factorial, ANOVA) to "Out of Scope — Separate Efforts"
4. Added NFR-06 (Developer Experience): install-to-first-eval < 5 minutes, actionable error messages, scannable PR comments
5. Reframed ICP from "researchers" to "any development team"
6. Added `.github/actions/firewall/` and `.github/workflows/ci.yml` to project structure
7. Updated acceptance criteria to include GitHub Action PR flow
8. Removed ADR-011 (experimental design) from scope
9. Renamed "Ground Truth" to "Sample Projects + Validation Set" (FR-10)
**Context**: Requirements Analysis — Major scope and identity correction

---

## Requirements Analysis — Neuro-Symbolic Routing Addition
**Timestamp**: 2026-03-27T16:40:00Z
**User Input**: "User provided additional requirements in a separate document for neuro-symbolic routing."
**AI Response**: Integrated neuro-symbolic routing criteria from ad-hoc requirements document. Key additions:
1. Added FR-05 (Neuro-Symbolic Router): routes each fitness function to symbolic, neural, or hybrid path based on dimension type
2. Added FR-07 (LLM Critic Agent): neural evaluation path for semantic, intent, and soft-SOLID violations
3. Expanded fitness functions from 5 to 7 dimensions: added Semantic (abstraction-quality, naming-coherence) and Intent (ADR-prose-compliance, framework-agnosticism)
4. Updated NFR-01 from "Determinism absolute" to "Dual-Path Model" — symbolic path remains fully deterministic, neural path acknowledged as non-deterministic with transparency tagging
5. Added `--symbolic-only` flag for governance mode (full determinism guarantee)
6. Updated scoring weights to cover 7 dimensions
7. Added `llm-critic/` and `neuro-symbolic-router/` to project structure (now 8 modules)
8. Added 4 new acceptance criteria for neuro-symbolic behavior
9. Updated DDD bounded contexts to include Router and LLM Critic
**Context**: Requirements Analysis — Scope expansion (neuro-symbolic routing)

---

## Requirements Analysis — Format Correction
**Timestamp**: 2026-03-27T16:50:00Z
**User Input**: "User requested to keep the original AI-DLC requirements format instead of adopting the reference document's structure."
**AI Response**: Restored original AI-DLC requirements framework (FR-01 through FR-16, NFR-01 through NFR-06, METH-01 through METH-03). Used the ad-hoc SO1-SO4 document as INPUT to enrich requirements, not as the document format. Key requirements absorbed from the reference:
- FR-04 (ADR Parsing): multi-format ADR support (MADR, Nygard, Y-Statements)
- FR-05 (Violation Taxonomy): consolidated from OX Security, Slater, Sobania, GIST Study
- FR-03.6 (semantic_criteria schema): rule + adr_ref + rubric (pass/fail/evidence_required)
- FR-09.1 (LLM Critic context assembly): code snippet + APG subgraph + rule + rubric + optional ADR prose
- FR-09.6-9.7 (reproducibility): 3-5 runs per evaluation, ICC > 0.70
- FR-10 (Verdict Merge Logic): hard block / soft block / warning / pass with confidence thresholds
- FR-11.5 (dual scoring): ahs_deterministic vs ahs_combined
- FR-02.6-2.7 (delta APG + drift detection): versioned snapshots, architectural drift tracking
- NFR-02 updated: < 30 seconds full neuro-symbolic, < 2 seconds delta APG
- Reference document preserved at its original path for traceability
**Context**: Requirements Analysis — Format correction, kept AI-DLC framework

---

---

## Requirements Review — Comparison against ADR and PRD
**Timestamp**: 2026-03-27T19:25:00Z
**User Input**: "User requested a comparative review between the AdHoc System Requirements, ADR, and PRD documents to identify missing definitions."
**AI Response**: Identified missing definitions (Success Metrics, Universal Health Metrics, APG Schema, CLI details, Scoring Weights) and a critical contradiction between AdHoc (Persistence/Delta) and ADR-010 (Stateless). Created comparison artifact.
**Context**: Requirements Analysis — Periodic review and gap analysis

---

## Requirements Analysis — Snapshots, Drift, and Operational Efficiency
**Timestamp**: 2026-03-27T19:45:00Z
**User Input**: "User requested the addition of architectural snapshots, drift detection, and operational efficiency requirements."
**AI Response**: Expanded FR-02.6/FR-02.7 (one-liners) into a full FR-03 (APG Persistence, Snapshots, and Drift Detection) with 6 sub-requirements: no full APG regeneration (FR-03.1), delta APG operational efficiency (FR-03.2), snapshot storage model with APG_Store directory structure (FR-03.3), architectural drift detection table covering structural/coupling/convention/violation trends (FR-03.4), drift reports between snapshots (FR-03.5), CI/CD drift threshold alerts (FR-03.6). Renumbered all subsequent FRs from FR-04 through FR-17 (previously FR-03 through FR-16) and fixed all internal cross-references.
**Context**: Requirements Analysis — Scope expansion (persistence, drift detection, operational efficiency)

---

---

## Requirements Analysis — Approval
**Timestamp**: 2026-03-28T00:30:00Z
**User Input**: "User approved the requirements and requested to proceed."
**AI Response**: Requirements approved. Proceeding to User Stories assessment, then Workflow Planning.
**Context**: Requirements Analysis — Step 9 (Approval Gate passed)

---

## Units Generation — Approval
**Timestamp**: 2026-03-29T00:00:00Z
**User Input**: "User approved the current stage and requested to proceed."
**AI Response**: Units Generation approved. INCEPTION PHASE COMPLETE. Proceeding to CONSTRUCTION PHASE, starting with Unit 0 (Infrastructure Scaffolding).
**Context**: Units Generation — Approval Gate passed. Transitioning to CONSTRUCTION PHASE.

---

## Units Generation — Artifacts Generated
**Timestamp**: 2026-03-28T01:30:00Z
**User Input**: "User approved the current stage and requested to proceed."
**AI Response**: Plan approved. Generated 3 unit artifacts: unit-of-work.md (8 units: U0 Infrastructure, U1 Shared Domain + Validation, U2 APG Extractor, U3 Spec+Compiler, U4 Neo4j+Persistence, U5 Router+Eval, U6 Scoring+Reports, U7 CLI+CI/CD), unit-of-work-dependency.md (dependency matrix, critical path, integration test points), unit-of-work-story-map.md (all 81 stories mapped to units, coverage verified). Build order: bottom-up with infrastructure first, validation set as golden test data, U2||U3 parallelizable.
**Context**: Units Generation — Part 2 (Steps 5-7 complete), awaiting final approval

---

## Units Generation — Plan with Questions
**Timestamp**: 2026-03-28T01:15:00Z
**AI Response**: Created unit-of-work-plan.md with 4 questions covering: component grouping strategy, build order, infrastructure unit placement, and validation set handling.
**Context**: Units Generation — Part 1 Steps 1-3 (Plan creation)

---

## Application Design — Approval
**Timestamp**: 2026-03-28T01:10:00Z
**User Input**: "User provided intent: aprove"
**AI Response**: Application Design approved. User enriched the design with: FirewallContext aggregate root (C11), DI/IoC strategy, DomainResult<T> universal result model, Concurrency Governor for LLM throttling, VCR/Cassette pattern for deterministic neuronal testing, spec schema versioning. All additions integrated into the design artifacts.
**Context**: Application Design — Approval Gate passed. Proceeding to Units Generation.

---

## Application Design — Ablation Mode Addition
**Timestamp**: 2026-03-28T01:00:00Z
**User Input**: "User requested to integrate ablation modes and ground truth validation into the product design instead of as separate research efforts."
**AI Response**: Added `--neuronal-only` mode to FR-08 (FR-08.6, FR-08.7), FR-12 (FR-12.8), FR-14 (CLI flag). Updated Out of Scope: ablation moved from "separate research effort" to built-in capability. Updated design artifacts: Router (C5), Scoring Engine (C8), CLI (C9), EvaluationMode type, and application-design.md execution modes.
**Context**: Application Design — Scope correction (ablation is a product feature, not research)

---

## Application Design — Artifacts Generated
**Timestamp**: 2026-03-28T00:45:00Z
**User Input**: "User provided intent: continue"
**AI Response**: All 6 answers clear, no ambiguities. Generated 5 design artifacts: components.md (10 components: C1-C10), component-methods.md (method signatures with typed I/O), services.md (6 services: PipelineExecutor, GraphRepository, SnapshotService, LLMProviderService, AuditLogService, ReportService), component-dependency.md (dependency matrix, data flow diagram, ACLs, external deps), application-design.md (consolidated). Key design: typed pipeline + command pattern orchestration, connection pool, Neo4j+filesystem snapshots, strategy pattern for LLM, fail-fast/accumulate error handling.
**Context**: Application Design — Steps 3-4 complete, awaiting approval

---

## Application Design — Plan with Questions
**Timestamp**: 2026-03-28T00:30:00Z
**AI Response**: Created application-design-plan.md with 6 questions covering: pipeline communication pattern, orchestration approach, Neo4j connection management, APG snapshot storage, LLM provider abstraction, and error propagation strategy.
**Context**: Application Design — Steps 1-2 (Context analysis + plan creation)

---

## Workflow Planning — Approval
**Timestamp**: 2026-03-28T00:25:00Z
**User Input**: "User approved the current stage and requested to proceed."
**AI Response**: Execution plan approved. Proceeding to Application Design.
**Context**: Workflow Planning — Approval Gate passed

---

## Workflow Planning — Execution Plan Created
**Timestamp**: 2026-03-28T00:20:00Z
**AI Response**: Created execution plan. All remaining stages recommended for execution (no skips). Greenfield complexity justifies full treatment: Application Design (8 bounded contexts need component design), Units Generation (dependency sequencing), full Construction per-unit loop (Functional Design, NFR Requirements, NFR Design, Infrastructure Design, Code Generation), Build and Test. Risk: Medium-High. No rollback risk (greenfield).
**Context**: Workflow Planning — Steps 1-8 complete, awaiting user approval

---

## User Stories — Approval
**Timestamp**: 2026-03-28T00:10:00Z
**User Input**: "User approved the current stage and requested to proceed."
**AI Response**: User stories approved. Proceeding to Workflow Planning.
**Context**: User Stories — Step 10 (Approval Gate passed)

---

## User Stories — Generation Complete
**Timestamp**: 2026-03-28T01:00:00Z
**AI Response**: Generated 81 user stories across 17 epics + 6 NFR stories. 3 personas defined (Developer/Dana, Architect/Alex, Team Lead/Taylor). All stories have Gherkin Given/When/Then acceptance criteria, MoSCoW priority tags, persona assignments, and FR/NFR traceability. Breakdown: 70 Must, 10 Should, 0 Could. INVEST criteria verified. Awaiting user approval.
**Context**: User Stories — Part 2 Generation (Steps 5-9 complete)

---

## User Stories — Plan Approval
**Timestamp**: 2026-03-28T00:45:00Z
**User Input**: "User provided intent: Aprove"
**AI Response**: Plan approved. No contradictions or ambiguities in answers. Proceeding to Part 2 — Generation (personas.md and stories.md).
**Context**: User Stories — Step 4 (Plan Approval Gate passed)

---

## User Stories — Assessment and Plan
**Timestamp**: 2026-03-28T00:35:00Z
**AI Response**: User Stories assessment performed — all 5 high-priority indicators met (new user-facing features, multiple personas, complex requirements, user workflow impact, customer-facing CLI/Action). Created user-stories-assessment.md and story-generation-plan.md with 7 questions covering personas, breakdown approach, granularity, acceptance criteria format, priority tagging, neuro-symbolic representation, and methodology stories.
**Context**: User Stories — Step 1 (Assessment) + Step 2-6 (Plan with Questions)

---

## Requirements Review — Gap Analysis between AdHoc, ADR, and PRD
**Timestamp**: 2026-03-28T00:22:32Z
**User Input**: "User provided intent: help me review this @[Docs/AdHoc System Requirements — Architectural Firewall.md] and compare against these @[Docs/ADR — Architectural Decision Records Firewall Tech.md] @[Docs/PRD — Architectural Firewall Spec-Driven Compliance.md] find missing definitions that are mission in the first doc, but described in the other two"
**AI Response**: Identified 5 major gaps and 1 critical contradiction (Persistence vs Statelessness). Created comparison report.
**Context**: Requirements Analysis — Review and alignment


## Construction — Unit 2 APG Extractor — Loop Start + Functional Design Questions
**Timestamp**: 2026-03-30T00:05:00Z
**User Input**: "User provided intent: continue"
**AI Response**: Starting U2 — APG Extractor. Stage assessment: Functional Design (EXECUTE), NFR Requirements/Design/Infrastructure (all SKIP). Created unit-2-apg-extractor-functional-design-plan.md and unit-2-apg-extractor-design-questions.md with 4 targeted questions: Q1 node ID strategy, Q2 CONSTRUCTOR_INJECTS detection, Q3 CALLS edge scope, Q4 barrel import resolution. Awaiting user answers.
**Context**: Construction Phase — U2 Functional Design Step 1 complete

---

## Construction — Unit 2 Functional Design — Complete
**Timestamp**: 2026-03-30T00:20:00Z
**AI Response**: Q&A complete (Q1:A deterministic SHA-256 IDs, Q2:C decorator+structural DI, Q3:A cross-boundary CALLS only, Q4:A transitive barrel resolution). Generated 3 artifacts: business-logic-model.md (6-stage extraction lifecycle, node/edge extraction rules, ID algo, barrel detection, coverage computation), business-rules.md (35 rules across 7 categories + 7 warning codes), domain-entities.md (ExtractorOptions, ExtractorError, NodeRegistry, ResolvedImport, DIResolution, DecoratorMetadata, CallResolution + DI_DECORATORS + PRIMITIVE_TYPES + DEFAULT_EXCLUDE_PATTERNS constants). Awaiting approval.
**Context**: Construction Phase — U2 Functional Design Steps 1-6 complete

---

## Construction — Unit 2 Functional Design — APPROVED
**Timestamp**: 2026-03-30T00:25:00Z
**User Input**: "User provided intent: go ahead"
**AI Response**: Functional Design approved. Noted PipelineStage<string, APGResult> alignment from U1 output — APGExtractor class must implement this interface; execute() bridges to internal extractAPG() and calls context.setApgResult() on success. Proceeding to Code Generation Part 1 (plan).
**Context**: Construction Phase — U2 Functional Design Step 7/8 complete, Code Generation starting

---

## Construction — Unit 2 Code Generation — COMPLETE
**Timestamp**: 2026-03-30T01:00:00Z
**AI Response**: All 15 steps executed. Created 6 source files (types.ts, id-generator.ts, node-extractor.ts, edge-extractor.ts, apg-extractor.ts, index.ts) + 7 test files (4 unit, 3 BDD features, 1 integration). typecheck: 0 errors. test:unit: 89/89 passing (50 new U2 tests + 39 existing U1 tests). Fixed 3 typecheck errors: unused import, two array[0] non-null assertions. Awaiting user approval.
**Context**: Construction Phase — U2 Code Generation all steps [x]

---

## Construction — Unit 6 Code Generation — COMPLETE
**Timestamp**: 2026-03-30T17:30:00Z
**AI Response**: All 9 steps executed. Created 6 source files: types, score-computer (AVR/AHS), verdict, universal-metrics, report-formatter (JSON/human/CSV), scoring-engine + PipelineStage. Created 1 test file (15 tests). typecheck: 0 errors. tests: 239/239 passing (15 new U6 + 224 existing). All 10 stories traced. Awaiting user approval.
**Context**: Construction Phase — U6 Code Generation all steps [x]

---

## Construction — Unit 5 Code Generation — APPROVED
**Timestamp**: 2026-03-30T17:10:00Z
**User Input**: "User provided intent: continue"
**AI Response**: U5 approved. Proceeding to U6 (Scoring Engine + Reports).
**Context**: Construction Phase — U5 complete, U6 loop starting

---

## Construction — Unit 5 Code Generation — COMPLETE
**Timestamp**: 2026-03-30T17:00:00Z
**AI Response**: All 12 steps executed. Extended CypherTemplate with resultMapping (U3 mod). Created 9 source files across 3 modules: evaluation-engine (types, symbolic-evaluator), llm-critic (types, context-assembler, verdict-parser, cassette-manager, mock-provider, llm-critic), neuro-symbolic-router (types, router). Created 3 test files. typecheck: 0 errors. tests: 224/224 passing (27 new U5 + 197 existing). Awaiting user approval.
**Context**: Construction Phase — U5 Code Generation all steps [x]

---

## Construction — Unit 5 Functional Design — APPROVED
**Timestamp**: 2026-03-30T16:45:00Z
**User Input**: "User provided intent: continue"
**AI Response**: Functional Design approved. Proceeding to Code Generation Part 1 (plan). Key: CypherTemplate needs resultMapping extension from U3.
**Context**: Construction Phase — U5 Functional Design complete, Code Generation starting

---

## Construction — Unit 5 Functional Design — Answers
**Timestamp**: 2026-03-30T16:30:00Z
**User Input**: "User provided answers to questions and requested to proceed." — Q1:A (sequential hybrid, skip neuronal if symbolic fails), Q2:A (file-based cassettes for VCR), Q3:B (template-annotated result mapping), Q4:B (stddev consistency check, no formal ICC), Q5:A (fixed token budget per component)
**AI Response**: All 5 answers clear. Proceeding to generate functional design artifacts.
**Context**: Construction Phase — U5 Functional Design Q&A complete

---

## Construction — Unit 5 Functional Design — Questions
**Timestamp**: 2026-03-30T16:20:00Z
**AI Response**: Starting U5 — Neuro-Symbolic Router + Evaluation. Stage assessment: Functional Design (EXECUTE), Code Generation (ALWAYS). Created 5 design questions: Q1 hybrid dispatch strategy, Q2 VCR/cassette implementation, Q3 violation collection from Cypher, Q4 ICC computation method, Q5 LLM context budget. Awaiting answers.
**Context**: Construction Phase — U5 Functional Design Steps 1-3 complete

---

## Construction — Unit 4 Code Generation — APPROVED
**Timestamp**: 2026-03-30T16:10:00Z
**User Input**: "User provided answers to questions and requested to proceed."
**AI Response**: U4 approved. Proceeding to U5 (Neuro-Symbolic Router + Evaluation Engine).
**Context**: Construction Phase — U4 complete, U5 loop starting

---

## Construction — Unit 4 Code Generation — COMPLETE
**Timestamp**: 2026-03-30T16:00:00Z
**AI Response**: All 17 steps executed. Extended U1 shared types (drift types, SnapshotStore extensions, IngestionResult.driftReport). Created 8 source files: types, layer-annotator (picomatch), neo4j-repository, graph-ingester (UNWIND), fs-snapshot-store, delta-computer, drift-detector (4 drift types), neo4j-ingestion orchestrator + PipelineStage. Created 5 test files. typecheck: 0 errors. tests: 197/197 passing (34 new U4 + 163 existing). All 12 stories traced. Awaiting user approval.
**Context**: Construction Phase — U4 Code Generation all steps [x]

---

## Construction — Unit 4 Functional Design — APPROVED
**Timestamp**: 2026-03-30T15:35:00Z
**User Input**: "User provided intent: continue"
**AI Response**: Functional Design approved. Proceeding to Code Generation Part 1 (plan).
**Context**: Construction Phase — U4 Functional Design complete, Code Generation starting

---

## Construction — Unit 4 Functional Design — Answers
**Timestamp**: 2026-03-30T15:25:00Z
**User Input**: "User provided answers to questions and requested to proceed."
**AI Response**: User deferred to AI judgment. Selected: Q1:C (UNWIND bulk insert — idiomatic Neo4j, fewer round-trips), Q2:A (glob matching in TS via picomatch — simplest, well-tested), Q3:B (APG comparison by node/edge ID — no git dependency, simpler contract), Q4:A (filesystem only — portable, matches US-3.1/3.3 acceptance criteria describing APG_Store/ with JSON), Q5:B (component/layer-level — actionable for PR comments while avoiding file-level storage explosion). Proceeding to generate design artifacts.
**Context**: Construction Phase — U4 Functional Design Q&A complete

---

## Construction — Unit 4 Functional Design — Questions
**Timestamp**: 2026-03-30T15:20:00Z
**AI Response**: Starting U4 — Neo4j + Persistence. Stage assessment: Functional Design (EXECUTE), NFR/Infra (SKIP), Code Generation (ALWAYS). Created design plan and 5 questions: Q1 Neo4j transaction strategy, Q2 layer annotation matching, Q3 delta APG scope, Q4 snapshot storage backend, Q5 drift detection granularity. Awaiting answers.
**Context**: Construction Phase — U4 Functional Design Steps 1-3 complete

---

## Construction — Unit 3 Code Generation — APPROVED
**Timestamp**: 2026-03-30T15:10:00Z
**User Input**: "User provided intent: continue"
**AI Response**: U3 approved. Proceeding to U4 (Neo4j + Persistence).
**Context**: Construction Phase — U3 complete, U4 loop starting

---

## Construction — Unit 3 Code Generation — COMPLETE
**Timestamp**: 2026-03-30T15:00:00Z
**AI Response**: All 20 steps executed. Extended U1 shared types (CypherQuery, NeuronalInstruction, CompiledFunctions with new fields). Created 7 source files: spec-parser (types, spec-schema, template-registry, spec-validator, layer-parsers, adr-parsers, spec-parser) + 4 fitness-compiler (types, cypher-templates, fitness-compiler, index). Created 5 test files (3 spec-parser unit, 1 fitness-compiler unit, 1 integration). typecheck: 0 errors. tests: 163/163 passing (61 new U3 + 89 U2 + 13 U1). 24 Cypher templates, 4 ADR strategy parsers, template registry with clean-architecture (26 functions), shadow mode metadata for ADR rules. Awaiting user approval.
**Context**: Construction Phase — U3 Code Generation all steps [x]

---

## Construction — Unit 3 Functional Design — APPROVED
**Timestamp**: 2026-03-30T14:25:00Z
**User Input**: "User provided intent: continue"
**AI Response**: Functional Design approved. Proceeding to Code Generation Part 1 (plan). Key integration note: FirewallContext needs setParsedSpec() + setCompiledFunctions() setters from U1.
**Context**: Construction Phase — U3 Functional Design complete, Code Generation starting

---

## Construction — Unit 3 Functional Design — Answers
**Timestamp**: 2026-03-30T14:10:00Z
**User Input**: "User provided explicit answers to design questions, selecting A, A, A, and an experimental C variant for Q4, and C for Q5."
**AI Response**: All 5 answers clear and well-reasoned. Q4 shadow mode introduces a research-grade dual-execution path for ADR rules — design must support handcrafted Cypher as primary + shadow LLM generation with comparison hooks. Proceeding to generate functional design artifacts.
**Context**: Construction Phase — U3 Functional Design Q&A complete

---

## Construction — Unit 2 Code Generation — APPROVED
**Timestamp**: 2026-03-30T14:00:00Z
**User Input**: "User approved the unit and requested to proceed, emphasizing the use of sub-agents."
**AI Response**: U2 approved. Proceeding to U3 (Spec Parser + Fitness Compiler). Stage assessment: Functional Design (EXECUTE — complex YAML parsing, 17+ Cypher templates, ADR multi-format parsing, template resolution), NFR Requirements (SKIP), NFR Design (SKIP), Infrastructure Design (SKIP — no infra, just YAML/Cypher libraries), Code Generation (ALWAYS).
**Context**: Construction Phase — U2 complete, U3 loop starting

---

## Construction — U7 (CLI + CI/CD + Pipeline Orchestration) — Functional Design START
**Timestamp**: 2026-03-30T18:00:00Z
**User Input**: "User provided answers to questions and requested to proceed."
**AI Response**: Starting U7 Functional Design. U7 covers C9 (CLI), S1 (PipelineExecutor), GitHub Action, Batch Runner. 21 stories mapped. Stage assessment: Functional Design (EXECUTE — complex pipeline orchestration with command pattern, parallel branch dispatch, CLI with 3 commands, GitHub Action integration), Code Generation (ALWAYS). NFR/Infra stages handled via Code Gen since GitHub Action stubs already exist and NFR patterns are straightforward CLI concerns.
**Context**: Construction Phase — U7 Functional Design starting (final unit)

---

## Construction — U7 Functional Design — APPROVED
**Timestamp**: 2026-03-30T18:30:00Z
**User Input**: "User provided answers to questions and requested to proceed." (approval)
**AI Response**: Functional design approved. Generated 3 artifacts: business-logic-model.md (7 BL areas), business-rules.md (8 rules), domain-entities.md (11 command classes + PipelineExecutor + factory). Proceeding to Code Generation.
**Context**: Construction Phase — U7 Functional Design COMPLETE, Code Generation starting

---

## Construction — U7 Code Generation — COMPLETE
**Timestamp**: 2026-03-30T19:15:00Z
**User Input**: "User provided answers to questions and requested to proceed."
**AI Response**: U7 Code Generation complete. Implemented: PipelineExecutor (sequential command loop, fail-fast, graceful shutdown), 12 PipelineCommand adapters (Extract, Parse, Ingest, Compile, RouteEvaluate, SymbolicEvaluate, NeuronalEvaluate, Score, SnapshotSave, SnapshotLoad, DriftDetect, ParallelCommand), pipeline factory with preset command sequences + flag overrides, CLI with 3 commands (evaluate/batch/drift) via Commander.js, batch runner with per-project isolation, drift handler with dual-mode snapshot selection, GitHub Action (composite: PR comment + Check Run), manual trigger workflow, bin/firewall.ts entry point. 73 new tests across 6 suites, all passing. Full suite: 29 suites, 312 tests, 0 failures. TypeCheck: 0 errors.
**Context**: Construction Phase — U7 COMPLETE (final unit). All 8 units done. Next: Build and Test stage.

---

## Build and Test Stage — COMPLETE
**Timestamp**: 2026-03-30T19:45:00Z
**User Input**: "User approved the build and test summary."
**AI Response**: Generated 5 Build and Test documents: build-instructions.md (prerequisites, env vars, build steps, troubleshooting), unit-test-instructions.md (per-module breakdown of 312 tests across 29 suites), integration-test-instructions.md (2 existing + 6 recommended scenarios), performance-test-instructions.md (7 performance tests against NFR targets), build-and-test-summary.md (comprehensive status: 312 tests pass, 76% coverage, 81/81 stories covered, architecture quality indicators). Build: PASS. Tests: PASS. TypeCheck: PASS. Symbolic-only production: READY. Full neuro-symbolic: needs real LLM providers.
**Context**: Construction Phase — Build and Test COMPLETE. CONSTRUCTION PHASE COMPLETE.

---

## Self-Evaluation Findings + v1.1 Planning
**Timestamp**: 2026-03-30T21:00:00Z
**User Input**: "User agreed with the evaluation findings and proposed features for v1.1, including an LLM agent setup skill, project-agnostic rules, framework presets, and future-proofing strategies."
**AI Response**: Starting v1.1 Requirements Analysis. Key themes: (1) LLM-powered agent skill for spec generation/setup, (2) project-agnostic spec engine with exclude_paths, per-violation suppression, (3) framework presets (NestJS, Next.js, Express, plain TS, React), (4) language-agnostic future-proofing via abstraction of APG extractor, (5) ADR-to-spec mapping pipeline, (6) developer experience (init command, actionable violations, incremental adoption). Bug fix: dependency-direction Cypher was inverted (fixed during self-eval).
**Context**: v1.0 CONSTRUCTION COMPLETE. Starting v1.1 INCEPTION (brownfield — extending existing codebase).

---

## v1.1 Requirements Analysis — Session Resumption
**Timestamp**: 2026-04-15T00:00:00Z
**User Input**: "User wants to re-scope v1.1 for a demoable product. Two parallel tracks: Track A (spec generation via Claude skill + firewall init + presets + excludes + validation) and Track B (interactive HTML demo dashboard for product demos). User reviewed Notion doc 'archguard: Reverse Pipeline, APG Self-Duality & Product Design Synthesis' which informed the reverse pipeline design. User decided on Option C: run inception through Units Generation in main, split into worktrees only at code generation time for parallel coding."
**AI Response**: Resuming v1.1 Requirements Analysis. Re-scoping from 14 FRs to demo-focused subset. Track A: FR-01, FR-02, FR-03, FR-06, FR-14. Track B: FR-07 + new HTML report generator. Deferring FR-04, FR-05, FR-08, FR-09, FR-10, FR-11, FR-12. FR-13 partially needed (real LLM for skill). Creating verification questions for scope confirmation.
**Context**: v1.1 INCEPTION — Requirements Analysis (re-scoping for demo focus)

---

## v1.1 Requirements Analysis — Verification Answers
**Timestamp**: 2026-04-15T00:15:00Z
**User Input**: "User confirmed scope: D (add FR-04 + FR-09), Gemini for neuronal path, Claude Code skill only (A), 2 presets (B), embedded JSON (A), Cytoscape.js (D), both fixtures + real repo (C), shared Build & Test (A), Neo4j accepted (A), product name 'architectonic firewall' keeping CLI as 'firewall'."
**AI Response**: Generated v1.1-requirements-scoped.md with 10 FRs (4 Track A, 2 Track B, 3 Shared + 1 NEW FR-15 for HTML report). 5 FRs deferred to v1.2+. Updated aidlc-state.md. No contradictions detected. Requirements Analysis COMPLETE.
**Context**: v1.1 INCEPTION — Requirements Analysis COMPLETE. Next: User Stories.

---

## v1.1 User Stories — Planning + Generation
**Timestamp**: 2026-04-15T00:30:00Z
**User Input**: "User approved AI-recommended answers for story planning: B (extend ARCH persona), B (3 dashboard stories), A (separate v1.1 file), B (Gherkin for Track A, checklist for Track B), D (3 epics: E-INIT, E-DASH, E-LLM)."
**AI Response**: Generated 18 user stories across 3 epics. E-INIT: 10 stories covering skill workflow, framework detection, presets, excludes, enable/disable, validation, baseline, mining queries. E-DASH: 5 stories covering layout, visualizations, interactive features, report CLI command, actionable messages. E-LLM: 3 stories covering GeminiProvider, neuronal results in dashboard, model configuration. Extended ARCH persona with demo presenter role. Stories use Gherkin for Track A, checklist for Track B. Awaiting approval.
**Context**: v1.1 INCEPTION — User Stories (generation complete, pending approval)

---

## v1.1 User Stories — APPROVED
**Timestamp**: 2026-04-15T00:35:00Z
**User Input**: "User approved v1.1 user stories."
**AI Response**: User Stories approved. 18 stories across 3 epics. Proceeding to Workflow Planning.
**Context**: v1.1 INCEPTION — User Stories COMPLETE. Next: Workflow Planning.

---

## v1.1 Workflow Planning
**Timestamp**: 2026-04-15T00:40:00Z
**User Input**: "User approved stories and said to keep going."
**AI Response**: Generated v1.1-execution-plan.md. Stage decisions: Application Design EXECUTE (new components), Units Generation EXECUTE (two-track decomposition). Construction: Functional Design CONDITIONAL per unit, NFR/Infra SKIP (no new concerns), Code Gen EXECUTE with parallel worktrees (Option C), Build & Test EXECUTE shared post-merge. Module update sequence: shared extensions first, then Track A, Track B, GeminiProvider last. Awaiting approval.
**Context**: v1.1 INCEPTION — Workflow Planning (plan generated, pending approval)

---

## v1.1 Workflow Planning — APPROVED
**Timestamp**: 2026-04-15T00:45:00Z
**User Input**: "User approved workflow plan and requested to continue."
**AI Response**: Workflow Planning approved. Proceeding to Application Design.
**Context**: v1.1 INCEPTION — Workflow Planning COMPLETE. Next: Application Design.

---

## v1.1 Application Design
**Timestamp**: 2026-04-15T00:50:00Z
**User Input**: "User approved design decisions: A (presets extend C3), B (baseline new C12), B (report new C13), A (mining in skill). Agreed with all recommendations."
**AI Response**: Generated 5 design artifacts: v1.1-components.md (2 new: C12 Baseline Manager, C13 Report Generator; 5 extended: C3, C4, C7, C8, C9), v1.1-component-methods.md (all method signatures), v1.1-services.md (3 new pipeline commands + configs), v1.1-component-dependency.md (dependency matrix + 3 data flow diagrams), v1.1-application-design.md (consolidated). Track boundaries confirmed: A touches C3/C4/C9/C12/Skill, B touches C8/C9/C13, Shared: C7/C10. Awaiting approval.
**Context**: v1.1 INCEPTION — Application Design (artifacts generated, pending approval)

---

## v1.1 Application Design — APPROVED
**Timestamp**: 2026-04-15T00:55:00Z
**User Input**: "User approved application design."
**AI Response**: Application Design approved. Proceeding to Units Generation.
**Context**: v1.1 INCEPTION — Application Design COMPLETE. Next: Units Generation.

---

## v1.1 Units Generation
**Timestamp**: 2026-04-15T01:00:00Z
**User Input**: "User approved application design and said to continue."
**AI Response**: Generated 4 units: U0 (Shared Extensions — main, first), U1 (Track A Spec Generation — worktree, parallel), U2 (Track B Dashboard — worktree, parallel), U3 (Gemini Integration — main, last). 18/18 stories mapped. Dependency: U0 blocks U1+U2, U3 independent. Construction stages: Functional Design EXECUTE for U0/U1/U2, SKIP for U3. Awaiting approval.
**Context**: v1.1 INCEPTION — Units Generation (artifacts generated, pending approval)

---

## v1.1 Units Generation — APPROVED
**Timestamp**: 2026-04-15T01:05:00Z
**User Input**: "User approved units and requested to start construction."
**AI Response**: Units approved. INCEPTION PHASE COMPLETE. Starting CONSTRUCTION PHASE with U0 (Shared Extensions) Functional Design.
**Context**: v1.1 INCEPTION COMPLETE. CONSTRUCTION starting — U0 Functional Design.

---

## v1.1 Construction — U0 Functional Design
**Timestamp**: 2026-04-15T01:10:00Z
**User Input**: "User requested to start construction immediately."
**AI Response**: Explored existing source code (src/shared/types/spec.ts, src/spec-parser/layer-parsers.ts, src/fitness-compiler/fitness-compiler.ts) to identify exact extension points. Generated 3 functional design artifacts: domain-entities.md (6 new/extended types: FitnessFunction+enabled+excludePaths, DisabledFunction, ValidationReport, ActionableViolation, BaselineSnapshot/Result, GeminiConfig), business-logic-model.md (4 BL areas: glob-to-regex conversion, WHERE NOT injection, enabled filtering, spec validation pipeline), business-rules.md (8 rules covering defaults, scope, safety, backward compat). Awaiting approval.
**Context**: v1.1 CONSTRUCTION — U0 Functional Design complete, pending approval.

---

## v1.1 Construction — U0 Code Generation Plan
**Timestamp**: 2026-04-15T01:15:00Z
**User Input**: "User approved functional design and asked when worktrees happen — answered: after U0 code gen."
**AI Response**: Created U0 code generation plan with 13 steps: extend shared types, verify backward compat, extend spec parser, test parser, implement glob-to-regex, test glob, implement exclude injector, test injector, extend compiler, test compiler, implement validator, test validator, final verification. ~6 modified files, ~6 new source + ~5 test files, ~40-50 new tests. Awaiting plan approval.
**Context**: v1.1 CONSTRUCTION — U0 Code Generation Part 1 (plan), pending approval.

---

## v1.1 Construction — U0 Code Generation Plan — APPROVED
**Timestamp**: 2026-04-15T01:20:00Z
**User Input**: "User approved plan. Will be notified when to switch to other folders/sessions for U1+U2."
**AI Response**: Starting U0 Code Generation Part 2. Executing 13 steps.
**Context**: v1.1 CONSTRUCTION — U0 Code Generation Part 2 (executing).

---

## v1.1 Construction — U0 Code Generation — COMPLETE
**Timestamp**: 2026-04-15T01:30:00Z
**User Input**: "User approved code gen plan."
**AI Response**: U0 Code Generation complete. Modified: src/shared/types/spec.ts (FitnessFunction+enabled+excludePaths+DisabledFunction), src/shared/taxonomy/violation-types.ts (ActionableViolation), src/shared/types/evaluation.ts (CompiledFunctions+disabledFunctions), src/spec-parser/layer-parsers.ts (parse enabled/exclude_paths), src/spec-parser/template-registry.ts (defaults), src/fitness-compiler/fitness-compiler.ts (filterEnabled+applyExcludePaths), src/neuro-symbolic-router/router.ts (disabledFunctions passthrough). Created: src/shared/types/validation.ts, src/shared/types/baseline.ts, src/shared/types/llm-config.ts, src/fitness-compiler/glob-to-regex.ts, src/fitness-compiler/exclude-injector.ts, src/spec-parser/spec-validator.ts (validateSpecAgainstProject). Tests: 4 new test files, 29 new tests. Final: 33 suites, 341 tests, 0 failures. TypeCheck: 0 errors. Backward compat: all 312 original tests pass.
**Context**: v1.1 CONSTRUCTION — U0 COMPLETE. Ready for worktree creation (U1 + U2 parallel).

---

## v1.2 Inception — Pending Units Workflow Definition
**Timestamp**: 2026-06-02T00:00:00Z
**User Input**: "Define a workflow to implement the pending work units; use a Claude Code workflow for this task."
**AI Response**: Reconciled request against state — v1.0 (U0-U7) and v1.1 (U0-U3) are COMPLETE; the only pending work is the 5 FRs deferred to v1.2+ (FR-05, FR-08, FR-10, FR-11, FR-12), not yet decomposed into units. Ran a multi-agent Claude Code Workflow (6 agents): Understand phase analyzed each deferred FR against real src/ code (integration points, effort, dependencies, risks); Design phase synthesized a 5-unit decomposition. Result written to aidlc-docs/inception/plans/v1.2-pending-units-plan.md. Proposed units: v1.2-U0 Type/Graph-Contract Foundation (M, shared seam), U1 In-Memory Graph Backend FR-12 (XL, highest risk), U2 Language-Agnostic Extractor + React FR-10/11 (L), U3 Inline Suppression FR-05 (L), U4 ADR->FF LLM Extraction FR-08 (L). Sequence: U0 -> parallel worktrees U1/U2/U3/U4 -> single Build & Test. Recommended AI-DLC path: fresh Inception (Requirements/Stories/Workflow Planning/App Design/Units Gen) then per-unit Construction loop, mirroring v1.1.
**Context**: v1.2 INCEPTION — planning artifact produced. Awaiting user approval on scope + whether to proceed with formal AI-DLC v1.2 Requirements Analysis.

---

## v1.2 Inception — Requirements Analysis START (New FR: Graph JSON Export Backend)
**Timestamp**: 2026-06-26T15:00:00Z
**User Input**: "Wants to add the capability to generate this project's architecture graph as a parameterizable option that, in addition to Neo4j, persists the graph to a flat JSON file in the repo, usable within the firewall technology. Asked to modify the necessary AI-DLC artifacts to formalize the spec."
**AI Response**: Classified as Development Task (architectural enhancement — new graph persistence/serialization backend). Recalled for the user that the existing `FileSystemSnapshotStore` (src/neo4j-ingestion/fs-snapshot-store.ts) already writes the APG to flat `nodes.json`/`edges.json` per commit for drift detection, and that FR-12 (v1.2-U1, in-memory backend) is the related-but-distinct planned work. Entered v1.2 INCEPTION Requirements Analysis at Standard depth. Tentatively labeled the new requirement FR-16 (Graph Serialization / JSON Export backend), number provisional. Did NOT decide design questions; per question-format-guide created aidlc-docs/inception/requirements/v1.2-graph-export-verification-questions.md with 7 clarifying questions (purpose: export-only vs evaluation backend; relationship to FR-12; JSON schema/format; committed vs gitignored; CLI/parameterization; v1.2 sequencing; enrichment level) plus the Security Baseline extension opt-in. Awaiting answers at the GATE before generating the requirements doc.
**Context**: v1.2 INCEPTION — Requirements Analysis IN PROGRESS. Verification questions presented; STOP pending user answers.

---

## v1.2 Inception — Requirements Analysis PIVOT to Minimal Reuse Scope (FR-16)
**Timestamp**: 2026-06-26T15:25:00Z
**User Input**: "Doesn't want to spec from scratch. Asked to analyze whether we can ship a much smaller version of an existing use case — something simple and fast to add the functionality and test it in production."
**AI Response**: Re-scoped from a full from-scratch FR to a MINIMAL-DEPTH reuse feature. Code analysis (cli.ts, pipeline-factory.ts, extract-command.ts, apg.ts, fs-snapshot-store.ts) confirmed the graph-generation capability already exists and is unexposed: `extractAPG(projectPath, {excludePatterns})` returns `APGResult {nodes, edges, parseCoverage, warnings}` with NO Neo4j dependency; `FileSystemSnapshotStore` already JSON-serializes the APG; `baseline` and `report` CLI commands are the exact 'run → write file with -o/--output' template. Smallest path = reuse all three. Retired the heavy 8-question verification file; replaced it with a 2-question minimal scope decision (delivery surface: new `firewall graph` command vs `--export-graph` flag; JSON shape: single file vs nodes/edges split). Recommended Option A (new standalone `firewall graph --project <path> -o architecture-graph.json`, Neo4j-free, fully isolated, additive). Security Baseline extension judged N/A for this internal read-only export (no auth/data-exposure surface). Requirements depth downgraded to Minimal. Awaiting user pick on the 2 decisions.
**Context**: v1.2 INCEPTION — Requirements Analysis (Minimal depth, FR-16). Minimal scope decision presented; STOP pending user pick.

---
## Workspace Detection — Session Re-Entry (PRD-driven Inception request)
**Timestamp**: 2026-09-07T20:30:00Z
**User Input**: "Wants to start the Inception process driven by the v1.0 PRD (`Docs/PRD — Architectural Firewall Spec-Driven Compliance.md`)."
**AI Response**: Classified as Development Task → AI-DLC triggered. Loaded mandatory common rules (process-overview, session-continuity, content-validation, question-format-guide) and the single extension opt-in (security-baseline). Ran Workspace Detection per inception/workspace-detection.md Step 1: `aidlc-docs/aidlc-state.md` EXISTS → RESUME path, not new-project path. Workspace scan: brownfield in fact (106 TypeScript files under `src/`, `tests/`, npm build system) though state file records Project Type as Greenfield from the original 2026-03-27 run — that label is now stale. Reverse-engineering artifacts partially exist (`code-quality-assessment.md`, `dependencies.md`), so Reverse Engineering stays SKIPPED. CRITICAL RECONCILIATION: the requested PRD has ALREADY been fully consumed by Inception — `inception/requirements/requirements.md` holds 17 FRs + 6 NFRs + 3 METH traced to it, plus 81 stories / 3 personas / 17 epics, application design (11 components, 6 services), and 8 units (U0–U7), all built and tested (v1.0). v1.1 added 10 FRs / 18 stories / 4 units, also COMPLETE (43 suites, 421 tests). Re-running Inception from the PRD would overwrite these artifacts, so did NOT proceed. Also found an open gate: v1.2 Requirements Analysis is IN PROGRESS and blocked — both [Answer]: tags in `inception/requirements/v1.2-graph-export-verification-questions.md` are still empty. Secondary finding: the provisional "FR-16" label for Graph JSON Export collides with v1.0 FR-16 (Batch Runner); v1.1 FRs use a separate namespace (14 original + FR-15). Per question-format-guide, created `aidlc-docs/inception/requirements/v1.2-inception-entry-questions.md` (4 questions: re-entry intent, PRD-vs-built delta scope, FR numbering namespace, security extension opt-in). GATE: STOP pending user answers.
**Context**: v1.2 INCEPTION — Workspace Detection COMPLETE (resume path). Entry-decision gate presented; awaiting user answers before any Requirements Analysis work.

---
## Tooling Request — "Install AI-DLC in this repository"
**Timestamp**: 2026-09-07T20:45:00Z
**User Input**: "Wants AI-DLC installed into this repository."
**AI Response**: Did NOT install — premise contradicted by disk state. Verification performed before acting: `.aidlc-rule-details/` is PRESENT with all 27 rule files (common 11, inception 7, construction 6, extensions 2, operations 1), created 2026-03-27, and all 27 are git-tracked and not gitignored. `CLAUDE.md` (workflow trigger + phase definitions) is tracked. `aidlc-docs/` holds 87 tracked files across inception/, construction/, plus aidlc-state.md and audit.md. Ran a link-integrity scan across CLAUDE.md and every rule file: 81 distinct .md references, ZERO dangling rule-file references — every apparent miss resolved either to an AI-DLC output artifact that exists under aidlc-docs/ (aidlc-state, audit, requirements, stories, unit-of-work, execution-plan, etc.) or to an illustrative filename inside question-format-guide.md examples. Extension naming convention verified: `security-baseline.opt-in.md` correctly resolves to `security-baseline.md`. Confirmed the second registered working directory `/Users/arkatechie/dev-link/Archi-Firewall/DaedalusArch` is the SAME repo reached through a symlink (`/Users/arkatechie/dev-link` -> `/Volumes/Life-OS/Users/Arkatechie/Development`), so no second install target exists. Only cosmetic defect found: `common/process-overview.md` lines 5 and 7 reference a `core-workflow.md` that does not exist in this install; `common/welcome-message.md` fills that role. Non-blocking, no functional impact. The `.kiro/` and `.amazonq/` rule-detail variants are absent, which is correct for a Claude Code install. No files created or modified for this request.
**Context**: Tooling/meta request, not a product Development Task — full AI-DLC workflow not triggered. Install verified complete and healthy; reported to user with the three real options (install elsewhere, upgrade from upstream, add other IDE variants).

---

## Session Re-Entry — Workspace Detection (resume path) + new cycle request
**Timestamp**: 2026-10-05T18:00:00Z
**User Input**: "Wants to start WP0 (freeze the ground) and WP1 (engine fixes that precede any measurement) from the evaluation-readiness plan, and wants them specified before any code is written."
**AI Response**: Classified as Development Task (bug fixes + architectural contract changes to the graph schema, parser, compiler, scoring and report). AI-DLC triggered. Loaded common rules (process-overview, session-continuity, content-validation, question-format-guide, welcome-message, depth-levels) and the single extension opt-in (security-baseline). Workspace Detection: `aidlc-docs/aidlc-state.md` EXISTS → RESUME path. Workspace is brownfield (106 TS files, npm, jest; HEAD `7cd15b4`, one untracked doc). Reverse-engineering artefacts exist → Reverse Engineering SKIPPED. Found the v1.2 Inception entry gate of 2026-09-07 still open (four unanswered [Answer]: tags in `inception/requirements/v1.2-inception-entry-questions.md`; graph-export questions also unanswered). This request is a different v1.2 scope (evaluation readiness, sourced from the 2026-10-05 read-only audit recorded in Notion), so the stale gate must be retired or merged before a new Requirements Analysis can write artefacts; made that Question 1 of the new question file. Pre-read for the spec: `symbolic-evaluator.ts` (EVAL_001 reaches context warnings; function dropped from results), `scoring-engine.ts:64` (JSON report `warnings: []`; `report-generator.ts:32-35` merges pipeline warnings for the HTML path only — the v1.1 "warning-dropping fix" covered HTML, not JSON), `layer-parsers.ts:65-82` (six function-specific fields dropped), `fitness-compiler.ts:298-303` (reads them from the object), `edge-extractor.ts:253-255` (non-relative imports skipped with EXTRACTOR_001), `violation-types.ts:35-48` (no line/target), `score-computer.ts:56-77` (no renormalisation) and `:116` (functionCount "approximate"), `graph-ingester.ts:21,64` (literal node/edge type arrays), `batch-runner.ts:56-61` (provider 'claude' misconfig), `.gitignore:3` (package-lock.json ignored), `package.json` (no engines).
**Context**: v1.2 INCEPTION — Workspace Detection COMPLETE (resume). Requirements Analysis for the Evaluation-Readiness cycle STARTED at Standard depth.

---

## v1.2 Evaluation-Readiness — Requirements Analysis START (WP0 + WP1)
**Timestamp**: 2026-10-05T18:10:00Z
**User Input**: (same request) "Spec WP0 and WP1 before proceeding."
**AI Response**: Intent analysis — Request type: bug fix + enhancement (contract changes); scope: multiple components (apg-extractor, neo4j-ingestion, spec-parser, fitness-compiler, evaluation-engine, scoring-engine, report, cli); complexity: moderate; clarity: clear on goals (six design decisions already taken by the user on 2026-10-05 and recorded in Notion), unclear on seven points. Depth: Standard. Per question-format-guide created `aidlc-docs/inception/requirements/v1.2-evaluation-readiness-questions.md` with 7 questions (stale-gate disposition, FR namespace, security extension opt-in, fan-out metric and Package targets, Package node naming for scoped/subpath specifiers, relationship of WP1 to the drafted v1.2-U0 foundation unit, severity of the new bound-parameter validation rule) plus the proposed WP0/WP1 requirement list with acceptance criteria as preview context. Did NOT write requirements.md (gate). Did NOT modify any source file.
**Context**: v1.2 INCEPTION — Requirements Analysis IN PROGRESS. GATE: awaiting answers in the question file; STOP.

---

## v1.2 Evaluation-Readiness — Requirements Analysis: answers received, requirements generated
**Timestamp**: 2026-10-05T18:40:00Z
**User Input**: "Answer all seven questions with the recommended options; done."
**AI Response**: Filled all seven [Answer]: tags with A at the user's instruction and checked for contradictions (none: retiring the stale gates, version-prefixed IDs, security enabled, file-to-file fan-out plus a new externalFanOut metric, one Package node per package root, folding into v1.2-U0, always-fatal BR-SPEC-10 are mutually consistent). Marked `v1.2-inception-entry-questions.md` and `v1.2-graph-export-verification-questions.md` SUPERSEDED (header note; files kept). Security Baseline extension ENABLED → loaded `extensions/security/baseline/security-baseline.md`; recorded in aidlc-state.md Extension Configuration. Generated `inception/requirements/v1.2-evaluation-readiness-requirements.md`: 18 FRs (FR-v1.2E-01..06 WP0; 07..18 WP1), 6 NFRs, security compliance table, thesis traceability. Read `.github/workflows/ci.yml` (Node 22) for FR-02.
**Security Findings** (SECURITY extension, Requirements stage): SECURITY-09 non-compliant in current code — `docker-compose.yml` falls back to default password `daedalus-dev`; resolved by FR-v1.2E-06 in this cycle. SECURITY-10 non-compliant in current code — `package-lock.json` gitignored, no vulnerability scan in CI; resolved by FR-v1.2E-02 and NFR-v1.2E-06. All other rules Compliant or N/A (no endpoints, no cloud, no auth). No blocking finding remains at the requirements level.
**Context**: v1.2 INCEPTION — Requirements Analysis COMPLETE. User Stories assessed as SKIP (internal engine fixes and report fields; no user workflow change; single persona = the author). Approval prompt presented; next stage Workflow Planning.

---

## v1.2 Evaluation-Readiness — Requirements change and approval
**Timestamp**: 2026-10-06T15:00:00Z
**User Input**: "Agrees with the minimal compliance plan (four engine changes and three experiment tools on top of WP0+WP1) and wants it done; before starting, wants a plan for generating the experiment assets and validating results and conclusions."
**AI Response**: Added FR-v1.2E-19..23 (layer binding by kind/position; layered style library; FLOWS_TO data-flow edge with domain-state-purity template; Semantic and Integrity dimensions; judge receives real source via an Anthropic provider using the author's OAuth profile, model claude-opus-5-5, no API key) and FR-v1.2E-24..26 (manifest schema + mutation tool; dated matching rule + scorer; offline re-scorer). Out-of-scope list updated to the deviations of the compliance register. Recorded requirements as APPROVED. Security re-check of the added rows: FR-23 introduces credential use — compliant with SECURITY-12 (no hardcoded credentials; OAuth profile resolved by the SDK) and SECURITY-03 (provider/model logged, never tokens). No new blocking finding. Workflow Planning held until the experiment protocol is agreed.
**Context**: v1.2 INCEPTION — Requirements Analysis APPROVED; Workflow Planning pending.

---

## v1.2 Evaluation-Readiness — Final objective wording and no-human-label constraint
**Timestamp**: 2026-10-06T16:00:00Z
**User Input**: "Provided the final SO1–SO5 wording (SO3 now names 'structural and topological rules' and the neural dimensions 'Semantic intent alignment and architectural Integrity'; SO2 'a bounded set of data-flow edges'). States there is no time or resources for human labels; the work must rely almost entirely on LLM labels, LLM-synthesised data and seeded issues."
**AI Response**: Added FR-v1.2E-27 (LLM labeller panel independent of the judge, cassette-recorded), FR-v1.2E-28 (project generator across model x spec-quality grid, serving SO5 and a never-seen corpus) and FR-v1.2E-29 (structural/topological/pattern-proxy tag per template). Security: FR-27/28 use provider credentials only through the SDK credential chain (SECURITY-12); generated code is untrusted input and is only parsed, never executed (SECURITY-13). No blocking finding. Requirements remain APPROVED with these additions per the author's direction.
**Context**: v1.2 INCEPTION — Requirements extended; Workflow Planning pending.

---

## v1.2 Evaluation-Readiness — Simplification of the results plan
**Timestamp**: 2026-10-06T16:30:00Z
**User Input**: "Will audit the random sample of labels personally. Other model families (Gemini / Antigravity CLI, Codex subscription) come at the final stage. Asked for an assessment and a solid but not overly complex plan to generate the results."
**AI Response**: Assessed the plan as over-built (four tiers, 20-30 public repos each needing hand-mapped specs, 15 operators, two-labeller panel run twice). Simplified: generated projects become the main corpus; public projects limited to the three existing ones plus one layered project; eight mutation operators; one labeller (Gemini) plus the author's 30-item audit; Claude models first, other families as the last phase. FR-24, FR-27 and FR-28 edited accordingly. Plan of record written to Notion ("Results plan — plan of record").
**Context**: v1.2 INCEPTION — Requirements adjusted; Workflow Planning pending.

---

## v1.2 Evaluation-Readiness — Workflow Planning
**Timestamp**: 2026-10-06T17:00:00Z
**User Input**: "proceed to workflow planning"
**AI Response**: Loaded inception/workflow-planning.md and content-validation rules. Created `inception/plans/v1.2E-execution-plan.md` (cycle-specific name so the v1.0 execution-plan.md is not overwritten). Decisions: User Stories SKIP; Application Design EXECUTE (minimal); Units Generation EXECUTE with six proposed units (U0 Foundation, U1 Spec+compiler, U2 Extractor+graph, U3 Evaluation+scoring+report, U4 Neural path, U5 Experiment tooling); Functional Design per unit except U0; NFR Requirements, NFR Design, Infrastructure Design SKIP; Code Generation and Build and Test always. Risk Medium; rollback easy. Mermaid validated (alphanumeric node ids, no special characters in labels, emoji removed from subgraph titles) with a text alternative. Security: no stage skip removes a security control; SECURITY-09/10 items sit in U0, SECURITY-12 in U4.
**AI Prompt**: "Ready to proceed with this plan?"
**Context**: Workflow Planning COMPLETE, awaiting approval.

---

## v1.2 Evaluation-Readiness — Workflow Planning adversarial review, approval, Application Design start
**Timestamp**: 2026-10-06T18:00:00Z
**User Input**: "generate an adversarial assessment of this plan with a subagent and then progress"
**AI Response**: Ran one independent read-only reviewer agent over the execution plan, requirements and code. Verdict: do not proceed until three false assumptions are fixed (SDK/port cannot deliver FR-23; neural dimension accounting broken; NFR-01 already violated with no Neo4j-backed regression test) and circularity guards are added. Verified the key claims in code before acting. Accepted all 14 findings (record: `inception/plans/v1.2E-execution-plan-adversarial-review.md`). Requirements amended (FR-09, 10, 12, 23, 24, 25, 27, 28 restated; FR-30..36, NFR-07, NFR-08 added; NFR-01 widened; Section 5 made consistent). Execution plan revision 2: NFR Requirements now EXECUTE (light, in U0); units re-scoped with a shared-file ownership table; U5 no longer depends on U4; timeline 25–30 days. Treated "then progress" as approval of Workflow Planning revision 2. Started Application Design: created `inception/plans/v1.2E-application-design-plan.md` with 10 questions (credential route, judge unit, type-only imports, layer kind precedence, labeller design, Claude-on-Claude judging, differential vs absolute clean, review cuts, verdict thresholds, timeline).
**Security**: review F1/F12 strengthen SECURITY-12 and SECURITY-03 handling (credential route decision; NFR-08 scrubbing test). No blocking finding.
**Context**: Workflow Planning APPROVED (rev. 2). Application Design IN PROGRESS, GATE on design questions.

---

## v1.2 Evaluation-Readiness — Application Design answers
**Timestamp**: 2026-10-06T18:30:00Z
**User Input**: "recommended for all, then continue; once the plan is set we set up an ultracode workflow"
**AI Response**: Filled all ten [Answer]: tags with A. Ambiguity analysis: none (single options, mutually consistent: Claude Code headless CLI credential route; Semantic per file, Integrity per module; type-only imports counted and flagged; kind precedence explicit > name > position; one Gemini labeller run twice; Claude judge kept with a Phase 5 Gemini cross-check; differential clean status; review cuts accepted with FR-20 kept; thresholds kept and described; 25-30 days). Generating the design artefacts with a multi-agent workflow (ultracode opt-in): four writers, three verification lenses, one repair pass, one consolidation.
**Context**: Application Design — gate passed; artefact generation in progress.

---

## v1.2 Evaluation-Readiness — Application Design artefacts generated
**Timestamp**: 2026-10-06T22:40:00Z
**User Input**: "continue as soon as it finishes"
**AI Response**: Multi-agent workflow (run wf_f1754876-091; first launch interrupted by a usage limit with no output, relaunched) generated `inception/application-design/v1.2E-components.md`, `v1.2E-component-methods.md`, `v1.2E-services.md`, `v1.2E-component-dependency.md` and the consolidated `v1.2E-application-design.md`. Verification: coverage lens 15 issues, consistency lens 17 (4 blocking), code-reality lens 11 (1 blocking); repair applied all 43 after re-checking each. Main resolutions: one report-assembly design (AssembleReportCommand + buildEvaluationReport); one revised LLM port (model required, usedOptions/ignoredOptions, describe(), effort incl. xhigh); RE_EXPORTS as a ninth edge type; ProcessRunner in C10 so C15 does not depend on C14; multiple application layers bound as $applicationLayers list; differential matching by baselineMatchKey without line; judge_unit file/class/module; single scrubber with allow-listed child environment. Requirement text aligned for FR-21 (via new | field-assignment) and FR-28 (Claude Code CLI). Open for Functional Design: Claude CLI JSON field names, pinned Gemini id, whether orphan checks count RE_EXPORTS, budget and cap values, generator tool permissions.
**Security**: SECURITY-11/13 condition for U5 — the generator must not run with an unrestricted Bash tool on the host; Functional Design U5 must restrict tools (file write/edit only) and confine the working directory. Not blocking at design level. Other rules as in the consolidated summary.
**AI Prompt**: Approval of Application Design requested.
**Context**: Application Design COMPLETE, awaiting approval.

---

## v1.2 Evaluation-Readiness — Application Design approval; Units Generation Part 1
**Timestamp**: 2026-10-07T09:00:00Z
**User Input**: "approve the design and continue to units generation"
**Status**: Application Design APPROVED.
**AI Response**: Loaded inception/units-generation.md. Created `inception/plans/v1.2E-unit-of-work-plan.md` with seven proposed units (U0, U1, U2, U3, U4, U5a, U5b, taken from the approved build order) and four questions (split U5; branching and integration; units in flight; requirement map instead of story map). Gate: awaiting answers.
**Context**: Units Generation Part 1 IN PROGRESS.

---

## v1.2 Evaluation-Readiness — Units Generation
**Timestamp**: 2026-10-07T09:30:00Z
**User Input**: "recommended for all, then continue"
**AI Response**: Filled the four answers with A (U5 split into U5a/U5b; integration branch v1.2e with per-unit branches and worktrees; dependency lanes; requirement map instead of story map). No ambiguities. Treated "then continue" as approval of the unit-of-work plan. Generated `v1.2E-unit-of-work.md`, `v1.2E-unit-of-work-dependency.md`, `v1.2E-unit-of-work-requirement-map.md` (36 FR + 8 NFR, one owner each, FR-17 deferred). All plan checkboxes ticked.
**AI Prompt**: Approval of Units Generation requested.
**Context**: Units Generation COMPLETE, awaiting approval.

---

## v1.2 Evaluation-Readiness — Units approved; U0 planning starts
**Timestamp**: 2026-10-07T10:00:00Z
**User Input**: "approve units and start U0 with the ultracode workflow"
**Status**: Units Generation APPROVED.
**AI Response**: Loaded construction/code-generation.md. U0 skips Functional Design (contracts fixed in Application Design); the execution plan places a light NFR Requirements pass in U0. Launched a multi-agent workflow (ultracode opt-in) that scouts four areas, drafts the U0 NFR note and code-generation plan, verifies them under three adversarial lenses, and repairs. No source changes until the plan is approved.
**Context**: CONSTRUCTION — U0 Part 1 (planning) IN PROGRESS.

---

## v1.2 Evaluation-Readiness — U0 plan ready
**Timestamp**: 2026-10-07T11:00:00Z
**AI Response**: Workflow wf_857e41f5-f98 produced `construction/v1.2E-u0-foundation/nfr-requirements/nfr-requirements.md` and `construction/plans/v1.2E-u0-foundation-code-generation-plan.md` (32 steps). Verification: neutrality 3 issues, completeness 7, executability 10 (1 blocking: CI cannot run while package-lock.json is gitignored). Repair applied the verified issues (lock tracked unchanged before the golden baseline is proven in CI; emitted-order snapshots; LayerKindBinding matches the design; CLI config tests; hand-offs recorded in design docs; lint found broken at HEAD and handled as a ratchet). New finding recorded: `npm run lint` fails at HEAD.
**AI Prompt**: "U0 code-generation plan complete. Review the plan. Ready to proceed to generation?" Approval includes pushing branches v1.2e and v1.2e/u0-foundation to origin so CI can run the golden suite.
**Context**: U0 Part 1 complete, awaiting approval.

---

## v1.2 Evaluation-Readiness — U0 plan approved; Part 2 starts
**Timestamp**: 2026-10-07T12:00:00Z
**User Input**: "approve the U0 plan and push, start generation"
**Status**: U0 code-generation plan APPROVED (decisions D-U0-1..17 as recommended). Push of `v1.2e` and `v1.2e/u0-foundation` to origin AUTHORISED; `main` untouched.
**AI Response**: Starting U0 Part 2. Steps 1–9 (branches, Neo4j smoke, baselines, lock, golden suite, CI-proven baseline) executed directly because they share git, Docker and CI state; Steps 10–29 run as a sequential multi-agent workflow (implement → gate check → adversarial review per step); Steps 30–32 closed directly.
**Context**: CONSTRUCTION — U0 Code Generation Part 2 IN PROGRESS.

---

## v1.2 Evaluation-Readiness — U0 Part 2 executed
**Timestamp**: 2026-10-07T21:30:00Z
**User Input**: "how is this going?" (status check during execution; answered with progress)
**AI Response**: Steps 1–9 executed directly (GOLDEN_BASE f5fed3f, CI-proven baseline run 37679924705). Steps 5–7 via workflow wf_2b2020c6-003 (implement, three adversarial reviews, repair). Steps 10–29 via workflow wf_2787b3e4-051 (six groups, each implement → adversarial verify; all passed without fix rounds). Steps 30–32 executed directly. Exit: 592 tests green, golden 8/8 with snapshots unchanged, Gate B 85, lint 624 ≤ 626, CI green on ebefd92. Deviations recorded in the code summary (branch names v1.2e-<unit>, pinned local image digest, Steps 5–7 in one commit, lint version/rule rename). Pull request v1.2e-u0-foundation → v1.2e opened for the PR-CI exit check; not merged.
**AI Prompt**: Code Generation completion (2-option) for U0.
**Context**: CONSTRUCTION — U0 Code Generation COMPLETE, awaiting approval.

---

## v1.2 Evaluation-Readiness — U0 approved and merged
**Timestamp**: 2026-10-07T21:30:00Z
**User Input**: "yes aprove whats the next step?"
**Status**: U0 Code Generation APPROVED.
**AI Response**: Merged PR #1 (v1.2e-u0-foundation → v1.2e) as merge commit 2050193. Next stage: lane 2 — Functional Design for U1 (spec + compiler) and U2 (extractor + graph), one plan with questions per unit; parallel worktrees once their code plans are approved.
**Context**: CONSTRUCTION — U0 COMPLETE; lane 2 next.

---

## v1.2 Evaluation-Readiness — Lane 2 Functional Design starts
**Timestamp**: 2026-10-07T21:40:00Z
**User Input**: "use ultracode and subagents to progress on this"
**AI Response**: Loaded construction/functional-design.md. Launched a multi-agent workflow for U1 and U2 in parallel: code scouts per unit, a drafter that writes the functional-design plan with [Answer]: questions (recommended option first, with code evidence), an adversarial reviewer, and a repairer. Gate: user answers both question files.
**Context**: CONSTRUCTION — Functional Design U1, U2 Part 1 (plan + questions) IN PROGRESS.

---

## v1.2 Evaluation-Readiness — Lane 2 Functional Design plans ready
**Timestamp**: 2026-10-07T22:10:00Z
**AI Response**: Workflow wf_80205bff-95d (10 agents) wrote `construction/plans/v1.2E-u1-spec-compiler-functional-design-plan.md` (24 questions; review raised 22 issues, all fixed) and `construction/plans/v1.2E-u2-extractor-graph-functional-design-plan.md` (17 questions; 18 review issues fixed). Cross-unit note: U2 Q6A hands RE_EXPORTS-following dependency templates to U1, which has no matching question; to be added to U1 under FR-34 if accepted.
**AI Prompt**: Answer both question files (or "recommended for all").
**Context**: CONSTRUCTION — Functional Design U1, U2 awaiting answers.

---

## v1.2 Evaluation-Readiness — Lane 2 adversarial review of recommended options
**Timestamp**: 2026-10-07T22:45:00Z
**User Input**: "Can you generate an adversarial suggestion on all the relevant design choices and hand them to me?"
**AI Response**: Three parallel reviewers (U1 Q1–12, U1 Q13–24, U2 Q1–17) attacked every recommended option against code, corpus clones and Neo4j EXPLAIN. Consolidated in `construction/plans/v1.2E-lane2-functional-design-adversarial-review.md`: 5 keep, 29 keep-with-condition, 7 switch (U1 Q3, Q8, Q14, Q21, Q22, Q24; U2 Q13); 8 factual errors in the plans; new U1 Q25 proposed; pre-registration rule for observation-vs-fix proposed. Advisory only; question files unanswered.
**Context**: CONSTRUCTION — Functional Design U1, U2 awaiting answers.

---

## v1.2 Evaluation-Readiness — Lane 2 decisions; ADR-015; answers filled
**Timestamp**: 2026-10-07T23:10:00Z
**User Input**: "Okay let's go this way. Let's generate an ADR so we keep track of the decisions we are generating here and then progress with the plan."
**Intent**: Prioritise only decisions that affect producing the promised objective results (SO1–SO5) and a sound evaluation; default everything else; record decisions durably.
**AI Response**: Added ADR-015 to `Docs/ADR — Architectural Decision Records Firewall Tech.md` (pre-registered fix/observe rule; frozen choices; corpus = Docs/corpus.md five, specs versioned; cycle bound literal + same bound in universal metric + latency gate/SCC fallback; intent→integrity weight; package-existence check; RE_EXPORTS traversal with byte-identical IMPORTS messages; operational tags; FF-CV02/FF-S03 corrections; FR-19/FR-20 met not reworded; merge order U2→U1; all else default A). Filled all [Answer]: tags (U1 25 incl. new Q25, U2 17), each citing ADR-015. No ambiguous answers remain. Proceeding to Functional Design Part 2 (artefact generation) via workflow.
**Context**: CONSTRUCTION — Functional Design U1, U2 answers complete.

---

## v1.2 Evaluation-Readiness — Standing approval granted
**Timestamp**: 2026-10-08T00:30:00Z
**User Input**: "okay then keep on it use ultracode where it fits, and dont stop until we have results"
**Intent**: Standing approval for all remaining AI-DLC gates of the cycle (Functional Design, code-generation plan, code generation, merge into v1.2e for U1–U5b; Build and Test) and for running the experiments that produce the thesis results. Agents proceed without pausing at each gate.
**Conditions recorded by the AI** (stated to the user in the previous turn): a stage is auto-approved only when its adversarial verification reports no blocking or major issue; design questions are answered by the ADR-015 criterion (choices that change whether promised results can be produced and defended take the verified-best option; all else the recommended default) and recorded in an ADR; genuine cross-unit conflicts, any change to requirement text beyond ADR-recorded amendments, and anything touching `main` are escalated to the author; every merge into v1.2e is summarised in this log. The author's 30-item audit remains the author's.
**Context**: CONSTRUCTION — lane 2 Functional Design generation running (wf_fe5a2f01-c23).

---

## v1.2 Evaluation-Readiness — Lane 2 Functional Design complete (auto-approved)
**Timestamp**: 2026-10-08T01:30:00Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; settlements of the lane-2 open items delegated by the author)
**Intent**: Close the U1 and U2 functional designs, record the delegated settlements, and make the U1 and U2 records agree before code-generation planning.
**AI Response**: The U1 Spec and Compiler design has 45 business rules (BR-U1-01..45) at verification, and adversarial verification found 20 issues, all fixed. ADR-016 a adds BR-U1-46 (`controllerLayer`, commit K16, no fixture delta). The U2 Extractor and Graph design has 46 rules (BR-U2-01..46), and verification found 9 issues, all fixed. ADR-016 f adds BR-U2-47 (Interface→Method `CONTAINS`). ADR-016 ("Lane-2 functional-design settlements") was appended to `Docs/ADR — Architectural Decision Records Firewall Tech.md`, with a summary-table row. It settles: a) NestJS controller checks bind presentation; b) cannot-fire checks are decided by the Build and Test sensitivity check; c) U3 routes compiler warnings; d) the `layered` business forbidden list = the clean-architecture list; e) a 30 s cycle-query budget on ghostfolio, else SCC fallback; f) Interface→Method `CONTAINS` in U2; g) the universal orphan metric has no layer filter; h) the probe script is committed by U2 code generation; i) S-1..S-7 and S-9 are confirmed. The new record `construction/plans/v1.2E-lane2-functional-design-clarifications.md` covers the FR-19, FR-29, FR-20 and FR-08/FR-20 amendments, the U2 FR-21/FR-14 amendments with the BR-U2-30 disclosure, S-1..S-9, ADR-016 a–i, and the record corrections. Record corrections applied:
- Q24 answer moved under Q24.
- U2 G7, §10 row 2 and the built-in row fixed.
- U2 G1–G4 aligned to U1 labels K4, K12 and K13.
- New G8 row for FF-SO02.
- U1 §8.2 AHS recomputed for variant-b and variant-c (final .595 / .412; verdicts unchanged).
- Identical orphan-rule text in U1 and U2.
Plan checkboxes ticked. Auto-approved under standing approval; no blocking or major verification issue remains.
**Context**: CONSTRUCTION — lane 2 Functional Design COMPLETE (U1, U2); next: code-generation plans U2, then U1.

---

## v1.2 Evaluation-Readiness — Lane 2 code-generation plans complete (auto-approved)
**Timestamp**: 2026-10-08T02:30:00Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z)
**Intent**: Close the U2 and U1 code-generation plans and open the per-unit worktrees for lane-2 code generation.
**AI Response**: Code-generation plans written for U2 Extractor and Graph (`construction/plans/v1.2E-u2-extractor-graph-code-generation-plan.md`) and U1 Spec and Compiler (`construction/plans/v1.2E-u1-spec-compiler-code-generation-plan.md`). Adversarial review found 12 issues in the U2 plan and 14 issues in the U1 plan, all fixed. Auto-approved under standing approval; no blocking or major review issue remains. Worktrees `v1.2e-u2-extractor-graph` and `v1.2e-u1-spec-compiler` are created from origin/v1.2e for code generation.
**Context**: CONSTRUCTION — lane 2 Code Generation planning COMPLETE (U2, U1); next: code generation U2 and U1 in worktrees.

---

## v1.2 Evaluation-Readiness — Lane 3/4 Functional Design plans; escalations accepted
**Timestamp**: 2026-10-08T03:30:00Z
**User Input**: "accept all"
**AI Response**: Workflow wf_b74b3ea7-f1a produced answered Functional Design plans for U3 (11 Q, 16 review issues fixed), U4 (19 Q, 18 fixed), U5a (16 fixed), U5b (16 fixed). Seven escalations presented; author accepted all. Recorded as ADR-017 (corpus core + 3–5 E7 projects; SO5 in scope; ADR-011 superseded by the E1 grid; SO4 domain-layer remap pre-registered; FR-11 RE_EXPORTS; FR-25 per tag; FR-27 agreement pairs; SECURITY-11 on generator; U4 halt condition). Requirement text amended with dated notes. Next: Functional Design Part 2 for U3/U4/U5a/U5b while lane 2 builds.
**Context**: CONSTRUCTION — lanes 3/4 Functional Design plans complete.

---

## v1.2 Evaluation-Readiness — Lanes 3/4 Functional Design and code-generation plans complete (auto-approved)
**Timestamp**: 2026-10-08T05:00:00Z
**User Input**: None (standing approval; author's "accept all" of 2026-10-08T03:30:00Z)
**Intent**: Close Functional Design Part 2 and the code-generation plans for U3, U4, U5a and U5b.
**AI Response**: Functional designs written under `construction/v1.2E-u3-evaluation-scoring-report/`, `v1.2E-u4-neural-path/`, `v1.2E-u5a-mutation-manifest-generator/`, `v1.2E-u5b-scoring-harness/`, and code-generation plans under `construction/plans/`. Adversarial review issues found and fixed: U3 design 14, plan 7; U4 design 13, plan 14; U5a design 13, plan 8; U5b design 10, plan 9. Auto-approved under standing approval; no blocking or major review issue remains.
**Context**: CONSTRUCTION — lanes 3/4 Functional Design and Code Generation planning COMPLETE (U3, U4, U5a, U5b); next: code generation after lane 2 lands.

---

## v1.2 Evaluation-Readiness — U2 Extractor and Graph Code Generation complete and merged (auto-approved)
**Timestamp**: 2026-10-08T05:35:18Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z)
**Intent**: Close U2 Code Generation: verify the merged v1.2e and record completion.
**AI Response**: PR #2 (v1.2e-u2-extractor-graph → v1.2e) merged with a merge commit, f7ae34b (no squash, rebase or force-push; main unchanged at 7cd15b4). Post-merge gates on the merged tree in the main checkout: typecheck clean; 808 tests / 63 suites passed; lint 624 errors / 3 warnings (≤ 624 baseline); test type-error budget 85 (unchanged); golden 3 suites / 17 passed / 0 skipped with snapshots unchanged at f5fed3f and hashes equal (G0, ADR-015 item 12). Gate G-CI: merge push run 37732537181 green. Plan steps 0–24 ticked with Done notes and deviations. The U2 worktree is kept for the orchestrator to remove. Auto-approved under standing approval; no escalation.
**Context**: CONSTRUCTION — lane 2 Code Generation: U2 COMPLETE and merged; next: U1 rebases or merges onto v1.2e.

---

## v1.2 Evaluation-Readiness — U1 merged into v1.2e (auto-approved)
**Timestamp**: 2026-10-08T09:50:00Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z)
**Intent**: Close U1 Code Generation: merge the U1 Spec and Compiler branch into v1.2e and record completion; lane 2 complete.
**AI Response**: U1 merged into v1.2e (auto-approved). PR #3 (v1.2e-u1-spec-compiler → v1.2e) merged with a merge commit, eee25fbec418b40cda05fac9b859c095914e9cdc (parents cea1e7c, f08b864; no squash, rebase or force-push; main unchanged at 7cd15b4). Code summary extended with the realised-vs-predicted golden-change table (all K1–K16 match business-logic-model.md §8.2 to 3 dp), every U1 CHANGES.md line verbatim, and the post-U1 per-fixture table. PR CI run 37758444791 green: Build & Test, Golden regression suite 38/38 (0 skipped), Golden change log; merge push run 37758784666 green. Interim post-U1 AHS/verdicts (never quoted as results, BR-U1-42): correct-reference 0.958 pass; variant-a-structural 0.422 hard-block; variant-b-pattern 0.595 soft-block; variant-c-everything 0.412 hard-block; variant-d-subtle 0.538 soft-block. Hand-offs to U3/U4/Build and Test recorded in v1.2E-unit-of-work.md. The U1 worktree is kept for the orchestrator to remove. No escalation.
**Context**: CONSTRUCTION — lane 2 Code Generation COMPLETE (U2, U1); next: lanes 3/4 code generation.

---

## v1.2 Evaluation-Readiness — U4 pre-patch merged (auto-approved)
**Timestamp**: 2026-10-08T11:45:36Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z)
**Intent**: Remove the `dimension === 'intent'` branch from src/llm-critic/llm-critic.ts so U3 plan Step 19 (Group 7 entry check) can proceed; pre-agreed U4 patch (U4 owns the file).
**AI Response**: U4 pre-patch merged (auto-approved). PR #4 (v1.2e-u4-intent-prepatch → v1.2e) merged with a merge commit, 94a63c4af3433100154faafb0c2d816dfcd0e5bd. Violation type now follows BR-U4-VIO-03 (ADR-015 item 6): source 'adr' → INTENT_VIOLATION; dimension 'integrity' → INTEGRITY_VIOLATION; otherwise SEMANTIC_RULE_VIOLATION; BR-U4-VIO-03 three-case table test added. Gate T clean; Gate U 94 suites / 1280 tests; golden suite 38/38 against main Neo4j with snapshots unchanged (no CHANGES.md line). PR CI Build & Test green (runs 37771817326, 37771824903). Read-back: `git grep "dimension === 'intent'" origin/v1.2e -- src/llm-critic` empty. Remaining BR-U4-VIO-03 item (C10 comment text on INTENT_VIOLATION) left to U4. Pre-patch worktree removed. No escalation; main unchanged.
**Context**: CONSTRUCTION — U4 pre-patch for U3 Step 19; U3 Group 7 unblocked.

---

## v1.2 Evaluation-Readiness — U4 Group 1 Gate H subscription probe (Steps 2–6)
**Timestamp**: 2026-10-08T12:35:06Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; the author completed the Step 2 subscription /login into the judge config dir)
**Intent**: Run the U4 Part 2 probe (Steps 2–6) and decide Gate H before any U4 worktree or code.
**AI Response**: Gate H PASS on H1–H5. H1: judge call under the dedicated CLAUDE_CONFIG_DIR, env -i allow-list and neutral cwd exited 0 with is_error false. H2: apiKeySource none and mcp_servers []. H3: every frozen flag accepted. H4: canary tokensFound neutral [] and ancestor []; the positive control fired on the ancestor channel only (variant: real HOME plus the judge dir, no isolation flags, because the throwaway home cannot authenticate). The user CLAUDE.md and hook channels were not positively controlled. H5: the structured_output field is present. [PROBE] values: toolsFlag true; modelUsage with camelCase keys and no alias suffix; PINNED_CLI_VERSION 2.1.294 (the CLI auto-updated from 2.1.293 during the login); auto-update is switched off by DISABLE_AUTOUPDATER=1, which must join JUDGE_ENV_ALLOW (not applied to the author's global install); AUTH is classified on is_error plus the result text "Not logged in" (subtype stays success); USAGE_LIMIT patterns are unverified. Timing medians: high 6570 ms, medium 5736 ms. Scrubbed evidence in ~/.firewall/u4-probe/out passes Gate X. Escalation: ISO-04 conflict. The CLI auto-installed the official plugin marketplace (plugins/**) into the judge dir at login, and settings.json is CLI-created; the author must choose between a re-login without the marketplace and an ISO-04 amendment before Step 7.
**Context**: CONSTRUCTION — U4 Code Generation Group 1 (Gate H) complete; plan Steps 2–6 ticked with the Done note; Step 7 waits on the ISO-04 decision.

---

## U4 Gate H — ISO-04 resolution
**Timestamp**: 2026-10-08T12:40:00Z
**User Input**: "logged in" / "done" (author completed the subscription login into the dedicated judge config dir)
**AI Response**: "Gate H passed H1–H5 (8bbd2cc). The judge dir broke the ISO-04 allow-list (marketplace plugins, settings.json, per-call projects/*/memory). Resolved under the standing approval as ADR-018: plugins/ removed and the judge call re-verified; allow-list values filled; settings.json content rule; CLI pinned at 2.1.294 with DISABLE_AUTOUPDATER in the child env. U4 proceeds to Step 7 after U3 merges."
**Context**: CONSTRUCTION, U4 Code Generation Part 2, Group 1 exit

---

## v1.2 Evaluation-Readiness — U3 merged into v1.2e (auto-approved)
**Timestamp**: 2026-10-08T13:47:05Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z)
**Intent**: Finish U3 Code Generation Group 11 (Steps 30–34): record hand-offs and the code summary, verify exit, open the PR into v1.2e, merge on green CI, verify the merged tree.
**AI Response**: U3 merged into v1.2e (auto-approved). PR #5 (v1.2e-u3-evaluation-scoring-report → v1.2e) merged with a merge commit, c4d7bc49e11126e4015c72f68fd4233161bb49b7 (parents ecf0184, 13785cf; no squash, rebase or force-push; main unchanged at 7cd15b4). Tests: Gate U 1712 / 119 suites (base 1277 / 94); Gate G 74 executed, 0 skipped; L 558 (≤ 575); B 85; Gate P 0 at every commit. Golden changes: snapshots changed only in U3-R2 (a, b, c, d), U3-R4 (all five), U3-R5 (b, c), U3-R6 (all five), U3-R7 (all), U3-R8 (d), U3-R9 (all), each with one attributed tests/golden/CHANGES.md line; change-log checker green on PR CI (138 commits); final AHS .958 / .442 / .575 / .391 / .558, verdicts pass / hard-block / soft-block / hard-block / soft-block (failing sets as the binding table). CI: PR run 37786297526 green incl. Golden change log; merge push run 37786728598 green. Post-merge in the main checkout: T clean, U 1712 / 119, G 74 / 0 skipped under the 7687 lock, 7 U3-R snapshot commits on v1.2e. Deviations recorded in the plan: Step 32 scope allow-list prints the two already-attributed files (R11 neo4j-repository.ts shared-scrub call, R7 dimension-alias.ts type fix); Step 34 container/worktree cleanup deferred to the orchestrator's word. Open hand-offs (code/handoffs.md): U4 H8–H11, U5a H3–H4, lane-2 record owner H14–H15, lane-3 record owner H6/H16, Build and Test H13.
**Context**: CONSTRUCTION — lane 3, U3 Code Generation COMPLETE and merged; next: U4 and U5a code generation, then U5b.

---

## v1.2 Evaluation-Readiness — U5a merged into v1.2e (auto-approved)
**Timestamp**: 2026-10-08T14:39:28Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z)
**Intent**: Finish U5a Code Generation Group 10 (Steps 35–37): code summary, exit checks, PR into v1.2e, merge on green CI, record completion.
**AI Response**: U5a merged into v1.2e (auto-approved). PR #6 (v1.2e-u5a-mutation-manifest-generator → v1.2e) merged with a merge commit, 23a2055f386618c7b31f030c9dde8b93f3b56e17 (parents 3c4f435, 6aaab7b; no squash, rebase or force-push; main untouched). Before the exit checks origin/v1.2e (U3) was merged into the unit branch (0748b83; schemas.test.ts resolved per D-U5a-6) and U5a-owned files aligned with FF-P06 (ed32c02: MO-DF01 FF-P06 key, SP-DF01-ci resolves, full-aac preset re-embedded with protocol hashes updated, BR-U3-66 discriminator test for U3 H4) — DV-U5a-25. Tests: Gate U 2155 / 152 suites (v1.2e 1712 / 119 + 443 U5a tests in 33 suites), 0 failed, 0 skipped; Gate G 74 executed / 6 suites, 0 skipped on lane 7691; L 558 (= v1.2e); B 85; T clean; S empty; P 0 at every commit. Golden changes: none (snapshots byte-identical to v1.2e, no tests/golden/CHANGES.md line; change-log checker run locally against origin/v1.2e ok — the CI step is scoped to U1/U3/U4 head refs). CI: PR head runs 37792356596 / 37792363516 green; merge push run 37793341718 green. Step commits: 35 55572f8, 36 6aaab7b, 37 no content commit (tick recorded here). Open: DV-U5a-22 author decision at the freeze review (BR-U5a-37 cap on a k = 2 total); U5b hand-offs OI-U5a-5, 12, 16, 17; lane-3 record owner OI-U5a-4 and U3 H16 (b); Build and Test obligations 1–10 in the code summary. U3 handoffs H3/H4 closed by U5a (handoffs.md row update pending the orchestrator).
**Context**: CONSTRUCTION — lane 3, U5a Code Generation COMPLETE and merged; next: U4 code generation, then U5b.

---

## v1.2 Evaluation-Readiness — U5b Group 1 (Steps 0–2): plan, worktree and baselines
**Timestamp**: 2026-10-08T14:49:00Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator started U5b Group 1 after the U3 and U5a merges)
**Intent**: Record the U5b plan commit, check the U5b entry conditions, create the worktree and unit branch, and measure the gate baselines before any U5b code.
**AI Response**: Group 1 complete. Step 0: plan already on v1.2e in f7aa173 (PLAN_SHA); tick commit 76f04f4. Step 1: U3 (c4d7bc4) and U5a (23a2055) merges are ancestors; U5B_BASE = 76f04f4; worktree DaedalusArch-wt-u5b on v1.2e-u5b-scoring-harness (npm ci, pushed); tick commit 83b5c81. Step 2: lane container daedalus-neo4j-u5b on 127.0.0.1:7692 (bolt) and 7478 (http), CI-pinned digest; Gate T clean; Gate U 2155 tests / 152 suites (scripts subset 426 / 34); Gate L 558 errors, 2 warnings (scripts lint 1 pre-existing error); Gate B 85, 0 TS2688; Gate G N_G = 74, 0 skipped, snapshot hashes recorded, no src or golden diff; OI-2 both flags true; OI-9 and OI-10 settled, OI-11 open (U4); tick commit b3ad298. Unit-branch CI on 76f04f4 green (2140 + 15 unit, 74 golden). Deviations DV-U5b-1..5 recorded in the plan (Step 0 no content commit; no separate scripts jest project; BaselineSelection is U4's and is checked at Step 26; lane 7692 instead of 7689; lane-specific Gate B scratch config). No snapshot change, no CHANGES.md line.
**Context**: CONSTRUCTION — U5b Code Generation Part 2, Group 1 done; next Group 2 (Steps 3–5, G-CI).

---

## v1.2 Evaluation-Readiness — U5b Group 2 (Steps 3–5): setup and shared libraries
**Timestamp**: 2026-10-08T15:26:26Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator started U5b Group 2)
**Intent**: Add the U5b devDependencies and npm scripts, then the canonical JSON, report acceptance and statistics libraries with their tests, keeping every golden snapshot unchanged.
**AI Response**: Group 2 complete on v1.2e-u5b-scoring-harness. Step 3 af39e24: vega ^6.4.0 and vega-lite ^6.5.0 devDependencies with the lock; npm ls canvas empty; npm audit 37 high before and after (no new advisory); u5b:* npm scripts; smoke test; tsconfig.scripts.json and jest config already cover U5b by glob (DV-U5b-6). Step 4 56ff406: scripts/lib/canonical-json.ts (BR-U5b-26), 8 tests. Step 5 654d498: scripts/lib/report-io.ts (RunRecord types, loadRun, acceptReport with the six BR-U5b-45 reason codes and the U4 actual-model rule), scripts/lib/stats.ts (seeded RNG, Wilson, Clopper–Pearson, cluster bootstrap, within-block permutation, Cohen κ, Gwet AC1, Fleiss κ, Holm, Cliff δ, BR-U5b-61 interval rule), static import whitelist test (BR-U5b-55; type-only src/shared/types imports allowed, DV-U5b-7); 37 tests. Gates at Step 5: T clean; U 2201 / 157 suites (2155 + 46 U5b); L 558 (= baseline), new U5b files 0; B 85, 0 TS2688; G 74 executed, 0 skipped, src and tests/golden diffs empty, snapshot hashes equal to U5B_SNAPSHOT_HASHES; P 0 at every commit. Gate G-CI: runs 37797471306 (Step 3) and 37800013681 (Step 5) green. Golden changes: none, no CHANGES.md line. Open: OI-U5b-P2-1 (CI lacks tsc -p tsconfig.scripts.json; .github outside the U5b allow-list), OI-U5b-P2-2 (vega ESM-only, Step 16 uses dynamic import).
**Context**: CONSTRUCTION — U5b Code Generation Part 2, Group 2 done; next Group 3 (Steps 6–10, G-CI).

---

## v1.2 Evaluation-Readiness — U4 Group 6 (Steps 21–25): critic, router, provenance, report rows
**Timestamp**: 2026-10-08T15:38:51Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator started U4 Group 6 after U3 PR #5 merged)
**Intent**: Merge v1.2e into the unit branch (D-U4-13), wire the critic to real units with U3's computeViolationId, align the router with BR-U3-15/53, add judge provenance and the neural result rows, and apply the C9 hunks to the U3-owned files on the unit branch because U3 had already merged.
**AI Response**: Group 6 complete on v1.2e-u4-neural-path. Merges ce3f3d8 and 704fbcb (evaluation.ts conflict resolved as the union of U3-R1 and U4-K1 hunks); re-recorded U4_BASE 83b5c81, U_BASE 2155, L0_U4 558, B0_U4 85, N_G_U4 74. Step 21 f602422 (U4-K4: loadJudgeGraphView on U2 names filePath/DECLARES, critic with selection, pool, stop flow, RunManifest, aggregation, computeViolationId, JUDGE_NO_UNITS context.functionId). Step 22 810efdf (U4-K5: filterByMode keeps totalCompiled, hybrids only in full mode, no neural half after a failed or violating symbolic half, failures forwarded). Step 23 cfcf404 (U4-K7: judgeProvenanceOf; replay through ClaudeCliProvider with PATH emptied, zero spawns). Step 24 232f57f (toNeuralResultRows, readBaselineSelections, schema equal to U3's frozen rows). Step 25 73420f4 (C9 hunks in cli.ts, pipeline-factory.ts, route/neuronal evaluate commands as one attributed cross-unit commit, no hand-off branch; cli-llm-config test rewritten; ANTHROPIC_API_KEY and gemini-2.0-flash absent from src/). Gates at Step 25: T clean; U 2551 / 169 suites; L 497 (<= 558); B 80 (<= 85), 0 TS2688; G 74 executed, 0 skipped, snapshot and CHANGES.md diffs empty, hashes unchanged. Gate G-CI: runs 37799690179 (232f57f) and 37801622120 (73420f4) green. Golden changes: none, no CHANGES.md line. Open: ADR prose not wired into the critic (Build and Test); U1 k14 test prefix (Step 11).
**Context**: CONSTRUCTION — U4 Code Generation Part 2, Group 6 done; next Group 7 (Steps 26–27).

---

## v1.2 Evaluation-Readiness — U4 Group 6 review follow-up (judge stage secrets, provenance warning, disposal)
**Timestamp**: 2026-10-08T16:02:32Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator passed the Group 6 review findings: 1 major, 3 minor, 1 info)
**Intent**: Fix the C9 wiring so the cassette scrubber keeps the env-derived secrets (BR-U4-CAS-07), emit the mixed-provenance warning (BR-U4-CAS-10), dispose the Claude CLI neutral cwd on every path (BR-U4-ISO-05), and correct the Step 21/25 bookkeeping.
**AI Response**: Follow-up commit e4feed7 on v1.2e-u4-neural-path (no history rewrite). Major CAS-07 fixed: judgeKnownSecrets() unites knownSecretsFrom(process.env) with the Neo4j policy secrets, used by pipeline-factory for the judge stage, router and critic. CAS-10 fixed: finishJudgeStage returns JUDGE_PROVENANCE_MIXED and both evaluation commands add it to the context. ISO-05 fixed: both commands dispose the inner ClaudeCliProvider in a finally; judgeStageNeeded() skips the record-mode pre-flight when no neural work exists (report then carries NO_JUDGE). Bookkeeping fixed: Step 25 hand-off-branch ticks annotated as superseded; Step 21 deviation (5) corrected. Info item (U3 cli.test.ts NEO4J_URI sensitivity): no U4 action; Gate U already runs with NEO4J_URI unset. Tests c9-hunks +9 (no U3-owned test touched). Gates: T clean; U 2560 / 169 suites; L 497 (<= 558); B 80 (<= 85); G 74 executed, 0 skipped, snapshot and CHANGES.md diffs empty, hashes unchanged. CI run 37805024158 green (unit 2545 + integration 15, golden 74, lint 497). No merged PR touched, so no follow-up PR.
**Context**: CONSTRUCTION — U4 Code Generation Part 2, Group 6 review follow-up done; next Group 7 (Steps 26–27).

---

## v1.2 Evaluation-Readiness — U5b Group 3 (Steps 6–10): matching rule and differential scorer
**Timestamp**: 2026-10-08T16:24:17Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator started U5b Group 3)
**Intent**: Write the pre-registrable matching rule, commit the hand-computed scoring case before any scorer code, then build the differential scorer core, its rule order and edge cases, strata, evidence and sensitivity probes, and prove it reproduces the hand-computed case byte for byte, keeping every golden snapshot unchanged.
**AI Response**: Group 3 complete on v1.2e-u5b-scoring-harness. Step 6 e8e6b0a: Docs/matching-rule.md (draft until Step 32; MAT rules BR-U5b-01..27, 78; 12 root causes; mechanical FN rules; audit allocation; yaml machine block version 1.0.0) and scripts/lib/matching-rule.ts (SCORE_RULE_MISMATCH, RootCauseCode); 7 tests. Step 7 1fa0caf: tests/fixtures/u5b/hand-computed (U5a mutate rows MO-S01 on the F-U5A-CYCLE site, MO-C04, MO-DF01, MO-DF01n; scrubbed symbolic-only reports and RunRecords from the lane Neo4j 7692; EXPECTED.md; hand-written expected.canonical.json); OI-9 and OI-10 confirmed settled. Step 8 28d1e26: scripts/score-golden.ts and -cli.ts (first commit of the scorer; keys, multiset difference, detection, count-once, collateral, FP-strict/labelled, computePrf, input rejection); 27 tests. Step 9 984f4bc: rule order and edge cases (not-applicable, site-invalid, metric crossing with spec thresholds, metric-key exclusions, twins/specificity, SCC overlap, neural judge collateral); 16 tests. Step 10 993fbde: strata, FLOWS_TO evidence, judge probes, denominators with I1/I2, SP-* function sensitivity, byte-for-byte hand-computed acceptance and the literal BR-U5b-27 git provenance test (F 1fa0caf older than and ancestor of A 28d1e26); 14 tests. Gates at Step 10: T clean; U 2265 / 163 suites (2155 + 110 U5b); L 558 (= baseline), U5b files 0; B 85, 0 TS2688; G 74 executed, 0 skipped, src and tests/golden diffs empty, snapshot hashes equal to U5B_SNAPSHOT_HASHES; P 0 at every commit. Gate G-CI: run 37807321755 green (unit 2250 + integration 15, golden 74, audit 37 high unchanged, lint under continue-on-error). Golden changes: none, no CHANGES.md line. Deviations: DV-U5b-8 (hand-computed manifest scrubbed of the absolute typecheck.tscPath, no scored field changed), DV-U5b-9 (GoldenScore canonical form adds denominators and dimension null for twins), DV-U5b-10 (tags and readiness read from the report / case until the Step 13 export, OI-U5b-P2-3). Open: OI-U5b-P2-1 (CI lacks tsc -p tsconfig.scripts.json; first -cli.ts now exists), OI-U5b-P2-2, OI-U5b-P2-3. No escalation.
**Context**: CONSTRUCTION — U5b Code Generation Part 2, Group 3 done; next Group 4 (Step 11).

---

## v1.2 Evaluation-Readiness — U4 Group 7 (Steps 26–27): rubric
**Timestamp**: 2026-10-08T16:26:32Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator started U4 Group 7)
**Intent**: Replace the SRP and layering-intent rubrics of FF-N01/FF-N02 with the frozen-draft Integrity and Semantic rubric text and names from one source, and provide the corpus rubric step script for Build and Test, without any snapshot change.
**AI Response**: Group 7 complete on v1.2e-u4-neural-path. Step 26 3049e78 (U4-K6): FF-N01 architectural-integrity and FF-N02 intent-alignment with the BR-U4-RUB-01 text from src/llm-critic/rubric.ts in the three presets, the two specs and the template registry (BR-U4-RUB-02); rubric-single-source test (+34: registry enumerated, five YAMLs raw and parsed, retired-name/SRP grep, probe-vocabulary check). Attributed cross-unit updates in the same commit: two U1 tests that rebuild a legacy spec from a preset now revert the names first (k14-integrity-dimension, migrate-corpus-spec); the U5a full-aac prompt template re-embeds the preset verbatim (BR-U5a-52) with its DRAFT hash table in Docs/generator-protocol.md updated (precedent ed32c02). Step 27 55501c4: scripts/corpus-rubric-u4.ts (applyRubric/assertNoOldRubric, in-place scalar edits) and scripts/corpus-rubric-u4-cli.ts (--check; --self-test exits 1), +16 tests. Gates per step: T clean; U 2594 then 2610 (171 suites); L 497 ≤ 558; B 80 ≤ 85; G strict 74 executed, 0 skipped, snapshots, hashes and CHANGES.md unchanged (no golden change); S and X clean. Gate G-CI run 37807867731 on 55501c4 green (unit 2595 + integration 15, golden 74, lint 497); recorded in 1209bea. Open item: tests/fixtures/u5a/layered/firewall.spec.yaml still carries the old rubric (outside RUB-02; for RUB-03 or U5a).
**Context**: CONSTRUCTION — U4 Code Generation Part 2, Group 7 done; next Group 8 (Steps 28–29).

---

## v1.2 Evaluation-Readiness — U4 Group 8 (Steps 28–29): acceptance on the lane and one live smoke
**Timestamp**: 2026-10-08T16:51:48Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator started U4 Group 8)
**Intent**: Prove the neural path end to end on the lane graph with the Mock judge (unit coverage, record/replay identity without the binary, secret scrubbing), commit Mock fixture cassettes that U5b can replay (U5b OI-3), and run the one allowed live smoke of the real CLI under the ADR-018 isolation.
**AI Response**: Group 8 complete on v1.2e-u4-neural-path. Step 28 b21a82e: tests/golden/u4-neural.test.ts (gated; no snapshot) runs the real pipeline in full mode with --llm-provider mock (parseLLMOptions defaults) on each of the five fixtures against the lane (7690), records then replays with PATH emptied: one result per selected unit, unitsCapped 0, record and replay outputs byte-identical, no known secret (lane password and bearer probe echoed by the scripted Mock) in cassettes, warnings or U3's assembled report; Mock fixture cassettes for correct-reference committed under tests/fixtures/judge-cassettes/correct-reference/ (42 entries, prompts included, D-U4-12) and replayed with the U5b argv: zero CASSETTE_MISS, equal to a fresh Mock record (negative control: a removed entry gives JUDGE_RUN_INCOMPLETE). Gates: T clean; U 2610 / 171; L 497 ≤ 558; B 80 ≤ 85; G strict 80 executed (74 + 6) / 7 suites, 0 skipped, snapshots, hashes and CHANGES.md unchanged (no golden change, no CHANGES.md line); S U4-owned only; X only the allow-listed bearer test literal. Step 29 (not committed, not quoted): one live smoke, claude-cli 2.1.294, FF-N02, one unit (Task.ts), three runs: isolation pre-flight pass, resolvedModel claude-opus-5-5, three valid outcomes (about 5.6–6.3 s each), replay with PATH emptied equal to the record; cassette dir deleted. Gate G-CI run 37811439497 on b21a82e green (unit 2595 + integration 15, golden 80 / 7 suites, lint 497); recorded with the Step 29 Done note in acbfc2a (deviation: Step 29 note committed with the Gate G-CI record, not held for Step 30). Open item: Mock record provenance reports model mock-model (describe()) while replay reads the requested claude-opus-5-5 from the entries; Claude CLI provenance is symmetric; settle at Step 30/31 or in Build and Test.
**Context**: CONSTRUCTION — U4 Code Generation Part 2, Group 8 done; next Group 9 (Steps 30–32).

---

## v1.2 Evaluation-Readiness — U5b Group 4 (Step 11): re-scorer
**Timestamp**: 2026-10-08T16:53:29Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator started U5b Group 4)
**Intent**: Build the FR-26 re-scorer and prove the 3 dp reproduction on the five symbolic fixture reports (exit criterion 2, symbolic part), with leave-one-dimension-out and sensitivity-only scenarios.
**AI Response**: Group 4 complete on v1.2e-u5b-scoring-harness. Step 11 78db180: five symbolic-only fixture reports produced under the lock on the lane Neo4j 7692 (same CLI entry as Step 7), scrubbed, committed under tests/fixtures/u5b/reports/ with test-input RunRecords (D-U5b-7; no path, user name or password); scripts/rescore.ts and rescore-cli.ts (inputs from the scoring block, spec re-parse fallback at RunRecord.specSha; every AHS field and the verdict from verdictSource reproduced via renormaliseWeights / computeAHS / determineVerdict, RESCORE_MISMATCH on any 3 dp difference; leave-one-dimension-out marked ablated; sensitivity-only threshold bands and majority / any-fail / share aggregation from persisted unitResults; rescore_ablation.csv and rescore_sensitivity.csv); 16 tests (five reports reproduce; FR-15 vector .389/.222/.333/.056 on solid ablation; sensitivity rows sensitivity-only; majority reproduces stored neural verdicts; spec-reparse source). Gates: T clean; U 2281 / 164 suites (2155 + 126 U5b); L 558 (= baseline), U5b files 0; B 85, 0 TS2688; G 74 executed, 0 skipped, src and tests/golden diffs empty, snapshot hashes equal to U5B_SNAPSHOT_HASHES; P 0. Gate G-CI (recommended): run 37811510701 green (unit 2266 + integration 15, golden 74, audit 37 high unchanged, lint 558 under continue-on-error). Golden changes: none, no CHANGES.md line. Deviations: DV-U5b-11 (CSV run_id column; ablation rows only for AHS fields whose candidate set holds the ablated dimension), DV-U5b-12 (any-fail and share variant definitions; hybrids keep stored contribution). Open: OI-U5b-P2-1, OI-U5b-P2-2, OI-U5b-P2-3 unchanged. No escalation.
**Context**: CONSTRUCTION — U5b Code Generation Part 2, Group 4 done; next Group 5 (Steps 12–16).

---

## v1.2 Evaluation-Readiness — U4 merged into v1.2e (auto-approved)
**Timestamp**: 2026-10-08T17:29:52Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator ran U4 Group 9, Steps 30–32, and the merge)
**Intent**: Close U4: write the probe values, amendments and hand-offs into the design records, write the code summary, verify the exit criteria on the final head, open the PR into v1.2e, pass Gate G-CI and merge with a merge commit.
**AI Response**: U4 merged into v1.2e (auto-approved). PR #7 (v1.2e-u4-neural-path → v1.2e) merged with a merge commit, 88cc0edb7100a854db4f844f0137aaa7bbfcbd18 (parents ab83886, 3d84746; no squash, rebase or force-push; main untouched). Step commits: 30 a1b783d (BR/DE [PROBE] marks replaced by probe values and fixture names; FROZEN_SHA256 f8b2dabb…eaec5a written into BR-U4-POL-01 and §11; OI-U4-1, 4, 5 closed; OI-U4-8 decision BR-U3-65 report field, no sidecar; U5b OI-3 D-U4-12 and C10 row split D-U4-5 recorded; clarifications §7; unit-of-work U3/U5b/Build and Test "From U4" rows), 31 e0f7333 (code-summary.md), 32 4f7776b (exit verification) and 3d84746 (PR and Gate G-CI record); D-U4-13 merge of docs-only origin/v1.2e c49e117 (U4_BASE re-recorded 1b6bafd; no code moved). Tests: Gate U 2610 / 171 suites green (v1.2e base 2155 / 152 + U4); Gate G strict 80 executed / 7 suites (74 + 6 U4 neural acceptance), 0 skipped on lane 7690; L 497 (L0 558); B 80 (B0 85), 0 TS2688; T clean (3 configs); S only owned paths plus the attributed cross-unit commits (3049e78 U4-K6, 73420f4/e4feed7 C9). Golden changes: none (snapshots byte-identical to v1.2e, no tests/golden/CHANGES.md line; CI Golden change log passed on the PR head, 232 commits checked). CI: PR head runs 37815151468 (pull_request) / 37815140748 (push) green on 3d84746 (Unit 2595 / 169, Integration 15 / 2, Golden 80 / 7, Lint 497); earlier head 4f7776b runs 37814357029 / 37814319202 green; merge push run 37816042939 green. Deviations: no C9 hand-off branch (cross-unit commit, D-U4-7 amended); D-U4-13 applied by merge, not rebase; Mock record-provenance model left to Build and Test. Open: Build and Test (L0 full-mode lane incl. CAS-11 message test and live fixture cassettes; SEN-01 and rubric freeze; USAGE_LIMIT and calls-per-window unverified; canary channels and author-install DISABLE_AUTOUPDATER, AUTHOR ACTION; ADR prose); U5b (acceptReport reasons seeded-list-nonempty, missing-baseline-selection, judge.model); U3 (C10 row 1 required form, stale failures comment in evaluation.ts); U5a layered fixture old FF-N names; U1 INTENT_VIOLATION prefix assertion; D-U4-14 CI does not type-check U4 tests.
**Context**: CONSTRUCTION — U4 Code Generation COMPLETE and merged; lane 3 (U3, U4, U5a) merged; next U5b (in flight).

---

## v1.2 Evaluation-Readiness — U5b Group 5 (Steps 12–16): pre-registration gate, harness, environment, aggregation
**Timestamp**: 2026-10-08T17:52:20Z
**User Input**: None (standing approval of 2026-10-08T00:30:00Z; orchestrator started U5b Group 5)
**Intent**: Build the pre-registration gate, the frozen-instrument exporter, the run harness with acceptance, records, SO5 code tables and the latency gate, the environment recorder with scrubbed artefacts, and the aggregation to the CSV set and figures, and prove the fixture harness run (exit criteria 3 and 5).
**AI Response**: Group 5 complete on v1.2e-u5b-scoring-harness. Step 12 a8c29f1: scripts/lib/prereg.ts and prereg.schema.json (BR-U5b-51 registry; gate (a) committed = HEAD blob, (b) older than the plan's first run under the version, (c) every registered hash unchanged; unregistered plan and spec outside corpus/specs and the fixture spec refused; 10 tests in a temp git repository). Step 13 dae24f5: export-frozen-instrument.ts (grammar, cycle bound 10, row cap, applicability 25 templates x 4 style columns, tags, BR-U1-16 self-spec deviations, U3 verdict sources and ahsNeuronal rule, metric-key readiness true/true, judge freeze null until U4 so --final exits 1; byte-identical exports; tags equal the fixture reports). Step 14 c5f32f0: Docs/analysis-plan.md draft with the SO5 machine block (25 templates and 2 judge dimensions -> 10 FPAT families, 7 failureReason -> GEN codes) and so5-codes.ts; run-record and experiment-plan schemas; run-experiment.ts (gate first, env record per plan run, E1 grid joined to U5a generation.json, not-run with GEN code, CLI subprocess via ProcessRunner/buildChildEnv, one transport retry, incomplete on usage limit, acceptReport, scrubbed schema-valid RunRecords, latency gate, --check-prereg and --dry-run). Step 15 1e687e6: record-env.ts and environment-record schema (lock-file versions, compose image and digests, Neo4j 5.26.24 and APOC by cypher-shell with credentials as child variables only, claude CLI 2.1.294, hardware; no environment variable); writeScrubbedJson for every U5b artefact. Step 16 463c59c: aggregate.ts (24 CSV files of domain-entities section 10, toFixed(6), seeded intervals, SO5 grid/patterns/tests with task-blocked permutation tests and Holm, FPAT counting from the analysis-plan table only), figures via vega View.toSVG from the tsx entry, results guard test; end-to-end under the lane lock in a temp copy with a temp prereg: five fixtures accepted through the built CLI (AHS .958/.442/.575/.391/.558), the two injected reports rejected function-failed and function-truncated, 24 CSV + 1 SVG, results/ untouched, no password in any artefact. Gates at Step 16: T clean; U 2330 / 171 suites (2155 + 175 U5b); L 558 (= baseline), the 41 U5b files 0; B 85, 0 TS2688; G 74 executed, 0 skipped, src and tests/golden diffs empty, snapshot hashes equal to U5B_SNAPSHOT_HASHES; P 0 at every commit. Gate G-CI: run 37819187299 green (unit 2315 + integration 15, golden 74, audit 37 high unchanged, lint 558 under continue-on-error). Golden changes: none, no CHANGES.md line. Deviations: DV-U5b-13 (25 templates, not 24), DV-U5b-14 (ExperimentPlan e1 grid block), DV-U5b-15 (cassette dir and judge flags only for judge modes; prereg refusal recorded as rejected/prereg-refused), DV-U5b-16 (per-function rows one cluster), DV-U5b-17 (labeller-fed CSVs header-only until Group 7; run_id column on latency and coverage). Import whitelist extended with ajv-formats, the U1 modules of domain-entities section 1 and the C10 process-runner and scrub modules named by BR-U5b-55 and 70. OI-U5b-P2-2 resolved (vega-lite type route, ESM entry); OI-U5b-P2-3 checked (export tags equal report tags; scorer switches when corpus/frozen-instrument.json exists at Step 32); OI-U5b-P2-1 unchanged. No escalation.
**Context**: CONSTRUCTION — U5b Code Generation Part 2, Group 5 done; next Group 6 (Steps 17–25).

---

## U5b Code Generation Part 2 — Group 6 (Steps 17–25), corpus tools and corpus-spec chain
**Timestamp**: 2026-10-08T18:55:00Z
**User Input**: "Execute Group 6 — Corpus tools and the corpus-spec chain, Steps 17–25, under the standing approval (orchestrator task)."
**AI Response**: "Step 17 38adf9d: Docs/corpus-criteria.md (C1–C6, seeded rule, gh search procedure Q1–Q6, added-entry decisions, core licence notes, AGPL configuration-only overlays, yaml corpus-criteria block seed 20261008). Step 18 788ef20: scripts/lib/corpus.ts and corpus.schema.json; select-corpus (selectCorpus, searchCandidates, resolveAddedEntry), fetch-corpus (overlay hash, SHA verify, apply --check before apply, npm ci --ignore-scripts, tree hash without node_modules), prepare-bases (U5a PreparedBase, measured tsc, selection copied from a stored baseline selection, PREP_SELECTION_MISSING); +19 tests on a bare repository built at test time (DV-U5b-18). Step 19 a248eaf: corpus/corpus.json with the five core entries (SHAs = Docs/corpus.md, all npm-ci-ignore-scripts, own tsc 5.9.3/3.8.3/5.9.2/4.7.4/5.9.3) and overlays (realworld src/config.ts, ghostfolio and dry-run-test tsconfig, truthy-demo package-lock and .npmrc legacy-peer-deps, DV-U5b-19); every overlay passed fetch-corpus --check on scratch clones and npm ci --dry-run; +4 tests. Step 20 786f725: 144 candidates from gh (2026-10-08T18:22Z); seeded selection of 5 (zhuravlevma/nestjs-active-record layered, nestjslatam/ddd, MarvinRF/nest-docfy, eryzerz/nestjs-ddd, v-aguiar/valex layered), rerun byte-identical; added entries appended; +2 tests. Step 21 f602f19: remap-domain-layer.ts (Document API, insert-only, idempotent, --self-test exit 1); +6 tests. Steps 22–25 chain: 0c7b2df unchanged (cmp and sha256 recorded), 450134f fr22, 194f7fe cv02, 06ef4a7 remap; edited key paths in Docs/corpus.md; +6 tests incl. git-log order. bbf3d04: PreparedBase overlay hash = overlaid file content (OI-U5a-17 hand-off, DV-U5b-20). SO4 floor check (read-only, U5a siteFeasibility over the four remapped specs on scratch clones): held-out golden capacity k=2 47, k=3 69 (pre-remap 29/42) -> CAT_SHORTFALL. Gates at Step 25: T clean; U 2367 / 175 suites (2330 + 37 in Group 6); L 558, U5b files 0; B 85, 0 TS2688; G 74, 0 skipped, src and tests/golden diffs empty, snapshot hashes equal; P 0 at every commit. Gate G-CI: run 37826683421 green (unit 2352 + integration 15, golden 74, audit 37 high unchanged). Golden changes: none, no CHANGES.md line. ESCALATION: SO4 seeding floor not reached on the four corpus specs after the ADR-017 item 4 remap (69 < 80 at k=3); author decision required (BR-U5a-37), e.g. count dev-nest and the added projects once their specs exist (OI-12), or another remedy. The floor-check box of Step 25 stays open."
**Context**: CONSTRUCTION — U5b Code Generation Part 2, Group 6 done except the escalated SO4 floor check; Group 7 starts only after the orchestrator's go.

---

## U5b Code Generation Part 2 — Group 7 (Steps 26–30), labeller and full-mode reproduction
**Timestamp**: 2026-10-08T19:45:16Z
**User Input**: "Execute Group 7 — Labeller and full-mode reproduction, Steps 26–30, under the standing approval (orchestrator task, after the U4 merge)."
**AI Response**: "Step 26: merge commit 5763124 (origin/v1.2e with U4, PR #7 88cc0ed; no conflict, no content edit), U5B_BASE2 = 22a70b26eaff5e6e8fc01dcfdc92a276fca6a2c7; fix commit 8fe60a3 (DV-U5b-21: U4-K6 edited the FF-N01 / FF-N02 rubric of specs/clean-arch.yaml, so the hand-computed acceptance and the spec-reparse tests now read the spec at the fixture's RunRecord.cliCommit; no fixture or script changed); re-recorded references: Gate U 2822 / 194, L 497, B 80, N_G 80 / 7 suites, snapshot hashes = U5B_BASE2 = Step 2 values. Step 27 e54fd89: scripts/lib/label-context.ts (P1..P4 and missed-seed candidates from named fields only, seeded per-stratum sampling with inclusion probabilities, context builder with the ±15-line window and U4 assembleUnitSourceFromView + rubric for P4, mechanical FN rules (1)..(6) with ts.resolveModuleName and warning corroboration, budget with a uniform cap scale and the estimate refusal); BR-U5b-55 whitelist gains the U4 C7 modules; +9 tests. Step 28 c225335: scripts/llm-label.ts + -cli.ts (LABELLER_MODEL_UNPINNED, Claude family refused, sameFamily; Docs/labeller-prompts/{violation,judge-unit,missed-seed}.md; run 1 seeded shuffle and per-item permutations mapped back; U4 CassetteLLMProvider with canonical-request key + r0 + runIndex; record / replay only; one re-ask; reconciliation to label or uncertain); Mock fixture plan, expected labels and 48 scrubbed cassettes; no-live-Gemini guard in guards.test.ts; +19 tests. Step 29 4a3cd09: 30-item audit allocation (floor min(3, size), round-robin by project), blinded view, audit hash lock (AUDIT_MODIFIED), agreement rows run-vs-run, judge-vs-panel (weighted; same-family cross-check flagged and kept out of the headline), panel-vs-audit (weighted), judge-repetition Fleiss kappa from U4's committed cassettes; aggregate.ts writes the four labeller CSVs from --labelling; +8 tests. Step 30 f2bfab6: built CLI in full mode on correct-reference with the Mock judge replayed from U4's committed cassettes (OI-3 met), scrubbed report under tests/fixtures/u5b/reports/full-mode/; ahsDeterministic .958, ahsCombined .962, ahsNeuronal 1 and the verdict from ahsCombined reproduce at 3 dp (exit criterion 2); +2 tests. Gates at Step 30: T clean; U 2860 / 198; L 497; B 80, 0 TS2688; G 80 / 7 suites, 0 skipped, three-dot and uncommitted src/tests/golden diffs empty, hashes unchanged; P 0 / 0 at every commit. Gate G-CI run 37833424050 green (Unit 2845 + Integration 15, Golden 80, audit 49 / 37 high unchanged, Lint 497 under continue-on-error). Golden changes: none, no CHANGES.md line. Deviations: DV-U5b-21 (fixture spec read at the recorded commit), DV-U5b-22 (missed-seed items: single option FN with a required root cause). Open: no verified Gemini labeller id is pinned in Docs/ yet (BR-U4-VRD-09, before Phase 5); the SO4 floor escalation (CAT_SHORTFALL, Step 25) is still open."
**Context**: CONSTRUCTION — U5b Code Generation Part 2, Group 7 done; next Group 8 (Steps 31–32).

---

## U5b Code Generation Part 2 — Group 8 (Steps 31–32), analysis plan, registered plans and pre-registration
**Timestamp**: 2026-10-08T20:11:46Z
**User Input**: "Execute Group 8 — Analysis plan, registered plans and pre-registration, Steps 31–32, under the standing approval (orchestrator task)."
**AI Response**: "Step 31 06d221f: Docs/analysis-plan.md completed around the SO5 block (registered plans and seeds, outcomes, populations and caps, labellingBudgetCalls 4000 from the cap-derived bound, interval rule, SO5 factors / permutation tests / Holm families with the verdictSource AHS primary, flag columns, missingness); Docs/matching-rule.md final 1.0.0; six experiments/<id>/plan.json (fixtures, latency-gate, sensitivity, so4-heldout, e1-grid 54 cells, e7-corpus 4). Fix 50396b2 (DV-U5b-26): the frozen-instrument exporter now carries U4's FROZEN_VALUES and FROZEN_SHA256. Step 32 84bd30c: corpus/frozen-instrument.json (--final, re-export byte-identical) and corpus/prereg.json v1 (28 artefacts, matching rule 1.0.0, budget 4000, E1 grid 3x3x2x3); --check-prereg passes for all six plans; one changed byte in Docs/matching-rule.md refused in a scratch clone; corpus-spec hashes equal the Step 25 blobs; no RunRecord of a registered plan, results/ absent. Gates: U 2860 / 198, L 497, B 80, G 80 / 7 suites with unchanged hashes, P 0 / 0; G-CI runs 37836018563 and 37836644126 green. Golden changes: none. Deviations DV-U5b-23..26; open item OI-U5b-P2-4 (U5a / U4 documents still DRAFT and the later SO4 / SP / E7 entries and E1 model pins need prereg v2+ with a reason before the runs they affect; SP-FF-S03 layered spec outside FIXTURE_SPECS)."
**Context**: CONSTRUCTION — U5b Code Generation Part 2, Group 8 done; next Group 9 (Steps 33–35).

---

## U5b merged into v1.2e (auto-approved)
**Timestamp**: 2026-10-08T20:39:31Z
**User Input**: "Execute Group 9, Exit, PR, merge and post-merge (Steps 33–35), under the standing approval: open the PR into v1.2e, merge it once CI is green, then do the post-merge bookkeeping (orchestrator task)."
**AI Response**: "PR #8 (v1.2e-u5b-scoring-harness → v1.2e) merged with a merge commit; U5B_MERGE = 7192cb73b1ab4a82139ee2e1384e75e022e7b885 (first parent 0a94c20, second parent 8adc319); origin/main unchanged (7cd15b4). Step 33: fix dd7ed6c (DV-U5b-27) adds --self-test to rescore, select-corpus, fetch-corpus and prepare-bases (BR-U5b-73); all 11 U5b CLIs now exit 1; +4 tests. Summary commit 8adc319 adds the code summary with the exit table for criteria 1–7. The allow-list three-dot diff is empty, no U<n>-K subject, --check-prereg passes with 28 artefacts unchanged, and the local golden change-log check is ok. Gates: T clean; U 2864 / 199; L 497; B 80, 0 TS2688; G 80 / 7 suites, 0 skipped; P 0 / 0. PR CI 37839347368 and push 37839298686 green (Unit 2849 + Integration 15, Golden 80). Step 34: the completion message was presented and Continue was taken under the standing approval; merged. Step 35, on the merged tree in the main checkout after npm ci: T clean, U 2864 / 199, L 497, B 80; G against U5B_MERGE^1 has an empty src/tests/golden diff, all five snapshot hashes equal to the parent's, and 80 / 7 suites with 0 skipped; merge push CI 37840382331 green. Test counts: 2864 total, of which 254 are U5b tests. Golden changes: none; no snapshot changed and no tests/golden/CHANGES.md line was written. Pre-registration v1 is 84bd30c (2026-10-08T20:03:37Z). Deviations DV-U5b-27..29. Still open: the SO4 floor escalation (CAT_SHORTFALL 69 < 80, Step 25, author decision), OI-11, OI-12, OI-U5b-P2-1, OI-U5b-P2-4 and the Gemini labeller id. Observation: CI Dependency audit now reports 1 critical (handlebars via ts-jest, a new advisory, not caused by U5b; continue-on-error)."
**Context**: CONSTRUCTION — U5b Code Generation complete and merged (Group 9 done); next Build and Test.

---

## Build and Test — plan written (auto-approved)
**Timestamp**: 2026-10-08T20:59:24Z
**User Input**: "Write the v1.2E Build and Test plan (groups BT-A..BT-G) mapping every code-summary hand-off to a step or to 'deferred to experiments', commit it on v1.2e and push (orchestrator task, standing approval; pending author decisions (a) SO4 floor shortfall and (b) Gemini labeller id / live-labelling route not to be decided; no E1, E7, SO4 held-out run or live labelling; at most 40 live judge calls)."
**AI Response**: "Plan aidlc-docs/construction/plans/v1.2E-build-and-test-plan.md: Steps 0-51 in groups BT-A 0-8, BT-B 9-12, BT-C 13-20, BT-D 21-25, BT-E 26-33, BT-F 34-47, BT-G 48-51, with a dependency run order, four pre-registration bumps (P-1..P-4), a live-call ledger (judge <= 40, generator <= 11 + 3 retries) and a hand-off mapping table. Two conflicts registered for escalation: E-1, BR-U5a-40 requires the catalogue (with k, pending decision (a)) and the generator protocol to be frozen before the FR-18 re-baseline or the first corpus run, so BT-B, BT-D and the sensitivity run are held; E-2, BR-U4-SEN-01 for FF-N02 needs more live judge calls than the 40-call cap allows (correct-reference has 14 judge units x 3 runs = 42 calls per copy), so the rubric freeze, FROZEN_SHA256, the final export and the L0 baseline are held. Deviations DV-BT-1..3 recorded."
**Context**: CONSTRUCTION — Build and Test, planning; Step 0 committed; execution starts at Step 1 (BT-A).

---

## Build and Test — Group BT-A (Steps 1–8) executed, PR-1 merged (auto-approved)
**Timestamp**: 2026-10-08T21:51:31Z
**User Input**: "Execute group BT-A of the Build and Test plan (Steps 0–8) under the standing approval: worktree and lane, baselines, hand-off verification, CI and change-log tooling, audit and lint triage, NFR-04 documentation, instruction files, PR-1 into v1.2e once CI is green (orchestrator task; pending author decisions (a) SO4 floor shortfall and (b) Gemini labeller id not to be decided; no E1, E7, SO4 or live labelling; no live judge call in this group)."
**AI Response**: "Step 1: PRs #1–#8 ancestors of origin/v1.2e; BT_BASE e9c24c4; worktree DaedalusArch-wt-bt on v1.2e-build-and-test, npm ci clean, npm ls canvas empty. Step 2: lane daedalus-neo4j-bt on 127.0.0.1:7693/7479 (CI-pinned image, APOC), ~/.daedalus-bt.env mode 600, no value printed; smoke via neo4j-driver because cypher-shell is not installed (DV-BT-4). Step 3: U_BT 2864/199, L_BT 497, B_BT 80 (0 TS2688), N_G 80/7 (0 skipped), snapshot hashes = U5b G0; 11 U5b CLIs --self-test exit 1; --check-prereg v1 ok (28 artefacts). Step 4: hand-offs H8, H9, H10, H11, OI-U5a-5/17, BR-U3-66 closed in code; OI-U4-8 consumer reasons were missing and were added (f997b79, DV-BT-5; +5 tests); H10 grep shows NEO4J_USER ?? 'neo4j' defaults only, no password default (DV-BT-6); scenarios: full mode with replayed Mock cassettes exit 0, 14 judged units, AHS .958/.962/1 pass; forced MO-S01 scored matched (TP 1, FP 0); harness fixture plan CSV set, SVG and two injected rejections. Step 5 (49cc2bc): change-log BT grammar (exactly one line per changed case, re-record/baseline/observation markers, full-mode lane dir, results/ re-scope), CI change-log step widened to v1.2e-build-and-test PRs and three blocking tsc steps, results guard re-scoped with a RunRecord schema check, prereg bump tool register-prereg(-cli).ts; +16 tests. Step 6 (142927e): lock-only updates (runtime high 8 -> 5, critical 1 -> 0), remaining root advisory braces GHSA-vfj7-8cjw-p6xm accepted residual (no fixed release); blocking 'Dependency audit gate (triaged)' (DV-BT-8); lint 497 per-rule record; file in the quoted Docs/DiagnosticRuns / folder (DV-BT-7); +3 tests. Step 7 (b2b00bd): ADR-005 amended to 6 nodes / 9 edges, stale quoted Neo4j password replaced by a placeholder in two playbooks, dated SECURITY-11 note (OI-U5a-11); Appendix A and Chapter 4/5 rows not in the repository, listed for the author. Step 8 (0d307c5): six v1.2E instruction files. PR #9 merged as 00114de after green checks (the change-log step ran on this branch and passed); origin/main unchanged. Gates at group end: T clean, U 2888/201, L 497, B 80, G 80/7 with unchanged hashes, P 0/0. Live judge calls: 0 of 40. Golden changes: none."
**Context**: CONSTRUCTION — Build and Test, group BT-A complete; next per run order BT-C (Steps 13–20). Open: E-1, E-2, pending author decisions (a) and (b); author actions: rotate the local .env Neo4j password, consider renaming the trailing-space Docs/DiagnosticRuns folder, update thesis Appendix A and Chapter 4/5 rows.

---

## Build and Test — Group BT-B (Steps 9–12) held by E-1 (auto-approved)
**Timestamp**: 2026-10-08T21:59:39Z
**User Input**: "Execute group BT-B of the Build and Test plan (Steps 9–12: FR-18 golden re-baseline, results/pre-tag/fixtures-<sha>.json with README and NFR-03 timings, spec-header verdicts) under the standing approval (orchestrator task; pending author decisions (a) and (b) not to be decided)."
**AI Response**: "Step 9 entry gate measured and not met: --check-prereg experiments/fixtures/plan.json prints 'pre-registration v1 ok: 28 registered artefacts unchanged' (v1, P-1 / Step 43 not committed); Docs/operator-catalogue.md and Docs/generator-protocol.md still DRAFT; BT-D Step 24 undecided. Per the plan ('Otherwise stop: E-1 still open') Steps 9–12 were not executed and are marked Held in the plan (7caba57). No Gate G re-baseline, no snapshot change, no tests/golden/CHANGES.md line, no results/ file, spec header unchanged; no PR (nothing on the BT branch). Live judge calls: 0 of 40."
**Context**: CONSTRUCTION — Build and Test, group BT-B held by E-1 (pending author decision (a), BR-U5a-37 CAT_SHORTFALL 69 < 80; BR-U5a-40). Resume at Step 9 after Steps 42–43 (and Step 24).

---

## Build and Test — Group BT-C (Steps 13–20) executed, PR #10 merged (auto-approved)
**Timestamp**: 2026-10-08T22:42:04Z
**User Input**: "Execute group BT-C of the Build and Test plan (Steps 13–20: corpus fetch, RUB-03, OI-11 selection projection, prepare-bases, parity, base type-check, site feasibility stopping at CAT_SHORTFALL, corpus record) under the standing approval; do not decide pending (a) or (b); no live judge or generator calls needed."
**AI Response**: "Step 13: ten clones under ../daedalus-corpus, 10/10 HEADs = registered SHA (core five = Clones table); realworld-test npm ci fails (194 lock URLs on unreachable npm.styque.de, 39 packages missing, tsc 3.8.3 present; OI-BT-C1); truthy-demo npm ci rewrites yarn.lock, tree hash install-dependent (OI-BT-C2); --check rerun into scratch ok x10 (DV-BT-9: fetch refuses an existing destination). Step 14 8e6b94d: RUB-03 on four corpus specs + layered fixture spec, rerun no change, Docs/corpus.md §5 (DV-BT-1); --check-prereg refuses until P-1. Step 15 bd13765: store-baseline-selection (+10 tests), corpus/selections x4 from Mock full mode, zero live calls, byte-identical rederivation (DV-BT-2; OI-11 settled). Step 16: four PreparedBase, tsc = registered. Step 17: parity OK x4. Step 18 2b6ed60: u5a-base-measure entry (+2 tests); type errors 0/0/0, ghostfolio 3 -> excluded (sub-path copy lacks monorepo root; 432 errors in situ, Prisma client not generated; OI-BT-C3). Step 19 e77bed2: held-out golden k=2 47, k=3 69 -> CAT_SHORTFALL, no k chosen (without ghostfolio 37/54, reported only). Step 20 b81cd21: corpus record. Gates T clean, U 2900/203, L 497, B 80/0, G 80/7 hashes unchanged, P 0/0; CI 37853526160 and PR checks 37854352961 green; PR #10 merged bb97a7e. Plan ticks 97c2b24..7b08fea. Live calls: judge 0, generator 0."
**Context**: CONSTRUCTION — Build and Test, group BT-C complete; next per run order BT-E Steps 26–27. Open: E-1 (decision (a), now with the ghostfolio exclusion question), E-2, decision (b), OI-BT-C1..C3.

---

## Build and Test — Group BT-D (Steps 21–25) held by E-1 (auto-approved)
**Timestamp**: 2026-10-08T22:52:39Z
**User Input**: "Execute group BT-D of the Build and Test plan (Steps 21–25: H13 latency gate on ghostfolio apps/api, PROFILE rows for FF-S02 and the universal cycle metric, ADR-016 e flip only on the gate result with P-2, NFR-07 table) under the standing approval; do not decide pending (a) or (b)."
**AI Response**: "Step 21 entry gate measured on the worktree at 3e07b9f and not met: --check-prereg experiments/latency-gate/plan.json exit 1, PREREG_REFUSED (artefact-changed) on corpus/specs/dry-run-test.yaml (Step 14 RUB-03 edit); prereg.json still v1 (P-1 / Step 43 not committed); operator catalogue and generator protocol DRAFT. Per BR-U5a-40 the latency-gate run is the first corpus run, so Steps 21–25 were not executed and are marked Held in the plan (c6209a6). No latency run, no PROFILE rows, no ADR-016 e decision (CYCLE_STRATEGY stays 'cypher' by default, not by gate result), no P-2, no NFR-07 table; no snapshot change, no CHANGES.md line, no results/ file; no PR (nothing on the BT branch). Live judge calls: 0 of 40."
**Context**: CONSTRUCTION — Build and Test, group BT-D held by E-1 (pending author decision (a), BR-U5a-37 CAT_SHORTFALL 69 < 80). Resume at Step 21 after Steps 42–43; BT-B and BT-E Steps 28+ also wait on Step 24.

---

## Build and Test — Group BT-E Steps 26–27 done, PR #11 merged; Steps 28–33 held by E-1 (auto-approved)
**Timestamp**: 2026-10-08T23:07:55Z
**User Input**: "Execute group BT-E of the Build and Test plan (Steps 26–33: dev-split gate and OI-U5a-13 drift check, SP-FF-S03 admitted to FIXTURE_SPECS, SP copies, DV-U5b-24/25 registration with P-3, sensitivity run, CV01/CV04(/CV06) fixed or excluded per ADR-016 b, U5a §9 ledger, PR-3) under the standing approval; do not decide pending (a) or (b)."
**AI Response**: "Step 26 4044948: 22 FR-24 forced sites on correct-reference (MO-S03/MO-S03n under the layered spec) mutated and evaluated through U3 on the BT lane; u5a-freeze-gate exit 0, 22/22 pass, 0 undeclared keys; no template drift (OI-U5a-13), no catalogue changelog entry; Docs/DiagnosticRuns/u5a-freeze-gate-a.{json,md}. Step 27 b67b584: FIXTURE_SPECS admits tests/fixtures/u5a/layered/firewall.spec.yaml, test +1; BR-U5b-51 registered list unchanged (DV-BT-E1 / OI-BT-E1: plan wording said 'registered artefact'; the layered spec is admitted, not hashed). Gates T clean, U 2901/203, L 497, B 80 (0 TS2688), G 80/7 hashes unchanged, P 0/0. PR #11 merged (5020099), CI green. Steps 28–33 held (1abc740): prereg.json v1, catalogue and generator protocol DRAFT, Steps 11, 24, 39–41 and 43 not done. No sensitivity run, no P-3, no ADR-016 b decision, no snapshot change, 0 live calls."
**Context**: CONSTRUCTION — Build and Test, BT-E pre-freeze part complete; Steps 28–33 held by E-1 (pending author decision (a), BR-U5a-37 CAT_SHORTFALL 69 < 80; BR-U5a-40). Next per run order: BT-F Steps 34–41. Open: E-1, E-2, decision (b), OI-BT-C1..C3, OI-BT-E1.

---

## Build and Test — Group BT-F Steps 34–41 and 46 (lane code) done, PR #12 and PR #13 merged; Steps 42–45 and the L0 baseline held by E-1 / E-2 (auto-approved)
**Timestamp**: 2026-10-09T00:06:54Z
**User Input**: "Execute group BT-F of the Build and Test plan (Steps 34–47: live-call ledger and preflight, canary, SEN-01 dry count, SEN-01 FF-N01 and live smoke, FF-N02 conditional, generator probes, pilot and protocol freeze, catalogue freeze (E-1), P-1, rubric freeze and FROZEN_SHA256 (E-2), final export and P-4, L0 lane with CAS-11 test) under the standing approval; at most 40 live judge calls; do not decide (a) or (b)."
**AI Response**: "34 80f24f0: ledger, CLI 2.1.294 = pin, judge dir allow-list pass, author auto-update AUTHOR ACTION open, adrProse absent (declared limitation), DV-BT-F1 init-probe counting. 35 2895a69: ISO-07 canary, 3 calls; neutral negative clean; ancestor-cwd negative under the judge argv found the ancestor token (unlike U4) — closed by ISO-05 only (OI-BT-F1); user CLAUDE.md / hook channels and USAGE_LIMIT residual. 36 bba0b9c: Mock dry count FF-N01 17, FF-N02 35; 55 > 40, E-2 confirmed. 37 eec1e72: FF-N01 fired (I-copy src/domain/entities fail on DateUtils.ts, NotificationFormatter.ts; base pass), 17 calls, 15 live cassettes in tests/fixtures/judge-cassettes-live/correct-reference; base use-cases unit fails (OI-BT-F2). 38 e8e3999: FF-N02 not started (35 needed, 20 left), E-2 open. 39 244d86a: confinement 5/5 pass, Bash protocol stands. 40 d97d4c5: opus, sonnet, haiku model-valid, no auxiliary model, E1 pins unchanged. 41 4405d21: pilot 3 ok (none has 13 files, flagged), generator-protocol FROZEN 2026-10-08; PR #12 merged c8abcf4. 42–45 held (E-1, E-2). 46 69cbe3a: variant-a..d Mock cassettes, replay lane with own config and CI step, CAS-11 test, provenance check passes; locally real cassettes give 're-record: 30 missing keys'; L0 baseline held (E-2). 47: PR #13 merged 6bcb3bb. Gates: T clean, U 2903/203, L 497, B 80, G 80/7 hashes unchanged, lane 7/7, P 0/0. Live calls: judge 20/40, generator 11/11 (0 retries). No snapshot change, no CHANGES.md line."
**Context**: CONSTRUCTION — Build and Test, BT-F pre-freeze part and lane code complete; Steps 42–43 held by E-1 (pending author decision (a), BR-U5a-37 CAT_SHORTFALL 69 < 80), Steps 44–45 and the L0 baseline commit held by E-2 (SEN-01 FF-N02 needs 35 live calls, 20 left under the 40-call cap). New open items OI-BT-F1 (ancestor channel only closed by ISO-05), OI-BT-F2 (base use-cases unit fails FF-N01), OI-BT-F3 (E1 orderSeed unset). Next per run order: BT-G.

---

## Build and Test — Group BT-G (Steps 48–51) done, PR #14 merged; stage stopped at Step 49 with E-1 and E-2 open (auto-approved)
**Timestamp**: 2026-10-09T00:46:13Z
**User Input**: "Execute group BT-G of the Build and Test plan (Steps 48–51: hand-off close-out, build-and-test-summary.md with author decisions and residual threats incl. canary channels and USAGE_LIMIT unverified, state and audit, PR-5) under the standing approval; do not decide pending (a) or (b); no E1, E7, SO4 or live labelling."
**AI Response**: "48 8410dd4: U3 handoffs.md status close-out — H3 closed by U5a in code (DE §2.2 text stays H16 b), H4 closed by U5a, H8–H11 closed by U4 (confirmed Step 4), H13 open held by E-1 (DV-BT-G1); plan §9 final status column. 49 bf31fc8 + 0937478: build-and-test-summary.md rewritten for v1.2E (build; Gate U 2903 / 203; golden 80 / 7 hashes unchanged; lane 7 / 7, L0 held by E-2; 4 / 4 integration scenarios; NFR-03 / H13 / NFR-07 held by E-1; security; contracts and --check-prereg state; ledgers judge 20 / 40, generator 11 / 11 + 0 / 3; no snapshot change, no CHANGES.md line; author decisions (a), (b), E-1, E-2, OI-12, OI-U5a-15, OI-BT-C1..C3, E1, F1..F3, .env rotation, DISABLE_AUTOUPDATER, throwaway login; residual threats; deviations; record owners; resume order). Gate P counted 1 on bf31fc8 because the main .env password equals the former compose default that the summary named; removed in 0937478, branch not rewritten (DV-BT-G2), rotation listed as author action. Group-end gates: T clean, U 2903 / 203 (local Jest-worker SIGSEGV in 2 of 3 full runs, prompt.test.ts passes alone: OI-BT-G1), L 497, B 80 / 0 TS2688, G 80 / 7, lane 7 / 7. 50: PR #14 green (push 37865616636, PR 37865637085, change log ok 341 commits), merged fda27b4; aidlc-state.md updated; origin/main 7cd15b4 unchanged. 51: lanes kept (daedalus-neo4j-bt, ~/.daedalus-bt.env, worktree, ../daedalus-corpus, ../daedalus-e1-outcomes, ../daedalus-gen-harness); ../daedalus-sp-probes not created. 0 live calls in BT-G."
**Context**: CONSTRUCTION — Build and Test stopped at Step 49 with E-1 (pending author decision (a), BR-U5a-37 CAT_SHORTFALL 69 < 80; BR-U5a-40) and E-2 (SEN-01 FF-N02 35 calls needed, 20 of 40 left) open; the orchestrator escalates both, plus pending decision (b). Resume order in the summary §12.

---

## Build and Test — author decisions on E-1 and the labeller route
**Timestamp**: 2026-10-08T22:30:00Z
**User Input**: "Labeller: Gemini CLI on Google login. SO4 floor: Add E7 projects, then report." (The author chose the CLI route for the panel; for SO4, freeze five E7 projects and recount, and if still below 80, run with the actual N and report the deviation.)
**AI Response**: "Recorded as ADR-019 with the orchestrator settlements: base-preparation rule for ghostfolio, E7 specs as a dated additive registration, live-call budget 200 for E-2, E1 orderSeed 20261008. Build and Test resumes."
**Context**: CONSTRUCTION, Build and Test, escalations E-1/E-2

---

## Build and Test — ADR-019 item 4 labeller route (Gemini CLI) probe: HALT, PR #15 merged
**Timestamp**: 2026-10-09T02:28:24Z
**User Input**: "Implement the ADR-019 item 4 labeller route: probe the Gemini CLI 0.46.0 Google-account route Gate H style (headless, JSON, no tools, extensions, MCP or ambient GEMINI.md, dedicated config home, auth source, model id, version pin, error classes, canary), at most 15 probe calls; if isolation holds add GeminiCliProvider, '--provider gemini-cli', cassettes and tests, pin the model id; run llm-label --estimate; stop and report if the CLI needs a sign-in or cannot be isolated." (Orchestrator task under the standing approval.)
**AI Response**: "Probe aae310a, PR #15 green and merged (5542571). Isolation mechanism found in the 0.46.0 bundle: GEMINI_CLI_HOME (+HOME) dedicated home, env -i allow-list, GOOGLE_APPLICATION_CREDENTIALS pointing at the author's oauth_creds.json, so the credentials are reused without being read or copied (size and mtime unchanged), GOOGLE_GENAI_USE_GCA=true, GEMINI_SYSTEM_MD persona, GEMINI_CLI_SYSTEM_SETTINGS_PATH frozen settings (tools.core [], admin mcp/extensions/skills off, builtin extensions disabled, context.fileName override, auto-update off), --extensions none, --allowed-mcp-server-names __none__. Every spawn that reached auth was refused by the Code Assist backend before any model request: IneligibleTierError UNSUPPORTED_CLIENT, free tier 'Gemini Code Assist for individuals' ('no longer supported ... migrate to the Antigravity suite'); headless json gives exit 1 with empty stdout. 5 spawns, 3 reaching auth, 0 model requests. HALT per ADR-019 item 4: no GeminiCliProvider, no --provider gemini-cli, no model pin; canaries, model id and envelope not verifiable. llm-label --estimate on the only committed plan (tests/fixtures/u5b/labels/plan.json): 40 calls <= 200; no real label plan exists before E1/E7/SO4 (prereg budget 4000). Evidence in tests/fixtures/gemini-cli/, ledger section added. Dedicated home removed."
**Context**: CONSTRUCTION — Build and Test, ADR-019 item 4; live labelling halted, author to pick the route. No snapshot change, no CHANGES.md line, judge ledger unchanged.

---

## Construction — ADR-020 (P-2) methodology corrections, implementation lane (PR #17, draft)
**Timestamp**: 2026-10-09T06:45:00Z
**User Input**: "Implement ADR-020 (P-2) in a worktree on v1.2e-p2-methodology: commit the Fable adversarial review verbatim, implement items A1-A3, A5-A8 and the B1-B7 reporting duties, then bump the pre-registration after P-1 has landed on v1.2e (wait up to 3 h), rerun --check-prereg for every plan, and merge once CI is green." (Orchestrator task under the standing approval.)
**AI Response**: "Review committed as Docs/DiagnosticRuns/methodology-review-2026-10-08.md (eb4a9c1). Code (860f4de, 0a17cb7, 098be2d, 314d586, 8749914): baseline precision (scripts/lib/baseline-precision.ts; precision_baseline.csv, precision_figure.csv, precision_baseline columns); MAT-10 TP-class subtraction and TP-class FPAT weighting 1/p; cell-level recall intervals (ci_* = (project, operator) cell, ci_project_* co-primary, ci_independent_* bound); MAT-19 neural_new column; descriptive pairwise CIs, ahsDeterministic co-primary, directional self-preference check; agreement rows per source and generator model with the E1 headline and uncertain as a category; corpus-core / corpus-e7 strata; register-prereg --matching-rule-version. Docs (2b0f904): analysis-plan §10 Reporting duties and §11 amendments, matching-rule MAT-04/10/19/20 text, so4-heldout symbolic-only, dated BR-U5b-10/19/20/43/61/64/65 and U4 notes. Gates: T 5/5 clean; U 2916/207 with 2 load-induced timing failures that pass when rerun alone; L 497 errors (unchanged); B 80, 0 TS2688; G 80/7, snapshot hashes unchanged; U5b --self-test CLIs exit 1; PR CI green. P-1 (prereg v2, PR #20) had not landed on origin/v1.2e after 3 h of polling, so the P-2 bump (matching rule 1.1.0, prereg v3) was not made and PR #17 stays draft."
**Context**: CONSTRUCTION — ADR-020 P-2, awaiting P-1. Open: merge origin/v1.2e after P-1, set the machine block and expected.canonical ruleVersion to 1.1.0, bump with --matching-rule-version 1.1.0 and per-artefact reasons, run --check-prereg on every plan, mark ready, merge.

---

## Construction — ADR-020 P-M (registered as P-2 in the task) bump and merge, PR #17 merged (auto-approved)
**Timestamp**: 2026-10-09T09:51:00Z
**User Input**: "Restart the P-2 work, mindful of memory: after P-1 has landed, merge origin/v1.2e, keep the prereg bump after P-1, rerun --check-prereg for every plan, mark PR #17 ready and merge it once CI is green." (Orchestrator task under the standing approval.)
**AI Response**: "Resumed the existing lane (worktree DaedalusArch-wt-p2). P-1 had landed (prereg v2, 02fbb2f, PR #20); the P-M bump a83de82 (prereg v3, matching rule 1.1.0; per-artefact reasons in Docs/prereg-reasons.md section P-M) was already on the branch above it. Merged origin/v1.2e (50ed187, SO5-gen PR #18) cleanly as 364a588. Gates at 364a588: T clean; U 2988 / 214 suites, 0 failed; L 497 errors (= L_BT), changed scripts/** 0 errors; B 80, 0 TS2688; G 80 / 7, 0 skipped, snapshot hashes = BT_SNAPSHOT_HASHES; all 11 U5b --self-test CLIs exit 1. --check-prereg: all six plans refuse on Docs/generator-protocol.md only, which 44e6dd4 (SO5-gen, its §11 'carried by the P-U6 bump') changed after P-1; ADR-021 item 4 orders P-1, P-M, P-U6, so this file is P-U6's to register. With that file at its registered bytes (445a09b) all six plans print 'pre-registration v3 ok: 36 registered artefacts unchanged'. PR #17 marked ready, CI green (runs 37913078158, 37913086353), merged as 0d7a271; main untouched."
**Context**: CONSTRUCTION — ADR-020 P-M done. Open for P-U6: register Docs/generator-protocol.md (and experiments/e1-grid/generator-plan.json) in the next bump; until then --check-prereg refuses every plan (PREREG_REFUSED artefact-changed). Stale uncommitted audit/plan edits of the closed PR #16 lane were found in this checkout, stashed for the rebase and restored uncommitted.

---

## CONSTRUCTION — ADR-020 P-M follow-up review fixes (PR #22)
**Timestamp**: 2026-10-09T10:13:35Z
**User Input**: "Restart work, mindful of memory." (Orchestrator task under the standing approval: fix the P-2 (P-M) review findings with follow-up commits and a follow-up PR.)
**AI Response**: "Dispositions: (1) blocking-external, generator-protocol.md unregistered change: confirmed on v1.2e a1d31c0, where --check-prereg refuses all six plans on Docs/generator-protocol.md only (44e6dd4, SO5-gen §11). Not a P-M defect, no P-M change. It belongs to P-U6. (2) major, same root cause plus generator-plan.json not registered: deferred to the single P-U6 bump (ADR-021 item 4, SO5-03), ordered after P-M. Registering generator-plan.json also changes the closed BR-U5b-51 artefact list, which is U6 lane code. No interim bump, because ADR-021 item 4 asks for one P-U6 bump. The B&T plan now records that every plan is gate-refused until P-U6. The CI --check-prereg step is deferred until after P-U6, since before then it would turn every PR red. (3) major, ADR-020 item 3 vs analysis-plan §5: ADR-020 item 3 amended. The project bootstrap is co-primary only with >= 10 projects, else descriptive (ci_project_descriptive), citing BR-U5b-61 and 8353f3c; with 7 so4-heldout projects the cell interval is the sole primary interval. The small-cluster primary alternative (cluster-robust t, df = projects - 1, or BCa) is recorded as an open author option, not adopted, because it would change a registered artefact and need its own bump. The ADR file is not registered, so prereg stays v3. Commit 7300197, PR #22 CI green, merged as 942a023. Gates: T clean; U 2993 passed; L 497 (no new); B exit 0; G docs-only (CI golden green); the U5b --self-test CLIs exit 1. No live LLM calls, no runs; main untouched."
**Context**: CONSTRUCTION — ADR-020 P-M follow-up done. Open: P-U6 (U6 lane) must register Docs/generator-protocol.md and experiments/e1-grid/generator-plan.json, then rerun --check-prereg for all six plans.

---

## CONSTRUCTION — U6 merged (auto-approved): registration P-U6, prereg v4 (PR #34)
**Timestamp**: 2026-10-09T15:59:37Z
**User Input**: "Registration stage P-U6: implement ADR-021 items 5, 7 and 8, register the threats register, bump the pre-registration, run --check-prereg on every plan, run an end-to-end fixture dry run with the Mock provider, write the runbook and the code summary, merge by PR." (Orchestrator task under the standing approval.)
**AI Response**: "U6 merged (auto-approved). PR #34 (v1.2e-u6-register) merged with --merge as e2b78da after CI passed on both runs; the pull-request run's new check-prereg step printed 'pre-registration v4 ok: 65 registered artefacts unchanged' for all seven plans. P-1 (v2) and P-M (v3) had landed first. Item 8: label-plan config v2 (P3 out of live labelling, P2 30 PPS, escalation by whole weeks to 4 weeks / 720 calls with no refusal, stated P1 + MS basis, per-kind context ceilings, audit seed 6105), Kish n per row, kappa/AC1 bootstrap CIs and taxonomy_rule, agy invocations counted, plan-drawn label-blind audit, FPAT N/A without P3 labels; aggregate latency.csv columns of the SO2 follow-up. Item 5: seven held-out entries in so4-heldout, three E7 bases in e7-corpus, count inputs and chain tools registered without a recount. Item 7: generator-protocol and generator-plan registered, CI step added. Registry adds Docs/threats-to-validity.md and Docs/labeller-route.md. Prereg v4, 65 artefacts, reasons in Docs/prereg-reasons.md section P-U6; ADR-021 item 10 records the decisions. Dry run (scratch clone, Mock judge and labeller, lane lock, no LLM binary on PATH): every stage handed off; three gaps fixed (so4-plan-entries CLI, labeller-shaped Mock, optional --bases). Gates: T clean; U 3257 passed, 1 env-only failure (cli.test neo4j-uri default under exported NEO4J_URI, same on v1.2e); L no new errors; B 80, 0 TS2688; G no src change. No live LLM call, no registered run, no Neo4j container started; main untouched."
**Context**: CONSTRUCTION — U6 Integration closed. Runbook aidlc-docs/construction/build-and-test/experiment-runbook.md; summary aidlc-docs/construction/v1.2E-u6-integration/code/code-summary.md. BT-B, BT-E, BT-F may resume. Open: so4-heldout seeded entries after mutate (own bump), labeller token figure in Docs/labeller-route.md section 6 (now a bump), SO5-08 residual (live), TV-84 author decision, B&T plan wording of the CI step (BT lane). Committed from the main checkout's repository onto origin/v1.2e with a temporary index (pathspec aidlc-docs/audit.md only); the checkout's uncommitted audit and plan edits were left untouched.

---

## Build and Test — SO4 held-out: operator diagnosis (ADR-024), prereg v8, symbolic-only run
**Timestamp**: 2026-10-09T20:55:00Z
**User Input**: "Diagnose operators first: find why 10 golden mutants fail tsc, fix only operator defects (no k or catalogue change), fix runbook 3.2 and the 1.6/flows-to output paths, re-seed and recount, then run SO4 stage 3 symbolic-only and score strict; no E7, E1, full mode or live LLM."
**AI Response**: "All 10 golden typecheck rejections reproduced with the same seeds and sites; none is an operator defect (data-shape interfaces/classes receiving object literals or spreads cannot take added required members or a private field; default import of express without esModuleInterop). No code change, so re-seeding reproduces the manifest: golden N = 75 (85 registered, floor 80, shortfall 5, ADR-019 item 1). ADR-024 and runbook fixes merged (PR #39). Seeded plan entries (7 + 156) registered as prereg v8 (P-SO4; no v8 for ADR-024 since no registered hash changed); --check-prereg ok on all 7 plans. so4-heldout: 163 runs accepted; score case 156 paired. Strict held-out: TP 67, FN 8, FP 13; recall 0.893 (cell bootstrap 0.787-0.974, 40 cells), in-coverage 0.971; seeded differential precision 0.838 (0.719-0.970); F1 0.865 (0.784-0.943). FN: MO-X01 6/6 (outside coverage, dynamic import gives no edge, FR-34); MO-S01 2/2 on v-aguiar__valex, where the layered spec allows business->persistence, so the expected FF-S01 key is an oracle error. FP: all 13 from MO-CV02 renames re-keying pre-existing FF-P02/FF-P04/FF-SO01 violations by the new class name. Label-dependent outcomes pending."
**Context**: CONSTRUCTION — Build and Test, runbook stage 3 (3.3-3.7) plus strict aggregate (results/so4-heldout/agg-strict). Committed from worktree ../DaedalusArch-wt-ops on branch v1.2e-so4-heldout; the main checkout's uncommitted files untouched.

---

## Build and Test — SO4 scoring fixes (ADR-025, POST-HOC), prereg v9, corrected re-score, baseline spot check
**Timestamp**: 2026-10-09T21:40:00Z
**User Input**: "Fix scoring, spot-check, then decide E7: wire the MAT-04 remap for MO-CV02 renames (or amend minimally), add the MO-S01 style guard as an expectation, fix the MO-DF01n constructor precondition, record ADR-025 POST-HOC with one prereg bump, re-score SO4 from the existing runs beside the strict score, and spot-check ~20 baseline violations; no E7, E1, full mode or live LLM."
**AI Response**: "MAT-04's registered remap moves lines only (line is not in the key), so it cannot cover class-name re-keying; matching rule 1.2.0 adds MAT-04a (baseline discriminators of the renamed class mapped to the new name before the difference), with a unit test reproducing truthy-demo:MO-CV02:0. MO-S01 under layered: dependency-direction expected disabled (expectation guard; catalogue untouched). constructorLiterals rejects private/protected constructors. Prereg v9 (matching rule only); --check-prereg ok on all 7 plans. Re-score from the stored runs: strict TP 67 / FN 8 / FP 13 (R 0.893, P 0.838, F1 0.865, N 75) vs corrected TP 67 / FN 6 / FP 0 (R 0.918, P 1.000, F1 0.957, N 73); twins 60/73 vs 68/73. Spot check (agent-only, informal, seed 20261009): 6 real, 6 false alarm, 8 debatable of 20; false alarms from FF-CV05, FF-C03, FF-SO01 on controllers, FF-C02 on Nest modules."
**Context**: CONSTRUCTION — Build and Test, post-SO4 scoring correction (results/so4-heldout/score-corrected.json, agg-corrected/, case-corrected/; strict files unchanged). Worktree ../DaedalusArch-wt-score, branch v1.2e-fix-scoring; main checkout's uncommitted files untouched. E7 decision pending with the author.

---

## Build and Test — Instrument v2 role exemptions (ADR-026 draft, POST-HOC, pending Fable review)
**Timestamp**: 2026-10-09T22:40:00Z
**User Input**: "Tune noisy rules now as a declared instrument v2 before E7 and E1: derive every change from rule intent and common conventions (never from the spot-check items), declarative exemptions only, no structural rule or SO4 seeded detection change, measure baseline per function on the 7 held-out and 4 core bases, new spot check with seed 20261010, keep v1 results intact, ADR-026 draft, analysis-plan statement, prereg v10 prepared, draft PR, no merge before Fable review; no E7, E1, full mode or live LLM call."
**AI Response**: "Library-level role exemptions (src/fitness-compiler/role-exemptions.ts, exported into frozen-instrument roleExemptions): FF-CV05 skips declaration-only files (dto, interface, type, enum, index) and composition roots (main.ts, *.module.ts); FF-C02 and FF-C03 skip composition roots. FF-SO01, FF-C06, FF-P01 unchanged (SO01: MO-SO01 seeds a controller and module classes; P01: fix would be a layer-mapping change). SO4 symbolic-only re-run (results/so4-heldout-v2): TP 67, FN 6, FP 0 identical to v1 corrected, twin specificity 68/73 -> 71/73, CV05 collateral 26 -> 13; v2 baselines equal v1 minus exempted rows on all 7 bases. Baseline (all 7) 1066 -> 824 (CV05 560 -> 365, C03 83 -> 53, C02 27 -> 10; core 4: 758 -> 546). apg-ablation re-run (results/apg-ablation-v2): gate pass, ablation deltas unchanged. Spot check v2 (seed 20261010, informal agent check): REAL 6, FALSE 4, DEBATABLE 10. Unit tests 3300+ pass. Zero live calls."
**Context**: CONSTRUCTION — Build and Test, post-SO4 instrument v2 (ADR-026 draft). Worktree ../DaedalusArch-wt-tune, branch v1.2e-instrument-v2; v1 results untouched; draft PR, not merged.

---

## Build and Test — ADR-026 Fable review fixes, prereg v10, final v2 re-runs, merge
**Timestamp**: 2026-10-10T00:30:00Z
**User Input**: "Fable review of PR #42 is MERGE WITH FIXES (author approved merge once fixed): drop the index.ts glob; per-glob FF-CV05 breakdown; name the known-cost files; --instrument v1|v2 switch stamped into reports and RunRecords, v1 identical to the registered v1 reports, febc918 the last v1 commit; fix the B8/§3 P2 contradiction (P2 from v2 plus a v1-only stratum, n and n_eff per version); re-run SO4 v2 and apg-ablation v2 under the final prereg; disclose AHS/verdict drift and the differing agg files; TV row; Ch7 reporting duties in ADR-026; then ready, CI green, merge, remove the worktree."
**AI Response**: "index.ts glob dropped (twin specificity 68/73 as v1; three nestjslatam twin rows explained as a twin-site artefact; two empty index.ts files named as residual noise). --instrument v1|v2 added to firewall evaluate and run-experiment-cli; instrumentVersion stamped into reports and RunRecords (schemas amended, optional). SO4 plan under --instrument v1: 163/163 reports with the same violations, AHS and verdict as the registered v1 reports. Draft v10 reverted; v10 registered over frozen-instrument.json, analysis-plan.md (B8, P2 row 24 v2 + 6 v1-only) and threats-to-validity.md (TV-97). Final v2 runs under v10 into results/so4-heldout/v2 and results/apg-ablation/v2 (the earlier sibling dirs violated the results guard and were removed): TP 67, FN 6, FP 0 unchanged; baseline all 7 1066 -> 826, core 4 758 -> 546; CV05 removed per glob module 102, dto 76+1, interface 11, type 2, enum 1; AHS drift only zhuravlevma 0.538 -> 0.571 (29 ahs_by_project rows, no report verdict change; rescore files differ). Spot check redrawn on the final reports: REAL 6, FALSE 5, DEBATABLE 9 (informal). Zero live calls."
**Context**: CONSTRUCTION — Build and Test, ADR-026 accepted after review; worktree ../DaedalusArch-wt-tune, branch v1.2e-instrument-v2, PR #42.

---

## Build and Test — E7-x corpus extension (ADR-027), prereg v11
**Timestamp**: 2026-10-10T02:30:00Z
**User Input**: "Prepare an expanded E7 corpus under the 2026-10-09 author decisions (owner cap 1 per E7-x round, pnpm/yarn only if install supports them reproducibly, C2 20-800 with a dated NFR-v1.2E-07 note, the researcher's Q7-Q10 / E-H-F-R / tiering / seeded tie-break / shortfall extension, AI files recorded only): report the hexagonal library status, write ADR-027 and the criteria before regenerating the list, regenerate and draw mechanically (top tier up to 6 if no number), fetch/spec/prepare/type-check/parity each selection and exclude failures without repair, store research fix pairs as data, one prereg bump, judge-volume estimate, merge by PR; SO4 frozen; stop before any E7 run, no judge or LLM call."
**AI Response**: "No hexagonal template or preset exists (template-registry: clean-architecture, nestjs, layered; presets the same three); Q7/Q8 map to clean-architecture. Lock files: fetch-corpus, the corpus schema, select-corpus and prepare-bases support only npm-ci-ignore-scripts on package-lock.json; pnpm absent on the host, yarn unpinned; adding support judged not small, so C5 stays npm-only (41 pnpm-only and 53 yarn-only candidates excluded). ADR-027 + criteria §7 committed (8f93521) before the list; select-corpus --extension (+tests); candidates-e7x.json 246 candidates, 22 eligible; selection-e7x.json (addMax 6, no eligible layered, no owner-cap hit): zhuravlevma/typescript-ddd-architecture, raouf-b-dev/ecommerce-store-api, fairnesscoop/permacoop, khusenov/backend-boilerplate, pvarentsov/typescript-clean-architecture, DanielAraldi/mailer. Admitted (E7 only): zhuravlevma__typescript-ddd-architecture, raouf-b-dev__ecommerce-store-api (0 tsc errors, parity OK). Excluded without repair: permacoop (spec invalid, rule 5b), khusenov (43 tsc errors), pvarentsov (9), DanielAraldi (4). 5 fix pairs stored (corpus/real-violation-pairs.json, data only). E7 judge-volume 1002 calls (ceiling 1089; was 760/847), ladder step 2 would give 534. Prereg v11; --check-prereg ok on all 7 plans. Zero judge or LLM calls."
**Context**: CONSTRUCTION — Build and Test, pre-E7 corpus extension. Worktree ../DaedalusArch-wt-e7c, branch v1.2e-e7-corpus-ext; main checkout's uncommitted files untouched. E7 not run.

---

## Build and Test — P2 v1-only stratum in the label-plan producer (ADR-026 implementation note), prereg v12
**Timestamp**: 2026-10-10T04:00:00Z
**User Input**: "Implement the P2 v1-only stratum set exactly as ADR-026 and analysis plan B8 specify (v2 e7-corpus population plus the rows the v2 role exemptions remove). It needs its own inclusion probabilities, a registered size in corpus/label-plan-config.json, Kish n_eff per estimate, and precisionStatement rows for the v1 and v2 estimates. Use hand-computed test fixtures only and never touch the running E7 worktree. Make one dated prereg bump if a registered artefact changes, with --check-prereg passing on all plans. Merge by PR once CI is green and remove the worktree."
**AI Response**: "build-label-plan now takes --corpus-v1-runs: the --instrument v1 symbolic-only re-evaluation of each accepted e7-corpus run, stamped instrumentVersion 1. The v1-only rows are the violation keys of each v1 report that its v2 pair (same project and spec) lacks. Their strata are named 'v1-only: <project>, <function>'. Each frame is drawn by §4 PPS with its own m (24 and 6), its own inclusion probabilities, and its own seeded stratum-draw stream. The plan is refused when either side has an unpaired run, when a v1 stamp is missing, or when a v2 row is absent from v1. A frame that cannot fill its share leaves it unused. When the budget lowers P2 to L items, the v1-only share is floor(6 L / 30). The precision rows are now v2 (the v2 items), v1 (all P2 items with Kish over the combined weights) and v1-only (counts only); they replace 'P2 baseline precision, overall'. corpus/label-plan-config.json is version 3, with sampled.P2.v1OnlyMaxItems 6 and maxItems still 30, so the total stays 300 calls. Analysis plan B8 now names the producer rules and §11 gains a row; ADR-026 gets an implementation note. Tests are hand-computed. Producer: v2 pi 1 (certain) and 1/3, v1-only pi 1/2 and p 1/4, n_eff 2 (v2) and 100/34 (v1). Registered sizes: 24 x w2 plus 6 x w4 give n_eff 24 (+/-0.186) and 27 (+/-0.176). Unit tests pass: 3305 before the new cases, all suites green. Prereg v12 (2 artefacts changed); --check-prereg reports v12 ok on all 7 plans. No E7 output was read, and there were no Neo4j or LLM calls. Open follow-up: scripts/lib/baseline-precision.ts still pools every P2 label. That pooled figure is the v1 estimate. The v2 row must filter out the 'v1-only: ' strata (p2FrameOf) before labels are aggregated."
**Context**: CONSTRUCTION — Build and Test, pre-labelling producer change. Worktree ../DaedalusArch-wt-lp, branch v1.2e-labelplan-v1stratum. The E7 run in ../DaedalusArch-wt-e7run was not touched. Its RunRecords will carry prereg v11, while the label plan is now registered under v12.

---

## Build and Test — E7 corpus run (runbook §4), prereg v11, instrument v2
**Timestamp**: 2026-10-10T04:35:00Z
**User Input**: "go E7: run experiments/e7-corpus/plan.json (9 bases, full mode, live pinned judge) exactly as registered; ladder only by its registered trigger; let usage stops pause and resume; then the registered E7 aggregation, the P4 judge-verdicts file and the P2 pool, the v1 symbolic sensitivity row; label-dependent outcomes pending; PR into v1.2e."
**AI Response**: "Stage 0b done (P-4); 0c estimate 1002 calls (ceiling 1089). Gate: pre-registration v11 ok (69 artefacts); after merging origin/v1.2e, v12 ok with the v11 records. Preflight: judge CLI 2.1.294 = pin, config-dir placement none, listing pass 0 failures; per-run init probe passed on all 9 (tools StructuredOutput, no MCP, apiKeySource none, model claude-opus-5-5). First attempt stopped at the init probe ('Not logged in') with 0 judge calls: run-experiment CLI_ENV_ALLOW dropped USER, so the judge child could not reach its keychain login; fixed by adding USER and LOGNAME (855ff88, test added; no registered artefact changed), failed attempt discarded uncommitted. Second run: 9/9 accepted, attempt 1, no usage-limit stop, no pause. Judge calls 1002 = 9 init probes + 993 judged runs (FF-N01 456, FF-N02 537), equal to the estimate; 993/993 outcomes valid, 0 parse/invalid/retry, resolved model claude-opus-5-5 throughout. No ladder step (trigger never reached). Units: FF-N01 152 valid, 31 fail (20.4 %); FF-N02 179 valid, 42 fail (23.5 %); 0 flagged unstable; 20/331 units had a split 3-run vote. AHS det -> combined, verdict: realworld 0.721->0.743 warning; ghostfolio 0.387->0.437 hard-block; truthy 0.387->0.441 hard-block; dry-run 0.504->0.547 soft-block; nestjs-active-record 0.571->0.608 soft-block; nestjslatam 0.354->0.411 hard-block; valex 0.553->0.591 soft-block; typescript-ddd 0.392->0.443 hard-block; ecommerce-store 0.175->0.247 hard-block. Aggregation 7.3 into results/e7-corpus/agg (label-dependent tables header-only). P2 pool / P4: a first build-label-plan (--corpus-runs only, pre-v12 producer) drew P2 30 with no v1-only split and P4 0; after merging prereg v12 (PR #44, v1-only stratum producer) that draw is superseded and was removed. The v12 producer refuses without --corpus-v1-runs (RunRecords stamped instrumentVersion 1), and no registered route yields symbolic-only v1 RunRecords for the full-mode e7-corpus plan (run-experiment takes the mode from the plan; --instrument v1 on it would re-spawn the judge, at least the 9 init probes), so the P2 pool and judge-verdicts file are open: they need a registered symbolic-only v1 route (plan or flag, a prereg bump) and then 6.1. P4 holds no E7 units by registration (E1 + fixtures). v1 sensitivity: symbolic-only evaluate --instrument v1 on the same 9 trees, results/e7-corpus/v1/ahs_v1_sensitivity.csv; v1 -> v2 symbolic violations differ only in FF-C02/C03/CV05; AHS det equal except nestjs-active-record 0.538 -> 0.571 (as in SO4). Repetition reliability: not registered for E7 (repetition 0 only; sub-study is fixtures). Labelling outcomes pending."
**Context**: CONSTRUCTION — Build and Test, E7 run. Worktree ../DaedalusArch-wt-e7run, branch v1.2e-exp-e7.

---

## Build and Test — labelling inputs (P2 v1 side, prereg v13, label plan dry run)
**Timestamp**: 2026-10-10T05:17:15Z
**User Input**: "Prepare the labelling inputs with no live LLM call: register a symbolic-only v1 route for the e7-corpus runs plus a B8 mode-pairing rule (prereg v13) and run it; drop the v1-only strata from the v2 baseline-precision rows; build the real label plan in dry run with its --estimate; check raouf's C2 file count."
**AI Response**: "experiments/e7-corpus-v1sym/plan.json registered: symbolic-only, instrument v1 (new optional plan field `instrument`; run-experiment refuses a different --instrument with PLAN_INVALID), the nine e7-corpus entries, seeds 7201..7203. build-label-plan mode-pairing rule: v1 must be symbolic-only and v2 full or symbolic-only; pairs match by project and spec sha; only symbolic rows are compared; refusals are tested. It is documented in Docs/analysis-plan.md section 10 B8 as an implementation rule (plus a section 2 row and a section 11 row). baseline-precision: the v2 rows drop the `v1-only: ` strata (p2FrameOf), and v1 overall and v1-only counts-only rows follow. aggregate gains the precision_baseline.csv `instrument` column, and the PRF columns and the figure keep only the v2 rows. Prereg v13 (Docs/prereg-reasons.md P-V1S): --check-prereg ok on all 8 plans (70 artefacts). Run under the lane lock on 7693: 9/9 accepted, instrumentVersion 1, preregVersion 13, 49 s, 0 model calls, no absolute path in results/e7-corpus-v1sym. Label plan (runbook 6.1 with --corpus-v1-runs results/e7-corpus-v1sym; e1-grid and fixtures not yet run, so P4 is 0): P1 34, MS 2 (6 mechanical FN causes), P2 30 (v2 24 + v1-only 6), P3 0, P4 0. The pairing was accepted on all nine pairs. llm-label --estimate: 132 calls + 30 reserve <= 300; at least 2 weeks of quota. Precision: P2 v2 n 24, Kish n_eff 11.5 (+/-0.250 at p = 0.5); P2 v1 n 30, n_eff 15.8 (+/-0.221); v1-only n 6, n_eff 5.4 (counts only); P1 n 34, n_eff 34. The v2 n_eff is below B8's 24 because the PPS draw has certainty strata, so the weights are unequal. The results guard now allows results/labels/ (it has no RunRecords). raouf: the C2 recount from the git tree gives 793, as registered. The parse total of 819 adds tsconfig-included test/ (21), scripts/ (4) and data-source.ts. This is recorded in Docs/corpus.md, and nothing is wrong. No live labelling."
**Context**: CONSTRUCTION — Build and Test, labelling preparation. Worktree ../DaedalusArch-wt-lab, branch v1.2e-labelling-prep.

---

## Build and Test — ADR-028 Option C implementation (proportional variant, judge diagnostics, prereg v14, E7 replay)
**Timestamp**: 2026-10-10T15:43:07Z
**User Input**: "Implement ADR-028 Option C: a proportional neural aggregation variant beside the registered rule (registered stays default and primary), the judge diagnostics as a pre-specified descriptive analysis with a mechanical coding frame, re-score E7 from the recorded cassettes only in replay mode with zero new judge calls into results/e7-corpus/agg-proportional/, a dated prereg v14 bump registered before E1, and a draft PR for Fable review."
**AI Response**: "Variant proportional-inclusion-weighted-v1 (analysis plan section 12.2): Hajek share of failed judged units, layer strata weighted N_h / V_h for the capped round-robin selection, failed unit = its own U3 confidence weight (0.2 unstable), split vote 0 in the denominator, invalid units left out; AGG-05/09, AVR, renormalisation, AHS, thresholds and verdict source unchanged. --neural-aggregation on evaluate, run-experiment (with --cassette-mode), aggregate; stamped in scoring.neuralAggregation and RunRecord neuralAggregation/cassetteMode; candidatesByLayer persisted; rescore neural:proportional row. Judge diagnostics: scripts/judge-diagnostics(-cli).ts with the registered judge-coding-frame block (1.0.0). Prereg v14 (analysis-plan.md, frozen-instrument.json), --check-prereg ok on all 8 plans. E7 replay: registered replay reproduced all 9 stored reports (AHS, verdicts, judge units, violation ids); proportional replay 9/9 accepted; cassettes 993 files, fingerprint unchanged, 0 judge calls; verdict changes 0 of 9; ahsCombined delta -0.005 to -0.021. Diagnostics: 331 units, 0 vote mismatches; the keyword frame does not separate fail from pass rationales (negation noise), reported as a limitation. Draft PR into v1.2e, do not merge until Fable review."
**Context**: CONSTRUCTION — Build and Test, ADR-028. Worktree ../DaedalusArch-wt-adr28, branch v1.2e-adr028-proportional. Auto-approved under the standing approval (2026-10-08).

---

## Build and Test — ADR-028 Fable review fixes (prereg v15)
**Timestamp**: 2026-10-10T16:04:54Z
**User Input**: "Fable review of PR #47: MERGE WITH FIXES. Apply the fixes as follow-up commits (variant undefined for SEL-07, bias toward clean and the confidence-free share, the judge-effect decomposition and any-fail companion, coding frame 1.1.0, provenance columns and derived reading, the E1 two-pass runbook step, report wording), bump prereg v15 after the code and before E1, then mark the PR ready and merge when CI is green."
**AI Response**: "Code fd4f19f, plan text f03f972, prereg v15 (analysis-plan.md, frozen-instrument.json), --check-prereg ok on all 8 plans. E7 recomputed from stored reports with 0 judge calls: W_n 0.080, delta_judge (registered) 0.000 on all 9 projects, judge_mattered 0 of 9, delta_dilution 0.022-0.072; proportional moves no verdict, any-fail moves one (dry-run-test soft-block to hard-block). Frame 1.1.0 on E7 (post hoc): messages on 73/73 fail and 0/258 pass carriers; informative code JC-N01-DUP only (0.323); rules_also_flag 63 of 73 failing units. No spec weight changed."
**Context**: CONSTRUCTION — Build and Test, ADR-028 review fixes. Worktree ../DaedalusArch-wt-adr28, branch v1.2e-adr028-proportional.

---

## Build and Test — ADR-028 judge-weighted sensitivity variant (prereg v16)
**Timestamp**: 2026-10-10T18:15:00Z
**User Input**: "Keep 8%, add weighted variant: keep the registered weights primary (W_n = 0.08) and pre-register before E1 a judge-weighted sensitivity variant (judge dimensions 2/7, symbolic scaled proportionally, same thresholds), computed from the stored reports under the registered, proportional and any-fail aggregations, written beside the compare-aggregations rows with tests; register it in analysis plan section 12 with its rationale (E7 post hoc, E1 pre-registered) and an ADR-028 note; compute and report the E7 post-hoc reading; one dated prereg bump to v16."
**AI Response**: "judge-weighted-v1 in scripts/compare-aggregations.ts (3daf1cc): the executed effective weights rescaled to judge 2/7 and symbolic 5/7, bound -2/7; columns appended, existing columns byte-identical on E7; hand-computed fixtures. Analysis plan section 12.5, B9 rules (iv)-(v), section 11 row, ADR-028 note, runbook sentence (543ebb6). Prereg v16 (analysis-plan.md only), --check-prereg ok on all 8 plans. E7 (POST HOC, 0 judge calls, from stored reports): under the judge-weighted weights the judge moves 0 of 9 verdicts with the registered aggregation (every neural AVR 0), 2 of 9 with the proportional (ghostfolio-test soft-block to hard-block, realworld-test pass to warning) and 8 of 9 with any-fail. The reweighting alone moves 7, 5 and 2 verdicts against the registered-weights verdicts; most of these moves are upward, a larger dilution artefact (2/7 instead of 0.08), and are not judge effects. No spec weight changed."
**Context**: CONSTRUCTION — Build and Test, ADR-028 follow-up. Worktree ../DaedalusArch-wt-jw, branch v1.2e-judge-weighted-variant. Auto-approved under the standing approval (2026-10-08).

---
