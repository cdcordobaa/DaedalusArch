/**
 * v1.3 fidelity adjudication prep. Entry file: no exports. Pre-adjudicates every row of the graph-fidelity
 * adjudication sheets against the cited source line, computes the precision and recall the proposals WOULD give
 * (proposed, not adjudicated), and draws the seeded author review sample. Also merges the per-row proposals for the
 * U-E reference sheets (finding level), which were written by reading each row's files.
 *
 * Reads only; never writes into `results/v1.3-fidelity`, `results/v1.3-barrels` or `results/v1.3-reference`. The
 * sheets are copied to `<out>` with the new columns appended; `human_verdict` and `adjudication` stay empty.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/fidelity-adjudication-prep.ts --e1-src <dir> --so4-src <dir> --ref-verdicts <a.json,b.json> \
 *     --out results/v1.3-fidelity-adjudication-prep [--seed 20261016]
 *   --e1-src   one directory per E1 cell (`<model>/<task>/<spec>/run-<n>/src/...`)
 *   --so4-src  one directory per SO4 base, named as in corpus/corpus.json, checked out at its `commitSha`
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { parseCsv } from '../e1-size-analysis.js';
import { cmp, toCsv } from './lib/graph-fidelity.js';
import {
  addCounts, PROPOSED_COLUMNS, propose, rates, reviewSample, score,
} from './lib/fidelity-adjudication.js';
import type { Counts, EdgeStatus, Proposal, ProjectContext, ProjectEdge, SheetRow } from './lib/fidelity-adjudication.js';

const REPO = process.cwd();
const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const need = (name: string): string => { const v = opt(name); if (v === undefined) throw new Error(`${name} is required`); return v; };
const E1_SRC = resolve(need('--e1-src'));
const SO4_SRC = resolve(need('--so4-src'));
const REF_VERDICTS = need('--ref-verdicts').split(',').map((p) => resolve(p));
const OUT = resolve(need('--out'));
const SEED = Number(opt('--seed') ?? '20261016');

/** SO4 extraction roots inside the upstream checkouts (experiments/so4-heldout/plan.json). */
const SO4_ROOT: Readonly<Record<string, string>> = { 'ghostfolio-test': 'apps/api' };

const write = (rel: string, text: string): void => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
};
const readCsv = (p: string): Record<string, string>[] => parseCsv(readFileSync(p, 'utf8'));

// ── Project contexts ─────────────────────────────────────────────────────────

function projectEdges(csvPath: string): ProjectEdge[] {
  return readCsv(csvPath).map((r) => ({
    source: r.source ?? '', target: r.target ?? '', scope: r.scope ?? '',
    tscKinds: (r.tsc_kinds ?? '').split(';').filter(Boolean),
    specifiers: (r.specifiers ?? '').split(';').filter(Boolean),
    present: Object.fromEntries(Object.keys(r).filter((k) => k.startsWith('in_')).map((k) => [k.slice(3), r[k] === '1'])),
  }));
}

function context(corpus: 'e1' | 'so4', projectId: string, csvPath: string, metaPath: string): ProjectContext {
  const edges = projectEdges(csvPath);
  const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { meta: { specExcludes?: string[] } };
  const root = corpus === 'e1' ? join(E1_SRC, projectId) : join(SO4_SRC, projectId, SO4_ROOT[projectId] ?? '');
  const apgVariant = Object.keys(edges[0]?.present ?? {}).find((k) => k.startsWith('apg-')) ?? 'apg-v12e-default';
  const apgFiles = new Set(edges.filter((e) => e.scope === 'in-scope').flatMap((e) => [e.source, e.target]));
  for (const e of edges) if (e.present[apgVariant] === true) { apgFiles.add(e.source); apgFiles.add(e.target); }
  return {
    read: (p) => { const abs = normalize(join(root, p)); return existsSync(abs) ? readFileSync(abs, 'utf8') : undefined; },
    sourceLabel: corpus === 'e1' ? 'E1 cassette capture' : `upstream ${projectId}`,
    edges, specExcludes: meta.meta.specExcludes ?? [], apgFiles,
  };
}

