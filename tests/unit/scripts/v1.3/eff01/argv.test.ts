/** T-ARGV (design DR-9 to DR-11; A1 DR-A1-2): the three argv element for element, the 11 rules, the MCP config. */
import { TOOL_NAMES } from '../../../../../src/mcp-server/server.js';
import { checkArmArgs } from '../../../../../scripts/lib/generators/arms.js';
import {
  buildConditionArgs,
  callLogPathOf,
  checkEff01Args,
  eff01McpConfig,
  mcpConfigPathOf,
  sessionIdOfKey,
  sessionKeyOf,
} from '../../../../../scripts/v1.3/lib/eff01/argv.js';

const P = '<the frame>';
const M = 'claude-sonnet-5-5';
const HEAD = ['-p', P, '--model', M, '--output-format', 'stream-json', '--verbose', '--safe-mode', '--restricted', '--max-turns', '30'];
const RULES = [
  'mcp__daedalus-arch__get_architecture_spec',
  'mcp__daedalus-arch__which_layer',
  'mcp__daedalus-arch__check_import',
  'mcp__daedalus-arch__evaluate_project',
  'mcp__daedalus-arch__explain_violation',
  'mcp__daedalus-arch__check_file',
  'mcp__daedalus-arch__check_diff',
  'mcp__daedalus-arch__suggest_placement',
  'mcp__daedalus-arch__infer_spec',
  'mcp__daedalus-arch__explain_finding',
  'mcp__daedalus-arch__propose_spec',
];

function args(c: 'R' | 'G' | 'N', mcpConfigPath?: string): readonly string[] {
  const r = buildConditionArgs(c, { prompt: P, model: M, ...(mcpConfigPath !== undefined ? { mcpConfigPath } : {}) });
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

describe('EFF-01 argv (T-ARGV)', () => {
  it('R is the note §11 call plus --max-turns 30', () => {
    expect(args('R')).toEqual([...HEAD, '--tools', 'Read,Grep,Glob', '--permission-prompts', 'none', '--no-session-persistence', '--strict-mcp-config']);
  });

  it('G is files plus graph (A1): R\'s tools, the per-session MCP config and the 11 exact rules', () => {
    expect(args('G', '/h/mcp/main__ddd-forum__DF-Q02__G__run-1.json')).toEqual([
      ...HEAD,
      '--tools',
      'Read,Grep,Glob',
      '--strict-mcp-config',
      '--mcp-config',
      '/h/mcp/main__ddd-forum__DF-Q02__G__run-1.json',
      '--allowedTools',
      ...RULES,
      '--permission-prompts',
      'none',
      '--no-session-persistence',
    ]);
    expect(RULES).toEqual(TOOL_NAMES.map((t) => `mcp__daedalus-arch__${t}`));
  });

  it('N is the note §11 call plus --max-turns 30', () => {
    expect(args('N')).toEqual([...HEAD, '--tools', '', '--permission-prompts', 'none', '--no-session-persistence', '--strict-mcp-config']);
  });

  it('every argv passes checkArmArgs and carries no forbidden flag or write tool', () => {
    for (const [c, server] of [['R', null], ['G', 'daedalus-arch'], ['N', null]] as const) {
      const a = args(c, '/h/mcp/x.json');
      expect(checkArmArgs(a, server).success).toBe(true);
      expect(checkEff01Args(a)).toEqual([]);
      for (const bad of ['--bare', '--add-dir', '--dangerously-skip-permissions', '--max-budget-usd', '--permission-mode', 'Write', 'Edit', 'Bash']) {
        expect(a).not.toContain(bad);
      }
    }
    expect(checkEff01Args(['--tools', 'Read,Write']).length).toBeGreaterThan(0);
    expect(checkEff01Args(['--permission-mode', 'acceptEdits']).length).toBeGreaterThan(0);
  });

  it('G needs an absolute config path', () => {
    expect(buildConditionArgs('G', { prompt: P, model: M }).success).toBe(false);
    expect(buildConditionArgs('G', { prompt: P, model: M, mcpConfigPath: 'mcp/x.json' }).success).toBe(false);
  });
});

describe('EFF-01 MCP config (DR-11)', () => {
  const base = { nodeBinary: '/usr/bin/node', serverEntry: '/repo/dist/mcp-server/main.js', specPath: '/repo/results/v1.3-external/specs/ddd-forum.yaml', treeDir: '/h/trees/ddd-forum' };

  it('names one stdio server with the in-process engine and an absolute per-session call log', () => {
    const r = eff01McpConfig({ ...base, callLogPath: '/h/calls/main__ddd-forum__DF-Q02__G__run-1.jsonl' });
    if (!r.success) throw new Error(r.errors[0]?.message);
    expect(Object.keys(r.data.mcpServers)).toEqual(['daedalus-arch']);
    expect(r.data.mcpServers['daedalus-arch']).toEqual({
      type: 'stdio',
      command: '/usr/bin/node',
      args: ['/repo/dist/mcp-server/main.js', '--spec', base.specPath, '--project', '/h/trees/ddd-forum', '--engine', 'cypher-interp', '--call-log', '/h/calls/main__ddd-forum__DF-Q02__G__run-1.jsonl'],
      env: {},
    });
    const a = r.data.mcpServers['daedalus-arch']?.args ?? [];
    expect(a).not.toContain('--neural');
    expect(a).not.toContain('--rule-mining');
  });

  it('refuses a relative path and a call log inside the tree', () => {
    expect(eff01McpConfig({ ...base, callLogPath: 'calls/x.jsonl' }).success).toBe(false);
    expect(eff01McpConfig({ ...base, specPath: 'specs/x.yaml', callLogPath: '/h/calls/x.jsonl' }).success).toBe(false);
    expect(eff01McpConfig({ ...base, callLogPath: '/h/trees/ddd-forum/calls.jsonl' }).success).toBe(false);
  });

  it('gives two sessions two different config and call-log paths', () => {
    const k1 = sessionKeyOf('main/ddd-forum/DF-Q02/G/run-1');
    const k2 = sessionKeyOf('main/ddd-forum/DF-Q02/G/run-2');
    expect(callLogPathOf('/h', k1)).not.toBe(callLogPathOf('/h', k2));
    expect(mcpConfigPathOf('/h', k1)).toBe('/h/mcp/main__ddd-forum__DF-Q02__G__run-1.json');
    expect(callLogPathOf('/h', k1)).toBe('/h/calls/main__ddd-forum__DF-Q02__G__run-1.jsonl');
    expect(sessionIdOfKey(k1)).toBe('main/ddd-forum/DF-Q02/G/run-1');
  });
});
