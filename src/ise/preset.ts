/**
 * ISE: the canonical presets as the inferrer reads them (layer names, order, globs, file patterns). These are the
 * tool's own style library (`presets/`), not anything shipped with the judged project.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import type { IseStyle } from './style-classifier.js';

export interface PresetLayer {
  readonly name: string;
  readonly kind?: string;
  readonly directories: readonly string[];
  readonly filePatterns: readonly string[];
}

export interface IsePreset {
  readonly style: IseStyle;
  /** The preset's YAML text. */
  readonly text: string;
  /** Layers in preset order (innermost / bottom first in every preset). */
  readonly layers: readonly PresetLayer[];
}

/** Layer names that hold the composition root (a unit no one imports that wires the rest). */
export const COMPOSITION_LAYERS: readonly string[] = ['config', 'composition'];

/**
 * Structural rank of a preset layer, 0 = innermost. Same-rank layers are siblings (hexagonal adapters); composition
 * layers are ranked outside the order (-1).
 */
export function layerRank(style: IseStyle, layer: string, layers: readonly PresetLayer[]): number {
  if (COMPOSITION_LAYERS.includes(layer)) return -1;
  if (style === 'hexagonal' || style === 'ddd') {
    const ranks: Record<string, number> = { domain: 0, application: 1, 'adapters-inbound': 2, 'adapters-outbound': 2, infrastructure: 2, api: 2 };
    return ranks[layer] ?? 1;
  }
  return layers.filter((l) => !COMPOSITION_LAYERS.includes(l.name)).findIndex((l) => l.name === layer);
}

export function parsePreset(style: IseStyle, text: string): IsePreset {
  const raw = YAML.parse(text) as { architecture?: { layers?: { name: string; kind?: string; directories?: string[]; file_patterns?: string[] }[] } };
  const layers = (raw.architecture?.layers ?? []).map((l) => ({
    name: l.name,
    ...(l.kind !== undefined ? { kind: l.kind } : {}),
    directories: l.directories ?? [],
    filePatterns: l.file_patterns ?? [],
  }));
  return { style, text, layers };
}

/** Reads `<presetsDir>/<style>.yaml`. */
export function loadIsePreset(style: IseStyle, presetsDir: string): IsePreset {
  return parsePreset(style, fs.readFileSync(path.join(presetsDir, `${style}.yaml`), 'utf8'));
}
