// Enums
export {
  NODE_TYPES, EDGE_TYPES, DIMENSIONS, SYMBOLIC_DIMENSIONS, MODEL_JUDGED_DIMENSIONS, LAYER_KINDS,
} from './types/enums.js';
export type {
  NodeType, EdgeType, Dimension, Severity, Route,
  EvaluationMode, PipelineMode, OverallVerdict, ADRFormat,
  LayerKind, TemplateTag, JudgeUnitKind,
} from './types/enums.js';

// Value Objects
export type { AVRScore, AHSScore, Confidence, CommitSha, FunctionId, RunId } from './types/value-objects.js';
export { avrScore, ahsScore, confidence, commitSha, functionId, runId } from './types/value-objects.js';

// APG
export type {
  APGNode, APGEdge, APGResult, ParseCoverage, SkippedFile, ExtractorWarning,
  ImportEdgeProperties, ReExportEdgeProperties, FlowsToEdgeProperties, PackageNodeProperties,
  ImportResolutionStats, FlowsToStats,
} from './types/apg.js';

// Spec
export type {
  FitnessFunction, DisabledFunction, SemanticCriteria, EvalRubric,
  LayerModel, LayerDefinition, ScoringWeights, ConfidenceThresholds,
  VerdictThresholds, ParsedSpec, ADRRule, CypherRule,
} from './types/spec.js';

// Violation taxonomy
export { BUILT_IN_VIOLATION_TYPES } from './taxonomy/violation-types.js';
export type { BuiltInViolationType, ViolationType, Violation, ActionableViolation } from './taxonomy/violation-types.js';

// Validation
export type { ValidationErrorCode, ValidationError, ValidationWarning, ValidationSummary, ValidationReport } from './types/validation.js';

// Baseline
export type { BaselineStatus, BaselineEntry, BaselineSnapshot, BaselineResult } from './types/baseline.js';

// LLM Config
export type { GeminiConfig, LLMProviderConfig, VCRMode, ClaudeCliConfig } from './types/llm-config.js';

// DomainResult + errors
export type { DomainError, DomainWarning, PipelineError, PipelineWarning, PipelineAuditEntry } from './errors/domain-result.js';
export { DomainResult } from './errors/domain-result.js'; // exports both the type union and the helper object

// Secret scrubber (NFR-05, NFR-08; not wired in U0, D-U0-6)
export { REDACTED, scrubSecrets, scrubWarning, scrubDeep } from './errors/scrub.js';

// Evaluation contracts
export type {
  IngestionResult, GraphStats, LayerAnnotationSummary, DeltaStats,
  CompiledFunctions, CypherQuery, ContextAssemblyInstruction, NeuronalInstruction, HybridPair,
  SymbolicFunctionResult, NeuronalRun, NeuronalFunctionResult,
  EvaluationResults, PerDimensionScore, UniversalHealthMetrics, EvaluationReport,
  JudgeUnitResult, FunctionFailure, FunctionExecution, FunctionResultRow, DroppedReason, DroppedDimension,
  StageTimingEntry, StageTimings, JudgeProviderName, ProviderDescription, JudgeProvenance, ScoredReport,
  BaselineSelection, ExclusionReason, InvalidCause, NeuralUnitRow, NeuralResultRow,
} from './types/evaluation.js';

// Drift types
export type {
  DriftReport, StructuralDriftMetric, CrossLayerDep,
  CouplingDriftMetric, LayerCouplingDelta, FanOutContributor,
  ConventionDriftMetric, LayerConventionDelta,
  ViolationTrendMetric, ViolationTrendDirection,
  DriftAlert, DriftThresholds,
} from './types/drift.js';

// Interfaces
export type { GraphRepository, QueryOptions, QueryResult } from './interfaces/graph-repository.js';
export type { LLMProvider, LLMOptions, LLMResponse, LLMEffort, LLMCallContext } from './interfaces/llm-provider.js';
export type { SnapshotStore, SnapshotMetadata, Snapshot, SnapshotSummary, DeltaAPG } from './interfaces/snapshot-store.js';
export type { PipelineStage, PipelineCommand } from './interfaces/pipeline-stage.js';
export type { ProcessRunner, ProcessRunOptions, ProcessResult } from './interfaces/process-runner.js';

// Process runner (NFR-08; no caller in U0)
export { NodeProcessRunner, buildChildEnv } from './process/node-process-runner.js';

// FirewallContext (C11)
export type { FirewallContextSnapshot } from './context/firewall-context.js';
export { FirewallContext } from './context/firewall-context.js';
