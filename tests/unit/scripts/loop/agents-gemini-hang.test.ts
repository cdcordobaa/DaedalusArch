/**
 * U11 (BUILD-G) item 1: agy 1.4.2 prints its `result` event and then never exits. The Gemini generator path must end
 * the turn on that line (`stopOnLine: isAgyResultLine`), never wait for the process to exit. A FAKE agy (a node script
 * that prints a result and hangs) runs through the real `NodeProcessRunner`; the hard kill is 90 s, so a turn that
 * waited for the exit would fail this suite's 30 s timeout. No agy process, no model call.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { createAgyGenCliConfig } from '../../../../scripts/lib/generators/agy-gen-cli.js';
import { createGeneratorCliConfig } from '../../../../scripts/lib/generators/config.js';
import { GeminiStepAgent } from '../../../../scripts/lib/loop/agents.js';
import type { TurnInput } from '../../../../scripts/lib/loop/types.js';
import { runGeminiTurnDryRun } from '../../../../scripts/v1.4/lib/gemini-turn-dry-run.js';

jest.setTimeout(30_000);

const REPO = process.cwd();
const MODEL = 'dry-run-gemini-model';

/** Prints `agy 0.0.0` for `--version`; for a turn, writes one file, prints init and result, then never exits. */
const HANGING_AGY = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
if (process.argv[2] === '--version') { process.stdout.write('agy 0.0.0\\n'); process.exit(0); }
process.stdin.resume();
process.stdin.on('end', () => {
  fs.writeFileSync('generated.ts', 'export const x = 1;\\n');
  const ev = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
  ev({ event: 'init', conversation_id: 'c', init: { model: '${MODEL}' } });
  ev({ event: 'step_update', step_update: { step_index: 1, state: 'DONE', step_type: 'tool', tool_name: 'write_to_file', tool_info: { parameters: { TargetFile: 'generated.ts' } } } });
  ev({ event: 'result', result: { status: 'SUCCESS', response: 'done', duration_seconds: 1, usage: { input_tokens: 3, output_tokens: 2 } } });
  setInterval(() => undefined, 1 << 30);
});
`;

class Recording implements ProcessRunner {
  readonly results: ProcessResult[] = [];
  private readonly inner = new NodeProcessRunner();
  async run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    const r = await this.inner.run(command, args, options);
    if (r.success && args[0] !== '--version') this.results.push(r.data);
    return r;
  }
}

let tmp: string;
let binary: string;
beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u11-hang-')));
  binary = path.join(tmp, 'bin', 'agy');
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  fs.writeFileSync(binary, HANGING_AGY, { mode: 0o755 });
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const parentEnv = (): NodeJS.ProcessEnv => ({ PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: path.join(tmp, 'real-home') });

it('the fake agy really hangs after its result line (without stopOnLine the runner waits for the kill)', async () => {
  const r = await new NodeProcessRunner().run(binary, [], { env: { PATH: parentEnv().PATH ?? '' }, stdin: 'x', timeoutMs: 1500, cwd: tmp });
  if (!r.success) throw new Error('spawn');
  expect(r.data.stdout).toContain('"event":"result"');
  expect(r.data.timedOut).toBe(true);
});

it('GeminiStepAgent ends the turn on the result event: completed, one attempt, well before the hard kill', async () => {
  const H = path.join(tmp, 'h');
  const homes = { none: path.join(tmp, 'homes', 'none'), 'daedalus-mcp': path.join(tmp, 'homes', 'mcp') };
  for (const d of [H, ...Object.values(homes)]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  for (const d of Object.values(homes)) fs.chmodSync(d, 0o700);
  const base = createGeneratorCliConfig({ binary, modelId: MODEL, outputRoot: path.join(tmp, 'out'), harnessRoot: H }, REPO);
  if (!base.success) throw new Error('base');
  const config = createAgyGenCliConfig({ base: base.data, homes, cliVersion: '0.0.0', printTimeoutS: 60 }, REPO);
  if (!config.success) throw new Error('config');
  expect(config.data.timeoutMs).toBe(90_000);
  const runner = new Recording();
  const runId = `agy-cli/${MODEL}/todo-list/none/run-0`;
  const cwd = path.join(tmp, 'out', 'runs', ...runId.split('/'), 'work');
  fs.mkdirSync(cwd, { recursive: true });
  const input: TurnInput = {
    runId,
    turnId: 'step-01',
    taskId: 'todo-list',
    kind: 'step',
    stepIndex: 0,
    arm: 'none',
    cwd,
    prompt: 'Step 1.',
    recordDir: path.join(tmp, 'out', 'records'),
    changedFiles: () => 1,
    restore: () => DomainResult.ok(undefined),
    archive: () => DomainResult.ok('x'),
  };
  const started = Date.now();
  const r = await new GeminiStepAgent(config.data, { runner, parentEnv: parentEnv(), sleep: () => Promise.resolve() }).runTurn(input);
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code} ${e.message}`).join(','));
  expect(Date.now() - started).toBeLessThan(20_000);
  expect(r.data.status).toBe('completed');
  expect(r.data.attempts.map((a) => a.outcome)).toEqual(['completed']);
  expect(r.data.usage.outputTokens).toBe(2);
  expect(runner.results).toHaveLength(1);
  expect(runner.results[0]).toMatchObject({ stoppedOnOutput: true, timedOut: false });
  expect(fs.existsSync(path.join(cwd, 'generated.ts'))).toBe(true);
});

it('the U11 dry run: one stub turn through the loop under the Gemini plan template ends on the result line', async () => {
  const r = await runGeminiTurnDryRun(REPO, tmp);
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code} ${e.message}`).join(','));
  const s = r.data as { modelId: string; cliVersion: string; modelCall: { stoppedOnResult: boolean; timedOut: boolean }; turn: { status: string }; process: { logFound: boolean }; s4: { withoutAllowSynthetic: string } };
  expect(s.modelId).toBe('gemini-4-argon-high');
  expect(s.cliVersion).toBe('1.4.2');
  expect(s.modelCall).toMatchObject({ stoppedOnResult: true, timedOut: false });
  expect(s.turn.status).toBe('completed');
  expect(s.process.logFound).toBe(true);
  expect(s.s4.withoutAllowSynthetic).toBe('LOOP_GEMINI_S4_SYNTHETIC');
  expect(JSON.stringify(r.data)).not.toMatch(/\/tmp\/|\/home\/|\/Users\/|dry-run-not-a-key/);
  // The committed record matches a fresh run.
  expect(r.data).toEqual(JSON.parse(fs.readFileSync(path.join(REPO, 'results/v1.4-gemini-turn-dry-run/summary.json'), 'utf8')));
});
