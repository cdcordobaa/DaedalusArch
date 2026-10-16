/**
 * MCP v2 spec-rule fast checks beyond the four import rules and the naming rules of `file-check.ts`: the hexagonal and
 * DDD layering over `allowed_dependencies` (dependency-direction-graph, layer-skip-graph, core-isolation), the DDD
 * library (bounded-context-modules, context-isolation, aggregate-boundary, repository-aggregate-root,
 * value-object-immutability, domain-event-placement, application-service-thin), the class-level rules a declaration
 * decides (repository-pattern, port-adapter-pattern, domain-state-purity's constructor half), domain purity through a
 * barrel (resolved view), and, with a project root, the cycle an added import closes (no-cyclic-deps).
 *
 * Each check restates its template's condition (`cypher-templates.ts`, `hexagonal-templates.ts`, `ddd-templates.ts`)
 * over the changed file's facts and the edge view the template reads (`Docs/v1.3/edge-views.md`); role names use the
 * v1.3 camel-case token rule (`v13-role-names.ts`). Which functions run is the v1.3 compiler's decision
 * (`v13RuleStates`). Pure given the context.
 */
import type { FitnessFunction, ParsedSpec } from '../shared/types/spec.js';
import type { Severity } from '../shared/types/enums.js';
import { bindLayerParams } from '../fitness-compiler/layer-binding.js';
import { bindHexagonalLayers } from '../fitness-compiler/hexagonal-templates.js';
import type { HexagonalBinding } from '../fitness-compiler/hexagonal-templates.js';
import { bindDddModel } from '../fitness-compiler/ddd-templates.js';
import type { DddBinding } from '../fitness-compiler/ddd-templates.js';
import { MAX_CYCLE_LENGTH } from '../fitness-compiler/cypher-templates.js';
import { isExcluded, matchesForbiddenImport } from './spec-rules.js';
import { v13Active } from './rule-meta.js';
import { fullMatch, layerOfTarget } from './fast-context.js';
import type { Binding, FastContext } from './fast-context.js';
import { pathTo } from './project-files.js';
import type { AstClass } from './source-ast.js';

export interface RawFinding {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly line: number;
  readonly subject: string;
  readonly reason: string;
  readonly fix: string;
  readonly target?: string;
  readonly viaBarrels?: readonly string[];
}

/** Template names this module checks (the rest of the active rules are listed as limits by the caller). */
export const FAST_RULE_NAMES: readonly string[] = Object.freeze([
  'dependency-direction-graph',
  'layer-skip-graph',
  'core-isolation',
  'no-cyclic-deps',
  'domain-state-purity',
  'repository-pattern',
  'port-adapter-pattern',
  'bounded-context-modules',
  'context-isolation',
  'aggregate-boundary',
  'repository-aggregate-root',
  'value-object-immutability',
  'domain-event-placement',
  'application-service-thin',
]);

/** v1.3 role names (`v13-role-names.ts`): the class name ends with the role word, optionally followed by `Impl`. */
export function endsWithRole(name: string, roles: readonly string[]): boolean {
  return roles.some((r) => name.endsWith(r) || name.endsWith(`${r}Impl`));
}

const REPOSITORY_ROLES = ['Repository', 'Repo'];
const ADAPTER_ROLES = ['Repository', 'Repo', 'Adapter', 'Gateway'];

function finding(ff: FitnessFunction, line: number, subject: string, reason: string, fix: string, extra: Partial<RawFinding> = {}): RawFinding {
  return { ruleId: String(ff.id), ruleName: ff.name, severity: ff.severity, line, subject, reason, fix, ...extra };
}

function fileTargets(ctx: FastContext): { line: number; specifier: string; path: string; layer: string | null }[] {
  const out: { line: number; specifier: string; path: string; layer: string | null }[] = [];
  for (const e of ctx.edges) {
    // String-literal require()/import() calls are IMPORTS edges of the v1.3 graph (dynamicImports, R03).
    if (e.literal.kind === 'file') out.push({ line: e.imp.line, specifier: e.imp.specifier, path: e.literal.path, layer: e.literalLayer });
  }
  return out;
}

