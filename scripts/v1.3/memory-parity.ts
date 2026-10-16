/**
 * Differential parity of an in-process graph engine against live Neo4j (Docs/v1.3/cypher-interpreter.md §4).
 * Entry file: no exports.
 *
 * For every project (the 71 reference variants, then the APG v2 fixture suite, then one synthetic APG):
 * 1. Pipeline arms: the real pipeline (extract → ingest → compile → symbolic evaluation → scoring) runs in process
 *    with a `ParityTee` repository, once per arm:
 *    - `v1.3`: the CLI defaults (`--scoring v1.3 --instrument v2`, the v1.3 extractor and compile options);
 *    - `v1.2e`: the registered Study 1 instrument (`--scoring v1.2e --instrument v1`).
 *    Every statement the pipeline issues (ingestion writes, verification counts, compiled templates, universal
 *    metrics) goes to Neo4j and to the engine; the pipeline continues on Neo4j's answer.
 * 2. Catalogue sweep: every catalogue template (CYPHER_TEMPLATES + the v1.3 extension catalogues) in each of the texts
 *    the compiler can emit (exclude marker off/on × v1.2E text / v1.3 rewrites), with parameters from the project's
 *    spec plus two permissive bindings (`low`, `high`) that make the threshold and naming rules return rows, on the
 *    v1.3 graph; then on the APG v2 graph of the same project (APG v2 extractor options). Each sweep also runs the
 *    judge's graph-view queries and both universal-metric sets.
 * Each statement is classed equal | order | content | error | unsupported | both-error (lib/memory-sweep.ts).
 *
 * Usage (repository root, Neo4j env loaded; the run holds the cross-process Neo4j lock):
 *   node --import tsx scripts/v1.3/memory-parity.ts --engine cypher-interp --out <dir> [--only <substring>] [--no-sweep]
 * Writes <out>/parity-nonequal.json (every statement not `equal`; `--full` adds parity.json with every statement),
 * <out>/parity-by-template.json (classes per template, timings per project and phase) and <out>/parity.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Neo4jRepository } from '../../src/neo4j-ingestion/neo4j-repository.js';
import { ingestAPG } from '../../src/neo4j-ingestion/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';
import { CYPHER_TEMPLATES } from '../../src/fitness-compiler/cypher-templates.js';
import { V13_EXTENSION_TEMPLATE_CATALOGUES } from '../../src/fitness-compiler/extension-templates.js';
import { UNIVERSAL_METRIC_QUERIES, UNIVERSAL_METRIC_QUERIES_LITERAL } from '../../src/scoring-engine/universal-metrics.js';
import { JUDGE_GRAPH_QUERIES } from '../../src/llm-critic/judge-graph.js';
import { extractAPG, V13_APG2_OPTIONS, componentsFromLayerModel } from '../../src/apg-extractor/index.js';
import { APG2_IN_MEMORY, apg2Params, memGraph } from '../../src/fitness-compiler/apg2-in-memory.js';
import type { Apg2Params } from '../../src/fitness-compiler/apg2-in-memory.js';
import { parseSpec, readSpecExcludePaths } from '../../src/spec-parser/index.js';
import type { LayerModel } from '../../src/shared/types/spec.js';
import type { CypherTemplate } from '../../src/fitness-compiler/types.js';
import type { SnapshotStore } from '../../src/shared/interfaces/snapshot-store.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { makeTempRoot } from './lib/materialise.js';
import { apg2FixtureProjects, referenceProjects, syntheticProject } from './lib/memory-projects.js';
import { ParityTee, sweepTexts } from './lib/memory-sweep.js';
import { permissive, statementParams, sweepParams } from './lib/memory-bindings.js';
import type { ParityClass, ParityEntry } from './lib/memory-sweep.js';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const engine = opt('--engine') ?? 'cypher-interp';
const outDir = path.resolve(opt('--out') ?? 'results/v1.3-cypher-interp/parity');
const only = opt('--only');
const sweep = !argv.includes('--no-sweep');
const env = process.env;
const secrets = [env.NEO4J_PASSWORD ?? ''].filter((s) => s !== '');
const ROOT = process.cwd();
const nullStore = {} as SnapshotStore; // stateless ingestion never touches the store

if (engine !== 'cypher-interp') {
  process.stderr.write(`--engine ${engine}: only cypher-interp is available on this branch (I2's hand-mirror engine \`memory\` was not found)\n`);
  process.exit(2);
}
if ((env.NEO4J_URI ?? '') === '' || (env.NEO4J_PASSWORD ?? '') === '') {
  process.stderr.write('memory-parity needs live Neo4j: set NEO4J_URI and NEO4J_PASSWORD\n');
  process.exit(2);
}

const ARMS = [
  { arm: 'v1.3', scoringMode: 'v1.3', instrumentVersion: 2 },
  { arm: 'v1.2e', scoringMode: 'v1.2e', instrumentVersion: 1 },
] as const;

const ALL_TEMPLATES: [string, CypherTemplate][] = [
  ...[...CYPHER_TEMPLATES].map(([k, t]): [string, CypherTemplate] => [k, t]),
  ...[...V13_EXTENSION_TEMPLATE_CATALOGUES.values()].flatMap((m) => [...m].map(([k, t]): [string, CypherTemplate] => [k, t])),
];

// A literal-view text identical to its frozen one (abstractionRatio) keeps the frozen label.
const FIXED_LABELS = new Map<string, string>([
  ...Object.entries(UNIVERSAL_METRIC_QUERIES_LITERAL).map(([k, q]): [string, string] => [q, `universal-literal:${k}`]),
  ...Object.entries(UNIVERSAL_METRIC_QUERIES).map(([k, q]): [string, string] => [q, `universal:${k}`]),
  ...Object.entries(JUDGE_GRAPH_QUERIES).map(([k, q]): [string, string] => [q, `judge-graph:${k}`]),
  ['MATCH (n:APGNode) RETURN count(n) AS cnt', 'ingest-verify'],
  ['MATCH ()-[r]->() RETURN count(r) AS cnt', 'ingest-verify'],
  ['MATCH (n:APGNode) RETURN n.type AS type, count(*) AS cnt', 'ingest-verify'],
  ['MATCH ()-[r]->() RETURN type(r) AS type, count(*) AS cnt', 'ingest-verify'],
]);

async function runSweep(tee: ParityTee, cand: MemoryGraphRepository, phase: string, params: Record<string, unknown>, templates: readonly [string, CypherTemplate][]): Promise<void> {
  tee.phase = phase;
  for (const [name, t] of templates) {
    for (const { variant, text, excludes } of sweepTexts(t)) {
      const p = statementParams(text, params);
      void excludes;
      const before = tee.entries.length;
      await tee.executeQuery(text, p);
      const e = tee.entries[before];
      if (e !== undefined) e.label = `${name} [${variant}]`;
    }
  }
  // The judge's graph view (full and neuronal modes read it through the same repository) and the universal metrics.
  for (const q of [...Object.values(JUDGE_GRAPH_QUERIES), ...Object.values(UNIVERSAL_METRIC_QUERIES), ...Object.values(UNIVERSAL_METRIC_QUERIES_LITERAL)]) {
    const before = tee.entries.length;
    await tee.executeQuery(q, {});
    const e = tee.entries[before];
    if (e !== undefined) e.label = FIXED_LABELS.get(q) ?? 'other';
  }
  void cand;
}

interface Timing { project: string; phase: string; neo4jMs: number; interpMs: number; mirrorMs?: number; statements: number }

async function main(): Promise<number> {
  const neo = new Neo4jRepository({ neo4jUri: env.NEO4J_URI ?? '', neo4jUser: env.NEO4J_USER ?? 'neo4j', neo4jPassword: env.NEO4J_PASSWORD ?? '' });
  const lock = await acquireNeo4jLock(env.NEO4J_URI ?? '', { label: 'memory-parity', env, onWait: (t) => process.stderr.write(`${t}\n`) });
  const work = makeTempRoot('cypher-interp-parity-');
  const timings: Timing[] = [];
  const entries: ParityEntry[] = [];
  const filter = only === undefined ? undefined : (id: string): boolean => id.includes(only);
  try {
    for (const proj of referenceProjects(ROOT, filter)) {
      const projectDir = proj.materialise(work);
      const parsed = await parseSpec({ specFilePath: proj.specPath });
      if (!parsed.success) throw new Error(`spec ${proj.specPath}: ${parsed.errors.map((e) => e.message).join('; ')}`);
      const spec = parsed.data;
      let compiledParams = new Map<string, Record<string, unknown>>();
      const cand = new MemoryGraphRepository();
      const tee = new ParityTee(neo, cand);
      tee.project = proj.id;
      for (const a of ARMS) {
        tee.phase = `arm:${a.arm}`;
        const config: PipelineConfig = {
          projectPath: projectDir, specFilePath: proj.specPath, neo4jUri: env.NEO4J_URI ?? '', neo4jUser: env.NEO4J_USER ?? 'neo4j',
          neo4jPassword: env.NEO4J_PASSWORD ?? '', evaluationMode: 'symbolic-only', pipelineMode: 'stateless', persist: false, diff: false,
          verbose: false, apgStorePath: path.join(work, '.apg-store'), scoringMode: a.scoringMode, instrumentVersion: a.instrumentVersion,
          graphRepository: tee,
        };
        const { executor, context } = createPipeline(config);
        const start = tee.entries.length;
        const result = await executor.execute();
        if (!result.success) throw new Error(`${proj.id} ${a.arm}: ${result.errors.map((e) => e.message).join('; ')}`);
        const compiled = context.getCompiledFunctions();
        const byText = new Map(compiled.symbolicQueries.map((q) => [q.cypher, q.name]));
        if (a.arm === 'v1.3') compiledParams = new Map(compiled.symbolicQueries.map((q) => [q.name, { ...q.params }]));
        for (const e of tee.entries.slice(start)) if (e.label === '?') e.label = byText.get(e.cypher) ?? FIXED_LABELS.get(e.cypher) ?? 'other';
      }
      if (sweep) {
        const filePaths = cand.graph.nodesWithLabel('File').map((n) => String(n.properties.get('filePath') ?? ''));
        const a2 = apg2Params(spec.layerModel);
        const params = sweepParams(spec.layerModel, compiledParams, a2, filePaths);
        await runSweep(tee, cand, 'sweep:v1.3-graph', params, ALL_TEMPLATES);
        await runSweep(tee, cand, 'sweep:v1.3-graph:low', permissive(params, 'low'), ALL_TEMPLATES);
        await runSweep(tee, cand, 'sweep:v1.3-graph:high', permissive(params, 'high'), ALL_TEMPLATES);
        // The same project's APG v2 graph (as scripts/v1.3/apg2-live.ts reference mode).
        const excludePatterns = readSpecExcludePaths(proj.specPath);
        const v2 = await extractAPG(projectDir, { ...V13_APG2_OPTIONS, excludePatterns, components: componentsFromLayerModel(spec.layerModel) });
        if (!v2.success) throw new Error(`${proj.id}: apg2 extract failed`);
        tee.phase = 'sweep:apg2-graph';
        const ing = await ingestAPG({ apgResult: v2.data, layerModel: spec.layerModel, mode: 'stateless' }, tee, nullStore);
        if (!ing.success) throw new Error(`${proj.id}: apg2 ingest failed`);
        for (const e of tee.entries) if (e.phase === 'sweep:apg2-graph' && e.label === '?') e.label = FIXED_LABELS.get(e.cypher) ?? 'other';
        await runSweep(tee, cand, 'sweep:apg2-graph', params, ALL_TEMPLATES);
        await runSweep(tee, cand, 'sweep:apg2-graph:low', permissive(params, 'low'), ALL_TEMPLATES);
        timings.push(mirrorTiming(proj.id, v2.data, spec.layerModel, a2, tee));
      }
      record(proj.id, tee, timings, entries);
    }
    if (only === undefined || 'apg2-fixture'.includes(only) || apg2FixtureProjects(ROOT, filter).length > 0) {
      for (const proj of apg2FixtureProjects(ROOT, filter)) {
        const cand = new MemoryGraphRepository();
        const tee = new ParityTee(neo, cand);
        tee.project = proj.id;
        tee.phase = 'sweep:apg2-graph';
        const v2 = await extractAPG(proj.dir, { ...V13_APG2_OPTIONS, components: proj.components });
        if (!v2.success) throw new Error(`${proj.id}: apg2 extract failed`);
        const ing = await ingestAPG({ apgResult: v2.data, layerModel: proj.layerModel, mode: 'stateless' }, tee, nullStore);
        if (!ing.success) throw new Error(`${proj.id}: apg2 ingest failed`);
        for (const e of tee.entries) if (e.label === '?') e.label = FIXED_LABELS.get(e.cypher) ?? 'other';
        const a2 = apg2Params(proj.layerModel, { allowedAsync: proj.allowedAsync });
        const filePaths = cand.graph.nodesWithLabel('File').map((n) => String(n.properties.get('filePath') ?? ''));
        const fparams = sweepParams(proj.layerModel, new Map(), a2, filePaths);
        await runSweep(tee, cand, 'sweep:apg2-graph', fparams, ALL_TEMPLATES);
        await runSweep(tee, cand, 'sweep:apg2-graph:low', permissive(fparams, 'low'), ALL_TEMPLATES);
        await runSweep(tee, cand, 'sweep:apg2-graph:high', permissive(fparams, 'high'), ALL_TEMPLATES);
        timings.push(mirrorTiming(proj.id, v2.data, proj.layerModel, a2, tee));
        record(proj.id, tee, timings, entries);
      }
    }
    const syn = syntheticProject();
    if (filter === undefined || filter(syn.id)) {
      const cand = new MemoryGraphRepository();
      const tee = new ParityTee(neo, cand);
      tee.project = syn.id;
      tee.phase = 'sweep:synthetic';
      const ing = await ingestAPG({ apgResult: syn.apg, layerModel: syn.layerModel, mode: 'stateless' }, tee, nullStore);
      if (!ing.success) throw new Error(`${syn.id}: ingest failed: ${ing.errors.map((e) => e.message).join('; ')}`);
      for (const e of tee.entries) if (e.label === '?') e.label = FIXED_LABELS.get(e.cypher) ?? 'other';
      const a2 = apg2Params(syn.layerModel);
      const filePaths = cand.graph.nodesWithLabel('File').map((n) => String(n.properties.get('filePath') ?? ''));
      const sparams = sweepParams(syn.layerModel, new Map(), a2, filePaths);
      await runSweep(tee, cand, 'sweep:synthetic', sparams, ALL_TEMPLATES);
      await runSweep(tee, cand, 'sweep:synthetic:low', permissive(sparams, 'low'), ALL_TEMPLATES);
      await runSweep(tee, cand, 'sweep:synthetic:high', permissive(sparams, 'high'), ALL_TEMPLATES);
      record(syn.id, tee, timings, entries);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    await neo.close();
    lock.release();
  }
  write(entries, timings);
  const bad = entries.filter((e) => e.klass === 'content' || e.klass === 'error' || e.klass === 'unsupported');
  process.stdout.write(`statements: ${String(entries.length)}, not equal-or-order: ${String(bad.length)}\n`);
  return bad.length === 0 ? 0 : 1;
}

/** The APG v2 hand mirrors (`APG2_IN_MEMORY`) on the same graph, timed against the interpreter's runs of the same templates. */
function mirrorTiming(project: string, apg: Parameters<typeof memGraph>[0], layerModel: LayerModel, a2: Apg2Params, tee: ParityTee): Timing {
  const t0 = performance.now();
  const g = memGraph(apg, layerModel);
  for (const fn of APG2_IN_MEMORY.values()) fn(g, a2);
  const mirrorMs = performance.now() - t0;
  const runs = tee.entries.filter((e) => e.phase === 'sweep:apg2-graph' && APG2_IN_MEMORY.has(e.label.split(' ')[0] ?? '') && e.label.endsWith('[v1.2e]'));
  return {
    project, phase: 'apg2-templates (v1.2e text, one run each)', statements: runs.length,
    neo4jMs: runs.reduce((s, e) => s + e.refMs, 0), interpMs: runs.reduce((s, e) => s + e.candMs, 0), mirrorMs,
  };
}

