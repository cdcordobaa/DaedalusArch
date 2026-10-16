/**
 * V11 (V13-TV-I4): the fixture-leakage pattern set, the comment-line reader and the scrubbed-copy generator.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scrubPatch, scrubTree } from '../../../../scripts/v1.3/lib/fixture-scrub.js';
import { commentLineTexts, stripComments } from '../../../../scripts/v1.3/lib/labelling/excerpt-scrub.js';
import { leakageKinds } from '../../../../scripts/v1.3/lib/leakage-terms.js';
import { PatchError, applyFilePatch, parseUnifiedDiff } from '../../../../scripts/v1.3/lib/unified-diff.js';

describe('leakageKinds', () => {
  it('matches the frozen kinds', () => {
    expect(leakageKinds('// VIOLATION (aggregate-boundary): reads another aggregate')).toEqual(['violation', 'rule-name']);
    expect(leakageKinds('// Allowed: an application service may read it')).toEqual(['allowed']);
    expect(leakageKinds('/** Not a repository: it stores nothing. */')).toEqual(['construct-denial']);
    expect(leakageKinds('// planted FF-DT03 seed, blocking')).toEqual(['rule-id', 'planted', 'seed', 'blocking']);
  });

  it('does not match ordinary comments or longer kebab words', () => {
    expect(leakageKinds('// Formats the overdue list for the export.')).toEqual([]);
    expect(leakageKinds('// see the dependency-direction-graphs notes')).toEqual([]);
  });
});

describe('commentLineTexts', () => {
  it('maps each touched line to its comment text and ignores comment markers inside strings', () => {
    const src = ['const u = "http://x"; // tail', '/* a', ' b */ const k = 1;', 'const s = 1;'].join('\n');
    const m = commentLineTexts(src);
    expect([...m.keys()]).toEqual([0, 1, 2]);
    expect(m.get(0)).toBe('// tail');
    expect(m.get(2)).toBe(' b */');
  });
});

const CLEAN = ['import { A } from "./a";', '', '/** Keeps things. */', 'export class B {', '  run(): void {}', '}', ''].join('\n');
const PATCH = [
  '--- a/src/b.ts',
  '+++ b/src/b.ts',
  '@@ -3,4 +3,6 @@',
  ' /** Keeps things. */',
  ' export class B {',
  '+  // VIOLATION (planted): not an adapter',
  '+  x = 1; /* inline */',
  '   run(): void {}',
  ' }',
  '--- /dev/null',
  '+++ b/src/c.ts',
  '@@ -0,0 +1,2 @@',
  '+/** Not a repository: it stores nothing. */',
  '+export const c = 1;',
  '',
].join('\n');

describe('scrubPatch', () => {
  const read = (p: string): string | undefined => (p === 'src/b.ts' ? CLEAN : undefined);

  it('keeps hunk headers and reproduces the scrubbed variant from the scrubbed project', () => {
    const out = scrubPatch(PATCH, read);
    expect(out.split('\n').filter((l) => l.startsWith('@@'))).toEqual(PATCH.split('\n').filter((l) => l.startsWith('@@')));
    expect(out).not.toMatch(/VIOLATION|Not a repository|Keeps things|inline/);
    const scrubbed = parseUnifiedDiff(out);
    const original = parseUnifiedDiff(PATCH);
    expect(scrubbed).toHaveLength(2);
    const before = [stripComments(CLEAN), undefined];
    const cleanSide = [CLEAN, undefined];
    scrubbed.forEach((fp, k) => {
      const orig = original[k];
      if (orig === undefined) throw new Error('patch count differs');
      expect(applyFilePatch(fp, before[k])).toBe(stripComments(applyFilePatch(orig, cleanSide[k]) ?? ''));
    });
  });

  it('refuses a patch whose context changes meaning after scrubbing', () => {
    const clean = ['const a = 1;', 'const b = 2;', ''].join('\n');
    const patch = ['--- a/x.ts', '+++ b/x.ts', '@@ -1,2 +1,3 @@', '+/*', ' const a = 1;', '+*/', ' const b = 2;', ''].join('\n');
    expect(() => scrubPatch(patch, () => clean)).toThrow(PatchError);
  });
});

describe('scrubTree', () => {
  it('copies a reference-shaped tree with every comment removed and line counts kept', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrub-test-'));
    try {
      const src = path.join(tmp, 'src');
      fs.mkdirSync(path.join(src, 'style/project/src'), { recursive: true });
      fs.mkdirSync(path.join(src, 'style/variants/v01'), { recursive: true });
      fs.writeFileSync(path.join(src, 'style/project/src/b.ts'), CLEAN);
      fs.writeFileSync(path.join(src, 'style/variants/v01/variant.patch'), PATCH);
      fs.writeFileSync(path.join(src, 'style/variants/v01/expected-findings.json'), '{"note":"// kept"}\n');
      const dst = path.join(tmp, 'dst');
      const s = scrubTree(src, dst);
      expect(s).toEqual({ sourceFiles: 1, sourceFilesChanged: 1, patches: 1, patchesChanged: 1, copied: 1 });
      const b = fs.readFileSync(path.join(dst, 'style/project/src/b.ts'), 'utf8');
      expect(b.split('\n')).toHaveLength(CLEAN.split('\n').length);
      expect(b).not.toContain('Keeps');
      expect(fs.readFileSync(path.join(dst, 'style/variants/v01/expected-findings.json'), 'utf8')).toBe('{"note":"// kept"}\n');
      expect(fs.readFileSync(path.join(src, 'style/project/src/b.ts'), 'utf8')).toBe(CLEAN);
      expect(() => scrubTree(src, dst)).toThrow(/exists/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('refuses a patch it cannot place against a clean project', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrub-test-'));
    try {
      fs.writeFileSync(path.join(tmp, 'loose.patch'), PATCH);
      expect(() => scrubTree(tmp, path.join(os.tmpdir(), `scrub-out-${String(process.pid)}`))).toThrow(/no known clean project/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(path.join(os.tmpdir(), `scrub-out-${String(process.pid)}`), { recursive: true, force: true });
    }
  });
});
