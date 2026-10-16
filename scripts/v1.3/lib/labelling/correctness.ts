/**
 * v1.3 labelling: the deterministic CORRECTNESS checker (Docs/v1.3/validation-protocol.md §3, "correct").
 *
 * A finding is *correct* when the condition its rule states holds in the code and the spec. Each template's
 * condition is re-checked here from the source (`SourceFacts`, TypeScript compiler API) and the spec's globs
 * (`SpecView`), never from the graph:
 *   - an edge rule: an import or export statement exists at the finding's file and line, of the finding's relation
 *     (import or re-export), and its specifier resolves (`ts.resolveModuleName`) to the target — literally (the
 *     file the specifier names) or, for the resolved-view templates of Docs/v1.3/edge-views.md, through re-exports
 *     to the file declaring an imported name; then the layer, context or role condition on both ends, from globs;
 *   - a cycle: every consecutive pair of the listed files is joined by an import that resolves to the next file;
 *   - a placement or declaration rule: the class exists in the file, and its `implements` clause, constructor
 *     parameter type or method list is what the rule says.
 * The output is correct / incorrect / not-checkable, with the reason. The checker never reads the rule's text: it
 * encodes the condition each template's Cypher computes.
 */
import type { Finding } from './findings.js';
import type { ImportFact, SourceFacts } from './source-facts.js';
import type { SpecView } from './spec-facts.js';
import { contextOf, forbiddenMatch, globMatch, namePatternRegex, useCaseLayers } from './spec-facts.js';

export type CorrectnessVerdict = 'correct' | 'incorrect' | 'not-checkable';

export interface CorrectnessResult {
  readonly key: string;
  readonly projectId: string;
  readonly ruleId: string;
  readonly template: string;
  readonly tier: string;
  readonly file: string;
  readonly verdict: CorrectnessVerdict;
  readonly reason: string;
  /** The facts established on the way (for the review sheet). */
  readonly checks: readonly string[];
}

interface Ctx {
  readonly f: Finding;
  readonly spec: SpecView;
  readonly src: SourceFacts;
  readonly checks: string[];
}

interface Outcome { readonly verdict: CorrectnessVerdict; readonly reason: string }
const ok = (reason: string): Outcome => ({ verdict: 'correct', reason });
const no = (reason: string): Outcome => ({ verdict: 'incorrect', reason });
const na = (reason: string): Outcome => ({ verdict: 'not-checkable', reason });

type View = 'literal' | 'resolved';

/** Which edge view a template reads (Docs/v1.3/edge-views.md); package targets are matched by package root. */
export const TEMPLATE_VIEWS: Readonly<Record<string, View>> = Object.freeze({
  'dependency-direction': 'literal',
  'no-layer-skip': 'literal',
  'no-domain-outward-dep': 'literal',
  'dependency-direction-graph': 'literal',
  'layer-skip-graph': 'literal',
  'core-isolation': 'literal',
  'context-isolation': 'literal',
  'domain-purity': 'resolved',
  'aggregate-boundary': 'resolved',
  'repository-aggregate-root': 'resolved',
});

/** The line the finding claims (FR-12 `line`); `lines` only when there is no `line`. */
function claimedLines(f: Finding): readonly number[] {
  return f.line !== undefined ? [f.line] : f.lines ?? [];
}

function relTypeOf(f: Finding): string | undefined {
  return f.discriminator.find((d) => d === 'IMPORTS' || d === 'RE_EXPORTS');
}

/** The statement at the finding's line that reaches `f.target` under `view`, or the reason none does. */
function findEdge(c: Ctx, view: View): { fact: ImportFact; how: string } | { reason: string } {
  const { f, src } = c;
  if (!src.exists(f.file)) return { reason: `file ${f.file} does not exist` };
  if (f.target === undefined) return { reason: 'the finding names no target' };
  const lines = claimedLines(f);
  const rel = relTypeOf(f);
  const candidates = src.importsAt(f.file, lines).filter((s) => rel === undefined || s.kind === rel);
  if (candidates.length === 0) {
    return { reason: `no ${rel === 'RE_EXPORTS' ? 're-export' : 'import'} statement at ${f.file}:${lines.length === 0 ? '?' : lines.join(',')}` };
  }
  for (const s of candidates) {
    if (s.resolvedFile === f.target) return { fact: s, how: `'${s.specifier}' at line ${String(s.startLine)} resolves to ${f.target}` };
  }
  if (view === 'resolved') {
    for (const s of candidates) {
      const decl = src.declaringFiles(s);
      if (decl.includes(f.target)) return { fact: s, how: `'${s.specifier}' at line ${String(s.startLine)} imports a name declared in ${f.target} (through ${s.resolvedFile ?? 'a re-export'})` };
    }
  }
  const seen = candidates.map((s) => `'${s.specifier}' -> ${s.resolvedFile ?? s.packageRoot ?? 'unresolved'}`).join('; ');
  return { reason: `the statement(s) at that line do not reach ${f.target} (${view} view): ${seen}` };
}

