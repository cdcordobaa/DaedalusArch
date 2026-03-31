// Pipeline orchestration — public API
export { PipelineExecutor } from './pipeline-executor.js';
export { createPipeline } from './pipeline-factory.js';
export type { PipelineBundle } from './pipeline-factory.js';

// Types
export type {
  PipelineConfig,
  LLMConfig,
  StageTimingEntry,
  StageTimings,
  OutputFormat,
  EvaluateOptions,
  BatchOptions,
  DriftOptions,
  BatchRow,
  BatchResult,
} from './types.js';

// Commands (for testing / advanced composition)
export {
  ParallelCommand,
  ExtractCommand,
  ParseCommand,
  IngestCommand,
  CompileCommand,
  RouteEvaluateCommand,
  SymbolicEvaluateCommand,
  NeuronalEvaluateCommand,
  ScoreCommand,
  SnapshotSaveCommand,
  SnapshotLoadCommand,
  DriftDetectCommand,
} from './commands/index.js';

export type { IngestCommandConfig } from './commands/index.js';
export type { ScoreCommandConfig } from './commands/index.js';
export type { SharedSnapshotState } from './commands/index.js';
