/**
 * ISE Option 2, step 2: map the project's directory units to the chosen preset's layers.
 *
 * Two modes:
 * - `preset-first` (the Option 2 design): keep every preset directory glob that matches at least one file (a glob
 *   with an inner `*` is expanded to the concrete directories it matches, e.g. `src/*\/domain/**` ->
 *   `src/ordering/domain/**`), keep the file patterns that match a file, then infer a layer for each unit the kept
 *   globs leave uncovered;
 * - `infer-only` (ablation): drop every preset directory glob and infer every unit (file patterns are kept: they are
 *   naming conventions, not directory mappings).
 * A unit's layer comes from its directory token (`LAYER_SYNONYMS`) and, independently, from the edge structure
 * (its level among all units, scaled onto the preset's layer ranks; a composition root goes to the composition layer;
 * sibling outer units are split by whether they implement inner interfaces). Agreement raises the confidence.
 */
import picomatch from 'picomatch';
import { annotateNodes } from '../neo4j-ingestion/layer-annotator.js';
import type { APGNode } from '../shared/types/apg.js';
import type { LayerModel } from '../shared/types/spec.js';
import type { IseGraph } from './graph-view.js';
import { COMPOSITION_LAYERS, layerRank } from './preset.js';
import type { IsePreset } from './preset.js';
import { boundedContexts } from './style-classifier.js';
import type { IseStyle } from './style-classifier.js';
import { detectSourceRoot, unitStructure } from './units.js';
import type { Unit, UnitStructure } from './units.js';
import { LAYER_SYNONYMS } from './vocabulary.js';

export type MappingMode = 'preset-first' | 'infer-only';

export type MappingSource = 'preset-glob' | 'file-pattern' | 'token+structure' | 'token' | 'structure' | 'public-api' | 'feature-folder' | 'none';

export interface UnitMapping {
  readonly unit: string;
  readonly layer: string | null;
  readonly tokenLayer: string | null;
  readonly structureLayer: string | null;
  readonly source: MappingSource;
  readonly confidence: number;
}

export interface FileAssignment {
  readonly file: string;
  readonly layer: string | null;
  readonly confidence: number;
  readonly source: MappingSource;
}

export interface InferredLayer {
  readonly name: string;
  readonly directories: readonly string[];
  readonly filePatterns: readonly string[];
}

export interface LayerMapping {
  readonly style: IseStyle;
  readonly mode: MappingMode;
  readonly layers: readonly InferredLayer[];
  readonly units: readonly UnitMapping[];
  readonly files: readonly FileAssignment[];
  readonly structure: UnitStructure;
}

const match = (globs: readonly string[]): ((f: string) => boolean) => (globs.length === 0 ? () => false : picomatch(globs as string[], { dot: true }));

/**
 * Concrete globs of `glob` over `files`: a glob without an inner wildcard is returned when it matches; one with `*`
 * segments before its tail is expanded to each matched directory. Empty when nothing matches.
 */
export function expandGlob(glob: string, files: readonly string[]): string[] {
  const m = match([glob]);
  const hits = files.filter((f) => m(f));
  if (hits.length === 0) return [];
  const segs = glob.split('/');
  const tailAt = segs.findIndex((s) => s === '**');
  const head = tailAt < 0 ? segs : segs.slice(0, tailAt);
  if (!head.some((s) => s.includes('*'))) return [glob];
  const out = new Set<string>();
  for (const f of hits) {
    const fs = f.split('/');
    const concrete = head.map((s, i) => (s.includes('*') && i < fs.length - (tailAt < 0 ? 0 : 1) ? fs[i] ?? s : s));
    out.add([...concrete, ...(tailAt < 0 ? [] : segs.slice(tailAt))].join('/'));
  }
  return [...out].sort();
}

