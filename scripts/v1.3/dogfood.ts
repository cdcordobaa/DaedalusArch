/**
 * Dogfood harness (`Docs/v1.3/dogfood.md`): DaedalusArch run on its own `src/`. No Neo4j, no LLM.
 *
 * Mode `infer`: ISE spec inference (`daedalus init`-style, the code behind the MCP `infer_spec` tool) on a snapshot of
 * this repository's `src/` and `tsconfig.json`. Writes the inferred spec, the classification, the unit mapping and the
 * Option 1 majority-vote rule candidates (rule mining). Run before reading any evaluation result of the declared spec.
 *
 * Mode `apg2`: the declared spec's layer model over the APG extracted with `V13_APG2_OPTIONS`, ingested into the
 * in-process Cypher interpreter (`MemoryGraphRepository`, the `--engine cypher-interp` engine). Runs every APG v2
 * template text (`instantiateTemplate`, `apg2Params`) on the interpreter and checks it against its in-memory mirror,
 * then the cheap proxies (`extractAndEnrich`, batch-2 proxy flags and the cheap2 template mirrors). Components: one
 * `layer` component per layer and one `module` component per module folder, with `<module>/index.ts` as the declared
 * public API when it exists (see `specs/dogfood/RATIONALE.md`).
 *
 * Usage (repository root):
 *   node --import tsx scripts/v1.3/dogfood.ts infer [--out <dir>]
 *   node --import tsx scripts/v1.3/dogfood.ts apg2  [--spec specs/dogfood/daedalus-self.yaml] [--suffix <s>] [--out <dir>]
 * Default out: Docs/DiagnosticRuns/dogfood-2026-10-16.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import neo4j from 'neo4j-driver';
import { inferSpec, snapshotSource } from '../../src/ise/index.js';
import { extractAPG, V13_APG2_OPTIONS, componentsFromLayerModel } from '../../src/apg-extractor/index.js';
import type { ComponentDeclaration } from '../../src/apg-extractor/index.js';
import { APG2_TEMPLATES, APG2_TEMPLATE_TIERS } from '../../src/fitness-compiler/apg2-templates.js';
import { APG2_IN_MEMORY, apg2Params, memGraph } from '../../src/fitness-compiler/apg2-in-memory.js';
import type { Apg2Params, Row } from '../../src/fitness-compiler/apg2-in-memory.js';
import { CHEAP2_IN_MEMORY } from '../../src/fitness-compiler/cheap2-in-memory.js';
import { CHEAP2_TEMPLATE_TIERS } from '../../src/fitness-compiler/cheap2-templates.js';
import { instantiateTemplate } from '../../src/fitness-compiler/index.js';
import { CONTEXT_PROXY_IDS, extractAndEnrich } from '../../src/apg-enrich/cheap/index.js';
import { ingestAPG } from '../../src/neo4j-ingestion/index.js';
import { MemoryGraphRepository } from '../../src/cypher-interp/repository.js';
import { parseSpec, readSpecExcludePaths } from '../../src/spec-parser/index.js';
import type { SnapshotStore } from '../../src/shared/interfaces/snapshot-store.js';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const mode = argv[0];
const arg = (name: string, fallback: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? fallback : fallback;
};
const OUT = path.resolve(arg('--out', 'Docs/DiagnosticRuns/dogfood-2026-10-16'));
const SPEC = arg('--spec', 'specs/dogfood/daedalus-self.yaml');
/** Output file suffix, so the declared and the revised spec runs sit side by side. */
const SUFFIX = arg('--suffix', '');

function plain(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (neo4j.isInt(v)) return (v as { toNumber(): number }).toNumber();
  if (Array.isArray(v)) return v.map(plain);
  return v;
}
const plainRow = (r: Row): Record<string, unknown> => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v)]));

function write(name: string, data: unknown): void {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), typeof data === 'string' ? data : `${JSON.stringify(data, null, 1)}\n`);
}

