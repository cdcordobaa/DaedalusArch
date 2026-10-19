/**
 * TIER-A1: Study 2's drift outcome D recomputed on every committed run with per-step scored snapshots, plus gate D9
 * (the D analysis end to end with a planted effect). Entry file: no exports. Zero calls: no model, no Neo4j, no
 * evaluator run (every snapshot already has a committed per-step evaluation). One process.
 * Report: Docs/DiagnosticRuns/v1.4-drift-on-existing-data-2026-10-19.md.
 *
 * Usage (repository root): npx tsx scripts/v1.4/drift-existing.ts [--sims 2000] [--seed 20261019]
 *
 * D, Y1 and Yk come from `driftRun` (`scripts/lib/drift/study2-d.ts`) under `STUDY2_S2D01` (edge grain, kFrom 2,
 * kTo 5). A finding counts only if `check-correct` labelled it `correct` (the committed correctness files); a finding
 * with no label is not counted and is listed. Secondary grains: the pilot memo's identity (`MEMO_COMPAT` with kTo 5)
 * and G08's cycle-as-directed-edge-set.
 *
 * Reads (read-only):
 * - results/v1.3-floor-probe/<task>/{none/step-NN.json, tool/step-NN.post.json}, correctness/correctness.json;
 * - results/v1.3-floor-probe-2/<task>/<C1|C2|C3>/step-NN.json, correctness/correctness.json;
 * - experiments/v1.3-floor-probe-3/run-2026-10-16/{outputs/runs/**}/steps/step-NN.json and analysis/reports/**;
 * - experiments/loop-pilot/run-2026-10-16/{outputs/runs/**}/steps/step-NN.json and analysis/reports/**.
 * Writes results/v1.4-drift-existing/{runs.json, runs.csv, d9.json} (canonical JSON).
 *
 * D9 (not a pre-registration; the registered protocol is unchanged): blocks of three cells (none@L2, none@L3,
 * mcp@L2) share one real step-1 tree from probe 1's Layered `none` runs. Each cell's count of new identities is drawn
 * NB(μ, θ) with s2d-01's inputs (μ 2.67, θ 4.27), materialised as findings (the source run's real new identities in
 * their real order first, synthetic edges beyond them), and a planted effect removes each new identity of the treated
 * cell with probability f. D is then computed by `driftRun` on the materialised snapshots, and the block differences
 * go through the registered test (two-sided block sign-flip, 99,999 flips, Holm over H1 and H2), using `nbDraw`,
 * `signFlipSimP` and `holmReject` of `scripts/v1.3/lib/level-power-sim.ts` unchanged.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { canonicalize } from '../lib/canonical-json.js';
import { driftRun, fromProbeStepFile, type ProbeStepFile, type StepInput } from '../lib/drift/study2-d.js';
import { MEMO_COMPAT, STUDY2_S2D01, type DriftParams, type DriftRun, type IdFinding, type Snapshot } from '../lib/drift/types.js';
import { createRng, type SeededRng } from '../lib/stats.js';
import { FLIPS, holmReject, nbDraw, signFlipExactP, signFlipSimP } from '../v1.3/lib/level-power-sim.js';
import { gamma, poisson } from '../v1.3/lib/study2-power.js';

const OUT = 'results/v1.4-drift-existing';
const P1 = 'results/v1.3-floor-probe';
const P2 = 'results/v1.3-floor-probe-2';
const P3 = 'experiments/v1.3-floor-probe-3/run-2026-10-16';
const LP = 'experiments/loop-pilot/run-2026-10-16';
const MODEL_RUNS = 'runs/claude-code-cli/claude-sonnet-5-5';

const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? dflt) : dflt;
};
const SIMS = Number(arg('sims', '2000'));
const SEED = Number(arg('seed', '20261019'));

const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;

const MEMO_K5: DriftParams = { ...MEMO_COMPAT, kTo: 5 };
const G08_EDGESET: DriftParams = { ...STUDY2_S2D01, cycleIdentity: 'edge-set' };
/** Rule id → template, as check-correct names them (correctness.csv of probes 1 and 2); the memo key needs it. */
const TEMPLATE: Readonly<Record<string, string>> = { 'FF-S01': 'dependency-direction', 'FF-S02': 'no-cyclic-deps', 'FF-S03': 'no-layer-skip' };

