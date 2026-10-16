/**
 * v1.3 model panel: one adapter per vendor, all behind the meaningful labeller's `MeaningfulProvider` port, so the
 * cassette store, the retry rule and the answer parser are the labeller's (Docs/v1.3/model-panel.md §4).
 *
 * - **Google** (`gemini-api`): the labeller's `geminiProvider`: `GEMINI_API_KEY` from the environment, no tools,
 *   temperature 0, the shared schema as `responseSchema`. The key is scrubbed from every error and cassette.
 * - **OpenAI** (`openai-api`): Chat Completions over `fetch`, `OPENAI_API_KEY` from the environment, no `tools`
 *   field (so no tool can be called), the shared schema as a strict `json_schema` response format. Or (`codex-cli`):
 *   the labeller's `codexProvider` (read-only sandbox, web search and shell off, a dedicated `CODEX_HOME`).
 * - **Anthropic** (`claude-cli`): the judge's `ClaudeCliProvider` unchanged (pinned CLI version, a dedicated
 *   `CLAUDE_CONFIG_DIR` checked against the ADR-018 allow-list, allow-listed child environment, neutral cwd, `--tools ""`,
 *   the init-probe pre-flight), with the shared schema as `--json-schema`. The answer is the envelope's
 *   `structured_output` (else its `result` text); another model carrying the output is an error (VRD-07).
 * - **fake**: deterministic stubs for the dry run and the tests. A fake is given the truth of each item (an oracle
 *   the real vendors never have) and a fixed accuracy, so the statistics can be checked against a known answer.
 *
 * No adapter ever reads a credential file; keys come from the environment only and are never logged.
 */
import { createHash } from 'node:crypto';
import { ClaudeCliProvider, parseEnvelope, resolveActualModel } from '../../../../src/llm-critic/claude-cli-provider.js';
import { JUDGE_EFFORT } from '../../../../src/llm-critic/frozen.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import type { ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import type { LLMEffort, LLMProvider } from '../../../../src/shared/interfaces/llm-provider.js';
import { LETTERS, MEANINGFUL_OPTIONS, RESPONSE_SCHEMA_TEXT } from '../labelling/meaningful-prompt.js';
import type { MeaningfulLabel } from '../labelling/meaningful-prompt.js';
import { ProviderError, codexProvider, geminiProvider, scrub } from '../labelling/providers.js';
import type { CodexLabellerConfig, MeaningfulProvider, ProviderRequest } from '../labelling/providers.js';

export type Vendor = 'google' | 'openai' | 'anthropic';
export const VENDORS: readonly Vendor[] = ['google', 'openai', 'anthropic'];

export interface PanelRater {
  /** Rater name in every table (`<vendor>:<model>`). */
  readonly name: string;
  readonly vendor: Vendor;
  readonly provider: MeaningfulProvider;
}

export const rater = (vendor: Vendor, provider: MeaningfulProvider): PanelRater => ({ name: `${vendor}:${provider.model}`, vendor, provider });

// ── Google ──────────────────────────────────────────────────────────────────

export function geminiRater(model: string, env: NodeJS.ProcessEnv = process.env): PanelRater {
  return rater('google', geminiProvider(model, env));
}

// ── OpenAI ──────────────────────────────────────────────────────────────────

export const OPENAI_KEY_ENV = 'OPENAI_API_KEY';
export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
export const OPENAI_MAX_TOKENS = 4096;

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; text(): Promise<string> }>;

/** The request body: system + user message, the shared schema, no tools. Temperature is not sent (reasoning models fix it). */
export function openAiBody(model: string, req: ProviderRequest): Record<string, unknown> {
  return {
    model,
    messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.prompt }],
    response_format: { type: 'json_schema', json_schema: { name: 'panel_answer', strict: true, schema: { ...JSON.parse(RESPONSE_SCHEMA_TEXT) as object, additionalProperties: false } } },
    max_completion_tokens: OPENAI_MAX_TOKENS,
  };
}

