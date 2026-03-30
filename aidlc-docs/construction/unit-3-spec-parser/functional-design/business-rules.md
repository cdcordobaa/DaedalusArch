# Unit 3 — Spec Parser + Fitness Compiler: Business Rules

## Spec Parsing Rules

### BR-SPEC-01: Spec Version
- `spec_version` must be a valid semver string
- Currently only `"1.0.0"` is supported; unknown versions → fatal error

### BR-SPEC-02: Architecture Style
- `architecture.style` is optional
- If present, must match a key in the static template registry
- If absent, `fitness_functions` must be declared explicitly (no template merge)

### BR-SPEC-03: Layer Definitions
- `architecture.layers` is required, minimum 2 layers
- Each layer must have: `name` (unique string), `directories` (non-empty glob array), `roles` (non-empty string array)
- `decorators` is optional (empty array if absent)
- Layer names must be unique within the spec
- Directory globs must be valid glob syntax

### BR-SPEC-04: Fitness Function Declarations
- Each function must have: `id` (unique, format `FF-[A-Z]{1,3}[0-9]{2}`), `name` (non-empty), `dimension` (valid Dimension enum), `severity` (valid Severity enum), `route` (valid Route enum)
- `threshold` is optional (defaults depend on function)
- `validated` is optional (defaults to `false`)
- `isBuiltIn` is set automatically: `true` if from template, `false` if user-declared

### BR-SPEC-05: Semantic Criteria Requirement
- Functions with `route: "neuronal"` or `route: "hybrid"` MUST have `semantic_criteria`
- Functions with `route: "symbolic"` MUST NOT have `semantic_criteria`
- `semantic_criteria` must have: `rule` (non-empty), `rubric.pass`, `rubric.fail`, `rubric.evidence_required`

### BR-SPEC-06: Scoring Weights
- `scoring.weights` is required; keys must include: structural, coupling, pattern, solid, convention
- All weight values must be >= 0 and <= 1
- Weights must sum to 1.0 (tolerance: ±0.001 for floating point)
- If sum is within tolerance but not exact, auto-correct to 1.0 (normalize) and emit SPEC_003 warning

### BR-SPEC-07: Full Mode Weights
- `scoring.full_mode_weights` is optional
- If present, must include all 7 dimension keys (structural, coupling, pattern, solid, convention, semantic, intent)
- Same sum-to-1.0 rule as BR-SPEC-06

### BR-SPEC-08: Verdict Thresholds
- `scoring.thresholds` is required
- Must have: `pass`, `warning`, `soft_block`
- Must satisfy: `pass > warning > soft_block > 0`
- All values between 0 and 1 (exclusive)
- Below `soft_block` → implicit hard-block (no explicit threshold)

### BR-SPEC-09: Confidence Thresholds
- `confidence_thresholds` is required
- Must have: `high`, `medium`, `icc_minimum`
- Must satisfy: `high > medium > 0` and `icc_minimum > 0`
- All values between 0 and 1

## Template Resolution Rules

### BR-TMPL-01: Registry Lookup
- Template key is case-insensitive (`Clean-Architecture` = `clean-architecture`)
- Unknown key → fatal error with suggestion (Levenshtein distance < 3)

### BR-TMPL-02: Merge Precedence
- Spec-declared function with same `id` as template function → spec wins (full override)
- Spec-declared function with new `id` → appended to template set
- Template functions not mentioned in spec → included as-is

### BR-TMPL-03: Template Immutability
- Built-in templates are frozen constants; never modified at runtime
- Merge produces a new array, leaving template unchanged

## ADR Parsing Rules

