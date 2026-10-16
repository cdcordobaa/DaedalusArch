import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SampledFinding } from '../../../../../scripts/v1.3/lib/labelling/sampler.js';
import type { LabellingJob } from '../../../../../scripts/v1.3/lib/labelling/findings.js';
import {
  LETTERS, MEANINGFUL_OPTIONS, claimText, loadStyleSources, optionOrder, parseAnswer, parseStyleSources, renderPrompt, styleDefinition,
} from '../../../../../scripts/v1.3/lib/labelling/meaningful-prompt.js';
import { estimateCalls, labelItems, perRule, promptFor, reconcile } from '../../../../../scripts/v1.3/lib/labelling/meaningful.js';
import {
  CassetteMissError, CassetteStore, ProviderError, buildCodexLabelArgs, cassetteCall, cassetteKey, codexProvider, geminiProvider, mockProvider, parseCodexAnswer, scrub,
} from '../../../../../scripts/v1.3/lib/labelling/providers.js';
import type { ProviderRequest } from '../../../../../scripts/v1.3/lib/labelling/providers.js';
import { labelMain } from '../../../../../scripts/v1.3/lib/labelling/mains.js';
import { FORBIDDEN_CODEX_FLAGS } from '../../../../../scripts/lib/generators/codex-cli.js';
import { DomainResult } from '../../../../../src/shared/errors/domain-result.js';
import type { ProcessRunner } from '../../../../../src/shared/interfaces/process-runner.js';

const REPO = path.resolve(__dirname, '../../../../..');
const MINI = path.join(REPO, 'tests/fixtures/v1.3-labelling/clean-mini');
const STYLE_DOC = loadStyleSources(REPO);

const item: SampledFinding = {
  key: 'k1', projectId: 'mini', style: 'clean-architecture', ruleId: 'FF-S01', template: 'dependency-direction', type: 'LAYER_VIOLATION',
  tier: 'blocking', file: 'src/domain/Order.ts', line: 1, target: 'src/infrastructure/Db.ts', discriminator: ['IMPORTS'], evidence: [],
  message: 'src/domain/Order.ts (domain) imports from src/infrastructure/Db.ts (infrastructure)', rule: 'FF-S01/dependency-direction', inclusionProbability: 1,
};
const jobs = new Map<string, LabellingJob>([['mini', { projectId: 'mini', projectRoot: MINI, spec: path.join(MINI, 'spec.yaml'), report: '' }]]);

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-meaningful-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('neutral prompt', () => {
  it('reads the style definition without rule ids or template names', () => {
    const rows = parseStyleSources(STYLE_DOC);
    expect(rows.length).toBeGreaterThan(10);
    const def = styleDefinition(STYLE_DOC, 'hexagonal');
    expect(def).toContain('Cockburn');
    expect(def).not.toMatch(/FF-[A-Z]+\d|core-isolation|port-adapter-pattern/);
    expect(styleDefinition(STYLE_DOC, 'nestjs')).toContain('Providers are encapsulated');
  });

  it('holds the excerpt, the claim and the question, and never the rule id', () => {
    const { prompt, order } = promptFor({ ...item, message: `FF-S01: ${item.message}` }, 0, { seed: 1, styleDoc: STYLE_DOC, jobs });
    expect(order).toEqual([...MEANINGFUL_OPTIONS]);
    expect(prompt).toContain("1 | import { Db } from '../infrastructure/Db.js';");
    expect(prompt).toContain('Would an architect following this style want this changed?');
    expect(prompt).toContain('A. yes');
    expect(prompt).not.toMatch(/FF-[A-Z]+\d/);
    expect(prompt).not.toContain('LAYER_VIOLATION');
    expect(prompt).not.toContain('dependency-direction');
  });

  it('describes generic-message findings from their fields', () => {
    const { target: _t, ...noTarget } = item;
    expect(claimText({ ...noTarget, template: 'repository-pattern', message: 'Violation in x', discriminator: ['OrderRepository'] }))
      .toContain('repository class that implements no interface');
  });

  it('permutes the options in run 1 only, deterministically, and maps the letter back', () => {
    const o1 = optionOrder(1, 9, 'k1');
    expect(o1).not.toEqual([...MEANINGFUL_OPTIONS]);
    expect([...o1].sort()).toEqual([...MEANINGFUL_OPTIONS].sort());
    expect(optionOrder(1, 9, 'k1')).toEqual(o1);
    const letter = LETTERS[o1.indexOf('no')];
    expect(parseAnswer(`\`\`\`json\n{"choice":"${letter ?? ''}","reason":"r"}\n\`\`\``, o1)).toEqual({ label: 'no', reason: 'r' });
    expect(parseAnswer('{"choice":"D","reason":"r"}', o1)).toHaveProperty('invalid');
    expect(parseAnswer('{"choice":"A","reason":""}', o1)).toHaveProperty('invalid');
    expect(parseAnswer('not json', o1)).toHaveProperty('invalid');
    expect(renderPrompt({ finding: item, source: null, styleDefinition: '-', order: o1 })).toContain('(file not readable)');
  });
});

