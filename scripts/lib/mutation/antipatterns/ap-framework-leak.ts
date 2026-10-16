/**
 * AP-FRAMEWORK-LEAK and its twin AP-FRAMEWORK-LEAKn (v1.3 DRAFT; Semantic; Martin 2017; Cockburn 2005; NestJS
 * documentation, "Controllers": library-specific approach).
 *
 * - **AP-FRAMEWORK-LEAK** (`framework-param`): a public method of an application-layer service takes the HTTP
 *   framework's request object: a trailing optional parameter `request?: Request` with
 *   `import { Request } from 'express';` (aliased `ExpressRequest` when `Request` is bound in the file). Callers
 *   compile unchanged; the use case's signature now names the transport.
 * - **AP-FRAMEWORK-LEAKn**: the same method takes a plain DTO instead: a trailing optional `context?:
 *   <Method>ContextDto`, with `export interface <Method>ContextDto { readonly requestId?: string; }` declared in the
 *   file.
 *
 * Restrictions: the method has no rest parameter and no parameter already typed with a framework request or
 * response (`type-shape`); the project has express types (a file imports `express`, `paths` maps it, or a
 * `package.json` declares `@types/express`; `type-shape`). Under `noUnusedParameters` both parameters take a `_`
 * prefix (`_request`, `_context`), the spelling TypeScript exempts. Sites lie in application-kind layers only: in a domain file the same
 * import is MO-P01's FF-P01 case, so here no template reads the edit and no key is expected.
 */
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../types.js';
import { editOf, fail, fileAt, specView } from '../operators/common.js';
import { useFileStyle, ensureNamedImport, fileBindings, freshIn, projectUsesPackage, publicMethods, serviceClasses, upperFirst } from './common.js';

export const AP_SOURCE_FRAMEWORK_LEAK = 'Martin 2017; Cockburn 2005; NestJS docs (Controllers)';

const FRAMEWORK_TYPE = /\b(?:Request|Response|HttpException|FastifyRequest|FastifyReply|ExecutionContext)\b/;

function sites(handle: ProjectHandle, spec: ParsedSpec): MutationSite[] {
  const out: MutationSite[] = [];
  for (const { file, cls } of serviceClasses(handle, specView(spec))) {
    for (const m of publicMethods(cls)) {
      out.push({ filePath: file, line: m.getStartLineNumber(), kind: 'framework-param', detail: { class: cls.getName() ?? '', method: m.getName(), framework: 'express' } });
    }
  }
  return out;
}

function methodAt(handle: ProjectHandle, site: MutationSite): ReturnType<typeof publicMethods>[number] | undefined {
  return fileAt(handle, site.filePath)?.getClass(site.detail.class ?? '')?.getMethod(site.detail.method ?? '');
}

function check(handle: ProjectHandle, site: MutationSite, framework: boolean): PreconditionResult {
  const m = methodAt(handle, site);
  if (m === undefined || m.getParameters().some((p) => p.isRestParameter() || FRAMEWORK_TYPE.test(p.getTypeNode()?.getText() ?? ''))) {
    return { ok: false, reason: 'type-shape' };
  }
  // Types of express come from `@types/express` (express 4) or the package (express 5 ships none; Nest pulls 4).
  if (framework && !projectUsesPackage(handle, 'express', ['@types/express'])) return { ok: false, reason: 'type-shape' };
  return { ok: true };
}

function addParameter(handle: ProjectHandle, site: MutationSite, base: string, type: (sfLocal: string) => string | undefined): DomainResult<MutationEdit> {
  const m = methodAt(handle, site);
  if (m === undefined) return fail('MUT_SITE_STALE', `method ${site.detail.method ?? ''} of ${site.filePath} is stale`);
  useFileStyle(m.getSourceFile());
  const typeText = type(base);
  if (typeText === undefined) return fail('MUT_SITE_STALE', `type name taken in ${site.filePath}`);
  // Under `noUnusedParameters` the new parameter takes the `_` prefix TypeScript exempts.
  const unused = handle.project.getCompilerOptions().noUnusedParameters === true ? `_${base}` : base;
  const name = freshIn(new Set(m.getParameters().map((p) => p.getName())), unused);
  m.addParameter({ name, type: typeText, hasQuestionToken: true });
  return DomainResult.ok(editOf([site.filePath], [], []));
}

export const AP_FRAMEWORK_LEAK: MutationOperator = {
  id: 'AP-FRAMEWORK-LEAK',
  role: 'positive',
  core: false,
  dimension: 'semantic',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'semantic',
  source: AP_SOURCE_FRAMEWORK_LEAK,
  findSites: sites,
  checkPreconditions: (handle, _spec, site) => check(handle, site, true),
  apply(handle, site): DomainResult<MutationEdit> {
    const sf = fileAt(handle, site.filePath);
    return addParameter(handle, site, 'request', () => {
      if (sf === undefined) return undefined;
      const bound = fileBindings(sf);
      const alias = bound.has('Request') && bound.get('Request') !== 'express' ? freshIn(new Set(bound.keys()), 'ExpressRequest') : undefined;
      return ensureNamedImport(sf, 'express', 'Request', alias)?.local;
    });
  },
  plannedEdges: () => [],
  plannedImportUses: (site) => [{ specifier: 'express', fromFile: site.filePath, form: 'named', name: 'Request' }],
  plannedFiles: (site) => [site.filePath],
};

export const AP_FRAMEWORK_LEAKN: MutationOperator = {
  id: 'AP-FRAMEWORK-LEAKn',
  role: 'twin',
  core: false,
  twinOf: 'AP-FRAMEWORK-LEAK',
  dimension: 'semantic',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  judgeProbe: 'semantic',
  source: AP_SOURCE_FRAMEWORK_LEAK,
  findSites: sites,
  checkPreconditions: (handle, _spec, site) => check(handle, site, false),
  apply(handle, site): DomainResult<MutationEdit> {
    const sf = fileAt(handle, site.filePath);
    return addParameter(handle, site, 'context', () => {
      if (sf === undefined) return undefined;
      const name = freshIn(new Set(fileBindings(sf).keys()), `${upperFirst(site.detail.method ?? '')}ContextDto`);
      sf.addInterface({ isExported: true, name, properties: [{ name: 'requestId', type: 'string', hasQuestionToken: true, isReadonly: true }] });
      return name;
    });
  },
  plannedEdges: () => [],
  plannedFiles: (site) => [site.filePath],
};