function edge(c: Ctx, view: View): Outcome | ImportFact {
  const e = findEdge(c, view);
  if ('reason' in e) return no(e.reason);
  c.checks.push(e.how);
  return e.fact;
}

function layers(c: Ctx): { src: string | null; tgt: string | null } {
  const src = c.spec.layerOf(c.f.file);
  const tgt = c.f.target !== undefined ? c.spec.layerOf(c.f.target) : null;
  c.checks.push(`layers by spec globs: ${c.f.file} -> ${src ?? 'none'}; ${c.f.target ?? '?'} -> ${tgt ?? 'none'}`);
  return { src, tgt };
}

// ── Edge rules ──────────────────────────────────────────────────────────────

function dependencyDirection(c: Ctx): Outcome {
  const e = edge(c, 'literal');
  if ('verdict' in e) return e;
  const { src, tgt } = layers(c);
  if (src === null || tgt === null) return no('an end of the edge is in no layer');
  if (src === tgt) return no(`both ends are in layer ${src}`);
  const si = c.spec.order.indexOf(src);
  const ti = c.spec.order.indexOf(tgt);
  return si < ti ? ok(`${src} (position ${String(si)}) imports ${tgt} (position ${String(ti)}), against the spec's layer order`)
    : no(`${src} (position ${String(si)}) importing ${tgt} (position ${String(ti)}) follows the layer order`);
}

function noLayerSkip(c: Ctx): Outcome {
  const e = edge(c, 'literal');
  if ('verdict' in e) return e;
  const { src, tgt } = layers(c);
  if (src === null || tgt === null) return no('an end of the edge is in no layer');
  if (src === tgt) return no(`both ends are in layer ${src}`);
  const si = c.spec.order.indexOf(src);
  const ti = c.spec.order.indexOf(tgt);
  return si === ti + 1 ? no(`${src} -> ${tgt} is the adjacent downward step the spec allows`)
    : ok(`${src} -> ${tgt} is not the adjacent downward step (positions ${String(si)} -> ${String(ti)})`);
}

function domainOutward(c: Ctx): Outcome {
  const e = edge(c, 'literal');
  if ('verdict' in e) return e;
  const domain = c.spec.domainLayer;
  if (domain === undefined) return na('the spec binds no domain layer');
  const { src, tgt } = layers(c);
  if (src !== domain) return no(`${c.f.file} is not in the domain layer ${domain} (it is in ${src ?? 'none'})`);
  if (tgt === null) return no(`${c.f.target ?? '?'} is in no layer`);
  return tgt !== domain ? ok(`domain file imports ${tgt}`) : no('the target is in the domain layer too');
}

function allowedEdges(c: Ctx): Outcome | { src: string; tgt: string; fwd: boolean; back: boolean } {
  const e = edge(c, 'literal');
  if ('verdict' in e) return e;
  if (c.spec.allowed.size === 0) return na('the spec declares no allowed_dependencies');
  const { src, tgt } = layers(c);
  if (src === null || tgt === null) return no('an end of the edge is in no layer');
  if (src === tgt) return no(`both ends are in layer ${src}`);
  return { src, tgt, fwd: c.spec.allowed.has(`${src}>${tgt}`), back: c.spec.allowed.has(`${tgt}>${src}`) };
}

function dependencyDirectionGraph(c: Ctx): Outcome {
  const a = allowedEdges(c);
  if ('verdict' in a) return a;
  if (a.fwd) return no(`${a.src} -> ${a.tgt} is an allowed dependency`);
  return a.back ? ok(`${a.src} -> ${a.tgt} runs against the allowed edge ${a.tgt} -> ${a.src}`)
    : no(`no allowed edge either way between ${a.src} and ${a.tgt} (that is a sideways step, not a direction breach)`);
}

