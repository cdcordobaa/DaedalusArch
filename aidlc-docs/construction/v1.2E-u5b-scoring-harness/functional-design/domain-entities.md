# Domain Entities — v1.2E U5b Scoring and harness

> **Unit**: U5b · **Date**: 2026-10-08 · **Base**: `v1.2e` @ `8c3d6df`
> **Scope**: the shapes U5b owns (all under `scripts/`, outside `src/`) and the fields it reads from C10 and from the U3/U4/U5a contracts. TypeScript is used as notation; Code Generation may split files but not change field names or meanings. Rules are cited as `BR-U5b-nn` (`business-rules.md`). Amendments to `v1.2E-component-methods.md` (CM:1626-1838) are marked **(amends CM)** and listed in Section 12 for the clarifications file.
> **Revision (2026-10-08, verification repair)**: §1 field names aligned with U3 domain-entities §3.2, §4.5, §4.6, §7 and U5a §2.1, §5; §4 `RescoreResult` per AHS field; §6 `GenerationCell` under U5a field names, `ExperimentPlan.fixAttempts`; §3 `FunctionSensitivityResult`; §8 `PreparedBase` adopted from U5a; §10 `denominators.csv`, `ahs_by_project.csv`, `so5_grid.csv`, rescore files and the new `function_sensitivity.csv`; §11 `tsconfig.scripts.json` extended, not owned.

---

## 1. Consumed contracts (read only)

| Source | Fields U5b reads | Used by |
|---|---|---|
| C10 `Violation` | `functionId`, `filePath`, `target?`, `discriminator?`, `line?`, `lines?`, `evidence?`, `tag`, `unitId?` | key (BR-U5b-02), line confirmation, metric crossing, neural matching |
| C10 `EvaluationReport` (frozen by U3, U3 domain-entities §7) | `runId`, `evaluationMode`; `functionExecution {declared, adrDerived, compiled, disabled, dropped[], skippedByMode, executed (a count), failed[]}` (U3 §3.2, identities I1, I2); `disabledFunctions`; `functionResults[] {functionId, dimension, route, tag?, passed, violationCount, truncated}` (one row per executed function, U3 §3.4) and the persisted neural `unitResults` / `selection` (`BaselineSelection`); `droppedDimensions`; `perDimensionScores[] {avr, effectiveWeight, violatedWeight, functionCount}`; `scoring {weights, fullModeWeights?, thresholds, confidenceThresholds, verdictSource}` (U3 §4.5); `ahsDeterministic?`, `ahsCombined?`, `ahsNeuronal?` (U3 §4.6; no `ahs` field); `verdict`; `warnings[]`; `graphStats.edgeCountByType`; `importResolution` (six fields); `parseCoverage`; `judge {provider, model, resolvedModel}` | acceptance, scoring, re-scoring, CSVs |
| U5b `RunRecord` (§6), not the report | `specSha`, `cliCommit` (U3 Q10 A: `cliCommit` is recorded by U5b) | provenance comparison (BR-U5b-25), re-parse fallback (BR-U5b-57) |
| U3 C6 | `formatEvidence`, `parseEvidence`; codes `EVAL_001`, `EVAL_002`, `EVAL_003`, `METRIC_001`, `METRIC_002`; SCC key (`["scc"]`, `cycle=<JSON>` evidence) | BR-U5b-15, 18, 45 |
| U1 exports | `MAX_CYCLE_LENGTH`, `CYCLE_ROW_CAP`, `getTemplateTag`, `listTemplatesByTag`, `isTemplateApplicable`, `PATTERN_GRAMMAR` | frozen instrument export (BR-U5b-52) |
| U4 C7 | `CassetteLLMProvider` (canonical-request key, `repetition`, `runIndex`), pinned Gemini id, `assembleUnitSource`, `JudgeProvenance`, `unitResults`, `addedByVariant` / `removedByVariant`, selection coverage | labeller, judge probes, reliability |
| U5a manifest (frozen schema) | `rows[]` (`seedId`, `projectId`, `operatorId`, `split`, `baseKind`, `baseCommit` / `baseGenerationTreeSha`, `baseTreeSha`, `specPath`, `specSha256`, `site`, `editedFiles`, `createdFiles`, `lineShifts`, `expected {functionIds, disabledFunctionIds, absentTemplates, keys[], location rules with line rule, collateral[] (operator and site, with keys), coverage, judgeProbe?, expectedEdges?, dimension, negative?, twinOf?}`), `rejections[]` | scorer |
| U5a `GenerationOutcome` (U5a domain-entities §5, BR-U5a-48) | `status ∈ {ok, failed-typecheck, failed-agent}`, `failureReason? ∈ {typecheck, agent-error, model-mismatch, skeleton-tampered, infrastructure, envelope-unreadable, timeout}`, `requestedModelId`, `resolvedModelId?`, `adapterId`, `promptTemplateId`, `taskId`, `specLevel`, `runIndex`, `fileCount`, `fileCountInRange`, `permissionDenials` | `not-run` rows, `GEN-*` codes, flag columns (BR-U5b-64) |
| U5a `PreparedBase` (U5a domain-entities §2.1) | the whole type, imported (§8) | corpus preparation output (BR-U5b-76) |
| U4 `BaselineSelection` (U4 domain-entities §2.4, persisted by U3) | `candidateUnitIds`, `selectedUnitIds`, `treeSha?` | `PreparedBase.capped`, `judgeSelection` (BR-U5b-76); judge probes conditional on selection (BR-U5b-23) |

