/**
 * SEM-GATE: the zero-agent gate for R-MIRROR-SEM (criteria fixed in `GATE.md` before any judge call). Runs the rule
 * (R-MIRROR-SEM only, the in-memory graph, the frozen Cypher) on every case of `cases.json`, with the judge on the
 * existing Claude CLI judge route (`cliCaller`, `claude-opus-5-5`). Every real call goes to the committed ledger
 * `results/calls.jsonl`; every answer goes to the disk cache `cache/` (by content hash), so a re-run replays at zero
 * calls. Without `--live` the judge is replay-only (a miss is not asked).
 *
 *   npx tsx experiments/sem-gate/gate.ts [--live] [--latency experiments/sem-gate/results/deferred-latency.json]
 *     [--out experiments/sem-gate/result.json]
 *
 * Kept agent trees are extracted from the results branch commit named in `cases.json` (`git archive | tar -x`) into a
 * scratch directory that is removed afterwards.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildGraph, loadRules, runTree } from '../../src/v15-instrument/index.js';
import {
  cliCaller, createMirrorJudge, mirrorKeyOf, mirrorPrompt, MIRROR_SEM_MODEL, MIRROR_SEM_RULE, MIRROR_SEM_VERSION, structureHolds,
  type Judged, type MirrorCandidateFact, type MirrorJudge,
} from '../../src/v15-instrument/mirror-sem.js';

const HERE = path.join('experiments', 'sem-gate');
const SESSIONS = 'results/v1.5-hx-study/hx-study/sessions';
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const LIVE = process.argv.includes('--live');

interface Case {
  id: string; source: 'built' | 'kept'; task: string; tree?: string; sessions?: string[]; step?: string; spec: string; baseline?: string;
  target: { file: string; coreSet: string }; key: string | null; label: 'positive' | 'negative'; form: 'A' | 'B' | null; twin: boolean; note: string;
}
interface Manifest { keptFrom: { commit: string }; cases: Case[] }

/** Citation checks (GATE.md §4, criterion 3). */
function citationProblems(tree: string, text: string, prompt: string | null, kind: 'evidence' | 'reason'): string[] {
  const out: string[] = [];
  const exists = (rel: string): boolean => fs.existsSync(path.join(tree, rel));
  const lines = (rel: string): number => fs.readFileSync(path.join(tree, rel), 'utf8').split('\n').length;
  // file:line citations
  for (const m of text.matchAll(/([\w./-]+\.(?:ts|js|md|yaml|json)):(\d+)/g)) {
    const [, f, n] = m as unknown as [string, string, string];
    if (!exists(f)) out.push(`${kind}: ${f}:${n} names a file not in the tree`);
    else if (Number(n) < 1 || Number(n) > lines(f)) out.push(`${kind}: ${f}:${n} is past the end of the file (${String(lines(f))} lines)`);
  }
  // bare paths
  for (const m of text.matchAll(/(?:^|[\s(`'"])((?:[\w.-]+\/)+[\w.-]+\.(?:ts|js|md|yaml|json))(?![:\w])/g)) {
    const f = m[1]!;
    if (!exists(f) && !(prompt?.includes(f) ?? false)) out.push(`${kind}: ${f} names a file not in the tree`);
  }
  if (kind === 'reason' && prompt !== null) {
    // code-like quoted tokens must occur in what the judge was shown
    for (const m of text.matchAll(/[`'"]([A-Za-z_][\w.-]*)[`'"]/g)) {
      const tok = m[1]!;
      if (!prompt.includes(tok)) out.push(`reason: quoted token ${tok} is not in the prompt`);
    }
    // explicit line numbers ("line 12") are a citation the prompt never gave
    for (const m of text.matchAll(/\bline (\d+)\b/gi)) out.push(`reason: cites line ${m[1]!}, but the prompt shows no line numbers`);
  }
  return out;
}

async function main(): Promise<void> {
  const man = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8')) as Manifest;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-gate-'));
  const rules = loadRules().filter((r) => r.id === MIRROR_SEM_RULE);
  if (rules.length !== 1) throw new Error('R-MIRROR-SEM rule not found');
  // kept trees
  const sessions = [...new Set(man.cases.filter((c) => c.source === 'kept').map((c) => c.sessions![0]!))].sort();
  if (sessions.length > 0) {
    const paths = sessions.flatMap((s) => [`${SESSIONS}/${s}/snap/step-00`, `${SESSIONS}/${s}/snap/step-03`]);
    const tar = path.join(scratch, 'kept.tar');
    execFileSync('git', ['archive', '--output', tar, man.keptFrom.commit, ...paths]);
    execFileSync('tar', ['-x', '-f', tar, '-C', scratch]);
  }
  const treeOf = (c: Case): { tree: string; baseline?: string } => (c.source === 'kept'
    ? { tree: path.join(scratch, SESSIONS, c.sessions![0]!, 'snap', c.step!), baseline: path.join(scratch, SESSIONS, c.sessions![0]!, 'snap', 'step-00') }
    : { tree: c.tree!, ...(c.baseline !== undefined ? { baseline: c.baseline } : {}) });

  const ledger = path.join(HERE, 'results', 'calls.jsonl');
  const inner = createMirrorJudge({ mode: LIVE ? 'live' : 'replay', cacheDir: path.join(HERE, 'cache'), ...(LIVE ? { caller: cliCaller() } : {}), ledger });
  const seen = new Map<string, { judged: Judged; prompt: string }>();
  const judge: MirrorJudge = {
    stats: inner.stats,
    async judge(c: MirrorCandidateFact): Promise<Judged> {
      const j = await inner.judge(c);
      if (!seen.has(j.key)) seen.set(j.key, { judged: j, prompt: mirrorPrompt(c) });
      return j;
    },
  };

  // one runTree per distinct tree
  const byTree = new Map<string, Case[]>();
  for (const c of man.cases) { const t = treeOf(c).tree; byTree.set(t, [...(byTree.get(t) ?? []), c]); }
  const rows: Record<string, unknown>[] = [];
  const t0 = Date.now();
  for (const [tree, cs] of byTree) {
    const c0 = cs[0]!;
    const base = treeOf(c0).baseline;
    const opts = { spec: c0.spec, withApg: false, scratch, ...(base !== undefined ? { baseline: base } : {}) };
    const { facts } = await buildGraph(tree, opts);
    const r = await runTree(tree, rules, { ...opts, mirrorJudge: judge });
    for (const c of cs) {
      const cand = facts.mirrorCandidates.find((x) => x.file === c.target.file && x.coreSet === c.target.coreSet);
      const asked = cand !== undefined && structureHolds(cand);
      const key = asked ? mirrorKeyOf(cand) : null;
      const keyMatches = c.key === null ? key === null : key !== null && key.startsWith(c.key.slice(0, 24));
      const j = key !== null ? seen.get(key) : undefined;
      const fired = r.findings.filter((f) => f.rule === MIRROR_SEM_RULE && f.status === 'violation' && f.file === c.target.file && f.subject === c.target.coreSet);
      const problems = [
        ...fired.flatMap((f) => citationProblems(tree, f.evidence.split(' | model fact: ')[0]!, null, 'evidence')),
        ...fired.filter((f) => f.line === null || !fs.existsSync(path.join(tree, f.file)) || f.line > fs.readFileSync(path.join(tree, f.file), 'utf8').split('\n').length).map((f) => `finding: ${f.file}:${String(f.line)} does not exist`),
        ...(j?.judged.verdict !== null && j?.judged.verdict !== undefined ? citationProblems(tree, j.judged.verdict.reason, j.prompt, 'reason') : []),
      ];
      rows.push({
        id: c.id, source: c.source, task: c.task, label: c.label, form: c.form, twin: c.twin, target: c.target,
        candidate: cand !== undefined, asked, keyMatches, key: key?.slice(0, 24) ?? null,
        answer: j?.judged.verdict?.mirror ?? (asked ? 'no-answer' : null), reason: j?.judged.verdict?.reason ?? null, from: j?.judged.from ?? null, callMs: j?.judged.ms ?? null,
        fired: fired.length > 0, citationProblems: problems,
      });
      process.stdout.write(`${c.id.padEnd(28)} ${c.label.padEnd(9)} ${(c.form ?? '-').padEnd(2)} asked ${asked ? 'y' : 'n'} key ${keyMatches ? 'ok' : 'DIFF'} answer ${String(j?.judged.verdict?.mirror ?? '-').padEnd(7)} fired ${fired.length > 0 ? 'y' : 'n'} cites ${String(problems.length)}\n`);
    }
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const wallMs = Date.now() - t0;

  const pos = rows.filter((r) => r['label'] === 'positive');
  const neg = rows.filter((r) => r['label'] === 'negative');
  const recall = (xs: Record<string, unknown>[]): { n: number; fired: number; recall: number | null } => ({ n: xs.length, fired: xs.filter((r) => r['fired']).length, recall: xs.length > 0 ? xs.filter((r) => r['fired']).length / xs.length : null });
  const rA = recall(pos.filter((r) => r['form'] === 'A'));
  const rB = recall(pos.filter((r) => r['form'] === 'B'));
  const rAll = recall(pos);
  const askedPos = pos.filter((r) => r['asked']);
  const judgeRecall = { n: askedPos.length, yes: askedPos.filter((r) => r['answer'] === 'yes').length };
  const fp = neg.filter((r) => r['fired']);
  const cites = rows.flatMap((r) => (r['citationProblems'] as string[]).map((p) => `${String(r['id'])}: ${p}`));
  const calls = fs.existsSync(ledger) ? fs.readFileSync(ledger, 'utf8').trim().split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as { durationMs: number; ok: boolean; key: string }) : [];
  const gateCalls = calls;
  // per judged case: the summed call time of its question in the ledger (stable under replay)
  const msByKey = new Map<string, number>();
  for (const x of gateCalls) msByKey.set(x.key, (msByKey.get(x.key) ?? 0) + x.durationMs);
  const perCase = rows.filter((r) => r['asked'] && msByKey.has(String(r['key']))).map((r) => msByKey.get(String(r['key']))!);
  const sorted = [...perCase].sort((a, b) => a - b);
  const median = sorted.length === 0 ? null : sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;

  const latFile = argOf('--latency');
  const lat = latFile !== undefined && fs.existsSync(latFile) ? (JSON.parse(fs.readFileSync(latFile, 'utf8')) as { summary: { p95CheckMs: number; maxAddedMs: number; minCallMs: number | null; firedAfterSettle: boolean; pushes: number; calls: number } }).summary : null;
  const c4 = lat === null ? null : lat.p95CheckMs < 5000 && lat.minCallMs !== null && lat.maxAddedMs < Math.min(1000, lat.minCallMs) && lat.firedAfterSettle;

  const criteria = [
    { id: '1a', what: 'recall >= 0.80, form A (core-side renamed copy, no adapter mapping): the rule fires on the target set', value: rA, pass: rA.recall !== null && rA.recall >= 0.8 },
    { id: '1b', what: 'recall >= 0.80, form B (adapter-mapped renamed copy): the rule fires on the target set', value: rB, pass: rB.recall !== null && rB.recall >= 0.8 },
    { id: '2', what: 'false positives <= 1 on the negative cases (incl. the twins)', value: { n: neg.length, fired: fp.length, ids: fp.map((r) => r['id']) }, pass: fp.length <= 1 },
    { id: '3', what: '0 hallucinated citations (finding locations and evidence sites exist; every path, line and quoted token in a model reason exists)', value: { problems: cites.length, list: cites }, pass: cites.length === 0 },
    { id: '4', what: 'deferred mode: hub p95 check < 5 s with the judge deferred, no push check waits on a model call, the candidate fires once its answer is in', value: lat, pass: c4 },
  ];
  const verdict = criteria.every((c) => c.pass === true) ? 'PASS' : 'FAIL';
  const out = {
    gate: 'SEM-GATE', date: new Date().toISOString(), rule: MIRROR_SEM_RULE, version: MIRROR_SEM_VERSION, model: MIRROR_SEM_MODEL, live: LIVE,
    cases: rows.length, positives: pos.length, negatives: neg.length, twins: rows.filter((r) => r['twin']).length,
    keysMatchManifest: rows.every((r) => r['keyMatches']),
    criteria, verdict,
    reported: {
      recallAllPositives: rAll, judgeRecallOnAskedPositives: judgeRecall,
      answers: Object.fromEntries(['yes', 'no', 'unsure', 'no-answer'].map((a) => [a, rows.filter((r) => r['answer'] === a).length])),
      judgedCases: rows.filter((r) => r['asked']).length, distinctQuestions: new Set(rows.filter((r) => r['asked']).map((r) => r['key'])).size,
      gateCallsThisRun: judge.stats.calls, ledgerCalls: gateCalls.length, ledgerFailed: calls.filter((x) => !x.ok).length,
      medianCallMsPerJudgedCase: median, callsPerJudgedCase: perCase.length > 0 ? gateCalls.length / new Set(rows.filter((r) => r['asked']).map((r) => r['key'])).size : null, wallMs,
    },
    rows,
  };
  process.stdout.write(`${JSON.stringify({ verdict, criteria: criteria.map((c) => ({ id: c.id, pass: c.pass })), reported: out.reported })}\n`);
  const f = argOf('--out');
  if (f !== undefined) fs.writeFileSync(f, `${JSON.stringify(out, null, 1)}\n`);
  // the answers, one line per judged case (the HCAL-06 judged-ledger pattern)
  if (LIVE) fs.writeFileSync(path.join(HERE, 'results', 'judged.jsonl'), rows.filter((r) => r['asked']).map((r) => JSON.stringify({ case: r['id'], key: r['key'], from: r['from'], mirror: r['answer'], reason: r['reason'] })).join('\n') + '\n');
}
void main();
