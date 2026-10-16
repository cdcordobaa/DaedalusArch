/**
 * pnpm's symlinked `node_modules` in base copies (v1.3; ADR-027 decision 2 named this as an open check).
 *
 * pnpm lays packages out as `node_modules/<name> → .pnpm/<name>@<v>/node_modules/<name>` (relative links) and
 * `.pnpm/<id>/node_modules/<dep>` links between virtual-store entries. U5a `copyBase` copies links verbatim
 * (`verbatimSymlinks`), which is correct exactly when every link target lies inside the copied base directory:
 *
 * - a **relative link whose target stays inside the base** resolves inside the copy: nothing to do;
 * - an **absolute link into the base** would keep pointing at the original base (type-check reads, and a stub write
 *   would go, outside the copy): rewritten to the equivalent relative link inside the copy;
 * - a **relative link that leaves the base** (a workspace sub-path base: `apps/api/node_modules/x → ../../../node_modules/.pnpm/…`)
 *   would resolve to a different place from the copy: rewritten to an absolute link to the original target, which
 *   is read-only for the analysis, the same convention as the `monorepo-context` mirror (`mirrorPackages`);
 * - an absolute link outside the base stays as it is.
 *
 * Links whose targets do not exist are listed (`dangling`), not repaired: pnpm itself leaves optional-dependency
 * links dangling on a platform that skips them. Nothing is written outside `target`, and the rewrite only runs for a
 * base that has the pnpm virtual store (`node_modules/.pnpm`), so an npm or yarn base is copied exactly as before.
 */
import { existsSync, lstatSync, readdirSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** True for a base installed by pnpm with the default (isolated) linker. */
export function isPnpmLayout(baseDir: string): boolean {
  return existsSync(join(baseDir, 'node_modules', '.pnpm'));
}

export interface LinkReport {
  readonly total: number;
  /** Absolute links into the base, made relative in the copy. */
  readonly relinkedInside: readonly string[];
  /** Relative links that left the base, made absolute to the original target. */
  readonly relinkedOutside: readonly string[];
  /** Links whose target does not exist in the source. */
  readonly dangling: readonly string[];
}

const inside = (root: string, p: string): boolean => {
  const rel = relative(root, p);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/** Every symlink below `dir` (not followed), as paths relative to `dir`, POSIX separators, sorted. */
function symlinksIn(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isSymbolicLink()) out.push(relative(dir, p).split(sep).join('/'));
      else if (e.isDirectory()) walk(p);
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * Adjusts the links of `<target>/node_modules` (a fresh `copyBase` copy of `source`) so that each resolves as in the
 * source. Returns the report; throws only on a filesystem error.
 */
export function relinkPnpmCopy(source: string, target: string): LinkReport {
  const src = resolve(source);
  const dst = resolve(target);
  const relinkedInside: string[] = [];
  const relinkedOutside: string[] = [];
  const dangling: string[] = [];
  const links = existsSync(join(dst, 'node_modules')) ? symlinksIn(join(dst, 'node_modules')).map((l) => `node_modules/${l}`) : [];
  for (const rel of links) {
    const inSource = join(src, ...rel.split('/'));
    const inCopy = join(dst, ...rel.split('/'));
    const raw = readlinkSync(inCopy);
    const resolvedTarget = resolve(dirname(inSource), raw);
    if (!existsSync(resolvedTarget) && lstatSafe(resolvedTarget) === undefined) dangling.push(rel);
    const stays = inside(src, resolvedTarget);
    if (isAbsolute(raw) && stays) {
      const inCopyTarget = join(dst, relative(src, resolvedTarget));
      unlinkSync(inCopy); // the link itself; rmSync follows a link to a directory on Node 24
      symlinkSync(relative(dirname(inCopy), inCopyTarget) || '.', inCopy);
      relinkedInside.push(rel);
    } else if (!isAbsolute(raw) && !stays) {
      unlinkSync(inCopy); // the link itself; rmSync follows a link to a directory on Node 24
      symlinkSync(resolvedTarget, inCopy);
      relinkedOutside.push(rel);
    }
  }
  return { total: links.length, relinkedInside, relinkedOutside, dangling };
}

function lstatSafe(p: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(p);
  } catch {
    return undefined;
  }
}
