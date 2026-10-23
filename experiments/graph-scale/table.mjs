// GRAPH-SCALE (v1.5-exp): before/after tables from results/{before,after}-<repo>.json. Zero model calls.
// Usage: node experiments/graph-scale/table.mjs [results-dir]  → markdown on stdout, results/summary.json
import * as fs from 'node:fs';
import * as path from 'node:path';

const dir = process.argv[2] ?? 'experiments/graph-scale/results';
const repos = ['backstage', 'novu', 'medusa'];
const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`);
const rp = (a) => (a === undefined || a === null ? 'n/a' : typeof a === 'string' ? 'n/a' : a.error ? 'error' : `${pct(a.recall)} / ${pct(a.precision)}`);
const summary = {};
const lines = [];
for (const r of repos) {
  const f = (k) => path.join(dir, `${k}-${r}.json`);
  if (!fs.existsSync(f('before')) || !fs.existsSync(f('after'))) continue;
  const B = JSON.parse(fs.readFileSync(f('before'), 'utf8'));
  const A = JSON.parse(fs.readFileSync(f('after'), 'utf8'));
  lines.push(`\n**${r}** (index build ${(B.index.buildMs / 1000).toFixed(1)} s → ${(A.index.buildMs / 1000).toFixed(1)} s; units ${B.index.units} → ${A.index.units}; call edges ${B.index.callEdges} → ${A.index.callEdges}; member calls ${A.index.memberCalls}; inferred entities ${A.index.entities}; import-type edges ${A.index.importTypeEdges})\n`);
  lines.push('| Item | Truth sites / units / files | index sites, resolved edges (before → after) | index units | callers sites (after) | callers units | callers files | who_writes sites (before → after) | who_writes units | impact command files (before → after) |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  summary[r] = { before: B.index, after: A.index, questions: {} };
  for (const qa of A.questions) {
    const qb = B.questions.find((x) => x.id === qa.id);
    const t = qa.truth;
    const ww = (q) => (q?.who_writes === undefined ? undefined : q.who_writes.error ? { error: q.who_writes.error } : q.who_writes.sites);
    const wu = (q) => (q?.who_writes === undefined ? undefined : q.who_writes.error ? { error: q.who_writes.error } : q.who_writes.units);
    const imp = (q) => q?.impact?.commandFiles;
    const cell = (b, a) => (b === undefined && a === undefined ? '–' : `${rp(b)} → ${rp(a)}`);
    lines.push(`| ${qa.id} | ${t.sites} / ${t.units} / ${t.files} | ${cell(qb?.index.edgesOnly.sites, qa.index.edgesOnly.sites)} | ${cell(qb?.index.edgesOnly.units, qa.index.edgesOnly.units)} | ${qa.kind === 'crossCalls' ? '–' : rp(qa.callers?.sites)} | ${qa.kind === 'crossCalls' ? '–' : rp(qa.callers?.units)} | ${qa.kind === 'crossCalls' ? '–' : rp(qa.callers?.files)} | ${cell(ww(qb), ww(qa))} | ${cell(wu(qb), wu(qa))} | ${cell(imp(qb), imp(qa))} |`);
    summary[r].questions[qa.id] = { truth: t, before: { index: qb?.index, who_writes: qb?.who_writes, impact: qb?.impact }, after: { index: qa.index, callers: qa.callers, who_writes: qa.who_writes, impact: qa.impact } };
  }
}
fs.writeFileSync(path.join(dir, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);
process.stdout.write(`${lines.join('\n')}\n`);
