/**
 * Study 2 analysis: the Markdown tables and SVG figures of an `AnalysisReport` (`study2-analysis.ts`). NOT A
 * PRE-REGISTRATION. Pure; no I/O.
 */
import type { LoopArm } from '../../lib/loop/types.js';
import { METRIC_LABEL } from './study2-analysis.js';
import type { AnalysisReport, ContrastResult, Estimate, Interval, TrajectoryPoint } from './study2-analysis.js';

const f = (x: number | null | undefined, d = 3): string => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : x.toFixed(d));
const ci = (i: Interval, d = 3): string => (i.low === null || i.high === null ? 'n/a' : `[${f(i.low, d)}, ${f(i.high, d)}]`);
const pv = (p: number | null | undefined): string => (p === null || p === undefined ? 'n/a' : p < 0.0001 ? '< 0.0001' : p.toFixed(4));
const est = (e: Estimate, d = 2): string => (e.mean === null ? 'n/a' : `${f(e.mean, d)} ${ci(e.ci, d)}`);
const label = (c: ContrastResult): string => `${c.arm} − ${c.reference}`;

function contrastTable(cs: readonly ContrastResult[], holm: boolean): string[] {
  const head = holm
    ? '| Contrast | Blocks | Tasks | Mean slope arm | Mean slope ref | Mean diff | 95% CI (2-stage cluster bootstrap) | d_z | Relative reduction [95% CI] | Sign-flip p | Holm p | Reject at α |'
    : '| Contrast | Outcome | Blocks | Mean arm | Mean ref | Mean diff | 95% CI | d_z | Relative reduction [95% CI] | Unadjusted p |';
  const out = [head, holm ? '|---|---|---|---|---|---|---|---|---|---|---|---|' : '|---|---|---|---|---|---|---|---|---|---|'];
  for (const c of cs) {
    out.push(
      holm
        ? `| ${label(c)} | ${String(c.blocks)} | ${String(c.tasks)} | ${f(c.meanArm)} | ${f(c.meanReference)} | ${f(c.meanDiff)} | ${ci(c.ci)} | ${f(c.dz, 2)} | ${f(c.relativeReduction, 2)} ${ci(c.relativeReductionCi, 2)} | ${pv(c.p)} | ${pv(c.holmP)} | ${c.holmReject === true ? 'yes' : 'no'} |`
        : `| ${label(c)} | ${METRIC_LABEL[c.metric]} | ${String(c.blocks)} | ${f(c.meanArm)} | ${f(c.meanReference)} | ${f(c.meanDiff)} | ${ci(c.ci)} | ${f(c.dz, 2)} | ${f(c.relativeReduction, 2)} ${ci(c.relativeReductionCi, 2)} | ${pv(c.p)} |`,
    );
  }
  return out;
}

