/**
 * v1.3 DRAFT hexagonal operators (`Docs/v1.3/operator-catalogue-hexddd.md` §1–§2). Each positive plants one breach of
 * a hexagonal rule; its twin makes the closest edit the rule allows. The roles come from the spec (`hexRoles`), so the
 * operators also run on a `ddd` spec, whose layering composes the hexagonal graph templates.
 *
 * - MO-H01 / MO-H01n: a core (domain) file imports an adapter file / an outbound adapter file imports a core file.
 * - MO-H02 / MO-H02n: a use-case class gains an injected constructor parameter typed with a concrete outbound adapter
 *   class / with a port (an interface of the core or of a use-case layer).
 * - MO-H03 / MO-H03n: an inbound adapter imports an outbound adapter / an inbound adapter imports a use-case file.
 * - MO-H04 / MO-H04n: an outbound adapter class drops every port from its `implements` clause / keeps its ports and
 *   also implements a new local interface declared in its own file.
 * - MO-H05 / MO-H05n: a core file imports a named symbol of a forbidden framework package / an outbound adapter file
 *   makes the same import.
 * - MO-H06 / MO-H06n: a core class gains an injected constructor parameter typed with an outbound adapter class / with
 *   a core interface.
 * - MO-H07 / MO-H07n: a core file B imports a core file A that already imports B (a two-file cycle) / B imports a
 *   core file C that does not reach B.
 *
 * The edits keep the text outside the edited span unchanged; every application is type-checked (BR-U5a-07).
 */
import { Node } from 'ts-morph';
import type { ClassDeclaration, SourceFile } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LocationRule, MutationEdit, MutationOperator, MutationSite, ParsedSpec, PlannedImportUse, PreconditionContext, PreconditionResult, ProjectHandle } from '../types.js';
import { appendValueRef, edgeRule, editOf, exportedValueNames, fail, fileAt, freshName, insertImport, lowerFirst, projectFiles, relOf, specifierTo, appendTypeRef } from '../operators/common.js';
import { addInjectedParam, all, dddBoundary, zeroArgConstructible, boundNames, canInject, closesCycle, edgeInBase, exportedClasses, exportedInterfaces, filesIn, hexRoles, layerOf, layerPairOk } from './common.js';
import type { HexRoles, InjectForm } from './common.js';

export const SRC_COCKBURN = 'Cockburn 2005';
export const SRC_EVANS = 'Evans 2003';
export const SRC_MARTIN = 'Martin 2017';

// ── Import-edge sites ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * The symbol an import names: the first exported class (a value reference always compiles), else the first exported
 * function or variable, else the first exported interface or type alias without a required type parameter.
 */
export function refSymbol(sf: SourceFile): string | undefined {
  const cls = exportedClasses(sf)[0]?.getName();
  if (cls !== undefined) return cls;
  const value = exportedValueNames(sf)[0];
  if (value !== undefined) return value;
  for (const [name, decls] of sf.getExportedDeclarations()) {
    if (name === 'default') continue;
    for (const d of decls) {
      if (d.getSourceFile() !== sf) continue;
      if ((Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d)) && d.getTypeParameters().every((p) => p.getDefault() !== undefined)) return name;
    }
  }
  return undefined;
}

export interface EdgeSiteSpec {
  readonly source: (roles: HexRoles, rel: string, sf: SourceFile) => boolean;
  readonly target: (roles: HexRoles, rel: string, sf: SourceFile) => boolean;
}

/** (source file, target file, symbol) sites, path order; the symbol must not be a name bound in the source file. */
export function edgeSites(handle: ProjectHandle, spec: ParsedSpec, kind: MutationSite['kind'], s: EdgeSiteSpec): MutationSite[] {
  const roles = hexRoles(spec);
  const files = projectFiles(handle);
  const symbols = new Map<SourceFile, string | undefined>();
  const out: MutationSite[] = [];
  for (const src of files) {
    const sp = relOf(handle, src);
    if (!s.source(roles, sp, src)) continue;
    const bound = boundNames(src);
    for (const tgt of files) {
      const tp = relOf(handle, tgt);
      if (tp === sp || !s.target(roles, tp, tgt)) continue;
      if (!symbols.has(tgt)) symbols.set(tgt, refSymbol(tgt));
      const sym = symbols.get(tgt);
      if (sym === undefined || bound.has(sym)) continue;
      out.push({ filePath: sp, line: 1, kind, detail: { targetFile: tp, symbol: sym } });
    }
  }
  return out;
}

