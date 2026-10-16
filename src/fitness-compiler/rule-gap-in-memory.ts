/**
 * In-memory mirrors of the rule-gap templates (`rule-gap-templates.ts`): pure predicates over an APG (with the
 * ingestion's layer annotation, `memGraph`) that return the rows the Cypher returns (same columns, same order), and
 * `ruleGapParams`, which binds every template parameter from a spec's layer model. Exclude paths are not applied.
 *
 * Patterns are full-match regular expressions, as Cypher's `=~` reads them.
 */
import type { APGNode } from '../shared/types/apg.js';
import type { LayerModel } from '../shared/types/spec.js';
import type { MemGraph, Row } from './apg2-in-memory.js';
import { compositionRootLayers } from './apg2-in-memory.js';
import { bindLayerParams } from './layer-binding.js';
import { globToRegex } from './glob-to-regex.js';
import { APG2_COMPOSITION_ROOT_NAME_PATTERNS, APG2_TEST_PATTERNS } from '../shared/apg2-scope.js';

/** An aggregate as the rule-gap templates read it: module, root and inner-entity globs as anchored regexes. */
export interface RuleGapAggregate {
  readonly name: string;
  readonly module: string;
  readonly root: string;
  readonly innerEntities: readonly string[];
}

export interface RuleGapParams {
  readonly domainLayer: string;
  readonly applicationLayers: readonly string[];
  /** Domain and application layers: a controller there is not an adapter. */
  readonly coreLayers: readonly string[];
  readonly forbiddenImports: readonly string[];
  readonly testPatterns: readonly string[];
  readonly compositionRootLayers: readonly string[];
  readonly compositionRootPatterns: readonly string[];
  readonly controllerNamePattern: string;
  readonly dataAccessNamePattern: string;
  readonly entityPatterns: readonly string[];
  readonly entityNamePattern: string;
  readonly aggregates: readonly RuleGapAggregate[];
  readonly aggregateDependencyNamePattern: string;
  readonly repositoryPatterns: readonly string[];
  readonly serviceNamePattern: string;
  readonly servicePatterns: readonly string[];
  /** Names of modules known to be `@Global()` (decorators are not ingested, so this is declared, not detected). */
  readonly globalModulePatterns: readonly string[];
}

/** Defaults, fixed before any run on the development set. */
export const RULE_GAP_DEFAULTS = Object.freeze({
  controllerNamePattern: '.*Controller',
  dataAccessNamePattern: '.*(?:Repository|Repo|Gateway|Dao|DAO|DataSource|Database|EntityManager)',
  entityPatterns: Object.freeze(['^(?:.*/)?(?:entities|entity|aggregates|aggregate)/.*$']),
  entityNamePattern: '.*(?:Entity|Aggregate)',
  aggregateDependencyNamePattern: '.*(?:Repository|Repo|Service|Gateway|Dao|DAO)',
  serviceNamePattern: '.*Service',
  servicePatterns: Object.freeze(['^(?:.*/)?services/.*$']),
});

const rx = (glob: string): string => globToRegex(glob, { segmentGlobstar: true });

/**
 * Parameters as the templates read them. `forbiddenImports` is the spec's FF-P01 list (passed in). The DDD
 * declarations (`architecture.ddd`), when present, give the aggregates, the repository paths, and the entity paths
 * (aggregate roots and inner entities) in place of the default entity folders.
 */
export function ruleGapParams(layerModel: LayerModel, extra: { forbiddenImports?: readonly string[]; globalModulePatterns?: readonly string[] } = {}): RuleGapParams {
  const b = bindLayerParams(layerModel.layers);
  const ddd = layerModel.ddd;
  const aggregates = (ddd?.aggregates ?? []).map((a) => ({ name: a.name, module: rx(a.module), root: rx(a.root), innerEntities: a.innerEntities.map(rx) }));
  const domainLayer = b.domainLayer ?? '';
  return {
    domainLayer,
    applicationLayers: [...b.applicationLayers],
    coreLayers: [...(b.domainLayer !== undefined ? [b.domainLayer] : []), ...b.applicationLayers],
    forbiddenImports: [...(extra.forbiddenImports ?? [])],
    testPatterns: [...APG2_TEST_PATTERNS],
    compositionRootLayers: compositionRootLayers(layerModel),
    compositionRootPatterns: [...APG2_COMPOSITION_ROOT_NAME_PATTERNS],
    controllerNamePattern: RULE_GAP_DEFAULTS.controllerNamePattern,
    dataAccessNamePattern: RULE_GAP_DEFAULTS.dataAccessNamePattern,
    entityPatterns: aggregates.length > 0 ? aggregates.flatMap((a) => [a.root, ...a.innerEntities]) : [...RULE_GAP_DEFAULTS.entityPatterns],
    entityNamePattern: RULE_GAP_DEFAULTS.entityNamePattern,
    aggregates,
    aggregateDependencyNamePattern: RULE_GAP_DEFAULTS.aggregateDependencyNamePattern,
    repositoryPatterns: (ddd?.repositories ?? []).map(rx),
    serviceNamePattern: RULE_GAP_DEFAULTS.serviceNamePattern,
    servicePatterns: [...RULE_GAP_DEFAULTS.servicePatterns],
    globalModulePatterns: [...(extra.globalModulePatterns ?? [])],
  };
}