function resolvedFileTargets(ctx: FastContext): { line: number; specifier: string; path: string; via: readonly string[] }[] {
  const out: { line: number; specifier: string; path: string; via: readonly string[] }[] = [];
  for (const e of ctx.edges) {
    // A require()/import() edge ends at the module it names, with no per-name barrel routing (as the extractor's
    // dynamicImports edge does, R03).
    if (e.imp.kind === 'require' || e.imp.kind === 'dynamic') {
      if (e.literal.kind === 'file') out.push({ line: e.imp.line, specifier: e.imp.specifier, path: e.literal.path, via: [] });
      continue;
    }
    for (const r of e.resolved) if (r.target.kind === 'file') out.push({ line: e.imp.line, specifier: e.imp.specifier, path: r.target.path, via: r.viaBarrels });
  }
  return out;
}

// ── Allowed-dependency graph (hexagonal; ddd's composed layering) ───────────────────────────────────────────────

function graphRules(ctx: FastContext, ff: FitnessFunction, hex: HexagonalBinding): RawFinding[] {
  const out: RawFinding[] = [];
  const src = ctx.layer;
  if (src === null || isExcluded(ff, ctx.file)) return out;
  const allowed = new Set(hex.allowedDependencies);
  for (const t of fileTargets(ctx)) {
    const tgt = t.layer;
    if (tgt === null || tgt === src) continue;
    const forward = allowed.has(`${src}>${tgt}`);
    const reverse = allowed.has(`${tgt}>${src}`);
    const may = [...allowed].filter((a) => a.startsWith(`${src}>`)).map((a) => a.slice(src.length + 1));
    const mayText = may.length === 0 ? 'no other layer' : may.join(', ');
    if (ff.name === 'dependency-direction-graph' && !forward && reverse) {
      out.push(finding(ff, t.line, `import "${t.specifier}"`,
        `${src} may not import ${tgt}: the allowed edge runs ${tgt} -> ${src}, not the reverse`,
        `Remove the import of ${tgt} from ${src} (${src} may import: ${mayText}). Declare a port (interface) in ${src} or an inner layer for what you need, implement it in ${tgt}, and wire it in the composition root.`,
        { target: t.path }));
    }
    if (ff.name === 'layer-skip-graph' && !forward && !reverse) {
      out.push(finding(ff, t.line, `import "${t.specifier}"`,
        `${src} may not import ${tgt}: there is no allowed dependency between the two layers (a sideways step)`,
        `Do not import ${tgt} from ${src} (${src} may import: ${mayText}). Go through a port in ${hex.applicationLayers.join(' or ') || hex.domainLayer} that both sides depend on.`,
        { target: t.path }));
    }
    if (ff.name === 'core-isolation' && src === hex.domainLayer) {
      out.push(finding(ff, t.line, `import "${t.specifier}"`,
        `core layer ${src} may not import ${tgt}: the core depends on no adapter, UI, database or outer layer`,
        `Remove the import. Declare what the core needs as a port (interface) in ${src}, implement it in ${tgt} and inject it from the composition root.`,
        { target: t.path }));
    }
  }
  return out;
}

// ── Domain purity through a barrel (resolved view) ──────────────────────────────────────────────────────────────

function domainPurityResolved(ctx: FastContext, ff: FitnessFunction): RawFinding[] {
  const out: RawFinding[] = [];
  if (ctx.layer === null || ctx.layer !== bindLayerParams(ctx.spec.layerModel.layers).domainLayer || isExcluded(ff, ctx.file)) return out;
  for (const e of ctx.edges) {
    if (e.imp.kind === 'require' || e.imp.kind === 'dynamic') continue;
    for (const r of e.resolved) {
      if (r.target.kind !== 'package' || r.viaBarrels.length === 0) continue;
      const pkg = r.target.name;
      const pattern = (ff.forbiddenImports ?? []).find((p) => matchesForbiddenImport(pkg, p));
      if (pattern === undefined) continue;
      out.push(finding(ff, e.imp.line, `import "${e.imp.specifier}"`,
        `domain layer ${ctx.layer} imports ${r.names.join(', ')} from ${pkg} through ${r.viaBarrels.join(' -> ')} (forbidden_imports entry "${pattern}"; resolved view)`,
        `Do not use ${pkg} in the domain, not even through a barrel. Keep framework code in an outer layer and map it to plain domain classes there.`,
        { target: pkg, viaBarrels: r.viaBarrels }));
    }
  }
  return out;
}

// ── Class-level rules ───────────────────────────────────────────────────────────────────────────────────────────

