/**
 * U12: the Gemini generator's PreToolUse confinement hook (`scripts/lib/generators/agy-confine-hook.mjs`). The pure
 * decision function is driven in one Node child (the hook is plain ESM; Jest runs CommonJS), and the hook process
 * itself is run as agy runs it (config path in argv, payload on stdin) for the log, the output and fail-closed exits.
 * No agy process, no model call.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AGY_GEN_ANSWER_TOOLS, AGY_GEN_FILE_TOOLS, AGY_HOOK_CONFIG_SCHEMA, agyHookSourcePath } from '../../../../scripts/lib/generators/agy-gen-cli.js';
import { DAEDALUS_ARM_TOOLS, DAEDALUS_DENIED_TOOLS } from '../../../../scripts/lib/generators/arms.js';

const REPO = process.cwd();
const HOOK = agyHookSourcePath(REPO);

/** agy 1.4.2's tool names from a real `init` event (S4 run of 2026-10-19). */
const AGY_142_TOOLS = [
  'ask_custom_permission', 'ask_permission', 'ask_question', 'browser_click_element', 'browser_drag_pixel_to_pixel', 'browser_get_dom',
  'browser_get_network_request', 'browser_input', 'browser_list_network_requests', 'browser_mouse_down', 'browser_mouse_up', 'browser_move_mouse',
  'browser_press_key', 'browser_refresh_page', 'browser_resize_window', 'browser_scroll', 'browser_scroll_dom', 'browser_select_option',
  'browser_subagent', 'call_mcp_tool', 'capture_browser_console_logs', 'capture_browser_screenshot', 'click_browser_pixel', 'command_status',
  'define_subagent', 'delete_knowledge', 'execute_browser_javascript', 'find_by_name', 'finish', 'generate_image', 'grep_search', 'invoke_subagent',
  'list_browser_pages', 'list_dir', 'list_permissions', 'list_plugin_accounts', 'list_resources', 'manage_inbox', 'manage_subagents', 'manage_task',
  'multi_replace_file_content', 'notebook_edit', 'notebook_execution', 'open_browser_url', 'read_browser_page', 'read_resource', 'read_url_content',
  'replace_file_content', 'run_command', 'run_workflow', 'schedule', 'search_marketplace', 'search_web', 'sed_file', 'send_command_input',
  'send_message', 'view_file', 'wait', 'wait_5_seconds', 'write_to_file',
];
const ALWAYS_DENIED = AGY_142_TOOLS.filter((t) => !AGY_GEN_FILE_TOOLS.includes(t) && !['finish', 'run_command', 'command_status', 'call_mcp_tool'].includes(t));

