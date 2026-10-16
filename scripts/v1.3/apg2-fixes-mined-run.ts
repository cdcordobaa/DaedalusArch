/**
 * v1.3 APG v2 from developer behaviour: walk each repository's history and record which APG v2 template rows and cheap
 * proxy flags its maintainers removed (Docs/DiagnosticRuns/v1.3-apg2-fixes-mined-2026-10-16.md). The corpus, the layer
 * specs, the commit sample and the disappearance classes are those of the symbolic fixes-mined walk
 * (`scripts/v1.3/fixes-mined-run.ts`, `results/v1.3-fixes-mined/protocol.md`); this walk evaluates a different
 * instrument on each snapshot. Protocol: `results/v1.3-apg2-fixes-mined/protocol.md`. Entry file: no exports.
 *
 * Usage (repository root; clones under a scratch directory, never committed):
 *   node --max-old-space-size=6144 --import tsx scripts/v1.3/apg2-fixes-mined-run.ts walk --repos <dir> --id <id> [--n 100] [--cache <dir>]
 *
 * Per snapshot (no Neo4j, no LLM, no dependency installed):
 *   1. Sparse checkout of the analysis root; the harness tsconfig flattened from the project's own chain (tests
 *      excluded), as in the symbolic walk.
 *   2. `extractAPG` with `V13_APG2_OPTIONS`; components = the committed spec's layers and DDD contexts plus one folder
 *      component per top-level folder (`folderComponents`), as in the wild run.
 *   3. The nine APG v2 templates as their in-memory mirrors (`APG2_IN_MEMORY`, `apg2Params` of the spec's layer model).
 *   4. The cheap proxies (`enrichCheap`, default thresholds) except `co-change` (it reads the history, so its flags
 *      change without a code change) and `test-topology` (the harness program excludes tests, so every component
 *      would be untested).
 *   5. For each item: its identity, the files and file edge it rests on, and whether a file-level import graph shows
 *      the same relation (`importGraphSees`, the definition of the wild run).
 * Writes results/v1.3-apg2-fixes-mined/repos/<id>/{walk.json, pairs.json.gz, lineages.json.gz}.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import ts from 'typescript';
import { extractAPG, V13_APG2_OPTIONS, componentsFromLayerModel } from '../../src/apg-extractor/index.js';
import { folderComponents } from '../../src/apg-extractor/apg2/components.js';
import { APG2_IN_MEMORY, apg2Params, memGraph } from '../../src/fitness-compiler/apg2-in-memory.js';
import { APG2_TEMPLATE_TIERS } from '../../src/fitness-compiler/apg2-templates.js';
import { CONTEXT_PROXY_IDS, enrichCheap, openProject } from '../../src/apg-enrich/cheap/index.js';
import type { ContextProxyId } from '../../src/apg-enrich/cheap/index.js';
import { parseSpec, specExcludePathsFromYaml } from '../../src/spec-parser/index.js';
import type { LayerModel } from '../../src/shared/types/spec.js';
import { apiVisibleInImports, flattenTsconfig } from './lib/wild.js';
import { edgeKey, evenlySpaced, isBotAuthor, isMassChange } from './lib/fixes-mined.js';
import { classifyItem, CREDITED, type ItemCause, type MinedItem } from './lib/apg2-fixes-mined.js';

const REPO = process.cwd();
const OUT = path.join(REPO, 'results/v1.3-apg2-fixes-mined');
const CORPUS = path.join(REPO, 'results/v1.3-fixes-mined/corpus.json');
const HARNESS = 'tsconfig.mined.json';
/** Proxies left out of the walk (see the header). */
const SKIPPED_PROXIES: readonly ContextProxyId[] = ['co-change', 'test-topology'];
const PROXIES = CONTEXT_PROXY_IDS.filter((p) => !SKIPPED_PROXIES.includes(p));

interface CorpusEntry {
  readonly id: string;
  readonly repo: string;
  readonly url: string;
  readonly sha: string;
  readonly root: string;
  readonly tsconfig: string;
  readonly include?: string[];
  readonly historyPath?: string;
  readonly spec: string;
}

function arg(name: string, argv: readonly string[]): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const posix = (p: string): string => p.split(path.sep).join('/');
const writeJson = (p: string, v: unknown): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n');
};
const writeGz = (p: string, v: unknown): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, zlib.gzipSync(JSON.stringify(v), { level: 9 }));
};
const readGz = <T>(p: string): T => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString('utf8')) as T;

function git(cwd: string, args: readonly string[], allowFail = false): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0 && !allowFail) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.status === 0 ? r.stdout : '';
}

// ── Snapshots ───────────────────────────────────────────────────────────────

