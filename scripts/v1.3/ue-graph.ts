/**
 * U-E baseline: the tool's own graph for every reference case (no Neo4j). Entry file: no exports.
 * For each of the 71 variants: materialise, `extractAPG` with the branch defaults (as `firewall evaluate` does),
 * keep the File-to-File IMPORTS / RE_EXPORTS edges, and assign layers with `annotateNodes` under the style's spec.
 *
 * Usage (repository root): npx tsx scripts/v1.3/ue-graph.ts --out results/v1.3-reference/baseline-pre-barrel
 * Writes <out>/graph/tool-graphs.json.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAPG } from '../../src/apg-extractor/index.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import { normaliseFindingPath } from './lib/compare.js';
import { assignLayers } from './lib/layer-assignment.js';
import { makeTempRoot, materialiseVariant } from './lib/materialise.js';
import { loadAllReferences } from './lib/reference-model.js';

interface ToolEdge { from: string; to: string; types: string[]; typeOnly: boolean; specifiers: string[] }

async function run(): Promise<void> {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--out');
  const out = path.resolve(oi >= 0 ? argv[oi + 1] ?? '' : 'results/v1.3-reference/baseline-pre-barrel');
  const refs = loadAllReferences(process.cwd());
  const work = makeTempRoot('v13-ue-graph-');
  const result: Record<string, Record<string, { files: { file: string; layer: string | null; matchMethod: string | null }[]; edges: ToolEdge[]; packages: { from: string; to: string }[] }>> = {};
  try {
    for (const ref of refs) {
      const parsed = await parseSpec({ specFilePath: ref.specPath });
      if (!parsed.success) throw new Error(`${ref.style}: spec does not parse`);
      const model = parsed.data.layerModel;
      const excludes = specExcludePathsFromYaml(fs.readFileSync(ref.specPath, 'utf8'));
      const perStyle: (typeof result)[string] = {};
      result[ref.style] = perStyle;
      for (const v of ref.variants) {
        const m = materialiseVariant(ref, v, work);
        const root = fs.realpathSync(m.projectDir);
        const res = await extractAPG(root, { excludePatterns: excludes }, path.join(root, 'tsconfig.json'));
        if (!res.success) throw new Error(`${ref.style}/${v.manifest.variant}: extraction failed: ${res.errors.map((e) => e.message).join('; ')}`);
        const apg = res.data;
        const rel = (p: string): string => normaliseFindingPath(normaliseFindingPath(p, root), m.projectDir);
        const fileById = new Map<string, string>();
        const pkgById = new Map<string, string>();
        for (const n of apg.nodes) {
          if (n.type === 'File') fileById.set(n.id, rel(n.filePath));
          else if (n.type === 'Package') pkgById.set(n.id, n.name);
        }
        const acc = new Map<string, ToolEdge>();
        const packages = new Map<string, { from: string; to: string }>();
        for (const e of apg.edges) {
          if (e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') continue;
          const s = fileById.get(e.sourceId);
          if (s === undefined) continue;
          const t = fileById.get(e.targetId);
          if (t === undefined) {
            const pkg = pkgById.get(e.targetId);
            if (pkg !== undefined) packages.set(`${s}|${pkg}`, { from: s, to: pkg });
            continue;
          }
          const k = `${s}|${t}`;
          let a = acc.get(k);
          if (a === undefined) {
            a = { from: s, to: t, types: [], typeOnly: true, specifiers: [] };
            acc.set(k, a);
          }
          if (!a.types.includes(e.type)) a.types.push(e.type);
          const p = e.properties as Record<string, unknown>;
          const specs = Array.isArray(p.specifiers) ? (p.specifiers as string[]) : typeof p.specifier === 'string' ? [p.specifier] : [];
          for (const sp of specs) if (!a.specifiers.includes(sp)) a.specifiers.push(sp);
          a.typeOnly = a.typeOnly && p.isTypeOnly === true;
        }
        const files = [...fileById.values()].sort();
        const la = assignLayers(files, model);
        perStyle[v.manifest.variant] = {
          files: la.assignments.map((x) => ({ file: x.file, layer: x.layer, matchMethod: x.matchMethod })),
          edges: [...acc.values()].sort((x, y) => (x.from + x.to < y.from + y.to ? -1 : 1)),
          packages: [...packages.values()],
        };
        process.stdout.write(`${ref.style}/${v.manifest.variant}: ${String(files.length)} files, ${String(acc.size)} file edges\n`);
      }
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  const file = path.join(out, 'graph', 'tool-graphs.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(result, null, 1) + '\n');
}

void run().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
});