/** Imports `detail.symbol` of the target and adds a value (or type) reference to it. */
export function applyEdge(handle: ProjectHandle, site: MutationSite): DomainResult<MutationEdit> {
  const sf = fileAt(handle, site.filePath);
  const targetFile = site.detail.targetFile ?? '';
  const target = fileAt(handle, targetFile);
  const symbol = site.detail.symbol ?? '';
  if (sf === undefined || target === undefined || symbol.length === 0) return fail('MUT_SITE_STALE', `site ${site.filePath} → ${targetFile} not found`);
  const line = insertImport(sf, specifierTo(sf, target), { named: [symbol] });
  if (exportedValueNames(target).includes(symbol)) appendValueRef(sf, symbol, `${lowerFirst(symbol)}Ref`);
  else appendTypeRef(sf, symbol, `${symbol}Ref`);
  return DomainResult.ok(editOf([site.filePath], [], [{ source: site.filePath, target: targetFile }], { line, values: { relType: 'IMPORTS' } }));
}

const planned = (site: MutationSite): { source: string; target: string }[] => [{ source: site.filePath, target: site.detail.targetFile ?? '' }];

/** Positive edge preconditions: no base edge. Twin: no base edge, and the edge closes no cycle. */
function edgePre(twin: boolean) {
  return (h: ProjectHandle, s: ParsedSpec, site: MutationSite, ctx: PreconditionContext): PreconditionResult =>
    all(
      () => edgeInBase(ctx, site.filePath, site.detail.targetFile ?? ''),
      () => dddBoundary(h, s, site.filePath, site.detail.targetFile ?? ''),
      () => (twin ? closesCycle(ctx, site.filePath, site.detail.targetFile ?? '') : { ok: true }),
    );
}

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
    ...(c.twinOf !== undefined ? { twinOf: c.twinOf } : {}),
    ...body,
  };
}

const isLayer = (layer: (r: HexRoles) => string | undefined) => (r: HexRoles, rel: string): boolean => {
  const l = layer(r);
  return l !== undefined && layerOf(r, rel) === l;
};
const inUseCase = (r: HexRoles, rel: string): boolean => {
  const l = layerOf(r, rel);
  return l !== null && r.useCase.includes(l);
};
const isDomain = isLayer((r) => r.domain);
const isOutbound = isLayer((r) => r.outbound);
const isInbound = isLayer((r) => r.inbound);

// ── MO-H01 core imports an adapter ──────────────────────────────────────────────────────────────────────────────

export const MO_H01 = op(
  { id: 'MO-H01', role: 'positive', dimension: 'structural', expectedTemplates: [edgeRule('dependency-direction-graph'), edgeRule('core-isolation')], source: `${SRC_COCKBURN}; ${SRC_MARTIN}` },
  {
    findSites: (h, s) => edgeSites(h, s, 'import-edge', { source: isDomain, target: (r, rel) => isOutbound(r, rel) || isInbound(r, rel) }),
    checkPreconditions: edgePre(false),
    apply: applyEdge,
    plannedEdges: planned,
  },
);

export const MO_H01N = op(
  { id: 'MO-H01n', role: 'twin', twinOf: 'MO-H01', dimension: 'structural', expectedTemplates: [], source: `${SRC_COCKBURN}; ${SRC_MARTIN}` },
  {
    findSites: (h, s) => edgeSites(h, s, 'import-edge', { source: isOutbound, target: isDomain }),
    checkPreconditions: edgePre(true),
    apply: applyEdge,
    plannedEdges: planned,
  },
);

// ── MO-H03 inbound adapter imports an outbound adapter (layer-skip-graph, advisory) ────────────────────────────

