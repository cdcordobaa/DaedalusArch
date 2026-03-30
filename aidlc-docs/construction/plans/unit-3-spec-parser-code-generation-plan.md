# Unit 3 — Spec Parser + Fitness Compiler: Code Generation Plan

## Pre-Requisites
- U1 shared types: `ParsedSpec`, `FitnessFunction`, `ADRRule`, `CypherRule`, `CompiledFunctions`, `CypherQuery`, `NeuronalInstruction`, `HybridPair`, `DomainResult`, `PipelineStage`, `FirewallContext`
- FirewallContext already has `setParsedSpec()` + `setCompiledFunctions()` — no U1 changes needed
- Existing stubs: `src/spec-parser/index.ts`, `src/fitness-compiler/index.ts`

## Type Alignment Note
U1's `evaluation.ts` defines `CompiledFunctions`, `CypherQuery`, `NeuronalInstruction`, `HybridPair` with minimal fields. U3 needs additional fields (name, severity, route, source, shadow mode). Strategy: extend U1 shared types with the additional fields rather than creating parallel types.

## Steps

### Step 1: Extend shared types in U1 for U3 needs
- [x] Add `name`, `severity`, `route`, `source` fields to `CypherQuery` in evaluation.ts
- [x] Add `name`, `severity`, `route`, `source`, `shadowModeEligible`, `shadowPrompt?` fields to `NeuronalInstruction`
- [x] Add missing fields to `HybridPair` if needed
- [x] Add `totalCompiled` and `warnings` to `CompiledFunctions`
- [x] Run typecheck to verify no breaking changes

### Step 2: Create spec-parser types (`src/spec-parser/types.ts`)
- [x] `SpecInput`, `SpecParserOptions`, `DEFAULT_SPEC_PARSER_OPTIONS`
- [x] `SpecParserErrorCode`, `SpecParserError`
- [x] `ValidationResult`, `ValidationError`, `ValidationWarning`, `SpecWarningCode`
- [x] `ADRParser` interface (strategy pattern)
- [x] `BuiltInTemplate`, `RawSpecYAML`, `YAMLSourcePosition`

### Step 3: Create JSON Schema for spec validation (`src/spec-parser/spec-schema.ts`)
- [x] JSON Schema v1.0.0 for AoC YAML structure
- [x] Covers: spec_version, architecture (style, layers), fitness_functions, scoring, confidence_thresholds
- [x] Export as `SPEC_SCHEMA_V1` constant

### Step 4: Create template registry (`src/spec-parser/template-registry.ts`)
- [x] `BuiltInTemplate` for `clean-architecture` with all 26 functions
- [x] Default weights, thresholds from `specs/clean-arch.yaml`
- [x] `TEMPLATE_REGISTRY` Map constant
- [x] `resolveTemplate(style: string)` function with case-insensitive lookup

### Step 5: Create spec validator (`src/spec-parser/spec-validator.ts`)
- [x] `validateSpecSchema(raw: unknown)` — Ajv structural validation with line-number mapping
- [x] `validateBusinessRules(spec: ParsedSpec)` — cross-field validation (weights sum, threshold order, route/criteria consistency)
- [x] Combined `validateSpec()` returning `ValidationResult`

### Step 6: Create layer parsers (`src/spec-parser/layer-parsers.ts`)
- [x] `parseLayerA(raw)` → `LayerModel`
- [x] `parseLayerB(raw, template?)` → `FitnessFunction[]` (with template merge)
- [x] `parseLayerC(raw)` → `{ scoringWeights, fullModeWeights?, verdictThresholds, confidenceThresholds }`

### Step 7: Create ADR parsers (`src/spec-parser/adr-parsers.ts`)
- [x] `MADRParser` implementing `ADRParser`
- [x] `NygardParser` implementing `ADRParser`
- [x] `YStatementParser` implementing `ADRParser`
- [x] `CustomYamlADRParser` implementing `ADRParser`
- [x] `ADR_PARSERS` ordered array
- [x] `detectAndParseADR(content, filePath)` dispatcher
- [x] `generateSemanticCriterion(adr)` — prose → SemanticCriteria

### Step 8: Create main spec parser (`src/spec-parser/spec-parser.ts`)
- [x] `parseSpec(input: SpecInput, options?)` → `DomainResult<ParsedSpec>`
- [x] `parseADRs(adrDirPath: string, options?)` → `DomainResult<ADRRule[]>`
- [x] `SpecParser` class implementing `PipelineStage<SpecInput, ParsedSpec>`
- [x] Full lifecycle: load YAML → schema validate → template resolve → parse layers → parse ADRs → business validate → assemble

