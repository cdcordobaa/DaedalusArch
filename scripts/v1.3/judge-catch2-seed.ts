/**
 * v1.3 judge catch test, round 2: sites and seeded copies. DEVELOPMENT SET ONLY (E1 is development data for v1.3).
 *
 * Two strata, reported apart:
 * - `operator` (E1 cells): every accepted E1 cell (`results/e1-grid/runs/*.run.json`, status `accepted`) is copied
 *   read-only from `../daedalus-e1-outcomes/<projectId>` into `<out>/e1-staging/` (src/, package.json, the
 *   node_modules symlink to the pinned skeleton install; generation transcripts not copied) with the generator
 *   protocol §3 tsconfig in relative form (as `daedalus-judgeprobe` prepared it). Spec: `specs/clean-arch.yaml` (the
 *   E1 evaluator spec). For each frozen AP operator the round-1 site pass runs (`eligibleSites`: `findSites` plus the
 *   precondition pass, no judge placement). Up to `PER_OPERATOR` seeds per positive are drawn, spread across cells:
 *   the cells are put in one seeded order (mulberry32(`SAMPLE_SEED`), shared by all operators so the clean controls
 *   are shared), and a pass over that order takes one site per cell (picked with the same stream) until the quota is
 *   met; a further pass takes a second site per cell only when one site per cell does not reach the quota. Each seed
 *   gets its twin: the twin operator's eligible site in the same cell with the same file and detail, else the same
 *   file, else the first twin site of the cell (recorded in `twinMatch`). Copies are type-checked with the skeleton's
 *   pinned tsc (5.9.3, the E1 type-check of record).
 * - `hand-planted` (v1.3 reference violation variants): the variants in `HAND_PLANTED` plant a semantic defect of an
 *   AP construct (mapping from each manifest). The variant is materialised by the reference loader; its touched
 *   `src/` files are the row's edited files; the base is the style's clean variant (the clean control). Where the
 *   mapped operator's twin has an eligible site on a touched file of the clean variant, that twin is applied too.
 *   DDD variants are not judged: `presets/ddd.yaml` declares neither FF-N01 nor FF-N02, and the hexagonal spec's
 *   layer globs (`src/domain/**`, ...) do not cover the DDD layout (`src/<context>/domain/**`), so judging DDD needs a
 *   spec change.
 *
 * The frozen operators (`Docs/v1.3/judge-catch-frozen.md`) are used unchanged.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/judge-catch2-seed.ts --out <dir> [--count-only] [--e1 <dir>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ANTIPATTERN_OPERATORS } from '../lib/mutation/antipatterns/index.js';
import { mulberry32 } from '../lib/mutation/rng.js';
import { detailJson } from '../lib/mutation/sites.js';
import type { MutationOperator, MutationSite } from '../lib/mutation/types.js';
import { applyOne, copyDir, eligibleSites, positiveOf, typecheck } from './judge-catch-seed.js';
import type { SeedBase, SeedRow } from './judge-catch-seed.js';
import { loadAllReferences } from './lib/reference-model.js';
import { materialiseVariant } from './lib/materialise.js';

export const PER_OPERATOR = 8;
export const SAMPLE_SEED = 20261016;
const DEFAULT_E1 = '../daedalus-e1-outcomes';
const E1_SPEC = 'specs/clean-arch.yaml';

/** Reference violation variants that plant an AP construct, with the closest construct (from each manifest). */
export const HAND_PLANTED: readonly { style: string; variant: string; mapsTo: string; why: string }[] = [
  { style: 'clean-architecture', variant: 'v04-domain-entity-typeorm-decorator', mapsTo: 'AP-PERSIST-IN-DOMAIN', why: 'Book (domain entity) decorated with @Entity from typeorm' },
  { style: 'layered', variant: 'v07-business-model-typeorm-decorator', mapsTo: 'AP-PERSIST-IN-DOMAIN', why: 'Order (business model) decorated with @Entity from typeorm' },
  { style: 'nestjs', variant: 'v05-domain-entity-typeorm-decorator', mapsTo: 'AP-PERSIST-IN-DOMAIN', why: 'Workshop (domain) decorated with @Entity from typeorm' },
  { style: 'layered', variant: 'v08-business-service-takes-express-request', mapsTo: 'AP-FRAMEWORK-LEAK', why: 'OrderService (business service) gets placeOrderFromRequest(request: express.Request)' },
  { style: 'clean-architecture', variant: 'v10-domain-entity-type-imports-express', mapsTo: 'AP-FRAMEWORK-LEAK', why: 'Member (domain entity) gets fromRequest(request: express.Request)' },
  { style: 'nestjs', variant: 'v06-domain-entity-type-imports-express', mapsTo: 'AP-FRAMEWORK-LEAK', why: 'Attendee (domain) gets fromRequest(id, request: express.Request)' },
  { style: 'hexagonal', variant: 'v04-use-case-throws-http-error', mapsTo: 'AP-FRAMEWORK-LEAK', why: 'CancelBookingService (use case) throws the inbound adapter HttpError(404): transport in the application layer' },
  { style: 'hexagonal', variant: 'v07-domain-service-nestjs-decorator', mapsTo: 'AP-FRAMEWORK-LEAK', why: 'AvailabilityChecker (domain service) decorated with @Injectable from @nestjs/common: framework in the domain' },
];

