/**
 * Development aid (zero calls): run the v1.5 rules on one overlay case and print every finding.
 *   npx tsx scripts/dev/v15-case.ts experiments/cal-02/maintenance K10-pos2 [K12-pos1 ...]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';

async function main(): Promise<void> {
  const [dir, ...cases] = process.argv.slice(2);
  if (dir === undefined) throw new Error('usage: v15-case.ts <domain dir> <case...>');
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15case-'));
  for (const c of cases.length > 0 ? cases : ['base']) {
    const tree = path.join(scratch, c);
    fs.cpSync(path.join(dir, 'base'), tree, { recursive: true });
    if (c !== 'base') fs.cpSync(path.join(dir, 'cases', c), tree, { recursive: true });
    const spec = path.join(tree, 'spec.yaml');
    const r = await runTree(tree, rules, { spec, scratch: path.join(scratch, '_s') });
    process.stdout.write(`== ${c}\n`);
    for (const f of r.findings.filter((x) => x.status === 'violation')) process.stdout.write(`  ${f.rule} ${f.file}:${String(f.line)} ${f.evidence.slice(0, 160)}\n`);
  }
  fs.rmSync(scratch, { recursive: true, force: true });
}
void main();
