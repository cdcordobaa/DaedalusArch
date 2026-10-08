import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { migrate, main, CV02_FROM, CV02_TO } from '../../../scripts/migrate-corpus-spec.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';

// Inline nestjs-style corpus spec (shape of presets/nestjs.yaml before FR-22 and K3).
const SPEC = `# Corpus spec: example project
spec_version: "1.0.0"

architecture:
  style: nestjs
  layers:
    - name: domain
      roles: [entity]

fitness_functions:
  - id: FF-CV02
    name: naming-services
    dimension: convention   # service naming
    severity: minor
    route: symbolic
    validated: false
    pattern: "*Service"

  # Neuronal checks
  - id: FF-N01
    name: srp-semantic
    dimension: solid
    severity: major
    route: hybrid
    validated: false

  - id: FF-N02
    name: layering-intent
    dimension: intent
    severity: major
    route: neuronal

scoring:
  full_mode_weights:
    structural: 0.32
    coupling: 0.18
    pattern: 0.27
    solid: 0.10
    convention: 0.05
    semantic: 0.04
    intent: 0.04   # legacy key
`;

function changedLines(a: string, b: string): [string, string][] {
  const al = a.split('\n');
  const bl = b.split('\n');
  expect(bl).toHaveLength(al.length);
  return al.flatMap((line, i): [string, string][] => (line === bl[i] ? [] : [[line, bl[i] ?? '']]));
}

describe('migrate fr22 (FR-22, BR-U1-25)', () => {
  const r = migrate(SPEC, 'fr22');

  it('edits exactly the FR-22 keys and reports each path', () => {
    expect(r.editedPaths).toEqual([
      'fitness_functions[FF-N01].dimension',
      'fitness_functions[FF-N01].route',
      'fitness_functions[FF-N02].dimension',
      'scoring.full_mode_weights.intent',
    ]);
    expect(r.untouched).toEqual([]);
    expect(changedLines(SPEC, r.text)).toEqual([
      ['    dimension: solid', '    dimension: integrity'],
      ['    route: hybrid', '    route: neuronal'],
      ['    dimension: intent', '    dimension: semantic'],
      ['    intent: 0.04   # legacy key', '    integrity: 0.04   # legacy key'],
    ]);
  });

  it('keeps comments and key order (full_mode_weights key keeps its position)', () => {
    expect(r.text).toContain('# Corpus spec: example project');
    expect(r.text).toContain('  # Neuronal checks');
    expect(r.text).toContain('dimension: convention   # service naming');
    const keys = r.text.split('full_mode_weights:\n')[1]?.split('\n').filter(Boolean).map((l) => l.trim().split(':')[0]);
    expect(keys).toEqual(['structural', 'coupling', 'pattern', 'solid', 'convention', 'semantic', 'integrity']);
  });

  it('(b) rerun on the output yields no diff and no edit', () => {
    const again = migrate(r.text, 'fr22');
    expect(again.text).toBe(r.text);
    expect(again.editedPaths).toEqual([]);
    expect(again.untouched).toEqual([]);
  });

  it('does not touch FF-CV02', () => {
    expect(r.text).toContain(`pattern: "${CV02_FROM}"`);
  });

  it('reports missing targets instead of inventing them', () => {
    const bare = 'spec_version: "1.0.0"\nfitness_functions:\n  - id: FF-C02\n    name: module-fan-out\n';
    const out = migrate(bare, 'fr22');
    expect(out.text).toBe(bare);
    expect(out.untouched).toEqual([
      'fitness_functions[FF-N01].dimension: FF-N01 not declared',
      'fitness_functions[FF-N01].route: FF-N01 not declared',
      'fitness_functions[FF-N02].dimension: FF-N02 not declared',
      'scoring.full_mode_weights.intent: scoring.full_mode_weights not declared',
    ]);
  });

  it('leaves a full_mode_weights block that declares both intent and integrity untouched and reports it', () => {
    const both = 'scoring:\n  full_mode_weights:\n    integrity: 0.04\n    intent: 0.04\n';
    const out = migrate(both, 'fr22');
    expect(out.text).toBe(both);
    expect(out.untouched).toContain('scoring.full_mode_weights.intent: both intent and integrity declared');
  });
});

