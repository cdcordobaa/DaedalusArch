/**
 * The APG v2 hand mirrors (`src/fitness-compiler/apg2-in-memory.ts`, `APG2_IN_MEMORY`) against the interpreter running
 * the template text, on the same APG v2 graphs (Docs/v1.3/cypher-interpreter.md §7). No Neo4j: both sides are in
 * process. Entry file: no exports.
 *
 * Projects: the 71 reference variants and the APG v2 fixture suite, extracted with `V13_APG2_OPTIONS` as
 * `scripts/v1.3/apg2-live.ts` does. Rows are compared as apg2-live compares the mirrors with Neo4j: integers as
 * numbers, multiset and order. Timing: the mirror (graph build + every template) against the interpreter (ingestion
 * + every template).
 * Usage: node --import tsx scripts/v1.3/cypher-interp-mirrors.ts [--out <dir>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import neo4j from 'neo4j-driver';
import { extractAPG, V13_APG2_OPTIONS, componentsFromLayerModel } from '../../src/apg-extractor/index.js';
import type { ComponentDeclaration } from '../../src/apg-extractor/index.js';
import { APG2_TEMPLATES } from '../../src/fitness-compiler/apg2-templates.js';
import { APG2_IN_MEMORY, apg2Params, memGraph } from '../../src/fitness-compiler/apg2-in-memory.js';
import type { Apg2Params, Row } from '../../src/fitness-compiler/apg2-in-memory.js';
import { instantiateTemplate } from '../../src/fitness-compiler/index.js';
import { ingestAPG } from '../../src/neo4j-ingestion/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { parseSpec, readSpecExcludePaths } from '../../src/spec-parser/index.js';
import type { LayerModel } from '../../src/shared/types/spec.js';
import type { SnapshotStore } from '../../src/shared/interfaces/snapshot-store.js';
import { makeTempRoot } from './lib/materialise.js';
import { apg2FixtureProjects, referenceProjects } from './lib/memory-projects.js';

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const outDir = path.resolve(outIdx >= 0 ? argv[outIdx + 1] ?? '' : 'results/v1.3-cypher-interp/mirrors');
const nullStore = {} as SnapshotStore;

function plain(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (neo4j.isInt(v)) return (v as { toNumber(): number }).toNumber();
  if (Array.isArray(v)) return v.map(plain);
  return v;
}
const plainRow = (r: Row): string => JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v)])));

/** As apg2-live's `cypherParams`: every parameter a template names, null for an unbound layer. */
function cypherParams(p: Apg2Params): Record<string, unknown> {
  return {
    domainLayer: p.domainLayer ?? null, infraLayer: p.infraLayer ?? null, controllerLayer: p.controllerLayer ?? null,
    applicationLayers: [...p.applicationLayers], threshold: p.threshold, allowedAsync: [...p.allowedAsync],
    compositionRootLayers: [...p.compositionRootLayers], compositionRootPatterns: [...p.compositionRootPatterns],
    testPatterns: [...p.testPatterns], aclPatterns: [...p.aclPatterns], minTypes: p.minTypes,
  };
}

interface Result { project: string; template: string; mirrorRows: number; interpRows: number; multisetEqual: boolean; orderEqual: boolean }

async function compare(project: string, dir: string, layerModel: LayerModel, components: ComponentDeclaration[], excludePatterns: string[], p: Apg2Params, results: Result[], timing: { mirrorMs: number; interpMs: number }): Promise<void> {
  const apg = await extractAPG(dir, { ...V13_APG2_OPTIONS, excludePatterns, components });
  if (!apg.success) throw new Error(`${project}: extract failed`);
  const t0 = performance.now();
  const g = memGraph(apg.data, layerModel);
  const mirror = new Map([...APG2_IN_MEMORY].map(([name, fn]) => [name, fn(g, p).map(plainRow)]));
  const t1 = performance.now();
  const repo = new MemoryGraphRepository();
  const ing = await ingestAPG({ apgResult: apg.data, layerModel, mode: 'stateless' }, repo, nullStore);
  if (!ing.success) throw new Error(`${project}: ingest failed`);
  const interp = new Map<string, string[]>();
  const params = cypherParams(p);
  for (const name of APG2_IN_MEMORY.keys()) {
    const tpl = APG2_TEMPLATES.get(name);
    if (tpl === undefined) throw new Error(`no template ${name}`);
    const r = await repo.executeQuery(instantiateTemplate(tpl, params), params);
    if (!r.success) throw new Error(`${project} ${name}: ${r.errors.map((e) => e.message).join('; ')}`);
    interp.set(name, r.data.records.map(plainRow));
  }
  const t2 = performance.now();
  timing.mirrorMs += t1 - t0;
  timing.interpMs += t2 - t1;
  for (const [name, m] of mirror) {
    const i = interp.get(name) ?? [];
    results.push({
      project, template: name, mirrorRows: m.length, interpRows: i.length,
      multisetEqual: JSON.stringify([...m].sort()) === JSON.stringify([...i].sort()), orderEqual: JSON.stringify(m) === JSON.stringify(i),
    });
  }
}

async function main(): Promise<number> {
  const results: Result[] = [];
  const timing = { mirrorMs: 0, interpMs: 0 };
  const work = makeTempRoot('cypher-interp-mirrors-');
  try {
    for (const proj of referenceProjects(process.cwd())) {
      const parsed = await parseSpec({ specFilePath: proj.specPath });
      if (!parsed.success) throw new Error(`spec ${proj.specPath}`);
      const lm = parsed.data.layerModel;
      await compare(proj.id, proj.materialise(work), lm, componentsFromLayerModel(lm), readSpecExcludePaths(proj.specPath), apg2Params(lm), results, timing);
    }
    for (const f of apg2FixtureProjects(process.cwd())) {
      await compare(f.id, f.dir, f.layerModel, f.components, [], apg2Params(f.layerModel, { allowedAsync: f.allowedAsync }), results, timing);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  const byTemplate = [...APG2_IN_MEMORY.keys()].map((t) => {
    const rs = results.filter((r) => r.template === t);
    return { template: t, projects: rs.length, rows: rs.reduce((s, r) => s + r.mirrorRows, 0), multisetEqual: rs.filter((r) => r.multisetEqual).length, orderEqual: rs.filter((r) => r.orderEqual).length };
  });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'mirrors.json'), JSON.stringify({ timing, byTemplate, differences: results.filter((r) => !r.multisetEqual) }, null, 1) + '\n');
  for (const b of byTemplate) process.stdout.write(`${b.template}: ${String(b.projects)} projects, ${String(b.rows)} mirror rows, multiset equal ${String(b.multisetEqual)}, order equal ${String(b.orderEqual)}\n`);
  process.stdout.write(`timing: mirror ${timing.mirrorMs.toFixed(0)} ms, interpreter ${timing.interpMs.toFixed(0)} ms\n`);
  return results.every((r) => r.multisetEqual) ? 0 : 1;
}

void main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; });
