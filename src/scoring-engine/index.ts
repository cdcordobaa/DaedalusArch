export { ScoringStage, computeScores, computeScoredReport } from './scoring-engine.js';
export {
  computeAVR, computeAHS, tallyDimensions, scoreDimensions, inModeDimensions, verdictSourceOf,
} from './score-computer.js';
export type { DimensionTally, DimensionScoring, DimensionScoringInput, VerdictSource } from './score-computer.js';
export { determineVerdict } from './verdict.js';
export {
  computeUniversalMetrics, UNIVERSAL_METRIC_QUERIES, NO_CLASSES_OR_INTERFACES, NO_FILE_TO_FILE_IMPORTS, APG_MISSING,
} from './universal-metrics.js';
export type { UniversalMetricsOutput, UniversalMetric } from './universal-metrics.js';
export { formatJSON, formatHuman, formatActionableHuman, formatCSV, csvHeader } from './report-formatter.js';
export type { ScoringInput, ScoringError, ScoringErrorCode } from './types.js';
export { renormaliseWeights, dropReasonFor, ahsFromEffectiveWeights } from './renormaliser.js';
export type {
  DimensionCounts, DimensionWeights, DroppedCandidate, RenormalisedWeights, DimensionDeclaration,
} from './renormaliser.js';
