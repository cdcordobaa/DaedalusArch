# Domain Entities — Unit 2: APG Extractor

## Shared Types Used (from U1 — no redefinition needed)

- `APGNode` — `src/shared/types/apg.ts`
- `APGEdge` — `src/shared/types/apg.ts`
- `APGResult` — `src/shared/types/apg.ts`
- `ParseCoverage` — `src/shared/types/apg.ts`
- `SkippedFile` — `src/shared/types/apg.ts`
- `ExtractorWarning` — `src/shared/types/apg.ts`
- `NodeType` — `src/shared/types/enums.ts`
- `EdgeType` — `src/shared/types/enums.ts`
- `DomainResult<T>` — `src/shared/errors/domain-result.ts`
- `PipelineError` — `src/shared/errors/domain-result.ts`

---

## New Types — `src/apg-extractor/`

### `ExtractorOptions` (public API)

```typescript
interface ExtractorOptions {
  lenientMode?: boolean           // default: true — individual file failures don't abort
  includeDecorators?: boolean     // default: true — extract decorator metadata
  maxBarrelDepth?: number         // default: 10 — max transitive barrel resolution hops
  excludePatterns?: string[]      // additional glob patterns to exclude (beyond defaults)
}
```

**Defaults** (applied when field is undefined):
- `lenientMode` → `true`
- `includeDecorators` → `true`
- `maxBarrelDepth` → `10`
- `excludePatterns` → `[]`

---

### `ExtractorError` (public API — error discriminant)

```typescript
type ExtractorErrorCode =
  | 'PROJECT_NOT_FOUND'    // projectPath does not exist on disk
  | 'TSCONFIG_NOT_FOUND'   // no tsconfig.json found at or above projectPath
  | 'PARSE_FAILURE'        // catastrophic parse error (not lenient-recoverable)
  | 'EMPTY_PROJECT'        // zero .ts files found after exclusions

interface ExtractorError extends PipelineError {
  readonly code: ExtractorErrorCode
  readonly stage: 'apg-extractor'
  readonly critical: true
}
```

---

### `NodeRegistry` (internal — not exported)

Internal data structure used during extraction to efficiently look up nodes by various keys.

```typescript
interface NodeRegistry {
  // Primary map: nodeId → APGNode
  readonly nodes: Map<string, APGNode>

  // Look up File node by absolute file path
  readonly fileNodes: Map<string, string>           // filePath → nodeId

  // Look up Class/Interface node by qualified name + file path
  readonly classNodes: Map<string, string>          // "{name}@{filePath}" → nodeId

  // Look up Method node by qualified name + file path
  readonly methodNodes: Map<string, string>         // "{ClassName}.{method}@{filePath}" → nodeId

  // Look up Function node by name + file path
  readonly functionNodes: Map<string, string>       // "{name}@{filePath}" → nodeId
}
```

---

### `ResolvedImport` (internal — not exported)

Result of resolving a single import declaration, including barrel traversal state.

```typescript
interface ResolvedImport {
  readonly originalPath: string       // the raw import specifier (e.g., './index')
  readonly resolvedFilePath: string   // final resolved absolute path after barrel traversal
  readonly isBarrel: boolean          // true if the direct import target was a barrel
  readonly barrelDepth: number        // how many barrel hops were traversed (0 = no barrel)
  readonly importedNames: string[]    // named symbols from the import
  readonly isTypeOnly: boolean        // true for "import type { ... }"
}
```

---

### `DIResolution` (internal — not exported)

Result of resolving a single constructor parameter as a DI candidate.

```typescript
interface DIResolution {
  readonly parameterName: string      // name of the constructor parameter
  readonly typeName: string           // TypeScript type text of the parameter
  readonly resolvedNodeId: string | null  // nodeId if type resolved to an extracted node
  readonly decoratorBased: boolean    // true if class has DI decorator, false = structural
  readonly skipped: boolean           // true if type is primitive/generic (not a DI target)
  readonly skipReason?: string        // reason for skip (e.g., 'primitive type', 'generic param')
}
```

---

### `DecoratorMetadata` (internal — not exported)

Represents a single decorator extracted from a class, method, or parameter.

```typescript
interface DecoratorMetadata {
  readonly name: string           // decorator name without @ (e.g., 'Injectable', 'Get')
  readonly arguments: string[]    // string representations of decorator arguments
}
```

---

### `CallResolution` (internal — not exported)

Result of resolving a call expression to a target node.

```typescript
interface CallResolution {
  readonly calleeText: string         // raw call expression text for debug
  readonly resolvedNodeId: string | null  // target Method/Function nodeId if resolved
  readonly isCrossBoundary: boolean   // true if source and target are in different classes
}
```

---

## DI Decorator Registry (constant — internal)

The set of decorator names that trigger decorator-based DI detection (Q2: C):

```typescript
const DI_DECORATORS = new Set([
  'Injectable',
  'Controller',
  'Service',
  'Repository',
  'Component',
  'Provider',
  'Module',
  'Guard',
  'Interceptor',
  'Resolver',  // GraphQL resolvers (NestJS)
  'Pipe',      // NestJS pipes
])
```

---

## Primitive Type Exclusion List (constant — internal)

Constructor parameter types excluded from CONSTRUCTOR_INJECTS detection:

```typescript
const PRIMITIVE_TYPES = new Set([
  'string', 'number', 'boolean', 'object', 'any',
  'unknown', 'never', 'void', 'null', 'undefined', 'symbol',
  // Built-in classes
  'Date', 'Map', 'Set', 'Array', 'Promise', 'Symbol',
  'RegExp', 'Error', 'WeakMap', 'WeakSet', 'WeakRef',
  'ArrayBuffer', 'Uint8Array', 'Buffer',
])
```

---

## Default Exclusion Patterns (constant — internal)

```typescript
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.d.ts',
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/jest.config*',
]
```

**Note**: Test files (`*.spec.ts`, `*.test.ts`) are excluded by default. If the user's project has architecture patterns in test infrastructure (e.g., custom test base classes), `excludePatterns` can override this.
