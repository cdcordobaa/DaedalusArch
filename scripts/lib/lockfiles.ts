/**
 * Lock-file types and reproducible installs for pnpm and yarn (v1.3; supersedes ADR-027 decision 2 for a *future*
 * registered round only; nothing registered changes).
 *
 * The frozen v1.2E install policy is `npm-ci-ignore-scripts` (`scripts/fetch-corpus.ts`); it is not touched. This
 * module adds three further policies, each hash-pinned like the npm one and each naming the exact package manager:
 *
 * | policy                              | lock file         | command (scripts ignored, lock frozen)                    |
 * |-------------------------------------|-------------------|-----------------------------------------------------------|
 * | `pnpm-frozen-ignore-scripts`        | `pnpm-lock.yaml`  | `pnpm install --frozen-lockfile --ignore-scripts`         |
 * | `yarn-classic-frozen-ignore-scripts`| `yarn.lock` (v1)  | `yarn install --frozen-lockfile --ignore-scripts`         |
 * | `yarn-berry-immutable-ignore-scripts`| `yarn.lock` (berry)| `yarn install --immutable --mode=skip-build`             |
 *
 * Pinning: the package manager never comes from the host or the project. It is run as
 * `npm exec --yes --package=<pm>@<exact version> -- <bin> …` (a pinned `npx`), so the version in the corpus entry is
 * the version that runs (`pnpm`'s own `manage-package-manager-versions` switch and berry's `yarnPath` are disabled).
 * Yarn berry is forced to the `node-modules` linker (Plug'n'Play leaves no `node_modules` for the type-check).
 *
 * The lock file is hashed before the install (`INSTALL_LOCK_MISMATCH`) and compared again after it: a frozen install
 * that rewrote the lock is a failure (`INSTALL_LOCK_MISMATCH`, not silently patched). A failed command, or a berry
 * install that produced no `node_modules`, is `INSTALL_FAILED`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProcessRunner } from '../../src/shared/interfaces/process-runner.js';

export type LockKind = 'npm' | 'pnpm' | 'yarn-classic' | 'yarn-berry';

export const LOCK_FILE: Readonly<Record<LockKind, string>> = Object.freeze({
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  'yarn-classic': 'yarn.lock',
  'yarn-berry': 'yarn.lock',
});

export const LOCKFILE_POLICIES = ['pnpm-frozen-ignore-scripts', 'yarn-classic-frozen-ignore-scripts', 'yarn-berry-immutable-ignore-scripts'] as const;
export type LockfilePolicy = (typeof LOCKFILE_POLICIES)[number];

/** Install block of a corpus entry for the new policies (`corpus.schema.json` `install` branches). */
export interface LockfileInstall {
  readonly policy: LockfilePolicy;
  readonly lockSha256: string;
  /** Exact `<pm>@<x.y.z>` that runs the install. */
  readonly packageManager: string;
}

const POLICY_KIND: Readonly<Record<LockfilePolicy, Exclude<LockKind, 'npm'>>> = {
  'pnpm-frozen-ignore-scripts': 'pnpm',
  'yarn-classic-frozen-ignore-scripts': 'yarn-classic',
  'yarn-berry-immutable-ignore-scripts': 'yarn-berry',
};

export const isLockfilePolicy = (p: string): p is LockfilePolicy => (LOCKFILE_POLICIES as readonly string[]).includes(p);
export const policyLockKind = (p: LockfilePolicy): Exclude<LockKind, 'npm'> => POLICY_KIND[p];

export function policyForKind(kind: Exclude<LockKind, 'npm'>): LockfilePolicy {
  const policy = LOCKFILE_POLICIES.find((p) => POLICY_KIND[p] === kind);
  if (policy === undefined) throw new Error(`no policy for ${kind}`);
  return policy;
}

export const sha256Of = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');

// --- detection ----------------------------------------------------------------------------------------------------

