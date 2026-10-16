/**
 * v1.3 metadata of a rule as the MCP v2 tools report it with every finding: the tier (`Docs/v1.3/rule-tiers.md`
 * through `ruleTier`), the construct the rule encodes, the literature source line (`Docs/v1.3/style-rule-sources.md`,
 * held here as data; `tests/unit/mcp-server/rule-meta.test.ts` parses the document and fails when the two disagree),
 * the edge view the full evaluation reads (`Docs/v1.3/edge-views.md`), and the v1.3 status of the rule for a spec, which
 * is the compiler's own decision under `V13_COMPILE_OPTIONS` (style applicability, ADR-V13-02 draft). Pure.
 */
import type { FitnessFunction, ParsedSpec } from '../shared/types/spec.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../fitness-compiler/compiler-input.js';
import { edgeViewOf } from '../fitness-compiler/edge-views.js';
import type { EdgeView } from '../fitness-compiler/edge-views.js';
import { APG2_TEMPLATE_TIERS } from '../fitness-compiler/apg2-templates.js';
import { ruleTier } from '../scoring-engine/rule-tiers.js';
import type { RuleTier } from '../scoring-engine/rule-tiers.js';
import { ruleState } from './spec-rules.js';
import type { RuleStatus } from './types.js';

/** One row of `Docs/v1.3/style-rule-sources.md` (style, rule, source, constraint), verbatim. */
export interface StyleRuleSource {
  readonly style: string;
  readonly rule: string;
  readonly source: string;
  readonly constraint: string;
}

/** The rows of `Docs/v1.3/style-rule-sources.md`, in document order (pinned by a test against the document). */
export const STYLE_RULE_SOURCES: readonly StyleRuleSource[] = Object.freeze([
  { style: 'Clean', rule: 'Dependency direction (FF-S01)', source: 'Martin, *Clean Architecture* (2017), ch. 22 "The Clean Architecture", the Dependency Rule', constraint: 'Source-code dependencies point only inward. Nothing in an inner circle knows anything about an outer circle.' },
  { style: 'Clean', rule: 'Domain purity (FF-P01)', source: 'Martin 2017, ch. 22; ch. 32 "Frameworks are details"', constraint: 'Entities and use cases do not depend on frameworks, databases or the UI.' },
  { style: 'Clean', rule: 'Repository / gateway placement (FF-P03)', source: 'Martin 2017, ch. 22 (interface adapters); ch. 11 (DIP)', constraint: 'The data-access interface is owned by the inner layer, and the implementation lives in the outer layer (dependency inversion across the boundary).' },
  { style: 'Clean, Layered', rule: 'Acyclic dependencies (FF-S02)', source: 'Martin 2017, ch. 14 "Component Coupling", ADP', constraint: 'The component dependency graph has no cycles.' },
  { style: 'Layered', rule: 'Downward-only, no skipping when strict (FF-S01, FF-S03)', source: 'Fowler, *Patterns of Enterprise Application Architecture* (2002), ch. 1 "Layering"; Buschmann et al., *POSA vol. 1* (1996), Layers pattern', constraint: 'A higher layer uses services of lower layers, and lower layers do not use upper ones. Strict layering also forbids skipping a layer.' },
  { style: 'Hexagonal', rule: 'Core isolation, dependency direction (FF-S04, dependency-direction-graph, core-isolation)', source: 'Cockburn, "Hexagonal Architecture" (2005)', constraint: 'The application core communicates with the outside only through ports. It does not depend on adapters, UI or databases.' },
  { style: 'Hexagonal', rule: 'Port-adapter (port-adapter-pattern)', source: 'Cockburn 2005', constraint: 'Each external actor talks to the application through a port. Adapters convert between the port and the technology; secondary (driven) adapters implement ports the core defines.' },
  { style: 'DDD', rule: 'Aggregate boundary', source: 'Evans, *Domain-Driven Design* (2003), ch. 6 "Aggregates"; Vernon, *Implementing DDD* (2013), ch. 10', constraint: 'Objects outside the aggregate may hold references only to the root. Inner entities are reached through the root.' },
  { style: 'DDD', rule: 'Repository only for aggregate roots', source: 'Evans 2003, ch. 6 "Repositories"; Vernon 2013, ch. 12', constraint: 'Repositories are provided only for aggregate roots that actually need direct access.' },
  { style: 'DDD', rule: 'Value-object immutability', source: 'Evans 2003, ch. 5 "Value Objects"; Vernon 2013, ch. 6', constraint: 'A value object is treated as immutable. Replace it rather than modify it.' },
  { style: 'DDD', rule: 'Isolated domain (framework-free)', source: 'Evans 2003, ch. 4 "Isolating the Domain" (Layered Architecture)', constraint: 'Domain code is separated from UI, application and infrastructure concerns.' },
  { style: 'DDD', rule: 'Bounded-context isolation', source: 'Evans 2003, ch. 14 "Maintaining Model Integrity" (Bounded Context, Context Map, Anticorruption Layer); Vernon 2013, ch. 2–3', constraint: 'Each model applies within an explicit boundary. Integration across contexts is explicit, through a published interface, or translated by an anticorruption layer.' },
  { style: 'NestJS', rule: 'Module boundaries and DI (style preset)', source: 'NestJS documentation, "Modules", "Providers"', constraint: 'Providers are encapsulated in modules. Other modules use only what a module exports.' },
]);

