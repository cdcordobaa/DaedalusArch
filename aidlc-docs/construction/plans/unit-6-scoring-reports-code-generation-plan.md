# Unit 6 — Scoring Engine + Reports: Code Generation Plan

## Steps

### Step 1: Create scoring-engine types (`src/scoring-engine/types.ts`)
- [x] `ScoringInput`, `ScoringErrorCode`, `ScoringError`

### Step 2: Create AVR/AHS computation (`src/scoring-engine/score-computer.ts`)
- [x] `computeAVR(results, dimension)` → AVRScore
- [x] `computeAHS(avrs, weights)` → AHSScore
- [x] `computePerDimensionScores(results, weights)` → PerDimensionScore[]
- [x] Confidence calibration for neuronal results

### Step 3: Create verdict determiner (`src/scoring-engine/verdict.ts`)
- [x] `determineVerdict(ahs, thresholds)` → OverallVerdict
- [x] Dual scoring (deterministic, combined, neuronal)

### Step 4: Create universal metrics (`src/scoring-engine/universal-metrics.ts`)
- [x] `computeUniversalMetrics(graphRepository)` → UniversalHealthMetrics
- [x] Cypher queries for cycles, fan-out, fan-in, abstraction, instability, orphans

### Step 5: Create report formatter (`src/scoring-engine/report-formatter.ts`)
- [x] `formatJSON(report)` → string
- [x] `formatHuman(report)` → string
- [x] `formatCSV(report)` → string

### Step 6: Create main scoring engine (`src/scoring-engine/scoring-engine.ts`)
- [x] `computeScores(input)` → DomainResult<EvaluationReport>
- [x] `ScoringStage` implementing PipelineStage
- [x] Full pipeline: AVR → AHS → verdict → universal metrics → report

### Step 7: Update index (`src/scoring-engine/index.ts`)
- [x] Public exports

### Step 8: Unit tests
- [x] AVR computation (0 violations, partial, all violated, empty dimension)
- [x] AHS computation (weighted complement, different weight configs)
- [x] Verdict determination (pass/warning/soft-block/hard-block)
- [x] Report formatting (JSON, human, CSV)
- [x] Confidence calibration

### Step 9: TypeCheck + full test run
- [x] 0 errors, all passing

## Story Traceability
| Story | Coverage |
|-------|----------|
| US-12.1 | Step 2 (AVR per dimension) |
| US-12.2 | Step 2 (AHS weighted complement) |
| US-12.3 | Step 4 (universal health metrics) |
| US-12.4 | Step 3 (dual scoring) |
| US-12.5 | Step 3 (symbolic-only mode) |
| US-13.1 | Step 5 (JSON report) |
| US-13.2 | Step 5 (human-readable) |
| US-13.3 | Step 5 (CSV row) |
| US-NFR-1 | Steps 2-3 (deterministic scoring) |
| US-NFR-3 | Step 8 (accuracy tests) |
