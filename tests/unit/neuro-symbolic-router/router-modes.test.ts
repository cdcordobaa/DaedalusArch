/**
 * U4 plan Step 22 (U4-K5): router mode filter, hybrid symbolic-first rule and failure forwarding
 * (BR-U4-RTR-01..03, AGG-06; BR-U3-15, BR-U3-53 / U3 TF-06; T21). The symbolic evaluator and
 * the critic are stubbed, so each test states exactly what each half returned.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';
import type {
  CompiledFunctions, CypherQuery, FunctionFailure, NeuronalFunctionResult, NeuronalInstruction, SymbolicFunctionResult,
} from '../../../src/shared/types/evaluation.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import type { NeuronalEvalOutput } from '../../../src/llm-critic/llm-critic.js';
import { evaluateNeuronal } from '../../../src/llm-critic/llm-critic.js';
import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { filterByMode, routeAndEvaluate } from '../../../src/neuro-symbolic-router/router.js';

jest.mock('../../../src/llm-critic/llm-critic.js', () => ({ evaluateNeuronal: jest.fn() }));
jest.mock('../../../src/evaluation-engine/symbolic-evaluator.js', () => ({
  ...jest.requireActual<object>('../../../src/evaluation-engine/symbolic-evaluator.js'),
  evaluateSymbolic: jest.fn(),
}));

const critic = evaluateNeuronal as jest.MockedFunction<typeof evaluateNeuronal>;
const symbolic = evaluateSymbolic as jest.MockedFunction<typeof evaluateSymbolic>;

const GRAPH = {} as GraphRepository;

const symQuery: CypherQuery = {
  functionId: functionId('FF-S01'), name: 'dependency-direction', cypher: 'RETURN 1', params: {},
  dimension: 'structural', severity: 'critical', route: 'symbolic', source: 'template',
};
const neurInstr: NeuronalInstruction = {
  functionId: functionId('FF-N02'), name: 'intent-alignment', dimension: 'semantic', severity: 'major', route: 'neuronal',
  semanticCriteria: { rule: 'r', rubric: { pass: 'p', fail: 'f', evidenceRequired: 'e' } },
  contextAssembly: { includeAPGSubgraph: false, includeSourceCode: false },
  shadowModeEligible: false, source: 'fitness-function', judgeUnit: 'file',
};
const pairFor = (id: string) => ({
  functionId: functionId(id),
  symbolicQuery: { ...symQuery, functionId: functionId(id), name: `${id}-proxy`, route: 'hybrid' as const },
  neuronalInstruction: { ...neurInstr, functionId: functionId(id), name: `${id}-semantic`, route: 'hybrid' as const },
});
const hybrid = pairFor('FF-H01');

const compiled: CompiledFunctions = {
  symbolicQueries: [symQuery], neuronalInstructions: [neurInstr], hybridPairs: [hybrid],
  totalCompiled: 7, disabledFunctions: [], warnings: [],
};

const violation = (id: string): Violation => ({
  id: `v-${id}`, type: 'LAYER_VIOLATION', dimension: 'structural', severity: 'critical', functionId: functionId(id),
  route: 'symbolic', filePath: 'src/x.ts', message: 'm', deterministic: true,
});

function symResult(id: string, passed: boolean): SymbolicFunctionResult {
  return { functionId: functionId(id), dimension: 'structural', passed, violations: passed ? [] : [violation(id)], executionTimeMs: 1, deterministic: true };
}

function neuralResult(id: string): NeuronalFunctionResult {
  return {
    functionId: functionId(id), dimension: 'semantic', verdict: 'pass', confidence: 0.9 as never, confidenceStdDev: 0, icc: 0,
    reasoning: '', evidence: [], violations: [], runs: [], deterministic: false, flaggedUnstable: false,
    unitResults: [], unitsSelected: 1, unitsCapped: 0,
  };
}

/** The symbolic stub answers each query: pass, violate, or fail to run (EVAL_001). */
function stubSymbolic(outcome: Record<string, 'pass' | 'violate' | 'fail'>): void {
  symbolic.mockImplementation((input) => {
    const results: SymbolicFunctionResult[] = [];
    const failures: FunctionFailure[] = [];
    for (const q of input.queries) {
      const id = String(q.functionId);
      const o = outcome[id] ?? 'pass';
      if (o === 'fail') failures.push({ functionId: q.functionId, name: q.name, code: 'EVAL_001', message: `${id} failed to run` });
      else results.push(symResult(id, o === 'pass'));
    }
    return Promise.resolve(DomainResult.ok({ results, failures, warnings: [] }));
  });
}

