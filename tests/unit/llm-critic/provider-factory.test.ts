// U4 Step 20 (U4-K3): factory cases, judge wrapping, pinned ids (BR-U4-ISO-01, VRD-09, OPS-02;
// FR-23, FR-31; D-U0-8). No process is spawned: claude-cli uses a runner stub.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createJudgeProvider, createLLMProvider } from '../../../src/llm-critic/provider-factory.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { NullLLMProvider } from '../../../src/llm-critic/null-provider.js';
import { GeminiProvider } from '../../../src/llm-critic/gemini-provider.js';
import { ClaudeCliProvider } from '../../../src/llm-critic/claude-cli-provider.js';
import { CassetteLLMProvider } from '../../../src/llm-critic/cassette-provider.js';
import { listCassetteKeys } from '../../../src/llm-critic/cassette-manager.js';
import { evaluateNeuronal } from '../../../src/llm-critic/llm-critic.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';
import type { NeuronalInstruction } from '../../../src/shared/types/evaluation.js';
import type { LLMProviderConfig } from '../../../src/shared/types/llm-config.js';
import { PINNED_CLI_VERSION } from '../../../src/llm-critic/frozen.js';

const CASSETTE = { mode: 'record', dir: 'fixtures/cassettes' } as const;
const FIX = path.resolve(__dirname, '../../fixtures/claude-cli');

const roots: string[] = [];
function tmpDir(prefix = 'u4-factory-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(dir);
  return dir;
}
afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

class StubRunner implements ProcessRunner {
  readonly calls: { args: readonly string[]; options: ProcessRunOptions }[] = [];
  constructor(private readonly version = `${PINNED_CLI_VERSION} (Claude Code)\n`) {}
  run(_command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ args, options });
    const done = (stdout: string): Promise<DomainResult<ProcessResult>> =>
      Promise.resolve(DomainResult.ok({ exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 1 }));
    if (args[0] === '--version') return done(this.version);
    if (args.includes('stream-json')) return done(`${fs.readFileSync(path.join(FIX, 'init-clean.json'), 'utf8').replace(/\n\s*/g, '')}\n`);
    return done(fs.readFileSync(path.join(FIX, 'envelope-schema-tools-off.json'), 'utf8'));
  }
}

function judgeDir(): string {
  const dir = tmpDir('u4-judge-cfg-');
  fs.writeFileSync(path.join(dir, '.claude.json'), '{}');
  return dir;
}

describe('createLLMProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns NullLLMProvider when no config provided', () => {
    const provider = createLLMProvider();
    expect(provider).toBeInstanceOf(NullLLMProvider);
    expect(provider.name).toBe('null');
  });

  it('returns MockLLMProvider for mock config', () => {
    const provider = createLLMProvider({ provider: 'mock', cassette: CASSETTE });
    expect(provider).toBeInstanceOf(MockLLMProvider);
    expect(provider.name).toBe('mock');
  });

  it('returns GeminiProvider when API key and model are in config', () => {
    const provider = createLLMProvider({
      provider: 'gemini',
      gemini: { apiKey: 'test-key', model: 'gemini-pinned-id', temperature: 0, maxTokens: 4096 },
      cassette: CASSETTE,
    });
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.describe()).toEqual({ provider: 'gemini', model: 'gemini-pinned-id' });
  });

  it('takes the Gemini key from GEMINI_API_KEY when the config has none', () => {
    process.env.GEMINI_API_KEY = 'env-key';
    const provider = createLLMProvider({ provider: 'gemini', gemini: { model: 'gemini-pinned-id' } as never, cassette: CASSETTE });
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('returns NullLLMProvider when gemini has no API key', () => {
    const provider = createLLMProvider({ provider: 'gemini', cassette: CASSETTE });
    expect(provider).toBeInstanceOf(NullLLMProvider);
  });

  it('VRD-09: no default Gemini id; GEMINI_MODEL is never read', () => {
    process.env.GEMINI_API_KEY = 'env-key';
    process.env.GEMINI_MODEL = 'gemini-from-env';
    expect(createLLMProvider({ provider: 'gemini', cassette: CASSETTE })).toBeInstanceOf(NullLLMProvider);
    const pinned = createLLMProvider({
      provider: 'gemini', gemini: { apiKey: 'k', model: 'gemini-pinned-id', temperature: 0, maxTokens: 8192 }, cassette: CASSETTE,
    });
    expect(pinned.describe().model).toBe('gemini-pinned-id');
  });

  it('ISO-01: an ANTHROPIC_API_KEY never builds a Gemini provider', () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-only';
    expect(createLLMProvider({ provider: 'gemini', gemini: { model: 'gemini-pinned-id' } as never, cassette: CASSETTE })).toBeInstanceOf(NullLLMProvider);
  });

  it("'claude-cli' builds ClaudeCliProvider with the pinned model, high effort and the judge dir", () => {
    const provider = createLLMProvider({ provider: 'claude-cli', cassette: CASSETTE }, { judgeConfigDir: '/judge', runner: new StubRunner() });
    expect(provider).toBeInstanceOf(ClaudeCliProvider);
    expect(provider.describe()).toEqual({ provider: 'claude-cli', model: 'claude-opus-5-5', effort: 'high' });
  });

  it('the judge dir comes from parseLLMOptions output when deps do not name one', async () => {
    const dir = judgeDir();
    const runner = new StubRunner();
    const config = { provider: 'claude-cli', cassette: CASSETTE, judgeConfigDir: dir } as LLMProviderConfig;
    const provider = createLLMProvider(config, { runner, parentEnv: { PATH: '/bin' } }) as ClaudeCliProvider;
    const prepared = await provider.prepare();
    expect(prepared.success).toBe(true);
    expect(runner.calls[0]?.options.env.CLAUDE_CONFIG_DIR).toBe(dir);
    provider.dispose();
  });
});

