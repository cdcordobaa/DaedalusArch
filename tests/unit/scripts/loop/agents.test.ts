/**
 * Arm wiring of the loop's step agents: the exact argv per arm (Claude Code and Codex), the MCP config, the gate arm
 * using the `none` argv, and one turn driven through the E1 retry policy with a usage-limit pause (fake CLI; no model).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { ARM_TOOL_SENTENCES, armPrompt } from '../../../../scripts/lib/generators/arms.js';
import type { DaedalusServerInput } from '../../../../scripts/lib/generators/arms.js';
import { buildCodexArgs, codexReadDenies, createCodexCliConfig } from '../../../../scripts/lib/generators/codex-cli.js';
import type { CodexCliConfig } from '../../../../scripts/lib/generators/codex-cli.js';
import { parseEnvelope } from '../../../../scripts/lib/generators/envelope.js';
import { DEFAULT_RETRY_POLICY } from '../../../../scripts/lib/generators/retry.js';
import { ClaudeStepAgent, CodexStepAgent, PROMPT_PLACEHOLDER, generatorArmFor, turnStatus, turnUsage, withCodexMcpServer } from '../../../../scripts/lib/loop/agents.js';
import type { TurnInput } from '../../../../scripts/lib/loop/types.js';
import { FakeGeneratorRunner, MODEL, REPO, envelope, makeHarness } from '../generators/fake-generator-runner.js';
import type { Harness } from '../generators/fake-generator-runner.js';

const PROMPT = 'Step 1 of the demo todo list.';
const DAEDALUS: DaedalusServerInput = {
  nodeBinary: '/usr/bin/node',
  serverEntry: '/opt/daedalus/dist/mcp-server/main.js',
  specPath: '/opt/daedalus/specs/clean-arch.yaml',
};
const SPEC_TOOLS = ['get_architecture_spec', 'which_layer', 'check_import', 'explain_violation', 'check_file', 'check_diff', 'suggest_placement', 'infer_spec', 'explain_finding'];

let h: Harness;
let runId: string;
let cwd: string;

beforeEach(() => {
  h = makeHarness();
  runId = `claude-code-cli/${MODEL}/todo-list/daedalus-mcp/run-0`;
  cwd = path.join(h.outRoot, 'runs', ...runId.split('/'), 'work');
  fs.mkdirSync(cwd, { recursive: true });
});
afterEach(() => {
  h.cleanup();
});

function e1Argv(H: string, id: string, prompt: string): string[] {
  return [
    '-p',
    prompt,
    '--model',
    MODEL,
    '--output-format',
    'json',
    '--safe-mode',
    '--restricted',
    '--tools',
    'Read,Write,Edit,Glob,Grep,Bash',
    '--allowedTools',
    `Bash(${H}/bin/tsc --noEmit --incremental false -p ${H}/runs/${id}/tsconfig.json)`,
    '--disallowedTools',
    'Write(node_modules/**)',
    'Edit(node_modules/**)',
    '--permission-mode',
    'acceptEdits',
    '--permission-prompts',
    'none',
    '--no-session-persistence',
    '--strict-mcp-config',
  ];
}

describe('Claude Code step agent: argv per arm', () => {
  it('none: the E1 argv byte for byte, prompt unchanged, no MCP config', () => {
    const agent = new ClaudeStepAgent(h.config, { runner: new FakeGeneratorRunner(h.binary), daedalus: DAEDALUS });
    const p = agent.plan({ runId, cwd, prompt: PROMPT, arm: 'none' });
    if (!p.success) throw new Error('plan failed');
    expect([...p.data.args]).toEqual(e1Argv(h.harnessRoot, runId, PROMPT));
    expect(p.data.mcpConfigPath).toBeNull();
  });

  it('gate: every turn uses the none argv (the feedback is the repair prompt, not a tool)', () => {
    const agent = new ClaudeStepAgent(h.config, { runner: new FakeGeneratorRunner(h.binary) });
    expect(generatorArmFor('gate')).toBe('none');
    const p = agent.plan({ runId, cwd, prompt: PROMPT, arm: 'gate' });
    if (!p.success) throw new Error('plan failed');
    expect([...p.data.args]).toEqual(e1Argv(h.harnessRoot, runId, PROMPT));
    expect(p.data.prompt).toBe(PROMPT);
  });

  it('daedalus-mcp: exact argv with the strict MCP config, the nine spec-only (MCP v2) tools and evaluate_project denied', () => {
    const agent = new ClaudeStepAgent(h.config, { runner: new FakeGeneratorRunner(h.binary), daedalus: DAEDALUS });
    const p = agent.plan({ runId, cwd, prompt: PROMPT, arm: 'daedalus-mcp' });
    if (!p.success) throw new Error('plan failed');
    const H = h.harnessRoot;
    const prompt = `${PROMPT}\n\n${ARM_TOOL_SENTENCES['daedalus-mcp']}\n`;
    expect(p.data.prompt).toBe(prompt);
    expect([...p.data.args]).toEqual([
      '-p',
      prompt,
      '--model',
      MODEL,
      '--output-format',
      'json',
      '--safe-mode',
      '--restricted',
      '--tools',
      'Read,Write,Edit,Glob,Grep,Bash',
      '--allowedTools',
      `Bash(${H}/bin/tsc --noEmit --incremental false -p ${H}/runs/${runId}/tsconfig.json)`,
      ...SPEC_TOOLS.map((t) => `mcp__daedalus-arch__${t}`),
      '--disallowedTools',
      'Write(node_modules/**)',
      'Edit(node_modules/**)',
      'mcp__daedalus-arch__evaluate_project',
      '--permission-mode',
      'acceptEdits',
      '--permission-prompts',
      'none',
      '--no-session-persistence',
      '--strict-mcp-config',
      '--mcp-config',
      `${H}/runs/${runId}/mcp-daedalus-mcp.json`,
    ]);
    expect(p.data.mcpConfig).toEqual({
      mcpServers: {
        'daedalus-arch': { type: 'stdio', command: '/usr/bin/node', args: [DAEDALUS.serverEntry, '--spec', DAEDALUS.specPath, '--project', cwd, '--engine', 'neo4j', '--confine'], env: {} },
      },
    });
  });

  it('daedalus-mcp without a server, or with a server path inside the cwd, is refused', () => {
    const none = new ClaudeStepAgent(h.config, { runner: new FakeGeneratorRunner(h.binary) }).plan({ runId, cwd, prompt: PROMPT, arm: 'daedalus-mcp' });
    expect(none.success ? [] : none.errors.map((e) => e.code)).toEqual(['ARM_NOT_CONFIGURED']);
    const inside = new ClaudeStepAgent(h.config, { runner: new FakeGeneratorRunner(h.binary), daedalus: { ...DAEDALUS, specPath: path.join(cwd, 'spec.yaml') } }).plan({
      runId,
      cwd,
      prompt: PROMPT,
      arm: 'daedalus-mcp',
    });
    expect(inside.success ? [] : inside.errors.map((e) => e.code)).toEqual(['ARM_PATH_INSIDE_CWD']);
  });
});

describe('Claude Code step agent: one turn', () => {
  function input(over: Partial<TurnInput> = {}): TurnInput & { archived: number[]; restored: number } {
    const t: TurnInput & { archived: number[]; restored: number } = {
      archived: [],
      restored: 0,
      runId,
      turnId: 'step-02',
      taskId: 'todo-list',
      kind: 'step',
      stepIndex: 1,
      arm: 'daedalus-mcp',
      cwd,
      prompt: PROMPT,
      recordDir: path.join(h.outRoot, 'records'),
      changedFiles: () => 1,
      restore: () => {
        t.restored++;
        return DomainResult.ok(undefined);
      },
      archive: (i) => {
        t.archived.push(i);
        return DomainResult.ok(`interruptions/${runId}/step-02/${String(i)}`);
      },
      ...over,
    };
    return t;
  }

  it('a usage limit pauses until the reported reset, archives and restores, then resumes the same turn', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [
      { stdout: envelope({ isError: true, result: "You've hit your limit · resets 3pm|1767225600" }), exitCode: 1 },
      { files: { 'src/domain/todo.ts': 'export interface Todo { readonly id: string }\n' }, stdout: envelope() },
    ]);
    const sleeps: number[] = [];
    let now = 1_767_220_000_000;
    const agent = new ClaudeStepAgent(h.config, {
      runner,
      daedalus: DAEDALUS,
      clock: { now: () => (now += 1000) },
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    const t = input();
    const r = await agent.runTurn(t);
    if (!r.success) throw new Error(r.errors.map((e) => e.code).join(','));
    expect(runner.cliCalls).toHaveLength(2);
    expect(r.data.status).toBe('completed');
    expect(r.data.interruptions).toHaveLength(1);
    expect(r.data.interruptions[0]?.movedTo).toBe(`interruptions/${runId}/step-02/0`);
    expect(r.data.attempts.map((a) => a.outcome)).toEqual(['completed']);
    expect(t.archived).toEqual([0]);
    expect(t.restored).toBe(1);
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBeGreaterThanOrEqual(DEFAULT_RETRY_POLICY.usageResumeMarginMs);
    // The recorded argv hides the prompt; the MCP config and the pinned tsconfig were written.
    expect(r.data.argv[1]).toBe(PROMPT_PLACEHOLDER);
    expect(r.data.argv).toContain('--mcp-config');
    expect(fs.existsSync(path.join(h.harnessRoot, 'runs', ...runId.split('/'), 'mcp-daedalus-mcp.json'))).toBe(true);
    expect(fs.existsSync(path.join(h.harnessRoot, 'runs', ...runId.split('/'), 'tsconfig.json'))).toBe(true);
    expect(r.data.usage).toMatchObject({ costUsd: 0.5, outputTokens: 5000, numTurns: 12, durationMs: 1000 });
    expect(fs.existsSync(path.join(h.outRoot, 'records', 'envelope-step-02.json'))).toBe(true);
    // The child runs in the work dir with the allow-listed environment.
    expect(runner.cliCalls[1]?.options.cwd).toBe(cwd);
    expect(Object.keys(runner.cliCalls[1]?.options.env ?? {}).some((k) => k.startsWith('NEO4J'))).toBe(false);
  });

  it('an infrastructure failure is retried from the last snapshot, at most twice', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [{ spawnFails: true }, { spawnFails: true }, { spawnFails: true }]);
    const agent = new ClaudeStepAgent(h.config, { runner, sleep: () => Promise.resolve() });
    const t = input({ arm: 'none', changedFiles: () => 0 });
    const r = await agent.runTurn(t);
    if (!r.success) throw new Error('turn failed');
    expect(r.data.status).toBe('infrastructure');
    expect(r.data.attempts.map((a) => a.outcome)).toEqual(['spawn-failed', 'spawn-failed', 'spawn-failed']);
    expect(t.restored).toBe(2);
    expect(r.data.envelopePath).toBe('envelope-step-02.json');
  });
});

describe('turn usage and status', () => {
  it('reads the Claude usage block, else sums modelUsage output tokens', () => {
    const withUsage = parseEnvelope(
      JSON.stringify({ is_error: false, total_cost_usd: 1.25, num_turns: 3, duration_ms: 9, usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 30, cache_creation_input_tokens: 40 }, modelUsage: { [MODEL]: { outputTokens: 20 } } }),
      [],
    );
    if (!withUsage.success) throw new Error('parse');
    expect(turnUsage(withUsage.data)).toEqual({ costUsd: 1.25, inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheCreationTokens: 40, numTurns: 3, durationMs: 9 });
    expect(turnUsage(null).costUsd).toBeNull();
    const ok = parseEnvelope(envelope(), []);
    const helper = parseEnvelope(envelope({ pinned: null, helperTokens: 10 }), []);
    if (!ok.success || !helper.success) throw new Error('parse');
    const cli = { exitCode: 0, stdout: '', stderr: '', timedOut: false, durationMs: 1 };
    expect(turnStatus(null, false, null, MODEL)).toBe('infrastructure');
    expect(turnStatus({ ...cli, timedOut: true }, false, ok.data, MODEL)).toBe('timeout');
    expect(turnStatus(cli, false, null, MODEL)).toBe('envelope-unreadable');
    expect(turnStatus(cli, false, helper.data, MODEL)).toBe('model-mismatch');
    expect(turnStatus(cli, false, ok.data, MODEL)).toBe('completed');
  });
});

describe('Codex step agent: argument set per arm', () => {
  let codex: CodexCliConfig;
  beforeEach(() => {
    const homes = ['codex-home', 'codex-userhome', 'home'].map((d) => path.join(h.tmp, d));
    for (const d of homes) fs.mkdirSync(d, { recursive: true });
    const c = createCodexCliConfig(
      {
        base: h.config,
        codexHome: homes[0] ?? '',
        userHome: homes[1] ?? '',
        realHome: homes[2] ?? '',
        reasoningEffort: 'medium',
        cliVersion: '0.162.1',
        modelCatalog: path.join(REPO, 'scripts', 'generator', 'codex', 'model-catalog.json'),
      },
      REPO,
    );
    if (!c.success) throw new Error(c.errors.map((e) => e.code).join(','));
    codex = c.data;
  });

  function base(): readonly string[] {
    return buildCodexArgs(codex, cwd, codexReadDenies(codex, cwd, path.dirname(REPO)));
  }

  it('none and gate: the E1 Codex argument set unchanged, prompt on stdin unchanged', () => {
    const agent = new CodexStepAgent(codex, { runner: new FakeGeneratorRunner(h.binary), repoRoot: REPO, daedalus: DAEDALUS });
    for (const arm of ['none', 'gate'] as const) {
      const p = agent.plan({ runId, cwd, prompt: PROMPT, arm });
      if (!p.success) throw new Error('plan failed');
      expect([...p.data.args]).toEqual([...base()]);
      expect(p.data.prompt).toBe(PROMPT);
    }
  });

  it('daedalus-mcp: the server as -c overrides before the trailing "-", tools by exact name', () => {
    const agent = new CodexStepAgent(codex, { runner: new FakeGeneratorRunner(h.binary), repoRoot: REPO, daedalus: DAEDALUS });
    const p = agent.plan({ runId, cwd, prompt: PROMPT, arm: 'daedalus-mcp' });
    if (!p.success) throw new Error('plan failed');
    const b = base();
    expect([...p.data.args]).toEqual([
      ...b.slice(0, -1),
      '-c',
      'mcp_servers.daedalus-arch.command="/usr/bin/node"',
      '-c',
      `mcp_servers.daedalus-arch.args=["/opt/daedalus/dist/mcp-server/main.js","--spec","/opt/daedalus/specs/clean-arch.yaml","--project",${JSON.stringify(cwd)}]`,
      '-c',
      'mcp_servers.daedalus-arch.enabled_tools=["get_architecture_spec","which_layer","check_import","explain_violation","check_file","check_diff","suggest_placement","infer_spec","explain_finding"]',
      '-c',
      'mcp_servers.daedalus-arch.disabled_tools=["evaluate_project"]',
      '-',
    ]);
    expect(p.data.prompt).toBe(armPrompt(PROMPT, 'daedalus-mcp'));
    expect(withCodexMcpServer(['exec'], DAEDALUS, cwd).slice(-1)).toEqual(['mcp_servers.daedalus-arch.disabled_tools=["evaluate_project"]']);
  });

  it('daedalus-mcp without a server, or with a server path inside the cwd, is refused', () => {
    const none = new CodexStepAgent(codex, { runner: new FakeGeneratorRunner(h.binary), repoRoot: REPO }).plan({ runId, cwd, prompt: PROMPT, arm: 'daedalus-mcp' });
    expect(none.success ? [] : none.errors.map((e) => e.code)).toEqual(['ARM_NOT_CONFIGURED']);
    const inside = new CodexStepAgent(codex, { runner: new FakeGeneratorRunner(h.binary), repoRoot: REPO, daedalus: { ...DAEDALUS, serverEntry: path.join(cwd, 'x.js') } }).plan({
      runId,
      cwd,
      prompt: PROMPT,
      arm: 'daedalus-mcp',
    });
    expect(inside.success ? [] : inside.errors.map((e) => e.code)).toEqual(['ARM_PATH_INSIDE_CWD']);
  });

  it('a turn sends the prompt on stdin with the Codex child environment', async () => {
    const runner = new FakeGeneratorRunner(codex.binary, [{ stdout: '' }]);
    const agent = new CodexStepAgent(codex, { runner, repoRoot: REPO, daedalus: DAEDALUS, sleep: () => Promise.resolve() });
    const r = await agent.runTurn({
      runId,
      turnId: 'step-01',
      taskId: 'todo-list',
      kind: 'step',
      stepIndex: 0,
      arm: 'daedalus-mcp',
      cwd,
      prompt: PROMPT,
      recordDir: path.join(h.outRoot, 'records'),
      changedFiles: () => 1,
      restore: () => DomainResult.ok(undefined),
      archive: () => DomainResult.ok('x'),
    });
    if (!r.success) throw new Error(r.errors.map((e) => e.code).join(','));
    expect(runner.cliCalls[0]?.options.stdin).toBe(armPrompt(PROMPT, 'daedalus-mcp'));
    expect(runner.cliCalls[0]?.options.env.CODEX_HOME).toBe(codex.codexHome);
    expect(r.data.status).toBe('envelope-unreadable');
  });
});
