# Unit 3 — Spec Parser + Fitness Compiler: Business Logic Model

## 1. Parsing Lifecycle

The unit implements two independent pipelines (C3 Spec Parser, C4 Fitness Compiler) that execute sequentially:

```
SpecInput ─→ [C3: parseSpec] ─→ ParsedSpec ─→ [C4: compileFunctions] ─→ CompiledFunctions
                                      ↑
              [C3: parseADRs] ────────┘ (merged into ParsedSpec.adrRules)
```

### Phase 1: Spec Parsing (C3)

1. **YAML Loading** — Read spec file, parse with `yaml` package (CST mode for source positions)
2. **Schema Validation** — Validate parsed object against JSON Schema (Ajv). Map JSON pointer errors to YAML line numbers using CST position data.
3. **Template Resolution** — If `architecture.style` is declared, look up static TS registry. Merge: template functions are the base set, spec-level `fitness_functions` entries override by `id` match.
4. **Layer A Parsing** — Extract `LayerModel` from `architecture.layers[]`. Validate directory globs, roles, decorators.
5. **Layer B Parsing** — Extract `FitnessFunction[]` from `fitness_functions[]`. Validate dimensions, severities, routes. For neuronal/hybrid, require `semantic_criteria`.
6. **Layer C Parsing** — Extract `ScoringWeights`, `VerdictThresholds`, `ConfidenceThresholds` from `scoring` + `confidence_thresholds`.
7. **Business Rule Validation** — Cross-field rules: weights sum to 1.0, threshold ordering, route/semantic_criteria consistency, etc.
8. **Result Assembly** — Return `DomainResult<ParsedSpec>`

### Phase 2: ADR Parsing (C3)

1. **Directory Scan** — Read all `.md` and `.yaml` files from ADR directory
2. **Format Detection** — For each file, detect ADR format via strategy pattern:
   - MADR: contains `## Decision Drivers` or `## Considered Options`
   - Nygard: contains `## Status` + `## Context` + `## Decision`
   - Y-Statement: contains `In the context of` + `we decided` + `to achieve`
   - custom-yaml: `.yaml`/`.yml` extension with `adr:` root key
3. **Strategy Dispatch** — Route to appropriate `ADRParser` implementation
4. **Semantic Criterion Generation** — Extract prose → build `SemanticCriteria` (rule from decision text, rubric from context/consequences)
5. **Optional Symbolic Rule** — If ADR YAML contains `cypher_rule:` block, parse as `CypherRule`. Otherwise `symbolicRule` is undefined.
6. **Result Assembly** — Return `DomainResult<ADRRule[]>`

### Phase 3: Fitness Compilation (C4)

1. **Input Validation** — Verify all fitness functions have required fields
2. **Route Classification** — Group functions by route: symbolic, neuronal, hybrid
3. **Symbolic Compilation** — For each symbolic/hybrid function:
   - Look up hardcoded Cypher template by function name
   - Instantiate with function-specific params (thresholds, patterns, directories from spec)
   - Produce `TaggedCypherQuery`
4. **Neuronal Instruction Assembly** — For each neuronal/hybrid function:
   - Package `semantic_criteria` + context assembly instructions
   - Produce `NeuronalInstruction`
5. **Hybrid Pairing** — For hybrid functions, produce `HybridPair` linking symbolic query + neuronal instruction
6. **ADR Rule Compilation** — For each ADR rule:
   - If `symbolicRule` present → include as-is in symbolic queries
   - Always produce neuronal instruction from `semanticCriterion`
   - Tag as `shadowModeEligible: true` for future LLM Cypher auto-generation (U5)
7. **Deduplication** — No duplicate function IDs allowed
8. **Result Assembly** — Return `DomainResult<CompiledFunctions>`

## 2. Template Resolution System

### Static Registry Design

```
TemplateRegistry = Map<string, BuiltInTemplate>

BuiltInTemplate {
  style: string                    // "clean-architecture"
  version: string                  // "1.0.0"
  functions: FitnessFunction[]     // 26 functions (24 symbolic + 2 neuronal)
  defaultWeights: ScoringWeights
  defaultThresholds: VerdictThresholds
}
```

### Merge Strategy (spec overrides template)

1. Start with template's full function set
2. For each spec-declared function with matching `id`:
   - Override all provided fields (threshold, severity, custom params)
   - Keep template defaults for unspecified fields
3. Spec-declared functions with NEW ids (not in template) are appended
4. Template functions not mentioned in spec remain as-is

## 3. Cypher Template System

### Template Structure

Each hardcoded template is a string with `$paramName` placeholders:

```
FF-S01 (dependency-direction):
  MATCH (src:File)-[:IMPORTS]->(tgt:File)
  WHERE src.layer = $outerLayer AND tgt.layer = $innerLayer
  RETURN count(*) AS violations
```

### Instantiation