export function openAiProvider(model: string, env: NodeJS.ProcessEnv = process.env, fetchImpl?: FetchLike): MeaningfulProvider {
  const key = env[OPENAI_KEY_ENV] ?? '';
  if (key === '') throw new ProviderError('LABEL_NO_KEY', `${OPENAI_KEY_ENV} is not set`, 'stop');
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));
  return {
    id: 'openai-api', model,
    async call(req) {
      let status: number;
      let text: string;
      try {
        const r = await doFetch(OPENAI_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify(openAiBody(model, req)),
        });
        status = r.status;
        text = await r.text();
      } catch (e) {
        throw new ProviderError('LLM_API_ERROR', scrub(e instanceof Error ? e.message : String(e), [key]), 'retry');
      }
      if (status === 401 || status === 403) throw new ProviderError('LLM_AUTH', `OpenAI answered ${String(status)}`, 'stop');
      if (status === 429) throw new ProviderError('LLM_USAGE_LIMIT', scrub(`OpenAI answered 429: ${text.slice(0, 300)}`, [key]), 'stop');
      if (status < 200 || status >= 300) throw new ProviderError('LLM_API_ERROR', scrub(`OpenAI answered ${String(status)}: ${text.slice(0, 300)}`, [key]), 'retry');
      let body: { model?: string; choices?: { message?: { content?: string; tool_calls?: unknown[] } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      try { body = JSON.parse(text) as typeof body; } catch { throw new ProviderError('LLM_API_ERROR', 'OpenAI answer is not JSON', 'retry'); }
      const msg = body.choices?.[0]?.message;
      if (msg?.tool_calls !== undefined && msg.tool_calls.length > 0) throw new ProviderError('LABEL_TOOL_USE', 'OpenAI answered with a tool call', 'retry');
      if (typeof msg?.content !== 'string') throw new ProviderError('LABEL_NO_ANSWER', 'OpenAI answer has no content', 'retry');
      return {
        text: scrub(msg.content, [key]), servedModel: body.model ?? model,
        ...(body.usage?.prompt_tokens !== undefined && { inputTokens: body.usage.prompt_tokens }),
        ...(body.usage?.completion_tokens !== undefined && { outputTokens: body.usage.completion_tokens }),
      };
    },
  };
}

export function openAiRater(model: string, env: NodeJS.ProcessEnv = process.env, fetchImpl?: FetchLike): PanelRater {
  return rater('openai', openAiProvider(model, env, fetchImpl));
}

export function codexRater(c: CodexLabellerConfig, runner?: ProcessRunner, env: NodeJS.ProcessEnv = process.env): PanelRater {
  return rater('openai', codexProvider(c, runner, env));
}

// ── Anthropic (the judge's isolated CLI route) ──────────────────────────────

export const PANEL_CLAUDE_CONFIG_DIR_DEFAULT = '~/.firewall/panel-claude-config';
export const PANEL_CLAUDE_MAX_TOKENS = 4096;
const CLAUDE_STOPS = new Set(['LLM_USAGE_LIMIT', 'LLM_AUTH', 'LLM_CLI_ISOLATION', 'LLM_CLI_VERSION_DRIFT', 'LLM_CLI_NOT_FOUND']);

/** Wraps an already constructed judge-route provider (the isolation set-up is the judge's own). */
export function claudeCliProvider(inner: LLMProvider, model: string, effort: LLMEffort = JUDGE_EFFORT): MeaningfulProvider {
  return {
    id: 'claude-cli', model,
    async call(req) {
      const res = await inner.evaluate(req.prompt, { model, effort, maxTokens: PANEL_CLAUDE_MAX_TOKENS }, {
        runIndex: 0, repetition: 0, functionId: 'panel:meaningful', systemPrompt: req.system, responseSchema: RESPONSE_SCHEMA_TEXT,
      });
      if (!res.success) {
        const e = res.errors[0];
        const code = e?.code ?? 'LLM_CLI_EXIT';
        throw new ProviderError(code, e?.message ?? 'Claude CLI call failed', CLAUDE_STOPS.has(code) ? 'stop' : 'retry');
      }
      const envelope = parseEnvelope(res.data.content);
      if (envelope === null) throw new ProviderError('LLM_CLI_BAD_ENVELOPE', 'Claude CLI answer is not a JSON envelope', 'retry');
      const resolved = resolveActualModel(envelope, model);
      if (resolved.kind === 'mismatch') throw new ProviderError('LLM_MODEL_MISMATCH', `output carried by ${resolved.models.join(', ')}`, 'retry');
      const text = envelope.structured_output !== undefined ? JSON.stringify(envelope.structured_output) : (envelope.result ?? '');
      return { text, servedModel: resolved.resolvedModel, inputTokens: res.data.usage.inputTokens, outputTokens: res.data.usage.outputTokens };
    },
  };
}

export interface ClaudeRaterConfig {
  readonly model: string;
  /** Absolute, logged-in, dedicated config dir (never the user's own). */
  readonly configDir: string;
  readonly binary?: string;
  readonly effort?: LLMEffort;
  readonly projectRoot?: string;
}

