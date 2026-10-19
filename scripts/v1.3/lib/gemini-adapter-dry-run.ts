/**
 * The recorded dry run of the Gemini generator adapter (decision CDX; design §3.6; plan Step 23). It runs the real
 * `runLoopGrid` with a wiring whose agent is the real `GeminiStepAgent`, under the plan's `gemini` block. Only the
 * `ProcessRunner` is scripted: it answers `agy --version`, writes the stub generator's files into the cwd
 * (`demoStubScript`, the Clean stub layout: the loop harness has no Layered style, design R14) and prints a canned
 * stream-json run. Snapshots, the stub type-check and the stub evaluator run unchanged.
 *
 * 2 demo tasks × {none, daedalus-mcp} × 1 run × k = 3, with `--call-log` on. The S4 guard is passed only through the
 * synthetic fixture with `allowSynthetic` (a live wiring refuses it). Everything sits in one scratch directory given by
 * the caller; the summary replaces every path by a placeholder and lists environment variable NAMES only.
 * NO model call, NO network call, NO Neo4j.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import { AGY_GEN_MCP_CONFIG_REL, AGY_GEN_SETTINGS_REL } from '../../lib/generators/agy-gen-cli.js';
import { agyGenConfigFromPlan, checkS4Result } from '../../lib/generators/agy-gen-plan.js';
import { typecheckCommand } from '../../lib/generators/argv.js';
import { GeminiStepAgent } from '../../lib/loop/agents.js';
import { readStepRecords, runDirFor } from '../../lib/loop/loop.js';
import { prepareDryRunWorkDir, runLoopGrid } from '../../lib/loop/main.js';
import { loopRunId, validatePlan, validateTasks } from '../../lib/loop/plan.js';
import { demoStubScript, stubEvaluator, stubTypechecker } from '../../lib/loop/stub.js';
import type { LoopTask, StepAgent, TurnInput } from '../../lib/loop/types.js';

export const DRY_RUN_MODEL = 'dry-run-gemini-model';
export const DRY_RUN_CLI_VERSION = '0.0.0';
export const SYNTHETIC_S4 = 'tests/fixtures/agy-gen-cli/s4-result.synthetic.json';

const NOTES_TASK: LoopTask = {
  id: 'notes',
  title: 'Notes (demo)',
  steps: [
    { id: 'notes', request: 'Create a notes service: add, list and delete short text notes, kept in memory.' },
    { id: 'labels', request: 'Let users attach labels to notes and list the notes with a given label.' },
    { id: 'pins', request: 'Let users pin notes and list the pinned notes first.' },
  ],
};

function ev(o: unknown): string {
  return JSON.stringify(o);
}

/** The scripted agy process: `--version`, then one canned stream per turn (the stub generator's files written). */
export class ScriptedAgyRunner implements ProcessRunner {
  current: { readonly input: TurnInput; readonly task: LoopTask } | null = null;
  readonly calls: { readonly args: readonly string[]; readonly cwd?: string; readonly envNames: readonly string[]; readonly stdinLength: number }[] = [];

  constructor(
    private readonly harnessRoot: string,
    private readonly mcpHome: string,
  ) {}

  run(_command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ args: [...args], ...(options.cwd !== undefined ? { cwd: options.cwd } : {}), envNames: Object.keys(options.env).sort(), stdinLength: options.stdin?.length ?? 0 });
    const ok = (stdout: string): Promise<DomainResult<ProcessResult>> => Promise.resolve(DomainResult.ok({ exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 1 }));
    if (args[0] === '--version') return ok(`agy ${DRY_RUN_CLI_VERSION}\n`);
    const cur = this.current;
    const cwd = options.cwd;
    if (cur === null || cwd === undefined) return Promise.resolve(DomainResult.fail([{ code: 'PROCESS_SPAWN_FAILED', message: 'no scripted turn' }]));
    const files = demoStubScript(cur.input, cur.task);
    const lines = [
      ev({ event: 'init', conversation_id: 'dry-run', init: { model: DRY_RUN_MODEL, tools: ['write_to_file', 'run_command', 'call_mcp_tool', 'finish'], permission_mode: 'strict' } }),
      ev({ event: 'step_update', step_update: { step_index: 0, state: 'DONE', step_type: 'user_input' } }),
    ];
    let i = 1;
    if (options.env.HOME === this.mcpHome) {
      lines.push(ev({ event: 'step_update', step_update: { step_index: i++, state: 'DONE', step_type: 'tool', tool_name: 'call_mcp_tool', tool_info: { name: 'call_mcp_tool', parameters: { ServerName: 'daedalus-arch', ToolName: 'which_layer' } } } }));
    }
    for (const [rel, text] of Object.entries(files).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const abs = path.join(cwd, ...rel.split('/'));
      if (text === null) fs.rmSync(abs, { force: true });
      else {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, text);
      }
      lines.push(ev({ event: 'step_update', step_update: { step_index: i++, state: 'DONE', step_type: 'tool', tool_name: 'write_to_file', tool_info: { name: 'write_to_file', parameters: { TargetFile: '<cwd-file>' } } } }));
    }
    lines.push(ev({ event: 'step_update', step_update: { step_index: i++, state: 'DONE', step_type: 'tool', tool_name: 'run_command', tool_info: { name: 'run_command', parameters: { CommandLine: typecheckCommand(this.harnessRoot, cur.input.runId) } } } }));
    lines.push(ev({ event: 'step_update', step_update: { step_index: i++, state: 'DONE', step_type: 'finish' } }));
    lines.push(ev({ event: 'result', result: { status: 'SUCCESS', response: 'done', duration_seconds: 1, usage: { input_tokens: 100, output_tokens: 50, cache_read_tokens: 0 } } }));
    return ok(`${lines.join('\n')}\n`);
  }
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

