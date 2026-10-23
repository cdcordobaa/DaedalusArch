/**
 * GRAPH-SCALE (v1.5-exp, U1 groundwork): the DETECT-02 comprehension tools against compiler truth on one large tree,
 * before and after the fixes. Zero model calls.
 *
 * The truth is the scout's `experiments/repo-scout/truth.ts` (the ts-morph language service), imported read-only and
 * unchanged. The graph side is `experiments/detect-02/mcp/comprehend/` as it stands in the checkout this file runs from:
 * the same harness runs on a worktree of the base commit (before) and on this branch (after), and a tool the checkout
 * does not have is reported as `n/a`.
 *
 * Per question, at three grains (call sites `file:line`, units `file#name`, files), recall and precision of:
 *   - `index`      every call edge (and unresolved call) the index holds, matched as the scout matched it
 *                  (`experiments/repo-scout/compare.ts`): the ceiling under the tools; `edgesOnly` = resolved edges
 *                  only (the scout report's "Index" column; with the unresolved calls it is "lenient");
 *   - `callers`    (callers/writers questions; after only) the callers tool on the question's type, restricted to the
 *                  question's members (the truth's member list);
 *   - `who_writes` (questions with `aggregate`): the writer units and their write sites;
 *   - `impact`     (questions with `impact` targets): reference files and the files of the commands reaching it;
 *   - `trace`      (questions with `trace`): the size of the call tree (no truth).
 * Unit ids are compared without the index's `@line` suffix for duplicate names (both runs alike).
 *
 * Truth revision R1 (2026-10-23, after the first after-measurement, harness only; `r1` in the output, beside the
 * unchanged scout truth): find-all-references on a member a class *overrides* (`IntegrationRepository.create`) also
 * returns every call of the base member (`feedRepository.create`), and the scout's receiver check covers inherited
 * members only. R1 keeps a site of a class question only when a call of that member on that line has a receiver typed
 * by the class or a subclass (the scout's own `receiverIs`, the compiler's type of the receiver). Questions on
 * interfaces are unchanged.
 *
 * Usage: npx tsx experiments/graph-scale/compare.ts --tree <dir> --tsconfig <file> --spec <yaml>
 *          --questions <json>[,<json>…] --out <json> [--skip-impact]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { buildIndex } from '../detect-02/mcp/comprehend/index.js';
import type { ComprehendIndex } from '../detect-02/mcp/comprehend/index.js';
import * as tools from '../detect-02/mcp/comprehend/tools.js';
import { Node } from 'ts-morph';
import { TruthProject } from '../repo-scout/truth.js';
import type { Question, Truth } from '../repo-scout/truth.js';

type GraphQuestion = Question & { readonly aggregate?: string; readonly impact?: readonly string[]; readonly trace?: string; readonly graphOwners?: readonly string[] };

export interface Agreement { readonly truth: number; readonly graph: number; readonly both: number; readonly recall: number | null; readonly precision: number | null }
export const agree = (truth: Iterable<string>, graph: Iterable<string>): Agreement => {
  const t = new Set(truth); const g = new Set(graph);
  const both = [...t].filter((x) => g.has(x)).length;
  return { truth: t.size, graph: g.size, both, recall: t.size ? both / t.size : null, precision: g.size ? both / g.size : null };
};
/** The index names a second unit of the same name `file#name@line`; the truth has no suffix. */
export const unitKey = (id: string): string => id.replace(/@\d+$/, '');

const arg = (n: string): string | undefined => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const need = (n: string): string => { const v = arg(n); if (v === undefined) throw new Error(`missing --${n}`); return v; };

interface Row { site: string; unit: string; file: string; how: string }

