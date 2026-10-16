// v1.3 protocol and Study 2 design docs (Docs/v1.3/{validation-protocol,holdout-prespec,study2-outline,
// study2-power-notes}.md): the development-set size from the committed reference runs, the Wilson lower-bound sample
// sizes, the Study 2 harness facts (scripts/lib/generators/arms.ts, scripts/lib/loop/prompts.ts), the outline's design
// arithmetic, and the power-simulation tables regenerated with scripts/v1.3/study2-power.ts (byte-identical, ~4.5 min).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const VP = 'Docs/v1.3/validation-protocol.md';
const HP = 'Docs/v1.3/holdout-prespec.md';
const SO = 'Docs/v1.3/study2-outline.md';
const PN = 'Docs/v1.3/study2-power-notes.md';
const num = (pre, doc) => (id, line, what, stated, extra = {}) => ({ id: `${pre}-${id}`, doc, line, what, stated, ...extra });
const v = num('d-vp', VP); const h = num('d-hp', HP); const o = num('d-so', SO); const p = num('d-pn', PN);
const EXT_HOLDOUT = { needs: 'needs-external', note: 'the hold-out set is sealed outside the repository (../daedalus-sealed/v1.3-holdout); the value is consistent with Docs/v1.3/sealed-hashes.md lines 25-27, which cannot itself be verified without the sealed directory.' };
const EXT_TASKS = { needs: 'needs-external', note: 'the Study 2 task list is sealed outside the repository (../daedalus-sealed/v1.3-study2-tasks.md); only its sha256 is in Docs/v1.3/sealed-hashes.md.' };

// ---- power notes tables (stated) ------------------------------------------------------------------------------------
const OPTS = ['A', 'B', 'C', 'D', 'E', 'F'];
const DESIGN = { A: ['36', '108', '540'], B: ['54', '162', '810'], C: ['90', '270', '1350'], D: ['54', '162', '648'], E: ['54', '162', '972'], F: ['72', '216', '1080'] };
const RES_COLS = ['null', 'g02', 'g035', 'g05', 'g05m05', 'mcp025', 'task05'];
const RES = {
  A: ['0.03', '0.06', '0.21', '0.37', '0.43 / 0.42', '0.11', '0.00'], B: ['0.04', '0.11', '0.28', '0.54', '0.61 / 0.61', '0.18', '0.00'],
  C: ['0.04', '0.15', '0.48', '0.77', '0.81 / 0.81', '0.33', '0.00'], D: ['0.04', '0.07', '0.17', '0.36', '0.39 / 0.41', '0.11', '0.00'],
  E: ['0.04', '0.13', '0.38', '0.71', '0.72 / 0.70', '0.26', '0.00'], F: ['0.02', '0.10', '0.35', '0.66', '0.76 / 0.74', '0.21', '0.58'],
};
const SENS = [ // line, label in power.json, gate, mcp
  [91, 'Poisson counts (no overdispersion)', '0.94', '0.51'], [92, 'Strong overdispersion (θ = 0.8)', '0.31', '0.09'],
  [93, 'No arm × task interaction (sdEffectTask = 0)', '0.55', '0.19'], [94, 'Large arm × task interaction (sdEffectTask = 0.35)', '0.48', '0.18'],
  [95, 'Slow erosion (slopePerStep = 0.5)', '0.27', '0.09'], [96, 'Fast erosion (slopePerStep = 2)', '0.77', '0.30'],
  [97, 'Noisy runs (sdRun = 0.7)', '0.42', '0.17'],
];
const sk = (l) => l.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').slice(0, 24);