type Mirror = (g: MemGraph, p: RuleGapParams) => Row[];

/** Cypher `=~`: a full match. */
const full = (pattern: string, s: string): boolean => new RegExp(`^(?:${pattern})$`).test(s);
const anyFull = (patterns: readonly string[], s: string): boolean => patterns.some((p) => full(p, s));

const cmp = (...keys: string[]) => (a: Row, b: Row): number => {
  for (const k of keys) {
    const x = JSON.stringify(a[k] ?? '');
    const y = JSON.stringify(b[k] ?? '');
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};

/** Rows with equal JSON are one row (`RETURN DISTINCT`). */
const distinct = (rows: Row[]): Row[] => [...new Map(rows.map((r) => [JSON.stringify(r), r])).values()];

const notTest = (_g: MemGraph, p: RuleGapParams, n: APGNode): boolean => !anyFull(p.testPatterns, n.filePath);
const notCompositionRoot = (g: MemGraph, p: RuleGapParams, n: APGNode): boolean => {
  const l = g.layer.get(n.id) ?? null;
  return (l === null || !p.compositionRootLayers.includes(l)) && !anyFull(p.compositionRootPatterns, n.filePath);
};
const inScope = (g: MemGraph, p: RuleGapParams, n: APGNode): boolean => notTest(g, p, n) && notCompositionRoot(g, p, n);

const forbidden = (patterns: readonly string[], name: string): boolean =>
  patterns.some((fp) => name === fp || (fp.endsWith('/*') && name.startsWith(fp.slice(0, -1))));

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function useCaseFrameworkFree(g: MemGraph, p: RuleGapParams): Row[] {
  const rows: Row[] = [];
  for (const type of ['IMPORTS', 'RE_EXPORTS']) {
    for (const e of g.edgesOf(type)) {
      const src = g.node(e.sourceId);
      const pkg = g.node(e.targetId);
      if (src.type !== 'File' || pkg.type !== 'Package') continue;
      const layer = g.layer.get(src.id) ?? null;
      if (layer === null || !p.applicationLayers.includes(layer)) continue;
      if (!forbidden(p.forbiddenImports, pkg.name) || !inScope(g, p, src)) continue;
      rows.push({ source: src.filePath, target: pkg.name, layer, relType: type, line: e.properties.line ?? null,
        lines: e.properties.lines ?? null, isTypeOnly: e.properties.isTypeOnly ?? false });
    }
  }
  return rows.sort(cmp('source', 'target', 'relType'));
}

export function controllerBypassesApplication(g: MemGraph, p: RuleGapParams): Row[] {
  const rows: Row[] = [];
  for (const type of ['CONSTRUCTOR_INJECTS', 'HOLDS_STATE_OF']) {
    for (const e of g.edgesOf(type)) {
      const ctrl = g.node(e.sourceId);
      const dep = g.node(e.targetId);
      if (ctrl.type !== 'Class' || !full(p.controllerNamePattern, ctrl.name)) continue;
      const cl = g.layer.get(ctrl.id) ?? null;
      if (cl !== null && p.coreLayers.includes(cl)) continue;
      if (!full(p.dataAccessNamePattern, dep.name) || !inScope(g, p, ctrl)) continue;
      rows.push({ filePath: ctrl.filePath, controller: ctrl.name, dependency: dep.name, target: dep.filePath, targetLayer: g.layer.get(dep.id) ?? null });
    }
  }
  return distinct(rows).sort(cmp('filePath', 'controller', 'dependency'));
}

export function useCaseExposesEntity(g: MemGraph, p: RuleGapParams): Row[] {
  const ownerOf = new Map<string, APGNode>();
  for (const e of g.edgesOf('CONTAINS')) {
    const o = g.node(e.sourceId);
    if (o.type === 'Class') ownerOf.set(e.targetId, o);
  }
  const rows: Row[] = [];
  for (const e of g.edgesOf('SIGNATURE_USES')) {
    if (e.properties.publicSurface !== true) continue;
    const m = g.node(e.sourceId);
    const ty = g.node(e.targetId);
    const owner = ownerOf.get(m.id);
    if (m.type !== 'Method' || owner === undefined || ty.type !== 'Class') continue;
    const ol = g.layer.get(owner.id) ?? null;
    if (ol === null || !p.applicationLayers.includes(ol) || (g.layer.get(ty.id) ?? null) !== p.domainLayer) continue;
    if (!(anyFull(p.entityPatterns, ty.filePath) || full(p.entityNamePattern, ty.name)) || !inScope(g, p, owner)) continue;
    rows.push({ filePath: m.filePath, member: m.name, entity: ty.name, target: ty.filePath, positions: e.properties.positions });
  }
  return rows.sort(cmp('filePath', 'member', 'entity'));
}

export function aggregateReferenceByIdentity(g: MemGraph, p: RuleGapParams): Row[] {
  const rows: Row[] = [];
  for (const a of p.aggregates) {
    for (const b of p.aggregates) {
      if (a.name === b.name) continue;
      for (const type of ['HOLDS_STATE_OF', 'CONSTRUCTOR_INJECTS']) {
        for (const e of g.edgesOf(type)) {
          const c = g.node(e.sourceId);
          const ty = g.node(e.targetId);
          if (c.type !== 'Class' || ty.type !== 'Class' || !full(a.module, c.filePath)) continue;
          if (!(full(b.root, ty.filePath) || anyFull(b.innerEntities, ty.filePath))) continue;
          const param = e.properties.parameterName;
          if (type === 'CONSTRUCTOR_INJECTS' && !strList(c.properties.fields).includes(String(param))) continue;
          if (!notTest(g, p, c)) continue;
          rows.push({ filePath: c.filePath, class: c.name, aggregate: a.name, otherAggregate: b.name, heldType: ty.name, target: ty.filePath,
            field: e.properties.field ?? param ?? null });
        }
      }
    }
  }
  return distinct(rows).sort(cmp('filePath', 'class', 'heldType', 'field'));
}

export function aggregateHoldsService(g: MemGraph, p: RuleGapParams): Row[] {
  const rows: Row[] = [];
  for (const a of p.aggregates) {
    for (const type of ['CONSTRUCTOR_INJECTS', 'HOLDS_STATE_OF']) {
      for (const e of g.edgesOf(type)) {
        const c = g.node(e.sourceId);
        const dep = g.node(e.targetId);
        if (c.type !== 'Class' || !(full(a.root, c.filePath) || anyFull(a.innerEntities, c.filePath))) continue;
        if (!(full(p.aggregateDependencyNamePattern, dep.name) || anyFull(p.repositoryPatterns, dep.filePath)) || !notTest(g, p, c)) continue;
        rows.push({ filePath: c.filePath, class: c.name, aggregate: a.name, dependency: dep.name, target: dep.filePath });
      }
    }
  }
  return distinct(rows).sort(cmp('filePath', 'class', 'dependency'));
}

export function serviceStateless(g: MemGraph, p: RuleGapParams): Row[] {
  const rows: Row[] = [];
  for (const c of g.nodes) {
    if (c.type !== 'Class') continue;
    const layer = g.layer.get(c.id) ?? null;
    if (layer === null || !(layer === p.domainLayer || p.applicationLayers.includes(layer))) continue;
    if (!(full(p.serviceNamePattern, c.name) || anyFull(p.servicePatterns, c.filePath))) continue;
    const fields = strList(c.properties.fieldsAssignedOutsideConstructor);
    if (fields.length === 0 || !inScope(g, p, c)) continue;
    rows.push({ filePath: c.filePath, class: c.name, layer, fields });
  }
  return rows.sort(cmp('filePath', 'class'));
}

export function nestProviderNotVisible(g: MemGraph, p: RuleGapParams): Row[] {
  const provides = new Map<string, Set<string>>(); // module -> provided classes
  const providedBy = new Map<string, Set<string>>(); // class -> modules
  for (const e of g.edgesOf('MODULE_PROVIDES')) {
    if (!provides.has(e.sourceId)) provides.set(e.sourceId, new Set());
    provides.get(e.sourceId)?.add(e.targetId);
    if (!providedBy.has(e.targetId)) providedBy.set(e.targetId, new Set());
    providedBy.get(e.targetId)?.add(e.sourceId);
  }
  const exportsOf = new Map<string, string[]>();
  for (const e of g.edgesOf('MODULE_EXPORTS')) exportsOf.set(e.sourceId, [...(exportsOf.get(e.sourceId) ?? []), e.targetId]);
  const importsOf = new Map<string, string[]>();
  for (const e of g.edgesOf('MODULE_IMPORTS')) importsOf.set(e.sourceId, [...(importsOf.get(e.sourceId) ?? []), e.targetId]);

  /** Modules reachable from `start` over 0..4 MODULE_EXPORTS hops (the Cypher's `*0..4`). */
  const reExported = (start: string): Set<string> => {
    const seen = new Set([start]);
    let frontier = [start];
    for (let d = 0; d < 4; d++) {
      const next: string[] = [];
      for (const n of frontier) for (const x of exportsOf.get(n) ?? []) if (!seen.has(x)) { seen.add(x); next.push(x); }
      frontier = next;
    }
    return seen;
  };
  const exportsProvided = (x: string, dep: string): boolean => (exportsOf.get(x) ?? []).includes(dep) && (provides.get(x)?.has(dep) ?? false);

  const injects = new Map<string, { dep: string; parameter: unknown }[]>();
  for (const e of g.edgesOf('CONSTRUCTOR_INJECTS')) injects.set(e.sourceId, [...(injects.get(e.sourceId) ?? []), { dep: e.targetId, parameter: e.properties.parameterName ?? null }]);

  const rows: Row[] = [];
  for (const e of g.edgesOf('MODULE_PROVIDES')) {
    const m = g.node(e.sourceId);
    const c = g.node(e.targetId);
    if (m.type !== 'Class' || c.type !== 'Class' || !notTest(g, p, c)) continue;
    for (const { dep: depId, parameter } of injects.get(c.id) ?? []) {
      const dep = g.node(depId);
      if (dep.type !== 'Class' || !providedBy.has(depId) || (provides.get(m.id)?.has(depId) ?? false)) continue;
      const visible = (importsOf.get(m.id) ?? []).some((y) => [...reExported(y)].some((x) => exportsProvided(x, depId)));
      const global = [...(providedBy.get(depId) ?? [])].some((gm) => anyFull(p.globalModulePatterns, g.node(gm).name) && exportsProvided(gm, depId));
      if (visible || global) continue;
      rows.push({ filePath: c.filePath, consumer: c.name, module: m.name, dependency: dep.name, target: dep.filePath, parameter });
    }
  }
  return distinct(rows).sort(cmp('filePath', 'consumer', 'dependency'));
}

export function nestProviderMultipleModules(g: MemGraph, p: RuleGapParams): Row[] {
  const by = new Map<string, Set<string>>();
  for (const e of g.edgesOf('MODULE_PROVIDES')) {
    if (e.properties.role !== 'provider') continue;
    const pr = g.node(e.targetId);
    if (pr.type !== 'Class' || !notTest(g, p, pr)) continue;
    if (!by.has(pr.id)) by.set(pr.id, new Set());
    by.get(pr.id)?.add(g.node(e.sourceId).name);
  }
  const rows: Row[] = [];
  for (const [id, mods] of by) {
    if (mods.size < 2) continue;
    const pr = g.node(id);
    const modules = [...mods].sort();
    rows.push({ filePath: pr.filePath, provider: pr.name, modules, moduleCount: modules.length });
  }
  return rows.sort(cmp('filePath', 'provider'));
}

export const RULE_GAP_IN_MEMORY: ReadonlyMap<string, Mirror> = new Map<string, Mirror>([
  ['use-case-framework-free', useCaseFrameworkFree],
  ['controller-bypasses-application', controllerBypassesApplication],
  ['use-case-exposes-entity', useCaseExposesEntity],
  ['aggregate-reference-by-identity', aggregateReferenceByIdentity],
  ['aggregate-holds-service', aggregateHoldsService],
  ['service-stateless', serviceStateless],
  ['nest-provider-not-visible', nestProviderNotVisible],
  ['nest-provider-multiple-modules', nestProviderMultipleModules],
]);
