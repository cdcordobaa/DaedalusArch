/**
 * Study 2 evasion check (M6; `Docs/v1.4/evasion-check.md`): the violation-identity seam and the snapshot rename map.
 *
 * Identity. The evasion check never defines a blocking identity itself; it takes an `IdentityOf`, which may give more
 * than one key per finding (U4's edge keys: `edgeKeys(fromBlockingFinding(f), STUDY2_S2D01): string[]` in
 * `scripts/lib/drift/identity.ts`). U4's module is not on this branch, so the default is the pilot-memo identity
 * `findingIdentity` of `scripts/lib/loop/pilot-metrics.ts` (rule, template, file, target; a cycle as its sorted file
 * set). That identity is PER RULE, not per edge: a report made with it is a dry-run artefact only (design R8). When U4
 * lands, `defaultIdentity` and `IDENTITY_NAME` are the one-line swap, and `renameMap` becomes U4's `renameMapBetween`.
 *
 * Rename map. ρ from snapshot a to snapshot b of one run's store: `git diff --name-status -M50% -l5000 a b -- src`
 * (local git, no network). An `R` row is a rename; a `C` (copy) row is not. When git skipped inexact rename detection
 * (too many files), the transition is flagged `skipped`.
 */
import { spawnSync } from 'node:child_process';
import { findingIdentity } from '../../../lib/loop/pilot-metrics.js';
import type { BlockingFinding } from '../../../lib/loop/types.js';

export type IdentityOf = (f: BlockingFinding) => readonly string[];

export type IdentityName = 'u4-edge' | 'pilot-metrics';

/** Which identity function `defaultIdentity` is (recorded in every report). */
export const IDENTITY_NAME: IdentityName = 'pilot-metrics';

/** The default identity: the pilot-memo identity, one key per finding (swap for U4's edge keys when it lands). */
export const defaultIdentity: IdentityOf = (f) => [findingIdentity(f)];

export interface RenameMap {
  /** Old tree path → new tree path (`src/...`), rename rows only. */
  readonly map: ReadonlyMap<string, string>;
  readonly renameDetection: 'full' | 'skipped';
}

export const EMPTY_RENAME: RenameMap = Object.freeze({ map: new Map<string, string>(), renameDetection: 'full' as const });

/** Parses `git diff --name-status` output (tab separated; `R<score>` and `C<score>` rows carry two paths). */
export function parseNameStatus(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const cols = line.split('\t');
    const status = cols[0] ?? '';
    if (status.startsWith('R') && cols[1] !== undefined && cols[2] !== undefined) map.set(cols[1], cols[2]);
  }
  return map;
}

const SKIPPED_RE = /inexact rename detection was skipped/i;

/**
 * ρ between two commits of a run's snapshot store (local git only). MARKED FOR REMOVAL when U4's `renameMapBetween`
 * lands (design §2.2).
 */
export function renameMap(gitDir: string, a: string, b: string): RenameMap {
  const r = spawnSync('git', [`--git-dir=${gitDir}`, 'diff', '--name-status', '-M50%', '-l5000', a, b, '--', 'src'], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C' },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error !== undefined || r.status !== 0) throw new Error(`git diff --name-status failed: ${r.error?.message ?? r.stderr.trim()}`);
  return { map: parseNameStatus(r.stdout), renameDetection: SKIPPED_RE.test(r.stderr) ? 'skipped' : 'full' };
}

/** A tree path through ρ (unchanged when it was not renamed). */
export function mapPath(p: string, rho: RenameMap): string {
  return rho.map.get(p) ?? p;
}

/** A finding with its file endpoints mapped through ρ (a raw, unresolved target is left as it is). */
export function mapFinding(f: BlockingFinding, rho: RenameMap): BlockingFinding {
  if (rho.map.size === 0) return f;
  const filePath = f.filePath.split(',').map((p) => mapPath(p, rho)).join(',');
  return { ...f, filePath, ...(f.target !== undefined ? { target: mapPath(f.target, rho) } : {}) };
}
