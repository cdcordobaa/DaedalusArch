import { compileFunctions, instantiateTemplate } from '../../../src/fitness-compiler/fitness-compiler.js';
import { FitnessCompilerStage } from '../../../src/fitness-compiler/fitness-compiler.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { CompilerInput } from '../../../src/fitness-compiler/types.js';
import type { FitnessFunction, LayerModel, ADRRule } from '../../../src/shared/types/spec.js';

const LAYER_MODEL: LayerModel = {
  layers: [
    { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'entity' },
    { name: 'application', directories: ['src/application/**'], naming: [], role: 'use-case' },
    { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'controller' },
  ],
};

const symbolicFn: FitnessFunction = {
  id: functionId('FF-S01'),
  name: 'dependency-direction',
  dimension: 'structural',
  severity: 'critical',
  route: 'symbolic',
  isBuiltIn: true,
  validated: true,
  enabled: true,
  excludePaths: [],
};

const neuronalFn: FitnessFunction = {
  id: functionId('FF-N02'),
  name: 'layering-intent',
  dimension: 'intent',
  severity: 'major',
  route: 'neuronal',
  isBuiltIn: true,
  validated: false,
  enabled: true,
  excludePaths: [],
  semanticCriteria: {
    rule: 'Code should respect architectural intent',
    rubric: { pass: 'Correct layer', fail: 'Wrong layer', evidenceRequired: 'Cite imports' },
  },
};

const hybridFn: FitnessFunction = {
  id: functionId('FF-N01'),
  name: 'srp-semantic',
  dimension: 'solid',
  severity: 'major',
  route: 'hybrid',
  isBuiltIn: true,
  validated: false,
  enabled: true,
  excludePaths: [],
  semanticCriteria: {
    rule: 'One reason to change',
    rubric: { pass: 'Cohesive', fail: 'Mixed concerns', evidenceRequired: 'Cite methods' },
  },
};

