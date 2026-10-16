/**
 * MCP v2 hints: fast forms of three APG v2 templates (`Docs/v1.3/apg2-design.md`, scoped by
 * `Docs/v1.3/apg2-scope-adr-draft.md`) and two cheap semantic proxies (`Docs/v1.3/cheap-semantics-design.md`), computed
 * from the changed file and the spec (plus, with a project root, the entry files of the target component). Every hint
 * is ADVISORY: the APG v2 templates are not in the sealed tier table (the scoring engine gives them the untiered
 * default), and the cheap proxies propose candidate sites, not verdicts. The tier `APG2_TEMPLATE_TIERS` proposes is
 * reported as `candidateTier`.
 *
 * The full forms read the type checker (SIGNATURE_USES, `originOfValue`); these read annotations and import bindings
 * only, so an inferred type or a value reached through an untyped parameter is invisible (limits in
 * `Docs/v1.3/mcp-v2.md`). Pure given the context.
 */
import { bindLayerParams } from '../fitness-compiler/layer-binding.js';
import { compositionRootLayers } from '../fitness-compiler/apg2-in-memory.js';
import { componentsFromLayerModel } from '../apg-extractor/apg2/components.js';
import { IO_PACKAGES } from '../apg-extractor/apg2/io-boundary.js';
import type { IoCategory } from '../apg-extractor/apg2/io-boundary.js';
import { categoryOfModule, DB_ACQUIRERS, RAW_DB_TYPES } from '../apg-enrich/cheap/behaviour.js';
import { APG2_COMPOSITION_ROOT_NAME_PATTERNS, isApg2TestPath, matchesAny } from '../shared/apg2-scope.js';
import { globToRegex } from '../fitness-compiler/glob-to-regex.js';
import type { ComponentDeclaration } from '../apg-extractor/types.js';
import { fullMatch, globMatch, layerOfTarget } from './fast-context.js';
import type { FastContext } from './fast-context.js';
import { reExportsOf } from './project-files.js';
import type { AstParam } from './source-ast.js';

export interface RawHint {
  readonly kind: 'apg2' | 'cheap';
  /** Template (`boundary-type-leak`, ...) or proxy (`repository-bypass`, `framework-in-core`) name. */
  readonly name: string;
  readonly line: number;
  readonly subject: string;
  readonly reason: string;
  readonly fix: string;
  readonly target?: string;
}

export const APG2_HINT_NAMES: readonly string[] = Object.freeze([
  'boundary-type-leak',
  'io-outside-adapters',
  'nondeterminism-in-core',
  'deep-import-declared-api',
  'deep-import-inferred-api',
]);
export const CHEAP_HINT_NAMES: readonly string[] = Object.freeze(['repository-bypass', 'framework-in-core']);

function isCompositionRoot(ctx: FastContext): boolean {
  return (ctx.layer !== null && compositionRootLayers(ctx.spec.layerModel).includes(ctx.layer)) ||
    matchesAny(APG2_COMPOSITION_ROOT_NAME_PATTERNS, ctx.file);
}

/** The bound package of a local name (`express` for `import { Request } from 'express'`), else undefined. */
function packageOf(ctx: FastContext, local: string): string | undefined {
  const b = ctx.bindings.get(local);
  if (b === undefined) return undefined;
  if (b.declaredIn.kind === 'package' || b.declaredIn.kind === 'builtin') return b.declaredIn.name.replace(/^node:/, '');
  return undefined;
}

function signatures(ctx: FastContext): { owner: string; line: number; params: readonly AstParam[]; returns: readonly string[]; exported: boolean; isPublic: boolean }[] {
  const out: { owner: string; line: number; params: readonly AstParam[]; returns: readonly string[]; exported: boolean; isPublic: boolean }[] = [];
  for (const cls of ctx.ast.classes) {
    for (const m of cls.methods) {
      out.push({ owner: `${cls.name}.${m.name}`, line: m.line, params: m.params, returns: m.returnTypeNames, exported: cls.exported, isPublic: m.visibility === 'public' });
    }
  }
  for (const f of ctx.ast.functions) out.push({ owner: f.name, line: f.line, params: f.params, returns: f.returnTypeNames, exported: f.exported, isPublic: true });
  return out;
}

// ── (1) boundary-type-leak ──────────────────────────────────────────────────────────────────────────────────────

