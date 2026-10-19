/**
 * v1.4 Tier A (REV-04 P15, P19, gate D8): offline re-score of the kept agent-code snapshots. Entry file: no exports.
 * Report: `Docs/DiagnosticRuns/v1.4-ddd-b2-t1-and-parity-2026-10-19.md`.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/ddd-b2-t1-rescore.ts --engine cypher-interp|neo4j --work <scratch dir> --node-modules <skeleton node_modules>
 *     [--dest results/v1.4-ddd-b2-t1]
 *
 * Zero model calls, no agent re-run. Every evaluation is the firewall CLI (`evaluate --symbolic-only --scoring v1.3`,
 * pinned harness tsconfig, `--format json`) on a step's final snapshot. Neo4j: NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD;
 * the cross-process Neo4j lock is held for the whole run (the CLI children re-enter it).
 *
 * Subjects:
 * - `ddd`: the loop pilot's 8 DDD snapshots (`relief-volunteers`, arms none and gate, steps 1-4, from each run's
 *   `snapshots.git`), each against four spec variants built from the run's own frozen spec (`buildDddSpecs`):
 *   `a0` (frozen spec, `--empty-aggregates not-applicable`: #229 option a), `a0-acl0` (the same with `acl: []`),
 *   `dc` (frozen spec plus the per-task aggregate declaration `DECLARED_AGGREGATES`, the D-c mode, default policy)
 *   and `dc-acl0` (the same with `acl: []`);
 * - `loop-static`: the 16 Clean and Hexagonal loop snapshots against their recorded static spec;
 * - `layered`: probe 1's 14 Layered `none` snapshots (`results/v1.3-floor-probe/<task>/none/snapshots/step-NN/src`)
 *   against `presets/layered.yaml` (the loop has no Layered style).
 * Each one with `--post-seal off` (the sealed v1.3 rule set) and `--post-seal on` (plus the post-seal overlay).
 *
 * Writes under <dest>/<engine>/: `cli/<subject>/<run>/<variant>/<post-seal>/step-NN.json` (the CLI result without the
 * run-volatile fields, the scratch tree as `<project>`, the layout `cypher-interp-compare-runs.ts` reads), `rows.json`
 * (one row per evaluation), `drift.json` (new blocking identities per step: the pilot memo identity and the drift-D
 * edge grain). `<work>/check-correct-jobs-<engine>.json` lists the reports holding a new blocking finding and the
 * finding keys, for `scripts/v1.3/check-correct.ts` (absolute scratch paths, so not committed).
 * The spec variants go to <dest>/specs/. Snapshots and frozen specs are read, never written.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildChildEnv } from '../../src/shared/process/node-process-runner.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { buildHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { driftRun } from '../lib/drift/study2-d.js';
import { STUDY2_S2D01 } from '../lib/drift/types.js';
import type { IdFinding } from '../lib/drift/types.js';
import { findingsOfReport } from '../v1.3/lib/labelling/findings.js';
import type { Finding } from '../v1.3/lib/labelling/findings.js';

const REPO = process.cwd();
const PILOT = 'experiments/loop-pilot/run-2026-10-16/outputs/runs';
const PROBE = 'results/v1.3-floor-probe';
const LAYERED_TASKS = ['market-vendors', 'youth-league', 'hive-health'] as const;
const VOLATILE_KEYS = new Set(['runId', 'durationMs', 'executionTimeMs', 'timings']);

/**
 * The per-task aggregate declaration for `relief-volunteers` (D-c, chronology row 12), written from the task text
 * (`experiments/loop-pilot/pilot-tasks.json`, step 1) and not from the agents' trees: the registry keeps volunteers
 * with their skills and certifications; deployment planning keeps incidents with the shifts each needs (assignments
 * are part of the shift). One aggregate per context, so the module is the context's domain folder. The root and inner
 * entities are matched by name, in any case and any file-naming convention (`**?olunteer*.ts` matches
 * `volunteer.ts`, `Volunteer.ts` and `volunteer-record.ts`): the declaration names the domain concepts, not the
 * agent's files. A proposal for the author to sign, not the author's declaration.
 */
