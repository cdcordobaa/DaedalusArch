/**
 * EFF-01 efficiency harness: contracts and frozen constants (AI-DLC v1.4 U8; design
 * `aidlc-docs/construction/v1.4/U8/functional-design/design.md`; note `ops/notes/eff-01-efficiency-design.md`).
 *
 * **The turn cap (design §1).** `--max-turns <turns>` is a hidden but registered option of Claude Code 2.1.301
 * ("Maximum number of agentic turns in non-interactive mode … only works with --print", `hideHelp()`), and the CLI's
 * result handling has the subtype `error_max_turns`. The driver passes `--max-turns 30` in every condition, refuses any
 * other CLI version (DR-29), and keeps the after-the-fact rule as a backstop: `num_turns` > 30 is a cap hit (DR-18).
 *
 * **Amendment A1 (design §2.9).** G is files plus graph tools (Read, Grep, Glob and the 11 MCP tools), R is files only,
 * N has no tools. There is no graph-only arm.
 */

export type Eff01Condition = 'R' | 'G' | 'N';
export type Eff01Block = 'calibration' | 'pilot' | 'main' | 'n';

export const EFF01_CONDITIONS: readonly Eff01Condition[] = Object.freeze(['R', 'G', 'N']);
export const EFF01_BLOCKS: readonly Eff01Block[] = Object.freeze(['calibration', 'pilot', 'main', 'n']);

/** Seed of the main shuffle (note §7); the N block uses `EFF01_SEED + 1` (DR-3). */
export const EFF01_SEED = 20261018;
/** Wall-time cap per session (DR-17). */
export const CAP_WALL_MS = 600_000;
/** Turn cap per session, passed as `--max-turns` (DR-18). */
export const CAP_TURNS = 30;
/** Processed-token cap per session, applied after the fact (DR-19). */
export const CAP_TOKENS = 400_000;
/** Runner output cap (DR-22 row 2). */
export const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_CLI_VERSION = '2.1.301';
export const DEFAULT_CALIBRATION_REPO = 'ddd-forum';
export const RECORD_SCHEMA = 'eff-01-session/v1';
export const SCORE_SCHEMA = 'eff-01-scores/v1';
export const PLAN_SCHEMA = 'eff-01-plan/v1';

/** The pilot's question templates (DR-2): Q02 and Q06 of each repo. */
export const PILOT_QUESTION_SUFFIXES: readonly string[] = Object.freeze(['Q02', 'Q06']);

/** R's reading sentence; G starts with it too (A1, DR-A1-1). */
export const READING_SENTENCE =
  "You can read the project's files with the Read, Grep and Glob tools; the project root is the working directory. Read the project's docs (README, ADRs, code comments) and its code before you answer.";

/** G's addition after the reading sentence (A1, DR-A1-1). */
export const GRAPH_SENTENCE =
  'You can also query the project through the daedalus-arch MCP tools; the server is configured with this project and its spec. Use them to check and quantify your answer, and cite the tool results you relied on.';

/** The condition sentences of the frame (note §5 as amended by A1). */
export const CONDITION_SENTENCES: Readonly<Record<Eff01Condition, string>> = Object.freeze({
  R: READING_SENTENCE,
  G: `${READING_SENTENCE} ${GRAPH_SENTENCE}`,
  N: 'You have no tools; answer from the spec below and what you already know.',
});

/** One planned session (DR-1). */
export interface SessionSpec {
  readonly sessionId: string;
  readonly block: Eff01Block;
  readonly repoId: string;
  /** Null for calibration. */
  readonly questionId: string | null;
  readonly condition: Eff01Condition;
  /** 1-based run index k. */
  readonly run: number;
  readonly rerun: boolean;
  readonly lane: 0 | 1;
  readonly orderIndex: number;
}

/** DR-22, in decision order. */
export type SessionStatus =
  | 'infrastructure'
  | 'envelope-unreadable'
  | 'model-mismatch'
  | 'confinement-leak'
  | 'tree-changed'
  | 'cap-wall'
  | 'cap-turns'
  | 'cap-tokens'
  | 'completed';

export const VALID_STATUSES: readonly SessionStatus[] = Object.freeze(['cap-wall', 'cap-turns', 'cap-tokens', 'completed']);
export const CAP_STATUSES: readonly SessionStatus[] = Object.freeze(['cap-wall', 'cap-turns', 'cap-tokens']);

export interface ModelTokens {
  readonly input: number;
  readonly cacheCreation: number;
  readonly cacheRead: number;
  readonly output: number;
  /** input + cacheCreation + cacheRead + output (SC-4). */
  readonly processed: number;
}

