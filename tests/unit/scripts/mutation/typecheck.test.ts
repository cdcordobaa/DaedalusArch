/**
 * Pinned type-check runner and gates (U5a plan Step 10; BR-U5a-07, 08, 09; SECURITY-10).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { initManifest, loadManifest } from '../../../../scripts/lib/manifest.js';
import { copyBase, makePreparedBase, prepareFixtureBase, repoTscPath } from '../../../../scripts/lib/mutation/prepare.js';
import {
  checkBaseClean,
  gateMutant,
  parseTscOutput,
  summariseErrors,
  tscArgs,
  typecheckProject,
} from '../../../../scripts/lib/mutation/typecheck.js';
import type { PreparedBase } from '../../../../scripts/lib/mutation/types.js';

const REPO = process.cwd();
const TSC = repoTscPath(REPO);

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: ProcessRunOptions;
}

class FakeRunner implements ProcessRunner {
  readonly calls: Call[] = [];
  constructor(private readonly result: Partial<ProcessResult>) {}
  run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ command, args, options });
    return Promise.resolve(
      DomainResult.ok({ exitCode: 0, stdout: '', stderr: '', timedOut: false, durationMs: 1, ...this.result }),
    );
  }
}

const TS2307 = "src/domain/entities/Task.ts(1,21): error TS2307: Cannot find module 'express' or its corresponding type declarations.\n";

let scratch: string;
let base: PreparedBase;
beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-typecheck-'));
  const b = makePreparedBase({
    projectId: 'correct-reference',
    baseKind: 'fixture',
    dir: path.join(REPO, 'fixtures/correct-reference'),
    baseCommit: 'a'.repeat(40),
    tsconfigPath: 'tsconfig.json',
    tscPath: TSC,
    tscVersion: '5.9.3',
    overlays: [],
    specPath: 'specs/clean-arch.yaml',
  });
  if (!b.success) throw new Error('base');
  base = b.data;
});
afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

function newManifest(): string {
  const file = path.join(scratch, 'manifest.json');
  const r = initManifest(REPO, file, { catalogueVersion: 'b'.repeat(64), masterSeed: 20261008, cycleStrategy: 'simple-cycles' });
  if (!r.success) throw new Error('init');
  return file;
}

const sha = (file: string): string => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('typecheckProject (BR-U5a-08)', () => {
  it('runs process.execPath with the absolute tscPath and the pinned flags, never PATH or npx', async () => {
    const runner = new FakeRunner({});
    const tsconfig = path.join(scratch, 'tsconfig.json');
    const r = await typecheckProject(runner, TSC, tsconfig);
    expect(r.success).toBe(true);
    expect(runner.calls).toHaveLength(1);
    const call = runner.calls[0];
    expect(call?.command).toBe(process.execPath);
    expect(call?.args).toEqual([TSC, '--noEmit', '--incremental', 'false', '-p', tsconfig]);
    expect(call?.args).toEqual(tscArgs(TSC, tsconfig));
    expect(call?.options.env).toEqual({});
    expect(call?.options.cwd).toBe(scratch);
    expect(call?.args.join(' ')).not.toMatch(/npx/);
  });

  it('refuses relative paths', async () => {
    const r = await typecheckProject(new FakeRunner({}), 'node_modules/typescript/lib/tsc.js', path.join(scratch, 'tsconfig.json'));
    expect(!r.success && r.errors[0]?.code).toBe('MUT_TYPECHECK_PATH');
  });

  it('parses file and global diagnostics', () => {
    const d = parseTscOutput(`${TS2307}error TS5058: The specified path does not exist: 'x'.\nnoise\n`);
    expect(d).toEqual([
      { code: 'TS2307', file: 'src/domain/entities/Task.ts', line: 1, message: "Cannot find module 'express' or its corresponding type declarations." },
      { code: 'TS5058', file: null, line: null, message: "The specified path does not exist: 'x'." },
    ]);
    expect(summariseErrors([...d, ...d])).toEqual({ errorCount: 4, codes: { TS2307: 2, TS5058: 2 } });
  });

  it('a non-zero exit without a diagnostic, or a timeout, is an error', async () => {
    const r1 = await typecheckProject(new FakeRunner({ exitCode: 3 }), TSC, path.join(scratch, 't.json'));
    expect(r1.success && r1.data.errors.map((e) => e.code)).toEqual(['TSC_EXIT_3']);
    const r2 = await typecheckProject(new FakeRunner({ exitCode: -1, timedOut: true }), TSC, path.join(scratch, 't.json'));
    expect(r2.success && r2.data.errors.map((e) => e.code)).toEqual(['TSC_TIMEOUT']);
  });
});

describe('checkBaseClean (BR-U5a-07)', () => {
  it('one TS2307 on the base → MUT_BASE_NOT_CLEAN, manifest bytes unchanged', async () => {
    const manifest = newManifest();
    const before = sha(manifest);
    const r = await checkBaseClean(new FakeRunner({ exitCode: 2, stdout: TS2307 }), base, scratch);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors[0]?.code).toBe('MUT_BASE_NOT_CLEAN');
      expect(r.errors[0]?.context).toMatchObject({ errorCount: 1, codes: { TS2307: 1 } });
    }
    expect(sha(manifest)).toBe(before);
  });

  it('a clean base passes', async () => {
    const r = await checkBaseClean(new FakeRunner({}), base, scratch);
    expect(r.success && r.data).toEqual({ baseErrors: 0 });
  });
});

describe('gateMutant (BR-U5a-09)', () => {
  const derivation = { projectId: 'correct-reference', operatorId: 'MO-TEST-break', k: 0 };

  it('mutant error → one typecheck rejection, zero rows, copy removed', async () => {
    const manifest = newManifest();
    const copy = path.join(scratch, 'copy');
    fs.mkdirSync(copy);
    const out = "src/domain/entities/Task.ts(20,7): error TS2322: Type 'string' is not assignable to type 'number'.\n";
    const r = await gateMutant({
      runner: new FakeRunner({ exitCode: 2, stdout: out }),
      repoRoot: REPO,
      manifestPath: manifest,
      base,
      copyRoot: copy,
      operatorId: 'MO-TEST-break',
      rngSeed: 2184350454,
      seedDerivation: derivation,
      appliedAt: '2026-10-08T00:00:00Z',
    });
    expect(r.success && r.data).toEqual({ passed: false, errorCount: 1, codes: { TS2322: 1 } });
    expect(fs.existsSync(copy)).toBe(false);
    const m = loadManifest(REPO, manifest);
    if (!m.success) throw new Error('load');
    expect(m.data.rows).toHaveLength(0);
    expect(m.data.rejections).toHaveLength(1);
    expect(m.data.rejections[0]).toMatchObject({ operatorId: 'MO-TEST-break', reason: 'typecheck', rngSeed: 2184350454 });
    expect(JSON.parse(m.data.rejections[0]?.detail ?? '{}')).toEqual({ errorCount: 1, codes: { TS2322: 1 } });
  });

  it('clean mutant → TypecheckEvidence from the base, manifest untouched, copy kept', async () => {
    const manifest = newManifest();
    const before = sha(manifest);
    const copy = path.join(scratch, 'copy');
    fs.mkdirSync(copy);
    const r = await gateMutant({ runner: new FakeRunner({}), repoRoot: REPO, manifestPath: manifest, base, copyRoot: copy, operatorId: 'MO-S01', appliedAt: '2026-10-08T00:00:00Z' });
    expect(r.success && r.data).toEqual({ passed: true, typecheck: { tscPath: TSC, tscVersion: '5.9.3', baseErrors: 0, mutantErrors: 0 } });
    expect(sha(manifest)).toBe(before);
    expect(fs.existsSync(copy)).toBe(true);
  });
});

describe('real pinned tsc (no network)', () => {
  it('a copy of fixtures/correct-reference type-checks with zero errors under the repo tsc', async () => {
    const runner = new NodeProcessRunner();
    const prepared = await prepareFixtureBase(runner, REPO, 'fixtures/correct-reference', 'specs/clean-arch.yaml');
    if (!prepared.success) throw new Error(JSON.stringify(prepared.errors));
    const copy = await copyBase(prepared.data, path.join(scratch, 'cr'));
    if (!copy.success) throw new Error('copy');
    const clean = await checkBaseClean(runner, prepared.data, copy.data);
    expect(clean.success).toBe(true);
    fs.appendFileSync(path.join(copy.data, 'src/domain/entities/Task.ts'), "\nconst x: number = 'a';\nexport { x };\n");
    const broken = await typecheckProject(runner, prepared.data.tscPath, path.join(copy.data, 'tsconfig.json'));
    expect(broken.success && broken.data.errors.map((e) => [e.code, e.file])).toEqual([['TS2322', 'src/domain/entities/Task.ts']]);
  }, 60_000);
});
