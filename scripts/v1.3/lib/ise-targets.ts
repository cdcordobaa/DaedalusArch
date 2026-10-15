/**
 * ISE prototype measurement targets: the five dev reference projects as they are, and one robustness probe per
 * style (the same project with its layer directories renamed to non-standard names, imports rewritten). P1 is the
 * primary probe (clean-architecture: core -> kernel, application -> orchestration, infrastructure -> platform).
 *
 * Ground truth for a probe is the reference's own, mapped through the same renaming: expected layers, the true
 * spec's globs (and DDD block), expected findings. Evaluation code only; src/ise never imports this.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { renameFindingPath, renameGlob, renamePath, renameProject } from './ise-rename.js';
import type { RenameMap } from './ise-rename.js';
import { materialiseVariant } from './materialise.js';
import type { ExpectedFinding, LoadedReference, LoadedVariant, ReferenceStyle } from './reference-model.js';

export interface IseTarget {
  readonly id: string;
  readonly style: ReferenceStyle;
  /** Empty for the reference as it is. */
  readonly rename: RenameMap;
}

export const ISE_TARGETS: readonly IseTarget[] = [
  { id: 'clean-architecture', style: 'clean-architecture', rename: {} },
  { id: 'layered', style: 'layered', rename: {} },
  { id: 'nestjs', style: 'nestjs', rename: {} },
  { id: 'hexagonal', style: 'hexagonal', rename: {} },
  { id: 'ddd', style: 'ddd', rename: {} },
  { id: 'P1-clean-architecture-renamed', style: 'clean-architecture', rename: { 'src/domain': 'src/kernel', 'src/application': 'src/orchestration', 'src/infrastructure': 'src/platform' } },
  { id: 'P2-layered-renamed', style: 'layered', rename: { 'src/presentation': 'src/frontend', 'src/business': 'src/kernel', 'src/persistence': 'src/platform' } },
  { id: 'P3-nestjs-renamed', style: 'nestjs', rename: { 'src/domain': 'src/kernel', 'src/common': 'src/platform' } },
  {
    id: 'P4-hexagonal-renamed', style: 'hexagonal',
    rename: { 'src/domain': 'src/kernel', 'src/application': 'src/orchestration', 'src/adapters/inbound': 'src/plugins/entry', 'src/adapters/outbound': 'src/plugins/exit', 'src/config': 'src/setup' },
  },
  {
    id: 'P5-ddd-renamed', style: 'ddd',
    rename: {
      'src/ordering/domain': 'src/ordering/kernel', 'src/billing/domain': 'src/billing/kernel',
      'src/ordering/application': 'src/ordering/orchestration', 'src/billing/application': 'src/billing/orchestration',
      'src/ordering/infrastructure': 'src/ordering/platform', 'src/billing/infrastructure': 'src/billing/platform',
    },
  },
];

/** Materialises `variant` of `ref` under `work` and applies the target's renaming; returns the project directory. */
export function materialiseTarget(ref: LoadedReference, variant: LoadedVariant, target: IseTarget, work: string): string {
  const m = materialiseVariant(ref, variant, path.join(work, target.id));
  if (Object.keys(target.rename).length > 0) renameProject(m.projectDir, target.rename);
  return m.projectDir;
}

/** The true spec's YAML for the target: the reference spec, its layer globs and DDD block renamed. */
export function trueSpecText(ref: LoadedReference, target: IseTarget): string {
  const text = fs.readFileSync(ref.specPath, 'utf8');
  if (Object.keys(target.rename).length === 0) return text;
  const doc = YAML.parseDocument(text);
  const raw = doc.toJS() as { architecture: { layers: { directories?: string[]; file_patterns?: string[] }[]; ddd?: unknown } };
  raw.architecture.layers.forEach((l, i) => {
    if (l.directories !== undefined) doc.setIn(['architecture', 'layers', i, 'directories'], doc.createNode(l.directories.map((g) => renameGlob(g, target.rename))));
  });
  if (raw.architecture.ddd !== undefined) doc.setIn(['architecture', 'ddd'], doc.createNode(renameDeep(raw.architecture.ddd, target.rename)));
  return doc.toString({ lineWidth: 0 });
}

function renameDeep(x: unknown, map: RenameMap): unknown {
  if (typeof x === 'string') return x.includes('/') ? renameGlob(x, map) : x;
  if (Array.isArray(x)) return x.map((v) => renameDeep(v, map));
  if (x !== null && typeof x === 'object') return Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, v]) => [k, renameDeep(v, map)]));
  return x;
}

export function renamedExpectedLayers(ref: LoadedReference, target: IseTarget): { path: string; layer: string | null }[] {
  return ref.graph.files.map((f) => ({ path: renamePath(f.path, target.rename), layer: f.layer }));
}

export function renamedFindings(findings: readonly ExpectedFinding[], target: IseTarget): ExpectedFinding[] {
  return findings.map((f) => ({
    ...f,
    file: renameFindingPath(f.file, target.rename),
    ...(f.target !== undefined ? { target: renameFindingPath(f.target, target.rename) } : {}),
  }));
}
