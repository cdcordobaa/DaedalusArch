/**
 * Hexagonal (ports and adapters) library, v1.3. Kept apart from `cypher-templates.ts` so the frozen v1.2E
 * instrument (CYPHER_TEMPLATES, its tags, applicability table and role exemptions) is untouched: these templates
 * are reachable only through `compileHexagonalFunctions`, which `compileFunctions` calls for style `hexagonal`.
 *
 * Semantics. The layer model is a graph, not a total order: `architecture.allowed_dependencies` lists the edges
 * `from -> to` that an import may follow. Two templates read it:
 * - `dependency-direction-graph`: an import that runs against an allowed edge (the reverse edge is allowed);
 * - `layer-skip-graph`: an import between two layers with no allowed edge in either direction (a sideways step,
 *   e.g. an inbound adapter importing an outbound adapter).
 * The remaining templates bind by layer kind (domain, application, presentation = inbound adapters,
 * infrastructure = outbound adapters); the composition root is the layer nothing may import and that may import
 * every other layer (`bindHexagonalLayers`).
 */
import type { CypherTemplate, ResultMapping } from './types.js';
import type { FitnessFunction, LayerModel } from '../shared/types/spec.js';

export const HEXAGONAL_STYLE = 'hexagonal';

type TMapColumns = Omit<ResultMapping, 'filePathColumn' | 'messageTemplate' | 'metadataColumns'>;

const HEX_ONLY: readonly string[] = [HEXAGONAL_STYLE];

const DEP_EDGE: TMapColumns = {
  targetColumn: 'target', lineColumn: 'line', linesColumn: 'lines', isTypeOnlyColumn: 'isTypeOnly',
  discriminatorColumns: ['relType'],
};

const EDGE_COLUMNS = (columns: readonly string[]): string[] => [...columns, 'relType', 'line', 'lines', 'isTypeOnly'];

function edgeMapping(message: string, columns: readonly string[]): ResultMapping {
  return { filePathColumn: 'source', messageTemplate: message, ...DEP_EDGE, metadataColumns: EDGE_COLUMNS(columns) };
}

function hex(
  functionName: string,
  template: string,
  requiredParams: string[],
  requiredLayerKinds: CypherTemplate['requiredLayerKinds'],
  tag: CypherTemplate['tag'],
  description: string,
  resultMapping: ResultMapping,
): CypherTemplate {
  return {
    functionName, template, requiredParams, requiredLayerKinds, tag, optionalParams: [], description, resultMapping,
    applicableStyles: HEX_ONLY,
  };
}

const EDGE_RETURN = `RETURN src.filePath AS source, tgt.filePath AS target, src.layer AS srcLayer, tgt.layer AS tgtLayer,
       type(i) AS relType,
       CASE type(i) WHEN 'IMPORTS' THEN 'imports' ELSE 're-exports' END AS verb,
       i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly
ORDER BY source, target, relType`;

export const HEXAGONAL_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([
  ['dependency-direction-graph', hex(
    'dependency-direction-graph',
    `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
  AND NOT (src.layer + '>' + tgt.layer) IN $allowedDependencies
  AND (tgt.layer + '>' + src.layer) IN $allowedDependencies /*EXCLUDE:src*/
${EDGE_RETURN}`,
    ['allowedDependencies'], [], 'structural',
    'Detects imports that run against an allowed dependency edge (the reverse import is allowed, this one is not)',
    edgeMapping('{source} ({srcLayer}) {verb} against the allowed direction from {target} ({tgtLayer})', ['target', 'srcLayer', 'tgtLayer']),
  )],

  ['layer-skip-graph', hex(
    'layer-skip-graph',
    `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
  AND NOT (src.layer + '>' + tgt.layer) IN $allowedDependencies
  AND NOT (tgt.layer + '>' + src.layer) IN $allowedDependencies /*EXCLUDE:src*/
${EDGE_RETURN}`,
    ['allowedDependencies'], [], 'structural',
    'Detects imports between two layers that have no allowed dependency edge in either direction (sideways step, e.g. adapter to adapter)',
    edgeMapping('{source} ({srcLayer}) {verb} {target} ({tgtLayer}) sideways, with no allowed dependency between the layers', ['target', 'srcLayer', 'tgtLayer']),
  )],

  ['core-isolation', hex(
    'core-isolation',
    `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)
WHERE src.layer = $domainLayer AND tgt.layer IS NOT NULL AND tgt.layer <> $domainLayer /*EXCLUDE:src*/
RETURN src.filePath AS source, tgt.filePath AS target, tgt.layer AS violatingLayer,
       type(i) AS relType,
       CASE type(i) WHEN 'IMPORTS' THEN 'imports' ELSE 're-exports' END AS verb,
       i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly
ORDER BY source, target, relType`,
    ['domainLayer'], ['domain'], 'structural',
    'Detects core (domain) files that import from any other layer',
    edgeMapping('Core file {source} {verb} from {target} in {violatingLayer}', ['target', 'violatingLayer']),
  )],

  ['port-adapter-pattern', hex(
    'port-adapter-pattern',
    // The hexagonal repository pattern: the port interface lives in the core or application layer, its
    // implementation in an outbound adapter. Violating branch only, like `repository-pattern`.
    `MATCH (c:Class)
WHERE c.layer = $infraLayer
  AND ANY(role IN $adapterRoles WHERE c.name CONTAINS role)
  AND NOT EXISTS { MATCH (c)-[:IMPLEMENTS]->(p:Interface) WHERE p.layer IN $portLayers } /*EXCLUDE:c*/
RETURN c.name AS implementation, c.filePath AS filePath
ORDER BY filePath, implementation`,
    ['infraLayer', 'portLayers', 'adapterRoles'], ['infrastructure', 'domain'], 'pattern-proxy',
    'Verifies that outbound adapters (repositories, gateways) implement a port interface declared in the core or application layer',
    { filePathColumn: 'filePath', messageTemplate: 'Violation in {filePath}', discriminatorColumns: ['implementation'] },
  )],

  ['port-dependency-inversion', hex(
    'port-dependency-inversion',
    // Same measure as `dependency-inversion` (ratio of injected interfaces), over the use-case layers only, so the
    // composition root (which wires concrete adapters by design) is outside the count.
    `MATCH (c:Class)-[:CONSTRUCTOR_INJECTS]->(dep)
WHERE c.layer IN $applicationLayers
WITH c, count(CASE WHEN dep:Interface THEN 1 END) AS interfaceDeps, count(dep) AS totalDeps
WHERE totalDeps > 0 /*EXCLUDE:c*/
WITH c, toFloat(interfaceDeps) / totalDeps AS ratio
WHERE ratio < $threshold
RETURN c.name AS class, c.filePath AS filePath, ratio
ORDER BY filePath, class`,
    ['applicationLayers', 'threshold'], ['application'], 'pattern-proxy',
    'Checks that application-layer classes depend on ports (interfaces), not concrete adapters; violating rows only',
    { filePathColumn: 'filePath', messageTemplate: 'Violation in {filePath}', discriminatorColumns: ['class'], evidenceColumns: ['ratio'] },
  )],
]);

