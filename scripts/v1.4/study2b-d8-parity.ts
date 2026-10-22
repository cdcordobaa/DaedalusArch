/**
 * Study 2b engine parity on a seeded sample of 2b snapshots (gate line D8; pre-registration §4 "Scoring"; addendum 1
 * DA4; runbook §6 "Engine parity"; implementation choices fixed in addendum 3, DA9, before any 2b figure was read).
 * Entry file: no exports. Additive: it changes no frozen path. Zero model calls; one capped local Neo4j.
 *
 * Usage (repository root; for 2b, at the freeze tag with this file copied in, as runbook §6 does for the scoring files):
 *   NEO4J_URI=bolt://127.0.0.1:7687 NEO4J_USER=neo4j NEO4J_PASSWORD=... \
 *   npx tsx scripts/v1.4/study2b-d8-parity.ts --cell none@L2=<out-root> [--cell ...] --node-modules <dir> --out <dir>
 *     [--seed 20261021] [--per-out-root 1]
 *
 * Sample: for each out-root, in the order given, the scored step snapshots (the last turn of every step record that
 * holds an evaluation; the inherited step-1 copies of the branch cells are left out, since they are the `none@L2`
 * tree), sorted by (runId, step); `--per-out-root` of them are drawn without replacement with one mulberry32 stream
 * seeded by `--seed`, consumed in out-root order. Each drawn snapshot is materialised as `stage-c-rescore.ts` does
 * (`git archive` of the turn's commit, the skeleton install linked, the harness tsconfig) and evaluated by the frozen
 * loop tee (`teeEvaluator`, `scripts/lib/loop/engine-tee.ts`): Neo4j of record, `cypher-interp` as check, the step's
 * static `evaluatorSpec` (sha256 checked), scoring v1.3. The parity rule is the tee's own (`compareEvaluations`):
 * `identical`, `order` (floats within 4 ULP only) or `divergent`; the blocking rows are the finding keys
 * (rule, template, file, target) and the per-rule blocking counts.
 *
 * Writes <out>/parity.json (params, one row per drawn snapshot, counts by status). Paths under the out-roots become
 * `<out-root:cell>`. Prints status counts only (no finding, no D). Exit 0 every drawn snapshot identical or order;
 * 1 a divergence or an evaluation failure; 2 usage error.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext } from '../../src/mcp-server/context.js';
import { buildHarnessTsconfig } from '../lib/generators/harness-tsconfig.js';
import { engineDeps, engineEnv, teeEvaluator } from '../lib/loop/engine-tee.js';
import { firewallEvaluator } from '../lib/loop/evaluator.js';
import type { StepRecord } from '../lib/loop/types.js';

const REPO = process.cwd();
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const args = (name: string): string[] => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] !== undefined ? [argv[i + 1] ?? ''] : []));
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const sha256 = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** mulberry32: a small seeded PRNG, uniform on [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runDirs(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!e.isDirectory() || ['snapshots.git', 'work', 'turns', 'steps', 'calls', 'node_modules', 'home'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (fs.existsSync(path.join(p, 'run.json'))) out.push(p);
    else out.push(...runDirs(p));
  }
  return out;
}

interface Candidate { runDir: string; runId: string; step: number; commit: string; specPath: string; specSha: string | undefined }

function candidates(root: string): Candidate[] {
  const out: Candidate[] = [];
  for (const runDir of runDirs(path.join(root, 'runs'))) {
    const run = readJson<{ runId: string }>(path.join(runDir, 'run.json'));
    for (const f of fs.readdirSync(path.join(runDir, 'steps')).filter((x) => /^step-\d\d\.json$/.test(x)).sort()) {
      const rec = readJson<StepRecord & { evaluatorSpec?: { kind: string; path: string; sha256?: string }; inherited?: unknown }>(path.join(runDir, 'steps', f));
      if (rec.inherited !== undefined) continue;
      const turn = rec.turns.at(-1);
      if (turn === undefined || (turn.snapshot.evaluation ?? null) === null) continue;
      const es = rec.evaluatorSpec;
      if (es?.kind !== 'static') throw new Error(`${run.runId} ${f}: evaluatorSpec ${JSON.stringify(es)}, expected static`);
      out.push({ runDir, runId: run.runId, step: rec.stepIndex + 1, commit: turn.snapshot.commit, specPath: path.resolve(REPO, es.path), specSha: es.sha256 });
    }
  }
  return out.sort((a, b) => (a.runId === b.runId ? a.step - b.step : a.runId < b.runId ? -1 : 1));
}

async function main(): Promise<number> {
  const cells = args('cell').map((c) => {
    const i = c.indexOf('=');
    if (i <= 0) throw new Error(`--cell ${c}: expected <cell>=<out-root>`);
    return { cell: c.slice(0, i), root: path.resolve(c.slice(i + 1)) };
  });
  const nm = arg('node-modules');
  const out = arg('out');
  const seed = Number(arg('seed') ?? '20261021');
  const per = Number(arg('per-out-root') ?? '1');
  if (cells.length === 0 || nm === undefined || out === undefined || !Number.isInteger(per) || per < 1) {
    process.stderr.write('usage: study2b-d8-parity.ts --cell <cell>=<out-root> ... --node-modules <dir> --out <dir> [--seed n] [--per-out-root n]\n');
    return 2;
  }
  if ((process.env.NEO4J_URI ?? '') === '' || (process.env.NEO4J_PASSWORD ?? '') === '') {
    process.stderr.write('NEO4J_URI and NEO4J_PASSWORD must be set (one capped local Neo4j)\n');
    return 2;
  }
  const nodeModules = path.resolve(nm);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const env = engineEnv(process.env, 'neo4j');
  const base = buildContext({}, env).evaluateDeps;
  const neoDeps = engineDeps(base, 'neo4j');
  const interpEnv = engineEnv(process.env, 'cypher-interp');
  const interpDeps = engineDeps(base, 'cypher-interp');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'study2b-d8-'));
  const rand = mulberry32(seed);
  const rows: Record<string, unknown>[] = [];
  let failures = 0;
  let n = 0;
  try {
    for (const [ci, { cell, root }] of cells.entries()) {
      const pool = candidates(root);
      const drawn: Candidate[] = [];
      for (let k = 0; k < per && pool.length > 0; k++) drawn.push(...pool.splice(Math.floor(rand() * pool.length), 1));
      for (const c of drawn) {
        if (c.specSha !== undefined && sha256(c.specPath) !== c.specSha) throw new Error(`${path.relative(REPO, c.specPath)}: sha256 differs from the step record`);
        const tree = path.join(scratch, `t${String(n++)}`);
        fs.mkdirSync(tree, { recursive: true });
        const tar = execFileSync('git', ['--git-dir', path.join(c.runDir, 'snapshots.git'), 'archive', c.commit], { maxBuffer: 256 * 1024 * 1024 });
        execFileSync('tar', ['-x', '-C', tree], { input: tar });
        if (!fs.existsSync(path.join(tree, 'node_modules'))) fs.symlinkSync(nodeModules, path.join(tree, 'node_modules'));
        fs.writeFileSync(`${tree}.tsconfig.json`, `${JSON.stringify(buildHarnessTsconfig(tree), null, 2)}\n`);
        const tsconfigOf = (dir: string): string => `${dir}.tsconfig.json`;
        const tee = teeEvaluator(firewallEvaluator(c.specPath, env, neoDeps, tsconfigOf), firewallEvaluator(c.specPath, interpEnv, interpDeps, tsconfigOf));
        const r = await tee.evaluate(tree, c.runId);
        const row: Record<string, unknown> = { cell, outRoot: `<out-root:${cell}#${String(ci)}>`, runId: c.runId, step: c.step, commit: c.commit };
        if (!r.success) {
          failures++;
          row.status = 'record-failed';
          row.error = r.errors.map((e) => e.code).join(', ');
        } else {
          const p = r.data.parity;
          row.engineOfRecord = r.data.engineOfRecord;
          row.status = p?.status ?? 'unknown';
          if (p?.diff !== undefined) row.diff = p.diff;
          if (p?.checkError !== undefined) row.checkError = p.checkError.code;
          row.blockingRows = { neo4j: r.data.blockingFindings.length };
          if (p?.status !== 'identical' && p?.status !== 'order') failures++;
        }
        rows.push(row);
        fs.rmSync(tree, { recursive: true, force: true });
        fs.rmSync(`${tree}.tsconfig.json`, { force: true });
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[String(r.status)] = (byStatus[String(r.status)] ?? 0) + 1;
  fs.mkdirSync(out, { recursive: true });
  const doc = {
    params: { runCommit: head, seed, perOutRoot: per, engineOfRecord: 'neo4j', check: 'cypher-interp', parityRule: 'scripts/lib/loop/engine-tee.ts compareEvaluations', scoringMode: 'v1.3', cells: cells.map((c, i) => ({ cell: c.cell, outRoot: `<out-root:${c.cell}#${String(i)}>` })) },
    sample: rows.length, byStatus, rows,
  };
  fs.writeFileSync(path.join(out, 'parity.json'), `${JSON.stringify(doc, null, 2)}\n`);
  process.stdout.write(`drawn ${String(rows.length)}; ${Object.entries(byStatus).map(([k, v]) => `${k} ${String(v)}`).join(', ')}\n`);
  return failures === 0 ? 0 : 1;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 1; });
