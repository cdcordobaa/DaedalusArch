/**
 * v1.3 graph-fidelity harness, pure part (FR-V2, link 1).
 *
 * Three extractors build a file-to-file internal import edge set for one TypeScript project:
 *   - the APG extractor (`extractAPG`), IMPORTS and RE_EXPORTS edges between File nodes;
 *   - dependency-cruiser (a second extractor, not ground truth);
 *   - the TypeScript compiler API: every import / export-from / import-equals / require() / import() / import('x').T
 *     specifier resolved with `ts.resolveModuleName` and the project's compilerOptions (a third extractor).
 *
 * Neither reference is ground truth, so the figures are AGREEMENT figures (coordinator, adversarial-review finding 2):
 * `refCoveredByApg` = |A∩R|/|R|, `apgConfirmedByRef` = |A∩R|/|A|, `jaccard` = |A∩R|/|A∪R|. Only an adjudicated
 * figure (the adjudication sheet) may later be called precision.
 *
 * Every disagreement gets one reason class (`ReasonClass`). `extractor-bug` means "unexplained".
 */
import { existsSync, readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

// ── Shapes ───────────────────────────────────────────────────────────────────

/** How a specifier occurs in the source (TypeScript compiler walk). */
export type OccKind =
  | 'import'          // import x / { a } / * as n from 'm' (value)
  | 'side-effect'     // import 'm'
  | 'type-import'     // import type ..., or every named specifier type-marked
  | 're-export'       // export ... from 'm' (value)
  | 'type-re-export'  // export type ... from 'm'
  | 'import-equals'   // import x = require('m')
  | 'require'         // require('m') call
  | 'dynamic-import'  // import('m') call
  | 'import-type';    // import('m').T type reference

export const TYPE_ONLY_KINDS: ReadonlySet<OccKind> = new Set<OccKind>(['type-import', 'type-re-export', 'import-type']);

export interface RefOccurrence {
  /** Source file, root-relative POSIX. */
  readonly source: string;
  /** Resolved target, root-relative POSIX (may start with `../` when outside the root). */
  readonly target: string;
  readonly specifier: string;
  /** 1-based line of the statement or call start. */
  readonly line: number;
  readonly kind: OccKind;
  /** Non-relative specifier that resolved to a project file (a `paths` / `baseUrl` alias). */
  readonly alias: boolean;
  /** Resolved to `<dir>/index.*` while the specifier does not name `index`. */
  readonly indexResolution: boolean;
}

export interface TscReference {
  /** Program files under the root, outside node_modules, root-relative, sorted. */
  readonly files: readonly string[];
  readonly occurrences: readonly RefOccurrence[];
  readonly unresolved: number;
  /** The unresolved specifiers (`<source>: <specifier>`), sorted; every tool misses these edges alike. */
  readonly unresolvedSpecifiers: readonly string[];
  readonly external: number;
}

/** Evidence the APG extractor carries for one File→File edge. */
export interface ApgEdgeInfo {
  readonly edgeTypes: readonly string[];
  readonly specifiers: readonly string[];
  readonly lines: readonly number[];
  readonly isTypeOnly: boolean;
  readonly dynamic: boolean;
}

export interface DcEdgeInfo {
  readonly dependencyTypes: readonly string[];
  readonly modules: readonly string[];
}

export type EdgeKey = string;
export const edgeKey = (source: string, target: string): EdgeKey => `${source}\t${target}`;
export const splitKey = (k: EdgeKey): [string, string] => {
  const i = k.indexOf('\t');
  return [k.slice(0, i), k.slice(i + 1)];
};

export type FileScope = 'in-scope' | 'excluded-file' | 'dts' | 'out-of-root';

export type ReasonClass =
  | 'path-alias'
  | 'type-only'
  | 're-export/barrel'
  | 'dynamic-import'
  | 'require'
  | 'out-of-root'
  | 'index-resolution'
  | '.d.ts'
  | 'excluded-file'
  | 'extractor-bug';

export const REASON_CLASSES: readonly ReasonClass[] = [
  'path-alias', 'type-only', 're-export/barrel', 'dynamic-import', 'require', 'out-of-root', 'index-resolution', '.d.ts',
  'excluded-file', 'extractor-bug',
];

/** Classes that are a documented design choice of the v1.2E extractor rather than a resolution fault. */
export function isByDesign(cls: ReasonClass, missingSide: 'apg' | 'ref', dynamicOption: boolean): boolean {
  if (cls === 're-export/barrel' || cls === '.d.ts' || cls === 'excluded-file' || cls === 'out-of-root') return true;
  if ((cls === 'dynamic-import' || cls === 'require') && missingSide === 'apg' && !dynamicOption) return true;
  return false;
}

// ── Small utilities ──────────────────────────────────────────────────────────

export function toPosix(p: string): string {
  return p.split(sep).join('/');
}

export function rel(root: string, abs: string): string {
  return toPosix(relative(root, abs));
}

export function hasNodeModulesSegment(p: string): boolean {
  return p.split(/[\\/]/).includes('node_modules');
}

export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** mulberry32: a small seeded PRNG (deterministic sampling). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` items of `items` (input order must already be deterministic), seeded partial Fisher-Yates, returned in pick order. */
export function seededSample<T>(items: readonly T[], n: number, rnd: () => number): T[] {
  const a = [...items];
  const k = Math.min(n, a.length);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rnd() * (a.length - i));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a.slice(0, k);
}

/**
 * Stratified sample: equal share per stratum, capped at the stratum size, the remainder redistributed round-robin to
 * strata that still have items. Strata are visited in sorted name order. Deterministic for a given `rnd`.
 */
export function stratifiedSample<T>(strata: ReadonlyMap<string, readonly T[]>, total: number, rnd: () => number): { stratum: string; item: T }[] {
  const names = [...strata.keys()].filter((s) => (strata.get(s)?.length ?? 0) > 0).sort(cmp);
  const quota = new Map<string, number>(names.map((s) => [s, 0]));
  let left = Math.min(total, names.reduce((n, s) => n + (strata.get(s)?.length ?? 0), 0));
  while (left > 0) {
    let progressed = false;
    for (const s of names) {
      if (left === 0) break;
      const q = quota.get(s) ?? 0;
      if (q < (strata.get(s)?.length ?? 0)) { quota.set(s, q + 1); left--; progressed = true; }
    }
    if (!progressed) break;
  }
  const out: { stratum: string; item: T }[] = [];
  for (const s of names) for (const item of seededSample(strata.get(s) ?? [], quota.get(s) ?? 0, rnd)) out.push({ stratum: s, item });
  return out;
}

// ── TypeScript compiler reference ────────────────────────────────────────────

export function readCompilerConfig(tsconfigPath: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(resolve(tsconfigPath), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(`tsconfig ${tsconfigPath}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    },
  });
  if (parsed === undefined) throw new Error(`tsconfig ${tsconfigPath} could not be read`);
  return parsed;
}

