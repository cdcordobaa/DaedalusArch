/**
 * `explain_violation`: a rule's intent and fix guidance. The text is not written here: the detection text is the
 * Cypher template's `description`, and intent and fix are the report catalogue's (`formatActionableViolation`),
 * so an agent reads exactly what the frozen report would tell a developer. Pure.
 */
import type { ParsedSpec } from '../shared/types/spec.js';
import type { Violation, ViolationType } from '../shared/taxonomy/violation-types.js';
import { BUILT_IN_VIOLATION_TYPES } from '../shared/taxonomy/violation-types.js';
import { CYPHER_TEMPLATES } from '../fitness-compiler/cypher-templates.js';
import { resolveTemplate } from '../spec-parser/template-registry.js';
import { formatActionableViolation } from '../report/actionable-formatter.js';
import { functionId } from '../shared/types/value-objects.js';
import { allowedTransitions } from './spec-rules.js';
import { familyOf } from '../fix-hints/templates.js';
import { FIX_HINT_TEMPLATES } from '../fix-hints/catalogue.js';
import { ruleTier } from '../scoring-engine/rule-tiers.js';
import type { RuleExplanation } from './types.js';

/**
 * Template name to violation type (a restatement of the evaluator's private mapping; a test pins that every
 * template is covered and every value is a built-in type).
 */
export const RULE_VIOLATION_TYPES: Readonly<Record<string, ViolationType>> = Object.freeze({
  'dependency-direction': 'LAYER_VIOLATION',
  'no-cyclic-deps': 'CYCLIC_DEPENDENCY',
  'no-layer-skip': 'LAYER_SKIP',
  'no-domain-outward-dep': 'DOMAIN_OUTWARD_DEP',
  'domain-purity': 'DOMAIN_PURITY_VIOLATION',
  'domain-state-purity': 'DOMAIN_STATE_PURITY_VIOLATION',
  'dependency-inversion': 'DEPENDENCY_INVERSION_VIOLATION',
  'repository-pattern': 'REPOSITORY_PATTERN_VIOLATION',
  'use-case-isolation': 'USE_CASE_ISOLATION_VIOLATION',
  'controller-no-entity': 'CONTROLLER_ENTITY_VIOLATION',
  'domain-stability': 'INSTABILITY_VIOLATION',
  'module-fan-out': 'FAN_OUT_EXCEEDED',
  'max-fan-in': 'FAN_IN_EXCEEDED',
  'component-instability': 'INSTABILITY_VIOLATION',
  'no-orphan-files': 'ORPHAN_FILE',
  'abstraction-ratio': 'LOW_ABSTRACTION_RATIO',
  'single-responsibility-proxy': 'SRP_VIOLATION',
  'interface-segregation-proxy': 'ISP_VIOLATION',
  'inheritance-depth': 'INHERITANCE_DEPTH_EXCEEDED',
  'naming-conventions': 'NAMING_CONVENTION',
  'naming-services': 'NAMING_CONVENTION',
  'naming-repos': 'NAMING_CONVENTION',
  'naming-controllers': 'NAMING_CONVENTION',
  'test-file-pairing': 'MISSING_TEST_FILE',
  'no-index-logic': 'INDEX_LOGIC_VIOLATION',
  'architectural-integrity': 'INTEGRITY_VIOLATION',
  'intent-alignment': 'INTENT_VIOLATION',
});

interface RuleRef {
  readonly id: string | null;
  readonly name: string;
  readonly type: ViolationType;
}

/** Resolve a rule id (`FF-S01`), template name (`dependency-direction`) or violation type (`LAYER_VIOLATION`). */
function lookup(query: string, spec: ParsedSpec | undefined): RuleRef | undefined {
  const q = query.trim();
  const functions =
    spec?.fitnessFunctions ?? resolveTemplate('clean-architecture')?.functions ?? [];
  const byId = functions.find((f) => String(f.id).toLowerCase() === q.toLowerCase());
  const byName = functions.find((f) => f.name === q.toLowerCase());
  const ff = byId ?? byName;
  if (ff !== undefined) {
    return {
      id: String(ff.id),
      name: ff.name,
      type: RULE_VIOLATION_TYPES[ff.name] ?? (`CUSTOM_${ff.name}` as ViolationType),
    };
  }
  const upper = q.toUpperCase();
  const type = (BUILT_IN_VIOLATION_TYPES as readonly string[]).includes(upper)
    ? (upper as ViolationType)
    : undefined;
  if (type === undefined) return undefined;
  const name =
    Object.entries(RULE_VIOLATION_TYPES).find(([, t]) => t === type)?.[0] ?? type.toLowerCase();
  const matches = functions.filter((f) => RULE_VIOLATION_TYPES[f.name] === type);
  return { id: matches.length === 1 ? String(matches[0]?.id) : null, name, type };
}

