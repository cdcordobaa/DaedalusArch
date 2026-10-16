/**
 * v1.3 real-world ("wild") evidence run: pure helpers shared by `scripts/v1.3/wild-run.ts` and
 * `scripts/v1.3/wild-sheet.ts` (Docs/DiagnosticRuns/v1.3-wild-2026-10-16.md).
 *
 * - `flattenTsconfig`: one self-contained harness tsconfig per repository (the `extends` chain merged, build-only and
 *   type-package options dropped, `src/` sources only, tests excluded), so every instrument reads the same file set
 *   without installing the repository's dependencies.
 * - `memberLine`, `excerpt`: locate and show a finding for the human review sheet (comments stripped).
 * - `diverseSample`: a seeded sample that spreads over repositories before taking a second item from one.
 * - `apg2Claim`: the neutral claim text of an APG v2 template row (no template id).
 */
import { stripComments } from './labelling/excerpt-scrub.js';
import { seededSample } from './graph-fidelity.js';

// ── Harness tsconfig ─────────────────────────────────────────────────────────

/** Compiler options kept from the repository's chain; everything else (emit, build mode, `types`, plugins) is dropped. */
export const KEPT_COMPILER_OPTIONS = [
  'target', 'module', 'moduleResolution', 'lib', 'jsx', 'experimentalDecorators', 'emitDecoratorMetadata', 'strict',
  'strictNullChecks', 'noImplicitAny', 'esModuleInterop', 'allowSyntheticDefaultImports', 'resolveJsonModule',
  'baseUrl', 'paths', 'allowImportingTsExtensions', 'rewriteRelativeImportExtensions', 'verbatimModuleSyntax',
  'isolatedModules', 'useDefineForClassFields', 'customConditions', 'moduleSuffixes', 'moduleDetection',
] as const;

/** Test files never enter the harness program (`src/` production code only). */
export const TEST_EXCLUDES = ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts', '**/__tests__/**', '**/__mocks__/**', '**/test/**', '**/tests/**'];

export interface ConfigReader {
  /** The parsed JSON (comments allowed) of a config file, or undefined when it does not exist. */
  read(absPath: string): Record<string, unknown> | undefined;
  /** The absolute path of a package specifier (`@scope/config/tsconfig.json`) inside the checkout, e.g. a workspace package. */
  resolvePackage?(specifier: string): string | undefined;
}

export interface FlattenResult {
  readonly tsconfig: { compilerOptions: Record<string, unknown>; include: string[]; exclude: string[] };
  /** Config files merged, base first. */
  readonly chain: string[];
  /** What could not be followed or was changed (recorded in the run's failures section). */
  readonly notes: string[];
}

