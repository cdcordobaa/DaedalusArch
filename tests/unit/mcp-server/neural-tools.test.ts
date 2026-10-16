import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { LLMProvider } from '../../../src/shared/interfaces/llm-provider.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { constructPrompt } from '../../../src/llm-critic/context-assembler.js';
import { FF_N02_RUBRIC, RUBRIC_OUT_OF_SCOPE } from '../../../src/llm-critic/rubric.js';
import { PROMPT_INSTRUCTIONS } from '../../../src/llm-critic/frozen.js';
import { JUDGE_V2_PERSONA } from '../../../src/llm-critic/judge-v2.js';
import { EnsembleRater, ProviderRater } from '../../../src/llm-critic/ensemble.js';
import { NEURAL_FOLLOW_UP, NEURAL_TOOL_NAMES, TOOL_NAMES, createServer } from '../../../src/mcp-server/server.js';
import { createSpecLoader, explainAndFixTool, reviewUnitTool } from '../../../src/mcp-server/tools.js';
import type { ServerContext } from '../../../src/mcp-server/tools.js';
import { EnsembleJudge, NeuralService, SingleJudge } from '../../../src/mcp-server/neural-service.js';
import type { NeuralJudge } from '../../../src/mcp-server/neural-service.js';
import { buildReviewPrompt, codeQuotes, groundVerdict, judgeProfileOf, locateQuote } from '../../../src/mcp-server/neural-review.js';
import { excerptAround } from '../../../src/mcp-server/neural-tools.js';
import type { ExplainAndFixResult, FixHintSource, ReviewUnitResult } from '../../../src/mcp-server/neural-tools.js';
import { buildNeuralService, judgeCliOf, parseNeuralArgs } from '../../../src/mcp-server/neural-context.js';
import { parseArgs } from '../../../src/mcp-server/context.js';
import { CLEAN_ARCH_SPEC, loadSpec } from './helpers.js';

const CONTROLLER = [
  "import { CreateOrder } from '../../application/CreateOrder';",
  'export class OrderController {',
  '  constructor(private readonly createOrder: CreateOrder) {}',
  '  post(body: { total: number; items: number }): number {',
  '    if (body.total > 1000 && body.items < 2) throw new Error("bulk discount rule");',
  '    return this.createOrder.run(body.total * 0.9);',
  '  }',
  '}',
  '',
].join('\n');
const USE_CASE = 'export class CreateOrder {\n  run(total: number): number {\n    return total;\n  }\n}\n';

const FAIL_GROUNDED = JSON.stringify({
  pass: false,
  confidence: 0.82,
  reasoning: 'The controller decides a pricing rule: src/infrastructure/http/OrderController.ts:5 holds the bulk discount check.',
  evidence: ['`if (body.total > 1000 && body.items < 2)` is a business rule'],
  violations: [{ filePath: 'src/infrastructure/http/OrderController.ts', message: 'Business rule `body.total * 0.9` in a presentation adapter' }],
});
const FAIL_UNGROUNDED = JSON.stringify({
  pass: false,
  confidence: 0.7,
  reasoning: 'It queries the database at src/infrastructure/http/OrderController.ts:44.',
  evidence: ['`db.query("select")` in the controller'],
  violations: [{ filePath: 'src/infrastructure/http/OrderController.ts', message: 'persistence in a controller' }],
});
const PASS = JSON.stringify({ pass: true, confidence: 0.9, reasoning: 'The use case only orchestrates.', evidence: [], violations: [] });

let root: string;
let cassettes: string;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'neural-mcp-'));
  cassettes = fs.mkdtempSync(path.join(os.tmpdir(), 'neural-cas-'));
  fs.mkdirSync(path.join(root, 'src/infrastructure/http'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/application'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/domain'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/infrastructure/http/OrderController.ts'), CONTROLLER);
  fs.writeFileSync(path.join(root, 'src/application/CreateOrder.ts'), USE_CASE);
  fs.writeFileSync(path.join(root, 'src/application/PriceOrder.ts'), 'export function price(t: number): number {\n  return t > 1000 ? t * 0.9 : t;\n}\n');
  fs.writeFileSync(path.join(root, 'src/domain/Order.ts'), 'export class Order {}\n');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'neural-outside-'));
  fs.writeFileSync(path.join(outside, 'secret.ts'), 'export const secret = 1;\n');
  fs.symlinkSync(path.join(outside, 'secret.ts'), path.join(root, 'src/domain/Leak.ts'));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(cassettes, { recursive: true, force: true });
});