export const MO_H03 = op(
  { id: 'MO-H03', role: 'positive', dimension: 'structural', expectedTemplates: [edgeRule('layer-skip-graph')], source: SRC_COCKBURN },
  {
    findSites: (h, s) => edgeSites(h, s, 'import-edge', { source: isInbound, target: isOutbound }),
    checkPreconditions: edgePre(false),
    apply: applyEdge,
    plannedEdges: planned,
  },
);

export const MO_H03N = op(
  { id: 'MO-H03n', role: 'twin', twinOf: 'MO-H03', dimension: 'structural', expectedTemplates: [], source: SRC_COCKBURN },
  {
    findSites: (h, s) => edgeSites(h, s, 'import-edge', { source: isInbound, target: (r, rel) => inUseCase(r, rel) && r.inbound !== undefined && r.allowed.has(`${r.inbound}>${layerOf(r, rel) ?? ''}`) }),
    checkPreconditions: edgePre(true),
    apply: applyEdge,
    plannedEdges: planned,
  },
);

// ── MO-H07 core cycle ───────────────────────────────────────────────────────────────────────────────────────────

/** Sites (B, A): A → B is a base edge between two core files; the edit adds B → A. */
function cycleSites(h: ProjectHandle, s: ParsedSpec): MutationSite[] {
  const roles = hexRoles(s);
  const out: MutationSite[] = [];
  const core = new Set(filesIn(h, roles, [roles.domain]).map((sf) => relOf(h, sf)));
  for (const sf of filesIn(h, roles, [roles.domain])) {
    const a = relOf(h, sf);
    const sym = refSymbol(sf);
    if (sym === undefined) continue;
    const targets = new Set<string>();
    for (const d of sf.getImportDeclarations()) {
      const t = d.getModuleSpecifierSourceFile();
      if (t !== undefined) targets.add(relOf(h, t));
    }
    for (const b of [...targets].sort()) {
      if (!core.has(b) || b === a) continue;
      const bf = fileAt(h, b);
      if (bf === undefined || boundNames(bf).has(sym)) continue;
      out.push({ filePath: b, line: 1, kind: 'import-edge', detail: { targetFile: a, symbol: sym } });
    }
  }
  return out;
}

export const MO_H07 = op(
  { id: 'MO-H07', role: 'positive', dimension: 'structural', expectedTemplates: [edgeRule('no-cyclic-deps')], source: 'Martin 2017 (ADP)' },
  {
    findSites: (h, s) => cycleSites(h, s),
    // The planned edge B → A must close a cycle (A reaches B in the base graph) and must not exist yet.
    checkPreconditions: (h, s, site, ctx) =>
      all(
        () => edgeInBase(ctx, site.filePath, site.detail.targetFile ?? ''),
        () => dddBoundary(h, s, site.filePath, site.detail.targetFile ?? ''),
        () => (closesCycle(ctx, site.filePath, site.detail.targetFile ?? '').ok ? { ok: false, reason: 'type-shape' } : { ok: true }),
      ),
    apply: applyEdge,
    plannedEdges: planned,
  },
);

export const MO_H07N = op(
  { id: 'MO-H07n', role: 'twin', twinOf: 'MO-H07', dimension: 'structural', expectedTemplates: [], source: 'Martin 2017 (ADP)' },
  {
    // B (a core file that some core file imports) imports another core file C; C must not reach B.
    findSites(h, s) {
      const sources = new Set(cycleSites(h, s).map((x) => x.filePath));
      return edgeSites(h, s, 'import-edge', { source: (_r, rel) => sources.has(rel), target: isDomain });
    },
    checkPreconditions: edgePre(true),
    apply: applyEdge,
    plannedEdges: planned,
  },
);

// ── MO-H05 framework import in the core ─────────────────────────────────────────────────────────────────────────

/**
 * A framework package of the spec's `domain-purity` list and a symbol it exports: literal entries and, for a glob
 * entry, the concrete package named here. Order is the order of preference.
 */