async function infer(): Promise<number> {
  const snap = snapshotSource(ROOT);
  try {
    const inf = await inferSpec(snap.dir, { presetsDir: path.join(ROOT, 'presets') });
    write('ise-inferred-spec.yaml', inf.specYaml);
    write('ise-inference.json', {
      style: inf.style,
      ranked: inf.classification.ranked,
      mapping: { mode: inf.mapping.mode, units: inf.mapping.units },
      check: inf.check,
      majorityVote: inf.majorityVote,
    });
    process.stdout.write(`style ${inf.style}; ranked ${inf.classification.ranked.map((r) => `${r.style} ${r.confidence.toFixed(2)}`).join(', ')}\n`);
    process.stdout.write(`units: ${inf.mapping.units.map((u) => `${u.unit}=${u.layer ?? '-'}`).join(', ')}\n`);
    process.stdout.write(`spec check: ${inf.check.valid ? 'valid' : `invalid: ${inf.check.errors.join('; ')}`}\n`);
    process.stdout.write(`majority-vote candidates: ${String(inf.majorityVote.length)} (${String(inf.majorityVote.filter((c) => c.applies).length)} apply)\n`);
    return 0;
  } finally {
    snap.dispose();
  }
}

/**
 * `src/<module>/` folders, as `module` components with their `index.ts` as the declared public API. `shared` (the
 * kernel, whose sub-barrels are its API) declares none. Module components are declared BEFORE the layer components:
 * the extractor gives each import edge one DEEP_IMPORT, for the first component kind that sees it.
 */
function moduleComponents(): ComponentDeclaration[] {
  return fs.readdirSync(path.join(ROOT, 'src'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const index = `src/${name}/index.ts`;
      return { name: `mod:${name}`, kind: 'module' as const, include: [`src/${name}/**`], ...(name !== 'shared' && fs.existsSync(path.join(ROOT, index)) ? { publicApi: [index] } : {}) };
    });
}

function cypherParams(p: Apg2Params): Record<string, unknown> {
  return {
    domainLayer: p.domainLayer ?? null, infraLayer: p.infraLayer ?? null, controllerLayer: p.controllerLayer ?? null,
    applicationLayers: [...p.applicationLayers], threshold: p.threshold, allowedAsync: [...p.allowedAsync],
    compositionRootLayers: [...p.compositionRootLayers], compositionRootPatterns: [...p.compositionRootPatterns],
    testPatterns: [...p.testPatterns], aclPatterns: [...p.aclPatterns], minTypes: p.minTypes,
  };
}

