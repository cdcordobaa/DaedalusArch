/**
 * v1.5 final study (zero calls): build the driver input for `run-study.ts` from the study task set, in the
 * TRAPRATE-01 sandbox layout (`experiments/traprate-01/make-input.ts`) extended with the delivery hub.
 *
 *   npx tsx experiments/v15-study/make-input.ts --o /srv/o --vault /srv/vault [--clone <repo>] [--replicates 3] [--srv /srv] [--sock /srv/m]
 *       [--phase study|stage1|lane-a|lane-b|…] [--tasks t01,t13 | f1-ddd-two-aggregates,…]
 *       [--task-root experiments/trap-pilot-v2] [--arms none] [--runs 2] [--binary <cli>] [--cli-binary <cli>] [--results-dir <dir>]
 *
 * `--tasks` restricts the run to a subset (neutral ids or real task ids); the neutral ids stay those of the full set
 * (t01…t25 in study-set order), so a subset run and the full run name every task the same. `--phase` (default `study`)
 * gives the run its own input and out root (`<o>/<phase>/input.json`, `<o>/<phase>/out`), its own results directory
 * (`results/v1.5-study/<phase>/`) and caps computed for the subset (turns × 1.06, smoke 2, probes 1).
 *
 * Writes (all root-only once `setup-sandbox.sh` closes them):
 * - `<o>/seeds/tNN/` (each task's `seed/`), `<o>/specs/tNN.yaml` (each task's `spec.yaml` with a canary comment as its
 *   first line), `<o>/seeds/d1`, `<o>/specs/d1.yaml`, `<o>/edits/d1.ts` (the edit-gate dummy, for the relay checks);
 * - `<o>/<phase>/input.json`: neutral ids t01…t25, the steps verbatim, the seed tree sha256, the per-task spec path, the plan
 *   parameters (order seed 20261029, replicates, arms `none` and `combined`) and the hard caps;
 * - `<vault>/private-id-map.json` (tNN → task, style, confirmatory), `<vault>/canary.txt`, `<o>/canary.txt`,
 *   `<vault>/sweep-patterns.txt` (the fingerprint patterns, root-only, piped to the sweep).
 * The task order in the input is the study-set order (confirmatory DDD, confirmatory Hexagonal, then any exploratory); the run
 * order comes from the plan's seeded shuffle.
 *
 * Pilot option (calibration runs, not study data): `--task-root <dir>` reads the tasks from `<dir>/<task>/<level>/`
 * (the TRAP-PILOT-v2 layout: every variant directory has the trap-families files) instead of `study-set.json`; the
 * neutral ids are then those of every variant under the root, in sorted order, and `--tasks` also takes short names
 * (`p1/L1` for `p1-campsite-payments/L1`). `--arms` restricts the plan to a subset of the arms (`none`), `--runs` is a
 * synonym of `--replicates`, `--binary` / `--cli-binary` point at a local CLI, `--results-dir` overrides the results
 * directory, and the input gains `taskRoot`. Without these options the output is the study's, unchanged.
 *
 * Study-set option (the Hexagonal study, pre-registration B9): `--study-set <manifest>` (repository-relative, e.g.
 * `experiments/hx-study-set/study-set.json`) reads the task set from that manifest instead of the trap-families one;
 * its `taskDirs` name each task's directory, so tasks from several roots (`hx-study-set/part-a`, `part-b`,
 * `trap-families`) form one set (`lib/study-set.ts`). The neutral ids follow the manifest's order; the manifest and every
 * task root are added to the denied paths, `hx-study-set` to the sweep patterns, and the input gains `studySet`.
 * Without the option the output is byte-identical (`study-input-diff.sh`). Not combinable with `--task-root`.
 */
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ARMS, ORDER_SEED, DEFAULT_REPLICATES, buildPlan, capsFor, plannedTurns, type Arm } from './lib/plan.js';
import { FRAME_COMBINED_SHA256 } from './lib/arms.js';
import { loadStudySet } from './lib/study-set.js';

