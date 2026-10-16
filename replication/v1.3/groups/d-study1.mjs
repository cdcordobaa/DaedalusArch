// Study 1 descriptive re-run (Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md) and the Study 1 addenda
// (Docs/v1.3/study1-addenda.md): E1 aggregates regenerated with `study1-rerun.ts e1-agg` and the SO4 score + aggregates
// with `score-golden-cli.ts` + `study1-rerun.ts so4-agg` (all from the committed v1.3 reports, in scratch), plus counts
// re-derived from the committed reports, the plans and the ISE E1 cells. The v1.3 reports themselves need Neo4j and the
// E1/SO4/corpus checkouts outside the repository.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DOC = 'Docs/DiagnosticRuns/v1.3-study1-rerun-2026-10-15.md';
const ADD = 'Docs/v1.3/study1-addenda.md';
const E1 = 'results/v1.3-study1-rerun/e1';
const SO4 = 'results/v1.3-study1-rerun/so4';
const n = (id, line, what, stated, extra = {}) => ({ id: `d-s1-${id}`, doc: DOC, line, what, stated, ...extra });
const RAW = { basis: 're-derived' };

// E1 headline table (doc lines 65-79): [line, by_level_model model key, spec level, cells...]
const E1_COLS = ['n', 'files', 'loc', 'blkfile', 'anyblk', 'pass', 'blkahs', 'advshare', 'cv05', 'symfile', 'v12eahs', 'v12esym', 'v12ecv05'];
const E1_ROWS = [
  [65, 'claude-opus-5-5', 'none', '6', '11.0', '569', '0', '0/6', '6/6', '1.000', '1.000', '0.821', '1.167', '0.957', '1.112', '0.877'],
  [66, 'claude-opus-5-5', 'minimal-prose', '6', '34.2', '693', '0', '0/6', '6/6', '1.000', '1.000', '0.818', '1.153', '0.877', '1.153', '0.818'],
  [67, 'claude-opus-5-5', 'full-aac', '6', '39.3', '748', '0', '0/6', '6/6', '1.000', '1.000', '0.841', '1.122', '0.937', '1.122', '0.841'],
  [68, 'claude-sonnet-5-5', 'none', '6', '7.7', '315', '0', '0/6', '6/6', '1.000', '1.000', '0.852', '1.172', '0.957', '1.172', '0.852'],
  [69, 'claude-sonnet-5-5', 'minimal-prose', '6', '25.7', '462', '0', '0/6', '6/6', '1.000', '1.000', '0.815', '1.232', '0.882', '1.232', '0.815'],
  [70, 'claude-sonnet-5-5', 'full-aac', '6', '26.7', '536', '0', '0/6', '6/6', '1.000', '1.000', '0.849', '1.157', '0.920', '1.157', '0.849'],
  [71, 'claude-haiku-4-5', 'none', '3', '8.3', '285', '0', '0/3', '3/3', '1.000', '1.000', '0.742', '1.144', '0.929', '1.144', '0.742'],
  [72, 'claude-haiku-4-5', 'minimal-prose', '4', '20.0', '470', '0', '0/4', '4/4', '1.000', '1.000', '0.831', '1.042', '0.910', '1.042', '0.831'],
  [73, 'claude-haiku-4-5', 'full-aac', '4', '19.5', '472', '0', '0/4', '4/4', '1.000', '1.000', '0.806', '1.190', '0.895', '1.190', '0.806'],
  [74, 'all-claude', 'none', '15', '9.1', '411', '0', '0/15', '15/15', '1.000', '1.000', '0.816', '1.165', '0.951', '1.142', '0.842'],
  [75, 'all-claude', 'minimal-prose', '16', '27.4', '551', '0', '0/16', '16/16', '1.000', '1.000', '0.819', '1.155', '0.887', '1.155', '0.819'],
  [76, 'all-claude', 'full-aac', '16', '29.6', '600', '0', '0/16', '16/16', '1.000', '1.000', '0.838', '1.152', '0.920', '1.152', '0.838'],
  [77, 'gpt-5.6-terra', 'none', '6', '6.3', '254', '0', '0/6', '6/6', '1.000', '1.000', '0.776', '1.313', '0.926', '1.313', '0.776'],
  [78, 'gpt-5.6-terra', 'minimal-prose', '6', '10.5', '274', '0', '0/6', '6/6', '1.000', '1.000', '0.887', '1.126', '0.957', '1.126', '0.887'],
  [79, 'gpt-5.6-terra', 'full-aac', '6', '13.3', '320', '0', '0/6', '6/6', '1.000', '1.000', '0.842', '1.191', '0.942', '1.191', '0.842'],
];
const mk = (m) => m.replace(/^claude-/, '').replace(/-5-5$|-4-5$/, (x) => x).replace(/\./g, '');
// SO4 operator table (doc lines 128-137)
const SO4_OPS = [
  [128, 'MO-C04', '14/14', '14/14', '12/12', '11/12'], [129, 'MO-CV02', '12/12', '12/12', '12/12', '12/12'],
  [130, 'MO-DF01', '5/5', '5/5', '7/7', '7/7'], [131, 'MO-P01', '13/13', '13/13', '8/10', '8/10'],
  [132, 'MO-S01', '8/8 (+2 n/a)', '8/8 (+2 n/a)', '7/10', '7/10'], [133, 'MO-S03', '2/2', '2/2', '2/2', '2/2'],
  [134, 'MO-SO01', '11/11', '11/11', '12/12', '12/12'], [135, 'MO-SO02', '2/2', '2/2', '—', '—'],
  [136, 'MO-X01', '0/6', '6/6', '8/8', '8/8'],
];
const SO4_COLS = ['rec12e', 'rec13', 'twin12e', 'twin13'];
// SO4 bases (doc lines 154-160)
const BASES = [
  [154, 'realworld-test', 'FF-S02 2, FF-P01 5', '0.667'], [155, 'ghostfolio-test', 'FF-S01 44, FF-S04 33, FF-P01 1', '0.487'],
  [156, 'truthy-demo', 'FF-S01 4, FF-S02 4, FF-P01 6, FF-P03 6', '0.333'], [157, 'dry-run-test', 'FF-S01 3, FF-P01 5, FF-P03 9', '0.513'],
  [158, 'zhuravlevma__nestjs-active-record', 'FF-S02 1, FF-P01 2, FF-P03 2', '0.513'],
  [159, 'nestjslatam__ddd', 'FF-S01 16, FF-S02 44, FF-P01 1, FF-P03 2', '0.333'], [160, 'v-aguiar__valex', 'FF-S01 2, FF-S02 3, FF-S03 3', '0.462'],
];
const bid = (b) => b.replace(/__.*/, '').replace(/-test$/, '');