/** Every absolute path of the scratch directory replaced by a named placeholder (EV-10 style). */
export function placeholders(value: unknown, map: readonly (readonly [string, string])[]): unknown {
  const sorted = [...map].sort((a, b) => b[0].length - a[0].length);
  const fix = (s: string): string => {
    let out = s;
    for (const [from, to] of sorted) out = out.split(from).join(to);
    return out.replace(/(?:\/private)?\/(?:tmp|var|Users|Volumes|home)\/[^\s"',)]*/g, '<abs>');
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value);
}

/** Runs the dry run in `scratch` (created by the caller, outside the repository); returns the scrubbed summary. */
export async function runGeminiAdapterDryRun(repoRoot: string, scratch: string): Promise<DomainResult<Record<string, unknown>>> {
  const H = path.join(scratch, 'h');
  const outRoot = path.join(scratch, 'out');
  const homes = { none: path.join(scratch, 'homes', 'none'), 'daedalus-mcp': path.join(scratch, 'homes', 'mcp') };
  const server = { nodeBinary: path.join(scratch, 'server', 'node'), serverEntry: path.join(scratch, 'server', 'main.js'), specPath: path.join(scratch, 'server', 'spec.yaml') };
  for (const d of [H, ...Object.values(homes)]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  for (const d of Object.values(homes)) fs.chmodSync(d, 0o700);
  const demo = readJson(path.join(repoRoot, 'experiments/loop-demo/demo-tasks.json')) as { tasks: LoopTask[] };
  const tasksRaw = { description: 'DEMO ONLY: two made-up loop tasks for the Gemini adapter dry run. Not study tasks.', tasks: [...demo.tasks.slice(0, 1), NOTES_TASK] };
  const tasks = validateTasks(tasksRaw);
  if (!tasks.success) return DomainResult.fail(tasks.errors);
  const tasksPath = path.join(scratch, 'tasks.json');
  fs.writeFileSync(tasksPath, `${JSON.stringify(tasksRaw, null, 2)}\n`);
  const raw = {
    description: 'DRY RUN ONLY: the Gemini generator adapter (agy-cli) with a scripted runner. Not a study plan.',
    tasksFile: tasksPath,
    adapters: [{ adapterId: 'agy-cli', modelId: DRY_RUN_MODEL, cliVersion: DRY_RUN_CLI_VERSION }],
    arms: ['none', 'daedalus-mcp'],
    runs: 1,
    orderSeed: 20261018,
    outRoot,
    binary: path.join(scratch, 'bin', 'agy'),
    harnessRoot: H,
    allowBash: true,
    daedalus: server,
    evaluatorSpec: 'specs/clean-arch.yaml',
    gemini: { enabled: true, cliVersion: DRY_RUN_CLI_VERSION, printTimeoutS: 1170, allowCommand: true, homes, s4Result: SYNTHETIC_S4 },
  };
  const plan = validatePlan(raw);
  if (!plan.success) return DomainResult.fail(plan.errors);
  const refused = checkS4Result(repoRoot, plan.data.gemini, DRY_RUN_MODEL, plan.data.arms);
  const s4 = checkS4Result(repoRoot, plan.data.gemini, DRY_RUN_MODEL, plan.data.arms, { allowSynthetic: true });
  if (!s4.success) return DomainResult.fail(s4.errors);
  const config = agyGenConfigFromPlan(plan.data, DRY_RUN_MODEL, repoRoot);
  if (!config.success) return DomainResult.fail(config.errors);
  const runner = new ScriptedAgyRunner(H, homes['daedalus-mcp']);
  const parentEnv = { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: path.join(scratch, 'real-home'), USER: 'dry-run', GEMINI_API_KEY: 'dry-run-not-a-key', FOO_TOKEN: 'dry-run-not-a-token' };
  const agent = new GeminiStepAgent(config.data, { runner, parentEnv, daedalus: server, sleep: () => Promise.resolve(), knownSecrets: ['dry-run-not-a-key', 'dry-run-not-a-token'] });
  const probed = await agent.probe();
  if (!probed.success) return DomainResult.fail(probed.errors);
  const byId = new Map(tasks.data.tasks.map((t) => [t.id, t]));
  const wrapped: StepAgent = {
    adapterId: agent.adapterId,
    modelId: agent.modelId,
    runTurn: (input) => {
      const task = byId.get(input.taskId);
      if (task === undefined) return Promise.resolve(DomainResult.fail([{ code: 'LOOP_STUB_TASK', message: `no task ${input.taskId}` }]));
      runner.current = { input, task };
      return agent.runTurn(input);
    },
  };
  let t = Date.parse('2026-10-18T00:00:00Z');
  const grid = await runLoopGrid(
    { plan: plan.data, tasks: tasks.data, tasksPath },
    {
      agents: new Map([[`agy-cli/${DRY_RUN_MODEL}`, wrapped]]),
      evaluator: stubEvaluator(),
      typechecker: stubTypechecker(),
      prepareWorkDir: prepareDryRunWorkDir,
      skeletonIntact: () => true,
    },
    { dryRun: true, now: () => new Date((t += 1000)), planSha256: 'dry-run', tasksSha256: 'dry-run', callLog: true },
  );
  if (!grid.success) return DomainResult.fail(grid.errors);

  const runs = grid.data.map((r) => {
    const spec = r.kind === 'completed' ? r.steps[0]?.spec : undefined;
    const runId = spec !== undefined ? loopRunId(spec) : '';
    const dir = runDirFor(outRoot, runId);
    const steps = readStepRecords(dir, 3);
    return {
      runId,
      arm: spec?.arm ?? null,
      steps: steps.map((s) => ({
        step: s.stepIndex + 1,
        turns: s.turns.map((x) => {
          const envFile = path.join(dir, 'turns', `step-${String(s.stepIndex + 1).padStart(2, '0')}`, `env-${x.turnId}.json`);
          const envelopeFile = path.join(dir, 'turns', `step-${String(s.stepIndex + 1).padStart(2, '0')}`, x.result.envelopePath ?? '');
          const envRec = fs.existsSync(envFile) ? (readJson(envFile) as { envNames?: string[] }) : null;
          const envelope = fs.existsSync(envelopeFile) ? (readJson(envelopeFile) as { init?: { model?: string } }) : null;
          return { turnId: x.turnId, status: x.result.status, attempts: x.result.attempts.map((a) => a.outcome), argv: x.result.argv, envNames: envRec?.envNames ?? null, initModel: envelope?.init?.model ?? null, modelCheck: envelope?.init?.model === DRY_RUN_MODEL };
        }),
        blocking: s.turns[s.turns.length - 1]?.snapshot.evaluation?.blockingViolationCount ?? null,
        process: s.process === undefined ? null : { logFound: s.process.logFound, calls: s.process.calls },
      })),
    };
  });
  const map: [string, string][] = [
    [homes.none, '<home-none>'],
    [homes['daedalus-mcp'], '<home-mcp>'],
    [server.specPath, '<spec>'],
    [server.serverEntry, '<server-entry>'],
    [server.nodeBinary, '<node>'],
    [H, '<H>'],
    [outRoot, '<out-root>'],
    [scratch, '<scratch>'],
  ];
  for (const r of runs) map.push([path.join(runDirFor(outRoot, r.runId), 'work'), '<cwd>']);
  const settings = (home: string): unknown => readJson(path.join(home, AGY_GEN_SETTINGS_REL));
  const summary = {
    schema: 'gemini-adapter-dry-run/v1',
    note: 'Scripted runner: no agy process, no model call, not a measurement. Paths are placeholders; env values are not recorded.',
    adapterId: 'agy-cli',
    modelId: DRY_RUN_MODEL,
    cliVersion: DRY_RUN_CLI_VERSION,
    layout: 'clean (CLEAN_STUB_LAYOUT; the loop harness has no Layered style, design R14)',
    s4: { usedFixture: SYNTHETIC_S4, withoutAllowSynthetic: refused.success ? 'accepted' : (refused.errors[0]?.code ?? null), withAllowSynthetic: 'accepted' },
    probe: { cliVersion: probed.data.cliVersion, versionCalls: runner.calls.filter((c) => c.args[0] === '--version').length },
    argvByArm: Object.fromEntries((['none', 'daedalus-mcp'] as const).map((arm) => [arm, runs.find((r) => r.arm === arm)?.steps[0]?.turns[0]?.argv ?? null])),
    promptOnStdin: runner.calls.filter((c) => c.args[0] !== '--version').every((c) => c.stdinLength > 0),
    runs,
    homes: {
      none: { settings: settings(homes.none), mcpConfig: fs.existsSync(path.join(homes.none, AGY_GEN_MCP_CONFIG_REL)) ? 'present' : 'absent' },
      'daedalus-mcp': { settings: settings(homes['daedalus-mcp']), mcpConfig: readJson(path.join(homes['daedalus-mcp'], AGY_GEN_MCP_CONFIG_REL)) },
    },
  };
  return DomainResult.ok(placeholders(summary, map) as Record<string, unknown>);
}