function boundaryTypeLeak(ctx: FastContext): RawHint[] {
  const out: RawHint[] = [];
  const b = bindLayerParams(ctx.spec.layerModel.layers);
  const ml = ctx.layer;
  if (ml === null || b.infraLayer === undefined || ml === b.infraLayer) return out;
  if (!(ml === b.controllerLayer || b.applicationLayers.includes(ml)) || isCompositionRoot(ctx) || isApg2TestPath(ctx.file)) return out;
  for (const s of signatures(ctx)) {
    if (!s.exported || !s.isPublic) continue;
    const named = [...s.params.flatMap((p) => p.typeNames.map((t) => ({ t, pos: `parameter ${p.name}` }))), ...s.returns.map((t) => ({ t, pos: 'return' }))];
    for (const { t, pos } of named) {
      const bd = ctx.bindings.get(t);
      if (bd?.declaredIn.kind !== 'file' || layerOfTarget(ctx.spec, bd.declaredIn) !== b.infraLayer) continue;
      out.push({ kind: 'apg2', name: 'boundary-type-leak', line: s.line, subject: `${s.owner} ${pos}: ${t}`, target: bd.declaredIn.path,
        reason: `the public signature of ${s.owner} (${ml}) names ${t} from ${b.infraLayer} (${bd.declaredIn.path}): an infrastructure type leaks through the boundary`,
        fix: `Use a type of ${ml} or an inner layer in the signature (a DTO or a domain type), and map ${t} to it inside ${b.infraLayer}.` });
    }
  }
  return out;
}

// ── (5) io-outside-adapters, nondeterminism-in-core ─────────────────────────────────────────────────────────────

const CRYPTO_RANDOM = /^(randomUUID|randomBytes|randomInt|randomFill|randomFillSync|getRandomValues)$/;
const BLOCKING_IO: readonly IoCategory[] = ['db', 'http-out', 'fs'];

function ioHints(ctx: FastContext): RawHint[] {
  const b = bindLayerParams(ctx.spec.layerModel.layers);
  const ml = ctx.layer;
  if (ml === null || !(ml === b.domainLayer || b.applicationLayers.includes(ml)) || isApg2TestPath(ctx.file)) return [];
  const hits = new Map<string, { category: IoCategory; api: string; line: number; owner: string }>();
  const add = (category: IoCategory, api: string, line: number, owner: string | null): void => {
    const key = `${owner ?? ctx.file}|${category}`;
    if (!hits.has(key)) hits.set(key, { category, api, line, owner: owner ?? ctx.file });
  };
  for (const c of ctx.ast.calls) {
    if (c.inDecorator) continue;
    const [root, member] = c.chain;
    if (root === undefined) continue;
    const pkg = packageOf(ctx, root);
    const crypto = pkg === 'crypto' || (root === 'crypto' && !ctx.bindings.has('crypto'));
    if (pkg !== undefined && !crypto) {
      const cat = IO_PACKAGES.get(pkg);
      if (cat !== undefined) add(cat, `${pkg}:${c.chain.join('.')}`, c.line, c.className);
    } else if (root === 'fetch' && !ctx.bindings.has('fetch') && c.chain.length === 1) add('http-out', 'fetch', c.line, c.className);
    else if (root === 'Date' && !ctx.bindings.has('Date') && ((member === 'now' && !c.isNew) || (c.isNew && c.chain.length === 1 && c.argCount === 0))) add('clock', c.isNew ? 'new Date()' : 'Date.now', c.line, c.className);
    else if (root === 'performance' && member === 'now') add('clock', 'performance.now', c.line, c.className);
    else if (root === 'Math' && member === 'random') add('random', 'Math.random', c.line, c.className);
    else if (crypto && member !== undefined && CRYPTO_RANDOM.test(member)) add('random', `crypto.${member}`, c.line, c.className);
    else if (crypto && pkg === 'crypto' && c.chain.length === 1) {
      const imported = ctx.bindings.get(root)?.imported ?? '';
      if (CRYPTO_RANDOM.test(imported)) add('random', `crypto.${imported}`, c.line, c.className);
    }
  }
  for (const r of ctx.ast.propertyReads) {
    if (ctx.bindings.has('process')) break;
    add(r.chain[1] === 'env' ? 'env' : 'process', r.chain.join('.'), r.line, r.className);
  }
  return [...hits.values()].map((h) => {
    const blocking = BLOCKING_IO.includes(h.category);
    return {
      kind: 'apg2' as const,
      name: blocking ? 'io-outside-adapters' : 'nondeterminism-in-core',
      line: h.line,
      subject: `${h.owner}: ${h.api}`,
      reason: `${h.owner} in ${ml} performs ${h.category} I/O (${h.api})`,
      fix: blocking
        ? `Move the ${h.category} call into an adapter in ${b.infraLayer ?? 'infrastructure'} behind a port declared in ${ml}, and inject the port.`
        : `Inject the ${h.category} source (a Clock, IdGenerator or Config port) instead of reading it in ${ml}, so the core stays deterministic.`,
    };
  });
}

