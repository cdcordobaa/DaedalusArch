/**
 * Loop replay (v1.3): the firewall-in-the-loop harness end to end with a scripted agent, no LLM
 * (`scripts/lib/loop/replay.ts`; report `Docs/v1.3/loop-replay.md`). Entry file.
 *
 * Usage (repository root):
 *   NEO4J_PASSWORD=... [NEO4J_URI=bolt://localhost:7687] npx tsx scripts/loop-replay-cli.ts [--report <file.json>]
 *   npx tsx scripts/loop-replay-cli.ts --engine cypher-interp [--report <file.json>]
 * `--engine` (default neo4j, the reference engine; needs a scratch Neo4j 5.26 + APOC, the evaluator replaces the
 * graph) is pinned, never taken from NEO4J_URI; a snapshot evaluated on another engine fails the replay.
 *
 * Runs the three tapes under none, daedalus-mcp and gate twice, into two fresh directories outside the repository,
 * verifies the second against the first byte for byte (timing fields aside) and runs every check of
 * `replay-verify.ts` on the first. Prints a summary; `--report` also writes the full verification as JSON.
 * Exit codes: 0 every check passed, 1 a check failed, 2 usage or engine error. Never reads .env.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildContext } from '../src/mcp-server/context.js';
import { scrubSecrets } from '../src/shared/errors/scrub.js';
import { parseGraphEngine } from '../src/cypher-interp/engine.js';
import type { GraphEngine } from '../src/cypher-interp/engine.js';
import { readRunSteps, runReplay, scratchDir } from './lib/loop/replay.js';
import type { ReplayResult } from './lib/loop/replay.js';
import { REPLAY_TAPES } from './lib/loop/replay-tapes.js';
import { compareReplays, verifyReplay } from './lib/loop/replay-verify.js';

async function once(repoRoot: string, label: string, engine: GraphEngine): Promise<{ outRoot: string; result: ReplayResult }> {
  const base = scratchDir(`loop-replay-${label}-`);
  const env: NodeJS.ProcessEnv =
    engine === 'neo4j'
      ? {
          NEO4J_URI: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
          NEO4J_USER: process.env.NEO4J_USER ?? 'neo4j',
          NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
          APG_STORE_PATH: path.join(base, 'apg-store'),
        }
      : { APG_STORE_PATH: path.join(base, 'apg-store') };
  const outRoot = path.join(base, 'out');
  const r = await runReplay({
    repoRoot,
    outRoot,
    harnessRoot: path.join(base, 'harness'),
    evaluatorEnv: env,
    evaluateDeps: buildContext({ engine }, env).evaluateDeps,
    tapes: REPLAY_TAPES,
    log: (l) => process.stdout.write(`[${label}] ${l}\n`),
  });
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  return { outRoot, result: r.data };
}

async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const i = argv.indexOf('--report');
  const reportFile = i >= 0 ? argv[i + 1] : undefined;
  const e = argv.indexOf('--engine');
  const engineArg = e >= 0 ? argv[e + 1] : 'neo4j';
  const engine = engineArg !== undefined ? parseGraphEngine(engineArg) : undefined;
  const values = new Set([i + 1, e + 1].filter((j) => j > 0));
  const unknown = argv.some((a, j) => !values.has(j) && a !== '--report' && a !== '--engine');
  if ((i >= 0 && reportFile === undefined) || engine === undefined || unknown) {
    process.stderr.write('usage: npx tsx scripts/loop-replay-cli.ts [--engine neo4j|cypher-interp] [--report <file.json>]\n');
    return 2;
  }
  if (engine === 'neo4j' && (process.env.NEO4J_PASSWORD ?? '') === '') {
    process.stderr.write('NEO4J_PASSWORD is not set: the replay on neo4j needs a scratch Neo4j 5.26 + APOC (or pass --engine cypher-interp)\n');
    return 2;
  }
  process.stdout.write(`graph engine: ${engine}\n`);
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
  for (const o of v.outcomes) if (o.unscoredSteps.length > 0) failures.push(`unscored ${o.runId}: steps ${o.unscoredSteps.join(', ')}`);
  for (const run of a.result.runs) {
    const steps = a.result.loaded.tasks.tasks.find((t) => t.id === run.spec.taskId)?.steps.length ?? 0;
    for (const s of readRunSteps(run.runDir, steps)) {
      for (const t of s.turns) {
        const got = t.snapshot.evaluation?.graphEngine ?? 'not recorded';
        if (got !== engine) failures.push(`engine ${run.runId} ${t.turnId}: ${got} (expected ${engine})`);
      }
    }
  }
  const summary = {
    graphEngine: engine,
    reproducible: repro,
    gate: v.gate,
    consistency: { snapshots: v.consistency.length, equal: v.consistency.filter((c) => c.equal).length },
    labels: v.labels,
    mcp: v.mcp,
    outcomes: v.outcomes.map((o) => ({ runId: o.runId, newBlocking: o.newBlocking.map((s) => s.count), unscoredSteps: o.unscoredSteps, advisorySlopePerKloc: o.advisorySlopePerKloc, advisorySlopePerKlocWithoutCv05: o.advisorySlopePerKlocWithoutCv05, gateRepair: o.gateRepair })),
    latency: v.latency,
    failures,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (reportFile !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true });
    fs.writeFileSync(reportFile, `${JSON.stringify({ graphEngine: engine, ...v, reproducible: repro, failures }, null, 2)}\n`);
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
