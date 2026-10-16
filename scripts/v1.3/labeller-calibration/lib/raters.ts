/**
 * v1.3 labeller calibration: the two raters and the record/replay cassette (Docs/v1.3/labeller-calibration-plan.md §5).
 *
 * - **claude**: the judge's `ClaudeCliProvider`, unchanged: subscription login in a dedicated `CLAUDE_CONFIG_DIR`
 *   (default the judge's `~/.firewall/judge-claude-config`), the pinned CLI version, the frozen argv with `--tools ""`,
 *   the allow-listed child env, a neutral cwd and the init-probe pre-flight. Model `JUDGE_MODEL`, effort
 *   `JUDGE_EFFORT`. The arm's schema goes in `--json-schema`; the answer is the envelope's `structured_output`.
 * - **gemini**: the labeller's `AgyCliProvider` (Antigravity CLI `agy`, Google OAuth in the dedicated
 *   `~/.firewall/labeller-agy-home`, tools inert, neutral cwd, no rule files, persona prepended). Model
 *   `GEMINI_MODEL`, the second-vendor model of the v2.2 CHECK-2 rater. agy self-updates, so, as in that run, the
 *   version found is accepted only when it equals `--agy-accept-version` and is stored in every cassette entry.
 * - **fake-***: deterministic stubs for `--dry-run` statistics and the tests. They read the human consensus (an
 *   oracle no real rater has) and answer it with a fixed accuracy.
 *
 * Neither real rater reads an API key: both use their CLI's subscription login. No credential file is ever read
 * here. Cassette: one JSON file per call at `<dir>/<key[0..2]>/<key>.json`, key = sha256 of the canonical request
 * (rater, model, arm, schema, system, prompt, run index). `record` calls on a miss; `replay` never calls.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AgyCliProvider, buildAgyChildEnv, checkAgyHome, createAgyNeutralCwd, expandHome, AGY_HOME_DEFAULT, parseAgyVersion } from '../../../../src/llm-critic/agy-cli-provider.js';
import type { AgyIsolation } from '../../../../src/llm-critic/agy-cli-provider.js';
import { canonicalJSON, sha256Hex } from '../../../../src/llm-critic/canonical-json.js';
import { sortedJson, writeFileAtomic } from '../../../../src/llm-critic/cassette-manager.js';
import { ClaudeCliProvider, parseEnvelope, resolveActualModel } from '../../../../src/llm-critic/claude-cli-provider.js';
import { JUDGE_CONFIG_DIR_DEFAULT, JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL } from '../../../../src/llm-critic/frozen.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LLMProvider } from '../../../../src/shared/interfaces/llm-provider.js';
import type { ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { createRng } from '../../../lib/stats.js';
import type { RaterId } from './types.js';

export const CLAUDE_MODEL = JUDGE_MODEL;
/** `agy models`: "Gemini 4 Argon (High)"; the model of `scripts/v1.3/judge-v22-check2-gemini.ts`. */
export const GEMINI_MODEL = 'gemini-4-argon-high';
export const AGY_ACCEPT_VERSION_DEFAULT = '1.3.6';

export interface RaterRequest {
  readonly system: string;
  readonly prompt: string;
  readonly schema: string;
}

