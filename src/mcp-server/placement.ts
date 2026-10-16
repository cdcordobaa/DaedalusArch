/**
 * `suggest_placement`: where a new class or module belongs, from a short purpose ("repository for orders"). The
 * purpose is mapped to a role by a keyword table; the role to a layer by the spec (a layer that lists the role, else
 * the layer of the role's kind); the layer to a path by its first directory glob (or a file pattern). Every suggested
 * path is checked against the spec (it must resolve to the chosen layer) and every class name against the spec's
 * active naming rules, through `checkSource`. A repository splits into an interface in the domain and an
 * implementation outside it, unless the spec has a layer that owns repositories whole. Pure.
 */
import type { LayerDefinition, ParsedSpec } from '../shared/types/spec.js';
import type { LayerKind } from '../shared/types/enums.js';
import { checkSource, suggestName } from './file-check.js';
import { resolveLayer } from './layer-resolver.js';
import { forbiddenPackagesFor, importableLayers } from './spec-rules.js';
import type { Placement, PlacementResult } from './types.js';

interface RoleDef {
  readonly role: string;
  /** Lower-case words or phrases (a trailing `s` also matches); the first role with a match wins (table order). */
  readonly keywords: readonly string[];
  /** Layer kinds to try, in order, when no layer lists the role. */
  readonly kinds: readonly LayerKind[];
  readonly dir: string;
  readonly name: (base: string) => string;
}

const withSuffix =
  (suffix: string) =>
  (base: string): string =>
    base.endsWith(suffix) ? base : `${base}${suffix}`;

/** Priority-ordered role table: specific phrases before generic ones ("domain service" before "service"). */
export const ROLE_TABLE: readonly RoleDef[] = Object.freeze([
  {
    role: 'value-object',
    keywords: ['value object', 'value-object'],
    kinds: ['domain'],
    dir: 'value-objects',
    name: (b) => b,
  },
  {
    role: 'domain-service',
    keywords: ['domain service', 'domain logic', 'business rule', 'policy'],
    kinds: ['domain'],
    dir: 'services',
    name: withSuffix('Service'),
  },
  {
    role: 'orm-entity',
    keywords: ['orm', 'typeorm', 'prisma', 'sequelize', 'database model', 'db model', 'table'],
    kinds: ['infrastructure'],
    dir: 'orm',
    name: withSuffix('OrmEntity'),
  },
  {
    role: 'use-case',
    keywords: ['use case', 'use-case', 'usecase', 'interactor', 'command handler', 'query handler'],
    kinds: ['application', 'domain'],
    dir: 'use-cases',
    name: withSuffix('UseCase'),
  },
  {
    role: 'dto',
    keywords: ['dto', 'data transfer', 'request body', 'response body', 'payload'],
    kinds: ['application', 'domain'],
    dir: 'dto',
    name: withSuffix('Dto'),
  },
  {
    role: 'controller',
    keywords: ['controller', 'endpoint', 'route', 'http', 'rest', 'graphql', 'resolver'],
    kinds: ['presentation', 'infrastructure'],
    dir: 'controllers',
    name: withSuffix('Controller'),
  },
  {
    role: 'middleware',
    keywords: ['middleware', 'guard', 'interceptor', 'exception filter'],
    kinds: ['presentation', 'infrastructure'],
    dir: 'middleware',
    name: withSuffix('Middleware'),
  },
  {
    role: 'repository',
    keywords: ['repository', 'repo', 'persistence', 'dao', 'data access', 'storage', 'store'],
    kinds: ['infrastructure'],
    dir: 'repositories',
    name: withSuffix('Repository'),
  },
  {
    role: 'adapter',
    keywords: [
      'adapter',
      'gateway',
      'api client',
      'client for',
      'integration',
      'email sender',
      'queue',
      'cache',
    ],
    kinds: ['infrastructure'],
    dir: 'adapters',
    name: withSuffix('Adapter'),
  },
  {
    role: 'domain-event',
    keywords: ['domain event', 'event'],
    kinds: ['domain'],
    dir: 'events',
    name: withSuffix('Event'),
  },
  {
    role: 'entity',
    keywords: ['entity', 'aggregate', 'domain model', 'domain object'],
    kinds: ['domain'],
    dir: 'entities',
    name: (b) => b,
  },
  {
    role: 'application-service',
    keywords: [
      'application service',
      'service',
      'orchestrator',
      'orchestration',
      'workflow',
      'handler',
    ],
    kinds: ['application', 'domain'],
    dir: 'services',
    name: withSuffix('Service'),
  },
]);

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'for',
  'of',
  'to',
  'that',
  'which',
  'and',
  'or',
  'in',
  'on',
  'with',
  'by',
  'from',
  'new',
  'class',
  'module',
  'file',
  'handles',
  'handling',
  'manages',
  'managing',
  'manage',
  'stores',
  'storing',
  'our',
  'my',
  'domain',
  'application',
  'infrastructure',
  'presentation',
  'layer',
]);