export const FRAMEWORK_SYMBOLS: readonly { readonly pkg: string; readonly glob: string; readonly symbol: string }[] = [
  { pkg: '@nestjs/common', glob: '@nestjs/*', symbol: 'Injectable' },
  { pkg: 'typeorm', glob: 'typeorm', symbol: 'Entity' },
  { pkg: 'class-validator', glob: 'class-validator', symbol: 'IsString' },
  { pkg: 'class-transformer', glob: 'class-transformer', symbol: 'plainToInstance' },
  { pkg: 'express', glob: 'express', symbol: 'Router' },
  { pkg: 'mongoose', glob: 'mongoose', symbol: 'Schema' },
  { pkg: '@prisma/client', glob: '@prisma/*', symbol: 'Prisma' },
  { pkg: 'sequelize', glob: 'sequelize', symbol: 'Model' },
  { pkg: '@mikro-orm/core', glob: '@mikro-orm/*', symbol: 'Entity' },
  { pkg: 'inversify', glob: 'inversify', symbol: 'injectable' },
  { pkg: 'tsyringe', glob: 'tsyringe', symbol: 'injectable' },
];

/** The framework packages the spec forbids in the core (`domain-purity`, literal and glob entries). */
export function frameworkChoices(spec: ParsedSpec): { pkg: string; symbol: string }[] {
  const ff = spec.fitnessFunctions.find((f) => f.name === 'domain-purity' && f.enabled);
  const list = new Set(ff?.forbiddenImports ?? []);
  return FRAMEWORK_SYMBOLS.filter((x) => list.has(x.glob) || list.has(x.pkg)).map((x) => ({ pkg: x.pkg, symbol: x.symbol }));
}

function frameworkSites(h: ProjectHandle, s: ParsedSpec, layer: (r: HexRoles) => string | undefined): MutationSite[] {
  const roles = hexRoles(s);
  const choice = frameworkChoices(s)[0];
  if (choice === undefined) return [];
  return filesIn(h, roles, [layer(roles)])
    .filter((sf) => !boundNames(sf).has(choice.symbol))
    .map((sf) => ({ filePath: relOf(h, sf), line: 1, kind: 'package-import' as const, detail: { package: choice.pkg, symbol: choice.symbol } }));
}

function importsPackage(sf: SourceFile | undefined, pkg: string): boolean {
  return (sf?.getImportDeclarations() ?? []).some((d) => {
    const m = d.getModuleSpecifierValue();
    return m === pkg || m.startsWith(`${pkg}/`);
  });
}

function applyFramework(h: ProjectHandle, site: MutationSite): DomainResult<MutationEdit> {
  const sf = fileAt(h, site.filePath);
  const pkg = site.detail.package ?? '';
  const symbol = site.detail.symbol ?? '';
  if (sf === undefined || pkg.length === 0) return fail('MUT_SITE_STALE', `site ${site.filePath} not found`);
  const line = insertImport(sf, pkg, { named: [symbol] });
  appendValueRef(sf, symbol, `${lowerFirst(symbol)}Ref`);
  return DomainResult.ok(editOf([site.filePath], [], [], { line, values: { relType: 'IMPORTS' } }));
}

const frameworkUses = (site: MutationSite): PlannedImportUse[] => [{ specifier: site.detail.package ?? '', fromFile: site.filePath, form: 'named', name: site.detail.symbol ?? '' }];

const packageRule: LocationRule = { template: 'domain-purity', filePath: 'site', target: 'package', discriminator: ['relType'], line: 'site-line' };

export const MO_H05 = op(
  { id: 'MO-H05', role: 'positive', dimension: 'pattern', expectedTemplates: [packageRule], source: `${SRC_EVANS}; ${SRC_COCKBURN}` },
  {
    findSites: (h, s) => frameworkSites(h, s, (r) => r.domain),
    checkPreconditions: (h, _s, site) => (importsPackage(fileAt(h, site.filePath), site.detail.package ?? '') ? { ok: false, reason: 'already-imported' } : { ok: true }),
    apply: applyFramework,
    plannedEdges: () => [],
    plannedImportUses: frameworkUses,
  },
);

