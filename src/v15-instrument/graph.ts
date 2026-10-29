/**
 * v1.5 instrument, APG-V15 graph build and RULES-V15 runner (promoted from `experiments/detect-02/lib/graph.ts`,
 * logic unchanged). DETECT-02: build the graph (frozen `extractAPG` nodes and edges, imported read-only, plus the DETECT-02
 * facts of `facts.ts`) in the interpreter's `MemoryGraph`, and run the experimental rules (`../rules/*.cypher`) on
 * `cypher-interp`. Zero model calls.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractAPG, V13_APG2_OPTIONS } from '../apg-extractor/index.js';
import { executeQuery, MemoryGraph, parseCypher } from '../cypher-interp/index.js';
import { fromDriver, toDriver } from '../cypher-interp/driver-values.js';
import type { GraphNode } from '../cypher-interp/values.js';
import { computeFacts } from './facts.js';
import type { Facts } from './facts.js';
import { preflightSpec } from './preflight.js';
import type { PreflightResult } from './preflight.js';
import { findSpec, loadSpec } from './spec.js';
import type { DetectSpec } from './spec.js';

export const VERSION = 'v1.5';
/** The prototype this module was promoted from; DRIFT-01 and PUZZLE-04 records carry it. */
export const PROTOTYPE_VERSION = 'detect-02/v1.5-exp';

/** The sentinel rule file: a directory holding it is the rules directory. */
const RULES_SENTINEL = 'r-d4-multi-aggregate-write.cypher';

/**
 * The directory of this module. `__dirname` exists under CommonJS (jest) and tsx; the compiled ESM output (`dist/`, the
 * npx package) has none, so the module's own file is read from a stack frame (no `import.meta`, which CommonJS rejects).
 */
function moduleDir(): string | undefined {
  if (typeof __dirname === 'string') return __dirname;
  const m = /(file:\/\/[^\s()]+?|\/[^\s()]+?)\/v15-instrument\/graph\.[cm]?[jt]s/.exec(new Error().stack ?? '');
  if (m === null) return undefined;
  const parent = m[1]!.startsWith('file://') ? fileURLToPath(m[1]!) : m[1]!;
  return path.join(parent, 'v15-instrument');
}

/** The real path of the entry script (`node_modules/.bin/daedalus-mcp` resolves to the package's `dist/.../main.js`). */
function realEntry(entry: string | undefined): string | undefined {
  if (entry === undefined || entry === '') return undefined;
  try { return fs.realpathSync(entry); } catch { return path.resolve(entry); }
}

export interface RulesDirInputs { readonly here?: string | undefined; readonly entry?: string | undefined; readonly cwd: string }

/**
 * The rules directory from explicit inputs. Candidates, in order: next to this module (`src/v15-instrument/rules` from
 * source; `dist/v15-instrument/rules` from the build, which copies the `.cypher` files there with
 * `scripts/copy-v15-rules.mjs`), the source tree from this module or the working directory, every ancestor `a` of the
 * entry script (`a/v15-instrument/rules`, `a/dist/v15-instrument/rules`, `a/src/v15-instrument/rules`), and an
 * installed package under the working directory.
 */
export function rulesDirFrom(inputs: RulesDirInputs): string {
  const here = inputs.here !== undefined ? [inputs.here] : [];
  const ancestors: string[] = [];
  if (inputs.entry !== undefined) {
    for (let d = path.dirname(inputs.entry); ; d = path.dirname(d)) {
      ancestors.push(d);
      if (path.dirname(d) === d) break;
    }
  }
  const candidates = [
    ...here.map((d) => path.join(d, 'rules')),
    ...here.map((d) => path.resolve(d, '..', '..', 'src', 'v15-instrument', 'rules')),
    path.resolve(inputs.cwd, 'src', 'v15-instrument', 'rules'),
    ...ancestors.flatMap((a) => [path.join(a, 'v15-instrument', 'rules'), path.join(a, 'dist', 'v15-instrument', 'rules'), path.join(a, 'src', 'v15-instrument', 'rules')]),
    path.resolve(inputs.cwd, 'node_modules', 'daedalus-arch', 'dist', 'v15-instrument', 'rules'),
  ];
  return candidates.find((d) => fs.existsSync(path.join(d, RULES_SENTINEL))) ?? path.resolve(inputs.cwd, 'src', 'v15-instrument', 'rules');
}

