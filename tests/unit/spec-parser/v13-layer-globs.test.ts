/**
 * The v1.3 layer-directory check of `validateSpecAgainstProject` (glob semantics), and the regression the ISE
 * prototype found: every v1.3 reference project, clean and every variant, validates against its own spec under the
 * v1.3 rules. The v1.2E check (the default) keeps its literal per-directory behaviour.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../../../src/spec-parser/index.js';
import { validateSpecAgainstProject } from '../../../src/spec-parser/spec-validator.js';
import type { LayerDefinition, ParsedSpec } from '../../../src/shared/types/spec.js';
import { makeTempRoot, materialiseVariant } from '../../../scripts/v1.3/lib/materialise.js';
import { loadAllReferences } from '../../../scripts/v1.3/lib/reference-model.js';

const ROOT = path.resolve(__dirname, '../../..');

const layer = (name: string, directories: string[], filePatterns?: string[]): LayerDefinition => ({
  name, directories, naming: [], role: '', ...(filePatterns !== undefined ? { filePatterns } : {}),
});

const spec = (layers: LayerDefinition[]): ParsedSpec => ({
  specVersion: '1.0.0',
  layerModel: { layers },
  fitnessFunctions: [],
  scoringWeights: { structural: 0.5, coupling: 0.2, pattern: 0.2, solid: 0.05, convention: 0.05, semantic: 0, integrity: 0 },
  verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
  confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
  adrRules: [],
});

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-layer-globs-'));
  for (const f of ['src/ordering/domain/Order.ts', 'src/billing/domain/Invoice.ts', 'src/main.ts', 'src/a/b.controller.ts', 'node_modules/x/src/core/y.ts']) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), '');
  }
});
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const codes = (s: ParsedSpec, rules?: 'v1.2e' | 'v1.3'): { errors: string[]; warnings: string[] } => {
  const r = validateSpecAgainstProject(s, dir, rules === undefined ? {} : { rules });
  return { errors: r.errors.map((e) => `${e.code} ${e.field ?? ''}`), warnings: r.warnings.map((w) => `${w.code} ${w.field ?? ''}`) };
};

describe('v1.3 layer globs', () => {
  it('an inner wildcard is a pattern: src/*/domain/** matches, src/*/acl/** does not', () => {
    expect(codes(spec([layer('domain', ['src/*/domain/**'])]), 'v1.3')).toEqual({ errors: [], warnings: [] });
    expect(codes(spec([layer('infra', ['src/*/acl/**'])]), 'v1.3').errors).toEqual(['LAYER_DIR_NOT_FOUND architecture.layers.infra.directories']);
  });

  it('an unused alternative directory is a warning when the layer matches through another glob', () => {
    expect(codes(spec([layer('domain', ['src/*/domain/**', 'src/core/**'])]), 'v1.3')).toEqual({
      errors: [],
      warnings: ['LAYER_DIR_NOT_FOUND architecture.layers.domain.directories'],
    });
  });

  it('a file pattern that matches keeps the layer: missing directories are warnings', () => {
    expect(codes(spec([layer('presentation', ['src/controllers/**'], ['**/*.controller.ts'])]), 'v1.3')).toEqual({
      errors: [],
      warnings: ['LAYER_DIR_NOT_FOUND architecture.layers.presentation.directories'],
    });
    expect(codes(spec([layer('presentation', ['src/controllers/**'], ['**/*.gateway.ts'])]), 'v1.3').errors).toHaveLength(1);
  });

  it('a literal file entry (src/main.ts) matches; node_modules is never scanned', () => {
    expect(codes(spec([layer('composition', ['src/main.ts'])]), 'v1.3').errors).toEqual([]);
    expect(codes(spec([layer('core', ['node_modules/*/src/core/**'])]), 'v1.3').errors).toHaveLength(1);
  });

  it('v1.2E (default and explicit) is unchanged: every directory is checked literally', () => {
    const s = spec([layer('domain', ['src/*/domain/**', 'src/core/**']), layer('composition', ['src/main.ts'])]);
    const expected = ['LAYER_DIR_NOT_FOUND architecture.layers.domain.directories', 'LAYER_DIR_NOT_FOUND architecture.layers.domain.directories'];
    expect(codes(s).errors).toEqual(expected);
    expect(codes(s, 'v1.2e')).toEqual(codes(s));
    expect(validateSpecAgainstProject(s, dir).errors.map((e) => e.message)).toEqual([
      `Layer "domain" directory "src/*/domain" not found at ${path.resolve(dir, 'src/*/domain')}`,
      `Layer "domain" directory "src/core" not found at ${path.resolve(dir, 'src/core')}`,
    ]);
  });
});

describe('regression: every v1.3 reference project validates against its own spec (v1.3 rules)', () => {
  const refs = loadAllReferences(ROOT);
  let work: string;
  beforeAll(() => {
    work = makeTempRoot('v13-layer-globs-ref-');
  });
  afterAll(() => {
    fs.rmSync(work, { recursive: true, force: true });
  });

  it('covers all five styles', () => {
    expect(refs.map((r) => r.style).sort()).toEqual(['clean-architecture', 'ddd', 'hexagonal', 'layered', 'nestjs']);
  });

  for (const ref of refs) {
    it(`${ref.style}: the clean project and every variant`, async () => {
      const parsed = await parseSpec({ specFilePath: ref.specPath });
      if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
      const failures: string[] = [];
      for (const v of ref.variants) {
        const projectDir = v.manifest.kind === 'clean' ? ref.projectDir : materialiseVariant(ref, v, work).projectDir;
        const report = validateSpecAgainstProject(parsed.data, projectDir, { rules: 'v1.3' });
        for (const e of report.errors) failures.push(`${v.manifest.variant}: [${e.code}] ${e.message}`);
      }
      expect(failures).toEqual([]);
    });
  }

  it('the v1.2E check still reports the literal directories it reported before (nestjs, ddd)', async () => {
    const counts: Record<string, number> = {};
    for (const ref of refs) {
      const parsed = await parseSpec({ specFilePath: ref.specPath });
      if (!parsed.success) throw new Error('parse');
      counts[ref.style] = validateSpecAgainstProject(parsed.data, ref.projectDir).errors.filter((e) => e.code === 'LAYER_DIR_NOT_FOUND').length;
    }
    expect(counts).toEqual({ 'clean-architecture': 0, layered: 0, nestjs: 16, hexagonal: 0, ddd: 5 });
  });
});
