/**
 * Ensemble neural rater (v1.3 development; NOT frozen, OFF by default): one verdict request answered by several
 * vendors, combined by a declared rule. Docs/v1.3/neural-arm-agent-tools.md.
 *
 * - `NeuralRater` is the multi-vendor interface: a request (prompt, persona, schema, options) in, a `RaterOutcome`
 *   out. A rater never throws: a provider failure is an `error` outcome, a refused call (budget, not configured) is
 *   `skipped`, an answer that fails the verdict schema is `invalid`.
 * - Adapters wrap the existing providers, so their isolation code applies unchanged: the Claude CLI judge route
 *   (`ClaudeCliProvider`, isolated config dir and pre-flight), the Antigravity CLI `agy` (`AgyCliProvider`, dedicated
 *   home, tools inert, neutral cwd) and the Gemini API (`GeminiProvider`, key from the environment only) behind a
 *   hard call, token and dollar cap (`BudgetedRater`; the dollar ceiling can never exceed `GEMINI_HARD_USD_CEILING`).
 * - `combineVerdicts` applies `fail-if-both` (fail only when every valid rater fails) or `fail-if-either` (fail when
 *   any valid rater fails) and gives a confidence that falls with disagreement and with missing raters.
 *
 * Nothing here is read by the frozen judge (v1), the evaluate pipeline or any default output.
 */
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { LLMOptions, LLMProvider } from '../shared/interfaces/llm-provider.js';
import type { ProcessRunner } from '../shared/interfaces/process-runner.js';
import { scrubSecrets } from '../shared/errors/scrub.js';
import type { CriticVerdict, CriticViolation } from './types.js';
import { parseEnvelope, resolveActualModel, ClaudeCliProvider } from './claude-cli-provider.js';
import { parseEnvelopeVerdict, parseVerdictText } from './verdict-parser.js';
import type { VerdictParseOutcome } from './verdict-parser.js';
import { AGY_HOME_DEFAULT, AgyCliProvider, expandHome } from './agy-cli-provider.js';
import { JUDGE_CONFIG_DIR_DEFAULT, JUDGE_EFFORT, JUDGE_MODEL, JUDGE_TIMEOUT_MS, STRUCTURED_OUTPUT_FIELD } from './frozen.js';
import { knownSecretsFrom } from './cassette-provider.js';

export type RaterVendor = 'claude-cli' | 'agy' | 'gemini-api' | 'mock';

export interface RaterRequest {
  readonly prompt: string;
  /** Persona; absent means the provider's default (the frozen judge persona). */
  readonly systemPrompt?: string;
  /** Canonical JSON of the verdict schema (agy needs it; the others accept it). */
  readonly responseSchema: string;
  readonly options: LLMOptions;
  readonly functionId: string;
  readonly unitId?: string;
}

interface OutcomeBase {
  readonly rater: string;
  readonly vendor: RaterVendor;
  readonly model: string;
  readonly durationMs: number;
}

export type RaterOutcome =
  | (OutcomeBase & {
    readonly status: 'valid';
    readonly verdict: CriticVerdict;
    readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
  })
  | (OutcomeBase & { readonly status: 'invalid'; readonly cause: string })
  | (OutcomeBase & { readonly status: 'error'; readonly code: string; readonly message: string })
  | (OutcomeBase & { readonly status: 'skipped'; readonly reason: string });

/** The raw answer of one rater call (before the verdict parser), for requests with another schema (FE). */
export type RaterCompletion =
  | (OutcomeBase & { readonly status: 'ok'; readonly content: string; readonly usage: { readonly inputTokens: number; readonly outputTokens: number } })
  | (OutcomeBase & { readonly status: 'error'; readonly code: string; readonly message: string })
  | (OutcomeBase & { readonly status: 'skipped'; readonly reason: string });

