/**
 * Readers over the three lock formats and the C5 v2 predicate (v1.3; not wired into `select-corpus.ts`, whose C5 is
 * registered as npm-only in `Docs/corpus-criteria.md`).
 *
 * - `lockTypescriptVersion(kind, text, declared?)`: the TypeScript version a lock resolves, for the `tsc: project`
 *   decision of `resolveAddedEntry` (npm: the existing reader stays in `select-corpus.ts`).
 * - `defaultPackageManager(kind, text)`: the exact package-manager pin that reads the lock without rewriting it. The
 *   lock format fixes the manager line (pnpm lockfileVersion 5 → 7.x, 6 → 8.x, 9 → 10.x; yarn berry `__metadata.version`
 *   6 → 3.x, 8 → 4.x). An unknown format gives `undefined`: the candidate stays ineligible (`unsupported-lock-format`),
 *   it is never installed with a guessed manager.
 * - `c5v2Reason(candidate)`: the C5 v2 test, `undefined` when the candidate passes.
 */
import { parse as parseYaml } from 'yaml';
import { classifyYarnLock, policyForKind } from './lockfiles.js';
import type { LockfileInstall, LockKind } from './lockfiles.js';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `5.4.5(@types/node@20.1.0)` / `5.4.5_abc` → `5.4.5`. */
const bareVersion = (v: string): string => v.replace(/\(.*$/, '').replace(/_.*$/, '').trim();

function pnpmTypescript(text: string): string | undefined {
  const lock = parseYaml(text) as unknown;
  if (!isObj(lock)) return undefined;
  // v9/v6: importers['.'].{dependencies,devDependencies}.typescript.version; v5: root-level maps with plain strings.
  const importers = isObj(lock.importers) ? lock.importers : undefined;
  const roots: Obj[] = [];
  const rootImporter = importers?.['.'];
  roots.push(isObj(rootImporter) ? rootImporter : lock);
  for (const root of roots) {
    for (const section of ['devDependencies', 'dependencies', 'optionalDependencies']) {
      const deps = root[section];
      const entry = isObj(deps) ? deps.typescript : undefined;
      if (typeof entry === 'string') return bareVersion(entry);
      if (isObj(entry) && typeof entry.version === 'string') return bareVersion(entry.version);
    }
  }
  // Fall back to the single resolved `typescript` package (`/typescript/5.1.6`, `/typescript@5.1.6`, `typescript@5.4.5`).
  const versions = new Set<string>();
  const packages = isObj(lock.packages) ? lock.packages : {};
  for (const key of Object.keys(packages)) {
    const m = /^\/?typescript(?:@|\/)(\d[^()_]*)/.exec(key);
    if (m?.[1] !== undefined) versions.add(m[1]);
  }
  return versions.size === 1 ? [...versions][0] : undefined;
}

/** A yarn v1 lock is `"a@x", b@y:\n  version "1.2.3"\n  …` blocks separated by a blank line. */
function yarnClassicTypescript(text: string, declared?: string): string | undefined {
  const found: { descriptors: string[]; version: string }[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter((l) => !l.startsWith('#') && l.trim() !== '');
    const head = lines[0];
    if (!head?.endsWith(':')) continue;
    const descriptors = head.slice(0, -1).split(',').map((d) => d.trim().replace(/^"|"$/g, ''));
    if (!descriptors.some((d) => d.startsWith('typescript@'))) continue;
    const v = lines.map((l) => /^\s+version "?([^"\s]+)"?/.exec(l)?.[1]).find((x) => x !== undefined);
    if (v !== undefined) found.push({ descriptors, version: v });
  }
  return pickTypescript(found, declared === undefined ? undefined : `typescript@${declared}`);
}

function yarnBerryTypescript(text: string, declared?: string): string | undefined {
  const lock = parseYaml(text) as unknown;
  if (!isObj(lock)) return undefined;
  const found: { descriptors: string[]; version: string }[] = [];
  for (const [key, value] of Object.entries(lock)) {
    if (key === '__metadata' || !isObj(value) || typeof value.version !== 'string') continue;
    const descriptors = key.split(',').map((d) => d.trim());
    // `typescript@npm:^5.0.0`; the `typescript@patch:…` entries wrap an npm one and are skipped.
    if (descriptors.some((d) => d.startsWith('typescript@npm:'))) found.push({ descriptors, version: value.version });
  }
  return pickTypescript(found, declared === undefined ? undefined : `typescript@npm:${declared}`);
}

