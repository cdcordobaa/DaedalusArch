/**
 * v1.3 human erosion trajectories (job M1, Docs/DiagnosticRuns/v1.3-human-erosion-2026-10-16.md): does the blocking
 * count of a human-written repository grow over its history under one fixed spec (the spec the external set pinned)?
 * No Neo4j, no LLM: every evaluation is `firewall evaluate --symbolic-only --engine cypher-interp --scoring v1.3`.
 * The clones are read, never edited: each sampled commit is exported with `git archive` into a scratch directory.
 * Entry file: no exports.
 *
 * Usage (repository root; clones and work trees under a scratch directory, never committed):
 *   node --import tsx scripts/v1.3/human-erosion.ts sample  --clones <dir>
 *   node --import tsx scripts/v1.3/human-erosion.ts run     --clones <dir> --specs <dir> --work <dir> [--id <id>]
 *   node --import tsx scripts/v1.3/human-erosion.ts analyse
 * `<clones>/<owner>__<name>` is a full clone of each selected repository; `<specs>/<id>.yaml` is the external set's
 * pinned spec (`results/v1.3-external/specs/<id>.yaml` at commit b8492a7a of branch v1.3-external-set).
 * Writes results/v1.3-human-erosion/{samples.json, evals/<id>.json, summary.json, summary.md, trajectories.svg}.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MIN_POINTS, SAMPLES, blockingFindingsOf, identitiesOf, intervalChanges, repoSlope, sampleIndices, signTest, smallMultiplesSvg,
} from './lib/human-erosion.js';
import type { EvalReport, Panel } from './lib/human-erosion.js';

const REPO = process.cwd();
const OUT = path.join(REPO, 'results/v1.3-human-erosion');
const PLAN = JSON.parse(fs.readFileSync(path.join(OUT, 'plan.json'), 'utf8')) as Plan;

interface PlanRepo { readonly id: string; readonly repo: string; readonly style: string; readonly sha: string; readonly root: string; readonly specSha256: string }
interface Plan { readonly repos: readonly PlanRepo[] }
interface Sample { readonly ordinal: number; readonly chainIndex: number; readonly sha: string; readonly date: string; readonly subject: string }
interface RepoSamples { readonly id: string; readonly chainLength: number; readonly firstSrcSha: string; readonly allCommitsUpToPin: number; readonly samples: readonly Sample[] }
interface CommitEval {
  readonly ordinal: number; readonly chainIndex: number; readonly sha: string; readonly date: string;
  readonly status: 'evaluated' | 'no-src' | 'no-tsconfig' | 'error';
  readonly exit: number | null; readonly error?: string;
  readonly srcTsFiles: number; readonly loc: number;
  readonly verdict?: string; readonly blocking?: number; readonly advisory?: number;
  readonly blockingByRule?: Record<string, number>;
  readonly layerMapped?: number; readonly layerUnmapped?: number; readonly layerCoverage?: number | null;
  readonly identities?: readonly string[];
  readonly findings?: readonly { ruleId: string; template?: string; filePath: string; target?: string; line?: number }[];
  readonly reportSha256?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function need(name: string): string {
  const v = arg(name);
  if (v === undefined) throw new Error(`--${name} is required`);
  return path.resolve(v);
}
function git(cwd: string, args: readonly string[]): string {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${r.stderr}`);
  return r.stdout;
}
const cloneDir = (clones: string, r: PlanRepo): string => path.join(clones, r.repo.replace('/', '__'));
const srcPrefix = (r: PlanRepo): string => (r.root === '.' ? 'src/' : `${r.root}/src/`);

/** The srcTsFiles definition of the external set: .ts under src/, no .d.ts, no tests. */
function isSrcTs(rel: string): boolean {
  if (!rel.endsWith('.ts') || rel.endsWith('.d.ts')) return false;
  if (/\.(spec|test)\.ts$/.test(rel)) return false;
  return !/(^|\/)(__tests__|test|tests)\//.test(rel);
}