let tmp: string;
let work: string;
let outside: string;
let home: string;
let logPath: string;
const CMD = '/h/bin/tsc --noEmit --incremental false -p /h/runs/r/tsconfig.json';

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u12-hook-')));
  work = path.join(tmp, 'cell', 'work');
  outside = path.join(tmp, 'outside');
  home = path.join(tmp, 'home');
  logPath = path.join(tmp, 'logs', 'turn.jsonl');
  fs.mkdirSync(path.join(work, 'src'), { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(work, 'src', 'a.ts'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(outside, 'secret.ts'), 'secret\n');
  fs.symlinkSync(outside, path.join(work, 'node_modules'));
  fs.symlinkSync(path.join(outside, 'secret.ts'), path.join(work, 'src', 'link.ts'));
  fs.mkdirSync(path.join(home, '.gemini', 'antigravity-cli', 'mcp', 'daedalus-arch'), { recursive: true });
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function config(arm: 'none' | 'daedalus-mcp' = 'none', over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: AGY_HOOK_CONFIG_SCHEMA,
    arm,
    workDir: work,
    allowCommand: true,
    typecheckCommand: CMD,
    logPath,
    ...(arm === 'daedalus-mcp'
      ? { mcp: { server: 'daedalus-arch', allowedTools: [...DAEDALUS_ARM_TOOLS], deniedTools: [...DAEDALUS_DENIED_TOOLS], schemaDir: path.join(home, '.gemini', 'antigravity-cli', 'mcp', 'daedalus-arch') } }
      : {}),
    ...over,
  };
}

interface Case {
  readonly input: unknown;
  readonly config: Record<string, unknown>;
  readonly prior?: boolean;
}
type Out = { decision: string; reason: string } | { error: string };

/** Runs `decide` over every case in one Node child (real fs, realpath included). */
function decideAll(cases: readonly Case[]): Out[] {
  const driver = `
    import { decide } from ${JSON.stringify(pathToFileURL(HOOK).href)};
    import * as fs from 'node:fs';
    const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
    const out = cases.map((c) => { try { return decide(c.input, c.config, { priorCommandAllowed: c.prior === true }); } catch (e) { return { error: String(e && e.message) }; } });
    process.stdout.write(JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', driver], { input: JSON.stringify(cases), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout) as Out[];
}

function one(name: string, args: unknown, c: Record<string, unknown> = config(), prior = false): Out {
  const [out] = decideAll([{ input: { toolCall: { name, args }, stepIdx: 3 }, config: c, prior }]);
  if (out === undefined) throw new Error('no decision');
  return out;
}

const decision = (o: Out): string => ('decision' in o ? o.decision : `error:${o.error}`);

describe('the decision function (pure, fail-closed)', () => {
  it('every file tool is allowed with every path inside the work directory (absolute or relative)', () => {
    const cases: Case[] = [
      { input: { toolCall: { name: 'view_file', args: { AbsolutePath: path.join(work, 'src', 'a.ts') } } }, config: config() },
      { input: { toolCall: { name: 'list_dir', args: { DirectoryPath: work } } }, config: config() },
      { input: { toolCall: { name: 'find_by_name', args: { SearchDirectory: work, Pattern: '*.ts' } } }, config: config() },
      { input: { toolCall: { name: 'grep_search', args: { SearchPath: path.join(work, 'src'), Query: '/etc/passwd' } } }, config: config() },
      { input: { toolCall: { name: 'write_to_file', args: { TargetFile: path.join(work, 'src', 'new', 'b.ts'), CodeContent: 'import x from "/abs";' } } }, config: config() },
      { input: { toolCall: { name: 'replace_file_content', args: { TargetFile: 'src/a.ts', TargetContent: '1', ReplacementContent: '../../x' } } }, config: config() },
      { input: { toolCall: { name: 'multi_replace_file_content', args: { TargetFile: path.join(work, 'src', 'a.ts'), ReplacementChunks: [{ TargetContent: '/x', ReplacementContent: '/y' }] } } }, config: config() },
      { input: { toolCall: { name: 'sed_file', args: { File: path.join(work, 'src', 'a.ts') } } }, config: config() },
      { input: { toolCall: { name: 'read_file', args: { Path: path.join(work, 'src', 'a.ts') } } }, config: config() },
      { input: { toolCall: { name: 'write_file', args: { Path: path.join(work, 'notes.md') } } }, config: config() },
      { input: { toolCall: { name: 'finish', args: {} } }, config: config() },
    ];
    expect(decideAll(cases).map(decision)).toEqual(cases.map(() => 'allow'));
  });

  it('path escapes are denied: ../, an absolute outside path, a symlinked directory, a symlinked file, ~, file:// outside', () => {
    const cases: Case[] = [
      { input: { toolCall: { name: 'write_to_file', args: { TargetFile: '../escape.txt' } } }, config: config() },
      { input: { toolCall: { name: 'write_to_file', args: { TargetFile: path.join(work, 'src', '..', '..', 'escape.txt') } } }, config: config() },
      { input: { toolCall: { name: 'view_file', args: { AbsolutePath: path.join(outside, 'secret.ts') } } }, config: config() },
      { input: { toolCall: { name: 'view_file', args: { AbsolutePath: path.join(work, 'node_modules', 'secret.ts') } } }, config: config() },
      { input: { toolCall: { name: 'write_to_file', args: { TargetFile: path.join(work, 'node_modules', 'new.js') } } }, config: config() },
      { input: { toolCall: { name: 'replace_file_content', args: { TargetFile: path.join(work, 'src', 'link.ts') } } }, config: config() },
      { input: { toolCall: { name: 'list_dir', args: { DirectoryPath: '~/.ssh' } } }, config: config() },
      { input: { toolCall: { name: 'read_file', args: { Path: pathToFileURL(path.join(outside, 'secret.ts')).href } } }, config: config() },
      // A second path argument under an unexpected key is still checked.
      { input: { toolCall: { name: 'grep_search', args: { SearchPath: work, Other: path.join(outside, 'secret.ts') } } }, config: config() },
      // No path argument at all.
      { input: { toolCall: { name: 'write_to_file', args: {} } }, config: config() },
    ];
    expect(decideAll(cases).map(decision)).toEqual(cases.map(() => 'deny'));
  });

  it('run_command: only the exact type-check command, and only with allowCommand', () => {
    expect(decision(one('run_command', { CommandLine: CMD }))).toBe('allow');
    expect(decision(one('run_command', { CommandLine: `  ${CMD}\n` }))).toBe('allow');
    for (const bad of [`${CMD} && touch ../x`, `${CMD}; echo x`, `${CMD} --tsBuildInfoFile ../x`, `${CMD} --generateTrace ..`, 'curl https://example.com', 'npm install left-pad', '']) {
      expect(decision(one('run_command', { CommandLine: bad }))).toBe('deny');
    }
    expect(decision(one('run_command', {}))).toBe('deny');
    expect(decision(one('run_command', { CommandLine: CMD }, config('none', { allowCommand: false, typecheckCommand: null })))).toBe('deny');
    expect(decision(one('send_command_input', { CommandId: '1', Input: 'y' }))).toBe('deny');
  });

  it('command_status only after the allowed command ran in this turn', () => {
    expect(decision(one('command_status', { CommandId: '1' }, config(), true))).toBe('allow');
    expect(decision(one('command_status', { CommandId: '1' }, config(), false))).toBe('deny');
    expect(decision(one('command_status', { CommandId: '1' }, config('none', { allowCommand: false, typecheckCommand: null }), true))).toBe('deny');
  });

  it('every other agy 1.4.2 tool family is denied in both arms (browser, sub-agents, schedule, search, image, workflows, inbox, plugins, ...)', () => {
    const cases: Case[] = [];
    for (const arm of ['none', 'daedalus-mcp'] as const) for (const t of ALWAYS_DENIED) cases.push({ input: { toolCall: { name: t, args: { Url: 'https://x', Prompt: 'p' } } }, config: config(arm) });
    const out = decideAll(cases);
    expect(out.map(decision)).toEqual(cases.map(() => 'deny'));
    expect(ALWAYS_DENIED).toEqual(expect.arrayContaining(['search_web', 'invoke_subagent', 'schedule', 'browser_subagent', 'generate_image', 'run_workflow', 'manage_inbox', 'read_url_content', 'open_browser_url', 'list_plugin_accounts']));
    expect(decision(one('some_future_tool', {}))).toBe('deny');
  });

  it('call_mcp_tool: denied in none; in daedalus-mcp only the spec-only daedalus-arch tools, never evaluate_project', () => {
    const mcp = config('daedalus-mcp');
    expect(decision(one('call_mcp_tool', { ServerName: 'daedalus-arch', ToolName: 'check_file' }, config('none')))).toBe('deny');
    for (const t of DAEDALUS_ARM_TOOLS) expect(decision(one('call_mcp_tool', { ServerName: 'daedalus-arch', ToolName: t, Arguments: { file: 'src/a.ts' } }, mcp))).toBe('allow');
    expect(decision(one('call_mcp_tool', { ToolName: 'daedalus-arch/check_file' }, mcp))).toBe('allow');
    expect(decision(one('call_mcp_tool', { ServerName: 'daedalus-arch', ToolName: 'evaluate_project' }, mcp))).toBe('deny');
    expect(decision(one('call_mcp_tool', { ToolName: 'mcp__daedalus-arch__evaluate_project' }, mcp))).toBe('deny');
    expect(decision(one('call_mcp_tool', { ServerName: 'other', ToolName: 'check_file' }, mcp))).toBe('deny');
    expect(decision(one('call_mcp_tool', { ServerName: 'daedalus-arch', ToolName: 'delete_everything' }, mcp))).toBe('deny');
    expect(decision(one('call_mcp_tool', { ServerName: 'daedalus-arch' }, mcp))).toBe('deny');
  });

  it("daedalus-mcp: reading an allowed tool's schema file in the home is allowed; evaluate_project's or any other home file is not", () => {
    const dir = path.join(home, '.gemini', 'antigravity-cli', 'mcp', 'daedalus-arch');
    expect(decision(one('read_file', { Path: path.join(dir, 'check_file.json') }, config('daedalus-mcp')))).toBe('allow');
    expect(decision(one('view_file', { AbsolutePath: path.join(dir, 'which_layer.json') }, config('daedalus-mcp')))).toBe('allow');
    expect(decision(one('read_file', { Path: path.join(dir, 'evaluate_project.json') }, config('daedalus-mcp')))).toBe('deny');
    expect(decision(one('read_file', { Path: path.join(home, '.gemini', 'antigravity-cli', 'settings.json') }, config('daedalus-mcp')))).toBe('deny');
    expect(decision(one('read_file', { Path: path.join(dir, 'check_file.json') }, config('none')))).toBe('deny');
    expect(decision(one('write_file', { Path: path.join(dir, 'check_file.json') }, config('daedalus-mcp')))).toBe('deny');
  });

  it('malformed input throws (the process then exits non-zero = blocked); a home with no turn denies everything', () => {
    const out = decideAll([
      { input: null, config: config() },
      { input: { toolCall: {} }, config: config() },
      { input: { toolCall: { name: '' } }, config: config() },
      { input: { toolCall: { name: 'view_file', args: 'x' } }, config: config() },
    ]);
    expect(out.every((o) => 'error' in o)).toBe(true);
    expect(decision(one('finish', {}, config('none', { workDir: null, logPath: null })))).toBe('deny');
  });

  it('the hook and the harness name the same file and answer tools', () => {
    const driver = `import { FILE_TOOLS, ANSWER_TOOLS } from ${JSON.stringify(pathToFileURL(HOOK).href)}; process.stdout.write(JSON.stringify({ FILE_TOOLS, ANSWER_TOOLS }));`;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', driver], { encoding: 'utf8' });
    const v = JSON.parse(r.stdout) as { FILE_TOOLS: string[]; ANSWER_TOOLS: string[] };
    expect(v.FILE_TOOLS).toEqual([...AGY_GEN_FILE_TOOLS]);
    expect(v.ANSWER_TOOLS).toEqual([...AGY_GEN_ANSWER_TOOLS]);
  });
});

describe('the hook process (as agy runs it)', () => {
  function run(stdin: string, cfg: Record<string, unknown> | null = config(), argv?: string[]): { status: number | null; stdout: string; stderr: string } {
    const cfgPath = path.join(tmp, 'turn.json');
    if (cfg !== null) fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    const r = spawnSync(process.execPath, [HOOK, ...(argv ?? [cfgPath])], { input: stdin, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  }
  const payload = (name: string, args: unknown, stepIdx = 1): string => JSON.stringify({ toolCall: { name, args }, conversationId: 'c', workspacePaths: [work], modelName: 'm', stepIdx });
  const log = (): unknown[] => fs.readFileSync(logPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as unknown);

  it('prints the decision JSON with exit 0 and appends tool, decision, reason, stepIdx to the hook log', () => {
    const a = run(payload('write_to_file', { TargetFile: 'src/b.ts' }, 4));
    expect(a.status).toBe(0);
    expect(JSON.parse(a.stdout)).toMatchObject({ decision: 'auto_approve' });
    const d = run(payload('invoke_subagent', { Role: 'x' }, 5));
    expect(d.status).toBe(0);
    expect(JSON.parse(d.stdout)).toMatchObject({ decision: 'deny' });
    expect(log()).toEqual([
      { tool: 'write_to_file', decision: 'allow', reason: expect.any(String) as string, stepIdx: 4 },
      { tool: 'invoke_subagent', decision: 'deny', reason: 'invoke_subagent: not on the generator allow-list', stepIdx: 5 },
    ]);
  });

  it('round 4: agy only ever sees auto_approve or deny (never the delegating allow); edit_file is path-checked', () => {
    const outs = [
      run(payload('write_file', { Path: path.join(work, 'notes.md') })),
      run(payload('edit_file', { Path: path.join(work, 'src', 'a.ts') })),
      run(payload('edit_file', { Path: path.join(work, '..', 'sibling.txt') })),
      run(payload('run_command', { CommandLine: `${CMD} && touch ../x` })),
    ].map((r) => (JSON.parse(r.stdout) as { decision: string }).decision);
    expect(outs).toEqual(['auto_approve', 'auto_approve', 'deny', 'deny']);
    expect(log().map((l) => (l as { decision: string }).decision)).toEqual(['allow', 'allow', 'deny', 'deny']);
  });

  it('command_status is allowed after the allowed run_command was logged', () => {
    expect(JSON.parse(run(payload('command_status', { CommandId: '1' })).stdout)).toMatchObject({ decision: 'deny' });
    expect(JSON.parse(run(payload('run_command', { CommandLine: CMD })).stdout)).toMatchObject({ decision: 'auto_approve' });
    expect(JSON.parse(run(payload('command_status', { CommandId: '1' })).stdout)).toMatchObject({ decision: 'auto_approve' });
  });

  it('fails closed (non-zero exit, no decision) on malformed stdin, a missing or invalid config, a missing work dir, a home with no turn', () => {
    const bad = [
      run('not json'),
      run(JSON.stringify({ toolCall: { args: {} } })),
      run(payload('finish', {}), null, [path.join(tmp, 'missing.json')]),
      run(payload('finish', {}), null, []),
      run(payload('finish', {}), { ...config(), schema: 'other' }),
      run(payload('finish', {}), { ...config(), workDir: path.join(tmp, 'gone') }),
      run(payload('finish', {}), { ...config(), arm: 'gate' }),
      run(payload('finish', {}), config('none', { workDir: null, logPath: null })),
      run(payload('call_mcp_tool', {}), config('daedalus-mcp', { mcp: { server: 1 } })),
    ];
    for (const r of bad) {
      expect(r.status).not.toBe(0);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/the call is blocked/);
    }
    // The malformed-stdin errors are logged as error lines (S4 counts them).
    expect(log().filter((l) => (l as { decision: string }).decision === 'error').length).toBeGreaterThanOrEqual(2);
  });

  it('a log that cannot be written blocks the call', () => {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.mkdirSync(logPath);
    const r = run(payload('finish', {}));
    expect(r.status).not.toBe(0);
    expect(r.stdout).toBe('');
  });
});