async function apg2(): Promise<number> {
  const parsed = await parseSpec({ specFilePath: SPEC });
  if (!parsed.success) throw new Error(`spec ${SPEC}: ${JSON.stringify(parsed.errors)}`);
  const lm = parsed.data.layerModel;
  const components = [...moduleComponents(), ...componentsFromLayerModel(lm)];
  // The spec's extraction excludes, as the pipeline applies them.
  const excludePatterns = readSpecExcludePaths(SPEC);
  const t0 = performance.now();
  const apg = await extractAPG(ROOT, { ...V13_APG2_OPTIONS, components, excludePatterns });
  if (!apg.success) throw new Error(`extract failed: ${JSON.stringify(apg.errors)}`);
  const t1 = performance.now();
  const repo = new MemoryGraphRepository();
  const ing = await ingestAPG({ apgResult: apg.data, layerModel: lm, mode: 'stateless' }, repo, {} as SnapshotStore);
  if (!ing.success) throw new Error(`ingest failed: ${JSON.stringify(ing.errors)}`);
  const p = apg2Params(lm);
  const params = cypherParams(p);
  const g = memGraph(apg.data, lm);
  const templates: Record<string, { tier: string; rows: Record<string, unknown>[]; mirrorRows: number; mirrorAgrees: boolean }> = {};
  for (const [name, tpl] of APG2_TEMPLATES) {
    const r = await repo.executeQuery(instantiateTemplate(tpl, params), params);
    if (!r.success) throw new Error(`${name}: ${r.errors.map((e) => e.message).join('; ')}`);
    const rows = r.data.records.map(plainRow);
    const mirror = (APG2_IN_MEMORY.get(name)?.(g, p) ?? []).map(plainRow);
    const key = (xs: Record<string, unknown>[]): string => JSON.stringify(xs.map((x) => JSON.stringify(x)).sort());
    templates[name] = { tier: APG2_TEMPLATE_TIERS.get(name)?.tier ?? '?', rows, mirrorRows: mirror.length, mirrorAgrees: key(rows) === key(mirror) };
  }
  const t2 = performance.now();

  // Cheap proxies over the same project and layer model.
  // Batch 1 and batch 2; co-change reads this repository's own history.
  const cheap = await extractAndEnrich(ROOT, { layerModel: lm, extractorOptions: { excludePatterns }, options: { proxies: CONTEXT_PROXY_IDS, coChangeHistory: 'own' } });
  const t3 = performance.now();
  const cheapFlags = cheap.enrichment.flags;
  const cheapTemplates: Record<string, { tier: string; rows: number; sample: unknown[] }> = {};
  for (const [name, fn] of CHEAP2_IN_MEMORY) {
    const rows = fn(memGraph(cheap.apg, lm), cheap.enrichment, p);
    cheapTemplates[name] = { tier: CHEAP2_TEMPLATE_TIERS.get(name)?.tier ?? '?', rows: rows.length, sample: rows.slice(0, 40) };
  }

  const byProxy = new Map<string, number>();
  for (const f of cheapFlags) byProxy.set(`${f.proxy}/${f.kind}`, (byProxy.get(`${f.proxy}/${f.kind}`) ?? 0) + 1);
  write(`apg2-results${SUFFIX}.json`, {
    spec: SPEC, params, apg2Stats: apg.data.apg2 ?? null,
    nodes: apg.data.nodes.length, edges: apg.data.edges.length,
    timingMs: { extract: Math.round(t1 - t0), ingestAndTemplates: Math.round(t2 - t1), cheap: Math.round(t3 - t2) },
    templates,
  });
  // Clone and shared-literal flags number in the tens of thousands: kept as counts per module pair, not listed.
  const bulky = new Set(['clones', 'shared-literals']);
  const moduleOf = (f: string | undefined): string => f?.split('/')[1] ?? '?';
  const bulkyByModules = new Map<string, number>();
  for (const f of cheapFlags.filter((x) => bulky.has(x.proxy))) {
    const k = `${f.proxy}/${f.kind}: ${moduleOf(f.evidence.file)} ~ ${moduleOf(f.related?.file)}`;
    bulkyByModules.set(k, (bulkyByModules.get(k) ?? 0) + 1);
  }
  write(`cheap-results${SUFFIX}.json`, {
    spec: SPEC, excludePatterns, flagsByProxy: Object.fromEntries([...byProxy].sort()),
    bulkyFlagsByModulePair: Object.fromEntries([...bulkyByModules].sort((a, b) => b[1] - a[1])),
    flags: cheapFlags.filter((x) => !bulky.has(x.proxy)), templates: cheapTemplates,
  });
  for (const [name, t] of Object.entries(templates)) {
    process.stdout.write(`apg2 ${name} [${t.tier}]: ${String(t.rows.length)} rows (mirror ${String(t.mirrorRows)}, ${t.mirrorAgrees ? 'agrees' : 'DIFFERS'})\n`);
  }
  for (const [proxy, n] of byProxy) process.stdout.write(`cheap flag ${proxy}: ${String(n)}\n`);
  for (const [name, t] of Object.entries(cheapTemplates)) process.stdout.write(`cheap2 ${name} [${t.tier}]: ${String(t.rows)} rows\n`);
  return Object.values(templates).every((t) => t.mirrorAgrees) ? 0 : 1;
}

const run = mode === 'infer' ? infer : mode === 'apg2' ? apg2 : undefined;
if (run === undefined) {
  process.stderr.write('usage: dogfood.ts infer|apg2 [--spec <yaml>] [--out <dir>]\n');
  process.exitCode = 2;
} else {
  void run().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; });
}
