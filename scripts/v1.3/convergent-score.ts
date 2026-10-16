/**
 * Scores the convergent-validity run (Docs/DiagnosticRuns/v1.3-validity-convergent-2026-10-16.md). Entry file: no
 * exports. Reads <work>/keys/<corpus>/<id>.json written by `convergent-run.ts run`; reads no project source.
 *
 * Usage (repository root): node --import tsx scripts/v1.3/convergent-score.ts --work <dir>
 * Writes results/v1.3-validity-convergent/{agreement.json, agreement.md, disagreements.csv, manifest-scores.json,
 * manifest-scores.md, keys/<corpus>/<id>.json (the normalised keys and scoped universe, no paths outside a project)}.
 *
 * Manifests (reference set only):
 * - author: every variant's expectedFindings (tests/fixtures/v1.3-reference, read through reference-model.ts);
 * - blind: rebuilt from the committed adjudication sheet of the last scored run
 *   (results/v1.3-reference/after-member-facts/adjudication.csv). That sheet lists every scored key on which our tool,
 *   the author manifest and the blind manifest do not all agree, so blind = (rows with blind = finding) ∪ (author keys
 *   with no row). The rebuild is checked against that run's committed blind-expanded counts (see `blindCheck`).
 *   The sealed blind files themselves are not read (they are not in this repository).
 * FF-S02 keys are cycle-normalised as in ue-score.ts: a cycle is its sorted file set (file = first, target = rest).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { addTables, agreement, KIND_UNIT, key, layerOf, splitKey, table, wilson } from './lib/convergent.js';
import type { LayerSel, RuleKind, Table } from './lib/convergent.js';
import { loadAllReferences } from './lib/reference-model.js';
import { toCsv } from './lib/graph-fidelity.js';

const REPO = process.cwd();
const OUT = path.join(REPO, 'results/v1.3-validity-convergent');
const argv = process.argv.slice(2);
const workArg = argv[argv.indexOf('--work') + 1];
if (!argv.includes('--work') || workArg === undefined) throw new Error('--work <dir> is required');
const WORK = path.resolve(workArg);
const ENGINES = ['ours', 'depcruise', 'boundaries', 'archunit'] as const;
type EngineName = (typeof ENGINES)[number];
const TOOL_CAN: Readonly<Record<Exclude<EngineName, 'ours'>, ReadonlySet<RuleKind>>> = {
  depcruise: new Set<RuleKind>(['layer-edge', 'package', 'cycle', 'orphan', 'fan-in', 'context', 'aggregate', 'repo-aggregate']),
  boundaries: new Set<RuleKind>(['layer-edge', 'package', 'context', 'aggregate', 'repo-aggregate', 'unknown-file']),
  archunit: new Set<RuleKind>(['layer-edge', 'cycle', 'context', 'aggregate', 'repo-aggregate', 'unknown-file']),
};
const can = (e: EngineName, k: RuleKind): boolean => e === 'ours' || TOOL_CAN[e].has(k);

interface ToolRun { keys: string[]; errors: string[]; wallMs: number; outOfScope: number; cycleLen?: Record<string, number>; notComputed?: string[] }
interface KeysFile {
  corpus: string; id: string; style: string; programFiles: number; ourFileNodes: number; barrels: string[]; ourFailedFunctions: unknown[];
  rules: { id: string; template: string; kind: RuleKind; view: string }[]; layers: LayerSel[];
  files: string[]; universe: { edges: string[]; packages: string[]; reexports: string[] }; unresolved: string[];
  tools: Record<EngineName, ToolRun>;
}

function readKeys(): KeysFile[] {
  const out: KeysFile[] = [];
  for (const corpus of ['reference', 'external', 'wild']) {
    const dir = path.join(WORK, 'keys', corpus);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as KeysFile);
  }
  return out;
}

const writeJson = (p: string, v: unknown): void => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n'); };
const ruleLabel = (r: { id: string; template: string }): string => `${r.id} ${r.template}`;

/** Universe size of one rule in one project: every item either tool could have flagged. */
function universeSize(k: KeysFile, kind: RuleKind, flagged: ReadonlySet<string>, id: string): number {
  const unit = KIND_UNIT[kind];
  const items = new Set<string>();
  if (unit === 'file') for (const f of k.files) items.add(key(id, f));
  else if (unit === 'package-edge') for (const e of k.universe.packages) { const [a = '', b = ''] = e.split('|'); items.add(key(id, a, b)); }
  else for (const e of k.universe.edges) { const [a = '', b = ''] = e.split('|'); items.add(key(id, a, b)); }
  for (const f of flagged) items.add(f);
  return items.size;
}

