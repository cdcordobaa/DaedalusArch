# U3 Evaluation, Scoring and Report — Domain Entities (v1.2E)

> **Unit**: U3 (C4 two templates, C5 symbolic routing, C6, C8, S1, C9, C13). **Date**: 2026-10-08. **Base**: `v1.2e` after U2 and U1 merge (ADR-015 item 12), with the bundled C10 patch applied.
> **Binding inputs**: U3 plan `v1.2E-u3-evaluation-scoring-report-functional-design-plan.md` (Q1–Q11 answered; E-1 resolved by ADR-017 item 5); ADR-015, ADR-016, ADR-017; requirements `v1.2-evaluation-readiness-requirements.md` (amended 2026-10-08); U1 and U2 designs and code-generation plans; lane-2 clarifications.
> **Companion files**: `business-rules.md` (rule ids `BR-U3-nn`), `business-logic-model.md` (flows, golden table, path to results).
> **Notation**: TypeScript shapes are contracts, not code. `(C10)` marks a field added by the bundled C10 patch; the complete patch list is §8 (it supersedes the plan §1.3 table, which lists only part of it). `readonly` is implied on every field.
> **Repair (2026-10-08, verification findings)**: report contract extended for U4 (`neuralResults[]`, `no-judge-units`, `FunctionExecution.noJudgeUnits`) and U5b (`disabledFunctions`, executed ids, identities); `apg` on the scoring and C6 inputs; row-weight source in full mode; complete bundled-patch list (§8). See `business-rules.md` §14.

---

## 1. Violation identity

### 1.1 `ViolationIdInput` and `computeViolationId` (NEW `src/evaluation-engine/violation-id.ts`)

```typescript
export interface ViolationIdInput {
  functionId: FunctionId;
  filePath: string;
  target?: string;
  line?: number;
  discriminator: readonly string[];   // values of ResultMapping.discriminatorColumns, in declaration order
}
export function computeViolationId(input: ViolationIdInput): string;
```

**Encoding (frozen before the first run, BR-U3-05)**:

```
id = "v-" + hex(sha256(utf8(JSON.stringify([functionId, filePath, target ?? "", line ?? "", ...discriminator])))).slice(0, 16)
```

| Element | Rule |
|---|---|
| `functionId` | the compiled function id string (`FF-S01`, `ADR-003-1`) |
| `filePath` | the mapped `filePath` value as a string. Project-level metrics use the literal `'<project>'`. Cycle rows (Cypher path) keep today's `String(cycle)` form; SCC rows use the smallest member file (BR-U3-45) |
| `target` | the mapped target string, or `""` when the mapping has no target column or the row value is null. SCC rows always use `""` |
| `line` | `Number(x)` of the line column; written into the JSON array as a number. A value that is null, missing or not finite is absent and becomes `""`. A Neo4j `Integer` is converted with `toNumber()` before the check |
| `discriminator` | each value as a string. A list value (the cycle) is `JSON.stringify(list)`. `null` becomes `""` |

`JSON.stringify` on the array is the canonical form: it fixes the separator, escapes every string and keeps numbers and strings apart (`2` is not `"2"`). The id is independent of record order because it reads only the row's own values.

**Neural ids** (U4 Q8 A): `computeViolationId({ functionId, filePath, discriminator: [unitId] })`. `computeNeuronalViolationId` (`component-methods.md` C6) is retired and is never exported.

### 1.2 Evidence grammar (`formatEvidence` / `parseEvidence`, exported from C6)

`Violation.evidence` is `readonly string[]`. For a symbolic violation it holds exactly one entry per `ResultMapping.evidenceColumns` entry, in declaration order, and nothing else. SCC violations hold the single entry `cycle=<JSON>`.

```
entry   := column "=" value
column  := the evidence column name (ASCII letters and digits)
value   := number | "null" | rawString
number  := String(Number(x))      ; ECMAScript shortest round-trip form, never rounded
```

| Row value | Written as | Parsed as |
|---|---|---|
| JS number or Neo4j `Integer`/`Float` | `String(Number(x))`, e.g. `instability=0.6666666666666666`, `fanIn=7` | `number` |
| `null` or missing column | `<column>=null` | `null` |
| string | raw, e.g. `cycle=["a.ts","b.ts"]` | `string` (the text after the first `=`) |