/** `yarn.lock` flavour from its text: berry is YAML with a `__metadata:` block, classic starts `# yarn lockfile v1`. */
export function classifyYarnLock(text: string): 'yarn-classic' | 'yarn-berry' | undefined {
  if (/^__metadata:/m.test(text)) return 'yarn-berry';
  if (/^# yarn lockfile v1/m.test(text)) return 'yarn-classic';
  return undefined;
}

export type Detection =
  | { readonly ok: true; readonly kind: LockKind; readonly file: string }
  | { readonly ok: false; readonly reason: 'none' | 'ambiguous' | 'unknown-yarn-format'; readonly found: readonly string[] };

/**
 * Pure detection over the files at the project root. `readYarnLock` is called only when `yarn.lock` is the single
 * lock file. A tracked `package-lock.json` always wins, whatever else is present: that is the frozen v1.2E rule
 * (a stray `yarn.lock` next to it, as in truthy-demo, never changed the policy). Without it, `pnpm-lock.yaml` and
 * `yarn.lock` together are `ambiguous`: the entry would have to pick one after seeing the candidate.
 */
export function detectLockKind(rootFiles: readonly string[], readYarnLock: () => string): Detection {
  const has = (f: string): boolean => rootFiles.includes(f);
  const found = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].filter(has);
  if (found.length === 0) return { ok: false, reason: 'none', found };
  if (has('package-lock.json')) return { ok: true, kind: 'npm', file: LOCK_FILE.npm };
  if (found.length > 1) return { ok: false, reason: 'ambiguous', found };
  if (has('pnpm-lock.yaml')) return { ok: true, kind: 'pnpm', file: LOCK_FILE.pnpm };
  const yarn = classifyYarnLock(readYarnLock());
  if (yarn === undefined) return { ok: false, reason: 'unknown-yarn-format', found };
  return { ok: true, kind: yarn, file: LOCK_FILE[yarn] };
}

/** `detectLockKind` over a directory on disk. */
export function detectLockKindInDir(dir: string): Detection {
  const files = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].filter((f) => existsSync(join(dir, f)));
  return detectLockKind(files, () => readFileSync(join(dir, 'yarn.lock'), 'utf8'));
}

// --- install planning ---------------------------------------------------------------------------------------------

const PM_PIN = /^(pnpm|yarn)@(\d+\.\d+\.\d+)$/;

/** `pnpm@9.15.4` → `{ name: 'pnpm', version: '9.15.4' }`; undefined for anything not an exact pin. */
export function parsePackageManager(pin: string): { readonly name: 'pnpm' | 'yarn'; readonly version: string } | undefined {
  const m = PM_PIN.exec(pin);
  return m === null ? undefined : { name: m[1] as 'pnpm' | 'yarn', version: m[2] ?? '' };
}

/** The pin must name the manager of the policy, and berry (≥ 2) must differ from classic (1.x). */
export function pinMatchesPolicy(install: Pick<LockfileInstall, 'policy' | 'packageManager'>): string | undefined {
  const pm = parsePackageManager(install.packageManager);
  if (pm === undefined) return `packageManager ${install.packageManager} is not an exact <pnpm|yarn>@x.y.z pin`;
  const kind = policyLockKind(install.policy);
  if (kind === 'pnpm' && pm.name !== 'pnpm') return `policy ${install.policy} needs a pnpm pin`;
  if (kind !== 'pnpm' && pm.name !== 'yarn') return `policy ${install.policy} needs a yarn pin`;
  const major = Number(pm.version.split('.')[0]);
  if (kind === 'yarn-classic' && major !== 1) return `policy ${install.policy} needs yarn 1.x, pin is ${pm.version}`;
  if (kind === 'yarn-berry' && major < 2) return `policy ${install.policy} needs yarn ≥ 2, pin is ${pm.version}`;
  return undefined;
}

export interface InstallPlan {
  readonly command: string;
  readonly args: readonly string[];
  /** Added to the caller's allow-listed environment. */
  readonly env: Readonly<Record<string, string>>;
  /** Human-readable form recorded in logs and the notes. */
  readonly display: string;
}

/**
 * The command for a lockfile policy. `launch` replaces the pinned `npm exec` launcher (tests run a local binary or a
 * mock); the policy flags are the same either way.
 */
