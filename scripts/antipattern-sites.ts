/**
 * Label-free site count of the DRAFT anti-pattern operators (v1.3; `Docs/operator-catalogue-antipatterns.md`).
 *
 * Per base and operator: `findSites` (stable order), then the pipeline's precondition pass (`evaluatePreconditions`:
 * the operator's own checks, judge placement over the stored baseline selection, cycle cap). No copy, no edit, no
 * type-check, no detector, no model; the base directory is only read. A base is a fixture directory or a corpus
 * clone at its registered commit (overlays applied by the caller, as `fetch-corpus` does).
 *
 * Usage (repository root):
 *   npx tsx scripts/antipattern-sites-cli.ts [--clones <dir>] [--only a,b] [--no-fixtures] [--out <json>] [--md <file>]
 *     [--smoke <n>]
 * `--clones` holds one directory per corpus entry name (`../daedalus-corpus` layout); the seven held-out SO4 bases of
 * the frozen catalogue §4 are counted when present, the others are reported as absent. `--smoke <n>` also applies up
 * to n eligible sites per operator and base in memory and reports new diagnostics (`smokeBase`); nothing is written.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../src/shared/errors/domain-result.js';
import { loadCorpus } from './lib/corpus.js';
import { ANTIPATTERN_OPERATORS } from './lib/mutation/antipatterns/index.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from './lib/mutation/cycles.js';
import { compiledParams, compiledThresholds, loadCompiledSpec } from './lib/mutation/expected.js';
import { buildImportGraph, openImportGraphProject } from './lib/mutation/import-graph.js';
import { makePreparedBase } from './lib/mutation/prepare.js';
import { baseCycleCount, evaluatePreconditions, sortSites } from './lib/mutation/sites.js';
import { mulberry32 } from './lib/mutation/rng.js';
import type { CompiledSpec } from './lib/mutation/expected.js';
import type { JudgeSelection, MutationOperator, PreconditionContext, PreconditionReason, ProjectHandle } from './lib/mutation/types.js';
import { judgeSelectionOf } from './prepare-bases.js';
import type { StoredBaselineSelection } from './prepare-bases.js';

/** The seven held-out SO4 bases (frozen catalogue §4, `sitesPerOperator` rule). */
export const HELD_OUT_BASES: readonly string[] = [
  'realworld-test',
  'ghostfolio-test',
  'truthy-demo',
  'dry-run-test',
  'zhuravlevma__nestjs-active-record',
  'nestjslatam__ddd',
  'v-aguiar__valex',
];

/** Fixture bases and the spec each is read with. */
export const FIXTURE_BASES: readonly { readonly projectId: string; readonly dir: string; readonly specPath: string }[] = [
  { projectId: 'antipattern-nest', dir: 'fixtures/unit/antipattern-nest', specPath: 'fixtures/unit/antipattern-nest/firewall.spec.yaml' },
  { projectId: 'correct-reference', dir: 'fixtures/correct-reference', specPath: 'specs/clean-arch.yaml' },
  { projectId: 'variant-a-structural', dir: 'fixtures/variant-a-structural', specPath: 'specs/clean-arch.yaml' },
  { projectId: 'variant-b-pattern', dir: 'fixtures/variant-b-pattern', specPath: 'specs/clean-arch.yaml' },
  { projectId: 'variant-c-everything', dir: 'fixtures/variant-c-everything', specPath: 'specs/clean-arch.yaml' },
  { projectId: 'variant-d-subtle', dir: 'fixtures/variant-d-subtle', specPath: 'specs/clean-arch.yaml' },
];

export interface CountBase {
  readonly projectId: string;
  readonly kind: 'fixture' | 'corpus';
  /** Absolute base directory (the corpus sub-path for a sub-path entry). */
  readonly dir: string;
  readonly tsconfigPath: string;
  readonly specPath: string;
  readonly commit: string;
  readonly judgeSelection?: readonly JudgeSelection[] | undefined;
}

