/**
 * `NodeProcessRunner` and `buildChildEnv` (C10, NFR-08, SECURITY-11, D-U0-7).
 * No caller in `src/` in U0.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { DomainResult } from '../errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../interfaces/process-runner.js';

export const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
/** Grace period between SIGTERM and SIGKILL after a timeout (D-U0-7). */
export const KILL_GRACE_MS = 2000;

const IS_WINDOWS = process.platform === 'win32';

/** Collects one stream up to `cap` bytes and keeps draining the rest. */
class CappedBuffer {
  private readonly chunks: Buffer[] = [];
  private size = 0;
  private overflowed = false;

  constructor(private readonly cap: number) {}

  push(chunk: Buffer): void {
    const room = this.cap - this.size;
    if (room <= 0) {
      if (chunk.length > 0) {
        this.overflowed = true;
      }
      return;
    }
    if (chunk.length > room) {
      this.chunks.push(chunk.subarray(0, room));
      this.size += room;
      this.overflowed = true;
      return;
    }
    this.chunks.push(chunk);
    this.size += chunk.length;
  }

  get truncated(): boolean {
    return this.overflowed;
  }

  text(): string {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

/** Signals the child's whole process group on POSIX (it was started detached), the child alone on Windows. */
function signalTree(child: ChildProcess, signal: NodeJS.Signals): void {
  const pid = child.pid;
  if (pid === undefined) {
    return;
  }
  try {
    if (IS_WINDOWS) {
      child.kill(signal);
    } else {
      process.kill(-pid, signal);
    }
  } catch {
    // ESRCH: the group is already gone.
  }
}

/**
 * Runs a command with an argv array and no shell (`shell: false`), an explicit
 * environment and piped stdio. `command` is resolved against `options.env.PATH`;
 * with an environment that lacks `PATH`, pass an absolute path.
 *
 * - `stdin` is written and the stream closed (closed immediately when absent).
 * - On timeout the process group receives SIGTERM, then SIGKILL after 2 s;
 *   the result has `timedOut: true`.
 * - A child that ends by a signal has `exitCode: -1`.
 * - Each stream is capped at `maxOutputBytes` (default 10 MiB); `truncated: true` when exceeded.
 * - A spawn failure returns `DomainResult.fail` with code `PROCESS_SPAWN_FAILED` and the
 *   `errno` code in context; the message never contains environment values.
 */
export class NodeProcessRunner implements ProcessRunner {
  run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    return new Promise((resolve) => {
      const started = process.hrtime.bigint();
      const cap = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
      const stdout = new CappedBuffer(cap);
      const stderr = new CappedBuffer(cap);
      let spawned = false;
      let settled = false;
      let timedOut = false;
      let timeoutTimer: NodeJS.Timeout | undefined;

      const child = spawn(command, [...args], {
        shell: false,
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        env: { ...options.env },
        stdio: 'pipe',
        detached: !IS_WINDOWS,
      });

      child.once('spawn', () => {
        spawned = true;
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          signalTree(child, 'SIGTERM');
          // Not cleared on exit: grandchildren that ignore SIGTERM still get SIGKILL. unref so it never holds the loop.
          setTimeout(() => {
            signalTree(child, 'SIGKILL');
          }, KILL_GRACE_MS).unref();
        }, options.timeoutMs);
      });

      child.once('error', (error: NodeJS.ErrnoException) => {
        if (spawned || settled) {
          return; // e.g. a failed kill after start; 'close' still settles the run
        }
        settled = true;
        const errno = error.code ?? 'UNKNOWN';
        resolve(
          DomainResult.fail<ProcessResult>([
            {
              code: 'PROCESS_SPAWN_FAILED',
              message: `Failed to start process '${command}' (${errno})`,
              context: { command, errno },
            },
          ]),
        );
      });

      child.stdout.on('data', (chunk: Buffer) => {
        stdout.push(chunk);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr.push(chunk);
      });
      // EPIPE when the child exits without reading stdin is not a run failure.
      child.stdin.on('error', () => undefined);
      if (options.stdin !== undefined) {
        child.stdin.write(options.stdin);
      }
      child.stdin.end();

      child.once('close', (code: number | null) => {
        if (timeoutTimer !== undefined) {
          clearTimeout(timeoutTimer);
        }
        if (settled) {
          return;
        }
        settled = true;
        const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
        const truncated = stdout.truncated || stderr.truncated;
        const result: ProcessResult = {
          exitCode: code ?? -1,
          stdout: stdout.text(),
          stderr: stderr.text(),
          timedOut,
          durationMs,
          ...(truncated ? { truncated: true } : {}),
        };
        resolve(DomainResult.ok(result));
      });
    });
  }
}

/**
 * Copies only the allowed variable names that are defined in `parent`
 * (case-sensitive match on the names as `parent` spells them). The result is
 * frozen; `parent` is never mutated. An allow-list without `PATH` means the
 * runner needs an absolute binary path.
 */
export function buildChildEnv(parent: NodeJS.ProcessEnv, allow: readonly string[]): Readonly<Record<string, string>> {
  const present = new Set(Object.keys(parent));
  const env: Record<string, string> = {};
  for (const name of allow) {
    const value = present.has(name) ? parent[name] : undefined;
    if (value !== undefined) {
      env[name] = value;
    }
  }
  return Object.freeze(env);
}
