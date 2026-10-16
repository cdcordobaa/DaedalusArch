/**
 * ISE entry point: infer a firewall spec from a source snapshot (Option 2: classify the style, load its canonical
 * preset, parameterise the layer globs, emit and validate), with the Option 1 majority-vote rule candidates as a
 * report. The input is a snapshot directory (`snapshotSource`), never the original project.
 */
import { inferDddBlock } from './ddd-inferrer.js';
import type { InferredDdd } from './ddd-inferrer.js';
import { loadIseGraph } from './graph-view.js';
import type { IseGraph } from './graph-view.js';
import { inferLayerMapping } from './layer-mapper.js';
import type { LayerMapping, MappingMode } from './layer-mapper.js';
import { mineRules } from './majority-vote.js';
import type { RuleCandidate } from './majority-vote.js';
import { loadIsePreset } from './preset.js';
import type { IsePreset } from './preset.js';
import { emitSpecYaml, validateEmittedSpec } from './spec-emitter.js';
import type { SpecCheck } from './spec-emitter.js';
import { detectContexts } from './contexts.js';
import { classifyStyle } from './style-classifier.js';
import type { IseStyle, StyleClassification } from './style-classifier.js';
import { unitStructure } from './units.js';

export interface IseOptions {
  /** The tool's canonical presets (`presets/` of this repository). */
  readonly presetsDir: string;
  readonly mode?: MappingMode;
  /** Skip classification and use this style (for ablations). */
  readonly style?: IseStyle;
}

export interface IseInference {
  readonly classification: StyleClassification;
  readonly style: IseStyle;
  readonly preset: IsePreset;
  readonly mapping: LayerMapping;
  readonly ddd?: InferredDdd;
  readonly specYaml: string;
  readonly majorityVote: readonly RuleCandidate[];
}

/** Inference from an in-memory graph (no file reads besides the preset). */
export function inferFromGraph(graph: IseGraph, opts: IseOptions): IseInference {
  const classification = classifyStyle(graph);
  const style = opts.style ?? classification.best;
  const preset = loadIsePreset(style, opts.presetsDir);
  const mapping = inferLayerMapping(graph, style, preset, opts.mode ?? 'preset-first');
  const ddd = style === 'ddd' ? inferDddBlock(graph) : undefined;
  const top = classification.ranked[0];
  const header = [
    `style: ${style} (${opts.style !== undefined ? 'forced' : `classified, confidence ${(top?.confidence ?? 0).toFixed(2)}`}); layer mapping: ${mapping.mode}`,
    `evidence: ${(classification.ranked.find((r) => r.style === style)?.evidence ?? []).join('; ') || 'none'}`,
    `units: ${mapping.units.map((u) => `${u.unit}=${u.layer ?? '-'} (${u.source})`).join(', ')}`,
  ];
  const specYaml = emitSpecYaml({ preset, mapping, ...(ddd !== undefined ? { ddd } : {}), header });
  // Option 1 is style-free; it splits bounded-context-like folders (a structural fact) like the DDD mapping does.
  const contexts = new Set(detectContexts(graph).contexts.map((c) => c.root));
  const majorityVote = mineRules(graph, unitStructure(graph, (id) => contexts.has(id)));
  return { classification, style, preset, mapping, ...(ddd !== undefined ? { ddd } : {}), specYaml, majorityVote };
}

/** Extracts the snapshot's graph, infers, and validates the emitted spec against the snapshot. */
export async function inferSpec(snapshotDir: string, opts: IseOptions): Promise<IseInference & { readonly graph: IseGraph; readonly check: SpecCheck }> {
  const graph = await loadIseGraph(snapshotDir);
  const inference = inferFromGraph(graph, opts);
  const check = await validateEmittedSpec(inference.specYaml, snapshotDir);
  return { ...inference, graph, check };
}
