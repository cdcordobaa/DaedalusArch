/**
 * PUZZLE-02 tool-arm scorer (zero calls: no model, no network, no Neo4j). Plan: `plan.md` §5.
 *
 * For every session (the driver's `sessions/<id>/` records, copied under the results root), on every step snapshot
 * (`step-00` = seed … `step-03` = final tree): the puzzle's behaviour tests run from outside
 * (`experiments/puzzle-01/tools/run-tests.ts`), every sub-goal oracle, changed lines against the seed, and
 * `check_consistency` through the MCP layer (the experimental server with `--confine`, an in-process client, the
 * puzzle spec), as `experiments/detect-02/mcp/zero-call-check.ts` calls it. The type-check count is the harness's own
 * (`run/turns.jsonl`). The tool-call log (`run/mcp/<id>.tap.jsonl`) is summarised per step for the record only.
 * Outcomes follow design §5 as the baseline plan §4 applies them, side by side with the baseline `none` arm
 * (`results/v1.4-puzzle-01-baseline/scores.json`, not re-run). Per puzzle, never pooled.
 *
 * Usage (repository root):
 *   npx tsx experiments/puzzle-02-tool-arm/score-tool-arm.ts --results results/v1.4-puzzle-02-tool-arm
 * Writes `<results>/scores.json`, `<results>/diffs/<session>/step-0N.diff` and `<results>/oracle-verdicts-to-read.md`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CHECK_CONSISTENCY, contextFrom, createDetectServer } from '../detect-02/mcp/server.js';

const PUZZLES = 'experiments/puzzle-01/puzzles';
const BASELINE = 'results/v1.4-puzzle-01-baseline';
const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const RESULTS = arg('results') ?? 'results/v1.4-puzzle-02-tool-arm';
const STEPS = ['step-00', 'step-01', 'step-02', 'step-03'];
const PUZZLE_IDS = ['p1-transfers', 'p2-loyalty'] as const;

interface Json { [k: string]: unknown }
interface SubGoal { readonly id: string; readonly pass: boolean; readonly evidence: string[] }
interface Finding { readonly rule: string; readonly file: string; readonly line: number }

const tsx = (args: string[]): Json | null => {
  const r = spawnSync('npx', ['tsx', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
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

/** `check_consistency` through the MCP layer, `--confine`, on one tree (zero calls). */
async function consistency(puzzle: string, tree: string): Promise<{ status: unknown; findings: Finding[] }> {
  const ctx = contextFrom(['--spec', path.join(PUZZLES, puzzle, 'spec.yaml'), '--project', path.resolve(tree), '--engine', 'cypher-interp', '--confine'], {});
  const server = createDetectServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'puzzle-02-score', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const r = await client.callTool({ name: CHECK_CONSISTENCY, arguments: {} });
  await client.close();
  const s = (r.structuredContent ?? {}) as { status?: unknown; findings?: Finding[] };
  return { status: r.isError === true ? 'error' : (s.status ?? null), findings: (s.findings ?? []).map((f) => ({ rule: f.rule, file: f.file, line: f.line })) };
}

function readJsonl(file: string): Json[] {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Json) : [];
}