export interface RaterAnswer {
  readonly text: string;
  readonly servedModel: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/** `stop`: never cached, the run halts (usage limit, auth, isolation); `retry`: retried once, then recorded invalid. */
export class RaterError extends Error {
  constructor(readonly code: string, message: string, readonly kind: 'stop' | 'retry') {
    super(message);
  }
}

export interface Rater {
  readonly id: RaterId;
  readonly model: string;
  /** Stored in every cassette entry (CLI version and isolation hashes). */
  readonly provenance: Readonly<Record<string, string>>;
  call(req: RaterRequest): Promise<RaterAnswer>;
  dispose?(): void;
}

const STOPS = new Set(['LLM_USAGE_LIMIT', 'LLM_AUTH', 'LLM_CLI_ISOLATION', 'LLM_CLI_VERSION_DRIFT', 'LLM_CLI_NOT_FOUND', 'LLM_NOT_CONFIGURED']);

/** Wraps a judge-route or labeller-route `LLMProvider` (both take the schema through `responseSchema`). */
export function wrapProvider(id: RaterId, inner: LLMProvider, model: string, provenance: Record<string, string>, envelope: 'claude' | 'text'): Rater {
  return {
    id, model, provenance,
    async call(req) {
      const res = await inner.evaluate(req.prompt, { model, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS }, {
        runIndex: 0, repetition: 0, functionId: 'labeller-calibration', systemPrompt: req.system, responseSchema: req.schema,
      });
      if (!res.success) {
        const e = res.errors[0];
        const code = e?.code ?? 'LLM_CLI_EXIT';
        throw new RaterError(code, e?.message ?? `${id} call failed`, STOPS.has(code) ? 'stop' : 'retry');
      }
      if (envelope === 'text') return { text: res.data.content, servedModel: res.data.model, inputTokens: res.data.usage.inputTokens, outputTokens: res.data.usage.outputTokens };
      const env = parseEnvelope(res.data.content);
      if (env === null) throw new RaterError('LLM_CLI_BAD_ENVELOPE', 'Claude CLI answer is not a JSON envelope', 'retry');
      const resolved = resolveActualModel(env, model);
      if (resolved.kind === 'mismatch') throw new RaterError('LLM_MODEL_MISMATCH', `output carried by ${resolved.models.join(', ')}`, 'retry');
      const text = env.structured_output !== undefined ? JSON.stringify(env.structured_output) : (env.result ?? '');
      return { text, servedModel: resolved.resolvedModel, inputTokens: res.data.usage.inputTokens, outputTokens: res.data.usage.outputTokens };
    },
  };
}

export interface ClaudeRaterOptions {
  readonly configDir?: string;
  readonly binary?: string;
  readonly runner: ProcessRunner;
  readonly tmpRoot?: string;
}

/** The judge route with its own pre-flight; a failed pre-flight is a stop before any model call. */
export async function claudeRater(o: ClaudeRaterOptions): Promise<Rater> {
  const cli = new ClaudeCliProvider({
    binary: o.binary ?? 'claude', model: CLAUDE_MODEL, effort: JUDGE_EFFORT, mode: 'record',
    judgeConfigDir: expandHome(o.configDir ?? JUDGE_CONFIG_DIR_DEFAULT),
  }, { runner: o.runner, ...(o.tmpRoot !== undefined && { tmpRoot: o.tmpRoot }) });
  const prepared = await cli.prepare();
  if (!prepared.success) throw new RaterError('LLM_CLI_ISOLATION', prepared.errors.map((e) => `${e.code}: ${e.message}`).join('; '), 'stop');
  const iso = prepared.data as unknown as Record<string, unknown>;
  const provenance = Object.fromEntries(Object.entries(iso).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  const r = wrapProvider('claude', cli, CLAUDE_MODEL, provenance, 'claude');
  return { ...r, dispose: () => cli.dispose() };
}

/** The labeller route's agy provider, with its pre-flight except that the version must equal `acceptVersion`. */
export class AcceptVersionAgyProvider extends AgyCliProvider {
  private preflight: Promise<DomainResult<AgyIsolation>> | null = null;
  constructor(private readonly home: string, private readonly acceptVersion: string, private readonly tmpRoot: string | undefined,
    private readonly procRunner: ProcessRunner, private readonly env: NodeJS.ProcessEnv) {
    super({ model: GEMINI_MODEL, home, mode: 'record' }, { runner: procRunner, parentEnv: env, ...(tmpRoot !== undefined && { tmpRoot }) });
  }

  override prepare(): Promise<DomainResult<AgyIsolation>> {
    this.preflight ??= (async (): Promise<DomainResult<AgyIsolation>> => {
      const cwd = createAgyNeutralCwd(this.tmpRoot);
      if (!cwd.success) return DomainResult.fail(cwd.errors);
      const env = buildAgyChildEnv(this.env, this.home);
      const run = async (args: readonly string[]): Promise<string> => {
        const r = await this.procRunner.run('agy', args, { cwd: cwd.data, env, timeoutMs: 15_000, stdin: '' });
        return r.success ? r.data.stdout.trim() : '';
      };
      try {
        const found = parseAgyVersion(await run(['--version']));
        if (found !== this.acceptVersion) return DomainResult.fail([{ code: 'LLM_CLI_VERSION_DRIFT', message: `agy ${String(found)} is not the accepted ${this.acceptVersion}` }]);
        const home = checkAgyHome(this.home);
        if (home.problems.length > 0) return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: `agy home fails: ${home.problems.join('; ')}` }]);
        const mcp = await run(['mcp', 'list']);
        const plugins = await run(['plugin', 'list']);
        if (mcp !== 'No MCP servers configured.') return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: 'agy mcp list reports servers' }]);
        if (plugins !== 'No imported plugins.' && plugins !== 'No plugins installed.') return DomainResult.fail([{ code: 'LLM_CLI_ISOLATION', message: 'agy plugin list reports plugins' }]);
        const facts = { cliVersion: found, mcp, plugins, configListingSha256: home.configListingSha256 };
        return DomainResult.ok({ cliVersion: found, configListingSha256: home.configListingSha256, isolationProbeSha256: sha256Hex(canonicalJSON(facts)) });
      } finally {
        fs.rmSync(cwd.data, { recursive: true, force: true });
      }
    })();
    return this.preflight;
  }
}