function layerSkipGraph(c: Ctx): Outcome {
  const a = allowedEdges(c);
  if ('verdict' in a) return a;
  return !a.fwd && !a.back ? ok(`no allowed edge either way between ${a.src} and ${a.tgt}`) : no(`an allowed edge joins ${a.src} and ${a.tgt}`);
}

function domainPurity(c: Ctx): Outcome {
  const { f, spec, src } = c;
  if (!src.exists(f.file)) return no(`file ${f.file} does not exist`);
  if (f.target === undefined) return no('the finding names no package');
  const domain = spec.domainLayer;
  if (domain === undefined) return na('the spec binds no domain layer');
  const forbidden = spec.functions.get(f.ruleId)?.forbiddenImports;
  if (forbidden === undefined || forbidden.length === 0) return na(`the spec gives ${f.ruleId} no forbidden imports`);
  const layer = spec.layerOf(f.file);
  c.checks.push(`layer by spec globs: ${f.file} -> ${layer ?? 'none'}`);
  if (layer !== domain) return no(`${f.file} is not in the domain layer ${domain}`);
  const matched = forbiddenMatch(forbidden, f.target);
  if (matched === undefined) return no(`${f.target} matches no forbidden import`);
  const lines = claimedLines(f);
  const rel = relTypeOf(f);
  const stmts = src.importsAt(f.file, lines).filter((s) => rel === undefined || s.kind === rel);
  if (stmts.length === 0) return no(`no import statement at ${f.file}:${lines.join(',')}`);
  const direct = stmts.find((s) => s.packageRoot === f.target || (s.resolvedFile === undefined && s.specifier === f.target));
  if (direct !== undefined) return ok(`'${direct.specifier}' at line ${String(direct.startLine)} imports ${f.target} (forbidden by '${matched}')`);
  const via = stmts.find((s) => src.packagesReached(s).includes(f.target ?? ''));
  if (via !== undefined) return ok(`'${via.specifier}' at line ${String(via.startLine)} imports a name re-exported from ${f.target} (forbidden by '${matched}')`);
  return no(`the statement(s) at that line do not import ${f.target}: ${stmts.map((s) => `'${s.specifier}'`).join(', ')}`);
}

function parseCycle(f: Finding): string[] | undefined {
  for (const d of f.discriminator) {
    try {
      const v = JSON.parse(d) as unknown;
      if (Array.isArray(v) && v.every((x): x is string => typeof x === 'string')) return v;
    } catch { /* not a JSON list */ }
  }
  const m = /Circular dependency: (\[.*\])/.exec(f.message);
  if (m?.[1] !== undefined) {
    try { return JSON.parse(m[1]) as string[]; } catch { return undefined; }
  }
  return undefined;
}

function cycle(c: Ctx): Outcome {
  const files = parseCycle(c.f);
  if (files === undefined || files.length < 2) return na('the finding does not list the cycle');
  const ring = files[0] === files[files.length - 1] ? files.slice(0, -1) : files;
  for (let i = 0; i < ring.length; i += 1) {
    const from = ring[i] ?? '';
    const to = ring[(i + 1) % ring.length] ?? '';
    if (!c.src.exists(from)) return no(`file ${from} does not exist`);
    const s = c.src.imports(from).find((x) => x.resolvedFile === to);
    if (s === undefined) return no(`no import or re-export in ${from} resolves to ${to}`);
    c.checks.push(`${from}:${String(s.startLine)} '${s.specifier}' -> ${to}`);
  }
  return ok(`every step of the ${String(ring.length)}-file cycle is an import that resolves to the next file`);
}

// ── Declaration rules ───────────────────────────────────────────────────────

function classIn(c: Ctx, name: string | undefined): ReturnType<SourceFacts['classes']>[number] | Outcome {
  if (name === undefined || name === '') return na('the finding names no class');
  if (!c.src.exists(c.f.file)) return no(`file ${c.f.file} does not exist`);
  const cls = c.src.classes(c.f.file).find((k) => k.name === name);
  if (cls === undefined) return no(`no class ${name} in ${c.f.file}`);
  c.checks.push(`class ${name} declared at ${c.f.file}:${String(cls.line)}`);
  return cls;
}

