/**
 * U11 dry run: ONE stub generation turn, end to end through the loop, with the Gemini adapter, under the Gemini plan
 * template (`experiments/loop-gemini/gemini-plan.template.json`: model pin `gemini-4-argon-high`, agy 1.4.2).
 *
 * Unlike the U5 adapter dry run (a scripted `ProcessRunner`), this one uses the real `NodeProcessRunner` and a FAKE
 * `agy` binary: a node script that answers `--version` with the pin and, for a turn, writes the stub generator's files
 * into its cwd, appends one line to the turn's MCP call log (read from the home's MCP config), prints a stream-json
 * run ending in a `result` event, and then HANGS, as agy 1.4.2 does. The turn must end on the result line
 * (`stopOnLine`), not at the hard kill. NO agy process, NO model call, NO network, NO Neo4j.
 *
 * The template's `<local>` fields point into one scratch directory given by the caller; the task file is a made-up
 * one-step task; `printTimeoutS` is lowered to 60 s so a failure of the stop rule costs 90 s, not 20 min. The S4 guard
 * passes only through the synthetic S4 dry-run record with `allowSynthetic` (a live grid refuses it). The summary
 * replaces every path by a placeholder and lists environment variable names only.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../src/shared/process/node-process-runner.js';
import { AGY_GEN_MCP_CONFIG_REL, installBaselineAgyHooks } from '../../lib/generators/agy-gen-cli.js';
import { agyGenConfigFromPlan, checkAgyGenLiveVersion, checkS4Result } from '../../lib/generators/agy-gen-plan.js';
import { typecheckCommand } from '../../lib/generators/argv.js';
import { GeminiStepAgent } from '../../lib/loop/agents.js';
import { readStepRecords, runDirFor } from '../../lib/loop/loop.js';
import { prepareDryRunWorkDir, runLoopGrid } from '../../lib/loop/main.js';
import { loopRunId, validatePlan, validateTasks } from '../../lib/loop/plan.js';
import { demoStubScript, stubEvaluator, stubTypechecker } from '../../lib/loop/stub.js';
import type { LoopTask, StepAgent } from '../../lib/loop/types.js';
import { placeholders } from '../../v1.3/lib/gemini-adapter-dry-run.js';

export const GEMINI_PLAN_TEMPLATE = 'experiments/loop-gemini/gemini-plan.template.json';
export const SYNTHETIC_S4_DRY_RUN = 'results/v1.4-gemini-s4-dry-run/s4-result.synthetic.json';
export const TURN_DRY_RUN_PRINT_TIMEOUT_S = 60;

const NOTES_TASK: LoopTask = {
  id: 'notes',
  title: 'Notes (demo)',
  steps: [{ id: 'notes', request: 'Create a notes service: add, list and delete short text notes, kept in memory.' }],
};

/**
 * The fake agy (CommonJS, run by node through `#!/usr/bin/env node`). The turn script (`turn.json` beside it) names the
 * files to write, the model id and the type-check command; the run never exits after its result line.
 */