/** Layer of each file under `layers` with the firewall's own annotator (directories first, then file patterns). */
export function annotate(files: readonly string[], layers: readonly InferredLayer[]): Map<string, { layer: string | null; method: string | null }> {
  const model: LayerModel = {
    layers: layers.map((l) => ({ name: l.name, directories: [...l.directories], naming: [], filePatterns: [...l.filePatterns], role: '' })),
  };
  const nodes: APGNode[] = files.map((f) => ({ id: f, type: 'File', filePath: f, name: f, decorators: [], properties: {} }));
  const { annotations } = annotateNodes(nodes, model);
  const out = new Map<string, { layer: string | null; method: string | null }>();
  for (const f of files) {
    const a = annotations.get(f);
    out.set(f, { layer: a?.layer ?? null, method: a?.matchMethod ?? null });
  }
  return out;
}

/** The first preset layer named by `token`: exact layer name first, then synonyms in preset order. */
export function tokenLayer(token: string, preset: IsePreset): string | null {
  const exact = preset.layers.find((l) => l.name === token);
  if (exact !== undefined) return exact.name;
  for (const l of preset.layers) if ((LAYER_SYNONYMS[l.name] ?? []).includes(token)) return l.name;
  return null;
}

/** Units whose classes implement interfaces declared in a lower-level unit. */
function implementersOfInnerPorts(graph: IseGraph, s: UnitStructure): Set<string> {
  const out = new Set<string>();
  for (const e of graph.typeEdges) {
    if (e.kind !== 'implements') continue;
    const a = s.unitOf.get(e.from.file);
    const b = s.unitOf.get(e.to.file);
    if (a === undefined || b === undefined || a === b) continue;
    if ((s.level.get(b) ?? 0) < (s.level.get(a) ?? 0)) out.add(a);
  }
  return out;
}

/** The layer the edge structure alone suggests for `unit` (see the file comment). */
export function structureLayer(unit: Unit, s: UnitStructure, preset: IsePreset, implementers: ReadonlySet<string>): string | null {
  const composition = preset.layers.find((l) => COMPOSITION_LAYERS.includes(l.name));
  // An entry point (a root file no unit imports) or a composition root directory (imports >= 2 units, imported by
  // none) leaves the layer order: to the composition layer when the preset has one, else to no layer.
  const outside = (u: Unit): boolean =>
    s.roots.includes(u.id) && (u.kind === 'file' || (composition !== undefined && s.edges.filter((e) => e.from === u.id).length >= 2));
  if (outside(unit)) return composition?.name ?? null;
  const ranked = preset.layers
    .map((l) => ({ name: l.name, rank: layerRank(preset.style, l.name, preset.layers) }))
    .filter((l) => l.rank >= 0);
  const maxRank = Math.max(0, ...ranked.map((l) => l.rank));
  const others = s.units.filter((u) => !outside(u));
  const maxLevel = Math.max(0, ...others.map((u) => s.level.get(u.id) ?? 0));
  const lvl = s.level.get(unit.id) ?? 0;
  const r = maxLevel === 0 ? 0 : Math.round((lvl / maxLevel) * maxRank);
  const atRank = ranked.filter((l) => l.rank === r);
  if (atRank.length <= 1) return atRank[0]?.name ?? null;
  // Sibling outer layers: the one whose units implement inner ports is the outbound / infrastructure side.
  const outbound = atRank.find((l) => ['adapters-outbound', 'infrastructure'].includes(l.name));
  const inbound = atRank.find((l) => ['adapters-inbound', 'api'].includes(l.name));
  if (outbound !== undefined && inbound !== undefined) return implementers.has(unit.id) ? outbound.name : inbound.name;
  return atRank[0]?.name ?? null;
}

const CONF = { agree: 0.9, presetDisagree: 0.6, tokenOnly: 0.6, structureOnly: 0.5, pattern: 0.7, none: 0.5 } as const;