function repositoryPattern(c: Ctx): Outcome {
  const name = c.f.discriminator[0];
  const cls = classIn(c, name);
  if ('verdict' in cls) return cls;
  const infra = c.spec.infraLayer;
  if (infra === undefined) return na('the spec binds no infrastructure layer');
  const layer = c.spec.layerOf(c.f.file);
  if (layer !== infra) return no(`${c.f.file} is in ${layer ?? 'no layer'}, not the infrastructure layer ${infra}`);
  if (!cls.name.includes('Repository') && !cls.name.includes('Repo')) return no(`${cls.name} is not named as a repository`);
  const iface = cls.implementsTypes.find((t) => t.declarations.some((d) => d.kind === 'interface'));
  if (iface !== undefined) return no(`${cls.name} implements the interface ${iface.text} (${iface.declarations.map((d) => d.file).join(', ')})`);
  const unresolved = cls.implementsTypes.filter((t) => t.declarations.length === 0).map((t) => t.text);
  return ok(unresolved.length > 0 ? `${cls.name} implements no project interface (unresolved: ${unresolved.join(', ')})` : `${cls.name} implements no interface`);
}

const ADAPTER_ROLES = ['Repository', 'Repo', 'Adapter', 'Gateway'];

function portAdapter(c: Ctx): Outcome {
  const name = c.f.discriminator[0];
  const cls = classIn(c, name);
  if ('verdict' in cls) return cls;
  const outbound = c.spec.infraLayer;
  const domain = c.spec.domainLayer;
  if (outbound === undefined || domain === undefined) return na('the spec binds no outbound adapter or domain layer');
  const layer = c.spec.layerOf(c.f.file);
  if (layer !== outbound) return no(`${c.f.file} is in ${layer ?? 'no layer'}, not the outbound adapter layer ${outbound}`);
  if (!ADAPTER_ROLES.some((r) => cls.name.includes(r))) return no(`${cls.name} is not named as an adapter (${ADAPTER_ROLES.join(', ')})`);
  const portLayers = [domain, ...useCaseLayers(c.spec)];
  for (const t of cls.implementsTypes) {
    for (const d of t.declarations) {
      if (d.kind !== 'interface') continue;
      const l = c.spec.layerOf(d.file);
      if (l !== null && portLayers.includes(l)) return no(`${cls.name} implements the port ${t.text} declared in ${d.file} (${l})`);
    }
  }
  return ok(`${cls.name} implements no interface declared in ${portLayers.join(' or ')}`);
}

function domainStatePurity(c: Ctx): Outcome {
  const [cls0, targetName = '', relType, field = ''] = c.f.discriminator;
  if (relType === 'FLOWS_TO') return na('FLOWS_TO (field) half: reported N/A by rule-tiers.md (FF-P06, finding 9)');
  if (relType === 'HOLDS_STATE_OF') return na('HOLDS_STATE_OF (field) half: the field-state variant of the N/A half (rule-tiers.md, FF-P06)');
  if (relType !== 'CONSTRUCTOR_INJECTS') return na(`unknown relation ${relType ?? '?'}`);
  const cls = classIn(c, cls0);
  if ('verdict' in cls) return cls;
  const domain = c.spec.domainLayer;
  const infra = c.spec.infraLayer;
  if (domain === undefined || infra === undefined) return na('the spec binds no domain or infrastructure layer');
  const layer = c.spec.layerOf(c.f.file);
  if (layer !== domain) return no(`${c.f.file} is in ${layer ?? 'no layer'}, not the domain layer ${domain}`);
  const param = cls.ctorParams.find((p) => p.name === field || p.name.replace(/^(?:private|public|protected|readonly)\s+/g, '') === field);
  if (param === undefined) return no(`no constructor parameter ${field} in ${cls.name}`);
  const type = param.type;
  if (type?.text !== targetName) return no(`parameter ${field} is typed ${type?.text ?? 'untyped'}, not ${targetName}`);
  c.checks.push(`constructor parameter ${field}: ${targetName}`);
  const decl = type.declarations.find((d) => d.kind !== 'other' && (c.f.target === undefined || d.file === c.f.target));
  if (decl === undefined) return no(`${targetName} does not resolve to a class or interface in ${c.f.target ?? 'the project'}`);
  const tl = c.spec.layerOf(decl.file);
  return tl === infra ? ok(`domain class ${cls.name} is injected with ${targetName} from ${decl.file} (${infra})`)
    : no(`${targetName} is declared in ${decl.file}, layer ${tl ?? 'none'}, not ${infra}`);
}

// ── DDD rules ───────────────────────────────────────────────────────────────

