/**
 * File-path to layer resolution for the MCP prototype. Same matching as the graph's layer annotator
 * (`neo4j-ingestion/layer-annotator.ts`): picomatch with `dot: true`, directory globs first in layer order,
 * then `file_patterns`; the first layer that matches wins. Pure.
 */
import picomatch from 'picomatch';
import type { ParsedSpec } from '../shared/types/spec.js';

export interface LayerMatch {
  readonly layer: string;
  readonly matchedBy: 'directory' | 'filename';
  readonly glob: string;
}

/** Project-relative POSIX form of a path: backslashes to slashes, leading `./` and `/` removed. */
export function normalisePath(p: string): string {
  const posix = p.replace(/\\/g, '/');
  const parts: string[] = [];
  for (const seg of posix.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join('/');
}

function firstGlob(globs: readonly string[], path: string): string | undefined {
  return globs.find((g) => picomatch(g, { dot: true })(path));
}

/** The layer a project-relative file path belongs to, or `undefined` when no layer's globs match. */
export function resolveLayer(spec: ParsedSpec, path: string): LayerMatch | undefined {
  const file = normalisePath(path);
  for (const layer of spec.layerModel.layers) {
    const glob = firstGlob(layer.directories, file);
    if (glob !== undefined) return { layer: layer.name, matchedBy: 'directory', glob };
  }
  for (const layer of spec.layerModel.layers) {
    const glob = firstGlob(layer.filePatterns ?? [], file);
    if (glob !== undefined) return { layer: layer.name, matchedBy: 'filename', glob };
  }
  return undefined;
}