function sample(): void {
  const clones = need('clones');
  const out: RepoSamples[] = [];
  for (const r of PLAN.repos) {
    const dir = cloneDir(clones, r);
    const chainAll = git(dir, ['rev-list', '--first-parent', '--reverse', r.sha]).trim().split('\n');
    const prefix = srcPrefix(r);
    // Oldest first-parent commit whose tree holds a counted .ts file under src/.
    let start = -1;
    for (let i = 0; i < chainAll.length && start < 0; i++) {
      const files = git(dir, ['ls-tree', '-r', '--name-only', chainAll[i] ?? '', '--', prefix]).split('\n');
      if (files.some((f) => f.startsWith(prefix) && isSrcTs(f.slice(prefix.length)))) start = i;
    }
    if (start < 0) throw new Error(`${r.id}: no commit on the first-parent chain has src/ .ts files`);
    const chain = chainAll.slice(start);
    const samples = sampleIndices(chain.length).map((idx, ordinal) => {
      const sha = chain[idx] ?? '';
      const [date = '', subject = ''] = git(dir, ['show', '-s', '--format=%cI%x00%s', sha]).trim().split('\u0000');
      return { ordinal, chainIndex: idx, sha, date, subject };
    });
    out.push({ id: r.id, chainLength: chain.length, firstSrcSha: chain[0] ?? '', allCommitsUpToPin: Number(git(dir, ['rev-list', '--count', r.sha]).trim()), samples });
    process.stdout.write(`${r.id}: chain ${String(chain.length)} (first-parent from first src/ commit), samples ${samples.map((s) => s.chainIndex).join(',')}\n`);
  }
  fs.writeFileSync(path.join(OUT, 'samples.json'), JSON.stringify({ samplesPerRepo: SAMPLES, repos: out }, null, 1) + '\n');
}

function countSrc(root: string): { files: number; loc: number } {
  const src = path.join(root, 'src');
  if (!fs.existsSync(src)) return { files: 0, loc: 0 };
  let files = 0; let loc = 0;
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
      const rel = path.relative(src, p).split(path.sep).join('/');
      if (!e.isFile() || !isSrcTs(rel)) continue;
      files++;
      loc += fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').length;
    }
  };
  walk(src);
  return { files, loc };
}

