/**
 * Generator config and exact confinement argv (U5a plan Step 16; FR-v1.2E-28; SECURITY-11; BR-U5a-41, 42).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  FORBIDDEN_GENERATOR_FLAGS,
  bashAllowRule,
  buildGeneratorArgs,
  harnessTsconfigPath,
  typecheckCommand,
} from '../../../../scripts/lib/generators/argv.js';
import {
  canonicalPath,
  checkRunDirs,
  createGeneratorCliConfig,
  isInsideOrEqual,
  runIdFor,
} from '../../../../scripts/lib/generators/config.js';
import type { GenerationRequest, GeneratorCliConfig } from '../../../../scripts/lib/generators/types.js';
import { DEFAULT_GENERATOR_TIMEOUT_MS } from '../../../../scripts/lib/generators/types.js';

const REPO = process.cwd();
const MODEL = 'model-under-test-1';

function fixedConfig(allowBash = true): GeneratorCliConfig {
  return {
    binary: '/usr/local/bin/claude',
    modelId: MODEL,
    timeoutMs: DEFAULT_GENERATOR_TIMEOUT_MS,
    outputRoot: '/gen/out',
    harnessRoot: '/gen/h',
    allowBash,
  };
}

function fixedRequest(outputDir = '/gen/out/m/task-management/none/run-0'): GenerationRequest {
  return {
    runId: runIdFor(MODEL, 'task-management', 'none', 0),
    promptTemplateId: 'none',
    taskId: 'task-management',
    modelId: MODEL,
    style: 'clean-architecture',
    specLevel: 'none',
    runIndex: 0,
    outputDir,
    fileRange: { min: 20, max: 100 },
    orderSeed: 7,
    pilot: false,
  };
}

function valueAfter(args: readonly string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i < 0 ? undefined : args[i + 1];
}

describe('buildGeneratorArgs (BR-U5a-41)', () => {
  it('emits exactly the pinned argv for a fixed config and request', () => {
    expect(buildGeneratorArgs(fixedConfig(), fixedRequest(), 'PROMPT')).toEqual([
      '-p',
      'PROMPT',
      '--model',
      MODEL,
      '--output-format',
      'json',
      '--safe-mode',
      '--restricted',
      '--tools',
      'Read,Write,Edit,Glob,Grep,Bash',
      '--allowedTools',
      `Bash(/gen/h/bin/tsc --noEmit --incremental false -p /gen/h/runs/${MODEL}/task-management/none/run-0/tsconfig.json)`,
      '--disallowedTools',
      'Write(node_modules/**)',
      'Edit(node_modules/**)',
      '--permission-mode',
      'acceptEdits',
      '--permission-prompts',
      'none',
      '--no-session-persistence',
      '--strict-mcp-config',
    ]);
  });

  it('never emits --bare, --add-dir or --dangerously-skip-permissions, and the allow rule has no wildcard', () => {
    for (const allowBash of [true, false]) {
      const args = buildGeneratorArgs(fixedConfig(allowBash), fixedRequest(), 'PROMPT');
      for (const f of FORBIDDEN_GENERATOR_FLAGS) expect(args).not.toContain(f);
      expect(FORBIDDEN_GENERATOR_FLAGS).toEqual(['--bare', '--add-dir', '--dangerously-skip-permissions']);
      const allowed = valueAfter(args, '--allowedTools');
      if (allowed !== undefined) expect(allowed).not.toContain('*');
    }
  });

  it('the no-Bash variant drops Bash and the allow rule, keeping everything else', () => {
    const withBash = buildGeneratorArgs(fixedConfig(true), fixedRequest(), 'PROMPT');
    const noBash = buildGeneratorArgs(fixedConfig(false), fixedRequest(), 'PROMPT');
    expect(valueAfter(noBash, '--tools')).toBe('Read,Write,Edit,Glob,Grep');
    expect(noBash).not.toContain('--allowedTools');
    expect(noBash.some((a) => a.startsWith('Bash('))).toBe(false);
    const stripped = withBash.filter(
      (a, i) => a !== '--allowedTools' && withBash[i - 1] !== '--allowedTools' && a !== 'Read,Write,Edit,Glob,Grep,Bash',
    );
    expect(noBash.filter((a) => a !== 'Read,Write,Edit,Glob,Grep')).toEqual(stripped);
  });

  it('the type-check command and the allow rule agree, and the tsconfig sits under <H>/runs/<runId>', () => {
    const runId = runIdFor(MODEL, 'order-fulfilment', 'full-aac', 2);
    expect(runId).toBe(`${MODEL}/order-fulfilment/full-aac/run-2`);
    expect(harnessTsconfigPath('/h', runId)).toBe(`/h/runs/${runId}/tsconfig.json`);
    expect(typecheckCommand('/h', runId)).toBe(`/h/bin/tsc --noEmit --incremental false -p /h/runs/${runId}/tsconfig.json`);
    expect(bashAllowRule('/h', runId)).toBe(`Bash(${typecheckCommand('/h', runId)})`);
  });
});

describe('createGeneratorCliConfig and checkRunDirs (BR-U5a-42)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-gencfg-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function input(over: Partial<Parameters<typeof createGeneratorCliConfig>[0]> = {}): Parameters<
    typeof createGeneratorCliConfig
  >[0] {
    return {
      binary: '/usr/local/bin/claude',
      modelId: MODEL,
      outputRoot: path.join(tmp, 'out'),
      harnessRoot: path.join(tmp, 'h'),
      ...over,
    };
  }

  function codes(r: ReturnType<typeof createGeneratorCliConfig> | ReturnType<typeof checkRunDirs>): string[] {
    return r.success ? [] : r.errors.map((e) => e.code);
  }

  it('accepts absolute paths outside the repo with defaults', () => {
    const r = createGeneratorCliConfig(input(), REPO);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.timeoutMs).toBe(1_200_000);
    expect(r.data.allowBash).toBe(true);
    expect(Object.isFrozen(r.data)).toBe(true);
  });

  it('outputRoot inside the repo root → GEN_CWD_INSIDE_REPO', () => {
    expect(codes(createGeneratorCliConfig(input({ outputRoot: path.join(REPO, 'gen-out') }), REPO))).toEqual([
      'GEN_CWD_INSIDE_REPO',
    ]);
    expect(codes(createGeneratorCliConfig(input({ outputRoot: REPO }), REPO))).toContain('GEN_CWD_INSIDE_REPO');
  });

  it('harnessRoot inside outputRoot → GEN_HARNESS_INSIDE_CWD; inside the repo → GEN_HARNESS_INSIDE_REPO', () => {
    expect(codes(createGeneratorCliConfig(input({ harnessRoot: path.join(tmp, 'out', 'h') }), REPO))).toEqual([
      'GEN_HARNESS_INSIDE_CWD',
    ]);
    expect(codes(createGeneratorCliConfig(input({ harnessRoot: path.join(REPO, 'h') }), REPO))).toEqual([
      'GEN_HARNESS_INSIDE_REPO',
    ]);
  });

  it('relative paths, unsafe harness paths, bad model ids and timeouts are refused', () => {
    expect(codes(createGeneratorCliConfig(input({ outputRoot: 'out' }), REPO))).toEqual(['GEN_PATH_NOT_ABSOLUTE']);
    expect(codes(createGeneratorCliConfig(input({ binary: 'claude' }), REPO))).toEqual(['GEN_PATH_NOT_ABSOLUTE']);
    expect(codes(createGeneratorCliConfig(input({ harnessRoot: path.join(tmp, 'h x') }), REPO))).toEqual(['GEN_PATH_UNSAFE']);
    expect(codes(createGeneratorCliConfig(input({ harnessRoot: path.join(tmp, 'h;rm') }), REPO))).toEqual(['GEN_PATH_UNSAFE']);
    expect(codes(createGeneratorCliConfig(input({ modelId: 'a b' }), REPO))).toEqual(['GEN_MODEL_ID_INVALID']);
    expect(codes(createGeneratorCliConfig(input({ modelId: 'a/b' }), REPO))).toEqual(['GEN_MODEL_ID_INVALID']);
    expect(codes(createGeneratorCliConfig(input({ timeoutMs: 0 }), REPO))).toEqual(['GEN_TIMEOUT_INVALID']);
  });

  it('a symlink into the repo is seen through', () => {
    const link = path.join(tmp, 'link-to-repo');
    fs.symlinkSync(REPO, link);
    expect(codes(createGeneratorCliConfig(input({ outputRoot: path.join(link, 'x') }), REPO))).toEqual([
      'GEN_CWD_INSIDE_REPO',
    ]);
    expect(canonicalPath(path.join(link, 'not', 'there'))).toBe(path.join(fs.realpathSync(REPO), 'not', 'there'));
    expect(isInsideOrEqual(REPO, path.join(link, 'a'))).toBe(true);
    expect(isInsideOrEqual(REPO, `${REPO}-sibling`)).toBe(false);
  });

  it('per-run cwd checks', () => {
    const cfg = createGeneratorCliConfig(input(), REPO);
    if (!cfg.success) throw new Error('config');
    const ok = fixedRequest(path.join(tmp, 'out', MODEL, 'task-management', 'none', 'run-0'));
    expect(codes(checkRunDirs(cfg.data, ok, REPO))).toEqual([]);
    expect(codes(checkRunDirs(cfg.data, { ...ok, outputDir: path.join(REPO, 'x') }, REPO))).toEqual([
      'GEN_CWD_INSIDE_REPO',
      'GEN_CWD_OUTSIDE_OUTPUT_ROOT',
    ]);
    expect(codes(checkRunDirs(cfg.data, { ...ok, outputDir: tmp }, REPO))).toEqual([
      'GEN_CWD_OUTSIDE_OUTPUT_ROOT',
      'GEN_HARNESS_INSIDE_CWD',
    ]);
    expect(codes(checkRunDirs(cfg.data, { ...ok, outputDir: path.join(tmp, 'out') }, REPO))).toEqual([
      'GEN_CWD_OUTSIDE_OUTPUT_ROOT',
    ]);
    expect(codes(checkRunDirs(cfg.data, { ...ok, outputDir: 'rel' }, REPO))).toEqual(['GEN_PATH_NOT_ABSOLUTE']);
    expect(codes(checkRunDirs(cfg.data, { ...ok, runId: 'x' }, REPO))).toEqual(['GEN_RUN_ID_INVALID']);
    expect(codes(checkRunDirs(cfg.data, { ...ok, modelId: 'other' }, REPO))).toEqual([
      'GEN_MODEL_ID_MISMATCH',
      'GEN_RUN_ID_INVALID',
    ]);
  });
});
