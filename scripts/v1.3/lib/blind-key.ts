/**
 * The blind-expanded key and its matching, moved unchanged from `scripts/v1.3/blind-misses-rescore.ts` (U6 plan
 * Step 3) so that tests can import them. DEVELOPMENT-SET helpers; matching as `ue-score.ts`: one-to-one, exact
 * targets first, cycles keyed on their sorted file set.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readRaw } from './construct-rescore.js';
import type { LoadedReference } from './reference-model.js';
import { must } from './must.js';

export interface F { readonly ruleId: string; readonly file: string; readonly target?: string }
export interface Counts { tp: number; fn: number; fp: number }

// ── Matching, as ue-score.ts ─────────────────────────────────────────────────

export function canon(f: F): F {
  if (f.ruleId !== 'FF-S02') return { ruleId: f.ruleId, file: f.file, ...(f.target !== undefined && f.target !== '' ? { target: f.target } : {}) };
  const files = [...new Set([...f.file.split(','), ...(f.target !== undefined && f.target !== '' ? f.target.split(',') : [])].map((s) => s.trim()).filter((s) => s !== ''))].sort();
  const rest = files.slice(1).join(',');
  return { ruleId: f.ruleId, file: files[0] ?? f.file, ...(rest !== '' ? { target: rest } : {}) };
}
export const fkey = (f: F): string => `${f.ruleId}|${f.file}|${f.target ?? ''}`;

export function match(expected: readonly F[], actual: readonly F[]): { pairs: [number, number][]; fnIdx: number[]; fpIdx: number[] } {
  const used = new Array<boolean>(actual.length).fill(false);
  const m = new Array<number>(expected.length).fill(-1);
  for (const exactOnly of [true, false]) {
    expected.forEach((e, ei) => {
      if (m[ei] !== -1) return;
      const ai = actual.findIndex((a, i) => {
        if (used[i] || a.ruleId !== e.ruleId || a.file !== e.file) return false;
        const et = e.target ?? '';
        const at = a.target ?? '';
        if (et !== '' && at !== '') return et === at;
        return !exactOnly;
      });
      if (ai >= 0) { used[ai] = true; m[ei] = ai; }
    });
  }
  return {
    pairs: m.flatMap((ai, ei) => (ai >= 0 ? [[ei, ai] as [number, number]] : [])),
    fnIdx: m.flatMap((ai, ei) => (ai < 0 ? [ei] : [])),
    fpIdx: actual.flatMap((_, i) => (used[i] ? [] : [i])),
  };
}

// ── The adjudication sheet ───────────────────────────────────────────────────

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  const h = must(head, 'csv header');
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

// ── Blind key ────────────────────────────────────────────────────────────────

export type BlindKey = Map<string, F[]>; // style/variant -> scored blind-expanded rows (canonical)

export function rebuildBlindKey(base: string, refs: readonly LoadedReference[]): BlindKey {
  const sheet = parseCsv(fs.readFileSync(path.join(base, 'adjudication.csv'), 'utf8'));
  const key: BlindKey = new Map();
  for (const ref of refs) {
    const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
    for (const v of ref.variants) {
      const variant = v.manifest.variant;
      const mine = sheet.filter((r) => r.style === ref.style && r.variant === variant);
      const sheetRow = (r: Record<string, string>): F => canon({ ruleId: must(r.rule, 'rule'), file: must(r.file, 'file'), ...(r.target ? { target: r.target } : {}) });
      const blindOnlyAbsent = new Set(mine.filter((r) => r.tool === 'finding' && r.blind === 'none').map((r) => fkey(sheetRow(r))));
      const listed = mine.filter((r) => r.blind === 'finding' && r.scope === 'scored').map(sheetRow);
      const listedKeys = new Set(listed.map(fkey));
      const agreed = readRaw(path.join(base, 'raw'), ref.style, variant).filter((a) => scope.has(a.ruleId)).map(canon)
        .filter((a) => !blindOnlyAbsent.has(fkey(a)) && !listedKeys.has(fkey(a)));
      const seen = new Set<string>();
      key.set(`${ref.style}/${variant}`, [...listed, ...agreed].filter((f) => { const k = fkey(f); if (seen.has(k)) return false; seen.add(k); return true; }));
    }
  }
  return key;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface StyleBlind { blocking: Counts; all: Counts; fn: string[]; fp: string[] }

export function scoreBlind(
  ref: LoadedReference, key: BlindKey, actualOf: (variant: string) => readonly F[],
  scope: ReadonlySet<string>, blocking: ReadonlySet<string>, keyRename: (variant: string, f: F) => F, keyDrop: (variant: string, f: F) => boolean,
): StyleBlind {
  const out: StyleBlind = { blocking: { tp: 0, fn: 0, fp: 0 }, all: { tp: 0, fn: 0, fp: 0 }, fn: [], fp: [] };
  for (const v of ref.variants) {
    const variant = v.manifest.variant;
    const expected = must(key.get(`${ref.style}/${variant}`), `blind key ${ref.style}/${variant}`)
      .filter((e) => !keyDrop(variant, e)).map((e) => keyRename(variant, e)).filter((e) => scope.has(e.ruleId));
    const actual = actualOf(variant).filter((a) => scope.has(a.ruleId)).map(canon);
    const { pairs, fnIdx, fpIdx } = match(expected, actual);
    const label = (f: F): string => `${variant} ${f.ruleId} ${f.file}${f.target !== undefined ? ` -> ${f.target}` : ''}`;
    for (const [ei] of pairs) { const e = must(expected[ei], 'e'); out.all.tp += 1; if (blocking.has(e.ruleId)) out.blocking.tp += 1; }
    for (const ei of fnIdx) { const e = must(expected[ei], 'e'); out.all.fn += 1; if (blocking.has(e.ruleId)) { out.blocking.fn += 1; out.fn.push(label(e)); } }
    for (const ai of fpIdx) { const a = must(actual[ai], 'a'); out.all.fp += 1; if (blocking.has(a.ruleId)) { out.blocking.fp += 1; out.fp.push(label(a)); } }
  }
  return out;
}
