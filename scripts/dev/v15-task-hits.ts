/** Development aid (zero calls): which of the given rules fire on each trap-family task's trap and clean solution. */
import * as fs from 'node:fs'; import * as os from 'node:os'; import * as path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';
const [tasks, ids] = [process.argv[2]!.split(','), process.argv[3]!.split(',')];
void (async () => {
  const rules = loadRules(); const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'th-'));
  for (const t of tasks) {
    const dir = path.join('experiments/trap-families', t); const spec = path.join(dir, 'spec.yaml');
    const row: string[] = [];
    for (const v of ['trap', 'clean']) {
      const tree = path.join(scratch, t, v); fs.cpSync(path.join(dir, 'solutions', v), tree, { recursive: true });
      const r = await runTree(tree, rules, { spec, scratch: path.join(scratch, '_s') });
      const h = r.findings.filter((f) => f.status === 'violation' && ids.includes(f.rule)).map((f) => `${f.rule}@${f.file.split('/').pop()}:${String(f.line)}`);
      row.push(`${v}[${h.join(' ')}]`);
    }
    process.stdout.write(`${t} ${row.join(' ')}\n`);
  }
  fs.rmSync(scratch, { recursive: true, force: true });
})();
