/**
 * AP-REPO-BYPASS and its twin AP-REPO-BYPASSn (v1.3 DRAFT; Integrity; Evans 2003; Fowler 2002; Seemann 2011).
 *
 * - **AP-REPO-BYPASS** (`repo-bypass`): a service method that reaches its data through an injected repository field
 *   (`@InjectRepository(E) private readonly repo: Repository<E>`, `@InjectModel(X.name) private readonly m:
 *   Model<D>`, or `private readonly prisma: PrismaService`) stops using the injection and fetches a global handle
 *   instead: `const repo = getRepository(E);` (TypeORM's global accessor), `const m = model<D>(X.name);` (Mongoose's
 *   global model registry) or `const prisma = new PrismaClient();`, first in the method, with every `this.<field>` of the method
 *   rewritten to the local. The added import is a named import of the package the file already uses.
 * - **AP-REPO-BYPASSn**: the same local, bound to the injected field (`const repo = this.repo;`); the calls still go
 *   through the injected repository.
 *
 * Restrictions: the method uses the field outside nested non-arrow functions (`type-shape`); the import name is not
 * bound to something else in the file (`type-shape`). No template reads call receivers, so no key is expected.
 */
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PlannedImportUse, PreconditionResult, ProjectHandle } from '../types.js';
import { editOf, fail, fileAt, specView } from '../operators/common.js';
import { useFileStyle, fileBindings, boundNames, bodyMethods, ensureNamedImport, freshIn, inNestedThisScope, injectedFields, namedImportLocal, serviceClasses, thisAccesses } from './common.js';
import type { ParameterDeclaration } from 'ts-morph';
import { Node } from 'ts-morph';

export const AP_SOURCE_REPO_BYPASS = 'Evans 2003; Fowler 2002; Seemann 2011';

type Orm = 'typeorm' | 'prisma' | 'mongoose';

/**
 * ORM of an injected field and what the global accessor needs: the TypeORM entity class
 * (`@InjectRepository(E)`), the Mongoose model name expression and document type (`@InjectModel(X.name) m:
 * Model<D>`), or nothing (`PrismaService`).
 */
export function injectedRepository(p: ParameterDeclaration): { readonly orm: Orm; readonly entity: string; readonly doc: string } | undefined {
  const typeorm = p.getDecorators().find((d) => d.getName() === 'InjectRepository')?.getArguments()[0];
  if (typeorm !== undefined && Node.isIdentifier(typeorm)) return { orm: 'typeorm', entity: typeorm.getText(), doc: '' };
  const mongoose = p.getDecorators().find((d) => d.getName() === 'InjectModel')?.getArguments()[0];
  const type = p.getTypeNode();
  if (mongoose !== undefined && Node.isTypeReference(type) && type.getTypeName().getText() === 'Model' && type.getTypeArguments().length === 1) {
    return { orm: 'mongoose', entity: mongoose.getText(), doc: type.getTypeArguments()[0]?.getText() ?? '' };
  }
  if (type?.getText() === 'PrismaService') return { orm: 'prisma', entity: '', doc: '' };
  return undefined;
}

const IMPORT: Record<Orm, { readonly module: string; readonly name: string }> = {
  typeorm: { module: 'typeorm', name: 'getRepository' },
  prisma: { module: '@prisma/client', name: 'PrismaClient' },
  mongoose: { module: 'mongoose', name: 'model' },
};

/** The global accessor expression, given the local name of the imported accessor. */
function accessor(orm: Orm, local: string, detail: Readonly<Record<string, string>>): string {
  if (orm === 'typeorm') return `${local}(${detail.entity ?? ''})`;
  if (orm === 'mongoose') return `${local}<${detail.doc ?? ''}>(${detail.entity ?? ''})`;
  return `new ${local}()`;
}

function sites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const out: MutationSite[] = [];
  for (const { file, cls } of serviceClasses(handle, specView(spec))) {
    for (const field of injectedFields(cls)) {
      const repo = injectedRepository(field);
      if (repo === undefined) continue;
      for (const m of bodyMethods(cls)) {
        if (thisAccesses(m, field.getName()).length === 0) continue;
        out.push({
          filePath: file,
          line: m.getStartLineNumber(),
          kind: 'repo-bypass',
          detail: { class: cls.getName() ?? '', method: m.getName(), field: field.getName(), orm: repo.orm, entity: repo.entity, doc: repo.doc },
        });
      }
    }
  }
  return out;
}

