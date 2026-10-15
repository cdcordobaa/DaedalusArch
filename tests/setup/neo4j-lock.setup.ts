/**
 * Jest `setupFilesAfterEnv` (every config: jest.config.cjs, and the golden configs that spread it).
 *
 * v1.3 fix round, fix 1: a suite that can reach Neo4j holds the cross-process Neo4j lock
 * (`src/shared/process/neo4j-lock.ts`) from `beforeAll` to `afterAll`, so it never runs at the same time as another
 * worktree's suite, a validation run or a `firewall evaluate` on the same database. Two jest workers are two
 * processes, so their Neo4j suites serialise as well; the CLI children a suite spawns see their ancestor's lock.
 *
 * A suite "can reach Neo4j" when `NEO4J_PASSWORD` is set and its source names the Neo4j guard or driver
 * (`resolveGoldenEnv`, `NEO4J_PASSWORD`, `neo4j-driver`). Without `NEO4J_PASSWORD` every Neo4j suite skips, so
 * nothing is locked.
 */
import * as fs from 'node:fs';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock';
import type { Neo4jLockHandle } from '../../src/shared/process/neo4j-lock';

const NEO4J_SUITE = /resolveGoldenEnv|NEO4J_PASSWORD|from ['"]neo4j-driver['"]/;
const LOCK_WAIT_MS = 45 * 60 * 1000;

function suiteUsesNeo4j(): boolean {
  if ((process.env.NEO4J_PASSWORD ?? '') === '') return false;
  const testPath = expect.getState().testPath;
  if (testPath === undefined) return false;
  try {
    return NEO4J_SUITE.test(fs.readFileSync(testPath, 'utf8'));
  } catch {
    return false;
  }
}

if (suiteUsesNeo4j()) {
  let lock: Neo4jLockHandle | undefined;
  beforeAll(async () => {
    lock = await acquireNeo4jLock(process.env.NEO4J_URI ?? 'bolt://localhost:7687', {
      label: `jest ${expect.getState().testPath ?? ''}`,
      timeoutMs: LOCK_WAIT_MS,
    });
  }, LOCK_WAIT_MS + 60_000);
  afterAll(() => {
    lock?.release();
  });
}