const DECLARED_AGGREGATES = `    aggregates:
      - name: Volunteer
        context: registry
        module: src/registry/domain/**
        root: src/registry/domain/**?olunteer*.ts
        inner_entities:
          - src/registry/domain/**?kill*.ts
          - src/registry/domain/**?ertification*.ts
      - name: Incident
        context: deployment
        module: src/deployment/domain/**
        root: src/deployment/domain/**?ncident*.ts
        inner_entities:
          - src/deployment/domain/**?hift*.ts
          - src/deployment/domain/**?ssignment*.ts
`;

type Engine = 'cypher-interp' | 'neo4j';
interface Snap { step: number; label: string; kind: 'git' | 'dir'; runDir?: string; commit?: string; srcDir?: string }
interface Variant { id: string; spec: string; policy?: string }
interface Subject { subject: string; style: string; run: string; arm: string; snaps: Snap[]; variants: Variant[] }

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : fallback;
  if (v === undefined) throw new Error(`--${name} is required`);
  return v;
}

/** The four DDD spec variants of one run, written beside each other; returns their repository-relative paths. */
function buildDddSpecs(frozen: string, dest: string, arm: string): Record<string, string> {
  const text = fs.readFileSync(frozen, 'utf8');
  if (!text.includes('    aggregates: []\n')) throw new Error(`${frozen}: no empty aggregates line`);
  const acl0 = (t: string): string => {
    const out = t.replace(/ {8}acl:\n {10}- src\/(registry|deployment)\/acl\/\*\*\n/g, '        acl: []\n');
    if ((out.match(/ {8}acl: \[\]\n/g) ?? []).length !== 2) throw new Error(`${frozen}: expected two acl blocks`);
    return out;
  };
  const header = (v: string): string => `# v1.4 B2/T1 spec variant ${v} (scripts/v1.4/ddd-b2-t1-rescore.ts), built from ${path.relative(REPO, frozen)}.\n`;
  const dc = text.replace('    aggregates: []\n', DECLARED_AGGREGATES);
  const variants: Record<string, string> = { a0: text, 'a0-acl0': acl0(text), dc, 'dc-acl0': acl0(dc) };
  const out: Record<string, string> = {};
  fs.mkdirSync(path.join(dest, 'specs', 'relief-volunteers', arm), { recursive: true });
  for (const [v, t] of Object.entries(variants)) {
    const p = path.join(dest, 'specs', 'relief-volunteers', arm, `${v}.yaml`);
    fs.writeFileSync(p, header(v) + t);
    out[v] = p;
  }
  return out;
}

interface StepRec { stepIndex: number; spec: { taskId: string; arm: string }; finalCommit: string; evaluatorSpec?: { kind: string; path: string } }

function subjects(dest: string): Subject[] {
  const out: Subject[] = [];
  const runsRoot = path.join(REPO, PILOT, 'claude-code-cli', 'claude-sonnet-5-5');
  for (const task of ['relief-volunteers', 'market-vendors', 'shelter-adoptions']) {
    for (const arm of ['none', 'gate']) {
      const runDir = path.join(runsRoot, task, arm, 'run-0');
      const recs = fs.readdirSync(path.join(runDir, 'steps')).filter((f) => /^step-\d\d\.json$/.test(f)).sort()
        .map((f) => JSON.parse(fs.readFileSync(path.join(runDir, 'steps', f), 'utf8')) as StepRec);
      const snaps: Snap[] = recs.map((r) => ({ step: r.stepIndex + 1, label: `step-${String(r.stepIndex + 1).padStart(2, '0')}`, kind: 'git', runDir, commit: r.finalCommit }));
      const ev = recs[0]?.evaluatorSpec;
      if (ev === undefined) throw new Error(`${runDir}: no evaluatorSpec`);
      if (ev.kind === 'frozen-after-step-1') {
        const specs = buildDddSpecs(path.resolve(runDir, ev.path), dest, arm);
        out.push({ subject: 'ddd', style: 'ddd', run: `${task}/${arm}`, arm, snaps, variants: [
          { id: 'a0', spec: specs.a0 ?? '', policy: 'not-applicable' },
          { id: 'a0-acl0', spec: specs['a0-acl0'] ?? '', policy: 'not-applicable' },
          { id: 'dc', spec: specs.dc ?? '' },
          { id: 'dc-acl0', spec: specs['dc-acl0'] ?? '' },
        ] });
      } else {
        out.push({ subject: 'loop-static', style: task === 'market-vendors' ? 'clean-architecture' : 'hexagonal', run: `${task}/${arm}`, arm, snaps, variants: [{ id: 'static', spec: path.resolve(REPO, ev.path) }] });
      }
    }
  }
  for (const task of LAYERED_TASKS) {
    const base = path.join(REPO, PROBE, task, 'none', 'snapshots');
    const snaps: Snap[] = fs.readdirSync(base).filter((d) => /^step-\d\d$/.test(d)).sort()
      .map((d) => ({ step: Number(d.slice(5)), label: d, kind: 'dir', srcDir: path.join(base, d, 'src') }));
    out.push({ subject: 'layered', style: 'layered', run: `${task}/none`, arm: 'none', snaps, variants: [{ id: 'preset', spec: path.join(REPO, 'presets', 'layered.yaml') }] });
  }
  return out;
}

