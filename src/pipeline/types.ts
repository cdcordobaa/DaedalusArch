import type { EvaluationMode, PipelineMode, OverallVerdict } from '../shared/types/enums.js';
import type { CommitSha } from '../shared/types/value-objects.js';
import type { LLMProviderConfig } from '../shared/types/llm-config.js';
import type { GraphMode } from '../apg-extractor/types.js';

export interface PipelineConfig {
  readonly projectPath: string;
  readonly specFilePath: string;
  readonly neo4jUri: string;
  readonly neo4jUser: string;
  readonly neo4jPassword: string;
  readonly evaluationMode: EvaluationMode;
  readonly pipelineMode: PipelineMode;
  readonly persist: boolean;
  readonly diff: boolean;
  readonly commitSha?: CommitSha | undefined;
  readonly llmConfig?: LLMProviderConfig | undefined;
  readonly verbose: boolean;
  readonly apgStorePath: string;
  /** Extractor graph mode (default `full`); `ast-only` is the APG ablation arm (ADR-021 SO2). */
  readonly graphMode?: GraphMode | undefined;
}

export type OutputFormat = 'json' | 'human' | 'csv';

export interface EvaluateOptions {
  readonly project: string;
  readonly spec: string;
  readonly format: OutputFormat;
  readonly verbose: boolean;
  readonly neo4jUri: string;
  readonly symbolicOnly: boolean;
  readonly neuronalOnly: boolean;
  readonly persist: boolean;
  readonly diff: boolean;
}

export interface BatchOptions {
  readonly dir: string;
  readonly spec: string;
  readonly format: 'json' | 'csv';
  readonly verbose: boolean;
  readonly neo4jUri: string;
  readonly symbolicOnly: boolean;
  readonly neuronalOnly: boolean;
}

export interface DriftOptions {
  readonly project?: string | undefined;
  readonly spec?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly format: 'json' | 'human';
  readonly neo4jUri: string;
  readonly persist: boolean;
}

// Moved to C10 (FR-14); re-exported here for existing importers
export type { StageTimingEntry, StageTimings } from '../shared/types/evaluation.js';

export interface BatchRow {
  readonly projectPath: string;
  readonly ahsDeterministic: number;
  readonly ahsCombined: number | null;
  readonly verdict: OverallVerdict | 'ERROR';
  readonly violationCount: number;
  readonly durationMs: number;
  readonly error?: string;
}

export interface BatchResult {
  readonly rows: readonly BatchRow[];
  readonly totalProjects: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly errorCount: number;
  readonly totalDurationMs: number;
}