export function planInstall(install: LockfileInstall, launch?: (pm: { name: 'pnpm' | 'yarn'; version: string; bin: string }, args: readonly string[]) => { command: string; args: readonly string[] }): InstallPlan {
  const problem = pinMatchesPolicy(install);
  if (problem !== undefined) throw new Error(problem);
  const pm = parsePackageManager(install.packageManager) as { name: 'pnpm' | 'yarn'; version: string };
  const kind = policyLockKind(install.policy);
  let args: string[];
  let env: Record<string, string> = { CI: 'true' };
  if (kind === 'pnpm') {
    args = ['install', '--frozen-lockfile', '--ignore-scripts'];
    env = { ...env, npm_config_manage_package_manager_versions: 'false', npm_config_update_notifier: 'false' };
  } else if (kind === 'yarn-classic') {
    args = ['install', '--frozen-lockfile', '--ignore-scripts', '--non-interactive'];
    env = { ...env, YARN_IGNORE_PATH: '1' };
  } else {
    args = ['install', '--immutable', '--mode=skip-build'];
    env = { ...env, YARN_IGNORE_PATH: '1', YARN_ENABLE_SCRIPTS: 'false', YARN_NODE_LINKER: 'node-modules', YARN_ENABLE_TELEMETRY: '0', YARN_ENABLE_IMMUTABLE_INSTALLS: 'true' };
  }
  // yarn ≥ 2 is published as `@yarnpkg/cli-dist` (the `yarn` package on npm is classic only).
  const pkg = kind === 'yarn-berry' ? `@yarnpkg/cli-dist@${pm.version}` : `${pm.name}@${pm.version}`;
  const launched = launch !== undefined
    ? launch({ name: pm.name, version: pm.version, bin: pm.name }, args)
    : { command: 'npm', args: ['exec', '--yes', '--no-fund', '--no-audit', `--package=${pkg}`, '--', pm.name, ...args] };
  return { command: launched.command, args: launched.args, env, display: `${launched.command} ${launched.args.join(' ')}` };
}

export type LockInstallCode = 'INSTALL_LOCK_MISMATCH' | 'INSTALL_FAILED';

export type LockInstallOutcome =
  | { readonly ok: true; readonly policy: LockfilePolicy; readonly skipped: boolean }
  | { readonly ok: false; readonly code: LockInstallCode; readonly detail: string };

export interface LockInstallOptions {
  readonly runner: ProcessRunner;
  readonly env: Readonly<Record<string, string>>;
  readonly skipInstall?: boolean;
  readonly launch?: Parameters<typeof planInstall>[1];
  readonly timeoutMs?: number;
}

/**
 * Hash-checks the lock, installs with the pinned manager, re-checks the lock. `dir` is the clone root (the lock file
 * lives there, as for npm).
 */
export async function installLockfile(install: LockfileInstall, dir: string, o: LockInstallOptions): Promise<LockInstallOutcome> {
  const kind = policyLockKind(install.policy);
  const lockPath = join(dir, LOCK_FILE[kind]);
  const lockHash = (): string => (existsSync(lockPath) ? sha256Of(readFileSync(lockPath)) : 'absent');
  const before = lockHash();
  if (before !== install.lockSha256) return { ok: false, code: 'INSTALL_LOCK_MISMATCH', detail: `${LOCK_FILE[kind]} sha256 ${before} ≠ ${install.lockSha256}` };
  if (kind === 'yarn-classic' || kind === 'yarn-berry') {
    const actual = classifyYarnLock(readFileSync(lockPath, 'utf8'));
    if (actual !== kind) return { ok: false, code: 'INSTALL_FAILED', detail: `yarn.lock is ${actual ?? 'of unknown format'}, policy ${install.policy} expects ${kind}` };
  }
  let plan: InstallPlan;
  try {
    plan = planInstall(install, o.launch);
  } catch (e) {
    return { ok: false, code: 'INSTALL_FAILED', detail: e instanceof Error ? e.message : String(e) };
  }
  if (o.skipInstall === true) return { ok: true, policy: install.policy, skipped: true };
  const r = await o.runner.run(plan.command, plan.args, { cwd: dir, env: { ...o.env, ...plan.env }, timeoutMs: o.timeoutMs ?? 1_800_000 });
  if (!r.success) return { ok: false, code: 'INSTALL_FAILED', detail: `${plan.display}: ${r.errors.map((e) => e.message).join('; ')}` };
  if (r.data.timedOut || r.data.exitCode !== 0) {
    return { ok: false, code: 'INSTALL_FAILED', detail: `${plan.display}: ${(r.data.stderr.trim() || r.data.stdout.trim()).slice(-300)}` };
  }
  const after = lockHash();
  if (after !== install.lockSha256) return { ok: false, code: 'INSTALL_LOCK_MISMATCH', detail: `${LOCK_FILE[kind]} changed by the install (${after})` };
  if (!existsSync(join(dir, 'node_modules'))) return { ok: false, code: 'INSTALL_FAILED', detail: `${plan.display}: no node_modules produced (Plug'n'Play?)` };
  return { ok: true, policy: install.policy, skipped: false };
}
