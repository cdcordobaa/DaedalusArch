import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { LLMProvider } from '../../../src/shared/interfaces/llm-provider.js';
import type { ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import {
  BudgetedRater, DEFAULT_GEMINI_CAP, ENSEMBLE_AGY_MODEL, EnsembleRater, GEMINI_HARD_USD_CEILING, ProviderRater, SpendLedger,
  agyRater, claudeCliRater, combineVerdicts, effectiveCap, geminiApiRater, verdictOfAnswer,
} from '../../../src/llm-critic/ensemble.js';
import type { RaterOutcome, RaterRequest } from '../../../src/llm-critic/ensemble.js';
import { VERDICT_SCHEMA_TEXT } from '../../../src/llm-critic/verdict-schema.js';

const verdict = (pass: boolean, confidence: number, violations: { filePath: string; message: string }[] = []): string =>
  JSON.stringify({ pass, confidence, reasoning: pass ? 'fits its layer' : 'misplaced rule', evidence: [], violations });

const REQUEST: RaterRequest = {
  prompt: 'judge this unit', responseSchema: VERDICT_SCHEMA_TEXT, functionId: 'FF-N02', unitId: 'src/a.ts',
  options: { model: 'm', maxTokens: 1000 },
};

function valid(rater: string, pass: boolean, confidence: number): RaterOutcome {
  return {
    rater, vendor: 'mock', model: 'mock-model', durationMs: 1, status: 'valid', usage: { inputTokens: 1, outputTokens: 1 },
    verdict: { pass, confidence, reasoning: rater, evidence: [], violations: pass ? [] : [{ filePath: 'src/a.ts', message: `${rater} says no` }] },
  };
}

/** A runner that cannot start any process (no binary): every CLI call fails to spawn. */
const noBinary: ProcessRunner = {
  run: () => Promise.resolve(DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: 'spawn ENOENT' }])),
};

describe('ensemble combination rules', () => {
  it('fail-if-both fails only when every valid rater fails; fail-if-either when any does', () => {
    const split = [valid('a', true, 0.9), valid('b', false, 0.8)];
    expect(combineVerdicts(split, 'fail-if-both').pass).toBe(true);
    expect(combineVerdicts(split, 'fail-if-either').pass).toBe(false);
    const bothFail = [valid('a', false, 0.9), valid('b', false, 0.7)];
    expect(combineVerdicts(bothFail, 'fail-if-both').pass).toBe(false);
    expect(combineVerdicts(bothFail, 'fail-if-either').pass).toBe(false);
    const bothPass = [valid('a', true, 0.9), valid('b', true, 0.7)];
    expect(combineVerdicts(bothPass, 'fail-if-both').pass).toBe(true);
    expect(combineVerdicts(bothPass, 'fail-if-either').pass).toBe(true);
  });

  it('confidence is the supporters\' mean, scaled by their share and by coverage', () => {
    const unanimous = combineVerdicts([valid('a', false, 0.9), valid('b', false, 0.7)], 'fail-if-both');
    expect(unanimous).toMatchObject({ status: 'decided', agreement: 'unanimous', confidence: 0.8, validRaters: 2, totalRaters: 2 });
    // Split under fail-if-either: one supporter of two -> 0.8 x 1/2.
    const split = combineVerdicts([valid('a', true, 0.9), valid('b', false, 0.8)], 'fail-if-either');
    expect(split).toMatchObject({ agreement: 'split', confidence: 0.4, pass: false });
    expect(split.verdict?.violations).toEqual([{ filePath: 'src/a.ts', message: 'b says no' }]);
    // A rater that errored lowers coverage: 0.9 x 1/1 x 1/2, and the result is degraded.
    const errored: RaterOutcome = { rater: 'c', vendor: 'agy', model: 'x', durationMs: 0, status: 'error', code: 'LLM_CLI_NOT_FOUND', message: 'no agy' };
    expect(combineVerdicts([valid('a', true, 0.9), errored], 'fail-if-both')).toMatchObject({ status: 'degraded', confidence: 0.45, pass: true });
  });

  it('no valid rater gives no verdict and confidence 0', () => {
    const skipped: RaterOutcome = { rater: 'g', vendor: 'gemini-api', model: 'x', durationMs: 0, status: 'skipped', reason: 'NOT_CONFIGURED' };
    expect(combineVerdicts([skipped], 'fail-if-either')).toMatchObject({ status: 'no-valid-rater', pass: null, confidence: 0, verdict: null });
  });

  it('runs every rater on the same request and de-duplicates violations', async () => {
    const v = verdict(false, 0.9, [{ filePath: 'src/a.ts', message: 'business rule in a controller' }]);
    const a = new MockLLMProvider(v);
    const b = new MockLLMProvider(v);
    const ensemble = new EnsembleRater([new ProviderRater('a', 'mock', a), new ProviderRater('b', 'mock', b)], 'fail-if-both');
    const out = await ensemble.rate(REQUEST);
    expect(a.getPrompts()).toEqual(['judge this unit']);
    expect(b.getLastCall()).toMatchObject({ responseSchema: VERDICT_SCHEMA_TEXT, functionId: 'FF-N02' });
    expect(out).toMatchObject({ pass: false, agreement: 'unanimous', confidence: 0.9 });
    expect(out.verdict?.violations).toHaveLength(1);
    expect(ensemble.describe()).toEqual({ provider: 'ensemble', model: 'fail-if-both(mock:mock-model,mock:mock-model)' });
  });
});

