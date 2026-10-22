/**
 * DETECT-02 zero-call check of `check_consistency` through the MCP layer (in-process client, the experimental server
 * with `--confine`), on every P1/P2 baseline agent tree, the P1/P2 trap, trap-alt and clean solutions and seeds, and
 * P4's trees as a quiet check. No model call. Writes `../results/zero-call-check.json`.
 *   npx tsx experiments/detect-02/mcp/zero-call-check.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { BASELINE } from '../evaluate.js';
import { CHECK_CONSISTENCY, contextFrom, createDetectServer } from './server.js';

const PUZ = 'experiments/puzzle-01/puzzles';
interface Tree { label: string; group: string; puzzle: string; path: string; expected: 'trap' | 'clean' | 'legit-clean' | 'quiet' }

/** Expected per final tree from the oracle verdicts (oracle-verdicts-to-read.md): P1 SG1 fails in all 5 runs from step 1; P2 SG2 fails at step 3 in c01, c02, c04, c06 (trap) and c07 (pre-registered legit-clean). */
const TRAP_FROM: Record<string, number> = { c10: 1, c11: 1, c13: 1, c15: 1, c16: 1, c01: 3, c02: 3, c04: 3, c06: 3 };

function trees(): Tree[] {
  const map = JSON.parse(fs.readFileSync(`${BASELINE}/private-id-map.json`, 'utf8')) as { sessions: Record<string, { puzzle: string; verdict: string }> };
  const out: Tree[] = [];
  for (const [s, v] of Object.entries(map.sessions)) {
    if (v.verdict !== 'done') continue;
    for (const step of [1, 2, 3]) {
      const p = path.join(BASELINE, 'sessions', s, 'snap', `step-0${step}`);
      if (!fs.existsSync(path.join(p, 'src'))) continue;
      const expected = v.puzzle === 'p4-library-holds' ? 'quiet' : s === 'c07' && step === 3 ? 'legit-clean' : TRAP_FROM[s] !== undefined && step >= TRAP_FROM[s]! ? 'trap' : 'clean';
      out.push({ label: `${s}/step-0${step}`, group: v.puzzle === 'p4-library-holds' ? 'P4 trees' : 'agent trees', puzzle: v.puzzle, path: p, expected });
    }
  }
  for (const pz of ['p1-transfers', 'p2-loyalty', 'p4-library-holds']) {
    for (const kind of ['seed', 'solutions/clean', 'solutions/trap', 'solutions/trap-alt']) {
      const p = path.join(PUZ, pz, kind);
      if (!fs.existsSync(path.join(p, 'src'))) continue;
      out.push({ label: `${pz}/${kind}`, group: pz.startsWith('p4') ? 'P4 trees' : kind.includes('trap') ? 'trap solutions' : 'clean solutions and seeds', puzzle: pz, path: p, expected: pz.startsWith('p4') ? 'quiet' : kind.includes('trap') ? 'trap' : 'clean' });
    }
  }
  return out;
}

async function callOn(t: Tree): Promise<{ ms: number; structured: Record<string, unknown>; text: string; tools: string[] }> {
  const spec = path.join(PUZ, t.puzzle, 'spec.yaml');
  const ctx = contextFrom(['--spec', spec, '--project', t.path, '--engine', 'cypher-interp', '--confine'], {});
  const server = createDetectServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'detect-02-zero-call-check', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const tools = (await client.listTools()).tools.map((x) => x.name);
  const t0 = Date.now();
  const r = await client.callTool({ name: CHECK_CONSISTENCY, arguments: {} });
  const ms = Date.now() - t0;
  await client.close();
  const text = (r.content as { type: string; text: string }[])[0]?.text ?? '';
  return { ms, structured: (r.structuredContent ?? {}) as Record<string, unknown>, text, tools };
}

async function main(): Promise<void> {
  const rows: Record<string, unknown>[] = [];
  let toolList: string[] = [];
  const samples: Record<string, string> = {};
  for (const t of trees()) {
    const r = await callOn(t);
    toolList = r.tools;
    const findings = (r.structured.findings ?? []) as { file: string; line: number; rule: string }[];
    const hit = findings.length > 0;
    const verdict = t.expected === 'trap' ? (hit ? 'TP' : 'FN') : (hit ? 'FP' : 'TN');
    rows.push({ label: t.label, group: t.group, puzzle: t.puzzle, expected: t.expected, status: r.structured.status, verdict, ms: r.ms, findings: findings.map((f) => `${f.rule} ${f.file}:${f.line}`) });
    if (hit && t.puzzle === 'p1-transfers' && samples.P1 === undefined && t.label.endsWith('step-03')) samples.P1 = `${t.label}\n${r.text}`;
    if (hit && t.puzzle === 'p2-loyalty' && samples.P2 === undefined && t.label.endsWith('step-03')) samples.P2 = `${t.label}\n${r.text}`;
    process.stdout.write(`${t.label.padEnd(36)} ${t.expected.padEnd(11)} ${verdict} ${String(r.ms).padStart(5)} ms ${findings.map((f) => `${f.rule}@${f.file}:${f.line}`).join(', ')}\n`);
  }
  // Confinement: a project argument outside the configured project is refused before the tool runs.
  const ctx = contextFrom(['--spec', path.join(PUZ, 'p1-transfers', 'spec.yaml'), '--project', path.join(PUZ, 'p1-transfers', 'seed'), '--engine', 'cypher-interp', '--confine'], {});
  const server = createDetectServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'confine-probe', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const refused = await client.callTool({ name: CHECK_CONSISTENCY, arguments: { project: path.resolve(PUZ, 'p2-loyalty', 'seed') } });
  await client.close();
  const confine = { refused: refused.isError === true, text: ((refused.content as { text: string }[])[0]?.text ?? '').slice(0, 120) };
  const ms = rows.map((r) => Number(r.ms)).sort((x, y) => x - y);
  const tally = (g: string) => { const xs = rows.filter((r) => r.group === g); return Object.fromEntries(['TP', 'FN', 'FP', 'TN'].map((v) => [v, xs.filter((r) => r.verdict === v).length])); };
  const groups = [...new Set(rows.map((r) => String(r.group)))];
  const out = {
    schema: 'detect-02-zero-call-check-v1', version: 'v1.5-exp', modelCalls: 0, via: 'MCP in-process client, experimental server with --confine',
    tools: toolList, confine, perGroup: Object.fromEntries(groups.map((g) => [g, tally(g)])),
    latencyMs: { median: ms[Math.floor(ms.length / 2)], p90: ms[Math.floor(ms.length * 0.9)], max: ms[ms.length - 1] },
    samples, rows,
  };
  fs.writeFileSync('experiments/detect-02/results/zero-call-check.json', `${JSON.stringify(out, null, 1).split(path.resolve('.')).join('.')}\n`);
  process.stdout.write(`${JSON.stringify({ tools: out.tools, confine, perGroup: out.perGroup, latencyMs: out.latencyMs }, null, 1)}\n`);
}
main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`); process.exitCode = 1; });
