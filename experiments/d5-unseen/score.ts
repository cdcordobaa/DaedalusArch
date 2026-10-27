/**
 * C1 S2 re-run on the sealed unseen cases (`ops/notes/d5-declared-invariants-design.md` §6–§7). Zero model calls.
 * Checks the seal first (`SEAL.sha256`), then runs the v1.5 rules on every case with its domain's spec and compares
 * R-D5S with `labels.json`: a violation case passes when R-D5S flags the labelled file; a clean case passes when
 * R-D5S flags nothing. Other rules' findings are listed for the record only.
 *
 *   npx tsx experiments/d5-unseen/score.ts
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';

const DIR = path.join(process.cwd(), 'experiments', 'd5-unseen');
interface Label { label: 'violation' | 'clean'; invariant: string | null; file: string | null; line: number | null; note: string }

async function main(): Promise<void> {
  for (const l of fs.readFileSync(path.join(DIR, 'SEAL.sha256'), 'utf8').trim().split('\n')) {
    const [hash, file] = [l.slice(0, 64), l.slice(66)];
    const now = createHash('sha256').update(fs.readFileSync(path.join(DIR, file))).digest('hex');
    if (now !== hash) throw new Error(`seal broken: ${file}`);
  }
  const rules = loadRules();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'd5-unseen-'));
  const rows: Record<string, unknown>[] = [];
  for (const domain of fs.readdirSync(path.join(DIR, 'cases')).sort()) {
    const dd = path.join(DIR, 'cases', domain);
    const labels = JSON.parse(fs.readFileSync(path.join(dd, 'labels.json'), 'utf8')) as Record<string, Label>;
    for (const [c, lab] of Object.entries(labels).sort()) {
      const r = await runTree(path.join(dd, c), rules, { spec: path.join(dd, 'spec.yaml'), scratch });
      const d5s = r.findings.filter((f) => f.rule === 'R-D5S');
      const pass = lab.label === 'violation' ? d5s.some((f) => f.file === lab.file) : d5s.length === 0;
      rows.push({
        domain, case: c, label: lab.label, invariant: lab.invariant, labelledFile: lab.file, pass,
        d5s: d5s.map((f) => `${f.file}:${String(f.line)} ${f.evidence}`),
        other: r.findings.filter((f) => f.rule !== 'R-D5S' && f.status === 'violation').map((f) => `${f.rule} ${f.file}:${String(f.line)}`),
        specErrors: r.spec.specErrors,
      });
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const pos = rows.filter((x) => x.label === 'violation');
  const neg = rows.filter((x) => x.label === 'clean');
  const summary = {
    recall: `${String(pos.filter((x) => x.pass).length)}/${String(pos.length)}`,
    falsePositives: `${String(neg.filter((x) => !x.pass).length)}/${String(neg.length)}`,
    gate: { recallMin: '5/6', fpMax: '0/10' },
  };
  fs.writeFileSync(path.join(DIR, 'result.json'), `${JSON.stringify({ seal: fs.readFileSync(path.join(DIR, 'SEAL.root'), 'utf8').trim(), modelCalls: 0, summary, rows }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  for (const x of rows) process.stdout.write(`${String(x.domain)}/${String(x.case)} ${String(x.label)} ${x.pass ? 'PASS' : 'FAIL'} d5s=${String((x.d5s as string[]).length)}\n`);
}
void main();
