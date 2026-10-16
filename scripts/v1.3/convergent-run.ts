/**
 * v1.3 convergent-validity run (Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md). No Neo4j, no LLM.
 * Entry file: no exports. Pure helpers: `scripts/v1.3/lib/convergent.ts`.
 *
 * Usage (repository root; every project directory is a temporary copy or clone, never committed):
 *   node --import tsx scripts/v1.3/convergent-run.ts projects --ref <materialised> --external <clones> --external-specs <dir> --wild <clones> --list <projects.json>
 *   node --import tsx scripts/v1.3/convergent-run.ts run --list <projects.json> --ours <dir> --work <dir> [--only <corpus>] [--id <id>]
 *   node --import tsx scripts/v1.3/convergent-run.ts translation-table
 *
 * `projects` writes the project list: the 71 materialised reference variants (`validate-reference.ts --materialise`),
 * the 15 external projects (PR #133 `results/v1.3-external/selection.json`, specs from that branch) and the 14 wild
 * projects (`results/v1.3-wild/selection.json`, ISE specs, the harness tsconfig written by `wild-run.ts prepare`).
 * `run` translates each project's v1.3 rules, runs dependency-cruiser, eslint-plugin-boundaries and ArchUnitTS
 * (pinned in experiments/tool-comparison/depcruise and experiments/validity-convergent/{boundaries,archunit}), reads our
 * tool's saved `firewall evaluate --format json --symbolic-only --engine cypher-interp` report from <ours>, and writes
 * <work>/keys/<corpus>/<id>.json (normalised keys, the scoped universe, tool errors, wall times).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import ts from 'typescript';
import { DEFAULT_EXCLUDE_PATTERNS } from '../../src/apg-extractor/types.js';
import { compilerInputFromSpec } from '../../src/fitness-compiler/compiler-input.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../src/fitness-compiler/fitness-compiler.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import {
  archunitChecks, boundariesGroups, buildIr, dcGlob, CAPABILITY, cycleEdges, depcruiseRules, KIND_UNIT, key, packageName, TEMPLATE_KIND, TOOLS, UNEXPRESSIBLE,
} from './lib/convergent.js';
import type { Ir } from './lib/convergent.js';

const REPO = process.cwd();
const RESULTS = path.join(REPO, 'results/v1.3-validity-convergent');
const DC_BIN = path.join(REPO, 'experiments/tool-comparison/depcruise/node_modules/.bin/depcruise');
const EB_DIR = path.join(REPO, 'experiments/validity-convergent/boundaries');
const AU_DIR = path.join(REPO, 'experiments/validity-convergent/archunit');

const argv = process.argv.slice(2);
const mode = argv[0];
const arg = (n: string): string | undefined => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const need = (n: string): string => { const v = arg(n); if (v === undefined) throw new Error(`--${n} is required`); return path.resolve(v); };
const posix = (p: string): string => p.split(path.sep).join('/');
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const writeJson = (p: string, v: unknown): void => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n'); };

interface Project { corpus: 'reference' | 'external' | 'wild'; id: string; dir: string; spec: string; tsconfig: string; style: string; explicitTsconfig?: boolean }

// ── projects ─────────────────────────────────────────────────────────────────
function projects(): void {
  const ref = need('ref'), ext = need('external'), extSpecs = need('external-specs'), wild = need('wild');
  const out: Project[] = [];
  for (const style of fs.readdirSync(ref).sort()) {
    const spec = style === 'ddd' ? path.join(REPO, 'presets/ddd.yaml') : path.join(REPO, 'tests/fixtures/v1.3-reference', style, 'spec.yaml');
    for (const v of fs.readdirSync(path.join(ref, style)).sort()) {
      const dir = path.join(ref, style, v);
      out.push({ corpus: 'reference', id: `${style}/${v}`, dir, spec, tsconfig: path.join(dir, 'tsconfig.json'), style });
    }
  }
  const extSel = readJson<{ entries: { id: string; root: string; tsconfig: string; style: string }[] }>(path.join(extSpecs, 'selection.json'));
  for (const e of extSel.entries) {
    const dir = path.normalize(path.join(ext, e.id, e.root));
    out.push({ corpus: 'external', id: e.id, dir, spec: path.join(extSpecs, `${e.id}.yaml`), tsconfig: path.join(dir, e.tsconfig), style: e.style });
  }
  const wildSel = readJson<{ entries: { id: string; root: string; styleGroup: string }[] }>(path.join(REPO, 'results/v1.3-wild/selection.json'));
  for (const e of wildSel.entries) {
    const dir = path.normalize(path.join(wild, e.id, e.root));
    out.push({ corpus: 'wild', id: e.id, dir, spec: path.join(REPO, 'results/v1.3-wild/repos', e.id, 'ise-spec.yaml'), tsconfig: path.join(dir, 'tsconfig.wild.json'), style: e.styleGroup, explicitTsconfig: true });
  }
  writeJson(need('list'), out);
  process.stdout.write(`${String(out.length)} projects\n`);
}

// ── translation ──────────────────────────────────────────────────────────────
async function translate(p: Project): Promise<{ ir: Ir; files: string[] }> {
  const parsed = await parseSpec({ specFilePath: p.spec });
  if (!parsed.success) throw new Error(`spec ${p.spec}: ${parsed.errors.map((e) => e.message).join('; ')}`);
  const compiled = compileFunctions(compilerInputFromSpec(parsed.data), V13_COMPILE_OPTIONS);
  if (!compiled.success) throw new Error(`compile ${p.spec}: ${compiled.errors.map((e) => e.message).join('; ')}`);
  const excludes = [...new Set([...DEFAULT_EXCLUDE_PATTERNS, ...specExcludePathsFromYaml(fs.readFileSync(p.spec, 'utf8'))])];
  const ir = buildIr(parsed.data, [...compiled.data.symbolicQueries, ...compiled.data.hybridPairs.map((h) => h.symbolicQuery)], excludes);
  // The program's files, as the extractor reads them: the tsconfig's file list minus the extractor excludes.
  const cfg = ts.getParsedCommandLineOfConfigFile(p.tsconfig, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
  const isEx = picomatch(excludes, { dot: true });
  const files = (cfg?.fileNames ?? []).map((f) => posix(path.relative(p.dir, f))).filter((f) => !f.startsWith('..') && !isEx(f) && /\.tsx?$/.test(f)).sort();
  return { ir, files };
}

// ── tools ────────────────────────────────────────────────────────────────────
interface ToolRun { keys: string[]; errors: string[]; wallMs: number; outOfScope: number }

function inScope(files: ReadonlySet<string>, unit: string, file: string, target: string): boolean {
  if (!files.has(file)) return false;
  if (unit === 'edge') return files.has(target);
  return true;
}

function unitOf(ir: Ir, id: string): string {
  const r = ir.rules.find((x) => x.id === id);
  return r === undefined ? 'edge' : KIND_UNIT[r.kind];
}

function runDepcruise(p: Project, ir: Ir, files: string[], work: string, scope: ReadonlySet<string>): ToolRun & { universe: { edges: string[]; packages: string[]; reexports: string[] }; unresolved: string[]; cycleLen: Record<string, number> } {
  const cfgFile = path.join(work, 'depcruise.json');
  const options = {
    tsPreCompilationDeps: true, doNotFollow: { path: 'node_modules' },
    exclude: { path: ir.extractorExcludes.filter((g) => !g.includes('node_modules')).map(dcGlob) },
    tsConfig: { fileName: p.tsconfig },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.json'] },
  };
  writeJson(cfgFile, { forbidden: depcruiseRules(ir), options });
  const listFile = path.join(work, 'files.txt');
  fs.writeFileSync(listFile, files.join('\n') + '\n');
  const t = Date.now();
  const r = spawnSync(DC_BIN, ['--config', cfgFile, '--output-type', 'json', ...files], { cwd: p.dir, encoding: 'utf8', maxBuffer: 1 << 30 });
  const wallMs = Date.now() - t;
  const errors: string[] = [];
  let data: { summary?: { violations?: { from: string; to: string; rule: { name: string }; cycle?: unknown }[] }; modules?: { source: string; dependencies: { resolved: string; module: string; couldNotResolve?: boolean; coreModule?: boolean; dependencyTypes?: string[] }[] }[] } = {};
  try { data = JSON.parse(r.stdout) as typeof data; } catch { errors.push(`no JSON (exit ${String(r.status)}): ${r.stderr.slice(0, 400)}`); }
  const keys = new Set<string>();
  const cycleLen = new Map<string, number>();
  let outOfScope = 0;
  for (const v of data.summary?.violations ?? []) {
    const id = v.rule.name.split('--')[0] ?? v.rule.name;
    const unit = unitOf(ir, id);
    if (Array.isArray(v.cycle)) {
      // One reported cycle per violation: from -> cycle[0] -> ... -> from; every edge of it is a key.
      const path_ = [v.from, ...(v.cycle as { name: string }[]).map((c) => c.name)];
      for (const [a, b] of cycleEdges(path_)) {
        if (!inScope(scope, unit, a, b)) { outOfScope++; continue; }
        const k = key(id, a, b);
        keys.add(k);
        cycleLen.set(k, Math.min(cycleLen.get(k) ?? Infinity, path_.length - (path_[0] === path_[path_.length - 1] ? 1 : 0)));
      }
      continue;
    }
    const target = unit === 'file' ? '' : unit === 'package-edge' ? packageName(v.to) : v.to;
    if (!inScope(scope, unit, v.from, target)) { outOfScope++; continue; }
    keys.add(key(id, v.from, target));
  }
  const edges = new Set<string>(); const pkgs = new Set<string>(); const unresolved = new Set<string>(); const reexports = new Set<string>();
  for (const m of data.modules ?? []) {
    if (!scope.has(m.source)) continue;
    for (const d of m.dependencies) {
      if (d.coreModule === true) continue;
      if (scope.has(d.resolved)) {
        edges.add(`${m.source}|${d.resolved}`);
        if ((d.dependencyTypes ?? []).includes('export')) reexports.add(`${m.source}|${d.resolved}`);
      }
      else if (/(^|\/)node_modules\//.test(d.resolved) || (d.couldNotResolve === true && !d.module.startsWith('.'))) pkgs.add(`${m.source}|${packageName(d.couldNotResolve === true ? d.module : d.resolved)}`);
      if (d.couldNotResolve === true) unresolved.add(`${m.source}|${d.module}`);
    }
  }
  return { keys: [...keys].sort(), errors, wallMs, outOfScope, universe: { edges: [...edges].sort(), packages: [...pkgs].sort(), reexports: [...reexports].sort() }, unresolved: [...unresolved].sort(), cycleLen: Object.fromEntries(cycleLen) };
}

function runBoundaries(p: Project, ir: Ir, files: string[], work: string, scope: ReadonlySet<string>): ToolRun {
  const keys = new Set<string>(); const errors: string[] = []; let wallMs = 0; let outOfScope = 0;
  boundariesGroups(ir).forEach((g, gi) => {
    const cfg = path.join(work, `eslint.boundaries.${String(gi)}.mjs`);
    const settings = {
      'boundaries/root-path': p.dir,
      'boundaries/elements': g.elements,
      'import/resolver': { [path.join(EB_DIR, 'node_modules/eslint-import-resolver-typescript/lib/index.cjs')]: { project: p.tsconfig } },
    };
    const rules: Record<string, unknown> = g.noUnknownFiles !== undefined
      ? { 'boundaries/no-unknown-files': 2 }
      : { 'boundaries/dependencies': [2, { default: 'allow', checkAllOrigins: true, checkInternals: true, policies: g.policies }] };
    fs.writeFileSync(cfg, [
      `import boundaries from ${JSON.stringify(path.join(EB_DIR, 'node_modules/eslint-plugin-boundaries/dist/index.js'))};`,
      `import tsParser from ${JSON.stringify(path.join(EB_DIR, 'node_modules/@typescript-eslint/parser/dist/index.js'))};`,
      `export default [{ files: ["**/*.ts", "**/*.tsx"], languageOptions: { parser: tsParser }, plugins: { boundaries },`,
      `  linterOptions: { reportUnusedDisableDirectives: "off", noInlineConfig: true },`,
      `  settings: ${JSON.stringify(settings)},`,
      `  rules: ${JSON.stringify(rules)} }];`,
    ].join('\n') + '\n');
    const lint = g.filesUnder === undefined ? files : files.filter((f) => f.startsWith(g.filesUnder ?? ''));
    const outFile = path.join(work, `eslint.boundaries.${String(gi)}.out.json`);
    const t = Date.now();
    // Chunks keep the command line short on the larger projects.
    for (let i = 0; i < lint.length; i += 400) {
      fs.rmSync(outFile, { force: true });
      const r = spawnSync(path.join(EB_DIR, 'node_modules/.bin/eslint'), ['-c', cfg, '--no-config-lookup', '--no-warn-ignored', '-f', 'json', '-o', outFile, ...lint.slice(i, i + 400)],
        { cwd: p.dir, encoding: 'utf8', maxBuffer: 1 << 28 });
      if (!fs.existsSync(outFile)) { errors.push(`eslint group ${String(gi)} exit ${String(r.status)}: ${r.stderr.slice(0, 400)}`); continue; }
      for (const f of readJson<{ filePath: string; messages: { ruleId: string | null; message: string; fatal?: boolean }[] }[]>(outFile)) {
        const file = posix(path.relative(p.dir, f.filePath));
        for (const m of f.messages) {
          if (m.fatal === true) { errors.push(`${file}: ${m.message.slice(0, 200)}`); continue; }
          if (m.ruleId === null) continue; // unused inline directives of the project's own ESLint setup (noInlineConfig)
          if (m.ruleId === 'boundaries/no-unknown-files') { keys.add(key(g.noUnknownFiles ?? '', file)); continue; }
          if (m.ruleId !== 'boundaries/dependencies') continue;
          const [id = '', toFile = '', toModule = ''] = m.message.split('|');
          const unit = unitOf(ir, id);
          const target = toModule !== '' ? toModule : toFile;
          if (!inScope(scope, unit, file, target)) { outOfScope++; continue; }
          keys.add(key(id, file, target));
        }
      }
    }
    wallMs += Date.now() - t;
  });
  return { keys: [...keys].sort(), errors, wallMs, outOfScope };
}

/** ArchUnitTS enumerates every simple cycle; on a dense cycle structure that does not finish, so each run is bounded. */
const ARCHUNIT_TIMEOUT_MS = 600_000;

