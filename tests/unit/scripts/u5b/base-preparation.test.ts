/**
 * Build and Test Step 53: base-preparation steps (ADR-019 item 2; BR-U5a-04, 07, 10; BR-U5b-76).
 * Temp trees only; the repository's pinned tsc (≥ 5.5) type-checks a copy; no network, no real prisma.
 */
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import {
  MONOREPO_TSCONFIG, mirrorPackages, monorepoTsconfig, PREP_STEP_FAILED, runPreparation,
} from '../../../../scripts/lib/base-preparation.js';
import { sha256Hex, validateCorpus } from '../../../../scripts/lib/corpus.js';
import type { CorpusFile } from '../../../../scripts/lib/corpus.js';
import { copyBase, makePreparedBase, repoTscPath } from '../../../../scripts/lib/mutation/prepare.js';
import { collectImportUses, provisionStubs, writesOutsideCopy } from '../../../../scripts/lib/mutation/stubs.js';
import { typecheckProject } from '../../../../scripts/lib/mutation/typecheck.js';
import { ROOT } from './score-fixture.js';

const REPO_TSC_VERSION = (JSON.parse(readFileSync(join(ROOT, 'node_modules/typescript/package.json'), 'utf8')) as { version: string }).version;

let work: string;
beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'u5b-prep-'));
});
afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

function write(root: string, rel: string, content: string): void {
  const f = join(root, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, content);
}

const BASE = `${JSON.stringify({
  compileOnSave: false,
  compilerOptions: {
    rootDir: '.', baseUrl: '.', typeRoots: ['node_modules/@types'], strict: true, skipLibCheck: true, target: 'es2021', module: 'commonjs', moduleResolution: 'node10',
    paths: { '@mono/api/*': ['apps/api/src/*'], '@mono/common/*': ['libs/common/src/*'] },
  },
  exclude: ['node_modules'],
}, null, 2)}\n`;

/** A two-package monorepo clone with the `apps/api` sub-path base whose overlay extends the generated config. */
function monorepo(): string {
  const clone = join(work, 'clone');
  write(clone, 'tsconfig.base.json', BASE);
  write(clone, 'node_modules/left-pad/package.json', '{"name":"left-pad","version":"1.0.0","types":"index.d.ts"}\n');
  write(clone, 'node_modules/left-pad/index.d.ts', 'export declare function leftPad(s: string, n: number): string;\n');
  write(clone, 'node_modules/@scope/kit/package.json', '{"name":"@scope/kit","version":"1.0.0","types":"index.d.ts"}\n');
  write(clone, 'node_modules/@scope/kit/index.d.ts', 'export declare const kit: number;\n');
  write(clone, 'libs/common/src/util.ts', 'export const two = 2;\n');
  write(clone, 'apps/api/tsconfig.json', '{ "extends": "./tsconfig.monorepo.json", "include": ["src/**/*.ts"] }\n');
  write(clone, 'apps/api/src/a.ts', "import { leftPad } from 'left-pad';\nimport { kit } from '@scope/kit';\nimport { two } from '@mono/common/util';\nimport { b } from '@mono/api/b';\nexport const a: string = leftPad(String(kit + two + b), 3);\n");
  write(clone, 'apps/api/src/b.ts', 'export const b = 1;\n');
  return clone;
}

class FakeRunner implements ProcessRunner {
  readonly calls: { command: string; args: readonly string[]; options: ProcessRunOptions }[] = [];
  constructor(private readonly exitCode: number) {}
  run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ command, args, options });
    return Promise.resolve(DomainResult.ok({ exitCode: this.exitCode, stdout: '✔ Generated Prisma Client (v6.19.3, engine=none) to ./node_modules/@prisma/client', stderr: '', timedOut: false, durationMs: 1 }));
  }
}