export interface SiteCountRow {
  readonly projectId: string;
  readonly kind: 'fixture' | 'corpus';
  readonly operatorId: string;
  readonly candidates: number;
  readonly rejectedByReason: Readonly<Partial<Record<PreconditionReason, number>>>;
  readonly eligible: number;
  /** Distinct site files among the eligible sites. */
  readonly eligibleFiles: number;
  /**
   * Eligible when every judge unit is judged (no baseline selection, so no `judge-unit-not-selected`): the count a
   * design that judges the seeded files directly would draw from.
   */
  readonly eligibleUnplaced: number;
}

export interface SmokeRow {
  readonly projectId: string;
  readonly operatorId: string;
  readonly applied: number;
  /** Applications that added a diagnostic other than TS2307 (module not found: no install) to an edited file. */
  readonly newDiagnostics: number;
  readonly applyErrors: number;
  readonly examples: readonly string[];
}

const SMOKE_SEED = 20261012;

function diagnosticsOf(handle: ProjectHandle, files: readonly string[]): string[] {
  return files.flatMap((f) => {
    const sf = handle.project.getSourceFile(path.join(handle.root, f));
    if (sf === undefined) return [];
    return sf.getPreEmitDiagnostics().map((d) => {
      const m = d.getMessageText();
      return `${f}:${String(d.getCode())}:${typeof m === 'string' ? m : m.getMessageText()}`;
    });
  });
}

/**
 * Smoke check without install: up to `perOperator` eligible sites per operator (all judge units placed, seeded draw)
 * are applied in memory to a fresh project of the base, and the edited files' diagnostics are compared before and
 * after. Nothing is written. TS2307 is ignored: an uninstalled clone cannot resolve the packages an edit imports.
 */
export async function smokeBase(repoRoot: string, base: CountBase, operators: readonly MutationOperator[], perOperator: number): Promise<DomainResult<SmokeRow[]>> {
  const compiled = await loadCompiledSpec(repoRoot, base.specPath);
  if (!compiled.success) return compiled;
  const out: SmokeRow[] = [];
  for (const op of operators) {
    const probe = openImportGraphProject(base.dir, base.tsconfigPath);
    const ctx = await contextOf(repoRoot, { ...base, judgeSelection: undefined }, probe, compiled.data);
    if (!ctx.success) return ctx;
    const eligible = evaluatePreconditions(op, probe, compiled.data.spec, sortSites(op.findSites(probe, compiled.data.spec)), ctx.data).eligible;
    const pick = mulberry32(SMOKE_SEED).pickDistinct(eligible, Math.min(perOperator, eligible.length));
    let broken = 0;
    let errors = 0;
    const examples: string[] = [];
    for (const e of pick) {
      const handle = openImportGraphProject(base.dir, base.tsconfigPath);
      const files = [...new Set([e.site.filePath, ...(op.plannedFiles?.(e.site) ?? [])])];
      const before = new Set(diagnosticsOf(handle, files));
      const r = op.apply(handle, e.site, mulberry32(SMOKE_SEED));
      if (!r.success) {
        errors++;
        examples.push(`apply-error ${r.errors.map((x) => x.message).join('; ')}`);
        continue;
      }
      const added = diagnosticsOf(handle, files).filter((d) => !before.has(d) && !d.includes(':2307:'));
      if (added.length > 0) {
        broken++;
        examples.push(...added.slice(0, 2));
      }
    }
    out.push({ projectId: base.projectId, operatorId: op.id, applied: pick.length, newDiagnostics: broken, applyErrors: errors, examples });
  }
  return DomainResult.ok(out);
}

async function contextOf(repoRoot: string, base: CountBase, handle: ProjectHandle, compiled: CompiledSpec): Promise<DomainResult<PreconditionContext>> {
  const prepared = makePreparedBase({
    projectId: base.projectId,
    baseKind: base.kind,
    dir: base.dir,
    baseCommit: base.commit,
    tsconfigPath: base.tsconfigPath,
    tscPath: path.resolve(repoRoot, 'node_modules/typescript/lib/tsc.js'),
    tscVersion: 'not-measured (count only)',
    overlays: [],
    specPath: base.specPath,
    ...(base.judgeSelection !== undefined ? { judgeSelection: base.judgeSelection } : {}),
  });
  if (!prepared.success) return prepared;
  const baseGraph = buildImportGraph(handle, compiled.layers);
  return Promise.resolve(
    DomainResult.ok({
      base: prepared.data,
      baseGraph,
      baseCycleCount: baseCycleCount(baseGraph, MAX_CYCLE_LENGTH, CYCLE_ROW_CAP),
      maxCycleLength: MAX_CYCLE_LENGTH,
      cycleRowCap: CYCLE_ROW_CAP,
      thresholds: compiledThresholds(compiled),
      templateParams: compiledParams(compiled),
      enabledTemplates: [...compiled.enabled.keys()],
    }),
  );
}

