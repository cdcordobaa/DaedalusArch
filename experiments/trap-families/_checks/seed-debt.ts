import * as fs from 'node:fs'; import * as os from 'node:os'; import * as path from 'node:path';
import { frozenHits } from '../../cal-01/score.js';
(async () => { const s = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-'));
  for (const t of ['f4-ddd-gym-classes', 'f10-ddd-crowdfunding', 'f12-ddd-farmers-market', 'f27-ddd-language-school']) {
    const dir = path.join('experiments/trap-families', t); const spec = path.join(dir, 'spec.yaml'); const r: Record<string, string[]> = {};
    for (const v of ['seed', 'solutions/clean']) { const tree = path.join(s, t, v); fs.cpSync(path.join(dir, v), tree, { recursive: true });
      r[v] = (await frozenHits(tree, spec)).filter((h) => h.rule === 'FF-DS02').map((h) => `${h.file}:${h.line}`).sort(); }
    const extra = r['solutions/clean']!.filter((x) => !r['seed']!.includes(x));
    console.log(t, 'seed', r['seed']!.length, 'clean', r['solutions/clean']!.length, 'clean-only', JSON.stringify(extra));
  } fs.rmSync(s, { recursive: true, force: true }); })();
