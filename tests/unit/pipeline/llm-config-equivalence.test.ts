// U0 Step 24 (D-U0-15): `PipelineConfig.llmConfig` is now an `LLMProviderConfig` passed straight to
// `createLLMProvider`. The provider the pipeline builds must equal the one built at HEAD, where the
// factory always wrapped `{ apiKey }` as
// `{ provider: 'gemini', gemini: { apiKey, model: GEMINI_MODEL ?? 'gemini-2.0-flash', temperature: 0, maxTokens: 4096 } }`.

import type { PipelineConfig } from '../../../src/pipeline/types.js';
import type { LLMProvider } from '../../../src/shared/interfaces/llm-provider.js';
import type { LLMProviderConfig } from '../../../src/shared/types/llm-config.js';

jest.mock('../../../src/neo4j-ingestion/neo4j-repository.js', () => ({
  Neo4jRepository: jest.fn().mockImplementation(() => ({
    executeQuery: jest.fn(),
    clearGraph: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/neo4j-ingestion/fs-snapshot-store.js', () => ({
  FileSystemSnapshotStore: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../src/llm-critic/provider-factory.js', () => {
  const actual = jest.requireActual<typeof import('../../../src/llm-critic/provider-factory.js')>(
    '../../../src/llm-critic/provider-factory.js',
  );
  return { createLLMProvider: jest.fn(actual.createLLMProvider) };
});

import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import { createLLMProvider } from '../../../src/llm-critic/provider-factory.js';
import { GeminiProvider } from '../../../src/llm-critic/gemini-provider.js';
import { NullLLMProvider } from '../../../src/llm-critic/null-provider.js';

const factory = createLLMProvider as jest.MockedFunction<typeof createLLMProvider>;
const realFactory = jest.requireActual<typeof import('../../../src/llm-critic/provider-factory.js')>(
  '../../../src/llm-critic/provider-factory.js',
).createLLMProvider;

const ENV_KEYS = ['GEMINI_API_KEY', 'GEMINI_MODEL'] as const;
let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

beforeEach(() => {
  jest.clearAllMocks();
  savedEnv = {};
  for (const k of ENV_KEYS) {
    const v = process.env[k];
    if (v !== undefined) savedEnv[k] = v;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env[k];
  }
});

afterEach(() => {
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

function pipelineConfig(evaluationMode: PipelineConfig['evaluationMode'], llmConfig?: LLMProviderConfig): PipelineConfig {
  return {
    projectPath: '/test/project',
    specFilePath: '/test/does-not-exist.yaml',
    neo4jUri: 'bolt://localhost:7687',
    neo4jUser: 'neo4j',
    neo4jPassword: 'test',
    evaluationMode,
    pipelineMode: 'stateless',
    persist: false,
    diff: false,
    verbose: false,
    apgStorePath: '/tmp/apg-store',
    llmConfig,
  };
}

// The configuration the CLI now builds (cli.ts evaluate/report, batch-runner.ts).
function cliShape(apiKey: string): LLMProviderConfig {
  return {
    provider: 'gemini',
    gemini: { apiKey, model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash', temperature: 0, maxTokens: 4096 },
    cassette: { mode: 'record', dir: 'fixtures/cassettes' },
  };
}

// What HEAD's pipeline-factory built from `LLMConfig { apiKey }` (or from no LLMConfig).
function headProvider(apiKey: string | undefined): LLMProvider {
  if (apiKey === undefined) return realFactory(undefined);
  return realFactory({
    provider: 'gemini',
    gemini: { apiKey, model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash', temperature: 0, maxTokens: 4096 },
    cassette: { mode: 'record', dir: 'fixtures/cassettes' },
  });
}

function fingerprint(p: LLMProvider): unknown {
  const internals = p as unknown as { defaultTemperature?: number; defaultMaxTokens?: number };
  return {
    cls: p.constructor.name,
    name: p.name,
    describe: p.describe(),
    temperature: internals.defaultTemperature,
    maxTokens: internals.defaultMaxTokens,
  };
}

function builtProvider(): LLMProvider {
  expect(factory).toHaveBeenCalledTimes(1);
  const result = factory.mock.results[0];
  if (result?.type !== 'return') throw new Error('createLLMProvider did not return');
  return result.value;
}

describe('pipeline LLM provider equivalence with HEAD', () => {
  it('symbolic-only builds no provider', () => {
    createPipeline(pipelineConfig('symbolic-only', undefined));
    expect(factory).not.toHaveBeenCalled();
  });

  it.each(['full', 'neuronal-only'] as const)('%s with a key builds the same Gemini provider as HEAD', (mode) => {
    createPipeline(pipelineConfig(mode, cliShape('test-key')));
    const provider = builtProvider();

    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(fingerprint(provider)).toEqual(fingerprint(headProvider('test-key')));
    expect(fingerprint(provider)).toEqual({
      cls: 'GeminiProvider',
      name: 'gemini',
      describe: { provider: 'gemini', model: 'gemini-2.0-flash' },
      temperature: 0,
      maxTokens: 4096,
    });
  });

  it('honours GEMINI_MODEL exactly as HEAD did', () => {
    process.env.GEMINI_MODEL = 'gemini-test-model';
    createPipeline(pipelineConfig('full', cliShape('test-key')));

    expect(fingerprint(builtProvider())).toEqual(fingerprint(headProvider('test-key')));
    expect(builtProvider().describe().model).toBe('gemini-test-model');
  });

  it.each(['full', 'neuronal-only'] as const)('%s with an empty key builds NullLLMProvider, as HEAD did', (mode) => {
    createPipeline(pipelineConfig(mode, cliShape('')));
    const provider = builtProvider();

    expect(provider).toBeInstanceOf(NullLLMProvider);
    expect(fingerprint(provider)).toEqual(fingerprint(headProvider('')));
  });

  it('an empty key stays NullLLMProvider even when GEMINI_API_KEY is in the environment (HEAD ?? semantics)', () => {
    process.env.GEMINI_API_KEY = 'env-key';
    createPipeline(pipelineConfig('full', cliShape('')));

    expect(builtProvider()).toBeInstanceOf(NullLLMProvider);
    expect(fingerprint(builtProvider())).toEqual(fingerprint(headProvider('')));
  });

  it('no llmConfig in full mode builds NullLLMProvider, as HEAD did', () => {
    createPipeline(pipelineConfig('full', undefined));

    expect(builtProvider()).toBeInstanceOf(NullLLMProvider);
    expect(fingerprint(builtProvider())).toEqual(fingerprint(headProvider(undefined)));
  });
});