/** As `experiments/repo-scout/compare.ts` `indexCallerSites` (unchanged logic). */
function indexCallerSites(ix: ComprehendIndex, q: GraphQuestion, t: Truth): Row[] {
  if (q.kind === 'crossCalls') return [];
  const members = new Set(t.members.map((m) => `${q.type}.${m}`));
  const implFiles = new Set((t.implementations ?? []).map((i) => i.split('#')[0]!));
  const implNames = new Set((t.implementations ?? []).map((i) => i.split('#')[1]!));
  const out: Row[] = [];
  for (const [from, edges] of ix.calls) {
    for (const e of edges) {
      const to = ix.units.get(e.to);
      const viaPort = e.port !== undefined && members.has(e.port);
      const direct = to !== undefined && to.owner !== null && t.members.includes(to.name.split('.').pop()!)
        && ((implFiles.has(to.file) && implNames.has(to.owner)) || (q.graphOwners ?? []).includes(to.owner));
      const self = to !== undefined && to.file === q.file && to.owner === q.type && t.members.includes(to.name.split('.').pop()!);
      if (viaPort || direct || self) out.push({ site: `${e.file}:${e.line}`, unit: from, file: e.file, how: viaPort ? 'edge via port' : 'edge direct' });
    }
  }
  for (const [unit, us] of ix.unresolved) for (const u of us) if (members.has(u.call)) out.push({ site: `${u.file}:${u.line}`, unit, file: u.file, how: 'unresolved' });
  return out;
}

/** As `experiments/repo-scout/compare.ts` `indexCrossSites` (unchanged logic). */
function indexCrossSites(ix: ComprehendIndex, q: Question): Row[] {
  if (q.kind !== 'crossCalls') return [];
  const from = picomatch([...q.from]); const to = picomatch([...q.to]);
  const ex = q.exclude !== undefined ? picomatch([...q.exclude]) : (): boolean => false;
  const out: Row[] = [];
  for (const [u, edges] of ix.calls) for (const e of edges) {
    const t = ix.units.get(e.to);
    if (t && from(e.file) && !ex(e.file) && to(t.file) && !ex(t.file)) out.push({ site: `${e.file}:${e.line}`, unit: u, file: e.file, how: `edge ${e.via}` });
  }
  for (const [u, us] of ix.unresolved) for (const x of us) if (from(x.file) && !ex(x.file)) out.push({ site: `${x.file}:${x.line}`, unit: u, file: x.file, how: 'unresolved (callee unknown)' });
  return out;
}

const grains = (t: Truth, rows: readonly Row[]): Record<string, Agreement> => ({
  sites: agree(t.sites.map((s) => `${s.file}:${s.line}`), rows.map((x) => x.site)),
  units: agree(t.units, rows.map((x) => unitKey(x.unit))),
  files: agree(t.files, rows.map((x) => x.file)),
});

