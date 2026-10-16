/**
 * v1.3 model panel: the statistics and the AUTHORITY RULE (Docs/v1.3/model-panel.md §5, fixed before any data).
 *
 * - Per rater: accuracy on the decoys (known-correct expect `yes`, known-wrong expect `no`; `uncertain` and an
 *   invalid run count as wrong), per decoy class, with Wilson intervals; the share of invalid and self-inconsistent
 *   (two runs disagree) items.
 * - Pairwise (every pair of raters, humans included when given): the meaningful labeller's `agreement` (3×3 table,
 *   Cohen's κ, Gwet's AC1, observed agreement with its Wilson interval) on the three-way and binary labels.
 * - All raters at once: Fleiss' κ (items every rater answered) and Krippendorff's α (nominal; missing labels allowed).
 * - Per item: the majority label with its confidence (share of raters that gave it), over all raters and over the
 *   qualified ones; whether the panel label is authoritative.
 *
 * The rule's constants are frozen here and quoted in the doc; changing one is a dated amendment, never a silent edit.
 */
import { fleissKappa, wilson } from '../../../lib/stats.js';
import { agreement } from '../labelling/audit.js';
import type { Agreement } from '../labelling/audit.js';
import type { PanelKeyFile } from './items.js';
import type { PanelLabels } from './run.js';

export const AUTHORITY_RULE = Object.freeze({
  id: 'panel-authority-v1',
  /** Decoys a run must hold (each class at least half of it) for any rater to qualify. */
  minDecoys: 20,
  minDecoysPerClass: 10,
  /** Overall decoy accuracy (point estimate) a rater needs. */
  minDecoyAccuracy: 0.85,
  /** Accuracy on each decoy class (known-correct, known-wrong) a rater needs: an always-`yes` rater cannot pass. */
  minClassAccuracy: 0.7,
  /** Share of items with a valid label (not `invalid-run`) a rater needs. */
  minValidShare: 0.9,
  /** Distinct vendors that must be qualified for the panel to label anything. */
  minQualifiedVendors: 2,
  /** Distinct qualified vendors that must give the same definite label for an item to be authoritative. */
  minAgreeingVendors: 2,
  /** Fleiss' κ (binary, qualified vendors, target items) below which panel labels are descriptive only. */
  minPanelKappa: 0.6,
});

export type Label = 'yes' | 'no' | 'uncertain';
const LABELS: readonly Label[] = ['yes', 'no', 'uncertain'];
const isLabel = (x: unknown): x is Label => typeof x === 'string' && (LABELS as readonly string[]).includes(x);

export interface Prop { readonly k: number; readonly n: number; readonly share: number | null; readonly low: number | null; readonly high: number | null }
const prop = (k: number, n: number): Prop => {
  if (n === 0) return { k, n, share: null, low: null, high: null };
  const ci = wilson(k, n);
  return { k, n, share: k / n, low: ci.low, high: ci.high };
};

// ── Multi-rater coefficients ────────────────────────────────────────────────

/**
 * Krippendorff's α, nominal metric. `units`: per unit, the values given by whichever raters answered (missing
 * values simply absent). Units with fewer than two values are not pairable and are dropped. Null when nothing is
 * pairable or when every value is the same category (expected disagreement 0).
 */
export function krippendorffAlphaNominal(units: readonly (readonly string[])[]): number | null {
  const pairable = units.filter((u) => u.length >= 2);
  if (pairable.length === 0) return null;
  const cats = [...new Set(pairable.flat())].sort();
  const ix = new Map(cats.map((c, i) => [c, i]));
  const o = cats.map(() => cats.map(() => 0));
  for (const u of pairable) {
    const m = u.length;
    for (let i = 0; i < m; i += 1) {
      for (let j = 0; j < m; j += 1) {
        if (i === j) continue;
        const a = ix.get(u[i] ?? '') ?? 0;
        const b = ix.get(u[j] ?? '') ?? 0;
        const row = o[a];
        if (row !== undefined) row[b] = (row[b] ?? 0) + 1 / (m - 1);
      }
    }
  }
  const nc = o.map((row) => row.reduce((s, v) => s + v, 0));
  const n = nc.reduce((s, v) => s + v, 0);
  let doSum = 0;
  let deSum = 0;
  for (let c = 0; c < cats.length; c += 1) {
    for (let k = 0; k < cats.length; k += 1) {
      if (c === k) continue;
      doSum += o[c]?.[k] ?? 0;
      deSum += (nc[c] ?? 0) * (nc[k] ?? 0);
    }
  }
  if (deSum === 0) return null;
  return 1 - ((n - 1) * doSum) / deSum;
}