function mockJudge(defaultResponse: string, responses: Record<string, string> = {}): { judge: SingleJudge; provider: MockLLMProvider } {
  const provider = new MockLLMProvider(defaultResponse);
  for (const [k, v] of Object.entries(responses)) provider.setResponse(k, v);
  const dir = fs.mkdtempSync(path.join(cassettes, 'j-'));
  // Hermetic: no secret from the test environment is scrubbed out of the stored answers.
  return { judge: new SingleJudge(provider, { cassette: { mode: 'record', dir }, knownSecrets: [] }), provider };
}

function ctx(neural?: NeuralService, extra: Partial<ServerContext> = {}): ServerContext {
  return {
    defaultSpecPath: CLEAN_ARCH_SPEC,
    defaultProjectPath: root,
    env: {},
    loadSpec: createSpecLoader(),
    evaluateDeps: { makeGraph: () => { throw new Error('no graph'); }, makePipeline: () => { throw new Error('no pipeline'); } },
    ...(neural !== undefined ? { neural } : {}),
    ...extra,
  };
}

async function review(c: ServerContext, args: Parameters<typeof reviewUnitTool>[1]): Promise<ReviewUnitResult> {
  const out = await reviewUnitTool(c, args);
  if (!out.ok) throw new Error(out.message);
  return out.data;
}

async function explain(c: ServerContext, args: Parameters<typeof explainAndFixTool>[1]): Promise<ExplainAndFixResult> {
  const out = await explainAndFixTool(c, args);
  if (!out.ok) throw new Error(out.message);
  return out.data;
}

