/**
 * v1.4 TIER-A3, gate line V9: per-rule and per-snapshot agreement from `mcp-fast-vs-full-loop.ts`'s rows. Entry file:
 * no exports. Report: `Docs/DiagnosticRuns/v1.4-ddd-b2-and-v9-2026-10-19.md` §4.
 *
 * Usage (repository root): npx tsx scripts/v1.4/v9-per-rule.ts [--dest results/v1.4-ddd-b2-v9]
 *
 * Reads <dest>/v9/mcp-vs-full.json, writes <dest>/v9/per-rule.json. A rule agrees on a step when it is in both the
 * full evaluation's new blocking findings and the tool's blocking findings, or in neither; locations compare
 * (rule, file) pairs, because the tool reports an import target as the specifier, not the resolved file; a cycle
 * (FF-S02) compares its file set.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

interface F { ruleId: string; file: string; target?: string }
interface Row { config: string; engine: string; style: string; run: string; specVariant: string; step: string; full: { rules: string[]; findings: F[] }; tool: { rules: string[]; findings: F[] } }

const i = process.argv.indexOf('--dest');
const dest = path.resolve(i >= 0 ? process.argv[i + 1] ?? '' : 'results/v1.4-ddd-b2-v9');
const { rows } = JSON.parse(fs.readFileSync(path.join(dest, 'v9', 'mcp-vs-full.json'), 'utf8')) as { rows: Row[] };

const perRule = new Map<string, { config: string; engine: string; style: string; specVariant: string; ruleId: string; steps: number; full: number; tool: number; both: number; fileSetsAgree: number }>();
const perSnapshot: Record<string, unknown>[] = [];
for (const r of rows) {
  const rules = new Set([...r.full.rules, ...r.tool.rules]);
  // A cycle is compared as its file set: the full evaluation reports it as a comma list, the fast path as one row
  // per edge, the interpreter option as one row on its first edge.
  const filesOf = (f: F): string[] => (f.ruleId === 'FF-S02' ? [...f.file.split(','), ...(f.target !== undefined ? [f.target] : [])] : [f.file]);
  const files = (fs_: F[], rule: string): string => [...new Set(fs_.filter((f) => f.ruleId === rule).flatMap(filesOf))].sort().join('|');
  for (const rule of rules) {
    const k = [r.config, r.engine, r.style, r.specVariant, rule].join('\t');
    const e = perRule.get(k) ?? { config: r.config, engine: r.engine, style: r.style, specVariant: r.specVariant, ruleId: rule, steps: 0, full: 0, tool: 0, both: 0, fileSetsAgree: 0 };
    e.steps += 1;
    const inFull = r.full.rules.includes(rule);
    const inTool = r.tool.rules.includes(rule);
    if (inFull) e.full += 1;
    if (inTool) e.tool += 1;
    if (inFull && inTool) e.both += 1;
    if (files(r.full.findings, rule) === files(r.tool.findings, rule)) e.fileSetsAgree += 1;
    perRule.set(k, e);
  }
  perSnapshot.push({
    config: r.config, engine: r.engine, style: r.style, run: r.run, specVariant: r.specVariant, step: r.step,
    fullRules: r.full.rules, toolRules: r.tool.rules,
    rulesAgree: r.full.rules.join() === r.tool.rules.join(),
    fileSetsAgree: [...rules].every((rule) => files(r.full.findings, rule) === files(r.tool.findings, rule)),
  });
}
fs.writeFileSync(path.join(dest, 'v9', 'per-rule.json'), `${JSON.stringify({ perRule: [...perRule.values()], perSnapshot }, null, 1)}\n`);
for (const e of perRule.values()) process.stdout.write(`${JSON.stringify(e)}\n`);
process.stdout.write(`snapshots: ${String(perSnapshot.length)}, rules disagree ${String(perSnapshot.filter((s) => s.rulesAgree !== true).length)}, file sets disagree ${String(perSnapshot.filter((s) => s.fileSetsAgree !== true).length)}\n`);