export const MO_H05N = op(
  { id: 'MO-H05n', role: 'twin', twinOf: 'MO-H05', dimension: 'pattern', expectedTemplates: [], source: `${SRC_EVANS}; ${SRC_COCKBURN}` },
  {
    findSites: (h, s) => frameworkSites(h, s, (r) => r.outbound),
    checkPreconditions: (h, _s, site) => (importsPackage(fileAt(h, site.filePath), site.detail.package ?? '') ? { ok: false, reason: 'already-imported' } : { ok: true }),
    apply: applyFramework,
    plannedEdges: () => [],
    plannedImportUses: frameworkUses,
  },
);

// ── MO-H02 / MO-H06 injected constructor parameters ─────────────────────────────────────────────────────────────

interface InjectSpec {
  readonly host: (r: HexRoles, rel: string) => boolean;
  /** Target declarations: concrete classes (`class`) or interfaces (`interface`) of the accepted files. */
  readonly kind: 'class' | 'interface';
  readonly target: (r: HexRoles, rel: string) => boolean;
}

function hostClasses(sf: SourceFile): ClassDeclaration[] {
  return exportedClasses(sf).filter((c) => !c.isAbstract() && canInject(c));
}

function injectSites(h: ProjectHandle, s: ParsedSpec, spec: InjectSpec): MutationSite[] {
  const roles = hexRoles(s);
  const files = projectFiles(h);
  const targets: { rel: string; name: string; form: InjectForm }[] = [];
  for (const sf of files) {
    const rel = relOf(h, sf);
    if (!spec.target(roles, rel)) continue;
    if (spec.kind === 'class') {
      const cls = exportedClasses(sf).find((c) => !c.isAbstract() && c.getTypeParameters().length === 0);
      if (cls !== undefined) targets.push({ rel, name: cls.getName() ?? '', form: zeroArgConstructible(cls) ? 'default-new' : 'optional' });
    } else {
      const name = exportedInterfaces(sf).find((n) => sf.getInterface(n)?.getTypeParameters().length === 0);
      if (name !== undefined) targets.push({ rel, name, form: 'optional' });
    }
  }
  const out: MutationSite[] = [];
  for (const sf of files) {
    const rel = relOf(h, sf);
    if (!spec.host(roles, rel)) continue;
    const cls = hostClasses(sf)[0];
    if (cls === undefined) continue;
    const bound = boundNames(sf);
    for (const t of targets) {
      if (t.rel === rel || bound.has(t.name)) continue;
      out.push({ filePath: rel, line: cls.getStartLineNumber(), kind: 'constructor-injection', detail: { class: cls.getName() ?? '', targetFile: t.rel, targetName: t.name, form: t.form } });
    }
  }
  return out;
}

function applyInject(h: ProjectHandle, site: MutationSite): DomainResult<MutationEdit> {
  const sf = fileAt(h, site.filePath);
  const target = fileAt(h, site.detail.targetFile ?? '');
  const cls = sf?.getClass(site.detail.class ?? '');
  const name = site.detail.targetName ?? '';
  if (sf === undefined || target === undefined || cls === undefined) return fail('MUT_SITE_STALE', `site ${site.filePath} is stale`);
  insertImport(sf, specifierTo(sf, target), { named: [name] });
  const param = freshName(sf, lowerFirst(name.replace(/^I(?=[A-Z])/, '')));
  const line = addInjectedParam(cls, param, name, site.detail.form === 'default-new' ? 'default-new' : 'optional');
  if (line === undefined) return fail('MUT_SITE_STALE', `class ${cls.getName() ?? ''} cannot take a parameter`);
  return DomainResult.ok(
    editOf([site.filePath], [], [{ source: site.filePath, target: site.detail.targetFile ?? '' }], {
      line,
      values: { relType: 'CONSTRUCTOR_INJECTS', field: param, class: site.detail.class ?? '', targetName: name },
    }),
  );
}

