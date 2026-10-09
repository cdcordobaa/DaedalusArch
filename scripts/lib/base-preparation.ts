/**
 * Base preparation steps for fetched corpus clones (ADR-019 item 2; BR-U5a-07, BR-U5a-10; Build and Test Step 53).
 *
 * ADR-019 item 2: an excluded base may be repaired only by a documented, deterministic preparation step that
 * changes no source file, applied before the catalogue freeze. The steps are a closed list, declared per entry in
 * `corpus/corpus.json` (`preparation`, registered by the pre-registration) and run by `prepare-bases`:
 *
 * - `prisma-generate`: the project's own `postinstall` (`prisma generate`), which `npm ci --ignore-scripts` skips.
 *   Run as `node <clone>/node_modules/prisma/build/index.js generate --no-engine` in the clone root, with the
 *   clone's pinned `prisma` and the project's own schema discovery, under an explicit environment (`PATH`, `HOME`,
 *   update check and telemetry off). `--no-engine` writes the generated TypeScript client only and downloads no
 *   query-engine binary (no network; the type-check needs the types, not the engine). Output goes to
 *   `node_modules/` only.
 * - `monorepo-context` (sub-path bases only): every analysis copy of `<clone>/<subPath>` must resolve the way the
 *   monorepo does (U5a BR-U5a-10 / U5b row: "resolution starts at the monorepo root `node_modules`"). Two outputs
 *   inside the base directory, both deterministic for a given clone location:
 *   (a) `tsconfig.monorepo.json`, derived from `<clone>/tsconfig.base.json` by `monorepoTsconfig`: path-valued
 *       options are made independent of where the copy lies (`baseUrl`, `typeRoots` and `paths` targets outside the
 *       sub-path become absolute paths into the clone, read only; `paths` targets inside the sub-path become
 *       `${configDir}/…`, so they resolve inside the copy); `rootDir` (emit only) is dropped, because a copy lies
 *       outside it. The sub-path's registered tsconfig overlay extends this file. Needs tsc ≥ 5.5 (`${configDir}`).
 *   (b) `node_modules`: a mirror of the root packages, a real directory of absolute links (`mirrorPackages`).
 *       `copyBase` copies links verbatim, so every copy sees the root packages, and a stub for an absent package
 *       is written into the copy's own directory, never through a link (`provisionStubs`, `writesOutsideCopy`).
 *   The generated config is returned as `{ path, sha256 }` and recorded with the base's overlays, so `copyBase`
 *   checks it in every copy (`MUT_OVERLAY_MISMATCH`).
 *
 * No tracked file of the clone is written. Every step is idempotent: a rerun writes byte-identical output and
 * keeps a mirror that equals the expected one; any other existing `node_modules` is refused.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, posix } from 'node:path';
import type { ProcessRunner } from '../../src/shared/interfaces/process-runner.js';
import { sha256Hex } from './corpus.js';

export const PREPARATION_STEPS = ['prisma-generate', 'monorepo-context'] as const;
export type PreparationStep = (typeof PREPARATION_STEPS)[number];

export const PREP_STEP_FAILED = 'PREP_STEP_FAILED';
export const MONOREPO_TSCONFIG = 'tsconfig.monorepo.json';
export const MONOREPO_BASE_TSCONFIG = 'tsconfig.base.json';
const PRISMA_CLI = 'node_modules/prisma/build/index.js';
const STEP_TIMEOUT_MS = 5 * 60_000;

/** Path-valued compiler options the derivation does not map; their presence refuses the step. */
const UNMAPPED_PATH_OPTIONS = ['rootDirs', 'outDir', 'declarationDir', 'tsBuildInfoFile', 'outFile', 'composite'] as const;

export interface PreparationInput {
  readonly projectId: string;
  readonly cloneDir: string;
  /** Project directory inside the clone (POSIX), required by `monorepo-context`. */
  readonly subPath?: string;
  readonly tscVersion: string;
  readonly steps: readonly PreparationStep[];
}

export interface PreparationOptions {
  readonly runner: ProcessRunner;
  readonly env: Readonly<Record<string, string>>;
  readonly nodePath?: string;
}

export interface GeneratedFile { readonly path: string; readonly sha256: string }

export type PreparationOutcome =
  | { readonly ok: true; readonly generated: readonly GeneratedFile[]; readonly log: readonly string[] }
  | { readonly ok: false; readonly code: typeof PREP_STEP_FAILED; readonly detail: string };