describe('runner and cassettes', () => {
  /** Answers by option word, whatever letter the run shows it under. */
  const answering = (word: string) => (req: ProviderRequest): string => {
    const m = new RegExp(`([ABC])\\. ${word}`).exec(req.prompt);
    return JSON.stringify({ choice: m?.[1] ?? 'A', reason: 'because' });
  };

  it('records two runs, reconciles agreeing runs, and replays from cassettes without calling', async () => {
    const calls: string[] = [];
    const provider = mockProvider((req) => { calls.push(req.prompt); return answering('yes')(req); });
    const store = new CassetteStore(tmp, 'record');
    const labels = await labelItems([item], { seed: 3, repoRoot: REPO, styleDoc: STYLE_DOC, jobs, store, provider });
    expect(calls).toHaveLength(2);
    expect(labels[0]).toMatchObject({ label: 'yes', agreement: 'agree' });
    expect(labels[0]?.runs.map((r) => r.order)).toEqual([[...MEANINGFUL_OPTIONS], optionOrder(1, 3, 'k1')]);

    const replayStore = new CassetteStore(tmp, 'replay');
    const never = mockProvider(() => { throw new Error('called'); });
    const again = await labelItems([item], { seed: 3, repoRoot: REPO, styleDoc: STYLE_DOC, jobs, store: replayStore, provider: never });
    expect(again).toEqual(labels);
    await expect(labelItems([{ ...item, key: 'k2' }], { seed: 3, repoRoot: REPO, styleDoc: STYLE_DOC, jobs, store: replayStore, provider: never }))
      .rejects.toBeInstanceOf(CassetteMissError);
  });

  it('re-asks an invalid answer once, then marks the run invalid; disagreeing runs are uncertain', async () => {
    let n = 0;
    const flaky = mockProvider((req) => { n += 1; return n === 1 ? 'garbage' : answering('no')(req); });
    const [l] = await labelItems([item], { seed: 3, repoRoot: REPO, styleDoc: STYLE_DOC, jobs, store: new CassetteStore(tmp, 'record'), provider: flaky });
    expect(l?.runs[0]?.reasked).toBe(true);
    expect(l?.label).toBe('no');
    const bad = await labelItems([item], { seed: 4, repoRoot: REPO, styleDoc: STYLE_DOC, jobs, store: new CassetteStore(path.join(tmp, 'b'), 'record'), provider: mockProvider(() => 'garbage') });
    expect(bad[0]).toMatchObject({ label: 'uncertain', agreement: 'invalid-run' });
    expect(reconcile([{ label: 'yes' }, { label: 'no' }] as never)).toEqual({ label: 'uncertain', agreement: 'disagree' });
    expect(perRule(bad)[0]).toMatchObject({ n: 1, uncertain: 1, yes: 0 });
  });

  it('retries a retryable provider failure once and never stores a stop', async () => {
    const store = new CassetteStore(tmp, 'record');
    const req = { system: 's', prompt: 'p', temperature: 0 };
    let k = 0;
    const once = { id: 'mock' as const, model: 'm', call: () => (k++ === 0 ? Promise.reject(new ProviderError('X', 'x', 'retry')) : Promise.resolve({ text: 't', servedModel: 'm' })) };
    const r = await cassetteCall(store, once, req, 0, 'i');
    expect('entry' in r && r.entry.failedAttempts).toEqual(['X']);
    const stop = { id: 'mock' as const, model: 'm2', call: () => Promise.reject(new ProviderError('LLM_USAGE_LIMIT', 'limit', 'stop')) };
    await expect(cassetteCall(store, stop, req, 0, 'i')).rejects.toThrow('limit');
    expect(store.read(cassetteKey('mock', 'm2', req, 0))).toBeNull();
  });

  it('estimates the call count without calling', async () => {
    expect(estimateCalls(53).calls).toBe(106);
    const sample = path.join(tmp, 'sample.json');
    fs.writeFileSync(sample, JSON.stringify({ items: [item, { ...item, key: 'k2' }] }));
    const out: string[] = [];
    const code = await labelMain(['--sample', sample, '--estimate'], REPO, { env: {}, out: (t) => out.push(t), err: () => undefined },
      { provider: () => { throw new Error('no provider in estimate mode'); } });
    expect(code).toBe(0);
    expect(out.join('')).toContain('estimate: 4 calls (2 items x 2 runs)');
  });
});

