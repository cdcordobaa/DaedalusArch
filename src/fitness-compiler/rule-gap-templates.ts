/**
 * Rule-gap extension templates (`Docs/v1.3/rule-gap-catalogue.md`): constraints that a style's primary sources state
 * and that no existing template checks, written as new Cypher over the APG (and, for two of them, over the APG v2
 * SIGNATURE_USES edge or the HOLDS_STATE_OF field-state edge).
 *
 * OPT-IN, OFF by default. The catalogue is NOT in `V13_EXTENSION_TEMPLATE_CATALOGUES`, so a v1.3 spec that names one
 * of these functions is rejected unless the caller enables the catalogue (`V13_OPT_IN_EXTENSION_CATALOGUES`,
 * `v13OptInCatalogueOf(name, ['rule-gaps'])`). No compile path, preset or scoring code reads it.
 *
 * Tiers: every rule here is ADVISORY, a priori (`RULE_GAP_TEMPLATE_TIERS`). Each one is a name or path heuristic, a
 * guideline the source states as a recommendation, or a rule whose static reading is narrower or wider than the
 * source; none is a defining constraint checked as a precise fact. They are not in the sealed tier table
 * (`Docs/v1.3/rule-tiers.md`); moving one to blocking needs the ADR that table requires.
 *
 * Every template has an in-memory mirror in `rule-gap-in-memory.ts` (same rows, same order), unit-tested on
 * `tests/fixtures/v1.3-rule-gaps`. `ruleGapParams` binds every parameter. Every source row is in `RULE_GAP_SOURCES`.
 */
import type { CypherTemplate } from './types.js';
import type { RuleTier } from '../shared/types/spec.js';

/** The opt-in catalogue's name in `V13_OPT_IN_EXTENSION_CATALOGUES`. */
export const RULE_GAP_CATALOGUE = 'rule-gaps';

const t = (
  functionName: string,
  template: string,
  requiredParams: string[],
  requiredLayerKinds: CypherTemplate['requiredLayerKinds'],
  tag: CypherTemplate['tag'],
  description: string,
  resultMapping: CypherTemplate['resultMapping'],
  applicableStyles: readonly string[],
): [string, CypherTemplate] => [functionName, {
  functionName, template, requiredParams, optionalParams: [], requiredLayerKinds, tag, description, resultMapping, applicableStyles,
}];

/** Test code and composition roots are out of scope of every file- or class-level template (as in `apg2-templates`). */
const TEST_SCOPE = (v: string): string => `NONE(sp IN $testPatterns WHERE ${v}.filePath =~ sp)`;
const COMPOSITION_ROOT_SCOPE = (v: string): string =>
  `(${v}.layer IS NULL OR NOT ${v}.layer IN $compositionRootLayers) AND NONE(sp IN $compositionRootPatterns WHERE ${v}.filePath =~ sp)`;
const SCOPE_PARAMS = ['testPatterns', 'compositionRootLayers', 'compositionRootPatterns'];

