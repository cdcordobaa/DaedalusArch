/**
 * The spec's layer model as the fix hints read it: the layer of a path, whether one layer may import another, the
 * allowed-dependency rule of a layer in words, and a folder a layer's globs cover. Pure; reads only the ParsedSpec.
 *
 * "May import" is the conjunction of the spec's blocking layering rules for its style:
 * - styles with `architecture.allowed_dependencies` (hexagonal, ddd): `from -> to` is a declared edge;
 * - ordered styles (clean-architecture, nestjs, layered): the active import rules of the frozen catalogue
 *   (FF-S01 inward only, FF-S04 domain imports nothing else, FF-S03 adjacent steps only where it applies), through
 *   the same predicates the MCP spec checks use (`layerPairHits`).
 */
import * as path from 'node:path';
import picomatch from 'picomatch';
import type { LayerDefinition, ParsedSpec } from '../shared/types/spec.js';
import { bindLayerParams } from '../fitness-compiler/layer-binding.js';
import { normalisePath, resolveLayer } from '../mcp-server/layer-resolver.js';
import { layerPairHits } from '../mcp-server/spec-rules.js';

export type LayerRole = 'domain' | 'application' | 'infrastructure' | 'presentation' | 'composition' | 'unknown';

export class SpecModel {
  readonly style: string;
  readonly names: readonly string[];
  private readonly allowed: ReadonlySet<string> | undefined;

  constructor(readonly spec: ParsedSpec) {
    this.style = (spec.style ?? '').toLowerCase();
    this.names = spec.layerModel.layers.map((l) => l.name);
    const edges = spec.layerModel.allowedDependencies;
    this.allowed = edges !== undefined && edges.length > 0 ? new Set(edges.map((e) => `${e.from}>${e.to}`)) : undefined;
  }

  layerOf(file: string): string | null {
    return resolveLayer(this.spec, file)?.layer ?? null;
  }

  /** True when the file got its layer from a `file_patterns` entry (a feature-module project). */
  layeredByFilename(file: string): boolean {
    return resolveLayer(this.spec, file)?.matchedBy === 'filename';
  }

  def(layer: string): LayerDefinition | undefined {
    return this.spec.layerModel.layers.find((l) => l.name === layer);
  }

  /** The role a layer plays: its bound kind, or `composition` for a layer that may import every other one. */
  roleOf(layer: string | null): LayerRole {
    if (layer === null) return 'unknown';
    if (this.allowed !== undefined) {
      const others = this.names.filter((n) => n !== layer);
      const reached = [...this.allowed].some((e) => e.endsWith(`>${layer}`));
      if (!reached && others.length > 0 && others.every((o) => this.allowed?.has(`${layer}>${o}`))) return 'composition';
    }
    const b = bindLayerParams(this.spec.layerModel.layers);
    if (layer === b.domainLayer) return 'domain';
    if (b.applicationLayers.includes(layer)) return 'application';
    if (layer === b.infraLayer) return 'infrastructure';
    if (layer === b.presentationLayer) return 'presentation';
    return (this.def(layer)?.kind as LayerRole | undefined) ?? 'unknown';
  }

  /** The domain (core) layer, when the spec binds one. */
  domainLayer(): string | undefined {
    return bindLayerParams(this.spec.layerModel.layers).domainLayer;
  }

  /** May a file in `from` import a file in `to` under the spec's blocking layering rules? A file outside every layer is unconstrained. */
  mayImport(from: string | null, to: string | null): boolean {
    if (from === null || to === null || from === to) return true;
    if (this.allowed !== undefined) return this.allowed.has(`${from}>${to}`);
    return layerPairHits(this.spec, from, to).length === 0;
  }

  /** Layers `from` may import besides itself, in layer order. */
  importable(from: string): readonly string[] {
    return this.names.filter((n) => n !== from && this.mayImport(from, n));
  }

  /** The allowed-dependency rule of `from`, in words. */
  ruleText(from: string | null): string {
    if (from === null) return 'the file lies in no layer of the spec';
    const may = this.importable(from);
    const source = this.allowed !== undefined ? 'architecture.allowed_dependencies' : 'the layer order (inner to outer: ' + this.names.join(' < ') + ')';
    return `${from} may import only ${may.length === 0 ? 'itself' : `itself and ${may.join(', ')}`} (${source})`;
  }

