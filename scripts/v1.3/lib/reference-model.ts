/**
 * The v1.3 reference projects (FR-V3) as data: loading, schema validation and cross-checks.
 *
 * Layout under `tests/fixtures/v1.3-reference/<style>/`:
 *   project/                      the clean variant (src/, types/, tsconfig.json, package.json)
 *   spec.yaml                     the firewall spec (a verbatim preset copy)
 *   reference.json                style definition, canonical source, compared rules
 *   expected-graph.json           hand-written layer map and internal import edges of the clean variant
 *   variants/<id>/variant.patch   one planted change against project/ (absent for `clean`)
 *   variants/<id>/expected-findings.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';

export const REFERENCE_ROOT = 'tests/fixtures/v1.3-reference';
export const REFERENCE_STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal'] as const;
export type ReferenceStyle = (typeof REFERENCE_STYLES)[number];

export type VariantKind = 'clean' | 'violation' | 'near-miss';

export interface ExpectedFinding {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly file: string;
  readonly target?: string;
  readonly reason: string;
}

export interface VariantManifest {
  readonly schemaVersion: 1;
  readonly style: ReferenceStyle;
  readonly variant: string;
  readonly kind: VariantKind;
  readonly plants: string | null;
  readonly description: string;
  readonly patch: string | null;
  readonly expectedFindings: readonly ExpectedFinding[];
}

export interface ScopeRule {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: 'critical' | 'major' | 'minor' | 'advisory';
  readonly blockingCandidate: boolean;
}

export interface ReferenceDescriptor {
  readonly schemaVersion: 1;
  readonly style: ReferenceStyle;
  readonly spec: 'spec.yaml';
  readonly project: string;
  readonly canonicalSource: string;
  readonly styleDefinition: readonly string[];
  readonly authored: string;
  readonly writtenBeforeToolRun: true;
  readonly scopeRules: readonly ScopeRule[];
  readonly notApplicable: readonly { ruleId: string; reason: string }[];
  readonly noViolatingVariant: readonly { ruleId: string; reason: string }[];
  readonly outOfScope: string;
  readonly variants: readonly string[];
}

export interface ExpectedGraph {
  readonly schemaVersion: 1;
  readonly style: ReferenceStyle;
  readonly variant: 'clean';
  readonly note: string;
  readonly files: readonly { path: string; layer: string | null }[];
  readonly edges: readonly { from: string; to: string; kind: 'import' | 're-export' }[];
}

export interface LoadedVariant {
  readonly manifest: VariantManifest;
  /** Absolute path of the patch, or null for the clean variant. */
  readonly patchPath: string | null;
}

export interface LoadedReference {
  readonly style: ReferenceStyle;
  readonly dir: string;
  readonly projectDir: string;
  readonly specPath: string;
  readonly descriptor: ReferenceDescriptor;
  readonly graph: ExpectedGraph;
  readonly variants: readonly LoadedVariant[];
}

/** Schema directory, relative to the repository root (scripts run with the repository root as cwd). */
export const SCHEMA_DIR = 'scripts/v1.3/schemas';

interface Validators { findings: ValidateFunction; reference: ValidateFunction; graph: ValidateFunction }

const validatorCache = new Map<string, Validators>();

function getValidators(repoRoot: string): Validators {
  let validators = validatorCache.get(repoRoot);
  if (validators === undefined) {
    const ajv = new Ajv({ strict: false, allErrors: true });
    const load = (f: string): ValidateFunction => ajv.compile(JSON.parse(fs.readFileSync(path.resolve(repoRoot, SCHEMA_DIR, f), 'utf8')) as object);
    validators = {
      findings: load('expected-findings.schema.json'),
      reference: load('reference.schema.json'),
      graph: load('expected-graph.schema.json'),
    };
    validatorCache.set(repoRoot, validators);
  }
  return validators;
}

