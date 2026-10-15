/**
 * APG v2 ablation (`Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md`). For every case of
 * `tests/fixtures/v1.3-apg2/cases.json`:
 *  (a)  the APG v2 template's in-memory mirror on the `V13_APG2_OPTIONS` graph: does a row match the case?
 *  (b1) the same mirror on the `V13_DEFAULT_OPTIONS` graph (the v1.3 APG without the new edges);
 *  (b2) the closest v1.3 rules (dependency-direction, no-cyclic-deps, domain-purity; in-memory mirrors) at the case's
 *       locus, and whether any v1.3 edge links the locus files at all;
 *  (c)  dependency-cruiser 18.4.0: the rules the existing translator emits for the project's layers (T), and the best
 *       hand-written rule set of `depcruise.hand.json` (H), matched at the locus.
 * Usage: `npx tsx scripts/apg2-ablation.ts` (writes Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json and table.md).
 * Needs `npm ci` in experiments/tool-comparison/depcruise for (c); without it (c) is reported as `not run`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractAPG, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS, componentsFromLayerModel } from '../src/apg-extractor/index.js';
import type { ComponentDeclaration } from '../src/apg-extractor/index.js';
import type { APGResult } from '../src/shared/types/apg.js';
import type { LayerDefinition, LayerModel, ParsedSpec } from '../src/shared/types/spec.js';
import type { LayerKind } from '../src/shared/types/enums.js';
import { APG2_IN_MEMORY, apg2Params, memGraph } from '../src/fitness-compiler/apg2-in-memory.js';
import type { Row } from '../src/fitness-compiler/apg2-in-memory.js';
import { linkingEdges, v13DependencyDirection, v13DomainPurity, v13NoCyclicDeps } from '../src/fitness-compiler/v13-in-memory-baselines.js';
import { translateParsed } from './depcruise-translate.js';

// Run from the repository root (as every script here).
const ROOT = process.cwd();
const SUITE = join(ROOT, 'tests/fixtures/v1.3-apg2');
const OUT = join(ROOT, 'Docs/DiagnosticRuns/apg2-ablation-2026-10-15');
const DEPCRUISE = join(ROOT, 'experiments/tool-comparison/depcruise/node_modules/.bin/depcruise');

interface ProjectSpec {
  readonly layers: ReadonlyArray<{ name: string; directories: string[]; filePatterns?: string[]; kind: LayerKind }>;
  readonly components: 'layers' | 'folders' | ComponentDeclaration[];
  readonly forbiddenImports: string[];
  readonly allowedAsync?: string[];
}
interface Case {
  readonly id: string;
  readonly project: string;
  readonly enrichment: string;
  readonly kind: 'planted' | 'near-miss' | 'control';
  readonly title: string;
  readonly template: string;
  readonly match: Readonly<Record<string, unknown>>;
  readonly locus?: { source: string; target?: string; dcFrom?: string; dcTo?: string };
}
interface Suite { readonly projects: Record<string, ProjectSpec>; readonly cases: Case[] }

function layerModelOf(p: ProjectSpec): LayerModel {
  const layers: LayerDefinition[] = p.layers.map((l) => ({
    name: l.name, directories: l.directories, naming: [], role: '', kind: l.kind, kindSource: 'explicit',
    ...(l.filePatterns !== undefined ? { filePatterns: l.filePatterns } : {}),
  }));
  return { layers };
}

function componentsOf(p: ProjectSpec): ComponentDeclaration[] {
  if (p.components === 'folders') return [];
  if (p.components === 'layers') return componentsFromLayerModel(layerModelOf(p));
  return p.components;
}

function rowMatches(row: Row, match: Readonly<Record<string, unknown>>): boolean {
  return Object.entries(match).every(([k, v]) => JSON.stringify(row[k]) === JSON.stringify(v));
}

/** A minimal parsed spec for the translator: the rules it can translate, over the project's layers. */
function translatorSpec(p: ProjectSpec): ParsedSpec {
  const ff = (id: string, name: string, extra: object = {}): unknown => ({
    id, name, dimension: 'structural', severity: 'critical', route: 'symbolic', isBuiltIn: true, validated: true, enabled: true, excludePaths: [], ...extra,
  });
  return {
    specVersion: '1.0', style: 'clean-architecture', layerModel: layerModelOf(p),
    fitnessFunctions: [
      ff('FF-S01', 'dependency-direction'), ff('FF-S02', 'no-cyclic-deps'), ff('FF-S04', 'no-domain-outward-dep'),
      ff('FF-P01', 'domain-purity', { forbiddenImports: p.forbiddenImports }),
    ],
    adrRules: [],
  } as unknown as ParsedSpec;
}

