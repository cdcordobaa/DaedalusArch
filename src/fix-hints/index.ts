/**
 * Fix hints for blocking findings (v1.3, Docs/v1.3/fix-hints.md). Entry points:
 * - `buildFixHint`: one finding (the MCP tools, spec only; the CLI, with graph facts);
 * - `buildReportFixHints`: every blocking violation of a report, for `firewall evaluate --hints`;
 * - `formatFixHintsHuman`: the CLI's human section.
 * Only rules whose v1.3 tier is blocking for the spec's style get a hint (`ruleTier`, Docs/v1.3/rule-tiers.md).
 */
import * as path from 'node:path';
import type { ParsedSpec } from '../shared/types/spec.js';
import type { APGResult } from '../shared/types/apg.js';
import type { Violation } from '../shared/taxonomy/violation-types.js';
import { ruleTier } from '../scoring-engine/rule-tiers.js';
import { graphFactsFromApg } from './graph-facts.js';
import type { GraphFacts } from './graph-facts.js';
import { SpecModel } from './spec-model.js';
import { draftHint, familyOf } from './templates.js';
import type { FixHint, HintFinding, ReportFixHint } from './types.js';

export type { FixHint, FixHintFamily, FixAction, GraphEditOp, HintFinding, ReportFixHint } from './types.js';
export type { GraphFacts } from './graph-facts.js';
export { graphFactsFromApg } from './graph-facts.js';
export { SpecModel } from './spec-model.js';
export { familyOf } from './templates.js';

/** The template name of a rule id in this spec (FF-S01 is `dependency-direction` or `dependency-direction-graph`). */
export function ruleNameOf(spec: ParsedSpec, ruleId: string): string | undefined {
  return spec.fitnessFunctions.find((f) => String(f.id) === ruleId)?.name;
}

/** True when the rule blocks a v1.3 verdict for the spec's style. */
export function isBlockingRule(spec: ParsedSpec, ruleId: string): boolean {
  return ruleTier(ruleId, spec.style).tier === 'blocking';
}

const models = new WeakMap<ParsedSpec, SpecModel>();
function modelOf(spec: ParsedSpec): SpecModel {
  let m = models.get(spec);
  if (m === undefined) {
    m = new SpecModel(spec);
    models.set(spec, m);
  }
  return m;
}

/**
 * The fix hint of one finding, or undefined when the rule is not blocking for the spec's style, has no template, or
 * the spec's layer model leaves no valid target. `graph` adds graph facts (existing ports, importers, declarations).
 */
export function buildFixHint(spec: ParsedSpec, finding: HintFinding, graph?: GraphFacts): FixHint | undefined {
  if (!isBlockingRule(spec, finding.ruleId)) return undefined;
  const ruleName = ruleNameOf(spec, finding.ruleId);
  if (ruleName === undefined || familyOf(ruleName) === undefined) return undefined;
  const draft = draftHint({ model: modelOf(spec), graph }, ruleName, finding);
  if (draft === undefined) return undefined;
  const { usedGraph, ...rest } = draft;
  return { ruleId: finding.ruleId, ruleName, ...rest, basis: usedGraph === true ? 'graph+spec' : 'spec' };
}

/** A violation path as the spec's globs see it: project-relative POSIX. */
function relative(projectPath: string, p: string): string {
  const posix = p.replace(/\\/g, '/');
  if (!path.isAbsolute(p)) return posix.replace(/^\.\//, '');
  return path.relative(path.resolve(projectPath), p).replace(/\\/g, '/');
}

/** The finding a report violation stands for. */
export function findingOfViolation(v: Violation, projectPath: string): HintFinding {
  return {
    ruleId: String(v.functionId),
    filePath: v.filePath.split(',').map((p) => relative(projectPath, p.trim())).join(','),
    ...(v.target !== undefined ? { target: v.target.includes('/') || v.target.endsWith('.ts') ? relative(projectPath, v.target) : v.target } : {}),
    ...(v.discriminator !== undefined ? { discriminator: v.discriminator } : {}),
    ...(v.isTypeOnly !== undefined ? { isTypeOnly: v.isTypeOnly } : {}),
  };
}

/** Hints for every blocking violation of a report, in violation order; `apg` adds the graph facts. */
export function buildReportFixHints(
  violations: readonly Violation[],
  spec: ParsedSpec,
  projectPath: string,
  apg?: Pick<APGResult, 'nodes' | 'edges'>,
): readonly ReportFixHint[] {
  const graph = apg === undefined ? undefined : graphFactsFromApg(apg, (p) => relative(projectPath, p));
  const out: ReportFixHint[] = [];
  for (const v of violations) {
    const finding = findingOfViolation(v, projectPath);
    const hint = buildFixHint(spec, finding, graph);
    if (hint === undefined) continue;
    out.push({ violationId: v.id, filePath: finding.filePath, ...(finding.target !== undefined ? { targetPath: finding.target } : {}), ...hint });
  }
  return out;
}

/** The human-readable fix-hint section of `firewall evaluate --hints --format human`. */
export function formatFixHintsHuman(hints: readonly ReportFixHint[]): string {
  const lines: string[] = [`  Fix hints (${String(hints.length)} blocking finding${hints.length === 1 ? '' : 's'}):`, ''];
  for (const h of hints) {
    lines.push(`  [${h.ruleId} ${h.ruleName}] ${h.filePath}${h.targetPath !== undefined ? ` -> ${h.targetPath}` : ''}`);
    lines.push(`    Problem: ${h.problem}`);
    lines.push(`    Breaks:  ${h.breaks.dependency}`);
    lines.push(`             rule: ${h.breaks.rule}`);
    lines.push(`    Target:  ${h.target.layer ?? 'no layer'}${h.target.folder !== null ? ` (${h.target.folder})` : ''}`);
    lines.push(`    Fix:     ${h.fix.text}`);
    lines.push('');
  }
  return lines.join('\n');
}
