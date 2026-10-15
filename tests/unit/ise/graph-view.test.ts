import { iseGraphFromApg } from '../../../src/ise/graph-view.js';
import type { APGEdge, APGNode } from '../../../src/shared/types/apg.js';

const node = (id: string, type: APGNode['type'], filePath: string, name = filePath, decorators: string[] = []): APGNode => ({ id, type, filePath, name, decorators, properties: {} });
const edge = (id: string, type: APGEdge['type'], sourceId: string, targetId: string, properties: Record<string, unknown> = {}): APGEdge => ({ id, type, sourceId, targetId, properties });

describe('ISE graph view', () => {
  it('keeps file edges once per pair, package imports, declarations and type edges', () => {
    const nodes = [
      node('f1', 'File', '/p/src/a.ts'), node('f2', 'File', '/p/src/b.ts'), node('pk', 'Package', '', 'typeorm'),
      node('c1', 'Class', '/p/src/a.ts', 'A', ['Entity']), node('i1', 'Interface', '/p/src/b.ts', 'B'),
    ];
    const edges = [
      edge('e1', 'IMPORTS', 'f1', 'f2', { isTypeOnly: true }), edge('e2', 'IMPORTS', 'f1', 'f2', { isTypeOnly: false }),
      edge('e3', 'RE_EXPORTS', 'f2', 'f1'), edge('e4', 'IMPORTS', 'f1', 'pk'), edge('e5', 'IMPLEMENTS', 'c1', 'i1'), edge('e6', 'CALLS', 'c1', 'i1'),
    ];
    const g = iseGraphFromApg(nodes, edges, (p) => p.replace('/p/', ''));
    expect(g.files).toEqual(['src/a.ts', 'src/b.ts']);
    expect(g.edges).toEqual([{ from: 'src/a.ts', to: 'src/b.ts', typeOnly: false }, { from: 'src/b.ts', to: 'src/a.ts', typeOnly: false }]);
    expect(g.packageImports).toEqual([{ file: 'src/a.ts', pkg: 'typeorm' }]);
    expect(g.declarations).toEqual([
      { name: 'A', kind: 'class', file: 'src/a.ts', decorators: ['Entity'] },
      { name: 'B', kind: 'interface', file: 'src/b.ts', decorators: [] },
    ]);
    expect(g.typeEdges.map((e) => [e.kind, e.from.name, e.to.name])).toEqual([['implements', 'A', 'B']]);
  });
});
