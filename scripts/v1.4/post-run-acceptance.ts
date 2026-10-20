/**
 * Study 2b post-run acceptance runner (gate line D12; pre-registration §4 "Post-run acceptance"; DELEG6, DELEG8).
 * Entry file: no exports. The procedure is `scripts/v1.4/lib/post-run-acceptance.ts`. Zero model calls, no Neo4j.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/post-run-acceptance.ts --cell <cell>=<out-root> [--cell ...] --acceptance-root <dir>
 *     --harness-root <H> --out <dir> [--tsx <tsx binary>] [--scratch <dir>]
 *
 * Every stored step snapshot of every out-root (step 1 to 5 of every run, inherited step 1 included and marked) is
 * materialised from the run's `snapshots.git` into a scratch directory outside every out-root, type-checked with
 * `<H>/bin/tsc` and the harness tsconfig, started from the DELEG8 entry with `tsx`, and checked with the step files.
 * `node_modules` is `<H>/skeleton-install/node_modules`, symlinked. Writes `<out>/acceptance.json` (one row per
 * snapshot, plus the pass rate per cell) and prints the counts per cell only: no test content, no task text.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { discoverSnapshots } from './lib/snapshot-store.js';
import { passRate, POST_RUN_ACCEPTANCE_SCHEMA, runPostRunAcceptance } from './lib/post-run-acceptance.js';

function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1] !== undefined) out.push(process.argv[i + 1] as string);
  });
  return out;
}
function arg(name: string, fallback?: string): string {
  const v = args(name)[0] ?? fallback;
  if (v === undefined) throw new Error(`--${name} is required`);
  return v;
}
const inside = (child: string, parent: string): boolean => {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

async function main(): Promise<void> {
  const repo = process.cwd();
  const cells = args('cell').map((c) => {
    const i = c.indexOf('=');
    if (i <= 0) throw new Error(`--cell must be <cell>=<out-root>: ${c}`);
    return { cell: c.slice(0, i), outRoot: path.resolve(c.slice(i + 1)) };
  });
  if (cells.length === 0) throw new Error('at least one --cell is required');
  const acceptanceRoot = path.resolve(arg('acceptance-root'));
  const harnessRoot = path.resolve(arg('harness-root'));
  const out = path.resolve(arg('out'));
  const tsx = path.resolve(arg('tsx', path.join(repo, 'node_modules', '.bin', 'tsx')));
  const scratchRoot = fs.realpathSync(path.resolve(arg('scratch', os.tmpdir())));
  const tsc = path.join(harnessRoot, 'bin', 'tsc');
  const nodeModules = path.join(harnessRoot, 'skeleton-install', 'node_modules');
  for (const f of [tsc, nodeModules, tsx, acceptanceRoot]) if (!fs.existsSync(f)) throw new Error(`missing: ${f}`);
  for (const c of cells) {
    if (inside(scratchRoot, c.outRoot) || inside(c.outRoot, scratchRoot)) throw new Error(`scratch and out-root ${c.cell} must not contain one another`);
    if (inside(acceptanceRoot, c.outRoot)) throw new Error(`the acceptance root lies inside out-root ${c.cell}`);
  }
  const rows: Record<string, unknown>[] = [];
  for (const c of cells) {
    const refs = discoverSnapshots(c.outRoot, repo).filter((r) => r.store === 'loop');
    for (const r of refs) {
      const runDir = path.join(c.outRoot, 'runs', path.posix.dirname(r.id).slice('runs/'.length));
      const runJson = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8')) as { sharedStart?: unknown };
      const inherited = r.step === 1 && runJson.sharedStart !== undefined;
      const rec = await runPostRunAcceptance({ materialise: r.materialise, task: r.task, step: r.step, acceptanceRoot, nodeModules, tsc, tsx, scratchRoot });
      rows.push({ cell: c.cell, runId: path.posix.dirname(r.id).slice('runs/'.length), task: r.task, rep: Number(r.run.replace('run-', '')) + 1, step: r.step, snapshot: r.snapshot, inheritedStep1: inherited, ...rec });
    }
    const mine = rows.filter((x) => x.cell === c.cell) as { status: string; pass: boolean | null }[];
    const by = (s: string): number => mine.filter((x) => x.status === s).length;
    process.stdout.write(`${c.cell}: ${String(mine.length)} snapshots; ran ${String(by('ran'))}, build-failed ${String(by('build-failed'))}, not-started ${String(by('not-started'))}, no-tests ${String(by('no-tests'))}, runner-error ${String(by('runner-error'))}; steps passing ${String(mine.filter((x) => x.pass === true).length)}\n`);
  }
  const summary = passRate(rows as { cell: string; pass: boolean | null }[]);
  fs.mkdirSync(out, { recursive: true });
  const scrub = (s: string): string => s.split(scratchRoot).join('<scratch>').split(os.homedir()).join('<home>');
  fs.writeFileSync(path.join(out, 'acceptance.json'), `${scrub(JSON.stringify({ schema: POST_RUN_ACCEPTANCE_SCHEMA, procedure: 'pre-registration §4 Post-run acceptance (DELEG6, DELEG8)', summary, rows }, null, 1))}\n`);
  for (const [cell, s] of Object.entries(summary)) process.stdout.write(`pass rate ${cell}: ${String(s.passed)}/${String(s.steps)}\n`);
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
});