const arg = (k: string, d?: string): string => { const i = process.argv.indexOf(k); const v = i >= 0 ? process.argv[i + 1] : d; if (v === undefined) throw new Error(`missing ${k}`); return v; };
const O = path.resolve(arg('--o'));
const VAULT = path.resolve(arg('--vault'));
const CLONE = path.resolve(arg('--clone', process.cwd()));
const SRV = path.resolve(arg('--srv', '/srv'));
const R = Number(process.argv.includes('--runs') ? arg('--runs') : arg('--replicates', String(DEFAULT_REPLICATES)));
// Unix socket paths are limited to ~104 bytes (macOS) / 108 (Linux): a local run passes a short directory.
const SOCK = path.resolve(arg('--sock', path.join(SRV, 'm')));
const FAM = 'experiments/trap-families';
const PHASE = arg('--phase', 'study');
if (!/^[a-z0-9][a-z0-9-]*$/.test(PHASE)) throw new Error(`--phase must match [a-z0-9-]+, got ${PHASE}`);
const TASKS_ARG = process.argv.includes('--tasks') ? arg('--tasks').split(',').map((x) => x.trim()).filter(Boolean) : null;
const PO = path.join(O, PHASE);
// Pilot option: the task root (variants `<task>/<level>/`) and the arm subset; absent, the study's set and both arms.
const TASK_ROOT = process.argv.includes('--task-root') ? arg('--task-root').replace(/\/+$/, '') : null;
const RUN_ARMS: readonly Arm[] = process.argv.includes('--arms') ? arg('--arms').split(',').map((x) => x.trim()).filter(Boolean) as Arm[] : ARMS;
for (const a of RUN_ARMS) if (!ARMS.includes(a)) throw new Error(`--arms: unknown arm ${a}`);
if (RUN_ARMS.length === 0 || new Set(RUN_ARMS).size !== RUN_ARMS.length) throw new Error('--arms must name each arm at most once');
const ORDERED_ARMS: readonly Arm[] = ARMS.filter((a) => RUN_ARMS.includes(a));
// Study-set option: one manifest whose tasks may live under several roots; absent, the trap-families set.
const STUDY_SET = process.argv.includes('--study-set') ? loadStudySet(process.cwd(), arg('--study-set')) : null;
if (STUDY_SET !== null && TASK_ROOT !== null) throw new Error('--study-set and --task-root are exclusive');

const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');
// the driver's `filesOf` / `treeSha` (top-level node_modules skipped, regular files only, default sort)
const filesOf = (dir: string): string[] => {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (rel === '' && e.name === 'node_modules') continue;
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.isFile()) out.push(r);
    }
  };
  walk('');
  return out.sort();
};
const treeSha = (dir: string): string => sha256(`${filesOf(dir).map((f) => `${f}\t${sha256(fs.readFileSync(path.join(dir, f)))}`).join('\n')}\n`);

// The task set is read from study-set.json at build time: the confirmatory lists (12 DDD + 13 Hexagonal since f19 was
// admitted on HCAL-03), then any exploratory task still listed.
// With --task-root, every variant directory `<task>/<level>/` holding a `puzzle.json` (sorted), none confirmatory.
const pilotIds = (root: string): string[] => fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  .flatMap((t) => fs.readdirSync(path.join(root, t), { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(root, t, e.name, 'puzzle.json'))).map((e) => `${t}/${e.name}`).sort());
const set = STUDY_SET !== null ? STUDY_SET : TASK_ROOT === null
  ? JSON.parse(fs.readFileSync(path.join(FAM, 'study-set.json'), 'utf8')) as { confirmatory: { ddd: string[]; hexagonal: string[] }; exploratory?: { ddd?: string[]; hexagonal?: string[] } }
  : { confirmatory: { ddd: [], hexagonal: [] }, exploratory: { hexagonal: pilotIds(TASK_ROOT) } };
const TASKS_DIR = TASK_ROOT ?? FAM;
const taskDir = (task: string): string => (STUDY_SET !== null ? STUDY_SET.dirOf(task) : path.join(TASKS_DIR, task));
const confirmatory = new Set([...set.confirmatory.ddd, ...set.confirmatory.hexagonal]);
const ids = [...set.confirmatory.ddd, ...set.confirmatory.hexagonal, ...(set.exploratory?.ddd ?? []), ...(set.exploratory?.hexagonal ?? [])];
if (new Set(ids).size !== ids.length) throw new Error('a task is listed twice in study-set.json');

const canaries = { vault: randomBytes(16).toString('hex'), out: randomBytes(16).toString('hex'), spec: randomBytes(16).toString('hex') };
for (const d of ['seeds', 'specs', 'edits']) fs.mkdirSync(path.join(O, d), { recursive: true });
fs.mkdirSync(VAULT, { recursive: true });