## 2. Matching rule (`scripts/score-golden.ts`) **(amends CM)**

```typescript
export type RuleStep = 'rejection' | 'not-applicable' | 'site-invalid' | 'metric-crossing' | 'twin' | 'detection';

export interface MatchingRule {
  readonly version: string;                         // equals the registered version (BR-U5b-01)
  readonly lineTolerance: 0;
  readonly multiDetection: 'count-once';
  readonly collateralSource: 'manifest';
  readonly fpModes: readonly ['strict', 'labelled'];
  readonly ruleOrder: readonly RuleStep[];          // fixed order of BR-U5b-12
  readonly metricKeyExclusions: readonly string[];  // FF-C06, FF-P02, FF-C01 unless U3 readiness flags are set (BR-U5b-16)
  readonly metricThresholdCrossing: true;
  readonly sccOverlap: true;                         // BR-U5b-18
}

export type MatchKey = string;                       // JSON.stringify([functionId, filePath, target ?? "", [...discriminator]])
```

## 3. Golden score **(amends CM)**

```typescript
export type InstanceStatus = 'matched' | 'missed' | 'not-applicable' | 'site-invalid' | 'twin-clean' | 'twin-fired';
export type Split = 'dev' | 'held-out' | 'probe';
export type BaseKind = 'fixture' | 'corpus' | 'generated';
export type Coverage = 'in' | 'outside';
export type FnCauseSource = 'mechanical' | 'labeller' | 'audit';

export interface Confusion { readonly tp: number; readonly fp: number; readonly fn: number }
export interface Prf extends Confusion {
  readonly precision: number | null;   // null on zero denominator (BR-U5b-11)
  readonly recall: number | null;
  readonly f1: number | null;
}
export interface PrfModes {
  readonly strict: Prf;                 // FP-strict
  readonly labelled: Prf | null;        // FP-labelled; null until labels exist (BR-U5b-10)
  readonly inclTwins: Prf | null;       // twin FPs added (BR-U5b-17)
  readonly fpUncertain: number;
}

export interface InstanceResult {
  readonly seedId: string;
  readonly projectId: string;
  readonly operatorId: string;
  readonly split: Split;
  readonly baseKind: BaseKind;
  readonly coverage: Coverage;
  readonly dimension: Dimension;
  readonly tags: readonly TemplateTag[];
  readonly status: InstanceStatus;
  readonly detectedBy: readonly string[];          // sorted function ids
  readonly lineConfirmed: boolean | null;
  readonly collateral: readonly MatchKey[];        // declared and observed
  readonly undeclaredNew: readonly MatchKey[];     // FP-strict keys of this copy
  readonly fnRootCause?: { readonly code: RootCauseCode; readonly source: FnCauseSource };
}

export interface StratumKey { readonly split: Exclude<Split, 'probe'>;   // probes never form a P/R stratum (BR-U5b-20, 78)
  readonly baseKind: BaseKind | 'all'; readonly coverage: Coverage | 'all' }

export interface GoldenScore {
  readonly ruleVersion: string;
  readonly perInstance: readonly InstanceResult[];
  readonly perFunction: ReadonlyMap<string, ReadonlyMap<string, PrfModes>>;    // stratum JSON → function id → PRF
  readonly perDimension: ReadonlyMap<string, ReadonlyMap<Dimension, PrfModes>>;
  readonly perTag: ReadonlyMap<string, ReadonlyMap<string, PrfModes>>;         // tag or 'structural/data-flow' sub-row
  readonly overall: ReadonlyMap<string, PrfModes>;
  readonly executedFunctions: number;
  readonly preExistingIgnored: number;
  readonly collateralByFunction: ReadonlyMap<string, number>;
  readonly notApplicable: ReadonlyMap<string, number>;          // per function
  readonly siteInvalid: number;
  readonly metricCrossings: number;                              // expected 0 once U3 filters land
  readonly metricKeyExclusions: ReadonlyMap<string, number>;
  readonly sccOverlapMatches: number;
  readonly judgeCollateral: number;
  readonly twinSpecificity: { readonly clean: number; readonly scored: number };
  readonly edgeEvidence: readonly EdgeEvidence[];
  readonly judgeProbe: readonly JudgeProbeResult[];
}

export interface EdgeEvidence {
  readonly seedId: string; readonly negative: boolean; readonly edgeType: 'FLOWS_TO';
  readonly baseline: number; readonly seeded: number; readonly delta: number; readonly declared: number; readonly pass: boolean;
}
export interface JudgeProbeResult {
  readonly seedId: string; readonly probe: 'semantic' | 'integrity'; readonly negative: boolean; readonly runIndex: number;
  readonly detected: boolean; readonly inSelection: boolean; readonly coverageShare: number;
}
export interface FunctionSensitivityResult {        // BR-U5b-78; split 'probe' only, never in a GoldenScore stratum
  readonly probeId: string;                         // 'SP-<functionId>' or 'SP-DF01-ci'
  readonly functionId: string;
  readonly pass: boolean | null;                    // null = run rejected (reason in runs.csv)
  readonly lineConfirmed: boolean | null;
  readonly excludedAfterFail: boolean;
  readonly fixAttemptRef?: string;                  // commit SHA or tests/golden/CHANGES.md line, from ExperimentPlan.fixAttempts
}
```

