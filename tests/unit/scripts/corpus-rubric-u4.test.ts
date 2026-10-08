/**
 * Step 27: corpus rubric step (BR-U4-RUB-03; FR-22, Q13 A; D-U4-10). Pure module `applyRubric` /
 * `assertNoOldRubric` and the export-free CLI entry (spawned through tsx).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { applyRubric, assertNoOldRubric, SELF_TEST_SPEC } from '../../../scripts/corpus-rubric-u4.js';
import {
  FF_N01_NAME, FF_N01_RUBRIC, FF_N02_NAME, FF_N02_RUBRIC,
} from '../../../src/llm-critic/rubric.js';

const ROOT = path.resolve(__dirname, '../../..');
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');
const CLI = path.join(ROOT, 'scripts/corpus-rubric-u4-cli.ts');

// The pre-U4-K6 FF-N01/FF-N02 text (the corpus shape before this step).
const OLD: readonly (readonly [string, string])[] = [
  [FF_N01_NAME, 'srp-semantic'],
  [FF_N01_RUBRIC.rule, 'A class should have exactly one reason to change'],
  [FF_N01_RUBRIC.pass, 'Class responsibilities are cohesive and serve a single purpose'],
  [FF_N01_RUBRIC.fail, 'Class mixes unrelated concerns (data access + business logic, etc.)'],
  [FF_N01_RUBRIC.evidenceRequired, 'Cite specific methods that indicate mixed responsibilities'],
  [FF_N02_NAME, 'layering-intent'],
  [FF_N02_RUBRIC.rule, 'Code should respect the documented architectural intent'],
  [FF_N02_RUBRIC.pass, 'File is in the correct layer and dependencies respect layer boundaries'],
  [FF_N02_RUBRIC.fail, 'File logic or dependencies contradict the architectural layer it lives in'],
  [FF_N02_RUBRIC.evidenceRequired, 'Cite the specific import or logic that violates the intent'],
];

function toOld(text: string): string {
  return OLD.reduce((t, [now, old]) => t.split(now).join(old), text);
}

// Corpus-shaped spec with comments, mixed quoting, a flow-mapping rubric and non-alphabetical key order.
const CORPUS = `# Corpus spec: example project
spec_version: "1.0.0"
fitness_functions:
  - id: FF-S01
    name: dependency-direction   # symbolic, untouched
    dimension: structural
  # neural functions below
  - severity: major
    id: FF-N01
    name: 'srp-semantic'   # integrity
    dimension: integrity
    semantic_criteria:
      rubric: { pass: "Class responsibilities are cohesive", fail: 'Class mixes it''s concerns', evidence_required: "Cite methods" }
      rule: A class should have exactly one reason to change
  - id: FF-N02
    name: layering-intent
    dimension: semantic
    semantic_criteria:
      rule: |
        Code should respect the documented architectural intent
      rubric:
        pass: "p"   # keep me
        fail: "f"
        evidence_required: "e"
scoring:
  weights: { structural: 1 }
`;

describe('applyRubric (BR-U4-RUB-03)', () => {
  it.each(['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'presets/layered.yaml', 'specs/clean-arch.yaml', 'specs/daedalus-arch.yaml'])(
    'on %s with the pre-K6 rubric gives the shipped file byte for byte', (rel) => {
      const shipped = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
      const legacy = toOld(shipped);
      expect(legacy).not.toBe(shipped);
      const r = applyRubric(legacy);
      expect(r.text).toBe(shipped);
      expect(r.edited).toBe(true);
      expect(r.editedPaths).toHaveLength(10);
      expect(r.untouched).toEqual([]);
    });

  it('is idempotent: a second run edits nothing', () => {
    const once = applyRubric(CORPUS);
    expect(once.edited).toBe(true);
    const twice = applyRubric(once.text);
    expect(twice).toEqual({ text: once.text, edited: false, editedPaths: [], untouched: [] });
  });

  it('keeps comments, key order and the other scalars; values equal rubric.ts', () => {
    const r = applyRubric(CORPUS);
    for (const c of ['# Corpus spec: example project', '# symbolic, untouched', '# neural functions below', '# integrity', '# keep me']) {
      expect(r.text).toContain(c);
    }
    // key order of FF-N01 (severity first, rubric before rule) kept
    expect(r.text).toMatch(/- severity: major\n {4}id: FF-N01\n {4}name: 'architectural-integrity' {3}# integrity\n/);
    expect(r.text.indexOf('      rubric: {')).toBeLessThan(r.text.indexOf('      rule: '));
    expect(r.text).toContain('  weights: { structural: 1 }\n');
    const doc = parse(r.text) as { fitness_functions: Record<string, unknown>[] };
    const [s01, n01, n02] = doc.fitness_functions;
    expect(s01).toEqual({ id: 'FF-S01', name: 'dependency-direction', dimension: 'structural' });
    expect(Object.keys(n01 ?? {})).toEqual(['severity', 'id', 'name', 'dimension', 'semantic_criteria']);
    expect(n01?.semantic_criteria).toEqual({
      rubric: { pass: FF_N01_RUBRIC.pass, fail: FF_N01_RUBRIC.fail, evidence_required: FF_N01_RUBRIC.evidenceRequired },
      rule: FF_N01_RUBRIC.rule,
    });
    expect(n02?.name).toBe(FF_N02_NAME);
    expect(n02?.semantic_criteria).toEqual({
      rule: FF_N02_RUBRIC.rule,
      rubric: { pass: FF_N02_RUBRIC.pass, fail: FF_N02_RUBRIC.fail, evidence_required: FF_N02_RUBRIC.evidenceRequired },
    });
    expect(() => { assertNoOldRubric(r.text); }).not.toThrow();
  });

  it('reports a function without semantic criteria, and an undeclared function, as untouched', () => {
    const r = applyRubric('fitness_functions:\n  - id: FF-N01\n    name: srp-semantic\n');
    expect(r.editedPaths).toEqual(['fitness_functions[FF-N01].name']);
    expect(r.untouched).toEqual([
      'fitness_functions[FF-N01].semantic_criteria: key not declared',
      'fitness_functions[FF-N02]: FF-N02 not declared',
    ]);
  });

  it('refuses unparsable YAML', () => {
    expect(() => applyRubric('a: [1,\n')).toThrow(/YAML parse error/);
  });
});

describe('assertNoOldRubric', () => {
  it('fails on the old name', () => {
    expect(() => { assertNoOldRubric(SELF_TEST_SPEC); }).toThrow(/FF-N01: retired name srp-semantic/);
    expect(() => { assertNoOldRubric('fitness_functions:\n  - { id: FF-N02, name: layering-intent }\n'); })
      .toThrow(/FF-N02: retired name layering-intent/);
  });

  it('fails on SRP rubric text under a new name', () => {
    const spec = 'fitness_functions:\n  - id: FF-N01\n    name: architectural-integrity\n    semantic_criteria:\n'
      + '      rule: "A class should have exactly one reason to change"\n';
    expect(() => { assertNoOldRubric(spec); }).toThrow(/FF-N01: SRP rubric text/);
  });

  it('passes on every shipped spec', () => {
    for (const rel of ['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'presets/layered.yaml', 'specs/clean-arch.yaml', 'specs/daedalus-arch.yaml']) {
      expect(() => { assertNoOldRubric(fs.readFileSync(path.join(ROOT, rel), 'utf-8')); }).not.toThrow();
    }
  });
});

describe('corpus-rubric-u4-cli (D-U4-10)', () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-rubric-'));
  afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });
  const cli = (args: string[]): { status: number | null; stdout: string } => {
    const r = spawnSync(TSX, [CLI, ...args], { cwd: ROOT, encoding: 'utf-8' });
    return { status: r.status, stdout: r.stdout };
  };

  it('--self-test exits 1 (the built-in spec with the old name fails the assertion)', () => {
    const r = cli(['--self-test']);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('retired name srp-semantic');
  });

  it('writes the rubric, then a rerun and --check report no change with exit 0', () => {
    const file = path.join(TMP, 'spec.yaml');
    fs.writeFileSync(file, CORPUS);
    expect(cli(['--check', file]).status).toBe(2);
    expect(fs.readFileSync(file, 'utf-8')).toBe(CORPUS);
    expect(cli([file]).status).toBe(0);
    expect(fs.readFileSync(file, 'utf-8')).toBe(applyRubric(CORPUS).text);
    const again = cli([file]);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('no change');
    expect(cli(['--check', file]).status).toBe(0);
  });

  it('exits 2 when a target stays untouched and the old rubric remains', () => {
    const file = path.join(TMP, 'partial.yaml');
    fs.writeFileSync(file, 'fitness_functions:\n  - id: FF-N02\n    name: layering-intent\n    semantic_criteria:\n      rule: "x"\n');
    expect(cli([file]).status).toBe(2);
  });

  it('exits 1 on usage errors', () => {
    expect(cli([]).status).toBe(1);
    expect(cli(['--bogus', 'x.yaml']).status).toBe(1);
  });
});