// ── check-correct labels ────────────────────────────────────────────────────

interface Label { projectId: string; ruleId: string; file: string; verdict: string }
type Labels = Map<string, string[]>;
const labelKey = (projectId: string, ruleId: string, file: string): string => `${projectId}#${ruleId}#${file}`;

function loadLabels(file: string): Labels {
  const m: Labels = new Map();
  for (const r of readJson<{ results: Label[] }>(file).results) {
    const k = labelKey(r.projectId, r.ruleId, r.file);
    m.set(k, [...(m.get(k) ?? []), r.verdict]);
  }
  return m;
}

interface Labelled { finding: IdFinding; verdict: string | null }

/** Joins each finding to its label by (project, rule, file); check-correct labels one row per finding, so the multiset must match. */
function label(projectId: string, findings: readonly IdFinding[], labels: Labels | null): Labelled[] {
  if (findings.length === 0) return [];
  const pool = new Map<string, string[]>();
  return findings.map((f) => {
    const k = labelKey(projectId, f.functionId, f.filePath);
    if (!pool.has(k)) pool.set(k, [...(labels?.get(k) ?? [])]);
    const v = pool.get(k)?.shift() ?? null;
    return { finding: f, verdict: v };
  });
}

// ── Run loaders ─────────────────────────────────────────────────────────────

interface RunSpec {
  source: string;
  runId: string;
  task: string;
  style: string;
  generator: string;
  arm: string;
  steps: StepInput[];
  /** Per-step labels; a finding with verdict !== 'correct' is not counted. */
  labelled: Labelled[];
  unscoredReason?: string;
}

const withTemplate = (f: IdFinding): IdFinding => ({ ...f, ...(TEMPLATE[f.functionId] !== undefined && { template: TEMPLATE[f.functionId] }) });

function probeSteps(dir: string, pattern: RegExp, projectPrefix: string, labels: Labels | null): { steps: StepInput[]; labelled: Labelled[] } {
  const files = fs.readdirSync(dir).filter((f) => pattern.test(f)).sort();
  const steps: StepInput[] = [];
  const labelled: Labelled[] = [];
  for (const f of files) {
    const s = fromProbeStepFile(readJson<ProbeStepFile>(path.join(dir, f)));
    const final = s.final as Snapshot;
    const findings = final.findings.map(withTemplate);
    labelled.push(...label(`${projectPrefix}/step-${String(s.step).padStart(2, '0')}`, findings, labels));
    // ρ is empty: the probe snapshots are plain directories (ID-9).
    steps.push({ ...s, final: { ...final, findings }, ...(s.step > 1 && { rename: new Map() }) });
  }
  return { steps, labelled };
}

const P1_TASKS: readonly { task: string; style: string }[] = [
  { task: 'market-vendors', style: 'layered' }, { task: 'youth-league', style: 'layered' }, { task: 'hive-health', style: 'layered' },
  { task: 'shelter-adoptions', style: 'hexagonal' }, { task: 'garden-plots', style: 'hexagonal' }, { task: 'food-bank', style: 'hexagonal' },
];
const P2_TASKS: readonly { task: string; style: string }[] = [{ task: 'shelter-adoptions', style: 'hexagonal' }, { task: 'market-vendors', style: 'clean' }];

interface Report { violations: { functionId: string; filePath: string; target?: string; discriminator?: string[] }[]; tiers: { style: string; scoringMode: string; blocking: { rules: { functionId: string }[] } }; specVersion?: string }
interface StepRec { stepIndex: number; finalCommit: string; spec: { taskId: string; arm: string }; evaluatorSpec?: { kind: string; path: string } | null; turns: { snapshot?: { evaluation?: { blockingFindings: unknown[] } | null } }[] }

