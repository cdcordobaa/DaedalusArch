/**
 * H11D-DEV (v1.5.7, exploratory, zero calls): R-MIRROR2 on the Hexagonal study's kept trees, for the before/after gate of
 * the H11-d revision. For every session of `<root>/scores/scores.json`: every R-MIRROR2 finding on the seed (step-00)
 * and on the final step, both scored as the study scored them (the task's spec, the seed as `baseline`). Reads
 * `<root>/sessions/<id>/snap/step-NN` of the results branch `results/v15-hx-study` (extracted with `git archive`).
 * Not part of the registered study. Compare two outputs with `compare-study.ts`.
 * Run: npx tsx experiments/h11d-dev/evaluate-study.ts <root> > <out.json>
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/graph.js';
import { loadStudySet } from '../v15-study/lib/study-set.js';

const root = process.argv[2];
if (root === undefined) { process.stderr.write('usage: evaluate-study.ts <hx-study root>\n'); process.exit(2); }
const RULE = 'R-MIRROR2';
const rules = loadRules().filter((r) => r.id === RULE);
const MANIFEST = 'experiments/hx-study-set/study-set.json';
const set = loadStudySet(process.cwd(), MANIFEST);
// the neutral ids t01..t11 follow the manifest's order (its note)
const order = (JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as { confirmatory: { hexagonal: string[] } }).confirmatory.hexagonal;
const taskOf = (t: string): string => (/^t\d+$/.test(t) ? (order[Number(t.slice(1)) - 1] as string) : t);
const runs = (JSON.parse(fs.readFileSync(path.join(root, 'scores', 'scores.json'), 'utf8')) as { runs: { session: string; task: string; arm: string; counted: boolean }[] }).runs;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'h11d-study-'));
const findings = async (tree: string, spec: string, seed: string): Promise<string[]> => {
  const res = await runTree(tree, rules, { spec, scratch, baseline: path.resolve(seed) });
  return res.findings.filter((f) => f.rule === RULE && f.status === 'violation').map((f) => `${f.file}|${f.subject}|${String(f.line)}|${f.evidence}`).sort();
};
const sessions: unknown[] = [];
for (const r of runs) {
  const snap = path.join(root, 'sessions', r.session, 'snap');
  if (!fs.existsSync(snap)) continue;
  const steps = fs.readdirSync(snap).filter((d) => /^step-\d+$/.test(d)).sort();
  const seed = path.join(snap, steps[0] as string);
  const fin = path.join(snap, steps.at(-1) as string);
  const spec = path.join(set.dirOf(taskOf(r.task)), 'spec.yaml');
  sessions.push({ session: r.session, task: taskOf(r.task), arm: r.arm, counted: r.counted, finalStep: steps.at(-1), seed: await findings(seed, spec, seed), final: await findings(fin, spec, seed) });
  process.stderr.write(`${r.session} `);
}
fs.rmSync(scratch, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({ rule: RULE, modelCalls: 0, sessions }, null, 1)}\n`);
