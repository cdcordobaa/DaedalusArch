/**
 * SP-* probes of the coupling templates (BR-U5a-30). Metric templates are seeded by a stated amount (`detail.amount`)
 * computed from the spec's threshold and the base value of the site file on the base import graph (BR-U5a-56
 * builder; `business-logic-model.md` §2.5 predicates); the amount is the smallest that crosses the threshold.
 *
 * - **SP-FF-C01** (`domain-stability`): a domain file with non-domain fan-in `i` and fan-out `o` imports `n` new
 *   files created in the first application-layer directory (`ProbeStability<k>.ts`), the smallest `n` with
 *   `(o + n) / (i + o + n) > threshold`.
 * - **SP-FF-C02** (`module-fan-out`): a layered file with fan-out `o` imports `floor(threshold) + 1 − o` new files
 *   created next to it (`ProbeFanOut<k>.ts`).
 * - **SP-FF-C03** (`component-instability`): a layered file imports the smallest `n` new sibling files
 *   (`ProbeInstability<k>.ts`) with `(o + n) / (i + o + n) > threshold`.
 * - **SP-FF-C04** (`no-orphan-files`): MO-C04's created orphan.
 * - **SP-FF-C05** (`max-fan-in`): `floor(threshold) + 1 − i` new sibling files (`ProbeFanIn<k>.ts`) each import and
 *   reference the site file's first export.
 * - **SP-FF-C06** (`abstraction-ratio`, project level): a created file `ProbeAbstraction.ts` declares the smallest
 *   number `n` of classes with `interfaces / (total + n) < threshold`; the declared key is the keyless
 *   `project-metric` entry (BR-U5a-14 iv).
 * Each metric probe has the precondition `metric-already-violating` (the site already violates in the base).
 * Keys `(site file, '', []; none)`; created files without a test sibling give their own collateral.
 */
import { DomainResult } from '../../../../../src/shared/errors/domain-result.js';
import type { MutationEdit, MutationOperator, MutationSite, ParsedSpec, PreconditionResult, ProjectHandle } from '../../types.js';
import { MO_C04 } from '../mo-c04.js';
import {
  appendTypeRef,
  appendValueRef,
  editOf,
  exportedNames,
  exportedValueNames,
  fail,
  fileAt,
  insertImport,
  lowerFirst,
  specView,
  specifierTo,
} from '../common.js';
import {
  OK,
  createFile,
  createdPaths,
  fileRule,
  firstDirOfLayer,
  graphOf,
  importCreatedValues,
  importNeighbours,
  instabilityAmount,
  layeredFiles,
  probeFrom,
  probeOperator,
  specThreshold,
  typeCounts,
} from './common.js';
import type { SpProbe } from './common.js';

const CLEAN = 'specs/clean-arch.yaml';
const CORRECT = 'fixtures/correct-reference';

const alreadyViolating: (site: MutationSite) => PreconditionResult = (site) =>
  site.detail.alreadyViolating === 'yes' ? { ok: false, reason: 'metric-already-violating' } : OK;

function createdOf(site: MutationSite): string[] {
  const n = Number(site.detail.amount);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(`${site.detail.directory ?? ''}/${site.detail.stem ?? ''}${String(i)}.ts`);
  return out;
}

/** Fan-out probes: the site file imports `detail.amount` created files `<directory>/<stem><k>.ts`. */
function fanOutProbe(id: string, template: string, stem: string, sites: (handle: ProjectHandle, spec: ParsedSpec) => MutationSite[]): MutationOperator {
  return probeOperator(
    { id, dimension: 'coupling', expectedTemplates: [fileRule(template)], coveredByTemplates: [template] },
    {
      findSites: sites,
      checkPreconditions: (_h, _s, site) => alreadyViolating(site),
      apply(handle, site): DomainResult<MutationEdit> {
        const sf = fileAt(handle, site.filePath);
        const files = createdOf(site);
        if (sf === undefined || files.some((f) => fileAt(handle, f) !== undefined)) return fail('MUT_SITE_STALE', `site ${site.filePath} is stale`);
        const edges = importCreatedValues(handle, sf, site.filePath, files, lowerFirst(stem));
        return DomainResult.ok(editOf([site.filePath], files, edges));
      },
      plannedEdges: (site) => createdOf(site).map((target) => ({ source: site.filePath, target })),
      plannedFiles: (site) => [site.filePath],
    },
  );
}

function siteOf(rel: string, detail: Record<string, string>): MutationSite {
  return { filePath: rel, line: 1, kind: 'import-edge', detail };
}

