/**
 * Import-graph parity with the extractor (FR-v1.2E-24; BR-U5a-56; D-U5a-15).
 *
 * Lives outside `scripts/lib/mutation/**`, so it may import `extractAPG` (the BR-U5a-06 static check covers the
 * mutation engine only). Used by the parity unit test and by the `scripts/u5a-parity-check.ts` CLI (Step 34), which
 * Build and Test runs on every prepared corpus base before seeding.
 *
 * Compared: the File set (`filePath`), the `isBarrel` flag per File, and the File→File `IMPORTS` / `RE_EXPORTS` edge
 * set projected to `(source filePath, target filePath, type, isTypeOnly)`. Layers are not compared (the extractor
 * assigns none; the builder takes them from the spec).
 */
import * as path from 'node:path';
import { extractAPG } from '../../src/apg-extractor/index.js';
import { buildImportGraph, openImportGraphProject } from './mutation/import-graph.js';
import type { ImportGraph, LayerDirs } from './mutation/import-graph.js';

export interface ParityResult {
  readonly equal: boolean;
  /** Projected items present only in the builder's graph, sorted. */
  readonly onlyInBuilder: readonly string[];
  /** Projected items present only in the extractor's graph, sorted. */
  readonly onlyInExtractor: readonly string[];
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Projection of a builder graph: `file <path> barrel=<bool>` and `edge <type> <source> -> <target> typeOnly=<bool>`. */
export function projectBuilderGraph(g: ImportGraph): string[] {
  const items: string[] = [];
  for (const f of g.files.values()) items.push(`file ${f.filePath} barrel=${String(f.isBarrel)}`);
  for (const e of g.edges) items.push(`edge ${e.type} ${e.source} -> ${e.target} typeOnly=${String(e.isTypeOnly)}`);
  return items.sort(cmp);
}

/** The same projection of `extractAPG`'s File nodes and File→File import edges. */
export async function projectExtractorGraph(projectDir: string): Promise<string[]> {
  const result = await extractAPG(projectDir);
  if (!result.success) {
    throw new Error(`extractAPG failed on ${projectDir}: ${result.errors.map((e) => e.message).join('; ')}`);
  }
  const fileById = new Map<string, string>();
  const items: string[] = [];
  for (const n of result.data.nodes) {
    if (n.type !== 'File') continue;
    fileById.set(n.id, n.filePath);
    items.push(`file ${n.filePath} barrel=${String(n.properties.isBarrel === true)}`);
  }
  for (const e of result.data.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') continue;
    const source = fileById.get(e.sourceId);
    const target = fileById.get(e.targetId);
    if (source === undefined || target === undefined) continue;
    items.push(`edge ${e.type} ${source} -> ${target} typeOnly=${String(e.properties.isTypeOnly === true)}`);
  }
  return items.sort(cmp);
}

/**
 * Builds both graphs over one project directory and compares them. `tsconfigPath` (absolute or relative to
 * `projectDir`) must be `<projectDir>/tsconfig.json`, the only tsconfig `extractAPG` reads.
 */
export async function compareImportGraphs(
  projectDir: string,
  tsconfigPath: string,
  layers: readonly LayerDirs[],
): Promise<ParityResult> {
  const root = path.resolve(projectDir);
  const tsconfigAbs = path.resolve(root, tsconfigPath);
  if (tsconfigAbs !== path.join(root, 'tsconfig.json')) {
    throw new Error(`compareImportGraphs: extractAPG reads <projectDir>/tsconfig.json only, got ${tsconfigAbs}`);
  }
  const builder = projectBuilderGraph(buildImportGraph(openImportGraphProject(root, tsconfigAbs), layers));
  const extractor = await projectExtractorGraph(root);
  const b = new Set(builder);
  const x = new Set(extractor);
  const onlyInBuilder = builder.filter((i) => !x.has(i));
  const onlyInExtractor = extractor.filter((i) => !b.has(i));
  return { equal: onlyInBuilder.length === 0 && onlyInExtractor.length === 0, onlyInBuilder, onlyInExtractor };
}