```typescript
export function formatEvidence(row: Readonly<Record<string, unknown>>, columns: readonly string[]): readonly string[];
export function parseEvidence(entries: readonly string[]): Readonly<Record<string, number | string | null>>;
```

`parseEvidence` splits each entry at the **first** `=`. A value that matches `^-?(\d+(\.\d+)?([eE][+-]?\d+)?|Infinity)$` and round-trips (`String(Number(v)) === v`) is a number; `null` is `null`; anything else is a string. Round-trip law (unit test): `parseEvidence(formatEvidence(row, cols))` equals `{c: normalise(row[c])}` for every `c` in `cols`.

### 1.3 `Violation` (C10 shape, no new field)

The U0 `Violation` (`src/shared/taxonomy/violation-types.ts:37-57`) already has every field U3 fills: `line`, `lines`, `target`, `isTypeOnly`, `tag`, `unitId`, `discriminator`, `evidence`. U3 fills them per BR-U3-04; nothing else changes. `type` for `domain-state-purity` is the existing `DOMAIN_STATE_PURITY_VIOLATION`. `INTENT_VIOLATION` stays in the taxonomy with U4's deprecation comment (U4 Q11 A).

---

## 2. Result mapping (C4 type `src/fitness-compiler/types.ts`)

```typescript
export interface ResultMapping {
  filePathColumn: string;
  messageTemplate: string;
  metadataColumns?: readonly string[];
  lineColumn?: string;
  linesColumn?: string;
  targetColumn?: string;
  isTypeOnlyColumn?: string;
  discriminatorColumns: readonly string[];   // required (pre-agreed U0 patch, D-U0-4); [] allowed
  evidenceColumns?: readonly string[];       // (C10) measured values; never part of the id
  cycleColumn?: string;                      // no-cyclic-deps only
}
```

The per-template values are frozen in `business-rules.md` §3 (table T-MAP). A column may appear in at most one of `discriminatorColumns` and `evidenceColumns` (static test).

---

## 3. Function execution and results

### 3.1 `FunctionFailure` (existing C10 shape) and its codes

```typescript
export interface FunctionFailure { functionId: FunctionId; name: string; code: string; message: string; }
```

| `code` | Raised by | Condition |
|---|---|---|
| `EVAL_001` | C6 | repository failure whose error code does not contain `TransactionTimedOut` |
| `EVAL_002` | C6 | repository failure whose error code contains `TransactionTimedOut` (both Neo4j 5 codes) |
| `CRITIC_*` | U4 | neural failures (U4 design) |

`message` is always scrubbed (BR-U3-58).

### 3.2 `FunctionExecution` (C10, extended)

```typescript
export interface FunctionExecution {
  declared: number;                       // (C10) spec functions in scope, enabled or not = fitnessFunctions.length
  adrDerived: number;                     // (C10) compiled functions with source 'adr'
  compiled: number;                       // = CompiledFunctions.totalCompiled, never overridden by mode
  disabled: number;                       // (C10, added by this design to the plan §1.3 table) = disabledFunctions.length;
                                          // makes identity I1 checkable from the report alone (FR-20 "disabled shown")
  dropped: readonly FunctionId[];         // (C10) declared ids that compiled to nothing, ascending id order
  skippedByMode: number;                  // (C10) compiled functions whose route the mode does not run
  noJudgeUnits: readonly FunctionId[];    // (C10) neural functions with zero selected units (U4 BR-U4-AGG-09,
                                          // JUDGE_NO_UNITS): no result, no failure; ascending id order; [] in symbolic-only
  executed: number;                       // functions with a result and no failure (a count)
  failed: readonly FunctionFailure[];     // ordered by functionId, then code
}
```

**Identities** (asserted by the builder; `REPORT_COUNTS_INCONSISTENT` on violation, BR-U3-51):
- I1 (BR-U1-19 rearranged): `declared + adrDerived = compiled + disabled + dropped.length`.
- I2 (execution): `compiled = executed + failed.length + skippedByMode + noJudgeUnits.length`.
- I3 (sets): `dropped` = declared ids − (compiled ids − ADR ids) − disabled ids, compared as sets; and the ids of `disabledFunctions` (§3.5) number exactly `disabled`.
- I4 (FR-14): Σ `perDimensionScores[*].functionCount` = `executed`.
- I5 (ids): the set of `functionResults[*].functionId` has exactly `executed` members; it is disjoint from `failed[*].functionId`, from `noJudgeUnits` and from the `disabledFunctions` ids.
- I6 (neural rows): every `neuralResults[*].functionId` (§3.6) has a `functionResults` row with route `neuronal` or `hybrid`; every `functionResults` row with route `neuronal` has exactly one `neuralResults` row; a `hybrid` row has one exactly when its neural half produced a counted result (BR-U3-53).