interface Snapshot {
  readonly tree: string;
  readonly ok: boolean;
  readonly error?: string;
  readonly files: string[];
  /** File -> layer (the spec's layer model, the ingestion's annotator). */
  readonly layers: Record<string, string>;
  /** File-to-file IMPORTS / RE_EXPORTS edges (`s|t`). */
  readonly imports: string[];
  /** File -> package import edges (`file|package`). */
  readonly pkgImports: string[];
  /** Every file pair joined by any APG relation (`s|t`, member nodes lifted to their files). */
  readonly deps: string[];
  /** Members (Method / Function / Class nodes) as `file#name`. */
  readonly members: string[];
  /** Components with at least one file, as `kind:name`. */
  readonly components: string[];
  /** Component DEPENDS_ON edges `kind:a>b`. */
  readonly componentDeps: string[];
  readonly items: MinedItem[];
  readonly stats?: Record<string, unknown>;
  readonly ms: number;
  readonly msParts?: Record<string, number>;
}

function writeHarness(clone: string, root: string, e: CorpusEntry): void {
  const reader = {
    read: (p: string): Record<string, unknown> | undefined => {
      if (!fs.existsSync(p)) return undefined;
      const r = ts.readConfigFile(p, (f) => fs.readFileSync(f, 'utf8'));
      return r.error !== undefined ? undefined : (r.config as Record<string, unknown>);
    },
    resolvePackage: (spec: string): string | undefined => {
      const parts = spec.split('/');
      const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0] ?? '';
      const rest = parts.slice(spec.startsWith('@') ? 2 : 1).join('/');
      for (const f of git(clone, ['ls-files', '*package.json'], true).split('\n').filter(Boolean)) {
        const abs = path.join(clone, f);
        if (!fs.existsSync(abs)) continue;
        try {
          if ((JSON.parse(fs.readFileSync(abs, 'utf8')) as { name?: string }).name === name) {
            const target = path.join(path.dirname(abs), rest === '' ? 'tsconfig.json' : rest);
            return fs.existsSync(target) ? target : undefined;
          }
        } catch { /* not JSON */ }
      }
      return undefined;
    },
  };
  const flat = flattenTsconfig(path.join(root, e.tsconfig), root, reader, e.include);
  flat.tsconfig.compilerOptions.experimentalDecorators ??= true;
  fs.writeFileSync(path.join(root, HARNESS), JSON.stringify(flat.tsconfig, null, 2) + '\n');
}

function programFiles(root: string): string[] {
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(root, HARNESS), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
  return (parsed?.fileNames ?? []).map((f) => posix(path.relative(root, f))).filter((f) => !f.endsWith('.d.ts'));
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : JSON.stringify(v));