export const RULE_GAP_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([
  // (G1) Clean: the use-case layer is framework-free too, not only the entities (FF-P01 reads the domain layer only).
  t('use-case-framework-free', `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(p:Package)
WHERE src.layer IN $applicationLayers
  AND ANY(fp IN $forbiddenImports WHERE p.name = fp OR (fp ENDS WITH '/*' AND p.name STARTS WITH left(fp, size(fp) - 1)))
  AND ${COMPOSITION_ROOT_SCOPE('src')}
  AND ${TEST_SCOPE('src')} /*EXCLUDE:src*/
RETURN src.filePath AS source, p.name AS target, src.layer AS layer, type(i) AS relType,
       i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly
ORDER BY source, target, relType`,
  ['applicationLayers', 'forbiddenImports', ...SCOPE_PARAMS], ['application'], 'pattern-proxy',
  'Application (use-case) files that import a forbidden framework, database or UI package',
  { filePathColumn: 'source', targetColumn: 'target', lineColumn: 'line', linesColumn: 'lines', isTypeOnlyColumn: 'isTypeOnly',
    messageTemplate: 'Use-case file {source} ({layer}) imports framework package {target}',
    discriminatorColumns: ['relType'], metadataColumns: ['target', 'layer', 'relType', 'line', 'lines', 'isTypeOnly'] },
  ['clean-architecture', 'hexagonal']),

  // (G2) Controllers talk to the use cases, not to the data access: a controller that holds a repository or gateway
  // (by injection or by field) bypasses the application layer, whatever layer the repository's interface sits in.
  t('controller-bypasses-application', `MATCH (ctrl:Class)-[e:CONSTRUCTOR_INJECTS|HOLDS_STATE_OF]->(dep)
WHERE ctrl.name =~ $controllerNamePattern
  AND (ctrl.layer IS NULL OR NOT ctrl.layer IN $coreLayers)
  AND dep.name =~ $dataAccessNamePattern
  AND ${COMPOSITION_ROOT_SCOPE('ctrl')}
  AND ${TEST_SCOPE('ctrl')} /*EXCLUDE:ctrl*/
RETURN DISTINCT ctrl.filePath AS filePath, ctrl.name AS controller, dep.name AS dependency, dep.filePath AS target,
       dep.layer AS targetLayer
ORDER BY filePath, controller, dependency`,
  ['controllerNamePattern', 'coreLayers', 'dataAccessNamePattern', ...SCOPE_PARAMS], [], 'pattern-proxy',
  'Controllers that inject or hold a repository, gateway or other data-access type instead of going through a use case or service',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: 'Controller {controller} holds data-access type {dependency} directly',
    discriminatorColumns: ['controller', 'dependency'], metadataColumns: ['controller', 'dependency', 'targetLayer'] },
  ['clean-architecture', 'nestjs', 'hexagonal', 'layered']),

  // (G3) Clean: entities do not cross the use-case boundary outward. A public use-case member that takes or returns a
  // domain entity (FF-P05 reads the controller side only; boundary-type-leak reads infrastructure types only).
  t('use-case-exposes-entity', `MATCH (owner:Class)-[:CONTAINS]->(m:Method)-[u:SIGNATURE_USES]->(ty:Class)
WHERE u.publicSurface = true
  AND owner.layer IN $applicationLayers AND ty.layer = $domainLayer
  AND (ANY(p IN $entityPatterns WHERE ty.filePath =~ p) OR ty.name =~ $entityNamePattern)
  AND ${COMPOSITION_ROOT_SCOPE('owner')}
  AND ${TEST_SCOPE('owner')} /*EXCLUDE:owner*/
RETURN m.filePath AS filePath, m.name AS member, ty.name AS entity, ty.filePath AS target, u.positions AS positions
ORDER BY filePath, member, entity`,
  ['applicationLayers', 'domainLayer', 'entityPatterns', 'entityNamePattern', ...SCOPE_PARAMS], ['application', 'domain'], 'pattern-proxy',
  'Public use-case methods whose parameter or return types name a domain entity (entities cross the boundary)',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: '{member} passes entity {entity} across the use-case boundary ({positions})',
    discriminatorColumns: ['member', 'entity'], metadataColumns: ['member', 'entity', 'positions'] },
  ['clean-architecture']),

  // (G4) DDD (Vernon): reference other aggregates by identity. A class of one aggregate whose field holds the root or an
  // inner entity of another aggregate (HOLDS_STATE_OF, or a constructor parameter property).
  t('aggregate-reference-by-identity', `UNWIND $aggregates AS a
UNWIND $aggregates AS b
WITH a, b WHERE a.name <> b.name
MATCH (c:Class)-[e:HOLDS_STATE_OF|CONSTRUCTOR_INJECTS]->(ty:Class)
WHERE c.filePath =~ a.module
  AND (ty.filePath =~ b.root OR ANY(p IN b.innerEntities WHERE ty.filePath =~ p))
  AND (type(e) = 'HOLDS_STATE_OF' OR e.parameterName IN coalesce(c.fields, []))
  AND ${TEST_SCOPE('c')} /*EXCLUDE:c*/
RETURN DISTINCT c.filePath AS filePath, c.name AS class, a.name AS aggregate, b.name AS otherAggregate,
       ty.name AS heldType, ty.filePath AS target, coalesce(e.field, e.parameterName) AS field
ORDER BY filePath, class, heldType, field`,
  ['aggregates', 'testPatterns'], [], 'structural',
  'Classes of one aggregate that hold a direct object reference to another aggregate (instead of its identity)',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: '{class} ({aggregate}) holds {heldType} of aggregate {otherAggregate} in field {field}',
    discriminatorColumns: ['class', 'heldType', 'field'], metadataColumns: ['class', 'aggregate', 'otherAggregate', 'heldType', 'field'] },
  ['ddd']),

  // (G5) DDD (Vernon): look dependent objects up before invoking the aggregate; do not give the aggregate a repository
  // or a domain service. An aggregate root or inner entity that injects or holds one.
  t('aggregate-holds-service', `UNWIND $aggregates AS a
MATCH (c:Class)-[e:CONSTRUCTOR_INJECTS|HOLDS_STATE_OF]->(dep)
WHERE (c.filePath =~ a.root OR ANY(p IN a.innerEntities WHERE c.filePath =~ p))
  AND (dep.name =~ $aggregateDependencyNamePattern OR ANY(p IN $repositoryPatterns WHERE dep.filePath =~ p))
  AND ${TEST_SCOPE('c')} /*EXCLUDE:c*/
RETURN DISTINCT c.filePath AS filePath, c.name AS class, a.name AS aggregate, dep.name AS dependency, dep.filePath AS target
ORDER BY filePath, class, dependency`,
  ['aggregates', 'aggregateDependencyNamePattern', 'repositoryPatterns', 'testPatterns'], [], 'pattern-proxy',
  'Aggregate roots or inner entities that inject or hold a repository or service',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: 'Aggregate class {class} ({aggregate}) holds {dependency}',
    discriminatorColumns: ['class', 'dependency'], metadataColumns: ['class', 'aggregate', 'dependency'] },
  ['ddd']),

  // (G6) Evans: make the service stateless. A domain or application service that assigns an instance field outside its
  // constructor (member facts), so a call's outcome can depend on earlier calls.
  t('service-stateless', `MATCH (c:Class)
WHERE (c.layer = $domainLayer OR c.layer IN $applicationLayers)
  AND (c.name =~ $serviceNamePattern OR ANY(p IN $servicePatterns WHERE c.filePath =~ p))
  AND size(coalesce(c.fieldsAssignedOutsideConstructor, [])) > 0
  AND ${COMPOSITION_ROOT_SCOPE('c')}
  AND ${TEST_SCOPE('c')} /*EXCLUDE:c*/
RETURN c.filePath AS filePath, c.name AS class, c.layer AS layer, c.fieldsAssignedOutsideConstructor AS fields
ORDER BY filePath, class`,
  ['domainLayer', 'applicationLayers', 'serviceNamePattern', 'servicePatterns', ...SCOPE_PARAMS], ['domain'], 'pattern-proxy',
  'Domain or application services that keep mutable instance state (a field assigned outside the constructor)',
  { filePathColumn: 'filePath', messageTemplate: 'Service {class} ({layer}) keeps state in {fields}',
    discriminatorColumns: ['class'], metadataColumns: ['class', 'layer', 'fields'] },
  ['ddd', 'clean-architecture', 'hexagonal', 'nestjs', 'layered']),

  // (G7) NestJS: a module encapsulates its providers. A provider or controller of module M that injects a class
  // another module provides, when M does not provide it and no module M imports exports it (directly or through a
  // re-exported module). Injections by token of an interface (no module provides that class) are not decided.
  t('nest-provider-not-visible', `MATCH (m:Class)-[:MODULE_PROVIDES]->(c:Class)-[e:CONSTRUCTOR_INJECTS]->(dep:Class)
WHERE EXISTS { MATCH (:Class)-[:MODULE_PROVIDES]->(dep) }
  AND NOT EXISTS { MATCH (m)-[:MODULE_PROVIDES]->(dep) }
  AND NOT EXISTS {
    MATCH (m)-[:MODULE_IMPORTS]->(:Class)-[:MODULE_EXPORTS*0..4]->(x:Class)-[:MODULE_EXPORTS]->(dep)
    WHERE EXISTS { MATCH (x)-[:MODULE_PROVIDES]->(dep) }
  }
  AND NOT EXISTS {
    MATCH (g:Class)-[:MODULE_EXPORTS]->(dep)
    WHERE ANY(gp IN $globalModulePatterns WHERE g.name =~ gp) AND EXISTS { MATCH (g)-[:MODULE_PROVIDES]->(dep) }
  }
  AND ${TEST_SCOPE('c')} /*EXCLUDE:c*/
RETURN DISTINCT c.filePath AS filePath, c.name AS consumer, m.name AS module, dep.name AS dependency, dep.filePath AS target,
       e.parameterName AS parameter
ORDER BY filePath, consumer, dependency`,
  ['globalModulePatterns', 'testPatterns'], [], 'structural',
  'Providers or controllers that inject a class their module neither provides nor imports from a module that exports it',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: '{consumer} ({module}) injects {dependency}, which its module neither provides nor imports',
    discriminatorColumns: ['consumer', 'dependency'], metadataColumns: ['consumer', 'module', 'dependency', 'parameter'] },
  ['nestjs']),

  // (G8) NestJS: a provider registered directly in several modules gets one instance per module (shared modules).
  t('nest-provider-multiple-modules', `MATCH (m:Class)-[r:MODULE_PROVIDES]->(p:Class)
WHERE r.role = 'provider' AND ${TEST_SCOPE('p')} /*EXCLUDE:p*/
WITH p, apoc.coll.sort(collect(DISTINCT m.name)) AS modules
WHERE size(modules) > 1
RETURN p.filePath AS filePath, p.name AS provider, modules, size(modules) AS moduleCount
ORDER BY filePath, provider`,
  ['testPatterns'], [], 'structural',
  'Providers listed in the providers of more than one module (one instance per module instead of a shared, exported one)',
  { filePathColumn: 'filePath', messageTemplate: 'Provider {provider} is registered in {moduleCount} modules: {modules}',
    discriminatorColumns: ['provider'], metadataColumns: ['provider', 'modules'], evidenceColumns: ['moduleCount'] },
  ['nestjs']),
]);

