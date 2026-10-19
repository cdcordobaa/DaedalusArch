/**
 * U4 drift check: recompute the published drift figures from committed data with the shared module
 * `scripts/lib/drift/`, and write the C1e hand-check packet. Entry file: no exports.
 * Design: aidlc-docs/construction/v1.4/U4/functional-design/design.md. Zero calls, no Neo4j, one process.
 *
 * Usage (repository root): npx tsx scripts/v1.4/drift-check.ts
 *
 * Reads (read-only): results/v1.3-fixes-mined/{corpus.json, repos/<id>/{walk.json, pairs.json.gz, lineages.json.gz}}
 * and results/v1.3-floor-probe/<task>/none/step-NN.json.
 * Writes:
 * - results/v1.4-drift-check/summary.json (canonical JSON): R1 (the fix-mining §5a table), R2 (the C5 counts and KM
 *   rows), R3 (probe 1's D and Y1), each beside its params and source path, and the S1 and S2 rows labelled
 *   `sensitivity` (never in place of a published figure);
 * - results/v1.4-drift-check/identity-handcheck.csv: the seeded, stratified packet of real disappearances for the
 *   author's C1e hand check (the two label columns empty).
 * Exits 1 if any published figure (R1, R2, R3) differs. S1/S2 differences from the review values are reported only.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { canonicalize } from '../lib/canonical-json.js';
import { handcheckCsv, handcheckSample, type HandcheckRepo } from '../lib/drift/handcheck.js';
import { forEachMinedRepo } from '../lib/drift/metrics.js';
import { compareMined, computeMinedRegression, PUBLISHED_5A, PUBLISHED_C5, REVIEW_SENSITIVITY } from '../lib/drift/regression.js';
import { driftRun, fromProbeStepFile, type ProbeStepFile, type StepInput } from '../lib/drift/study2-d.js';
import { LEGACY_FIXES_MINED, STUDY2_S2D01, type DriftParams } from '../lib/drift/types.js';

const REPO = process.cwd();
const MINED = 'results/v1.3-fixes-mined';
const PROBE = 'results/v1.3-floor-probe';
const OUT = 'results/v1.4-drift-check';
const SEED = 20261018;
const PER_CAUSE = 10;

/** Probe 1's published D (results/v1.3-floor-probe, recomputed in the U4 design review). */
const R3_EXPECTED: readonly { task: string; D: number; Y1: number; Dfine: number; Y1fine: number }[] = [
  { task: 'market-vendors', D: 1, Y1: 2, Dfine: 2, Y1fine: 4 },
  { task: 'youth-league', D: 2, Y1: 2, Dfine: 2, Y1fine: 3 },
  { task: 'hive-health', D: 5, Y1: 4, Dfine: 7, Y1fine: 6 },
  { task: 'food-bank', D: 0, Y1: 0, Dfine: 0, Y1fine: 0 },
  { task: 'garden-plots', D: 0, Y1: 0, Dfine: 0, Y1fine: 0 },
  { task: 'shelter-adoptions', D: 0, Y1: 0, Dfine: 0, Y1fine: 0 },
];

function probeRun(task: string): StepInput[] {
  const dir = path.join(REPO, PROBE, task, 'none');
  return fs.readdirSync(dir).filter((f) => /^step-\d+\.json$/.test(f)).sort().map((f) => {
    const s = fromProbeStepFile(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ProbeStepFile);
    return s.step === 1 ? s : { ...s, rename: new Map() }; // ρ is empty for probe 1 (plain directories, ID-9)
  });
}