async function evaluateAt(clone: string, e: CorpusEntry, spec: { layerModel: LayerModel; excludes: string[] }, sha: string, tree: string): Promise<Snapshot> {
  const t0 = performance.now();
  const parts: Record<string, number> = {};
  git(clone, ['checkout', '-f', '-q', '--detach', sha]);
  const root = fs.realpathSync(path.join(clone, e.root === '.' ? '' : e.root) || clone);
  const empty = (error: string): Snapshot => ({
    tree, ok: false, error, files: [], layers: {}, imports: [], pkgImports: [], deps: [], members: [], components: [], componentDeps: [], items: [],
    ms: Math.round(performance.now() - t0),
  });
  if (!fs.existsSync(root)) return empty('analysis root absent');
  writeHarness(clone, root, e);
  const files = programFiles(root);
  if (files.length === 0) return empty('no source files');
  const harness = path.join(root, HARNESS);
  const rel = (p: string): string => {
    const f = posix(p);
    const r = posix(root);
    return (f.startsWith(`${r}/`) ? f.slice(r.length + 1) : f).replace(/^\.\//, '');
  };
  try {
    let t1 = performance.now();
    const components = [...componentsFromLayerModel(spec.layerModel), ...folderComponents(files)];
    const res = await extractAPG(root, { ...V13_APG2_OPTIONS, components, excludePatterns: spec.excludes }, harness);
    parts.extract = Math.round(performance.now() - t1);
    if (!res.success) return empty(`extract: ${res.errors.map((x) => x.message).join('; ').slice(0, 400)}`);
    const apg = res.data;
    t1 = performance.now();
    const g = memGraph(apg, spec.layerModel);
    const p = apg2Params(spec.layerModel);

    // Graph facts for the classification and the baselines.
    const fileOf = new Map<string, string>();
    const layers: Record<string, string> = {};
    const members = new Set<string>();
    const pkgName = new Map<string, string>();
    for (const n of apg.nodes) {
      if (n.type === 'Package') { pkgName.set(n.id, n.name); continue; }
      if (typeof n.filePath === 'string' && n.filePath !== '' && n.type !== 'Component' && n.type !== 'Channel' && n.type !== 'IOCategory') fileOf.set(n.id, rel(n.filePath));
      if (n.type === 'File') {
        const l = g.layer.get(n.id);
        if (typeof l === 'string' && l !== '') layers[rel(n.filePath)] = l;
      }
      if (n.type === 'Method' || n.type === 'Function' || n.type === 'Class' || n.type === 'Interface') members.add(`${rel(n.filePath)}#${n.name}`);
    }
    const imports = new Set<string>();
    const deps = new Set<string>();
    const pkgImports = new Map<string, Set<string>>();
    const compName = new Map<string, string>();
    for (const n of apg.nodes) if (n.type === 'Component') compName.set(n.id, `${str(n.properties.kind)}:${n.name}`);
    const compFiles = new Map<string, Set<string>>();
    const fileComp = new Map<string, Map<string, string>>();
    const componentDeps = new Set<string>();
    for (const r of apg.edges) {
      if (r.type === 'BELONGS_TO') {
        const f = fileOf.get(r.sourceId);
        const c = compName.get(r.targetId);
        if (f !== undefined && c !== undefined) {
          const s = compFiles.get(c) ?? new Set<string>();
          s.add(f);
          compFiles.set(c, s);
          const m = fileComp.get(f) ?? new Map<string, string>();
          m.set(c.slice(0, c.indexOf(':')), c.slice(c.indexOf(':') + 1));
          fileComp.set(f, m);
        }
        continue;
      }
      if (r.type === 'DEPENDS_ON') {
        const a = compName.get(r.sourceId);
        const b = compName.get(r.targetId);
        if (a !== undefined && b !== undefined) componentDeps.add(`${a}>${b.slice(b.indexOf(':') + 1)}`);
        continue;
      }
      if ((r.type === 'IMPORTS' || r.type === 'RE_EXPORTS') && pkgName.has(r.targetId)) {
        const f = fileOf.get(r.sourceId);
        if (f !== undefined) {
          const s = pkgImports.get(f) ?? new Set<string>();
          s.add(pkgName.get(r.targetId) as string);
          pkgImports.set(f, s);
        }
        continue;
      }
      const s = fileOf.get(r.sourceId);
      const t = fileOf.get(r.targetId);
      if (s === undefined || t === undefined || s === t) continue;
      deps.add(edgeKey(s, t));
      if (r.type === 'IMPORTS' || r.type === 'RE_EXPORTS') {
        const sn = g.byId.get(r.sourceId);
        const tn = g.byId.get(r.targetId);
        if (sn?.type === 'File' && tn?.type === 'File') imports.add(edgeKey(s, t));
      }
    }
    const linked = (a: string, b: string): boolean => imports.has(edgeKey(a, b)) || imports.has(edgeKey(b, a));

    // APG v2 template rows.
    const items: MinedItem[] = [];
    for (const [name, fn] of APG2_IN_MEMORY) {
      const tier = APG2_TEMPLATE_TIERS.get(name)?.tier ?? 'advisory';
      for (const row of fn(g, p)) {
        const r: Record<string, unknown> = { ...row };
        const relOrSelf = (v: unknown): string => (typeof v === 'string' && !v.startsWith('component:') ? rel(v) : str(v));
        const line = typeof r.line === 'number' ? r.line : undefined;
        if (name === 'boundary-type-leak') {
          const f = relOrSelf(r.filePath);
          const t = relOrSelf(r.target);
          items.push({ family: 'apg2', rule: name, tier, shape: 'member', key: `${name}#${f}#${str(r.member)}#${str(r.leakedType)}#${t}`,
            files: [...new Set([f, t])], edge: edgeKey(f, t), member: `${f}#${str(r.member)}`, importGraphSees: t === f || linked(f, t),
            message: `${str(r.member)} exposes infrastructure type ${str(r.leakedType)} (${t})`, ...(line !== undefined && { line }) });
        } else if (name === 'deep-import-declared-api' || name === 'deep-import-inferred-api') {
          const f = relOrSelf(r.filePath);
          const t = relOrSelf(r.target);
          items.push({ family: 'apg2', rule: name, tier, shape: 'edge', key: `${name}#${f}#${t}#${str(r.component)}`,
            files: [f, t], edge: edgeKey(f, t), importGraphSees: true,
            message: `${f} imports ${t}, not in the public API of ${str(r.component)}`, ...(line !== undefined && { line }) });
        } else if (name === 'undeclared-async-coupling') {
          const f = relOrSelf(r.filePath);
          const t = relOrSelf(r.target);
          items.push({ family: 'apg2', rule: name, tier, shape: 'pair', key: `${name}#${f}#${t}#${str(r.channel)}#${str(r.transport)}`,
            files: [...new Set([f, t])], importGraphSees: linked(f, t),
            message: `${str(r.subscriberComponent)} reacts to ${str(r.transport)} channel ${str(r.channel)} published by ${str(r.publisherComponent)}` });
        } else if (name === 'io-outside-adapters' || name === 'nondeterminism-in-core') {
          const f = relOrSelf(r.filePath);
          const apis = Array.isArray(r.apis) ? r.apis.map(String) : [];
          items.push({ family: 'apg2', rule: name, tier, shape: 'member', key: `${name}#${f}#${str(r.member)}#${str(r.category)}`,
            files: [f], member: `${f}#${str(r.member)}`, importGraphSees: apiVisibleInImports(apis, pkgImports.get(f) ?? new Set()),
            message: `${str(r.member)} (${str(r.layer)}) ${name === 'io-outside-adapters' ? 'performs' : 'reads'} ${str(r.category)}: ${apis.slice(0, 4).join(', ')}`,
            ...(line !== undefined && { line }) });
        } else if (name === 'component-adp-cycle' || name === 'component-sdp-violation') {
          const kind = str(r.kind);
          items.push({ family: 'apg2', rule: name, tier, shape: 'component', key: `${name}#${kind}:${str(r.component)}>${str(r.target)}`,
            files: [], components: [`${kind}:${str(r.component)}`, `${kind}:${str(r.target)}`], componentDep: `${kind}:${str(r.component)}>${str(r.target)}`,
            importGraphSees: true, message: `${kind} ${str(r.component)} -> ${str(r.target)}` });
        } else if (name === 'component-main-sequence-distance') {
          const kind = str(r.kind);
          items.push({ family: 'apg2', rule: name, tier, shape: 'component', key: `${name}#${kind}:${str(r.component)}`,
            files: [], components: [`${kind}:${str(r.component)}`], importGraphSees: false,
            message: `${kind} ${str(r.component)} D=${str(r.distance)} (A=${str(r.abstractness)}, I=${str(r.instability)})` });
        }
      }
    }
    parts.apg2 = Math.round(performance.now() - t1);

    // Cheap proxies.
    t1 = performance.now();
    let cheapError: string | undefined;
    try {
      const project = openProject(harness);
      const cheap = enrichCheap({ apg, project, projectRoot: root, layerModel: spec.layerModel }, { proxies: PROXIES });
      for (const f of cheap.flags) {
        const file = rel(f.evidence.file);
        const relFile = f.related !== undefined ? rel(f.related.file) : undefined;
        const unit = [f.className ?? '', f.methodName ?? ''].join('.');
        const relUnit = f.related !== undefined ? [f.related.className ?? '', f.related.methodName ?? ''].join('.') : '';
        const files = relFile !== undefined ? [...new Set([file, relFile])] : [file];
        // A flag's identity: proxy, kind, file and unit (and the other end); not the message, which carries counts.
        items.push({
          family: 'cheap', rule: `${f.proxy}/${f.kind}`, tier: 'advisory', shape: relFile !== undefined && relFile !== file ? 'pair' : (unit !== '.' ? 'member' : 'file'),
          key: `cheap#${f.proxy}/${f.kind}#${file}#${unit}#${relFile ?? ''}#${relUnit}`,
          files, ...(unit !== '.' && f.className !== undefined && { member: `${file}#${f.className}` }),
          importGraphSees: relFile !== undefined ? (relFile === file || linked(file, relFile)) : null,
          message: f.message.slice(0, 240), line: f.evidence.startLine,
        });
      }
    } catch (err) {
      cheapError = err instanceof Error ? err.message.slice(0, 300) : String(err);
    }
    parts.cheap = Math.round(performance.now() - t1);
    const pkgList: string[] = [];
    for (const [f, s] of pkgImports) for (const k of s) pkgList.push(edgeKey(f, k));
    const comps = [...compFiles.entries()].filter(([, s]) => s.size > 0).map(([c]) => c);
    // Deduplicate items by key (a row repeated with another line keeps its first occurrence).
    const seen = new Set<string>();
    const uniq = items.filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)));
    return {
      tree, ok: true, files, layers, imports: [...imports].sort(), pkgImports: pkgList.sort(), deps: [...deps].sort(),
      members: [...members].sort(), components: comps.sort(), componentDeps: [...componentDeps].sort(), items: uniq,
      stats: { apg2: apg.apg2 ?? null, ...(cheapError !== undefined && { cheapError }) },
      ms: Math.round(performance.now() - t0), msParts: parts,
    };
  } catch (err) {
    return empty(`exception: ${err instanceof Error ? err.message.slice(0, 400) : String(err)}`);
  }
}

