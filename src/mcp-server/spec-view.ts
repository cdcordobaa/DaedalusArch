/**
 * Structured views of a ParsedSpec for `get_architecture_spec` and `which_layer`. Pure; descriptions come from
 * the Cypher template catalogue (`CYPHER_TEMPLATES`) or the function's own semantic criteria.
 */
import type { ParsedSpec } from '../shared/types/spec.js';
import { CYPHER_TEMPLATES } from '../fitness-compiler/cypher-templates.js';
import {
  IMPORT_RULE_NAMES,
  forbiddenPackagesFor,
  importableLayers,
  ruleState,
} from './spec-rules.js';
import { normalisePath, resolveLayer } from './layer-resolver.js';
import type { ArchitectureSpecView, LayerView, RuleView, WhichLayerResult } from './types.js';

function ruleViews(spec: ParsedSpec): readonly RuleView[] {
  return spec.fitnessFunctions.map((ff) => {
    const state = ruleState(spec, ff);
    const description =
      CYPHER_TEMPLATES.get(ff.name)?.description ?? ff.semanticCriteria?.rule ?? ff.name;
    return {
      id: String(ff.id),
      name: ff.name,
      dimension: ff.dimension,
      severity: ff.severity,
      route: ff.route,
      status: state.status,
      ...(state.statusReason !== undefined ? { statusReason: state.statusReason } : {}),
      description,
      excludePaths: ff.excludePaths,
      checkedByCheckImport: state.status === 'active' && IMPORT_RULE_NAMES.includes(ff.name),
    };
  });
}

function layerViews(spec: ParsedSpec): readonly LayerView[] {
  return spec.layerModel.layers.map((layer, index) => {
    const { may, mayNot } = importableLayers(spec, layer.name);
    return {
      name: layer.name,
      index,
      ...(layer.kind !== undefined ? { kind: layer.kind } : {}),
      globs: layer.directories,
      filePatterns: layer.filePatterns ?? [],
      roles: layer.role === '' ? [] : layer.role.split(', '),
      mayImport: may,
      mayNotImport: mayNot,
    };
  });
}

export function buildSpecView(
  spec: ParsedSpec,
  specPath: string,
  warnings: readonly string[] = [],
): ArchitectureSpecView {
  const layers = layerViews(spec);
  const domain = spec.layerModel.layers.find((l) => l.kind === 'domain')?.name ?? null;
  return {
    specPath,
    specVersion: spec.specVersion,
    style: spec.style ?? null,
    layerOrder: layers.map((l) => l.name),
    layers,
    forbiddenPackages: forbiddenPackagesFor(spec, domain),
    rules: ruleViews(spec),
    verdictThresholds: spec.verdictThresholds,
    warnings,
  };
}

export function whichLayer(spec: ParsedSpec, rawPath: string): WhichLayerResult {
  const filePath = normalisePath(rawPath);
  const match = resolveLayer(spec, filePath);
  if (match === undefined) {
    return {
      path: filePath,
      layer: null,
      matchedBy: null,
      matchedGlob: null,
      mayImport: [],
      mayNotImport: [],
      forbiddenPackages: [],
      note: 'no layer glob matches this path; layer rules do not apply to it',
    };
  }
  const { may, mayNot } = importableLayers(spec, match.layer, filePath);
  return {
    path: filePath,
    layer: match.layer,
    matchedBy: match.matchedBy,
    matchedGlob: match.glob,
    mayImport: may,
    mayNotImport: mayNot,
    forbiddenPackages: forbiddenPackagesFor(spec, match.layer, filePath),
  };
}
