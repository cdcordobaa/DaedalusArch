import type {
  LLMCallContext, LLMEffort, LLMOptions, LLMProvider, LLMResponse,
} from '../shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../shared/types/evaluation.js';
import type { VCRMode } from '../shared/types/llm-config.js';
import type { DomainWarning } from '../shared/errors/domain-result.js';
import { DomainResult } from '../shared/errors/domain-result.js';
import { scrubDeep, scrubSecrets } from '../shared/errors/scrub.js';
import { canonicalJSON, sha256Hex } from './canonical-json.js';
import { CASSETTE_SCHEMA_VERSION, JUDGE_PERSONA, JUDGE_RETRIES, KNOWN_SECRET_NAME_PATTERN } from './frozen.js';
import { VERDICT_SCHEMA_TEXT } from './verdict-schema.js';
import { parseVerdictText } from './verdict-parser.js';
import { readCassetteEntry, sortedJson, writeCassetteEntry } from './cassette-manager.js';
import type { CallOutcome, CassetteEntry, CriticVerdict, SourcePointer, StopCause } from './types.js';

/**
 * Content-addressed cassette decorator (BR-U4-CAS-01..09, 12, AGG-03; BLM §7; DE §3.5, §4.1).
 *
 * Every real provider is wrapped once per run. The key is
 * `${sha256(canonicalJSON(JudgeRequest))}-r${repetition}-${runIndex}`: no call ordinal, so
 * retries and resumption never shift other keys. `record` reuses any stored entry (valid or
 * invalid) and calls only on a miss; `replay` answers only from entries and stops with
 * `CASSETTE_MISS` on a miss. Stops are never recorded. The verdict is parsed from the
 * unscrubbed answer, then response and verdict pass through the same `scrubDeep`, and the
 * caller always receives the stored (scrubbed) verdict (CAS-07).
 */

// ── Request and key (CAS-01..03) ─────────────────────────────────────────────────────────

export type JudgeProvider = 'claude-cli' | 'gemini' | 'mock';

export interface JudgeRequest {
  readonly prompt: string;
  readonly systemPrompt: string;
  readonly schema: string;
  readonly provider: JudgeProvider;
  readonly model: string;
  readonly effort: LLMEffort | null;
  readonly maxTokens: number;
  readonly argvFlags: readonly string[];
}

export function requestHashOf(request: JudgeRequest): string {
  return sha256Hex(canonicalJSON(request));
}

export function cassetteKeyOf(requestHash: string, repetition: number, runIndex: number): string {
  return `${requestHash}-r${String(repetition)}-${String(runIndex)}`;
}

/** Providers that can expose the non-content argv flags hashed into the key (C14 at Step 19). */
export interface ArgvFlagSource {
  requestArgvFlags(options: LLMOptions, call: LLMCallContext): readonly string[];
}

function hasArgvFlags(provider: LLMProvider): provider is LLMProvider & ArgvFlagSource {
  return typeof (provider as Partial<ArgvFlagSource>).requestArgvFlags === 'function';
}

export function judgeProviderOf(description: ProviderDescription): JudgeProvider | null {
  const p = description.provider;
  return p === 'claude-cli' || p === 'gemini' || p === 'mock' ? p : null;
}

/** Builds the canonical request (DE §3.5): effort only for the CLI, flags only from the provider. */
export function buildJudgeRequest(
  provider: JudgeProvider,
  prompt: string,
  options: LLMOptions,
  call: LLMCallContext,
  argvFlags: readonly string[] = [],
): JudgeRequest {
  return {
    prompt,
    systemPrompt: call.systemPrompt ?? JUDGE_PERSONA,
    schema: call.responseSchema ?? VERDICT_SCHEMA_TEXT,
    provider,
    model: options.model,
    effort: provider === 'claude-cli' ? options.effort ?? null : null,
    maxTokens: options.maxTokens,
    argvFlags: provider === 'claude-cli' ? [...argvFlags].sort() : [],
  };
}

// ── Provider failure classification (OPS-03, OPS-05, CAS-04, CAS-06) ─────────────────────

