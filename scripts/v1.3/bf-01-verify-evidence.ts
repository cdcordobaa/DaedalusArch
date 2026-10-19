/**
 * BF-01 evidence check (ops/notes/bf-01-brownfield-norm-derivation.md §2), zero calls. For every session directory
 * with a derived.yaml and an evidence.json:
 *
 * - doc     {file, line, quote}: the file is git-tracked at the pin (path relative to the clone root, no escape), and the
 *           quote (trimmed, non-empty) appears verbatim in that one line.
 * - pattern {glob, count}: picomatch (dot: true) over the git-tracked files under the analysis root, relative to it,
 *           gives the same count, and the count is at least 1.
 * - stat    {query, numerator, denominator}: re-run read-only on the same spec-free parser graph (cypher-interp,
 *           `lib/bf-01-facts.ts`); one row; the same two numbers; denominator at least 1.
 *
 * Required units: `layer:<name>` per derived layer, `order`, `ff:<id>` per fitness override, `exclude:<glob>` per path
 * added to or removed from the preset's default_exclude_paths, `ddd` when the style is ddd. A unit is supported when at
 * least one citation verifies; a required unit with no entry is unsupported. The scored spec (scored.yaml) is the
 * derived spec with unsupported units dropped: an unsupported layer is removed, an unsupported fitness override is
 * reverted to the preset's entry, an unsupported exclude change is reverted. `order` cannot be dropped and is kept
 * (reported). Writes verify.json and scored.yaml per session, and <out>/verify-summary.json.
 *
 *   npx tsx scripts/v1.3/bf-01-verify-evidence.ts [--sessions results/v1.3-brownfield/llm-pilot/sessions]
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import YAML from 'yaml';
import { parseSpec } from '../../src/spec-parser/spec-parser.js';
import { buildFactsGraph, readOnlyQuery } from './lib/bf-01-facts.js';
import type { FactsGraph } from './lib/bf-01-facts.js';

const REPO_ROOT = path.resolve('.');
const CLONES = path.join(REPO_ROOT, 'tmp', 'brownfield-clones');
const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const SESSIONS = path.resolve(arg('--sessions') ?? 'results/v1.3-brownfield/llm-pilot/sessions');
export const DOC_CITATION_TYPES = ['doc'] as const;
const SELECTION = (JSON.parse(fs.readFileSync('results/v1.3-external/selection.json', 'utf8')) as { entries: { id: string; root: string; style: string }[] }).entries;
const PRESET: Record<string, string> = { 'clean-architecture': 'presets/clean-architecture.yaml', nestjs: 'presets/nestjs.yaml', layered: 'presets/layered.yaml', hexagonal: 'presets/hexagonal.yaml', ddd: 'presets/ddd.yaml' };

interface Citation { type?: string; file?: string; line?: number; quote?: string; glob?: string; count?: number; query?: string; numerator?: number; denominator?: number }
interface Unit { id?: string; origin?: string; claim?: string; citations?: Citation[] }

const graphs = new Map<string, FactsGraph>();
const tracked = new Map<string, string[]>();
function git(dir: string): string[] {
  const k = dir;
  if (!tracked.has(k)) tracked.set(k, execFileSync('git', ['-C', dir, 'ls-files', '--', '.'], { encoding: 'utf8' }).split('\n').filter(Boolean));
  return tracked.get(k) ?? [];
}

export async function checkCitation(c: Citation, repo: string, root: string): Promise<{ ok: boolean; why: string }> {
  const clone = path.join(CLONES, repo);
  if (c.type === 'doc') {
    if (typeof c.file !== 'string' || typeof c.line !== 'number' || typeof c.quote !== 'string') return { ok: false, why: 'doc: missing file, line or quote' };
    const rel = path.posix.normalize(c.file.replace(/^\.\//, ''));
    if (path.isAbsolute(rel) || rel.startsWith('..')) return { ok: false, why: 'doc: path outside the clone' };
    if (!git(clone).includes(rel) || !fs.existsSync(path.join(clone, rel))) return { ok: false, why: 'doc: file not tracked at the pin' };
    const q = c.quote.trim();
    if (q.length === 0) return { ok: false, why: 'doc: empty quote' };
    const lines = fs.readFileSync(path.join(clone, rel), 'utf8').split(/\r?\n/);
    const line = lines[c.line - 1];
    if (line === undefined) return { ok: false, why: 'doc: line out of range' };
    if (line.includes(q)) return { ok: true, why: 'doc: quote at line' };
    const near = lines.findIndex((l) => l.includes(q));
    return { ok: false, why: near >= 0 ? `doc: quote found at line ${String(near + 1)}, not ${String(c.line)}` : 'doc: quote not at that line' };
  }
  if (c.type === 'pattern') {
    if (typeof c.glob !== 'string' || typeof c.count !== 'number') return { ok: false, why: 'pattern: missing glob or count' };
    const n = git(path.join(clone, root)).filter((f) => picomatch(c.glob ?? '', { dot: true })(f)).length;
    if (n !== c.count) return { ok: false, why: `pattern: count ${String(n)}, cited ${String(c.count)}` };
    return n >= 1 ? { ok: true, why: 'pattern: same count' } : { ok: false, why: 'pattern: matches no file' };
  }
  if (c.type === 'stat') {
    if (typeof c.query !== 'string') return { ok: false, why: 'stat: missing query' };
    let g = graphs.get(repo);
    if (g === undefined) { g = await buildFactsGraph(path.join(clone, root)); graphs.set(repo, g); }
    try {
      const r = await readOnlyQuery(g, c.query);
      if (r.total !== 1) return { ok: false, why: `stat: ${String(r.total)} rows, not 1` };
      const row = r.rows[0] ?? {};
      const num = Number(row.numerator);
      const den = Number(row.denominator);
      if (!Number.isFinite(num) || !Number.isFinite(den)) return { ok: false, why: 'stat: no numerator/denominator columns' };
      if (num !== c.numerator || den !== c.denominator) return { ok: false, why: `stat: re-run gives ${String(num)}/${String(den)}, cited ${String(c.numerator)}/${String(c.denominator)}` };
      return den >= 1 ? { ok: true, why: 'stat: same counts' } : { ok: false, why: 'stat: denominator 0' };
    } catch (e) {
      return { ok: false, why: `stat: query fails: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}` };
    }
  }
  return { ok: false, why: `unknown citation type ${String(c.type)}` };
}

interface Layer { name: string }
export async function verifySession(dir: string): Promise<Record<string, unknown> | null> {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as { sid: string; repo: string; arm: string; run: number };
  const e = SELECTION.find((x) => x.id === meta.repo);
  if (e === undefined) return null;
  const derivedFile = path.join(dir, 'derived.yaml');
  const evidenceFile = path.join(dir, 'evidence.json');
  const base = { sid: meta.sid, repo: meta.repo, arm: meta.arm, run: meta.run };
  if (!fs.existsSync(derivedFile)) return { ...base, derived: false, scoredValid: false, reason: 'no derived.yaml' };
  const derived = YAML.parse(fs.readFileSync(derivedFile, 'utf8')) as { architecture: { style: string; layers?: Layer[] }; default_exclude_paths?: string[]; fitness_functions?: Record<string, unknown>[] };
  const preset = YAML.parse(fs.readFileSync(PRESET[e.style] ?? '', 'utf8')) as { default_exclude_paths?: string[]; fitness_functions: Record<string, unknown>[] };
  const units: Unit[] = fs.existsSync(evidenceFile) ? ((JSON.parse(fs.readFileSync(evidenceFile, 'utf8')) as { units?: Unit[] }).units ?? []) : [];

  const presetEx = new Set(preset.default_exclude_paths ?? []);
  const derivedEx = new Set(derived.default_exclude_paths ?? []);
  const exChanges = [...[...derivedEx].filter((x) => !presetEx.has(x)), ...[...presetEx].filter((x) => !derivedEx.has(x))];
  const ffChanged = (derived.fitness_functions ?? []).filter((f) => {
    const p = preset.fitness_functions.find((x) => x.id === f.id);
    return p === undefined || JSON.stringify(p) !== JSON.stringify(f);
  }).map((f) => String(f.id));
  const required = [...(derived.architecture.layers ?? []).map((l) => `layer:${l.name}`), 'order', ...ffChanged.map((id) => `ff:${id}`), ...exChanges.map((g) => `exclude:${g}`), ...(e.style === 'ddd' ? ['ddd'] : [])];

  const checked: { id: string; required: boolean; origin: string | null; citations: { type: string; ok: boolean; why: string }[]; supported: boolean }[] = [];
  for (const u of units) {
    const id = u.id ?? '';
    const cs: { type: string; ok: boolean; why: string }[] = [];
    for (const c of u.citations ?? []) cs.push({ type: String(c.type), ...(await checkCitation(c, e.id, e.root)) });
    checked.push({ id, required: required.includes(id), origin: typeof u.origin === 'string' ? u.origin : null, citations: cs, supported: cs.some((c) => c.ok) });
  }
  const unitOf = (id: string): (typeof checked)[number] | undefined => checked.find((u) => u.id === id);
  const reqStatus = required.map((id) => ({ id, present: unitOf(id) !== undefined, supported: unitOf(id)?.supported === true, docOnly: (() => { const u = unitOf(id); const ok = (u?.citations ?? []).filter((c) => c.ok); return ok.length > 0 && ok.every((c) => c.type === 'doc'); })() }));
  const unsupported = new Set(reqStatus.filter((r) => !r.supported).map((r) => r.id));

  // The scored spec: unsupported units dropped.
  const doc = YAML.parseDocument(fs.readFileSync(derivedFile, 'utf8'));
  const layers = doc.getIn(['architecture', 'layers']) as YAML.YAMLSeq<YAML.YAMLMap> | undefined;
  if (layers !== undefined) layers.items = layers.items.filter((l) => !unsupported.has(`layer:${String(l.get('name'))}`));
  const ffs = doc.get('fitness_functions') as YAML.YAMLSeq<YAML.YAMLMap> | undefined;
  if (ffs !== undefined) ffs.items = ffs.items.map((it) => {
    const id = String(it.get('id'));
    if (!unsupported.has(`ff:${id}`)) return it;
    const p = preset.fitness_functions.find((x) => x.id === id);
    return p === undefined ? it : (doc.createNode(p));
  });
  const ex = new Set(derived.default_exclude_paths ?? preset.default_exclude_paths ?? []);
  for (const g of exChanges) if (unsupported.has(`exclude:${g}`)) { if (ex.has(g)) ex.delete(g); else ex.add(g); }
  doc.set('default_exclude_paths', doc.createNode([...ex]));
  doc.commentBefore = `${doc.commentBefore ?? ''}\n BF-01 scored spec: unsupported units dropped by bf-01-verify-evidence.ts (${[...unsupported].join(', ') || 'none'}).`;
  fs.writeFileSync(path.join(dir, 'scored.yaml'), doc.toString({ lineWidth: 0 }));
  const parsed = await parseSpec({ specFilePath: path.join(dir, 'scored.yaml') });
  const derivedParsed = await parseSpec({ specFilePath: derivedFile });

  const allC = checked.flatMap((u) => u.citations);
  const byType: Record<string, [number, number]> = {};
  for (const c of allC) { const t = byType[c.type] ?? [0, 0]; t[1]++; if (c.ok) t[0]++; byType[c.type] = t; }
  const out = {
    ...base, derived: true, derivedValid: derivedParsed.success, scoredValid: parsed.success,
    scoredErrors: parsed.success ? [] : parsed.errors.map((x) => `${x.code}: ${x.message}`).slice(0, 10),
    citations: { verified: allC.filter((c) => c.ok).length, total: allC.length, byType },
    requiredUnits: { supported: reqStatus.filter((r) => r.supported).length, total: reqStatus.length, missing: reqStatus.filter((r) => !r.present).map((r) => r.id), unsupported: [...unsupported], docOnly: reqStatus.filter((r) => r.docOnly).map((r) => r.id) },
    originProposed: checked.filter((u) => u.origin === 'proposed').length, unitsGiven: checked.length,
    failures: checked.flatMap((u) => u.citations.filter((c) => !c.ok).map((c) => `${u.id}: ${c.why}`)),
  };
  fs.writeFileSync(path.join(dir, 'verify.json'), `${JSON.stringify({ ...out, units: checked, required: reqStatus }, null, 1)}\n`);
  return out;
}

async function main(): Promise<void> {
  const rows: unknown[] = [];
  for (const d of fs.readdirSync(SESSIONS).filter((x) => !x.includes('.failed-attempt')).sort()) {
    const dir = path.join(SESSIONS, d);
    if (!fs.existsSync(path.join(dir, 'meta.json'))) continue;
    const r = await verifySession(dir);
    if (r !== null) { rows.push(r); process.stdout.write(`${JSON.stringify({ sid: r.sid, citations: r.citations, units: r.requiredUnits, scoredValid: r.scoredValid })}\n`); }
  }
  fs.writeFileSync(path.join(path.dirname(SESSIONS), 'verify-summary.json'), `${JSON.stringify(rows, null, 1)}\n`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve('scripts/v1.3/bf-01-verify-evidence.ts')) {
  main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`); process.exit(1); });
}