describe('providers', () => {
  it('runs codex read-only with web search, shell and plugins off, and no widening flag', () => {
    const args = buildCodexLabelArgs({ model: 'gpt-x', codexHome: '/h/c', userHome: '/h/u' }, '/tmp/cwd');
    const s = args.join(' ');
    expect(s).toContain('--sandbox read-only');
    expect(s).toContain('web_search="disabled"');
    expect(s).toContain('--disable shell_tool');
    expect(s).toContain('--disable plugins');
    expect(args[args.length - 1]).toBe('-');
    for (const flag of FORBIDDEN_CODEX_FLAGS) expect(args).not.toContain(flag);
  });

  it('reads the codex answer, fails closed on a tool step, stops on a usage limit', () => {
    const ok = [
      { type: 'thread.started', thread_id: 't' },
      { type: 'item.completed', item: { type: 'reasoning', text: '...' } },
      { type: 'item.completed', item: { type: 'agent_message', text: '{"choice":"A","reason":"r"}' } },
      { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 3 } },
    ].map((e) => JSON.stringify(e)).join('\n');
    expect(parseCodexAnswer(ok)).toMatchObject({ text: '{"choice":"A","reason":"r"}', inputTokens: 10 });
    const tool = JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'ls' } });
    expect(() => parseCodexAnswer(tool)).toThrow(expect.objectContaining({ code: 'LABEL_TOOL_USE', kind: 'retry' }) as Error);
    const limit = JSON.stringify({ type: 'turn.failed', error: { message: "You've hit your usage limit" } });
    expect(() => parseCodexAnswer(limit)).toThrow(expect.objectContaining({ code: 'LLM_USAGE_LIMIT', kind: 'stop' }) as Error);
  });

  it('calls codex through the runner with the prompt on stdin and a scrubbed child env', async () => {
    const seen: { args: readonly string[]; stdin?: string; env: Readonly<Record<string, string>>; cwd?: string }[] = [];
    const runner: ProcessRunner = {
      run: (_c, args, o) => {
        seen.push({ args, env: o.env, ...(o.stdin !== undefined && { stdin: o.stdin }), ...(o.cwd !== undefined && { cwd: o.cwd }) });
        const out = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'hi' } });
        return Promise.resolve(DomainResult.ok({ exitCode: 0, stdout: out, stderr: '', timedOut: false, durationMs: 1 }));
      },
    };
    const p = codexProvider({ model: 'gpt-x', codexHome: '/h/c', userHome: '/h/u' }, runner, { PATH: '/bin', OPENAI_API_KEY: 'sk-secret-123456', HOME: '/root' });
    const a = await p.call({ system: 'SYS', prompt: 'PROMPT', temperature: 0 });
    expect(a.text).toBe('hi');
    expect(seen[0]?.stdin).toBe('SYS\n\nPROMPT');
    expect(seen[0]?.env.OPENAI_API_KEY).toBeUndefined();
    expect(seen[0]?.env.CODEX_HOME).toBe('/h/c');
    expect(fs.existsSync(seen[0]?.cwd ?? '/nonexistent')).toBe(false);
  });

  it('gemini needs GEMINI_API_KEY and keys never reach text', () => {
    expect(() => geminiProvider('gemini-x', {})).toThrow(/GEMINI_API_KEY/);
    expect(scrub('key=abcdefgh123 here', ['abcdefgh123'])).toBe('key=[REDACTED] here');
  });
});
