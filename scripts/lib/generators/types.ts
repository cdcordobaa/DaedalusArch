/**
 * U5a generator domain types (FR-v1.2E-28; SECURITY-11; `domain-entities.md` §5).
 *
 * Shapes of the Claude Code headless generator adapter, the confined run and the E1 grid. Types only, apart from
 * the frozen constants of the design. No model id literal lives in `scripts/lib/generators/**` (BR-U5a-51): pinned
 * ids come from the plan file at run time.
 */
import type { DomainResult } from '../../../src/shared/errors/domain-result.js';

export type { DomainResult };

export type SpecLevel = 'none' | 'minimal-prose' | 'full-aac';

export const SPEC_LEVELS: readonly SpecLevel[] = ['none', 'minimal-prose', 'full-aac'];

export type TaskId = 'task-management' | 'order-fulfilment';

/** Adapter id of the Claude arm (`GridPlan.adapters[].adapterId`). */
export const CLAUDE_CODE_ADAPTER_ID = 'claude-code-cli' as const;

/** Adapter id of the Codex arm (ADR-029; `codex-cli.ts`). */
export const CODEX_CLI_ADAPTER_ID_VALUE = 'codex-cli' as const;

/** Every known adapter id. */
export const GENERATOR_ADAPTER_IDS: readonly string[] = Object.freeze([CLAUDE_CODE_ADAPTER_ID, CODEX_CLI_ADAPTER_ID_VALUE]);

export type GeneratorAdapterId = typeof CLAUDE_CODE_ADAPTER_ID | typeof CODEX_CLI_ADAPTER_ID_VALUE;

/** Default wall-clock limit of one CLI call (BR-U5a-50: 20 min). */
export const DEFAULT_GENERATOR_TIMEOUT_MS = 1_200_000;

/** BR-U5a-48: `fileCountInRange` = 20 ≤ count ≤ 100. */
export const FILE_RANGE = { min: 20, max: 100 } as const;

/** Configuration of one adapter (scripts/lib/generators/, not C10's `ClaudeCliConfig`). Built by `createGeneratorCliConfig`. */
export interface GeneratorCliConfig {
  /** Absolute path of the claude CLI. */
  readonly binary: string;
  /** Pinned full id, from the plan file. */
  readonly modelId: string;
  /** Default `DEFAULT_GENERATOR_TIMEOUT_MS`. */
  readonly timeoutMs: number;
  /** Absolute, outside the repository. */
  readonly outputRoot: string;
  /** `<H>`: absolute, outside the repository and outside every `cwd`. */
  readonly harnessRoot: string;
  /** False after a failed confinement probe (BR-U5a-43): the no-Bash argv is used. */
  readonly allowBash: boolean;
}

export interface GenerationRequest {
  /** `${modelId}/${taskId}/${specLevel}/run-${runIndex}` (`runIdFor`). */
  readonly runId: string;
  readonly promptTemplateId: string;
  readonly taskId: TaskId;
  readonly modelId: string;
  /** `'clean-architecture'`. */
  readonly style: string;
  readonly specLevel: SpecLevel;
  /** 0..runs-1. */
  readonly runIndex: number;
  /** The run's `cwd`: fresh, empty, outside the repository. */
  readonly outputDir: string;
  readonly fileRange: { readonly min: 20; readonly max: 100 };
  readonly orderSeed: number;
  readonly pilot: boolean;
}

export interface GenerationCell {
  readonly modelId: string;
  readonly taskId: TaskId;
  readonly specLevel: SpecLevel;
  readonly runIndex: number;
  /** = `runIndex`. */
  readonly blockIndex: number;
  readonly positionInBlock: number;
}

export interface GridPlan {
  readonly adapters: readonly { readonly adapterId: GeneratorAdapterId; readonly modelId: string }[];
  readonly tasks: readonly TaskId[];
  readonly style: string;
  readonly levels: readonly SpecLevel[];
  readonly runs: number;
  readonly outRoot: string;
  readonly orderSeed: number;
}

/** Tolerant envelope extract (BR-U5a-46): every field optional (the Codex arm fills it from `codex-events.ts`). */
export interface CliEnvelopeSummary {
  readonly isError?: boolean;
  readonly subtype?: string;
  readonly numTurns?: number;
  readonly permissionDenials?: readonly unknown[];
  readonly totalCostUsd?: number;
  readonly durationMs?: number;
  readonly sessionId?: string;
  readonly modelUsage?: Readonly<Record<string, { readonly outputTokens?: number }>>;
}

export interface AuxiliaryModel {
  readonly id: string;
  readonly outputTokens: number;
}

