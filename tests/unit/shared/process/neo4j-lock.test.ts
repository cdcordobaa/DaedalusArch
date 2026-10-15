/**
 * v1.3 fix round, fix 1: the cross-process Neo4j lock (src/shared/process/neo4j-lock.ts).
 * Real processes, a private lock directory, no Neo4j: each child stands in for one ingestion + evaluation.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  acquireNeo4jLock, neo4jLockKey, neo4jLockPath, NEO4J_LOCK_TIMEOUT, withNeo4jLock,
} from '../../../../src/shared/process/neo4j-lock.js';

const ROOT = path.resolve(__dirname, '../../../..');
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');
const HOLD = path.join(ROOT, 'tests/fixtures/neo4j-lock/hold-lock.ts');
const URI = 'bolt://localhost:7693';

let dir: string;
let env: NodeJS.ProcessEnv;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo4j-lock-test-'));
  env = { ...process.env, DAEDALUS_NEO4J_LOCK_DIR: dir };
  delete env.DAEDALUS_NEO4J_LOCK;
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

interface Line { pid: number; mode?: string; start?: number; end?: number; error?: string }
const lines = (file: string): Line[] => fs.readFileSync(file, 'utf8').trim().split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as Line);

function run(args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(TSX, [HOLD, ...args], { env, stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? -1));
  });
}

describe('neo4jLockKey / neo4jLockPath', () => {
  it('keys a database on host:port, with loopback names as one host and 7687 as the default port', () => {
    expect(neo4jLockKey('bolt://localhost:7693')).toBe('127.0.0.1:7693');
    expect(neo4jLockKey('bolt://127.0.0.1:7693')).toBe('127.0.0.1:7693');
    expect(neo4jLockKey('neo4j://[::1]:7693')).toBe('127.0.0.1:7693');
    expect(neo4jLockKey('bolt://localhost')).toBe('127.0.0.1:7687');
    expect(neo4jLockKey('bolt://db.example:7999')).toBe('db.example:7999');
  });
  it('puts the lock file in DAEDALUS_NEO4J_LOCK_DIR, outside any worktree, one file per database', () => {
    expect(neo4jLockPath(URI, env)).toBe(path.join(dir, 'neo4j-127.0.0.1_7693.lock'));
    expect(neo4jLockPath('bolt://localhost:7687', env)).not.toBe(neo4jLockPath(URI, env));
  });
});

describe('two concurrent runs serialise', () => {
  it('two processes started together never hold the lock at the same time', async () => {
    const out = path.join(dir, 'out.jsonl');
    const codes = await Promise.all([run([URI, '600', out]), run([URI, '600', out])]);
    expect(codes).toEqual([0, 0]);
    const [a, b] = lines(out).sort((x, y) => (x.start ?? 0) - (y.start ?? 0));
    expect(a?.mode).toBe('owned');
    expect(b?.mode).toBe('owned');
    expect(a?.pid).not.toBe(b?.pid);
    // The second run starts only after the first has ended (serialised, not overlapping).
    expect(b!.start!).toBeGreaterThanOrEqual(a!.end!);
    expect(fs.existsSync(neo4jLockPath(URI, env))).toBe(false);
  }, 60_000);

  it('runs on different databases do not wait for each other', async () => {
    const out = path.join(dir, 'out.jsonl');
    await Promise.all([run([URI, '800', out]), run(['bolt://localhost:7687', '800', out])]);
    const [a, b] = lines(out).sort((x, y) => (x.start ?? 0) - (y.start ?? 0));
    expect(b!.start!).toBeLessThan(a!.end!);
  }, 60_000);

  it('a waiter gives up with NEO4J_LOCK_TIMEOUT while a live process holds the lock', async () => {
    const out = path.join(dir, 'out.jsonl');
    const holder = run([URI, '3000', out]);
    const file = neo4jLockPath(URI, env);
    for (let i = 0; i < 200 && !fs.existsSync(file); i += 1) await new Promise((r) => setTimeout(r, 25));
    await expect(acquireNeo4jLock(URI, { env, timeoutMs: 300, pollMs: 20, onWait: () => undefined })).rejects.toMatchObject({ code: NEO4J_LOCK_TIMEOUT });
    expect(await holder).toBe(0);
  }, 60_000);
});

describe('re-entrancy, staleness, release', () => {
  it('a child of the holder (a firewall evaluate under a validation run) does not wait for its ancestor', async () => {
    const out = path.join(dir, 'out.jsonl');
    expect(await run([URI, '200', out, '', 'spawnChild'])).toBe(0);
    const rows = lines(out);
    expect(rows.map((r) => r.mode).sort()).toEqual(['owned', 'reentrant']);
  }, 60_000);

  it('the same process re-acquires without waiting, and only the owner removes the file', async () => {
    const first = await acquireNeo4jLock(URI, { env });
    const again = await acquireNeo4jLock(URI, { env, timeoutMs: 200 });
    expect(first.mode).toBe('owned');
    expect(again.mode).toBe('reentrant');
    again.release();
    expect(fs.existsSync(first.path)).toBe(true);
    first.release();
    first.release();
    expect(fs.existsSync(first.path)).toBe(false);
  });

  it('a lock left by a dead process is broken', async () => {
    const file = neo4jLockPath(URI, env);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // A pid that is not running: spawn a process and wait for it to exit.
    const dead = await new Promise<number>((resolve) => {
      const c = spawn(process.execPath, ['-e', '0']);
      c.on('exit', () => resolve(c.pid ?? 999999));
    });
    fs.writeFileSync(file, JSON.stringify({ pid: dead, hostname: os.hostname(), label: 'crashed', acquiredAt: 'x', key: '127.0.0.1:7693', token: 'dead' }));
    const lock = await acquireNeo4jLock(URI, { env, timeoutMs: 2000, pollMs: 20, onWait: () => undefined });
    expect(lock.mode).toBe('owned');
    expect((JSON.parse(fs.readFileSync(file, 'utf8')) as { token: string }).token).not.toBe('dead');
    lock.release();
  });

  it('withNeo4jLock releases after a throw; DAEDALUS_NEO4J_LOCK=off disables the lock', async () => {
    await expect(withNeo4jLock(URI, { env }, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(fs.existsSync(neo4jLockPath(URI, env))).toBe(false);
    const off = await acquireNeo4jLock(URI, { env: { ...env, DAEDALUS_NEO4J_LOCK: 'off' } });
    expect(off.mode).toBe('disabled');
    expect(fs.existsSync(neo4jLockPath(URI, env))).toBe(false);
  });
});
