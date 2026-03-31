# Unit 5 — Neuro-Symbolic Router + Evaluation: Code Generation Plan

## Pre-Requisites
- U1 shared types: EvaluationResults, SymbolicFunctionResult, NeuronalFunctionResult, LLMProvider, etc.
- U3 CompiledFunctions, CypherQuery, NeuronalInstruction — need to add resultMapping to CypherTemplate
- U4 GraphRepository implementation for Cypher execution
- p-limit available (transitive dep)

## Steps

### Step 1: Extend CypherTemplate with resultMapping (U3 modification)
- [x] Add `ResultMapping` interface and `resultMapping` field to `CypherTemplate` in `src/fitness-compiler/types.ts`
- [x] Add `resultMapping` to all 24 templates in `src/fitness-compiler/cypher-templates.ts`
- [x] Run typecheck

### Step 2: Create evaluation-engine types + evaluator (`src/evaluation-engine/`)
- [x] `types.ts` — `SymbolicEvalInput`, `EvalErrorCode`, `EvalWarning`
- [x] `symbolic-evaluator.ts` — `evaluateSymbolic(input)`, query execution, result mapping via `ResultMapping`, threshold logic, violation collection
- [x] `index.ts` — public exports

### Step 3: Create llm-critic types + context assembler (`src/llm-critic/`)
- [x] `types.ts` — `NeuronalEvalInput`, `CriticVerdict`, `CassetteEntry`, `ContextPacket`, `TokenBudget`, `VCRMode`, error codes
- [x] `context-assembler.ts` — `assembleContext()`, `constructPrompt()`, token budget truncation
- [x] `verdict-parser.ts` — `parseVerdict(raw)`, JSON parsing, confidence clamping, validation

### Step 4: Create LLM providers (`src/llm-critic/providers/`)
- [x] `mock-provider.ts` — `MockLLMProvider` implementing `LLMProvider` (canned responses by prompt hash)
- [x] `claude-provider.ts` — stub (Anthropic SDK optional, real impl deferred until SDK available)
- [x] `openai-provider.ts` — stub (OpenAI SDK optional)

### Step 5: Create VCR cassette manager (`src/llm-critic/cassette-manager.ts`)
- [x] `saveCassette(entry)`, `loadCassette(functionId, runIndex)`, `cassetteExists()`
- [x] File-based: `fixtures/cassettes/{functionId}_{runIndex}.json`

### Step 6: Create LLM critic agent (`src/llm-critic/llm-critic.ts`)
- [x] `evaluateNeuronal(input)` → `DomainResult<NeuronalFunctionResult[]>`
- [x] Multi-run execution with concurrency limit (p-limit)
- [x] Stddev computation, unstable flagging
- [x] VCR mode integration (record/replay/bypass)
- [x] `LLMCriticAgent` class

### Step 7: Update llm-critic index (`src/llm-critic/index.ts`)
- [x] Public exports

### Step 8: Create router (`src/neuro-symbolic-router/`)
- [x] `types.ts` — `RouterInput`, `RouterErrorCode`, `RouterError`
- [x] `router.ts` — `routeAndEvaluate(input)`, mode filtering, symbolic/neuronal/hybrid dispatch, hybrid sequential (Q1:A), determinism tagging, result assembly
- [x] `RouterStage` implementing `PipelineStage<CompiledFunctions, EvaluationResults>`
- [x] `index.ts` — public exports

### Step 9: Unit tests — evaluation engine
- [x] Test Cypher execution with mocked GraphRepository
- [x] Test result mapping (filePathColumn, messageTemplate)
- [x] Test threshold logic (no threshold, explicit threshold, ratio)
- [x] Test query failure handling (skip + warn)

### Step 10: Unit tests — LLM critic
- [x] Test context assembly with token budget truncation
- [x] Test prompt construction
- [x] Test verdict parsing (valid JSON, invalid JSON, confidence clamping)
- [x] Test multi-run stddev + unstable flagging
- [x] Test VCR cassette save/load round-trip
- [x] Test MockLLMProvider

### Step 11: Unit tests — router
- [x] Test mode filtering (full, symbolic-only, neuronal-only)
- [x] Test hybrid sequential dispatch (skip neuronal if symbolic fails)
- [x] Test determinism tagging
- [x] Test RouterStage PipelineStage integration

### Step 12: TypeCheck + full test run
- [x] `npm run typecheck` — 0 errors
- [x] `npm run test:unit` — all passing

## Story Traceability
| Story | Coverage |
|-------|----------|
| US-8.1 | Step 8 (route dispatch) |
| US-8.2 | Step 8 (determinism tagging) |
| US-8.3 | Step 8 (symbolic-only mode filtering) |
| US-9.1 | Step 2 (Cypher query execution, violation collection) |
| US-9.2 | Step 2 (cycle detection via path traversal query) |
| US-10.1 | Step 3 (context assembly) |
| US-10.2 | Step 6 (semantic violation detection via LLM) |
| US-10.3 | Step 3 (structured verdict output) |
| US-10.4 | Step 4 (configurable LLM provider) |
| US-10.5 | Step 6 (temperature=0, fixed seed) |
| US-10.6 | Step 6 (multi-run, stddev consistency) |
| US-10.7 | Step 3 (rubric-based prompt construction) |
| US-10.8 | Steps 5, 6 (VCR cassettes, audit logging) |
| US-11.1 | Step 8 (merge symbolic + neuronal results) |
| US-11.2 | Step 8 (confidence metadata for U6 calibration) |
