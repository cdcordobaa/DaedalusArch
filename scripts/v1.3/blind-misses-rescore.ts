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
 *       [--graph-cache <file>] [--json <file>] [--answers <json>] [--verdicts <csv>] [--as-run] [--key-base <dir>]
 *
 * U6 options (design §6.3; without them the output is byte-identical to before):
 * - `--verdicts <csv>`: an adjudicated view next to the author and blind views (`lib/adjudication-verdicts.ts`).
 * - `--answers <json>`: one more set, "answers file", read with `parseAnswersDocument` (Q8 B added if unset).
 * - `--as-run`: score a run whose raw/ already has the switch file's answers applied (no `rescore()` of the rows);
 *   the author view is the registered computation of those rows. `--key-base <dir>` is the run the blind key and its
 *   scores.json check come from (default `--base`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONSTRUCT_ANSWERS, STATUS_QUO_ANSWERS, withAnswers } from '../../src/shared/construct-switches.js';
import type { ConstructAnswers } from '../../src/shared/construct-switches.js';
import type { ConstructOption, ConstructQuestionId } from '../../src/shared/construct-switch-catalogue.js';
import { parseSpec } from '../../src/spec-parser/index.js';
import { layerViewOf } from '../../src/construct-switches/layer-view.js';
import { ADAPTER_ISOLATION_ID } from '../../src/construct-switches/overlays.js';
import { cachedGraphs, extractingGraphs, readRaw, rescore } from './lib/construct-rescore.js';
import type { GraphProvider } from './lib/construct-rescore.js';
import { loadAllReferences } from './lib/reference-model.js';
import { must } from './lib/must.js';
import { rebuildBlindKey, scoreBlind } from './lib/blind-key.js';
import type { Counts, F } from './lib/blind-key.js';
import { adjudicatedKey, checkVerdicts, readVerdicts } from './lib/adjudication-verdicts.js';
import { parseAnswersDocument } from './lib/construct-answers.js';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

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

interface SetResult {
  readonly name: string;
  readonly changes: Changes;
  readonly answers: ConstructAnswers;
  readonly r: Awaited<ReturnType<typeof rescore>>;
  /** Tool rows per style/variant; undefined means the rescore's own rows. */
  readonly actual?: (style: string, variant: string) => readonly F[];
  /** FF-P06 FLOWS_TO rows N/A under Q8 B, per style/variant (as-run only; otherwise the rescore's extras). */
  readonly notApplicable?: (style: string, variant: string) => readonly F[];
}

/** FF-P06 FLOWS_TO rows of a saved run's evidence (Q8 B: N/A), as raw rows. */
function flowsToRows(evidenceBase: string, style: string, variant: string): F[] {
  const file = path.join(evidenceBase, 'evidence', style, `${variant}.json`);
  if (!fs.existsSync(file)) return [];
  const v = (JSON.parse(fs.readFileSync(file, 'utf8')) as { violations?: { functionId: string; filePath: string; target?: string; discriminator?: string[] }[] }).violations ?? [];
  return v.filter((x) => String(x.functionId) === 'FF-P06' && x.discriminator?.[2] === 'FLOWS_TO')
    .map((x) => ({ ruleId: 'FF-P06', file: x.filePath, ...(x.target !== undefined && x.target !== '' ? { target: x.target } : {}) }));
}

