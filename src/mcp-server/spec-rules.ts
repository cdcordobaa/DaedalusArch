/**
 * Spec-based rule evaluation for the MCP prototype: the import-edge rules of the frozen instrument
 * (FF-S01 dependency-direction, FF-S03 no-layer-skip, FF-S04 no-domain-outward-dep, FF-P01 domain-purity)
 * restated as pure predicates over a ParsedSpec. Layer order, allowed transitions, applicability and exclude
 * patterns come from the compiler's own helpers, so the answers track the Cypher templates; no graph is built.
 * Parity with the Cypher templates is the contract; the unit tests pin it on the fixtures.
 */
import type { FitnessFunction, ParsedSpec } from '../shared/types/spec.js';
import type { ViolationType } from '../shared/taxonomy/violation-types.js';
import { CYPHER_TEMPLATES } from '../fitness-compiler/cypher-templates.js';
import { bindLayerParams } from '../fitness-compiler/layer-binding.js';
import { isTemplateApplicable } from '../fitness-compiler/template-applicability.js';
import { globToRegex } from '../fitness-compiler/glob-to-regex.js';
import type { RuleHit, RuleStatus } from './types.js';

/** Template names `check_import` can evaluate from the spec alone (edges and package imports). */
export const IMPORT_RULE_NAMES: readonly string[] = Object.freeze([
  'dependency-direction',
  'no-layer-skip',
  'no-domain-outward-dep',
  'domain-purity',
]);

/** The violation type each import rule reports (mirrors the evaluator's name mapping, pinned by a test). */
export const IMPORT_RULE_TYPES: Readonly<Record<string, ViolationType>> = Object.freeze({
  'dependency-direction': 'LAYER_VIOLATION',
  'no-layer-skip': 'LAYER_SKIP',
  'no-domain-outward-dep': 'DOMAIN_OUTWARD_DEP',
  'domain-purity': 'DOMAIN_PURITY_VIOLATION',
});

export interface RuleState {
  readonly ff: FitnessFunction;
  readonly status: RuleStatus;
  readonly statusReason?: string;
}

/** Status of one function: spec-disabled, template-inapplicable (style, kind, layer count), or active. */
export function ruleState(spec: ParsedSpec, ff: FitnessFunction): RuleState {
  if (!ff.enabled) {
    return {
      ff,
      status: 'disabled',
      ...(ff.disabledReason !== undefined ? { statusReason: ff.disabledReason } : {}),
    };
  }
  if (ff.route === 'neuronal') return { ff, status: 'active' };
  const template = CYPHER_TEMPLATES.get(ff.name);
  if (template === undefined) return { ff, status: 'active' };
  const applicability = isTemplateApplicable(
    template,
    spec.style,
    bindLayerParams(spec.layerModel.layers),
    spec.layerModel,
  );
  return applicability.applicable
    ? { ff, status: 'active' }
    : { ff, status: 'not-applicable', statusReason: applicability.reason };
}

/** Active import rules of the spec, in declaration order. */
export function activeImportRules(spec: ParsedSpec): readonly FitnessFunction[] {
  return spec.fitnessFunctions.filter(
    (ff) => IMPORT_RULE_NAMES.includes(ff.name) && ruleState(spec, ff).status === 'active',
  );
}

/** True when the function's own `exclude_paths` exempt the importing file (same regexes as `$excludePatterns`). */
export function isExcluded(ff: FitnessFunction, filePath: string): boolean {
  return ff.excludePaths.some((glob) => new RegExp(globToRegex(glob)).test(filePath));
}

function layerNames(spec: ParsedSpec): readonly string[] {
  return spec.layerModel.layers.map((l) => l.name);
}

/** Layer-pair transitions `no-layer-skip` allows: `outer>inner` for adjacent layers (compiler's buildParams). */
export function allowedTransitions(spec: ParsedSpec): readonly string[] {
  const names = layerNames(spec);
  return names.slice(0, -1).map((inner, i) => `${String(names[i + 1])}>${inner}`);
}

function hit(ff: FitnessFunction, reason: string): RuleHit {
  return {
    ruleId: String(ff.id),
    ruleName: ff.name,
    severity: ff.severity,
    violationType: IMPORT_RULE_TYPES[ff.name] ?? (`CUSTOM_${ff.name}` as ViolationType),
    reason,
  };
}

