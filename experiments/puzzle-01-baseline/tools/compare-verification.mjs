#!/usr/bin/env node
/**
 * Compares a fresh verify.ts output with the committed experiments/puzzle-01/verification.json (zero calls):
 * per puzzle the verdict, and per tree the tree sha256, tsc errors, test counts and oracle verdicts.
 * Usage (repository root): node experiments/puzzle-01-baseline/tools/compare-verification.mjs <fresh.json> [<reference.json>]
 */
import * as fs from 'node:fs';

const [fresh, ref = 'experiments/puzzle-01/verification.json'] = process.argv.slice(2);
const a = JSON.parse(fs.readFileSync(fresh, 'utf8'));
const b = JSON.parse(fs.readFileSync(ref, 'utf8'));
const out = [];
for (const p of a.puzzles) {
  const q = b.puzzles.find((x) => x.id === p.id);
  const trees = Object.entries(p.trees).map(([t, v]) => {
    const w = q?.trees?.[t];
    return {
      tree: t,
      sha256: v.sha256,
      sha256Equal: w?.sha256 === v.sha256,
      tscErrors: v.tsc.errors,
      tests: `${v.tests.regression.passed}/${v.tests.regression.total} reg, ${v.tests.feature.passed}/${v.tests.feature.total} feat`,
      oracle: (v.oracle.subGoals ?? []).map((g) => `${g.id}:${g.pass ? 'pass' : 'FAIL'}`).join(' '),
      oracleEqual: JSON.stringify((v.oracle.subGoals ?? []).map((g) => g.pass)) === JSON.stringify((w?.oracle?.subGoals ?? []).map((g) => g.pass)),
    };
  });
  out.push({ id: p.id, verdict: p.verdict, failedChecks: Object.entries(p.checks).filter(([, v]) => !v).map(([k]) => k), referenceVerdict: q?.verdict ?? null, trees });
}
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