const posix = (p: string): string => p.replace(/\\/g, '/');
function dirname(p: string): string {
  const i = posix(p).lastIndexOf('/');
  return i <= 0 ? '/' : posix(p).slice(0, i);
}
/** POSIX `path.resolve` for absolute bases (kept local so the helper is pure and testable with virtual paths). */
export function resolvePosix(base: string, rel: string): string {
  const parts = (rel.startsWith('/') ? rel : `${base}/${rel}`).split('/');
  const out: string[] = [];
  for (const s of parts) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return `/${out.join('/')}`;
}
/** POSIX `path.relative`, `.` for the same directory. */
export function relativePosix(from: string, to: string): string {
  const a = resolvePosix('/', from).split('/').filter(Boolean);
  const b = resolvePosix('/', to).split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const r = [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/');
  return r === '' ? '.' : r;
}

/**
 * Merges `configPath` and its `extends` chain (relative paths only; a package specifier is recorded and skipped, since
 * the repositories' dependencies are not installed) into one tsconfig written at `rootDir`. `baseUrl` and `paths` are
 * rebased to `rootDir`; `paths` without a `baseUrl` get the directory of the config that declared them.
 */
export function flattenTsconfig(configPath: string, rootDir: string, reader: ConfigReader, include: readonly string[] = ['src/**/*.ts', 'src/**/*.tsx']): FlattenResult {
  const notes: string[] = [];
  const chain: string[] = [];
  const merged: Record<string, unknown> = {};
  let baseUrlAbs: string | undefined;
  let pathsDir: string | undefined;
  const visit = (abs: string, depth: number): void => {
    if (depth > 10) { notes.push(`extends chain deeper than 10 at ${abs}`); return; }
    const json = reader.read(abs);
    if (json === undefined) { notes.push(`config not found: ${abs}`); return; }
    const ext = json.extends;
    for (const e of typeof ext === 'string' ? [ext] : Array.isArray(ext) ? ext.filter((x): x is string => typeof x === 'string') : []) {
      if (e.startsWith('.') || e.startsWith('/')) {
        const target = resolvePosix(dirname(abs), e.endsWith('.json') ? e : `${e}.json`);
        visit(target, depth + 1);
      } else {
        const ws = reader.resolvePackage?.(e);
        if (ws !== undefined) {
          notes.push(`extends "${e}" resolved to the workspace package file ${ws}`);
          visit(ws, depth + 1);
        } else notes.push(`extends "${e}" (package) not followed: dependencies are not installed`);
      }
    }
    chain.push(abs);
    const co = (json.compilerOptions ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(co)) {
      if (!(KEPT_COMPILER_OPTIONS as readonly string[]).includes(k)) continue;
      if (k === 'baseUrl' && typeof v === 'string') baseUrlAbs = resolvePosix(dirname(abs), v);
      if (k === 'paths') pathsDir = dirname(abs);
      merged[k] = v;
    }
  };
  visit(posix(configPath), 0);
  const root = posix(rootDir);
  if (baseUrlAbs !== undefined) merged.baseUrl = relativePosix(root, baseUrlAbs);
  else if (merged.paths !== undefined && pathsDir !== undefined) merged.baseUrl = relativePosix(root, pathsDir);
  // `module: nodenext` requires the matching resolution; a merged chain can pair it with an inherited `node`.
  const mod = String(merged.module ?? '').toLowerCase();
  const res = String(merged.moduleResolution ?? '').toLowerCase();
  if ((mod === 'nodenext' || mod === 'node16') && res !== mod) {
    if (merged.moduleResolution !== undefined) notes.push(`moduleResolution ${String(merged.moduleResolution)} replaced by ${String(merged.module)} (required by module ${String(merged.module)})`);
    merged.moduleResolution = merged.module;
  }
  const compilerOptions = { ...merged, noEmit: true, skipLibCheck: true, allowJs: false };
  return { tsconfig: { compilerOptions, include: [...include], exclude: [...TEST_EXCLUDES] }, chain, notes };
}

// ── What an import graph can see ─────────────────────────────────────────────

/**
 * Whether an import graph of the file could show the I/O of an APG v2 PERFORMS_IO row: true when one of its APIs is
 * `<package>:<call>` and the file imports that package (`node:` prefix ignored). Globals (`process.env`, `new Date()`,
 * `Math.random`, `fetch`) and calls on an injected client whose package the file never imports are invisible to it.
 */
export function apiVisibleInImports(apis: readonly string[], filePackages: ReadonlySet<string>): boolean {
  const norm = (p: string): string => p.replace(/^node:/, '');
  const pkgs = new Set([...filePackages].map(norm));
  return apis.some((a) => {
    const i = a.indexOf(':');
    if (i <= 0 || a.startsWith('node:') && a.indexOf(':', 5) < 0) return false;
    const pkg = a.startsWith('node:') ? a.slice(0, a.indexOf(':', 5)) : a.slice(0, i);
    return pkgs.has(norm(pkg));
  });
}

// ── Locating and showing a finding ───────────────────────────────────────────

/**
 * 1-based line of a class member `Class.member` (or a top-level `member`) in `content`: the first line after the
 * class header that declares the member (`member(`, `member<`, `async member(`, `member = (`, `get member(`).
 * 0 when not found.
 */
export function memberLine(content: string, member: string): number {
  const dot = member.lastIndexOf('.');
  const cls = dot >= 0 ? member.slice(0, dot) : undefined;
  const name = (dot >= 0 ? member.slice(dot + 1) : member).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = content.split('\n');
  let from = 0;
  if (cls !== undefined) {
    const esc = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const h = lines.findIndex((l) => new RegExp(`\\b(class|interface)\\s+${esc}\\b`).test(l));
    if (h < 0) return 0;
    from = h + 1;
  }
  const decl = new RegExp(`^\\s*(?:(?:export|default|public|private|protected|static|async|readonly|override|abstract|get|set|function|const|let)\\s+)*\\*?${name}\\s*(?:[(<]|=\\s*(?:async\\s*)?\\(|[?!]?\\s*:)`);
  for (let i = from; i < lines.length; i++) if (decl.test(lines[i] ?? '')) return i + 1;
  return 0;
}

/** A numbered excerpt of `content` around 1-based `line` (comments stripped, blank runs collapsed, max `maxLines`). */
export function excerpt(content: string, line: number, before = 3, after = 8, maxLines = 14): string {
  const lines = stripComments(content).split('\n');
  const lo = Math.max(1, line - before);
  const hi = Math.min(lines.length, line + after);
  const out: string[] = [];
  let blank = false;
  for (let i = lo; i <= hi && out.length < maxLines; i++) {
    const text = (lines[i - 1] ?? '').trimEnd();
    if (text.trim() === '') {
      if (blank) continue;
      blank = true;
    } else blank = false;
    out.push(`${String(i).padStart(5)}${i === line ? '>' : ' '} ${text}`);
  }
  return out.join('\n');
}

// ── Sampling ─────────────────────────────────────────────────────────────────

/**
 * Up to `n` items, seeded: a seeded shuffle of the pool (`seededSample` over all of it), then the first item of each
 * repository in shuffle order, then the second, and so on, so a sample spreads over repositories before repeating one.
 * The pool order must be deterministic.
 */
export function diverseSample<T>(pool: readonly T[], n: number, rnd: () => number, repoOf: (x: T) => string): T[] {
  const shuffled = seededSample(pool, pool.length, rnd);
  const byRepo = new Map<string, T[]>();
  const order: string[] = [];
  for (const x of shuffled) {
    const r = repoOf(x);
    if (!byRepo.has(r)) { byRepo.set(r, []); order.push(r); }
    byRepo.get(r)!.push(x);
  }
  const out: T[] = [];
  for (let round = 0; out.length < Math.min(n, pool.length); round++) {
    for (const r of order) {
      const x = byRepo.get(r)![round];
      if (x !== undefined && out.length < n) out.push(x);
    }
  }
  return out;
}

// ── Claims ───────────────────────────────────────────────────────────────────

const s = (v: unknown): string => (v === undefined || v === null ? '?' : Array.isArray(v) ? v.map(String).join(', ') : String(v));
const n2 = (v: unknown): string => (typeof v === 'number' ? v.toFixed(2) : s(v));

/** The neutral claim of an APG v2 template row (what a reviewer judges), without naming the template. */
export function apg2Claim(template: string, row: Readonly<Record<string, unknown>>): string {
  switch (template) {
    case 'boundary-type-leak':
      return `The public ${s(row.positions)} type of \`${s(row.member)}\` (layer ${s(row.fromLayer)}) exposes \`${s(row.leakedType)}\`, a type declared in the ${s(row.toLayer)} layer (${s(row.target)}).`;
    case 'component-adp-cycle':
      return `Component \`${s(row.component)}\` depends on \`${s(row.target)}\` (${s(row.imports)} import(s)), and \`${s(row.target)}\` depends back on \`${s(row.component)}\` (directly or transitively): a dependency cycle between ${s(row.kind)} components.`;
    case 'component-sdp-violation':
      return `Component \`${s(row.component)}\` (instability ${n2(row.fromInstability)}) depends on the less stable component \`${s(row.target)}\` (instability ${n2(row.toInstability)}).`;
    case 'component-main-sequence-distance':
      return `Component \`${s(row.component)}\` lies far from the main sequence: abstractness ${n2(row.abstractness)}, instability ${n2(row.instability)}, distance ${n2(row.distance)}.`;
    case 'deep-import-declared-api':
    case 'deep-import-inferred-api':
      return `This file imports \`${s(row.target)}\`, an internal file of component \`${s(row.component)}\`, instead of going through that component's public entry point.`;
    case 'undeclared-async-coupling':
      return `Component \`${s(row.publisherComponent)}\` publishes on channel \`${s(row.channel)}\` (${s(row.transport)}) and component \`${s(row.subscriberComponent)}\` (${s(row.target)}) subscribes to it: a run-time coupling with no declared dependency.`;
    case 'io-outside-adapters':
    case 'nondeterminism-in-core':
      return `\`${s(row.member)}\` in the ${s(row.layer)} layer performs ${s(row.category)} I/O or side effects directly (${s(row.apis)}).`;
    default:
      return JSON.stringify(row);
  }
}

/**
 * The neutral claim of a cheap-proxy flag: its message, reworded where the bare message is a metric a reviewer cannot
 * judge without knowing the proxy (no proxy id or flag kind in the text).
 */
export function cheapClaim(flag: { readonly kind: string; readonly message: string; readonly className?: string; readonly related?: { readonly file: string; readonly startLine: number } }): string {
  const other = flag.related !== undefined ? ` (other end: ${flag.related.file}:${String(flag.related.startLine)})` : '';
  const m = flag.message;
  switch (flag.kind) {
    case 'broad-responsibility': {
      const x = /^(.*): (\d+) I\/O categories, (\d+) other components$/.exec(m);
      return x !== null ? `Class \`${x[1] ?? ''}\` has too broad a responsibility: it performs ${x[2] ?? '?'} kind(s) of I/O and depends on ${x[3] ?? '?'} other components.` : m;
    }
    case 'low-cohesion': {
      const x = /^(.*): LCOM4 (\d+) over (\d+) methods \((.*)\)$/.exec(m);
      return x !== null ? `Class \`${x[1] ?? ''}\` is not cohesive: its ${x[3] ?? '?'} methods fall into ${x[2] ?? '?'} groups that share no field or call: ${x[4] ?? ''}.` : m;
    }
    case 'controller-logic-density':
    case 'adapter-logic-density':
    case 'controller-business-logic':
      return `This ${flag.kind.startsWith('adapter') ? 'adapter' : 'controller'} method holds business logic that belongs in a service or the domain: ${m}.`;
    case 'community-component-mismatch':
      return `By its dependencies this file belongs with another component than the folder it sits in: ${m}.`;
    default:
      return `${m}${other}`;
  }
}

/** Markdown table cell: pipes escaped, newlines as `<br>`. */
export function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}