const row = (rule: string): StyleRuleSource => {
  const r = STYLE_RULE_SOURCES.find((x) => x.rule === rule);
  if (r === undefined) throw new Error(`rule-meta: no style-rule-sources row "${rule}"`);
  return r;
};

/** Spec style (`architecture.style`) to the style column of the sources table. */
const STYLE_COLUMN: Readonly<Record<string, string>> = {
  'clean-architecture': 'Clean',
  layered: 'Layered',
  hexagonal: 'Hexagonal',
  ddd: 'DDD',
  nestjs: 'NestJS',
};

/**
 * Which row of the sources table states the construct of a template under a style. A style without its own row for a
 * template takes the row of the style its preset composes (nestjs and an unstyled spec: Clean; ddd's composed
 * hexagonal layering: Hexagonal), reported as `sourceRow: 'composed'`.
 */
const SOURCE_ROWS: readonly { readonly styles: readonly string[]; readonly templates: readonly string[]; readonly row: string }[] = [
  { styles: ['Clean'], templates: ['dependency-direction'], row: 'Dependency direction (FF-S01)' },
  { styles: ['Clean'], templates: ['domain-purity'], row: 'Domain purity (FF-P01)' },
  { styles: ['Clean'], templates: ['repository-pattern'], row: 'Repository / gateway placement (FF-P03)' },
  { styles: ['Clean', 'Layered'], templates: ['no-cyclic-deps'], row: 'Acyclic dependencies (FF-S02)' },
  { styles: ['Layered'], templates: ['dependency-direction', 'no-layer-skip'], row: 'Downward-only, no skipping when strict (FF-S01, FF-S03)' },
  { styles: ['Hexagonal'], templates: ['no-domain-outward-dep', 'dependency-direction-graph', 'core-isolation'], row: 'Core isolation, dependency direction (FF-S04, dependency-direction-graph, core-isolation)' },
  { styles: ['Hexagonal'], templates: ['port-adapter-pattern'], row: 'Port-adapter (port-adapter-pattern)' },
  { styles: ['DDD'], templates: ['aggregate-boundary'], row: 'Aggregate boundary' },
  { styles: ['DDD'], templates: ['repository-aggregate-root'], row: 'Repository only for aggregate roots' },
  { styles: ['DDD'], templates: ['value-object-immutability'], row: 'Value-object immutability' },
  { styles: ['DDD'], templates: ['domain-purity'], row: 'Isolated domain (framework-free)' },
  { styles: ['DDD'], templates: ['context-isolation', 'bounded-context-modules'], row: 'Bounded-context isolation' },
];

/** The style whose rows a style without its own row borrows. */
const COMPOSED: Readonly<Record<string, readonly string[]>> = {
  NestJS: ['Clean'],
  DDD: ['Hexagonal', 'Clean'],
  Hexagonal: ['Clean'],
  Layered: ['Clean'],
};