function run(): void {
  const clones = need('clones'); const specs = need('specs'); const work = need('work');
  const only = arg('id');
  const samples = JSON.parse(fs.readFileSync(path.join(OUT, 'samples.json'), 'utf8')) as { repos: RepoSamples[] };
  fs.mkdirSync(path.join(OUT, 'evals'), { recursive: true });
  for (const r of PLAN.repos) {
    if (only !== undefined && r.id !== only) continue;
    const spec = path.join(specs, `${r.id}.yaml`);
    const specHash = createHash('sha256').update(fs.readFileSync(spec)).digest('hex');
    if (specHash !== r.specSha256) throw new Error(`${r.id}: spec hash ${specHash} differs from the plan's ${r.specSha256}`);
    const rs = samples.repos.find((x) => x.id === r.id);
    if (rs === undefined) throw new Error(`${r.id}: not in samples.json`);
    const evals: CommitEval[] = [];
    for (const s of rs.samples) {
      const tree = path.join(work, r.id, String(s.ordinal));
      fs.rmSync(tree, { recursive: true, force: true });
      fs.mkdirSync(tree, { recursive: true });
      const tar = spawnSync('sh', ['-c', `git -C "${cloneDir(clones, r)}" archive ${s.sha} | tar -x -C "${tree}"`], { encoding: 'utf8' });
      if (tar.status !== 0) throw new Error(`${r.id}@${s.sha}: archive failed: ${tar.stderr}`);
      const root = path.join(tree, r.root);
      const { files, loc } = countSrc(root);
      const base = { ordinal: s.ordinal, chainIndex: s.chainIndex, sha: s.sha, date: s.date, srcTsFiles: files, loc };
      if (files === 0) { evals.push({ ...base, status: 'no-src', exit: null }); continue; }
      if (!fs.existsSync(path.join(root, 'tsconfig.json'))) { evals.push({ ...base, status: 'no-tsconfig', exit: null }); continue; }
      const ev = spawnSync('npx', ['tsx', 'bin/firewall.ts', 'evaluate', '--post-seal', 'off', '--project', root, '--spec', spec, '--symbolic-only',
        '--engine', 'cypher-interp', '--scoring', 'v1.3', '--format', 'json'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28, env: childEnv() });
      let report: (EvalReport & Record<string, unknown>) | null = null;
      try { report = JSON.parse(ev.stdout) as EvalReport & Record<string, unknown>; } catch { report = null; }
      if ((ev.status !== 0 && ev.status !== 1) || report === null || !Array.isArray(report.violations)) {
        evals.push({ ...base, status: 'error', exit: ev.status, error: (ev.stderr || ev.stdout).trim().split('\n').slice(-6).join(' | ').slice(0, 800) });
        process.stdout.write(`${r.id} #${String(s.ordinal)} ${s.sha.slice(0, 8)} ERROR exit ${String(ev.status)}\n`);
        continue;
      }
      const bf = blockingFindingsOf(report);
      const byRule: Record<string, number> = {};
      for (const f of bf) byRule[f.ruleId] = (byRule[f.ruleId] ?? 0) + 1;
      const la = report.layerAnnotation;
      const total = la === undefined ? 0 : la.mapped + la.unmapped;
      evals.push({
        ...base, status: 'evaluated', exit: ev.status, verdict: report.tiers.verdict, blocking: bf.length,
        advisory: report.violations.length - bf.length, blockingByRule: byRule,
        ...(la !== undefined ? { layerMapped: la.mapped, layerUnmapped: la.unmapped, layerCoverage: total === 0 ? null : Math.round((la.mapped / total) * 1e4) / 1e4 } : {}),
        identities: identitiesOf(bf),
        findings: bf.map((f) => ({ ruleId: f.ruleId, ...(f.template !== undefined ? { template: f.template } : {}), filePath: f.filePath, ...(f.target !== undefined ? { target: f.target } : {}), ...(f.line !== undefined ? { line: f.line } : {}) })),
        reportSha256: createHash('sha256').update(stableReport(report)).digest('hex'),
      });
      process.stdout.write(`${r.id} #${String(s.ordinal)} ${s.sha.slice(0, 8)} files ${String(files)} loc ${String(loc)} blocking ${String(bf.length)}\n`);
    }
    fs.writeFileSync(path.join(OUT, 'evals', `${r.id}.json`), JSON.stringify({ id: r.id, sha: r.sha, specSha256: specHash, commits: evals }, null, 1) + '\n');
    fs.rmSync(path.join(work, r.id), { recursive: true, force: true });
  }
}

/** A minimal child environment: the symbolic-only, in-process evaluation needs no key, proxy or database variable. */
function childEnv(): NodeJS.ProcessEnv {
  const keep = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ'];
  const env: NodeJS.ProcessEnv = {};
  for (const k of keep) if (process.env[k] !== undefined) env[k] = process.env[k];
  return env;
}

/** The report minus fields that vary run to run (timings, ids, paths), so its hash is a determinism check. */
function stableReport(r: Record<string, unknown>): string {
  const drop = new Set(['runId', 'projectPath', 'durationMs', 'timings', 'elapsedMs', 'startedAt', 'finishedAt', 'executionTimeMs', 'totalMs']);
  return JSON.stringify(r, (k, v: unknown) => (drop.has(k) ? undefined : v));
}

