/**
 * U4 S2 (v1.5-exp): the candidate sets for confirmation, zero model calls.
 *
 *   npx tsx experiments/v15-u4/candidates.ts --pilot-trees <dir>   # → results/candidates.json, results/proposer-counts.json
 *
 * Sources: the DETECT-02 dev set (`devTrees`, read-only import; the HEXDDD-01 step trees rebuilt into `--pilot-trees`)
 * and the precision fixtures P1–P10 in the declared and the fallback condition. Per tree: every symbolic violation
 * (R-D4 and R-XCTX on one command are one D4 question, as `detect-02/semantic.ts` asks them) and every relaxed D5
 * candidate of `proposer.ts` whose line R-D5 does not already propose.
 *
 * `expected` per candidate: `tp` when the tree carries a labelled case of the family in the candidate's file (the
 * DETECT-02 case match), `fp` when the tree carries no case of the family (and the family is labelled there; every
 * legit precision tree is a negative for every family), `null` otherwise (an extra candidate on a positive tree, or a
 * family unlabelled on that tree). Tree paths are stored as tokens (`<pilot>/…` or repository-relative).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { devTrees } from '../detect-02/evaluate.js';
import type { DevTree } from '../detect-02/evaluate.js';
import { loadRules, runTree } from '../detect-02/lib/graph.js';
import type { Finding } from '../detect-02/lib/graph.js';
import type { Candidate } from '../detect-02/semantic.js';
import { PROPOSER_VERSION, relaxedCandidates, scratchDir } from './proposer.js';

const HERE = 'experiments/v15-u4';
const FX = 'experiments/detect-02/fixtures/precision';

export interface U4Candidate extends Candidate {
  readonly source: 'rule' | 'relaxed';
  readonly set: 'dev' | 'precision';
  readonly group: string;
  readonly inScope?: boolean;
}

export const resolveTree = (token: string, pilotDir: string): string => (token.startsWith('<pilot>/') ? path.join(pilotDir, token.slice('<pilot>/'.length)) : token);

interface Target { label: string; group: string; set: 'dev' | 'precision'; token: string; path: string; spec?: string | undefined; style?: string | undefined; cases: DevTree['cases']; unlabelled: readonly string[]; legit: boolean }

function precisionTargets(scratch: string): Target[] {
  const out: Target[] = [];
  for (const d of fs.readdirSync(FX).sort()) {
    const meta = JSON.parse(fs.readFileSync(path.join(FX, d, 'fixture.json'), 'utf8')) as { legit: string; positive: string | null; expectPositive?: string[] };
    const specPath = path.join(FX, d, 'spec.yaml');
    const doc = YAML.parse(fs.readFileSync(specPath, 'utf8')) as { architecture: { ddd: Record<string, unknown> } };
    delete doc.architecture.ddd.aggregates;
    const fb = path.join(scratch, `${d}.fallback.yaml`);
    fs.writeFileSync(fb, YAML.stringify(doc));
    for (const [variant, tree] of [['legit', meta.legit], ['positive', meta.positive]] as const) {
      if (tree === null) continue;
      for (const [cond, spec] of [['declared', specPath], ['fallback', fb]] as const) {
        const p = path.join(FX, d, tree);
        const fams = variant === 'positive' ? [...new Set((meta.expectPositive ?? []).map((r) => (r === 'R-XCTX' ? 'D4' : r.replace(/^R-/, ''))))] : [];
        out.push({
          label: `precision/${d}/${variant}/${cond}`, group: `precision-${variant}`, set: 'precision', token: p, path: p, spec: cond === 'declared' ? specPath : `<fallback>/${d}`,
          cases: fams.map((f) => ({ id: `${d}-${f}`, family: f, file: '' })), unlabelled: variant === 'positive' ? ['D5', 'D9', 'H5', 'H4', 'RTX'].filter((f) => !fams.includes(f)) : [], legit: variant === 'legit',
        });
        if (cond === 'fallback') out[out.length - 1]!.spec = fb;
      }
    }
  }
  return out;
}

function expectedOf(t: Target, family: string, file: string, pathFiles: readonly string[]): 'tp' | 'fp' | null {
  if (t.legit) return 'fp';
  if (t.unlabelled.includes(family)) return null;
  const cs = t.cases.filter((c) => c.family === family);
  if (cs.length === 0) return 'fp';
  return cs.some((c) => c.file === '' || c.file === file || pathFiles.some((p) => p.startsWith(c.file))) ? 'tp' : null;
}

async function main(pilotDir: string): Promise<void> {
  const rules = loadRules();
  const famOf = (id: string): string => (id === 'R-XCTX' ? 'D4' : rules.find((r) => r.id === id)?.family ?? '?');
  const scratch = scratchDir();
  const targets: Target[] = [
    ...devTrees(pilotDir).map((t) => ({
      label: t.label, group: t.group, set: 'dev' as const, token: t.path.startsWith(pilotDir) ? `<pilot>/${path.relative(pilotDir, t.path)}` : t.path, path: t.path,
      spec: t.spec, style: t.style, cases: t.cases, unlabelled: t.unlabelled ?? [], legit: false,
    })),
    ...precisionTargets(scratch),
  ];
  const cands: U4Candidate[] = [];
  const counts: Record<string, unknown>[] = [];
  for (const t of targets) {
    const r = await runTree(t.path, rules, { spec: t.spec, style: t.style, scratch });
    const vio = r.findings.filter((f) => f.status === 'violation');
    // One question per (command or unit, family): R-D4 and R-XCTX on one command merge into one D4 question.
    const byKey = new Map<string, Finding[]>();
    for (const f of vio) { const k = `${famOf(f.rule)}|${f.file}|${f.subject}`; byKey.set(k, [...(byKey.get(k) ?? []), f]); }
    for (const [k, fs2] of byKey) {
      const fam = k.split('|')[0]!;
      const f = fs2[0]!;
      const pathFiles = fs2.flatMap((x) => x.path);
      cands.push({
        id: `${t.label}#${fam}#${f.file}:${String(f.line)}`, tree: t.token, label: t.label, family: fam, rule: fs2.map((x) => x.rule).join('+'), file: f.file, line: f.line,
        subject: f.subject, evidence: fs2.map((x) => x.evidence).join(' | '), path: [...new Set(pathFiles)], expected: expectedOf(t, fam, f.file, pathFiles), comments: 'blank',
        source: 'rule', set: t.set, group: t.group,
      });
    }
    const rx = await relaxedCandidates(t.path, { spec: t.spec, style: t.style, scratch });
    const ruleLines = new Set(vio.filter((f) => f.rule === 'R-D5').map((f) => `${f.file}:${String(f.line)}`));
    let added = 0;
    for (const c of rx.candidates) {
      if (ruleLines.has(`${c.file}:${String(c.line)}`)) continue;
      added++;
      cands.push({
        id: `${t.label}#D5#${c.file}:${String(c.line)}`, tree: t.token, label: t.label, family: 'D5', rule: 'R-D5-relaxed', file: c.file, line: c.line, subject: c.unit,
        evidence: `if (${c.cond}) ${c.exit === 'throw' ? 'throws' : 'returns early'}: the condition reads the state of ${c.root} (${c.read})${c.inScope ? '; inside a lock or transaction scope' : ''}`,
        path: [], expected: expectedOf(t, 'D5', c.file, []), comments: 'blank', source: 'relaxed', set: t.set, group: t.group, inScope: c.inScope,
      });
    }
    counts.push({ label: t.label, group: t.group, rootSource: rx.rootSource, ruleD5: ruleLines.size, relaxedRaw: rx.candidates.length, relaxedNew: added, ruleCandidates: byKey.size, d5Labelled: t.cases.some((c) => c.family === 'D5') });
    process.stdout.write(`${t.label}: rule ${String(byKey.size)} (D5 ${String(ruleLines.size)}), relaxed +${String(added)}\n`);
  }
  fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
  fs.writeFileSync(path.join(HERE, 'results', 'candidates.json'), `${JSON.stringify(cands, null, 1)}\n`);
  const tally = (xs: U4Candidate[]) => ({ n: xs.length, tp: xs.filter((c) => c.expected === 'tp').length, fp: xs.filter((c) => c.expected === 'fp').length, unlabelled: xs.filter((c) => c.expected === null).length });
  const summary = {
    proposer: PROPOSER_VERSION, trees: targets.length, candidates: cands.length,
    bySourceFamily: Object.fromEntries([...new Set(cands.map((c) => `${c.source}:${c.family}`))].sort().map((k) => [k, tally(cands.filter((c) => `${c.source}:${c.family}` === k))])),
    byGroup: Object.fromEntries([...new Set(cands.map((c) => c.group))].sort().map((g) => [g, tally(cands.filter((c) => c.group === g))])),
  };
  fs.writeFileSync(path.join(HERE, 'results', 'proposer-counts.json'), `${JSON.stringify({ schema: 'v15-u4-proposer-counts-v1', modelCalls: 0, summary, trees: counts }, null, 1)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 1)}\n`);
}

if (process.argv[1]?.endsWith('candidates.ts')) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--pilot-trees');
  if (i < 0) { process.stderr.write('--pilot-trees <dir> required\n'); process.exit(2); }
  main(path.resolve(argv[i + 1]!)).catch((e: unknown) => { process.stderr.write(`${String(e instanceof Error ? e.stack : e)}\n`); process.exitCode = 1; });
}