function pickTypescript(found: readonly { descriptors: string[]; version: string }[], declaredDescriptor: string | undefined): string | undefined {
  const versions = [...new Set(found.map((f) => f.version))];
  if (versions.length === 1) return versions[0];
  if (declaredDescriptor !== undefined) {
    const hit = found.filter((f) => f.descriptors.includes(declaredDescriptor));
    if (hit.length > 0 && new Set(hit.map((h) => h.version)).size === 1) return hit[0]?.version;
  }
  return undefined;
}

/** `declared` is the range in the root `package.json`; it only breaks a tie between several resolved versions. */
export function lockTypescriptVersion(kind: Exclude<LockKind, 'npm'>, text: string, declared?: string): string | undefined {
  if (kind === 'pnpm') return pnpmTypescript(text);
  return kind === 'yarn-classic' ? yarnClassicTypescript(text, declared) : yarnBerryTypescript(text, declared);
}

const PNPM_BY_LOCK_MAJOR: Readonly<Record<string, string>> = { '5': 'pnpm@7.33.7', '6': 'pnpm@8.15.9', '9': 'pnpm@10.28.0' };
const BERRY_BY_METADATA: Readonly<Record<string, string>> = { '6': 'yarn@3.8.7', '8': 'yarn@4.5.3' };

/** The pinned manager that reads this lock, or `undefined` for a format the tools do not cover. */
export function defaultPackageManager(kind: Exclude<LockKind, 'npm'>, text: string): string | undefined {
  if (kind === 'yarn-classic') return 'yarn@1.22.22';
  if (kind === 'pnpm') {
    const lock = parseYaml(text) as unknown;
    const v = isObj(lock) ? lock.lockfileVersion : undefined;
    const major = (typeof v === 'number' || typeof v === 'string' ? String(v) : '').split('.')[0] ?? '';
    return PNPM_BY_LOCK_MAJOR[major];
  }
  const lock = parseYaml(text) as unknown;
  const meta = isObj(lock) && isObj(lock.__metadata) ? lock.__metadata.version : undefined;
  return typeof meta === 'number' || typeof meta === 'string' ? BERRY_BY_METADATA[String(meta)] : undefined;
}

/** The corpus-entry `install` block for a lock, or a reason it cannot be built. */
export function installForLock(kind: Exclude<LockKind, 'npm'>, lockText: string, sha256: string): { ok: true; install: LockfileInstall } | { ok: false; reason: 'unsupported-lock-format' } {
  if ((kind === 'yarn-classic' || kind === 'yarn-berry') && classifyYarnLock(lockText) !== kind) return { ok: false, reason: 'unsupported-lock-format' };
  const packageManager = defaultPackageManager(kind, lockText);
  if (packageManager === undefined) return { ok: false, reason: 'unsupported-lock-format' };
  return { ok: true, install: { policy: policyForKind(kind), lockSha256: sha256, packageManager } };
}

export interface LockCandidate {
  readonly hasPackageLock?: boolean;
  readonly hasPnpmLock?: boolean;
  readonly hasYarnLock?: boolean;
}

/**
 * C5 v2: a tracked root lock file of a kind the tools install reproducibly. `package-lock.json` still wins when
 * present (C5 v1 unchanged, whatever else is tracked). Without it, `pnpm-lock.yaml` together with `yarn.lock` is
 * `ambiguous-lock`, because the entry would have to pick one after seeing the candidate.
 */
export function c5v2Reason(c: LockCandidate): 'no-lock-file' | 'ambiguous-lock' | undefined {
  if (c.hasPackageLock === true) return undefined;
  const n = [c.hasPnpmLock, c.hasYarnLock].filter((x) => x === true).length;
  if (n === 0) return 'no-lock-file';
  return n > 1 ? 'ambiguous-lock' : undefined;
}
