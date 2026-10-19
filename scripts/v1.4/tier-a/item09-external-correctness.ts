/**
 * v1.4 tier A, item 09: C3 external correctness 283/283 (claims ledger K174; ops/01-instrument-map.md:177).
 *
 * Zero model calls, no Neo4j. Reads:
 * - results/v1.3-external-correctness/blocking/correctness.csv (one row per blocking finding, checker verdict)
 * - results/v1.3-external/selection.json                     (the 15 external repositories)
 * - Docs/DiagnosticRuns/v1.3-external-cluster-bootstrap-2026-10-16.json (the earlier figures, compared, not reused)
 *
 * Recomputes: per-repository counts; Wilson and Clopper-Pearson at the finding level (283) and at the repository
 * level (11 repositories with findings); a design-effect (Kish) effective-n Wilson for the finding-level proportion
 * from the per-repository cluster sizes, over a grid of intra-class correlations; "rule of three" and exact one-sided
 * bounds; and the (degenerate) repository-cluster percentile bootstrap, seed 20261016.
 *
 * Writes results/v1.4-tier-a/item09-external-correctness.json and item09-per-repo.csv. Deterministic.
 *
 * Run: npx tsx scripts/v1.4/tier-a/item09-external-correctness.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { wilson, wilsonProportion, clopperPearson, clusterBootstrap, ratioOfSums, Z_95 } from '../../lib/stats.js';

const CSV = 'results/v1.3-external-correctness/blocking/correctness.csv';
const SEL = 'results/v1.3-external/selection.json';
const PRIOR = 'Docs/DiagnosticRuns/v1.3-external-cluster-bootstrap-2026-10-16.json';
const OUT = 'results/v1.4-tier-a';
const SEED = 20261016;

const sha = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex');
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const iv = (i: { low: number; high: number }): [number, number] => [r4(i.low), r4(i.high)];

/** Minimal RFC-4180 CSV parser (quoted fields with commas and doubled quotes). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] as string;
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i += 1; } else if (c === '"') q = false; else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length > 0) { row.push(f); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries((head ?? []).map((k, i) => [k, r[i] ?? ''])));
}

const findings = parseCsv(readFileSync(CSV, 'utf8'));
const selection = JSON.parse(readFileSync(SEL, 'utf8')) as { entries: { id: string; style: string }[] };
const prior = JSON.parse(readFileSync(PRIOR, 'utf8')) as {
  repositories: { withFindings: number; total: number }; wilsonFindingLevel95: number[];
  repositoryLevel: { wilson95: number[]; clopperPearson95: number[] }; withoutTop3: { k: number; n: number; wilson95: number[] };
};

const verdicts: Record<string, number> = {};
for (const f of findings) verdicts[f.verdict ?? ''] = (verdicts[f.verdict ?? ''] ?? 0) + 1;
const tiers = [...new Set(findings.map((f) => f.tier))];

const perRepo = selection.entries.map((e) => {
  const fs = findings.filter((f) => f.projectId === e.id);
  const correct = fs.filter((f) => f.verdict === 'correct').length;
  const incorrect = fs.filter((f) => f.verdict === 'incorrect').length;
  const notCheckable = fs.filter((f) => f.verdict === 'not-checkable').length;
  return { id: e.id, style: e.style, findings: fs.length, correct, incorrect, notCheckable, allCorrect: fs.length > 0 && correct === fs.length };
}).sort((a, b) => b.findings - a.findings || a.id.localeCompare(b.id));
const unknownProjects = [...new Set(findings.map((f) => f.projectId))].filter((p) => !selection.entries.some((e) => e.id === p));

const withF = perRepo.filter((r) => r.findings > 0);
const N = withF.reduce((a, r) => a + r.findings, 0);
const K = withF.reduce((a, r) => a + r.correct, 0);
const checked = withF.reduce((a, r) => a + r.correct + r.incorrect, 0);
const reposAllCorrect = withF.filter((r) => r.allCorrect).length;
const m = withF.map((r) => r.findings);
const sumM2 = m.reduce((a, x) => a + x * x, 0);
const meanM = N / m.length;
/** Size-weighted mean cluster size, sum(m^2)/sum(m): the m that enters Deff = 1 + (m - 1) * icc for unequal clusters. */
const mWeighted = sumM2 / N;
const cvM = Math.sqrt(m.reduce((a, x) => a + (x - meanM) ** 2, 0) / m.length) / meanM;

const p = K / checked;
const ICCS = [0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 1];
const deffGrid = ICCS.map((icc) => {
  const deff = 1 + (mWeighted - 1) * icc;
  const nEff = checked / deff;
  const w = wilsonProportion(p, nEff);
  return { icc, deff: r4(deff), nEff: r4(nEff), wilson95: iv(w), ruleOfThreeLower: r4(Math.max(0, 1 - 3 / nEff)) };
});

/** One-sided exact (Clopper-Pearson) 95% lower bound for k = n: 0.05^(1/n). Two-sided 95% lower: 0.025^(1/n). */
const exactLower = (n: number, alpha: number): number => alpha ** (1 / n);

