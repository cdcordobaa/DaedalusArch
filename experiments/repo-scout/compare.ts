/**
 * REPO-SCOUT (v1.5-exp): the DETECT-02 comprehension tools' answers against compiler truth, on one large tree.
 * Zero model calls. The graph index and tools are imported read-only from `experiments/detect-02/mcp/comprehend/`.
 *
 * Per question (`questions/<repo>.json`), the truth is `truth.ts` (the TypeScript language service). The graph's
 * answer is what the four tools give, plus, as a ceiling, what the index underneath them holds:
 *   - `who_writes`  (writers questions with `aggregate`): the commands listed;
 *   - `impact`      (callers/writers questions with `impact` targets): `references` (files) and `commands`;
 *   - `trace`       (one sample command per question, `trace`): the units and adapters the call tree shows;
 *   - `context_map` (once per tree): contexts, aggregates, commands, and where they come from;
 *   - `index`       (ceiling): every call edge the index holds, plus the calls it records as unresolved, matched to the
 *                   question's members (callers/writers) or modules (crossCalls). No tool returns more than this.
 * Agreement is recall (truth found by the graph) and precision (graph rows that are true), at three grains: call sites
 * (file:line), units, and files. Lists are compared uncapped (the tools cap at 25 rows; the totals are recorded).
 *
 * Usage: npx tsx experiments/repo-scout/compare.ts --tree <dir> --tsconfig <file> --spec <yaml> --questions <json> --out <json>
 *        [--skip-impact]   (impact also runs the DETECT-02 rules once; skip it when that does not finish)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { buildIndex } from '../detect-02/mcp/comprehend/index.js';
import type { ComprehendIndex } from '../detect-02/mcp/comprehend/index.js';
import { contextMap, impact, trace, whoWrites } from '../detect-02/mcp/comprehend/tools.js';
import { TruthProject } from './truth.js';
import type { Question, Truth } from './truth.js';

/**
 * Graph hints per question: `aggregate` for who_writes, `impact` targets, a `trace` command, and `graphOwners`: the
 * classes whose members an index edge may target for a callers/writers question (default: the type and its
 * implementations). When members are inherited from a base class, the base is listed: the index records the callee,
 * not the receiver's type, so it cannot tell `subscriberRepo.create` from `jobRepo.create`, and precision shows that.
 */
type GraphQuestion = Question & { readonly aggregate?: string; readonly impact?: readonly string[]; readonly trace?: string; readonly graphOwners?: readonly string[] };

export interface Agreement { readonly truth: number; readonly graph: number; readonly both: number; readonly recall: number | null; readonly precision: number | null }
export const agree = (truth: Iterable<string>, graph: Iterable<string>): Agreement => {
  const t = new Set(truth); const g = new Set(graph);
  const both = [...t].filter((x) => g.has(x)).length;
  return { truth: t.size, graph: g.size, both, recall: t.size ? both / t.size : null, precision: g.size ? both / g.size : null };
};

const arg = (n: string): string | undefined => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const need = (n: string): string => { const v = arg(n); if (v === undefined) throw new Error(`missing --${n}`); return v; };

/** Index call sites (edges and unresolved calls) that answer a callers/writers question. */
function indexCallerSites(ix: ComprehendIndex, q: GraphQuestion, t: Truth): { site: string; unit: string; file: string; how: string }[] {
  if (q.kind === 'crossCalls') return [];
  const members = new Set(t.members.map((m) => `${q.type}.${m}`));
  const implFiles = new Set((t.implementations ?? []).map((i) => i.split('#')[0]!));
  const implNames = new Set((t.implementations ?? []).map((i) => i.split('#')[1]!));
  const out: { site: string; unit: string; file: string; how: string }[] = [];
  for (const [from, edges] of ix.calls) {
    for (const e of edges) {
      const to = ix.units.get(e.to);
      const viaPort = e.port !== undefined && members.has(e.port);
      // A direct call on the implementing class (when the caller holds the concrete type).
      const direct = to !== undefined && to.owner !== null && t.members.includes(to.name.split('.').pop()!)
        && ((implFiles.has(to.file) && implNames.has(to.owner)) || (q.graphOwners ?? []).includes(to.owner));
      // A direct call on the type itself when it is a class.
      const self = to !== undefined && to.file === q.file && to.owner === q.type && t.members.includes(to.name.split('.').pop()!);
      if (viaPort || direct || self) out.push({ site: `${e.file}:${e.line}`, unit: from, file: e.file, how: viaPort ? 'edge via port' : 'edge direct' });
    }
  }
  for (const [unit, us] of ix.unresolved) for (const u of us) if (members.has(u.call)) out.push({ site: `${u.file}:${u.line}`, unit, file: u.file, how: 'unresolved' });
  return out;
}