describe('rater answers', () => {
  it('reads a Claude CLI envelope (with the model check) and a text answer with the judge\'s strict parser', () => {
    const structured = { pass: true, confidence: 0.7, reasoning: 'ok', evidence: [], violations: [] };
    expect(verdictOfAnswer(JSON.stringify({ type: 'result', model: 'claude-opus-5-5', structured_output: structured }), 'claude-opus-5-5').kind).toBe('valid');
    expect(verdictOfAnswer(JSON.stringify({ type: 'result', model: 'other-model', structured_output: structured }), 'claude-opus-5-5')).toMatchObject({ kind: 'invalid', cause: 'MODEL_MISMATCH' });
    expect(verdictOfAnswer(`Here: ${verdict(true, 0.5)}`, 'x').kind).toBe('valid');
    expect(verdictOfAnswer('{"pass": true}', 'x')).toMatchObject({ kind: 'invalid', cause: 'MISSING_CONFIDENCE' });
  });

  it('never throws: a provider error or a throw is an error outcome, a bad answer is invalid', async () => {
    const failing: LLMProvider = { name: 'x', describe: () => ({ provider: 'mock', model: 'x' }), evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'LLM_USAGE_LIMIT', message: 'quota' }])) };
    const throwing: LLMProvider = { name: 'x', describe: () => ({ provider: 'mock', model: 'x' }), evaluate: () => Promise.reject(new Error('boom')) };
    expect(await new ProviderRater('f', 'mock', failing).rate(REQUEST)).toMatchObject({ status: 'error', code: 'LLM_USAGE_LIMIT' });
    expect(await new ProviderRater('t', 'mock', throwing).rate(REQUEST)).toMatchObject({ status: 'error', code: 'LLM_CALL_FAILED', message: 'boom' });
    expect(await new ProviderRater('m', 'mock', new MockLLMProvider('not json')).rate(REQUEST)).toMatchObject({ status: 'invalid', cause: 'PARSE_FAILURE' });
  });
});

