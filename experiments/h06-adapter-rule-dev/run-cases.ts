/**
 * R-ADAPTER-RULE (H06) on every H06 case of the calibration sets HCAL-01 to HCAL-04 (development data now; each set was
 * scored once before). A case is its domain's base with the case folder overlaid, and the base is the baseline, as the
 * admission scorer runs it. Zero model calls, no Neo4j.
 * Run: npx tsx experiments/h06-adapter-rule-dev/run-cases.ts [scratch] > experiments/h06-adapter-rule-dev/cases.json
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/graph.js';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const scratch = fs.mkdtempSync(path.join(process.argv[2] ?? os.tmpdir(), 'h06-'));
const rules = loadRules().filter((r) => r.id === 'R-ADAPTER-RULE');
const SETS = ['hcal-01', 'hcal-02', 'hcal-03', 'hcal-04'];
const out: unknown[] = [];
for (const set of SETS) {
  const sd = path.join(REPO, 'experiments', set);
  for (const dom of fs.readdirSync(sd).filter((d) => fs.existsSync(path.join(sd, d, 'labels.json'))).sort()) {
    const dd = path.join(sd, dom);
    const labels = JSON.parse(fs.readFileSync(path.join(dd, 'labels.json'), 'utf8')) as Record<string, { rule: string; label: string; file: string | null }>;
    for (const c of ['base', ...Object.keys(labels).filter((k) => labels[k]!.rule === 'H06').sort()]) {
      const tree = path.join(scratch, set, dom, c);
      fs.cpSync(path.join(dd, 'base'), tree, { recursive: true });
      if (c !== 'base') fs.cpSync(path.join(dd, 'cases', c), tree, { recursive: true });
      const r = await runTree(tree, rules, { spec: path.join(tree, 'spec.yaml'), scratch: path.join(scratch, '_s'), withApg: false, ...(c !== 'base' ? { baseline: path.join(dd, 'base') } : {}) });
      const hits = r.findings.filter((f) => f.status === 'violation' && f.rule === 'R-ADAPTER-RULE').map((f) => `${f.file}:${f.line} ${f.evidence}`);
      const lab = c === 'base' ? { label: 'clean', file: null } : labels[c]!;
      const ok = lab.label === 'violation' ? hits.some((h) => h.startsWith(`${lab.file}:`)) : hits.length === 0;
      out.push({ set, domain: dom, case: c, label: lab.label, file: lab.file, ok, hits });
      process.stderr.write(`${ok ? 'ok  ' : 'MISS'} ${set}/${dom}/${c} ${lab.label} ${hits.length}\n`);
    }
  }
}
fs.rmSync(scratch, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