function runArchunit(p: Project, ir: Ir, work: string, scope: ReadonlySet<string>): ToolRun & { notComputed: string[] } {
  const checksFile = path.join(work, 'archunit-checks.json');
  let checks = archunitChecks(ir);
  writeJson(checksFile, checks);
  const t = Date.now();
  const exec = (): ReturnType<typeof spawnSync> => spawnSync(process.execPath, [path.join(REPO, 'scripts/v1.3/convergent-archunit.mjs'), AU_DIR, checksFile, p.tsconfig],
    { cwd: p.dir, encoding: 'utf8', maxBuffer: 1 << 30, timeout: ARCHUNIT_TIMEOUT_MS, killSignal: 'SIGKILL' });
  let r = exec();
  const notComputed: string[] = [];
  if (r.error !== undefined && /ETIMEDOUT/.test(String(r.error))) {
    notComputed.push(...new Set(checks.filter((c) => c.op === 'no-cycles').map((c) => c.id)));
    checks = checks.filter((c) => c.op !== 'no-cycles');
    writeJson(checksFile, checks);
    r = exec();
  }
  const wallMs = Date.now() - t;
  const errors: string[] = notComputed.map((id) => `${id}: haveNoCycles did not finish in ${String(ARCHUNIT_TIMEOUT_MS / 1000)} s; rerun without it`);
  const keys = new Set<string>(); let outOfScope = 0;
  try {
    const d = JSON.parse(String(r.stdout)) as { findings: [string, string, string][]; errors: unknown[] };
    for (const e of d.errors) {
      errors.push(JSON.stringify(e).slice(0, 400));
      const id = (e as { id?: string; error?: string }).error !== undefined ? (e as { id?: string }).id : undefined;
      if (id !== undefined && !notComputed.includes(id)) notComputed.push(id);
    }
    for (const [id, file, target] of d.findings) {
      const unit = unitOf(ir, id);
      if (!inScope(scope, unit, file, target)) { outOfScope++; continue; }
      keys.add(key(id, file, target));
    }
  } catch { errors.push(`no JSON (exit ${String(r.status)}): ${String(r.stderr).slice(0, 400)}`); }
  return { keys: [...keys].sort(), errors, wallMs, outOfScope, notComputed };
}

