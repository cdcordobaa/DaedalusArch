/**
 * PUZZLE-03 baseline scorer (zero calls: no model, no network, no Neo4j). Plan: `plan.md` §4. Adapted from
 * `experiments/puzzle-01-baseline/score-baseline.ts` (same outcome rules; DETECT-01 prototypes replaced by DETECT-02's
 * `check_consistency`).
 *
 * For every session (`<results>/sessions/<id>/`): on every step snapshot (`snap/step-00` = seed … `snap/step-03`) the
 * puzzle's behaviour tests from outside, every sub-goal oracle and the changed lines against the seed; the type-check
 * count is the harness's own (`run/turns.jsonl`). On every final tree: the frozen instrument and DETECT-02.
 * Writes `<results>/scores.json`, `<results>/diffs/<session>/step-0N.diff` and `<results>/oracle-verdicts-to-read.md`.
 *
 * Usage (repository root): npx tsx experiments/puzzle-03/score-baseline.ts --results results/v1.4-puzzle-03-baseline
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = process.cwd();
const PUZZLES = 'experiments/puzzle-03/puzzles';
const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const RESULTS = arg('results') ?? 'results/v1.4-puzzle-03-baseline';
const STEPS = ['step-00', 'step-01', 'step-02', 'step-03'];
const ORDER = ['p3r-shipping-quotes', 'p5-ferry-seats', 'p6-workshop-jobs'];

interface Json { [k: string]: unknown }
interface SubGoal { readonly id: string; readonly pass: boolean; readonly evidence: string[] }
interface Finding { readonly ruleId: string; readonly file: string; readonly target: string | null; readonly checkCorrect: string }

const run = (args: string[]): string => spawnSync('npx', ['tsx', ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '';
const lastJson = (s: string): Json | null => {
  const line = s.trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  return line === undefined ? null : (JSON.parse(line) as Json);
};
const wholeJson = (s: string): Json | null => {
  const at = s.indexOf('{');
  return at < 0 ? null : (JSON.parse(s.slice(at)) as Json);
};

function numstat(a: string, b: string): { files: number; added: number; removed: number; changed: number } {
  const r = spawnSync('git', ['diff', '--no-index', '--numstat', a, b], { encoding: 'utf8' });
  let files = 0, added = 0, removed = 0;
  for (const l of (r.stdout ?? '').trim().split('\n').filter(Boolean)) {
    const [x, y] = l.split('\t');
    files += 1;
    added += Number(x) || 0;
    removed += Number(y) || 0;
  }
  return { files, added, removed, changed: added + removed };
}

function diff(a: string, b: string): string {
  const r = spawnSync('git', ['diff', '--no-index', '--no-color', a, b], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return (r.stdout ?? '').split(`${a}/`).join('a/').split(`${b}/`).join('b/');
}

function wilson(c: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.959964;
  const p = c / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, +(centre - half).toFixed(3)), Math.min(1, +(centre + half).toFixed(3))];
}
const choose = (n: number, k: number): number => (k < 0 || k > n ? 0 : k === 0 ? 1 : (n * choose(n - 1, k - 1)) / k);
const correctKeys = (b: Finding[]): Set<string> => new Set(b.filter((f) => f.checkCorrect === 'correct').map((f) => `${f.ruleId}|${f.file}|${f.target ?? ''}`));
const evidenceFiles = (g: SubGoal): Set<string> => new Set(g.evidence.map((e) => e.split(/[:\s]/)[0] ?? ''));

/** ±3 lines of code around each cited file:line (first 3 citations), for the hand read. */
function excerpts(tree: string, g: SubGoal): string {
  const out: string[] = [];
  const cited = [...new Set(g.evidence.map((e) => /(src\/[^\s:]+\.ts):(\d+)/.exec(e)).filter((m): m is RegExpExecArray => m !== null).map((m) => `${m[1]}:${m[2]}`))].slice(0, 3);
  for (const c of cited) {
    const [file, line] = c.split(':') as [string, string];
    const abs = path.join(tree, file);
    if (!fs.existsSync(abs)) continue;
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    const at = Number(line);
    const from = Math.max(1, at - 3);
    const to = Math.min(lines.length, at + 3);
    out.push(`\`${file}\` lines ${String(from)}–${String(to)}:`, '', '```ts', ...lines.slice(from - 1, to), '```', '');
  }
  return out.join('\n');
}

