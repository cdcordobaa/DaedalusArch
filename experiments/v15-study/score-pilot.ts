/**
 * Pilot scorer (zero calls; rule-blind): scores the sessions of a pilot run (`make-input.ts --task-root …`) with each
 * variant's own oracle and behaviour tests only. The v1.5 rules are never run here (calibration of the tasks must not
 * see the instrument).
 *
 *   npx tsx experiments/v15-study/score-pilot.ts --results <outRoot> --input <input.json> [--out <dir>]
 *
 * For every session with a `session.json` (`<results>/sessions/<id>/`): the variant (`<vault>/private-id-map.json`),
 * the oracle (`<taskRoot>/<variant>/oracle.ts`) on every step snapshot, and the behaviour tests
 * (`experiments/puzzle-01/tools/run-tests.ts`) on the final snapshot. Per session: **trapFailed** = an oracle sub-goal
 * fails on the final tree; **functional** = every test case passes on the final tree (regression and feature);
 * `featurePassed` / `featureTotal` and `regressionPassed` / `regressionTotal` separately; the harness type-check
 * error count of each turn (from `session.json`). Oracle evidence lines are kept (tree-relative file:line notes) for
 * hand-reading. Writes `<out>/pilot-scores.json` (default `<results>/scores/`). Absolute paths never reach the output.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = process.cwd();
const arg = (k: string, d?: string): string => { const i = process.argv.indexOf(k); const v = i >= 0 ? process.argv[i + 1] : d; if (v === undefined) throw new Error(`missing ${k}`); return v; };

interface SubGoal { readonly id: string; readonly pass: boolean; readonly evidence?: readonly string[] }
interface Case { readonly name: string; readonly kind: 'regression' | 'feature'; readonly ok: boolean }

function tsxJson(args: string[]): Record<string, unknown> | null {
  const r = spawnSync(process.execPath, [path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs'), ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  const line = (r.stdout ?? '').trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  try { return line === undefined ? null : (JSON.parse(line) as Record<string, unknown>); } catch { return null; }
}

export interface PilotRun {
  readonly session: string; readonly planId: string; readonly task: string; readonly variant: string; readonly rep: number; readonly verdict: string;
  readonly complete: boolean;
  readonly oracleByStep: ({ step: string; pass: boolean | null })[];
  readonly trapFailed: boolean | null;
  readonly oracleEvidence: readonly string[];
  readonly functional: boolean | null;
  readonly regressionPassed: number; readonly regressionTotal: number; readonly featurePassed: number; readonly featureTotal: number;
  readonly failedCases: readonly string[];
  readonly typecheckErrors: (number | null)[];
}

export function scorePilot(resultsDir: string, inputFile: string): { schema: string; runs: PilotRun[] } {
  const input = JSON.parse(fs.readFileSync(inputFile, 'utf8')) as { vault: string; taskRoot?: string };
  if (input.taskRoot === undefined) throw new Error('score-pilot: the input has no taskRoot (not a pilot input)');
  const map = JSON.parse(fs.readFileSync(path.join(input.vault, 'private-id-map.json'), 'utf8')) as Record<string, { task: string }>;
  const sessionsDir = path.join(resultsDir, 'sessions');
  const ids = fs.existsSync(sessionsDir) ? fs.readdirSync(sessionsDir).filter((d) => fs.existsSync(path.join(sessionsDir, d, 'session.json'))).sort() : [];
  const runs: PilotRun[] = [];
  for (const id of ids) {
    const s = JSON.parse(fs.readFileSync(path.join(sessionsDir, id, 'session.json'), 'utf8')) as { id: string; planId: string; taskId: string; rep: number; steps: number | Record<string, unknown>[]; verdict: string };
    const records = Array.isArray(s.steps) ? s.steps : [];
    const nSteps = records.length;
    const variant = map[s.taskId]?.task;
    if (variant === undefined) throw new Error(`score-pilot: ${s.taskId} is not in the private map`);
    const vdir = path.join(input.taskRoot, variant);
    const snaps = Array.from({ length: nSteps + 1 }, (_, k) => path.join(sessionsDir, id, 'snap', `step-0${String(k)}`)).filter((p) => fs.existsSync(p));
    const oracleByStep = snaps.map((snap) => {
      const o = tsxJson([path.join(vdir, 'oracle.ts'), snap]);
      const sg = (o?.subGoals as SubGoal[] | undefined) ?? null;
      return { step: path.basename(snap), pass: sg === null ? null : sg.every((g) => g.pass), evidence: sg === null ? ['oracle did not run'] : sg.flatMap((g) => (g.pass ? [] : (g.evidence ?? []).map((e) => `${g.id}: ${e}`))) };
    });
    const final = snaps.at(-1);
    const complete = s.verdict === 'done' && snaps.length === nSteps + 1;
    const tests = final === undefined ? null : (tsxJson(['experiments/puzzle-01/tools/run-tests.ts', '--puzzle', vdir, '--tree', final]) as { cases?: Case[] } | null);
    const cases = tests?.cases ?? [];
    const last = oracleByStep.at(-1);
    runs.push({
      session: id, planId: s.planId, task: s.taskId, variant, rep: s.rep, verdict: s.verdict, complete,
      oracleByStep: oracleByStep.map(({ step, pass }) => ({ step, pass })),
      trapFailed: last === undefined || last.pass === null ? null : !last.pass,
      oracleEvidence: last?.evidence ?? [],
      functional: tests === null || cases.length === 0 ? null : cases.every((c) => c.ok),
      regressionPassed: cases.filter((c) => c.kind === 'regression' && c.ok).length, regressionTotal: cases.filter((c) => c.kind === 'regression').length,
      featurePassed: cases.filter((c) => c.kind === 'feature' && c.ok).length, featureTotal: cases.filter((c) => c.kind === 'feature').length,
      failedCases: cases.filter((c) => !c.ok).map((c) => `${c.kind}: ${c.name}`),
      typecheckErrors: records.map((r) => { const t = r.typecheck as { errors?: unknown } | undefined; return typeof t?.errors === 'number' ? t.errors : null; }),
    });
  }
  return { schema: 'v15-pilot-scores/v1', runs };
}

if (process.argv[1]?.endsWith('score-pilot.ts') === true) {
  const results = path.resolve(arg('--results'));
  const out = path.resolve(arg('--out', path.join(results, 'scores')));
  const res = scorePilot(results, path.resolve(arg('--input')));
  fs.mkdirSync(out, { recursive: true });
  const text = JSON.stringify(res, null, 1).split(REPO).join('<clone>').split(results).join('<out>');
  fs.writeFileSync(path.join(out, 'pilot-scores.json'), `${text}\n`);
  process.stdout.write(`${JSON.stringify({ runs: res.runs.length, scored: res.runs.filter((r) => r.trapFailed !== null).length, out: path.join(out, 'pilot-scores.json') })}\n`);
}
