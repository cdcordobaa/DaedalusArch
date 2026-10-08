/**
 * Build and Test Step 5: pre-registration bump tool (BR-U5b-50, 51). Every case runs in a temp git repository;
 * the schema is read from this checkout (`schemaRoot`).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildPreRegistration, checkPreRegistration, PREREG_FILE } from '../../../../scripts/lib/prereg.js';
import type { PreRegistration } from '../../../../scripts/lib/prereg.js';
import { bumpPreRegistration, main, registeredAtOf, uncommittedRegisteredPaths } from '../../../../scripts/register-prereg.js';
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

const PLAN = 'experiments/fixtures/plan.json';

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'bt-prereg-bump-'));
  git(['init', '-q']);
  put('Docs/matching-rule.md', '# rule\n');
  put('corpus/specs/realworld-test.yaml', 'spec_version: "1.0.0"\n');
  put(PLAN, '{"id":"fixtures"}\n');
  put('README.md', 'not registered\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'artefacts'], T0 - 120_000);
  const v1 = buildPreRegistration(repo, { version: 1, registeredAt: registeredAtOf(new Date(T0 - 60_000)), matchingRuleVersion: '1.0.0', labellingBudgetCalls: 4000 });
  put(PREREG_FILE, `${JSON.stringify(v1, null, 2)}\n`);
  git(['add', PREREG_FILE]);
  git(['commit', '-q', '-m', 'prereg v1'], T0 - 60_000);
});
afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

describe('bumpPreRegistration (BR-U5b-50)', () => {
  it('refuses an empty reason', () => {
    const r = bumpPreRegistration(repo, { reason: ' \t', now: new Date(T0), schemaRoot: ROOT });
    expect(r).toMatchObject({ ok: false, code: 'PREREG_BUMP_REFUSED', refusal: 'reason-empty' });
  });

  it('refuses while a registered artefact is modified, staged or untracked', () => {
    put('Docs/matching-rule.md', '# rule changed\n');
    expect(uncommittedRegisteredPaths(repo)).toEqual(['Docs/matching-rule.md']);
    const modified = bumpPreRegistration(repo, { reason: 'x', now: new Date(T0), schemaRoot: ROOT });
    expect(modified).toMatchObject({ ok: false, refusal: 'artefacts-uncommitted' });
    git(['add', 'Docs/matching-rule.md']);
    expect(bumpPreRegistration(repo, { reason: 'x', now: new Date(T0), schemaRoot: ROOT })).toMatchObject({ ok: false, refusal: 'artefacts-uncommitted' });
    git(['commit', '-q', '-m', 'rule'], T0 - 30_000);
    put('corpus/specs/truthy-demo.yaml', 'new\n');
    const untracked = bumpPreRegistration(repo, { reason: 'x', now: new Date(T0), schemaRoot: ROOT });
    expect(untracked).toMatchObject({ ok: false, refusal: 'artefacts-uncommitted' });
    expect(untracked.ok ? '' : untracked.detail).toContain('corpus/specs/truthy-demo.yaml');
  });

  it('an unregistered dirty file does not block a bump', () => {
    put('README.md', 'changed\n');
    expect(uncommittedRegisteredPaths(repo)).toEqual([]);
    expect(bumpPreRegistration(repo, { reason: 'x', now: new Date(T0), schemaRoot: ROOT }).ok).toBe(true);
  });

  it('bumps v1 to v2 over a committed artefact change; the gate then passes for a later run', async () => {
    const v1Commit = git(['log', '-1', '--format=%H', '--', PREREG_FILE]);
    put('Docs/matching-rule.md', '# rule v2\n');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'rule edit'], T0 - 30_000);
    let written = '';
    const code = await main(['--reason', 'catalogue freeze (P-1)'], repo, { out: (t) => { written += t; }, err: (t) => { written += t; }, now: () => new Date(T0), schemaRoot: ROOT });
    expect(code).toBe(0);
    expect(written).toMatch(/v2 written/);
    const v2 = JSON.parse(readFileSync(join(repo, PREREG_FILE), 'utf8')) as PreRegistration;
    expect(v2.version).toBe(2);
    expect(v2.reason).toBe('catalogue freeze (P-1)');
    expect(v2.registeredAt).toBe('2026-10-01T00:00:00Z');
    expect(v2.previous).toEqual([{ version: 1, commit: v1Commit }]);
    expect(v2.matchingRuleVersion).toBe('1.0.0');
    expect(v2.labellingBudgetCalls).toBe(4000);
    expect(v2.artefacts.map((a) => a.path)).toEqual(['Docs/matching-rule.md', PLAN, 'corpus/specs/realworld-test.yaml'].sort());
    // Uncommitted v2 is refused by the gate; committed, it passes.
    expect(checkPreRegistration({ repoRoot: repo, schemaRoot: ROOT, planPath: PLAN, specPaths: [], records: [], now: new Date(T0 + 60_000) })).toMatchObject({ ok: false, refusal: 'prereg-uncommitted' });
    git(['add', PREREG_FILE]);
    git(['commit', '-q', '-m', 'prereg v2'], T0);
    expect(checkPreRegistration({ repoRoot: repo, schemaRoot: ROOT, planPath: PLAN, specPaths: [], records: [], now: new Date(T0 + 60_000) })).toMatchObject({ ok: true });
    // A second bump refuses while v2 is uncommitted, and otherwise chains previous.
    const v3 = bumpPreRegistration(repo, { reason: 'P-2', now: new Date(T0 + 1000), schemaRoot: ROOT });
    expect(v3.ok ? v3.value.previous?.map((p) => p.version) : []).toEqual([1, 2]);
  });

  it('refuses when corpus/prereg.json differs from its committed blob', () => {
    put(PREREG_FILE, `${readFileSync(join(repo, PREREG_FILE), 'utf8')} `);
    expect(bumpPreRegistration(repo, { reason: 'x', now: new Date(T0), schemaRoot: ROOT })).toMatchObject({ ok: false, refusal: 'prereg-uncommitted' });
  });

  it('CLI: --self-test exits 1; missing --reason is a usage error; --dry-run writes nothing', async () => {
    const io = { out: (): void => undefined, err: (): void => undefined, now: () => new Date(T0), schemaRoot: ROOT };
    expect(await main(['--self-test'], repo, io)).toBe(1);
    expect(await main([], repo, io)).toBe(2);
    expect(await main(['--reason', ''], repo, io)).toBe(1);
    const before = readFileSync(join(repo, PREREG_FILE), 'utf8');
    let printed = '';
    expect(await main(['--reason', 'dry', '--dry-run'], repo, { ...io, out: (t) => { printed += t; } })).toBe(0);
    expect(readFileSync(join(repo, PREREG_FILE), 'utf8')).toBe(before);
    expect((JSON.parse(printed) as PreRegistration).version).toBe(2);
  });
});