// ── Walk ────────────────────────────────────────────────────────────────────

interface CommitMeta { readonly sha: string; readonly parent: string; readonly date: string; readonly author: string; readonly bot: boolean; readonly message: string }

function commitMeta(clone: string, sha: string): CommitMeta {
  const out = git(clone, ['log', '-1', '--format=%P%x00%cI%x00%an%x00%ae%x00%B', sha]);
  const [parents = '', date = '', author = '', email = '', message = ''] = out.split('\0');
  return { sha, parent: parents.split(' ')[0] ?? '', date, author, bot: isBotAuthor(author, email), message: message.trim().slice(0, 2000) };
}

interface NameStatus { readonly changed: number; readonly renamedOrDeleted: number; readonly renamedFrom: Set<string>; readonly touched: Set<string> }

function nameStatus(clone: string, e: CorpusEntry, parent: string, child: string): NameStatus {
  const prefix = e.root === '.' ? '' : `${e.root}/`;
  const hp = e.historyPath ?? e.root;
  const out = git(clone, ['diff', '--name-status', '-M50%', '-l5000', parent, child, '--', hp], true);
  const renamedFrom = new Set<string>();
  const touched = new Set<string>();
  let changed = 0;
  let rd = 0;
  const strip = (p: string): string => (p.startsWith(prefix) ? p.slice(prefix.length) : p);
  for (const line of out.split('\n')) {
    if (line === '') continue;
    const [st = '', a = '', b] = line.split('\t');
    changed++;
    touched.add(strip(a));
    if (b !== undefined) touched.add(strip(b));
    if (st.startsWith('R')) { renamedFrom.add(strip(a)); rd++; } else if (st === 'D') rd++;
  }
  return { changed, renamedOrDeleted: rd, renamedFrom, touched };
}

