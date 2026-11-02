/**
 * v1.5.7 R-D5S development run (2026-11-02). Zero model calls (no judge is passed; R-MIRROR-SEM stays silent).
 * Runs the v1.5 rules on committed, already-scored cases and writes every v1.5 violation per case, so a before/after
 * pair can be diffed for R-D5S and for every other rule:
 *   - `experiments/d5-unseen` (C1 S2 cases; scored as its own `score.ts` does: no baseline, R-D5S in the labelled file);
 *   - `experiments/cal-01`, `cal-02`, `cal-03` (base + case overlay, the base as baseline, as `experiments/cal-01/score.ts`).
 * It never writes a set's own `result.json`.
 *
 *   npx tsx experiments/r-d5s-dev/run.ts --out experiments/r-d5s-dev/results/after.json [--sets d5-unseen,cal-03]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';

const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const OUT = argOf('--out') ?? path.join('experiments', 'r-d5s-dev', 'results', 'run.json');
const SETS = (argOf('--sets') ?? 'd5-unseen,cal-01,cal-02,cal-03').split(',');
interface Hit { rule: string; file: string; line: number | null; evidence?: string }
interface Row { set: string; domain: string; case: string; row: string | null; label: string; file: string | null; hits: Hit[] }

async function main(): Promise<void> {
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rd5s-dev-'));
  const rows: Row[] = [];
  const hitsOf = (r: Awaited<ReturnType<typeof runTree>>): Hit[] => r.findings.filter((f) => f.status === 'violation')
    .map((f) => ({ rule: f.rule, file: f.file, line: f.line, ...(f.rule === 'R-D5S' ? { evidence: f.evidence } : {}) }));
  for (const set of SETS) {
    const dir = path.join('experiments', set, set === 'd5-unseen' ? 'cases' : '');
    for (const domain of fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'labels.json'))).sort()) {
      const dd = path.join(dir, domain);
      const labels = JSON.parse(fs.readFileSync(path.join(dd, 'labels.json'), 'utf8')) as Record<string, { rule?: string; label: string; file: string | null }>;
      if (set === 'd5-unseen') {
        for (const [c, l] of Object.entries(labels).sort()) {
          const r = await runTree(path.join(dd, c), rules, { spec: path.join(dd, 'spec.yaml'), scratch: path.join(scratch, '_s') });
          rows.push({ set, domain, case: c, row: 'K10', label: l.label, file: l.file, hits: hitsOf(r) });
        }
        continue;
      }
      const cases: [string, { rule?: string; label: string; file: string | null } | null][] = [['base', null], ...Object.entries(labels).sort()];
      for (const [c, l] of cases) {
        const tree = path.join(scratch, set, domain, c);
        fs.cpSync(path.join(dd, 'base'), tree, { recursive: true });
        if (c !== 'base') fs.cpSync(path.join(dd, 'cases', c), tree, { recursive: true });
        const spec = fs.existsSync(path.join(tree, 'spec.yaml')) ? path.join(tree, 'spec.yaml') : path.join(dd, 'base', 'spec.yaml');
        const r = await runTree(tree, rules, { spec, scratch: path.join(scratch, '_s'), ...(c !== 'base' ? { baseline: path.join(dd, 'base') } : {}) });
        rows.push({ set, domain, case: c, row: l?.rule ?? null, label: l?.label ?? 'clean', file: l?.file ?? null, hits: hitsOf(r) });
      }
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  // R-D5S per set: recall on K10 positives (R-D5S in the labelled file); FP on K10 clean cases; and every clean case of
  // any row where R-D5S fires.
  const summary: Record<string, unknown> = {};
  const d5s = (x: Row): Hit[] => x.hits.filter((h) => h.rule === 'R-D5S');
  for (const set of SETS) {
    const rs = rows.filter((x) => x.set === set);
    const pos = rs.filter((x) => x.row === 'K10' && x.label === 'violation');
    const k10neg = rs.filter((x) => x.row === 'K10' && x.label === 'clean');
    const allNeg = rs.filter((x) => x.label === 'clean');
    summary[set] = {
      k10Recall: `${String(pos.filter((x) => d5s(x).some((h) => x.file === null || h.file === x.file || h.file.endsWith(x.file))).length)}/${String(pos.length)}`,
      k10Fp: `${String(k10neg.filter((x) => d5s(x).length > 0).length)}/${String(k10neg.length)}`,
      anyCleanFp: `${String(allNeg.filter((x) => d5s(x).length > 0).length)}/${String(allNeg.length)}`,
      firesOnOtherRowPositives: rs.filter((x) => x.row !== 'K10' && x.label === 'violation' && d5s(x).length > 0).map((x) => `${x.domain}/${x.case}`),
      cleanCasesFlagged: allNeg.filter((x) => d5s(x).length > 0).map((x) => `${x.domain}/${x.case}`),
      k10Missed: pos.filter((x) => !d5s(x).some((h) => x.file === null || h.file === x.file || h.file.endsWith(x.file))).map((x) => `${x.domain}/${x.case}`),
    };
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ modelCalls: 0, summary, rows }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
void main();
