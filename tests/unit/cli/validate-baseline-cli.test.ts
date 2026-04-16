import { program } from '../../../src/cli/cli.js';

describe('CLI — validate command', () => {
  it('registers the validate command', () => {
    const validateCmd = program.commands.find((c) => c.name() === 'validate');
    expect(validateCmd).toBeDefined();
  });

  it('validate command has required options', () => {
    const validateCmd = program.commands.find((c) => c.name() === 'validate');
    expect(validateCmd).toBeDefined();
    const optNames = validateCmd!.options.map((o) => o.long);
    expect(optNames).toContain('--spec');
    expect(optNames).toContain('--project');
  });
});

describe('CLI — baseline command', () => {
  it('registers the baseline command', () => {
    const baselineCmd = program.commands.find((c) => c.name() === 'baseline');
    expect(baselineCmd).toBeDefined();
  });

  it('baseline command has required options', () => {
    const baselineCmd = program.commands.find((c) => c.name() === 'baseline');
    expect(baselineCmd).toBeDefined();
    const optNames = baselineCmd!.options.map((o) => o.long);
    expect(optNames).toContain('--spec');
    expect(optNames).toContain('--project');
    expect(optNames).toContain('--output');
  });
});

describe('CLI — evaluate --baseline flag', () => {
  it('evaluate command accepts --baseline option', () => {
    const evaluateCmd = program.commands.find((c) => c.name() === 'evaluate');
    expect(evaluateCmd).toBeDefined();
    const optNames = evaluateCmd!.options.map((o) => o.long);
    expect(optNames).toContain('--baseline');
  });
});