**Canonical serialisation** (`scripts/lib/canonical-json.ts`, BR-U5b-26): `canonicalize(value)` sorts object keys; a `Map` becomes an array of `[key, value]` pairs sorted by key (string comparison of the JSON-encoded key); numbers that are stored ratios are written as `toFixed(6)` strings inside a tagged wrapper resolved at write time so integers stay integers; `undefined` fields are omitted; output is UTF-8 without trailing whitespace and ends with `\n`.

## 4. Re-scorer (`scripts/rescore.ts`)

```typescript
export interface RescoreScenario {
  readonly id: string;
  readonly weights: ScoringWeights;
  readonly thresholds: VerdictThresholds;
  readonly dropDimension?: Dimension;                               // leave-one-dimension-out
  readonly neuralAggregation?: 'majority' | 'any-fail' | 'share';   // sensitivity only (BR-U5b-60)
  readonly purpose: 'reproduction' | 'ablation' | 'sensitivity-only';
}
export interface RescoreResult {
  readonly scenarioId: string;
  readonly purpose: RescoreScenario['purpose'];
  readonly inputSource: 'report' | 'spec-reparse';                   // BR-U5b-57
  readonly evaluationMode: EvaluationMode;
  readonly verdictSource: 'ahsDeterministic' | 'ahsCombined' | 'ahsNeuronal';   // from scoring.verdictSource
  readonly avr: ReadonlyMap<Dimension, number>;
  readonly effectiveWeights: ReadonlyMap<Dimension, number>;
  readonly ahs: {                                                    // one value per AHS field present in the report (U3 §4.6)
    readonly ahsDeterministic?: number; readonly ahsCombined?: number; readonly ahsNeuronal?: number;
  };
  readonly verdict: OverallVerdict;                                  // from the field named by verdictSource
  readonly droppedDimensions: readonly DroppedDimension[];          // as in the report (U3 reasons)
  readonly ablated?: Dimension;
  readonly reproducesStored?: boolean;                               // reproduction scenarios only
}
```

## 5. Labeller (`scripts/llm-label.ts`) **(amends CM)**