A function appears in at most one of executed, failed, skippedByMode, noJudgeUnits. A hybrid pair is one function (BR-U3-53). **Executed ids** are read from `functionResults[*].functionId`; `executed` stays a count, never a list (U5b BR-U5b-13).

`noJudgeUnits` is filled from the context warnings with code `JUDGE_NO_UNITS`, each of which must carry `context.functionId` (U4 hand-off, `business-rules.md` §12); a `JUDGE_NO_UNITS` warning without it fails the builder with `REPORT_COUNTS_INCONSISTENT` (identity I2 cannot be checked).

### 3.3 `SymbolicFunctionResult` (C10, extended)

```typescript
export interface SymbolicFunctionResult {
  functionId: FunctionId; dimension: Dimension; passed: boolean;
  violations: readonly Violation[]; executionTimeMs: number; deterministic: true;
  truncated?: true;                       // (C10) set only when the cycle sentinel row was present
  neuralSkipped?: 'symbolic-fail';        // (C10) full mode, hybrid pair whose symbolic half found violations
}
```

`SymbolicEvalInput` (U3-owned `src/evaluation-engine/types.ts`) gains `apg?: APGResult`. The C6 command passes `context.getApgResult()` when `CYCLE_STRATEGY === 'scc'`, so FF-S02 is answered by `scc-cycles.ts` instead of its Cypher query (BR-U3-45); with `'cypher'` the field is not read.

### 3.4 `FunctionResultRow` (report; C10 extended)

```typescript
export interface FunctionResultRow {
  functionId: FunctionId; name: string; dimension: Dimension; route: Route;
  tag?: TemplateTag;                      // required for symbolic and hybrid rows (schema if/then), absent for neural
  passed: boolean; violationCount: number; executionTimeMs: number;
  truncated: boolean;                     // (C10, required) false unless the sentinel fired
}
```

One row per executed function. Order (BR-U3-54): tag rank `structural` < `topological` < `pattern-proxy` < neural (no tag), then `functionId` ascending (string compare). The row stays narrow (`additionalProperties: false`); per-unit judge data lives in `neuralResults[]` (§3.6), keyed by `functionId`.

### 3.5 `DisabledFunctionRow` and report `disabledFunctions` (C10, NEW)

```typescript
export interface DisabledFunctionRow {
  functionId: FunctionId;
  name: string;
  reason: string;                         // CompiledFunctions.disabledFunctions[i].reason, or the frozen literal
                                          // 'disabled in spec' when the compiler gave none (enabled: false)
}
// EvaluationReport.disabledFunctions: readonly DisabledFunctionRow[]   — required, may be empty, sorted by functionId
```

Taken from `CompiledFunctions.disabledFunctions` (style-, kind-, layer-count- and spec-disabled functions; BR-U1-15/18/19). U5b's not-applicable rule (c) reads it (BR-U5b-13). Its length equals `functionExecution.disabled` (I3).

### 3.6 `NeuralResultRow` and report `neuralResults` (C10, NEW; shape owned by U4)

The shape is U4's `NeuralResultRow` (U4 OI-U4-8, U4 domain-entities §4.8), adopted verbatim; U3 freezes it in the schema and fills it with U4's exported `toNeuralResultRows`. The fields, as U4 lists them:

