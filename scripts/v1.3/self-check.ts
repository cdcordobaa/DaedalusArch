/**
 * Self-check (`npm run self-check`, `Docs/v1.3/dogfood.md`): DaedalusArch evaluates its own `src/` against the
 * post-triage spec `specs/dogfood/daedalus-self.revised.yaml` (the declared spec plus the edges the triage found the
 * declared spec too strict on), symbolic only, on the in-process Cypher engine (no Neo4j, no LLM, no
 * secrets), and gates on the defining rules.
 *
 * The known debt is the committed list `specs/dogfood/known-findings.json` (the real-debt rows of the triage). A finding of a gated rule that is not on
 * the list fails the check (exit 1); a listed finding that is gone is reported as fixed (remove it with `--update`).
 * Findings are keyed by rule, source file, target file and discriminator, not by line, so moving code does not churn
 * the list but a new import from an already-listed file to a new target does fail. (The CLI `--baseline` keys on rule,
 * file and violation type only, which would hide such an import; see dogfood.md, lesson L5.)
 *
 * Usage (repository root): npm run self-check [-- --update] [-- --report <out.json>]
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SPEC = 'specs/dogfood/daedalus-self.revised.yaml';
const KNOWN = 'specs/dogfood/known-findings.json';
/** The defining rules of the declared spec (blocking tier, plus layer-skip-graph: an undeclared module coupling). */
const GATED = ['FF-S01', 'FF-S02', 'FF-S03', 'FF-S04', 'FF-P01', 'FF-P03', 'FF-P06'];

interface Violation { functionId: string; filePath: string; target?: string; discriminator?: string[]; message: string; line?: number }
interface Report { verdict: string; violations: Violation[]; tiers?: { verdict?: string } }

const argv = process.argv.slice(2);
const update = argv.includes('--update');
const reportIdx = argv.indexOf('--report');
const reportOut = reportIdx >= 0 ? argv[reportIdx + 1] : undefined;

const keyOf = (v: Violation): string => [v.functionId, v.filePath, v.target ?? '', (v.discriminator ?? []).join(',')].join(' | ');

function main(): number {
  const run = spawnSync(process.execPath, [
    '--import', 'tsx', 'bin/firewall.ts', 'evaluate', '--project', '.', '--spec', SPEC,
    '--symbolic-only', '--engine', 'cypher-interp', '--format', 'json',
  ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  // Exit 1 is the tool's "verdict fail"; anything above is a run error.
  if (run.status === null || run.status > 1 || run.stdout.trim() === '') {
    process.stderr.write(`self-check: evaluate failed (exit ${String(run.status)})\n${run.stderr}\n`);
    return 2;
  }
  if (reportOut !== undefined) fs.writeFileSync(reportOut, run.stdout);
  const report = JSON.parse(run.stdout) as Report;
  const current = new Map(report.violations.filter((v) => GATED.includes(v.functionId)).map((v) => [keyOf(v), v]));

  if (update) {
    fs.writeFileSync(path.resolve(KNOWN), `${JSON.stringify({ spec: SPEC, gatedRules: GATED, findings: [...current.keys()].sort() }, null, 1)}\n`);
    process.stdout.write(`self-check: wrote ${String(current.size)} known findings to ${KNOWN}\n`);
    return 0;
  }
  const known = new Set((JSON.parse(fs.readFileSync(KNOWN, 'utf8')) as { findings: string[] }).findings);
  const added = [...current.entries()].filter(([k]) => !known.has(k));
  const fixed = [...known].filter((k) => !current.has(k));
  process.stdout.write(`self-check: tool verdict ${report.tiers?.verdict ?? report.verdict}; ${String(current.size)} defining-rule findings, ${String(known.size)} known, ${String(added.length)} new, ${String(fixed.length)} fixed\n`);
  for (const k of fixed) process.stdout.write(`  fixed (remove with --update): ${k}\n`);
  for (const [, v] of added) process.stdout.write(`  NEW ${v.functionId} ${v.filePath}${v.line !== undefined ? `:${String(v.line)}` : ''}: ${v.message}\n`);
  return added.length === 0 ? 0 : 1;
}

process.exitCode = main();