export function inferLayerMapping(graph: IseGraph, style: IseStyle, preset: IsePreset, mode: MappingMode = 'preset-first'): LayerMapping {
  const files = graph.files;
  const sourceRoot = detectSourceRoot(files);
  const contexts = style === 'ddd' ? new Set(boundedContexts(files, sourceRoot)) : new Set<string>();
  const s = unitStructure(graph, (id) => contexts.has(id));
  const implementers = implementersOfInnerPorts(graph, s);

  // 1. Kept preset globs and file patterns.
  const layers = preset.layers.map((l) => ({
    name: l.name,
    directories: mode === 'preset-first' ? l.directories.flatMap((g) => expandGlob(g, files)) : [],
    filePatterns: l.filePatterns.filter((p) => files.some((f) => match([p])(f))),
  }));
  const first = annotate(files, layers);

  // 2. Infer a layer for each unit the kept globs leave (partly) uncovered.
  const units: UnitMapping[] = [];
  const added = new Map<string, string[]>();
  for (const u of s.units) {
    const tokenL = tokenLayer(u.token, preset);
    const structL = structureLayer(u, s, preset, implementers);
    const uncovered = u.files.filter((f) => first.get(f)?.layer === null);
    const byPattern = u.files.filter((f) => first.get(f)?.method === 'filename').length;
    if (uncovered.length === 0) {
      const covered = new Set(u.files.map((f) => first.get(f)?.layer ?? null));
      const lay = covered.size === 1 ? [...covered][0] ?? null : null;
      const viaPattern = byPattern === u.files.length;
      units.push({ unit: u.id, layer: lay, tokenLayer: tokenL, structureLayer: structL, source: viaPattern ? 'file-pattern' : 'preset-glob', confidence: viaPattern ? CONF.pattern : (tokenL ?? structL) === lay ? CONF.agree : CONF.presetDisagree });
      continue;
    }
    const inContext = [...contexts].some((c) => u.id.startsWith(c));
    if (inContext && (u.directOnly || ['contracts', 'publishedlanguage'].includes(u.token))) {
      units.push({ unit: u.id, layer: null, tokenLayer: tokenL, structureLayer: structL, source: 'public-api', confidence: CONF.pattern });
      continue;
    }
    if (byPattern * 2 >= u.files.length) {
      units.push({ unit: u.id, layer: null, tokenLayer: tokenL, structureLayer: structL, source: 'feature-folder', confidence: CONF.none });
      continue;
    }
    const layer = tokenL ?? structL;
    const source: MappingSource = layer === null ? 'none' : tokenL === null ? 'structure' : tokenL === structL ? 'token+structure' : 'token';
    const confidence = source === 'token+structure' ? CONF.agree : source === 'token' ? CONF.tokenOnly : source === 'structure' ? CONF.structureOnly : CONF.none;
    units.push({ unit: u.id, layer, tokenLayer: tokenL, structureLayer: structL, source, confidence });
    if (layer === null) continue;
    const globs = uncovered.length === u.files.length ? [u.kind === 'file' ? u.id : u.directOnly ? `${u.id}*` : `${u.id}**`] : uncovered;
    added.set(layer, [...(added.get(layer) ?? []), ...globs]);
  }

  const finalLayers: InferredLayer[] = layers.map((l) => ({
    name: l.name,
    directories: [...new Set([...l.directories, ...(added.get(l.name) ?? [])])],
    filePatterns: l.filePatterns,
  }));
  const final = annotate(files, finalLayers);
  const unitConf = new Map(units.map((u) => [u.unit, u]));
  const fileAssignments: FileAssignment[] = files.map((f) => {
    const a = final.get(f);
    const um = unitConf.get(s.unitOf.get(f) ?? '');
    if (a?.method === 'filename') return { file: f, layer: a.layer, confidence: CONF.pattern, source: 'file-pattern' };
    return { file: f, layer: a?.layer ?? null, confidence: um?.confidence ?? CONF.none, source: um?.source ?? 'none' };
  });
  return { style, mode, layers: finalLayers, units, files: fileAssignments, structure: s };
}
