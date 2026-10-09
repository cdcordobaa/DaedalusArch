/**
 * APG Extractor — C1
 * Bounded Context: ts-morph parsing, AST traversal, node/edge extraction.
 * Input:  ProjectPath (string)
 * Output: DomainResult<APGResult>
 */

export { APGExtractor, extractAPG } from './apg-extractor.js';
export type { ExtractorOptions, ExtractorError, ExtractorErrorCode, GraphMode } from './types.js';
export { GRAPH_MODES } from './types.js';
export { AST_ONLY_EDGE_TYPES, edgeTypesOf, restrictToGraphMode } from './graph-mode.js';
export type { GraphView } from './graph-mode.js';
export {
  NODE_BUILTIN_MODULES,
  PackageNodeRegistry,
} from './package-node-factory.js';
export type { PackageRoot } from './package-node-factory.js';
