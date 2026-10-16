/**
 * The neural arm behind the MCP tools `review_unit` and `explain_and_fix` (v1.3; Docs/v1.3/neural-arm-agent-tools.md).
 *
 * - `NeuralJudge` answers one verdict request. `SingleJudge` goes through the judge's cassette decorator (record and
 *   replay, the Claude CLI isolation pre-flight, secret scrubbing), `EnsembleJudge` through `EnsembleRater`.
 * - `NeuralService` runs every request as a job keyed by its cache key: a finished key is answered from memory, a
 *   running key is joined (never started twice), and a caller waits at most `waitMs` before getting a `pending`
 *   answer with the job id to poll. A tool call therefore returns within its latency budget and the agent keeps
 *   working while the judge runs.
 * - Nothing the neural arm returns is blocking: verdicts are advisory by construction.
 */
import { randomUUID } from 'node:crypto';
import type { LLMOptions, LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { CriticVerdict } from '../llm-critic/types.js';
import { CassetteLLMProvider } from '../llm-critic/cassette-provider.js';
import { wrapJudgeProvider } from '../llm-critic/provider-factory.js';
import { createFilterExplainProvider, answerOfResponse, FE_PERSONA, FE_SCHEMA_TEXT } from '../llm-critic/filter-explain.js';
import type { FilterExplainAnswer } from '../llm-critic/filter-explain.js';
import { VERDICT_SCHEMA_TEXT } from '../llm-critic/verdict-schema.js';
import { JUDGE_MAX_TOKENS, JUDGE_MODEL, JUDGE_EFFORT } from '../llm-critic/frozen.js';
import type { EnsembleRater, EnsembleVerdict } from '../llm-critic/ensemble.js';
import type { VCRMode } from '../shared/types/llm-config.js';

export interface VerdictRequest {
  readonly prompt: string;
  readonly systemPrompt: string | undefined;
  readonly functionId: string;
  readonly unitId: string;
}

export type JudgeAnswer =
  | { readonly status: 'valid'; readonly verdict: CriticVerdict; readonly cassetteHit: boolean; readonly ensemble?: EnsembleVerdict }
  | { readonly status: 'invalid'; readonly cause: string; readonly ensemble?: EnsembleVerdict }
  | { readonly status: 'error'; readonly code: string; readonly message: string };

export type ExplainAnswer =
  | { readonly status: 'valid'; readonly answer: FilterExplainAnswer; readonly cassetteHit: boolean }
  | { readonly status: 'invalid'; readonly cause: string }
  | { readonly status: 'error'; readonly code: string; readonly message: string };

/** A neural judge: one verdict request (judge schema) and one filter-and-explain request (FE schema). */
export interface NeuralJudge {
  /** Stable id of the judge configuration (part of every cache key). */
  readonly id: string;
  readonly description: { readonly provider: string; readonly model: string; readonly rule?: string };
  verdict(request: VerdictRequest): Promise<JudgeAnswer>;
  explain(request: { readonly prompt: string; readonly functionId: string; readonly unitId: string }): Promise<ExplainAnswer>;
}

export interface SingleJudgeOptions {
  readonly cassette: { readonly mode: VCRMode; readonly dir: string };
  readonly llm?: LLMOptions;
  /** Values scrubbed from stored answers (default: secret-named variables of `process.env`, CAS-07). */
  readonly knownSecrets?: readonly string[];
}

/**
 * One provider behind the judge's cassette decorator: the frozen judge route when the provider is the Claude CLI.
 * The decorators are built lazily (the Claude CLI pre-flight runs on the first call, not at server start).
 */
export class SingleJudge implements NeuralJudge {
  readonly id: string;
  readonly description: { readonly provider: string; readonly model: string };
  private verdictProvider: Promise<CassetteLLMProvider | { readonly code: string; readonly message: string }> | undefined;
  private explainProvider: Promise<CassetteLLMProvider | { readonly code: string; readonly message: string }> | undefined;
  private readonly llm: LLMOptions;

  constructor(private readonly inner: LLMProvider, private readonly options: SingleJudgeOptions) {
    const d = inner.describe();
    this.description = { provider: d.provider, model: d.model };
    this.id = `${d.provider}:${d.model}`;
    this.llm = options.llm ?? { model: d.provider === 'claude-cli' ? JUDGE_MODEL : d.model, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS };
  }

  private cassetteFor(kind: 'verdict' | 'explain'): Promise<CassetteLLMProvider | { readonly code: string; readonly message: string }> {
    const make = async (): Promise<CassetteLLMProvider | { readonly code: string; readonly message: string }> => {
      const dir = `${this.options.cassette.dir}/${kind === 'verdict' ? 'review-unit' : 'explain-and-fix'}`;
      const extra = this.options.knownSecrets !== undefined ? { knownSecrets: this.options.knownSecrets } : {};
      const wrapped = kind === 'verdict'
        ? await wrapJudgeProvider(this.inner, { mode: this.options.cassette.mode, dir }, extra)
        : await createFilterExplainProvider(this.inner, { mode: this.options.cassette.mode, dir }, extra);
      if (!wrapped.success) {
        const e = wrapped.errors[0];
        return { code: e?.code ?? 'LLM_NOT_CONFIGURED', message: e?.message ?? 'the judge provider could not be prepared' };
      }
      return wrapped.data;
    };
    if (kind === 'verdict') return (this.verdictProvider ??= make());
    return (this.explainProvider ??= make());
  }

  async verdict(request: VerdictRequest): Promise<JudgeAnswer> {
    const cassette = await this.cassetteFor('verdict');
    if (!(cassette instanceof CassetteLLMProvider)) {
      this.verdictProvider = undefined; // a failed pre-flight is retried on the next call
      return { status: 'error', code: cassette.code, message: cassette.message };
    }
    const vendorNeedsSchema = this.description.provider === 'agy';
    const result = await cassette.judge(request.prompt, this.llm, {
      runIndex: 0, repetition: 0, functionId: request.functionId, unitId: request.unitId,
      ...(request.systemPrompt !== undefined ? { systemPrompt: request.systemPrompt } : {}),
      ...(vendorNeedsSchema ? { responseSchema: VERDICT_SCHEMA_TEXT } : {}),
    });
    if (result.kind === 'stop') return { status: 'error', code: result.stop, message: result.message };
    if (result.outcome.kind !== 'valid' || result.verdict === null) {
      return { status: 'invalid', cause: result.outcome.kind === 'invalid' ? result.outcome.cause : 'PARSE_FAILURE' };
    }
    return { status: 'valid', verdict: result.verdict, cassetteHit: result.hit };
  }

  async explain(request: { readonly prompt: string; readonly functionId: string; readonly unitId: string }): Promise<ExplainAnswer> {
    const cassette = await this.cassetteFor('explain');
    if (!(cassette instanceof CassetteLLMProvider)) {
      this.explainProvider = undefined;
      return { status: 'error', code: cassette.code, message: cassette.message };
    }
    const result = await cassette.judge(request.prompt, this.llm, {
      runIndex: 0, repetition: 0, functionId: request.functionId, unitId: request.unitId, systemPrompt: FE_PERSONA, responseSchema: FE_SCHEMA_TEXT,
    });
    if (result.kind === 'stop') return { status: 'error', code: result.stop, message: result.message };
    const answer = result.outcome.kind === 'valid' ? answerOfResponse(result.entry.response) : null;
    if (answer === null) return { status: 'invalid', cause: result.outcome.kind === 'invalid' ? result.outcome.cause : 'PARSE_FAILURE' };
    return { status: 'valid', answer, cassetteHit: result.hit };
  }
}

/**
 * The ensemble as a judge: the verdict request goes to every rater and the combined verdict is returned with each
 * rater's outcome. Filter-and-explain needs one explanation, so `explain` uses the first rater that answers validly.
 */
export class EnsembleJudge implements NeuralJudge {
  readonly id: string;
  readonly description: { readonly provider: string; readonly model: string; readonly rule: string };

  constructor(private readonly ensemble: EnsembleRater, private readonly llm: LLMOptions = { model: JUDGE_MODEL, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS }) {
    const d = ensemble.describe();
    this.description = { provider: d.provider, model: d.model, rule: ensemble.rule };
    this.id = `${d.provider}:${d.model}`;
  }

  async verdict(request: VerdictRequest): Promise<JudgeAnswer> {
    const combined = await this.ensemble.rate({
      prompt: request.prompt, responseSchema: VERDICT_SCHEMA_TEXT, options: this.llm, functionId: request.functionId, unitId: request.unitId,
      ...(request.systemPrompt !== undefined ? { systemPrompt: request.systemPrompt } : {}),
    });
    if (combined.verdict === null) return { status: 'invalid', cause: 'NO_VALID_RATER', ensemble: combined };
    return { status: 'valid', verdict: combined.verdict, cassetteHit: false, ensemble: combined };
  }

  /** Raters in order; the first valid FE answer is used. */
  async explain(request: { readonly prompt: string; readonly functionId: string; readonly unitId: string }): Promise<ExplainAnswer> {
    let last: ExplainAnswer = { status: 'error', code: 'LLM_NOT_CONFIGURED', message: 'no ensemble rater answered' };
    for (const rater of this.ensemble.raters) {
      const out = await rater.complete({
        prompt: request.prompt, systemPrompt: FE_PERSONA, responseSchema: FE_SCHEMA_TEXT, options: this.llm, functionId: request.functionId, unitId: request.unitId,
      });
      if (out.status === 'skipped') continue;
      if (out.status === 'error') {
        last = { status: 'error', code: out.code, message: out.message };
        continue;
      }
      const answer = answerOfResponse(out.content);
      if (answer !== null) return { status: 'valid', answer, cassetteHit: false };
      last = { status: 'invalid', cause: 'PARSE_FAILURE' };
    }
    return last;
  }
}

// ── Jobs and cache ───────────────────────────────────────────────────────────────────────

export type JobView<T> =
  | { readonly state: 'done'; readonly jobId: string; readonly result: T; readonly fromCache: boolean; readonly elapsedMs: number }
  | { readonly state: 'pending'; readonly jobId: string; readonly elapsedMs: number; readonly retryAfterMs: number }
  | { readonly state: 'unknown'; readonly jobId: string };

interface Job {
  readonly id: string;
  readonly key: string;
  readonly started: number;
  readonly promise: Promise<unknown>;
  done: boolean;
  result?: unknown;
  finished?: number;
}

export interface NeuralServiceOptions {
  readonly judge?: NeuralJudge;
  /** Default wait of a tool call before it answers `pending` (ms). */
  readonly waitMs?: number;
  /** Results kept in memory (least recently used dropped first). */
  readonly cacheSize?: number;
  readonly now?: () => number;
}

/** Default latency budget of one neural tool call: answer within 20 s, else `pending` with a job id. */
export const DEFAULT_NEURAL_WAIT_MS = 20_000;
export const DEFAULT_NEURAL_CACHE_SIZE = 500;

export class NeuralService {
  readonly judge: NeuralJudge | undefined;
  readonly waitMs: number;
  private readonly cacheSize: number;
  private readonly now: () => number;
  /** Finished results by cache key (insertion order = recency). */
  private readonly cache = new Map<string, unknown>();
  /** Jobs by id and the running job of each key. */
  private readonly jobs = new Map<string, Job>();
  private readonly running = new Map<string, Job>();

  constructor(options: NeuralServiceOptions = {}) {
    this.judge = options.judge;
    this.waitMs = options.waitMs ?? DEFAULT_NEURAL_WAIT_MS;
    this.cacheSize = options.cacheSize ?? DEFAULT_NEURAL_CACHE_SIZE;
    this.now = options.now ?? Date.now;
  }

  /** The cached result of a key, refreshed as most recently used. */
  cached(key: string): unknown {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  private remember(key: string, value: unknown): void {
    this.cache.delete(key);
    this.cache.set(key, value);
    while (this.cache.size > this.cacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  /**
   * Runs `task` once per key and waits for it at most `waitMs`. `cacheable(result)` decides whether a result is kept
   * (errors are not, so a later call retries).
   */
  async run<T>(key: string, task: () => Promise<T>, options: { readonly waitMs?: number; readonly cacheable?: (r: T) => boolean } = {}): Promise<JobView<T>> {
    const hit = this.cached(key) as T | undefined;
    if (hit !== undefined) return { state: 'done', jobId: key.slice(0, 16), result: hit, fromCache: true, elapsedMs: 0 };
    let job = this.running.get(key);
    if (job === undefined) {
      const id = `${key.slice(0, 16)}-${randomUUID().slice(0, 8)}`;
      const started = this.now();
      const created: Job = {
        id, key, started, done: false,
        promise: task().then((result) => {
          created.done = true;
          created.result = result;
          created.finished = this.now();
          this.running.delete(key);
          if (options.cacheable?.(result) ?? true) this.remember(key, result);
          return result;
        }, (error: unknown) => {
          const result = { status: 'error', code: 'NEURAL_TASK_FAILED', message: error instanceof Error ? error.message : String(error) };
          created.done = true;
          created.result = result;
          created.finished = this.now();
          this.running.delete(key);
          return result;
        }),
      };
      job = created;
      this.jobs.set(id, job);
      this.running.set(key, job);
      this.pruneJobs();
    }
    return this.await<T>(job, options.waitMs ?? this.waitMs);
  }

  /** The state of a job; waits at most `waitMs` for a running one. */
  async poll<T>(jobId: string, waitMs = 0): Promise<JobView<T>> {
    const job = this.jobs.get(jobId);
    if (job === undefined) return { state: 'unknown', jobId };
    return this.await<T>(job, waitMs);
  }

  private async await<T>(job: Job, waitMs: number): Promise<JobView<T>> {
    if (!job.done && waitMs > 0) {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([job.promise, new Promise<void>((resolve) => { timer = setTimeout(resolve, waitMs); })]);
      if (timer !== undefined) clearTimeout(timer);
    }
    if (job.done) {
      return { state: 'done', jobId: job.id, result: job.result as T, fromCache: false, elapsedMs: (job.finished ?? this.now()) - job.started };
    }
    const elapsedMs = this.now() - job.started;
    return { state: 'pending', jobId: job.id, elapsedMs, retryAfterMs: Math.min(30_000, Math.max(5_000, Math.round(elapsedMs / 2))) };
  }

  /** Keeps at most 4 x cacheSize finished jobs (a polled id stays valid long after it finished). */
  private pruneJobs(): void {
    const limit = this.cacheSize * 4;
    if (this.jobs.size <= limit) return;
    for (const [id, job] of this.jobs) {
      if (this.jobs.size <= limit) break;
      if (job.done) this.jobs.delete(id);
    }
  }
}