```typescript
export interface NeuralResultRow {
  functionId: FunctionId; dimension: Dimension;
  aggregationRule: 'majority-of-valid-units-v1';
  selection: { source: 'own' | 'baseline'; candidateUnitIds: readonly string[]; selectedUnitIds: readonly string[] };
  unitsSelected: number; unitsCapped: number;
  candidateCount: number; uncoveredFileCount: number; singleFileModules?: number;
  candidateExclusions: Readonly<Record<ExclusionReason, number>>;
  unitsInvalidByCause: Readonly<Record<InvalidCause | 'INSUFFICIENT_VALID_RUNS', number>>;
  truncatedUnits: number; excerptTruncatedUnits: number; removedByVariant: readonly string[];
  unitResults: readonly {                 // U4 `NeuralUnitRow`
    unitId: string; unitKind: JudgeUnitKind; layer: string; filePaths: readonly string[];
    status: 'valid' | 'invalid'; verdict: 'pass' | 'fail' | 'warning';
    confidence: number; confidenceStdDev: number; flaggedUnstable: boolean; validRunCount: number;
    origin?: 'addedByVariant';
  }[];                                    // sorted by unitId (U4 DE §4.4)
}
// EvaluationReport.neuralResults?: readonly NeuralResultRow[]  — required when evaluationMode ∈ {full, neuronal-only}
//                                                                 (schema if/then), absent in symbolic-only; sorted by functionId
```

Rules: one row per neural result counted in scoring (I6); a function in `noJudgeUnits` or `failed` has no row. If U4 DE §4.8 differs from the list above when U3 reaches the schema freeze (R10), U4's text wins and the schema follows it; a field U4 adds or removes is recorded in the R10 commit and in `business-rules.md` §14. The FR-33 acceptance ("a run lists one result per selected unit") is read from `neuralResults[*].unitResults` (one entry per judged unit; variant additions carry `origin: 'addedByVariant'`). U5b reads `unitResults` for the aggregation-sensitivity variants (BR-U5b-60) and for judge-probe detection (BR-U5b-23), and `selection` for AD-7 variant pairs (U4 BR-U4-SEL-07).

---

## 4. Scoring entities

### 4.1 `ScoringInput` (CHANGED `src/scoring-engine/types.ts`)

```typescript
export interface ScoringInput {
  evaluationResults: EvaluationResults;           // includes failures (C10)
  scoringWeights: ScoringWeights;
  fullModeWeights?: ScoringWeights;               // required when mode is full or neuronal-only (BR-U3-37)
  confidenceThresholds: ConfidenceThresholds;
  verdictThresholds: VerdictThresholds;
  mode: EvaluationMode;
  projectPath: string;
  specVersion: string;
  graphRepository: GraphRepository;
  fitnessFunctions: readonly FitnessFunction[];   // NEW: declared counts by dimension
  compiled: CompiledFunctions;                    // NEW: disabled counts by dimension, skippedByMode
  noJudgeUnits: readonly FunctionId[];            // NEW: for the `no-judge-units` drop reason (BR-U3-34)
  apg?: APGResult;                                // NEW: context.getApgResult(); read only when CYCLE_STRATEGY === 'scc'
}
```

`ScoringInput` is U3-owned (`src/scoring-engine/types.ts`), not part of the C10 patch. `ScoreCommand` fills `apg` from `context.getApgResult()` and passes it to `computeUniversalMetrics` (§5).

### 4.2 Dimension sets

| Constant | Members after U3 | Source |
|---|---|---|
| `DIMENSIONS` (C10) | structural, coupling, pattern, solid, convention, semantic, integrity | `intent` removed (clarifications §2.5) |
| `SYMBOLIC_DIMENSIONS` | structural, coupling, pattern, solid, convention | C10 |
| `MODEL_JUDGED_DIMENSIONS` | semantic, integrity | C10 |
| In-mode dimensions | symbolic-only: `SYMBOLIC_DIMENSIONS`; full: `DIMENSIONS`; neuronal-only: `MODEL_JUDGED_DIMENSIONS` | BR-U3-34 |

`ALL_DIMENSIONS` and `SYMBOLIC_DIMENSIONS` in `score-computer.ts:7-8` are deleted and replaced by the C10 constants.

### 4.3 `PerDimensionScore` (C10, extended)

```typescript
export interface PerDimensionScore {
  dimension: Dimension;
  avr: AVRScore;               // round3(violatedWeight / functionCount)
  violatedWeight: number;      // (C10) unrounded AVR numerator
  weight: number;              // configured weight of the verdict-source variant's weight map (see below)
  effectiveWeight: number;     // required (D-U0-2); unrounded renormalised weight of the verdict-source variant
  violationCount: number;      // number of violated functions in the dimension (existing meaning)
  functionCount: number;       // functions (not results) executed in this dimension
}
```

