/**
 * Shared helpers of the v1.3 hexagonal and DDD operators (DRAFT; `Docs/v1.3/operator-catalogue-hexddd.md`).
 *
 * Everything here reads the ts-morph project of one copy and the parsed spec, never a detector output. The layer
 * roles come from the spec, not from names: the core is the `domain`-kind layer; the use-case layers are the
 * `application`-kind layers that some allowed edge points to (the composition root is the application-kind layer no
 * edge points to, `Docs/v1.3-hexagonal-notes.md` §3); the inbound adapter layer is the `presentation`-kind layer and
 * the outbound adapter layer the `infrastructure`-kind layer. DDD roles (contexts, public API, ACL, aggregates, value
 * objects, repositories) are read from `architecture.ddd` and matched with picomatch, as declared.
 */
import { reject } from './types.js';
import { Node, Scope, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, SourceFile } from 'ts-morph';
import picomatch from 'picomatch';
import type { DddAggregate, DddContext, DddModel } from '../../../../src/shared/types/spec.js';
import type { ImportGraph, MutationSite, ParsedSpec, PreconditionContext, PreconditionResult, ProjectHandle } from '../types.js';
import { exportedNames, fileAt, layerOfFile, projectFiles, relOf, specView } from '../operators/common.js';
import type { SpecView } from '../operators/common.js';

export interface HexRoles {
  readonly view: SpecView;
  readonly domain: string | undefined;
  readonly useCase: readonly string[];
  readonly inbound: string | undefined;
  readonly outbound: string | undefined;
  /** `from>to` pairs of `architecture.allowed_dependencies`. */
  readonly allowed: ReadonlySet<string>;
}

/** Layer roles of a hexagonal or DDD spec (any other style: no allowed graph, every role from the kind binding). */
export function hexRoles(spec: ParsedSpec): HexRoles {
  const view = specView(spec);
  const deps = spec.layerModel.allowedDependencies ?? [];
  const targets = new Set(deps.map((d) => d.to));
  const useCase = spec.layerModel.layers.filter((l) => l.kind === 'application' && targets.has(l.name)).map((l) => l.name);
  const first = (kind: string): string | undefined => spec.layerModel.layers.find((l) => l.kind === kind)?.name;
  return {
    view,
    domain: first('domain'),
    useCase,
    inbound: first('presentation'),
    outbound: first('infrastructure'),
    allowed: new Set(deps.map((d) => `${d.from}>${d.to}`)),
  };
}

export function layerOf(roles: HexRoles, rel: string): string | null {
  return layerOfFile(roles.view, rel);
}

/**
 * True when an import from layer `a` to layer `b` breaks no layering rule: same layer, either side unlayered, or an
 * allowed edge `a>b`.
 */
export function layerPairOk(roles: HexRoles, a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b || roles.allowed.has(`${a}>${b}`);
}

export function filesIn(handle: ProjectHandle, roles: HexRoles, layers: readonly (string | undefined)[]): SourceFile[] {
  const want = new Set(layers.filter((l): l is string => l !== undefined));
  return projectFiles(handle).filter((sf) => {
    const l = layerOf(roles, relOf(handle, sf));
    return l !== null && want.has(l);
  });
}

/** Exported, named, non-abstract classes declared in the file. */
export function exportedClasses(sf: SourceFile): ClassDeclaration[] {
  return sf.getClasses().filter((c) => c.getName() !== undefined && c.isExported() && !c.isDefaultExport());
}

/** Exported interfaces declared in the file. */
export function exportedInterfaces(sf: SourceFile): string[] {
  return sf.getInterfaces().filter((i) => i.isExported() && !i.isDefaultExport()).map((i) => i.getName());
}

// ── Base-graph reachability (twins must not close a cycle) ──────────────────────────────────────────────────────

function adjacency(g: ImportGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of g.edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  return adj;
}

const adjCache = new WeakMap<ImportGraph, Map<string, string[]>>();