const NC = (note) => ({ needs: 'not-checkable', note });
const numbers = [
  n('e1-coords', 21, 'E1 coordinates in experiments/e1-grid/plan.json (models x levels x tasks x runs)', '72', RAW),
  n('e1-cells', 25, 'E1 cells with src/ evaluated', '72'),
  n('e1-accepted', 25, 'cells Study 1 accepted', '65'),
  n('e1-claude', 25, 'accepted Claude cells', '47'),
  n('e1-codex', 25, 'accepted Codex cells', '18'),
  n('e1-gentc', 25, 'GEN-TYPECHECK cells (Haiku)', '7'),
  n('e1-sizes', 26, 'cells whose files and LOC equal Study 1 so5_grid.csv', 'all 72', RAW),
  n('so4-entries', 28, 'SO4 plan entries', '163', RAW),
  n('so4-bases', 28, 'SO4 held-out bases', '7', RAW),
  n('so4-copies', 28, 'SO4 seeded copies', '156', RAW),
  n('so4-readonly', 30, 'SO4 runs with no file modified', '163/163', NC('the driver\'s read-only check is not logged in the committed run records.')),
  n('mem-free', 43, 'memory_pressure free share during the runs', '34–35%', NC('environment observation, no log committed.')),
  n('passes', 43, 'E1 passes / SO4 passes run with HEAVY_ADMISSION_BYPASS', 'the four E1 passes, the two SO4 passes', NC('process narrative, no log committed.')),
  n('incident-cell', 45, 'cell at which the first E1 pass lost its work dir', 'cell 33', NC('incident narrative, no log committed.')),
  n('rep-e1-passes', 51, 'E1 full passes', '2 full passes (all 72 cells)', NC('pass 2 is not committed (audit E-6).')),
  n('rep-e1-files', 51, 'E1 files compared: reports + size files', '72 reports + 72 size files', RAW),
  n('rep-e1-ident', 51, 'E1 byte-identical files across the two passes', '144/144', NC('pass 2 is not committed (audit E-6).')),
  n('rep-so4-passes', 52, 'SO4 full passes', '2 full passes (all 163 projects)', NC('pass 2 is not committed (audit E-6).')),
  n('rep-so4-files', 52, 'SO4 files compared: reports + run records', '163 reports + 163 run records', RAW),
  n('rep-so4-ident', 52, 'SO4 byte-identical files across the two passes', '326/326', NC('pass 2 is not committed (audit E-6).')),
  n('headline-n', 56, 'accepted cells in the headline table', '65'),
  ...E1_ROWS.flatMap(([line, model, level, ...cells]) => E1_COLS.map((c, j) => n(`e1-${mk(model)}-${level}-${c}`, line, `E1 table ${c}, ${model} ${level}`, cells[j]))),
  n('gentc-blocking', 83, 'blocking findings in the 7 GEN-TYPECHECK cells', '0'),
  n('gentc-advisory', 83, 'advisory counts of the 7 GEN-TYPECHECK cells (range)', '4 to 24'),
  n('blk-65', 88, 'cells with a blocking finding, accepted', '0 of 65'),
  n('blk-72', 88, 'cells with a blocking finding, all', '0 of all 72'),
  n('blk-ahs', 88, 'blocking AHS of every cell', '1.000'),
  n('dir-ahs', 90, 'Study 1 Claude ahsCombined none > full-aac > minimal-prose', '0.951 > `full-aac` 0.920 > `minimal-prose` 0.887'),
  n('c02-none', 94, 'Claude none cells where FF-C02 fires', '0/15'),
  n('c02-min', 94, 'Claude minimal-prose cells where FF-C02 fires', '15/16'),
  n('v12e-blk-rule', 95, 'v12e_share_cells_any_v13_blocking_rule', '0 everywhere'),
  n('claude-files', 97, 'Claude mean files none / minimal-prose / full-aac', '9.1 / 27.4 / 29.6'),
  n('claude-sym13', 99, 'Claude v1.3 symbolic findings per file by level', '1.165 / 1.155 / 1.152'),
  n('claude-sym12', 99, 'Claude Study 1 symbolic findings per file by level', '1.142 / 1.155 / 1.152'),
  n('barrel-cells', 99, 'barrel cells behind the none-row difference', 'one barrel cell'),
  n('cv05-v13', 102, 'FF-CV05 findings of all symbolic findings, 65 cells, v1.3', '1 184 of 1 428 findings over the 65 cells (0.829)'),
  n('cv05-v12e', 102, 'FF-CV05 of all symbolic findings, Study 1', '1 184 of 1 423 in Study 1 (0.832)'),
  n('cv05-claude', 102, 'FF-CV05 share, Claude arm, v1.3', '1 003 of 1 213 (0.827)'),
  n('cv05-claude-v12e', 102, 'FF-CV05 share, Claude arm, Study 1', '0.830'),
  n('cv05-ahs-cost', 103, 'AHS cost of FF-CV05 per cell under v1.2E', '0.0125', NC('a property of the v1.2E scoring weights, not of a committed output; not re-derived here.')),
  n('c03-net', 103, 'net extra FF-C03 findings', '5'),
  n('blocking-rules', 111, 'blocking rules (verdict basis)', '6'),
  n('advisory-rules', 111, 'other (advisory) rules', '16'),
  n('ahs-det', 112, 'cells where Study 1 ahsDeterministic is reproduced exactly', '65/65'),
  n('v12e-verdict', 112, 'cells where the report v12eVerdict equals the Study 1 verdict', '65/65'),
  n('blk-ahs-2', 112, 'blocking AHS in every cell', '1.000'),
  n('c03-pm', 113, 'FF-C03 added / removed in e1-grid-001', '+6 / −1'),
  n('c03-files', 113, 'files behind the barrels that now read instability 1', '6'),
  n('c03-net2', 113, 'net FF-C03 change in e1-grid-001', 'net +5'),
  n('barrel-edges', 113, 'literal IMPORTS edges gained by e1-grid-001 (before -> after)', '9 literal `IMPORTS` edges to its two barrels (37 → 46)'),
  n('e016-imports', 114, 'IMPORTS edges gained by e1-grid-016', '+2'),
  n('e016-findings', 114, 'findings changed in e1-grid-016', '0'),
  n('other-cells', 115, 'cells with no other change', '63'),
  n('other-count', 115, 'other findings changed', '0'),
  n('disabled-same', 116, 'cells whose disabled set equals Study 1', 'all 65'),
  n('dyn-0', 118, 'unsupportedDynamic before and after, all cells', '0'),
  n('c03-rows', 120, 'FF-C03 rows changed in the one barrel cell', '7'),
  ...SO4_OPS.flatMap(([line, op, ...cells]) => SO4_COLS.map((c, j) => n(`so4-${op.toLowerCase()}-${c}`, line, `SO4 ${c}, ${op}`, cells[j]))),
  n('so4-total-rec12e', 137, 'SO4 recall total v1.2E', '67/73 = 0.918'),
  n('so4-total-rec13', 137, 'SO4 recall total v1.3', '73/73 = 1.000'),
  n('so4-total-twin12e', 137, 'SO4 twin specificity total v1.2E', '68/73 = 0.932'),
  n('so4-total-twin13', 137, 'SO4 twin specificity total v1.3', '67/73 = 0.918'),
  n('seeds-changed', 139, 'seeds that changed', '7'),
  n('x01-changed', 141, 'MO-X01 seeds missed -> matched', '6 seeds'),
  n('x01-per-base', 141, 'MO-X01 changed seeds per base (nestjslatam, truthy, zhuravlevma)', 'nestjslatam__ddd ×2, truthy-demo ×2 and zhuravlevma__nestjs-active-record ×2'),
  n('x01-collateral', 143, 'new undeclared findings per changed MO-X01 seed', 'one new undeclared finding (truthy-demo:MO-X01:0 carries 2'),
  n('c03-v12e-inst', 145, 'v1.2E FF-C03 instability of article.controller.ts on the realworld base', '0.83', RAW),
  n('bases-fail', 150, 'SO4 bases, each failing the v1.3 blocking verdict', '7', RAW),
  ...BASES.flatMap(([line, b, rules, ahs]) => [
    n(`base-${bid(b)}-rules`, line, `blocking rules with findings, ${b}`, rules, RAW),
    n(`base-${bid(b)}-ahs`, line, `blocking AHS, ${b}`, ahs, RAW),
  ]),
  n('base-nestjslatam-sym', 159, 'nestjslatam__ddd symbolic findings v1.2E -> v1.3', '204 → 281', RAW),
  n('lim-65', 165, 'E1 projects with uniform 0 blocking', '65'),
  n('lim-six', 165, 'blocking constraints', 'six'),
  n('lim-7373', 166, 'SO4 recall v1.3', '73/73'),
];