/** A harness run (probe 3, loop pilot): the step records give the steps; the committed re-evaluation reports give the findings. */
function harnessRun(root: string, task: string, arm: string, style: string, source: string): RunSpec {
  const runRel = `${task}/${arm}/run-0`;
  const runDir = path.join(root, 'outputs', MODEL_RUNS, runRel);
  const repDir = path.join(root, 'analysis/reports/claude-code-cli/claude-sonnet-5-5', runRel);
  const steps: StepInput[] = [];
  let unscoredReason: string | undefined;
  for (const f of fs.readdirSync(path.join(runDir, 'steps')).filter((x) => /^step-\d\d\.json$/.test(x)).sort()) {
    const rec = readJson<StepRec>(path.join(runDir, 'steps', f));
    const step = rec.stepIndex + 1;
    const rp = path.join(repDir, f);
    if (!fs.existsSync(rp)) {
      unscoredReason = 'no re-evaluation report: DDD spec defect T1 (spec does not freeze), not fixed here';
      steps.push({ step, final: null, ...(step > 1 && { rename: new Map() }) });
      continue;
    }
    const rep = readJson<Report>(rp);
    const blocking = new Set(rep.tiers.blocking.rules.map((r) => r.functionId));
    const findings: IdFinding[] = rep.violations.filter((v) => blocking.has(v.functionId)).map((v) => withTemplate({
      functionId: v.functionId, filePath: v.filePath, ...(v.target !== undefined && { target: v.target }),
      ...(v.discriminator !== undefined && { discriminator: v.discriminator }), tier: 'blocking',
    }));
    // ρ: no blocking finding exists in any scored harness snapshot (checked below), so D does not depend on it.
    steps.push({
      step,
      final: { id: rec.finalCommit, contextId: JSON.stringify([rec.evaluatorSpec?.path ?? null, rep.tiers.style, rep.tiers.scoringMode]), ok: true, findings },
      ...(step > 1 && { rename: new Map() }),
    });
  }
  const labelled = steps.flatMap((s) => (s.final?.findings ?? []).map((finding) => ({ finding, verdict: null })));
  return { source, runId: `${source}/${runRel}`, task, style, generator: 'claude-sonnet-5-5 (loop harness)', arm, steps, labelled, ...(unscoredReason !== undefined && { unscoredReason }) };
}

function loadRuns(): RunSpec[] {
  const runs: RunSpec[] = [];
  const l1 = loadLabels(`${P1}/correctness/correctness.json`);
  for (const t of P1_TASKS) {
    const none = probeSteps(path.join(P1, t.task, 'none'), /^step-\d\d\.json$/, `${t.task}/none`, l1);
    runs.push({ source: 'probe-1', runId: `probe-1/${t.task}/none`, task: t.task, style: t.style, generator: 'Opus, one session by hand', arm: 'none', ...none });
    // The tool arm's step-final tree is the post-fix tree. check-correct labelled the none arm only; the post-fix
    // snapshots hold no blocking finding (asserted below), so no label is needed.
    const tool = probeSteps(path.join(P1, t.task, 'tool'), /^step-\d\d\.post\.json$/, `${t.task}/tool`, null);
    runs.push({ source: 'probe-1', runId: `probe-1/${t.task}/tool`, task: t.task, style: t.style, generator: 'Opus, one session by hand', arm: 'daedalus-mcp (tool, post-fix)', ...tool });
  }
  const l2 = loadLabels(`${P2}/correctness/correctness.json`);
  for (const t of P2_TASKS) {
    for (const c of ['C1', 'C2', 'C3']) {
      const r = probeSteps(path.join(P2, t.task, c), /^step-\d\d\.json$/, `${t.task}/${c}`, l2);
      runs.push({ source: 'probe-2', runId: `probe-2/${t.task}/${c}`, task: t.task, style: t.style, generator: 'Opus, one session by hand', arm: `none (frame ${c})`, ...r });
    }
  }
  runs.push(harnessRun(P3, 'repair-cafe', 'none', 'hexagonal', 'probe-3'));
  runs.push(harnessRun(P3, 'school-bus', 'none', 'clean', 'probe-3'));
  runs.push(harnessRun(P3, 'vineyard-harvest', 'none', 'ddd', 'probe-3'));
  for (const arm of ['none', 'gate']) {
    runs.push(harnessRun(LP, 'market-vendors', arm, 'clean', 'loop-pilot'));
    runs.push(harnessRun(LP, 'shelter-adoptions', arm, 'hexagonal', 'loop-pilot'));
    runs.push(harnessRun(LP, 'relief-volunteers', arm, 'ddd', 'loop-pilot'));
  }
  return runs;
}

// ── Per-run analysis ────────────────────────────────────────────────────────

