/**
 * U5 Part B, the Gemini generator over `agy` (decision CDX; design §3): argv, child env, config bounds, the generator
 * home and settings checks (exact allow list per run and arm), the ancestor check, the turn-file writer, event parsing
 * over the synthetic fixtures, the disposition table of design §3.5 row by row, the stop rules, and that the labeller's
 * contract functions are not reused. Mocks and synthetic fixtures only; no agy process, no model call.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ProcessResult } from '../../../../src/shared/interfaces/process-runner.js';
import { typecheckCommand } from '../../../../scripts/lib/generators/argv.js';
import {
  AGY_GEN_MCP_CONFIG_REL,
  AGY_GEN_SETTINGS_REL,
  buildAgyGenArgs,
  buildAgyGenChildEnv,
  checkAgyGenHome,
  checkAgyGenSettings,
  checkAncestors,
  createAgyGenCliConfig,
  expectedAllow,
  writeAgyTurnFiles,
} from '../../../../scripts/lib/generators/agy-gen-cli.js';
import { agyGenAttemptDisposition, agyGenStop, agyGenTurnStatus, parseAgyGenRun, readAgyGenSteps } from '../../../../scripts/lib/generators/agy-gen-events.js';
import { createGeneratorCliConfig } from '../../../../scripts/lib/generators/config.js';
import { DEFAULT_GENERATOR_TIMEOUT_MS } from '../../../../scripts/lib/generators/types.js';

const REPO = process.cwd();
const FIX = path.join(REPO, 'tests/fixtures/agy-gen-cli');
const MODEL = 'dry-run-gemini-model';
const RUN = 'agy-cli/dry-run-gemini-model/todo-list/none/run-0';
const DAEDALUS = { nodeBinary: '/usr/bin/node', serverEntry: '/opt/daedalus/dist/mcp-server/main.js', specPath: '/opt/daedalus/specs/clean-arch.yaml' };

let tmp: string;
let H: string;
let cwd: string;
let homes: { none: string; 'daedalus-mcp': string };

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u5-agy-')));
  H = path.join(tmp, 'h');
  cwd = path.join(tmp, 'out', 'runs', 'r', 'work');
  homes = { none: path.join(tmp, 'homes', 'none'), 'daedalus-mcp': path.join(tmp, 'homes', 'mcp') };
  for (const d of [H, cwd, ...Object.values(homes)]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  for (const d of Object.values(homes)) fs.chmodSync(d, 0o700);
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function fixture(name: string): string {
  return fs.readFileSync(path.join(FIX, name), 'utf8').replace(/<TYPECHECK>/g, typecheckCommand(H, RUN)).replace(/<CWD>/g, cwd);
}

function cli(stdout: string, over: Partial<ProcessResult> = {}): ProcessResult {
  return { exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 5, ...over };
}

function config(over: { printTimeoutS?: number; allowCommand?: boolean; homes?: typeof homes } = {}) {
  const base = createGeneratorCliConfig({ binary: '/usr/local/bin/agy', modelId: MODEL, outputRoot: path.join(tmp, 'out'), harnessRoot: H }, REPO);
  if (!base.success) throw new Error('base config');
  return createAgyGenCliConfig({ base: base.data, homes: over.homes ?? homes, cliVersion: '0.0.0', ...over }, REPO);
}

describe('argv, env and config', () => {
  it('the exact argv: stream-json, the pinned model, sandbox, no slash commands, the print timeout; no prompt', () => {
    const c = config();
    if (!c.success) throw new Error('config');
    expect([...buildAgyGenArgs(c.data)]).toEqual(['--output-format', 'stream-json', '--model', MODEL, '--sandbox', '--disable-slash-commands', '--print-timeout', '1170s']);
  });

  it('the default print timeout gives the same wall budget as the other generators; above 1170 is refused', () => {
    const c = config();
    if (!c.success) throw new Error('config');
    expect(c.data.timeoutMs).toBe(DEFAULT_GENERATOR_TIMEOUT_MS);
    expect(config({ printTimeoutS: 1171 }).success).toBe(false);
    expect(config({ printTimeoutS: 59 }).success).toBe(false);
    expect(config({ printTimeoutS: 600 }).success).toBe(true);
  });

  it('homes: one per arm, absolute, outside the repository, the out-root and the harness', () => {
    expect(config({ homes: { none: homes.none, 'daedalus-mcp': homes.none } }).success).toBe(false);
    const inRepo = config({ homes: { none: path.join(REPO, 'x'), 'daedalus-mcp': homes['daedalus-mcp'] } });
    expect(inRepo.success ? [] : inRepo.errors.map((e) => e.code)).toContain('GEN_AGY_HOME_INSIDE_REPO');
    const inOut = config({ homes: { none: path.join(tmp, 'out', 'home'), 'daedalus-mcp': homes['daedalus-mcp'] } });
    expect(inOut.success ? [] : inOut.errors.map((e) => e.code)).toContain('GEN_AGY_HOME_INSIDE_CWD');
  });

  it('env: the agy allow-list only; HOME is the arm home; keys and tokens removed; auto-update off', () => {
    const env = buildAgyGenChildEnv({ PATH: '/bin', HOME: '/Users/real', GEMINI_API_KEY: 'k', FOO_TOKEN: 't', NEO4J_URI: 'x', USER: 'u' }, homes.none);
    expect(env).toEqual({ PATH: '/bin', HOME: homes.none, USER: 'u', LANG: 'en_US.UTF-8', AGY_CLI_DISABLE_AUTO_UPDATE: 'true' });
  });
});

describe('generator home and settings', () => {
  const allow = (arm: 'none' | 'daedalus-mcp', runId = RUN): readonly string[] => expectedAllow({ arm, runId, harnessRoot: H, cwd, allowCommand: true });

  it('the committed settings fixtures pass once their placeholders are filled', () => {
    for (const [file, arm] of [['gen-settings-none.json', 'none'], ['gen-settings-mcp.json', 'daedalus-mcp']] as const) {
      const text = fs.readFileSync(path.join(FIX, file), 'utf8').replace(/<CWD>/g, cwd).replace(/<H>/g, H).replace(/<RUN>/g, RUN.split('/').join('/'));
      expect(checkAgyGenSettings(text, arm, allow(arm))).toEqual([]);
    }
  });

  it('the turn writer gives a home that passes; an extra allow entry or another run\'s command fails', () => {
    const w = writeAgyTurnFiles(homes.none, { arm: 'none', runId: RUN, harnessRoot: H, cwd, allowCommand: true });
    if (!w.success) throw new Error('write');
    expect(checkAgyGenHome(homes.none, 'none', allow('none')).problems).toEqual([]);
    expect(checkAgyGenHome(homes.none, 'none', [...allow('none'), 'command(*)']).problems.join()).toMatch(/permissions\.allow must be exactly/);
    expect(checkAgyGenHome(homes.none, 'none', allow('none', 'agy-cli/m/other/none/run-1')).problems.join()).toMatch(/permissions\.allow must be exactly/);
  });

  it('strict, allowNonWorkspaceAccess and the deny list are checked; problems name keys, never values', () => {
    const settings = (o: Record<string, unknown>) => JSON.stringify({ toolPermission: 'strict', enableTerminalSandbox: true, disableSlashCommands: true, permissions: { allow: [...allow('none')], deny: [] }, ...o });
    const p1 = checkAgyGenSettings(settings({ toolPermission: 'request-review' }), 'none', allow('none'));
    expect(p1.join()).toMatch(/toolPermission must be "strict"/);
    expect(p1.join()).toMatch(/permissions\.deny lacks/);
    expect(checkAgyGenSettings(settings({ allowNonWorkspaceAccess: true }), 'none', allow('none')).join()).toMatch(/allowNonWorkspaceAccess/);
    expect(p1.join()).not.toContain(cwd);
  });

  it('each forbidden home name fails; the none home with an MCP server fails; the mcp home needs exactly daedalus-arch', () => {
    for (const name of ['GEMINI.md', 'skills', 'plugins', 'agents', 'workflows', 'hooks']) {
      const p = path.join(homes.none, '.gemini', name);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, '');
      expect(checkAgyGenHome(homes.none, 'none', null).problems.join()).toMatch(new RegExp(`forbidden entry .gemini/${name}`));
      fs.rmSync(p);
    }
    const mcp = path.join(homes.none, AGY_GEN_MCP_CONFIG_REL);
    fs.mkdirSync(path.dirname(mcp), { recursive: true });
    fs.writeFileSync(mcp, JSON.stringify({ mcpServers: { 'daedalus-arch': {} } }));
    expect(checkAgyGenHome(homes.none, 'none', null).problems).toContain('the none home must list no MCP server');
    const w = writeAgyTurnFiles(homes['daedalus-mcp'], { arm: 'daedalus-mcp', runId: RUN, harnessRoot: H, cwd, allowCommand: true, daedalus: DAEDALUS });
    if (!w.success) throw new Error('write');
    expect(checkAgyGenHome(homes['daedalus-mcp'], 'daedalus-mcp', allow('daedalus-mcp')).problems).toEqual([]);
    fs.chmodSync(homes['daedalus-mcp'], 0o755);
    expect(checkAgyGenHome(homes['daedalus-mcp'], 'daedalus-mcp', allow('daedalus-mcp')).problems).toContain('generator home is accessible to group or others');
  });

  it('the daedalus-mcp MCP config carries --project <cwd> and --call-log; the none arm writes none', () => {
    const w = writeAgyTurnFiles(homes['daedalus-mcp'], { arm: 'daedalus-mcp', runId: RUN, harnessRoot: H, cwd, allowCommand: true, daedalus: DAEDALUS, callLogPath: path.join(H, 'calls', 'step-01.jsonl') });
    if (!w.success) throw new Error('write');
    const cfg = JSON.parse(fs.readFileSync(path.join(homes['daedalus-mcp'], AGY_GEN_MCP_CONFIG_REL), 'utf8')) as { mcpServers: Record<string, { command: string; args: string[] }> };
    expect(cfg.mcpServers['daedalus-arch']?.args).toEqual([DAEDALUS.serverEntry, '--spec', DAEDALUS.specPath, '--project', cwd, '--engine', 'neo4j', '--call-log', path.join(H, 'calls', 'step-01.jsonl')]);
    writeAgyTurnFiles(homes.none, { arm: 'none', runId: RUN, harnessRoot: H, cwd, allowCommand: true });
    expect(fs.existsSync(path.join(homes.none, AGY_GEN_MCP_CONFIG_REL))).toBe(false);
    expect(fs.existsSync(path.join(homes.none, AGY_GEN_SETTINGS_REL))).toBe(true);
  });

  it('a planted GEMINI.md above the cwd fails closed', () => {
    expect(checkAncestors(cwd).success).toBe(true);
    fs.writeFileSync(path.join(tmp, 'out', 'GEMINI.md'), 'canary');
    const r = checkAncestors(cwd);
    expect(r.success ? '' : r.errors[0]?.code).toBe('LOOP_GEMINI_AMBIENT');
  });
});

describe('events, disposition, status and stops (design §3.5)', () => {
  const stopCtx = (arm: 'none' | 'daedalus-mcp' = 'none') => ({ arm, allowCommand: true, typecheckCommand: typecheckCommand(H, RUN) });

  it('parses the stream into the tolerant summary; the answer text is not kept', () => {
    const p = parseAgyGenRun(fixture('stream-gen-completed.ndjson'), []);
    if (!p.success) throw new Error('parse');
    expect(p.data.summary).toMatchObject({ isError: false, numTurns: 2, sessionId: '<UUID>', durationMs: 42500, modelUsage: { [MODEL]: { outputTokens: 1200 } } });
    expect(p.data.scrubbed.usage).toEqual({ input_tokens: 5200, output_tokens: 1200, cache_read_input_tokens: 8000 });
    expect(JSON.stringify(p.data.scrubbed)).not.toContain('"response"');
    expect(parseAgyGenRun('not json\n', []).success).toBe(false);
    expect(readAgyGenSteps(fixture('stream-gen-denied-tool.ndjson')).map((s) => `${s.tool}:${s.state}`)).toEqual(['run_command:ERROR', 'write_to_file:DONE']);
  });

  it('row by row', () => {
    const env = (name: string) => {
      const p = parseAgyGenRun(fixture(name), []);
      return p.success ? p.data : null;
    };
    // spawn failure / exit before init: infrastructure
    expect(agyGenAttemptDisposition(null, null, 0)).toEqual({ kind: 'infrastructure', label: 'spawn-failed' });
    expect(agyGenAttemptDisposition(cli('', { exitCode: 3 }), null, 0)).toEqual({ kind: 'infrastructure', label: 'exit-3-before-init' });
    // print timeout (exit 0, SUCCESS, empty answer, stderr line): timeout with files, infrastructure without
    const timeout = cli(fixture('stream-gen-print-timeout.ndjson'), { stderr: fs.readFileSync(path.join(FIX, 'stream-gen-print-timeout.stderr.txt'), 'utf8') });
    expect(agyGenAttemptDisposition(timeout, env('stream-gen-print-timeout.ndjson'), 2)).toEqual({ kind: 'final', label: 'timeout' });
    expect(agyGenAttemptDisposition(timeout, env('stream-gen-print-timeout.ndjson'), 0)).toEqual({ kind: 'infrastructure', label: 'timeout-no-files' });
    expect(agyGenTurnStatus(timeout, false, env('stream-gen-print-timeout.ndjson'), MODEL)).toBe('timeout');
    // usage limit on an erroring call
    const usage = cli(fixture('stream-gen-usage-limit.ndjson'), { exitCode: 1 });
    expect(agyGenAttemptDisposition(usage, env('stream-gen-usage-limit.ndjson'), 0)).toMatchObject({ kind: 'usage-limit' });
    // a successful run whose text mentions a quota is not a limit
    expect(agyGenAttemptDisposition(cli(fixture('stream-gen-completed.ndjson').replace('"done"', '"rate limit middleware"')), null, 1)).toEqual({ kind: 'final', label: 'completed' });
    // model mismatch, agent error, completed
    expect(agyGenTurnStatus(cli(fixture('stream-gen-model-mismatch.ndjson')), false, env('stream-gen-model-mismatch.ndjson'), MODEL)).toBe('model-mismatch');
    expect(agyGenTurnStatus(usage, false, env('stream-gen-usage-limit.ndjson'), MODEL)).toBe('agent-error');
    expect(agyGenTurnStatus(cli(fixture('stream-gen-completed.ndjson')), false, env('stream-gen-completed.ndjson'), MODEL)).toBe('completed');
    expect(agyGenTurnStatus(cli(''), false, null, MODEL)).toBe('envelope-unreadable');
    expect(agyGenTurnStatus(cli(''), true, null, MODEL)).toBe('infrastructure');
    // auth: final, and a grid stop
    const auth = cli('', { exitCode: 1, stderr: 'Error: authentication required' });
    expect(agyGenAttemptDisposition(auth, null, 0)).toEqual({ kind: 'final', label: 'auth' });
    expect(agyGenStop(auth, stopCtx())?.code).toBe('LOOP_GEMINI_AUTH');
  });

  it('a completed tool outside the allow list stops the grid; a denied one does not', () => {
    expect(agyGenStop(cli(fixture('stream-gen-tool-escape.ndjson')), stopCtx())?.code).toBe('LOOP_GEMINI_TOOL_ESCAPE');
    expect(agyGenStop(cli(fixture('stream-gen-denied-tool.ndjson')), stopCtx())).toBeNull();
    expect(agyGenStop(cli(fixture('stream-gen-completed.ndjson')), stopCtx())).toBeNull();
    // another run's type-check command, any MCP call in none, evaluate_project in mcp, a command with allowCommand off
    const other = fixture('stream-gen-completed.ndjson').replace(typecheckCommand(H, RUN), typecheckCommand(H, 'agy-cli/m/x/none/run-9'));
    expect(agyGenStop(cli(other), stopCtx())?.message).toMatch(/a command other than the run's type-check/);
    expect(agyGenStop(cli(fixture('stream-gen-mcp-completed.ndjson')), stopCtx('none'))?.code).toBe('LOOP_GEMINI_TOOL_ESCAPE');
    expect(agyGenStop(cli(fixture('stream-gen-mcp-completed.ndjson')), stopCtx('daedalus-mcp'))).toBeNull();
    expect(agyGenStop(cli(fixture('stream-gen-mcp-completed.ndjson').replace('check_import', 'evaluate_project')), stopCtx('daedalus-mcp'))?.code).toBe('LOOP_GEMINI_TOOL_ESCAPE');
    expect(agyGenStop(cli(fixture('stream-gen-completed.ndjson')), { ...stopCtx(), allowCommand: false })?.message).toMatch(/commands are not allowed/);
  });

  it('the labeller contract functions are not reused by the generator code', () => {
    for (const f of ['scripts/lib/generators/agy-gen-cli.ts', 'scripts/lib/generators/agy-gen-events.ts', 'scripts/lib/generators/agy-gen-plan.ts', 'scripts/lib/loop/agents.ts']) {
      const text = fs.readFileSync(path.join(REPO, f), 'utf8').replace(/\/\*\*[\s\S]*?\*\//g, '');
      expect(text).not.toMatch(/\b(classifyAgyResult|checkAgySettings|checkAgyHome)\b/);
    }
  });
});