### Step 9: Update spec-parser index (`src/spec-parser/index.ts`)
- [x] Export public API: `SpecParser`, `parseSpec`, types

### Step 10: Unit tests — spec-parser types + schema + validator
- [x] Test JSON Schema validation (valid spec, missing fields, wrong types)
- [x] Test business rule validation (weight sums, threshold ordering, route/criteria)
- [x] Test line-number error mapping

### Step 11: Unit tests — template registry + layer parsers
- [x] Test template lookup (valid, unknown, case-insensitive)
- [x] Test template merge (override, append, no-op)
- [x] Test layer A/B/C parsing

### Step 12: Unit tests — ADR parsers
- [x] Test each format detection (MADR, Nygard, Y-Statement, custom-yaml)
- [x] Test semantic criterion generation from prose
- [x] Test optional symbolic rule extraction from custom-yaml
- [x] Test format dispatch and fallback

### Step 13: Unit tests — main spec parser
- [x] Test full parseSpec() with clean-arch.yaml fixture
- [x] Test parseADRs() with sample ADR files
- [x] Test error cases (missing file, bad YAML, unknown style, zero functions)
- [x] Test SpecParser PipelineStage integration with FirewallContext

### Step 14: Create fitness-compiler types (`src/fitness-compiler/types.ts`)
- [x] `CompilerInput`
- [x] `CompilerErrorCode`, `CompilerError`
- [x] `CompilerWarningCode`, `CompilerWarning`
- [x] `CypherTemplate` (internal, template before instantiation)

### Step 15: Create Cypher templates (`src/fitness-compiler/cypher-templates.ts`)
- [x] `CYPHER_TEMPLATES` Map — 24 hardcoded Cypher template strings
- [x] One entry per symbolic function (FF-S01 through FF-CV06)
- [x] Each with `$param` placeholders, required/optional params, description

### Step 16: Create fitness compiler (`src/fitness-compiler/fitness-compiler.ts`)
- [x] `compileFunctions(input: CompilerInput)` → `DomainResult<CompiledFunctions>`
- [x] `compileSymbolic(ff, layerModel)` → `CypherQuery`
- [x] `compileNeuronal(ff)` → `NeuronalInstruction`
- [x] `compileHybrid(ff, layerModel)` → `HybridPair`
- [x] `compileADRRule(adr)` → symbolic + neuronal with shadow mode tagging
- [x] `instantiateTemplate(template, params)` — placeholder replacement
- [x] `FitnessCompiler` class implementing `PipelineStage<ParsedSpec, CompiledFunctions>`

### Step 17: Update fitness-compiler index (`src/fitness-compiler/index.ts`)
- [x] Export public API: `FitnessCompiler`, `compileFunctions`, types

### Step 18: Unit tests — Cypher templates + compiler
- [x] Test template instantiation (valid params, missing params)
- [x] Test route classification and output structure
- [x] Test ADR rule compilation with shadow mode
- [x] Test deduplication and error handling
- [x] Test FitnessCompiler PipelineStage with FirewallContext

### Step 19: Integration test — full pipeline
- [x] Parse `specs/clean-arch.yaml` → compile → verify 24 symbolic queries + 2 neuronal instructions
- [x] Verify all function IDs present in output
- [x] Verify Cypher template instantiation with layer values from spec

### Step 20: TypeCheck + full test run
- [x] `npm run typecheck` — 0 errors
- [x] `npm run test:unit` — all passing

## Story Traceability
| Story | Coverage |
|-------|----------|
| US-4.1 | Steps 6, 8 (3-layer YAML parsing) |
| US-4.2 | Step 4 (template resolution) |
| US-4.3 | Steps 3, 5 (JSON Schema + business rule validation) |
| US-4.4 | Step 6 (layer definitions parsing) |
| US-4.5 | Step 6 (route tags in Layer B parsing) |
| US-4.6 | Step 6 (semantic criteria in Layer B parsing) |
| US-4.7 | Step 6 (confidence thresholds in Layer C) |
| US-5.1 | Step 7 (4 ADR format parsers) |
| US-5.2 | Steps 7, 16 (dual rule production) |
| US-5.3 | Step 8 (manual AoC YAML authoring via parseSpec) |
| US-5.4 | Step 7 (ADR reference validation) |
| US-7.1 | Steps 15, 16 (Cypher template compilation) |
| US-7.2 | Step 15 (24 templates across 7 dimensions) |
