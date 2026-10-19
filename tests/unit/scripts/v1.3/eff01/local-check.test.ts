/**
 * The optional local check (design §6) wired end to end on the fixture tree: the stub stands in for git and tar, and
 * evaluate_project runs in process with the cypher-interp engine (no database, no call). The fixture is not one of
 * the EFF-01 repos, so its counts differ from 23 and 102 and the check must fail; the real run needs the clones.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EXPECTED_VIOLATIONS, localCheckProblem, runLocalCheck } from '../../../../../scripts/v1.3/lib/eff01/local-check.js';
import { StubEff01Runner } from '../../../../../scripts/v1.3/lib/eff01/stub-runner.js';
import { treeFingerprint } from '../../../../../scripts/v1.3/lib/eff01/trees.js';
import { FIXTURE_TREE, inputs, REPO, tmpDir } from './helpers.js';

describe('EFF-01 local check (design §6)', () => {
  it('evaluates each exported tree in process and fails on counts other than 23 and 102', async () => {
    const ins = inputs();
    const runner = new StubEff01Runner({ fixtureTree: FIXTURE_TREE, pins: Object.fromEntries(ins.repos.map((r) => [r.id, r.sha])), lookup: () => undefined, keyFor: () => undefined, model: 'm' });
    const out = tmpDir('lc-out');
    const r = await runLocalCheck({ repoRoot: REPO, harness: tmpDir('lc-h'), clones: tmpDir('lc-c'), out, runner, env: { PATH: '/usr/bin:/bin' } });
    if (!r.success) throw new Error(r.errors[0]?.message);
    expect(EXPECTED_VIOLATIONS).toEqual({ 'event-sourcing-ddd': 23, 'ddd-forum': 102 });
    expect(r.data.pass).toBe(false);
    for (const t of Object.values(r.data.trees)) {
      expect(t.fingerprint).toBe(treeFingerprint(FIXTURE_TREE));
      expect(typeof t.violationCount).toBe('number');
    }
    expect(runner.calls.filter((c) => path.basename(c.command) === 'git')).toHaveLength(4);
    expect(fs.existsSync(path.join(out, 'local-check.json'))).toBe(true);
    expect(localCheckProblem(out, { 'ddd-forum': treeFingerprint(FIXTURE_TREE) })).toContain('does not show a pass');
  }, 120_000);
});
