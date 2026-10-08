/**
 * Corpus fetch (FR-36; BR-U5b-66, 67; U5b domain-entities §8 `FetchRecord`).
 *
 * Per entry, in order, each failure stopping that entry with a reason (nothing is silently patched):
 * 1. every overlay's committed patch file must hash to its `sha256` (`OVERLAY_SHA_MISMATCH`);
 * 2. `git clone --no-checkout`, `git checkout --detach <commitSha>`, `git rev-parse HEAD` = `commitSha`
 *    (`FETCH_SHA_MISMATCH`);
 * 3. `git apply --check` for every overlay before any is applied (`OVERLAY_CHECK_FAILED`, clone left unpatched);
 *    `--check` mode stops here;
 * 4. `git apply` each overlay;
 * 5. install policy with lifecycle scripts disabled (`npm ci --ignore-scripts`), after checking the lock-file sha256
 *    (`INSTALL_LOCK_MISMATCH`, `INSTALL_FAILED`);
 * 6. tree hash of source + overlays (never `node_modules`): `git read-tree HEAD` + `git add -A` into a temporary
 *    index, `git write-tree`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ProcessRunner } from '../src/shared/interfaces/process-runner.js';
import { buildChildEnv, NodeProcessRunner } from '../src/shared/process/node-process-runner.js';
import { CORPUS_FILE, loadCorpus, sha256Hex } from './lib/corpus.js';
import type { CorpusEntry } from './lib/corpus.js';

export const FETCH_SHA_MISMATCH = 'FETCH_SHA_MISMATCH';
export const OVERLAY_CHECK_FAILED = 'OVERLAY_CHECK_FAILED';
export const OVERLAY_SHA_MISMATCH = 'OVERLAY_SHA_MISMATCH';
export const INSTALL_LOCK_MISMATCH = 'INSTALL_LOCK_MISMATCH';
export const INSTALL_FAILED = 'INSTALL_FAILED';
export const FETCH_FAILED = 'FETCH_FAILED';

export type FetchCode = typeof FETCH_SHA_MISMATCH | typeof OVERLAY_CHECK_FAILED | typeof OVERLAY_SHA_MISMATCH
  | typeof INSTALL_LOCK_MISMATCH | typeof INSTALL_FAILED | typeof FETCH_FAILED;

/** Domain-entities §8. The base tree hash lives here, not in `PreparedBase`. */
export interface FetchRecord {
  readonly projectId: string; readonly commitSha: string; readonly treeHash: string;
  readonly overlaysApplied: number; readonly installPolicy: string; readonly fetchedAt: string;
}

export type FetchOutcome =
  | { readonly ok: true; readonly dir: string; readonly checkedOnly: true }
  | { readonly ok: true; readonly dir: string; readonly checkedOnly: false; readonly record: FetchRecord }
  | { readonly ok: false; readonly projectId: string; readonly code: FetchCode; readonly detail: string };

export interface FetchOptions {
  /** Resolves `overlays[].patchFile` (this repository's root). */
  readonly repoRoot: string;
  readonly runner: ProcessRunner;
  readonly env: Readonly<Record<string, string>>;
  readonly now: () => Date;
  /** Stop after the SHA check and `git apply --check` (no overlay applied, no install, no tree hash). */
  readonly check?: boolean;
  /** Skip the install policy (tests, `--no-install`); the record says `skipped:<policy>`. */
  readonly skipInstall?: boolean;
}

const fail = (projectId: string, code: FetchCode, detail: string): FetchOutcome => ({ ok: false, projectId, code, detail });

async function run(o: FetchOptions, cmd: string, args: readonly string[], cwd?: string, extraEnv: Record<string, string> = {}, timeoutMs = 600_000): Promise<{ code: number; stdout: string; stderr: string }> {
  const r = await o.runner.run(cmd, args, { ...(cwd !== undefined ? { cwd } : {}), env: { ...o.env, ...extraEnv }, timeoutMs });
  if (!r.success) return { code: -1, stdout: '', stderr: r.errors.map((e) => e.message).join('; ') };
  return { code: r.data.timedOut ? -1 : r.data.exitCode, stdout: r.data.stdout, stderr: r.data.stderr };
}