```typescript
export type RootCauseCode =
  | 'RC-LAYER-MAP' | 'RC-EXTRACT-ALIAS' | 'RC-EXTRACT-BARREL' | 'RC-DYNAMIC-IMPORT' | 'RC-TYPE-ONLY'
  | 'RC-TEMPLATE-OVERAPPROX' | 'RC-STYLE-INAPPLICABLE' | 'RC-SPEC-PARAM' | 'RC-GENERATED-CODE'
  | 'RC-TEST-CODE' | 'RC-GENUINE-UNSEEDED' | 'RC-OTHER';
export type ViolationLabel = 'TP' | 'FP' | 'unseeded-TP';
export type UnitLabel = 'pass' | 'fail';
export type ItemKind = 'violation' | 'judge-unit' | 'missed-seed';
export type Population = 'P1' | 'P2' | 'P3' | 'P4' | 'MS';

export interface LabelItem<K extends ItemKind = ItemKind> {
  readonly itemId: string;               // sha256 over stable content (BR-U5b-36)
  readonly kind: K;
  readonly population: Population;
  readonly projectId: string;
  readonly stratum: string;              // '(project|cell), (function|dimension)'
  readonly inclusionProbability: number; // 1 for exhaustive populations
  readonly key?: MatchKey;               // violation and missed-seed items
  readonly unitId?: string;              // judge-unit items
  readonly context: string;              // built by label-context.ts; never judge output (BR-U5b-35)
}

export interface LabelRun<L> {
  readonly runIndex: 0 | 1;
  readonly label: L | null;              // null = invalid outcome
  readonly rootCause?: RootCauseCode;
  readonly note?: string;                // required with RC-OTHER
  readonly rationale: string;
  readonly permutationSeed?: number;     // run 1
  readonly cassetteKey: string;          // U4 canonical-request key
}
export interface ReconciledLabel<L> {
  readonly itemId: string; readonly projectId: string; readonly kind: ItemKind; readonly population: Population;
  readonly label: L | 'uncertain';
  readonly uncertainReason?: 'disagree' | 'invalid-run';
  readonly rootCause?: RootCauseCode;
  readonly runs: readonly [LabelRun<L>, LabelRun<L>];
}

export interface LabellerConfig {
  readonly provider: LLMProvider;        // GeminiProvider wrapped in U4 CassetteLLMProvider
  readonly model: string;                // pinned id shared with U4
  readonly runs: 2;
  readonly mode: 'record' | 'replay';
  readonly permutationSeed: number;
  readonly budgetCalls: number;
}

export interface AuditAllocation {
  readonly seed: number;
  readonly total: 30;
  readonly strata: readonly { readonly kind: ItemKind; readonly label: string; readonly size: number; readonly allocated: number; readonly samplingFraction: number }[];
}
export interface AuditRecord { readonly itemId: string; readonly label: string; readonly rootCause?: RootCauseCode; readonly recordedAt: string }

export interface AgreementStats {
  readonly comparison: 'run-vs-run' | 'judge-vs-panel' | 'panel-vs-audit' | 'judge-repetition';
  readonly n: number; readonly weighted: boolean;
  readonly percentAgreement: number; readonly ci: readonly [number, number]; readonly ciMethod: string;
  readonly cohensKappa: number | null; readonly gwetAc1: number | null; readonly fleissKappa?: number | null;
  readonly uncertain: number; readonly sameFamily: boolean;
}
```

## 6. Harness (`scripts/run-experiment.ts`) **(amends CM)**

