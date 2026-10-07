import type { DomainResult } from '../errors/domain-result.js';

/**
 * Process runner port (C10, NFR-08, SECURITY-11). Used by the Claude CLI
 * provider (C14, U4) and the C15 generator adapter (U5a); no caller in U0.
 */
export interface ProcessRunOptions {
  readonly stdin?: string;
  readonly cwd?: string;
  readonly timeoutMs: number;
  /** Explicit allow-listed environment (see `buildChildEnv`), never `process.env` wholesale (NFR-08). */
  readonly env: Readonly<Record<string, string>>;
  /** Per-stream cap on captured output; excess is dropped and `truncated` set (D-U0-7). Default 10 MiB. */
  readonly maxOutputBytes?: number;
}

export interface ProcessResult {
  /** The child's exit code; `-1` when it ended by a signal (including our timeout kill). */
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  /** True when the runner killed the child because `timeoutMs` elapsed. */
  readonly timedOut: boolean;
  readonly durationMs: number;
  /** Present and true when stdout or stderr exceeded `maxOutputBytes` (D-U0-7). */
  readonly truncated?: boolean;
}

export interface ProcessRunner {
  /**
   * Fails (`DomainResult.fail`, code `PROCESS_SPAWN_FAILED`) only when the process
   * cannot be started, e.g. binary not found; a non-zero exit or a timeout is a
   * successful run with `exitCode` / `timedOut` set.
   */
  run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>>;
}
