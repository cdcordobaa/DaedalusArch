import * as path from 'node:path';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { SpecParserStage } from '../../../src/spec-parser/spec-parser.js';
import { runId } from '../../../src/shared/types/value-objects.js';

const SPEC_PATH = path.resolve(__dirname, '../../../specs/clean-arch.yaml');

describe('spec-parser', () => {
  describe('parseSpec', () => {
    it('parses the clean-arch.yaml spec successfully', async () => {
      const result = await parseSpec({ specFilePath: SPEC_PATH });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.specVersion).toBe('1.0.0');
        expect(result.data.layerModel.layers).toHaveLength(3);
        expect(result.data.fitnessFunctions.length).toBeGreaterThanOrEqual(26);
        expect(result.data.scoringWeights.structural).toBe(0.35);
        expect(result.data.verdictThresholds.pass).toBe(0.80);
        expect(result.data.confidenceThresholds.high).toBe(0.85);
      }
    });

    it('resolves clean-architecture template and merges', async () => {
      const result = await parseSpec({ specFilePath: SPEC_PATH });
      expect(result.success).toBe(true);
      if (result.success) {
        const fns = result.data.fitnessFunctions;
        // Should have 26 functions from template, all merged with spec overrides
        expect(fns.length).toBe(26);
        // Check some specific functions
        const s01 = fns.find((f) => String(f.id) === 'FF-S01');
        expect(s01).toBeDefined();
        expect(s01!.name).toBe('dependency-direction');
        expect(s01!.route).toBe('symbolic');
      }
    });

    it('parses layer definitions correctly', async () => {
      const result = await parseSpec({ specFilePath: SPEC_PATH });
      expect(result.success).toBe(true);
      if (result.success) {
        const layers = result.data.layerModel.layers;
        expect(layers[0].name).toBe('domain');
        expect(layers[1].name).toBe('application');
        expect(layers[2].name).toBe('infrastructure');
        expect(layers[0].directories).toContain('src/domain/**');
      }
    });

    it('parses full mode weights', async () => {
      const result = await parseSpec({ specFilePath: SPEC_PATH });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullModeWeights).toBeDefined();
        expect(result.data.fullModeWeights!.semantic).toBe(0.04);
        expect(result.data.fullModeWeights!.intent).toBe(0.04);
      }
    });

    it('fails on non-existent file', async () => {
      const result = await parseSpec({ specFilePath: '/nonexistent/spec.yaml' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0].code).toBe('SPEC_NOT_FOUND');
      }
    });

    it('fails on invalid YAML', async () => {
      // Create a temp file with bad YAML
      const fs = await import('node:fs');
      const tmpPath = path.resolve(__dirname, '../../../.tmp-bad-spec.yaml');
      fs.writeFileSync(tmpPath, '{{invalid yaml: [}');
      try {
        const result = await parseSpec({ specFilePath: tmpPath });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors[0].code).toBe('YAML_SYNTAX_ERROR');
        }
      } finally {
        fs.unlinkSync(tmpPath);
      }
    });

    it('fails on unknown architecture style', async () => {
      const fs = await import('node:fs');
      const tmpPath = path.resolve(__dirname, '../../../.tmp-unknown-style.yaml');
      fs.writeFileSync(tmpPath, `spec_version: "1.0.0"
architecture:
  style: hexagonal
  layers:
    - name: domain
      directories: [src/domain/**]
      roles: [entity]
    - name: infra
      directories: [src/infra/**]
      roles: [controller]
scoring:
  weights: { structural: 0.5, coupling: 0.2, pattern: 0.2, solid: 0.05, convention: 0.05 }
  thresholds: { pass: 0.8, warning: 0.65, soft_block: 0.5 }
confidence_thresholds: { high: 0.85, medium: 0.60, icc_minimum: 0.70 }
`);
      try {
        const result = await parseSpec({ specFilePath: tmpPath });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.errors[0].code).toBe('UNKNOWN_STYLE');
        }
      } finally {
        fs.unlinkSync(tmpPath);
      }
    });
  });

  describe('SpecParserStage', () => {
    it('implements PipelineStage and sets context', async () => {
      const stage = new SpecParserStage();
      expect(stage.name).toBe('spec-parser');

      const context = new FirewallContext(runId('test-run-1'));
      const result = await stage.execute({ specFilePath: SPEC_PATH }, context);
      expect(result.success).toBe(true);

      // Context should have ParsedSpec set
      const spec = context.getParsedSpec();
      expect(spec.specVersion).toBe('1.0.0');
      expect(spec.fitnessFunctions.length).toBeGreaterThan(0);

      // Audit entry should be logged
      expect(context.auditLog.length).toBeGreaterThan(0);
      expect(context.auditLog[0].stage).toBe('spec-parser');
    });
  });
});
