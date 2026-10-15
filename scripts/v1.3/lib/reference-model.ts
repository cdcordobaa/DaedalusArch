/**
 * The v1.3 reference projects (FR-V3) as data: loading, schema validation and cross-checks.
 *
 * Two on-disk formats under `tests/fixtures/v1.3-reference/<style>/`, loaded into one model:
 *
 * Patch format (U-C2: clean-architecture, layered, nestjs, hexagonal):
 *   project/                      the clean variant (src/, types/, tsconfig.json, package.json)
 *   spec.yaml                     the firewall spec (a verbatim preset copy)
 *   reference.json                style definition, canonical source, compared rules
 *   expected-graph.json           hand-written layer map and internal import edges of the clean variant
 *   variants/<id>/variant.patch   one planted change against project/ (absent for `clean`)
 *   variants/<id>/expected-findings.json
 *
 * Overlay format (U-C1: ddd):
 *   clean/                        the clean variant (src/, tsconfig.json) plus clean/expected-findings.json
 *   expected-graph.json           layer and context of every clean file, key edges, edges that must be absent
 *   variants/<id>/variant.json    rule, plant description and a delete list
 *   variants/<id>/overlay/        files that replace or add files of clean/
 *   variants/<id>/expected-findings.json
 *   The spec is `presets/ddd.yaml` (named by every manifest); the compared rules are the preset's functions.
 *
 * The blocking set is the v1.3 rule tiers (`src/scoring-engine/rule-tiers.ts`, sealed Docs/v1.3/rule-tiers.md), not
 * the v1.2E severity: `ScopeRule.blockingCandidate` is recomputed from `ruleTier(ruleId, style)` at load time. The
 * `blockingCandidate` written in a reference.json (severity `critical`, before the tiers existed) is not used.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import YAML from 'yaml';
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import type { RuleTier } from '../../../src/scoring-engine/rule-tiers.js';

export const REFERENCE_ROOT = 'tests/fixtures/v1.3-reference';
/** Styles stored in the patch format (U-C2). */
export const PATCH_REFERENCE_STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal'] as const;
/** Styles stored in the overlay format (U-C1). */
export const OVERLAY_REFERENCE_STYLES = ['ddd'] as const;
export const REFERENCE_STYLES = [...PATCH_REFERENCE_STYLES, ...OVERLAY_REFERENCE_STYLES] as const;
export type ReferenceStyle = (typeof REFERENCE_STYLES)[number];
export type ReferenceFormat = 'patch' | 'overlay';

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
  /** After loading: the v1.3 tier is `blocking` (see the file comment). */
  readonly blockingCandidate: boolean;
  /** The v1.3 tier under the reference's style (set by the loader). */
  readonly tier?: RuleTier;
}

export interface ReferenceDescriptor {
  readonly schemaVersion: 1;
  readonly style: ReferenceStyle;
  /** `spec.yaml` (patch format) or the repository-relative preset (overlay format). */
  readonly spec: string;
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
  /** Patch format: every internal import edge. Overlay format: the key edges only. */
  readonly edges: readonly { from: string; to: string; kind: 'import' | 're-export' }[];
}

/** Overlay-format variant: copy `clean/`, delete `delete`, copy `dir` on top. */
export interface VariantOverlay {
  readonly dir: string;
  readonly delete: readonly string[];
}

export interface LoadedVariant {
  readonly manifest: VariantManifest;
  /** Absolute path of the patch, or null (the clean variant, or an overlay-format variant). */
  readonly patchPath: string | null;
  /** Overlay-format variants only (absent for `clean`). */
  readonly overlay?: VariantOverlay;
}

export interface LoadedReference {
  readonly style: ReferenceStyle;
  readonly format: ReferenceFormat;
  readonly dir: string;
  readonly projectDir: string;
  readonly specPath: string;
  readonly descriptor: ReferenceDescriptor;
  readonly graph: ExpectedGraph;
  readonly variants: readonly LoadedVariant[];
}

/** Schema directory, relative to the repository root (scripts run with the repository root as cwd). */
export const SCHEMA_DIR = 'scripts/v1.3/schemas';

interface Validators {
  findings: ValidateFunction;
  reference: ValidateFunction;
  graph: ValidateFunction;
  dddVariant: ValidateFunction;
  dddFindings: ValidateFunction;
  dddGraph: ValidateFunction;
}

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
      dddVariant: load('ddd-variant.schema.json'),
      dddFindings: load('ddd-expected-findings.schema.json'),
      dddGraph: load('ddd-expected-graph.schema.json'),
    };
    validatorCache.set(repoRoot, validators);
  }
  return validators;
}

