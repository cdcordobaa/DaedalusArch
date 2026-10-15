/**
 * APG v2 extension templates (`Docs/v1.3/apg2-design.md`): one or two generic rules per enrichment, over the edges the
 * extractor writes with the `apg2` option (`V13_APG2_OPTIONS`). Kept outside the frozen `CYPHER_TEMPLATES`; registered
 * as the `apg2` catalogue in `V13_EXTENSION_TEMPLATE_CATALOGUES` so a v1.3 spec may name them. On a graph without the
 * APG v2 edges every template returns no rows.
 *
 * Tiers follow the principle of `Docs/v1.3/rule-tiers.md` (a precise structural fact that states a defining constraint
 * is a blocking candidate; a metric threshold or a guideline is advisory). They are recorded here and in the design
 * document, not in the sealed tier table: adding them there needs the ADR the table's first paragraph requires.
 *
 * Every template has an in-memory mirror in `apg2-in-memory.ts` (same rows), unit-tested on the APG v2 fixtures.
 *
 * Scope (`Docs/v1.3/apg2-scope-adr-draft.md`, v1.3): composition roots are exempt from the deep-import and type-leak
 * templates (`$compositionRootLayers`, `$compositionRootPatterns`; change 1), a declared anti-corruption layer from
 * the deep-import templates for imports into another module (`$aclPatterns`; change 2), and test code from every
 * template (`$testPatterns`; change 3). `component-adp-cycle` reads no layer components (change 4), and
 * `component-main-sequence-distance` reads only non-layer components with at least `$minTypes` types (change 5).
 * `apg2Params` binds every scope parameter.
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

/** The I/O categories each I/O template reports. */
export const IO_BLOCKING_CATEGORIES: readonly string[] = Object.freeze(['db', 'http-out', 'fs']);
export const IO_ADVISORY_CATEGORIES: readonly string[] = Object.freeze(['clock', 'random', 'env', 'process']);

/** Scope parameters every template that reads a file or member binds (ADR changes 1 to 3). */
const TEST_SCOPE = (v: string): string => `NONE(sp IN $testPatterns WHERE ${v}.filePath =~ sp)`;
const COMPOSITION_ROOT_SCOPE = (v: string): string =>
  `(${v}.layer IS NULL OR NOT ${v}.layer IN $compositionRootLayers) AND NONE(sp IN $compositionRootPatterns WHERE ${v}.filePath =~ sp)`;
const ACL_SCOPE = (s: string, d: string): string => `NOT (${d}.kind = 'module' AND ANY(sp IN $aclPatterns WHERE ${s}.filePath =~ sp))`;
const DEEP_IMPORT_SCOPE_PARAMS = ['compositionRootLayers', 'compositionRootPatterns', 'testPatterns', 'aclPatterns'];

const ioTemplate = (categoriesLiteral: string): string => `MATCH (m)-[r:PERFORMS_IO]->(io:IOCategory)
WHERE (m.layer = $domainLayer OR m.layer IN $applicationLayers)
  AND io.name IN ${categoriesLiteral}
  AND ${TEST_SCOPE('m')} /*EXCLUDE:m*/
RETURN m.filePath AS filePath, m.name AS member, m.layer AS layer, io.name AS category, r.apis AS apis, r.line AS line, r.lines AS lines
ORDER BY filePath, member, category`;

