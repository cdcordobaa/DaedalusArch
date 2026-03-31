import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { runId } from '../../../src/shared/types/value-objects.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';

// ---------------------------------------------------------------------------
// Mocks — declared before imports so jest.mock hoists them correctly
// ---------------------------------------------------------------------------

const mockExtractAPG = jest.fn();
jest.mock('../../../src/apg-extractor/index.js', () => ({
  extractAPG: (...args: unknown[]) => mockExtractAPG(...args),
}));

const mockParseSpec = jest.fn();
jest.mock('../../../src/spec-parser/index.js', () => ({
  parseSpec: (...args: unknown[]) => mockParseSpec(...args),
}));

const mockCompileFunctions = jest.fn();
jest.mock('../../../src/fitness-compiler/index.js', () => ({
  compileFunctions: (...args: unknown[]) => mockCompileFunctions(...args),
}));

// Import commands after mocks are registered
import { ExtractCommand } from '../../../src/pipeline/commands/extract-command.js';
import { ParseCommand } from '../../../src/pipeline/commands/parse-command.js';
import { CompileCommand } from '../../../src/pipeline/commands/compile-command.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubApgResult(): APGResult {
  return {
    nodes: [{ id: 'n1', type: 'file', filePath: 'src/a.ts', layer: 'domain', labels: [], properties: {} }],
    edges: [],
    parseCoverage: { totalFiles: 1, parsedFiles: 1, percentage: 100 },
  } as unknown as APGResult;
}

function stubParsedSpec(): ParsedSpec {
  return {
    specVersion: '1.0.0',
    fitnessFunctions: [],
    adrRules: [],
    layerModel: { layers: [{ name: 'domain', patterns: ['src/domain/**'] }] },
    scoringWeights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05, semantic: 0, intent: 0 },
    verdictThresholds: { pass: 0.80, warning: 0.65, softBlock: 0.50 },
    confidenceThresholds: { high: 0.85, medium: 0.60, iccMinimum: 0.70 },
  } as unknown as ParsedSpec;
}

function stubCompiledFunctions(): CompiledFunctions {
  return {
    symbolicQueries: [],
    neuronalInstructions: [],
    hybridPairs: [],
    totalCompiled: 0,
  } as unknown as CompiledFunctions;
}

// ---------------------------------------------------------------------------
// ExtractCommand
// ---------------------------------------------------------------------------

describe('ExtractCommand', () => {
  let context: FirewallContext;

  beforeEach(() => {
    context = new FirewallContext(runId('test-run'));
    jest.clearAllMocks();
  });

  it('calls extractAPG with project path and sets context.setApgResult', async () => {
    const apg = stubApgResult();
    mockExtractAPG.mockResolvedValue(DomainResult.ok(apg));

    const cmd = new ExtractCommand('/my/project');
    const result = await cmd.execute(context);

    expect(result.success).toBe(true);
    expect(mockExtractAPG).toHaveBeenCalledWith('/my/project');
    expect(context.getApgResult()).toBe(apg);
  });

  it('maps errors with stage name', async () => {
    mockExtractAPG.mockResolvedValue(
      DomainResult.fail([{ code: 'PARSE_ERROR', message: 'bad file' }]),
    );

    const cmd = new ExtractCommand('/my/project');
    const result = await cmd.execute(context);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toMatchObject({
        code: 'PARSE_ERROR',
        stage: 'extract-apg',
      });
    }
  });

  it('forwards warnings to context', async () => {
    const apg = stubApgResult();
    mockExtractAPG.mockResolvedValue(
      DomainResult.ok(apg, [{ code: 'LOW_COVERAGE', message: 'only 50%' }]),
    );

    const cmd = new ExtractCommand('/my/project');
    await cmd.execute(context);

    expect(context.warnings).toHaveLength(1);
    expect(context.warnings[0]).toMatchObject({
      code: 'LOW_COVERAGE',
      stage: 'extract-apg',
    });
  });
});

// ---------------------------------------------------------------------------
// ParseCommand
// ---------------------------------------------------------------------------

describe('ParseCommand', () => {
  let context: FirewallContext;

  beforeEach(() => {
    context = new FirewallContext(runId('test-run'));
    jest.clearAllMocks();
  });

  it('calls parseSpec with spec file path and sets context.setParsedSpec', async () => {
    const spec = stubParsedSpec();
    mockParseSpec.mockResolvedValue(DomainResult.ok(spec));

    const cmd = new ParseCommand('/my/spec.yaml');
    const result = await cmd.execute(context);

    expect(result.success).toBe(true);
    expect(mockParseSpec).toHaveBeenCalledWith({ specFilePath: '/my/spec.yaml' });
    expect(context.getParsedSpec()).toBe(spec);
  });

  it('maps errors with stage name', async () => {
    mockParseSpec.mockResolvedValue(
      DomainResult.fail([{ code: 'INVALID_SPEC', message: 'bad yaml' }]),
    );

    const cmd = new ParseCommand('/my/spec.yaml');
    const result = await cmd.execute(context);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toMatchObject({
        code: 'INVALID_SPEC',
        stage: 'parse-spec',
      });
    }
  });

  it('forwards warnings to context', async () => {
    const spec = stubParsedSpec();
    mockParseSpec.mockResolvedValue(
      DomainResult.ok(spec, [{ code: 'DEPRECATED_FIELD', message: 'old field' }]),
    );

    const cmd = new ParseCommand('/my/spec.yaml');
    await cmd.execute(context);

    expect(context.warnings).toHaveLength(1);
    expect(context.warnings[0]).toMatchObject({
      code: 'DEPRECATED_FIELD',
      stage: 'parse-spec',
    });
  });
});

// ---------------------------------------------------------------------------
// CompileCommand
// ---------------------------------------------------------------------------

describe('CompileCommand', () => {
  let context: FirewallContext;

  beforeEach(() => {
    context = new FirewallContext(runId('test-run'));
    jest.clearAllMocks();
    // CompileCommand reads parsedSpec from context
    const spec = stubParsedSpec();
    context.setParsedSpec(spec);
  });

  it('calls compileFunctions with correct args and sets context.setCompiledFunctions', async () => {
    const compiled = stubCompiledFunctions();
    mockCompileFunctions.mockReturnValue(DomainResult.ok(compiled));

    const cmd = new CompileCommand();
    const result = await cmd.execute(context);

    expect(result.success).toBe(true);
    expect(mockCompileFunctions).toHaveBeenCalledWith(
      expect.objectContaining({
        fitnessFunctions: expect.any(Array),
        adrRules: expect.any(Array),
        layerModel: expect.any(Object),
        scoringWeights: expect.any(Object),
      }),
    );
    expect(context.getCompiledFunctions()).toBe(compiled);
  });

  it('maps errors with stage name', async () => {
    mockCompileFunctions.mockReturnValue(
      DomainResult.fail([{ code: 'COMPILE_ERROR', message: 'bad function' }]),
    );

    const cmd = new CompileCommand();
    const result = await cmd.execute(context);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toMatchObject({
        code: 'COMPILE_ERROR',
        stage: 'compile-functions',
      });
    }
  });

  it('forwards warnings to context', async () => {
    const compiled = stubCompiledFunctions();
    mockCompileFunctions.mockReturnValue(
      DomainResult.ok(compiled, [{ code: 'UNUSED_RULE', message: 'rule ignored' }]),
    );

    const cmd = new CompileCommand();
    await cmd.execute(context);

    expect(context.warnings).toHaveLength(1);
    expect(context.warnings[0]).toMatchObject({
      code: 'UNUSED_RULE',
      stage: 'compile-functions',
    });
  });
});
