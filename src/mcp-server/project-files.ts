/**
 * The project as the MCP v2 fast checks may see it: the files on disk under the configured project root (read-only),
 * overlaid with the proposed contents of the files being checked. Used for what one file cannot answer alone:
 * whether a module path is a file or a directory index, the declaring file behind a barrel (the resolved
 * `viaReExport` edge of ADR-V13-01, `Docs/v1.3/edge-views.md`), whether an imported name is a class or an interface,
 * and the literal import graph for the cycle check. With no project root every answer degrades to the lexical one
 * (`exists` false, no barrel followed, no cycle check), and the results say so in their notes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isBuiltinSpecifier } from '../apg-extractor/package-node-factory.js';
import { normalisePath } from './layer-resolver.js';
import { packageRoot } from './import-check.js';
import { scanSource } from './source-scan.js';

export type ModuleTarget =
  | { readonly kind: 'file'; readonly path: string; readonly exists: boolean }
  | { readonly kind: 'package'; readonly name: string }
  | { readonly kind: 'builtin'; readonly name: string };

/** One end of a resolved edge: the declaring file (or package) and the barrels on the way (empty for a direct import). */
export interface ResolvedTarget {
  readonly target: ModuleTarget;
  readonly viaBarrels: readonly string[];
  /** The names that reach this target. */
  readonly names: readonly string[];
}

const SOURCE_EXT_RE = /\.(?:[cm]?[jt]sx?)$/;
const JS_EXT_RE = /\.(?:[cm]?js|jsx)$/;
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);
const MAX_BARREL_DEPTH = 6;

export interface ProjectViewOptions {
  /** Absolute project root; undefined for a spec-only check. */
  readonly root?: string | undefined;
  /** Project-relative path to proposed content, read in place of the disk. */
  readonly overrides?: ReadonlyMap<string, string>;
}

/** A read-only view of the project with proposed overrides. */
export class ProjectView {
  readonly root: string | undefined;
  private readonly overrides: ReadonlyMap<string, string>;
  private readonly cache = new Map<string, string | undefined>();

  constructor(options: ProjectViewOptions = {}) {
    this.root = options.root !== undefined ? path.resolve(options.root) : undefined;
    this.overrides = options.overrides ?? new Map();
  }

  get hasRoot(): boolean {
    return this.root !== undefined;
  }

  /** Content of a project-relative file (override first), undefined when absent or outside the root. */
  read(rel: string): string | undefined {
    const file = normalisePath(rel);
    const o = this.overrides.get(file);
    if (o !== undefined) return o;
    if (this.root === undefined) return undefined;
    if (this.cache.has(file)) return this.cache.get(file);
    const abs = path.resolve(this.root, file);
    let text: string | undefined;
    if (abs.startsWith(this.root + path.sep) && fs.existsSync(abs) && fs.statSync(abs).isFile() && this.insideRealRoot(abs)) text = fs.readFileSync(abs, 'utf8');
    this.cache.set(file, text);
    return text;
  }

  private realRoot: string | undefined;

  /**
   * Whether the file, symlinks resolved, is still under the realpath of the root. The lexical check alone lets a
   * symlink inside the project read any file on the host (R06, post-merge review 2026-10-16).
   */
  private insideRealRoot(abs: string): boolean {
    try {
      this.realRoot ??= fs.realpathSync(this.root ?? '');
      const real = fs.realpathSync(abs);
      return real.startsWith(this.realRoot + path.sep);
    } catch {
      return false;
    }
  }

  exists(rel: string): boolean {
    return this.read(rel) !== undefined;
  }

  /** Resolves a specifier from `fromFile`: a project file (relative, or a bare project path), a package or a builtin. */
  resolveModule(fromFile: string, specifier: string, isProjectPath?: (p: string) => boolean): ModuleTarget {
    if (isBuiltinSpecifier(specifier)) return { kind: 'builtin', name: specifier };
    const relative = specifier.startsWith('.') || specifier.startsWith('/');
    const base = relative
      ? normalisePath(specifier.startsWith('/') ? specifier : path.posix.join(path.posix.dirname(normalisePath(fromFile)), specifier))
      : normalisePath(specifier);
    const candidates = candidateFiles(base);
    for (const c of candidates) if (this.exists(c)) return { kind: 'file', path: c, exists: true };
    if (relative) return { kind: 'file', path: candidates[0] ?? base, exists: false };
    if (isProjectPath !== undefined) {
      const hit = candidates.find((c) => isProjectPath(c));
      if (hit !== undefined) return { kind: 'file', path: hit, exists: false };
    }
    return { kind: 'package', name: packageRoot(specifier) };
  }

