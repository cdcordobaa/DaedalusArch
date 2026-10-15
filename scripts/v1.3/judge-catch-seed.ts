/**
 * v1.3 judge catch test (U-F, FR-V9), step 2: sites and seeded copies. DEVELOPMENT SET ONLY.
 *
 * Bases: the five v1.3 reference projects (clean variant), the antipattern-nest fixture and, for an operator with
 * fewer than `MIN_SITES` sites there, the near-miss variants of the reference projects (materialised by the
 * reference loader). Per base and anti-pattern operator (frozen, `Docs/v1.3/judge-catch-frozen.md`): `findSites`, the
 * pipeline's precondition pass without judge placement (the seeded units are judged directly), then every eligible
 * site is applied to a fresh copy and the copy is type-checked with the repository's tsc (BR-U5a-07: any error is a
 * `typecheck` rejection). The projects in the repository are never written.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/judge-catch-seed.ts --out <dir> [--count-only]
 * Writes `<out>/bases/<baseId>/` (unmodified copies), `<out>/copies/<rowId>/` (seeded and twin copies) and
 * `<out>/seed-manifest.json`; prints the site table.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ANTIPATTERN_OPERATORS } from '../lib/mutation/antipatterns/index.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from '../lib/mutation/cycles.js';
import { compiledParams, compiledThresholds, loadCompiledSpec } from '../lib/mutation/expected.js';
import { buildImportGraph, openImportGraphProject } from '../lib/mutation/import-graph.js';
import { makePreparedBase } from '../lib/mutation/prepare.js';
import { mulberry32 } from '../lib/mutation/rng.js';
import { baseCycleCount, detailJson, evaluatePreconditions, sortSites } from '../lib/mutation/sites.js';
import type { MutationOperator, MutationSite, PreconditionContext, ProjectHandle } from '../lib/mutation/types.js';
import { loadAllReferences } from './lib/reference-model.js';
import { materialiseVariant } from './lib/materialise.js';

export const MIN_SITES = 5;
const APPLY_SEED = 20261015;

export interface SeedBase {
  readonly baseId: string;
  /** `e1-cell` and `reference-violation` are round-2 bases (`judge-catch2-seed.ts`). */
  readonly kind: 'reference-clean' | 'fixture' | 'near-miss' | 'e1-cell' | 'reference-violation';
  readonly style: string;
  readonly dir: string;
  readonly specPath: string;
}

export interface SeedRow {
  readonly rowId: string;
  readonly operatorId: string;
  readonly positiveId: string;
  readonly role: 'seed' | 'twin';
  readonly baseId: string;
  readonly baseKind: SeedBase['kind'];
  readonly style: string;
  readonly specPath: string;
  readonly site: MutationSite;
  /** True when the same operator, file and site detail already appear on the base's clean reference project. */
  readonly duplicateOfClean: boolean;
  readonly status: 'ok' | 'apply-error' | 'typecheck' | 'duplicate-not-applied';
  readonly editedFiles: readonly string[];
  readonly createdFiles: readonly string[];
  readonly typecheckErrors: readonly string[];
  readonly copyDir: string;
}

export function positiveOf(op: MutationOperator): string {
  return op.id.endsWith('n') ? op.id.slice(0, -1) : op.id;
}

