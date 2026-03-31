import { evaluateNeuronal } from '../../../src/llm-critic/llm-critic.js';
import { assembleContext, constructPrompt } from '../../../src/llm-critic/context-assembler.js';
import { parseVerdict } from '../../../src/llm-critic/verdict-parser.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { saveCassette, loadCassette, cassetteExists } from '../../../src/llm-critic/cassette-manager.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { NeuronalInstruction, ContextAssemblyInstruction } from '../../../src/shared/types/evaluation.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

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
});

describe('context-assembler', () => {
  it('assembles context with all fields', () => {
    const inst = makeInstruction('FF-N01', 'srp-test');
    const ctx = assembleContext(inst, 'const x = 1;', '{"nodes":[]}', 'ADR: use DDD');
    expect(ctx.rule).toContain('one responsibility');
    expect(ctx.codeSnippet).toBe('const x = 1;');
    expect(ctx.apgSubgraph).toBe('{"nodes":[]}');
    expect(ctx.adrProse).toBe('ADR: use DDD');
  });

  it('truncates code to token budget', () => {
    const inst = makeInstruction('FF-N01', 'srp-test');
    const longCode = 'x'.repeat(20000); // way over 2000 tokens * 4 chars
    const ctx = assembleContext(inst, longCode);
    expect(ctx.codeSnippet.length).toBeLessThan(longCode.length);
    expect(ctx.codeSnippet).toContain('[truncated]');
  });
});

describe('constructPrompt', () => {
  it('produces prompt with rule, rubric, code, instructions', () => {
    const inst = makeInstruction('FF-N01', 'test');
    const ctx = assembleContext(inst, 'class Foo {}');
    const prompt = constructPrompt(ctx);
    expect(prompt).toContain('architectural reviewer');
    expect(prompt).toContain('one responsibility');
    expect(prompt).toContain('class Foo {}');
    expect(prompt).toContain('Return ONLY the JSON');
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

  it('clamps confidence to [0, 1]', () => {
    const raw = JSON.stringify({ pass: true, confidence: 1.5, reasoning: '', evidence: [], violations: [] });
    const v = parseVerdict(raw);
    expect(v!.confidence).toBe(1);
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

  it('round-trips a cassette entry', () => {
    const entry = {
      functionId: 'FF-N01',
      runIndex: 0,
      prompt: 'test prompt',
      response: '{"pass": true}',
      parsedVerdict: { pass: true, confidence: 0.9, reasoning: '', evidence: [], violations: [] },
      timestamp: '2026-01-01T00:00:00Z',
    };
    saveCassette(tmpDir, entry);
    expect(cassetteExists(tmpDir, 'FF-N01', 0)).toBe(true);

    const loaded = loadCassette(tmpDir, 'FF-N01', 0);
    expect(loaded).not.toBeNull();
    expect(loaded!.functionId).toBe('FF-N01');
    expect(loaded!.parsedVerdict!.pass).toBe(true);
  });

  it('returns null for missing cassette', () => {
    expect(loadCassette(tmpDir, 'missing', 0)).toBeNull();
    expect(cassetteExists(tmpDir, 'missing', 0)).toBe(false);
  });
});

describe('MockLLMProvider', () => {
  it('returns default response', async () => {
    const provider = new MockLLMProvider();
    const result = await provider.evaluate('test', { temperature: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      const parsed = JSON.parse(result.data.content);
      expect(parsed.pass).toBe(true);
    }
  });

  it('returns custom response for matching prompt', async () => {
    const provider = new MockLLMProvider();
    provider.setResponse('special', '{"pass": false, "confidence": 0.2, "reasoning": "nope", "evidence": [], "violations": []}');
    const result = await provider.evaluate('special keyword', { temperature: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      const parsed = JSON.parse(result.data.content);
      expect(parsed.pass).toBe(false);
    }
  });

  it('tracks call count', async () => {
    const provider = new MockLLMProvider();
    await provider.evaluate('a', { temperature: 0 });
    await provider.evaluate('b', { temperature: 0 });
    expect(provider.getCallCount()).toBe(2);
  });
});

describe('evaluateNeuronal', () => {
  it('evaluates instruction with mock provider', async () => {
    const provider = new MockLLMProvider();
    const graphRepo = {
      async executeQuery() { return DomainResult.ok({ records: [], summary: { counters: {} } }); },
      async clearGraph() { return DomainResult.ok(undefined); },
      async healthCheck() { return true; },
      async close() {},
    };

    const result = await evaluateNeuronal({
      instructions: [makeInstruction('FF-N01', 'srp-semantic')],
      graphRepository: graphRepo,
      provider,
      runsPerEvaluation: 3,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(1);
      const r = result.data.results[0];
      expect(r.deterministic).toBe(false);
      expect(r.runs.length).toBe(3);
      expect(r.confidence).toBeGreaterThan(0);
      expect(typeof r.confidenceStdDev).toBe('number');
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
    provider.setResponse = function(this: MockLLMProvider, _key: string, _val: string) {} as any;
    // Override evaluate to cycle responses
    (provider as any).evaluate = async () => {
      const resp = responses[callIdx++ % responses.length];
      return DomainResult.ok({ content: resp!, model: 'mock', usage: { inputTokens: 10, outputTokens: 10 } });
    };

    const graphRepo = {
      async executeQuery() { return DomainResult.ok({ records: [], summary: { counters: {} } }); },
      async clearGraph() { return DomainResult.ok(undefined); },
      async healthCheck() { return true; },
      async close() {},
    };

    const result = await evaluateNeuronal({
      instructions: [makeInstruction('FF-N01', 'srp-test')],
      graphRepository: graphRepo,
      provider,
      runsPerEvaluation: 3,
      unstableThreshold: 0.15,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results[0].flaggedUnstable).toBe(true);
    }
  });
});
