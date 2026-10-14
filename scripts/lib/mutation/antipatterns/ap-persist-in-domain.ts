/**
 * AP-PERSIST-IN-DOMAIN and its twin AP-PERSIST-IN-DOMAINn (v1.3 DRAFT; Semantic; Evans 2003; Nilsson 2006; Martin
 * 2017).
 *
 * - **AP-PERSIST-IN-DOMAIN** (`orm-annotation`): a domain-layer class in a file that imports no persistence package
 *   (other decorators, such as validation or API-schema ones, may be present) becomes an ORM-mapped class: `import { Column, Entity } from 'typeorm';`, `@Entity()` on the
 *   class and `@Column()` on its first plain property. Names taken in the file get an `Orm` alias.
 * - **AP-PERSIST-IN-DOMAINn**: the same class gains a plain domain query on the same property,
 *   `has<Property>(): boolean { return this.<property> !== undefined; }`.
 *
 * Restrictions: the file imports no persistence package (`already-imported`); the project compiles decorators
 * (`experimentalDecorators`) and already uses TypeORM somewhere (`type-shape`), so the edit is one a developer of
 * that project could make. Expected key: FF-P01 `domain-purity` keyed `(site file, 'typeorm', ['IMPORTS'];
 * site-line)` when the spec's forbidden list holds `typeorm`, as for MO-P01; the judge-only reading excludes it.
 */
import { Node } from 'ts-morph';
import type { ClassDeclaration, PropertyDeclaration } from 'ts-morph';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LocationRule, MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import { editOf, fail, fileAt, layerFiles, namedClasses, relOf, specView } from '../operators/common.js';
import { useFileStyle, ensureNamedImport, fileBindings, freshIn, projectUsesPackage, upperFirst } from './common.js';

export const AP_SOURCE_PERSIST_IN_DOMAIN = 'Evans 2003; Nilsson 2006; Martin 2017';

/** Packages whose import makes a file a persistence file (any one blocks the site). */
export const PERSISTENCE_PACKAGES: readonly string[] = [
  'typeorm',
  '@nestjs/typeorm',
  '@prisma/client',
  'mongoose',
  '@nestjs/mongoose',
  'sequelize',
  'sequelize-typescript',
  '@mikro-orm/core',
  'drizzle-orm',
];

/**
 * First non-static, non-`declare` property with an identifier name. Its decorators, if any, are not persistence
 * decorators: the site file imports no persistence package (checked as a precondition).
 */
export function plainProperty(cls: ClassDeclaration): PropertyDeclaration | undefined {
  return cls.getProperties().find((p) => !p.isStatic() && Node.isIdentifier(p.getNameNode()) && !p.hasDeclareKeyword());
}

/** Names of a class's methods, properties, accessors and parameter properties. */
export function memberNames(cls: ClassDeclaration): Set<string> {
  return new Set([
    ...cls.getMethods().map((m) => m.getName()),
    ...cls.getProperties().map((m) => m.getName()),
    ...cls.getGetAccessors().map((m) => m.getName()),
    ...cls.getSetAccessors().map((m) => m.getName()),
    ...cls.getConstructors().flatMap((c) => c.getParameters().filter((p) => p.isParameterProperty()).map((p) => p.getName())),
  ]);
}

function sites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const view = specView(spec);
  const out: MutationSite[] = [];
  for (const sf of layerFiles(handle, view, view.binding.domainLayer)) {
    for (const cls of namedClasses(sf)) {
      const prop = plainProperty(cls);
      if (prop === undefined) continue;
      out.push({
        filePath: relOf(handle, sf),
        line: cls.getStartLineNumber(),
        kind: 'orm-annotation',
        detail: { class: cls.getName() ?? '', property: prop.getName(), package: 'typeorm' },
      });
    }
  }
  return out;
}

