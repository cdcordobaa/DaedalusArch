/**
 * v1.3 DRAFT DDD operators (`Docs/v1.3/operator-catalogue-hexddd.md` §1–§2). The roles are the spec's declarations
 * (`architecture.ddd`), so an operator has no site on a spec without them.
 *
 * - MO-D01 / MO-D01n: a file of the same context outside an aggregate's module imports one of its inner entities /
 *   imports the aggregate root.
 * - MO-D02 / MO-D02n: a new repository file (named to match the declared repository globs, next to an existing
 *   repository) keeps a collection of an inner entity / of the aggregate root.
 * - MO-D03 / MO-D03n: a value object becomes mutable: a public `set<Field>` method assigning an own field (its
 *   `readonly` dropped), or a new public mutable field when the class declares none / a public `<field>Equals` query,
 *   or a new public `readonly` field.
 * - MO-D05 / MO-D05n / MO-D05a: a file of context A outside A's ACL imports a file of context B that B does not publish
 *   / imports a public-API file of B / an ACL file of A imports the unpublished file (the ACL exception).
 * - MO-D06 / MO-D06n: a new module under the source root, outside every context and outside-context path / the same
 *   module created next to an existing file of a context.
 *
 * The framework-free domain rule (FF-DT04, `domain-purity`) is MO-H05 run on a `ddd` spec.
 */
import * as path from 'node:path';
import { Node, Scope } from 'ts-morph';
import type { ClassDeclaration, SourceFile } from 'ts-morph';
import picomatch from 'picomatch';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LocationRule, MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionContext, PreconditionResult, ProjectHandle } from '../types.js';
import { editOf, fail, fileAt, freshName, insertImport, projectFiles, relOf, specifierTo } from '../operators/common.js';
import { all, boundNames, closesCycle, dddView, edgeInBase, exportedClasses, hexRoles, kebab, layerOf, layerPairOk, publishedFiles } from './common.js';
import type { DddView } from './common.js';
import { applyEdge, refSymbol } from './hexagonal.js';

const SRC_EVANS_AGG = 'Evans 2003 ch. 6; Vernon 2013 ch. 10';
const SRC_EVANS_REPO = 'Evans 2003 ch. 6; Vernon 2013 ch. 12';
const SRC_EVANS_VO = 'Evans 2003 ch. 5; Vernon 2013 ch. 6';
const SRC_EVANS_BC = 'Evans 2003 ch. 14; Vernon 2013 ch. 3, 13';

interface Common {
  readonly id: string;
  readonly role: 'positive' | 'twin';
  readonly twinOf?: string;
  readonly dimension: MutationOperator['dimension'];
  readonly expectedTemplates: readonly LocationRule[];
  readonly source: string;
}

function op(c: Common, body: Pick<MutationOperator, 'findSites' | 'checkPreconditions' | 'apply' | 'plannedEdges'> & Partial<MutationOperator>): MutationOperator {
  return {
    core: false,
    operatorCollateral: [],
    coveredByTemplates: c.expectedTemplates.map((r) => r.template),
    coverage: 'in',
    plannedFiles: (site) => [site.filePath],
    ...c,
    ...body,
  };
}

const planned = (site: MutationSite): { source: string; target: string }[] => [{ source: site.filePath, target: site.detail.targetFile ?? '' }];

/** Edge preconditions shared by the DDD import operators: no base edge, no layering breach; twins close no cycle. */
function edgePre(twin: boolean) {
  return (_h: ProjectHandle, s: ParsedSpec, site: MutationSite, ctx: PreconditionContext): PreconditionResult => {
    const roles = hexRoles(s);
    const target = site.detail.targetFile ?? '';
    return all(
      () => edgeInBase(ctx, site.filePath, target),
      () => (layerPairOk(roles, layerOf(roles, site.filePath), layerOf(roles, target)) ? { ok: true } : { ok: false, reason: 'layer-pair' }),
      () => (twin ? closesCycle(ctx, site.filePath, target) : { ok: true }),
    );
  };
}

function siteFor(h: ProjectHandle, src: SourceFile, tgt: SourceFile, kind: MutationSite['kind'], extra: Record<string, string> = {}): MutationSite | undefined {
  const sym = refSymbol(tgt);
  if (sym === undefined || boundNames(src).has(sym)) return undefined;
  return { filePath: relOf(h, src), line: 1, kind, detail: { targetFile: relOf(h, tgt), symbol: sym, ...extra } };
}

