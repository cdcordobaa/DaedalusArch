/**
 * COMPREHEND-01 graph cross-check and tool latency (zero model calls). Run after the bank's keys are committed.
 *
 *   npx tsx experiments/comprehend-01/graph-check.ts --clones <dir>
 *
 * 1. For every item a tool can answer, the answer an agent would give if it copied the tool output (the
 *    "graph oracle"), scored with the bank's scorer: this checks the class labels (G items should agree, Gw items
 *    should not) and is the start of the graph-quality diagnosis (design §7).
 * 2. Latency of each tool through the MCP layer (the experimental server, in-process client, `--confine`): the first
 *    call on a cold server (it builds the index), then warm calls with the bank's arguments.
 * Writes `results/graph-check.json` and `results/latency.json`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildIndex, clearIndexCache } from '../detect-02/mcp/comprehend/index.js';
import type { ComprehendIndex } from '../detect-02/mcp/comprehend/index.js';
import { contextMap, impact, trace, whoWrites } from '../detect-02/mcp/comprehend/tools.js';
import type { TraceStep } from '../detect-02/mcp/comprehend/tools.js';
import { createComprehendServer } from '../detect-02/mcp/comprehend-server.js';
import { contextFrom } from '../detect-02/mcp/server.js';
import { HERE, loadBank, resolveTrees, scrubber } from './lib/bank.js';
import type { Item, ResolvedTree } from './lib/bank.js';
import { scorePayload } from './lib/score.js';

const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

const quoted = (text: string): string[] => [...text.matchAll(/\b([A-Z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*)\b/g)].map((m) => m[1]!);
const filesIn = (text: string): string[] => [...text.matchAll(/(src\/[A-Za-z0-9_./-]+\.ts)/g)].map((m) => m[1]!);

/** The answer the tools give for an item, or null when no tool answers this kind of item. */
async function graphAnswer(item: Item, ix: ComprehendIndex, tsconfig: string | undefined): Promise<{ answer: Record<string, unknown>; via: string } | null> {
  const subject = quoted(item.text)[0];
  switch (item.template) {
    case 'writes': {
      const roots = ix.facts.roots.map((r) => r.name).filter((r) => whoWrites(ix, r).writers.shown.some((w) => w.command === subject));
      return { answer: { aggregates: roots }, via: 'who_writes over every aggregate (context_map)' };
    }
    case 'writers': {
      const agg = /save the (\w+) aggregate/.exec(item.text)?.[1] ?? '';
      const w = whoWrites(ix, agg);
      return { answer: { commands: [...new Set(w.writers.shown.filter((x) => x.entry === 'application service').map((x) => x.command))] }, via: `who_writes ${agg}` };
    }
    case 'owner': {
      const agg = /owns the (\w+) aggregate/.exec(item.text)?.[1] ?? '';
      return { answer: { context: contextMap(ix).aggregates.find((a) => a.name === agg)?.context ?? '' }, via: 'context_map' };
    }
    case 'chain': {
      const start = item.scoring.required?.[0] ?? subject ?? '';
      const t = trace(ix, start);
      const target = item.scoring.required?.[item.scoring.required.length - 1] ?? '';
      let found: TraceStep[] | null = null;
      const walk = (s: TraceStep, p: TraceStep[]): void => {
        if (found) return;
        const q = [...p, s];
        if (s.unit === target) { found = q; return; }
        for (const c of s.children) walk(c, q);
      };
      walk(t.root, []);
      const pathSteps = (found ?? []) as TraceStep[];
      return { answer: { chain: pathSteps.map((s) => s.unit), endFile: pathSteps.length ? pathSteps[pathSteps.length - 1]!.file : '' }, via: `trace ${start}${found ? '' : ' (target not reached)'}` };
    }
    case 'importers': {
      const f = filesIn(item.text)[0];
      if (f !== undefined && !item.text.includes('not part of')) {
        const i = await impact(ix, f, tsconfig);
        return { answer: { files: [...i.importers.shown] }, via: `impact ${f}` };
      }
      // P2-I1 form: importers, in one context, of another context's non-published files (impact on each file).
      const ctxFrom = /files of the (\w+) context/.exec(item.text)?.[1];
      const ctxTo = /a file of the (\w+) context/.exec(item.text)?.[1];
      const out = new Set<string>();
      for (const f2 of ix.files.filter((x) => ix.spec.contextOf(x) === ctxTo && !ix.spec.isPublished(x))) {
        for (const imp of (await impact(ix, f2, tsconfig)).importers.shown) if (ix.spec.contextOf(imp) === ctxFrom) out.add(imp);
      }
      return { answer: { files: [...out].sort() }, via: `impact on each non-published ${ctxTo ?? '?'} file` };
    }
    case 'risk': {
      if (item.class !== 'G' || subject === undefined) return null;
      const u = [...ix.units.values()].find((x) => x.name === subject);
      if (!u) return null;
      const i = await impact(ix, u.file, tsconfig);
      const menu = /rules ([A-Z0-9-]+) and ([A-Z0-9-]+)/.exec(item.text);
      const allowed = menu ? [menu[1]!, menu[2]!] : null;
      const rules = [...new Set(i.currentFindings.map((f) => f.rule))].filter((r) => allowed === null || allowed.includes(r));
      return { answer: { rules: rules.length ? rules : ['none'] }, via: `impact ${u.file} (current findings)` };
    }
    default:
      return null;
  }
}