function analyse(): void {
  const rows: Record<string, unknown>[] = [];
  const panels: Panel[] = [];
  const slopes: (number | null)[] = [];
  const countSlopes: (number | null)[] = [];
  const md: string[] = [];
  for (const r of PLAN.repos) {
    const e = JSON.parse(fs.readFileSync(path.join(OUT, 'evals', `${r.id}.json`), 'utf8')) as { commits: CommitEval[] };
    const ids = e.commits.map((c) => (c.status === 'evaluated' ? (c.identities ?? []) : null));
    const changes = intervalChanges(ids);
    const per = e.commits.map((c, i) => {
      const kloc = c.loc / 1000;
      const density = c.status === 'evaluated' && kloc > 0 ? Math.round(((c.blocking ?? 0) / kloc) * 1e4) / 1e4 : null;
      return { ...c, blockingPerKloc: density, newIdentities: changes[i]?.new ?? null, goneIdentities: changes[i]?.gone ?? null };
    });
    const slope = repoSlope(per.map((c) => ({ x: c.chainIndex, y: c.blockingPerKloc })));
    const countSlope = repoSlope(per.map((c) => ({ x: c.chainIndex, y: c.status === 'evaluated' ? (c.blocking ?? 0) : null })));
    slopes.push(slope); countSlopes.push(countSlope);
    const evaluated = per.filter((c) => c.status === 'evaluated');
    const newTotal = per.reduce((a, c) => a + (c.newIdentities ?? 0), 0);
    rows.push({ id: r.id, style: r.style, evaluated: evaluated.length, notEvaluated: per.length - evaluated.length, slopeBlockingPerKloc: slope, slopeBlockingCount: countSlope, newIdentitiesAfterFirst: newTotal, commits: per.map(({ identities: _i, findings: _f, ...rest }) => rest) });
    panels.push({ id: r.id, style: r.style, points: per.map((c) => ({ x: c.chainIndex, y: c.blockingPerKloc })), slope });
    md.push(`### ${r.id} (${r.style})`, '', `Slope of blocking/KLOC on commit index: ${slope === null ? 'n/a' : String(slope)}; slope of the raw blocking count: ${countSlope === null ? 'n/a' : String(countSlope)}; new identities after the first evaluated sample: ${String(newTotal)}.`, '',
      '| # | idx | commit | date | status | src .ts | LOC | blocking | /KLOC | new | gone | layer cov. | blocking by rule |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const c of per) {
      md.push(`| ${String(c.ordinal)} | ${String(c.chainIndex)} | \`${c.sha.slice(0, 8)}\` | ${c.date.slice(0, 10)} | ${c.status}${c.error !== undefined ? ' (see evals)' : ''} | ${String(c.srcTsFiles)} | ${String(c.loc)} | ${c.blocking === undefined ? '–' : String(c.blocking)} | ${c.blockingPerKloc === null ? '–' : String(c.blockingPerKloc)} | ${c.newIdentities === null ? '–' : String(c.newIdentities)} | ${c.goneIdentities === null ? '–' : String(c.goneIdentities)} | ${c.layerCoverage === undefined || c.layerCoverage === null ? '–' : String(c.layerCoverage)} | ${c.blockingByRule === undefined ? '–' : Object.entries(c.blockingByRule).sort().map(([k, v]) => `${k} ${String(v)}`).join(', ') || '0'} |`);
    }
    md.push('');
  }
  const primary = signTest(slopes);
  const secondary = signTest(countSlopes);
  const summary = { samplesPerRepo: SAMPLES, minPoints: MIN_POINTS, primary: { measure: 'OLS slope of blocking/KLOC on first-parent commit index', ...primary }, secondary: { measure: 'OLS slope of raw blocking count on first-parent commit index', ...secondary }, repos: rows };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
  const head = [
    '# Human erosion trajectories: per-commit tables (generated by scripts/v1.3/human-erosion.ts analyse)', '',
    `Primary (sign test, two-sided, exact, over per-repo slopes of blocking/KLOC): ${String(primary.positive)} positive, ${String(primary.negative)} negative, ${String(primary.zero)} zero, ${String(primary.missing)} not computable; p = ${primary.p === null ? 'n/a' : String(primary.p)}.`, '',
    `Secondary (raw blocking count): ${String(secondary.positive)} positive, ${String(secondary.negative)} negative, ${String(secondary.zero)} zero, ${String(secondary.missing)} not computable; p = ${secondary.p === null ? 'n/a' : String(secondary.p)}.`, '',
  ];
  fs.writeFileSync(path.join(OUT, 'summary.md'), [...head, ...md].join('\n'));
  fs.writeFileSync(path.join(OUT, 'trajectories.svg'), smallMultiplesSvg(panels));
  process.stdout.write(head.join('\n') + '\n');
}

const cmd = process.argv[2];
if (cmd === 'sample') sample();
else if (cmd === 'run') run();
else if (cmd === 'analyse') analyse();
else throw new Error('usage: human-erosion.ts sample|run|analyse');
