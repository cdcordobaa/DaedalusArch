/**
 * Blind-view re-score of the reference set under construct switches and extractor options (offline, no Neo4j).
 * Entry file: no exports. DEVELOPMENT-SET numbers, not a validity estimate.
 *
 * The blind manifests are sealed outside the repository (`ue-score.ts --blind`). This script rebuilds the
 * blind-expanded expected list of every variant from what `ue-score.ts` committed for the run:
 * - every row of `<base>/adjudication.csv` with `blind = finding` and `scope = scored` (the rows any source disagrees on);
 * - every scoped tool row of `<base>/raw` that the sheet does not list as `tool = finding, blind = none` (rows all
 *   three sources agree on are not written to the sheet; tool rows the blind manifest lacks are).
 * It first checks that the rebuilt key reproduces the committed `scores.json` blind-expanded counts (blocking and all
 * rules, every style), and refuses to go on otherwise.
 *
 * Then, for each answer set (`--sets`), it runs `rescore()` (`lib/construct-rescore.ts`) and scores the resulting tool
 * rows against the author manifests (the rescore's own metrics) and against the rebuilt blind key (matching as
 * `ue-score.ts`: one-to-one, exact targets first, cycles keyed on their file set). Every set includes Q8 B, the
 * FF-P06 FLOWS_TO N/A correction of 2026-10-16 (the matching blind rows leave the key too). Under Q5 C or D the blind
 * key is renamed as the author key is: adapter -> adapter FF-S03 rows to the new id; under D also the blind FF-S01
 * adapter -> adapter rows (the blind reader's id for adapter isolation) to FF-S05.
 *
 * Usage (repository root):
 *   node --import tsx scripts/v1.3/blind-misses-rescore.ts --base results/v1.3-reference/after-member-facts
 *       [--graph-cache <file>] [--json <file>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { STATUS_QUO_ANSWERS, withAnswers } from '../../src/shared/construct-switches.js';
import type { ConstructAnswers } from '../../src/shared/construct-switches.js';
import type { ConstructOption, ConstructQuestionId } from '../../src/shared/construct-switch-catalogue.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import { layerViewOf } from '../../src/construct-switches/layer-view.js';
import { ADAPTER_ISOLATION_ID } from '../../src/construct-switches/overlays.js';
import { cachedGraphs, extractingGraphs, readRaw, rescore } from './lib/construct-rescore.js';
import type { GraphProvider } from './lib/construct-rescore.js';
import { loadAllReferences } from './lib/reference-model.js';
import type { LoadedReference } from './lib/reference-model.js';
import { must } from './lib/must.js';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

interface F { readonly ruleId: string; readonly file: string; readonly target?: string }
interface Counts { tp: number; fn: number; fp: number }

// ── Matching, as ue-score.ts ─────────────────────────────────────────────────

function canon(f: F): F {
  if (f.ruleId !== 'FF-S02') return { ruleId: f.ruleId, file: f.file, ...(f.target !== undefined && f.target !== '' ? { target: f.target } : {}) };
  const files = [...new Set([...f.file.split(','), ...(f.target !== undefined && f.target !== '' ? f.target.split(',') : [])].map((s) => s.trim()).filter((s) => s !== ''))].sort();
  const rest = files.slice(1).join(',');
  return { ruleId: f.ruleId, file: files[0] ?? f.file, ...(rest !== '' ? { target: rest } : {}) };
}
const fkey = (f: F): string => `${f.ruleId}|${f.file}|${f.target ?? ''}`;

function match(expected: readonly F[], actual: readonly F[]): { pairs: [number, number][]; fnIdx: number[]; fpIdx: number[] } {
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

// ── Blind key ────────────────────────────────────────────────────────────────

type BlindKey = Map<string, F[]>; // style/variant -> scored blind-expanded rows (canonical)

function rebuildBlindKey(base: string, refs: readonly LoadedReference[]): BlindKey {
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

interface StyleBlind { blocking: Counts; all: Counts; fn: string[]; fp: string[] }

function scoreBlind(
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

const STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'] as const;
const cell = (c: Counts): string => `R ${String(c.tp)}/${String(c.tp + c.fn)}, P ${String(c.tp)}/${String(c.tp + c.fp)}`;
const addC = (a: Counts, b: Counts): Counts => ({ tp: a.tp + b.tp, fn: a.fn + b.fn, fp: a.fp + b.fp });

type Changes = Readonly<Partial<Record<ConstructQuestionId, ConstructOption>>>;
const SETS: readonly { readonly name: string; readonly changes: Changes }[] = [
  { name: 'status quo (Q8 A, as committed)', changes: {} },
  { name: 'corrected baseline (Q8 B)', changes: { Q8: 'B' } },
  { name: 'Q4 B', changes: { Q8: 'B', Q4: 'B' } },
  { name: 'Q5 B', changes: { Q8: 'B', Q5: 'B' } },
  { name: 'Q5 C', changes: { Q8: 'B', Q5: 'C' } },
  { name: 'Q5 D', changes: { Q8: 'B', Q5: 'D' } },
  { name: 'Q6 B', changes: { Q8: 'B', Q6: 'B' } },
  { name: 'Q7 B', changes: { Q8: 'B', Q7: 'B' } },
  { name: 'Q10 B', changes: { Q8: 'B', Q10: 'B' } },
  { name: 'Q10 C', changes: { Q8: 'B', Q10: 'C' } },
  { name: 'Q10 D', changes: { Q8: 'B', Q10: 'D' } },
  { name: 'Q12 B', changes: { Q8: 'B', Q12: 'B' } },
  { name: 'Q13 C + Q25 B', changes: { Q8: 'B', Q13: 'C', Q25: 'B' } },
  { name: 'Q20 B', changes: { Q8: 'B', Q20: 'B' } },
  { name: 'Q10 C + Q12 B', changes: { Q8: 'B', Q10: 'C', Q12: 'B' } },
  { name: 'Q5 C + Q6 B + Q10 C + Q12 B', changes: { Q8: 'B', Q5: 'C', Q6: 'B', Q10: 'C', Q12: 'B' } },
  { name: 'blind reading (Q4 B, Q5 C, Q6 B, Q7 B, Q10 C, Q12 B, Q13 C, Q20 B, Q25 B)', changes: { Q8: 'B', Q4: 'B', Q5: 'C', Q6: 'B', Q7: 'B', Q10: 'C', Q12: 'B', Q13: 'C', Q20: 'B', Q25: 'B' } },
];

async function main(): Promise<void> {
  const base = path.resolve(opt('--base') ?? 'results/v1.3-reference/after-member-facts');
  const refs = loadAllReferences(process.cwd());
  const key = rebuildBlindKey(base, refs);

  // Check: the rebuilt key reproduces the committed blind-expanded counts.
  const committed = JSON.parse(fs.readFileSync(path.join(base, 'scores.json'), 'utf8')) as { views: { style: string; view: string; blocking: Counts; all: Counts }[] };
  for (const ref of refs) {
    const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
    const blocking = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId));
    const s = scoreBlind(ref, key, (variant) => readRaw(path.join(base, 'raw'), ref.style, variant), scope, blocking, (_v, f) => f, () => false);
    const c = must(committed.views.find((x) => x.style === ref.style && x.view === 'blind-expanded'), `${ref.style} blind-expanded`);
    for (const k of ['blocking', 'all'] as const) {
      if (s[k].tp !== c[k].tp || s[k].fn !== c[k].fn || s[k].fp !== c[k].fp) {
        throw new Error(`${ref.style} ${k}: rebuilt blind key gives ${cell(s[k])}, scores.json has ${cell(c[k])}`);
      }
    }
  }
  console.log('Rebuilt blind-expanded key reproduces scores.json (blocking and all rules, 5 styles).\n');

  const cacheFile = opt('--graph-cache');
  const extracting = extractingGraphs();
  const graphs: GraphProvider = cacheFile !== undefined ? cachedGraphs(path.resolve(cacheFile), extracting) : extracting;
  const layerOf = new Map<string, ReadonlyMap<string, string | null>>();
  const tracked: GraphProvider = async (ref, variant) => {
    const g = await graphs(ref, variant);
    layerOf.set(`${ref.style}/${variant}`, g.files);
    return g;
  };
  const adapterLayers = new Map<string, readonly string[]>();
  for (const ref of refs) {
    const parsed = await parseSpec({ specFilePath: ref.specPath });
    if (!parsed.success) throw new Error(`${ref.style}: spec does not parse`);
    adapterLayers.set(ref.style, layerViewOf(parsed.data.layerModel).adapterLayers);
  }

  const json: Record<string, unknown> = {};
  try {
    for (const set of SETS) {
      const answers: ConstructAnswers = withAnswers(set.changes, STATUS_QUO_ANSWERS);
      const r = await rescore({ repoRoot: process.cwd(), base, answers, graphs: tracked, ...(Object.keys(set.changes).length === 0 ? {} : { forceGeneralPath: true }) });
      const rows: string[] = [];
      const pooledA = { blocking: { tp: 0, fn: 0, fp: 0 }, all: { tp: 0, fn: 0, fp: 0 } };
      const pooledB = { blocking: { tp: 0, fn: 0, fp: 0 }, all: { tp: 0, fn: 0, fp: 0 } };
      const perStyle: Record<string, unknown> = {};
      for (const style of STYLES) {
        const ref = must(refs.find((x) => x.style === style), style);
        const m = must(r.run.metrics.find((x) => x.style === style), `${style} metrics`);
        const scope = new Set(m.rules.map((x) => x.ruleId));
        const blocking = new Set(m.rules.filter((x) => x.blockingCandidate).map((x) => x.ruleId));
        const isAdapterPair = (variant: string, f: F): boolean => {
          const files = layerOf.get(`${style}/${variant}`);
          const s = files?.get(f.file) ?? null;
          const t = f.target !== undefined ? files?.get(f.target) ?? null : null;
          const al = adapterLayers.get(style) ?? [];
          return s !== null && t !== null && al.includes(s) && al.includes(t);
        };
        const q5 = set.changes.Q5;
        const hexOrDdd = style === 'hexagonal' || style === 'ddd';
        const rename = (variant: string, f: F): F => {
          if (!hexOrDdd || (q5 !== 'C' && q5 !== 'D')) return f;
          const to = q5 === 'C' ? 'FF-S01' : ADAPTER_ISOLATION_ID;
          if (f.ruleId === 'FF-S03' && isAdapterPair(variant, f)) return { ...f, ruleId: to };
          if (q5 === 'D' && f.ruleId === 'FF-S01' && isAdapterPair(variant, f)) return { ...f, ruleId: to };
          return f;
        };
        const naKeys = (variant: string): F[] => [...(r.extras.notApplicable[`${style}/${variant}`]?.tool ?? [])];
        const drop = (variant: string, f: F): boolean => f.ruleId === 'FF-P06' && naKeys(variant).some((n) => n.file === f.file && (f.target === undefined || n.target === f.target));
        const b = scoreBlind(ref, key, (variant) => r.extras.actual[`${style}/${variant}`] ?? [], scope, blocking, rename, drop);
        const a = { blocking: { tp: m.blocking.tp, fn: m.blocking.fn, fp: m.blocking.fp }, all: { tp: m.all.tp, fn: m.all.fn, fp: m.all.fp } };
        pooledA.blocking = addC(pooledA.blocking, a.blocking); pooledA.all = addC(pooledA.all, a.all);
        pooledB.blocking = addC(pooledB.blocking, b.blocking); pooledB.all = addC(pooledB.all, b.all);
        rows.push(`| ${style} | ${cell(a.blocking)} | ${cell(b.blocking)} | ${cell(a.all)} | ${cell(b.all)} |`);
        perStyle[style] = { author: a, blind: { blocking: b.blocking, all: b.all }, blindBlockingMisses: b.fn, blindBlockingFalseAlarms: b.fp };
      }
      rows.push(`| **pooled** | **${cell(pooledA.blocking)}** | **${cell(pooledB.blocking)}** | ${cell(pooledA.all)} | ${cell(pooledB.all)} |`);
      json[set.name] = { changes: set.changes, perStyle, pooled: { author: pooledA, blind: pooledB } };
      console.log(`### ${set.name}\n`);
      console.log('| Style | Author blocking | Blind (expanded) blocking | Author all rules | Blind all rules |');
      console.log('|---|---|---|---|---|');
      for (const l of rows) console.log(l);
      console.log('');
    }
  } finally {
    extracting.dispose();
  }
  const jsonOut = opt('--json');
  if (jsonOut !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
    fs.writeFileSync(path.resolve(jsonOut), JSON.stringify(json, null, 2) + '\n');
  }
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; });
