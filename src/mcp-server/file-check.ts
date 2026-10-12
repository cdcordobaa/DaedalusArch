/**
 * `check_file`: the spec-based rules applied to one proposed file, without a graph. Every import the lexical scan
 * finds goes through `checkImport` (FF-S01, FF-S03, FF-S04, FF-P01); every declared class goes through the naming
 * templates that a class name and the file's layer decide (naming-services, naming-repos, naming-controllers). Each
 * violation carries a concrete fix. Pure; `checkSource` is shared with `check_diff`, which feeds it added lines only.
 */
import type { FitnessFunction, ParsedSpec } from '../shared/types/spec.js';
import { bindLayerParams } from '../fitness-compiler/layer-binding.js';
import { compilePattern } from '../fitness-compiler/pattern-compiler.js';
import { checkImport } from './import-check.js';
import { normalisePath, resolveLayer } from './layer-resolver.js';
import { scanSource } from './source-scan.js';
import type { ScannedClass } from './source-scan.js';
import { importableLayers, isExcluded, ruleState } from './spec-rules.js';
import type { FileCheckResult, FileVerdict, FileViolation, RuleHit } from './types.js';

/** Naming templates a class declaration alone decides (the others need the graph or never fire). */
export const NAMING_RULE_NAMES: readonly string[] = Object.freeze([
  'naming-services',
  'naming-repos',
  'naming-controllers',
]);

const IMPORT_RULES = [
  'dependency-direction',
  'no-layer-skip',
  'no-domain-outward-dep',
  'domain-purity',
];

function layerNames(spec: ParsedSpec): readonly string[] {
  return spec.layerModel.layers.map((l) => l.name);
}

function list(items: readonly string[]): string {
  return items.length === 0 ? 'no other layer' : items.join(', ');
}

/** The concrete change that clears an import-rule hit. */
export function importFix(
  spec: ParsedSpec,
  hit: RuleHit,
  fromFile: string,
  fromLayer: string,
  target: { readonly specifier: string; readonly layer: string | null; readonly package?: string },
): string {
  const names = layerNames(spec);
  const binding = bindLayerParams(spec.layerModel.layers);
  const { may } = importableLayers(spec, fromLayer, fromFile);
  const tgt = target.layer ?? '';
  if (hit.ruleName === 'domain-purity') {
    const outer = binding.infraLayer ?? names[names.length - 1] ?? 'an outer layer';
    return `Remove the "${target.package ?? target.specifier}" import from ${fromLayer}. Keep framework code (decorators, ORM models, HTTP types) in ${outer} and map it to plain ${fromLayer} classes there.`;
  }
  const srcIdx = names.indexOf(fromLayer);
  const tgtIdx = names.indexOf(tgt);
  if (srcIdx < tgtIdx || hit.ruleName === 'no-domain-outward-dep') {
    return `Do not import ${tgt} from ${fromLayer} (it may import: ${list(may)}). Declare an interface for what you need in ${fromLayer}, implement it in ${tgt}, and inject the implementation from the composition root.`;
  }
  // An inward import that skips a layer (closed layering).
  const adjacent = names[srcIdx - 1];
  return adjacent === undefined
    ? `Do not import ${tgt} from ${fromLayer}; it may import: ${list(may)}.`
    : `Go through ${adjacent}: call a ${adjacent} service that wraps what you need from ${tgt}, or move that type into ${adjacent}. ${fromLayer} may import: ${list(may)}.`;
}

/** Alternatives of a glob naming pattern that are pure suffixes (`*Service`), longest first. */
function suffixes(pattern: string): readonly string[] {
  return pattern
    .split('|')
    .filter((alt) => alt.startsWith('*') && !alt.slice(1).includes('*'))
    .map((alt) => alt.slice(1))
    .sort((a, b) => b.length - a.length);
}

/** A name that satisfies `pattern`, derived from `name` by cutting or moving the role suffix; undefined if none. */
export function suggestName(name: string, pattern: string): string | undefined {
  const regex = new RegExp(compilePattern(pattern));
  for (const suffix of suffixes(pattern)) {
    const idx = name.indexOf(suffix);
    if (idx < 0) continue;
    const candidate =
      idx > 0 ? name.slice(0, idx + suffix.length) : `${name.slice(suffix.length)}${suffix}`;
    if (candidate !== suffix && regex.test(candidate)) return candidate;
  }
  return undefined;
}

/** True when a class of `layer` with `cls` is selected by the naming template `ff.name` (its MATCH/WHERE part). */
function selectedByNaming(
  spec: ParsedSpec,
  ff: FitnessFunction,
  layer: string | null,
  cls: ScannedClass,
): boolean {
  const binding = bindLayerParams(spec.layerModel.layers);
  if (ff.name === 'naming-services') {
    return (
      layer !== null &&
      binding.applicationLayers.includes(layer) &&
      (cls.name.includes('Service') || cls.name.includes('UseCase'))
    );
  }
  if (ff.name === 'naming-repos')
    return cls.name.includes('Repository') || cls.name.includes('Repo');
  if (ff.name === 'naming-controllers') {
    return (
      layer !== null &&
      layer === binding.controllerLayer &&
      cls.decorators.some((d) => d.includes('Controller'))
    );
  }
  return false;
}

