# U0 Domain Entities — Shared Extensions

## Extended Types

### FitnessFunction (extends existing in `src/shared/types/spec.ts`)

```typescript
interface FitnessFunction {
  // Existing v1.0 fields (unchanged)
  readonly id: FunctionId;
  readonly name: string;
  readonly dimension: Dimension;
  readonly severity: Severity;
  readonly threshold?: number;
  readonly route: Route;
  readonly semanticCriteria?: SemanticCriteria;
  readonly isBuiltIn: boolean;
  readonly validated: boolean;

  // v1.1 NEW
  readonly enabled: boolean;                    // default: true
  readonly excludePaths: readonly string[];      // default: [] — glob patterns
  readonly disabledReason?: string;              // only when enabled=false
}
```

**Backward Compatibility**: `enabled` defaults to `true`, `excludePaths` defaults to `[]`. Existing v1.0 specs without these fields work unchanged.

---

### DisabledFunction (new in `src/shared/types/spec.ts`)

```typescript
interface DisabledFunction {
  readonly id: FunctionId;
  readonly name: string;
  readonly reason?: string;
}
```

Used by the compiler to track skipped functions for reporting.

---

### ValidationReport (new in `src/shared/types/validation.ts`)

```typescript
interface ValidationReport {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
  readonly summary: ValidationSummary;
}

interface ValidationError {
  readonly code: ValidationErrorCode;
  readonly message: string;
  readonly field?: string;          // JSON path to the offending field
  readonly suggestion?: string;     // How to fix
}

interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

interface ValidationSummary {
  readonly totalFunctions: number;
  readonly enabledFunctions: number;
  readonly disabledFunctions: number;
  readonly totalLayers: number;
  readonly totalErrors: number;
  readonly totalWarnings: number;
}

type ValidationErrorCode =
  | 'LAYER_DIR_NOT_FOUND'
  | 'DUPLICATE_FUNCTION_ID'
  | 'INVALID_TEMPLATE_REF'
  | 'INVALID_THRESHOLD'
  | 'INVALID_GLOB_PATTERN'
  | 'UNKNOWN_DIMENSION'
  | 'UNKNOWN_SEVERITY'
  | 'UNKNOWN_ROUTE';
```

---

### ActionableViolation (new in `src/shared/types/violation.ts`)

```typescript
interface ActionableViolation extends Violation {
  readonly what: string;        // "[severity] FF-ID — rule name"
  readonly where: string;       // "file/path.ts:lineNumber"  
  readonly why: string;         // Human-readable explanation
  readonly fix: string;         // Suggested action
  readonly baselineStatus: BaselineStatus;
}

type BaselineStatus = 'baseline' | 'new' | 'none';
```

**Note**: `ActionableViolation` extends the existing `Violation` type — all v1.0 fields remain accessible. The new fields are computed by the scoring engine (U2), but the type is defined here in shared for cross-unit use.

---

### BaselineSnapshot & BaselineResult (new in `src/shared/types/baseline.ts`)

```typescript
interface BaselineSnapshot {
  readonly version: '1.0';
  readonly createdAt: string;          // ISO 8601
  readonly specFile: string;
  readonly totalViolations: number;
  readonly violations: readonly BaselineEntry[];
}

interface BaselineEntry {
  readonly key: string;                // Stable hash
  readonly ruleId: FunctionId;
  readonly filePath: string;
  readonly severity: Severity;
  readonly description: string;
}

interface BaselineResult {
  readonly baselineViolations: readonly Violation[];
  readonly newViolations: readonly Violation[];
  readonly removedFromBaseline: readonly BaselineEntry[];
  readonly baselineFilePath: string;
}
```

---

### GeminiConfig (new in `src/shared/types/llm.ts`)

```typescript
interface GeminiConfig {
  readonly apiKey: string;
  readonly model: string;               // default: "gemini-2.0-flash"
  readonly temperature: number;          // default: 0
  readonly maxTokens: number;            // default: 4096
}

interface LLMProviderConfig {
  readonly provider: 'mock' | 'gemini';
  readonly gemini?: GeminiConfig;
}
```

---

## New Exports from `src/shared/index.ts`

All new types are exported from the shared module index. No new domain logic — types only.