// ── Disagreement classes ─────────────────────────────────────────────────────

type Cls = 'translation gap' | 'barrel or alias resolution' | 'our bug' | 'their bug' | 'view choice' | 'unclassified';

interface Ctx {
  k: KeysFile; edges: ReadonlySet<string>; pkgEdges: ReadonlySet<string>; barrels: ReadonlySet<string>; unresolvedFrom: ReadonlySet<string>;
  reexports: ReadonlySet<string>;
  /** Files with at least one package import. */
  pkgFiles: ReadonlySet<string>;
  /** Edges that lie on a cycle of the literal graph without its re-export edges (the graph ArchUnitTS builds). */
  onCycleWithoutReexports: ReadonlySet<string>;
  /** Files matched by a negated-extglob glob (`!(…)`) of the spec's layers. */
  extglobFiles: (f: string) => boolean;
}

/** Edges inside a strongly connected component (Tarjan), i.e. edges that lie on some cycle. */
function edgesOnCycles(edges: readonly [string, string][]): Set<string> {
  const adj = new Map<string, string[]>();
  for (const [a, b] of edges) adj.set(a, [...(adj.get(a) ?? []), b]);
  const index = new Map<string, number>(); const low = new Map<string, number>(); const comp = new Map<string, number>();
  const stack: string[] = []; const on = new Set<string>(); let i = 0; let c = 0;
  const strong = (v: string): void => {
    index.set(v, i); low.set(v, i); i++; stack.push(v); on.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) { strong(w); low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0)); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0));
    }
    if (low.get(v) === index.get(v)) { let w: string | undefined; do { w = stack.pop(); if (w !== undefined) { on.delete(w); comp.set(w, c); } } while (w !== v && w !== undefined); c++; }
  };
  for (const v of adj.keys()) if (!index.has(v)) strong(v);
  return new Set(edges.filter(([a, b]) => a !== b && comp.get(a) === comp.get(b)).map(([a, b]) => `${a}|${b}`));
}

/**
 * The class of one disagreement between our tool and an external tool, with the evidence. The rules are mechanical
 * and are stated in the report (§4); each was written after reading the rows it covers (POST-HOC), and every row they
 * do not cover stays `unclassified` for reading by hand.
 */