interface Row {
  source: string; runId: string; task: string; style: string; generator: string; arm: string;
  scored: boolean; unscoredReason: string | null; steps: number; kUsed: number | null;
  Y1: number | null; Y1fine: number | null; D: number | null; Ylast: number | null;
  perStepNew: (number | null)[]; inheritedRemoved: number | null;
  Dmemo: number | null; Dg08EdgeSet: number | null;
  findings: number; correct: number; notCounted: { verdict: string | null; rule: string; file: string; target: string | null }[];
}

function analyse(r: RunSpec): Row {
  const correct = new Set(r.labelled.filter((l) => l.verdict === 'correct').map((l) => l.finding));
  const counted = (f: IdFinding): boolean => correct.has(f);
  const scored = r.steps.every((s) => s.final !== null) && r.steps.length > 0;
  const meta = { runId: r.runId, blockId: `${r.source}/${r.task}`, cell: r.arm };
  const d: DriftRun = driftRun(r.steps, STUDY2_S2D01, counted, meta);
  const memo = driftRun(r.steps, MEMO_K5, counted, meta);
  const g08 = driftRun(r.steps, G08_EDGESET, counted, meta);
  const notCounted = r.labelled.filter((l) => l.verdict !== 'correct').map((l) => ({ verdict: l.verdict, rule: l.finding.functionId, file: l.finding.filePath, target: l.finding.target ?? null }));
  return {
    source: r.source, runId: r.runId, task: r.task, style: r.style, generator: r.generator, arm: r.arm,
    scored, unscoredReason: r.unscoredReason ?? null, steps: r.steps.length, kUsed: scored ? Math.min(r.steps.length, STUDY2_S2D01.kTo) : null,
    Y1: d.Y1, Y1fine: d.Y1fine, D: d.D, Ylast: d.Yk,
    perStepNew: d.perStep.map((p) => p.newCount), inheritedRemoved: d.inheritedRemoved,
    Dmemo: memo.D, Dg08EdgeSet: g08.D,
    findings: r.labelled.length, correct: correct.size, notCounted,
  };
}

// ── D9: planted effect ──────────────────────────────────────────────────────

/** The s2d-01 §3 inputs: probe-1 none D at k = 5 is 1, 2, 5; mean 2.67, θ by moments 4.27. */
const MU = 8 / 3;
const THETA = (MU * MU) / (13 / 3 - MU);
const BLOCKS = 32;
const CELLS = ['noneL2', 'noneL3', 'mcpL2'] as const;
type Cell = (typeof CELLS)[number];
const HYP = [{ id: 'H1', a: 'noneL2', b: 'noneL3' }, { id: 'H2', a: 'noneL2', b: 'mcpL2' }] as const;

interface Source { task: string; e1: readonly IdFinding[]; realNew: { step: number; findings: readonly IdFinding[] }[] }

/** A real Layered run's shared start (step-1 findings) and its new edge identities in order of appearance. */
function sourceOf(r: RunSpec): Source {
  const e1 = r.steps.find((s) => s.step === 1)?.final?.findings ?? [];
  const seen = new Set(e1.map((f) => `${f.filePath}|${f.target ?? ''}`));
  const realNew: Source['realNew'] = [];
  for (const s of r.steps.filter((x) => x.step >= 2 && x.step <= 5)) {
    const byEdge = new Map<string, IdFinding[]>();
    for (const f of s.final?.findings ?? []) {
      const k = `${f.filePath}|${f.target ?? ''}`;
      if (!seen.has(k)) byEdge.set(k, [...(byEdge.get(k) ?? []), f]);
    }
    for (const [k, fs_] of byEdge) {
      seen.add(k);
      realNew.push({ step: s.step, findings: fs_ });
    }
  }
  return { task: r.task, e1, realNew };
}

/**
 * Materialises one cell: n new identities (the source's real ones first, synthetic edges after, at a uniform step in
 * 2..5), each removed with probability `remove` (the planted effect). Returns the steps and the number planted.
 */
