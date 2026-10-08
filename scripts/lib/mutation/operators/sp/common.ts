/**
 * Shared helpers of the SP-* sensitivity probes (ADR-015 item 10; ADR-016 b; Q12; BR-U5a-30).
 *
 * A probe is a `MutationOperator` with `role: 'probe'`, run on the same engine and manifest format with
 * `split: 'probe'` on fixtures only, never in the golden set. Each probe targets one compiled symbolic function
 * (by its template) and declares the key that function must return as a new row: as an expected key when a
 * location rule can express it, or — for the two keys BR-U5a-14/20 reserve to site collateral — as the `cycle`
 * collateral key (`no-cyclic-deps`) or the keyless `project-metric` entry (`abstraction-ratio`). Ratio and
 * count templates are seeded by a stated amount computed from the spec's threshold and the base value, recorded in
 * `site.detail`. Nothing here reads a detector output (BR-U5a-06).
 */
import * as path from 'node:path';
import { Node, Scope } from 'ts-morph';
import type { ClassDeclaration, SourceFile } from 'ts-morph';
import { buildImportGraph } from '../../import-graph.js';
import { METRIC_DEFAULT_THRESHOLDS, isMetricTemplate } from '../../metrics.js';
import type {
  Dimension,
  ImportGraph,
  LocationRule,
  MutationOperator,
  MutationSite,
  ParsedSpec,
  PreconditionResult,
  ProjectHandle,
} from '../../types.js';
import { cmp, fileAt, freshName, insertImport, layerOfFile, namedClasses, projectFiles, relOf, specView, specifierTo } from '../common.js';

/** Published basis of every probe. */
export const PROBE_SOURCE = 'ADR-015 item 10; ADR-016 b';

/** Metadata of one probe besides its operator (catalogue §5 row; BR-U5a-30). */
export interface SpProbe {
  readonly op: MutationOperator;
  /** Template of the compiled symbolic function the probe targets. */
  readonly targetTemplate: string;
  /** Spec the probe runs under (fixtures only). */
  readonly spec: string;
  /** Fixture base (repository-relative directory). */
  readonly fixture: string;
  /** How the declared key is carried: an expected key, the `cycle` collateral key or the keyless project metric. */
  readonly declaredBy: 'expected' | 'cycle-collateral' | 'project-metric';
  /** Described edit (catalogue §5 "Edit"). */
  readonly edit: string;
}

export interface ProbeShape {
  readonly id: string;
  readonly dimension: Dimension;
  readonly expectedTemplates: readonly LocationRule[];
  readonly coveredByTemplates: readonly string[];
}

/** A probe operator from an engine part (`findSites`, `checkPreconditions`, `apply`, planned edges and files). */
export function probeOperator(
  shape: ProbeShape,
  engine: Pick<MutationOperator, 'findSites' | 'checkPreconditions' | 'apply' | 'plannedEdges'> &
    Partial<Pick<MutationOperator, 'plannedImportUses' | 'plannedFiles' | 'expectedEdges'>>,
): MutationOperator {
  return {
    id: shape.id,
    role: 'probe',
    core: false,
    dimension: shape.dimension,
    expectedTemplates: shape.expectedTemplates,
    operatorCollateral: [],
    coveredByTemplates: shape.coveredByTemplates,
    coverage: 'in',
    source: PROBE_SOURCE,
    findSites: engine.findSites,
    checkPreconditions: engine.checkPreconditions,
    apply: engine.apply,
    plannedEdges: engine.plannedEdges,
    ...(engine.plannedImportUses !== undefined ? { plannedImportUses: engine.plannedImportUses } : {}),
    ...(engine.plannedFiles !== undefined ? { plannedFiles: engine.plannedFiles } : {}),
    ...(engine.expectedEdges !== undefined ? { expectedEdges: engine.expectedEdges } : {}),
  };
}

/** A probe that reuses a catalogue operator's sites, preconditions and edit, with its own expected rule. */
export function probeFrom(op: MutationOperator, shape: ProbeShape): MutationOperator {
  return probeOperator(shape, {
    findSites: (handle, spec) => op.findSites(handle, spec),
    checkPreconditions: (handle, spec, site, ctx) => op.checkPreconditions(handle, spec, site, ctx),
    apply: (handle, site, rng) => op.apply(handle, site, rng),
    plannedEdges: (site) => op.plannedEdges(site),
    ...(op.plannedImportUses !== undefined ? { plannedImportUses: (site: MutationSite) => op.plannedImportUses?.(site) ?? [] } : {}),
    ...(op.plannedFiles !== undefined ? { plannedFiles: (site: MutationSite) => op.plannedFiles?.(site) ?? [] } : {}),
    ...(op.expectedEdges !== undefined ? { expectedEdges: op.expectedEdges } : {}),
  });
}

