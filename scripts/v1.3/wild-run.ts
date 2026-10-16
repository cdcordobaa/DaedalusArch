/**
 * v1.3 real-world ("wild") evidence run over public TypeScript backends (Docs/DiagnosticRuns/v1.3-wild-2026-10-16.md).
 * No Neo4j, no LLM; the cloned repositories are read, never edited, except for the one harness tsconfig this script
 * writes next to each analysis root (`tsconfig.wild.json`, in the temporary clone only). Entry file: no exports.
 *
 * Usage (repository root; clones under a temporary directory, never committed):
 *   node --import tsx scripts/v1.3/wild-run.ts prepare  --repos <dir> [--selection results/v1.3-wild/selection.json]
 *   node --import tsx scripts/v1.3/wild-run.ts analyse  --repos <dir> --id <id>   (ISE, APG v2 templates, cheap proxies)
 *   node --import tsx scripts/v1.3/wild-run.ts fidelity --repos <dir> --id <id>   (scripts/v1.3/graph-fidelity.ts --views)
 * Writes results/v1.3-wild/repos/<id>/{harness.json, ise.json, ise-spec.yaml, apg2.json, cheap.json, cost.json} and
 * results/v1.3-wild/fidelity/<id>/ (the graph-fidelity outputs). Run one repository per process: `cost.json` holds the
 * process's peak RSS.
 *
 * Pipeline per repository (the tool used as a newcomer would: no hand-written spec):
 *   1. ISE on a snapshot (`src/` and the harness tsconfig only): style, confidence, emitted spec.
 *   2. The emitted spec's layer model drives APG v2 (components: the spec's layers and DDD contexts plus one folder
 *      component per top-level folder under src/) and the in-memory mirrors of the nine APG v2 templates.
 *   3. The cheap proxies (pass 0.5) on the same APG and layer model.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import ts from 'typescript';
import { extractAPG, V13_APG2_OPTIONS, componentsFromLayerModel } from '../../src/apg-extractor/index.js';
import { folderComponents } from '../../src/apg-extractor/apg2/components.js';
import type { APGResult } from '../../src/shared/types/apg.js';
import { APG2_IN_MEMORY, apg2Params, memGraph } from '../../src/fitness-compiler/apg2-in-memory.js';
import { enrichCheap, openProject } from '../../src/apg-enrich/cheap/index.js';
import { inferSpec } from '../../src/ise/infer.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import { apiVisibleInImports, flattenTsconfig, memberLine } from './lib/wild.js';

const REPO = process.cwd();
const OUT = path.join(REPO, 'results/v1.3-wild');
const HARNESS = 'tsconfig.wild.json';
const FLAGS_GZ = 'cheap-flags.json.gz';
const FLAGS_INLINE_MAX = 2000;

interface SelectionEntry {
  readonly id: string;
  readonly repo: string;
  readonly url: string;
  readonly sha: string;
  /** Analysis root inside the clone ('.' for the repository root). */
  readonly root: string;
  /** The repository's own tsconfig the harness tsconfig is flattened from, relative to the analysis root. */
  readonly tsconfig: string;
  readonly include?: string[];
}

function arg(name: string, argv: readonly string[]): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const writeJson = (p: string, v: unknown): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n');
};
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const posix = (p: string): string => p.split(path.sep).join('/');

function rootOf(reposDir: string, e: SelectionEntry): string {
  return fs.realpathSync(path.join(reposDir, e.id, e.root));
}

