/**
 * v1.3 reference projects (FR-V3): the strict unified-diff applier that materialises variants.
 */
import { PatchError, applyFilePatch, applyUnifiedDiff, parseUnifiedDiff } from '../../../../scripts/v1.3/lib/unified-diff.js';
import type { PatchTarget } from '../../../../scripts/v1.3/lib/unified-diff.js';

function memory(files: Record<string, string>): PatchTarget & { snapshot(): Record<string, string> } {
  const store = new Map(Object.entries(files));
  return {
    snapshot: () => Object.fromEntries(store),
    read: (p) => store.get(p),
    write: (p, c) => {
      store.set(p, c);
    },
    remove: (p) => {
      store.delete(p);
    },
  };
}

function must<T>(value: T | undefined, what = 'value'): T {
  if (value === undefined) throw new Error(`missing ${what}`);
  return value;
}

const BASE = 'line 1\nline 2\nline 3\nline 4\nline 5\n';

describe('parseUnifiedDiff', () => {
  it('reads paths, hunk ranges and markers', () => {
    const [p] = parseUnifiedDiff('--- a/src/x.ts\n+++ b/src/x.ts\n@@ -2,2 +2,3 @@\n line 2\n+inserted\n line 3\n');
    expect(p).toEqual({
      oldPath: 'src/x.ts',
      newPath: 'src/x.ts',
      hunks: [{ oldStart: 2, oldCount: 2, newStart: 2, newCount: 3, lines: [' line 2', '+inserted', ' line 3'], oldNoNewline: false, newNoNewline: false }],
    });
  });

  it('treats an omitted count as 1 and /dev/null as a missing side', () => {
    const [p] = parseUnifiedDiff('--- /dev/null\n+++ b/src/new.ts\n@@ -0,0 +1 @@\n+only\n');
    expect(p?.oldPath).toBeNull();
    expect(p?.hunks[0]).toMatchObject({ oldStart: 0, oldCount: 0, newCount: 1 });
  });

  it.each([
    ['a header without +++', '--- a/x.ts\n@@ -1 +1 @@\n-a\n+b\n'],
    ['a count that disagrees with the body', '--- a/x.ts\n+++ b/x.ts\n@@ -1,2 +1,2 @@\n-a\n+b\n'],
    ['a path that climbs out', '--- a/../x.ts\n+++ b/../x.ts\n@@ -1 +1 @@\n-a\n+b\n'],
    ['an absolute path', '--- a//etc/x\n+++ b//etc/x\n@@ -1 +1 @@\n-a\n+b\n'],
    ['a rename', '--- a/x.ts\n+++ b/y.ts\n@@ -1 +1 @@\n-a\n+b\n'],
    ['a file with no hunk', '--- a/x.ts\n+++ b/x.ts\n'],
  ])('rejects %s', (_label, text) => {
    expect(() => parseUnifiedDiff(text)).toThrow(PatchError);
  });
});

describe('applyFilePatch', () => {
  it('modifies, keeping the trailing newline', () => {
    const [p] = parseUnifiedDiff('--- a/f\n+++ b/f\n@@ -2,3 +2,3 @@\n line 2\n-line 3\n+LINE 3\n line 4\n');
    expect(applyFilePatch(must(p), BASE)).toBe('line 1\nline 2\nLINE 3\nline 4\nline 5\n');
  });

  it('applies several hunks in order', () => {
    const [p] = parseUnifiedDiff('--- a/f\n+++ b/f\n@@ -1 +1,2 @@\n line 1\n+after 1\n@@ -5 +6 @@\n-line 5\n+LINE 5\n');
    expect(applyFilePatch(must(p), BASE)).toBe('line 1\nafter 1\nline 2\nline 3\nline 4\nLINE 5\n');
  });

  it('creates and deletes files', () => {
    const [create] = parseUnifiedDiff('--- /dev/null\n+++ b/f\n@@ -0,0 +1,2 @@\n+a\n+b\n');
    expect(applyFilePatch(must(create), undefined)).toBe('a\nb\n');
    const [del] = parseUnifiedDiff('--- a/f\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-a\n-b\n');
    expect(applyFilePatch(must(del), 'a\nb\n')).toBeUndefined();
  });

  it('honours "No newline at end of file"', () => {
    const [p] = parseUnifiedDiff('--- a/f\n+++ b/f\n@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+b\n\\ No newline at end of file\n');
    expect(applyFilePatch(must(p), 'a')).toBe('b');
  });

  it('refuses a context line that does not match (no fuzz, no offset search)', () => {
    const [p] = parseUnifiedDiff('--- a/f\n+++ b/f\n@@ -2,1 +2,1 @@\n-line 3\n+x\n');
    expect(() => applyFilePatch(must(p), BASE)).toThrow(/line 2 does not match/);
  });

  it('refuses to create an existing file or modify a missing one', () => {
    const [create] = parseUnifiedDiff('--- /dev/null\n+++ b/f\n@@ -0,0 +1 @@\n+a\n');
    expect(() => applyFilePatch(must(create), 'x\n')).toThrow(/already exists/);
    const [modify] = parseUnifiedDiff('--- a/f\n+++ b/f\n@@ -1 +1 @@\n-a\n+b\n');
    expect(() => applyFilePatch(must(modify), undefined)).toThrow(/does not exist/);
  });
});

describe('applyUnifiedDiff', () => {
  it('applies every file and reports the touched paths', () => {
    const t = memory({ 'src/a.ts': 'one\n' });
    const touched = applyUnifiedDiff('--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-one\n+two\n--- /dev/null\n+++ b/src/b.ts\n@@ -0,0 +1 @@\n+new\n', t);
    expect(touched).toEqual(['src/a.ts', 'src/b.ts']);
    expect(t.snapshot()).toEqual({ 'src/a.ts': 'two\n', 'src/b.ts': 'new\n' });
  });

  it('writes nothing when any file patch fails', () => {
    const t = memory({ 'src/a.ts': 'one\n', 'src/b.ts': 'zzz\n' });
    expect(() => applyUnifiedDiff('--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-one\n+two\n--- a/src/b.ts\n+++ b/src/b.ts\n@@ -1 +1 @@\n-bbb\n+ccc\n', t)).toThrow(PatchError);
    expect(t.snapshot()).toEqual({ 'src/a.ts': 'one\n', 'src/b.ts': 'zzz\n' });
  });
});
