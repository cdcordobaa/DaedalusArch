/**
 * v1.5 Stage 0 (2026-10-26), zero calls: re-score the EXISTING P2 and P5 final trees with the puzzle keys as they are
 * in this checkout (oracle + behaviour tests). No new runs; the trees are the recorded step snapshots.
 *
 *   npx tsx experiments/v15-stage0/rescore-keys.ts --label before|after
 *
 * Runs counted are the ones each results folder's `scores.json` counted (`puzzles[].perRun`). The final tree is the
 * last step snapshot. Clean = every behaviour test passes and every sub-goal oracle passes (the registered outcome of
 * PUZZLE-01 to PUZZLE-04). Writes `experiments/v15-stage0/results/rescore-<label>.json`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PUZZLE_DIR: Record<string, string> = {
  'p2-loyalty': 'experiments/puzzle-01/puzzles/p2-loyalty',
  'p5-ferry-seats': 'experiments/puzzle-03/puzzles/p5-ferry-seats',
};
const FOLDERS = [
  { run: 'PUZZLE-01 baseline (none)', dir: 'results/v1.4-puzzle-01-baseline' },
  { run: 'PUZZLE-02 tool arm (mcp-detect, pull)', dir: 'results/v1.4-puzzle-02-tool-arm' },
  { run: 'PUZZLE-03 baseline (none)', dir: 'results/v1.4-puzzle-03-baseline' },
  { run: 'PUZZLE-04 gate', dir: 'results/v1.4-puzzle-04/gate' },
  { run: 'PUZZLE-04 pull', dir: 'results/v1.4-puzzle-04/pull' },
];

interface Json { [k: string]: unknown }
const tsx = (args: string[]): Json | null => {
  const out = spawnSync('npx', ['tsx', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '';
  const line = out.trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  return line === undefined ? null : (JSON.parse(line) as Json);
};

const label = process.argv[process.argv.indexOf('--label') + 1] ?? 'after';
const rows: Json[] = [];
for (const f of FOLDERS) {
  const scores = JSON.parse(fs.readFileSync(path.join(f.dir, 'scores.json'), 'utf8')) as { puzzles: { puzzle: string; cleanSolves: number; perRun: { session: string; clean: boolean; failedTests: string[]; subGoals: { id: string; pass: boolean }[] }[] }[] };
  for (const p of scores.puzzles) {
    const pdir = PUZZLE_DIR[p.puzzle];
    if (pdir === undefined) continue;
    for (const r of p.perRun) {
      const snapRoot = path.join(f.dir, 'sessions', r.session, 'snap');
      const final = path.join(snapRoot, fs.readdirSync(snapRoot).filter((s) => /^step-\d+$/.test(s)).sort().at(-1) as string);
      const tests = tsx(['experiments/puzzle-01/tools/run-tests.ts', '--puzzle', pdir, '--tree', final]);
      const oracle = tsx([`${pdir}/oracle.ts`, final]);
      const failedTests = ((tests?.cases ?? []) as { name: string; ok: boolean }[]).filter((c) => !c.ok).map((c) => c.name);
      const subGoals = ((oracle?.subGoals ?? []) as { id: string; pass: boolean; evidence: string[] }[]).map((g) => ({ id: g.id, pass: g.pass, evidence: g.evidence }));
      const functional = tests === null || failedTests.length > 0;
      const clean = !functional && subGoals.length > 0 && subGoals.every((g) => g.pass);
      rows.push({
        run: f.run, puzzle: p.puzzle, session: r.session, final: path.basename(final),
        recorded: { clean: r.clean, failedTests: r.failedTests, subGoals: r.subGoals.map((g) => ({ id: g.id, pass: g.pass })) },
        rescored: { clean, functional, trapped: !functional && !clean, failedTests, subGoals },
      });
      process.stdout.write(`${f.run} ${p.puzzle} ${r.session}: recorded ${r.clean ? 'clean' : 'not clean'}, ${label} ${clean ? 'clean' : functional ? 'functional' : 'trapped'} [${subGoals.map((g) => `${g.id} ${g.pass ? 'pass' : 'FAIL'}`).join(', ')}]${failedTests.length > 0 ? ` tests failed: ${failedTests.join(' | ')}` : ''}\n`);
    }
  }
}
fs.mkdirSync('experiments/v15-stage0/results', { recursive: true });
fs.writeFileSync(`experiments/v15-stage0/results/rescore-${label}.json`, `${JSON.stringify({ schema: 'v15-stage0-rescore/v1', label, modelCalls: 0, rows }, null, 1)}\n`);
