/**
 * v1.3 pnpm / yarn lock-file support: detection, pinned install plans, hash checks, the lock readers, C5 v2, and the
 * pnpm symlink handling of `copyBase`.
 *
 * Offline by default. The fixture projects (`tests/fixtures/lockfiles/<manager>`) depend only on vendored `file:`
 * packages, so a real install needs the package manager binary but no registry:
 * - pnpm and yarn classic run the binary found on `PATH` through the `launch` hook (skipped when absent);
 * - yarn berry has no global binary and is fetched by the pinned `npm exec` launcher, so its real install runs only
 *   with `LOCKFILE_NETWORK_TESTS=1` (which also runs all three managers through the pinned launcher).
 * Everything else uses a mocked `ProcessRunner`.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../../src/shared/interfaces/process-runner.js';
import { buildChildEnv, NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { validateCorpus } from '../../../../scripts/lib/corpus.js';
import type { CorpusEntry, CorpusFile } from '../../../../scripts/lib/corpus.js';
import {
  classifyYarnLock, detectLockKind, detectLockKindInDir, installLockfile, LOCKFILE_POLICIES, pinMatchesPolicy, planInstall, sha256Of,
} from '../../../../scripts/lib/lockfiles.js';
import type { LockfileInstall, LockKind } from '../../../../scripts/lib/lockfiles.js';
import { c5v2Reason, defaultPackageManager, installForLock, lockTypescriptVersion } from '../../../../scripts/lib/lockfile-readers.js';
import { isPnpmLayout, relinkPnpmCopy } from '../../../../scripts/lib/pnpm-links.js';
import type { PreparedBase } from '../../../../scripts/lib/mutation/types.js';
import { copyBase } from '../../../../scripts/lib/mutation/prepare.js';
import { fetchEntry } from '../../../../scripts/fetch-corpus.js';
import type { FetchOptions } from '../../../../scripts/fetch-corpus.js';
import { prepareBase } from '../../../../scripts/prepare-bases.js';
import type { StoredBaselineSelection } from '../../../../scripts/prepare-bases.js';
import { ROOT } from './score-fixture.js';

const FIXTURES = join(ROOT, 'tests/fixtures/lockfiles');
const NETWORK = process.env.LOCKFILE_NETWORK_TESTS === '1';
const REPO_TSC = join(ROOT, 'node_modules/typescript/bin/tsc');
const REPO_TSC_VERSION = (JSON.parse(readFileSync(join(ROOT, 'node_modules/typescript/package.json'), 'utf8')) as { version: string }).version;

type NonNpm = Exclude<LockKind, 'npm'>;
const DIRS: Readonly<Record<NonNpm, string>> = { pnpm: 'pnpm', 'yarn-classic': 'yarn-classic', 'yarn-berry': 'yarn-berry' };
const LOCKS: Readonly<Record<NonNpm, string>> = { pnpm: 'pnpm-lock.yaml', 'yarn-classic': 'yarn.lock', 'yarn-berry': 'yarn.lock' };
const POLICY: Readonly<Record<NonNpm, LockfileInstall['policy']>> = {
  pnpm: 'pnpm-frozen-ignore-scripts', 'yarn-classic': 'yarn-classic-frozen-ignore-scripts', 'yarn-berry': 'yarn-berry-immutable-ignore-scripts',
};
const fixtureLock = (k: NonNpm): string => readFileSync(join(FIXTURES, DIRS[k], LOCKS[k]), 'utf8');

function binaryVersion(bin: string): string | undefined {
  try {
    return execFileSync(bin, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 }).trim().split('\n').pop();
  } catch {
    return undefined;
  }
}
const LOCAL_PNPM = binaryVersion('pnpm');
const LOCAL_YARN = binaryVersion('yarn');

/** Pin used with the local binary: its own version, so `pinMatchesPolicy` holds. */
function installFor(kind: NonNpm, pin: string): LockfileInstall {
  return { policy: POLICY[kind], lockSha256: sha256Of(fixtureLock(kind)), packageManager: pin };
}

const localLaunch = (_pm: { name: string }, args: readonly string[]) => ({ command: _pm.name, args });

let work: string;
beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'v13-lockfiles-'));
});
afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

function copyFixture(kind: NonNpm, tag: string): string {
  const dir = join(mkdtempSync(join(work, `${tag}-`)), 'project');
  cpSync(join(FIXTURES, DIRS[kind]), dir, { recursive: true });
  return dir;
}

interface Call { readonly command: string; readonly args: readonly string[]; readonly options: ProcessRunOptions }
function mockRunner(exitCode = 0, stderr = '', onRun?: (c: Call) => void): { runner: ProcessRunner; calls: Call[] } {
  const calls: Call[] = [];
  const runner: ProcessRunner = {
    run(command, args, options) {
      const call = { command, args, options };
      calls.push(call);
      onRun?.(call);
      const data: ProcessResult = { exitCode, stdout: '', stderr, timedOut: false, durationMs: 1 };
      return Promise.resolve(DomainResult.ok(data));
    },
  };
  return { runner, calls };
}

