/**
 * R-MIRROR-SEM on TRAP-PILOT-v2 (calibration data): REPORT ONLY, run once after the rule, the prompt and the dev table
 * were fixed; nothing here was tuned on its output. Per variant (6 tasks x L1-L3): the seed, the clean and the trap
 * solution, each with the variant's seed as the baseline (as the hub and the scorer run). One answer per asked
 * candidate (`claude-opus-5-5`, the Claude CLI judge route), cached by content hash in a cache dir of its own.
 *
 *   npx tsx experiments/sem-mirror-dev/pilot-v2-report.ts --cache <dir> [--out experiments/sem-mirror-dev/results/pilot-v2-report.json]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from '../../src/v15-instrument/index.js';
import { cliCaller, createMirrorJudge, MIRROR_SEM_RULE, structureHolds } from '../../src/v15-instrument/mirror-sem.js';

const PILOT = path.join('experiments', 'trap-pilot-v2');
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main(): Promise<void> {
  const cache = argOf('--cache');
  if (cache === undefined) throw new Error('--cache <dir> is required');
  const rules = loadRules().filter((r) => r.id === MIRROR_SEM_RULE);
  const judge = createMirrorJudge({ mode: 'live', cacheDir: cache, caller: cliCaller(), ledger: path.join(cache, 'ledger.jsonl') });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-mirror-pilot-'));
  const rows: Record<string, unknown>[] = [];
  for (const task of fs.readdirSync(PILOT).filter((d) => /^p\d-/.test(d)).sort()) {
    for (const level of ['L1', 'L2', 'L3']) {
      const v = path.join(PILOT, task, level);
      const seed = path.join(v, 'seed');
      for (const tree of ['seed', 'solutions/clean', 'solutions/trap']) {
        const before = { ...judge.stats };
        const r = await runTree(path.join(v, tree), rules, { spec: path.join(v, 'spec.yaml'), withApg: false, scratch, baseline: seed, mirrorJudge: judge });
        const fired = r.findings.filter((f) => f.rule === MIRROR_SEM_RULE && f.status === 'violation');
        const cands = r.facts.mirrorCandidates;
        const row = {
          task, level, tree, candidates: cands.length, asked: cands.filter(structureHolds).length,
          candidateSets: cands.map((c) => ({ coreSet: c.coreSet, vendorSet: `${c.vendorSet} of ${c.module}`, mappedFrom: c.mappedFrom, mappedTo: c.mappedTo, oneToOne: c.oneToOne, branches: c.branches.length, ownedBy: c.ownedBy, asked: structureHolds(c) })),
          answers: { yes: r.stats.mirrorSemYes ?? 0, no: r.stats.mirrorSemNo ?? 0, unsure: r.stats.mirrorSemUnsure ?? 0, noAnswer: r.stats.mirrorSemNoAnswer ?? 0 },
          calls: judge.stats.calls - before.calls, fired: fired.length, evidence: fired.map((f) => f.evidence),
        };
        rows.push(row);
        process.stdout.write(`${`${task}/${level}`.padEnd(28)} ${tree.padEnd(16)} candidates ${String(row.candidates)} asked ${String(row.asked)} yes/no/unsure ${String(row.answers.yes)}/${String(row.answers.no)}/${String(row.answers.unsure)} fired ${String(row.fired)}\n`);
      }
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const out = { reportOnly: true, rule: MIRROR_SEM_RULE, calls: judge.stats.calls, rows };
  const f = argOf('--out');
  if (f !== undefined) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(out, null, 2)}\n`); }
}
void main();