/** Literature of rules the sources table has no row for (advisory rules, APG v2 and cheap proxies). */
const OTHER_SOURCES: Readonly<Record<string, string>> = {
  'no-domain-outward-dep': 'Martin 2017, ch. 22 (the Dependency Rule applied to the core); rule-tiers.md "Core isolation"',
  'domain-state-purity': 'Martin 2017, ch. 22 (the Dependency Rule; entities hold no outer-circle state); rule-tiers.md "Core isolation of state"',
  'no-layer-skip': 'Fowler 2002, ch. 1 "Layering" (only strict layering forbids skipping); rule-tiers.md',
  'layer-skip-graph': 'Cockburn 2005 (adapters talk to the core, not to each other); rule-tiers.md: hexagonal does not define strict layering',
  'dependency-inversion': 'Martin 2017, ch. 11 "DIP" (a ratio with a threshold, so a proxy)',
  'port-dependency-inversion': 'Martin 2017, ch. 11 "DIP"; Cockburn 2005 (a ratio with a threshold, so a proxy)',
  'use-case-isolation': 'Martin 2017, ch. 20 "Business Rules" (use cases); a design guideline',
  'controller-no-entity': 'Fowler 2002, "Data Transfer Object"; a guideline, styles differ on it',
  'domain-event-placement': 'Evans 2003; Vernon 2013, ch. 8 "Domain Events" (placement guideline)',
  'application-service-thin': 'Evans 2003, ch. 4 (application layer is thin); Vernon 2013, ch. 14 (heuristic)',
  'domain-stability': 'Martin 2017, ch. 14 (SDP); Martin 1994 (metric threshold)',
  'module-fan-out': 'Martin 2017, ch. 14 (coupling); metric threshold',
  'component-instability': 'Martin 2017, ch. 14 (instability I); metric threshold',
  'no-orphan-files': 'Project convention (connectivity of modules)',
  'max-fan-in': 'Martin 2017, ch. 14 (coupling); metric threshold',
  'abstraction-ratio': 'Martin 2017, ch. 14 (SAP, abstractness A); metric threshold',
  'single-responsibility-proxy': 'Martin 2017, ch. 7 "SRP" (proxy)',
  'interface-segregation-proxy': 'Martin 2017, ch. 10 "ISP" (proxy)',
  'inheritance-depth': 'Chidamber and Kemerer 1994 (DIT; proxy)',
  'naming-conventions': 'Project naming convention',
  'naming-services': 'Project naming convention',
  'naming-repos': 'Project naming convention',
  'naming-controllers': 'Project naming convention',
  'test-file-pairing': 'Project convention',
  'no-index-logic': 'Project convention (barrels hold no logic)',
  'architectural-integrity': 'LLM judgement (FF-N01; reported, non-blocking in v1.3)',
  'intent-alignment': 'LLM judgement (FF-N02; reported, non-blocking in v1.3)',
  'boundary-type-leak': 'Parnas (1972), information hiding; Martin 2017, ch. 22 (no entity or database row crosses a boundary outward)',
  'deep-import-declared-api': 'Parnas (1972), information hiding: other modules rely on the interface, never the secret behind it',
  'deep-import-inferred-api': 'Parnas (1972), information hiding (inferred public API: index or barrel convention)',
  'io-outside-adapters': 'Cockburn 2005 (adapters do the I/O); Martin 2017, ch. 22 (frameworks, databases and the web are details)',
  'nondeterminism-in-core': 'Cockburn 2005; Martin 2017, ch. 22 (clock, random and environment reads are hidden inputs; a testability guideline)',
  'repository-bypass': 'Evans 2003, ch. 6 "Repositories"; Fowler 2002, "Repository" (clients go through the repository, not the persistence technology)',
  'framework-in-core': 'Martin 2017, ch. 32 "Frameworks are details"; Cockburn 2005 (the use case does not know the delivery mechanism)',
};

