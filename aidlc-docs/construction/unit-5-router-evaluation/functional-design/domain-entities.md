# Unit 5 — Neuro-Symbolic Router + Evaluation: Domain Entities

## Shared Types (from U1 — no redefinition)

- `CompiledFunctions`, `CypherQuery`, `NeuronalInstruction`, `HybridPair` (evaluation.ts)
- `SymbolicFunctionResult`, `NeuronalFunctionResult`, `NeuronalRun`, `EvaluationResults` (evaluation.ts)
- `Violation` (taxonomy/violation-types.ts)
- `DomainResult<T>`, `PipelineWarning` (errors/domain-result.ts)
- `GraphRepository`, `QueryResult` (interfaces/graph-repository.ts)
- `LLMProvider`, `LLMOptions`, `LLMResponse` (interfaces/llm-provider.ts)
- `PipelineStage<I, O>` (interfaces/pipeline-stage.ts)
- `FirewallContext` (context/firewall-context.ts)
- `EvaluationMode`, `Dimension`, `Severity` (types/enums.ts)
- `FunctionId`, `Confidence` (types/value-objects.ts)
- `SemanticCriteria`, `ConfidenceThresholds` (types/spec.ts)
- `ContextAssemblyInstruction` (types/evaluation.ts)

## New Public Types

### Router Types

```typescript
interface RouterInput {
  readonly compiledFunctions: CompiledFunctions;
  readonly mode: EvaluationMode;
}

type RouterErrorCode =
  | 'NO_FUNCTIONS_TO_EVALUATE'
  | 'SYMBOLIC_ENGINE_FAILED'
  | 'LLM_CRITIC_FAILED'
  | 'ROUTER_FAILED';

interface RouterError extends PipelineError {
  readonly code: RouterErrorCode;
  readonly stage: 'router';
  readonly critical: true;
}
```

### Evaluation Engine Types

```typescript
interface SymbolicEvalInput {
  readonly queries: readonly CypherQuery[];
  readonly graphRepository: GraphRepository;
}

// Result mapping config — added to CypherTemplate (Q3:B)
interface ResultMapping {
  readonly filePathColumn: string;
  readonly messageTemplate: string;
  readonly metadataColumns?: readonly string[];
}

type EvalErrorCode =
  | 'QUERY_EXECUTION_FAILED'
  | 'RESULT_MAPPING_FAILED';

interface EvalWarning extends PipelineWarning {
  readonly code: string;
  readonly functionId: FunctionId;
}
```

### LLM Critic Types

```typescript
type VCRMode = 'record' | 'replay' | 'bypass';

interface NeuronalEvalInput {
  readonly instructions: readonly NeuronalInstruction[];
  readonly graphRepository: GraphRepository;
  readonly provider: LLMProvider;
  readonly runsPerEvaluation?: number;       // default: 3
  readonly vcrMode?: VCRMode;                // default: 'bypass'
  readonly cassettePath?: string;            // default: 'fixtures/cassettes'
  readonly maxConcurrency?: number;          // default: 3
  readonly unstableThreshold?: number;       // default: 0.15
}

interface CriticVerdict {
  readonly pass: boolean;
  readonly confidence: number;
  readonly reasoning: string;
  readonly evidence: readonly string[];
  readonly violations: readonly CriticViolation[];
}

interface CriticViolation {
  readonly filePath: string;
  readonly message: string;
}

interface CassetteEntry {
  readonly functionId: string;
  readonly runIndex: number;
  readonly prompt: string;
  readonly response: string;
  readonly parsedVerdict: CriticVerdict | null;
  readonly timestamp: string;
}

interface ContextPacket {
  readonly rule: string;
  readonly rubric: {
    readonly pass: string;
    readonly fail: string;
    readonly evidenceRequired: string;
  };
  readonly codeSnippet: string;
  readonly apgSubgraph?: string;
  readonly adrProse?: string;
}

// Token budgets (Q5:A)
interface TokenBudget {
  readonly ruleRubric: number;     // 300
  readonly codeSnippet: number;    // 2000
  readonly apgSubgraph: number;    // 500
  readonly adrProse: number;       // 500
}

const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  ruleRubric: 300,
  codeSnippet: 2000,
  apgSubgraph: 500,
  adrProse: 500,
};

type CriticErrorCode =
  | 'LLM_CALL_FAILED'
  | 'VERDICT_PARSE_FAILED'
  | 'INSUFFICIENT_VALID_RUNS'
  | 'CONTEXT_ASSEMBLY_FAILED';
```

### LLM Provider Implementations

```typescript
// Claude provider (Anthropic SDK)
class ClaudeLLMProvider implements LLMProvider {
  readonly name = 'claude';
  readonly supportsDeterminism = false;  // no seed param
  // temperature=0 supported
}

// OpenAI provider
class OpenAILLMProvider implements LLMProvider {
  readonly name = 'openai';
  readonly supportsDeterminism = true;   // seed param supported
}

// Mock provider for testing
class MockLLMProvider implements LLMProvider {
  readonly name = 'mock';
  readonly supportsDeterminism = true;
  // Returns canned responses
}
```

## U3 Type Extension

### CypherTemplate — Add resultMapping (Q3:B)

```typescript
// In src/fitness-compiler/types.ts — extend CypherTemplate
interface CypherTemplate {
  readonly functionName: string;
  readonly template: string;
  readonly requiredParams: readonly string[];
  readonly optionalParams: readonly string[];
  readonly description: string;
  readonly resultMapping: ResultMapping;     // NEW — Q3:B
}

interface ResultMapping {
  readonly filePathColumn: string;
  readonly messageTemplate: string;
  readonly metadataColumns?: readonly string[];
}
```

## External Dependencies

- `p-limit` ^6.x — Concurrency governor for LLM calls
- `@anthropic-ai/sdk` ^0.x — Claude API (optional, only if ClaudeLLMProvider used)
- `openai` ^4.x — OpenAI API (optional, only if OpenAILLMProvider used)

Note: Provider SDKs are optional/peer dependencies. Only the configured provider is loaded at runtime.