function boundedContextModules(c: Ctx): Outcome {
  const d = c.spec.ddd;
  if (d === undefined) return na('the spec declares no architecture.ddd');
  if (!c.src.exists(c.f.file)) return no(`file ${c.f.file} does not exist`);
  if (!c.f.file.startsWith(d.sourceRoot)) return no(`${c.f.file} is outside source_root ${d.sourceRoot}`);
  const ctx = contextOf(c.spec, c.f.file);
  if (ctx !== null) return no(`${c.f.file} lies in context ${ctx}`);
  if (globMatch(d.outsideContexts, c.f.file)) return no(`${c.f.file} matches an outside_contexts glob`);
  return ok(`${c.f.file} lies in no context root and matches no outside_contexts glob`);
}

function contextIsolation(c: Ctx): Outcome {
  const d = c.spec.ddd;
  if (d === undefined) return na('the spec declares no architecture.ddd');
  const e = edge(c, 'literal');
  if ('verdict' in e) return e;
  const target = c.f.target ?? '';
  const sc = contextOf(c.spec, c.f.file);
  const tc = contextOf(c.spec, target);
  c.checks.push(`contexts by root: ${c.f.file} -> ${sc ?? 'none'}; ${target} -> ${tc ?? 'none'}`);
  if (sc === null || tc === null) return no('an end of the edge is in no context');
  if (sc === tc) return no(`both ends are in context ${sc}`);
  const publicApi = d.contexts.flatMap((x) => x.publicApi);
  if (globMatch(publicApi, target)) return no(`${target} is in a declared public API`);
  if (globMatch(d.contexts.flatMap((x) => x.acl), c.f.file)) return no(`${c.f.file} is in a declared anti-corruption layer`);
  return ok(`${sc} imports ${target} of ${tc}, which is not its public API, outside an ACL`);
}

function aggregateRule(c: Ctx, repositoryOnly: boolean): Outcome {
  const d = c.spec.ddd;
  if (d === undefined) return na('the spec declares no architecture.ddd');
  const aggName = c.f.discriminator.find((x) => d.aggregates.some((a) => a.name === x));
  const agg = d.aggregates.find((a) => a.name === aggName);
  if (agg === undefined) return na('the finding names no declared aggregate');
  const e = edge(c, 'resolved');
  if ('verdict' in e) return e;
  const target = c.f.target ?? '';
  if (!globMatch(agg.innerEntities, target)) return no(`${target} matches no inner-entity glob of aggregate ${agg.name}`);
  if (repositoryOnly) {
    return globMatch(d.repositories, c.f.file) ? ok(`repository ${c.f.file} references inner entity ${target} of ${agg.name}`)
      : no(`${c.f.file} matches no repository glob`);
  }
  return globMatch([agg.module], c.f.file) ? no(`${c.f.file} is inside aggregate module ${agg.module}`)
    : ok(`${c.f.file}, outside aggregate ${agg.name}, references its inner entity ${target}`);
}

const SETTER = /^set[A-Z].*$/;

const MEMBER_CLAUSE = /^(.+)\.([^.\s]+) \((public mutable field|set accessor|mutator method)\)$/;

/**
 * FF-DT03. Two discriminator forms: the frozen setter-name proxy (`Quantity.setValue`: a non-static method whose name
 * matches `set[A-Z].*`), and the v1.3 member-fact template (`Quantity.value (set accessor), Quantity.setValue (mutator
 * method)`): every listed member must hold its clause in the source: (a) a public, non-readonly, non-static field or
 * parameter property, (b) a non-static `set` accessor, (c) a public non-static method or arrow-function property
 * whose body assigns a `this.<field>`.
 */