function check<T>(validate: ValidateFunction, value: unknown, label: string): T {
  if (!validate(value)) {
    const detail = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
    throw new Error(`${label}: schema violation: ${detail}`);
  }
  return value as T;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

export function validateVariantManifest(repoRoot: string, value: unknown, label = 'expected-findings.json'): VariantManifest {
  return check<VariantManifest>(getValidators(repoRoot).findings, value, label);
}

export function validateReferenceDescriptor(repoRoot: string, value: unknown, label = 'reference.json'): ReferenceDescriptor {
  return check<ReferenceDescriptor>(getValidators(repoRoot).reference, value, label);
}

export function validateExpectedGraph(repoRoot: string, value: unknown, label = 'expected-graph.json'): ExpectedGraph {
  return check<ExpectedGraph>(getValidators(repoRoot).graph, value, label);
}

/**
 * Cross-file checks the schemas cannot express: the variant list matches the directories, every expected finding
 * names a compared rule, a violation's planted rule is among its findings, and graph edges name listed files.
 */
export function crossCheck(ref: LoadedReference): string[] {
  const problems: string[] = [];
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const dirs = fs.readdirSync(path.join(ref.dir, 'variants')).sort();
  if (JSON.stringify(dirs) !== JSON.stringify([...ref.descriptor.variants].sort())) {
    problems.push(`${ref.style}: reference.json variants do not match the variants/ directories`);
  }
  if (!ref.variants.some((v) => v.manifest.kind === 'clean')) problems.push(`${ref.style}: no clean variant`);
  for (const { manifest: m } of ref.variants) {
    if (m.style !== ref.style) problems.push(`${ref.style}/${m.variant}: style is ${m.style}`);
    for (const f of m.expectedFindings) {
      if (!scope.has(f.ruleId)) problems.push(`${ref.style}/${m.variant}: ${f.ruleId} is not a compared rule`);
      const scoped = ref.descriptor.scopeRules.find((r) => r.ruleId === f.ruleId);
      if (scoped !== undefined && scoped.ruleName !== f.ruleName) problems.push(`${ref.style}/${m.variant}: ${f.ruleId} is ${scoped.ruleName}, not ${f.ruleName}`);
    }
    if (m.kind === 'violation' && !m.expectedFindings.some((f) => f.ruleId === m.plants)) {
      problems.push(`${ref.style}/${m.variant}: planted rule ${String(m.plants)} has no expected finding`);
    }
    if (m.kind !== 'violation' && m.expectedFindings.length > 0) {
      problems.push(`${ref.style}/${m.variant}: a ${m.kind} variant expects findings (justify them in reference.json first)`);
    }
  }
  const files = new Set(ref.graph.files.map((f) => f.path));
  for (const e of ref.graph.edges) {
    if (!files.has(e.from) || !files.has(e.to)) problems.push(`${ref.style}: edge ${e.from} -> ${e.to} names an unlisted file`);
  }
  return problems;
}

/** Loads and schema-validates one style's reference project. */
export function loadReference(repoRoot: string, style: ReferenceStyle, root: string = REFERENCE_ROOT): LoadedReference {
  const dir = path.resolve(repoRoot, root, style);
  const descriptor = validateReferenceDescriptor(repoRoot, readJson(path.join(dir, 'reference.json')), `${style}/reference.json`);
  const graph = validateExpectedGraph(repoRoot, readJson(path.join(dir, 'expected-graph.json')), `${style}/expected-graph.json`);
  const variants = descriptor.variants.map((id): LoadedVariant => {
    const vdir = path.join(dir, 'variants', id);
    const manifest = validateVariantManifest(repoRoot, readJson(path.join(vdir, 'expected-findings.json')), `${style}/${id}/expected-findings.json`);
    if (manifest.variant !== id) throw new Error(`${style}/${id}: manifest names variant ${manifest.variant}`);
    return { manifest, patchPath: manifest.patch === null ? null : path.join(vdir, manifest.patch) };
  });
  return { style, dir, projectDir: path.join(dir, 'project'), specPath: path.join(dir, descriptor.spec), descriptor, graph, variants };
}

export function loadAllReferences(repoRoot: string, styles: readonly ReferenceStyle[] = REFERENCE_STYLES, root: string = REFERENCE_ROOT): LoadedReference[] {
  return styles.map((s) => loadReference(repoRoot, s, root));
}

export function isReferenceStyle(value: string): value is ReferenceStyle {
  return (REFERENCE_STYLES as readonly string[]).includes(value);
}
