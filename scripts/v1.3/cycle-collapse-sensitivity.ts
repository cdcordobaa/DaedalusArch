/**
 * B2 (Docs/DiagnosticRuns/v1.3-jury-fixes-2026-10-16.md): barrel and long-cycle sensitivity of the external-set FF-S02
 * result (208 pooled cycle rows over the 35 external projects, 189 of them through an `index.ts` barrel). No
 * template, tier or default is changed; no Neo4j, no LLM. Entry file: no exports.
 *
 * Usage (repository root):
 *   node --max-old-space-size=8192 --import tsx scripts/v1.3/cycle-collapse-sensitivity.ts --findings <dir> --specs <dir>
 *     [--repos <dir>] [--out <file.json>]
 *   <dir> of findings: the `firewall evaluate` reports, results/v1.3-external{,-2}/findings/<id>.json (PRs #133, #181);
 *   <dir> of specs: results/v1.3-external{,-2}/specs/<id>.yaml; --repos: clones at the pinned SHAs (<repos>/<id>).
 *
 * Part 1, from the cycle rows alone. Every row is a closed file path. It is mapped to two coarser grains:
 *   - folder: the file's directory;
 *   - component: the spec layer the file's path matches (directory globs, then file patterns; the ingestion's
 *     `annotateNodes` on path-only File nodes, so decorator-only layering is not seen), else `~<top folder>`.
 * A row "survives" at a grain when its image visits at least two distinct units (it is then a cycle between units, not
 * a cycle inside one). The union of the rows' edges is collapsed and an unbounded SCC (Tarjan) is run on it.
 * Part 2, with --repos: the project's full file graph (the v1.3 extractor with the spec's exclude_paths, FF-S02's own
 * exclude patterns, File->File edges in FF-S02's LITERAL view: IMPORTS without viaReExport, plus RE_EXPORTS) and an
 * unbounded SCC at file, folder and component grain. `unionFileSccs` repeats the file grain on every IMPORTS|RE_EXPORTS
 * edge (both views), which is what scc-cycles.ts `buildFileGraph` reads today. A file SCC
 * of more than 10 files is where cycles longer than the Cypher template's bound (10) can exist unreported.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { annotateNodes } from '../../src/neo4j-ingestion/index.js';
import { parseSpec, readSpecExcludePaths } from '../../src/spec-parser/index.js';
import { extractAPG } from '../../src/apg-extractor/index.js';
import { buildFileGraph, stronglyConnectedComponents, SCC_TEMPLATE_NAME } from '../../src/evaluation-engine/scc-cycles.js';
import { compilerInputFromSpec } from '../../src/fitness-compiler/compiler-input.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../src/fitness-compiler/fitness-compiler.js';
import type { APGNode } from '../../src/shared/types/apg.js';
import type { LayerModel } from '../../src/shared/types/spec.js';

const argv = process.argv.slice(2);
const opt = (n: string): string | undefined => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const findingsDir = opt('findings');
const specsDir = opt('specs');
if (findingsDir === undefined || specsDir === undefined) throw new Error('--findings <dir> and --specs <dir> are required');
const reposDir = opt('repos');
const out = opt('out');
const LONG = 10;

type Graph = Map<string, Set<string>>;
const isBarrel = (f: string): boolean => /(^|\/)index\.[cm]?[jt]sx?$/.test(f);
const folderOf = (f: string): string => { const d = path.posix.dirname(f); return d === '' ? '.' : d; };
function topFolder(f: string): string {
  const parts = f.split('/');
  const i = parts[0] === 'src' && parts.length > 2 ? 1 : 0;
  return parts.length > 1 ? parts.slice(0, i + 1).join('/') : '.';
}

function componentMapper(layerModel: LayerModel, files: readonly string[]): (f: string) => string {
  const nodes = files.map((f) => ({ id: f, type: 'File', name: path.posix.basename(f), filePath: f }) as unknown as APGNode);
  const { annotations } = annotateNodes(nodes, layerModel);
  return (f: string): string => { const a = annotations.get(f); return a?.layer != null ? a.layer : `~${topFolder(f)}`; };
}

function addEdge(g: Graph, a: string, b: string): void {
  if (!g.has(a)) g.set(a, new Set());
  if (!g.has(b)) g.set(b, new Set());
  if (a !== b) g.get(a)?.add(b);
}
function sccsOf(g: Graph): string[][] {
  const sorted = new Map<string, readonly string[]>([...g.keys()].sort().map((k) => [k, [...(g.get(k) ?? [])].sort()]));
  return stronglyConnectedComponents(sorted).filter((c) => c.length >= 2).map((c) => [...c]);
}
const collapse = (g: ReadonlyMap<string, readonly string[]> | Graph, map: (f: string) => string): Graph => {
  const c: Graph = new Map();
  for (const [a, bs] of g) { addEdge(c, map(a), map(a)); for (const b of bs) addEdge(c, map(a), map(b)); }
  return c;
};
interface SccSummary { readonly count: number; readonly sizes: number[]; readonly longerThan10: number }
interface ProjectResult {
  readonly id: string;
  /** FF-S02 declared in the project's spec; without it no cycle row can exist (the DDD preset does not declare it). */
  readonly ffS02InSpec: boolean;
  readonly cycleRows: Record<string, number>;
  readonly fromCycleRows: { readonly file: SccSummary; readonly folder: SccSummary; readonly component: SccSummary };
  readonly fullGraph?: { readonly files: number; readonly file: SccSummary; readonly folder: SccSummary; readonly component: SccSummary; readonly componentSccs: string[][]; readonly unionFileSccs: SccSummary; readonly sccFiles: number; readonly sccFilesOnAReportedCycle: number };
}
const sccSummary = (s: readonly string[][]): SccSummary => ({ count: s.length, sizes: s.map((c) => c.length).sort((a, b) => b - a), longerThan10: s.filter((c) => c.length > LONG).length });