/** Source + overlays tree id, excluding every `node_modules` (temporary index; the clone's index is untouched). */
export async function treeHash(dir: string, o: FetchOptions): Promise<string> {
  const tmp = mkdtempSync(join(tmpdir(), 'u5b-tree-'));
  try {
    const env = { GIT_INDEX_FILE: join(tmp, 'index') };
    const rt = await run(o, 'git', ['-C', dir, 'read-tree', 'HEAD'], undefined, env);
    if (rt.code !== 0) throw new Error(`git read-tree: ${rt.stderr.trim()}`);
    const add = await run(o, 'git', ['-C', dir, 'add', '-A', '--', '.', ':(exclude,glob)**/node_modules/**'], undefined, env);
    if (add.code !== 0) throw new Error(`git add: ${add.stderr.trim()}`);
    const w = await run(o, 'git', ['-C', dir, 'write-tree'], undefined, env);
    if (w.code !== 0) throw new Error(`git write-tree: ${w.stderr.trim()}`);
    return w.stdout.trim();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export async function fetchEntry(entry: CorpusEntry, dest: string, o: FetchOptions): Promise<FetchOutcome> {
  const id = entry.name;
  const patches: string[] = [];
  for (const ov of entry.overlays) {
    const p = resolve(o.repoRoot, ov.patchFile);
    if (!existsSync(p)) return fail(id, OVERLAY_SHA_MISMATCH, `${ov.patchFile} missing`);
    const actual = sha256Hex(readFileSync(p));
    if (actual !== ov.sha256) return fail(id, OVERLAY_SHA_MISMATCH, `${ov.patchFile} sha256 ${actual} ≠ ${ov.sha256}`);
    patches.push(p);
  }
  if (existsSync(dest)) return fail(id, FETCH_FAILED, `destination ${dest} exists`);
  const clone = await run(o, 'git', ['clone', '--quiet', '--no-checkout', entry.originUrl, dest]);
  if (clone.code !== 0) return fail(id, FETCH_FAILED, `git clone: ${clone.stderr.trim().slice(0, 300)}`);
  const co = await run(o, 'git', ['-C', dest, '-c', 'advice.detachedHead=false', 'checkout', '--quiet', '--detach', entry.commitSha]);
  if (co.code !== 0) return fail(id, FETCH_SHA_MISMATCH, `checkout ${entry.commitSha}: ${co.stderr.trim().slice(0, 300)}`);
  const head = (await run(o, 'git', ['-C', dest, 'rev-parse', 'HEAD'])).stdout.trim();
  if (head !== entry.commitSha) return fail(id, FETCH_SHA_MISMATCH, `HEAD ${head} ≠ ${entry.commitSha}`);
  for (const [i, p] of patches.entries()) {
    const c = await run(o, 'git', ['-C', dest, 'apply', '--check', p]);
    if (c.code !== 0) return fail(id, OVERLAY_CHECK_FAILED, `${entry.overlays[i]?.patchFile ?? p}: ${c.stderr.trim().slice(0, 300)}`);
  }
  if (o.check === true) return { ok: true, dir: dest, checkedOnly: true };
  for (const [i, p] of patches.entries()) {
    const a = await run(o, 'git', ['-C', dest, 'apply', p]);
    if (a.code !== 0) return fail(id, OVERLAY_CHECK_FAILED, `apply ${entry.overlays[i]?.patchFile ?? p}: ${a.stderr.trim().slice(0, 300)}`);
  }
  let installPolicy: string = entry.install.policy;
  if (entry.install.policy === 'npm-ci-ignore-scripts') {
    const lock = join(dest, 'package-lock.json');
    const actual = existsSync(lock) ? sha256Hex(readFileSync(lock)) : 'absent';
    if (actual !== entry.install.lockSha256) return fail(id, INSTALL_LOCK_MISMATCH, `package-lock.json sha256 ${actual} ≠ ${entry.install.lockSha256}`);
    if (o.skipInstall === true) installPolicy = `skipped:${entry.install.policy}`;
    else {
      const n = await run(o, 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], dest, {}, 1_800_000);
      if (n.code !== 0) return fail(id, INSTALL_FAILED, `npm ci: ${n.stderr.trim().slice(-300)}`);
    }
  }
  let hash: string;
  try {
    hash = await treeHash(dest, o);
  } catch (e) {
    return fail(id, FETCH_FAILED, e instanceof Error ? e.message : String(e));
  }
  return {
    ok: true, dir: dest, checkedOnly: false,
    record: { projectId: id, commitSha: entry.commitSha, treeHash: hash, overlaysApplied: patches.length, installPolicy, fetchedAt: o.now().toISOString() },
  };
}

/** Fetches each entry into `<destRoot>/<name>`; a failing entry does not stop the others. */
export async function fetchCorpus(entries: readonly CorpusEntry[], destRoot: string, o: FetchOptions): Promise<readonly FetchOutcome[]> {
  const out: FetchOutcome[] = [];
  for (const e of entries) out.push(await fetchEntry(e, join(destRoot, e.name), o));
  return out;
}

// --- CLI ----------------------------------------------------------------------------------------------------------

export interface FetchIo { readonly out: (t: string) => void; readonly err: (t: string) => void }

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** `--dest <dir> [--corpus corpus/corpus.json] [--only a,b] [--check] [--no-install] [--out <records.json>]`. */
export async function main(argv: readonly string[], repoRoot: string, io: FetchIo, runner: ProcessRunner = new NodeProcessRunner()): Promise<number> {
  const dest = arg(argv, '--dest');
  if (dest === undefined) {
    io.err('usage: fetch-corpus-cli.ts --dest <dir> [--corpus <file>] [--only a,b] [--check] [--no-install] [--out <file>]\n');
    return 2;
  }
  const loaded = loadCorpus(join(repoRoot, arg(argv, '--corpus') ?? CORPUS_FILE), repoRoot);
  if (!loaded.ok) {
    io.err(`${loaded.errors.join('\n')}\n`);
    return 1;
  }
  const only = arg(argv, '--only')?.split(',');
  const entries = loaded.corpus.entries.filter((e) => only === undefined || only.includes(e.name));
  const env = buildChildEnv(process.env, ['PATH', 'HOME', 'TMPDIR', 'npm_config_cache']);
  const results = await fetchCorpus(entries, resolve(dest), {
    repoRoot, runner, env, now: () => new Date(), check: argv.includes('--check'), skipInstall: argv.includes('--no-install'),
  });
  let bad = 0;
  for (const r of results) {
    if (!r.ok) {
      bad++;
      io.err(`${r.projectId}: ${r.code}: ${r.detail}\n`);
    } else io.out(r.checkedOnly ? `${r.dir}: SHA and overlays check\n` : `${r.record.projectId}: tree ${r.record.treeHash}\n`);
  }
  const outFile = arg(argv, '--out');
  if (outFile !== undefined) writeFileSync(outFile, `${JSON.stringify(results.flatMap((r) => (r.ok && !r.checkedOnly ? [r.record] : [])), null, 2)}\n`);
  return bad === 0 ? 0 : 1;
}
