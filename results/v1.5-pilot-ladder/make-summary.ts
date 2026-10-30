/**
 * TRAP-PILOT-v2 ladder summary (zero calls): reads scores/pilot-scores.json and writes summary.json and summary.md
 * (per variant: trap failed /n, functional /n; per level: totals with 95 % Wilson intervals; the band check
 * trap rate 0.4–0.8 with functional >= 0.8, per task and level).
 *   npx tsx results/v1.5-pilot-ladder/make-summary.ts results/v1.5-pilot-ladder
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const dir = process.argv[2] ?? '.';
interface Run { session: string; variant: string; rep: number; complete: boolean; trapFailed: boolean | null; functional: boolean | null; featurePassed: number; featureTotal: number; regressionPassed: number; regressionTotal: number; oracleEvidence: string[]; oracleByStep: { step: string; pass: boolean | null }[]; failedCases: string[] }
const { runs } = JSON.parse(fs.readFileSync(path.join(dir, 'scores', 'pilot-scores.json'), 'utf8')) as { runs: Run[] };

function wilson(k: number, n: number, z = 1.959964): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n; const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d; const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const f2 = (x: number): string => x.toFixed(2);
const variants = [...new Set(runs.map((r) => r.variant))].sort();
const rows = variants.map((v) => {
  const rs = runs.filter((r) => r.variant === v);
  const [task, level] = v.split('/') as [string, string];
  const trap = rs.filter((r) => r.trapFailed === true).length;
  const func = rs.filter((r) => r.functional === true).length;
  const inBand = rs.length > 0 && trap / rs.length >= 0.4 && trap / rs.length <= 0.8 && func / rs.length >= 0.8;
  return { task, level, n: rs.length, trapFailed: trap, functional: func, featureCases: rs.map((r) => `${String(r.featurePassed)}/${String(r.featureTotal)}`), oracleByStep: rs.map((r) => r.oracleByStep.map((o) => (o.pass === null ? '?' : o.pass ? 'p' : 'F')).join('')), inBand, sessions: rs.map((r) => r.session), evidence: rs.map((r) => r.oracleEvidence), failedCases: rs.map((r) => r.failedCases) };
});
const levels = ['L1', 'L2', 'L3'].map((L) => {
  const rs = runs.filter((r) => r.variant.endsWith(`/${L}`));
  const t = rs.filter((r) => r.trapFailed === true).length; const f = rs.filter((r) => r.functional === true).length;
  return { level: L, n: rs.length, trapFailed: t, trapRate: rs.length ? t / rs.length : null, trapWilson95: wilson(t, rs.length), functional: f, functionalRate: rs.length ? f / rs.length : null, functionalWilson95: wilson(f, rs.length) };
});
fs.writeFileSync(path.join(dir, 'summary.json'), `${JSON.stringify({ schema: 'v15-pilot-ladder-summary/v1', rows, levels }, null, 1)}\n`);
const md = ['| Task | Level | Trap failed | Functional | Feature cases | Oracle by step (seed, s1, s2, s3) | In band |', '|---|---|---|---|---|---|---|'];
for (const r of rows) md.push(`| ${r.task} | ${r.level} | ${String(r.trapFailed)}/${String(r.n)} | ${String(r.functional)}/${String(r.n)}${r.functional < r.n ? ' (flag)' : ''} | ${r.featureCases.join(', ')} | ${r.oracleByStep.join(', ')} | ${r.inBand ? 'yes' : 'no'} |`);
md.push('', '| Level | Trap failed | Trap rate (95 % Wilson) | Functional | Functional rate (95 % Wilson) |', '|---|---|---|---|---|');
for (const l of levels) md.push(`| ${l.level} | ${String(l.trapFailed)}/${String(l.n)} | ${f2(l.trapRate ?? 0)} [${f2(l.trapWilson95[0])}, ${f2(l.trapWilson95[1])}] | ${String(l.functional)}/${String(l.n)} | ${f2(l.functionalRate ?? 0)} [${f2(l.functionalWilson95[0])}, ${f2(l.functionalWilson95[1])}] |`);
fs.writeFileSync(path.join(dir, 'summary.md'), `${md.join('\n')}\n`);
process.stdout.write(`${md.join('\n')}\n`);