/** The RULES-V15 Cypher files (`src/v15-instrument/rules/*.cypher`, the only rule definition), from source or the package. */
export function rulesDir(): string {
  return rulesDirFrom({ here: moduleDir(), entry: realEntry(process.argv[1]), cwd: process.cwd() });
}

export interface Rule { readonly id: string; readonly family: string; readonly title: string; readonly rule: string; readonly fix: string; readonly applies: string; readonly file: string; readonly text: string }
export interface Finding {
  readonly rule: string; readonly family: string; readonly file: string; readonly line: number | null; readonly subject: string;
  readonly evidence: string; readonly path: readonly string[]; readonly status: 'violation' | 'allowed' | 'info'; readonly note?: string;
}
export interface TreeResult { readonly findings: Finding[]; readonly stats: Record<string, number>; readonly facts: Facts; readonly spec: DetectSpec; readonly ms: number; readonly preflight?: PreflightResult }

export function loadRules(dir = rulesDir()): Rule[] {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.cypher')).sort().map((f) => {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const meta = (k: string): string => new RegExp(`^// ${k}: (.*)$`, 'm').exec(text)?.[1]?.trim() ?? '';
    return { id: meta('id'), family: meta('family'), title: meta('title'), rule: meta('rule'), fix: meta('fix'), applies: meta('applies'), file: f, text };
  });
}

/** A harness-style tsconfig for the tree (DETECT-01 shape): strict, ES2022, no @types, `src/**` only. */
export function writeTsconfig(tree: string, scratch: string): string {
  fs.mkdirSync(scratch, { recursive: true });
  const file = path.join(scratch, `${Buffer.from(path.resolve(tree)).toString('base64url').slice(-60)}.tsconfig.json`);
  const config = {
    compilerOptions: { strict: true, target: 'ES2022', lib: ['ES2022'], module: 'commonjs', moduleResolution: 'node', esModuleInterop: true, skipLibCheck: true, noEmit: true, types: [], experimentalDecorators: true },
    include: [`${path.resolve(tree).replace(/\/+$/, '')}/src/**/*.ts`],
    exclude: [`${path.resolve(tree)}/src/**/*.spec.ts`, `${path.resolve(tree)}/src/**/*.test.ts`],
  };
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
  return file;
}

export interface BuildOptions {
  readonly spec?: string | undefined; readonly style?: string | undefined; readonly withApg?: boolean | undefined; readonly scratch?: string | undefined; readonly tsconfig?: string | undefined;
  /** R-MIRROR2 stoplist: a baseline tree (for example the task's seed) whose core terms are the project's own. */
  readonly baseline?: string | undefined;
}

