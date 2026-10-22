/**
 * PUZZLE-04 scorer (zero calls: no model, no network, no Neo4j). Plan: `plan.md` §6. Built from the PUZZLE-03
 * baseline scorer and the PUZZLE-02 tool-arm scorer (same outcome rules).
 *
 * For every session of one arm (`<results>/sessions/<id>/`), on every step snapshot (`snap/step-00` = seed …
 * `snap/step-03`): the puzzle's behaviour tests from outside, every sub-goal oracle, the changed lines against the seed,
 * and the gate's two checks in process (DETECT-02 `check_consistency` on the whole tree; the frozen layer rules
 * FF-S01–S03 of `experiments/edit-gate/layers.ts` against `step-00`). The type-check count is the harness's own
 * (`run/turns.jsonl`). Events, for the record: the hub log (`gate/<id>.gate.jsonl`) for `gate`; the MCP tap and the
 * frozen call log (`mcp/<id>.tap.jsonl`, `mcp/<id>.calls.jsonl`) for `pull`.
 * Writes `<results>/scores.json`, `<results>/diffs/<session>/step-0N.diff` and `<results>/oracle-verdicts-to-read.raw.md`.
 *
 * Usage (repository root): npx tsx experiments/puzzle-04/score.ts --arm gate|pull --results results/v1.4-puzzle-04/<arm>
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkConsistency } from '../detect-02/mcp/consistency.js';
import { checkLayers } from '../edit-gate/layers.js';

const REPO = process.cwd();
const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ARM = arg('arm') as 'gate' | 'pull';
const RESULTS = arg('results') ?? `results/v1.4-puzzle-04/${ARM}`;
const STEPS = ['step-00', 'step-01', 'step-02', 'step-03'];
const PUZZLE_DIR: Record<string, string> = {
  'p1-transfers': 'experiments/puzzle-01/puzzles/p1-transfers',
  'p2-loyalty': 'experiments/puzzle-01/puzzles/p2-loyalty',
  'p3r-shipping-quotes': 'experiments/puzzle-03/puzzles/p3r-shipping-quotes',
  'p5-ferry-seats': 'experiments/puzzle-03/puzzles/p5-ferry-seats',
  'p6-workshop-jobs': 'experiments/puzzle-03/puzzles/p6-workshop-jobs',
};
const ORDER = Object.keys(PUZZLE_DIR);

interface Json { [k: string]: unknown }
interface SubGoal { readonly id: string; readonly pass: boolean; readonly evidence: string[] }

const tsx = (args: string[]): Json | null => {
  const out = spawnSync('npx', ['tsx', ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? '';
  const line = out.trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  return line === undefined ? null : (JSON.parse(line) as Json);
};
const readJsonl = (f: string): Json[] => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Json) : []);

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

function changedFiles(a: string, b: string): string[] {
  const r = spawnSync('git', ['diff', '--no-index', '--name-only', a, b], { encoding: 'utf8' });
  // `--no-index` prints each name under the side that has it (b for added and modified files, a for deleted ones).
  return (r.stdout ?? '').trim().split('\n').filter(Boolean).map((f) => (f.startsWith(`${b}/`) ? f.slice(b.length + 1) : f.startsWith(`${a}/`) ? f.slice(a.length + 1) : f));
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
const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

/** ±3 lines around each cited file:line (first 3 citations), for the hand read. */
function excerpts(tree: string, evidence: readonly string[]): string {
  const out: string[] = [];
  const cited = [...new Set(evidence.map((e) => /(src\/[^\s:]+\.ts):(\d+)/.exec(e)).filter((m): m is RegExpExecArray => m !== null).map((m) => `${m[1]}:${m[2]}`))].slice(0, 3);
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

/** Gate hub log of one turn, summarised (for the record). */
function gateSummary(lines: Json[]): Json {
  const edits = lines.filter((l) => l.event === 'PostToolUse' && l.refused === null);
  const keys = (k: string, pre: string): number => lines.reduce((a, l) => a + (l[k] as string[]).filter((x) => x.startsWith(pre)).length, 0);
  const ms = lines.filter((l) => l.refused === null).map((l) => l.ms as number);
  return {
    edits: edits.length,
    replied: lines.filter((l) => l.replied === true).length,
    newConsistency: keys('newKeys', 'R-'),
    newLayer: keys('newKeys', 'FF-S0'),
    resolved: lines.reduce((a, l) => a + (l.resolvedKeys as string[]).length, 0),
    stopEvents: lines.filter((l) => l.event === 'Stop').length,
    stopBlocks: lines.filter((l) => l.stopBlock === true).length,
    failOpen: lines.filter((l) => l.failOpen === true).length,
    layerErrors: lines.filter((l) => typeof l.layerError === 'string').length,
    refused: lines.filter((l) => l.refused !== null).length,
    gamingOverlay: lines.some((l) => l.allowOverlay === true),
    hubMsMedian: median(ms),
    hubMsMax: ms.length === 0 ? null : Math.max(...ms),
  };
}

async function main(): Promise<number> {
  if (ARM !== 'gate' && ARM !== 'pull') throw new Error('--arm gate|pull');
  const map = JSON.parse(fs.readFileSync(path.join(RESULTS, 'private-task-map.json'), 'utf8')) as Record<string, string>;
  const schedule = JSON.parse(fs.readFileSync(path.join(RESULTS, 'run', 'schedule.json'), 'utf8')) as { schedule: { id: string; taskId: string; runIndex: number }[] };
  const redraws = readJsonl(path.join(RESULTS, 'run', 'redraws.jsonl')) as unknown as { redrawn: string; as: string; taskId: string }[];
  const specs = [...schedule.schedule.map((s) => ({ ...s, redrawOf: null as string | null })), ...redraws.map((r) => ({ id: r.as, taskId: r.taskId, runIndex: schedule.schedule.find((s) => s.id === r.redrawn)?.runIndex ?? -1, redrawOf: r.redrawn }))];
  const allTurns = readJsonl(path.join(RESULTS, 'run', 'turns.jsonl'));
  const sessions: Json[] = [];
  for (const s of specs) {
    const dir = path.join(RESULTS, 'sessions', s.id);
    if (!fs.existsSync(path.join(dir, 'session.json'))) {
      sessions.push({ session: s.id, task: s.taskId, puzzle: map[s.taskId], runIndex: s.runIndex, redrawOf: s.redrawOf, verdict: 'no session record', complete: false, steps: [] });
      continue;
    }
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'session.json'), 'utf8')) as { verdict: string };
    const puzzle = map[s.taskId] as string;
    const puzzleDir = PUZZLE_DIR[puzzle] as string;
    const spec = path.join(puzzleDir, 'spec.yaml');
    const snaps = STEPS.map((st) => path.join(dir, 'snap', st)).filter((p) => fs.existsSync(p));
    const turns = allTurns.filter((t) => t.session === s.id);
    const gateLog = ARM === 'gate' ? readJsonl(path.join(RESULTS, 'gate', `${s.id}.gate.jsonl`)) : [];
    const tap = ARM === 'pull' ? readJsonl(path.join(RESULTS, 'mcp', `${s.id}.tap.jsonl`)).filter((l) => l.event === 'call') : [];
    const frozenLog = ARM === 'pull' ? readJsonl(path.join(RESULTS, 'mcp', `${s.id}.calls.jsonl`)) : [];
    const steps: Json[] = [];
    for (const [i, snap] of snaps.entries()) {
      const tests = tsx(['experiments/puzzle-01/tools/run-tests.ts', '--puzzle', puzzleDir, '--tree', snap]);
      const oracle = tsx([`${puzzleDir}/oracle.ts`, snap]);
      const cases = (tests?.cases ?? []) as { name: string; kind: string; ok: boolean }[];
      const cc = await checkConsistency({ root: path.resolve(snap), spec: path.resolve(spec) }).catch((e: unknown) => ({ status: 'error', findings: [], error: String(e) }) as unknown as Awaited<ReturnType<typeof checkConsistency>>);
      const lay = i === 0 ? null : await checkLayers({ root: path.resolve(snap), spec: path.resolve(spec), seedDir: path.resolve(snaps[0] as string), changed: changedFiles(snaps[0] as string, snap) }).catch((e: unknown) => ({ error: String(e) }));
      if (i > 0) {
        fs.mkdirSync(path.join(RESULTS, 'diffs', s.id), { recursive: true });
        fs.writeFileSync(path.join(RESULTS, 'diffs', s.id, `${STEPS[i] ?? ''}.diff`), diff(snaps[i - 1] as string, snap));
      }
      const turn = turns.find((t) => t.step === STEPS[i]);
      const calls = tap.filter((c) => c.turn === STEPS[i]);
      steps.push({
        step: STEPS[i],
        status: turn?.status ?? (i === 0 ? 'seed' : null),
        modelUsageIds: turn?.modelUsageIds ?? null,
        tscErrors: i === 0 ? 0 : ((turn?.typecheck as { errors?: number } | undefined)?.errors ?? null),
        tests: { regression: { passed: cases.filter((c) => c.kind === 'regression' && c.ok).length, total: cases.filter((c) => c.kind === 'regression').length }, feature: { passed: cases.filter((c) => c.kind === 'feature' && c.ok).length, total: cases.filter((c) => c.kind === 'feature').length }, failed: cases.filter((c) => !c.ok).map((c) => c.name), error: tests === null ? 'no test output' : undefined },
        oracle: (oracle?.subGoals as SubGoal[] | undefined) ?? null,
        checkConsistency: { status: cc.status, findings: cc.findings.map((f) => `${f.rule} ${f.file}:${String(f.line)}`) },
        layers: lay === null ? null : 'error' in lay ? lay : { findings: lay.findings.map((f) => f.key), advisory: lay.advisory },
        sizeVsSeed: i === 0 ? null : numstat(snaps[0] as string, snap),
        allowFile: fs.existsSync(path.join(snap, 'detect02.allow.yaml')),
        gate: ARM === 'gate' && i > 0 ? gateSummary(gateLog.filter((l) => l.turn === STEPS[i])) : null,
        toolCalls: ARM === 'pull' && i > 0 ? {
          total: calls.length,
          byTool: Object.fromEntries([...new Set(calls.map((c) => String(c.tool)))].map((t) => [t, calls.filter((c) => c.tool === t).length])),
          sequence: calls.map((c) => ({ tool: c.tool, isError: c.isError, status: c.status, findings: c.findings })),
        } : null,
      });
    }
    // Events at the grain of the hub log (gate) or of the tool calls (pull), in order.
    let events: Json = {};
    if (ARM === 'gate') {
      const shown = new Set<string>();
      const resolvedAfterShown = new Set<string>();
      for (const l of gateLog) {
        for (const k of l.newKeys as string[]) shown.add(k);
        for (const k of l.resolvedKeys as string[]) if (shown.has(k)) resolvedAfterShown.add(k);
      }
      const last = [...gateLog].reverse().find((l) => l.refused === null && l.failOpen !== true);
      events = { keysShown: [...shown], keysResolved: [...resolvedAfterShown], openAtEnd: (last?.openKeys as string[] | undefined) ?? [], total: gateSummary(gateLog) };
    } else {
      const frozenTools = frozenLog.filter((l) => l.tool === 'check_file' || l.tool === 'check_diff').map((l) => ({ tool: l.tool, blockingCount: l.blockingCount, verdict: l.verdict, error: l.error }));
      const cc = tap.filter((c) => c.tool === 'check_consistency').map((c) => (typeof c.findings === 'number' ? c.findings : null));
      const ccHit = cc.findIndex((f) => (f ?? 0) > 0);
      const fzHit = frozenTools.findIndex((f) => typeof f.blockingCount === 'number' && f.blockingCount > 0);
      events = {
        toolCalls: tap.length,
        byTool: Object.fromEntries([...new Set(tap.map((c) => String(c.tool)))].map((t) => [t, tap.filter((c) => c.tool === t).length])),
        checkConsistencyFindings: cc,
        frozenCheckBlocking: frozenTools.map((f) => f.blockingCount),
        consistencyClearedAfterHit: ccHit >= 0 && cc.slice(ccHit + 1).some((f) => f === 0),
        frozenClearedAfterHit: fzHit >= 0 && frozenTools.slice(fzHit + 1).some((f) => f.blockingCount === 0),
        sawFindings: ccHit >= 0 || fzHit >= 0,
      };
    }
    sessions.push({ session: s.id, task: s.taskId, puzzle, runIndex: s.runIndex, redrawOf: s.redrawOf, verdict: meta.verdict, complete: snaps.length === STEPS.length && meta.verdict === 'done', steps, events });
  }

  const puzzles: Json[] = [];
  const toRead: string[] = [];
  for (const p of ORDER) {
    const metaFile = `${PUZZLE_DIR[p] as string}/puzzle.json`;
    const pmeta = JSON.parse(fs.readFileSync(metaFile, 'utf8')) as { subGoals: { id: string; family: string }[] };
    type Step = { step: string; tests: { regression: { passed: number; total: number }; feature: { passed: number; total: number }; failed: string[] }; oracle: SubGoal[] | null; tscErrors: number | null; sizeVsSeed: { changed: number } | null; checkConsistency: { findings: string[] }; layers: { findings: string[] } | null; gate: Json | null; toolCalls: { total: number } | null };
    const runs = sessions.filter((s) => s.puzzle === p && s.complete === true) as unknown as { session: string; steps: Step[]; events: Json }[];
    if (runs.length === 0 && !sessions.some((s) => s.puzzle === p)) continue;
    const testsPass = (st: Step): boolean => st.tests.regression.passed === st.tests.regression.total && st.tests.feature.passed === st.tests.feature.total && st.tests.feature.total > 0;
    const perRun = runs.map((r) => {
      const fin = r.steps[3] as Step;
      const sg = (fin.oracle ?? []).map((g) => ({ id: g.id, pass: g.pass, evidence: g.evidence }));
      const functional = !testsPass(fin);
      const clean = !functional && sg.length > 0 && sg.every((g) => g.pass);
      const caught = pmeta.subGoals.map((m) => ({
        id: m.id,
        failedAtStep: r.steps.slice(1, 3).flatMap((st, k) => (st.oracle?.find((g) => g.id === m.id)?.pass === false ? [`step-0${String(k + 1)}`] : [])),
        passFinal: sg.find((g) => g.id === m.id)?.pass ?? null,
      })).map((c) => ({ ...c, caughtAndFixed: c.failedAtStep.length > 0 && c.passFinal === true }));
      const finalChecks = [...fin.checkConsistency.findings, ...(fin.layers?.findings ?? [])];
      const ev = r.events;
      const eventGrain = ARM === 'gate'
        ? (ev.keysResolved as string[]).length > 0 && clean
        : (ev.consistencyClearedAfterHit === true || ev.frozenClearedAfterHit === true) && clean;
      const sawFindings = ARM === 'gate' ? (ev.keysShown as string[]).length > 0 : ev.sawFindings === true;
      const snapshotChecksBeforeFinal = r.steps.slice(1, 3).some((st) => st.checkConsistency.findings.length + (st.layers?.findings.length ?? 0) > 0);
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
        checksPerStep: r.steps.slice(1).map((st) => ({ step: st.step, consistency: st.checkConsistency.findings.length, layers: st.layers?.findings.length ?? null })),
        finalChecks,
        sawFindings,
        findingsThenTrapped: sawFindings && !clean && !functional,
        caughtAndFixedSnapshotChecks: snapshotChecksBeforeFinal && finalChecks.length === 0 && clean,
        caughtAndFixedEventGrain: eventGrain,
        silentButOracleFails: finalChecks.length === 0 && !functional && !clean,
        events: ev,
      };
    });
    const n = perRun.length;
    const c = perRun.filter((r) => r.clean).length;
    const lines = perRun.map((r) => r.changedLines).filter((x): x is number => x !== null);
    puzzles.push({
      puzzle: p,
      arm: ARM,
      runs: n,
      incompleteSessions: sessions.filter((s) => s.puzzle === p && s.complete !== true).map((s) => `${String(s.session)} (${String(s.verdict)})`),
      cleanSolves: c,
      trapped: perRun.filter((r) => r.trapped).length,
      functionalFailures: perRun.filter((r) => r.functionalFailure).length,
      cleanRate: n === 0 ? null : +(c / n).toFixed(3),
      wilson95: wilson(c, n),
      passHat5: n >= 5 ? +(choose(c, 5) / choose(n, 5)).toFixed(3) : null,
      perSubGoalSuccess: pmeta.subGoals.map((m) => ({ id: m.id, family: m.family, pass: perRun.filter((r) => r.subGoals.find((g) => g.id === m.id)?.pass === true).length, of: n, caughtAndFixedSnapshot: perRun.filter((r) => r.caught.find((x) => x.id === m.id)?.caughtAndFixed === true).length })),
      caughtAndFixedSnapshot: perRun.filter((r) => r.caught.some((x) => x.caughtAndFixed)).length,
      caughtAndFixedSnapshotChecks: perRun.filter((r) => r.caughtAndFixedSnapshotChecks).length,
      caughtAndFixedEventGrain: perRun.filter((r) => r.caughtAndFixedEventGrain).length,
      sawFindings: perRun.filter((r) => r.sawFindings).length,
      findingsThenTrapped: perRun.filter((r) => r.findingsThenTrapped).map((r) => r.session),
      silentButOracleFails: perRun.filter((r) => r.silentButOracleFails).map((r) => r.session),
      finalTreesFlaggedByChecks: perRun.filter((r) => r.finalChecks.length > 0).length,
      tscErrorsFinalMax: Math.max(0, ...perRun.map((r) => r.tscErrorsFinal ?? 0)),
      changedLinesMedian: median(lines),
      perRun,
    });
    for (const r of perRun) {
      const s = sessions.find((x) => x.session === r.session) as { steps: { step: string }[] };
      const final = path.join(RESULTS, 'sessions', r.session, 'snap', 'step-03');
      for (const g of r.subGoals.filter((x) => !x.pass)) {
        toRead.push(`## ${r.session} ${p} ${g.id} (oracle FAIL; ${r.functionalFailure ? 'functional failure' : 'tests pass'})\n\n- Oracle evidence:\n${g.evidence.map((e) => `  - \`${e}\``).join('\n')}\n- Checks on the final tree: ${r.finalChecks.length === 0 ? 'none' : r.finalChecks.map((k) => `\`${k}\``).join(', ')}\n- Category: (hand read)\n- Proposed label: (hand read)\n\n${excerpts(final, g.evidence)}`);
      }
      if (r.functionalFailure) toRead.push(`## ${r.session} ${p} functional failure\n\n- Failing tests: ${r.failedTests.map((t) => `\`${t}\``).join(', ')}\n- Oracle: ${r.subGoals.map((g) => `${g.id} ${g.pass ? 'pass' : 'FAIL'}`).join(', ')}\n- Category: (hand read)\n`);
      void s;
    }
  }
  const out = { schema: 'puzzle-04-scores/v1', arm: ARM, calls: { model: 0, generator: 0, network: 0 }, puzzles, sessions };
  fs.writeFileSync(path.join(RESULTS, 'scores.json'), `${JSON.stringify(out, null, 1).split(path.resolve('.')).join('.')}\n`);
  fs.writeFileSync(path.join(RESULTS, 'oracle-verdicts-to-read.raw.md'), `${toRead.join('\n')}\n`.split(path.resolve('.')).join('.'));
  for (const p of puzzles) process.stdout.write(`${ARM} ${String(p.puzzle)}: runs ${String(p.runs)}, clean ${String(p.cleanSolves)}, trapped ${String(p.trapped)}, functional ${String(p.functionalFailures)}, Wilson ${JSON.stringify(p.wilson95)}, c&f snapshot ${String(p.caughtAndFixedSnapshot)}, c&f event ${String(p.caughtAndFixedEventGrain)}, saw findings ${String(p.sawFindings)}, final flagged ${String(p.finalTreesFlaggedByChecks)}, changed lines median ${String(p.changedLinesMedian)}, sub-goals ${JSON.stringify((p.perSubGoalSuccess as { id: string; pass: number }[]).map((x) => `${x.id} ${String(x.pass)}`))}\n`);
  return 0;
}

void main().then((c) => {
  process.exitCode = c;
});
