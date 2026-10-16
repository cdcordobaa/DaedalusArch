import { Command } from 'commander';

const mockExecute = jest.fn();
jest.mock('../../../src/pipeline/pipeline-factory.js', () => ({
  createPipeline: jest.fn().mockImplementation(() => ({
    executor: { execute: mockExecute, requestShutdown: jest.fn(), getTimings: jest.fn().mockReturnValue({ totalMs: 1, stages: [] }) },
    context: {},
    cleanup: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../../../src/scoring-engine/index.js', () => ({
  formatJSON: jest.fn().mockImplementation((r: unknown) => JSON.stringify(r)),
  formatHuman: jest.fn().mockReturnValue('Human readable report'),
  formatCSV: jest.fn().mockReturnValue('csv,row'),
  csvHeader: jest.fn().mockReturnValue('csv,header'),
}));

const mockDispose = jest.fn();
jest.mock('../../../src/cli/init-command.js', () => {
  const actual = jest.requireActual('../../../src/cli/init-command.js');
  return {
    ...actual,
    inferredSpecFile: jest.fn().mockImplementation(() =>
      Promise.resolve({
        specPath: '/tmp/firewall-inferred-x/inferred.spec.yaml',
        dispose: mockDispose,
        proposal: { label: 'inferred spec, not author-declared', style: 'layered', styleConfidence: 1, mappings: [], questions: [], unassignedFiles: [] },
      }),
    ),
  };
});

import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import { inferredSpecFile } from '../../../src/cli/init-command.js';

function loadProgram(): Command {
  const cliPath = require.resolve('../../../src/cli/cli.js');
  delete require.cache[cliPath];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../../src/cli/cli.js') as { program: Command }).program;
}

const report = { runId: 'r', verdict: 'pass', ahsDeterministic: 1, violations: [], functionResults: [], dimensionScores: [] };

describe('evaluate --from-inferred', () => {
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;
  const savedPw = process.env['NEO4J_PASSWORD'];
  beforeEach(() => {
    jest.clearAllMocks();
    process.env['NEO4J_PASSWORD'] = 'pw-for-tests';
    process.exitCode = undefined;
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockExecute.mockResolvedValue({ success: true, data: report });
  });
  afterEach(() => {
    stdout.mockRestore();
    stderr.mockRestore();
    if (savedPw === undefined) delete process.env['NEO4J_PASSWORD'];
    else process.env['NEO4J_PASSWORD'] = savedPw;
    process.exitCode = undefined;
  });

  it('evaluates under the inferred spec file and labels the JSON report', async () => {
    await loadProgram().parseAsync(['node', 'firewall', 'evaluate', '--project', '/p', '--from-inferred', '--symbolic-only', '--format', 'json']);
    expect(inferredSpecFile).toHaveBeenCalledWith('/p', expect.any(Function));
    expect((createPipeline as jest.Mock).mock.calls[0][0].specFilePath).toBe('/tmp/firewall-inferred-x/inferred.spec.yaml');
    const json = JSON.parse(stdout.mock.calls.map((c) => String(c[0])).join('')) as { specSource: { label: string } };
    expect(json.specSource.label).toBe('inferred spec, not author-declared');
    expect(stderr.mock.calls.map((c) => String(c[0])).join('')).toMatch(/INFERRED SPEC, NOT AUTHOR-DECLARED/);
    expect(mockDispose).toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
  });

  it('labels the human report', async () => {
    await loadProgram().parseAsync(['node', 'firewall', 'evaluate', '--project', '/p', '--from-inferred', '--symbolic-only']);
    const err = stderr.mock.calls.map((c) => String(c[0])).join('');
    expect(err.match(/INFERRED SPEC, NOT AUTHOR-DECLARED/g)?.length).toBe(2);
  });

  it('rejects --spec together with --from-inferred, and still requires --spec without it', async () => {
    await loadProgram().parseAsync(['node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml', '--from-inferred', '--symbolic-only']);
    expect(process.exitCode).toBe(2);
    expect(createPipeline).not.toHaveBeenCalled();
    const program = loadProgram();
    const evaluate = program.commands.find((c) => c.name() === 'evaluate');
    evaluate?.exitOverride();
    await expect(program.parseAsync(['node', 'firewall', 'evaluate', '--project', '/p', '--symbolic-only'])).rejects.toThrow(/required option '--spec <path>' not specified/);
    expect(createPipeline).not.toHaveBeenCalled();
  });

  it('the default evaluate path does not infer', async () => {
    await loadProgram().parseAsync(['node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml', '--symbolic-only', '--format', 'json']);
    expect(inferredSpecFile).not.toHaveBeenCalled();
    expect(stdout.mock.calls.map((c) => String(c[0])).join('')).not.toMatch(/specSource/);
  });
});
