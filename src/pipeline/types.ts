import type { EvaluationMode, PipelineMode, OverallVerdict } from '../shared/types/enums.js';
import type { CommitSha } from '../shared/types/value-objects.js';
import type { LLMProviderConfig } from '../shared/types/llm-config.js';
import type { GraphMode } from '../apg-extractor/types.js';
import type { InstrumentVersion } from '../fitness-compiler/role-exemptions.js';
import type { NeuralAggregation } from '../scoring-engine/neural-aggregation.js';
import type { ScoringMode } from '../shared/types/evaluation.js';
import type { AdvisoryFilterOption } from '../advisory-filter/advisory-filter.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { GraphEngine } from '../cypher-interp/engine.js';

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
  /** ADR-032: explicit tsconfig for the extractor (E1 cells: the pinned per-run tsconfig); absent = `<project>/tsconfig.json`. */
  readonly tsconfigPath?: string | undefined;
  /** Symbolic instrument version (ADR-026): 1 = no role exemptions; default 2. */
  readonly instrumentVersion?: InstrumentVersion | undefined;
  /** Neural aggregation of the AHS fields (ADR-028): `registered` (default, primary) or `proportional`. */
  readonly neuralAggregation?: NeuralAggregation | undefined;
  /**
   * FR-V6 scoring mode: `v1.2e` (default here, the registered scoring) or `v1.3` (rule tiers). The CLI `evaluate`
   * command and the MCP `evaluate_project` tool pass `v1.3` unless told otherwise.
   */
  readonly scoringMode?: ScoringMode | undefined;
  /**
   * Advisory post-filter options (proposal, OFF by default; Docs/DiagnosticRuns/v1.3-advisory-noise-2026-10-16.md):
   * advisory rows they match move from `violations` to `advisoryFilter.suppressed`. Blocking rows never change.
   */
  readonly advisoryFilter?: readonly AdvisoryFilterOption[] | undefined;
  /**
   * Graph engine (v1.3 spike, Docs/v1.3/cypher-interpreter.md): `neo4j` (default, the reference engine) or
   * `cypher-interp` (the in-process Cypher interpreter over an in-memory graph; no server, no credentials).
   */
  readonly graphEngine?: GraphEngine | undefined;
  /** Harness injection (the parity tee): this repository is used instead of the one `graphEngine` selects. */
  readonly graphRepository?: GraphRepository | undefined;
  /** v1.3 npx mode (MCP template checks): in-memory file contents for extraction (absolute path; `null` = removed). */
  readonly sourceOverrides?: ReadonlyMap<string, string | null> | undefined;
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
  /** Graph engine of every project's pipeline; absent = `neo4j` (the CLI passes its resolved default). */
  readonly graphEngine?: GraphEngine | undefined;
}

export interface DriftOptions {
  readonly project?: string | undefined;
  readonly spec?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly format: 'json' | 'human';
  readonly neo4jUri: string;
  readonly persist: boolean;
  /** Graph engine of the fresh evaluation (latest-vs-current); absent = `neo4j`. */
  readonly graphEngine?: GraphEngine | undefined;
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
