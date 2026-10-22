/**
 * PUZZLE-01 baseline scorer (zero calls: no model, no network, no Neo4j). Plan: `plan.md` §4–§6.
 *
 * For every session of the baseline (the driver's `sessions/<id>/` records, copied under the results root): on every
 * step snapshot (`snap/step-00` = seed … `snap/step-03` = final tree) the puzzle's behaviour tests are run from outside
 * (`experiments/puzzle-01/tools/run-tests.ts`), every sub-goal oracle, and the changed lines against the seed; the
 * type-check count is the harness's own (`turns.jsonl`). The final tree is also scored by the frozen instrument
 * (`experiments/puzzle-01/tools/instrument-score.ts`). The DETECT-01 prototype findings are read from the file
 * `detect-01.json` that `--prototype-manifest` prepares the input for (run separately from a detect-01 checkout).
 *
 * Usage (repository root):
 *   npx tsx experiments/puzzle-01-baseline/score-baseline.ts --results results/puzzle-01-baseline [--prototype-manifest <file>]
 * Writes `<results>/scores.json` and `<results>/diffs/<session>/step-0N.diff`, and prints a summary.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO = process.cwd();
const PUZZLES = 'experiments/puzzle-01/puzzles';
const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const RESULTS = arg('results') ?? 'results/puzzle-01-baseline';
const STEPS = ['step-00', 'step-01', 'step-02', 'step-03'];

interface Json { [k: string]: unknown }
interface SubGoal { readonly id: string; readonly pass: boolean; readonly evidence: string[] }
interface Finding { readonly ruleId: string; readonly file: string; readonly target: string | null; readonly checkCorrect: string }

const tsx = (args: string[]): Json | null => {
  const r = spawnSync('npx', ['tsx', ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const line = (r.stdout ?? '').trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  return line === undefined ? null : (JSON.parse(line) as Json);
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

function instrument(spec: string, tree: string, label: string): { blocking: Finding[]; verdict: unknown } | { error: unknown } {
  const out = tsx(['experiments/puzzle-01/tools/instrument-score.ts', '--spec', spec, '--tree', tree, '--label', label]);
  if (out?.ok !== true) return { error: out?.errors ?? 'no output' };
  return { verdict: out.verdict, blocking: (out.blocking as Finding[]).map((b) => ({ ruleId: b.ruleId, file: b.file, target: b.target, checkCorrect: b.checkCorrect })) };
}

const correctKeys = (b: Finding[]): Set<string> => new Set(b.filter((f) => f.checkCorrect === 'correct').map((f) => `${f.ruleId}|${f.file}|${f.target ?? ''}`));
const evidenceFiles = (g: SubGoal): Set<string> => new Set(g.evidence.map((e) => e.split(/[:\s]/)[0] ?? ''));

/** Prototype rules mapped to each sub-goal in advance (plan §5). */
const PROTOTYPE_MAP: Record<string, readonly string[]> = {
  'p1-transfers/SG1': ['X1', 'X1b'],
  'p1-transfers/SG2': ['X4'],
  'p2-loyalty/SG1': [],
  'p2-loyalty/SG2': ['X1', 'X1b'],
  'p4-library-holds/SG1': [],
};