describe('fitness-compiler', () => {
  describe('CYPHER_TEMPLATES', () => {
    it('contains 24 templates', () => {
      expect(CYPHER_TEMPLATES.size).toBe(24);
    });

    it('all templates have non-empty Cypher', () => {
      for (const [name, tmpl] of CYPHER_TEMPLATES) {
        expect(tmpl.template.length).toBeGreaterThan(0);
        expect(tmpl.functionName).toBe(name);
      }
    });

    it('dependency-direction template has correct params', () => {
      const tmpl = CYPHER_TEMPLATES.get('dependency-direction')!;
      expect(tmpl.requiredParams).toContain('layerOrder');
    });
  });

  describe('compileFunctions', () => {
    it('compiles symbolic function to CypherQuery', () => {
      const input: CompilerInput = {
        fitnessFunctions: [symbolicFn],
        adrRules: [],
        layerModel: LAYER_MODEL,
        scoringWeights: { structural: 1, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 0 },
      };
      const result = compileFunctions(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symbolicQueries).toHaveLength(1);
        expect(result.data.symbolicQueries[0].functionId).toBe(symbolicFn.id);
        expect(result.data.symbolicQueries[0].route).toBe('symbolic');
        expect(result.data.symbolicQueries[0].source).toBe('template');
        expect(result.data.symbolicQueries[0].cypher).toContain('MATCH');
      }
    });

    it('compiles neuronal function to NeuronalInstruction', () => {
      const input: CompilerInput = {
        fitnessFunctions: [neuronalFn],
        adrRules: [],
        layerModel: LAYER_MODEL,
        scoringWeights: { structural: 0, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 1 },
      };
      const result = compileFunctions(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.neuronalInstructions).toHaveLength(1);
        expect(result.data.neuronalInstructions[0].route).toBe('neuronal');
        expect(result.data.neuronalInstructions[0].source).toBe('fitness-function');
        expect(result.data.neuronalInstructions[0].semanticCriteria.rule).toContain('architectural intent');
      }
    });

    it('compiles hybrid function to HybridPair', () => {
      const input: CompilerInput = {
        fitnessFunctions: [hybridFn],
        adrRules: [],
        layerModel: LAYER_MODEL,
        scoringWeights: { structural: 0, coupling: 0, pattern: 0, solid: 1, convention: 0, semantic: 0, intent: 0 },
      };
      const result = compileFunctions(input);
      expect(result.success).toBe(true);
      if (result.success) {
        // hybrid without a known template will only produce neuronal
        // srp-semantic has no matching cypher template name
        expect(result.data.neuronalInstructions.length + result.data.hybridPairs.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('compiles ADR rule with symbolic rule as hybrid', () => {
      const adr: ADRRule = {
        id: 'adr-001',
        title: 'Use Repository Pattern',
        format: 'MADR',
        symbolicRule: { query: 'MATCH (c:Class) RETURN c', params: {}, description: 'test' },
        semanticCriterion: { rule: 'Use repos', rubric: { pass: 'yes', fail: 'no', evidenceRequired: 'cite' } },
        rawContent: 'test',
      };
      const input: CompilerInput = {
        fitnessFunctions: [],
        adrRules: [adr],
        layerModel: LAYER_MODEL,
        scoringWeights: { structural: 1, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 0 },
      };
      const result = compileFunctions(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hybridPairs).toHaveLength(1);
        expect(result.data.hybridPairs[0].symbolicQuery.source).toBe('adr');
        expect(result.data.hybridPairs[0].neuronalInstruction.shadowModeEligible).toBe(true);
      }
    });

    it('compiles ADR rule without symbolic as neuronal with shadow mode', () => {
      const adr: ADRRule = {
        id: 'adr-002',
        title: 'Use DDD',
        format: 'Nygard',
        semanticCriterion: { rule: 'Apply DDD', rubric: { pass: 'yes', fail: 'no', evidenceRequired: 'cite' } },
        rawContent: 'test',
      };
      const input: CompilerInput = {
        fitnessFunctions: [],
        adrRules: [adr],
        layerModel: LAYER_MODEL,
        scoringWeights: { structural: 1, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 0 },
      };
      const result = compileFunctions(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.neuronalInstructions).toHaveLength(1);
        expect(result.data.neuronalInstructions[0].shadowModeEligible).toBe(true);
        expect(result.data.neuronalInstructions[0].shadowPrompt).toBeDefined();
        expect(result.data.neuronalInstructions[0].source).toBe('adr');
        // Should have COMPILER_003 warning
        expect(result.data.warnings.some((w) => w.code === 'COMPILER_003')).toBe(true);
      }
    });

    it('rejects duplicate function IDs', () => {
      const input: CompilerInput = {
        fitnessFunctions: [symbolicFn, { ...symbolicFn }],
        adrRules: [],
        layerModel: LAYER_MODEL,
        scoringWeights: { structural: 1, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 0 },
      };
      const result = compileFunctions(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('DUPLICATE_FUNCTION_ID');
      }
    });

    it('totalCompiled counts all outputs', () => {
      const input: CompilerInput = {
        fitnessFunctions: [symbolicFn, neuronalFn],
        adrRules: [],
        layerModel: LAYER_MODEL,
        scoringWeights: { structural: 0.5, coupling: 0, pattern: 0, solid: 0, convention: 0, semantic: 0, intent: 0.5 },
      };
      const result = compileFunctions(input);
      expect(result.success).toBe(true);
      if (result.success) {
        const total = result.data.symbolicQueries.length +
          result.data.neuronalInstructions.length +
          result.data.hybridPairs.length;
        expect(result.data.totalCompiled).toBe(total);
      }
    });
  });

  describe('instantiateTemplate', () => {
    it('returns the template string as-is (parameterized queries)', () => {
      const tmpl = CYPHER_TEMPLATES.get('dependency-direction')!;
      const result = instantiateTemplate(tmpl, { outerLayers: ['infrastructure'], innerLayers: ['domain'] });
      expect(result).toBe(tmpl.template);
    });
  });

  describe('FitnessCompilerStage', () => {
    it('implements PipelineStage and sets context', async () => {
      const stage = new FitnessCompilerStage();
      expect(stage.name).toBe('fitness-compiler');

      // First need a parsed spec
      const { parseSpec } = await import('../../../src/spec-parser/spec-parser.js');
      const specPath = require('node:path').resolve(__dirname, '../../../specs/clean-arch.yaml');
      const specResult = await parseSpec({ specFilePath: specPath });
      expect(specResult.success).toBe(true);
      if (!specResult.success) return;

      const context = new FirewallContext(runId('test-run-2'));
      context.setParsedSpec(specResult.data);

      const result = await stage.execute(specResult.data, context);
      expect(result.success).toBe(true);

      const compiled = context.getCompiledFunctions();
      expect(compiled.totalCompiled).toBeGreaterThan(0);
      expect(compiled.symbolicQueries.length).toBeGreaterThan(0);

      // Audit entry should be logged
      expect(context.auditLog.some((e) => e.stage === 'fitness-compiler')).toBe(true);
    });
  });
});