// ── Layer binding and validation ──────────────────────────────────────────────

export interface HexagonalBinding {
  readonly domainLayer: string;
  readonly applicationLayers: readonly string[];
  readonly inboundLayer: string;
  readonly outboundLayer: string;
  readonly compositionRoots: readonly string[];
  readonly portLayers: readonly string[];
  readonly allowedDependencies: readonly string[]; // 'from>to'
}

export type HexagonalBindResult =
  | { readonly ok: true; readonly binding: HexagonalBinding }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Bind the hexagonal roles (domain, application, inbound = presentation, outbound = infrastructure) by layer kind
 * and read the allowed-dependency graph. A composition root is a layer that no allowed edge points to and that
 * has an allowed edge to every other layer; it is taken out of the application layers.
 */
export function bindHexagonalLayers(layerModel: LayerModel): HexagonalBindResult {
  const errors: string[] = [];
  const layers = layerModel.layers;
  const names = new Set(layers.map((l) => l.name));
  const edges = layerModel.allowedDependencies;

  if (edges === undefined || edges.length === 0) {
    errors.push('hexagonal style requires architecture.allowed_dependencies');
  } else {
    for (const e of edges) {
      for (const end of [e.from, e.to]) {
        if (!names.has(end)) errors.push(`allowed_dependencies names unknown layer "${end}"`);
      }
      if (e.from === e.to) errors.push(`allowed_dependencies has a self edge on "${e.from}"`);
    }
  }

  const first = (kind: string): string | undefined => layers.find((l) => l.kind === kind)?.name;
  const domainLayer = first('domain');
  const inboundLayer = first('presentation');
  const outboundLayer = first('infrastructure');
  if (domainLayer === undefined) errors.push('hexagonal style requires a domain layer (kind: domain)');
  if (inboundLayer === undefined) errors.push('hexagonal style requires an inbound adapter layer (kind: presentation)');
  if (outboundLayer === undefined) errors.push('hexagonal style requires an outbound adapter layer (kind: infrastructure)');

  const allowed = (edges ?? []).map((e) => `${e.from}>${e.to}`);
  const targets = new Set((edges ?? []).map((e) => e.to));
  const compositionRoots = layers
    .filter((l) => !targets.has(l.name) && layers.every((o) => o.name === l.name || allowed.includes(`${l.name}>${o.name}`)))
    .map((l) => l.name);
  const applicationLayers = layers.filter((l) => l.kind === 'application' && !compositionRoots.includes(l.name)).map((l) => l.name);
  if (applicationLayers.length === 0) errors.push('hexagonal style requires an application layer (kind: application)');

  if (errors.length > 0 || domainLayer === undefined || inboundLayer === undefined || outboundLayer === undefined) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    binding: {
      domainLayer, applicationLayers, inboundLayer, outboundLayer, compositionRoots,
      portLayers: [domainLayer, ...applicationLayers],
      allowedDependencies: allowed,
    },
  };
}

/** Parameters of one hexagonal template, restricted to its declared `requiredParams` (as `buildParams` does). */
export function buildHexagonalParams(ff: FitnessFunction, binding: HexagonalBinding): Record<string, unknown> {
  const candidates: Record<string, unknown> = {
    allowedDependencies: [...binding.allowedDependencies],
    domainLayer: binding.domainLayer,
    infraLayer: binding.outboundLayer,
    applicationLayers: [...binding.applicationLayers],
    portLayers: [...binding.portLayers],
    adapterRoles: ['Repository', 'Repo', 'Adapter', 'Gateway'],
  };
  if (ff.threshold != null) candidates.threshold = ff.threshold;
  const template = HEXAGONAL_TEMPLATES.get(ff.name);
  const params: Record<string, unknown> = {};
  if (!template) return params;
  for (const name of [...template.requiredParams, ...template.optionalParams]) {
    const value = candidates[name];
    if (value != null) params[name] = value;
  }
  return params;
}
