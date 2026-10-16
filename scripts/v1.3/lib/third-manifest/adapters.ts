/**
 * v1.3 third manifest: the writer adapters (Docs/v1.3/third-manifest.md §5). Every adapter answers one call with the
 * raw answer text; the runner parses it, retries once and stores it in the cassette.
 *
 * - **fake**: deterministic, with an oracle (the author manifest of the case) and a seeded, logged perturbation.
 *   Dry run and tests only; a real vendor never has the oracle.
 * - **gemini**: the Gemini API through U4's `GeminiProvider` (no tools, temperature 0, the frozen schema as
 *   `responseSchema`, the system prompt as `systemInstruction`). `GEMINI_API_KEY` from the environment or one line
 *   of an env file; scrubbed from every error.
 * - **agy**: the Antigravity CLI on the author's subscription, built from the v1.2 labeller route's pieces
 *   (`src/llm-critic/agy-cli-provider.ts`, not edited): stream-json, `--json-schema`, `--sandbox`,
 *   `--disable-slash-commands`, prompt on stdin, a fresh neutral cwd, an allow-listed child env with `HOME` set to
 *   the dedicated home and no API key. The pre-flight is the labeller's (home check, MCP and plugin listings) with
 *   a version pin the author may set to the version they run.
 * - **openai**: Chat Completions with the schema as a non-strict `json_schema` format (strict mode needs every
 *   property required) and no `tools` field; the strict parse after the call is the check.
 */
