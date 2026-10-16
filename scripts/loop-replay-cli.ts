/**
 * Loop replay (v1.3): the firewall-in-the-loop harness end to end with a scripted agent, no LLM
 * (`scripts/lib/loop/replay.ts`; report `Docs/v1.3/loop-replay.md`). Entry file.
 *
 * Usage (repository root; needs a scratch Neo4j 5.26 + APOC, the evaluator replaces the graph):
 *   NEO4J_PASSWORD=... [NEO4J_URI=bolt://localhost:7687] npx tsx scripts/loop-replay-cli.ts [--report <file.json>]
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
import { runReplay, scratchDir } from './lib/loop/replay.js';
import type { ReplayResult } from './lib/loop/replay.js';
import { REPLAY_TAPES } from './lib/loop/replay-tapes.js';
import { compareReplays, verifyReplay } from './lib/loop/replay-verify.js';

async function once(repoRoot: string, label: string): Promise<{ outRoot: string; result: ReplayResult }> {
  const base = scratchDir(`loop-replay-${label}-`);
  const env: NodeJS.ProcessEnv = {
    NEO4J_URI: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    NEO4J_USER: process.env.NEO4J_USER ?? 'neo4j',
    NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
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
  });
  if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('\n'));
  return { outRoot, result: r.data };
}

async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const i = argv.indexOf('--report');
  const reportFile = i >= 0 ? argv[i + 1] : undefined;
  if ((i >= 0 && reportFile === undefined) || argv.some((a, j) => a.startsWith('--') && a !== '--report' && j !== i + 1)) {
    process.stderr.write('usage: npx tsx scripts/loop-replay-cli.ts [--report <file.json>]\n');
    return 2;
  }
  if ((process.env.NEO4J_PASSWORD ?? '') === '') {
    process.stderr.write('NEO4J_PASSWORD is not set: the replay needs a scratch Neo4j 5.26 + APOC\n');
    return 2;
  }
  const a = await once(repoRoot, 'A');
  const b = await once(repoRoot, 'B');
  const repro = compareReplays(a.outRoot, b.outRoot);
  const v = await verifyReplay(a.result, REPLAY_TAPES, repoRoot, scratchDir('loop-replay-verify-'));
  const failures: string[] = [];
  if (!repro.identical) failures.push(`not reproducible: ${repro.differing.slice(0, 10).join(', ')}`);
  for (const g of v.gate) if (!g.exact) failures.push(`gate ${g.runId}: scripted ${JSON.stringify(g.scripted)}, repaired ${JSON.stringify(g.repaired)}`);
  for (const c of v.consistency) if (!c.equal) failures.push(`consistency ${c.runId} ${c.turnId}: ${c.difference ?? ''}`);
  for (const l of v.labels) if (l.verdict !== 'correct') failures.push(`label ${l.runId} step ${String(l.step)}: ${l.verdict} (${l.reason})`);
  for (const m of v.mcp) if (m.unfollowed) failures.push(`mcp ${m.taskId} step ${String(m.step)}: feedback without a scripted fix`);
  const summary = {
    reproducible: repro,
    gate: v.gate,
    consistency: { snapshots: v.consistency.length, equal: v.consistency.filter((c) => c.equal).length },
    labels: v.labels,
    mcp: v.mcp,
    outcomes: v.outcomes.map((o) => ({ runId: o.runId, newBlocking: o.newBlocking.map((s) => s.count), advisorySlopePerKloc: o.advisorySlopePerKloc, advisorySlopePerKlocWithoutCv05: o.advisorySlopePerKlocWithoutCv05, gateRepair: o.gateRepair })),
    latency: v.latency,
    failures,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (reportFile !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true });
    fs.writeFileSync(reportFile, `${JSON.stringify({ ...v, reproducible: repro, failures }, null, 2)}\n`);
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