/** A tsconfig named by a package specifier, found in a workspace package of the checkout (no node_modules). */
function workspacePackageFile(clone: string, spec: string): string | undefined {
  const parts = spec.split('/');
  const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0] ?? '';
  const rest = parts.slice(spec.startsWith('@') ? 2 : 1).join('/');
  const found = spawnSync('git', ['ls-files', '*package.json'], { cwd: clone, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  for (const f of found) {
    const abs = path.join(clone, f);
    if (!fs.existsSync(abs)) continue;
    try {
      if ((JSON.parse(fs.readFileSync(abs, 'utf8')) as { name?: string }).name === name) {
        const target = path.join(path.dirname(abs), rest === '' ? 'tsconfig.json' : rest);
        return fs.existsSync(target) ? target : undefined;
      }
    } catch { /* not JSON: skip */ }
  }
  return undefined;
}

// ── prepare ──────────────────────────────────────────────────────────────────
function prepare(reposDir: string, sel: readonly SelectionEntry[]): void {
  for (const e of sel) {
    const clone = path.join(reposDir, e.id);
    if (!fs.existsSync(clone)) { writeJson(path.join(OUT, 'repos', e.id, 'harness.json'), { id: e.id, error: 'clone missing' }); continue; }
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: clone, encoding: 'utf8' }).stdout.trim();
    const root = rootOf(reposDir, e);
    const reader = {
      read: (p: string): Record<string, unknown> | undefined => {
        if (!fs.existsSync(p)) return undefined;
        const r = ts.readConfigFile(p, (f) => fs.readFileSync(f, 'utf8'));
        return r.error !== undefined ? undefined : (r.config as Record<string, unknown>);
      },
      resolvePackage: (spec: string): string | undefined => workspacePackageFile(clone, spec),
    };
    const flat = flattenTsconfig(path.join(root, e.tsconfig), root, reader, e.include);
    const harness = path.join(root, HARNESS);
    fs.writeFileSync(harness, JSON.stringify(flat.tsconfig, null, 2) + '\n');
    const parsed = ts.getParsedCommandLineOfConfigFile(harness, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
    const files = (parsed?.fileNames ?? []).map((f) => posix(path.relative(root, f))).filter((f) => !f.endsWith('.d.ts'));
    writeJson(path.join(OUT, 'repos', e.id, 'harness.json'), {
      id: e.id, sha: e.sha, headMatches: head === e.sha, tsconfig: flat.tsconfig,
      chain: flat.chain.map((c) => posix(path.relative(clone, c))), notes: flat.notes.map((n) => n.split(posix(clone) + "/").join("")),
      sourceFiles: files.length,
    });
    process.stdout.write(`${e.id}\t${String(files.length)} files\t${head === e.sha ? 'sha ok' : `SHA MISMATCH ${head}`}\t${flat.notes.join('; ')}\n`);
  }
}

// ── analyse ──────────────────────────────────────────────────────────────────

/** A snapshot for ISE: `src/` and the harness tsconfig (as tsconfig.json), nothing else (src/ise/snapshot.ts rules). */
function iseSnapshot(root: string): { dir: string; dispose: () => void } {
  const holder = fs.mkdtempSync(path.join(os.tmpdir(), 'wild-ise-'));
  const dir = path.join(holder, 'project');
  fs.mkdirSync(dir);
  fs.cpSync(path.join(root, 'src'), path.join(dir, 'src'), { recursive: true, filter: (p) => !p.includes(`${path.sep}node_modules`) });
  fs.copyFileSync(path.join(root, HARNESS), path.join(dir, 'tsconfig.json'));
  return { dir, dispose: () => { fs.rmSync(holder, { recursive: true, force: true }); } };
}

/** File-level IMPORTS/RE_EXPORTS adjacency of an APG (both views), by repo-relative path. */
function importPairs(apg: APGResult, rel: (p: string) => string): Set<string> {
  const file = new Map<string, string>();
  for (const n of apg.nodes) if (n.type === 'File') file.set(n.id, rel(n.filePath));
  const out = new Set<string>();
  for (const e of apg.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') continue;
    const s = file.get(e.sourceId);
    const t = file.get(e.targetId);
    if (s !== undefined && t !== undefined) out.add(`${s}|${t}`);
  }
  return out;
}

/** File → the packages it imports (APG Package targets of IMPORTS / RE_EXPORTS). */
function packageImports(apg: APGResult, rel: (p: string) => string): Map<string, Set<string>> {
  const file = new Map<string, string>();
  const pkg = new Map<string, string>();
  for (const n of apg.nodes) {
    if (n.type === 'File') file.set(n.id, rel(n.filePath));
    else if (n.type === 'Package') pkg.set(n.id, n.name);
  }
  const out = new Map<string, Set<string>>();
  for (const e of apg.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') continue;
    const f = file.get(e.sourceId);
    const p = pkg.get(e.targetId);
    if (f === undefined || p === undefined) continue;
    const set = out.get(f) ?? new Set<string>();
    set.add(p);
    out.set(f, set);
  }
  return out;
}

