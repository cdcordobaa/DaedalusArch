import { evaluateNeuronal } from '../../../src/llm-critic/llm-critic.js';
import { assembleContext, constructPrompt } from '../../../src/llm-critic/context-assembler.js';
import { parseVerdict } from '../../../src/llm-critic/verdict-parser.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { writeCassetteEntry, readCassetteEntry, listCassetteKeys } from '../../../src/llm-critic/cassette-manager.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { NeuronalInstruction, ContextAssemblyInstruction } from '../../../src/shared/types/evaluation.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DEFAULT_NEURONAL_OPTIONS } from '../../../src/llm-critic/types.js';
import type { JudgeGraphView } from '../../../src/llm-critic/judge-graph.js';

// U4-K2 (D-U0-3): the default cassette mode is 'record', so every evaluateNeuronal call below
// writes its cassettes to a temp dir instead of the repository-relative default path. Each call
// gets its own dir: identical requests share a key (BR-U4-CAS-08), so a shared dir would replay.
const CASSETTE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-k2-cassettes-'));
afterAll(() => { fs.rmSync(CASSETTE_DIR, { recursive: true, force: true }); });

const CTX: ContextAssemblyInstruction = { includeAPGSubgraph: true, includeSourceCode: true };

const makeInstruction = (id: string, name: string): NeuronalInstruction => ({
  functionId: functionId(id),
  name,
  dimension: 'solid',
  severity: 'major',
  route: 'neuronal',
  semanticCriteria: {
    rule: 'A class should have one responsibility',
    rubric: { pass: 'Cohesive', fail: 'Mixed concerns', evidenceRequired: 'Cite methods' },
  },
  contextAssembly: CTX,
  shadowModeEligible: false,
  source: 'fitness-function',
  judgeUnit: 'file',
});

// The CTX-06 template is covered in source-context.test.ts; these keep the C7 entry points honest.
const unitInput = (source: string) => ({
  unit: { id: 'src/a.ts', kind: 'file' as const, layer: 'domain', filePaths: ['src/a.ts'] },
  context: {
    unitId: 'src/a.ts', source, incoming: [], outgoing: [], subgraphExcerpt: '{"edges":[],"nodes":[]}',
    truncated: false, filesOmitted: [], excerptTruncated: false,
  },
  evaluatorSpecLayers: [],
});

describe('context-assembler', () => {
  it('assembles context with all fields', () => {
    const inst = makeInstruction('FF-N01', 'srp-test');
    const ctx = assembleContext(inst, unitInput('const x = 1;'), 'ADR: use DDD');
    expect(ctx.rule).toContain('one responsibility');
    expect(ctx.source).toBe('const x = 1;');
    expect(ctx.apgSubgraph).toBe('{"edges":[],"nodes":[]}');
    expect(ctx.adrProse).toBe('ADR: use DDD');
  });

  it('truncates ADR prose to its token budget', () => {
    const inst = makeInstruction('FF-N01', 'srp-test');
    const longAdr = 'x'.repeat(20000); // over the 1000-token ADR budget
    const ctx = assembleContext(inst, unitInput('class Foo {}'), longAdr);
    expect((ctx.adrProse ?? '').length).toBeLessThan(longAdr.length);
    expect(ctx.adrProse).toContain('[truncated]');
  });
});

describe('constructPrompt', () => {
  it('produces prompt with rule, rubric, code, instructions', () => {
    const inst = makeInstruction('FF-N01', 'test');
    const ctx = assembleContext(inst, unitInput('class Foo {}'));
    const prompt = constructPrompt(ctx);
    expect(prompt).toContain('## Rule');
    expect(prompt).toContain('one responsibility');
    expect(prompt).toContain('class Foo {}');
    expect(prompt).toContain('Return the JSON object the schema requires');
  });
});

describe('verdict-parser', () => {
  it('parses valid JSON verdict', () => {
    const raw = JSON.stringify({ pass: true, confidence: 0.9, reasoning: 'Looks good', evidence: ['clean'], violations: [] });
    const v = parseVerdict(raw);
    expect(v).not.toBeNull();
    expect(v!.pass).toBe(true);
    expect(v!.confidence).toBe(0.9);
  });

  it('parses JSON from markdown code block', () => {
    const raw = '```json\n{"pass": false, "confidence": 0.3, "reasoning": "bad", "evidence": [], "violations": [{"filePath": "a.ts", "message": "mixed"}]}\n```';
    const v = parseVerdict(raw);
    expect(v).not.toBeNull();
    expect(v!.pass).toBe(false);
    expect(v!.violations).toHaveLength(1);
  });

  it('returns null for invalid JSON', () => {
    expect(parseVerdict('not json')).toBeNull();
  });

  it('rejects confidence outside [0, 1] instead of clamping (BR-U4-VRD-03)', () => {
    const raw = JSON.stringify({ pass: true, confidence: 1.5, reasoning: '', evidence: [], violations: [] });
    expect(parseVerdict(raw)).toBeNull();
  });

  it('returns null if pass field missing', () => {
    const raw = JSON.stringify({ confidence: 0.9, reasoning: 'x', evidence: [], violations: [] });
    expect(parseVerdict(raw)).toBeNull();
  });
});