  /**
   * The declaring files of `names` imported from `file`, through `export { } from` and `export * from` chains. A name
   * the file declares itself, or any name when the file cannot be read, resolves to the file. Packages end a chain.
   */
  resolveNames(file: string, names: readonly string[]): ResolvedTarget[] {
    const out = new Map<string, { target: ModuleTarget; viaBarrels: string[]; names: string[] }>();
    const add = (target: ModuleTarget, via: readonly string[], name: string): void => {
      const key = `${target.kind}:${target.kind === 'file' ? target.path : target.name}|${via.join('>')}`;
      const row = out.get(key) ?? { target, viaBarrels: [...via], names: [] };
      if (!row.names.includes(name)) row.names.push(name);
      out.set(key, row);
    };
    for (const name of names) {
      const hit = this.follow(file, name, [], 0);
      add(hit.target, hit.via, name);
    }
    return [...out.values()];
  }

  private follow(file: string, name: string, via: readonly string[], depth: number): { target: ModuleTarget; via: readonly string[] } {
    const self = { target: { kind: 'file' as const, path: file, exists: this.exists(file) }, via };
    const text = this.read(file);
    if (text === undefined || depth >= MAX_BARREL_DEPTH || name === '*' || name === 'default') return self;
    if (declaresName(text, name)) return self;
    for (const r of reExportsOf(text)) {
      const exported = r.names === null ? undefined : r.names.find((n) => n.exported === name);
      if (r.names !== null && exported === undefined) continue;
      const target = this.resolveModule(file, r.specifier);
      if (target.kind !== 'file') {
        if (r.names !== null) return { target, via: [...via, file] };
        continue;
      }
      if (r.names === null) {
        const t = this.read(target.path);
        if (t === undefined || !exportsName(t, name, this, target.path, depth + 1)) continue;
      }
      return this.follow(target.path, exported?.local ?? name, [...via, file], depth + 1);
    }
    return self;
  }

  /** `class` or `interface` when `file` declares `name` as one; `other` for any other declaration; undefined when unknown. */
  declarationKind(file: string, name: string): 'class' | 'interface' | 'other' | undefined {
    const text = this.read(file);
    if (text === undefined) return undefined;
    if (new RegExp(`\\b(?:abstract\\s+)?class\\s+${escape(name)}\\b`).test(text)) return 'class';
    if (new RegExp(`\\binterface\\s+${escape(name)}\\b`).test(text)) return 'interface';
    return declaresName(text, name) ? 'other' : undefined;
  }

