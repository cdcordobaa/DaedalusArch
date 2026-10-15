/**
 * AP-DUP-RULE v2 (catalogue §8): sites and seeded copies for the judge and cheap-proxy re-run. DEVELOPMENT SET ONLY.
 *
 * Same bases and sampling as the DUP-RULE seeds of rounds 1 and 2:
 * - `fixture`: `fixtures/unit/antipattern-nest` (round 1). Every eligible AP-DUP-RULE2 site is seeded, and its
 *   same-site twin is applied (round 1 seeded every site).
 * - `e1`: the 65 accepted E1 cells, copied read-only from `../daedalus-e1-outcomes` into `<out>/e1-staging/` exactly as
 *   round 2 did (`stageCell`; src/, package.json, the node_modules symlink, the generator-protocol tsconfig). Spec
 *   `specs/clean-arch.yaml`. Site pass: `findSites` plus the precondition pass, no judge placement (`eligibleSites`).
 *   Sampling is round 2's: one cell order from mulberry32(`SAMPLE_SEED`) over the sorted cell ids, then passes of one
 *   site per cell until `PER_OPERATOR` seeds compile (a draw that fails the skeleton's pinned tsc is kept as
 *   `typecheck` and the next site of the same cell is drawn). In round 2 the operators before AP-DUP-RULE drew
 *   nothing, so the stream is the one AP-DUP-RULE used.
 * - Twins: each seed's AP-DUP-RULE2n on the same site (the same rule), else another rule of the same cell (same first
 *   file first). The twin does not touch the second service, so two twins on one rule would be one edit: a rule is used
 *   for at most one twin per cell.
 *
 * Usage (repository root): npx tsx scripts/v1.3/judge-catch-v2-seed.ts --out <dir> [--e1 <dir>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AP_DUP_RULE2, AP_DUP_RULE2N } from '../lib/mutation/antipatterns/ap-dup-rule-v2.js';
import { mulberry32 } from '../lib/mutation/rng.js';
import { detailJson } from '../lib/mutation/sites.js';
import type { MutationOperator, MutationSite } from '../lib/mutation/types.js';
import { applyOne, copyDir, eligibleSites, positiveOf } from './judge-catch-seed.js';
import type { SeedBase, SeedRow } from './judge-catch-seed.js';
import { PER_OPERATOR, SAMPLE_SEED, acceptedCells, stageCell } from './judge-catch2-seed.js';

const DEFAULT_E1 = '../daedalus-e1-outcomes';
const E1_SPEC = 'specs/clean-arch.yaml';
const FIXTURE_SPEC = 'fixtures/unit/antipattern-nest/firewall.spec.yaml';

export interface V2Row extends SeedRow {
  readonly stratum: 'fixture' | 'e1';
  readonly cell?: string;
  readonly twinOf?: string;
  readonly twinMatch?: 'same-site' | 'same-file' | 'same-cell';
  readonly hostKind?: string;
}

function argOf(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

const ruleKey = (s: MutationSite): string => `${s.detail.sourceFile ?? ''}|${s.detail.sourceClass ?? ''}|${s.detail.method ?? ''}|${s.detail.guard ?? ''}`;

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const outArg = argOf(argv, '--out');
  if (outArg === undefined) {
    process.stderr.write('usage: judge-catch-v2-seed.ts --out <dir> [--e1 <dir>]\n');
    return 2;
  }
  const out = path.resolve(outArg);
  const e1Root = path.resolve(repoRoot, argOf(argv, '--e1') ?? DEFAULT_E1);
  fs.mkdirSync(out, { recursive: true });
  const pos = AP_DUP_RULE2;
  const twin = AP_DUP_RULE2N;
  const rows: V2Row[] = [];
  const table: { baseId: string; operatorId: string; candidates: number; eligible: number; rejected: Record<string, number>; hostKinds: Record<string, number> }[] = [];
  const perKey = new Map<string, number>();
  const skeletonTsc = (dir: string): string => path.join(fs.realpathSync(path.join(dir, 'node_modules')), 'typescript/lib/tsc.js');
  const attempt = async (b: SeedBase, stratum: V2Row['stratum'], op: MutationOperator, site: MutationSite, tsc: string | undefined, extra: Partial<V2Row> = {}): Promise<V2Row> => {
    const stem = `${b.baseId.replace('/', '__')}__${op.id}`;
    const k = perKey.get(stem) ?? 0;
    perKey.set(stem, k + 1);
    const rowId = `${stem}__${String(k)}`;
    const dest = path.join(out, 'copies', rowId);
    const res = await applyOne(repoRoot, b, op, site, dest, tsc);
    const row: V2Row = {
      rowId, operatorId: op.id, positiveId: positiveOf(op), role: op.role === 'twin' ? 'twin' : 'seed', baseId: b.baseId, baseKind: b.kind,
      style: b.style, specPath: path.relative(repoRoot, b.specPath), site, duplicateOfClean: false, ...res, copyDir: path.relative(out, dest),
      stratum, hostKind: site.detail.twinHostKind ?? '', ...extra,
    };
    if (res.status !== 'ok') fs.rmSync(dest, { recursive: true, force: true });
    rows.push(row);
    process.stderr.write(`${rowId}: ${res.status}${res.typecheckErrors.length > 0 ? ` (${res.typecheckErrors[0] ?? ''})` : ''}\n`);
    return row;
  };
  const tallyHosts = (sites: readonly MutationSite[]): Record<string, number> =>
    sites.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.detail.twinHostKind ?? '?']: (acc[s.detail.twinHostKind ?? '?'] ?? 0) + 1 }), {});
  const pairTwin = async (b: SeedBase, stratum: V2Row['stratum'], seed: V2Row, twinSites: readonly MutationSite[], used: Set<string>, tsc: string | undefined, cell?: string): Promise<void> => {
    const rank = (x: MutationSite): number => (detailJson(x.detail) === detailJson(seed.site.detail) || ruleKey(x) === ruleKey(seed.site) ? 0 : x.detail.sourceFile === seed.site.detail.sourceFile ? 1 : 2);
    const byRule = new Map<string, MutationSite>();
    for (const s of [...twinSites].sort((a, c) => rank(a) - rank(c))) if (!byRule.has(ruleKey(s))) byRule.set(ruleKey(s), s);
    for (const site of byRule.values()) {
      if (used.has(ruleKey(site))) continue;
      used.add(ruleKey(site));
      const match = (['same-site', 'same-file', 'same-cell'] as const)[rank(site)] ?? 'same-cell';
      const r = await attempt(b, stratum, twin, site, tsc, { twinOf: seed.rowId, twinMatch: match, ...(cell !== undefined ? { cell } : {}) });
      if (r.status === 'ok') return;
    }
  };

  // ── Fixture (round 1 base) ──
  const fixture: SeedBase = { baseId: 'antipattern-nest', kind: 'fixture', style: 'nestjs-fixture', dir: path.resolve(repoRoot, 'fixtures/unit/antipattern-nest'), specPath: path.resolve(repoRoot, FIXTURE_SPEC) };
  const fxPos = await eligibleSites(repoRoot, fixture, pos);
  const fxTwin = await eligibleSites(repoRoot, fixture, twin);
  table.push({ baseId: fixture.baseId, operatorId: pos.id, candidates: fxPos.candidates, eligible: fxPos.eligible.length, rejected: fxPos.rejected, hostKinds: tallyHosts(fxPos.eligible) });
  table.push({ baseId: fixture.baseId, operatorId: twin.id, candidates: fxTwin.candidates, eligible: fxTwin.eligible.length, rejected: fxTwin.rejected, hostKinds: tallyHosts(fxTwin.eligible) });
  const fxUsed = new Set<string>();
  for (const s of fxPos.eligible) {
    const r = await attempt(fixture, 'fixture', pos, s, undefined);
    if (r.status === 'ok') await pairTwin(fixture, 'fixture', r, fxTwin.eligible, fxUsed, undefined);
  }

  // ── E1 cells (round 2 bases and sampling) ──
  const cells = acceptedCells(repoRoot);
  const bases = new Map<string, SeedBase>();
  const sitesOf = new Map<string, MutationSite[]>();
  for (const c of cells) {
    const dir = path.join(out, 'e1-staging', c.cellId);
    stageCell(e1Root, c, dir);
    const b: SeedBase = { baseId: `e1/${c.cellId}`, kind: 'e1-cell', style: 'e1-clean-arch', dir, specPath: path.resolve(repoRoot, E1_SPEC) };
    bases.set(c.cellId, b);
    for (const op of [pos, twin]) {
      const r = await eligibleSites(repoRoot, b, op);
      table.push({ baseId: b.baseId, operatorId: op.id, candidates: r.candidates, eligible: r.eligible.length, rejected: r.rejected, hostKinds: tallyHosts(r.eligible) });
      sitesOf.set(`${c.cellId}|${op.id}`, r.eligible);
    }
  }
  const rng = mulberry32(SAMPLE_SEED);
  const cellOrder = rng.pickDistinct(cells.map((c) => c.cellId).sort(), cells.length);
  const tried = new Map<string, MutationSite[]>();
  const seeds: V2Row[] = [];
  for (let pass = 0; pass < 8 && seeds.length < PER_OPERATOR; pass++) {
    let progressed = false;
    for (const cell of cellOrder) {
      if (seeds.length >= PER_OPERATOR) break;
      const b = bases.get(cell);
      if (b === undefined) continue;
      for (;;) {
        const used = tried.get(cell) ?? [];
        const left = (sitesOf.get(`${cell}|${pos.id}`) ?? []).filter((x) => !used.includes(x));
        if (left.length === 0) break;
        const site = rng.pick(left);
        tried.set(cell, [...used, site]);
        const r = await attempt(b, 'e1', pos, site, skeletonTsc(b.dir), { cell });
        if (r.status === 'ok') {
          seeds.push(r);
          progressed = true;
          break;
        }
      }
    }
    if (!progressed) break;
  }
  const usedRules = new Map<string, Set<string>>();
  for (const sd of seeds) {
    const cell = sd.cell ?? '';
    const b = bases.get(cell);
    if (b === undefined) continue;
    const used = usedRules.get(cell) ?? new Set<string>();
    usedRules.set(cell, used);
    await pairTwin(b, 'e1', sd, sitesOf.get(`${cell}|${twin.id}`) ?? [], used, skeletonTsc(b.dir), cell);
  }

  // ── Unmodified bases (clean controls) ──
  const basesOut = path.join(out, 'bases');
  for (const baseId of new Set(rows.filter((r) => r.status === 'ok').map((r) => r.baseId))) {
    const b = baseId === fixture.baseId ? fixture : bases.get(baseId.slice('e1/'.length));
    if (b !== undefined) copyDir(b.dir, path.join(basesOut, baseId.replace('/', '__')));
  }
  const ok = rows.filter((r) => r.status === 'ok');
  const summary = {
    seeds: ok.filter((r) => r.role === 'seed').length,
    twins: ok.filter((r) => r.role === 'twin').length,
    seedsByStratum: { fixture: ok.filter((r) => r.role === 'seed' && r.stratum === 'fixture').length, e1: ok.filter((r) => r.role === 'seed' && r.stratum === 'e1').length },
    twinHostKinds: ok.filter((r) => r.role === 'twin').reduce<Record<string, number>>((a, r) => ({ ...a, [r.hostKind ?? '?']: (a[r.hostKind ?? '?'] ?? 0) + 1 }), {}),
    rejectedDraws: rows.filter((r) => r.status !== 'ok').map((r) => ({ rowId: r.rowId, status: r.status, first: r.typecheckErrors[0] ?? '' })),
    e1CellsWithSites: table.filter((t) => t.baseId.startsWith('e1/') && t.operatorId === pos.id && t.eligible > 0).length,
  };
  fs.writeFileSync(path.join(out, 'seed-manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(), unit: 'AP-DUP-RULE v2', perOperator: PER_OPERATOR, sampleSeed: SAMPLE_SEED, e1Cells: cells.length, cellOrder, summary, table, rows,
  }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('judge-catch-v2-seed.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then((c) => {
    process.exitCode = c;
  });
}
