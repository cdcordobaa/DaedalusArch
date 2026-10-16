/**
 * v1.3-validity-predictive: per-file exposure and structural controls at a snapshot.
 *
 *   node --import tsx scripts/v1.3/predictive/exposure.ts --id <id> --label T|T_alt --snapshot <dir>
 *
 * <dir> is a `git archive` extraction (with a `.snapshot-sha` file) of the project's repository at the selection.json SHA for <label> (outside this repo).
 * Steps: harness tsconfig (flattenTsconfig, include = the source directory, tests and migrations excluded);
 * `firewall evaluate --symbolic-only --engine cypher-interp` with the committed spec; the default APG for
 * file-level fan-in/out; one CSV row per program file. Outputs under results/v1.3-validity-predictive/.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import ts from 'typescript';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { specExcludePathsFromYaml } from '../../../src/spec-parser/index.js';
import { flattenTsconfig, TEST_EXCLUDES } from '../lib/wild.js';

const REPO = process.cwd();
const OUT = path.join(REPO, 'results/v1.3-validity-predictive');
const HARNESS = 'tsconfig.predictive.json';
const EXTRA_EXCLUDES = ['**/migrations/**', '**/seeds/**', '**/seed/**', '**/__fixtures__/**'];

interface Entry { id: string; repo: string; root: string; sourceDir: string }
interface Violation { functionId: string; filePath: string; target?: string; message: string }
interface Report {
  violations: Violation[];
  tiers: { blocking: { rules: { functionId: string }[] }; advisory?: { rules: { functionId: string }[] } };
  layerAnnotation: { mapped: number; unmapped: number; unmappedFiles: string[] };
  parseCoverage: unknown; importResolution: unknown; durationMs: number; verdict: string;
}

const arg = (n: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === undefined) throw new Error(`--${n} is required`);
  return v;
};
const posix = (p: string): string => p.split(path.sep).join('/');

/** Members of a violation that the file attribution counts: the cycle members for FF-S02 (comma list), else filePath. */
export function sourceFiles(v: Violation): string[] {
  return v.filePath.includes(',') ? [...new Set(v.filePath.split(',').map((s) => s.trim()).filter(Boolean))] : [v.filePath];
}

/** Every package.json under the snapshot (no node_modules: dependencies are not installed). */
function packageJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name === 'node_modules' || d.name === '.git') continue;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...packageJsonFiles(p));
    else if (d.name === 'package.json') out.push(p);
  }
  return out;
}

function workspacePackageFile(clone: string, spec: string): string | undefined {
  const parts = spec.split('/');
  const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0] ?? '';
  const rest = parts.slice(spec.startsWith('@') ? 2 : 1).join('/');
  for (const abs of packageJsonFiles(clone)) {
    if (!fs.existsSync(abs)) continue;
    try {
      if ((JSON.parse(fs.readFileSync(abs, 'utf8')) as { name?: string }).name === name) {
        const target = path.join(path.dirname(abs), rest === '' ? 'tsconfig.json' : rest.endsWith('.json') ? rest : `${rest}.json`);
        return fs.existsSync(target) ? target : undefined;
      }
    } catch { /* not JSON */ }
  }
  return undefined;
}