/** A neural rater of one vendor. `rate` and `complete` never throw. */
export interface NeuralRater {
  readonly id: string;
  readonly vendor: RaterVendor;
  readonly model: string;
  rate(request: RaterRequest): Promise<RaterOutcome>;
  /** The raw answer, for callers that parse another schema (filter-and-explain). */
  complete(request: RaterRequest): Promise<RaterCompletion>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The verdict in a provider answer: a Claude CLI envelope (its structured output, after the model check) or the
 * first JSON object of a text answer (agy, Gemini, mock). Same strict parser as the judge (BR-U4-VRD-02..06).
 */
export function verdictOfAnswer(content: string, requestedModel: string): VerdictParseOutcome | { readonly kind: 'invalid'; readonly cause: 'MODEL_MISMATCH'; readonly detail: string } {
  const envelope = parseEnvelope(content);
  if (envelope !== null && (STRUCTURED_OUTPUT_FIELD in envelope || (envelope as Record<string, unknown>).type === 'result')) {
    if (resolveActualModel(envelope, requestedModel).kind === 'mismatch') {
      return { kind: 'invalid', cause: 'MODEL_MISMATCH', detail: 'the envelope names another model' };
    }
    return parseEnvelopeVerdict(envelope);
  }
  return parseVerdictText(content);
}

/** Adapter from an `LLMProvider` to a `NeuralRater`. */
export class ProviderRater implements NeuralRater {
  readonly model: string;
  private readonly secrets: readonly string[];

  constructor(
    readonly id: string,
    readonly vendor: RaterVendor,
    private readonly provider: LLMProvider,
    options: { readonly model?: string; readonly env?: NodeJS.ProcessEnv; readonly now?: () => number } = {},
  ) {
    this.model = options.model ?? provider.describe().model;
    this.secrets = knownSecretsFrom(options.env ?? process.env);
    this.now = options.now ?? Date.now;
  }

  private readonly now: () => number;

  async complete(request: RaterRequest): Promise<RaterCompletion> {
    const base = { rater: this.id, vendor: this.vendor, model: this.model };
    const started = this.now();
    const options: LLMOptions = { ...request.options, model: this.model };
    try {
      const result = await this.provider.evaluate(request.prompt, options, {
        runIndex: 0, repetition: 0, functionId: request.functionId,
        ...(request.unitId !== undefined ? { unitId: request.unitId } : {}),
        ...(request.systemPrompt !== undefined ? { systemPrompt: request.systemPrompt } : {}),
        responseSchema: request.responseSchema,
      });
      const durationMs = this.now() - started;
      if (!result.success) {
        const e = result.errors[0];
        return { ...base, durationMs, status: 'error', code: e?.code ?? 'LLM_CALL_FAILED', message: scrubSecrets(e?.message ?? '', this.secrets) };
      }
      return { ...base, model: result.data.model, durationMs, status: 'ok', content: result.data.content, usage: result.data.usage };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ...base, durationMs: this.now() - started, status: 'error', code: 'LLM_CALL_FAILED', message: scrubSecrets(message, this.secrets) };
    }
  }

  async rate(request: RaterRequest): Promise<RaterOutcome> {
    return outcomeOfCompletion(await this.complete(request), this.model);
  }
}

/** A completion read as a verdict (the strict judge parser). */
export function outcomeOfCompletion(c: RaterCompletion, requestedModel: string): RaterOutcome {
  if (c.status !== 'ok') return c;
  const { content, usage, status: _ok, ...base } = c;
  const parsed = verdictOfAnswer(content, requestedModel);
  if (parsed.kind !== 'valid') return { ...base, status: 'invalid', cause: parsed.cause };
  return { ...base, status: 'valid', verdict: parsed.verdict, usage };
}

/** A rater that is configured off: every request is skipped with the reason (e.g. no API key). */
export class SkippedRater implements NeuralRater {
  constructor(readonly id: string, readonly vendor: RaterVendor, readonly model: string, private readonly reason: string) {}

  rate(): Promise<RaterOutcome> {
    return Promise.resolve({ rater: this.id, vendor: this.vendor, model: this.model, durationMs: 0, status: 'skipped', reason: this.reason });
  }

  complete(): Promise<RaterCompletion> {
    return Promise.resolve({ rater: this.id, vendor: this.vendor, model: this.model, durationMs: 0, status: 'skipped', reason: this.reason });
  }
}

// ── Budget (Gemini API) ──────────────────────────────────────────────────────────────────

/** The dollar ceiling no configuration can raise (the Gemini API rater is billed per token). */
export const GEMINI_HARD_USD_CEILING = 5;

export interface SpendCap {
  /** Maximum number of calls. */
  readonly maxCalls: number;
  /** Maximum input plus output tokens. */
  readonly maxTokens: number;
  /** Dollar ceiling; clamped to `GEMINI_HARD_USD_CEILING`. */
  readonly maxUsd: number;
  /** Price per million input and output tokens, used for the pre-call estimate and the ledger. */
  readonly usdPerMInput: number;
  readonly usdPerMOutput: number;
}