describe('Gemini API budget', () => {
  it('clamps any dollar ceiling to the hard $5', () => {
    expect(GEMINI_HARD_USD_CEILING).toBe(5);
    expect(effectiveCap({ ...DEFAULT_GEMINI_CAP, maxUsd: 500 }).maxUsd).toBe(5);
    expect(effectiveCap({ ...DEFAULT_GEMINI_CAP, maxUsd: 1 }).maxUsd).toBe(1);
  });

  it('skips a call that could cross the call, token or dollar cap, and charges what was used', async () => {
    const inner = new MockLLMProvider(verdict(true, 0.9));
    const ledger = new SpendLedger();
    const rater = new BudgetedRater(new ProviderRater('gemini-api', 'gemini-api', inner), { maxCalls: 2, maxTokens: 1_000_000, maxUsd: 5, usdPerMInput: 1, usdPerMOutput: 1 }, ledger);
    expect((await rater.rate(REQUEST)).status).toBe('valid');
    expect((await rater.rate(REQUEST)).status).toBe('valid');
    expect(await rater.rate(REQUEST)).toMatchObject({ status: 'skipped', reason: expect.stringContaining('call cap') });
    expect(inner.getCallCount()).toBe(2);
    expect(ledger.spent.calls).toBe(2);

    const tokens = new BudgetedRater(new ProviderRater('g', 'gemini-api', inner), { maxCalls: 10, maxTokens: 500, maxUsd: 5, usdPerMInput: 1, usdPerMOutput: 1 });
    expect(await tokens.rate(REQUEST)).toMatchObject({ status: 'skipped', reason: expect.stringContaining('token cap') });

    // $5 ceiling, $10,000 per million output tokens: 1000 tokens of output would cost $10.
    const dollars = new BudgetedRater(new ProviderRater('g', 'gemini-api', inner), { maxCalls: 10, maxTokens: 1e9, maxUsd: 100, usdPerMInput: 0, usdPerMOutput: 10_000 });
    expect(await dollars.rate(REQUEST)).toMatchObject({ status: 'skipped', reason: expect.stringContaining('ceiling $5.00') });
    expect(inner.getCallCount()).toBe(2);
  });

  it('charges a failed call at the worst case and persists the ledger across instances', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ens-ledger-'));
    const file = path.join(dir, 'gemini-ledger.json');
    const failing: LLMProvider = { name: 'x', describe: () => ({ provider: 'gemini', model: 'g' }), evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'LLM_API_ERROR', message: 'x' }])) };
    const cap = { maxCalls: 1, maxTokens: 1e9, maxUsd: 5, usdPerMInput: 1, usdPerMOutput: 1 };
    expect((await new BudgetedRater(new ProviderRater('g', 'gemini-api', failing), cap, new SpendLedger(file)).rate(REQUEST)).status).toBe('error');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({ calls: 1, outputTokens: 1000 });
    // A new server process reads the ledger: the one-call cap is already spent.
    expect(await new BudgetedRater(new ProviderRater('g', 'gemini-api', failing), cap, new SpendLedger(file)).rate(REQUEST)).toMatchObject({ status: 'skipped' });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('starts at zero only without a ledger file; a truncated or unreadable ledger is an error', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ens-ledger-'));
    const file = path.join(dir, 'gemini-ledger.json');
    expect(new SpendLedger(file).spent).toEqual({ calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 });
    fs.writeFileSync(file, '{"calls": 3, "inputTok');
    expect(() => new SpendLedger(file)).toThrow(/not valid JSON/);
    fs.writeFileSync(file, '{"calls": 3}');
    expect(() => new SpendLedger(file)).toThrow(/does not hold/);
    fs.rmSync(file);
    fs.mkdirSync(file);
    expect(() => new SpendLedger(file)).toThrow(/Cannot read the spend ledger/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('replaces the ledger file atomically and leaves no temp file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ens-ledger-'));
    const file = path.join(dir, 'gemini-ledger.json');
    const ledger = new SpendLedger(file);
    ledger.add(10, 20, 0.5);
    ledger.add(1, 2, 0.25);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ calls: 2, inputTokens: 11, outputTokens: 22, usd: 0.75 });
    expect(fs.readdirSync(dir)).toEqual(['gemini-ledger.json']);
    // A rename that fails (here: the target became a non-empty directory) throws and removes its temp file.
    fs.rmSync(file);
    fs.mkdirSync(path.join(file, 'x'), { recursive: true });
    expect(() => ledger.add(1, 1, 1)).toThrow();
    expect(fs.readdirSync(dir)).toEqual(['gemini-ledger.json']);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reserves the worst case before the await, so concurrent calls cannot cross the cap', async () => {
    const mock = new MockLLMProvider(verdict(true, 0.9));
    let open: () => void = () => undefined;
    const gate = new Promise<void>((r) => { open = r; });
    const slow: LLMProvider = { name: 'slow', describe: () => mock.describe(), evaluate: async (...a) => { await gate; return mock.evaluate(...a); } };
    const ledger = new SpendLedger();
    // $1 per thousand output tokens and 1000 tokens of output per call: two calls fit under $2.50, a third does not.
    const rater = new BudgetedRater(new ProviderRater('g', 'gemini-api', slow), { maxCalls: 10, maxTokens: 1e9, maxUsd: 2.5, usdPerMInput: 0, usdPerMOutput: 1000 }, ledger);
    const pending = [rater.rate(REQUEST), rater.rate(REQUEST), rater.rate(REQUEST), rater.rate(REQUEST)];
    expect(ledger.committed.calls).toBe(2);
    expect(ledger.spent.calls).toBe(0);
    open();
    const results = await Promise.all(pending);
    expect(results.map((r) => r.status)).toEqual(['valid', 'valid', 'skipped', 'skipped']);
    expect(mock.getCallCount()).toBe(2);
    // Settled at the reported usage; nothing is left reserved.
    expect(ledger.committed).toEqual(ledger.spent);
    expect(ledger.spent.calls).toBe(2);
    expect(ledger.spent.usd).toBeLessThanOrEqual(2.5);
  });

  it('releases the reservation of a call the inner rater skipped, and charges one that threw', async () => {
    const ledger = new SpendLedger();
    const cap = { maxCalls: 1, maxTokens: 1e9, maxUsd: 5, usdPerMInput: 1, usdPerMOutput: 1 };
    const skipping = new BudgetedRater({ id: 's', vendor: 'gemini-api', model: 'm', complete: () => Promise.resolve({ rater: 's', vendor: 'gemini-api', model: 'm', durationMs: 0, status: 'skipped', reason: 'off' }), rate: () => Promise.reject(new Error('unused')) }, cap, ledger);
    expect((await skipping.complete(REQUEST)).status).toBe('skipped');
    expect(ledger.committed.calls).toBe(0);
    const throwing = new BudgetedRater({ id: 't', vendor: 'gemini-api', model: 'm', complete: () => Promise.reject(new Error('socket')), rate: () => Promise.reject(new Error('unused')) }, cap, ledger);
    await expect(throwing.complete(REQUEST)).rejects.toThrow('socket');
    expect(ledger.committed).toEqual(ledger.spent);
    expect(ledger.spent).toMatchObject({ calls: 1, outputTokens: 1000 });
  });

  it('is skipped without a model id or without the key in the environment', async () => {
    expect(await geminiApiRater({}, { env: { GEMINI_API_KEY: 'k' } }).rate(REQUEST)).toMatchObject({ status: 'skipped', reason: expect.stringContaining('--gemini-model') });
    expect(await geminiApiRater({ model: 'gemini-x' }, { env: {} }).rate(REQUEST)).toMatchObject({ status: 'skipped', reason: expect.stringContaining('GEMINI_API_KEY') });
    const stub = new MockLLMProvider(verdict(false, 0.6, [{ filePath: 'src/a.ts', message: 'dup rule' }]));
    const made: string[] = [];
    const rater = geminiApiRater({ model: 'gemini-x', cap: { maxCalls: 1 } }, { env: { GEMINI_API_KEY: 'secret-key' }, makeProvider: (key, model) => { made.push(`${key}/${model}`); return stub; } });
    expect(await rater.rate(REQUEST)).toMatchObject({ status: 'valid', vendor: 'gemini-api' });
    expect(made).toEqual(['secret-key/gemini-x']);
    expect((await rater.rate(REQUEST)).status).toBe('skipped');
  });
});