### BR-ADR-01: Format Detection Order
- Try detection in order: MADR → Nygard → Y-Statement → custom-yaml
- First match wins (a file matching MADR markers won't also be tried as Nygard)
- If no format matches for `.md` files → skip with ADR_002 warning
- `.yaml`/`.yml` files always attempted as custom-yaml

### BR-ADR-02: MADR Detection Markers
- File contains `## Decision Drivers` OR `## Considered Options`
- Extract: title (H1), status, decision drivers, decision outcome, consequences

### BR-ADR-03: Nygard Detection Markers
- File contains all three: `## Status`, `## Context`, `## Decision`
- Extract: title (H1), status, context, decision, consequences

### BR-ADR-04: Y-Statement Detection Markers
- File contains `In the context of` AND `we decided` AND `to achieve`
- Extract: context, facing concern, decision, achieving quality, accepting downside

### BR-ADR-05: Custom YAML Format
- Root key `adr:` with required fields: `title`, `status`, `context`, `decision`
- Optional: `consequences`, `cypher_rule`

### BR-ADR-06: Semantic Criterion Generation
- Always generated from ADR prose
- `rule` = decision text (first 500 chars if longer)
- `rubric.pass` = "Code adheres to: {decision summary}"
- `rubric.fail` = "Code violates: {decision summary}"
- `rubric.evidenceRequired` = "Cite specific code that confirms or violates the decision"

### BR-ADR-07: Optional Symbolic Rule (v1)
- Only populated if ADR contains explicit `cypher_rule:` block (custom-yaml format)
- `cypher_rule.query` = Cypher string, `cypher_rule.params` = param map, `cypher_rule.description` = text
- For non-YAML ADR formats, `symbolicRule` is always undefined in v1

### BR-ADR-08: ADR Reference Validation
- If spec references an ADR via `adr_ref: "path/to/adr.md"`, validate file exists
- Missing file → ADR_003 warning (non-fatal), ADR rule still created with `rawContent: ""`

### BR-ADR-09: Shadow Mode Tagging
- All ADR rules are tagged `shadowModeEligible: true`
- `shadowPrompt` generated from ADR prose for U5 LLM Cypher auto-generation
- Shadow mode is metadata-only in U3; execution happens in U5

## Fitness Compiler Rules

### BR-COMP-01: Template Lookup
- Each symbolic/hybrid function's `name` must match a key in the hardcoded template map
- Unknown name → COMPILER_002 warning, function skipped from symbolic output
- Neuronal-only functions → COMPILER_001 info (expected, no template needed)

### BR-COMP-02: Parameter Instantiation
- Template placeholders use `$paramName` syntax
- Params sourced from: spec layer definitions, function-specific fields (threshold, pattern, etc.), computed values (layer adjacency)
- Missing required param → fatal error (template cannot be instantiated)
- Extra params (not in template) → silently ignored

### BR-COMP-03: Route Tagging
- Every compiled output is tagged with its route: `symbolic`, `neuronal`, or `hybrid`
- Symbolic: only `TaggedCypherQuery` produced
- Neuronal: only `NeuronalInstruction` produced
- Hybrid: both `TaggedCypherQuery` AND `NeuronalInstruction` produced, linked as `HybridPair`

### BR-COMP-04: Function ID Uniqueness
- No duplicate function IDs in compiled output
- If duplicates found → fatal error (spec validation should have caught this)

### BR-COMP-05: ADR Rule Compilation
- ADR rules with `symbolicRule` → compile as symbolic (include Cypher as-is, no template lookup)
- ADR rules always produce `NeuronalInstruction` from `semanticCriterion`
- ADR rules with both → compiled as hybrid

### BR-COMP-06: Output Completeness
- `CompiledFunctions.symbolicQueries` = all symbolic + hybrid symbolic parts + ADR symbolic rules
- `CompiledFunctions.neuronalInstructions` = all neuronal + hybrid neuronal parts + ADR neuronal rules
- `CompiledFunctions.hybridPairs` = all hybrid functions + ADR rules with both symbolic and neuronal
- Total compiled count must equal total input function count + ADR rule count

## JSON Schema Validation Rules

### BR-SCHEMA-01: Two-Pass Validation
- Pass 1 (Ajv): Structural validation — required fields, types, enum values, array formats
- Pass 2 (Code): Business rules — weight sums, threshold ordering, route/semantic_criteria consistency

### BR-SCHEMA-02: Error Reporting
- Ajv errors mapped to YAML line numbers via CST source positions
- Code validation errors include field path (e.g., `scoring.weights.structural`)
- All errors collected (not fail-fast) — user sees all issues at once

### BR-SCHEMA-03: Schema Version
- JSON Schema must match spec_version
- Future: schema registry keyed by version
- v1: single schema for spec_version "1.0.0"
