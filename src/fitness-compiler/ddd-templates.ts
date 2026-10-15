/**
 * Domain-Driven Design library, v1.3 (FR-V4). Kept apart from `cypher-templates.ts` so the frozen v1.2E instrument
 * (CYPHER_TEMPLATES, its tags, applicability table and role exemptions) is untouched: these templates are reachable
 * only through `compileDddFunctions`, which `compileFunctions` calls for style `ddd`.
 *
 * The extractor knows files, classes, interfaces, methods and their edges; it does not know which file is a bounded
 * context, an aggregate root or a value object. Those facts are declared in the spec (`architecture.ddd`, see
 * `DddModel`) and bound here into parameters: context roots as path prefixes, every other declaration as an anchored
 * regex from its glob. Rule definitions, literature sources and tiers: Docs/v1.3-ddd-notes.md.
 */
import type { CypherTemplate, ResultMapping } from './types.js';
import type { DddModel, FitnessFunction, LayerModel } from '../shared/types/spec.js';
import { globToRegex } from './glob-to-regex.js';

export const DDD_STYLE = 'ddd';

const DDD_ONLY: readonly string[] = [DDD_STYLE];

/** Non-static method names that the value-object proxy treats as setters (FF-DT03; Cypher `=~` is a full match). */
export const SETTER_NAME_PATTERN = 'set[A-Z].*';

/**
 * FF-DT03's mapping, shared by the frozen proxy text and the v1.3 member-fact text (the evaluator looks a mapping up by
 * template name). Both return `class` and `method`: the member(s) that make the value object mutable, qualified by the
 * class (`Quantity.setValue`; `Quantity.value (set accessor)`), so the violation ids of the proxy rows are unchanged.
 */
const VALUE_OBJECT_MAPPING: ResultMapping = {
  filePathColumn: 'filePath', messageTemplate: 'Value object {class} in {filePath} is mutable through {method}',
  discriminatorColumns: ['class', 'method'], metadataColumns: ['class', 'method'],
};

type TMapColumns = Omit<ResultMapping, 'filePathColumn' | 'messageTemplate' | 'metadataColumns'>;

const DEP_EDGE: TMapColumns = {
  targetColumn: 'target', lineColumn: 'line', linesColumn: 'lines', isTypeOnlyColumn: 'isTypeOnly',
  discriminatorColumns: ['relType'],
};

function edgeMapping(message: string, columns: readonly string[], extraDiscriminators: readonly string[] = []): ResultMapping {
  return {
    filePathColumn: 'source', messageTemplate: message, ...DEP_EDGE,
    discriminatorColumns: [...extraDiscriminators, 'relType'],
    metadataColumns: [...columns, 'relType', 'line', 'lines', 'isTypeOnly'],
  };
}

function ddd(
  functionName: string,
  template: string,
  requiredParams: string[],
  optionalParams: string[],
  requiredLayerKinds: CypherTemplate['requiredLayerKinds'],
  tag: CypherTemplate['tag'],
  description: string,
  resultMapping: ResultMapping,
): CypherTemplate {
  return { functionName, template, requiredParams, requiredLayerKinds, tag, optionalParams, description, resultMapping, applicableStyles: DDD_ONLY };
}

const EDGE_TAIL = `type(i) AS relType,
       CASE type(i) WHEN 'IMPORTS' THEN 'imports' ELSE 're-exports' END AS verb,
       i.line AS line, i.lines AS lines, coalesce(i.isTypeOnly, false) AS isTypeOnly`;

/** The M1 workaround clause of `context-isolation` (published via a public-API barrel); dropped in the literal view. */
const M1_PUBLISHED_VIA_BARREL = `  AND NOT EXISTS {
    MATCH (api:File)-[:RE_EXPORTS*1..]->(tgt)
    WHERE api.filePath STARTS WITH tgtCtx[0] AND ANY(p IN $publicApiPatterns WHERE api.filePath =~ p)
  }
`;

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('ddd-templates: missing template');
  return v;
}