describe('cassette-manager', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cassette-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('round-trips a v2 cassette entry under <key[0..1]>/<key>.json', () => {
    const entry = {
      schemaVersion: 2 as const, key: `ab${'0'.repeat(62)}-r0-0`, requestHash: `ab${'0'.repeat(62)}`, repetition: 0, runIndex: 0,
      functionId: 'FF-N01', provider: 'mock', model: 'mock-model', effort: null, usedOptions: {}, ignoredOptions: [],
      attempts: 1 as const, outcome: { kind: 'valid' as const }, prompt: 'test prompt', response: '{"pass": true}',
      parsedVerdict: { pass: true, confidence: 0.9, reasoning: '', evidence: [], violations: [] },
      usage: { inputTokens: 1, outputTokens: 1 }, durationMs: 1, recordedAt: '2026-01-01T00:00:00Z',
    };
    const file = writeCassetteEntry(tmpDir, entry);
    expect(path.relative(tmpDir, file)).toBe(path.join('ab', `${entry.key}.json`));
    expect(listCassetteKeys(tmpDir)).toEqual([entry.key]);

    const loaded = readCassetteEntry(tmpDir, entry.key);
    expect(loaded).toEqual(entry);
  });

  it('returns null for missing cassette', () => {
    expect(readCassetteEntry(tmpDir, 'ff-missing-r0-0')).toBeNull();
    expect(listCassetteKeys(path.join(tmpDir, 'none'))).toEqual([]);
  });
});

