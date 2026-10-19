/**
 * v1.4 tier A, item 08: the C3 tool-baseline row of ops/01-instrument-map.md (line 177).
 *
 * Zero model calls, no Neo4j. Reads only committed repository data:
 * - results/v1.3-validity-convergent/translation-table.json  (89 compiled rule x style rows, per-tool expressibility)
 * - results/v1.3-validity-convergent/agreement.json          (per-rule agreement, ours vs each tool, 3 corpora)
 * - results/tool-comparison/recall.csv, recall-dts.csv       (Study 1 seed recall, the source data of N61)
 * - src/scoring-engine/rule-tiers.ts (ruleTier)              (the v1.3 tier of each rule under each style)
 *
 * Writes results/v1.4-tier-a/item08-tool-baseline.csv and item08-tool-baseline.json. Deterministic (no randomness;
 * rows are kept in the order of translation-table.json; JSON keys in insertion order).
 *
 * Run: npx tsx scripts/v1.4/tier-a/item08-tool-baseline.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';

const TT = 'results/v1.3-validity-convergent/translation-table.json';
const AG = 'results/v1.3-validity-convergent/agreement.json';
const RC = 'results/tool-comparison/recall.csv';
const RCD = 'results/tool-comparison/recall-dts.csv';
const OUT = 'results/v1.4-tier-a';

type ToolKey = 'depcruise' | 'boundaries' | 'archunit';
const TOOLS: ToolKey[] = ['depcruise', 'boundaries', 'archunit'];

interface TtRow {
  style: string; id: string; template: string; kind: string | null; view: string | null;
  tools: Record<ToolKey, { translated: boolean; units?: number; reason?: string }>;
}
interface AgRow {
  corpus: string; rule: string; pair: string; projects: number; styles: string;
  both: number; aOnly: number; bOnly: number; neither: number; kappa: number | null;
}

const sha = (p: string): string => createHash('sha256').update(readFileSync(p)).digest('hex');
const tt = JSON.parse(readFileSync(TT, 'utf8')) as { rows: TtRow[]; unexpressible: Record<string, string> };
const ag = JSON.parse(readFileSync(AG, 'utf8')) as { rows: AgRow[]; classCounts: Record<string, Record<string, number>> };

const CORPORA = ['reference', 'external', 'wild'];

/** Parity of ours vs one tool on one rule (rule key = "ID template"), over the three corpora. */
function parity(ruleKey: string, style: string, tool: ToolKey): {
  verdict: string; both: number; oursOnly: number; toolOnly: number; classes: Record<string, number>; detail: string;
} {
  let both = 0, oursOnly = 0, toolOnly = 0;
  const classes: Record<string, number> = {};
  const parts: string[] = [];
  for (const c of CORPORA) {
    const r = ag.rows.find((x) => x.corpus === c && x.rule === ruleKey && x.pair === `ours~${tool}`
      && x.styles.split(' ').includes(style));
    if (r === undefined) { parts.push(`${c}: not in agreement.json`); continue; }
    both += r.both; oursOnly += r.aOnly; toolOnly += r.bOnly;
    parts.push(`${c}: ${r.both}/${r.aOnly}/${r.bOnly} kappa=${r.kappa === null ? 'n/a' : r.kappa.toFixed(3)}`);
    const cc = ag.classCounts[`${c}|${tool}|${ruleKey}`];
    if (cc !== undefined) for (const [k, v] of Object.entries(cc)) classes[k] = (classes[k] ?? 0) + v;
  }
  const dis = oursOnly + toolOnly;
  const classed = Object.values(classes).reduce((a, b) => a + b, 0);
  let verdict: string;
  if (parts.every((p) => p.includes('not in agreement.json'))) verdict = 'no agreement row';
  else if (both + dis === 0) verdict = 'no positives (vacuous)';
  else if (dis === 0) verdict = 'exact parity';
  else if ((classes['our bug'] ?? 0) === 0 && classed === dis) verdict = 'parity up to classified external causes';
  else verdict = 'disagreement not fully classified';
  return { verdict, both, oursOnly, toolOnly, classes, detail: parts.join('; ') };
}

const rows = tt.rows.map((r) => {
  const ruleKey = `${r.id} ${r.template}`;
  const t = ruleTier(r.id, r.style);
  const expressibleBy = TOOLS.filter((k) => r.tools[k].translated);
  const out: Record<string, unknown> = {
    style: r.style, ruleId: r.id, template: r.template, tier: t.tier, tierSource: t.source,
    depcruise: r.tools.depcruise.translated, boundaries: r.tools.boundaries.translated, archunit: r.tools.archunit.translated,
    expressibleByAnyTool: expressibleBy.length > 0,
    // agreement.json pools each rule over every style that compiles it; the parity counts below are those pooled
    // totals (summed over the three corpora), repeated on each style row of the rule, not per-style counts.
    agreementPooledOverStyles: [...new Set(ag.rows.filter((x) => x.rule === ruleKey && x.pair.startsWith('ours~'))
      .flatMap((x) => x.styles.split(' ')))].sort().join(' '),
  };
  for (const k of ['depcruise', 'archunit', 'boundaries'] as ToolKey[]) {
    if (r.tools[k].translated) {
      const p = parity(ruleKey, r.style, k);
      out[`parity_${k}`] = p.verdict;
      out[`shared_${k}`] = p.both; out[`oursOnly_${k}`] = p.oursOnly; out[`toolOnly_${k}`] = p.toolOnly;
      out[`classes_${k}`] = Object.entries(p.classes).map(([a, b]) => `${a}:${b}`).join('|');
      out[`detail_${k}`] = p.detail;
    } else {
      out[`parity_${k}`] = 'not expressible';
      out[`shared_${k}`] = ''; out[`oursOnly_${k}`] = ''; out[`toolOnly_${k}`] = '';
      out[`classes_${k}`] = ''; out[`detail_${k}`] = r.tools[k].reason ?? (tt.unexpressible[r.template] ?? '');
    }
  }
  out.reasonNoTool = expressibleBy.length === 0 ? (tt.unexpressible[r.template] ?? '') : '';
  return out;
});

