/**
 * Skeleton install, cell preparation and integrity check (U5a plan Step 18; BR-U5a-45; SECURITY-10). Temp dirs and a
 * fake runner that simulates `npm ci`; the real install is `scripts/generator/check-harness-tsconfig.ts` (D-U5a-9).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import {
  SKELETON_REL_DIR,
  checkSkeletonIntact,
  installHash,
  installListing,
  installSkeleton,
  makeWritable,
  prepareCellDir,
  removeTree,
  skeletonInstallDir,
} from '../../../../scripts/lib/generators/skeleton.js';

const REPO = process.cwd();

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: ProcessRunOptions;
}

/** Simulates `npm ci`: writes a tiny node_modules (typescript + a .bin symlink). */
class FakeNpm implements ProcessRunner {
  readonly calls: Call[] = [];
  constructor(private readonly exitCode = 0) {}
  run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls.push({ command, args, options });
    if (this.exitCode === 0 && options.cwd !== undefined) {
      const nm = path.join(options.cwd, 'node_modules');
      fs.mkdirSync(path.join(nm, 'typescript', 'lib'), { recursive: true });
      fs.writeFileSync(path.join(nm, 'typescript', 'package.json'), '{"name":"typescript","version":"5.9.3"}\n');
      fs.writeFileSync(path.join(nm, 'typescript', 'lib', 'tsc.js'), '// tsc\n');
      fs.mkdirSync(path.join(nm, '.bin'));
      fs.symlinkSync('../typescript/lib/tsc.js', path.join(nm, '.bin', 'tsc'));
    }
    return Promise.resolve(
      DomainResult.ok({ exitCode: this.exitCode, stdout: '', stderr: this.exitCode === 0 ? '' : 'ENOTCACHED', timedOut: false, durationMs: 1 }),
    );
  }
}

describe('skeleton package (SECURITY-10; D-U5a-4)', () => {
  it('pins exact versions of typescript, @types/node, express and @types/express, with its own lock', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, SKELETON_REL_DIR, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).sort()).toEqual(['@types/express', '@types/node', 'express', 'typescript']);
    for (const v of Object.values(all)) expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    expect(all.typescript).toBe('5.9.3');
    const lock = JSON.parse(fs.readFileSync(path.join(REPO, SKELETON_REL_DIR, 'package-lock.json'), 'utf8')) as {
      lockfileVersion: number;
      packages: Record<string, { version?: string; resolved?: string; hasInstallScript?: boolean }>;
    };
    expect(lock.lockfileVersion).toBe(3);
    for (const name of Object.keys(all)) expect(lock.packages[`node_modules/${name}`]?.version).toBe(all[name]);
    for (const [k, p] of Object.entries(lock.packages)) {
      if (k === '') continue;
      expect(p.resolved).toMatch(/^https:\/\/registry\.npmjs\.org\//);
      expect(p.hasInstallScript).toBeUndefined();
    }
  });
});

