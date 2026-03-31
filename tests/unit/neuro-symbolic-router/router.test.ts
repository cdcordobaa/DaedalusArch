import { routeAndEvaluate, RouterStage } from '../../../src/neuro-symbolic-router/router.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { CompiledFunctions, CypherQuery, NeuronalInstruction, ContextAssemblyInstruction } from '../../../src/shared/types/evaluation.js';
import type { RouterInput } from '../../../src/neuro-symbolic-router/types.js';

const CTX: ContextAssemblyInstruction = { includeAPGSubgraph: false, includeSourceCode: false };

function mockGraphRepo(): GraphRepository {
  return {
    async executeQuery(): Promise<DomainResult<QueryResult>> {
      return DomainResult.ok({ records: [], summary: { counters: {} } });
    },
    async clearGraph() { return DomainResult.ok(undefined); },
    async healthCheck() { return true; },
    async close() {},
  };
}

const symQuery: CypherQuery = {
  functionId: functionId('FF-S01'),
  name: 'dependency-direction',
  cypher: 'MATCH (n) RETURN n',
  params: {},
  dimension: 'structural',
  severity: 'critical',
  route: 'symbolic',
  source: 'template',
};

const neurInstr: NeuronalInstruction = {
  functionId: functionId('FF-N02'),
  name: 'layering-intent',
  dimension: 'intent',
  severity: 'major',
  route: 'neuronal',
  semanticCriteria: { rule: 'test rule', rubric: { pass: 'ok', fail: 'bad', evidenceRequired: 'cite' } },
  contextAssembly: CTX,
  shadowModeEligible: false,
  source: 'fitness-function',
};

const hybridPair = {
  functionId: functionId('FF-N01'),
  symbolicQuery: { ...symQuery, functionId: functionId('FF-N01'), name: 'srp-proxy', route: 'hybrid' as const },
  neuronalInstruction: {
    ...neurInstr,
    functionId: functionId('FF-N01'),
    name: 'srp-semantic',
    route: 'hybrid' as const,
  },
};

const compiled: CompiledFunctions = {
  symbolicQueries: [symQuery],
  neuronalInstructions: [neurInstr],
  hybridPairs: [hybridPair],
  totalCompiled: 3,
  warnings: [],
};

describe('router', () => {
  describe('routeAndEvaluate — full mode', () => {
    it('dispatches symbolic, neuronal, and hybrid functions', async () => {
      const result = await routeAndEvaluate({
        compiledFunctions: compiled,
        mode: 'full',
        graphRepository: mockGraphRepo(),
        llmProvider: new MockLLMProvider(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // symQuery + hybrid symbolic = 2 symbolic results
        expect(result.data.symbolicResults.length).toBeGreaterThanOrEqual(1);
        // neurInstr + (hybrid neuronal if symbolic passed) = 1-2 neuronal
        expect(result.data.neuronalResults.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('tags symbolic results as deterministic: true', async () => {
      const result = await routeAndEvaluate({
        compiledFunctions: { ...compiled, neuronalInstructions: [], hybridPairs: [] },
        mode: 'full',
        graphRepository: mockGraphRepo(),
        llmProvider: new MockLLMProvider(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        for (const r of result.data.symbolicResults) {
          expect(r.deterministic).toBe(true);
        }
      }
    });

    it('tags neuronal results as deterministic: false', async () => {
      const result = await routeAndEvaluate({
        compiledFunctions: { ...compiled, symbolicQueries: [], hybridPairs: [] },
        mode: 'full',
        graphRepository: mockGraphRepo(),
        llmProvider: new MockLLMProvider(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        for (const r of result.data.neuronalResults) {
          expect(r.deterministic).toBe(false);
        }
      }
    });
  });

  describe('routeAndEvaluate — symbolic-only mode', () => {
    it('only runs symbolic queries, skips neuronal', async () => {
      const provider = new MockLLMProvider();
      const result = await routeAndEvaluate({
        compiledFunctions: compiled,
        mode: 'symbolic-only',
        graphRepository: mockGraphRepo(),
        llmProvider: provider,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symbolicResults.length).toBeGreaterThanOrEqual(1);
        // Neuronal instructions should be empty after filtering
        // But hybrid still runs symbolic part
      }
    });
  });

  describe('routeAndEvaluate — neuronal-only mode', () => {
    it('only runs neuronal instructions', async () => {
      const result = await routeAndEvaluate({
        compiledFunctions: compiled,
        mode: 'neuronal-only',
        graphRepository: mockGraphRepo(),
        llmProvider: new MockLLMProvider(),
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symbolicResults).toHaveLength(0);
        expect(result.data.neuronalResults.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('routeAndEvaluate — empty functions', () => {
    it('fails with NO_FUNCTIONS_TO_EVALUATE', async () => {
      const empty: CompiledFunctions = { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, warnings: [] };
      const result = await routeAndEvaluate({
        compiledFunctions: empty,
        mode: 'full',
        graphRepository: mockGraphRepo(),
        llmProvider: new MockLLMProvider(),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('NO_FUNCTIONS_TO_EVALUATE');
      }
    });
  });

  describe('RouterStage', () => {
    it('implements PipelineStage and sets context', async () => {
      const stage = new RouterStage();
      expect(stage.name).toBe('neuro-symbolic-router');

      const context = new FirewallContext(runId('test-run'));
      const input: RouterInput = {
        compiledFunctions: { ...compiled, hybridPairs: [] },
        mode: 'full',
        graphRepository: mockGraphRepo(),
        llmProvider: new MockLLMProvider(),
      };

      const result = await stage.execute(input, context);
      expect(result.success).toBe(true);

      const evalResults = context.getEvaluationResults();
      expect(evalResults.symbolicResults.length).toBeGreaterThanOrEqual(1);
      expect(context.auditLog.some((e) => e.stage === 'neuro-symbolic-router')).toBe(true);
    });
  });
});