/** Provider error codes and what the decorator does with them. */
export const PROVIDER_ERROR_CLASSES: Readonly<Record<string, { readonly kind: 'retry'; readonly cause: 'TIMEOUT' | 'CLI_EXIT' | 'BAD_ENVELOPE' } | { readonly kind: 'stop'; readonly stop: StopCause }>> = Object.freeze({
  LLM_CLI_TIMEOUT: { kind: 'retry', cause: 'TIMEOUT' },
  LLM_CLI_EXIT: { kind: 'retry', cause: 'CLI_EXIT' },
  LLM_CLI_BAD_ENVELOPE: { kind: 'retry', cause: 'BAD_ENVELOPE' },
  LLM_CLI_NOT_FOUND: { kind: 'stop', stop: 'CLI_NOT_FOUND' },
  LLM_NOT_CONFIGURED: { kind: 'stop', stop: 'CLI_NOT_FOUND' },
  LLM_USAGE_LIMIT: { kind: 'stop', stop: 'USAGE_LIMIT' },
  LLM_AUTH: { kind: 'stop', stop: 'AUTH' },
  LLM_CLI_ISOLATION: { kind: 'stop', stop: 'ISOLATION' },
  LLM_CLI_VERSION_DRIFT: { kind: 'stop', stop: 'CLI_VERSION' },
});

function classify(code: string | undefined): { readonly kind: 'retry'; readonly cause: 'TIMEOUT' | 'CLI_EXIT' | 'BAD_ENVELOPE' } | { readonly kind: 'stop'; readonly stop: StopCause } {
  return (code !== undefined ? PROVIDER_ERROR_CLASSES[code] : undefined) ?? { kind: 'retry', cause: 'CLI_EXIT' };
}

// ── Interpretation of a successful provider answer ───────────────────────────────────────

export interface Interpretation {
  readonly outcome: CallOutcome;
  readonly verdict: CriticVerdict | null;     // unscrubbed; set only for a valid outcome
  readonly resolvedModel?: string;
}

/** Turns a provider answer into an outcome; the CLI provider supplies its envelope reader (Step 19). */
export type ResponseInterpreter = (response: LLMResponse, request: JudgeRequest) => Interpretation;

/** Text answers (Gemini, Mock): strict text parse (BR-U4-VRD-02, VRD-03). */
export const interpretTextAnswer: ResponseInterpreter = (response) => {
  const parsed = parseVerdictText(response.content);
  return parsed.kind === 'valid'
    ? { outcome: { kind: 'valid' }, verdict: parsed.verdict, resolvedModel: response.model }
    : { outcome: { kind: 'invalid', cause: parsed.cause }, verdict: null, resolvedModel: response.model };
};

// ── Results ──────────────────────────────────────────────────────────────────────────────

export type JudgeCallResult =
  | {
    readonly kind: 'final';
    readonly key: string;
    readonly hit: boolean;
    readonly outcome: CallOutcome;
    readonly verdict: CriticVerdict | null;  // the stored, scrubbed verdict
    readonly entry: CassetteEntry;
    readonly warnings: readonly DomainWarning[];
  }
  | {
    readonly kind: 'stop';
    readonly key: string;
    readonly stop: StopCause;
    readonly message: string;                // scrubbed
    readonly missingKeys?: number;           // CASSETTE_MISS: distinct keys missed by this decorator so far
  };

export interface CassetteOptions {
  readonly mode: VCRMode;
  readonly dir: string;
  readonly omitPrompt?: boolean;             // CAS-09 (E7 corpus runs)
  readonly sourceProject?: { readonly projectId: string; readonly commitSha: string };
  readonly projectId?: string;
  readonly cliVersion?: string;              // provenance of this run (record: `claude --version`)
  readonly isolationProbeSha256?: string;
  readonly configListingSha256?: string;
  readonly knownSecrets?: readonly string[]; // default: knownSecretsFrom(process.env)
  readonly interpret?: ResponseInterpreter;  // default: interpretTextAnswer
  readonly now?: () => string;               // ISO timestamp source (tests)
}

/** CAS-07: values of parent-environment variables whose names look secret. */
export function knownSecretsFrom(env: NodeJS.ProcessEnv): string[] {
  const out: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && value !== '' && KNOWN_SECRET_NAME_PATTERN.test(name)) out.push(value);
  }
  return out.sort();
}

const DEFAULT_CALL: LLMCallContext = { runIndex: 0, repetition: 0, functionId: 'unknown' };

export class CassetteLLMProvider implements LLMProvider {
  readonly name = 'cassette';
  private readonly secrets: readonly string[];
  private readonly interpret: ResponseInterpreter;
  private readonly missing = new Set<string>();
  private readonly used = new Map<string, CassetteEntry>();

