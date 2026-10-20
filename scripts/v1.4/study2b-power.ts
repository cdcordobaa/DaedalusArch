/**
 * Study 2b sample size from 2a Stage C (pre-registration draft `Docs/v1.4/study2b-preregistration.md` §3, steps 1, 3
 * and 4; placeholders P1–P3). Entry file: no exports. Helpers: `scripts/v1.4/lib/study2b-power.ts`.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/study2b-power.ts [--runs results/v1.4-exploratory/stage-c/rescore/runs.json]
 *     [--out-dir results/v1.4-study2b-power/resampling]
 *
 * Reads the registered D per run (freeze re-score, `correct` only: `runs[].registered.D`) and Y1, in the block order
 * hive-health r1, r2, ice-rink r1, r2, youth-league r1, r2. Writes <out-dir>/power.json and <out-dir>/tables.md.
 * Zero model calls, CPU only. Exit 0 ok, 1 a run or block is missing, 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BLOCK_ORDER, CELLS, CONTRASTS, STUDY2B_ALPHA, STUDY2B_GRID, STUDY2B_POWER_BAR, STUDY2B_SEED, STUDY2B_SIMS,
  cellStats, diffStats, minNonZeroPairs, pairedDiffs, resamplePower, smallestN, type Cell, type PowerResult,
} from './lib/study2b-power';

const argv = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? def : def;
};
const runsFile = opt('--runs', 'results/v1.4-exploratory/stage-c/rescore/runs.json');
const outDir = opt('--out-dir', 'results/v1.4-study2b-power/resampling');

interface RunRow { readonly cell: string; readonly block: string; readonly registered: { readonly D: number | null; readonly Y1: number | null } }
const runs = JSON.parse(fs.readFileSync(runsFile, 'utf8')) as RunRow[];

const perCell = {} as Record<Cell, number[]>;
let y1: number[] = [];
for (const cell of CELLS) {
  perCell[cell] = BLOCK_ORDER.map((block) => {
    const r = runs.find((x) => x.cell === cell && x.block === block);
    if (r === undefined || r.registered.D === null) {
      process.stderr.write(`missing registered D for ${cell} ${block}\n`);
      process.exit(1);
    }
    if (cell === 'none@L2') y1.push(r.registered.Y1 ?? NaN);
    return r.registered.D;
  });
}
y1 = y1.map(Number);

const f = (x: number | null, dp = 2): string => (x === null ? 'undefined' : x.toFixed(dp));
const cells = Object.fromEntries(CELLS.map((c) => [c, { D: perCell[c], ...cellStats(perCell[c]) }]));
const meanY1 = y1.reduce((a, b) => a + b, 0) / y1.length;
const floor = { alpha: STUDY2B_ALPHA, minNonZero: minNonZeroPairs(STUDY2B_ALPHA), holm2: minNonZeroPairs(0.05 / 2), holm3: minNonZeroPairs(0.05) };

const contrasts = CONTRASTS.map((c) => {
  const s = diffStats(pairedDiffs(perCell[c.reference], perCell[c.other]));
  const full: PowerResult[] = STUDY2B_GRID.map((n) => resamplePower(s.diffs, { n, half: false, directional: c.directional }));
  const half: PowerResult[] = STUDY2B_GRID.map((n) => resamplePower(s.diffs, { n, half: true, directional: c.directional }));
  return { ...c, ...s, blocksNeeded: s.p0 < 1 ? floor.minNonZero / (1 - s.p0) : null, full, half, smallestNHalf: smallestN(half), smallestNFull: smallestN(full) };
});

const powered = contrasts.filter((c) => c.directional);
const kept = powered.filter((c) => c.smallestNHalf !== null);
const N = kept.length === 0 ? null : Math.max(...kept.map((c) => c.smallestNHalf as number));
const choice = {
  rule: 'smallest grid N with power >= 0.80 at half size for every directional contrast kept; a contrast with no such N is demoted (grid not extended)',
  demoted: powered.filter((c) => c.smallestNHalf === null).map((c) => c.id),
  kept: kept.map((c) => c.id),
  N, r: N === null ? null : N / 4, turns: N === null ? null : 13 * N, turnCap: N === null ? null : 1.5 * 13 * N,
};

const json = { source: runsFile, seed: STUDY2B_SEED, sims: STUDY2B_SIMS, alpha: STUDY2B_ALPHA, grid: STUDY2B_GRID, bar: STUDY2B_POWER_BAR, pValue: 'exact two-sided sign-flip over all 2^n patterns', blocks: BLOCK_ORDER, y1, meanY1, cells, floor, contrasts, choice };

const md: string[] = [
  `# Study 2b resampling power (sims ${STUDY2B_SIMS}, seed ${STUDY2B_SEED}, α′ = ${STUDY2B_ALPHA.toFixed(4)})`, '',
  `Source: \`${runsFile}\` (registered D, freeze, \`correct\` only). Blocks: ${BLOCK_ORDER.join(', ')}.`, '',
  '| Cell | D per block | mean D | SD D | NB θ (moments) | P(D = 0) |', '|---|---|---|---|---|---|',
  ...CELLS.map((c) => { const s = cells[c] as ReturnType<typeof cellStats> & { D: number[] }; return `| ${c} | ${s.D.join(', ')} | ${f(s.mean)} | ${f(s.sd)} | ${f(s.theta)} | ${f(s.pZero)} |`; }),
  '', `Y₁: ${y1.join(', ')} (mean ${f(meanY1)}). Exactness floor at α′: ${floor.minNonZero} non-zero pairs (Holm 2nd ${floor.holm2}, 3rd ${floor.holm3}).`, '',
  '| Contrast | d_b | p₀ | q | mean d | SD d | blocks needed (step 1) |', '|---|---|---|---|---|---|---|',
  ...contrasts.map((c) => `| ${c.id}: ${c.reference} − ${c.other} | ${c.diffs.join(', ')} | ${f(c.p0)} | ${f(c.q)} | ${f(c.mean)} | ${f(c.sd)} | ${f(c.blocksNeeded, 1)} |`),
  '', '| Contrast | Size | ' + STUDY2B_GRID.map((n) => `N = ${n}`).join(' | ') + ' | smallest N ≥ 0.80 |', '|---|---|' + STUDY2B_GRID.map(() => '---|').join('') + '---|',
  ...contrasts.flatMap((c) => [
    `| ${c.id} | 2a size | ${c.full.map((r) => r.power.toFixed(3)).join(' | ')} | ${c.smallestNFull ?? 'none'} |`,
    `| ${c.id} | half size | ${c.half.map((r) => r.power.toFixed(3)).join(' | ')} | ${c.smallestNHalf ?? 'none'} |`,
  ]),
  '', 'H1, H2: rejections with the predicted sign (T > 0). H3: any rejection (not powered).', '',
  `Choice: kept ${choice.kept.join(', ') || 'none'}; demoted ${choice.demoted.join(', ') || 'none'}; N = ${choice.N ?? 'none'}, r = ${choice.r ?? '—'}, turns = ${choice.turns ?? '—'}, turn cap = ${choice.turnCap ?? '—'}.`, '',
];

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'power.json'), JSON.stringify(json, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'tables.md'), md.join('\n'));
process.stdout.write(md.join('\n'));