/**
 * Default cap of the Gemini API rater: 200 calls, 2M tokens, $5. The prices are deliberately pessimistic (above
 * current list prices of the Pro tier) so the ledger overestimates spend; set the real ones with the CLI flags.
 */
export const DEFAULT_GEMINI_CAP: SpendCap = Object.freeze({
  maxCalls: 200, maxTokens: 2_000_000, maxUsd: GEMINI_HARD_USD_CEILING, usdPerMInput: 5, usdPerMOutput: 30,
});

export interface SpendState {
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly usd: number;
}

const ZERO_SPEND: SpendState = Object.freeze({ calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 });

function plus(a: SpendState, calls: number, inputTokens: number, outputTokens: number, usd: number): SpendState {
  return { calls: a.calls + calls, inputTokens: a.inputTokens + inputTokens, outputTokens: a.outputTokens + outputTokens, usd: a.usd + usd };
}

/** A worst-case amount held against the caps while a call is in flight. */
export interface SpendReservation {
  /** Releases the hold and charges what the call actually used. Only the first settle or release has an effect. */
  settle(inputTokens: number, outputTokens: number, usd: number): void;
  /** Releases the hold without a charge (the call was never made). */
  release(): void;
}

/**
 * Spend so far, in memory or in a JSON file (so the cap holds across server restarts). A missing file is a fresh
 * ledger; an unreadable or malformed one is an error, never a reset to zero. The file is replaced atomically (temp
 * file plus rename), so a crash mid-write leaves the previous ledger. Calls in flight hold a reservation, so
 * concurrent calls cannot all pass the same check.
 */
export class SpendLedger {
  private state: SpendState;
  private held: SpendState = ZERO_SPEND;

  constructor(private readonly file?: string) {
    this.state = file !== undefined ? readLedger(file) : ZERO_SPEND;
  }

  /** Settled spend. */
  get spent(): SpendState {
    return this.state;
  }

  /** Settled spend plus the reservations of calls in flight: what the caps are checked against. */
  get committed(): SpendState {
    return plus(this.state, this.held.calls, this.held.inputTokens, this.held.outputTokens, this.held.usd);
  }

  add(inputTokens: number, outputTokens: number, usd: number): void {
    this.state = plus(this.state, 1, inputTokens, outputTokens, usd);
    if (this.file !== undefined) writeLedger(this.file, this.state);
  }

  reserve(inputTokens: number, outputTokens: number, usd: number): SpendReservation {
    this.held = plus(this.held, 1, inputTokens, outputTokens, usd);
    let open = true;
    const release = (): boolean => {
      if (!open) return false;
      open = false;
      this.held = plus(this.held, -1, -inputTokens, -outputTokens, -usd);
      return true;
    };
    return {
      settle: (inTok, outTok, spent) => {
        if (release()) this.add(inTok, outTok, spent);
      },
      release: () => {
        release();
      },
    };
  }
}