function main(): void {
  const t0 = performance.now();
  const failures: string[] = [];

  // R1, R2, S1, S2 from the committed fix-mining outputs.
  const reg = computeMinedRegression(path.join(REPO, MINED));
  const cmp = compareMined(reg);
  failures.push(...cmp.published);

  // R3 from the probe-1 step records.
  const fine: DriftParams = { ...STUDY2_S2D01, grain: 'fine' };
  const r3 = R3_EXPECTED.map((e) => {
    const steps = probeRun(e.task);
    const edge = driftRun(steps, STUDY2_S2D01, undefined, { runId: `${e.task}/none`, blockId: e.task, cell: 'none' });
    const f = driftRun(steps, fine, undefined, { runId: `${e.task}/none`, blockId: e.task, cell: 'none' });
    if (edge.D !== e.D || edge.Y1 !== e.Y1 || f.D !== e.Dfine || f.Y1fine !== e.Y1fine) {
      failures.push(`R3 ${e.task}: D ${String(edge.D)} Y1 ${String(edge.Y1)} Dfine ${String(f.D)} Y1fine ${String(f.Y1fine)} != ${String(e.D)} ${String(e.Y1)} ${String(e.Dfine)} ${String(e.Y1fine)}`);
    }
    return {
      task: e.task, source: `${PROBE}/${e.task}/none/step-NN.json`,
      edge: { D: edge.D, Y1: edge.Y1, Yk: edge.Yk, eligible: edge.eligible, perStep: edge.perStep.map((p) => p.newCount), incomplete: edge.incomplete, inheritedRemoved: edge.inheritedRemoved },
      fine: { D: f.D, Y1fine: f.Y1fine },
    };
  });

  // The hand-check packet (C1e part test, T-HC).
  const repos: HandcheckRepo[] = [];
  forEachMinedRepo(path.join(REPO, MINED), (r) => repos.push({ id: r.entry.id, repo: r.entry.repo, pairs: r.pairs }));
  const packet = handcheckSample(repos, { seed: SEED, perCause: PER_CAUSE });

  const km = (r: { n: number; ended: number; median: number | '> obs.'; s365: number; inPlacePct?: number | null }): Record<string, unknown> => ({
    lineages: r.n, ended: r.ended, medianDays: r.median, s365: r.s365, ...(r.inPlacePct !== undefined && { endedInPlacePct: r.inPlacePct }),
  });
  const summary = {
    unit: 'v1.4 U4 violation identity (C1e) and drift (C5)',
    design: 'aidlc-docs/construction/v1.4/U4/functional-design/design.md',
    calls: 0,
    neo4j: false,
    published: {
      R1: {
        source: 'Docs/DiagnosticRuns/v1.3-validity-fixes-mined-2026-10-16.md §5a; results/v1.3-fixes-mined/summary.json',
        data: `${MINED}/repos/*/{lineages,pairs}.json.gz`,
        params: LEGACY_FIXES_MINED,
        tier: 'stored (frozen at walk time, DR-3a)',
        rows: reg.survival5A.map((r, i) => ({ group: r.group, ...km(r), published: PUBLISHED_5A[i] })),
      },
      R2: {
        source: 'Docs/DiagnosticRuns/v1.3-drift-descriptive-2026-10-18.md §3, §4',
        data: `${MINED}/repos/*/{lineages,pairs}.json.gz`,
        params: LEGACY_FIXES_MINED,
        windows: reg.windows,
        pairs: reg.pairs,
        survival: reg.survivalC5.map((r, i) => ({ group: r.group, ...km(r), published: PUBLISHED_C5.survival[i] })),
      },
      R3: { source: `${PROBE}/<task>/none/step-NN.json`, params: STUDY2_S2D01, fineParams: fine, rho: 'empty (probe 1 snapshots are plain directories)', runs: r3 },
    },
    sensitivity: {
      label: 'sensitivity rows (DR-8): printed beside the published figures, never in place of them',
      S1: { definition: "leftCensor 'first-valid': lineages present at a repository's first valid grid point are left-censored", rows: reg.sensitivity.map((r, i) => ({ group: r.group, ...km(r.S1), review: REVIEW_SENSITIVITY[i]?.S1 })) },
      S2: { definition: 'endings with filesStay false are censored at their end date (a bracket for the rename bias, not an estimate)', rows: reg.sensitivity.map((r, i) => ({ group: r.group, ...km(r.S2), review: REVIEW_SENSITIVITY[i]?.S2 })) },
      differencesFromReview: cmp.sensitivity,
      leftCensorArtefact: reg.leftCensorArtefact,
    },
    tierCheck: reg.tierCheck,
    handcheck: { path: `${OUT}/identity-handcheck.csv`, seed: SEED, perCause: PER_CAUSE, tier: 'blocking', rows: packet.length, labels: 'empty: for the author (Q9)' },
    failures,
  };
  fs.mkdirSync(path.join(REPO, OUT), { recursive: true });
  fs.writeFileSync(path.join(REPO, OUT, 'summary.json'), canonicalize(summary));
  fs.writeFileSync(path.join(REPO, OUT, 'identity-handcheck.csv'), handcheckCsv(packet));
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  process.stdout.write(`drift-check: R1 ${String(reg.survival5A.length)} rows, R2 counts and ${String(reg.survivalC5.length)} KM rows, R3 ${String(r3.length)} runs; `
    + `S1/S2 differences from review: ${String(cmp.sensitivity.length)}; hand-check packet ${String(packet.length)} rows; ${secs}s\n`);
  if (failures.length > 0) {
    process.stderr.write(`published figures differ:\n${failures.join('\n')}\n`);
    process.exitCode = 1;
  }
}

main();