  /** Project-relative paths of every source file under the root (sorted; empty with no root). */
  sourceFiles(): string[] {
    if (this.root === undefined) return [...this.overrides.keys()].filter((f) => SOURCE_EXT_RE.test(f)).sort();
    const out = new Set<string>();
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') || IGNORED_DIRS.has(e.name)) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs);
        else if (SOURCE_EXT_RE.test(e.name) && !e.name.endsWith('.d.ts')) out.add(path.relative(this.root ?? '', abs).split(path.sep).join('/'));
      }
    };
    walk(this.root);
    for (const k of this.overrides.keys()) if (SOURCE_EXT_RE.test(k)) out.add(k);
    return [...out].sort();
  }

  /**
   * The literal import graph (ADR-V13-01 literal view: an import ends at the module its specifier names, a barrel
   * included; `export ... from` counts, as RE_EXPORTS does): project file to the project files it imports.
   * `require()` and `import()` are left out (the extractor does not model them, BR-U2-25).
   */
  importGraph(): ReadonlyMap<string, ReadonlySet<string>> {
    const graph = new Map<string, Set<string>>();
    for (const file of this.sourceFiles()) {
      const text = this.read(file);
      if (text === undefined) continue;
      const edges = new Set<string>();
      for (const imp of scanSource(text).imports) {
        if (imp.kind === 'require' || imp.kind === 'dynamic') continue;
        const t = this.resolveModule(file, imp.specifier);
        if (t.kind === 'file' && t.exists && t.path !== file) edges.add(t.path);
      }
      graph.set(file, edges);
    }
    return graph;
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Candidate files of a module path: as written (a `.js` specifier also as `.ts`), with an extension, as a directory index. */
export function candidateFiles(modulePath: string): string[] {
  const out: string[] = [];
  const push = (p: string): void => {
    if (!out.includes(p)) out.push(p);
  };
  if (SOURCE_EXT_RE.test(modulePath)) {
    if (JS_EXT_RE.test(modulePath)) {
      const bare = modulePath.replace(JS_EXT_RE, '');
      push(`${bare}.ts`);
      push(`${bare}.tsx`);
    }
    push(modulePath);
    return out;
  }
  for (const ext of ['.ts', '.tsx', '.js', '.mts', '.cts']) push(`${modulePath}${ext}`);
  for (const ext of ['.ts', '.tsx', '.js']) push(`${modulePath}/index${ext}`);
  return out;
}

/** True when `text` declares `name` at top level (or exports a local binding of it). */
export function declaresName(text: string, name: string): boolean {
  const n = escape(name);
  return new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:declare\\s+)?(?:default\\s+)?(?:abstract\\s+)?(?:class|interface|function\\*?|type|enum|const|let|var|namespace)\\s+${n}\\b`).test(text);
}

interface ReExport {
  readonly specifier: string;
  /** null for `export * from`. */
  readonly names: readonly { readonly exported: string; readonly local: string }[] | null;
}

const RE_EXPORT_RE = /\bexport\s+(?:type\s+)?(\*(?:\s+as\s+([A-Za-z_$][\w$]*))?|\{([^}]*)\})\s*from\s*(['"])([^'"\n]+)\4/g;

/** The `export { a as b } from 'x'` and `export * from 'x'` statements of a text. */
export function reExportsOf(text: string): ReExport[] {
  const out: ReExport[] = [];
  for (const m of text.matchAll(RE_EXPORT_RE)) {
    const specifier = m[5] ?? '';
    if (m[3] !== undefined) {
      const names = m[3].split(',').map((s) => s.trim().replace(/^type\s+/, '')).filter((s) => s !== '').map((s) => {
        const [local, exported] = s.split(/\s+as\s+/);
        return { local: (local ?? s).trim(), exported: (exported ?? local ?? s).trim() };
      });
      out.push({ specifier, names });
    } else if (m[2] !== undefined) {
      out.push({ specifier, names: [{ local: '*', exported: m[2] }] });
    } else {
      out.push({ specifier, names: null });
    }
  }
  return out;
}

function exportsName(text: string, name: string, view: ProjectView, file: string, depth: number): boolean {
  if (declaresName(text, name)) return true;
  if (depth >= MAX_BARREL_DEPTH) return false;
  for (const r of reExportsOf(text)) {
    if (r.names !== null) {
      if (r.names.some((n) => n.exported === name)) return true;
      continue;
    }
    const t = view.resolveModule(file, r.specifier);
    if (t.kind !== 'file') continue;
    const inner = view.read(t.path);
    if (inner !== undefined && exportsName(inner, name, view, t.path, depth + 1)) return true;
  }
  return false;
}

/** The project files of a literal graph that `from` reaches within `maxDepth` steps, with one shortest path each. */
export function pathTo(graph: ReadonlyMap<string, ReadonlySet<string>>, from: string, to: string, maxDepth: number): string[] | undefined {
  const prev = new Map<string, string>();
  let frontier = [from];
  const seen = new Set([from]);
  for (let d = 0; d < maxDepth && frontier.length > 0; d++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const t of [...(graph.get(f) ?? [])].sort()) {
        if (seen.has(t)) continue;
        seen.add(t);
        prev.set(t, f);
        if (t === to) {
          const out = [t];
          let cur = t;
          while (cur !== from) {
            cur = prev.get(cur) ?? from;
            out.unshift(cur);
          }
          return out;
        }
        next.push(t);
      }
    }
    frontier = next;
  }
  return undefined;
}