const A = (id, line, what, stated, extra = {}) => ({ id: `d-add-${id}`, doc: ADD, line, what, stated, basis: 're-derived', ...extra });
const addNumbers = [
  A('cells', 9, 'accepted E1 cells in the ISE E1 run', '65'),
  A('none-cells', 9, 'none cells among them', '21'),
  A('three', 9, 'layer folders every cell uses (src/domain, src/application, src/infrastructure)', 'three'),
  A('clean', 10, 'cells ISE classifies as clean-architecture', 'every cell'),
  A('same-spec', 11, 'cells where the inferred spec equals the given spec (extrinsic = intrinsic)', 'every cell'),
  A('no-blocking', 16, 'E1 cells with a blocking violation under the v1.3 blocking rules, any spec level', 'no E1 cell'),
];

const f3 = (x) => x.toFixed(3);
const sumBy = (rows, f) => rows.reduce((a, r) => a + f(r), 0);
const ruleOrder = (id) => { const m = id.match(/^FF-([A-Z]+)(\d+)$/); return `${{ S: 0, P: 1 }[m[1]] ?? 2}${m[1]}${m[2].padStart(3, '0')}`; };

async function runS1(ctx) {
  const T = ctx.tree();
  const e1o = ctx.out('d-s1-e1agg'); const so4o = ctx.out('d-s1-so4agg');
  ctx.sh(`node --import tsx scripts/v1.3/study1-rerun.ts e1-agg --run ${E1} --out "${e1o}"`, { cwd: T });
  ctx.sh(`node --import tsx scripts/score-golden-cli.ts --case ${SO4}/case --out "${so4o}/score.json"`, { cwd: T });
  ctx.sh(`node --import tsx scripts/v1.3/study1-rerun.ts so4-agg --run "${so4o}" --out "${so4o}"`, { cwd: T });
  const ident = [];
  for (const f of ['by_level_model.csv', 'cells.csv', 'rule_changes.csv', 'finding_changes.csv', 'graph_changes.csv', 'disabled_changes.json', 'README.md']) ident.push(readFileSync(join(e1o, f), 'utf8') === ctx.read(`${E1}/${f}`));
  for (const f of ['score.json', 'by_operator.csv', 'seed_changes.csv', 'summary.json']) ident.push(readFileSync(join(so4o, f), 'utf8') === ctx.read(`${SO4}/${f}`));
  if (ident.includes(false)) process.stderr.write(`   d-s1: a regenerated aggregate differs from the committed file (${ident})\n`);

  const out = {};
  const cells = ctx.csv(join(e1o, 'cells.csv'));
  const blm = ctx.csv(join(e1o, 'by_level_model.csv'));
  const acc = cells.filter((c) => c.study1_status === 'accepted');
  const plan = ctx.json('experiments/e1-grid/plan.json').e1;
  out['d-s1-e1-coords'] = String(plan.models.length * plan.specLevels.length * plan.tasks.length * plan.runs);
  out['d-s1-e1-cells'] = String(cells.length);
  out['d-s1-e1-accepted'] = String(acc.length);
  out['d-s1-e1-claude'] = String(acc.filter((c) => c.model.startsWith('claude-')).length);
  out['d-s1-e1-codex'] = String(acc.filter((c) => !c.model.startsWith('claude-')).length);
  const gtc = cells.filter((c) => c.study1_status !== 'accepted');
  out['d-s1-e1-gentc'] = gtc.every((c) => c.model === 'claude-haiku-4-5') ? String(gtc.length) : `${gtc.length} (not all Haiku)`; // cells.csv status: not-run:generation-failed
  // sizes vs Study 1 so5_grid.csv
  const so5 = ctx.csv('results/e1-grid/agg/so5_grid.csv');
  const key = (m, t, l, r) => `${m}|${t}|${l}|${r}`;
  const so5m = new Map(so5.map((r) => [key(r.requested_model_id, r.task_id, r.spec_level, r.run_index), r]));
  let same = 0;
  for (const c of cells) { const s = so5m.get(key(c.model, c.task_id, c.spec_level, c.run_index)); if (s && Number(s.file_count) === Number(c.files) && Number(s.loc) === Number(c.loc)) same++; }
  out['d-s1-e1-sizes'] = same === cells.length ? `all ${same}` : `${same} of ${cells.length}`;
  const so4plan = ctx.json('experiments/so4-heldout/plan.json').projects;
  out['d-s1-so4-entries'] = String(so4plan.length);
  out['d-s1-so4-bases'] = String(so4plan.filter((p) => !/:MO-|_MO-/.test(p.projectId) && !/MO-/.test(p.projectId)).length);
  out['d-s1-so4-copies'] = String(so4plan.filter((p) => /MO-/.test(p.projectId)).length);
  const rep = ctx.ls(`${E1}/reports`);
  out['d-s1-rep-e1-files'] = `${rep.filter((f) => !f.endsWith('.size.json')).length} reports + ${rep.filter((f) => f.endsWith('.size.json')).length} size files`;
  const srep = ctx.ls(`${SO4}/case/reports`);
  out['d-s1-rep-so4-files'] = `${srep.filter((f) => !f.endsWith('.run.json')).length} reports + ${srep.filter((f) => f.endsWith('.run.json')).length} run records`;
  out['d-s1-headline-n'] = String(acc.length);

  // E1 table: n, files, LOC, shares and AHS from by_level_model.csv; the per-file means from cells.csv (one rounding).
  for (const [, model, level] of E1_ROWS) {
    const row = blm.find((r) => r.model === (model === 'gpt-5.6-terra' ? 'gpt-5.6-terra' : model) && r.spec_level === level);
    const cs = acc.filter((c) => c.spec_level === level && (model === 'all-claude' ? c.model.startsWith('claude-') : c.model === model));
    const nn = Number(row.n_cells);
    const mean = (f) => sumBy(cs, f) / cs.length;
    const fmt0 = (x) => (Number(x) === 0 ? '0' : String(x));
    const v = {
      n: String(nn), files: Number(row.mean_files).toFixed(1), loc: Number(row.mean_loc).toFixed(0),
      blkfile: fmt0(row.v13_mean_blocking_per_file), anyblk: `${Math.round(Number(row.v13_share_cells_any_blocking) * nn)}/${nn}`,
      pass: `${nn - Math.round(Number(row.v13_share_cells_fail) * nn)}/${nn}`, blkahs: row.v13_mean_blocking_ahs,
      advshare: row.v13_advisory_share, cv05: row.v13_cv05_share,
      symfile: f3(mean((c) => (Number(c.v13_blocking_findings) + Number(c.v13_advisory_findings)) / Number(c.files))),
      v12eahs: row.v12e_mean_ahs_combined, v12esym: f3(mean((c) => Number(c.v12e_symbolic_findings) / Number(c.files))), v12ecv05: row.v12e_cv05_share,
    };
    if (cs.length !== nn) v.n = `${nn} (cells.csv ${cs.length})`;
    E1_COLS.forEach((c) => { out[`d-s1-e1-${mk(model)}-${level}-${c}`] = v[c]; });
  }
  const gAdv = gtc.map((c) => Number(c.v13_advisory_findings));
  out['d-s1-gentc-blocking'] = String(sumBy(gtc, (c) => Number(c.v13_blocking_findings)));
  out['d-s1-gentc-advisory'] = `${Math.min(...gAdv)} to ${Math.max(...gAdv)}`;
  out['d-s1-blk-65'] = `${acc.filter((c) => Number(c.v13_blocking_findings) > 0).length} of ${acc.length}`;
  out['d-s1-blk-72'] = `${cells.filter((c) => Number(c.v13_blocking_findings) > 0).length} of all ${cells.length}`;
  const ahsAll = [...new Set(cells.map((c) => c.v13_blocking_ahs))];
  out['d-s1-blk-ahs'] = ahsAll.length === 1 ? ahsAll[0] : ahsAll.join('/');
  out['d-s1-blk-ahs-2'] = out['d-s1-blk-ahs'];
  const cl = (lvl) => blm.find((r) => r.model === 'all-claude' && r.spec_level === lvl);
  out['d-s1-dir-ahs'] = `${cl('none').v12e_mean_ahs_combined} > \`full-aac\` ${cl('full-aac').v12e_mean_ahs_combined} > \`minimal-prose\` ${cl('minimal-prose').v12e_mean_ahs_combined}`;
  const claude = acc.filter((c) => c.model.startsWith('claude-'));
  const c02 = (lvl) => { const cs = claude.filter((c) => c.spec_level === lvl); return `${cs.filter((c) => /FF-C02=/.test(c.v13_advisory_by_rule)).length}/${cs.length}`; };
  out['d-s1-c02-none'] = c02('none');
  out['d-s1-c02-min'] = c02('minimal-prose');
  out['d-s1-v12e-blk-rule'] = blm.every((r) => Number(r.v12e_share_cells_any_v13_blocking_rule) === 0) ? '0 everywhere' : 'not 0 everywhere';
  const lv = ['none', 'minimal-prose', 'full-aac'];
  out['d-s1-claude-files'] = lv.map((l) => out[`d-s1-e1-all-claude-${l}-files`]).join(' / ');
  out['d-s1-claude-sym13'] = lv.map((l) => out[`d-s1-e1-all-claude-${l}-symfile`]).join(' / ');
  out['d-s1-claude-sym12'] = lv.map((l) => out[`d-s1-e1-all-claude-${l}-v12esym`]).join(' / ');
  const symDiff = acc.filter((c) => Number(c.v13_blocking_findings) + Number(c.v13_advisory_findings) !== Number(c.v12e_symbolic_findings));
  out['d-s1-barrel-cells'] = symDiff.length === 1 ? 'one barrel cell' : `${symDiff.length} cells`;
  const sp = (x) => x.toLocaleString('en-US').replace(/,/g, ' ');
  const tot13 = sumBy(acc, (c) => Number(c.v13_blocking_findings) + Number(c.v13_advisory_findings));
  const cv13 = sumBy(acc, (c) => Number(c.v13_cv05_findings));
  const tot12 = sumBy(acc, (c) => Number(c.v12e_symbolic_findings));
  const cv12 = sumBy(acc, (c) => Number(c.v12e_cv05_findings));
  out['d-s1-cv05-v13'] = `${sp(cv13)} of ${sp(tot13)} findings over the ${acc.length} cells (${f3(cv13 / tot13)})`;
  out['d-s1-cv05-v12e'] = `${sp(cv12)} of ${sp(tot12)} in Study 1 (${f3(cv12 / tot12)})`;
  const ctot = sumBy(claude, (c) => Number(c.v13_blocking_findings) + Number(c.v13_advisory_findings));
  const ccv = sumBy(claude, (c) => Number(c.v13_cv05_findings));
  out['d-s1-cv05-claude'] = `${sp(ccv)} of ${sp(ctot)} (${f3(ccv / ctot)})`;
  out['d-s1-cv05-claude-v12e'] = f3(sumBy(claude, (c) => Number(c.v12e_cv05_findings)) / sumBy(claude, (c) => Number(c.v12e_symbolic_findings)));

  const rc = ctx.csv(join(e1o, 'rule_changes.csv'));
  const c03 = rc.find((r) => r.function_id === 'FF-C03');
  out['d-s1-c03-net'] = String(Number(c03.added) - Number(c03.removed));
  out['d-s1-blocking-rules'] = String(rc.filter((r) => r.v13_tier === 'blocking').length);
  out['d-s1-advisory-rules'] = String(rc.filter((r) => r.v13_tier === 'advisory').length);
  out['d-s1-ahs-det'] = `${acc.filter((c) => c.v13_ahs_deterministic === c.v12e_ahs_deterministic).length}/${acc.length}`;
  out['d-s1-v12e-verdict'] = `${acc.filter((c) => c.v13_v12e_verdict === c.v12e_verdict).length}/${acc.length}`;
  const fc = ctx.csv(join(e1o, 'finding_changes.csv'));
  const add = fc.filter((r) => r.change === 'added'); const rem = fc.filter((r) => r.change === 'removed');
  out['d-s1-c03-pm'] = `+${sumBy(add, (r) => Number(r.count))} / −${sumBy(rem, (r) => Number(r.count))}`;
  out['d-s1-c03-files'] = String(new Set(add.map((r) => r.file_path)).size);
  out['d-s1-c03-net2'] = `net +${sumBy(add, (r) => Number(r.count)) - sumBy(rem, (r) => Number(r.count))}`;
  const gc = ctx.csv(join(e1o, 'graph_changes.csv'));
  const g001 = gc.find((r) => r.run_id.startsWith('e1-grid-001-'));
  out['d-s1-barrel-edges'] = `${Number(g001.v13_imports) - Number(g001.v12e_imports)} literal \`IMPORTS\` edges to its two barrels (${g001.v12e_imports} → ${g001.v13_imports})`;
  const g016 = gc.find((r) => r.run_id.startsWith('e1-grid-016-'));
  out['d-s1-e016-imports'] = `+${Number(g016.v13_imports) - Number(g016.v12e_imports)}`;
  out['d-s1-e016-findings'] = String(fc.filter((r) => r.run_id.startsWith('e1-grid-016-')).length);
  const changedCells = new Set([...fc.map((r) => r.run_id), ...gc.filter((r) => r.v12e_imports !== r.v13_imports).map((r) => r.run_id)]);
  const accIds = new Set(acc.map((c) => c.run_id));
  out['d-s1-other-cells'] = String([...accIds].filter((id) => !changedCells.has(id)).length);
  out['d-s1-other-count'] = String(fc.filter((r) => !r.run_id.startsWith('e1-grid-001-')).length);
  const dis = JSON.parse(readFileSync(join(e1o, 'disabled_changes.json'), 'utf8'));
  out['d-s1-disabled-same'] = Object.keys(dis).filter((k) => accIds.has(k)).length === 0 ? `all ${acc.length}` : `${acc.length - Object.keys(dis).length}`;
  out['d-s1-dyn-0'] = String(Math.max(...gc.map((r) => Math.max(Number(r.v12e_unsupported_dynamic), Number(r.v13_unsupported_dynamic)))));
  out['d-s1-c03-rows'] = String(sumBy(fc.filter((r) => r.function_id === 'FF-C03'), (r) => Number(r.count)));

  // SO4
  const bo = ctx.csv(join(so4o, 'by_operator.csv'));
  for (const [, op] of SO4_OPS) {
    const r = bo.find((x) => x.operator_id === op);
    const na = (o) => (o ? ` (+${o.split('=')[1]} n/a)` : '');
    const v = [`${r.v12e_recall}${na(r.v12e_other)}`, `${r.v13_recall}${na(r.v13_other)}`, r.v12e_twin_specificity || '—', r.v13_twin_specificity || '—'];
    SO4_COLS.forEach((c, j) => { out[`d-s1-so4-${op.toLowerCase()}-${c}`] = v[j]; });
  }
  const sm = JSON.parse(readFileSync(join(so4o, 'summary.json'), 'utf8'));
  const frac = (s) => { const [a, b] = s.split('/').map(Number); return `${s} = ${f3(a / b)}`; };
  out['d-s1-so4-total-rec12e'] = frac(sm.recall.v12e);
  out['d-s1-so4-total-rec13'] = frac(sm.recall.v13);
  out['d-s1-so4-total-twin12e'] = frac(sm.twinSpecificity.v12e);
  out['d-s1-so4-total-twin13'] = frac(sm.twinSpecificity.v13);
  out['d-s1-lim-7373'] = sm.recall.v13;
  const scg = ctx.csv(join(so4o, 'seed_changes.csv'));
  out['d-s1-seeds-changed'] = String(sm.seedsChanged === scg.length ? scg.length : `${sm.seedsChanged}/${scg.length}`);
  const x01 = scg.filter((r) => r.operator_id === 'MO-X01' && r.v12e_status === 'missed' && r.v13_status === 'matched');
  out['d-s1-x01-changed'] = `${x01.length} seeds`;
  const per = (b) => x01.filter((r) => r.seed_id.startsWith(`${b}:`)).length;
  out['d-s1-x01-per-base'] = `nestjslatam__ddd ×${per('nestjslatam__ddd')}, truthy-demo ×${per('truthy-demo')} and zhuravlevma__nestjs-active-record ×${per('zhuravlevma__nestjs-active-record')}`;
  const nNew = x01.map((r) => [r.seed_id, JSON.parse(r.v13_undeclared_new).length]);
  const odd = nNew.filter(([, k]) => k !== 1);
  out['d-s1-x01-collateral'] = odd.length === 0 ? 'one new undeclared finding:' : `one new undeclared finding (${odd.map(([s, k]) => `${s} carries ${k}`).join(', ')}`;
  const rw2 = ctx.json('results/so4-heldout/v2/case/reports/so4-heldout-000-realworld-test.json');
  const ac = rw2.violations.find((v) => v.functionId === 'FF-C03' && v.filePath === 'src/article/article.controller.ts');
  const rw3 = ctx.json(`${SO4}/case/reports/so4-heldout-000-realworld-test.json`);
  const ac3 = rw3.violations.find((v) => v.functionId === 'FF-C03' && v.filePath === 'src/article/article.controller.ts');
  out['d-s1-c03-v12e-inst'] = ac && !ac3 ? Number(ac.evidence[0].split('=')[1]).toFixed(2) : `v1.2E ${ac?.evidence}, v1.3 ${ac3 ? 'present' : 'absent'}`;
  // bases: committed v1.3 reports (regenerating them needs Neo4j and the corpus checkouts)
  let fails = 0;
  for (const [, b] of BASES) {
    const f = srep.find((x) => new RegExp(`^so4-heldout-\\d{3}-${b}\\.json$`).test(x));
    const r = ctx.json(`${SO4}/case/reports/${f}`);
    if (r.tiers.verdict === 'fail') fails++;
    const rules = r.tiers.blocking.rules.filter((x) => x.violated).sort((a, c) => (ruleOrder(a.functionId) < ruleOrder(c.functionId) ? -1 : 1));
    out[`d-s1-base-${bid(b)}-rules`] = rules.map((x) => `${x.functionId} ${x.violationCount}`).join(', ');
    out[`d-s1-base-${bid(b)}-ahs`] = f3(r.tiers.blockingAhs);
    if (b === 'nestjslatam__ddd') {
      const v2 = ctx.json(`results/so4-heldout/v2/case/reports/${f}`);
      const sym = (x) => x.violations.filter((v) => v.route === 'symbolic').length;
      out['d-s1-base-nestjslatam-sym'] = `${sym(v2)} → ${sym(r)}`;
    }
  }
  out['d-s1-bases-fail'] = String(fails);
  out['d-s1-lim-65'] = String(acc.filter((c) => Number(c.v13_blocking_findings) === 0).length);
  out['d-s1-lim-six'] = ({ 6: 'six' })[rc.filter((r) => r.v13_tier === 'blocking').length] ?? '?';
  return out;
}

