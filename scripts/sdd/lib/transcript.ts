/**
 * The SDD demo transcript (Docs/v1.3/sdd-demo.md): one JSON object per line, in the order things happened. It is the
 * single record of the run: the files the coding agent wrote (full contents, so the run can be rebuilt), each derived
 * architecture spec, every MCP tool call with its arguments and result, every in-process full evaluation, and the
 * agent's short notes. Paths are relative to the demo project root; the absolute root of the recording machine never
 * appears (it is replaced by `<project>`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

export type Phase = 'proposal' | 'specs' | 'design' | 'tasks' | 'implement' | 'fix' | 'archive' | 'setup';

export interface FileChange {
  readonly path: string;
  readonly op: 'write' | 'delete';
  readonly sha256?: string;
  readonly content?: string;
}

interface Base {
  readonly seq: number;
  readonly change: string;
  readonly phase: Phase;
}

export interface FilesEvent extends Base {
  readonly kind: 'files';
  readonly note: string;
  readonly files: readonly FileChange[];
}

export interface DeriveEvent extends Base {
  readonly kind: 'derive-spec';
  readonly generator: string;
  /** Active OpenSpec changes read besides the archived ones. */
  readonly activeChanges: readonly string[];
  readonly inputs: readonly { readonly rel: string; readonly sha256: string }[];
  readonly out: string;
  readonly sha256: string;
  readonly content: string;
}

export interface ToolCallEvent extends Base {
  readonly kind: 'tool-call';
  readonly note: string;
  readonly transport: 'stdio';
  readonly tool: string;
  /** Arguments as sent, with the spec path project-relative (the client resolves it). */
  readonly args: Record<string, unknown>;
  readonly isError: boolean;
  /** structuredContent of the result (or the error text), with the absolute root replaced by `<project>`. */
  readonly result: unknown;
  readonly latencyMs: number;
  readonly serverStartMs: number;
}

export interface FullEvalEvent extends Base {
  readonly kind: 'full-eval';
  readonly engine: 'cypher-interp';
  readonly verdict: 'pass' | 'fail' | 'incomplete';
  readonly blocking: readonly FullFindingKey[];
  readonly advisoryCount: number;
  readonly advisoryRules: readonly string[];
  /** Advisory findings without the noisy metrics (absent in events recorded before it was added, #1-#41). */
  readonly advisory?: readonly FullFindingKey[];
  readonly durationMs: number;
}

export interface FullFindingKey {
  readonly ruleId: string;
  readonly file: string;
  readonly target: string;
}

export interface NoteEvent extends Base {
  readonly kind: 'note';
  readonly text: string;
}

export type TranscriptEvent = FilesEvent | DeriveEvent | ToolCallEvent | FullEvalEvent | NoteEvent;

/** Distributive Omit, so a union member keeps its own fields. */
export type NewEvent = TranscriptEvent extends infer E ? (E extends TranscriptEvent ? Omit<E, 'seq'> : never) : never;

export const sha256 = (t: string): string => createHash('sha256').update(t).digest('hex');

export function readTranscript(file: string): TranscriptEvent[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as TranscriptEvent);
}

export function appendEvent(file: string, event: NewEvent): TranscriptEvent {
  const seq = readTranscript(file).length + 1;
  const full = { seq, ...event } as TranscriptEvent;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(full)}\n`);
  return full;
}

/** The project's files after the given events (files and derived specs), as path -> content. */
export function stateAfter(events: readonly TranscriptEvent[]): Map<string, string> {
  const state = new Map<string, string>();
  for (const e of events) {
    if (e.kind === 'files') {
      for (const f of e.files) {
        if (f.op === 'delete') state.delete(f.path);
        else state.set(f.path, f.content ?? '');
      }
    } else if (e.kind === 'derive-spec') {
      state.set(e.out, e.content);
    }
  }
  return state;
}

/** Directories the recorder never snapshots: the transcript itself and tool output. */
export const IGNORED = Object.freeze(['transcript', 'node_modules', 'dist', '.apg-store']);

/** Every file under the root (POSIX, relative), minus the ignored directories. */
export function listTree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rel: string): void => {
    for (const d of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = rel === '' ? d.name : `${rel}/${d.name}`;
      if (d.isDirectory()) {
        if (!IGNORED.includes(d.name)) walk(r);
      } else if (d.isFile()) {
        out.set(r, fs.readFileSync(path.join(root, r), 'utf8'));
      }
    }
  };
  if (fs.existsSync(root)) walk('');
  return out;
}

/** The changes that turn `before` into `after`, sorted by path. */
export function changesBetween(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): FileChange[] {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const out: FileChange[] = [];
  for (const p of paths) {
    const a = after.get(p);
    if (a === undefined) out.push({ path: p, op: 'delete' });
    else if (before.get(p) !== a) out.push({ path: p, op: 'write', sha256: sha256(a), content: a });
  }
  return out;
}

export function writeTree(root: string, files: ReadonlyMap<string, string>): void {
  for (const [rel, content] of files) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

/** JSON with every occurrence of the absolute root replaced by `<project>` (and parsed back). */
export function canonical(value: unknown, root: string): unknown {
  const abs = path.resolve(root);
  return JSON.parse(JSON.stringify(value ?? null).split(abs).join('<project>')) as unknown;
}
