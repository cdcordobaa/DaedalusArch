/**
 * U1 K14: `integrity` dimension and `intent` aliases (FR-22; ADR-015 item 6; U1 Q9 A, Q10 A, Q11 A, Q12 A).
 * BR-U1-20 dimension alias; BR-U1-21 (a)-(c) weight-key alias and collision; BR-U1-22 FR-22 producers and
 * "nothing compiled carries intent"; BR-U1-23 INTENT_VIOLATION deprecated, no U1 producer; BR-U1-24 the
 * full-mode window observation in CHANGES.md.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { resolveTemplate } from '../../../src/spec-parser/template-registry.js';
import type { ADRRule, ParsedSpec } from '../../../src/shared/types/spec.js';

const ROOT = path.resolve(__dirname, '../../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u1-k14-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const SHIPPED = ['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'specs/clean-arch.yaml', 'specs/daedalus-arch.yaml'];

const LAYERS3 = '    - { name: domain, roles: [r] }\n    - { name: application, roles: [r] }\n    - { name: infrastructure, roles: [r] }\n';
const FN_N02 = (dimension: string): string => `  - id: FF-N02
    name: layering-intent
    dimension: ${dimension}
    severity: major
    route: neuronal
    semantic_criteria:
      rule: "r"
      rubric: { pass: "p", fail: "f", evidence_required: "e" }
`;
const FN_S01 = '  - { id: FF-S01, name: dependency-direction, dimension: structural, severity: critical, route: symbolic }\n';
const SYMBOLIC = '  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }\n';
const FULL = (extra: string): string =>
  `  full_mode_weights: { structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.10, convention: 0.05, semantic: 0.04${extra} }\n`;

let counter = 0;
function writeSpec(functionsYaml: string, scoringExtra: string): string {
  const file = path.join(TMP, `spec-${String(++counter)}.yaml`);
  fs.writeFileSync(file, `spec_version: "1.0.0"
architecture:
  layers:
${LAYERS3}fitness_functions:
${functionsYaml}scoring:
${SYMBOLIC}${scoringExtra}  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.70, icc_minimum: 0.75 }
`);
  return file;
}

async function parsed(file: string, strictMode = false): Promise<{ spec: ParsedSpec; warnings: readonly { code: string; message: string }[] }> {
  const r = await parseSpec({ specFilePath: file }, { strictMode });
  if (!r.success) throw new Error(`spec did not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  return { spec: r.data, warnings: r.warnings ?? [] };
}

const spec004 = (warnings: readonly { code: string; message: string }[]): string[] =>
  warnings.filter((w) => w.code === 'SPEC_004').map((w) => w.message);

describe('BR-U1-20 dimension alias', () => {
  it('FF-N02 with dimension: intent parses as semantic with exactly one SPEC_004', async () => {
    const { spec, warnings } = await parsed(writeSpec(FN_S01 + FN_N02('intent'), ''));
    expect(spec.fitnessFunctions.find((f) => String(f.id) === 'FF-N02')?.dimension).toBe('semantic');
    expect(spec004(warnings)).toEqual(['Dimension "intent" of FF-N02 is deprecated; mapped to "semantic"']);
  });

  it('dimension: integrity is accepted by the schema and kept', async () => {
    const { spec, warnings } = await parsed(writeSpec(FN_S01 + FN_N02('integrity'), ''));
    expect(spec.fitnessFunctions.find((f) => String(f.id) === 'FF-N02')?.dimension).toBe('integrity');
    expect(spec004(warnings)).toEqual([]);
  });
});

describe('BR-U1-21 full_mode_weights intent alias and collision', () => {
  it('(a) legacy weights map intent to integrity, intent 0, one SPEC_004, BR-SPEC-07 sum passes (strict mode)', async () => {
    const { spec, warnings } = await parsed(writeSpec(FN_S01, FULL(', intent: 0.04')), true);
    expect(spec.fullModeWeights).toMatchObject({ integrity: 0.04, semantic: 0.04, intent: 0 });
    expect(spec004(warnings)).toEqual(['full_mode_weights.intent is deprecated; mapped to integrity']);
  });

  it('(a) the integrity key parses without SPEC_004', async () => {
    const { spec, warnings } = await parsed(writeSpec(FN_S01, FULL(', integrity: 0.04')), true);
    expect(spec.fullModeWeights).toMatchObject({ integrity: 0.04, semantic: 0.04, intent: 0 });
    expect(spec004(warnings)).toEqual([]);
  });

  it('(a) scoring.weights gives semantic = integrity = intent = 0', async () => {
    const { spec } = await parsed(writeSpec(FN_S01, ''));
    expect(spec.scoringWeights).toMatchObject({ semantic: 0, integrity: 0, intent: 0 });
  });

  it.each([
    ['both intent and integrity', ', integrity: 0.04, intent: 0.04'],
    ['neither intent nor integrity', ''],
  ])('(b) %s → SCHEMA_VALIDATION_FAILED', async (_label, extra) => {
    const r = await parseSpec({ specFilePath: writeSpec(FN_S01, FULL(extra)) }, { strictMode: false });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.map((e) => e.code)).toEqual(['SCHEMA_VALIDATION_FAILED']);
  });

  it('(c) an unmigrated nestjs-style spec (FF-N01 solid/hybrid, FF-N02 intent, full_mode_weights.intent) still parses', async () => {
    const migrated = fs.readFileSync(path.join(ROOT, 'presets/nestjs.yaml'), 'utf-8');
    const legacy = migrated
      .replace('    dimension: integrity\n    severity: major\n    route: neuronal\n', '    dimension: solid\n    severity: major\n    route: hybrid\n')
      .replace('    name: layering-intent\n    dimension: semantic\n', '    name: layering-intent\n    dimension: intent\n')
      .replace(/^ {4}integrity: 0\.04$/m, '    intent: 0.04');
    expect(legacy).not.toBe(migrated);
    expect(legacy).not.toMatch(/integrity/);
    const file = path.join(TMP, 'nestjs-unmigrated.yaml');
    fs.writeFileSync(file, legacy);
    const { spec, warnings } = await parsed(file);
    expect(spec004(warnings)).toEqual([
      'Dimension "intent" of FF-N02 is deprecated; mapped to "semantic"',
      'full_mode_weights.intent is deprecated; mapped to integrity',
    ]);
    expect(spec.fullModeWeights).toMatchObject({ integrity: 0.04, intent: 0 });
  });
});

describe('BR-U1-22 FR-22 producers', () => {
  it('registry: FF-N01 integrity/neuronal, FF-N02 semantic; FULL_MODE_WEIGHTS integrity 0.04, intent 0', () => {
    for (const style of ['clean-architecture', 'nestjs']) {
      const t = resolveTemplate(style);
      const n01 = t?.functions.find((f) => String(f.id) === 'FF-N01');
      const n02 = t?.functions.find((f) => String(f.id) === 'FF-N02');
      expect([n01?.name, n01?.dimension, n01?.route]).toEqual(['srp-semantic', 'integrity', 'neuronal']);
      expect([n02?.dimension, n02?.route]).toEqual(['semantic', 'neuronal']);
      expect(t?.defaultFullModeWeights).toMatchObject({ semantic: 0.04, integrity: 0.04, intent: 0 });
      expect(t?.defaultWeights).toMatchObject({ semantic: 0, integrity: 0, intent: 0 });
    }
  });

  it.each(SHIPPED)('%s: FF-N01 integrity/neuronal, FF-N02 semantic, full_mode_weights integrity 0.04, no SPEC_004', async (rel) => {
    const { spec, warnings } = await parsed(path.join(ROOT, rel));
    const n01 = spec.fitnessFunctions.find((f) => String(f.id) === 'FF-N01');
    const n02 = spec.fitnessFunctions.find((f) => String(f.id) === 'FF-N02');
    expect([n01?.name, n01?.dimension, n01?.route]).toEqual(['srp-semantic', 'integrity', 'neuronal']);
    expect(n02?.dimension).toBe('semantic');
    expect(spec.fullModeWeights).toMatchObject({ integrity: 0.04, intent: 0 });
    expect(spec004(warnings)).toEqual([]);
  });

  const ADRS: ADRRule[] = [
    { id: 'ADR-001', title: 'Use repositories', format: 'MADR', rawContent: 'Decision: use repositories.' },
    {
      id: 'ADR-002', title: 'No cycles', format: 'MADR', rawContent: 'Decision: no cycles.',
      symbolicRule: { query: 'MATCH (f:File) RETURN f.filePath AS filePath ORDER BY filePath', params: {}, description: 'd' },
    },
  ];

  it.each(SHIPPED)('%s plus an ADR fixture: no compiled member carries dimension intent', async (rel) => {
    const { spec } = await parsed(path.join(ROOT, rel));
    const r = compileFunctions({ ...compilerInputFromSpec(spec), adrRules: ADRS });
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    const dims = [
      ...r.data.symbolicQueries.map((q) => q.dimension),
      ...r.data.neuronalInstructions.map((n) => n.dimension),
      ...r.data.hybridPairs.flatMap((h) => [h.symbolicQuery.dimension, h.neuronalInstruction.dimension]),
    ];
    expect(dims.length).toBeGreaterThan(0);
    expect(dims).not.toContain('intent');
    // The ADR-derived members emit semantic.
    const adr = [
      ...r.data.neuronalInstructions.filter((n) => n.source === 'adr').map((n) => n.dimension),
      ...r.data.hybridPairs.filter((h) => String(h.functionId).startsWith('ADR-'))
        .flatMap((h) => [h.symbolicQuery.dimension, h.neuronalInstruction.dimension]),
    ];
    expect(adr).toEqual(['semantic', 'semantic', 'semantic']);
  });

  it("the 'intent' literal in src/spec-parser and src/fitness-compiler appears only in the alias code and the schema", () => {
    const hits: string[] = [];
    for (const dir of ['src/spec-parser', 'src/fitness-compiler']) {
      for (const file of fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.ts')).sort()) {
        fs.readFileSync(path.join(ROOT, dir, file), 'utf-8').split('\n').forEach((line) => {
          if (line.includes("'intent'")) hits.push(`${dir}/${file}`);
        });
      }
    }
    expect(hits).toEqual([
      'src/spec-parser/dimension-alias.ts',
      'src/spec-parser/layer-parsers.ts',
      'src/spec-parser/spec-schema.ts',
      'src/spec-parser/spec-schema.ts',
    ]);
  });
});

describe('BR-U1-23 INTENT_VIOLATION deprecated', () => {
  it('the taxonomy keeps INTENT_VIOLATION with a deprecation comment', () => {
    const text = fs.readFileSync(path.join(ROOT, 'src/shared/taxonomy/violation-types.ts'), 'utf-8');
    const line = text.split('\n').find((l) => l.includes("'INTENT_VIOLATION'"));
    expect(line).toMatch(/\/\/ deprecated \(FR-22, BR-U1-23\)/);
  });

  it('no U1 code (src/spec-parser, src/fitness-compiler) emits INTENT_VIOLATION', () => {
    for (const dir of ['src/spec-parser', 'src/fitness-compiler']) {
      for (const file of fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.ts'))) {
        expect(fs.readFileSync(path.join(ROOT, dir, file), 'utf-8')).not.toContain('INTENT_VIOLATION');
      }
    }
  });
});

describe('BR-U1-24 full-mode window', () => {
  it('tests/golden/CHANGES.md holds a U1-K14 observation line naming full mode and Q11', () => {
    const lines = fs.readFileSync(path.join(ROOT, 'tests/golden/CHANGES.md'), 'utf-8').split('\n');
    const hits = lines.filter((l) => l.includes(' U1-K14 observation ') && l.includes('full mode') && l.includes('Q11'));
    expect(hits).toHaveLength(1);
  });
});
