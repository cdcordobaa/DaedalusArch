# U0 Business Rules — Shared Extensions

## BR-1: Enabled Field Defaults
- If `enabled` is not present in YAML, default to `true`
- If `enabled` is explicitly `false`, the function is skipped during compilation
- If `enabled` is explicitly `true`, behavior is identical to v1.0 (no change)
- The `reason` field is only meaningful when `enabled: false` — ignored otherwise

## BR-2: Exclude Paths Scope
- `exclude_paths` is per-fitness-function, not global
- Global exclusions (node_modules, dist) are defined in presets and applied to all functions via preset merge logic (U1)
- An empty `exclude_paths` array means no exclusions (all files evaluated)
- Exclude paths filter the **violator file**, not all files in the query — a violation is suppressed only if the violating file matches an exclude pattern

## BR-3: Glob Pattern Syntax
- Supported: `*` (single level), `**` (recursive), `?` (single char), literal paths
- Not supported: negation (`!`), brace expansion (`{a,b}`), character classes (`[abc]`)
- Invalid patterns produce a validation error, not a runtime crash
- Patterns are matched against the file path relative to project root (as stored in APG `filePath` property)

## BR-4: Validation is Non-Destructive
- Validation reads the spec and filesystem but modifies nothing
- Validation errors do not prevent parsing — the spec can still be loaded for inspection
- The `firewall validate` command reports errors and returns exit code 1, but does not modify the spec file
- Validation is optional — `firewall evaluate` does not require prior validation

## BR-5: Backward Compatibility Guarantee
- v1.0 specs (`specs/clean-arch.yaml`) must parse without errors or warnings
- Missing `enabled` field → `true` (no behavioral change)
- Missing `exclude_paths` field → `[]` (no exclusions, same as v1.0)
- No new required fields — all v1.1 fields are optional
- All 312 existing tests must pass without modification

## BR-6: Cypher Injection Safety
- Exclude path patterns are passed as Neo4j parameters (`$excludePatterns`), never interpolated into Cypher strings
- Glob-to-regex conversion produces anchored patterns (`^...$`) to prevent partial matches
- The NONE() predicate is appended to existing WHERE clauses, never replaces them

## BR-7: Disabled Functions in Reports
- Disabled functions appear in evaluation reports as "disabled" with their reason
- Disabled functions do not count toward AHS calculation (neither pass nor fail)
- Disabled functions are not violations — they are informational entries in the report
- The dashboard (U2) shows disabled functions as grayed-out cards

## BR-8: Validation Error Priority
- Errors are ordered: structural issues first (missing dirs), then ID issues, then per-function issues
- All errors are collected (not fail-fast) — user sees the complete list
- Warnings are informational and don't affect the exit code