/** The layer and kind of a type a class names: through its import binding (resolved view); undefined when local or unknown. */
function boundType(ctx: FastContext, name: string): { binding: Binding; layer: string | null; kind: 'class' | 'interface' | 'other' | undefined } | undefined {
  const b = ctx.bindings.get(name);
  if (b === undefined) return undefined;
  const t = b.declaredIn;
  if (t.kind !== 'file') return { binding: b, layer: null, kind: undefined };
  return { binding: b, layer: layerOfTarget(ctx.spec, t), kind: ctx.view.declarationKind(t.path, b.imported) };
}

function domainStatePurity(ctx: FastContext, ff: FitnessFunction): RawFinding[] {
  const out: RawFinding[] = [];
  const b = bindLayerParams(ctx.spec.layerModel.layers);
  if (ctx.layer === null || ctx.layer !== b.domainLayer || b.infraLayer === undefined || isExcluded(ff, ctx.file)) return out;
  for (const cls of ctx.ast.classes) {
    for (const p of cls.ctorParams) {
      for (const tn of p.typeNames) {
        const t = boundType(ctx, tn);
        if (t?.layer !== b.infraLayer || t.kind === 'other') continue;
        const target = t.binding.declaredIn.kind === 'file' ? t.binding.declaredIn.path : tn;
        out.push(finding(ff, p.line, `class ${cls.name} constructor parameter ${p.name}: ${tn}`,
          `domain class ${cls.name} is injected with ${tn} from ${b.infraLayer} (CONSTRUCTOR_INJECTS ${p.name}); the domain holds no infrastructure object`,
          `Declare an interface for what ${cls.name} needs in ${ctx.layer}, make ${tn} implement it in ${b.infraLayer}, and type ${p.name} with the interface.`,
          { target, viaBarrels: t.binding.viaBarrels }));
      }
    }
  }
  return out;
}

function implementsPort(ctx: FastContext, cls: AstClass, portLayers: readonly string[] | null): boolean {
  if (cls.implementsNames.length === 0) return false;
  if (portLayers === null) return true;
  return cls.implementsNames.some((n) => {
    const t = boundType(ctx, n);
    return t !== undefined && t.layer !== null && portLayers.includes(t.layer) && t.kind !== 'class' && t.kind !== 'other';
  });
}

function repositoryRules(ctx: FastContext, ff: FitnessFunction, hex: HexagonalBinding | undefined): RawFinding[] {
  const out: RawFinding[] = [];
  if (isExcluded(ff, ctx.file)) return out;
  const b = bindLayerParams(ctx.spec.layerModel.layers);
  if (ff.name === 'repository-pattern') {
    if (ctx.layer === null || ctx.layer !== b.infraLayer) return out;
    for (const cls of ctx.ast.classes) {
      if (!endsWithRole(cls.name, REPOSITORY_ROLES) || implementsPort(ctx, cls, null)) continue;
      out.push(finding(ff, cls.line, `class ${cls.name}`,
        `${cls.name} in ${ctx.layer} is a repository that implements no interface (the port belongs to ${b.domainLayer ?? 'the domain'})`,
        `Declare an interface ${cls.name.replace(/^(InMemory|Typeorm|TypeOrm|Prisma|Sql|Mongo|Pg)/, '').replace(/Impl$/, '')} in ${b.domainLayer ?? 'the domain'} and write "class ${cls.name} implements <it>".`));
    }
    return out;
  }
  // port-adapter-pattern (hexagonal; ddd's composed layering)
  if (hex === undefined) return out;
  if (ctx.layer !== hex.outboundLayer) return out;
  for (const cls of ctx.ast.classes) {
    if (!endsWithRole(cls.name, ADAPTER_ROLES) || implementsPort(ctx, cls, hex.portLayers)) continue;
    const local = cls.implementsNames.filter((n) => !ctx.bindings.has(n));
    out.push(finding(ff, cls.line, `class ${cls.name}`,
      cls.implementsNames.length === 0
        ? `outbound adapter ${cls.name} implements no port`
        : `outbound adapter ${cls.name} implements ${cls.implementsNames.join(', ')}, which is not a port declared in ${hex.portLayers.join(' or ')}${local.length > 0 ? ' (declared outside the port layers)' : ''}`,
      `Make ${cls.name} implement a port interface declared in ${hex.portLayers.join(' or ')} (e.g. application/ports/out), and type its users with that port.`));
  }
  return out;
}

