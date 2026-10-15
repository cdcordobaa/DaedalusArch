/**
 * A strict unified-diff applier for the v1.3 reference-project variants (FR-V3).
 *
 * Supports exactly what the variant patches contain: per-file `--- a/<path>` / `+++ b/<path>` headers, `/dev/null`
 * for created and deleted files, `@@ -l[,s] +l[,s] @@` hunks and the `\ No newline at end of file` marker. There is no
 * fuzz and no offset search: every context and removed line must sit exactly where the hunk header says, so a patch
 * that no longer fits the clean project fails loudly instead of landing somewhere plausible.
 */

export interface Hunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  /** Body lines with their leading marker (' ', '-', '+'). */
  readonly lines: readonly string[];
  /** The old (resp. new) side's last line has no trailing newline. */
  readonly oldNoNewline: boolean;
  readonly newNoNewline: boolean;
}

export interface FilePatch {
  /** Project-relative path before the change, or null for a created file. */
  readonly oldPath: string | null;
  /** Project-relative path after the change, or null for a deleted file. */
  readonly newPath: string | null;
  readonly hunks: readonly Hunk[];
}

export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchError';
  }
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function headerPath(line: string, marker: '--- ' | '+++ ', prefix: 'a/' | 'b/'): string | null {
  const raw = line.slice(marker.length).split('\t')[0]?.trim() ?? '';
  if (raw === '/dev/null') return null;
  if (!raw.startsWith(prefix)) throw new PatchError(`expected "${prefix}" path in "${line}"`);
  const p = raw.slice(prefix.length);
  if (p.length === 0 || p.startsWith('/') || p.split('/').includes('..')) throw new PatchError(`unsafe path in "${line}"`);
  return p;
}

/** Parses a unified diff into per-file patches. Throws `PatchError` on anything it does not understand. */
export function parseUnifiedDiff(text: string): FilePatch[] {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const patches: FilePatch[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.startsWith('diff ') || line.startsWith('index ') || line.length === 0) {
      i += 1;
      continue;
    }
    if (!line.startsWith('--- ')) throw new PatchError(`line ${i + 1}: expected a "--- " file header, got "${line}"`);
    const next = lines[i + 1] ?? '';
    if (!next.startsWith('+++ ')) throw new PatchError(`line ${i + 2}: expected a "+++ " file header`);
    const oldPath = headerPath(line, '--- ', 'a/');
    const newPath = headerPath(next, '+++ ', 'b/');
    if (oldPath === null && newPath === null) throw new PatchError(`line ${i + 1}: both sides are /dev/null`);
    if (oldPath !== null && newPath !== null && oldPath !== newPath) throw new PatchError(`line ${i + 1}: renames are not supported`);
    i += 2;

    const hunks: Hunk[] = [];
    while (i < lines.length && (lines[i] ?? '').startsWith('@@')) {
      const m = HUNK_HEADER.exec(lines[i] ?? '');
      if (m === null) throw new PatchError(`line ${i + 1}: malformed hunk header`);
      const oldStart = Number(m[1]);
      const oldCount = m[2] === undefined ? 1 : Number(m[2]);
      const newStart = Number(m[3]);
      const newCount = m[4] === undefined ? 1 : Number(m[4]);
      i += 1;
      const body: string[] = [];
      let seenOld = 0;
      let seenNew = 0;
      let oldNoNewline = false;
      let newNoNewline = false;
      while (i < lines.length && (seenOld < oldCount || seenNew < newCount || (lines[i] ?? '').startsWith('\\'))) {
        const l = lines[i] ?? '';
        if (l.startsWith('\\')) {
          const prev = body[body.length - 1] ?? ' ';
          if (prev.startsWith('-') || prev.startsWith(' ')) oldNoNewline = true;
          if (prev.startsWith('+') || prev.startsWith(' ')) newNoNewline = true;
          i += 1;
          continue;
        }
        const marker = l[0];
        if (marker === ' ' || l === '') {
          body.push(l === '' ? ' ' : l);
          seenOld += 1;
          seenNew += 1;
        } else if (marker === '-') {
          body.push(l);
          seenOld += 1;
        } else if (marker === '+') {
          body.push(l);
          seenNew += 1;
        } else {
          break;
        }
        i += 1;
      }
      if (seenOld !== oldCount || seenNew !== newCount) {
        throw new PatchError(`hunk at old line ${oldStart}: header says -${oldCount} +${newCount}, body has -${seenOld} +${seenNew}`);
      }
      hunks.push({ oldStart, oldCount, newStart, newCount, lines: body, oldNoNewline, newNoNewline });
    }
    if (hunks.length === 0) throw new PatchError(`no hunk for ${newPath ?? oldPath ?? '?'}`);
    patches.push({ oldPath, newPath, hunks });
  }
  return patches;
}

