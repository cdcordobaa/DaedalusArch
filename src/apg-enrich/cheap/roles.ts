/**
 * Proxies 3, 5 and 6: the role a class's name or layer declares against the role its behaviour shows.
 *
 * - NAME vs BEHAVIOUR (3): a *Repository / *Dao doing HTTP, mail or messaging; a controller (by name, `@Controller`
 *   or presentation layer) whose densest method crosses `densityThreshold`; a *Service / use case making direct ORM
 *   calls (a global accessor or raw client, `behaviour.ts`); a domain-role class (by name or domain layer) carrying
 *   persistence mapping decorators or performing I/O; a DTO performing I/O.
 * - LOGIC DENSITY BY ROLE (5): per method density (branches, value comparisons, numeric arithmetic, validation
 *   throws), aggregated per effective role; a controller or adapter method at or above `densityThreshold` is flagged.
 * - REPOSITORY BYPASS (6): a direct ORM / DB client use (global accessor such as `getRepository`, `model<>()`,
 *   `new PrismaClient()`, `new DataSource()`, a query builder, or a call on a raw client type) outside classes in the
 *   repository role and outside the infrastructure layer kind.
 */
import type { CheapContext } from './context.js';
import type { ClassBehaviour, IoCategory, NameRole } from './behaviour.js';
import { allClassBehaviours, effectiveRole, ioUses, topLevelFunctions } from './behaviour.js';
import type { CheapFlag, CheapNodeFact, CheapProxyOutput } from './types.js';

const OUTBOUND_IO: readonly IoCategory[] = ['http-client', 'mail', 'messaging'];

function behaviourRole(b: ClassBehaviour, densityThreshold: number): string {
  const cats = new Set(b.io.map((u) => u.category));
  if (b.transportDecorators.length > 0 || cats.has('transport')) return 'controller';
  if (b.ormMappingDecorators.length > 0) return 'persistence-mapping';
  if (cats.has('db')) return 'repository';
  if (OUTBOUND_IO.some((c) => cats.has(c)) || cats.has('fs')) return 'adapter';
  const maxDensity = Math.max(0, ...b.methods.map((m) => m.density.density));
  if (maxDensity >= densityThreshold) return 'business-logic';
  return 'coordination';
}

function isControllerRole(b: ClassBehaviour): boolean {
  return b.nameRole === 'controller' || b.transportDecorators.includes('Controller') || (b.nameRole === 'unknown' && b.layerRole === 'controller');
}

/**
 * A domain-role class: any non-repository class of a domain-kind layer; without a layer, an entity or domain-service
 * name. An `*Entity` / `*Model` class outside the domain layer (an ORM row class in infrastructure) is not one.
 */
function isDomainRole(b: ClassBehaviour): boolean {
  if (b.layerRole === 'entity') return b.nameRole !== 'repository';
  return b.layerRole === null && (b.nameRole === 'entity' || b.nameRole === 'domain-service');
}

export function runNameBehaviour(ctx: CheapContext): CheapProxyOutput {
  const flags: CheapFlag[] = [];
  const nodeFacts: CheapNodeFact[] = [];
  const T = ctx.options.densityThreshold;
  for (const b of allClassBehaviours(ctx)) {
    const id = ctx.nodeId('Class', b.file, b.name);
    const bRole = behaviourRole(b, T);
    if (id !== undefined) {
      nodeFacts.push({ proxy: 'name-behaviour', nodeId: id, key: 'nameRole', value: b.nameRole, evidence: b.evidence });
      nodeFacts.push({ proxy: 'name-behaviour', nodeId: id, key: 'behaviourRole', value: bRole, evidence: b.evidence });
      nodeFacts.push({ proxy: 'name-behaviour', nodeId: id, key: 'ioCategories', value: [...new Set(b.io.map((u) => u.category))].sort() });
    }
    const flag = (kind: string, score: number, message: string, ev = b.evidence, methodName?: string): void => {
      flags.push({ proxy: 'name-behaviour', kind, score, evidence: ev, className: b.name, ...(methodName !== undefined ? { methodName } : {}), message });
    };
    if (b.nameRole === 'repository') {
      for (const u of b.io.filter((x) => OUTBOUND_IO.includes(x.category))) flag('repository-does-outbound-io', 1, `${b.name} is named a repository but calls ${u.module} ${u.api} (${u.category})`, u.evidence, u.method);
    }
    if (isControllerRole(b)) {
      for (const m of b.methods.filter((x) => x.density.density >= T)) flag('controller-business-logic', m.density.density / T, `controller ${b.name}.${m.name} has logic density ${String(m.density.density)}`, m.evidence, m.name);
    }
    if (b.nameRole === 'service' || (b.nameRole === 'unknown' && b.layerRole === 'service')) {
      for (const u of b.io.filter((x) => x.category === 'db' && x.direct)) flag('service-direct-orm', 1, `service ${b.name} makes a direct ORM call ${u.api} (${u.module})`, u.evidence, u.method);
    }
    if (isDomainRole(b)) {
      for (const d of b.ormMappingDecorators) flag('domain-persistence-mapping', 1, `domain class ${b.name} carries persistence mapping @${d.name}`, d.evidence);
      for (const u of b.io) flag('domain-does-io', 1, `domain class ${b.name} calls ${u.module} ${u.api} (${u.category})`, u.evidence, u.method);
    }
    if (b.nameRole === 'dto') {
      for (const u of b.io) flag('dto-does-io', 1, `DTO ${b.name} calls ${u.module} ${u.api} (${u.category})`, u.evidence, u.method);
    }
  }
  const byKind: Record<string, number> = {};
  for (const f of flags) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  return { edges: [], nodeFacts, flags, summary: { classes: allClassBehaviours(ctx).length, flagsByKind: byKind } };
}