  constructor(private readonly inner: LLMProvider, private readonly options: CassetteOptions) {
    this.secrets = options.knownSecrets ?? knownSecretsFrom(process.env);
    this.interpret = options.interpret ?? interpretTextAnswer;
  }

  get mode(): VCRMode {
    return this.options.mode;
  }

  get dir(): string {
    return this.options.dir;
  }

  /** The wrapped provider (wrapping happens once, in `createJudgeProvider` or the critic). */
  get innerProvider(): LLMProvider {
    return this.inner;
  }

  describe(): ProviderDescription {
    return this.inner.describe();
  }

  /** Entries answered or written by this decorator, by key (provenance in replay, CAS-10). */
  entriesUsed(): readonly CassetteEntry[] {
    return [...this.used.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  /** Distinct keys missed in replay so far (the count carried by `CASSETTE_MISS`, CAS-05/CAS-11). */
  missingKeyCount(): number {
    return this.missing.size;
  }

  /** The request and key of a call, without any I/O (resume manifests, tests). */
  keyOf(prompt: string, options: LLMOptions, call: LLMCallContext): { readonly request: JudgeRequest; readonly key: string } | null {
    const provider = judgeProviderOf(this.inner.describe());
    if (provider === null) return null;
    const flags = hasArgvFlags(this.inner) ? this.inner.requestArgvFlags(options, call) : [];
    const request = buildJudgeRequest(provider, prompt, options, call, flags);
    return { request, key: cassetteKeyOf(requestHashOf(request), call.repetition, call.runIndex) };
  }

  async judge(
    prompt: string,
    options: LLMOptions,
    call: LLMCallContext,
    unitPaths: readonly string[] = [],
  ): Promise<JudgeCallResult> {
    const keyed = this.keyOf(prompt, options, call);
    if (keyed === null) {
      return { kind: 'stop', key: '', stop: 'CLI_NOT_FOUND', message: `Provider ${this.inner.describe().provider} cannot judge` };
    }
    const { request, key } = keyed;
    const stored = readCassetteEntry(this.options.dir, key);
    if (stored !== null) {
      this.used.set(key, stored);
      const warnings: DomainWarning[] = [];
      if (this.options.mode === 'replay' && this.options.cliVersion !== undefined && stored.cliVersion !== undefined
        && stored.cliVersion !== this.options.cliVersion) {
        warnings.push({
          code: 'CLI_VERSION_DRIFT',
          message: `Cassette ${key} was recorded with CLI ${stored.cliVersion}; this run reports ${this.options.cliVersion}`,
          context: { key, recorded: stored.cliVersion, current: this.options.cliVersion },
        });
      }
      return { kind: 'final', key, hit: true, outcome: stored.outcome, verdict: stored.parsedVerdict, entry: stored, warnings };
    }
    if (this.options.mode === 'replay') {
      this.missing.add(key);
      return {
        kind: 'stop', key, stop: 'CASSETTE_MISS', missingKeys: this.missing.size,
        message: `Cassette miss for ${call.functionId}${call.unitId === undefined ? '' : ` / ${call.unitId}`} run ${String(call.runIndex)}: ${String(this.missing.size)} missing key(s)`,
      };
    }
    return this.record(request, key, options, call, unitPaths);
  }

  private async record(
    request: JudgeRequest,
    key: string,
    options: LLMOptions,
    call: LLMCallContext,
    unitPaths: readonly string[],
  ): Promise<JudgeCallResult> {
    const started = Date.now();
    let attempts: 1 | 2 = 1;
    let response: LLMResponse | null = null;
    let interpretation: Interpretation | null = null;
    let failureText = '';
    for (let attempt = 1; attempt <= 1 + JUDGE_RETRIES; attempt++) {
      attempts = attempt === 1 ? 1 : 2;
      const result = await this.inner.evaluate(request.prompt, options, call);
      if (!result.success) {
        const error = result.errors[0];
        const cls = classify(error?.code);
        failureText = scrubSecrets(`${error?.code ?? 'LLM_CALL_FAILED'}: ${error?.message ?? ''}`, this.secrets);
        if (cls.kind === 'stop') {
          return { kind: 'stop', key, stop: cls.stop, message: failureText };
        }
        response = null;
        interpretation = { outcome: { kind: 'invalid', cause: cls.cause }, verdict: null };
        continue;
      }
      response = result.data;
      interpretation = this.interpret(result.data, request);
      const outcome = interpretation.outcome;
      if (outcome.kind === 'invalid' && outcome.cause === 'BAD_ENVELOPE') continue;
      break;
    }
    const final = interpretation ?? { outcome: { kind: 'invalid', cause: 'CLI_EXIT' } as const, verdict: null };
    // The caller receives exactly what replay will read: scrubbed, then normalised to the
    // stored form (sorted keys), so record and replay feed identical data (CAS-07).
    const built = this.buildEntry(request, key, call, options, response, final, attempts, failureText, started, unitPaths);
    const entry = JSON.parse(sortedJson(built)) as CassetteEntry;
    writeCassetteEntry(this.options.dir, entry);
    this.used.set(key, entry);
    return { kind: 'final', key, hit: false, outcome: entry.outcome, verdict: entry.parsedVerdict, entry, warnings: [] };
  }

  private buildEntry(
    request: JudgeRequest,
    key: string,
    call: LLMCallContext,
    options: LLMOptions,
    response: LLMResponse | null,
    interpretation: Interpretation,
    attempts: 1 | 2,
    failureText: string,
    started: number,
    unitPaths: readonly string[],
  ): CassetteEntry {
    const o = this.options;
    const usedOptions: Partial<LLMOptions> = response === null ? {} : { ...response.usedOptions };
    // Tolerates providers that omit the FR-31 fields (legacy test doubles).
    const ignored: unknown = response?.ignoredOptions;
    const ignoredOptions: (keyof LLMOptions)[] = Array.isArray(ignored) ? (ignored as (keyof LLMOptions)[]).slice() : [];
    const verdict = interpretation.outcome.kind === 'valid' ? interpretation.verdict : null;
    const entry: CassetteEntry = {
      schemaVersion: CASSETTE_SCHEMA_VERSION,
      key,
      requestHash: requestHashOf(request),
      repetition: call.repetition,
      runIndex: call.runIndex,
      functionId: call.functionId,
      ...(call.unitId !== undefined ? { unitId: call.unitId } : {}),
      ...(o.projectId !== undefined ? { projectId: o.projectId } : {}),
      provider: request.provider,
      model: options.model,
      ...(interpretation.resolvedModel !== undefined ? { resolvedModel: interpretation.resolvedModel } : {}),
      effort: request.effort,
      ...(o.cliVersion !== undefined ? { cliVersion: o.cliVersion } : {}),
      ...(o.isolationProbeSha256 !== undefined ? { isolationProbeSha256: o.isolationProbeSha256 } : {}),
      ...(o.configListingSha256 !== undefined ? { configListingSha256: o.configListingSha256 } : {}),
      usedOptions,
      ignoredOptions,
      attempts,
      outcome: interpretation.outcome,
      ...(o.omitPrompt === true ? {} : { prompt: request.prompt }),
      ...(o.omitPrompt === true && o.sourceProject !== undefined
        ? { sourcePointer: { ...o.sourceProject, unitPaths: [...unitPaths].sort() } satisfies SourcePointer }
        : {}),
      response: response === null ? failureText : response.content,
      parsedVerdict: verdict,
      usage: response === null ? { inputTokens: 0, outputTokens: 0 } : { ...response.usage },
      durationMs: Date.now() - started,
      recordedAt: (o.now ?? ((): string => new Date().toISOString()))(),
    };
    return scrubDeep(entry, this.secrets);
  }

  /** Port form (OI-U4-3): the stored answer of a valid call; anything else is a failure. */
  async evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    const result = await this.judge(prompt, options, call ?? DEFAULT_CALL);
    if (result.kind === 'stop') {
      return DomainResult.fail([{ code: `LLM_STOP_${result.stop}`, message: result.message }]);
    }
    if (result.outcome.kind === 'invalid') {
      return DomainResult.fail([{ code: 'LLM_CALL_INVALID', message: `${result.key}: ${result.outcome.cause}` }]);
    }
    const e = result.entry;
    return DomainResult.ok({
      content: e.response,
      model: e.resolvedModel ?? e.model,
      usage: e.usage,
      usedOptions: e.usedOptions,
      ignoredOptions: e.ignoredOptions,
    });
  }
}
