/**
 * V158-DEV (v1.5.8 fact work, exploratory, zero model calls, no Neo4j): every v1.5 rule's violations on the development
 * trees, so a before/after pair can be diffed per rule (`compare.ts`). Development data only, never admission evidence.
 *
 * Groups:
 *   - `hx`: the Hexagonal study's kept trees (`<hx root>/sessions/<id>/snap/step-NN` and `<hx root>/scores/scores.json`
 *     of the results branch `results/v15-hx-study`, extracted with `git archive`). Each task's seed (step-00) once, and
 *     the final step of every session, scored as the study scored them (the task's spec, the seed as `baseline`).
 *   - `dev`: the case sets already used by `experiments/h06-adapter-rule-dev` (HCAL-01..04), `experiments/h11d-dev`
 *     (h11d-dev, hx-rules-v3-dev, HCAL-06) and `experiments/r-d5s-dev` (d5-unseen, CAL-01..03). Every labelled case of
 *     those domains, the base included: a case is its base with the case folder overlaid, the base as `baseline`, as
 *     the admission scorers run it (d5-unseen: each case tree as it is, no baseline). HCAL-07 is not read.
 *
 * Run: npx tsx experiments/v158-dev/evaluate.ts --out <file.json> [--hx <hx root>] [--groups hx,dev]
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/graph.js';
import { INSTRUMENT_ID } from '../../src/v15-instrument/rule-set.js';
import { loadStudySet } from '../v15-study/lib/study-set.js';

const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const OUT = argOf('--out');
const HX = argOf('--hx');
const GROUPS = (argOf('--groups') ?? 'hx,dev').split(',');
if (OUT === undefined) { process.stderr.write('usage: evaluate.ts --out <file> [--hx <root>] [--groups hx,dev]\n'); process.exit(2); }

const rules = loadRules();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v158-dev-'));
interface Row { group: string; set: string; domain: string; case: string; arm: string | null; label: string; labelRule: string | null; labelFile: string | null; findings: string[] }
const rows: Row[] = [];
const run = async (tree: string, spec: string | undefined, baseline: string | undefined): Promise<string[]> => {
  const r = await runTree(tree, rules, { ...(spec !== undefined ? { spec } : {}), scratch: path.join(scratch, '_s'), ...(baseline !== undefined ? { baseline } : {}) });
  return r.findings.filter((f) => f.status === 'violation').map((f) => `${f.rule}|${f.file}|${f.subject}|${f.evidence}`).sort();
};
const treeHash = (dir: string): string => {
  const h = createHash('sha256');
  const walk = (d: string, rel: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name); const r = `${rel}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, r); } else { h.update(r); h.update(fs.readFileSync(p)); }
    }
  };
  walk(dir, '');
  return h.digest('hex');
};

async function hx(root: string): Promise<void> {
  const MANIFEST = 'experiments/hx-study-set/study-set.json';
  const set = loadStudySet(process.cwd(), MANIFEST);
  const order = (JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { confirmatory: { hexagonal: string[] } }).confirmatory.hexagonal;
  const taskOf = (t: string): string => (/^t\d+$/.test(t) ? (order[Number(t.slice(1)) - 1] as string) : t);
  const runs = (JSON.parse(fs.readFileSync(path.join(root, 'scores', 'scores.json'), 'utf8')) as { runs: { session: string; task: string; arm: string; counted: boolean }[] }).runs.filter((r) => r.counted);
  const seeds = new Map<string, string>(); // task -> seed hash (every session of a task must start from the same seed)
  for (const r of runs) {
    const snap = path.join(root, 'sessions', r.session, 'snap');
    const steps = fs.readdirSync(snap).filter((d) => /^step-\d+$/.test(d)).sort();
    const seed = path.join(snap, steps[0] as string);
    const fin = path.join(snap, steps.at(-1) as string);
    const task = taskOf(r.task);
    const spec = path.join(set.dirOf(task), 'spec.yaml');
    const h = treeHash(seed);
    if (!seeds.has(task)) {
      seeds.set(task, h);
      rows.push({ group: 'hx', set: 'hx-study', domain: task, case: 'seed', arm: 'seed', label: 'seed', labelRule: null, labelFile: null, findings: await run(seed, spec, path.resolve(seed)) });
    } else if (seeds.get(task) !== h) throw new Error(`${r.session}: seed differs from the task's first seed`);
    rows.push({ group: 'hx', set: 'hx-study', domain: task, case: r.session, arm: r.arm, label: 'final', labelRule: null, labelFile: null, findings: await run(fin, spec, path.resolve(seed)) });
    process.stderr.write('.');
  }
  process.stderr.write('\n');
}

interface Label { rule?: string; label: string; file: string | null }
async function overlaySet(set: string, setDir: string, baseDir: (domain: string) => string, domains?: string[]): Promise<void> {
  const ds = domains ?? fs.readdirSync(setDir).filter((d) => fs.existsSync(path.join(setDir, d, 'labels.json'))).sort();
  for (const domain of ds) {
    const dd = path.join(setDir, domain);
    const base = baseDir(domain);
    const labels = JSON.parse(fs.readFileSync(path.join(dd, 'labels.json'), 'utf8')) as Record<string, Label>;
    const cases: [string, Label | null][] = [...(base === path.join(dd, 'base') ? [['base', null] as [string, null]] : []), ...Object.entries(labels).sort()];
    for (const [c, l] of cases) {
      if (c !== 'base' && !fs.existsSync(path.join(dd, 'cases', c))) continue;
      const tree = path.join(scratch, set, domain, c);
      fs.cpSync(base, tree, { recursive: true });
      if (c !== 'base') fs.cpSync(path.join(dd, 'cases', c), tree, { recursive: true });
      const spec = fs.existsSync(path.join(tree, 'spec.yaml')) ? path.join(tree, 'spec.yaml') : path.join(base, 'spec.yaml');
      rows.push({ group: 'dev', set, domain, case: c, arm: null, label: l?.label ?? 'clean', labelRule: l?.rule ?? null, labelFile: l?.file ?? null, findings: await run(tree, spec, c !== 'base' ? path.resolve(base) : undefined) });
      process.stderr.write('.');
    }
  }
}

async function dev(): Promise<void> {
  for (const s of ['hcal-01', 'hcal-02', 'hcal-03', 'hcal-04', 'hcal-06', 'cal-01', 'cal-02', 'cal-03']) {
    const sd = path.join('experiments', s);
    await overlaySet(s, sd, (d) => path.join(sd, d, 'base'));
  }
  await overlaySet('hx-rules-v3-dev', 'experiments/hx-rules-v3-dev', (d) => path.join('experiments/hx-rules-v3-dev', d, 'base'), ['freight-booking', 'parcel-lockers']);
  await overlaySet('h11d-dev', 'experiments/h11d-dev', (d) => path.join('experiments/hx-rules-v3-dev', d, 'base'), ['freight-booking', 'parcel-lockers']);
  const du = 'experiments/d5-unseen/cases';
  for (const domain of fs.readdirSync(du).filter((d) => fs.existsSync(path.join(du, d, 'labels.json'))).sort()) {
    const dd = path.join(du, domain);
    const labels = JSON.parse(fs.readFileSync(path.join(dd, 'labels.json'), 'utf8')) as Record<string, Label>;
    for (const [c, l] of Object.entries(labels).sort()) {
      rows.push({ group: 'dev', set: 'd5-unseen', domain, case: c, arm: null, label: l.label, labelRule: l.rule ?? 'K10', labelFile: l.file, findings: await run(path.join(dd, c), path.join(dd, 'spec.yaml'), undefined) });
      process.stderr.write('.');
    }
  }
  process.stderr.write('\n');
}

if (GROUPS.includes('hx')) { if (HX === undefined) throw new Error('--hx <root> is required for the hx group'); await hx(HX); }
if (GROUPS.includes('dev')) await dev();
fs.rmSync(scratch, { recursive: true, force: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({ instrument: INSTRUMENT_ID, modelCalls: 0, rows }, null, 1)}\n`);
process.stderr.write(`${String(rows.length)} rows -> ${OUT}\n`);