describe('MockLLMProvider', () => {
  it('returns default response', async () => {
    const provider = new MockLLMProvider();
    const result = await provider.evaluate('test', { model: 'mock-model', maxTokens: 1000, temperature: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      const parsed = JSON.parse(result.data.content);
      expect(parsed.pass).toBe(true);
    }
  });

  it('returns custom response for matching prompt', async () => {
    const provider = new MockLLMProvider();
    provider.setResponse('special', '{"pass": false, "confidence": 0.2, "reasoning": "nope", "evidence": [], "violations": []}');
    const result = await provider.evaluate('special keyword', { model: 'mock-model', maxTokens: 1000, temperature: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      const parsed = JSON.parse(result.data.content);
      expect(parsed.pass).toBe(false);
    }
  });

  it('tracks call count', async () => {
    const provider = new MockLLMProvider();
    await provider.evaluate('a', { model: 'mock-model', maxTokens: 1000, temperature: 0 });
    await provider.evaluate('b', { model: 'mock-model', maxTokens: 1000, temperature: 0 });
    expect(provider.getCallCount()).toBe(2);
  });
});

// Step 21 (U4-K4): the critic judges real units. These tests use a one-file project (`src/a.ts`,
// layer domain) given as a graph view; the wiring itself is covered by critic-wiring.test.ts.
const ONE_FILE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-k4-one-file-'));
fs.mkdirSync(path.join(ONE_FILE_ROOT, 'src'));
fs.writeFileSync(path.join(ONE_FILE_ROOT, 'src/a.ts'), 'export class A {\n  run(): number { return 1; }\n}\n');
afterAll(() => { fs.rmSync(ONE_FILE_ROOT, { recursive: true, force: true }); });
const ONE_FILE_VIEW: JudgeGraphView = {
  files: [{ path: 'src/a.ts', layer: 'domain', isBarrel: false }], classes: [{ name: 'A', file: 'src/a.ts' }], interfaces: [], edges: [],
};
const graphRepo = {
  executeQuery: () => Promise.resolve(DomainResult.ok({ records: [], summary: { counters: {} } })),
  clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
  healthCheck: () => Promise.resolve(true),
  close: () => Promise.resolve(),
};
const oneFile = { graphRepository: graphRepo, projectRoot: ONE_FILE_ROOT, graphView: ONE_FILE_VIEW, knownSecrets: [] as string[] };

describe('evaluateNeuronal', () => {
  it('evaluates instruction with mock provider', async () => {
    const provider = new MockLLMProvider();
    const result = await evaluateNeuronal({
      ...oneFile,
      instructions: [makeInstruction('FF-N01', 'srp-semantic')],
      provider,
      runsPerEvaluation: 3,
      cassettePath: fs.mkdtempSync(path.join(CASSETTE_DIR, 'run-')),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(1);
      const r = result.data.results[0];
      expect(r?.deterministic).toBe(false);
      // Step 21: runs live per unit; the function-level list is empty (DE §4.4)
      expect(r?.runs).toEqual([]);
      expect(r?.unitResults[0]?.runs.length).toBe(3);
      expect(r?.confidence).toBeGreaterThan(0);
      expect(typeof r?.confidenceStdDev).toBe('number');
    }
  });

  it('flags unstable results when stddev is high', async () => {
    // Provider returns varying confidence
    let callIdx = 0;
    const provider = new MockLLMProvider();
    const responses = [
      JSON.stringify({ pass: true, confidence: 0.9, reasoning: 'a', evidence: [], violations: [] }),
      JSON.stringify({ pass: false, confidence: 0.3, reasoning: 'b', evidence: [], violations: [] }),
      JSON.stringify({ pass: true, confidence: 0.8, reasoning: 'c', evidence: [], violations: [] }),
    ];
    // Override evaluate to cycle responses
    (provider as any).evaluate = async () => {
      const resp = responses[callIdx++ % responses.length];
      return DomainResult.ok({ content: resp!, model: 'mock', usage: { inputTokens: 10, outputTokens: 10 } });
    };

    const result = await evaluateNeuronal({
      ...oneFile,
      instructions: [makeInstruction('FF-N01', 'srp-test')],
      provider,
      runsPerEvaluation: 3,
      unstableThreshold: 0.15,
      cassettePath: fs.mkdtempSync(path.join(CASSETTE_DIR, 'run-')),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // the one unit is unstable (stddev over 0.9, 0.3, 0.8), so its carrying function is too (AGG-04)
      expect(result.data.results[0]?.unitResults[0]?.flaggedUnstable).toBe(true);
      expect(result.data.results[0]?.flaggedUnstable).toBe(true);
    }
  });
});

describe('evaluateNeuronal violation type (BR-U4-VIO-03)', () => {
  const failing = JSON.stringify({
    pass: false, confidence: 0.9, reasoning: 'r', evidence: [],
    violations: [{ filePath: 'src/a.ts', message: 'm' }],
  });

  it.each([
    ['adr source', { source: 'adr', dimension: 'semantic' }, 'INTENT_VIOLATION'],
    ['integrity dimension', { source: 'fitness-function', dimension: 'integrity' }, 'INTEGRITY_VIOLATION'],
    ['other', { source: 'fitness-function', dimension: 'solid' }, 'SEMANTIC_RULE_VIOLATION'],
  ] as const)('%s -> %s', async (_label, overrides, expected) => {
    const provider = new MockLLMProvider();
    (provider as any).evaluate = async () =>
      DomainResult.ok({ content: failing, model: 'mock', usage: { inputTokens: 1, outputTokens: 1 } });
    const inst = { ...makeInstruction('FF-N02', 'type-map'), ...overrides } as NeuronalInstruction;
    const result = await evaluateNeuronal({ ...oneFile, instructions: [inst], provider, runsPerEvaluation: 3, cassettePath: fs.mkdtempSync(path.join(CASSETTE_DIR, 'run-')) });
    expect(result.success).toBe(true);
    if (result.success) {
      const vs = result.data.results[0]!.violations;
      expect(vs.length).toBeGreaterThan(0);
      for (const v of vs) expect(v.type).toBe(expected);
    }
  });
});

describe('C7 VCRMode (U4-K2, D-U0-3)', () => {
  it("defaults to 'record' and records each run under the given cassette path", async () => {
    expect(DEFAULT_NEURONAL_OPTIONS.vcrMode).toBe('record');
    const dir = fs.mkdtempSync(path.join(CASSETTE_DIR, 'default-'));
    const result = await evaluateNeuronal({
      ...oneFile,
      instructions: [makeInstruction('FF-N01', 'record-default')],
      provider: new MockLLMProvider(),
      runsPerEvaluation: 3,
      cassettePath: dir,
    });
    expect(result.success).toBe(true);
    const keys = listCassetteKeys(dir);
    expect(keys).toHaveLength(3);
    expect(keys.map((k) => readCassetteEntry(dir, k)?.runIndex).sort()).toEqual([0, 1, 2]);
  });
});
