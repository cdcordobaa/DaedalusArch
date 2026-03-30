# Business Logic Model — Unit 1: Shared Domain

## 1. DomainResult<T> Pattern

All component methods and service methods return `DomainResult<T>`. This is the universal result envelope.

### Flow Rules

```
┌─────────────────────────────────────────────────────────────┐
│                   DomainResult<T> Rules                      │
│                                                             │
│  success: true   → data: T must be present                  │
│                    warnings: optional (non-blocking)         │
│                                                             │
│  success: false  → errors: DomainError[] must be non-empty  │
│                    data: absent                             │
│                    warnings: optional (additional context)   │
│                                                             │
│  Critical errors → pipeline stops (PipelineError.critical)  │
│  Non-critical    → accumulated in FirewallContext.warnings   │
└─────────────────────────────────────────────────────────────┘
```

### Error Propagation Pattern

```
Stage N fails critically:
  PipelineExecutor catches DomainResult { success: false, errors: [critical] }
  → Pipeline stops immediately
  → EvaluationReport not produced
  → CLI exits with code 2

Stage N fails non-critically:
  Stage returns DomainResult { success: true, data: ..., warnings: [...] }
  → context.addWarning(warning) called
  → Pipeline continues
  → Warnings appear in final EvaluationReport
```

---

## 2. FirewallContext Lifecycle

The `FirewallContext` is the single state carrier for a pipeline run.

### Lifecycle Stages

```
1. PipelineExecutor creates:    new FirewallContext(runId)
                                     ↓
2. APG Extractor Command:       context.setApgResult(result)
   Spec Parser Command:         context.setParsedSpec(spec)   [parallel]
                                     ↓
3. Neo4j Ingestion Command:     context.setIngestionResult(result)
                                     ↓
4. Fitness Compiler Command:    context.setCompiledFunctions(functions)
                                     ↓
5. Router Command dispatches:
   Symbolic path reads:         context.getCompiledFunctions()
   Neuronal path reads:         context.getCompiledFunctions()
   Router writes:               context.setEvaluationResults(results)
                                     ↓
6. Scoring Command:             reads all, context.setReport(report)
                                     ↓
7. Report Command reads:        context.getReport()
                                     ↓
8. PipelineExecutor returns:    context.snapshot()
```

### Set-Once Invariant
Each `setX()` method throws if called a second time. This prevents silent state corruption in complex pipeline configurations. Commands must be designed to call setters exactly once.

### No Partial State Access
Getters throw with descriptive messages if the prerequisite stage hasn't run. This catches pipeline configuration errors at runtime, not silently.

---

## 3. Pipeline Stage Contract

All pipeline stages implement `PipelineCommand` (for orchestrated stages) or `PipelineStage<TInput, TOutput>` (for composable sub-components).

```
PipelineCommand contract:
  Input:   FirewallContext (reads needed prerequisites)
  Output:  DomainResult<void> (writes result to context via typed setter)
  Side-effects: context.addAuditEntry(), context.addWarning() only

PipelineStage<TInput, TOutput> contract:
  Input:   Typed domain input (not raw context)
  Output:  DomainResult<TOutput>
  Use:     Sub-component composition (Router dispatching to Engine)
```

---

## 4. Value Object Invariants

| Value Object | Invariant | Constructor throws if |
|-------------|-----------|----------------------|
| AVRScore | [0.0, 1.0] | n < 0 or n > 1 |
| AHSScore | [0.0, 1.0] | n < 0 or n > 1 |
| Confidence | [0.0, 1.0] | n < 0 or n > 1 |
| CommitSha | /^[0-9a-f]{40}$/i | not 40-char hex |

Smart constructors are the only way to create value objects. TypeScript's branding ensures the type system rejects raw numbers/strings where a branded type is expected.

---

## 5. Scoring Model (defined here as the domain formula)

### AVR (per dimension d)

```
AVR(d) = violatedFunctions(d) / totalFunctions(d)
```
Where `totalFunctions(d)` is the count of fitness functions assigned to dimension `d` that were evaluated.

### AHS (overall)

```
AHS = Σ( weight(d) × (1 - AVR(d)) )  for all dimensions d
    = Σ( weight(d) × passRate(d) )
```
Weights come from Layer C of the AoC spec. Must sum to 1.0.

### Dual Scoring
- `ahs_deterministic`: computed from symbolic results only (AVR uses only symbolic functions)
- `ahs_combined`: computed from merged symbolic + neuronal results
- `ahs_neuronal`: computed from neuronal results only (neuronal-only mode)

### Verdict Thresholds

Calibrated from spike empirical results (5 ground-truth projects):

| AHS | Verdict | Spike validation |
|-----|---------|-----------------|
| >= 0.80 | pass | correct-reference: 0.85 → pass ✓ |
| 0.65 – 0.79 | warning | variant-d-subtle: 0.66 → warning ✓ |
| 0.50 – 0.64 | soft-block | variant-b-pattern: 0.58, variant-a: 0.54 → soft-block ✓ |
| < 0.50 | hard-block | variant-c-everything: 0.33 → hard-block ✓ |

Additionally, any `critical`-severity violation immediately triggers `hard-block` regardless of AHS.

---

## 6. Validation Set (Fixture) Design

**Source**: All 5 fixtures are taken directly from the DaedalusArch research spike (`graph-build-experiment/spike-3-ground-truth/`), which empirically validated 100% detection rate on seeded structural violations.

### Fixture Projects

| Directory | Description | Spike AHS | Expected Verdict |
|-----------|-------------|-----------|-----------------|
| `fixtures/correct-reference/` | Clean Task Management API — domain/application/infrastructure layers, full DI | 0.85 | pass |
| `fixtures/variant-a-structural/` | Layer direction violations + cyclic dependencies | 0.54 | soft-block |
| `fixtures/variant-b-pattern/` | Domain purity + dependency inversion violations | 0.58 | soft-block |
| `fixtures/variant-c-everything/` | Total entropy — all dimensions violated | 0.33 | hard-block |
| `fixtures/variant-d-subtle/` | Subtle DI and import violations | 0.66 | warning |

### Layer Architecture (3-layer clean architecture from spike)
```
domain/        → entities, value-objects, repository interfaces
application/   → use-cases, DTOs, application services
infrastructure/ → repository impls, controllers, middleware
```

### MANIFEST.md Schema (to be populated after first evaluation run)
Each fixture needs a `MANIFEST.md` with:
```markdown
# Violation Manifest

## Expected AHS
- Spike result: [0.XX]
- Expected verdict: [pass|warning|soft-block|hard-block]

## Expected Violations

| # | Type | File | FitnessFunction | Dimension | Route | Severity |
|---|------|------|-----------------|-----------|-------|----------|
| 1 | LAYER_VIOLATION | src/... | FF-S01 | structural | symbolic | critical |
```
> MANIFESTs will be generated from actual evaluation output after U5 (Router + Evaluation) is complete.