function indexCrossSites(ix: ComprehendIndex, q: Question): { site: string; unit: string; file: string; how: string }[] {
  if (q.kind !== 'crossCalls') return [];
  const from = picomatch([...q.from]); const to = picomatch([...q.to]);
  const ex = q.exclude !== undefined ? picomatch([...q.exclude]) : (): boolean => false;
  const out: { site: string; unit: string; file: string; how: string }[] = [];
  for (const [u, edges] of ix.calls) for (const e of edges) {
    const t = ix.units.get(e.to);
    if (t && from(e.file) && !ex(e.file) && to(t.file) && !ex(t.file)) out.push({ site: `${e.file}:${e.line}`, unit: u, file: e.file, how: `edge ${e.via}` });
  }
  // Calls to a declaration in the target module that is not a unit (an interface member with no implementation).
  for (const [u, us] of ix.unresolved) for (const x of us) if (from(x.file) && !ex(x.file)) out.push({ site: `${x.file}:${x.line}`, unit: u, file: x.file, how: 'unresolved (callee unknown)' });
  return out;
}

const flat = (s: { unit: string; children: readonly unknown[] } & Record<string, unknown>, acc: string[] = []): string[] => {
  acc.push(`${String(s.file)}#${s.unit}`);
  for (const c of s.children as typeof s[]) flat(c, acc);
  return acc;
};

