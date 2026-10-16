/**
 * Study 2 analysis rehearsal: reading and writing loop out-roots. Reading goes through the harness's own
 * `readStepRecords` and `runDirFor` (`scripts/lib/loop/loop.ts`), so the analysis sees exactly what a resumed grid
 * would see. NOT A PRE-REGISTRATION.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RUN_JSON, readStepRecords, runDirFor, stepRecordPath } from '../../lib/loop/loop.js';
import { LOOP_SCHEDULE_JSON } from '../../lib/loop/main.js';
import type { RunRecord } from '../../lib/loop/types.js';
import type { LoadedRun } from './study2-analysis.js';
import type { SynthStudy } from './study2-synth.js';

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Writes a synthetic study as a harness out-root (`schedule.json`, `runs/<runId>/run.json`, `steps/step-NN.json`). */
export function writeOutRoot(outRoot: string, study: SynthStudy): void {
  if (fs.existsSync(outRoot) && fs.readdirSync(outRoot).length > 0) throw new Error(`${outRoot} is not empty; use a fresh out-root`);
  writeJson(path.join(outRoot, LOOP_SCHEDULE_JSON), study.schedule);
  for (const r of study.runs) {
    const dir = runDirFor(outRoot, r.run.runId);
    writeJson(path.join(dir, RUN_JSON), r.run);
    r.steps.forEach((s, i) => writeJson(stepRecordPath(dir, i), s));
  }
}

export interface LoadedOutRoot {
  readonly scheduled: readonly string[];
  readonly runs: readonly LoadedRun[];
  readonly missingRuns: readonly string[];
}

/** Loads every scheduled run of an out-root (a run without `run.json` is listed as missing). */
export function loadOutRoot(outRoot: string): LoadedOutRoot {
  const sched = JSON.parse(fs.readFileSync(path.join(outRoot, LOOP_SCHEDULE_JSON), 'utf8')) as { schema?: string; runs?: unknown };
  if (sched.schema !== 'loop-schedule/v1' || !Array.isArray(sched.runs)) throw new Error(`${outRoot}: not a loop out-root (schedule.json)`);
  const scheduled = sched.runs.filter((x): x is string => typeof x === 'string');
  const runs: LoadedRun[] = [];
  const missingRuns: string[] = [];
  for (const id of scheduled) {
    const dir = runDirFor(outRoot, id);
    const file = path.join(dir, RUN_JSON);
    if (!fs.existsSync(file)) {
      missingRuns.push(id);
      continue;
    }
    const run = JSON.parse(fs.readFileSync(file, 'utf8')) as RunRecord;
    if (run.schema !== 'loop-run/v1' || run.runId !== id) throw new Error(`${file}: not the loop-run/v1 record of ${id}`);
    runs.push({ run, steps: readStepRecords(dir, run.steps) });
  }
  return { scheduled, runs, missingRuns };
}
