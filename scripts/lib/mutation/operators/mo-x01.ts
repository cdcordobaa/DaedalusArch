/**
 * MO-X01 and its twin MO-X01n (FR-v1.2E-24; FR-34; `business-rules.md` §3, BR-U5a-26; Martin 2017).
 *
 * - **MO-X01** (outside coverage): the first named class of a domain-layer file gains an async method that loads an
 *   infrastructure module with `import()` (FR-34: dynamic imports give no edge, a warning only). Intended
 *   `dependency-direction`, `no-domain-outward-dep` keyed `(site file, module file, ['IMPORTS']; site-line = the
 *   `import()` line)`, `coverage: 'outside'`, `coveredByTemplates: []`. Restrictions: the file has no static import
 *   of the module (`edge-exists`); the class stays within `max_public_methods` after the added method
 *   (`threshold-arithmetic`, so no single-responsibility key is introduced).
 * - **MO-X01n**: the same edit in a non-controller infrastructure class, loading a domain module whose first export
 *   has no entity-role term (`controller-or-entity`, `edge-exists`, `threshold-arithmetic`).
 */
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, PreconditionContext, PreconditionResult, ProjectHandle } from '../types.js';
import {
  classMethodCount,
  edgeExists,
  edgeRule,
  editOf,
  fail,
  fileAt,
  firstNonEntityExport,
  freshName,
  isControllerFile,
  layerOfFile,
  namedClasses,
  pairSites,
  specView,
  specifierTo,
} from './common.js';

function maxMethods(ctx: PreconditionContext): number {
  const v = ctx.templateParams['single-responsibility-proxy']?.maxPublicMethods;
  return typeof v === 'number' ? v : Number.POSITIVE_INFINITY;
}

function dynamicPreconditions(handle: ProjectHandle, site: MutationSite, ctx: PreconditionContext, twin: boolean): PreconditionResult {
  const sf = fileAt(handle, site.filePath);
  const cls = sf === undefined ? undefined : namedClasses(sf)[0];
  if (sf === undefined || cls === undefined) return { ok: false, reason: 'type-shape' };
  if (twin && isControllerFile(sf, site.filePath)) return { ok: false, reason: 'controller-or-entity' };
  const e = edgeExists(ctx, site);
  if (!e.ok) return e;
  return classMethodCount(cls) + 1 <= maxMethods(ctx) ? { ok: true } : { ok: false, reason: 'threshold-arithmetic' };
}

function applyDynamicImport(handle: ProjectHandle, site: MutationSite): DomainResult<MutationEdit> {
  const sf = fileAt(handle, site.filePath);
  const target = fileAt(handle, site.detail.targetFile ?? '');
  const cls = sf === undefined ? undefined : namedClasses(sf)[0];
  if (sf === undefined || target === undefined || cls === undefined) return fail('MUT_SITE_STALE', `site ${site.filePath} is stale`);
  const symbol = site.detail.symbol ?? 'Module';
  const name = freshName(sf, `load${symbol.replace(/^I(?=[A-Z])/, '')}Module`);
  const method = cls.addMethod({
    name,
    isAsync: true,
    returnType: 'Promise<unknown>',
    statements: [`return import('${specifierTo(sf, target)}');`],
  });
  const call = method.getStatements()[0];
  const line = call === undefined ? method.getStartLineNumber() : call.getStartLineNumber();
  return DomainResult.ok(editOf([site.filePath], [], [], { line, values: { relType: 'IMPORTS' } }));
}

const hasClass = (_rel: string, sf: Parameters<typeof namedClasses>[0]): boolean => namedClasses(sf).length > 0;

export const MO_X01: MutationOperator = {
  id: 'MO-X01',
  role: 'positive',
  core: true,
  dimension: 'structural',
  expectedTemplates: [edgeRule('dependency-direction'), edgeRule('no-domain-outward-dep')],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  source: 'Martin 2017',
  findSites(handle, spec) {
    const view = specView(spec);
    const { domainLayer, infraLayer } = view.binding;
    if (domainLayer === undefined || infraLayer === undefined) return [];
    return pairSites(
      handle,
      'dynamic-import',
      (rel, sf) => layerOfFile(view, rel) === domainLayer && hasClass(rel, sf),
      (rel) => layerOfFile(view, rel) === infraLayer,
      (sf) => namedClasses(sf)[0]?.getName(),
    );
  },
  checkPreconditions: (handle, _s, site, ctx) => dynamicPreconditions(handle, site, ctx, false),
  apply: applyDynamicImport,
  plannedEdges: () => [],
  plannedFiles: (site) => [site.filePath],
};

export const MO_X01N: MutationOperator = {
  id: 'MO-X01n',
  role: 'twin',
  core: true,
  twinOf: 'MO-X01',
  dimension: 'structural',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'outside',
  source: 'Martin 2017',
  findSites(handle, spec) {
    const view = specView(spec);
    const { domainLayer, infraLayer } = view.binding;
    if (domainLayer === undefined || infraLayer === undefined) return [];
    return pairSites(
      handle,
      'dynamic-import',
      (rel, sf) => layerOfFile(view, rel) === infraLayer && hasClass(rel, sf),
      (rel) => layerOfFile(view, rel) === domainLayer,
      firstNonEntityExport,
    );
  },
  checkPreconditions: (handle, _s, site, ctx) => dynamicPreconditions(handle, site, ctx, true),
  apply: applyDynamicImport,
  plannedEdges: () => [],
  plannedFiles: (site) => [site.filePath],
};