function check(validate: ValidateFunction, value: unknown, label: string): unknown {
  if (!validate(value)) {
    const detail = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
    throw new Error(`${label}: schema violation: ${detail}`);
  }
  return value;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

export function validateVariantManifest(repoRoot: string, value: unknown, label = 'expected-findings.json'): VariantManifest {
  return check(getValidators(repoRoot).findings, value, label) as VariantManifest;
}

export function validateReferenceDescriptor(repoRoot: string, value: unknown, label = 'reference.json'): ReferenceDescriptor {
  return check(getValidators(repoRoot).reference, value, label) as ReferenceDescriptor;
}

export function validateExpectedGraph(repoRoot: string, value: unknown, label = 'expected-graph.json'): ExpectedGraph {
  return check(getValidators(repoRoot).graph, value, label) as ExpectedGraph;
}

/** The scope rules with `blockingCandidate` and `tier` taken from the v1.3 tiers under `style`. */
export function withTierBlocking(rules: readonly ScopeRule[], style: string): ScopeRule[] {
  return rules.map((r) => {
    const tier = ruleTier(r.ruleId, style).tier;
    return { ...r, tier, blockingCandidate: tier === 'blocking' };
  });
}

/**
 * Cross-file checks the schemas cannot express: the variant list matches the directories, every expected finding
 * names a compared rule, a violation's planted rule is among its findings, and graph edges name listed files.
 */
export function crossCheck(ref: LoadedReference): string[] {
  const problems: string[] = [];
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const dirs = fs.readdirSync(path.join(ref.dir, 'variants')).sort();
  // The overlay format keeps the clean variant in clean/, not under variants/.
  const listed = ref.descriptor.variants.filter((v) => ref.format === 'patch' || v !== 'clean');
  if (JSON.stringify(dirs) !== JSON.stringify([...listed].sort())) {
    problems.push(`${ref.style}: reference variants do not match the variants/ directories`);
  }
  if (!ref.variants.some((v) => v.manifest.kind === 'clean')) problems.push(`${ref.style}: no clean variant`);
  for (const { manifest: m, overlay } of ref.variants) {
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
    if (ref.format === 'overlay' && m.kind !== 'clean') {
      if (overlay === undefined) problems.push(`${ref.style}/${m.variant}: no overlay`);
      else {
        if (!fs.existsSync(overlay.dir) && overlay.delete.length === 0) problems.push(`${ref.style}/${m.variant}: overlay changes nothing`);
        for (const d of overlay.delete) {
          if (!fs.existsSync(path.join(ref.projectDir, d))) problems.push(`${ref.style}/${m.variant}: deletes ${d}, which clean/ does not have`);
        }
      }
    }
  }
  const files = new Set(ref.graph.files.map((f) => f.path));
  for (const e of ref.graph.edges) {
    if (!files.has(e.from) || !files.has(e.to)) problems.push(`${ref.style}: edge ${e.from} -> ${e.to} names an unlisted file`);
  }
  return problems;
}

function loadPatchReference(repoRoot: string, style: ReferenceStyle, dir: string): LoadedReference {
  const raw = validateReferenceDescriptor(repoRoot, readJson(path.join(dir, 'reference.json')), `${style}/reference.json`);
  const descriptor: ReferenceDescriptor = { ...raw, scopeRules: withTierBlocking(raw.scopeRules, style) };
  const graph = validateExpectedGraph(repoRoot, readJson(path.join(dir, 'expected-graph.json')), `${style}/expected-graph.json`);
  const variants = descriptor.variants.map((id): LoadedVariant => {
    const vdir = path.join(dir, 'variants', id);
    const manifest = validateVariantManifest(repoRoot, readJson(path.join(vdir, 'expected-findings.json')), `${style}/${id}/expected-findings.json`);
    if (manifest.variant !== id) throw new Error(`${style}/${id}: manifest names variant ${manifest.variant}`);
    return { manifest, patchPath: manifest.patch === null ? null : path.join(vdir, manifest.patch) };
  });
  return { style, format: 'patch', dir, projectDir: path.join(dir, 'project'), specPath: path.join(dir, descriptor.spec), descriptor, graph, variants };
}

interface DddVariantJson { readonly id: string; readonly rule: string | null; readonly plants: string; readonly delete: readonly string[] }
interface DddFinding { readonly rule: string; readonly name: string; readonly file: string; readonly target?: string; readonly class?: string; readonly reason: string }
interface DddFindingsJson { readonly variant: string; readonly spec: string; readonly findings: readonly DddFinding[] }
interface DddGraphJson {
  readonly note: string;
  readonly spec: string;
  readonly files: Readonly<Record<string, { layer: string | null }>>;
  readonly keyEdges: readonly { from: string; to: string; kind?: 'RE_EXPORTS' }[];
}

const SEVERITIES = new Set(['critical', 'major', 'minor', 'advisory']);

/** The overlay format (U-C1) read into the common model. Nothing on disk is rewritten. */
function loadOverlayReference(repoRoot: string, style: ReferenceStyle, dir: string): LoadedReference {
  const v = getValidators(repoRoot);
  const graphJson = check(v.dddGraph, readJson(path.join(dir, 'expected-graph.json')), `${style}/expected-graph.json`) as DddGraphJson;
  const specRel = graphJson.spec;
  const specPath = path.resolve(repoRoot, specRel);
  const preset = YAML.parse(fs.readFileSync(specPath, 'utf8')) as {
    architecture?: { style?: string };
    fitness_functions?: { id: string; name: string; severity: string }[];
  };
  if (preset.architecture?.style !== style) throw new Error(`${style}: ${specRel} declares style ${String(preset.architecture?.style)}`);
  const scope: ScopeRule[] = (preset.fitness_functions ?? []).map((f) => {
    if (!SEVERITIES.has(f.severity)) throw new Error(`${style}: ${specRel} ${f.id} has severity ${f.severity}`);
    return { ruleId: f.id, ruleName: f.name, severity: f.severity as ScopeRule['severity'], blockingCandidate: false };
  });

  const toFinding = (f: DddFinding): ExpectedFinding => ({
    ruleId: f.rule, ruleName: f.name, file: f.file, reason: f.reason, ...(f.target !== undefined ? { target: f.target } : {}),
  });
  const readFindings = (file: string, id: string): DddFindingsJson => {
    const m = check(v.dddFindings, readJson(file), `${style}/${id}/expected-findings.json`) as DddFindingsJson;
    if (m.variant !== id) throw new Error(`${style}/${id}: manifest names variant ${m.variant}`);
    if (m.spec !== specRel) throw new Error(`${style}/${id}: manifest names spec ${m.spec}, expected-graph.json ${specRel}`);
    return m;
  };

  const projectDir = path.join(dir, 'clean');
  const clean = readFindings(path.join(projectDir, 'expected-findings.json'), 'clean');
  const variants: LoadedVariant[] = [{
    manifest: {
      schemaVersion: 1, style, variant: 'clean', kind: 'clean', plants: null,
      description: 'The clean DDD reference project (clean/).', patch: null, expectedFindings: clean.findings.map(toFinding),
    },
    patchPath: null,
  }];
  for (const id of fs.readdirSync(path.join(dir, 'variants')).sort()) {
    const vdir = path.join(dir, 'variants', id);
    const meta = check(v.dddVariant, readJson(path.join(vdir, 'variant.json')), `${style}/${id}/variant.json`) as DddVariantJson;
    if (meta.id !== id) throw new Error(`${style}/${id}: variant.json names variant ${meta.id}`);
    const findings = readFindings(path.join(vdir, 'expected-findings.json'), id);
    variants.push({
      manifest: {
        schemaVersion: 1, style, variant: id, kind: meta.rule === null ? 'near-miss' : 'violation', plants: meta.rule,
        description: meta.plants, patch: null, expectedFindings: findings.findings.map(toFinding),
      },
      patchPath: null,
      overlay: { dir: path.join(vdir, 'overlay'), delete: meta.delete },
    });
  }

  const descriptor: ReferenceDescriptor = {
    schemaVersion: 1,
    style,
    spec: specRel,
    project: 'DDD reference project: ordering and billing bounded contexts, shared kernel, composition root (README.md).',
    canonicalSource: 'Evans 2003; Vernon 2013 (Docs/v1.3-ddd-notes.md §1).',
    styleDefinition: ['Docs/v1.3-ddd-notes.md §1 (rules defined from the literature before any template existed)'],
    authored: '2026-10-14',
    writtenBeforeToolRun: true,
    scopeRules: withTierBlocking(scope, style),
    notApplicable: [],
    noViolatingVariant: [],
    outOfScope: `Every function of ${specRel} is compared; nothing else is in the spec.`,
    variants: variants.map((x) => x.manifest.variant),
  };
  const graph: ExpectedGraph = {
    schemaVersion: 1,
    style,
    variant: 'clean',
    note: `${graphJson.note} (Overlay format: edges are the key edges only.)`,
    files: Object.entries(graphJson.files).map(([p, f]) => ({ path: p, layer: f.layer })),
    edges: graphJson.keyEdges.map((e) => ({ from: e.from, to: e.to, kind: e.kind === 'RE_EXPORTS' ? 're-export' : 'import' })),
  };
  return { style, format: 'overlay', dir, projectDir, specPath, descriptor, graph, variants };
}

/** Loads and schema-validates one style's reference project. */
export function loadReference(repoRoot: string, style: ReferenceStyle, root: string = REFERENCE_ROOT): LoadedReference {
  const dir = path.resolve(repoRoot, root, style);
  return (OVERLAY_REFERENCE_STYLES as readonly string[]).includes(style)
    ? loadOverlayReference(repoRoot, style, dir)
    : loadPatchReference(repoRoot, style, dir);
}

export function loadAllReferences(repoRoot: string, styles: readonly ReferenceStyle[] = REFERENCE_STYLES, root: string = REFERENCE_ROOT): LoadedReference[] {
  return styles.map((s) => loadReference(repoRoot, s, root));
}

export function isReferenceStyle(value: string): value is ReferenceStyle {
  return (REFERENCE_STYLES as readonly string[]).includes(value);
}