describe('review_unit', () => {
  it('returns a grounded, advisory FAIL with citations into the shown code', async () => {
    const { judge, provider } = mockJudge(FAIL_GROUNDED);
    const r = await review(ctx(new NeuralService({ judge })), { path: 'src/infrastructure/http/OrderController.ts' });
    expect(r).toMatchObject({ status: 'fail', blocking: false, tier: 'advisory', judge: { version: 'v1', provider: 'mock' } });
    expect(r.unit).toMatchObject({ kind: 'file', functionId: 'FF-N02', layer: 'infrastructure', files: ['src/infrastructure/http/OrderController.ts'] });
    expect(r.grounding).toEqual({ grounded: true, problems: [] });
    expect(r.citations).toEqual(expect.arrayContaining([
      // The reasoning's `OrderController.ts:5` (the evidence quote locates the same line and is not repeated).
      expect.objectContaining({ file: 'src/infrastructure/http/OrderController.ts', startLine: 5, endLine: 5, via: 'reference', excerpt: expect.stringContaining('bulk discount rule') }),
      // The violation's quote `body.total * 0.9`, located on its own line.
      expect.objectContaining({ startLine: 6, endLine: 6, via: 'quote' }),
    ]));
    expect(r.citations).toHaveLength(2);
    // v1 is the frozen judge: no persona override, the frozen template and rubric.
    expect(provider.getLastCall()?.systemPrompt).toBeUndefined();
    const prompt = provider.getPrompts()[0] ?? '';
    expect(prompt).toContain(`## Rubric\nPass: ${FF_N02_RUBRIC.pass}`);
    expect(prompt).toContain(RUBRIC_OUT_OF_SCOPE);
    expect(prompt.endsWith(`## Instructions\n${PROMPT_INSTRUCTIONS}\n`)).toBe(true);
  });

  it('downgrades an ungrounded FAIL to inconclusive and lists why', async () => {
    const { judge } = mockJudge(FAIL_UNGROUNDED);
    const r = await review(ctx(new NeuralService({ judge })), { path: 'src/infrastructure/http/OrderController.ts' });
    expect(r.status).toBe('inconclusive');
    expect(r.grounding?.grounded).toBe(false);
    expect(r.grounding?.problems.join('\n')).toMatch(/outside 1-8[\s\S]*quote not found/);
    expect(r.nextStep).toMatch(/do not change code on an ungrounded verdict/);
  });

  it('caches by content hash and judge version: the same unit is answered without a call, a change or v2 is a new call', async () => {
    const { judge, provider } = mockJudge(PASS);
    const service = new NeuralService({ judge });
    const c = ctx(service);
    const a = await review(c, { path: 'src/application/CreateOrder.ts' });
    const b = await review(c, { path: 'src/application/CreateOrder.ts' });
    expect(a.status).toBe('pass');
    expect(b.job?.fromCache).toBe(true);
    expect(provider.getCallCount()).toBe(1);
    await review(c, { path: 'src/application/CreateOrder.ts', content: `${USE_CASE}// edited\n` });
    expect(provider.getCallCount()).toBe(2);
    const v2 = await review(c, { path: 'src/application/CreateOrder.ts', judgeVersion: 'v2' });
    expect(v2.judge).toMatchObject({ version: 'v2', revision: 'v2.1' });
    expect(provider.getCallCount()).toBe(3);
    expect(provider.getLastCall()?.systemPrompt).toBe(JUDGE_V2_PERSONA);
    expect(provider.getPrompts()[2]).toContain('## Neighbourhood\n(not available');
  });

  it('reviews a directory or a file list as one module (FF-N01)', async () => {
    const { judge, provider } = mockJudge(PASS);
    const r = await review(ctx(new NeuralService({ judge })), { path: 'src/application' });
    expect(r.unit).toMatchObject({ kind: 'module', functionId: 'FF-N01', id: 'src/application', files: ['src/application/CreateOrder.ts', 'src/application/PriceOrder.ts'] });
    expect(provider.getPrompts()[0]).toContain('## Exported signatures');
  });

  it('is async-friendly: a slow judge answers pending with a job id, and the job can be polled', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const slow: NeuralJudge = {
      id: 'slow', description: { provider: 'mock', model: 'slow' },
      verdict: async () => { await gate; return { status: 'valid', verdict: JSON.parse(PASS) as never, cassetteHit: false }; },
      explain: () => Promise.resolve({ status: 'error', code: 'X', message: 'x' }),
    };
    const c = ctx(new NeuralService({ judge: slow, waitMs: 10 }));
    const first = await review(c, { path: 'src/domain/Order.ts' });
    expect(first.status).toBe('pending');
    expect(first.nextStep).toContain(first.job?.jobId ?? 'missing');
    // A second call joins the running job instead of starting another.
    const joined = await review(c, { path: 'src/domain/Order.ts', wait: false });
    expect(joined.job?.jobId).toBe(first.job?.jobId);
    release?.();
    const polled = await review(c, { jobId: first.job?.jobId ?? '', waitMs: 1000 });
    expect(polled).toMatchObject({ status: 'pass', unit: { id: 'src/domain/Order.ts' } });
    expect((await reviewUnitTool(c, { jobId: 'nope' })).ok).toBe(false);
  });

  it('never fails the call on a provider error, and does not cache it', async () => {
    const broken: LLMProvider = { name: 'x', describe: () => ({ provider: 'mock', model: 'x' }), evaluate: () => Promise.resolve(DomainResult.fail([{ code: 'LLM_USAGE_LIMIT', message: 'quota' }])) };
    const service = new NeuralService({ judge: new SingleJudge(broken, { cassette: { mode: 'record', dir: fs.mkdtempSync(path.join(cassettes, 'b-')) }, knownSecrets: [] }) });
    const r = await review(ctx(service), { path: 'src/domain/Order.ts' });
    expect(r).toMatchObject({ status: 'error', blocking: false, error: { code: 'USAGE_LIMIT' } });
    expect(service.cached('anything')).toBeUndefined();
  });

  it('says how to turn the arm on, refuses v2.2 on this build, and confines reads to the project root', async () => {
    expect((await review(ctx(), { path: 'src/domain/Order.ts' }))).toMatchObject({ status: 'not-configured', blocking: false, nextStep: expect.stringContaining('--neural claude-cli') });
    const { judge } = mockJudge(PASS);
    const c = ctx(new NeuralService({ judge }));
    expect(await review(c, { path: 'src/domain/Order.ts', judgeVersion: 'v2.2' })).toMatchObject({ status: 'unavailable', summary: expect.stringContaining('v1.3-judge-v22-prep') });
    const leak = await reviewUnitTool(c, { path: 'src/domain/Leak.ts' });
    expect(leak).toEqual({ ok: false, message: 'src/domain/Leak.ts resolves outside the project root' });
  });

  it('runs the ensemble with each rater\'s outcome and the combined confidence', async () => {
    const yes = new ProviderRater('claude-cli', 'mock', new MockLLMProvider(FAIL_GROUNDED));
    const no = new ProviderRater('agy', 'mock', new MockLLMProvider(PASS));
    const either = new NeuralService({ judge: new EnsembleJudge(new EnsembleRater([yes, no], 'fail-if-either')) });
    const r = await review(ctx(either), { path: 'src/infrastructure/http/OrderController.ts' });
    expect(r.status).toBe('fail');
    expect(r.ensemble).toMatchObject({ rule: 'fail-if-either', agreement: 'split', confidence: 0.41, validRaters: 2 });
    const both = new NeuralService({ judge: new EnsembleJudge(new EnsembleRater([yes, no], 'fail-if-both')) });
    expect((await review(ctx(both), { path: 'src/infrastructure/http/OrderController.ts' })).status).toBe('pass');
  });
});