interface OursViolation { functionId: string; filePath: string; target?: string; discriminator?: string[] }

function readOurs(p: Project, ir: Ir, oursDir: string, scope: ReadonlySet<string>): ToolRun & { fileNodes: number; failed: unknown[] } {
  const f = path.join(oursDir, p.corpus, `${p.id.replace('/', '__')}.json`);
  const d = readJson<{ violations: OursViolation[]; graphStats: { nodeCountByType: { File: number } }; functionExecution?: { failed?: unknown[] }; _run: { wallS: number } }>(f);
  const ids = new Set(ir.rules.map((r) => r.id));
  const keys = new Set<string>(); let outOfScope = 0;
  for (const v of d.violations) {
    if (!ids.has(v.functionId)) continue;
    const unit = unitOf(ir, v.functionId);
    const add = (file: string, target: string): void => {
      if (!inScope(scope, unit, file, target)) { outOfScope++; return; }
      keys.add(key(v.functionId, file, target));
    };
    const kind = ir.rules.find((r) => r.id === v.functionId)?.kind;
    if (kind === 'cycle') {
      const cycle = JSON.parse(v.discriminator?.[0] ?? '[]') as string[];
      for (const [a, b] of cycleEdges(cycle)) add(a, b);
    } else if (unit === 'file') add(v.filePath, '');
    else if (unit === 'package-edge') add(v.filePath, packageName(v.target ?? ''));
    else add(v.filePath, v.target ?? '');
  }
  return { keys: [...keys].sort(), errors: [], wallMs: Math.round(d._run.wallS * 1000), outOfScope, fileNodes: d.graphStats.nodeCountByType.File, failed: d.functionExecution?.failed ?? [] };
}