describe('monorepoTsconfig (ADR-019 item 2)', () => {
  it('makes path options copy-independent: absolute into the clone, ${configDir} inside the sub-path, rootDir dropped', () => {
    const text = monorepoTsconfig(BASE, '/c/clone', 'apps/api');
    const out = JSON.parse(text) as { compilerOptions: Record<string, unknown> };
    expect(out.compilerOptions.rootDir).toBeUndefined();
    expect(out.compilerOptions.baseUrl).toBe('/c/clone');
    expect(out.compilerOptions.typeRoots).toEqual(['/c/clone/node_modules/@types']);
    expect(out.compilerOptions.paths).toEqual({ '@mono/api/*': ['${configDir}/src/*'], '@mono/common/*': ['/c/clone/libs/common/src/*'] });
    expect(out.compilerOptions.strict).toBe(true);
    expect(monorepoTsconfig(BASE, '/c/clone', 'apps/api')).toBe(text);
  });

  it('refuses an input it does not cover (extends, outDir)', () => {
    expect(() => monorepoTsconfig('{"extends":"x"}', '/c', 'a')).toThrow(/extends/);
    expect(() => monorepoTsconfig('{"compilerOptions":{"outDir":"d"}}', '/c', 'a')).toThrow(/outDir/);
  });
});

describe('runPreparation monorepo-context (ADR-019 item 2; BR-U5a-07, 10)', () => {
  it('generates the config and the package mirror; a copy elsewhere type-checks with 0 errors; a rerun is byte-identical', async () => {
    const clone = monorepo();
    const input = { projectId: 'mono', cloneDir: clone, subPath: 'apps/api', tscVersion: REPO_TSC_VERSION, steps: ['monorepo-context'] as const };
    const r1 = await runPreparation(input, { runner: new FakeRunner(0), env: {} });
    if (!r1.ok) throw new Error(r1.detail);
    const generatedText = readFileSync(join(clone, 'apps/api', MONOREPO_TSCONFIG), 'utf8');
    expect(r1.generated).toEqual([{ path: MONOREPO_TSCONFIG, sha256: sha256Hex(generatedText) }]);
    expect(lstatSync(join(clone, 'apps/api/node_modules')).isDirectory()).toBe(true);
    expect(lstatSync(join(clone, 'apps/api/node_modules/left-pad')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(clone, 'apps/api/node_modules/@scope')).isDirectory()).toBe(true);
    expect(lstatSync(join(clone, 'apps/api/node_modules/@scope/kit')).isSymbolicLink()).toBe(true);

    const r2 = await runPreparation(input, { runner: new FakeRunner(0), env: {} });
    expect(r2).toEqual(r1);

    const made = makePreparedBase({
      projectId: 'mono', baseKind: 'corpus', dir: join(clone, 'apps/api'), baseCommit: 'a'.repeat(40), tsconfigPath: 'tsconfig.json',
      tscPath: repoTscPath(ROOT), tscVersion: REPO_TSC_VERSION, overlays: r1.generated, specPath: 'corpus/specs/mono.yaml',
    });
    if (!made.success) throw new Error('base');
    const copy = join(work, 'elsewhere', 'deep', 'mono');
    const copied = await copyBase(made.data, copy);
    expect(copied.success).toBe(true);
    const tc = await typecheckProject(new NodeProcessRunner(), repoTscPath(ROOT), join(copy, 'tsconfig.json'));
    if (!tc.success) throw new Error('tsc');
    expect(tc.data.errors).toEqual([]);

    // removing the copy never follows a link into the clone's packages
    rmSync(join(work, 'elsewhere'), { recursive: true, force: true });
    expect(existsSync(join(clone, 'node_modules/left-pad/index.d.ts'))).toBe(true);
    expect(readdirSync(join(clone, 'node_modules/@scope'))).toEqual(['kit']);
  });

  it('refuses a foreign node_modules in the base, a missing subPath and a tsc below 5.5', async () => {
    const clone = monorepo();
    write(clone, 'apps/api/node_modules/own/package.json', '{}\n');
    const o = { runner: new FakeRunner(0), env: {} };
    expect(await runPreparation({ projectId: 'm', cloneDir: clone, subPath: 'apps/api', tscVersion: REPO_TSC_VERSION, steps: ['monorepo-context'] }, o)).toMatchObject({ ok: false, code: PREP_STEP_FAILED });
    expect(await runPreparation({ projectId: 'm', cloneDir: clone, tscVersion: REPO_TSC_VERSION, steps: ['monorepo-context'] }, o)).toMatchObject({ ok: false, detail: expect.stringMatching(/subPath/) as unknown });
    expect(await runPreparation({ projectId: 'm', cloneDir: clone, subPath: 'apps/api', tscVersion: '5.4.5', steps: ['monorepo-context'] }, o)).toMatchObject({ ok: false, detail: expect.stringMatching(/< 5\.5/) as unknown });
    expect(mirrorPackages(join(clone, 'node_modules'), join(clone, 'apps/api/node_modules'))).toMatch(/differs/);
  });
});