function main(): number {
  const map = JSON.parse(fs.readFileSync(path.join(RESULTS, 'private-id-map.json'), 'utf8')) as { tasks: Record<string, string>; sessions: Record<string, { task: string; puzzle: string; runIndex: number; redrawOf: string | null; verdict: string }> };
  const verify = JSON.parse(fs.readFileSync('experiments/puzzle-01-baseline/verify/verify-r4-r7.json', 'utf8')) as { puzzles: { id: string; trees: Record<string, { instrument: { blocking?: Finding[] }; oracle: { subGoals: SubGoal[] } }> }[] };
  const proto = arg('prototype-results') !== undefined ? (JSON.parse(fs.readFileSync(arg('prototype-results') as string, 'utf8')) as { rows: { label: string; findings: { rule: string; file: string; line: number | null }[] }[] }) : null;
  const protoOf = (label: string): { rule: string; file: string }[] | null => proto?.rows.find((r) => r.label === label)?.findings ?? null;
  const manifest: { label: string; path: string; style: string }[] = [];

  const sessions: Json[] = [];
  for (const [sid, s] of Object.entries(map.sessions).sort()) {
    const dir = path.join(RESULTS, 'sessions', sid);
    const puzzleDir = `${PUZZLES}/${s.puzzle}`;
    const snaps = STEPS.map((st) => path.join(dir, 'snap', st)).filter((p) => fs.existsSync(p));
    const turns = fs.readFileSync(path.join(RESULTS, 'run', 'turns.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Json).filter((t) => t.session === sid);
    const steps: Json[] = [];
    for (const [i, snap] of snaps.entries()) {
      const tests = tsx([`${PUZZLES.replace(/puzzles$/, 'tools')}/run-tests.ts`, '--puzzle', puzzleDir, '--tree', snap]);
      const oracle = tsx([`${puzzleDir}/oracle.ts`, snap]);
      const cases = (tests?.cases ?? []) as { name: string; kind: string; ok: boolean; step: string | null }[];
      if (i > 0) {
        fs.mkdirSync(path.join(RESULTS, 'diffs', sid), { recursive: true });
        fs.writeFileSync(path.join(RESULTS, 'diffs', sid, `${STEPS[i] ?? ''}.diff`), diff(snaps[i - 1] as string, snap));
      }
      const turn = turns.find((t) => t.step === STEPS[i]);
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
    if (complete) {
      const final = snaps[3] as string;
      const ins = instrument(`${puzzleDir}/spec.yaml`, final, `${s.puzzle}/${sid}`);
      const seedRec = verify.puzzles.find((p) => p.id === s.puzzle)?.trees.seed;
      const seedKeys = correctKeys(seedRec?.instrument.blocking ?? []);
      frozen = 'error' in ins ? { error: ins.error } : { verdict: ins.verdict, blocking: ins.blocking, newCorrectBlocking: [...correctKeys(ins.blocking)].filter((k) => !seedKeys.has(k)) };
      manifest.push({ label: `${s.puzzle}/${sid}`, path: path.resolve(final), style: s.puzzle === 'p4-library-holds' ? 'layered' : 'hexddd' });
    }
    sessions.push({ session: sid, puzzle: s.puzzle, runIndex: s.runIndex, redrawOf: s.redrawOf, verdict: s.verdict, complete, steps, frozen });
  }
  for (const p of ['p1-transfers', 'p2-loyalty', 'p4-library-holds']) {
    for (const t of ['seed', 'solutions/clean', 'solutions/trap', 'solutions/trap-alt']) {
      if (fs.existsSync(`${PUZZLES}/${p}/${t}`)) manifest.push({ label: `${p}/${t}`, path: path.resolve(`${PUZZLES}/${p}/${t}`), style: p === 'p4-library-holds' ? 'layered' : 'hexddd' });
    }
  }
  const mf = arg('prototype-manifest');
  if (mf !== undefined) {
    fs.writeFileSync(mf, `${JSON.stringify(manifest, null, 1)}\n`);
    process.stdout.write(`prototype manifest written: ${mf} (${String(manifest.length)} trees)\n`);
  }

  // Per puzzle.
  const puzzles: Json[] = [];
  for (const p of ['p1-transfers', 'p2-loyalty', 'p4-library-holds']) {
    const meta = JSON.parse(fs.readFileSync(`${PUZZLES}/${p}/puzzle.json`, 'utf8')) as { subGoals: { id: string; family: string }[] };
    const runs = sessions.filter((s) => s.puzzle === p && s.complete === true) as unknown as { session: string; steps: { tests: { regression: { passed: number; total: number }; feature: { passed: number; total: number } }; oracle: SubGoal[] | null; tscErrors: number | null; sizeVsSeed: { changed: number } | null }[]; frozen: { newCorrectBlocking?: string[] } | null }[];
    const testsPass = (st: (typeof runs)[number]['steps'][number]): boolean => st.tests.regression.passed === st.tests.regression.total && st.tests.feature.passed === st.tests.feature.total && st.tests.feature.total > 0;
    const perRun = runs.map((r) => {
      const fin = r.steps[3] as (typeof r.steps)[number];
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
        const seedProto = protoOf(`${p}/seed`) ?? [];
        const seedProtoKeys = new Set(seedProto.map((f) => `${f.rule}|${f.file}`));
        const pr = (protoOf(`${p}/${r.session}`) ?? []).filter((f) => !seedProtoKeys.has(`${f.rule}|${f.file}`) && (PROTOTYPE_MAP[`${p}/${m.id}`] ?? []).includes(f.rule));
        return {
          id: m.id,
          oracleFails: g?.pass === false,
          frozenNew: fz.length,
          frozenInEvidenceFile: fz.some((k) => files.has(k.split('|')[1] ?? '')),
          frozenFlags: g?.pass === false ? fz.some((k) => files.has(k.split('|')[1] ?? '')) : fz.length > 0,
          prototypeRules: PROTOTYPE_MAP[`${p}/${m.id}`] ?? [],
          prototypeNew: proto === null ? null : pr.map((f) => `${f.rule}@${f.file}`),
          prototypeFlags: proto === null ? null : g?.pass === false ? pr.some((f) => files.has(f.file)) : pr.length > 0,
        };
      });
      return { session: r.session, clean, trapped: !functional && !clean, functionalFailure: functional, tscErrorsFinal: fin.tscErrors, changedLines: fin.sizeVsSeed?.changed ?? null, subGoals: sg, caught, visibility };
    });
    const n = perRun.length;
    const c = perRun.filter((r) => r.clean).length;
    puzzles.push({
      puzzle: p,
      runs: n,
      cleanSolves: c,
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
  const out = { schema: 'puzzle-01-baseline-scores/v1', calls: { model: 0, generator: 0, network: 0 }, prototypeRun: proto !== null, puzzles, sessions };
  fs.writeFileSync(path.join(RESULTS, 'scores.json'), `${JSON.stringify(out, null, 1).split(path.resolve('.')).join('.')}\n`);
  for (const p of puzzles) process.stdout.write(`${String(p.puzzle)}: runs ${String(p.runs)}, clean ${String(p.cleanSolves)}, trapped ${String(p.trapped)}, functional failures ${String(p.functionalFailures)}, Wilson ${JSON.stringify(p.wilson95)}\n`);
  return 0;
}

process.exitCode = main();
