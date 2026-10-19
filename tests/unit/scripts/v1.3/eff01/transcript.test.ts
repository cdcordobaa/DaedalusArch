/** T-CONF (design DR-23; A1 DR-A1-4) and cost stripping (DR-27). */
import { TOOL_NAMES } from '../../../../../src/mcp-server/server.js';
import { checkConfinement, graphToolCalls, readTranscript, stripCost, toolCallCounts } from '../../../../../scripts/v1.3/lib/eff01/transcript.js';

const TREE = '/h/trees/ddd-forum';
const OWN = TOOL_NAMES.map((t) => `mcp__daedalus-arch__${t}`);

function init(tools: string[], servers: { name: string; status: string }[] = []): string {
  return JSON.stringify({ type: 'system', subtype: 'init', model: 'm', tools, mcp_servers: servers });
}
function use(name: string, input: Record<string, unknown> = {}): string {
  return JSON.stringify({ type: 'assistant', message: { id: `m-${name}-${JSON.stringify(input)}`, model: 'm', content: [{ type: 'tool_use', id: 't', name, input }] } });
}
const RESULT = JSON.stringify({ type: 'result', subtype: 'success', result: 'ANSWER: {}', total_cost_usd: 1, modelUsage: { m: { costUSD: 1, outputTokens: 2 } } });
const R_INIT = init(['Read', 'Grep', 'Glob']);
const G_INIT = init(['Read', 'Grep', 'Glob', ...OWN], [{ name: 'daedalus-arch', status: 'connected' }]);
const N_INIT = init([]);

function conf(c: 'R' | 'G' | 'N', lines: string[]) {
  return checkConfinement(c, readTranscript(lines.join('\n')), c === 'N' ? null : TREE);
}

describe('EFF-01 confinement (T-CONF)', () => {
  it('passes a clean transcript per condition', () => {
    expect(conf('R', [R_INIT, use('Read', { file_path: `${TREE}/src/a.ts` }), use('Grep', { pattern: 'x', path: 'src' }), use('Glob', { pattern: 'src/**/*.ts' }), RESULT]).ok).toBe(true);
    expect(conf('G', [G_INIT, use('Read', { file_path: `${TREE}/README.md` }), use('mcp__daedalus-arch__evaluate_project'), RESULT]).ok).toBe(true);
    expect(conf('N', [N_INIT, RESULT]).ok).toBe(true);
  });

  it('R: an mcp__ call is a leak', () => {
    expect(conf('R', [R_INIT, use('mcp__daedalus-arch__which_layer'), RESULT]).reasons).toEqual(['mcp-tool:mcp__daedalus-arch__which_layer']);
  });

  it('R and G: a read outside the tree is a leak (absolute or ../)', () => {
    expect(conf('R', [R_INIT, use('Read', { file_path: '/repo/experiments/eff-01/answers.json' }), RESULT]).reasons).toEqual(['read-outside-tree:/repo/experiments/eff-01/answers.json']);
    expect(conf('R', [R_INIT, use('Grep', { pattern: 'x', path: '../../' }), RESULT]).ok).toBe(false);
    expect(conf('R', [R_INIT, use('Glob', { pattern: '/repo/results/**/*.json' }), RESULT]).ok).toBe(false);
    expect(conf('G', [G_INIT, use('Read', { file_path: '/etc/hosts' }), RESULT]).reasons).toEqual(['read-outside-tree:/etc/hosts']);
  });

  it('G (A1): a built-in other than Read/Grep/Glob, or a foreign MCP server, is a leak', () => {
    expect(conf('G', [G_INIT, use('Bash', { command: 'ls' }), RESULT]).reasons).toEqual(['builtin-not-allowed:Bash']);
    expect(conf('G', [G_INIT, use('mcp__other__x'), RESULT]).reasons).toEqual(['foreign-mcp-tool:mcp__other__x']);
  });

  it('G: daedalus-arch not connected (or no init event) is a leak', () => {
    const failed = init(['Read', 'Grep', 'Glob', ...OWN], [{ name: 'daedalus-arch', status: 'failed' }]);
    expect(conf('G', [failed, RESULT]).reasons).toEqual(['mcp-not-connected']);
    expect(conf('G', [RESULT]).reasons).toEqual(['mcp-not-connected']);
  });

  it('N: any tool call is a leak', () => {
    expect(conf('N', [N_INIT, use('Read', { file_path: 'x' }), RESULT]).reasons).toEqual(['tool-use:Read']);
  });

  it('checks the init tool lists against the condition', () => {
    expect(conf('R', [init(['Read', 'Grep', 'Glob', 'Bash']), RESULT]).reasons).toEqual(['init-tools-mismatch:Bash,Glob,Grep,Read']);
    expect(conf('G', [init(['Read', 'Grep', 'Glob', ...OWN.slice(1)], [{ name: 'daedalus-arch', status: 'connected' }]), RESULT]).reasons).toEqual(['init-mcp-tools-mismatch']);
    expect(conf('N', [init(['Read']), RESULT]).ok).toBe(false);
  });

  it('counts tools by name and the graph tool uses', () => {
    const t = readTranscript([G_INIT, use('Read', { file_path: 'a' }), use('Read', { file_path: 'b' }), use('mcp__daedalus-arch__which_layer'), RESULT].join('\n'));
    expect(toolCallCounts(t)).toEqual({ total: 3, byName: { Read: 2, 'mcp__daedalus-arch__which_layer': 1 } });
    expect(graphToolCalls(t)).toBe(1);
  });
});

describe('stripCost (DR-27)', () => {
  it('removes total_cost_usd and every costUSD, deeply, and nothing else', () => {
    const t = readTranscript(RESULT);
    const s = stripCost(t.resultEvent);
    expect(JSON.stringify(s)).not.toMatch(/cost/i);
    expect(s).toEqual({ type: 'result', subtype: 'success', result: 'ANSWER: {}', modelUsage: { m: { outputTokens: 2 } } });
  });
});