function activeNamingRules(spec: ParsedSpec): readonly FitnessFunction[] {
  return spec.fitnessFunctions.filter(
    (ff) =>
      NAMING_RULE_NAMES.includes(ff.name) &&
      ff.pattern !== undefined &&
      ruleState(spec, ff).status === 'active',
  );
}

function namingViolations(
  spec: ParsedSpec,
  filePath: string,
  layer: string | null,
  classes: readonly ScannedClass[],
  lineOf: (line: number) => number,
): FileViolation[] {
  const out: FileViolation[] = [];
  for (const ff of activeNamingRules(spec)) {
    if (isExcluded(ff, filePath)) continue;
    const pattern = ff.pattern ?? '';
    const regex = new RegExp(compilePattern(pattern));
    for (const cls of classes) {
      if (!selectedByNaming(spec, ff, layer, cls) || regex.test(cls.name)) continue;
      const suggestion = suggestName(cls.name, pattern);
      out.push({
        rule: String(ff.id),
        ruleName: ff.name,
        severity: ff.severity,
        line: lineOf(cls.line),
        subject: `class ${cls.name}`,
        reason: `class ${cls.name} does not match the naming pattern "${pattern}"`,
        fix:
          suggestion !== undefined
            ? `Rename ${cls.name} to ${suggestion}.`
            : `Rename ${cls.name} so it matches "${pattern}".`,
      });
    }
  }
  return out;
}

/** Ids of the rules `check_file` evaluates for this spec (active import and naming rules). */
export function fileCheckedRules(spec: ParsedSpec): readonly string[] {
  return spec.fitnessFunctions
    .filter(
      (ff) =>
        (IMPORT_RULES.includes(ff.name) || NAMING_RULE_NAMES.includes(ff.name)) &&
        ruleState(spec, ff).status === 'active' &&
        (!NAMING_RULE_NAMES.includes(ff.name) || ff.pattern !== undefined),
    )
    .map((ff) => String(ff.id));
}

export interface CheckSourceInput {
  /** Project-relative path of the file (decides its layer and the exclude paths). */
  readonly path: string;
  readonly content: string;
  /** Maps a line of `content` to the line reported (`check_diff` passes the new-file line numbers). */
  readonly lineOf?: (line: number) => number;
}

function verdictOf(violations: readonly FileViolation[], unresolved: number): FileVerdict {
  return violations.length > 0 ? 'violations' : unresolved > 0 ? 'unknown' : 'clean';
}

function summaryOf(
  path: string,
  layer: string | null,
  violations: readonly FileViolation[],
  unresolved: number,
): string {
  const where = `${path} (${layer ?? 'no layer'})`;
  if (violations.length > 0) {
    const rules = [...new Set(violations.map((v) => v.rule))].join(', ');
    return `${where}: ${String(violations.length)} violation(s) of ${rules}; apply each fix.`;
  }
  if (unresolved > 0) {
    return `${where}: no violation found, ${String(unresolved)} alias import(s) unresolved; check them with check_import and resolvedPath.`;
  }
  return `${where}: clean.`;
}

export function checkSource(spec: ParsedSpec, input: CheckSourceInput): FileCheckResult {
  const filePath = normalisePath(input.path);
  const lineOf = input.lineOf ?? ((l: number): number => l);
  const layer = resolveLayer(spec, filePath)?.layer ?? null;
  const scan = scanSource(input.content);
  const violations: FileViolation[] = [];
  const advisories: FileViolation[] = [];
  const unresolved: { line: number; specifier: string }[] = [];
  const notes: string[] = [];

  for (const imp of scan.imports) {
    const res = checkImport(spec, { fromFile: filePath, module: imp.specifier });
    if (res.verdict === 'unknown') {
      unresolved.push({ line: lineOf(imp.line), specifier: imp.specifier });
      continue;
    }
    if (layer === null) continue;
    for (const hit of res.violations) {
      const row: FileViolation = {
        rule: hit.ruleId,
        ruleName: hit.ruleName,
        severity: hit.severity,
        line: lineOf(imp.line),
        subject: `import "${imp.specifier}"`,
        reason: hit.reason,
        fix: importFix(spec, hit, filePath, layer, res.to),
      };
      (imp.kind === 'require' || imp.kind === 'dynamic' ? advisories : violations).push(row);
    }
  }
  violations.push(...namingViolations(spec, filePath, layer, scan.classes, lineOf));
  violations.sort((a, b) => a.line - b.line);

  if (layer === null) {
    notes.push(
      'no layer glob matches this path, so layer and purity rules do not apply; use suggest_placement or which_layer to pick a layer',
    );
  }
  if (advisories.length > 0) {
    notes.push(
      'advisories are require()/import() calls: not scored by the firewall, but they break the same rule',
    );
  }
  return {
    path: filePath,
    layer,
    verdict: verdictOf(violations, unresolved.length),
    summary: summaryOf(filePath, layer, violations, unresolved.length),
    violations,
    advisories,
    unresolved,
    checkedRules: fileCheckedRules(spec),
    notes,
  };
}
