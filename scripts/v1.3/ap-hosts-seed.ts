/**
 * Anti-pattern host projects (`fixtures/unit/ap-hosts/`): site counts and seeded copies for a larger, more diverse judge
 * catch test. DEVELOPMENT SET ONLY. No operator, catalogue or frozen harness file is changed: the operators are the
 * frozen registry entries (`Docs/v1.3/judge-catch-frozen.md`) and copies are made by the frozen round-1 harness
 * (`judge-catch-seed.ts`: `eligibleSites`, the precondition pass without judge placement, and `applyOne`, which
 * copies the host, applies the edit with its fixed apply seed and type-checks the copy with the repository's tsc).
 *
 * Operators: the five frozen anti-patterns, AP-DUP-RULE in its v2 form (catalogue §8), each with its twin. The v1
 * AP-DUP-RULE pair is counted for reference and not seeded.
 *
 * Sampling, per host and positive operator: the eligible sites in a permutation drawn by
 * mulberry32(deriveSeed(`SAMPLE_SEED`, { projectId: host, operatorId, k: 'select' })); sites are tried in that order
 * until `--per-cell` seeds type-check (a draw that fails is kept as `typecheck` and the next is tried). AP-DUP-RULE2
 * seeds use distinct rules (its twin does not touch the second service, so two seeds of one rule would share a twin).
 * Each seed gets one twin: the same site when the twin shares the positive's site pass (all but AP-FAT-CONTROLLER),
 * else the twin site on the same handler call, then the same handler, then the same controller file, then the first
 * unused one in the twin's own permutation. A twin site is used at most once.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/ap-hosts-seed.ts --out <dir> [--per-cell <n>] [--only <host,...>] [--count-only] [--sweep]
 *     [--md <file>]
 * Writes `<out>/bases/<host>/` (unmodified copies, the clean controls), `<out>/copies/<rowId>/` and
 * `<out>/seed-manifest.json` in the row format `judge-catch-run.ts` reads. `--sweep` also applies every eligible site
 * of every operator in memory (`smokeBase`) and reports edits that add a diagnostic (nothing is written).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { smokeBase } from '../antipattern-sites.js';
import type { SmokeRow } from '../antipattern-sites.js';
import { ANTIPATTERN_OPERATORS } from '../lib/mutation/antipatterns/index.js';
import { deriveSeed, mulberry32 } from '../lib/mutation/rng.js';
import { detailJson } from '../lib/mutation/sites.js';
import type { MutationOperator, MutationSite } from '../lib/mutation/types.js';
import { applyOne, copyDir, eligibleSites, positiveOf } from './judge-catch-seed.js';
import type { SeedBase, SeedRow } from './judge-catch-seed.js';

export const SAMPLE_SEED = 20261016;
export const DEFAULT_PER_CELL = 6;
/** Target of the host design: eligible sites per operator (positive and twin) per host. */
export const MIN_SITES_PER_OPERATOR = 6;

export interface ApHost {
  readonly id: string;
  /** Framework and persistence, for the report. */
  readonly stack: string;
  readonly domain: string;
  readonly dir: string;
  readonly specPath: string;
}

export const AP_HOSTS: readonly ApHost[] = [
  { id: 'museum-loans', stack: 'NestJS + TypeORM', domain: 'museum exhibitions and loans', dir: 'fixtures/unit/ap-hosts/museum-loans', specPath: 'fixtures/unit/ap-hosts/museum-loans/firewall.spec.yaml' },
  { id: 'coworking-memberships', stack: 'Express + Prisma client', domain: 'coworking memberships', dir: 'fixtures/unit/ap-hosts/coworking-memberships', specPath: 'fixtures/unit/ap-hosts/coworking-memberships/firewall.spec.yaml' },
  { id: 'blood-drives', stack: 'NestJS + Mongoose', domain: 'blood donation drives', dir: 'fixtures/unit/ap-hosts/blood-drives', specPath: 'fixtures/unit/ap-hosts/blood-drives/firewall.spec.yaml' },
  { id: 'translation-jobs', stack: 'Express + TypeORM (hexagonal)', domain: 'translation agency jobs', dir: 'fixtures/unit/ap-hosts/translation-jobs', specPath: 'fixtures/unit/ap-hosts/translation-jobs/firewall.spec.yaml' },
];

const byId = (id: string): MutationOperator => {
  const op = ANTIPATTERN_OPERATORS.find((o) => o.id === id);
  if (op === undefined) throw new Error(`operator ${id} not registered`);
  return op;
};

/** The seeded pairs: the five frozen anti-patterns, AP-DUP-RULE as v2. */
export const SEEDED_PAIRS: readonly { readonly positive: MutationOperator; readonly twin: MutationOperator }[] = [
  'AP-REPO-BYPASS',
  'AP-FAT-CONTROLLER',
  'AP-PERSIST-IN-DOMAIN',
  'AP-DUP-RULE2',
  'AP-FRAMEWORK-LEAK',
].map((id) => ({ positive: byId(id), twin: byId(`${id}n`) }));