describe('detectLockKind', () => {
  const noYarn = (): string => {
    throw new Error('yarn.lock must not be read');
  };

  it('detects each manager on the fixture projects', () => {
    expect(detectLockKindInDir(join(FIXTURES, 'pnpm'))).toEqual({ ok: true, kind: 'pnpm', file: 'pnpm-lock.yaml' });
    expect(detectLockKindInDir(join(FIXTURES, 'yarn-classic'))).toEqual({ ok: true, kind: 'yarn-classic', file: 'yarn.lock' });
    expect(detectLockKindInDir(join(FIXTURES, 'yarn-berry'))).toEqual({ ok: true, kind: 'yarn-berry', file: 'yarn.lock' });
  });

  it('keeps the v1.2E rule: package-lock.json wins over any other lock file', () => {
    expect(detectLockKind(['package-lock.json'], noYarn)).toEqual({ ok: true, kind: 'npm', file: 'package-lock.json' });
    expect(detectLockKind(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'], noYarn)).toMatchObject({ ok: true, kind: 'npm' });
  });

  it('reports none, ambiguous and unknown yarn formats instead of guessing', () => {
    expect(detectLockKind(['package.json'], noYarn)).toEqual({ ok: false, reason: 'none', found: [] });
    expect(detectLockKind(['pnpm-lock.yaml', 'yarn.lock'], noYarn)).toEqual({ ok: false, reason: 'ambiguous', found: ['pnpm-lock.yaml', 'yarn.lock'] });
    expect(detectLockKind(['yarn.lock'], () => 'something else\n')).toMatchObject({ ok: false, reason: 'unknown-yarn-format' });
  });

  it('tells yarn classic from berry by the lock text', () => {
    expect(classifyYarnLock('# yarn lockfile v1\n\nfoo@^1:\n  version "1.0.0"\n')).toBe('yarn-classic');
    expect(classifyYarnLock('__metadata:\n  version: 8\n')).toBe('yarn-berry');
    expect(classifyYarnLock('')).toBeUndefined();
  });
});

describe('planInstall: pinned manager, scripts ignored, lock frozen', () => {
  const pins: Readonly<Record<NonNpm, string>> = { pnpm: 'pnpm@9.15.4', 'yarn-classic': 'yarn@1.22.22', 'yarn-berry': 'yarn@4.5.3' };

  it.each(Object.keys(pins) as NonNpm[])('%s goes through `npm exec --package=<pin>` with the policy flags', (kind) => {
    const plan = planInstall({ policy: POLICY[kind], lockSha256: 'a'.repeat(64), packageManager: pins[kind] });
    expect(plan.command).toBe('npm');
    const sep = plan.args.indexOf('--');
    expect(plan.args.slice(0, sep)).toEqual(expect.arrayContaining(['exec', '--yes', kind === 'yarn-berry' ? '--package=@yarnpkg/cli-dist@4.5.3' : `--package=${pins[kind]}`]));
    const tail = plan.args.slice(sep + 1);
    expect(tail[0]).toBe(kind === 'pnpm' ? 'pnpm' : 'yarn');
    expect(plan.env.CI).toBe('true');
    if (kind === 'pnpm') {
      expect(tail).toEqual(['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts']);
      expect(plan.env.npm_config_manage_package_manager_versions).toBe('false');
    } else if (kind === 'yarn-classic') {
      expect(tail).toEqual(['yarn', 'install', '--frozen-lockfile', '--ignore-scripts', '--non-interactive']);
      expect(plan.env.YARN_IGNORE_PATH).toBe('1');
    } else {
      expect(tail).toEqual(['yarn', 'install', '--immutable', '--mode=skip-build']);
      expect(plan.env).toMatchObject({ YARN_ENABLE_SCRIPTS: 'false', YARN_NODE_LINKER: 'node-modules', YARN_IGNORE_PATH: '1', YARN_ENABLE_IMMUTABLE_INSTALLS: 'true' });
    }
  });

  it('refuses a pin that is not exact or names the wrong manager', () => {
    expect(pinMatchesPolicy({ policy: 'pnpm-frozen-ignore-scripts', packageManager: 'pnpm@^9' })).toMatch(/exact/);
    expect(pinMatchesPolicy({ policy: 'pnpm-frozen-ignore-scripts', packageManager: 'yarn@1.22.22' })).toMatch(/pnpm pin/);
    expect(pinMatchesPolicy({ policy: 'yarn-classic-frozen-ignore-scripts', packageManager: 'yarn@4.5.3' })).toMatch(/1\.x/);
    expect(pinMatchesPolicy({ policy: 'yarn-berry-immutable-ignore-scripts', packageManager: 'yarn@1.22.22' })).toMatch(/≥ 2/);
    expect(pinMatchesPolicy({ policy: 'yarn-berry-immutable-ignore-scripts', packageManager: 'pnpm@9.0.0' })).toMatch(/yarn pin/);
    expect(() => planInstall({ policy: 'pnpm-frozen-ignore-scripts', lockSha256: 'a'.repeat(64), packageManager: 'latest' })).toThrow(/exact/);
  });

  it('covers every policy the schema allows', () => {
    expect([...LOCKFILE_POLICIES].sort()).toEqual(Object.values(POLICY).sort());
  });
});

describe('installLockfile (mocked runner)', () => {
  it.each(Object.keys(DIRS) as NonNpm[])('%s: a wrong lock hash is refused before any process starts', async (kind) => {
    const dir = copyFixture(kind, 'hash');
    const { runner, calls } = mockRunner();
    const pin = kind === 'pnpm' ? 'pnpm@9.15.4' : kind === 'yarn-classic' ? 'yarn@1.22.22' : 'yarn@4.5.3';
    const r = await installLockfile({ ...installFor(kind, pin), lockSha256: 'f'.repeat(64) }, dir, { runner, env: {} });
    expect(r).toMatchObject({ ok: false, code: 'INSTALL_LOCK_MISMATCH' });
    expect(calls).toHaveLength(0);
  });

  it('runs the planned command in the project directory with the allow-listed env plus the policy env', async () => {
    const dir = copyFixture('pnpm', 'run');
    const { runner, calls } = mockRunner(0, '', () => mkdirSync(join(dir, 'node_modules'), { recursive: true }));
    const r = await installLockfile(installFor('pnpm', 'pnpm@9.15.4'), dir, { runner, env: { PATH: '/bin' } });
    expect(r).toEqual({ ok: true, policy: 'pnpm-frozen-ignore-scripts', skipped: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.options.cwd).toBe(dir);
    expect(calls[0]?.options.env).toMatchObject({ PATH: '/bin', CI: 'true', npm_config_manage_package_manager_versions: 'false' });
    expect(calls[0]?.args).toContain('--frozen-lockfile');
    expect(calls[0]?.args).toContain('--ignore-scripts');
  });

  it('fails on a non-zero exit with the tail of stderr', async () => {
    const dir = copyFixture('yarn-classic', 'fail');
    const { runner } = mockRunner(1, 'error Your lockfile needs to be updated, but yarn was executed with --frozen-lockfile.');
    const r = await installLockfile(installFor('yarn-classic', 'yarn@1.22.22'), dir, { runner, env: {} });
    expect(r).toMatchObject({ ok: false, code: 'INSTALL_FAILED' });
    expect(r.ok ? '' : r.detail).toContain('needs to be updated');
  });

  it('fails closed when the install rewrote the lock file', async () => {
    const dir = copyFixture('yarn-classic', 'rewrite');
    const { runner } = mockRunner(0, '', () => {
      mkdirSync(join(dir, 'node_modules'), { recursive: true });
      writeFileSync(join(dir, 'yarn.lock'), `${fixtureLock('yarn-classic')}# touched\n`);
    });
    const r = await installLockfile(installFor('yarn-classic', 'yarn@1.22.22'), dir, { runner, env: {} });
    expect(r).toMatchObject({ ok: false, code: 'INSTALL_LOCK_MISMATCH' });
    expect(r.ok ? '' : r.detail).toContain('changed by the install');
  });

  it('refuses a berry install that left no node_modules (Plug\'n\'Play)', async () => {
    const dir = copyFixture('yarn-berry', 'pnp');
    const { runner } = mockRunner();
    const r = await installLockfile(installFor('yarn-berry', 'yarn@4.5.3'), dir, { runner, env: {} });
    expect(r).toMatchObject({ ok: false, code: 'INSTALL_FAILED' });
    expect(r.ok ? '' : r.detail).toContain('node_modules');
  });

  it('refuses a policy whose yarn flavour disagrees with the lock', async () => {
    const dir = copyFixture('yarn-berry', 'flavour');
    const { runner, calls } = mockRunner();
    const wrong: LockfileInstall = { policy: 'yarn-classic-frozen-ignore-scripts', lockSha256: sha256Of(fixtureLock('yarn-berry')), packageManager: 'yarn@1.22.22' };
    const r = await installLockfile(wrong, dir, { runner, env: {} });
    expect(r).toMatchObject({ ok: false, code: 'INSTALL_FAILED' });
    expect(calls).toHaveLength(0);
  });

  it('skipInstall checks the hash and the pin but starts nothing', async () => {
    const dir = copyFixture('pnpm', 'skip');
    const { runner, calls } = mockRunner();
    expect(await installLockfile(installFor('pnpm', 'pnpm@9.15.4'), dir, { runner, env: {}, skipInstall: true })).toEqual({ ok: true, policy: 'pnpm-frozen-ignore-scripts', skipped: true });
    expect(calls).toHaveLength(0);
    expect(await installLockfile(installFor('pnpm', 'pnpm@latest'), dir, { runner, env: {}, skipInstall: true })).toMatchObject({ ok: false, code: 'INSTALL_FAILED' });
  });
});

describe('lock readers', () => {
  const PNPM_V9 = "lockfileVersion: '9.0'\nimporters:\n  .:\n    devDependencies:\n      typescript:\n        specifier: ^5.4.0\n        version: 5.4.5\npackages:\n  typescript@5.4.5:\n    resolution: {integrity: sha512-x}\n";
  const PNPM_V6 = "lockfileVersion: '6.0'\ndevDependencies:\n  typescript:\n    specifier: ^5.1.0\n    version: 5.1.6\npackages:\n  /typescript@5.1.6:\n    resolution: {integrity: sha512-x}\n";
  const PNPM_V5 = 'lockfileVersion: 5.4\nspecifiers:\n  typescript: ^4.9.0\ndevDependencies:\n  typescript: 4.9.5\npackages:\n  /typescript/4.9.5:\n    resolution: {integrity: sha512-x}\n';
  const PNPM_TRANSITIVE = "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      nest:\n        specifier: 1.0.0\n        version: 1.0.0\npackages:\n  typescript@5.2.2:\n    resolution: {integrity: sha512-x}\n";
  const YARN1 = '# yarn lockfile v1\n\n\ntypescript@^5.0.0, typescript@~5.0.2:\n  version "5.0.4"\n  resolved "https://registry.yarnpkg.com/typescript/-/typescript-5.0.4.tgz#x"\n\nts-node@^10:\n  version "10.9.1"\n';
  const YARN1_TWO = '# yarn lockfile v1\n\n\n"typescript@^4.0.0":\n  version "4.9.5"\n\ntypescript@^5.0.0:\n  version "5.0.4"\n';
  const BERRY = '__metadata:\n  version: 8\n  cacheKey: 10c0\n\n"typescript@npm:^5.0.0":\n  version: 5.5.4\n  resolution: "typescript@npm:5.5.4"\n\n"typescript@patch:typescript@npm%3A^5.0.0#optional!builtin<compat/typescript>":\n  version: 5.5.4\n  resolution: "typescript@patch:typescript@npm%3A5.5.4#optional!builtin<compat/typescript>::version=5.5.4&hash=x"\n';

  it('reads the TypeScript version from pnpm v9, v6 and v5 locks', () => {
    expect(lockTypescriptVersion('pnpm', PNPM_V9)).toBe('5.4.5');
    expect(lockTypescriptVersion('pnpm', PNPM_V6)).toBe('5.1.6');
    expect(lockTypescriptVersion('pnpm', PNPM_V5)).toBe('4.9.5');
    expect(lockTypescriptVersion('pnpm', PNPM_TRANSITIVE)).toBe('5.2.2');
    expect(lockTypescriptVersion('pnpm', "lockfileVersion: '9.0'\n")).toBeUndefined();
  });

  it('reads it from yarn classic and berry locks, using the declared range to break a tie', () => {
    expect(lockTypescriptVersion('yarn-classic', YARN1)).toBe('5.0.4');
    expect(lockTypescriptVersion('yarn-classic', YARN1_TWO)).toBeUndefined();
    expect(lockTypescriptVersion('yarn-classic', YARN1_TWO, '^5.0.0')).toBe('5.0.4');
    expect(lockTypescriptVersion('yarn-berry', BERRY)).toBe('5.5.4');
    expect(lockTypescriptVersion('yarn-berry', '__metadata:\n  version: 8\n')).toBeUndefined();
  });

  it('picks the manager line from the lock format and refuses formats it does not know', () => {
    expect(defaultPackageManager('pnpm', PNPM_V9)).toBe('pnpm@10.28.0');
    expect(defaultPackageManager('pnpm', PNPM_V6)).toBe('pnpm@8.15.9');
    expect(defaultPackageManager('pnpm', PNPM_V5)).toBe('pnpm@7.33.7');
    expect(defaultPackageManager('pnpm', "lockfileVersion: '99.0'\n")).toBeUndefined();
    expect(defaultPackageManager('yarn-classic', YARN1)).toBe('yarn@1.22.22');
    expect(defaultPackageManager('yarn-berry', BERRY)).toBe('yarn@4.5.3');
    expect(defaultPackageManager('yarn-berry', '__metadata:\n  version: 99\n')).toBeUndefined();
  });

  it('builds the corpus install block, validated against the pin rules', () => {
    const berry = fixtureLock('yarn-berry');
    const r = installForLock('yarn-berry', berry, sha256Of(berry));
    expect(r).toEqual({ ok: true, install: { policy: 'yarn-berry-immutable-ignore-scripts', lockSha256: sha256Of(berry), packageManager: 'yarn@4.5.3' } });
    if (r.ok) expect(pinMatchesPolicy(r.install)).toBeUndefined();
    expect(installForLock('yarn-berry', YARN1, 'a'.repeat(64))).toEqual({ ok: false, reason: 'unsupported-lock-format' });
    expect(installForLock('pnpm', "lockfileVersion: '99.0'\n", 'a'.repeat(64))).toEqual({ ok: false, reason: 'unsupported-lock-format' });
  });

  it('reads the real fixture locks', () => {
    expect(defaultPackageManager('pnpm', fixtureLock('pnpm'))).toBe('pnpm@10.28.0');
    expect(defaultPackageManager('yarn-classic', fixtureLock('yarn-classic'))).toBe('yarn@1.22.22');
  });
});

describe('c5v2Reason', () => {
  it('keeps npm eligible and admits a single pnpm or yarn lock', () => {
    expect(c5v2Reason({ hasPackageLock: true })).toBeUndefined();
    expect(c5v2Reason({ hasPackageLock: true, hasYarnLock: true })).toBeUndefined();
    expect(c5v2Reason({ hasPnpmLock: true })).toBeUndefined();
    expect(c5v2Reason({ hasYarnLock: true })).toBeUndefined();
  });

  it('excludes a candidate with no lock file or with two competing ones', () => {
    expect(c5v2Reason({})).toBe('no-lock-file');
    expect(c5v2Reason({ hasPackageLock: false, hasPnpmLock: false, hasYarnLock: false })).toBe('no-lock-file');
    expect(c5v2Reason({ hasPnpmLock: true, hasYarnLock: true })).toBe('ambiguous-lock');
  });
});

describe('corpus schema', () => {
  const entry = (install: unknown): unknown => ({
    name: 'o__r', originUrl: 'https://github.com/o/r.git', licence: 'mit', commitSha: 'a'.repeat(40), core: false,
    specPath: 'corpus/specs/o__r.yaml', overlays: [], install, tsc: { kind: 'repo-pinned', tscPath: 'node_modules/typescript/bin/tsc', tscVersion: '5.9.3' },
  });
  const file = (install: unknown): unknown => ({ version: 1, entries: [entry(install)] });

  it('accepts the three new install policies and still the two old ones', () => {
    expect(validateCorpus(file({ policy: 'none' }), ROOT)).toEqual([]);
    expect(validateCorpus(file({ policy: 'npm-ci-ignore-scripts', lockSha256: 'a'.repeat(64) }), ROOT)).toEqual([]);
    for (const [policy, pm] of [['pnpm-frozen-ignore-scripts', 'pnpm@10.28.0'], ['yarn-classic-frozen-ignore-scripts', 'yarn@1.22.22'], ['yarn-berry-immutable-ignore-scripts', 'yarn@4.5.3']]) {
      expect(validateCorpus(file({ policy, lockSha256: 'a'.repeat(64), packageManager: pm }), ROOT)).toEqual([]);
    }
  });

  it('rejects a new policy without a pin, with a floating pin or with extra fields', () => {
    expect(validateCorpus(file({ policy: 'pnpm-frozen-ignore-scripts', lockSha256: 'a'.repeat(64) }), ROOT).length).toBeGreaterThan(0);
    expect(validateCorpus(file({ policy: 'pnpm-frozen-ignore-scripts', lockSha256: 'a'.repeat(64), packageManager: 'pnpm@latest' }), ROOT).length).toBeGreaterThan(0);
    expect(validateCorpus(file({ policy: 'pnpm-frozen-ignore-scripts', lockSha256: 'a'.repeat(64), packageManager: 'pnpm@10.28.0', extra: 1 }), ROOT).length).toBeGreaterThan(0);
    expect(validateCorpus(file({ policy: 'npm-ci-ignore-scripts', lockSha256: 'a'.repeat(64), packageManager: 'pnpm@10.28.0' }), ROOT).length).toBeGreaterThan(0);
  });
});

// --- pnpm links in copyBase --------------------------------------------------------------------------------------

const plainBase = (projectId: string, dir: string): PreparedBase => ({
  projectId, baseKind: 'corpus', dir, baseCommit: 'a'.repeat(40), tsconfigPath: 'tsconfig.json', tscPath: REPO_TSC, tscVersion: REPO_TSC_VERSION,
  overlays: [], specPath: 'x.yaml', capped: false,
});

describe('relinkPnpmCopy', () => {
  /** A hand-made pnpm layout: relative links inside the base, one absolute link into it, one relative link out of it. */
  function synthetic(): { clone: string; base: string } {
    const clone = mkdtempSync(join(work, 'syn-'));
    const base = join(clone, 'apps/api');
    mkdirSync(join(base, 'node_modules/.pnpm/dep-a@1.0.0/node_modules/dep-a'), { recursive: true });
    mkdirSync(join(base, 'node_modules/.pnpm/dep-b@1.0.0/node_modules/dep-b'), { recursive: true });
    mkdirSync(join(clone, 'node_modules/.pnpm/root-dep@1.0.0/node_modules/root-dep'), { recursive: true });
    writeFileSync(join(base, 'node_modules/.pnpm/dep-a@1.0.0/node_modules/dep-a/index.js'), 'a\n');
    writeFileSync(join(base, 'node_modules/.pnpm/dep-b@1.0.0/node_modules/dep-b/index.js'), 'b\n');
    writeFileSync(join(clone, 'node_modules/.pnpm/root-dep@1.0.0/node_modules/root-dep/index.js'), 'r\n');
    // relative, inside the base
    symlinkSync('.pnpm/dep-a@1.0.0/node_modules/dep-a', join(base, 'node_modules/dep-a'));
    // sibling link inside the virtual store: dep-a sees dep-b
    symlinkSync('../../dep-b@1.0.0/node_modules/dep-b', join(base, 'node_modules/.pnpm/dep-a@1.0.0/node_modules/dep-b'));
    // absolute, into the base
    symlinkSync(join(base, 'node_modules/.pnpm/dep-b@1.0.0/node_modules/dep-b'), join(base, 'node_modules/dep-b'));
    // relative, leaving the base (workspace root store)
    symlinkSync('../../../node_modules/.pnpm/root-dep@1.0.0/node_modules/root-dep', join(base, 'node_modules/root-dep'));
    // dangling (skipped optional dependency)
    symlinkSync('.pnpm/missing@1.0.0/node_modules/missing', join(base, 'node_modules/missing'));
    return { clone, base };
  }

  it('is only for pnpm layouts', () => {
    const { base, clone } = synthetic();
    expect(isPnpmLayout(base)).toBe(true);
    expect(isPnpmLayout(clone)).toBe(true);
    const plain = mkdtempSync(join(work, 'plain-'));
    mkdirSync(join(plain, 'node_modules/.bin'), { recursive: true });
    expect(isPnpmLayout(plain)).toBe(false);
  });

  it('makes every link resolve as in the source, and leaves nothing pointing back into the source', async () => {
    const { base } = synthetic();
    const copy = join(mkdtempSync(join(work, 'syn-copy-')), 'base');
    const copied = await copyBase(plainBase('syn', base), copy);
    expect(copied.success).toBe(true);

    const nm = (p: string): string => join(copy, 'node_modules', p);
    // inside-relative: unchanged, resolves in the copy
    expect(readlinkSync(nm('dep-a'))).toBe('.pnpm/dep-a@1.0.0/node_modules/dep-a');
    expect(realpathSync(nm('dep-a'))).toBe(realpathSync(join(copy, 'node_modules/.pnpm/dep-a@1.0.0/node_modules/dep-a')));
    expect(readFileSync(nm('dep-a/index.js'), 'utf8')).toBe('a\n');
    // sibling link inside the store
    expect(readFileSync(nm('.pnpm/dep-a@1.0.0/node_modules/dep-b/index.js'), 'utf8')).toBe('b\n');
    // absolute-into-base: now relative, inside the copy
    expect(readlinkSync(nm('dep-b'))).not.toMatch(/^\//);
    expect(realpathSync(nm('dep-b')).startsWith(realpathSync(copy))).toBe(true);
    // relative-out-of-base: absolute to the original, which still exists
    expect(readlinkSync(nm('root-dep'))).toBe(join(base, '../../node_modules/.pnpm/root-dep@1.0.0/node_modules/root-dep'));
    expect(readFileSync(nm('root-dep/index.js'), 'utf8')).toBe('r\n');
    // dangling stays dangling
    expect(lstatSync(nm('missing')).isSymbolicLink()).toBe(true);
    expect(existsSync(nm('missing'))).toBe(false);
  });

  it('reports what it changed, and is idempotent', () => {
    const { base } = synthetic();
    const copy = join(mkdtempSync(join(work, 'syn-rep-')), 'base');
    mkdirSync(dirname(copy), { recursive: true });
    cpSync(base, copy, { recursive: true, verbatimSymlinks: true });
    const first = relinkPnpmCopy(base, copy);
    expect(first.relinkedInside).toEqual(['node_modules/dep-b']);
    expect(first.relinkedOutside).toEqual(['node_modules/root-dep']);
    expect(first.dangling).toEqual(['node_modules/missing']);
    expect(first.total).toBe(5);
    const second = relinkPnpmCopy(base, copy);
    expect(second.relinkedOutside).toEqual([]);
    expect(second.relinkedInside).toEqual([]);
  });

  it('does not touch an npm base: the copy is byte-for-byte what fs.cp makes', async () => {
    const npmBase = mkdtempSync(join(work, 'npm-'));
    mkdirSync(join(npmBase, 'node_modules/pkg/bin'), { recursive: true });
    mkdirSync(join(npmBase, 'node_modules/.bin'), { recursive: true });
    writeFileSync(join(npmBase, 'node_modules/pkg/bin/cli.js'), 'x\n');
    symlinkSync('../pkg/bin/cli.js', join(npmBase, 'node_modules/.bin/cli'));
    symlinkSync(join(npmBase, 'node_modules/pkg'), join(npmBase, 'node_modules/abs')); // absolute link into the base: v1.2E copies it verbatim
    const copy = join(mkdtempSync(join(work, 'npm-copy-')), 'base');
    const r = await copyBase(plainBase('npm', npmBase), copy);
    expect(r.success).toBe(true);
    expect(readlinkSync(join(copy, 'node_modules/abs'))).toBe(join(npmBase, 'node_modules/pkg'));
    expect(relative(copy, join(copy, 'node_modules/.bin/cli'))).toBe('node_modules/.bin/cli');
    expect(readlinkSync(join(copy, 'node_modules/.bin/cli'))).toBe('../pkg/bin/cli.js');
  });
});

// --- real installs, fetch, prepare, copy and type-check -----------------------------------------------------------

const storedSelection = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/u5b/corpus-repo/selection.json'), 'utf8')) as StoredBaselineSelection;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '', HOME: work, GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
      GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
    },
  }).trim();
}