async function main(): Promise<void> {
  const id = arg('id');
  const label = arg('label');
  // prespec addendum 4: cypher-interp unless a capped run falls back to the Neo4j reference engine
  const ei = process.argv.indexOf('--engine');
  const engine = ei >= 0 ? (process.argv[ei + 1] ?? 'cypher-interp') : 'cypher-interp';
  const clone = fs.realpathSync(arg('snapshot'));
  const sel = JSON.parse(fs.readFileSync(path.join(OUT, 'selection.json'), 'utf8')) as { entries: (Entry & Record<string, { sha: string }>)[] };
  const e = sel.entries.find((x) => x.id === id);
  if (e === undefined) throw new Error(`unknown id ${id}`);
  // The snapshot is a `git archive` extraction; the SHA it was taken from is recorded next to it.
  const head = fs.readFileSync(path.join(clone, '.snapshot-sha'), 'utf8').trim();
  if (head !== e[label]?.sha) throw new Error(`snapshot HEAD ${head} is not ${label} ${String(e[label]?.sha)}`);
  const project = path.join(clone, e.root);
  const srcRel = posix(path.relative(project, path.join(clone, e.sourceDir)));

  // 1. Harness tsconfig.
  const reader = {
    read: (p: string): Record<string, unknown> | undefined => {
      if (!fs.existsSync(p)) return undefined;
      const r = ts.readConfigFile(p, (f) => fs.readFileSync(f, 'utf8'));
      return r.error !== undefined ? undefined : (r.config as Record<string, unknown>);
    },
    resolvePackage: (s: string): string | undefined => workspacePackageFile(clone, s),
  };
  const flat = flattenTsconfig(path.join(project, 'tsconfig.json'), project, reader, [`${srcRel}/**/*.ts`, `${srcRel}/**/*.tsx`]);
  const tsconfig = { ...flat.tsconfig, exclude: [...TEST_EXCLUDES, '**/*.e2e-spec.ts', ...EXTRA_EXCLUDES.map((x) => `${srcRel}/${x}`)] };
  const harness = path.join(project, HARNESS);
  fs.writeFileSync(harness, JSON.stringify(tsconfig, null, 2) + '\n');
  const parsed = ts.getParsedCommandLineOfConfigFile(harness, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
  const program = (parsed?.fileNames ?? []).map((f) => posix(path.relative(project, f))).filter((f) => !f.endsWith('.d.ts')).sort();

  // 2. The tool.
  const spec = path.join(OUT, 'specs', `${id}.yaml`);
  const t0 = Date.now();
  const run = spawnSync('npx', ['tsx', 'bin/firewall.ts', 'evaluate', '--project', project, '--spec', spec, '--tsconfig', harness,
    '--symbolic-only', '--engine', engine, '--format', 'json', ...(engine === 'neo4j' ? ['--neo4j-uri', 'bolt://127.0.0.1:7687'] : [])],
  { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 30, env: { ...process.env, APG_STORE_PATH: path.join(clone, '.apg-store') } });
  const wallMs = Date.now() - t0;
  if (run.status !== 0 && run.status !== 1) throw new Error(`evaluate exit ${String(run.status)}: ${run.stderr.slice(0, 2000)}`);
  const report = JSON.parse(run.stdout) as Report;
  fs.mkdirSync(path.join(OUT, 'findings'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'findings', `${id}.${label}.json.gz`), zlib.gzipSync(run.stdout));

  // 3. Default APG for fan-in / fan-out (the spec's exclusions, as the pipeline passes them).
  const excludes = specExcludePathsFromYaml(fs.readFileSync(spec, 'utf8'));
  const apg = await extractAPG(project, { excludePatterns: excludes }, harness);
  if (!apg.success) throw new Error(`extractAPG: ${apg.errors.map((x) => x.message).join('; ')}`);
  const fileOf = new Map<string, string>();
  for (const n of apg.data.nodes) if (n.type === 'File') fileOf.set(n.id, posix(path.isAbsolute(n.filePath) ? path.relative(project, n.filePath) : n.filePath));
  const fanIn = new Map<string, Set<string>>();
  const fanOut = new Map<string, Set<string>>();
  for (const ed of apg.data.edges) {
    if (ed.type !== 'IMPORTS' && ed.type !== 'RE_EXPORTS') continue;
    const s = fileOf.get(ed.sourceId);
    const t = fileOf.get(ed.targetId);
    if (s === undefined || t === undefined || s === t) continue;
    (fanOut.get(s) ?? fanOut.set(s, new Set()).get(s)!).add(t);
    (fanIn.get(t) ?? fanIn.set(t, new Set()).get(t)!).add(s);
  }

  // 4. Per-file attribution.
  const blocking = new Set(report.tiers.blocking.rules.map((r) => r.functionId));
  const unmapped = new Set(report.layerAnnotation.unmappedFiles.map(posix));
  const rules = [...new Set(report.violations.map((v) => v.functionId))].sort();
  const row = new Map<string, { e1n: number; e1t: number; e2n: number; per: Map<string, number> }>();
  const get = (f: string): { e1n: number; e1t: number; e2n: number; per: Map<string, number> } => {
    let r = row.get(f);
    if (r === undefined) { r = { e1n: 0, e1t: 0, e2n: 0, per: new Map() }; row.set(f, r); }
    return r;
  };
  let unattributed = 0;
  for (const v of report.violations) {
    const members = sourceFiles(v);
    const isBlocking = blocking.has(v.functionId);
    for (const f of members) {
      const r = get(f);
      if (isBlocking) { r.e1n += 1; r.e1t += 1; } else r.e2n += 1;
      r.per.set(v.functionId, (r.per.get(v.functionId) ?? 0) + 1);
    }
    if (isBlocking && v.target !== undefined && !members.includes(v.target)) get(v.target).e1t += 1;
    if (!members.some((f) => program.includes(f))) unattributed += 1;
  }
  const header = ['file', 'mapped', 'loc', 'fan_in', 'fan_out', 'e1n', 'e1t', 'e2n', ...rules.map((r) => `n_${r}`)];
  const lines = [header.join(',')];
  for (const f of program) {
    const src = fs.readFileSync(path.join(project, f), 'utf8');
    const loc = src.split('\n').filter((l) => l.trim() !== '').length;
    const r = row.get(f) ?? { e1n: 0, e1t: 0, e2n: 0, per: new Map<string, number>() };
    lines.push([JSON.stringify(f), unmapped.has(f) ? 0 : 1, loc, fanIn.get(f)?.size ?? 0, fanOut.get(f)?.size ?? 0, r.e1n, r.e1t, r.e2n,
      ...rules.map((x) => r.per.get(x) ?? 0)].join(','));
  }
  fs.mkdirSync(path.join(OUT, 'exposure'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'exposure', `${id}.${label}.csv`), lines.join('\n') + '\n');
  const meta = {
    id, label, sha: head, sourceDir: e.sourceDir, programFiles: program.length, apgFiles: fileOf.size,
    mapped: report.layerAnnotation.mapped, unmapped: report.layerAnnotation.unmapped, verdict: report.verdict,
    violations: report.violations.length, blockingRules: [...blocking], unattributedViolations: unattributed,
    engine, failedFunctions: (report as unknown as { functionExecution: { failed: { functionId: string }[] } }).functionExecution.failed.map((f) => f.functionId),
    parseCoverage: report.parseCoverage, importResolution: report.importResolution, evaluateWallMs: wallMs, evaluateExit: run.status,
    tsconfigNotes: flat.notes.map((n) => n.split(posix(clone) + '/').join('')),
  };
  fs.writeFileSync(path.join(OUT, 'exposure', `${id}.${label}.meta.json`), JSON.stringify(meta, null, 1) + '\n');
  process.stdout.write(`${id}\t${label}\t${String(program.length)} files\t${String(report.violations.length)} violations\t${String(wallMs)} ms\n`);
}

main().catch((err: unknown) => { process.stderr.write(`${String(err instanceof Error ? err.stack : err)}\n`); process.exit(2); });