describe('installSkeleton / prepareCellDir / checkSkeletonIntact (BR-U5a-45)', () => {
  let tmp: string;
  let h: string;
  beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-skel-')));
    h = path.join(tmp, 'h');
    fs.mkdirSync(h);
  });
  afterEach(() => {
    removeTree(tmp);
  });

  async function installed(): Promise<{ dir: string; installHash: string }> {
    const r = await installSkeleton(new FakeNpm(), REPO, h);
    if (!r.success) throw new Error(r.errors[0]?.message);
    return r.data;
  }

  it('runs npm ci --offline --ignore-scripts in <H>/skeleton-install with an allow-listed env, then makes it read-only', async () => {
    const npm = new FakeNpm();
    const r = await installSkeleton(npm, REPO, h);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(npm.calls).toHaveLength(1);
    const call = npm.calls[0];
    expect(call?.command).toBe('npm');
    expect(call?.args).toEqual(['ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund']);
    expect(call?.options.cwd).toBe(skeletonInstallDir(h));
    expect(Object.keys(call?.options.env ?? {}).every((k) => ['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG'].includes(k))).toBe(true);
    expect(r.data.tscVersion).toBe('5.9.3');
    expect(r.data.installHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.data.installHash).toBe(installHash(r.data.dir));
    expect(fs.statSync(path.join(r.data.dir, 'package.json')).mode & 0o222).toBe(0);
    expect(fs.statSync(path.join(r.data.dir, 'node_modules')).mode & 0o222).toBe(0);
    expect(() => {
      fs.writeFileSync(path.join(r.data.dir, 'node_modules', 'x.js'), '');
    }).toThrow();
    const rec = JSON.parse(fs.readFileSync(path.join(h, 'skeleton-install.json'), 'utf8')) as { installHash: string };
    expect(rec.installHash).toBe(r.data.installHash);
  });

  it('the install listing is sorted, sized and records symlinks without following them', async () => {
    const inst = await installed();
    const lines = installListing(inst.dir);
    expect([...lines].sort()).toEqual(lines);
    expect(lines).toContain('node_modules/.bin/tsc\tlink\t../typescript/lib/tsc.js');
    expect(lines.find((l) => l.startsWith('node_modules/typescript/lib/tsc.js\t'))).toMatch(/\t7\t[0-9a-f]{64}$/);
  });

  it('a failed install is reported (no warmed cache)', async () => {
    const r = await installSkeleton(new FakeNpm(1), REPO, h);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('GEN_SKELETON_INSTALL_FAILED');
  });

  it('unchanged → skeletonIntact: true', async () => {
    const inst = await installed();
    const cwd = path.join(tmp, 'out', 'run-0');
    expect(prepareCellDir(inst, REPO, cwd).success).toBe(true);
    expect(fs.readlinkSync(path.join(cwd, 'node_modules'))).toBe(path.join(inst.dir, 'node_modules'));
    fs.mkdirSync(path.join(cwd, 'src'));
    fs.writeFileSync(path.join(cwd, 'src', 'index.ts'), 'export {};\n');
    expect(checkSkeletonIntact(inst, REPO, cwd)).toEqual({ skeletonIntact: true, problems: [] });
  });

  it('a non-empty cwd is refused', async () => {
    const inst = await installed();
    const cwd = path.join(tmp, 'out', 'run-0');
    fs.mkdirSync(cwd, { recursive: true });
    fs.writeFileSync(path.join(cwd, 'x'), '');
    const r = prepareCellDir(inst, REPO, cwd);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('GEN_CWD_NOT_EMPTY');
  });

  it('edited package.json → skeleton-tampered', async () => {
    const inst = await installed();
    const cwd = path.join(tmp, 'out', 'run-0');
    prepareCellDir(inst, REPO, cwd);
    fs.appendFileSync(path.join(cwd, 'package.json'), ' ');
    expect(checkSkeletonIntact(inst, REPO, cwd)).toEqual({
      skeletonIntact: false,
      problems: ['package-json-changed'],
      failureReason: 'skeleton-tampered',
    });
  });

  it('replaced symlink (real directory, or a link elsewhere) → skeleton-tampered', async () => {
    const inst = await installed();
    const cwd = path.join(tmp, 'out', 'run-0');
    prepareCellDir(inst, REPO, cwd);
    fs.unlinkSync(path.join(cwd, 'node_modules'));
    fs.mkdirSync(path.join(cwd, 'node_modules'));
    expect(checkSkeletonIntact(inst, REPO, cwd).problems).toEqual(['node-modules-not-symlink']);
    fs.rmSync(path.join(cwd, 'node_modules'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'other'));
    fs.symlinkSync(path.join(tmp, 'other'), path.join(cwd, 'node_modules'));
    const v = checkSkeletonIntact(inst, REPO, cwd);
    expect(v.skeletonIntact).toBe(false);
    expect(v.problems).toEqual(['node-modules-retargeted']);
    expect(v.failureReason).toBe('skeleton-tampered');
  });

  it('a file added (or changed) under the install → skeleton-tampered', async () => {
    const inst = await installed();
    const cwd = path.join(tmp, 'out', 'run-0');
    prepareCellDir(inst, REPO, cwd);
    makeWritable(inst.dir);
    fs.writeFileSync(path.join(inst.dir, 'node_modules', 'typescript', 'lib', 'evil.js'), '1');
    expect(checkSkeletonIntact(inst, REPO, cwd).problems).toEqual(['install-hash-changed']);
    fs.unlinkSync(path.join(inst.dir, 'node_modules', 'typescript', 'lib', 'evil.js'));
    expect(checkSkeletonIntact(inst, REPO, cwd).skeletonIntact).toBe(true);
    fs.writeFileSync(path.join(inst.dir, 'node_modules', 'typescript', 'lib', 'tsc.js'), '// TSC\n');
    expect(checkSkeletonIntact(inst, REPO, cwd).problems).toEqual(['install-hash-changed']);
  });

  it('a reinstall replaces a read-only previous install', async () => {
    const first = await installed();
    const second = await installed();
    expect(second.dir).toBe(first.dir);
    expect(second.installHash).toBe(first.installHash);
  });
});
