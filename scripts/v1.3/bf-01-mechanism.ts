/**
 * BF-01 mechanism check (zero calls). For every pilot session, compares the session spec's file-to-layer map with A's
 * (by layer kind, files under src/, as the baseline scorer). Every file whose kind differs is classified by the import
 * structure of the spec-free parser graph (`lib/bf-01-facts.ts`, cypher-interp):
 *
 *   order violations of a file = its import edges (both directions, to or from another mapped file) that point from an
 *   inner layer to an outer one under a spec (layer index = position in the spec's layer list, inner first).
 *   code-consistent: the session's placement gives the file FEWER violations (under the session's own map and order)
 *                    than A's placement gives it (under A's map and order) -> "right about the code, different from
 *                    the declared intent";
 *   plain error:     MORE violations than under A;
 *   undecided:       the same number (the code does not decide), or the file has no import edge to a mapped file.
 *
 * A "unit" groups the files of one session that share (folder at depth 3, A kind, session kind). A unit is
 * code-consistent / plain error by the majority of its files (ties: undecided). Also counts layer-order differences.
 *
 *   npx tsx scripts/v1.3/bf-01-mechanism.ts [--variant derived|scored]   -> <pilot>/mechanism.{json,md}
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildFactsGraph, readOnlyQuery } from './lib/bf-01-facts.js';

const PILOT = 'results/v1.3-brownfield/llm-pilot';
const variant = process.argv.includes('--variant') ? process.argv[process.argv.indexOf('--variant') + 1] ?? 'derived' : 'derived';
const SEL = (JSON.parse(fs.readFileSync('results/v1.3-external/selection.json', 'utf8')) as { entries: { id: string; root: string }[] }).entries;
interface Labels { id: string; layerNames: string[]; kinds: Record<string, string>; files: Record<string, string> }
const A = new Map((JSON.parse(fs.readFileSync('results/v1.3-brownfield/labels/labels-a.json', 'utf8')) as Labels[]).map((r) => [r.id, r]));
const OUT = new Set(['excluded', 'unmapped']);
const kindOf = (l: Labels, x: string): string => (OUT.has(x) ? x : l.kinds[x] ?? x);
const folder = (f: string): string => f.split('/').slice(0, 3).join('/');

function violations(f: string, lab: Labels, edges: [string, string][]): { v: number; e: number } {
  const idx = (x: string): number => { const l = lab.files[x]; return l === undefined || OUT.has(l) ? -1 : lab.layerNames.indexOf(l); };
  let v = 0; let e = 0;
  for (const [s, t] of edges) {
    if (s !== f && t !== f) continue;
    const i = idx(s); const j = idx(t);
    if (i < 0 || j < 0 || s === t) continue;
    e++;
    if (i < j) v++;
  }
  return { v, e };
}

async function main(): Promise<void> {
  const rows: Record<string, unknown>[] = [];
  const unitsAll: Record<string, unknown>[] = [];
  const edgesBy = new Map<string, [string, string][]>();
  for (const sid of fs.readdirSync(path.join(PILOT, 'sessions')).filter((x) => /^bf01-.*-r\d$/.test(x)).sort()) {
    const dir = path.join(PILOT, 'sessions', sid);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as { repo: string; arm: string; run: number };
    const lf = path.join(dir, `labels.${variant}.json`);
    if (!fs.existsSync(lf)) continue;
    const S = (JSON.parse(fs.readFileSync(lf, 'utf8')) as Labels[])[0];
    const a = A.get(meta.repo);
    if (S === undefined || a === undefined) continue;
    if (!edgesBy.has(meta.repo)) {
      const e = SEL.find((x) => x.id === meta.repo);
      const g = await buildFactsGraph(path.join('tmp/brownfield-clones', meta.repo, e?.root ?? '.'));
      const r = await readOnlyQuery(g, 'MATCH (a:File)-[:IMPORTS]->(b:File) RETURN DISTINCT a.filePath AS a, b.filePath AS b', 1_000_000);
      edgesBy.set(meta.repo, r.rows.map((x) => [String(x.a), String(x.b)]));
    }
    const edges = edgesBy.get(meta.repo) ?? [];
    const files = Object.keys(a.files).filter((f) => f.startsWith('src/') && a.files[f] !== 'excluded' && f in S.files);
    const diff = files.filter((f) => kindOf(a, a.files[f] ?? '') !== kindOf(S, S.files[f] ?? ''));
    const cls = { kindLabelOnly: 0, omission: 0, addition: 0, bothConsistent: 0, codeConsistent: 0, plainError: 0, undecided: 0, noEdges: 0 };
    const units = new Map<string, { files: number; cc: number; pe: number; un: number; examples: string[] }>();
    for (const f of diff) {
      const vs = violations(f, S, edges); const va = violations(f, a, edges);
      let c: keyof typeof cls;
      const sl = S.files[f] ?? ''; const al = a.files[f] ?? '';
      if (sl === al && !OUT.has(sl)) c = 'kindLabelOnly';
      else if (OUT.has(sl)) c = 'omission';
      else if (OUT.has(al)) c = 'addition';
      else if (vs.e === 0 && va.e === 0) c = 'noEdges';
      else if (vs.v < va.v) c = 'codeConsistent';
      else if (vs.v > va.v) c = 'plainError';
      else c = vs.v === 0 ? 'bothConsistent' : 'undecided';
      cls[c]++;
      const key = `${folder(f)} | A ${kindOf(a, a.files[f] ?? '')} -> ${meta.arm} ${kindOf(S, S.files[f] ?? '')}`;
      const u = units.get(key) ?? { files: 0, cc: 0, pe: 0, un: 0, examples: [] };
      u.files++; if (c === 'codeConsistent') u.cc++; else if (c === 'plainError') u.pe++; else u.un++;
      if (u.examples.length < 2) u.examples.push(`${f} (viol ${String(vs.v)}/${String(vs.e)} vs A ${String(va.v)}/${String(va.e)})`);
      units.set(key, u);
    }
    const uc = { codeConsistent: 0, plainError: 0, undecided: 0 };
    for (const [key, u] of units) {
      const verdict = u.cc > u.pe && u.cc >= u.un ? 'codeConsistent' : u.pe > u.cc && u.pe >= u.un ? 'plainError' : 'undecided';
      uc[verdict]++;
      unitsAll.push({ sid, repo: meta.repo, arm: meta.arm, unit: key, verdict, ...u });
    }
    const orderSame = JSON.stringify(S.layerNames.map((l) => S.kinds[l])) === JSON.stringify(a.layerNames.map((l) => a.kinds[l]));
    rows.push({ sid, repo: meta.repo, arm: meta.arm, run: meta.run, layers: S.layerNames, kinds: S.layerNames.map((l) => S.kinds[l]), orderSameKindsAsA: orderSame, filesCompared: files.length, filesDiffering: diff.length, files: cls, units: uc });
  }
  interface Agg { sessions: number; filesCompared: number; filesDiffering: number; kindLabelOnly: number; omission: number; addition: number; bothConsistent: number; fCC: number; fPE: number; fUN: number; fNE: number; uCC: number; uPE: number; uUN: number }
  const agg: Record<string, Agg> = {};
  for (const r of rows) {
    const k = `${String(r.repo)} ${String(r.arm)}`;
    const t = agg[k] ?? (agg[k] = { sessions: 0, filesCompared: 0, filesDiffering: 0, kindLabelOnly: 0, omission: 0, addition: 0, bothConsistent: 0, fCC: 0, fPE: 0, fUN: 0, fNE: 0, uCC: 0, uPE: 0, uUN: 0 });
    const f = r.files as Record<string, number>; const u = r.units as Record<string, number>;
    t.sessions++; t.filesCompared += Number(r.filesCompared); t.filesDiffering += Number(r.filesDiffering);
    for (const k2 of ['kindLabelOnly', 'omission', 'addition', 'bothConsistent'] as const) t[k2] += f[k2] ?? 0;
    t.fCC += f.codeConsistent ?? 0; t.fPE += f.plainError ?? 0; t.fUN += f.undecided ?? 0; t.fNE += f.noEdges ?? 0;
    t.uCC += u.codeConsistent ?? 0; t.uPE += u.plainError ?? 0; t.uUN += u.undecided ?? 0;
  }
  fs.writeFileSync(path.join(PILOT, `mechanism.${variant}.json`), `${JSON.stringify({ definition: 'see scripts/v1.3/bf-01-mechanism.ts header', variant, aggregate: agg, sessions: rows, units: unitsAll }, null, 1)}\n`);
  const md = [`# BF-01 mechanism (${variant} specs vs A; generated by scripts/v1.3/bf-01-mechanism.ts)`, '',
    '| repo arm | sessions | files differing / compared | kind label only | omission (A maps, session does not) | addition | re-placed, 0 violations under both | code-consistent (right about code, not intent) | plain error | undecided / no edges |', '|---|---|---|---|---|---|---|---|---|---|',
    ...Object.entries(agg).map(([k, t]) => `| ${k} | ${String(t.sessions)} | ${String(t.filesDiffering)}/${String(t.filesCompared)} | ${String(t.kindLabelOnly)} | ${String(t.omission)} | ${String(t.addition)} | ${String(t.bothConsistent)} | ${String(t.fCC)} | ${String(t.fPE)} | ${String(t.fUN)} / ${String(t.fNE)} |`),
    '', '| session | unit (folder, A kind -> session kind) | files | verdict | example |', '|---|---|---|---|---|',
    ...unitsAll.map((u) => `| ${String(u.sid)} | ${String(u.unit)} | ${String(u.files)} | ${String(u.verdict)} | ${(u.examples as string[])[0] ?? ''} |`)];
  fs.writeFileSync(path.join(PILOT, `mechanism.${variant}.md`), `${md.join('\n')}\n`);
  process.stdout.write(`${md.slice(0, 8).join('\n')}\n`);
  for (const r of rows) process.stdout.write(`${String(r.sid)} layers=${JSON.stringify(r.layers)} kinds=${JSON.stringify(r.kinds)} orderSameKindsAsA=${String(r.orderSameKindsAsA)}\n`);
}

main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exit(1); });
