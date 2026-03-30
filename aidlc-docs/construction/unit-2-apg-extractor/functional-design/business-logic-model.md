# Business Logic Model — Unit 2: APG Extractor

## Overview

The APG Extractor (C1) is the first pipeline stage. It takes a path to a TypeScript project root and produces a fully structured Architectural Property Graph (APG) as a `DomainResult<APGResult>`.

**Input**: `string` — absolute path to TypeScript project root
**Output**: `DomainResult<APGResult>` — nodes[], edges[], parseCoverage, warnings[]

---

## Extraction Lifecycle

```
ProjectPath
    │
    ▼
1. Project Initialization
   │  • Create ts-morph Project (lenient mode)
   │  • Load tsconfig.json
   │  • Collect all .ts source files (excluding node_modules, dist, *.d.ts)
   │  • Total file count = N
    │
    ▼
2. Node Extraction Pass  (single traversal over all source files)
   │  • Per file: create File node
   │  • Per ClassDeclaration: create Class node
   │  • Per InterfaceDeclaration: create Interface node
   │  • Per MethodDeclaration (inside class): create Method node
   │  • Per FunctionDeclaration / exported const arrow: create Function node
   │  • Build NodeRegistry (nodeMap, fileNodeMap, classNodeMap)
    │
    ▼
3. Edge Extraction Pass  (second traversal, NodeRegistry available)
   │  • IMPORTS: per import declaration → resolve barrel → emit File→File edge
   │  • DECLARES: per top-level entity → emit File→{Class|Interface|Function} edge
   │  • CONTAINS: per class method → emit Class→Method edge
   │  • EXTENDS: per heritage clause → emit Class→Class or Interface→Interface edge
   │  • IMPLEMENTS: per heritage clause → emit Class→Interface edge
   │  • CONSTRUCTOR_INJECTS: per constructor param (decorator+structural) → emit Class→{Class|Interface}
   │  • CALLS: per call expression in method body (cross-boundary) → emit Method→Method edge
    │
    ▼
4. Edge Deduplication
   │  • Same (type, sourceId, targetId) → keep first, discard duplicates silently
    │
    ▼
5. Parse Coverage Computation
   │  • parsed = files that successfully produced a File node
   │  • skipped = files that threw during parse
   │  • percentage = round((parsed / total) * 10) / 10
    │
    ▼
6. Result Assembly
   • DomainResult.ok({ nodes, edges, parseCoverage, warnings })
   • On fatal failure (project unreadable): DomainResult.fail([ExtractorError])
```

---

## Node Extraction Rules

### File Node
- **One per source file** (including barrel files)
- `name` = basename of file (e.g., `user.service.ts`)
- `filePath` = normalized path relative to project root (POSIX separators)
- `decorators` = `[]`
- `properties` = `{ isBarrel: boolean }` — `true` when file contains only re-export statements

### Class Node
- **One per `ClassDeclaration`**
- `name` = class identifier (or `<anonymous>` if unnamed)
- `filePath` = enclosing source file path
- `decorators` = array of decorator names applied to the class (e.g., `['Injectable', 'Controller']`)
- `properties` = `{ isAbstract: boolean, typeParameters: string[] }`

### Interface Node
- **One per `InterfaceDeclaration`**
- `name` = interface identifier
- `filePath` = enclosing source file path
- `decorators` = `[]` (TypeScript interfaces have no runtime decorators)
- `properties` = `{ typeParameters: string[] }`

### Method Node
- **One per `MethodDeclaration`** within a class (includes getters, setters, abstract methods)
- `name` = **qualified name**: `{ClassName}.{methodName}` — ensures uniqueness across classes
- `filePath` = enclosing source file path
- `decorators` = method-level decorators (e.g., `['Get', 'Post', 'UseGuards']`)
- `properties` = `{ isAsync: boolean, isStatic: boolean, isAbstract: boolean, returnType: string }`

### Function Node
- **One per `FunctionDeclaration`** at module level
- **One per exported `const` arrow function** with explicit type annotation
  (e.g., `export const handler: RequestHandler = async (req, res) => {}`)
- Anonymous inline callbacks are NOT extracted
- `name` = function identifier or variable name
- `filePath` = enclosing source file path
- `decorators` = `[]`
- `properties` = `{ isAsync: boolean, isExported: boolean }`

---

## Edge Extraction Rules

### IMPORTS (File → File)
- Source: File node
- Target: File node of the imported module
- **Barrel resolution**: if target is a barrel (isBarrel=true), follow re-exports transitively to the original declaring file (max depth: 10; if exceeded, emit warning and keep edge to current depth)
- External/node_modules imports: **skip** (no edge; add ExtractorWarning with code `EXTRACTOR_001`)
- Unresolvable module path: **skip** (add ExtractorWarning with code `EXTRACTOR_002`)
- `properties` = `{ importedNames: string[], isTypeOnly: boolean }`

