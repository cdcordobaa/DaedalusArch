# U1 Business Logic Model — Track A Spec Generation & Baseline

## Preset Loading & Merging (C3 Extensions)

### loadPreset(styleName)
- Scans `presets/` directory for `{styleName}.yaml`
- Parses via YAML library, validates against spec JSON schema
- Returns `DomainResult<ParsedSpec>` — same type as regular spec parsing
- Candidate directories resolved in order: `../../presets`, `../../../presets`, `cwd/presets`

### mergeSpecs(preset, overrides)
- Deep merge with project-wins precedence
- Layers: override directories by layer name (exact match)
- Fitness functions: override threshold/enabled/exclude_paths/severity by ID
- Global exclude_paths: appended to every function's excludePaths array
- Returns merge warnings for each overridden function

### listPresets()
- Scans `presets/` for `*.yaml` / `*.yml` files
- Returns array of style names (filename sans extension)

## Baseline Manager (C12 — New Component)

### Key Generation
- `generateKey(violation)`: Concatenates `functionId::filePath::violationType`, hashes with djb2
- No line numbers in key — too volatile across edits
- Returns 8-char hex string

### Lifecycle
- `createBaseline(violations, specFile)`: Maps violations to entries, assembles snapshot
- `saveBaseline(snapshot, filePath)`: JSON.stringify with 2-space indent
- `loadBaseline(filePath)`: Reads JSON, validates structure via type guard
- `compareBaseline(current, baseline, path)`: Set-based comparison on keys

### Comparison Algorithm
1. Build key set from baseline entries
2. Build key map from current violations
3. For each current violation: if key in baseline → baselineViolation, else → newViolation
4. For each baseline entry: if key not in current → removedFromBaseline

## Pipeline Commands

### ValidateSpecCommand
- Reads ParsedSpec from context
- Calls `validateSpecAgainstProject(spec, projectPath)`
- Returns fail if any validation errors, ok otherwise

### CreateBaselineCommand
- Reads EvaluationReport from context
- Calls `createBaseline(report.violations, specFilePath)`
- Saves to configured output path

### CompareBaselineCommand
- Loads baseline from file
- Reads violations from context report
- Calls `compareBaseline()`, stores result in shared state
