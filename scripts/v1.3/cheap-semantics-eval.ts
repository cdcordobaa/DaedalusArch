/**
 * Cheap semantic proxies (pass 0.5) against the planted anti-patterns of the v1.3 judge catch test. DEVELOPMENT SET.
 *
 * 1. Seeds: the output of `judge-catch-seed.ts` (the frozen AP operators and twins on `antipattern-nest` and every
 *    valid site of the reference projects, each copy type-checked). Pass `--seed <dir>` to reuse a run; without it the
 *    seeding runs first into `<work>/seed`.
 * 2. Every applied seed copy, twin copy and unmodified base is extracted (`extractAPG`, branch defaults, the spec's
 *    `default_exclude_paths`) and every proxy runs on it (`src/apg-enrich/cheap`). No LLM, no Neo4j.
 * 3. Per operator: the designated proxy's catch rate on the seeded site, the twin false-flag rate on the twin's site,
 *    and the clean false-flag rate on the seed's site in the unmodified base (raw and paired: a flag already on the
 *    base unit does not count as a catch).
 * 4. Precision proxy: every proxy on the five clean reference projects (and, for context, the near-miss variants),
 *    flag counts per proxy and runtime per project.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/cheap-semantics-eval.ts --out results/v1.3-cheap-semantics [--seed <dir>] [--work <dir>]
 * Writes `<out>/scores.json`, `<out>/rows.csv`, `<out>/flags/<id>.json` and prints the markdown tables.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAndEnrich } from '../../src/apg-enrich/cheap/index.js';
import type { CheapEnrichment, CheapFlag, ProxyId } from '../../src/apg-enrich/cheap/index.js';
import { PROXY_IDS } from '../../src/apg-enrich/cheap/index.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import type { LayerModel } from '../../src/shared/types/spec.js';
import { wilson } from '../lib/stats.js';
import { main as seedMain } from './judge-catch-seed.js';
import type { SeedRow } from './judge-catch-seed.js';
import { loadAllReferences } from './lib/reference-model.js';
import { materialiseVariant } from './lib/materialise.js';

/** The proxy that should flag each operator's seed (primary) and the set of proxies whose flag also counts. */
export const DESIGNATED: Readonly<Record<string, { primary: ProxyId; any: readonly ProxyId[] }>> = {
  'AP-REPO-BYPASS': { primary: 'repo-bypass', any: ['repo-bypass', 'name-behaviour'] },
  'AP-FAT-CONTROLLER': { primary: 'logic-density', any: ['logic-density', 'name-behaviour'] },
  'AP-PERSIST-IN-DOMAIN': { primary: 'name-behaviour', any: ['name-behaviour', 'framework-in-core'] },
  'AP-DUP-RULE': { primary: 'clones', any: ['clones', 'shared-literals'] },
  'AP-FRAMEWORK-LEAK': { primary: 'framework-in-core', any: ['framework-in-core'] },
};

/** Judge round-1 numbers (`Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md` §3, §4). */
export const JUDGE_ROUND1: Readonly<Record<string, { catch: string; twin: string; clean: string; symbolic: string }>> = {
  'AP-REPO-BYPASS': { catch: '4/4', twin: '0/4', clean: '0/4', symbolic: '0/4' },
  'AP-FAT-CONTROLLER': { catch: '1/1', twin: '0/1', clean: '0/1', symbolic: '0/1' },
  'AP-PERSIST-IN-DOMAIN': { catch: '1/1', twin: '2/7', clean: '0/1', symbolic: '0/1 (FF-P01 expected, did not fire)' },
  'AP-DUP-RULE': { catch: '1/1', twin: '1/1', clean: '0/1', symbolic: '0/1' },
  'AP-FRAMEWORK-LEAK': { catch: '2/4', twin: '0/20', clean: '0/4', symbolic: '0/4' },
};

/**
 * Hand-written analogues of two operators among the reference projects' violation variants. They were written
 * (`tests/fixtures/v1.3-reference`) before these proxies and independently of the AP operators, so they test the
 * proxies on defects whose shape the proxy author did not choose.
 */