/** Fleiss' κ over the items every listed rater answered; null when there are none or it is undefined. */
export function fleissOver(ids: readonly string[], raters: readonly string[], get: (r: string, id: string) => Label | undefined, binary: boolean): { kappa: number | null; items: number } {
  const cats: readonly string[] = binary ? ['yes', 'not-yes'] : LABELS;
  const full = ids.filter((id) => raters.every((r) => get(r, id) !== undefined));
  if (full.length === 0 || raters.length < 2) return { kappa: null, items: full.length };
  const counts = full.map((id) => cats.map((c) => raters.filter((r) => {
    const l = get(r, id);
    return (binary ? (l === 'yes' ? 'yes' : 'not-yes') : l) === c;
  }).length));
  const v = fleissKappa(counts);
  return { kappa: Number.isFinite(v) ? v : null, items: full.length };
}

// ── The report ──────────────────────────────────────────────────────────────

export interface RaterAccuracy {
  readonly rater: string;
  readonly vendor: string;
  readonly decoys: Prop;
  readonly knownCorrect: Prop;
  readonly knownWrong: Prop;
  /** Decoys answered `uncertain` (counted wrong above). */
  readonly decoyUncertain: number;
  readonly valid: Prop;
  readonly selfDisagree: Prop;
  readonly qualified: boolean;
  readonly reasons: readonly string[];
}

export interface PairRow { readonly a: string; readonly b: string; readonly scope: 'targets' | 'decoys'; readonly threeWay: Agreement; readonly binary: Agreement }

export interface ItemVerdict {
  readonly id: string;
  readonly origin: string;
  readonly sourceId: string;
  readonly truth?: string;
  readonly labels: Readonly<Record<string, Label | null>>;
  /** Over all model raters: the most frequent label (ties -> `uncertain`) and its share of the raters that answered. */
  readonly majority: Label;
  readonly confidence: number;
  /** Over qualified vendors only. */
  readonly qualifiedMajority: Label | null;
  readonly qualifiedAgreeing: number;
  readonly qualifiedVoting: number;
  readonly unanimous: boolean;
  readonly authoritative: boolean;
}

export interface PanelReport {
  readonly rule: typeof AUTHORITY_RULE;
  readonly raters: readonly string[];
  readonly humans: readonly string[];
  readonly decoyCounts: { readonly correct: number; readonly wrong: number };
  readonly designOk: boolean;
  readonly accuracy: readonly RaterAccuracy[];
  readonly qualifiedVendors: readonly string[];
  readonly pairs: readonly PairRow[];
  readonly multi: readonly { readonly scope: string; readonly raters: number; readonly fleissBinary: number | null; readonly fleissThreeWay: number | null; readonly fleissItems: number; readonly alphaThreeWay: number | null; readonly alphaBinary: number | null }[];
  readonly panelKappa: number | null;
  readonly verdict: 'authoritative' | 'descriptive-only' | 'no-panel';
  readonly verdictReasons: readonly string[];
  readonly items: readonly ItemVerdict[];
  readonly targetSummary: readonly { readonly origin: string; readonly n: number; readonly yes: number; readonly no: number; readonly unresolved: number; readonly unanimous: number }[];
  /** Human labels (when given) against the authoritative panel label, on target items. */
  readonly humanVsPanel: readonly { readonly human: string; readonly binary: Agreement }[];
  readonly usage: PanelLabels['raters'];
  readonly withheld: PanelLabels['withheld'];
}

function majorityOf(ls: readonly Label[]): { label: Label; count: number } {
  const counts = LABELS.map((l) => ls.filter((x) => x === l).length);
  const max = Math.max(...counts);
  const top = LABELS.filter((_, i) => counts[i] === max);
  return { label: top.length === 1 ? (top[0] ?? 'uncertain') : 'uncertain', count: max };
}

