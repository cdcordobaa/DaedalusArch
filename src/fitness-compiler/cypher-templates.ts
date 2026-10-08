import type { LayerKind, TemplateTag } from '../shared/types/enums.js';
import type { CypherTemplate, ResultMapping } from './types.js';

function rm(filePathColumn: string, messageTemplate: string, metadataColumns?: string[]): ResultMapping {
  const base = { filePathColumn, messageTemplate, discriminatorColumns: [] };
  return metadataColumns ? { ...base, metadataColumns } : base;
}

/** T-MAP columns of one template (U3 business-rules.md §3, BR-U3-04, BR-U3-06; frozen with U3-R2). */
type TMapColumns = Omit<ResultMapping, 'filePathColumn' | 'messageTemplate' | 'metadataColumns'>;

/** A result mapping with its T-MAP location, discriminator and evidence columns (FR-12). */
function mapped(
  filePathColumn: string,
  messageTemplate: string,
  columns: TMapColumns,
  metadataColumns?: string[],
): ResultMapping {
  return {
    filePathColumn, messageTemplate, ...columns,
    ...(metadataColumns !== undefined ? { metadataColumns } : {}),
  };
}

/** Default message with the T-MAP columns of a template that keeps `Violation in {filePath}`. */
function defaultMapped(columns: TMapColumns): ResultMapping {
  return mapped('filePath', 'Violation in {filePath}', columns);
}

/** T-MAP edge columns of the dependency templates (BR-U3-04): target, line, lines, isTypeOnly; disc relType. */
const DEP_EDGE: TMapColumns = {
  targetColumn: 'target', lineColumn: 'line', linesColumn: 'lines', isTypeOnlyColumn: 'isTypeOnly',
  discriminatorColumns: ['relType'],
};

/** Longest import cycle the cycle query detects (BR-U1-28, frozen; BR-U1-02). Never a Cypher parameter. */
export const MAX_CYCLE_LENGTH = 10;

/** Cycle rows reported before truncation; the query returns one more row as the sentinel (BR-U1-28). */
export const CYCLE_ROW_CAP = 100;

/** FR-12 edge columns of the three dependency templates (BR-U1-35); mapped by `DEP_EDGE` from U3-R2 (BR-U3-04). */
const FR12_DEP_COLUMNS = (columns: readonly string[]): string[] => [...columns, 'relType', 'line', 'lines', 'isTypeOnly'];

const DEFAULT_RM: ResultMapping = { filePathColumn: 'filePath', messageTemplate: 'Violation in {filePath}', discriminatorColumns: [] };

/** Styles of the seven Clean-Architecture-only templates (business-rules.md §3.1, frozen; BR-U1-18). */
const CLEAN_AND_NESTJS: readonly string[] = ['clean-architecture', 'nestjs'];

function tmpl(
  functionName: string,
  template: string,
  requiredParams: string[],
  requiredLayerKinds: LayerKind[],
  tag: TemplateTag, // business-rules.md §4.1 (frozen; FR-29, BR-U1-27)
  description: string,
  optionalParams: string[] = [],
  resultMapping: ResultMapping = DEFAULT_RM,
  applicableStyles?: readonly string[], // undefined = every style (FR-20, AD-8)
): CypherTemplate {
  return {
    functionName, template, requiredParams, requiredLayerKinds, tag, optionalParams, description, resultMapping,
    ...(applicableStyles !== undefined ? { applicableStyles } : {}),
  };
}

/**
 * Hardcoded Cypher templates for 24 symbolic fitness functions.
 * Each template uses $paramName placeholders for instantiation, and an exclude anchor
 * `/*EXCLUDE:<alias>*\/` or `/*EXCLUDE:nodes(<path>)*\/` where `exclude_paths` applies (BR-U1-32, BR-U1-44);
 * `abstraction-ratio` has none.
 */