// ── MO-D01 aggregate boundary ───────────────────────────────────────────────────────────────────────────────────

/**
 * (outside file, inner entity | root) sites: the source lies in the aggregate's context, outside its module, and is
 * not a repository file (repositories are MO-D02's) nor a public-API file.
 */
function boundarySites(h: ProjectHandle, s: ParsedSpec, toRoot: boolean): MutationSite[] {
  const ddd = dddView(s);
  if (ddd === undefined) return [];
  const files = projectFiles(h);
  const out: MutationSite[] = [];
  for (const agg of ddd.model.aggregates) {
    if (agg.innerEntities.length === 0) continue;
    const ctx = ddd.model.contexts.find((c) => c.name === agg.context);
    if (ctx === undefined) continue;
    const isTarget = toRoot ? (rel: string) => rel === agg.root : picomatch([...agg.innerEntities], { dot: true });
    const targets = files.filter((f) => isTarget(relOf(h, f)));
    for (const src of files) {
      const sp = relOf(h, src);
      if (!sp.startsWith(ctx.root) || ddd.inModule(agg, sp) || ddd.isRepository(sp) || ddd.isPublicApi(sp)) continue;
      for (const t of targets) {
        const site = siteFor(h, src, t, 'import-edge', { aggregate: agg.name });
        if (site !== undefined) out.push(site);
      }
    }
  }
  return out;
}

const aggregateRule: LocationRule = { template: 'aggregate-boundary', filePath: 'site', target: 'site-target', discriminator: ['relType'], line: 'site-line' };

export const MO_D01 = op(
  { id: 'MO-D01', role: 'positive', dimension: 'structural', expectedTemplates: [aggregateRule], source: SRC_EVANS_AGG },
  { findSites: (h, s) => boundarySites(h, s, false), checkPreconditions: edgePre(false), apply: applyEdge, plannedEdges: planned },
);

export const MO_D01N = op(
  { id: 'MO-D01n', role: 'twin', twinOf: 'MO-D01', dimension: 'structural', expectedTemplates: [], source: SRC_EVANS_AGG },
  { findSites: (h, s) => boundarySites(h, s, true), checkPreconditions: edgePre(true), apply: applyEdge, plannedEdges: planned },
);

// ── MO-D02 repository for an inner entity ───────────────────────────────────────────────────────────────────────

/** File names for a repository of `entity` in the styles the declared globs may require, in order. */
export function repositoryNames(entity: string): string[] {
  const k = kebab(entity.replace(/Entity$/, ''));
  return [`${entity}Repository.ts`, `${k}.repository.ts`, `${k}-repository.ts`, `${k}.repo.ts`];
}

/**
 * Sites: (existing repository file R of the aggregate's context, entity file E). The new file lies in R's directory,
 * under the first name of `repositoryNames` that the declared repository globs accept and no file has yet.
 */
function repositorySites(h: ProjectHandle, s: ParsedSpec, toRoot: boolean): MutationSite[] {
  const ddd = dddView(s);
  if (ddd === undefined) return [];
  const files = projectFiles(h);
  const taken = new Set(files.map((f) => relOf(h, f)));
  const out: MutationSite[] = [];
  for (const agg of ddd.model.aggregates) {
    if (agg.innerEntities.length === 0) continue;
    const ctx = ddd.model.contexts.find((c) => c.name === agg.context);
    const isEntity = toRoot ? (rel: string) => rel === agg.root : picomatch([...agg.innerEntities], { dot: true });
    const entities = files.filter((f) => isEntity(relOf(h, f)));
    const repoDirs = [...new Set(files.map((f) => relOf(h, f)).filter((r) => ddd.isRepository(r) && ctx !== undefined && (r.startsWith(ctx.root) || !r.startsWith(ddd.model.sourceRoot))).map((r) => path.posix.dirname(r)))].sort();
    for (const e of entities) {
      const cls = exportedClasses(e)[0];
      if (cls === undefined || cls.getTypeParameters().some((p) => p.getDefault() === undefined)) continue;
      const entity = cls.getName() ?? '';
      const stem = toRoot ? `${entity.replace(/Entity$/, '')}Archive${entity.endsWith('Entity') ? 'Entity' : ''}` : entity;
      for (const dir of repoDirs) {
        const created = repositoryNames(stem).map((n) => `${dir}/${n}`).find((p) => ddd.isRepository(p) && !taken.has(p));
        if (created === undefined) continue;
        // Inside the aggregate's module FF-DT01 does not apply: that key is then not expected (`notExpected`).
        const inside = ddd.inModule(agg, created);
        out.push({
          filePath: created,
          line: 1,
          kind: 'created-file',
          detail: { targetFile: relOf(h, e), entity, aggregate: agg.name, createdFile: created, ...(inside ? { notExpected: 'aggregate-boundary' } : {}) },
        });
      }
    }
  }
  return out;
}

