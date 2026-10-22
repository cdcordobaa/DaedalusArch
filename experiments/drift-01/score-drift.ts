/**
 * DRIFT-01 scorer (v1.5-exp, exploratory; zero calls: no model, no Neo4j, no network). Design:
 * `ops/notes/drift-01-design.md` §5.
 *
 *   npx tsx experiments/drift-01/score-drift.ts --manifest <blocks.json> --node-modules <H>/skeleton-install/node_modules --out <dir>
 *
 * A manifest is `{ "blocks": [{ "block", "task", "arm", "spec", "steps": [{ "step": 0..5, "dir" }] }] }`: step 0 is the
 * seed, step 1 the shared step, steps 2–5 the arm's. Every tree is copied to a scratch directory, linked to the
 * skeleton install and evaluated twice:
 * - **frozen**: the instrument at this checkout, exactly as `experiments/pilot-hexddd-01/score-pilot.ts` does
 *   (`firewallEvaluator`, scoring v1.3, `cypher-interp`, the harness tsconfig); every blocking finding goes through
 *   check-correct, and only `correct` ones are counted (the Study 2b rule);
 * - **v1.5**: DETECT-02 (`experiments/detect-02/lib/graph.ts`, read-only) with the same spec; R-D4 and R-XCTX
 *   findings become edge identities (`lib/v15-identity.ts`); the other DETECT-02 families are listed, never counted.
 * Then, per block, with the Study 2b parameters (`STUDY2_S2D01`: edge grain, renames continue, P = step-final union):
 * - `D_frozen` and `D_v15` (frozen ∪ v1.5): new distinct identities at steps 2–5 against step 1;
 * - `D_v15_seed`: the same identities at steps 1–5 against the seed (the HEXDDD-01 `D_seed` reading);
 * - per step: identities present, new, and removed against the step before (snapshot-grain caught-and-fixed);
 * - exposure (writing commands and flagged ones) and the type-check error count.
 * Absolute paths never reach the output.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext } from '../../src/mcp-server/context.js';
import { renameMapBetween } from '../../scripts/lib/drift/git-rename.js';
import { fromBlockingFinding, keysFor, mapFinding } from '../../scripts/lib/drift/identity.js';
import { driftRun, type StepInput } from '../../scripts/lib/drift/study2-d.js';
import { STUDY2_S2D01, type DriftParams, type IdFinding } from '../../scripts/lib/drift/types.js';
import { buildHarnessTsconfig } from '../../scripts/lib/generators/harness-tsconfig.js';
import { engineDeps, engineEnv, taggedEvaluator } from '../../scripts/lib/loop/engine-tee.js';
import { firewallEvaluator } from '../../scripts/lib/loop/evaluator.js';
import { checkFinding } from '../../scripts/v1.3/lib/labelling/correctness.js';
import { findingsOfReport } from '../../scripts/v1.3/lib/labelling/findings.js';
import { SourceFacts } from '../../scripts/v1.3/lib/labelling/source-facts.js';
import { loadSpecView } from '../../scripts/v1.3/lib/labelling/spec-facts.js';
import { loadRules, runTree } from '../detect-02/lib/graph.js';
import { V15_OTHER_RULES, V15_RULES, v15Exposure, v15Identities, withCommandRenames } from './lib/v15-identity.js';

const REPO = process.cwd();
const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

/** D_v15: Study 2b's D (steps 2–5 against step 1). */
export const D_V15: DriftParams = STUDY2_S2D01;
/** The seed reading: seed = step 1, steps 1–5 of the run = 2–6. */
export const D_V15_SEED: DriftParams = { ...STUDY2_S2D01, kFrom: 2, kTo: 6 };

interface StepIn { readonly step: number; readonly dir: string }
interface BlockIn { readonly block: string; readonly task: string; readonly arm: string; readonly spec: string; readonly steps: readonly StepIn[] }