interface RawSpecifier { readonly specifier: string; readonly line: number; readonly kind: OccKind }

function literalText(n: ts.Node | undefined): string | undefined {
  if (n === undefined) return undefined;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  return undefined;
}

/** Every module specifier of one source text, in source order (pure; exported for tests). */
export function collectSpecifiers(fileName: string, text: string): RawSpecifier[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const out: RawSpecifier[] = [];
  const lineOf = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const spec = literalText(node.moduleSpecifier);
      if (spec !== undefined) {
        const clause = node.importClause;
        let kind: OccKind = 'import';
        if (clause === undefined) kind = 'side-effect';
        else if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) kind = 'type-import';
        else if (clause.name === undefined && clause.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)
          && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every((e) => e.isTypeOnly)) kind = 'type-import';
        out.push({ specifier: spec, line: lineOf(node), kind });
      }
    } else if (ts.isExportDeclaration(node)) {
      const spec = literalText(node.moduleSpecifier);
      if (spec !== undefined) {
        let typeOnly = node.isTypeOnly;
        const ec = node.exportClause;
        if (!typeOnly && ec !== undefined && ts.isNamedExports(ec) && ec.elements.length > 0 && ec.elements.every((e) => e.isTypeOnly)) typeOnly = true;
        out.push({ specifier: spec, line: lineOf(node), kind: typeOnly ? 'type-re-export' : 're-export' });
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (ts.isExternalModuleReference(node.moduleReference)) {
        const spec = literalText(node.moduleReference.expression);
        if (spec !== undefined) out.push({ specifier: spec, line: lineOf(node), kind: node.isTypeOnly ? 'type-import' : 'import-equals' });
      }
    } else if (ts.isCallExpression(node)) {
      const spec = literalText(node.arguments[0]);
      if (spec !== undefined) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) out.push({ specifier: spec, line: lineOf(node), kind: 'dynamic-import' });
        else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') out.push({ specifier: spec, line: lineOf(node), kind: 'require' });
      }
    } else if (ts.isImportTypeNode(node)) {
      const arg = node.argument;
      if (ts.isLiteralTypeNode(arg)) {
        const spec = literalText(arg.literal);
        if (spec !== undefined) out.push({ specifier: spec, line: lineOf(node), kind: 'import-type' });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function isIndexResolution(specifier: string, resolvedAbs: string): boolean {
  const base = resolvedAbs.split('/').pop() ?? '';
  if (!/^index\.(d\.)?[cm]?[jt]sx?$/.test(base)) return false;
  const last = specifier.replace(/\/+$/, '').split('/').pop() ?? '';
  return !/^index(\.[a-z.]+)?$/.test(last);
}

/**
 * The TypeScript-compiler reference: every specifier of every program file under `root` (outside node_modules),
 * resolved with `ts.resolveModuleName` and the tsconfig's compilerOptions. Internal = resolved to a file without a
 * node_modules segment and not an external library import.
 */
export function tscReference(root: string, tsconfigPath: string): TscReference {
  const parsed = readCompilerConfig(tsconfigPath);
  const options = parsed.options;
  const host: ts.ModuleResolutionHost = ts.sys;
  const cache = ts.createModuleResolutionCache(root, (f) => f, options);
  const files = parsed.fileNames
    .map((f) => resolve(f))
    .filter((f) => !hasNodeModulesSegment(relative(root, f)) && !rel(root, f).startsWith('../'))
    .sort(cmp);
  const occurrences: RefOccurrence[] = [];
  let unresolved = 0;
  const unresolvedSpecifiers: string[] = [];
  let external = 0;
  for (const abs of files) {
    const text = readFileSync(abs, 'utf8');
    const source = rel(root, abs);
    for (const s of collectSpecifiers(abs, text)) {
      if (isBuiltin(s.specifier)) { external++; continue; }
      const r = ts.resolveModuleName(s.specifier, abs, options, host, cache).resolvedModule;
      if (r === undefined) { unresolved++; unresolvedSpecifiers.push(`${source}: ${s.specifier}`); continue; }
      const target = resolve(r.resolvedFileName);
      if (r.isExternalLibraryImport === true || hasNodeModulesSegment(target)) { external++; continue; }
      const nonRelative = !(s.specifier.startsWith('.') || s.specifier.startsWith('/'));
      occurrences.push({
        source, target: rel(root, target), specifier: s.specifier, line: s.line, kind: s.kind,
        alias: nonRelative, indexResolution: isIndexResolution(s.specifier, toPosix(target)),
      });
    }
  }
  return { files: files.map((f) => rel(root, f)), occurrences, unresolved, unresolvedSpecifiers: unresolvedSpecifiers.sort(cmp), external };
}

export function occurrencesByEdge(occ: readonly RefOccurrence[]): Map<EdgeKey, RefOccurrence[]> {
  const m = new Map<EdgeKey, RefOccurrence[]>();
  for (const o of occ) {
    const k = edgeKey(o.source, o.target);
    const list = m.get(k);
    if (list === undefined) m.set(k, [o]); else list.push(o);
  }
  return m;
}

// ── dependency-cruiser output ────────────────────────────────────────────────

export interface DcModule {
  readonly source: string;
  readonly dependencies: readonly {
    readonly resolved: string;
    readonly module: string;
    readonly dependencyTypes?: readonly string[];
    readonly coreModule?: boolean;
    readonly couldNotResolve?: boolean;
  }[];
}

/** Internal File→File edges of a dependency-cruiser JSON result, keyed root-relative (paths are cwd-relative). */
export function depcruiseEdges(modules: readonly DcModule[]): Map<EdgeKey, DcEdgeInfo> {
  const m = new Map<EdgeKey, { types: Set<string>; modules: Set<string> }>();
  for (const mod of modules) {
    if (hasNodeModulesSegment(mod.source)) continue;
    for (const d of mod.dependencies) {
      if (d.coreModule === true || d.couldNotResolve === true) continue;
      if (hasNodeModulesSegment(d.resolved)) continue;
      const k = edgeKey(toPosix(mod.source), toPosix(d.resolved));
      let e = m.get(k);
      if (e === undefined) { e = { types: new Set(), modules: new Set() }; m.set(k, e); }
      for (const t of d.dependencyTypes ?? []) e.types.add(t);
      e.modules.add(d.module);
    }
  }
  return new Map([...m].map(([k, v]) => [k, { dependencyTypes: [...v.types].sort(cmp), modules: [...v.modules].sort(cmp) }]));
}

/** The options-only dependency-cruiser config of the harness (no rules: it is used as an extractor). */
export function depcruiseConfig(tsconfigAbs: string): Record<string, unknown> {
  return {
    forbidden: [],
    options: {
      tsPreCompilationDeps: true,
      doNotFollow: { path: '(^|/)node_modules/' },
      exclude: { path: ['(^|/)node_modules/', '^\\.git/'] },
      tsConfig: { fileName: tsconfigAbs },
      enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.json'] },
    },
  };
}

// ── APG projection ───────────────────────────────────────────────────────────

export interface ApgLike {
  readonly nodes: readonly { readonly id: string; readonly type: string; readonly filePath: string }[];
  readonly edges: readonly { readonly type: string; readonly sourceId: string; readonly targetId: string; readonly properties: Readonly<Record<string, unknown>> }[];
}

export interface ApgProjection {
  readonly files: readonly string[];
  readonly edges: Map<EdgeKey, ApgEdgeInfo>;
}

/** File nodes and File→File IMPORTS ∪ RE_EXPORTS edges of an extraction. */
export function projectApg(apg: ApgLike): ApgProjection {
  const fileById = new Map<string, string>();
  for (const n of apg.nodes) if (n.type === 'File') fileById.set(n.id, n.filePath);
  const acc = new Map<EdgeKey, { types: Set<string>; specs: Set<string>; lines: Set<number>; typeOnly: boolean; dynamic: boolean }>();
  for (const e of apg.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') continue;
    const s = fileById.get(e.sourceId);
    const t = fileById.get(e.targetId);
    if (s === undefined || t === undefined) continue;
    const k = edgeKey(s, t);
    let a = acc.get(k);
    if (a === undefined) { a = { types: new Set(), specs: new Set(), lines: new Set(), typeOnly: true, dynamic: true }; acc.set(k, a); }
    a.types.add(e.type);
    const p = e.properties;
    for (const sp of (p.specifiers as string[] | undefined) ?? (typeof p.specifier === 'string' ? [p.specifier] : [])) a.specs.add(sp);
    for (const l of (p.lines as number[] | undefined) ?? (typeof p.line === 'number' ? [p.line] : [])) a.lines.add(l);
    a.typeOnly = a.typeOnly && p.isTypeOnly === true;
    a.dynamic = a.dynamic && p.dynamic === true;
  }
  const edges = new Map<EdgeKey, ApgEdgeInfo>();
  for (const [k, a] of acc) {
    edges.set(k, {
      edgeTypes: [...a.types].sort(cmp), specifiers: [...a.specs].sort(cmp), lines: [...a.lines].sort((x, y) => x - y),
      isTypeOnly: a.typeOnly, dynamic: a.dynamic,
    });
  }
  return { files: [...fileById.values()].sort(cmp), edges };
}

// ── Agreement ────────────────────────────────────────────────────────────────

export interface Agreement {
  readonly apgEdges: number;
  readonly refEdges: number;
  readonly both: number;
  readonly onlyApg: number;
  readonly onlyRef: number;
  /** |A∩R| / |R|; 1 when R is empty. */
  readonly refCoveredByApg: number;
  /** |A∩R| / |A|; 1 when A is empty. */
  readonly apgConfirmedByRef: number;
  /** |A∩R| / |A∪R|; 1 when both are empty. */
  readonly jaccard: number;
}

export function agreement(a: ReadonlySet<EdgeKey>, r: ReadonlySet<EdgeKey>): Agreement {
  let both = 0;
  for (const k of a) if (r.has(k)) both++;
  const union = a.size + r.size - both;
  return {
    apgEdges: a.size, refEdges: r.size, both, onlyApg: a.size - both, onlyRef: r.size - both,
    refCoveredByApg: r.size === 0 ? 1 : both / r.size,
    apgConfirmedByRef: a.size === 0 ? 1 : both / a.size,
    jaccard: union === 0 ? 1 : both / union,
  };
}

/** Micro-average (summed counts) of several agreements. */
export function microAgreement(list: readonly Agreement[]): Agreement {
  const s = list.reduce((acc, x) => ({ a: acc.a + x.apgEdges, r: acc.r + x.refEdges, b: acc.b + x.both }), { a: 0, r: 0, b: 0 });
  const union = s.a + s.r - s.b;
  return {
    apgEdges: s.a, refEdges: s.r, both: s.b, onlyApg: s.a - s.b, onlyRef: s.r - s.b,
    refCoveredByApg: s.r === 0 ? 1 : s.b / s.r, apgConfirmedByRef: s.a === 0 ? 1 : s.b / s.a, jaccard: union === 0 ? 1 : s.b / union,
  };
}

// ── Scope and classification ─────────────────────────────────────────────────

export function scopeOf(path: string, apgFiles: ReadonlySet<string>): FileScope {
  if (apgFiles.has(path)) return 'in-scope';
  if (path.startsWith('../') || isAbsolute(path)) return 'out-of-root';
  if (/\.d\.[cm]?ts$/.test(path)) return 'dts';
  return 'excluded-file';
}

export interface EdgeEvidence {
  readonly key: EdgeKey;
  readonly tsc: readonly RefOccurrence[];
  readonly dc: DcEdgeInfo | undefined;
  readonly apg: ApgEdgeInfo | undefined;
}

export interface ClassifyContext {
  readonly apgFiles: ReadonlySet<string>;
  /** tsc occurrences per source file. */
  readonly tscBySource: ReadonlyMap<string, readonly RefOccurrence[]>;
  /** APG edges (this variant) per source file. */
  readonly apgBySource: ReadonlyMap<string, readonly { target: string; info: ApgEdgeInfo }[]>;
}

/** The tsc targets that `source` reaches in at most `depth` hops, starting at `start` (any static kind). */
function reaches(start: string, goal: string, ctx: ClassifyContext, depth = 10): boolean {
  const seen = new Set<string>([start]);
  let frontier = [start];
  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const o of ctx.tscBySource.get(f) ?? []) {
        if (o.kind === 'dynamic-import' || o.kind === 'require') continue;
        if (o.target === goal) return true;
        if (!seen.has(o.target)) { seen.add(o.target); next.push(o.target); }
      }
    }
    frontier = next;
  }
  return false;
}

