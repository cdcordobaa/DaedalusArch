/**
 * APG v2 live Cypher verification and dev-set precision (`Docs/DiagnosticRuns/apg2-live-2026-10-15.md`).
 *
 * Mode `fixtures`: for every project of `tests/fixtures/v1.3-apg2/cases.json`, extract with `V13_APG2_OPTIONS` (and the
 * project's components), ingest into Neo4j with the project's layer model, and run every APG v2 extension template as
 * the compiler instantiates it (`instantiateTemplate`, no exclude paths, and once more with an exclude pattern that
 * matches nothing, to exercise the injected predicate) with `apg2Params`. The rows are compared with the in-memory
 * mirror's rows on the same extraction, row for row. The same templates also run live on the `V13_DEFAULT_OPTIONS`
 * graph (arm b1: must return nothing). Each case is then decided on the LIVE rows and compared with `ablation.json`.
 *
 * Mode `reference`: for every variant of the five v1.3 dev reference projects (71), materialise it, extract with
 * `V13_APG2_OPTIONS` (components from the spec's layer model), ingest, run the APG v2 templates live (and their mirrors),
 * and evaluate the spec's v1.3 rules (`compileFunctions` with `V13_COMPILE_OPTIONS`, `evaluateSymbolic`) on the same
 * graph. Then extract with `V13_DEFAULT_OPTIONS`, ingest, and evaluate the v1.3 rules again: the two v1.3 finding lists
 * must be equal (the APG v2 edges must not change any v1.3 rule's rows in Neo4j).
 *
 * Neo4j: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD from the environment; the cross-process Neo4j lock is held for the run.
 * Usage (repository root): npx tsx scripts/v1.3/apg2-live.ts fixtures|reference [--out <dir>]
 * Default out: Docs/DiagnosticRuns/apg2-live-2026-10-15.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import neo4j from 'neo4j-driver';
import { extractAPG, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS, componentsFromLayerModel } from '../../src/apg-extractor/index.js';
import type { ComponentDeclaration } from '../../src/apg-extractor/index.js';
import type { APGResult } from '../../src/shared/types/apg.js';
import type { LayerDefinition, LayerModel, ParsedSpec } from '../../src/shared/types/spec.js';
import type { LayerKind } from '../../src/shared/types/enums.js';
import { APG2_TEMPLATES, APG2_TEMPLATE_TIERS } from '../../src/fitness-compiler/apg2-templates.js';
import { APG2_IN_MEMORY, apg2Params, memGraph } from '../../src/fitness-compiler/apg2-in-memory.js';
import type { Apg2Params, Row } from '../../src/fitness-compiler/apg2-in-memory.js';
import { compileFunctions, instantiateTemplate, V13_COMPILE_OPTIONS } from '../../src/fitness-compiler/index.js';
import { compilerInputFromSpec } from '../../src/fitness-compiler/compiler-input.js';
import { evaluateSymbolic } from '../../src/evaluation-engine/index.js';
import { ingestAPG, Neo4jRepository } from '../../src/neo4j-ingestion/index.js';
import { parseSpec, readSpecExcludePaths } from '../../src/spec-parser/index.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import type { SnapshotStore } from '../../src/shared/interfaces/snapshot-store.js';
import { loadAllReferences } from './lib/reference-model.js';
import { makeTempRoot, materialiseVariant } from './lib/materialise.js';
import { normaliseFindingPath } from './lib/compare.js';

const ROOT = process.cwd();
const SUITE = path.join(ROOT, 'tests/fixtures/v1.3-apg2');
const ABLATION = path.join(ROOT, 'Docs/DiagnosticRuns/apg2-ablation-2026-10-15/ablation.json');

// ── Fixture suite model (as scripts/apg2-ablation.ts) ────────────────────────
interface ProjectSpec {
  readonly layers: ReadonlyArray<{ name: string; directories: string[]; filePatterns?: string[]; kind: LayerKind }>;
  readonly components: 'layers' | 'folders' | ComponentDeclaration[];
  readonly forbiddenImports: string[];
  readonly allowedAsync?: string[];
}
interface Case {
  readonly id: string; readonly project: string; readonly kind: 'planted' | 'near-miss' | 'control';
  readonly template: string; readonly match: Readonly<Record<string, unknown>>;
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
const rowMatches = (row: Row, match: Readonly<Record<string, unknown>>): boolean =>
  Object.entries(match).every(([k, v]) => JSON.stringify(row[k]) === JSON.stringify(v));

// ── Neo4j helpers ────────────────────────────────────────────────────────────
const nullStore = {} as SnapshotStore; // stateless ingestion never touches the store

/** A Neo4j value as plain JSON (Integer → number, arrays element-wise); `undefined` → null, as the driver returns. */
function plain(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (neo4j.isInt(v)) return (v as { toNumber(): number }).toNumber();
  if (Array.isArray(v)) return v.map(plain);
  return v;
}
const plainRow = (r: Row): Record<string, unknown> => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v)]));