interface Scored {
  readonly step: number;
  readonly ok: boolean;
  readonly frozen: IdFinding[];
  readonly frozenAll: { ruleId: string; file: string; target: string | null; verdict: string }[];
  readonly v15: IdFinding[];
  readonly other: { rule: string; file: string; line: number | null; subject: string; status: string }[];
  readonly v15Raw: { rule: string; file: string; line: number | null; subject: string; evidence: string; status: string; note?: string }[];
  readonly exposure: { opportunities: number; violations: number };
  readonly rootSource: string;
  readonly allowOverlayInTree: boolean;
  readonly typecheckErrors: number | null;
  readonly files: string[];
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

/** Identities of a snapshot, as `driftRun` keys them (edge grain). */
const keysOf = (fs_: readonly IdFinding[]): Set<string> => new Set(fs_.flatMap((f) => keysFor(f, D_V15)));

async function main(): Promise<number> {
  const manifest = arg('manifest');
  const nm = arg('node-modules');
  const outDir = arg('out');
  if (manifest === undefined || nm === undefined || outDir === undefined) {
    process.stderr.write('usage: score-drift.ts --manifest <blocks.json> --node-modules <dir> --out <dir>\n');
    return 2;
  }
  const blocks = (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { blocks: BlockIn[] }).blocks;
  const nodeModules = path.resolve(nm);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-01-score-'));
  const scrub = (s: string): string => s.split(scratch).join('<scratch>').split(REPO).join('.').split(os.tmpdir()).join('<tmp>');
  const env = engineEnv(process.env, 'cypher-interp');
  const deps = engineDeps(buildContext({}, env).evaluateDeps, 'cypher-interp');
  const rules = loadRules();
  const tc = path.join(nodeModules, 'typescript', 'lib', 'tsc.js');
  const out: Record<string, unknown>[] = [];
  let failures = 0;
  let n = 0;
  const cache = new Map<string, Scored>();
  try {
    for (const b of blocks) {
      const specPath = path.resolve(REPO, b.spec);
      const ev = taggedEvaluator(firewallEvaluator(specPath, env, deps, (dir) => `${dir}.tsconfig.json`), 'cypher-interp');
      const spec = await loadSpecView(specPath);
      const contextId = JSON.stringify([b.spec, 'cypher-interp', 'v1.3', 'detect-02/v1.5-exp', head]);
      const repo = path.join(scratch, `g${String(n)}`);
      fs.mkdirSync(repo, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: repo });
      const scored: Scored[] = [];
      const commits: string[] = [];
      for (const s of [...b.steps].sort((x, y) => x.step - y.step)) {
        const key = `${b.spec}|${path.resolve(s.dir)}`;
        // The shared step-1 and seed trees recur in every arm's block: evaluate each tree once.
        let sc = cache.get(key);
        const tree = path.join(scratch, `t${String(n++)}`);
        copyTree(s.dir, tree);
        // An agent-written allowance overlay at the tree root would silence DETECT-02: the scorer never honours one
        // (design note §6, gaming), and records that it was there.
        const overlay = fs.existsSync(path.join(tree, 'detect02.allow.yaml'));
        fs.rmSync(path.join(tree, 'detect02.allow.yaml'), { force: true });
        if (sc === undefined) {
          fs.symlinkSync(nodeModules, path.join(tree, 'node_modules'));
          fs.writeFileSync(`${tree}.tsconfig.json`, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
          let typecheckErrors: number | null = null;
          try {
            execFileSync(process.execPath, [tc, '--noEmit', '--incremental', 'false', '-p', `${tree}.tsconfig.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
            typecheckErrors = 0;
          } catch (e) {
            const o = String((e as { stdout?: string }).stdout ?? '');
            typecheckErrors = (o.match(/error TS\d+/g) ?? []).length;
          }
          const r = await ev.evaluate(tree, `drift-01/${b.block}`);
          const d = await runTree(tree, rules, { spec: specPath, scratch: path.join(scratch, 'd02') });
          if (!r.success) {
            failures++;
            process.stderr.write(`${b.block} step ${String(s.step)}: ${scrub(r.errors.map((e) => e.message).join('; '))}\n`);
          }
          const frozen: IdFinding[] = [];
          const frozenAll: Scored['frozenAll'] = [];
          if (r.success) {
            const e = r.data;
            const reportFindings = findingsOfReport({ violations: e.reportViolations ?? [] }, { projectId: `${b.block}/${String(s.step)}` }, spec.style);
            const facts = new SourceFacts(tree, { tsconfig: 'adr-032' });
            for (const bf of e.blockingFindings) {
              const id = fromBlockingFinding(bf, e.reportViolations);
              const match = reportFindings.find((x) => x.violationId === bf.violationId);
              const c = match === undefined ? { verdict: 'unmatched' } : checkFinding(match, spec, facts);
              if (c.verdict === 'correct') frozen.push(id);
              frozenAll.push({ ruleId: bf.ruleId, file: bf.filePath, target: bf.target ?? null, verdict: c.verdict });
            }
          }
          const ex = v15Exposure(d.findings, d.facts);
          sc = {
            step: s.step, ok: r.success, frozen, frozenAll,
            v15: v15Identities(d.findings, d.facts),
            v15Raw: d.findings.filter((f) => V15_RULES.includes(f.rule)).map((f) => ({ rule: f.rule, file: f.file, line: f.line, subject: f.subject, evidence: f.evidence, status: f.status, ...(f.note !== undefined ? { note: f.note } : {}) })),
            other: d.findings.filter((f) => V15_OTHER_RULES.includes(f.rule)).map((f) => ({ rule: f.rule, file: f.file, line: f.line, subject: f.subject, status: f.status })),
            exposure: { opportunities: ex.opportunities, violations: ex.violations },
            rootSource: d.facts.rootSource,
            allowOverlayInTree: overlay,
            typecheckErrors,
            files: srcFiles(tree),
          };
          cache.set(key, sc);
          fs.rmSync(path.join(tree, 'node_modules'), { force: true });
          fs.rmSync(`${tree}.tsconfig.json`, { force: true });
        }
        scored.push({ ...sc, step: s.step });
        // Commit the tree for the rename map (git diff -M50%, as Study 2b).
        for (const e of fs.readdirSync(repo)) if (e !== '.git') fs.rmSync(path.join(repo, e), { recursive: true, force: true });
        copyTree(tree, repo);
        execFileSync('git', ['add', '-A'], { cwd: repo });
        execFileSync('git', ['-c', 'user.name=drift-01', '-c', 'user.email=drift-01@localhost', 'commit', '-q', '--allow-empty', '-m', `step ${String(s.step)}`], { cwd: repo });
        commits.push(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim());
        fs.rmSync(tree, { recursive: true, force: true });
      }
      const rhos = scored.map((s, i) => (i === 0 ? new Map<string, string>() : withCommandRenames(renameMapBetween(repo, commits[i - 1] as string, commits[i] as string, '.', '').rename, scored[i - 1]?.v15 ?? [])));
      const stepsOf = (sel: (s: Scored) => IdFinding[], shift: number): StepInput[] => scored.filter((s) => s.step + shift >= 1).map((s) => {
        const i = scored.indexOf(s);
        return { step: s.step + shift, final: s.ok ? { id: commits[i] as string, contextId, ok: true, findings: sel(s), files: s.files } : null, ...(i > 0 ? { rename: rhos[i] } : {}) };
      });
      const meta = { runId: b.block, blockId: b.block, cell: b.arm };
      const all = (s: Scored): IdFinding[] => [...s.frozen, ...s.v15];
      const run = (sel: (s: Scored) => IdFinding[], p: DriftParams, shift: number) => {
        const d = driftRun(stepsOf(sel, shift), p, undefined, meta);
        return { D: d.D, Y1: d.Y1, Yk: d.Yk, perStepNew: d.perStep.map((x) => ({ step: x.step - shift, new: x.newCount })), inheritedRemoved: d.inheritedRemoved, incomplete: d.incomplete, renameMapMissing: d.renameMapMissing };
      };
      // Snapshot-grain caught-and-fixed: identities present at the step before and gone now (after ρ).
      const perStep = scored.map((s, i) => {
        const prev = i > 0 ? scored[i - 1] : undefined;
        const now = keysOf(all(s));
        const before = prev === undefined ? new Set<string>() : keysOf(all(prev).map((f) => mapFinding(f, rhos[i] as Map<string, string>)));
        const v15Now = keysOf(s.v15);
        const v15Before = prev === undefined ? new Set<string>() : keysOf(prev.v15.map((f) => mapFinding(f, rhos[i] as Map<string, string>)));
        return {
          step: s.step, ok: s.ok, typecheckErrors: s.typecheckErrors, rootSource: s.rootSource, allowOverlayInTree: s.allowOverlayInTree,
          identities: now.size, v15Identities: v15Now.size, frozenIdentities: keysOf(s.frozen).size,
          removedVsPrevious: prev === undefined ? null : [...before].filter((k) => !now.has(k)).length,
          v15RemovedVsPrevious: prev === undefined ? null : [...v15Before].filter((k) => !v15Now.has(k)).length,
          v15NewVsPrevious: prev === undefined ? null : [...v15Now].filter((k) => !v15Before.has(k)).length,
          exposure: s.exposure,
          v15Keys: [...v15Now].sort(), frozenKeys: [...keysOf(s.frozen)].sort(),
          v15Findings: s.v15Raw, otherDetect02: s.other, frozenBlocking: s.frozenAll,
        };
      });
      out.push({
        block: b.block, task: b.task, arm: b.arm, spec: b.spec,
        D_frozen: run((s) => s.frozen, D_V15, 0),
        D_v15: run(all, D_V15, 0),
        D_v15_only: run((s) => s.v15, D_V15, 0),
        D_v15_seed: run(all, D_V15_SEED, 1),
        D_v15_only_seed: run((s) => s.v15, D_V15_SEED, 1),
        steps: perStep,
      });
      const last = out[out.length - 1] as { D_v15: { D: number | null }; D_frozen: { D: number | null }; D_v15_seed: { D: number | null } };
      process.stdout.write(`${b.block} [${b.arm}]: D_v15 ${String(last.D_v15.D)} (frozen ${String(last.D_frozen.D)}), D_v15_seed ${String(last.D_v15_seed.D)}\n`);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  const params = { instrumentCommit: head, engine: 'cypher-interp', scoringMode: 'v1.3', detect02: 'detect-02/v1.5-exp', counted: { frozen: 'check-correct verdict correct', v15: 'status violation (R-D4, R-XCTX)' }, D_v15: D_V15, D_v15_seed: D_V15_SEED, evaluationFailures: failures, modelCalls: 0 };
  fs.writeFileSync(path.join(outDir, 'scores.json'), `${scrub(JSON.stringify({ schema: 'drift-01-scores/v1', version: 'v1.5-exp', params, blocks: out }, null, 1))}\n`);
  return failures > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith('score-drift.ts') === true) {
  main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 2; });
}