export function renderReport(r: AnalysisReport, title: string): string {
  const o: string[] = [];
  o.push(`# ${title}`, '');
  if (r.synthetic) o.push('> **SYNTHETIC / DRY-RUN DATA.** At least one run says `dryRun: true`. Nothing below is a measurement.', '');
  o.push('> Study 2 analysis rehearsal output (`scripts/v1.3/study2-analyse.ts`). NOT A PRE-REGISTRATION.', '');
  o.push(`Seed ${String(r.options.seed)}; ${String(r.options.resamples)} bootstrap resamples; ${String(r.options.flips)} Monte Carlo sign flips (exact at ≤ 14 units); α = ${String(r.options.alpha)}; a run's slope needs ≥ ${String(r.options.minStepsForSlope)} steps with an outcome.`, '');
  o.push('## T0. Design as found', '', `Runs ${String(r.design.runs)}; blocks ${String(r.design.blocks)}; tasks ${String(r.design.tasks)}; models ${r.design.models.join(', ')}; k ∈ {${r.design.k.join(', ')}}; arms ${r.arms.join(', ')}.`, '');

  o.push('## T1. Pre-committed switch rule (pilot memo §3, §5)', '', r.switch.statement, '');
  if (r.switch.perTask.length > 0) {
    o.push('| Pilot task | New blocking findings after step 1 (`none`) | Of which unlabelled | Excluded by label |', '|---|---|---|---|');
    for (const t of r.switch.perTask) o.push(`| ${t.taskId} | ${String(t.newBlockingAfterStep1)} | ${String(t.unlabelled)} | ${String(t.excludedByLabel)} |`);
    o.push('');
  }
  if (r.switch.provisional) o.push('**Provisional:** the memo counts a new finding only when `check-correct.ts` labels it `correct` (or the author confirms a `not-checkable` one). No label file was given, so every new finding was counted.', '');
  o.push(`**Fallback triggered:** ${r.switch.fallbackTriggered ? 'YES' : 'no'}. **Primary outcome:** ${METRIC_LABEL[r.primaryMetric]}. **Memo definition met on these records:** ${r.primaryDefinitionMet ? 'yes' : 'NO'}.`, '');
  for (const n of r.primaryNotes) o.push(`- ${n}`);
  if (r.primaryNotes.length > 0) o.push('');
  o.push(`Floor check (descriptive, cannot change the primary outcome): ${String(r.floorCheck.noneStepsWithBlocking)} of ${String(r.floorCheck.noneSteps)} \`none\` steps have a blocking finding; every Study 2 step zero: ${r.floorCheck.allStudyBlockingZero ? 'yes' : 'no'}.`, '');

  o.push('## T2. Primary outcome: confirmatory contrasts (Holm over the two)', '', `Outcome: ${METRIC_LABEL[r.primaryMetric]}. Per run, OLS slope on step 1..k; per block, arm − none; two-sided sign-flip test of the mean.`, '');
  o.push(...contrastTable(r.confirmatory, true), '');

  o.push('## T3. Task-level effects (forest plot F2) and the task-level test', '');
  o.push('| Contrast | Task | Blocks | Mean diff | 95% CI (blocks within task) |', '|---|---|---|---|---|');
  for (const c of r.confirmatory) for (const t of c.taskEffects) o.push(`| ${label(c)} | ${t.taskId} | ${String(t.blocks)} | ${f(t.meanDiff)} | ${ci(t.ci)} |`);
  o.push('');
  o.push('| Contrast | Task-level sign-flip p | Smallest attainable p | Tasks agreeing in sign |', '|---|---|---|---|');
  for (const c of r.confirmatory) {
    const neg = c.taskEffects.filter((t) => t.meanDiff < 0).length;
    o.push(`| ${label(c)} | ${pv(c.taskLevelP)} | ${pv(c.taskLevelMinP)} | ${String(neg)} of ${String(c.taskEffects.length)} below 0 |`);
  }
  o.push('');

  if (r.secondaryContrasts.length > 0) o.push('## T4. Secondary contrast on the primary outcome (unadjusted)', '', ...contrastTable(r.secondaryContrasts, false).map((l) => l), '');
  if (r.perModel.length > 0) {
    o.push('## T5. Primary outcome by model (model is a fixed factor; descriptive)', '', '| Model | Contrast | Blocks | Mean diff | 95% CI | Relative reduction |', '|---|---|---|---|---|---|');
    for (const m of r.perModel) for (const c of m.contrasts) o.push(`| ${m.model} | ${label(c)} | ${String(c.blocks)} | ${f(c.meanDiff)} | ${ci(c.ci)} | ${f(c.relativeReduction, 2)} |`);
    o.push('');
  }
  if (r.secondaryOutcomes.length > 0) o.push('## T6. Secondary outcomes and guards (exploratory, unadjusted)', '', ...contrastTable(r.secondaryOutcomes, false), '');

  if (r.repair !== null) {
    const p = r.repair;
    o.push('## T7. Gate repair success (descriptive)', '', '| Gate steps | Failing steps (repair ran) | Repairs with an evaluated outcome | Cleared | Share cleared [Wilson 95%] | Share cleared [task-cluster 95%] | Mean blocking before − after [95%] | Findings introduced by repairs | Repair evaluation failed |', '|---|---|---|---|---|---|---|---|---|');
    o.push(`| ${String(p.gateSteps)} | ${String(p.failingSteps)} | ${String(p.repairsWithOutcome)} | ${String(p.cleared)} | ${f(p.clearedShare, 2)} ${ci(p.clearedWilson, 2)} | ${ci(p.clearedShareClusterCi, 2)} | ${est(p.meanReduction)} | ${String(p.introducedFindings)} | ${String(p.repairEvaluationFailed)} |`, '');
  }
  if (r.cost.length > 0) {
    o.push('## T8. Cost and time (descriptive, task-cluster bootstrap 95%)', '', '| Arm | Steps | Steps with a cost | USD per step | USD per run (runs with every cost) | Input tokens per step | Output tokens per step | Wall minutes per step | Agent turns per step | Repair turns | Repair USD | Usage-limit interruptions |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const c of r.cost) o.push(`| ${c.arm} | ${String(c.steps)} | ${String(c.stepsWithCost)} | ${est(c.costPerStepUsd)} | ${est(c.costPerRunUsd)} | ${est(c.inputTokensPerStep, 0)} | ${est(c.outputTokensPerStep, 0)} | ${est(c.wallMinutesPerStep, 1)} | ${est(c.agentTurnsPerStep, 1)} | ${String(c.repairTurns)} | ${f(c.repairCostUsd, 2)} | ${String(c.usageLimitInterruptions)} |`);
    o.push('');
  }
  if (r.guards.length > 0) {
    o.push('## T9. Guards (descriptive)', '', '| Arm | Steps | Evaluation errors | Steps with type-check errors | Mean type-check errors | Skeleton broken | Non-completed turns | Mean LOC step 1 | Mean LOC step k | Mean files step k | Runs with a LOC drop |', '|---|---|---|---|---|---|---|---|---|---|---|');
    for (const g of r.guards) o.push(`| ${g.arm} | ${String(g.steps)} | ${String(g.evaluationErrors)} | ${String(g.stepsWithTypecheckErrors)} | ${f(g.meanTypecheckErrors, 2)} | ${String(g.skeletonBroken)} | ${String(g.nonCompletedTurns)} | ${f(g.meanLocStep1, 0)} | ${f(g.meanLocStepK, 0)} | ${f(g.meanFilesStepK, 1)} | ${String(g.runsWithLocDrop)} |`);
    o.push('');
  }
  if (r.missing.length > 0) {
    o.push('## T10. Missingness per model and arm', '', '| Model | Arm | Runs scheduled | Runs found | Runs complete | Steps expected | Steps recorded | Steps without outcome | Runs without a slope |', '|---|---|---|---|---|---|---|---|---|');
    for (const m of r.missing) o.push(`| ${m.model} | ${m.arm} | ${String(m.runsScheduled)} | ${String(m.runsFound)} | ${String(m.runsComplete)} | ${String(m.stepsExpected)} | ${String(m.stepsRecorded)} | ${String(m.stepsWithoutOutcome)} | ${String(m.runsWithoutSlope)} |`);
    o.push('');
  }
  if (r.trajectories.primary.length > 0) {
    o.push('## T11. Trajectories (figure F1): mean per arm and step [normal 95%]', '', '| Arm | Step | n | Primary outcome per step | Blocking per step | AHS |', '|---|---|---|---|---|---|');
    r.trajectories.primary.forEach((p, i) => {
      const b = r.trajectories.blocking[i];
      const a = r.trajectories.ahs[i];
      o.push(`| ${p.arm} | ${String(p.step)} | ${String(p.n)} | ${f(p.mean)} ${ci(p)} | ${f(b?.mean)} | ${f(a?.mean)} |`);
    });
    o.push('');
  }
  o.push('## Not computable from the step records', '', '| Item | Why |', '|---|---|');
  for (const n of r.notComputable) o.push(`| ${n.item} | ${n.reason} |`);
  o.push('', 'Figures: `F1-trajectory.svg` (primary outcome per step and arm), `F2-forest-<contrast>.svg` (task-level effects).', '');
  return o.join('\n');
}

// ── Figures (static SVG; reference palette slots 1–3; light surface) ──────────

const ARM_COLOR: Readonly<Record<LoopArm, string>> = { none: '#2a78d6', gate: '#eb6834', 'daedalus-mcp': '#1baf7a' };
const INK = '#0b0b0b';
const INK2 = '#52514e';
const GRID = '#e4e3df';
const SURFACE = '#fcfcfb';
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function ticks(lo: number, hi: number, n = 5): number[] {
  const span = hi - lo || 1;
  const step = 10 ** Math.floor(Math.log10(span / n));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => span / s <= n) ?? step * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / nice) * nice; v <= hi + 1e-9; v += nice) out.push(Math.round(v * 1e9) / 1e9);
  return out;
}

