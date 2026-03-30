/**
 * APG Extractor — C1
 * Bounded Context: ts-morph parsing, AST traversal, node/edge extraction.
 * Input:  ProjectPath (string)
 * Output: DomainResult<APGResult>
 */

export { APGExtractor, extractAPG } from './apg-extractor.js';
export type { ExtractorOptions, ExtractorError, ExtractorErrorCode } from './types.js';
