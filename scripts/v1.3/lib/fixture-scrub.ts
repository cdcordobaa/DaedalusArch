/**
 * V11 (threats register V13-TV-I4): a comment-free copy of a fixture tree for blind writers, judges and raters.
 *
 * Every comment in every source file (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`) is removed with `stripComments`, which
 * keeps line breaks, so line n of a scrubbed file is line n of the original. Variant patches (the reference patch
 * format) are rewritten hunk by hunk from the scrubbed clean file and the scrubbed patched file: hunk headers do not
 * change, and the scrubbed patch applied to the scrubbed project gives exactly the scrubbed variant. Every other file
 * is copied byte for byte. The source tree is never written.
 *
 * Not done here: variant directory names (which name the plant) and manifests are copied as they are, because the
 * runners key on them. A blind reader must be given materialised project directories, not the fixture root.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { stripComments } from './labelling/excerpt-scrub.js';
import { PatchError, applyFilePatch, parseUnifiedDiff } from './unified-diff.js';

export const SOURCE_EXTENSIONS: readonly string[] = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];

export function isSourceFile(file: string): boolean {
  return SOURCE_EXTENSIONS.includes(path.extname(file));
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function linesOf(content: string | undefined): string[] {
  if (content === undefined || content.length === 0) return [];
  const t = content.replace(/\r\n/g, '\n');
  return (t.endsWith('\n') ? t.slice(0, -1) : t).split('\n');
}

/**
 * Rewrites a unified diff so that it applies to the comment-free clean project and yields the comment-free variant.
 * `readClean` returns a clean project file (unscrubbed) or undefined. Throws `PatchError` when a context line differs
 * between the two scrubbed sides (a comment that spans the edit boundary), so a bad copy is never written.
 */
export function scrubPatch(patchText: string, readClean: (rel: string) => string | undefined): string {
  const filePatches = parseUnifiedDiff(patchText);
  const sides = filePatches.map((fp) => {
    const before = fp.oldPath === null ? undefined : readClean(fp.oldPath);
    const after = applyFilePatch(fp, before);
    const scrub = (c: string | undefined, rel: string | null): string[] => (c === undefined || rel === null || !isSourceFile(rel) ? linesOf(c) : linesOf(stripComments(c)));
    return { oldLines: scrub(before, fp.oldPath), newLines: scrub(after, fp.newPath) };
  });

  const raw = patchText.split('\n');
  const out: string[] = [];
  let fileIdx = -1;
  let oldAt = 0;
  let newAt = 0;
  let oldLeft = 0;
  let newLeft = 0;
  for (const l of raw) {
    if (oldLeft > 0 || newLeft > 0) {
      const s = sides[fileIdx];
      if (s === undefined) throw new PatchError('hunk outside a file patch');
      if (l.startsWith('\\')) {
        out.push(l);
        continue;
      }
      const marker = l === '' ? ' ' : l[0];
      if (marker === ' ') {
        const o = s.oldLines[oldAt] ?? '';
        const n = s.newLines[newAt] ?? '';
        if (o !== n) throw new PatchError(`context line differs after scrubbing (old ${String(oldAt + 1)}, new ${String(newAt + 1)}): a comment spans the edit`);
        out.push(l === '' && n === '' ? '' : ` ${n}`);
        oldAt += 1;
        newAt += 1;
        oldLeft -= 1;
        newLeft -= 1;
      } else if (marker === '-') {
        out.push(`-${s.oldLines[oldAt] ?? ''}`);
        oldAt += 1;
        oldLeft -= 1;
      } else if (marker === '+') {
        out.push(`+${s.newLines[newAt] ?? ''}`);
        newAt += 1;
        newLeft -= 1;
      } else throw new PatchError(`unexpected hunk line "${l}"`);
      continue;
    }
    if (l.startsWith('--- ')) fileIdx += 1;
    const m = HUNK_HEADER.exec(l);
    if (m !== null) {
      oldLeft = m[2] === undefined ? 1 : Number(m[2]);
      newLeft = m[4] === undefined ? 1 : Number(m[4]);
      oldAt = oldLeft === 0 ? Number(m[1]) : Number(m[1]) - 1;
      newAt = newLeft === 0 ? Number(m[3]) : Number(m[3]) - 1;
    }
    out.push(l);
  }
  const result = out.join('\n');

  // Self-check: the rewritten patch applied to the scrubbed clean files gives the scrubbed patched files.
  const rewritten = parseUnifiedDiff(result);
  rewritten.forEach((fp, k) => {
    const s = sides[k];
    const src = fp.oldPath === null ? undefined : readClean(fp.oldPath);
    const scrubbedSrc = src === undefined ? undefined : fp.oldPath !== null && isSourceFile(fp.oldPath) ? stripComments(src) : src;
    const got = linesOf(applyFilePatch(fp, scrubbedSrc));
    if (got.join('\n') !== s?.newLines.join('\n')) throw new PatchError(`${fp.newPath ?? fp.oldPath ?? '?'}: scrubbed patch does not reproduce the scrubbed variant`);
  });
  return result;
}

/** The patch-format project a `variants/<id>/<file>.patch` belongs to: `<style>/project`, or undefined. */
function projectForPatch(srcRoot: string, rel: string): string | undefined {
  const parts = rel.split('/');
  const v = parts.lastIndexOf('variants');
  if (v < 0 || v !== parts.length - 3) return undefined;
  const dir = path.join(srcRoot, ...parts.slice(0, v), 'project');
  return fs.existsSync(dir) ? dir : undefined;
}

export interface ScrubSummary {
  readonly sourceFiles: number;
  readonly sourceFilesChanged: number;
  readonly patches: number;
  readonly patchesChanged: number;
  readonly copied: number;
}

/** Copies `srcRoot` to `dstRoot` with every comment removed (see the file comment). `dstRoot` must not exist yet. */
export function scrubTree(srcRoot: string, dstRoot: string): ScrubSummary {
  const src = path.resolve(srcRoot);
  const dst = path.resolve(dstRoot);
  if (fs.existsSync(dst)) throw new Error(`${dst} exists; the scrubber writes only to a new directory`);
  if (dst === src || dst.startsWith(src + path.sep)) throw new Error('the destination must be outside the source tree');
  let sourceFiles = 0;
  let sourceFilesChanged = 0;
  let patches = 0;
  let patchesChanged = 0;
  let copied = 0;
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, e.name);
      const rel = path.relative(src, abs).split(path.sep).join('/');
      const out = path.join(dst, rel);
      if (e.isDirectory()) {
        walk(abs);
        continue;
      }
      fs.mkdirSync(path.dirname(out), { recursive: true });
      if (isSourceFile(e.name)) {
        const text = fs.readFileSync(abs, 'utf8');
        const next = stripComments(text);
        sourceFiles += 1;
        if (next !== text) sourceFilesChanged += 1;
        fs.writeFileSync(out, next);
      } else if (e.name.endsWith('.patch')) {
        const project = projectForPatch(src, rel);
        if (project === undefined) throw new Error(`${rel}: a patch outside <style>/variants/<id>/ has no known clean project; refusing to copy it unscrubbed`);
        const text = fs.readFileSync(abs, 'utf8');
        const next = scrubPatch(text, (p) => {
          const f = path.join(project, p);
          return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : undefined;
        });
        patches += 1;
        if (next !== text) patchesChanged += 1;
        fs.writeFileSync(out, next);
      } else {
        fs.copyFileSync(abs, out);
        copied += 1;
      }
    }
  };
  walk(src);
  return { sourceFiles, sourceFilesChanged, patches, patchesChanged, copied };
}
