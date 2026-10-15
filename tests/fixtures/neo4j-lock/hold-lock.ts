/**
 * Child process for tests/unit/shared/process/neo4j-lock.test.ts: stands in for one Neo4j run.
 * Usage: tsx hold-lock.ts <uri> <holdMs> <outFile> [timeoutMs] [spawnChild]
 * Acquires the lock (dir from DAEDALUS_NEO4J_LOCK_DIR), holds it for <holdMs>, appends one JSON line to <outFile>
 * ({ pid, mode, start, end }) and releases. With `spawnChild`, it runs a second copy of itself while holding the
 * lock (a `firewall evaluate` child of a validation run), which must not wait. A lock timeout appends
 * { pid, error: code } and exits 3.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { acquireNeo4jLock } from '../../../src/shared/process/neo4j-lock.js';

async function main(): Promise<void> {
  const [uri = '', holdMs = '0', outFile = '', timeoutMs, spawnChild] = process.argv.slice(2);
  let lock;
  try {
    lock = await acquireNeo4jLock(uri, { label: 'hold-lock fixture', pollMs: 20, onWait: () => undefined, ...(timeoutMs !== undefined && timeoutMs !== '' ? { timeoutMs: Number(timeoutMs) } : {}) });
  } catch (e) {
    fs.appendFileSync(outFile, `${JSON.stringify({ pid: process.pid, error: (e as NodeJS.ErrnoException).code })}\n`);
    process.exit(3);
  }
  const start = Date.now();
  if (spawnChild === 'spawnChild') {
    const r = spawnSync(process.execPath, [...process.execArgv, process.argv[1] ?? "", uri, '0', outFile, '2000'], { stdio: 'inherit', env: process.env });
    if (r.status !== 0) process.exitCode = 4;
  }
  await new Promise((resolve) => setTimeout(resolve, Number(holdMs)));
  const end = Date.now();
  fs.appendFileSync(outFile, `${JSON.stringify({ pid: process.pid, mode: lock.mode, start, end })}\n`);
  lock.release();
}

void main();
