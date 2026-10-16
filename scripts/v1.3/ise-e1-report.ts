/**
 * ISE on E1 (exploratory): the tables of Docs/DiagnosticRuns/ise-e1-ics-2026-10-15.md from <dir>/cells.json
 * (written by `ise-e1.ts`). Descriptive only: no test, no p value. Offline.
 * Entry file: exports only the pure `summarise`, `grid` and `renderReport` (unit-tested).
 *
 * Usage: npx tsx scripts/v1.3/ise-e1-report.ts --dir results/v1.3-ise-e1
 * Writes <dir>/summary.json and <dir>/summary.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Side {
  readonly style: string | null;
  readonly verdict: string;
  readonly blockingAhs: number | null;
  readonly checkedSites: number;
  readonly violatedSites: readonly string[];
  readonly siteRatio: number | null;
  readonly blockingFindings: number;
  readonly advisoryFindings: number;
  readonly blockingByRule: Readonly<Record<string, number>>;
}

export interface Cell {
  readonly id: string;
  readonly model: string;
  readonly task: string;
  readonly level: string;
  readonly run: string;
  readonly files: number;
  readonly ise: {
    readonly style: string;
    readonly confidence: number;
    readonly totalPoints: number;
    readonly runnerUp: { style: string; confidence: number } | null;
    readonly evidence: readonly string[];
    readonly abstains: boolean;
    readonly abstainReasons: readonly string[];
    readonly styleMatch: boolean;
    readonly structureOnlyUnits: number;
    readonly unlayeredFiles: number;
    readonly units: readonly { unit: string; layer: string | null; source: string }[];
    readonly specValid: boolean;
  };
  readonly extrinsic: Side;
  readonly intrinsic: Side;
}

export const LEVELS = ['none', 'minimal-prose', 'full-aac'] as const;
export const ICS_HIGH = 0.95;

const mean = (xs: readonly number[]): number | null => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);
const f3 = (x: number | null): string => (x === null ? 'n/a' : x.toFixed(3));
const f2 = (x: number | null): string => (x === null ? 'n/a' : x.toFixed(2));

export interface Row {
  readonly level: string;
  readonly model: string;
  readonly cells: number;
  readonly styleMatch: number;
  readonly abstain: number;
  readonly meanConfidence: number | null;
  readonly meanIcs: number | null;
  readonly icsNa: number;
  readonly meanIcsAhs: number | null;
  readonly meanExtAhs: number | null;
  readonly meanExtSites: number | null;
  readonly extPass: number;
  readonly icsPass: number;
  readonly blockingPerFileExt: number | null;
  readonly advisoryPerFileExt: number | null;
  readonly blockingPerFileOwn: number | null;
  readonly meanFiles: number | null;
}

export function summarise(level: string, model: string, cs: readonly Cell[]): Row {
  const nn = (xs: (number | null)[]): number[] => xs.filter((x): x is number => x !== null);
  return {
    level,
    model,
    cells: cs.length,
    styleMatch: cs.filter((c) => c.ise.styleMatch).length,
    abstain: cs.filter((c) => c.ise.abstains).length,
    meanConfidence: mean(cs.map((c) => c.ise.confidence)),
    meanIcs: mean(nn(cs.map((c) => c.intrinsic.siteRatio))),
    icsNa: cs.filter((c) => c.intrinsic.siteRatio === null).length,
    meanIcsAhs: mean(nn(cs.map((c) => c.intrinsic.blockingAhs))),
    meanExtAhs: mean(nn(cs.map((c) => c.extrinsic.blockingAhs))),
    meanExtSites: mean(nn(cs.map((c) => c.extrinsic.siteRatio))),
    extPass: cs.filter((c) => c.extrinsic.verdict === 'pass').length,
    icsPass: cs.filter((c) => c.intrinsic.verdict === 'pass').length,
    blockingPerFileExt: mean(cs.map((c) => c.extrinsic.blockingFindings / Math.max(1, c.files))),
    advisoryPerFileExt: mean(cs.map((c) => c.extrinsic.advisoryFindings / Math.max(1, c.files))),
    blockingPerFileOwn: mean(cs.map((c) => c.intrinsic.blockingFindings / Math.max(1, c.files))),
    meanFiles: mean(cs.map((c) => c.files)),
  };
}

export interface Grid { hh: number; hl: number; lh: number; ll: number; na: number }

/** §1.5: rows = ICS high/low, columns = extrinsic high/low. */
export function grid(cs: readonly Cell[], icsHigh: (c: Cell) => boolean | null, extHigh: (c: Cell) => boolean | null): Grid {
  const g: Grid = { hh: 0, hl: 0, lh: 0, ll: 0, na: 0 };
  for (const c of cs) {
    const i = icsHigh(c);
    const e = extHigh(c);
    if (i === null || e === null) g.na += 1;
    else if (i && e) g.hh += 1;
    else if (i && !e) g.hl += 1;
    else if (!i && e) g.lh += 1;
    else g.ll += 1;
  }
  return g;
}

export const primaryIcs = (c: Cell): boolean | null => (c.intrinsic.siteRatio === null ? null : c.intrinsic.siteRatio >= ICS_HIGH);
export const primaryExt = (c: Cell): boolean | null => (c.extrinsic.blockingAhs === null ? null : c.extrinsic.blockingAhs === 1);

function gridTable(title: string, g: Grid): string[] {
  return [
    `**${title}**`,
    '',
    '| | high extrinsic | low extrinsic |',
    '|---|---|---|',
    `| **high ICS** | ${String(g.hh)} | ${String(g.hl)} |`,
    `| **low ICS** | ${String(g.lh)} | ${String(g.ll)} |`,
    ...(g.na > 0 ? [`| n/a | ${String(g.na)} | |`] : []),
    '',
  ];
}