/** SC-4 to SC-6. */
export interface TokenUsage {
  /** Primary: Σ over `modelUsage[*]` of the four fields. */
  readonly processed: number;
  /** input + cache creation + output. */
  readonly uncached: number;
  readonly output: number;
  /** The snake_case `usage` block's four-field total; null when absent (or a partial transcript). */
  readonly usageTotal: number | null;
  readonly usageMismatch: boolean;
  readonly byModel: Readonly<Record<string, ModelTokens>>;
  /** Processed tokens of every model other than the pinned one. */
  readonly auxProcessed: number;
}

export interface ConfinementResult {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

/** design §3.2. */
export interface SessionRecord {
  readonly schema: typeof RECORD_SCHEMA;
  readonly sessionId: string;
  readonly block: Eff01Block;
  readonly repoId: string;
  readonly questionId: string | null;
  readonly condition: Eff01Condition;
  readonly run: number;
  readonly rerun: boolean;
  readonly lane: 0 | 1;
  readonly orderIndex: number;
  readonly argv: readonly string[];
  readonly promptSha256: string;
  readonly frameSha256: string;
  readonly questionsSha256: string;
  readonly answersSha256: string;
  readonly specSha256: string;
  readonly treeFingerprint: string | null;
  readonly cliVersionStart: string | null;
  readonly cliVersionEnd: string | null;
  readonly cliDrift: boolean;
  readonly model: { readonly pinned: string; readonly verdict: unknown };
  readonly modelSource: 'envelope' | 'transcript';
  readonly status: SessionStatus;
  readonly statusReason: string | null;
  readonly valid: boolean;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly truncated: boolean;
  readonly resultSubtype: string | null;
  readonly isError: boolean;
  readonly agentError: boolean;
  readonly tokens: TokenUsage | null;
  readonly tokensSource: 'envelope' | 'transcript-partial';
  readonly numTurns: number | null;
  readonly durationMs: number | null;
  readonly wallMs: number;
  readonly toolCalls: { readonly total: number; readonly byName: Readonly<Record<string, number>> };
  readonly mcpCallLog: { readonly lines: number; readonly byTool: Readonly<Record<string, number>> } | null;
  readonly confinement: ConfinementResult;
  readonly attempts: readonly unknown[];
  readonly interruptions: readonly unknown[];
  readonly modelReachingAttempts: number;
  readonly permissionDenials: number;
  /** The raw last `ANSWER:` line (redacted), for audit. */
  readonly answerText: string | null;
  /** The final text the scorer reads (SC-1; redacted). */
  readonly finalText: string | null;
  /** True when stderr shows the CLI rejected `--max-turns` (DR-25 flag check). */
  readonly maxTurnsRejected: boolean;
  readonly dryRun: boolean;
}

export type ParseOutcome = 'ok' | 'extracted' | 'missing' | 'unparsable';

/** SC-11, per session. */
export interface ScoreRecord {
  readonly sessionId: string;
  readonly block: Eff01Block;
  readonly repoId: string;
  readonly questionId: string | null;
  readonly condition: Eff01Condition;
  readonly run: number;
  readonly valid: boolean;
  readonly capHit: SessionStatus | null;
  readonly parse: ParseOutcome | null;
  readonly multipleAnswerLines: boolean;
  readonly score: number;
  readonly scoreStrict: number;
  readonly parts: Readonly<Record<string, number>>;
  readonly secondary: Readonly<Record<string, number | boolean>>;
  readonly pathPrefixStripped: boolean;
  readonly tokens: number | null;
  readonly tokensUncached: number | null;
  readonly tokensAux: number | null;
  readonly numTurns: number | null;
  readonly wallMs: number;
  readonly toolCalls: number;
  /** A1 (DR-A1-5): G only. */
  readonly graphEvidence: { readonly toolCalls: number; readonly cited: boolean } | null;
}

/** SC-12. */
export interface ItemRow {
  readonly repoId: string;
  readonly questionId: string;
  readonly condition: Eff01Condition;
  readonly class: string;
  readonly template: string;
  readonly nRuns: number;
  readonly acc: number | null;
  readonly accStrict: number | null;
  readonly tokMedian: number | null;
  readonly tokUncachedMedian: number | null;
  readonly tokAuxMedian: number | null;
  readonly turnsMedian: number | null;
  readonly wallMedianMs: number | null;
  readonly capHits: number;
  readonly formatFailures: number;
  readonly toolCallsMedian: number | null;
  /** A1 (DR-A1-5): G rows only, else null. */
  readonly graphUnusedRuns: number | null;
  readonly graphUncitedRuns: number | null;
}
