/**
 * R-MIRROR2 (row H11 v2, exploratory) development table, zero model calls. Development data only (the trap-family
 * Hexagonal tasks and the already-scored HCAL-04/05 H11 cases); not admission evidence.
 *
 * Per Hexagonal trap-family task: R-MIRROR2 findings on the seed, the clean solution, the trap solution and each gaming
 * fixture, with no baseline (the strict setting the tool runs in) and with the task's seed as baseline.
 *
 *   npx tsx experiments/r-mirror2-dev/dev-table.ts [--out experiments/r-mirror2-dev/dev-table.json] [--verbose]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';

const TF = 'experiments/trap-families';
const RULE = 'R-MIRROR2';
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const VERBOSE = process.argv.includes('--verbose');

async function main(): Promise<void> {
  const rules = loadRules().filter((r) => r.id === RULE);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror2-dev-'));
  const rows: Record<string, unknown>[] = [];
  const run = async (tree: string, spec: string, baseline?: string): Promise<{ n: number; items: string[] }> => {
    const r = await runTree(tree, rules, { spec, withApg: false, scratch, ...(baseline !== undefined ? { baseline } : {}) });
    const f = r.findings.filter((x) => x.rule === RULE && x.status === 'violation');
    return { n: f.length, items: f.map((x) => x.evidence) };
  };
  for (const task of fs.readdirSync(TF).filter((d) => /^f\d+-hex-/.test(d)).sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))) {
    const spec = path.join(TF, task, 'spec.yaml');
    const vocabulary = fs.existsSync(path.join(TF, task, 'vendor')) || fs.readdirSync(path.join(TF, task, 'seed', 'src')).includes('types');
    const trees: [string, string][] = [['seed', path.join(TF, task, 'seed')]];
    for (const k of ['solutions', 'gaming']) { const d = path.join(TF, task, k); if (fs.existsSync(d)) for (const s of fs.readdirSync(d).sort()) trees.push([`${k}/${s}`, path.join(d, s)]); }
    for (const [name, tree] of trees) {
      const strict = await run(tree, spec);
      const withSeed = name === 'seed' ? strict : await run(tree, spec, path.join(TF, task, 'seed'));
      // the target: every seed and clean solution silent; every trap and gaming tree of a vocabulary task fires; the
      // other tasks' trap and gaming trees (another trap family) are reported only
      const expect = name === 'seed' || name === 'solutions/clean' ? 'clean' : vocabulary ? 'violation' : 'report';
      rows.push({ task, tree: name, vocabulary, expect, findings: strict.n, findingsWithSeedBaseline: withSeed.n, pass: expect === 'clean' ? strict.n === 0 : expect === 'violation' ? strict.n > 0 : true, evidence: strict.items });
      process.stdout.write(`${task.padEnd(26)} ${name.padEnd(32)} expect ${expect.padEnd(9)} findings ${String(strict.n).padStart(3)} (seed baseline ${String(withSeed.n).padStart(3)})${VERBOSE ? `\n${strict.items.map((e) => `      ${e}`).join('\n')}` : ''}\n`);
    }
  }
  // HCAL-04 and HCAL-05 H11 cases (already scored; development evidence for H11 since CN-05 / this revision)
  for (const set of ['hcal-04', 'hcal-05']) {
    const dir = path.join('experiments', set);
    for (const domain of fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'labels.json'))).sort()) {
      const labels = JSON.parse(fs.readFileSync(path.join(dir, domain, 'labels.json'), 'utf8')) as Record<string, { rule: string; label: string; file: string | null }>;
      const cases: [string, { rule: string; label: string; file: string | null } | null][] = [['base', null], ...Object.entries(labels).filter(([, l]) => l.rule === 'H11').sort()];
      for (const [c, lab] of cases) {
        const tree = path.join(scratch, set, domain, c);
        fs.cpSync(path.join(dir, domain, 'base'), tree, { recursive: true });
        if (c !== 'base') fs.cpSync(path.join(dir, domain, 'cases', c), tree, { recursive: true });
        const r = await run(tree, path.join(tree, 'spec.yaml'));
        const expect = lab?.label ?? 'clean';
        const inFile = lab?.file === null || lab === null ? true : r.items.some((e) => e.includes(lab.file!));
        const pass = expect === 'clean' ? r.n === 0 : r.n > 0 && inFile;
        rows.push({ set, domain, case: c, expect, findings: r.n, pass, evidence: r.items });
        process.stdout.write(`${`${set}/${domain}`.padEnd(26)} ${c.padEnd(32)} expect ${expect.padEnd(9)} findings ${String(r.n).padStart(3)} ${pass ? 'pass' : 'FAIL'}${VERBOSE ? `\n${r.items.map((e) => `      ${e}`).join('\n')}` : ''}\n`);
      }
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const out = argOf('--out');
  if (out !== undefined) fs.writeFileSync(out, `${JSON.stringify({ modelCalls: 0, rule: RULE, rows }, null, 2)}\n`);
  process.stdout.write(`pass ${String(rows.filter((r) => r.pass).length)}/${String(rows.length)}\n`);
}
void main();