export function trajectorySvg(points: readonly TrajectoryPoint[], yLabel: string, title: string): string {
  const W = 640;
  const H = 360;
  const m = { l: 64, r: 110, t: 52, b: 48 };
  const arms = [...new Set(points.map((p) => p.arm))];
  const k = Math.max(1, ...points.map((p) => p.step));
  const ys = points.flatMap((p) => [p.low ?? p.mean, p.high ?? p.mean]).filter((v): v is number => v !== null);
  const y0 = Math.min(0, ...ys);
  const y1 = Math.max(1e-6, ...ys) * 1.05;
  const x = (s: number): number => m.l + ((s - 1) / Math.max(1, k - 1)) * (W - m.l - m.r);
  const y = (v: number): number => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const o: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(W)} ${String(H)}" width="${String(W)}" height="${String(H)}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif" font-size="12">`, `<rect width="100%" height="100%" fill="${SURFACE}"/>`, `<text x="${String(m.l)}" y="22" fill="${INK}" font-size="14" font-weight="600">${esc(title)}</text>`];
  for (const t of ticks(y0, y1)) o.push(`<line x1="${String(m.l)}" x2="${String(W - m.r)}" y1="${f(y(t), 1)}" y2="${f(y(t), 1)}" stroke="${GRID}"/>`, `<text x="${String(m.l - 8)}" y="${f(y(t) + 4, 1)}" text-anchor="end" fill="${INK2}">${String(t)}</text>`);
  for (let s = 1; s <= k; s++) o.push(`<text x="${f(x(s), 1)}" y="${String(H - m.b + 18)}" text-anchor="middle" fill="${INK2}">${String(s)}</text>`);
  o.push(`<text x="${String((m.l + W - m.r) / 2)}" y="${String(H - 10)}" text-anchor="middle" fill="${INK2}">Step</text>`, `<text transform="translate(16 ${String((m.t + H - m.b) / 2)}) rotate(-90)" text-anchor="middle" fill="${INK2}">${esc(yLabel)}</text>`);
  arms.forEach((arm) => {
    const ps = points.filter((p) => p.arm === arm && p.mean !== null);
    const c = ARM_COLOR[arm];
    o.push(`<polyline fill="none" stroke="${c}" stroke-width="2" points="${ps.map((p) => `${f(x(p.step), 1)},${f(y(p.mean ?? 0), 1)}`).join(' ')}"/>`);
    for (const p of ps) {
      if (p.low !== null && p.high !== null) o.push(`<line x1="${f(x(p.step), 1)}" x2="${f(x(p.step), 1)}" y1="${f(y(p.low), 1)}" y2="${f(y(p.high), 1)}" stroke="${c}" stroke-width="1.5" opacity="0.6"/>`);
      o.push(`<circle cx="${f(x(p.step), 1)}" cy="${f(y(p.mean ?? 0), 1)}" r="4.5" fill="${c}" stroke="${SURFACE}" stroke-width="2"><title>${esc(`${arm}, step ${String(p.step)}: ${f(p.mean)} (n ${String(p.n)})`)}</title></circle>`);
    }
  });
  // Direct labels at the line ends, nudged apart so they never collide (≥ 14 px).
  const ends = arms
    .map((arm) => ({ arm, p: points.filter((p) => p.arm === arm && p.mean !== null).pop() }))
    .flatMap((e) => (e.p === undefined ? [] : [{ arm: e.arm, x: x(e.p.step) + 10, y: y(e.p.mean ?? 0) + 4 }]))
    .sort((p, q) => p.y - q.y);
  for (let i = 1; i < ends.length; i++) {
    const prev = ends[i - 1];
    const cur = ends[i];
    if (prev !== undefined && cur !== undefined && cur.y - prev.y < 14) cur.y = prev.y + 14;
  }
  for (const e of ends) o.push(`<text x="${f(e.x, 1)}" y="${f(e.y, 1)}" fill="${INK}">${esc(e.arm)}</text>`);
  // Legend in one row under the title.
  let lx = m.l;
  for (const arm of arms) {
    o.push(`<rect x="${String(lx)}" y="30" width="10" height="10" rx="2" fill="${ARM_COLOR[arm]}"/>`, `<text x="${String(lx + 16)}" y="39" fill="${INK2}">${esc(arm)}</text>`);
    lx += 16 + 8 * arm.length + 18;
  }
  o.push('</svg>');
  return o.join('\n') + '\n';
}

