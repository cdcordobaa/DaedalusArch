# Unit 3 — Spec Parser + Fitness Compiler: Domain Entities

## Shared Types (from U1 — no redefinition)

Used directly from `src/shared/`:
- `FitnessFunction`, `SemanticCriteria`, `EvalRubric` (types/spec.ts)
- `LayerModel`, `LayerDefinition` (types/spec.ts)
- `ScoringWeights`, `ConfidenceThresholds`, `VerdictThresholds` (types/spec.ts)
- `ParsedSpec`, `ADRRule`, `CypherRule` (types/spec.ts)
- `Dimension`, `Severity`, `Route`, `ADRFormat` (types/enums.ts)
- `FunctionId` (types/value-objects.ts)
- `DomainResult<T>`, `PipelineError` (errors/domain-result.ts)
- `PipelineStage<I, O>` (interfaces/pipeline-stage.ts)
- `FirewallContext` (context/firewall-context.ts)

## New Public Types

### Spec Parser Input/Output

```typescript
interface SpecInput {
  readonly specFilePath: string;
  readonly adrDirPath?: string;       // optional ADR directory
}

interface SpecParserOptions {
  readonly strictMode?: boolean;       // default: false — strict fails on warnings
  readonly validateADRRefs?: boolean;  // default: true
  readonly maxADRFiles?: number;       // default: 100
}

type SpecParserErrorCode =
  | 'SPEC_NOT_FOUND'
  | 'YAML_SYNTAX_ERROR'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'UNKNOWN_STYLE'
  | 'ZERO_FITNESS_FUNCTIONS'
  | 'BUSINESS_RULE_VIOLATION';

interface SpecParserError extends PipelineError {
  readonly code: SpecParserErrorCode;
  readonly stage: 'spec-parser';
  readonly critical: true;
}
```

### Validation Types

```typescript
interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

interface ValidationError {
  readonly path: string;              // JSON pointer or field path
  readonly message: string;
  readonly line?: number;             // YAML line number (if available)
  readonly column?: number;
  readonly rule: string;              // BR-SPEC-XX reference
}

interface ValidationWarning {
  readonly code: SpecWarningCode;
  readonly message: string;
  readonly path?: string;
  readonly line?: number;
}

type SpecWarningCode =
  | 'SPEC_001'    // Unknown field
  | 'SPEC_002'    // Template function overridden
  | 'SPEC_003'    // Weight sum auto-corrected
  | 'ADR_001'     // ADR file parse failure
  | 'ADR_002'     // ADR format not detected
  | 'ADR_003';    // ADR reference missing
```

### ADR Parser Strategy

```typescript
interface ADRParser {
  readonly format: ADRFormat;
  canParse(content: string, filePath: string): boolean;
  parse(content: string, filePath: string): DomainResult<ADRRule>;
}
```

Four implementations:
- `MADRParser implements ADRParser`
- `NygardParser implements ADRParser`
- `YStatementParser implements ADRParser`
- `CustomYamlADRParser implements ADRParser`

### Fitness Compiler Input/Output

```typescript
interface CompilerInput {
  readonly fitnessFunctions: readonly FitnessFunction[];
  readonly adrRules: readonly ADRRule[];
  readonly layerModel: LayerModel;
  readonly scoringWeights: ScoringWeights;
}

interface CompiledFunctions {
  readonly symbolicQueries: readonly TaggedCypherQuery[];
  readonly neuronalInstructions: readonly NeuronalInstruction[];
  readonly hybridPairs: readonly HybridPair[];
  readonly totalCompiled: number;
  readonly warnings: readonly CompilerWarning[];
}

interface TaggedCypherQuery {
  readonly functionId: FunctionId;
  readonly name: string;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly threshold?: number;
  readonly route: 'symbolic' | 'hybrid';
  readonly cypher: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly source: 'template' | 'adr';
}

interface NeuronalInstruction {
  readonly functionId: FunctionId;
  readonly name: string;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly route: 'neuronal' | 'hybrid';
  readonly semanticCriteria: SemanticCriteria;
  readonly contextAssembly: ContextAssemblyInstruction;
  readonly shadowModeEligible: boolean;
  readonly shadowPrompt?: string;
  readonly source: 'fitness-function' | 'adr';
}

interface HybridPair {
  readonly functionId: FunctionId;
  readonly symbolic: TaggedCypherQuery;
  readonly neuronal: NeuronalInstruction;
}

interface ContextAssemblyInstruction {
  readonly includeAPGSubgraph: boolean;
  readonly nodeFilter?: string;         // e.g., "layer:domain"
  readonly maxNodes?: number;            // context window budget
  readonly includeSourceCode: boolean;
  readonly sourceCodeFilter?: string;    // e.g., "classes with >5 methods"
}

type CompilerErrorCode =
  | 'MISSING_REQUIRED_PARAM'
  | 'DUPLICATE_FUNCTION_ID'
  | 'COMPILATION_FAILED';

interface CompilerError extends PipelineError {
  readonly code: CompilerErrorCode;
  readonly stage: 'fitness-compiler';
  readonly critical: true;
}

interface CompilerWarning {
  readonly code: 'COMPILER_001' | 'COMPILER_002' | 'COMPILER_003';
  readonly message: string;
  readonly functionId?: FunctionId;
}
```

### Template Registry

```typescript
interface BuiltInTemplate {
  readonly style: string;
  readonly version: string;
  readonly functions: readonly FitnessFunction[];
  readonly defaultWeights: ScoringWeights;
  readonly defaultFullModeWeights: ScoringWeights;
  readonly defaultVerdictThresholds: VerdictThresholds;
  readonly defaultConfidenceThresholds: ConfidenceThresholds;
}

// Registry is a simple Map constant
const TEMPLATE_REGISTRY: ReadonlyMap<string, BuiltInTemplate>;
```

## Internal Types (not exported)

```typescript
// YAML CST position tracking for line-number errors
interface YAMLSourcePosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

// Intermediate parsed YAML before validation
interface RawSpecYAML {
  readonly spec_version?: unknown;
  readonly architecture?: unknown;
  readonly fitness_functions?: unknown;
  readonly scoring?: unknown;
  readonly confidence_thresholds?: unknown;
  readonly [key: string]: unknown;   // catch unknown fields
}

// Cypher template before instantiation
interface CypherTemplate {
  readonly functionName: string;
  readonly template: string;          // raw Cypher with $param placeholders
  readonly requiredParams: readonly string[];
  readonly optionalParams: readonly string[];
  readonly description: string;
}
```

## Constants

```typescript
// Hardcoded Cypher templates — one per symbolic fitness function
const CYPHER_TEMPLATES: ReadonlyMap<string, CypherTemplate>;
// 24 entries: dependency-direction, no-cyclic-deps, ..., no-index-logic

// ADR parser registry — ordered by detection priority
const ADR_PARSERS: readonly ADRParser[];
// [MADRParser, NygardParser, YStatementParser, CustomYamlADRParser]

// Default options
const DEFAULT_SPEC_PARSER_OPTIONS: SpecParserOptions = {
  strictMode: false,
  validateADRRefs: true,
  maxADRFiles: 100,
};

// JSON Schema for spec validation (v1.0.0)
const SPEC_SCHEMA_V1: object;
// Ajv-compatible JSON Schema
```

## External Dependencies

- `yaml` ^2.x — YAML parsing with CST mode for source positions
- `ajv` ^8.x — JSON Schema validation
- `ajv-formats` — Additional string format validators (semver, etc.)