/** APG edge s→t whose specifier resolves (tsc) to another file b that re-exports or imports t: barrel routing. */
export function barrelVia(source: string, target: string, info: ApgEdgeInfo, ctx: ClassifyContext): string | undefined {
  for (const sp of info.specifiers) {
    for (const o of ctx.tscBySource.get(source) ?? []) {
      if (o.specifier !== sp || o.target === target) continue;
      if (reaches(o.target, target, ctx)) return o.target;
    }
  }
  return undefined;
}

/** Ref edge s→b (not in APG) where APG has an edge from s carrying a specifier that resolves to b: names routed past b. */
export function routedPastBarrel(source: string, target: string, tsc: readonly RefOccurrence[], ctx: ClassifyContext): boolean {
  const specs = new Set(tsc.map((o) => o.specifier));
  if (specs.size === 0) return false;
  for (const e of ctx.apgBySource.get(source) ?? []) {
    if (e.target === target) continue;
    if (e.info.specifiers.some((s) => specs.has(s))) return true;
  }
  return false;
}

function classifyByKinds(occ: readonly RefOccurrence[], dcTypes: readonly string[]): ReasonClass | undefined {
  if (occ.length > 0) {
    if (occ.every((o) => o.kind === 'dynamic-import')) return 'dynamic-import';
    if (occ.every((o) => o.kind === 'require' || o.kind === 'import-equals')) return 'require';
    if (occ.every((o) => o.kind === 'dynamic-import' || o.kind === 'require')) return 'dynamic-import';
    if (occ.every((o) => TYPE_ONLY_KINDS.has(o.kind))) return 'type-only';
    if (occ.some((o) => o.alias)) return 'path-alias';
    if (occ.some((o) => o.indexResolution)) return 'index-resolution';
    if (occ.some((o) => o.kind === 're-export' || o.kind === 'type-re-export')) return 're-export/barrel';
    return undefined;
  }
  if (dcTypes.includes('dynamic-import')) return 'dynamic-import';
  if (dcTypes.includes('require')) return 'require';
  if (dcTypes.includes('type-only') || dcTypes.includes('type-import')) return 'type-only';
  if (dcTypes.some((t) => t.startsWith('aliased'))) return 'path-alias';
  if (dcTypes.includes('export')) return 're-export/barrel';
  return undefined;
}