export const APG2_TEMPLATES: ReadonlyMap<string, CypherTemplate> = new Map([
  // (1) Type flow. A public member of an exposing layer (the controller layer, the application layers) whose signature
  // names a type declared in the infrastructure layer: the dependency rule broken through a signature, with or without
  // an import (inferred return types, type-only re-exports). Parnas 1972; Martin 2017 ch. 22.
  t('boundary-type-leak', `MATCH (m)-[u:SIGNATURE_USES]->(ty)
WHERE u.publicSurface = true
  AND (m.layer = $controllerLayer OR m.layer IN $applicationLayers)
  AND ty.layer = $infraLayer AND m.layer <> ty.layer
  AND ${COMPOSITION_ROOT_SCOPE('m')}
  AND ${TEST_SCOPE('m')} /*EXCLUDE:m*/
RETURN m.filePath AS filePath, m.name AS member, ty.name AS leakedType, ty.filePath AS target,
       m.layer AS fromLayer, ty.layer AS toLayer, u.positions AS positions, u.inferred AS inferred
ORDER BY filePath, member, leakedType`,
  ['controllerLayer', 'applicationLayers', 'infraLayer', 'compositionRootLayers', 'compositionRootPatterns', 'testPatterns'], ['infrastructure'], 'structural',
  'Public members of the controller or application layers whose signatures expose an infrastructure type',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: '{member} exposes infrastructure type {leakedType} ({positions})',
    discriminatorColumns: ['member', 'leakedType'], metadataColumns: ['member', 'leakedType', 'fromLayer', 'toLayer', 'positions', 'inferred'] }),

  // (2) Acyclic dependencies principle at component level (Martin 2017 ch. 14): a DEPENDS_ON edge on a cycle, between
  // modules or folders only. A cycle between layers is reported once, at its backward import, by FF-S01 / FF-S02.
  t('component-adp-cycle', `MATCH (a:Component)-[d:DEPENDS_ON]->(b:Component)
WHERE d.kind <> 'layer' AND EXISTS { MATCH (b)-[:DEPENDS_ON*1..]->(a) }
RETURN a.name AS component, b.name AS target, d.kind AS kind, d.imports AS imports, a.name AS filePath
ORDER BY kind, component, target`,
  [], [], 'topological',
  'Dependencies between modules or folders that lie on a component-level cycle (ADP)',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: 'Component {component} depends on {target}, which depends back on it ({kind})',
    discriminatorColumns: ['kind', 'component', 'target'], metadataColumns: ['component', 'target', 'kind', 'imports'] }),

  // (2) Stable dependencies principle: a dependency from a more stable to a less stable component (I(a) < I(b)).
  t('component-sdp-violation', `MATCH (a:Component)-[d:DEPENDS_ON]->(b:Component)
WHERE a.instability IS NOT NULL AND b.instability IS NOT NULL AND a.instability < b.instability
RETURN a.name AS component, b.name AS target, d.kind AS kind, a.instability AS fromInstability, b.instability AS toInstability, a.name AS filePath
ORDER BY kind, component, target`,
  [], [], 'topological',
  'Component dependencies that point from a more stable to a less stable component (SDP)',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: 'Component {component} (I={fromInstability}) depends on less stable {target} (I={toInstability})',
    discriminatorColumns: ['kind', 'component', 'target'], metadataColumns: ['component', 'target', 'kind'], evidenceColumns: ['fromInstability', 'toInstability'] }),

  // (2) Distance from the main sequence D = |A + I - 1| above a threshold (zone of pain / zone of uselessness), on
  // modules and folders with at least $minTypes types; a layer's stability is prescribed by the style.
  t('component-main-sequence-distance', `MATCH (c:Component)
WHERE c.kind <> 'layer' AND c.typeCount >= $minTypes
  AND c.distance IS NOT NULL AND c.distance > $threshold
RETURN c.name AS component, c.kind AS kind, c.abstractness AS abstractness, c.instability AS instability, c.distance AS distance, c.name AS filePath
ORDER BY kind, component`,
  ['threshold', 'minTypes'], [], 'topological',
  'Modules and folders (with enough types for abstractness) whose distance from the main sequence exceeds the threshold',
  { filePathColumn: 'filePath', messageTemplate: 'Component {component} is {distance} from the main sequence (A={abstractness}, I={instability})',
    discriminatorColumns: ['kind', 'component'], metadataColumns: ['component', 'kind'], evidenceColumns: ['abstractness', 'instability', 'distance'] }),

  // (2b) Deep import into a component whose public API the spec declares (blocking) or that only has an inferred
  // public API (index / barrel files; advisory). Parnas 1972 information hiding.
  t('deep-import-declared-api', `MATCH (s:File)-[d:DEEP_IMPORT]->(tf:File)
WHERE d.publicApiDeclared = true
  AND ${COMPOSITION_ROOT_SCOPE('s')}
  AND ${TEST_SCOPE('s')}
  AND ${ACL_SCOPE('s', 'd')} /*EXCLUDE:s*/
RETURN s.filePath AS filePath, tf.filePath AS target, d.component AS component, d.kind AS kind, d.line AS line
ORDER BY filePath, target`,
  DEEP_IMPORT_SCOPE_PARAMS, [], 'structural',
  'Imports of a non-public file of a component whose public API the spec declares',
  { filePathColumn: 'filePath', targetColumn: 'target', lineColumn: 'line', messageTemplate: '{filePath} imports {target}, which is not in the public API of {component}',
    discriminatorColumns: ['component'], metadataColumns: ['component', 'kind'] }),
  t('deep-import-inferred-api', `MATCH (s:File)-[d:DEEP_IMPORT]->(tf:File)
WHERE d.publicApiDeclared = false
  AND ${COMPOSITION_ROOT_SCOPE('s')}
  AND ${TEST_SCOPE('s')}
  AND ${ACL_SCOPE('s', 'd')} /*EXCLUDE:s*/
RETURN s.filePath AS filePath, tf.filePath AS target, d.component AS component, d.kind AS kind, d.line AS line
ORDER BY filePath, target`,
  DEEP_IMPORT_SCOPE_PARAMS, [], 'structural',
  'Imports of a non-entry file of a component whose entry files (index, barrels) are inferred',
  { filePathColumn: 'filePath', targetColumn: 'target', lineColumn: 'line', messageTemplate: '{filePath} bypasses the entry files of {component} to import {target}',
    discriminatorColumns: ['component'], metadataColumns: ['component', 'kind'] }),

  // (4) Undeclared async coupling: a publisher and a subscriber of one channel in different components of one kind,
  // when "subscriber->publisher" is not in $allowedAsync. Hohpe & Woolf 2003.
  t('undeclared-async-coupling', `MATCH (p)-[:PUBLISHES]->(ch:Channel)<-[:SUBSCRIBES]-(s)
MATCH (pf:File {filePath: p.filePath})-[:BELONGS_TO]->(pc:Component)
MATCH (sf:File {filePath: s.filePath})-[:BELONGS_TO]->(sc:Component)
WHERE pc.kind = sc.kind AND pc <> sc AND NOT (sc.name + '->' + pc.name) IN $allowedAsync
  AND ${TEST_SCOPE('p')} AND ${TEST_SCOPE('s')}
RETURN DISTINCT p.filePath AS filePath, sc.name AS subscriberComponent, pc.name AS publisherComponent, pc.kind AS kind,
       ch.transport AS transport, ch.name AS channel, s.filePath AS target
ORDER BY kind, filePath, channel, target`,
  ['allowedAsync', 'testPatterns'], [], 'structural',
  'Publisher / subscriber pairs of a channel across components that the spec does not allow to be coupled',
  { filePathColumn: 'filePath', targetColumn: 'target', messageTemplate: '{subscriberComponent} reacts to {transport} channel {channel} published by {publisherComponent}',
    discriminatorColumns: ['kind', 'channel', 'subscriberComponent', 'publisherComponent'], metadataColumns: ['subscriberComponent', 'publisherComponent', 'kind', 'transport', 'channel'] }),

  // (5) I/O at the edges (Cockburn 2005; Martin 2017 ch. 22): db / http-out / fs in the domain or application layers.
  t('io-outside-adapters', ioTemplate(`['db', 'http-out', 'fs']`),
  ['domainLayer', 'applicationLayers', 'testPatterns'], ['domain'], 'structural',
  'Domain or application members that perform database, outbound HTTP or file-system I/O',
  { filePathColumn: 'filePath', lineColumn: 'line', linesColumn: 'lines', messageTemplate: '{member} ({layer}) performs {category} I/O: {apis}',
    discriminatorColumns: ['member', 'category'], metadataColumns: ['member', 'layer', 'category', 'apis'] }),
  // (5) Nondeterminism in the core: clock, random, environment or process access in the domain or application layers.
  t('nondeterminism-in-core', ioTemplate(`['clock', 'random', 'env', 'process']`),
  ['domainLayer', 'applicationLayers', 'testPatterns'], ['domain'], 'pattern-proxy',
  'Domain or application members that read the clock, randomness, the environment or the process',
  { filePathColumn: 'filePath', lineColumn: 'line', linesColumn: 'lines', messageTemplate: '{member} ({layer}) reads {category}: {apis}',
    discriminatorColumns: ['member', 'category'], metadataColumns: ['member', 'layer', 'category', 'apis'] }),
]);