/** `[major, minor]` of a `x.y.z` version, or undefined. */
function majorMinor(v: string): [number, number] | undefined {
  const m = /^(\d+)\.(\d+)/.exec(v);
  return m === null ? undefined : [Number(m[1]), Number(m[2])];
}

type Json = Record<string, unknown>;

/**
 * Derives the copy-independent monorepo config from the root `tsconfig.base.json` text (pure; see the module
 * comment). `cloneDir` absolute; `subPath` POSIX relative. Throws on an input the derivation does not cover.
 */
export function monorepoTsconfig(baseText: string, cloneDir: string, subPath: string): string {
  const base = JSON.parse(baseText) as Json;
  if (base.extends !== undefined) throw new Error(`${MONOREPO_BASE_TSCONFIG} has "extends", not covered`);
  const opts = { ...((base.compilerOptions ?? {}) as Json) };
  for (const k of UNMAPPED_PATH_OPTIONS) if (opts[k] !== undefined) throw new Error(`${MONOREPO_BASE_TSCONFIG} sets compilerOptions.${k}, not covered`);
  const root = cloneDir.split('\\').join('/').replace(/\/+$/, '');
  const sub = posix.normalize(subPath).replace(/\/+$/, '');
  const baseUrlRel = typeof opts.baseUrl === 'string' ? opts.baseUrl : '.';
  const fromRoot = (rel: string): string => (isAbsolute(rel) ? rel : posix.join(root, rel));
  delete opts.rootDir;
  if (opts.baseUrl !== undefined) opts.baseUrl = fromRoot(baseUrlRel);
  if (Array.isArray(opts.typeRoots)) opts.typeRoots = (opts.typeRoots as string[]).map(fromRoot);
  if (opts.paths !== undefined) {
    const mapped: Record<string, string[]> = {};
    for (const [key, targets] of Object.entries(opts.paths as Record<string, string[]>)) {
      mapped[key] = targets.map((t) => {
        const rel = posix.normalize(posix.join(baseUrlRel, t));
        if (rel === sub || rel.startsWith(`${sub}/`)) return `\${configDir}${rel.slice(sub.length)}`;
        return fromRoot(rel);
      });
    }
    opts.paths = mapped;
  }
  const out: Json = {
    $comment: `Generated by scripts/lib/base-preparation.ts (monorepo-context, ADR-019 item 2) from ${MONOREPO_BASE_TSCONFIG} of the clone; not a source file.`,
    compilerOptions: opts,
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

async function prismaGenerate(i: PreparationInput, o: PreparationOptions, log: string[]): Promise<string | undefined> {
  const cli = join(i.cloneDir, ...PRISMA_CLI.split('/'));
  if (!existsSync(cli)) return `prisma-generate: ${PRISMA_CLI} not installed in the clone`;
  const env = { ...o.env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' };
  const r = await o.runner.run(o.nodePath ?? process.execPath, [cli, 'generate', '--no-engine'], { cwd: i.cloneDir, env, timeoutMs: STEP_TIMEOUT_MS });
  if (!r.success) return `prisma-generate: ${r.errors.map((e) => e.message).join('; ')}`;
  if (r.data.exitCode !== 0 || r.data.timedOut) return `prisma-generate: exit ${String(r.data.exitCode)}${r.data.timedOut ? ' (timeout)' : ''}`;
  const line = /Generated Prisma Client \([^)]*\)/.exec(r.data.stdout + r.data.stderr)?.[0];
  const types = join(i.cloneDir, 'node_modules', '.prisma', 'client', 'index.d.ts');
  const digest = existsSync(types) ? sha256Hex(readFileSync(types)) : 'missing';
  log.push(`prisma-generate: ${line ?? 'ok'}; node_modules/.prisma/client/index.d.ts sha256 ${digest}`);
  return undefined;
}

function monorepoContext(i: PreparationInput, log: string[], generated: GeneratedFile[]): string | undefined {
  if (i.subPath === undefined) return 'monorepo-context: the entry has no subPath';
  const mm = majorMinor(i.tscVersion);
  if (mm === undefined || mm[0] < 5 || (mm[0] === 5 && mm[1] < 5)) return `monorepo-context: tsc ${i.tscVersion} < 5.5 has no \${configDir}`;
  const dir = join(i.cloneDir, ...i.subPath.split('/'));
  const baseFile = join(i.cloneDir, MONOREPO_BASE_TSCONFIG);
  if (!existsSync(baseFile)) return `monorepo-context: ${MONOREPO_BASE_TSCONFIG} missing at the clone root`;
  let text: string;
  try {
    text = monorepoTsconfig(readFileSync(baseFile, 'utf8'), i.cloneDir, i.subPath);
  } catch (e) {
    return `monorepo-context: ${e instanceof Error ? e.message : String(e)}`;
  }
  const target = join(dir, MONOREPO_TSCONFIG);
  if (!existsSync(target) || readFileSync(target, 'utf8') !== text) writeFileSync(target, text);
  generated.push({ path: MONOREPO_TSCONFIG, sha256: sha256Hex(text) });
  const rootModules = join(i.cloneDir, 'node_modules');
  if (!existsSync(rootModules)) return 'monorepo-context: the clone has no root node_modules';
  const mirrored = mirrorPackages(rootModules, join(dir, 'node_modules'));
  if (typeof mirrored === 'string') return `monorepo-context: ${mirrored}`;
  log.push(`monorepo-context: ${MONOREPO_TSCONFIG} ${generated[generated.length - 1]?.sha256.slice(0, 12) ?? ''}…; node_modules mirror of the root packages, ${String(mirrored)} links`);
  return undefined;
}

/**
 * `<base>/node_modules` as a real directory whose entries are absolute links to the root packages: one link per
 * top-level entry, and for each `@scope` a real directory with one link per scoped package. Stubs (BR-U5a-10) for
 * a package that is absent therefore land in the copy, never through a link (`writesOutsideCopy`). Deterministic:
 * the entries are the sorted listing of the root `node_modules`. An existing mirror is kept when it equals the
 * expected one; anything else there is refused. Returns the number of links or a problem.
 */
export function mirrorPackages(rootModules: string, target: string): number | string {
  const expected: { rel: string; to: string }[] = [];
  for (const name of readdirSync(rootModules).sort()) {
    const abs = join(rootModules, name);
    if (name.startsWith('@') && lstatSync(abs).isDirectory()) {
      for (const pkg of readdirSync(abs).sort()) expected.push({ rel: `${name}/${pkg}`, to: join(abs, pkg) });
    } else expected.push({ rel: name, to: abs });
  }
  if (existsSync(target) || isLink(target)) {
    if (!lstatSync(target).isDirectory()) return 'node_modules exists in the base and is not a mirror directory';
    const actual = listMirror(target);
    const want = expected.map((e) => `${e.rel} -> ${e.to}`).join('\n');
    if (actual !== want) return 'node_modules exists in the base and differs from the expected mirror (remove it and rerun)';
    return expected.length;
  }
  mkdirSync(target);
  for (const e of expected) {
    const at = join(target, ...e.rel.split('/'));
    if (e.rel.includes('/')) mkdirSync(join(at, '..'), { recursive: true });
    symlinkSync(e.to, at);
  }
  return expected.length;
}

function isLink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

/** `rel -> target` lines of a mirror directory, sorted as `mirrorPackages` writes them; a non-link file → `!`. */
function listMirror(dir: string): string {
  const lines: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) lines.push(`${name} -> ${readlinkSync(abs)}`);
    else if (name.startsWith('@') && st.isDirectory()) {
      for (const pkg of readdirSync(abs).sort()) {
        const p = join(abs, pkg);
        lines.push(isLink(p) ? `${name}/${pkg} -> ${readlinkSync(p)}` : `${name}/${pkg} !`);
      }
    } else lines.push(`${name} !`);
  }
  return lines.join('\n');
}

/** Runs the declared steps in the declared order; stops at the first failure. */
export async function runPreparation(i: PreparationInput, o: PreparationOptions): Promise<PreparationOutcome> {
  const log: string[] = [];
  const generated: GeneratedFile[] = [];
  for (const step of i.steps) {
    const problem = step === 'prisma-generate' ? await prismaGenerate(i, o, log) : monorepoContext(i, log, generated);
    if (problem !== undefined) return { ok: false, code: PREP_STEP_FAILED, detail: `${i.projectId}: ${problem}` };
  }
  return { ok: true, generated, log };
}
