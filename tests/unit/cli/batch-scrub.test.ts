/**
 * U3-R11 (TF-17, BR-U3-58): a batch error row never carries the Neo4j password or the resolved
 * address, in both the JSON and the CSV output.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const PW = ['tf17', 'Batch', 'Secret', '7'].join('-');

jest.mock('../../../src/pipeline/pipeline-factory.js', () => ({
  createPipeline: jest.fn(() => ({
    executor: {
      execute: jest.fn(() => Promise.resolve({
        success: false,
        errors: [{ code: 'ServiceUnavailable', message: `connect bolt://neo4j:${PW}@127.0.0.1:7687 refused (password ${PW})`, stage: 'ingest-apg', critical: true }],
      })),
    },
    cleanup: jest.fn(() => Promise.resolve()),
  })),
}));

import { runBatch, scrubBatchError } from '../../../src/cli/batch-runner.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';

describe('batch error rows are scrubbed (TF-17)', () => {
  let dir: string;
  const saved = process.env.NEO4J_PASSWORD;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u3-r11-batch-'));
    fs.mkdirSync(path.join(dir, 'p1'));
    fs.writeFileSync(path.join(dir, 'p1', 'package.json'), '{}');
    process.env.NEO4J_PASSWORD = PW;
  });
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    if (saved === undefined) delete process.env.NEO4J_PASSWORD;
    else process.env.NEO4J_PASSWORD = saved;
  });

  it.each(['json', 'csv'] as const)('%s output', async (format) => {
    const out: string[] = [];
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => { out.push(String(chunk)); return true; });
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await runBatch({ dir, spec: 'spec.yaml', format, verbose: false, neo4jUri: 'bolt://localhost:7687', symbolicOnly: true, neuronalOnly: false }, 'symbolic-only');
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
    const text = out.join('');
    expect(text).toContain('ERROR');
    expect([PW, '127.0.0.1:7687'].filter((s) => text.includes(s))).toEqual([]);
  });

  it('scrubBatchError uses the run policy of the project config', () => {
    const config = { neo4jUri: 'bolt://localhost:7687', neo4jUser: 'neo4j', neo4jPassword: PW } as PipelineConfig;
    expect(scrubBatchError(`x ${PW} 127.0.0.1:7687`, config)).toBe('x [REDACTED] [REDACTED]');
  });
});