interface DcViolation { rule: string; from: string; to: string; cycle: string[] }

function runDepcruise(projectDir: string, config: object, tag: string): DcViolation[] | undefined {
  if (!existsSync(DEPCRUISE)) return undefined;
  mkdirSync(join(OUT, 'depcruise'), { recursive: true });
  const cfg = join(OUT, 'depcruise', `${tag}.json`);
  writeFileSync(cfg, JSON.stringify(config, null, 2) + '\n');
  const r = spawnSync(DEPCRUISE, ['--config', cfg, '--output-type', 'json', '--no-progress', 'src'], { cwd: projectDir, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.stdout.trim() === '') throw new Error(`depcruise failed on ${projectDir}: ${r.stderr}`);
  const out = JSON.parse(r.stdout) as { summary: { violations: Array<{ rule: { name: string }; from: string; to: string; cycle?: Array<{ name: string } | string> }> } };
  return out.summary.violations.map((v) => ({
    rule: v.rule.name, from: v.from, to: v.to,
    cycle: (v.cycle ?? []).map((c) => (typeof c === 'string' ? c : c.name)),
  }));
}

/** A violation is at the locus when it starts at the locus source (or folder) and ends at its target (or folder). */
function dcAtLocus(vs: DcViolation[] | undefined, locus: Case['locus']): string[] | undefined {
  if (vs === undefined) return undefined;
  if (locus === undefined) return [];
  const from = new Set([locus.source, locus.dcFrom].filter((x): x is string => x !== undefined));
  const to = [locus.target, locus.dcTo].filter((x): x is string => x !== undefined);
  return vs.filter((v) => from.has(v.from) && (to.length === 0 || to.some((t) => v.to === t || v.to.includes(`node_modules/${t}`) || v.to === t.replace(/^node:/, '') || v.cycle.includes(t))))
    .map((v) => `${v.rule}: ${v.from} -> ${v.to}`);
}

function v13AtLocus(rows: Row[], locus: Case['locus']): string[] {
  if (locus === undefined) return [];
  return rows.filter((r) => {
    if (r['rule'] === 'no-cyclic-deps') {
      const cyc = r['cycle'] as string[];
      return cyc.includes(locus.source) && (locus.target === undefined || cyc.includes(locus.target));
    }
    return r['source'] === locus.source && (locus.target === undefined || r['target'] === locus.target);
  }).map((r) => `${String(r['rule'])}: ${String(r['source'])} -> ${String(r['target'])}`);
}

async function extract(dir: string, opts: object): Promise<APGResult> {
  const r = await extractAPG(dir, opts);
  if (!r.success) throw new Error(`extract ${dir}: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

interface CaseResult {
  readonly id: string; readonly project: string; readonly enrichment: string; readonly kind: string; readonly title: string; readonly template: string;
  readonly apg2: boolean; readonly apg2Rows: number;
  readonly v13Graph: boolean;
  readonly v13Rules: string[]; readonly v13LinkingEdges: string[] | null;
  readonly dcTranslated: string[] | null; readonly dcHand: string[] | null;
  readonly pass: boolean;
}

async function main(): Promise<void> {
  const suite = JSON.parse(readFileSync(join(SUITE, 'cases.json'), 'utf8')) as Suite;
  const results: CaseResult[] = [];
  for (const [name, p] of Object.entries(suite.projects)) {
    const dir = join(SUITE, name);
    const layerModel = layerModelOf(p);
    const params = apg2Params(layerModel, { ...(p.allowedAsync !== undefined ? { allowedAsync: p.allowedAsync } : {}) });
    const v2 = memGraph(await extract(dir, { ...V13_APG2_OPTIONS, components: componentsOf(p) }), layerModel);
    const v13 = memGraph(await extract(dir, V13_DEFAULT_OPTIONS), layerModel);
    const v13Rows = [
      ...v13DependencyDirection(v13, layerModel.layers.map((l) => l.name)),
      ...v13NoCyclicDeps(v13),
      ...v13DomainPurity(v13, params.domainLayer, p.forbiddenImports),
    ];
    const dcT = runDepcruise(dir, translateParsed(translatorSpec(p), []).config, `${name}.translated`);
    const dcH = runDepcruise(dir, JSON.parse(readFileSync(join(dir, 'depcruise.hand.json'), 'utf8')) as object, `${name}.hand`);

    for (const c of suite.cases.filter((x) => x.project === name)) {
      const templates = c.template === '*' ? [...APG2_IN_MEMORY.keys()] : [c.template];
      const hits = (g: typeof v2): Row[] => templates.flatMap((t) => APG2_IN_MEMORY.get(t)!(g, params)).filter((r) => rowMatches(r, c.match));
      const a = hits(v2);
      const b1 = hits(v13);
      // The control has no locus: every v1.3 row and every dependency-cruiser violation of the project counts.
      const control = c.kind === 'control';
      const rules = control ? v13Rows.map((r) => `${String(r['rule'])}: ${String(r['source'])} -> ${String(r['target'])}`) : v13AtLocus(v13Rows, c.locus);
      const links = c.locus?.target !== undefined && c.locus.target.startsWith('src/')
        ? linkingEdges(v13, c.locus.source, c.locus.target).map((e) => e.type) : null;
      const all = (vs: DcViolation[] | undefined): string[] | undefined => vs?.map((v) => `${v.rule}: ${v.from} -> ${v.to}`);
      const dcTranslated = (control ? all(dcT) : dcAtLocus(dcT, c.locus)) ?? null;
      const dcHand = (control ? all(dcH) : dcAtLocus(dcH, c.locus)) ?? null;
      const detected = a.length > 0;
      const pass = c.kind === 'planted' ? detected && b1.length === 0
        : control ? !detected && rules.length === 0 && (dcTranslated ?? []).length === 0 && (dcHand ?? []).length === 0
          : !detected;
      results.push({ id: c.id, project: name, enrichment: c.enrichment, kind: c.kind, title: c.title, template: c.template,
        apg2: detected, apg2Rows: a.length, v13Graph: b1.length > 0, v13Rules: rules, v13LinkingEdges: links,
        dcTranslated, dcHand, pass });
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'ablation.json'), JSON.stringify(results, null, 2) + '\n');
  const yn = (b: boolean): string => (b ? 'yes' : 'no');
  const list = (xs: string[] | null): string => (xs === null ? 'not run' : xs.length === 0 ? 'no' : `yes (${xs.join('; ')})`);
  const lines = [
    '| Case | Kind | Template | APG v2 | APG v1.3 graph (template) | v1.3 rules at locus | v1.3 edge between locus files | dep-cruiser (translated) | dep-cruiser (hand-written) | Pass |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...results.map((r) => `| ${r.id} | ${r.kind} | ${r.template} | ${yn(r.apg2)} | ${yn(r.v13Graph)} | ${r.v13Rules.length === 0 ? 'no' : `yes (${r.v13Rules.join('; ')})`} | ${r.v13LinkingEdges === null ? 'n/a' : r.v13LinkingEdges.length === 0 ? 'none' : r.v13LinkingEdges.join(', ')} | ${list(r.dcTranslated)} | ${list(r.dcHand)} | ${r.pass ? 'pass' : 'FAIL'} |`),
  ];
  writeFileSync(join(OUT, 'table.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  const failed = results.filter((r) => !r.pass);
  if (failed.length > 0) {
    console.error(`FAILED: ${failed.map((r) => r.id).join(', ')}`);
    process.exitCode = 1;
  }
}

void main().then(
  () => undefined,
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
