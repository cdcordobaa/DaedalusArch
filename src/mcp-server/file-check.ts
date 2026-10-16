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
import { IMPORT_RULE_NAMES, importableLayers, isExcluded, ruleState } from './spec-rules.js';
import { buildFastContext } from './fast-context.js';
import { FAST_RULE_NAMES, fastRuleFindings } from './fast-rules.js';
import type { RawFinding } from './fast-rules.js';
import { fastHints } from './fast-hints.js';
import type { RawHint } from './fast-hints.js';
import { ProjectView } from './project-files.js';
import { hintMeta, specRuleMeta, v13RuleStates } from './rule-meta.js';
import type { RuleMeta } from './rule-meta.js';
import type {
  BlockingVerdict,
  FileCheckResult,
  FileVerdict,
  FileViolation,
  NotChecked,
  RuleHit,
} from './types.js';

/** The pre-v2 fields of a violation (what the import and naming checks build). */
type BaseViolation = Pick<FileViolation, 'rule' | 'ruleName' | 'severity' | 'line' | 'subject' | 'reason' | 'fix'> & {
  readonly target?: string;
  readonly viaBarrels?: readonly string[];
};

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
): BaseViolation[] {
  const out: BaseViolation[] = [];
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
        target: cls.name,
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
  /**
   * MCP v2: the project as the fast checks may read it (barrels, entry files, the import graph for cycles). Without
   * it the check is spec-only: no barrel is followed and no cycle is checked.
   */
  readonly view?: ProjectView;
  /** MCP v2: the project's literal import graph with the proposed contents (built from `view` when omitted). */
  readonly graph?: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Ids of every rule check_file / check_diff decide for this spec under v1.3 (import, naming and fast rules). */
export function fileCheckedRulesV2(spec: ParsedSpec, projectAware: boolean): readonly string[] {
  const states = v13RuleStates(spec);
  return spec.fitnessFunctions
    .filter((ff) => states.get(String(ff.id))?.status === 'active')
    .filter((ff) =>
      IMPORT_RULE_NAMES.includes(ff.name) ||
      (NAMING_RULE_NAMES.includes(ff.name) && ff.pattern !== undefined) ||
      (FAST_RULE_NAMES.includes(ff.name) && (ff.name !== 'no-cyclic-deps' || projectAware)))
    .map((ff) => String(ff.id));
}

/** Why the fast path leaves a rule to evaluate_project. */
function notCheckedReason(name: string, projectAware: boolean): string {
  if (name === 'no-cyclic-deps' && !projectAware) return 'a cycle needs the whole import graph: no project root is configured, so run evaluate_project (or start the server with --project)';
  if (['domain-stability', 'module-fan-out', 'component-instability', 'max-fan-in', 'abstraction-ratio', 'no-orphan-files'].includes(name)) return 'a metric over the whole graph';
  if (['dependency-inversion', 'port-dependency-inversion'].includes(name)) return 'a ratio over every injected dependency of a class, read from the graph';
  if (['single-responsibility-proxy', 'interface-segregation-proxy', 'inheritance-depth'].includes(name)) return 'a proxy over the class graph (members, injections, inheritance chains)';
  if (['use-case-isolation', 'controller-no-entity'].includes(name)) return 'reads CONSTRUCTOR_INJECTS paths across files';
  if (['architectural-integrity', 'intent-alignment'].includes(name)) return 'an LLM judge dimension (reported, non-blocking in v1.3)';
  if (['naming-conventions', 'test-file-pairing', 'no-index-logic'].includes(name)) return 'reads every file of the project';
  return 'not covered by the spec-only fast path';
}

function notCheckedRules(spec: ParsedSpec, projectAware: boolean): NotChecked[] {
  const checked = new Set(fileCheckedRulesV2(spec, projectAware));
  const states = v13RuleStates(spec);
  return spec.fitnessFunctions
    .filter((ff) => states.get(String(ff.id))?.status === 'active' && !checked.has(String(ff.id)))
    .filter((ff) => !(NAMING_RULE_NAMES.includes(ff.name) && ff.pattern === undefined))
    .map((ff) => {
      const meta = specRuleMeta(spec, ff);
      return { ruleId: meta.ruleId, ruleName: ff.name, tier: meta.tier, reason: notCheckedReason(ff.name, projectAware) };
    });
}

function withMeta(meta: RuleMeta, file: string, row: BaseViolation, check: FileViolation['check']): FileViolation {
  return {
    rule: row.rule,
    ruleName: row.ruleName,
    severity: row.severity,
    line: row.line,
    subject: row.subject,
    reason: row.reason,
    fix: row.fix,
    ruleId: meta.ruleId,
    tier: meta.tier,
    tierSource: meta.tierSource,
    ...(meta.candidateTier !== undefined ? { candidateTier: meta.candidateTier } : {}),
    construct: meta.construct,
    source: meta.source,
    edgeView: meta.edgeView,
    check,
    file,
    location: `${file}:${String(row.line)}`,
    ...(row.target !== undefined ? { target: row.target } : {}),
    ...(row.viaBarrels !== undefined && row.viaBarrels.length > 0 ? { viaBarrels: row.viaBarrels } : {}),
  };
}

function fromRaw(r: RawFinding, lineOf: (line: number) => number): BaseViolation {
  return {
    rule: r.ruleId,
    ruleName: r.ruleName,
    severity: r.severity,
    line: lineOf(r.line),
    subject: r.subject,
    reason: r.reason,
    fix: r.fix,
    ...(r.target !== undefined ? { target: r.target } : {}),
    ...(r.viaBarrels !== undefined ? { viaBarrels: r.viaBarrels } : {}),
  };
}

function fromHint(file: string, h: RawHint, lineOf: (line: number) => number): FileViolation {
  const meta = hintMeta(h.kind, h.name);
  return withMeta(meta, file, {
    rule: meta.ruleId,
    ruleName: h.name,
    severity: 'advisory',
    line: lineOf(h.line),
    subject: h.subject,
    reason: h.reason,
    fix: h.fix,
    ...(h.target !== undefined ? { target: h.target } : {}),
  }, h.kind);
}

function verdictOf(violations: readonly FileViolation[], unresolved: number): FileVerdict {
  return violations.length > 0 ? 'violations' : unresolved > 0 ? 'unknown' : 'clean';
}

export function blockingVerdictOf(violations: readonly FileViolation[], unresolved: number): BlockingVerdict {
  return violations.some((v) => v.tier === 'blocking') ? 'block' : unresolved > 0 ? 'unknown' : 'pass';
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

export function blockingSummaryOf(verdict: BlockingVerdict, violations: readonly FileViolation[], hints: number): string {
  const blocking = violations.filter((v) => v.tier === 'blocking');
  const advisory = violations.length - blocking.length;
  const tail = `${String(advisory)} advisory, ${String(hints)} hint(s)`;
  if (verdict === 'block') {
    const rules = [...new Set(blocking.map((v) => v.rule))].join(', ');
    return `BLOCK: ${String(blocking.length)} blocking violation(s) of ${rules} (v1.3 tiers); fix them before writing. ${tail}.`;
  }
  if (verdict === 'unknown') return `UNKNOWN: no blocking violation found, but some imports could not be placed; ${tail}.`;
  return `PASS: no blocking violation (v1.3 tiers); ${tail}.`;
}

export function checkSource(spec: ParsedSpec, input: CheckSourceInput): FileCheckResult {
  const filePath = normalisePath(input.path);
  const lineOf = input.lineOf ?? ((l: number): number => l);
  const layer = resolveLayer(spec, filePath)?.layer ?? null;
  const scan = scanSource(input.content);
  const base: BaseViolation[] = [];
  const baseAdvisories: BaseViolation[] = [];
  const unresolved: { line: number; specifier: string }[] = [];
  const notes: string[] = [];

  for (const imp of scan.imports) {
    const res = checkImport(spec, { fromFile: filePath, module: imp.specifier });
    if (res.verdict === 'unknown') {
      unresolved.push({ line: lineOf(imp.line), specifier: imp.specifier });
      continue;
    }
    if (layer === null) continue;
    const target = res.to.path ?? res.to.package;
    for (const hit of res.violations) {
      const row: BaseViolation = {
        rule: hit.ruleId,
        ruleName: hit.ruleName,
        severity: hit.severity,
        line: lineOf(imp.line),
        subject: `import "${imp.specifier}"`,
        reason: hit.reason,
        fix: importFix(spec, hit, filePath, layer, res.to),
        ...(target !== undefined ? { target } : {}),
      };
      // v1.3: string-literal require()/import() calls are IMPORTS edges of the evaluated graph (dynamicImports), so
      // they are scored like static imports (R03, post-merge review 2026-10-16); `advisories` stays empty.
      base.push(row);
    }
  }
  base.push(...namingViolations(spec, filePath, layer, scan.classes, lineOf));
  base.sort((a, b) => a.line - b.line);

  // MCP v2: the v1.3 fast rules and the advisory hints.
  const view = input.view ?? new ProjectView();
  const ctx = buildFastContext(spec, filePath, input.content, view);
  const graph = input.graph ?? (view.hasRoot ? view.importGraph() : undefined);
  const extra = fastRuleFindings(ctx, graph !== undefined ? { graph } : {});
  const all = [...base];
  const seen = new Set(base.map((b) => `${b.rule}|${String(b.line)}|${b.subject}`));
  for (const r of extra) {
    const row = fromRaw(r, lineOf);
    const key = `${row.rule}|${String(row.line)}|${row.subject}`;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(row);
  }
  all.sort((a, b) => a.line - b.line);

  const meta = (row: BaseViolation): RuleMeta => specRuleMeta(spec, { id: row.rule, name: row.ruleName });
  const violations = base.map((r) => withMeta(meta(r), filePath, r, 'spec'));
  const findings = all.map((r) => withMeta(meta(r), filePath, r, 'spec'));
  const advisories = baseAdvisories.map((r) => withMeta(meta(r), filePath, r, 'spec'));
  const hints = fastHints(ctx).map((h) => fromHint(filePath, h, lineOf));

  if (layer === null) {
    notes.push(
      'no layer glob matches this path, so layer and purity rules do not apply; use suggest_placement or which_layer to pick a layer',
    );
  }
  if (!view.hasRoot) {
    notes.push('spec-only: no project root, so barrels are not followed (resolved view = literal view), entry files are the declared public APIs only, and cycles are not checked');
  }
  if (ctx.ast.partial) notes.push('the text does not parse whole (partial content): class-level checks may be incomplete');
  const blockingVerdict = blockingVerdictOf(findings, unresolved.length);
  const blockingCount = findings.filter((v) => v.tier === 'blocking').length;
  return {
    path: filePath,
    layer,
    verdict: verdictOf(violations, unresolved.length),
    summary: summaryOf(filePath, layer, violations, unresolved.length),
    violations,
    advisories,
    unresolved,
    checkedRules: [...new Set([...fileCheckedRules(spec), ...fileCheckedRulesV2(spec, view.hasRoot)])],
    notes,
    findings,
    blockingVerdict,
    blockingCount,
    advisoryCount: findings.length - blockingCount,
    blockingSummary: blockingSummaryOf(blockingVerdict, findings, hints.length),
    hints,
    notChecked: notCheckedRules(spec, view.hasRoot),
    projectAware: view.hasRoot,
  };
}
