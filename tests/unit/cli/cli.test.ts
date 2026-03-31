import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockExecute = jest.fn();
const mockCleanup = jest.fn().mockResolvedValue(undefined);
const mockRequestShutdown = jest.fn();
const mockGetTimings = jest.fn().mockReturnValue({ totalMs: 100, stages: [] });

jest.mock('../../../src/pipeline/pipeline-factory.js', () => ({
  createPipeline: jest.fn().mockReturnValue({
    executor: {
      execute: mockExecute,
      requestShutdown: mockRequestShutdown,
      getTimings: mockGetTimings,
    },
    context: {},
    cleanup: mockCleanup,
  }),
}));

jest.mock('../../../src/scoring-engine/index.js', () => ({
  formatJSON: jest.fn().mockReturnValue('{"mock":"json"}'),
  formatHuman: jest.fn().mockReturnValue('Human readable report'),
  formatCSV: jest.fn().mockReturnValue('csv,row,data'),
  csvHeader: jest.fn().mockReturnValue('csv,header,columns'),
}));

jest.mock('../../../src/cli/batch-runner.js', () => ({
  runBatch: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../src/cli/drift-handler.js', () => ({
  handleDrift: jest.fn().mockResolvedValue(0),
}));

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import { formatJSON, formatHuman, formatCSV } from '../../../src/scoring-engine/index.js';
import { runBatch } from '../../../src/cli/batch-runner.js';
import { handleDrift } from '../../../src/cli/drift-handler.js';

// We need a fresh program for each test to avoid Commander state leaking.
// Clear the require cache to get a fresh module with a new program.
function loadProgram(): Command {
  // Clear cached cli module so Commander creates a fresh program
  const cliPath = require.resolve('../../../src/cli/cli.js');
  delete require.cache[cliPath];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../../../src/cli/cli.js');
  return mod.program as Command;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePassReport() {
  return {
    ahsDeterministic: 0.9,
    ahsCombined: null,
    verdict: 'pass' as const,
    violations: [],
    perDimensionScores: [],
    universalMetrics: {},
    projectPath: '/test',
    specVersion: '1.0.0',
    evaluationMode: 'symbolic-only',
    runId: 'test-run',
    timestamp: new Date().toISOString(),
  };
}

function makeBlockReport() {
  return {
    ...makePassReport(),
    ahsDeterministic: 0.4,
    verdict: 'hard-block' as const,
    violations: [{ id: 'v1', message: 'bad' }],
  };
}

// Capture process.exit / process.exitCode without actually exiting
let exitCodeSpy: jest.SpyInstance;
let stderrSpy: jest.SpyInstance;
let stdoutSpy: jest.SpyInstance;
let processExitSpy: jest.SpyInstance;

let savedEnvKeys: string[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  process.exitCode = undefined;

  // Set a default API key so the LLM key validation doesn't block non-symbolic tests
  process.env['ANTHROPIC_API_KEY'] = 'test-key-for-cli-tests';
  savedEnvKeys = ['ANTHROPIC_API_KEY'];

  stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

  // Prevent Commander from calling process.exit on errors — throw instead
  processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
    throw new Error(`process.exit(${String(code)})`);
  });

  // Default: pipeline succeeds with a pass report
  mockExecute.mockResolvedValue({ success: true, data: makePassReport() });
});

