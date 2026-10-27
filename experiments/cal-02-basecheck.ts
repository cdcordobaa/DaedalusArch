import * as fs from 'node:fs'; import * as path from 'node:path';
import { frozenHits } from './cal-01/score.js';
(async () => {
  for (const d of ['claims', 'maintenance']) {
    const src = path.join('experiments/cal-02', d, 'base'); const tmp = path.join('/tmp/claude-501/c2b', d);
    fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(src, tmp, { recursive: true });
    try { const h = await frozenHits(tmp, path.join(tmp, 'spec.yaml')); console.log(d, 'frozen:', h.map((x) => `${x.rule} ${x.file}:${x.line}`).join(' | ') || 'clean'); }
    catch (e) { console.log(d, 'frozen ERROR', String(e).slice(0, 300)); }
  }
})();