export const FAKE_AGY_SOURCE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const script = JSON.parse(fs.readFileSync(path.join(__dirname, 'turn.json'), 'utf8'));
if (process.argv[2] === '--version') { process.stdout.write('agy ' + script.version + '\\n'); process.exit(0); }
let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  const ev = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
  ev({ event: 'init', conversation_id: 'fake-agy', init: { model: script.model, tools: ['write_to_file', 'run_command', 'call_mcp_tool', 'finish'], permission_mode: 'strict' } });
  let i = 1;
  const mcpFile = path.join(process.env.HOME || '', '.gemini/config/mcp_config.json');
  if (fs.existsSync(mcpFile)) {
    const cfg = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
    const server = cfg.mcpServers && cfg.mcpServers['daedalus-arch'];
    const args = (server && server.args) || [];
    const at = args.indexOf('--call-log');
    if (at >= 0) {
      fs.mkdirSync(path.dirname(args[at + 1]), { recursive: true });
      fs.appendFileSync(args[at + 1], JSON.stringify({ schema: 'mcp-call/v1', ts: '2026-10-19T00:00:00.000Z', seq: 1, tool: 'which_layer', argsSha256: '0', filesTouched: [], blockingCount: null, verdict: null, durationMs: 1, error: null, treeChangedSinceStart: false }) + '\\n');
    }
    ev({ event: 'step_update', step_update: { step_index: i++, state: 'DONE', step_type: 'tool', tool_name: 'call_mcp_tool', tool_info: { name: 'call_mcp_tool', parameters: { ServerName: 'daedalus-arch', ToolName: 'which_layer' } } } });
  }
  for (const [rel, text] of Object.entries(script.files)) {
    const abs = path.join(process.cwd(), ...rel.split('/'));
    if (text === null) fs.rmSync(abs, { force: true });
    else { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, text); }
    ev({ event: 'step_update', step_update: { step_index: i++, state: 'DONE', step_type: 'tool', tool_name: 'write_to_file', tool_info: { name: 'write_to_file', parameters: { TargetFile: rel } } } });
  }
  ev({ event: 'step_update', step_update: { step_index: i++, state: 'DONE', step_type: 'tool', tool_name: 'run_command', tool_info: { name: 'run_command', parameters: { CommandLine: script.typecheck } } } });
  ev({ event: 'result', result: { status: 'SUCCESS', response: 'done (' + String(input.length) + ' prompt chars)', duration_seconds: 1, usage: { input_tokens: 100, output_tokens: 50, cache_read_tokens: 0 } } });
  setInterval(() => undefined, 1 << 30);
});
`;

/** Records every process result (the turn record keeps no `stoppedOnOutput`). */
class RecordingRunner implements ProcessRunner {
  readonly results: { readonly args: readonly string[]; readonly result: ProcessResult | null }[] = [];
  private readonly inner = new NodeProcessRunner();

  async run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    const r = await this.inner.run(command, args, options);
    this.results.push({ args: [...args], result: r.success ? r.data : null });
    return r;
  }
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

/** Runs the one-turn dry run in `scratch` (created by the caller, outside the repository); returns the scrubbed summary. */
export async function runGeminiTurnDryRun(repoRoot: string, scratch: string): Promise<DomainResult<Record<string, unknown>>> {
  const H = path.join(scratch, 'h');
  const outRoot = path.join(scratch, 'out');
  const bin = path.join(scratch, 'bin');
  const binary = path.join(bin, 'agy');
  const homes = { none: path.join(scratch, 'homes', 'none'), 'daedalus-mcp': path.join(scratch, 'homes', 'mcp') };
  const server = { nodeBinary: path.join(scratch, 'server', 'node'), serverEntry: path.join(scratch, 'server', 'main.js'), specPath: path.join(scratch, 'server', 'spec.yaml') };
  for (const d of [H, bin, ...Object.values(homes)]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  for (const d of Object.values(homes)) fs.chmodSync(d, 0o700);
  // U12: the hook files `gemini-homes.ts --create` installs (the pre-turn probe requires them).
  const hooked = installBaselineAgyHooks(homes, repoRoot, true);
  if (!hooked.success) return DomainResult.fail(hooked.errors);
  fs.writeFileSync(binary, FAKE_AGY_SOURCE, { mode: 0o755 });

  const tasksRaw = { description: 'DEMO ONLY: one made-up one-step task for the U11 Gemini turn dry run. Not a study task.', tasks: [NOTES_TASK] };
  const tasks = validateTasks(tasksRaw);
  if (!tasks.success) return DomainResult.fail(tasks.errors);
  const tasksPath = path.join(scratch, 'tasks.json');
  fs.writeFileSync(tasksPath, `${JSON.stringify(tasksRaw, null, 2)}\n`);

  const template = readJson(path.join(repoRoot, GEMINI_PLAN_TEMPLATE)) as Record<string, unknown> & { gemini: Record<string, unknown>; adapters: { modelId: string; cliVersion: string }[] };
  const raw = {
    ...template,
    description: 'DRY RUN ONLY: the Gemini plan template, one stub turn, fake agy. Not a study plan.',
    tasksFile: tasksPath,
    arms: ['daedalus-mcp'],
    outRoot,
    binary,
    harnessRoot: H,
    daedalus: server,
    gemini: { ...template.gemini, printTimeoutS: TURN_DRY_RUN_PRINT_TIMEOUT_S, homes, s4Result: SYNTHETIC_S4_DRY_RUN },
  };
  const plan = validatePlan(raw);
  if (!plan.success) return DomainResult.fail(plan.errors);
  const adapter = plan.data.adapters[0];
  if (adapter === undefined) return DomainResult.fail([{ code: 'LOOP_PLAN_INVALID', message: 'the template lists no adapter' }]);
  const modelId = adapter.modelId;
  const cliVersion = plan.data.gemini?.cliVersion ?? '';
  const version = checkAgyGenLiveVersion(cliVersion);
  const refused = checkS4Result(repoRoot, plan.data.gemini, modelId, plan.data.arms);
  const s4 = checkS4Result(repoRoot, plan.data.gemini, modelId, plan.data.arms, { allowSynthetic: true });
  if (!s4.success) return DomainResult.fail(s4.errors);
  const config = agyGenConfigFromPlan(plan.data, modelId, repoRoot);
  if (!config.success) return DomainResult.fail(config.errors);
  const runner = new RecordingRunner();
  const parentEnv = { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: path.join(scratch, 'real-home'), USER: 'dry-run', GEMINI_API_KEY: 'dry-run-not-a-key' };
  const agent = new GeminiStepAgent(config.data, { runner, parentEnv, daedalus: server, sleep: () => Promise.resolve(), knownSecrets: ['dry-run-not-a-key'] });
  fs.writeFileSync(path.join(bin, 'turn.json'), `${JSON.stringify({ version: cliVersion, model: modelId, typecheck: '', files: {} })}\n`);
  const probed = await agent.probe(['daedalus-mcp']);
  if (!probed.success) return DomainResult.fail(probed.errors);
  const byId = new Map(tasks.data.tasks.map((t) => [t.id, t]));
  const wrapped: StepAgent = {
    adapterId: agent.adapterId,
    modelId: agent.modelId,
    runTurn: (input) => {
      const task = byId.get(input.taskId);
      if (task === undefined) return Promise.resolve(DomainResult.fail([{ code: 'LOOP_STUB_TASK', message: `no task ${input.taskId}` }]));
      const script = { version: cliVersion, model: modelId, typecheck: typecheckCommand(H, input.runId), files: demoStubScript(input, task) };
      fs.writeFileSync(path.join(bin, 'turn.json'), `${JSON.stringify(script)}\n`);
      return agent.runTurn(input);
    },
  };
  let t = Date.parse('2026-10-19T00:00:00Z');
  const grid = await runLoopGrid(
    { plan: plan.data, tasks: tasks.data, tasksPath },
    {
      agents: new Map([[`agy-cli/${modelId}`, wrapped]]),
      evaluator: stubEvaluator(),
      typechecker: stubTypechecker(),
      prepareWorkDir: prepareDryRunWorkDir,
      skeletonIntact: () => true,
    },
    { dryRun: true, now: () => new Date((t += 1000)), planSha256: 'dry-run', tasksSha256: 'dry-run', callLog: true },
  );
  if (!grid.success) return DomainResult.fail(grid.errors);
  const run = grid.data[0];
  const spec = run?.kind === 'completed' ? run.steps[0]?.spec : undefined;
  const runId = spec !== undefined ? loopRunId(spec) : '';
  const dir = runDirFor(outRoot, runId);
  const steps = readStepRecords(dir, 1);
  const turn = steps[0]?.turns[0];
  const modelCall = runner.results.find((r) => r.args[0] !== '--version');
  const envFile = path.join(dir, 'turns', 'step-01', `env-${turn?.turnId ?? ''}.json`);
  const envRec = fs.existsSync(envFile) ? (readJson(envFile) as { envNames?: string[]; cliVersion?: string }) : null;
  const work = path.join(dir, 'work');
  const map: [string, string][] = [
    [homes.none, '<home-none>'],
    [homes['daedalus-mcp'], '<home-mcp>'],
    [server.specPath, '<spec>'],
    [server.serverEntry, '<server-entry>'],
    [server.nodeBinary, '<node>'],
    [work, '<cwd>'],
    [H, '<H>'],
    [outRoot, '<out-root>'],
    [scratch, '<scratch>'],
  ];
  const summary = {
    schema: 'gemini-turn-dry-run/v1',
    note: 'Fake agy binary through the real NodeProcessRunner: no agy process, no model call, not a measurement. Paths are placeholders; env values are not recorded.',
    template: GEMINI_PLAN_TEMPLATE,
    adapterId: 'agy-cli',
    modelId,
    cliVersion,
    versionCheck: version.success ? { accepted: true, exploratory: version.data.exploratory } : { accepted: false, code: version.errors[0]?.code ?? null },
    s4: { usedRecord: SYNTHETIC_S4_DRY_RUN, withoutAllowSynthetic: refused.success ? 'accepted' : (refused.errors[0]?.code ?? null), withAllowSynthetic: 'accepted' },
    probe: { cliVersion: probed.data.cliVersion },
    versionCalls: runner.results.filter((r) => r.args[0] === '--version').length,
    modelCall:
      modelCall?.result === null || modelCall === undefined
        ? null
        : {
            stoppedOnResult: modelCall.result.stoppedOnOutput === true,
            timedOut: modelCall.result.timedOut,
            exitCode: modelCall.result.exitCode,
            endedWithin30s: modelCall.result.durationMs < 30_000,
            hardKillSeconds: TURN_DRY_RUN_PRINT_TIMEOUT_S + 30,
          },
    turn:
      turn === undefined
        ? null
        : {
            turnId: turn.turnId,
            status: turn.result.status,
            attempts: turn.result.attempts.map((a) => a.outcome),
            argv: turn.result.argv,
            usage: { inputTokens: turn.result.usage.inputTokens, outputTokens: turn.result.usage.outputTokens, costUsd: turn.result.usage.costUsd },
            envNames: envRec?.envNames ?? null,
            blocking: turn.snapshot.evaluation?.blockingViolationCount ?? null,
          },
    process: steps[0]?.process === undefined ? null : { logFound: steps[0].process.logFound, calls: steps[0].process.calls },
    filesWritten: fs.existsSync(work) ? fs.readdirSync(work, { recursive: true }).map(String).filter((f) => f.endsWith('.ts')).sort() : [],
    mcpConfig: readJson(path.join(homes['daedalus-mcp'], AGY_GEN_MCP_CONFIG_REL)),
  };
  return DomainResult.ok(placeholders(summary, map) as Record<string, unknown>);
}
