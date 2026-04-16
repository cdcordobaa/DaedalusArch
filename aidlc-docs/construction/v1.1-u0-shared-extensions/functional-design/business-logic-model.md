# U0 Business Logic Model — Shared Extensions

## BL-1: Exclude Paths Processing (C4 Fitness Compiler)

### Glob-to-Regex Conversion
Convert glob patterns from `exclude_paths` into Neo4j-compatible regex for `=~` operator.

**Rules**:
| Glob | Regex | Example |
|------|-------|---------|
| `*` | `[^/]*` | `src/*.ts` → `src/[^/]*\\.ts` |
| `**` | `.*` | `src/**` → `src/.*` |
| `?` | `.` | `file?.ts` → `file.\\.ts` |
| `.` | `\\.` | Literal dot escaped |

**Algorithm**:
```
globToRegex(pattern):
  1. Escape regex special chars (. + ^ $ | ( ) [ ] { })
  2. Replace ** with <<GLOBSTAR>> placeholder
  3. Replace * with [^/]*
  4. Replace ? with .
  5. Replace <<GLOBSTAR>> with .*
  6. Wrap with ^ and $ anchors
  return regex string
```

### WHERE NOT Clause Injection
After template instantiation, append exclude path filtering to Cypher.

**Strategy**: Inject into the compiled Cypher string, not into templates. This keeps templates clean and makes exclude_paths orthogonal to template logic.

**Pattern**:
```cypher
// Original compiled Cypher:
MATCH (source)-[:IMPORTS]->(target) WHERE source.layer = 'domain' AND target.layer = 'infrastructure' RETURN source.filePath AS violator

// After injection (if exclude_paths present):
MATCH (source)-[:IMPORTS]->(target) WHERE source.layer = 'domain' AND target.layer = 'infrastructure' AND NONE(pattern IN $excludePatterns WHERE source.filePath =~ pattern) RETURN source.filePath AS violator
```

**Injection logic**:
```
injectExcludePaths(cypher, excludePaths):
  if excludePaths is empty: return cypher unchanged
  regexPatterns = excludePaths.map(globToRegex)
  
  // Find the RETURN clause position
  returnIdx = cypher.lastIndexOf('RETURN')
  
  // Insert NONE() predicate before RETURN
  excludeClause = "AND NONE(pattern IN $excludePatterns WHERE source.filePath =~ pattern) "
  
  // Also add to params
  return { 
    cypher: cypher.slice(0, returnIdx) + excludeClause + cypher.slice(returnIdx),
    additionalParams: { excludePatterns: regexPatterns }
  }
```

**Edge case**: Some templates use `n.filePath` instead of `source.filePath`. The injection must detect the node alias from the template. Solution: the exclude clause targets whichever node represents the "violating file" — determined from the RETURN clause alias.

---

## BL-2: Enabled/Disabled Function Filtering (C4 Fitness Compiler)

### Filter Logic
Before compilation, partition functions into enabled and disabled sets.

```
filterEnabled(functions):
  enabled = functions.filter(f => f.enabled !== false)
  disabled = functions.filter(f => f.enabled === false)
    .map(f => { id: f.id, name: f.name, reason: f.disabledReason })
  return { enabled, disabled }
```

**Where it hooks in**: At the top of `compileFunctions()` (line 22 of fitness-compiler.ts), before the duplicate ID check. Disabled functions are removed from compilation entirely and collected for reporting.

**Backward compatibility**: Functions without `enabled` field default to `true` (handled at parse time in spec-parser).

---

## BL-3: Spec Validation (C3 Spec Parser)

### Validation Checks

| Check | Error Code | Logic |
|-------|-----------|-------|
| Layer dir exists | `LAYER_DIR_NOT_FOUND` | For each layer, check `fs.existsSync(projectPath/layerDir)` |
| Unique function IDs | `DUPLICATE_FUNCTION_ID` | Set-based uniqueness check across all functions |
| Valid template ref | `INVALID_TEMPLATE_REF` | For symbolic/hybrid functions, `CYPHER_TEMPLATES.has(ff.name)` |
| Valid threshold | `INVALID_THRESHOLD` | `threshold > 0` when present, type is number |
| Valid glob patterns | `INVALID_GLOB_PATTERN` | Try to compile each pattern via globToRegex — catch syntax errors |
| Valid dimension | `UNKNOWN_DIMENSION` | Value is one of the 7 Dimension enum values |
| Valid severity | `UNKNOWN_SEVERITY` | Value is one of Severity enum values |
| Valid route | `UNKNOWN_ROUTE` | Value is one of Route enum values |

### Validation Pipeline
```
validateSpec(spec, projectPath):
  errors = []
  warnings = []
  
  // Layer validation
  for layer in spec.layerModel.layers:
    for dir in layer.directories:
      if not exists(projectPath/dir):
        errors.push(LAYER_DIR_NOT_FOUND, dir)
  
  // Function ID uniqueness
  ids = spec.fitnessFunctions.map(f => f.id)
  duplicates = findDuplicates(ids)
  for dup in duplicates:
    errors.push(DUPLICATE_FUNCTION_ID, dup)
  
  // Per-function validation
  for ff in spec.fitnessFunctions:
    if ff.route in ['symbolic', 'hybrid']:
      if not templateExists(ff.name):
        errors.push(INVALID_TEMPLATE_REF, ff.name)
    if ff.threshold !== undefined and (typeof ff.threshold !== 'number' or ff.threshold < 0):
      errors.push(INVALID_THRESHOLD, ff.id)
    for glob in ff.excludePaths:
      try: globToRegex(glob)
      catch: errors.push(INVALID_GLOB_PATTERN, glob)
  
  // Build summary
  summary = { totalFunctions, enabledFunctions, disabledFunctions, totalLayers, totalErrors, totalWarnings }
  
  return { valid: errors.length === 0, errors, warnings, summary }
```

### Where it hooks in
New file `src/spec-parser/spec-validator.ts`. Called by:
- `firewall validate` CLI command (U1)
- The skill after generating a spec (U1)
- Optionally at the start of `parseSpec()` as an early-exit validation

---

## BL-4: Exclude Paths and Enabled Parsing (C3 Spec Parser)

### Parse Rules
In `parseLayerB()` (layer-parsers.ts, lines 46-77):

```
for each function f in raw.fitness_functions:
  // Existing parsing...
  
  // v1.1 additions:
  enabled = f.enabled !== undefined ? Boolean(f.enabled) : true
  excludePaths = Array.isArray(f.exclude_paths) ? f.exclude_paths : []
  disabledReason = typeof f.reason === 'string' ? f.reason : undefined
  
  // Build function object with new fields
  return { ...existingFields, enabled, excludePaths, disabledReason }
```

### Template Merge Rule
When a spec declares a function that overrides a template function:
- `enabled` from spec overrides template (spec can disable a template function)
- `excludePaths` from spec replaces template defaults (not merged — spec owns paths)
- Other fields follow existing merge logic (spec wins)