function classify(c: Ctx, rule: { kind: RuleKind; view: string }, side: 'ours-only' | 'tool-only', tool: EngineName, file: string, target: string): { cls: Cls; why: string } {
  const edge = `${file}|${target}`;
  if (tool === 'boundaries' && (c.extglobFiles(file) || (target !== '' && c.extglobFiles(target)))) {
    return { cls: 'their bug', why: 'eslint-plugin-boundaries classifies files with micromatch.capture, which returns no match for a negated extglob (`!(*.module).ts`) that micromatch.isMatch accepts; the file becomes an unknown element and its imports go unchecked' };
  }
  if (tool === 'archunit' && side === 'ours-only' && rule.kind === 'cycle' && !c.onCycleWithoutReexports.has(edge)) {
    return { cls: 'barrel or alias resolution', why: 'ArchUnitTS builds no edge for `export … from` re-exports; every cycle through this edge passes through a barrel re-export' };
  }
  if (tool === 'archunit' && side === 'ours-only' && c.reexports.has(edge)) {
    return { cls: 'barrel or alias resolution', why: 'the edge is an `export … from` re-export, which ArchUnitTS does not record as a dependency' };
  }
  if (tool === 'depcruise' && side === 'tool-only' && rule.kind === 'cycle' && (c.k.tools.depcruise.cycleLen?.[key(c.k.rules.find((r) => r.kind === 'cycle')?.id ?? '', file, target)] ?? 0) > 10) {
    return { cls: 'translation gap', why: 'the cycle dependency-cruiser reports is longer than 10 modules; our no-cyclic-deps enumerates simple cycles of length 2..10 (MAX_CYCLE_LENGTH, BR-U1-28)' };
  }
  if (rule.kind === 'orphan' && side === 'ours-only' && c.pkgFiles.has(file)) return { cls: 'translation gap', why: 'orphan definitions differ: the file imports only packages; ours counts file-to-file IMPORTS/RE_EXPORTS only, dependency-cruiser counts a package import as a dependency' };
  if (rule.kind === 'orphan' && side === 'tool-only' && c.barrels.has(file)) return { cls: 'translation gap', why: 'orphan definitions differ: ours never reports a barrel (NOT f.isBarrel); dependency-cruiser does' };
  if (rule.kind === 'fan-in') return { cls: 'translation gap', why: 'fan-in definitions differ: ours counts distinct importers over IMPORTS (re-exports excluded); dependency-cruiser counts every dependent module' };
  if (rule.view === 'resolved') {
    if (side === 'ours-only' && rule.kind !== 'package' && !c.edges.has(edge)) return { cls: 'view choice', why: 'resolved view: our edge goes to the declaring file behind a barrel; the tools see the import of the barrel' };
    if (side === 'ours-only' && rule.kind === 'package' && !c.pkgEdges.has(edge)) return { cls: 'view choice', why: 'resolved view: the package reaches this file through a re-export, not an import statement of its own' };
    if (side === 'tool-only' && c.barrels.has(target)) return { cls: 'view choice', why: 'resolved view: the tool flags the import of a barrel; ours follows it to the declaring files' };
  }
  if (side === 'ours-only' && rule.kind !== 'package' && rule.kind !== 'unknown-file' && !c.edges.has(edge) && c.unresolvedFrom.has(file)) {
    return { cls: 'barrel or alias resolution', why: 'the external resolver left an import of this file unresolved (path alias or extension); ours resolved it' };
  }
  return { cls: 'unclassified', why: `${tool}: ${side}` };
}

// ── Manifests ────────────────────────────────────────────────────────────────

interface Finding { ruleId: string; file: string; target: string }

function canon(f: Finding): Finding {
  if (f.ruleId !== 'FF-S02') return f;
  const files = [...new Set([...f.file.split(','), ...f.target.split(',')].map((s) => s.trim()).filter((s) => s !== ''))].sort();
  return { ruleId: f.ruleId, file: files[0] ?? f.file, target: files.slice(1).join(',') };
}
const fk = (f: Finding): string => `${f.ruleId}|${f.file}|${f.target}`;