// ── DDD library ─────────────────────────────────────────────────────────────────────────────────────────────────

function contextOf(ddd: DddBinding, file: string): string | undefined {
  return ddd.contextRoots.find((r) => file.startsWith(r));
}

function dddRules(ctx: FastContext, ff: FitnessFunction, ddd: DddBinding): RawFinding[] {
  const out: RawFinding[] = [];
  if (isExcluded(ff, ctx.file)) return out;
  const file = ctx.file;
  switch (ff.name) {
    case 'bounded-context-modules': {
      if (file.startsWith(ddd.sourceRoot) && contextOf(ddd, file) === undefined && !ddd.outsidePatterns.some((p) => fullMatch(p, file))) {
        out.push(finding(ff, 1, file,
          `${file} lies in no declared bounded context (${ddd.contextRoots.join(', ')}) and in no path declared outside the contexts`,
          `Move the file into the context that owns it (${ddd.contextRoots.join(' or ')}), or into a path declared in architecture.ddd.outside_contexts (shared kernel) if it is shared on purpose.`));
      }
      break;
    }
    case 'context-isolation': {
      const srcCtx = contextOf(ddd, file);
      if (srcCtx === undefined || ddd.aclPatterns.some((p) => fullMatch(p, file))) break;
      for (const t of fileTargets(ctx)) {
        const tgtCtx = contextOf(ddd, t.path);
        if (tgtCtx === undefined || tgtCtx === srcCtx || ddd.publicApiPatterns.some((p) => fullMatch(p, t.path))) continue;
        out.push(finding(ff, t.line, `import "${t.specifier}"`,
          `${srcCtx} imports ${t.path}, which is not in the public API of ${tgtCtx} (literal view: the module the import names)`,
          `Import it from ${tgtCtx}'s public API (its index.ts or contracts/), or translate it in ${srcCtx}'s anti-corruption layer.`,
          { target: t.path }));
      }
      break;
    }
    case 'aggregate-boundary': {
      for (const agg of ddd.aggregates) {
        if (fullMatch(agg.module, file)) continue;
        for (const t of resolvedFileTargets(ctx)) {
          if (!agg.innerEntities.some((p) => fullMatch(p, t.path))) continue;
          out.push(finding(ff, t.line, `import "${t.specifier}"`,
            `${file} references ${t.path}, an inner entity of aggregate ${agg.name}; only the root may be referenced from outside the aggregate${t.via.length > 0 ? ` (through ${t.via.join(' -> ')})` : ''}`,
            `Go through the aggregate root ${agg.name}: call a method on ${agg.name} or read a value object/DTO it returns, instead of naming the inner entity.`,
            { target: t.path, viaBarrels: t.via }));
        }
      }
      break;
    }
    case 'repository-aggregate-root': {
      if (!ddd.repositoryPatterns.some((p) => fullMatch(p, file))) break;
      for (const agg of ddd.aggregates) {
        for (const t of resolvedFileTargets(ctx)) {
          if (!agg.innerEntities.some((p) => fullMatch(p, t.path))) continue;
          out.push(finding(ff, t.line, `import "${t.specifier}"`,
            `repository ${file} references ${t.path}, an inner entity of aggregate ${agg.name}; repositories exist for aggregate roots only`,
            `Remove the repository for the inner entity; load and save ${agg.name} through its root's repository and reach the inner entity through ${agg.name}.`,
            { target: t.path, viaBarrels: t.via }));
        }
      }
      break;
    }
    case 'value-object-immutability': {
      if (!ddd.valueObjectPatterns.some((p) => fullMatch(p, file))) break;
      for (const cls of ctx.ast.classes) {
        const f = cls.memberFacts;
        const members = [
          ...f.publicFields.filter((x) => !f.readonlyFields.includes(x) && !f.staticFields.includes(x)).map((x) => `${cls.name}.${x} (public mutable field)`),
          ...f.setAccessors.map((x) => `${cls.name}.${x} (set accessor)`),
          ...f.mutatorMethods.map((x) => `${cls.name}.${x} (mutator method)`),
        ];
        if (members.length === 0) continue;
        out.push(finding(ff, cls.line, `class ${cls.name}`,
          `value object ${cls.name} is mutable through ${members.join(', ')}`,
          `Make every field readonly, remove setters and mutators, and return a new ${cls.name} from any "change" method (e.g. withValue(v): ${cls.name}).`));
      }
      break;
    }
    case 'domain-event-placement': {
      if (ctx.layer !== null && ddd.domainLayers.includes(ctx.layer)) break;
      for (const cls of ctx.ast.classes) {
        const base = [...cls.implementsNames, ...(cls.extendsName !== null ? [cls.extendsName] : [])].find((n) => ddd.domainEventTypes.includes(n));
        if (base === undefined) continue;
        out.push(finding(ff, cls.line, `class ${cls.name}`,
          `domain event ${cls.name} (${base}) is defined in ${ctx.layer ?? 'no layer'}, outside the domain`,
          `Move ${cls.name} into the domain layer of its context.`));
      }
      break;
    }
    case 'application-service-thin': {
      if (!ddd.applicationServicePatterns.some((p) => fullMatch(p, file))) break;
      const threshold = ff.threshold ?? Number.POSITIVE_INFINITY;
      for (const cls of ctx.ast.classes) {
        if (cls.methods.length <= threshold) continue;
        out.push(finding(ff, cls.line, `class ${cls.name}`,
          `application service ${cls.name} declares ${String(cls.methods.length)} methods (threshold ${String(threshold)})`,
          `Move business rules into the domain (entities, value objects, domain services) and keep ${cls.name} to coordination.`));
      }
      break;
    }
    default:
      break;
  }
  return out;
}