/** A priori tiers of the APG v2 templates, with the construct reason (see the design document). */
export const APG2_TEMPLATE_TIERS: ReadonlyMap<string, { readonly tier: RuleTier; readonly reason: string }> = new Map([
  ['boundary-type-leak', { tier: 'blocking', reason: 'The dependency rule, checked as a signature fact: an exposing layer names an infrastructure type' }],
  ['component-adp-cycle', { tier: 'blocking', reason: 'Acyclic dependencies principle at component level; a structural fact' }],
  ['component-sdp-violation', { tier: 'advisory', reason: 'Compares two instability metrics' }],
  ['component-main-sequence-distance', { tier: 'advisory', reason: 'Metric threshold' }],
  ['deep-import-declared-api', { tier: 'blocking', reason: 'Declared public API (information hiding) bypassed; a structural fact against a declaration' }],
  ['deep-import-inferred-api', { tier: 'advisory', reason: 'The public API is inferred from index / barrel files, a convention' }],
  ['undeclared-async-coupling', { tier: 'advisory', reason: 'Channel names are string literals keyed by name only (one channel per name); a heuristic of runtime coupling' }],
  ['io-outside-adapters', { tier: 'blocking', reason: 'I/O at the edges: db, outbound HTTP and fs in the core break core isolation' }],
  ['nondeterminism-in-core', { tier: 'advisory', reason: 'Clock, randomness and environment reads are a testability guideline, not a defining constraint' }],
]);