const fileId = (projectId: string): string => projectId.replace(/\//g, '__');

// ── Edge sheets ──────────────────────────────────────────────────────────────

interface EdgeSheet { readonly name: string; readonly corpus: 'e1' | 'so4'; readonly sheet: string; readonly projectsDir: string }

const SHEETS: EdgeSheet[] = [
  { name: 'e1', corpus: 'e1', sheet: 'results/v1.3-fidelity/e1/adjudication.csv', projectsDir: 'results/v1.3-fidelity/e1/projects' },
  { name: 'so4', corpus: 'so4', sheet: 'results/v1.3-fidelity/so4/adjudication.csv', projectsDir: 'results/v1.3-fidelity/so4/projects' },
  ...readdirSync(join(REPO, 'results/v1.3-barrels/fidelity')).sort(cmp).map((cell) => ({
    name: `barrels/${cell}`, corpus: 'e1' as const, sheet: `results/v1.3-barrels/fidelity/${cell}/adjudication.csv`, projectsDir: `results/v1.3-barrels/fidelity/${cell}/projects`,
  })),
];

interface ReviewRow { stratum: string; id: string; set: string; row: Record<string, string>; p: Proposal }
const reviewPool: ReviewRow[] = [];
/** One review item per distinct edge or finding row: the sheets overlap (the barrel cells repeat E1 edges, the reference sheets share rows). */
const reviewByContent = new Map<string, ReviewRow>();
const addReview = (content: string, r: ReviewRow): void => {
  reviewPool.push(r);
  const seen = reviewByContent.get(content);
  if (seen === undefined) reviewByContent.set(content, { ...r });
  else seen.set = `${seen.set}; ${r.set}`;
};
const metrics: Record<string, unknown>[] = [];
const ruleCounts = new Map<string, number>();

for (const s of SHEETS) {
  const rows = readCsv(join(REPO, s.sheet));
  const header = Object.keys(rows[0] ?? {});
  const contexts = new Map<string, ProjectContext>();
  const ctxOf = (projectId: string): ProjectContext => {
    let c = contexts.get(projectId);
    if (c === undefined) {
      c = context(s.corpus, projectId, join(REPO, s.projectsDir, `${fileId(projectId)}.csv`), join(REPO, s.projectsDir, `${fileId(projectId)}.json`));
      contexts.set(projectId, c);
    }
    return c;
  };
  const statusByEdge = new Map<string, EdgeStatus>();
  const out: unknown[][] = [];
  rows.forEach((r, i) => {
    if ((r.human_verdict ?? '') !== '') throw new Error(`${s.sheet} row ${String(i + 2)} already has a human_verdict`);
    const p = propose(r as SheetRow, ctxOf(r.project ?? ''));
    ruleCounts.set(`${s.name}\t${p.rule}`, (ruleCounts.get(`${s.name}\t${p.rule}`) ?? 0) + 1);
    if (r.row_type === 'disagreement') statusByEdge.set(`${r.project ?? ''}\t${r.source ?? ''}\t${r.target ?? ''}`, p.status);
    out.push([...header.map((h) => r[h]), p.verdict, p.cls, p.evidence, p.status, p.rule]);
    addReview(`edge|${r.row_type ?? ''}|${r.project ?? ''}|${r.source ?? ''}|${r.target ?? ''}`,
      { stratum: p.cls, id: `${s.name}#${String(i + 2).padStart(5, '0')}`, set: s.name, row: r, p });
  });
  write(`${s.name}/adjudication.proposed.csv`, toCsv([...header, ...PROPOSED_COLUMNS], out));

  // Proposed precision and recall, every project of the corpus (perfect-agreement projects included).
  const variants = header.filter((h) => h.startsWith('verdict_apg-')).map((h) => h.slice('verdict_'.length));
  const projectIds = readdirSync(join(REPO, s.projectsDir)).filter((f) => f.endsWith('.csv')).map((f) => f.slice(0, -4)).sort(cmp);
  for (const variant of variants) {
    for (const [mode, strict] of [['proposed', false], ['proposed-strict-literal', true]] as const) {
      for (const scoped of [false, true]) {
        let total: Counts = { apgEdges: 0, correct: 0, required: 0, found: 0, unadjudicated: 0 };
        for (const pid of projectIds) {
          const projectId = rows.find((r) => fileId(r.project ?? '') === pid)?.project
            ?? (JSON.parse(readFileSync(join(REPO, s.projectsDir, `${pid}.json`), 'utf8')) as { id: string }).id;
          const edges = projectEdges(join(REPO, s.projectsDir, `${pid}.csv`));
          total = addCounts(total, score(edges, variant, (e) => statusByEdge.get(`${projectId}\t${e.source}\t${e.target}`), strict, scoped));
        }
        metrics.push({ set: s.name, projects: projectIds.length, variant, mode, scope: scoped ? 'scoped' : 'raw', ...rates(total) });
      }
    }
  }
}

// ── Reference sheets (finding level) ─────────────────────────────────────────

const REF_SHEETS = ['baseline-pre-barrel', 'after-fixes/barrels-only', 'after-fixes', 'after-member-facts'];
const REF_KEY = ['style', 'case', 'variant', 'kind', 'rule', 'scope', 'file', 'target', 'tool', 'author', 'blind'];
const refVerdicts = new Map<string, { proposed_verdict: string; proposed_class: string; evidence: string }>();
for (const f of REF_VERDICTS) {
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(f, 'utf8')) as Record<string, { proposed_verdict: string; proposed_class: string; evidence: string }>)) refVerdicts.set(k, v);
}