export const DDD_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([
  // ── Strategic ──
  ['bounded-context-modules', ddd(
    'bounded-context-modules',
    // FF-DS01: every source file lies in a declared context root (a top-level module, checked when binding) or in a
    // path declared outside the contexts (shared kernel, composition root).
    `MATCH (f:File)
WHERE f.filePath STARTS WITH $sourceRoot
  AND NONE(r IN $contextRoots WHERE f.filePath STARTS WITH r)
  AND NONE(p IN $outsidePatterns WHERE f.filePath =~ p) /*EXCLUDE:f*/
RETURN f.filePath AS filePath
ORDER BY filePath`,
    ['sourceRoot', 'contextRoots'], ['outsidePatterns'], [], 'structural',
    'Detects source files that lie in no declared bounded context and in no path declared outside the contexts',
    { filePathColumn: 'filePath', messageTemplate: '{filePath} lies in no declared bounded context', discriminatorColumns: [] },
  )],

  ['context-isolation', ddd(
    'context-isolation',
    // FF-DS02: an import from context A into context B must target B's declared public API, unless the importing
    // file is in A's declared anti-corruption layer. Public-API and ACL globs lie inside their own context's root
    // (checked when binding), so matching any of them means matching the right context's.
    // The extractor routes an import through a barrel to the declaring file (per-name barrel routing), so an import of
    // B's `index.ts` arrives at the file the barrel re-exports. A file that one of B's public-API files re-exports is
    // therefore treated as published; the cost is that a deep import of such a file, bypassing the barrel, is not
    // reported (Docs/v1.3-ddd-notes.md §6, probes g02 and g03).
    `MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)
WITH src, tgt, i,
     [r IN $contextRoots WHERE src.filePath STARTS WITH r] AS srcCtx,
     [r IN $contextRoots WHERE tgt.filePath STARTS WITH r] AS tgtCtx
WHERE size(srcCtx) > 0 AND size(tgtCtx) > 0 AND srcCtx[0] <> tgtCtx[0]
  AND NONE(p IN $publicApiPatterns WHERE tgt.filePath =~ p)
  AND NOT EXISTS {
    MATCH (api:File)-[:RE_EXPORTS*1..]->(tgt)
    WHERE api.filePath STARTS WITH tgtCtx[0] AND ANY(p IN $publicApiPatterns WHERE api.filePath =~ p)
  }
  AND NONE(p IN $aclPatterns WHERE src.filePath =~ p) /*EXCLUDE:src*/
RETURN src.filePath AS source, tgt.filePath AS target, srcCtx[0] AS sourceContext, tgtCtx[0] AS targetContext,
       ${EDGE_TAIL}
ORDER BY source, target, relType`,
    ['contextRoots'], ['publicApiPatterns', 'aclPatterns'], [], 'structural',
    'Detects imports across bounded contexts that bypass the target context\'s public API outside an anti-corruption layer',
    edgeMapping('{source} ({sourceContext}) {verb} {target}, which is not in the public API of {targetContext}', ['target', 'sourceContext', 'targetContext']),
  )],

  // ── Tactical ──
  ['aggregate-boundary', ddd(
    'aggregate-boundary',
    // FF-DT01: nothing outside an aggregate's module references one of its inner entities (Evans 2003, ch. 6).
    `UNWIND $aggregates AS agg
MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)
WHERE ANY(p IN agg.innerEntities WHERE tgt.filePath =~ p)
  AND NOT src.filePath =~ agg.module /*EXCLUDE:src*/
RETURN src.filePath AS source, tgt.filePath AS target, agg.name AS aggregate,
       ${EDGE_TAIL}
ORDER BY source, target, relType`,
    ['aggregates'], [], [], 'structural',
    'Detects references from outside an aggregate to one of its inner entities (only the root may be referenced)',
    edgeMapping('{source} {verb} {target}, an inner entity of aggregate {aggregate}', ['target', 'aggregate'], ['aggregate']),
  )],

  ['repository-aggregate-root', ddd(
    'repository-aggregate-root',
    // FF-DT02: a repository's contract never names an inner entity; repositories exist for aggregate roots only.
    `UNWIND $aggregates AS agg
MATCH (src:File)-[i:IMPORTS|RE_EXPORTS]->(tgt:File)
WHERE ANY(p IN $repositoryPatterns WHERE src.filePath =~ p)
  AND ANY(p IN agg.innerEntities WHERE tgt.filePath =~ p) /*EXCLUDE:src*/
RETURN src.filePath AS source, tgt.filePath AS target, agg.name AS aggregate,
       ${EDGE_TAIL}
ORDER BY source, target, relType`,
    ['aggregates', 'repositoryPatterns'], [], [], 'pattern-proxy',
    'Detects repositories that reference an inner entity of an aggregate (repositories exist for aggregate roots only)',
    edgeMapping('Repository {source} {verb} {target}, an inner entity of aggregate {aggregate}', ['target', 'aggregate'], ['aggregate']),
  )],

  ['value-object-immutability', ddd(
    'value-object-immutability',
    // FF-DT03 (advisory proxy): the extractor records no field modifiers, accessors or visibility, so a value object
    // is checked for setter-named, non-static methods only.
    `MATCH (c:Class)-[:CONTAINS]->(m:Method)
WHERE ANY(p IN $valueObjectPatterns WHERE c.filePath =~ p)
  AND coalesce(m.isStatic, false) = false
  AND last(split(m.name, '.')) =~ $setterPattern /*EXCLUDE:c*/
RETURN c.filePath AS filePath, c.name AS class, m.name AS method
ORDER BY filePath, class, method`,
    ['valueObjectPatterns', 'setterPattern'], [], [], 'pattern-proxy',
    'Detects value objects that declare a setter-named method (proxy for a mutable value object)',
    VALUE_OBJECT_MAPPING,
  )],

  ['domain-event-placement', ddd(
    'domain-event-placement',
    // FF-DT05: a class implementing or extending a declared domain-event type (directly or through a base class) is
    // defined in a domain layer.
    `MATCH (c:Class)-[:IMPLEMENTS|EXTENDS*1..]->(e)
WHERE e.name IN $domainEventTypes
  AND (c.layer IS NULL OR NOT c.layer IN $domainLayers) /*EXCLUDE:c*/
RETURN DISTINCT c.filePath AS filePath, c.name AS class, c.layer AS layer
ORDER BY filePath, class`,
    ['domainEventTypes', 'domainLayers'], [], ['domain'], 'pattern-proxy',
    'Detects domain-event classes defined outside the domain layer',
    { filePathColumn: 'filePath', messageTemplate: 'Domain event {class} is defined in {filePath} outside the domain', discriminatorColumns: ['class'], metadataColumns: ['class', 'layer'] },
  )],

  ['application-service-thin', ddd(
    'application-service-thin',
    // FF-DT06 (advisory heuristic): an application service with more methods than the threshold holds logic beyond
    // coordinating the domain.
    `MATCH (c:Class)-[:CONTAINS]->(m:Method)
WHERE ANY(p IN $applicationServicePatterns WHERE c.filePath =~ p) /*EXCLUDE:c*/
WITH c, count(m) AS methods
WHERE methods > $threshold
RETURN c.filePath AS filePath, c.name AS class, methods
ORDER BY filePath, class`,
    ['applicationServicePatterns', 'threshold'], [], [], 'pattern-proxy',
    'Flags application services that declare more methods than the threshold (heuristic for business rules outside the domain)',
    { filePathColumn: 'filePath', messageTemplate: 'Application service {class} in {filePath} declares {methods} methods', discriminatorColumns: ['class'], evidenceColumns: ['methods'] },
  )],
]);