async function runAdd(ctx) {
  const cells = ctx.json('results/v1.3-ise-e1/cells.json');
  const out = {};
  out['d-add-cells'] = String(cells.length);
  out['d-add-none-cells'] = String(cells.filter((c) => c.level === 'none').length);
  const dirs = new Set(cells.map((c) => c.ise.layers.flatMap((l) => l.directories).sort().join(' ')));
  out['d-add-three'] = dirs.size === 1 && [...dirs][0] === 'src/application/** src/domain/** src/infrastructure/**' ? 'three' : [...dirs].join(' | ');
  out['d-add-clean'] = cells.every((c) => c.ise.style === 'clean-architecture') ? 'every cell' : `${cells.filter((c) => c.ise.style === 'clean-architecture').length} cells`;
  const same = cells.filter((c) => c.ise.styleMatch && JSON.stringify(c.extrinsic.violatedSites) === JSON.stringify(c.intrinsic.violatedSites)
    && c.extrinsic.blockingFindings === c.intrinsic.blockingFindings && c.extrinsic.advisoryFindings === c.intrinsic.advisoryFindings);
  out['d-add-same-spec'] = same.length === cells.length ? 'every cell' : `${same.length} cells`;
  const s1 = ctx.csv(`${E1}/cells.csv`);
  const blk = s1.filter((c) => Number(c.v13_blocking_findings) > 0).length + cells.filter((c) => c.extrinsic.blockingFindings > 0).length;
  out['d-add-no-blocking'] = blk === 0 ? 'no E1 cell' : `${blk} cells`;
  return out;
}

export default [{
  id: 'd-s1',
  title: 'Study 1 descriptive re-run: E1 and SO4 aggregates, change attribution, SO4 bases',
  needs: 'offline',
  basis: 'regenerated',
  slow: false,
  how: 'node --import tsx scripts/v1.3/study1-rerun.ts e1-agg --run results/v1.3-study1-rerun/e1 --out <dir>; node --import tsx scripts/score-golden-cli.ts --case results/v1.3-study1-rerun/so4/case --out <dir>/score.json; node --import tsx scripts/v1.3/study1-rerun.ts so4-agg --run <dir> --out <dir> (all byte-identical to the committed files)',
  numbers,
  run: runS1,
}, {
  id: 'd-add',
  title: 'Study 1 addenda A1: the E1 none arm, from the ISE E1 cells and the Study 1 re-run cells',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'results/v1.3-ise-e1/cells.json, results/v1.3-study1-rerun/e1/cells.csv',
  numbers: addNumbers,
  run: runAdd,
}];
