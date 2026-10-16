/**
 * The parameter bindings of the catalogue sweep (Docs/v1.3/cypher-interpreter.md §4), shared by the parity harness
 * (`memory-parity.ts`) and the fuzz harness (`cypher-interp-fuzz.ts`) so both bind every template the same way.
 */
import type { LayerModel } from '../../../src/shared/types/spec.js';
import type { Apg2Params } from '../../../src/fitness-compiler/apg2-in-memory.js';
import { paramNames } from './memory-sweep.js';

/** Sweep parameters: the spec's compiled parameters first, then generic bindings for every other `$name`. */
export function sweepParams(layerModel: LayerModel, compiled: ReadonlyMap<string, Record<string, unknown>>, a2: Apg2Params, filePaths: readonly string[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const p of compiled.values()) for (const [k, v] of Object.entries(p)) if (!(k in merged)) merged[k] = v;
  const layers = layerModel.layers.map((l) => l.name);
  const dom = a2.domainLayer ?? layers[0] ?? null;
  const transitions = layers.slice(0, -1).map((l, i) => `${String(layers[i + 1])}>${l}`);
  // Context roots: the distinct first directories below the common source prefix.
  const prefix = commonDir(filePaths);
  const roots = [...new Set(filePaths.map((f) => f.slice(prefix.length).split('/')[0] ?? '').filter((s) => s !== '' && !s.includes('.')))].sort().map((s) => `${prefix}${s}/`);
  const generic: Record<string, unknown> = {
    domainLayer: dom, infraLayer: a2.infraLayer ?? null, controllerLayer: a2.controllerLayer ?? null,
    applicationLayers: [...a2.applicationLayers], layerOrder: layers, allowedTransitions: transitions, allowedDependencies: transitions,
    threshold: 0.5, maxPublicMethods: 3, maxDependencies: 2, maxInterfaceMethods: 2, maxDepth: 1, minTypes: a2.minTypes,
    forbiddenImports: ['express', '@nestjs/*', 'typeorm', 'pg'], pattern: '^[A-Z][A-Za-z0-9]*$',
    useCaseRoles: ['UseCase', 'Service', 'Handler'], entityRoles: ['Entity', 'Aggregate', 'ValueObject'],
    domainPattern: '^[A-Z].*', applicationPattern: '.*(Service|UseCase|Handler)$', infraPattern: '.*',
    adapterRoles: ['Adapter', 'Repository', 'Gateway', 'Client'], portLayers: [dom, ...a2.applicationLayers].filter((x) => x !== null),
    sourceRoot: prefix, contextRoots: roots, outsidePatterns: ['.*\\.spec\\.ts$', '.*/main\\.ts$'],
    publicApiPatterns: ['.*/index\\.ts$'], aclPatterns: a2.aclPatterns.length > 0 ? [...a2.aclPatterns] : ['.*/acl/.*'],
    aggregates: roots.slice(0, 2).map((r, i) => ({ name: `Agg${String(i)}`, innerEntities: [`${escapeRe(r)}.*domain.*`], module: `${escapeRe(r)}.*` })),
    repositoryPatterns: ['.*[Rr]epositor.*'], valueObjectPatterns: ['.*(domain|model).*'], applicationServicePatterns: ['.*(application|service).*'],
    setterPattern: '^set[A-Z].*', domainLayers: dom === null ? [] : [dom], domainEventTypes: ['DomainEvent', 'Event'],
    allowedAsync: [...a2.allowedAsync], compositionRootLayers: [...a2.compositionRootLayers], compositionRootPatterns: [...a2.compositionRootPatterns],
    testPatterns: [...a2.testPatterns],
  };
  for (const [k, v] of Object.entries(generic)) if (!(k in merged)) merged[k] = v;
  return merged;
}

/**
 * Two permissive bindings on top of the spec's, so the threshold and naming templates return rows on the small
 * reference projects (a parity that only ever compares empty results proves little): `low` lowers every bound and makes
 * every role and name check pass or fail wholesale; `high` raises the ratio thresholds.
 */
export function permissive(base: Record<string, unknown>, kind: 'low' | 'high'): Record<string, unknown> {
  if (kind === 'high') return { ...base, threshold: 2 };
  return {
    ...base, threshold: -1, maxPublicMethods: 0, maxDependencies: 0, maxInterfaceMethods: 0, maxDepth: 0, minTypes: 0,
    pattern: '^$', domainPattern: '^$', applicationPattern: '^$', infraPattern: '^$', setterPattern: '.*',
    entityRoles: [''], useCaseRoles: [''], adapterRoles: [''], controllerLayer: base.domainLayer ?? null,
    domainEventTypes: ['Event', 'DomainEvent', 'BaseEntity', 'AggregateRoot', 'Entity'],
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function commonDir(paths: readonly string[]): string {
  if (paths.length === 0) return '';
  let p = paths[0] ?? '';
  for (const x of paths) while (!x.startsWith(p)) p = p.slice(0, -1);
  return p.slice(0, p.lastIndexOf('/') + 1);
}

/** The parameters one sweep statement is run with: every `$name` it reads, from `params` (null when unbound). */
export function statementParams(text: string, params: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  for (const n of paramNames(text)) p[n] = n === 'excludePatterns' ? ['.*\\.spec\\.ts$', '^__no_such_path__$'] : params[n] ?? null;
  return p;
}
