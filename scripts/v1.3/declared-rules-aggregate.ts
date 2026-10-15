/**
 * Aggregate of the team-declared-rules study (`Docs/DiagnosticRuns/v1.3-declared-rules-2026-10-16.md`).
 *
 * Usage (repository root): npx tsx scripts/v1.3/declared-rules-aggregate.ts [results/v1.3-declared-rules]
 *
 * Reads every `cases/<repo>/<case>/result.json` and `edges.csv`, the history candidate lists
 * (`history/<repo>.candidates.txt`) and the scans (`history/<repo>.scan.tsv`), and writes `summary.json` and
 * `distinct-disagreements.csv`. Two counting units:
 * - case-level: sums over cases (one repository at one commit), as the per-case results report them;
 * - distinct edges: one (repository, source, target, side, class) row however many history cases repeat it, so a
 *   long-lived violation is counted once.
 * Precision against the team's tool: both / (both + ours-only), on file-to-file edges among the files the team's tool
 * analysed; recall: both / (both + theirs-only), where theirs-only also counts package targets and test files.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cmp, toCsv } from './lib/graph-fidelity.js';
import type { CaseResult } from './declared-rules-run.js';
import { DISAGREEMENT_CLASSES } from './declared-rules-run.js';

interface Row { readonly [k: string]: string }

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { cur.push(cell); cell = ''; } else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; } else cell += ch;
  }
  if (cell !== '' || cur.length > 0) { cur.push(cell); rows.push(cur); }
  const [header, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries((header ?? []).map((h, i) => [h, r[i] ?? ''])));
}

const ratio = (a: number, b: number): number | null => (b === 0 ? null : Math.round((a / b) * 1000) / 1000);

function main(): void {
  const dir = process.argv[2] ?? 'results/v1.3-declared-rules';
  const casesDir = join(dir, 'cases');
  const cases: { r: CaseResult; edges: Row[]; repoKey: string }[] = [];
  for (const repoKey of readdirSync(casesDir).filter((d) => !d.includes('.')).sort(cmp)) {
    for (const c of readdirSync(join(casesDir, repoKey)).sort(cmp)) {
      const p = join(casesDir, repoKey, c, 'result.json');
      if (!existsSync(p)) continue;
      const edgesPath = join(casesDir, repoKey, c, 'edges.csv');
      cases.push({ r: JSON.parse(readFileSync(p, 'utf8')) as CaseResult, edges: existsSync(edgesPath) ? parseCsv(readFileSync(edgesPath, 'utf8')) : [], repoKey });
    }
  }
  const repos = [...new Set(cases.map((c) => c.repoKey))];
  const perRepo = repos.map((key) => {
    const cs = cases.filter((c) => c.repoKey === key);
    const head = cs.find((c) => c.r.id.endsWith('/head'));
    const hist = cs.filter((c) => !c.r.id.endsWith('/head'));
    const candFile = join(dir, 'history', `${key}.candidates.txt`);
    const candidates = existsSync(candFile) ? readFileSync(candFile, 'utf8').split('\n').filter(Boolean).length : null;
    const scanFile = join(dir, 'history', `${key}.scan.tsv`);
    const scan = existsSync(scanFile) ? readFileSync(scanFile, 'utf8').split('\n').filter(Boolean).map((l) => l.split(' ')) : [];
    const positive = (c: { r: CaseResult }): boolean => c.r.theirsComparable > 0 || c.r.ours > 0;
    const sum = (k: 'both' | 'oursOnly' | 'theirsOnly' | 'ours' | 'theirsComparable', list: typeof cs): number => list.reduce((a, c) => a + c.r[k], 0);
    const cov = head?.r.coverage ?? cs[0]?.r.coverage ?? [];
    const status = (s: string): number => cov.filter((x) => x.status === s).length;
    return {
      key, repo: cs[0]?.r.repo, family: cs[0]?.r.family, toolVersion: head?.r.toolVersion ?? cs[0]?.r.toolVersion,
      head: head === undefined ? null : {
        sha: head.r.sha, files: head.r.files, atoms: head.r.atoms, allowedEdges: head.r.allowedEdges, forbiddenPairs: head.r.forbiddenPairs,
        theirsAll: head.r.theirsAll, theirsComparable: head.r.theirsComparable, ours: head.r.ours, both: head.r.both,
        oursOnly: head.r.oursOnly, theirsOnly: head.r.theirsOnly, specLayerMismatches: head.r.specLayerMismatches,
      },
      coverage: { translated: status('translated'), partial: status('partial'), notExpressible: status('not-expressible'), inactive: status('inactive'), rules: cov },
      history: {
        candidates, ran: hist.length, failed: candidates === null ? null : candidates - hist.length,
        positiveCases: hist.filter(positive).length,
        both: sum('both', hist), oursOnly: sum('oursOnly', hist), theirsOnly: sum('theirsOnly', hist),
        scanCommits: scan.length, scanPositive: scan.filter((x) => x[1] !== '-' && Number(x[1]) > 0).length,
        scanFailed: scan.filter((x) => x[1] === '-').length,
      },
      specLayerMismatchesAll: cs.reduce((a, c) => a + c.r.specLayerMismatches, 0),
    };
  });

  // Distinct disagreements and agreements over all cases of a repository.
  const distinct = new Map<string, { repo: string; source: string; target: string; side: string; cls: string; reason: string; ourFunction: string; theirRules: string; declaredRules: string; cases: number }>();
  for (const c of cases) {
    for (const e of c.edges) {
      const k = [c.repoKey, e.source, e.target, e.side, e.cls].join('\t');
      const d = distinct.get(k);
      if (d === undefined) distinct.set(k, { repo: c.repoKey, source: e.source ?? '', target: e.target ?? '', side: e.side ?? '', cls: e.cls ?? '', reason: e.reason ?? '', ourFunction: e.ourFunction ?? '', theirRules: e.theirRules ?? '', declaredRules: e.declaredRules ?? '', cases: 1 });
      else d.cases++;
    }
  }
  const rows = [...distinct.values()].sort((a, b) => cmp(a.repo, b.repo) || cmp(a.side, b.side) || cmp(a.source, b.source) || cmp(a.target, b.target));
  const header = ['repo', 'side', 'cls', 'source', 'target', 'ourFunction', 'theirRules', 'declaredRules', 'reason', 'cases'] as const;
  writeFileSync(join(dir, 'distinct-edges.csv'), toCsv(header, rows.map((r) => header.map((h) => r[h]))));

  const isExt = (r: { target: string }): boolean => r.target.startsWith('ext:');
  // DaedalusArch's extractor excludes test files by default (DEFAULT_EXCLUDE_PATTERNS): split them out.
  const isTestSource = (r: { source: string }): boolean => /\.(spec|test)\.[cm]?[jt]sx?$/.test(r.source);
  const byClassDistinct: Record<string, { oursOnly: number; theirsOnly: number; theirsOnlyPackageTargets: number }> = Object.fromEntries(DISAGREEMENT_CLASSES.map((k) => [k, { oursOnly: 0, theirsOnly: 0, theirsOnlyPackageTargets: 0 }]));
  const reasonsDistinct: Record<string, number> = {};
  for (const r of rows) {
    if (r.side === 'both') continue;
    const b = byClassDistinct[r.cls] ?? { oursOnly: 0, theirsOnly: 0, theirsOnlyPackageTargets: 0 };
    if (r.side === 'ours-only') b.oursOnly++;
    else if (isExt(r)) b.theirsOnlyPackageTargets++;
    else b.theirsOnly++;
    byClassDistinct[r.cls] = b;
    const rk = `${r.side} | ${r.cls} | ${r.reason}`;
    reasonsDistinct[rk] = (reasonsDistinct[rk] ?? 0) + 1;
  }
  const distinctTotals = {
    both: rows.filter((r) => r.side === 'both').length,
    oursOnly: rows.filter((r) => r.side === 'ours-only').length,
    theirsOnlyFileTargets: rows.filter((r) => r.side === 'theirs-only' && !isExt(r)).length,
    theirsOnlyPackageTargets: rows.filter((r) => r.side === 'theirs-only' && isExt(r)).length,
    theirsOnlyTestSources: rows.filter((r) => r.side === 'theirs-only' && !isExt(r) && isTestSource(r)).length,
  };
  const perRepoDistinct = repos.map((key) => {
    const rr = rows.filter((r) => r.repo === key);
    const both = rr.filter((r) => r.side === 'both').length;
    const oo = rr.filter((r) => r.side === 'ours-only').length;
    const toFile = rr.filter((r) => r.side === 'theirs-only' && !isExt(r)).length;
    const toExt = rr.filter((r) => r.side === 'theirs-only' && isExt(r)).length;
    const toTest = rr.filter((r) => r.side === 'theirs-only' && !isExt(r) && isTestSource(r)).length;
    return {
      key, both, oursOnly: oo, theirsOnlyFile: toFile, theirsOnlyTestSources: toTest, theirsOnlyPackage: toExt,
      precision: ratio(both, both + oo), recallFileEdges: ratio(both, both + toFile), recallNonTestFileEdges: ratio(both, both + toFile - toTest),
    };
  });
  const totals = {
    cases: cases.length, headCases: cases.filter((c) => c.r.id.endsWith('/head')).length,
    historyCases: cases.filter((c) => !c.r.id.endsWith('/head')).length,
    positiveCases: cases.filter((c) => c.r.theirsComparable > 0 || c.r.ours > 0).length,
    specLayerMismatches: cases.reduce((a, c) => a + c.r.specLayerMismatches, 0),
    distinct: distinctTotals,
    precisionDistinct: ratio(distinctTotals.both, distinctTotals.both + distinctTotals.oursOnly),
    recallFileEdgesDistinct: ratio(distinctTotals.both, distinctTotals.both + distinctTotals.theirsOnlyFileTargets),
    recallNonTestFileEdgesDistinct: ratio(distinctTotals.both, distinctTotals.both + distinctTotals.theirsOnlyFileTargets - distinctTotals.theirsOnlyTestSources),
  };
  const summary = { totals, perRepo, perRepoDistinct, byClassDistinct, reasonsDistinct };
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  process.stdout.write(JSON.stringify({ totals, perRepoDistinct, byClassDistinct }, null, 1) + '\n');
}

main();