describe('migrate cv02 (ADR-015 item 10, U1 Q21 B, BR-U1-25)', () => {
  it('rewrites exactly *Service to *Service|*UseCase, quoting kept', () => {
    const r = migrate(SPEC, 'cv02');
    expect(r.editedPaths).toEqual(['fitness_functions[FF-CV02].pattern']);
    expect(r.untouched).toEqual([]);
    expect(changedLines(SPEC, r.text)).toEqual([['    pattern: "*Service"', `    pattern: "${CV02_TO}"`]]);
  });

  it('(b) rerun on the output yields no diff and no report', () => {
    const once = migrate(SPEC, 'cv02').text;
    const again = migrate(once, 'cv02');
    expect(again.text).toBe(once);
    expect(again.editedPaths).toEqual([]);
    expect(again.untouched).toEqual([]);
  });

  it.each(['*Foo', '*Service|*Handler', 'Service', '*Services'])(
    '(d) pattern %j is left untouched and reported', (value) => {
      const spec = SPEC.replace('pattern: "*Service"', `pattern: "${value}"`);
      const r = migrate(spec, 'cv02');
      expect(r.text).toBe(spec);
      expect(r.editedPaths).toEqual([]);
      expect(r.untouched).toEqual([
        `fitness_functions[FF-CV02].pattern: value ${JSON.stringify(value)} is not exactly "*Service"`,
      ]);
    },
  );

  it('keeps single quotes', () => {
    const spec = SPEC.replace('pattern: "*Service"', "pattern: '*Service'");
    expect(migrate(spec, 'cv02').text).toContain("pattern: '*Service|*UseCase'");
  });

  it('does not touch the FR-22 keys', () => {
    const r = migrate(SPEC, 'cv02');
    expect(r.text).toContain('dimension: solid');
    expect(r.text).toContain('intent: 0.04   # legacy key');
  });
});

describe('main (D-U1-15)', () => {
  it('--self-test resolves to 1 (cv02 reports the *Foo pattern untouched)', async () => {
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await expect(main(['--self-test'])).resolves.toBe(1);
    } finally {
      write.mockRestore();
    }
  });

  it('rejects a missing or unknown step with 1', async () => {
    const write = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await expect(main(['--step', 'fr99', 'x.yaml'])).resolves.toBe(1);
      await expect(main(['x.yaml'])).resolves.toBe(1);
    } finally {
      write.mockRestore();
    }
  });
});

describe('(c) a migrated corpus-shaped spec parses without SPEC_004 (FR-22, BR-U1-25 c; needs K14)', () => {
  const ROOT = path.resolve(__dirname, '../../..');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u1-migrate-c-'));
  afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

  // The inline SPEC above is a fragment (no layers' directories, weights or thresholds) and cannot
  // pass parseSpec, so (c) uses a full nestjs-style spec: presets/nestjs.yaml with the three FR-22
  // keys and the FF-CV02 pattern put back to their pre-migration values (the corpus shape).
  const preset = fs.readFileSync(path.join(ROOT, 'presets/nestjs.yaml'), 'utf-8');
  const legacy = preset
    .replace('    dimension: integrity\n    severity: major\n    route: neuronal\n', '    dimension: solid\n    severity: major\n    route: hybrid\n')
    .replace('    name: layering-intent\n    dimension: semantic\n', '    name: layering-intent\n    dimension: intent\n')
    .replace(/^ {4}integrity: 0\.04$/m, '    intent: 0.04')
    .replace(`    pattern: "${CV02_TO}"`, `    pattern: "${CV02_FROM}"`);

  async function spec004(text: string, name: string): Promise<string[]> {
    const file = path.join(TMP, name);
    fs.writeFileSync(file, text);
    const r = await parseSpec({ specFilePath: file });
    expect(r.success).toBe(true);
    return (r.warnings ?? []).filter((w) => w.code === 'SPEC_004').map((w) => w.message);
  }

  it('the legacy fixture really is unmigrated', () => {
    expect(legacy).not.toMatch(/integrity/);
    expect(legacy).toContain(`pattern: "${CV02_FROM}"`);
    expect(legacy).not.toContain(CV02_TO);
  });

  it('the unmigrated spec yields SPEC_004 (the check is live)', async () => {
    expect(await spec004(legacy, 'unmigrated.yaml')).toEqual([
      'Dimension "intent" of FF-N02 is deprecated; mapped to "semantic"',
      'full_mode_weights.intent is deprecated; mapped to integrity',
    ]);
  });

  it('fr22 then cv02 gives a spec that parses with no SPEC_004 and equals the corrected preset', async () => {
    const fr22 = migrate(legacy, 'fr22');
    expect(fr22.editedPaths).toEqual([
      'fitness_functions[FF-N01].dimension',
      'fitness_functions[FF-N01].route',
      'fitness_functions[FF-N02].dimension',
      'scoring.full_mode_weights.intent',
    ]);
    const cv02 = migrate(fr22.text, 'cv02');
    expect(cv02.editedPaths).toEqual(['fitness_functions[FF-CV02].pattern']);
    expect(cv02.untouched).toEqual([]);
    expect(await spec004(cv02.text, 'migrated.yaml')).toEqual([]);
    expect(cv02.text).toBe(preset);
  });
});