/**
 * Reason class of one disagreement: `missingSide` = `apg` (a reference has the edge, the APG does not) or `ref`.
 * Order: scope (.d.ts, out-of-root, excluded-file), then barrel routing, then the occurrence kinds, else extractor-bug.
 */
export function classify(ev: EdgeEvidence, missingSide: 'apg' | 'ref', ctx: ClassifyContext): ReasonClass {
  const [s, t] = splitKey(ev.key);
  const ss = scopeOf(s, ctx.apgFiles);
  const ts_ = scopeOf(t, ctx.apgFiles);
  if (ts_ === 'dts' || ss === 'dts') return '.d.ts';
  if (ts_ === 'out-of-root' || ss === 'out-of-root') return 'out-of-root';
  if (ts_ === 'excluded-file' || ss === 'excluded-file') return 'excluded-file';
  if (missingSide === 'apg') {
    if (routedPastBarrel(s, t, ev.tsc, ctx)) return 're-export/barrel';
    return classifyByKinds(ev.tsc, ev.dc?.dependencyTypes ?? []) ?? 'extractor-bug';
  }
  if (ev.apg !== undefined) {
    if (barrelVia(s, t, ev.apg, ctx) !== undefined) return 're-export/barrel';
    if (ev.apg.dynamic) return 'dynamic-import';
  }
  return classifyByKinds(ev.tsc, ev.dc?.dependencyTypes ?? []) ?? 'extractor-bug';
}

