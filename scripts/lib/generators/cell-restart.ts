/**
 * Atomic cell restart (ADR-021 SO5; SO5-04; BR-U5a-49, 50).
 *
 * A cell is generated in a staging directory `<outRoot>/.staging/<runId>/` and committed by one rename to its cell
 * directory `<outRoot>/<modelId>/<taskId>/<specLevel>/run-<i>/` after `generation.json` (written atomically) is in
 * place. So a cell directory exists only complete, and a stop at any point (a kill during a session or a usage-limit
 * pause, or a grid stopped by `GEN_USAGE_LIMIT_PERSISTS`) leaves at most a partial staging directory.
 *
 * `recoverCell` runs before each cell of a (re)started grid:
 * - `complete`: the cell directory holds `generation.json`; the cell is not re-run;
 * - `promoted`: the staging directory holds a complete `generation.json` (a stop between the outcome write and the
 *   rename); it is renamed into place, nothing is regenerated;
 * - `discarded`: a partial cell (staging directory, a cell directory without `generation.json` from an older harness,
 *   or a cell's `interruptions/<runId>/`) is moved whole to `<outRoot>/restarts/<runId>/<k>/{staging,cell,interruptions}`
 *   and the cell is regenerated from scratch. A discarded cell is never joined, scored or replaced by a model failure:
 *   the restart is a harness event, like an infrastructure retry;
 * - `fresh`: nothing exists yet.
 * Every `promoted` and `discarded` event is appended to `<outRoot>/restarts.jsonl` (`CellRestartRecord`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generationJsonPath } from './outcome.js';

export const STAGING_DIR = '.staging';
export const RESTARTS_DIR = 'restarts';
export const RESTARTS_LOG = 'restarts.jsonl';
/** Directory of a cell's usage-limit interruptions (BR-U5a-50); the same name as `grid.ts` `INTERRUPTIONS_DIR`. */
const INTERRUPTIONS = 'interruptions';

export type RestartPart = 'staging' | 'cell' | 'interruptions';

export type CellRecovery =
  | { readonly kind: 'complete' }
  | { readonly kind: 'fresh' }
  | { readonly kind: 'promoted' }
  | { readonly kind: 'discarded'; readonly movedTo: string; readonly parts: readonly RestartPart[] };

/** One line of `restarts.jsonl`; `movedTo` is POSIX, relative to `outRoot`. */
export interface CellRestartRecord {
  readonly at: string;
  readonly runId: string;
  readonly kind: 'promoted' | 'discarded';
  readonly parts: readonly RestartPart[];
  readonly movedTo?: string;
}

function under(outRoot: string, ...rel: string[]): string {
  return path.join(outRoot, ...rel.flatMap((r) => r.split('/')));
}

/** `<outRoot>/.staging/<runId>/`. */
export function stagingDirFor(outRoot: string, runId: string): string {
  return under(outRoot, STAGING_DIR, runId);
}

function nextRestartIndex(outRoot: string, runId: string): number {
  const dir = under(outRoot, RESTARTS_DIR, runId);
  if (!fs.existsSync(dir)) return 0;
  const used = fs.readdirSync(dir).filter((n) => /^\d+$/.test(n)).map(Number);
  return used.length === 0 ? 0 : Math.max(...used) + 1;
}

function appendLog(outRoot: string, record: CellRestartRecord): void {
  fs.mkdirSync(outRoot, { recursive: true });
  fs.appendFileSync(path.join(outRoot, RESTARTS_LOG), `${JSON.stringify(record)}\n`);
}

function moveInto(from: string, to: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

/** Commits a finished staging directory: one rename onto the (absent) cell directory. */
export function commitCell(stagingDir: string, cellDir: string): void {
  moveInto(stagingDir, cellDir);
}

/** Recovers one cell before it runs (see the module header). `now` stamps the log line. */
export function recoverCell(outRoot: string, runId: string, cellDir: string, now: () => Date = () => new Date()): CellRecovery {
  if (fs.existsSync(generationJsonPath(cellDir))) return { kind: 'complete' };
  const staging = stagingDirFor(outRoot, runId);
  const interruptions = under(outRoot, INTERRUPTIONS, runId);
  const present: { part: RestartPart; dir: string }[] = [];
  if (fs.existsSync(cellDir)) present.push({ part: 'cell', dir: cellDir });
  const stagedComplete = fs.existsSync(generationJsonPath(staging));
  if (!stagedComplete && fs.existsSync(staging)) present.push({ part: 'staging', dir: staging });
  if (!stagedComplete && fs.existsSync(interruptions)) present.push({ part: 'interruptions', dir: interruptions });

  let movedTo: string | undefined;
  if (present.length > 0) {
    movedTo = path.posix.join(RESTARTS_DIR, runId, String(nextRestartIndex(outRoot, runId)));
    for (const p of present) moveInto(p.dir, under(outRoot, movedTo, p.part));
  }
  const parts = present.map((p) => p.part);
  if (stagedComplete) {
    commitCell(staging, cellDir);
    appendLog(outRoot, { at: now().toISOString(), runId, kind: 'promoted', parts, ...(movedTo !== undefined ? { movedTo } : {}) });
    return { kind: 'promoted' };
  }
  if (movedTo === undefined) return { kind: 'fresh' };
  appendLog(outRoot, { at: now().toISOString(), runId, kind: 'discarded', parts, movedTo });
  return { kind: 'discarded', movedTo, parts };
}
