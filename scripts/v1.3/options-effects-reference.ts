/**
 * v1.3 options effects on the 71 reference variants (Docs/DiagnosticRuns/v1.3-options-effects-2026-10-16.md).
 * Entry file: no exports. DEVELOPMENT-SET numbers, not a validity estimate. Offline: it scores the live
 * `--engine cypher-interp` runs that `ue-baseline-live.ts --advisory-filter <set>` wrote under <runs>/<set>/.
 *
 * Keys:
 * - author: the author manifests, cycle-normalised (FF-S02 keyed on its sorted file set), as `ue-score.ts`'s
 *   `author-cycle-normalised` view;
 * - blind: the blind-expanded key, rebuilt from the committed after-member-facts run exactly as
 *   `blind-misses-rescore.ts` does (adjudication sheet rows with blind = finding and scope = scored, plus the agreed
 *   tool rows). The blind manifests themselves are sealed outside the repository and are not read.
 * Both keys are checked against the committed `scores.json` before anything is scored; the script refuses to go on
 * if either differs. No construct switch is applied (src/construct-switches is not imported): every figure is the
 * status quo construct reading, so the FF-P06 FLOWS_TO rows stay in both keys as committed.
 *
 * Usage (repository root):
 *   node --import tsx scripts/v1.3/options-effects-reference.ts --runs results/v1.3-options-effects/reference \
 *       [--base results/v1.3-reference/after-member-facts] [--json <file>] [--md <file>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadAllReferences } from './lib/reference-model.js';
import type { LoadedReference } from './lib/reference-model.js';
import { OPTION_SETS } from './lib/options-effects.js';
import { must } from './lib/must.js';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

interface F { readonly ruleId: string; readonly file: string; readonly target?: string }
interface Counts { tp: number; fn: number; fp: number }

function wilson(k: number, n: number): [number, number] | null {
  if (n === 0) return null;
  const z = 1.959964;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}

// ── Matching, as ue-score.ts ─────────────────────────────────────────────────

function canon(f: F): F {
  if (f.ruleId !== 'FF-S02') return { ruleId: f.ruleId, file: f.file, ...(f.target !== undefined && f.target !== '' ? { target: f.target } : {}) };
  const files = [...new Set([...f.file.split(','), ...(f.target !== undefined && f.target !== '' ? f.target.split(',') : [])].map((s) => s.trim()).filter((s) => s !== ''))].sort();
  const rest = files.slice(1).join(',');
  return { ruleId: f.ruleId, file: files[0] ?? f.file, ...(rest !== '' ? { target: rest } : {}) };
}
const fkey = (f: F): string => `${f.ruleId}|${f.file}|${f.target ?? ''}`;

function match(expected: readonly F[], actual: readonly F[]): { tp: number; fnIdx: number[]; fpIdx: number[] } {
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
  return { tp: m.filter((x) => x >= 0).length, fnIdx: m.flatMap((ai, ei) => (ai < 0 ? [ei] : [])), fpIdx: actual.flatMap((_, i) => (used[i] ? [] : [i])) };
}

function readRaw(rawDir: string, style: string, variant: string): F[] {
  const j = JSON.parse(fs.readFileSync(path.join(rawDir, style, `${variant}.json`), 'utf8')) as { findings: F[] };
  return j.findings.map((f) => ({ ruleId: f.ruleId, file: f.file, ...(f.target !== undefined ? { target: f.target } : {}) }));
}

function parseCsv(text: string): Record<string, string>[] {
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

/** As blind-misses-rescore.ts `rebuildBlindKey`. */
function rebuildBlindKey(base: string, refs: readonly LoadedReference[]): Map<string, F[]> {
  const sheet = parseCsv(fs.readFileSync(path.join(base, 'adjudication.csv'), 'utf8'));
  const key = new Map<string, F[]>();
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

interface StyleScore { blocking: Counts; all: Counts; advisory: Counts; fn: string[]; fp: string[] }

function score(ref: LoadedReference, expectedOf: (variant: string) => F[], actualOf: (variant: string) => F[]): StyleScore {
  const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
  const blocking = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId));
  const out: StyleScore = { blocking: { tp: 0, fn: 0, fp: 0 }, all: { tp: 0, fn: 0, fp: 0 }, advisory: { tp: 0, fn: 0, fp: 0 }, fn: [], fp: [] };
  for (const v of ref.variants) {
    const variant = v.manifest.variant;
    const expected = expectedOf(variant).filter((e) => scope.has(e.ruleId));
    const actual = actualOf(variant).filter((a) => scope.has(a.ruleId)).map(canon);
    const { fnIdx, fpIdx } = match(expected, actual);
    const fnSet = new Set(fnIdx);
    const label = (f: F): string => `${variant} ${f.ruleId} ${f.file}${f.target !== undefined ? ` -> ${f.target}` : ''}`;
    expected.forEach((e, ei) => {
      const tier = blocking.has(e.ruleId) ? out.blocking : out.advisory;
      if (fnSet.has(ei)) { tier.fn += 1; out.all.fn += 1; if (blocking.has(e.ruleId)) out.fn.push(label(e)); } else { tier.tp += 1; out.all.tp += 1; }
    });
    for (const ai of fpIdx) {
      const a = must(actual[ai], 'a');
      (blocking.has(a.ruleId) ? out.blocking : out.advisory).fp += 1;
      out.all.fp += 1;
      if (blocking.has(a.ruleId)) out.fp.push(label(a));
    }
  }
  return out;
}

const STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'] as const;
const addC = (a: Counts, b: Counts): Counts => ({ tp: a.tp + b.tp, fn: a.fn + b.fn, fp: a.fp + b.fp });
const fmt = (x: number | null): string => (x === null ? '-' : x.toFixed(2));
const ci = (k: number, n: number): string => { const w = wilson(k, n); return w === null ? '-' : `[${fmt(w[0])}, ${fmt(w[1])}]`; };
const rp = (c: Counts): string => `${String(c.tp)}/${String(c.tp + c.fn)} ${ci(c.tp, c.tp + c.fn)}; ${String(c.tp)}/${String(c.tp + c.fp)} ${ci(c.tp, c.tp + c.fp)}`;
const short = (c: Counts): string => `${String(c.tp)}/${String(c.tp + c.fn)}, ${String(c.tp)}/${String(c.tp + c.fp)}`;

function main(): void {
  const repoRoot = process.cwd();
  const base = path.resolve(opt('--base') ?? 'results/v1.3-reference/after-member-facts');
  const runs = path.resolve(opt('--runs') ?? 'results/v1.3-options-effects/reference');
  const refs = loadAllReferences(repoRoot);
  const blindKey = rebuildBlindKey(base, refs);
  const authorOf = (ref: LoadedReference) => (variant: string): F[] =>
    must(ref.variants.find((x) => x.manifest.variant === variant), variant).manifest.expectedFindings
      .map((e) => canon({ ruleId: e.ruleId, file: e.file, ...(e.target !== undefined ? { target: e.target } : {}) }));
  const blindOf = (ref: LoadedReference) => (variant: string): F[] => must(blindKey.get(`${ref.style}/${variant}`), `${ref.style}/${variant}`);

  // Checks: both keys reproduce the committed scores.json on the committed raw rows.
  const committed = JSON.parse(fs.readFileSync(path.join(base, 'scores.json'), 'utf8')) as { views: { style: string; view: string; blocking: Counts; all: Counts }[] };
  for (const ref of refs) {
    for (const [view, exp] of [['author-cycle-normalised', authorOf(ref)], ['blind-expanded', blindOf(ref)]] as const) {
      const s = score(ref, exp, (variant) => readRaw(path.join(base, 'raw'), ref.style, variant));
      const c = must(committed.views.find((x) => x.style === ref.style && x.view === view), `${ref.style} ${view}`);
      for (const k of ['blocking', 'all'] as const) {
        if (s[k].tp !== c[k].tp || s[k].fn !== c[k].fn || s[k].fp !== c[k].fp) throw new Error(`${ref.style} ${view} ${k}: ${short(s[k])} vs scores.json ${short(c[k])}`);
      }
    }
  }

  const json: Record<string, unknown> = { base: path.relative(repoRoot, base), checks: 'author-cycle-normalised and blind-expanded keys reproduce scores.json (blocking and all rules, 5 styles)', sets: {} };
  const md: string[] = [];
  const noneRaw = path.join(runs, 'none', 'raw');
  for (const set of OPTION_SETS) {
    const rawDir = path.join(runs, set.name, 'raw');
    if (!fs.existsSync(rawDir)) { md.push(`### ${set.name}\n\n(not run)\n`); continue; }
    const pooled = { author: { blocking: { tp: 0, fn: 0, fp: 0 }, all: { tp: 0, fn: 0, fp: 0 }, advisory: { tp: 0, fn: 0, fp: 0 } }, blind: { blocking: { tp: 0, fn: 0, fp: 0 }, all: { tp: 0, fn: 0, fp: 0 }, advisory: { tp: 0, fn: 0, fp: 0 } } };
    const perStyle: Record<string, unknown> = {};
    let rows = 0;
    let blockingRowsChanged = 0;
    let suppressed = 0;
    const lines: string[] = [];
    for (const style of STYLES) {
      const ref = must(refs.find((r) => r.style === style), style);
      const blocking = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId));
      const actualOf = (variant: string): F[] => readRaw(rawDir, style, variant);
      for (const v of ref.variants) {
        const act = actualOf(v.manifest.variant);
        rows += act.length;
        const b = (fs: F[]): string => JSON.stringify(fs.filter((f) => blocking.has(f.ruleId)).map(fkey).sort());
        if (b(act) !== b(readRaw(noneRaw, style, v.manifest.variant))) blockingRowsChanged += 1;
        const evFile = path.join(runs, set.name, 'evidence', style, `${v.manifest.variant}.json`);
        const ev = JSON.parse(fs.readFileSync(evFile, 'utf8')) as { advisoryFilter?: { suppressed?: unknown[] } };
        suppressed += ev.advisoryFilter?.suppressed?.length ?? 0;
      }
      const a = score(ref, authorOf(ref), actualOf);
      const bl = score(ref, blindOf(ref), actualOf);
      for (const k of ['blocking', 'all', 'advisory'] as const) { pooled.author[k] = addC(pooled.author[k], a[k]); pooled.blind[k] = addC(pooled.blind[k], bl[k]); }
      perStyle[style] = { author: { blocking: a.blocking, advisory: a.advisory, all: a.all }, blind: { blocking: bl.blocking, advisory: bl.advisory, all: bl.all }, blindBlockingMisses: bl.fn, blindBlockingFalseAlarms: bl.fp };
      lines.push(`| ${style} | ${rp(a.blocking)} | ${rp(bl.blocking)} | ${short(a.all)} | ${short(bl.all)} |`);
    }
    lines.push(`| **pooled** | **${rp(pooled.author.blocking)}** | **${rp(pooled.blind.blocking)}** | ${short(pooled.author.all)} | ${short(pooled.blind.all)} |`);
    (json.sets as Record<string, unknown>)[set.name] = { filter: set.filter, toolRows: rows, suppressedRows: suppressed, variantsWithChangedBlockingRows: blockingRowsChanged, pooled, perStyle };
    md.push(`### ${set.name} (\`--advisory-filter ${set.filter}\`)\n`);
    md.push(`Tool rows ${String(rows)}, suppressed ${String(suppressed)}, variants whose blocking rows differ from \`none\`: ${String(blockingRowsChanged)}/71.\n`);
    md.push('| Style | Author blocking R; P | Blind blocking R; P | Author all rules R, P | Blind all rules R, P |');
    md.push('|---|---|---|---|---|');
    md.push(...lines, '');
  }
  const jsonOut = opt('--json');
  if (jsonOut !== undefined) { fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true }); fs.writeFileSync(path.resolve(jsonOut), JSON.stringify(json, null, 1) + '\n'); }
  const mdOut = opt('--md');
  const text = `Checks: ${String(json.checks)}.\n\n${md.join('\n')}\n`;
  if (mdOut !== undefined) fs.writeFileSync(path.resolve(mdOut), text);
  process.stdout.write(text);
}

main();