/** A priori tiers of the rule-gap templates, with the construct reason. All advisory. */
export const RULE_GAP_TEMPLATE_TIERS: ReadonlyMap<string, { readonly tier: RuleTier; readonly reason: string }> = new Map([
  ['use-case-framework-free', { tier: 'advisory', reason: 'Martin states it for the use-case layer, but ch. 32 lets some frameworks be "married"; the forbidden list is the spec\'s domain list reused, a proxy' }],
  ['controller-bypasses-application', { tier: 'advisory', reason: 'Name heuristic for controllers and data-access types; the sources describe the controller-to-use-case flow, they do not forbid the shortcut in so many words' }],
  ['use-case-exposes-entity', { tier: 'advisory', reason: 'Entities are recognised by path or name convention; Martin\'s boundary-data rule is a guideline ("we don\'t want to cheat")' }],
  ['aggregate-reference-by-identity', { tier: 'advisory', reason: 'Vernon states it as a preference ("prefer references ... by identity") and lists reasons to break it' }],
  ['aggregate-holds-service', { tier: 'advisory', reason: 'Vernon calls the alternative "recommended"; repositories and services are recognised by name or declared path' }],
  ['service-stateless', { tier: 'advisory', reason: 'Service classes are recognised by name or path; a field assigned outside the constructor is a proxy for observable state' }],
  ['nest-provider-not-visible', { tier: 'advisory', reason: 'A DI fact Nest itself enforces at start-up; @Global() modules are not in the graph (decorators are not ingested) and token injections are not decided' }],
  ['nest-provider-multiple-modules', { tier: 'advisory', reason: 'The docs warn against it (memory, state inconsistency) but it runs; a design guideline' }],
]);

