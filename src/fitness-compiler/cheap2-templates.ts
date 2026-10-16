/**
 * Batch-2 cheap-proxy extension templates (`Docs/v1.3/cheap-semantics-design.md`, "Batch 2"): one ADVISORY rule per
 * enrichment, over the facts `src/apg-enrich/cheap/` computes. Kept outside the frozen `CYPHER_TEMPLATES`; registered
 * as the `cheap2` catalogue in `V13_EXTENSION_TEMPLATE_CATALOGUES` so a v1.3 spec may name them.
 *
 * The Cypher reads the cheap facts as a later persistence unit is to write them (none writes them yet, so on today's
 * graphs every template returns no rows, as the APG v2 templates do on a graph without APG v2 edges):
 * - a cheap edge is a relationship of its own type (`THROWS`, `REACHES`, …) between the APG nodes, its properties
 *   copied as they are;
 * - a virtual node is a node labelled with its kind (`EntryPoint`, `EnvKey`, `ErrorType`, `TestFile`, `Step`) with
 *   `id`, `name` and its properties;
 * - a node fact is the property `cheap.<key>` of the APG node.
 * Every template has an in-memory mirror (`cheap2-in-memory.ts`) over the `CheapEnrichment` and the APG, with the
 * same rows, which the unit tests and the diagnostic run use.
 *
 * Tiers follow `Docs/v1.3/rule-tiers.md`: every rule here is a proxy, a heuristic or a guideline, so every one is
 * advisory; none is blocking (that would need an ADR). The tiers are recorded here and in the design note, not in the
 * sealed tier table.
 */
import type { CypherTemplate } from './types.js';
import type { RuleTier } from '../shared/types/spec.js';

const t = (
  functionName: string,
  template: string,
  requiredParams: string[],
  requiredLayerKinds: CypherTemplate['requiredLayerKinds'],
  tag: CypherTemplate['tag'],
  description: string,
  resultMapping: CypherTemplate['resultMapping'],
): [string, CypherTemplate] => [functionName, { functionName, template, requiredParams, optionalParams: [], requiredLayerKinds, tag, description, resultMapping }];