```typescript
export interface GenerationCell {                    // field names as in U5a GenerationOutcome (BR-U5a-48)
  readonly requestedModelId: string; readonly resolvedModelId?: string; readonly adapterId: string;
  readonly promptTemplateId: string; readonly style: string; readonly specLevel: 'none' | 'minimal-prose' | 'full-aac';
  readonly taskId: string; readonly runIndex: 0 | 1 | 2; readonly generationOutcomePath: string;
  readonly generationStatus: 'ok' | 'failed-typecheck' | 'failed-agent';
  readonly failureReason?: 'typecheck' | 'agent-error' | 'model-mismatch' | 'skeleton-tampered'
    | 'infrastructure' | 'envelope-unreadable' | 'timeout';
  readonly fileCount: number; readonly fileCountInRange: boolean; readonly permissionDenials: number;  // flags, not failures
}
export type GenCode =
  | 'GEN-TYPECHECK' | 'GEN-AGENT-ERROR' | 'GEN-MODEL-MISMATCH' | 'GEN-SKELETON-TAMPERED'
  | 'GEN-INFRA' | 'GEN-ENVELOPE-UNREADABLE' | 'GEN-TIMEOUT';      // one per failureReason; none for status 'ok' (BR-U5b-64)
export interface SeedRef {
  readonly seedId: string; readonly baseProjectId: string; readonly split: Split; readonly baseKind: BaseKind;
  readonly manifestPath: string; readonly baselineReportPath: string;
}
export interface ExperimentPlan {
  readonly id: string;
  readonly experiment: 'E1' | 'E7' | 'SO4' | 'latency-gate' | 'sensitivity' | 'fixtures';
  readonly mode: EvaluationMode;
  readonly judge?: { readonly provider: string; readonly model: string };
  readonly seeds: { readonly sampling: number; readonly bootstrap: number; readonly permutation: number };
  readonly cassetteDir: string;                      // experiments/<id>/cassettes
  readonly fixAttempts?: readonly { readonly functionId: string; readonly ref: string }[];   // sensitivity plans only (BR-U5b-78)
  readonly outDir: string;                           // results/<id>/
  readonly projects: readonly {
    readonly projectId: string; readonly path: string; readonly specPath: string;
    readonly cell?: GenerationCell; readonly seed?: SeedRef;
  }[];
}

export type RunStatus = 'accepted' | 'rejected' | 'not-run' | 'incomplete';
export type ReasonCode =
  | 'schema-invalid' | 'function-failed' | 'function-timeout' | 'function-truncated' | 'metric-failed'
  | 'judge-model-mismatch' | 'transport-error' | 'generation-failed' | 'usage-limit' | 'prereg-refused';

export interface RunRecord {
  readonly runId: string; readonly planId: string; readonly projectId: string;
  readonly status: RunStatus; readonly reasonCode?: ReasonCode; readonly reasonDetail?: string;  // scrubbed
  readonly attempt: 1 | 2;
  readonly reportPath?: string;
  readonly specSha: string; readonly cliCommit: string;
  readonly preregVersion: number; readonly frozenHashes: Readonly<Record<string, string>>;
  readonly envRecordId: string;
  readonly startedAt: string; readonly wallMs: number;
  readonly cell?: GenerationCell; readonly seed?: SeedRef;
}
```

## 7. Pre-registration (`corpus/prereg.json`, `scripts/lib/prereg.ts`) **(new)**

```typescript
export interface PreRegistration {
  readonly version: number;                          // 1, then bumps with reason
  readonly registeredAt: string;
  readonly reason?: string;                          // required for version > 1
  readonly matchingRuleVersion: string;
  readonly artefacts: readonly { readonly path: string; readonly sha256: string }[];   // BR-U5b-51
  readonly labellingBudgetCalls: number;
  readonly e1Grid: { readonly models: 3; readonly specLevels: 3; readonly tasks: 2; readonly runs: 3 };
  readonly previous?: readonly { readonly version: number; readonly commit: string }[];
}
export interface FrozenInstrument {                  // corpus/frozen-instrument.json, exported from code (BR-U5b-52)
  readonly patternGrammar: string; readonly maxCycleLength: number; readonly cycleRowCap: number;
  readonly applicability: readonly { readonly template: string; readonly style: string; readonly applicable: boolean; readonly reason?: string }[];
  readonly tags: Readonly<Record<string, TemplateTag>>;
  readonly selfSpecDeviations: readonly string[];
  readonly scoringFreeze: unknown;                   // U3 BR-U3-FRZ values, verbatim
  readonly judgeFreeze: unknown;                     // U4 Section 5.2 values, verbatim
  readonly metricKeyReadiness: { readonly projectLevelKeys: boolean; readonly rowFilters: boolean };
}
```

## 8. Corpus (`corpus/corpus.json`, `scripts/select-corpus.ts`, `scripts/fetch-corpus.ts`) **(amends CM)**