A row exists only for an in-mode dimension with `functionCount > 0`. In-mode dimensions with zero executed functions appear in `droppedDimensions` instead (BR-U3-39).

**Row weight source (frozen, BR-U3-70 item 9).** `weight` and `effectiveWeight` on every row are those of the variant named by `scoring.verdictSource`: `scoringWeights` renormalised over the executed symbolic dimensions in symbolic-only mode; `fullModeWeights` renormalised over every executed in-mode dimension in full mode (`ahsCombined`); `fullModeWeights` restricted to `semantic`/`integrity` in neuronal-only mode. In full mode the `ahsDeterministic` effective weights are therefore not on the rows; they are recomputed exactly from `scoring.weights` and the rows' `functionCount` with the exported `renormaliseWeights` (FR-26). Pinning test: a full-mode report where `scoringWeights` and `fullModeWeights` differ has `Σ effectiveWeight × avr` over its rows equal to `1 − ahsCombined` (before rounding), and the symbolic rows' `effectiveWeight` differ from `renormaliseWeights(scoring.weights, …)`.

### 4.4 `DroppedDimension` (C10 shape; reason member added)

```typescript
export type DroppedReason = 'none_declared' | 'disabled_by_spec' | 'no-judge-units' | 'execution_failure';  // (C10) 'no-judge-units' added
export interface DroppedDimension {
  dimension: Dimension;
  reason: DroppedReason;
  declared: number;            // spec functions in this dimension (enabled or not)
  executed: number;            // always 0 for a dropped dimension
}
```

Reason precedence (BR-U3-34): `none_declared` if `declared = 0`; else `disabled_by_spec` if every declared function is disabled; else `no-judge-units` if every declared, non-disabled function of the dimension is in `functionExecution.noJudgeUnits` (U4 OI-U4-4); else `execution_failure`. The member is spelled `no-judge-units` (hyphens) as U4 names it; the other three keep their existing underscores.

### 4.5 Report `scoring` block (C10)

```typescript
export interface ReportScoring {
  weights: ScoringWeights;                 // scoringWeights as configured (symbolic map)
  fullModeWeights?: ScoringWeights;        // present in full and neuronal-only modes
  thresholds: VerdictThresholds;           // as configured (D-9)
  confidenceThresholds: ConfidenceThresholds;
  verdictSource: 'ahsDeterministic' | 'ahsCombined' | 'ahsNeuronal';
}
```

`verdictSource` is the frozen per-mode choice (BR-U3-36). It lets U5b re-score without re-parsing the spec (FR-26).

### 4.6 AHS fields on `EvaluationReport`

| Field | Present when | Weights |
|---|---|---|
| `ahsDeterministic` | mode ≠ neuronal-only (schema `if`/`then`); optional in TS (C10) | `scoringWeights` renormalised over executed symbolic dimensions |
| `ahsCombined` | full mode | `fullModeWeights` renormalised over every executed in-mode dimension |
| `ahsNeuronal` | full and neuronal-only modes | `fullModeWeights` restricted to `semantic`, `integrity`, renormalised |

---

## 5. Universal metrics

```typescript
export interface UniversalHealthMetrics {          // (C10) every field number | null
  cyclicDependencyCount: number | null;
  maxFanOut: number | null;
  maxFanIn: number | null;
  abstractionRatio: number | null;
  averageInstability: number | null;
  orphanFileCount: number | null;
}
export interface UniversalMetricsOutput {
  metrics: UniversalHealthMetrics;
  warnings: readonly PipelineWarning[];            // METRIC_001 (failure), METRIC_002 (undefined ratio)
}
export function computeUniversalMetrics(repo: GraphRepository, strategy?: CycleStrategy, apg?: APGResult):
  Promise<DomainResult<UniversalMetricsOutput>>;
```

| Warning | Meaning | `context` | U5b treatment |
|---|---|---|---|
| `METRIC_001` | the metric's query failed (error or timeout); value `null` | `{ metric, code }` | run rejected |
| `METRIC_002` | the query succeeded, the ratio is undefined; value `null` | `{ metric, reason }`, reason `no classes or interfaces` or `no file-to-file imports` | metric reported as undefined; run kept |