export const SP_C01: MutationOperator = fanOutProbe('SP-FF-C01', 'domain-stability', 'ProbeStability', (handle, spec) => {
  const { domainLayer, applicationLayers, infraLayer } = specView(spec).binding;
  const threshold = specThreshold(spec, 'domain-stability');
  const dir = firstDirOfLayer(handle, spec, applicationLayers[0] ?? infraLayer);
  if (domainLayer === undefined || threshold === undefined || dir === undefined) return [];
  const g = graphOf(handle, spec);
  // Cypher `x.layer <> $domainLayer` is null (false) for an unlayered file: only layered non-domain neighbours count.
  const outer = (f: string): boolean => {
    const l = g.files.get(f)?.layer ?? null;
    return l !== null && l !== domainLayer;
  };
  const sites: MutationSite[] = [];
  for (const f of layeredFiles(handle, spec)) {
    if (f.layer !== domainLayer) continue;
    const n = importNeighbours(g, f.rel);
    const fanIn = [...n.incoming].filter(outer).length;
    const fanOut = [...n.outgoing].filter(outer).length;
    const amount = instabilityAmount(fanIn, fanOut, threshold);
    if (amount === undefined || createdPaths(handle, dir, 'ProbeStability', amount) === undefined) continue;
    const violating = fanIn + fanOut > 0 && fanOut / (fanIn + fanOut) > threshold;
    sites.push(siteOf(f.rel, { threshold: String(threshold), fanIn: String(fanIn), fanOut: String(fanOut), amount: String(amount), directory: dir, stem: 'ProbeStability', alreadyViolating: violating ? 'yes' : 'no' }));
  }
  return sites;
});

export const SP_C02: MutationOperator = fanOutProbe('SP-FF-C02', 'module-fan-out', 'ProbeFanOut', (handle, spec) => {
  const threshold = specThreshold(spec, 'module-fan-out');
  if (threshold === undefined) return [];
  const g = graphOf(handle, spec);
  const sites: MutationSite[] = [];
  for (const f of layeredFiles(handle, spec)) {
    const fanOut = importNeighbours(g, f.rel).outgoing.size;
    const amount = Math.max(1, Math.floor(threshold) + 1 - fanOut);
    const dir = f.rel.slice(0, f.rel.lastIndexOf('/'));
    if (createdPaths(handle, dir, 'ProbeFanOut', amount) === undefined) continue;
    sites.push(siteOf(f.rel, { threshold: String(threshold), fanOut: String(fanOut), amount: String(amount), directory: dir, stem: 'ProbeFanOut', alreadyViolating: fanOut > threshold ? 'yes' : 'no' }));
  }
  return sites;
});

export const SP_C03: MutationOperator = fanOutProbe('SP-FF-C03', 'component-instability', 'ProbeInstability', (handle, spec) => {
  const threshold = specThreshold(spec, 'component-instability');
  if (threshold === undefined) return [];
  const g = graphOf(handle, spec);
  const sites: MutationSite[] = [];
  for (const f of layeredFiles(handle, spec)) {
    const n = importNeighbours(g, f.rel);
    const fanIn = n.incoming.size;
    const fanOut = n.outgoing.size;
    const amount = instabilityAmount(fanIn, fanOut, threshold);
    const dir = f.rel.slice(0, f.rel.lastIndexOf('/'));
    if (amount === undefined || createdPaths(handle, dir, 'ProbeInstability', amount) === undefined) continue;
    const violating = fanIn + fanOut > 0 && fanOut / (fanIn + fanOut) > threshold;
    sites.push(siteOf(f.rel, { threshold: String(threshold), fanIn: String(fanIn), fanOut: String(fanOut), amount: String(amount), directory: dir, stem: 'ProbeInstability', alreadyViolating: violating ? 'yes' : 'no' }));
  }
  return sites;
});

export const SP_C04: MutationOperator = probeFrom(MO_C04, {
  id: 'SP-FF-C04',
  dimension: 'coupling',
  expectedTemplates: MO_C04.expectedTemplates,
  coveredByTemplates: ['no-orphan-files'],
});

