import type { BaselineSelection, InvalidCause, NeuronalInstruction } from '../shared/types/evaluation.js';
import type { LayerDefinition } from '../shared/types/spec.js';
import type { LLMEffort, LLMOptions, LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { GraphRepository } from '../shared/interfaces/graph-repository.js';
import type { PipelineError } from '../shared/errors/domain-result.js';
import type { VCRMode } from '../shared/types/llm-config.js';
import type { JudgeUnitKind } from '../shared/types/enums.js';
import type { JudgeGraphView } from './judge-graph.js';
import {
  DEFAULT_CASSETTE_DIR, EXCERPT_MAX_NODES, JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL, JUDGE_TIMEOUT_MS,
  JUDGE_TOKEN_BUDGET, MAX_CONCURRENCY, MIN_SIZE_TOKENS, RUNS_PER_EVALUATION, SELECTION_SEED, UNIT_CAP,
  UNSTABLE_THRESHOLD,
} from './frozen.js';

// C10 cassette mode re-exported (D-U0-3, U4-K2): the C7-only bypass member is gone; default 'record' (BR-U4-CAS-05)
export type { VCRMode };

/**
 * Run options of the critic (U4 DE §5.5; defaults frozen in `frozen.ts`, BR §11). The CLI fills
 * `llm`, `repetition`, `cassette` and `baseline` from `parseLLMOptions` (C9 hunks, Step 25).
 */
export interface NeuronalRunOptions {
  readonly runsPerEvaluation: number;          // 3
  readonly maxConcurrency: number;             // 3
  readonly unstableThreshold: number;          // 0.15
  readonly llm: LLMOptions;                    // { model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 }
  readonly unitCap: number;                    // 20
  readonly selectionSeed: string;              // "daedalus-v1.2E-judge"
  readonly minSizeTokens: number;              // 0
  readonly seededList: readonly string[];      // [] (BR-U4-SEL-06)
  readonly maxNodes: number;                   // 40
  readonly tokenBudget: TokenBudget;           // DE §3.4
  readonly timeoutMs: number;                  // 180000 (graph reads use their own read timeout)
  readonly repetition: number;                 // 0
  readonly cassette: { readonly mode: VCRMode; readonly dir: string; readonly omitPrompt: boolean };
  readonly baseline?: readonly BaselineSelection[];        // variant run (BR-U4-SEL-07)
  readonly evaluatorSpecLayers: readonly LayerDefinition[]; // layer model and module roots (CTX-07, SEL-03)
}

/** The judge run settings the CLI parses (`parseLLMOptions().run`, DE §5.6); the C9 hunks pass them on. */
export interface JudgeRunSettings {
  readonly llm: LLMOptions;                 // { model, effort, maxTokens: 8192 } (OPS-01)
  readonly repetition: number;
  readonly cassette: { readonly mode: VCRMode; readonly dir: string; readonly omitPrompt: boolean };
  readonly baselineReport?: string;         // --judge-baseline-report
}

export const DEFAULT_NEURONAL_RUN_OPTIONS: NeuronalRunOptions = Object.freeze({
  runsPerEvaluation: RUNS_PER_EVALUATION,
  maxConcurrency: MAX_CONCURRENCY,
  unstableThreshold: UNSTABLE_THRESHOLD,
  llm: Object.freeze({ model: JUDGE_MODEL, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS }),
  unitCap: UNIT_CAP,
  selectionSeed: SELECTION_SEED,
  minSizeTokens: MIN_SIZE_TOKENS,
  seededList: Object.freeze([]),
  maxNodes: EXCERPT_MAX_NODES,
  tokenBudget: JUDGE_TOKEN_BUDGET,
  timeoutMs: JUDGE_TIMEOUT_MS,
  repetition: 0,
  cassette: Object.freeze({ mode: 'record', dir: DEFAULT_CASSETTE_DIR, omitPrompt: false }),
  evaluatorSpecLayers: Object.freeze([]),
});

export interface NeuronalEvalInput {
  readonly instructions: readonly NeuronalInstruction[];
  readonly graphRepository: GraphRepository;
  readonly provider: LLMProvider;
  /** The evaluated project; unit files are read under it (CTX-02). Default: `process.cwd()`. */
  readonly projectRoot?: string;
  /** Run options; omitted fields take `DEFAULT_NEURONAL_RUN_OPTIONS`. */
  readonly options?: Partial<NeuronalRunOptions>;
  /** A graph view already loaded (tests, U5b); otherwise `loadJudgeGraphView(graphRepository)`. */
  readonly graphView?: JudgeGraphView;
  /** Per-function `exclude_paths` of the spec (`NeuronalInstruction` carries none; SEL-01). */
  readonly excludePaths?: Readonly<Record<string, readonly string[]>>;
  /** ADR prose per function id, for the `## ADR context` section (CTX-06). */
  readonly adrProse?: Readonly<Record<string, string>>;
  /** Values scrubbed from messages besides the built-in patterns (CAS-07); default from `process.env`. */
  readonly knownSecrets?: readonly string[];
  // Shorthands kept for the callers written before Step 21 (router, U3 commands); `options` wins.
  readonly runsPerEvaluation?: number;
  readonly vcrMode?: VCRMode;
  readonly cassettePath?: string;
  readonly maxConcurrency?: number;
  readonly unstableThreshold?: number;
}

export const DEFAULT_NEURONAL_OPTIONS = {
  runsPerEvaluation: RUNS_PER_EVALUATION,
  vcrMode: 'record' as VCRMode,
  cassettePath: DEFAULT_CASSETTE_DIR,
  maxConcurrency: MAX_CONCURRENCY,
  unstableThreshold: UNSTABLE_THRESHOLD,
};

export interface CriticVerdict {
  readonly pass: boolean;
  readonly confidence: number;
  readonly reasoning: string;
  readonly evidence: readonly string[];
  readonly violations: readonly CriticViolation[];
}

export interface CriticViolation {
  readonly filePath: string;
  readonly message: string;
}

// Call outcomes (U4 DE §4.2; BR-U4-CAS-04, AGG-02). `InvalidCause` is the C10 type.
export type CallOutcome =
  | { readonly kind: 'valid' }
  | { readonly kind: 'invalid'; readonly cause: InvalidCause };

// Stop causes are never recorded in a cassette; they make the run incomplete (BR-U4-AGG-03).
export type StopCause = 'USAGE_LIMIT' | 'AUTH' | 'CLI_NOT_FOUND' | 'CASSETTE_MISS' | 'ISOLATION' | 'CLI_VERSION';

// Source pointer of a corpus (E7) entry recorded with --cassette-omit-prompt (BR-U4-CAS-09).
export interface SourcePointer {
  readonly projectId: string;
  readonly commitSha: string;
  readonly unitPaths: readonly string[];
}

// Cassette entry v2 (U4 DE §4.1; supersedes component-methods.md:1196-1213). One file per key at
// `<cassetteDir>/<key[0..1]>/<key>.json`, written atomically with sorted keys.
export interface CassetteEntry {
  readonly schemaVersion: 2;
  readonly key: string;                       // `${requestHash}-r${repetition}-${runIndex}`
  readonly requestHash: string;               // sha256 hex of the canonical request, before scrubbing
  readonly repetition: number;
  readonly runIndex: number;
  // metadata, not key parts
  readonly functionId: string;
  readonly unitId?: string;
  readonly projectId?: string;
  readonly provider: string;
  readonly model: string;                     // requested
  readonly resolvedModel?: string;            // BR-U4-VRD-07
  readonly effort: LLMEffort | null;
  readonly cliVersion?: string;
  readonly isolationProbeSha256?: string;
  readonly configListingSha256?: string;
  readonly usedOptions: Partial<LLMOptions>;
  readonly ignoredOptions: readonly (keyof LLMOptions)[];
  readonly attempts: 1 | 2;
  readonly outcome: CallOutcome;
  // content
  readonly prompt?: string;                   // omitted for corpus (E7) cassettes (BR-U4-CAS-09)
  readonly sourcePointer?: SourcePointer;
  readonly response: string;                  // scrubbed raw output of the final attempt
  readonly parsedVerdict: CriticVerdict | null; // computed unscrubbed at record time, then scrubbed; never re-parsed
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
  readonly durationMs: number;
  readonly recordedAt: string;                // ISO 8601; not part of any result
}

// Run completeness and the manifest of an incomplete run (U4 DE §4.7; BR-U4-AGG-03).
export type RunCompleteness =
  | { readonly status: 'complete' }
  | { readonly status: 'incomplete'; readonly stop: StopCause; readonly outstanding: number };

export interface RunManifest {
  readonly projectRoot: string;               // as given on the command line, scrubbed
  readonly stop: StopCause;
  readonly message: string;                   // scrubbed
  readonly completedCalls: number;
  readonly outstanding: readonly { readonly functionId: string; readonly unitId: string; readonly runIndex: number; readonly key: string }[];
}

// Context packet of one unit (U4 DE §3.3; BR-U4-CTX-06): the frozen prompt template's inputs.
export interface ContextPacket {
  readonly rule: string;
  readonly rubric: { readonly pass: string; readonly fail: string; readonly evidenceRequired: string };
  readonly layerModel: string;            // from the evaluation spec only (BR-U4-CTX-07)
  readonly unitId: string;
  readonly unitKind: JudgeUnitKind;
  readonly unitLayer: string;
  readonly unitFiles: readonly string[];
  readonly source: string;                // fenced file blocks (BR-U4-CTX-05)
  readonly signatures?: string;           // module units
  readonly incoming: readonly string[];   // module units
  readonly outgoing: readonly string[];   // module units
  readonly apgSubgraph: string;           // canonical JSON excerpt, '{"edges":[],"nodes":[]}' when empty
  readonly adrProse?: string;
}

// Token budgets (U4 DE §3.4, BR-U4-CTX-03); 1 token = CHARS_PER_TOKEN characters.
export interface TokenBudget {
  readonly ruleRubric: number;   // 300 (frozen rubric text must fit)
  readonly codeSnippet: number;  // file/class units: 8000
  readonly moduleSource: number; // module units: 24000
  readonly apgSubgraph: number;  // 1000
  readonly adrProse: number;     // 1000
}

export const DEFAULT_TOKEN_BUDGET: TokenBudget = JUDGE_TOKEN_BUDGET;

export type CriticErrorCode =
  | 'LLM_CALL_FAILED'
  | 'VERDICT_PARSE_FAILED'
  | 'INSUFFICIENT_VALID_RUNS'
  | 'CONTEXT_ASSEMBLY_FAILED';

export interface CriticError extends PipelineError {
  readonly code: CriticErrorCode;
  readonly stage: 'llm-critic';
  readonly critical: true;
}