async function run(): Promise<void> {
  const list = readJson<Project[]>(need('list'));
  const oursDir = need('ours'); const work = need('work');
  const only = arg('only'); const oneId = arg('id');
  for (const p of list) {
    if (only !== undefined && p.corpus !== only) continue;
    if (oneId !== undefined && p.id !== oneId) continue;
    const out = path.join(work, 'keys', p.corpus, `${p.id.replace('/', '__')}.json`);
    if (fs.existsSync(out) && oneId === undefined) continue;
    const pw = path.join(work, 'configs', p.corpus, p.id.replace('/', '__'));
    fs.mkdirSync(pw, { recursive: true });
    const { ir, files } = await translate(p);
    writeJson(path.join(pw, 'ir.json'), ir);
    const scope = new Set(files);
    const ours = readOurs(p, ir, oursDir, scope);
    const dc = runDepcruise(p, ir, files, pw, scope);
    const eb = runBoundaries(p, ir, files, pw, scope);
    const au = runArchunit(p, ir, pw, scope);
    // Files that re-export from another module (barrels), for the disagreement classes only.
    const barrels = files.filter((f) => /^\s*export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s/m.test(fs.readFileSync(path.join(p.dir, f), 'utf8')));
    writeJson(out, {
      corpus: p.corpus, id: p.id, style: ir.style, programFiles: files.length, barrels, ourFileNodes: ours.fileNodes, ourFailedFunctions: ours.failed,
      rules: ir.rules.map((r) => ({ id: r.id, template: r.template, kind: r.kind, view: r.view })), layers: ir.layers,
      files, universe: dc.universe, unresolved: dc.unresolved,
      tools: { ours, depcruise: { ...dc, universe: undefined, unresolved: undefined }, boundaries: eb, archunit: au },
    });
    process.stdout.write(`${p.corpus}\t${p.id}\tfiles ${String(files.length)}/${String(ours.fileNodes)}\tours ${String(ours.keys.length)} dc ${String(dc.keys.length)} eb ${String(eb.keys.length)} au ${String(au.keys.length)}\terr dc ${String(dc.errors.length)} eb ${String(eb.errors.length)} au ${String(au.errors.length)}\n`);
  }
}

