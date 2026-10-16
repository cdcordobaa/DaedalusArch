export { ScoringStage, computeScoredReport } from './scoring-engine.js';
export { REPORT_SCHEMA, REPORT_SCHEMA_ID } from './report-schema.js';
export { validateReport, parseReport, REPORT_SCHEMA_ERROR_LIMIT } from './report-schema-validator.js';
export type { ReportSchemaError } from './report-schema-validator.js';
export {
  computeAVR, computeAHS, tallyDimensions, scoreDimensions, inModeDimensions, verdictSourceOf,
} from './score-computer.js';
export type { DimensionTally, DimensionScoring, DimensionScoringInput, VerdictSource } from './score-computer.js';
export { determineVerdict } from './verdict.js';
export {
  confidenceWeight, proportionalShare, proportionalDefinedFor, parseNeuralAggregation, NEURAL_AGGREGATIONS, DEFAULT_NEURAL_AGGREGATION,
  PROPORTIONAL_RULE_ID,
} from './neural-aggregation.js';
export type { NeuralAggregation, ProportionalShare, ProportionalStratum, ProportionalUnit } from './neural-aggregation.js';
export {
  computeUniversalMetrics, UNIVERSAL_METRIC_QUERIES, NO_CLASSES_OR_INTERFACES, NO_FILE_TO_FILE_IMPORTS, APG_MISSING,
  UNIVERSAL_CYCLE_STAGE,
} from './universal-metrics.js';
export type { UniversalMetricsOutput, UniversalMetric, CycleMetricTiming } from './universal-metrics.js';
export { formatJSON, formatHuman, formatActionableHuman, formatCSV, csvHeader } from './report-formatter.js';
export type { ScoringInput, ScoringError, ScoringErrorCode } from './types.js';
export { renormaliseWeights, dropReasonFor, ahsFromEffectiveWeights } from './renormaliser.js';
export type {
  DimensionCounts, DimensionWeights, DroppedCandidate, RenormalisedWeights, DimensionDeclaration,
} from './renormaliser.js';
export { RULE_TIERS, HEXAGONAL_RULE_TIERS, DDD_RULE_TIERS, RULE_TIERS_DOC, ruleTier } from './rule-tiers.js';
export type { RuleTier, RuleTierEntry, ResolvedTier, PartialRule, DddRuleTier } from './rule-tiers.js';
export { computeTieredScoring, countedTierOf, overallVerdictOf, relTypeOf, splitPartial, parseScoringMode, SCORING_MODES } from './tiered-scoring.js';
export type { TieredScoringInput } from './tiered-scoring.js';
