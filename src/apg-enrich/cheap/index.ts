/**
 * Cheap semantic proxies (pass 0.5): deterministic programmatic proxies for semantic properties, run over the
 * in-memory APG and the ts-morph project before any LLM pass. They propose candidate sites; a later LLM pass verifies
 * them. Design: `Docs/v1.3/cheap-semantics-design.md`.
 *
 * The extractor is consumed, never edited: `enrichCheap` reads an `APGResult` and a `Project` over the same tsconfig,
 * and returns extra edges, node properties and flags alongside it.
 */
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { extractAPG } from '../../apg-extractor/index.js';
import type { ExtractorOptions } from '../../apg-extractor/index.js';
import type { APGResult } from '../../shared/types/apg.js';
import type { LayerModel } from '../../shared/types/spec.js';
import { buildContext } from './context.js';
import type { CheapContext, CheapInput } from './context.js';
import { runClones } from './clones.js';
import { runSharedLiterals } from './literals.js';
import { runLogicDensity, runNameBehaviour, runRepoBypass } from './roles.js';
import { runCohesion } from './cohesion.js';
import { runFrameworkInCore } from './framework-core.js';
import { runVocabulary } from './vocabulary.js';
import { runCommunities } from './communities.js';
import { runDocText } from './doc-text.js';
import { runErrorFlow } from './error-flow.js';
import { runReachability } from './reachability.js';
import { runSdkSpread } from './sdk-spread.js';
import { runTestTopology } from './test-topology.js';
import { runConfigSurface } from './config-surface.js';
import { runCoChange } from './co-change.js';
import { DEFAULT_CHEAP_OPTIONS } from './types.js';
import type { CheapEdge, CheapEnrichment, CheapFlag, CheapNodeFact, CheapOptions, CheapProxyOutput, CheapVirtualNode, ContextProxyId, ProxyId } from './types.js';

export * from './types.js';
export type { CheapContext, CheapInput } from './context.js';
export { buildContext, componentOf } from './context.js';
export { analyseProvenance, readGitHistory, readLoopRun } from './provenance.js';
export type { ProvenanceOptions, ProvenanceResult, ProvenanceStep, SnapshotHistory } from './provenance.js';

const RUNNERS: Readonly<Record<ContextProxyId, (ctx: CheapContext) => CheapProxyOutput>> = {
  'clones': runClones,
  'shared-literals': runSharedLiterals,
  'name-behaviour': runNameBehaviour,
  'cohesion': runCohesion,
  'logic-density': runLogicDensity,
  'repo-bypass': runRepoBypass,
  'framework-in-core': runFrameworkInCore,
  'vocabulary': runVocabulary,
  'communities': runCommunities,
  'doc-text': runDocText,
  'error-flow': runErrorFlow,
  'reachability': runReachability,
  'sdk-spread': runSdkSpread,
  'test-topology': runTestTopology,
  'config-surface': runConfigSurface,
  'co-change': runCoChange,
};

/** Runs the selected proxies over one project. Pure with respect to its inputs. */
export function enrichCheap(input: CheapInput, options: Partial<CheapOptions> = {}): CheapEnrichment {
  const opts: CheapOptions = { ...DEFAULT_CHEAP_OPTIONS, ...options };
  const timingsMs: Record<string, number> = {};
  let t0 = performance.now();
  const ctx = buildContext(input, opts);
  timingsMs.context = performance.now() - t0;
  const edges: CheapEdge[] = [];
  const nodeFacts: CheapNodeFact[] = [];
  const flags: CheapFlag[] = [];
  const virtualNodes: CheapVirtualNode[] = [];
  const summaries: Partial<Record<ProxyId, Record<string, unknown>>> = {};
  for (const id of opts.proxies) {
    t0 = performance.now();
    const out = RUNNERS[id](ctx);
    timingsMs[id] = performance.now() - t0;
    edges.push(...out.edges);
    nodeFacts.push(...out.nodeFacts);
    flags.push(...out.flags);
    virtualNodes.push(...(out.virtualNodes ?? []));
    summaries[id] = out.summary;
  }
  return { edges, nodeFacts, flags, virtualNodes, summaries, timingsMs };
}

/** Opens a ts-morph project the way `extractAPG` does, with dependency resolution on (types of packages resolve). */
export function openProject(tsconfigPath: string): Project {
  return new Project({ tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: false });
}

/** Extracts the APG of a project and runs the proxies on it. Throws on an extraction failure. */
export async function extractAndEnrich(
  projectRoot: string,
  args: { readonly layerModel?: LayerModel; readonly extractorOptions?: ExtractorOptions; readonly tsconfigPath?: string; readonly options?: Partial<CheapOptions> } = {},
): Promise<{ apg: APGResult; enrichment: CheapEnrichment; extractMs: number }> {
  const root = path.resolve(projectRoot);
  const tsconfig = args.tsconfigPath ?? path.join(root, 'tsconfig.json');
  const t0 = performance.now();
  const res = await extractAPG(root, args.extractorOptions ?? {}, tsconfig);
  if (!res.success) throw new Error(`extraction failed: ${res.errors.map((e) => e.message).join('; ')}`);
  const extractMs = performance.now() - t0;
  const project = openProject(tsconfig);
  const enrichment = enrichCheap({ apg: res.data, project, projectRoot: root, ...(args.layerModel !== undefined ? { layerModel: args.layerModel } : {}) }, args.options);
  return { apg: res.data, enrichment, extractMs };
}
