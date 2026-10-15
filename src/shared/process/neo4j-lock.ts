/**
 * Cross-process lock on one Neo4j database (v1.3 fix round, fix 1).
 *
 * Every ingestion wipes the database (`MATCH (n) DETACH DELETE n`), and Neo4j community has a single user database,
 * so two runs on one instance corrupt each other silently: the U-E baseline's first live run picked up another
 * worktree's DDD fixture rows (Docs/DiagnosticRuns/v1.3-reference-baseline-2026-10-15.md, "Run notes"). This lock
 * serialises every ingestion + evaluation, every validation run and every Neo4j-using jest suite on the same
 * `host:port`, across worktrees and agents.
 *
 * Mechanism: a lock file created with `O_CREAT | O_EXCL` (`'wx'`), holding the owner's pid, host name, label and a
 * random token. It lives outside every worktree, in `~/.daedalus/locks/` (override: `DAEDALUS_NEO4J_LOCK_DIR`), one
 * file per `host:port` (`localhost` and `::1` are `127.0.0.1`).
 *
 * - **Stale detection.** A lock whose pid is dead on this host is stale. It is broken under a short-lived breaker
 *   file (`<lock>.break`, itself stale after 30 s), and only when the lock file still holds the token that was seen
 *   dead, so two waiters cannot both break it and then remove a fresh lock.
 * - **Re-entrancy.** A lock held by this process or by one of its ancestors counts as held. A run that holds the lock
 *   (the validation runner, a jest worker) spawns `firewall evaluate` children; they see their ancestor's lock and do
 *   not wait for it. A sibling process (another jest worker, another agent) waits.
 * - **Release.** `release()` removes the file only when it still holds this owner's token; an exit handler does the
 *   same if the process ends without releasing. A killed process leaves a stale file, broken by the next waiter.
 * - `DAEDALUS_NEO4J_LOCK=off` disables the lock (for a private, single-user instance).
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface Neo4jLockInfo {
  readonly pid: number;
  readonly hostname: string;
  readonly label: string;
  readonly acquiredAt: string;
  readonly key: string;
  readonly token: string;
}

export interface Neo4jLockHandle {
  /** `owned`: this call created the lock; `reentrant`: this process or an ancestor holds it; `disabled`: lock off. */
  readonly mode: 'owned' | 'reentrant' | 'disabled';
  readonly path: string;
  /** The holder (this process when owned). */
  readonly holder?: Neo4jLockInfo;
  /** Idempotent. Removes the lock file only when owned and it still holds this owner's token. */
  release(): void;
}

export interface Neo4jLockOptions {
  /** Shown to waiters (for example `firewall evaluate <project>`). */
  readonly label?: string;
  /** Give up after this long (default 2 h, or `DAEDALUS_NEO4J_LOCK_TIMEOUT_MS`). */
  readonly timeoutMs?: number;
  /** Poll interval while waiting (default 250 ms). */
  readonly pollMs?: number;
  readonly env?: NodeJS.ProcessEnv;
  /** Called when waiting starts and every 30 s while waiting (default: one line on stderr). */
  readonly onWait?: (text: string) => void;
}

export const NEO4J_LOCK_TIMEOUT = 'NEO4J_LOCK_TIMEOUT';
const DEFAULT_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const BREAKER_STALE_MS = 30_000;
const UNREADABLE_STALE_MS = 10_000;
const WAIT_NOTICE_MS = 30_000;

/** `host:port` of a Neo4j URI; loopback names are one host, the default port is 7687. */
export function neo4jLockKey(uri: string): string {
  let host = 'unknown';
  let port = '7687';
  try {
    const u = new URL(uri);
    host = u.hostname.replace(/^\[|\]$/g, '');
    if (u.port !== '') port = u.port;
  } catch {
    host = uri;
  }
  if (host === 'localhost' || host === '::1' || host === '') host = '127.0.0.1';
  return `${host}:${port}`;
}

export function neo4jLockDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.DAEDALUS_NEO4J_LOCK_DIR;
  return override !== undefined && override !== '' ? override : path.join(os.homedir(), '.daedalus', 'locks');
}

export function neo4jLockPath(uri: string, env: NodeJS.ProcessEnv = process.env): string {
  return path.join(neo4jLockDir(env), `neo4j-${neo4jLockKey(uri).replace(/[^A-Za-z0-9.-]/g, '_')}.lock`);
}

/** True when `pid` is a live process on this host (EPERM: alive, owned by someone else). */
export function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** This process's ancestors, nearest first (from `ps`; only the parent when `ps` is unavailable). */
export function ancestorPids(): number[] {
  const parentOf = new Map<number, number>();
  try {
    const out = execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const line of out.split('\n')) {
      const m = /^\s*(\d+)\s+(\d+)\s*$/.exec(line);
      if (m) parentOf.set(Number(m[1]), Number(m[2]));
    }
  } catch {
    return process.ppid > 1 ? [process.ppid] : [];
  }
  const chain: number[] = [];
  let p = process.ppid;
  while (p > 1 && !chain.includes(p)) {
    chain.push(p);
    p = parentOf.get(p) ?? 0;
  }
  return chain;
}