const short = (m: string): string => m.replace(/^claude-/, '');

export function renderReport(cells: readonly Cell[]): { md: string; json: unknown } {
  const models = [...new Set(cells.map((c) => c.model))].sort();
  const rows: Row[] = [];
  for (const level of LEVELS) {
    for (const model of models) rows.push(summarise(level, model, cells.filter((c) => c.level === level && c.model === model)));
    rows.push(summarise(level, 'all', cells.filter((c) => c.level === level)));
  }
  for (const model of models) rows.push(summarise('all', model, cells.filter((c) => c.model === model)));
  const claude = cells.filter((c) => c.model.startsWith('claude-'));
  for (const level of LEVELS) rows.push(summarise(level, 'claude (3 models)', claude.filter((c) => c.level === level)));
  rows.push(summarise('all', 'all', cells));

  const out: string[] = [];
  out.push('| Spec level | Model | Cells | Style match | ISE abstains | Mean conf. | Mean ICS (sites) | Mean ICS_ahs | Mean ext_ahs | Mean ext_sites | Pass (ext / own) | Blocking per file (ext / own) | Advisory per file (ext) | Mean files |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const b = r.model === 'all' || r.level === 'all' || r.model.startsWith('claude (');
    const w = (s: string): string => (b ? `**${s}**` : s);
    out.push(`| ${w(r.level)} | ${w(short(r.model))} | ${String(r.cells)} | ${String(r.styleMatch)}/${String(r.cells)} | ${String(r.abstain)} | ${f2(r.meanConfidence)} | ${f3(r.meanIcs)}${r.icsNa > 0 ? ` (${String(r.icsNa)} n/a)` : ''} | ${f3(r.meanIcsAhs)} | ${f3(r.meanExtAhs)} | ${f3(r.meanExtSites)} | ${String(r.extPass)} / ${String(r.icsPass)} | ${f3(r.blockingPerFileExt)} / ${f3(r.blockingPerFileOwn)} | ${f3(r.advisoryPerFileExt)} | ${f2(r.meanFiles)} |`);
  }
  out.push('');

  const grids: Record<string, Grid> = {};
  const add = (k: string, cs: readonly Cell[], i: (c: Cell) => boolean | null, e: (c: Cell) => boolean | null): void => { grids[k] = grid(cs, i, e); };
  add('primary, all 65', cells, primaryIcs, primaryExt);
  add('primary, ISE not abstaining', cells.filter((c) => !c.ise.abstains), primaryIcs, primaryExt);
  for (const level of LEVELS) add(`primary, ${level}`, cells.filter((c) => c.level === level), primaryIcs, primaryExt);
  add('sensitivity (i): ICS_ahs = 1 x ext_ahs = 1', cells, (c) => (c.intrinsic.blockingAhs === null ? null : c.intrinsic.blockingAhs === 1), primaryExt);
  add('sensitivity (ii): ICS >= 0.95 x ext_sites >= 0.95', cells, primaryIcs, (c) => (c.extrinsic.siteRatio === null ? null : c.extrinsic.siteRatio >= ICS_HIGH));
  out.push('### 2×2 grids', '');
  for (const [k, g] of Object.entries(grids)) out.push(...gridTable(k, g));

  out.push('### Per cell', '');
  out.push('| Cell | Files | ISE style (conf.) | Runner-up | Abstains | Structure-only units | ICS | ICS_ahs | ext_ahs | ext_sites | Blocking rules (own) | Blocking rules (given) |');
  out.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  const rules = (r: Readonly<Record<string, number>>): string => Object.entries(r).map(([k, v]) => `${k}×${String(v)}`).join(', ') || '-';
  for (const c of [...cells].sort((a, b) => LEVELS.indexOf(a.level as never) - LEVELS.indexOf(b.level as never) || a.id.localeCompare(b.id))) {
    out.push(`| ${c.id} | ${String(c.files)} | ${c.ise.style} (${f2(c.ise.confidence)}) | ${c.ise.runnerUp === null ? '-' : `${c.ise.runnerUp.style} ${f2(c.ise.runnerUp.confidence)}`} | ${c.ise.abstains ? c.ise.abstainReasons.join('; ') : 'no'} | ${String(c.ise.structureOnlyUnits)} | ${f3(c.intrinsic.siteRatio)} | ${f3(c.intrinsic.blockingAhs)} | ${f3(c.extrinsic.blockingAhs)} | ${f3(c.extrinsic.siteRatio)} | ${rules(c.intrinsic.blockingByRule)} | ${rules(c.extrinsic.blockingByRule)} |`);
  }
  out.push('');
  return { md: out.join('\n'), json: { rows, grids } };
}

if (process.argv[1]?.endsWith('ise-e1-report.ts') === true) {
  const i = process.argv.indexOf('--dir');
  const dir = path.resolve(i >= 0 ? process.argv[i + 1] ?? '' : 'results/v1.3-ise-e1');
  const cells = JSON.parse(fs.readFileSync(path.join(dir, 'cells.json'), 'utf8')) as Cell[];
  const { md, json } = renderReport(cells);
  fs.writeFileSync(path.join(dir, 'summary.md'), `# ISE on E1: summary tables (exploratory; generated by scripts/v1.3/ise-e1-report.ts)\n\n${md}`);
  fs.writeFileSync(path.join(dir, 'summary.json'), `${JSON.stringify(json, null, 1)}\n`);
  process.stdout.write(md);
}
