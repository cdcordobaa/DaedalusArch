import type { EvaluationMode, PipelineMode, OverallVerdict } from '../shared/types/enums.js';
import type { CommitSha } from '../shared/types/value-objects.js';

export interface LLMConfig {
  readonly provider: 'claude' | 'openai';
  readonly apiKey: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly seed?: number;
  readonly maxConcurrency?: number;
}

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
  readonly llmConfig?: LLMConfig | undefined;
  readonly verbose: boolean;
  readonly apgStorePath: string;
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

export interface StageTimingEntry {
  readonly name: string;
  readonly durationMs: number;
  readonly status: 'success' | 'warning' | 'error' | 'skipped';
}

export interface StageTimings {
  readonly stages: readonly StageTimingEntry[];
  readonly totalMs: number;
}

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