/** Is there a path `from →* to` over the base File→File edges? */
export function reaches(g: ImportGraph, from: string, to: string): boolean {
  let adj = adjCache.get(g);
  if (adj === undefined) {
    adj = adjacency(g);
    adjCache.set(g, adj);
  }
  const seen = new Set<string>([from]);
  const stack = [from];
  while (stack.length > 0) {
    const n = stack.pop() ?? '';
    if (n === to) return true;
    for (const m of adj.get(n) ?? []) {
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  return false;
}

/** The planned edge `site → target` would close a cycle in the base graph (`cycle-cap`). */
export function closesCycle(ctx: PreconditionContext, source: string, target: string): PreconditionResult {
  return reaches(ctx.baseGraph, target, source) ? { ok: false, reason: 'cycle-cap' } : { ok: true };
}

/** The file already imports (or re-exports) `target`, statically (`edge-exists`). */
export function edgeInBase(ctx: PreconditionContext, source: string, target: string): PreconditionResult {
  return ctx.baseGraph.edges.some((e) => e.source === source && e.target === target) ? { ok: false, reason: 'edge-exists' } : { ok: true };
}

export function all(...checks: (() => PreconditionResult)[]): PreconditionResult {
  for (const c of checks) {
    const r = c();
    if (!r.ok) return r;
  }
  return { ok: true };
}

// ── DDD model ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface DddView {
  readonly model: DddModel;
  contextOf(rel: string): DddContext | undefined;
  isPublicApi(rel: string): boolean;
  isAcl(rel: string): boolean;
  isRepository(rel: string): boolean;
  isValueObject(rel: string): boolean;
  isOutside(rel: string): boolean;
  aggregateOfInner(rel: string): DddAggregate | undefined;
  aggregateOfRoot(rel: string): DddAggregate | undefined;
  inModule(agg: DddAggregate, rel: string): boolean;
  isInner(rel: string): boolean;
}

const match = (globs: readonly string[]): ((p: string) => boolean) => (globs.length === 0 ? () => false : picomatch([...globs], { dot: true }));

export function dddView(spec: ParsedSpec): DddView | undefined {
  const model = spec.layerModel.ddd;
  if (model === undefined) return undefined;
  const publicApi = match(model.contexts.flatMap((c) => c.publicApi));
  const acl = match(model.contexts.flatMap((c) => c.acl));
  const repo = match(model.repositories);
  const vo = match(model.valueObjects);
  const outside = match(model.outsideContexts);
  const inner = model.aggregates.map((a) => ({ a, m: match(a.innerEntities), mod: match([a.module]) }));
  return {
    model,
    contextOf: (rel) => model.contexts.find((c) => rel.startsWith(c.root)),
    isPublicApi: publicApi,
    isAcl: acl,
    isRepository: repo,
    isValueObject: vo,
    isOutside: outside,
    aggregateOfInner: (rel) => inner.find((x) => x.m(rel))?.a,
    aggregateOfRoot: (rel) => model.aggregates.find((a) => a.root === rel),
    inModule: (agg, rel) => inner.find((x) => x.a === agg)?.mod(rel) ?? false,
    isInner: (rel) => inner.some((x) => x.m(rel)),
  };
}

/**
 * On a `ddd` spec, does an import `source → target` stay clear of the DDD rules? It must not cross into another
 * context's unpublished files (`published` holds each context's re-exported files), must not reach an inner entity from
 * outside its aggregate's module, and a repository file must not reach an inner entity. Always true without
 * `architecture.ddd`.
 */
export function dddEdgeOk(ddd: DddView | undefined, published: ReadonlyMap<string, ReadonlySet<string>>, source: string, target: string): boolean {
  if (ddd === undefined) return true;
  const a = ddd.contextOf(source);
  const b = ddd.contextOf(target);
  if (a !== undefined && b !== undefined && a.name !== b.name && !ddd.isAcl(source) && !ddd.isPublicApi(target) && !(published.get(b.name)?.has(target) ?? false)) return false;
  const agg = ddd.aggregateOfInner(target);
  if (agg !== undefined && (!ddd.inModule(agg, source) || ddd.isRepository(source))) return false;
  return true;
}

const dddCache = new WeakMap<object, { ddd: DddView | undefined; published: Map<string, Set<string>> }>();

/** `dddEdgeOk` as a precondition (`ddd-boundary`), with the spec's DDD view and published files cached per project. */
export function dddBoundary(handle: ProjectHandle, spec: ParsedSpec, source: string, target: string): PreconditionResult {
  let c = dddCache.get(handle.project);
  if (c === undefined) {
    const ddd = dddView(spec);
    c = { ddd, published: new Map((ddd?.model.contexts ?? []).map((x) => [x.name, ddd === undefined ? new Set<string>() : publishedFiles(handle, ddd, x)])) };
    dddCache.set(handle.project, c);
  }
  return dddEdgeOk(c.ddd, c.published, source, target) ? { ok: true } : reject('ddd-boundary');
}

/** Files re-exported (directly or through further barrels) by the public-API files of a context. */
export function publishedFiles(handle: ProjectHandle, ddd: DddView, ctx: DddContext): Set<string> {
  const out = new Set<string>();
  for (const sf of projectFiles(handle)) {
    const rel = relOf(handle, sf);
    if (!rel.startsWith(ctx.root) || !ddd.isPublicApi(rel)) continue;
    for (const decls of sf.getExportedDeclarations().values()) {
      for (const d of decls) out.add(relOf(handle, d.getSourceFile()));
    }
  }
  return out;
}

// ── Edits ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** First exported name of a file (classes first, then any declaration), for an import that names something. */
export function firstExport(sf: SourceFile): string | undefined {
  return exportedClasses(sf)[0]?.getName() ?? exportedNames(sf)[0];
}

/**
 * How an added constructor parameter stays optional for every `new` call site: `default-new` (`x: T = new T()`, the
 * default-instance idiom; needs a class constructible without arguments) or `optional` (`x?: T`). The extractor reads
 * the parameter's type symbol, and the type of `x?: T` is the union `T | undefined`, which has none: an `optional`
 * parameter gives no CONSTRUCTOR_INJECTS edge (catalogue §4).
 */
export type InjectForm = 'default-new' | 'optional';

/**
 * Adds a public `readonly` constructor parameter property of type `typeName` to `cls` (a new constructor when the class
 * has none and extends nothing), in the given form. Public, so `noUnusedLocals` does not flag it. Returns the 1-based
 * line of the parameter, or undefined when the class shape does not allow it (a rest parameter, several constructor
 * overloads, or an implicit constructor of a subclass).
 */
export function addInjectedParam(cls: ClassDeclaration, name: string, typeName: string, form: InjectForm = 'optional'): number | undefined {
  const param = form === 'default-new'
    ? { name, type: typeName, initializer: `new ${typeName}()`, isReadonly: true }
    : { name, type: typeName, hasQuestionToken: true, isReadonly: true };
  const ctors = cls.getConstructors();
  if (ctors.length > 1) return undefined;
  const ctor = ctors[0];
  if (ctor === undefined) {
    if (cls.getExtends() !== undefined) return undefined;
    const added = cls.insertConstructor(firstMemberIndex(cls), { parameters: [param] });
    return added.getParameters()[0]?.getStartLineNumber();
  }
  if (ctor.getParameters().some((p) => p.isRestParameter())) return undefined;
  const p = ctor.addParameter(param);
  return p.getStartLineNumber();
}

/** Can `new C()` be written: a non-abstract class whose constructor needs no argument (an inherited one included)? */
export function zeroArgConstructible(cls: ClassDeclaration): boolean {
  if (cls.isAbstract()) return false;
  const ctors = cls.getConstructors();
  if (ctors.length === 0) {
    const base = cls.getBaseClass();
    return cls.getExtends() === undefined || (base !== undefined && zeroArgConstructible(base));
  }
  return ctors.some((c) => c.getParameters().every((p) => p.isOptional() || p.hasInitializer() || p.isRestParameter()) && c.getScope() !== Scope.Private && c.getScope() !== Scope.Protected);
}

function firstMemberIndex(cls: ClassDeclaration): number {
  const members = cls.getMembers();
  const firstMethod = members.findIndex((m) => !Node.isPropertyDeclaration(m));
  return firstMethod < 0 ? members.length : firstMethod;
}

/** Does the class's constructor shape accept one more optional parameter (see `addInjectedParam`)? */
export function canInject(cls: ClassDeclaration): boolean {
  const ctors = cls.getConstructors();
  if (ctors.length > 1) return false;
  const ctor = ctors[0];
  if (ctor === undefined) return cls.getExtends() === undefined;
  return !ctor.getParameters().some((p) => p.isRestParameter());
}

/** Names the file declares or imports at top level (for collision checks). */
export function boundNames(sf: SourceFile): Set<string> {
  const out = new Set<string>();
  for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) out.add(id.getText());
  return out;
}

/** The site's target file must still exist in the copy. */
export function targetOf(handle: ProjectHandle, site: MutationSite): SourceFile | undefined {
  return fileAt(handle, site.detail.targetFile ?? '');
}

/** kebab-case of a PascalCase name (`OrderLine` → `order-line`). */
export function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();
}