function importsPersistence(handle: ProjectHandle, site: MutationSite): boolean {
  const sf = fileAt(handle, site.filePath);
  return (
    sf?.getImportDeclarations().some((i) => {
      const m = i.getModuleSpecifierValue();
      return PERSISTENCE_PACKAGES.some((p) => m === p || m.startsWith(`${p}/`));
    }) === true
  );
}

const packageRule: LocationRule = { template: 'domain-purity', filePath: 'site', target: 'package', discriminator: ['relType'], line: 'site-line' };

export const AP_PERSIST_IN_DOMAIN: MutationOperator = {
  id: 'AP-PERSIST-IN-DOMAIN',
  role: 'positive',
  core: false,
  dimension: 'semantic',
  expectedTemplates: [packageRule],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'semantic',
  source: AP_SOURCE_PERSIST_IN_DOMAIN,
  findSites: sites,
  checkPreconditions(handle, _spec, site): PreconditionResult {
    if (importsPersistence(handle, site)) return { ok: false, reason: 'already-imported' };
    if (handle.project.getCompilerOptions().experimentalDecorators !== true) return { ok: false, reason: 'type-shape' };
    if (!projectUsesPackage(handle, 'typeorm')) return { ok: false, reason: 'type-shape' };
    return { ok: true };
  },
  apply(handle, site): DomainResult<MutationEdit> {
    const sf = fileAt(handle, site.filePath);
    const cls = sf?.getClass(site.detail.class ?? '');
    const prop = cls?.getProperty(site.detail.property ?? '');
    if (sf === undefined || cls === undefined || prop === undefined) return fail('MUT_SITE_STALE', `class site ${site.filePath} is stale`);
    useFileStyle(sf);
    const taken = fileBindings(sf);
    const entityAlias = taken.has('Entity') ? freshIn(new Set(taken.keys()), 'OrmEntity') : undefined;
    const entity = ensureNamedImport(sf, 'typeorm', 'Entity', entityAlias);
    const columnAlias = taken.has('Column') ? freshIn(new Set(taken.keys()), 'OrmColumn') : undefined;
    const column = ensureNamedImport(sf, 'typeorm', 'Column', columnAlias);
    if (entity === undefined || column === undefined) return fail('MUT_SITE_STALE', `typeorm names taken in ${site.filePath}`);
    const line = Math.min(entity.line, column.line);
    cls.insertDecorator(0, { name: entity.local, arguments: [] });
    prop.addDecorator({ name: column.local, arguments: [] });
    return DomainResult.ok(editOf([site.filePath], [], [], { line, values: { relType: 'IMPORTS' } }));
  },
  plannedEdges: () => [],
  plannedImportUses: (site) => [
    { specifier: 'typeorm', fromFile: site.filePath, form: 'named', name: 'Column' },
    { specifier: 'typeorm', fromFile: site.filePath, form: 'named', name: 'Entity' },
  ],
  plannedFiles: (site) => [site.filePath],
};

export const AP_PERSIST_IN_DOMAINN: MutationOperator = {
  id: 'AP-PERSIST-IN-DOMAINn',
  role: 'twin',
  core: false,
  twinOf: 'AP-PERSIST-IN-DOMAIN',
  dimension: 'semantic',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'semantic',
  source: AP_SOURCE_PERSIST_IN_DOMAIN,
  findSites: sites,
  checkPreconditions: (): PreconditionResult => ({ ok: true }),
  apply(handle, site): DomainResult<MutationEdit> {
    const cls = fileAt(handle, site.filePath)?.getClass(site.detail.class ?? '');
    const property = site.detail.property ?? '';
    if (cls?.getProperty(property) === undefined) return fail('MUT_SITE_STALE', `class site ${site.filePath} is stale`);
    useFileStyle(cls.getSourceFile());
    const members = memberNames(cls);
    const name = freshIn(members, `has${upperFirst(property)}`);
    cls.addMethod({ name, returnType: 'boolean', statements: `return this.${property} !== undefined;` });
    return DomainResult.ok(editOf([site.filePath], [], []));
  },
  plannedEdges: () => [],
  plannedFiles: (site) => [site.filePath],
};
