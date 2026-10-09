/**
 * Expected resolution from the compiled spec (FR-v1.2E-24; BR-U5a-14, 19, 20, 21, 22; D-U5a-14; U1 code plan
 * Step 5).
 *
 * - The spec is read with C3 `parseSpec` and compiled exactly as `compileFunctions(compilerInputFromSpec(spec))`
 *   (the only `CompilerInput` builder; it carries `style`, so C5 style and layer-kind applicability apply; no
 *   database). `CompiledSpec` keeps, per template name, the enabled functions (id, dimension, compiled
 *   `threshold`, compiled params), the disabled functions with their C5 reason, and the declared template set.
 * - `resolveTemplates` maps an operator's templates to `functionIds`, `disabledFunctionIds` and
 *   `absentTemplates` (a template the spec does not declare). No function id is hard-coded anywhere.
 * - `resolveKey` turns a location rule into an `ExpectedKey` (U3 encoding, `lineRule` always present, `line` iff
 *   the rule is not `none`).
 * - `expectedBlock` assembles the positive or negative block: keys, operator collateral (keyed like the keys,
 *   BR-U5a-14), the site collateral computed by `collateral.ts`, dimension (the first expected function's, else
 *   the operator's catalogue dimension), coverage, judge probe and FLOWS_TO edges.
 * - Spec wiring for the import graph and metrics: `layers` (the spec's layer directories) and `domainLayer` (the
 *   C4 kind binding), and U1's `MAX_CYCLE_LENGTH` / `CYCLE_ROW_CAP` through `cycles.ts`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { parseSpec } from '../../../src/spec-parser/index.js';
import { compileFunctions, compilerInputFromSpec } from '../../../src/fitness-compiler/index.js';
import { bindLayerParams } from '../../../src/fitness-compiler/layer-binding.js';
import type { LayerKindBinding } from '../../../src/fitness-compiler/types.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import { CYCLE_ROW_CAP, MAX_CYCLE_LENGTH } from './cycles.js';
import type { CompiledFunctionRef, CollateralContext } from './collateral.js';
import type { LayerDirs } from './import-graph.js';
import { METRIC_DEFAULT_THRESHOLDS, isMetricTemplate } from './metrics.js';
import type {
  CycleStrategy,
  Dimension,
  ExpectedBlock,
  ExpectedKey,
  LocationRule,
  MutationEdit,
  MutationOperator,
  MutationSite,
  ParsedSpec,
  SiteCollateral,
} from './types.js';

export interface CompiledFunctionInfo {
  readonly functionId: string;
  readonly template: string;
  readonly dimension: Dimension;
  /** Compiled `threshold` (spec value or the style template's default); absent when none. */
  readonly threshold?: number;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface CompiledSpec {
  /** As given (repository-relative for fixtures). */
  readonly specPath: string;
  /** sha256 hex of the spec file bytes. */
  readonly specSha256: string;
  readonly spec: ParsedSpec;
  readonly binding: LayerKindBinding;
  readonly layers: readonly LayerDirs[];
  readonly domainLayer: string | null;
  /** Enabled (compiled, applicable) template functions by template name, declaration order. */
  readonly enabled: ReadonlyMap<string, readonly CompiledFunctionInfo[]>;
  /** Disabled functions by template name, with the C5 (or spec) reason. */
  readonly disabled: ReadonlyMap<string, readonly { readonly functionId: string; readonly reason: string }[]>;
  /** Template names the spec declares (enabled or not). */
  readonly declared: ReadonlySet<string>;
}

function fail<T>(code: string, message: string, context?: Record<string, unknown>): DomainResult<T> {
  return DomainResult.fail([{ code, message, ...(context !== undefined ? { context } : {}) }]);
}

function push<V>(m: Map<string, V[]>, k: string, v: V): void {
  const list = m.get(k);
  if (list === undefined) m.set(k, [v]);
  else list.push(v);
}

/** Layer directories of the spec, in spec order (input of `buildImportGraph`). */
export function layerDirsOf(spec: ParsedSpec): LayerDirs[] {
  return spec.layerModel.layers.map((l) => ({
    name: l.name,
    directories: [...l.directories],
    ...(l.filePatterns !== undefined ? { filePatterns: [...l.filePatterns] } : {}),
  }));
}

