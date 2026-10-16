import type { CypherTemplate } from './types.js';

/**
 * v1.3 example fitness-function templates over the NestJS module-wiring edges (`moduleWiring` extractor option).
 * Kept apart from `CYPHER_TEMPLATES`: that catalogue is the frozen v1.2E instrument. These are reachable only
 * through `compileFunctions(input, { v13Templates: true })` and need a graph extracted with `moduleWiring: true`;
 * on a graph without MODULE_IMPORTS edges they return no rows.
 */
export const V13_CYPHER_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([
  ['module-domain-imports-infrastructure', {
    functionName: 'module-domain-imports-infrastructure',
    // A domain-layer @Module that lists an infrastructure-layer @Module in `imports` (the module boundary a
    // file-level `no-domain-outward-dep` cannot see when the import is wired by metadata, not by a statement).
    template: `MATCH (m:Class)-[e:MODULE_IMPORTS]->(t:Class)
WHERE m.layer = $domainLayer AND t.layer = $infraLayer /*EXCLUDE:m*/
RETURN m.filePath AS filePath, m.name AS module, t.filePath AS target, t.name AS targetModule,
       type(e) AS relType, e.line AS line
ORDER BY filePath, module, target, relType`,
    requiredParams: ['domainLayer', 'infraLayer'],
    optionalParams: [],
    description: 'Detects domain modules whose @Module metadata imports an infrastructure module',
    resultMapping: {
      filePathColumn: 'filePath',
      messageTemplate: 'Domain module {module} imports infrastructure module {targetModule}',
      targetColumn: 'target',
      lineColumn: 'line',
      discriminatorColumns: ['module', 'targetModule', 'relType'],
    },
    tag: 'structural',
    requiredLayerKinds: ['domain', 'infrastructure'],
    applicableStyles: ['clean-architecture', 'nestjs'],
  }],
]);
