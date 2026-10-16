/**
 * Offline re-score of the reference set under a set of construct answers (no Neo4j). It reads a saved live run
 * (`<base>/raw` and `<base>/evidence`, as `ue-baseline-live.ts` writes them), applies the switches to the saved rows,
 * and compares the result with the author manifests exactly as `validate-reference.ts --from-raw` does
 * (`compareVariant`, `styleMetrics`, `renderMarkdown`).
 *
 * At the status quo (every question at A) nothing is transformed: the rows are the raw files, and the report is
 * byte-identical to the `--from-raw` replay of the same directory. Otherwise, per style:
 * - the compile hook is applied to the spec (`applyConstructCompileOverlays`, `compileFunctions` with the answers):
 *   rows of a rule the answers make inapplicable are dropped; a rule the answers make run gets its rows from the
 *   offline stand-in of its template (`construct-simulate.ts`) or, for a carrier, from the row stage;
 * - the row stage runs on the saved violations (`applyConstructRows`, the pipeline's own code), over a graph
 *   re-extracted from each materialised variant (`extractAPG`, the v1.3 defaults, as `ue-graph.ts`);
 * - the tiers are the switch-aware ones (`constructRuleTier`; Q3 C splits FF-S02 by row);
 * - the reference changes only where an option renames or removes what is compared: a rule an option makes
 *   inapplicable leaves the scope, a rule it adds joins it, an adapter edge renamed by Q5 C or D is renamed in the
 *   manifest too, and Q8 B lists the FLOWS_TO half of FF-P06 as N/A on both sides. Rows an option adds or drops are
 *   compared with the unchanged manifests: the figures show what the option does to the current reference.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { FunctionId } from '../../../src/shared/types/value-objects.js';
import type { ConstructAnswers } from '../../../src/shared/construct-switches.js';
import { isStatusQuo, STATUS_QUO_ANSWERS } from '../../../src/shared/construct-switches.js';
import { parseSpec, specExcludePathsFromYaml } from '../../../src/spec-parser/index.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { applyConstructCompileOverlays, CONSTRUCT_CARRIER_NAME } from '../../../src/construct-switches/compile.js';
import type { ConstructGraph } from '../../../src/construct-switches/graph.js';
import { constructGraphFromApg } from '../../../src/construct-switches/graph.js';
import { cycleFiles, cycleInOneComponent, layerViewOf } from '../../../src/construct-switches/layer-view.js';
import { applyConstructRows } from '../../../src/construct-switches/rows.js';
import type { RowChange } from '../../../src/construct-switches/rows.js';
import { constructRuleTier } from '../../../src/construct-switches/tiers.js';
import {
  ADAPTER_ISOLATION_ID, ADAPTER_ISOLATION_NAME, BARREL_APPLICATION_ID, BARREL_APPLICATION_NAME, globMatcher,
} from '../../../src/construct-switches/overlays.js';
import { compareVariant, normaliseFindingPath, renderMarkdown, styleMetrics } from './compare.js';
import type { ActualFinding, StyleMetrics, VariantComparison } from './compare.js';
import { loadAllReferences } from './reference-model.js';
import type { ExpectedFinding, LoadedReference, ReferenceStyle, ScopeRule } from './reference-model.js';
import { makeTempRoot, materialiseVariant } from './materialise.js';
import { compareAll } from './validate-reference-main.js';
import type { RunResult } from './validate-reference-main.js';
import { simulateTemplate } from './construct-simulate.js';

export type GraphProvider = (ref: LoadedReference, variant: string) => Promise<ConstructGraph>;

export interface RescoreInput {
  readonly repoRoot: string;
  /** A saved live run: `<base>/raw/<style>/<variant>.json` and `<base>/evidence/<style>/<variant>.json`. */
  readonly base: string;
  readonly answers: ConstructAnswers;
  readonly styles?: readonly ReferenceStyle[];
  /** The graph of a variant (the default re-extracts it); not called at the status quo. */
  readonly graphs?: GraphProvider;
  /** Tests: take the transforming path even at the status quo (it must give the same figures). */
  readonly forceGeneralPath?: boolean;
}

/** What the switches did, per variant, beyond the report. */
export interface RescoreExtras {
  readonly changes: Readonly<Record<string, readonly RowChange[]>>;
  /** Q8 B: the FF-P06 FLOWS_TO rows listed N/A (tool side) and the manifest rows they correspond to. */
  readonly notApplicable: Readonly<Record<string, { readonly tool: readonly ActualFinding[]; readonly expected: readonly ExpectedFinding[] }>>;
  /** Rules added to or removed from a style's compared scope by the answers. */
  readonly scope: Readonly<Record<string, { readonly added: readonly string[]; readonly removed: readonly string[] }>>;
  /** The tool rows of each variant (`style/variant`) after the switches, N/A rows excluded: for re-scoring against another key. */
  readonly actual: Readonly<Record<string, readonly ActualFinding[]>>;
}

