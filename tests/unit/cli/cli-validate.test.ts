/**
 * U1 Step 28: C9 `validate` parity (FR-08, FR-20 denominator; BR-U1-11, BR-U1-19).
 * `validate` compiles the spec after the project check, prints BR-SPEC-10 errors, and prints
 * `declared N, compiled M, disabled K` plus one `Disabled:` line per disabled function.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Command } from 'commander';

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

import { compileFunctions, FitnessCompilerStage } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { CompileCommand } from '../../../src/pipeline/commands/compile-command.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { runId } from '../../../src/shared/types/value-objects.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';

const ROOT = path.resolve(__dirname, '../../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'u1-cli-validate-'));
afterAll(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

const SHIPPED = [
  'presets/clean-architecture.yaml',
  'presets/nestjs.yaml',
  'specs/clean-arch.yaml',
  'specs/daedalus-arch.yaml',
  'presets/layered.yaml',
] as const;

function loadProgram(): Command {
  const cliPath = require.resolve('../../../src/cli/cli.js');
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete require.cache[cliPath];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../../../src/cli/cli.js') as { program: Command };
  return mod.program;
}

let stderrSpy: jest.SpyInstance;
let savedExitCode: typeof process.exitCode;

beforeEach(() => {
  savedExitCode = process.exitCode;
  process.exitCode = undefined;
  stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stderrSpy.mockRestore();
  process.exitCode = savedExitCode;
});

function stderrText(): string {
  return stderrSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
}

async function runValidate(specPath: string, projectPath: string): Promise<{ exitCode: number | undefined; text: string }> {
  await loadProgram().parseAsync(['node', 'firewall', 'validate', '--spec', specPath, '--project', projectPath]);
  const code = process.exitCode;
  return { exitCode: typeof code === 'number' ? code : undefined, text: stderrText() };
}

async function loadSpec(specPath: string): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: specPath });
  if (!r.success) throw new Error(`${specPath} did not parse: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.data;
}

/** A throwaway project holding every layer directory of the spec, so the project check passes. */
function projectFor(spec: ParsedSpec, label: string): string {
  const dir = path.join(TMP, label.replace(/[^a-z0-9]+/gi, '-'));
  for (const layer of spec.layerModel.layers) {
    for (const d of layer.directories) {
      const clean = d.replace(/\/?\*\*.*$/, '').replace(/\/?\*$/, '');
      fs.mkdirSync(path.join(dir, clean), { recursive: true });
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('BR-U1-11 (a): validate prints the CompileCommand denominator', () => {
  it.each(SHIPPED)('%s', async (rel) => {
    const specPath = path.join(ROOT, rel);
    const spec = await loadSpec(specPath);

    const ctx = new FirewallContext(runId('test-run'));
    ctx.setParsedSpec(spec);
    const cmd = await new CompileCommand().execute(ctx);
    expect(cmd.success).toBe(true);
    const compiled = ctx.getCompiledFunctions();

    const { exitCode, text } = await runValidate(specPath, projectFor(spec, rel));

    expect(exitCode).toBe(0);
    expect(text).toContain('Spec valid: ');
    expect(text).toContain(
      `declared ${String(spec.fitnessFunctions.length)}, compiled ${String(compiled.totalCompiled)}, disabled ${String(compiled.disabledFunctions.length)}\n`,
    );
    const disabledLines = text.split('\n').filter((l) => l.startsWith('  Disabled: '));
    expect(disabledLines).toEqual(
      compiled.disabledFunctions.map((d) => `  Disabled: ${String(d.id)} ${d.name}: ${d.reason ?? ''}`),
    );
  });

  it('presets/layered.yaml prints declared 26, compiled 17, disabled 9 (BR-U1-19 a)', async () => {
    const specPath = path.join(ROOT, 'presets/layered.yaml');
    const spec = await loadSpec(specPath);
    const { exitCode, text } = await runValidate(specPath, projectFor(spec, 'layered-counts'));
    expect(exitCode).toBe(0);
    expect(text).toContain('declared 26, compiled 17, disabled 9\n');
    expect(text).toContain('  Disabled: FF-CV02 naming-services: no application layer\n');
    expect(text).toContain('  Disabled: FF-S04 ');
  });

  it('the FF-P01 negative spec exits 1 and prints BR-SPEC-10 FF-P01: forbiddenImports', async () => {
    const specPath = path.join(TMP, 'ff-p01-negative.yaml');
    fs.writeFileSync(specPath, `spec_version: "1.0.0"
architecture:
  layers:
    - { name: domain, roles: [r] }
    - { name: application, roles: [r] }
    - { name: infrastructure, roles: [r] }
fitness_functions:
  - { id: FF-P01, name: domain-purity, dimension: pattern, severity: critical, route: symbolic, forbidden_imports: [] }
scoring:
  weights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05 }
  thresholds: { pass: 0.80, warning: 0.65, soft_block: 0.50 }
confidence_thresholds: { high: 0.85, medium: 0.70, icc_minimum: 0.75 }
`);
    const { exitCode, text } = await runValidate(specPath, TMP);
    expect(exitCode).toBe(1);
    expect(text).toContain('Spec valid: '); // the project check passes; compilation fails
    expect(text).toContain('  - [MISSING_REQUIRED_PARAM] BR-SPEC-10 FF-P01: forbiddenImports\n');
    expect(text).not.toContain('declared ');
  });

  it('a failing project check still exits 1 when the spec compiles', async () => {
    const specPath = path.join(ROOT, 'presets/layered.yaml');
    const { exitCode, text } = await runValidate(specPath, path.join(TMP, 'no-such-project'));
    expect(exitCode).toBe(1);
    expect(text).toContain('[LAYER_DIR_NOT_FOUND]');
    expect(text).toContain('declared 26, compiled 17, disabled 9\n');
  });
});

describe('BR-U1-11 (b): FitnessCompilerStage receives the spec style', () => {
  it('presets/layered.yaml: stage disabledFunctions equal compileFunctions(compilerInputFromSpec(spec))', async () => {
    const spec = await loadSpec(path.join(ROOT, 'presets/layered.yaml'));
    const direct = compileFunctions(compilerInputFromSpec(spec));
    expect(direct.success).toBe(true);
    if (!direct.success) return;

    const stage = await new FitnessCompilerStage().execute(spec, new FirewallContext(runId('test-run')));
    expect(stage.success).toBe(true);
    if (!stage.success) return;

    expect(stage.data.disabledFunctions).toEqual(direct.data.disabledFunctions);
    expect(stage.data.disabledFunctions.some((d) => d.reason === 'not applicable to style layered')).toBe(true);
  });
});
