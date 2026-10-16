import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { inferLayerMapping } from '../../../src/ise/layer-mapper.js';
import { loadIsePreset } from '../../../src/ise/preset.js';
import { emitSpecYaml, validateEmittedSpec } from '../../../src/ise/spec-emitter.js';
import { cleanShaped } from './helpers.js';

const PRESETS = path.resolve('presets');

describe('ISE spec emitter', () => {
  const g = cleanShaped('kernel', 'orchestration', 'platform');
  const preset = loadIsePreset('clean-architecture', PRESETS);
  const mapping = inferLayerMapping(g, 'clean-architecture', preset);
  const yaml = emitSpecYaml({ preset, mapping, header: ['style: clean-architecture (test)'] });

  it('keeps the preset and replaces only the layer directories, with a header', () => {
    const doc = YAML.parse(yaml) as { architecture: { style: string; layers: { name: string; directories: string[] }[] }; fitness_functions: unknown[] };
    const orig = YAML.parse(preset.text) as { fitness_functions: unknown[] };
    expect(doc.architecture.style).toBe('clean-architecture');
    expect(doc.architecture.layers.map((l) => [l.name, l.directories])).toEqual([
      ['domain', ['src/kernel/**']], ['application', ['src/orchestration/**']], ['infrastructure', ['src/platform/**']],
    ]);
    expect(doc.fitness_functions).toEqual(orig.fitness_functions);
    expect(yaml.startsWith('# ISE-inferred spec')).toBe(true);
  });

  it('passes the repository spec validator against a project that has those directories', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ise-emit-'));
    try {
      for (const f of g.files) {
        fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true });
        fs.writeFileSync(path.join(dir, f), 'export {};\n');
      }
      const ok = await validateEmittedSpec(yaml, dir);
      expect(ok.errors).toEqual([]);
      expect(ok.valid).toBe(true);
      fs.rmSync(path.join(dir, 'src/platform'), { recursive: true });
      const bad = await validateEmittedSpec(yaml, dir);
      expect(bad.valid).toBe(false);
      expect(bad.errors.join(' ')).toMatch(/LAYER_DIR_NOT_FOUND/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
