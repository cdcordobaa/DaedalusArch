/**
 * Loop replay (v1.3): the firewall-in-the-loop harness end to end with a scripted agent, no LLM
 * (`scripts/lib/loop/replay.ts`; report `Docs/v1.3/loop-replay.md`). Entry file.
 *
 * Usage (repository root; needs a scratch Neo4j 5.26 + APOC unless `--engine cypher-interp`, the evaluator replaces the graph):
 *   NEO4J_PASSWORD=... [NEO4J_URI=bolt://localhost:7687] npx tsx scripts/loop-replay-cli.ts [--report <file.json>]
 *                                                       [--engine neo4j|cypher-interp|both]
 *
 * Runs the three tapes under none, daedalus-mcp and gate twice, into two fresh directories outside the repository,
 * verifies the second against the first byte for byte (timing fields aside) and runs every check of
 * `replay-verify.ts` on the first. Prints a summary; `--report` also writes the full verification as JSON.
 * `--engine` (`Docs/v1.3/loop-engine-tee.md`): absent = `neo4j`, never the NEO4J_URI default; every snapshot must
 * record that engine (`engineOfRecord`, Neo4j under `both`) or the replay fails. `both` keeps Neo4j as the engine of record,
 * checks every snapshot on the in-process interpreter, prints a per-snapshot parity table and fails unless every
 * snapshot is `identical`. `cypher-interp` needs no Neo4j.
 * Exit codes: 0 every check passed, 1 a check failed, 2 usage or engine error. Never reads .env.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildContext } from '../src/mcp-server/context.js';
import { scrubSecrets } from '../src/shared/errors/scrub.js';
import { runReplay, scratchDir } from './lib/loop/replay.js';
import type { ReplayResult } from './lib/loop/replay.js';
import { REPLAY_TAPES } from './lib/loop/replay-tapes.js';
import { compareReplays, verifyReplay } from './lib/loop/replay-verify.js';
import { parseLoopEngine } from './lib/loop/types.js';
import type { LoopEngine, ParityStatus } from './lib/loop/types.js';

interface ParityRow {
  readonly runId: string;
  readonly turnId: string;
  readonly status: ParityStatus | 'none';
  /** Blocking findings on the engine of record (so the parity table shows it covers non-clean trees). */
  readonly blockingViolationCount: number | null;
}

/** One row per evaluated snapshot of the replay (tape, arm, turn order). */
function parityTable(result: ReplayResult): ParityRow[] {
  const rows: ParityRow[] = [];
  for (const run of result.runs) {
    if (run.result.kind !== 'completed') continue;
    for (const step of run.result.steps) for (const t of step.turns) rows.push({ runId: run.runId, turnId: t.turnId, status: t.snapshot.evaluation?.parity?.status ?? 'none', blockingViolationCount: t.snapshot.evaluation?.blockingViolationCount ?? null });
  }
  return rows;
}

async function once(repoRoot: string, label: string, engine: LoopEngine): Promise<{ outRoot: string; result: ReplayResult }> {
  const base = scratchDir(`loop-replay-${label}-`);
  const env: NodeJS.ProcessEnv = {
    NEO4J_URI: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    NEO4J_USER: process.env.NEO4J_USER ?? 'neo4j',
    ...(process.env.NEO4J_PASSWORD !== undefined ? { NEO4J_PASSWORD: process.env.NEO4J_PASSWORD } : {}),
    APG_STORE_PATH: path.join(base, 'apg-store'),
  };
  const outRoot = path.join(base, 'out');
  const r = await runReplay({
    repoRoot,
    outRoot,
    harnessRoot: path.join(base, 'harness'),
    evaluatorEnv: env,
    evaluateDeps: buildContext({}, env).evaluateDeps,
    tapes: REPLAY_TAPES,
    log: (l) => process.stdout.write(`[${label}] ${l}\n`),
    engine,
  });
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  return { outRoot, result: r.data };
}

