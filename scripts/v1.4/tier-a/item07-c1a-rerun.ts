/**
 * v1.4 tier A, item 07 (C1a): re-run the external evaluation of msc29-clean and felixle-node-core
 * with four tool versions, to measure the effect of the N33/N38 extractor fixes (PR #253).
 *
 * Zero model calls: `evaluate --symbolic-only --engine cypher-interp` (in-process Cypher interpreter, no Neo4j).
 *
 * Arms (each is a git tree with its own `bin/firewall.ts`):
 *   orig    - the tool commit of the committed external runs (run-provenance.json: 50a32841)
 *   prefix  - the first parent of the PR #253 merge (6abc8f0a), i.e. main just before the fix
 *   fix     - the PR #253 merge commit (6c623584): pre-fix tree plus the fix only
 *   current - the working tree (main after the fix, including later changes)
 *
 * Usage:
 *   npx tsx scripts/v1.4/tier-a/item07-c1a-rerun.ts --clones <dir> --tree orig=<dir> --tree prefix=<dir> --tree fix=<dir> \
 *     --tree current=. --out results/v1.4-tier-a/item07-c1a-rerun [--raw <dir for full reports>]
 *
 * Writes <out>/summary.json (per repo x arm: verdicts, graph stats, import resolution, blocking counts by rule,
 * violation counts by rule, and violation-id set differences against the committed report and between arms).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface Repo {
  id: string;
  selection: string;
  spec: string;
  committed: string;
}

const REPOS: Repo[] = [
  {
    id: 'msc29-clean',
    selection: 'results/v1.3-external-3/selection.json',
    spec: 'results/v1.3-external-3/specs/msc29-clean.yaml',
    committed: 'results/v1.3-external-3/findings/msc29-clean.json',
  },
  {
    id: 'felixle-node-core',
    selection: 'results/v1.3-external-2/selection.json',
    spec: 'results/v1.3-external-2/specs/felixle-node-core.yaml',
    committed: 'results/v1.3-external-2/findings/felixle-node-core.json',
  },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
}

const repoRoot = process.cwd();
const clones = resolve(arg('--clones') ?? '');
const out = arg('--out') ?? 'results/v1.4-tier-a/item07-c1a-rerun';
const raw = arg('--raw');
const trees = Object.fromEntries(
  args('--tree').map((t) => {
    const [k, v] = t.split('=');
    return [k, resolve(v)];
  }),
) as Record<string, string>;

type Report = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function git(dir: string, ...a: string[]): string {
  return spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim();
}

function countBy<T>(xs: T[], key: (x: T) => string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of xs) m[key(x)] = (m[key(x)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(m).sort());
}

function summarise(r: Report) {
  const blockingRules = r.tiers?.blocking?.rules ?? [];
  const blockingIds = new Set(blockingRules.map((x: Report) => x.functionId));
  const viol = r.violations ?? [];
  return {
    verdict: r.verdict,
    tierVerdict: r.tiers?.verdict,
    verdictRule: r.tiers?.verdictRule,
    v12eVerdict: r.tiers?.v12eVerdict,
    ahsDeterministic: r.ahsDeterministic,
    blockingAhs: r.tiers?.blockingAhs,
    graphStats: r.graphStats,
    importResolution: r.importResolution,
    universalMetrics: r.universalMetrics,
    blockingViolationCount: r.tiers?.blocking?.violationCount,
    blockingViolatedRules: r.tiers?.blocking?.violatedRules,
    blockingByRule: Object.fromEntries(blockingRules.map((x: Report) => [x.functionId, x.violationCount])),
    advisoryViolationCount: r.tiers?.advisory?.violationCount,
    violationsTotal: viol.length,
    violationsByRule: countBy(viol, (v: Report) => v.functionId),
    blockingViolationIds: viol
      .filter((v: Report) => blockingIds.has(v.functionId))
      .map((v: Report) => v.id)
      .sort(),
    violationIds: viol.map((v: Report) => v.id).sort(),
  };
}

function diffIds(a: string[], b: string[]) {
  const A = new Set(a);
  const B = new Set(b);
  return { onlyFirst: a.filter((x) => !B.has(x)).length, onlySecond: b.filter((x) => !A.has(x)).length, both: a.filter((x) => B.has(x)).length };
}

const result: Report = {
  item: '07 C1a: N33/N38 extractor fixes re-run on msc29-clean and felixle-node-core',
  command:
    'npx tsx bin/firewall.ts evaluate --project <clones>/<id>/<root> --spec <committed spec> --symbolic-only --engine cypher-interp --format json  (cwd = the arm tree; NEO4J_* unset)',
  trees: Object.fromEntries(Object.entries(trees).map(([k, d]) => [k, { commit: git(d, 'rev-parse', 'HEAD'), dirty: git(d, 'status', '--porcelain', '--', 'src', 'bin') !== '' }])),
  node: process.version,
  repos: {} as Report,
};

for (const repo of REPOS) {
  const sel = JSON.parse(readFileSync(join(repoRoot, repo.selection), 'utf8'));
  const entry = sel.entries.find((e: Report) => e.id === repo.id);
  const cloneDir = join(clones, repo.id);
  const head = git(cloneDir, 'rev-parse', 'HEAD');
  if (head !== entry.sha) throw new Error(`${repo.id}: clone at ${head}, selection pins ${entry.sha}`);
  const projectDir = join(cloneDir, entry.root);
  const committed = summarise(JSON.parse(readFileSync(join(repoRoot, repo.committed), 'utf8')));
  const runs: Report = {};
  for (const [arm, tree] of Object.entries(trees)) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (k.startsWith('NEO4J_')) delete env[k];
    const t0 = Date.now();
    const p = spawnSync(
      'npx',
      ['tsx', 'bin/firewall.ts', 'evaluate', '--project', projectDir, '--spec', join(repoRoot, repo.spec), '--symbolic-only', '--engine', 'cypher-interp', '--format', 'json'],
      { cwd: tree, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    );
    const wallMs = Date.now() - t0;
    if (!p.stdout) throw new Error(`${repo.id}/${arm}: no output, exit ${p.status}: ${p.stderr}`);
    const report = JSON.parse(p.stdout);
    if (raw) {
      mkdirSync(raw, { recursive: true });
      writeFileSync(join(raw, `${repo.id}.${arm}.json`), p.stdout);
    }
    const s = summarise(report);
    runs[arm] = {
      exit: p.status,
      wallMs,
      stderr: p.stderr.trim().split('\n').slice(0, 5),
      cloneDirtyAfter: git(cloneDir, 'status', '--porcelain') === '' ? 0 : 1,
      ...s,
      vsCommitted: { allViolations: diffIds(committed.violationIds, s.violationIds), blocking: diffIds(committed.blockingViolationIds, s.blockingViolationIds) },
    };
  }
  const armDiffs: Report = {};
  const arms = Object.keys(runs);
  for (let i = 0; i < arms.length; i++)
    for (let j = i + 1; j < arms.length; j++)
      armDiffs[`${arms[i]}->${arms[j]}`] = {
        allViolations: diffIds(runs[arms[i]].violationIds, runs[arms[j]].violationIds),
        blocking: diffIds(runs[arms[i]].blockingViolationIds, runs[arms[j]].blockingViolationIds),
      };
  result.repos[repo.id] = {
    url: entry.url,
    sha: entry.sha,
    root: entry.root,
    tsconfig: entry.tsconfig,
    spec: repo.spec,
    selection: repo.selection,
    committedReport: repo.committed,
    committed,
    runs,
    armDiffs,
  };
}

// Drop the id lists from the written summary (kept only as counts) to keep it short.
for (const r of Object.values(result.repos) as Report[]) {
  for (const s of [r.committed, ...Object.values(r.runs)] as Report[]) {
    s.blockingViolationIdCount = s.blockingViolationIds.length;
    delete s.violationIds;
  }
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'summary.json'), JSON.stringify(result, null, 1) + '\n');
for (const [id, r] of Object.entries(result.repos) as [string, Report][]) {
  console.log(id, 'committed', r.committed.tierVerdict, r.committed.blockingViolationCount);
  for (const [arm, s] of Object.entries(r.runs) as [string, Report][])
    console.log(' ', arm, s.tierVerdict, s.verdict, 'blocking', s.blockingViolationCount, 'IMPORTS', s.graphStats.edgeCountByType.IMPORTS, 'CI', s.graphStats.edgeCountByType.CONSTRUCTOR_INJECTS, JSON.stringify(s.vsCommitted));
}
