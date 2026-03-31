import { PipelineExecutor } from '../../../src/pipeline/pipeline-executor.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { runId } from '../../../src/shared/types/value-objects.js';
import type { PipelineCommand } from '../../../src/shared/interfaces/pipeline-stage.js';
import type { DomainResult as DomainResultType, PipelineError } from '../../../src/shared/errors/domain-result.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tracks execution order and returns a configurable DomainResult. */
function mockCommand(
  name: string,
  executionLog: string[],
  opts: {
    fail?: boolean;
    failError?: PipelineError;
    throwError?: Error;
    warnings?: readonly { code: string; message: string }[];
  } = {},
): PipelineCommand {
  return {
    name,
    async execute(_ctx: FirewallContext): Promise<DomainResultType<void>> {
      executionLog.push(name);

      if (opts.throwError) {
        throw opts.throwError;
      }

      if (opts.fail) {
        const error: PipelineError = opts.failError ?? {
          code: 'MOCK_FAILURE',
          message: `${name} failed`,
          stage: name,
          critical: true,
        };
        return DomainResult.fail<void>([error]);
      }

      if (opts.warnings && opts.warnings.length > 0) {
        return DomainResult.ok(undefined, opts.warnings);
      }

      return DomainResult.ok(undefined);
    },
  };
}

/** Minimal EvaluationReport stub for success tests. */
function stubReport(): EvaluationReport {
  return {
    runId: 'test-run',
    projectPath: '/test',
    specVersion: '1.0.0',
    evaluationMode: 'symbolic-only',
    ahsDeterministic: 1.0,
    ahsCombined: null,
    verdict: 'pass',
    perDimensionScores: [],
    violations: [],
    universalMetrics: {
      totalFunctions: 0,
      totalViolations: 0,
      symbolicFunctions: 0,
      neuronalFunctions: 0,
      hybridFunctions: 0,
      deterministic: true,
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      engineVersion: '0.1.0',
      durationMs: 0,
    },
  } as unknown as EvaluationReport;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PipelineExecutor', () => {
  let context: FirewallContext;

  beforeEach(() => {
    context = new FirewallContext(runId('test-run'));
  });

  it('executes commands sequentially in order', async () => {
    const log: string[] = [];
    const commands = [
      mockCommand('step-1', log),
      mockCommand('step-2', log),
      mockCommand('step-3', log),
    ];

    // Set a report so the final getReport() succeeds
    context.setReport(stubReport());

    const executor = new PipelineExecutor(commands, context);
    await executor.execute();

    expect(log).toEqual(['step-1', 'step-2', 'step-3']);
  });

  it('returns EvaluationReport from context on success', async () => {
    const log: string[] = [];
    const commands = [mockCommand('only-step', log)];
    const report = stubReport();
    context.setReport(report);

    const executor = new PipelineExecutor(commands, context);
    const result = await executor.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verdict).toBe('pass');
    }
  });

  it('fail-fast — stops at first error and returns that error', async () => {
    const log: string[] = [];
    const failErr: PipelineError = {
      code: 'BOOM',
      message: 'step-2 exploded',
      stage: 'step-2',
      critical: true,
    };
    const commands = [
      mockCommand('step-1', log),
      mockCommand('step-2', log, { fail: true, failError: failErr }),
      mockCommand('step-3', log),
    ];

    const executor = new PipelineExecutor(commands, context);
    const result = await executor.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('BOOM');
    }
    // step-3 should never have run
    expect(log).toEqual(['step-1', 'step-2']);
  });

  it('records stage timings for each command', async () => {
    const log: string[] = [];
    const commands = [mockCommand('a', log), mockCommand('b', log)];
    context.setReport(stubReport());

    const executor = new PipelineExecutor(commands, context);
    await executor.execute();

    const timings = executor.getTimings();
    expect(timings.stages).toHaveLength(2);
    expect(timings.stages[0].name).toBe('a');
    expect(timings.stages[1].name).toBe('b');
    expect(timings.stages.every((s) => typeof s.durationMs === 'number')).toBe(true);
    expect(timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('shutdown — stops before next command when requestShutdown() called', async () => {
    const log: string[] = [];
    // The first command will trigger shutdown
    const shutdownCmd: PipelineCommand = {
      name: 'trigger-shutdown',
      async execute(): Promise<DomainResultType<void>> {
        log.push('trigger-shutdown');
        // The executor.requestShutdown() is called externally;
        // we simulate by calling it on the executor instance.
        executor.requestShutdown();
        return DomainResult.ok(undefined);
      },
    };
    const commands = [shutdownCmd, mockCommand('should-not-run', log)];

    const executor = new PipelineExecutor(commands, context);
    const result = await executor.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('PIPELINE_SHUTDOWN');
    }
    expect(log).toEqual(['trigger-shutdown']);
  });

  it('accumulates warnings from successful commands', async () => {
    const log: string[] = [];
    const commands = [
      mockCommand('warn-step', log, {
        warnings: [{ code: 'W1', message: 'warning one' }],
      }),
      mockCommand('clean-step', log),
    ];
    context.setReport(stubReport());

    const executor = new PipelineExecutor(commands, context);
    await executor.execute();

    const timings = executor.getTimings();
    expect(timings.stages[0].status).toBe('warning');
    expect(timings.stages[1].status).toBe('success');
  });

  it('handles thrown exceptions from commands', async () => {
    const log: string[] = [];
    const commands = [
      mockCommand('thrower', log, { throwError: new Error('kaboom') }),
      mockCommand('never', log),
    ];

    const executor = new PipelineExecutor(commands, context);
    const result = await executor.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('STAGE_THREW');
      expect(result.errors[0].message).toContain('kaboom');
    }
    expect(log).toEqual(['thrower']);
  });

  it('returns PIPELINE_NO_REPORT error if no report set on context', async () => {
    const log: string[] = [];
    const commands = [mockCommand('ok-step', log)];
    // Intentionally NOT setting a report on context

    const executor = new PipelineExecutor(commands, context);
    const result = await executor.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('PIPELINE_NO_REPORT');
    }
  });
});