function main(): number {
  const map = JSON.parse(fs.readFileSync(path.join(RESULTS, 'private-id-map.json'), 'utf8')) as { sessions: Record<string, { puzzle: string; runIndex: number; redrawOf: string | null; verdict: string }> };
  const verify = JSON.parse(fs.readFileSync('experiments/puzzle-03/verification.json', 'utf8')) as { puzzles: { id: string; trees: Record<string, { instrument: { blocking?: Finding[] } }> }[] };
  const turns = fs.readFileSync(path.join(RESULTS, 'run', 'turns.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Json);
  const sessions: Json[] = [];
  const toRead: string[] = [];
  for (const [sid, s] of Object.entries(map.sessions).sort()) {
    const dir = path.join(RESULTS, 'sessions', sid);
    const puzzleDir = `${PUZZLES}/${s.puzzle}`;
    const snaps = STEPS.map((st) => path.join(dir, 'snap', st)).filter((p) => fs.existsSync(p));
    const steps: Json[] = [];
    for (const [i, snap] of snaps.entries()) {
      const tests = lastJson(run(['experiments/puzzle-01/tools/run-tests.ts', '--puzzle', puzzleDir, '--tree', snap]));
      const oracle = lastJson(run([`${puzzleDir}/oracle.ts`, snap]));
      const cases = (tests?.cases ?? []) as { name: string; kind: string; ok: boolean }[];
      if (i > 0) {
        fs.mkdirSync(path.join(RESULTS, 'diffs', sid), { recursive: true });
        fs.writeFileSync(path.join(RESULTS, 'diffs', sid, `${STEPS[i] ?? ''}.diff`), diff(snaps[i - 1] as string, snap));
      }
      const turn = turns.find((t) => t.session === sid && t.step === STEPS[i]);
      steps.push({
        step: STEPS[i],
        status: turn?.status ?? (i === 0 ? 'seed' : null),
        tscErrors: i === 0 ? 0 : ((turn?.typecheck as { errors?: number } | undefined)?.errors ?? null),
        tests: { regression: { passed: cases.filter((c) => c.kind === 'regression' && c.ok).length, total: cases.filter((c) => c.kind === 'regression').length }, feature: { passed: cases.filter((c) => c.kind === 'feature' && c.ok).length, total: cases.filter((c) => c.kind === 'feature').length }, failed: cases.filter((c) => !c.ok).map((c) => c.name), error: tests === null ? 'no test output' : undefined },
        oracle: (oracle?.subGoals as SubGoal[] | undefined) ?? null,
        sizeVsSeed: i === 0 ? null : numstat(snaps[0] as string, snap),
      });
    }
    const complete = snaps.length === STEPS.length && s.verdict === 'done';
    let frozen: Json | null = null;
    let detect02: Json | null = null;
    if (complete) {
      const final = snaps[3] as string;
      const ins = lastJson(run(['experiments/puzzle-01/tools/instrument-score.ts', '--spec', `${puzzleDir}/spec.yaml`, '--tree', final, '--label', `${s.puzzle}/${sid}`]));
      const seedKeys = correctKeys(verify.puzzles.find((p) => p.id === s.puzzle)?.trees.seed?.instrument.blocking ?? []);
      const blocking = ((ins?.blocking ?? []) as Finding[]).map((b) => ({ ruleId: b.ruleId, file: b.file, target: b.target, checkCorrect: b.checkCorrect }));
      frozen = ins?.ok === true ? { verdict: ins.verdict, blocking, newCorrectBlocking: [...correctKeys(blocking)].filter((k) => !seedKeys.has(k)) } : { error: ins?.errors ?? 'no output' };
      const d = wholeJson(run(['experiments/detect-02/mcp/push-gate.ts', '--project', final, '--spec', `${puzzleDir}/spec.yaml`, '--json']));
      detect02 = d === null ? { error: 'no output' } : { status: d.status, rootsFrom: d.rootsFrom, findings: ((d.findings ?? []) as { rule: string; file: string; line: number }[]).map((f) => `${f.rule} ${f.file}:${String(f.line)}`) };
      for (const g of ((steps[3] as { oracle: SubGoal[] | null }).oracle ?? []).filter((x) => !x.pass)) {
        toRead.push(`## ${sid} ${s.puzzle} ${g.id}\n\n- Oracle evidence:\n${g.evidence.map((e) => `  - \`${e}\``).join('\n')}\n- Category: (hand read)\n- Proposed label: (hand read)\n\n${excerpts(final, g)}`);
      }
    }
    sessions.push({ session: sid, puzzle: s.puzzle, runIndex: s.runIndex, redrawOf: s.redrawOf, verdict: s.verdict, complete, steps, frozen, detect02 });
  }

  const puzzles: Json[] = [];
  for (const p of ORDER) {
    const meta = JSON.parse(fs.readFileSync(`${PUZZLES}/${p}/puzzle.json`, 'utf8')) as { subGoals: { id: string; family: string }[] };
    type St = { tests: { regression: { passed: number; total: number }; feature: { passed: number; total: number } }; oracle: SubGoal[] | null; tscErrors: number | null; sizeVsSeed: { changed: number } | null };
    const runs = sessions.filter((s) => s.puzzle === p && s.complete === true) as unknown as { session: string; steps: St[]; frozen: { newCorrectBlocking?: string[] } | null; detect02: { status?: string; findings?: string[] } | null }[];
    const testsPass = (st: St): boolean => st.tests.regression.passed === st.tests.regression.total && st.tests.feature.passed === st.tests.feature.total && st.tests.feature.total > 0;
    const perRun = runs.map((r) => {
      const fin = r.steps[3] as St;
      const sg = (fin.oracle ?? []).map((g) => ({ id: g.id, pass: g.pass, evidence: g.evidence }));
      const functional = !testsPass(fin);
      const clean = !functional && sg.length > 0 && sg.every((g) => g.pass);
      const caught = meta.subGoals.map((m) => ({
        id: m.id,
        failedAtStep: r.steps.slice(1, 3).flatMap((st, k) => (st.oracle?.find((g) => g.id === m.id)?.pass === false ? [`step-0${String(k + 1)}`] : [])),
        passFinal: sg.find((g) => g.id === m.id)?.pass ?? null,
      })).map((c) => ({ ...c, caughtAndFixed: c.failedAtStep.length > 0 && c.passFinal === true }));
      const visibility = meta.subGoals.map((m) => {
        const g = sg.find((x) => x.id === m.id);
        const files = g === undefined ? new Set<string>() : evidenceFiles(g);
        const fz = r.frozen?.newCorrectBlocking ?? [];
        const d02 = r.detect02?.findings ?? [];
        return {
          id: m.id,
          oracleFails: g?.pass === false,
          frozenNew: fz,
          frozenFlags: g?.pass === false ? fz.some((k) => files.has(k.split('|')[1] ?? '')) : fz.length > 0,
          detect02Status: r.detect02?.status ?? null,
          detect02Flags: d02.length > 0,
        };
      });
      return { session: r.session, clean, trapped: !functional && !clean, functionalFailure: functional, tscErrorsFinal: fin.tscErrors, changedLines: fin.sizeVsSeed?.changed ?? null, subGoals: sg, caught, visibility };
    });
    const n = perRun.length;
    const c = perRun.filter((r) => r.clean).length;
    puzzles.push({
      puzzle: p, runs: n, cleanSolves: c,
      trapped: perRun.filter((r) => r.trapped).length,
      functionalFailures: perRun.filter((r) => r.functionalFailure).length,
      cleanRate: n === 0 ? null : +(c / n).toFixed(3),
      wilson95: wilson(c, n),
      passHat5: n >= 5 ? +(choose(c, 5) / choose(n, 5)).toFixed(3) : null,
      passAll: n > 0 && c === n ? 1 : 0,
      perSubGoalSuccess: meta.subGoals.map((m) => ({ id: m.id, family: m.family, pass: perRun.filter((r) => r.subGoals.find((g) => g.id === m.id)?.pass === true).length, of: n, caughtAndFixed: perRun.filter((r) => r.caught.find((x) => x.id === m.id)?.caughtAndFixed === true).length })),
      perRun,
    });
  }
  const out = { schema: 'puzzle-03-baseline-scores/v1', calls: { model: 0, generator: 0, network: 0 }, puzzles, sessions };
  fs.writeFileSync(path.join(RESULTS, 'scores.json'), `${JSON.stringify(out, null, 1).split(path.resolve('.')).join('.')}\n`);
  fs.writeFileSync(path.join(RESULTS, 'oracle-verdicts-to-read.raw.md'), `${toRead.join('\n')}\n`.split(path.resolve('.')).join('.'));
  for (const p of puzzles) process.stdout.write(`${String(p.puzzle)}: runs ${String(p.runs)}, clean ${String(p.cleanSolves)}, trapped ${String(p.trapped)}, functional failures ${String(p.functionalFailures)}, Wilson ${JSON.stringify(p.wilson95)}, per sub-goal ${JSON.stringify((p.perSubGoalSuccess as { id: string; pass: number }[]).map((x) => `${x.id} ${String(x.pass)}`))}\n`);
  return 0;
}

process.exitCode = main();
