/**
 * v1.3 graph-fidelity harness: file-to-layer assignment (FR-V2 b).
 *
 * The assignment is the instrument's own (`annotateNodes`, `src/neo4j-ingestion/layer-annotator.ts`: directory globs,
 * then file-name patterns). The glob that matched is recovered here with the same picomatch options, for the review
 * sheet; a mismatch between the two is reported, never hidden.
 */
import picomatch from 'picomatch';
import { annotateNodes } from '../../../src/neo4j-ingestion/layer-annotator.js';
import type { APGNode } from '../../../src/shared/types/apg.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';

export interface LayerAssignment {
  readonly file: string;
  readonly layer: string | null;
  readonly matchMethod: string | null;
  /** The directory glob or file pattern that matched, '' when none did. */
  readonly glob: string;
}

export interface LayerAssignmentResult {
  readonly total: number;
  readonly assigned: number;
  readonly fractionAssigned: number;
  readonly perLayer: Readonly<Record<string, number>>;
  readonly assignments: readonly LayerAssignment[];
  /** Files where the recovered glob disagrees with `annotateNodes` (expected empty). */
  readonly inconsistencies: readonly string[];
}

function matchedGlob(file: string, model: LayerModel, layer: string | null, method: string | null): string {
  const def = model.layers.find((l) => l.name === layer);
  if (def === undefined) return '';
  const globs = method === 'filename' ? def.filePatterns ?? [] : def.directories;
  return globs.find((g) => picomatch(g, { dot: true })(file)) ?? '';
}

export function assignLayers(files: readonly string[], model: LayerModel): LayerAssignmentResult {
  const nodes: APGNode[] = files.map((f) => ({ id: f, type: 'File', filePath: f, name: f, decorators: [], properties: {} }));
  const { annotations } = annotateNodes(nodes, model);
  const assignments: LayerAssignment[] = [];
  const inconsistencies: string[] = [];
  const perLayer: Record<string, number> = {};
  for (const f of files) {
    const a = annotations.get(f);
    const layer = a?.layer ?? null;
    const method = a?.matchMethod ?? null;
    const glob = matchedGlob(f, model, layer, method);
    if (layer !== null && glob === '') inconsistencies.push(f);
    if (layer !== null) perLayer[layer] = (perLayer[layer] ?? 0) + 1;
    assignments.push({ file: f, layer, matchMethod: method, glob });
  }
  const assigned = assignments.filter((a) => a.layer !== null).length;
  return {
    total: files.length, assigned, fractionAssigned: files.length === 0 ? 1 : assigned / files.length,
    perLayer, assignments, inconsistencies,
  };
}