export interface GeminiRaterOptions {
  readonly home?: string;
  readonly acceptVersion?: string;
  readonly runner: ProcessRunner;
  readonly tmpRoot?: string;
  readonly parentEnv?: NodeJS.ProcessEnv;
}

export async function geminiRater(o: GeminiRaterOptions): Promise<Rater> {
  const parent = o.parentEnv ?? process.env;
  // The child env is allow-listed again inside the provider; only these names are passed in.
  const env: NodeJS.ProcessEnv = { PATH: parent.PATH ?? '', USER: parent.USER ?? '', LOGNAME: parent.LOGNAME ?? '', TMPDIR: parent.TMPDIR ?? '', LANG: 'en_US.UTF-8' };
  const agy = new AcceptVersionAgyProvider(expandHome(o.home ?? AGY_HOME_DEFAULT), o.acceptVersion ?? AGY_ACCEPT_VERSION_DEFAULT, o.tmpRoot, o.runner, env);
  const pre = await agy.prepare();
  if (!pre.success) throw new RaterError(pre.errors[0]?.code ?? 'LLM_CLI_ISOLATION', pre.errors.map((e) => `${e.code}: ${e.message}`).join('; '), 'stop');
  return wrapProvider('gemini', agy, GEMINI_MODEL, { ...pre.data }, 'text');
}

// ── Fakes ───────────────────────────────────────────────────────────────────

export interface FakeProfile {
  readonly id: Extract<RaterId, 'fake-claude' | 'fake-gemini'>;
  /** Probability of answering the oracle's label. */
  readonly accuracy: number;
  readonly invalidRate: number;
}

export const DRY_RUN_FAKES: readonly FakeProfile[] = [
  { id: 'fake-claude', accuracy: 0.8, invalidRate: 0.02 },
  { id: 'fake-gemini', accuracy: 0.72, invalidRate: 0.04 },
];

function unit(...parts: readonly string[]): number {
  return createRng(Number.parseInt(createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 8), 16)).next();
}

/**
 * A fake that answers in the arm's schema. `truthOf(prompt)` gives the oracle (`fail` = problem present) for the
 * item the prompt is about. For the labeller arm it answers by letter, reading the option order from the prompt.
 */
