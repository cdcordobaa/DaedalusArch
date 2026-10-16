/**
 * v1.3 graph-fidelity harness (FR-V2, link 1). No Neo4j, no LLM; reads the projects, never writes into them.
 *
 * Usage:
 *   npx tsx scripts/v1.3/graph-fidelity.ts project --root <dir> --tsconfig <file> [--spec <yaml>] [--id <id>] --out <dir>
 *   npx tsx scripts/v1.3/graph-fidelity.ts e1  --outcomes <daedalus-e1-outcomes> [--plan experiments/e1-grid/plan.json] --out <dir>
 *   npx tsx scripts/v1.3/graph-fidelity.ts so4 --bases <daedalus-so4/bases> --out <dir>
 * Options:
 *   --dynamic-extractor <path to src/apg-extractor/index.ts of a tree with the v1.3 `dynamicImports` option>
 *   --depcruise <bin>   (default: experiments/tool-comparison/depcruise/node_modules/.bin/depcruise, the pinned 18.4.0)
 *   --seed <n>          (default 20261014) for the adjudication and layer samples
 *   --views             also measure the v1.3 graph (ADR-V13-01) in its literal view (no `viaReExport` edges) and its
 *                       resolved view (no `reExportHop` edges)
 *
 * Per corpus it writes `<out>/projects/<id>.json` and `.csv`, `<out>/aggregate.json`, `<out>/adjudication.csv` (every
 * disagreement edge plus a stratified sample of 50 agreement edges, suggested verdicts pre-filled) and
 * `<out>/layer-review.csv` (40 sampled file-to-layer assignments). Projects run one at a time (NFR-V2).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractAPG, V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../src/apg-extractor/index.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import type { LayerModel } from '../../src/shared/types/spec.js';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';
import {
  agreement, agreementStratum, classify, cmp, depcruiseConfig, depcruiseEdges, isByDesign, microAgreement,
  mulberry32, occurrencesByEdge, projectApg, readCompilerConfig, REASON_CLASSES, scopeOf, seededSample, splitKey,
  stratifiedSample, suggestVerdict, toCsv, tscReference,
} from './lib/graph-fidelity.js';
import type {
  Agreement, ApgEdgeInfo, ApgLike, ClassifyContext, DcEdgeInfo, DcModule, EdgeKey, RefOccurrence,
} from './lib/graph-fidelity.js';
import { assignLayers } from './lib/layer-assignment.js';
import { must } from './lib/must.js';
import type { LayerAssignment } from './lib/layer-assignment.js';

const REPO = process.cwd();
const DEFAULT_DEPCRUISE = 'experiments/tool-comparison/depcruise/node_modules/.bin/depcruise';
const DEFAULT_SEED = 20261014;
const AGREEMENT_SAMPLE = 50;
const LAYER_SAMPLE = 40;

type ExtractFn = (root: string, options: Record<string, unknown>, tsconfig?: string) => Promise<{ success: boolean; data?: ApgLike; errors?: { message: string }[] }>;

interface Variant {
  readonly name: string;
  readonly extract: ExtractFn;
  readonly options: Record<string, unknown>;
  readonly dynamicOption: boolean;
  /** ADR-V13-01 views: keep only the edges of one view before the projection. */
  readonly edgeFilter?: (e: ApgLike['edges'][number]) => boolean;
}

interface ProjectInput {
  readonly id: string;
  readonly root: string;
  readonly tsconfig: string;
  readonly specPath?: string;
  readonly meta: Record<string, unknown>;
}

const REFS = ['depcruise', 'tsc', 'union', 'intersection'] as const;
type RefName = (typeof REFS)[number];

interface ProjectState {
  readonly input: ProjectInput;
  readonly ctxByVariant: Map<string, ClassifyContext>;
  readonly evidence: Map<EdgeKey, { tsc: RefOccurrence[]; dc: DcEdgeInfo | undefined; apg: Record<string, ApgEdgeInfo | undefined> }>;
  readonly sets: Record<string, Set<EdgeKey>>;
  readonly compilerOptions: import('typescript').CompilerOptions;
}