export const CHEAP2_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([
  // (11) Error flow: the transport's exception vocabulary thrown by the core.
  t('framework-exception-in-core', `MATCH (m)-[r:THROWS]->(e)
WHERE r.direct = true AND r.frameworkHttp = true
  AND (m.layer = $domainLayer OR m.layer IN $applicationLayers) /*EXCLUDE:m*/
RETURN m.filePath AS filePath, r.unit AS member, r.errorType AS errorType, r.module AS module, m.layer AS layer
ORDER BY filePath, member, errorType`,
  ['domainLayer', 'applicationLayers'], ['domain'], 'pattern-proxy',
  'Domain or application units that throw a framework HTTP exception (or a subclass of one)',
  { filePathColumn: 'filePath', messageTemplate: '{member} ({layer}) throws framework HTTP exception {errorType}',
    discriminatorColumns: ['member', 'errorType'], metadataColumns: ['member', 'errorType', 'module', 'layer'] }),

  // (12) Reachability: an HTTP or message entry point with a call path to an infrastructure adapter on which no
  // application (core) unit lies.
  t('endpoint-bypasses-application', `MATCH (ep:EntryPoint)-[r:REACHES]->(u)
WHERE ep.entryKind IN ['http', 'message'] AND r.withoutCore = true AND r.infrastructure = true
RETURN ep.file AS filePath, ep.name AS entry, r.unit AS target, u.filePath AS targetFile, r.depth AS depth
ORDER BY filePath, entry, target`,
  [], [], 'topological',
  'Entry points that reach an infrastructure adapter without passing through the application layer',
  { filePathColumn: 'filePath', targetColumn: 'targetFile', messageTemplate: 'entry {entry} reaches {target} without an application unit on the path',
    discriminatorColumns: ['entry', 'target'], metadataColumns: ['entry', 'target'], evidenceColumns: ['depth'] }),

  // (13) SDK spread: a vendor SDK imported outside infrastructure and adapters.
  t('vendor-sdk-outside-adapters', `MATCH (f:File)
WHERE size(coalesce(f.\`cheap.vendorSdkOutsideAdapters\`, [])) > 0 /*EXCLUDE:f*/
UNWIND f.\`cheap.vendorSdkOutsideAdapters\` AS sdk
RETURN f.filePath AS filePath, sdk AS sdk, f.layer AS layer
ORDER BY filePath, sdk`,
  [], [], 'pattern-proxy',
  'Files outside infrastructure and adapters that import a vendor SDK',
  { filePathColumn: 'filePath', messageTemplate: '{filePath} ({layer}) imports vendor SDK {sdk}',
    discriminatorColumns: ['sdk'], metadataColumns: ['sdk', 'layer'] }),

  // (14) Test topology: a component none of whose testable units a test exercises. Replaces FF-CV05's co-location
  // convention with test-to-code traceability.
  t('untested-component', `MATCH (f:File)
WHERE f.\`cheap.componentUntested\` = true /*EXCLUDE:f*/
WITH f.\`cheap.component\` AS component, min(f.filePath) AS filePath, count(f) AS files
RETURN filePath, component, files
ORDER BY component`,
  [], [], 'pattern-proxy',
  'Components with testable code that no test exercises (instantiation, call or reference from a test file)',
  { filePathColumn: 'filePath', messageTemplate: 'component {component} has no test that exercises it',
    discriminatorColumns: ['component'], metadataColumns: ['component'], evidenceColumns: ['files'] }),

  // (15) Config surface: environment reads outside configuration and infrastructure modules.
  t('env-read-outside-config', `MATCH (m)-[r:READS_ENV]->(k:EnvKey)
WHERE r.outsideConfig = true /*EXCLUDE:m*/
RETURN m.filePath AS filePath, m.name AS member, k.name AS key, r.via AS via, r.lines AS lines
ORDER BY filePath, member, key`,
  [], [], 'pattern-proxy',
  'Code outside configuration and infrastructure modules that reads environment variables',
  { filePathColumn: 'filePath', linesColumn: 'lines', messageTemplate: '{member} reads env key {key} through {via} outside a config module',
    discriminatorColumns: ['member', 'key'], metadataColumns: ['member', 'key', 'via'] }),

  // (16) Co-change: evolutionary coupling between components with no static dependency (hidden coupling).
  t('hidden-coupling', `MATCH (a:File)-[r:CO_CHANGES_WITH]->(b:File)
WHERE r.hiddenCoupling = true
RETURN a.filePath AS filePath, b.filePath AS target, r.support AS support, r.confidence AS confidence, r.reverseConfidence AS reverseConfidence
ORDER BY filePath, target`,
  [], [], 'topological',
  'Files of two components that change together although neither component depends on the other',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: '{filePath} and {target} changed together in {support} commits with no static dependency between their components',
    discriminatorColumns: [], evidenceColumns: ['support', 'confidence', 'reverseConfidence'] }),

  // (17) Agent provenance: a unit an agent step added that clones or re-states code that already existed.
  t('agent-reimplementation', `MATCH (n)-[r:REIMPLEMENTS]->(o)
RETURN n.filePath AS filePath, n.name AS unit, o.name AS existing, o.filePath AS target, r.via AS via, r.step AS step, r.existingSince AS existingSince
ORDER BY filePath, unit, existing`,
  [], [], 'pattern-proxy',
  'Units an agent step added that re-implement existing code (clone or shared concept and vocabulary) instead of reusing it',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: '{step} added {unit}, which re-implements {existing} ({via})',
    discriminatorColumns: ['unit', 'existing'], metadataColumns: ['unit', 'existing', 'via', 'step', 'existingSince'] }),
]);

/** A priori tiers of the batch-2 templates, with the construct reason. All advisory. */
export const CHEAP2_TEMPLATE_TIERS: ReadonlyMap<string, { readonly tier: RuleTier; readonly reason: string }> = new Map([
  ['framework-exception-in-core', { tier: 'advisory', reason: 'Frameworks are details (Martin 2017 ch. 32); a thrown type is a proxy for transport knowledge, and several styles accept framework exceptions in the application layer' }],
  ['endpoint-bypasses-application', { tier: 'advisory', reason: 'Call paths come from a static call graph with class-hierarchy resolution, an over-approximation; strict layering is blocking only through the import rule (FF-S03)' }],
  ['vendor-sdk-outside-adapters', { tier: 'advisory', reason: 'A catalogue of vendor packages and an adapter-role heuristic; FF-P01 is the blocking import rule for the domain' }],
  ['untested-component', { tier: 'advisory', reason: 'A project convention (testing), as FF-CV05, which it replaces' }],
  ['env-read-outside-config', { tier: 'advisory', reason: 'A configuration guideline (twelve-factor config), not a defining constraint of a style' }],
  ['hidden-coupling', { tier: 'advisory', reason: 'A history metric with support and confidence thresholds' }],
  ['agent-reimplementation', { tier: 'advisory', reason: 'Clone and vocabulary similarity are heuristics; reuse is a design guideline' }],
]);