async function main(): Promise<void> {
  const tree = path.resolve(need('tree'));
  const tsconfig = path.resolve(need('tsconfig'));
  const spec = path.resolve(need('spec'));
  const questions = JSON.parse(fs.readFileSync(need('questions'), 'utf8')) as GraphQuestion[];
  const skipImpact = process.argv.includes('--skip-impact');
  const mem = (): number => Math.round(process.memoryUsage().rss / 1e6);

  const t0 = Date.now();
  const tp = new TruthProject(tree, tsconfig);
  const truthLoadMs = Date.now() - t0;
  const truths = questions.map((q) => tp.answer(q));
  process.stdout.write(`truth: ${tp.sources.length} files, load ${truthLoadMs} ms; ${truths.map((t) => `${t.id} ${t.sites.length} sites/${t.units.length} units/${t.files.length} files`).join('; ')}\n`);

  const ix = buildIndex(tree, { spec, tsconfig });
  process.stdout.write(`index: ${ix.files.length} files, ${ix.units.size} units, ${[...ix.calls.values()].reduce((a, e) => a + e.length, 0)} call edges, ${ix.facts.roots.length} roots, ${ix.facts.commands.length} commands, ${ix.buildMs} ms, rss ${mem()} MB\n`);
  const cm = contextMap(ix);

  const rows = [];
  for (const [i, q] of questions.entries()) {
    const t = truths[i]!;
    const idx = q.kind === 'crossCalls' ? indexCrossSites(ix, q) : indexCallerSites(ix, q, t);
    const truthUnits = t.units;
    const row: Record<string, unknown> = {
      id: q.id, kind: q.kind, question: q.question, truth: { sites: t.sites.length, units: t.units.length, files: t.files.length, typeRefFiles: t.typeRefFiles?.length, implementations: t.implementations, unitsNotIndexNamed: [...new Set(t.sites.filter((s) => !s.indexNamed).map((s) => s.unit))].length, ms: t.ms },
      index: {
        sites: agree(t.sites.map((s) => `${s.file}:${s.line}`), idx.map((x) => x.site)),
        sitesEdgesOnly: agree(t.sites.map((s) => `${s.file}:${s.line}`), idx.filter((x) => x.how.startsWith('edge')).map((x) => x.site)),
        units: agree(truthUnits, idx.map((x) => x.unit)),
        files: agree(t.files, idx.map((x) => x.file)),
        how: Object.fromEntries([...new Set(idx.map((x) => x.how))].map((h) => [h, idx.filter((x) => x.how === h).length])),
      },
    };
    if (q.aggregate !== undefined) {
      try {
        const w = whoWrites(ix, q.aggregate);
        const all = w.writers.total;
        row.who_writes = { total: all, capped: w.writers.truncated, commands: agree(truthUnits, w.writers.shown.map((r) => r.id)), files: agree(t.files, w.writers.shown.map((r) => r.file)), notes: w.notes };
      } catch (e) { row.who_writes = { error: (e as Error).message }; }
    }
    if (q.impact !== undefined && !skipImpact) {
      const refs = new Set<string>(); const cmdUnits = new Set<string>(); const cmdFiles = new Set<string>(); const totals: Record<string, unknown>[] = [];
      for (const target of q.impact) {
        const s0 = Date.now();
        try {
          const im = await impact(ix, target, tsconfig);
          // Uncapped lists: the index functions under the tool (the tool shows the first 25 with the total).
          const [file, sym] = target.includes('#') ? target.split('#') as [string, string] : [target, null];
          for (const r of sym !== null ? ix.referencesOf(file, sym) : ix.importedBy.get(file) ?? []) refs.add(r);
          for (const c of im.commands.shown) { cmdUnits.add(`${c.file}#${c.command}`); cmdFiles.add(c.file); }
          totals.push({ target, references: im.references?.total ?? null, importers: im.importers.total, commands: im.commands.total, commandsCapped: im.commands.truncated, ms: Date.now() - s0 });
        } catch (e) { totals.push({ target, error: (e as Error).message, ms: Date.now() - s0 }); }
      }
      const truthFiles = new Set([...(t.typeRefFiles ?? []), ...t.files]);
      row.impact = { targets: totals, referenceFiles: agree(truthFiles, refs), callerFilesByReferences: agree(t.files, refs), commandUnits: agree(truthUnits, cmdUnits), commandFiles: agree(t.files, cmdFiles) };
    }
    if (q.trace !== undefined) {
      try {
        const tr = trace(ix, q.trace, { full: true });
        const units = flat(tr.root as unknown as { unit: string; children: readonly unknown[] } & Record<string, unknown>);
        row.trace = { command: q.trace, nodes: tr.nodes, truncated: tr.truncated, adapters: tr.adapters.length, writes: tr.writes.length, units: units.length, notes: tr.notes };
      } catch (e) { row.trace = { error: (e as Error).message }; }
    }
    row.truthSample = t.sites.slice(0, 12);
    row.missedByIndex = t.sites.filter((s) => !idx.some((x) => x.site === `${s.file}:${s.line}`)).slice(0, 12);
    rows.push(row);
    process.stdout.write(`${q.id}: ${JSON.stringify(row.index)}\n`);
  }
  const out = {
    tree: path.basename(tree), truthFiles: tp.sources.length, truthLoadMs,
    index: { files: ix.files.length, units: ix.units.size, callEdges: [...ix.calls.values()].reduce((a, e) => a + e.length, 0), unresolved: [...ix.unresolved.values()].reduce((a, e) => a + e.length, 0), roots: ix.facts.roots.length, rootSource: ix.facts.rootSource, commands: ix.facts.commands.length, buildMs: ix.buildMs, rssMB: mem() },
    contextMap: { contexts: cm.contexts.map((c) => ({ name: c.name, source: c.source, files: c.files, aggregates: c.aggregates, commands: c.commands })), aggregates: cm.aggregates.length, aggregatesFrom: cm.aggregatesFrom, notes: cm.notes },
    questions: rows, truths,
  };
  fs.mkdirSync(path.dirname(path.resolve(need('out'))), { recursive: true });
  fs.writeFileSync(need('out'), `${JSON.stringify(out, null, 1)}\n`);
}

main().catch((e: unknown) => { process.stderr.write(`${(e as Error).stack ?? String(e)}\n`); process.exit(1); });
