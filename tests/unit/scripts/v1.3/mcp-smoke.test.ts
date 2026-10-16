/**
 * MCP v2 live smoke script (scripts/v1.3/lib/mcp-smoke.ts) in dry-run mode: the argv is the daedalus-mcp arm's with
 * the two recorded deviations, the MCP config names only this server, and the transcript analysis answers "called
 * check_diff/check_file?" and "acted on a blocking answer?" for a stub agent that fixes, ignores, or never checks.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DAEDALUS_ARM_TOOLS } from '../../../../scripts/lib/generators/arms.js';
import { analyseTranscript, DEMO_FILES, runSmoke, StubClaudeRunner, verdictOf } from '../../../../scripts/v1.3/lib/mcp-smoke.js';

const REPO = path.resolve(__dirname, '../../../..');
const SPEC = path.join(REPO, 'specs/clean-arch.yaml');

async function dryRun(behaviour: 'fixes' | 'ignores-block' | 'never-checks', runner = new StubClaudeRunner(SPEC, behaviour)) {
  const res = await runSmoke({
    repoRoot: REPO,
    binary: '/usr/bin/claude-stub',
    modelId: 'stub-model',
    nodeBinary: process.execPath,
    serverEntry: path.join(REPO, 'dist/mcp-server/main.js'),
    timeoutMs: 60_000,
    runner,
    parentEnv: { PATH: '/usr/bin', HOME: '/home/x', ANTHROPIC_API_KEY: 'secret-key' },
    dryRun: true,
  });
  if (!res.success) throw new Error(res.errors.map((e) => e.message).join('; '));
  return { report: res.data, runner };
}

describe('mcp smoke (dry run)', () => {
  it('runs the arm argv with stream-json and no Bash, one strict MCP config, and cleans up', async () => {
    const { report, runner } = await dryRun('fixes');
    const call = runner.calls[1];
    expect(call?.args.slice(0, 1)).toEqual(['-p']);
    const args = call?.args ?? [];
    expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json');
    expect(args).toContain('--verbose');
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Write,Edit,Glob,Grep');
    expect(args.filter((a) => a === '--mcp-config')).toHaveLength(1);
    expect(args).toContain('--strict-mcp-config');
    expect(args.filter((a) => a.startsWith('mcp__daedalus-arch__') && args.indexOf(a) < args.indexOf('--disallowedTools'))).toEqual(DAEDALUS_ARM_TOOLS.map((t) => `mcp__daedalus-arch__${t}`));
    expect(args).toContain('mcp__daedalus-arch__evaluate_project');
    expect(Object.keys((report.mcpConfig as { mcpServers: Record<string, unknown> }).mcpServers)).toEqual(['daedalus-arch']);
    expect(call?.options.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(report.argv).toContain('<prompt>');
    expect(report.deviations).toHaveLength(2);
    expect(fs.existsSync(report.layout.root)).toBe(false);
  });

  it('an agent that fixes after a blocking answer: called yes, acted yes', async () => {
    const { report } = await dryRun('fixes');
    expect(report.transcript.checkCalls).toBe(3);
    expect(report.transcript.blockingAnswers).toBe(1);
    expect(report.transcript.editedAfterBlock).toEqual(['src/domain/entities/Order.ts', 'src/application/use-cases/CancelOrderUseCase.ts']);
    expect(report.verdict).toEqual({ calledCheck: true, sawBlocking: true, actedOnBlocking: 'yes', finalBlocking: [] });
  });

  it('an agent that ignores the blocking answer: acted no, the violation stays', async () => {
    const { report } = await dryRun('ignores-block');
    expect(report.verdict).toMatchObject({ calledCheck: true, sawBlocking: true, actedOnBlocking: 'no' });
    expect(report.verdict.finalBlocking).toEqual([{ file: 'src/domain/entities/Order.ts', rules: ['FF-S01', 'FF-S04'] }]);
  });

  it('an agent that never checks: called no', async () => {
    const { report } = await dryRun('never-checks');
    expect(report.verdict).toMatchObject({ calledCheck: false, sawBlocking: false, actedOnBlocking: 'n/a' });
  });

  it('refuses relative paths and a CLI version that does not match the pin', async () => {
    const base = { repoRoot: REPO, modelId: 'm', nodeBinary: process.execPath, serverEntry: path.join(REPO, 'x.js'), timeoutMs: 1, runner: new StubClaudeRunner(SPEC), parentEnv: {}, dryRun: true };
    const rel = await runSmoke({ ...base, binary: 'claude' });
    expect(!rel.success && rel.errors[0]?.code).toBe('SMOKE_PATH_NOT_ABSOLUTE');
    const pin = await runSmoke({ ...base, binary: '/usr/bin/claude', cliVersion: '9.9.9' });
    expect(!pin.success && pin.errors[0]?.code).toBe('SMOKE_CLI_VERSION');
  });

  it('the demo project is clean against the spec before the agent runs', async () => {
    expect(Object.keys(DEMO_FILES)).toContain('src/infrastructure/system/SystemClock.ts');
    const { finalBlockingFindings, prepareSmokeDirs } = await import('../../../../scripts/v1.3/lib/mcp-smoke.js');
    const layout = prepareSmokeDirs(REPO);
    try {
      expect(await finalBlockingFindings(layout.cwd, layout.specPath)).toEqual([]);
    } finally {
      fs.rmSync(layout.root, { recursive: true, force: true });
    }
  });
});

describe('analyseTranscript', () => {
  it('pairs tool uses with results, reads check_diff verdicts per file, skips junk lines', () => {
    const lines = [
      'not json',
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'mcp__daedalus-arch__check_diff', input: { diff: '...' } }] } }),
      JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: JSON.stringify({ blockingVerdict: 'block', files: [{ path: 'src/a.ts', blockingVerdict: 'block' }, { path: 'src/b.ts', blockingVerdict: 'pass' }] }) }] } }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: '/w/src/a.ts' } }] } }),
      JSON.stringify({ type: 'result', result: 'done' }),
    ].join('\n');
    const t = analyseTranscript(lines, '/w');
    expect(t).toMatchObject({ events: 4, unparsedLines: 1, checkCalls: 1, blockingAnswers: 1, editedAfterBlock: ['src/a.ts'], finalResult: 'done' });
    expect(t.calls[0]?.blockingFiles).toEqual(['src/a.ts']);
    expect(verdictOf(t, []).actedOnBlocking).toBe('yes');
    expect(verdictOf(t, [{ file: 'src/a.ts', rules: ['FF-S01'] }]).actedOnBlocking).toBe('no');
    expect(verdictOf({ ...t, editedAfterBlock: [] }, []).actedOnBlocking).toBe('partly');
  });
});