describe('migrate fp06 (U3 FR-21, BR-U3-24; attributed cross-unit U3 rule)', () => {
  const ROOT = path.resolve(__dirname, '../../..');
  const WITH_LAYERS = `spec_version: "1.0.0"
architecture:
  style: clean-architecture
  layers:
    - name: core
      kind: domain
      roles: [entity]
    - name: adapters
      kind: infrastructure
      roles: [repository]

fitness_functions:
  - id: FF-P01
    name: domain-purity
    dimension: pattern

  - id: FF-P05
    name: controller-no-entity
    dimension: pattern
    validated: false  # pending

  # ── COUPLING ──

  - id: FF-C01
    name: domain-stability
`;
  const P06_BLOCK = '\n  - id: FF-P06\n    name: domain-state-purity\n    dimension: pattern\n    severity: critical\n    route: symbolic\n    validated: false\n';

  it('inserts FF-P06 after FF-P05 in block style, keeping every other byte', () => {
    const r = migrate(WITH_LAYERS, 'fp06');
    expect(r.editedPaths).toEqual(['fitness_functions[FF-P06]']);
    expect(r.untouched).toEqual([]);
    expect(r.text).toBe(WITH_LAYERS.replace('    validated: false  # pending\n', `    validated: false  # pending\n${P06_BLOCK}`));
  });

  it('(b) is idempotent: a rerun on the output edits nothing and reports nothing', () => {
    const once = migrate(WITH_LAYERS, 'fp06').text;
    const again = migrate(once, 'fp06');
    expect(again.text).toBe(once);
    expect(again.editedPaths).toEqual([]);
    expect(again.untouched).toEqual([]);
  });

  it('accepts a layer named persistence (no kind) as the infrastructure layer, and a layer named domain', () => {
    const spec = WITH_LAYERS.replace('    - name: core\n      kind: domain\n', '    - name: domain\n')
      .replace('    - name: adapters\n      kind: infrastructure\n', '    - name: persistence\n');
    expect(migrate(spec, 'fp06').editedPaths).toEqual(['fitness_functions[FF-P06]']);
  });

  it('without FF-P05 it follows the last FF-P function; without any FF-P it goes last', () => {
    const noP05 = WITH_LAYERS.replace('  - id: FF-P05\n    name: controller-no-entity\n    dimension: pattern\n    validated: false  # pending\n\n', '');
    expect(migrate(noP05, 'fp06').text).toBe(noP05.replace('    dimension: pattern\n', `    dimension: pattern\n${P06_BLOCK}`));
    const noP = 'architecture:\n  layers:\n    - { name: domain }\n    - { name: infrastructure }\nfitness_functions:\n  - id: FF-C01\n    name: domain-stability\n';
    expect(migrate(noP, 'fp06').text).toBe(`${noP}${P06_BLOCK}`);
  });

  it('follows a flow-style anchor with a flow-style item', () => {
    const flow = 'architecture:\n  layers:\n    - { name: business, kind: domain }\n    - { name: persistence, kind: infrastructure }\nfitness_functions:\n  - { id: FF-P05, name: controller-no-entity }\n  - { id: FF-C01, name: domain-stability }\n';
    expect(migrate(flow, 'fp06').text).toBe(flow.replace('controller-no-entity }\n',
      'controller-no-entity }\n  - { id: FF-P06, name: domain-state-purity, dimension: pattern, severity: critical, route: symbolic, validated: false }\n'));
  });

  it('a spec without a declared infrastructure layer is left untouched and reported', () => {
    const r = migrate(SPEC, 'fp06');
    expect(r.text).toBe(SPEC);
    expect(r.editedPaths).toEqual([]);
    expect(r.untouched).toEqual(['fitness_functions[FF-P06]: no domain and infrastructure (or persistence) layer declared']);
  });

  it('does not touch the FR-22 keys or FF-CV02', () => {
    const r = migrate(WITH_LAYERS + (SPEC.split('fitness_functions:\n')[1] ?? ''), 'fp06');
    expect(r.text).toContain('dimension: solid');
    expect(r.text).toContain('pattern: "*Service"');
  });

  it.each(['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'presets/layered.yaml'])(
    '%s without FF-P06 migrates back to the shipped declaration, which parses and compiles FF-P06', async (rel) => {
      const shipped = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
      const comment = '  # FR-21 (U3-R6; BR-U3-22..24): domain class holding infrastructure state (FLOWS_TO | CONSTRUCTOR_INJECTS)\n';
      const p06 = `${comment}${P06_BLOCK.slice(1)}\n`;
      expect(shipped).toContain(p06);
      const legacy = shipped.replace(p06, '');
      const r = migrate(legacy, 'fp06');
      expect(r.editedPaths).toEqual(['fitness_functions[FF-P06]']);
      expect(r.text).toBe(shipped.replace(comment, ''));
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'u3-fp06-'));
      try {
        const file = path.join(tmp, path.basename(rel));
        fs.writeFileSync(file, r.text);
        const parsed = await parseSpec({ specFilePath: file });
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data.fitnessFunctions.find((f) => String(f.id) === 'FF-P06')?.name).toBe('domain-state-purity');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    },
  );

  it('main accepts --step fp06 and writes the file', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'u3-fp06-cli-'));
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const file = path.join(tmp, 'spec.yaml');
      fs.writeFileSync(file, WITH_LAYERS);
      await expect(main(['--step', 'fp06', file])).resolves.toBe(0);
      expect(fs.readFileSync(file, 'utf-8')).toContain('  - id: FF-P06\n');
      await expect(main(['--step', 'fp06', file])).resolves.toBe(0);
    } finally {
      write.mockRestore();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