function stubCritic(extra: Partial<NeuronalEvalOutput> = {}): void {
  critic.mockImplementation((input) => Promise.resolve(DomainResult.ok({
    results: input.instructions.map((i) => neuralResult(String(i.functionId))),
    warnings: [], failures: [], completeness: { status: 'complete' }, ...extra,
  })));
}

beforeEach(() => {
  critic.mockReset();
  symbolic.mockReset();
  stubSymbolic({});
  stubCritic();
});

const ids = (xs: readonly { functionId: unknown }[]): string[] => xs.map((x) => String(x.functionId));

describe('filterByMode (BR-U4-RTR-01, BR-U3-15)', () => {
  it.each(['symbolic-only', 'neuronal-only', 'full'] as const)('%s keeps totalCompiled', (mode) => {
    expect(filterByMode(compiled, mode).totalCompiled).toBe(compiled.totalCompiled);
  });

  it('hybrid pairs only in full mode; each half only in its mode', () => {
    expect(filterByMode(compiled, 'symbolic-only')).toEqual(expect.objectContaining({ symbolicQueries: [symQuery], neuronalInstructions: [], hybridPairs: [] }));
    expect(filterByMode(compiled, 'neuronal-only')).toEqual(expect.objectContaining({ symbolicQueries: [], neuronalInstructions: [neurInstr], hybridPairs: [] }));
    expect(filterByMode(compiled, 'full')).toBe(compiled);
  });

  it('the comment at the former router.ts:101 no longer says the symbolic part of a hybrid runs (BR-U3-15)', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../src/neuro-symbolic-router/router.ts'), 'utf8');
    expect(source).not.toContain('only symbolic part runs');
    expect(source).not.toContain('Symbolic passed (or failed to run)');
  });
});

describe('T21: symbolic-only and neuronal-only with a hybrid pair', () => {
  it('symbolic-only, llmProvider undefined: no throw, no symbolic or neural result for the pair, critic never called', async () => {
    const result = await routeAndEvaluate({ compiledFunctions: compiled, mode: 'symbolic-only', graphRepository: GRAPH });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(ids(result.data.symbolicResults)).toEqual(['FF-S01']);
      expect(result.data.neuronalResults).toEqual([]);
      expect(result.data.failures).toEqual([]);
    }
    expect(ids(symbolic.mock.calls[0]?.[0].queries ?? [])).toEqual(['FF-S01']);
    expect(critic).not.toHaveBeenCalled();
  });

  it('neuronal-only: neither half of the pair runs', async () => {
    const result = await routeAndEvaluate({ compiledFunctions: compiled, mode: 'neuronal-only', graphRepository: GRAPH, llmProvider: new MockLLMProvider() });
    expect(result.success).toBe(true);
    expect(symbolic).not.toHaveBeenCalled();
    expect(ids(critic.mock.calls[0]?.[0].instructions ?? [])).toEqual(['FF-N02']);
    if (result.success) expect(ids(result.data.neuronalResults)).toEqual(['FF-N02']);
  });
});

