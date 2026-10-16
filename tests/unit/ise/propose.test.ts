import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { inferFromGraph } from '../../../src/ise/infer.js';
import {
  INFERRED_SPEC_LABEL,
  builtinPresetsDir,
  checkProposal,
  proposalFromInference,
  proposeSpec,
} from '../../../src/ise/propose.js';
import { cleanShaped, layeredShaped } from './helpers.js';

const PRESETS = path.resolve('presets');
const OK = { valid: true, compiles: true, errors: [], warnings: [] };

describe('ISE spec proposal (firewall init)', () => {
  it('keeps the emitted spec body and comments every layer glob with confidence and evidence', () => {
    const inf = inferFromGraph(cleanShaped(), { presetsDir: PRESETS });
    const p = proposalFromInference(inf, OK);
    expect(p.label).toBe(INFERRED_SPEC_LABEL);
    expect(p.style).toBe('clean-architecture');
    expect(YAML.parse(p.yaml)).toEqual(YAML.parse(inf.specYaml));
    expect(p.yaml.startsWith('# INFERRED SPEC, NOT AUTHOR-DECLARED')).toBe(true);
    expect(p.yaml).toMatch(/- src\/domain\/\*\* # preset, confidence 0\.90: canonical preset glob; name suggests domain; structure suggests domain/);
    expect(p.mappings.map((m) => [m.layer, m.glob, m.origin])).toEqual([
      ['domain', 'src/domain/**', 'preset'], ['application', 'src/application/**', 'preset'], ['infrastructure', 'src/infrastructure/**', 'preset'],
    ]);
    expect(p.questions).toEqual([]);
    expect(p.yaml).toMatch(/# Questions: none/);
  });

  it('marks structure-only mappings INFERRED and asks about each of them', () => {
    const inf = inferFromGraph(cleanShaped('kernel', 'orchestration', 'platform'), { presetsDir: PRESETS });
    const p = proposalFromInference(inf, OK);
    expect(p.mappings.every((m) => m.origin === 'inferred' && m.source === 'structure' && m.confidence === 0.5)).toBe(true);
    expect(p.yaml).toMatch(/- src\/kernel\/\*\* # INFERRED, confidence 0\.50: import structure only/);
    expect(p.questions.map((q) => [q.subject, q.proposed])).toEqual([
      ['src/kernel/', 'domain'], ['src/orchestration/', 'application'], ['src/platform/', 'infrastructure'],
    ]);
    expect(p.questions[0]?.question).toMatch(/Is src\/kernel\/ the domain layer\? Only its imports say so/);
    expect(p.yaml).toMatch(/# Q1\. Is src\/kernel\/ the domain layer\?/);
  });

  it('does not ask about an entry file that is deliberately outside the layers, but lists it as unassigned', () => {
    const p = proposalFromInference(inferFromGraph(layeredShaped(), { presetsDir: PRESETS }), OK);
    expect(p.unassignedFiles).toEqual(['src/main.ts']);
    expect(p.questions.filter((q) => q.subject === 'src/main.ts')).toEqual([]);
  });

  it('writes a warning header when the proposal fails the repository checks', () => {
    const inf = inferFromGraph(cleanShaped(), { presetsDir: PRESETS });
    const p = proposalFromInference(inf, { valid: true, compiles: false, errors: ['BR-SPEC-10: x'], warnings: [] });
    expect(p.yaml).toMatch(/# WARNING: this proposal does not pass the repository checks: BR-SPEC-10: x/);
  });

  it('checkProposal adds the fitness compiler to the validator verdict', async () => {
    const inf = inferFromGraph(cleanShaped(), { presetsDir: PRESETS });
    const c = await checkProposal(inf.specYaml, { valid: true, errors: [], warnings: ['w'] });
    expect(c).toEqual({ valid: true, compiles: true, errors: [], warnings: ['w'] });
    const broken = await checkProposal('architecture: [', { valid: false, errors: ['parse'], warnings: [] });
    expect(broken.compiles).toBe(false);
  });

  it('finds the tool presets directory', () => {
    expect(fs.existsSync(path.join(builtinPresetsDir(), 'clean-architecture.yaml'))).toBe(true);
  });

  it('proposes for a real project from its source only and leaves the project untouched', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ise-propose-test-'));
    try {
      fs.cpSync(path.resolve('tests/fixtures/v1.3-reference/layered/project'), dir, { recursive: true });
      const before = fs.readdirSync(dir).sort();
      const p = await proposeSpec(dir, { presetsDir: PRESETS });
      expect(p.style).toBe('layered');
      expect(p.check).toEqual(expect.objectContaining({ valid: true, compiles: true }));
      expect(fs.readdirSync(dir).sort()).toEqual(before);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
