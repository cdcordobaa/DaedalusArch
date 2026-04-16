import { validateSpecSchema, validateBusinessRules } from '../../../src/spec-parser/spec-validator.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

describe('spec-validator', () => {
  describe('validateSpecSchema', () => {
    const validRaw = {
      spec_version: '1.0.0',
      architecture: {
        style: 'clean-architecture',
        layers: [
          { name: 'domain', directories: ['src/domain/**'], roles: ['entity'] },
          { name: 'infrastructure', directories: ['src/infrastructure/**'], roles: ['controller'] },
        ],
      },
      fitness_functions: [
        { id: 'FF-S01', name: 'test-fn', dimension: 'structural', severity: 'critical', route: 'symbolic' },
      ],
      scoring: {
        weights: { structural: 0.5, coupling: 0.2, pattern: 0.2, solid: 0.05, convention: 0.05 },
        thresholds: { pass: 0.8, warning: 0.65, soft_block: 0.5 },
      },
      confidence_thresholds: { high: 0.85, medium: 0.60, icc_minimum: 0.70 },
    };

    it('validates a valid spec', () => {
      const result = validateSpecSchema(validRaw);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects missing spec_version', () => {
      const { spec_version, ...invalid } = validRaw;
      const result = validateSpecSchema(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects missing architecture', () => {
      const { architecture, ...invalid } = validRaw;
      const result = validateSpecSchema(invalid);
      expect(result.valid).toBe(false);
    });

    it('rejects layers with fewer than 2 entries', () => {
      const invalid = {
        ...validRaw,
        architecture: {
          ...validRaw.architecture,
          layers: [{ name: 'domain', directories: ['src/domain/**'], roles: ['entity'] }],
        },
      };
      const result = validateSpecSchema(invalid);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid fitness function ID format', () => {
      const invalid = {
        ...validRaw,
        fitness_functions: [
          { id: 'invalid', name: 'test', dimension: 'structural', severity: 'critical', route: 'symbolic' },
        ],
      };
      const result = validateSpecSchema(invalid);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid dimension enum', () => {
      const invalid = {
        ...validRaw,
        fitness_functions: [
          { id: 'FF-S01', name: 'test', dimension: 'unknown', severity: 'critical', route: 'symbolic' },
        ],
      };
      const result = validateSpecSchema(invalid);
      expect(result.valid).toBe(false);
    });

    it('allows additional properties on fitness functions', () => {
      const valid = {
        ...validRaw,
        fitness_functions: [
          { id: 'FF-S01', name: 'test', dimension: 'structural', severity: 'critical', route: 'symbolic', forbidden_imports: ['@nestjs/*'] },
        ],
      };
      const result = validateSpecSchema(valid);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateBusinessRules', () => {
    const validSpec: ParsedSpec = {
      specVersion: '1.0.0',
      layerModel: {
        layers: [
          { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'entity' },
          { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'controller' },
        ],
      },
      fitnessFunctions: [
        { id: functionId('FF-S01'), name: 'test', dimension: 'structural', severity: 'critical', route: 'symbolic', isBuiltIn: true, validated: true, enabled: true, excludePaths: [] },
      ],
      scoringWeights: { structural: 0.5, coupling: 0.2, pattern: 0.2, solid: 0.05, convention: 0.05, semantic: 0, intent: 0 },
      verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
      confidenceThresholds: { high: 0.85, medium: 0.60, iccMinimum: 0.70 },
      adrRules: [],
    };

    it('validates a valid spec', () => {
      const result = validateBusinessRules(validSpec);
      expect(result.valid).toBe(true);
    });

    it('rejects unsupported spec version', () => {
      const result = validateBusinessRules({ ...validSpec, specVersion: '2.0.0' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'BR-SPEC-01')).toBe(true);
    });

    it('rejects weights not summing to 1.0', () => {
      const result = validateBusinessRules({
        ...validSpec,
        scoringWeights: { structural: 0.5, coupling: 0.5, pattern: 0.5, solid: 0, convention: 0, semantic: 0, intent: 0 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'BR-SPEC-06')).toBe(true);
    });

    it('warns on floating-point weight drift', () => {
      const result = validateBusinessRules({
        ...validSpec,
        scoringWeights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05, semantic: 0, intent: 0 },
      });
      // 0.35+0.20+0.30+0.10+0.05 may not === 1.0 due to floating point
      expect(result.valid).toBe(true);
    });

    it('rejects wrong verdict threshold ordering', () => {
      const result = validateBusinessRules({
        ...validSpec,
        verdictThresholds: { pass: 0.5, warning: 0.8, softBlock: 0.3 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'BR-SPEC-08')).toBe(true);
    });

    it('rejects neuronal function without semantic_criteria', () => {
      const result = validateBusinessRules({
        ...validSpec,
        fitnessFunctions: [
          { id: functionId('FF-N01'), name: 'test', dimension: 'solid', severity: 'major', route: 'neuronal', isBuiltIn: false, validated: false, enabled: true, excludePaths: [] },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'BR-SPEC-05')).toBe(true);
    });

    it('rejects symbolic function with semantic_criteria', () => {
      const result = validateBusinessRules({
        ...validSpec,
        fitnessFunctions: [
          {
            id: functionId('FF-S01'), name: 'test', dimension: 'structural', severity: 'critical', route: 'symbolic',
            isBuiltIn: true, validated: true, enabled: true, excludePaths: [],
            semanticCriteria: { rule: 'test', rubric: { pass: 'p', fail: 'f', evidenceRequired: 'e' } },
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'BR-SPEC-05')).toBe(true);
    });

    it('rejects duplicate function IDs', () => {
      const result = validateBusinessRules({
        ...validSpec,
        fitnessFunctions: [
          { id: functionId('FF-S01'), name: 'a', dimension: 'structural', severity: 'critical', route: 'symbolic', isBuiltIn: true, validated: true, enabled: true, excludePaths: [] },
          { id: functionId('FF-S01'), name: 'b', dimension: 'structural', severity: 'critical', route: 'symbolic', isBuiltIn: true, validated: true, enabled: true, excludePaths: [] },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'BR-SPEC-04')).toBe(true);
    });

    it('rejects duplicate layer names', () => {
      const result = validateBusinessRules({
        ...validSpec,
        layerModel: {
          layers: [
            { name: 'domain', directories: ['a/**'], naming: [], role: 'entity' },
            { name: 'domain', directories: ['b/**'], naming: [], role: 'other' },
          ],
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === 'BR-SPEC-03')).toBe(true);
    });
  });
});