interface ProjectSummary {
  readonly id: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly meta: Record<string, unknown>;
  readonly agreement?: Record<string, Record<RefName, Agreement>>;
  readonly agreementRaw?: Record<string, Record<RefName, Agreement>>;
  readonly classes?: Record<string, Record<'depcruise' | 'tsc', Record<string, number>>>;
  readonly layer?: { total: number; assigned: number; fractionAssigned: number; perLayer: Record<string, number>; unassigned: readonly string[]; inconsistencies: readonly string[] };
}

// ── argv ─────────────────────────────────────────────────────────────────────

function arg(name: string, argv: readonly string[]): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function need(name: string, argv: readonly string[]): string {
  const v = arg(name, argv);
  if (v === undefined) throw new Error(`missing --${name}`);
  return v;
}

function readJson(p: string): unknown {
  return JSON.parse(readFileSync(p, 'utf8')) as unknown;
}

function writeOut(p: string, text: string): void {
  mkdirSync(resolve(p, '..'), { recursive: true });
  writeFileSync(p, text);
}

const r4 = (x: number): number => Math.round(x * 1e6) / 1e6;

/** The first extractor variant: the base the adjudication and the per-project figures read. */
const baseVariant = (variants: readonly Variant[]): Variant => must(variants[0], 'an extractor variant');

// ── Measurement of one project ───────────────────────────────────────────────

