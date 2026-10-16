/**
 * Repository-cluster bootstrap of the external-set blocking precision (PR #167: 283/283 correct), reported beside
 * the finding-level Wilson interval (Docs/DiagnosticRuns/v1.3-external-cluster-bootstrap-2026-10-16.md).
 * Seeded; no Neo4j, no LLM. Entry file: no exports.
 *
 * Usage (repository root):
 *   git show origin/v1.3-external-correctness:results/v1.3-external-correctness/blocking/correctness.csv > <scratch>/c.csv
 *   node --import tsx scripts/v1.3/external-cluster-bootstrap.ts --csv <scratch>/c.csv [--seed 20261016] [--resamples 10000]
 *     [--out Docs/DiagnosticRuns/v1.3-external-cluster-bootstrap-2026-10-16.json]
 *
 * The statistic is the ratio of sums (correct / checked) over a resample of whole repositories. Repositories with
 * no blocking finding are 0/0 clusters: they are kept in the "all repositories" run (they only change how often a
 * resample is small) and dropped in the "repositories with findings" run.
 *
 * With 0 incorrect findings every resample is 1, so the percentile interval is [1, 1]: the bootstrap cannot show
 * uncertainty that the sample does not contain. The script therefore also reports (a) a repository-level interval
 * (Wilson and Clopper-Pearson with n = number of repositories, the most conservative reading of the clustering) and
 * (b) a sensitivity run: the cluster bootstrap after flipping ONE finding to incorrect in each repository in turn.
 */
import * as fs from 'node:fs';
import { clopperPearson, clusterBootstrap, ratioOfSums, wilson } from '../lib/stats.js';

const argv = process.argv.slice(2);
const opt = (n: string): string | undefined => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const csvPath = opt('csv');
if (csvPath === undefined) throw new Error('--csv <correctness.csv> is required');
const seed = Number(opt('seed') ?? '20261016');
const resamples = Number(opt('resamples') ?? '10000');
const out = opt('out');

/** The 15 wave-1 repositories (results/v1.3-external/selection.json, PR #133); the four absent from the CSV had 0 rows. */
const ZERO_FINDING_REPOS = ['dannielhugo-clean', 'bulletproof-nodejs', 'zeldaplay-api', 'ddialar-hexagonal-boilerplate'];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? '';
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  if (head === undefined) return [];
  return body.map((r) => Object.fromEntries(head.map((h, j) => [h, r[j] ?? ''])));
}

interface Cluster { readonly id: string; readonly num: number; readonly den: number }

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8')).filter((r) => r.tier === 'blocking');
const byRepo = new Map<string, { num: number; den: number }>();
for (const r of rows) {
  const c = byRepo.get(r.projectId ?? '') ?? { num: 0, den: 0 };
  if (r.verdict !== 'not-checkable') { c.den++; if (r.verdict === 'correct') c.num++; }
  byRepo.set(r.projectId ?? '', c);
}
const withFindings: Cluster[] = [...byRepo].map(([id, c]) => ({ id, ...c })).sort((a, b) => b.den - a.den || (a.id < b.id ? -1 : 1));
const all: Cluster[] = [...withFindings, ...ZERO_FINDING_REPOS.filter((id) => !byRepo.has(id)).map((id) => ({ id, num: 0, den: 0 }))];
const k = withFindings.reduce((s, c) => s + c.num, 0);
const n = withFindings.reduce((s, c) => s + c.den, 0);
const top3 = withFindings.slice(0, 3).reduce((s, c) => s + c.den, 0);

const round = (x: number): number => Math.round(x * 10000) / 10000;
const iv = (i: { low: number; high: number }): [number, number] => [round(i.low), round(i.high)];
const boot = (clusters: readonly Cluster[]) => {
  const b = clusterBootstrap(clusters, ratioOfSums, { seed, resamples });
  return { estimate: round(b.estimate), ci95: iv(b), undefinedResamples: b.undefinedResamples };
};
const allCorrectRepos = withFindings.filter((c) => c.num === c.den).length;

const sensitivity = withFindings.map((c) => {
  const flipped = withFindings.map((x) => (x.id === c.id ? { ...x, num: x.num - 1 } : x));
  const b = boot(flipped);
  return { flippedIn: c.id, repoFindings: c.den, estimate: b.estimate, clusterBootstrap95: b.ci95, wilsonFindings95: iv(wilson(k - 1, n)) };
});

const result = {
  source: 'origin/v1.3-external-correctness (PR #167) results/v1.3-external-correctness/blocking/correctness.csv',
  seed,
  resamples,
  findings: { correct: k, checked: n, notCheckable: rows.length - n },
  repositories: { total: all.length, withFindings: withFindings.length, top3Findings: top3, perRepo: withFindings },
  wilsonFindingLevel95: iv(wilson(k, n)),
  clopperPearsonFindingLevel95: iv(clopperPearson(k, n)),
  clusterBootstrapWithFindings95: boot(withFindings),
  clusterBootstrapAllRepos95: boot(all),
  repositoryLevel: {
    note: 'unit = repository, success = every blocking finding of the repository correct',
    k: allCorrectRepos,
    n: withFindings.length,
    wilson95: iv(wilson(allCorrectRepos, withFindings.length)),
    clopperPearson95: iv(clopperPearson(allCorrectRepos, withFindings.length)),
  },
  withoutTop3: { k: k - top3, n: n - top3, wilson95: iv(wilson(k - top3, n - top3)) },
  sensitivityOneIncorrect: sensitivity,
};
const text = JSON.stringify(result, null, 1) + '\n';
if (out !== undefined) fs.writeFileSync(out, text);
process.stdout.write(text);