function methodAt(handle: ProjectHandle, site: MutationSite): ReturnType<typeof bodyMethods>[number] | undefined {
  return fileAt(handle, site.filePath)?.getClass(site.detail.class ?? '')?.getMethod(site.detail.method ?? '');
}

function check(handle: ProjectHandle, site: MutationSite, needsImport: boolean): PreconditionResult {
  const m = methodAt(handle, site);
  if (m === undefined) return { ok: false, reason: 'type-shape' };
  const uses = thisAccesses(m, site.detail.field ?? '');
  if (uses.length === 0 || uses.some((u) => inNestedThisScope(u, m))) return { ok: false, reason: 'type-shape' };
  if (needsImport) {
    const imp = IMPORT[(site.detail.orm ?? 'typeorm') as Orm];
    if (namedImportLocal(m.getSourceFile(), imp.module, imp.name) === undefined) return { ok: false, reason: 'type-shape' };
  }
  return { ok: true };
}

function rewrite(handle: ProjectHandle, site: MutationSite, init: (local: string) => string | undefined): DomainResult<MutationEdit> {
  const m = methodAt(handle, site);
  const field = site.detail.field ?? '';
  if (m === undefined) return fail('MUT_SITE_STALE', `method ${site.detail.method ?? ''} of ${site.filePath} is stale`);
  useFileStyle(m.getSourceFile());
  // Never shadow a file binding or the accessor (a Mongoose field named `model`); the twin picks the same name.
  const accessorName = IMPORT[(site.detail.orm ?? 'typeorm') as Orm].name;
  const local = freshIn(new Set([...boundNames(m), ...fileBindings(m.getSourceFile()).keys(), accessorName]), field);
  const value = init(local);
  if (value === undefined) return fail('MUT_SITE_STALE', `import name taken in ${site.filePath}`);
  for (const use of [...thisAccesses(m, field)].reverse()) use.replaceWithText(local);
  m.insertStatements(0, `const ${local} = ${value};`);
  return DomainResult.ok(editOf([site.filePath], [], []));
}

export const AP_REPO_BYPASS: MutationOperator = {
  id: 'AP-REPO-BYPASS',
  role: 'positive',
  core: false,
  dimension: 'integrity',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'integrity',
  source: AP_SOURCE_REPO_BYPASS,
  findSites: sites,
  checkPreconditions: (handle, _spec, site) => check(handle, site, true),
  apply(handle, site): DomainResult<MutationEdit> {
    const orm = (site.detail.orm ?? 'typeorm') as Orm;
    const sf = fileAt(handle, site.filePath);
    return rewrite(handle, site, () => {
      if (sf === undefined) return undefined;
      const imp = ensureNamedImport(sf, IMPORT[orm].module, IMPORT[orm].name);
      if (imp === undefined) return undefined;
      return accessor(orm, imp.local, site.detail);
    });
  },
  plannedEdges: () => [],
  plannedImportUses(site): readonly PlannedImportUse[] {
    const orm = (site.detail.orm ?? 'typeorm') as Orm;
    return [{ specifier: IMPORT[orm].module, fromFile: site.filePath, form: orm === 'prisma' ? 'named-class' : 'named', name: IMPORT[orm].name }];
  },
  plannedFiles: (site) => [site.filePath],
};

export const AP_REPO_BYPASSN: MutationOperator = {
  id: 'AP-REPO-BYPASSn',
  role: 'twin',
  core: false,
  twinOf: 'AP-REPO-BYPASS',
  dimension: 'integrity',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'integrity',
  source: AP_SOURCE_REPO_BYPASS,
  findSites: sites,
  checkPreconditions: (handle, _spec, site) => check(handle, site, false),
  apply: (handle, site) => rewrite(handle, site, () => `this.${site.detail.field ?? ''}`),
  plannedEdges: () => [],
  plannedFiles: (site) => [site.filePath],
};
