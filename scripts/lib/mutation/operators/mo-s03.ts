/**
 * MO-S03 and its twin MO-S03n (FR-v1.2E-24; `business-rules.md` §3; Buschmann et al. 1996). Layered style only.
 *
 * - **MO-S03**: a presentation-layer file imports and uses an exported value of a persistence (infrastructure-kind)
 *   file directly, skipping the business layer. Expected `no-layer-skip` keyed `(site file, target file,
 *   ['IMPORTS']; site-line)`. Restrictions: the spec's `no-layer-skip` is compiled (else the whole operator is
 *   style-disabled, BR-U5a-12 a), `edge-exists`.
 * - **MO-S03n**: a presentation file imports and uses a business-layer (domain-kind) symbol it does not yet import,
 *   whose name has no entity-role term. Restrictions: `style-disabled` when the spec does not compile
 *   `no-layer-skip`, `edge-exists`.
 */
import type { MutationOperator } from '../types.js';
import {
  OK,
  applyImportEdge,
  edgeExists,
  edgeRule,
  exportedValueNames,
  firstNonEntityExport,
  layerOfFile,
  pairSites,
  plannedImportEdge,
  specView,
} from './common.js';

export const MO_S03: MutationOperator = {
  id: 'MO-S03',
  role: 'positive',
  core: false,
  dimension: 'structural',
  expectedTemplates: [edgeRule('no-layer-skip')],
  operatorCollateral: [],
  coveredByTemplates: ['no-layer-skip'],
  coverage: 'in',
  source: 'Buschmann et al. 1996',
  findSites(handle, spec) {
    const view = specView(spec);
    const { presentationLayer, infraLayer } = view.binding;
    if (presentationLayer === undefined || infraLayer === undefined) return [];
    return pairSites(
      handle,
      'import-edge',
      (rel) => layerOfFile(view, rel) === presentationLayer,
      (rel) => layerOfFile(view, rel) === infraLayer,
      (sf) => exportedValueNames(sf)[0],
    );
  },
  checkPreconditions: (_h, _s, site, ctx) => edgeExists(ctx, site),
  apply: (handle, site) => applyImportEdge(handle, site),
  plannedEdges: plannedImportEdge,
  plannedFiles: (site) => [site.filePath],
};

export const MO_S03N: MutationOperator = {
  id: 'MO-S03n',
  role: 'twin',
  core: false,
  twinOf: 'MO-S03',
  dimension: 'structural',
  expectedTemplates: [],
  operatorCollateral: [],
  coveredByTemplates: [],
  coverage: 'in',
  source: 'Buschmann et al. 1996',
  findSites(handle, spec) {
    const view = specView(spec);
    const { presentationLayer, domainLayer } = view.binding;
    if (presentationLayer === undefined || domainLayer === undefined) return [];
    return pairSites(
      handle,
      'import-edge',
      (rel) => layerOfFile(view, rel) === presentationLayer,
      (rel) => layerOfFile(view, rel) === domainLayer,
      firstNonEntityExport,
    );
  },
  checkPreconditions(_h, _s, site, ctx) {
    if (!ctx.enabledTemplates.includes('no-layer-skip')) return { ok: false, reason: 'style-disabled' };
    const e = edgeExists(ctx, site);
    return e.ok ? OK : e;
  },
  apply: (handle, site) => applyImportEdge(handle, site),
  plannedEdges: plannedImportEdge,
  plannedFiles: (site) => [site.filePath],
};