import * as fs from 'node:fs';
import type { ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import {
  AGY_BINARY_DEFAULT, AGY_PINNED_VERSION, AGY_PRINT_TIMEOUT_S, AGY_VERSION_TIMEOUT_MS, answerText, buildAgyArgs, buildAgyChildEnv,
  checkAgyHome, classifyAgyResult, composeAgyPrompt, createAgyNeutralCwd, parseAgyVersion,
} from '../../../../src/llm-critic/agy-cli-provider.js';
import { knownSecretsFrom } from '../../../../src/llm-critic/cassette-provider.js';
import { GeminiProvider } from '../../../../src/llm-critic/gemini-provider.js';
import { ProviderError, scrub } from '../labelling/providers.js';
import { OUTPUT_SCHEMA_TEXT } from './prompt.js';

export type AdapterId = 'fake' | 'gemini' | 'agy' | 'openai';
export const ADAPTER_IDS: readonly AdapterId[] = ['fake', 'gemini', 'agy', 'openai'];
export type Vendor = 'google' | 'openai' | 'none';

export interface WriterRequest {
  readonly system: string;
  readonly prompt: string;
  readonly caseId: string;
}

export interface WriterAnswer {
  readonly text: string;
  readonly servedModel: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export interface ManifestWriter {
  readonly id: AdapterId;
  readonly vendor: Vendor;
  readonly model: string;
  /** Facts recorded in run.json (CLI version, isolation hash); filled by `prepare`. */
  readonly facts: Record<string, string>;
  /** Pre-flight: no model call. A failure is a stop. */
  prepare(): Promise<void>;
  call(req: WriterRequest): Promise<WriterAnswer>;
}

// ── Key handling ────────────────────────────────────────────────────────────

/** Reads one variable from an env file (`NAME=value`, optional quotes). No other line is kept. */
export function readEnvVar(file: string, name: string): string | undefined {
  if (!fs.existsSync(file)) throw new ProviderError('TM_CONFIG', `env file ${file} does not exist`, 'stop');
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m?.[1] !== name) continue;
    const v = m[2] ?? '';
    return v.replace(/^(['"])(.*)\1$/, '$2');
  }
  return undefined;
}

// ── Budget guard (dollar routes) ────────────────────────────────────────────

export interface Prices {
  /** USD per million input tokens. */
  readonly inPerMTok: number;
  /** USD per million output tokens. */
  readonly outPerMTok: number;
}

export interface LedgerEntry { readonly caseId: string; readonly attempt: number; readonly inputTokens: number; readonly outputTokens: number; readonly usd: number; readonly worstCaseUsd: number }

/**
 * A spend cap: before each call the worst case (prompt chars / 3 input tokens, the full output cap) is added to the
 * spend so far; a call that would pass the cap is not made (`TM_BUDGET`, a stop). After the call the measured usage
 * replaces the worst case (or the worst case stays when the API reports none).
 */
export class Budget {
  readonly entries: LedgerEntry[] = [];
  constructor(readonly maxUsd: number, readonly prices: Prices, readonly maxOutputTokens: number) {
    if (!(maxUsd > 0) || !(prices.inPerMTok >= 0) || !(prices.outPerMTok >= 0)) throw new ProviderError('TM_CONFIG', 'budget needs --max-usd > 0 and both prices >= 0', 'stop');
  }

  spent(): number {
    return this.entries.reduce((s, e) => s + e.usd, 0);
  }

  worstCase(promptChars: number): number {
    return (Math.ceil(promptChars / 3) * this.prices.inPerMTok + this.maxOutputTokens * this.prices.outPerMTok) / 1e6;
  }

  admit(caseId: string, promptChars: number): void {
    const w = this.worstCase(promptChars);
    if (this.spent() + w > this.maxUsd) {
      throw new ProviderError('TM_BUDGET', `call for ${caseId} could cost up to $${w.toFixed(4)}; spent $${this.spent().toFixed(4)} of the $${this.maxUsd.toFixed(2)} cap`, 'stop');
    }
  }

  record(caseId: string, attempt: number, promptChars: number, a: { inputTokens?: number; outputTokens?: number } | null): void {
    const w = this.worstCase(promptChars);
    const usd = a?.inputTokens !== undefined && a.outputTokens !== undefined
      ? (a.inputTokens * this.prices.inPerMTok + a.outputTokens * this.prices.outPerMTok) / 1e6 : w;
    this.entries.push({ caseId, attempt, inputTokens: a?.inputTokens ?? -1, outputTokens: a?.outputTokens ?? -1, usd, worstCaseUsd: w });
  }
}

/** Wraps a dollar-route writer: admit before, record after (also on a failed call, at worst case). */
export function budgeted(inner: ManifestWriter, budget: Budget): ManifestWriter {
  let attempt = 0;
  return {
    id: inner.id, vendor: inner.vendor, model: inner.model, facts: inner.facts,
    prepare: () => inner.prepare(),
    async call(req) {
      const chars = req.system.length + req.prompt.length;
      budget.admit(req.caseId, chars);
      attempt += 1;
      try {
        const a = await inner.call(req);
        budget.record(req.caseId, attempt, chars, a);
        return a;
      } catch (e) {
        budget.record(req.caseId, attempt, chars, null);
        throw e;
      }
    },
  };
}

/** A cap on invocations (subscription routes, where no dollar figure exists). */
export function callCapped(inner: ManifestWriter, maxCalls: number): ManifestWriter {
  let calls = 0;
  return {
    id: inner.id, vendor: inner.vendor, model: inner.model, facts: inner.facts,
    prepare: () => inner.prepare(),
    call(req) {
      if (calls >= maxCalls) return Promise.reject(new ProviderError('TM_BUDGET', `--max-calls ${String(maxCalls)} reached`, 'stop'));
      calls += 1;
      return inner.call(req);
    },
  };
}

// ── Gemini API ──────────────────────────────────────────────────────────────

export const GEMINI_KEY_ENV = 'GEMINI_API_KEY';
export const TM_MAX_OUTPUT_TOKENS_DEFAULT = 32_768;

export interface GeminiWriterConfig {
  readonly model: string;
  readonly apiKey: string;
  readonly maxOutputTokens?: number;
  readonly thinkingLevel?: 'low' | 'high';
}

export function geminiWriter(c: GeminiWriterConfig): ManifestWriter {
  if (c.apiKey === '') throw new ProviderError('LABEL_NO_KEY', `${GEMINI_KEY_ENV} is not set`, 'stop');
  if (c.model === '') throw new ProviderError('TM_CONFIG', 'the gemini adapter needs --model (no default)', 'stop');
  const maxTokens = c.maxOutputTokens ?? TM_MAX_OUTPUT_TOKENS_DEFAULT;
  const inner = new GeminiProvider({ apiKey: c.apiKey, model: c.model, temperature: 0, maxTokens, ...(c.thinkingLevel !== undefined && { thinkingLevel: c.thinkingLevel }) });
  return {
    id: 'gemini', vendor: 'google', model: c.model, facts: { route: 'gemini-api', temperature: '0', maxOutputTokens: String(maxTokens), ...(c.thinkingLevel !== undefined && { thinkingLevel: c.thinkingLevel }) },
    prepare: () => Promise.resolve(),
    async call(req) {
      const r = await inner.evaluate(req.prompt, { model: c.model, maxTokens, temperature: 0 }, {
        runIndex: 0, repetition: 0, functionId: 'third-manifest', systemPrompt: req.system, responseSchema: OUTPUT_SCHEMA_TEXT,
      });
      if (!r.success) {
        const e = r.errors[0];
        const code = e?.code ?? 'LLM_API_ERROR';
        throw new ProviderError(code, scrub(e?.message ?? 'Gemini call failed', [c.apiKey]), code === 'LLM_USAGE_LIMIT' || code === 'LLM_AUTH' ? 'stop' : 'retry');
      }
      return { text: scrub(r.data.content, [c.apiKey]), servedModel: r.data.model, inputTokens: r.data.usage.inputTokens, outputTokens: r.data.usage.outputTokens };
    },
  };
}

// ── agy (Antigravity CLI, subscription) ─────────────────────────────────────

export const AGY_HOME_TM_DEFAULT = '~/.firewall/labeller-agy-home';

export interface AgyWriterConfig {
  /** The `--model` value as agy takes it, e.g. "Gemini 4 Argon (High)". */
  readonly model: string;
  /** The model id the stream-json init event must name (default: `model`). */
  readonly servedModel?: string;
  /** Absolute dedicated home (signed in, mode 700). */
  readonly home: string;
  readonly binary?: string;
  /** Version pin (default the labeller's AGY_PINNED_VERSION). */
  readonly version?: string;
  readonly printTimeoutS?: number;
}

const MCP_EMPTY = 'No MCP servers configured.';
const PLUGINS_EMPTY = 'No imported plugins.';

export function agyWriter(c: AgyWriterConfig, runner: ProcessRunner = new NodeProcessRunner(), parentEnv: NodeJS.ProcessEnv = process.env): ManifestWriter {
  if (!c.home.startsWith('/')) throw new ProviderError('TM_CONFIG', 'the agy home must be an absolute path', 'stop');
  if (c.model === '') throw new ProviderError('TM_CONFIG', 'the agy adapter needs --model', 'stop');
  const binary = c.binary ?? AGY_BINARY_DEFAULT;
  const pin = c.version ?? AGY_PINNED_VERSION;
  const served = c.servedModel ?? c.model;
  const printTimeoutS = c.printTimeoutS ?? AGY_PRINT_TIMEOUT_S;
  const secrets = knownSecretsFrom(parentEnv);
  const env = buildAgyChildEnv(parentEnv, c.home);
  const facts: Record<string, string> = { route: 'agy-cli', home: c.home, versionPin: pin, servedModelExpected: served };
  let prepared = false;
  const inNeutral = async <T>(f: (cwd: string) => Promise<T>): Promise<T> => {
    const cwd = createAgyNeutralCwd();
    if (!cwd.success) throw new ProviderError('LLM_CLI_ISOLATION', cwd.errors[0]?.message ?? 'no neutral cwd', 'stop');
    try { return await f(cwd.data); } finally { fs.rmSync(cwd.data, { recursive: true, force: true }); }
  };
  return {
    id: 'agy', vendor: 'google', model: c.model, facts,
    async prepare() {
      await inNeutral(async (cwd) => {
        const run = (args: readonly string[]): ReturnType<ProcessRunner['run']> => runner.run(binary, args, { cwd, env, timeoutMs: AGY_VERSION_TIMEOUT_MS, stdin: '' });
        const v = await run(['--version']);
        if (!v.success) throw new ProviderError('LLM_CLI_NOT_FOUND', scrub(v.errors[0]?.message ?? 'agy not found', secrets), 'stop');
        const found = v.data.exitCode === 0 ? parseAgyVersion(v.data.stdout) : null;
        if (found === null) throw new ProviderError('LLM_CLI_NOT_FOUND', 'agy --version printed no version', 'stop');
        if (found !== pin) throw new ProviderError('LLM_CLI_VERSION_DRIFT', `agy ${found} differs from the pin ${pin}; pass --agy-version ${found} to pin it`, 'stop');
        const home = checkAgyHome(c.home);
        if (home.problems.length > 0) throw new ProviderError('LLM_CLI_ISOLATION', `agy home fails: ${home.problems.join('; ')}`, 'stop');
        const mcp = await run(['mcp', 'list']);
        const plugins = await run(['plugin', 'list']);
        if (!mcp.success || mcp.data.stdout.trim() !== MCP_EMPTY) throw new ProviderError('LLM_CLI_ISOLATION', 'agy mcp list reports configured servers (or failed)', 'stop');
        if (!plugins.success || plugins.data.stdout.trim() !== PLUGINS_EMPTY) throw new ProviderError('LLM_CLI_ISOLATION', 'agy plugin list reports plugins (or failed)', 'stop');
        facts.cliVersion = found;
        facts.configListingSha256 = home.configListingSha256;
      });
      prepared = true;
    },
    async call(req) {
      if (!prepared) throw new ProviderError('LLM_CLI_ISOLATION', 'agy pre-flight has not run', 'stop');
      return inNeutral(async (cwd) => {
        const argv = buildAgyArgs({ binary, model: c.model, schema: OUTPUT_SCHEMA_TEXT, printTimeoutS });
        const r = await runner.run(argv.binary, argv.args, { stdin: composeAgyPrompt(req.prompt, req.system), cwd, env, timeoutMs: (printTimeoutS + 30) * 1000 });
        if (!r.success) throw new ProviderError('LLM_CLI_NOT_FOUND', scrub(r.errors[0]?.message ?? 'agy could not be started', secrets), 'stop');
        const { stream, error } = classifyAgyResult(r.data, served, secrets);
        if (error !== null || stream.result === null) {
          const code = error?.code ?? 'LLM_CLI_BAD_ENVELOPE';
          const stop = ['LLM_AUTH', 'LLM_USAGE_LIMIT', 'LLM_CLI_ISOLATION', 'LLM_NOT_CONFIGURED'].includes(code);
          throw new ProviderError(code, error?.message ?? 'agy printed no result event', stop ? 'stop' : 'retry');
        }
        const u = stream.result.usage ?? {};
        return { text: answerText(stream.result), servedModel: stream.init?.model ?? served, inputTokens: (u.input_tokens ?? 0) + (u.cache_read_tokens ?? 0), outputTokens: u.output_tokens ?? 0 };
      });
    },
  };
}

// ── OpenAI ──────────────────────────────────────────────────────────────────

export const OPENAI_KEY_ENV = 'OPENAI_API_KEY';
export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; text(): Promise<string> }>;

export function openAiWriter(model: string, apiKey: string, maxOutputTokens = TM_MAX_OUTPUT_TOKENS_DEFAULT, fetchImpl?: FetchLike): ManifestWriter {
  if (apiKey === '') throw new ProviderError('LABEL_NO_KEY', `${OPENAI_KEY_ENV} is not set`, 'stop');
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));
  return {
    id: 'openai', vendor: 'openai', model, facts: { route: 'openai-api', schemaMode: 'json_schema non-strict' },
    prepare: () => Promise.resolve(),
    async call(req) {
      const body = {
        model,
        messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.prompt }],
        response_format: { type: 'json_schema', json_schema: { name: 'third_manifest', strict: false, schema: JSON.parse(OUTPUT_SCHEMA_TEXT) as object } },
        max_completion_tokens: maxOutputTokens,
      };
      let status: number;
      let text: string;
      try {
        const r = await doFetch(OPENAI_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
        status = r.status;
        text = await r.text();
      } catch (e) {
        throw new ProviderError('LLM_API_ERROR', scrub(e instanceof Error ? e.message : String(e), [apiKey]), 'retry');
      }
      if (status === 401 || status === 403) throw new ProviderError('LLM_AUTH', `OpenAI answered ${String(status)}`, 'stop');
      if (status === 429) throw new ProviderError('LLM_USAGE_LIMIT', 'OpenAI answered 429', 'stop');
      if (status < 200 || status >= 300) throw new ProviderError('LLM_API_ERROR', scrub(`OpenAI answered ${String(status)}: ${text.slice(0, 300)}`, [apiKey]), 'retry');
      const parsed = JSON.parse(text) as { model?: string; choices?: { message?: { content?: string; tool_calls?: unknown[] } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      const msg = parsed.choices?.[0]?.message;
      if ((msg?.tool_calls?.length ?? 0) > 0) throw new ProviderError('LABEL_TOOL_USE', 'OpenAI answered with a tool call', 'retry');
      if (typeof msg?.content !== 'string') throw new ProviderError('LABEL_NO_ANSWER', 'OpenAI answer has no content', 'retry');
      return {
        text: scrub(msg.content, [apiKey]), servedModel: parsed.model ?? model,
        ...(parsed.usage?.prompt_tokens !== undefined && { inputTokens: parsed.usage.prompt_tokens }),
        ...(parsed.usage?.completion_tokens !== undefined && { outputTokens: parsed.usage.completion_tokens }),
      };
    },
  };
}

// ── Fake (dry run, tests) ───────────────────────────────────────────────────

export interface OracleFinding { readonly ruleId: string; readonly file: string; readonly target?: string; readonly tier: 'blocking' | 'advisory'; readonly reason: string }
export interface Oracle { readonly findings: readonly OracleFinding[]; readonly files: readonly { file: string; layer: string | null }[]; readonly aliasOf: (ruleId: string) => string | undefined }

export interface Perturbation { readonly caseId: string; readonly dropped: readonly string[]; readonly renamed: readonly string[]; readonly decoys: readonly string[] }

export const FAKE_DECOY_RULE = 'FF-C02';

/**
 * The dry-run fake: answers the oracle with a fixed, logged perturbation per case: the last finding is dropped when
 * the case has two or more, the first finding is named by its alias (a name `blind-rule-mapping.json` maps back) when
 * one exists, and one advisory decoy (`FF-C02` on the first source file) is added. `log` collects the perturbations.
 */
export function fakeWriter(oracleOf: (caseId: string) => Oracle, log: Perturbation[]): ManifestWriter {
  return {
    id: 'fake', vendor: 'none', model: 'fake-k-g', facts: { route: 'fake (oracle: the author manifest)' },
    prepare: () => Promise.resolve(),
    call(req) {
      const caseId = /\nCase (case-\d+)\. Style: /.exec(req.prompt)?.[1];
      if (caseId === undefined || caseId !== req.caseId) return Promise.reject(new ProviderError('TM_FAKE', 'prompt names no case', 'stop'));
      const o = oracleOf(caseId);
      const keep = o.findings.length >= 2 ? o.findings.slice(0, -1) : [...o.findings];
      const dropped = o.findings.length >= 2 ? [o.findings[o.findings.length - 1]] : [];
      const renamed: string[] = [];
      const findings = keep.map((f, i) => {
        const alias = i === 0 ? o.aliasOf(f.ruleId) : undefined;
        if (alias !== undefined) renamed.push(`${f.ruleId} -> ${alias}`);
        return { ruleId: alias ?? f.ruleId, file: f.file, target: f.target ?? null, tier: f.tier, reason: `fake: ${f.reason}`, confidence: 'high', alsoMatches: [] };
      });
      const firstFile = o.files[0]?.file ?? 'src/index.ts';
      findings.push({ ruleId: FAKE_DECOY_RULE, file: firstFile, target: null, tier: 'advisory', reason: 'fake decoy', confidence: 'low', alsoMatches: [] });
      log.push({ caseId, dropped: dropped.map((f) => `${f?.ruleId ?? ''}|${f?.file ?? ''}|${f?.target ?? ''}`), renamed, decoys: [`${FAKE_DECOY_RULE}|${firstFile}|`] });
      const verdict = findings.some((f) => f.tier === 'blocking') ? 'fail' : 'pass';
      const text = JSON.stringify({ verdict, expectedGraph: { files: o.files, edges: [] }, findings, nearMissOk: [] });
      return Promise.resolve({ text, servedModel: 'fake-k-g', inputTokens: Math.ceil(req.prompt.length / 4), outputTokens: Math.ceil(text.length / 4) });
    },
  };
}