/** Stratum of an agreement edge for the adjudication sample. */
export function agreementStratum(occ: readonly RefOccurrence[]): string {
  if (occ.some((o) => o.kind === 'dynamic-import')) return 'dynamic-import';
  if (occ.some((o) => o.kind === 'require' || o.kind === 'import-equals')) return 'require';
  if (occ.some((o) => o.kind === 're-export' || o.kind === 'type-re-export')) return 're-export';
  if (occ.every((o) => TYPE_ONLY_KINDS.has(o.kind)) && occ.length > 0) return 'type-only';
  if (occ.some((o) => o.alias)) return 'path-alias';
  if (occ.some((o) => o.indexResolution)) return 'index-resolution';
  if (occ.some((o) => o.kind === 'side-effect')) return 'side-effect';
  return 'static-relative';
}

// ── Suggested verdict (read the source line) ────────────────────────────────

export interface SuggestedVerdict {
  readonly verdict: 'exists-resolves-to-target' | 'exists-via-barrel' | 'not-found-in-source' | 'exists-resolves-elsewhere';
  readonly specifier: string;
  readonly line: number;
  readonly lineText: string;
  readonly basis: string;
}

function findSpecifierLine(lines: readonly string[], specifier: string, hint: number): number {
  const needles = [`'${specifier}'`, `"${specifier}"`, `\`${specifier}\``];
  const has = (i: number): boolean => needles.some((n) => (lines[i] ?? '').includes(n));
  if (hint >= 1) for (let i = hint - 1; i < Math.min(lines.length, hint + 40); i++) if (has(i)) return i + 1;
  for (let i = 0; i < lines.length; i++) if (has(i)) return i + 1;
  return 0;
}