/** One source row: the source, the locator, the constraint, and how the wording was checked. */
export interface RuleGapSource {
  readonly style: string;
  readonly source: string;
  readonly locator: string;
  readonly constraint: string;
  /** `verbatim (<where read>)` or `(recalled)`: wording not checked in print. */
  readonly wording: string;
}

export const RULE_GAP_SOURCES: ReadonlyMap<string, RuleGapSource> = new Map([
  ['use-case-framework-free', {
    style: 'clean-architecture', source: 'Martin, "The Clean Architecture" (2012 blog); Martin, Clean Architecture (2017)',
    locator: 'blog, section "Use Cases"; book ch. 22 "The Clean Architecture", Use Cases; ch. 32 "Frameworks Are Details"',
    constraint: 'Changes to externalities such as the database, the UI or the common frameworks are not expected to affect the use-case layer.',
    wording: 'verbatim (blog, read 2026-10-16): "We also do not expect this layer to be affected by changes to externalities such as the database, the UI, or any of the common frameworks." Book ch. 22 wording (recalled).',
  }],
  ['controller-bypasses-application', {
    style: 'clean-architecture, nestjs (also layered, hexagonal)', source: 'Martin 2012 blog / 2017 ch. 22; NestJS docs "Providers"; Fowler, PoEAA (2002) ch. 9 "Service Layer"',
    locator: 'blog, section "Crossing boundaries"; docs.nestjs.com/providers (opening); PoEAA p. 133 Service Layer (recalled)',
    constraint: 'Controllers communicate with the use cases (or delegate to service providers); the application boundary is a layer of services.',
    wording: 'verbatim (blog): "It shows the Controllers and Presenters communicating with the Use Cases in the next layer." NestJS "Providers" (verification file row 13): "Controllers should handle HTTP requests and delegate more complex tasks to providers." Fowler: "Defines an application\'s boundary with a layer of services" (PoEAA catalogue, recalled).',
  }],
  ['use-case-exposes-entity', {
    style: 'clean-architecture', source: 'Martin 2012 blog; Martin 2017 ch. 22',
    locator: 'blog, section "What data crosses the boundaries"; book ch. 22, same section (recalled)',
    constraint: 'Only isolated, simple data structures cross a boundary; entity objects and database rows do not.',
    wording: 'verbatim (blog, read 2026-10-16): "We don\'t want to cheat and pass Entities or Database rows." and "isolated, simple, data structures are passed across the boundaries."',
  }],
  ['aggregate-reference-by-identity', {
    style: 'ddd', source: 'Vernon, "Effective Aggregate Design" part II (2011); Vernon, Implementing DDD (2013) ch. 10',
    locator: 'EAD part II p. 7, "Rule: Reference Other Aggregates By Identity"; IDDD ch. 10, same rule (recalled page)',
    constraint: 'An aggregate references another aggregate by its identity, not by a direct object reference.',
    wording: 'verbatim (EAD part II p. 7, PDF read 2026-10-16): "Prefer references to external aggregates only by their globally unique identity, not by holding a direct object reference (or “pointer”)." Evans (DDD Reference p. 16) allows references to the root, so this is stricter than Evans.',
  }],
  ['aggregate-holds-service', {
    style: 'ddd', source: 'Vernon, "Effective Aggregate Design" part II (2011); Vernon 2013 ch. 10',
    locator: 'EAD part II p. 7, "Model Navigation"; IDDD ch. 10 (recalled)',
    constraint: 'Dependent objects are looked up by a repository or domain service before the aggregate behaviour is invoked, not from inside the aggregate.',
    wording: 'verbatim (EAD part II p. 7): "Some will use a repository from inside an aggregate for look up. ... There\'s a different recommended approach, however: Use a repository or domain service to look up dependent objects ahead of invoking the aggregate behavior." The IDDD sentence that injecting a repository or domain service into an aggregate "should generally be viewed as harmful" is (recalled).',
  }],
  ['service-stateless', {
    style: 'ddd (Evans services; applied to every style\'s service classes)', source: 'Evans, Domain-Driven Design (2003) ch. 5 "Services"',
    locator: 'ch. 5, "Services", the pattern\'s Therefore paragraph (about p. 105, recalled)',
    constraint: 'A service is stateless: any client can use any instance of it, whatever the instance\'s history.',
    wording: '(recalled): "Make the SERVICE stateless." The DDD Reference (2015) p. 14 "Services" was read and does NOT contain the stateless sentence; check the 2003 book in print.',
  }],
  ['nest-provider-not-visible', {
    style: 'nestjs', source: 'NestJS documentation, "Modules"',
    locator: 'docs.nestjs.com/modules, opening section; content/modules.md (read 2026-10-16)',
    constraint: 'A module can inject only providers that are part of the module or explicitly exported by a module it imports.',
    wording: 'verbatim: "you can inject only providers that are part of the current module or that are explicitly exported by an imported module." "Global modules": "Making everything global is not a recommended design practice."',
  }],
  ['nest-provider-multiple-modules', {
    style: 'nestjs', source: 'NestJS documentation, "Modules"',
    locator: 'docs.nestjs.com/modules, section "Shared modules"; content/modules.md (read 2026-10-16)',
    constraint: 'A provider shared by several modules is provided and exported by one module and imported by the others; registering it in each module gives each its own instance.',
    wording: 'verbatim: "each module would then get its own separate instance of the service" and "Multiple instances increase memory usage and can cause unexpected behavior".',
  }],
]);