function splitContent(content: string): { lines: string[]; trailingNewline: boolean } {
  if (content.length === 0) return { lines: [], trailingNewline: true };
  const trailingNewline = content.endsWith('\n');
  const lines = (trailingNewline ? content.slice(0, -1) : content).split('\n');
  return { lines, trailingNewline };
}

/**
 * Applies one file patch to the old content (undefined when the file does not exist) and returns the new content
 * (undefined when the patch deletes the file). Strict: every context and removed line must match at its position.
 */
export function applyFilePatch(patch: FilePatch, oldContent: string | undefined): string | undefined {
  const label = patch.newPath ?? patch.oldPath ?? '?';
  if (patch.oldPath === null && oldContent !== undefined) throw new PatchError(`${label}: patch creates a file that already exists`);
  if (patch.oldPath !== null && oldContent === undefined) throw new PatchError(`${label}: patch modifies a file that does not exist`);

  const { lines: src, trailingNewline } = splitContent(oldContent ?? '');
  const out: string[] = [];
  let cursor = 0; // index into src
  let newNoNewline = false;
  for (const h of patch.hunks) {
    const start = h.oldCount === 0 ? h.oldStart : h.oldStart - 1;
    if (start < cursor) throw new PatchError(`${label}: overlapping or out-of-order hunk at line ${h.oldStart}`);
    if (start > src.length) throw new PatchError(`${label}: hunk at line ${h.oldStart} is past the end of the file`);
    out.push(...src.slice(cursor, start));
    cursor = start;
    for (const l of h.lines) {
      const marker = l[0];
      const text = l.slice(1);
      if (marker === ' ' || marker === '-') {
        if (src[cursor] !== text) {
          throw new PatchError(`${label}: line ${cursor + 1} does not match the patch (expected ${JSON.stringify(text)}, found ${JSON.stringify(src[cursor] ?? '<end of file>')})`);
        }
        if (marker === ' ') out.push(text);
        cursor += 1;
      } else {
        out.push(text);
      }
    }
    newNoNewline = h.newNoNewline;
  }
  out.push(...src.slice(cursor));
  if (patch.newPath === null) {
    if (out.length !== 0) throw new PatchError(`${label}: deletion patch does not remove every line`);
    return undefined;
  }
  if (out.length === 0) return '';
  const lastHunkReachesEnd = cursor === src.length;
  const endsWithNewline = lastHunkReachesEnd && patch.hunks.length > 0 ? !newNoNewline : trailingNewline;
  return out.join('\n') + (endsWithNewline ? '\n' : '');
}

/** Read/write access to a project tree, so the applier can be tested in memory. */
export interface PatchTarget {
  read(relPath: string): string | undefined;
  write(relPath: string, content: string): void;
  remove(relPath: string): void;
}

/**
 * Applies every file patch of `diffText` to `target`. All file patches are computed before any write, so a failing
 * hunk leaves the target untouched. Returns the touched project-relative paths, sorted.
 */
export function applyUnifiedDiff(diffText: string, target: PatchTarget): string[] {
  const patches = parseUnifiedDiff(diffText);
  const results = patches.map((p) => {
    const path = p.newPath ?? p.oldPath ?? '';
    return { path, content: applyFilePatch(p, p.oldPath === null ? target.read(path) : target.read(p.oldPath)) };
  });
  for (const r of results) {
    if (r.content === undefined) target.remove(r.path);
    else target.write(r.path, r.content);
  }
  return results.map((r) => r.path).sort();
}