`null` is never produced without one of these two warnings (BR-U3-41, 42).

`CycleStrategy = 'cypher' | 'scc'`; the constant `CYCLE_STRATEGY: CycleStrategy = 'cypher'` (BR-U3-45). `ScoreCommand` calls `computeUniversalMetrics(repo, CYCLE_STRATEGY, input.apg)`; with `'scc'` and no `apg` the cycle metric is `null` with `METRIC_001 {metric: 'cyclicDependencyCount', code: 'APG_MISSING'}`.

---

## 6. Report assembly entities

### 6.1 `RunFacts` (NEW `src/scoring-engine/report-builder.ts`)

```typescript
export interface RunFacts {
  apg: Pick<APGResult, 'parseCoverage' | 'importResolution'>;
  ingestion: IngestionResult;              // graphStats (with byType maps), layerAnnotationSummary
  compiled: CompiledFunctions;
  compileFacts: CompileFacts;              // declared, adrDerived, dropped ids (from CompileCommand)
  evaluation: EvaluationResults;           // results + failures
  timings: StageTimings;                   // executor.getTimings() at assembly time
  pipelineWarnings: readonly PipelineWarning[];  // FirewallContext.warnings
  judge: JudgeProvenance;                  // judgeProvenanceOf (U4) or the symbolic-only stub
  neuralRows?: readonly NeuralResultRow[]; // toNeuralResultRows(neuronal output) (U4); required in full / neuronal-only
  knownSecrets: readonly string[];         // BR-U3-58
  mode: EvaluationMode;
}
export interface CompileFacts { declared: number; adrDerived: number; dropped: readonly FunctionId[]; }
```

`CompileFacts` is computed in `CompileCommand` (U3 hunk after U1 merges) and stored on the context next to `CompiledFunctions`. If U1's merged `CompiledFunctions` exposes dropped ids, the builder uses them and asserts equality with the set difference (I3).

### 6.2 Warning cap entry (`REPORT_001`)

```typescript
{ stage: 'assemble-report', code: 'REPORT_001',
  message: '<code> from <stage>: showing <shown> of <total>',
  context: { stage: string, code: string, total: number, shown: 50 } }
```

One entry per capped `(stage, code)` pair, placed after the shown entries of that pair. The cap constant `WARNING_CAP_PER_CODE = 50` is frozen (BR-U3-70 item 1).

### 6.3 Error codes introduced by U3