async function main(): Promise<void> {
  const tree = path.resolve(need('tree'));
  const tsconfig = path.resolve(need('tsconfig'));
  const spec = path.resolve(need('spec'));
  const questions = need('questions').split(',').flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')) as GraphQuestion[]);
  const skipImpact = process.argv.includes('--skip-impact');
  const t = tools as unknown as Record<string, unknown>;
  const has = { callers: typeof t.callerSites === 'function', entities: true };
  const mem = (): number => Math.round(process.memoryUsage().rss / 1e6);

  const t0 = Date.now();
  const tp = new TruthProject(tree, tsconfig);
  const truthLoadMs = Date.now() - t0;
  const truths = questions.map((q) => tp.answer(q));
  /** Truth R1: sites of a class question kept only when the receiver is the class or a subclass. */
  const truthR1 = (q: GraphQuestion, tr: Truth): Truth => {
    if (q.kind === 'crossCalls') return tr;
    const decl = tp.project.getSourceFile(path.join(tp.root, q.file))?.getClass(q.type);
    if (!decl) return tr;
    const keep = tr.sites.filter((st) => {
      const sf = tp.project.getSourceFile(path.join(tp.root, st.file));
      const m = st.callee.slice(st.callee.indexOf('.') + 1);
      let ok = false;
      sf?.forEachDescendant((n, trav) => {
        if (ok) { trav.stop(); return; }
        if (!Node.isCallExpression(n) || n.getStartLineNumber() !== st.line) return;
        const e = n.getExpression();
        if ((Node.isPropertyAccessExpression(e) && e.getName() === m) && tp.receiverIs(e.getExpression(), q.type)) ok = true;
      });
      return ok;
    });
    return { ...tr, sites: keep, units: [...new Set(keep.map((x) => x.unit))].sort(), files: [...new Set(keep.map((x) => x.file))].sort() };
  };
  const truthsR1 = questions.map((q, i) => truthR1(q, truths[i]!));
  process.stdout.write(`truth: ${tp.sources.length} files, load ${truthLoadMs} ms; ${truths.map((x) => `${x.id} ${x.sites.length}/${x.units.length}/${x.files.length}`).join('; ')}\n`);

  const ix = buildIndex(tree, { spec, tsconfig });
  const ixx = ix as unknown as { memberCalls?: unknown[]; entities?: unknown[]; importTypeEdges?: number };
  has.entities = Array.isArray(ixx.entities);
  const callEdges = [...ix.calls.values()].reduce((a, e) => a + e.length, 0);
  process.stdout.write(`index: ${ix.files.length} files, ${ix.units.size} units, ${callEdges} call edges, ${ix.buildMs} ms, rss ${mem()} MB\n`);

  const rows: Record<string, unknown>[] = [];
  for (const [i, q] of questions.entries()) {
    const tr = truths[i]!;
    const tr1 = truthsR1[i]!;
    let selRows: Row[] | undefined; let wwRows: Row[] | undefined;
    const idx = q.kind === 'crossCalls' ? indexCrossSites(ix, q) : indexCallerSites(ix, q, tr);
    const row: Record<string, unknown> = {
      id: q.id, kind: q.kind, question: q.question,
      truth: { sites: tr.sites.length, units: tr.units.length, files: tr.files.length, typeRefFiles: tr.typeRefFiles?.length, implementations: tr.implementations, members: tr.members, ms: tr.ms },
      index: { ...grains(tr, idx), edgesOnly: grains(tr, idx.filter((x) => x.how.startsWith('edge'))), how: Object.fromEntries([...new Set(idx.map((x) => x.how))].map((h) => [h, idx.filter((x) => x.how === h).length])) },
    };
    if (q.kind !== 'crossCalls') {
      if (has.callers) {
        const s0 = Date.now();
        try {
          const cs = (t.callerSites as typeof tools.callerSites)(ix, `${q.file}#${q.type}`);
          const want = new Set(tr.members);
          const sel: Row[] = cs.sites.filter((s) => want.has(s.member.slice(s.member.indexOf('.') + 1))).map((s) => ({ site: s.at, unit: s.unit, file: s.file, how: s.how }));
          selRows = sel;
          row.callers = { ...grains(tr, sel), how: Object.fromEntries([...new Set(sel.map((x) => x.how))].map((h) => [h, sel.filter((x) => x.how === h).length])), implementations: cs.implementations.length, ms: Date.now() - s0 };
          row.callersMissed = tr.sites.filter((s) => !sel.some((x) => x.site === `${s.file}:${s.line}`)).slice(0, 12);
          row.callersExtra = sel.filter((x) => !tr.sites.some((s) => `${s.file}:${s.line}` === x.site)).slice(0, 12);
        } catch (e) { row.callers = { error: (e as Error).message }; }
      } else row.callers = 'n/a (no callers tool in this checkout)';
    }
    if (q.aggregate !== undefined) {
      try {
        const w = tools.whoWrites(ix, q.aggregate);
        // Uncapped: the tool shows 25 rows with the total; the writer list underneath is rebuilt uncapped here.
        const all = (w as { basis?: string }).basis === 'entity stores' && typeof t.entityWriteSites === 'function'
          ? (t.entityWriteSites as typeof tools.entityWriteSites)(ix, (w as { entities?: Parameters<typeof tools.entityWriteSites>[1] }).entities ?? []).map((x) => ({ site: `${x.file}:${x.line}`, unit: x.unit, file: x.file, how: 'entity store' }))
          : w.writers.shown.flatMap((r) => r.writes.map((x) => ({ site: x.at, unit: r.id, file: r.file, how: 'footprint' })));
        wwRows = all;
        row.who_writes = {
          total: w.writers.total, capped: w.writers.truncated, basis: (w as { basis?: string }).basis ?? 'footprint', source: w.source,
          ...grains(tr, all), commands: agree(tr.units, w.writers.shown.map((r) => unitKey(r.id))), notes: w.notes,
          entities: ((w as unknown as { entities?: { name: string; file: string; source: string; evidence: unknown; stores: unknown }[] }).entities ?? []).map((e) => ({ name: e.name, file: e.file, source: e.source, evidence: e.evidence, stores: e.stores })),
        };
      } catch (e) { row.who_writes = { error: (e as Error).message }; }
    }
    if (q.impact !== undefined && !skipImpact && q.kind !== 'crossCalls') {
      const refs = new Set<string>(); const cmdFiles = new Set<string>(); const cmdUnits = new Set<string>(); const totals: Record<string, unknown>[] = [];
      for (const target of q.impact) {
        const s0 = Date.now();
        try {
          const im = await tools.impact(ix, target, tsconfig);
          const [file, sym] = target.includes('#') ? target.split('#') as [string, string] : [target, null];
          for (const r of sym !== null ? ix.referencesOf(file, sym) : ix.importedBy.get(file) ?? []) refs.add(r);
          for (const c of im.commands.shown) { cmdUnits.add(`${c.file}#${c.command}`); cmdFiles.add(c.file); }
          totals.push({ target, references: im.references?.total ?? null, importers: im.importers.total, commands: im.commands.total, ms: Date.now() - s0 });
        } catch (e) { totals.push({ target, error: (e as Error).message, ms: Date.now() - s0 }); }
      }
      row.impact = { targets: totals, referenceFiles: agree(new Set([...(tr.typeRefFiles ?? []), ...tr.files]), refs), callerFilesByReferences: agree(tr.files, refs), commandUnits: agree(tr.units, cmdUnits), commandFiles: agree(tr.files, cmdFiles) };
    }
    if (q.trace !== undefined) {
      try { const x = tools.trace(ix, q.trace, { full: true }); row.trace = { command: q.trace, nodes: x.nodes, adapters: x.adapters.length, writes: x.writes.length }; } catch (e) { row.trace = { error: (e as Error).message }; }
    }
    if (tr1 !== tr) {
      row.r1 = {
        truth: { sites: tr1.sites.length, units: tr1.units.length, files: tr1.files.length, removed: tr.sites.length - tr1.sites.length },
        index: grains(tr1, idx), indexEdgesOnly: grains(tr1, idx.filter((x) => x.how.startsWith('edge'))), ...(selRows ? { callers: grains(tr1, selRows) } : {}), ...(wwRows ? { who_writes: grains(tr1, wwRows) } : {}),
      };
    }
    row.indexMissed = tr.sites.filter((s) => !idx.some((x) => x.site === `${s.file}:${s.line}`)).slice(0, 12);
    rows.push(row);
    process.stdout.write(`${q.id}: index ${JSON.stringify((row.index as Record<string, Agreement>).sites)} callers ${JSON.stringify((row.callers as Record<string, unknown> | undefined)?.sites ?? row.callers ?? '-')} who_writes ${JSON.stringify((row.who_writes as Record<string, unknown> | undefined)?.sites ?? (row.who_writes as Record<string, unknown> | undefined)?.error ?? '-')}\n`);
  }
  const out = {
    tree: path.basename(tree), modelCalls: 0, truthFiles: tp.sources.length, truthLoadMs,
    index: {
      files: ix.files.length, units: ix.units.size, callEdges, unresolved: [...ix.unresolved.values()].reduce((a, e) => a + e.length, 0),
      memberCalls: ixx.memberCalls?.length ?? null, entities: ixx.entities?.length ?? null, importTypeEdges: ixx.importTypeEdges ?? null,
      roots: ix.facts.roots.length, rootSource: ix.facts.rootSource, commands: ix.facts.commands.length, buildMs: ix.buildMs, rssMB: mem(),
    },
    questions: rows,
  };
  fs.mkdirSync(path.dirname(path.resolve(need('out'))), { recursive: true });
  fs.writeFileSync(need('out'), `${JSON.stringify(out, null, 1)}\n`);
}

main().catch((e: unknown) => { process.stderr.write(`${(e as Error).stack ?? String(e)}\n`); process.exit(1); });
