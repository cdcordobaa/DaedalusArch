// Scratch exports of a past commit, for numbers a doc states about the repository as it was at that commit (a test
// count "at HEAD" in a dated audit, a diagnosis of extractor behaviour that a later commit fixed). Comparing such a
// number against the current HEAD tests the wrong tree; these helpers let a group check it at the commit it names.
//
// Like ctx.tree(), the export is `git archive <commit>` with the working tree's node_modules linked in, so nothing is
// written into the repository. The commit must be in the clone (a shallow clone may not have it: fetch more history).
import { execSync } from 'node:child_process';
import { existsSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

const trees = new Map();

/**
 * Absolute path of a scratch export of `commit`, created once per run. `{ git: true }` also makes it an (empty) git
 * work tree, for tests that need one (the ISO-04 test in llm-options.test.ts, replication-2 §3.3).
 */
export function treeAt(ctx, commit, o = {}) {
  const key = `${commit}${o.git ? ':git' : ''}`;
  if (trees.has(key)) return trees.get(key);
  execSync(`git -C "${ctx.repo}" cat-file -e ${commit}^{tree}`, { env: ctx.env, stdio: 'pipe' });
  const dir = ctx.out(`tree-at-${key.replace(':', '-')}`);
  execSync(`git -C "${ctx.repo}" archive ${commit} | tar -x -C "${dir}"`, { env: ctx.env, stdio: 'pipe' });
  symlinkSync(join(ctx.repo, 'node_modules'), join(dir, 'node_modules'));
  const dc = 'experiments/tool-comparison/depcruise/node_modules';
  if (existsSync(join(ctx.repo, dc)) && existsSync(join(dir, dirname(dc)))) symlinkSync(join(ctx.repo, dc), join(dir, dc));
  if (o.git) execSync('git init -q .', { cwd: dir, env: ctx.env, stdio: 'pipe' });
  trees.set(key, dir);
  return dir;
}

/** A committed file as it was at `commit`. */
export function readAt(ctx, commit, rel) {
  return execSync(`git -C "${ctx.repo}" show ${commit}:${rel}`, { env: ctx.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
}
