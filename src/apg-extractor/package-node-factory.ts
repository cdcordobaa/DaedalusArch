/**
 * Package node factory (FR-v1.2E-09, D-5).
 *
 * Names and creates the `Package` nodes that external imports point at:
 * built-ins (BR-U2-03, 04), package-shaped specifiers (BR-U2-05), alias names
 * that are not package-shaped (BR-U2-06) and relative paths into
 * `node_modules` (BR-U2-09, S-4). Node shape and identity follow
 * `domain-entities.md` §2.6 and §3.4.
 */
import type { APGNode, PackageNodeProperties } from '../shared/types/apg.js';
import { generateNodeId } from './id-generator.js';

export interface PackageRoot {
  /** '@scope/name', 'name', built-in 'fs', alias name '~'. */
  readonly name: string;
  readonly scope: PackageNodeProperties['scope'];
}

/**
 * Node built-in module names, pinned (BR-U2-03): the Node 22 `module.builtinModules`
 * list without `_`-prefixed and `node:`-only entries, written out literally so the
 * result does not depend on the Node version that runs the extractor.
 */
export const NODE_BUILTIN_MODULES: readonly string[] = Object.freeze([
  'assert', 'assert/strict', 'async_hooks', 'buffer', 'child_process', 'cluster',
  'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns',
  'dns/promises', 'domain', 'events', 'fs', 'fs/promises', 'http', 'http2', 'https',
  'inspector', 'inspector/promises', 'module', 'net', 'os', 'path', 'path/posix',
  'path/win32', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
  'readline/promises', 'repl', 'stream', 'stream/consumers', 'stream/promises',
  'stream/web', 'string_decoder', 'sys', 'timers', 'timers/promises', 'tls',
  'trace_events', 'tty', 'url', 'util', 'util/types', 'v8', 'vm', 'wasi',
  'worker_threads', 'zlib',
]);

const BUILTIN_SET: ReadonlySet<string> = new Set(NODE_BUILTIN_MODULES);

const NODE_PREFIX = 'node:';

/** Root of a package-shaped specifier (BR-U2-05), case-insensitive. */
const PACKAGE_ROOT_RE = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;

function firstSegment(spec: string): string {
  const slash = spec.indexOf('/');
  return slash === -1 ? spec : spec.slice(0, slash);
}

/** `@scope/name/sub` → `@scope/name`; `name/sub` → `name`. */
function rootOf(spec: string): string {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? spec);
}

function scopeOf(name: string): PackageNodeProperties['scope'] {
  return name.startsWith('@') ? (firstSegment(name) as `@${string}`) : 'npm';
}

/** True for `node:*` and for specifiers whose first segment is a pinned built-in name. */
export function isBuiltinSpecifier(specifier: string): boolean {
  if (specifier.startsWith(NODE_PREFIX)) return true;
  return BUILTIN_SET.has(specifier) || BUILTIN_SET.has(firstSegment(specifier));
}

/** Built-in Package root: the first segment without `node:` (`node:fs/promises` → `fs`), scope `node`. */
export function builtinRoot(specifier: string): PackageRoot {
  const bare = specifier.startsWith(NODE_PREFIX) ? specifier.slice(NODE_PREFIX.length) : specifier;
  return { name: firstSegment(bare), scope: 'node' };
}

/**
 * Package root of a package-shaped specifier (BR-U2-05): `@scope/name/sub` →
 * `@scope/name` / `@scope`, `name/sub` → `name` / `npm`. Returns `undefined`
 * when the root is not package-shaped (`~/x`, `#internal/x`, relative paths).
 */
export function packageRootFromSpecifier(specifier: string): PackageRoot | undefined {
  if (specifier.startsWith('@') && !specifier.includes('/')) return undefined;
  const name = rootOf(specifier);
  if (!PACKAGE_ROOT_RE.test(name)) return undefined;
  return { name, scope: scopeOf(name) };
}

/**
 * Alias name that is not package-shaped (BR-U2-06): the matched `paths` key with a
 * trailing `/*` removed (`~/*` → `~`, `#internal/*` → `#internal`), scope `npm`.
 */
export function packageRootFromAliasKey(pathsKey: string): PackageRoot {
  const name = pathsKey.endsWith('/*') ? pathsKey.slice(0, -2) : pathsKey;
  return { name, scope: 'npm' };
}

/** Alias name for a `baseUrl` match (BR-U2-06): the first segment of the specifier (`src/x` → `src`), scope `npm`. */
export function packageRootFromBaseUrlSpecifier(specifier: string): PackageRoot {
  return { name: firstSegment(specifier), scope: 'npm' };
}

/**
 * Package root named from a resolved path inside `node_modules` (BR-U2-09, S-4):
 * the segment after the last `node_modules/`, or two segments when it starts with
 * `@`. Used only for relative specifiers that resolve into `node_modules`.
 * Returns `undefined` when the path has no `node_modules` segment.
 */
export function packageRootFromNodeModulesPath(path: string): PackageRoot | undefined {
  const parts = path.split(/[\\/]/);
  const idx = parts.lastIndexOf('node_modules');
  if (idx === -1) return undefined;
  const first = parts[idx + 1];
  if (first === undefined || first === '') return undefined;
  if (first.startsWith('@')) {
    const second = parts[idx + 2];
    if (second === undefined || second === '') return undefined;
    const name = `${first}/${second}`;
    return { name, scope: first as `@${string}` };
  }
  return { name: first, scope: 'npm' };
}

/**
 * Registry of Package nodes for one extraction. Keyed by
 * `generateNodeId('Package', '', name)` (lower-cased input), so names that differ
 * only in case share one node; the first name and scope seen win (BR-U2-04).
 */
export class PackageNodeRegistry {
  private readonly byId = new Map<string, APGNode>();

  getOrCreate(root: PackageRoot): APGNode {
    const id = generateNodeId('Package', '', root.name);
    const existing = this.byId.get(id);
    if (existing !== undefined) return existing;
    const node: APGNode = {
      id,
      type: 'Package',
      name: root.name,
      filePath: '',
      decorators: [],
      properties: { scope: root.scope } satisfies PackageNodeProperties,
    };
    this.byId.set(id, node);
    return node;
  }

  /** Package nodes sorted by name in code-unit order. */
  nodes(): readonly APGNode[] {
    return [...this.byId.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
}