function valueObjectImmutability(c: Ctx): Outcome {
  const d = c.spec.ddd;
  if (d === undefined) return na('the spec declares no architecture.ddd');
  const [className, method] = c.f.discriminator;
  if (!globMatch(d.valueObjects, c.f.file)) return no(`${c.f.file} matches no value-object glob`);
  const cls = classIn(c, className);
  if ('verdict' in cls) return cls;
  const raw = method ?? '';
  if (/\((public mutable field|set accessor|mutator method)\)/.test(raw)) {
    const parts = raw.split(/,\s+(?=[^,]+\.[^,.\s]+ \()/);
    for (const part of parts) {
      const m = MEMBER_CLAUSE.exec(part.trim());
      if (m === null) return na(`unparsed member clause '${part}'`);
      const [, owner, name, clause] = m as unknown as [string, string, string, string];
      if (owner !== cls.name) return no(`${part} names class ${owner}, not ${cls.name}`);
      if (clause === 'public mutable field') {
        const f = cls.members.fields.find((x) => x.name === name);
        if (f === undefined) return no(`${cls.name} declares no field ${name}`);
        if (!f.isPublic || f.isReadonly || f.isStatic) return no(`${cls.name}.${name} is not a public, non-readonly, non-static field`);
      } else if (clause === 'set accessor') {
        if (!cls.members.setAccessors.includes(name)) return no(`${cls.name} declares no non-static set accessor ${name}`);
      } else if (!cls.members.mutators.includes(name)) {
        return no(`${cls.name}.${name} is not a public non-static method that assigns a this field`);
      }
      c.checks.push(`${cls.name}.${name}: ${clause}`);
    }
    return ok(`value object ${cls.name} is mutable through ${raw}`);
  }
  const short = raw.split('.').pop() ?? '';
  const m = cls.methods.find((x) => x.name === short && !x.isStatic);
  if (m === undefined) return no(`${cls.name} declares no non-static method ${short}`);
  return SETTER.test(m.name) ? ok(`value object ${cls.name} declares setter-named method ${m.name}`) : no(`${m.name} is not setter-named`);
}

// ── Advisory conventions (covered where the condition is a name or a file fact) ─────────────────────────────

function namingPattern(c: Ctx, roles: readonly string[] | null): Outcome {
  const name = c.f.discriminator[0];
  const cls = classIn(c, name);
  if ('verdict' in cls) return cls;
  const pattern = c.spec.functions.get(c.f.ruleId)?.pattern;
  if (pattern === undefined) return na(`the spec gives ${c.f.ruleId} no name pattern`);
  if (roles !== null && !roles.some((r) => cls.name.includes(r))) return no(`${cls.name} does not carry a role suffix (${roles.join(', ')})`);
  return namePatternRegex(pattern).test(cls.name) ? no(`${cls.name} matches the pattern ${pattern}`) : ok(`${cls.name} does not match the pattern ${pattern}`);
}

function testFilePairing(c: Ctx): Outcome {
  const f = c.f.file;
  if (!c.src.exists(f)) return no(`file ${f} does not exist`);
  if (f.includes('.spec.') || f.includes('.test.')) return no(`${f} is itself a test file`);
  if (c.spec.layerOf(f) === null) return no(`${f} is in no layer`);
  const pairs = [f.replace('.ts', '.spec.ts'), f.replace('.ts', '.test.ts')];
  const found = pairs.find((p) => c.src.exists(p));
  return found !== undefined ? no(`test file ${found} exists`) : ok(`neither ${pairs.join(' nor ')} exists`);
}

// ── Coverage table ──────────────────────────────────────────────────────────

export const CHECKERS: Readonly<Record<string, (c: Ctx) => Outcome>> = Object.freeze({
  'dependency-direction': dependencyDirection,
  'no-cyclic-deps': cycle,
  'no-layer-skip': noLayerSkip,
  'no-domain-outward-dep': domainOutward,
  'domain-purity': domainPurity,
  'repository-pattern': repositoryPattern,
  'domain-state-purity': domainStatePurity,
  'dependency-direction-graph': dependencyDirectionGraph,
  'core-isolation': domainOutward,
  'port-adapter-pattern': portAdapter,
  'layer-skip-graph': layerSkipGraph,
  'bounded-context-modules': boundedContextModules,
  'context-isolation': contextIsolation,
  'aggregate-boundary': (c) => aggregateRule(c, false),
  'repository-aggregate-root': (c) => aggregateRule(c, true),
  'value-object-immutability': valueObjectImmutability,
  'naming-services': (c) => namingPattern(c, ['Service', 'UseCase']),
  'naming-repos': (c) => namingPattern(c, ['Repository', 'Repo']),
  'test-file-pairing': testFilePairing,
});

/**
 * The blocking rules of Docs/v1.3/rule-tiers.md, by style and template, and how the checker covers each. `partial`
 * and `uncoverable` are listed with the reason; the unit test checks this table against `ruleTier`.
 */
export interface CoverageRow {
  readonly style: string;
  readonly ruleId: string;
  readonly template: string;
  readonly coverage: 'full' | 'partial' | 'uncoverable';
  readonly note?: string;
}

const CORE = ['clean-architecture', 'nestjs', 'layered', 'hexagonal'];
export const BLOCKING_COVERAGE: readonly CoverageRow[] = Object.freeze([
  ...['clean-architecture', 'nestjs', 'layered'].map((style) => ({ style, ruleId: 'FF-S01', template: 'dependency-direction', coverage: 'full' as const })),
  ...CORE.map((style) => ({ style, ruleId: 'FF-S02', template: 'no-cyclic-deps', coverage: 'full' as const })),
  { style: 'layered', ruleId: 'FF-S03', template: 'no-layer-skip', coverage: 'full' },
  ...['clean-architecture', 'nestjs'].map((style) => ({ style, ruleId: 'FF-S04', template: 'no-domain-outward-dep', coverage: 'full' as const })),
  ...CORE.map((style) => ({ style, ruleId: 'FF-P01', template: 'domain-purity', coverage: 'full' as const })),
  ...['clean-architecture', 'nestjs'].map((style) => ({ style, ruleId: 'FF-P03', template: 'repository-pattern', coverage: 'full' as const })),
  ...CORE.map((style) => ({
    style, ruleId: 'FF-P06', template: 'domain-state-purity', coverage: 'partial' as const,
    note: 'constructor-injection rows checked; FLOWS_TO (field) rows are not-checkable, as rule-tiers.md reports that half N/A',
  })),
  { style: 'hexagonal', ruleId: 'FF-S01', template: 'dependency-direction-graph', coverage: 'full' },
  { style: 'hexagonal', ruleId: 'FF-S04', template: 'core-isolation', coverage: 'full' },
  { style: 'hexagonal', ruleId: 'FF-P03', template: 'port-adapter-pattern', coverage: 'full' },
  { style: 'ddd', ruleId: 'FF-S01', template: 'dependency-direction-graph', coverage: 'full' },
  { style: 'ddd', ruleId: 'FF-DS01', template: 'bounded-context-modules', coverage: 'full' },
  { style: 'ddd', ruleId: 'FF-DS02', template: 'context-isolation', coverage: 'full', note: 'literal view (edge-views.md addendum): the target is the file the specifier names' },
  { style: 'ddd', ruleId: 'FF-DT01', template: 'aggregate-boundary', coverage: 'full' },
  { style: 'ddd', ruleId: 'FF-DT02', template: 'repository-aggregate-root', coverage: 'full' },
  { style: 'ddd', ruleId: 'FF-DT03', template: 'value-object-immutability', coverage: 'full', note: 'the frozen setter-name proxy, and the v1.3 member-fact clauses (public mutable field, set accessor, mutator method)' },
  { style: 'ddd', ruleId: 'FF-DT04', template: 'domain-purity', coverage: 'full' },
]);

/** Blocking constructs no deterministic check covers (rule-tiers.md), with the reason. */
export const UNCOVERABLE: readonly { readonly rule: string; readonly reason: string }[] = Object.freeze([
  { rule: 'FF-P06 FLOWS_TO half (domain-state-purity, field rows)', reason: 'N/A by rule-tiers.md finding 9; FLOWS_TO is near-empty and its field-flow condition is not re-derivable syntactically' },
  { rule: 'port-dependency-inversion (hexagonal)', reason: 'tiered advisory (ratio-based, Docs/v1.3-hexagonal-notes.md §8); not a blocking condition' },
  { rule: 'ADR-derived and custom rules (untiered)', reason: 'advisory by default (ruleTier untiered-default); their condition is free Cypher with no fixed meaning to re-check' },
  { rule: 'FF-N01, FF-N02 (judge)', reason: 'LLM judgement, non-blocking in v1.3; validity is measured separately (FR-V8, V9)' },
]);

export function checkFinding(f: Finding, spec: SpecView, src: SourceFacts): CorrectnessResult {
  const checks: string[] = [];
  const base = { key: f.key, projectId: f.projectId, ruleId: f.ruleId, template: f.template, tier: f.tier, file: f.file };
  const checker = CHECKERS[f.template];
  if (checker === undefined) {
    return { ...base, verdict: 'not-checkable', reason: `no deterministic check for template '${f.template || f.type}'`, checks };
  }
  let out: Outcome;
  try {
    out = checker({ f, spec, src, checks });
  } catch (e) {
    out = na(`check failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { ...base, verdict: out.verdict, reason: out.reason, checks };
}
