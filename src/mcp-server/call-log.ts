/**
 * MCP call log (v1.3, gate line D6; `Docs/v1.3/mcp-call-log.md`). OFF by default: only `--call-log <abs path>` or
 * `DAEDALUS_CALL_LOG` turns it on. One JSONL line per tool call, appended to a file that must lie outside the project
 * the agent edits. Arguments are hashed, never written (they carry file contents and diffs); only paths are kept.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export const CALL_LOG_SCHEMA = 'mcp-call/v1';

export interface CallLogEntry {
  readonly schema: typeof CALL_LOG_SCHEMA;
  readonly ts: string;
  readonly seq: number;
  readonly tool: string;
  readonly argsSha256: string;
  readonly filesTouched: readonly string[];
  readonly blockingCount: number | null;
  readonly verdict: string | null;
  readonly durationMs: number;
  readonly error: string | null;
  readonly treeChangedSinceStart: boolean | null;
}

/** Where the log goes and how the wrapper reads time and the project tree (injectable for tests). */
export interface CallLogger {
  readonly record: (entry: CallLogEntry) => void;
  readonly now: () => number;
  /** Fingerprint of the project tree now; null when there is no project. */
  readonly fingerprint: () => string | null;
  /** The fingerprint taken when the logger was created. */
  readonly startFingerprint: string | null;
}

const ERROR_CHARS = 200;
const SKIP_DIRS = new Set(['node_modules', '.git']);

function isInsideOrEqual(dir: string, p: string): boolean {
  const rel = path.relative(path.resolve(dir), path.resolve(p));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Null when `logPath` is acceptable: absolute and not inside (or equal to) the project. */
export function checkCallLogPath(logPath: string, project: string | undefined): string | null {
  if (!path.isAbsolute(logPath)) return `--call-log must be an absolute path (got ${logPath})`;
  if (project !== undefined && project !== '' && isInsideOrEqual(project, logPath)) {
    return '--call-log must lie outside --project (the agent may read and edit the project)';
  }
  return null;
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (typeof v === 'object' && v !== null) {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function argsSha256(args: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(args ?? {}))).digest('hex');
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** The file paths an argument object names (never contents): path fields, a finding's file and a diff's headers. */
export function filesTouched(args: unknown): readonly string[] {
  if (typeof args !== 'object' || args === null) return [];
  const a = args as Record<string, unknown>;
  const out = new Set<string>();
  for (const k of ['path', 'from', 'resolvedPath', 'file']) {
    const v = str(a[k]);
    if (v !== undefined) out.add(v);
  }
  if (Array.isArray(a.paths)) for (const p of a.paths) if (str(p) !== undefined) out.add(p as string);
  if (typeof a.finding === 'object' && a.finding !== null) {
    const f = a.finding as Record<string, unknown>;
    const v = str(f.file) ?? str(f.filePath);
    if (v !== undefined) out.add(v);
  }
  const diff = str(a.diff);
  if (diff !== undefined) {
    for (const m of diff.matchAll(/^\+\+\+ (?:b\/)?([^\t\r\n]+)/gm)) {
      const p = m[1]?.trim();
      if (p !== undefined && p !== '/dev/null') out.add(p);
    }
  }
  return [...out].sort();
}

function summary(result: CallToolResult): { blockingCount: number | null; verdict: string | null; error: string | null } {
  if (result.isError === true) {
    const first = result.content[0];
    const text = first !== undefined && first.type === 'text' ? first.text : 'error';
    return { blockingCount: null, verdict: null, error: text.slice(0, ERROR_CHARS) };
  }
  const s = (result.structuredContent ?? {}) as Record<string, unknown>;
  const count = typeof s.blockingCount === 'number' ? s.blockingCount : typeof s.blockingViolationCount === 'number' ? s.blockingViolationCount : null;
  const verdict = str(s.blockingVerdict) ?? str(s.verdict) ?? str(s.status) ?? null;
  return { blockingCount: count, verdict, error: null };
}

type Handler = (args: unknown) => Promise<CallToolResult>;

/** The handler with a log line written after every call; the client gets the handler's own answer object. */
export function withCallLog(logger: CallLogger, tool: string, handler: Handler, nextSeq: () => number): Handler {
  return async (args) => {
    const started = logger.now();
    const seq = nextSeq();
    const fp = logger.fingerprint();
    const changed = fp === null || logger.startFingerprint === null ? null : fp !== logger.startFingerprint;
    const base = { schema: CALL_LOG_SCHEMA, ts: new Date(started).toISOString(), seq, tool, argsSha256: argsSha256(args), filesTouched: filesTouched(args) } as const;
    try {
      const result = await handler(args);
      logger.record({ ...base, ...summary(result), durationMs: logger.now() - started, treeChangedSinceStart: changed });
      return result;
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, ERROR_CHARS);
      logger.record({ ...base, blockingCount: null, verdict: null, error: message, durationMs: logger.now() - started, treeChangedSinceStart: changed });
      throw e;
    }
  };
}

/** Paths, sizes and mtimes of every file under `root` (skipping node_modules and .git), hashed. */
export function treeFingerprint(root: string): string | null {
  if (!fs.existsSync(root)) return null;
  const rows: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        try {
          const st = fs.statSync(full);
          rows.push(`${path.relative(root, full)}\u0000${String(st.size)}\u0000${String(st.mtimeMs)}`);
        } catch {
          // vanished between readdir and stat: treat as absent
        }
      }
    }
  };
  walk(root);
  rows.sort();
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}

/** A logger appending to `logPath` (created empty at once), fingerprinting `project` when given. */
export function fileCallLogger(logPath: string, project: string | undefined): CallLogger {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, '');
  const fingerprint = (): string | null => (project === undefined || project === '' ? null : treeFingerprint(path.resolve(project)));
  return {
    record: (entry) => fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`),
    now: () => Date.now(),
    fingerprint,
    startFingerprint: fingerprint(),
  };
}
