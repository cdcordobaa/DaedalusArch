/**
 * R-INBYP (v1.5.7, exploratory) on the Hexagonal study's kept trees, zero calls. For every counted session: the rule's
 * identities on the seed (step 0) and on the final step, and those new against the seed, per task and arm. R-AXA is run
 * beside it for comparison. Reads `<root>/sessions/<id>/snap/step-NN` and `<root>/scores/scores.json` of the results
 * branch `results/v15-hx-study` (extracted with `git archive`). Not part of the registered study.
 * Run: npx tsx experiments/hx-inbyp-dev/evaluate.ts <root> > experiments/hx-inbyp-dev/result.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/graph.js';

const root = process.argv[2];
if (root === undefined) { process.stderr.write('usage: evaluate.ts <hx-study root>\n'); process.exit(2); }
const RULES = ['R-INBYP', 'R-AXA'];
const rules = loadRules().filter((r) => RULES.includes(r.id));
const runs = (JSON.parse(fs.readFileSync(path.join(root, 'scores', 'scores.json'), 'utf8')) as { runs: { session: string; task: string; arm: string; counted: boolean; trapFailed: boolean | null }[] }).runs.filter((r) => r.counted);
const ids = async (tree: string, seed?: string): Promise<Record<string, string[]>> => {
  const res = await runTree(tree, rules, seed !== undefined ? { baseline: seed } : {});
  const out: Record<string, string[]> = Object.fromEntries(RULES.map((r) => [r, [] as string[]]));
  for (const f of res.findings) if (f.status === 'violation') out[f.rule]?.push(`${f.file}|${f.subject}`);
  for (const r of RULES) out[r] = [...new Set(out[r])].sort();
  return out;
};
const sessions: unknown[] = [];
for (const r of runs) {
  const snap = path.join(root, 'sessions', r.session, 'snap');
  const steps = fs.readdirSync(snap).filter((d) => /^step-\d+$/.test(d)).sort();
  const seed = path.join(snap, steps[0] as string);
  const fin = path.join(snap, steps.at(-1) as string);
  const s = await ids(seed); const f = await ids(fin, seed);
  const newIds = Object.fromEntries(RULES.map((k) => [k, (f[k] ?? []).filter((x) => !(s[k] ?? []).includes(x))]));
  sessions.push({ session: r.session, task: r.task, arm: r.arm, trapFailed: r.trapFailed, seed: s, final: f, new: newIds });
  process.stderr.write(`${r.session} ${r.task} ${r.arm} new R-INBYP ${newIds['R-INBYP']?.length} R-AXA ${newIds['R-AXA']?.length}\n`);
}
process.stdout.write(`${JSON.stringify({ rules: RULES, sessions }, null, 1)}\n`);
