/**
 * Diff-aware gate end to end on real git commits, with the in-process lexical engine (no database): the CLI's code
 * path `runCheck`, and the synthetic-diff harness over the clean-architecture reference variants
 * (scripts/v1.3/lib/ci-gate-synthetic.ts). The Neo4j figures for all 71 variants are in results/v1.3-ci-gate/neo4j.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { lexicalEngine } from '../../../src/ci-gate/engines.js';
import { runCheck } from '../../../src/ci-gate/run-check.js';
import type { GateEngine } from '../../../src/ci-gate/engines.js';
import { loadReference } from '../../../scripts/v1.3/lib/reference-model.js';
import { runSynthetic } from '../../../scripts/v1.3/lib/ci-gate-synthetic.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIXTURE = path.join(REPO_ROOT, 'tests/fixtures/v1.3-reference/clean-architecture');
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' };

function git(repo: string, ...args: string[]): string {
  const r = spawnSync('git', ['-C', repo, '-c', 'commit.gpgsign=false', ...args], { env: GIT_ENV, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

describe('runCheck on git commits (lexical engine)', () => {
  let repo: string;
  let clean: string;
  let violating: string;
  let renamed: string;

  beforeAll(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gate-run-'));
    git(repo, 'init', '-q', '-b', 'main');
    fs.copyFileSync(path.join(FIXTURE, 'spec.yaml'), path.join(repo, 'spec.yaml'));
    fs.cpSync(path.join(FIXTURE, 'project'), path.join(repo, 'app'), { recursive: true });
    git(repo, 'add', '-A');
    git(repo, 'commit', '-qm', 'clean');
    clean = git(repo, 'rev-parse', 'HEAD');
    // v02: LoanPolicy (domain) imports SystemClock (infrastructure).
    const policy = path.join(repo, 'app/src/domain/services/LoanPolicy.ts');
    fs.writeFileSync(policy, `import { SystemClock } from '../../infrastructure/system/SystemClock.js';\n${fs.readFileSync(policy, 'utf8')}\nexport const clockForPolicy = (): SystemClock => new SystemClock();\n`);
    git(repo, 'commit', '-qam', 'violation');
    violating = git(repo, 'rev-parse', 'HEAD');
    // Rename the violating file inside the same layer: its finding is the same finding, not fixed + new.
    git(repo, 'mv', 'app/src/domain/services/LoanPolicy.ts', 'app/src/domain/services/LoanRules.ts');
    git(repo, 'commit', '-qm', 'rename');
    renamed = git(repo, 'rev-parse', 'HEAD');
  });
  afterAll(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  const check = (base: string, head: string, engine: GateEngine = lexicalEngine()) =>
    runCheck({ repo, base, head, spec: 'spec.yaml', project: 'app', engine });

  it('reports the introduced import as NEW blocking and fails', async () => {
    const r = await check(clean, violating);
    expect(r.verdict).toBe('fail');
    expect(r.newBlocking).toBe(2);
    expect(r.new.map((f) => [f.ruleId, f.file, f.target])).toEqual([
      ['FF-S01', 'src/domain/services/LoanPolicy.ts', 'src/infrastructure/system/SystemClock.ts'],
      ['FF-S04', 'src/domain/services/LoanPolicy.ts', 'src/infrastructure/system/SystemClock.ts'],
    ]);
    expect(r.new.every((f) => f.line === 1 && (f.fix ?? '').includes('interface'))).toBe(true);
    expect(r.fixed).toEqual([]);
  });

  it('reports the reverted import as FIXED and passes', async () => {
    const r = await check(violating, clean);
    expect(r.verdict).toBe('pass');
    expect(r.new).toEqual([]);
    expect(r.fixed).toHaveLength(2);
  });

  it('passes on a pull request that only renames a file with an existing finding', async () => {
    const r = await check(violating, renamed);
    expect(r.renames).toEqual({ 'src/domain/services/LoanPolicy.ts': 'src/domain/services/LoanRules.ts' });
    expect(r.verdict).toBe('pass');
    expect(r.new).toEqual([]);
    expect(r.fixed).toEqual([]);
    expect(r.unchanged).toHaveLength(2);
  });

  it('accepts branch names and reports the resolved SHAs', async () => {
    const r = await check('main~2', 'main');
    expect(r.base.sha).toBe(clean);
    expect(r.head.sha).toBe(renamed);
  });

  it('reads the spec from the base commit by default', async () => {
    const seen: string[] = [];
    const spy: GateEngine = { name: 'lexical', evaluate: (input) => { seen.push(input.specPath); return Promise.resolve([]); } };
    await check(clean, violating, spy);
    expect(seen).toHaveLength(2);
    expect(seen.every((p) => p.includes(clean))).toBe(true);
  });

  it('refuses a project or spec path outside the repository', async () => {
    await expect(runCheck({ repo, base: clean, head: violating, spec: '../x.yaml', engine: lexicalEngine() })).rejects.toThrow('inside the repository');
    await expect(runCheck({ repo, base: clean, head: violating, spec: 'spec.yaml', project: '/etc', engine: lexicalEngine() })).rejects.toThrow('inside the repository');
  });

  it('evaluates files an export-ignore attribute would drop from git archive', async () => {
    fs.writeFileSync(path.join(repo, '.gitattributes'), 'app/src/domain/** export-ignore\n');
    git(repo, 'add', '.gitattributes');
    git(repo, 'commit', '-qm', 'attributes');
    const attributed = git(repo, 'rev-parse', 'HEAD');
    try {
      const r = await check(clean, attributed);
      expect(r.head.findings).toBe(2);
      expect(r.new.map((f) => f.file)).toEqual(['src/domain/services/LoanRules.ts', 'src/domain/services/LoanRules.ts']);
    } finally {
      git(repo, 'reset', '-q', '--hard', renamed);
    }
  });

  it('fails clearly on an unknown ref', async () => {
    await expect(check(clean, 'no-such-branch')).rejects.toThrow('git rev-parse failed');
  });
});

describe('synthetic diffs from the clean-architecture reference variants (lexical engine)', () => {
  let work: string;
  beforeAll(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-gate-synth-'));
  });
  afterAll(() => {
    fs.rmSync(work, { recursive: true, force: true });
  });

  it('reports the manifest findings it can see as NEW and FIXED, near-misses and line drift as nothing', async () => {
    const ref = loadReference(REPO_ROOT, 'clean-architecture');
    const cases = await runSynthetic([ref], lexicalEngine(), work);
    const byKey = new Map(cases.map((c) => [`${c.variant} ${c.direction}`, c]));

    expect(cases).toHaveLength(1 + 3 * (ref.variants.length - 1));
    // Import rules: exactly the manifest's blocking findings, both directions.
    for (const v of ['v01-domain-imports-application-port', 'v02-domain-uses-infrastructure-clock', 'v04-domain-entity-typeorm-decorator', 'v09-dto-depends-on-http-adapter']) {
      expect(byKey.get(`${v} clean->variant`)).toMatchObject({ exact: true, verdict: 'fail' });
      expect(byKey.get(`${v} variant->clean`)).toMatchObject({ exact: true, verdict: 'pass' });
    }
    // No false alarm anywhere; graph-only rules (cycle, implements, held state) are the lexical engine's misses.
    expect(cases.every((c) => c.unexpected.length === 0 && c.wrongSide.length === 0)).toBe(true);
    expect(byKey.get('v03-domain-entity-cycle clean->variant')?.missed.map((m) => m.ruleId)).toEqual(['FF-S02']);
    // Every drift case: nothing new, nothing fixed, and the moved rows matched.
    const drift = cases.filter((c) => c.direction === 'clean->drift' || c.direction === 'variant->drift');
    expect(drift.every((c) => c.exact)).toBe(true);
    expect(drift.some((c) => c.counts.unchangedMoved > 0)).toBe(true);
  }, 120_000);
});