describe('review_unit prompt and grounding (pure)', () => {
  it('builds the v1 prompt with the frozen template, sections and an empty graph excerpt', async () => {
    const spec = await loadSpec(CLEAN_ARCH_SPEC);
    const profile = judgeProfileOf('v1');
    if (profile === undefined) throw new Error('v1');
    const built = buildReviewPrompt({ spec, profile, files: [{ path: 'src/domain/Order.ts', content: 'export class Order {}\n' }] });
    expect(built.prompt).toBe(constructPrompt({
      rule: FF_N02_RUBRIC.rule, rubric: { pass: FF_N02_RUBRIC.pass, fail: FF_N02_RUBRIC.fail, evidenceRequired: FF_N02_RUBRIC.evidenceRequired },
      layerModel: '- domain (kind: domain): src/domain/**\n- application (kind: application): src/application/**\n- infrastructure (kind: infrastructure): src/infrastructure/**',
      unitId: 'src/domain/Order.ts', unitKind: 'file', unitLayer: 'domain', unitFiles: ['src/domain/Order.ts'],
      source: '=====SOURCE-BEGIN src/domain/Order.ts=====\nexport class Order {}\n\n=====SOURCE-END=====',
      incoming: [], outgoing: [], apgSubgraph: '{"edges":[],"nodes":[]}',
    }));
    expect(judgeProfileOf('v2.2')).toBeUndefined();
  });

  it('locates quotes over line breaks and whitespace, and requires a located line for a failure', () => {
    const shown = [{ path: 'src/a.ts', content: 'const a = 1;\nif (x &&\n    y) {\n  go();\n}\n' }];
    expect(locateQuote('if (x && y)', shown)).toEqual({ file: 'src/a.ts', line: 2, endLine: 3 });
    expect(codeQuotes('uses `go()` and ```\nconst a = 1;\n```')).toEqual(['go()', 'const a = 1;']);
    const fail = { pass: false, confidence: 0.5, reasoning: 'bad', evidence: [], violations: [{ filePath: 'src/a.ts', message: 'a problem' }] };
    expect(groundVerdict(fail, shown).problems).toEqual(['a failing verdict cites no located line (no code quote or line reference found in the shown source)']);
    expect(groundVerdict({ ...fail, violations: [{ filePath: 'src/b.ts', message: 'calls `go()`' }] }, shown).problems).toEqual(['violation names a file not shown: src/b.ts']);
    expect(groundVerdict({ ...fail, pass: true, violations: [] }, shown)).toMatchObject({ grounded: true, citations: [] });
  });
});

