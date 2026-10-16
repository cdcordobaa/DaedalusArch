/**
 * v1.3 correctness checker: what the spec says, read independently of the graph.
 *
 * The spec is parsed by the instrument's parser (it resolves the style template, the layer kinds and the function
 * fields), but every placement fact used by the checker is recomputed here from the spec's globs with picomatch:
 * a file's layer (directory globs first, then file-name patterns, first layer in spec order), its bounded context
 * (first context root the path starts with), and DDD role globs. Nothing reads the Neo4j graph or the extractor.
 */
import picomatch from 'picomatch';
import { parseSpec } from '../../../../src/spec-parser/spec-parser.js';
import type { DddModel, LayerDefinition, ParsedSpec } from '../../../../src/shared/types/spec.js';

export interface SpecView {
  readonly style: string;
  readonly layers: readonly LayerDefinition[];
  /** Layer names in spec order (`layerOrder` of dependency-direction, `allowedTransitions` of no-layer-skip). */
  readonly order: readonly string[];
  readonly domainLayer?: string;
  readonly infraLayer?: string;
  readonly presentationLayer?: string;
  readonly applicationLayers: readonly string[];
  /** `from>to` pairs (hexagonal, ddd). */
  readonly allowed: ReadonlySet<string>;
  /** Hexagonal composition roots: no allowed edge points to them, and they may import every other layer. */
  readonly compositionRoots: readonly string[];
  readonly ddd?: DddModel;
  /** Function fields by rule id (forbidden imports, name pattern). */
  readonly functions: ReadonlyMap<string, { readonly name: string; readonly forbiddenImports?: readonly string[]; readonly pattern?: string }>;
  layerOf(file: string): string | null;
}

const PM = { dot: true } as const;

export function globMatch(globs: readonly string[], file: string): boolean {
  return globs.length > 0 && picomatch(globs as string[], PM)(file);
}

/** A class-name pattern (`*Repository|*Repo`) as an anchored regex; `*` any run, `?` one character. */
export function namePatternRegex(pattern: string): RegExp {
  const alt = pattern.split('|').map((a) => a.replace(/[.+^${}()[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'));
  return new RegExp(`^(?:${alt.join('|')})$`);
}

export function specViewOf(spec: ParsedSpec): SpecView {
  const layers = spec.layerModel.layers;
  const first = (kind: string): string | undefined => layers.find((l) => l.kind === kind)?.name;
  const allowed = new Set((spec.layerModel.allowedDependencies ?? []).map((e) => `${e.from}>${e.to}`));
  const targets = new Set((spec.layerModel.allowedDependencies ?? []).map((e) => e.to));
  const compositionRoots = allowed.size === 0 ? [] : layers
    .filter((l) => !targets.has(l.name) && layers.every((o) => o.name === l.name || allowed.has(`${l.name}>${o.name}`)))
    .map((l) => l.name);
  const dirMatchers = layers.map((l) => ({ name: l.name, m: picomatch(l.directories as string[], PM) }));
  const fileMatchers = layers.map((l) => ({ name: l.name, m: (l.filePatterns ?? []).length > 0 ? picomatch(l.filePatterns as string[], PM) : null }));
  const domainLayer = first('domain');
  const infraLayer = first('infrastructure');
  const presentationLayer = first('presentation');
  return {
    style: spec.style ?? '',
    layers,
    order: layers.map((l) => l.name),
    ...(domainLayer !== undefined && { domainLayer }),
    ...(infraLayer !== undefined && { infraLayer }),
    ...(presentationLayer !== undefined && { presentationLayer }),
    applicationLayers: layers.filter((l) => l.kind === 'application').map((l) => l.name),
    allowed,
    compositionRoots,
    ...(spec.layerModel.ddd !== undefined && { ddd: spec.layerModel.ddd }),
    functions: new Map(spec.fitnessFunctions.map((f) => [String(f.id), {
      name: f.name,
      ...(f.forbiddenImports !== undefined && { forbiddenImports: f.forbiddenImports }),
      ...(f.pattern !== undefined && { pattern: f.pattern }),
    }])),
    layerOf(file: string): string | null {
      for (const d of dirMatchers) if (d.m(file)) return d.name;
      for (const f of fileMatchers) if (f.m?.(file) === true) return f.name;
      return null;
    },
  };
}

export async function loadSpecView(specPath: string): Promise<SpecView> {
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new Error(`${specPath}: ${parsed.errors.map((e) => e.message).join('; ')}`);
  return specViewOf(parsed.data);
}

/** Hexagonal use-case layers: application layers that are not composition roots. */
export function useCaseLayers(v: SpecView): string[] {
  return v.applicationLayers.filter((l) => !v.compositionRoots.includes(l));
}

/** DDD: the context whose root the file starts with (first declared), or null. */
export function contextOf(v: SpecView, file: string): string | null {
  return v.ddd?.contexts.find((c) => file.startsWith(c.root))?.name ?? null;
}

/** Is `file` named by a forbidden-import entry (`name` exact or `prefix/*`)? */
export function forbiddenMatch(forbidden: readonly string[], pkg: string): string | undefined {
  return forbidden.find((fp) => pkg === fp || (fp.endsWith('/*') && pkg.startsWith(fp.slice(0, -1))));
}
