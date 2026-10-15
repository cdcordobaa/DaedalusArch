import type { Node, SourceFile } from 'ts-morph';
import type { APGEdge, APGNode, Apg2Stats } from '../../shared/types/apg.js';
import type { ComponentDeclaration, NodeLookup } from '../types.js';
import { ownerNodeId } from './common.js';
import { extractSignatureUses } from './type-flow.js';
import { extractComponents } from './components.js';
import { extractAsyncCoupling } from './async-coupling.js';
import { extractIoBoundary } from './io-boundary.js';

export { componentsFromLayerModel, folderComponents } from './components.js';
export { APG2_IO_CATEGORIES, IO_PACKAGES } from './io-boundary.js';
export type { IoCategory } from './io-boundary.js';
export type { Apg2Stats } from '../../shared/types/apg.js';


export interface Apg2Result {
  readonly nodes: APGNode[];
  readonly edges: APGEdge[];
  readonly stats: Apg2Stats;
}

/**
 * The APG v2 passes (`Docs/v1.3/apg2-design.md`), run after the v1.3 extraction over its nodes and edges. Output order:
 * Component, Channel, IOCategory nodes; SIGNATURE_USES, component edges (DEPENDS_ON, BELONGS_TO, EXPORTS_SYMBOL,
 * DEEP_IMPORT), PUBLISHES / SUBSCRIBES, PERFORMS_IO edges.
 */
export function extractApg2(
  sourceFiles: readonly SourceFile[],
  lookup: NodeLookup,
  projectRoot: string,
  nodes: readonly APGNode[],
  edges: readonly APGEdge[],
  components: readonly ComponentDeclaration[],
): Apg2Result {
  const ownerOf = (node: Node, filePath: string): string | undefined => ownerNodeId(node, lookup, filePath);
  const time = <T>(f: () => T): [T, number] => {
    const t0 = performance.now();
    const r = f();
    return [r, Math.round((performance.now() - t0) * 10) / 10];
  };
  const [sig, tSig] = time(() => extractSignatureUses(sourceFiles, lookup, projectRoot));
  const [comp, tComp] = time(() => extractComponents({ sourceFiles, nodes, edges, lookup, projectRoot, declarations: components }));
  const [asy, tAsync] = time(() => extractAsyncCoupling(sourceFiles, lookup, projectRoot, ownerOf));
  const [io, tIo] = time(() => extractIoBoundary(sourceFiles, lookup, projectRoot, ownerOf));
  const count = (type: string): number => comp.edges.filter((e) => e.type === type).length;
  return {
    nodes: [...comp.nodes, ...asy.nodes, ...io.nodes],
    edges: [...sig, ...comp.edges, ...asy.edges, ...io.edges],
    stats: {
      signatureUses: sig.length,
      components: comp.nodes.length,
      componentSource: components.length > 0 ? 'declared' : 'folders',
      dependsOn: count('DEPENDS_ON'),
      deepImports: count('DEEP_IMPORT'),
      exportsSymbol: count('EXPORTS_SYMBOL'),
      channels: asy.nodes.length,
      async: asy.stats,
      io: io.stats,
      timingsMs: { typeFlow: tSig, components: tComp, async: tAsync, io: tIo },
    },
  };
}
