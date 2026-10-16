/**
 * Ontology v0: a grounded, model-built semantic layer over the APG (`Sem*` nodes and edges). Cheap proxies propose,
 * the model interprets, deterministic checks verify. Design: `Docs/v1.3/ontology-v0-design.md`.
 */
import * as path from 'node:path';
import type { ExtractorOptions } from '../../apg-extractor/index.js';
import type { LayerModel } from '../../shared/types/spec.js';
import { extractAndEnrich, openProject } from '../cheap/index.js';
import type { OntologyInput } from './pipeline.js';

export * from './types.js';
export * from './pipeline.js';
export * from './provider.js';
export * from './scorer.js';
export { OntologyCache, cacheKeyOf } from './cache.js';
export type { CacheEntry, CacheMode } from './cache.js';
export { ModelCaller } from './caller.js';
export { GroundingIndex, collapseWhitespace, diskReader } from './grounding.js';
export { PROMPT_VERSION, ONTOLOGY_SYSTEM } from './prompts.js';
export { createScriptedResponder, locateQuote } from './scripted-provider.js';
export type { ScriptedAnswers, ScriptedEntry } from './scripted-provider.js';
export { buildUnits } from './units.js';
export { verifyRuleDuplication, comparisonPatterns, numericConstants } from './verify.js';

/** Extracts the APG, runs the cheap proxies and opens the project: everything `runOntology` needs. */
export async function prepareOntologyInput(projectRoot: string, args: { readonly layerModel?: LayerModel; readonly extractorOptions?: ExtractorOptions; readonly tsconfigPath?: string } = {}): Promise<OntologyInput> {
  const root = path.resolve(projectRoot);
  const tsconfig = args.tsconfigPath ?? path.join(root, 'tsconfig.json');
  const { apg, enrichment } = await extractAndEnrich(root, {
    tsconfigPath: tsconfig,
    ...(args.layerModel !== undefined ? { layerModel: args.layerModel } : {}),
    ...(args.extractorOptions !== undefined ? { extractorOptions: args.extractorOptions } : {}),
  });
  return { apg, project: openProject(tsconfig), projectRoot: root, cheap: enrichment, ...(args.layerModel !== undefined ? { layerModel: args.layerModel } : {}) };
}
