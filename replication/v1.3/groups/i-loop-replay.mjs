// Docs/v1.3/loop-replay.md (PR #142, merged into v1.3 after the first full run of this package). The replay itself
// runs against Neo4j (the doc: "running it on the interpreter is not done here"; scripts/loop-replay-cli.ts has no
// --engine flag) and commits no output, so every run-level figure is needs-Neo4j. Offline, this group re-derives the
// design of the replay from the committed tapes, arms and pilot plan (tasks, steps, violating steps, the expected run
// and snapshot counts) and regenerates the dry run behind the "stale readiness figure" of §4.
// Excluded (about 40): date 1, versions 2 (Neo4j / APOC 5.26.24), section / memo refs ~10, rule and BR ids ~15,
// exit codes and the historical "capped at 25 per rule" of the pre-fix code, step indices of the latency table.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOC = 'Docs/v1.3/loop-replay.md';
const NEO = 'npm run loop:replay -- --report <file> (scratch Neo4j 5.26 + APOC; no --engine cypher-interp in the replay CLI)';
const n = (id, line, what, stated, extra = {}) => ({ id: `i-lr-${id}`, doc: DOC, line, what, stated, ...extra });
const neo = (id, line, what, stated, note = 'figure of the Neo4j replay run; no output of that run is committed') =>
  n(id, line, what, stated, { needs: 'needs-Neo4j', note });

// The latency table (§3): every numeric cell of its 36 rows, registered from the doc itself (needs-Neo4j: measured
// on the author's container during a Neo4j run; nothing committed to compare with).
const docText = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../..', DOC), 'utf8').split('\n');
const latency = [];
const COLS = ['turn', 'tool calls (ms)', 'type-check ms', 'eval wall ms', 'eval (report) ms'];
docText.forEach((l, i) => {
  const m = l.match(/^\| (market-vendors|shelter-adoptions|relief-volunteers) \| (none|daedalus-mcp|gate) \| (\d) \| (.+) \|$/);
  if (!m) return;
  m[4].split(' | ').forEach((cell, c) => {
    latency.push(neo(`lat-${m[1].split('-')[0]}-${m[2]}-s${m[3]}-c${c}`, i + 1, `latency table ${m[1]} ${m[2]} step ${m[3]}: ${COLS[c]}`, cell,
      'per-step latency measured on the author\'s container during the Neo4j replay; machine-dependent and not committed'));
  });
});