/** Every parameter a template names, with null for a layer the spec does not bind (Neo4j needs every `$name`). */
function cypherParams(p: Apg2Params): Record<string, unknown> {
  return {
    domainLayer: p.domainLayer ?? null, infraLayer: p.infraLayer ?? null, controllerLayer: p.controllerLayer ?? null,
    applicationLayers: [...p.applicationLayers], threshold: p.threshold, allowedAsync: [...p.allowedAsync],
  };
}

async function ingest(repo: Neo4jRepository, apg: APGResult, layerModel: LayerModel): Promise<void> {
  const r = await ingestAPG({ apgResult: apg, layerModel, mode: 'stateless' }, repo, nullStore);
  if (!r.success) throw new Error(`ingest: ${r.errors.map((e) => e.message).join('; ')}`);
  for (const w of r.warnings ?? []) if (w.code === 'INGEST_002' || w.code === 'INGEST_003') throw new Error(`ingest: ${w.code} ${w.message}`);
}

async function extract(dir: string, opts: object): Promise<APGResult> {
  const r = await extractAPG(dir, opts);
  if (!r.success) throw new Error(`extract ${dir}: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

/** Runs one APG v2 template live; `exclude` instantiates it with an exclude pattern that matches no path. */
async function runLive(repo: Neo4jRepository, name: string, p: Apg2Params, exclude: boolean): Promise<Record<string, unknown>[]> {
  const tpl = APG2_TEMPLATES.get(name);
  if (tpl === undefined) throw new Error(`no template ${name}`);
  const params: Record<string, unknown> = { ...cypherParams(p), ...(exclude ? { excludePatterns: ['^__no_such_path__$'] } : {}) };
  const text = instantiateTemplate(tpl, params);
  const r = await repo.executeQuery(text, params);
  if (!r.success) throw new Error(`${name}: ${r.errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
  return r.data.records.map(plainRow);
}

const canon = (rows: readonly Row[]): string[] => rows.map((r) => JSON.stringify(plainRow(r))).sort();

interface TemplateComparison {
  readonly template: string; readonly live: number; readonly mirror: number;
  readonly multisetEqual: boolean; readonly orderEqual: boolean; readonly excludeVariantEqual: boolean;
  readonly onlyLive: string[]; readonly onlyMirror: string[];
}

async function compareTemplates(repo: Neo4jRepository, apg: APGResult, layerModel: LayerModel, p: Apg2Params): Promise<{ cmp: TemplateComparison[]; live: Map<string, Record<string, unknown>[]> }> {
  const g = memGraph(apg, layerModel);
  const cmp: TemplateComparison[] = [];
  const liveRows = new Map<string, Record<string, unknown>[]>();
  for (const name of APG2_TEMPLATES.keys()) {
    const live = await runLive(repo, name, p, false);
    const liveEx = await runLive(repo, name, p, true);
    const mirror = APG2_IN_MEMORY.get(name)!(g, p).map(plainRow);
    liveRows.set(name, live);
    const a = canon(live);
    const b = canon(mirror);
    const onlyLive = a.filter((x) => !b.includes(x));
    const onlyMirror = b.filter((x) => !a.includes(x));
    cmp.push({
      template: name, live: live.length, mirror: mirror.length,
      multisetEqual: JSON.stringify(a) === JSON.stringify(b),
      orderEqual: JSON.stringify(live) === JSON.stringify(mirror),
      excludeVariantEqual: JSON.stringify(canon(liveEx)) === JSON.stringify(a),
      onlyLive, onlyMirror,
    });
  }
  return { cmp, live: liveRows };
}

// ── Mode: fixtures ───────────────────────────────────────────────────────────
async function fixtures(repo: Neo4jRepository, out: string): Promise<number> {
  const suite = JSON.parse(fs.readFileSync(path.join(SUITE, 'cases.json'), 'utf8')) as Suite;
  const ablation = new Map((JSON.parse(fs.readFileSync(ABLATION, 'utf8')) as Array<{ id: string; apg2: boolean; apg2Rows: number; v13Graph: boolean }>).map((r) => [r.id, r]));
  const projects: Record<string, { templates: TemplateComparison[]; b1LiveRows: Record<string, number> }> = {};
  const cases: Array<Record<string, unknown>> = [];
  for (const [name, p] of Object.entries(suite.projects)) {
    const dir = path.join(SUITE, name);
    const layerModel = layerModelOf(p);
    const params = apg2Params(layerModel, { ...(p.allowedAsync !== undefined ? { allowedAsync: p.allowedAsync } : {}) });
    const v2 = await extract(dir, { ...V13_APG2_OPTIONS, components: componentsOf(p) });
    await ingest(repo, v2, layerModel);
    const { cmp, live } = await compareTemplates(repo, v2, layerModel, params);
    // b1: the same templates on the v1.3 graph, live.
    const v13 = await extract(dir, V13_DEFAULT_OPTIONS);
    await ingest(repo, v13, layerModel);
    const b1: Record<string, number> = {};
    const b1Rows = new Map<string, Record<string, unknown>[]>();
    for (const t of APG2_TEMPLATES.keys()) {
      const rows = await runLive(repo, t, params, false);
      b1[t] = rows.length;
      b1Rows.set(t, rows);
    }
    projects[name] = { templates: cmp, b1LiveRows: b1 };
    for (const c of suite.cases.filter((x) => x.project === name)) {
      const ts = c.template === '*' ? [...APG2_TEMPLATES.keys()] : [c.template];
      const hits = ts.flatMap((t) => live.get(t) ?? []).filter((r) => rowMatches(r, c.match));
      const b1Hits = ts.flatMap((t) => b1Rows.get(t) ?? []).filter((r) => rowMatches(r, c.match));
      const prior = ablation.get(c.id);
      const detected = hits.length > 0;
      const pass = c.kind === 'planted' ? detected && b1Hits.length === 0 : !detected;
      cases.push({ id: c.id, project: name, kind: c.kind, template: c.template, liveDetected: detected, liveRows: hits.length,
        liveB1: b1Hits.length > 0, mirrorDetected: prior?.apg2 ?? null, mirrorRows: prior?.apg2Rows ?? null,
        agrees: prior !== undefined && prior.apg2 === detected && prior.apg2Rows === hits.length && prior.v13Graph === (b1Hits.length > 0), pass });
    }
    process.stdout.write(`${name}: ${cmp.map((x) => `${x.template}=${String(x.live)}/${String(x.mirror)}${x.multisetEqual ? '' : ' DIFF'}${x.orderEqual ? '' : ' (order)'}${x.excludeVariantEqual ? '' : ' EXCL-DIFF'}`).join(', ')}; b1 rows ${String(Object.values(b1).reduce((a, b) => a + b, 0))}\n`);
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'fixtures-live.json'), JSON.stringify({ projects, cases }, null, 2) + '\n');
  const bad = Object.values(projects).flatMap((x) => x.templates).filter((x) => !x.multisetEqual || !x.excludeVariantEqual);
  const caseBad = cases.filter((c) => c.agrees !== true || c.pass !== true);
  process.stdout.write(`templates compared: ${String(Object.values(projects).flatMap((x) => x.templates).length)}, disagreements: ${String(bad.length)}; cases: ${String(cases.length)}, not agreeing or failing: ${caseBad.map((c) => String(c.id)).join(', ') || 'none'}\n`);
  return bad.length === 0 && caseBad.length === 0 ? 0 : 1;
}

// ── Mode: reference ──────────────────────────────────────────────────────────
interface V13Finding { readonly ruleId: string; readonly file: string; readonly target?: string; readonly message?: string }

async function v13Findings(repo: Neo4jRepository, spec: ParsedSpec, apg: APGResult, projectDir: string): Promise<V13Finding[]> {
  const compiled = compileFunctions(compilerInputFromSpec(spec), V13_COMPILE_OPTIONS);
  if (!compiled.success) throw new Error(`compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
  const r = await evaluateSymbolic({ queries: compiled.data.symbolicQueries, graphRepository: repo, knownSecrets: [], apg });
  if (!r.success) throw new Error(`evaluate: ${r.errors.map((e) => e.message).join('; ')}`);
  if (r.data.failures.length > 0) throw new Error(`evaluate failures: ${r.data.failures.map((f) => `${String(f.functionId)} ${f.message}`).join('; ')}`);
  return r.data.results.flatMap((res) => res.violations.map((v) => {
    const target = normaliseFindingPath(v.target ?? '', projectDir);
    return { ruleId: String(v.functionId), file: normaliseFindingPath(v.filePath, projectDir), ...(target !== '' ? { target } : {}), message: v.message };
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

async function reference(repo: Neo4jRepository, out: string): Promise<number> {
  const refs = loadAllReferences(ROOT);
  const work = makeTempRoot('apg2-live-');
  const variants: Array<Record<string, unknown>> = [];
  let problems = 0;
  try {
    for (const ref of refs) {
      const parsed = await parseSpec({ specFilePath: ref.specPath });
      if (!parsed.success) throw new Error(`spec ${ref.specPath}: ${parsed.errors.map((e) => e.message).join('; ')}`);
      const spec = parsed.data;
      const excludePatterns = readSpecExcludePaths(ref.specPath);
      const components = componentsFromLayerModel(spec.layerModel);
      const params = apg2Params(spec.layerModel);
      for (const v of ref.variants) {
        const m = materialiseVariant(ref, v, work);
        const v2 = await extract(m.projectDir, { ...V13_APG2_OPTIONS, excludePatterns, components });
        await ingest(repo, v2, spec.layerModel);
        const { cmp, live } = await compareTemplates(repo, v2, spec.layerModel, params);
        const onV2 = await v13Findings(repo, spec, v2, m.projectDir);
        const v13 = await extract(m.projectDir, { ...V13_DEFAULT_OPTIONS, excludePatterns });
        await ingest(repo, v13, spec.layerModel);
        const onV13 = await v13Findings(repo, spec, v13, m.projectDir);
        const v13Equal = JSON.stringify(onV2) === JSON.stringify(onV13);
        const mirrorEqual = cmp.every((x) => x.multisetEqual && x.excludeVariantEqual);
        if (!v13Equal || !mirrorEqual) problems += 1;
        const apg2Rows = [...live].flatMap(([t, rows]) => rows.map((r) => ({ template: t, tier: APG2_TEMPLATE_TIERS.get(t)?.tier ?? 'advisory', ...r })));
        variants.push({ style: ref.style, variant: v.manifest.variant, kind: v.manifest.kind, plants: v.manifest.plants,
          description: v.manifest.description, expectedFindings: v.manifest.expectedFindings,
          mirrorEqual, mirrorDiffs: cmp.filter((x) => !x.multisetEqual || !x.excludeVariantEqual),
          v13Equal, v13Findings: onV2.map(({ message: _m, ...rest }) => rest), v13FindingsDefaultGraph: v13Equal ? 'equal' : onV13.map(({ message: _m, ...rest }) => rest),
          apg2Rows });
        process.stdout.write(`${ref.style}/${v.manifest.variant}: apg2 ${String(apg2Rows.length)} rows, v1.3 ${String(onV2.length)} rows${v13Equal ? '' : ' V13-DIFF'}${mirrorEqual ? '' : ' MIRROR-DIFF'}\n`);
      }
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'reference-live.json'), JSON.stringify(variants, null, 2) + '\n');
  process.stdout.write(`variants: ${String(variants.length)}, with a problem: ${String(problems)}\n`);
  return problems === 0 ? 0 : 1;
}

async function main(argv: readonly string[]): Promise<number> {
  const mode = argv[0];
  const outIdx = argv.indexOf('--out');
  const out = path.resolve(ROOT, outIdx >= 0 ? argv[outIdx + 1] ?? '' : 'Docs/DiagnosticRuns/apg2-live-2026-10-15');
  if (mode !== 'fixtures' && mode !== 'reference') {
    process.stderr.write('usage: apg2-live.ts fixtures|reference [--out <dir>]\n');
    return 2;
  }
  const uri = process.env.NEO4J_URI ?? '';
  const password = process.env.NEO4J_PASSWORD ?? '';
  if (uri === '' || password === '') {
    process.stderr.write('needs NEO4J_URI and NEO4J_PASSWORD\n');
    return 2;
  }
  const lock = await acquireNeo4jLock(uri, { label: `apg2-live ${mode}`, onWait: (t) => process.stderr.write(`${t}\n`) });
  const repo = new Neo4jRepository({ neo4jUri: uri, neo4jUser: process.env.NEO4J_USER ?? 'neo4j', neo4jPassword: password });
  try {
    return mode === 'fixtures' ? await fixtures(repo, out) : await reference(repo, out);
  } finally {
    await repo.close();
    lock.release();
  }
}

void main(process.argv.slice(2)).then(
  (c) => { process.exitCode = c; },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [process.env.NEO4J_PASSWORD ?? ''].filter((s) => s !== ''))}\n`);
    process.exitCode = 2;
  },
);
