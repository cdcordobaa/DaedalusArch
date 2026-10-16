/**
 * Declared-refactor validity study, step 3: statistics and decision (Docs/DiagnosticRuns/v1.3-validity-refactor-pr-plan.md
 * §5-§7) from the committed selection and run files. Entry file: no exports.
 *
 * Usage (repository root): node --import tsx scripts/v1.3/refactor-pr-report.ts
 * Writes results/v1.3-validity-refactor-pr/{summary.json, tables.md}.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { signTest, wilson } from './lib/fixes-mined.js';
import {
  classifyRefactor, decide, loro, matchedDiff, summarise, withoutLargest, type MatchedObs, type Summary,
} from './lib/refactor-pr.js';

const OUT = path.join(process.cwd(), 'results/v1.3-validity-refactor-pr');
const CYCLE_RULE = 'FF-S02';
const CYCLE_CAP = 100;
const MIN_LAYERED = 0.2;

interface SnapLite { ok: boolean; error?: string; files: number; layered: number; blocking: Record<string, number>; advisory: Record<string, number> }
interface RunFile { commits: Record<string, { parent: SnapLite; child: SnapLite }> }
interface SelCommit { sha: string; parent: string; date: string; kind: string; pr?: number; files: number; lines: number; subject: string; families?: string[]; message?: string; distance?: number }
interface SelFile { id: string; universe: number; eligible: number; declaredRefactors: number; controlPool: number; sets: { refactor: SelCommit; controls: SelCommit[] }[] }

const sum = (r: Record<string, number>): number => Object.values(r).reduce((s, x) => s + x, 0);
const valid = (x: { parent: SnapLite; child: SnapLite } | undefined): boolean =>
  x !== undefined && x.parent.ok && x.child.ok && x.parent.files > 0 && x.parent.layered / x.parent.files >= MIN_LAYERED;

/** Δ of blocking count; FF-S02 dropped from both sides when either side is at the template cap (plan §5). */
function delta(x: { parent: SnapLite; child: SnapLite }, opts: { withoutCycles?: boolean; advisory?: boolean } = {}): number {
  const pick = (s: SnapLite): Record<string, number> => (opts.advisory === true ? s.advisory : s.blocking);
  const capped = (x.parent.blocking[CYCLE_RULE] ?? 0) >= CYCLE_CAP || (x.child.blocking[CYCLE_RULE] ?? 0) >= CYCLE_CAP;
  const count = (s: SnapLite): number => {
    const r = pick(s);
    return sum(r) - ((opts.advisory !== true && (capped || opts.withoutCycles === true)) ? (r[CYCLE_RULE] ?? 0) : 0);
  };
  return count(x.child) - count(x.parent);
}

interface Row {
  repo: string; sha: string; kind: string; pr?: number; families: string[]; subjectHit: boolean; subject: string; date: string;
  files: number; lines: number; parentFiles: number; parentB: number; dR: number; dC: number[];
  dRnoCycle: number; dCnoCycle: number[]; dRadv: number; dCadv: number[]; perRule: Record<string, number>; controlsTotal: number;
}

const fmt = (x: number, d = 2): string => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const pval = (p: number): string => (p < 0.001 ? '<0.001' : p.toFixed(3));

function summaryLine(label: string, s: Summary): string {
  return `| ${label} | ${String(s.n)} | ${String(s.repos)} | ${fmt(s.mean)} [${fmt(s.meanCi.lo)}, ${fmt(s.meanCi.hi)}] | ${fmt(s.median)} [${fmt(s.medianCi.lo)}, ${fmt(s.medianCi.hi)}] | ${String(s.neg)} / ${String(s.pos)} / ${String(s.zero)} | ${fmt(100 * s.negShare.p, 1)}% [${fmt(100 * s.negShare.lo, 1)}, ${fmt(100 * s.negShare.hi, 1)}] | ${pval(s.signP)} |`;
}
const SUMMARY_HEAD = '| set | n | repos | mean d [95% cluster CI] | median d [95% cluster CI] | d<0 / d>0 / d=0 | share d<0 of non-zero [Wilson] | sign test p |\n|---|---:|---:|---|---|---|---|---|';