interface PairItem {
  readonly key: string;
  readonly family: 'apg2' | 'cheap';
  readonly rule: string;
  readonly tier: 'blocking' | 'advisory';
  readonly shape: MinedItem['shape'];
  readonly importGraphSees: boolean | null;
  readonly cause?: ItemCause;
  /** For a member-level item gone in place: whether the member itself is still declared in the file. */
  readonly memberStays?: boolean;
  /** Whether the commit touched a file the item names (for the touched-only rates). */
  readonly touched: boolean;
  readonly files: string[];
  readonly line?: number;
  readonly message: string;
}

interface Exposure { exposed: number; touched: number; causes: Record<string, number>; causesTouched: Record<string, number> }
const mkExp = (): Exposure => ({ exposed: 0, touched: 0, causes: {}, causesTouched: {} });

interface PairRecord {
  readonly sha: string;
  readonly parent: string;
  readonly date: string;
  readonly author: string;
  readonly bot: boolean;
  readonly mass: boolean;
  readonly changed: number;
  readonly renamedOrDeleted: number;
  readonly message: string;
  readonly parentOk: boolean;
  readonly childOk: boolean;
  /** Exposure per rule key `<rule>|<seen|invisible|na>`: items present at the parent, and how many disappeared by cause. */
  readonly exposure: Record<string, Exposure>;
  readonly disappeared: PairItem[];
  readonly introduced: number;
  /** Baselines: unflagged internal import edges (all, layered, cross-layer) and file->package import edges. */
  readonly baseline: Record<'all' | 'layered' | 'crossLayer' | 'pkg', Exposure>;
  readonly baselineFixedSample: string[];
}

const visKey = (v: boolean | null): string => (v === null ? 'na' : v ? 'seen' : 'invisible');

