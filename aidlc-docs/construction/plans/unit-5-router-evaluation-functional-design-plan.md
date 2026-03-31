# Unit 5 — Neuro-Symbolic Router + Evaluation: Functional Design Plan

## Stage Assessment

| Stage | Decision | Rationale |
|-------|----------|-----------|
| Functional Design | **EXECUTE** | Complex routing, LLM integration, multi-run ICC, VCR mode, verdict merge |
| NFR Requirements | SKIP | Concurrency/retry handled inline |
| NFR Design | SKIP | N/A |
| Infrastructure Design | SKIP | LLM APIs + Neo4j already covered |
| Code Generation | **ALWAYS** | — |

## Unit Context

- **Components**: C5 (Router), C6 (Evaluation Engine), C7 (LLM Critic), S4 (LLMProvider), S5 (AuditLog)
- **Stories**: 15 total (US-8.1–8.3, US-9.1–9.2, US-10.1–10.8, US-11.1–11.2)
- **Dependencies**: U1 (shared types, LLMProvider interface), U3 (CompiledFunctions), U4 (GraphRepository for Cypher)
- **Depended by**: U6 (scoring consumes EvaluationResults), U7 (CLI orchestrates pipeline)
- **Existing stubs**: `src/neuro-symbolic-router/index.ts`, `src/evaluation-engine/index.ts`, `src/llm-critic/index.ts`

## Plan Steps

- [x] Step 1: Analyze unit context
- [x] Step 2: Create functional design plan (this document)
- [x] Step 3: Generate design questions
- [x] Step 4: Collect and analyze answers
- [x] Step 5: Generate business-logic-model.md
- [x] Step 6: Generate business-rules.md
- [x] Step 7: Generate domain-entities.md
- [x] Step 8: Present completion message and await approval — APPROVED