export function forestSvg(c: ContrastResult, title: string): string {
  const rows = [...c.taskEffects.map((t) => ({ name: t.taskId, mean: t.meanDiff, ci: t.ci, bold: false })), { name: 'Pooled', mean: c.meanDiff ?? Number.NaN, ci: c.ci, bold: true }];
  const W = 640;
  const rowH = 28;
  const m = { l: 150, r: 170, t: 44, b: 40 };
  const H = m.t + m.b + rows.length * rowH;
  const vals = rows.flatMap((r) => [r.ci.low ?? r.mean, r.ci.high ?? r.mean, r.mean]).filter((v) => Number.isFinite(v));
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const pad = (hi - lo || 1) * 0.08;
  const x = (v: number): number => m.l + ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (W - m.l - m.r);
  const o: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${String(W)} ${String(H)}" width="${String(W)}" height="${String(H)}" role="img" aria-label="${esc(title)}" font-family="system-ui, sans-serif" font-size="12">`, `<rect width="100%" height="100%" fill="${SURFACE}"/>`, `<text x="16" y="24" fill="${INK}" font-size="14" font-weight="600">${esc(title)}</text>`];
  for (const t of ticks(lo - pad, hi + pad)) o.push(`<line x1="${f(x(t), 1)}" x2="${f(x(t), 1)}" y1="${String(m.t)}" y2="${String(H - m.b)}" stroke="${GRID}"/>`, `<text x="${f(x(t), 1)}" y="${String(H - m.b + 16)}" text-anchor="middle" fill="${INK2}">${String(t)}</text>`);
  o.push(`<line x1="${f(x(0), 1)}" x2="${f(x(0), 1)}" y1="${String(m.t - 4)}" y2="${String(H - m.b)}" stroke="${INK2}" stroke-width="1.5"/>`);
  o.push(`<text x="${String((m.l + W - m.r) / 2)}" y="${String(H - 8)}" text-anchor="middle" fill="${INK2}">${esc(`Mean slope difference, ${c.arm} − ${c.reference} (below 0 = less erosion)`)}</text>`);
  const color = ARM_COLOR[c.arm];
  rows.forEach((r, i) => {
    const cy = m.t + i * rowH + rowH / 2;
    o.push(`<text x="${String(m.l - 10)}" y="${f(cy + 4, 1)}" text-anchor="end" fill="${INK}"${r.bold ? ' font-weight="600"' : ''}>${esc(r.name)}</text>`);
    if (r.ci.low !== null && r.ci.high !== null) o.push(`<line x1="${f(x(r.ci.low), 1)}" x2="${f(x(r.ci.high), 1)}" y1="${f(cy, 1)}" y2="${f(cy, 1)}" stroke="${color}" stroke-width="2"/>`);
    if (Number.isFinite(r.mean)) {
      o.push(r.bold ? `<rect x="${f(x(r.mean) - 6, 1)}" y="${f(cy - 6, 1)}" width="12" height="12" rx="2" fill="${color}" stroke="${SURFACE}" stroke-width="2"><title>${esc(`Pooled ${f(r.mean)} ${ci(r.ci)}`)}</title></rect>` : `<circle cx="${f(x(r.mean), 1)}" cy="${f(cy, 1)}" r="4.5" fill="${color}" stroke="${SURFACE}" stroke-width="2"><title>${esc(`${r.name}: ${f(r.mean)} ${ci(r.ci)}`)}</title></circle>`);
    }
    o.push(`<text x="${String(W - m.r + 10)}" y="${f(cy + 4, 1)}" fill="${INK2}">${esc(`${f(r.mean)} ${ci(r.ci)}`)}</text>`);
  });
  o.push('</svg>');
  return o.join('\n') + '\n';
}
