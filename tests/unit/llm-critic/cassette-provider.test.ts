// BR-U4-CAS-01..09, 12, AGG-03 (manifest); BLM §7; DE §3.5, §4.1, §4.2, §4.7; T6, T7, T8, T9,
// T13 (cassette part) (U4 plan Step 18). Stub providers only; no live call.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../../src/shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../../../src/shared/types/evaluation.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import {
  CassetteLLMProvider, buildJudgeRequest, requestHashOf, cassetteKeyOf, knownSecretsFrom, interpretTextAnswer,
} from '../../../src/llm-critic/cassette-provider.js';
import type { CassetteOptions, JudgeRequest, ResponseInterpreter } from '../../../src/llm-critic/cassette-provider.js';
import {
  listCassetteKeys, readCassetteEntry, cassetteFilePath, writeRunManifest, readRunManifest, clearRunManifest, runManifestPath,
} from '../../../src/llm-critic/cassette-manager.js';
import { DEFAULT_NEURONAL_OPTIONS } from '../../../src/llm-critic/types.js';
import { DEFAULT_CASSETTE_DIR, JUDGE_PERSONA } from '../../../src/llm-critic/frozen.js';
import { VERDICT_SCHEMA_TEXT } from '../../../src/llm-critic/verdict-schema.js';
import { canonicalJSON } from '../../../src/llm-critic/canonical-json.js';

const REPO = path.resolve(__dirname, '../../..');
const roots: string[] = [];
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-cas-'));
  roots.push(dir);
  return dir;
}
afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

const VALID = JSON.stringify({ pass: false, confidence: 0.9, reasoning: 'r', evidence: ['e'], violations: [{ filePath: 'src/a.ts', message: 'm' }] });
const OPTIONS: LLMOptions = { model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 };
const CALL = (runIndex: number, extra: Partial<LLMCallContext> = {}): LLMCallContext => ({ runIndex, repetition: 0, functionId: 'FF-N02', unitId: 'src/a.ts', ...extra });

function ok(content: string, model = 'claude-opus-5-5'): DomainResult<LLMResponse> {
  return DomainResult.ok({ content, model, usage: { inputTokens: 10, outputTokens: 5 }, usedOptions: { model }, ignoredOptions: ['maxTokens'] });
}
function err(code: string, message = 'failed'): DomainResult<LLMResponse> {
  return DomainResult.fail([{ code, message }]);
}

class StubProvider implements LLMProvider {
  readonly name = 'stub';
  calls = 0;
  readonly prompts: string[] = [];
  constructor(
    private readonly script: readonly DomainResult<LLMResponse>[],
    private readonly description: ProviderDescription = { provider: 'claude-cli', model: 'claude-opus-5-5', effort: 'high' },
    private readonly flags: readonly string[] = ['--tools', '-p', '--output-format=json'],
  ) {}
  describe(): ProviderDescription {
    return this.description;
  }
  requestArgvFlags(): readonly string[] {
    return this.flags;
  }
  evaluate(prompt: string): Promise<DomainResult<LLMResponse>> {
    this.prompts.push(prompt);
    const answer = this.script[Math.min(this.calls, this.script.length - 1)] ?? ok(VALID);
    this.calls++;
    return Promise.resolve(answer);
  }
}

function decorator(inner: LLMProvider, dir: string, extra: Partial<CassetteOptions> = {}): CassetteLLMProvider {
  return new CassetteLLMProvider(inner, { mode: 'record', dir, knownSecrets: [], now: () => '2026-10-08T00:00:00Z', ...extra });
}

