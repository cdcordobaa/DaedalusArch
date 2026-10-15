// Presentation kit: extract the real APG of reference variants in memory (no Neo4j) and dump it as JSON.
// Usage (repo root): npx tsx extract.ts <outDir> style/variant[:apg2] ...
import * as fs from 'node:fs';
import * as path from 'node:path';
const REPO = process.cwd();
const imp = (p: string) => import(path.join(REPO, p));
async function main() {
  const { extractAPG, V13_DEFAULT_OPTIONS, V13_APG2_OPTIONS, componentsFromLayerModel } = await imp('src/apg-extractor/index.ts');
  const { parseSpec, specExcludePathsFromYaml } = await imp('src/spec-parser/index.ts');
  const { assignLayers } = await imp('scripts/v1.3/lib/layer-assignment.ts');
  const { makeTempRoot, materialiseVariant } = await imp('scripts/v1.3/lib/materialise.ts');
  const { loadAllReferences } = await imp('scripts/v1.3/lib/reference-model.ts');
  const { normaliseFindingPath } = await imp('scripts/v1.3/lib/compare.ts');
  const outDir = process.argv[2];
  const wanted = process.argv.slice(3);
  const refs = loadAllReferences(REPO);
  const work = makeTempRoot('kit-apg-');
  try {
    for (const w of wanted) {
      const [sv, mode] = w.split(':');
      const [style, variant] = sv.split('/');
      const ref = refs.find((r: any) => r.style === style);
      const v = ref.variants.find((x: any) => x.manifest.variant === variant);
      const parsed = await parseSpec({ specFilePath: ref.specPath });
      const model = parsed.data.layerModel;
      const excludes = specExcludePathsFromYaml(fs.readFileSync(ref.specPath, 'utf8'));
      const m = materialiseVariant(ref, v, work);
      const root = fs.realpathSync(m.projectDir);
      const opts = mode === 'apg2'
        ? { ...V13_APG2_OPTIONS, excludePatterns: excludes, components: componentsFromLayerModel(model) }
        : { ...V13_DEFAULT_OPTIONS, excludePatterns: excludes };
      const res = await extractAPG(root, opts, path.join(root, 'tsconfig.json'));
      if (!res.success) throw new Error('extract failed ' + w);
      const rel = (p: string) => (p ? normaliseFindingPath(normaliseFindingPath(p, root), m.projectDir) : p);
      const nodes = res.data.nodes.map((n: any) => ({ id: n.id, type: n.type, name: n.name, file: rel(n.filePath), properties: n.properties }));
      const files = nodes.filter((n: any) => n.type === 'File').map((n: any) => n.file);
      const la = assignLayers(files, model);
      const layerOf: Record<string, string | null> = {};
      for (const a of la.assignments) layerOf[a.file] = a.layer;
      for (const n of nodes) (n as any).layer = n.file ? layerOf[n.file] ?? null : null;
      const edges = res.data.edges.map((e: any) => ({ type: e.type, s: e.sourceId, t: e.targetId, properties: e.properties }));
      const out = { style, variant, mode: mode ?? 'v13', nodes, edges, apg2: res.data.apg2 ?? null };
      const f = path.join(outDir, `${style}__${variant}${mode ? '__' + mode : ''}.json`);
      fs.writeFileSync(f, JSON.stringify(out, null, 1));
      const cnt: Record<string, number> = {};
      for (const e of edges) cnt[e.type] = (cnt[e.type] ?? 0) + 1;
      const nc: Record<string, number> = {};
      for (const n of nodes) nc[n.type] = (nc[n.type] ?? 0) + 1;
      console.log(w, JSON.stringify(nc), JSON.stringify(cnt));
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
