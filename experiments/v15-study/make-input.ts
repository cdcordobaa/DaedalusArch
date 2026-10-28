/**
 * v1.5 final study (zero calls): build the driver input for `run-study.ts` from the study task set, in the
 * TRAPRATE-01 sandbox layout (`experiments/traprate-01/make-input.ts`) extended with the delivery hub.
 *
 *   npx tsx experiments/v15-study/make-input.ts --o /srv/o --vault /srv/vault [--clone <repo>] [--replicates 3] [--srv /srv] [--sock /srv/m]
 *
 * Writes (all root-only once `setup-sandbox.sh` closes them):
 * - `<o>/seeds/tNN/` (each task's `seed/`), `<o>/specs/tNN.yaml` (each task's `spec.yaml` with a canary comment as its
 *   first line), `<o>/seeds/d1`, `<o>/specs/d1.yaml`, `<o>/edits/d1.ts` (the edit-gate dummy, for the relay checks);
 * - `<o>/input.json`: neutral ids t01…t25, the steps verbatim, the seed tree sha256, the per-task spec path, the plan
 *   parameters (order seed 20261029, replicates, arms `none` and `combined`) and the hard caps;
 * - `<vault>/private-id-map.json` (tNN → task, style, confirmatory), `<vault>/canary.txt`, `<o>/canary.txt`,
 *   `<vault>/sweep-patterns.txt` (the fingerprint patterns, root-only, piped to the sweep).
 * The task order in the input is the study-set order (confirmatory DDD, confirmatory Hexagonal, then any exploratory); the run
 * order comes from the plan's seeded shuffle.
 */
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ARMS, ORDER_SEED, DEFAULT_REPLICATES, buildPlan, capsFor, plannedTurns } from './lib/plan.js';
import { FRAME_COMBINED_SHA256 } from './lib/arms.js';