/** Reference variants read and not judged, with the reason (reported). */
export const HAND_PLANTED_EXCLUDED: readonly { id: string; reason: string }[] = [
  { id: 'ddd/v04-framework-in-domain', reason: 'DDD: would map to AP-FRAMEWORK-LEAK, but the judge needs a spec change for DDD (no FF-N01/N02 in presets/ddd.yaml; hexagonal layer globs do not cover src/<context>/<layer>)' },
  { id: 'ddd/v06-fat-application-service', reason: 'DDD: would map to AP-FAT-CONTROLLER (business rule in the wrong layer), same spec-change reason' },
  { id: 'clean-architecture/v07-controller-reads-entity', reason: 'controller bypasses the use cases through the repository: a layer bypass (FF-P05), not the AP-REPO-BYPASS construct (global ORM handle instead of the injected repository)' },
  { id: 'layered/v03-controller-reads-gateway', reason: 'layer bypass (FF-S03), no AP construct' },
  { id: 'hexagonal/v05-inbound-adapter-reads-outbound-adapter', reason: 'layer bypass (FF-S03), no AP construct' },
];

export interface Round2Row extends SeedRow {
  readonly stratum: 'operator' | 'hand-planted';
  readonly cell?: string;
  readonly twinOf?: string;
  readonly twinMatch?: 'same-site' | 'same-file' | 'same-cell';
  readonly handPlanted?: { style: string; variant: string; mapsTo: string; why: string };
}

interface E1Cell {
  readonly cellId: string;
  readonly projectId: string;
  readonly vendor: string;
}