/** Builds the judge-route provider and runs its isolation pre-flight once; a failed pre-flight is a stop. */
export async function claudeRater(c: ClaudeRaterConfig, runner: ProcessRunner = new NodeProcessRunner()): Promise<{ rater: PanelRater; dispose: () => void }> {
  const cli = new ClaudeCliProvider({
    binary: c.binary ?? 'claude', model: c.model, effort: c.effort ?? JUDGE_EFFORT, judgeConfigDir: c.configDir, mode: 'record',
    ...(c.projectRoot !== undefined && { projectRoot: c.projectRoot }),
  }, { runner });
  const prepared = await cli.prepare();
  if (!prepared.success) {
    throw new ProviderError('LLM_CLI_ISOLATION', prepared.errors.map((e) => `${e.code}: ${e.message}`).join('; '), 'stop');
  }
  return { rater: rater('anthropic', claudeCliProvider(cli, c.model, c.effort)), dispose: () => cli.dispose() };
}

// ── Fake (dry run, tests) ───────────────────────────────────────────────────

export interface FakeProfile {
  readonly vendor: Vendor;
  readonly model: string;
  /** Probability of giving the item's truth. */
  readonly accuracy: number;
  /** Of the wrong answers, the share that are `uncertain` (the rest are the opposite label). */
  readonly uncertainShare: number;
  /** Probability that one run (not the item) flips to another answer: makes the two runs disagree sometimes. */
  readonly runNoise: number;
  /** Probability that a first ask is unparsable (exercises the re-ask). */
  readonly invalidRate: number;
}

export function unit(...parts: readonly string[]): number {
  return createHash('sha256').update(parts.join('\u0000')).digest().readUInt32BE(0) / 0x1_0000_0000;
}

/** The option letters of a rendered prompt (`A. yes` …), in order. */
export function optionsOfPrompt(prompt: string): MeaningfulLabel[] {
  const out: MeaningfulLabel[] = [];
  for (const line of prompt.split('\n')) {
    const m = /^([ABC])\. (yes|no|uncertain)$/.exec(line);
    if (m !== null) out.push(m[2] as MeaningfulLabel);
  }
  return out;
}

/** The `## Reported finding` text of a rendered prompt: what the fake keys its item on (option order aside). */
export function claimOfPrompt(prompt: string): string {
  const m = /## Reported finding\n([\s\S]*?)\n\n## Question/.exec(prompt);
  const file = /\nFile: (.*)\n/.exec(prompt)?.[1] ?? '';
  return `${file}\n${m?.[1] ?? ''}`;
}

/**
 * A deterministic stub. `truthOf` maps an item (by `claimOfPrompt`) to its truth; the dry run supplies it from the key
 * (decoys) and from a seeded latent truth (target items). Same inputs, same answers, on every machine.
 */
export function fakeProvider(p: FakeProfile, truthOf: (claimKey: string) => 'yes' | 'no'): MeaningfulProvider {
  return {
    id: 'fake', model: p.model,
    call(req) {
      const ck = claimOfPrompt(req.prompt);
      const reask = req.prompt.includes('Your previous reply was not valid');
      const order = optionsOfPrompt(req.prompt);
      const runTag = order.join(',');
      if (!reask && unit(p.model, 'invalid', ck, runTag) < p.invalidRate) {
        return Promise.resolve({ text: 'I think the answer is probably the first one.', servedModel: p.model });
      }
      const truth = truthOf(ck);
      const other: MeaningfulLabel = truth === 'yes' ? 'no' : 'yes';
      let label: MeaningfulLabel = truth;
      if (unit(p.model, 'item', ck) >= p.accuracy) label = unit(p.model, 'kind', ck) < p.uncertainShare ? 'uncertain' : other;
      if (unit(p.model, 'run', ck, runTag) < p.runNoise) {
        const alts = MEANINGFUL_OPTIONS.filter((o) => o !== label);
        label = alts[Math.floor(unit(p.model, 'alt', ck, runTag) * alts.length)] ?? label;
      }
      const idx = order.indexOf(label);
      return Promise.resolve({ text: JSON.stringify({ choice: LETTERS[idx] ?? 'A', reason: `fake ${p.vendor} answer` }), servedModel: p.model, inputTokens: Math.ceil(req.prompt.length / 4), outputTokens: 20 });
    },
  };
}

/** The dry run's three fakes: two that pass the decoy bar and one that does not (so every branch of the rule shows). */
export const DRY_RUN_PROFILES: readonly FakeProfile[] = [
  { vendor: 'google', model: 'fake-gemini', accuracy: 0.96, uncertainShare: 0.3, runNoise: 0.03, invalidRate: 0.03 },
  { vendor: 'openai', model: 'fake-gpt', accuracy: 0.94, uncertainShare: 0.4, runNoise: 0.04, invalidRate: 0.02 },
  { vendor: 'anthropic', model: 'fake-claude', accuracy: 0.7, uncertainShare: 0.5, runNoise: 0.05, invalidRate: 0.02 },
];

export function fakeRater(p: FakeProfile, truthOf: (claimKey: string) => 'yes' | 'no'): PanelRater {
  return rater(p.vendor, fakeProvider(p, truthOf));
}