/**
 * Rules a file in layer `src` breaks by importing a file in layer `tgt`. Files with no layer, and imports within
 * one layer, never violate (the templates require `src.layer <> tgt.layer`). `fromFile` applies `exclude_paths`.
 */
export function layerPairHits(
  spec: ParsedSpec,
  src: string,
  tgt: string,
  fromFile?: string,
): readonly RuleHit[] {
  if (src === tgt) return [];
  const names = layerNames(spec);
  const srcIdx = names.indexOf(src);
  const tgtIdx = names.indexOf(tgt);
  if (srcIdx < 0 || tgtIdx < 0) return [];
  const binding = bindLayerParams(spec.layerModel.layers);
  const hits: RuleHit[] = [];

  for (const ff of activeImportRules(spec)) {
    if (fromFile !== undefined && isExcluded(ff, fromFile)) continue;
    if (ff.name === 'dependency-direction' && srcIdx < tgtIdx) {
      hits.push(
        hit(
          ff,
          `${src} (position ${String(srcIdx)}) may not import ${tgt} (position ${String(tgtIdx)}): layers are ordered inner to outer and may only depend on themselves or inner layers`,
        ),
      );
    }
    if (ff.name === 'no-layer-skip' && !allowedTransitions(spec).includes(`${src}>${tgt}`)) {
      hits.push(
        hit(
          ff,
          `${src} may not import ${tgt}: closed layering allows only ${allowedTransitions(spec).join(', ') || 'no transitions'}`,
        ),
      );
    }
    if (ff.name === 'no-domain-outward-dep' && src === binding.domainLayer) {
      hits.push(
        hit(ff, `domain layer ${src} may not import ${tgt}: the domain depends on no other layer`),
      );
    }
  }
  return hits;
}

/** Layers a file in `src` may import (other than itself), in layer order. */
export function importableLayers(
  spec: ParsedSpec,
  src: string,
  fromFile?: string,
): { readonly may: readonly string[]; readonly mayNot: readonly string[] } {
  const others = layerNames(spec).filter((n) => n !== src);
  return {
    may: others.filter((tgt) => layerPairHits(spec, src, tgt, fromFile).length === 0),
    mayNot: others.filter((tgt) => layerPairHits(spec, src, tgt, fromFile).length > 0),
  };
}

/** `domain-purity` pattern match: exact package name, or `prefix/*` as a name prefix (the template's predicate). */
export function matchesForbiddenImport(packageName: string, pattern: string): boolean {
  return (
    packageName === pattern ||
    (pattern.endsWith('/*') && packageName.startsWith(pattern.slice(0, -1)))
  );
}

/** Forbidden package patterns in force for files of layer `layer` (domain layer only; empty otherwise). */
export function forbiddenPackagesFor(
  spec: ParsedSpec,
  layer: string | null,
  fromFile?: string,
): readonly string[] {
  if (layer === null || layer !== bindLayerParams(spec.layerModel.layers).domainLayer) return [];
  return activeImportRules(spec)
    .filter(
      (ff) => ff.name === 'domain-purity' && (fromFile === undefined || !isExcluded(ff, fromFile)),
    )
    .flatMap((ff) => ff.forbiddenImports ?? []);
}

/** Rules a file in layer `layer` breaks by importing the external package `packageName`. */
export function packageHits(
  spec: ParsedSpec,
  layer: string | null,
  packageName: string,
  fromFile?: string,
): readonly RuleHit[] {
  if (layer === null || layer !== bindLayerParams(spec.layerModel.layers).domainLayer) return [];
  return activeImportRules(spec)
    .filter(
      (ff) => ff.name === 'domain-purity' && (fromFile === undefined || !isExcluded(ff, fromFile)),
    )
    .flatMap((ff) => {
      const pattern = (ff.forbiddenImports ?? []).find((p) =>
        matchesForbiddenImport(packageName, p),
      );
      return pattern === undefined
        ? []
        : [
            hit(
              ff,
              `domain layer ${layer} may not import ${packageName}: it matches forbidden_imports entry "${pattern}"`,
            ),
          ];
    });
}