/**
 * Suggested verdict for edge s→t: does the source text contain an import whose specifier resolves to t (or to a
 * barrel that reaches t)? Uses the candidate specifiers (tsc occurrences, APG specifiers, depcruise module names).
 */
export function suggestVerdict(
  root: string, ev: EdgeEvidence, ctx: ClassifyContext, compilerOptions: ts.CompilerOptions,
): SuggestedVerdict {
  const [s, t] = splitKey(ev.key);
  const abs = join(root, s);
  const text = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  const lines = text.split('\n');
  const cands: { specifier: string; hint: number }[] = [
    ...ev.tsc.map((o) => ({ specifier: o.specifier, hint: o.line })),
    ...(ev.apg?.specifiers ?? []).map((sp, i) => ({ specifier: sp, hint: ev.apg?.lines[i] ?? 0 })),
    ...(ev.dc?.modules ?? []).map((m) => ({ specifier: m, hint: 0 })),
  ];
  let fallback: SuggestedVerdict | undefined;
  for (const c of cands) {
    const line = findSpecifierLine(lines, c.specifier, c.hint);
    if (line === 0) continue;
    const lineText = (lines[line - 1] ?? '').trim().slice(0, 200);
    const r = ts.resolveModuleName(c.specifier, abs, compilerOptions, ts.sys).resolvedModule;
    const resolved = r === undefined ? undefined : rel(root, resolve(r.resolvedFileName));
    if (resolved === t) {
      return { verdict: 'exists-resolves-to-target', specifier: c.specifier, line, lineText, basis: `suggested: '${c.specifier}' on line ${String(line)} resolves (ts.resolveModuleName) to ${t}` };
    }
    if (resolved !== undefined && reaches(resolved, t, ctx)) {
      fallback ??= { verdict: 'exists-via-barrel', specifier: c.specifier, line, lineText, basis: `suggested: '${c.specifier}' resolves to ${resolved}, which reaches ${t} through its own imports/re-exports; no direct import of ${t}` };
    } else {
      fallback ??= { verdict: 'exists-resolves-elsewhere', specifier: c.specifier, line, lineText, basis: `suggested: '${c.specifier}' resolves to ${resolved ?? '(unresolved)'}, not ${t}` };
    }
  }
  return fallback ?? { verdict: 'not-found-in-source', specifier: cands[0]?.specifier ?? '', line: 0, lineText: '', basis: 'suggested: no candidate specifier found in the source text' };
}

// ── CSV ──────────────────────────────────────────────────────────────────────

export function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? ''
    : Array.isArray(v) ? v.map((x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x))).join(';')
    : typeof v === 'string' ? v : JSON.stringify(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n') + '\n';
}