/** Counts candidates and eligible sites of every operator on one base. */
export async function countBase(repoRoot: string, base: CountBase, operators: readonly MutationOperator[]): Promise<DomainResult<SiteCountRow[]>> {
  const compiled = await loadCompiledSpec(repoRoot, base.specPath);
  if (!compiled.success) return compiled;
  const handle = openImportGraphProject(base.dir, base.tsconfigPath);
  const ctxR = await contextOf(repoRoot, base, handle, compiled.data);
  if (!ctxR.success) return ctxR;
  const unplacedR = await contextOf(repoRoot, { ...base, judgeSelection: undefined }, handle, compiled.data);
  if (!unplacedR.success) return unplacedR;
  const ctx = ctxR.data;
  const rows: SiteCountRow[] = [];
  for (const op of operators) {
    const candidates = sortSites(op.findSites(handle, compiled.data.spec));
    const tally = evaluatePreconditions(op, handle, compiled.data.spec, candidates, ctx);
    const all = evaluatePreconditions(op, handle, compiled.data.spec, candidates, unplacedR.data);
    rows.push({
      projectId: base.projectId,
      kind: base.kind,
      operatorId: op.id,
      candidates: candidates.length,
      rejectedByReason: tally.rejectedByReason,
      eligible: tally.eligible.length,
      eligibleFiles: new Set(tally.eligible.map((e) => e.site.filePath)).size,
      eligibleUnplaced: all.eligible.length,
    });
  }
  return DomainResult.ok(rows);
}

/** The held-out corpus bases found under `clonesDir`, with their stored selections; absent ones by name. */
export function corpusBases(repoRoot: string, clonesDir: string, only?: readonly string[]): { readonly bases: CountBase[]; readonly absent: string[] } {
  const loaded = loadCorpus(path.join(repoRoot, 'corpus/corpus.json'), repoRoot);
  if (!loaded.ok) throw new Error(`corpus.json invalid: ${loaded.errors.join('; ')}`);
  const bases: CountBase[] = [];
  const absent: string[] = [];
  for (const name of HELD_OUT_BASES) {
    if (only !== undefined && !only.includes(name)) continue;
    const entry = loaded.corpus.entries.find((e) => e.name === name);
    const clone = path.resolve(clonesDir, name);
    if (entry === undefined || !fs.existsSync(clone)) {
      absent.push(name);
      continue;
    }
    const selFile = path.join(repoRoot, 'corpus/selections', `${name}.json`);
    const sel = fs.existsSync(selFile) ? judgeSelectionOf(JSON.parse(fs.readFileSync(selFile, 'utf8')) as StoredBaselineSelection) : undefined;
    bases.push({
      projectId: name,
      kind: 'corpus',
      dir: entry.subPath !== undefined ? path.join(clone, entry.subPath) : clone,
      tsconfigPath: entry.tsconfigPath ?? 'tsconfig.json',
      specPath: entry.specPath,
      commit: entry.commitSha,
      ...(sel?.ok === true ? { judgeSelection: sel.value } : {}),
    });
  }
  return { bases, absent };
}

/**
 * Markdown table: one row per operator, one column per base, cells `eligible (eligible without judge placement) /
 * candidates`, plus totals.
 */
