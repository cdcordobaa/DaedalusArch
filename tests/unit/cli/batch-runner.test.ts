import { readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { Dirent } from 'node:fs';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExecute = jest.fn();
const mockCleanup = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/pipeline/pipeline-factory.js', () => ({
  createPipeline: jest.fn().mockReturnValue({
    executor: { execute: mockExecute },
    context: {},
    cleanup: mockCleanup,
  }),
}));

jest.mock('node:fs', () => {
  const actual = jest.requireActual('node:fs');
  return {
    ...actual,
    readdirSync: jest.fn(),
    existsSync: jest.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { discoverProjects, runBatch } from '../../../src/cli/batch-runner.js';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { BatchOptions } from '../../../src/pipeline/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockedReaddirSync = readdirSync as jest.MockedFunction<typeof readdirSync>;
const mockedExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

function makeDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    path: '/test',
    parentPath: '/test',
  } as Dirent;
}

function makePassReport(projectPath: string) {
  return {
    ahsDeterministic: 0.9,
    ahsCombined: null,
    verdict: 'pass' as const,
    violations: [],
    perDimensionScores: [],
    universalMetrics: {},
    projectPath,
    specVersion: '1.0.0',
    evaluationMode: 'symbolic-only',
    runId: 'test-run',
    timestamp: new Date().toISOString(),
  };
}

function makeBlockReport(projectPath: string) {
  return {
    ...makePassReport(projectPath),
    ahsDeterministic: 0.4,
    verdict: 'hard-block' as const,
    violations: [{ id: 'v1', message: 'bad' }],
  };
}

const defaultBatchOpts: BatchOptions = {
  dir: '/workspace/projects',
  spec: 'spec.yaml',
  format: 'csv',
  verbose: false,
  neo4jUri: 'bolt://localhost:7687',
  symbolicOnly: true,
  neuronalOnly: false,
};

let stderrSpy: jest.SpyInstance;
let stdoutSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stderrSpy.mockRestore();
  stdoutSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// discoverProjects
// ---------------------------------------------------------------------------

describe('discoverProjects', () => {
  it('finds subdirectories containing tsconfig.json', () => {
    const absDir = resolve('/workspace/projects');

    mockedExistsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path === absDir) return true;
      if (path === join(absDir, 'alpha', 'tsconfig.json')) return true;
      return false;
    });

    mockedReaddirSync.mockReturnValue([
      makeDirent('alpha', true),
    ] as any);

    const result = discoverProjects('/workspace/projects');
    expect(result).toEqual([join(absDir, 'alpha')]);
  });

  it('finds subdirectories containing package.json', () => {
    const absDir = resolve('/workspace/projects');

    mockedExistsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path === absDir) return true;
      if (path === join(absDir, 'beta', 'package.json')) return true;
      return false;
    });

    mockedReaddirSync.mockReturnValue([
      makeDirent('beta', true),
    ] as any);

    const result = discoverProjects('/workspace/projects');
    expect(result).toEqual([join(absDir, 'beta')]);
  });

  it('ignores files (non-directories)', () => {
    const absDir = resolve('/workspace/projects');

    mockedExistsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path === absDir) return true;
      return false;
    });

    mockedReaddirSync.mockReturnValue([
      makeDirent('readme.md', false),
      makeDirent('notes.txt', false),
    ] as any);

    const result = discoverProjects('/workspace/projects');
    expect(result).toEqual([]);
  });

  it('ignores directories without tsconfig.json or package.json', () => {
    const absDir = resolve('/workspace/projects');

    mockedExistsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path === absDir) return true;
      // Neither tsconfig.json nor package.json
      return false;
    });

    mockedReaddirSync.mockReturnValue([
      makeDirent('empty-dir', true),
    ] as any);

    const result = discoverProjects('/workspace/projects');
    expect(result).toEqual([]);
  });

  it('returns sorted alphabetically', () => {
    const absDir = resolve('/workspace/projects');

    mockedExistsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path === absDir) return true;
      if (path.endsWith('tsconfig.json')) return true;
      return false;
    });

    mockedReaddirSync.mockReturnValue([
      makeDirent('charlie', true),
      makeDirent('alpha', true),
      makeDirent('bravo', true),
    ] as any);

    const result = discoverProjects('/workspace/projects');
    expect(result).toEqual([
      join(absDir, 'alpha'),
      join(absDir, 'bravo'),
      join(absDir, 'charlie'),
    ]);
  });

  it('throws for non-existent directory', () => {
    mockedExistsSync.mockReturnValue(false);

    expect(() => discoverProjects('/nonexistent')).toThrow('Directory not found');
  });

  it('returns empty array for empty directory', () => {
    const absDir = resolve('/workspace/projects');

    mockedExistsSync.mockImplementation((p: any) => {
      return String(p) === absDir;
    });

    mockedReaddirSync.mockReturnValue([] as any);

    const result = discoverProjects('/workspace/projects');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// runBatch
// ---------------------------------------------------------------------------

describe('runBatch', () => {
  // Helper: set up discoverProjects to find N projects
  function setupProjects(names: string[]) {
    const absDir = resolve(defaultBatchOpts.dir);

    mockedExistsSync.mockImplementation((p: any) => {
      const path = String(p);
      if (path === absDir) return true;
      if (path.endsWith('tsconfig.json')) return true;
      return false;
    });

    mockedReaddirSync.mockReturnValue(
      names.map((n) => makeDirent(n, true)) as any,
    );
  }

  it('runs each project sequentially', async () => {
    setupProjects(['proj-a', 'proj-b']);
    mockExecute.mockResolvedValue({ success: true, data: makePassReport('/p') });

    await runBatch(defaultBatchOpts, 'symbolic-only');

    expect(createPipeline).toHaveBeenCalledTimes(2);
  });

  it('creates fresh pipeline per project', async () => {
    setupProjects(['proj-a', 'proj-b']);
    mockExecute.mockResolvedValue({ success: true, data: makePassReport('/p') });

    await runBatch(defaultBatchOpts, 'symbolic-only');

    const calls = (createPipeline as jest.Mock).mock.calls;
    expect(calls[0][0].projectPath).toContain('proj-a');
    expect(calls[1][0].projectPath).toContain('proj-b');
  });

  it('accumulates success rows', async () => {
    setupProjects(['proj-a', 'proj-b']);
    mockExecute.mockResolvedValue({ success: true, data: makePassReport('/p') });

    const exitCode = await runBatch(defaultBatchOpts, 'symbolic-only');
    expect(exitCode).toBe(0);

    // CSV output: 1 header line + 2 data lines = 3 writes (plus summary to stderr)
    const csvWrites = stdoutSpy.mock.calls.map((c: any[]) => String(c[0]));
    expect(csvWrites.length).toBe(3); // header + 2 rows
  });

  it('accumulates error rows for failed projects', async () => {
    setupProjects(['proj-a']);
    mockExecute.mockResolvedValue({
      success: false,
      errors: [{ message: 'spec parse error' }],
    });

    const exitCode = await runBatch(defaultBatchOpts, 'symbolic-only');
    expect(exitCode).toBe(2);
  });

  it('catches thrown exceptions as error rows', async () => {
    setupProjects(['proj-a']);
    mockExecute.mockRejectedValue(new Error('unexpected boom'));

    const exitCode = await runBatch(defaultBatchOpts, 'symbolic-only');
    expect(exitCode).toBe(2);
  });

  it('CSV output format includes header', async () => {
    setupProjects(['proj-a']);
    mockExecute.mockResolvedValue({ success: true, data: makePassReport('/p') });

    await runBatch(defaultBatchOpts, 'symbolic-only');

    const firstWrite = String(stdoutSpy.mock.calls[0][0]);
    expect(firstWrite).toContain('project,ahs_deterministic');
  });

  it('JSON output format produces valid JSON', async () => {
    setupProjects(['proj-a']);
    mockExecute.mockResolvedValue({ success: true, data: makePassReport('/p') });

    const jsonOpts: BatchOptions = { ...defaultBatchOpts, format: 'json' };
    await runBatch(jsonOpts, 'symbolic-only');

    const output = stdoutSpy.mock.calls.map((c: any[]) => String(c[0])).join('');
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed.totalProjects).toBe(1);
    expect(parsed.rows).toHaveLength(1);
  });

  it('exit code 0 when all pass', async () => {
    setupProjects(['proj-a', 'proj-b']);
    mockExecute.mockResolvedValue({ success: true, data: makePassReport('/p') });

    const exitCode = await runBatch(defaultBatchOpts, 'symbolic-only');
    expect(exitCode).toBe(0);
  });

  it('exit code 1 when any violations', async () => {
    setupProjects(['proj-a', 'proj-b']);
    mockExecute
      .mockResolvedValueOnce({ success: true, data: makePassReport('/p') })
      .mockResolvedValueOnce({ success: true, data: makeBlockReport('/p2') });

    const exitCode = await runBatch(defaultBatchOpts, 'symbolic-only');
    expect(exitCode).toBe(1);
  });

  it('exit code 2 when any errors', async () => {
    setupProjects(['proj-a', 'proj-b']);
    mockExecute
      .mockResolvedValueOnce({ success: true, data: makePassReport('/p') })
      .mockResolvedValueOnce({
        success: false,
        errors: [{ message: 'crash' }],
      });

    const exitCode = await runBatch(defaultBatchOpts, 'symbolic-only');
    expect(exitCode).toBe(2);
  });

  it('calls cleanup after each project', async () => {
    setupProjects(['proj-a', 'proj-b']);
    mockExecute.mockResolvedValue({ success: true, data: makePassReport('/p') });

    await runBatch(defaultBatchOpts, 'symbolic-only');

    expect(mockCleanup).toHaveBeenCalledTimes(2);
  });

  it('returns exit code 2 when no projects found', async () => {
    setupProjects([]);

    const exitCode = await runBatch(defaultBatchOpts, 'symbolic-only');
    expect(exitCode).toBe(2);
  });
});
