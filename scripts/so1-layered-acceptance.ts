/**
 * FR-v1.2E-20 layered acceptance producer (ADR-021 SO1-B). Rule in `scripts/lib/layered-acceptance.ts`.
 *
 * Reads the report of one `evaluate --symbolic-only --format json` run of a `layered` corpus project, checks it
 * (BR-U5b-45 acceptance, I1/I2, executed = compiled − skippedByMode, no failure) and writes
 * `results/pre-tag/layered-<sha>.json` (summary) and `results/pre-tag/layered-<sha>.report.json` (the report, scrubbed,
 * `projectPath` made corpus-relative). `<sha>` is the tool commit of the run (12 hex digits).
 * Usage: npx tsx scripts/so1-layered-acceptance-cli.ts --report <file> --project <corpus name> [--out-dir <dir>]
 *        [--tool-commit <sha>] | --self-test
 * Exit: 0 written and accepted; 1 written but not accepted, or `--self-test` saw its known-bad report refused;
 * 2 usage or IO error.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EvaluationReport } from '../src/shared/types/evaluation.js';
import { canonicalize } from './lib/canonical-json.js';
import { CORPUS_FILE, loadCorpus, sha256Hex } from './lib/corpus.js';
import { layeredAcceptance } from './lib/layered-acceptance.js';
import type { LayeredAcceptance } from './lib/layered-acceptance.js';
import { acceptReport, knownSecretsOf, scrubbedJson } from './lib/report-io.js';

export const LAYERED_USAGE = 'usage: npx tsx scripts/so1-layered-acceptance-cli.ts --report <file> --project <corpus name> [--out-dir <dir>] [--tool-commit <sha>] | --self-test';
export const PRE_TAG_DIR = 'results/pre-tag';

export interface LayeredMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (file: string, text: string) => void;
  readonly env: NodeJS.ProcessEnv;
}

/** Known-bad input of `--self-test`: a symbolic-only report with one failed compiled function. */
export const SELF_TEST_REPORT = {
  runId: 'self-test', evaluationMode: 'symbolic-only', verdict: 'pass', ahsDeterministic: 1, violations: [],
  disabledFunctions: [],
  functionExecution: { declared: 2, adrDerived: 0, compiled: 2, disabled: 0, dropped: [], skippedByMode: 0, noJudgeUnits: [], executed: 1, failed: [{ functionId: 'FF-S01', name: 'x', code: 'EVAL_001', message: 'x' }] },
} as unknown as EvaluationReport;

function commitOf(repoRoot: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().slice(0, 12);
}

/** The report with `projectPath` replaced by its corpus-relative form (no absolute path in a committed artefact). */
export function relativiseReport(report: EvaluationReport, projectId: string): EvaluationReport {
  return { ...report, projectPath: `../daedalus-corpus/${projectId}` };
}

export function main(argv: readonly string[], repoRoot: string, io: LayeredMainIo): number {
  const opt = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--self-test') {
      const r = layeredAcceptance(SELF_TEST_REPORT, {
        projectId: 'self-test', originUrl: '', projectCommit: '', style: 'layered', specPath: '', specSha256: '', toolCommit: '', command: '', rejection: null,
      });
      if (!r.accepted) {
        io.out(`self-test: the known-bad report was refused (expected exit 1): ${r.problems.join('; ')}\n`);
        return 1;
      }
      io.err('self-test: the known-bad report was ACCEPTED\n');
      return 0;
    }
    if (['--report', '--project', '--out-dir', '--tool-commit'].includes(a) && argv[i + 1] !== undefined) opt.set(a, argv[++i] ?? '');
    else {
      io.err(`${LAYERED_USAGE}\n`);
      return 2;
    }
  }
  const reportFile = opt.get('--report');
  const projectId = opt.get('--project');
  if (reportFile === undefined || projectId === undefined) {
    io.err(`${LAYERED_USAGE}\n`);
    return 2;
  }
  const corpus = loadCorpus(join(repoRoot, CORPUS_FILE), repoRoot);
  if (!corpus.ok) {
    io.err(`${CORPUS_FILE}: ${corpus.errors.join('; ')}\n`);
    return 2;
  }
  const entry = corpus.corpus.entries.find((e) => e.name === projectId);
  if (entry === undefined) {
    io.err(`no corpus entry ${projectId}\n`);
    return 2;
  }
  let raw: unknown;
  let specText: string;
  try {
    raw = JSON.parse(readFileSync(resolve(repoRoot, reportFile), 'utf8')) as unknown;
    specText = readFileSync(join(repoRoot, entry.specPath), 'utf8');
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  const accepted = acceptReport(raw);
  const toolCommit = opt.get('--tool-commit') ?? commitOf(repoRoot);
  const report = relativiseReport(raw as EvaluationReport, projectId);
  const secrets = knownSecretsOf(io.env);
  const reportText = canonicalize(scrubbedJson(report, secrets));
  const outDir = resolve(repoRoot, opt.get('--out-dir') ?? PRE_TAG_DIR);
  const base = `layered-${toolCommit}`;
  const summary: LayeredAcceptance & { readonly reportFile: string; readonly reportSha256: string } = {
    ...layeredAcceptance(report, {
      projectId, originUrl: entry.originUrl, projectCommit: entry.commitSha, style: entry.style ?? 'none', specPath: entry.specPath,
      specSha256: sha256Hex(specText), toolCommit,
      command: `NEO4J_PASSWORD=*** npx tsx bin/firewall.ts evaluate --project ../daedalus-corpus/${projectId} --spec ${entry.specPath} --symbolic-only --format json`,
      rejection: accepted.accepted ? null : `${accepted.reasonCode}: ${accepted.reasonDetail}`,
    }),
    reportFile: `${base}.report.json`,
    reportSha256: sha256Hex(reportText),
  };
  io.writeFile(join(outDir, `${base}.report.json`), reportText);
  io.writeFile(join(outDir, `${base}.json`), canonicalize(scrubbedJson(summary, secrets)));
  const c = summary.counts;
  io.out(`layered acceptance ${projectId}: declared ${String(c.declared)}, compiled ${String(c.compiled)}, disabled ${String(c.disabled)}, skipped by mode ${String(c.skippedByMode)}, executed ${String(c.executed)}, failed ${String(c.failed)}; ${summary.accepted ? 'accepted' : `NOT accepted: ${summary.problems.join('; ')}`}\n`);
  return summary.accepted ? 0 : 1;
}