async function main(): Promise<void> {
  const ids = fs.readdirSync(findingsDir as string).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
  const projects: ProjectResult[] = [];
  const totals = { rows: 0, barrelRows: 0, survivesFolder: 0, survivesComponent: 0, survivesFolderBarrel: 0, survivesComponentBarrel: 0 };
  for (const id of ids) {
    const report = JSON.parse(fs.readFileSync(path.join(findingsDir as string, `${id}.json`), 'utf8')) as { violations: { functionId: string; filePath: string }[] };
    const rows = report.violations.filter((v) => v.functionId === 'FF-S02').map((v) => v.filePath.split(',').map((s) => s.trim()));
    const specPath = path.join(specsDir as string, `${id}.yaml`);
    const parsed = await parseSpec({ specFilePath: specPath });
    if (!parsed.success) throw new Error(`${id}: spec does not parse`);
    const layerModel = parsed.data.layerModel;

    let fileGraph: ReadonlyMap<string, readonly string[]> | undefined;
    let unionGraph: ReadonlyMap<string, readonly string[]> | undefined;
    if (reposDir !== undefined && fs.existsSync(path.join(reposDir, id))) {
      const root = fs.realpathSync(path.join(reposDir, id));
      const ex = await extractAPG(root, { excludePatterns: readSpecExcludePaths(specPath) });
      if (!ex.success) throw new Error(`${id}: extract failed: ${ex.errors.map((e) => e.message).join('; ')}`);
      const compiled = compileFunctions(compilerInputFromSpec(parsed.data), { ...V13_COMPILE_OPTIONS });
      const q = compiled.success ? compiled.data.symbolicQueries.find((x) => x.name === SCC_TEMPLATE_NAME) : undefined;
      const excludePatterns = Array.isArray(q?.params.excludePatterns) ? q.params.excludePatterns.map(String) : [];
      const literal = { nodes: ex.data.nodes, edges: ex.data.edges.filter((e) => !(e.type === 'IMPORTS' && e.properties.viaReExport === true)) };
      const rel = (p: string): string => (p.startsWith(root + '/') ? p.slice(root.length + 1) : p);
      const relGraph = (g: ReadonlyMap<string, readonly string[]>) => new Map([...g].map(([a, bs]): [string, string[]] => [rel(a), bs.map(rel)]));
      fileGraph = relGraph(buildFileGraph(literal, { excludePatterns }));
      unionGraph = relGraph(buildFileGraph(ex.data, { excludePatterns }));
    }
    const allFiles = [...new Set([...rows.flat(), ...(fileGraph?.keys() ?? [])])];
    const component = componentMapper(layerModel, allFiles);

    const cycleGraph: Graph = new Map();
    let survF = 0, survC = 0, barrel = 0, survFB = 0, survCB = 0;
    for (const r of rows) {
      for (let i = 0; i + 1 < r.length; i++) addEdge(cycleGraph, r[i] ?? '', r[i + 1] ?? '');
      const b = r.some(isBarrel);
      const f = new Set(r.map(folderOf)).size >= 2;
      const c = new Set(r.map(component)).size >= 2;
      if (b) barrel++;
      if (f) { survF++; if (b) survFB++; }
      if (c) { survC++; if (b) survCB++; }
    }
    totals.rows += rows.length; totals.barrelRows += barrel; totals.survivesFolder += survF; totals.survivesComponent += survC;
    totals.survivesFolderBarrel += survFB; totals.survivesComponentBarrel += survCB;
    const longestRow = rows.reduce((m, r) => Math.max(m, r.length - 1), 0);

    const ffS02InSpec = parsed.data.fitnessFunctions.some((f) => String(f.id) === 'FF-S02');
    projects.push({
      id,
      ffS02InSpec,
      cycleRows: { rows: rows.length, barrelRows: barrel, longestRowFiles: longestRow, survivesFolder: survF, survivesComponent: survC, survivesFolderBarrel: survFB, survivesComponentBarrel: survCB },
      fromCycleRows: {
        file: sccSummary(sccsOf(cycleGraph)),
        folder: sccSummary(sccsOf(collapse(cycleGraph, folderOf))),
        component: sccSummary(sccsOf(collapse(cycleGraph, component))),
      },
      ...(fileGraph !== undefined ? {
        fullGraph: {
          files: fileGraph.size,
          file: sccSummary(sccsOf(collapse(fileGraph, (f) => f))),
          folder: sccSummary(sccsOf(collapse(fileGraph, folderOf))),
          component: sccSummary(sccsOf(collapse(fileGraph, component))),
          componentSccs: sccsOf(collapse(fileGraph, component)),
          unionFileSccs: sccSummary(sccsOf(collapse(unionGraph ?? fileGraph, (f) => f))),
          ...(() => {
            const members = sccsOf(collapse(fileGraph, (f) => f)).flat();
            const onRow = new Set(rows.flat());
            return { sccFiles: members.length, sccFilesOnAReportedCycle: members.filter((f) => onRow.has(f)).length };
          })(),
        },
      } : {}),
    });
    process.stderr.write(`${id}: ${String(rows.length)} rows\n`);
  }
  const sum = (pick: (p: ProjectResult) => number): number => projects.reduce((s, p) => s + pick(p), 0);
  const full = projects.filter((p) => p.fullGraph !== undefined);
  const result = {
    projects: projects.length,
    totals: {
      ...totals,
      fromCycleRows: {
        fileSccs: sum((p) => p.fromCycleRows.file.count), fileSccsLongerThan10: sum((p) => p.fromCycleRows.file.longerThan10),
        folderSccs: sum((p) => p.fromCycleRows.folder.count), folderSccsLongerThan10: sum((p) => p.fromCycleRows.folder.longerThan10),
        componentSccs: sum((p) => p.fromCycleRows.component.count), componentSccsLongerThan10: sum((p) => p.fromCycleRows.component.longerThan10),
      },
      ...(full.length > 0 ? {
        fullGraph: {
          projects: full.length,
          projectsWithAFileScc: full.filter((p) => (p.fullGraph?.file.count ?? 0) > 0).length,
          fileSccs: sum((p) => p.fullGraph?.file.count ?? 0), fileSccsLongerThan10: sum((p) => p.fullGraph?.file.longerThan10 ?? 0),
          projectsWithFileSccLongerThan10: full.filter((p) => (p.fullGraph?.file.longerThan10 ?? 0) > 0).map((p) => p.id),
          folderSccs: sum((p) => p.fullGraph?.folder.count ?? 0), folderSccsLongerThan10: sum((p) => p.fullGraph?.folder.longerThan10 ?? 0),
          componentSccs: sum((p) => p.fullGraph?.component.count ?? 0), componentSccsLongerThan10: sum((p) => p.fullGraph?.component.longerThan10 ?? 0),
          unionFileSccs: sum((p) => p.fullGraph?.unionFileSccs.count ?? 0), unionFileSccsLongerThan10: sum((p) => p.fullGraph?.unionFileSccs.longerThan10 ?? 0),
          projectsWithFileSccButNoCycleRow: full.filter((p) => (p.fullGraph?.file.count ?? 0) > 0 && (p.cycleRows.rows ?? 0) === 0).map((p) => ({ id: p.id, ffS02InSpec: p.ffS02InSpec })),
          projectsWithoutFfS02InSpec: projects.filter((p) => !p.ffS02InSpec).map((p) => p.id),
        },
      } : {}),
    },
    perProject: projects,
  };
  const text = JSON.stringify(result, null, 1) + '\n';
  if (out !== undefined) fs.writeFileSync(out, text);
  process.stdout.write(JSON.stringify(result.totals, null, 1) + '\n');
}

main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exit(1); });
