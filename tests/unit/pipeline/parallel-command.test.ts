import { ParallelCommand } from '../../../src/pipeline/commands/parallel-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { runId } from '../../../src/shared/types/value-objects.js';
import type { PipelineCommand } from '../../../src/shared/interfaces/pipeline-stage.js';
import type { DomainResult as DomainResultType, PipelineError } from '../../../src/shared/errors/domain-result.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSubCommand(
  name: string,
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
      if (opts.throwError) {
        throw opts.throwError;
      }

      if (opts.fail) {
        const error: PipelineError = opts.failError ?? {
          code: 'SUB_FAIL',
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ParallelCommand', () => {
  let context: FirewallContext;

  beforeEach(() => {
    context = new FirewallContext(runId('test-run'));
  });

  it('executes all sub-commands concurrently (both succeed)', async () => {
    const cmd = new ParallelCommand([
      mockSubCommand('sub-a'),
      mockSubCommand('sub-b'),
    ]);

    const result = await cmd.execute(context);

    expect(result.success).toBe(true);
  });

  it('returns error if any sub-command fails', async () => {
    const cmd = new ParallelCommand([
      mockSubCommand('sub-ok'),
      mockSubCommand('sub-bad', {
        fail: true,
        failError: {
          code: 'BAD',
          message: 'sub-bad broke',
          stage: 'sub-bad',
          critical: true,
        },
      }),
    ]);

    const result = await cmd.execute(context);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].code).toBe('BAD');
    }
  });

  it('merges warnings from successful sub-commands', async () => {
    const cmd = new ParallelCommand([
      mockSubCommand('sub-w1', {
        warnings: [{ code: 'W1', message: 'warn1' }],
      }),
      mockSubCommand('sub-w2', {
        warnings: [{ code: 'W2', message: 'warn2' }],
      }),
    ]);

    const result = await cmd.execute(context);

    expect(result.success).toBe(true);
    // Warnings are added to context via addWarning
    expect(context.warnings.length).toBe(2);
    expect(context.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['W1', 'W2']),
    );
  });

  it('handles empty command list', async () => {
    const cmd = new ParallelCommand([]);
    const result = await cmd.execute(context);

    expect(result.success).toBe(true);
  });

  it('handles thrown exception from sub-command', async () => {
    const cmd = new ParallelCommand([
      mockSubCommand('sub-ok'),
      mockSubCommand('sub-throws', { throwError: new Error('boom') }),
    ]);

    const result = await cmd.execute(context);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].code).toBe('PARALLEL_COMMAND_THREW');
      expect(result.errors[0].message).toContain('boom');
    }
  });

  it('name is composed from sub-command names', () => {
    const cmd = new ParallelCommand([
      mockSubCommand('extract-apg'),
      mockSubCommand('parse-spec'),
    ]);

    expect(cmd.name).toBe('parallel:extract-apg+parse-spec');
  });
});