function readLedger(file: string): SpendState {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (isRecord(e) && e.code === 'ENOENT') return ZERO_SPEND;
    throw new Error(`Cannot read the spend ledger ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error(`The spend ledger ${file} is not valid JSON (truncated?); fix or remove it by hand`);
  }
  if (isRecord(v) && typeof v.calls === 'number' && typeof v.inputTokens === 'number' && typeof v.outputTokens === 'number' && typeof v.usd === 'number') {
    return { calls: v.calls, inputTokens: v.inputTokens, outputTokens: v.outputTokens, usd: v.usd };
  }
  throw new Error(`The spend ledger ${file} does not hold calls, inputTokens, outputTokens and usd numbers`);
}

function writeLedger(file: string, state: SpendState): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${String(process.pid)}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

function estimateInputTokens(request: RaterRequest): number {
  return Math.ceil((request.prompt.length + (request.systemPrompt?.length ?? 0)) / 4);
}

export function costUsd(cap: SpendCap, inputTokens: number, outputTokens: number): number {
  return (inputTokens * cap.usdPerMInput + outputTokens * cap.usdPerMOutput) / 1_000_000;
}

/** The cap with its dollar ceiling clamped to the hard ceiling and no negative limit. */
export function effectiveCap(cap: SpendCap): SpendCap {
  return {
    ...cap,
    maxCalls: Math.max(0, cap.maxCalls),
    maxTokens: Math.max(0, cap.maxTokens),
    maxUsd: Math.min(Math.max(0, cap.maxUsd), GEMINI_HARD_USD_CEILING),
  };
}

/**
 * A rater behind a hard cap. Before each call the worst case is estimated (prompt and persona at 4 characters per
 * token, plus the full `maxTokens` of output) and the call is skipped when it could cross any limit. After the call
 * the reported usage (or the estimate, when none is reported) is added to the ledger.
 */
export class BudgetedRater implements NeuralRater {
  readonly id: string;
  readonly vendor: RaterVendor;
  readonly model: string;
  private readonly cap: SpendCap;

  constructor(private readonly inner: NeuralRater, cap: SpendCap, private readonly ledger: SpendLedger = new SpendLedger()) {
    this.id = inner.id;
    this.vendor = inner.vendor;
    this.model = inner.model;
    this.cap = effectiveCap(cap);
  }

  /** Why the next call of this size is refused, or `null` when it fits. Calls in flight count at their worst case. */
  refusal(request: RaterRequest): string | null {
    const s = this.ledger.committed;
    const input = estimateInputTokens(request);
    const output = request.options.maxTokens;
    if (s.calls + 1 > this.cap.maxCalls) return `call cap reached (${String(s.calls)}/${String(this.cap.maxCalls)})`;
    if (s.inputTokens + s.outputTokens + input + output > this.cap.maxTokens) return `token cap would be crossed (${String(s.inputTokens + s.outputTokens)} used, ${String(input + output)} needed, cap ${String(this.cap.maxTokens)})`;
    const usd = s.usd + costUsd(this.cap, input, output);
    if (usd > this.cap.maxUsd) return `dollar ceiling would be crossed ($${s.usd.toFixed(4)} spent, up to $${usd.toFixed(4)} after this call, ceiling $${this.cap.maxUsd.toFixed(2)})`;
    return null;
  }

  async complete(request: RaterRequest): Promise<RaterCompletion> {
    const refused = this.refusal(request);
    if (refused !== null) {
      return { rater: this.id, vendor: this.vendor, model: this.model, durationMs: 0, status: 'skipped', reason: `BUDGET_EXHAUSTED: ${refused}` };
    }
    // The worst case is held before the await and settled after it, so concurrent calls see each other.
    const worstIn = estimateInputTokens(request);
    const worstOut = request.options.maxTokens;
    const reservation = this.ledger.reserve(worstIn, worstOut, costUsd(this.cap, worstIn, worstOut));
    let out: RaterCompletion;
    try {
      out = await this.inner.complete(request);
    } catch (e) {
      // A call that threw may still have been billed: it is charged at the worst case.
      reservation.settle(worstIn, worstOut, costUsd(this.cap, worstIn, worstOut));
      throw e;
    }
    if (out.status === 'skipped') {
      reservation.release();
      return out;
    }
    // A failed call may still have been billed: it is charged at the worst-case estimate.
    const used = out.status === 'ok' ? out.usage : { inputTokens: worstIn, outputTokens: worstOut };
    reservation.settle(used.inputTokens, used.outputTokens, costUsd(this.cap, used.inputTokens, used.outputTokens));
    return out;
  }

  async rate(request: RaterRequest): Promise<RaterOutcome> {
    return outcomeOfCompletion(await this.complete(request), this.model);
  }
}

// ── Adapters ─────────────────────────────────────────────────────────────────────────────

/** Default `agy` model of the ensemble (the Google subscription route); override with the config. */
export const ENSEMBLE_AGY_MODEL = 'Gemini 4 Argon (High)';

export interface ClaudeRaterConfig {
  readonly binary?: string;
  readonly model?: string;
  /** Isolated Claude config dir (default `~/.firewall/judge-claude-config`, the judge's). */
  readonly configDir?: string;
  readonly projectRoot?: string;
}

export interface CliRaterDeps {
  readonly runner: ProcessRunner;
  readonly parentEnv?: NodeJS.ProcessEnv;
  readonly home?: string;
}

/** The Claude CLI rater: the judge's isolated route (`ClaudeCliProvider`: config dir, env allow-list, pre-flight). */
export function claudeCliRater(config: ClaudeRaterConfig, deps: CliRaterDeps): NeuralRater {
  const model = config.model ?? JUDGE_MODEL;
  const provider = new ClaudeCliProvider(
    {
      binary: config.binary ?? 'claude',
      model,
      effort: JUDGE_EFFORT,
      timeoutMs: JUDGE_TIMEOUT_MS,
      judgeConfigDir: expandHome(config.configDir ?? JUDGE_CONFIG_DIR_DEFAULT, deps.home ?? os.homedir()),
      mode: 'record',
      ...(config.projectRoot !== undefined ? { projectRoot: config.projectRoot } : {}),
    },
    { runner: deps.runner, ...(deps.parentEnv !== undefined ? { parentEnv: deps.parentEnv } : {}) },
  );
  return new ProviderRater('claude-cli', 'claude-cli', provider, { model, ...(deps.parentEnv !== undefined ? { env: deps.parentEnv } : {}) });
}

export interface AgyRaterConfig {
  readonly binary?: string;
  readonly model?: string;
  /** Dedicated agy home (default `~/.firewall/labeller-agy-home`). */
  readonly home?: string;
}

/**
 * The Antigravity CLI rater (`HOME=<dedicated home> agy -p ... --model <model>` with the labeller's isolation:
 * `AgyCliProvider`). The model defaults to `ENSEMBLE_AGY_MODEL`.
 */
export function agyRater(config: AgyRaterConfig, deps: CliRaterDeps): NeuralRater {
  const model = config.model ?? ENSEMBLE_AGY_MODEL;
  const provider = new AgyCliProvider(
    { binary: config.binary ?? 'agy', model, home: expandHome(config.home ?? AGY_HOME_DEFAULT, deps.home ?? os.homedir()), mode: 'record' },
    { runner: deps.runner, ...(deps.parentEnv !== undefined ? { parentEnv: deps.parentEnv } : {}) },
  );
  return new ProviderRater('agy', 'agy', provider, { model, ...(deps.parentEnv !== undefined ? { env: deps.parentEnv } : {}) });
}

export interface GeminiRaterConfig {
  /** Pinned model id; there is no default (VRD-09). Without one the rater is skipped. */
  readonly model?: string;
  /** Environment variable holding the key (default `GEMINI_API_KEY`). The key is never read from a file. */
  readonly apiKeyEnv?: string;
  readonly cap?: Partial<SpendCap>;
  /** JSON file the spend ledger persists in; in memory when absent. */
  readonly ledgerFile?: string;
}

export interface GeminiRaterDeps {
  readonly env: NodeJS.ProcessEnv;
  /** Builds the provider from the key and model (default: `GeminiProvider`, loaded lazily). Tests inject a stub. */
  readonly makeProvider?: (apiKey: string, model: string) => LLMProvider;
}

/** `GeminiProvider` loaded on the first call, so the SDK is not imported unless the rater is used. */
class LazyGeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  private inner: Promise<LLMProvider> | undefined;

  constructor(private readonly apiKey: string, private readonly model: string) {}

  describe(): { readonly provider: 'gemini'; readonly model: string } {
    return { provider: 'gemini', model: this.model };
  }

  async evaluate(prompt: string, options: LLMOptions, call?: Parameters<LLMProvider['evaluate']>[2]): ReturnType<LLMProvider['evaluate']> {
    this.inner ??= import('./gemini-provider.js').then(({ GeminiProvider }) => new GeminiProvider({ apiKey: this.apiKey, model: this.model, temperature: 0, maxTokens: 4096 }));
    return (await this.inner).evaluate(prompt, options, call);
  }
}

/** The Gemini API rater behind `BudgetedRater`; skipped when the key or the model is missing. */
export function geminiApiRater(config: GeminiRaterConfig, deps: GeminiRaterDeps): NeuralRater {
  const keyName = config.apiKeyEnv ?? 'GEMINI_API_KEY';
  const apiKey = deps.env[keyName];
  const model = config.model ?? '';
  if (model === '') return new SkippedRater('gemini-api', 'gemini-api', '(none)', 'NOT_CONFIGURED: no Gemini model id (--gemini-model)');
  if (apiKey === undefined || apiKey === '') return new SkippedRater('gemini-api', 'gemini-api', model, `NOT_CONFIGURED: ${keyName} is not set`);
  const provider = deps.makeProvider !== undefined ? deps.makeProvider(apiKey, model) : new LazyGeminiProvider(apiKey, model);
  const cap: SpendCap = { ...DEFAULT_GEMINI_CAP, ...config.cap };
  return new BudgetedRater(new ProviderRater('gemini-api', 'gemini-api', provider, { model, env: deps.env }), cap, new SpendLedger(config.ledgerFile));
}

// ── Combination ──────────────────────────────────────────────────────────────────────────

export type CombinationRule = 'fail-if-both' | 'fail-if-either';
export const COMBINATION_RULES: readonly CombinationRule[] = ['fail-if-both', 'fail-if-either'];

export interface EnsembleVerdict {
  readonly rule: CombinationRule;
  /** `decided` when at least `minValid` raters answered validly; `degraded` when fewer did; `no-valid-rater` when none. */
  readonly status: 'decided' | 'degraded' | 'no-valid-rater';
  /** `null` only when no rater answered validly. */
  readonly pass: boolean | null;
  /** In [0, 1]: mean confidence of the raters that support the outcome x their share of the valid raters x coverage. */
  readonly confidence: number;
  readonly agreement: 'unanimous' | 'split' | 'none';
  readonly validRaters: number;
  readonly totalRaters: number;
  /** The combined verdict in the judge's shape (violations of the failing raters, de-duplicated). */
  readonly verdict: CriticVerdict | null;
  readonly raters: readonly RaterOutcome[];
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/**
 * Combines the rater outcomes. With n valid raters of t configured and f of them failing:
 * - `fail-if-either`: the unit fails when f >= 1;
 * - `fail-if-both`: the unit fails when f == n (every valid rater fails; with two raters, both).
 * Confidence = mean confidence of the supporting raters x (supporters / n) x (n / t): a split vote or a missing rater
 * lowers it. Fewer than `minValid` valid raters gives `degraded` (the rule still applies to those that answered).
 */
export function combineVerdicts(outcomes: readonly RaterOutcome[], rule: CombinationRule, minValid = 2): EnsembleVerdict {
  const valid = outcomes.flatMap((o) => (o.status === 'valid' ? [o] : []));
  const n = valid.length;
  const t = outcomes.length;
  if (n === 0) {
    return { rule, status: 'no-valid-rater', pass: null, confidence: 0, agreement: 'none', validRaters: 0, totalRaters: t, verdict: null, raters: outcomes };
  }
  const failing = valid.filter((o) => !o.verdict.pass);
  const pass = rule === 'fail-if-either' ? failing.length === 0 : failing.length < n;
  const support = valid.filter((o) => o.verdict.pass === pass);
  const meanConfidence = support.reduce((s, o) => s + o.verdict.confidence, 0) / Math.max(1, support.length);
  const confidence = round3(meanConfidence * (support.length / n) * (n / Math.max(1, t)));
  const seen = new Set<string>();
  const violations: CriticViolation[] = [];
  for (const o of pass ? [] : failing) {
    for (const v of o.verdict.violations) {
      const key = `${v.filePath}\u0000${v.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        violations.push(v);
      }
    }
  }
  const verdict: CriticVerdict = {
    pass,
    confidence,
    reasoning: support.map((o) => `[${o.rater}] ${o.verdict.reasoning}`).join('\n'),
    evidence: [...new Set(support.flatMap((o) => o.verdict.evidence))],
    violations,
  };
  return {
    rule,
    status: n >= Math.min(minValid, t) ? 'decided' : 'degraded',
    pass,
    confidence,
    agreement: failing.length === 0 || failing.length === n ? 'unanimous' : 'split',
    validRaters: n,
    totalRaters: t,
    verdict,
    raters: outcomes,
  };
}

/** The ensemble: every rater on the same request, in parallel, then `combineVerdicts`. */
export class EnsembleRater {
  constructor(readonly raters: readonly NeuralRater[], readonly rule: CombinationRule, readonly minValid = 2) {}

  describe(): { readonly provider: 'ensemble'; readonly model: string } {
    return { provider: 'ensemble', model: `${this.rule}(${this.raters.map((r) => `${r.vendor}:${r.model}`).join(',')})` };
  }

  async rate(request: RaterRequest): Promise<EnsembleVerdict> {
    const outcomes = await Promise.all(this.raters.map((r) => r.rate(request)));
    return combineVerdicts(outcomes, this.rule, this.minValid);
  }
}