export function runLogicDensity(ctx: CheapContext): CheapProxyOutput {
  const flags: CheapFlag[] = [];
  const nodeFacts: CheapNodeFact[] = [];
  const T = ctx.options.densityThreshold;
  const perRole = new Map<NameRole, number[]>();
  for (const b of allClassBehaviours(ctx)) {
    const role = isControllerRole(b) ? 'controller' : effectiveRole(b);
    for (const m of b.methods) {
      const list = perRole.get(role) ?? [];
      list.push(m.density.density);
      perRole.set(role, list);
      const id = ctx.nodeId('Method', b.file, `${b.name}.${m.name}`);
      if (id !== undefined) nodeFacts.push({ proxy: 'logic-density', nodeId: id, key: 'logicDensity', value: m.density, evidence: m.evidence });
      if ((role === 'controller' || role === 'adapter') && m.density.density >= T) {
        flags.push({
          proxy: 'logic-density', kind: `${role}-logic-density`, score: m.density.density / T, evidence: m.evidence, className: b.name, methodName: m.name,
          message: `${role} method ${b.name}.${m.name}: ${String(m.density.branches)} branches, ${String(m.density.comparisons)} comparisons, ${String(m.density.arithmetic)} arithmetic, ${String(m.density.validationThrows)} validation throws`,
        });
      }
    }
  }
  const aggregate: Record<string, { methods: number; mean: number; max: number; aboveThreshold: number }> = {};
  for (const [role, ds] of [...perRole.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    aggregate[role] = { methods: ds.length, mean: ds.reduce((s, x) => s + x, 0) / Math.max(ds.length, 1), max: Math.max(0, ...ds), aboveThreshold: ds.filter((x) => x >= T).length };
  }
  return { edges: [], nodeFacts, flags, summary: { perRole: aggregate } };
}

export function runRepoBypass(ctx: CheapContext): CheapProxyOutput {
  const flags: CheapFlag[] = [];
  const allowed = (role: NameRole, kind: string | null): boolean => role === 'repository' || kind === 'infrastructure';
  for (const b of allClassBehaviours(ctx)) {
    if (allowed(b.nameRole, ctx.info(b.file).layerKind)) continue;
    for (const u of b.io.filter((x) => x.category === 'db' && x.direct)) {
      flags.push({ proxy: 'repo-bypass', kind: 'direct-db-access', score: 1, evidence: u.evidence, className: b.name, ...(u.method !== undefined ? { methodName: u.method } : {}), message: `${b.name}${u.method !== undefined ? `.${u.method}` : ''} uses ${u.api} from ${u.module} directly (role ${effectiveRole(b)})` });
    }
  }
  // Top-level functions outside the infrastructure layer.
  for (const { file, sf } of ctx.sources) {
    if (ctx.info(file).layerKind === 'infrastructure') continue;
    for (const f of topLevelFunctions(sf)) {
      if (f.body === undefined) continue;
      for (const u of ioUses(ctx, f.body).filter((x) => x.category === 'db' && x.direct)) {
        flags.push({ proxy: 'repo-bypass', kind: 'direct-db-access', score: 1, evidence: u.evidence, methodName: f.name, message: `function ${f.name} uses ${u.api} from ${u.module} directly` });
      }
    }
  }
  return { edges: [], nodeFacts: [], flags, summary: { sites: flags.length } };
}
