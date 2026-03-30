# Business Rules — Unit 2: APG Extractor

## Node Type Rules

| Rule | Description |
|------|-------------|
| BR-APG-01 | Exactly 5 node types are permitted: `File`, `Class`, `Interface`, `Method`, `Function`. Any other node type is a bug. |
| BR-APG-02 | Every node must have a non-empty `id`, `type`, `filePath`, and `name`. |
| BR-APG-03 | `Method` node names use the qualified format `{ClassName}.{methodName}` to ensure uniqueness across classes in the same file. |
| BR-APG-04 | `File` nodes are created for ALL `.ts` source files, including barrels. |
| BR-APG-05 | Anonymous inline callbacks (arrow functions passed as arguments) are NOT extracted as `Function` nodes. Only module-level `FunctionDeclaration` and exported `const` arrow functions with explicit type annotations are extracted. |
| BR-APG-06 | `Interface` nodes never have decorators (TypeScript runtime limitation). |

## Edge Type Rules

| Rule | Description |
|------|-------------|
| BR-APG-07 | Exactly 7 edge types are permitted: `IMPORTS`, `IMPLEMENTS`, `EXTENDS`, `CONSTRUCTOR_INJECTS`, `CALLS`, `DECLARES`, `CONTAINS`. Any other edge type is a bug. |
| BR-APG-08 | Every edge must have a non-empty `id`, `type`, `sourceId`, and `targetId`. |
| BR-APG-09 | Both `sourceId` and `targetId` must reference IDs of nodes present in the same `APGResult`. Dangling edge references are not permitted. |
| BR-APG-10 | Duplicate edges — same `(type, sourceId, targetId)` tuple — are silently deduplicated. First occurrence wins. |
| BR-APG-11 | `CALLS` edges are cross-boundary only: source and target must belong to different classes or modules. Intra-class calls are not captured. |
| BR-APG-12 | `CONSTRUCTOR_INJECTS` edges skip primitive types: `string`, `number`, `boolean`, `object`, `any`, `unknown`, `never`, `void`, `null`, `undefined`, `symbol`, and built-in classes: `Date`, `Map`, `Set`, `Array`, `Promise`, `Symbol`, `RegExp`, `Error`. |
| BR-APG-13 | `CONSTRUCTOR_INJECTS` edges skip generic type parameters (single uppercase letter or a declared type parameter name on the enclosing class/function). |
| BR-APG-14 | Edges to external modules (node_modules) are never created. |

## ID Generation Rules

| Rule | Description |
|------|-------------|
| BR-APG-15 | Node IDs are deterministic: `SHA-256(lowercase("{type}:{normalizedFilePath}:{name}")).slice(0, 16)`. |
| BR-APG-16 | Edge IDs are deterministic: `SHA-256(lowercase("{edgeType}:{sourceId}:{targetId}")).slice(0, 16)`. |
| BR-APG-17 | `normalizedFilePath` is always a POSIX path relative to the project root, with no leading `/`. |
| BR-APG-18 | All inputs to the ID hash function are lowercased before hashing to ensure case-insensitive stability on macOS/Windows. |

## File Exclusion Rules

| Rule | Description |
|------|-------------|
| BR-APG-19 | The following patterns are always excluded: `**/node_modules/**`, `**/dist/**`, `**/build/**`, `**/*.d.ts`. |
| BR-APG-20 | Additional exclusion glob patterns may be specified via `ExtractorOptions.excludePatterns`. |

## Barrel Resolution Rules

| Rule | Description |
|------|-------------|
| BR-APG-21 | A file is a barrel if all its statements are `ExportDeclaration` or paired `ImportDeclaration`+`ExportDeclaration`. |
| BR-APG-22 | `IMPORTS` edges skip through barrels transitively to the original source file. |
| BR-APG-23 | Maximum barrel traversal depth is 10 levels. Beyond 10, emit warning `EXTRACTOR_006` and keep edge at current depth. |
| BR-APG-24 | Circular barrel chains are detected (by tracking visited paths) and broken. Emit warning `EXTRACTOR_007`. |
| BR-APG-25 | Barrel files still receive a `File` node with `properties.isBarrel = true`. |

## Lenient Mode Rules

| Rule | Description |
|------|-------------|
| BR-APG-26 | Lenient mode is always enabled by default (`ExtractorOptions.lenientMode = true`). |
| BR-APG-27 | In lenient mode, individual file parse failures do NOT abort the extraction. The file is added to `parseCoverage.skipped` and extraction continues. |
| BR-APG-28 | Unresolvable imports in lenient mode emit an `ExtractorWarning` but do not count as skipped files. |
| BR-APG-29 | Fatal errors (project path not found, no tsconfig) always abort and return `DomainResult.fail(...)` regardless of lenient mode. |

## Parse Coverage Rules

| Rule | Description |
|------|-------------|
| BR-APG-30 | `total` = count of all `.ts` files found after applying exclusion rules. |
| BR-APG-31 | `parsed` = count of files that successfully produced a `File` node. |
| BR-APG-32 | `skipped` = files that threw during ts-morph parsing or produced zero nodes due to a parse error. |
| BR-APG-33 | `percentage` = `Math.round((parsed / total) * 10) / 10` — rounded to 1 decimal place. |
| BR-APG-34 | Files with unresolvable imports (lenient skip) are counted as `parsed`, NOT `skipped`. |
| BR-APG-35 | If `total = 0`, `percentage = 100` (vacuously true — no files to fail). |

## Warning Code Registry

| Code | Meaning |
|------|---------|
| `EXTRACTOR_001` | External/node_modules import skipped (no IMPORTS edge created) |
| `EXTRACTOR_002` | Module path unresolvable (no IMPORTS edge created) |
| `EXTRACTOR_003` | EXTENDS target not in extracted node set (edge skipped) |
| `EXTRACTOR_004` | IMPLEMENTS target not in extracted node set (edge skipped) |
| `EXTRACTOR_005` | CONSTRUCTOR_INJECTS type unresolvable (edge skipped) |
| `EXTRACTOR_006` | Barrel resolution depth exceeded (kept edge at max depth) |
| `EXTRACTOR_007` | Circular barrel chain detected (resolution aborted at cycle) |