describe('CLI adapters (stubbed: no process starts)', () => {
  it('the Claude CLI rater runs the judge model on the isolated route and reports a missing binary as an error', async () => {
    const rater = claudeCliRater({}, { runner: noBinary, parentEnv: { PATH: '/nowhere' }, home: '/home/tester' });
    expect(rater).toMatchObject({ id: 'claude-cli', vendor: 'claude-cli', model: 'claude-opus-5-5' });
    const out = await rater.rate(REQUEST);
    expect(out.status).toBe('error');
  });

  it('the agy rater defaults to the Google subscription model and the dedicated home, and fails closed', async () => {
    const calls: { command: string; env?: Readonly<Record<string, string>> }[] = [];
    const runner: ProcessRunner = {
      run: (command, _args, options) => {
        calls.push({ command, ...(options.env !== undefined ? { env: options.env } : {}) });
        return Promise.resolve(DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: 'spawn ENOENT' }]));
      },
    };
    const rater = agyRater({}, { runner, parentEnv: { PATH: '/nowhere' }, home: '/home/tester' });
    expect(ENSEMBLE_AGY_MODEL).toBe('Gemini 4 Argon (High)');
    expect(rater).toMatchObject({ id: 'agy', vendor: 'agy', model: ENSEMBLE_AGY_MODEL });
    expect((await rater.rate(REQUEST)).status).toBe('error');
    for (const c of calls) {
      if (c.env !== undefined) expect(c.env.HOME).toBe('/home/tester/.firewall/labeller-agy-home');
    }
  });
});
