# Unit 3 — Spec Parser + Fitness Compiler: Functional Design Plan

## Stage Assessment

| Stage | Decision | Rationale |
|-------|----------|-----------|
| Functional Design | **EXECUTE** | Complex YAML parsing (3-layer AoC), 26 Cypher templates, 4 ADR format parsers, template resolution system |
| NFR Requirements | SKIP | No special perf/security concerns — pure parsing library |
| NFR Design | SKIP | N/A (NFR Requirements skipped) |
| Infrastructure Design | SKIP | No infra — just YAML + string processing |
| Code Generation | **ALWAYS** | — |

## Unit Context

- **Components**: C3 (Spec Parser) + C4 (Fitness Compiler)
- **Stories**: 13 total (US-4.1–4.7, US-5.1–5.4, US-7.1–7.2)
- **Dependencies**: U1 shared types (FitnessFunction, ParsedSpec, ADRRule, CypherRule, etc.)
- **Depended by**: U4 (LayerMapping), U5 (CompiledFunctions for routing)
- **Existing stubs**: `src/spec-parser/index.ts`, `src/fitness-compiler/index.ts`

## Plan Steps

- [x] Step 1: Analyze unit context (stories, components, U1 types)
- [x] Step 2: Create functional design plan (this document)
- [x] Step 3: Generate design questions
- [x] Step 4: Collect and analyze answers
- [x] Step 5: Generate business-logic-model.md
- [x] Step 6: Generate business-rules.md
- [x] Step 7: Generate domain-entities.md
- [x] Step 8: Present completion message and await approval — APPROVED
