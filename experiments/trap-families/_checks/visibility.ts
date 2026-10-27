/**
 * Instrument visibility of each study task (zero calls): do the ADMITTED confirmatory rules fire on the trap
 * solution and stay silent on the clean solution? DDD admitted (CAL-02): FF-DS02 R-D4 R-XCTX R-RTX R-D9 R-INJ R-REF.
 * Hexagonal admitted (HCAL-02): FF-S01 FF-S04 FF-P01 FF-P02 R-INJ R-H5. Frozen FF-* rules via check_diff.
 */
import * as fs from 'node:fs'; import * as os from 'node:os'; import * as path from 'node:path';
import { frozenHits } from '../../cal-01/score.js';
import { loadRules, runTree } from '../../../src/v15-instrument/index.js';
const ADMITTED: Record<string, string[]> = {
  ddd: ['FF-DS02', 'R-D4', 'R-XCTX', 'R-RTX', 'R-D9', 'R-INJ', 'R-REF'],
  hexagonal: ['FF-S01', 'FF-S04', 'FF-P01', 'FF-P02', 'R-INJ', 'R-H5'],
};
const STUDY = (process.argv[2] ?? '').split(',').filter(Boolean);
(async () => {
  const rules = loadRules(); const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vis-')); const out: Record<string, unknown>[] = [];
  for (const t of STUDY) {
    const dir = path.join('experiments/trap-families', t); const spec = path.join(dir, 'spec.yaml');
    const style = (JSON.parse(fs.readFileSync(path.join(dir, 'puzzle.json'), 'utf8')) as { style: string }).style;
    const ids = ADMITTED[style] ?? [];
    const hits = async (variant: string): Promise<string[]> => {
      const tree = path.join(scratch, t, variant); fs.cpSync(path.join(dir, 'solutions', variant), tree, { recursive: true });
      const r = await runTree(tree, rules, { spec, scratch: path.join(scratch, '_s') });
      let fz: { rule: string; file: string }[] = []; try { fz = await frozenHits(tree, spec); } catch { /* reported below */ }
      return [...r.findings.filter((f) => f.status === 'violation').map((f) => f.rule), ...fz.map((f) => f.rule)].filter((x) => ids.includes(x));
    };
    const trap = await hits('trap'); const clean = await hits('clean');
    out.push({ task: t, style, trapVisible: trap.length > 0, cleanSilent: clean.length === 0, trap: [...new Set(trap)], clean: [...new Set(clean)] });
    process.stdout.write(`${t} ${style} trap:${trap.length > 0 ? 'SEEN' : 'unseen'}[${[...new Set(trap)].join(',')}] clean:${clean.length === 0 ? 'silent' : 'FLAGGED[' + [...new Set(clean)].join(',') + ']'}\n`);
  }
  fs.writeFileSync('experiments/trap-families/_checks/visibility-2026-10-27.json', `${JSON.stringify(out, null, 1)}\n`);
  fs.rmSync(scratch, { recursive: true, force: true });
})();