export function siteCountMarkdown(rows: readonly SiteCountRow[], operators: readonly MutationOperator[]): string {
  const bases = [...new Set(rows.map((r) => r.projectId))];
  const cell = (op: string, b: string): string => {
    const r = rows.find((x) => x.operatorId === op && x.projectId === b);
    return r === undefined ? '—' : `${String(r.eligible)} (${String(r.eligibleUnplaced)}) / ${String(r.candidates)}`;
  };
  const total = (op: string, kind: 'fixture' | 'corpus', unplacedCount = false): number =>
    rows.filter((r) => r.operatorId === op && r.kind === kind).reduce((s, r) => s + (unplacedCount ? r.eligibleUnplaced : r.eligible), 0);
  const basesWith = (op: string, kind: 'fixture' | 'corpus'): number => rows.filter((r) => r.operatorId === op && r.kind === kind && r.eligible > 0).length;
  const lines = [
    `| Operator | ${bases.join(' | ')} | Fixtures eligible | Corpus eligible (bases with ≥ 1) | Corpus eligible without placement |`,
    `|---|${bases.map(() => '---').join('|')}|---|---|---|`,
  ];
  for (const op of operators) {
    lines.push(`| ${op.id} | ${bases.map((b) => cell(op.id, b)).join(' | ')} | ${String(total(op.id, 'fixture'))} | ${String(total(op.id, 'corpus'))} (${String(basesWith(op.id, 'corpus'))}) | ${String(total(op.id, 'corpus', true))} |`);
  }
  return `${lines.join('\n')}\n`;
}

export interface SitesIo {
  readonly out: (t: string) => void;
  readonly err: (t: string) => void;
}

export async function main(argv: readonly string[], repoRoot: string, io: SitesIo): Promise<number> {
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const clones = arg('--clones');
  const only = arg('--only')?.split(',').filter((x) => x.length > 0);
  const bases: CountBase[] = [];
  if (!argv.includes('--no-fixtures')) {
    for (const f of FIXTURE_BASES) {
      if (only !== undefined && !only.includes(f.projectId)) continue;
      bases.push({ projectId: f.projectId, kind: 'fixture', dir: path.resolve(repoRoot, f.dir), tsconfigPath: 'tsconfig.json', specPath: f.specPath, commit: '0'.repeat(40) });
    }
  }
  let absent: string[] = [];
  if (clones !== undefined) {
    const c = corpusBases(repoRoot, clones, only);
    bases.push(...c.bases);
    absent = c.absent;
  }
  const rows: SiteCountRow[] = [];
  for (const b of bases) {
    const r = await countBase(repoRoot, b, ANTIPATTERN_OPERATORS);
    if (!r.success) {
      io.err(`${b.projectId}: ${r.errors.map((e) => e.message).join('; ')}\n`);
      return 1;
    }
    rows.push(...r.data);
  }
  const smoke: SmokeRow[] = [];
  const perOperator = arg('--smoke');
  if (perOperator !== undefined) {
    for (const b of bases) {
      const r = await smokeBase(repoRoot, b, ANTIPATTERN_OPERATORS, Number(perOperator));
      if (!r.success) {
        io.err(`${b.projectId}: ${r.errors.map((e) => e.message).join('; ')}\n`);
        return 1;
      }
      smoke.push(...r.data);
    }
  }
  const json = `${JSON.stringify({ rows, absent, ...(perOperator !== undefined ? { smoke } : {}) }, null, 2)}\n`;
  const md = siteCountMarkdown(rows, ANTIPATTERN_OPERATORS);
  const outFile = arg('--out');
  const mdFile = arg('--md');
  if (outFile !== undefined) fs.writeFileSync(outFile, json);
  if (mdFile !== undefined) fs.writeFileSync(mdFile, md);
  io.out(md);
  for (const op of ANTIPATTERN_OPERATORS) {
    const mine = smoke.filter((x) => x.operatorId === op.id);
    if (mine.length === 0) continue;
    const sum = (k: 'applied' | 'newDiagnostics' | 'applyErrors'): number => mine.reduce((t, x) => t + x[k], 0);
    io.out(`smoke ${op.id}: applied ${String(sum('applied'))}, new diagnostics ${String(sum('newDiagnostics'))}, apply errors ${String(sum('applyErrors'))}\n`);
  }
  if (absent.length > 0) io.out(`absent: ${absent.join(', ')}\n`);
  return 0;
}
