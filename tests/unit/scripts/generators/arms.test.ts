/**
 * v1.3 firewall-in-the-loop tool arms (DRAFT): argv per arm, MCP config, invariants and the dry run. No process is
 * spawned and no model is called.
 */
import * as path from 'node:path';
import { FORBIDDEN_GENERATOR_FLAGS, buildGeneratorArgs } from '../../../../scripts/lib/generators/argv.js';
import {
  ARM_TOOL_SENTENCES,
  DAEDALUS_ARM_TOOLS,
  armMcpConfigPath,
  armPrompt,
  buildArmCall,
  checkArmArgs,
  mcpToolRules,
} from '../../../../scripts/lib/generators/arms.js';
import type { ContextGraphProvider, DaedalusServerInput } from '../../../../scripts/lib/generators/arms.js';
import {
  ARM_LEVELS,
  armsDryRunMain,
  formatArgv,
  parseArmsDryRunArgs,
} from '../../../../scripts/lib/generators/arms-dry-run.js';
import { runIdFor } from '../../../../scripts/lib/generators/config.js';
import type { GenerationRequest, GeneratorCliConfig } from '../../../../scripts/lib/generators/types.js';
import { DEFAULT_GENERATOR_TIMEOUT_MS } from '../../../../scripts/lib/generators/types.js';
import { SPEC_TOOL_NAMES } from '../../../../src/mcp-server/server.js';

const REPO = process.cwd();
const MODEL = 'model-under-test-1';
const PROMPT = 'Build the task-management service.';

function config(allowBash = true): GeneratorCliConfig {
  return {
    binary: '/usr/local/bin/claude',
    modelId: MODEL,
    timeoutMs: DEFAULT_GENERATOR_TIMEOUT_MS,
    outputRoot: '/gen/out',
    harnessRoot: '/gen/h',
    allowBash,
  };
}

const REQ: GenerationRequest = {
  runId: runIdFor(MODEL, 'task-management', 'none', 0),
  promptTemplateId: 'none/task-management',
  taskId: 'task-management',
  modelId: MODEL,
  style: 'clean-architecture',
  specLevel: 'none',
  runIndex: 0,
  outputDir: '/gen/out/m/task-management/none/run-0',
  fileRange: { min: 20, max: 100 },
  orderSeed: 1,
  pilot: false,
};

const DAEDALUS: DaedalusServerInput = {
  nodeBinary: '/usr/bin/node',
  serverEntry: '/opt/daedalus/dist/mcp-server/main.js',
  specPath: '/opt/daedalus/specs/clean-arch.yaml',
};

