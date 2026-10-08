/**
 * SP-* probes of the structural templates (BR-U5a-30): `dependency-direction`, `no-cyclic-deps`, `no-layer-skip`,
 * `no-domain-outward-dep`. Each adds one named import plus a value or type reference (`applyImportEdge`).
 *
 * - **SP-FF-S01**: domain file → infrastructure file (MO-S01's sites); key `(site, target, ['IMPORTS']; site-line)`.
 * - **SP-FF-S02**: layered file `a` imports a layered file `b` that already imports `a` (edge `b → a` in the base,
 *   none `a → b`), closing a cycle; the declared key is the `cycle` site collateral (BR-U5a-14 i, 20).
 * - **SP-FF-S03**: presentation file → persistence file under a layered spec (MO-S03's sites).
 * - **SP-FF-S04**: domain file → application-kind file; key `(site, target, ['IMPORTS']; site-line)`.
 */
import type { MutationOperator, MutationSite } from '../../types.js';
import { MO_S01 } from '../mo-s01.js';
import { MO_S03 } from '../mo-s03.js';
import { applyImportEdge, edgeExists, edgeRule, exportedNames, hasEdge, layerOfFile, pairSites, plannedImportEdge, specView } from '../common.js';
import { graphOf, layeredFiles, probeFrom, probeOperator } from './common.js';
import type { SpProbe } from './common.js';

const CLEAN = 'specs/clean-arch.yaml';
const LAYERED = 'tests/fixtures/u5a/layered/firewall.spec.yaml';
const CORRECT = 'fixtures/correct-reference';

export const SP_S01: MutationOperator = probeFrom(MO_S01, {
  id: 'SP-FF-S01',
  dimension: 'structural',
  expectedTemplates: [edgeRule('dependency-direction')],
  coveredByTemplates: ['dependency-direction'],
});

export const SP_S02: MutationOperator = probeOperator(
  { id: 'SP-FF-S02', dimension: 'structural', expectedTemplates: [], coveredByTemplates: ['no-cyclic-deps'] },
  {
    findSites(handle, spec): MutationSite[] {
      const g = graphOf(handle, spec);
      const files = layeredFiles(handle, spec);
      const byPath = new Map(files.map((f) => [f.rel, f]));
      const sites: MutationSite[] = [];
      for (const e of g.edges) {
        const a = byPath.get(e.target);
        if (a === undefined || !byPath.has(e.source) || e.source === e.target || hasEdge(g, e.target, e.source)) continue;
        const b = byPath.get(e.source);
        const symbol = b === undefined ? undefined : exportedNames(b.sf)[0];
        if (symbol === undefined) continue;
        sites.push({ filePath: a.rel, line: 1, kind: 'import-edge', detail: { targetFile: e.source, symbol } });
      }
      return sites;
    },
    checkPreconditions: (_h, _s, site, ctx) => edgeExists(ctx, site),
    apply: (handle, site) => applyImportEdge(handle, site),
    plannedEdges: plannedImportEdge,
    plannedFiles: (site) => [site.filePath],
  },
);

export const SP_S03: MutationOperator = probeFrom(MO_S03, {
  id: 'SP-FF-S03',
  dimension: 'structural',
  expectedTemplates: [edgeRule('no-layer-skip')],
  coveredByTemplates: ['no-layer-skip'],
});

export const SP_S04: MutationOperator = probeOperator(
  { id: 'SP-FF-S04', dimension: 'structural', expectedTemplates: [edgeRule('no-domain-outward-dep')], coveredByTemplates: ['no-domain-outward-dep'] },
  {
    findSites(handle, spec): MutationSite[] {
      const view = specView(spec);
      const { domainLayer, applicationLayers } = view.binding;
      if (domainLayer === undefined || applicationLayers.length === 0) return [];
      return pairSites(
        handle,
        'import-edge',
        (rel) => layerOfFile(view, rel) === domainLayer,
        (rel) => applicationLayers.includes(layerOfFile(view, rel) ?? ''),
        (sf) => exportedNames(sf)[0],
      );
    },
    checkPreconditions: (_h, _s, site, ctx) => edgeExists(ctx, site),
    apply: (handle, site) => applyImportEdge(handle, site),
    plannedEdges: plannedImportEdge,
    plannedFiles: (site) => [site.filePath],
  },
);

export const STRUCTURAL_PROBES: readonly SpProbe[] = [
  {
    op: SP_S01,
    targetTemplate: 'dependency-direction',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: 'domain file imports and references an infrastructure export (MO-S01 edit)',
  },
  {
    op: SP_S02,
    targetTemplate: 'no-cyclic-deps',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'cycle-collateral',
    edit: 'layered file imports and references an export of a file that already imports it (closes one cycle)',
  },
  {
    op: SP_S03,
    targetTemplate: 'no-layer-skip',
    spec: LAYERED,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: 'presentation file imports and references a persistence export (MO-S03 edit, layered fixture spec)',
  },
  {
    op: SP_S04,
    targetTemplate: 'no-domain-outward-dep',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: 'domain file imports and references an application-layer export',
  },
];