function repositoryClassName(created: string): string {
  const base = path.posix.basename(created, '.ts').replace(/[^A-Za-z0-9]+(.)/g, (_m, c: string) => c.toUpperCase());
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function applyRepository(h: ProjectHandle, site: MutationSite): DomainResult<MutationEdit> {
  const created = site.detail.createdFile ?? site.filePath;
  const target = fileAt(h, site.detail.targetFile ?? '');
  const entity = site.detail.entity ?? '';
  if (target === undefined || fileAt(h, created) !== undefined) return fail('MUT_SITE_STALE', `site ${created} is stale`);
  const root = h.root.endsWith('/') ? h.root : `${h.root}/`;
  const sf = h.project.createSourceFile(`${root}${created}`, '', { overwrite: false });
  const cls = repositoryClassName(created);
  insertImport(sf, specifierTo(sf, target), { named: [entity] });
  sf.addStatements([
    `export class ${cls} {`,
    `  private readonly items = new Map<string, ${entity}>();`,
    '',
    `  save(id: string, item: ${entity}): void {`,
    '    this.items.set(id, item);',
    '  }',
    '',
    `  findById(id: string): ${entity} | undefined {`,
    '    return this.items.get(id);',
    '  }',
    '}',
  ].join('\n'));
  return DomainResult.ok(editOf([], [created], [{ source: created, target: site.detail.targetFile ?? '' }], { line: 1, values: { relType: 'IMPORTS' } }));
}

const repositoryPre = (twin: boolean) => (h: ProjectHandle, s: ParsedSpec, site: MutationSite, ctx: PreconditionContext): PreconditionResult => {
  const roles = hexRoles(s);
  const created = site.detail.createdFile ?? site.filePath;
  return all(
    () => (fileAt(h, created) !== undefined ? { ok: false, reason: 'type-shape' } : { ok: true }),
    () => (layerPairOk(roles, layerOf(roles, created), layerOf(roles, site.detail.targetFile ?? '')) ? { ok: true } : { ok: false, reason: 'layer-pair' }),
    () => (twin ? closesCycle(ctx, created, site.detail.targetFile ?? '') : { ok: true }),
  );
};

const repositoryRule: LocationRule = { template: 'repository-aggregate-root', filePath: 'created', target: 'site-target', discriminator: ['relType'], line: 'site-line' };
const repositoryBoundaryRule: LocationRule = { template: 'aggregate-boundary', filePath: 'created', target: 'site-target', discriminator: ['relType'], line: 'site-line' };

export const MO_D02 = op(
  { id: 'MO-D02', role: 'positive', dimension: 'pattern', expectedTemplates: [repositoryRule, repositoryBoundaryRule], source: SRC_EVANS_REPO },
  {
    findSites: (h, s) => repositorySites(h, s, false),
    checkPreconditions: repositoryPre(false),
    apply: applyRepository,
    plannedEdges: (site) => [{ source: site.detail.createdFile ?? site.filePath, target: site.detail.targetFile ?? '' }],
    plannedFiles: (site) => [site.detail.createdFile ?? site.filePath],
  },
);

export const MO_D02N = op(
  { id: 'MO-D02n', role: 'twin', twinOf: 'MO-D02', dimension: 'pattern', expectedTemplates: [], source: SRC_EVANS_REPO },
  {
    findSites: (h, s) => repositorySites(h, s, true),
    checkPreconditions: repositoryPre(true),
    apply: applyRepository,
    plannedEdges: (site) => [{ source: site.detail.createdFile ?? site.filePath, target: site.detail.targetFile ?? '' }],
    plannedFiles: (site) => [site.detail.createdFile ?? site.filePath],
  },
);

// ── MO-D03 mutable value object ─────────────────────────────────────────────────────────────────────────────────

interface OwnField {
  readonly name: string;
  readonly type: string;
}

/** Own instance fields (property declarations and constructor parameter properties), `#private` excluded. */
function ownFields(cls: ClassDeclaration): OwnField[] {
  const out: OwnField[] = [];
  for (const p of cls.getProperties()) {
    if (p.isStatic() || p.getName().startsWith('#') || p.hasDeclareKeyword()) continue;
    out.push({ name: p.getName(), type: p.getType().getText(p) });
  }
  for (const c of cls.getConstructors()) {
    for (const p of c.getParameters()) {
      if (!p.isParameterProperty() || !Node.isIdentifier(p.getNameNode())) continue;
      out.push({ name: p.getName(), type: p.getType().getText(p) });
    }
  }
  return out;
}

/**
 * Is the class already mutable by the FF-DT03 definition (a public non-readonly instance field, a `set` accessor, or a
 * public method assigning `this.<x>`)? Such a site would only change the existing row (`metric-already-violating`).
 */
function alreadyMutable(cls: ClassDeclaration): boolean {
  const isPublic = (scope: Scope | undefined): boolean => scope === undefined || scope === Scope.Public;
  for (const p of cls.getProperties()) {
    if (!p.isStatic() && !p.isReadonly() && isPublic(p.getScope()) && !p.getName().startsWith('#')) return true;
  }
  for (const c of cls.getConstructors()) {
    for (const p of c.getParameters()) if (p.isParameterProperty() && !p.isReadonly() && isPublic(p.getScope())) return true;
  }
  if (cls.getSetAccessors().some((a) => !a.isStatic())) return true;
  for (const m of cls.getMethods()) {
    if (m.isStatic() || !isPublic(m.getScope())) continue;
    const assigns = m.getDescendants().some((d) => Node.isBinaryExpression(d) && d.getOperatorToken().getText() === '=' && /^this\./.test(d.getLeft().getText()));
    if (assigns) return true;
  }
  return false;
}

function voSites(h: ProjectHandle, s: ParsedSpec): MutationSite[] {
  const ddd = dddView(s);
  if (ddd === undefined) return [];
  const out: MutationSite[] = [];
  for (const sf of projectFiles(h)) {
    const rel = relOf(h, sf);
    if (!ddd.isValueObject(rel)) continue;
    for (const cls of sf.getClasses()) {
      const name = cls.getName();
      if (name === undefined) continue;
      const field = ownFields(cls)[0];
      out.push({
        filePath: rel,
        line: cls.getStartLineNumber(),
        kind: 'value-object-member',
        detail: field === undefined ? { class: name, mode: 'field' } : { class: name, mode: 'method', field: field.name, type: field.type },
      });
    }
  }
  return out;
}

const voPre = (h: ProjectHandle, _s: ParsedSpec, site: MutationSite): PreconditionResult => {
  const cls = fileAt(h, site.filePath)?.getClass(site.detail.class ?? '');
  if (cls === undefined) return { ok: false, reason: 'type-shape' };
  return alreadyMutable(cls) ? { ok: false, reason: 'metric-already-violating' } : { ok: true };
};

function capital(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function applyVo(twin: boolean) {
  return (h: ProjectHandle, site: MutationSite): DomainResult<MutationEdit> => {
    const sf = fileAt(h, site.filePath);
    const cls = sf?.getClass(site.detail.class ?? '');
    if (sf === undefined || cls === undefined) return fail('MUT_SITE_STALE', `class ${site.detail.class ?? ''} not found`);
    let line: number;
    if (site.detail.mode === 'method') {
      const field = site.detail.field ?? '';
      const type = site.detail.type ?? 'unknown';
      if (twin) {
        const m = cls.addMethod({ name: freshMember(cls, `${field}Equals`), scope: Scope.Public, parameters: [{ name: 'value', type }], returnType: 'boolean', statements: [`return this.${field} === value;`] });
        line = m.getStartLineNumber();
      } else {
        for (const p of cls.getProperties()) if (p.getName() === field && p.isReadonly()) p.setIsReadonly(false);
        // A parameter property whose only modifier is `readonly` would stop being a property without it: keep a scope.
        for (const c of cls.getConstructors()) {
          for (const p of c.getParameters()) {
            if (p.getName() !== field || !p.isReadonly()) continue;
            if (p.getScope() === undefined || !p.hasScopeKeyword()) p.setScope(Scope.Public);
            p.setIsReadonly(false);
          }
        }
        const m = cls.addMethod({ name: freshMember(cls, `set${capital(field)}`), scope: Scope.Public, parameters: [{ name: 'value', type }], returnType: 'void', statements: [`this.${field} = value;`] });
        line = m.getStartLineNumber();
      }
    } else {
      const name = freshMember(cls, 'label');
      const p = cls.insertProperty(0, { name, type: 'string | undefined', initializer: 'undefined', isReadonly: twin, scope: Scope.Public });
      line = p.getStartLineNumber();
    }
    return DomainResult.ok(editOf([site.filePath], [], [], { line, values: { class: site.detail.class ?? '' } }));
  };
}

function freshMember(cls: ClassDeclaration, base: string): string {
  const taken = new Set(cls.getMembers().map((m) => (Node.isConstructorDeclaration(m) ? 'constructor' : (m as { getName?: () => string }).getName?.() ?? '')));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}${String(i)}`)) return `${base}${String(i)}`;
}

const voRule: LocationRule = { template: 'value-object-immutability', filePath: 'site', discriminator: ['class'], line: 'none' };

export const MO_D03 = op(
  { id: 'MO-D03', role: 'positive', dimension: 'pattern', expectedTemplates: [voRule], source: SRC_EVANS_VO },
  { findSites: voSites, checkPreconditions: voPre, apply: applyVo(false), plannedEdges: () => [] },
);

export const MO_D03N = op(
  { id: 'MO-D03n', role: 'twin', twinOf: 'MO-D03', dimension: 'pattern', expectedTemplates: [], source: SRC_EVANS_VO },
  { findSites: voSites, checkPreconditions: voPre, apply: applyVo(true), plannedEdges: () => [] },
);

// ── MO-D05 cross-context import bypassing the public API or ACL ─────────────────────────────────────────────────

type CrossMode = 'internal' | 'public' | 'acl';

/** Is `rel` a target context B does not publish (not a public-API file, not re-exported by one)? */
function unpublished(ddd: DddView, published: ReadonlyMap<string, Set<string>>, rel: string): boolean {
  const ctx = ddd.contextOf(rel);
  return ctx !== undefined && !ddd.isPublicApi(rel) && !(published.get(ctx.name)?.has(rel) ?? false);
}

function crossSites(h: ProjectHandle, s: ParsedSpec, mode: CrossMode): MutationSite[] {
  const ddd = dddView(s);
  if (ddd === undefined) return [];
  const published = new Map(ddd.model.contexts.map((c) => [c.name, publishedFiles(h, ddd, c)] as const));
  const files = projectFiles(h);
  const out: MutationSite[] = [];
  for (const src of files) {
    const sp = relOf(h, src);
    const a = ddd.contextOf(sp);
    if (a === undefined || (mode === 'acl') !== ddd.isAcl(sp)) continue;
    for (const tgt of files) {
      const tp = relOf(h, tgt);
      const b = ddd.contextOf(tp);
      if (b === undefined || b.name === a.name) continue;
      const ok = mode === 'public' ? ddd.isPublicApi(tp) : unpublished(ddd, published, tp);
      if (!ok) continue;
      const site = siteFor(h, src, tgt, 'cross-context-import', { sourceContext: a.name, targetContext: b.name });
      if (site !== undefined) out.push(site);
    }
  }
  return out;
}

const contextRule: LocationRule = { template: 'context-isolation', filePath: 'site', target: 'site-target', discriminator: ['relType'], line: 'site-line' };

export const MO_D05 = op(
  { id: 'MO-D05', role: 'positive', dimension: 'structural', expectedTemplates: [contextRule], source: SRC_EVANS_BC },
  { findSites: (h, s) => crossSites(h, s, 'internal'), checkPreconditions: edgePre(false), apply: applyEdge, plannedEdges: planned },
);

export const MO_D05N = op(
  { id: 'MO-D05n', role: 'twin', twinOf: 'MO-D05', dimension: 'structural', expectedTemplates: [], source: SRC_EVANS_BC },
  { findSites: (h, s) => crossSites(h, s, 'public'), checkPreconditions: edgePre(true), apply: applyEdge, plannedEdges: planned },
);

/** Second near-miss of MO-D05: the importing file lies in its context's declared ACL. */
export const MO_D05A = op(
  { id: 'MO-D05a', role: 'twin', twinOf: 'MO-D05', dimension: 'structural', expectedTemplates: [], source: SRC_EVANS_BC },
  { findSites: (h, s) => crossSites(h, s, 'acl'), checkPreconditions: edgePre(true), apply: applyEdge, plannedEdges: planned },
);

// ── MO-D06 module outside every context ─────────────────────────────────────────────────────────────────────────

/** One site per directory holding a context file; the created module is named after that directory. */
function moduleSites(h: ProjectHandle, s: ParsedSpec, inside: boolean): MutationSite[] {
  const ddd = dddView(s);
  if (ddd === undefined) return [];
  const files = projectFiles(h).map((f) => relOf(h, f));
  const taken = new Set(files);
  const dirs = [...new Set(files.filter((r) => ddd.contextOf(r) !== undefined).map((r) => path.posix.dirname(r)))].sort();
  const out: MutationSite[] = [];
  for (const dir of dirs) {
    const stem = path.posix.basename(dir).replace(/[^A-Za-z0-9]+/g, '-');
    const name = `${stem}-helpers.ts`;
    const created = inside ? `${dir}/${name}` : `${ddd.model.sourceRoot}${freshDir(ddd, files)}/${name}`;
    if (taken.has(created) || (!inside && (ddd.contextOf(created) !== undefined || ddd.isOutside(created)))) continue;
    out.push({ filePath: created, line: 1, kind: 'created-file', detail: { createdFile: created, fromDir: dir } });
  }
  return out;
}

/** A top-level directory name under the source root that no file and no context uses (`common`, `common2`, …). */
function freshDir(ddd: DddView, files: readonly string[]): string {
  const used = new Set(files.filter((f) => f.startsWith(ddd.model.sourceRoot)).map((f) => f.slice(ddd.model.sourceRoot.length).split('/')[0] ?? ''));
  for (const c of ddd.model.contexts) used.add(c.root.slice(ddd.model.sourceRoot.length).replace(/\/$/, ''));
  if (!used.has('common')) return 'common';
  for (let i = 2; ; i++) if (!used.has(`common${String(i)}`)) return `common${String(i)}`;
}

function applyModule(h: ProjectHandle, site: MutationSite): DomainResult<MutationEdit> {
  const created = site.detail.createdFile ?? site.filePath;
  if (fileAt(h, created) !== undefined) return fail('MUT_SITE_STALE', `${created} exists`);
  const root = h.root.endsWith('/') ? h.root : `${h.root}/`;
  const sf = h.project.createSourceFile(`${root}${created}`, '', { overwrite: false });
  const fn = freshName(sf, `describe${capital(path.posix.basename(site.detail.fromDir ?? 'module').replace(/[^A-Za-z0-9]+(.)?/g, (_m, c?: string) => (c ?? '').toUpperCase()))}`);
  sf.addStatements(`export function ${fn}(): string {\n  return '${path.posix.basename(site.detail.fromDir ?? 'module')}';\n}`);
  return DomainResult.ok(editOf([], [created], [], { line: 1, values: {} }));
}

const createdRule: LocationRule = { template: 'bounded-context-modules', filePath: 'created', line: 'none' };

export const MO_D06 = op(
  { id: 'MO-D06', role: 'positive', dimension: 'structural', expectedTemplates: [createdRule], source: SRC_EVANS_BC },
  {
    findSites: (h, s) => moduleSites(h, s, false),
    checkPreconditions: () => ({ ok: true }),
    apply: applyModule,
    plannedEdges: () => [],
    plannedFiles: (site) => [site.detail.createdFile ?? site.filePath],
  },
);

export const MO_D06N = op(
  { id: 'MO-D06n', role: 'twin', twinOf: 'MO-D06', dimension: 'structural', expectedTemplates: [], source: SRC_EVANS_BC },
  {
    findSites: (h, s) => moduleSites(h, s, true),
    checkPreconditions: () => ({ ok: true }),
    apply: applyModule,
    plannedEdges: () => [],
    plannedFiles: (site) => [site.detail.createdFile ?? site.filePath],
  },
);

export const DDD_OPERATORS: readonly MutationOperator[] = [MO_D01, MO_D01N, MO_D02, MO_D02N, MO_D03, MO_D03N, MO_D05, MO_D05N, MO_D05A, MO_D06, MO_D06N];
