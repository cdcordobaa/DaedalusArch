/**
 * APG Extractor — C1
 * Bounded Context: ts-morph parsing, AST traversal, node/edge extraction.
 * Input:  ProjectPath (string)
 * Output: DomainResult<APGResult>
 */

export { APGExtractor, extractAPG } from './apg-extractor.js';
export type { ComponentDeclaration, ExtractorOptions, ExtractorError, ExtractorErrorCode, GraphMode, ReExportEdgesMode } from './types.js';
export { GRAPH_MODES, V12E_DEFAULT_OPTIONS, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS } from './types.js';
export { extractApg2, componentsFromLayerModel, APG2_IO_CATEGORIES } from './apg2/index.js';
export type { Apg2Stats } from './apg2/index.js';
export { AST_ONLY_EDGE_TYPES, edgeTypesOf, restrictToGraphMode } from './graph-mode.js';
export type { GraphView } from './graph-mode.js';
export {
  NODE_BUILTIN_MODULES,
  PackageNodeRegistry,
} from './package-node-factory.js';
export type { PackageRoot } from './package-node-factory.js';
