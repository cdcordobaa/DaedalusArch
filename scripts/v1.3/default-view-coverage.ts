/**
 * v1.3 default-view coverage diagnostic (external set, PR #133 follow-up). No Neo4j, no LLM; reads the projects, never
 * writes into them.
 *
 * For each project it compares, against the TypeScript compiler's module graph (the reference of
 * `scripts/v1.3/graph-fidelity.ts`, scoped to edges whose two ends are APG File nodes), the File→File
 * IMPORTS ∪ RE_EXPORTS edges of:
 *   - `v12e-default`                the frozen v1.2E options (`V12E_DEFAULT_OPTIONS`);
 *   - `v12e+dynamicImports`         the same with only `dynamicImports` on;
 *   - `v12e+reExportEdges`          the same with only `reExportEdges: 'both'`, literal view;
 *   - `v13-literal`                 `V13_DEFAULT_OPTIONS`, literal view (no `viaReExport` edges);
 *   - `v13-resolved`                `V13_DEFAULT_OPTIONS`, resolved view (no `reExportHop` edges);
 *   - `v13-union`                   `V13_DEFAULT_OPTIONS`, every IMPORTS edge (what a reader without a view sees).
 * `firewall evaluate` extracts with `V13_DEFAULT_OPTIONS` and compiles with `V13_COMPILE_OPTIONS` (edge views on).
 *
 * Every edge where `v12e-default` and tsc disagree is classified from the v1.3 extraction's own edge marks:
 *   barrel     the literal edge carries `reExportHop` (missing) or the edge carries `viaReExport` (extra); sub-classed
 *              by how the first barrel exports the names (named, renamed, `export *`, `export * as`, local re-export),
 *              by chain length and by whether the specifier is a `paths`/`baseUrl` alias;
 *   require / dynamic-import   the v1.3 edge carries `dynamic: true`; sub-classed by the call form;
 *   other      anything else (an extractor defect candidate).
 * A second, independent check (the "checker oracle") asks the TypeScript checker for the declaring file of every
 * named / default import (`getAliasedSymbol`) and compares it with the resolved edges.
 *
 * Usage:
 *   node --import tsx scripts/v1.3/default-view-coverage.ts --projects <json: [{id, root, tsconfig, spec?}]> --out <file.json>
 */
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { Project } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { extractAPG, V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../src/apg-extractor/index.js';
import type { ExtractorOptions } from '../../src/apg-extractor/index.js';
import { specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import type { APGResult } from '../../src/shared/types/apg.js';
import { agreement, cmp, edgeKey, occurrencesByEdge, projectApg, toPosix, tscReference } from './lib/graph-fidelity.js';
import type { Agreement, EdgeKey, RefOccurrence } from './lib/graph-fidelity.js';
import { callForm, exportForm, isAliasSpecifier } from './lib/default-view-coverage.js';

interface ProjectInput { readonly id: string; readonly root: string; readonly tsconfig: string; readonly spec?: string }
type Edge = APGResult['edges'][number];

const VIEWS = ['v12e-default', 'v12e+dynamicImports', 'v12e+reExportEdges', 'v13-literal', 'v13-resolved', 'v13-union'] as const;
type ViewName = (typeof VIEWS)[number];

const flag = (e: Edge, key: string): boolean => e.type === 'IMPORTS' && e.properties[key] === true;
const literalView = (e: Edge): boolean => !flag(e, 'viaReExport');
const resolvedView = (e: Edge): boolean => !flag(e, 'reExportHop');

async function extract(root: string, tsconfig: string, opts: ExtractorOptions): Promise<APGResult> {
  const r = await extractAPG(root, opts, tsconfig);
  if (!r.success) throw new Error(`extract ${root}: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

function fileEdges(apg: APGResult, keep: (e: Edge) => boolean): Set<EdgeKey> {
  return new Set(projectApg({ ...apg, edges: apg.edges.filter(keep) }).edges.keys());
}

interface ClassifiedEdge {
  readonly source: string;
  readonly target: string;
  readonly side: 'missing' | 'extra';
  readonly cls: string;
  readonly sub: string;
}

interface OracleMismatch { readonly source: string; readonly name: string; readonly specifier: string; readonly expected: string[]; readonly got: string[] }

async function measure(input: ProjectInput): Promise<Record<string, unknown>> {
  const root = realpathSync(input.root);
  const tsconfig = resolve(input.tsconfig);
  const excludePatterns = input.spec !== undefined ? specExcludePathsFromYaml(readFileSync(input.spec, 'utf8')) : [];
  const v12e = await extract(root, tsconfig, { ...V12E_DEFAULT_OPTIONS, excludePatterns });
  const v12eDyn = await extract(root, tsconfig, { ...V12E_DEFAULT_OPTIONS, dynamicImports: true, excludePatterns });
  const v12eBoth = await extract(root, tsconfig, { ...V12E_DEFAULT_OPTIONS, reExportEdges: 'both', excludePatterns });
  const v13 = await extract(root, tsconfig, { ...V13_DEFAULT_OPTIONS, excludePatterns });

  const apgFiles = new Set(projectApg(v12e).files);
  const tsc = tscReference(root, tsconfig);
  const tscByEdge = occurrencesByEdge(tsc.occurrences);
  const scoped = new Set<EdgeKey>([...tscByEdge.keys()].filter((k) => {
    const [s, t] = k.split('\t') as [string, string];
    return apgFiles.has(s) && apgFiles.has(t);
  }));
  const views: Record<ViewName, Set<EdgeKey>> = {
    'v12e-default': fileEdges(v12e, () => true),
    'v12e+dynamicImports': fileEdges(v12eDyn, () => true),
    'v12e+reExportEdges': fileEdges(v12eBoth, literalView),
    'v13-literal': fileEdges(v13, literalView),
    'v13-resolved': fileEdges(v13, resolvedView),
    'v13-union': fileEdges(v13, () => true),
  };
  const agreements = Object.fromEntries(VIEWS.map((v) => [v, agreement(views[v], scoped)])) as Record<ViewName, Agreement>;

  // v1.3 IMPORTS edges by File→File key, for the classification.
  const fileById = new Map(v13.nodes.filter((n) => n.type === 'File').map((n) => [n.id, n.filePath] as const));
  const v13Imports = new Map<EdgeKey, Edge[]>();
  for (const e of v13.edges) {
    if (e.type !== 'IMPORTS') continue;
    const s = fileById.get(e.sourceId); const t = fileById.get(e.targetId);
    if (s === undefined || t === undefined) continue;
    const k = edgeKey(s, t);
    v13Imports.set(k, [...(v13Imports.get(k) ?? []), e]);
  }

  const project = new Project({ tsConfigFilePath: tsconfig, skipFileDependencyResolution: true });
  const sfOf = (p: string): SourceFile | undefined => project.getSourceFile(resolve(root, p));

  const classified: ClassifiedEdge[] = [];
  const base = views['v12e-default'];
  const classifyMissing = (k: EdgeKey): ClassifiedEdge => {
    const [source, target] = k.split('\t') as [string, string];
    const es = v13Imports.get(k) ?? [];
    const occ: readonly RefOccurrence[] = tscByEdge.get(k) ?? [];
    if (es.length > 0 && es.every((e) => e.properties.dynamic === true)) {
      const sf = sfOf(source);
      const lines = (es[0]?.properties.lines as number[] | undefined) ?? [];
      const forms: string[] = sf === undefined ? ['unknown'] : [...new Set(lines.map((l) => callForm(sf, l)))].sort(cmp);
      return { source, target, side: 'missing', cls: forms.every((f) => f === 'dynamic-import') ? 'dynamic-import' : 'require', sub: forms.join('+') };
    }
    const hop = es.find((e) => e.properties.reExportHop === true);
    if (hop !== undefined) {
      const barrel = sfOf(target);
      const names = (hop.properties.importedNames as string[] | undefined) ?? [];
      const forms: string[] = barrel === undefined ? ['unknown'] : [...new Set(names.map((n) => exportForm(barrel, n)))].sort(cmp);
      const specs = (hop.properties.specifiers as string[] | undefined) ?? [];
      const alias = specs.some(isAliasSpecifier) ? 'alias-specifier' : 'relative-specifier';
      // Chain length: the longest barrel path among the statement's resolved edges from the same importer.
      const depth = Math.max(1, ...[...v13Imports.entries()]
        .filter(([kk]) => kk.startsWith(`${source}\t`))
        .flatMap(([, ee]) => ee)
        .filter((e) => e.properties.viaReExport === true && ((e.properties.reExportBarrels as string[] | undefined) ?? []).includes(target))
        .map((e) => ((e.properties.reExportBarrels as string[] | undefined) ?? []).length));
      return { source, target, side: 'missing', cls: 'barrel', sub: `${forms.join('+')};${alias};chain=${depth}` };
    }
    const kinds = [...new Set(occ.map((o) => o.kind))].sort(cmp).join('+');
    return { source, target, side: 'missing', cls: 'other', sub: `tsc:${kinds};v13edges=${es.length}` };
  };
  const classifyExtra = (k: EdgeKey): ClassifiedEdge => {
    const [source, target] = k.split('\t') as [string, string];
    const es = v13Imports.get(k) ?? [];
    const via = es.find((e) => e.properties.viaReExport === true);
    if (via !== undefined && es.every((e) => e.properties.viaReExport === true)) {
      const barrels = (via.properties.reExportBarrels as string[] | undefined) ?? [];
      const first = barrels[0] !== undefined ? sfOf(barrels[0]) : undefined;
      const names = (via.properties.importedNames as string[] | undefined) ?? [];
      const forms: string[] = first === undefined ? ['unknown'] : [...new Set(names.map((n) => exportForm(first, n)))].sort(cmp);
      const specs = (via.properties.specifiers as string[] | undefined) ?? [];
      const alias = specs.some(isAliasSpecifier) ? 'alias-specifier' : 'relative-specifier';
      return { source, target, side: 'extra', cls: 'barrel', sub: `${forms.join('+')};${alias};chain=${barrels.length}` };
    }
    return { source, target, side: 'extra', cls: 'other', sub: `v13edges=${es.length};via=${String(via !== undefined)}` };
  };
  for (const k of [...scoped].sort(cmp)) if (!base.has(k)) classified.push(classifyMissing(k));
  for (const k of [...base].sort(cmp)) if (!scoped.has(k)) classified.push(classifyExtra(k));

  // Checker oracle: the declaring file of every named / default import, against the v1.3 resolved view.
  const checker = project.getTypeChecker();
  const resolved = views['v13-resolved'];
  const oracleMismatches: OracleMismatch[] = [];
  let oracleChecked = 0;
  let oracleRouted = 0;
  for (const src of [...apgFiles].sort(cmp)) {
    const sf = sfOf(src);
    if (sf === undefined) continue;
    for (const decl of sf.getImportDeclarations()) {
      const moduleSf = decl.getModuleSpecifierSourceFile();
      if (moduleSf === undefined) continue;
      const modRel = toPosix(relative(root, moduleSf.getFilePath()));
      if (!apgFiles.has(modRel)) continue;
      const ids = [
        ...(decl.getDefaultImport() !== undefined ? [{ node: decl.getDefaultImport()!, name: 'default' }] : []),
        ...decl.getNamedImports().map((n) => ({ node: n.getAliasNode() ?? n.getNameNode(), name: n.getName() })),
      ];
      for (const { node, name } of ids) {
        const local = checker.getSymbolAtLocation(node);
        if (local === undefined) continue;
        const target = local.isAlias() ? checker.getAliasedSymbol(local) : local;
        if (target === undefined) continue;
        const declFiles = [...new Set(target.getDeclarations().map((d) => toPosix(relative(root, d.getSourceFile().getFilePath()))))]
          .filter((f) => apgFiles.has(f)).sort(cmp);
        if (declFiles.length === 0) continue; // declared in a package, a .d.ts or an excluded file
        oracleChecked++;
        if (declFiles.includes(modRel)) continue; // declared in the module itself: no routing
        oracleRouted++;
        const got = declFiles.filter((f) => resolved.has(edgeKey(src, f)));
        if (got.length === 0) {
          oracleMismatches.push({ source: src, name, specifier: decl.getModuleSpecifierValue(), expected: declFiles, got: [] });
        }
      }
    }
  }

  const tally = (side: 'missing' | 'extra'): Record<string, number> => {
    const t: Record<string, number> = {};
    for (const c of classified.filter((x) => x.side === side)) t[c.cls] = (t[c.cls] ?? 0) + 1;
    return t;
  };
  const subTally = (side: 'missing' | 'extra'): Record<string, number> => {
    const t: Record<string, number> = {};
    for (const c of classified.filter((x) => x.side === side)) t[`${c.cls}:${c.sub}`] = (t[`${c.cls}:${c.sub}`] ?? 0) + 1;
    return Object.fromEntries(Object.entries(t).sort(([a], [b]) => cmp(a, b)));
  };
  return {
    id: input.id,
    tscScopedEdges: scoped.size,
    agreements,
    missing: tally('missing'), extra: tally('extra'),
    missingSub: subTally('missing'), extraSub: subTally('extra'),
    oracle: { checked: oracleChecked, routedThroughReExport: oracleRouted, mismatches: oracleMismatches },
    edges: classified,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const get = (k: string): string => {
    const i = argv.indexOf(`--${k}`);
    const v = i >= 0 ? argv[i + 1] : undefined;
    if (v === undefined) throw new Error(`--${k} is required`);
    return v;
  };
  const inputs = JSON.parse(readFileSync(get('projects'), 'utf8')) as ProjectInput[];
  const results: Record<string, unknown>[] = [];
  for (const p of inputs) {
    process.stderr.write(`${p.id}\n`);
    results.push(await measure(p));
  }
  writeFileSync(get('out'), `${JSON.stringify({ generatedBy: 'scripts/v1.3/default-view-coverage.ts', projects: results }, null, 1)}\n`);
}

void main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
