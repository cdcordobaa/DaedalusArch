/**
 * v1.5 Stage 0 (2026-10-26), zero calls: regression of the `src/` v1.5 instrument on the EXISTING DRIFT-01 outputs.
 *
 *   npx tsx experiments/v15-stage0/regress-drift01.ts [--engine src|prototype] [--set pilot|rescore]
 *
 * `--set pilot` (default) is the DRIFT-01 pilot (`results/v1.4-drift-01/score/`); `--set rescore` is DRIFT-01 Part A,
 * the two HEXDDD-01 trajectories (`results/v1.4-drift-01/rescore-hexddd/scores.json`, trees from the seeds and
 * `results/v1.4-pilot-hexddd-01/diffs/<task>/step-0N.diff`).
 *
 * Every block of `results/v1.4-drift-01/score/blocks.json` is rebuilt from its seed
 * (`experiments/pilot-hexddd-01/seeds/`, hash-checked by `build-seeds.mjs --check`) and the recorded diffs
 * (`results/v1.4-drift-01/diffs/<task>-<rep>-shared/step-01.diff`, then `<task>-<rep>-<arm>/step-0N.diff`, each the
 * tree after the step against the tree before it). Each step tree is scored with the v1.5 part of
 * `experiments/drift-01/score-drift.ts` (DETECT-02 R-D4 and R-XCTX as edge identities, the same spec, the same
 * renames and the same Study 2b drift parameters); the frozen part is not re-run (it needs the skeleton install and is
 * not what moved). `--engine src` (default) uses `src/v15-instrument`; `--engine prototype` uses
 * `experiments/detect-02` as it is in this checkout, to separate a promotion difference from a prototype change.
 * Compared with the recorded `scores.json`: per step the v1.5 identity keys and raw findings, per block `D_v15_only`
 * and `D_v15_only_seed`. Writes `experiments/v15-stage0/results/regress-drift01-<set>-<engine>.json`.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { renameMapBetween } from '../../scripts/lib/drift/git-rename.js';
import { keysFor } from '../../scripts/lib/drift/identity.js';
import { driftRun, type StepInput } from '../../scripts/lib/drift/study2-d.js';
import { STUDY2_S2D01, type DriftParams, type IdFinding } from '../../scripts/lib/drift/types.js';
import * as proto from '../detect-02/lib/graph.js';
import { V15_RULES, v15Identities, withCommandRenames } from '../drift-01/lib/v15-identity.js';
import * as src from '../../src/v15-instrument/graph.js';

const D_V15: DriftParams = STUDY2_S2D01;
const D_V15_SEED: DriftParams = { ...STUDY2_S2D01, kFrom: 2, kTo: 6 };
const SEEDS: Record<string, string> = { t1: 'experiments/pilot-hexddd-01/seeds/s2-ddd-debt', t2: 'experiments/pilot-hexddd-01/seeds/s1-hex-debt' };
const engineArg = process.argv.includes('--engine') ? process.argv[process.argv.indexOf('--engine') + 1] : 'src';
const engine = engineArg === 'prototype' ? proto : src;
const setArg = process.argv.includes('--set') ? process.argv[process.argv.indexOf('--set') + 1] : 'pilot';
const HEX_SEEDS: Record<string, string> = { 's1-hotel-bookings': 'experiments/pilot-hexddd-01/seeds/s1-hex-debt', 's2-orders-invoices': 'experiments/pilot-hexddd-01/seeds/s2-ddd-debt' };

interface Block { block: string; task: string; arm: string; spec: string; steps: { step: number; dir: string }[] }
interface RecStep { step: number; v15Keys: string[]; v15Findings: { rule: string; file: string; line: number | null; subject: string; evidence: string; status: string }[] }
interface RecBlock { block: string; D_v15_only: { D: number | null; Y1: number; Yk: number }; D_v15_only_seed: { D: number | null; Y1: number; Yk: number }; steps: RecStep[] }

function copyTree(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyTree(a, b);
    else if (e.isFile()) fs.copyFileSync(a, b);
  }
}
function srcFiles(tree: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    const abs = path.join(tree, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.ts')) out.push(r);
    }
  };
  walk('src');
  return out.sort();
}
const keysOf = (xs: readonly IdFinding[]): Set<string> => new Set(xs.flatMap((f) => keysFor(f, D_V15)));

async function main(): Promise<number> {
  const recFile = setArg === 'rescore' ? 'results/v1.4-drift-01/rescore-hexddd/scores.json' : 'results/v1.4-drift-01/score/scores.json';
  const recorded = (JSON.parse(fs.readFileSync(recFile, 'utf8')) as { blocks: (RecBlock & Block)[] }).blocks;
  const blocks: Block[] = setArg === 'rescore' ? recorded : (JSON.parse(fs.readFileSync('results/v1.4-drift-01/score/blocks.json', 'utf8')) as { blocks: Block[] }).blocks;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-stage0-drift-'));
  const rules = engine.loadRules();
  const mismatches: string[] = [];
  const out: Record<string, unknown>[] = [];
  let compared = 0;
  try {
    for (const [bi, b] of blocks.entries()) {
      const rec = recorded.find((r) => r.block === b.block);
      if (rec === undefined) { mismatches.push(`${b.block}: no recorded block`); continue; }
      const [task, rep, arm] = (setArg === 'rescore' ? [b.task, '', b.arm] : b.block.split('/')) as [string, string, string];
      // Rebuild the step trees: seed, shared step 1, the arm's steps 2–5.
      const trees: { step: number; dir: string }[] = [];
      const work = path.join(scratch, `b${String(bi)}`, 'work');
      copyTree((setArg === 'rescore' ? HEX_SEEDS[task] : SEEDS[task]) as string, work);
      execFileSync('git', ['init', '-q'], { cwd: work });
      const snapshot = (step: number): void => {
        const d = path.join(scratch, `b${String(bi)}`, `step-${String(step)}`);
        copyTree(work, d);
        trees.push({ step, dir: d });
      };
      snapshot(0);
      const diffs = setArg === 'rescore' ? [1, 2, 3, 4, 5].map((s) => ({ step: s, file: `results/v1.4-pilot-hexddd-01/diffs/${task}/step-0${String(s)}.diff` })) : [{ step: 1, file: `results/v1.4-drift-01/diffs/${task}-${rep}-shared/step-01.diff` }, ...[2, 3, 4, 5].map((s) => ({ step: s, file: `results/v1.4-drift-01/diffs/${task}-${rep}-${arm}/step-0${String(s)}.diff` }))];
      for (const d of diffs) {
        const text = fs.readFileSync(d.file, 'utf8').split('\n').filter((l, i) => !(i === 0 && l.startsWith('# '))).join('\n');
        if (text.trim() !== '') {
          fs.writeFileSync(path.join(scratch, 'p.diff'), text.endsWith('\n') ? text : `${text}\n`);
          execFileSync('git', ['apply', '--whitespace=nowarn', path.join(scratch, 'p.diff')], { cwd: work });
        }
        snapshot(d.step);
      }
      // Score each step tree (v1.5 part of score-drift.ts) and commit it for the rename map.
      const repo = path.join(scratch, `b${String(bi)}`, 'g');
      fs.mkdirSync(repo, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: repo });
      const scored: { step: number; v15: IdFinding[]; raw: RecStep['v15Findings']; files: string[] }[] = [];
      const commits: string[] = [];
      for (const t of trees) {
        fs.rmSync(path.join(t.dir, '.git'), { recursive: true, force: true });
        fs.rmSync(path.join(t.dir, 'detect02.allow.yaml'), { force: true });
        const d = await engine.runTree(t.dir, rules, { spec: path.resolve(b.spec), scratch: path.join(scratch, 'd02') });
        scored.push({
          step: t.step, v15: v15Identities(d.findings, d.facts), files: srcFiles(t.dir),
          raw: d.findings.filter((f) => V15_RULES.includes(f.rule)).map((f) => ({ rule: f.rule, file: f.file, line: f.line, subject: f.subject, evidence: f.evidence, status: f.status, ...(f.note !== undefined ? { note: f.note } : {}) })),
        });
        for (const e of fs.readdirSync(repo)) if (e !== '.git') fs.rmSync(path.join(repo, e), { recursive: true, force: true });
        copyTree(t.dir, repo);
        execFileSync('git', ['add', '-A'], { cwd: repo });
        execFileSync('git', ['-c', 'user.name=stage0', '-c', 'user.email=stage0@localhost', 'commit', '-q', '--allow-empty', '-m', `step ${String(t.step)}`], { cwd: repo });
        commits.push(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim());
      }
      const rhos = scored.map((s, i) => (i === 0 ? new Map<string, string>() : withCommandRenames(renameMapBetween(repo, commits[i - 1] as string, commits[i] as string, '.', '').rename, scored[i - 1]?.v15 ?? [])));
      const stepsOf = (shift: number): StepInput[] => scored.filter((s) => s.step + shift >= 1).map((s) => {
        const i = scored.indexOf(s);
        return { step: s.step + shift, final: { id: commits[i] as string, contextId: 'stage0', ok: true, findings: s.v15, files: s.files }, ...(i > 0 ? { rename: rhos[i] } : {}) };
      });
      const meta = { runId: b.block, blockId: b.block, cell: b.arm };
      const run = (p: DriftParams, shift: number): { D: number | null; Y1: number; Yk: number } => { const r = driftRun(stepsOf(shift), p, undefined, meta); return { D: r.D, Y1: r.Y1, Yk: r.Yk }; };
      const dOnly = run(D_V15, 0);
      const dSeed = run(D_V15_SEED, 1);
      for (const k of ['D', 'Y1', 'Yk'] as const) {
        if (dOnly[k] !== rec.D_v15_only[k]) mismatches.push(`${b.block} D_v15_only.${k}: recorded ${String(rec.D_v15_only[k])} vs ${engineArg} ${String(dOnly[k])}`);
        if (dSeed[k] !== rec.D_v15_only_seed[k]) mismatches.push(`${b.block} D_v15_only_seed.${k}: recorded ${String(rec.D_v15_only_seed[k])} vs ${engineArg} ${String(dSeed[k])}`);
      }
      const perStep = scored.map((s) => {
        const r = rec.steps.find((x) => x.step === s.step);
        const keys = [...keysOf(s.v15)].sort();
        const keysSame = r !== undefined && JSON.stringify(keys) === JSON.stringify(r.v15Keys);
        const rawSame = r !== undefined && JSON.stringify(s.raw) === JSON.stringify(r.v15Findings);
        compared++;
        if (!keysSame) mismatches.push(`${b.block} step ${String(s.step)} v15Keys: recorded ${JSON.stringify(r?.v15Keys)} vs ${engineArg} ${JSON.stringify(keys)}`);
        if (!rawSame) mismatches.push(`${b.block} step ${String(s.step)} v15Findings differ (recorded ${String(r?.v15Findings.length)}, ${engineArg} ${String(s.raw.length)})`);
        return { step: s.step, v15Keys: keys, v15Findings: s.raw, matches: { keys: keysSame, findings: rawSame } };
      });
      out.push({ block: b.block, D_v15_only: dOnly, D_v15_only_seed: dSeed, recorded: { D_v15_only: rec.D_v15_only.D, D_v15_only_seed: rec.D_v15_only_seed.D }, steps: perStep });
      process.stdout.write(`${b.block}: D_v15_only ${String(dOnly.D)} (recorded ${String(rec.D_v15_only.D)}), D_v15_only_seed ${String(dSeed.D)} (recorded ${String(rec.D_v15_only_seed.D)})\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  fs.mkdirSync('experiments/v15-stage0/results', { recursive: true });
  const summary = { blocks: out.length, stepsCompared: compared, mismatches: mismatches.length };
  fs.writeFileSync(`experiments/v15-stage0/results/regress-drift01-${setArg}-${engineArg}.json`, `${JSON.stringify({ schema: 'v15-stage0-regress-drift01/v1', engine: engineArg === 'prototype' ? 'experiments/detect-02' : 'src/v15-instrument', modelCalls: 0, summary, mismatches, blocks: out }, null, 1)}\n`);
  for (const m of mismatches) process.stdout.write(`MISMATCH ${m}\n`);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  return mismatches.length === 0 ? 0 : 1;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; });