describe('explain_and_fix', () => {
  const finding = {
    ruleId: 'FF-S01', ruleName: 'dependency-direction', file: 'src/infrastructure/http/OrderController.ts', line: 1,
    reason: 'infrastructure may import application', subject: 'import "../../application/CreateOrder"',
    fix: 'Depend on a port instead.',
  };
  const CONFIRM = JSON.stringify({
    decision: 'confirm',
    explanation: 'The controller imports the use case class directly (src/infrastructure/http/OrderController.ts:1) and constructs the discount on line 6.',
    fix: 'Inject an application port.',
    citations: [{ filePath: 'src/infrastructure/http/OrderController.ts', startLine: 1, endLine: 6 }],
  });
  const DISMISS_UNGROUNDED = JSON.stringify({
    decision: 'dismiss', explanation: 'Fine, see src/infrastructure/http/OrderController.ts:99.', fix: '', citations: [{ filePath: 'src/infrastructure/http/OrderController.ts', startLine: 99, endLine: 99 }],
  });

  it('combines the fix hint, the grounded judge explanation and the excerpt into one message', async () => {
    const { judge, provider } = mockJudge(CONFIRM);
    const hints: FixHintSource = (_spec, f) => ({ problem: 'p', fix: { action: 'introduce-port', text: `Add a port for ${f.target ?? '?'} in src/application/ports.` }, target: { layer: 'application', folder: 'src/application', path: 'src/application/ports/CreateOrderPort.ts' } });
    const r = await explain(ctx(new NeuralService({ judge }), { fixHints: hints }), { finding });
    expect(r).toMatchObject({ status: 'explained', blocking: false, judge: { status: 'confirm', revision: 'fe-1.0' }, fixHint: { source: 'fix-hints', action: 'introduce-port' } });
    expect(r.message).toContain('[FF-S01] src/infrastructure/http/OrderController.ts:1: infrastructure may import application');
    expect(r.message).toContain('Why (judge, grounded): The controller imports the use case class');
    expect(r.message).toContain('Fix: Add a port for ../../application/CreateOrder in src/application/ports. (target: src/application/ports/CreateOrderPort.ts)');
    expect(r.message).toContain("Judge's fix: Inject an application port.");
    expect(r.message).toContain(">1| import { CreateOrder } from '../../application/CreateOrder';");
    expect(provider.getLastCall()).toMatchObject({ functionId: 'explain:FF-S01', systemPrompt: expect.stringContaining('architecture reviewer') });
  });

  it('drops an ungrounded explanation and still gives the finding\'s fix and the code', async () => {
    const { judge } = mockJudge(DISMISS_UNGROUNDED);
    const r = await explain(ctx(new NeuralService({ judge })), { finding });
    expect(r).toMatchObject({ status: 'unexplained', judge: { status: 'rejected' }, fixHint: { source: 'finding', text: 'Depend on a port instead.' } });
    expect(r.message).toContain('Judge explanation dropped');
    expect(r.message).toContain('Fix: Depend on a port instead.');
  });

  it('works without the neural arm (hint and excerpt only) and uses a hint carried by the finding', async () => {
    const r = await explain(ctx(), { finding: { ...finding, hint: { fix: { action: 'move-file', text: 'Move it.' } } } });
    expect(r).toMatchObject({ status: 'unexplained', judge: { status: 'not-configured' }, fixHint: { source: 'fix-hints', text: 'Move it.' } });
    expect(r.excerpt).toMatchObject({ startLine: 1, endLine: 4 });
  });

  it('reports a grounded dismiss as disputed and keeps the finding standing', async () => {
    const dismiss = JSON.stringify({ decision: 'dismiss', explanation: 'Line 1 imports only a type-free class name used for injection.', fix: 'Allow the edge in the spec.', citations: [{ filePath: 'src/infrastructure/http/OrderController.ts', startLine: 1, endLine: 3 }] });
    const { judge } = mockJudge(dismiss);
    const r = await explain(ctx(new NeuralService({ judge })), { finding });
    expect(r.status).toBe('disputed');
    expect(r.message).toContain('The symbolic finding still stands');
  });

  it('marks the reported line in the excerpt, or finds the target', () => {
    expect(excerptAround('a.ts', 'a\nb\nc\nd\ne\n', 3, undefined, 1).text).toBe(' 2| b\n>3| c\n 4| d');
    expect(excerptAround('a.ts', 'a\nimport x from "y";\nc\n', undefined, 'y', 0).text).toBe('>2| import x from "y";');
  });
});