function analysePair(meta: CommitMeta, ns: NameStatus, parent: Snapshot, child: Snapshot): PairRecord {
  const mass = isMassChange({ changed: ns.changed, renamedOrDeleted: ns.renamedOrDeleted, rootFiles: parent.files.length });
  const massOrBot = mass || meta.bot;
  const childFiles = new Set(child.files);
  const childDeps = new Set(child.deps);
  const childImports = new Set(child.imports);
  const childMembers = new Set(child.members);
  const childComps = new Set(child.components);
  const childCompDeps = new Set(child.componentDeps);
  const childPkg = new Set(child.pkgImports);
  const ck = new Set(child.items.map((i) => i.key));
  const exposure: Record<string, Exposure> = {};
  const disappeared: PairItem[] = [];
  const both = parent.ok && child.ok;
  if (both) {
    for (const it of parent.items) {
      const k = `${it.rule}|${visKey(it.importGraphSees)}`;
      const ex = (exposure[k] ??= mkExp());
      const touched = it.files.some((f) => ns.touched.has(f));
      ex.exposed++;
      if (touched) ex.touched++;
      if (ck.has(it.key)) continue;
      const cause = classifyItem(it, { childFiles, childDeps, childImports, childComponents: childComps, childComponentDeps: childCompDeps, renamedFrom: ns.renamedFrom, massOrBot });
      ex.causes[cause] = (ex.causes[cause] ?? 0) + 1;
      if (touched) ex.causesTouched[cause] = (ex.causesTouched[cause] ?? 0) + 1;
      // Every APG v2 disappearance is kept; a proxy flag only when credited (clone flags churn by the thousand).
      if (it.family === 'cheap' && !CREDITED.has(cause)) continue;
      disappeared.push({
        key: it.key, family: it.family, rule: it.rule, tier: it.tier, shape: it.shape, importGraphSees: it.importGraphSees, cause,
        ...(it.member !== undefined && { memberStays: childMembers.has(it.member) }), touched, files: it.files,
        ...(it.line !== undefined && { line: it.line }), message: it.message,
      });
    }
  }
  const pk = new Set(parent.items.map((i) => i.key));
  const introduced = both ? child.items.filter((i) => !pk.has(i.key)).length : 0;
  // Baselines.
  const flagged = new Set<string>();
  for (const it of parent.items) if (it.edge !== undefined) flagged.add(it.edge);
  const base = { all: mkExp(), layered: mkExp(), crossLayer: mkExp(), pkg: mkExp() };
  const fixedSample: string[] = [];
  if (both) {
    for (const e of parent.imports) {
      if (flagged.has(e)) continue;
      const [s = '', t = ''] = e.split('|');
      const ls = parent.layers[s];
      const lt = parent.layers[t];
      const kinds: ('all' | 'layered' | 'crossLayer')[] = ['all'];
      if (ls !== undefined && lt !== undefined) { kinds.push('layered'); if (ls !== lt) kinds.push('crossLayer'); }
      const touched = ns.touched.has(s) || ns.touched.has(t);
      let cause: ItemCause | undefined;
      if (!childDeps.has(e)) cause = classifyItem({ family: 'apg2', rule: 'baseline', tier: 'advisory', shape: 'edge', key: e, files: [s, t], edge: e, importGraphSees: true, message: '' },
        { childFiles, childDeps, childImports, childComponents: childComps, childComponentDeps: childCompDeps, renamedFrom: ns.renamedFrom, massOrBot });
      for (const k of kinds) {
        base[k].exposed++;
        if (touched) base[k].touched++;
        if (cause !== undefined) {
          base[k].causes[cause] = (base[k].causes[cause] ?? 0) + 1;
          if (touched) base[k].causesTouched[cause] = (base[k].causesTouched[cause] ?? 0) + 1;
        }
      }
      if (cause === 'FIXED-BY-DEV' && fixedSample.length < 30) fixedSample.push(e);
    }
    for (const e of parent.pkgImports) {
      const f = e.slice(0, e.indexOf('|'));
      const touched = ns.touched.has(f);
      base.pkg.exposed++;
      if (touched) base.pkg.touched++;
      if (childPkg.has(e)) continue;
      const cause: ItemCause = ns.renamedFrom.has(f) ? 'RENAMED' : !childFiles.has(f) ? 'FILE-DELETED' : massOrBot ? 'MASS-OR-BOT' : 'FIXED-BY-DEV';
      base.pkg.causes[cause] = (base.pkg.causes[cause] ?? 0) + 1;
      if (touched) base.pkg.causesTouched[cause] = (base.pkg.causesTouched[cause] ?? 0) + 1;
    }
  }
  return {
    sha: meta.sha, parent: meta.parent, date: meta.date, author: meta.author, bot: meta.bot, mass, changed: ns.changed,
    renamedOrDeleted: ns.renamedOrDeleted, message: meta.message, parentOk: parent.ok, childOk: child.ok,
    exposure, disappeared, introduced, baseline: base, baselineFixedSample: fixedSample,
  };
}

interface Lineage {
  readonly kind: 'item' | 'edge';
  readonly rule?: string;
  readonly vis?: string;
  readonly edgeKind?: string;
  readonly born: number;
  readonly ended: number | null;
  readonly filesStay?: boolean;
}

