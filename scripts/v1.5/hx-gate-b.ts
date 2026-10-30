/**
 * Hexagonal study, gate (b) check (pre-registration §5.1, B10), zero calls: for every `combined` session, the
 * scorer's symbolic findings per step snapshot (the tree of the turn's last push) against the hub checks that
 * `session.json` records (`deliveryAudit`). Logic and the documented differences: `lib/hx-gate-b.ts`.
 *
 *   npx tsx scripts/v1.5/hx-gate-b.ts --results <outRoot> [--scores <scores.json>] [--hub <dir>] [--json <out.json>]
 *
 * `--scores` defaults to `<results>/scores/scores.json`, written by `score-study.ts` with `--counted hx-i|hx-ii` (only
 * that mode records the per-step `treeDigest` and `symbolicNewVsSeed`). `--hub` (default `<results>/hub`) is read for
 * the push log only, to name the pushes on each tree. Prints one line per step; exit 0 when the gate passes, 1 on
 * any missing counted finding or a `combined` session without a delivery audit, 2 on a usage or input error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { gateBReport, gateBSession, type HubCheck, type PushLine, type ScoredStep } from './lib/hx-gate-b';

interface ScoresRun { readonly session: string; readonly arm: string; readonly task: string; readonly steps: readonly Partial<ScoredStep>[] }

function main(argv: readonly string[]): number {
  const argOf = (k: string): string | undefined => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const results = argOf('--results');
  if (results === undefined) { process.stderr.write('usage: hx-gate-b.ts --results <outRoot> [--scores <scores.json>] [--hub <dir>] [--json <out.json>]\n'); return 2; }
  const scoresFile = argOf('--scores') ?? path.join(results, 'scores', 'scores.json');
  const hubDir = argOf('--hub') ?? path.join(results, 'hub');
  if (!fs.existsSync(scoresFile)) { process.stderr.write(`no scores file ${scoresFile}\n`); return 2; }
  const scores = JSON.parse(fs.readFileSync(scoresFile, 'utf8')) as { params?: { counted?: unknown }; runs: readonly ScoresRun[] };
  const combined = scores.runs.filter((r) => r.arm === 'combined');
  const sessions = [];
  for (const run of combined) {
    const steps = run.steps.filter((s) => s.step !== 'step-00');
    if (steps.some((s) => s.treeDigest === undefined || s.symbolicNewVsSeed === undefined)) {
      process.stderr.write(`${run.session}: the scores lack treeDigest / symbolicNewVsSeed; score with --counted hx-i|hx-ii\n`);
      return 2;
    }
    const sessFile = path.join(results, 'sessions', run.session, 'session.json');
    if (!fs.existsSync(sessFile)) { process.stderr.write(`no ${sessFile}\n`); return 2; }
    const records = (JSON.parse(fs.readFileSync(sessFile, 'utf8')) as { deliveryAudit?: HubCheck[] }).deliveryAudit;
    const pushFile = path.join(hubDir, `${run.session}.push.jsonl`);
    const pushes = fs.existsSync(pushFile) ? fs.readFileSync(pushFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as PushLine) : [];
    const g = gateBSession(run.session, records, steps.map((s) => ({ step: s.step!, treeDigest: s.treeDigest!, symbolicNewVsSeed: s.symbolicNewVsSeed!, evasionCandidates: s.evasionCandidates ?? [] })), pushes);
    sessions.push(g);
    if (!g.auditPresent) { process.stdout.write(`${run.session} ${run.task}: NO DELIVERY AUDIT in session.json\n`); continue; }
    for (const s of g.steps) {
      process.stdout.write(`${run.session} ${run.task} ${s.step} tree ${s.treeDigest} checks [${s.checks.join(',')}] pushes [${s.pushes.join('; ')}]: ${s.status} (${String(s.compared)} counted compared, ${String(s.missing.length)} missing${s.frozenLineDiffers.length > 0 ? `, ${String(s.frozenLineDiffers.length)} frozen line differs` : ''}${s.missingUncounted.length > 0 ? `, ${String(s.missingUncounted.length)} uncounted not in the hub` : ''})${s.reason !== null ? ` ${s.reason}` : ''}\n`);
      for (const m of s.missing) process.stdout.write(`  missing ${m}\n`);
      for (const e of s.evasion) process.stdout.write(`  evasion ${e}\n`);
    }
  }
  const report = gateBReport(sessions);
  const json = argOf('--json');
  if (json !== undefined) { fs.mkdirSync(path.dirname(path.resolve(json)), { recursive: true }); fs.writeFileSync(json, `${JSON.stringify({ ...report, counted: scores.params?.counted ?? null }, null, 1)}\n`); }
  const t = report.totals;
  process.stdout.write(`gate (b): ${report.pass ? 'PASS' : 'FAIL'}: ${String(t.sessions)} combined sessions, ${String(t.steps)} steps: ${String(t.agree)} agree, ${String(t.nothingNew)} nothing new, ${String(t.notComparable)} not comparable (evasion, hand read), ${String(t.missing)} missing, ${String(t.noAudit)} without audit\n`);
  return report.pass ? 0 : 1;
}

if (process.argv[1]?.endsWith('hx-gate-b.ts') === true) process.exitCode = main(process.argv.slice(2));
export { main };