function record(project: string, tee: ParityTee, timings: Timing[], entries: ParityEntry[]): void {
  const phases = [...new Set(tee.entries.map((e) => e.phase))];
  for (const phase of phases) {
    const es = tee.entries.filter((e) => e.phase === phase);
    timings.push({ project, phase, statements: es.length, neo4jMs: es.reduce((s, e) => s + e.refMs, 0), interpMs: es.reduce((s, e) => s + e.candMs, 0) });
  }
  entries.push(...tee.entries);
  const counts = countClasses(tee.entries);
  process.stdout.write(`${project}: ${Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${String(n)}`).join(', ')}\n`);
}

const CLASSES: readonly ParityClass[] = ['equal', 'order', 'content', 'error', 'unsupported', 'both-error'];

function countClasses(es: readonly ParityEntry[]): Record<ParityClass, number> {
  const c = Object.fromEntries(CLASSES.map((k) => [k, 0])) as Record<ParityClass, number>;
  for (const e of es) c[e.klass] += 1;
  return c;
}

function write(entries: readonly ParityEntry[], timings: readonly Timing[]): void {
  fs.mkdirSync(outDir, { recursive: true });
  const brief = (es: readonly ParityEntry[]): unknown[] => es.map((e) => ({ ...e, cypher: e.cypher.length > 400 ? `${e.cypher.slice(0, 400)}…` : e.cypher }));
  // Every statement (~16 MB for the full run) only with --full; the statements that are not `equal` always.
  if (argv.includes('--full')) fs.writeFileSync(path.join(outDir, 'parity.json'), JSON.stringify(brief(entries), null, 1) + '\n');
  fs.writeFileSync(path.join(outDir, 'parity-nonequal.json'), JSON.stringify(brief(entries.filter((e) => e.klass !== 'equal')), null, 1) + '\n');
  const byTemplate = new Map<string, ParityEntry[]>();
  for (const e of entries) {
    const key = e.label.replace(/ \[.*\]$/, '');
    let l = byTemplate.get(key);
    if (l === undefined) byTemplate.set(key, (l = []));
    l.push(e);
  }
  const rows = [...byTemplate].sort(([a], [b]) => a.localeCompare(b)).map(([label, es]) => ({
    template: label, statements: es.length, projects: new Set(es.map((e) => e.project)).size, ...countClasses(es),
    rowsNeo4j: es.reduce((s, e) => s + Math.max(0, e.refRows), 0),
    examples: es.filter((e) => e.klass !== 'equal' && e.klass !== 'order').slice(0, 3).map((e) => `${e.project} ${e.label}: ${e.detail ?? ''}`.slice(0, 600)),
  }));
  fs.writeFileSync(path.join(outDir, 'parity-by-template.json'), JSON.stringify({ rows, timings }, null, 1) + '\n');
  const total = countClasses(entries);
  const md: string[] = [
    '# cypher-interp parity against Neo4j 5.26.24 + APOC', '',
    `Statements: ${String(entries.length)} (${CLASSES.map((k) => `${k} ${String(total[k])}`).join(', ')}); projects: ${String(new Set(entries.map((e) => e.project)).size)}.`, '',
    '| template / query family | statements | projects | equal | order | content | error | unsupported | both-error | Neo4j rows |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...rows.map((r) => `| ${r.template} | ${String(r.statements)} | ${String(r.projects)} | ${String(r.equal)} | ${String(r.order)} | ${String(r.content)} | ${String(r.error)} | ${String(r.unsupported)} | ${String(r['both-error'])} | ${String(r.rowsNeo4j)} |`),
    '',
  ];
  const nonEqual = rows.filter((r) => r.examples.length > 0);
  if (nonEqual.length > 0) md.push('## Non-equal examples', '', ...nonEqual.flatMap((r) => r.examples.map((x) => `- ${x.replace(/\|/g, '\\|')}`)), '');
  fs.writeFileSync(path.join(outDir, 'parity.md'), md.join('\n'));
}

void main().then(
  (c) => { process.exitCode = c; },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.stack ?? e.message : String(e), secrets)}\n`);
    process.exitCode = 2;
  },
);
