/**
 * U3-R12 (D-U0-8; BR-U3-80, 81; TF-20): no default Neo4j password anywhere in the CLI, and batch
 * builds no LLM provider.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';

jest.mock('../../../src/pipeline/pipeline-factory.js', () => ({
  createPipeline: jest.fn(() => {
    throw new Error('createPipeline must not be reached without NEO4J_PASSWORD');
  }),
}));

jest.mock('dotenv', () => ({ config: jest.fn() }));

import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import { CONFIG_MISSING_ENV, MissingEnvError, requireEnv } from '../../../src/cli/require-env.js';

function loadProgram(): Command {
  const cliPath = require.resolve('../../../src/cli/cli.js');
  Reflect.deleteProperty(require.cache, cliPath);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../../src/cli/cli.js') as { program: Command }).program;
}

describe('requireEnv (BR-U3-80)', () => {
  it('returns a set value', () => {
    expect(requireEnv('X_U3', { X_U3: 'value' })).toBe('value');
  });

  it.each([['unset', {}], ['empty', { X_U3: '' }]] as const)('%s → MissingEnvError with CONFIG_MISSING_ENV', (_label, env) => {
    let caught: unknown;
    try {
      requireEnv('X_U3', env);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MissingEnvError);
    expect({ code: (caught as MissingEnvError).code, message: (caught as MissingEnvError).message }).toEqual({ code: CONFIG_MISSING_ENV, message: 'X_U3 is not set' });
  });
});

describe('TF-20: NEO4J_PASSWORD unset across the CLI commands', () => {
  const saved = process.env.NEO4J_PASSWORD;
  let stderr: string[];
  let stderrSpy: jest.SpyInstance;
  let stdoutSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEO4J_PASSWORD;
    process.exitCode = undefined;
    stderr = [];
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => { stderr.push(String(chunk)); return true; });
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => { throw new Error(`process.exit(${String(code)})`); });
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
    exitSpy.mockRestore();
    process.exitCode = undefined;
    if (saved === undefined) delete process.env.NEO4J_PASSWORD;
    else process.env.NEO4J_PASSWORD = saved;
  });

  it.each([
    ['evaluate', ['evaluate', '--project', '/p', '--spec', 's.yaml', '--symbolic-only']],
    ['report', ['report', '--project', '/p', '--spec', 's.yaml', '--symbolic-only']],
    ['baseline', ['baseline', '--project', '/p', '--spec', 's.yaml']],
    ['drift (latest vs current)', ['drift', '--project', '/p', '--spec', 's.yaml']],
    ['batch', ['batch', '--dir', '/nonexistent-u3-dir', '--spec', 's.yaml', '--format', 'json']],
    ['empty password (evaluate)', ['evaluate', '--project', '/p', '--spec', 's.yaml', '--symbolic-only']],
  ])('%s exits non-zero with CONFIG_MISSING_ENV before any pipeline', async (label, args) => {
    if (label.startsWith('empty')) process.env.NEO4J_PASSWORD = '';
    await loadProgram().parseAsync(['node', 'firewall', ...args]);
    expect(process.exitCode).toBe(2);
    expect(stderr.join('')).toContain(`Error [${CONFIG_MISSING_ENV}]: NEO4J_PASSWORD is not set`);
    expect(createPipeline).not.toHaveBeenCalled();
  });
});

describe('static (BR-U3-80, BR-U3-81; FR-16 acceptance)', () => {
  const cliDir = path.join(__dirname, '../../../src/cli');
  const sources = fs.readdirSync(cliDir).filter((f) => f.endsWith('.ts')).map((f) => [f, fs.readFileSync(path.join(cliDir, f), 'utf8')] as const);

  it("no `?? 'neo4j'` password fallback and no `??`/`||` after a NEO4J_PASSWORD read in src/cli", () => {
    const hits = sources.flatMap(([f, text]) => text.split('\n').map((line, i) => [f, i + 1, line] as const))
      .filter(([, , line]) => /NEO4J_PASSWORD'?\]?\s*(\?\?|\|\|)/.test(line) || /neo4jPassword:.*\?\?\s*'neo4j'/.test(line));
    expect(hits).toEqual([]);
  });

  it('every NEO4J_PASSWORD read in src/cli goes through requireEnv', () => {
    const reads = sources.flatMap(([f, text]) => text.split('\n').filter((line) => line.includes("'NEO4J_PASSWORD'")).map((line) => [f, line.trim()] as const));
    expect(reads.length).toBeGreaterThanOrEqual(5);
    expect(reads.filter(([, line]) => !/requireEnv(ForCli)?\('NEO4J_PASSWORD'\)/.test(line))).toEqual([]);
    expect(sources.flatMap(([f, text]) => (/process\.env(\.NEO4J_PASSWORD|\[['"]NEO4J_PASSWORD['"]\])/.test(text) ? [f] : []))).toEqual([]);
  });

  it('batch-runner.ts names no LLM_PROVIDER, no ANTHROPIC/OPENAI key and builds no llmConfig', () => {
    const text = sources.find(([f]) => f === 'batch-runner.ts')?.[1] ?? '';
    expect(['LLM_PROVIDER', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'llmConfig', 'GEMINI'].filter((s) => text.includes(s))).toEqual([]);
  });
});
