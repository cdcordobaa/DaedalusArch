// Pins the CLI LLM configuration of the `evaluate` and `report` commands. U0 Step 24 (D-U0-15)
// pinned the HEAD key expression; U4's C9 hunk (U4 plan Step 25, D-U4-7; D-U0-8; BR-U4-ISO-01)
// replaces it with `parseLLMOptions`: claude-cli by default, no Anthropic key read anywhere,
// Gemini only with `--llm-model` and `GEMINI_API_KEY`, and a configuration error exits 2 before
// the pipeline is built.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { Command } from 'commander';

class StopAfterConfig extends Error {}

jest.mock('../../../src/pipeline/pipeline-factory.js', () => ({
  createPipeline: jest.fn(() => {
    throw new StopAfterConfig('config captured');
  }),
}));

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';

const ENV_KEYS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_MODEL', 'NEO4J_PASSWORD'] as const;

type Command_ = 'evaluate' | 'report';
type Mode = 'full' | 'neuronal-only' | 'symbolic-only';

function loadProgram(): Command {
  const cliPath = require.resolve('../../../src/cli/cli.js');
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete require.cache[cliPath];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../../../src/cli/cli.js') as { program: Command };
  return mod.program;
}

function modeFlags(mode: Mode): string[] {
  if (mode === 'symbolic-only') return ['--symbolic-only'];
  if (mode === 'neuronal-only') return ['--neuronal-only'];
  return [];
}

// A judge config dir outside every repository and the evaluated project (ISO-04 placement check).
const JUDGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-c9-judge-'));
afterAll(() => { fs.rmSync(JUDGE_DIR, { recursive: true, force: true }); });

async function captureConfig(command: Command_, mode: Mode, extra: string[] = []): Promise<PipelineConfig> {
  const program = loadProgram();
  await expect(program.parseAsync([
    'node', 'firewall', command, '--project', '/p', '--spec', 's.yaml', ...modeFlags(mode), '--judge-config-dir', JUDGE_DIR, ...extra,
  ])).rejects.toBeInstanceOf(StopAfterConfig);
  const mock = createPipeline as jest.Mock;
  expect(mock).toHaveBeenCalledTimes(1);
  return (mock.mock.calls[0] as [PipelineConfig])[0];
}

let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
let stderrSpy: jest.SpyInstance;
const savedExitCode = process.exitCode;

function stderrText(): string {
  return stderrSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
}

beforeEach(() => {
  jest.clearAllMocks();
  savedEnv = {};
  for (const k of ENV_KEYS) {
    const v = process.env[k];
    if (v !== undefined) savedEnv[k] = v;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env[k];
  }
  // BR-U3-80: no default password; the commands need one set (restored with ENV_KEYS).
  process.env.NEO4J_PASSWORD = 'test-password-for-cli-tests';
  stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stderrSpy.mockRestore();
  process.exitCode = savedExitCode;
  for (const k of ENV_KEYS) {
    const v = savedEnv[k];
    if (v === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
});

/** A configuration error: reported on stderr, exit code 2, the pipeline never built. */
async function expectConfigError(command: Command_, mode: Mode, extra: string[]): Promise<void> {
  const program = loadProgram();
  await program.parseAsync(['node', 'firewall', command, '--project', '/p', '--spec', 's.yaml', ...modeFlags(mode), '--judge-config-dir', JUDGE_DIR, ...extra]);
  expect(createPipeline as jest.Mock).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(2);
  expect(stderrText()).toContain('Error: ');
}

const KEY_ENVS: readonly { label: string; env: Partial<Record<(typeof ENV_KEYS)[number], string>> }[] = [
  { label: 'GEMINI_API_KEY set', env: { GEMINI_API_KEY: 'gemini-test-key' } },
  { label: 'only ANTHROPIC_API_KEY set', env: { ANTHROPIC_API_KEY: 'anthropic-test-key' } },
  { label: 'neither set', env: {} },
];

describe.each<Command_>(['evaluate', 'report'])('%s command LLM configuration (U4 C9 hunk)', (command) => {
  describe.each<Mode>(['full', 'neuronal-only'])('%s mode', (mode) => {
    it.each(KEY_ENVS)('defaults to the claude-cli judge whatever the keys ($label), no key read, no warning', async ({ env }) => {
      Object.assign(process.env, env);
      const config = await captureConfig(command, mode);
      expect(config.evaluationMode).toBe(mode);
      expect(config.llmConfig).toEqual(expect.objectContaining({
        provider: 'claude-cli',
        cassette: { mode: 'record', dir: './.firewall/cassettes' },
        judgeConfigDir: path.resolve(JUDGE_DIR),
        run: expect.objectContaining({ llm: { model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 }, repetition: 0 }) as unknown,
      }));
      expect(JSON.stringify(config.llmConfig)).not.toContain('test-key');
      expect(stderrText()).not.toContain('GEMINI_API_KEY');
    });

    it('ISO-01 b: --llm-provider gemini with only ANTHROPIC_API_KEY is a configuration error (exit 2)', async () => {
      process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
      await expectConfigError(command, mode, ['--llm-provider', 'gemini', '--llm-model', 'gemini-pinned']);
    });
  });

  it('gemini with --llm-model and GEMINI_API_KEY builds the pinned Gemini configuration', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    process.env.GEMINI_MODEL = 'ignored-model';
    const config = await captureConfig(command, 'full', ['--llm-provider', 'gemini', '--llm-model', 'gemini-pinned']);
    expect(config.llmConfig).toEqual(expect.objectContaining({
      provider: 'gemini',
      gemini: { apiKey: 'gemini-test-key', model: 'gemini-pinned', temperature: 0, maxTokens: 8192 },
    }));
  });

  it('VRD-09: gemini without --llm-model is a configuration error (exit 2)', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    await expectConfigError(command, 'full', ['--llm-provider', 'gemini']);
  });

  it('a bypass cassette mode is a configuration error (exit 2)', async () => {
    await expectConfigError(command, 'full', ['--cassette-mode', 'bypass']);
  });

  it('the judge options reach the run settings', async () => {
    const config = await captureConfig(command, 'full', [
      '--llm-provider', 'mock', '--cassette-mode', 'replay', '--cassette-dir', 'tests/fixtures/judge-cassettes/x',
      '--judge-repetition', '2', '--judge-baseline-report', 'base.json', '--cassette-omit-prompt',
    ]);
    expect(config.llmConfig).toEqual(expect.objectContaining({
      provider: 'mock',
      cassette: { mode: 'replay', dir: 'tests/fixtures/judge-cassettes/x' },
      run: expect.objectContaining({ repetition: 2, baselineReport: 'base.json', cassette: { mode: 'replay', dir: 'tests/fixtures/judge-cassettes/x', omitPrompt: true } }) as unknown,
    }));
  });

  it('symbolic-only builds no LLM configuration and writes no warning', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    const config = await captureConfig(command, 'symbolic-only');
    expect(config.llmConfig).toBeUndefined();
    expect(stderrText()).not.toContain('GEMINI_API_KEY');
  });
});

describe('BR-U4-ISO-01 (c): the CLI reads no Anthropic key and no default Gemini id', () => {
  it('src/cli/cli.ts holds no ANTHROPIC_API_KEY, gemini-2.0-flash or GEMINI_MODEL', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../src/cli/cli.ts'), 'utf8');
    expect(source).not.toContain('ANTHROPIC_API_KEY');
    expect(source).not.toContain('gemini-2.0-flash');
    expect(source).not.toContain('GEMINI_MODEL');
  });
});
