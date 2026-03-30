# Functional Design Plan — Unit 2: APG Extractor

## Unit Context
- **Unit**: U2 — APG Extractor
- **Component**: C1 (`src/apg-extractor/`)
- **Stories**: US-1.1, US-1.2, US-1.3, US-1.4, US-1.5, US-1.6
- **Dependencies**: U0 (scaffolding), U1 (shared domain types)
- **External**: ts-morph (TypeScript AST library)

## Assessment
Functional Design is REQUIRED for U2 because:
- Complex extraction algorithms (AST traversal for 5 node types + 7 edge types)
- Non-trivial resolution logic (barrel imports, path aliases, DI type resolution)
- Edge scoping decisions that affect graph fidelity for all downstream units
- Node ID generation strategy is critical for Neo4j deduplication (U4 dependency)

## Stage Decisions
- [x] NFR Requirements — SKIP (no new tech decisions; ts-morph is established)
- [x] NFR Design — SKIP
- [x] Infrastructure Design — SKIP (ts-morph is a library, not infrastructure)

## Plan Steps

- [x] Step 1: Generate targeted design questions (Q1–Q4) → `unit-2-apg-extractor-design-questions.md`
- [x] Step 2: Await user answers
- [x] Step 3: Analyze answers for ambiguity/contradiction — no contradictions, all clear
- [x] Step 4: Generate `business-logic-model.md` ✅
- [x] Step 5: Generate `business-rules.md` ✅
- [x] Step 6: Generate `domain-entities.md` ✅
- [ ] Step 7: Present completion + wait for approval
- [ ] Step 8: Log approval → audit.md, update aidlc-state.md

## Answers Summary
| Q | Answer | Decision |
|---|--------|----------|
| Q1 — Node ID | A | SHA-256({type}:{path}:{name})[0..16], deterministic |
| Q2 — DI Detection | C | Decorator-first + structural fallback |
| Q3 — CALLS scope | A | Cross-boundary only (different class/module) |
| Q4 — Barrel resolution | A | Transitive to ultimate source file (max depth 10) |

## Story Traceability
| Story | Covered By |
|-------|-----------|
| US-1.1 — Parse TypeScript Project | Step 4 (project parsing lifecycle, lenient mode) |
| US-1.2 — Extract Node Types | Step 5 (5 node type rules, BR-APG-01 to 06) |
| US-1.3 — Extract Edge Types | Step 5 (7 edge type rules, BR-APG-07 to 14) |
| US-1.4 — Resolve Complex Imports | Step 5 (barrel rules BR-APG-21 to 25, DI rules, decorator rules) |
| US-1.5 — Output APG as JSON | Step 4 (APGResult assembly) |
| US-1.6 — Report Parse Coverage | Step 5 (coverage rules BR-APG-30 to 35) |
