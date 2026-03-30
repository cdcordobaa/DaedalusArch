import type { CypherTemplate } from './types.js';

function tmpl(
  functionName: string,
  template: string,
  requiredParams: string[],
  description: string,
  optionalParams: string[] = [],
): CypherTemplate {
  return { functionName, template, requiredParams, optionalParams, description };
}

/**
 * Hardcoded Cypher templates for 24 symbolic fitness functions.
 * Each template uses $paramName placeholders for instantiation.
 */
export const CYPHER_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([

  // ── STRUCTURAL ──────────────────────────────────────────────────────────────

  ['dependency-direction', tmpl(
    'dependency-direction',
    `MATCH (src:File)-[:IMPORTS]->(tgt:File)
WHERE src.layer IN $outerLayers AND tgt.layer IN $innerLayers
RETURN src.filePath AS source, tgt.filePath AS target, src.layer AS srcLayer, tgt.layer AS tgtLayer`,
    ['outerLayers', 'innerLayers'],
    'Detects imports that violate dependency direction (outer layer importing inner layer resources should be allowed; inner importing outer is a violation)',
  )],

  ['no-cyclic-deps', tmpl(
    'no-cyclic-deps',
    `MATCH path = (f:File)-[:IMPORTS*2..]->(f)
RETURN [n IN nodes(path) | n.filePath] AS cycle
LIMIT 100`,
    [],
    'Detects circular import chains of length 2+',
  )],

  ['no-layer-skip', tmpl(
    'no-layer-skip',
    `MATCH (src:File)-[:IMPORTS]->(tgt:File)
WHERE src.layer IS NOT NULL AND tgt.layer IS NOT NULL
  AND src.layer <> tgt.layer
  AND NOT (src.layer + '>' + tgt.layer) IN $allowedTransitions
RETURN src.filePath AS source, tgt.filePath AS target, src.layer AS srcLayer, tgt.layer AS tgtLayer`,
    ['allowedTransitions'],
    'Detects imports that skip intermediate layers (e.g., infrastructure directly importing domain, bypassing application)',
  )],

  ['no-domain-outward-dep', tmpl(
    'no-domain-outward-dep',
    `MATCH (src:File)-[:IMPORTS]->(tgt:File)
WHERE src.layer = $domainLayer AND tgt.layer <> $domainLayer
RETURN src.filePath AS source, tgt.filePath AS target, tgt.layer AS violatingLayer`,
    ['domainLayer'],
    'Detects domain layer files that import from outer layers',
  )],

  // ── PATTERN ─────────────────────────────────────────────────────────────────

  ['domain-purity', tmpl(
    'domain-purity',
    `MATCH (src:File)-[:IMPORTS]->(tgt:File)
WHERE src.layer = $domainLayer
  AND ANY(forbidden IN $forbiddenImports WHERE tgt.filePath CONTAINS forbidden)
RETURN src.filePath AS source, tgt.filePath AS target`,
    ['domainLayer', 'forbiddenImports'],
    'Detects domain files importing forbidden framework/infrastructure packages',
  )],

  ['dependency-inversion', tmpl(
    'dependency-inversion',
    `MATCH (c:Class)-[:CONSTRUCTOR_INJECTS]->(dep)
WHERE c.layer = $applicationLayer
WITH c, count(CASE WHEN dep:Interface THEN 1 END) AS interfaceDeps, count(dep) AS totalDeps
WHERE totalDeps > 0
RETURN c.name AS class, c.filePath AS filePath,
       toFloat(interfaceDeps) / totalDeps AS ratio,
       CASE WHEN toFloat(interfaceDeps) / totalDeps < $threshold THEN true ELSE false END AS violation`,
    ['applicationLayer', 'threshold'],
    'Checks that application-layer classes inject interfaces, not concrete classes (DIP)',
  )],

  ['repository-pattern', tmpl(
    'repository-pattern',
    `MATCH (c:Class)-[:IMPLEMENTS]->(i:Interface)
WHERE i.layer = $domainLayer AND c.layer = $infraLayer
  AND (i.name CONTAINS 'Repository' OR i.name CONTAINS 'Repo')
RETURN i.name AS interface, c.name AS implementation, c.filePath AS filePath
UNION
MATCH (c:Class)
WHERE c.layer = $infraLayer
  AND (c.name CONTAINS 'Repository' OR c.name CONTAINS 'Repo')
  AND NOT EXISTS { MATCH (c)-[:IMPLEMENTS]->(:Interface) }
RETURN '' AS interface, c.name AS implementation, c.filePath AS filePath`,
    ['domainLayer', 'infraLayer'],
    'Verifies infrastructure repositories implement domain interfaces',
  )],

  ['use-case-isolation', tmpl(
    'use-case-isolation',
    `MATCH (uc:Class)
WHERE uc.layer = $applicationLayer
  AND ANY(role IN $useCaseRoles WHERE uc.name CONTAINS role)
WITH uc
MATCH (uc)-[:CONSTRUCTOR_INJECTS]->(dep)
WHERE dep.layer IS NOT NULL AND dep.layer <> $domainLayer AND dep.layer <> $applicationLayer
RETURN uc.name AS useCase, uc.filePath AS filePath, collect(dep.name) AS violations`,
    ['applicationLayer', 'domainLayer', 'useCaseRoles'],
    'Verifies use cases only depend on domain and application layers',
    ['useCaseRoles'],
  )],

  ['controller-no-entity', tmpl(
    'controller-no-entity',
    `MATCH (ctrl:Class)-[:IMPORTS|CONSTRUCTOR_INJECTS*1..2]->(entity:Class)
WHERE ctrl.layer = $infraLayer AND entity.layer = $domainLayer
  AND ANY(role IN $entityRoles WHERE entity.name CONTAINS role)
RETURN ctrl.name AS controller, entity.name AS entity, ctrl.filePath AS filePath`,
    ['infraLayer', 'domainLayer', 'entityRoles'],
    'Detects controllers directly referencing domain entities',
    ['entityRoles'],
  )],

  // ── COUPLING ────────────────────────────────────────────────────────────────

  ['domain-stability', tmpl(
    'domain-stability',
    `MATCH (f:File)
WHERE f.layer = $domainLayer
OPTIONAL MATCH (f)<-[:IMPORTS]-(incoming:File) WHERE incoming.layer <> $domainLayer
OPTIONAL MATCH (f)-[:IMPORTS]->(outgoing:File) WHERE outgoing.layer <> $domainLayer
WITH f, count(DISTINCT incoming) AS fanIn, count(DISTINCT outgoing) AS fanOut
WHERE fanIn + fanOut > 0
RETURN f.filePath AS filePath, f.name AS name,
       toFloat(fanOut) / (fanIn + fanOut) AS instability,
       CASE WHEN toFloat(fanOut) / (fanIn + fanOut) > $threshold THEN true ELSE false END AS violation`,
    ['domainLayer', 'threshold'],
    'Domain layer instability must be below threshold (lower = more stable)',
  )],

  ['module-fan-out', tmpl(
    'module-fan-out',
    `MATCH (f:File)-[:IMPORTS]->(dep:File)
WITH f, count(DISTINCT dep) AS fanOut
WHERE fanOut > $threshold
RETURN f.filePath AS filePath, f.name AS name, fanOut`,
    ['threshold'],
    'Detects files with excessive outgoing dependencies',
  )],

  ['component-instability', tmpl(
    'component-instability',
    `MATCH (f:File)
WHERE f.layer IS NOT NULL
OPTIONAL MATCH (f)<-[:IMPORTS]-(incoming:File)
OPTIONAL MATCH (f)-[:IMPORTS]->(outgoing:File)
WITH f, count(DISTINCT incoming) AS fanIn, count(DISTINCT outgoing) AS fanOut
WHERE fanIn + fanOut > 0
RETURN f.filePath AS filePath, f.layer AS layer, f.name AS name,
       toFloat(fanOut) / (fanIn + fanOut) AS instability`,
    [],
    'Computes instability metric per file (fanOut / (fanIn + fanOut))',
  )],

  ['no-orphan-files', tmpl(
    'no-orphan-files',
    `MATCH (f:File)
WHERE f.layer IS NOT NULL
  AND NOT EXISTS { MATCH (f)-[:IMPORTS]->() }
  AND NOT EXISTS { MATCH ()-[:IMPORTS]->(f) }
  AND NOT f.isBarrel
RETURN f.filePath AS filePath, f.name AS name, f.layer AS layer`,
    [],
    'Detects files with no import connections (neither importing nor imported)',
  )],

  ['max-fan-in', tmpl(
    'max-fan-in',
    `MATCH (f:File)<-[:IMPORTS]-(incoming:File)
WITH f, count(DISTINCT incoming) AS fanIn
WHERE fanIn > $threshold
RETURN f.filePath AS filePath, f.name AS name, fanIn`,
    ['threshold'],
    'Detects files with excessive incoming dependencies (god modules)',
  )],

  ['abstraction-ratio', tmpl(
    'abstraction-ratio',
    `MATCH (n) WHERE n:Class OR n:Interface
WITH count(CASE WHEN n:Interface THEN 1 END) AS interfaces,
     count(n) AS total
WHERE total > 0
RETURN toFloat(interfaces) / total AS ratio,
       CASE WHEN toFloat(interfaces) / total < $threshold THEN true ELSE false END AS violation`,
    ['threshold'],
    'Checks ratio of interfaces to total classes+interfaces',
  )],

  // ── SOLID ───────────────────────────────────────────────────────────────────

  ['single-responsibility-proxy', tmpl(
    'single-responsibility-proxy',
    `MATCH (c:Class)
OPTIONAL MATCH (c)-[:CONTAINS]->(m:Method)
OPTIONAL MATCH (c)-[:CONSTRUCTOR_INJECTS]->(dep)
WITH c, count(DISTINCT m) AS methodCount, count(DISTINCT dep) AS depCount
WHERE methodCount > $maxPublicMethods OR depCount > $maxDependencies
RETURN c.name AS class, c.filePath AS filePath, methodCount, depCount`,
    ['maxPublicMethods', 'maxDependencies'],
    'SRP proxy: classes with too many methods or dependencies likely have multiple responsibilities',
  )],

  ['interface-segregation-proxy', tmpl(
    'interface-segregation-proxy',
    `MATCH (i:Interface)-[:CONTAINS]->(m:Method)
WITH i, count(m) AS methodCount
WHERE methodCount > $maxInterfaceMethods
RETURN i.name AS interface, i.filePath AS filePath, methodCount`,
    ['maxInterfaceMethods'],
    'ISP proxy: interfaces with too many methods should be split',
  )],

  ['inheritance-depth', tmpl(
    'inheritance-depth',
    `MATCH path = (c:Class)-[:EXTENDS*]->(base:Class)
WITH c, length(path) AS depth
WHERE depth > $maxDepth
RETURN c.name AS class, c.filePath AS filePath, depth`,
    ['maxDepth'],
    'Detects deep inheritance hierarchies',
  )],

  // ── CONVENTION ──────────────────────────────────────────────────────────────

  ['naming-conventions', tmpl(
    'naming-conventions',
    `MATCH (c:Class)
WHERE c.layer IS NOT NULL
WITH c, c.layer AS layer,
     CASE c.layer
       WHEN $domainLayer THEN $domainPattern
       WHEN $applicationLayer THEN $applicationPattern
       WHEN $infraLayer THEN $infraPattern
       ELSE '.*'
     END AS expectedPattern
WHERE NOT c.name =~ expectedPattern
RETURN c.name AS class, c.filePath AS filePath, layer, expectedPattern`,
    ['domainLayer', 'applicationLayer', 'infraLayer', 'domainPattern', 'applicationPattern', 'infraPattern'],
    'Checks class naming conventions per layer',
  )],

  ['naming-services', tmpl(
    'naming-services',
    `MATCH (c:Class)
WHERE c.layer = $applicationLayer
  AND ANY(role IN ['Service', 'UseCase'] WHERE c.name CONTAINS role)
  AND NOT c.name =~ $pattern
RETURN c.name AS class, c.filePath AS filePath`,
    ['applicationLayer', 'pattern'],
    'Verifies service classes follow naming pattern',
  )],

  ['naming-repos', tmpl(
    'naming-repos',
    `MATCH (c:Class)
WHERE (c.name CONTAINS 'Repository' OR c.name CONTAINS 'Repo')
  AND NOT c.name =~ $pattern
RETURN c.name AS class, c.filePath AS filePath`,
    ['pattern'],
    'Verifies repository classes follow naming pattern',
  )],

  ['naming-controllers', tmpl(
    'naming-controllers',
    `MATCH (c:Class)
WHERE c.layer = $infraLayer
  AND ANY(dec IN c.decorators WHERE dec CONTAINS 'Controller')
  AND NOT c.name =~ $pattern
RETURN c.name AS class, c.filePath AS filePath`,
    ['infraLayer', 'pattern'],
    'Verifies controller classes follow naming pattern',
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
  }
RETURN src.filePath AS filePath, src.name AS name`,
    [],
    'Detects source files without corresponding test files',
  )],

  ['no-index-logic', tmpl(
    'no-index-logic',
    `MATCH (f:File)
WHERE f.isBarrel = true
MATCH (f)-[:DECLARES]->(decl)
WHERE NOT decl:Function OR decl.name IS NOT NULL
WITH f, count(decl) AS declCount
WHERE declCount > 0
RETURN f.filePath AS filePath, declCount`,
    [],
    'Detects barrel/index files that contain business logic declarations',
  )],
]);
