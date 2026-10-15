/**
 * Re-evaluates the accepted E1 cells under the v1.3 defaults, symbolic only, for the v1.3 labelling (unit U-F).
 * Entry file: no exports.
 *
 * Each accepted cell of `--e1-runs` (the Study 1 run records) is copied to a temporary directory (the outcomes are
 * read-only: nothing is written next to them) and evaluated there with `firewall evaluate --symbolic-only` (the same
 * CLI command and explicit child environment as `ue-baseline-live.ts`), with the pinned per-run tsconfig of ADR-032
 * (`harnessTsconfigText`, the one the Study 1 grid used). Paths in the violations are made relative to
 * the project. The report is written to `<out>/reports/<projectId with / as _>.json` and a labelling jobs file to
 * `<out>/jobs.json`, whose project roots are the original (read-only) outcome directories.
 *
 * The cross-process Neo4j lock is held for the whole run; the CLI children are re-entrant.
 *
 * Usage (repository root, Neo4j env loaded):
 *   npx tsx scripts/v1.3/e1-v13-evaluate.ts --e1-runs results/e1-grid/runs --e1-root <daedalus-e1-outcomes> \
 *     --spec specs/clean-arch.yaml --out results/v1.3-labelling/e1
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { acquireNeo4jLock } from '../../src/shared/process/neo4j-lock.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { CLI_ENTRY } from '../lib/freeze-gate-main.js';
import { harnessTsconfigText } from '../lib/generators/harness-tsconfig.js';
import { normaliseFindingPath } from './lib/compare.js';

const argv = process.argv.slice(2);
const arg = (name: string): string => {
  const i = argv.indexOf(`--${name}`);
  const v = i >= 0 ? argv[i + 1] : undefined;
  if (v === undefined) throw new Error(`--${name} <value> is required`);
  return v;
};
const repoRoot = process.cwd();
const env = process.env;
const secrets = [env.NEO4J_PASSWORD ?? ''].filter((s) => s !== '');
const runner = new NodeProcessRunner();
const tsx = path.resolve(repoRoot, 'node_modules/.bin/tsx');
const childEnv: Record<string, string> = {};
for (const k of ['PATH', 'HOME', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) {
  const v = env[k];
  if (v !== undefined) childEnv[k] = v;
}

async function main(): Promise<number> {
  const runsDir = path.resolve(arg('e1-runs'));
  const e1Root = path.resolve(arg('e1-root'));
  const spec = path.resolve(arg('spec'));
  const outDir = path.resolve(arg('out'));
  const uri = env.NEO4J_URI ?? '';
  if (uri === '') throw new Error('NEO4J_URI is not set');
  fs.mkdirSync(path.join(outDir, 'reports'), { recursive: true });
  const lock = await acquireNeo4jLock(uri, { label: 'e1-v13-evaluate', env, onWait: (t) => process.stderr.write(`${t}\n`) });
  process.stderr.write(`Neo4j lock ${lock.mode}\n`);
  const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v13-e1-eval-')));
  const jobs: { projectId: string; projectRoot: string; spec: string; report: string; tsconfig: 'adr-032' }[] = [];
  const failures: string[] = [];
  try {
    for (const name of fs.readdirSync(runsDir).filter((n) => n.endsWith('.run.json')).sort()) {
      const rec = JSON.parse(fs.readFileSync(path.join(runsDir, name), 'utf8')) as { projectId?: string; status?: string };
      if (rec.status !== 'accepted' || rec.projectId === undefined) continue;
      const src = path.join(e1Root, rec.projectId);
      if (!fs.existsSync(src)) { failures.push(`${rec.projectId}: source missing`); continue; }
      const copy = path.join(work, rec.projectId.replace(/\//g, '_'));
      fs.cpSync(src, copy, { recursive: true, verbatimSymlinks: true });
      // ADR-032: the pinned per-run tsconfig (generator-protocol §3) for the cell directory, outside the tree; the
      // tree's own tsconfig.json, when the agent wrote one, is ignored (as in the Study 1 grid, run-experiment.ts).
      const tsconfig = path.join(work, `${path.basename(copy)}.tsconfig.json`);
      fs.writeFileSync(tsconfig, harnessTsconfigText(copy), { mode: 0o444 });
      const started = Date.now();
      const run = await runner.run(tsx, [CLI_ENTRY, 'evaluate', '--project', copy, '--spec', spec, '--format', 'json', '--symbolic-only', '--tsconfig', tsconfig, '--neo4j-uri', uri],
        { cwd: repoRoot, env: childEnv, timeoutMs: 600_000 });
      fs.rmSync(copy, { recursive: true, force: true });
      if (!run.success || run.data.timedOut) { failures.push(`${rec.projectId}: evaluate did not finish`); continue; }
      const stdout = run.data.stdout;
      const start = stdout.indexOf('{');
      if (start < 0) { failures.push(`${rec.projectId}: no JSON (${scrubSecrets(run.data.stderr.slice(0, 300), secrets)})`); continue; }
      const parsed = JSON.parse(stdout.slice(start)) as { violations?: Record<string, unknown>[] };
      if (!Array.isArray(parsed.violations)) { failures.push(`${rec.projectId}: no violations array`); continue; }
      const violations = parsed.violations.map((v) => {
        const o: Record<string, unknown> = { ...v };
        if (typeof o.filePath === 'string') o.filePath = normaliseFindingPath(o.filePath, copy);
        if (typeof o.target === 'string') o.target = normaliseFindingPath(o.target, copy);
        return o;
      });
      const report = path.join(outDir, 'reports', `${rec.projectId.replace(/\//g, '_')}.json`);
      fs.writeFileSync(report, `${JSON.stringify({ projectId: rec.projectId, spec: path.relative(repoRoot, spec), mode: 'symbolic-only, v1.3 defaults', elapsedMs: Date.now() - started, violations }, null, 2)}\n`);
      jobs.push({ projectId: rec.projectId, projectRoot: src, spec, report, tsconfig: 'adr-032' });
      process.stdout.write(`${rec.projectId}: ${String(violations.length)} violations\n`);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    lock.release();
  }
  fs.writeFileSync(path.join(outDir, 'jobs.json'), `${JSON.stringify({ schemaVersion: 1, kind: 'e1', jobs }, null, 2)}\n`);
  process.stdout.write(`evaluated ${String(jobs.length)} cells; ${String(failures.length)} failures\n`);
  for (const f of failures) process.stderr.write(`${f}\n`);
  return failures.length === 0 ? 0 : 1;
}

void main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), secrets)}\n`);
  process.exitCode = 2;
});