async function latency(tree: ResolvedTree, items: readonly Item[]): Promise<Record<string, unknown>> {
  clearIndexCache();
  const argvS = ['--spec', tree.spec, '--project', tree.dir, '--engine', 'cypher-interp', '--confine', ...(tree.tsconfig ? ['--tsconfig', tree.tsconfig] : [])];
  const server = createComprehendServer(contextFrom(argvS, {}));
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'comprehend-01-latency', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name: string, args: Record<string, unknown>): Promise<{ ms: number; error: boolean; chars: number }> => {
    const t0 = performance.now();
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as { text?: string }[])[0]?.text ?? '';
    return { ms: Math.round(performance.now() - t0), error: r.isError === true, chars: text.length };
  };
  const cold = await call('context_map', {});
  const ix = buildIndex(tree.dir, { spec: tree.spec, tsconfig: tree.tsconfig });
  const aggs = ix.facts.roots.map((r) => r.name);
  const cmds = [...new Set(items.flatMap((i) => quoted(i.text)).filter((c) => [...ix.units.values()].some((u) => u.name === c)))];
  if (cmds.length === 0) cmds.push(...ix.facts.commands.slice(0, 2).map((c) => c.name));
  const files = [...new Set(items.flatMap((i) => filesIn(i.text)).filter((f) => ix.files.includes(f)))];
  if (files.length === 0) files.push(...ix.files.slice(0, 2));
  const warm: Record<string, { ms: number[]; maxChars: number; errors: number }> = {};
  const rec = (tool: string, r: { ms: number; error: boolean; chars: number }): void => {
    const w = (warm[tool] ??= { ms: [], maxChars: 0, errors: 0 });
    w.ms.push(r.ms); w.maxChars = Math.max(w.maxChars, r.chars); if (r.error) w.errors++;
  };
  rec('context_map', await call('context_map', {}));
  for (const g of aggs) rec('who_writes', await call('who_writes', { aggregate: g }));
  for (const c of cmds) rec('trace', await call('trace', { command: c }));
  const impactFirst = await call('impact', { target: files[0]! });
  for (const f of files) rec('impact', await call('impact', { target: f }));
  await client.close();
  const med = (xs: number[]): number => { const s = [...xs].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
  return {
    tree: tree.decl.id, files: ix.files.length, units: ix.units.size, commands: ix.facts.commands.length, aggregates: aggs.length,
    coldFirstCallMs: cold.ms, indexBuildMs: ix.buildMs, impactFirstCallMs: impactFirst.ms,
    warm: Object.fromEntries(Object.entries(warm).map(([k, v]) => [k, { calls: v.ms.length, medianMs: med(v.ms), maxMs: Math.max(...v.ms), maxChars: v.maxChars, errors: v.errors }])),
  };
}

async function main(): Promise<number> {
  const { bank, sha256 } = loadBank();
  const { trees, problems } = resolveTrees(arg('clones'));
  if (problems.length > 0) { process.stderr.write(`${problems.join('\n')}\n`); return 2; }
  const rows: Record<string, unknown>[] = [];
  const lat: Record<string, unknown>[] = [];
  for (const [id, tree] of trees) {
    const items = bank.items.filter((i) => i.tree === id);
    const ix = buildIndex(tree.dir, { spec: tree.spec, tsconfig: tree.tsconfig });
    for (const item of items) {
      const g = await graphAnswer(item, ix, tree.tsconfig);
      if (g === null) { rows.push({ id: item.id, tree: id, type: item.type, class: item.class, graph: 'n/a' }); continue; }
      const s = scorePayload(item, g.answer);
      rows.push({ id: item.id, tree: id, type: item.type, class: item.class, via: g.via, graphAnswer: g.answer, primary: s.primary, secondary: Math.round(s.secondary * 1000) / 1000, detail: s.detail });
    }
    lat.push(await latency(tree, items));
    process.stdout.write(`${id}: ${items.length} items, latency done\n`);
  }
  const answered = rows.filter((r) => r.graph !== 'n/a');
  const byClass: Record<string, { items: number; graphAnswered: number; graphCorrect: number }> = {};
  for (const r of rows) {
    const c = (byClass[String(r.class)] ??= { items: 0, graphAnswered: 0, graphCorrect: 0 });
    c.items++; if (r.graph !== 'n/a') { c.graphAnswered++; if (r.primary === 1) c.graphCorrect++; }
  }
  const mismatches = answered.filter((r) => (r.class === 'G' && r.primary !== 1) || (r.class === 'Gw' && r.primary === 1)).map((r) => r.id);
  const scrub = scrubber([path.resolve('.'), path.resolve(arg('clones') ?? '/nonexistent'), os.tmpdir()]);
  const out = { schema: 'comprehend-01-graph-check/v1', modelCalls: 0, bankSha256: sha256, byClass, classLabelMismatches: mismatches, rows };
  fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
  fs.writeFileSync(path.join(HERE, 'results', 'graph-check.json'), `${scrub(JSON.stringify(out, null, 1))}\n`);
  fs.writeFileSync(path.join(HERE, 'results', 'latency.json'), `${scrub(JSON.stringify({ schema: 'comprehend-01-latency/v1', modelCalls: 0, via: 'MCP in-process client, comprehension server with --confine', node: process.version, trees: lat }, null, 1))}\n`);
  process.stdout.write(`${JSON.stringify({ byClass, classLabelMismatches: mismatches }, null, 1)}\n`);
  for (const r of answered) process.stdout.write(`${String(r.id).padEnd(9)} ${String(r.class).padEnd(3)} ${r.primary} ${r.detail}\n`);
  return 0;
}
main().then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`); process.exitCode = 1; });
