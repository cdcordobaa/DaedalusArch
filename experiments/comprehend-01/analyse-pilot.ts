/**
 * COMPREHEND-01 pilot analysis (zero model calls): reads the pilot ledger and the bank, and writes
 * `results/pilot/analysis.json` with accuracy per arm and question type, tokens, tool calls, wall time, graph use,
 * and the token ratio and accuracy difference per tree group (design §9, PR1–PR6).
 *   npx tsx experiments/comprehend-01/analyse-pilot.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HERE, loadBank, loadTrees } from './lib/bank.js';
import type { LedgerRow } from './run.js';

const DIR = path.join(HERE, 'results', 'pilot');
const rows = fs.readFileSync(path.join(DIR, 'ledger.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as LedgerRow);
const final = new Map<string, LedgerRow>();
for (const r of rows) final.set(r.sessionId, r);
const pilot = [...final.values()].filter((r) => r.block === 'pilot' && r.valid);
const kind = new Map(loadTrees().map((t) => [t.id, t.kind] as const));
const group = (r: LedgerRow): string => (kind.get(r.tree) === 'human-ddd' ? 'human' : 'small');

const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const mean = (xs: number[]): number | null => (xs.length ? r3(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : r3((s[m - 1]! + s[m]!) / 2);
};
const stats = (g: LedgerRow[]) => ({
  n: g.length,
  accuracy: mean(g.map((r) => r.primary)), secondary: mean(g.map((r) => r.secondary)),
  tokensMean: mean(g.map((r) => r.processedTokens)), tokensMedian: median(g.map((r) => r.processedTokens)),
  outputTokensMean: mean(g.map((r) => r.outputTokens)),
  toolCallsMean: mean(g.map((r) => r.toolCalls)), graphCallsMean: mean(g.map((r) => r.graphCalls)),
  wallMsMean: mean(g.map((r) => r.wallMs)), wallMsMedian: median(g.map((r) => r.wallMs)),
  turnsMean: mean(g.map((r) => r.turns ?? 0)),
});
const byArm = (g: LedgerRow[]) => ({ F: stats(g.filter((r) => r.arm === 'F')), FG: stats(g.filter((r) => r.arm === 'FG')) });
const split = (f: (r: LedgerRow) => string) => Object.fromEntries([...new Set(pilot.map(f))].sort().map((k) => [k, byArm(pilot.filter((r) => f(r) === k))]));

const pairs = [...new Set(pilot.map((r) => r.item!))].map((i) => ({ f: pilot.find((r) => r.item === i && r.arm === 'F')!, g: pilot.find((r) => r.item === i && r.arm === 'FG')! })).filter((p) => p.f && p.g);
const paired = (ps: typeof pairs) => ({
  items: ps.length,
  meanDifferenceFGminusF: mean(ps.map((p) => p.g.primary - p.f.primary)),
  tokenRatioGeoMean: ps.length ? r3(Math.exp(ps.reduce((a, p) => a + Math.log(p.g.processedTokens / p.f.processedTokens), 0) / ps.length)) : null,
  wallRatioGeoMean: ps.length ? r3(Math.exp(ps.reduce((a, p) => a + Math.log(p.g.wallMs / p.f.wallMs), 0) / ps.length)) : null,
  toolCallDifferenceMean: mean(ps.map((p) => p.g.toolCalls - p.f.toolCalls)),
});
const nonGw = pairs.filter((p) => p.f.itemClass !== 'Gw');

const toolTotals = (arm: string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const r of pilot.filter((x) => x.arm === arm)) for (const [k, v] of Object.entries(r.toolCallsByName)) out[k] = (out[k] ?? 0) + v;
  return out;
};
const { sha256 } = loadBank();
const calibration = rows.filter((r) => r.block === 'calibration').map((r) => ({ sessionId: r.sessionId, processedTokens: r.processedTokens, wallMs: r.wallMs }));

const doc = {
  schema: 'comprehend-01-pilot-analysis/v1', bankSha256: sha256, modelCalls: 'see the report (2 under R1, 61 under R2)',
  sessions: rows.length, scoredPilotSessions: pilot.length, calibration,
  overall: byArm(pilot), nonGw: byArm(pilot.filter((r) => r.itemClass !== 'Gw')),
  byType: split((r) => r.itemType!), byClass: split((r) => r.itemClass!), byTreeGroup: split(group), byTree: split((r) => r.tree),
  paired: {
    all: paired(pairs), nonGw: paired(nonGw),
    humanNonGw: paired(nonGw.filter((p) => group(p.f) === 'human')), smallNonGw: paired(nonGw.filter((p) => group(p.f) === 'small')),
    humanG: paired(pairs.filter((p) => group(p.f) === 'human' && p.f.itemClass === 'G')),
    Gw: paired(pairs.filter((p) => p.f.itemClass === 'Gw')), SX: paired(pairs.filter((p) => p.f.itemClass === 'S' || p.f.itemClass === 'X')),
  },
  toolCalls: { F: toolTotals('F'), FG: toolTotals('FG') },
  fgWithoutGraphCall: pilot.filter((r) => r.arm === 'FG' && r.graphCalls === 0).map((r) => `${r.item} (${r.itemClass})`),
  perItem: pairs.map((p) => ({ item: p.f.item, tree: p.f.tree, type: p.f.itemType, class: p.f.itemClass,
    F: { primary: p.f.primary, secondary: p.f.secondary, tokens: p.f.processedTokens, tools: p.f.toolCalls, wallMs: p.f.wallMs },
    FG: { primary: p.g.primary, secondary: p.g.secondary, tokens: p.g.processedTokens, tools: p.g.toolCalls, graph: p.g.graphCalls, wallMs: p.g.wallMs } })),
};
fs.writeFileSync(path.join(DIR, 'analysis.json'), `${JSON.stringify(doc, null, 1)}\n`);
process.stdout.write(`${JSON.stringify({ overall: doc.overall, paired: doc.paired, toolCalls: doc.toolCalls, fgWithoutGraphCall: doc.fgWithoutGraphCall, byTreeGroup: doc.byTreeGroup }, null, 1)}\n`);
