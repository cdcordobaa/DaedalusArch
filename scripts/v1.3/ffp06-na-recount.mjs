#!/usr/bin/env node
/**
 * Documentation correction (2026-10-16), not measurement code. Reads committed scores and evidence only; runs no tool,
 * opens no sealed file and changes no result.
 *
 * Docs/v1.3/rule-tiers.md (sealed) marks the FLOWS_TO half of FF-P06 N/A: only the constructor-injection half can
 * support a blocking verdict. This script moves every FF-P06 row whose evidence discriminator is FLOWS_TO out of the
 * blocking counts and into an N/A bucket, and recomputes blocking recall and precision per style and pooled, with the
 * Wilson 95% interval of scripts/v1.3/ue-score.ts (z = 1.959964).
 *
 * Method: blocking counts minus the FF-P06 perRule counts of each (style, view), for styles whose FF-P06 evidence rows
 * are all FLOWS_TO. A style with any FLOWS_TO row mixed with CONSTRUCTOR_INJECTS rows is an error (the perRule counts
 * cannot be split). The script first checks that the blocking perRule counts sum to the blocking totals.
 *
 * Usage (repository root): node scripts/v1.3/ffp06-na-recount.mjs [run ...]
 *   default runs: baseline-pre-barrel after-fixes/barrels-only after-fixes after-member-facts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = 'results/v1.3-reference';
const runs = process.argv.slice(2).length > 0 ? process.argv.slice(2)
  : ['baseline-pre-barrel', 'after-fixes/barrels-only', 'after-fixes', 'after-member-facts'];
const STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'];

function wilson(k, n) {
  if (n === 0) return null;
  const z = 1.959964;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}
const f2 = (x) => x.toFixed(2);
function cell(k, n) {
  if (n === 0) return 'n/a';
  const ci = wilson(k, n);
  return `${k}/${n} = ${f2(k / n)} [${f2(ci[0])}, ${f2(ci[1])}]`;
}

const out = {};
for (const run of runs) {
  const base = path.join(ROOT, run);
  const scores = JSON.parse(fs.readFileSync(path.join(base, 'scores.json'), 'utf8'));

  // Which half does each style's FF-P06 evidence come from?
  const halves = {};
  for (const style of STYLES) {
    const dir = path.join(base, 'evidence', style);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const ev = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const v of ev.violations ?? []) {
        if (v.functionId !== 'FF-P06') continue;
        const half = v.discriminator?.[2] ?? 'unknown';
        (halves[style] ??= { FLOWS_TO: [], CONSTRUCTOR_INJECTS: [], unknown: [] })[half in { FLOWS_TO: 1, CONSTRUCTOR_INJECTS: 1 } ? half : 'unknown']
          .push(`${f.replace(/\.json$/, '')}: ${v.filePath}`);
      }
    }
  }
  for (const [style, h] of Object.entries(halves)) {
    if (h.unknown.length > 0) throw new Error(`${run} ${style}: FF-P06 row with unknown half`);
    if (h.FLOWS_TO.length > 0 && h.CONSTRUCTOR_INJECTS.length > 0) throw new Error(`${run} ${style}: mixed FF-P06 halves`);
  }
  const naStyle = (s) => (halves[s]?.FLOWS_TO.length ?? 0) > 0;

  const views = {};
  for (const v of scores.views) {
    const b = v.blocking;
    const sum = { tp: 0, fn: 0, fp: 0 };
    let p06 = { tp: 0, fn: 0, fp: 0 };
    for (const r of v.perRule) {
      if (!r.blocking) continue;
      sum.tp += r.counts.tp; sum.fn += r.counts.fn; sum.fp += r.counts.fp;
      if (r.ruleId === 'FF-P06' && naStyle(v.style)) p06 = { tp: r.counts.tp, fn: r.counts.fn, fp: r.counts.fp };
    }
    if (sum.tp !== b.tp || sum.fn !== b.fn || sum.fp !== b.fp) {
      throw new Error(`${run} ${v.style} ${v.view}: perRule blocking counts do not sum to the blocking totals`);
    }
    const row = (views[v.view] ??= {});
    row[v.style] = {
      reported: { tp: b.tp, fn: b.fn, fp: b.fp },
      na: p06,
      corrected: { tp: b.tp - p06.tp, fn: b.fn - p06.fn, fp: b.fp - p06.fp },
    };
  }
  for (const view of Object.values(views)) {
    const pooled = { reported: { tp: 0, fn: 0, fp: 0 }, na: { tp: 0, fn: 0, fp: 0 }, corrected: { tp: 0, fn: 0, fp: 0 } };
    for (const s of STYLES) {
      for (const k of ['reported', 'na', 'corrected']) for (const c of ['tp', 'fn', 'fp']) pooled[k][c] += view[s][k][c];
    }
    view.pooled = pooled;
  }
  out[run] = { halves, views };

  console.log(`\n## ${run}\n`);
  for (const [style, h] of Object.entries(halves)) {
    console.log(`- FF-P06 ${style}: FLOWS_TO ${h.FLOWS_TO.length} (N/A), CONSTRUCTOR_INJECTS ${h.CONSTRUCTOR_INJECTS.length} (kept)${h.FLOWS_TO.length ? ` -- ${h.FLOWS_TO.join('; ')}` : ''}`);
  }
  for (const [vname, view] of Object.entries(views)) {
    console.log(`\n### ${vname}\n`);
    console.log('| Style | Recall reported | Recall corrected | Precision reported | Precision corrected | N/A rows (tp/fn/fp) |');
    console.log('|---|---|---|---|---|---|');
    for (const s of [...STYLES, 'pooled']) {
      const r = view[s];
      const rr = r.reported, cc = r.corrected, na = r.na;
      console.log(`| ${s} | ${cell(rr.tp, rr.tp + rr.fn)} | ${cell(cc.tp, cc.tp + cc.fn)} | ${cell(rr.tp, rr.tp + rr.fp)} | ${cell(cc.tp, cc.tp + cc.fp)} | ${na.tp}/${na.fn}/${na.fp} |`);
    }
  }
}
if (process.env.FFP06_JSON) fs.writeFileSync(process.env.FFP06_JSON, JSON.stringify(out, null, 2));
