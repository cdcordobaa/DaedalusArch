/**
 * v1.3 external set, deterministic correctness: the analysis fixed in
 * Docs/DiagnosticRuns/v1.3-external-correctness-2026-10-16.md §2, applied to check-correct's output. No Neo4j, no
 * model. Entry file: no exports.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/external-correctness-summary.ts --dir <out> [--expect-blocking 283]
 * Reads <out>/jobs.json, <out>/blocking/correctness.json and (when present) <out>/advisory/correctness.json; writes
 * <out>/summary.json and <out>/summary.md. Exit 1 when the pass criterion (every blocking finding labelled, with
 * evidence) fails.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CorrectnessResult } from './lib/labelling/correctness.js';
import type { JobsFile } from './lib/labelling/findings.js';
import { groupRows, markdownTable, row } from './lib/external-correctness.js';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : fallback;
  if (v === undefined) throw new Error(`--${name} is required`);
  return v;
}

type R = CorrectnessResult & { rule: string };
const dir = arg('dir');
const expect = Number(arg('expect-blocking', '283'));
const jobs = JSON.parse(readFileSync(join(dir, 'jobs.json'), 'utf8')) as JobsFile;
const styleOf = new Map(jobs.jobs.map((j) => [j.projectId, j.style ?? '?']));
const load = (sub: string): R[] => (JSON.parse(readFileSync(join(dir, sub, 'correctness.json'), 'utf8')) as { results: R[] }).results;
const blocking = load('blocking');
const advisory = existsSync(join(dir, 'advisory', 'correctness.json')) ? load('advisory') : [];

const labelled = blocking.filter((r) => ['correct', 'incorrect', 'not-checkable'].includes(r.verdict) && r.reason !== '');
const withEvidence = blocking.filter((r) => r.verdict === 'not-checkable' || r.checks.length > 0 || r.reason !== '');
const pass = blocking.length === expect && labelled.length === expect && withEvidence.length === expect;
const style = (r: R): string => styleOf.get(r.projectId) ?? '?';

const summary = {
  pass, expectBlocking: expect, blockingChecked: blocking.length, labelled: labelled.length,
  pooled: row('all blocking', blocking),
  perStyle: groupRows(blocking, style),
  perRule: groupRows(blocking, (r) => `${style(r)} ${r.rule}`),
  perTemplate: groupRows(blocking, (r) => r.template),
  perProject: groupRows(blocking, (r) => `${style(r)} ${r.projectId}`),
  notCheckable: blocking.filter((r) => r.verdict === 'not-checkable').map((r) => ({ key: r.key, projectId: r.projectId, rule: r.rule, file: r.file, reason: r.reason })),
  incorrect: blocking.filter((r) => r.verdict === 'incorrect').map((r) => ({ key: r.key, projectId: r.projectId, rule: r.rule, file: r.file, reason: r.reason })),
  advisory: { n: advisory.length, pooled: row('advisory sample', advisory), perRule: groupRows(advisory, (r) => `${style(r)} ${r.rule}`) },
};
writeFileSync(join(dir, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);

const md = [
  `# External set, deterministic correctness: summary`, '',
  `Pass criterion (every one of ${String(expect)} blocking findings labelled with evidence): **${pass ? 'met' : 'NOT met'}** (${String(labelled.length)} labelled of ${String(blocking.length)} checked).`, '',
  '## Blocking findings', '', markdownTable('pooled', [summary.pooled]), '', markdownTable('style', summary.perStyle), '',
  markdownTable('style rule/template', summary.perRule), '', markdownTable('template', summary.perTemplate), '', markdownTable('style project', summary.perProject), '',
  '## Incorrect blocking findings', '', ...(summary.incorrect.length === 0 ? ['None.'] : summary.incorrect.map((r) => `- ${r.projectId} ${r.rule} \`${r.file}\`: ${r.reason}`)), '',
  '## Not-checkable blocking findings', '', ...(summary.notCheckable.length === 0 ? ['None.'] : summary.notCheckable.map((r) => `- ${r.projectId} ${r.rule} \`${r.file}\`: ${r.reason}`)), '',
  '## Advisory sample (secondary)', '', markdownTable('pooled', [summary.advisory.pooled]), '', markdownTable('style rule/template', summary.advisory.perRule), '',
].join('\n');
writeFileSync(join(dir, 'summary.md'), md);
process.stdout.write(`${pass ? 'PASS' : 'FAIL'}: ${String(labelled.length)}/${String(expect)} labelled; pooled precision ${summary.pooled.precision?.toFixed(3) ?? 'n/a'}\n`);
process.exitCode = pass ? 0 : 1;