/** The construct each template checks (a short name for the agent and the report). */
export const CONSTRUCTS: Readonly<Record<string, string>> = Object.freeze({
  'dependency-direction': 'Dependency rule: dependencies point inward/downward only',
  'dependency-direction-graph': 'Dependency rule over the allowed-dependency graph (adapters depend on ports, never the reverse)',
  'no-cyclic-deps': 'Acyclic dependencies principle',
  'no-layer-skip': 'Strict layering: no skipping a layer',
  'layer-skip-graph': 'No sideways step between layers with no allowed dependency',
  'no-domain-outward-dep': 'Core isolation: the domain depends on no other layer',
  'core-isolation': 'Core isolation: the core depends on no adapter, UI or database',
  'domain-purity': 'Framework-free domain',
  'domain-state-purity': 'Core isolation of state: the domain holds no infrastructure object',
  'dependency-inversion': 'Dependency inversion ratio (proxy)',
  'port-dependency-inversion': 'Use cases depend on ports (ratio proxy)',
  'repository-pattern': 'Repository port in the core, implementation outside',
  'port-adapter-pattern': 'Driven adapters implement ports the core or application declares',
  'use-case-isolation': 'Use-case isolation (guideline)',
  'controller-no-entity': 'DTOs at the boundary (guideline)',
  'bounded-context-modules': 'Explicit bounded-context boundaries',
  'context-isolation': 'Bounded-context isolation: cross-context imports only through the published API or an ACL',
  'aggregate-boundary': 'Aggregate boundary: only the root is referenced from outside',
  'repository-aggregate-root': 'Repositories for aggregate roots only',
  'value-object-immutability': 'Value-object immutability',
  'domain-event-placement': 'Domain events defined in the domain (guideline)',
  'application-service-thin': 'Thin application services (heuristic)',
  'naming-services': 'Naming convention (services)',
  'naming-repos': 'Naming convention (repositories)',
  'naming-controllers': 'Naming convention (controllers)',
  'boundary-type-leak': 'Information hiding: no infrastructure type in an exposing signature',
  'deep-import-declared-api': "Information hiding: imports go through a component's declared public API",
  'deep-import-inferred-api': "Information hiding: imports go through a component's entry file (inferred)",
  'io-outside-adapters': 'I/O at the edges: db, outbound HTTP and fs only in adapters',
  'nondeterminism-in-core': 'Deterministic core: clock, random and environment reads injected',
  'repository-bypass': 'Persistence through the repository (cheap proxy)',
  'framework-in-core': 'Frameworks are details: no framework type in a core signature (cheap proxy)',
});

export interface RuleMeta {
  /** Spec id (`FF-S01`) or, for the APG v2 and cheap-proxy hints, `APG2.<template>` / `CHEAP.<proxy>`. */
  readonly ruleId: string;
  readonly ruleName: string;
  readonly tier: RuleTier;
  /** `table`: rule-tiers.md; `untiered-default`: an id the table does not list (advisory by default); `hint`: APG v2 / cheap proxy, advisory by design. */
  readonly tierSource: 'table' | 'untiered-default' | 'hint';
  /** APG v2 only: the tier `APG2_TEMPLATE_TIERS` proposes (not in force until an ADR adds it to the sealed table). */
  readonly candidateTier?: RuleTier;
  readonly construct: string;
  /** Literature source line (from style-rule-sources.md where it has a row). */
  readonly source: string;
  /** `style`: a row for the spec's style; `composed`: the row of the style the preset composes; `other`: outside the table. */
  readonly sourceRow: 'style' | 'composed' | 'other';
  /** The edge view the full evaluation reads for this rule (ADR-V13-01); `none` for a rule that reads no import edge. */
  readonly edgeView: EdgeView;
}

function sourceFor(style: string | undefined, template: string): { source: string; sourceRow: RuleMeta['sourceRow'] } {
  const column = STYLE_COLUMN[(style ?? '').toLowerCase()] ?? 'Clean';
  const find = (col: string): StyleRuleSource | undefined => {
    const r = SOURCE_ROWS.find((x) => x.styles.includes(col) && x.templates.includes(template));
    return r === undefined ? undefined : row(r.row);
  };
  const own = find(column);
  if (own !== undefined) return { source: `${own.source}. ${own.constraint}`, sourceRow: 'style' };
  for (const col of COMPOSED[column] ?? []) {
    const r = find(col);
    if (r !== undefined) return { source: `${r.source}. ${r.constraint} (${col} row; the ${column} preset composes it)`, sourceRow: 'composed' };
  }
  return { source: OTHER_SOURCES[template] ?? 'No literature row; see Docs/v1.3/rule-tiers.md', sourceRow: 'other' };
}

