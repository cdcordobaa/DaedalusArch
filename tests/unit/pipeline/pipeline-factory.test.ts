import type { PipelineConfig } from '../../../src/pipeline/types.js';

// ---------------------------------------------------------------------------
// Mocks — must come before the import of createPipeline
// ---------------------------------------------------------------------------

const mockClose = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/neo4j-ingestion/neo4j-repository.js', () => ({
  Neo4jRepository: jest.fn().mockImplementation(() => ({
    executeQuery: jest.fn(),
    clearGraph: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    close: mockClose,
  })),
}));

jest.mock('../../../src/neo4j-ingestion/fs-snapshot-store.js', () => ({
  FileSystemSnapshotStore: jest.fn().mockImplementation(() => ({
    save: jest.fn(),
    load: jest.fn(),
    list: jest.fn(),
  })),
}));

jest.mock('../../../src/llm-critic/index.js', () => ({
  MockLLMProvider: jest.fn().mockImplementation(() => ({
    evaluate: jest.fn(),
  })),
}));

// Import after mocks
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    projectPath: '/test/project',
    specFilePath: '/test/spec.yaml',
    neo4jUri: 'bolt://localhost:7687',
    neo4jUser: 'neo4j',
    neo4jPassword: 'test',
    evaluationMode: 'full',
    pipelineMode: 'full',
    persist: false,
    diff: false,
    verbose: false,
    apgStorePath: '/tmp/apg-store',
    ...overrides,
  };
}

/** Extract command names from the executor by inspecting the bundle. */
function getCommandNames(config: PipelineConfig): string[] {
  const bundle = createPipeline(config);
  // The executor stores commands as a private field — access via the context
  // audit log after execution would be one way, but we can also inspect the
  // constructor argument. PipelineExecutor stores `commands` as a private
  // readonly field. We use a type assertion to read it for testing purposes.
  const executor = bundle.executor as unknown as { commands: readonly { name: string }[] };
  return executor.commands.map((c) => c.name);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('full mode creates correct command sequence', () => {
    const names = getCommandNames(baseConfig({ evaluationMode: 'full' }));

    // Expected: parallel(extract+parse), ingest, compile, route-evaluate, score
    expect(names[0]).toMatch(/^parallel:extract-apg\+parse-spec$/);
    expect(names).toContain('ingest-apg');
    expect(names).toContain('compile-functions');
    expect(names).toContain('route-evaluate');
    expect(names).toContain('compute-scores');
  });

  it('symbolic-only mode creates symbolic-evaluate instead of route-evaluate', () => {
    const names = getCommandNames(baseConfig({ evaluationMode: 'symbolic-only' }));

    expect(names).toContain('evaluate-symbolic');
    expect(names).not.toContain('route-evaluate');
    expect(names).not.toContain('evaluate-neuronal');
  });

  it('neuronal-only mode creates neuronal-evaluate', () => {
    const names = getCommandNames(baseConfig({ evaluationMode: 'neuronal-only' }));

    expect(names).toContain('evaluate-neuronal');
    expect(names).not.toContain('route-evaluate');
    expect(names).not.toContain('evaluate-symbolic');
  });

  it('--persist flag appends SnapshotSaveCommand', () => {
    const names = getCommandNames(baseConfig({
      persist: true,
      commitSha: 'abc123' as any,
    }));

    expect(names).toContain('snapshot-save');
  });

  it('--diff flag prepends SnapshotLoadCommand and appends DriftDetectCommand', () => {
    const names = getCommandNames(baseConfig({
      diff: true,
      commitSha: 'abc123' as any,
    }));

    expect(names[0]).toBe('snapshot-load');
    expect(names[names.length - 1]).toBe('drift-detect');
  });

  it('cleanup function calls graphRepo.close()', async () => {
    const bundle = createPipeline(baseConfig());

    await bundle.cleanup();

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('creates FirewallContext with a RunId', () => {
    const bundle = createPipeline(baseConfig());

    // RunId should start with the expected prefix
    expect(String(bundle.context.runId)).toMatch(/^run-\d+$/);
  });
});