export function hostBase(repoRoot: string, h: ApHost): SeedBase {
  return { baseId: h.id, kind: 'fixture', style: `ap-host:${h.stack}`, dir: path.resolve(repoRoot, h.dir), specPath: path.resolve(repoRoot, h.specPath) };
}

export interface SiteTableRow {
  readonly baseId: string;
  readonly operatorId: string;
  readonly candidates: number;
  readonly eligible: number;
  readonly eligibleFiles: number;
  readonly rejected: Record<string, number>;
}

/** Candidates and eligible sites of every registered anti-pattern operator on one host (no judge placement). */
export async function hostSiteTable(repoRoot: string, h: ApHost): Promise<{ rows: SiteTableRow[]; eligible: Map<string, MutationSite[]> }> {
  const base = hostBase(repoRoot, h);
  const rows: SiteTableRow[] = [];
  const eligible = new Map<string, MutationSite[]>();
  for (const op of ANTIPATTERN_OPERATORS) {
    const r = await eligibleSites(repoRoot, base, op);
    rows.push({ baseId: h.id, operatorId: op.id, candidates: r.candidates, eligible: r.eligible.length, eligibleFiles: new Set(r.eligible.map((s) => s.filePath)).size, rejected: r.rejected });
    eligible.set(op.id, r.eligible);
  }
  return { rows, eligible };
}

const ruleKey = (s: MutationSite): string => `${s.detail.sourceFile ?? ''}|${s.detail.sourceClass ?? ''}|${s.detail.method ?? ''}|${s.detail.guard ?? ''}`;
const siteKey = (s: MutationSite): string => `${s.filePath}|${detailJson(s.detail)}`;

