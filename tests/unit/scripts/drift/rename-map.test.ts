/**
 * T-RN (U4 design §5): the rename-map parser (ID-9, ID-10). Pure.
 */
import { parseNameStatus } from '../../../../scripts/lib/drift/rename-map.js';

describe('parseNameStatus (T-RN)', () => {
  it('an R087 row maps old to new with the prefix stripped', () => {
    const p = parseNameStatus('R087\tpkg/src/a.ts\tpkg/src/b.ts\n', 'pkg');
    expect([...p.rename]).toEqual([['src/a.ts', 'src/b.ts']]);
    expect([...p.renamedFrom]).toEqual(['src/a.ts']);
    expect(p.changed).toBe(1);
    expect(p.renamedOrDeleted).toBe(1);
    expect(p.outOfRoot.size).toBe(0);
  });

  it('a C row is not a rename: the old path stays', () => {
    const p = parseNameStatus('C075\tsrc/a.ts\tsrc/a-copy.ts\n', '.');
    expect(p.rename.size).toBe(0);
    expect(p.renamedFrom.size).toBe(0);
    expect(p.changed).toBe(1);
    expect(p.renamedOrDeleted).toBe(0);
  });

  it('a D row is a deletion, A and M rows change nothing but are counted', () => {
    const p = parseNameStatus('D\tsrc/gone.ts\nA\tsrc/new.ts\nM\tsrc/kept.ts\n', '');
    expect([...p.deleted]).toEqual(['src/gone.ts']);
    expect(p.rename.size).toBe(0);
    expect(p.changed).toBe(3);
    expect(p.renamedOrDeleted).toBe(1);
  });

  it('a prefix with or without a trailing slash strips the same', () => {
    const a = parseNameStatus('R100\tapps/api/x.ts\tapps/api/y.ts', 'apps/api/');
    const b = parseNameStatus('R100\tapps/api/x.ts\tapps/api/y.ts', 'apps/api');
    expect([...a.rename]).toEqual([['x.ts', 'y.ts']]);
    expect([...b.rename]).toEqual([...a.rename]);
  });

  it('a rename out of the root has no successor (ID-10), a rename into the root is an addition', () => {
    const p = parseNameStatus('R090\tpkg/src/a.ts\tother/a.ts\nR095\tother/b.ts\tpkg/src/b.ts\n', 'pkg');
    expect(p.rename.size).toBe(0);
    expect([...p.outOfRoot]).toEqual(['src/a.ts']);
    expect(p.renamedOrDeleted).toBe(2);
  });

  it('empty output is an empty map', () => {
    const p = parseNameStatus('', '.');
    expect(p.rename.size).toBe(0);
    expect(p.changed).toBe(0);
  });
});
