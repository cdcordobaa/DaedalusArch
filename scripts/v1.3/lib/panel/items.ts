/**
 * v1.3 model panel: the items the panel labels and the decoys that measure each rater (Docs/v1.3/model-panel.md §2).
 *
 * Every item reaches a rater as four strings and nothing else: the style definition, the file, a comment-free code
 * excerpt and the claim. Where an item came from (union sheet, external labelling sheet, wild review sheet, decoy),
 * its rule, the tool's verdict and any expected answer live only in the key (`PanelKeyRow`), never in the item.
 *
 * Loaders:
 * - `wildItems`: `results/v1.3-wild/review-sheet.md` (claim and excerpt per `### Wnn` section; the excerpts were
 *   already scrubbed by `wild-sheet.ts`). The wild run has no declared style, so the item carries `NEUTRAL_STYLE`.
 * - `unionItems`: a sheet and key written by `audit-sheet.ts union` (PR #119). Union decoys become known-wrong decoys;
 *   every other row is a target item.
 * - `externalItems`: `results/v1.3-external/labelling-sheet.csv` (branch v1.3-external-set) with the projects checked
 *   out under one root; the claim is the tool's message with rule ids removed, the excerpt is cut here.
 * - `referenceDecoys`: known-correct (manifest findings of violation variants, expected `yes`) and known-wrong
 *   (the union builder's false perturbations: target swap, direction flip, graph flip, expected `no`) findings of the
 *   reference set, built with `buildCaseItems` and an empty tool output.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRng, shuffle } from '../../../lib/stats.js';
import { derivedSeed } from '../labelling/sampler.js';
import { excerpt, styleDefinition } from '../labelling/meaningful-prompt.js';
import { buildCaseItems, renderedClaim } from '../labelling/union.js';
import type { UnionItem, UnionKeyRow } from '../labelling/union.js';
import { materialiseVariant } from '../materialise.js';
import type { LoadedReference } from '../reference-model.js';

export type PanelOrigin = 'union' | 'external' | 'wild' | 'decoy';
export type DecoyTruth = 'yes' | 'no';

/** What a rater sees. */
export interface PanelItem {
  /** Content hash (cassette item key); never shown. */
  readonly key: string;
  readonly style: string;
  readonly styleDefinition: string;
  readonly file: string;
  readonly claim: string;
  /** Numbered, comment-free lines; null when the source was not readable (the item is then excluded). */
  readonly excerpt: string | null;
}

/** What only the analysis sees. */
export interface PanelKeyRow {
  readonly key: string;
  readonly origin: PanelOrigin;
  /** The id on the source sheet (W07, U012, external row 31) or the decoy recipe. */
  readonly sourceId: string;
  readonly project: string;
  readonly rule: string;
  /** Decoys only: the label a correct rater gives. */
  readonly truth?: DecoyTruth;
  readonly decoyKind?: string;
}

export interface Loaded {
  readonly items: PanelItem[];
  readonly key: PanelKeyRow[];
  /** Rows that could not be rendered (unreadable source, unparsable row), with the reason. */
  readonly excluded: { readonly sourceId: string; readonly reason: string }[];
}

/** The wild run declares no style: the rater judges against general principles. */
export const NEUTRAL_STYLE = 'none declared';
export const NEUTRAL_STYLE_DEFINITION = [
  '- No architectural style is declared for this code base. Judge against widely shared principles of software architecture:',
  '  dependencies point from volatile, concrete code towards stable, abstract code; layers and components keep their',
  '  responsibilities; side effects and framework details stay at the edges; cycles between components are avoided.',
].join('\n');

export function itemKey(parts: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24);
}

function mk(style: string, def: string, file: string, claim: string, ex: string | null): PanelItem {
  return { key: itemKey([style, file, claim, ex ?? '']), style, styleDefinition: def, file, claim, excerpt: ex };
}

// ── Markdown sheets ──────────────────────────────────────────────────────────

