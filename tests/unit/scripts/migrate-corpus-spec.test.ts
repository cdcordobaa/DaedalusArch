import { migrate, main, CV02_FROM, CV02_TO } from '../../../scripts/migrate-corpus-spec.js';

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
