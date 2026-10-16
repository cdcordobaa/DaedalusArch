/**
 * v1.3 meaningful labeller: pluggable providers and the record/replay cassette store.
 *
 * - **codex**: Codex CLI (`codex exec`, a GPT model), read-only sandbox, web search and the shell, plugin, browser
 *   and multi-agent features off (the generator arm's `CODEX_DISABLED_FEATURES` plus `CODEX_SHELL_FEATURES`), user
 *   config and rules ignored, a fresh empty cwd outside any repository, the generator arm's child environment
 *   (`buildCodexChildEnv`: API keys removed, the dedicated `CODEX_HOME` login only). Any completed item other than the
 *   answer or reasoning is a tool step and fails the call closed (`LABEL_TOOL_USE`).
 * - **gemini**: the Gemini API through U4's `GeminiProvider`: no tools, temperature 0, the response schema as
 *   `responseSchema`. The key comes from `GEMINI_API_KEY` and is never logged: it is scrubbed from every error and
 *   cassette.
 * - **mock**: deterministic answers for tests and dry runs.
 *
 * Cassettes: one JSON file per call at `<dir>/<key[0..2]>/<key>.json`, key = sha256 of the canonical request
 * (provider, model, system prompt, prompt, temperature, run index). `record` calls the provider on a miss and stores
 * the answer; `replay` never calls and fails on a miss (`CASSETTE_MISS`). Usage limits are never stored.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { canonicalJSON } from '../../../../src/llm-critic/canonical-json.js';
import { sortedJson, writeFileAtomic } from '../../../../src/llm-critic/cassette-manager.js';
import { GeminiProvider } from '../../../../src/llm-critic/gemini-provider.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import type { ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { CODEX_DISABLED_FEATURES, CODEX_SHELL_FEATURES, buildCodexChildEnv } from '../../../lib/generators/codex-cli.js';
import { parseJsonl } from '../../../lib/generators/codex-events.js';
import { RESPONSE_SCHEMA_TEXT } from './meaningful-prompt.js';

/** `claude-cli`, `openai-api` and `fake` are the model panel's (`scripts/v1.3/lib/panel/adapters.ts`). */
export type ProviderId = 'codex' | 'gemini' | 'mock' | 'claude-cli' | 'openai-api' | 'fake';
export const PROVIDER_IDS: readonly ProviderId[] = ['codex', 'gemini', 'mock'];
export const LABEL_TEMPERATURE = 0;

export interface ProviderRequest {
  readonly system: string;
  readonly prompt: string;
  readonly temperature: number;
}

export interface ProviderAnswer {
  readonly text: string;
  readonly servedModel: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/** `stop`: never cached, the run halts (usage limit, auth, isolation); `retry`: retried once, then recorded invalid. */
export class ProviderError extends Error {
  constructor(readonly code: string, message: string, readonly kind: 'stop' | 'retry') {
    super(message);
  }
}

export interface MeaningfulProvider {
  readonly id: ProviderId;
  readonly model: string;
  call(req: ProviderRequest): Promise<ProviderAnswer>;
}

export function scrub(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const s of secrets) if (s.length >= 8) out = out.split(s).join('[REDACTED]');
  return out;
}

// ── Gemini ──────────────────────────────────────────────────────────────────

export const GEMINI_KEY_ENV = 'GEMINI_API_KEY';
export const GEMINI_MAX_TOKENS = 8192;

export function geminiProvider(model: string, env: NodeJS.ProcessEnv = process.env): MeaningfulProvider {
  const apiKey = env[GEMINI_KEY_ENV] ?? '';
  if (apiKey === '') throw new ProviderError('LABEL_NO_KEY', `${GEMINI_KEY_ENV} is not set`, 'stop');
  const inner = new GeminiProvider({ apiKey, model, temperature: LABEL_TEMPERATURE, maxTokens: GEMINI_MAX_TOKENS });
  return {
    id: 'gemini', model,
    async call(req) {
      const r = await inner.evaluate(req.prompt, { model, maxTokens: GEMINI_MAX_TOKENS, temperature: req.temperature }, {
        runIndex: 0, repetition: 0, functionId: 'meaningful', systemPrompt: req.system, responseSchema: RESPONSE_SCHEMA_TEXT,
      });
      if (!r.success) {
        const e = r.errors[0];
        const msg = scrub(e?.message ?? 'Gemini call failed', [apiKey]);
        const code = e?.code ?? 'LLM_API_ERROR';
        throw new ProviderError(code, msg, code === 'LLM_USAGE_LIMIT' ? 'stop' : 'retry');
      }
      return { text: scrub(r.data.content, [apiKey]), servedModel: r.data.model, inputTokens: r.data.usage.inputTokens, outputTokens: r.data.usage.outputTokens };
    },
  };
}