const vpNumbers = [
  v('dev-cases', 60, 'reference cases in the development set (committed after-member-facts raw outputs, one per case)', '71', { basis: 're-derived' }),
];
const hpNumbers = [
  h('hash-dir', 12, 'hold-out directory-manifest sha256 prefix', '`1379b561…`', EXT_HOLDOUT),
  h('hash-out', 12, 'hold-out author out.sha256 prefix', '`cddec14a…`', EXT_HOLDOUT),
  h('cases-before', 23, 'hold-out cases before the enlargement', '62', EXT_HOLDOUT),
  h('cases-after', 23, 'hold-out cases after the enlargement', '207', EXT_HOLDOUT),
  h('cases-after-2', 25, 'hold-out cases (construct distribution)', '207', EXT_HOLDOUT),
  h('lb-0', 73, 'smallest n with 95% Wilson lower bound >= 0.90, no miss', 'n ≥ 35', { basis: 're-derived' }),
  h('lb-1', 73, 'smallest n with Wilson lower bound >= 0.90, one miss', 'n ≥ 53', { basis: 're-derived' }),
  h('lb-2', 73, 'smallest n with Wilson lower bound >= 0.90, two misses', 'n ≥ 69', { basis: 're-derived' }),
  h('lb-0b', 73, 'fewer than N expected blocking findings cannot pass the lower-bound check', 'fewer than 35', { basis: 're-derived' }),
];
const soNumbers = [
  o('mcp-tools', 53, 'spec-only DaedalusArch MCP tools the daedalus-mcp arm allows', 'the 7 spec-only tools', { basis: 're-derived', known: { actual: 'the 9 spec-only tools', note: 'DAEDALUS_ARM_TOOLS (scripts/lib/generators/arms.ts, pinned equal to SPEC_TOOL_NAMES) now holds 9 tools: MCP v2 added infer_spec and explain_finding after the outline listed 7.' } }),
  o('repair-max', 54, 'blocking findings listed in the gate repair turn (MAX_REPAIR_FINDINGS)', 'at most 40 listed', { basis: 're-derived' }),
  o('tasks', 111, 'tasks in the sealed Study 2 list', '6 (the sealed list)', EXT_TASKS),
  o('blocks', 117, 'blocks of the working grid 6 x 3 x 3', '6 × 3 × 3 = **54 blocks**', { basis: 're-derived' }),
  o('runs', 117, 'runs (54 blocks x 3 arms)', '**162 runs**', { basis: 're-derived' }),
  o('turns', 117, 'step turns for k = 4..6, rounded to tens', 'roughly 650–970 step turns', { basis: 're-derived' }),
  o('z-alpha', 121, 'z at alpha = 0.025 two-sided (Holm strictest step)', 'z ≈ 2.24', { basis: 're-derived' }),
  o('z-beta', 121, 'z at power 0.80', 'z ≈ 0.84', { basis: 're-derived' }),
  o('dz-54', 122, 'detectable d_z with 54 blocks', 'd_z ≈ **0.42**', { basis: 're-derived' }),
  o('dz-36', 122, 'detectable d_z with 36 blocks', 'd_z ≈ **0.51**', { basis: 're-derived' }),
  o('tasks-shared', 127, 'tasks shared by the blocks', 'Blocks share 6 tasks', EXT_TASKS),
  o('tasks-only', 128, 'tasks (effective n caveat)', 'With 6 tasks', EXT_TASKS),
  o('cost', 137, 'grid cost API-equivalent', 'roughly 1.5k–6k USD', { needs: 'not-checkable', note: 'a working guess with no stated formula: 648–972 step turns at 2–6 USD give about 1.3k–5.8k USD before repair turns, about 1.4k–7k with 30–60 % repair turns on the gate steps.' }),
  o('tasks-few', 154, 'tasks (few clusters threat)', '6 tasks', EXT_TASKS),
];
const R = { basis: 'regenerated' };
const pnNumbers = [
  p('mcse', 18, 'Monte Carlo SE bound of a power figure at 400 simulations', 'at most 0.025', R),
  ...OPTS.flatMap((x, i) => ['blocks', 'runs', 'turns'].map((c, j) => p(`design-${x}-${c}`, 67 + i, `design option ${x} ${c}`, DESIGN[x][j], R))),
  ...OPTS.flatMap((x, i) => RES_COLS.map((c, j) => p(`res-${x}-${c}`, 80 + i, `power, option ${x}, ${c}`, RES[x][j], R))),
  ...SENS.flatMap(([line, label, g, m]) => [p(`sens-${sk(label)}-gate`, line, `sensitivity gate power: ${label}`, g, R), p(`sens-${sk(label)}-mcp`, line, `sensitivity mcp power: ${label}`, m, R)]),
  p('fallback-each', 100, 'fallback outcome, base assumptions: max gate and mcp power; max power any', 'gate and\nmcp each ≤ 0.08, either ≤ 0.13'.replace('\n', ' '), R),
  p('fallback-steep', 101, 'fallback, full spillover + steep advisory erosion: gate power, option B', 'about 0.5', R),
  p('dz-mean', 107, 'option B, gate halves the slope: mean |d_z| / power / normal approximation', 'mean |d_z| of about 0.33', R),
  p('dz-power', 107, 'option B, gate halves the slope: power', 'power about 0.55', { ...R, known: { actual: 'power about 0.54', note: 'power.json has 0.535 (214/400), which the doc\'s own §4 table prints as 0.54; "about 0.55" rounds the other way. 0.55 is the "no arm x task interaction" sensitivity row.' } }),
  p('dz-approx', 108, 'option B, gate halves the slope: normal approximation of the power', 'approximation gives 0.57', R),
  p('poisson', 108, 'Poisson counts: mean |d_z| and power', 'd_z ≈ 0.56 and power 0.94', R),
  p('minp', 110, 'smallest two-sided sign-flip p-value with six clusters', '2/64 ≈ 0.031', R),
  p('null-range', 114, 'null rows (type I, block level, blocking) range', '0.02–0.04', R),
  p('c-turns', 117, 'extra step turns of option C over B', '+540 step turns', R),
  p('c-power', 118, 'gate power, B -> C (gate 0.5 / mcp 0.25)', 'from 0.54 to 0.77', R),
  p('e-turns', 118, 'extra step turns of option E over B', '+162 step turns', R),
  p('e-power', 118, 'gate power, option E', 'raises it to 0.71', R),
  p('d-power', 119, 'gate power, option D', 'drops it to\n   0.36'.replace(/\n\s+/, ' '), R),
  p('mcp-max', 120, 'max mcp power at a quarter reduction, any option', '≤ 0.33', R),
  p('od-poisson', 122, 'gate power under Poisson counts', '0.94 under Poisson', R),
  p('od-theta', 122, 'gate power at theta = 0.8', '0.31 at θ = 0.8', R),
];
// fix multi-line statements to what one line holds
for (const x of pnNumbers) {
  if (x.id === 'd-pn-fallback-each') { x.line = 100; x.stated = 'each ≤ 0.08, either ≤ 0.13'; }
  if (x.id === 'd-pn-d-power') { x.line = 119; x.stated = '0.36'; }
}