function readInfo(file: string): Neo4jLockInfo | 'missing' | 'unreadable' {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unreadable';
  }
  try {
    const v = JSON.parse(text) as Partial<Neo4jLockInfo>;
    if (typeof v.pid === 'number' && typeof v.token === 'string' && typeof v.hostname === 'string') return v as Neo4jLockInfo;
  } catch {
    // a writer between create and write, or a damaged file
  }
  return 'unreadable';
}

function ageMs(file: string): number {
  try {
    return Date.now() - fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function tryCreate(file: string, info: Neo4jLockInfo): boolean {
  let fd: number;
  try {
    fd = fs.openSync(file, 'wx', 0o644);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw e;
  }
  try {
    fs.writeSync(fd, `${JSON.stringify(info)}\n`);
  } finally {
    fs.closeSync(fd);
  }
  return true;
}

function unlinkIfToken(file: string, token: string): void {
  const now = readInfo(file);
  if (typeof now === 'object' && now.token === token) {
    try {
      fs.unlinkSync(file);
    } catch {
      // already gone
    }
  }
}

/** Removes `file` when it still holds `staleToken` (or is still unreadable), under the breaker file. */
function breakStale(file: string, staleToken: string | null): void {
  const breaker = `${file}.break`;
  let fd: number;
  try {
    fd = fs.openSync(breaker, 'wx', 0o644);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    if (ageMs(breaker) > BREAKER_STALE_MS) {
      try {
        fs.unlinkSync(breaker);
      } catch {
        // another waiter removed it
      }
    }
    return;
  }
  try {
    fs.closeSync(fd);
    const now = readInfo(file);
    const same = staleToken === null ? now === 'unreadable' : typeof now === 'object' && now.token === staleToken;
    if (same) {
      try {
        fs.unlinkSync(file);
      } catch {
        // gone already
      }
    }
  } finally {
    try {
      fs.unlinkSync(breaker);
    } catch {
      // gone already
    }
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function describe(info: Neo4jLockInfo): string {
  return `pid ${String(info.pid)} on ${info.hostname} (${info.label}, since ${info.acquiredAt})`;
}

/**
 * Acquires the lock of the Neo4j database at `uri`, waiting while another live process (not an ancestor) holds it.
 * Rejects with an error whose `code` is `NEO4J_LOCK_TIMEOUT` after `timeoutMs`.
 */
export async function acquireNeo4jLock(uri: string, options: Neo4jLockOptions = {}): Promise<Neo4jLockHandle> {
  const env = options.env ?? process.env;
  const file = neo4jLockPath(uri, env);
  if ((env.DAEDALUS_NEO4J_LOCK ?? '').toLowerCase() === 'off') {
    return { mode: 'disabled', path: file, release: () => undefined };
  }
  const envTimeout = Number(env.DAEDALUS_NEO4J_LOCK_TIMEOUT_MS);
  const timeoutMs = options.timeoutMs ?? (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);
  const pollMs = options.pollMs ?? 250;
  const onWait = options.onWait ?? ((t: string): void => { process.stderr.write(`${t}\n`); });
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const host = os.hostname();
  const mine: Neo4jLockInfo = {
    pid: process.pid, hostname: host, label: options.label ?? (process.argv.slice(1, 3).join(' ') || 'node'),
    acquiredAt: new Date().toISOString(), key: neo4jLockKey(uri), token: randomBytes(12).toString('hex'),
  };
  const started = Date.now();
  let lastNotice = -Infinity;
  let ancestors: number[] | undefined;

  for (;;) {
    if (tryCreate(file, { ...mine, acquiredAt: new Date().toISOString() })) {
      let released = false;
      const onExit = (): void => unlinkIfToken(file, mine.token);
      process.once('exit', onExit);
      return {
        mode: 'owned', path: file, holder: mine,
        release: () => {
          if (released) return;
          released = true;
          process.removeListener('exit', onExit);
          unlinkIfToken(file, mine.token);
        },
      };
    }
    const held = readInfo(file);
    if (held === 'missing') continue;
    if (held === 'unreadable') {
      if (ageMs(file) > UNREADABLE_STALE_MS) breakStale(file, null);
    } else if (held.hostname === host) {
      if (held.pid === process.pid || (ancestors ??= ancestorPids()).includes(held.pid)) {
        return { mode: 'reentrant', path: file, holder: held, release: () => undefined };
      }
      if (!pidAlive(held.pid)) {
        breakStale(file, held.token);
        continue;
      }
    }
    const waited = Date.now() - started;
    const holderText = typeof held === 'object' ? describe(held) : 'an unreadable lock file';
    if (waited >= timeoutMs) {
      const err = new Error(`Neo4j ${mine.key} is locked by ${holderText}; gave up after ${String(Math.round(waited / 1000))} s (lock file ${file})`);
      (err as NodeJS.ErrnoException).code = NEO4J_LOCK_TIMEOUT;
      throw err;
    }
    if (waited - lastNotice >= WAIT_NOTICE_MS) {
      lastNotice = waited;
      onWait(`waiting for the Neo4j lock on ${mine.key}, held by ${holderText}`);
    }
    await sleep(pollMs);
  }
}

/** Runs `fn` while holding the lock of `uri`; releases it afterwards, also on a throw. */
export async function withNeo4jLock<T>(uri: string, options: Neo4jLockOptions, fn: () => Promise<T>): Promise<T> {
  const lock = await acquireNeo4jLock(uri, options);
  try {
    return await fn();
  } finally {
    lock.release();
  }
}