// ── Codex CLI ───────────────────────────────────────────────────────────────

export interface CodexLabellerConfig {
  readonly model: string;
  /** Dedicated, logged-in `CODEX_HOME` (absolute, outside the repository). */
  readonly codexHome: string;
  /** Dedicated empty `HOME` for the child (absolute). */
  readonly userHome: string;
  readonly reasoningEffort?: string;
  readonly timeoutMs?: number;
  readonly binary?: string;
}

/** The labeller's `codex exec` argv (prompt on stdin): read-only sandbox, no web search, no shell. */
export function buildCodexLabelArgs(c: CodexLabellerConfig, cwd: string): readonly string[] {
  const args = [
    'exec', '--json', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules',
    '--sandbox', 'read-only',
    '-m', c.model, '-C', cwd,
    '-c', 'approval_policy="never"',
    '-c', 'web_search="disabled"',
    '-c', 'project_doc_max_bytes=0',
    '-c', 'project_root_markers=[]',
    '-c', 'skills.include_instructions=false',
    '-c', 'skills.bundled.enabled=false',
    '-c', 'include_apps_instructions=false',
    '-c', 'check_for_update_on_startup=false',
    '-c', 'history.persistence="none"',
    ...(c.reasoningEffort !== undefined ? ['-c', `model_reasoning_effort=${JSON.stringify(c.reasoningEffort)}`] : []),
  ];
  for (const f of [...CODEX_DISABLED_FEATURES, ...CODEX_SHELL_FEATURES]) args.push('--disable', f);
  args.push('-');
  return Object.freeze(args);
}

const CODEX_LIMIT = /usage limit|rate limit|quota|429/i;

/** The final answer of a `codex exec --json` run; a tool step or a failed turn throws. */
export function parseCodexAnswer(stdout: string): { text: string; model?: string; inputTokens?: number; outputTokens?: number } {
  const { records } = parseJsonl(stdout);
  let text: string | undefined;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  const errors: string[] = [];
  for (const e of records) {
    const t = typeof e.type === 'string' ? e.type : '';
    const item = typeof e.item === 'object' && e.item !== null && !Array.isArray(e.item) ? e.item as Record<string, unknown> : undefined;
    if (t === 'item.completed' && item !== undefined) {
      const it = typeof item.type === 'string' ? item.type : '';
      if (it === 'agent_message' && typeof item.text === 'string') text = item.text;
      else if (it === 'error' && typeof item.message === 'string') errors.push(item.message);
      else if (it !== 'reasoning') throw new ProviderError('LABEL_TOOL_USE', `codex completed a '${it}' step`, 'retry');
    } else if (t === 'turn.failed' || t === 'error') {
      const m = typeof e.message === 'string' ? e.message
        : typeof e.error === 'object' && e.error !== null && typeof (e.error as Record<string, unknown>).message === 'string' ? String((e.error as Record<string, unknown>).message) : t;
      errors.push(m);
    } else if (t === 'turn.completed' && typeof e.usage === 'object' && e.usage !== null) {
      const u = e.usage as Record<string, unknown>;
      if (typeof u.input_tokens === 'number') inputTokens = u.input_tokens;
      if (typeof u.output_tokens === 'number') outputTokens = u.output_tokens;
    }
  }
  if (errors.some((m) => CODEX_LIMIT.test(m))) throw new ProviderError('LLM_USAGE_LIMIT', errors.join('; '), 'stop');
  if (text === undefined) throw new ProviderError('LABEL_NO_ANSWER', errors.join('; ') || 'codex returned no answer', 'retry');
  return { text, ...(inputTokens !== undefined && { inputTokens }), ...(outputTokens !== undefined && { outputTokens }) };
}