async function measure(input: ProjectInput, variants: readonly Variant[], depcruiseBin: string): Promise<{ summary: ProjectSummary; state?: ProjectState; csv?: string; assignments?: LayerAssignment[] }> {
  const root = realpathSync(input.root);
  const tsconfig = resolve(input.tsconfig);
  const specExcludes = input.specPath !== undefined ? specExcludePathsFromYaml(readFileSync(input.specPath, 'utf8')) : [];

  // (a) APG extractor variants.
  const apg: Record<string, ReturnType<typeof projectApg>> = {};
  for (const v of variants) {
    const res = await v.extract(root, { ...v.options, excludePatterns: specExcludes }, tsconfig);
    if (!res.success || res.data === undefined) {
      return { summary: { id: input.id, ok: false, error: `${v.name}: ${(res.errors ?? []).map((e) => e.message).join('; ')}`, meta: input.meta } };
    }
    apg[v.name] = projectApg(v.edgeFilter !== undefined ? { ...res.data, edges: res.data.edges.filter(v.edgeFilter) } : res.data);
  }
  const apgOf = (name: string): ReturnType<typeof projectApg> => must(apg[name], `APG edges of ${name}`);
  const apgFiles = new Set(apgOf(baseVariant(variants).name).files);

  // (c) TypeScript compiler reference.
  const tsc = tscReference(root, tsconfig);
  const tscEdges = occurrencesByEdge(tsc.occurrences);

  // (b) dependency-cruiser.
  const tmp = mkdtempSync(join(tmpdir(), 'gf-dc-'));
  let dc = new Map<EdgeKey, DcEdgeInfo>();
  let dcError: string | undefined;
  let dcCruised = 0;
  try {
    const cfg = join(tmp, 'depcruise.json');
    writeFileSync(cfg, JSON.stringify(depcruiseConfig(tsconfig), null, 2));
    const res = spawnSync(depcruiseBin, ['--config', cfg, '--output-type', 'json', '--no-progress', '.'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 });
    try {
      const out = JSON.parse(res.stdout) as { modules: DcModule[]; summary: { totalCruised: number } };
      dc = depcruiseEdges(out.modules);
      dcCruised = out.summary.totalCruised;
    } catch (err) {
      dcError = `${err instanceof Error ? err.message : String(err)}: ${res.stderr.slice(0, 500)}`;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  // Sets and evidence.
  const dcSet = new Set(dc.keys());
  const tscSet = new Set(tscEdges.keys());
  const sets: Record<string, Set<EdgeKey>> = { depcruise: dcSet, tsc: tscSet };
  for (const v of variants) sets[v.name] = new Set(apgOf(v.name).edges.keys());
  const setOf = (name: string): Set<EdgeKey> => must(sets[name], `edge set ${name}`);
  const all = new Set<EdgeKey>();
  for (const s of Object.values(sets)) for (const k of s) all.add(k);
  const evidence: ProjectState['evidence'] = new Map();
  for (const k of [...all].sort(cmp)) {
    const ap: Record<string, ApgEdgeInfo | undefined> = {};
    for (const v of variants) ap[v.name] = apgOf(v.name).edges.get(k);
    evidence.set(k, { tsc: tscEdges.get(k) ?? [], dc: dc.get(k), apg: ap });
  }
  const tscBySource = new Map<string, RefOccurrence[]>();
  for (const o of tsc.occurrences) {
    const l = tscBySource.get(o.source);
    if (l === undefined) tscBySource.set(o.source, [o]); else l.push(o);
  }
  const ctxByVariant = new Map<string, ClassifyContext>();
  for (const v of variants) {
    const apgBySource = new Map<string, { target: string; info: ApgEdgeInfo }[]>();
    for (const [k, info] of apgOf(v.name).edges) {
      const [s, t] = splitKey(k);
      const l = apgBySource.get(s);
      if (l === undefined) apgBySource.set(s, [{ target: t, info }]); else l.push({ target: t, info });
    }
    ctxByVariant.set(v.name, { apgFiles, tscBySource, apgBySource });
  }

  const inScope = (k: EdgeKey): boolean => {
    const [s, t] = splitKey(k);
    return scopeOf(s, apgFiles) === 'in-scope' && scopeOf(t, apgFiles) === 'in-scope';
  };
  const scoped = (s: ReadonlySet<EdgeKey>): Set<EdgeKey> => new Set([...s].filter(inScope));
  const refSet = (name: RefName, f: (s: ReadonlySet<EdgeKey>) => Set<EdgeKey>): Set<EdgeKey> => {
    const d = f(dcSet);
    const t = f(tscSet);
    if (name === 'depcruise') return d;
    if (name === 'tsc') return t;
    if (name === 'union') return new Set([...d, ...t]);
    return new Set([...d].filter((k) => t.has(k)));
  };
  const agree: Record<string, Record<RefName, Agreement>> = {};
  const agreeRaw: Record<string, Record<RefName, Agreement>> = {};
  const identity = (s: ReadonlySet<EdgeKey>): Set<EdgeKey> => new Set(s);
  for (const v of variants) {
    const scopedAgreement = {} as Record<RefName, Agreement>;
    const rawAgreement = {} as Record<RefName, Agreement>;
    agree[v.name] = scopedAgreement;
    agreeRaw[v.name] = rawAgreement;
    for (const r of REFS) {
      scopedAgreement[r] = agreement(scoped(setOf(v.name)), refSet(r, scoped));
      rawAgreement[r] = agreement(setOf(v.name), refSet(r, identity));
    }
  }

  // Classification of every disagreement (raw sets, scope classes included).
  const classes: Record<string, Record<'depcruise' | 'tsc', Record<string, number>>> = {};
  const rowClass = new Map<EdgeKey, Record<string, string>>();
  for (const v of variants) {
    const variantClasses: Record<'depcruise' | 'tsc', Record<string, number>> = { depcruise: {}, tsc: {} };
    classes[v.name] = variantClasses;
    const ctx = must(ctxByVariant.get(v.name), `classification context of ${v.name}`);
    for (const ref of ['depcruise', 'tsc'] as const) {
      const A = setOf(v.name);
      const R = setOf(ref);
      for (const k of all) {
        const inA = A.has(k);
        const inR = R.has(k);
        if (inA === inR) continue;
        const ev = must(evidence.get(k), `evidence of ${k}`);
        const missingSide = inA ? 'ref' : 'apg';
        const cls = classify({ key: k, tsc: ev.tsc, dc: ev.dc, apg: ev.apg[v.name] }, missingSide, ctx);
        const label = `${missingSide === 'apg' ? 'missing-in-apg' : 'missing-in-ref'}:${cls}`;
        variantClasses[ref][label] = (variantClasses[ref][label] ?? 0) + 1;
        const rc = rowClass.get(k) ?? {};
        rc[`${v.name}|${ref}`] = `${label}${isByDesign(cls, missingSide, v.dynamicOption) ? ' (by-design)' : ''}`;
        rowClass.set(k, rc);
      }
    }
  }

  // Per-edge CSV.
  const pairCols = variants.flatMap((v) => (['depcruise', 'tsc'] as const).map((r) => `${v.name}|${r}`));
  const header = ['source', 'target', 'scope', ...variants.map((v) => `in_${v.name}`), 'in_depcruise', 'in_tsc', 'tsc_kinds', 'specifiers', 'lines', 'depcruise_types', ...pairCols.map((c) => `class_${c.replace('|', '_vs_')}`)];
  const rows = [...evidence.entries()].map(([k, ev]) => {
    const [s, t] = splitKey(k);
    const firstApg = variants.map((v) => ev.apg[v.name]).find((x) => x !== undefined);
    const specs = [...new Set([...ev.tsc.map((o) => o.specifier), ...(firstApg?.specifiers ?? []), ...(ev.dc?.modules ?? [])])];
    const lines = [...new Set([...ev.tsc.map((o) => o.line), ...(firstApg?.lines ?? [])])].sort((a, b) => a - b);
    return [
      s, t, inScope(k) ? 'in-scope' : `${scopeOf(s, apgFiles)}>${scopeOf(t, apgFiles)}`,
      ...variants.map((v) => (setOf(v.name).has(k) ? 1 : 0)), dcSet.has(k) ? 1 : 0, tscSet.has(k) ? 1 : 0,
      [...new Set(ev.tsc.map((o) => o.kind))].sort(cmp), specs, lines, ev.dc?.dependencyTypes ?? [],
      ...pairCols.map((c) => rowClass.get(k)?.[c] ?? ''),
    ];
  });

  // File-to-layer assignment.
  let layer: ProjectSummary['layer'];
  let assignments: LayerAssignment[] | undefined;
  if (input.specPath !== undefined) {
    const parsed = await parseSpec({ specFilePath: input.specPath });
    if (parsed.success) {
      const model: LayerModel = parsed.data.layerModel;
      const la = assignLayers([...apgFiles].sort(cmp), model);
      layer = { total: la.total, assigned: la.assigned, fractionAssigned: r4(la.fractionAssigned), perLayer: { ...la.perLayer }, unassigned: la.assignments.filter((x) => x.layer === null).map((x) => x.file), inconsistencies: la.inconsistencies };
      assignments = [...la.assignments];
    }
  }

  const compilerOptions = readCompilerConfig(tsconfig).options;
  const summary: ProjectSummary = {
    id: input.id, ok: true,
    meta: {
      ...input.meta, root,
      // An E1 tsconfig is a throwaway temp file (ADR-032); its path is not recorded, so reruns are byte-identical.
      tsconfig: input.meta.tsconfigSource !== undefined ? '(throwaway pinned tsconfig, Docs/generator-protocol.md §3)' : tsconfig,
      spec: input.specPath !== undefined ? relative(REPO, input.specPath) : null, specExcludes,
      files: { apg: apgFiles.size, tsc: tsc.files.length, depcruiseCruised: dcCruised },
      tsc: { occurrencesInternal: tsc.occurrences.length, unresolved: tsc.unresolved, unresolvedSpecifiers: tsc.unresolvedSpecifiers.slice(0, 200), external: tsc.external },
      ...(dcError !== undefined ? { depcruiseError: dcError } : {}),
    },
    agreement: agree, agreementRaw: agreeRaw, classes, ...(layer !== undefined ? { layer } : {}),
  };
  return {
    summary, csv: toCsv(header, rows), ...(assignments !== undefined ? { assignments } : {}),
    state: { input: { ...input, root }, ctxByVariant, evidence, sets, compilerOptions },
  };
}

// ── Corpus runner ────────────────────────────────────────────────────────────

const slug = (id: string): string => id.replace(/[^A-Za-z0-9._-]+/g, '__');

async function runCorpus(name: string, inputs: readonly ProjectInput[], variants: readonly Variant[], depcruiseBin: string, outDir: string, seed: number): Promise<void> {
  const summaries: ProjectSummary[] = [];
  const adjudication: unknown[][] = [];
  const agreementPool = new Map<string, { project: string; key: EdgeKey }[]>();
  const states = new Map<string, ProjectState>();
  const layerPool: { project: string; a: LayerAssignment }[] = [];
  const pairCols = variants.flatMap((v) => (['depcruise', 'tsc'] as const).map((r) => `${v.name}|${r}`));

  for (const input of inputs) {
    const t0 = Date.now();
    const { summary, state, csv, assignments } = await measure(input, variants, depcruiseBin);
    summaries.push(summary);
    writeOut(join(outDir, 'projects', `${slug(input.id)}.json`), JSON.stringify(summary, null, 1) + '\n');
    if (csv !== undefined) writeOut(join(outDir, 'projects', `${slug(input.id)}.csv`), csv);
    for (const a of assignments ?? []) layerPool.push({ project: input.id, a });
    if (state !== undefined) {
      const base = baseVariant(variants).name;
      for (const [k, ev] of state.evidence) {
        const inSets = Object.fromEntries(Object.entries(state.sets).map(([n, s]) => [n, s.has(k)]));
        const disagree = pairCols.some((c) => {
          const [v, r] = c.split('|') as [string, string];
          return inSets[v] !== inSets[r];
        });
        if (disagree) {
          const ctx = must(state.ctxByVariant.get(base), `classification context of ${base}`);
          const sv = suggestVerdict(state.input.root, { key: k, tsc: ev.tsc, dc: ev.dc, apg: ev.apg[base] ?? Object.values(ev.apg).find((x) => x !== undefined) }, ctx, state.compilerOptions);
          adjudication.push(adjRow('disagreement', '', input.id, k, ev, inSets, variants, state, sv, pairCols));
        } else if (inSets[base] === true && inSets.depcruise === true && inSets.tsc === true) {
          const stratum = agreementStratum(ev.tsc);
          const l = agreementPool.get(stratum) ?? [];
          l.push({ project: input.id, key: k });
          agreementPool.set(stratum, l);
        }
      }
      states.set(input.id, state);
    }
    const a = summary.agreement?.[baseVariant(variants).name];
    process.stdout.write(`${input.id}\t${String(Date.now() - t0)} ms\t${summary.ok ? `dc cov ${a?.depcruise.refCoveredByApg.toFixed(4) ?? '?'} conf ${a?.depcruise.apgConfirmedByRef.toFixed(4) ?? '?'} | tsc cov ${a?.tsc.refCoveredByApg.toFixed(4) ?? '?'} conf ${a?.tsc.apgConfirmedByRef.toFixed(4) ?? '?'}` : `ERROR ${summary.error ?? ''}`}\n`);
  }

  // Stratified agreement sample (seeded).
  const rnd = mulberry32(seed);
  for (const { stratum, item } of stratifiedSample(agreementPool, AGREEMENT_SAMPLE, rnd)) {
    const state = must(states.get(item.project), `state of ${item.project}`);
    const ev = must(state.evidence.get(item.key), `evidence of ${item.key}`);
    const base = baseVariant(variants).name;
    const inSets = Object.fromEntries(Object.entries(state.sets).map(([n, s]) => [n, s.has(item.key)]));
    const sv = suggestVerdict(state.input.root, { key: item.key, tsc: ev.tsc, dc: ev.dc, apg: ev.apg[base] }, must(state.ctxByVariant.get(base), `classification context of ${base}`), state.compilerOptions);
    adjudication.push(adjRow('agreement-sample', stratum, item.project, item.key, ev, inSets, variants, state, sv, pairCols));
  }
  const adjHeader = [
    'row_type', 'agreement_stratum', 'project', 'source', 'target', 'specifier', 'line', 'source_line_text',
    ...variants.map((v) => `verdict_${v.name}`), 'verdict_depcruise', 'verdict_tsc',
    ...pairCols.map((c) => `class_${c.replace('|', '_vs_')}`),
    'suggested_verdict', 'suggested_basis', 'human_verdict', 'human_note',
  ];
  writeOut(join(outDir, 'adjudication.csv'), toCsv(adjHeader, adjudication));

  // Layer review sheet (seeded).
  const layerSample = seededSample([...layerPool].sort((x, y) => cmp(`${x.project}\t${x.a.file}`, `${y.project}\t${y.a.file}`)), LAYER_SAMPLE, mulberry32(seed + 1));
  writeOut(join(outDir, 'layer-review.csv'), toCsv(
    ['project', 'file', 'assigned_layer', 'match_method', 'matched_glob', 'human_correct', 'human_expected_layer', 'human_note'],
    layerSample.map(({ project, a }) => [project, a.file, a.layer ?? '(none)', a.matchMethod ?? '', a.glob, '', '', '']),
  ));

  writeOut(join(outDir, 'aggregate.json'), JSON.stringify(aggregate(name, summaries, variants, seed, adjudication.length), null, 1) + '\n');
}

function adjRow(
  type: string, stratum: string, project: string, k: EdgeKey, ev: ProjectState['evidence'] extends Map<EdgeKey, infer V> ? V : never,
  inSets: Record<string, boolean>, variants: readonly Variant[], state: ProjectState, sv: ReturnType<typeof suggestVerdict>, pairCols: readonly string[],
): unknown[] {
  const [s, t] = splitKey(k);
  const yn = (b: boolean | undefined): string => (b === true ? 'edge' : 'no-edge');
  const cls = pairCols.map((c) => {
    const [v, r] = c.split('|') as [string, 'depcruise' | 'tsc'];
    if (inSets[v] === inSets[r]) return '';
    const missingSide = inSets[v] === true ? 'ref' : 'apg';
    const c_ = classify({ key: k, tsc: ev.tsc, dc: ev.dc, apg: ev.apg[v] }, missingSide, must(state.ctxByVariant.get(v), `classification context of ${v}`));
    return `${missingSide === 'apg' ? 'missing-in-apg' : 'missing-in-ref'}:${c_}`;
  });
  return [
    type, stratum, project, s, t, sv.specifier, sv.line === 0 ? '' : sv.line, sv.lineText,
    ...variants.map((v) => yn(inSets[v.name])), yn(inSets.depcruise), yn(inSets.tsc), ...cls,
    sv.verdict, sv.basis, '', '',
  ];
}

function aggregate(name: string, summaries: readonly ProjectSummary[], variants: readonly Variant[], seed: number, adjudicationRows: number): unknown {
  const ok = summaries.filter((s) => s.ok);
  const out: Record<string, unknown> = {
    corpus: name, projects: summaries.length, measured: ok.length,
    failed: summaries.filter((s) => !s.ok).map((s) => ({ id: s.id, error: s.error })),
    depcruiseErrors: ok.filter((s) => s.meta.depcruiseError !== undefined).map((s) => s.id),
    seed, agreementSample: AGREEMENT_SAMPLE, layerSample: LAYER_SAMPLE, adjudicationRows,
    note: 'dependency-cruiser and the TypeScript compiler are second extractors, not ground truth: the figures are agreement (refCoveredByApg = |A∩R|/|R|, apgConfirmedByRef = |A∩R|/|A|, jaccard). Scoped = both endpoints are APG File nodes.',
  };
  const agg: Record<string, unknown> = {};
  for (const v of variants) {
    const per: Record<string, unknown> = {};
    for (const r of REFS) {
      for (const scope of ['scoped', 'raw'] as const) {
        const list = ok.map((s) => (scope === 'scoped' ? s.agreement : s.agreementRaw)?.[v.name]?.[r]).filter((x): x is Agreement => x !== undefined);
        const macro = (f: (a: Agreement) => number): number => (list.length === 0 ? 1 : r4(list.reduce((n, a) => n + f(a), 0) / list.length));
        const min = (f: (a: Agreement) => number): number => (list.length === 0 ? 1 : r4(Math.min(...list.map(f))));
        const micro = microAgreement(list);
        per[`${r}.${scope}`] = {
          micro: { ...micro, refCoveredByApg: r4(micro.refCoveredByApg), apgConfirmedByRef: r4(micro.apgConfirmedByRef), jaccard: r4(micro.jaccard) },
          macro: { refCoveredByApg: macro((a) => a.refCoveredByApg), apgConfirmedByRef: macro((a) => a.apgConfirmedByRef), jaccard: macro((a) => a.jaccard) },
          min: { refCoveredByApg: min((a) => a.refCoveredByApg), apgConfirmedByRef: min((a) => a.apgConfirmedByRef), jaccard: min((a) => a.jaccard) },
          projectsBelow095: {
            refCoveredByApg: list.filter((a) => a.refCoveredByApg < 0.95).length,
            apgConfirmedByRef: list.filter((a) => a.apgConfirmedByRef < 0.95).length,
          },
          projectsWithAnyDisagreement: list.filter((a) => a.onlyApg + a.onlyRef > 0).length,
        };
      }
    }
    const classes: Record<'depcruise' | 'tsc', Record<string, number>> = { depcruise: {}, tsc: {} };
    for (const s of ok) {
      for (const ref of ['depcruise', 'tsc'] as const) {
        for (const [label, n] of Object.entries(s.classes?.[v.name]?.[ref] ?? {})) classes[ref][label] = (classes[ref][label] ?? 0) + n;
      }
    }
    for (const ref of ['depcruise', 'tsc'] as const) classes[ref] = Object.fromEntries(Object.entries(classes[ref]).sort(([a], [b]) => cmp(a, b)));
    agg[v.name] = { agreement: per, disagreementClasses: classes };
  }
  out.variants = agg;
  out.reasonClasses = REASON_CLASSES;
  const withLayer = ok.filter((s) => s.layer !== undefined);
  const tot = withLayer.reduce((n, s) => n + (s.layer?.total ?? 0), 0);
  const asg = withLayer.reduce((n, s) => n + (s.layer?.assigned ?? 0), 0);
  out.layer = {
    projectsWithSpec: withLayer.length, files: tot, assigned: asg, fractionAssigned: tot === 0 ? 1 : r4(asg / tot),
    minProjectFraction: withLayer.length === 0 ? 1 : Math.min(...withLayer.map((s) => s.layer?.fractionAssigned ?? 1)),
    inconsistencies: withLayer.reduce((n, s) => n + (s.layer?.inconsistencies.length ?? 0), 0),
  };
  out.perProject = ok.map((s) => {
    const a = s.agreement?.[baseVariant(variants).name];
    return {
      id: s.id, judged: s.meta.judged, apgEdges: a?.tsc.apgEdges, tscEdges: a?.tsc.refEdges, depcruiseEdges: a?.depcruise.refEdges,
      dc: a !== undefined ? [r4(a.depcruise.refCoveredByApg), r4(a.depcruise.apgConfirmedByRef)] : null,
      tsc: a !== undefined ? [r4(a.tsc.refCoveredByApg), r4(a.tsc.apgConfirmedByRef)] : null,
      layerFraction: s.layer?.fractionAssigned,
    };
  });
  return out;
}

// ── Inputs ───────────────────────────────────────────────────────────────────

interface E1Plan { e1: { models: string[]; specLevels: string[]; tasks: { taskId: string; specPath: string }[]; runs: number; style: string } }

function e1Inputs(outcomes: string, planPath: string, tmp: string): ProjectInput[] {
  const plan = readJson(planPath) as E1Plan;
  const judged = new Map<string, string>();
  const runsDir = resolve(REPO, 'results/e1-grid/runs');
  if (existsSync(runsDir)) {
    for (const f of readdirSync(runsDir).filter((x) => x.endsWith('.run.json')).sort(cmp)) {
      const r = readJson(join(runsDir, f)) as { projectId: string; status: string; reasonCode?: string };
      judged.set(r.projectId, `${r.status}${r.reasonCode !== undefined ? `:${r.reasonCode}` : ''}`);
    }
  }
  const out: ProjectInput[] = [];
  for (const modelId of plan.e1.models) {
    for (const specLevel of plan.e1.specLevels) {
      for (const task of plan.e1.tasks) {
        for (let i = 0; i < plan.e1.runs; i++) {
          const id = `${modelId}/${task.taskId}/${specLevel}/run-${String(i)}`;
          const root = join(outcomes, modelId, task.taskId, specLevel, `run-${String(i)}`);
          const status = judged.get(id) ?? 'no-run-record';
          if (!existsSync(join(root, 'src'))) {
            out.push({ id, root: '', tsconfig: '', meta: { judged: false, runStatus: status, skipped: 'no src/' } });
            continue;
          }
          // ADR-032: the pinned per-run tsconfig of Docs/generator-protocol.md §3, outside the (read-only) cell.
          const real = realpathSync(root);
          const tsconfig = join(tmp, `${slug(id)}.tsconfig.json`);
          writeFileSync(tsconfig, harnessTsconfigText(real));
          out.push({ id, root: real, tsconfig, specPath: resolve(REPO, task.specPath), meta: { judged: status === 'accepted', runStatus: status, tsconfigSource: 'generator-protocol-s3' } });
        }
      }
    }
  }
  return out;
}

function so4Inputs(basesDir: string): ProjectInput[] {
  return readdirSync(basesDir).filter((f) => f.endsWith('.json')).sort(cmp).map((f) => {
    const b = readJson(join(basesDir, f)) as { projectId: string; dir: string; tsconfigPath: string; specPath: string; overlays?: { path: string }[]; baseCommit?: string };
    return {
      id: b.projectId, root: b.dir, tsconfig: join(b.dir, b.tsconfigPath), specPath: resolve(REPO, b.specPath),
      meta: { baseCommit: b.baseCommit ?? null, overlaysNotApplied: (b.overlays ?? []).map((o) => o.path) },
    };
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [mode, ...argv] = process.argv.slice(2);
  const out = resolve(need('out', argv));
  const seed = Number(arg('seed', argv) ?? DEFAULT_SEED);
  const depcruiseBin = resolve(REPO, arg('depcruise', argv) ?? DEFAULT_DEPCRUISE);
  if (!existsSync(depcruiseBin)) throw new Error(`dependency-cruiser not installed at ${depcruiseBin} (npm ci in experiments/tool-comparison/depcruise)`);
  // The v1.2E instrument's options, explicitly: on the v1.3 branch `{}` means the v1.3 defaults.
  const variants: Variant[] = [{ name: 'apg-v12e-default', extract: extractAPG as unknown as ExtractFn, options: { ...V12E_DEFAULT_OPTIONS }, dynamicOption: false }];
  if (argv.includes('--views')) {
    const v13 = { ...V13_DEFAULT_OPTIONS };
    const flag = (e: ApgLike['edges'][number], key: string): boolean => e.type === 'IMPORTS' && (e.properties as Record<string, unknown>)[key] === true;
    variants.push(
      { name: 'apg-v13-literal', extract: extractAPG as unknown as ExtractFn, options: v13, dynamicOption: true, edgeFilter: (e) => !flag(e, 'viaReExport') },
      { name: 'apg-v13-resolved', extract: extractAPG as unknown as ExtractFn, options: v13, dynamicOption: true, edgeFilter: (e) => !flag(e, 'reExportHop') },
    );
  }
  const dyn = arg('dynamic-extractor', argv);
  if (dyn !== undefined) {
    const mod = (await import(pathToFileURL(resolve(dyn)).href)) as { extractAPG: ExtractFn };
    variants.push({ name: 'apg-v13-dynamicImports', extract: mod.extractAPG, options: { dynamicImports: true }, dynamicOption: true });
  }
  const tmp = mkdtempSync(join(tmpdir(), 'gf-tsconfig-'));
  try {
    let inputs: ProjectInput[];
    if (mode === 'e1') {
      inputs = e1Inputs(resolve(need('outcomes', argv)), resolve(REPO, arg('plan', argv) ?? 'experiments/e1-grid/plan.json'), tmp);
      const skipped = inputs.filter((i) => i.root === '');
      writeOut(join(out, 'skipped.json'), JSON.stringify(skipped.map((s) => ({ id: s.id, ...s.meta })), null, 1) + '\n');
      inputs = inputs.filter((i) => i.root !== '');
    } else if (mode === 'so4') {
      inputs = so4Inputs(resolve(need('bases', argv)));
    } else if (mode === 'project') {
      const spec = arg('spec', argv);
      inputs = [{ id: arg('id', argv) ?? 'project', root: resolve(need('root', argv)), tsconfig: resolve(need('tsconfig', argv)), ...(spec !== undefined ? { specPath: resolve(spec) } : {}), meta: {} }];
    } else {
      throw new Error('mode must be e1, so4 or project');
    }
    await runCorpus(mode, inputs, variants, depcruiseBin, out, seed);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

void main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});


