/**
 * v1.3 external set, deterministic correctness: builds the labelling jobs file and the two finding lists the checker
 * reads (Docs/DiagnosticRuns/v1.3-external-correctness-2026-10-16.md). No Neo4j, no model. Entry file: no exports.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/external-correctness-jobs.ts --external <dir> --clones <dir> --out <dir>
 *     --external  a copy of PR #133's results/v1.3-external (selection.json, specs/, findings/, labelling-sheet.csv)
 *     --clones    <clones>/<id> holds each repository checked out at its pinned SHA (selection.json)
 * Writes <out>/jobs.json, <out>/blocking.json (every finding of a rule the report places in its blocking tier) and
 * <out>/advisory.json (the 30 advisory findings #133 drew with seed 20261016, matched by project and violation id).
 * Then: npx tsx scripts/v1.3/check-correct.ts --jobs <out>/jobs.json --sample <out>/blocking.json --out <out>/blocking
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadFindings } from './lib/labelling/findings.js';
import { parseCsv } from './lib/labelling/audit.js';
import { externalJobs, externalSample, reportBlockingRules } from './lib/external-correctness.js';
import type { ExternalEntry, ReportTiers } from './lib/external-correctness.js';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) throw new Error(`--${name} <dir> is required`);
  return v;
}

const external = arg('external');
const clones = arg('clones');
const out = arg('out');
mkdirSync(out, { recursive: true });

const entries = (JSON.parse(readFileSync(join(external, 'selection.json'), 'utf8')) as { entries: ExternalEntry[] }).entries;
const jobs = externalJobs(entries, external, clones);
const missing = jobs.jobs.filter((j) => !existsSync(j.projectRoot)).map((j) => j.projectId);
if (missing.length > 0) throw new Error(`clone(s) missing: ${missing.join(', ')}`);

const blockingByProject = new Map(jobs.jobs.map((j) => [j.projectId, reportBlockingRules(JSON.parse(readFileSync(j.report, 'utf8')) as ReportTiers)]));
const sheet = parseCsv(readFileSync(join(external, 'labelling-sheet.csv'), 'utf8'));
const advisoryIds = new Set(sheet.filter((r) => (r.origin ?? '').startsWith('advisory-sample')).map((r) => `${r.project ?? ''}\u0000${r.findingId ?? ''}`));
const s = externalSample(loadFindings(jobs.jobs), blockingByProject, advisoryIds);
writeFileSync(join(out, 'jobs.json'), `${JSON.stringify(jobs, null, 2)}\n`);
writeFileSync(join(out, 'blocking.json'), `${JSON.stringify(s.blocking, null, 2)}\n`);
writeFileSync(join(out, 'advisory.json'), `${JSON.stringify(s.advisory, null, 2)}\n`);
process.stdout.write(`jobs ${String(jobs.jobs.length)}, blocking ${String(s.blocking.items.length)}, advisory ${String(s.advisory.items.length)} of ${String(advisoryIds.size)}\n`);
for (const d of s.tierDisagreements) process.stdout.write(`tier disagreement: ${d}\n`);