export const ANALOGUES: readonly { variant: string; positiveId: string; unit: SiteUnit }[] = [
  { variant: 'clean-architecture/v04-domain-entity-typeorm-decorator', positiveId: 'AP-PERSIST-IN-DOMAIN', unit: { file: 'src/domain/entities/Book.ts', className: 'Book', methodName: undefined } },
  { variant: 'layered/v07-business-model-typeorm-decorator', positiveId: 'AP-PERSIST-IN-DOMAIN', unit: { file: 'src/business/model/Order.ts', className: 'Order', methodName: undefined } },
  { variant: 'nestjs/v05-domain-entity-typeorm-decorator', positiveId: 'AP-PERSIST-IN-DOMAIN', unit: { file: 'src/domain/workshop.ts', className: 'Workshop', methodName: undefined } },
  { variant: 'clean-architecture/v10-domain-entity-type-imports-express', positiveId: 'AP-FRAMEWORK-LEAK', unit: { file: 'src/domain/entities/Member.ts', className: 'Member', methodName: 'fromRequest' } },
  { variant: 'layered/v08-business-service-takes-express-request', positiveId: 'AP-FRAMEWORK-LEAK', unit: { file: 'src/business/services/OrderService.ts', className: 'OrderService', methodName: 'placeOrderFromRequest' } },
  { variant: 'nestjs/v06-domain-entity-type-imports-express', positiveId: 'AP-FRAMEWORK-LEAK', unit: { file: 'src/domain/attendee.ts', className: 'Attendee', methodName: 'fromRequest' } },
];

export interface SiteUnit {
  readonly file: string;
  readonly className: string | undefined;
  readonly methodName: string | undefined;
}

/** The code unit an operator's site names. DUP-RULE and PERSIST-IN-DOMAIN are class-level (a new or annotated class). */
export function siteUnit(positiveId: string, site: SeedRow['site']): SiteUnit {
  const d = site.detail as Readonly<Record<string, string | undefined>>;
  const className = d.class ?? d.controller;
  const classLevel = positiveId === 'AP-DUP-RULE' || positiveId === 'AP-PERSIST-IN-DOMAIN';
  return { file: site.filePath, className, methodName: classLevel ? undefined : d.method ?? d.handler };
}

/** True when a flag lies on the unit: same file and class, and same method when both name one. */
export function flagOnUnit(f: CheapFlag, u: SiteUnit): boolean {
  if (f.evidence.file !== u.file) return false;
  if (u.className !== undefined && f.className !== u.className) return false;
  return u.methodName === undefined || f.methodName === undefined || f.methodName === u.methodName;
}

const flagKey = (f: CheapFlag): string => `${f.proxy}|${f.kind}|${f.evidence.file}|${f.className ?? ''}|${f.methodName ?? ''}`;

interface RunOutcome {
  readonly id: string;
  readonly enrichment: CheapEnrichment;
  readonly extractMs: number;
  readonly files: number;
}

const specCache = new Map<string, { model: LayerModel; excludes: string[] }>();
async function specOf(specPath: string): Promise<{ model: LayerModel; excludes: string[] }> {
  const hit = specCache.get(specPath);
  if (hit !== undefined) return hit;
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new Error(`${specPath}: spec does not parse`);
  const v = { model: parsed.data.layerModel, excludes: specExcludePathsFromYaml(fs.readFileSync(specPath, 'utf8')) };
  specCache.set(specPath, v);
  return v;
}

async function runOne(id: string, dir: string, specPath: string): Promise<RunOutcome> {
  const { model, excludes } = await specOf(specPath);
  const root = fs.realpathSync(dir);
  const r = await extractAndEnrich(root, { layerModel: model, extractorOptions: { excludePatterns: excludes } });
  return { id, enrichment: r.enrichment, extractMs: r.extractMs, files: r.apg.nodes.filter((n) => n.type === 'File').length };
}

