/**
 * U3-R12 (FR-16 reduced; BR-U3-82, 83): batch mode guard and rows from the assembled report.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';

const mockExecute = jest.fn();

jest.mock('../../../src/pipeline/pipeline-factory.js', () => ({
  createPipeline: jest.fn(() => ({
    executor: { execute: mockExecute },
    cleanup: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock('dotenv', () => ({ config: jest.fn() }));

import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import { BATCH_MODE_UNSUPPORTED, BATCH_MODE_UNSUPPORTED_MESSAGE, runBatch } from '../../../src/cli/batch-runner.js';
import type { BatchOptions, PipelineConfig } from '../../../src/pipeline/types.js';

function loadProgram(): Command {
  const cliPath = require.resolve('../../../src/cli/cli.js');
  Reflect.deleteProperty(require.cache, cliPath);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../../src/cli/cli.js') as { program: Command }).program;
}

const report = {
  ahsDeterministic: 0.5,
  verdict: 'soft-block',
  violations: [{ id: 'v-0000000000000001', functionId: 'FF-S01', filePath: 'src/a.ts' }],
  perDimensionScores: [{ dimension: 'structural', score: 0.5 }],
  functionExecution: { compiled: 23, executed: 22, failed: [{ functionId: 'FF-C01', code: 'EVAL_001', message: 'x' }], skippedByMode: 0 },
  droppedDimensions: [{ dimension: 'semantic', reason: 'not in mode' }],
};

describe('batch (FR-16 reduced)', () => {
  let dir: string;
  const saved = process.env.NEO4J_PASSWORD;
  let out: string[];
  let err: string[];
  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u3-r12-batch-'));
    for (const p of ['p1', 'p2']) {
      fs.mkdirSync(path.join(dir, p));
      fs.writeFileSync(path.join(dir, p, 'tsconfig.json'), '{}');
    }
  });
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (saved === undefined) delete process.env.NEO4J_PASSWORD;
    else process.env.NEO4J_PASSWORD = saved;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEO4J_PASSWORD = ['u3', 'batch', 'mode', 'pw'].join('-');
    process.exitCode = undefined;
    out = [];
    err = [];
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((c: string | Uint8Array) => { out.push(String(c)); return true; });
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation((c: string | Uint8Array) => { err.push(String(c)); return true; });
    mockExecute.mockResolvedValue({ success: true, data: report });
  });
  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = undefined;
  });

  const opts = (): BatchOptions => ({ dir, spec: 'spec.yaml', format: 'json', verbose: false, neo4jUri: 'bolt://localhost:7687', symbolicOnly: false, neuronalOnly: false });

  it.each(['full', 'neuronal-only'] as const)('BR-U3-82: %s mode exits 2 before any project runs (no pipeline)', async (mode) => {
    expect(await runBatch(opts(), mode)).toBe(2);
    expect(createPipeline).not.toHaveBeenCalled();
    expect(err.join('')).toContain(`Error [${BATCH_MODE_UNSUPPORTED}]: ${BATCH_MODE_UNSUPPORTED_MESSAGE}`);
    expect(out).toEqual([]);
  });

  it('BR-U3-82: `batch --neuronal-only` exits 2 through the CLI; no flag runs symbolic-only', async () => {
    await loadProgram().parseAsync(['node', 'firewall', 'batch', '--dir', dir, '--spec', 'spec.yaml', '--neuronal-only']);
    expect(process.exitCode).toBe(2);
    expect(createPipeline).not.toHaveBeenCalled();
    await loadProgram().parseAsync(['node', 'firewall', 'batch', '--dir', dir, '--spec', 'spec.yaml', '--format', 'json']);
    expect(createPipeline).toHaveBeenCalledTimes(2);
  });

  it('BR-U3-81: every project config is symbolic-only without an LLM configuration', async () => {
    await runBatch(opts(), 'symbolic-only');
    const configs = (createPipeline as jest.Mock).mock.calls.map((c: unknown[]) => c[0] as PipelineConfig);
    expect(configs.map((c) => [c.evaluationMode, 'llmConfig' in c])).toEqual([['symbolic-only', false], ['symbolic-only', false]]);
  });

  it('BR-U3-83: JSON rows carry violations, perDimensionScores, functionExecution, droppedDimensions from the report', async () => {
    await runBatch(opts(), 'symbolic-only');
    const parsed = JSON.parse(out.join('')) as { rows: Record<string, unknown>[] };
    expect(parsed.rows).toHaveLength(2);
    for (const row of parsed.rows) {
      expect(row).toMatchObject({
        verdict: 'soft-block', ahsDeterministic: 0.5, ahsCombined: null, violationCount: 1,
        violations: report.violations, perDimensionScores: report.perDimensionScores,
        functionExecution: report.functionExecution, droppedDimensions: report.droppedDimensions,
      });
    }
  });

  it('BR-U3-83: an error row has a scrubbed error and none of the four report fields', async () => {
    const pw = process.env.NEO4J_PASSWORD ?? '';
    mockExecute.mockResolvedValue({ success: false, errors: [{ message: `auth failed for ${pw}` }] });
    await runBatch(opts(), 'symbolic-only');
    const parsed = JSON.parse(out.join('')) as { rows: Record<string, unknown>[] };
    for (const row of parsed.rows) {
      expect(row.verdict).toBe('ERROR');
      expect(String(row.error)).not.toContain(pw);
      expect(['violations', 'perDimensionScores', 'functionExecution', 'droppedDimensions'].filter((k) => k in row)).toEqual([]);
    }
  });
});