export const SP_C05: MutationOperator = probeOperator(
  { id: 'SP-FF-C05', dimension: 'coupling', expectedTemplates: [fileRule('max-fan-in')], coveredByTemplates: ['max-fan-in'] },
  {
    findSites(handle, spec): MutationSite[] {
      const threshold = specThreshold(spec, 'max-fan-in');
      if (threshold === undefined) return [];
      const g = graphOf(handle, spec);
      const sites: MutationSite[] = [];
      for (const f of layeredFiles(handle, spec)) {
        const symbol = exportedNames(f.sf)[0];
        if (symbol === undefined) continue;
        const fanIn = importNeighbours(g, f.rel).incoming.size;
        const amount = Math.max(1, Math.floor(threshold) + 1 - fanIn);
        const dir = f.rel.slice(0, f.rel.lastIndexOf('/'));
        if (createdPaths(handle, dir, 'ProbeFanIn', amount) === undefined) continue;
        sites.push(siteOf(f.rel, { threshold: String(threshold), fanIn: String(fanIn), amount: String(amount), directory: dir, stem: 'ProbeFanIn', symbol, alreadyViolating: fanIn > threshold ? 'yes' : 'no' }));
      }
      return sites;
    },
    checkPreconditions: (_h, _s, site) => alreadyViolating(site),
    apply(handle, site): DomainResult<MutationEdit> {
      const target = fileAt(handle, site.filePath);
      const symbol = site.detail.symbol ?? '';
      const files = createdOf(site);
      if (target === undefined || symbol.length === 0 || files.some((f) => fileAt(handle, f) !== undefined)) return fail('MUT_SITE_STALE', `site ${site.filePath} is stale`);
      const isValue = exportedValueNames(target).includes(symbol);
      files.forEach((rel, i) => {
        const created = createFile(handle, rel, '');
        insertImport(created, specifierTo(created, target), { named: [symbol] });
        if (isValue) appendValueRef(created, symbol, `probeFanIn${String(i)}`);
        else appendTypeRef(created, symbol, `ProbeFanIn${String(i)}`);
      });
      return DomainResult.ok(editOf([], files, files.map((source) => ({ source, target: site.filePath }))));
    },
    plannedEdges: (site) => createdOf(site).map((source) => ({ source, target: site.filePath })),
    plannedFiles: () => [],
  },
);

export const PROBE_ABSTRACTION_FILE = 'ProbeAbstraction.ts';

export const SP_C06: MutationOperator = probeOperator(
  { id: 'SP-FF-C06', dimension: 'coupling', expectedTemplates: [], coveredByTemplates: ['abstraction-ratio'] },
  {
    findSites(handle, spec): MutationSite[] {
      const threshold = specThreshold(spec, 'abstraction-ratio');
      const first = layeredFiles(handle, spec)[0];
      if (threshold === undefined || first === undefined) return [];
      const dir = first.rel.slice(0, first.rel.lastIndexOf('/'));
      const created = `${dir}/${PROBE_ABSTRACTION_FILE}`;
      if (fileAt(handle, created) !== undefined) return [];
      const { classes, interfaces } = typeCounts(handle);
      const total = classes + interfaces;
      let amount = 1;
      while (interfaces / (total + amount) >= threshold && amount < 10_000) amount++;
      const violating = total > 0 && interfaces / total < threshold;
      return [
        {
          filePath: created,
          line: 1,
          kind: 'created-file',
          detail: { threshold: String(threshold), interfaces: String(interfaces), total: String(total), amount: String(amount), alreadyViolating: violating ? 'yes' : 'no' },
        },
      ];
    },
    checkPreconditions: (_h, _s, site) => alreadyViolating(site),
    apply(handle, site): DomainResult<MutationEdit> {
      if (fileAt(handle, site.filePath) !== undefined) return fail('MUT_SITE_STALE', `${site.filePath} already exists`);
      const n = Number(site.detail.amount);
      const body: string[] = [];
      for (let i = 0; i < n; i++) body.push(`export class ProbeConcrete${String(i)} {}`);
      createFile(handle, site.filePath, body.join('\n') + '\n');
      return DomainResult.ok(editOf([], [site.filePath], []));
    },
    plannedEdges: () => [],
    plannedFiles: () => [],
  },
);

export const COUPLING_PROBES: readonly SpProbe[] = [
  {
    op: SP_C01,
    targetTemplate: 'domain-stability',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: 'domain file imports n new files created in the first application-layer directory; n = smallest with (fanOut + n) / (fanIn + fanOut + n) > threshold (non-domain neighbours)',
  },
  { op: SP_C02, targetTemplate: 'module-fan-out', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'layered file imports floor(threshold) + 1 − fanOut new sibling files' },
  {
    op: SP_C03,
    targetTemplate: 'component-instability',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'expected',
    edit: 'layered file imports n new sibling files; n = smallest with (fanOut + n) / (fanIn + fanOut + n) > threshold',
  },
  { op: SP_C04, targetTemplate: 'no-orphan-files', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'created file with one exported const, imported by nothing (MO-C04 edit)' },
  { op: SP_C05, targetTemplate: 'max-fan-in', spec: CLEAN, fixture: CORRECT, declaredBy: 'expected', edit: 'floor(threshold) + 1 − fanIn new sibling files each import and reference the site file' },
  {
    op: SP_C06,
    targetTemplate: 'abstraction-ratio',
    spec: CLEAN,
    fixture: CORRECT,
    declaredBy: 'project-metric',
    edit: `created ${PROBE_ABSTRACTION_FILE} declares n classes; n = smallest with interfaces / (total + n) < threshold`,
  },
];