function normInv(pr) { // bisection on the normal CDF (erf via Abramowitz-Stegun 7.1.26 is too coarse; use a series)
  const cdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  let lo = -10; let hi = 10;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (cdf(m) < pr) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function erf(x) { // Taylor series, fine for |x| < 6
  let s = 0; let t = x; let k = 0;
  while (Math.abs(t) > 1e-17 && k < 500) { s += t / (2 * k + 1); k++; t *= -x * x / k; }
  return (2 / Math.sqrt(Math.PI)) * s;
}

async function runDesign(ctx) {
  const out = {};
  const raw = 'results/v1.3-reference/after-member-facts/raw';
  out['d-vp-dev-cases'] = String(ctx.ls(raw).reduce((a, s) => a + ctx.ls(`${raw}/${s}`).filter((f) => f.endsWith('.json')).length, 0));
  const minN = (m) => { let k = m + 1; while (ctx.wilson(k - m, k)[0] < 0.9) k++; return k; };
  out['d-hp-lb-0'] = `n ≥ ${minN(0)}`; out['d-hp-lb-1'] = `n ≥ ${minN(1)}`; out['d-hp-lb-2'] = `n ≥ ${minN(2)}`; out['d-hp-lb-0b'] = `fewer than ${minN(0)}`;
  const arms = ctx.sh(`node --import tsx -e "import('./scripts/lib/generators/arms.ts').then((m) => console.log(m.DAEDALUS_ARM_TOOLS.length))"`).trim();
  out['d-so-mcp-tools'] = `the ${arms} spec-only tools`;
  const rep = (ctx.read('scripts/lib/loop/prompts.ts').match(/export const MAX_REPAIR_FINDINGS = (\d+);/) ?? [])[1];
  out['d-so-repair-max'] = `at most ${rep} listed`;
  const blocks = 6 * 3 * 3; const runs = blocks * 3;
  out['d-so-blocks'] = `6 × 3 × 3 = **${blocks} blocks**`;
  out['d-so-runs'] = `**${runs} runs**`;
  const r10 = (x) => Math.round(x / 10) * 10;
  out['d-so-turns'] = `roughly ${r10(runs * 4)}–${r10(runs * 6)} step turns`;
  const za = normInv(1 - 0.025 / 2); const zb = normInv(0.8);
  out['d-so-z-alpha'] = `z ≈ ${za.toFixed(2)}`;
  out['d-so-z-beta'] = `z ≈ ${zb.toFixed(2)}`;
  // the doc plugs the rounded z values into n = ((2.24 + 0.84) / d_z)^2
  const zs = Number(za.toFixed(2)) + Number(zb.toFixed(2));
  out['d-so-dz-54'] = `d_z ≈ **${(zs / Math.sqrt(54)).toFixed(2)}**`;
  out['d-so-dz-36'] = `d_z ≈ **${(zs / Math.sqrt(36)).toFixed(2)}**`;
  return out;
}

async function runPower(ctx) {
  const d = ctx.out('d-pn-power');
  ctx.sh(`node --import tsx scripts/v1.3/study2-power.ts --sims 400 --flips 999 --seed 20261015 --out "${d}/power.json" --md-out "${d}/power.md"`, { timeout: 30 * 60_000 });
  const ident = readFileSync(join(d, 'power.json'), 'utf8') === ctx.read('results/v1.3-study2-power/power.json') && readFileSync(join(d, 'power.md'), 'utf8') === ctx.read('results/v1.3-study2-power/power.md');
  if (!ident) process.stderr.write('   d-pn-power: regenerated power.json/power.md differ from the committed files\n');
  const j = JSON.parse(readFileSync(join(d, 'power.json'), 'utf8'));
  const f = (x) => x.toFixed(2);
  const cell = (opt, eff, outcome = 'blocking', analysis = 'block') => j.cells.find((c) => c.design.startsWith(`${opt}:`) && c.outcome === outcome && c.analysis === analysis && c.effects.gate === eff[0] && c.effects.mcp === eff[1]);
  const out = {};
  out['d-pn-mcse'] = `at most ${Math.max(...j.cells.map((c) => c.mcSe))}`;
  for (const x of OPTS) {
    const c = cell(x, [0, 0]);
    out[`d-pn-design-${x}-blocks`] = String(c.blocks); out[`d-pn-design-${x}-runs`] = String(c.runs); out[`d-pn-design-${x}-turns`] = String(c.stepTurns);
    const v = [f(cell(x, [0, 0]).powerGate), f(cell(x, [0.2, 0.1]).powerGate), f(cell(x, [0.35, 0.2]).powerGate), f(cell(x, [0.5, 0.25]).powerGate),
      `${f(cell(x, [0.5, 0.5]).powerGate)} / ${f(cell(x, [0.5, 0.5]).powerMcp)}`, f(cell(x, [0.5, 0.25]).powerMcp), f(cell(x, [0.5, 0.25], 'blocking', 'task').powerGate)];
    RES_COLS.forEach((col, i) => { out[`d-pn-res-${x}-${col}`] = v[i]; });
  }
  for (const [, label] of SENS) {
    const s = j.sensitivity.find((y) => y.label === label).cell;
    out[`d-pn-sens-${sk(label)}-gate`] = f(s.powerGate); out[`d-pn-sens-${sk(label)}-mcp`] = f(s.powerMcp);
  }
  const fb = j.cells.filter((c) => c.outcome === 'advisory-per-kloc' && c.analysis === 'block');
  out['d-pn-fallback-each'] = `each ≤ ${f(Math.max(...fb.flatMap((c) => [c.powerGate, c.powerMcp])))}, either ≤ ${f(Math.max(...fb.map((c) => c.powerAny)))}`;
  const steep = j.sensitivity.find((y) => /steep erosion/.test(y.label)).cell;
  out['d-pn-fallback-steep'] = `about ${steep.powerGate.toFixed(1)}`;
  const b = cell('B', [0.5, 0.25]);
  out['d-pn-dz-mean'] = `mean |d_z| of about ${f(b.meanDzGate)}`;
  out['d-pn-dz-power'] = `power about ${f(b.powerGate)}`;
  out['d-pn-dz-approx'] = `approximation gives ${f(b.approxPowerGate)}`;
  const pois = j.sensitivity.find((y) => /^Poisson/.test(y.label)).cell;
  out['d-pn-poisson'] = `d_z ≈ ${f(pois.meanDzGate)} and power ${f(pois.powerGate)}`;
  const tp = cell('B', [0.5, 0.25], 'blocking', 'task');
  out['d-pn-minp'] = Math.abs(tp.minP - 2 / 64) < 1e-12 ? `2/64 ≈ ${tp.minP.toFixed(3)}` : `minP ${tp.minP}`;
  const nul = OPTS.map((x) => Number(f(cell(x, [0, 0]).powerGate)));
  out['d-pn-null-range'] = `${f(Math.min(...nul))}–${f(Math.max(...nul))}`;
  out['d-pn-c-turns'] = `+${cell('C', [0, 0]).stepTurns - cell('B', [0, 0]).stepTurns} step turns`;
  out['d-pn-c-power'] = `from ${f(b.powerGate)} to ${f(cell('C', [0.5, 0.25]).powerGate)}`;
  out['d-pn-e-turns'] = `+${cell('E', [0, 0]).stepTurns - cell('B', [0, 0]).stepTurns} step turns`;
  out['d-pn-e-power'] = `raises it to ${f(cell('E', [0.5, 0.25]).powerGate)}`;
  out['d-pn-d-power'] = f(cell('D', [0.5, 0.25]).powerGate);
  out['d-pn-mcp-max'] = `≤ ${f(Math.max(...OPTS.map((x) => cell(x, [0.5, 0.25]).powerMcp)))}`;
  out['d-pn-od-poisson'] = `${f(pois.powerGate)} under Poisson`;
  out['d-pn-od-theta'] = `${f(j.sensitivity.find((y) => /θ = 0.8/.test(y.label)).cell.powerGate)} at θ = 0.8`;
  return out;
}

export default [{
  id: 'd-design',
  title: 'Validation protocol, hold-out pre-spec and Study 2 outline: checkable facts and design arithmetic',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'results/v1.3-reference/after-member-facts/raw (case count); Wilson bound search; scripts/lib/generators/arms.ts DAEDALUS_ARM_TOOLS; scripts/lib/loop/prompts.ts MAX_REPAIR_FINDINGS; normal quantiles',
  numbers: [...vpNumbers, ...hpNumbers, ...soNumbers],
  run: runDesign,
}, {
  id: 'd-power',
  title: 'Study 2 power simulation notes: design, power and sensitivity tables',
  needs: 'offline',
  basis: 'regenerated',
  slow: true,
  how: 'node --import tsx scripts/v1.3/study2-power.ts --sims 400 --flips 999 --seed 20261015 --out <dir>/power.json --md-out <dir>/power.md (byte-identical to results/v1.3-study2-power/, ~4.5 min)',
  numbers: pnNumbers,
  run: runPower,
}];