describe('server wiring', () => {
  async function toolList(c: ServerContext): Promise<{ name: string; description?: string }[]> {
    const server = createServer(c);
    const client = new Client({ name: 't', version: '0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    const { tools } = await client.listTools();
    await client.close();
    await server.close();
    return tools;
  }

  it('registers nothing new and keeps every description unchanged when the arm is off', async () => {
    const tools = await toolList(ctx());
    expect(tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    expect(tools.some((t) => (t.description ?? '').includes('review_unit'))).toBe(false);
  });

  it('adds the neural tools and tells the agent when to call them when the arm is on', async () => {
    const { judge } = mockJudge(PASS);
    const tools = await toolList(ctx(new NeuralService({ judge })));
    expect(tools.map((t) => t.name)).toEqual([...TOOL_NAMES, ...NEURAL_TOOL_NAMES]);
    for (const name of ['check_file', 'check_diff', 'evaluate_project']) {
      expect(tools.find((t) => t.name === name)?.description?.endsWith(NEURAL_FOLLOW_UP)).toBe(true);
    }
    const reviewDescription = tools.find((t) => t.name === 'review_unit')?.description ?? '';
    expect(reviewDescription).toMatch(/after check_file or check_diff is clean/);
    expect(reviewDescription).toMatch(/business logic in a controller/);
    expect(reviewDescription).toMatch(/same business rule or validation written twice/);
    expect(reviewDescription).toMatch(/framework, transport or ORM types leaking/);
  });

  it('calls review_unit over the protocol', async () => {
    const { judge } = mockJudge(PASS);
    const server = createServer(ctx(new NeuralService({ judge })));
    const client = new Client({ name: 't', version: '0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    const res = await client.callTool({ name: 'review_unit', arguments: { path: 'src/application/CreateOrder.ts' } });
    expect((res.structuredContent as { status?: string }).status).toBe('pass');
    const ex = await client.callTool({ name: 'explain_and_fix', arguments: { finding: { rule: 'FF-S01', filePath: 'src/application/CreateOrder.ts', line: 1 } } });
    expect(ex.isError).not.toBe(true);
    await client.close();
    await server.close();
  });

  it('parses the neural flags; off by default; rejects a mistyped mode, rater or rule', () => {
    expect(parseArgs(['--spec', 's.yaml'])).toEqual({ spec: 's.yaml' });
    expect(parseNeuralArgs([], {})).toBeUndefined();
    expect(parseNeuralArgs(['--neural', 'off'], { DAEDALUS_NEURAL: 'claude-cli' })).toEqual({ mode: 'off' });
    expect(parseNeuralArgs([], { DAEDALUS_NEURAL: 'mock' })).toEqual({ mode: 'mock' });
    expect(parseNeuralArgs(['--neural=ensemble', '--ensemble-raters', 'claude-cli,agy,gemini-api', '--ensemble-rule', 'fail-if-either', '--gemini-model', 'gemini-x', '--gemini-max-usd', '50', '--neural-wait-ms', '5000'])).toEqual({
      mode: 'ensemble', raters: ['claude-cli', 'agy', 'gemini-api'], rule: 'fail-if-either', geminiModel: 'gemini-x', geminiCap: { maxUsd: 50 }, waitMs: 5000,
    });
    expect(() => parseNeuralArgs(['--neural', 'gpt'])).toThrow(/expected one of/);
    expect(() => parseNeuralArgs(['--neural', 'ensemble', '--ensemble-raters', 'openai'])).toThrow(/ensemble-raters/);
    expect(() => parseNeuralArgs(['--neural', 'ensemble', '--ensemble-rule', 'majority'])).toThrow(/ensemble-rule/);
  });

  it('builds no service when off, and the ensemble from stub raters (nothing spawned)', () => {
    expect(buildNeuralService(undefined, {})).toBeUndefined();
    expect(buildNeuralService({ mode: 'off' }, {})).toBeUndefined();
    const made: string[] = [];
    const service = buildNeuralService({ mode: 'ensemble', raters: ['claude-cli', 'gemini-api'] }, {}, {
      makeRater: (name) => { made.push(name); return new ProviderRater(name, 'mock', new MockLLMProvider(PASS)); },
    });
    expect(made).toEqual(['claude-cli', 'gemini-api']);
    expect(service?.judge?.description).toMatchObject({ provider: 'ensemble', rule: 'fail-if-both' });
    expect(buildNeuralService({ mode: 'mock' }, {}, { cwd: cassettes })?.judge?.description).toEqual({ provider: 'mock', model: 'mock-model' });
  });

  it('runs the pinned judge CLI when it is installed, else claude on PATH, unless --judge-cli says otherwise', () => {
    expect(judgeCliOf({}, '/h', () => true)).toBe('/h/.firewall/judge-cli/node_modules/.bin/claude');
    expect(judgeCliOf({}, '/h', () => false)).toBe('claude');
    expect(judgeCliOf({ judgeCli: '~/bin/claude' }, '/h', () => true)).toBe('/h/bin/claude');
    expect(parseNeuralArgs(['--neural', 'claude-cli', '--judge-cli=/opt/claude'])).toEqual({ mode: 'claude-cli', judgeCli: '/opt/claude' });
  });
});
