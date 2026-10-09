/**
 * P-U6 runbook: seeded SO4 plan entries from a U5a manifest (ADR-021 item 9, SO4-04). Hand-computed fixtures.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
  SO4_PLAN_BASELINE_MISSING, SO4_PLAN_SEED_INVALID, SO4_PLAN_SPEC_MISMATCH, seedK, seededPlan, so4RunIdOf,
} from '../../../../scripts/lib/so4-plan-entries.js';
import type { ManifestRowView } from '../../../../scripts/lib/so4-plan-entries.js';
import { main } from '../../../../scripts/so4-plan-entries.js';
import { runIdOf } from '../../../../scripts/run-experiment.js';
import { ROOT } from '../u5b/score-fixture.js';

const row = (projectId: string, operatorId: string, k: number, specPath = `corpus/specs/${projectId}.yaml`): ManifestRowView => ({
  seedId: `${projectId}:${operatorId}:${String(k)}`, projectId, operatorId, split: 'held-out', baseKind: 'corpus', specPath,
});
const plan = {
  id: 'so4-heldout', extra: 'kept',
  projects: [
    { projectId: 'realworld-test', path: '../daedalus-corpus/realworld-test', specPath: 'corpus/specs/realworld-test.yaml' },
    { projectId: 'truthy-demo', path: '../daedalus-corpus/truthy-demo', specPath: 'corpus/specs/truthy-demo.yaml' },
  ],
};

describe('seeded SO4 plan entries (ADR-021 item 9)', () => {
  it('baselines keep indices 0..1; seeded entries follow with the copy path, the spec and the baseline report path', () => {
    const r = seededPlan(plan, [row('truthy-demo', 'MO-S01', 0), row('realworld-test', 'MO-P01', 1)], { copiesRoot: 'copies', manifestPath: 'm/manifest.json' });
    if (!r.ok) throw new Error(r.detail);
    expect(r).toMatchObject({ baselines: 2, seeded: 2 });
    expect(r.plan.extra).toBe('kept');
    expect(r.plan.projects.slice(0, 2)).toEqual(plan.projects);
    expect(r.plan.projects[2]).toEqual({
      projectId: 'truthy-demo:MO-S01:0', path: 'copies/truthy-demo/MO-S01/k-0', specPath: 'corpus/specs/truthy-demo.yaml',
      seed: { seedId: 'truthy-demo:MO-S01:0', baseProjectId: 'truthy-demo', split: 'held-out', baseKind: 'corpus', manifestPath: 'm/manifest.json', baselineReportPath: 'reports/so4-heldout-001-truthy-demo.json' },
    });
    expect(r.plan.projects[3]?.seed?.baselineReportPath).toBe('reports/so4-heldout-000-realworld-test.json');
    // Idempotent: running it again on its own output gives the same plan.
    const again = seededPlan(r.plan, [row('truthy-demo', 'MO-S01', 0), row('realworld-test', 'MO-P01', 1)], { copiesRoot: 'copies', manifestPath: 'm/manifest.json' });
    expect(again.ok && again.plan).toEqual(r.plan);
  });

  it('one base with two baseline specs (sensitivity: clean and layered): each row pairs with the baseline of its own spec', () => {
    const two = { id: 'sensitivity', projects: [
      { projectId: 'correct-reference', path: 'fixtures/correct-reference', specPath: 'specs/clean-arch.yaml' },
      { projectId: 'correct-reference', path: 'fixtures/correct-reference', specPath: 'tests/fixtures/u5a/layered/firewall.spec.yaml' },
    ] };
    const rows = [
      { ...row('correct-reference', 'SP-FF-S01', 0, 'specs/clean-arch.yaml'), split: 'probe' as const, baseKind: 'fixture' as const },
      { ...row('correct-reference', 'SP-FF-S03', 0, 'tests/fixtures/u5a/layered/firewall.spec.yaml'), split: 'probe' as const, baseKind: 'fixture' as const },
    ];
    const r = seededPlan(two, rows, { copiesRoot: '../daedalus-sp-probes/copies', manifestPath: '../daedalus-sp-probes/manifest.json' });
    if (!r.ok) throw new Error(r.detail);
    expect(r.plan.projects.slice(2).map((p) => [p.specPath, p.seed?.baselineReportPath])).toEqual([
      ['specs/clean-arch.yaml', 'reports/sensitivity-000-correct-reference.json'],
      ['tests/fixtures/u5a/layered/firewall.spec.yaml', 'reports/sensitivity-001-correct-reference.json'],
    ]);
    const first = { ...row('correct-reference', 'SP-FF-S01', 0, 'presets/layered.yaml'), split: 'probe' as const, baseKind: 'fixture' as const };
    expect(seededPlan(two, [first], { copiesRoot: 'c', manifestPath: 'm' })).toMatchObject({ ok: false, code: SO4_PLAN_SPEC_MISMATCH });
  });

  it('the run id rule equals the harness runIdOf; seedK parses <projectId>:<operatorId>:<k>', () => {
    expect(so4RunIdOf('so4-heldout', 4, 'a:MO-S01:2')).toBe(runIdOf('so4-heldout', { index: 4, projectId: 'a:MO-S01:2', path: '', specPath: '' }));
    expect(seedK({ seedId: 'p:MO-S01:12', projectId: 'p', operatorId: 'MO-S01' })).toBe(12);
    expect(seedK({ seedId: 'p:MO-S01:x', projectId: 'p', operatorId: 'MO-S01' })).toBeUndefined();
  });

  it('refuses a row without a baseline entry, a spec mismatch and a malformed seed id', () => {
    const o = { copiesRoot: 'c', manifestPath: 'm' };
    expect(seededPlan(plan, [row('valex', 'MO-S01', 0)], o)).toMatchObject({ ok: false, code: SO4_PLAN_BASELINE_MISSING });
    expect(seededPlan(plan, [row('truthy-demo', 'MO-S01', 0, 'specs/clean-arch.yaml')], o)).toMatchObject({ ok: false, code: SO4_PLAN_SPEC_MISMATCH });
    expect(seededPlan(plan, [{ ...row('truthy-demo', 'MO-S01', 0), seedId: 'truthy-demo:0' }], o)).toMatchObject({ ok: false, code: SO4_PLAN_SEED_INVALID });
  });

  it('CLI: --self-test exits 1; the committed hand-computed manifest on the fixtures plan gives 5 + 4 entries that validate', () => {
    const errs: string[] = [];
    const files = new Map<string, string>();
    const io = { out: () => undefined, err: (t: string) => { errs.push(t); }, writeFile: (p: string, t: string) => { files.set(p, t); writeFileSync(p, t); } };
    expect(main(['--self-test'], ROOT, io)).toBe(1);
    expect(errs.join('')).toContain(SO4_PLAN_BASELINE_MISSING);
    const dir = mkdtempSync(join(tmpdir(), 'u6-so4-entries-'));
    try {
      const out = join(dir, 'plan.json');
      expect(main(['--plan', 'experiments/fixtures/plan.json', '--manifest', 'tests/fixtures/u5b/hand-computed/manifest.json', '--copies', 'copies', '--out', out], ROOT, io)).toBe(0);
      const written = JSON.parse(readFileSync(out, 'utf8')) as { projects: { projectId: string; path: string; seed?: { baselineReportPath: string } }[] };
      expect(written.projects).toHaveLength(9);
      expect(written.projects[5]).toMatchObject({ projectId: 'correct-reference:MO-S01:0', path: 'copies/correct-reference/MO-S01/k-0', seed: { baselineReportPath: 'reports/fixtures-000-correct-reference.json' } });
      // A manifest that fails its schema writes nothing.
      writeFileSync(join(dir, 'bad.json'), JSON.stringify({ schemaVersion: 1, rows: [] }));
      const before = files.size;
      expect(main(['--plan', 'experiments/fixtures/plan.json', '--manifest', relative(ROOT, join(dir, 'bad.json')), '--copies', 'c', '--out', join(dir, 'x.json')], ROOT, io)).toBe(1);
      expect(files.size).toBe(before);
      // Runbook 3.2: an absolute --manifest or --copies (a scratch path) would land in the registered plan; usage error, nothing written.
      expect(main(['--plan', 'experiments/fixtures/plan.json', '--manifest', join(ROOT, 'tests/fixtures/u5b/hand-computed/manifest.json'), '--copies', '/private/tmp/so4/copies', '--out', join(dir, 'y.json')], ROOT, io)).toBe(2);
      expect(errs.at(-1)).toContain('--manifest and --copies must be repository-relative');
      expect(files.size).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