const injectPre = (twin: boolean) => (h: ProjectHandle, s: ParsedSpec, site: MutationSite, ctx: PreconditionContext): PreconditionResult => {
  const roles = hexRoles(s);
  return all(
    () => edgeInBase(ctx, site.filePath, site.detail.targetFile ?? ''),
    () => dddBoundary(h, s, site.filePath, site.detail.targetFile ?? ''),
    () => (twin ? closesCycle(ctx, site.filePath, site.detail.targetFile ?? '') : { ok: true }),
    () => (twin && !layerPairOk(roles, layerOf(roles, site.filePath), layerOf(roles, site.detail.targetFile ?? '')) ? { ok: false, reason: 'layer-pair' } : { ok: true }),
    () => (fileAt(h, site.filePath)?.getClass(site.detail.class ?? '') === undefined ? { ok: false, reason: 'type-shape' } : { ok: true }),
  );
};

const portLayer = (r: HexRoles, rel: string): boolean => isDomain(r, rel) || inUseCase(r, rel);

export const MO_H02 = op(
  { id: 'MO-H02', role: 'positive', dimension: 'structural', expectedTemplates: [edgeRule('dependency-direction-graph')], source: `${SRC_COCKBURN}; Seemann 2011` },
  {
    findSites: (h, s) => injectSites(h, s, { host: inUseCase, kind: 'class', target: isOutbound }),
    checkPreconditions: injectPre(false),
    apply: applyInject,
    plannedEdges: planned,
  },
);

export const MO_H02N = op(
  { id: 'MO-H02n', role: 'twin', twinOf: 'MO-H02', dimension: 'structural', expectedTemplates: [], source: `${SRC_COCKBURN}; Seemann 2011` },
  {
    findSites: (h, s) => injectSites(h, s, { host: inUseCase, kind: 'interface', target: portLayer }),
    checkPreconditions: injectPre(true),
    apply: applyInject,
    plannedEdges: planned,
  },
);

const injectRule: LocationRule = { template: 'domain-state-purity', filePath: 'site', target: 'site-target', discriminator: ['class', 'relType'], line: 'none' };

export const MO_H06 = op(
  {
    id: 'MO-H06',
    role: 'positive',
    dimension: 'pattern',
    expectedTemplates: [injectRule, edgeRule('dependency-direction-graph'), edgeRule('core-isolation')],
    source: `${SRC_EVANS}; ${SRC_COCKBURN}`,
  },
  {
    findSites: (h, s) => injectSites(h, s, { host: isDomain, kind: 'class', target: isOutbound }),
    checkPreconditions: injectPre(false),
    apply: applyInject,
    plannedEdges: planned,
  },
);

export const MO_H06N = op(
  { id: 'MO-H06n', role: 'twin', twinOf: 'MO-H06', dimension: 'pattern', expectedTemplates: [], source: `${SRC_EVANS}; ${SRC_COCKBURN}` },
  {
    findSites: (h, s) => injectSites(h, s, { host: isDomain, kind: 'interface', target: isDomain }),
    checkPreconditions: injectPre(true),
    apply: applyInject,
    plannedEdges: planned,
  },
);

// ── MO-H04 outbound adapter without a port ──────────────────────────────────────────────────────────────────────

/** The adapter-role name parts of `port-adapter-pattern` (`src/fitness-compiler/hexagonal-templates.ts`). */
export const ADAPTER_ROLES: readonly string[] = ['Repository', 'Repo', 'Adapter', 'Gateway'];

/**
 * A class the v1.3 compile of `port-adapter-pattern` selects: its name ENDS with a role word, or with the role word and
 * `Impl` (`src/fitness-compiler/v13-role-names.ts`). The first run used the frozen substring test and seeded
 * `SqlRepositoryBase`, which the v1.3 query never checks (an operator defect, recorded in the run report).
 */
export function hasAdapterRole(name: string): boolean {
  return ADAPTER_ROLES.some((r) => name.endsWith(r) || name.endsWith(`${r}Impl`));
}

