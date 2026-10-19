/**
 * TIER-A2 item 6 (C1a; rev-04 rows SO2-2, SO2-3): type-resolution rate and FLOWS_TO yield of the v1.3 extractor on
 * the external sets (results/v1.3-external{,-2,-3}/selection.json). Zero model calls, no Neo4j, no network: it reads
 * local clones at the pinned SHAs and runs the extractor in-process.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/tier-a/item06-type-resolution.ts --clones <dir> [--out results/v1.4-tier-a/item06-type-resolution.json]
 * `<dir>/<id>` must be a checkout of entry `<id>` at its pinned sha (the script checks HEAD when `.git` exists).
 *
 * Per project, exactly as `firewall evaluate` extracts it (`ExtractCommand`: the v1.3 defaults plus the spec's
 * `default_exclude_paths`, the root's tsconfig.json, no node_modules in the clone):
 *  1. `extractAPG` gives the graph: edge counts by type, extractor warnings, `importResolution`, `flowsTo`.
 *  2. A second ts-morph Project, built with the same options and the same analysed-file filter, plus `extractNodes`
 *     for the node lookup, classifies every type reference. Two families:
 *     A. every syntactic type reference in an analysed file (a TypeReference node, or a heritage-clause
 *        ExpressionWithTypeArguments), minus references to type parameters. Outcome from the type checker:
 *        `resolved` (a declaration is bound; split `internal` = declared in an analysed file, `external` = elsewhere,
 *        e.g. lib.d.ts) or `unresolved` (the checker's error type, or no symbol). Unresolved ones are split by cause:
 *        `package` (the name is imported from a bare specifier: the package is not installed), `relative` (imported
 *        from a relative / path-alias specifier), `global` (no import: an ambient name such as `Express.Request`).
 *     B. the type references the v1.3 extractor turns into type-checker edges: `extends` clauses (EXTENDS), `implements`
 *        clauses (IMPLEMENTS), and annotated parameters of a class's first constructor whose annotation is not a
 *        primitive or a one-letter type parameter (CONSTRUCTOR_INJECTS). Outcome: `edge` (the extractor's logic,
 *        replicated, writes an edge to an extracted node), `boundOutsideGraph` (the checker binds it, to a declaration
 *        with no extracted node), `unresolved` (the checker cannot bind it). The replicated `edge` counts are checked
 *        against the graph's EXTENDS / IMPLEMENTS / CONSTRUCTOR_INJECTS counts (`check` in the output).
 *  3. FLOWS_TO: the extractor's own store tally (`flowsTo`), and the same stores re-enumerated (D8 scope of
 *     `flows-to-deriver.ts`) with the value type classified, plus the constructor parameter properties, which D8
 *     leaves to CONSTRUCTOR_INJECTS by design.
 * Rates carry 95% Wilson intervals; the pooled rates also a repository-cluster bootstrap (2,000 resamples, seed
 * 20261019). Output is deterministic (sorted keys in entry order, no timestamps).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import picomatch from 'picomatch';
import { Node, Project, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, SourceFile, Type } from 'ts-morph';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { DEFAULT_EXCLUDE_PATTERNS, DEFAULT_OPTIONS, PRIMITIVE_TYPES } from '../../../src/apg-extractor/types.js';
import type { NodeLookup } from '../../../src/apg-extractor/types.js';
import { normalizeFilePath } from '../../../src/apg-extractor/id-generator.js';
import { readSpecExcludePaths } from '../../../src/spec-parser/exclude-paths.js';
import { wilson } from '../../lib/stats.js';

const WAVES = ['results/v1.3-external', 'results/v1.3-external-2', 'results/v1.3-external-3'] as const;
const SEED = 20261019;
const RESAMPLES = 2000;

interface Entry { id: string; url: string; sha: string; root: string; tsconfig: string; style: string }

type Counter = Record<string, number>;
const inc = (c: Counter, k: string, by = 1): void => { c[k] = (c[k] ?? 0) + by; };

function isErrorType(t: Type): boolean {
  return (t.compilerType as unknown as { intrinsicName?: string }).intrinsicName === 'error';
}

/** Cause of an unresolved reference: where its leftmost name comes from. */
function unresolvedCause(nameNode: Node): 'package' | 'relative' | 'global' {
  const leftmost = Node.isQualifiedName(nameNode) ? leftmostOf(nameNode) : Node.isPropertyAccessExpression(nameNode) ? leftmostOf(nameNode) : nameNode;
  const sym = leftmost.getSymbol();
  const decl = sym?.getDeclarations()[0];
  if (decl === undefined) return 'global';
  const imp = decl.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
  if (imp !== undefined) {
    const spec = imp.getModuleSpecifierValue();
    return spec.startsWith('.') || spec.startsWith('/') ? 'relative' : 'package';
  }
  const ieq = Node.isImportEqualsDeclaration(decl) ? decl : decl.getFirstAncestorByKind(SyntaxKind.ImportEqualsDeclaration);
  if (ieq !== undefined) {
    const ref = ieq.getModuleReference().getText();
    return /require\(\s*['"][./]/.test(ref) ? 'relative' : 'package';
  }
  return 'global';
}
function leftmostOf(n: Node): Node {
  let cur: Node = n;
  for (;;) {
    if (Node.isQualifiedName(cur)) cur = cur.getLeft();
    else if (Node.isPropertyAccessExpression(cur)) cur = cur.getExpression();
    else return cur;
  }
}

function shouldSkipDIType(typeName: string): boolean {
  const baseType = typeName.replace(/<.*>/, '').replace(/\[\]/, '').trim();
  return PRIMITIVE_TYPES.has(baseType) || /^[A-Z]$/.test(baseType);
}

/** Family A: one syntactic type reference. */
function classifyReference(node: Node, analysedPaths: Set<string>): { outcome: string; cause?: string } | undefined {
  let nameNode: Node;
  let type: Type;
  if (Node.isTypeReference(node)) {
    nameNode = node.getTypeName();
    type = node.getType();
  } else if (Node.isExpressionWithTypeArguments(node)) {
    nameNode = node.getExpression();
    type = node.getType();
  } else return undefined;
  if (type.isTypeParameter()) return undefined;
  const sym = nameNode.getSymbol();
  const target = sym?.isAlias() ? sym.getAliasedSymbol() : sym;
  const decls = target?.getDeclarations() ?? [];
  const firstDecl = decls[0];
  if (firstDecl !== undefined && Node.isTypeParameterDeclaration(firstDecl)) return undefined;
  if (isErrorType(type) || firstDecl === undefined) return { outcome: 'unresolved', cause: unresolvedCause(nameNode) };
  const internal = decls.some((d) => analysedPaths.has(d.getSourceFile().getFilePath()));
  return { outcome: internal ? 'resolvedInternal' : 'resolvedExternal' };
}

function lookupType(lookup: NodeLookup, name: string, file: string, root: string): string | undefined {
  return lookup.typeNodes.get(`${name.toLowerCase()}@${normalizeFilePath(file, root)}`);
}

/** Family B, IMPLEMENTS: the extractor's two paths (type symbol, then the file's relative imports). */
function implementsOutcome(sf: SourceFile, impl: Node & { getExpression(): Node; getType(): Type }, lookup: NodeLookup, root: string): 'edge' | 'boundOutsideGraph' | 'unresolved' {
  const ifaceName = impl.getExpression().getText().split('<')[0]!.trim();
  const implType = impl.getType();
  const symbol = implType.getSymbol() ?? implType.getAliasSymbol();
  if (symbol && symbol.getDeclarations().length > 0) {
    const decl = symbol.getDeclarations()[0]!;
    if (Node.isInterfaceDeclaration(decl) && lookupType(lookup, ifaceName, decl.getSourceFile().getFilePath(), root) !== undefined) return 'edge';
  }
  for (const importDecl of sf.getImportDeclarations()) {
    if (!importDecl.getNamedImports().some((n) => n.getName() === ifaceName)) continue;
    const specifier = importDecl.getModuleSpecifierValue();
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;
    const base = path.resolve(path.dirname(sf.getFilePath()), specifier);
    for (const c of [`${base}.ts`, `${base}/index.ts`, base]) if (lookupType(lookup, ifaceName, c, root) !== undefined) return 'edge';
  }
  if (isErrorType(implType) || symbol === undefined || symbol.getDeclarations().length === 0) return 'unresolved';
  return 'boundOutsideGraph';
}

function ctorOutcome(param: import('ts-morph').ParameterDeclaration, lookup: NodeLookup, root: string, onEdge: (targetId: string) => void): 'edge' | 'boundOutsideGraph' | 'unresolved' | 'notCounted' {
  const typeNode = param.getTypeNode();
  if (typeNode === undefined) return 'notCounted';
  if (shouldSkipDIType(typeNode.getText())) return 'notCounted';
  const raw = param.getType();
  // The extractor's own skip runs on the checker's text: an unresolved type prints as `any` and is skipped silently.
  if (isErrorType(raw)) return 'unresolved';
  if (shouldSkipDIType(raw.getText())) return 'boundOutsideGraph';
  let t = raw;
  if (DEFAULT_OPTIONS.nullableInjects && t.isUnion()) {
    const rest = t.getUnionTypes().filter((u) => !u.isNull() && !u.isUndefined());
    if (rest.length === 1 && rest[0] !== undefined) t = rest[0];
  }
  const sym = t.getSymbol() ?? t.getAliasSymbol();
  const decl = sym?.getDeclarations()[0];
  if (decl === undefined) return 'boundOutsideGraph';
  const name = Node.isClassDeclaration(decl) || Node.isInterfaceDeclaration(decl) ? decl.getName() ?? '' : '';
  const targetId = name === '' ? undefined : lookupType(lookup, name, decl.getSourceFile().getFilePath(), root);
  if (targetId !== undefined) { onEdge(targetId); return 'edge'; }
  return 'boundOutsideGraph';
}

/** FLOWS_TO: the value type of one D8-scope store, classified (`flows-to-deriver.ts` resolveTarget, finer). */
function storeClass(t: Type, lookup: NodeLookup, root: string, selfId: string): string {
  if (t.isUnion() || t.isIntersection()) return 'unionOrIntersection';
  if (isErrorType(t)) return 'unresolvedType';
  if (t.isAny() || t.isUnknown()) return 'anyOrUnknown';
  if (t.isString() || t.isNumber() || t.isBoolean() || t.isLiteral() || t.isNull() || t.isUndefined() || t.isStringLiteral() || t.isNumberLiteral() || t.isBooleanLiteral() || t.isEnumLiteral() || t.isEnum()) return 'primitiveOrLiteral';
  const sym = t.getSymbol() ?? t.getAliasSymbol();
  const decl = sym?.getDeclarations()[0];
  if (decl === undefined) return 'noDeclaration';
  if (!Node.isClassDeclaration(decl) && !Node.isInterfaceDeclaration(decl)) return t.isArray() ? 'arrayOrBuiltin' : t.isAnonymous() ? 'anonymousOrFunction' : 'otherDeclaration';
  const name = decl.getName();
  const id = name === undefined ? undefined : lookupType(lookup, name, decl.getSourceFile().getFilePath(), root);
  if (id === undefined) return 'classOrInterfaceOutsideGraph';
  return id === selfId ? 'selfLoop' : 'extractedTarget';
}

function flowsStores(cls: ClassDeclaration, lookup: NodeLookup, root: string, selfId: string, out: Counter): void {
  const fields = new Set<string>();
  let paramProps = 0;
  for (const p of cls.getProperties()) if (!p.isStatic()) fields.add(p.getName());
  for (const c of cls.getConstructors()) for (const p of c.getParameters()) if (p.isParameterProperty()) { fields.add(p.getName()); paramProps++; }
  inc(out, 'constructorParameterProperties', paramProps);
  if (fields.size === 0) return;
  const consider = (via: string, expr: Node): void => { inc(out, 'stores'); inc(out, `via.${via}`); inc(out, `value.${storeClass(expr.getType(), lookup, root, selfId)}`); };
  for (const prop of cls.getProperties()) {
    if (prop.isStatic()) continue;
    const init = prop.getInitializer();
    if (init !== undefined && Node.isNewExpression(init)) consider('new', init);
  }
  for (const bin of cls.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
    const left = bin.getLeft();
    if (!Node.isPropertyAccessExpression(left) || left.getExpression().getKind() !== SyntaxKind.ThisKeyword) continue;
    if (!fields.has(left.getName())) continue;
    const container = thisContainer(left);
    if (container === undefined || !isInstanceMemberOf(container, cls)) continue;
    const right = bin.getRight();
    if (Node.isNewExpression(right)) consider('new', right);
    else if (!Node.isConstructorDeclaration(container)) consider('field-assignment', right);
    else inc(out, 'excludedConstructorBodyNonNewAssignments');
  }
}
function thisContainer(node: Node): Node | undefined {
  for (let cur = node.getParent(); cur !== undefined; cur = cur.getParent()) {
    if (Node.isArrowFunction(cur)) continue;
    if (Node.isMethodDeclaration(cur) || Node.isConstructorDeclaration(cur) || Node.isGetAccessorDeclaration(cur) || Node.isSetAccessorDeclaration(cur)
      || Node.isPropertyDeclaration(cur) || Node.isFunctionDeclaration(cur) || Node.isFunctionExpression(cur) || Node.isClassStaticBlockDeclaration(cur)
      || Node.isClassDeclaration(cur) || Node.isClassExpression(cur)) return cur;
  }
  return undefined;
}
function isInstanceMemberOf(container: Node, cls: ClassDeclaration): boolean {
  if (container.getParent() !== cls) return false;
  if (Node.isConstructorDeclaration(container)) return true;
  if (Node.isMethodDeclaration(container) || Node.isGetAccessorDeclaration(container) || Node.isSetAccessorDeclaration(container) || Node.isPropertyDeclaration(container)) return !container.isStatic();
  return false;
}

async function measure(e: Entry, wave: string, clones: string, repoRoot: string): Promise<Record<string, unknown>> {
  const clone = path.join(clones, e.id);
  let head: string | null = null;
  if (fs.existsSync(path.join(clone, '.git'))) head = execFileSync('git', ['-C', clone, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== null && head !== e.sha) return { id: e.id, wave, error: `clone HEAD ${head} is not the pinned sha` };
  const root = path.resolve(clone, e.root);
  const tsconfig = path.join(root, e.tsconfig);
  const specExcludes = readSpecExcludePaths(path.join(repoRoot, wave, 'specs', `${e.id}.yaml`));

  // 1. The evaluated graph.
  const res = await extractAPG(root, { excludePatterns: specExcludes }, tsconfig);
  if (!res.success) return { id: e.id, wave, error: res.errors.map((x) => x.message).join('; ') };
  const g = res.data;
  const edgesByType: Counter = {};
  for (const ed of g.edges) inc(edgesByType, ed.type);
  const warnings: Counter = {};
  for (const w of g.warnings) inc(warnings, w.code);

  // 2. The same project, re-opened for the per-reference classification.
  const isExcluded = picomatch([...DEFAULT_EXCLUDE_PATTERNS, ...specExcludes], { dot: true });
  const project = new Project({ tsConfigFilePath: tsconfig, skipAddingFilesFromTsConfig: false, skipFileDependencyResolution: DEFAULT_OPTIONS.lenientMode });
  const sourceFiles = project.getSourceFiles().filter((sf) => !isExcluded(path.relative(root, sf.getFilePath())));
  const analysed = new Set(sourceFiles.map((sf) => sf.getFilePath()));
  const { lookup } = extractNodes(sourceFiles, root, {});

  const famA: Counter = {};
  const famB: Record<string, Counter> = { extends: {}, implements: {}, constructorParam: {} };
  const flows: Counter = {};
  const ctorEdgeKeys = new Set<string>();
  for (const sf of sourceFiles) {
    sf.forEachDescendant((n) => {
      if (!Node.isTypeReference(n) && !(Node.isExpressionWithTypeArguments(n) && Node.isHeritageClause(n.getParent()))) return;
      try {
        const r = classifyReference(n, analysed);
        if (r === undefined) { inc(famA, 'excludedTypeParameter'); return; }
        inc(famA, r.outcome);
        if (r.cause !== undefined) inc(famA, `unresolved.${r.cause}`);
      } catch { inc(famA, 'classifierError'); }
    });
    const filePath = normalizeFilePath(sf.getFilePath(), root);
    for (const cls of sf.getClasses()) {
      const clsId = lookup.typeNodes.get(`${(cls.getName() ?? '<anonymous>').toLowerCase()}@${filePath}`);
      if (clsId === undefined) continue;
      const ext = cls.getExtends();
      if (ext !== undefined) {
        const base = cls.getBaseClass();
        const out = base !== undefined
          ? (lookupType(lookup, base.getName() ?? '', base.getSourceFile().getFilePath(), root) !== undefined ? 'edge' : 'boundOutsideGraph')
          : (isErrorType(ext.getType()) || ext.getExpression().getSymbol() === undefined ? 'unresolved' : 'boundOutsideGraph');
        inc(famB.extends!, out);
      }
      for (const impl of cls.getImplements()) {
        try { inc(famB.implements!, implementsOutcome(sf, impl, lookup, root)); } catch { inc(famB.implements!, 'classifierError'); }
      }
      const ctor = cls.getConstructors()[0];
      if (ctor !== undefined) {
        for (const p of ctor.getParameters()) {
          try { inc(famB.constructorParam!, ctorOutcome(p, lookup, root, (t) => ctorEdgeKeys.add(`${clsId}>${t}`))); } catch { inc(famB.constructorParam!, 'classifierError'); }
        }
      }
      flowsStores(cls, lookup, root, clsId, flows);
    }
  }
  const b = (k: string, o: string): number => famB[k]![o] ?? 0;
  return {
    id: e.id, wave, sha: e.sha, style: e.style,
    analysedFiles: sourceFiles.length,
    graph: { edgesByType, importResolution: g.importResolution, flowsTo: g.flowsTo, warnings },
    familyA: famA,
    familyB: famB,
    flowsToStores: flows,
    check: {
      extendsEdgeReplicated: b('extends', 'edge'), extendsEdgeGraph: edgesByType.EXTENDS ?? 0,
      implementsEdgeReplicated: b('implements', 'edge'), implementsEdgeGraph: edgesByType.IMPLEMENTS ?? 0,
      ctorEdgeReplicated: b('constructorParam', 'edge'), ctorEdgeReplicatedDistinctPairs: ctorEdgeKeys.size, ctorEdgeGraph: edgesByType.CONSTRUCTOR_INJECTS ?? 0,
      flowsToStoresReplicated: flows.stores ?? 0, flowsToStoresGraph: g.flowsTo?.stores ?? 0,
      edgeCountDiffVsCommittedReport: committedEdgeCountDiff(path.join(repoRoot, wave, 'findings', `${e.id}.json`), edgesByType),
    },
  };
}

/**
 * The committed run's `graphStats.edgeCountByType` (findings/<id>.json) against this extraction, over the edge types
 * the report lists (it has no MODULE_* entries): `{}` = identical, else `{type: [committed, now]}`; null when absent.
 */
function committedEdgeCountDiff(file: string, edgesByType: Counter): Record<string, [number, number]> | null {
  if (!fs.existsSync(file)) return null;
  const committed = (JSON.parse(fs.readFileSync(file, 'utf8')) as { graphStats?: { edgeCountByType?: Counter } }).graphStats?.edgeCountByType;
  if (committed === undefined) return null;
  const diff: Record<string, [number, number]> = {};
  for (const k of Object.keys(committed).sort()) if ((committed[k] ?? 0) !== (edgesByType[k] ?? 0)) diff[k] = [committed[k] ?? 0, edgesByType[k] ?? 0];
  return diff;
}

function mulberry32(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rate(k: number, n: number): Record<string, number | null> {
  if (n === 0) return { k, n, rate: null, wilsonLow: null, wilsonHigh: null };
  const w = wilson(k, n);
  return { k, n, rate: round(k / n), wilsonLow: round(w.low), wilsonHigh: round(w.high) };
}
function clusterBoot(pairs: [number, number][]): { low: number; high: number } | null {
  if (pairs.length === 0) return null;
  const rnd = mulberry32(SEED);
  const stats: number[] = [];
  for (let r = 0; r < RESAMPLES; r++) {
    let k = 0; let n = 0;
    for (let i = 0; i < pairs.length; i++) { const p = pairs[Math.floor(rnd() * pairs.length)]!; k += p[0]; n += p[1]; }
    if (n > 0) stats.push(k / n);
  }
  stats.sort((x, y) => x - y);
  return { low: round(stats[Math.floor(0.025 * (stats.length - 1))]!), high: round(stats[Math.ceil(0.975 * (stats.length - 1))]!) };
}
const round = (x: number): number => Math.round(x * 1e6) / 1e6;

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const argv = process.argv.slice(2);
  const arg = (k: string): string | undefined => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const clones = arg('--clones');
  if (clones === undefined) throw new Error('usage: --clones <dir> [--out <file>] [--only id,id]');
  const out = path.resolve(repoRoot, arg('--out') ?? 'results/v1.4-tier-a/item06-type-resolution.json');
  const only = arg('--only')?.split(',');
  const projects: Record<string, unknown>[] = [];
  for (const wave of WAVES) {
    const sel = JSON.parse(fs.readFileSync(path.join(repoRoot, wave, 'selection.json'), 'utf8')) as { entries: Entry[] };
    for (const e of sel.entries) {
      if (only !== undefined && !only.includes(e.id)) continue;
      const t0 = Date.now();
      let r: Record<string, unknown>;
      try { r = await measure(e, wave, path.resolve(clones), repoRoot); } catch (err) { r = { id: e.id, wave, error: String(err) }; }
      process.stderr.write(`${e.id}: ${r.error !== undefined ? `ERROR ${String(r.error)}` : 'ok'} (${String(Date.now() - t0)} ms)\n`);
      projects.push(r);
    }
  }
  const ok = projects.filter((p) => p.error === undefined) as unknown as { id: string; familyA: Counter; familyB: Record<string, Counter>; flowsToStores: Counter; graph: { edgesByType: Counter; flowsTo: Counter } }[];
  const rowsA = ok.map((p) => { const ri = p.familyA.resolvedInternal ?? 0; const re = p.familyA.resolvedExternal ?? 0; const u = p.familyA.unresolved ?? 0; return { id: p.id, resolved: ri + re, internal: ri, n: ri + re + u, unresolvedPackage: p.familyA['unresolved.package'] ?? 0, unresolvedRelative: p.familyA['unresolved.relative'] ?? 0, unresolvedGlobal: p.familyA['unresolved.global'] ?? 0 }; });
  const bTotals = (p: (typeof ok)[number]): { edge: number; bound: number; unres: number } => {
    let edge = 0; let bound = 0; let unres = 0;
    for (const k of ['extends', 'implements', 'constructorParam']) { const c = p.familyB[k]!; edge += c.edge ?? 0; bound += c.boundOutsideGraph ?? 0; unres += c.unresolved ?? 0; }
    return { edge, bound, unres };
  };
  const rowsB = ok.map((p) => { const t = bTotals(p); return { id: p.id, ...t, n: t.edge + t.bound + t.unres }; });
  const sum = <T>(xs: T[], f: (x: T) => number): number => xs.reduce((s, x) => s + f(x), 0);
  const nA = sum(rowsA, (r) => r.n); const kA = sum(rowsA, (r) => r.resolved);
  const nB = sum(rowsB, (r) => r.n); const kBres = sum(rowsB, (r) => r.edge + r.bound); const kBedge = sum(rowsB, (r) => r.edge);
  const pooled = {
    projects: ok.length,
    failed: projects.filter((p) => p.error !== undefined).map((p) => ({ id: p.id, error: p.error })),
    familyA: {
      checkerResolvedRate: { ...rate(kA, nA), clusterBootstrap: clusterBoot(rowsA.map((r) => [r.resolved, r.n])) },
      unresolvedByCause: { package: sum(rowsA, (r) => r.unresolvedPackage), relative: sum(rowsA, (r) => r.unresolvedRelative), global: sum(rowsA, (r) => r.unresolvedGlobal) },
      resolvedInternal: sum(rowsA, (r) => r.internal),
      resolvedRateExcludingPackageCause: rate(kA, nA - sum(rowsA, (r) => r.unresolvedPackage)),
      macroMeanRate: round(sum(rowsA.filter((r) => r.n > 0), (r) => r.resolved / r.n) / rowsA.filter((r) => r.n > 0).length),
    },
    familyB: {
      checkerResolvedRate: { ...rate(kBres, nB), clusterBootstrap: clusterBoot(rowsB.map((r) => [r.edge + r.bound, r.n])) },
      graphEdgeRate: { ...rate(kBedge, nB), clusterBootstrap: clusterBoot(rowsB.map((r) => [r.edge, r.n])) },
      byKind: Object.fromEntries(['extends', 'implements', 'constructorParam'].map((k) => [k, {
        edge: sum(ok, (p) => p.familyB[k]!.edge ?? 0), boundOutsideGraph: sum(ok, (p) => p.familyB[k]!.boundOutsideGraph ?? 0), unresolved: sum(ok, (p) => p.familyB[k]!.unresolved ?? 0), notCounted: sum(ok, (p) => p.familyB[k]!.notCounted ?? 0),
      }])),
    },
    flowsTo: {
      edges: sum(ok, (p) => p.graph.edgesByType.FLOWS_TO ?? 0),
      projectsWithAnyEdge: ok.filter((p) => (p.graph.edgesByType.FLOWS_TO ?? 0) > 0).length,
      tally: Object.fromEntries(['stores', 'candidates', 'skippedUnionOrIntersection', 'skippedUnextractedTarget', 'skippedSelfLoop', 'edges'].map((k) => [k, sum(ok, (p) => p.graph.flowsTo[k] ?? 0)])),
      storesReclassified: (() => { const c: Counter = {}; for (const p of ok) for (const [k, v] of Object.entries(p.flowsToStores)) inc(c, k, v); return Object.fromEntries(Object.entries(c).sort(([a], [b2]) => a.localeCompare(b2))); })(),
      constructorInjectsEdges: sum(ok, (p) => p.graph.edgesByType.CONSTRUCTOR_INJECTS ?? 0),
    },
  };
  const doc = {
    item: 'TIER-A2 item 6 (C1a): type-resolution rate and FLOWS_TO yield on the external sets',
    script: 'scripts/v1.4/tier-a/item06-type-resolution.ts',
    inputs: WAVES.map((w) => `${w}/selection.json`),
    extractor: 'src/apg-extractor (v1.3 defaults + spec default_exclude_paths, as ExtractCommand); clones without node_modules, as the committed runs (run-provenance.json)',
    bootstrap: { seed: SEED, resamples: RESAMPLES, unit: 'repository' },
    pooled,
    perProjectA: rowsA.map((r) => ({ ...r, ...rate(r.resolved, r.n) })),
    perProjectB: rowsB.map((r) => ({ ...r, checker: rate(r.edge + r.bound, r.n), graphEdge: rate(r.edge, r.n) })),
    projects,
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  process.stderr.write(`wrote ${path.relative(repoRoot, out)}\n`);
}

void main();