export function fakeRater(p: FakeProfile, truthOf: (prompt: string) => 'fail' | 'pass'): Rater {
  return {
    id: p.id, model: `${p.id}-1`, provenance: { fake: 'true' },
    call(req) {
      if (unit(p.id, 'invalid', req.prompt) < p.invalidRate) return Promise.resolve({ text: 'not json', servedModel: `${p.id}-1` });
      const truth = truthOf(req.prompt);
      const right = unit(p.id, 'acc', req.prompt) < p.accuracy;
      const fail = right ? truth === 'fail' : truth !== 'fail';
      if (req.prompt.includes('## Rubric')) {
        return Promise.resolve({ text: JSON.stringify({ pass: !fail, confidence: 0.8, reasoning: 'fake', evidence: [], violations: [] }), servedModel: `${p.id}-1` });
      }
      const want = fail ? 'yes' : 'no';
      const m = new RegExp(`^([ABC])\\. ${want}$`, 'm').exec(req.prompt);
      return Promise.resolve({ text: JSON.stringify({ choice: m?.[1] ?? 'C', reason: 'fake' }), servedModel: `${p.id}-1` });
    },
  };
}

// ── Cassette ────────────────────────────────────────────────────────────────

export type CassetteMode = 'record' | 'replay';

export interface CassetteEntry {
  readonly key: string;
  readonly rater: RaterId;
  readonly model: string;
  readonly arm: string;
  readonly itemId: string;
  readonly runIndex: number;
  readonly request: RaterRequest;
  readonly answer: RaterAnswer;
  readonly provenance: Readonly<Record<string, string>>;
  /** Retryable failures before the stored answer (codes only). */
  readonly failedAttempts: readonly string[];
}

export function cassetteKey(rater: RaterId, model: string, arm: string, req: RaterRequest, runIndex: number): string {
  return createHash('sha256').update(canonicalJSON({ rater, model, arm, runIndex, ...req })).digest('hex');
}

export class CassetteMissError extends Error {
  readonly code = 'CASSETTE_MISS';
}

export class Cassette {
  constructor(readonly dir: string, readonly mode: CassetteMode) {}

  private file(key: string): string {
    return path.join(this.dir, key.slice(0, 2), `${key}.json`);
  }

  read(key: string): CassetteEntry | null {
    const f = this.file(key);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) as CassetteEntry : null;
  }

  has(key: string): boolean {
    return fs.existsSync(this.file(key));
  }

  write(e: CassetteEntry): void {
    writeFileAtomic(this.file(e.key), sortedJson(e));
  }
}

export interface CallBudget {
  readonly cap: number;
  used: number;
}

export class BudgetExhaustedError extends Error {
  readonly code = 'BUDGET';
}

/**
 * One call through the cassette. A hit never calls. On a miss: replay throws; record checks the budget, calls, retries
 * once on a retryable failure and stores the answer. A stop is thrown and nothing is stored.
 */
export async function cassetteCall(
  cassette: Cassette, rater: Rater, arm: string, req: RaterRequest, runIndex: number, itemId: string, budget: CallBudget,
): Promise<{ entry: CassetteEntry; hit: boolean } | { failed: readonly string[]; key: string }> {
  const key = cassetteKey(rater.id, rater.model, arm, req, runIndex);
  const hit = cassette.read(key);
  if (hit !== null) return { entry: hit, hit: true };
  if (cassette.mode === 'replay') throw new CassetteMissError(`no cassette for ${itemId} ${arm} run ${String(runIndex)} (${key})`);
  const failed: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (budget.used >= budget.cap) throw new BudgetExhaustedError(`call budget ${String(budget.cap)} reached`);
    budget.used += 1;
    try {
      const answer = await rater.call(req);
      const entry: CassetteEntry = { key, rater: rater.id, model: rater.model, arm, itemId, runIndex, request: req, answer, provenance: rater.provenance, failedAttempts: failed };
      cassette.write(entry);
      return { entry, hit: false };
    } catch (e) {
      if (e instanceof RaterError && e.kind === 'retry') {
        failed.push(e.code);
        continue;
      }
      throw e;
    }
  }
  return { failed, key };
}
