/**
 * U4 S3-b (v1.5-exp): the DETECT-02 rules (R1–R3, unchanged, read-only import) on the 13 human DDD repositories under
 * one root condition. Zero model calls.
 *
 *   npx tsx experiments/v15-u4/conditions.ts --clones <dir> --condition declared|inferred
 *   npx tsx experiments/v15-u4/conditions.ts --clones <dir> --condition s3 [--facts results/s3-facts.json]
 *
 * declared: the spec as written. inferred: the same spec without `aggregates` (root inference, R3). s3: the same spec
 * with `aggregates` built from the model's grounded root facts (`s3.ts`); a repository whose spec declares
 * aggregates is the S3-a/b test bed, so its declared block is hidden and replaced, never merged.
 * Writes `results/condition-<name>.json`. Absolute paths never reach the output.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../detect-02/lib/graph.js';
import { repos, treeOf, writeVariant } from './repos.js';
import type { DeclaredAggregate } from './repos.js';

export const HERE = 'experiments/v15-u4';

export interface ConditionRow {
  readonly id: string; readonly rootSource: string; readonly roots: { name: string; file: string; context: string | null }[];
  readonly commands: number; readonly violations: { rule: string; file: string; line: number | null; subject: string; evidence: string }[]; readonly ms: number; readonly error?: string;
}

export async function runCondition(clones: string, condition: string, factsFile?: string): Promise<ConditionRow[]> {
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-u4-'));
  const facts = condition === 's3' ? JSON.parse(fs.readFileSync(factsFile ?? path.join(HERE, 'results', 's3-facts.json'), 'utf8')) as { aggregates: Record<string, DeclaredAggregate[]> } : null;
  const rows: ConditionRow[] = [];
  for (const r of repos()) {
    const tree = treeOf(clones, r);
    const spec = condition === 'declared' ? r.spec : writeVariant(r, scratch, condition, condition === 's3' ? facts!.aggregates[r.id] ?? [] : null);
    try {
      const res = await runTree(tree, rules, { spec, scratch, tsconfig: path.join(tree, r.tsconfig) });
      const vio = res.findings.filter((f) => f.status === 'violation');
      rows.push({
        id: r.id, rootSource: res.facts.rootSource, roots: res.facts.roots.map((x) => ({ name: x.name, file: x.file, context: x.context })), commands: res.facts.commands.length,
        violations: vio.map((f) => ({ rule: f.rule, file: f.file, line: f.line, subject: f.subject, evidence: f.evidence })), ms: res.ms,
      });
      process.stdout.write(`${r.id} [${condition}, roots ${res.facts.rootSource}: ${res.facts.roots.map((x) => x.name).join(',')}]: ${vio.map((f) => `${f.rule}@${f.file}:${String(f.line)} ${f.subject}`).join('; ') || '-'}\n`);
    } catch (e) {
      rows.push({ id: r.id, rootSource: 'error', roots: [], commands: 0, violations: [], ms: 0, error: String(e instanceof Error ? e.message : e).slice(0, 300) });
      process.stdout.write(`${r.id} [${condition}]: ERROR ${String(e).slice(0, 200)}\n`);
    }
  }
  return rows;
}

if (process.argv[1]?.endsWith('conditions.ts')) {
  const argv = process.argv.slice(2);
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const clones = arg('clones'); const condition = arg('condition') ?? 'declared';
  if (clones === undefined) { process.stderr.write('--clones <dir> required\n'); process.exit(2); }
  runCondition(clones, condition, arg('facts')).then((rows) => {
    const scrub = (s: string): string => s.split(path.resolve(clones)).join('<clones>').split(os.tmpdir()).join('<tmp>');
    const summary = { repos: rows.length, withHits: rows.filter((r) => r.violations.length > 0).length, hits: rows.reduce((a, r) => a + r.violations.length, 0), errors: rows.filter((r) => r.error).length };
    fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
    fs.writeFileSync(path.join(HERE, 'results', `condition-${condition}.json`), `${scrub(JSON.stringify({ schema: 'v15-u4-condition-v1', version: 'v1.5-exp', condition, modelCalls: 0, summary, rows }, null, 1))}\n`);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  }, (e: unknown) => { process.stderr.write(`${String(e instanceof Error ? e.stack : e)}\n`); process.exitCode = 1; });
}