export interface RescoreResult {
  readonly run: RunResult;
  readonly extras: RescoreExtras;
}

export function readRaw(dir: string, style: string, variant: string): readonly ActualFinding[] {
  const file = path.join(dir, style, `${variant}.json`);
  if (!fs.existsSync(file)) throw new Error(`no saved output ${file}`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { findings?: unknown };
  if (!Array.isArray(parsed.findings)) throw new Error(`${file}: no findings array`);
  return parsed.findings as ActualFinding[];
}

function readEvidence(dir: string, style: string, variant: string): readonly Violation[] {
  const file = path.join(dir, style, `${variant}.json`);
  if (!fs.existsSync(file)) throw new Error(`no saved evidence ${file}`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { violations?: unknown };
  if (!Array.isArray(parsed.violations)) throw new Error(`${file}: no violations array`);
  return parsed.violations as Violation[];
}

/** A raw row from a violation, as `liveEvaluator` writes it. */
export function toFinding(v: Violation): ActualFinding {
  const target = v.target ?? '';
  return { ruleId: String(v.functionId), file: v.filePath, ...(target !== '' ? { target } : {}) };
}

/** The default graph provider: materialise the variant, extract it with the v1.3 defaults, assign layers. */
export function extractingGraphs(): GraphProvider & { dispose: () => void } {
  const work = makeTempRoot('v13-construct-graph-');
  const specs = new Map<string, ParsedSpec>();
  const provider = async (ref: LoadedReference, variant: string): Promise<ConstructGraph> => {
    let spec = specs.get(ref.style);
    if (spec === undefined) {
      const parsed = await parseSpec({ specFilePath: ref.specPath });
      if (!parsed.success) throw new Error(`${ref.style}: spec does not parse`);
      spec = parsed.data;
      specs.set(ref.style, spec);
    }
    const v = ref.variants.find((x) => x.manifest.variant === variant);
    if (v === undefined) throw new Error(`unknown variant ${variant}`);
    const m = materialiseVariant(ref, v, work);
    const root = fs.realpathSync(m.projectDir);
    const excludes = specExcludePathsFromYaml(fs.readFileSync(ref.specPath, 'utf8'));
    const res = await extractAPG(root, { excludePatterns: excludes }, path.join(root, 'tsconfig.json'));
    if (!res.success) throw new Error(`${ref.style}/${variant}: extraction failed: ${res.errors.map((e) => e.message).join('; ')}`);
    const rel = (p: string): string => normaliseFindingPath(normaliseFindingPath(p, root), m.projectDir);
    const g = constructGraphFromApg(res.data, spec.layerModel, rel);
    fs.rmSync(m.projectDir, { recursive: true, force: true });
    return g;
  };
  return Object.assign(provider, { dispose: () => { fs.rmSync(work, { recursive: true, force: true }); } });
}

/** A graph cache on disk (JSON), so several re-scores extract each variant once. */
export function cachedGraphs(file: string, inner: GraphProvider): GraphProvider {
  type Stored = Omit<ConstructGraph, 'files'> & { files: [string, string | null][] };
  const cache: Record<string, Stored> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Stored> : {};
  return async (ref, variant) => {
    const key = `${ref.style}/${variant}`;
    let s = cache[key];
    if (s === undefined) {
      const g = await inner(ref, variant);
      s = { ...g, files: [...g.files.entries()] };
      cache[key] = s;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(cache));
    }
    return { ...s, files: new Map(s.files) };
  };
}

const IN_COMPONENT_SUFFIX = ' (in-component)';

export async function rescore(input: RescoreInput): Promise<RescoreResult> {
  const refs = loadAllReferences(input.repoRoot, input.styles);
  const rawDir = path.join(input.base, 'raw');
  const extras: { changes: Record<string, RowChange[]>; notApplicable: Record<string, { tool: ActualFinding[]; expected: ExpectedFinding[] }>; scope: Record<string, { added: string[]; removed: string[] }>; actual: Record<string, readonly ActualFinding[]> } =
    { changes: {}, notApplicable: {}, scope: {}, actual: {} };
  if (isStatusQuo(input.answers) && input.forceGeneralPath !== true) {
    const run = await compareAll(refs, (ref, variant) => {
      const rows = readRaw(rawDir, ref.style, variant);
      extras.actual[`${ref.style}/${variant}`] = rows;
      return Promise.resolve(rows);
    });
    return { run, extras };
  }
  const graphs = input.graphs ?? extractingGraphs();
  const comparisons: VariantComparison[] = [];
  const metrics: StyleMetrics[] = [];
  try {
    for (const ref of refs) {
      const one = await rescoreStyle(ref, input, graphs, extras);
      comparisons.push(...one.comparisons);
      metrics.push(one.metrics);
    }
  } finally {
    if (input.graphs === undefined) (graphs as ReturnType<typeof extractingGraphs>).dispose();
  }
  return { run: { comparisons, metrics }, extras };
}

const NEW_RULE_NAMES: Readonly<Record<string, string>> = {
  [ADAPTER_ISOLATION_ID]: ADAPTER_ISOLATION_NAME,
  [BARREL_APPLICATION_ID]: BARREL_APPLICATION_NAME,
  'FF-S02': 'no-cyclic-deps',
};

async function rescoreStyle(
  ref: LoadedReference, input: RescoreInput, graphs: GraphProvider,
  extras: { changes: Record<string, RowChange[]>; notApplicable: Record<string, { tool: ActualFinding[]; expected: ExpectedFinding[] }>; scope: Record<string, { added: string[]; removed: string[] }>; actual: Record<string, readonly ActualFinding[]> },
): Promise<{ comparisons: VariantComparison[]; metrics: StyleMetrics }> {
  const answers = input.answers;
  const parsed = await parseSpec({ specFilePath: ref.specPath });
  if (!parsed.success) throw new Error(`${ref.style}: spec does not parse`);
  const spec = parsed.data;
  const style = spec.style?.toLowerCase();
  const input0 = compilerInputFromSpec(spec);
  const overlaid = applyConstructCompileOverlays(input0, answers);
  const compiledIds = (a: ConstructAnswers): string[] => {
    const r = compileFunctions(compilerInputFromSpec(spec), { ...V13_COMPILE_OPTIONS, constructSwitches: a });
    if (!r.success) throw new Error(`${ref.style}: compile failed: ${r.errors.map((e) => e.message).join('; ')}`);
    return [...r.data.symbolicQueries.map((q) => String(q.functionId)), ...r.data.hybridPairs.map((p) => String(p.functionId))];
  };
  const before = new Set(compiledIds(STATUS_QUO_ANSWERS));
  const after = compiledIds(answers);
  const afterSet = new Set(after);
  const fnById = new Map(overlaid.fitnessFunctions.map((f) => [String(f.id), f]));
  const view = layerViewOf(overlaid.layerModel);

  // Scope: drop rules the answers stop running, add the rules they introduce.
  const removed = ref.descriptor.scopeRules.filter((r) => before.has(r.ruleId) && !afterSet.has(r.ruleId)).map((r) => r.ruleId);
  const scopeIds = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const added = after.filter((id) => !before.has(id) && !scopeIds.has(id) && NEW_RULE_NAMES[id] !== undefined);
  extras.scope[ref.style] = { added, removed };
  const tierRow = (ruleId: string, ruleName: string, severity: ScopeRule['severity']): ScopeRule => {
    const tier = constructRuleTier(ruleId, style, answers).tier;
    return { ruleId, ruleName, severity, blockingCandidate: tier === 'blocking', tier };
  };
  let scopeRules: ScopeRule[] = [
    ...ref.descriptor.scopeRules.filter((r) => !removed.includes(r.ruleId)).map((r) => tierRow(r.ruleId, r.ruleName, r.severity)),
    ...added.map((id) => tierRow(id, NEW_RULE_NAMES[id] ?? id, 'critical')),
  ];

  const evidenceDir = path.join(input.base, 'evidence');
  const actualOf = new Map<string, ActualFinding[]>();
  const naOf = new Map<string, ActualFinding[]>();
  const graphOf = new Map<string, ConstructGraph>();
  for (const v of ref.variants) {
    const variant = v.manifest.variant;
    const g = await graphs(ref, variant);
    graphOf.set(variant, g);
    const saved = readEvidence(evidenceDir, ref.style, variant);
    const results: SymbolicFunctionResult[] = after.map((id) => {
      const ff = fnById.get(id);
      let rows = saved.filter((x) => String(x.functionId) === id);
      if (ff !== undefined && ff.name !== CONSTRUCT_CARRIER_NAME) {
        const recompute = !before.has(id) || (answers.Q13 === 'C' && style === 'nestjs' && ff.name === 'dependency-direction');
        if (recompute) rows = simulateTemplate(ff, g, view);
        const original = input0.fitnessFunctions.find((f) => String(f.id) === id);
        const newGlobs = ff.excludePaths.filter((x) => !(original?.excludePaths ?? []).includes(x));
        if (newGlobs.length > 0) {
          const m = globMatcher(newGlobs);
          rows = rows.filter((x) => !m(x.filePath));
        }
      }
      return {
        functionId: id as FunctionId, dimension: ff?.dimension ?? 'structural', passed: rows.length === 0, violations: rows,
        executionTimeMs: 0, deterministic: true,
      };
    });
    const out = applyConstructRows(results, { answers, ...(style !== undefined ? { style } : {}), layerModel: overlaid.layerModel, functions: overlaid.fitnessFunctions, graph: g });
    extras.changes[`${ref.style}/${variant}`] = [...out.changes];
    const rows = out.results.flatMap((r) => r.violations);
    const na = answers.Q8 === 'B' ? rows.filter((x) => String(x.functionId) === 'FF-P06' && x.discriminator?.[2] === 'FLOWS_TO') : [];
    naOf.set(variant, na.map(toFinding));
    actualOf.set(variant, rows.filter((x) => !na.includes(x)).map(toFinding));
    extras.actual[`${ref.style}/${variant}`] = actualOf.get(variant) ?? [];
  }

  // The reference under the answers (renames and N/A only).
  const layerIn = (variant: string, f: string | undefined): string | null => (f === undefined ? null : graphOf.get(variant)?.files.get(f) ?? null);
  const adapterPair = (variant: string, e: { file: string; target?: string }): boolean => {
    const s = layerIn(variant, e.file);
    const t = layerIn(variant, e.target);
    return s !== null && t !== null && view.adapterLayers.includes(s) && view.adapterLayers.includes(t);
  };
  const renameTo = (style === 'hexagonal' || style === 'ddd') && (answers.Q5 === 'C' || answers.Q5 === 'D')
    ? (answers.Q5 === 'C' ? 'FF-S01' : ADAPTER_ISOLATION_ID) : undefined;
  const expectedOf = (variant: string, list: readonly ExpectedFinding[]): ExpectedFinding[] => {
    let out = list.map((e) => (renameTo !== undefined && e.ruleId === 'FF-S03' && adapterPair(variant, e) ? { ...e, ruleId: renameTo } : e));
    const na = naOf.get(variant) ?? [];
    if (na.length > 0) {
      const hit = out.filter((e) => e.ruleId === 'FF-P06' && na.some((n) => n.file === e.file && (e.target === undefined || n.target === e.target)));
      if (hit.length > 0) {
        const key = `${ref.style}/${variant}`;
        extras.notApplicable[key] = { tool: na, expected: hit };
      }
      out = out.filter((e) => !hit.includes(e));
    }
    return out;
  };
  for (const [variant, na] of naOf) {
    const key = `${ref.style}/${variant}`;
    if (na.length > 0 && extras.notApplicable[key] === undefined) extras.notApplicable[key] = { tool: na, expected: [] };
  }

  const scope = new Set(scopeRules.map((r) => r.ruleId));
  const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
  const cleanActual = clean === undefined ? undefined : actualOf.get(clean.manifest.variant);
  let comparisons = ref.variants.map((v) => compareVariant(
    ref.style,
    { ...v.manifest, expectedFindings: expectedOf(v.manifest.variant, v.manifest.expectedFindings) },
    actualOf.get(v.manifest.variant) ?? [],
    scope,
    cleanActual,
  ));

  // Q3 C: the in-component part of FF-S02 is a second, advisory rule row.
  if (answers.Q3 === 'C') {
    const inComponent = (variant: string, f: { ruleId: string; file: string; target?: string }): boolean =>
      f.ruleId === 'FF-S02' && cycleInOneComponent(cycleFiles(f.file, f.target), (x) => layerIn(variant, x), style, overlaid.layerModel);
    const tag = <T extends { ruleId: string; file: string; target?: string }>(variant: string, f: T): T =>
      (inComponent(variant, f) ? { ...f, ruleId: `FF-S02${IN_COMPONENT_SUFFIX}` } : f);
    comparisons = comparisons.map((c) => ({
      ...c,
      matched: c.matched.map((m) => tag(c.variant, m)),
      mismatches: c.mismatches.map((m) => tag(c.variant, m)),
    }));
    const s02 = scopeRules.find((r) => r.ruleId === 'FF-S02');
    if (s02 !== undefined) {
      scopeRules = [...scopeRules, { ...s02, ruleId: `FF-S02${IN_COMPONENT_SUFFIX}`, ruleName: `${s02.ruleName} (in one layer and module)`, blockingCandidate: false, tier: 'advisory' }];
    }
  }

  const metrics = styleMetrics({ style: ref.style, descriptor: { scopeRules } }, comparisons);
  return { comparisons, metrics };
}

/** Writes report.json and report.md as `validate-reference.ts` does, plus construct-switches.json. */
export function writeRescore(outDir: string, result: RescoreResult, header: string, answers: ConstructAnswers): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ header, metrics: result.run.metrics, comparisons: result.run.comparisons }, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(result.run.metrics, result.run.comparisons, header));
  if (!isStatusQuo(answers)) {
    const { actual: _actual, ...written } = result.extras;
    fs.writeFileSync(path.join(outDir, 'construct-switches.json'), JSON.stringify({ answers, ...written }, null, 2) + '\n');
  }
}