/** Cycle edges → cycle-normalised keys: one per connected group of reported cycle edges. */
function cycleKeys(keys: readonly string[]): string[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r) ?? r; parent.set(x, r); return r; };
  const out: string[] = [];
  const byRule = new Map<string, [string, string][]>();
  for (const k of keys) {
    const { rule, file, target } = splitKey(k);
    if (rule !== 'FF-S02') { out.push(k); continue; }
    byRule.set(rule, [...(byRule.get(rule) ?? []), [file, target]]);
  }
  for (const [rule, edges] of byRule) {
    parent.clear();
    for (const [a, b] of edges) { if (!parent.has(a)) parent.set(a, a); if (!parent.has(b)) parent.set(b, b); parent.set(find(a), find(b)); }
    const groups = new Map<string, Set<string>>();
    for (const n of parent.keys()) { const r = find(n); groups.set(r, (groups.get(r) ?? new Set()).add(n)); }
    for (const g of groups.values()) { const s = [...g].sort(); out.push(fk({ ruleId: rule, file: s[0] ?? '', target: s.slice(1).join(',') })); }
  }
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  const [head = [], ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// ── Main ─────────────────────────────────────────────────────────────────────

const all = readKeys();
const disagreements: Record<string, unknown>[] = [];
type Cell = { tables: Table[]; projects: number; style: Set<string> };
const cells = new Map<string, Map<string, Cell>>(); // `${corpus}|${rule label}|${kind}|${view}` -> pair -> cell
const pairs: [EngineName, EngineName][] = [];
for (let i = 0; i < ENGINES.length; i++) for (let j = i + 1; j < ENGINES.length; j++) pairs.push([ENGINES[i] as EngineName, ENGINES[j] as EngineName]);
const errorsOut: Record<string, unknown>[] = [];
const notComputed: Record<string, unknown>[] = [];

for (const k of all) {
  const ctx: Ctx = {
    k, edges: new Set(k.universe.edges), pkgEdges: new Set(k.universe.packages), barrels: new Set(k.barrels),
    unresolvedFrom: new Set(k.unresolved.map((u) => u.split('|')[0] ?? '')),
    reexports: new Set(k.universe.reexports ?? []),
    pkgFiles: new Set(k.universe.packages.map((e) => e.split('|')[0] ?? '')),
    onCycleWithoutReexports: edgesOnCycles(k.universe.edges.filter((e) => !(k.universe.reexports ?? []).includes(e)).map((e) => e.split('|') as [string, string])),
    extglobFiles: picomatch(k.layers.flatMap((l) => [...l.dirs, ...l.files]).filter((g) => g.includes('!(')).concat(['\u0000never']), { dot: true }),
  };
  for (const e of ENGINES) if (k.tools[e].errors.length > 0) errorsOut.push({ corpus: k.corpus, id: k.id, tool: e, errors: k.tools[e].errors.slice(0, 20), count: k.tools[e].errors.length });
  for (const r of k.rules) {
    const sets = Object.fromEntries(ENGINES.map((e) => [e, new Set(k.tools[e].keys.filter((x) => x.startsWith(`${r.id}|`)))])) as Record<EngineName, Set<string>>;
    const cellKey = `${k.corpus}|${ruleLabel(r)}|${r.kind}|${r.view}`;
    const byPair = cells.get(cellKey) ?? new Map<string, Cell>();
    cells.set(cellKey, byPair);
    for (const [a, b] of pairs) {
      if (!can(a, r.kind) || !can(b, r.kind)) continue;
      if ((k.tools[a].notComputed ?? []).includes(r.id) || (k.tools[b].notComputed ?? []).includes(r.id)) { notComputed.push({ corpus: k.corpus, project: k.id, rule: r.id, pair: `${a}~${b}` }); continue; }
      const u = universeSize(k, r.kind, new Set([...sets[a], ...sets[b]]), r.id);
      const cell = byPair.get(`${a}~${b}`) ?? { tables: [], projects: 0, style: new Set<string>() };
      cell.tables.push(table(sets[a], sets[b], u)); cell.projects++; cell.style.add(k.style);
      byPair.set(`${a}~${b}`, cell);
      if (a !== 'ours') continue;
      for (const [side, from, other] of [['ours-only', sets.ours, sets[b]], ['tool-only', sets[b], sets.ours]] as const) {
        for (const x of from) {
          if (other.has(x)) continue;
          const { file, target } = splitKey(x);
          const c = classify(ctx, r, side, b, file, target);
          disagreements.push({
            corpus: k.corpus, project: k.id, style: k.style, rule: r.id, template: r.template, kind: r.kind, view: r.view, tool: b, side, file, target,
            fileLayer: layerOf(file, k.layers) ?? '', targetLayer: KIND_UNIT[r.kind] === 'edge' ? layerOf(target, k.layers) ?? '' : '',
            literalEdge: KIND_UNIT[r.kind] === 'edge' ? String(ctx.edges.has(`${file}|${target}`)) : KIND_UNIT[r.kind] === 'package-edge' ? String(ctx.pkgEdges.has(`${file}|${target}`)) : '',
            targetIsBarrel: String(ctx.barrels.has(target)), cls: c.cls, why: c.why,
          });
        }
      }
    }
  }
  // Committed keys: relative paths only, no file list.
  writeJson(path.join(OUT, 'keys', k.corpus, `${k.id.replace('/', '__')}.json`), {
    corpus: k.corpus, id: k.id, style: k.style, programFiles: k.programFiles, ourFileNodes: k.ourFileNodes, ourFailedFunctions: k.ourFailedFunctions,
    rules: k.rules, universe: { edges: k.universe.edges.length, packages: k.universe.packages.length }, unresolved: k.unresolved, barrels: k.barrels,
    tools: Object.fromEntries(ENGINES.map((e) => [e, { keys: k.tools[e].keys, outOfScope: k.tools[e].outOfScope, wallMs: k.tools[e].wallMs, errors: k.tools[e].errors.length, notComputed: k.tools[e].notComputed ?? [] }])),
  });
}

// Agreement rows.
const agreeRows: Record<string, unknown>[] = [];
for (const [ck, byPair] of [...cells].sort((x, y) => x[0].localeCompare(y[0]))) {
  const [corpus = '', label = '', kind = '', view = ''] = ck.split('|');
  for (const [pk, cell] of byPair) {
    const t = addTables(cell.tables);
    const a = agreement(t);
    agreeRows.push({ corpus, rule: label, kind, view, pair: pk, projects: cell.projects, styles: [...cell.style].sort().join(' '), ...t, ...a });
  }
}

// Per corpus and pair, pooled over every comparable rule (for the headline table).
const pooled: Record<string, unknown>[] = [];
for (const corpus of ['reference', 'external', 'wild']) {
  for (const [a, b] of pairs) {
    const pk = `${a}~${b}`;
    const ts: Table[] = [];
    for (const [ck, byPair] of cells) if (ck.startsWith(`${corpus}|`)) ts.push(...(byPair.get(pk)?.tables ?? []));
    if (ts.length === 0) continue;
    const t = addTables(ts);
    pooled.push({ corpus, pair: pk, ...t, ...agreement(t) });
  }
}

// Disagreement class counts.
const classCounts: Record<string, Record<string, number>> = {};
for (const d of disagreements) {
  const k2 = `${String(d.corpus)}|${String(d.tool)}|${String(d.rule)} ${String(d.template)}`;
  classCounts[k2] = classCounts[k2] ?? {};
  const cc = classCounts[k2];
  cc[String(d.cls)] = (cc[String(d.cls)] ?? 0) + 1;
}

// ── Manifest scoring (reference set) ─────────────────────────────────────────
const refs = loadAllReferences(REPO);
const adj: { style: string; variant: string; rule: string; file: string; target: string; blind: string; scope: string }[] = parseCsv(fs.readFileSync(path.join(REPO, 'results/v1.3-reference/after-member-facts/adjudication.csv'), 'utf8')).map((r) => ({ style: r.style ?? '', variant: r.variant ?? '', rule: r.rule ?? '', file: r.file ?? '', target: r.target ?? '', blind: r.blind ?? '', scope: r.scope ?? '' })).filter((r) => r.scope === 'scored');
const manifestRows: Record<string, unknown>[] = [];
const blindCheck: Record<string, unknown>[] = [];
type C3 = { tp: number; fn: number; fp: number };
const acc = new Map<string, C3>();
const bump = (k3: string, d: Partial<C3>): void => { const c = acc.get(k3) ?? { tp: 0, fn: 0, fp: 0 }; acc.set(k3, { tp: c.tp + (d.tp ?? 0), fn: c.fn + (d.fn ?? 0), fp: c.fp + (d.fp ?? 0) }); };
for (const ref of refs) {
  for (const v of ref.variants) {
    const kf = all.find((x) => x.corpus === 'reference' && x.id === `${ref.style}/${v.manifest.variant}`);
    if (kf === undefined) continue;
    const ruleKinds = new Map(kf.rules.map((r) => [r.id, r]));
    const author = v.manifest.expectedFindings.map((f) => canon({ ruleId: f.ruleId, file: f.file, target: f.target ?? '' }));
    const rows = adj.filter((r) => r.style === ref.style && r.variant === v.manifest.variant);
    const rowKeys = new Set(rows.map((r) => fk(canon({ ruleId: r.rule, file: r.file, target: r.target }))));
    const blind = [
      ...rows.filter((r) => r.blind === 'finding').map((r) => canon({ ruleId: r.rule, file: r.file, target: r.target })),
      ...author.filter((f) => !rowKeys.has(fk(f))),
    ];
    for (const [view, expected] of [['author', author], ['blind', blind]] as const) {
      for (const e of ENGINES) {
        const actual = new Set(cycleKeys(kf.tools[e].keys));
        for (const [id, r] of ruleKinds) {
          if (!can(e, r.kind)) continue;
          const exp = new Set(expected.filter((f) => f.ruleId === id).map(fk));
          const act = [...actual].filter((x) => x.startsWith(`${id}|`));
          const tp = act.filter((x) => exp.has(x)).length;
          const c = { tp, fn: exp.size - tp, fp: act.length - tp };
          for (const scope of [`${view}|${e}|${ref.style}|${id} ${r.template}`, `${view}|${e}|${ref.style}|*`, `${view}|${e}|*|*`]) bump(scope, c);
        }
      }
    }
  }
}
for (const [k3, c] of [...acc].sort((x, y) => x[0].localeCompare(y[0]))) {
  const [view = '', engine = '', style = '', rule = ''] = k3.split('|');
  const rec = c.tp + c.fn === 0 ? null : c.tp / (c.tp + c.fn);
  const prec = c.tp + c.fp === 0 ? null : c.tp / (c.tp + c.fp);
  manifestRows.push({ view, engine, style, rule, ...c, recall: rec, recallCI: wilson(c.tp, c.tp + c.fn), precision: prec, precisionCI: wilson(c.tp, c.tp + c.fp) });
}

// Check the blind rebuild: our tool's blind counts on the rules every reference style shares with the committed run.
const committed = JSON.parse(fs.readFileSync(path.join(REPO, 'results/v1.3-reference/after-member-facts/scores.json'), 'utf8')) as { views: { style: string; view: string; perRule: { ruleId: string; counts: C3 }[] }[] };
for (const v of committed.views.filter((x) => x.view === 'blind-expanded' || x.view === 'author-cycle-normalised')) {
  for (const pr of v.perRule) {
    const mine = manifestRows.find((m) => m.view === (v.view === 'blind-expanded' ? 'blind' : 'author') && m.engine === 'ours' && m.style === v.style && String(m.rule).startsWith(`${pr.ruleId} `));
    if (mine === undefined) continue;
    blindCheck.push({ view: v.view, style: v.style, rule: pr.ruleId, committed: { tp: pr.counts.tp, fn: pr.counts.fn, fp: pr.counts.fp }, rebuilt: { tp: mine.tp, fn: mine.fn, fp: mine.fp }, equal: pr.counts.tp === mine.tp && pr.counts.fn === mine.fn && pr.counts.fp === mine.fp });
  }
}

writeJson(path.join(OUT, 'agreement.json'), { pooled, rows: agreeRows, classCounts, errors: errorsOut, notComputed });
writeJson(path.join(OUT, 'manifest-scores.json'), { rows: manifestRows, blindCheck });
const DIS_HEADER = ['corpus', 'project', 'style', 'rule', 'template', 'kind', 'view', 'tool', 'side', 'file', 'target', 'fileLayer', 'targetLayer', 'literalEdge', 'targetIsBarrel', 'cls', 'why'];
fs.writeFileSync(path.join(OUT, 'disagreements.csv'), toCsv(DIS_HEADER, disagreements.map((d) => DIS_HEADER.map((h) => d[h] ?? ''))));
process.stdout.write(`${String(all.length)} projects, ${String(agreeRows.length)} agreement rows, ${String(disagreements.length)} disagreements, blind check ${String(blindCheck.filter((b) => b.equal).length)}/${String(blindCheck.length)} equal\n`);