### DECLARES (File → Class|Interface|Function)
- Source: File node
- Target: any top-level `ClassDeclaration`, `InterfaceDeclaration`, or `FunctionDeclaration` in that file
- Also covers exported `const` arrow functions at module level
- `properties` = `{}`

### CONTAINS (Class → Method)
- Source: Class node
- Target: Method node declared directly within that class
- Includes: regular methods, static methods, getters (`get X()`), setters (`set X()`), abstract methods
- Excludes: inherited methods not redeclared in this class
- `properties` = `{}`

### EXTENDS (Class → Class | Interface → Interface)
- Source: Class or Interface node
- Target: parent Class or Interface node
- Resolved via ts-morph `getBaseClass()` / `getBaseDeclarations()`
- If parent is not in the extracted node set (external, unresolved): **skip** + ExtractorWarning `EXTRACTOR_003`
- `properties` = `{}`

### IMPLEMENTS (Class → Interface)
- Source: Class node
- Target: Interface node from `implements` clause
- If interface is not in the extracted node set: **skip** + ExtractorWarning `EXTRACTOR_004`
- `properties` = `{}`

### CONSTRUCTOR_INJECTS (Class → Class|Interface)
Detection algorithm (answers Q2: C — decorator-first then structural fallback):

```
for each ClassDeclaration:
  decoratorBased = class has any of: @Injectable, @Controller, @Service,
                   @Repository, @Component, @Provider, @Module, @Guard, @Interceptor
  constructor = class.getConstructors()[0]
  if constructor exists:
    for each ParameterDeclaration:
      typeName = param.getType().getText()
      if typeName is primitive (string, number, boolean, object, any, unknown, never,
         void, null, undefined, Date, Map, Set, Array, Promise, Symbol): skip
      if typeName is generic type parameter (single uppercase letter or declared typeParam): skip
      targetNode = nodeRegistry.lookup(typeName, currentFilePath)
      if targetNode found:
        emit CONSTRUCTOR_INJECTS edge
        properties = { parameterName: param.getName(), decoratorBased }
      else:
        add ExtractorWarning EXTRACTOR_005 ("Unresolved DI type: {typeName}")
```

### CALLS (Method|Function → Method|Function)
Cross-boundary only (answers Q3: A):

```
for each MethodDeclaration or FunctionDeclaration:
  sourceNode = nodeRegistry.lookupMethod/function(this)
  callExpressions = node.getDescendantsOfKind(SyntaxKind.CallExpression)
  for each CallExpression:
    calleeSymbol = resolveCallee(callExpression)
    targetNode = nodeRegistry.lookupBySymbol(calleeSymbol)
    if targetNode found AND targetNode.class != sourceNode.class:
      emit CALLS edge (deduplicated by source+target — callCount incremented)
      properties = { callCount: N }
```

---

## Node ID Generation

```
nodeId = sha256(lowercase("{type}:{normalizedFilePath}:{name}")).slice(0, 16)
edgeId = sha256(lowercase("{edgeType}:{sourceId}:{targetId}")).slice(0, 16)
```

- `normalizedFilePath` = POSIX path relative to project root (no leading `/`)
- All inputs lowercased before hashing (handles macOS/Windows case-insensitivity)
- 16 hex chars = 64-bit address space; collision probability negligible for source code elements

**Example**:
```
nodeId = sha256("class:src/services/user.service.ts:userservice").slice(0, 16)
       = "a3f7d2e1b9c84f21"
```

---

## Barrel Detection

A file is marked `isBarrel: true` when all statements are one of:
- `ExportDeclaration` (re-exports from other modules)
- `ImportDeclaration` immediately followed by `ExportDeclaration` (import-then-re-export pattern)

Barrel files still receive a File node. IMPORTS edges skip through them transitively:
- Max traversal depth: **10 levels**
- Exceeding depth: emit warning `EXTRACTOR_006` and keep edge at current depth
- Circular barrel chains: detected and broken (emit warning `EXTRACTOR_007`)

---

## Parse Coverage Computation

```
total    = count of .ts files found under projectPath
           (excluding: node_modules/**, dist/**, build/**, **/*.d.ts)
parsed   = count of files that successfully produced a File node
skipped  = files that threw during ts-morph getSourceFile() or produced zero nodes
           due to a parse error

percentage = Math.round((parsed / total) * 10) / 10   // 1 decimal place

parseCoverage = { total, parsed, percentage, skipped: SkippedFile[] }
```

**Note**: A file with missing imports that are skipped as warnings does NOT count as a skipped file — it is still considered parsed. Only structural parse failures count as skipped.

---

## APGResult Assembly

```typescript
return DomainResult.ok<APGResult>({
  nodes: Array.from(nodeRegistry.nodes.values()),
  edges: deduplicatedEdges,
  parseCoverage,
  warnings,
})

// On fatal (e.g., projectPath doesn't exist, no tsconfig.json found):
return DomainResult.fail<APGResult>([{
  code: 'PROJECT_NOT_FOUND' | 'TSCONFIG_NOT_FOUND',
  message: '...',
  stage: 'apg-extractor',
  critical: true,
}])
```