function specContext(spec: ParsedSpec | undefined, ref: RuleRef): readonly string[] {
  const ff = spec?.fitnessFunctions.find((f) => f.name === ref.name);
  if (spec === undefined || ff === undefined) return [];
  const lines: string[] = [`severity ${ff.severity}, dimension ${ff.dimension}`];
  if (!ff.enabled)
    lines.push(
      `disabled in this spec${ff.disabledReason !== undefined ? `: ${ff.disabledReason}` : ''}`,
    );
  if (['dependency-direction', 'no-layer-skip', 'no-domain-outward-dep'].includes(ff.name)) {
    lines.push(
      `layer order (inner to outer): ${spec.layerModel.layers.map((l) => l.name).join(' < ')}`,
    );
  }
  if (ff.name === 'no-layer-skip')
    lines.push(`allowed transitions: ${allowedTransitions(spec).join(', ') || 'none'}`);
  if (ff.forbiddenImports !== undefined)
    lines.push(`forbidden imports: ${ff.forbiddenImports.join(', ')}`);
  if (ff.threshold !== undefined) lines.push(`threshold: ${String(ff.threshold)}`);
  if (ff.excludePaths.length > 0) lines.push(`excluded paths: ${ff.excludePaths.join(', ')}`);
  if (ff.semanticCriteria !== undefined)
    lines.push(`rubric fail condition: ${ff.semanticCriteria.rubric.fail}`);
  return lines;
}

export function explainViolation(
  query: string,
  spec?: ParsedSpec,
  options: { readonly hints?: boolean } = {},
): RuleExplanation | undefined {
  const ref = lookup(query, spec);
  if (ref === undefined) return undefined;
  const template = CYPHER_TEMPLATES.get(ref.name);
  const ff =
    spec?.fitnessFunctions.find((f) => f.name === ref.name) ??
    resolveTemplate('clean-architecture')?.functions.find((f) => f.name === ref.name);
  const detects = template?.description ?? ff?.semanticCriteria?.rule ?? ref.name;

  // The catalogue's intent (`why`) and fix, read through its public formatter on a minimal violation.
  const probe: Violation = {
    id: 'explain',
    type: ref.type,
    dimension: ff?.dimension ?? 'structural',
    severity: ff?.severity ?? 'major',
    functionId: functionId(ref.id ?? 'FF-EXPLAIN'),
    route: ff?.route ?? 'symbolic',
    filePath: '',
    message: detects,
    deterministic: true,
  };
  const actionable = formatActionableViolation(probe, ff !== undefined ? [ff] : []);

  return {
    ruleId: ref.id,
    ruleName: ref.name,
    violationType: ref.type,
    dimension: ff?.dimension ?? null,
    severity: ff?.severity ?? null,
    detects,
    intent: actionable.why,
    fix: actionable.fix,
    tag: template?.tag ?? 'semantic',
    requiredLayerKinds: template?.requiredLayerKinds ?? [],
    applicableStyles: template?.applicableStyles ?? null,
    specContext: specContext(spec, ref),
    ...(options.hints === true ? fixHintTemplate(spec, ref) : {}),
  };
}

/** With hints on: the rule's fix-hint family, its tier for the spec's style and the template's shape. */
function fixHintTemplate(
  spec: ParsedSpec | undefined,
  ref: RuleRef,
): { fixHint?: { family: string; blocking: boolean; template: string } } {
  const family = familyOf(ref.name);
  if (family === undefined || ref.id === null) return {};
  return {
    fixHint: {
      family,
      blocking: ruleTier(ref.id, spec?.style).tier === 'blocking',
      template: FIX_HINT_TEMPLATES[family],
    },
  };
}
