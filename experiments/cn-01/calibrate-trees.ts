/**
 * CN-01 N5 (2026-10-27), zero calls: calibrate the v1.5 rules on every recorded agent final tree of P1, P2 and P5
 * (PUZZLE-01 to 04, all arms), with the R6 oracle verdicts (`experiments/v15-stage0/results/rescore-r6.json`) as the
 * label. Per sub-goal: the oracle says trapped (FAIL) or not; the instrument says a rule mapped to the sub-goal's family
 * fired or not. Development evidence: the rules and these puzzles were written by the same project.
 *
 *   npx tsx experiments/cn-01/calibrate-trees.ts
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';

const RUN_DIR: Record<string, string> = {
  'PUZZLE-01 baseline (none)': 'results/v1.4-puzzle-01-baseline',
  'PUZZLE-02 tool arm (mcp-detect, pull)': 'results/v1.4-puzzle-02-tool-arm',
  'PUZZLE-03 baseline (none)': 'results/v1.4-puzzle-03-baseline',
  'PUZZLE-04 gate': 'results/v1.4-puzzle-04/gate',
  'PUZZLE-04 pull': 'results/v1.4-puzzle-04/pull',
};
const PUZZLE_DIR: Record<string, string> = {
  'p1-transfers': 'experiments/puzzle-01/puzzles/p1-transfers',
  'p2-loyalty': 'experiments/puzzle-01/puzzles/p2-loyalty',
  'p5-ferry-seats': 'experiments/puzzle-03/puzzles/p5-ferry-seats',
};
/** Sub-goal → the v1.5 rules whose finding means "trap present". */
const SUBGOAL_RULES: Record<string, readonly string[]> = {
  'p1-transfers/SG1': ['R-D4', 'R-REF'],
  'p1-transfers/SG2': ['R-D5', 'R-D5S', 'R-D3', 'R-LOCK'],
  'p2-loyalty/SG1': ['R-D3', 'R-D5'],
  'p2-loyalty/SG2': ['R-D4', 'R-XCTX'],
  'p5-ferry-seats/SG1': ['R-D4', 'R-XCTX'],
  'p5-ferry-seats/SG2': ['R-D4', 'R-XCTX'],
};

interface Row { run: string; puzzle: string; session: string; final: string; rescored: { functional: boolean; subGoals: { id: string; pass: boolean }[] } }

async function main(): Promise<void> {
  const rows = (JSON.parse(fs.readFileSync('experiments/v15-stage0/results/rescore-r6.json', 'utf8')) as { rows: Row[] }).rows;
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cn01-'));
  const cells: Record<string, { tp: number; fn: number; fp: number; tn: number; fnRuns: string[]; fpRuns: string[] }> = {};
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const pdir = PUZZLE_DIR[r.puzzle]; const rdir = RUN_DIR[r.run];
    if (pdir === undefined || rdir === undefined) continue;
    const tree = path.join(rdir, 'sessions', r.session, 'snap', r.final);
    if (!fs.existsSync(tree)) continue;
    const res = await runTree(tree, rules, { spec: path.join(pdir, 'spec.yaml'), scratch });
    const found = res.findings.filter((f) => f.status === 'violation');
    for (const g of r.rescored.subGoals) {
      const key = `${r.puzzle}/${g.id}`;
      const ids = SUBGOAL_RULES[key]; if (ids === undefined) continue;
      const hit = found.filter((f) => ids.includes(f.rule));
      const c = (cells[key] ??= { tp: 0, fn: 0, fp: 0, tn: 0, fnRuns: [], fpRuns: [] });
      const tag = `${r.run.split(' ')[0]}/${r.session}`;
      if (!g.pass && hit.length > 0) c.tp++;
      else if (!g.pass) { c.fn++; c.fnRuns.push(tag); }
      else if (hit.length > 0) { c.fp++; c.fpRuns.push(`${tag} ${hit.map((h) => `${h.rule} ${h.file}:${String(h.line)}`).join('; ')}`); }
      else c.tn++;
      out.push({ run: r.run, puzzle: r.puzzle, session: r.session, subGoal: g.id, oraclePass: g.pass, hits: hit.map((h) => `${h.rule} ${h.file}:${String(h.line)}`) });
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.mkdirSync('experiments/cn-01/results', { recursive: true });
  fs.writeFileSync('experiments/cn-01/results/calibrate-trees.json', `${JSON.stringify({ modelCalls: 0, label: 'R6 oracle', cells, rows: out }, null, 1)}\n`);
  for (const [k, c] of Object.entries(cells)) process.stdout.write(`${k} TP ${String(c.tp)} FN ${String(c.fn)} FP ${String(c.fp)} TN ${String(c.tn)}${c.fn ? ` | FN: ${c.fnRuns.join(', ')}` : ''}${c.fp ? ` | FP: ${c.fpRuns.slice(0, 3).join(' || ')}` : ''}\n`);
}
void main();
