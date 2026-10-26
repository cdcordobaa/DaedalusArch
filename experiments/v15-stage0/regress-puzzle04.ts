/**
 * v1.5 Stage 0 (2026-10-26), zero calls: regression of the `src/` v1.5 instrument on the EXISTING PUZZLE-04 outputs.
 *
 *   npx tsx experiments/v15-stage0/regress-puzzle04.ts
 *
 * For both arms and every session step snapshot recorded in `results/v1.4-puzzle-04/<arm>/sessions/`, it runs the
 * `src/v15-instrument` `check_consistency` (whole tree, the puzzle spec) and the edit gate's layer checks (FF-S01–S03
 * against the session's seed snapshot), exactly as `experiments/puzzle-04/score.ts` called the prototypes, and compares
 * them with the recorded `steps[].checkConsistency` and `steps[].layers` of `scores.json`. Then it recomputes the
 * per-puzzle counts that depend on these checks (final trees flagged). Writes
 * `experiments/v15-stage0/results/regress-puzzle04.json`; prints every mismatch.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkConsistency } from '../../src/v15-instrument/consistency.js';
import { checkLayers } from '../../src/v15-instrument/edit-gate/layers.js';

const PUZZLE_DIR: Record<string, string> = {
  'p1-transfers': 'experiments/puzzle-01/puzzles/p1-transfers',
  'p2-loyalty': 'experiments/puzzle-01/puzzles/p2-loyalty',
  'p3r-shipping-quotes': 'experiments/puzzle-03/puzzles/p3r-shipping-quotes',
  'p5-ferry-seats': 'experiments/puzzle-03/puzzles/p5-ferry-seats',
  'p6-workshop-jobs': 'experiments/puzzle-03/puzzles/p6-workshop-jobs',
};

function changedFiles(a: string, b: string): string[] {
  const r = spawnSync('git', ['diff', '--no-index', '--name-only', a, b], { encoding: 'utf8' });
  return (r.stdout ?? '').trim().split('\n').filter(Boolean).map((f) => (f.startsWith(`${b}/`) ? f.slice(b.length + 1) : f.startsWith(`${a}/`) ? f.slice(a.length + 1) : f));
}

interface StepRec { step: string; checkConsistency: { status: string; findings: string[] }; layers: null | { error: string } | { findings: string[]; advisory: number } }
interface SessionRec { session: string; puzzle: string; steps: StepRec[] }

async function main(): Promise<number> {
  const out: Record<string, unknown>[] = [];
  let compared = 0;
  const mismatches: string[] = [];
  for (const arm of ['gate', 'pull'] as const) {
    const base = `results/v1.4-puzzle-04/${arm}`;
    const scores = JSON.parse(fs.readFileSync(path.join(base, 'scores.json'), 'utf8')) as { sessions: SessionRec[] };
    for (const s of scores.sessions) {
      const pdir = PUZZLE_DIR[s.puzzle];
      if (pdir === undefined || s.steps.length === 0) continue;
      const spec = path.resolve(pdir, 'spec.yaml');
      const seed = path.resolve(base, 'sessions', s.session, 'snap', 'step-00');
      for (const [i, rec] of s.steps.entries()) {
        const snap = path.resolve(base, 'sessions', s.session, 'snap', rec.step);
        const cc = await checkConsistency({ root: snap, spec }).catch((e: unknown) => ({ status: 'error', findings: [], error: String(e) }) as unknown as Awaited<ReturnType<typeof checkConsistency>>);
        const got = { status: cc.status, findings: cc.findings.map((f) => `${f.rule} ${f.file}:${String(f.line)}`) };
        const lay = i === 0 ? null : await checkLayers({ root: snap, spec, seedDir: seed, changed: changedFiles(seed, snap) }).then((l) => ({ findings: l.findings.map((f) => f.key), advisory: l.advisory }), (e: unknown) => ({ error: String(e) }));
        const ccSame = JSON.stringify(got) === JSON.stringify(rec.checkConsistency);
        const laySame = JSON.stringify(lay) === JSON.stringify(rec.layers);
        compared++;
        if (!ccSame) mismatches.push(`${arm} ${s.session} ${s.puzzle} ${rec.step} check_consistency: recorded ${JSON.stringify(rec.checkConsistency)} vs src ${JSON.stringify(got)}`);
        if (!laySame) mismatches.push(`${arm} ${s.session} ${s.puzzle} ${rec.step} layers: recorded ${JSON.stringify(rec.layers)} vs src ${JSON.stringify(lay)}`);
        out.push({ arm, session: s.session, puzzle: s.puzzle, step: rec.step, checkConsistency: got, layers: lay, matches: { checkConsistency: ccSame, layers: laySame } });
      }
      process.stdout.write(`${arm} ${s.session} ${s.puzzle}: ${String(s.steps.length)} steps\n`);
    }
  }
  fs.mkdirSync('experiments/v15-stage0/results', { recursive: true });
  const summary = { stepsCompared: compared, mismatches: mismatches.length };
  fs.writeFileSync('experiments/v15-stage0/results/regress-puzzle04.json', `${JSON.stringify({ schema: 'v15-stage0-regress-puzzle04/v1', instrument: 'src/v15-instrument', modelCalls: 0, summary, mismatches, steps: out }, null, 1)}\n`);
  for (const m of mismatches) process.stdout.write(`MISMATCH ${m}\n`);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return mismatches.length === 0 ? 0 : 1;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; });
