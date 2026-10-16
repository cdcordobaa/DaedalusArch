import { classifyItem, CREDITED, importGraphInvisible, type ItemChild, type MinedItem } from '../../../../scripts/v1.3/lib/apg2-fixes-mined.js';

const child = (over: Partial<ItemChild> = {}): ItemChild => ({
  childFiles: new Set(['a.ts', 'b.ts']), childDeps: new Set<string>(), childImports: new Set<string>(),
  childComponents: new Set(['folder:x', 'folder:y']), childComponentDeps: new Set<string>(), renamedFrom: new Set<string>(), massOrBot: false, ...over,
});
const item = (over: Partial<MinedItem>): MinedItem => ({ family: 'apg2', rule: 'r', tier: 'advisory', shape: 'member', key: 'k', files: ['a.ts'], importGraphSees: null, message: '', ...over });

describe('apg2 fixes-mined classification', () => {
  it('orders rename, deletion, component loss and mass before the shape classes', () => {
    expect(classifyItem(item({ files: ['a.ts'] }), child({ renamedFrom: new Set(['a.ts']) }))).toBe('RENAMED');
    expect(classifyItem(item({ files: ['c.ts'] }), child())).toBe('FILE-DELETED');
    expect(classifyItem(item({ shape: 'component', files: [], components: ['folder:z'] }), child())).toBe('COMPONENT-GONE');
    expect(classifyItem(item({}), child({ massOrBot: true }))).toBe('MASS-OR-BOT');
  });
  it('credits an edge item only when the file pair has no relation left', () => {
    const e = item({ shape: 'edge', files: ['a.ts', 'b.ts'], edge: 'a.ts|b.ts' });
    expect(classifyItem(e, child())).toBe('FIXED-BY-DEV');
    expect(classifyItem(e, child({ childDeps: new Set(['a.ts|b.ts']) }))).toBe('OTHER');
  });
  it('credits a component dependency item only when the dependency is gone', () => {
    const c = item({ shape: 'component', files: [], components: ['folder:x', 'folder:y'], componentDep: 'folder:x>y' });
    expect(classifyItem(c, child())).toBe('FIXED-BY-DEV');
    expect(classifyItem(c, child({ childComponentDeps: new Set(['folder:x>y']) }))).toBe('OTHER');
    expect(classifyItem(item({ shape: 'component', files: [], components: ['folder:x'] }), child())).toBe('RESOLVED-IN-PLACE');
  });
  it('resolves member, pair and file items in place', () => {
    for (const shape of ['member', 'pair', 'file'] as const) expect(CREDITED.has(classifyItem(item({ shape }), child()))).toBe(true);
  });
  it('marks invisibility by rule expressibility and the per-item import test', () => {
    expect(importGraphInvisible('deep-import-inferred-api', false)).toBe(false);
    expect(importGraphInvisible('boundary-type-leak', true)).toBe(false);
    expect(importGraphInvisible('boundary-type-leak', false)).toBe(true);
    expect(importGraphInvisible('component-main-sequence-distance', null)).toBe(true);
  });
});