export function copyDir(src: string, dest: string): void {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

async function contextOf(repoRoot: string, base: SeedBase, handle: ProjectHandle): Promise<PreconditionContext> {
  const compiled = await loadCompiledSpec(repoRoot, base.specPath);
  if (!compiled.success) throw new Error(`${base.baseId}: ${compiled.errors.map((e) => e.message).join('; ')}`);
  const prepared = makePreparedBase({
    projectId: base.baseId,
    baseKind: 'fixture',
    dir: base.dir,
    baseCommit: '0'.repeat(40),
    tsconfigPath: 'tsconfig.json',
    tscPath: path.resolve(repoRoot, 'node_modules/typescript/lib/tsc.js'),
    tscVersion: 'repository tsc',
    overlays: [],
    specPath: base.specPath,
  });
  if (!prepared.success) throw new Error(prepared.errors.map((e) => e.message).join('; '));
  const g = buildImportGraph(handle, compiled.data.layers);
  return {
    base: prepared.data,
    baseGraph: g,
    baseCycleCount: baseCycleCount(g, MAX_CYCLE_LENGTH, CYCLE_ROW_CAP),
    maxCycleLength: MAX_CYCLE_LENGTH,
    cycleRowCap: CYCLE_ROW_CAP,
    thresholds: compiledThresholds(compiled.data),
    templateParams: compiledParams(compiled.data),
    enabledTemplates: [...compiled.data.enabled.keys()],
  };
}

export async function eligibleSites(repoRoot: string, base: SeedBase, op: MutationOperator): Promise<{ candidates: number; eligible: MutationSite[]; rejected: Record<string, number> }> {
  const compiled = await loadCompiledSpec(repoRoot, base.specPath);
  if (!compiled.success) throw new Error(compiled.errors.map((e) => e.message).join('; '));
  const handle = openImportGraphProject(base.dir, 'tsconfig.json');
  const ctx = await contextOf(repoRoot, base, handle);
  const candidates = sortSites(op.findSites(handle, compiled.data.spec));
  const tally = evaluatePreconditions(op, handle, compiled.data.spec, candidates, ctx);
  return { candidates: candidates.length, eligible: tally.eligible.map((e) => e.site), rejected: { ...tally.rejectedByReason } as Record<string, number> };
}

/** `tsc` defaults to the repository's tsc (round 1); round 2 passes the E1 skeleton's pinned tsc for E1 cells. */
export function typecheck(repoRoot: string, dir: string, tsc: string = path.resolve(repoRoot, 'node_modules/typescript/lib/tsc.js')): string[] {
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', path.join(dir, 'tsconfig.json')], { encoding: 'utf8', timeout: 300_000 });
  const out = `${r.stdout}${r.stderr}`;
  return r.status === 0 ? [] : out.split('\n').filter((l) => /error TS\d+/.test(l)).map((l) => l.replace(dir + path.sep, ''));
}

export async function applyOne(repoRoot: string, base: SeedBase, op: MutationOperator, site: MutationSite, dest: string, tsc?: string): Promise<Pick<SeedRow, 'status' | 'editedFiles' | 'createdFiles' | 'typecheckErrors'>> {
  copyDir(base.dir, dest);
  const handle = openImportGraphProject(dest, 'tsconfig.json');
  const r = op.apply(handle, site, mulberry32(APPLY_SEED));
  if (!r.success) return { status: 'apply-error', editedFiles: [], createdFiles: [], typecheckErrors: r.errors.map((e) => e.message) };
  await handle.project.save();
  const errors = typecheck(repoRoot, dest, tsc);
  return { status: errors.length === 0 ? 'ok' : 'typecheck', editedFiles: r.data.editedFiles, createdFiles: r.data.createdFiles, typecheckErrors: errors };
}

export async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const outArg = argv[argv.indexOf('--out') + 1];
  if (!argv.includes('--out') || outArg === undefined) {
    process.stderr.write('usage: judge-catch-seed.ts --out <dir> [--count-only]\n');
    return 2;
  }
  const out = path.resolve(outArg);
  const countOnly = argv.includes('--count-only');
  fs.mkdirSync(out, { recursive: true });
  const refs = loadAllReferences(repoRoot);
  const primary: SeedBase[] = [];
  const nearMiss: SeedBase[] = [];
  const matRoot = path.join(out, 'materialised');
  for (const ref of refs) {
    for (const v of ref.variants) {
      if (v.manifest.kind === 'violation') continue;
      const m = materialiseVariant(ref, v, matRoot);
      const b: SeedBase = { baseId: `${ref.style}/${v.manifest.variant}`, kind: v.manifest.kind === 'clean' ? 'reference-clean' : 'near-miss', style: ref.style, dir: m.projectDir, specPath: ref.specPath };
      (v.manifest.kind === 'clean' ? primary : nearMiss).push(b);
    }
  }
  primary.push({ baseId: 'antipattern-nest', kind: 'fixture', style: 'nestjs-fixture', dir: path.resolve(repoRoot, 'fixtures/unit/antipattern-nest'), specPath: path.resolve(repoRoot, 'fixtures/unit/antipattern-nest/firewall.spec.yaml') });

  const table: { baseId: string; operatorId: string; candidates: number; eligible: number; rejected: Record<string, number> }[] = [];
  const picks: { base: SeedBase; op: MutationOperator; site: MutationSite; duplicateOfClean: boolean }[] = [];
  const cleanKeys = new Set<string>();
  const keyOf = (style: string, op: string, s: MutationSite): string => `${style}|${op}|${s.filePath}|${detailJson(s.detail)}`;
  for (const op of ANTIPATTERN_OPERATORS) {
    for (const b of primary) {
      const r = await eligibleSites(repoRoot, b, op);
      table.push({ baseId: b.baseId, operatorId: op.id, candidates: r.candidates, eligible: r.eligible.length, rejected: r.rejected });
      for (const s of r.eligible) {
        cleanKeys.add(keyOf(b.style, op.id, s));
        picks.push({ base: b, op, site: s, duplicateOfClean: false });
      }
    }
  }
  // Near-miss variants: only for an operator (and its twin) whose positive has fewer than MIN_SITES primary sites.
  const primaryCount = (pos: string): number => table.filter((t) => t.operatorId === pos).reduce((s, t) => s + t.eligible, 0);
  const expand = new Set(ANTIPATTERN_OPERATORS.filter((o) => !o.id.endsWith('n') && primaryCount(o.id) < MIN_SITES).map((o) => o.id));
  for (const op of ANTIPATTERN_OPERATORS) {
    if (!expand.has(positiveOf(op))) continue;
    for (const b of nearMiss) {
      const r = await eligibleSites(repoRoot, b, op);
      table.push({ baseId: b.baseId, operatorId: op.id, candidates: r.candidates, eligible: r.eligible.length, rejected: r.rejected });
      for (const s of r.eligible) picks.push({ base: b, op, site: s, duplicateOfClean: cleanKeys.has(keyOf(b.style, op.id, s)) });
    }
  }

  const rows: SeedRow[] = [];
  if (!countOnly) {
    const basesOut = path.join(out, 'bases');
    for (const b of [...primary, ...nearMiss]) {
      if (picks.some((p) => p.base.baseId === b.baseId)) copyDir(b.dir, path.join(basesOut, b.baseId.replace('/', '__')));
    }
    const perKey = new Map<string, number>();
    for (const p of picks) {
      const stem = `${p.base.baseId.replace('/', '__')}__${p.op.id}`;
      const k = perKey.get(stem) ?? 0;
      perKey.set(stem, k + 1);
      const rowId = `${stem}__${String(k)}`;
      const dest = path.join(out, 'copies', rowId);
      // A near-miss site identical to a clean-project site (same operator, file and detail) is the same seed again:
      // recorded, not applied and not judged.
      const res = p.duplicateOfClean
        ? { status: 'duplicate-not-applied' as const, editedFiles: [], createdFiles: [], typecheckErrors: [] }
        : await applyOne(repoRoot, p.base, p.op, p.site, dest);
      rows.push({
        rowId, operatorId: p.op.id, positiveId: positiveOf(p.op), role: p.op.id.endsWith('n') ? 'twin' : 'seed',
        baseId: p.base.baseId, baseKind: p.base.kind, style: p.base.style, specPath: path.relative(repoRoot, p.base.specPath),
        site: p.site, duplicateOfClean: p.duplicateOfClean, ...res, copyDir: path.relative(out, dest),
      });
      process.stderr.write(`${rowId}: ${res.status}${res.typecheckErrors.length > 0 ? ` (${res.typecheckErrors[0] ?? ''})` : ''}\n`);
    }
  }
  fs.writeFileSync(path.join(out, 'seed-manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), minSites: MIN_SITES, expandedToNearMiss: [...expand], table, rows }, null, 2)}\n`);
  const bases = [...new Set(table.map((t) => t.baseId))];
  process.stdout.write(`| Operator | ${bases.join(' | ')} | total |\n|---|${bases.map(() => '---').join('|')}|---|\n`);
  for (const op of ANTIPATTERN_OPERATORS) {
    const cells = bases.map((b) => {
      const t = table.find((x) => x.baseId === b && x.operatorId === op.id);
      return t === undefined ? '—' : `${String(t.eligible)}/${String(t.candidates)}`;
    });
    const tot = table.filter((t) => t.operatorId === op.id).reduce((s, t) => s + t.eligible, 0);
    process.stdout.write(`| ${op.id} | ${cells.join(' | ')} | ${String(tot)} |\n`);
  }
  return 0;
}

if (process.argv[1]?.endsWith('judge-catch-seed.ts') === true) {
  void main(process.argv.slice(2), process.cwd()).then((c) => {
    process.exitCode = c;
  });
}