// ── (2b) deep imports ───────────────────────────────────────────────────────────────────────────────────────────

function rootDirOf(decl: ComponentDeclaration): string | undefined {
  const dirs = decl.include.map((g) => {
    const i = g.search(/[*?{[]/);
    const head = i < 0 ? g : g.slice(0, i);
    return head.endsWith('/') ? head : head.slice(0, head.lastIndexOf('/') + 1);
  });
  return dirs.length === 1 && dirs[0] !== '' ? dirs[0] : undefined;
}

function inComponent(decl: ComponentDeclaration, file: string): boolean {
  return decl.include.some((g) => globMatch(g, file)) || (decl.includeByName ?? []).some((g) => globMatch(g, file.split('/').pop() ?? file));
}

function isBarrel(text: string): boolean {
  const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').trim();
  return code !== '' && code.split(/;?\s*\n|;/).map((s) => s.trim()).filter((s) => s !== '').every((s) => /^export\s+(?:type\s+)?(?:\*|\{)/.test(s));
}

/** Entry files of a component (declared public API, or the root index), plus barrels they re-export (scope change 6). */
function entryFiles(ctx: FastContext, decl: ComponentDeclaration): { files: Set<string>; declared: boolean } {
  const files = new Set<string>();
  const declared = decl.publicApi !== undefined && decl.publicApi.length > 0;
  const seeds: string[] = [];
  if (declared) {
    for (const g of decl.publicApi ?? []) if (!/[*?{[]/.test(g)) seeds.push(g);
  } else {
    const root = rootDirOf(decl);
    if (root !== undefined) for (const ext of ['ts', 'tsx', 'mts', 'cts']) if (ctx.view.exists(`${root}index.${ext}`)) seeds.push(`${root}index.${ext}`);
  }
  const queue = [...seeds];
  for (const s of seeds) files.add(s);
  while (queue.length > 0) {
    const f = queue.shift() ?? '';
    const text = ctx.view.read(f);
    if (text === undefined) continue;
    for (const r of reExportsOf(text)) {
      const t = ctx.view.resolveModule(f, r.specifier);
      if (t.kind !== 'file' || files.has(t.path) || !inComponent(decl, t.path)) continue;
      const inner = ctx.view.read(t.path);
      if (inner === undefined || !isBarrel(inner)) continue;
      files.add(t.path);
      queue.push(t.path);
    }
  }
  return { files, declared };
}

function deepImports(ctx: FastContext): RawHint[] {
  const out: RawHint[] = [];
  if (isCompositionRoot(ctx) || isApg2TestPath(ctx.file)) return out;
  const decls = componentsFromLayerModel(ctx.spec.layerModel);
  const acl = (ctx.spec.layerModel.ddd?.contexts ?? []).flatMap((c) => c.acl).some((g) => fullMatch(globToRegex(g, { segmentGlobstar: true }), ctx.file));
  for (const e of ctx.edges) {
    if (e.literal.kind !== 'file' || e.imp.kind === 'require' || e.imp.kind === 'dynamic') continue;
    const target = e.literal.path;
    for (const kind of ['layer', 'module'] as const) {
      const decl = decls.find((d) => d.kind === kind && inComponent(d, target));
      if (decl === undefined || inComponent(decl, ctx.file)) continue;
      if (kind === 'module' && acl) continue;
      const entries = entryFiles(ctx, decl);
      const declaredHit = entries.declared && (decl.publicApi ?? []).some((g) => fullMatch(globToRegex(g, { segmentGlobstar: true }), target));
      if (entries.files.size === 0 && !entries.declared) continue;
      if (declaredHit || entries.files.has(target)) continue;
      const name = entries.declared ? 'deep-import-declared-api' : 'deep-import-inferred-api';
      out.push({ kind: 'apg2', name, line: e.imp.line, subject: `import "${e.imp.specifier}"`, target,
        reason: `${ctx.file} imports ${target}, a non-public file of component ${decl.name} (${kind}); its entry files are ${[...entries.files].join(', ') || (decl.publicApi ?? []).join(', ')}`,
        fix: `Import from ${decl.name}'s entry file (${[...entries.files][0] ?? (decl.publicApi ?? [])[0] ?? 'its index'}) instead, exporting the name there if it is meant to be public.` });
      break;
    }
  }
  return out;
}

// ── Cheap proxies ───────────────────────────────────────────────────────────────────────────────────────────────

const REPO_NAME_ROLES = ['Repository', 'Repo', 'Dao', 'Store'];
const NEST_HTTP_TYPES = new Set(['ExecutionContext', 'ArgumentsHost', 'CallHandler', 'HttpArgumentsHost', 'StreamableFile']);
const NODE_HTTP_TYPES = new Set(['IncomingMessage', 'ServerResponse', 'OutgoingMessage']);

function repositoryBypass(ctx: FastContext): RawHint[] {
  const out: RawHint[] = [];
  if (ctx.layerKind === 'infrastructure') return out;
  const isDb = (local: string): string | undefined => {
    const pkg = packageOf(ctx, local);
    return pkg !== undefined && categoryOfModule(pkg) === 'db' ? pkg : undefined;
  };
  for (const c of ctx.ast.calls) {
    if (c.inDecorator) continue;
    if (c.className !== null && REPO_NAME_ROLES.some((r) => c.className?.endsWith(r) === true)) continue;
    const [root, ...rest] = c.chain;
    if (root === undefined) continue;
    let what: string | undefined;
    const pkg = isDb(root);
    const imported = ctx.bindings.get(root)?.imported ?? root;
    if (pkg !== undefined && (DB_ACQUIRERS.has(imported) || rest.some((r) => DB_ACQUIRERS.has(r)))) what = `${pkg} ${c.isNew ? 'new ' : ''}${c.chain.join('.')}`;
    else if (root === 'this' && rest.length >= 2 && c.className !== null) {
      const cls = ctx.ast.classes.find((k) => k.name === c.className);
      const field = rest[0] ?? '';
      const types = cls?.fieldTypes[field] ?? cls?.ctorParams.find((p) => p.name === field)?.typeNames ?? [];
      const raw = types.find((t) => RAW_DB_TYPES.has(ctx.bindings.get(t)?.imported ?? t) && isDb(t) !== undefined);
      if (raw !== undefined) what = `${isDb(raw) ?? ''} ${raw} via this.${field}.${rest.slice(1).join('.')}`;
    }
    if (what === undefined) continue;
    out.push({ kind: 'cheap', name: 'repository-bypass', line: c.line, subject: `${c.className ?? ctx.file}: ${c.chain.join('.')}`,
      reason: `direct persistence use (${what.trim()}) outside a repository and outside infrastructure`,
      fix: 'Call a repository (an interface in the domain, implemented in infrastructure) instead of the ORM or database client.' });
  }
  return out;
}

function frameworkInCore(ctx: FastContext): RawHint[] {
  const out: RawHint[] = [];
  if (ctx.layerKind !== 'application' && ctx.layerKind !== 'domain') return out;
  const persistence = ctx.layerKind === 'domain';
  const framework = (t: string): string | undefined => {
    if (t.startsWith('import:')) {
      const [pkg = '', name = ''] = t.slice(7).split('.');
      return categoryOfModule(pkg) === 'transport' || (persistence && categoryOfModule(pkg) === 'db') ? `${pkg}.${name}` : undefined;
    }
    const pkg = packageOf(ctx, t);
    if (pkg === undefined) return undefined;
    const imported = ctx.bindings.get(t)?.imported ?? t;
    const cat = categoryOfModule(pkg);
    if (cat === 'transport') return `${pkg}.${imported}`;
    if (pkg === '@nestjs/common' && NEST_HTTP_TYPES.has(imported)) return `${pkg}.${imported}`;
    if ((pkg === 'http' || pkg === 'https') && NODE_HTTP_TYPES.has(imported)) return `${pkg}.${imported}`;
    if (persistence && cat === 'db') return `${pkg}.${imported}`;
    return undefined;
  };
  for (const s of signatures(ctx)) {
    for (const p of s.params) {
      for (const t of p.typeNames) {
        const f = framework(t);
        if (f !== undefined) out.push({ kind: 'cheap', name: 'framework-in-core', line: p.line, subject: `${s.owner} parameter ${p.name}: ${t}`,
          reason: `${ctx.layerKind} ${s.owner} takes a framework type (${f}) as parameter ${p.name}`,
          fix: `Take a plain ${ctx.layerKind} type (a command or DTO) and convert the framework object in the controller or adapter.` });
      }
    }
    for (const t of s.returns) {
      const f = framework(t);
      if (f !== undefined) out.push({ kind: 'cheap', name: 'framework-in-core', line: s.line, subject: `${s.owner} return: ${t}`,
        reason: `${ctx.layerKind} ${s.owner} returns a framework type (${f})`,
        fix: `Return a plain ${ctx.layerKind} type and build the framework response in the controller or adapter.` });
    }
  }
  return out;
}

/** Every hint for one file, in line order. */
export function fastHints(ctx: FastContext): RawHint[] {
  return [...boundaryTypeLeak(ctx), ...ioHints(ctx), ...deepImports(ctx), ...repositoryBypass(ctx), ...frameworkInCore(ctx)]
    .sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
}
