/** Shared helpers of the EFF-01 harness tests: temp dirs, a fake clock, a zero-wait sleeper, the committed inputs. */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Clock, Sleeper } from '../../../../../scripts/lib/generators/retry.js';
import { loadEff01Inputs } from '../../../../../scripts/v1.3/lib/eff01/inputs.js';
import type { Eff01Inputs } from '../../../../../scripts/v1.3/lib/eff01/inputs.js';

export const REPO = path.resolve(__dirname, '../../../../..');
export const FIXTURE_TREE = path.join(REPO, 'tests/fixtures/eff01/tree-mini');

export function tmpDir(prefix: string): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `eff01-${prefix}-`)));
}

/** A clock that advances 7 ms per read, from a fixed start. */
export function fakeClock(start = Date.UTC(2026, 9, 18, 12, 0, 0)): Clock & { reads: number } {
  const c = { reads: 0, now: (): number => start + 7 * c.reads++ };
  return c;
}

/** Records every requested pause and never waits. */
export function zeroSleep(): Sleeper & { calls: number[] } {
  const calls: number[] = [];
  const s = ((ms: number) => {
    calls.push(ms);
    return Promise.resolve();
  }) as Sleeper & { calls: number[] };
  s.calls = calls;
  return s;
}

export function inputs(): Eff01Inputs {
  const r = loadEff01Inputs(REPO);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

/** Every file under `dir`, gz files decompressed, as one text. */
export function allStoredText(dir: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zlib = require('node:zlib') as typeof import('node:zlib');
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(e.name.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(p)).toString('utf8') : fs.readFileSync(p, 'utf8'));
    }
  };
  walk(dir);
  return out.join('\n');
}
