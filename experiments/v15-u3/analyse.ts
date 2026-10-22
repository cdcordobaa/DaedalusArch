/**
 * U3 analysis (`ops/notes/v15-u3-severity-note.md` §6). Zero calls: reads `results/<arm>/<project>/` written by
 * `run.ts` (record or replay) and the manifests, and prints the measures per set. Writes `results/<arm>/metrics.json`.
 *
 *   npx tsx experiments/v15-u3/analyse.ts --arm rubric
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { A5Entry } from '../../src/apg-enrich/ontology/c4-contract.js';
import type { C4CaseScore } from '../../src/apg-enrich/ontology/c4-scorer.js';
import type { C4Answer } from '../../src/apg-enrich/ontology/interpretation.js';
import { HERE, targetsOf } from './run.js';

const arm = process.argv.includes('--arm') ? process.argv[process.argv.indexOf('--arm') + 1] ?? 'rubric' : 'rubric';
const dir = path.join(HERE, 'results', arm);

interface Row {
  readonly id: string;
  readonly set: 'original' | 'new';
  readonly pair: string;
  readonly role: 'case' | 'twin';
  readonly allowed: readonly string[];
  readonly answers: readonly (C4Answer | null)[];
  readonly entry: A5Entry;
  readonly score: C4CaseScore;
  readonly expected: { readonly exceptionClaimed: boolean; readonly intentMatch: string };
  readonly nothingDeclared: boolean;
}

function rows(): Row[] {
  const out: Row[] = [];
  for (const set of ['original', 'new'] as const) {
    for (const t of targetsOf(set)) {
      const f = path.join(dir, t.id, 'interpretation.json');
      if (!fs.existsSync(f) || t.manifest === null) continue;
      const entry = (JSON.parse(fs.readFileSync(f, 'utf8')) as { entry: A5Entry }).entry;
      const score = JSON.parse(fs.readFileSync(path.join(dir, t.id, 'score.json'), 'utf8')) as C4CaseScore;
      const m = t.manifest;
      out.push({
        id: t.id, set, pair: m.pair, role: m.role, allowed: m.expected.severityAllowed,
        answers: entry.runs.map((r) => r.grounded?.answer ?? null), entry, score,
        expected: { exceptionClaimed: m.expected.exceptionClaimed, intentMatch: m.expected.intentMatch },
        nothingDeclared: m.expected.intentMatch === 'no-declared-intent',
      });
    }
  }
  return out;
}

const frac = (a: number, b: number): string => `${String(a)}/${String(b)}`;

function measures(rs: readonly Row[]): Record<string, string | number | string[]> {
  const runs = rs.flatMap((r) => r.answers.map((a) => ({ r, a })));
  const valid = runs.filter((x) => x.a !== null);
  const sevOk = valid.filter((x) => x.r.allowed.includes((x.a as C4Answer).severityClass)).length;
  const excOk = valid.filter((x) => (x.a as C4Answer).exceptionClaim.claimed === x.r.expected.exceptionClaimed).length;
  const intOk = valid.filter((x) => (x.a as C4Answer).intentMatch.status === x.r.expected.intentMatch).length;
  const cases = rs.filter((r) => r.role === 'case');
  const twins = rs.filter((r) => r.role === 'twin');
  const pairs = [...new Set(rs.map((r) => r.pair))];
  const pairBoth = pairs.filter((p) => rs.filter((r) => r.pair === p).every((r) => r.score.correct === true)).length;
  const stable = (g: (a: C4Answer) => string): number => rs.filter((r) => r.answers.every((a) => a !== null) && new Set(r.answers.map((a) => g(a as C4Answer))).size === 1).length;
  const nd = rs.filter((r) => r.nothingDeclared).flatMap((r) => r.answers);
  const abstained = nd.filter((a) => a !== null && a.intentMatch.status === 'no-declared-intent' && !a.exceptionClaim.claimed).length;
  // Severity direction between case and twin (new set: single expected classes).
  const rank: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const moved = pairs.filter((p) => {
    const c = rs.find((r) => r.pair === p && r.role === 'case');
    const t = rs.find((r) => r.pair === p && r.role === 'twin');
    if (c === undefined || t === undefined || c.allowed.length !== 1 || t.allowed.length !== 1) return false;
    const want = Math.sign((rank[t.allowed[0] ?? 'low'] ?? 0) - (rank[c.allowed[0] ?? 'low'] ?? 0));
    return c.answers.every((ca, i) => {
      const ta = t.answers[i];
      return ca !== null && ta !== null && ta !== undefined && Math.sign((rank[ta.severityClass] ?? 0) - (rank[ca.severityClass] ?? 0)) === want;
    });
  }).length;
  return {
    targets: rs.length,
    validRuns: frac(valid.length, runs.length),
    severityAgreement: frac(sevOk, valid.length),
    exceptionAccuracy: frac(excOk, valid.length),
    intentAccuracy: frac(intOk, valid.length),
    casesCorrect: frac(cases.filter((r) => r.score.correct === true).length, cases.length),
    twinsCorrect: frac(twins.filter((r) => r.score.correct === true).length, twins.length),
    twinsClean: frac(twins.filter((r) => r.score.clean).length, twins.length),
    falseClaimsOnTwins: twins.reduce((n, r) => n + r.score.falseExceptionClaims, 0),
    pairsBothCorrect: frac(pairBoth, pairs.length),
    severityDirectionRight: frac(moved, pairs.length),
    stableException: frac(stable((a) => String(a.exceptionClaim.claimed)), rs.length),
    stableIntent: frac(stable((a) => a.intentMatch.status), rs.length),
    stableSeverity: frac(stable((a) => a.severityClass), rs.length),
    hallucinatedExceptions: rs.reduce((n, r) => n + r.score.hallucinatedExceptions, 0),
    unresolvedCites: rs.reduce((n, r) => n + r.entry.runs.reduce((k, x) => k + (x.grounded?.rejections.filter((j) => j.reason === 'cite-unresolved').length ?? 0), 0), 0),
    abstentionWhereNothingDeclared: frac(abstained, nd.length),
    baselineCasesCorrect: frac(cases.filter((r) => r.score.baseline.correct === true).length, cases.length),
    baselineTwinsClean: frac(twins.filter((r) => r.score.baseline.clean).length, twins.length),
    failures: rs.flatMap((r) => r.score.failures.map((f) => `${r.id}: ${f}`)),
  };
}

const all = rows();
const result = { arm, original: measures(all.filter((r) => r.set === 'original')), new: measures(all.filter((r) => r.set === 'new')) };
fs.writeFileSync(path.join(dir, 'metrics.json'), `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
