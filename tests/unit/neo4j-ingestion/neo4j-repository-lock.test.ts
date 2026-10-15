/**
 * v1.3 fix round, fix 1: `Neo4jRepository({ lock: true })` (the pipeline's repository) holds the cross-process Neo4j
 * lock from its first query until `close()`; without `lock` it never touches the lock. The driver is mocked.
 */
const mockRun = jest.fn();
const mockSession = jest.fn(() => ({ run: mockRun, close: jest.fn().mockResolvedValue(undefined) }));
jest.mock('neo4j-driver', () => ({
  __esModule: true,
  default: {
    driver: () => ({ session: mockSession, close: jest.fn().mockResolvedValue(undefined) }),
    auth: { basic: jest.fn(() => ({})) },
  },
}));

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Neo4jRepository } from '../../../src/neo4j-ingestion/neo4j-repository.js';
import { acquireNeo4jLock, neo4jLockPath, NEO4J_LOCK_TIMEOUT } from '../../../src/shared/process/neo4j-lock.js';

const URI = 'bolt://localhost:7693';
const result = { records: [], summary: { counters: { updates: () => ({}) } } };
let dir: string;
let saved: string | undefined;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-lock-test-'));
  saved = process.env.DAEDALUS_NEO4J_LOCK_DIR;
  process.env.DAEDALUS_NEO4J_LOCK_DIR = dir;
  mockRun.mockReset();
  mockRun.mockResolvedValue(result);
});
afterEach(() => {
  if (saved === undefined) delete process.env.DAEDALUS_NEO4J_LOCK_DIR; else process.env.DAEDALUS_NEO4J_LOCK_DIR = saved;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('Neo4jRepository lock', () => {
  it('lock: true holds the lock from the first query until close()', async () => {
    const repo = new Neo4jRepository({ neo4jUri: URI, neo4jPassword: 'unit-test-pw', lock: true });
    const file = neo4jLockPath(URI);
    expect(fs.existsSync(file)).toBe(false);
    await Promise.all([repo.executeQuery('RETURN 1'), repo.executeQuery('RETURN 2')]);
    expect(fs.existsSync(file)).toBe(true);
    expect((JSON.parse(fs.readFileSync(file, 'utf8')) as { pid: number }).pid).toBe(process.pid);
    await repo.close();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('without lock the repository never creates a lock file', async () => {
    const repo = new Neo4jRepository({ neo4jUri: URI, neo4jPassword: 'unit-test-pw' });
    await repo.executeQuery('RETURN 1');
    await repo.close();
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('a lock it cannot get is a failed query (NEO4J_LOCK_TIMEOUT), never a query on a shared database', async () => {
    const file = neo4jLockPath(URI);
    // A live process that is not an ancestor of this one holds the lock.
    const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
    fs.writeFileSync(file, JSON.stringify({ pid: other.pid, hostname: 'h', label: 'other run', acquiredAt: 'x', key: 'k', token: 't' }));
    const prev = process.env.DAEDALUS_NEO4J_LOCK_TIMEOUT_MS;
    process.env.DAEDALUS_NEO4J_LOCK_TIMEOUT_MS = '150';
    try {
      const repo = new Neo4jRepository({ neo4jUri: URI, neo4jPassword: 'unit-test-pw', lock: true });
      const r = await repo.executeQuery('MATCH (n) DETACH DELETE n');
      expect(r.success).toBe(false);
      if (!r.success) expect(r.errors[0]?.code).toBe(NEO4J_LOCK_TIMEOUT);
      expect(mockRun).not.toHaveBeenCalled();
      await repo.close();
      expect(fs.existsSync(file)).toBe(true); // someone else's lock is left alone
    } finally {
      other.kill();
      if (prev === undefined) delete process.env.DAEDALUS_NEO4J_LOCK_TIMEOUT_MS; else process.env.DAEDALUS_NEO4J_LOCK_TIMEOUT_MS = prev;
    }
  });

  it('inside a holder (a jest suite, the validation runner) the repository lock is re-entrant', async () => {
    const outer = await acquireNeo4jLock(URI);
    const repo = new Neo4jRepository({ neo4jUri: URI, neo4jPassword: 'unit-test-pw', lock: true });
    expect((await repo.executeQuery('RETURN 1')).success).toBe(true);
    await repo.close();
    expect(fs.existsSync(outer.path)).toBe(true);
    outer.release();
    expect(fs.existsSync(outer.path)).toBe(false);
  });
});
