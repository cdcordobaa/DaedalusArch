/**
 * MO-S01 and its twin MO-S01n (FR-v1.2E-24; `business-rules.md` §3; Martin 2017).
 *
 * - **MO-S01**: a domain-layer file imports and uses (value reference) an exported value of an infrastructure-layer
 *   file. Expected `dependency-direction`, `no-domain-outward-dep` keyed `(site file, target file, ['IMPORTS'];
 *   site-line)`. Restriction: the edge is absent in the base (`edge-exists`). Cycles it closes are site collateral.
 * - **MO-S01n**: a non-controller infrastructure file imports a domain symbol it does not yet import, whose name has
 *   no entity-role term (correct-reference: `InMemoryTaskRepository.ts → ICategoryRepository`), used as a value or
 *   type reference. Restrictions: `controller-or-entity` (controller source), `edge-exists`.
 */
import type { MutationOperator } from '../types.js';
import {
  OK,
  applyImportEdge,
  edgeExists,
  edgeRule,
  exportedValueNames,
  fileAt,
  firstNonEntityExport,
  isControllerFile,
  layerOfFile,
  pairSites,
  plannedImportEdge,
  specView,
} from './common.js';

export const MO_S01: MutationOperator = {
  id: 'MO-S01',
  role: 'positive',
  core: true,
  dimension: 'structural',
  expectedTemplates: [edgeRule('dependency-direction'), edgeRule('no-domain-outward-dep')],
  operatorCollateral: [],
  coveredByTemplates: ['dependency-direction', 'no-domain-outward-dep'],
  coverage: 'in',
  source: 'Martin 2017',
  findSites(handle, spec) {
    const view = specView(spec);
    const { domainLayer, infraLayer } = view.binding;
    if (domainLayer === undefined || infraLayer === undefined) return [];
    return pairSites(
      handle,
      'import-edge',
      (rel) => layerOfFile(view, rel) === domainLayer,
      (rel) => layerOfFile(view, rel) === infraLayer,
      (sf) => exportedValueNames(sf)[0],
    );
  },
  checkPreconditions: (_h, _s, site, ctx) => edgeExists(ctx, site),
  apply: (handle, site) => applyImportEdge(handle, site),
  plannedEdges: plannedImportEdge,
  plannedFiles: (site) => [site.filePath],
};

export const MO_S01N: MutationOperator = {
  id: 'MO-S01n',
  role: 'twin',
  core: true,
  twinOf: 'MO-S01',
  dimension: 'structural',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'in',
  source: 'Martin 2017',
  findSites(handle, spec) {
    const view = specView(spec);
    const { domainLayer, infraLayer } = view.binding;
    if (domainLayer === undefined || infraLayer === undefined) return [];
    return pairSites(
      handle,
      'import-edge',
      (rel) => layerOfFile(view, rel) === infraLayer,
      (rel) => layerOfFile(view, rel) === domainLayer,
      firstNonEntityExport,
    );
  },
  checkPreconditions(handle, _spec, site, ctx) {
    const sf = fileAt(handle, site.filePath);
    if (sf !== undefined && isControllerFile(sf, site.filePath)) return { ok: false, reason: 'controller-or-entity' };
    const e = edgeExists(ctx, site);
    return e.ok ? OK : e;
  },
  apply: (handle, site) => applyImportEdge(handle, site),
  plannedEdges: plannedImportEdge,
  plannedFiles: (site) => [site.filePath],
};