  /**
   * A folder for new or moved code in `layer`, placed near `near` (the file the fix starts from): the layer's first
   * directory glob whose fixed prefix can be completed from `near` (a `*` segment takes `near`'s segment, so
   * `src/*\/domain/**` near `src/ordering/application/X.ts` is `src/ordering/domain/`). A feature-module project
   * (`near` layered by file name) keeps the file in `near`'s folder and names it by a `file_patterns` suffix.
   * Returns undefined when no glob or pattern yields a path the layer resolver puts in `layer`.
   */
  placement(layer: string, near: string, baseName: string): { readonly folder: string; readonly path: string } | undefined {
    const def = this.def(layer);
    if (def === undefined) return undefined;
    const nearPath = normalisePath(near);
    const nearBase = path.posix.basename(nearPath, '.ts');
    const kebab = /[-.]/.test(nearBase) || (/^[a-z]+$/.test(nearBase) && !['app', 'main', 'index', 'server'].includes(nearBase));
    const fileName = (suffix: string): string => (kebab ? `${toKebab(baseName)}${suffix}` : `${baseName}${suffix}`);
    const candidates: { folder: string; path: string }[] = [];
    const byPattern = (): void => {
      const dir = path.posix.dirname(nearPath);
      for (const pattern of def.filePatterns ?? []) {
        const m = /^\*\*\/\*(\.[A-Za-z0-9.-]+\.ts)$/.exec(pattern);
        if (m?.[1] !== undefined) candidates.push({ folder: `${dir}/`, path: `${dir}/${fileName(m[1])}` });
        const d = /^\*\*\/([A-Za-z0-9_-]+)\/\*\*$/.exec(pattern);
        if (d?.[1] !== undefined) candidates.push({ folder: `${dir}/${d[1]}/`, path: `${dir}/${d[1]}/${fileName('.ts')}` });
      }
    };
    // Same layer as the file the fix starts from: next to it.
    if (this.layerOf(nearPath) === layer) {
      const dir = path.posix.dirname(nearPath);
      candidates.push({ folder: `${dir}/`, path: `${dir}/${fileName('.ts')}` });
    }
    if (this.layeredByFilename(nearPath)) byPattern();
    for (const glob of def.directories) {
      const folder = globFolder(glob, nearPath);
      if (folder !== undefined) candidates.push({ folder, path: `${folder}${fileName('.ts')}` });
    }
    byPattern();
    return candidates.find((c) => this.layerOf(c.path) === layer);
  }

  /** True when `file` matches one of `globs` (picomatch, dot files included, as the layer annotator matches). */
  static matches(globs: readonly string[], file: string): boolean {
    return globs.some((g) => picomatch(g, { dot: true })(file));
  }
}

/** The fixed folder prefix of a directory glob, completed from `near`; undefined when it cannot be completed. */
export function globFolder(glob: string, near: string): string | undefined {
  const segs = glob.split('/');
  const nearSegs = near.split('/');
  const out: string[] = [];
  for (let i = 0; i < segs.length; i += 1) {
    const seg = segs[i] ?? '';
    const last = i === segs.length - 1;
    if (seg.includes('**')) break;
    if (seg === '*') {
      const n = nearSegs[i];
      if (n === undefined || i >= nearSegs.length - 1) return undefined;
      out.push(n);
      continue;
    }
    if (/[*?{[]/.test(seg)) break;
    if (last && seg.endsWith('.ts')) break; // a file glob: its folder is the prefix
    out.push(seg);
  }
  return out.length === 0 ? undefined : `${out.join('/')}/`;
}

export function toKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();
}

/** PascalCase name of a file: `in-memory-registration.repository.ts` -> `InMemoryRegistrationRepository`. */
export function nameOfFile(file: string): string {
  const base = path.posix.basename(file).replace(/\.tsx?$/, '');
  if (!/[-._]/.test(base)) return (base[0]?.toUpperCase() ?? '') + base.slice(1);
  return base
    .split(/[-._]/)
    .filter((p) => p.length > 0)
    .map((p) => (p[0]?.toUpperCase() ?? '') + p.slice(1))
    .join('');
}

const IMPL_PREFIXES = ['InMemory', 'Fake', 'Mock', 'Stub', 'System', 'Default', 'Sql', 'Typeorm', 'TypeOrm', 'Prisma', 'Mongo', 'Http', 'Rest', 'Console', 'Outbox', 'Local', 'Real', 'Concrete'];
const IMPL_SUFFIXES = ['Impl', 'Implementation', 'Adapter'];

/** The port name an implementation suggests: `SystemClock` -> `Clock`, `InMemoryLoanRepository` -> `LoanRepository`. */
export function portNameFor(implName: string): string {
  let name = implName;
  for (const s of IMPL_SUFFIXES) if (name.endsWith(s) && name.length > s.length) name = name.slice(0, -s.length);
  for (const p of IMPL_PREFIXES) {
    if (name.startsWith(p) && name.length > p.length && /[A-Z]/.test(name[p.length] ?? '')) {
      name = name.slice(p.length);
      break;
    }
  }
  return name === implName ? `${implName}Port` : name;
}

/** The noun of a data-shape or service name: `ProductRecord` -> `Product`, `ProductGateway` -> `Product`. */
export function stemOf(name: string): string {
  const m = /^(.+?)(Record|Row|Entity|Model|Dto|Data|Gateway|Repository|Repo|Dao|Service|Client|Store|Controller|View|Presenter|Handler|UseCase)$/.exec(name);
  return m?.[1] ?? name;
}

export const DATA_SHAPE = /(Record|Row|Entity|Model|Dto|Data|Types?)$/;