export async function buildGraph(tree: string, opts: BuildOptions = {}): Promise<{ graph: MemoryGraph; facts: Facts; spec: DetectSpec; stats: Record<string, number>; preflight?: PreflightResult }> {
  const scratch = opts.scratch ?? fs.mkdtempSync(path.join(os.tmpdir(), 'detect-02-'));
  const tsconfig = opts.tsconfig ?? writeTsconfig(tree, scratch);
  const spec = loadSpec(tree, opts.spec, opts.style);
  // Pre-flight (reported, never acted on here): the frozen schema, the frozen DDD binder and the v1.5 reader.
  const specFile = findSpec(tree, opts.spec);
  const preflight = specFile !== undefined ? await preflightSpec(specFile) : undefined;
  const graph = new MemoryGraph();
  const stats: Record<string, number> = {};
  const node = (labels: string[], p: Record<string, unknown>): GraphNode =>
    graph.createNode(labels, new Map(Object.entries(p).filter(([, v]) => v !== undefined).map(([k, v]) => [k, fromDriver(v)] as const)));
  const rel = (t: string, a: GraphNode, b: GraphNode, p: Record<string, unknown> = {}): void => {
    graph.createRelationship(t, a, b, new Map(Object.entries(p).filter(([, v]) => v !== undefined).map(([k, v]) => [k, fromDriver(v)] as const)));
    stats[t] = (stats[t] ?? 0) + 1;
  };

  // Frozen facts (read-only import): every APG node and edge, so the rules can join on them.
  const apgMethod = new Map<string, GraphNode>();
  if (opts.withApg !== false) {
    const r = await extractAPG(path.resolve(tree), V13_APG2_OPTIONS, tsconfig);
    if (r.success) {
      const byId = new Map<string, GraphNode>();
      for (const n of r.data.nodes) {
        const p: Record<string, unknown> = { id: n.id, name: n.name, filePath: n.filePath, role: n.filePath ? spec.roleOf(n.filePath) : undefined };
        for (const [k, v] of Object.entries(n.properties)) if (typeof v !== 'object' || Array.isArray(v)) p[k] = v;
        const g = node([n.type, 'APGNode'], p);
        byId.set(n.id, g);
        if (n.type === 'Method') apgMethod.set(`${n.filePath}#${n.name}`, g);
      }
      for (const e of r.data.edges) {
        const s = byId.get(e.sourceId); const t = byId.get(e.targetId);
        if (s && t) graph.createRelationship(e.type, s, t, new Map(Object.entries(e.properties).filter(([, v]) => typeof v !== 'object' || Array.isArray(v)).map(([k, v]) => [k, fromDriver(v)] as const)));
      }
      stats.apgNodes = r.data.nodes.length; stats.apgEdges = r.data.edges.length;
    } else stats.apgFailed = 1;
  }

  const facts = computeFacts(tree, tsconfig, spec, { specFile, baseline: opts.baseline });
  const contexts = new Map<string, GraphNode>();
  const ctx = (name: string): GraphNode => { let c = contexts.get(name); if (!c) { c = node(['Context'], { name }); contexts.set(name, c); } return c; };
  const roots = new Map<string, GraphNode>();
  for (const r of facts.roots) {
    const g = node(['Root'], { name: r.name, file: r.file, line: r.line, context: r.context ?? '', declared: r.declared });
    roots.set(r.name, g);
    if (r.context) rel('OWNS', ctx(r.context), g, { source: r.declared ? 'spec' : 'folder' });
  }
  // Delegation: a command that only calls another command of its class with the same write sites reports at the delegate.
  const sites = (c: Facts['commands'][number]): string => [...new Set(c.writes.map((w) => `${w.file}:${w.line}`))].sort().join('|');
  const byId = new Map(facts.commands.map((c) => [c.id, c] as const));
  for (const c of facts.commands) {
    // CN-01 K06: a facade method whose write sites are exactly one ordinary command's reports at that command.
    const delegating = c.facade
      ? c.writes.length > 0 && facts.commands.some((t) => t !== c && !t.facade && t.writes.length > 0 && sites(t) === sites(c))
      : c.delegatesTo.some((d) => { const t = byId.get(d); return t !== undefined && t.writes.length > 0 && sites(t) === sites(c); });
    const g = node(['Command'], { id: c.id, name: c.name, file: c.file, line: c.line, context: c.context ?? '', eventHandler: c.eventHandler, published: c.published, delegating });
    const m = apgMethod.get(`${c.file}#${c.name}`);
    if (m) rel('IS_METHOD', g, m);
    const perRoot = new Map<string, Facts['commands'][number]['writes'][number][]>();
    for (const w of c.writes) perRoot.set(w.root, [...(perRoot.get(w.root) ?? []), w]);
    for (const [rootName, ws] of perRoot) {
      const r = roots.get(rootName); if (!r) continue;
      const keys = [...new Set(ws.map((w) => w.instance))];
      const many = ws.some((w) => w.many);
      const count = Math.max(keys.length, many ? 2 : 1);
      const first = [...ws].sort((a, b) => a.via.length - b.via.length || a.line - b.line)[0]!;
      const writeSites = [...new Set(ws.flatMap((w) => [`${w.file}:${w.line} ${w.sink}`, `${w.sinkSite} (declaration of ${w.sink})`]))].sort();
      rel('WRITE_FOOTPRINT', g, r, { instanceCount: count, many, instances: keys, sites: writeSites, via: [...first.via, first.sink], line: first.line, file: first.file, inScope: ws.some((w) => w.inScope) });
      const rf = facts.roots.find((x) => x.name === rootName);
      if (rf?.context && c.context && rf.context !== c.context) {
        const viaPublished = ws.some((w) => w.via.some((v) => v.startsWith('{}.')) || spec.isPublished(w.file));
        rel('CONTEXT_WRITE', g, r, { from: c.context, to: rf.context, via: [...first.via, first.sink], line: first.line, file: first.file, viaPublished, eventPath: c.eventHandler });
      }
    }
  }
  for (const gd of facts.guards) {
    const u = node(['Unit'], { name: gd.unit, file: gd.file, role: gd.role });
    const g = node(['Guard'], { line: gd.line, cond: gd.cond, reason: gd.reason, root: gd.root, duplicated: gd.duplicated, file: gd.file });
    rel('RULE_SITE', u, g, { line: gd.line });
  }
  for (const v of facts.invariantSites) {
    const u = node(['Unit'], { name: v.unit, file: v.file, role: v.role });
    const i = node(['Invariant'], { id: v.invariant, kind: v.kind, owner: v.owner, statement: v.statement });
    rel('INVARIANT_SITE', u, i, { line: v.line, file: v.file, cond: v.cond, matched: [...v.matched], overCollection: v.overCollection ?? '' });
  }
  for (const x of facts.locks) {
    const u = node(['Unit'], { name: x.unit, file: x.file });
    const l = node(['LockSite'], { lock: x.lock, line: x.line, file: x.file });
    rel('LOCK_AROUND_WRITE', u, l, { roots: [...x.roots], line: x.line });
  }
  for (const x of facts.calcs) {
    const u = node(['Unit'], { name: x.unit, file: x.file });
    const r = roots.get(x.root) ?? node(['Root'], { name: x.root });
    rel('CALC_OUTSIDE', u, r, { expr: x.expr, line: x.line, file: x.file });
  }
  for (const x of facts.refs) {
    const a = roots.get(x.root); const b = roots.get(x.target);
    if (a && b) rel('REFERENCES_ROOT', a, b, { member: x.member, line: x.line, file: x.file });
  }
  for (const x of facts.adapterImports) {
    const a = node(['AdapterFile'], { file: x.file, pkg: x.fromPkg });
    const b = node(['AdapterFile'], { file: x.target, pkg: x.toPkg });
    rel('ADAPTER_IMPORTS', a, b, { line: x.line, specifier: x.specifier });
  }
  for (const x of facts.transports) {
    const u = node(['CoreFile'], { file: x.file, role: x.role });
    const t = node(['TransportConcept'], { form: x.form, detail: x.detail });
    rel('USES_TRANSPORT', u, t, { line: x.line });
  }
  for (const x of facts.locators) {
    const u = node(['CodeFile'], { file: x.file, role: x.role });
    const d = node(['Lookup'], { form: x.form, detail: x.detail });
    rel('LOCATES', u, d, { line: x.line });
  }
  for (const x of facts.coreIo) {
    const u = node(['CoreFile'], { file: x.file, role: x.role });
    const d = node(['IoAccess'], { form: x.form, detail: x.detail });
    rel('CORE_IO', u, d, { line: x.line });
  }
  for (const x of facts.entityOut) {
    const a = node(['InboundHandler'], { name: x.handler, file: x.file });
    const b = node(['EntityType'], { name: x.entity, file: x.entityFile });
    rel('ENTITY_OUT', a, b, { form: x.form, line: x.line });
  }
  for (const x of facts.adapterRules) {
    const u = node(['AdapterUnit'], { name: x.unit, file: x.file });
    const d = node(['Decision'], { cond: x.cond, reads: x.reads, effect: x.effect });
    rel('ADAPTER_DECIDES', u, d, { line: x.line });
  }
  for (const x of facts.mirrors) {
    const c = node(['CoreType'], { name: x.core, file: x.file, role: x.role });
    const v = node(['VendorType'], { name: x.vendor, module: x.module });
    rel('MIRRORS_VENDOR', c, v, { form: x.form, detail: x.detail, line: x.line });
  }
  // R-MIRROR2 (H11 v2): one Token node per token; vendor terms, core terms and the adapters' value maps point to it.
  const tokens = new Map<string, GraphNode>();
  const tok = (t: string): GraphNode => { let g = tokens.get(t); if (!g) { g = node(['Token'], { token: t }); tokens.set(t, g); } return g; };
  if (facts.vendorTerms.length > 0) {
    for (const v of facts.vendorTerms) {
      const g = node(['VendorTerm'], { module: v.module, decl: v.decl, kind: v.kind, text: v.text, set: v.set, setSize: v.setSize, isError: v.isError, ownedBy: v.ownedBy });
      rel('TERM_TOKEN', g, tok(v.token));
    }
    for (const c of facts.coreTerms) {
      const g = node(['CoreTerm'], { file: c.file, line: c.line, role: c.role, kind: c.kind, text: c.text, symbol: c.symbol, context: c.context, set: c.set, setSize: c.setSize, owner: c.owner, ownerFields: c.ownerFields });
      rel('TERM_TOKEN', g, tok(c.token));
    }
    for (const m of facts.valueMaps) {
      const g = node(['ValueMap'], { file: m.file, line: m.line, from: m.from, to: m.to, form: m.form });
      rel('MAPS_FROM', g, tok(`lit:${m.from}`));
      rel('MAPS_TO', g, tok(`lit:${m.to}`));
    }
  }
  for (const x of facts.repoMulti) {
    const a = node(['RepositoryMethod'], { name: `${x.repo}.${x.method}`, file: x.file, line: x.line });
    const r = roots.get(x.root) ?? node(['Root'], { name: x.root });
    rel('PERSISTS_MANY', a, r, { form: x.form, line: x.line });
  }
  for (const x of facts.domainTech) {
    const a = node(['DomainFile'], { file: x.file });
    const b = node(['TechModule'], { module: x.module, category: x.category });
    rel('DOMAIN_IMPORTS_TECH', a, b, { line: x.line });
  }
  for (const c of facts.contracts) {
    const a = node(['ContractType'], { name: c.contract, file: c.file, line: c.line });
    const b = node(['EntityType'], { name: c.entity, file: c.entityFile });
    rel('CONTRACT_EXPOSES', a, b, { form: c.form, via: c.via, line: c.line });
  }
  for (const p of facts.portMechanisms) {
    const a = node(['PortMethod'], { name: `${p.port}.${p.method}`, file: p.file, line: p.line });
    const b = node(['Mechanism'], { form: p.form, detail: p.detail });
    rel('PORT_MECHANISM', a, b, { form: p.form, detail: p.detail });
  }
  for (const i of facts.injections) {
    const a = node(['AppClass'], { name: i.cls, file: i.file, line: i.line });
    const b = node(['AdapterClass'], { name: i.adapter, file: i.adapterFile });
    rel('CONCRETE_INJECTION', a, b, { form: i.form, line: i.line });
  }
  for (const x of facts.remoteInTx) {
    const a = node(['Unit'], { name: x.unit, file: x.file });
    const b = node(['IOSite'], { module: x.remote, file: x.remoteFile, line: x.remoteLine });
    rel('REMOTE_IN_TX', a, b, { scope: x.scope, line: x.line, via: x.via });
  }
  for (const [k, v] of Object.entries(facts.stats)) stats[k] = v;
  stats.nodes = graph.nodes.length; stats.relationships = graph.relationships.length;
  if (preflight !== undefined) { stats.preflightOk = preflight.ok ? 1 : 0; stats.preflightErrors = preflight.errors.length; }
  return { graph, facts, spec, stats, ...(preflight !== undefined ? { preflight } : {}) };
}