/** `(site file, '', []; none)`: per-file metric and file-level templates. */
export function fileRule(template: string, filePath: LocationRule['filePath'] = 'site'): LocationRule {
  return { template, filePath, line: 'none' };
}

/** `(site file, '', [<selector>]; <line>)`: class-anchored templates. */
export function classRule(template: string, selectors: LocationRule['discriminator'], line: LocationRule['line'] = 'none', filePath: LocationRule['filePath'] = 'site'): LocationRule {
  return { template, filePath, ...(selectors !== undefined ? { discriminator: selectors } : {}), line };
}

/** The spec's threshold of an enabled function (metric templates fall back to the registry default). */
export function specThreshold(spec: ParsedSpec, template: string): number | undefined {
  const v = spec.fitnessFunctions.find((f) => f.name === template && f.enabled)?.threshold;
  if (typeof v === 'number') return v;
  return isMetricTemplate(template) ? METRIC_DEFAULT_THRESHOLDS[template] : undefined;
}

/** `maxDepth` of the spec's enabled `inheritance-depth` function. */
export function specMaxDepth(spec: ParsedSpec): number | undefined {
  const v = spec.fitnessFunctions.find((f) => f.name === 'inheritance-depth' && f.enabled)?.maxDepth;
  return typeof v === 'number' ? v : undefined;
}

/** The base import graph of the copy (same builder as the pipeline, BR-U5a-56). */
export function graphOf(handle: ProjectHandle, spec: ParsedSpec): ImportGraph {
  return buildImportGraph(handle, specView(spec).layers);
}

/** Distinct File→File `IMPORTS` neighbours of a file. */
export function importNeighbours(g: ImportGraph, file: string): { readonly incoming: Set<string>; readonly outgoing: Set<string> } {
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  for (const e of g.edges) {
    if (e.type !== 'IMPORTS') continue;
    if (e.target === file) incoming.add(e.source);
    if (e.source === file) outgoing.add(e.target);
  }
  return { incoming, outgoing };
}

/** Smallest n ≥ 1 with (out + n) / (in + out + n) > t (instability crossing), or undefined when unreachable. */
export function instabilityAmount(fanIn: number, fanOut: number, t: number): number | undefined {
  if (t >= 1) return undefined;
  for (let n = 1; n <= 10_000; n++) if ((fanOut + n) / (fanIn + fanOut + n) > t) return n;
  return undefined;
}

/** Layered source files of the copy with their layer, path order. */
export function layeredFiles(handle: ProjectHandle, spec: ParsedSpec): { readonly rel: string; readonly sf: SourceFile; readonly layer: string }[] {
  const view = specView(spec);
  const out: { rel: string; sf: SourceFile; layer: string }[] = [];
  for (const sf of projectFiles(handle)) {
    const rel = relOf(handle, sf);
    const layer = layerOfFile(view, rel);
    if (layer !== null) out.push({ rel, sf, layer });
  }
  return out;
}

/** Created files `<dir>/<stem><i>.ts` (i = 0..n−1) that do not exist yet; undefined when one exists. */
export function createdPaths(handle: ProjectHandle, dir: string, stem: string, n: number): string[] | undefined {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const rel = `${dir}/${stem}${String(i)}.ts`;
    if (fileAt(handle, rel) !== undefined) return undefined;
    out.push(rel);
  }
  return out;
}

/** Creates `rel` with `text` in the copy and returns the source file. */
export function createFile(handle: ProjectHandle, rel: string, text: string): SourceFile {
  return handle.project.createSourceFile(path.join(handle.root, ...rel.split('/')), text);
}

/** Creates each file `export const <lowerStem><i> = <i>;` and imports its value into `sf`; returns the new edges. */
export function importCreatedValues(handle: ProjectHandle, sf: SourceFile, siteRel: string, files: readonly string[], valueStem: string): { source: string; target: string }[] {
  const edges: { source: string; target: string }[] = [];
  files.forEach((rel, i) => {
    const created = createFile(handle, rel, `export const ${valueStem}${String(i)} = ${String(i)};\n`);
    insertImport(sf, specifierTo(sf, created), { named: [`${valueStem}${String(i)}`] });
    edges.push({ source: siteRel, target: rel });
  });
  return edges;
}