/**
 * `humans`: rater name -> item id -> answer (`yes`/`no`/`uncertain`); they enter the pairwise table and the
 * human-vs-panel table, never the majority or the authority rule.
 */
export function panelReport(key: PanelKeyFile, run: PanelLabels, humans: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map()): PanelReport {
  const R = AUTHORITY_RULE;
  const raters = run.raters.map((r) => r.name);
  const vendorOf = new Map(run.raters.map((r) => [r.name, r.vendor]));
  const withheld = new Set(run.withheld.map((w) => w.id));
  const rows = key.rows.filter((k) => !withheld.has(k.id));
  const decoys = rows.filter((k) => k.truth !== undefined);
  const targets = rows.filter((k) => k.truth === undefined);
  const nCorrect = decoys.filter((k) => k.truth === 'yes').length;
  const nWrong = decoys.filter((k) => k.truth === 'no').length;
  const designOk = decoys.length >= R.minDecoys && nCorrect >= R.minDecoysPerClass && nWrong >= R.minDecoysPerClass;

  const modelLabel = (r: string, id: string): Label | undefined => {
    const x = run.labels[r]?.[id];
    if (x === undefined || x.agreement === 'invalid-run') return undefined;
    return x.label;
  };
  const anyLabel = (r: string, id: string): Label | undefined => {
    const h = humans.get(r);
    if (h !== undefined) { const v = h.get(id); return isLabel(v) ? v : undefined; }
    return modelLabel(r, id);
  };

  const accuracy = raters.map((r): RaterAccuracy => {
    const right = (rs: typeof decoys): number => rs.filter((k) => modelLabel(r, k.id) === k.truth).length;
    const kc = decoys.filter((k) => k.truth === 'yes');
    const kw = decoys.filter((k) => k.truth === 'no');
    const all = rows.map((k) => run.labels[r]?.[k.id]).filter((x) => x !== undefined);
    const valid = prop(all.filter((x) => x.agreement !== 'invalid-run').length, rows.length);
    const selfDisagree = prop(all.filter((x) => x.agreement === 'disagree').length, all.filter((x) => x.agreement !== 'invalid-run').length);
    const acc = prop(right(decoys), decoys.length);
    const accC = prop(right(kc), kc.length);
    const accW = prop(right(kw), kw.length);
    const reasons: string[] = [];
    if (!designOk) reasons.push(`the run holds ${String(decoys.length)} decoys (${String(nCorrect)} correct, ${String(nWrong)} wrong); the rule needs ≥ ${String(R.minDecoys)} with ≥ ${String(R.minDecoysPerClass)} per class`);
    if ((acc.share ?? 0) < R.minDecoyAccuracy) reasons.push(`decoy accuracy ${f3(acc.share)} < ${String(R.minDecoyAccuracy)}`);
    if ((accC.share ?? 0) < R.minClassAccuracy) reasons.push(`known-correct accuracy ${f3(accC.share)} < ${String(R.minClassAccuracy)}`);
    if ((accW.share ?? 0) < R.minClassAccuracy) reasons.push(`known-wrong accuracy ${f3(accW.share)} < ${String(R.minClassAccuracy)}`);
    if ((valid.share ?? 0) < R.minValidShare) reasons.push(`valid share ${f3(valid.share)} < ${String(R.minValidShare)}`);
    return {
      rater: r, vendor: vendorOf.get(r) ?? '', decoys: acc, knownCorrect: accC, knownWrong: accW,
      decoyUncertain: decoys.filter((k) => modelLabel(r, k.id) === 'uncertain').length,
      valid, selfDisagree, qualified: reasons.length === 0, reasons,
    };
  });

  // One rater per vendor counts: the first qualified one listed.
  const qualified: string[] = [];
  const seenVendor = new Set<string>();
  for (const a of accuracy) if (a.qualified && !seenVendor.has(a.vendor)) { qualified.push(a.rater); seenVendor.add(a.vendor); }

  const everyone = [...raters, ...humans.keys()];
  const pairs: PairRow[] = [];
  for (let i = 0; i < everyone.length; i += 1) {
    for (let j = i + 1; j < everyone.length; j += 1) {
      const a = everyone[i] ?? '';
      const b = everyone[j] ?? '';
      for (const [scope, set] of [['targets', targets], ['decoys', decoys]] as const) {
        const both: [string, string][] = [];
        for (const k of set) {
          const x = anyLabel(a, k.id);
          const y = anyLabel(b, k.id);
          if (x !== undefined && y !== undefined) both.push([x, y]);
        }
        if (both.length === 0) continue;
        pairs.push({
          a, b, scope, threeWay: agreement(both, LABELS),
          binary: agreement(both.map(([x, y]) => [x === 'yes' ? 'yes' : 'not-yes', y === 'yes' ? 'yes' : 'not-yes']), ['yes', 'not-yes']),
        });
      }
    }
  }

  const ids = targets.map((k) => k.id);
  const multiOf = (scope: string, rs: readonly string[]): PanelReport['multi'][number] => {
    const fb = fleissOver(ids, rs, modelLabel, true);
    const f3w = fleissOver(ids, rs, modelLabel, false);
    const units = ids.map((id) => rs.map((r) => modelLabel(r, id)).filter((x): x is Label => x !== undefined));
    return {
      scope, raters: rs.length, fleissBinary: fb.kappa, fleissThreeWay: f3w.kappa, fleissItems: fb.items,
      alphaThreeWay: krippendorffAlphaNominal(units), alphaBinary: krippendorffAlphaNominal(units.map((u) => u.map((l) => (l === 'yes' ? 'yes' : 'not-yes')))),
    };
  };
  const multi = [multiOf('all model raters', raters), ...(qualified.length >= 2 ? [multiOf('qualified vendors', qualified)] : [])];
  const panelKappa = qualified.length >= 2 ? multi[1]?.fleissBinary ?? null : null;

  const verdictReasons: string[] = [];
  if (!designOk) verdictReasons.push('too few decoys for the rule');
  if (qualified.length < R.minQualifiedVendors) verdictReasons.push(`${String(qualified.length)} qualified vendor(s); the rule needs ${String(R.minQualifiedVendors)}`);
  if (qualified.length >= R.minQualifiedVendors && (panelKappa === null || panelKappa < R.minPanelKappa)) {
    verdictReasons.push(`Fleiss κ (binary, qualified vendors, targets) ${f3(panelKappa)} < ${String(R.minPanelKappa)}`);
  }
  const verdict: PanelReport['verdict'] = !designOk || qualified.length < R.minQualifiedVendors ? 'no-panel'
    : verdictReasons.length > 0 ? 'descriptive-only' : 'authoritative';

  const items = rows.map((k): ItemVerdict => {
    const labels: Record<string, Label | null> = {};
    for (const r of raters) labels[r] = modelLabel(r, k.id) ?? null;
    const given = raters.map((r) => labels[r]).filter((x): x is Label => x !== null && x !== undefined);
    const m = majorityOf(given);
    const q = qualified.map((r) => labels[r]).filter((x): x is Label => x !== null && x !== undefined);
    const qm = q.length > 0 ? majorityOf(q) : null;
    const definite = qm !== null && qm.label !== 'uncertain';
    const strict = qm !== null && qm.count * 2 > qualified.length;
    const authoritative = verdict !== 'no-panel' && definite && strict && (qm?.count ?? 0) >= R.minAgreeingVendors;
    return {
      id: k.id, origin: k.origin, sourceId: k.sourceId, ...(k.truth !== undefined && { truth: k.truth }), labels,
      majority: m.label, confidence: given.length > 0 ? m.count / given.length : 0,
      qualifiedMajority: qm?.label ?? null, qualifiedAgreeing: qm?.count ?? 0, qualifiedVoting: q.length,
      unanimous: q.length === qualified.length && q.length >= 2 && q.every((x) => x === q[0]), authoritative,
    };
  });

  const origins = [...new Set(items.filter((i) => i.truth === undefined).map((i) => i.origin))].sort();
  const targetSummary = origins.map((origin) => {
    const its = items.filter((i) => i.truth === undefined && i.origin === origin);
    return {
      origin, n: its.length,
      yes: its.filter((i) => i.authoritative && i.qualifiedMajority === 'yes').length,
      no: its.filter((i) => i.authoritative && i.qualifiedMajority === 'no').length,
      unresolved: its.filter((i) => !i.authoritative).length,
      unanimous: its.filter((i) => i.authoritative && i.unanimous).length,
    };
  });

  const humanVsPanel = [...humans.keys()].map((h) => {
    const both: [string, string][] = [];
    for (const it of items) {
      if (it.truth !== undefined || !it.authoritative || it.qualifiedMajority === null) continue;
      const x = anyLabel(h, it.id);
      if (x !== undefined) both.push([x === 'yes' ? 'yes' : 'not-yes', it.qualifiedMajority === 'yes' ? 'yes' : 'not-yes']);
    }
    return { human: h, binary: agreement(both, ['yes', 'not-yes']) };
  });

  return {
    rule: R, raters, humans: [...humans.keys()], decoyCounts: { correct: nCorrect, wrong: nWrong }, designOk, accuracy,
    qualifiedVendors: qualified, pairs, multi, panelKappa, verdict, verdictReasons, items, targetSummary, humanVsPanel,
    usage: run.raters, withheld: run.withheld,
  };
}