function lineages(grid: readonly Snapshot[]): Lineage[] {
  const out: Lineage[] = [];
  type Open = { born: number; it?: MinedItem; edgeKind?: string };
  const openI = new Map<string, Open>();
  const openE = new Map<string, Open>();
  const filesStayAt = (files: readonly string[], at: Snapshot): boolean => { const s = new Set(at.files); return files.every((f) => s.has(f)); };
  grid.forEach((snap, i) => {
    if (!snap.ok) return;
    const ik = new Map(snap.items.map((x) => [x.key, x]));
    for (const [k, o] of [...openI]) {
      if (ik.has(k) || o.it === undefined) continue;
      out.push({ kind: 'item', rule: o.it.rule, vis: visKey(o.it.importGraphSees), born: o.born, ended: i, filesStay: filesStayAt(o.it.files, snap) });
      openI.delete(k);
    }
    for (const [k, it] of ik) if (!openI.has(k)) openI.set(k, { born: i, it });
    const flagged = new Set<string>();
    for (const x of snap.items) if (x.edge !== undefined) flagged.add(x.edge);
    const ek = new Set(snap.imports.filter((e) => !flagged.has(e)));
    for (const [k, o] of [...openE]) {
      if (ek.has(k)) continue;
      out.push({ kind: 'edge', ...(o.edgeKind !== undefined && { edgeKind: o.edgeKind }), born: o.born, ended: i, filesStay: filesStayAt(k.split('|'), snap) });
      openE.delete(k);
    }
    for (const k of ek) {
      if (openE.has(k)) continue;
      const [s = '', t = ''] = k.split('|');
      const a = snap.layers[s];
      const b = snap.layers[t];
      openE.set(k, { born: i, edgeKind: a !== undefined && b !== undefined ? (a !== b ? 'crossLayer' : 'layered') : 'other' });
    }
  });
  for (const o of openI.values()) if (o.it !== undefined) out.push({ kind: 'item', rule: o.it.rule, vis: visKey(o.it.importGraphSees), born: o.born, ended: null });
  for (const o of openE.values()) out.push({ kind: 'edge', ...(o.edgeKind !== undefined && { edgeKind: o.edgeKind }), born: o.born, ended: null });
  return out;
}

async function loadSpec(e: CorpusEntry): Promise<{ layerModel: LayerModel; excludes: string[] }> {
  const file = path.join(REPO, e.spec);
  const parsed = await parseSpec({ specFilePath: file });
  if (!parsed.success) throw new Error(`spec ${e.spec} does not parse: ${parsed.errors.map((x) => x.message).join('; ')}`);
  return { layerModel: parsed.data.layerModel, excludes: specExcludePathsFromYaml(fs.readFileSync(file, 'utf8')) };
}