describe('runPreparation prisma-generate (ADR-019 item 2)', () => {
  it('runs the clone’s pinned prisma with --no-engine in the clone root under an explicit environment', async () => {
    const clone = monorepo();
    write(clone, 'node_modules/prisma/build/index.js', '');
    const runner = new FakeRunner(0);
    const r = await runPreparation({ projectId: 'm', cloneDir: clone, tscVersion: REPO_TSC_VERSION, steps: ['prisma-generate'] }, { runner, env: { PATH: '/usr/bin' }, nodePath: '/n/node' });
    expect(r).toMatchObject({ ok: true, generated: [] });
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.command).toBe('/n/node');
    expect(runner.calls[0]?.args).toEqual([join(clone, 'node_modules/prisma/build/index.js'), 'generate', '--no-engine']);
    expect(runner.calls[0]?.options).toMatchObject({ cwd: clone, env: { PATH: '/usr/bin', CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' } });
  });

  it('a non-zero exit or a missing prisma CLI is PREP_STEP_FAILED', async () => {
    const clone = monorepo();
    expect(await runPreparation({ projectId: 'm', cloneDir: clone, tscVersion: REPO_TSC_VERSION, steps: ['prisma-generate'] }, { runner: new FakeRunner(0), env: {} })).toMatchObject({ ok: false, detail: expect.stringMatching(/not installed/) as unknown });
    write(clone, 'node_modules/prisma/build/index.js', '');
    expect(await runPreparation({ projectId: 'm', cloneDir: clone, tscVersion: REPO_TSC_VERSION, steps: ['prisma-generate'] }, { runner: new FakeRunner(1), env: {} })).toMatchObject({ ok: false, code: PREP_STEP_FAILED });
  });
});

describe('provisionStubs never writes through a link out of the copy (BR-U5a-04, 10)', () => {
  it('refuses MUT_STUB_OUTSIDE_COPY and leaves the link target unchanged', () => {
    const pkgs = join(work, 'outside-packages');
    mkdirSync(pkgs);
    const copy = join(work, 'copy');
    write(copy, 'tsconfig.json', '{"compilerOptions":{"strict":true,"moduleResolution":"node10"},"include":["src/**/*.ts"]}\n');
    write(copy, 'src/x.ts', "import { z } from 'absent-package';\nexport const y = z;\n");
    symlinkSync(pkgs, join(copy, 'node_modules'));
    expect(writesOutsideCopy(copy, join(copy, 'node_modules', 'absent-package'))).toBe('node_modules');
    const uses = collectImportUses(copy, 'tsconfig.json');
    if (!uses.success) throw new Error('uses');
    const r = provisionStubs(copy, 'tsconfig.json', uses.data);
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.errors.map((e) => e.code)).toEqual(['MUT_STUB_OUTSIDE_COPY']);
    expect(readdirSync(pkgs)).toEqual([]);
  });
});

describe('corpus.json preparation field (ADR-019 item 2)', () => {
  const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/u5b/corpus-repo/corpus.json'), 'utf8')) as CorpusFile;
  it('accepts the closed step list and rejects an unknown step', () => {
    const e = fixture.entries[0];
    if (e === undefined) throw new Error('fixture');
    expect(validateCorpus({ ...fixture, entries: [{ ...e, preparation: ['prisma-generate', 'monorepo-context'] }] }, ROOT)).toEqual([]);
    expect(validateCorpus({ ...fixture, entries: [{ ...e, preparation: ['npm-run-build'] }] }, ROOT).join('\n')).toMatch(/CORPUS_INVALID/);
  });
});
