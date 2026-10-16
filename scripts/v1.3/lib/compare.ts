/**
 * Comparison of tool findings with the reference manifests (FR-V5): matching, per-variant mismatches and
 * per-style / per-rule recall and precision. Pure; no I/O.
 *
 * Matching key: rule id + file (project-relative). When both the expected and the actual finding carry a target,
 * the targets must be equal too; otherwise the target is ignored (several templates return no target column).
 * Matching is one-to-one: a second tool row for the same expected finding is an unexpected finding. Exact-target
 * matches are taken before target-less ones, so the pairing does not depend on row order.
 *
 * Cycle findings (FF-S02, v1.3 fix round fix 2). The cycle template puts the cycle PATH in the file column
 * (`"a.ts,b.ts,a.ts"`) and the second file in the target column; a manifest names the cycle by its smallest file and
 * the next one. A cycle is a set of files, not a path or a key file, so an FF-S02 row matches an expected FF-S02 finding
 * when the two have the same SET of files: every path in `file` and `target`, split on commas, deduplicated. Under the
 * literal key each planted cycle counted as one miss plus one false positive. This is scoring code; the tool's rows and
 * the manifests are unchanged. `ue-score.ts` reports the same reading as its `author-cycle-normalised` view.
 */
import type { ExpectedFinding, ScopeRule, VariantKind } from './reference-model.js';

export interface ActualFinding {
  readonly ruleId: string;
  readonly file: string;
  readonly target?: string;
}

export type MismatchKind = 'missed' | 'unexpected';

export interface Mismatch {
  readonly kind: MismatchKind;
  readonly ruleId: string;
  readonly file: string;
  readonly target?: string;
  /** The manifest's reason (missed findings only). */
  readonly reason?: string;
  /** Unexpected only: the same rule + file + target is also reported on the clean variant (a baseline row). */
  readonly alsoOnClean?: boolean;
}

export interface VariantComparison {
  readonly style: string;
  readonly variant: string;
  readonly kind: VariantKind;
  readonly plants: string | null;
  readonly matched: readonly ExpectedFinding[];
  readonly mismatches: readonly Mismatch[];
  /** Did any matched finding carry the planted rule (violation variants only; null otherwise). */
  readonly plantedDetected: boolean | null;
  /** Rows of rules outside the compared scope, listed but not scored. */
  readonly unscored: readonly ActualFinding[];
}