/** Metadata of a spec rule under the spec's style. */
export function specRuleMeta(spec: Pick<ParsedSpec, 'style'>, ff: { readonly id: string; readonly name: string }): RuleMeta {
  return ruleMetaFor(spec.style, ff);
}

/** Metadata of a rule under a style (`undefined`: no style declared). */
export function ruleMetaFor(style: string | undefined, ff: { readonly id: string; readonly name: string }): RuleMeta {
  const t = ruleTier(ff.id, style);
  return {
    ruleId: ff.id,
    ruleName: ff.name,
    tier: t.tier,
    tierSource: t.source,
    construct: CONSTRUCTS[ff.name] ?? ff.name,
    ...sourceFor(style, ff.name),
    edgeView: edgeViewOf(ff.name) ?? 'none',
  };
}

/** Metadata of an APG v2 fast check or a cheap-proxy hint: always advisory here. */
export function hintMeta(kind: 'apg2' | 'cheap', name: string): RuleMeta {
  const candidate = kind === 'apg2' ? APG2_TEMPLATE_TIERS.get(name)?.tier : undefined;
  return {
    ruleId: `${kind === 'apg2' ? 'APG2' : 'CHEAP'}.${name}`,
    ruleName: name,
    tier: 'advisory',
    tierSource: 'hint',
    ...(candidate !== undefined ? { candidateTier: candidate } : {}),
    construct: CONSTRUCTS[name] ?? name,
    source: OTHER_SOURCES[name] ?? '',
    sourceRow: 'other',
    edgeView: name.startsWith('deep-import') || name === 'boundary-type-leak' ? 'literal' : 'none',
  };
}

export interface V13RuleState {
  readonly status: RuleStatus;
  readonly statusReason?: string;
}

const stateCache = new WeakMap<ParsedSpec, ReadonlyMap<string, V13RuleState>>();

/**
 * The v1.3 status of every function of the spec: what `compileFunctions(…, V13_COMPILE_OPTIONS)` disables (spec
 * `enabled: false`, frozen applicability, the v1.3 style-applicability table) is `disabled` or `not-applicable`.
 * When the spec does not compile, the frozen `ruleState` is used.
 */
export function v13RuleStates(spec: ParsedSpec): ReadonlyMap<string, V13RuleState> {
  const cached = stateCache.get(spec);
  if (cached !== undefined) return cached;
  const out = new Map<string, V13RuleState>();
  const compiled = compileFunctions(compilerInputFromSpec(spec), V13_COMPILE_OPTIONS);
  const disabled = compiled.success ? new Map(compiled.data.disabledFunctions.map((d) => [String(d.id), d.reason])) : undefined;
  for (const ff of spec.fitnessFunctions) {
    const id = String(ff.id);
    if (!ff.enabled) {
      out.set(id, { status: 'disabled', ...(ff.disabledReason !== undefined ? { statusReason: ff.disabledReason } : {}) });
    } else if (disabled === undefined) {
      const s = ruleState(spec, ff);
      out.set(id, { status: s.status, ...(s.statusReason !== undefined ? { statusReason: s.statusReason } : {}) });
    } else if (disabled.has(id)) {
      const reason = disabled.get(id);
      out.set(id, { status: 'not-applicable', ...(reason !== undefined ? { statusReason: reason } : {}) });
    } else {
      out.set(id, { status: 'active' });
    }
  }
  stateCache.set(spec, out);
  return out;
}

/** True when the function is active under v1.3 for this spec. */
export function v13Active(spec: ParsedSpec, ff: FitnessFunction): boolean {
  return v13RuleStates(spec).get(String(ff.id))?.status === 'active';
}
