import { detectSourceRoot, detectUnits, levels, stronglyConnected, unitStructure } from '../../../src/ise/units.js';
import { cleanShaped, graph } from './helpers.js';

describe('ISE units', () => {
  it('detects src/ as the source root only when every file is under it', () => {
    expect(detectSourceRoot(['src/a.ts', 'src/b/c.ts'])).toBe('src/');
    expect(detectSourceRoot(['src/a.ts', 'lib/b.ts'])).toBe('');
  });

  it('makes top-level directories and root files units, and splits container directories', () => {
    const units = detectUnits(['src/main.ts', 'src/domain/a.ts', 'src/adapters/inbound/x.ts', 'src/adapters/outbound/y.ts', 'src/adapters/index.ts'], 'src/');
    expect(units.map((u) => [u.id, u.kind, u.token, u.directOnly])).toEqual([
      ['src/adapters/', 'dir', 'adapters', true],
      ['src/adapters/inbound/', 'dir', 'inbound', false],
      ['src/adapters/outbound/', 'dir', 'outbound', false],
      ['src/domain/', 'dir', 'domain', false],
      ['src/main.ts', 'file', 'main', false],
    ]);
  });

  it('splits a directory when the caller asks (bounded contexts)', () => {
    const units = detectUnits(['src/ordering/domain/a.ts', 'src/ordering/api/b.ts', 'src/ordering/index.ts'], 'src/', (id) => id === 'src/ordering/');
    expect(units.map((u) => u.id)).toEqual(['src/ordering/', 'src/ordering/api/', 'src/ordering/domain/']);
  });

  it('finds strongly connected components and longest-path levels over the condensation', () => {
    const edges = [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'b', to: 'c' }, { from: 'd', to: 'a' }];
    expect(stronglyConnected(['a', 'b', 'c', 'd'], edges).map((c) => [...c].sort()).sort()).toEqual([['a', 'b'], ['c'], ['d']]);
    const l = levels(['a', 'b', 'c', 'd'], edges);
    expect([l.get('c'), l.get('a'), l.get('b'), l.get('d')]).toEqual([0, 1, 1, 2]);
  });

  it('keeps the majority direction between two units and drops the minority', () => {
    const g = graph({ files: ['src/x/a.ts', 'src/x/b.ts', 'src/y/c.ts'], edges: ['src/x/a.ts>src/y/c.ts', 'src/x/b.ts>src/y/c.ts', 'src/y/c.ts>src/x/a.ts'] });
    const s = unitStructure(g);
    expect(s.edges).toEqual([{ from: 'src/x/', to: 'src/y/', count: 2 }, { from: 'src/y/', to: 'src/x/', count: 1 }]);
    expect(s.majority).toEqual([{ from: 'src/x/', to: 'src/y/', count: 2 }]);
    expect(s.level.get('src/y/')).toBe(0);
    expect(s.level.get('src/x/')).toBe(1);
  });

  it('orders a clean-architecture-shaped project core < application < outer, outer being the root', () => {
    const s = unitStructure(cleanShaped());
    expect(['src/domain/', 'src/application/', 'src/infrastructure/'].map((u) => s.level.get(u))).toEqual([0, 1, 2]);
    expect(s.roots).toEqual(['src/infrastructure/']);
  });
});
