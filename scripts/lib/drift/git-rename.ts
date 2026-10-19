/**
 * The only I/O of the drift module: ρ between two commits of a local clone (ID-9). Local git only, no network.
 *
 * Git skips rename detection silently when a diff exceeds `-l5000`: it prints a warning on stderr and reports the
 * renames as D + A rows. The wrapper reads stderr and returns `renameDetection: 'skipped'`, so a lost ρ is never silent.
 * For grid points more than one commit apart, ρ is one diff between the two points, never composed per commit.
 */
import { spawnSync } from 'node:child_process';
import { parseNameStatus, type NameStatusParse } from './rename-map.js';

/** Git's warnings when the rename limit is hit ("exhaustive"/"inexact rename detection was skipped ..."). */
export function renameDetectionFromStderr(stderr: string): 'full' | 'skipped' {
  return /rename detection was skipped/i.test(stderr) ? 'skipped' : 'full';
}

export interface RenameBetween extends NameStatusParse {
  readonly renameDetection: 'full' | 'skipped';
}

export function renameMapBetween(clone: string, a: string, b: string, historyPath: string, rootPrefix: string): RenameBetween {
  const r = spawnSync('git', ['diff', '--name-status', '-M50%', '-l5000', a, b, '--', historyPath], {
    cwd: clone, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
  });
  if (r.error !== undefined) throw r.error;
  if (r.status !== 0) throw new Error(`git diff --name-status ${a} ${b}: ${r.stderr}`);
  return { ...parseNameStatus(r.stdout, rootPrefix), renameDetection: renameDetectionFromStderr(r.stderr) };
}
