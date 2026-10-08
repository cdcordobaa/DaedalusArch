// Pins the CLI LLM configuration hunks of U0 Step 24 (D-U0-15): the `evaluate` and `report`
// commands must hand the pipeline the same key (HEAD expression, D-U0-8) and write the API-key
// warning in exactly the cases they wrote it before `LLMConfig` was replaced by `LLMProviderConfig`.

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

const WARNING = 'Warning: No GEMINI_API_KEY set. Neuronal functions will be skipped (symbolic-only fallback).\n';
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

async function captureConfig(command: Command_, mode: Mode): Promise<PipelineConfig> {
  const program = loadProgram();
  await expect(program.parseAsync([
    'node', 'firewall', command, '--project', '/p', '--spec', 's.yaml', ...modeFlags(mode),
  ])).rejects.toBeInstanceOf(StopAfterConfig);
  const mock = createPipeline as jest.Mock;
  expect(mock).toHaveBeenCalledTimes(1);
  return (mock.mock.calls[0] as [PipelineConfig])[0];
}

// The LLM configuration the CLI builds for a non-symbolic run with the given key.
function expectedLlmConfig(apiKey: string): unknown {
  return {
    provider: 'gemini',
    gemini: { apiKey, model: 'gemini-2.0-flash', temperature: 0, maxTokens: 4096 },
    cassette: { mode: 'record', dir: 'fixtures/cassettes' },
  };
}

let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
let stderrSpy: jest.SpyInstance;

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

const KEY_CASES: readonly { label: string; env: Partial<Record<(typeof ENV_KEYS)[number], string>>; apiKey: string; warns: boolean }[] = [
  { label: 'GEMINI_API_KEY set', env: { GEMINI_API_KEY: 'gemini-test-key' }, apiKey: 'gemini-test-key', warns: false },
  { label: 'only ANTHROPIC_API_KEY set', env: { ANTHROPIC_API_KEY: 'anthropic-test-key' }, apiKey: 'anthropic-test-key', warns: false },
  { label: 'both set (Gemini wins)', env: { GEMINI_API_KEY: 'gemini-test-key', ANTHROPIC_API_KEY: 'anthropic-test-key' }, apiKey: 'gemini-test-key', warns: false },
  { label: 'GEMINI_API_KEY empty, ANTHROPIC_API_KEY set (?? keeps the empty string)', env: { GEMINI_API_KEY: '', ANTHROPIC_API_KEY: 'anthropic-test-key' }, apiKey: '', warns: true },
  { label: 'neither set', env: {}, apiKey: '', warns: true },
];

describe.each<Command_>(['evaluate', 'report'])('%s command LLM configuration', (command) => {
  describe.each<Mode>(['full', 'neuronal-only'])('%s mode', (mode) => {
    it.each(KEY_CASES)('$label', async ({ env, apiKey, warns }) => {
      Object.assign(process.env, env);

      const config = await captureConfig(command, mode);

      expect(config.evaluationMode).toBe(mode);
      expect(config.llmConfig).toEqual(expectedLlmConfig(apiKey));
      if (warns) {
        expect(stderrText()).toContain(WARNING);
      } else {
        expect(stderrText()).not.toContain('No GEMINI_API_KEY');
      }
    });
  });

  it('symbolic-only builds no LLM configuration and writes no warning (no key)', async () => {
    const config = await captureConfig(command, 'symbolic-only');

    expect(config.llmConfig).toBeUndefined();
    expect(stderrText()).not.toContain('No GEMINI_API_KEY');
  });

  it('symbolic-only builds no LLM configuration with a key set', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';

    const config = await captureConfig(command, 'symbolic-only');

    expect(config.llmConfig).toBeUndefined();
    expect(stderrText()).not.toContain('No GEMINI_API_KEY');
  });
});

describe('GEMINI_MODEL', () => {
  it('is carried into the Gemini model when set', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    process.env.GEMINI_MODEL = 'gemini-test-model';

    const config = await captureConfig('evaluate', 'full');

    expect(config.llmConfig).toEqual({
      provider: 'gemini',
      gemini: { apiKey: 'gemini-test-key', model: 'gemini-test-model', temperature: 0, maxTokens: 4096 },
      cassette: { mode: 'record', dir: 'fixtures/cassettes' },
    });
  });
});