function materialise(rng: SeededRng, src: Source, n: number, remove: number, tag: string): { steps: StepInput[]; kept: number } {
  const ids: { step: number; findings: readonly IdFinding[] }[] = [];
  for (let i = 0; i < n; i++) {
    const real = src.realNew[i];
    if (real !== undefined) ids.push(real);
    else {
      const step = 2 + Math.floor(rng.next() * 4);
      const file = `src/persistence/syn-${tag}-${String(i)}.ts`;
      ids.push({ step, findings: [{ functionId: 'FF-S01', filePath: file, target: 'src/business/model.ts', tier: 'blocking' }] });
    }
  }
  const kept = ids.filter(() => !(rng.next() < remove));
  const ctx = JSON.stringify(['presets/layered.yaml', 'cypher-interp', 2, 'v1.3']);
  const steps: StepInput[] = [1, 2, 3, 4, 5].map((t) => ({
    step: t,
    final: { id: `${tag}-${String(t)}`, contextId: ctx, ok: true, findings: [...src.e1, ...kept.filter((x) => x.step <= t).flatMap((x) => x.findings)] },
    ...(t > 1 && { rename: new Map() }),
  }));
  return { steps, kept: kept.length };
}

interface Scenario { id: string; remove: Record<Cell, number>; corr: 'independent' | 'shared' }