export type ModelUsageVerdict =
  | { readonly valid: true; readonly resolvedModelId: string; readonly auxiliaryModels: readonly AuxiliaryModel[] }
  | {
      readonly valid: false;
      readonly reason: 'pinned-absent' | 'pinned-not-dominant' | 'no-model-usage';
      readonly auxiliaryModels: readonly AuxiliaryModel[];
    };

export type GenerationStatus = 'ok' | 'failed-typecheck' | 'failed-agent';

export type GenerationFailureReason =
  | 'typecheck'
  | 'agent-error'
  | 'model-mismatch'
  | 'skeleton-tampered'
  | 'infrastructure'
  | 'envelope-unreadable'
  | 'timeout';

/** One CLI call that consumed an attempt (BR-U5a-50). `outcome`: `completed`, `timeout`, `spawn-failed`, `timeout-no-files`, `exit-<n>-before-first-turn`. */
export interface GenerationAttempt {
  readonly startedAt: string;
  readonly outcome: string;
}

/** A usage- or rate-limit interruption (no attempt consumed); `movedTo` is POSIX, relative to the grid `outRoot`. */
export interface GenerationInterruption {
  readonly at: string;
  readonly subtype: string;
  readonly movedTo: string;
}

/** An instantiated prompt and its provenance (BR-U5a-52). */
export interface PromptInstance {
  /** `<specLevel>/<taskId>`. */
  readonly promptTemplateId: string;
  readonly promptTemplateSha256: string;
  /** The instantiated text (template with `{{TYPECHECK_COMMAND}}` replaced). */
  readonly prompt: string;
  readonly promptSha256: string;
}

/**
 * Gives the instantiated prompt of a request: the template `scripts/generator/prompts/<specLevel>.md` (task section
 * `taskId`) with `{{TYPECHECK_COMMAND}}` replaced by `typecheckCommand` (BR-U5a-52; `prompt.ts`).
 */
export type PromptProvider = (req: GenerationRequest, typecheckCommand: string) => DomainResult<PromptInstance>;

export interface GenerationOutcome {
  readonly status: GenerationStatus;
  readonly failureReason?: GenerationFailureReason;
  readonly adapterId: string;
  readonly taskId: TaskId;
  readonly specLevel: SpecLevel;
  readonly runIndex: number;
  readonly orderSeed: number;
  /** The field U5b reads (U5b domain-entities §1); there is no `modelId` here. */
  readonly requestedModelId: string;
  readonly resolvedModelId?: string;
  readonly auxiliaryModels: readonly AuxiliaryModel[];
  readonly promptTemplateId: string;
  /** Frozen in `Docs/generator-protocol.md` (BR-U5a-52). */
  readonly promptTemplateSha256: string;
  /** sha256 of the instantiated prompt (template + `{{TYPECHECK_COMMAND}}`). */
  readonly promptSha256: string;
  /** Instantiated, scrubbed. */
  readonly prompt: string;
  readonly skeletonIntact: boolean;
  readonly fileCount: number;
  readonly fileCountInRange: boolean;
  readonly permissionDenials: number;
  readonly typecheck: { readonly tscVersion: string; readonly errors: number } | null;
  readonly attempts: readonly GenerationAttempt[];
  readonly interruptions: readonly GenerationInterruption[];
  readonly treeSha: string | null;
  readonly durationMs: number;
  readonly pilot: boolean;
  /** Scrubbed full envelope beside `generation.json`. */
  readonly envelopePath: string;
}

export interface GeneratorAdapter {
  readonly id: string;
  readonly modelId: string;
  isAvailable(): Promise<boolean>;
  generate(req: GenerationRequest): Promise<DomainResult<GenerationOutcome>>;
}

/** Pinned per-run tsconfig written to `<H>/runs/<runId>/tsconfig.json` (BR-U5a-42). */
export interface HarnessTsconfig {
  readonly compilerOptions: {
    readonly strict: true;
    readonly target: 'ES2022';
    readonly lib: readonly ['ES2022'];
    readonly module: 'commonjs';
    readonly moduleResolution: 'node';
    readonly esModuleInterop: true;
    readonly skipLibCheck: true;
    readonly forceConsistentCasingInFileNames: true;
    readonly noEmit: true;
    readonly incremental: false;
    /** [`${cwd}/node_modules/@types`], absolute. */
    readonly typeRoots: readonly [string];
    readonly types: readonly ['node'];
  };
  /** [`${cwd}/src/**\/*.ts`], absolute. */
  readonly include: readonly [string];
}

/** BR-U5a-44: the only parent variables a generator child process sees (through C10 `buildChildEnv`). */
export const GENERATOR_ENV_ALLOW: readonly string[] = Object.freeze([
  'HOME',
  'USER',
  'LOGNAME',
  'PATH',
  'SHELL',
  'LANG',
  'LC_ALL',
  'TERM',
  'TMPDIR',
]);