// --- verification of the map's claim: "4 blocking rules in 7 style rows that no compared tool can express"
const noTool = rows.filter((r) => r.expressibleByAnyTool === false);
const noToolBlocking = noTool.filter((r) => r.tier === 'blocking');
const distinctTemplates = [...new Set(noToolBlocking.map((r) => `${String(r.ruleId)} ${String(r.template)}`))];
const distinctIds = [...new Set(noToolBlocking.map((r) => String(r.ruleId)))];
const distinctNoToolTemplates = [...new Set(noTool.map((r) => String(r.template)))];

// --- blocking rows that ARE expressible in dependency-cruiser and their parity
const blockingDc = rows.filter((r) => r.tier === 'blocking' && r.depcruise === true);
const parityCounts: Record<string, number> = {};
for (const r of blockingDc) parityCounts[String(r.parity_depcruise)] = (parityCounts[String(r.parity_depcruise)] ?? 0) + 1;

// --- "722 shared findings, 0 disagreements" on the import-direction rules (convergent report §4.2 reading)
const IMPORT_DIRECTION = new Set(['FF-S01 dependency-direction', 'FF-S01 dependency-direction-graph', 'FF-S03 no-layer-skip',
  'FF-S03 layer-skip-graph', 'FF-S04 no-domain-outward-dep', 'FF-S04 core-isolation', 'FF-P01 domain-purity',
  'FF-DT04 domain-purity', 'FF-DS02 context-isolation', 'FF-DT01 aggregate-boundary', 'FF-DT02 repository-aggregate-root']);
const idRows = ag.rows.filter((r) => r.pair === 'ours~depcruise' && IMPORT_DIRECTION.has(r.rule));
const idShared = idRows.reduce((a, r) => a + r.both, 0);
const idDis = idRows.reduce((a, r) => a + r.aOnly + r.bOnly, 0);

// --- Study 1 seeds (N61 source): recall.csv (registered) and recall-dts.csv (post-hoc dts variant)
function readCsv(p: string): Record<string, string>[] {
  const [head, ...lines] = readFileSync(p, 'utf8').trim().split('\n');
  const keys = (head ?? '').split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [keys[i] ?? `c${i}`, v])));
}
const seedRows = (p: string) => readCsv(p).filter((r) => r.kind === 'seed').map((r) => ({
  group: r.group, rule: r.rule, n: Number(r.n), ours: Number(r.da_hits), oursCi: r.da_ci95,
  depcruise: Number(r.depcruise_hits), depcruiseCi: r.depcruise_ci95, oursOnly: Number(r.da_only), depcruiseOnly: Number(r.depcruise_only),
}));
const seedsRegistered = seedRows(RC);
const seedsDts = seedRows(RCD);

mkdirSync(OUT, { recursive: true });
const cols = Object.keys(rows[0] ?? {});
const esc = (v: unknown): string => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
writeFileSync(`${OUT}/item08-tool-baseline.csv`, [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n');

const summary = {
  item: '08',
  question: 'C3 tool baseline: parity with dependency-cruiser on shared rules (N61) and blocking rules no compared tool can express',
  inputs: [TT, AG, RC, RCD, 'src/scoring-engine/rule-tiers.ts'].map((p) => ({ path: p, sha256: sha(p) })),
  rowsTotal: rows.length,
  rowsPerStyle: Object.fromEntries([...new Set(rows.map((r) => String(r.style)))].map((s) => [s, rows.filter((r) => r.style === s).length])),
  expressible: Object.fromEntries(TOOLS.map((k) => [k, rows.filter((r) => r[k] === true).length])),
  noToolRows: noTool.length,
  noToolDistinctTemplates: distinctNoToolTemplates.length,
  noToolBlocking: {
    styleRows: noToolBlocking.length,
    distinctRuleTemplates: distinctTemplates.length,
    distinctRuleIds: distinctIds.length,
    rows: noToolBlocking.map((r) => ({ style: r.style, ruleId: r.ruleId, template: r.template, reason: r.reasonNoTool })),
    templates: distinctTemplates,
    ids: distinctIds,
  },
  mapClaimCheck: {
    claim: '4 blocking rules in 7 style rows that no compared tool can express (ops/01-instrument-map.md:177)',
    styleRowsMatch: noToolBlocking.length === 7,
    distinctRuleTemplatesMatch: distinctTemplates.length === 4,
    note: '4 counts distinct rule templates (FF-P03 has two templates: repository-pattern, port-adapter-pattern); distinct rule ids are 3',
  },
  blockingRowsExpressibleInDepcruise: blockingDc.length,
  blockingRowsDepcruiseParity: parityCounts,
  importDirectionRulesOursVsDepcruise: { rules: [...IMPORT_DIRECTION], agreementRows: idRows.length, shared: idShared, disagreements: idDis },
  study1Seeds: {
    note: 'N61 source data (papers/paper2-tool/main.tex:907-915 cites these files). Seeds only; twins omitted.',
    registered: seedsRegistered,
    dtsPostHoc: seedsDts,
  },
};
writeFileSync(`${OUT}/item08-tool-baseline.json`, JSON.stringify(summary, null, 1) + '\n');
console.log(JSON.stringify({ rows: rows.length, noTool: noTool.length, noToolBlocking: noToolBlocking.length, distinctTemplates, distinctIds, parityCounts, idShared, idDis }, null, 1));