/** `### <id>…` sections of a sheet: the first fenced block of each, by id. */
export function sheetExcerpts(md: string, idPattern: RegExp): Map<string, string> {
  const out = new Map<string, string>();
  const lines = md.split('\n');
  let id: string | null = null;
  let inFence = false;
  let buf: string[] = [];
  for (const line of lines) {
    const h = /^###\s+(\S+?)[:\s]/.exec(`${line} `);
    if (!inFence && h !== null && idPattern.test(h[1] ?? '')) { id = h[1] ?? null; continue; }
    if (id !== null && /^```/.test(line)) {
      if (!inFence) { inFence = true; buf = []; continue; }
      inFence = false;
      if (!out.has(id)) out.set(id, buf.join('\n'));
      id = null;
      continue;
    }
    if (inFence) buf.push(line);
  }
  return out;
}

function tableRows(md: string, idPattern: RegExp): string[][] {
  const rows: string[][] = [];
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.replace(/\\\|/g, '').split('|').slice(1, -1).map((c) => c.replace(//g, '|').trim());
    if (idPattern.test(cells[0] ?? '')) rows.push(cells);
  }
  return rows;
}

const unquote = (s: string): string => s.replace(/^`|`$/g, '');
/** `src/a.ts:12` -> file, line. */
function splitLocation(loc: string): { file: string; line?: number } {
  const m = /^(.*):(\d+)$/.exec(loc);
  return m === null ? { file: loc } : { file: m[1] ?? loc, line: Number(m[2]) };
}

/** The wild review sheet: `| id | repo | location | claim | verdict | note |` plus `### Wnn: …` excerpt sections. */
export function wildItems(sheetMd: string, keyJson?: { items: readonly { id: string; rule: string; repo: string }[] }): Loaded {
  const ID = /^W\d+$/;
  const ex = sheetExcerpts(sheetMd, ID);
  const ruleOf = new Map((keyJson?.items ?? []).map((i) => [i.id, i.rule]));
  const items: PanelItem[] = [];
  const key: PanelKeyRow[] = [];
  const excluded: Loaded['excluded'] = [];
  for (const c of tableRows(sheetMd, ID)) {
    const [id = '', repo = '', loc = '', claim = ''] = c;
    const { file } = splitLocation(unquote(loc));
    const e = ex.get(id) ?? null;
    if (e === null) { excluded.push({ sourceId: id, reason: 'no excerpt section' }); continue; }
    const it = mk(NEUTRAL_STYLE, NEUTRAL_STYLE_DEFINITION, file, claim, e);
    items.push(it);
    key.push({ key: it.key, origin: 'wild', sourceId: id, project: repo, rule: ruleOf.get(id) ?? '' });
  }
  return { items, key, excluded };
}

/** A union sheet (`| ID | Case | Style | Location | Claim | [Answer] | Note |`) and its key (`rows`). */
export function unionItems(sheetMd: string, keyRows: readonly UnionKeyRow[], styleDoc: string): Loaded {
  const ID = /^U\d{3}$/;
  const ex = sheetExcerpts(sheetMd, ID);
  const rowOf = new Map(keyRows.map((r) => [r.itemId, r]));
  const items: PanelItem[] = [];
  const key: PanelKeyRow[] = [];
  const excluded: Loaded['excluded'] = [];
  for (const c of tableRows(sheetMd, ID)) {
    const [id = '', , style = '', loc = '', claim = ''] = c;
    const r = rowOf.get(id);
    const e = ex.get(id) ?? null;
    if (r === undefined) { excluded.push({ sourceId: id, reason: 'not in the key' }); continue; }
    if (e === null || e.trim() === '(file not readable)') { excluded.push({ sourceId: id, reason: 'no excerpt' }); continue; }
    const it = mk(style, styleDefinition(styleDoc, style), splitLocation(unquote(loc)).file, claim, e);
    items.push(it);
    key.push({
      key: it.key, origin: r.source === 'decoy' ? 'decoy' : 'union', sourceId: id, project: r.projectId, rule: r.ruleId,
      ...(r.source === 'decoy' ? { truth: 'no' as const, decoyKind: `union-${r.decoy?.kind ?? 'decoy'}` } : {}),
    });
  }
  return { items, key, excluded };
}

// ── External labelling sheet (CSV) ───────────────────────────────────────────

/** RFC 4180 rows (quoted fields, doubled quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') q = false; else field += ch;
      continue;
    }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

const RULE_ID = /\bFF-[A-Z]+\d+\b/g;

/**
 * The external set's labelling sheet. `root/<project>/<file>` must be the evaluated checkout (the tool's file paths
 * are relative to it). The claim is the tool's message without rule ids; the line is appended as on the union sheet.
 */
export function externalItems(csv: string, root: string, styleDoc: string): Loaded {
  const [header = [], ...rows] = parseCsv(csv);
  const ix = (n: string): number => header.indexOf(n);
  const get = (r: readonly string[], n: string): string => (ix(n) >= 0 ? r[ix(n)] ?? '' : '');
  const items: PanelItem[] = [];
  const key: PanelKeyRow[] = [];
  const excluded: Loaded['excluded'] = [];
  for (const r of rows) {
    const id = `ext-${get(r, 'row')}`;
    const project = get(r, 'project');
    const file = get(r, 'file');
    const lineText = get(r, 'line');
    const line = lineText === '' ? undefined : Number(lineText);
    const style = get(r, 'style');
    const message = get(r, 'message').replace(RULE_ID, '').replace(/\s{2,}/g, ' ').trim();
    let src: string | null = null;
    try {
      const base = fs.realpathSync(path.join(root, project));
      const real = fs.realpathSync(path.join(base, file));
      if (real.startsWith(base + path.sep)) src = fs.readFileSync(real, 'utf8');
    } catch { src = null; }
    if (src === null) { excluded.push({ sourceId: id, reason: `source not readable: ${project}/${file}` }); continue; }
    const claim = renderedClaim({ claim: message, ...(line !== undefined && Number.isFinite(line) ? { line } : {}) });
    const it = mk(style, styleDefinition(styleDoc, style), file, claim, excerpt(src, Number.isFinite(line) ? line : undefined));
    items.push(it);
    key.push({ key: it.key, origin: 'external', sourceId: id, project, rule: get(r, 'ruleId') });
  }
  return { items, key, excluded };
}

// ── Reference decoys ─────────────────────────────────────────────────────────

export interface DecoyOptions {
  readonly seed: number;
  /** Known-correct decoys wanted (expected `yes`). */
  readonly correct: number;
  /** Known-wrong decoys wanted (expected `no`). */
  readonly wrong: number;
  /** Directory for materialised variants (temporary). */
  readonly materialiseRoot: string;
  /** Project ids (`<style>/<variant>`) the target items already use: never a decoy source. */
  readonly excludeProjects?: ReadonlySet<string>;
}

function listFiles(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel === '' ? e.name : `${rel}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...listFiles(dir, r)); } else if (r.endsWith('.ts')) out.push(r);
  }
  return out;
}

/**
 * Known-correct and known-wrong findings from the reference manifests. Each case (variant) is materialised and passed
 * to the union builder with no tool rows: its manifest-only items on violation variants are known-correct, its decoys
 * known-wrong (falsity is checked on the materialised source by the builder). Claims with an unassigned layer are
 * dropped (the wording would be odd). The draw is seeded and balanced to the counts asked for.
 */
export function referenceDecoys(refs: readonly LoadedReference[], styleDoc: string, o: DecoyOptions): Loaded & { readonly shortfall: { correct: number; wrong: number } } {
  const pos: { u: UnionItem; ex: string }[] = [];
  const neg: { u: UnionItem; ex: string }[] = [];
  for (const ref of refs) {
    const layer = new Map(ref.graph.files.map((f) => [f.path, f.layer]));
    for (const v of ref.variants) {
      const pid = `${ref.style}/${v.manifest.variant}`;
      if (o.excludeProjects?.has(pid) === true) continue;
      const m = materialiseVariant(ref, v, o.materialiseRoot);
      const sources = new Map(listFiles(m.projectDir).map((f) => [f, fs.readFileSync(path.join(m.projectDir, f), 'utf8')]));
      const { items } = buildCaseItems(
        { ref, variant: v.manifest.variant, tool: [], sources, layerOf: (f) => layer.get(f) ?? null },
        { seed: o.seed, decoysPerCase: 2, tiers: 'blocking' },
      );
      for (const u of items) {
        if (/unassigned/.test(u.claim)) continue;
        const src = sources.get(u.file);
        if (src === undefined) continue;
        const entry = { u, ex: excerpt(src, u.line) };
        if (u.source === 'decoy') neg.push(entry);
        else if (u.source === 'manifest-only' && v.manifest.kind === 'violation') pos.push(entry);
      }
    }
  }
  const draw = (pool: typeof pos, n: number, tag: string): typeof pos =>
    shuffle([...pool].sort((a, b) => (a.u.key < b.u.key ? -1 : 1)), createRng(derivedSeed(o.seed, 'panel-decoys', tag))).slice(0, n);
  const items: PanelItem[] = [];
  const key: PanelKeyRow[] = [];
  for (const [entries, truth] of [[draw(pos, o.correct, 'correct'), 'yes'], [draw(neg, o.wrong, 'wrong'), 'no']] as const) {
    for (const { u, ex } of entries) {
      const it = mk(u.style, styleDefinition(styleDoc, u.style), u.file, renderedClaim(u), ex);
      items.push(it);
      key.push({
        key: it.key, origin: 'decoy', sourceId: u.key, project: u.projectId, rule: u.ruleId, truth,
        decoyKind: truth === 'yes' ? 'manifest-finding' : (u.decoy?.kind ?? 'decoy'),
      });
    }
  }
  const nc = key.filter((k) => k.truth === 'yes').length;
  const nw = key.filter((k) => k.truth === 'no').length;
  return { items, key, excluded: [], shortfall: { correct: o.correct - nc, wrong: o.wrong - nw } };
}

// ── The panel set ────────────────────────────────────────────────────────────

export interface PanelSet {
  readonly schemaVersion: 1;
  readonly seed: number;
  /** Opaque ids (P001…) in a seeded order mixing targets and decoys. */
  readonly items: readonly (PanelItem & { readonly id: string })[];
}

export interface PanelKeyFile {
  readonly schemaVersion: 1;
  readonly seed: number;
  readonly rows: readonly (PanelKeyRow & { readonly id: string })[];
  readonly excluded: Loaded['excluded'];
}

/** Merges loads, drops duplicates (same content key) and unrenderable items, shuffles, numbers. */
export function assemble(loads: readonly Loaded[], seed: number): { set: PanelSet; key: PanelKeyFile } {
  const seen = new Set<string>();
  const pairs: { it: PanelItem; k: PanelKeyRow }[] = [];
  const excluded: Loaded['excluded'][number][] = [];
  for (const l of loads) {
    excluded.push(...l.excluded);
    l.items.forEach((it, i) => {
      const k = l.key[i];
      if (k === undefined) return;
      if (it.excerpt === null) { excluded.push({ sourceId: k.sourceId, reason: 'no excerpt' }); return; }
      if (seen.has(it.key)) { excluded.push({ sourceId: k.sourceId, reason: 'duplicate of an earlier item' }); return; }
      seen.add(it.key);
      pairs.push({ it, k });
    });
  }
  const order = shuffle([...pairs].sort((a, b) => (a.it.key < b.it.key ? -1 : 1)), createRng(derivedSeed(seed, 'panel-order')));
  const id = (i: number): string => `P${String(i + 1).padStart(3, '0')}`;
  return {
    set: { schemaVersion: 1, seed, items: order.map((p, i) => ({ id: id(i), ...p.it })) },
    key: { schemaVersion: 1, seed, rows: order.map((p, i) => ({ id: id(i), ...p.k })), excluded },
  };
}
