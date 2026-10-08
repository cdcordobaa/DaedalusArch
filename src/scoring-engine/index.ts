export { ScoringStage, computeScores, computeScoredReport } from './scoring-engine.js';
export {
  computeAVR, computeAHS, tallyDimensions, scoreDimensions, inModeDimensions, verdictSourceOf,
} from './score-computer.js';
export type { DimensionTally, DimensionScoring, DimensionScoringInput, VerdictSource } from './score-computer.js';
export { determineVerdict } from './verdict.js';
export { computeUniversalMetrics } from './universal-metrics.js';
export { formatJSON, formatHuman, formatActionableHuman, formatCSV, csvHeader } from './report-formatter.js';
export type { ScoringInput, ScoringError, ScoringErrorCode } from './types.js';
export { renormaliseWeights, dropReasonFor, ahsFromEffectiveWeights } from './renormaliser.js';
export type {
  DimensionCounts, DimensionWeights, DroppedCandidate, RenormalisedWeights, DimensionDeclaration,
} from './renormaliser.js';