describe('tool arms', () => {
  it('the allowed DaedalusArch tools are exactly the server\'s spec-only tools', () => {
    expect([...DAEDALUS_ARM_TOOLS]).toEqual([...SPEC_TOOL_NAMES]);
  });

  it.each([true, false])('none is the E1 argv unchanged (allowBash=%s)', (allowBash) => {
    const call = buildArmCall(config(allowBash), REQ, PROMPT, { arm: 'none', daedalus: DAEDALUS });
    expect(call.success && call.data.args).toEqual(buildGeneratorArgs(config(allowBash), REQ, PROMPT));
    expect(call.success && call.data.mcpConfig).toBeNull();
  });

  it('daedalus-mcp adds exact allow rules, denies evaluate_project and loads one strict config', () => {
    const call = buildArmCall(config(), REQ, PROMPT, { arm: 'daedalus-mcp', daedalus: DAEDALUS });
    if (!call.success) throw new Error('expected success');
    const { args } = call.data;
    const base = buildGeneratorArgs(config(), REQ, armPrompt(PROMPT, 'daedalus-mcp'));
    // Every E1 flag survives in order; only MCP values and --mcp-config are inserted.
    expect(args.filter((a) => !a.startsWith('mcp__') && a !== '--mcp-config' && !a.endsWith('.json'))).toEqual([...base]);
    const allowedAt = args.indexOf('--allowedTools');
    expect(args[allowedAt + 1]).toMatch(/^Bash\(/);
    expect(args.slice(allowedAt + 2, allowedAt + 2 + DAEDALUS_ARM_TOOLS.length)).toEqual(
      mcpToolRules('daedalus-arch', DAEDALUS_ARM_TOOLS),
    );
    const deniedAt = args.indexOf('--disallowedTools');
    expect(args.slice(deniedAt + 1, deniedAt + 4)).toEqual([
      'Write(node_modules/**)',
      'Edit(node_modules/**)',
      'mcp__daedalus-arch__evaluate_project',
    ]);
    expect(args.slice(-3)).toEqual([
      '--strict-mcp-config',
      '--mcp-config',
      armMcpConfigPath('/gen/h', REQ.runId, 'daedalus-mcp'),
    ]);
    expect(call.data.mcpConfigPath).toBe('/gen/h/runs/model-under-test-1/task-management/none/run-0/mcp-daedalus-mcp.json');
    expect(call.data.mcpConfig).toEqual({
      mcpServers: {
        'daedalus-arch': {
          type: 'stdio',
          command: '/usr/bin/node',
          args: [DAEDALUS.serverEntry, '--spec', DAEDALUS.specPath, '--project', REQ.outputDir, '--engine', 'neo4j', '--confine'],
          env: {},
        },
      },
    });
    for (const flag of FORBIDDEN_GENERATOR_FLAGS) expect(args).not.toContain(flag);
  });

  it('daedalus-mcp without Bash opens its own --allowedTools before --disallowedTools', () => {
    const call = buildArmCall(config(false), REQ, PROMPT, { arm: 'daedalus-mcp', daedalus: DAEDALUS });
    if (!call.success) throw new Error('expected success');
    const { args } = call.data;
    expect(args.filter((a) => a === '--allowedTools')).toHaveLength(1);
    expect(args.some((a) => a.startsWith('Bash('))).toBe(false);
    expect(args.indexOf('--allowedTools')).toBeLessThan(args.indexOf('--disallowedTools'));
    expect(args[args.indexOf('--allowedTools') + 1]).toBe('mcp__daedalus-arch__get_architecture_spec');
  });

  it('daedalus-mcp refuses relative paths and paths inside the run cwd', () => {
    const relative = buildArmCall(config(), REQ, PROMPT, { arm: 'daedalus-mcp', daedalus: { ...DAEDALUS, specPath: 'specs/x.yaml' } });
    expect(!relative.success && relative.errors.map((e) => e.code)).toEqual(['ARM_PATH_NOT_ABSOLUTE']);
    const inside = buildArmCall(config(), REQ, PROMPT, {
      arm: 'daedalus-mcp',
      daedalus: { ...DAEDALUS, specPath: path.posix.join(REQ.outputDir, 'spec.yaml') },
    });
    expect(!inside.success && inside.errors.map((e) => e.code)).toEqual(['ARM_PATH_INSIDE_CWD']);
    const missing = buildArmCall(config(), REQ, PROMPT, { arm: 'daedalus-mcp' });
    expect(!missing.success && missing.errors[0]?.code).toBe('ARM_NOT_CONFIGURED');
  });

  it('context-graph is a placeholder until a provider is plugged in', () => {
    const call = buildArmCall(config(), REQ, PROMPT, { arm: 'context-graph' });
    expect(!call.success && call.errors[0]?.code).toBe('ARM_NOT_CONFIGURED');
  });

  it('context-graph with a provider allows its read-only tools only', () => {
    const provider: ContextGraphProvider = {
      serverName: 'code-graph',
      tools: ['find_symbol', 'get_imports'],
      deniedTools: ['execute_shell_command'],
      server: (req) => ({ type: 'stdio', command: '/opt/graph/bin/graph', args: ['--root', req.outputDir], env: {} }),
    };
    const call = buildArmCall(config(), REQ, PROMPT, { arm: 'context-graph', contextGraph: provider });
    if (!call.success) throw new Error('expected success');
    expect(call.data.args.filter((a) => a.startsWith('mcp__'))).toEqual([
      'mcp__code-graph__find_symbol',
      'mcp__code-graph__get_imports',
      'mcp__code-graph__execute_shell_command',
    ]);
    expect(Object.keys(call.data.mcpConfig?.mcpServers ?? {})).toEqual(['code-graph']);
    const wildcard = buildArmCall(config(), REQ, PROMPT, { arm: 'context-graph', contextGraph: { ...provider, tools: ['*'] } });
    expect(!wildcard.success && wildcard.errors[0]?.code).toBe('ARM_TOOLS_INVALID');
    const clash = buildArmCall(config(), REQ, PROMPT, { arm: 'context-graph', contextGraph: { ...provider, serverName: 'daedalus-arch' } });
    expect(!clash.success && clash.errors[0]?.code).toBe('ARM_SERVER_NAME_INVALID');
  });

  it('the two tool sentences are matched in length (T3) and none adds nothing', () => {
    expect(armPrompt(PROMPT, 'none')).toBe(PROMPT);
    expect(armPrompt(`${PROMPT}\n`, 'daedalus-mcp')).toBe(`${PROMPT}\n\n${ARM_TOOL_SENTENCES['daedalus-mcp']}\n`);
    const a = ARM_TOOL_SENTENCES['context-graph'].length;
    const b = ARM_TOOL_SENTENCES['daedalus-mcp'].length;
    expect(Math.abs(a - b) / b).toBeLessThan(0.05);
  });

  it('checkArmArgs rejects forbidden flags, a missing strict flag and foreign or wildcard MCP rules', () => {
    const codes = (args: string[], server: string | null): string[] => {
      const r = checkArmArgs(args, server);
      return r.success ? [] : r.errors.map((e) => e.code);
    };
    expect(codes(['--strict-mcp-config'], null)).toEqual([]);
    expect(codes(['--strict-mcp-config', '--bare'], null)).toEqual(['ARM_FORBIDDEN_FLAG']);
    expect(codes([], null)).toEqual(['ARM_NOT_STRICT']);
    expect(codes(['--strict-mcp-config', '--mcp-config', 'a', '--mcp-config', 'b'], 's')).toEqual(['ARM_MCP_CONFIG_COUNT']);
    expect(codes(['--strict-mcp-config', 'mcp__other__x'], 's')).toEqual(['ARM_MCP_RULE_INVALID']);
    expect(codes(['--strict-mcp-config', 'mcp__s__*'], 's')).toEqual(['ARM_MCP_RULE_INVALID']);
    expect(codes(['--strict-mcp-config', 'mcp__s__x'], null)).toEqual(['ARM_MCP_RULE_INVALID']);
  });
});

describe('arms dry run', () => {
  const run = (argv: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = armsDryRunMain(argv, { repoRoot: REPO, nodeBinary: '/usr/bin/node' }, {
      stdout: (s) => out.push(s),
      stderr: (s) => err.push(s),
    });
    return { code, out: out.join(''), err: err.join('') };
  };

  it('parses its arguments', () => {
    expect(parseArmsDryRunArgs(['--help'])).toBe('help');
    expect(parseArmsDryRunArgs(['--arm', 'nope'])).toEqual({ error: expect.stringMatching(/unknown arm nope/) as unknown });
    expect(parseArmsDryRunArgs(['--arm'])).toEqual({ error: '--arm needs a value' });
    expect(parseArmsDryRunArgs(['--arm', 'none', '--all', '--json'])).toMatchObject({ arms: ['none'], all: true, json: true });
    expect(ARM_LEVELS).toEqual(['none', 'minimal-prose']);
  });

  it('prints the argv and MCP config of each arm for the first cell of the E1 plan, without running anything', () => {
    const { code, out } = run([]);
    expect(code).toBe(0);
    expect(out).toMatch(/^# arms dry run: 36 cells per arm, 3 row\(s\) shown; nothing is executed/);
    expect(out).toContain('== arm none |');
    expect(out).toContain('mcp config: none (--strict-mcp-config, no server)');
    expect(out).toContain('NOT CONFIGURED: the context-graph arm is a placeholder');
    expect(out).toMatch(/Serena/);
    expect(out).toContain('mcp__daedalus-arch__check_file');
    expect(out).toContain('"daedalus-arch"');
    expect(out).toContain(path.join(REPO, 'specs', 'clean-arch.yaml'));
    expect(out).not.toContain('--dangerously-skip-permissions');
  });

  it('--all --json lists every cell of every requested arm', () => {
    const { code, out } = run(['--all', '--json', '--arm', 'none', '--arm', 'daedalus-mcp']);
    expect(code).toBe(0);
    const parsed = JSON.parse(out) as { cellsPerArm: number; rows: { arm: string; runId: string; call?: { args: string[] } }[] };
    expect(parsed.cellsPerArm).toBe(36);
    expect(parsed.rows).toHaveLength(72);
    // Arms of one tuple are adjacent, with the same run id.
    expect(parsed.rows[0]?.runId).toBe(parsed.rows[1]?.runId);
    expect(parsed.rows.every((r) => r.call !== undefined)).toBe(true);
    expect(new Set(parsed.rows.map((r) => r.runId.split('/')[2]))).toEqual(new Set(['none', 'minimal-prose']));
  });

  it('exits 2 on a usage or plan error', () => {
    expect(run(['--bogus']).code).toBe(2);
    expect(run(['--plan', 'does/not/exist.json']).err).toMatch(/plan error/);
  });

  it('abbreviates the prompt and quotes arguments', () => {
    expect(formatArgv('/c', ['-p', 'hi there', '--x', 'a b'], 'hi there')).toMatch(/^\/c -p <prompt 8 chars sha256:[0-9a-f]{12}> --x 'a b'$/);
  });
});