const tasks: { id: string; seedDir: string; seedTreeSha256: string; specPath: string; steps: string[] }[] = [];
const map: Record<string, { task: string; style: string; confirmatory: boolean }> = {};
for (const [i, task] of ids.entries()) {
  const tid = `t${String(i + 1).padStart(2, '0')}`;
  const dir = taskDir(task);
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'tasks.json'), 'utf8')) as { tasks: { steps: { request: string }[] }[] };
  const steps = doc.tasks[0]!.steps.map((s) => s.request);
  const seedDir = path.join(O, 'seeds', tid);
  fs.rmSync(seedDir, { recursive: true, force: true });
  fs.cpSync(path.join(dir, 'seed'), seedDir, { recursive: true });
  const specPath = path.join(O, 'specs', `${tid}.yaml`);
  fs.writeFileSync(specPath, `# canary-${canaries.spec}\n${fs.readFileSync(path.join(dir, 'spec.yaml'), 'utf8')}`);
  tasks.push({ id: tid, seedDir, seedTreeSha256: treeSha(seedDir), specPath, steps });
  map[tid] = { task, style: (JSON.parse(fs.readFileSync(path.join(dir, 'puzzle.json'), 'utf8')) as { style: string }).style, confirmatory: confirmatory.has(task) };
}
// The run's subset (all tasks when --tasks is absent); neutral ids are those of the full set.
const resolveId = (x: string): string => {
  if (map[x] !== undefined) return x;
  // A pilot short name `p1/L1` names the variant `p1-…/L1`.
  const short = (task: string): boolean => TASK_ROOT !== null && x.includes('/') && task.endsWith(`/${x.split('/')[1]!}`) && task.startsWith(`${x.split('/')[0]!}-`);
  const hit = Object.entries(map).find(([, v]) => v.task === x) ?? Object.entries(map).find(([, v]) => short(v.task));
  if (hit === undefined) throw new Error(`--tasks: unknown task ${x}`);
  return hit[0];
};
const wanted = TASKS_ARG === null ? null : new Set(TASKS_ARG.map(resolveId));
const runTasks = wanted === null ? tasks : tasks.filter((t) => wanted.has(t.id));
if (runTasks.length === 0) throw new Error('--tasks selects no task');
// Dry tasks: the first task of each style in the run; a one-style run takes its first two tasks.
const styleOf = (tid: string): string => map[tid]!.style;
const firstOf = (style: string): string | undefined => runTasks.find((t) => styleOf(t.id) === style)?.id;
const dryTasks = [firstOf('ddd'), firstOf('hexagonal')].filter((x): x is string => x !== undefined);
for (const t of runTasks) if (dryTasks.length < 2 && !dryTasks.includes(t.id)) dryTasks.push(t.id);
while (dryTasks.length < 2) dryTasks.push(dryTasks[0] as string);

// The edit-gate dummy (no study task text): the relay checks and the scripted S4 need one violating edit.
const DUMMY = 'experiments/edit-gate/fixtures/dummy';
fs.rmSync(path.join(O, 'seeds', 'd1'), { recursive: true, force: true });
fs.cpSync(path.join(DUMMY, 'seed'), path.join(O, 'seeds', 'd1'), { recursive: true });
fs.writeFileSync(path.join(O, 'specs', 'd1.yaml'), `# canary-${canaries.spec}\n${fs.readFileSync(path.join(DUMMY, 'spec.yaml'), 'utf8')}`);
fs.copyFileSync(path.join(DUMMY, 'edits', 'SettleInvoices.violating.ts'), path.join(O, 'edits', 'd1.ts'));

fs.writeFileSync(path.join(VAULT, 'canary.txt'), `canary-${canaries.vault}\n`);
fs.writeFileSync(path.join(O, 'canary.txt'), `canary-${canaries.out}\n`);
fs.writeFileSync(path.join(VAULT, 'private-id-map.json'), `${JSON.stringify(map, null, 1)}\n`);