/** Normalises a tool path to the manifest form: forward slashes, project-relative, no leading `./`. */
export function normaliseFindingPath(p: string, projectDir?: string): string {
  let out = p.replace(/\\/g, '/');
  if (projectDir !== undefined) {
    const root = projectDir.replace(/\\/g, '/').replace(/\/+$/, '');
    if (out.startsWith(root + '/')) out = out.slice(root.length + 1);
  }
  return out.replace(/^\.\//, '');
}

/** Rules whose finding is a cycle, matched on the set of files in it (see the file comment). */
export const CYCLE_RULE_IDS: ReadonlySet<string> = new Set(['FF-S02']);

/** The sorted, deduplicated files of a cycle finding (`file` and `target`, each split on commas). */
export function cycleFileSet(f: { file: string; target?: string | undefined }): string {
  const parts = [...f.file.split(','), ...(f.target ?? '').split(',')].map((x) => x.trim()).filter((x) => x !== '');
  return [...new Set(parts)].sort().join(',');
}

function key(f: { ruleId: string; file: string; target?: string | undefined }): string {
  if (CYCLE_RULE_IDS.has(f.ruleId)) return `${f.ruleId}|{${cycleFileSet(f)}}`;
  return `${f.ruleId}|${f.file}|${f.target ?? ''}`;
}

function sameFinding(e: ExpectedFinding, a: ActualFinding, exactOnly: boolean): boolean {
  if (a.ruleId !== e.ruleId) return false;
  if (CYCLE_RULE_IDS.has(e.ruleId)) return cycleFileSet(e) === cycleFileSet(a);
  return a.file === e.file && targetsCompatible(e, a, exactOnly);
}

function targetsCompatible(e: ExpectedFinding, a: ActualFinding, exactOnly: boolean): boolean {
  const et = e.target ?? '';
  const at = a.target ?? '';
  if (et !== '' && at !== '') return et === at;
  return !exactOnly;
}

export function compareVariant(
  style: string,
  manifest: { variant: string; kind: VariantKind; plants: string | null; expectedFindings: readonly ExpectedFinding[] },
  actual: readonly ActualFinding[],
  scopeRuleIds: ReadonlySet<string>,
  cleanActual?: readonly ActualFinding[],
): VariantComparison {
  const scored = actual.filter((a) => scopeRuleIds.has(a.ruleId));
  const unscored = actual.filter((a) => !scopeRuleIds.has(a.ruleId));
  const used = new Array<boolean>(scored.length).fill(false);
  const matchedIdx = new Array<number>(manifest.expectedFindings.length).fill(-1);

  for (const exactOnly of [true, false]) {
    manifest.expectedFindings.forEach((e, ei) => {
      if (matchedIdx[ei] !== -1) return;
      const ai = scored.findIndex((a, i) => !used[i] && sameFinding(e, a, exactOnly));
      if (ai >= 0) {
        used[ai] = true;
        matchedIdx[ei] = ai;
      }
    });
  }

  const cleanKeys = new Set((cleanActual ?? []).filter((a) => scopeRuleIds.has(a.ruleId)).map(key));
  const mismatches: Mismatch[] = [];
  manifest.expectedFindings.forEach((e, ei) => {
    if (matchedIdx[ei] === -1) {
      mismatches.push({ kind: 'missed', ruleId: e.ruleId, file: e.file, ...(e.target !== undefined ? { target: e.target } : {}), reason: e.reason });
    }
  });
  scored.forEach((a, i) => {
    if (used[i]) return;
    mismatches.push({
      kind: 'unexpected', ruleId: a.ruleId, file: a.file, ...(a.target !== undefined && a.target !== '' ? { target: a.target } : {}),
      ...(cleanActual !== undefined && manifest.kind !== 'clean' ? { alsoOnClean: cleanKeys.has(key(a)) } : {}),
    });
  });

  const matched = manifest.expectedFindings.filter((_, ei) => matchedIdx[ei] !== -1);
  return {
    style,
    variant: manifest.variant,
    kind: manifest.kind,
    plants: manifest.plants,
    matched,
    mismatches,
    plantedDetected: manifest.kind === 'violation' ? matched.some((m) => m.ruleId === manifest.plants) : null,
    unscored,
  };
}

export interface RuleMetrics {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly blockingCandidate: boolean;
  readonly tp: number;
  readonly fn: number;
  /** Every unexpected row of the rule over every variant. */
  readonly fp: number;
  /** Unexpected rows, counting a row that also appears on the clean variant once (on the clean variant). */
  readonly fpDistinct: number;
  readonly recall: number | null;
  readonly precision: number | null;
  readonly precisionDistinct: number | null;
}

export interface StyleMetrics {
  readonly style: string;
  readonly variants: number;
  readonly rules: readonly RuleMetrics[];
  /** Pooled over the blocking rules (v1.3 tier `blocking` under the style; see reference-model.ts). */
  readonly blocking: Omit<RuleMetrics, 'ruleId' | 'ruleName' | 'blockingCandidate'>;
  /** Pooled over every compared rule. */
  readonly all: Omit<RuleMetrics, 'ruleId' | 'ruleName' | 'blockingCandidate'>;
  /** Violation variants whose planted rule was detected / violation variants. */
  readonly plantedDetected: number;
  readonly violationVariants: number;
  /** Clean and near-miss variants with no unexpected scored row / clean and near-miss variants. */
  readonly silentNonViolations: number;
  readonly nonViolationVariants: number;
}

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

function pool(rows: readonly RuleMetrics[]): Omit<RuleMetrics, 'ruleId' | 'ruleName' | 'blockingCandidate'> {
  const tp = rows.reduce((s, r) => s + r.tp, 0);
  const fn = rows.reduce((s, r) => s + r.fn, 0);
  const fp = rows.reduce((s, r) => s + r.fp, 0);
  const fpDistinct = rows.reduce((s, r) => s + r.fpDistinct, 0);
  return { tp, fn, fp, fpDistinct, recall: ratio(tp, tp + fn), precision: ratio(tp, tp + fp), precisionDistinct: ratio(tp, tp + fpDistinct) };
}

export function styleMetrics(
  ref: { readonly style: string; readonly descriptor: { readonly scopeRules: readonly ScopeRule[] } },
  comparisons: readonly VariantComparison[],
): StyleMetrics {
  const rules = ref.descriptor.scopeRules.map((r): RuleMetrics => {
    let tp = 0;
    let fn = 0;
    let fp = 0;
    let fpDistinct = 0;
    for (const c of comparisons) {
      tp += c.matched.filter((m) => m.ruleId === r.ruleId).length;
      for (const m of c.mismatches) {
        if (m.ruleId !== r.ruleId) continue;
        if (m.kind === 'missed') fn += 1;
        else {
          fp += 1;
          if (m.alsoOnClean !== true) fpDistinct += 1;
        }
      }
    }
    return {
      ruleId: r.ruleId, ruleName: r.ruleName, blockingCandidate: r.blockingCandidate,
      tp, fn, fp, fpDistinct, recall: ratio(tp, tp + fn), precision: ratio(tp, tp + fp), precisionDistinct: ratio(tp, tp + fpDistinct),
    };
  });
  const violations = comparisons.filter((c) => c.kind === 'violation');
  const others = comparisons.filter((c) => c.kind !== 'violation');
  return {
    style: ref.style,
    variants: comparisons.length,
    rules,
    blocking: pool(rules.filter((r) => r.blockingCandidate)),
    all: pool(rules),
    plantedDetected: violations.filter((c) => c.plantedDetected === true).length,
    violationVariants: violations.length,
    silentNonViolations: others.filter((c) => !c.mismatches.some((m) => m.kind === 'unexpected')).length,
    nonViolationVariants: others.length,
  };
}

const pct = (v: number | null): string => (v === null ? 'n/a' : v.toFixed(2));

/** A Markdown summary of the run: per-style and per-rule tables, then every mismatch. */
export function renderMarkdown(metrics: readonly StyleMetrics[], comparisons: readonly VariantComparison[], header: string): string {
  const out: string[] = [header, ''];
  out.push('| Style | Variants | Planted detected | Silent clean/near-miss | Blocking recall | Blocking precision | Blocking precision (distinct) | All recall | All precision |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  for (const m of metrics) {
    out.push(`| ${m.style} | ${String(m.variants)} | ${String(m.plantedDetected)}/${String(m.violationVariants)} | ${String(m.silentNonViolations)}/${String(m.nonViolationVariants)} | ${pct(m.blocking.recall)} | ${pct(m.blocking.precision)} | ${pct(m.blocking.precisionDistinct)} | ${pct(m.all.recall)} | ${pct(m.all.precision)} |`);
  }
  for (const m of metrics) {
    out.push('', `## ${m.style}`, '', '| Rule | Name | Blocking candidate | TP | FN | FP | FP distinct | Recall | Precision |', '|---|---|---|---|---|---|---|---|---|');
    for (const r of m.rules) {
      out.push(`| ${r.ruleId} | ${r.ruleName} | ${r.blockingCandidate ? 'yes' : 'no'} | ${String(r.tp)} | ${String(r.fn)} | ${String(r.fp)} | ${String(r.fpDistinct)} | ${pct(r.recall)} | ${pct(r.precision)} |`);
    }
    const rows = comparisons.filter((c) => c.style === m.style && c.mismatches.length > 0);
    out.push('', rows.length === 0 ? 'No mismatch.' : '| Variant | Kind | Mismatch | Rule | File | Target | Note |');
    if (rows.length > 0) out.push('|---|---|---|---|---|---|---|');
    for (const c of rows) {
      for (const x of c.mismatches) {
        const note = x.kind === 'missed' ? (x.reason ?? '') : x.alsoOnClean === true ? 'also on the clean variant' : '';
        out.push(`| ${c.variant} | ${c.kind} | ${x.kind} | ${x.ruleId} | ${x.file} | ${x.target ?? ''} | ${note.replace(/\|/g, '\\|')} |`);
      }
    }
  }
  return out.join('\n') + '\n';
}
