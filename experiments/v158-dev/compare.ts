/**
 * V158-DEV: diff two `evaluate.ts` outputs (before = v1.5.7 `main`, after = this branch), per rule and per bucket.
 * Identity of a finding: `rule|file|subject` (as the scorers key it); a change of evidence text alone is counted apart.
 * Buckets: `seeds` (the 11 Hexagonal task seeds), `none` and `combined` (the final step of every counted session, all
 * findings, and the identities new against the task's seed, the way D counts them), and per dev set the clean cases
 * (base, twin, legit and clean labels) and the violation cases.
 * Run: npx tsx experiments/v158-dev/compare.ts <before-hx.json> <before-dev.json> <after-hx.json> <after-dev.json> > result.json
 */
import fs from 'node:fs';

interface Row { group: string; set: string; domain: string; case: string; arm: string | null; label: string; labelRule: string | null; labelFile: string | null; findings: string[] }
const [bh, bd, ah, ad] = process.argv.slice(2);
if (ad === undefined) { process.stderr.write('usage: compare.ts <before-hx> <before-dev> <after-hx> <after-dev>\n'); process.exit(2); }
const read = (f: string): Row[] => (JSON.parse(fs.readFileSync(f, 'utf8')) as { rows: Row[] }).rows;
const before = [...read(bh!), ...read(bd!)];
const after = [...read(ah!), ...read(ad!)];
const key = (r: Row): string => `${r.group}|${r.set}|${r.domain}|${r.case}`;
const bMap = new Map(before.map((r) => [key(r), r]));
const id = (f: string): string => f.split('|').slice(0, 3).join('|');
const ruleOf = (f: string): string => f.split('|')[0]!;
const seedOf = new Map<string, Set<string>>();
for (const r of after) if (r.group === 'hx' && r.case === 'seed') seedOf.set(`a|${r.domain}`, new Set(r.findings.map(id)));
for (const r of before) if (r.group === 'hx' && r.case === 'seed') seedOf.set(`b|${r.domain}`, new Set(r.findings.map(id)));

interface Cell { before: number; after: number; added: string[]; removed: string[]; newVsSeedBefore?: number; newVsSeedAfter?: number; casesChanged: number; evidenceOnly: number }
const table: Record<string, Record<string, Cell>> = {};
const bucketOf = (r: Row): string => {
  if (r.group === 'hx') return r.case === 'seed' ? 'hx:seeds' : `hx:${r.arm ?? '?'}`;
  return `dev:${r.set}:${r.label === 'violation' ? 'violation' : 'clean'}`;
};
const cell = (rule: string, b: string): Cell => {
  table[rule] ??= {};
  return (table[rule]![b] ??= { before: 0, after: 0, added: [], removed: [], casesChanged: 0, evidenceOnly: 0 });
};
if (before.length !== after.length) throw new Error(`row counts differ: ${String(before.length)} vs ${String(after.length)}`);
for (const a of after) {
  const b = bMap.get(key(a));
  if (b === undefined) throw new Error(`no before row for ${key(a)}`);
  const bucket = bucketOf(a);
  const rules = new Set([...a.findings.map(ruleOf), ...b.findings.map(ruleOf)]);
  for (const rule of rules) {
    const bi = new Set(b.findings.filter((f) => ruleOf(f) === rule).map(id));
    const ai = new Set(a.findings.filter((f) => ruleOf(f) === rule).map(id));
    const c = cell(rule, bucket);
    c.before += bi.size; c.after += ai.size;
    const add = [...ai].filter((x) => !bi.has(x)); const rem = [...bi].filter((x) => !ai.has(x));
    for (const x of add) c.added.push(`${a.domain}/${a.case}: ${x.split('|').slice(1).join(' | ')}`);
    for (const x of rem) c.removed.push(`${a.domain}/${a.case}: ${x.split('|').slice(1).join(' | ')}`);
    if (add.length + rem.length > 0) c.casesChanged += 1;
    const be = new Set(b.findings.filter((f) => ruleOf(f) === rule)); const ae = new Set(a.findings.filter((f) => ruleOf(f) === rule));
    if (add.length + rem.length === 0 && [...ae].some((x) => !be.has(x))) c.evidenceOnly += 1;
    if (a.group === 'hx' && a.case !== 'seed') {
      const sb = seedOf.get(`b|${a.domain}`) ?? new Set(); const sa = seedOf.get(`a|${a.domain}`) ?? new Set();
      c.newVsSeedBefore = (c.newVsSeedBefore ?? 0) + [...bi].filter((x) => !sb.has(x)).length;
      c.newVsSeedAfter = (c.newVsSeedAfter ?? 0) + [...ai].filter((x) => !sa.has(x)).length;
    }
  }
}
// Only rules and buckets where something moved are listed in `changed`; `unchanged` names the rest.
const changed: Record<string, Record<string, Cell>> = {};
const unchanged: string[] = [];
for (const [rule, bs] of Object.entries(table).sort()) {
  const moved = Object.fromEntries(Object.entries(bs).filter(([, c]) => c.added.length + c.removed.length + c.evidenceOnly > 0 || c.newVsSeedBefore !== c.newVsSeedAfter).sort());
  if (Object.keys(moved).length > 0) changed[rule] = moved; else unchanged.push(rule);
}
const summary = Object.fromEntries(Object.entries(changed).map(([rule, bs]) => [rule, Object.fromEntries(Object.entries(bs).map(([b, c]) => [b, `+${String(c.added.length)} -${String(c.removed.length)}${c.newVsSeedBefore !== undefined ? ` (new vs seed ${String(c.newVsSeedBefore)} -> ${String(c.newVsSeedAfter)})` : ''}${c.evidenceOnly > 0 ? ` evidence-only ${String(c.evidenceOnly)}` : ''}`]))]));
process.stdout.write(`${JSON.stringify({ modelCalls: 0, rows: after.length, unchangedRules: unchanged, summary, changed }, null, 1)}\n`);
