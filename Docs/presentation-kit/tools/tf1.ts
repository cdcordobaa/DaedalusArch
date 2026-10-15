// Presentation kit: the boundary-type-leak rows on the type-flow fixture (in-memory mirror, as scripts/apg2-ablation.ts).
import * as fs from 'node:fs';
import * as path from 'node:path';
const REPO = process.cwd();
const imp = (p: string) => import(path.join(REPO, p));
async function main() {
  const { extractAPG, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS, componentsFromLayerModel } = await imp('src/apg-extractor/index.ts');
  const { apg2Params, memGraph, boundaryTypeLeak } = await imp('src/fitness-compiler/apg2-in-memory.ts');
  const cases = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/v1.3-apg2/cases.json'), 'utf8'));
  const proj = cases.projects['type-flow'];
  const layerModel = { layers: proj.layers.map((l: any) => ({ name: l.name, directories: l.directories, naming: [], role: '', kind: l.kind, kindSource: 'explicit' })) };
  const dir = path.join(REPO, 'tests/fixtures/v1.3-apg2/type-flow');
  const out: Record<string, unknown> = {};
  for (const [k, o] of [['apg2', { ...V13_APG2_OPTIONS, components: componentsFromLayerModel(layerModel) }], ['v13', V13_DEFAULT_OPTIONS]] as const) {
    const r = await extractAPG(dir, o, path.join(dir, 'tsconfig.json'));
    if (!r.success) throw new Error('extract');
    const rows = boundaryTypeLeak(memGraph(r.data, layerModel), apg2Params(layerModel));
    const rel = (p: unknown) => (typeof p === 'string' ? path.relative(dir, p) || p : p);
    out[k] = rows.map((x: any) => ({ ...x, filePath: rel(x.filePath), target: rel(x.target) }));
    const nodes = r.data.nodes.map((n: any) => ({ id: n.id, type: n.type, name: n.name, file: rel(n.filePath) }));
    const edges = r.data.edges.map((e: any) => ({ type: e.type, s: e.sourceId, t: e.targetId, properties: e.properties }));
    out[k + 'Graph'] = { nodes, edges };
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ apg2: out.apg2, v13: out.v13 }, null, 1));
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