// READ probe (PUZZLE-01 isolation check 3): the first task's README at its clone path, both canaries, a spec copy.
const probeTask = ids[0]!;
const readmeFirst = fs.readFileSync(path.join(taskDir(probeTask), 'README.md'), 'utf8').split('\n').find((l) => l.trim() !== '')!.replace(/^#+\s*/, '').trim();
const probePaths = [path.join(CLONE, taskDir(probeTask), 'README.md'), path.join(VAULT, 'canary.txt'), path.join(O, 'canary.txt'), runTasks[0]!.specPath];
const canaryStrings = Object.values(canaries).flatMap((c) => [`canary-${c}`, c]);
// An id that is part of a probe path is echoed back in the agent's refusal ("cannot read …/<id>/README.md") and is
// no leak; only file contents and the other ids count (the TRAPRATE-01 probe-id fix).
const forbidden = [readmeFirst, ...canaryStrings, ...ids.filter((id) => !probePaths.some((p) => p.includes(id)))];

const plan = buildPlan({ tasks: runTasks.map((t) => ({ id: t.id, steps: t.steps.length })), arms: ORDERED_ARMS, replicates: R, orderSeed: ORDER_SEED });
const caps = capsFor(plan, ORDERED_ARMS);
const OUT = path.join(PO, 'out');
fs.mkdirSync(PO, { recursive: true });
const input = {
  schema: 'v15-study-input/v1',
  phase: PHASE, taskSubset: wanted === null ? null : runTasks.map((t) => t.id), resultsDir: process.argv.includes('--results-dir') ? path.resolve(CLONE, arg('--results-dir')) : path.join(CLONE, 'results', 'v1.5-study', PHASE),
  modelId: 'claude-sonnet-5-5', binary: process.argv.includes('--binary') ? path.resolve(arg('--binary')) : path.join(SRV, 'bin', 'gclaude'), cliBinary: process.argv.includes('--cli-binary') ? path.resolve(arg('--cli-binary')) : '/opt/claude-code/bin/claude', cliVersionPin: null,
  harnessRoot: path.join(SRV, 'h'), workRoot: path.join(SRV, 'w'), outRoot: OUT, vault: VAULT,
  genUid: 1500, genGid: 1500, genHome: path.join(SRV, 'gh'),
  orderSeed: ORDER_SEED, replicates: R, arms: ORDERED_ARMS, timeoutMs: 1_200_000,
  frameCombinedSha256: FRAME_COMBINED_SHA256,
  plannedSessions: plan.length, plannedTurns: plannedTurns(plan), caps,
  delivery: {
    nodeBinary: process.execPath, gateRelay: path.join(SRV, 'h', 'bin', 'gate-relay.cjs'), mcpRelay: path.join(SRV, 'h', 'bin', 'mcp-relay.cjs'),
    socketDir: SOCK, logDir: path.join(OUT, 'hub'), layers: true,
  },
  tasks: runTasks,
  dryTasks,
  dummy: { seedDir: path.join(O, 'seeds', 'd1'), specPath: path.join(O, 'specs', 'd1.yaml'), editFile: 'src/billing/application/SettleInvoices.ts', editContent: path.join(O, 'edits', 'd1.ts') },
  probe: { outsideProject: path.join(SRV, 'w') },
  readProbe: { paths: probePaths, forbidden },
  isolation: {
    // §6 item 1: specs, canaries, hub code, hub and MCP logs, the task map, the design note, sealed roots, root's temp.
    denied: [
      runTasks[0]!.specPath, path.join(PO, 'input.json'), path.join(O, 'canary.txt'), path.join(VAULT, 'canary.txt'), path.join(VAULT, 'private-id-map.json'),
      path.join(O, 'seeds', runTasks[0]!.id), path.join(OUT, 'hub'), path.join(OUT, 'sessions'),
      path.join(CLONE, 'src', 'v15-instrument', 'delivery', 'hub.ts'), path.join(CLONE, 'ops', 'notes', 'v15-combined-delivery-design-2026-10-26.md'),
      path.join(CLONE, FAM, 'study-set.json'), path.join(CLONE, 'experiments', 'hcal-03'), path.join(CLONE, 'experiments', 'v15-study', 'run-study.ts'),
      '/root', '/tmp/claude-0', '/tmp/tsx-0',
      ...(TASK_ROOT === null ? [] : [path.join(CLONE, TASK_ROOT)]),
      ...(STUDY_SET === null ? [] : [path.join(CLONE, STUDY_SET.manifest), ...STUDY_SET.roots.filter((r) => r !== FAM).map((r) => path.join(CLONE, r))]),
    ],
    canaries: canaryStrings,
    sweepPatternsFile: path.join(VAULT, 'sweep-patterns.txt'),
  },
  ...(TASK_ROOT === null ? {} : { taskRoot: TASK_ROOT }),
  ...(STUDY_SET === null ? {} : { studySet: STUDY_SET.manifest }),
};

// Fingerprint patterns (§6 item 2): canaries, the TRAPRATE set, note title, hub header, spec header, task phrases.
const pats = new Set<string>([...forbidden, 'trap-families', 'TRAP-FAMILIES', 'TRAPRATE-01', 'winning line', 'trap line',
  'v1.5 final study: combined delivery', 'v1.5 combined delivery hub', 'Edit-gate dummy project spec', 'v1.5 final study: the run plan']);
if (STUDY_SET !== null) pats.add('hx-study-set');
for (const t of tasks) for (const s of t.steps.slice(1)) pats.add(s.slice(0, 40));
for (const v of Object.values(map)) pats.add(v.task);
fs.writeFileSync(path.join(VAULT, 'sweep-patterns.txt'), `${[...pats].filter((p) => p.length >= 8).join('\n')}\n`);
fs.writeFileSync(path.join(PO, 'input.json'), `${JSON.stringify(input, null, 1)}\n`);
process.stdout.write(`input ${path.join(PO, 'input.json')} (phase ${PHASE}): ${String(runTasks.length)} tasks × ${String(ORDERED_ARMS.length)} arms × ${String(R)} replicates = ${String(plan.length)} sessions, ${String(plannedTurns(plan))} turns planned; caps ${JSON.stringify(caps)}; dry tasks ${dryTasks.join(', ')}\n`);
