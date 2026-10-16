/**
 * `check_file` / `check_diff` with `templates: true` (v1.3 npx mode, `Docs/v1.3/npx-mode.md` §3): the rules of
 * record, i.e. the compiled Cypher templates, executed by the in-process interpreter on the whole project before and
 * after the proposed change. The answer is what the change introduces (findings after minus findings before, matched
 * without line numbers so a moved line is not new) and how many findings it clears.
 *
 * The fast path (`file-check.ts`, `fast-rules.ts`) is unchanged and stays the instant answer; this section is the
 * slower one whose findings are, by construction, the ones `evaluate_project` and the CLI report.
 */
import * as path from 'node:path';
import type { ParsedSpec } from '../shared/types/spec.js';
import type { EvaluationReport, ScoringMode } from '../shared/types/evaluation.js';
import type { Violation } from '../shared/taxonomy/violation-types.js';
import type { InterpEvaluator } from './interp-evaluator.js';
import { specRuleMeta } from './rule-meta.js';
import { normalisePath } from './layer-resolver.js';
import type { TemplateCheckResult, TemplateFinding } from './types.js';

/** Project-relative path → content (`null` = removed). */
export type RelativeOverrides = ReadonlyMap<string, string | null>;

export interface TemplateCheckInput {
  readonly spec: ParsedSpec;
  readonly specPath: string;
  readonly projectRoot: string | undefined;
  readonly scoringMode?: ScoringMode;
  /** The project before the change, relative to the files on disk (empty = the disk). */
  readonly before: RelativeOverrides;
  /** The project after the change, relative to the files on disk. */
  readonly after: RelativeOverrides;
  readonly interp: InterpEvaluator | undefined;
}

function absolute(root: string, rel: RelativeOverrides): Map<string, string | null> {
  return new Map([...rel.entries()].map(([p, c]) => [path.resolve(root, p), c]));
}

function relative(root: string, p: string | undefined): string | undefined {
  if (p === undefined || p === '') return p;
  return path.isAbsolute(p) ? normalisePath(path.relative(root, p)) : normalisePath(p);
}

/** Identity of a template finding without its line. */
function keyOf(root: string, v: Violation): string {
  return [String(v.functionId), v.type, relative(root, v.filePath) ?? '', relative(root, v.target) ?? ''].join('|');
}

function tierOf(report: EvaluationReport, spec: ParsedSpec, id: string, name: string): 'blocking' | 'advisory' {
  const t = report.tiers;
  if (t !== undefined) {
    if (t.blocking.rules.some((r) => String(r.functionId) === id)) return 'blocking';
    if (t.advisory.rules.some((r) => String(r.functionId) === id)) return 'advisory';
  }
  return specRuleMeta(spec, { id, name }).tier;
}

function finding(root: string, report: EvaluationReport, spec: ParsedSpec, v: Violation): TemplateFinding {
  const id = String(v.functionId);
  const name = report.functionResults.find((r) => String(r.functionId) === id)?.name ?? id;
  const meta = specRuleMeta(spec, { id, name });
  const target = relative(root, v.target);
  return {
    ruleId: id,
    ruleName: name,
    tier: tierOf(report, spec, id, name),
    construct: meta.construct,
    source: meta.source,
    severity: v.severity,
    type: v.type,
    filePath: relative(root, v.filePath) ?? v.filePath,
    ...(v.line !== undefined && { line: v.line }),
    ...(target !== undefined && target !== '' && { target }),
    message: v.message.split(root + path.sep).join(''),
  };
}

const skipped = (reason: string): TemplateCheckResult => ({
  status: 'skipped',
  reason,
  engine: 'cypher-interp',
  introduced: [],
  clearedCount: 0,
  blockingVerdict: 'unknown',
});

export async function templateCheck(input: TemplateCheckInput): Promise<TemplateCheckResult> {
  if (input.interp === undefined) {
    return skipped('the server runs on Neo4j (--engine neo4j or NEO4J_URI set); template checks run on cypher-interp only, use evaluate_project');
  }
  if (input.projectRoot === undefined) return skipped('no project root: start the server with --project <dir>');
  const root = path.resolve(input.projectRoot);
  const scoringMode = input.scoringMode ?? 'v1.3';
  const before = await input.interp({ projectPath: root, specPath: input.specPath, scoringMode, overrides: absolute(root, input.before) });
  if (!before.success) return skipped(`evaluation before the change failed: ${before.errors.map((e) => e.message).join('; ')}`);
  const after = await input.interp({ projectPath: root, specPath: input.specPath, scoringMode, overrides: absolute(root, input.after) });
  if (!after.success) return skipped(`evaluation after the change failed: ${after.errors.map((e) => e.message).join('; ')}`);

  const remaining = new Map<string, number>();
  for (const v of before.data.report.violations) {
    const k = keyOf(root, v);
    remaining.set(k, (remaining.get(k) ?? 0) + 1);
  }
  const introduced: TemplateFinding[] = [];
  for (const v of after.data.report.violations) {
    const k = keyOf(root, v);
    const n = remaining.get(k) ?? 0;
    if (n > 0) remaining.set(k, n - 1);
    else introduced.push(finding(root, after.data.report, input.spec, v));
  }
  const clearedCount = [...remaining.values()].reduce((a, b) => a + b, 0);
  return {
    status: 'checked',
    engine: 'cypher-interp',
    introduced,
    clearedCount,
    blockingVerdict: introduced.some((f) => f.tier === 'blocking') ? 'block' : 'pass',
    latencyMs: { before: before.data.latencyMs, after: after.data.latencyMs },
    cache: { before: before.data.cache, after: after.data.cache },
  };
}