```typescript
export interface CorpusEntry extends CorpusCandidate {
  readonly commitSha: string;
  readonly core: boolean;                            // the five of Docs/corpus.md (ADR-015 item 3)
  readonly licenceNote?: string;
  readonly specPath: string;                         // corpus/specs/<project>.yaml
  readonly overlays: readonly { readonly path: string; readonly patchFile: string; readonly sha256: string }[];
  readonly install: { readonly policy: 'none' } | { readonly policy: 'npm-ci-ignore-scripts'; readonly lockSha256: string };
  readonly tsc: { readonly kind: 'project' | 'repo-pinned'; readonly tscPath: string; readonly tscVersion: string };
  readonly subPath?: string;                         // e.g. ghostfolio apps/api
}
export interface CorpusCriteria {
  readonly licences: readonly string[]; readonly minFiles: 20; readonly maxFiles: 300;
  readonly styles: readonly string[]; readonly preferLayered: boolean; readonly addMin: 3; readonly addMax: 5; readonly seed: number;
}
// PreparedBase is U5a's type (U5a domain-entities §2.1), imported, never restated with other names (BR-U5b-76).
// Fields U5b fills for a corpus base:
//   projectId; baseKind = 'corpus'; dir; baseCommit (= CorpusEntry.commitSha); tsconfigPath (relative to dir);
//   tscPath, tscVersion (measured); installLockSha256?; overlays: {path, sha256}[]; specPath (post-remap corpus spec);
//   capped (= selectedUnitIds.length < candidateUnitIds.length of U4's BaselineSelection for the base);
//   judgeSelection (file paths of the selected units, as U4 publishes them). baseGenerationTreeSha is U5a's (generated bases).
import type { PreparedBase } from '<U5a module exporting PreparedBase>';   // module path fixed by U5a Code Generation
export interface FetchRecord { readonly projectId: string; readonly commitSha: string; readonly treeHash: string; // base tree hash lives here, not in PreparedBase
   readonly overlaysApplied: number; readonly installPolicy: string; readonly fetchedAt: string }
```

## 9. Environment (`scripts/record-env.ts`) **(amends CM)**

```typescript
export interface EnvironmentRecord {
  readonly id: string; readonly recordedAt: string; readonly gitCommit: string;
  readonly node: string; readonly typescript: string; readonly tsMorph: string; readonly neo4jDriver: string; readonly jest: string;
  readonly neo4jImage: { readonly tag: string; readonly id: string; readonly repoDigests: readonly string[] };
  readonly neo4jServer: string; readonly apoc: string;                  // read by subprocess, scrubbed
  readonly geminiSdk: string; readonly claudeCli?: string;
  readonly labellerModelId?: string; readonly judgeModelIds: readonly string[]; readonly generatorModelIds: readonly string[];
  readonly environmentDocSha256: string;
  readonly hardware: { readonly cpu: string; readonly cores: number; readonly memGb: number; readonly os: string };
}
```
No field holds an environment variable (BR-U5b-69).

## 10. CSV column dictionaries (`aggregate.ts`)

Common columns on every P/R/F1 file: `planId, split, baseKind, coverage, tp, fp_strict, fp_labelled, fp_uncertain, fn, precision_strict, precision_labelled, precision_incl_twins, recall, f1_labelled, ci_low, ci_high, ci_method, n_clusters`. Empty cell = `null`.