/** The snapshot as a project tree in scratch: its source, the skeleton `node_modules` link, the harness tsconfig. */
function materialise(s: Snap, tree: string, nodeModules: string): string {
  fs.rmSync(tree, { recursive: true, force: true });
  fs.mkdirSync(tree, { recursive: true });
  if (s.kind === 'git') {
    const tar = execFileSync('git', ['--git-dir', path.join(s.runDir ?? '', 'snapshots.git'), 'archive', s.commit ?? ''], { maxBuffer: 256 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', tree], { input: tar });
  } else {
    fs.cpSync(s.srcDir ?? '', path.join(tree, 'src'), { recursive: true });
    fs.copyFileSync(path.join(REPO, 'scripts', 'generator', 'skeleton', 'package.json'), path.join(tree, 'package.json'));
  }
  fs.symlinkSync(nodeModules, path.join(tree, 'node_modules'));
  const tsconfig = `${tree}.tsconfig.json`;
  fs.writeFileSync(tsconfig, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
  return tsconfig;
}

function stable(v: unknown, tree: string): unknown {
  if (typeof v === 'string') return v.split(tree).join('<project>');
  if (Array.isArray(v)) return v.map((x) => stable(x, tree));
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !VOLATILE_KEYS.has(k)).map(([k, x]) => [k, stable(x, tree)]));
  return v;
}

interface Report { violations: unknown[]; warnings?: { code: string; message: string }[]; disabledFunctions?: unknown[]; tiers: { style: string; verdict: string; blockingAhs: number; blocking: { violationCount: number; rules: { functionId: string; violationCount: number }[] }; advisory: { violationCount: number; rules: { functionId: string; violationCount: number }[] } } }

function evaluate(engine: Engine, tree: string, spec: string, tsconfig: string, postSeal: string, policy: string | undefined): { report?: Report; error?: string } {
  const env = buildChildEnv(process.env, engine === 'neo4j' ? ['PATH', 'HOME', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'DAEDALUS_NEO4J_LOCK_DIR'] : ['PATH', 'HOME']);
  const argv = ['tsx', path.join(REPO, 'bin/firewall.ts'), 'evaluate', '--post-seal', postSeal, '--project', tree, '--spec', spec, '--symbolic-only',
    '--scoring', 'v1.3', '--tsconfig', tsconfig, '--format', 'json', '--engine', engine, ...(policy !== undefined ? ['--empty-aggregates', policy] : [])];
  try {
    const out = execFileSync('npx', argv, { cwd: REPO, env, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    return { report: JSON.parse(out.toString('utf8')) as Report };
  } catch (e) {
    // The CLI exits 1 on a hard-block verdict with the report on stdout; only an empty stdout is a failure.
    const stdout = (e as { stdout?: Buffer }).stdout?.toString('utf8') ?? '';
    if (stdout.trim().startsWith('{')) return { report: JSON.parse(stdout) as Report };
    const stderr = (e as { stderr?: Buffer }).stderr?.toString('utf8') ?? String(e);
    return { error: stderr.split('\n').filter((l) => l.trim() !== '').slice(-1).join(' ').split(tree).join('<project>') };
  }
}

/** The pilot memo's identity (`loop-pilot-analyse.ts`): rule, template, file, target; a cycle by its file set. */
function memoIdentity(f: Finding): string {
  if (f.template === 'no-cyclic-deps') {
    const files = new Set<string>([f.file, ...(f.target !== undefined ? [f.target] : []), ...f.evidence.filter((e) => e.endsWith('.ts'))]);
    return JSON.stringify([f.ruleId, f.template, 'cycle', [...files].sort()]);
  }
  return JSON.stringify([f.ruleId, f.template, f.file, f.target ?? null]);
}

function blockingOf(report: Report, projectId: string): Finding[] {
  const ids = new Set(report.tiers.blocking.rules.map((r) => String(r.functionId)));
  // FF-P06 FLOWS_TO rows are N/A (rule-tiers finding 9), as in the memo.
  return findingsOfReport(report, { projectId }, report.tiers.style).filter((f) => ids.has(f.ruleId) && !(f.ruleId === 'FF-P06' && f.discriminator.includes('FLOWS_TO')));
}

async function main(): Promise<void> {
  const engine = arg('engine') as Engine;
  if (engine !== 'cypher-interp' && engine !== 'neo4j') throw new Error('--engine must be cypher-interp or neo4j');
  const work = path.resolve(arg('work'));
  const nodeModules = path.resolve(arg('node-modules'));
  const dest = path.resolve(arg('dest', 'results/v1.4-ddd-b2-t1'));
  const out = path.join(dest, engine);
  fs.rmSync(path.join(out, 'cli'), { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const lock = engine === 'neo4j' ? await acquireNeo4jLock(process.env.NEO4J_URI ?? '', { label: 'v1.4 ddd-b2-t1-rescore', onWait: (t) => process.stderr.write(`${t}\n`) }) : undefined;
  const rows: Record<string, unknown>[] = [];
  const drift: Record<string, unknown>[] = [];
  const jobs = new Map<string, Record<string, unknown>>();
  const newKeys: string[] = [];
  try {
    for (const sub of subjects(dest)) {
      for (const postSeal of ['off', 'on']) {
        const series = new Map<string, { step: number; label: string; findings: Finding[] | null; tree: string; spec: string; reportPath: string }[]>();
        for (const s of sub.snaps) {
          const tree = path.join(work, sub.subject, sub.run, s.label);
          const tsconfig = materialise(s, tree, nodeModules);
          for (const v of sub.variants) {
            const t0 = Date.now();
            const { report, error } = evaluate(engine, tree, v.spec, tsconfig, postSeal, v.policy);
            const ms = Date.now() - t0;
            const rel = path.join('cli', sub.subject, sub.run, v.id, postSeal, `${s.label}.json`);
            const base = { engine, subject: sub.subject, style: sub.style, run: sub.run, arm: sub.arm, variant: v.id, postSeal, step: s.step, spec: path.relative(REPO, v.spec), ms };
            const list = series.get(v.id) ?? [];
            series.set(v.id, list);
            if (report === undefined) {
              rows.push({ ...base, scored: false, error });
              list.push({ step: s.step, label: s.label, findings: null, tree, spec: v.spec, reportPath: '' });
              process.stdout.write(`${engine} ${sub.run} ${v.id} ${postSeal} ${s.label}: unscored (${String(error)})\n`);
              continue;
            }
            fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
            fs.writeFileSync(path.join(out, rel), `${JSON.stringify(stable(report, tree), null, 1)}\n`);
            const blocking = blockingOf(report, `${sub.run}/${v.id}/${postSeal}/${s.label}`);
            list.push({ step: s.step, label: s.label, findings: blocking, tree, spec: v.spec, reportPath: path.join(out, rel) });
            rows.push({
              ...base, scored: true, report: path.relative(REPO, path.join(out, rel)), verdict: report.tiers.verdict, blockingAhs: report.tiers.blockingAhs,
              blocking: blocking.length, blockingRulesRun: report.tiers.blocking.rules.map((r) => String(r.functionId)).sort(),
              blockingByRule: Object.fromEntries(report.tiers.blocking.rules.map((r) => [String(r.functionId), r.violationCount])),
              blockingFindings: blocking.map((f) => ({ ruleId: f.ruleId, template: f.template, file: f.file, target: f.target ?? null })),
              advisory: report.tiers.advisory.violationCount,
              disabledFunctions: (report.disabledFunctions ?? []).map((d) => (typeof d === 'object' && d !== null ? String((d as { functionId?: unknown }).functionId ?? JSON.stringify(d)) : String(d))),
              recordWarnings: (report.warnings ?? []).filter((w) => w.code === 'COMPILER_004' || w.code === 'COMPILER_006').map((w) => `${w.code}: ${w.message}`),
            });
            process.stdout.write(`${engine} ${sub.run} ${v.id} ${postSeal} ${s.label}: blocking ${String(blocking.length)} (${String(ms)} ms)\n`);
          }
        }
        // New blocking identities per step: the memo identity, and drift D's edge grain (STUDY2_S2D01, k = 4 here).
        for (const [variant, steps] of series) {
          const sorted = [...steps].sort((a, b) => a.step - b.step);
          const seen = new Set<string>();
          const perStep: { step: number; Y: number | null; newIdentities: unknown[] | null }[] = [];
          for (const st of sorted) {
            if (st.findings === null) {
              perStep.push({ step: st.step, Y: null, newIdentities: null });
              continue;
            }
            const ids = new Map(st.findings.map((f) => [memoIdentity(f), f]));
            const fresh = st.step >= 2 ? [...ids].filter(([id]) => !seen.has(id)) : [];
            for (const id of ids.keys()) seen.add(id);
            perStep.push({ step: st.step, Y: ids.size, newIdentities: fresh.map(([id, f]) => ({ identity: JSON.parse(id) as unknown, key: f.key, message: f.message })) });
            for (const [, f] of fresh) {
              newKeys.push(f.key);
              // The job's project id is the one the findings were keyed with, so check-correct's keys match.
              jobs.set(st.reportPath, { projectId: `${sub.run}/${variant}/${postSeal}/${st.label}`, projectRoot: st.tree, spec: st.spec, report: st.reportPath, style: sub.style, tsconfig: 'adr-032' });
            }
          }
          const toId = (f: Finding): IdFinding => ({ functionId: f.ruleId, filePath: f.file, ...(f.target !== undefined && { target: f.target }), discriminator: f.discriminator, tier: 'blocking', template: f.template });
          const edge = driftRun(sorted.map((st) => ({ step: st.step, final: st.findings === null ? null : { id: st.label, contextId: JSON.stringify([variant, postSeal, engine]), ok: true, findings: st.findings.map(toId) } })),
            { ...STUDY2_S2D01, kTo: sorted.at(-1)?.step ?? 4, renamePolicy: 'end' });
          const memoD = perStep.some((p) => p.newIdentities === null) ? null : perStep.reduce((a, p) => a + (p.newIdentities?.length ?? 0), 0);
          drift.push({ engine, subject: sub.subject, style: sub.style, run: sub.run, arm: sub.arm, variant, postSeal, Y1: perStep[0]?.Y ?? null, memoD, perStep, edgeGrain: { Y1: edge.Y1, D: edge.D, perStep: edge.perStep } });
        }
      }
    }
  } finally {
    lock?.release();
  }
  const scrub = (v: unknown): unknown => JSON.parse(JSON.stringify(v).split(work).join('<work>').split(REPO).join('.'));
  fs.writeFileSync(path.join(out, 'rows.json'), `${JSON.stringify(scrub(rows), null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'drift.json'), `${JSON.stringify(scrub(drift), null, 1)}\n`);
  // Absolute paths: check-correct reads the trees in scratch. Not committed.
  fs.writeFileSync(path.join(work, `check-correct-jobs-${engine}.json`), `${JSON.stringify({ schemaVersion: 1, kind: 'custom', jobs: [...jobs.values()], newKeys }, null, 1)}\n`);
  process.stdout.write(`wrote ${path.relative(REPO, out)}: ${String(rows.length)} evaluations, ${String(rows.filter((r) => r.scored === false).length)} unscored, ${String(newKeys.length)} new blocking findings\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