async function analyse(reposDir: string, e: SelectionEntry): Promise<void> {
  const dir = path.join(OUT, 'repos', e.id);
  const root = rootOf(reposDir, e);
  const tsconfig = path.join(root, HARNESS);
  const t: Record<string, number> = {};
  const lap = (k: string, t0: number): void => { t[k] = Math.round(performance.now() - t0); };
  const rel = (p: string): string => {
    const f = posix(p);
    const r = posix(root);
    return (f.startsWith(`${r}/`) ? f.slice(r.length + 1) : f).replace(/^\.\//, '');
  };
  const failures: string[] = [];

  // 1. ISE.
  let t0 = performance.now();
  const snap = iseSnapshot(root);
  let inf: Awaited<ReturnType<typeof inferSpec>>;
  try {
    inf = await inferSpec(snap.dir, { presetsDir: path.join(REPO, 'presets') });
  } finally {
    snap.dispose();
  }
  lap('ise', t0);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ise-spec.yaml'), inf.specYaml);
  writeJson(path.join(dir, 'ise.json'), {
    id: e.id, style: inf.style,
    confidence: inf.classification.ranked[0]?.confidence ?? 0,
    ranked: inf.classification.ranked.map((r) => ({ style: r.style, points: r.points, confidence: r.confidence, evidence: r.evidence })),
    mapping: { mode: inf.mapping.mode, units: inf.mapping.units.map((u) => ({ unit: u.unit, layer: u.layer, source: u.source, confidence: u.confidence })) },
    ddd: inf.ddd !== undefined ? { contexts: inf.ddd.contexts.map((c) => c.name), aggregates: inf.ddd.aggregates.length } : null,
    features: inf.classification.features,
    specValid: inf.check.valid, specErrors: inf.check.errors, specWarnings: inf.check.warnings,
    majorityVoteRules: inf.majorityVote.length,
    files: inf.graph.files.length,
  });

  // 2. The emitted spec's layer model.
  const specFile = path.join(os.tmpdir(), `wild-spec-${e.id}-${String(process.pid)}.yaml`);
  fs.writeFileSync(specFile, inf.specYaml);
  const parsed = await parseSpec({ specFilePath: specFile });
  fs.rmSync(specFile, { force: true });
  if (!parsed.success) throw new Error(`ISE spec does not parse: ${parsed.errors.map((x) => x.message).join('; ')}`);
  const layerModel = parsed.data.layerModel;
  const excludes = specExcludePathsFromYaml(inf.specYaml);

  // 3. APG v2 extraction and the nine templates in memory.
  t0 = performance.now();
  const components = [...componentsFromLayerModel(layerModel), ...folderComponents(inf.graph.files)];
  const res = await extractAPG(root, { ...V13_APG2_OPTIONS, components, excludePatterns: excludes }, tsconfig);
  lap('extractApg2', t0);
  if (!res.success) throw new Error(`APG v2 extraction failed: ${res.errors.map((x) => x.message).join('; ')}`);
  const apg = res.data;
  const pairs = importPairs(apg, rel);
  const linked = (a: string, b: string): boolean => pairs.has(`${a}|${b}`) || pairs.has(`${b}|${a}`);
  const pkgImports = packageImports(apg, rel);
  t0 = performance.now();
  const g = memGraph(apg, layerModel);
  const p = apg2Params(layerModel);
  const contentCache = new Map<string, string>();
  const content = (f: string): string => {
    let c = contentCache.get(f);
    if (c === undefined) { c = fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : ''; contentCache.set(f, c); }
    return c;
  };
  // Component → its files and the file-level import edges between components (evidence for component-level rows).
  const compFiles = new Map<string, string[]>();
  for (const be of g.edgesOf('BELONGS_TO')) {
    const c = g.node(be.targetId);
    const key = `${String(c.properties.kind)}:${c.name}`;
    const l = compFiles.get(key) ?? [];
    l.push(rel(g.node(be.sourceId).filePath));
    compFiles.set(key, l);
  }
  const fileComp = new Map<string, Map<string, string>>();
  for (const [key, files] of compFiles) {
    const [kind, name] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    for (const f of files) {
      const m = fileComp.get(f) ?? new Map<string, string>();
      m.set(kind, name);
      fileComp.set(f, m);
    }
  }
  const importLines = new Map<string, { file: string; target: string; line: number }[]>();
  const fileById = new Map(apg.nodes.filter((n) => n.type === 'File').map((n) => [n.id, rel(n.filePath)]));
  for (const ie of apg.edges) {
    if (ie.type !== 'IMPORTS' || ie.properties.viaReExport === true) continue;
    const s = fileById.get(ie.sourceId);
    const tt = fileById.get(ie.targetId);
    if (s === undefined || tt === undefined) continue;
    for (const [kind, sc] of fileComp.get(s) ?? []) {
      const tc = fileComp.get(tt)?.get(kind);
      if (tc === undefined || tc === sc) continue;
      const k = `${kind}:${sc}>${tc}`;
      const l = importLines.get(k) ?? [];
      l.push({ file: s, target: tt, line: typeof ie.properties.line === 'number' ? ie.properties.line : 0 });
      importLines.set(k, l);
    }
  }
  const apg2: Record<string, unknown[]> = {};
  for (const [name, fn] of APG2_IN_MEMORY) {
    apg2[name] = fn(g, p).map((row) => {
      const r: Record<string, unknown> = { ...row };
      for (const k of ['filePath', 'target']) if (typeof r[k] === 'string' && !(r[k] as string).startsWith('component:')) r[k] = rel(r[k] as string);
      let file: string | undefined = typeof r.filePath === 'string' && !(r.filePath as string).startsWith('component:') && r.filePath !== r.component ? r.filePath as string : undefined;
      let line = typeof r.line === 'number' ? r.line : 0;
      if (file !== undefined && line === 0 && typeof r.member === 'string') line = memberLine(content(file), r.member);
      let importGraphSees: boolean | null = null;
      let evidence: unknown;
      if (name === 'boundary-type-leak' && file !== undefined && typeof r.target === 'string') importGraphSees = r.target === file || linked(file, r.target);
      if ((name === 'io-outside-adapters' || name === 'nondeterminism-in-core') && file !== undefined) {
        importGraphSees = apiVisibleInImports(Array.isArray(r.apis) ? r.apis.map(String) : [], pkgImports.get(file) ?? new Set());
      }
      if (name === 'undeclared-async-coupling' && file !== undefined && typeof r.target === 'string') {
        importGraphSees = linked(file, r.target);
        if (line === 0 && typeof r.channel === 'string') {
          const i = content(file).split('\n').findIndex((l) => l.includes(r.channel as string));
          line = i + 1;
        }
      }
      if (name === 'component-adp-cycle' || name === 'component-sdp-violation') {
        const ex = importLines.get(`${String(r.kind)}:${String(r.component)}>${String(r.target)}`) ?? [];
        evidence = ex.slice(0, 3);
        if (file === undefined && ex[0] !== undefined) { file = ex[0].file; line = ex[0].line; }
      }
      if (name === 'component-main-sequence-distance') {
        const fs_ = compFiles.get(`${String(r.kind)}:${String(r.component)}`) ?? [];
        evidence = { files: fs_.length, sample: fs_.slice(0, 5) };
        file = file ?? fs_[0];
        line = line || 1;
      }
      return { ...r, _file: file ?? null, _line: line, ...(importGraphSees !== null ? { _importGraphSees: importGraphSees } : {}), ...(evidence !== undefined ? { _evidence: evidence } : {}) };
    });
  }
  lap('apg2Templates', t0);
  writeJson(path.join(dir, 'apg2.json'), {
    id: e.id, stats: apg.apg2, params: p,
    components: components.map((c) => ({ name: c.name, kind: c.kind })),
    parseCoverage: { total: apg.parseCoverage.total, parsed: apg.parseCoverage.parsed },
    importResolution: apg.importResolution,
    counts: Object.fromEntries(Object.entries(apg2).map(([k, v]) => [k, v.length])),
    rows: apg2,
  });

  // 4. Cheap proxies.
  t0 = performance.now();
  let cheap: ReturnType<typeof enrichCheap> | undefined;
  try {
    const project = openProject(tsconfig);
    cheap = enrichCheap({ apg, project, projectRoot: root, layerModel });
  } catch (err) {
    failures.push(`cheap proxies: ${err instanceof Error ? err.message : String(err)}`);
  }
  lap('cheap', t0);
  if (cheap !== undefined) {
    const flags = cheap.flags.map((f) => ({
      ...f,
      ...(f.related !== undefined ? { _importGraphSees: f.related.file === f.evidence.file || linked(f.evidence.file, f.related.file) } : {}),
    }));
    const counts: Record<string, number> = {};
    for (const f of flags) counts[f.proxy] = (counts[f.proxy] ?? 0) + 1;
    const kinds: Record<string, number> = {};
    for (const f of flags) kinds[`${f.proxy}/${f.kind}`] = (kinds[`${f.proxy}/${f.kind}`] ?? 0) + 1;
    // A large flag list goes to a gzip file next to the summary (the hoppscotch clone flags alone are ~6 MB of JSON).
    const big = flags.length > FLAGS_INLINE_MAX;
    fs.rmSync(path.join(dir, FLAGS_GZ), { force: true });
    if (big) fs.writeFileSync(path.join(dir, FLAGS_GZ), zlib.gzipSync(JSON.stringify(flags) + '\n', { level: 9 }));
    writeJson(path.join(dir, 'cheap.json'), { id: e.id, counts, kinds, summaries: cheap.summaries, timingsMs: cheap.timingsMs, ...(big ? { flagsFile: FLAGS_GZ } : { flags }) });
  }

  const ru = process.resourceUsage();
  writeJson(path.join(dir, 'cost.json'), {
    id: e.id, files: apg.parseCoverage.total, wallMs: t, peakRssMb: Math.round(ru.maxRSS / 1024),
    nodes: apg.nodes.length, edges: apg.edges.length, failures,
  });
  process.stdout.write(`${e.id}: style ${inf.style} (${(inf.classification.ranked[0]?.confidence ?? 0).toFixed(2)}), apg2 ${JSON.stringify(Object.fromEntries(Object.entries(apg2).map(([k, v]) => [k, v.length])))}, cheap ${cheap !== undefined ? String(cheap.flags.length) : 'FAILED'} flags, ${JSON.stringify(t)} ms, ${String(Math.round(ru.maxRSS / 1024))} MB\n`);
}

// ── fidelity ─────────────────────────────────────────────────────────────────
function fidelity(reposDir: string, e: SelectionEntry): void {
  const root = rootOf(reposDir, e);
  const hook = path.join(os.tmpdir(), `wild-rss-${String(process.pid)}.cjs`);
  const rssOut = path.join(os.tmpdir(), `wild-rss-${String(process.pid)}.txt`);
  fs.writeFileSync(hook, `process.on('exit', () => require('fs').appendFileSync(${JSON.stringify(rssOut)}, String(process.resourceUsage().maxRSS) + '\\n'));\n`);
  fs.rmSync(rssOut, { force: true });
  const out = path.join(OUT, 'fidelity', e.id);
  const t0 = performance.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=8192', '--import', 'tsx', '--require', hook, 'scripts/v1.3/graph-fidelity.ts', 'project', '--views', '--id', e.id,
    '--root', root, '--tsconfig', path.join(root, HARNESS), '--out', out], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
  const wallMs = Math.round(performance.now() - t0);
  const rss = fs.existsSync(rssOut) ? Math.max(...fs.readFileSync(rssOut, 'utf8').trim().split('\n').map(Number)) : 0;
  fs.rmSync(hook, { force: true });
  fs.rmSync(rssOut, { force: true });
  writeJson(path.join(out, 'cost.json'), { id: e.id, wallMs, peakRssMb: Math.round(rss / 1024), exit: r.status, stderr: r.stderr.slice(-2000) });
  process.stdout.write(`${r.stdout}${r.status !== 0 ? r.stderr.slice(-2000) : ''}${e.id}: fidelity ${String(wallMs)} ms, ${String(Math.round(rss / 1024))} MB, exit ${String(r.status)}\n`);
}

async function main(): Promise<void> {
  const [mode, ...argv] = process.argv.slice(2);
  const reposDir = path.resolve(arg('repos', argv) ?? '');
  const sel = readJson<{ entries: SelectionEntry[] }>(path.resolve(arg('selection', argv) ?? path.join(OUT, 'selection.json'))).entries;
  const id = arg('id', argv);
  const pick = (): SelectionEntry => {
    const e = sel.find((x) => x.id === id);
    if (e === undefined) throw new Error(`no selection entry ${String(id)}`);
    return e;
  };
  if (mode === 'prepare') prepare(reposDir, sel);
  else if (mode === 'analyse') {
    const e = pick();
    try {
      await analyse(reposDir, e);
    } catch (err) {
      writeJson(path.join(OUT, 'repos', e.id, 'error.json'), { id: e.id, stage: 'analyse', error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  } else if (mode === 'fidelity') fidelity(reposDir, pick());
  else throw new Error('mode must be prepare, analyse or fidelity');
}

void main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});