// ── Binding and validation ──────────────────────────────────────────────────

/** An aggregate as bound into `$aggregates`: the module and inner-entity globs as anchored regexes. */
export interface BoundAggregate {
  readonly name: string;
  readonly module: string;
  readonly innerEntities: readonly string[];
}

export interface DddBinding {
  readonly sourceRoot: string;
  readonly contextRoots: readonly string[];
  readonly publicApiPatterns: readonly string[];
  readonly aclPatterns: readonly string[];
  readonly outsidePatterns: readonly string[];
  readonly aggregates: readonly BoundAggregate[];
  readonly repositoryPatterns: readonly string[];
  readonly valueObjectPatterns: readonly string[];
  readonly applicationServicePatterns: readonly string[];
  readonly domainEventTypes: readonly string[];
  readonly domainLayers: readonly string[];
}

export type DddBindResult =
  | { readonly ok: true; readonly binding: DddBinding }
  | { readonly ok: false; readonly errors: readonly string[] };

const rx = (glob: string): string => globToRegex(glob, { segmentGlobstar: true });

/**
 * Check the `architecture.ddd` declarations and bind them. A context root must be a top-level module
 * (`<source_root><one segment>/`); public-API, ACL, aggregate module, root and inner-entity paths must lie inside their
 * context's root; an aggregate's root may not also be declared an inner entity.
 */
