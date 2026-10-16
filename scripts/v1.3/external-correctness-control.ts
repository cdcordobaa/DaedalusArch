/**
 * v1.3 external set, deterministic correctness: the negative control (Docs/DiagnosticRuns/
 * v1.3-external-correctness-2026-10-16.md §1a). Every blocking finding is perturbed so its claim is false
 * (`controlItems`), the checker re-runs on the perturbed findings, and every one must come out `incorrect`.
 * No Neo4j, no model. Entry file: no exports.
 *
 * Usage (repository root): npx tsx scripts/v1.3/external-correctness-control.ts --dir <out>
 * Reads <out>/jobs.json and <out>/blocking.json; writes <out>/control/control.json. Exit 1 when any perturbed
 * finding is not `incorrect`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadJobs } from './lib/labelling/findings.js';
import type { SampleFile } from './lib/labelling/sampler.js';
import { SourceFactsCache } from './lib/labelling/source-facts.js';
import { loadSpecView } from './lib/labelling/spec-facts.js';
import type { SpecView } from './lib/labelling/spec-facts.js';
import { checkFinding } from './lib/labelling/correctness.js';
import { controlItems } from './lib/external-correctness.js';

const i = process.argv.indexOf('--dir');
const dirArg = i >= 0 ? process.argv[i + 1] : undefined;
if (dirArg === undefined) throw new Error('--dir <out> is required');
const dir: string = dirArg;
const jobs = new Map(loadJobs(join(dir, 'jobs.json')).jobs.map((j) => [j.projectId, j]));
const sample = JSON.parse(readFileSync(join(dir, 'blocking.json'), 'utf8')) as SampleFile;
const cache = new SourceFactsCache();
const facts = (p: string): ReturnType<SourceFactsCache['get']> => {
  const j = jobs.get(p);
  if (j === undefined) throw new Error(`no job for ${p}`);
  return cache.get(j.projectRoot, j.tsconfig ?? 'own');
};

async function main(): Promise<number> {
  const specs = new Map<string, SpecView>();
  const results: { kind: string; key: string; projectId: string; rule: string; perturbation: string; verdict: string; reason: string }[] = [];
  const projects = [...new Set(sample.items.map((f) => f.projectId))].sort();
  const skipped: string[] = [];
  for (const p of projects) {
    const job = jobs.get(p);
    if (job === undefined) continue;
    const spec = specs.get(job.spec) ?? await loadSpecView(job.spec);
    specs.set(job.spec, spec);
    const c = controlItems(sample.items.filter((f) => f.projectId === p), facts);
    skipped.push(...c.skipped);
    for (const it of c.items) {
      const r = checkFinding(it.finding, spec, facts(p));
      results.push({ kind: it.kind, key: it.finding.key, projectId: p, rule: it.finding.rule, perturbation: it.perturbation, verdict: r.verdict, reason: r.reason });
    }
  }
  const byKind = Object.fromEntries(['line', 'target', 'cycle'].map((k) => {
    const rs = results.filter((r) => r.kind === k);
    return [k, { n: rs.length, incorrect: rs.filter((r) => r.verdict === 'incorrect').length, correct: rs.filter((r) => r.verdict === 'correct').length, notCheckable: rs.filter((r) => r.verdict === 'not-checkable').length }];
  }));
  const failures = results.filter((r) => r.verdict !== 'incorrect');
  mkdirSync(join(dir, 'control'), { recursive: true });
  writeFileSync(join(dir, 'control', 'control.json'), `${JSON.stringify({ pass: failures.length === 0, byKind, skipped, failures, results }, null, 1)}\n`);
  process.stdout.write(`${failures.length === 0 ? 'PASS' : 'FAIL'}: ${JSON.stringify(byKind)}; skipped ${String(skipped.length)}\n`);
  for (const f of failures) process.stdout.write(`  ${f.kind} ${f.projectId} ${f.rule} ${f.perturbation}: ${f.verdict} (${f.reason})\n`);
  return failures.length === 0 ? 0 : 1;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 2; });