async function main(): Promise<number> {
  const map = JSON.parse(fs.readFileSync(path.join(RESULTS, 'private-task-map.json'), 'utf8')) as { tasks: Record<string, string> };
  const schedule = JSON.parse(fs.readFileSync(path.join(RESULTS, 'run', 'schedule.json'), 'utf8')) as { schedule: { id: string; taskId: string; runIndex: number }[] };
  const redraws = readJsonl(path.join(RESULTS, 'run', 'redraws.jsonl')) as unknown as { redrawn: string; as: string; taskId: string }[];
  const allTurns = readJsonl(path.join(RESULTS, 'run', 'turns.jsonl'));
  const specs = [...schedule.schedule.map((s) => ({ ...s, redrawOf: null as string | null })), ...redraws.map((r) => {
    const of = schedule.schedule.find((s) => s.id === r.redrawn);
    return { id: r.as, taskId: r.taskId, runIndex: of?.runIndex ?? -1, redrawOf: r.redrawn };
  })];

  const sessions: Json[] = [];
  for (const s of specs) {
    const dir = path.join(RESULTS, 'sessions', s.id);
    if (!fs.existsSync(path.join(dir, 'session.json'))) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'session.json'), 'utf8')) as { verdict: string };
    const puzzle = map.tasks[s.taskId] as string;
    const puzzleDir = `${PUZZLES}/${puzzle}`;
    const snaps = STEPS.map((st) => path.join(dir, 'snap', st)).filter((p) => fs.existsSync(p));
    const turns = allTurns.filter((t) => t.session === s.id);
    const tap = readJsonl(path.join(RESULTS, 'run', 'mcp', `${s.id}.tap.jsonl`)).filter((l) => l.event === 'call');
    const steps: Json[] = [];
    for (const [i, snap] of snaps.entries()) {
      const tests = tsx([`${PUZZLES.replace(/puzzles$/, 'tools')}/run-tests.ts`, '--puzzle', puzzleDir, '--tree', snap]);
      const oracle = tsx([`${puzzleDir}/oracle.ts`, snap]);
      const cc = await consistency(puzzle, snap);
      const cases = (tests?.cases ?? []) as { name: string; kind: string; ok: boolean }[];
      if (i > 0) {
        fs.mkdirSync(path.join(RESULTS, 'diffs', s.id), { recursive: true });
        fs.writeFileSync(path.join(RESULTS, 'diffs', s.id, `${STEPS[i] ?? ''}.diff`), diff(snaps[i - 1] as string, snap));
      }
      const turn = turns.find((t) => t.step === STEPS[i]);
      const calls = tap.filter((c) => c.turn === STEPS[i]);
      steps.push({
        step: STEPS[i],
        status: turn?.status ?? (i === 0 ? 'seed' : null),
        tscErrors: i === 0 ? 0 : ((turn?.typecheck as { errors?: number } | undefined)?.errors ?? null),
        tests: { regression: { passed: cases.filter((c) => c.kind === 'regression' && c.ok).length, total: cases.filter((c) => c.kind === 'regression').length }, feature: { passed: cases.filter((c) => c.kind === 'feature' && c.ok).length, total: cases.filter((c) => c.kind === 'feature').length }, failed: cases.filter((c) => !c.ok).map((c) => c.name), error: tests === null ? 'no test output' : undefined },
        oracle: (oracle?.subGoals as SubGoal[] | undefined) ?? null,
        checkConsistency: cc,
        sizeVsSeed: i === 0 ? null : numstat(snaps[0] as string, snap),
        allowFile: fs.existsSync(path.join(snap, 'detect02.allow.yaml')),
        toolCalls: i === 0 ? null : {
          total: calls.length,
          byTool: Object.fromEntries([...new Set(calls.map((c) => String(c.tool)))].map((t) => [t, calls.filter((c) => c.tool === t).length])),
          checkConsistency: calls.filter((c) => c.tool === 'check_consistency').map((c) => ({ status: c.status, findings: c.findings, isError: c.isError })),
        },
      });
    }
    sessions.push({ session: s.id, task: s.taskId, puzzle, runIndex: s.runIndex, redrawOf: s.redrawOf, verdict: meta.verdict, complete: snaps.length === STEPS.length && meta.verdict === 'done', steps });
  }

  const base = JSON.parse(fs.readFileSync(path.join(BASELINE, 'scores.json'), 'utf8')) as { puzzles: Json[] };
  const puzzles: Json[] = [];
  const toRead: string[] = [];
  for (const p of PUZZLE_IDS) {
    const meta = JSON.parse(fs.readFileSync(`${PUZZLES}/${p}/puzzle.json`, 'utf8')) as { subGoals: { id: string; family: string }[] };
    type Step = { step: string; tests: { regression: { passed: number; total: number }; feature: { passed: number; total: number }; failed: string[] }; oracle: SubGoal[] | null; tscErrors: number | null; sizeVsSeed: { changed: number } | null; checkConsistency: { status: unknown; findings: Finding[] }; toolCalls: { total: number; checkConsistency: { findings: unknown }[] } | null };
    const runs = sessions.filter((s) => s.puzzle === p && s.complete === true) as unknown as { session: string; steps: Step[] }[];
    const testsPass = (st: Step): boolean => st.tests.regression.passed === st.tests.regression.total && st.tests.feature.passed === st.tests.feature.total && st.tests.feature.total > 0;
    const perRun = runs.map((r) => {
      const fin = r.steps[3] as Step;
      const sg = (fin.oracle ?? []).map((g) => ({ id: g.id, pass: g.pass, evidence: g.evidence }));
      const functional = !testsPass(fin);
      const clean = !functional && sg.length > 0 && sg.every((g) => g.pass);
      const caught = meta.subGoals.map((m) => ({
        id: m.id,
        failedAtStep: r.steps.slice(1, 3).flatMap((st, k) => (st.oracle?.find((g) => g.id === m.id)?.pass === false ? [`step-0${String(k + 1)}`] : [])),
        passFinal: sg.find((g) => g.id === m.id)?.pass ?? null,
      })).map((c) => ({ ...c, caughtAndFixed: c.failedAtStep.length > 0 && c.passFinal === true }));
      const findingsAtStep = r.steps.slice(1).map((st) => ({ step: st.step, findings: st.checkConsistency.findings.length }));
      const toolSawFindings = r.steps.slice(1).some((st) => (st.toolCalls?.checkConsistency ?? []).some((c) => typeof c.findings === 'number' && c.findings > 0));
      // Tool-call grain (design §5 "per tool-call boundary"): a check_consistency call returned findings and a later
      // call in the same or a later step returned none.
      const ccCalls = r.steps.slice(1).flatMap((st) => (st.toolCalls?.checkConsistency ?? []).map((c) => ({ step: st.step, findings: typeof c.findings === 'number' ? c.findings : null })));
      const firstHit = ccCalls.findIndex((c) => (c.findings ?? 0) > 0);
      const clearedAfterHit = firstHit >= 0 && ccCalls.slice(firstHit + 1).some((c) => c.findings === 0);
      const snapshotFindingsBeforeFinal = r.steps.slice(1, 3).some((st) => st.checkConsistency.findings.length > 0);
      const anyFinding = r.steps.slice(1).some((st) => st.checkConsistency.findings.length > 0);
      return {
        session: r.session,
        clean,
        trapped: !functional && !clean,
        functionalFailure: functional,
        failedTests: fin.tests.failed,
        tscErrorsFinal: fin.tscErrors,
        changedLines: fin.sizeVsSeed?.changed ?? null,
        subGoals: sg,
        caught,
        checkConsistencyPerStep: findingsAtStep,
        finalFindings: fin.checkConsistency.findings,
        toolCallsPerStep: r.steps.slice(1).map((st) => st.toolCalls?.total ?? 0),
        agentToolReturnedFindings: toolSawFindings,
        caughtAndFixedTool: anyFinding && clean,
        caughtAndFixedToolStrict: snapshotFindingsBeforeFinal && clean,
        findingsThenTrapped: toolSawFindings && !clean && !functional,
        toolFindingFirstAt: firstHit >= 0 ? ccCalls[firstHit]?.step ?? null : null,
        toolFindingClearedByLaterCall: clearedAfterHit,
        caughtAndFixedToolCallGrain: clearedAfterHit && clean,
      };
    });
    const n = perRun.length;
    const c = perRun.filter((r) => r.clean).length;
    const b = base.puzzles.find((x) => x.puzzle === p) as Json;
    puzzles.push({
      puzzle: p,
      runs: n,
      cleanSolves: c,
      trapped: perRun.filter((r) => r.trapped).length,
      functionalFailures: perRun.filter((r) => r.functionalFailure).length,
      cleanRate: n === 0 ? null : +(c / n).toFixed(3),
      wilson95: wilson(c, n),
      passHat5: n >= 5 ? +(choose(c, 5) / choose(n, 5)).toFixed(3) : null,
      perSubGoalSuccess: meta.subGoals.map((m) => ({ id: m.id, family: m.family, pass: perRun.filter((r) => r.subGoals.find((g) => g.id === m.id)?.pass === true).length, of: n, caughtAndFixed: perRun.filter((r) => r.caught.find((x) => x.id === m.id)?.caughtAndFixed === true).length })),
      caughtAndFixedTool: perRun.filter((r) => r.caughtAndFixedTool).length,
      caughtAndFixedToolStrict: perRun.filter((r) => r.caughtAndFixedToolStrict).length,
      toolFindingClearedByLaterCall: perRun.filter((r) => r.toolFindingClearedByLaterCall).length,
      caughtAndFixedToolCallGrain: perRun.filter((r) => r.caughtAndFixedToolCallGrain).length,
      runsWhereToolReturnedFindings: perRun.filter((r) => r.agentToolReturnedFindings).length,
      findingsThenTrapped: perRun.filter((r) => r.findingsThenTrapped).map((r) => r.session),
      baseline: { runs: b.runs, cleanSolves: b.cleanSolves, trapped: b.trapped, functionalFailures: b.functionalFailures, wilson95: b.wilson95, passHat5: b.passHat5, perSubGoalSuccess: b.perSubGoalSuccess },
      perRun,
    });
    // Hand-read list: every oracle FAIL on a final tree, and every run that got findings and still finished trapped.
    for (const r of perRun) {
      const fails = r.subGoals.filter((g) => !g.pass);
      if (fails.length === 0 && !r.findingsThenTrapped) continue;
      const finalDiff = (() => {
        const d = spawnSync('git', ['diff', '--no-index', '--no-color', path.join(RESULTS, 'sessions', r.session, 'snap', 'step-00', 'src'), path.join(RESULTS, 'sessions', r.session, 'snap', 'step-03', 'src')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '';
        const files = new Set(fails.flatMap((g) => g.evidence.map((e) => (e.split(/[:\s]/)[0] ?? '').replace(/^src\//, ''))));
        const chunks = d.split(/^diff --git /m).filter((ch) => [...files].some((f) => f !== '' && ch.includes(f)));
        return chunks.map((ch) => `diff --git ${ch}`).join('').split(`${path.join(RESULTS, 'sessions', r.session, 'snap', 'step-00', 'src')}/`).join('/src/').split(`${path.join(RESULTS, 'sessions', r.session, 'snap', 'step-03', 'src')}/`).join('/src/').split('\n').slice(0, 120).join('\n');
      })();
      toRead.push([
        `## ${p} / ${r.session}`,
        '',
        `- Outcome on the final tree: ${r.clean ? 'clean' : r.functionalFailure ? 'functional failure' : 'trapped'}; tsc errors ${String(r.tscErrorsFinal)}; changed lines ${String(r.changedLines)}.`,
        `- Oracle FAILs: ${fails.length === 0 ? 'none' : fails.map((g) => `${g.id} (${g.evidence.join('; ')})`).join(' | ')}.`,
        `- check_consistency on the step snapshots (findings at steps 1, 2, 3): ${r.checkConsistencyPerStep.map((x) => String(x.findings)).join(', ')}; on the final tree: ${r.finalFindings.map((f) => `${f.rule} ${f.file}:${String(f.line)}`).join(', ') || 'none'}.`,
        `- Tool calls per step (all tools, record only): ${r.toolCallsPerStep.join(', ')}; the agent's own check_consistency calls returned findings: ${r.agentToolReturnedFindings ? 'yes' : 'no'}.`,
        `- Got findings and still finished trapped: ${r.findingsThenTrapped ? 'YES: read whether it tried and failed (tsc, tests) or ignored the finding' : 'no'}.`,
        '- Proposed label: (author to fill)',
        '',
        'Diff excerpt (seed → final, files the oracle cites; first 120 lines):',
        '',
        '```diff',
        finalDiff,
        '```',
        '',
      ].join('\n'));
    }
  }
  const out = { schema: 'puzzle-02-tool-arm-scores/v1', calls: { model: 0, generator: 0, network: 0 }, provisional: 'counts stay provisional until the author hand-reads oracle-verdicts-to-read.md', puzzles, sessions };
  fs.writeFileSync(path.join(RESULTS, 'scores.json'), `${JSON.stringify(out, null, 1).split(path.resolve('.')).join('.')}\n`);
  fs.writeFileSync(path.join(RESULTS, 'oracle-verdicts-to-read.md'), `${[
    '# PUZZLE-02 tool arm: oracle verdicts to read by hand',
    '',
    'Every oracle FAIL on a final tree, and every run whose own check_consistency calls returned findings and that still',
    'finished trapped, with the diff excerpt of the files the oracle cites. Counts stay **provisional** until the author',
    'has read these. Generated by `experiments/puzzle-02-tool-arm/score-tool-arm.ts` (zero calls). No agent message is quoted.',
    '',
    ...(toRead.length === 0 ? ['None.'] : toRead),
  ].join('\n')}\n`);
  for (const p of puzzles) process.stdout.write(`${String(p.puzzle)}: runs ${String(p.runs)}, clean ${String(p.cleanSolves)}, trapped ${String(p.trapped)}, functional ${String(p.functionalFailures)}, Wilson ${JSON.stringify(p.wilson95)}, caught-and-fixed (snapshot) ${String(p.caughtAndFixedTool)}, (tool-call grain) ${String(p.caughtAndFixedToolCallGrain)}, sub-goals ${JSON.stringify(p.perSubGoalSuccess)}\n`);
  return 0;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`); process.exitCode = 1; });
