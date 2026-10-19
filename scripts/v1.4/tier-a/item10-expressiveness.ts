/**
 * v1.4 tier A, item 10: SO1-4 schema "expressiveness" = style-rule source rows expressible in the spec language / all
 * rows, per style (definition from the REV-04 gap review, SO1-4 row).
 *
 * Zero model calls, no Neo4j. Reads:
 * - Docs/v1.3/style-rule-sources.md             (the sealed source table; read, not edited)
 * - Docs/v1.3/style-rule-sources-supplement.md  (rows for rules with no source row)
 * - Docs/v1.3/style-rule-sources-errata.md      (parsed too; it has no Style|Rule|Source|Constraint table)
 * - results/v1.3-validity-convergent/translation-table.json (the 89 rule x style rows the v1.3 presets compile)
 * - src/scoring-engine/rule-tiers.ts (DDD_RULE_TIERS: the sealed DDD row names -> template)
 *
 * Coding rule (mechanical, applied per (row, style) instance):
 *  1. Source rows are the body rows of every markdown table whose header is exactly
 *     "Style | Rule | Source | Constraint (paraphrase)". Other tables (errata corrections, summaries) are not rows.
 *  2. The Style cell is split on commas into styles (Clean -> clean-architecture, NestJS -> nestjs, ...). A
 *     parenthetical "(X: not applied)" makes X an excluded instance: listed, but outside every denominator.
 *  3. The rule a row names is resolved from the Rule cell, in order: (a) every FF id (FF-[A-Z]+[0-9]+); (b) every
 *     template name of the compiled rule set that appears in the cell (longest first); (c) for a DDD row with neither,
 *     the DDD_RULE_TIERS entry whose sealed row name ("DDD <name>") starts with the cell's label, or contains the
 *     cell's parenthetical.
 *  4. An instance is EXPRESSIBLE when (3) resolves at least one token and every token is a rule (by id or template)
 *     that the style's compiled v1.3 preset contains. It is NOT EXPRESSIBLE when nothing resolves (the row names no
 *     rule of the spec language), or when a token is absent from that style's compiled rules.
 *  5. An expressible instance is flagged PARTIAL when the Rule cell says only part of the rule is encoded
 *     ("half only" or "partial"). The primary ratio counts partial as expressible; a strict ratio does not.
 *
 * Writes results/v1.4-tier-a/item10-expressiveness-rows.csv and item10-expressiveness.json. Deterministic.
 *
 * Run: npx tsx scripts/v1.4/tier-a/item10-expressiveness.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DDD_RULE_TIERS } from '../../../src/scoring-engine/rule-tiers.js';
import { wilson } from '../../lib/stats.js';

const FILES = ['Docs/v1.3/style-rule-sources.md', 'Docs/v1.3/style-rule-sources-supplement.md', 'Docs/v1.3/style-rule-sources-errata.md'];
const TT = 'results/v1.3-validity-convergent/translation-table.json';
const OUT = 'results/v1.4-tier-a';
const HEADER = ['Style', 'Rule', 'Source', 'Constraint (paraphrase)'];
const STYLE: Record<string, string> = { clean: 'clean-architecture', layered: 'layered', hexagonal: 'hexagonal', ddd: 'ddd', nestjs: 'nestjs' };
const STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'];

const sha = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex');
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
const cells = (line: string): string[] => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

interface SrcRow { file: string; line: number; style: string; rule: string; source: string; constraint: string }
function parseRows(file: string): SrcRow[] {
  const lines = readFileSync(file, 'utf8').split('\n');
  const out: SrcRow[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? '';
    if (!l.trim().startsWith('|')) continue;
    const h = cells(l);
    if (h.join('|') !== HEADER.join('|')) continue;
    // header found; skip the separator, then read body rows
    for (let j = i + 2; j < lines.length && (lines[j] ?? '').trim().startsWith('|'); j += 1) {
      const c = cells(lines[j] ?? '');
      out.push({ file, line: j + 1, style: c[0] ?? '', rule: c[1] ?? '', source: c[2] ?? '', constraint: c[3] ?? '' });
      i = j;
    }
  }
  return out;
}

const tt = JSON.parse(readFileSync(TT, 'utf8')) as { rows: { style: string; id: string; template: string }[] };
const templates = [...new Set(tt.rows.map((r) => r.template))].sort((a, b) => b.length - a.length || a.localeCompare(b));
const compiled = (style: string) => tt.rows.filter((r) => r.style === style);

function parseStyles(cell: string): { styles: string[]; excluded: { style: string; note: string }[] } {
  const excluded: { style: string; note: string }[] = [];
  const paren = /\(([^)]*)\)/g;
  for (const m of cell.matchAll(paren)) {
    const inner = m[1] ?? '';
    const mm = /^\s*([A-Za-z]+)\s*:\s*(.*)$/.exec(inner);
    if (mm && /not applied/i.test(mm[2] ?? '')) excluded.push({ style: STYLE[(mm[1] ?? '').toLowerCase()] ?? (mm[1] ?? ''), note: inner.trim() });
  }
  const base = cell.replace(paren, '');
  const styles = base.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s !== '').map((s) => {
    const k = STYLE[s]; if (k === undefined) throw new Error(`unknown style label "${s}"`); return k;
  });
  return { styles, excluded };
}

function resolve(rule: string, style: string): { ids: string[]; templates: string[]; via: string } {
  const ids = [...new Set(rule.match(/FF-[A-Z]+\d+/g) ?? [])];
  let rest = rule;
  const tpl: string[] = [];
  for (const t of templates) {
    const re = new RegExp(`(^|[^a-z-])${t.replace(/-/g, '\\-')}(?![a-z-])`);
    if (re.test(rest)) { tpl.push(t); rest = rest.replace(t, ' '); }
  }
  if (ids.length > 0 || tpl.length > 0) return { ids, templates: tpl, via: 'rule cell (FF id / template name)' };
  if (style === 'ddd') {
    const label = rule.replace(/\([^)]*\)/g, '').trim().toLowerCase();
    const parens = [...rule.matchAll(/\(([^)]*)\)/g)].map((m) => (m[1] ?? '').trim().toLowerCase()).filter((x) => x !== '');
    for (const [template, d] of DDD_RULE_TIERS) {
      const name = d.docRow.toLowerCase().replace(/^ddd\s+/, '');
      if (name.startsWith(label) || parens.some((p) => name.includes(p))) {
        return { ids: [], templates: [template], via: `DDD_RULE_TIERS docRow "${d.docRow}"` };
      }
    }
  }
  return { ids: [], templates: [], via: 'nothing resolved' };
}

const srcRows = FILES.flatMap(parseRows);
const instances = srcRows.flatMap((r) => {
  const { styles, excluded } = parseStyles(r.style);
  const partial = /half only|partial/i.test(r.rule);
  const base = { file: r.file, line: r.line, styleCell: r.style, rule: r.rule };
  const inc = styles.map((style) => {
    const res = resolve(r.rule, style);
    const comp = compiled(style);
    const tokens = [...res.ids.map((x) => ({ k: 'id', v: x })), ...res.templates.map((x) => ({ k: 'template', v: x }))];
    const missing = tokens.filter((t) => !comp.some((c) => (t.k === 'id' ? c.id === t.v : c.template === t.v)));
    const matched = comp.filter((c) => res.ids.includes(c.id) || res.templates.includes(c.template)).map((c) => `${c.id} ${c.template}`);
    let code: string; let reason: string;
    if (tokens.length === 0) { code = 'not-expressible'; reason = 'the Rule cell names no rule id or template of the spec language'; }
    else if (missing.length > 0) { code = 'not-expressible'; reason = `not in the ${style} compiled rules: ${missing.map((t) => t.v).join(', ')}`; }
    else if (partial) { code = 'expressible-partial'; reason = 'Rule cell states only part of the rule is encoded'; }
    else { code = 'expressible'; reason = ''; }
    return { ...base, style, code, inDenominator: true, resolvedVia: res.via, tokens: tokens.map((t) => t.v).join(' '), compiledMatch: [...new Set(matched)].join(' | '), reason };
  });
  const exc = excluded.map((e) => ({ ...base, style: e.style, code: 'excluded', inDenominator: false, resolvedVia: '', tokens: '', compiledMatch: '', reason: `style cell says "${e.note}"` }));
  return [...inc, ...exc];
});

const stat = (xs: typeof instances) => {
  const d = xs.filter((x) => x.inDenominator);
  const e = d.filter((x) => x.code.startsWith('expressible')).length;
  const s = d.filter((x) => x.code === 'expressible').length;
  const w = d.length > 0 ? wilson(e, d.length) : undefined;
  const ws = d.length > 0 ? wilson(s, d.length) : undefined;
  return {
    rows: d.length, expressible: e, ratio: d.length > 0 ? r4(e / d.length) : null,
    wilson95: w ? [r4(w.low), r4(w.high)] : null,
    strictExpressible: s, strictRatio: d.length > 0 ? r4(s / d.length) : null, strictWilson95: ws ? [r4(ws.low), r4(ws.high)] : null,
    partial: d.filter((x) => x.code === 'expressible-partial').length,
    notExpressible: d.filter((x) => x.code === 'not-expressible').length,
  };
};

const perStyle = Object.fromEntries(STYLES.map((s) => [s, stat(instances.filter((x) => x.style === s))]));
const perStyleSealedOnly = Object.fromEntries(STYLES.map((s) => [s, stat(instances.filter((x) => x.style === s && x.file === FILES[0]))]));
// Row level: a source row is expressible when every included style instance of it is.
const rowLevel = (file?: string) => {
  const rs = srcRows.filter((r) => file === undefined || r.file === file);
  const ok = rs.filter((r) => instances.filter((x) => x.file === r.file && x.line === r.line && x.inDenominator).every((x) => x.code.startsWith('expressible'))).length;
  const w = wilson(ok, rs.length);
  return { rows: rs.length, expressible: ok, ratio: r4(ok / rs.length), wilson95: [r4(w.low), r4(w.high)] };
};

const out = {
  item: '10',
  question: 'SO1-4 expressiveness: style-rule source rows expressible in the spec language / all rows, per style',
  inputs: [...FILES, TT, 'src/scoring-engine/rule-tiers.ts'].map((p) => ({ path: p, sha256: sha(p) })),
  codingRule: 'see the header comment of scripts/v1.4/tier-a/item10-expressiveness.ts (steps 1-5)',
  sourceRowsPerFile: Object.fromEntries(FILES.map((f) => [f, srcRows.filter((r) => r.file === f).length])),
  instances: instances.length,
  instancesInDenominator: instances.filter((x) => x.inDenominator).length,
  pooled: stat(instances),
  perStyle,
  perStyleSealedTableOnly: perStyleSealedOnly,
  rowLevel: { all: rowLevel(), sealedTable: rowLevel(FILES[0]), supplement: rowLevel(FILES[1]) },
  notExpressible: instances.filter((x) => x.code === 'not-expressible').map((x) => ({ file: x.file, line: x.line, style: x.style, rule: x.rule, reason: x.reason })),
  partial: instances.filter((x) => x.code === 'expressible-partial').map((x) => ({ file: x.file, line: x.line, style: x.style, rule: x.rule })),
  excluded: instances.filter((x) => x.code === 'excluded').map((x) => ({ file: x.file, line: x.line, style: x.style, rule: x.rule, reason: x.reason })),
};

mkdirSync(OUT, { recursive: true });
const cols = ['file', 'line', 'styleCell', 'style', 'rule', 'code', 'inDenominator', 'resolvedVia', 'tokens', 'compiledMatch', 'reason'] as const;
const esc = (v: unknown): string => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
writeFileSync(`${OUT}/item10-expressiveness-rows.csv`, [cols.join(','), ...instances.map((x) => cols.map((c) => esc(x[c])).join(','))].join('\n') + '\n');
writeFileSync(`${OUT}/item10-expressiveness.json`, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ perFile: out.sourceRowsPerFile, pooled: out.pooled, perStyle, rowLevel: out.rowLevel, notExpressible: out.notExpressible, excluded: out.excluded }, null, 1));