| File | Grain | Additional columns |
|---|---|---|
| `prf_by_function.csv` | stratum × function | `function_id, dimension, tag, not_applicable, collateral, metric_key_excluded` |
| `prf_by_dimension.csv` | stratum × dimension | `dimension` |
| `prf_by_tag.csv` | stratum × tag (+ `structural/data-flow` sub-row) | `tag, sub_row` |
| `prf_overall.csv` | stratum | `recall_in_coverage, recall_overall` |
| `prf_by_project.csv` | stratum × project | `project_id` |
| `instances.csv` | seed | `seed_id, project_id, operator_id, status, detected_by, line_confirmed, collateral_keys, undeclared_new, fn_root_cause, fn_cause_source` |
| `twins.csv` | twin | `seed_id, twin_of, status, undeclared_new`; footer row: specificity |
| `edge_evidence.csv` | seed or twin | `seed_id, negative, edge_type, baseline, seeded, delta, declared, pass` |
| `judge_probe.csv` | probe × run | `seed_id, probe, negative, run_index, detected, in_selection, coverage_share` |
| `fp_fn_taxonomy.csv` | population × root cause | `population, root_cause, count, weighted_count, source` |
| `denominators.csv` | run | `run_id, declared, adr_derived, compiled, disabled, dropped, dropped_ids, skipped_by_mode, executed, failed, not_applicable, metric_key_excluded, identity_ok` (I1, I2; BR-U5b-24) |
| `latency.csv` | run | `project_id, file_count, total_ms, stage, stage_ms, cycle_query_ms, gate_result` |
| `coverage.csv` | run | `parse_coverage, resolved_internal, external, external_out_of_root_alias, unresolved, dropped_no_file_node, unsupported_dynamic` |
| `ahs_by_project.csv` | run | `project_id, evaluation_mode, ahs_deterministic, ahs_combined, ahs_neuronal, verdict_source, verdict, avr_<dimension>…, dropped_dimensions` (empty cell = field absent for the mode) |
| `rescore_ablation.csv` | run × dropped dimension × AHS field | `ablated, ahs_source, ahs, verdict, delta_ahs` |
| `rescore_sensitivity.csv` | run × scenario | `scenario_id, purpose (= sensitivity-only), thresholds, neural_aggregation, ahs_source, ahs, verdict` |
| `function_sensitivity.csv` | SP probe | `plan_id, probe_id, function_id, pass, line_confirmed, excluded_after_fail, fix_attempt_ref` (BR-U5b-78; ADR-016 b exclusion evidence) |
| `so5_grid.csv` | E1 cell | the `GenerationCell` fields (incl. `requested_model_id`, `file_count`, `file_count_in_range`, `permission_denials`), `status, verdict_source, ahs_deterministic, ahs_combined, ahs_neuronal, avr_<dimension>…, fpat_<family>…, gen_code` (`gen_code` empty for `ok`) |
| `so5_patterns.csv` | cell × code | `code, count, weighted_count` |
| `so5_tests.csv` | test | `effect, statistic, p_raw, p_holm, family, effect_size, ci_low, ci_high, cliffs_delta, exploratory` |
| `agreement.csv` | comparison | the `AgreementStats` fields |
| `audit_allocation.csv` | stratum | the `AuditAllocation.strata` fields |
| `label_budget.csv` | population × stratum | `population, stratum, size, cap, sampled, inclusion_probability, uncertain, calls` |
| `runs.csv` | run | every `RunRecord` field (hashes as one JSON column) |

## 11. Files and fixtures owned

`scripts/{score-golden,rescore,llm-label,run-experiment,aggregate,select-corpus,fetch-corpus,record-env}.ts` plus their `-cli.ts` entries (BR-U5b-73); `scripts/lib/{report-io,stats,label-context,prereg,canonical-json}.ts`; `scripts/lib/figures/*.vl.json`; `Docs/{matching-rule,analysis-plan,corpus-criteria}.md`, `Docs/labeller-prompts/*.md`; `corpus/{corpus.json,prereg.json,frozen-instrument.json}`, `corpus/overlays/**`; `tests/unit/scripts/**`; `tests/fixtures/u5b/**` (hand-computed case, injected-failure reports, Mock cassettes, stored baseline-selection fixture).

**Extended, not owned**: `tsconfig.scripts.json` and the scripts jest project (created by U5a, BR-U5a-40 / U5a-M2; U5b adds its files, BR-U5b-73); `package.json` scripts and devDependencies (`vega`, `vega-lite`); `package-lock.json`; `corpus/specs/*.yaml` commits (content U1-scripted except the U5b remap, BR-U5b-77); `Docs/corpus.md` (edited-key record).

## 12. Amendments to record in the U5b clarifications file

| Amendment | Where |
|---|---|
| `MatchingRule` fields; `GoldenScore` strata, modes, evidence, probes; canonical serialisation | §2, §3 (CM:1634-1650) |
| `RescoreScenario.neuralAggregation`, `purpose`; `RescoreResult.inputSource`, `ablated` | §4 (CM:1667-1683) |
| `LabelItem.kind` gains `missed-seed`; `population`, `inclusionProbability`; `RootCauseCode` closed union; `AgreementStats` comparison and AC1 / Fleiss fields; cassette key per U4 (R-1) | §5 (CM:1740-1780) |
| `ExperimentPlan` cell / seed refs; `RunRecord` statuses `not-run`, `incomplete` and provenance | §6 (CM:1785-1801) |
| `PreRegistration`, `FrozenInstrument` entities | §7 (new) |
| `CorpusEntry` core flag, overlays, install, tsc, spec path; `PreparedBase` adopted from U5a §2.1 (R-14) | §8 (CM:1812) |
| `FunctionSensitivityResult`, `ExperimentPlan.fixAttempts`, `function_sensitivity.csv` (R-16) | §3, §6, §10 |
| `GenerationCell` under U5a names; `GenCode` one per `failureReason` (R-13) | §6 |
| `RescoreResult` per AHS field and `verdictSource` | §4 |
| `EnvironmentRecord` fields | §9 (CM:1823-1837) |