export function codexProvider(c: CodexLabellerConfig, runner: ProcessRunner = new NodeProcessRunner(), env: NodeJS.ProcessEnv = process.env): MeaningfulProvider {
  for (const [k, v] of [['codexHome', c.codexHome], ['userHome', c.userHome]] as const) {
    if (!path.isAbsolute(v)) throw new ProviderError('LABEL_CONFIG', `${k} must be an absolute path`, 'stop');
  }
  return {
    id: 'codex', model: c.model,
    async call(req) {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-label-'));
      try {
        const r = await runner.run(c.binary ?? 'codex', buildCodexLabelArgs(c, cwd), {
          stdin: `${req.system}\n\n${req.prompt}`, cwd, timeoutMs: c.timeoutMs ?? 240_000,
          env: buildCodexChildEnv(env, { codexHome: c.codexHome, userHome: c.userHome }),
        });
        if (!r.success) throw new ProviderError('LABEL_SPAWN', r.errors[0]?.message ?? 'codex did not start', 'stop');
        if (r.data.timedOut) throw new ProviderError('LABEL_TIMEOUT', 'codex timed out', 'retry');
        const a = parseCodexAnswer(r.data.stdout);
        return {
          text: a.text, servedModel: c.model,
          ...(a.inputTokens !== undefined && { inputTokens: a.inputTokens }),
          ...(a.outputTokens !== undefined && { outputTokens: a.outputTokens }),
        };
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

// ── Mock ────────────────────────────────────────────────────────────────────

/** Answers the first option ("A") unless `answer` maps the prompt to another reply. */
export function mockProvider(answer: (req: ProviderRequest) => string = () => '{"choice":"A","reason":"mock"}', model = 'mock-1'): MeaningfulProvider {
  return { id: 'mock', model, call: (req) => Promise.resolve({ text: answer(req), servedModel: model }) };
}

// ── Cassettes ───────────────────────────────────────────────────────────────

export type CassetteMode = 'record' | 'replay';

export interface CassetteEntry {
  readonly key: string;
  readonly provider: ProviderId;
  readonly model: string;
  readonly runIndex: number;
  readonly itemKey: string;
  readonly request: ProviderRequest;
  readonly answer: ProviderAnswer;
  /** Retryable failures before the stored answer (codes only). */
  readonly failedAttempts: readonly string[];
}

export function cassetteKey(provider: ProviderId, model: string, req: ProviderRequest, runIndex: number): string {
  return createHash('sha256').update(canonicalJSON({ provider, model, runIndex, ...req })).digest('hex');
}

function cassettePath(dir: string, key: string): string {
  return path.join(dir, key.slice(0, 2), `${key}.json`);
}

export class CassetteStore {
  constructor(readonly dir: string, readonly mode: CassetteMode, private readonly secrets: readonly string[] = []) {}

  read(key: string): CassetteEntry | null {
    const p = cassettePath(this.dir, key);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) as CassetteEntry : null;
  }

  write(entry: CassetteEntry): void {
    writeFileAtomic(cassettePath(this.dir, entry.key), scrub(sortedJson(entry), this.secrets));
  }
}

export class CassetteMissError extends Error {
  readonly code = 'CASSETTE_MISS';
}

/**
 * One call through the cassette: replay answers from the store only; record answers from the store or calls the
 * provider (one retry on a retryable failure; a stop is thrown and nothing is stored).
 */
export async function cassetteCall(
  store: CassetteStore, provider: MeaningfulProvider, req: ProviderRequest, runIndex: number, itemKey: string,
): Promise<{ entry: CassetteEntry; fromCassette: boolean } | { failed: readonly string[]; key: string }> {
  const key = cassetteKey(provider.id, provider.model, req, runIndex);
  const hit = store.read(key);
  if (hit !== null) return { entry: hit, fromCassette: true };
  if (store.mode === 'replay') throw new CassetteMissError(`no cassette for ${itemKey} run ${String(runIndex)} (${key})`);
  const failed: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const answer = await provider.call(req);
      const entry: CassetteEntry = { key, provider: provider.id, model: provider.model, runIndex, itemKey, request: req, answer, failedAttempts: failed };
      store.write(entry);
      return { entry, fromCassette: false };
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'retry') {
        failed.push(e.code);
        continue;
      }
      throw e;
    }
  }
  return { failed, key };
}