describe('CAS-01 canonical request', () => {
  it('the same request built twice hashes the same; literal key order does not matter', () => {
    const a = buildJudgeRequest('claude-cli', 'p', OPTIONS, CALL(0), ['-p', '--tools']);
    const b = buildJudgeRequest('claude-cli', 'p', { maxTokens: 8192, effort: 'high', model: 'claude-opus-5-5' }, CALL(0), ['--tools', '-p']);
    expect(requestHashOf(a)).toBe(requestHashOf(b));
    const reordered = Object.fromEntries(Object.entries(a).reverse()) as unknown as JudgeRequest;
    expect(requestHashOf(reordered)).toBe(requestHashOf(a));
    expect(requestHashOf(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('defaults to the frozen persona and schema; effort and flags only for the CLI', () => {
    const cli = buildJudgeRequest('claude-cli', 'p', OPTIONS, CALL(0), ['-p']);
    expect(cli).toEqual({
      prompt: 'p', systemPrompt: JUDGE_PERSONA, schema: VERDICT_SCHEMA_TEXT, provider: 'claude-cli', model: 'claude-opus-5-5',
      effort: 'high', maxTokens: 8192, argvFlags: ['-p'],
    });
    const gemini = buildJudgeRequest('gemini', 'p', OPTIONS, CALL(0), ['-p']);
    expect(gemini.effort).toBeNull();
    expect(gemini.argvFlags).toEqual([]);
    expect(cassetteKeyOf('abc', 2, 1)).toBe('abc-r2-1');
  });
});

describe('CAS-02 keys', () => {
  it('a retry of run 0 does not shift the keys of runs 1 and 2 (T7)', async () => {
    const dirA = tmpDir();
    const dirB = tmpDir();
    const retried = decorator(new StubProvider([err('LLM_CLI_TIMEOUT'), ok(VALID)]), dirA);
    const clean = decorator(new StubProvider([ok(VALID)]), dirB);
    const keysA: string[] = [];
    const keysB: string[] = [];
    for (const i of [0, 1, 2]) {
      keysA.push((await retried.judge('prompt', OPTIONS, CALL(i))).key);
      keysB.push((await clean.judge('prompt', OPTIONS, CALL(i))).key);
    }
    expect(keysA).toEqual(keysB);
    expect(new Set(keysA).size).toBe(3);
    expect(readCassetteEntry(dirA, keysA[0] ?? '')?.attempts).toBe(2);
  });

  it('identical paths with different source give different keys; one request in two projects shares a key', async () => {
    const dir = tmpDir();
    const inner = new StubProvider([ok(VALID)]);
    const p1 = decorator(inner, dir, { projectId: 'proj-1' });
    const p2 = decorator(inner, dir, { projectId: 'proj-2' });
    const k1 = await p1.judge('=====SOURCE-BEGIN src/a.ts=====\nA\n', OPTIONS, CALL(0));
    const k2 = await p1.judge('=====SOURCE-BEGIN src/a.ts=====\nB\n', OPTIONS, CALL(0));
    expect(k1.key).not.toBe(k2.key);
    const shared = await p2.judge('=====SOURCE-BEGIN src/a.ts=====\nA\n', OPTIONS, CALL(0));
    expect(shared.key).toBe(k1.key);
    expect(shared.kind === 'final' && shared.hit).toBe(true);
    expect(inner.calls).toBe(2);
  });
});

describe('CAS-03 misses by construction (T8)', () => {
  const variants: [string, (r: { prompt: string; options: LLMOptions; call: LLMCallContext; flags: string[]; provider: ProviderDescription })
    => { prompt: string; options: LLMOptions; call: LLMCallContext; flags: string[]; provider: ProviderDescription }][] = [
    ['prompt', (r) => ({ ...r, prompt: `${r.prompt} ` })],
    ['persona', (r) => ({ ...r, call: { ...r.call, systemPrompt: `${JUDGE_PERSONA} ` } })],
    ['schema', (r) => ({ ...r, call: { ...r.call, responseSchema: '{}' } })],
    ['provider', (r) => ({ ...r, provider: { provider: 'gemini', model: 'claude-opus-5-5' } })],
    ['model', (r) => ({ ...r, options: { ...r.options, model: 'claude-other' } })],
    ['effort', (r) => ({ ...r, options: { ...r.options, effort: 'medium' } })],
    ['maxTokens', (r) => ({ ...r, options: { ...r.options, maxTokens: 4096 } })],
    ['flag set', (r) => ({ ...r, flags: [...r.flags, '--verbose'] })],
  ];
  const base = { prompt: 'p', options: OPTIONS, call: CALL(0), flags: ['-p', '--tools'], provider: { provider: 'claude-cli' as const, model: 'claude-opus-5-5', effort: 'high' as const } };

  it.each(variants)('changing %s alone is a replay miss', async (_name, change) => {
    const dir = tmpDir();
    await decorator(new StubProvider([ok(VALID)], base.provider, base.flags), dir).judge(base.prompt, base.options, base.call);
    const v = change(base);
    const replay = decorator(new StubProvider([ok(VALID)], v.provider, v.flags), dir, { mode: 'replay' });
    const result = await replay.judge(v.prompt, v.options, v.call);
    expect(result.kind).toBe('stop');
    if (result.kind === 'stop') expect(result.stop).toBe('CASSETTE_MISS');
  });

  it('cliVersion changed alone is a hit with a CLI_VERSION_DRIFT warning', async () => {
    const dir = tmpDir();
    await decorator(new StubProvider([ok(VALID)]), dir, { cliVersion: '2.1.294' }).judge('p', OPTIONS, CALL(0));
    const inner = new StubProvider([ok(VALID)]);
    const result = await decorator(inner, dir, { mode: 'replay', cliVersion: '2.1.300' }).judge('p', OPTIONS, CALL(0));
    expect(result.kind).toBe('final');
    if (result.kind === 'final') {
      expect(result.hit).toBe(true);
      expect(result.warnings.map((w) => w.code)).toEqual(['CLI_VERSION_DRIFT']);
    }
    expect(inner.calls).toBe(0);
  });
});

describe('CAS-04 recorded outcomes', () => {
  const mismatch: ResponseInterpreter = (response, request) => (response.model === request.model
    ? interpretTextAnswer(response, request)
    : { outcome: { kind: 'invalid', cause: 'MODEL_MISMATCH' }, verdict: null, resolvedModel: response.model });

  it.each([
    ['PARSE_FAILURE', [ok('not json')], {}, 1],
    ['MISSING_CONFIDENCE', [ok('{"pass":true,"reasoning":"r","evidence":[],"violations":[]}')], {}, 1],
    ['MODEL_MISMATCH', [ok(VALID, 'claude-sonnet-4-5')], { interpret: mismatch }, 1],
    ['TIMEOUT', [err('LLM_CLI_TIMEOUT'), err('LLM_CLI_TIMEOUT')], {}, 2],
    ['BAD_ENVELOPE', [err('LLM_CLI_BAD_ENVELOPE'), err('LLM_CLI_BAD_ENVELOPE')], {}, 2],
    ['CLI_EXIT', [err('LLM_CLI_EXIT'), err('LLM_CLI_EXIT')], {}, 2],
  ] as const)('%s is written with its outcome and attempts', async (cause, script, extra, attempts) => {
    const dir = tmpDir();
    const result = await decorator(new StubProvider(script), dir, extra).judge('p', OPTIONS, CALL(0));
    expect(result.kind).toBe('final');
    const entry = readCassetteEntry(dir, result.key);
    expect(entry?.outcome).toEqual({ kind: 'invalid', cause });
    expect(entry?.attempts).toBe(attempts);
    expect(entry?.parsedVerdict).toBeNull();
  });

  it('a bad envelope from the interpreter is retried once under the same key', async () => {
    const dir = tmpDir();
    let n = 0;
    const flaky: ResponseInterpreter = (response, request) => (n++ === 0
      ? { outcome: { kind: 'invalid', cause: 'BAD_ENVELOPE' }, verdict: null }
      : interpretTextAnswer(response, request));
    const result = await decorator(new StubProvider([ok(VALID)]), dir, { interpret: flaky }).judge('p', OPTIONS, CALL(0));
    expect(result.kind === 'final' && result.outcome).toEqual({ kind: 'valid' });
    expect(readCassetteEntry(dir, result.key)?.attempts).toBe(2);
  });

  it.each([
    ['LLM_USAGE_LIMIT', 'USAGE_LIMIT'], ['LLM_AUTH', 'AUTH'], ['LLM_CLI_NOT_FOUND', 'CLI_NOT_FOUND'],
    ['LLM_CLI_ISOLATION', 'ISOLATION'], ['LLM_CLI_VERSION_DRIFT', 'CLI_VERSION'],
  ])('%s is a stop: nothing written, not retried', async (code, stop) => {
    const dir = tmpDir();
    const inner = new StubProvider([err(code, 'You\'ve hit your limit')]);
    const result = await decorator(inner, dir).judge('p', OPTIONS, CALL(0));
    expect(result).toMatchObject({ kind: 'stop', stop });
    expect(inner.calls).toBe(1);
    expect(listCassetteKeys(dir)).toEqual([]);
  });
});

describe('CAS-05 modes', () => {
  it('a recorded PARSE_FAILURE is reused in record mode without calling the provider (T9)', async () => {
    const dir = tmpDir();
    await decorator(new StubProvider([ok('garbage')]), dir).judge('p', OPTIONS, CALL(0));
    const inner = new StubProvider([ok(VALID)]);
    const again = await decorator(inner, dir).judge('p', OPTIONS, CALL(0));
    expect(inner.calls).toBe(0);
    expect(again).toMatchObject({ kind: 'final', hit: true, outcome: { kind: 'invalid', cause: 'PARSE_FAILURE' } });
  });

  it('a replay miss is a CASSETTE_MISS stop carrying the missing-key count (T6)', async () => {
    const dir = tmpDir();
    const inner = new StubProvider([ok(VALID)]);
    const replay = decorator(inner, dir, { mode: 'replay' });
    const first = await replay.judge('p', OPTIONS, CALL(0));
    const second = await replay.judge('p', OPTIONS, CALL(1));
    const again = await replay.judge('p', OPTIONS, CALL(0));
    expect(first).toMatchObject({ kind: 'stop', stop: 'CASSETTE_MISS', missingKeys: 1 });
    expect(second).toMatchObject({ kind: 'stop', stop: 'CASSETTE_MISS', missingKeys: 2 });
    expect(again).toMatchObject({ missingKeys: 2 });
    expect(replay.missingKeyCount()).toBe(2);
    expect(inner.calls).toBe(0);
    expect(listCassetteKeys(dir)).toEqual([]);
  });

  it('the port form answers a valid call with the stored response and fails otherwise', async () => {
    const dir = tmpDir();
    const d = decorator(new StubProvider([ok(VALID), ok('nope')]), dir);
    const good = await d.evaluate('p', OPTIONS, CALL(0));
    expect(good.success && good.data.content).toBe(VALID);
    const bad = await d.evaluate('q', OPTIONS, CALL(0));
    expect(!bad.success && bad.errors[0]?.code).toBe('LLM_CALL_INVALID');
    const miss = await decorator(new StubProvider([]), dir, { mode: 'replay' }).evaluate('z', OPTIONS);
    expect(!miss.success && miss.errors[0]?.code).toBe('LLM_STOP_CASSETTE_MISS');
  });

  it('a provider that cannot judge (null) is a stop, never a recorded entry', async () => {
    const dir = tmpDir();
    const result = await decorator(new StubProvider([ok(VALID)], { provider: 'null', model: 'none' }), dir).judge('p', OPTIONS, CALL(0));
    expect(result).toMatchObject({ kind: 'stop', stop: 'CLI_NOT_FOUND' });
    expect(listCassetteKeys(dir)).toEqual([]);
  });
});

describe('CAS-06 retries', () => {
  it('timeout then valid → one entry, attempts 2, outcome valid', async () => {
    const dir = tmpDir();
    const inner = new StubProvider([err('LLM_CLI_TIMEOUT'), ok(VALID)]);
    const result = await decorator(inner, dir).judge('p', OPTIONS, CALL(0));
    expect(inner.calls).toBe(2);
    expect(listCassetteKeys(dir)).toEqual([result.key]);
    expect(readCassetteEntry(dir, result.key)).toMatchObject({ attempts: 2, outcome: { kind: 'valid' } });
  });
});

describe('CAS-07 scrubbing determinism (T13)', () => {
  const token = 'Bearer abcdefghijklmnopqrstuvwxyz0123456789';
  const leaky = JSON.stringify({ pass: false, confidence: 0.8, reasoning: `found ${token} and s3cr3t-known-value in config`, evidence: [], violations: [{ filePath: 'src/a.ts', message: `uses ${token}` }] });

  it('stores a scrubbed entry; record and replay results are JSON.stringify-equal', async () => {
    const dir = tmpDir();
    const secrets = ['s3cr3t-known-value'];
    const recorded = await decorator(new StubProvider([ok(leaky)]), dir, { knownSecrets: secrets }).judge('p', OPTIONS, CALL(0));
    const replayed = await decorator(new StubProvider([]), dir, { mode: 'replay', knownSecrets: secrets }).judge('p', OPTIONS, CALL(0));
    const raw = fs.readFileSync(cassetteFilePath(dir, recorded.key), 'utf8');
    expect(raw).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789');
    expect(raw).not.toContain('s3cr3t-known-value');
    if (recorded.kind !== 'final' || replayed.kind !== 'final') throw new Error('expected final results');
    expect(recorded.verdict?.reasoning).toContain('[REDACTED]');
    expect(recorded.outcome).toEqual({ kind: 'valid' });
    expect(JSON.stringify({ outcome: replayed.outcome, verdict: replayed.verdict })).toBe(JSON.stringify({ outcome: recorded.outcome, verdict: recorded.verdict }));
    expect(JSON.stringify(replayed.entry)).toBe(JSON.stringify(recorded.entry));
  });

  it('the request hash is taken before scrubbing (the key of a prompt with a token is the unscrubbed hash)', async () => {
    const dir = tmpDir();
    const prompt = `source ${token}`;
    const result = await decorator(new StubProvider([ok(VALID)]), dir).judge(prompt, OPTIONS, CALL(0));
    const expected = requestHashOf(buildJudgeRequest('claude-cli', prompt, OPTIONS, CALL(0), ['--tools', '-p', '--output-format=json']));
    expect(result.key).toBe(cassetteKeyOf(expected, 0, 0));
    expect(readCassetteEntry(dir, result.key)?.prompt).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789');
  });

  it('known secrets are the values of secret-looking environment names', () => {
    expect(knownSecretsFrom({ GEMINI_API_KEY: 'g-1', GITHUB_TOKEN: 't-2', NEO4J_PASSWORD: 'p-3', MY_SECRET: 's-4', PATH: '/bin', EMPTY_TOKEN: '' }))
      .toEqual(['g-1', 'p-3', 's-4', 't-2']);
  });
});

describe('CAS-08 default dir', () => {
  it('defaults to ./.firewall/cassettes, which .gitignore covers', () => {
    expect(DEFAULT_CASSETTE_DIR).toBe('./.firewall/cassettes');
    expect(DEFAULT_NEURONAL_OPTIONS.cassettePath).toBe(DEFAULT_CASSETTE_DIR);
    const lines = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8').split('\n');
    expect(lines).toContain('.firewall/');
  });
});

describe('CAS-09 omit-prompt entries', () => {
  it('has no prompt and a sourcePointer; replay from the rebuilt request hits', async () => {
    const dir = tmpDir();
    const options = { omitPrompt: true, sourceProject: { projectId: 'oss-1', commitSha: 'a'.repeat(40) } };
    const recorded = await decorator(new StubProvider([ok(VALID)]), dir, options).judge('rebuilt prompt', OPTIONS, CALL(0), ['src/b.ts', 'src/a.ts']);
    const entry = readCassetteEntry(dir, recorded.key);
    expect(entry !== null && 'prompt' in entry).toBe(false);
    expect(entry?.sourcePointer).toEqual({ projectId: 'oss-1', commitSha: 'a'.repeat(40), unitPaths: ['src/a.ts', 'src/b.ts'] });
    const replay = await decorator(new StubProvider([]), dir, { mode: 'replay' }).judge('rebuilt prompt', OPTIONS, CALL(0));
    expect(replay).toMatchObject({ kind: 'final', hit: true });
  });
});

describe('CAS-12 labeller reuse', () => {
  it('two labeller runs → two entries with runIndex 0/1 and distinct keys', async () => {
    const dir = tmpDir();
    const d = decorator(new StubProvider([ok(VALID)], { provider: 'mock', model: 'claude-opus-5-5' }), dir);
    const call = (runIndex: number): LLMCallContext => ({ runIndex, repetition: 0, functionId: 'label:P4:item-7' });
    const a = await d.judge('label prompt', OPTIONS, call(0));
    const b = await d.judge('label prompt', OPTIONS, call(1));
    expect(a.key).not.toBe(b.key);
    expect(listCassetteKeys(dir)).toEqual([a.key, b.key].sort());
    expect([readCassetteEntry(dir, a.key)?.runIndex, readCassetteEntry(dir, b.key)?.runIndex]).toEqual([0, 1]);
    expect(readCassetteEntry(dir, a.key)?.functionId).toBe('label:P4:item-7');
  });
});

describe('file store', () => {
  it('writes atomically with sorted keys and no temp file left', async () => {
    const dir = tmpDir();
    const result = await decorator(new StubProvider([ok(VALID)]), dir, { cliVersion: '2.1.294' }).judge('p', OPTIONS, CALL(0));
    const file = cassetteFilePath(dir, result.key);
    expect(path.basename(path.dirname(file))).toBe(result.key.slice(0, 2));
    const text = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(Object.keys(parsed).sort());
    expect(text.endsWith('\n')).toBe(true);
    expect(fs.readdirSync(path.dirname(file)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    expect(parsed).toMatchObject({ schemaVersion: 2, provider: 'claude-cli', model: 'claude-opus-5-5', resolvedModel: 'claude-opus-5-5', effort: 'high', cliVersion: '2.1.294', ignoredOptions: ['maxTokens'], recordedAt: '2026-10-08T00:00:00Z' });
    expect(canonicalJSON(parsed)).toBe(canonicalJSON(readCassetteEntry(dir, result.key)));
  });

  it('writes, reads and clears a run manifest under _incomplete/ (AGG-03)', () => {
    const dir = tmpDir();
    const manifest = {
      projectRoot: 'fixtures/correct-reference', stop: 'USAGE_LIMIT' as const, message: 'limit', completedCalls: 4,
      outstanding: [{ functionId: 'FF-N02', unitId: 'src/a.ts', runIndex: 1, key: 'k-r0-1' }],
    };
    const file = writeRunManifest(dir, 'fixtures/correct-reference', 'spec-sha', manifest);
    expect(file).toBe(runManifestPath(dir, 'fixtures/correct-reference', 'spec-sha'));
    expect(path.basename(path.dirname(file))).toBe('_incomplete');
    expect(path.basename(file)).toMatch(/^[0-9a-f]{16}\.json$/);
    expect(readRunManifest(dir, 'fixtures/correct-reference', 'spec-sha')).toEqual(manifest);
    expect(listCassetteKeys(dir)).toEqual([]);
    expect(clearRunManifest(dir, 'fixtures/correct-reference', 'spec-sha')).toBe(true);
    expect(fs.existsSync(path.join(dir, '_incomplete'))).toBe(false);
    expect(clearRunManifest(dir, 'fixtures/correct-reference', 'spec-sha')).toBe(false);
  });
});
