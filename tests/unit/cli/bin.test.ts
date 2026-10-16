/**
 * The packaged CLI entry runs. `dist/cli/index.js` is a re-export barrel that calls nothing, so a bin pointing at it
 * exits 0 with no output (agent-proof run, Docs/v1.3/agent-proof-2026-10-16.md). This builds the sources with the
 * project's tsconfig into a scratch outDir under the repository (so `node_modules` resolves) and spawns the built
 * `cli/bin.js` with `--help`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.join(ROOT, '.cache', 'bin-test-dist');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

describe('built CLI bin', () => {
  beforeAll(() => {
    fs.rmSync(OUT, { recursive: true, force: true });
    execFileSync(process.execPath, [TSC, '-p', path.join(ROOT, 'tsconfig.json'), '--outDir', OUT], {
      stdio: 'pipe',
    });
  }, 180_000);

  afterAll(() => {
    fs.rmSync(OUT, { recursive: true, force: true });
  });

  it('cli/bin.js --help prints the usage and exits 0', () => {
    const r = spawnSync(process.execPath, [path.join(OUT, 'cli', 'bin.js'), '--help'], {
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^Usage: /m);
    expect(r.stdout).toContain('evaluate');
  });
});
