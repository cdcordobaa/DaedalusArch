import { boundedContexts, detectContexts } from '../../../src/ise/contexts.js';
import { cleanShaped, dddShaped, graph, hexShaped, layeredShaped } from './helpers.js';

describe('ISE bounded contexts from structure', () => {
  it('finds the contexts with DDD layer names (structure and vocabulary agree)', () => {
    const d = detectContexts(dddShaped());
    expect(d.contexts.map((c) => [c.root, c.via])).toEqual([['src/billing/', 'both'], ['src/ordering/', 'both']]);
  });

  it('finds them blind, by repeated internal layering, when the layer folders carry no known name', () => {
    const d = detectContexts(dddShaped('kernel', 'orchestration', 'platform'));
    expect(d.contexts.map((c) => [c.root, c.via])).toEqual([['src/billing/', 'structure'], ['src/ordering/', 'structure']]);
    const o = d.contexts.find((c) => c.root === 'src/ordering/');
    expect(o?.domain).toBe('src/ordering/kernel/');
    expect(o?.application).toBe('src/ordering/orchestration/');
    expect(o?.outer).toEqual(['src/ordering/api/', 'src/ordering/platform/']);
    expect([...(o?.level ?? new Map<string, number>())]).toEqual([['src/ordering/api/', 2], ['src/ordering/kernel/', 0], ['src/ordering/orchestration/', 1], ['src/ordering/platform/', 1]]);
    // The vocabulary detection alone sees nothing here.
    expect(boundedContexts(dddShaped('kernel', 'orchestration', 'platform').files, 'src/')).toEqual([]);
  });

  it('looks through a single-child folder between the context and its layers', () => {
    const d = detectContexts(dddShaped('kernel', 'orchestration', 'platform', 'mod'));
    expect(d.contexts.map((c) => [c.root, c.layerRoot])).toEqual([['src/billing/', 'src/billing/mod/'], ['src/ordering/', 'src/ordering/mod/']]);
    expect(d.contexts[1]?.domain).toBe('src/ordering/mod/kernel/');
  });

  it('finds no context in single-layered styles', () => {
    for (const g of [cleanShaped(), cleanShaped('kernel', 'orchestration', 'platform'), layeredShaped(), hexShaped('plugins', 'entry', 'exit')]) {
      expect(detectContexts(g).contexts).toEqual([]);
    }
  });

  it('rejects sibling folders that import each other more than inside themselves', () => {
    const files = ['src/a/x/1.ts', 'src/a/y/2.ts', 'src/b/x/3.ts', 'src/b/y/4.ts'];
    const inside = ['src/a/y/2.ts>src/a/x/1.ts', 'src/b/y/4.ts>src/b/x/3.ts'];
    expect(detectContexts(graph({ files, edges: inside })).contexts.map((c) => c.root)).toEqual(['src/a/', 'src/b/']);
    const tangled = [...inside, 'src/a/y/2.ts>src/b/x/3.ts', 'src/b/y/4.ts>src/a/x/1.ts', 'src/a/x/1.ts>src/b/y/4.ts'];
    expect(detectContexts(graph({ files, edges: tangled })).contexts).toEqual([]);
  });

  it('rejects sibling folders whose shared sub-folders depend on each other in opposite directions', () => {
    const files = ['src/a/x/1.ts', 'src/a/y/2.ts', 'src/b/x/3.ts', 'src/b/y/4.ts'];
    expect(detectContexts(graph({ files, edges: ['src/a/y/2.ts>src/a/x/1.ts', 'src/b/x/3.ts>src/b/y/4.ts'] })).contexts).toEqual([]);
  });

  it('needs at least two shared sub-folders covering half of their union', () => {
    const files = ['src/a/x/1.ts', 'src/a/y/2.ts', 'src/a/p/5.ts', 'src/a/q/6.ts', 'src/b/x/3.ts', 'src/b/z/4.ts'];
    expect(detectContexts(graph({ files, edges: ['src/a/y/2.ts>src/a/x/1.ts', 'src/b/z/4.ts>src/b/x/3.ts'] })).contexts).toEqual([]);
  });
});