function rate(k: number, n: number): string {
  if (n === 0) return '0/0';
  const w = wilson(k, n);
  return `${String(k)}/${String(n)} = ${(k / n).toFixed(2)} [${w.low.toFixed(2)}, ${w.high.toFixed(2)}]`;
}

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const arg = (name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const out = path.resolve(arg('--out') ?? 'results/v1.3-cheap-semantics');
  const work = path.resolve(arg('--work') ?? fs.mkdtempSync(path.join(os.tmpdir(), 'v13-cheap-')));
  let seedDir = arg('--seed');
  if (seedDir === undefined) {
    seedDir = path.join(work, 'seed');
    const code = await seedMain(['--out', seedDir], repoRoot);
    if (code !== 0) return code;
  }
  seedDir = path.resolve(seedDir);
  fs.mkdirSync(path.join(out, 'flags'), { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(seedDir, 'seed-manifest.json'), 'utf8')) as { rows: SeedRow[] };
  const rows = manifest.rows.filter((r) => r.status === 'ok');

  // ── Bases and copies ──
  const baseRuns = new Map<string, RunOutcome>();
  for (const baseId of [...new Set(rows.map((r) => r.baseId))].sort()) {
    const row = rows.find((r) => r.baseId === baseId);
    if (row === undefined) continue;
    const dir = path.join(seedDir, 'bases', baseId.replace('/', '__'));
    baseRuns.set(baseId, await runOne(baseId, dir, path.resolve(repoRoot, row.specPath)));
  }
  const rowResults: {
    rowId: string; operatorId: string; positiveId: string; role: string; baseId: string; unit: SiteUnit;
    primary: boolean; any: boolean; primaryPaired: boolean; anyPaired: boolean; baseprimary: boolean; baseAny: boolean;
    proxiesOnSite: string[]; newFlagsOnEditedFiles: string[]; totalMs: number;
  }[] = [];
  for (const r of rows) {
    const run = await runOne(r.rowId, path.join(seedDir, r.copyDir), path.resolve(repoRoot, r.specPath));
    const base = baseRuns.get(r.baseId);
    if (base === undefined) throw new Error(`no base run for ${r.baseId}`);
    fs.writeFileSync(path.join(out, 'flags', `${r.rowId}.json`), `${JSON.stringify(run.enrichment.flags, null, 1)}\n`);
    const des = DESIGNATED[r.positiveId];
    if (des === undefined) throw new Error(`no designated proxy for ${r.positiveId}`);
    const unit = siteUnit(r.positiveId, r.site);
    const on = run.enrichment.flags.filter((f) => flagOnUnit(f, unit));
    const baseOn = base.enrichment.flags.filter((f) => flagOnUnit(f, unit));
    const baseKeys = new Set(baseOn.map(flagKey));
    const baseAll = new Set(base.enrichment.flags.map(flagKey));
    const pick = (fs_: CheapFlag[], set: readonly ProxyId[]): CheapFlag[] => fs_.filter((f) => set.includes(f.proxy));
    const edited = new Set([...r.editedFiles, ...r.createdFiles]);
    rowResults.push({
      rowId: r.rowId, operatorId: r.operatorId, positiveId: r.positiveId, role: r.role, baseId: r.baseId, unit,
      primary: pick(on, [des.primary]).length > 0,
      any: pick(on, des.any).length > 0,
      primaryPaired: pick(on, [des.primary]).some((f) => !baseKeys.has(flagKey(f))),
      anyPaired: pick(on, des.any).some((f) => !baseKeys.has(flagKey(f))),
      baseprimary: pick(baseOn, [des.primary]).length > 0,
      baseAny: pick(baseOn, des.any).length > 0,
      proxiesOnSite: [...new Set(on.map((f) => `${f.proxy}:${f.kind}`))].sort(),
      newFlagsOnEditedFiles: [...new Set(run.enrichment.flags.filter((f) => edited.has(f.evidence.file) && !baseAll.has(flagKey(f))).map((f) => `${f.proxy}:${f.kind}`))].sort(),
      totalMs: run.extractMs + Object.values(run.enrichment.timingsMs).reduce((s, x) => s + x, 0),
    });
    process.stderr.write(`${r.rowId}: primary=${String(rowResults.at(-1)?.primary)} any=${String(rowResults.at(-1)?.any)}\n`);
  }

  // ── Per operator ──
  const table: Record<string, Record<string, string>> = {};
  const tally = (xs: typeof rowResults, f: (x: (typeof rowResults)[number]) => boolean): string => rate(xs.filter(f).length, xs.length);
  for (const pos of Object.keys(DESIGNATED)) {
    const seeds = rowResults.filter((x) => x.positiveId === pos && x.role === 'seed');
    const twins = rowResults.filter((x) => x.positiveId === pos && x.role === 'twin');
    table[pos] = {
      primary: DESIGNATED[pos]?.primary ?? '',
      seeds: String(seeds.length),
      catchPrimary: tally(seeds, (x) => x.primary),
      catchPrimaryPaired: tally(seeds, (x) => x.primaryPaired),
      catchAny: tally(seeds, (x) => x.any),
      catchAnyPaired: tally(seeds, (x) => x.anyPaired),
      twins: String(twins.length),
      twinFalsePrimary: tally(twins, (x) => x.primary),
      twinFalsePrimaryPaired: tally(twins, (x) => x.primaryPaired),
      twinFalseAny: tally(twins, (x) => x.any),
      twinFalseAnyPaired: tally(twins, (x) => x.anyPaired),
      cleanFalsePrimary: tally(seeds, (x) => x.baseprimary),
      cleanFalseAny: tally(seeds, (x) => x.baseAny),
    };
  }
  const seedsAll = rowResults.filter((x) => x.role === 'seed');
  const twinsAll = rowResults.filter((x) => x.role === 'twin');
  const pooled = {
    catchPrimary: tally(seedsAll, (x) => x.primary), catchPrimaryPaired: tally(seedsAll, (x) => x.primaryPaired),
    catchAny: tally(seedsAll, (x) => x.any), twinFalsePrimary: tally(twinsAll, (x) => x.primary),
    twinFalsePrimaryPaired: tally(twinsAll, (x) => x.primaryPaired), twinFalseAny: tally(twinsAll, (x) => x.any),
    twinFalseAnyPaired: tally(twinsAll, (x) => x.anyPaired), cleanFalsePrimary: tally(seedsAll, (x) => x.baseprimary),
    cleanFalseAny: tally(seedsAll, (x) => x.baseAny),
  };

  // ── Clean reference projects (precision proxy) and near-miss variants ──
  const precision: { project: string; kind: string; files: number; flags: Record<string, number>; flagList: { proxy: string; kind: string; where: string; message: string }[]; extractMs: number; timingsMs: Record<string, number>; totalMs: number; summaries: unknown }[] = [];
  const mat = path.join(work, 'precision');
  const violations: { variant: string; description: string; newFlags: string[]; analogue: { positiveId: string; primary: boolean; any: boolean; primaryPaired: boolean } | null }[] = [];
  for (const ref of loadAllReferences(repoRoot)) {
    const cleanVariant = ref.variants.find((v) => v.manifest.kind === 'clean');
    const cleanRun = cleanVariant === undefined ? undefined : await runOne(`${ref.style}/clean`, materialiseVariant(ref, cleanVariant, mat).projectDir, ref.specPath);
    const cleanKeys = new Set((cleanRun?.enrichment.flags ?? []).map(flagKey));
    for (const v of ref.variants) {
      const id = `${ref.style}/${v.manifest.variant}`;
      if (v.manifest.kind === 'violation') {
        const vr = await runOne(id, materialiseVariant(ref, v, mat).projectDir, ref.specPath);
        const fresh = vr.enrichment.flags.filter((f) => !cleanKeys.has(flagKey(f)) && f.proxy !== 'communities');
        const an = ANALOGUES.find((a) => a.variant === id);
        let analogue: (typeof violations)[number]['analogue'] = null;
        if (an !== undefined) {
          const des = DESIGNATED[an.positiveId];
          const on = vr.enrichment.flags.filter((f) => flagOnUnit(f, an.unit));
          analogue = {
            positiveId: an.positiveId,
            primary: on.some((f) => f.proxy === des?.primary),
            any: on.some((f) => des?.any.includes(f.proxy) === true),
            primaryPaired: on.some((f) => f.proxy === des?.primary && !cleanKeys.has(flagKey(f))),
          };
        }
        violations.push({ variant: id, description: v.manifest.description, newFlags: [...new Set(fresh.map((f) => `${f.proxy}:${f.kind}@${f.evidence.file}`))].sort(), analogue });
        continue;
      }
      const run = v.manifest.kind === 'clean' && cleanRun !== undefined ? cleanRun : await runOne(id, materialiseVariant(ref, v, mat).projectDir, ref.specPath);
      const counts: Record<string, number> = Object.fromEntries(PROXY_IDS.map((p) => [p, 0]));
      for (const f of run.enrichment.flags) counts[f.proxy] = (counts[f.proxy] ?? 0) + 1;
      const timingsMs = Object.fromEntries(Object.entries(run.enrichment.timingsMs).map(([k, x]) => [k, Math.round(x)]));
      precision.push({
        project: `${ref.style}/${v.manifest.variant}`, kind: v.manifest.kind, files: run.files, flags: counts,
        flagList: run.enrichment.flags.map((f) => ({ proxy: f.proxy, kind: f.kind, where: `${f.evidence.file}:${String(f.evidence.startLine)}`, message: f.message })),
        extractMs: Math.round(run.extractMs), timingsMs, totalMs: Math.round(run.extractMs + Object.values(run.enrichment.timingsMs).reduce((s, x) => s + x, 0)),
        summaries: run.enrichment.summaries,
      });
    }
  }
  const fixtureBase = baseRuns.get('antipattern-nest');

  fs.writeFileSync(path.join(out, 'scores.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(), designated: DESIGNATED, judgeRound1: JUDGE_ROUND1, perOperator: table, pooled,
    rows: rowResults, precision, violations,
    fixtureBase: fixtureBase === undefined ? null : { flags: fixtureBase.enrichment.flags, summaries: fixtureBase.enrichment.summaries, timingsMs: fixtureBase.enrichment.timingsMs },
  }, null, 1)}\n`);
  const csv = ['rowId,operatorId,role,baseId,file,class,method,primary,primaryPaired,any,anyPaired,basePrimary,baseAny,proxiesOnSite,newFlagsOnEditedFiles'];
  for (const x of rowResults) csv.push([x.rowId, x.operatorId, x.role, x.baseId, x.unit.file, x.unit.className ?? '', x.unit.methodName ?? '', x.primary, x.primaryPaired, x.any, x.anyPaired, x.baseprimary, x.baseAny, x.proxiesOnSite.join(' '), x.newFlagsOnEditedFiles.join(' ')].map(String).join(','));
  fs.writeFileSync(path.join(out, 'rows.csv'), `${csv.join('\n')}\n`);

  const p = (s: string): void => {
    process.stdout.write(`${s}\n`);
  };
  p('| Operator | Primary proxy | Seeds | Catch (primary) | Paired | Catch (designated set) | Twins | Twin false flag (primary) | Paired | Twin false flag (set) | Clean false flag (primary) |');
  p('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [pos, t] of Object.entries(table)) p(`| ${pos} | ${t.primary ?? ''} | ${t.seeds ?? ''} | ${t.catchPrimary ?? ''} | ${t.catchPrimaryPaired ?? ''} | ${t.catchAny ?? ''} | ${t.twins ?? ''} | ${t.twinFalsePrimary ?? ''} | ${t.twinFalsePrimaryPaired ?? ''} | ${t.twinFalseAny ?? ''} | ${t.cleanFalsePrimary ?? ''} |`);
  p(`| **Pooled** | | ${String(seedsAll.length)} | ${pooled.catchPrimary} | ${pooled.catchPrimaryPaired} | ${pooled.catchAny} | ${String(twinsAll.length)} | ${pooled.twinFalsePrimary} | ${pooled.twinFalsePrimaryPaired} | ${pooled.twinFalseAny} | ${pooled.cleanFalsePrimary} |`);
  p('');
  p(`| Project | Kind | Files | ${PROXY_IDS.join(' | ')} | Extract ms | Proxies ms | Total ms |`);
  p(`|---|---|---|${PROXY_IDS.map(() => '---').join('|')}|---|---|---|`);
  for (const x of precision) p(`| ${x.project} | ${x.kind} | ${String(x.files)} | ${PROXY_IDS.map((id) => String(x.flags[id] ?? 0)).join(' | ')} | ${String(x.extractMs)} | ${String(x.totalMs - x.extractMs)} | ${String(x.totalMs)} |`);
  p('');
  p('| Violation variant | Analogue of | Designated proxy flags the unit (paired) | New flags vs clean (communities excluded) |');
  p('|---|---|---|---|');
  for (const x of violations) p(`| ${x.variant} | ${x.analogue?.positiveId ?? '—'} | ${x.analogue === null ? '—' : `${String(x.analogue.primary)} (${String(x.analogue.primaryPaired)})`} | ${x.newFlags.join('<br>') || '—'} |`);
  return 0;
}

if (process.argv[1]?.endsWith('cheap-semantics-eval.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then((c) => {
    process.exitCode = c;
  });
}