describe('createJudgeProvider: every real provider wrapped once (CAS-*, U4-K3)', () => {
  it('mock → CassetteLLMProvider over MockLLMProvider with the configured mode and dir', async () => {
    const dir = tmpDir();
    const result = await createJudgeProvider({ provider: 'mock', cassette: { mode: 'replay', dir } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(CassetteLLMProvider);
      expect(result.data.innerProvider).toBeInstanceOf(MockLLMProvider);
      expect(result.data.mode).toBe('replay');
      expect(result.data.dir).toBe(dir);
    }
  });

  it('gemini → CassetteLLMProvider over GeminiProvider', async () => {
    const result = await createJudgeProvider({
      provider: 'gemini', gemini: { apiKey: 'k', model: 'gemini-pinned-id', temperature: 0, maxTokens: 8192 }, cassette: CASSETTE,
    });
    expect(result.success && result.data.innerProvider instanceof GeminiProvider).toBe(true);
  });

  it('claude-cli record: the pre-flight runs first and its provenance reaches every recorded entry', async () => {
    const runner = new StubRunner();
    const dir = tmpDir();
    const result = await createJudgeProvider(
      { provider: 'claude-cli', cassette: { mode: 'record', dir } },
      { judgeConfigDir: judgeDir(), runner, parentEnv: { PATH: '/bin' } },
      { knownSecrets: [] },
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(runner.calls.map((c) => (c.args.includes('stream-json') ? 'init' : c.args[0]))).toEqual(['--version', 'init']);
    const call = await result.data.judge('p', { model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 }, { runIndex: 0, repetition: 0, functionId: 'FF-N02' });
    expect(call.kind).toBe('final');
    if (call.kind === 'final') {
      expect(call.outcome).toEqual({ kind: 'valid' });
      expect(call.entry.cliVersion).toBe(PINNED_CLI_VERSION);
      expect(call.entry.isolationProbeSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(call.entry.configListingSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(call.entry.resolvedModel).toBe('claude-opus-5-5');
    }
    (result.data.innerProvider as ClaudeCliProvider).dispose();
  });

  it('claude-cli record with a drifted CLI → LLM_CLI_VERSION_DRIFT, nothing judged', async () => {
    const runner = new StubRunner('2.1.300\n');
    const result = await createJudgeProvider({ provider: 'claude-cli', cassette: { mode: 'record', dir: tmpDir() } }, { judgeConfigDir: judgeDir(), runner });
    expect(result.success ? null : result.errors[0]?.code).toBe('LLM_CLI_VERSION_DRIFT');
    expect(runner.calls).toHaveLength(1);
  });

  it('claude-cli replay: no process is spawned', async () => {
    const runner = new StubRunner();
    const result = await createJudgeProvider({ provider: 'claude-cli', cassette: { mode: 'replay', dir: tmpDir() } }, { judgeConfigDir: judgeDir(), runner });
    expect(result.success).toBe(true);
    expect(runner.calls).toEqual([]);
  });

  it('OPS-02 both providers through the factory: CLI and Gemini report what they ignore', async () => {
    const cli = createLLMProvider({ provider: 'claude-cli', cassette: CASSETTE }, { judgeConfigDir: judgeDir(), runner: new StubRunner(), parentEnv: {} }) as ClaudeCliProvider;
    const r = await cli.evaluate('p', { model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192, temperature: 0, seed: 1 });
    expect(r.success ? r.data.ignoredOptions : null).toEqual(['temperature', 'seed', 'maxTokens']);
    cli.dispose();
  });

  it('the critic uses a factory-built decorator as is (no second wrapper)', async () => {
    const own = tmpDir();
    const other = tmpDir();
    const built = await createJudgeProvider({ provider: 'mock', cassette: { mode: 'record', dir: own } });
    if (!built.success) throw new Error('factory failed');
    const instruction = {
      functionId: 'FF-N02', name: 'intent', dimension: 'integrity', severity: 'major', route: 'neuronal',
      semanticCriteria: { rule: 'r', rubric: { pass: 'p', fail: 'f', evidenceRequired: 'e' } },
      contextAssembly: { includeAPGSubgraph: true, includeSourceCode: true }, shadowModeEligible: false,
      source: 'fitness-function', judgeUnit: 'file',
    } as unknown as NeuronalInstruction;
    await evaluateNeuronal({ instructions: [instruction], graphRepository: {} as GraphRepository, provider: built.data, cassettePath: other });
    expect(listCassetteKeys(own).length).toBe(3);
    expect(listCassetteKeys(other)).toEqual([]);
  });
});

describe('NullLLMProvider', () => {
  it('returns non-critical error on evaluate', async () => {
    const provider = new NullLLMProvider();
    const result = await provider.evaluate('test', { model: 'none', maxTokens: 1000, temperature: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('LLM_NOT_CONFIGURED');
    }
  });

  it('reports unavailable', () => {
    const provider = new NullLLMProvider();
    expect(provider.isAvailable()).toBe(false);
  });
});
