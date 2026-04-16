import { loadPreset, mergeSpecs, listPresets } from '../../../src/spec-parser/preset-loader.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

describe('preset-loader', () => {
  describe('listPresets', () => {
    it('lists available preset names', () => {
      const presets = listPresets();
      expect(presets).toContain('clean-architecture');
      expect(presets).toContain('nestjs');
    });
  });

  describe('loadPreset', () => {
    it('loads the clean-architecture preset', () => {
      const result = loadPreset('clean-architecture');
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.specVersion).toBe('1.0.0');
      expect(result.data.layerModel.layers.length).toBeGreaterThanOrEqual(3);
      expect(result.data.fitnessFunctions.length).toBeGreaterThan(0);

      const layerNames = result.data.layerModel.layers.map((l) => l.name);
      expect(layerNames).toContain('domain');
      expect(layerNames).toContain('application');
      expect(layerNames).toContain('infrastructure');
    });

    it('loads the nestjs preset', () => {
      const result = loadPreset('nestjs');
      expect(result.success).toBe(true);
      if (!result.success) return;

      const layerNames = result.data.layerModel.layers.map((l) => l.name);
      expect(layerNames).toContain('domain');
      expect(layerNames).toContain('presentation');
    });

    it('fails for unknown preset', () => {
      const result = loadPreset('nonexistent-preset');
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.errors[0]?.code).toBe('PRESET_NOT_FOUND');
      expect(result.errors[0]?.message).toContain('nonexistent-preset');
    });
  });

  describe('mergeSpecs', () => {
    let preset: ParsedSpec;

    beforeAll(() => {
      const result = loadPreset('clean-architecture');
      if (!result.success) throw new Error('Failed to load clean-architecture preset');
      preset = result.data;
    });

    it('returns preset unchanged with empty overrides', () => {
      const result = mergeSpecs(preset, {});
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.fitnessFunctions.length).toBe(preset.fitnessFunctions.length);
      expect(result.data.layerModel.layers.length).toBe(preset.layerModel.layers.length);
    });

    it('overrides layer directories', () => {
      const result = mergeSpecs(preset, {
        layers: [
          { name: 'domain', directories: ['lib/domain/**'] },
        ],
      });
      expect(result.success).toBe(true);
      if (!result.success) return;

      const domainLayer = result.data.layerModel.layers.find((l) => l.name === 'domain');
      expect(domainLayer?.directories).toEqual(['lib/domain/**']);

      // Other layers unchanged
      const appLayer = result.data.layerModel.layers.find((l) => l.name === 'application');
      expect(appLayer?.directories).toEqual(
        preset.layerModel.layers.find((l) => l.name === 'application')?.directories,
      );
    });

    it('overrides fitness function threshold by ID', () => {
      const result = mergeSpecs(preset, {
        fitness_functions: [
          { id: 'FF-C02', threshold: 20 },
        ],
      });
      expect(result.success).toBe(true);
      if (!result.success) return;

      const ffC02 = result.data.fitnessFunctions.find((f) => String(f.id) === 'FF-C02');
      expect(ffC02?.threshold).toBe(20);

      // Generates a merge warning
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.code === 'MERGE_001')).toBe(true);
    });

    it('disables a fitness function', () => {
      const result = mergeSpecs(preset, {
        fitness_functions: [
          { id: 'FF-S03', enabled: false, reason: 'Not applicable for this project' },
        ],
      });
      expect(result.success).toBe(true);
      if (!result.success) return;

      const ffS03 = result.data.fitnessFunctions.find((f) => String(f.id) === 'FF-S03');
      expect(ffS03?.enabled).toBe(false);
      expect(ffS03?.disabledReason).toBe('Not applicable for this project');
    });

    it('applies global exclude_paths to all functions', () => {
      const result = mergeSpecs(preset, {
        exclude_paths: ['generated/**'],
      });
      expect(result.success).toBe(true);
      if (!result.success) return;

      for (const ff of result.data.fitnessFunctions) {
        expect(ff.excludePaths).toContain('generated/**');
      }
    });
  });
});