const top3 = withF.slice(0, 3);
const rest = withF.slice(3);
const restN = rest.reduce((a, r) => a + r.findings, 0);
const restK = rest.reduce((a, r) => a + r.correct, 0);

const clusters = withF.map((r) => ({ num: r.correct, den: r.correct + r.incorrect }));
const boot = clusterBootstrap(clusters, ratioOfSums, { seed: SEED, resamples: 10_000 });

const findingLevel = {
  k: K, n: checked, p: r4(p),
  wilson95: iv(wilson(K, checked)), clopperPearson95: iv(clopperPearson(K, checked)),
  ruleOfThreeLower: r4(1 - 3 / checked), exactOneSidedLower95: r4(exactLower(checked, 0.05)),
};
const repositoryLevel = {
  unit: 'repository; success = every blocking finding of the repository correct',
  k: reposAllCorrect, n: withF.length,
  wilson95: iv(wilson(reposAllCorrect, withF.length)), clopperPearson95: iv(clopperPearson(reposAllCorrect, withF.length)),
  ruleOfThreeLower: r4(1 - 3 / withF.length), exactOneSidedLower95: r4(exactLower(withF.length, 0.05)),
};
const icc1 = deffGrid.find((g) => g.icc === 1);

const ledger = {
  'K174 / map: 283/283': N === 283 && K === 283,
  'map: 11/11 repos': withF.length === 11 && reposAllCorrect === 11,
  'K174: repository-level Wilson [0.741, 1]': repositoryLevel.wilson95[0].toFixed(3) === '0.741',
  'K174: 69/69 outside the three largest, Wilson [0.947, 1]': restN === 69 && restK === 69 && wilson(restK, restN).low.toFixed(3) === '0.947',
  'v1.3 report: 15 repositories, 4 with no blocking finding': selection.entries.length === 15 && perRepo.filter((r) => r.findings === 0).length === 4,
  'prior JSON finding-level Wilson low equals recomputed': r4(prior.wilsonFindingLevel95[0] ?? NaN) === findingLevel.wilson95[0],
  'prior JSON repository-level Wilson low equals recomputed': r4(prior.repositoryLevel.wilson95[0] ?? NaN) === repositoryLevel.wilson95[0],
};

const out = {
  item: '09',
  question: 'C3 external correctness 283/283: verify counts and repositories; finding-level, repository-level and cluster-adjusted intervals',
  inputs: [CSV, SEL, PRIOR].map((x) => ({ path: x, sha256: sha(x) })),
  z: Z_95,
  rowsInCsv: findings.length, tiersInCsv: tiers, verdicts, unknownProjects,
  repositories: { selected: selection.entries.length, withBlockingFindings: withF.length, withoutBlockingFindings: perRepo.filter((r) => r.findings === 0).map((r) => r.id), allCorrect: reposAllCorrect },
  clusterSizes: { sizes: m, sum: N, sumSquares: sumM2, mean: r4(meanM), sizeWeightedMean: r4(mWeighted), coefficientOfVariation: r4(cvM), top3: top3.map((r) => r.id), top3Findings: top3.reduce((a, r) => a + r.findings, 0) },
  findingLevel,
  repositoryLevel,
  clusterAdjusted: {
    method: 'Kish design effect for unequal cluster sizes, Deff = 1 + (sum(m^2)/sum(m) - 1) * icc; n_eff = n / Deff; Wilson on (p, n_eff). The ICC cannot be estimated at zero errors, so a grid is reported. icc = 1 (every finding in a repository shares one outcome) is the worst case and gives n_eff = (sum m)^2 / sum(m^2).',
    grid: deffGrid,
    worstCase: icc1,
  },
  withoutTop3: { k: restK, n: restN, wilson95: iv(wilson(restK, restN)) },
  clusterBootstrap: { seed: SEED, resamples: boot.resamples, estimate: boot.estimate, ci95: iv(boot), undefinedResamples: boot.undefinedResamples, note: 'degenerate at zero errors: every resample has ratio 1' },
  ledgerChecks: ledger,
  discrepancies: Object.entries(ledger).filter(([, v]) => !v).map(([k]) => k),
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/item09-external-correctness.json`, JSON.stringify(out, null, 1) + '\n');
const head = 'id,style,findings,correct,incorrect,notCheckable,allCorrect,wilsonLow,wilsonHigh';
writeFileSync(`${OUT}/item09-per-repo.csv`, [head, ...perRepo.map((r) => {
  const w = r.findings > 0 ? iv(wilson(r.correct, r.correct + r.incorrect)) : ['', ''];
  return [r.id, r.style, r.findings, r.correct, r.incorrect, r.notCheckable, r.findings > 0 ? r.allCorrect : 'n/a', w[0], w[1]].join(',');
})].join('\n') + '\n');
console.log(JSON.stringify({ N, K, repos: withF.length, findingLevel, repositoryLevel, worst: icc1, discrepancies: out.discrepancies, boot: out.clusterBootstrap }, null, 1));
