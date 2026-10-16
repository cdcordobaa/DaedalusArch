/**
 * ISE robustness probe: renames directories of a project copy to non-standard names and rewrites the relative import
 * specifiers that cross them, so the project still resolves. Also maps project-relative paths and globs through the
 * same renaming (for the ground truth: expected layers, the true spec's globs, expected findings).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** `{ 'src/domain': 'src/kernel' }`: a directory (project-relative, no trailing slash) and its new path. */
export type RenameMap = Readonly<Record<string, string>>;

/** The renamed form of a project-relative path or glob (longest matching prefix wins). */
export function renamePath(p: string, map: RenameMap): string {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (p === k || p.startsWith(k + '/')) return (map[k] ?? k) + p.slice(k.length);
  }
  return p;
}

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(['"])(\.{1,2}\/[^'"]*)\2/gm;

/**
 * Rewrites the relative specifiers of `source` (a file at `fromRel` before the rename) so they point at the renamed
 * targets from the file's renamed location.
 */
export function rewriteSpecifiers(source: string, fromRel: string, map: RenameMap): string {
  const oldDir = path.posix.dirname(fromRel);
  const newDir = path.posix.dirname(renamePath(fromRel, map));
  return source.replace(SPECIFIER, (all: string, lead: string, q: string, spec: string) => {
    const target = path.posix.normalize(path.posix.join(oldDir, spec));
    let rel = path.posix.relative(newDir, renamePath(target, map));
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel === spec ? all : `${lead}${q}${rel}${q}`;
  });
}

/** Applies `map` to the project at `dir` in place: moves the directories, then rewrites every .ts file. */
export function renameProject(dir: string, map: RenameMap): void {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else files.push(path.relative(dir, abs).split(path.sep).join('/'));
    }
  };
  walk(dir);
  const contents = new Map(files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
  for (const k of Object.keys(map).sort((a, b) => b.length - a.length)) {
    const to = map[k] ?? k;
    if (!fs.existsSync(path.join(dir, k))) throw new Error(`rename: ${k} does not exist`);
    fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true });
    fs.renameSync(path.join(dir, k), path.join(dir, to));
  }
  for (const [f, text] of contents) {
    if (!f.endsWith('.ts')) continue;
    fs.writeFileSync(path.join(dir, renamePath(f, map)), rewriteSpecifiers(text, f, map));
  }
}

/**
 * The renamed form of a glob. A glob under a renamed directory is renamed like a path; a glob with `*` segments is
 * renamed segment-wise where its leading segments match a renamed directory (`src/*\/domain/**` with
 * `src/ordering/domain -> src/ordering/kernel` gives `src/*\/kernel/**`).
 */
export function renameGlob(glob: string, map: RenameMap): string {
  const direct = renamePath(glob, map);
  if (direct !== glob || !glob.includes('*')) return direct;
  const segs = glob.split('/');
  for (const [k, v] of Object.entries(map)) {
    const ks = k.split('/');
    const vs = v.split('/');
    if (ks.length !== vs.length || segs.length < ks.length) continue;
    if (!ks.every((s, i) => segs[i] === s || segs[i] === '*')) continue;
    const out = segs.map((s, i) => (i < vs.length && s !== '*' ? vs[i] ?? s : s));
    // A `*` segment stands for every directory: rename only where the renamed directories agree on that segment.
    if (ks.every((s, i) => segs[i] !== '*' || s === vs[i])) return out.join('/');
  }
  return glob;
}

/** A finding path field (possibly a comma-separated cycle) renamed. */
export function renameFindingPath(p: string, map: RenameMap): string {
  return p.split(',').map((x) => renamePath(x.trim(), map)).join(',');
}