function main(): void {
  const corpus = (JSON.parse(fs.readFileSync(path.join(OUT, 'corpus.json'), 'utf8')) as { entries: { id: string }[] }).entries;
  const rows: Row[] = [];
  const unmatched: { repo: string; sha: string; subject: string; reason: string }[] = [];
  const perRepo: Record<string, unknown>[] = [];
  let totalControls = 0;
  let validControls = 0;
  for (const { id } of corpus) {
    const selPath = path.join(OUT, 'selection', `${id}.json`);
    if (!fs.existsSync(selPath)) continue;
    const sel = JSON.parse(fs.readFileSync(selPath, 'utf8')) as SelFile;
    const runPath = path.join(OUT, 'runs', `${id}.json`);
    const run: RunFile = fs.existsSync(runPath) ? (JSON.parse(fs.readFileSync(runPath, 'utf8')) as RunFile) : { commits: {} };
    let kept = 0;
    for (const s of sel.sets) {
      const r = s.refactor;
      if (s.controls.length === 0) { unmatched.push({ repo: id, sha: r.sha, subject: r.subject, reason: 'no control inside the caliper' }); continue; }
      const rr = run.commits[r.sha];
      totalControls += s.controls.length;
      const vc = s.controls.filter((c) => valid(run.commits[c.sha]));
      validControls += vc.length;
      if (!valid(rr)) {
        const why = rr === undefined ? 'not run' : !rr.parent.ok || !rr.child.ok ? `snapshot failed (${rr.parent.error ?? rr.child.error ?? ''})` : `layered share ${fmt(rr.parent.layered / rr.parent.files)} < ${String(MIN_LAYERED)}`;
        unmatched.push({ repo: id, sha: r.sha, subject: r.subject, reason: why });
        continue;
      }
      if (vc.length === 0) { unmatched.push({ repo: id, sha: r.sha, subject: r.subject, reason: 'no valid control' }); continue; }
      const x = rr as { parent: SnapLite; child: SnapLite };
      const cs = vc.map((c) => run.commits[c.sha] as { parent: SnapLite; child: SnapLite });
      const perRule: Record<string, number> = {};
      for (const k of new Set([...Object.keys(x.parent.blocking), ...Object.keys(x.child.blocking)])) {
        const d = (x.child.blocking[k] ?? 0) - (x.parent.blocking[k] ?? 0);
        if (d !== 0) perRule[k] = d;
      }
      rows.push({
        repo: id, sha: r.sha, kind: r.kind, ...(r.pr !== undefined && { pr: r.pr }), families: r.families ?? [],
        subjectHit: classifyRefactor(r.subject).families.length > 0, subject: r.subject, date: r.date.slice(0, 10),
        files: r.files, lines: r.lines, parentFiles: x.parent.files, parentB: sum(x.parent.blocking),
        dR: delta(x), dC: cs.map((c) => delta(c)),
        dRnoCycle: delta(x, { withoutCycles: true }), dCnoCycle: cs.map((c) => delta(c, { withoutCycles: true })),
        dRadv: delta(x, { advisory: true }), dCadv: cs.map((c) => delta(c, { advisory: true })),
        perRule, controlsTotal: s.controls.length,
      });
      kept++;
    }
    perRepo.push({ id, universe: sel.universe, eligible: sel.eligible, declared: sel.declaredRefactors, selected: sel.sets.length, matchedValid: kept });
  }

  const obs = (f: (r: Row) => boolean = () => true, pickR: (r: Row) => number = (r) => r.dR, pickC: (r: Row) => number[] = (r) => r.dC): MatchedObs[] =>
    rows.filter(f).map((r) => ({ repo: r.repo, sha: r.sha, dR: pickR(r), dC: pickC(r) }));
  const primary = obs();
  const decision = decide(primary);
  const s = summarise(primary);
  const lo = loro(primary);
  const guard = withoutLargest(primary);
  const gs = summarise(guard.rest);

  const sub = (label: string, o: MatchedObs[]): { label: string; s: Summary } | undefined => (o.length > 0 ? { label, s: summarise(o) } : undefined);
  const descriptive = [
    sub('family A (cycles) present', obs((r) => r.families.includes('A'))),
    sub('families B-G only', obs((r) => !r.families.includes('A'))),
    sub('PR (merge or squash)', obs((r) => r.kind !== 'direct')),
    sub('direct commits', obs((r) => r.kind === 'direct')),
    sub('Δ without FF-S02 (all refactors)', obs(undefined, (r) => r.dRnoCycle, (r) => r.dCnoCycle)),
    sub('Δ per 100 files at P', obs(undefined, (r) => (100 * r.dR) / r.parentFiles, (r) => r.dC.map((d) => (100 * d) / r.parentFiles))),
    sub('advisory Δ (all refactors)', obs(undefined, (r) => r.dRadv, (r) => r.dCadv)),
  ].filter((x) => x !== undefined);
  const posthoc = [
    sub('POST HOC: families A-D only (intrinsic refactor phrases)', obs((r) => r.families.some((f) => 'ABCD'.includes(f)))),
    sub('POST HOC: phrase in the subject line (PR title)', obs((r) => r.subjectHit)),
    sub('POST HOC: A-D and in the subject line', obs((r) => r.subjectHit && classifyRefactor(r.subject).families.some((f) => 'ABCD'.includes(f)))),
  ].filter((x) => x !== undefined);

  // Does the tool register the change at all? Non-zero Δ share, refactors vs controls (post hoc).
  const nzR = rows.filter((r) => r.dR !== 0).length;
  const allC = rows.flatMap((r) => r.dC);
  const nzC = allC.filter((d) => d !== 0).length;
  const absMatched = obs(undefined, (r) => Math.abs(r.dR), (r) => r.dC.map(Math.abs));

  const ruleTotals: Record<string, { refactorSum: number; refactorNonZero: number; controlMeanSum: number }> = {};
  for (const r of rows) {
    for (const [k, d] of Object.entries(r.perRule)) {
      const t = (ruleTotals[k] ??= { refactorSum: 0, refactorNonZero: 0, controlMeanSum: 0 });
      t.refactorSum += d;
      t.refactorNonZero++;
    }
  }

  const tables: string[] = [];
  tables.push('## Primary (plan §6-§7)\n', SUMMARY_HEAD, summaryLine('all matched, valid refactors', s), summaryLine(`one-commit guard (without ${guard.dropped?.repo ?? ''} ${guard.dropped?.sha.slice(0, 10) ?? ''}, d = ${fmt(guard.dropped !== undefined ? matchedDiff(guard.dropped) : Number.NaN)})`, gs), '');
  tables.push(`Decision: **${decision.verdict}**${decision.underpowered ? ' (UNDERPOWERED)' : ''}. Checks: ${Object.entries(decision.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')}.\n`);
  tables.push('## Leave one repository out\n', '| left out | n | mean d | median d | d<0 / d>0 | sign p |', '|---|---:|---:|---:|---|---:|');
  for (const r of lo) tables.push(`| ${r.repo} | ${String(r.n)} | ${fmt(r.mean)} | ${fmt(r.median)} | ${String(r.neg)} / ${String(r.pos)} | ${pval(r.signP)} |`);
  tables.push('', '## Descriptive (plan §6)\n', SUMMARY_HEAD, ...descriptive.map((x) => summaryLine(x.label, x.s)), '');
  tables.push('## Post hoc (not in the plan)\n', SUMMARY_HEAD, ...posthoc.map((x) => summaryLine(x.label, x.s)), summaryLine('POST HOC: |Δ| (does the tool register the change at all?)', summarise(absMatched)), '');
  const wR = wilson(nzR, rows.length);
  const wC = wilson(nzC, allC.length);
  tables.push(`Non-zero blocking Δ: refactors ${String(nzR)}/${String(rows.length)} = ${fmt(100 * wR.p, 1)}% [${fmt(100 * wR.lo, 1)}, ${fmt(100 * wR.hi, 1)}]; controls ${String(nzC)}/${String(allC.length)} = ${fmt(100 * wC.p, 1)}% [${fmt(100 * wC.lo, 1)}, ${fmt(100 * wC.hi, 1)}].\n`);
  const negR = rows.filter((r) => r.dR < 0).length;
  const posR = rows.filter((r) => r.dR > 0).length;
  const negC = allC.filter((d) => d < 0).length;
  const posC = allC.filter((d) => d > 0).length;
  tables.push(`Raw direction: refactors Δ<0 ${String(negR)}, Δ>0 ${String(posR)} (sign p ${pval(signTest(posR, negR + posR))}); controls Δ<0 ${String(negC)}, Δ>0 ${String(posC)} (sign p ${pval(signTest(posC, negC + posC))}).\n`);
  tables.push('## Per repository\n', '| repo | universe | eligible | declared refactors | selected (cap 10) | matched and valid |', '|---|---:|---:|---:|---:|---:|');
  for (const r of perRepo) tables.push(`| ${String(r.id)} | ${String(r.universe)} | ${String(r.eligible)} | ${String(r.declared)} | ${String(r.selected)} | ${String(r.matchedValid)} |`);
  tables.push('', '## Blocking rules that moved across refactors\n', '| rule | refactors with a change | net Δ over refactors |', '|---|---:|---:|');
  for (const [k, t] of Object.entries(ruleTotals).sort()) tables.push(`| ${k} | ${String(t.refactorNonZero)} | ${String(t.refactorSum)} |`);
  tables.push('', '## Every matched refactor\n', '| repo | commit | kind | families | files / lines | P files | B at P | Δ refactor | Δ controls | d | subject |', '|---|---|---|---|---|---:|---:|---:|---|---:|---|');
  for (const r of rows) {
    tables.push(`| ${r.repo} | ${r.sha.slice(0, 10)} | ${r.kind}${r.pr !== undefined ? ` #${String(r.pr)}` : ''} | ${r.families.join('')} | ${String(r.files)} / ${String(r.lines)} | ${String(r.parentFiles)} | ${String(r.parentB)} | ${String(r.dR)} | ${r.dC.join(', ')} | ${fmt(matchedDiff({ repo: r.repo, sha: r.sha, dR: r.dR, dC: r.dC }))} | ${r.subject.replace(/\|/g, '\\|').slice(0, 90)} |`);
  }
  tables.push('', '## Excluded refactors\n', '| repo | commit | reason | subject |', '|---|---|---|---|');
  for (const u of unmatched) tables.push(`| ${u.repo} | ${u.sha.slice(0, 10)} | ${u.reason} | ${u.subject.replace(/\|/g, '\\|').slice(0, 90)} |`);
  fs.writeFileSync(path.join(OUT, 'tables.md'), tables.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({
    decision, primary: s, guard: { dropped: guard.dropped, summary: gs }, loro: lo,
    descriptive, posthoc, absMatched: summarise(absMatched),
    nonZero: { refactors: [nzR, rows.length], controls: [nzC, allC.length] },
    controls: { selected: totalControls, valid: validControls },
    ruleTotals, perRepo, rows, excluded: unmatched,
  }, null, 1) + '\n');
  process.stdout.write(tables.slice(0, 8).join('\n') + '\n');
}

main();
