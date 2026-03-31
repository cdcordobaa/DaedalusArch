# Unit 6 — Scoring Engine + Reports: Business Logic Model

## 1. Scoring Pipeline

```
EvaluationResults + ScoringWeights + ConfidenceThresholds + EvaluationMode
  │
  ├─ computeAVR() per dimension ──→ Map<Dimension, AVRScore>
  │
  ├─ computeAHS() ──→ ahsDeterministic, ahsCombined, ahsNeuronal?
  │
  ├─ determineVerdict() ──→ OverallVerdict
  │
  ├─ computeUniversalMetrics() (via Neo4j) ──→ UniversalHealthMetrics
  │
  └─ assembleReport() ──→ EvaluationReport
```

## 2. AVR Computation (US-12.1)

**AVR (Architectural Violation Ratio)** per dimension:
```
AVR_d = violated_functions_in_d / total_functions_in_d
```
- A function is "violated" if `passed === false` (symbolic) or `verdict === 'fail'` (neuronal)
- If a dimension has 0 functions → AVR = 0 (no violations possible)
- Range: [0.0, 1.0] where 0 = perfect, 1 = all failed

## 3. AHS Computation (US-12.2)

**AHS (Architectural Health Score)** = weighted complement:
```
AHS = Σ(w_d × (1 - AVR_d)) for all active dimensions d
```
- Weights from `ParsedSpec.scoringWeights` (symbolic-only) or `fullModeWeights` (full mode)
- Range: [0.0, 1.0] where 1.0 = perfect health

### Dual Scoring (US-12.4)

- **ahs_deterministic**: Only symbolic dimensions (structural, coupling, pattern, solid, convention). Uses `scoringWeights` (5 dims, sum to 1.0 with semantic+intent = 0).
- **ahs_combined**: All 7 dimensions. Uses `fullModeWeights`. Neuronal results included with confidence calibration.
- **ahs_neuronal**: Only neuronal dimensions (semantic, intent + hybrid-neuronal). Computed only in neuronal-only mode.

### Symbolic-Only Mode (US-12.5)

- Only 5 dimensions contribute. `ahs_combined` equals `ahs_deterministic`.
- `ahs_neuronal` not computed.

## 4. Confidence Calibration (US-11.2)

Before including neuronal results in combined scoring:
- **High confidence (≥ 0.85)**: full weight
- **Medium confidence (0.60–0.85)**: weight × 0.7
- **Low confidence (< 0.60)**: weight × 0.3
- **Unstable (flaggedUnstable)**: weight × 0.2 regardless of confidence

## 5. Verdict Determination (US-11.1)

Based on AHS thresholds from `ParsedSpec.verdictThresholds`:
- `ahs >= pass (0.80)` → **pass**
- `ahs >= warning (0.65)` → **warning**
- `ahs >= softBlock (0.50)` → **soft-block**
- `ahs < softBlock` → **hard-block**

Uses `ahs_combined` for full mode, `ahs_deterministic` for symbolic-only.

## 6. Universal Health Metrics (US-12.3)

Spec-independent metrics queried from Neo4j:
- `cyclicDependencyCount`: number of cyclic import chains
- `maxFanOut`: highest outgoing import count
- `maxFanIn`: highest incoming import count
- `abstractionRatio`: interfaces / (interfaces + classes)
- `averageInstability`: mean instability across all files
- `orphanFileCount`: files with no import connections

## 7. Report Formats

### JSON Report (US-13.1)
Full `EvaluationReport` serialized as JSON.

### Human-Readable Summary (US-13.2)
```
╔═══════════════════════════════════════════╗
║  Architectural Health Score: 0.85 (PASS)  ║
╚═══════════════════════════════════════════╝

  AHS (deterministic): 0.85
  AHS (combined):      0.83
  Verdict:             pass

  Per-Dimension Breakdown:
    structural  AVR: 0.00  (3 functions, 0 violations)
    coupling    AVR: 0.10  (3 functions, 1 violation)
    ...

  Top Violations:
    1. [critical] src/infra/UserCtrl.ts — imports domain entity directly
    2. [major]    src/app/OrderService.ts — fan-out 12 exceeds threshold 10
    ...

  Universal Metrics:
    Cycles: 0 | Max fan-out: 8 | Orphans: 1
```

### CSV Row (US-13.3)
`project,ahs_deterministic,ahs_combined,verdict,avr_structural,avr_coupling,...,cycles,max_fan_out,...`

## 8. PipelineStage Integration

```typescript
class ScoringStage implements PipelineStage<ScoringInput, EvaluationReport> {
  constructor(private graphRepository: GraphRepository)
  async execute(input: ScoringInput, context: FirewallContext): Promise<DomainResult<EvaluationReport>>
  // On success: context.setReport(result)
}
```