/** Builds the `CompiledSpec` of an already parsed spec (compile errors are fatal: `MUT_SPEC_COMPILE`). */
export function compileSpec(spec: ParsedSpec, specPath: string, specSha256: string): DomainResult<CompiledSpec> {
  const compiled = compileFunctions(compilerInputFromSpec(spec));
  if (!compiled.success) {
    return fail('MUT_SPEC_COMPILE', `spec ${specPath} does not compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
  }
  const templateOf = new Map<string, string>();
  for (const ff of spec.fitnessFunctions) templateOf.set(String(ff.id), ff.name);
  const symbolic: CypherQuery[] = [
    ...compiled.data.symbolicQueries,
    ...compiled.data.hybridPairs.map((p) => p.symbolicQuery),
  ].filter((q) => q.source === 'template');
  const enabled = new Map<string, CompiledFunctionInfo[]>();
  for (const q of symbolic) {
    push(enabled, q.name, {
      functionId: String(q.functionId),
      template: q.name,
      dimension: q.dimension,
      ...(q.threshold !== undefined ? { threshold: q.threshold } : {}),
      params: q.params,
    });
  }
  const disabled = new Map<string, { functionId: string; reason: string }[]>();
  for (const d of compiled.data.disabledFunctions) {
    push(disabled, d.name, { functionId: String(d.id), reason: d.reason ?? 'disabled in the spec' });
  }
  const binding = bindLayerParams(spec.layerModel.layers);
  return DomainResult.ok({
    specPath,
    specSha256,
    spec,
    binding,
    layers: layerDirsOf(spec),
    domainLayer: binding.domainLayer ?? null,
    enabled,
    disabled,
    declared: new Set(spec.fitnessFunctions.map((f) => f.name)),
  });
}

/** Reads, parses and compiles the spec at `specPath` (resolved against `repoRoot`, D-U5a-13). */
export async function loadCompiledSpec(repoRoot: string, specPath: string): Promise<DomainResult<CompiledSpec>> {
  const abs = path.resolve(repoRoot, specPath);
  if (!fs.existsSync(abs)) return fail('MUT_SPEC_NOT_FOUND', `spec ${specPath} not found`);
  const bytes = fs.readFileSync(abs);
  const parsed = await parseSpec({ specFilePath: abs });
  if (!parsed.success) {
    return fail('MUT_SPEC_PARSE', `spec ${specPath} does not parse: ${parsed.errors.map((e) => e.message).join('; ')}`);
  }
  return compileSpec(parsed.data, specPath, createHash('sha256').update(bytes).digest('hex'));
}

export interface TemplateResolution {
  readonly functionIds: readonly string[];
  readonly disabledFunctionIds: readonly { readonly functionId: string; readonly reason: string }[];
  readonly absentTemplates: readonly string[];
  /** Dimension of the first expected function; undefined when none is enabled. */
  readonly dimension?: Dimension;
}

/** BR-U5a-19: templates → enabled function ids, disabled ids with reason, absent templates. */
export function resolveTemplates(compiled: CompiledSpec, templates: readonly string[]): TemplateResolution {
  const functionIds: string[] = [];
  const disabledFunctionIds: { functionId: string; reason: string }[] = [];
  const absentTemplates: string[] = [];
  let dimension: Dimension | undefined;
  for (const t of [...new Set(templates)]) {
    if (!compiled.declared.has(t)) {
      absentTemplates.push(t);
      continue;
    }
    for (const f of compiled.enabled.get(t) ?? []) {
      functionIds.push(f.functionId);
      dimension ??= f.dimension;
    }
    for (const d of compiled.disabled.get(t) ?? []) disabledFunctionIds.push(d);
  }
  return { functionIds, disabledFunctionIds, absentTemplates, ...(dimension !== undefined ? { dimension } : {}) };
}

/**
 * Expectation style guard (ADR-025; operator definitions unchanged). Under these styles the operator's edit is not a
 * violation of the listed expected templates, so their functions are expected as disabled, not as detectors, and
 * their keys are dropped. `layered`: MO-S01's domain-kind file importing an infrastructure-kind file is the
 * business → persistence step the layered preset allows (`dependency-direction` flags only lower → higher), so FF-S01
 * cannot fire on it. Like MO-S03's style rule, the guard acts on the expectation; when it leaves no applicable
 * function the scorer treats the seed as not applicable (MAT-13 a).
 */
export const STYLE_GUARDED_EXPECTED: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  layered: { 'MO-S01': ['dependency-direction'] },
};

export const STYLE_GUARD_REASON = (style: string): string => `expected key not applicable to style ${style}: the spec allows the edge (ADR-025)`;

/** Applies `STYLE_GUARDED_EXPECTED` to a resolved positive: guarded functions move to `disabledFunctionIds`, their keys go. */
export function applyStyleGuard<K extends { readonly functionId: string }>(
  operatorId: string,
  style: string,
  guardedFunctionIds: readonly string[],
  block: { readonly functionIds: readonly string[]; readonly disabledFunctionIds: readonly { readonly functionId: string; readonly reason: string }[]; readonly keys: readonly K[] },
): { functionIds: string[]; disabledFunctionIds: { functionId: string; reason: string }[]; keys: K[] } {
  const guarded = new Set(STYLE_GUARDED_EXPECTED[style]?.[operatorId] === undefined ? [] : guardedFunctionIds);
  return {
    functionIds: block.functionIds.filter((f) => !guarded.has(f)),
    disabledFunctionIds: [
      ...block.disabledFunctionIds,
      ...block.functionIds.filter((f) => guarded.has(f)).map((functionId) => ({ functionId, reason: STYLE_GUARD_REASON(style) })),
    ],
    keys: block.keys.filter((k) => !guarded.has(k.functionId)),
  };
}

/** Enabled function ids of the templates `STYLE_GUARDED_EXPECTED` lists for (style, operator). */
export function styleGuardedFunctionIds(compiled: CompiledSpec, operatorId: string): string[] {
  const templates = STYLE_GUARDED_EXPECTED[compiled.spec.style ?? '']?.[operatorId] ?? [];
  return templates.flatMap((t) => (compiled.enabled.get(t) ?? []).map((f) => f.functionId));
}

/** BR-U5a-12 (a): every expected template of a positive is disabled for the spec's style or layer kinds. */
export function isStyleDisabled(compiled: CompiledSpec, templates: readonly string[]): boolean {
  if (templates.length === 0) return false;
  return templates.every((t) => (compiled.enabled.get(t) ?? []).length === 0 && (compiled.disabled.get(t) ?? []).length > 0);
}

/** Compiled thresholds per enabled metric template (spec value, else the registry default). */
export function compiledThresholds(compiled: CompiledSpec): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [template, fns] of compiled.enabled) {
    const first = fns[0];
    if (first === undefined) continue;
    if (first.threshold !== undefined) out[template] = first.threshold;
    else if (isMetricTemplate(template)) out[template] = METRIC_DEFAULT_THRESHOLDS[template];
  }
  return out;
}

/** Compiled parameters per enabled template (first function of each template). */
export function compiledParams(compiled: CompiledSpec): Record<string, Readonly<Record<string, unknown>>> {
  const out: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [template, fns] of compiled.enabled) {
    const first = fns[0];
    if (first !== undefined) out[template] = first.params;
  }
  return out;
}

/** Every enabled template function as the collateral computation needs it. */
export function collateralFunctions(compiled: CompiledSpec): CompiledFunctionRef[] {
  const out: CompiledFunctionRef[] = [];
  for (const fns of compiled.enabled.values()) {
    for (const f of fns) out.push({ functionId: f.functionId, template: f.template, ...(f.threshold !== undefined ? { threshold: f.threshold } : {}) });
  }
  return out;
}

/** The collateral context of one application under the explicit cycle strategy (D-U5a-14), U1 caps wired. */
export function collateralContext(
  compiled: CompiledSpec,
  cycleStrategy: CycleStrategy,
  expectedKeys: readonly ExpectedKey[],
): CollateralContext {
  return {
    functions: collateralFunctions(compiled),
    domainLayer: compiled.domainLayer,
    cycleStrategy,
    maxCycleLength: MAX_CYCLE_LENGTH,
    cycleRowCap: CYCLE_ROW_CAP,
    expectedKeys,
  };
}

/** BR-U5a-20: one location rule of one function at one site → the scorer key. */
export function resolveKey(
  rule: LocationRule,
  functionId: string,
  site: MutationSite,
  edit: MutationEdit,
): DomainResult<ExpectedKey> {
  const values: Readonly<Record<string, string>> = { ...site.detail, ...(edit.keyAnchor?.values ?? {}) };
  let filePath: string | undefined;
  switch (rule.filePath) {
    case 'site':
      filePath = site.filePath;
      break;
    case 'created':
      filePath = edit.createdFiles[0];
      break;
    case 'site-target':
      filePath = site.detail.targetFile;
      break;
  }
  if (filePath === undefined || filePath.length === 0) {
    return fail('MUT_KEY_UNRESOLVED', `${rule.template}: no ${rule.filePath} file for the key`);
  }
  let target = '';
  if (rule.target === 'site-target') target = site.detail.targetFile ?? '';
  else if (rule.target === 'package') target = site.detail.package ?? '';
  if (rule.target !== undefined && target.length === 0) {
    return fail('MUT_KEY_UNRESOLVED', `${rule.template}: no ${rule.target} value for the key`);
  }
  const discriminator: string[] = [];
  for (const col of rule.discriminator ?? []) {
    const v = values[`${col}@${rule.template}`] ?? (col === 'relType' ? (values.relType ?? 'IMPORTS') : values[col]);
    if (v === undefined || v.length === 0) {
      return fail('MUT_KEY_UNRESOLVED', `${rule.template}: no value for discriminator ${col}`);
    }
    discriminator.push(v);
  }
  if (rule.line === 'none') {
    return DomainResult.ok({ functionId, filePath, target, discriminator, lineRule: 'none' });
  }
  const line = edit.keyAnchor?.lines?.[rule.template] ?? edit.keyAnchor?.line;
  if (line === undefined || line < 1) return fail('MUT_KEY_UNRESOLVED', `${rule.template}: no ${rule.line} line for the key`);
  return DomainResult.ok({ functionId, filePath, target, discriminator, lineRule: rule.line, line });
}

/** Keys of the given rules for every enabled function of each rule's template. */
export function keysFor(
  compiled: CompiledSpec,
  rules: readonly LocationRule[],
  site: MutationSite,
  edit: MutationEdit,
): DomainResult<{ readonly template: string; readonly key: ExpectedKey }[]> {
  const out: { template: string; key: ExpectedKey }[] = [];
  for (const rule of rules) {
    for (const f of compiled.enabled.get(rule.template) ?? []) {
      const key = resolveKey(rule, f.functionId, site, edit);
      if (!key.success) return key;
      out.push({ template: rule.template, key: key.data });
    }
  }
  return DomainResult.ok(out);
}

/** Expected keys plus keyed operator collateral of one application (site collateral is computed separately). */
export function declaredKeys(
  compiled: CompiledSpec,
  op: MutationOperator,
  site: MutationSite,
  edit: MutationEdit,
): DomainResult<{ readonly keys: readonly ExpectedKey[]; readonly operatorCollateral: readonly SiteCollateral[] }> {
  const keys = keysFor(compiled, op.expectedTemplates, site, edit);
  if (!keys.success) return keys;
  const coll = keysFor(compiled, op.operatorCollateral, site, edit);
  if (!coll.success) return coll;
  const operatorCollateral: SiteCollateral[] = coll.data.map(({ template, key }) => ({
    kind: 'operator',
    template,
    functionId: key.functionId,
    cause: 'declared',
    key,
  }));
  return DomainResult.ok({ keys: keys.data.map((k) => k.key), operatorCollateral });
}

/**
 * The expected block of one application (BR-U5a-19..22, 26). `siteCollateral` comes from `collateral.ts`
 * (computed with the expected and operator-collateral keys, so none is repeated).
 */
export function expectedBlock(
  compiled: CompiledSpec,
  op: MutationOperator,
  site: MutationSite,
  edit: MutationEdit,
  siteCollateral: readonly SiteCollateral[],
): DomainResult<ExpectedBlock> {
  const declared = declaredKeys(compiled, op, site, edit);
  if (!declared.success) return declared;
  const collateral = [...declared.data.operatorCollateral, ...siteCollateral];
  const edges =
    op.expectedEdges === undefined || op.expectedEdges.length === 0
      ? undefined
      : op.expectedEdges.map((e) => ({
          type: e.type,
          source: site.detail.class ?? '',
          target: site.detail.targetName ?? '',
          via: e.via,
        }));
  if (op.role === 'twin') {
    if (op.twinOf === undefined) return fail('MUT_TWIN_WITHOUT_POSITIVE', `${op.id} has no twinOf`);
    return DomainResult.ok({
      negative: true,
      twinOf: op.twinOf,
      functionIds: [],
      keys: [],
      collateral,
      coverage: op.coverage,
      ...(edges !== undefined ? { expectedEdges: edges } : {}),
    });
  }
  const templates = op.expectedTemplates.map((r) => r.template);
  const resolved = resolveTemplates(compiled, templates);
  const guarded = applyStyleGuard(op.id, compiled.spec.style ?? '', styleGuardedFunctionIds(compiled, op.id), {
    functionIds: resolved.functionIds, disabledFunctionIds: resolved.disabledFunctionIds, keys: declared.data.keys,
  });
  const resolution = { ...resolved, ...guarded };
  return DomainResult.ok({
    functionIds: op.judgeProbe !== undefined ? [] : resolution.functionIds,
    disabledFunctionIds: resolution.disabledFunctionIds,
    absentTemplates: resolution.absentTemplates,
    dimension: op.judgeProbe !== undefined ? op.dimension : (resolution.dimension ?? op.dimension),
    // Outside-coverage positives (MO-X01) keep their intended keys: the outside stratum measures their misses.
    keys: resolution.keys,
    collateral,
    coverage: op.coverage,
    ...(op.judgeProbe !== undefined ? { judgeProbe: op.judgeProbe } : {}),
    ...(edges !== undefined ? { expectedEdges: edges } : {}),
  });
}
