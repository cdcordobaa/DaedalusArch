#!/usr/bin/env node
// Builds the per-number tables of Docs/v1.3/replication-2.md from the JSON rows of a full run:
//   node replication/v1.3/run.mjs --json rows.json
//   node replication/v1.3/report.mjs rows.json > tables.md
// One table per doc (in doc order, rows by line), then a per-doc tally. Groups that were not run show their status.
import { readFileSync } from 'node:fs';

const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/`/g, '\\`').replace(/</g, '&lt;');
const rep = (s) => ({ PASS: 'yes', FAIL: 'no', KNOWN: 'no', ERROR: 'error', skipped: 'not run' }[s] ?? s);
const docs = [...new Set(rows.map((r) => r.doc))].sort((a, b) => {
  const k = (d) => (d.includes('DiagnosticRuns') ? 0 : 1);
  return k(a) - k(b) || a.localeCompare(b);
});
const tally = (rs) => {
  const c = (f) => rs.filter(f).length;
  return { n: rs.length, yes: c((r) => r.status === 'PASS'), no: c((r) => r.status === 'FAIL' || r.status === 'KNOWN'),
    llm: c((r) => r.status === 'needs-LLM'), neo: c((r) => r.status === 'needs-Neo4j'), ext: c((r) => r.status === 'needs-external'),
    nc: c((r) => r.status === 'not-checkable'), err: c((r) => r.status === 'ERROR' || r.status === 'skipped') };
};
const out = [];
out.push('| Doc | Numbers | yes | no | needs-LLM | needs-Neo4j | needs-external | not-checkable | error / not run |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const d of docs) {
  const t = tally(rows.filter((r) => r.doc === d));
  out.push(`| \`${d.replace(/^Docs\//, '')}\` | ${t.n} | ${t.yes} | ${t.no} | ${t.llm} | ${t.neo} | ${t.ext} | ${t.nc} | ${t.err} |`);
}
const T = tally(rows);
out.push(`| **Total** | **${T.n}** | **${T.yes}** | **${T.no}** | **${T.llm}** | **${T.neo}** | **${T.ext}** | **${T.nc}** | **${T.err}** |`, '');
for (const d of docs) {
  out.push(`### \`${d}\``, '', '| number (as stated) | doc file:line | command | reproduced | difference |', '|---|---|---|---|---|');
  for (const r of rows.filter((x) => x.doc === d).sort((a, b) => a.line - b.line || a.id.localeCompare(b.id))) {
    const diff = r.status === 'PASS' ? '—'
      : (r.status === 'FAIL' || r.status === 'KNOWN') ? `**reproduced ${md(r.actual)}**${r.note ? `. ${md(r.note)}` : ''}`
        : md(r.note);
    out.push(`| ${md(r.what)}: “${md(r.stated)}” <sub>${r.id}</sub> | \`${d.replace(/^Docs\//, '')}:${r.line}\` | ${r.command ? `\`${md(r.command)}\`` : ''} | ${rep(r.status)} | ${diff} |`);
  }
  out.push('');
}
process.stdout.write(`${out.join('\n')}\n`);