/** Twin candidates for a seed, best match first (see the module comment). */
export function twinOrder(positiveId: string, seed: MutationSite, twins: readonly MutationSite[]): { site: MutationSite; match: string }[] {
  if (positiveId !== 'AP-FAT-CONTROLLER') {
    return twins.filter((t) => siteKey(t) === siteKey(seed)).map((site) => ({ site, match: 'same-site' }));
  }
  const rank = (t: MutationSite): number => {
    const sameHandler = t.filePath === seed.filePath && t.detail.controller === seed.detail.controller && t.detail.handler === seed.detail.handler;
    if (sameHandler && t.detail.call === seed.detail.call) return 0;
    if (sameHandler) return 1;
    return t.filePath === seed.filePath ? 2 : 3;
  };
  const labels = ['same-call', 'same-handler', 'same-file', 'same-host'];
  return twins.map((site, i) => ({ site, i, r: rank(site) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => ({ site: x.site, match: labels[x.r] ?? 'same-host' }));
}

export interface ApHostRow extends SeedRow {
  readonly hostStack: string;
  readonly twinOf?: string;
  readonly twinMatch?: string;
}

function argOf(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const outArg = argOf(argv, '--out');
  if (outArg === undefined) {
    process.stderr.write('usage: ap-hosts-seed.ts --out <dir> [--per-cell <n>] [--only <host,...>] [--count-only] [--sweep] [--md <file>]\n');
    return 2;
  }
  const out = path.resolve(outArg);
  const perCell = Number(argOf(argv, '--per-cell') ?? String(DEFAULT_PER_CELL));
  const only = argOf(argv, '--only')?.split(',');
  const hosts = AP_HOSTS.filter((h) => only === undefined || only.includes(h.id));
  fs.mkdirSync(out, { recursive: true });
  const table: SiteTableRow[] = [];
  const rows: ApHostRow[] = [];
  const sweep: SmokeRow[] = [];
  for (const h of hosts) {
    const base = hostBase(repoRoot, h);
    const sites = await hostSiteTable(repoRoot, h);
    table.push(...sites.rows);
    if (argv.includes('--sweep')) {
      const r = await smokeBase(repoRoot, { projectId: h.id, kind: 'fixture', dir: base.dir, tsconfigPath: 'tsconfig.json', specPath: h.specPath, commit: '0'.repeat(40) }, ANTIPATTERN_OPERATORS, Number.MAX_SAFE_INTEGER);
      if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
      sweep.push(...r.data);
    }
    if (argv.includes('--count-only')) continue;
    for (const { positive, twin } of SEEDED_PAIRS) {
      const eligible = sites.eligible.get(positive.id) ?? [];
      const twins = sites.eligible.get(twin.id) ?? [];
      const order = mulberry32(deriveSeed(SAMPLE_SEED, { projectId: h.id, operatorId: positive.id, k: 'select' })).pickDistinct(eligible, eligible.length);
      const twinPerm = mulberry32(deriveSeed(SAMPLE_SEED, { projectId: h.id, operatorId: twin.id, k: 'select' })).pickDistinct(twins, twins.length);
      const usedTwins = new Set<string>();
      const usedRules = new Set<string>();
      let k = 0;
      let seeds = 0;
      const attempt = async (op: MutationOperator, site: MutationSite, extra: Partial<ApHostRow>): Promise<ApHostRow> => {
        const rowId = `${h.id}__${op.id}__${String(k++)}`;
        const dest = path.join(out, 'copies', rowId);
        const res = await applyOne(repoRoot, base, op, site, dest);
        if (res.status !== 'ok') fs.rmSync(dest, { recursive: true, force: true });
        const row: ApHostRow = {
          rowId, operatorId: op.id, positiveId: positiveOf(op), role: op.role === 'twin' ? 'twin' : 'seed', baseId: h.id, baseKind: base.kind, style: base.style,
          specPath: h.specPath, site, duplicateOfClean: false, ...res, copyDir: path.relative(out, dest), hostStack: h.stack, ...extra,
        };
        rows.push(row);
        process.stderr.write(`${rowId}: ${res.status}${res.typecheckErrors.length > 0 ? ` (${res.typecheckErrors[0] ?? ''})` : ''}\n`);
        return row;
      };
      for (const site of order) {
        if (seeds >= perCell) break;
        if (positive.id === 'AP-DUP-RULE2' && usedRules.has(ruleKey(site))) continue;
        const seed = await attempt(positive, site, {});
        if (seed.status !== 'ok') continue;
        seeds++;
        usedRules.add(ruleKey(site));
        const ranked = positive.id === 'AP-FAT-CONTROLLER' ? twinOrder(positive.id, site, twinPerm) : twinOrder(positive.id, site, twins);
        for (const t of ranked) {
          if (usedTwins.has(siteKey(t.site))) continue;
          usedTwins.add(siteKey(t.site));
          const r = await attempt(twin, t.site, { twinOf: seed.rowId, twinMatch: t.match });
          if (r.status === 'ok') break;
        }
      }
    }
  }
  const ok = rows.filter((r) => r.status === 'ok');
  if (!argv.includes('--count-only')) {
    for (const baseId of new Set(ok.map((r) => r.baseId))) {
      const h = hosts.find((x) => x.id === baseId);
      if (h !== undefined) copyDir(path.resolve(repoRoot, h.dir), path.join(out, 'bases', baseId));
    }
  }
  const cells = hosts.flatMap((h) =>
    SEEDED_PAIRS.map(({ positive, twin }) => {
      const mine = rows.filter((r) => r.baseId === h.id && r.positiveId === positive.id);
      return {
        host: h.id,
        operator: positive.id,
        eligible: table.find((t) => t.baseId === h.id && t.operatorId === positive.id)?.eligible ?? 0,
        twinEligible: table.find((t) => t.baseId === h.id && t.operatorId === twin.id)?.eligible ?? 0,
        seedsOk: mine.filter((r) => r.role === 'seed' && r.status === 'ok').length,
        twinsOk: mine.filter((r) => r.role === 'twin' && r.status === 'ok').length,
        rejected: mine.filter((r) => r.status !== 'ok').length,
      };
    }),
  );
  const summary = {
    hosts: hosts.length,
    seeds: ok.filter((r) => r.role === 'seed').length,
    twins: ok.filter((r) => r.role === 'twin').length,
    rejectedDraws: rows.filter((r) => r.status !== 'ok').map((r) => ({ rowId: r.rowId, status: r.status, first: r.typecheckErrors[0] ?? '' })),
    projectedJudgedProjects: ok.length + new Set(ok.map((r) => r.baseId)).size,
    ...(sweep.length > 0
      ? { sweep: { applied: sweep.reduce((n, s) => n + s.applied, 0), newDiagnostics: sweep.reduce((n, s) => n + s.newDiagnostics, 0), applyErrors: sweep.reduce((n, s) => n + s.applyErrors, 0) } }
      : {}),
  };
  fs.writeFileSync(path.join(out, 'seed-manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(), unit: 'ap-hosts', perCell, sampleSeed: SAMPLE_SEED, hosts, summary, cells, table, ...(sweep.length > 0 ? { sweep } : {}), rows,
  }, null, 2)}\n`);
  const md = siteMarkdown(hosts, table);
  const mdFile = argOf(argv, '--md');
  if (mdFile !== undefined) fs.writeFileSync(mdFile, md);
  process.stdout.write(md);
  process.stdout.write(`${JSON.stringify({ ...summary, rejectedDraws: summary.rejectedDraws.length }, null, 2)}\n`);
  return 0;
}

/** One row per registered operator, one column per host, cells `eligible / candidates`. */
export function siteMarkdown(hosts: readonly ApHost[], table: readonly SiteTableRow[]): string {
  const lines = [`| Operator | ${hosts.map((h) => h.id).join(' | ')} | total eligible |`, `|---|${hosts.map(() => '---:').join('|')}|---:|`];
  for (const op of ANTIPATTERN_OPERATORS) {
    const cell = (h: ApHost): string => {
      const t = table.find((x) => x.baseId === h.id && x.operatorId === op.id);
      return t === undefined ? '—' : `${String(t.eligible)} / ${String(t.candidates)}`;
    };
    const total = table.filter((t) => t.operatorId === op.id).reduce((n, t) => n + t.eligible, 0);
    lines.push(`| ${op.id} | ${hosts.map(cell).join(' | ')} | ${String(total)} |`);
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1]?.endsWith('ap-hosts-seed.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then((c) => {
    process.exitCode = c;
  });
}