function d9(sources: readonly Source[], sims: number, seed: number): unknown {
  const scenarios: Scenario[] = [];
  for (const corr of ['independent', 'shared'] as const) {
    scenarios.push({ id: `RR1-${corr}`, remove: { noneL2: 0, noneL3: 0, mcpL2: 0 }, corr });
    scenarios.push({ id: `plant-mcp-0.75-${corr}`, remove: { noneL2: 0, noneL3: 0, mcpL2: 0.75 }, corr });
    scenarios.push({ id: `plant-mcp-0.50-${corr}`, remove: { noneL2: 0, noneL3: 0, mcpL2: 0.5 }, corr });
    scenarios.push({ id: `plant-both-0.75-${corr}`, remove: { noneL2: 0, noneL3: 0.75, mcpL2: 0.75 }, corr });
  }
  const out = scenarios.map((sc, si) => {
    const rng = createRng(seed + si);
    const rej = { H1: 0, H2: 0, any: 0 };
    let mismatches = 0;
    const ratio = { noneL3: 0, mcpL2: 0 };
    let ratioN = 0;
    for (let s = 0; s < sims; s++) {
      const diffs: Record<'H1' | 'H2', number[]> = { H1: [], H2: [] };
      const sum: Record<Cell, number> = { noneL2: 0, noneL3: 0, mcpL2: 0 };
      for (let b = 0; b < BLOCKS; b++) {
        const src = sources[b % sources.length] as Source;
        const frailty = sc.corr === 'shared' ? gamma(rng, THETA) / THETA : 1;
        const D = {} as Record<Cell, number>;
        for (const c of CELLS) {
          const n = sc.corr === 'shared' ? poisson(rng, MU * frailty) : nbDraw(rng, MU, THETA);
          const m = materialise(rng, src, n, sc.remove[c], `${String(b)}${c}`);
          const run = driftRun(m.steps, STUDY2_S2D01, undefined, { runId: c, blockId: String(b), cell: c });
          if (run.D !== m.kept) mismatches++;
          D[c] = run.D ?? 0;
          sum[c] += D[c];
        }
        for (const h of HYP) diffs[h.id].push(D[h.a] - D[h.b]);
      }
      const p = HYP.map((h) => signFlipSimP(diffs[h.id], rng, FLIPS));
      const r = holmReject(p, 0.05);
      if (r[0] === true) rej.H1++;
      if (r[1] === true) rej.H2++;
      if (r.some(Boolean)) rej.any++;
      if (sum.noneL2 > 0) {
        ratio.noneL3 += sum.noneL3 / sum.noneL2;
        ratio.mcpL2 += sum.mcpL2 / sum.noneL2;
        ratioN++;
      }
    }
    const rate = (x: number): { rate: number; mcSe: number } => ({ rate: x / sims, mcSe: Math.sqrt((x / sims) * (1 - x / sims) / sims) });
    return {
      scenario: sc.id, corr: sc.corr, plantedRemoval: sc.remove, plantedRR: { H1: 1 - sc.remove.noneL3, H2: 1 - sc.remove.mcpL2 },
      rejectH1: rate(rej.H1), rejectH2: rate(rej.H2), rejectAny: rate(rej.any),
      meanRecoveredRR: { H1: ratioN > 0 ? ratio.noneL3 / ratioN : null, H2: ratioN > 0 ? ratio.mcpL2 / ratioN : null },
      driftRunMismatches: mismatches,
    };
  });
  return { blocks: BLOCKS, sims, seed, flips: FLIPS, alpha: 0.05, holmOver: ['H1', 'H2'], mu: MU, theta: THETA, sources: sources.map((s) => ({ task: s.task, Y1edges: new Set(s.e1.map((f) => `${f.filePath}|${f.target ?? ''}`)).size, realNew: s.realNew.length })), scenarios: out };
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const runs = loadRuns();
  const rows = runs.map(analyse);
  const failures: string[] = [];
  // Every finding in a harness snapshot or a tool-arm post-fix snapshot would be unlabelled; there must be none.
  for (const r of rows) if (r.findings > 0 && r.correct === 0 && (r.source === 'probe-3' || r.source === 'loop-pilot' || r.arm.startsWith('daedalus'))) failures.push(`${r.runId}: ${String(r.findings)} unlabelled findings`);
  // s2d-01 §3 inputs.
  const s2d = ['market-vendors', 'youth-league', 'hive-health'].map((t) => rows.find((r) => r.runId === `probe-1/${t}/none`)?.D ?? null);
  const s2dReproduces = JSON.stringify(s2d) === JSON.stringify([1, 2, 5]);
  if (!s2dReproduces) failures.push(`s2d-01 inputs: got ${JSON.stringify(s2d)}, expected [1,2,5]`);

  // Real-data exercise of the test (probe 1, none vs tool by task). Not a shared start and not an effect estimate.
  const p1 = P1_TASKS.map((t) => {
    const none = rows.find((r) => r.runId === `probe-1/${t.task}/none`)?.D ?? 0;
    const tool = rows.find((r) => r.runId === `probe-1/${t.task}/tool`)?.D ?? 0;
    return { task: t.task, none, tool, d: none - tool };
  });
  const exercise = { blocks: p1, signFlipExactP: signFlipExactP(p1.map((x) => x.d)), note: 'pipeline exercise only: different step-1 trees per arm, Opus by hand, development tasks; not an effect estimate' };

  const sources = runs.filter((r) => r.source === 'probe-1' && r.arm === 'none' && r.style === 'layered').map(sourceOf);
  const d9Out = d9(sources, SIMS, SEED);

  fs.mkdirSync(OUT, { recursive: true });
  const params = { primary: STUDY2_S2D01, memo: MEMO_K5, g08EdgeSet: G08_EDGESET };
  fs.writeFileSync(path.join(OUT, 'runs.json'), `${canonicalize({ params, s2d01Inputs: { got: s2d, expected: [1, 2, 5], reproduces: s2dReproduces }, rows, realDataExercise: exercise })}\n`);
  fs.writeFileSync(path.join(OUT, 'd9.json'), `${canonicalize(d9Out)}\n`);
  const csvCell = (x: unknown): string => (x === null || x === undefined ? '' : Array.isArray(x) ? x.map((v) => (v === null ? 'NA' : String(v))).join(' ') : String(x));
  const cols: (keyof Row)[] = ['source', 'task', 'style', 'generator', 'arm', 'scored', 'steps', 'kUsed', 'Y1', 'D', 'Ylast', 'perStepNew', 'inheritedRemoved', 'Dmemo', 'Dg08EdgeSet', 'Y1fine', 'findings', 'correct'];
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => `"${csvCell(r[c])}"`).join(','))].join('\n');
  fs.writeFileSync(path.join(OUT, 'runs.csv'), `${csv}\n`);
  for (const r of rows) process.stdout.write(`${r.runId.padEnd(52)} ${r.style.padEnd(10)} Y1 ${String(r.Y1).padStart(4)} D ${String(r.D).padStart(4)} Ylast ${String(r.Ylast).padStart(4)} memo ${String(r.Dmemo)} g08 ${String(r.Dg08EdgeSet)} notCounted ${String(r.notCounted.length)}\n`);
  process.stdout.write(`s2d-01 inputs ${JSON.stringify(s2d)} reproduce: ${String(s2dReproduces)}\n`);
  if (failures.length > 0) {
    process.stderr.write(`${failures.join('\n')}\n`);
    process.exit(1);
  }
}

main();