- Replace `$paramName` with values from the spec (layer directories, thresholds, patterns)
- Layer names from `architecture.layers[].name`
- Thresholds from individual function declarations
- Custom params (e.g., `forbidden_imports`, `max_public_methods`) from function-specific fields

### Template Inventory (24 symbolic)

| ID | Name | Dimension | Params from Spec |
|----|------|-----------|------------------|
| FF-S01 | dependency-direction | structural | layer names, layer order |
| FF-S02 | no-cyclic-deps | structural | (none — graph-global) |
| FF-S03 | no-layer-skip | structural | layer names, adjacency |
| FF-S04 | no-domain-outward-dep | structural | domain layer dirs |
| FF-P01 | domain-purity | pattern | forbidden_imports[] |
| FF-P02 | dependency-inversion | pattern | threshold |
| FF-P03 | repository-pattern | pattern | domain layer, infra layer |
| FF-P04 | use-case-isolation | pattern | application layer dirs |
| FF-P05 | controller-no-entity | pattern | infra layer, domain entities |
| FF-C01 | domain-stability | coupling | threshold |
| FF-C02 | module-fan-out | coupling | threshold |
| FF-C03 | component-instability | coupling | (computed metric) |
| FF-C04 | no-orphan-files | coupling | (graph-global) |
| FF-C05 | max-fan-in | coupling | threshold |
| FF-C06 | abstraction-ratio | coupling | threshold |
| FF-SO01 | single-responsibility-proxy | solid | max_public_methods, max_dependencies |
| FF-SO02 | interface-segregation-proxy | solid | max_interface_methods |
| FF-SO03 | inheritance-depth | solid | max_depth |
| FF-CV01 | naming-conventions | convention | layer roles → naming patterns |
| FF-CV02 | naming-services | convention | pattern |
| FF-CV03 | naming-repos | convention | pattern |
| FF-CV04 | naming-controllers | convention | pattern |
| FF-CV05 | test-file-pairing | convention | (file system check) |
| FF-CV06 | no-index-logic | convention | (AST check) |

## 4. Shadow Mode (ADR Dual Execution)

### Design Intent

For ADR-derived rules, U3 produces the **deterministic path** (handcrafted Cypher or semantic-only). The **shadow path** (LLM-generated Cypher) is deferred to U5's LLM runtime. U3's responsibility:

1. Mark ADR rules with `shadowModeEligible: true`
2. Include the raw ADR prose in `NeuronalInstruction.contextForLLM`
3. Add `shadowPrompt` field: instructions for U5's LLM to generate Cypher from the ADR prose
4. U5 executes both paths, compares results — U3 does NOT invoke LLM

### Data Flow

```
ADRRule (from parser)
  ├── symbolicRule? (handcrafted, if provided)
  ├── semanticCriterion (always, from prose)
  └── shadowModeEligible: true
        │
        ▼ (at U5 runtime)
  LLM generates Cypher from prose → compare with handcrafted → log delta
```

## 5. Error Handling Strategy

### Fatal Errors (abort with DomainResult.fail)

- Spec file not found / unreadable
- YAML syntax error (malformed YAML)
- JSON Schema validation failure (structural)
- Unknown architecture style (no template match)
- Zero fitness functions after resolution

### Warnings (continue, collect in warnings[])

- ADR file parse failure (skip file, warn)
- ADR reference in spec points to missing file
- Unknown fields in spec (ignored, warned)
- Template function overridden by spec (informational)
- Weight sum slightly off due to floating point (auto-corrected, warned)

### Warning Codes

| Code | Meaning |
|------|---------|
| SPEC_001 | Unknown field in spec YAML (ignored) |
| SPEC_002 | Template function overridden by spec declaration |
| SPEC_003 | Weight sum auto-corrected (floating point drift) |
| ADR_001 | ADR file could not be parsed (skipped) |
| ADR_002 | ADR format not detected (skipped) |
| ADR_003 | ADR reference in spec points to missing file |
| COMPILER_001 | No Cypher template for function (neuronal-only) |
| COMPILER_002 | Unknown function name (no built-in template) |
| COMPILER_003 | Shadow mode eligible but no handcrafted Cypher for comparison |

## 6. PipelineStage Integration

Both C3 and C4 implement `PipelineStage` from U1:

```typescript
class SpecParser implements PipelineStage<SpecInput, ParsedSpec> {
  async execute(input: SpecInput, context: FirewallContext): Promise<DomainResult<ParsedSpec>>
  // On success: context.setParsedSpec(result)
}

class FitnessCompiler implements PipelineStage<ParsedSpec, CompiledFunctions> {
  async execute(input: ParsedSpec, context: FirewallContext): Promise<DomainResult<CompiledFunctions>>
  // On success: context.setCompiledFunctions(result)
}
```

### FirewallContext Setters Required (U1 additions)

- `setParsedSpec(spec: ParsedSpec)` — set-once
- `setCompiledFunctions(compiled: CompiledFunctions)` — set-once
