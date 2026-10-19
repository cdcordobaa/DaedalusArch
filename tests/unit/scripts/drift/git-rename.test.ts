/**
 * T-GR (U4 design §5): `renameMapBetween` on one throwaway repository under the OS temp directory (git init, two
 * commits, one `git mv`). Local only, no network; the DaedalusArch repository's own git state is never touched (every
 * call runs with `cwd` in the temp repository and with the global and system git config disabled).
 * Skipped with a note when `git` is not on the path.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { renameDetectionFromStderr, renameMapBetween } from '../../../../scripts/lib/drift/git-rename.js';

const hasGit = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
const env = { ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' };
const g = (cwd: string, args: string[]): string => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', env });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};

(hasGit ? describe : describe.skip)('renameMapBetween (T-GR)', () => {
  let dir = '';
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-git-rename-'));
    g(dir, ['init', '-q']);
    fs.mkdirSync(path.join(dir, 'pkg/src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'pkg/src/a.ts'), 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n');
    g(dir, ['add', '-A']);
    g(dir, ['commit', '-q', '-m', 'one']);
    g(dir, ['mv', 'pkg/src/a.ts', 'pkg/src/renamed.ts']);
    g(dir, ['commit', '-q', '-m', 'two']);
  });
  afterAll(() => {
    if (dir !== '') fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the rename between the two commits, root-relative', () => {
    const r = renameMapBetween(dir, 'HEAD~1', 'HEAD', 'pkg', 'pkg');
    expect([...r.rename]).toEqual([['src/a.ts', 'src/renamed.ts']]);
    expect(r.renameDetection).toBe('full');
    expect(r.changed).toBe(1);
  });
});

if (!hasGit) {
  console.warn('T-GR skipped: git is not on the path');
}

describe('renameDetectionFromStderr (ID-9)', () => {
  it("git's skipped-detection warning gives 'skipped'", () => {
    const stderr = 'warning: exhaustive rename detection was skipped due to too many files.\nwarning: you may want to set your diff.renameLimit variable to at least 6123 and retry the command.\n';
    expect(renameDetectionFromStderr(stderr)).toBe('skipped');
    expect(renameDetectionFromStderr('warning: inexact rename detection was skipped due to too many files.')).toBe('skipped');
    expect(renameDetectionFromStderr('')).toBe('full');
  });
});
