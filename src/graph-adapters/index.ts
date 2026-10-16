import { buildApg } from './apg-builder.js';
import { readCodeGraphContext } from './codegraphcontext.js';
import { readGitNexus } from './gitnexus.js';
import { readGraphifyGraphml, readGraphifyJson } from './graphify.js';
import type { AdapterOptions, AdapterResult, ExternalFormat, NormalizedGraph } from './types.js';
import { commonDirPrefix, normPath, slashPath } from './util.js';

export * from './types.js';
export { FORMAT_CAPABILITIES, FORMAT_PROPERTIES, computeCoverageMatrix, coverageOf, requirementsOf } from './capabilities.js';
export type { CoverageCell, CoverageMatrix, CoverageStatus, TemplateRequirements } from './capabilities.js';

/** The input of each format: JSON text or parsed value, GraphML text, or the two JSONL texts of a `.cgc` bundle. */
export interface AdapterInputs {
  readonly 'graphify-json': string | object;
  readonly 'graphify-graphml': string;
  readonly codegraphcontext: { readonly nodesJsonl: string; readonly edgesJsonl: string };
  readonly gitnexus: string | object;
}

export interface ProjectRootOption {
  /** Absolute project root to strip from absolute node paths; default: the common directory prefix. */
  readonly projectRoot?: string;
}

function relativise(graph: NormalizedGraph, projectRoot: string | undefined): NormalizedGraph {
  const paths = graph.nodes.flatMap((n) => (n.filePath === undefined ? [] : [n.filePath]));
  const root = (projectRoot !== undefined ? slashPath(projectRoot) : commonDirPrefix(paths)).replace(/\/+$/, '');
  const strip = (p: string): string => normPath(root !== '' && p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p);
  return { ...graph, nodes: graph.nodes.map((n) => (n.filePath === undefined ? n : { ...n, filePath: strip(n.filePath) })) };
}

/**
 * Convert an external code-graph export into APG nodes and edges (v1.3 prototype). The result feeds the same
 * layer annotation, ingestion and compiled Cypher as the ts-morph extractor's APG; `report` says which APG
 * edge types the export could not produce.
 */
export function adaptExternalGraph<F extends ExternalFormat>(
  format: F,
  input: AdapterInputs[F],
  options: AdapterOptions & ProjectRootOption = {},
): AdapterResult {
  let graph: NormalizedGraph;
  switch (format) {
    case 'graphify-json': graph = readGraphifyJson(input); break;
    case 'graphify-graphml': graph = readGraphifyGraphml(input as string); break;
    case 'codegraphcontext': {
      const bundle = input as AdapterInputs['codegraphcontext'];
      graph = readCodeGraphContext(bundle.nodesJsonl, bundle.edgesJsonl);
      break;
    }
    default: graph = readGitNexus(input); break;
  }
  return buildApg(format, relativise(graph, options.projectRoot), options);
}
