import * as fs from 'node:fs'; import * as os from 'node:os'; import * as path from 'node:path';
import { frozenHits } from './cal-01/score.js';
import { loadRules, runTree } from '../src/v15-instrument/index.js';
(async () => { const rules = loadRules(); const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'h2b-'));
  for (const d of ['recruitment', 'meters']) {
    const src = path.join('experiments/hcal-02', d, 'base'); const tmp = path.join(scratch, d); fs.cpSync(src, tmp, { recursive: true });
    const r = await runTree(tmp, rules, { spec: path.join(tmp, 'spec.yaml'), scratch: path.join(scratch, '_s') });
    let fz = ''; try { fz = (await frozenHits(tmp, path.join(tmp, 'spec.yaml'))).map((x) => `${x.rule} ${x.file}:${x.line}`).join(' | ') || 'clean'; } catch (e) { fz = 'ERROR ' + String(e).slice(0, 200); }
    console.log(d, 'v15:', r.findings.filter((f) => f.status === 'violation').map((f) => `${f.rule} ${f.file}:${f.line}`).join(' | ') || 'clean', '| frozen:', fz);
  } fs.rmSync(scratch, { recursive: true, force: true }); })();
