/**
 * v1.3 external set, deterministic correctness (Docs/DiagnosticRuns/v1.3-external-correctness-2026-10-16.md).
 *
 * Builds the labelling jobs file for the 15 human-written repositories of the external set (PR #133,
 * `results/v1.3-external/`) and summarises the checker's verdicts per style, per rule and per template. Pure
 * functions; the CLIs are `scripts/v1.3/external-correctness-jobs.ts` and `scripts/v1.3/external-correctness-summary.ts`.
 * No Neo4j, no model.
 */
import * as path from 'node:path';
import { wilson } from '../../lib/stats.js';
import type { Finding, JobsFile, LabellingJob } from './labelling/findings.js';
import type { SampleFile, SampledFinding } from './labelling/sampler.js';
import { ruleOf } from './labelling/sampler.js';
import type { CorrectnessResult } from './labelling/correctness.js';

export interface ExternalEntry {
  readonly id: string;
  readonly style: string;
  /** Analysis root inside the clone ('.' or a sub-folder such as `apps/api`). */
  readonly root: string;
}

/** One job per entry: source `<clones>/<id>/<root>`, spec `<external>/specs/<id>.yaml`, report `<external>/findings/<id>.json`. */
export function externalJobs(entries: readonly ExternalEntry[], externalDir: string, clonesDir: string): JobsFile {
  const jobs: LabellingJob[] = entries.map((e) => ({
    projectId: e.id,
    projectRoot: path.resolve(clonesDir, e.id, e.root),
    spec: path.resolve(externalDir, 'specs', `${e.id}.yaml`),
    report: path.resolve(externalDir, 'findings', `${e.id}.json`),
    style: e.style,
  }));
  return { schemaVersion: 1, kind: 'custom', jobs };
}

interface TierRule { readonly functionId: string; readonly tier: string }
export interface ReportTiers { readonly tiers: { readonly blocking: { readonly rules: readonly TierRule[] }; readonly advisory: { readonly rules: readonly TierRule[] } } }

/** Rule ids the report itself places in its blocking tier (the population #133 counted). */
export function reportBlockingRules(report: ReportTiers): Set<string> {
  return new Set(report.tiers.blocking.rules.map((r) => r.functionId));
}

/**
 * The findings to check: every finding whose rule the report places in its blocking tier, plus the advisory findings
 * of #133's seeded sample (identified by project and violation id). Disagreements between the report's tier and
 * `ruleTier()` are returned, never resolved silently.
 */
export function externalSample(
  findings: readonly Finding[], blockingByProject: ReadonlyMap<string, ReadonlySet<string>>, advisoryIds: ReadonlySet<string>,
): { blocking: SampleFile; advisory: SampleFile; tierDisagreements: string[] } {
  const tierDisagreements: string[] = [];
  const blocking: SampledFinding[] = [];
  const advisory: SampledFinding[] = [];
  for (const f of findings) {
    const reportBlocking = blockingByProject.get(f.projectId)?.has(f.ruleId) === true;
    if (reportBlocking !== (f.tier === 'blocking')) tierDisagreements.push(`${f.projectId} ${f.ruleId} report=${reportBlocking ? 'blocking' : 'advisory'} ruleTier=${f.tier}`);
    const item: SampledFinding = { ...f, rule: ruleOf(f), inclusionProbability: 1 };
    if (reportBlocking) blocking.push(item);
    else if (f.violationId !== undefined && advisoryIds.has(`${f.projectId}\u0000${f.violationId}`)) advisory.push(item);
  }
  const file = (items: SampledFinding[], tiers: 'blocking' | 'all'): SampleFile => ({
    schemaVersion: 1, seed: 20261016, cap: Number.MAX_SAFE_INTEGER, tiers, excludedNotApplicable: {}, rules: [], items,
  });
  return { blocking: file(blocking, 'blocking'), advisory: file(advisory, 'all'), tierDisagreements: [...new Set(tierDisagreements)].sort() };
}

export interface GroupRow {
  readonly group: string;
  readonly n: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly notCheckable: number;
  /** correct / (correct + incorrect); null when nothing is checkable. */
  readonly precision: number | null;
  readonly wilsonLow: number | null;
  readonly wilsonHigh: number | null;
  readonly notCheckableShare: number;
}

type Result = Pick<CorrectnessResult, 'verdict'>;

export function groupRows<T extends Result>(results: readonly T[], groupOf: (r: T) => string): GroupRow[] {
  const by = new Map<string, T[]>();
  for (const r of results) by.set(groupOf(r), [...(by.get(groupOf(r)) ?? []), r]);
  return [...by.keys()].sort().map((group) => row(group, by.get(group) ?? []));
}

export function row(group: string, rs: readonly Result[]): GroupRow {
  const correct = rs.filter((r) => r.verdict === 'correct').length;
  const incorrect = rs.filter((r) => r.verdict === 'incorrect').length;
  const checkable = correct + incorrect;
  const ci = checkable > 0 ? wilson(correct, checkable) : null;
  return {
    group, n: rs.length, correct, incorrect, notCheckable: rs.length - checkable,
    precision: checkable > 0 ? correct / checkable : null, wilsonLow: ci?.low ?? null, wilsonHigh: ci?.high ?? null,
    notCheckableShare: rs.length > 0 ? (rs.length - checkable) / rs.length : 0,
  };
}

const pct = (x: number | null): string => (x === null ? 'n/a' : x.toFixed(3));

export function markdownTable(title: string, rows: readonly GroupRow[]): string {
  const head = `| ${title} | n | correct | incorrect | not-checkable | precision | Wilson 95% | not-checkable share |\n|---|---:|---:|---:|---:|---:|---|---:|`;
  const body = rows.map((r) => `| ${r.group} | ${String(r.n)} | ${String(r.correct)} | ${String(r.incorrect)} | ${String(r.notCheckable)} | ${pct(r.precision)} | ${r.wilsonLow === null ? 'n/a' : `[${pct(r.wilsonLow)}, ${pct(r.wilsonHigh)}]`} | ${pct(r.notCheckableShare)} |`);
  return [head, ...body].join('\n');
}