describe('full mode: hybrid symbolic-first (BR-U4-RTR-02, BR-U3-53)', () => {
  it('a symbolic half with violations → neuralSkipped symbolic-fail, critic not called for the pair', async () => {
    stubSymbolic({ 'FF-H01': 'violate' });
    const result = await routeAndEvaluate({ compiledFunctions: compiled, mode: 'full', graphRepository: GRAPH, llmProvider: new MockLLMProvider() });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const half = result.data.symbolicResults.find((r) => String(r.functionId) === 'FF-H01');
    expect(half?.neuralSkipped).toBe('symbolic-fail');
    expect(result.data.symbolicResults.find((r) => String(r.functionId) === 'FF-S01')?.neuralSkipped).toBeUndefined();
    expect(ids(critic.mock.calls[0]?.[0].instructions ?? [])).toEqual(['FF-N02']);
    expect(ids(result.data.neuronalResults)).not.toContain('FF-H01');
  });

  it('U3 TF-06: a symbolic half that failed to run → critic never called for the pair, EVAL_001 forwarded, no neural result', async () => {
    stubSymbolic({ 'FF-H01': 'fail' });
    const onlyHybrid: CompiledFunctions = { ...compiled, symbolicQueries: [], neuronalInstructions: [] };
    const result = await routeAndEvaluate({ compiledFunctions: onlyHybrid, mode: 'full', graphRepository: GRAPH, llmProvider: new MockLLMProvider() });
    expect(result.success).toBe(true);
    expect(critic).toHaveBeenCalledTimes(0);
    if (result.success) {
      expect(result.data.failures.map((f) => [String(f.functionId), f.code])).toEqual([['FF-H01', 'EVAL_001']]);
      expect(result.data.neuronalResults).toEqual([]);
      expect(result.data.symbolicResults).toEqual([]);
    }
  });

  it('a passing symbolic half → the neural half runs with projectRoot and NeuronalRunOptions (RTR-03)', async () => {
    const options = { unitCap: 5, repetition: 2 };
    const result = await routeAndEvaluate({
      compiledFunctions: compiled, mode: 'full', graphRepository: GRAPH, llmProvider: new MockLLMProvider(),
      projectRoot: '/tmp/project', neuronalOptions: options, excludePaths: { 'FF-N02': ['src/gen/**'] }, knownSecrets: ['s3cret'],
    });
    expect(result.success).toBe(true);
    expect(critic).toHaveBeenCalledTimes(1);
    const input = critic.mock.calls[0]?.[0];
    expect(ids(input?.instructions ?? [])).toEqual(['FF-N02', 'FF-H01']);
    expect(input).toEqual(expect.objectContaining({ projectRoot: '/tmp/project', options, excludePaths: { 'FF-N02': ['src/gen/**'] }, knownSecrets: ['s3cret'] }));
    expect(ids(symbolic.mock.calls[0]?.[0].queries ?? [])).toEqual(['FF-S01', 'FF-H01']);
  });
});

describe('failure forwarding (BR-U4-AGG-06, RTR-03)', () => {
  it('a stubbed critic failure and a symbolic failure both reach EvaluationResults.failures', async () => {
    stubSymbolic({ 'FF-S01': 'fail' });
    const criticFailure: FunctionFailure = { functionId: functionId('FF-N02'), name: 'intent-alignment', code: 'INSUFFICIENT_VALID_RUNS', message: '0 of 3 selected units valid' };
    stubCritic({ results: [], failures: [criticFailure] });
    const result = await routeAndEvaluate({ compiledFunctions: { ...compiled, hybridPairs: [] }, mode: 'full', graphRepository: GRAPH, llmProvider: new MockLLMProvider() });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.failures.map((f) => f.code)).toEqual(['EVAL_001', 'INSUFFICIENT_VALID_RUNS']);
      expect(result.data.failures[1]).toEqual(criticFailure);
    }
  });

  it('an incomplete critic run is forwarded with its manifest', async () => {
    const manifest = { projectRoot: 'p', stop: 'USAGE_LIMIT' as const, message: 'limit', completedCalls: 1, outstanding: [] };
    stubCritic({ results: [], completeness: { status: 'incomplete', stop: 'USAGE_LIMIT', outstanding: 2 }, manifest });
    const result = await routeAndEvaluate({ compiledFunctions: { ...compiled, hybridPairs: [] }, mode: 'full', graphRepository: GRAPH, llmProvider: new MockLLMProvider() });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.neuralCompleteness).toEqual({ status: 'incomplete', stop: 'USAGE_LIMIT', outstanding: 2 });
      expect(result.data.neuralManifest).toEqual(manifest);
    }
  });

  it('a critic configuration error fails the router with its code', async () => {
    critic.mockResolvedValue(DomainResult.fail([{ code: 'LLM_BASELINE_SELECTION_MISSING', message: 'no row' }]));
    const result = await routeAndEvaluate({ compiledFunctions: compiled, mode: 'neuronal-only', graphRepository: GRAPH, llmProvider: new MockLLMProvider() });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('LLM_BASELINE_SELECTION_MISSING');
  });

  it('a neural half without a provider is LLM_NOT_CONFIGURED, never a dereference', async () => {
    const result = await routeAndEvaluate({ compiledFunctions: compiled, mode: 'full', graphRepository: GRAPH });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('LLM_NOT_CONFIGURED');
    expect(critic).not.toHaveBeenCalled();
  });
});