async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const i = argv.indexOf('--report');
  const reportFile = i >= 0 ? argv[i + 1] : undefined;
  const e = argv.indexOf('--engine');
  const engineArg = e >= 0 ? argv[e + 1] : undefined;
  const engine = engineArg !== undefined ? parseLoopEngine(engineArg) : 'neo4j';
  if (
    (i >= 0 && reportFile === undefined) ||
    engine === undefined ||
    argv.some((a, j) => a.startsWith('--') && a !== '--report' && a !== '--engine' && j !== i + 1 && j !== e + 1)
  ) {
    process.stderr.write('usage: npx tsx scripts/loop-replay-cli.ts [--report <file.json>] [--engine neo4j|cypher-interp|both]\n');
    return 2;
  }
  if (engine !== 'cypher-interp' && (process.env.NEO4J_PASSWORD ?? '') === '') {
    process.stderr.write('NEO4J_PASSWORD is not set: the replay needs a scratch Neo4j 5.26 + APOC\n');
    return 2;
  }
  const a = await once(repoRoot, 'A', engine);
  const b = await once(repoRoot, 'B', engine);
  const repro = compareReplays(a.outRoot, b.outRoot);
  const v = await verifyReplay(a.result, REPLAY_TAPES, repoRoot, scratchDir('loop-replay-verify-'));
  const failures: string[] = [];
  if (!repro.identical) failures.push(`not reproducible: ${repro.differing.slice(0, 10).join(', ')}`);
  for (const g of v.gate) if (!g.exact) failures.push(`gate ${g.runId}: scripted ${JSON.stringify(g.scripted)}, repaired ${JSON.stringify(g.repaired)}`);
  for (const c of v.consistency) if (!c.equal) failures.push(`consistency ${c.runId} ${c.turnId}: ${c.difference ?? ''}`);
  for (const l of v.labels) if (l.verdict !== 'correct') failures.push(`label ${l.runId} step ${String(l.step)}: ${l.verdict} (${l.reason})`);
  for (const m of v.mcp) if (m.unfollowed) failures.push(`mcp ${m.taskId} step ${String(m.step)}: feedback without a scripted fix`);
  const parity = engine === 'both' ? parityTable(a.result) : undefined;
  for (const p of parity ?? []) if (p.status !== 'identical') failures.push(`parity ${p.runId} ${p.turnId}: ${p.status}`);
  for (const o of v.outcomes) if (o.unscoredSteps.length > 0) failures.push(`unscored ${o.runId}: steps ${o.unscoredSteps.join(', ')}`);
  const ofRecord = engine === 'both' ? 'neo4j' : engine;
  for (const run of a.result.runs) {
    if (run.result.kind !== 'completed') continue;
    for (const step of run.result.steps) {
      for (const t of step.turns) {
        const got = t.snapshot.evaluation?.engineOfRecord ?? 'not recorded';
        if (got !== ofRecord) failures.push(`engine ${run.runId} ${t.turnId}: ${got} (expected ${ofRecord})`);
      }
    }
  }
  const summary = {
    reproducible: repro,
    gate: v.gate,
    consistency: { snapshots: v.consistency.length, equal: v.consistency.filter((c) => c.equal).length },
    labels: v.labels,
    mcp: v.mcp,
    outcomes: v.outcomes.map((o) => ({ runId: o.runId, newBlocking: o.newBlocking.map((s) => s.count), unscoredSteps: o.unscoredSteps, advisorySlopePerKloc: o.advisorySlopePerKloc, advisorySlopePerKlocWithoutCv05: o.advisorySlopePerKlocWithoutCv05, gateRepair: o.gateRepair })),
    latency: v.latency,
    engine,
    ...(parity !== undefined
      ? { parity: { snapshots: parity.length, identical: parity.filter((p) => p.status === 'identical').length, rows: parity } }
      : {}),
    failures,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (reportFile !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true });
    fs.writeFileSync(reportFile, `${JSON.stringify({ engine, ...v, reproducible: repro, ...(parity !== undefined ? { parity } : {}), failures }, null, 2)}\n`);
  }
  return failures.length === 0 ? 0 : 1;
}

void main(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [process.env.NEO4J_PASSWORD ?? ''].filter((s) => s !== ''))}\n`);
    process.exitCode = 2;
  },
);