afterEach(() => {
  stderrSpy.mockRestore();
  stdoutSpy.mockRestore();
  processExitSpy.mockRestore();
  // Clean up env vars set during tests
  for (const key of savedEnvKeys) {
    delete process.env[key];
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CLI', () => {
  describe('evaluate command', () => {
    it('parses --project and --spec as required options', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/my/project', '--spec', 'spec.yaml', '--symbolic-only',
      ]);

      expect(createPipeline).toHaveBeenCalledTimes(1);
      const config = (createPipeline as jest.Mock).mock.calls[0][0];
      expect(config.projectPath).toBe('/my/project');
      expect(config.specFilePath).toBe('spec.yaml');
    });

    it('defaults format to human', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml', '--symbolic-only',
      ]);

      // human format writes to stderr
      expect(formatHuman).toHaveBeenCalled();
      expect(formatJSON).not.toHaveBeenCalled();
    });

    it('defaults neo4j-uri to bolt://localhost:7687', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml', '--symbolic-only',
      ]);

      const config = (createPipeline as jest.Mock).mock.calls[0][0];
      expect(config.neo4jUri).toBe('bolt://localhost:7687');
    });

    it('--symbolic-only sets evaluationMode to symbolic-only', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml', '--symbolic-only',
      ]);

      const config = (createPipeline as jest.Mock).mock.calls[0][0];
      expect(config.evaluationMode).toBe('symbolic-only');
    });

    it('--neuronal-only sets evaluationMode to neuronal-only', async () => {
      // Need an API key for neuronal mode
      const origKey = process.env['ANTHROPIC_API_KEY'];
      process.env['ANTHROPIC_API_KEY'] = 'test-key';

      try {
        const program = loadProgram();
        await program.parseAsync([
          'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml', '--neuronal-only',
        ]);

        const config = (createPipeline as jest.Mock).mock.calls[0][0];
        expect(config.evaluationMode).toBe('neuronal-only');
      } finally {
        if (origKey === undefined) delete process.env['ANTHROPIC_API_KEY'];
        else process.env['ANTHROPIC_API_KEY'] = origKey;
      }
    });

    it('--symbolic-only and --neuronal-only together cause error', async () => {
      const program = loadProgram();

      await expect(
        program.parseAsync([
          'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml',
          '--symbolic-only', '--neuronal-only',
        ]),
      ).rejects.toThrow('process.exit(2)');
    });

    it('exit code 0 for pass verdict', async () => {
      mockExecute.mockResolvedValue({ success: true, data: makePassReport() });

      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml',
      ]);

      expect(process.exitCode).toBe(0);
    });

    it('exit code 0 for warning verdict', async () => {
      mockExecute.mockResolvedValue({
        success: true,
        data: { ...makePassReport(), verdict: 'warning' },
      });

      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml',
      ]);

      expect(process.exitCode).toBe(0);
    });

    it('exit code 1 for soft-block verdict', async () => {
      mockExecute.mockResolvedValue({
        success: true,
        data: { ...makePassReport(), verdict: 'soft-block' },
      });

      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml',
      ]);

      expect(process.exitCode).toBe(1);
    });

    it('exit code 1 for hard-block verdict', async () => {
      mockExecute.mockResolvedValue({
        success: true,
        data: makeBlockReport(),
      });

      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml',
      ]);

      expect(process.exitCode).toBe(1);
    });

    it('exit code 2 for pipeline error', async () => {
      mockExecute.mockResolvedValue({
        success: false,
        errors: [{ message: 'pipeline failure' }],
      });

      const program = loadProgram();
      await expect(
        program.parseAsync([
          'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml',
        ]),
      ).rejects.toThrow('process.exit(2)');
    });

    it('JSON format writes to stdout', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml', '--format', 'json',
      ]);

      expect(formatJSON).toHaveBeenCalled();
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('mock'));
    });

    it('human format writes to stderr', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml', '--format', 'human',
      ]);

      expect(formatHuman).toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Human readable'));
    });

    it('calls cleanup after execution', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml',
      ]);

      expect(mockCleanup).toHaveBeenCalledTimes(1);
    });

    it('calls cleanup even when pipeline fails', async () => {
      mockExecute.mockResolvedValue({
        success: false,
        errors: [{ message: 'boom' }],
      });

      const program = loadProgram();
      await expect(
        program.parseAsync([
          'node', 'firewall', 'evaluate', '--project', '/p', '--spec', 's.yaml',
        ]),
      ).rejects.toThrow();

      expect(mockCleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('batch command', () => {
    it('parses --dir and --spec as required options', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'batch', '--dir', '/projects', '--spec', 'spec.yaml',
      ]);

      expect(runBatch).toHaveBeenCalledTimes(1);
      const batchOpts = (runBatch as jest.Mock).mock.calls[0][0];
      expect(batchOpts.dir).toBe('/projects');
      expect(batchOpts.spec).toBe('spec.yaml');
    });

    it('defaults format to csv', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'batch', '--dir', '/projects', '--spec', 'spec.yaml',
      ]);

      const batchOpts = (runBatch as jest.Mock).mock.calls[0][0];
      expect(batchOpts.format).toBe('csv');
    });

    it('passes evaluation mode to runBatch', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'batch', '--dir', '/projects', '--spec', 'spec.yaml', '--symbolic-only',
      ]);

      const evaluationMode = (runBatch as jest.Mock).mock.calls[0][1];
      expect(evaluationMode).toBe('symbolic-only');
    });

    it('sets process.exitCode from runBatch return value', async () => {
      (runBatch as jest.Mock).mockResolvedValue(1);

      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'batch', '--dir', '/projects', '--spec', 'spec.yaml',
      ]);

      expect(process.exitCode).toBe(1);
    });
  });

  describe('drift command', () => {
    it('accepts --from and --to for explicit SHA mode', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'drift', '--from', 'abc123', '--to', 'def456',
      ]);

      expect(handleDrift).toHaveBeenCalledTimes(1);
      const driftOpts = (handleDrift as jest.Mock).mock.calls[0][0];
      expect(driftOpts.from).toBe('abc123');
      expect(driftOpts.to).toBe('def456');
    });

    it('accepts --project and --spec for latest-vs-current mode', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'drift', '--project', '/p', '--spec', 'spec.yaml',
      ]);

      const driftOpts = (handleDrift as jest.Mock).mock.calls[0][0];
      expect(driftOpts.project).toBe('/p');
      expect(driftOpts.spec).toBe('spec.yaml');
    });

    it('defaults format to human', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'drift', '--from', 'a', '--to', 'b',
      ]);

      const driftOpts = (handleDrift as jest.Mock).mock.calls[0][0];
      expect(driftOpts.format).toBe('human');
    });

    it('sets process.exitCode from handleDrift return value', async () => {
      (handleDrift as jest.Mock).mockResolvedValue(1);

      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'drift', '--from', 'a', '--to', 'b',
      ]);

      expect(process.exitCode).toBe(1);
    });

    it('accepts --persist flag', async () => {
      const program = loadProgram();
      await program.parseAsync([
        'node', 'firewall', 'drift', '--from', 'a', '--to', 'b', '--persist',
      ]);

      const driftOpts = (handleDrift as jest.Mock).mock.calls[0][0];
      expect(driftOpts.persist).toBe(true);
    });
  });
});