/** A bare repository holding the fixture project (lock files included), as `fetchEntry` clones it. */
function bareRepoOf(kind: NonNpm): { bare: string; sha: string } {
  const src = join(mkdtempSync(join(work, `repo-${kind}-`)), 'src');
  cpSync(join(FIXTURES, DIRS[kind]), src, { recursive: true });
  writeFileSync(join(src, '.gitignore'), 'node_modules/\n');
  git(work, 'init', '-q', '-b', 'main', src);
  git(src, 'add', '-A', '-f');
  git(src, 'commit', '-q', '-m', 'fixture');
  const sha = git(src, 'rev-parse', 'HEAD');
  const bare = `${src}.git`;
  git(work, 'clone', '-q', '--bare', src, bare);
  return { bare, sha };
}

function corpusEntry(kind: NonNpm, bare: string, sha: string, pin: string): CorpusEntry {
  return {
    name: 'fixture-repo', originUrl: bare, licence: 'mit', commitSha: sha, core: false, specPath: 'corpus/specs/fixture-repo.yaml', overlays: [],
    install: installFor(kind, pin), tsc: { kind: 'repo-pinned', tscPath: 'node_modules/typescript/bin/tsc', tscVersion: REPO_TSC_VERSION },
  };
}

/** The fetch CLI's allow-list; the network tests add the proxy / CA variables a sandboxed or corporate host needs. */
const NETWORK_ENV = ['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'npm_config_https_proxy', 'npm_config_proxy', 'npm_config_noproxy', 'npm_config_cafile'];
const fetchOpts = (extra: Partial<FetchOptions> = {}): FetchOptions => ({
  repoRoot: ROOT, runner: new NodeProcessRunner(), env: buildChildEnv(process.env, ['PATH', 'HOME', 'TMPDIR', 'npm_config_cache', ...(NETWORK ? NETWORK_ENV : [])]),
  now: () => new Date('2026-10-12T00:00:00Z'), ...extra,
});

interface RealCase { readonly kind: NonNpm; readonly pin: string | undefined; readonly launch: FetchOptions['launch']; readonly label: string }
const REAL: readonly RealCase[] = [
  { kind: 'pnpm', pin: LOCAL_PNPM === undefined ? undefined : `pnpm@${LOCAL_PNPM}`, launch: localLaunch, label: 'pnpm (local binary)' },
  { kind: 'yarn-classic', pin: LOCAL_YARN?.startsWith('1.') === true ? `yarn@${LOCAL_YARN}` : undefined, launch: localLaunch, label: 'yarn classic (local binary)' },
  ...(NETWORK ? [
    { kind: 'pnpm', pin: 'pnpm@10.28.0', launch: undefined, label: 'pnpm (pinned npm exec)' },
    { kind: 'yarn-classic', pin: 'yarn@1.22.22', launch: undefined, label: 'yarn classic (pinned npm exec)' },
    { kind: 'yarn-berry', pin: 'yarn@4.5.3', launch: undefined, label: 'yarn berry (pinned npm exec)' },
  ] as RealCase[] : []),
];

describe.each(REAL.filter((c) => c.pin !== undefined))('real install: $label', ({ kind, pin, launch }) => {
  const pinned = pin ?? '';
  let clone: string;

  beforeAll(async () => {
    const { bare, sha } = bareRepoOf(kind);
    clone = join(mkdtempSync(join(work, `fetch-${kind}-`)), 'clone');
    const r = await fetchEntry(corpusEntry(kind, bare, sha, pinned), clone, fetchOpts({ ...(launch !== undefined ? { launch } : {}) }));
    if (!r.ok) throw new Error(`${r.code}: ${r.detail}`);
    if (r.checkedOnly) throw new Error('checked only');
    expect(r.record.installPolicy).toBe(POLICY[kind]);
    expect(r.record.treeHash).toMatch(/^[0-9a-f]{40}$/);
  }, 600_000);

  it('installs from the frozen lock with scripts ignored and leaves the lock untouched', () => {
    expect(existsSync(join(clone, 'node_modules/pkg-a/package.json'))).toBe(true);
    expect(existsSync(join(clone, 'POSTINSTALL_RAN'))).toBe(false);
    expect(sha256Of(readFileSync(join(clone, LOCKS[kind])))).toBe(sha256Of(fixtureLock(kind)));
    expect(git(clone, 'status', '--porcelain', '--', LOCKS[kind])).toBe('');
  });

  it('prepares a base, copies it and type-checks in the copy', async () => {
    const entry = corpusEntry(kind, clone, 'a'.repeat(40), pinned);
    const prepared = await prepareBase(entry, clone, storedSelection, { repoRoot: ROOT, runner: new NodeProcessRunner(), env: buildChildEnv(process.env, ['PATH', 'HOME']) });
    if (!prepared.ok) throw new Error(`${prepared.code}: ${prepared.detail}`);
    expect(prepared.base.installLockSha256).toBe(sha256Of(fixtureLock(kind)));

    const copy = join(mkdtempSync(join(work, `copy-${kind}-`)), 'base');
    const copied = await copyBase(prepared.base, copy);
    expect(copied.success).toBe(true);
    expect(isPnpmLayout(clone)).toBe(kind === 'pnpm');
    if (kind === 'pnpm') {
      // the app's link is a symlink into the copy's own virtual store, not into the original clone
      const link = join(copy, 'node_modules/pkg-a');
      expect(lstatSync(link).isSymbolicLink()).toBe(true);
      expect(realpathSync(link).startsWith(realpathSync(copy))).toBe(true);
      // pkg-b is reachable only through pkg-a's virtual-store entry
      expect(existsSync(join(realpathSync(link), '../pkg-b/index.js'))).toBe(true);
    }

    const tsc = execFileSync('node', [REPO_TSC, '-p', 'tsconfig.json', '--noEmit'], { cwd: copy, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    expect(tsc).toBe('');
    // the copy is writable and the source is untouched (BR-U5a-04)
    writeFileSync(join(copy, 'src/extra.ts'), 'export const extra = 1;\n');
    expect(existsSync(join(clone, 'src/extra.ts'))).toBe(false);
  }, 120_000);
});

describe('fetchEntry with a lockfile policy (mocked runner)', () => {
  it('refuses a lock-hash mismatch with INSTALL_LOCK_MISMATCH before installing', async () => {
    const { bare, sha } = bareRepoOf('pnpm');
    const { runner, calls } = mockRunner();
    const spy: ProcessRunner = { run: (c, a, o) => (c === 'git' ? new NodeProcessRunner().run(c, a, o) : runner.run(c, a, o)) };
    const e = { ...corpusEntry('pnpm', bare, sha, 'pnpm@10.28.0'), install: { ...installFor('pnpm', 'pnpm@10.28.0'), lockSha256: 'f'.repeat(64) } };
    const r = await fetchEntry(e, join(mkdtempSync(join(work, 'mm-')), 'clone'), fetchOpts({ runner: spy }));
    expect(r).toMatchObject({ ok: false, code: 'INSTALL_LOCK_MISMATCH' });
    expect(calls).toHaveLength(0);
  });

  it('--no-install records skipped:<policy> and still hashes the tree', async () => {
    const { bare, sha } = bareRepoOf('yarn-berry');
    const r = await fetchEntry(corpusEntry('yarn-berry', bare, sha, 'yarn@4.5.3'), join(mkdtempSync(join(work, 'skip-')), 'clone'), fetchOpts({ skipInstall: true }));
    if (!r.ok || r.checkedOnly) throw new Error(JSON.stringify(r));
    expect(r.record.installPolicy).toBe('skipped:yarn-berry-immutable-ignore-scripts');
    expect(r.record.treeHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('keeps the schema-valid corpus file shape for a lockfile entry', () => {
    const f: CorpusFile = { version: 1, entries: [corpusEntry('pnpm', 'https://github.com/o/r.git', 'a'.repeat(40), 'pnpm@10.28.0')] };
    expect(validateCorpus(JSON.parse(JSON.stringify(f)), ROOT)).toEqual([]);
  });
});
