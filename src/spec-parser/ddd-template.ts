import type { FitnessFunction, RuleTier } from '../shared/types/spec.js';
import type { BuiltInTemplate } from './types.js';
import { functionId } from '../shared/types/value-objects.js';

/**
 * `ddd` library (v1.3, FR-V4). Registered through `EXTENSION_TEMPLATES` rather than `TEMPLATE_REGISTRY`, which stays
 * the frozen v1.2E set of three styles. A rule set, not a full scoring preset: the eight DDD rules plus the hexagonal
 * graph layering composed inside each context. Every function carries its a-priori tier (Docs/v1.3-ddd-notes.md §2).
 * The rules need `architecture.ddd` declarations; `presets/ddd.yaml` declares the reference project's.
 */
function dddFn(
  id: string, name: string, dimension: FitnessFunction['dimension'], severity: FitnessFunction['severity'], tier: RuleTier,
  threshold?: number,
): FitnessFunction {
  return {
    id: functionId(id), name, dimension, severity, route: 'symbolic', isBuiltIn: true, validated: false, enabled: true, excludePaths: [], tier,
    ...(threshold != null ? { threshold } : {}),
  };
}

/** The framework packages a DDD domain must not import (FF-DT04); the layered list plus common ORMs, DI and DTO libraries. */
export const DDD_FORBIDDEN_IMPORTS: readonly string[] = [
  '@nestjs/*', 'typeorm', 'express', 'prisma', '@prisma/*', 'sequelize', 'mongoose', '@mikro-orm/*',
  'class-validator', 'class-transformer', 'inversify', 'tsyringe',
];

export const DDD_FUNCTIONS: readonly FitnessFunction[] = [
  // ── Strategic ──
  dddFn('FF-DS01', 'bounded-context-modules', 'structural', 'critical', 'blocking'),
  dddFn('FF-DS02', 'context-isolation', 'structural', 'critical', 'blocking'),
  // ── Tactical ──
  dddFn('FF-DT01', 'aggregate-boundary', 'structural', 'critical', 'blocking'),
  dddFn('FF-DT02', 'repository-aggregate-root', 'pattern', 'critical', 'blocking'),
  dddFn('FF-DT03', 'value-object-immutability', 'pattern', 'minor', 'advisory'),
  { ...dddFn('FF-DT04', 'domain-purity', 'pattern', 'critical', 'blocking'), forbiddenImports: DDD_FORBIDDEN_IMPORTS },
  dddFn('FF-DT05', 'domain-event-placement', 'pattern', 'critical', 'blocking'),
  dddFn('FF-DT06', 'application-service-thin', 'pattern', 'advisory', 'advisory', 3),
  // ── Layering inside each context (hexagonal templates) ──
  dddFn('FF-S01', 'dependency-direction-graph', 'structural', 'critical', 'blocking'),
  dddFn('FF-S03', 'layer-skip-graph', 'structural', 'critical', 'blocking'),
];

/** The ddd library; weights and thresholds from the layered one (passed in so this module does not import the registry). */
export function buildDddTemplate(layered: BuiltInTemplate): BuiltInTemplate {
  return {
    style: 'ddd',
    version: '1.0.0',
    functions: DDD_FUNCTIONS,
    defaultWeights: layered.defaultWeights,
    defaultFullModeWeights: layered.defaultFullModeWeights,
    defaultVerdictThresholds: layered.defaultVerdictThresholds,
    defaultConfidenceThresholds: layered.defaultConfidenceThresholds,
  };
}
