/**
 * NodeProcessRunner (U0 Step 28, NFR-08, SECURITY-11, D-U0-7), exercised with
 * real child processes of `process.execPath`.
 */
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import type { ProcessResult } from '../../../../src/shared/interfaces/process-runner.js';
import type { DomainResult } from '../../../../src/shared/errors/domain-result.js';

const NODE = process.execPath;

/**
 * Variables the operating system adds to every child regardless of the env we pass:
 * macOS CoreFoundation sets __CF_USER_TEXT_ENCODING; Windows needs SYSTEMROOT (added by
 * libuv when missing). Linux adds nothing.
 */
const PLATFORM_ALLOW: Readonly<Record<string, readonly string[]>> = {
  darwin: ['__CF_USER_TEXT_ENCODING'],
  win32: ['SYSTEMROOT', 'SystemRoot'],
};

function data(result: DomainResult<ProcessResult>): ProcessResult {
  if (!result.success) {
    throw new Error(`expected success, got ${JSON.stringify(result.errors)}`);
  }
  return result.data;
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntilGone(pid: number, withinMs: number): Promise<boolean> {
  const deadline = Date.now() + withinMs;
  while (Date.now() < deadline) {
    if (!alive(pid)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return !alive(pid);
}

describe('NodeProcessRunner', () => {
  const runner = new NodeProcessRunner();

  it('passes argv verbatim without a shell', async () => {
    const hostile = '$(echo pwned); echo x';
    const result = data(
      await runner.run(NODE, ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', hostile], {
        timeoutMs: 10_000,
        env: {},
      }),
    );
    expect(JSON.parse(result.stdout)).toEqual([hostile]);
    expect(result.stdout).not.toContain('pwned\n');
  });

  it('gives the child only the keys of options.env plus the documented platform set', async () => {
    const env = { DAEDALUS_ALLOWED: 'yes', ANOTHER: '1' };
    const result = data(
      await runner.run(NODE, ['-e', 'process.stdout.write(JSON.stringify(Object.keys(process.env)))'], {
        timeoutMs: 10_000,
        env,
      }),
    );
    const keys = JSON.parse(result.stdout) as string[];
    const allowed = new Set([...Object.keys(env), ...(PLATFORM_ALLOW[process.platform] ?? [])]);
    expect(keys.filter((k) => !allowed.has(k))).toEqual([]);
    expect(keys).toEqual(expect.arrayContaining(['DAEDALUS_ALLOWED', 'ANOTHER']));
  });

  it('round-trips stdin', async () => {
    const script =
      "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(s.toUpperCase()))";
    const result = data(await runner.run(NODE, ['-e', script], { timeoutMs: 10_000, env: {}, stdin: 'hello\nworld' }));
    expect(result.stdout).toBe('HELLO\nWORLD');
  });

  it('closes stdin when none is given, so a reader does not hang', async () => {
    const script = "let n=0;process.stdin.on('data',c=>n+=c.length);process.stdin.on('end',()=>process.stdout.write(String(n)))";
    const result = data(await runner.run(NODE, ['-e', script], { timeoutMs: 10_000, env: {} }));
    expect(result.timedOut).toBe(false);
    expect(result.stdout).toBe('0');
  });

  it('honours cwd', async () => {
    const dir = realpathSync(tmpdir());
    const result = data(
      await runner.run(NODE, ['-e', 'process.stdout.write(process.cwd())'], { timeoutMs: 10_000, env: {}, cwd: dir }),
    );
    expect(realpathSync(result.stdout)).toBe(dir);
  });

  it('reports a non-zero exit as a successful run', async () => {
    const result = await runner.run(NODE, ['-e', "process.stderr.write('bad');process.exit(3)"], {
      timeoutMs: 10_000,
      env: {},
    });
    expect(result.success).toBe(true);
    const run = data(result);
    expect(run.exitCode).toBe(3);
    expect(run.stderr).toBe('bad');
    expect(run.timedOut).toBe(false);
    expect('truncated' in run).toBe(false);
  });

  it('reports a signal exit as exitCode -1', async () => {
    if (process.platform === 'win32') {
      return;
    }
    const result = data(
      await runner.run(NODE, ['-e', "process.kill(process.pid,'SIGKILL')"], { timeoutMs: 10_000, env: {} }),
    );
    expect(result.exitCode).toBe(-1);
    expect(result.timedOut).toBe(false);
  });

  it('kills a timed-out child and its grandchild', async () => {
    if (process.platform === 'win32') {
      return;
    }
    // /bin/sh starts in milliseconds, so the grandchild exists well before the 200 ms timeout
    // even under a loaded parallel jest run (a node child may not have started by then).
    // The runner itself still uses no shell: /bin/sh is the command, the script is one argv entry.
    const script = 'sleep 10 >/dev/null 2>&1 & echo $!; sleep 10';
    const startedAt = Date.now();
    const result = data(await runner.run('/bin/sh', ['-c', script], { timeoutMs: 200, env: {} }));
    const elapsed = Date.now() - startedAt;

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(-1);
    expect(elapsed).toBeLessThan(2500);
    const grandchild = Number(result.stdout.trim());
    expect(Number.isInteger(grandchild) && grandchild > 0).toBe(true);
    expect(await waitUntilGone(grandchild, 2500)).toBe(true);
  }, 15_000);

  it('fails with PROCESS_SPAWN_FAILED when the binary does not exist', async () => {
    const result = await runner.run('/nonexistent/daedalus-no-such-binary', [], {
      timeoutMs: 1000,
      env: { SECRET_VALUE: 'must-not-appear' },
    });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.errors[0]?.code).toBe('PROCESS_SPAWN_FAILED');
    expect(result.errors[0]?.context).toMatchObject({ errno: 'ENOENT' });
    expect(JSON.stringify(result.errors)).not.toContain('must-not-appear');
  });

  it('truncates output over maxOutputBytes and flags it', async () => {
    const result = data(
      await runner.run(NODE, ['-e', "process.stdout.write('x'.repeat(5000));process.stderr.write('ok')"], {
        timeoutMs: 10_000,
        env: {},
        maxOutputBytes: 100,
      }),
    );
    expect(result.stdout).toBe('x'.repeat(100));
    expect(result.stderr).toBe('ok');
    expect(result.truncated).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('measures a positive duration', async () => {
    const result = data(await runner.run(NODE, ['-e', ''], { timeoutMs: 10_000, env: {} }));
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.exitCode).toBe(0);
  });
});
