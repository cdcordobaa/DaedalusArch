/**
 * H11D-DEV (v1.5.7, exploratory, zero calls): R-MIRROR2 on the H11 development cases, per case, with the shape words it
 * reports. Development data only, never admission evidence: the new H11-c/H11-d fixtures of this folder (overlaid on
 * the `experiments/hx-rules-v3-dev/` bases), the HX-RULES-V3 H11 cases, and the already-scored HCAL-06 H11 cases (its
 * H11-SEM cases are another rule's). HCAL-07 is not read. A case is its base with the case folder overlaid, scored with
 * the base's spec and the base as `baseline`, as the admission scorer runs it.
 * Run: npx tsx experiments/h11d-dev/dev-cases.ts > <out.json>
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/graph.js';

const RULE = 'R-MIRROR2';
const rules = loadRules().filter((r) => r.id === RULE);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'h11d-dev-'));
interface Label { label: string; file: string | null; subshape: string | null; kind: string }
const SOURCES: { set: string; casesRoot: string; baseRoot: string; domains: string[] }[] = [
  { set: 'h11d-dev', casesRoot: 'experiments/h11d-dev', baseRoot: 'experiments/hx-rules-v3-dev', domains: ['freight-booking', 'parcel-lockers'] },
  { set: 'hx-rules-v3-dev', casesRoot: 'experiments/hx-rules-v3-dev', baseRoot: 'experiments/hx-rules-v3-dev', domains: ['freight-booking', 'parcel-lockers'] },
  { set: 'hcal-06', casesRoot: 'experiments/hcal-06', baseRoot: 'experiments/hcal-06', domains: ['customs-brokerage', 'pharmacy-refills', 'print-shop'] },
];
const shapeOf = (e: string): string => /^\[([a-z-]+)\]/.exec(e)?.[1] ?? '?';
const rows: unknown[] = [];
for (const s of SOURCES) {
  for (const d of s.domains) {
    const base = path.join(s.baseRoot, d, 'base');
    const labels = JSON.parse(fs.readFileSync(path.join(s.casesRoot, d, 'labels.json'), 'utf8')) as Record<string, Label>;
    for (const [id, l] of [['(base)', { label: 'clean', file: null, subshape: null, kind: 'base' }] as [string, Label], ...Object.entries(labels).filter(([k]) => /^H11/.test(k) && !/SEM/.test(k))]) {
      if (s.set === 'h11d-dev' && id === '(base)') continue; // the bases are hx-rules-v3-dev's, scored there
      const tree = path.join(scratch, s.set, d, id);
      fs.cpSync(base, tree, { recursive: true });
      if (id !== '(base)') fs.cpSync(path.join(s.casesRoot, d, 'cases', id), tree, { recursive: true });
      const r = await runTree(tree, rules, { spec: path.join(tree, 'spec.yaml'), scratch: path.join(scratch, '_s'), withApg: false, ...(id !== '(base)' ? { baseline: base } : {}) });
      const f = r.findings.filter((x) => x.rule === RULE && x.status === 'violation');
      const inFile = l.file === null ? f : f.filter((x) => x.file === l.file);
      rows.push({ set: s.set, domain: d, case: id, label: l.label, subshape: l.subshape, kind: l.kind, file: l.file, hit: inFile.length > 0, shapes: [...new Set(inFile.map((x) => shapeOf(x.evidence)))].sort(), evidence: f.map((x) => x.evidence) });
      process.stderr.write('.');
    }
  }
}
fs.rmSync(scratch, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({ rule: RULE, modelCalls: 0, rows }, null, 1)}\n`);
