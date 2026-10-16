/**
 * The `ProjectView` the advisory post-filters read, built from a project directory and its parsed spec. Shared by the
 * pipeline (`AssembleReportCommand`) and the offline measurement (`scripts/v1.3/advisory-noise.ts`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { annotateNodes } from '../neo4j-ingestion/layer-annotator.js';
import { ruleTier } from '../scoring-engine/rule-tiers.js';
import type { APGNode } from '../shared/types/apg.js';
import type { FitnessFunction, LayerModel } from '../shared/types/spec.js';
import type { LayerInfo, ProjectView } from './advisory-filter.js';

/** File-to-layer lookup with the instrument's own annotator (directory globs, then file-name patterns). */
export function layerLookup(model: LayerModel): (file: string) => LayerInfo | undefined {
  const cache = new Map<string, LayerInfo | null>();
  return (file) => {
    if (!cache.has(file)) {
      const node: APGNode = { id: file, type: 'File', filePath: file, name: path.posix.basename(file), decorators: [], properties: {} };
      const name = annotateNodes([node], model).annotations.get(file)?.layer ?? null;
      const def = name !== null ? model.layers.find((l) => l.name === name) : undefined;
      cache.set(file, def === undefined ? null : { name: def.name, role: def.role, ...(def.kind !== undefined ? { kind: def.kind } : {}) });
    }
    return cache.get(file) ?? undefined;
  };
}

const PARAM_FIELDS = ['threshold', 'maxPublicMethods', 'maxDependencies', 'maxInterfaceMethods'] as const;

/** Rule parameters from the spec's fitness functions (by id; the first function of an id wins). */
export function specParams(functions: readonly FitnessFunction[]): (functionId: string, name: string) => number | undefined {
  return (functionId, name) => {
    const ff = functions.find((f) => f.id === functionId);
    if (ff === undefined || !(PARAM_FIELDS as readonly string[]).includes(name)) return undefined;
    const v = (ff as unknown as Record<string, unknown>)[name];
    return typeof v === 'number' ? v : undefined;
  };
}

/** package.json `main` and `bin` entries, mapped from a build directory to `src/` when the built path does not exist. */
export function packageEntryPoints(projectDir: string): string[] {
  const file = path.join(projectDir, 'package.json');
  if (!fs.existsSync(file)) return [];
  let pkg: { main?: unknown; bin?: unknown };
  try {
    pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as { main?: unknown; bin?: unknown };
  } catch {
    return [];
  }
  const raw: string[] = [];
  if (typeof pkg.main === 'string') raw.push(pkg.main);
  if (typeof pkg.bin === 'string') raw.push(pkg.bin);
  if (pkg.bin !== null && typeof pkg.bin === 'object') for (const v of Object.values(pkg.bin)) if (typeof v === 'string') raw.push(v);
  const out = new Set<string>();
  for (const r of raw) {
    const rel = path.posix.normalize(r.replace(/^\.\//, ''));
    const src = rel.replace(/^(?:dist|build|lib|out)\//, 'src/').replace(/\.(?:js|mjs|cjs)$/, '.ts');
    out.add(src);
  }
  return [...out].sort();
}

/** Count `.ts` / `.tsx` source files under `dir`, skipping node_modules, dist and dot-directories. */
export function countSourceFiles(dir: string): number {
  let n = 0;
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(?:ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) n += 1;
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return n;
}

export interface FsProjectViewInput {
  readonly projectDir: string;
  readonly layerModel: LayerModel;
  readonly functions: readonly FitnessFunction[];
  /** Source file count; counted from `projectDir` when absent. */
  readonly fileCount?: number;
}

/** A view over a project directory: reads stay inside `projectDir`. */
export function fsProjectView(input: FsProjectViewInput): ProjectView {
  const root = path.resolve(input.projectDir);
  const texts = new Map<string, string | null>();
  return {
    readSource(file: string): string | undefined {
      if (!texts.has(file)) {
        const abs = path.resolve(root, file);
        const inside = abs.startsWith(root + path.sep);
        texts.set(file, inside && fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : null);
      }
      return texts.get(file) ?? undefined;
    },
    layerOf: layerLookup(input.layerModel),
    fileCount: input.fileCount ?? countSourceFiles(root),
    param: specParams(input.functions),
    entryPoints: packageEntryPoints(root),
  };
}

/**
 * The row tier the filter must respect: advisory only when the sealed table says so for the style AND (when the report
 * carries v1.3 tiers) the report does not list the rule as blocking. Any doubt keeps the row.
 */
export function advisoryTierOf(style: string | undefined, blockingRuleIds: ReadonlySet<string> | undefined): (f: { functionId: string }) => 'blocking' | 'advisory' {
  return (f) => {
    if (blockingRuleIds?.has(f.functionId) === true) return 'blocking';
    return ruleTier(f.functionId, style).tier;
  };
}