const arg = (k: string, d?: string): string => { const i = process.argv.indexOf(k); const v = i >= 0 ? process.argv[i + 1] : d; if (v === undefined) throw new Error(`missing ${k}`); return v; };
const O = path.resolve(arg('--o'));
const VAULT = path.resolve(arg('--vault'));
const CLONE = path.resolve(arg('--clone', process.cwd()));
const SRV = path.resolve(arg('--srv', '/srv'));
const R = Number(arg('--replicates', String(DEFAULT_REPLICATES)));
// Unix socket paths are limited to ~104 bytes (macOS) / 108 (Linux): a local run passes a short directory.
const SOCK = path.resolve(arg('--sock', path.join(SRV, 'm')));
const FAM = 'experiments/trap-families';

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
const set = JSON.parse(fs.readFileSync(path.join(FAM, 'study-set.json'), 'utf8')) as { confirmatory: { ddd: string[]; hexagonal: string[] }; exploratory?: { ddd?: string[]; hexagonal?: string[] } };
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
  const dir = path.join(FAM, task);
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
const firstOf = (style: string): string => Object.entries(map).find(([, v]) => v.style === style && v.confirmatory)![0];
const dryTasks = [firstOf('ddd'), firstOf('hexagonal')];

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
const readmeFirst = fs.readFileSync(path.join(FAM, probeTask, 'README.md'), 'utf8').split('\n').find((l) => l.trim() !== '')!.replace(/^#+\s*/, '').trim();
const probePaths = [path.join(CLONE, FAM, probeTask, 'README.md'), path.join(VAULT, 'canary.txt'), path.join(O, 'canary.txt'), tasks[0]!.specPath];
const canaryStrings = Object.values(canaries).flatMap((c) => [`canary-${c}`, c]);
// An id that is part of a probe path is echoed back in the agent's refusal ("cannot read …/<id>/README.md") and is
// no leak; only file contents and the other ids count (the TRAPRATE-01 probe-id fix).
const forbidden = [readmeFirst, ...canaryStrings, ...ids.filter((id) => !probePaths.some((p) => p.includes(id)))];

const plan = buildPlan({ tasks: tasks.map((t) => ({ id: t.id, steps: t.steps.length })), arms: ARMS, replicates: R, orderSeed: ORDER_SEED });
const caps = capsFor(plan, ARMS);
const OUT = path.join(O, 'out');
const input = {
  schema: 'v15-study-input/v1',
  modelId: 'claude-sonnet-5-5', binary: path.join(SRV, 'bin', 'gclaude'), cliBinary: '/opt/claude-code/bin/claude', cliVersionPin: null,
  harnessRoot: path.join(SRV, 'h'), workRoot: path.join(SRV, 'w'), outRoot: OUT, vault: VAULT,
  genUid: 1500, genGid: 1500, genHome: path.join(SRV, 'gh'),
  orderSeed: ORDER_SEED, replicates: R, arms: ARMS, timeoutMs: 1_200_000,
  frameCombinedSha256: FRAME_COMBINED_SHA256,
  plannedSessions: plan.length, plannedTurns: plannedTurns(plan), caps,
  delivery: {
    nodeBinary: process.execPath, gateRelay: path.join(SRV, 'h', 'bin', 'gate-relay.cjs'), mcpRelay: path.join(SRV, 'h', 'bin', 'mcp-relay.cjs'),
    socketDir: SOCK, logDir: path.join(OUT, 'hub'), layers: true,
  },
  tasks,
  dryTasks,
  dummy: { seedDir: path.join(O, 'seeds', 'd1'), specPath: path.join(O, 'specs', 'd1.yaml'), editFile: 'src/billing/application/SettleInvoices.ts', editContent: path.join(O, 'edits', 'd1.ts') },
  probe: { outsideProject: path.join(SRV, 'w') },
  readProbe: { paths: probePaths, forbidden },
  isolation: {
    // §6 item 1: specs, canaries, hub code, hub and MCP logs, the task map, the design note, sealed roots, root's temp.
    denied: [
      tasks[0]!.specPath, path.join(O, 'input.json'), path.join(O, 'canary.txt'), path.join(VAULT, 'canary.txt'), path.join(VAULT, 'private-id-map.json'),
      path.join(O, 'seeds', tasks[0]!.id), path.join(OUT, 'hub'), path.join(OUT, 'sessions'),
      path.join(CLONE, 'src', 'v15-instrument', 'delivery', 'hub.ts'), path.join(CLONE, 'ops', 'notes', 'v15-combined-delivery-design-2026-10-26.md'),
      path.join(CLONE, FAM, 'study-set.json'), path.join(CLONE, 'experiments', 'hcal-03'), path.join(CLONE, 'experiments', 'v15-study', 'run-study.ts'),
      '/root', '/tmp/claude-0', '/tmp/tsx-0',
    ],
    canaries: canaryStrings,
    sweepPatternsFile: path.join(VAULT, 'sweep-patterns.txt'),
  },
};

// Fingerprint patterns (§6 item 2): canaries, the TRAPRATE set, note title, hub header, spec header, task phrases.
const pats = new Set<string>([...forbidden, 'trap-families', 'TRAP-FAMILIES', 'TRAPRATE-01', 'winning line', 'trap line',
  'v1.5 final study: combined delivery', 'v1.5 combined delivery hub', 'Edit-gate dummy project spec', 'v1.5 final study: the run plan']);
for (const t of tasks) for (const s of t.steps.slice(1)) pats.add(s.slice(0, 40));
for (const v of Object.values(map)) pats.add(v.task);
fs.writeFileSync(path.join(VAULT, 'sweep-patterns.txt'), `${[...pats].filter((p) => p.length >= 8).join('\n')}\n`);
fs.writeFileSync(path.join(O, 'input.json'), `${JSON.stringify(input, null, 1)}\n`);
process.stdout.write(`input: ${String(tasks.length)} tasks × ${String(ARMS.length)} arms × ${String(R)} replicates = ${String(plan.length)} sessions, ${String(plannedTurns(plan))} turns planned; caps ${JSON.stringify(caps)}; dry tasks ${dryTasks.join(', ')}\n`);