// ── translation table ────────────────────────────────────────────────────────
async function translationTable(): Promise<void> {
  const specs: [string, string][] = [
    ['clean-architecture', 'tests/fixtures/v1.3-reference/clean-architecture/spec.yaml'], ['layered', 'tests/fixtures/v1.3-reference/layered/spec.yaml'],
    ['nestjs', 'tests/fixtures/v1.3-reference/nestjs/spec.yaml'], ['hexagonal', 'tests/fixtures/v1.3-reference/hexagonal/spec.yaml'], ['ddd', 'presets/ddd.yaml'],
  ];
  const rows: Record<string, unknown>[] = [];
  for (const [style, spec] of specs) {
    const parsed = await parseSpec({ specFilePath: path.join(REPO, spec) });
    if (!parsed.success) throw new Error(spec);
    const compiled = compileFunctions(compilerInputFromSpec(parsed.data), V13_COMPILE_OPTIONS);
    if (!compiled.success) throw new Error(spec);
    const ir = buildIr(parsed.data, compiled.data.symbolicQueries, DEFAULT_EXCLUDE_PATTERNS);
    const dc = depcruiseRules(ir); const eb = boundariesGroups(ir); const au = archunitChecks(ir);
    for (const r of ir.rules) {
      const tools: Record<string, unknown> = {};
      for (const t of TOOLS) {
        const why = CAPABILITY[t][r.kind];
        const n = t === 'depcruise' ? dc.filter((x) => x.name.startsWith(`${r.id}--`)).length
          : t === 'boundaries' ? eb.filter((g) => g.ruleIds.includes(r.id)).reduce((s, g) => s + (g.noUnknownFiles === r.id ? 1 : g.policies.filter((x) => String(x.message).startsWith(`${r.id}|`)).length), 0)
            : au.filter((x) => x.id === r.id).length;
        tools[t] = why === null ? { translated: true, units: n } : { translated: false, reason: why };
      }
      rows.push({ style, id: r.id, template: r.template, kind: r.kind, view: r.view, tools });
    }
    for (const u of ir.untranslated) rows.push({ style, id: u.id, template: u.template, kind: null, view: null, tools: Object.fromEntries(TOOLS.map((t) => [t, { translated: false, reason: u.reason }])) });
    writeJson(path.join(RESULTS, 'translation', `${style}.json`), { depcruise: { forbidden: dc }, boundaries: eb, archunit: au, ir });
  }
  writeJson(path.join(RESULTS, 'translation-table.json'), { templateKinds: TEMPLATE_KIND, capability: CAPABILITY, unexpressible: UNEXPRESSIBLE, rows });
  process.stdout.write(`${String(rows.length)} rows\n`);
}

async function main(): Promise<void> {
  if (mode === 'projects') projects();
  else if (mode === 'run') await run();
  else if (mode === 'translation-table') await translationTable();
  else throw new Error('mode must be projects, run or translation-table');
}
main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exitCode = 1; });
