/**
 * MEAN-01 panel: one diagnostic agy call (calibration item C1), the same argv, home, env and prompt as panel.ts, with the
 * raw stdout and stderr kept so the earlier hangs ("turn in progress") can be read. One call, no retry. Plain labelling
 * prompt only (PROTOCOL.md §3).
 *
 *   npx tsx experiments/mean-01-panel/diag-one-call.ts
 */
import * as fs from 'node:fs';
import {
  AGY_EXPLORATORY_VERSIONS, AGY_HOME_DEFAULT, buildAgyArgs, buildAgyChildEnv, checkAgyIsolation, composeAgyPrompt,
  createAgyNeutralCwd, expandHome, isAgyResultLine,
} from '../../src/llm-critic/agy-cli-provider.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { MODEL, RESPONSE_SCHEMA, allItems, promptFor } from './panel.js';

const OUT = 'experiments/mean-01-panel/results/diag';
const PRINT_TIMEOUT_S = 240;

async function main(): Promise<void> {
  const home = expandHome(AGY_HOME_DEFAULT);
  const runner = new NodeProcessRunner();
  const iso = await checkAgyIsolation({ runner, home, exploratoryVersions: AGY_EXPLORATORY_VERSIONS });
  if (!iso.success) { process.stdout.write(`preflight failed: ${iso.errors[0]?.code ?? '?'}\n`); return; }
  const item = allItems().calibration.find((x) => x.id === 'C1');
  if (item === undefined) throw new Error('item C1 not found');
  const cwd = createAgyNeutralCwd();
  if (!cwd.success) throw new Error('no neutral cwd');
  const argv = buildAgyArgs({ model: MODEL, schema: RESPONSE_SCHEMA, printTimeoutS: PRINT_TIMEOUT_S });
  const t0 = Date.now();
  const run = await runner.run(argv.binary, argv.args, {
    stdin: composeAgyPrompt(promptFor(item), undefined),
    cwd: cwd.data,
    env: buildAgyChildEnv(process.env, home),
    timeoutMs: (PRINT_TIMEOUT_S + 30) * 1000,
    stopOnLine: isAgyResultLine,
  });
  fs.mkdirSync(OUT, { recursive: true });
  const at = new Date().toISOString();
  const data = run.success ? run.data as unknown as Record<string, unknown> : { error: run.errors[0]?.message ?? '?' };
  fs.writeFileSync(`${OUT}/stdout.jsonl`, String(data.stdout ?? ''));
  fs.writeFileSync(`${OUT}/stderr.txt`, String(data.stderr ?? ''));
  const meta = { at, item: 'C1', model: MODEL, argvFlags: argv.argvFlags, durationMs: Date.now() - t0, exitCode: data.exitCode ?? null, timedOut: data.timedOut ?? null, error: data.error ?? null };
  fs.writeFileSync(`${OUT}/meta.json`, `${JSON.stringify(meta, null, 1)}\n`);
  process.stdout.write(`${JSON.stringify(meta)}\n`);
}

void main();