| Code | Kind | Raised when | Effect |
|---|---|---|---|
| `REPORT_COUNTS_INCONSISTENT` | fatal | identity I1–I6 fails, or a `JUDGE_NO_UNITS` warning lacks `context.functionId` | pipeline fails; message lists the failing identity and both sides |
| `REPORT_SCHEMA_INVALID` | fatal | `validateReport` returns errors | pipeline fails; message lists the first 10 errors (`path: message`) |
| `SCORING_NO_EXECUTED_WEIGHT` | fatal | executed in-mode weight sums to 0, or nothing executed | no score produced |
| `CONFIG_MISSING_FULL_MODE_WEIGHTS` | fatal | full or neuronal-only mode without `fullModeWeights` | no score produced |
| `REPORT_NEURAL_ROWS_UNAVAILABLE` | fatal | full or neuronal-only mode and `RunFacts.neuralRows` absent (U4's `toNeuralResultRows` not wired yet) | no report; fail closed instead of writing a report U5b cannot use (BR-U3-65) |
| `CONFIG_MISSING_ENV` | fatal (CLI) | `NEO4J_PASSWORD` unset or empty | exit before any connection; message `NEO4J_PASSWORD is not set` |
| `BATCH_MODE_UNSUPPORTED` | fatal (CLI) | `batch` with full or neuronal-only mode | exit 2 before any project runs |
| `EVAL_003` | warning | cycle sentinel row present | `truncated: true` on the result |
| `METRIC_001`, `METRIC_002` | warning | §5 | §5 |
| `REPORT_001` | warning | warning cap applied | §6.2 |

---

## 7. Frozen report schema (`schemas/report.schema.json`, embedded as `REPORT_SCHEMA` in `src/scoring-engine/report-schema.ts`)

Required top-level fields and who reads them. "Req." = in the schema's `required` list (D-U0-2 makes the run-level fields required).

| Field | Req. | Content | Readers |
|---|---|---|---|
| `runId`, `projectPath`, `specVersion`, `evaluationMode`, `durationMs` | yes | as today | U5b (join), C13 |
| `ahsDeterministic` | if mode ≠ neuronal-only | §4.6 | U5b (SO3, re-score), C13, golden |
| `ahsCombined` | if mode = full | §4.6 | U5b (SO3/SO5) |
| `ahsNeuronal` | if mode ∈ {full, neuronal-only} | §4.6 | U5b (SO5) |
| `verdict` | yes | from `scoring.verdictSource` | U5b, C13, golden |
| `scoring` | yes | §4.5 | U5b re-scorer (FR-26) |
| `perDimensionScores[]` | yes | §4.3, `effectiveWeight` and `violatedWeight` required | U5b (SO3, ablation), C13 |
| `droppedDimensions[]` | yes (may be empty) | §4.4 | U5b (`denominators.csv`), C13 |
| `violations[]` | yes | `Violation` with `id`, `tag` (symbolic), `line`/`target` where mapped, `evidence` per T-MAP | U5b (P/R/F1, location rule, `prf_by_tag`), U5a (seed checks), C13 |
| `functionExecution` | yes | §3.2, incl. `noJudgeUnits` | U5b (FR-36 reject on non-empty `failed`; `denominators.csv`; I1, I2), C13 |
| `functionResults[]` | yes | §3.4 | U5b (reject on `truncated`; per-tag; executed-id membership, BR-U5b-13 d), C13 cards |
| `disabledFunctions[]` | yes (may be empty) | §3.5 | U5b (not-applicable rule c, BR-U5b-13; SO1 `denominators.csv` ids), C13 |
| `neuralResults[]` | if mode ∈ {full, neuronal-only}; absent in symbolic-only | §3.6 (U4 `NeuralResultRow`) | U5b (BR-U5b-23 judge probes, BR-U5b-60 aggregation sensitivity), U4 `--judge-baseline-report` (SEL-07), FR-33 acceptance |
| `universalMetrics` | yes | §5, `number|null` | U5b (E7), C13 |
| `graphStats` | yes | `nodeCount`, `edgeCount`, `nodeCountByType`, `edgeCountByType` (every key, zeros included, BR-U2-34) | U5b (SO2 table), U5a (`edgeCountByType.FLOWS_TO`) |
| `layerAnnotation` | yes | `mapped`, `unmapped`, `unmappedFiles` | U5b (SO2) |
| `parseCoverage` | yes | as C10 | U5b (SO2) |
| `importResolution` | yes | six fields: `resolvedInternal`, `external`, `externalOutOfRootAlias`, `unresolved`, `droppedNoFileNode`, `unsupportedDynamic` | U5b (SO2) |
| `timings` | yes | `stages[]`, `totalMs` | Build and Test latency table |
| `judge` | yes | `JudgeProvenance` (U4 DE §4.6, incl. optional `seededList`, `resolvedModel`, `repetition`, probe hashes, `provenanceMixed`); exactly `{provider: 'none', model: 'none', runsPerUnit: 0}` in symbolic-only | U5b (E1 cell join; `seeded-list-nonempty` rejection), C13 |
| `warnings[]` | yes | merged, scrubbed, sorted, capped (BR-U3-57) | U5b (reject on `METRIC_001`, `EVAL_003`), C13 |

Schema rules (BR-U3-60): `$id` = `REPORT_SCHEMA_ID`; `additionalProperties: false` at the top level and on `functionExecution`, `PerDimensionScore`, `FunctionResultRow`, `DisabledFunctionRow`, `NeuralResultRow` and its `unitResults` items and `selection`, `DroppedDimension`, `scoring`, `judge`; `if evaluationMode ∈ {full, neuronal-only} then required neuralResults`, `if evaluationMode = symbolic-only then not required neuralResults` and `neuralResults` forbidden (`"not": {"required": ["neuralResults"]}`); `DroppedReason` enum with the four members of §4.4; `Dimension` enum without `intent`; metrics `["number","null"]` (counts `["integer","null"]`); no `reportSchemaVersion` (Q10 A: `$id` + U5b's `cliCommit` identify the version).

`ScoredReport` (C10) omits every run-level field the builder adds: the existing list plus `disabledFunctions` and `neuralResults`.

---

## 8. Complete bundled C10 patch (one patch, applied once by U3-R1 or U4-K1)

This table is the full list; the plan §1.3 table is a subset of it. Split of application (U4 code plan D-U4-5): U4-K1 applies only the additive rows 1 (as optional `failures?`), 6, 13, 14 and 15; U3-R1 applies every other row and tightens row 1 to required. If U3-R1 lands first it applies all rows except 15, and U4-K1 verifies 1, 6, 13, 14 and adds 15. Either way the end state is this table. Shape owners: U3 for its rows, U4 for rows 13–15 (row 14 as U4 DE §4.8).

| # | Change | File | Owner / cause | In plan §1.3? |
|---|---|---|---|---|
| 1 | `EvaluationResults.failures: readonly FunctionFailure[]` | `evaluation.ts` | U4/U3, FR-13 | yes |
| 2 | `FunctionExecution.declared`, `.adrDerived`, `.dropped: readonly FunctionId[]`, `.skippedByMode` | `evaluation.ts` | U3 Q1 | yes |
| 3 | `FunctionExecution.disabled: number` | `evaluation.ts` | U3, FR-20 (I1 from the report alone) | **no, added** |
| 4 | `FunctionExecution.noJudgeUnits: readonly FunctionId[]` | `evaluation.ts` | U3 for U4 OI-U4-4 (I2) | **no, added** |
| 5 | `SymbolicFunctionResult.truncated?: true`; `FunctionResultRow.truncated: boolean` (**required**) | `evaluation.ts` | U3, FR-35 | yes (required-ness added) |
| 6 | `SymbolicFunctionResult.neuralSkipped?: 'symbolic-fail'` | `evaluation.ts` | U3 Q1 | yes |
| 7 | `EvaluationReport.scoring: { weights, fullModeWeights?, thresholds, confidenceThresholds, verdictSource }` | `evaluation.ts` | U3 Q3, Q10 | partly: **`fullModeWeights`, `verdictSource` added** |
| 8 | `PerDimensionScore.violatedWeight: number`; `effectiveWeight` required (pre-agreed D-U0-2) | `evaluation.ts` | U3 Q10 | yes |
| 9 | `EvaluationReport.ahsDeterministic` optional | `evaluation.ts` | U3 Q3 | yes |
| 10 | `UniversalHealthMetrics` fields `number \| null` | `evaluation.ts` | U3 Q5 | yes |
| 11 | `ResultMapping.evidenceColumns?: readonly string[]`; `discriminatorColumns` required (pre-agreed D-U0-4) | `src/fitness-compiler/types.ts` | U3 Q2 | yes |
| 12 | `DisabledFunctionRow`; `EvaluationReport.disabledFunctions: readonly DisabledFunctionRow[]` | `evaluation.ts` | U3 for U5b BR-U5b-13 | **no, added** |
| 13 | `DroppedReason` gains `'no-judge-units'` | `evaluation.ts:186` | U4 AGG-09 / OI-U4-4 | **no, added** |
| 14 | `NeuralResultRow` (U4 DE §4.8) and `EvaluationReport.neuralResults?: readonly NeuralResultRow[]` | `evaluation.ts` | U4 OI-U4-8 | **no, added** |
| 15 | U4 rows: `LLMCallContext`, `JudgeUnitResult`/`NeuronalFunctionResult` fields (U4 DE §4.3–4.4), `InvalidCause`, `ExclusionReason`, `BaselineSelection`, `JudgeProvenance` fields incl. `seededList?`, `INTENT_VIOLATION` comment | U4 files | U4-K1 | partly (U4 lists them) |
| 16 | `ScoredReport` Omit list gains `disabledFunctions`, `neuralResults` | `evaluation.ts` | U3 | **no, added** |
| 17 | Required run-level report fields (pre-agreed D-U0-2) | `evaluation.ts` | U3 | yes |

Not in the patch: `ScoringInput` (U3-owned `src/scoring-engine/types.ts`, §4.1), `SymbolicEvalInput.apg` (U3-owned `src/evaluation-engine/types.ts`, §3.3), the `intent` removal from `DIMENSIONS` (R7, with the scorer change, so R1 stays compile-clean), and the schema file (frozen at R10).
