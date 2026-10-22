/**
 * DETECT-02 (v1.5-exp): build the graph (frozen `extractAPG` nodes and edges, imported read-only, plus the DETECT-02
 * facts of `facts.ts`) in the interpreter's `MemoryGraph`, and run the experimental rules (`../rules/*.cypher`) on
 * `cypher-interp`. Zero model calls.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG, V13_APG2_OPTIONS } from '../../../src/apg-extractor/index.js';
import { executeQuery, MemoryGraph, parseCypher } from '../../../src/cypher-interp/index.js';
import { fromDriver, toDriver } from '../../../src/cypher-interp/driver-values.js';
import type { GraphNode } from '../../../src/cypher-interp/values.js';
import { computeFacts } from './facts.js';
import type { Facts } from './facts.js';
import { loadSpec } from './spec.js';
import type { DetectSpec } from './spec.js';

export const VERSION = 'detect-02/v1.5-exp';
const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export interface Rule { readonly id: string; readonly family: string; readonly title: string; readonly rule: string; readonly fix: string; readonly applies: string; readonly file: string; readonly text: string }
export interface Finding {
  readonly rule: string; readonly family: string; readonly file: string; readonly line: number | null; readonly subject: string;
  readonly evidence: string; readonly path: readonly string[]; readonly status: 'violation' | 'allowed' | 'info'; readonly note?: string;
}
export interface TreeResult { readonly findings: Finding[]; readonly stats: Record<string, number>; readonly facts: Facts; readonly spec: DetectSpec; readonly ms: number }

export function loadRules(dir = path.join(HERE, 'rules')): Rule[] {
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

export interface BuildOptions { readonly spec?: string; readonly style?: string; readonly withApg?: boolean; readonly scratch?: string; readonly tsconfig?: string }

export async function buildGraph(tree: string, opts: BuildOptions = {}): Promise<{ graph: MemoryGraph; facts: Facts; spec: DetectSpec; stats: Record<string, number> }> {
  const scratch = opts.scratch ?? fs.mkdtempSync(path.join(os.tmpdir(), 'detect-02-'));
  const tsconfig = opts.tsconfig ?? writeTsconfig(tree, scratch);
  const spec = loadSpec(tree, opts.spec, opts.style);
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

  const facts = computeFacts(tree, tsconfig, spec);
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
    const delegating = c.delegatesTo.some((d) => { const t = byId.get(d); return t !== undefined && t.writes.length > 0 && sites(t) === sites(c); });
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
  return { graph, facts, spec, stats };
}

const num = (v: unknown): number | null =>
  typeof v === 'number' ? v : typeof v === 'object' && v !== null && 'toNumber' in v ? (v as { toNumber(): number }).toNumber() : null;

export async function runTree(tree: string, rules: readonly Rule[], opts: BuildOptions = {}): Promise<TreeResult> {
  const t0 = Date.now();
  const { graph, facts, spec, stats } = await buildGraph(tree, opts);
  const findings: Finding[] = [];
  for (const r of rules) {
    if (r.id === 'R-INJ' && spec.style === 'layered') continue; // Layered services may depend on concrete persistence
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
        status: allowed ? 'allowed' : 'violation',
        ...(allowed ? { note: `allowed by detect02.allow.yaml: ${allowed.reason}` } : fallbackRoots ? { note: 'aggregate roots inferred (no DDD block in the spec)' } : {}),
      });
    }
  }
  return { findings, stats, facts, spec, ms: Date.now() - t0 };
}
