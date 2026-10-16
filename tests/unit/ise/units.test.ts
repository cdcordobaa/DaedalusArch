import { STRUCTURAL_CONTAINER_MAX_CROSS, childrenOf, detectSourceRoot, detectUnits, isStructuralContainer, levels, singleChildChain, stronglyConnected, unitStructure } from '../../../src/ise/units.js';
import { cleanShaped, graph, hexShaped } from './helpers.js';

/** Ordinary inward imports of the hexShaped adapters (more traffic around a stray lateral import). */
const BUSY = [
  'src/plugins/entry/http/RoomController.ts>src/core/Room.ts', 'src/plugins/entry/cli/RoomCli.ts>src/core/Room.ts',
  'src/plugins/entry/cli/RoomCli.ts>src/app/ports/RoomRepository.ts', 'src/plugins/exit/db/SqlRoomRepository.ts>src/app/ports/BookRoom.ts',
];

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

  it('descends the source root through wrapper directories', () => {
    expect(detectSourceRoot(['src/app/core/a.ts', 'src/app/web/b.ts'])).toBe('src/app/');
    expect(detectSourceRoot(['src/app/x/core/a.ts', 'src/app/x/web/b.ts'])).toBe('src/app/x/');
    expect(detectSourceRoot(['src/app/core/a.ts', 'src/main.ts'])).toBe('src/');
    expect(detectSourceRoot(['lib/core/a.ts', 'lib/web/b.ts'])).toBe('lib/');
  });

  it('lists children and follows single-child chains (strict: only through folders without files)', () => {
    const files = ['src/a/only/x/1.ts', 'src/a/only/y/2.ts', 'src/b/top.ts', 'src/b/only/x/3.ts', 'src/b/only/y/4.ts'];
    expect([...childrenOf(files, 'src/').dirs.keys()]).toEqual(['src/a/', 'src/b/']);
    expect(childrenOf(files, 'src/b/').direct).toEqual(['src/b/top.ts']);
    expect(singleChildChain(files, 'src/a/', true)).toEqual(['src/a/', 'src/a/only/']);
    expect(singleChildChain(files, 'src/b/', true)).toEqual(['src/b/']);
    expect(singleChildChain(files, 'src/b/', false)).toEqual(['src/b/', 'src/b/only/']);
  });

  it('detects a structural container: no own files, children that do not import each other (names play no part)', () => {
    const g = hexShaped('plugins', 'entry', 'exit');
    expect(isStructuralContainer(g.files, g.edges, 'src/plugins/')).toBe(true);
    expect(isStructuralContainer(g.files, g.edges, 'src/app/')).toBe(false); // app/BookRoomService.ts is a file of its own
    const core = graph({ files: ['src/k/a/1.ts', 'src/k/b/2.ts'], edges: ['src/k/a/1.ts>src/k/b/2.ts'] });
    expect(isStructuralContainer(core.files, core.edges, 'src/k/')).toBe(false); // its children import each other
  });

  it('tolerates a stray import between the children up to the cross-edge share', () => {
    const stray = 'src/plugins/entry/http/RoomController.ts>src/plugins/exit/db/SqlRoomRepository.ts';
    const g = hexShaped('plugins', 'entry', 'exit', [stray]);
    // 1 cross edge of 9 touching the children is above the share; with 4 more ordinary edges (1 of 13) it is not.
    expect(1 / 9 > STRUCTURAL_CONTAINER_MAX_CROSS && 1 / 13 <= STRUCTURAL_CONTAINER_MAX_CROSS).toBe(true);
    expect(isStructuralContainer(g.files, g.edges, 'src/plugins/')).toBe(false);
    const busy = hexShaped('plugins', 'entry', 'exit', [stray, ...BUSY]);
    expect(isStructuralContainer(busy.files, busy.edges, 'src/plugins/')).toBe(true);
  });

  it('splits a structural container into its children, grouped, and keeps lateral edges out of the levels', () => {
    const stray = 'src/plugins/entry/http/RoomController.ts>src/plugins/exit/db/SqlRoomRepository.ts';
    const g = hexShaped('plugins', 'entry', 'exit', [stray, ...BUSY]);
    const s = unitStructure(g);
    expect(s.units.map((u) => [u.id, u.group ?? null])).toEqual([
      ['src/app/', null], ['src/core/', null], ['src/plugins/entry/', 'src/plugins/'], ['src/plugins/exit/', 'src/plugins/'], ['src/wiring/', null],
    ]);
    expect(s.edges.some((e) => e.from === 'src/plugins/entry/' && e.to === 'src/plugins/exit/')).toBe(true);
    expect(s.majority.some((e) => e.from === 'src/plugins/entry/' && e.to === 'src/plugins/exit/')).toBe(false);
    expect(s.level.get('src/plugins/entry/')).toBe(s.level.get('src/plugins/exit/'));
  });

  it('splits through a single-child chain below the container', () => {
    const g = hexShaped('plugins/mid', 'entry', 'exit');
    expect(unitStructure(g).units.map((u) => u.id)).toContain('src/plugins/mid/entry/');
  });
});
