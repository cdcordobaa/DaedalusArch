/**
 * TRAPRATE-01 (zero calls): build the driver input for `experiments/puzzle-01-baseline/run-baseline.ts` from the
 * study task set, in the sandbox layout of `experiments/puzzle-01-baseline/isolation.md`.
 *
 *   npx tsx experiments/traprate-01/make-input.ts --o /srv/o --vault /srv/vault [--clone /home/user/DaedalusArch]
 *
 * Writes `<o>/seeds/tNN/` (each task's `seed/`), `<o>/input.json` (neutral ids t01…t25, the steps verbatim, the
 * seed tree sha256), `<vault>/private-id-map.json`, `<vault>/canary.txt` and `<o>/canary.txt`. The task order in the
 * input is the study set's order (confirmatory DDD, confirmatory Hexagonal, then f19); the run order comes from the
 * driver's seeded shuffle.
 */
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const arg = (k: string, d?: string): string => { const i = process.argv.indexOf(k); const v = i >= 0 ? process.argv[i + 1] : d; if (v === undefined) throw new Error(`missing ${k}`); return v; };
const O = arg('--o'); const VAULT = arg('--vault'); const CLONE = arg('--clone', '/home/user/DaedalusArch');
const FAM = 'experiments/trap-families';

const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');
// the driver's `filesOf` (top-level node_modules skipped, regular files only, default sort)
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
// the driver's `treeSha`: sha256 of the sorted `path<TAB>sha256` lines
const treeSha = (dir: string): string => sha256(`${filesOf(dir).map((f) => `${f}\t${sha256(fs.readFileSync(path.join(dir, f)))}`).join('\n')}\n`);

const set = JSON.parse(fs.readFileSync(path.join(FAM, 'study-set.json'), 'utf8')) as { confirmatory: { ddd: string[]; hexagonal: string[] } };
const ids = [...set.confirmatory.ddd, ...set.confirmatory.hexagonal, 'f19-hex-school-canteen'];
if (ids.length !== 25) throw new Error(`expected 25 tasks, got ${String(ids.length)}`);

const tasks: { id: string; seedDir: string; seedTreeSha256: string; steps: string[] }[] = [];
const map: Record<string, { task: string; style: string }> = {};
const forbidden: string[] = [];
for (const [i, task] of ids.entries()) {
  const tid = `t${String(i + 1).padStart(2, '0')}`;
  const dir = path.join(FAM, task);
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'tasks.json'), 'utf8')) as { tasks: { steps: { request: string }[] }[] };
  const steps = doc.tasks[0]!.steps.map((s) => s.request);
  const seedDir = path.join(O, 'seeds', tid);
  fs.cpSync(path.join(dir, 'seed'), seedDir, { recursive: true });
  tasks.push({ id: tid, seedDir, seedTreeSha256: treeSha(seedDir), steps });
  map[tid] = { task, style: (JSON.parse(fs.readFileSync(path.join(dir, 'puzzle.json'), 'utf8')) as { style: string }).style };
  forbidden.push(task);
}
// READ probe: the first task's README at its former path and the two canaries (PUZZLE-01 isolation check 3)
const probeTask = ids[0]!;
const readmeFirst = fs.readFileSync(path.join(FAM, probeTask, 'README.md'), 'utf8').split('\n').find((l) => l.trim() !== '')!.replace(/^#+\s*/, '').trim();
const canaries = [randomBytes(16).toString('hex'), randomBytes(16).toString('hex')];
fs.mkdirSync(VAULT, { recursive: true });
fs.writeFileSync(path.join(VAULT, 'canary.txt'), `canary-${canaries[0]!}\n`);
fs.writeFileSync(path.join(O, 'canary.txt'), `canary-${canaries[1]!}\n`);
fs.writeFileSync(path.join(VAULT, 'private-id-map.json'), `${JSON.stringify(map, null, 1)}\n`);

const probePaths = [path.join(CLONE, FAM, probeTask, 'README.md'), path.join(VAULT, 'canary.txt'), path.join(O, 'canary.txt')];
const input = {
  modelId: 'claude-sonnet-5-5', binary: '/srv/bin/gclaude', harnessRoot: '/srv/h', workRoot: '/srv/w', outRoot: path.join(O, 'out'),
  genUid: 1500, genGid: 1500, genHome: '/srv/gh', orderSeed: 20261027, runs: 2, redrawMax: 3, timeoutMs: 1_200_000,
  caps: { smoke: 1, probes: 1, baseline: 159, total: 161 },
  tasks,
  readProbe: {
    paths: probePaths,
    // An id that is part of a probe path is echoed back in the agent's refusal ("cannot read …/<id>/README.md") and
    // is no leak; only the file contents and the other ids count.
    forbidden: [readmeFirst, ...canaries.map((c) => `canary-${c}`), ...canaries, ...forbidden.filter((id) => !probePaths.some((p) => p.includes(id)))],
  },
  confinementProbes: [],
};
fs.writeFileSync(path.join(O, 'input.json'), `${JSON.stringify(input, null, 1)}\n`);
process.stdout.write(`input: ${String(tasks.length)} tasks, ${String(tasks.reduce((s, t) => s + t.steps.length, 0) * input.runs)} turns planned; caps ${JSON.stringify(input.caps)}\n`);