/** Does any file of the project construct `className` with `new`? (A new constructor parameter would break it.) */
export function isConstructedAnywhere(handle: ProjectHandle, className: string): boolean {
  for (const sf of projectFiles(handle)) {
    for (const n of sf.getDescendants()) {
      if (Node.isNewExpression(n) && n.getExpression().getText() === className) return true;
    }
  }
  return false;
}

/** Does `from` already hold an import declaration resolving to `to`? */
export function importsFile(from: SourceFile, to: SourceFile): boolean {
  return from.getImportDeclarations().some((d) => d.getModuleSpecifierSourceFile() === to);
}

/**
 * Adds `private readonly <name>: <Type>` constructor parameters to `cls` (one per `[typeName, file]`), importing
 * each type's file unless already imported. Returns the new File→File edges and the parameter names.
 */
export function injectParameters(
  handle: ProjectHandle,
  cls: ClassDeclaration,
  siteRel: string,
  deps: readonly { readonly typeName: string; readonly file: string }[],
): { readonly edges: { source: string; target: string }[]; readonly names: string[] } {
  const sf = cls.getSourceFile();
  const ctor = cls.getConstructors()[0];
  const edges: { source: string; target: string }[] = [];
  const names: string[] = [];
  if (ctor === undefined) return { edges, names };
  for (const dep of deps) {
    const target = fileAt(handle, dep.file);
    if (target === undefined) continue;
    if (target !== sf && !importsFile(sf, target)) {
      insertImport(sf, specifierTo(sf, target), { named: [dep.typeName] });
      edges.push({ source: siteRel, target: dep.file });
    }
    const name = freshName(sf, `probe${dep.typeName}`);
    ctor.addParameter({ name, type: dep.typeName, isReadonly: true, scope: Scope.Private });
    names.push(name);
  }
  return { edges, names };
}

/** Named classes of the files of one layer, as `[name, file]`, path then declaration order. */
export function layerClasses(handle: ProjectHandle, spec: ParsedSpec, layers: readonly string[]): { readonly name: string; readonly file: string; readonly cls: ClassDeclaration }[] {
  const out: { name: string; file: string; cls: ClassDeclaration }[] = [];
  for (const f of layeredFiles(handle, spec)) {
    if (!layers.includes(f.layer)) continue;
    for (const c of namedClasses(f.sf)) out.push({ name: c.getName() ?? '', file: f.rel, cls: c });
  }
  return out;
}

/** Constructor parameter types of a class resolved to a class or interface declaration: `[kind, name, file]`. */
export function injectedTypes(handle: ProjectHandle, cls: ClassDeclaration): { readonly kind: 'class' | 'interface'; readonly name: string; readonly file: string }[] {
  const ctor = cls.getConstructors()[0];
  if (ctor === undefined) return [];
  const out: { kind: 'class' | 'interface'; name: string; file: string }[] = [];
  for (const p of ctor.getParameters()) {
    const sym = p.getType().getSymbol() ?? p.getType().getAliasSymbol();
    const decl = sym?.getDeclarations()[0];
    if (decl === undefined) continue;
    if (Node.isClassDeclaration(decl) || Node.isInterfaceDeclaration(decl)) {
      out.push({ kind: Node.isClassDeclaration(decl) ? 'class' : 'interface', name: decl.getName() ?? '', file: relOf(handle, decl.getSourceFile()) });
    }
  }
  return out;
}

/** Directory of the first layered file of `layer` (path order). */
export function firstDirOfLayer(handle: ProjectHandle, spec: ParsedSpec, layer: string | undefined): string | undefined {
  if (layer === undefined) return undefined;
  const f = layeredFiles(handle, spec).find((x) => x.layer === layer);
  return f === undefined ? undefined : path.posix.dirname(f.rel);
}

/** Project-wide class and interface counts as the extractor counts nodes (every class, every interface). */
export function typeCounts(handle: ProjectHandle): { readonly classes: number; readonly interfaces: number } {
  let classes = 0;
  let interfaces = 0;
  for (const sf of projectFiles(handle)) {
    classes += sf.getClasses().length;
    interfaces += sf.getInterfaces().length;
  }
  return { classes, interfaces };
}

export const OK: PreconditionResult = { ok: true };

export function sortedSites(sites: MutationSite[]): MutationSite[] {
  return sites.sort((a, b) => cmp(a.filePath, b.filePath) || cmp(JSON.stringify(a.detail), JSON.stringify(b.detail)));
}