function pascal(word: string): string {
  return word.length === 0 ? '' : `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`;
}

function singular(word: string): string {
  if (/ies$/i.test(word) && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:ss|us|is)$/i.test(word)) return word;
  if (/(?:ches|shes|xes|sses)$/i.test(word)) return word.slice(0, -2);
  return word.endsWith('s') && word.length > 3 ? word.slice(0, -1) : word;
}

/** The subject of a purpose as a PascalCase base name: role keywords and stop words removed, last word singular. */
export function baseNameOf(purpose: string, role: RoleDef | undefined): string {
  let text = ` ${purpose.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')} `;
  for (const r of ROLE_TABLE) {
    for (const kw of r.keywords) {
      if (r === role || kw.includes(' ')) text = text.split(` ${kw} `).join(' ');
    }
  }
  const words = text
    .split(/[\s-]+/)
    .filter((w) => w !== '' && !STOPWORDS.has(w))
    .slice(0, 3);
  if (words.length === 0) return 'Feature';
  const last = words.length - 1;
  return words.map((w, i) => pascal(i === last ? singular(w) : w)).join('');
}

export function roleOf(purpose: string): RoleDef | undefined {
  const text = ` ${purpose
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')} `;
  return ROLE_TABLE.find((r) =>
    r.keywords.some((kw) => text.includes(` ${kw} `) || text.includes(` ${kw}s `)),
  );
}

function rolesOf(layer: LayerDefinition): readonly string[] {
  return layer.role === '' ? [] : layer.role.split(', ');
}

/** The layer for `role`: one that lists it (or a role it starts with), else the first layer of one of `kinds`. */
function layerFor(
  spec: ParsedSpec,
  role: string,
  kinds: readonly LayerKind[],
): { layer: LayerDefinition; why: string } | undefined {
  const layers = spec.layerModel.layers;
  const listed = layers.find((l) =>
    rolesOf(l).some((r) => r === role || r.startsWith(`${role}-`) || role.startsWith(`${r}-`)),
  );
  if (listed !== undefined)
    return { layer: listed, why: `layer ${listed.name} lists role ${role}` };
  for (const kind of kinds) {
    const byKind = layers.find((l) => l.kind === kind);
    if (byKind !== undefined)
      return {
        layer: byKind,
        why: `role ${role} belongs to the ${kind} layer kind (${byKind.name})`,
      };
  }
  return undefined;
}

const GLOB_CHARS = /[*?[\]{}!()]/;

/** A path for `fileName` in `layer`: under the literal prefix of a directory glob, or named after a file pattern. */
function pathIn(
  spec: ParsedSpec,
  layer: LayerDefinition,
  dir: string,
  fileName: string,
  kebab: string,
): string | undefined {
  for (const glob of layer.directories) {
    const segments = glob.split('/');
    const literal: string[] = [];
    for (const seg of segments) {
      if (GLOB_CHARS.test(seg)) break;
      literal.push(seg);
    }
    if (literal.length === 0) continue;
    const sub = literal[literal.length - 1] === dir ? [] : [dir];
    for (const candidate of [
      [...literal, ...sub, fileName].join('/'),
      [...literal, fileName].join('/'),
    ]) {
      if (resolveLayer(spec, candidate)?.layer === layer.name) return candidate;
    }
  }
  for (const pattern of layer.filePatterns ?? []) {
    const name = pattern.replace(/^\*\*\//, '').replace('*', kebab);
    if (GLOB_CHARS.test(name)) continue;
    const candidate = `src/${name}`;
    if (resolveLayer(spec, candidate)?.layer === layer.name) return candidate;
  }
  return undefined;
}

function kebabOf(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** `className` adjusted so `checkSource` reports no naming violation for it at `path`. */
function compliantName(spec: ParsedSpec, path: string, className: string): string {
  const res = checkSource(spec, { path, content: `export class ${className} {}` });
  const naming = res.violations.find((v) => v.ruleName.startsWith('naming-'));
  if (naming === undefined) return className;
  const pattern = /"([^"]+)"/.exec(naming.reason)?.[1];
  return (pattern !== undefined ? suggestName(className, pattern) : undefined) ?? className;
}