async function main(): Promise<void> {
  const base = path.resolve(opt('--base') ?? 'results/v1.3-reference/after-member-facts');
  const asRun = argv.includes('--as-run');
  const keyBase = path.resolve(opt('--key-base') ?? base);
  const answersFile = opt('--answers');
  const verdictsFile = opt('--verdicts');
  const refs = loadAllReferences(process.cwd());
  const key = rebuildBlindKey(keyBase, refs);

  // Check: the rebuilt key reproduces the committed blind-expanded counts.
  const committed = JSON.parse(fs.readFileSync(path.join(keyBase, 'scores.json'), 'utf8')) as { views: { style: string; view: string; blocking: Counts; all: Counts }[] };
  for (const ref of refs) {
    const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
    const blocking = new Set(ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId));
    const s = scoreBlind(ref, key, (variant) => readRaw(path.join(keyBase, 'raw'), ref.style, variant), scope, blocking, (_v, f) => f, () => false);
    const c = must(committed.views.find((x) => x.style === ref.style && x.view === 'blind-expanded'), `${ref.style} blind-expanded`);
    for (const k of ['blocking', 'all'] as const) {
      if (s[k].tp !== c[k].tp || s[k].fn !== c[k].fn || s[k].fp !== c[k].fp) {
        throw new Error(`${ref.style} ${k}: rebuilt blind key gives ${cell(s[k])}, scores.json has ${cell(c[k])}`);
      }
    }
  }
  console.log('Rebuilt blind-expanded key reproduces scores.json (blocking and all rules, 5 styles).\n');

  const verdicts = verdictsFile !== undefined ? readVerdicts(path.resolve(verdictsFile)) : undefined;
  if (verdictsFile !== undefined && verdicts === undefined) console.log(`No verdicts file at ${verdictsFile}: no adjudicated view.\n`);

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

  // The sets to score: the fixed list, plus the answers file; under --as-run, the saved run only.
  async function* sets(): AsyncGenerator<SetResult> {
    if (asRun) {
      // The tool rows are the base's raw/ as written (the answers are already applied in the run); the author view is
      // what the registered scorer computes from them (sealed scope and tiers, G0.8 b). Renames follow the switch file.
      for (const ref of refs) for (const v of ref.variants) await tracked(ref, v.manifest.variant);
      const r = await rescore({ repoRoot: process.cwd(), base, answers: STATUS_QUO_ANSWERS });
      const changes: Changes = Object.fromEntries(Object.entries(CONSTRUCT_ANSWERS).filter(([, o]) => o !== 'A')) as Changes;
      yield {
        name: 'as run (switch file)', changes, answers: CONSTRUCT_ANSWERS, r,
        actual: (style, variant) => readRaw(path.join(base, 'raw'), style, variant),
        notApplicable: (style, variant) => (CONSTRUCT_ANSWERS.Q8 === 'B' ? flowsToRows(keyBase, style, variant) : []),
      };
      return;
    }
    const list: { name: string; changes: Changes }[] = [...SETS];
    if (answersFile !== undefined) {
      const parsed = parseAnswersDocument(JSON.parse(fs.readFileSync(path.resolve(answersFile), 'utf8')) as unknown);
      for (const w of parsed.warnings) console.error(`warning: ${w}`);
      const changes: Changes = { Q8: 'B', ...Object.fromEntries(Object.entries(parsed.answers).filter(([q, o]) => o !== 'A' || q === 'Q8')) };
      list.push({ name: 'answers file', changes });
    }
    for (const set of list) {
      const answers: ConstructAnswers = withAnswers(set.changes, STATUS_QUO_ANSWERS);
      const r = await rescore({ repoRoot: process.cwd(), base, answers, graphs: tracked, ...(Object.keys(set.changes).length === 0 ? {} : { forceGeneralPath: true }) });
      yield { name: set.name, changes: set.changes, answers, r };
    }
  }

  const json: Record<string, unknown> = {};
  try {
    for await (const set of sets()) {
      const { r, answers } = set;
      const check = verdicts !== undefined ? checkVerdicts(verdicts, key, answers) : undefined;
      const adjKey = check !== undefined ? adjudicatedKey(key, check) : undefined;
      const rows: string[] = [];
      const pooledA = { blocking: { tp: 0, fn: 0, fp: 0 }, all: { tp: 0, fn: 0, fp: 0 } };
      const pooledB = { blocking: { tp: 0, fn: 0, fp: 0 }, all: { tp: 0, fn: 0, fp: 0 } };
      const pooledJ = { blocking: { tp: 0, fn: 0, fp: 0 }, all: { tp: 0, fn: 0, fp: 0 } };
      const perStyle: Record<string, unknown> = {};
      const adjPerStyle: Record<string, unknown> = {};
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
        const naKeys = (variant: string): F[] => [...(set.notApplicable !== undefined ? set.notApplicable(style, variant) : r.extras.notApplicable[`${style}/${variant}`]?.tool ?? [])];
        const drop = (variant: string, f: F): boolean => f.ruleId === 'FF-P06' && naKeys(variant).some((n) => n.file === f.file && (f.target === undefined || n.target === f.target));
        const actualOf = (variant: string): readonly F[] => (set.actual !== undefined ? set.actual(style, variant) : r.extras.actual[`${style}/${variant}`] ?? []);
        const b = scoreBlind(ref, key, actualOf, scope, blocking, rename, drop);
        const a = { blocking: { tp: m.blocking.tp, fn: m.blocking.fn, fp: m.blocking.fp }, all: { tp: m.all.tp, fn: m.all.fn, fp: m.all.fp } };
        pooledA.blocking = addC(pooledA.blocking, a.blocking); pooledA.all = addC(pooledA.all, a.all);
        pooledB.blocking = addC(pooledB.blocking, b.blocking); pooledB.all = addC(pooledB.all, b.all);
        let adjCell = '';
        if (adjKey !== undefined) {
          const j = scoreBlind(ref, adjKey, actualOf, scope, blocking, rename, drop);
          pooledJ.blocking = addC(pooledJ.blocking, j.blocking); pooledJ.all = addC(pooledJ.all, j.all);
          adjCell = ` ${cell(j.blocking)} |`;
          adjPerStyle[style] = { recall: [j.blocking.tp, j.blocking.tp + j.blocking.fn], precision: [j.blocking.tp, j.blocking.tp + j.blocking.fp], blocking: j.blocking, all: j.all, blockingMisses: j.fn, blockingFalseAlarms: j.fp };
        }
        rows.push(`| ${style} | ${cell(a.blocking)} | ${cell(b.blocking)} | ${cell(a.all)} | ${cell(b.all)} |${adjCell}`);
        perStyle[style] = { author: a, blind: { blocking: b.blocking, all: b.all }, blindBlockingMisses: b.fn, blindBlockingFalseAlarms: b.fp };
      }
      rows.push(`| **pooled** | **${cell(pooledA.blocking)}** | **${cell(pooledB.blocking)}** | ${cell(pooledA.all)} | ${cell(pooledB.all)} |${adjKey !== undefined ? ` **${cell(pooledJ.blocking)}** |` : ''}`);
      json[set.name] = {
        changes: set.changes, perStyle, pooled: { author: pooledA, blind: pooledB },
        ...(check !== undefined && verdictsFile !== undefined ? {
          adjudicated: {
            verdictsFile: path.relative(process.cwd(), path.resolve(verdictsFile)), removed: check.removedLabels, kept: check.kept, inconsistencies: check.inconsistencies,
            perStyle: adjPerStyle, pooled: { recall: [pooledJ.blocking.tp, pooledJ.blocking.tp + pooledJ.blocking.fn], precision: [pooledJ.blocking.tp, pooledJ.blocking.tp + pooledJ.blocking.fp] },
          },
        } : {}),
      };
      console.log(`### ${set.name}\n`);
      console.log(`| Style | Author blocking | Blind (expanded) blocking | Author all rules | Blind all rules |${adjKey !== undefined ? ' Adjudicated blocking |' : ''}`);
      console.log(`|---|---|---|---|---|${adjKey !== undefined ? '---|' : ''}`);
      for (const l of rows) console.log(l);
      for (const x of check?.inconsistencies ?? []) console.log(`\n- BR-U6-C1: ${x}`);
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