// ── Rendering ───────────────────────────────────────────────────────────────

const f3 = (x: number | null | undefined): string => (x === null || x === undefined ? 'n/a' : x.toFixed(3));
const pc = (p: Prop): string => (p.share === null ? '0/0' : `${f3(p.share)} (${String(p.k)}/${String(p.n)}) [${f3(p.low)}, ${f3(p.high)}]`);

/** Every table of the report, as Markdown; `title` heads the page. */
export function renderPanelReport(r: PanelReport, title: string): string {
  const R = r.rule;
  const out: string[] = [`# ${title}`, ''];
  out.push(`Rule: **${R.id}** (Docs/v1.3/model-panel.md §5). Verdict: **${r.verdict}**${r.verdictReasons.length > 0 ? ` (${r.verdictReasons.join('; ')})` : ''}.`, '');
  out.push(`Decoys in the run: ${String(r.decoyCounts.correct)} known-correct, ${String(r.decoyCounts.wrong)} known-wrong. Qualified vendors: ${r.qualifiedVendors.length > 0 ? r.qualifiedVendors.join(', ') : 'none'}.`, '');

  out.push('## 1. Rater accuracy on decoys', '', `A rater qualifies with decoy accuracy ≥ ${String(R.minDecoyAccuracy)}, each class ≥ ${String(R.minClassAccuracy)}, valid labels on ≥ ${String(R.minValidShare)} of items. \`uncertain\` and invalid runs count as wrong. Intervals are 95% Wilson.`, '');
  out.push('| Rater | Decoy accuracy | Known-correct (`yes`) | Known-wrong (`no`) | Decoys `uncertain` | Valid items | Runs disagree | Qualified |', '|---|---|---|---|---|---|---|---|');
  for (const a of r.accuracy) {
    out.push(`| ${a.rater} | ${pc(a.decoys)} | ${pc(a.knownCorrect)} | ${pc(a.knownWrong)} | ${String(a.decoyUncertain)} | ${pc(a.valid)} | ${pc(a.selfDisagree)} | ${a.qualified ? 'yes' : `no: ${a.reasons.join('; ')}`} |`);
  }

  out.push('', '## 2. Pairwise agreement', '', 'Binary = `yes` vs not `yes`. Targets are the non-decoy items.', '');
  out.push('| Pair | Scope | n | Observed binary [95% Wilson] | κ binary | AC1 binary | κ three-way | AC1 three-way |', '|---|---|---|---|---|---|---|---|');
  for (const p of r.pairs) {
    out.push(`| ${p.a} – ${p.b} | ${p.scope} | ${String(p.binary.n)} | ${f3(p.binary.observed)} [${f3(p.binary.observedLow)}, ${f3(p.binary.observedHigh)}] | ${f3(p.binary.kappa)} | ${f3(p.binary.ac1)} | ${f3(p.threeWay.kappa)} | ${f3(p.threeWay.ac1)} |`);
  }
  for (const p of r.pairs.filter((x) => x.scope === 'targets')) {
    out.push('', `### ${p.a} (rows) × ${p.b} (columns), targets, three-way`, '', `| | ${p.threeWay.categories.join(' | ')} |`, `|---|${p.threeWay.categories.map(() => '---').join('|')}|`);
    p.threeWay.table.forEach((row, i) => out.push(`| ${p.threeWay.categories[i] ?? ''} | ${row.join(' | ')} |`));
  }

  out.push('', '## 3. Multi-rater agreement (targets)', '', `Fleiss' κ over items every rater in the scope answered; Krippendorff's α (nominal) allows missing labels. The panel gate is Fleiss' κ binary among qualified vendors ≥ ${String(R.minPanelKappa)}.`, '');
  out.push('| Scope | Raters | Items (all answered) | Fleiss κ binary | Fleiss κ three-way | Krippendorff α binary | Krippendorff α three-way |', '|---|---|---|---|---|---|---|');
  for (const m of r.multi) out.push(`| ${m.scope} | ${String(m.raters)} | ${String(m.fleissItems)} | ${f3(m.fleissBinary)} | ${f3(m.fleissThreeWay)} | ${f3(m.alphaBinary)} | ${f3(m.alphaThreeWay)} |`);

  out.push('', '## 4. Panel labels on targets', '', `An item is authoritative when ≥ ${String(R.minAgreeingVendors)} qualified vendors give the same definite label and it is a strict majority of the qualified vendors (and the panel verdict is not \`no-panel\`).`, '');
  out.push('| Origin | Targets | Authoritative `yes` | Authoritative `no` | Unresolved | Authoritative and unanimous |', '|---|---|---|---|---|---|');
  for (const s of r.targetSummary) out.push(`| ${s.origin} | ${String(s.n)} | ${String(s.yes)} | ${String(s.no)} | ${String(s.unresolved)} | ${String(s.unanimous)} |`);
  if (r.humanVsPanel.length > 0) {
    out.push('', '### Human labels against the authoritative panel label (binary, targets)', '', '| Human | n | Observed [95% Wilson] | κ | AC1 |', '|---|---|---|---|---|');
    for (const h of r.humanVsPanel) out.push(`| ${h.human} | ${String(h.binary.n)} | ${f3(h.binary.observed)} [${f3(h.binary.observedLow)}, ${f3(h.binary.observedHigh)}] | ${f3(h.binary.kappa)} | ${f3(h.binary.ac1)} |`);
  }

  out.push('', '## 5. Per item', '', 'Majority over all model raters (ties are `uncertain`) with its confidence (share of answering raters); the qualified majority is the panel label. Truth is shown for decoys only.', '');
  out.push(`| Item | Origin | Source id | ${r.raters.join(' | ')} | Majority (confidence) | Qualified majority (agree/voting) | Authoritative | Truth |`, `|---|---|---|${r.raters.map(() => '---').join('|')}|---|---|---|---|`);
  for (const it of r.items) {
    out.push(`| ${it.id} | ${it.origin} | ${it.sourceId.length > 16 ? it.sourceId.slice(0, 12) : it.sourceId} | ${r.raters.map((x) => it.labels[x] ?? '—').join(' | ')} | ${it.majority} (${f3(it.confidence)}) | ${it.qualifiedMajority ?? '—'} (${String(it.qualifiedAgreeing)}/${String(it.qualifiedVoting)}) | ${it.authoritative ? (it.unanimous ? 'yes, unanimous' : 'yes') : 'no'} | ${it.truth ?? ''} |`);
  }

  out.push('', '## 6. Calls and tokens', '', '| Rater | Provider | Model | Calls | From cassette | Input tokens | Output tokens |', '|---|---|---|---|---|---|---|');
  for (const u of r.usage) out.push(`| ${u.name} | ${u.provider} | ${u.model} | ${String(u.usage.calls)} | ${String(u.usage.fromCassette)} | ${String(u.usage.inputTokens)} | ${String(u.usage.outputTokens)} |`);
  if (r.withheld.length > 0) {
    out.push('', '## Withheld by the blinding check', '');
    for (const w of r.withheld) out.push(`- ${w.id}: ${w.problems.join('; ')}`);
  }
  return out.join('\n') + '\n';
}