const num = (v: unknown): number | null =>
  typeof v === 'number' ? v : typeof v === 'object' && v !== null && 'toNumber' in v ? (v as { toNumber(): number }).toNumber() : null;

export async function runTree(tree: string, rules: readonly Rule[], opts: BuildOptions = {}): Promise<TreeResult> {
  const t0 = Date.now();
  const { graph, facts, spec, stats, preflight } = await buildGraph(tree, opts);
  const findings: Finding[] = [];
  for (const r of rules) {
    if (r.id === 'R-INJ' && spec.style === 'layered') continue; // Layered services may depend on concrete persistence
    if (r.id === 'R-D9' && spec.style === 'hexagonal') continue; // HCAL-01: a use case may return domain objects through its in-port
    const out = executeQuery(parseCypher(r.text), graph, new Map());
    for (const row of out.rows) {
      const o: Record<string, unknown> = {};
      out.columns.forEach((c, i) => { o[c] = toDriver(row[i] ?? null); });
      const file = String(o.file);
      const subject = String(o.subject);
      const method = subject.includes('.') ? subject.split('.').pop() : subject;
      const allowed = spec.allow.find((a) => a.rule === r.id && (a.command === `${file}#${method}` || a.command === `${file}#*` || a.command === `${file}#${subject}`));
      const fallbackRoots = facts.rootSource === 'fallback' && ['R-D4', 'R-XCTX', 'R-D5'].includes(r.id);
      findings.push({
        rule: r.id, family: r.family, file, line: num(o.line), subject, evidence: String(o.evidence),
        path: Array.isArray(o.path) ? [...new Set((o.path as unknown[]).map(String))] : [],
        status: allowed ? 'allowed' : fallbackRoots && spec.style === 'layered' ? 'info' : 'violation',
        ...(allowed ? { note: `allowed by detect02.allow.yaml: ${allowed.reason}` } : fallbackRoots ? { note: spec.style === 'layered' ? 'information only: a Layered spec declares no aggregates; roots inferred' : 'aggregate roots inferred (no DDD block in the spec)' } : {}),
      });
    }
  }
  return { findings, stats, facts, spec, ms: Date.now() - t0, ...(preflight !== undefined ? { preflight } : {}) };
}