export function bindDddModel(layerModel: LayerModel): DddBindResult {
  const model: DddModel | undefined = layerModel.ddd;
  if (model === undefined) return { ok: false, errors: ['ddd style requires architecture.ddd'] };
  const errors: string[] = [];
  const { sourceRoot } = model;
  if (!sourceRoot.endsWith('/')) errors.push(`ddd.source_root "${sourceRoot}" must end with "/"`);

  const roots = new Map<string, string>();
  for (const c of model.contexts) {
    if (roots.has(c.name)) errors.push(`ddd context "${c.name}" is declared twice`);
    roots.set(c.name, c.root);
    const rest = c.root.startsWith(sourceRoot) ? c.root.slice(sourceRoot.length) : undefined;
    if (rest === undefined || !/^[^/*?]+\/$/.test(rest)) {
      errors.push(`ddd context "${c.name}": root "${c.root}" is not a top-level module "${sourceRoot}<name>/"`);
    }
    for (const g of [...c.publicApi, ...c.acl]) {
      if (!g.startsWith(c.root)) errors.push(`ddd context "${c.name}": "${g}" lies outside its root "${c.root}"`);
    }
  }
  const rootValues = [...roots.values()];
  if (new Set(rootValues).size !== rootValues.length) errors.push('two ddd contexts share a root');

  for (const a of model.aggregates) {
    const root = roots.get(a.context);
    if (root === undefined) {
      errors.push(`ddd aggregate "${a.name}" names unknown context "${a.context}"`);
      continue;
    }
    for (const g of [a.module, a.root, ...a.innerEntities]) {
      if (!g.startsWith(root)) errors.push(`ddd aggregate "${a.name}": "${g}" lies outside context root "${root}"`);
    }
    if (a.innerEntities.includes(a.root)) errors.push(`ddd aggregate "${a.name}": the root is also declared an inner entity`);
  }

  const domainLayers = layerModel.layers.filter((l) => l.kind === 'domain').map((l) => l.name);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    binding: {
      sourceRoot,
      contextRoots: rootValues,
      publicApiPatterns: model.contexts.flatMap((c) => c.publicApi.map(rx)),
      aclPatterns: model.contexts.flatMap((c) => c.acl.map(rx)),
      outsidePatterns: model.outsideContexts.map(rx),
      aggregates: model.aggregates.map((a) => ({ name: a.name, module: rx(a.module), innerEntities: a.innerEntities.map(rx) })),
      repositoryPatterns: model.repositories.map(rx),
      valueObjectPatterns: model.valueObjects.map(rx),
      applicationServicePatterns: model.applicationServices.map(rx),
      domainEventTypes: [...model.domainEventTypes],
      domainLayers,
    },
  };
}

/**
 * Parameters of one DDD template: its required and optional parameters. Optional list parameters are always bound,
 * empty when nothing is declared, because the Cypher reads them unconditionally (an empty NONE(...) is true).
 */
export function buildDddParams(
  ff: FitnessFunction,
  binding: DddBinding,
  template: CypherTemplate | undefined = DDD_TEMPLATES.get(ff.name),
): Record<string, unknown> {
  const candidates: Record<string, unknown> = {
    sourceRoot: binding.sourceRoot,
    contextRoots: [...binding.contextRoots],
    publicApiPatterns: [...binding.publicApiPatterns],
    aclPatterns: [...binding.aclPatterns],
    outsidePatterns: [...binding.outsidePatterns],
    aggregates: binding.aggregates.map((a) => ({ name: a.name, module: a.module, innerEntities: [...a.innerEntities] })),
    repositoryPatterns: [...binding.repositoryPatterns],
    valueObjectPatterns: [...binding.valueObjectPatterns],
    applicationServicePatterns: [...binding.applicationServicePatterns],
    domainEventTypes: [...binding.domainEventTypes],
    domainLayers: [...binding.domainLayers],
    setterPattern: SETTER_NAME_PATTERN,
  };
  if (ff.threshold != null) candidates.threshold = ff.threshold;
  const params: Record<string, unknown> = {};
  if (!template) return params;
  for (const name of [...template.requiredParams, ...template.optionalParams]) {
    const value = candidates[name];
    if (value != null) params[name] = value;
  }
  return params;
}

/**
 * v1.3 (ADR-V13-01, fix round fix 6): DDD template texts used instead of the ones above when the compile reads the
 * edge views (`CompileOptions.edgeViews`, on a graph with the literal barrel edge).
 *
 * `context-isolation` (FF-DS02) reads the literal view. There an import through B's barrel ends at the barrel file
 * itself (a public-API file), and the edge on to the declaring file is a `viaReExport` edge the view drops. So the M1
 * workaround above (a file a public-API barrel re-exports counts as published) is no longer needed, and it is dropped:
 * a deep import that bypasses the barrel (`billing/api/... -> ordering/application/GetOrderSummary.ts`, probe g03,
 * mismatch M2 of Docs/v1.3-ddd-notes.md §6) is a literal edge to a non-public file and is reported, while the import
 * through the barrel (probe g02) is not. On a graph without the literal barrel edge (v1.2E extraction) this text would
 * reopen M1, which is why it is selected only together with the edge views.
 */
export const DDD_LITERAL_VIEW_TEMPLATES: ReadonlyMap<string, string> = new Map([
  ['context-isolation', must(DDD_TEMPLATES.get('context-isolation')).template.replace(M1_PUBLISHED_VIA_BARREL, '')],
]);

/**
 * v1.3 member facts: DDD templates used instead of the ones above when the compile reads the extractor's class-member
 * facts (`CompileOptions.memberFacts`, on a graph extracted with `ExtractorOptions.memberFacts`).
 *
 * `value-object-immutability` (FF-DT03, blocking per the sealed Docs/v1.3/rule-tiers.md). Evans 2003, ch. 5 VALUE
 * OBJECTS: treat a value object as immutable; change it by replacing it. Definition: a class in a declared
 * value-object file is mutable when it has
 *   (a) a public, non-readonly, non-static field (a property declaration or a constructor parameter property),
 *   (b) a non-static `set` accessor (any visibility), or
 *   (c) a public non-static method (or arrow-function property) whose body assigns a `this.<field>`; the constructor
 *       is not a method, so constructor-only assignment is immutable.
 * A class with private fields and public getters only is immutable. One row per mutable value object (the rule's unit,
 * as in the manifests): `members` lists every offending member qualified by its class with its clause, in clause then
 * source order, and `method` joins them for the shared mapping's message. The template reads no edge. On a graph without member
 * facts (v1.2E extraction) the lists are absent and the query returns no row, so it is selected only together with
 * a member-fact extraction (`V13_DEFAULT_OPTIONS` + `V13_COMPILE_OPTIONS`).
 */
export const DDD_MEMBER_FACT_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([
  ['value-object-immutability', ddd(
    'value-object-immutability',
    `MATCH (c:Class)
WHERE ANY(p IN $valueObjectPatterns WHERE c.filePath =~ p) /*EXCLUDE:c*/
WITH c,
     [f IN coalesce(c.publicFields, [])
        WHERE NOT f IN coalesce(c.readonlyFields, []) AND NOT f IN coalesce(c.staticFields, []) | c.name + '.' + f + ' (public mutable field)']
     + [s IN coalesce(c.setAccessors, []) | c.name + '.' + s + ' (set accessor)']
     + [m IN coalesce(c.mutatorMethods, []) | c.name + '.' + m + ' (mutator method)'] AS members
WHERE size(members) > 0
RETURN c.filePath AS filePath, c.name AS class, reduce(acc = head(members), x IN tail(members) | acc + ', ' + x) AS method,
       members
ORDER BY filePath, class`,
    ['valueObjectPatterns'], [], [], 'structural',
    'Detects value objects with a public mutable field, a set accessor, or a public method that assigns a field',
    VALUE_OBJECT_MAPPING,
  )],
]);
