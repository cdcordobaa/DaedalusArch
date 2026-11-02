/**
 * R-ADAPTER-RULE (H06, exploratory) on the Hexagonal study's kept trees, zero calls. For every counted session: the
 * rule's identities (file|subject) on the seed (step 0) and on the final step, and those new against the seed, per task
 * and arm. Reads `<root>/sessions/<id>/snap/step-NN` and `<root>/scores/scores.json` of the results branch
 * `results/v15-hx-study` (extracted with `git archive`). Descriptive only: R-ADAPTER-RULE is not counted in that study.
 * Run: npx tsx experiments/h06-adapter-rule-dev/evaluate.ts <root> > <out.json>
 * Same pattern as `experiments/hx-inbyp-dev/evaluate.ts` (branch v157/r-inbyp).
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/graph.js';

const root = process.argv[2];
if (root === undefined) { process.stderr.write('usage: evaluate.ts <hx-study root>\n'); process.exit(2); }
const RULE = 'R-ADAPTER-RULE';
const rules = loadRules().filter((r) => r.id === RULE);
const runs = (JSON.parse(fs.readFileSync(path.join(root, 'scores', 'scores.json'), 'utf8')) as { runs: { session: string; task: string; arm: string; counted: boolean; trapFailed: boolean | null }[] }).runs.filter((r) => r.counted);
const ids = async (tree: string, seed?: string): Promise<{ ids: string[]; evidence: string[] }> => {
  const res = await runTree(tree, rules, seed !== undefined ? { baseline: seed } : {});
  const v = res.findings.filter((f) => f.status === 'violation' && f.rule === RULE);
  return { ids: [...new Set(v.map((f) => `${f.file}|${f.subject}`))].sort(), evidence: v.map((f) => `${f.file}:${f.line} ${f.evidence}`).sort() };
};
const sessions: unknown[] = [];
for (const r of runs) {
  const snap = path.join(root, 'sessions', r.session, 'snap');
  const steps = fs.readdirSync(snap).filter((d) => /^step-\d+$/.test(d)).sort();
  const seed = path.join(snap, steps[0] as string);
  const fin = path.join(snap, steps.at(-1) as string);
  const s = await ids(seed); const f = await ids(fin, seed);
  const newIds = f.ids.filter((x) => !s.ids.includes(x));
  sessions.push({ session: r.session, task: r.task, arm: r.arm, trapFailed: r.trapFailed, seed: s.ids, final: f.ids, new: newIds, finalEvidence: f.evidence });
  process.stderr.write(`${r.session} ${r.task} ${r.arm} seed ${s.ids.length} final ${f.ids.length} new ${newIds.length}\n`);
}
process.stdout.write(`${JSON.stringify({ rule: RULE, sessions }, null, 1)}\n`);
