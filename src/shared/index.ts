// Enums
export type {
  NodeType, EdgeType, Dimension, Severity, Route,
  EvaluationMode, PipelineMode, OverallVerdict, ADRFormat,
} from './types/enums.js';

// Value Objects
export type { AVRScore, AHSScore, Confidence, CommitSha, FunctionId, RunId } from './types/value-objects.js';
export { avrScore, ahsScore, confidence, commitSha, functionId, runId } from './types/value-objects.js';

// APG
export type { APGNode, APGEdge, APGResult, ParseCoverage, SkippedFile, ExtractorWarning } from './types/apg.js';

// Spec
export type {
  FitnessFunction, SemanticCriteria, EvalRubric,
  LayerModel, LayerDefinition, ScoringWeights, ConfidenceThresholds,
  VerdictThresholds, ParsedSpec, ADRRule, CypherRule,
} from './types/spec.js';

// Violation taxonomy
export { BUILT_IN_VIOLATION_TYPES } from './taxonomy/violation-types.js';
export type { BuiltInViolationType, ViolationType, Violation } from './taxonomy/violation-types.js';

// DomainResult + errors
export type { DomainError, DomainWarning, PipelineError, PipelineWarning, PipelineAuditEntry } from './errors/domain-result.js';
export { DomainResult } from './errors/domain-result.js'; // exports both the type union and the helper object

// Evaluation contracts
export type {
  IngestionResult, GraphStats, LayerAnnotationSummary, DeltaStats,
  CompiledFunctions, CypherQuery, ContextAssemblyInstruction, NeuronalInstruction, HybridPair,
  SymbolicFunctionResult, NeuronalRun, NeuronalFunctionResult,
  EvaluationResults, PerDimensionScore, UniversalHealthMetrics, EvaluationReport,
} from './types/evaluation.js';

// Interfaces
export type { GraphRepository, QueryResult } from './interfaces/graph-repository.js';
export type { LLMProvider, LLMOptions, LLMResponse } from './interfaces/llm-provider.js';
export type { SnapshotStore, SnapshotMetadata, Snapshot, SnapshotSummary } from './interfaces/snapshot-store.js';
export type { PipelineStage, PipelineCommand } from './interfaces/pipeline-stage.js';

// FirewallContext (C11)
export type { FirewallContextSnapshot } from './context/firewall-context.js';
export { FirewallContext } from './context/firewall-context.js';