export default [
  {
    id: 'i-lr-design',
    title: 'loop replay: tapes, arms and plan (design of the replay), and the dry run behind §4 risk 4',
    needs: 'offline',
    basis: 're-derived',
    how: 'node --import tsx: REPLAY_TAPES (scripts/lib/loop/replay-tapes.ts), REPLAY_ARMS (replay.ts), experiments/loop-pilot/plan.json; node --import tsx scripts/loop-harness-cli.ts --plan experiments/loop-pilot/plan.json --dry-run',
    numbers: [
      n('tasks', 21, 'pilot tasks replayed', 'Three pilot tasks'),
      n('steps', 21, 'steps per tape', '4 steps each'),
      n('one-violating', 21, 'violating steps per tape', 'one step that introduces a blocking violation'),
      n('viol-market', 25, 'market-vendors violating step', '2'),
      n('viol-shelter', 26, 'shelter-adoptions violating step', '3'),
      n('viol-relief', 27, 'relief-volunteers violating step', '2'),
      n('runs', 42, 'runs (expected from tapes x arms)', '9 runs (3 tasks × 3 arms) × 4 steps',
        { note: 'the expected shape; that the Neo4j run produced it is not checkable offline' }),
      n('snapshots', 42, 'snapshots (expected: step turns + one gate repair per violating step)', '39 snapshots (36 step turns + 3 repair turns)',
        { note: 'the expected count; that the Neo4j run produced it is not checkable offline' }),
      n('repairs-at', 47, 'gate repairs (expected: the scripted steps)', 'market [2], shelter [3], relief [2]',
        { note: 'the scripted steps; that the gate repaired exactly there needs the Neo4j run' }),
      n('stale-6', 145, 'dry-run repair turns at HEAD (readiness doc says 4)', 'On `origin/v1.3` it makes 6'),
      n('stale-2x3', 145, 'planted violations per task x gate runs', '2 planted violations per task × 3 gate runs'),
    ],
    async run(ctx) {
      const tree = ctx.tree();
      const t = JSON.parse(ctx.sh(`node --import tsx --input-type=module -e "import { REPLAY_TAPES as t } from './scripts/lib/loop/replay-tapes.ts'; import { REPLAY_ARMS as a, REPLAY_PLAN as p } from './scripts/lib/loop/replay.ts'; console.log(JSON.stringify({ arms: a, plan: p, tapes: t.map((x) => ({ id: x.taskId, steps: x.steps.length, viol: x.steps.flatMap((s, i) => (s.violating ? [i + 1] : [])) })) }))"`, { cwd: tree }).trim().split('\n').pop());
      const plan = JSON.parse(readFileSync(join(tree, t.plan), 'utf8'));
      const pilotTasks = JSON.parse(readFileSync(join(tree, plan.tasksFile), 'utf8')).tasks.map((x) => x.id ?? x.taskId);
      const words = ['Zero', 'One', 'Two', 'Three', 'Four'];
      const out = {};
      const ids = t.tapes.map((x) => x.id);
      if (!ids.every((id) => pilotTasks.includes(id))) throw new Error(`replay tapes ${ids} are not all pilot tasks ${pilotTasks}`);
      out['i-lr-tasks'] = `${words[t.tapes.length]} pilot tasks`;
      const steps = [...new Set(t.tapes.map((x) => x.steps))];
      out['i-lr-steps'] = steps.length === 1 ? `${steps[0]} steps each` : `steps ${steps.join('/')}`;
      const nv = [...new Set(t.tapes.map((x) => x.viol.length))];
      out['i-lr-one-violating'] = nv.length === 1 && nv[0] === 1 ? 'one step that introduces a blocking violation' : `violating steps per tape: ${t.tapes.map((x) => x.viol.length).join('/')}`;
      const v = Object.fromEntries(t.tapes.map((x) => [x.id, x.viol.join(', ')]));
      out['i-lr-viol-market'] = v['market-vendors'];
      out['i-lr-viol-shelter'] = v['shelter-adoptions'];
      out['i-lr-viol-relief'] = v['relief-volunteers'];
      const runs = t.tapes.length * t.arms.length; const stepTurns = runs * steps[0];
      const repairs = t.tapes.reduce((s, x) => s + x.viol.length, 0) * (t.arms.includes('gate') ? 1 : 0);
      out['i-lr-runs'] = `${runs} runs (${t.tapes.length} tasks × ${t.arms.length} arms) × ${steps[0]} steps`;
      out['i-lr-snapshots'] = `${stepTurns + repairs} snapshots (${stepTurns} step turns + ${repairs} repair turns)`;
      out['i-lr-repairs-at'] = `market [${v['market-vendors']}], shelter [${v['shelter-adoptions']}], relief [${v['relief-volunteers']}]`;
      // The dry run (stub agent, stub evaluator; no Neo4j, no model), as group g-pilot-loopdry runs it.
      const dry = ctx.sh(`node --import tsx scripts/loop-harness-cli.ts --plan experiments/loop-pilot/plan.json --dry-run --out-root ${ctx.out('i-lr-dry')}`, { cwd: tree });
      const s = JSON.parse(dry.slice(dry.lastIndexOf('\n{') + 1));
      out['i-lr-stale-6'] = `On \`origin/v1.3\` it makes ${s.turnsThisInvocation.repair}`;
      const gateRuns = plan.tasks?.length ?? JSON.parse(readFileSync(join(tree, plan.tasksFile), 'utf8')).tasks.length;
      const perTask = s.turnsThisInvocation.repair / gateRuns;
      out['i-lr-stale-2x3'] = `${perTask} planted violations per task × ${gateRuns} gate runs`;
      return out;
    },
  },
  {
    id: 'i-lr-neo4j',
    title: 'loop replay: figures of the Neo4j replay run (not committed)',
    needs: 'needs-Neo4j',
    how: NEO,
    numbers: [
      neo('cli-runs', 38, 'CLI runs', 'two CLI runs'),
      neo('replays-each', 38, 'replays per CLI run', '2 replays each'),
      neo('four-digest', 38, 'replays with the same digest', 'all four replays gave the same digest, `8b8f8693…`'),
      neo('tc-errors', 42, 'type-check errors over all snapshots', '0 errors'),
      neo('p-market', 44, 'none arm: new blocking findings at steps 2–4, market', 'market [2, 0, 0]'),
      neo('p-shelter', 44, 'none arm: new blocking findings at steps 2–4, shelter', 'shelter [0, 2, 0]'),
      neo('p-relief', 44, 'none arm: new blocking findings at steps 2–4, relief', 'relief [1, 0, 0]'),
      neo('labelled', 45, 'new blocking findings labelled', 'All 8 new blocking findings'),
      neo('correct', 45, 'labelled correct', 'All 8 are `correct`'),
      neo('remaining', 47, 'repair outcome remaining / introduced', '`remaining` 0, `introduced` 0'),
      neo('consistency', 48, 'snapshots whose recorded evaluation equals a fresh evaluation', '39 of 39 snapshots'),
      neo('files', 49, 'byte-identical files over two replays', '321 files'),
      neo('timing-files', 49, 'excluded timing files', '39 `timing-*.json` files'),
      neo('timing-keys', 49, 'JSON files with timing keys zeroed', '36 JSON files'),
      neo('kloc-market', 52, 'advisory per KLOC and OLS slope, market none', '0.881 and −0.135'),
      neo('kloc-shelter', 52, 'advisory per KLOC and OLS slope, shelter none', '10.39 and 5.69'),
      neo('kloc-relief', 52, 'advisory per KLOC and OLS slope, relief', '0 and 0'),
      neo('repair-share', 53, 'gate repair success share', 'share 1'),
      neo('repair-mean', 53, 'gate repair mean reduction', 'mean reduction 2, 2 and 1'),
      neo('repair-intro', 53, 'gate repair findings introduced', '0 findings introduced'),
      neo('guard-share', 55, 'share of files matching no layer glob', '0 everywhere'),
      ...latency,
      neo('eval-wall', 105, 'evaluation wall time per snapshot', '0.5–1.1 s'),
      neo('eval-median', 105, 'evaluation wall time median', 'median 0.68 s'),
      neo('eval-report', 105, 'report durationMs', 'about 50 ms'),
      neo('typecheck', 106, 'type-check time', '0.2–0.5 s'),
      neo('mcp-warm', 107, 'MCP tool call, warm', 'About 1 ms'),
      neo('mcp-first', 107, 'MCP tool call, first of a run', 'about 10 ms'),
      neo('consistency-time', 108, 'consistency re-evaluation time', '0.23–0.78 s'),
      neo('harness-add', 109, 'harness time per snapshot', 'about 1–2 s'),
      neo('jest-time', 153, 'test:loop-replay duration', 'about 2 minutes', 'the jest test skips without a scratch Neo4j; duration is machine-dependent'),
    ],
  },
];