// ── Cycles (project-aware) ──────────────────────────────────────────────────────────────────────────────────────

function cycleRule(ctx: FastContext, ff: FitnessFunction, graph: ReadonlyMap<string, ReadonlySet<string>>): RawFinding[] {
  const out: RawFinding[] = [];
  for (const t of fileTargets(ctx)) {
    if (!ctx.view.exists(t.path) || t.path === ctx.file) continue;
    const back = pathTo(graph, t.path, ctx.file, MAX_CYCLE_LENGTH - 1);
    if (back === undefined) continue;
    const cycle = [ctx.file, ...back];
    if (cycle.some((f) => isExcluded(ff, f))) continue;
    out.push(finding(ff, t.line, `import "${t.specifier}"`,
      `this import closes the cycle ${cycle.join(' -> ')} (literal view)`,
      `Break the cycle: move what both files need into a third module they both import, or invert one dependency with an interface.`,
      { target: t.path }));
  }
  return out;
}

export interface FastRuleOptions {
  /** The project's literal import graph with the proposed contents (cycle check); undefined without a project root. */
  readonly graph?: ReadonlyMap<string, ReadonlySet<string>>;
}

/** The spec-rule findings of one file under the v1.3 active rules (beyond `checkSource`'s import and naming rules). */
export function fastRuleFindings(ctx: FastContext, opts: FastRuleOptions = {}): RawFinding[] {
  const spec: ParsedSpec = ctx.spec;
  const out: RawFinding[] = [];
  const active = spec.fitnessFunctions.filter((ff) => v13Active(spec, ff));
  const needsHex = active.some((ff) => ['dependency-direction-graph', 'layer-skip-graph', 'core-isolation', 'port-adapter-pattern'].includes(ff.name));
  const hexBound = needsHex && spec.layerModel.allowedDependencies !== undefined ? bindHexagonalLayers(spec.layerModel) : undefined;
  const hex = hexBound?.ok === true ? hexBound.binding : undefined;
  const dddBound = spec.layerModel.ddd !== undefined ? bindDddModel(spec.layerModel) : undefined;
  const ddd = dddBound?.ok === true ? dddBound.binding : undefined;
  for (const ff of active) {
    switch (ff.name) {
      case 'dependency-direction-graph':
      case 'layer-skip-graph':
      case 'core-isolation':
        if (hex !== undefined) out.push(...graphRules(ctx, ff, hex));
        break;
      case 'domain-purity':
        out.push(...domainPurityResolved(ctx, ff));
        break;
      case 'domain-state-purity':
        out.push(...domainStatePurity(ctx, ff));
        break;
      case 'repository-pattern':
      case 'port-adapter-pattern':
        out.push(...repositoryRules(ctx, ff, hex));
        break;
      case 'no-cyclic-deps':
        if (opts.graph !== undefined && !isExcluded(ff, ctx.file)) out.push(...cycleRule(ctx, ff, opts.graph));
        break;
      default:
        if (ddd !== undefined) out.push(...dddRules(ctx, ff, ddd));
    }
  }
  return out;
}