interface FindingCounts { tp: number; fp: number; fn: number }
const refMetrics: Record<string, unknown>[] = [];
for (const name of REF_SHEETS) {
  const base = join(REPO, 'results/v1.3-reference', name);
  const rows = readCsv(join(base, 'adjudication.csv'));
  const header = Object.keys(rows[0] ?? {});
  const out: unknown[][] = [];
  const adjust = new Map<string, FindingCounts>(); // per style: change to the author-literal `all` counts
  rows.forEach((r, i) => {
    if ((r.adjudication ?? '') !== '') throw new Error(`${name} row ${String(i + 2)} already has an adjudication`);
    const v = refVerdicts.get(REF_KEY.map((k) => r[k] ?? '').join('|'));
    if (v === undefined) throw new Error(`${name} row ${String(i + 2)}: no proposal`);
    out.push([...header.map((h) => r[h]), v.proposed_verdict, v.proposed_class, v.evidence, '', 'R-ref-read']);
    addReview(`ref|${REF_KEY.map((k) => r[k] ?? '').join('|')}`, { stratum: v.proposed_class, id: `ref/${name}#${String(i + 2).padStart(4, '0')}`, set: `ref/${name}`, row: r,
      p: { verdict: v.proposed_verdict as Proposal['verdict'], cls: v.proposed_class as Proposal['cls'], evidence: v.evidence, status: 'required', rule: 'R-ref-read' } });
    // Apply the proposal to the author-literal counts (scored rows only; that view counts scored rules).
    if (r.scope !== 'scored') return;
    const tool = (r.tool ?? '').startsWith('finding');
    const author = (r.author ?? '').startsWith('finding');
    const a = adjust.get(r.style ?? '') ?? { tp: 0, fp: 0, fn: 0 };
    const toolRight = v.proposed_verdict !== 'reference-correct'; // both-acceptable: neither side is counted wrong
    if (tool && author && !toolRight) { a.tp--; a.fp++; } // author-literal TP that the proposal rejects
    if (tool && !author && toolRight) { a.fp--; a.tp++; } // author-literal FP the proposal accepts
    if (!tool && author && toolRight) a.fn--; // author-literal FN the proposal clears
    if (!tool && !author && !toolRight) a.fn++; // blind-only finding the proposal accepts
    adjust.set(r.style ?? '', a);
  });
  write(`reference/${name}/adjudication.proposed.csv`, toCsv([...header, ...PROPOSED_COLUMNS], out));
  const scores = JSON.parse(readFileSync(join(base, 'scores.json'), 'utf8')) as { views: { style: string; view: string; all: { tp: number; fp: number; fn: number } }[] };
  let pooled = { tp: 0, fp: 0, fn: 0 };
  let pooledLit = { tp: 0, fp: 0, fn: 0 };
  for (const v of scores.views.filter((x) => x.view === 'author-literal')) {
    const a = adjust.get(v.style) ?? { tp: 0, fp: 0, fn: 0 };
    const c = { tp: v.all.tp + a.tp, fp: v.all.fp + a.fp, fn: v.all.fn + a.fn };
    pooled = { tp: pooled.tp + c.tp, fp: pooled.fp + c.fp, fn: pooled.fn + c.fn };
    pooledLit = { tp: pooledLit.tp + v.all.tp, fp: pooledLit.fp + v.all.fp, fn: pooledLit.fn + v.all.fn };
    refMetrics.push({ set: `ref/${name}`, style: v.style, authorLiteral: v.all, proposed: { ...c, precision: c.tp / (c.tp + c.fp), recall: c.tp / (c.tp + c.fn) } });
  }
  refMetrics.push({ set: `ref/${name}`, style: 'pooled', authorLiteral: pooledLit, proposed: { ...pooled, precision: pooled.tp / (pooled.tp + pooled.fp), recall: pooled.tp / (pooled.tp + pooled.fn) } });
}