function argOf(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function acceptedCells(repoRoot: string): E1Cell[] {
  const dir = path.join(repoRoot, 'results/e1-grid/runs');
  const out: E1Cell[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.run.json')).sort()) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { status: string; projectId: string };
    if (r.status !== 'accepted') continue;
    out.push({ cellId: r.projectId.replace(/\//g, '.'), projectId: r.projectId, vendor: r.projectId.startsWith('gpt-') ? 'openai' : 'anthropic' });
  }
  return out;
}

/** The generator protocol §3 tsconfig, relative form (same options and file set as the E1 evaluation's). */
const E1_TSCONFIG = {
  compilerOptions: {
    strict: true, target: 'ES2022', lib: ['ES2022'], module: 'commonjs', moduleResolution: 'node', esModuleInterop: true,
    skipLibCheck: true, forceConsistentCasingInFileNames: true, noEmit: true, incremental: false,
    typeRoots: ['./node_modules/@types'], types: ['node'],
  },
  include: ['src/**/*.ts'],
};

function stageCell(e1Root: string, cell: E1Cell, dest: string): void {
  const src = path.join(e1Root, cell.projectId);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(path.join(src, 'src'), path.join(dest, 'src'), { recursive: true });
  fs.copyFileSync(path.join(src, 'package.json'), path.join(dest, 'package.json'));
  fs.symlinkSync(fs.readlinkSync(path.join(src, 'node_modules')), path.join(dest, 'node_modules'));
  fs.writeFileSync(path.join(dest, 'tsconfig.json'), `${JSON.stringify(E1_TSCONFIG, null, 2)}\n`);
}

function touchedSrc(touched: readonly string[]): string[] {
  return touched.filter((f) => f.startsWith('src/') && f.endsWith('.ts')).sort();
}

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const outArg = argOf(argv, '--out');
  if (outArg === undefined) {
    process.stderr.write('usage: judge-catch2-seed.ts --out <dir> [--count-only] [--e1 <dir>]\n');
    return 2;
  }
  const out = path.resolve(outArg);
  const e1Root = path.resolve(repoRoot, argOf(argv, '--e1') ?? DEFAULT_E1);
  const countOnly = argv.includes('--count-only');
  fs.mkdirSync(out, { recursive: true });
  const specAbs = path.resolve(repoRoot, E1_SPEC);
  const ops = ANTIPATTERN_OPERATORS;
  const opById = new Map(ops.map((o) => [o.id, o]));

  // ── Stratum 1: E1 cells ──────────────────────────────────────────────────────
  const cells = acceptedCells(repoRoot);
  const e1Bases = new Map<string, SeedBase>();
  const table: { baseId: string; cell: string; operatorId: string; candidates: number; eligible: number; rejected: Record<string, number> }[] = [];
  const sitesOf = new Map<string, MutationSite[]>(); // `${cellId}|${opId}`
  for (const c of cells) {
    const dir = path.join(out, 'e1-staging', c.cellId);
    stageCell(e1Root, c, dir);
    const b: SeedBase = { baseId: `e1/${c.cellId}`, kind: 'e1-cell', style: 'e1-clean-arch', dir, specPath: specAbs };
    e1Bases.set(c.cellId, b);
    for (const op of ops) {
      const r = await eligibleSites(repoRoot, b, op);
      table.push({ baseId: b.baseId, cell: c.cellId, operatorId: op.id, candidates: r.candidates, eligible: r.eligible.length, rejected: r.rejected });
      sitesOf.set(`${c.cellId}|${op.id}`, r.eligible);
    }
    process.stderr.write(`count ${c.cellId}\n`);
  }

  // Selection applies each drawn site at once: a draw that fails to apply or to type-check (BR-U5a-07) stays in the
  // manifest as rejected, and the next site of the same cell is drawn (twins: the next candidate by match quality).
  const rows: Round2Row[] = [];
  const skeletonTsc = (dir: string): string => path.join(fs.realpathSync(path.join(dir, 'node_modules')), 'typescript/lib/tsc.js');
  const perKey = new Map<string, number>();
  const attempt = async (cell: string, op: MutationOperator, site: MutationSite, twin?: { of: string; match: NonNullable<Round2Row['twinMatch']> }): Promise<Round2Row> => {
    const b = e1Bases.get(cell);
    if (b === undefined) throw new Error(`no base ${cell}`);
    const stem = `${b.baseId.replace('/', '__')}__${op.id}`;
    const k = perKey.get(stem) ?? 0;
    perKey.set(stem, k + 1);
    const rowId = `${stem}__${String(k)}`;
    const dest = path.join(out, 'copies', rowId);
    const res = countOnly
      ? { status: 'ok' as const, editedFiles: [], createdFiles: [], typecheckErrors: [] }
      : await applyOne(repoRoot, b, op, site, dest, skeletonTsc(b.dir));
    const row: Round2Row = {
      rowId, operatorId: op.id, positiveId: positiveOf(op), role: op.id.endsWith('n') ? 'twin' : 'seed', baseId: b.baseId, baseKind: b.kind,
      style: b.style, specPath: E1_SPEC, site, duplicateOfClean: false, ...res, copyDir: path.relative(out, dest),
      stratum: 'operator', cell, ...(twin !== undefined ? { twinOf: twin.of, twinMatch: twin.match } : {}),
    };
    if (res.status !== 'ok') fs.rmSync(dest, { recursive: true, force: true });
    rows.push(row);
    process.stderr.write(`${rowId}: ${res.status}${res.typecheckErrors.length > 0 ? ` (${res.typecheckErrors[0] ?? ''})` : ''}\n`);
    return row;
  };
  const rng = mulberry32(SAMPLE_SEED);
  const cellOrder = rng.pickDistinct(cells.map((c) => c.cellId).sort(), cells.length);
  const picks: { cell: string; op: MutationOperator; site: MutationSite }[] = [];
  for (const pos of ops.filter((o) => !o.id.endsWith('n'))) {
    const twin = opById.get(`${pos.id}n`);
    const tried = new Map<string, MutationSite[]>();
    const seeds: Round2Row[] = [];
    for (let pass = 0; pass < 8 && seeds.length < PER_OPERATOR; pass++) {
      let progressed = false;
      for (const cell of cellOrder) {
        if (seeds.length >= PER_OPERATOR) break;
        // One accepted seed per cell per pass; rejected draws are replaced from the same cell.
        for (;;) {
          const used = tried.get(cell) ?? [];
          const left = (sitesOf.get(`${cell}|${pos.id}`) ?? []).filter((x) => !used.includes(x));
          if (left.length === 0) break;
          const site = rng.pick(left);
          tried.set(cell, [...used, site]);
          const r = await attempt(cell, pos, site);
          if (r.status === 'ok') {
            seeds.push(r);
            picks.push({ cell, op: pos, site });
            progressed = true;
            break;
          }
        }
      }
      if (!progressed) break;
    }
    if (twin === undefined) continue;
    for (const sd of seeds) {
      const cell = sd.cell ?? '';
      const taken = rows.filter((x) => x.operatorId === twin.id && x.cell === cell).map((x) => x.site);
      const free = (sitesOf.get(`${cell}|${twin.id}`) ?? []).filter((x) => !taken.includes(x));
      const rank = (x: MutationSite): number => (x.filePath === sd.site.filePath ? (detailJson(x.detail) === detailJson(sd.site.detail) ? 0 : 1) : 2);
      const ordered = [...free].sort((a, b) => rank(a) - rank(b));
      for (const site of ordered) {
        const match = (['same-site', 'same-file', 'same-cell'] as const)[rank(site)] ?? 'same-cell';
        const r = await attempt(cell, twin, site, { of: sd.rowId, match });
        if (r.status === 'ok') {
          picks.push({ cell, op: twin, site });
          break;
        }
      }
    }
  }

  // ── Stratum 2: hand-planted reference variants ───────────────────────────────
  const refs = loadAllReferences(repoRoot);
  const matRoot = path.join(out, 'materialised');
  const hpBases = new Map<string, SeedBase>();
  const hpRows: Round2Row[] = [];
  const hpTwinPicks: { style: string; op: MutationOperator; site: MutationSite; twinOf: string }[] = [];
  for (const hp of HAND_PLANTED) {
    const ref = refs.find((r) => r.style === hp.style);
    const v = ref?.variants.find((x) => x.manifest.variant === hp.variant);
    const clean = ref?.variants.find((x) => x.manifest.kind === 'clean');
    if (ref === undefined || v === undefined || clean === undefined) throw new Error(`hand-planted ${hp.style}/${hp.variant} not found`);
    if (!hpBases.has(hp.style)) {
      const m = materialiseVariant(ref, clean, matRoot);
      hpBases.set(hp.style, { baseId: `${hp.style}/clean`, kind: 'reference-clean', style: hp.style, dir: m.projectDir, specPath: ref.specPath });
    }
    const mv = materialiseVariant(ref, v, matRoot);
    const files = touchedSrc(mv.touched);
    const rowId = `hp__${hp.style}__${hp.variant.split('-')[0] ?? hp.variant}`;
    const dest = path.join(out, 'copies', rowId);
    let errors: string[] = [];
    if (!countOnly) {
      copyDir(mv.projectDir, dest);
      errors = typecheck(repoRoot, dest);
    }
    const site: MutationSite = { filePath: files[0] ?? '', line: 1, kind: 'hand-planted' as MutationSite['kind'], detail: { variant: hp.variant } };
    hpRows.push({
      rowId, operatorId: `HP:${hp.style}/${hp.variant}`, positiveId: hp.mapsTo, role: 'seed', baseId: `${hp.style}/clean`, baseKind: 'reference-violation',
      style: hp.style, specPath: path.relative(repoRoot, ref.specPath), site, duplicateOfClean: false,
      status: errors.length === 0 ? 'ok' : 'typecheck', editedFiles: files, createdFiles: [], typecheckErrors: errors, copyDir: path.relative(out, dest),
      stratum: 'hand-planted', handPlanted: hp,
    });
    const twin = opById.get(`${hp.mapsTo}n`);
    const base = hpBases.get(hp.style);
    if (twin !== undefined && base !== undefined) {
      const r = await eligibleSites(repoRoot, base, twin);
      const s = r.eligible.find((x) => files.includes(x.filePath));
      if (s !== undefined) hpTwinPicks.push({ style: hp.style, op: twin, site: s, twinOf: rowId });
    }
  }

  // ── Apply (bases, hand-planted twins) ─────────────────────────────────────────
  if (!countOnly) {
    const basesOut = path.join(out, 'bases');
    for (const cell of new Set(picks.map((p) => p.cell))) {
      const b = e1Bases.get(cell);
      if (b !== undefined) copyDir(b.dir, path.join(basesOut, b.baseId.replace('/', '__')));
    }
    for (const b of hpBases.values()) copyDir(b.dir, path.join(basesOut, b.baseId.replace('/', '__')));
    rows.push(...hpRows);
    for (const t of hpTwinPicks) {
      const b = hpBases.get(t.style);
      if (b === undefined) continue;
      const rowId = `hp__${t.style}__${t.op.id}__${t.twinOf.split('__').pop() ?? ''}`;
      const dest = path.join(out, 'copies', rowId);
      const res = await applyOne(repoRoot, b, t.op, t.site, dest);
      rows.push({
        rowId, operatorId: t.op.id, positiveId: positiveOf(t.op), role: 'twin', baseId: b.baseId, baseKind: b.kind, style: b.style,
        specPath: path.relative(repoRoot, b.specPath), site: t.site, duplicateOfClean: false, ...res, copyDir: path.relative(out, dest),
        stratum: 'hand-planted', twinOf: t.twinOf,
      });
      process.stderr.write(`${rowId}: ${res.status}\n`);
    }
    for (const r of hpRows) process.stderr.write(`${r.rowId}: ${r.status} ${r.editedFiles.join(',')}\n`);
  }

  const summary = ops.map((op) => ({
    operatorId: op.id,
    cellsWithSites: table.filter((t) => t.operatorId === op.id && t.eligible > 0).length,
    eligible: table.filter((t) => t.operatorId === op.id).reduce((s, t) => s + t.eligible, 0),
    candidates: table.filter((t) => t.operatorId === op.id).reduce((s, t) => s + t.candidates, 0),
    rejected: table.filter((t) => t.operatorId === op.id).reduce<Record<string, number>>((acc, t) => {
      for (const [k, v] of Object.entries(t.rejected)) acc[k] = (acc[k] ?? 0) + v;
      return acc;
    }, {}),
    picked: picks.filter((p) => p.op.id === op.id).length,
  }));
  fs.writeFileSync(path.join(out, 'seed-manifest.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(), round: 2, perOperator: PER_OPERATOR, sampleSeed: SAMPLE_SEED, e1Cells: cells.length, cellOrder,
    handPlanted: HAND_PLANTED, handPlantedExcluded: HAND_PLANTED_EXCLUDED, summary, table, rows,
  }, null, 2)}\n`);
  process.stdout.write('| Operator | E1 cells with a site | eligible / candidates | rejected | picked |\n|---|---|---|---|---|\n');
  for (const s of summary) process.stdout.write(`| ${s.operatorId} | ${String(s.cellsWithSites)} of ${String(cells.length)} | ${String(s.eligible)} / ${String(s.candidates)} | ${JSON.stringify(s.rejected)} | ${String(s.picked)} |\n`);
  return 0;
}

if (process.argv[1]?.endsWith('judge-catch2-seed.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then((c) => {
    process.exitCode = c;
  });
}