export const CYPHER_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([

  // ── STRUCTURAL ──────────────────────────────────────────────────────────────

  ['dependency-direction', tmpl(
    'dependency-direction',
    `WITH $layerOrder AS layerOrder
MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
WITH src, tgt, i,
     apoc.coll.indexOf(layerOrder, src.layer) AS srcIdx,
     apoc.coll.indexOf(layerOrder, tgt.layer) AS tgtIdx
WHERE srcIdx >= 0 AND tgtIdx >= 0 AND srcIdx < tgtIdx /*EXCLUDE:src*/
RETURN src.filePath AS source, tgt.filePath AS target, src.layer AS srcLayer, tgt.layer AS tgtLayer,
       type(i) AS relType,
       CASE type(i) WHEN 'IMPORTS' THEN 'imports' ELSE 're-exports' END AS verb,
       i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly
ORDER BY source, target, relType`,
    ['layerOrder'],
    [],
    'structural',
    'Detects imports where a lower layer imports from a higher layer (violates dependency direction)',
    [],
    mapped('source', '{source} ({srcLayer}) {verb} from {target} ({tgtLayer})', DEP_EDGE, FR12_DEP_COLUMNS(['target', 'srcLayer', 'tgtLayer'])),
  )],

  ['no-cyclic-deps', tmpl(
    'no-cyclic-deps',
    // Bounded, canonical, simple cycles (FR-35, NFR-07, BR-U1-28): the bound and the sentinel cap are
    // literals interpolated at module load (Neo4j rejects a parameter in a variable-length bound).
    `MATCH p = (f:File)-[:IMPORTS|RE_EXPORTS*2..${String(MAX_CYCLE_LENGTH)}]->(f)
WHERE ALL(n IN nodes(p) WHERE n.filePath >= f.filePath)
  AND size(apoc.coll.toSet(nodes(p)[1..])) = length(p) /*EXCLUDE:nodes(p)*/
WITH DISTINCT [n IN nodes(p) | n.filePath] AS cycle, relationships(p)[0].line AS firstLine
WITH cycle, min(firstLine) AS line
RETURN cycle, cycle[1] AS target, line
ORDER BY cycle
LIMIT ${String(CYCLE_ROW_CAP + 1)}`,
    [],
    [],
    'topological',
    `Detects simple circular import/re-export chains of length 2..${String(MAX_CYCLE_LENGTH)} (one row per cycle with its first-edge target and line, FR-12; row ${String(CYCLE_ROW_CAP + 1)} is a truncation sentinel)`,
    [],
    mapped('cycle', 'Circular dependency: {cycle}', {
      targetColumn: 'target', lineColumn: 'line', discriminatorColumns: ['cycle'], cycleColumn: 'cycle',
    }),
  )],

  ['no-layer-skip', tmpl(
    'no-layer-skip',
    `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
  AND NOT (src.layer + '>' + tgt.layer) IN $allowedTransitions /*EXCLUDE:src*/
RETURN src.filePath AS source, tgt.filePath AS target, src.layer AS srcLayer, tgt.layer AS tgtLayer,
       type(i) AS relType,
       CASE type(i) WHEN 'IMPORTS' THEN 'import' ELSE 're-export' END AS verb,
       i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly
ORDER BY source, target, relType`,
    ['allowedTransitions'],
    [],
    'structural',
    'Detects imports that skip intermediate layers (e.g., infrastructure directly importing domain, bypassing application)',
    [],
    mapped('source', '{source} ({srcLayer}) skips layers to {verb} {target} ({tgtLayer})', DEP_EDGE, FR12_DEP_COLUMNS(['target', 'srcLayer', 'tgtLayer'])),
    ['layered'], // closed layering (BR-U1-43, U1 Q22 B)
  )],

  ['no-domain-outward-dep', tmpl(
    'no-domain-outward-dep',
    `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)
WHERE src.layer = $domainLayer AND tgt.layer <> $domainLayer /*EXCLUDE:src*/
RETURN src.filePath AS source, tgt.filePath AS target, tgt.layer AS violatingLayer,
       type(i) AS relType,
       CASE type(i) WHEN 'IMPORTS' THEN 'imports' ELSE 're-exports' END AS verb,
       i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly
ORDER BY source, target, relType`,
    ['domainLayer'],
    ['domain'],
    'structural',
    'Detects domain layer files that import from outer layers',
    [],
    mapped('source', 'Domain file {source} {verb} from {target} in {violatingLayer}', DEP_EDGE, FR12_DEP_COLUMNS(['target', 'violatingLayer'])),
    CLEAN_AND_NESTJS,
  )],

  // ── PATTERN ─────────────────────────────────────────────────────────────────

  ['domain-purity', tmpl(
    'domain-purity',
    `MATCH (src:File)-[:IMPORTS]->(tgt:File)
WHERE src.layer = $domainLayer
  AND ANY(forbidden IN $forbiddenImports WHERE tgt.filePath CONTAINS forbidden) /*EXCLUDE:src*/
RETURN src.filePath AS source, tgt.filePath AS target
ORDER BY source, target`,
    ['domainLayer', 'forbiddenImports'],
    ['domain'],
    'pattern-proxy',
    'Detects domain files importing forbidden framework/infrastructure packages',
    [],
    rm('source', 'Domain file {source} imports forbidden package {target}', ['target']),
  )],

  ['dependency-inversion', tmpl(
    'dependency-inversion',
    `MATCH (c:Class)-[:CONSTRUCTOR_INJECTS]->(dep)
WHERE c.layer IN $applicationLayers
WITH c, count(CASE WHEN dep:Interface THEN 1 END) AS interfaceDeps, count(dep) AS totalDeps
WHERE totalDeps > 0 /*EXCLUDE:c*/
RETURN c.name AS class, c.filePath AS filePath,
       toFloat(interfaceDeps) / totalDeps AS ratio,
       CASE WHEN toFloat(interfaceDeps) / totalDeps < $threshold THEN true ELSE false END AS violation
ORDER BY filePath, class`,
    ['applicationLayers', 'threshold'],
    ['application'],
    'pattern-proxy',
    'Checks that application-layer classes inject interfaces, not concrete classes (DIP)',
    [],
    DEFAULT_RM,
    CLEAN_AND_NESTJS,
  )],

  ['repository-pattern', tmpl(
    'repository-pattern',
    // Violating branch only (ADR-015 item 1, BR-U1-45): the compliant UNION branch was dropped.
    `MATCH (c:Class)
WHERE c.layer = $infraLayer
  AND (c.name CONTAINS 'Repository' OR c.name CONTAINS 'Repo')
  AND NOT EXISTS { MATCH (c)-[:IMPLEMENTS]->(:Interface) } /*EXCLUDE:c*/
RETURN '' AS interface, c.name AS implementation, c.filePath AS filePath
ORDER BY filePath, implementation`,
    ['domainLayer', 'infraLayer'],
    ['domain', 'infrastructure'],
    'pattern-proxy',
    'Verifies infrastructure repositories implement domain interfaces',
    [],
    defaultMapped({ discriminatorColumns: ['implementation'] }),
    CLEAN_AND_NESTJS,
  )],

  ['use-case-isolation', tmpl(
    'use-case-isolation',
    `MATCH (uc:Class)
WHERE uc.layer IN $applicationLayers
  AND ANY(role IN $useCaseRoles WHERE uc.name CONTAINS role)
WITH uc
MATCH (uc)-[:CONSTRUCTOR_INJECTS]->(dep)
WHERE dep.layer IS NOT NULL AND dep.layer <> $domainLayer AND NOT dep.layer IN $applicationLayers /*EXCLUDE:uc*/
WITH uc, apoc.coll.sort(collect(dep.name)) AS violations
RETURN uc.name AS useCase, uc.filePath AS filePath, violations
ORDER BY filePath, useCase`,
    ['applicationLayers', 'domainLayer', 'useCaseRoles'],
    ['application', 'domain'],
    'pattern-proxy',
    'Verifies use cases only depend on domain and application layers',
    ['useCaseRoles'],
    defaultMapped({ discriminatorColumns: ['useCase'] }),
    CLEAN_AND_NESTJS,
  )],

  ['controller-no-entity', tmpl(
    'controller-no-entity',
    `MATCH (ctrl:Class)-[:IMPORTS|CONSTRUCTOR_INJECTS*1..2]->(entity:Class)
WHERE ctrl.layer = $controllerLayer AND entity.layer = $domainLayer
  AND ANY(role IN $entityRoles WHERE entity.name CONTAINS role) /*EXCLUDE:ctrl*/
RETURN ctrl.name AS controller, entity.name AS entity, ctrl.filePath AS filePath
ORDER BY filePath, controller, entity`,
    ['controllerLayer', 'domainLayer', 'entityRoles'], // controllerLayer replaces infraLayer (ADR-016 a, BR-U1-46)
    ['infrastructure', 'domain'],
    'pattern-proxy',
    'Detects controllers directly referencing domain entities',
    ['entityRoles'],
    defaultMapped({ discriminatorColumns: ['controller', 'entity'] }),
    CLEAN_AND_NESTJS,
  )],

  // ── COUPLING ────────────────────────────────────────────────────────────────

  ['domain-stability', tmpl(
    'domain-stability',
    `MATCH (f:File)
WHERE f.layer = $domainLayer
OPTIONAL MATCH (f)<-[:IMPORTS]-(incoming:File) WHERE incoming.layer <> $domainLayer
OPTIONAL MATCH (f)-[:IMPORTS]->(outgoing:File) WHERE outgoing.layer <> $domainLayer
WITH f, count(DISTINCT incoming) AS fanIn, count(DISTINCT outgoing) AS fanOut
WHERE fanIn + fanOut > 0 /*EXCLUDE:f*/
RETURN f.filePath AS filePath, f.name AS name,
       toFloat(fanOut) / (fanIn + fanOut) AS instability,
       CASE WHEN toFloat(fanOut) / (fanIn + fanOut) > $threshold THEN true ELSE false END AS violation
ORDER BY filePath`,
    ['domainLayer', 'threshold'],
    ['domain'],
    'topological',
    'Domain layer instability must be below threshold (lower = more stable)',
    [],
    DEFAULT_RM,
    CLEAN_AND_NESTJS,
  )],

  ['module-fan-out', tmpl(
    'module-fan-out',
    `MATCH (f:File)-[:IMPORTS]->(dep:File)
WITH f, count(DISTINCT dep) AS fanOut
WHERE fanOut > $threshold /*EXCLUDE:f*/
RETURN f.filePath AS filePath, f.name AS name, fanOut
ORDER BY filePath`,
    ['threshold'],
    [],
    'topological',
    'Detects files with excessive outgoing dependencies',
    [],
    defaultMapped({ discriminatorColumns: [], evidenceColumns: ['fanOut'] }),
  )],

  ['component-instability', tmpl(
    'component-instability',
    `MATCH (f:File)
WHERE f.layer IS NOT NULL
OPTIONAL MATCH (f)<-[:IMPORTS]-(incoming:File)
OPTIONAL MATCH (f)-[:IMPORTS]->(outgoing:File)
WITH f, count(DISTINCT incoming) AS fanIn, count(DISTINCT outgoing) AS fanOut
WHERE fanIn + fanOut > 0
WITH f, fanIn, fanOut, toFloat(fanOut) / (fanIn + fanOut) AS instability
WHERE instability > $threshold /*EXCLUDE:f*/
RETURN f.filePath AS filePath, f.layer AS layer, f.name AS name, instability
ORDER BY filePath`,
    ['threshold'],
    [],
    'topological',
    'Flags files whose instability metric exceeds the threshold (fanOut / (fanIn + fanOut))',
    [],
    defaultMapped({ discriminatorColumns: [], evidenceColumns: ['instability'] }),
  )],

  ['no-orphan-files', tmpl(
    'no-orphan-files',
    `MATCH (f:File)
WHERE f.layer IS NOT NULL
  AND NOT EXISTS { MATCH (f)-[:IMPORTS|RE_EXPORTS]->(:File) }
  AND NOT EXISTS { MATCH (:File)-[:IMPORTS|RE_EXPORTS]->(f) }
  AND NOT f.isBarrel /*EXCLUDE:f*/
RETURN f.filePath AS filePath, f.name AS name, f.layer AS layer
ORDER BY filePath`,
    [],
    [],
    'topological',
    'Detects files with no import or re-export connection to another file (Package targets do not count; barrels excluded)',
    [],
    defaultMapped({ discriminatorColumns: [] }),
  )],

  ['max-fan-in', tmpl(
    'max-fan-in',
    `MATCH (f:File)<-[:IMPORTS]-(incoming:File)
WITH f, count(DISTINCT incoming) AS fanIn
WHERE fanIn > $threshold /*EXCLUDE:f*/
RETURN f.filePath AS filePath, f.name AS name, fanIn
ORDER BY filePath`,
    ['threshold'],
    [],
    'topological',
    'Detects files with excessive incoming dependencies (god modules)',
    [],
    defaultMapped({ discriminatorColumns: [], evidenceColumns: ['fanIn'] }),
  )],

  ['abstraction-ratio', tmpl(
    'abstraction-ratio',
    `MATCH (n) WHERE n:Class OR n:Interface
WITH count(CASE WHEN n:Interface THEN 1 END) AS interfaces,
     count(n) AS total
WHERE total > 0
RETURN toFloat(interfaces) / total AS ratio,
       CASE WHEN toFloat(interfaces) / total < $threshold THEN true ELSE false END AS violation
ORDER BY ratio`,
    ['threshold'],
    [],
    'topological',
    'Checks ratio of interfaces to total classes+interfaces',
    [],
    rm('ratio', 'Abstraction ratio {ratio} below threshold', ['violation']),
  )],

  // ── SOLID ───────────────────────────────────────────────────────────────────

  ['single-responsibility-proxy', tmpl(
    'single-responsibility-proxy',
    `MATCH (c:Class)
OPTIONAL MATCH (c)-[:CONTAINS]->(m:Method)
OPTIONAL MATCH (c)-[:CONSTRUCTOR_INJECTS]->(dep)
WITH c, count(DISTINCT m) AS methodCount, count(DISTINCT dep) AS depCount
WHERE (methodCount > $maxPublicMethods OR depCount > $maxDependencies) /*EXCLUDE:c*/
RETURN c.name AS class, c.filePath AS filePath, methodCount, depCount
ORDER BY filePath, class`,
    ['maxPublicMethods', 'maxDependencies'],
    [],
    'pattern-proxy',
    'SRP proxy: classes with too many methods or dependencies likely have multiple responsibilities',
    [],
    defaultMapped({ discriminatorColumns: ['class'], evidenceColumns: ['methodCount', 'depCount'] }),
  )],

  ['interface-segregation-proxy', tmpl(
    'interface-segregation-proxy',
    `MATCH (i:Interface)-[:CONTAINS]->(m:Method)
WITH i, count(m) AS methodCount
WHERE methodCount > $maxInterfaceMethods /*EXCLUDE:i*/
RETURN i.name AS interface, i.filePath AS filePath, methodCount
ORDER BY filePath, interface`,
    ['maxInterfaceMethods'],
    [],
    'pattern-proxy',
    'ISP proxy: interfaces with too many methods should be split',
    [],
    defaultMapped({ discriminatorColumns: ['interface'], evidenceColumns: ['methodCount'] }),
  )],

  ['inheritance-depth', tmpl(
    'inheritance-depth',
    `MATCH path = (c:Class)-[:EXTENDS*]->(base:Class)
WITH c, length(path) AS depth
WHERE depth > $maxDepth /*EXCLUDE:c*/
RETURN c.name AS class, c.filePath AS filePath, depth
ORDER BY filePath, class, depth`,
    ['maxDepth'],
    [],
    'topological',
    'Detects deep inheritance hierarchies',
    [],
    defaultMapped({ discriminatorColumns: ['class'], evidenceColumns: ['depth'] }),
  )],

  // ── CONVENTION ──────────────────────────────────────────────────────────────

  ['naming-conventions', tmpl(
    'naming-conventions',
    `MATCH (c:Class)
WHERE c.layer IS NOT NULL
WITH c, c.layer AS layer,
     CASE
       WHEN c.layer = $domainLayer THEN $domainPattern
       WHEN c.layer IN $applicationLayers THEN $applicationPattern
       WHEN c.layer = $infraLayer THEN $infraPattern
       ELSE '.*'
     END AS expectedPattern
WHERE NOT c.name =~ expectedPattern /*EXCLUDE:c*/
RETURN c.name AS class, c.filePath AS filePath, layer, expectedPattern
ORDER BY filePath, class`,
    ['domainLayer', 'applicationLayers', 'infraLayer', 'domainPattern', 'applicationPattern', 'infraPattern'],
    ['domain', 'application', 'infrastructure'],
    'pattern-proxy',
    'Checks class naming conventions per layer',
    [],
    defaultMapped({ discriminatorColumns: ['class'] }),
  )],

  ['naming-services', tmpl(
    'naming-services',
    `MATCH (c:Class)
WHERE c.layer IN $applicationLayers
  AND ANY(role IN ['Service', 'UseCase'] WHERE c.name CONTAINS role)
  AND NOT c.name =~ $pattern /*EXCLUDE:c*/
RETURN c.name AS class, c.filePath AS filePath
ORDER BY filePath, class`,
    ['applicationLayers', 'pattern'],
    ['application'],
    'pattern-proxy',
    'Verifies service classes follow naming pattern',
    [],
    defaultMapped({ discriminatorColumns: ['class'] }),
  )],

  ['naming-repos', tmpl(
    'naming-repos',
    `MATCH (c:Class)
WHERE (c.name CONTAINS 'Repository' OR c.name CONTAINS 'Repo')
  AND NOT c.name =~ $pattern /*EXCLUDE:c*/
RETURN c.name AS class, c.filePath AS filePath
ORDER BY filePath, class`,
    ['pattern'],
    [],
    'pattern-proxy',
    'Verifies repository classes follow naming pattern',
    [],
    defaultMapped({ discriminatorColumns: ['class'] }),
  )],

  ['naming-controllers', tmpl(
    'naming-controllers',
    `MATCH (c:Class)
WHERE c.layer = $controllerLayer
  AND ANY(dec IN c.decorators WHERE dec CONTAINS 'Controller')
  AND NOT c.name =~ $pattern /*EXCLUDE:c*/
RETURN c.name AS class, c.filePath AS filePath
ORDER BY filePath, class`,
    ['controllerLayer', 'pattern'], // controllerLayer replaces infraLayer (ADR-016 a, BR-U1-46)
    ['infrastructure'],
    'pattern-proxy',
    'Verifies controller classes follow naming pattern',
    [],
    defaultMapped({ discriminatorColumns: ['class'] }),
    CLEAN_AND_NESTJS,
  )],

  ['test-file-pairing', tmpl(
    'test-file-pairing',
    `MATCH (src:File)
WHERE src.layer IS NOT NULL
  AND NOT src.isBarrel
  AND NOT src.filePath CONTAINS '.spec.'
  AND NOT src.filePath CONTAINS '.test.'
  AND NOT EXISTS {
    MATCH (test:File)
    WHERE test.filePath = replace(src.filePath, '.ts', '.spec.ts')
       OR test.filePath = replace(src.filePath, '.ts', '.test.ts')
  } /*EXCLUDE:src*/
RETURN src.filePath AS filePath, src.name AS name
ORDER BY filePath`,
    [],
    [],
    'pattern-proxy',
    'Detects source files without corresponding test files',
    [],
    defaultMapped({ discriminatorColumns: [] }),
  )],

  ['no-index-logic', tmpl(
    'no-index-logic',
    `MATCH (f:File)
WHERE f.isBarrel = true
MATCH (f)-[:DECLARES]->(decl)
WHERE NOT decl:Function OR decl.name IS NOT NULL
WITH f, count(decl) AS declCount
WHERE declCount > 0 /*EXCLUDE:f*/
RETURN f.filePath AS filePath, declCount
ORDER BY filePath`,
    [],
    [],
    'pattern-proxy',
    'Detects barrel/index files that contain business logic declarations',
    [],
    defaultMapped({ discriminatorColumns: [], evidenceColumns: ['declCount'] }),
  )],
]);

/** The template's tag (FR-29, BR-U1-27); undefined for a name without a template. */
export function getTemplateTag(functionName: string): TemplateTag | undefined {
  return CYPHER_TEMPLATES.get(functionName)?.tag;
}

/** Names of the templates carrying `tag`, in CYPHER_TEMPLATES insertion order (FR-29, BR-U1-27). */
export function listTemplatesByTag(tag: TemplateTag): readonly string[] {
  return [...CYPHER_TEMPLATES.values()].filter((t) => t.tag === tag).map((t) => t.functionName);
}

/**
 * Discriminator columns per template (FR-12, BR-U3-06, BR-U3-66): the `disc` column of T-MAP
 * (U3 business-rules.md §3), read from each template's `resultMapping.discriminatorColumns`, in
 * declaration order. The binding contract for U5a's location rule.
 */
export const TEMPLATE_DISCRIMINATORS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    [...CYPHER_TEMPLATES.entries()].map(([name, t]) => [name, Object.freeze([...t.resultMapping.discriminatorColumns])]),
  ),
);
