/**
 * U5b Step 12: pre-registration library and gate (BR-U5b-50, 51; ADR-015 items 1, 2; exit criterion 5).
 * Every case runs in a temp git repository; the schema is read from this checkout (`schemaRoot`).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  buildPreRegistration, checkPreRegistration, FIXTURE_SPECS, isRegisteredPath, loadPreRegistration, PREREG_FILE, PREREG_REFUSED,
  REGISTERED_ARTEFACTS, registeredArtefactPaths, validatePreRegistration,
} from '../../../../scripts/lib/prereg.js';
import type { PreRegistration } from '../../../../scripts/lib/prereg.js';
import { ROOT } from './score-fixture.js';

const T0 = Date.parse('2026-10-01T00:00:00Z');
let repo = '';

function git(args: readonly string[], whenMs = T0): string {
  const date = `${String(Math.floor(whenMs / 1000))} +0000`;
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  }).trim();
}

function put(path: string, text: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}

function register(version: number, whenMs: number, extra: Partial<PreRegistration> = {}): PreRegistration {
  const p = { ...buildPreRegistration(repo, { version, registeredAt: new Date(whenMs).toISOString(), matchingRuleVersion: '1.0.0', labellingBudgetCalls: 100 }), ...extra };
  put(PREREG_FILE, `${JSON.stringify(p, null, 2)}\n`);
  git(['add', PREREG_FILE]);
  git(['commit', '-q', '-m', `prereg v${String(version)}`], whenMs);
  return p;
}

const PLAN = 'experiments/fixtures/plan.json';
const check = (over: Partial<Parameters<typeof checkPreRegistration>[0]> = {}): ReturnType<typeof checkPreRegistration> => checkPreRegistration({
  repoRoot: repo, schemaRoot: ROOT, planPath: PLAN, specPaths: ['specs/clean-arch.yaml'], records: [], now: new Date(T0 + 3_600_000), ...over,
});

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'u5b-prereg-'));
  git(['init', '-q']);
  put('Docs/matching-rule.md', '# rule\n');
  put('Docs/analysis-plan.md', '# plan\n');
  put('corpus/specs/realworld-test.yaml', 'spec_version: "1.0.0"\n');
  put(PLAN, '{"id":"fixtures"}\n');
  put('specs/clean-arch.yaml', 'not registered\n');
  put('README.md', 'not registered\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'artefacts'], T0 - 60_000);
});
afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

describe('registry (BR-U5b-51)', () => {
  it('equals the BR-U5b-51 set exactly, incl. both code-list documents (BR-U5b-30)', () => {
    expect([...REGISTERED_ARTEFACTS]).toEqual([
      'Docs/matching-rule.md', 'Docs/analysis-plan.md', 'Docs/operator-catalogue.md', 'Docs/generator-protocol.md',
      'scripts/generator/prompts/*.md', 'Docs/corpus-criteria.md', 'Docs/labeller-prompts/*', 'corpus/corpus.json',
      'corpus/overlays/**', 'corpus/specs/*.yaml', 'experiments/*/plan.json', 'experiments/e1-grid/generator-plan.json',
      'corpus/frozen-instrument.json',
    ]);
    // ADR-021 SO5-03 / THR-8: the E1 generator plan is registered; another experiment's generator plan is not.
    expect(isRegisteredPath('experiments/e1-grid/generator-plan.json')).toBe(true);
    expect(isRegisteredPath('experiments/e7-corpus/generator-plan.json')).toBe(false);
    expect(REGISTERED_ARTEFACTS).toContain('Docs/matching-rule.md');
    expect(REGISTERED_ARTEFACTS).toContain('Docs/analysis-plan.md');
    expect(isRegisteredPath('corpus/overlays/realworld-test/config.patch')).toBe(true);
    expect(isRegisteredPath('corpus/specs/nested/x.yaml')).toBe(false);
    expect(isRegisteredPath('specs/clean-arch.yaml')).toBe(false);
  });

  it('build hashes the committed registered files only', () => {
    expect(registeredArtefactPaths(repo)).toEqual(['Docs/analysis-plan.md', 'Docs/matching-rule.md', PLAN, 'corpus/specs/realworld-test.yaml'].sort());
    const p = register(1, T0);
    expect(p.artefacts.map((a) => a.path)).not.toContain('README.md');
    expect(loadPreRegistration(repo, ROOT)).toEqual({ ok: true, value: p });
  });
});