// ── Review sheet ─────────────────────────────────────────────────────────────

const sample = reviewSample([...reviewByContent.values()], SEED);
const reviewHeader = ['review_id', 'sample_reason', 'sets', 'proposed_class', 'proposed_verdict', 'proposed_edge_status', 'proposed_rule',
  'project_or_case', 'source_or_file', 'target', 'specifier_or_rule', 'line', 'evidence', 'author_confirms', 'author_note'];
write('review-sheet.csv', toCsv(reviewHeader, sample.map(({ item, reason }) => [
  item.id, reason, item.set, item.p.cls, item.p.verdict, item.set.startsWith('ref/') ? '' : item.p.status, item.p.rule,
  item.row.project ?? `${item.row.style ?? ''}/${item.row.variant ?? ''}`, item.row.source ?? item.row.file ?? '', item.row.target ?? '',
  item.row.specifier ?? item.row.rule ?? '', item.row.line ?? '', item.p.evidence, '', '',
])));

// ── Summary ──────────────────────────────────────────────────────────────────

const tally = (pick: (r: ReviewRow) => string): Record<string, Record<string, number>> => {
  const t: Record<string, Record<string, number>> = {};
  for (const r of reviewPool) { const k = pick(r); (t[r.set] ??= {})[k] = ((t[r.set] ?? {})[k] ?? 0) + 1; }
  return t;
};
write('proposed-metrics.json', JSON.stringify({
  label: 'PROPOSED, NOT ADJUDICATED: what precision and recall would be if every proposed verdict were accepted. No human has checked these.',
  seed: SEED,
  definitions: {
    edge: 'precision = APG edges with status required (or acceptable, except in strict-literal mode) / APG edges; recall = required edges in the APG / required edges. Edges in the APG and both references count as required.',
    reference: 'author-literal `all` counts (scored rules) with each scored sheet row moved by its proposal; both-acceptable counts as the tool not being wrong.',
  },
  edge: metrics, reference: refMetrics,
  rows: { byVerdict: tally((r) => r.p.verdict), byClass: tally((r) => r.p.cls), byRule: Object.fromEntries([...ruleCounts].sort((a, b) => cmp(a[0], b[0]))) },
  review: { rows: sample.length, pool: reviewByContent.size, sheetRows: reviewPool.length, byReason: sample.reduce<Record<string, number>>((a, s) => { a[s.reason.replace(/ \(.*\)$/, '')] = (a[s.reason.replace(/ \(.*\)$/, '')] ?? 0) + 1; return a; }, {}) },
  inputs: {
    e1Src: 'E1 cells rebuilt from the judge cassettes by scripts/v1.3/e1-sources-from-cassettes.ts',
    so4Src: 'upstream checkouts at the corpus/corpus.json commitSha (ghostfolio-test rooted at apps/api), no overlays',
    refVerdicts: REF_VERDICTS.map((f) => relative(REPO, f)),
  },
}, null, 1) + '\n');
console.log(`rows ${String(reviewPool.length)}, review sample ${String(sample.length)}, out ${relative(REPO, OUT)}`);
