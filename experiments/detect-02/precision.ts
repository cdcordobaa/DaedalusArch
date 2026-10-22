/**
 * DETECT-02 precision fixtures (V15-PLAN §1, `ops/notes/detect-02-precision-note.md`), zero model calls.
 *
 *   npx tsx experiments/detect-02/precision.ts [--out precision]   # → results/<out>.json
 *
 * Every fixture under `fixtures/precision/<pattern>/` has a DDD `spec.yaml`, a `legit` tree (a correct DDD pattern
 * that looks like a violation) and, where meaningful, a `positive` twin (the same code with a real violation). Each tree
 * runs twice: `declared` (the spec as written) and `fallback` (the same spec without `aggregates`, so roots are inferred,
 * as on human repositories that declare none). Pass: no violation on a legit tree (the declared batch reports
 * `allowed`), and the expected rules on every positive twin.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { loadRules, runTree } from './lib/graph.js';

const HERE = 'experiments/detect-02';
const FX = path.join(HERE, 'fixtures/precision');

interface Meta { pattern: string; legit: string; positive: string | null; expectLegit?: 'allowed'; expectPositive?: string[]; note: string }

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const out = argv[argv.indexOf('--out') + 1] && argv.includes('--out') ? argv[argv.indexOf('--out') + 1]! : 'precision';
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-02-prec-'));
  const rows: Record<string, unknown>[] = [];
  let fails = 0;
  for (const d of fs.readdirSync(FX).sort()) {
    const meta = JSON.parse(fs.readFileSync(path.join(FX, d, 'fixture.json'), 'utf8')) as Meta;
    const specPath = path.join(FX, d, 'spec.yaml');
    const doc = YAML.parse(fs.readFileSync(specPath, 'utf8')) as { architecture: { ddd: Record<string, unknown> } };
    delete doc.architecture.ddd.aggregates;
    const fallbackSpec = path.join(scratch, `${d}.fallback.yaml`);
    fs.writeFileSync(fallbackSpec, YAML.stringify(doc));
    for (const [variant, tree] of [['legit', meta.legit], ['positive', meta.positive]] as const) {
      if (tree === null) continue;
      for (const [condition, spec] of [['declared', specPath], ['fallback', fallbackSpec]] as const) {
        const r = await runTree(path.join(FX, d, tree), rules, { spec, scratch });
        const vio = r.findings.filter((f) => f.status === 'violation');
        const allowed = r.findings.filter((f) => f.status === 'allowed');
        let pass: boolean;
        if (variant === 'legit') pass = vio.length === 0 && (meta.expectLegit !== 'allowed' || allowed.length > 0);
        else pass = (meta.expectPositive ?? []).every((id) => vio.some((f) => f.rule === id));
        if (!pass) fails++;
        rows.push({
          pattern: meta.pattern, fixture: d, variant, condition, pass, rootSource: r.facts.rootSource, roots: r.facts.roots.map((x) => x.name),
          violations: vio.map((f) => ({ rule: f.rule, file: f.file, line: f.line, subject: f.subject, evidence: f.evidence })),
          allowed: allowed.map((f) => ({ rule: f.rule, file: f.file, line: f.line, subject: f.subject })),
          info: r.findings.filter((f) => f.status === 'info').length,
        });
        process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${meta.pattern} ${variant}/${condition} [roots ${r.facts.rootSource}: ${r.facts.roots.map((x) => x.name).join(',')}]: ${vio.map((f) => `${f.rule}@${f.file}:${f.line} (${f.evidence})`).join('; ') || '-'}${allowed.length ? `  allowed ${allowed.map((f) => f.rule).join(',')}` : ''}\n`);
      }
    }
  }
  const legit = rows.filter((r) => r.variant === 'legit');
  const pos = rows.filter((r) => r.variant === 'positive');
  const summary = {
    legitRuns: legit.length, legitFalsePositiveRuns: legit.filter((r) => (r.violations as unknown[]).length > 0).length,
    positiveRuns: pos.length, positiveFlagged: pos.filter((r) => r.pass).length, fails,
  };
  fs.writeFileSync(path.join(HERE, 'results', `${out}.json`), `${JSON.stringify({ schema: 'detect-02-precision-v1', version: 'v1.5-exp', split: 'dev', modelCalls: 0, summary, rows }, null, 1)}\n`);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return 0;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${String(e instanceof Error ? e.stack : e)}\n`); process.exitCode = 1; });