describe('gate (BR-U5b-50)', () => {
  it('passes on an unchanged, committed, older registration and returns the frozen hashes', () => {
    const p = register(1, T0);
    const out = check();
    expect(out.ok).toBe(true);
    if (out.ok) expect(Object.keys(out.frozenHashes).sort()).toEqual(p.artefacts.map((a) => a.path).sort());
  });

  it('one changed byte in a registered file → refused naming the path', () => {
    register(1, T0);
    put('Docs/matching-rule.md', '# rulE\n');
    const out = check();
    expect(out).toMatchObject({ ok: false, code: PREREG_REFUSED, refusal: 'artefact-changed' });
    if (!out.ok) expect(out.detail).toContain('Docs/matching-rule.md');
  });

  it('missing, uncommitted or locally modified prereg.json → refused', () => {
    expect(check()).toMatchObject({ ok: false, refusal: 'prereg-missing' });
    const p = buildPreRegistration(repo, { version: 1, registeredAt: new Date(T0).toISOString(), matchingRuleVersion: '1.0.0', labellingBudgetCalls: 1 });
    put(PREREG_FILE, JSON.stringify(p));
    expect(check()).toMatchObject({ ok: false, refusal: 'prereg-uncommitted' });
    git(['add', PREREG_FILE]);
    git(['commit', '-q', '-m', 'p'], T0);
    expect(check().ok).toBe(true);
    put(PREREG_FILE, `${JSON.stringify(p)} `);
    expect(check()).toMatchObject({ ok: false, refusal: 'prereg-uncommitted' });
  });

  it('a registration newer than a recorded run → refused', () => {
    register(1, T0);
    const out = check({ records: [{ startedAt: new Date(T0 - 1000).toISOString(), preregVersion: 1 }] });
    expect(out).toMatchObject({ ok: false, refusal: 'prereg-too-new' });
    expect(check({ now: new Date(T0) })).toMatchObject({ ok: false, refusal: 'prereg-too-new' });
  });

  it('version 2 with a reason → passes; earlier records keep preregVersion 1', () => {
    register(1, T0);
    const recordPath = join(repo, 'run-1.run.json');
    writeFileSync(recordPath, JSON.stringify({ runId: 'r1', preregVersion: 1, startedAt: new Date(T0 + 1000).toISOString() }));
    expect(check({ records: [{ startedAt: new Date(T0 + 1000).toISOString(), preregVersion: 1 }] }).ok).toBe(true);
    put('Docs/matching-rule.md', '# rule v2\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'rule change'], T0 + 5000);
    const v1 = git(['log', '-1', '--format=%H', '--', PREREG_FILE]);
    const out1 = check({ records: [{ startedAt: new Date(T0 + 1000).toISOString(), preregVersion: 1 }] });
    expect(out1).toMatchObject({ ok: false, refusal: 'artefact-changed' });
    register(2, T0 + 10_000, { reason: 'matching rule wording', previous: [{ version: 1, commit: v1 }] });
    const out2 = check({ records: [{ startedAt: new Date(T0 + 1000).toISOString(), preregVersion: 1 }], now: new Date(T0 + 20_000) });
    expect(out2.ok).toBe(true);
    if (out2.ok) expect(out2.prereg.version).toBe(2);
    expect((JSON.parse(readFileSync(recordPath, 'utf8')) as { preregVersion: number }).preregVersion).toBe(1);
  });

  it('version 2 without a reason or previous list → invalid', () => {
    const p = buildPreRegistration(repo, { version: 2, registeredAt: new Date(T0).toISOString(), matchingRuleVersion: '1.0.0', labellingBudgetCalls: 1 });
    expect(validatePreRegistration(p, ROOT)).toEqual(expect.arrayContaining([expect.stringContaining('reason')]));
    expect(validatePreRegistration({ ...p, e1Grid: { models: 4, specLevels: 3, tasks: 2, runs: 3 } }, ROOT).length).toBeGreaterThan(0);
  });

  it('a plan whose spec is outside corpus/specs/ and the fixture specs → refused (BR-U5b-51)', () => {
    register(1, T0);
    expect(check({ specPaths: ['corpus/specs/realworld-test.yaml'] }).ok).toBe(true);
    expect(check({ specPaths: ['specs/daedalus-arch.yaml'] })).toMatchObject({ ok: false, refusal: 'spec-outside-corpus' });
    expect(check({ specPaths: [join(repo, '../elsewhere.yaml')] })).toMatchObject({ ok: false, refusal: 'spec-outside-corpus' });
  });

  it('the layered fixture spec of SP-FF-S03 is admitted (OI-U5b-P2-4; BR-U5b-51)', () => {
    expect(FIXTURE_SPECS).toEqual(['specs/clean-arch.yaml', 'tests/fixtures/u5a/layered/firewall.spec.yaml']);
    register(1, T0);
    expect(check({ specPaths: ['tests/fixtures/u5a/layered/firewall.spec.yaml'] }).ok).toBe(true);
    expect(check({ specPaths: ['tests/fixtures/u5a/no-domain/firewall.spec.yaml'] })).toMatchObject({ ok: false, refusal: 'spec-outside-corpus' });
  });

  it('a plan file that is not registered → refused', () => {
    register(1, T0);
    expect(check({ planPath: 'README.md' })).toMatchObject({ ok: false, refusal: 'plan-unregistered' });
  });
});