/** `implements` entries of a class whose interface is declared in a core or use-case file. */
function portClauses(h: ProjectHandle, r: HexRoles, cls: ClassDeclaration): { text: string; index: number }[] {
  return cls.getImplements().flatMap((e, index) => {
    const decl = e.getExpression().getSymbol()?.getAliasedSymbol()?.getDeclarations()[0] ?? e.getExpression().getSymbol()?.getDeclarations()[0];
    if (decl === undefined || !Node.isInterfaceDeclaration(decl)) return [];
    const rel = relOf(h, decl.getSourceFile());
    return portLayer(r, rel) ? [{ text: e.getText(), index }] : [];
  });
}

function adapterSites(h: ProjectHandle, s: ParsedSpec): MutationSite[] {
  const roles = hexRoles(s);
  const out: MutationSite[] = [];
  for (const sf of filesIn(h, roles, [roles.outbound])) {
    for (const c of sf.getClasses()) {
      const name = c.getName();
      if (name === undefined || !hasAdapterRole(name)) continue;
      const ports = portClauses(h, roles, c).map((p) => p.text).join('\n');
      out.push({ filePath: relOf(h, sf), line: c.getStartLineNumber(), kind: 'implements-clause', detail: { class: name, ports } });
    }
  }
  return out;
}

/** The class still exists and implements at least one port (recorded in `detail.ports` when the site was found). */
const adapterPre = (h: ProjectHandle, _s: ParsedSpec, site: MutationSite): PreconditionResult => {
  if (fileAt(h, site.filePath)?.getClass(site.detail.class ?? '') === undefined) return { ok: false, reason: 'type-shape' };
  return (site.detail.ports ?? '').length === 0 ? { ok: false, reason: 'no-port' } : { ok: true };
};

const implementationRule: LocationRule = { template: 'port-adapter-pattern', filePath: 'site', discriminator: ['implementation'], line: 'none' };

export const MO_H04 = op(
  { id: 'MO-H04', role: 'positive', dimension: 'pattern', expectedTemplates: [implementationRule], source: SRC_COCKBURN },
  {
    findSites: adapterSites,
    checkPreconditions: adapterPre,
    apply(h, site) {
      const cls = fileAt(h, site.filePath)?.getClass(site.detail.class ?? '');
      if (cls === undefined) return fail('MUT_SITE_STALE', `class ${site.detail.class ?? ''} not found`);
      // The port entries were found with the spec when the site was found (`detail.ports`, one clause text per line).
      const ports = (site.detail.ports ?? '').split('\n').filter((x) => x.length > 0);
      const drop = cls.getImplements().map((e, i) => ({ e, i })).filter(({ e }) => ports.includes(e.getText())).map(({ i }) => i).reverse();
      if (drop.length === 0) return fail('MUT_SITE_STALE', `class ${site.detail.class ?? ''} implements no recorded port`);
      for (const i of drop) cls.removeImplements(i);
      return DomainResult.ok(editOf([site.filePath], [], [], { line: cls.getStartLineNumber(), values: { implementation: site.detail.class ?? '' } }));
    },
    plannedEdges: () => [],
  },
);

export const MO_H04N = op(
  { id: 'MO-H04n', role: 'twin', twinOf: 'MO-H04', dimension: 'pattern', expectedTemplates: [], source: SRC_COCKBURN },
  {
    findSites: adapterSites,
    checkPreconditions: adapterPre,
    apply(h, site) {
      const sf = fileAt(h, site.filePath);
      const cls = sf?.getClass(site.detail.class ?? '');
      if (sf === undefined || cls === undefined) return fail('MUT_SITE_STALE', `class ${site.detail.class ?? ''} not found`);
      const name = freshName(sf, `${site.detail.class ?? ''}Contract`);
      sf.insertInterface(cls.getChildIndex(), { name, isExported: true });
      cls.addImplements(name);
      return DomainResult.ok(editOf([site.filePath], [], [], { line: cls.getStartLineNumber(), values: { implementation: site.detail.class ?? '' } }));
    },
    plannedEdges: () => [],
  },
);

export const HEXAGONAL_OPERATORS: readonly MutationOperator[] = [MO_H01, MO_H01N, MO_H02, MO_H02N, MO_H03, MO_H03N, MO_H04, MO_H04N, MO_H05, MO_H05N, MO_H06, MO_H06N, MO_H07, MO_H07N];