async function walk(reposDir: string, e: CorpusEntry, n: number, cacheDir: string): Promise<void> {
  const clone = path.join(reposDir, e.id);
  const t0 = performance.now();
  const spec = await loadSpec(e);
  const hp = e.historyPath ?? e.root;
  const pathspec = hp === '.' ? [] : ['--', hp];
  const all = git(clone, ['rev-list', '--first-parent', '--reverse', e.sha, ...pathspec]).split('\n').filter(Boolean);
  const withParent = all.filter((c) => git(clone, ['rev-parse', '-q', '--verify', `${c}^1`], true).trim() !== '');
  const sample = evenlySpaced(withParent, n);
  const cdir = path.join(cacheDir, e.id);
  fs.mkdirSync(cdir, { recursive: true });
  const tsconfigPath = posix(path.join(e.root, e.tsconfig));
  const treeOf = (sha: string): string => {
    const tree = git(clone, ['rev-parse', '-q', '--verify', `${sha}:${hp === '.' ? '' : hp}`], true).trim();
    if (tree === '') return 'absent';
    const cfg = git(clone, ['rev-parse', '-q', '--verify', `${sha}:${tsconfigPath}`], true).trim();
    return cfg === '' ? tree : `${tree}-${cfg.slice(0, 12)}`;
  };
  let evaluated = 0;
  let cached = 0;
  const msList: number[] = [];
  const snapshot = async (sha: string): Promise<Snapshot> => {
    const tree = treeOf(sha);
    const f = path.join(cdir, `${tree}.json.gz`);
    if (fs.existsSync(f)) { cached++; return readGz<Snapshot>(f); }
    const s: Snapshot = tree === 'absent'
      ? { tree, ok: false, error: 'analysis root absent', files: [], layers: {}, imports: [], pkgImports: [], deps: [], members: [], components: [], componentDeps: [], items: [], ms: 0 }
      : await evaluateAt(clone, e, spec, sha, tree);
    writeGz(f, s);
    evaluated++;
    if (s.ok) msList.push(s.ms);
    return s;
  };
  const pairs: PairRecord[] = [];
  const grid: Snapshot[] = [];
  const gridMeta: { sha: string; date: string }[] = [];
  const errors: { sha: string; error: string }[] = [];
  for (const [i, c] of sample.entries()) {
    const meta = commitMeta(clone, c);
    const ps = await snapshot(meta.parent);
    const cs = await snapshot(c);
    if (!ps.ok && ps.error !== undefined) errors.push({ sha: meta.parent, error: ps.error });
    if (!cs.ok && cs.error !== undefined) errors.push({ sha: c, error: cs.error });
    const ns = nameStatus(clone, e, meta.parent, c);
    pairs.push(analysePair(meta, ns, ps, cs));
    grid.push(cs);
    gridMeta.push({ sha: c, date: meta.date });
    if (i % 10 === 0) process.stdout.write(`${e.id}\t${String(i + 1)}/${String(sample.length)}\tevaluated ${String(evaluated)} cached ${String(cached)}\t${String(Math.round((performance.now() - t0) / 1000))}s\t${String(cs.files.length)} files ${String(cs.items.length)} items ${cs.error ?? ''}\n`);
  }
  const dir = path.join(OUT, 'repos', e.id);
  const head = grid.at(-1);
  const byRule: Record<string, number> = {};
  for (const it of head?.items ?? []) byRule[it.rule] = (byRule[it.rule] ?? 0) + 1;
  msList.sort((a, b) => a - b);
  writeJson(path.join(dir, 'walk.json'), {
    id: e.id, repo: e.repo, url: e.url, pin: e.sha, root: e.root, spec: e.spec,
    firstParentCommitsTouchingRoot: all.length, sampled: sample.length,
    firstSampled: gridMeta[0], lastSampled: gridMeta.at(-1),
    snapshotsEvaluated: evaluated, snapshotCacheHits: cached,
    snapshotErrors: errors.length, errorSample: errors.slice(0, 10),
    msMedian: msList[Math.floor(msList.length / 2)] ?? null, msP95: msList[Math.floor(msList.length * 0.95)] ?? null,
    atLastSample: head !== undefined ? { files: head.files.length, layeredFiles: Object.keys(head.layers).length, imports: head.imports.length, items: head.items.length, byRule, stats: head.stats ?? null } : null,
    wallSeconds: Math.round((performance.now() - t0) / 1000),
    proxies: PROXIES, skippedProxies: SKIPPED_PROXIES,
  });
  writeGz(path.join(dir, 'pairs.json.gz'), pairs);
  writeGz(path.join(dir, 'lineages.json.gz'), { grid: gridMeta, lineages: lineages(grid) });
  git(clone, ['checkout', '-f', '-q', '--detach', e.sha], true);
  fs.rmSync(path.join(clone, e.root, HARNESS), { force: true });
  process.stdout.write(`${e.id}\tdone\t${String(sample.length)} pairs\t${String(evaluated)} evaluated\t${String(Math.round((performance.now() - t0) / 1000))}s\n`);
}

/** Calibration: evaluate one commit (default: the pin) and print the per-rule counts and the timings. */
async function probe(reposDir: string, e: CorpusEntry, sha: string | undefined): Promise<void> {
  const clone = path.join(reposDir, e.id);
  const s = await evaluateAt(clone, e, await loadSpec(e), sha ?? e.sha, 'probe');
  const byRule: Record<string, Record<string, number>> = {};
  for (const it of s.items) { const r = (byRule[it.rule] ??= {}); const v = visKey(it.importGraphSees); r[v] = (r[v] ?? 0) + 1; }
  process.stdout.write(`${JSON.stringify({ id: e.id, ok: s.ok, error: s.error, files: s.files.length, layered: Object.keys(s.layers).length, imports: s.imports.length, items: s.items.length, ms: s.ms, msParts: s.msParts, stats: s.stats, byRule }, null, 1)}\n`);
  git(clone, ['checkout', '-f', '-q', '--detach', e.sha], true);
  fs.rmSync(path.join(clone, e.root, HARNESS), { force: true });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const reposDir = arg('repos', argv);
  const id = arg('id', argv);
  if ((cmd !== 'walk' && cmd !== 'probe') || reposDir === undefined || id === undefined) {
    process.stderr.write('usage: apg2-fixes-mined-run.ts walk|probe --repos <dir> --id <id> [--n 100] [--cache <dir>] [--sha <sha>]\n');
    process.exitCode = 2;
    return;
  }
  const corpus = (JSON.parse(fs.readFileSync(CORPUS, 'utf8')) as { entries: CorpusEntry[] }).entries;
  const e = corpus.find((x) => x.id === id);
  if (e === undefined) throw new Error(`unknown id ${id}`);
  if (cmd === 'probe') { await probe(path.resolve(reposDir), e, arg('sha', argv)); return; }
  await walk(path.resolve(reposDir), e, Number(arg('n', argv) ?? '100'), path.resolve(arg('cache', argv) ?? path.join(reposDir, '..', 'apg2-snapcache')));
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});