function place(
  spec: ParsedSpec,
  role: string,
  kinds: readonly LayerKind[],
  dir: string,
  className: string,
  notes: string[],
): Placement | undefined {
  const target = layerFor(spec, role, kinds);
  if (target === undefined) {
    notes.push(`no layer of this spec takes role ${role} (tried kinds ${kinds.join(', ')})`);
    return undefined;
  }
  const { layer, why } = target;
  const firstPath = pathIn(spec, layer, dir, `${className}.ts`, kebabOf(className));
  if (firstPath === undefined) {
    notes.push(
      `layer ${layer.name} has no glob a concrete path can be derived from; pick a path matching ${[...layer.directories, ...(layer.filePatterns ?? [])].join(', ')}`,
    );
    return undefined;
  }
  const name = compliantName(spec, firstPath, className);
  const path =
    name === className
      ? firstPath
      : (pathIn(spec, layer, dir, `${name}.ts`, kebabOf(name)) ?? firstPath);
  return {
    role,
    layer: layer.name,
    path,
    className: name,
    why,
    mayImport: importableLayers(spec, layer.name, path).may,
    forbiddenPackages: forbiddenPackagesFor(spec, layer.name, path),
  };
}

export function suggestPlacement(
  spec: ParsedSpec,
  input: { readonly purpose: string; readonly name?: string | undefined },
): PlacementResult {
  const notes: string[] = [];
  const role = roleOf(input.purpose);
  const base =
    input.name !== undefined && input.name.trim() !== ''
      ? pascal(input.name.trim())
      : baseNameOf(input.purpose, role);
  const placements: Placement[] = [];

  if (role === undefined) {
    notes.push(
      'no role keyword recognised; defaulting to a domain entity. Name the role (entity, use case, repository, controller, dto, adapter, service) for a sharper answer',
    );
  }
  const def = role ?? ROLE_TABLE.find((r) => r.role === 'entity');
  if (def === undefined)
    return { purpose: input.purpose, summary: 'no placement', placements, notes };

  const ownsRepositories = spec.layerModel.layers.some((l) => rolesOf(l).includes('repository'));
  if (def.role === 'repository' && !ownsRepositories) {
    const entity = base.replace(/Repository$/, '');
    const port = place(
      spec,
      'repository-interface',
      ['domain', 'application'],
      'repositories',
      `I${entity}Repository`,
      notes,
    );
    const impl = place(
      spec,
      'repository-impl',
      ['infrastructure'],
      'repositories',
      `Sql${entity}Repository`,
      notes,
    );
    if (port !== undefined)
      placements.push({
        ...port,
        why: `${port.why}; the interface (port) the use cases depend on`,
      });
    if (impl !== undefined)
      placements.push({
        ...impl,
        why: `${impl.why}; implements ${port?.className ?? 'the interface'} (prefix names the storage: Sql, InMemory, TypeOrm)`,
      });
  } else {
    const p = place(spec, def.role, def.kinds, def.dir, def.name(base), notes);
    if (p !== undefined) placements.push(p);
  }

  const summary =
    placements.length === 0
      ? `No placement found for "${input.purpose}"; see notes.`
      : placements.map((p) => `${p.className} -> ${p.path} (${p.layer})`).join('; ');
  return { purpose: input.purpose, summary, placements, notes };
}
