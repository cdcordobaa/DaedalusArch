/**
 * Ontology v0 pass (d): clustering of rules, concepts and capabilities across components.
 *
 * Deterministic first: items with the same normalised name (rules: the same normalised statement) are merged without
 * a model call. Then embedding-free candidate pairs across components are proposed:
 * - rules: the same operator with thresholds equal up to a decimal scale, or the same operator with a subject-token
 *   Jaccard of at least 0.5;
 * - concepts: a name-token Jaccard of at least 0.5, or a field-name Jaccard of the defining classes of at least 0.3;
 * - capabilities: a name-token Jaccard of at least 0.34.
 * The highest-scoring pairs (at most `maxPairs`, ties by key) go to the model, `runs` times each. A pair is merged
 * only when every valid run says `same`.
 */
import { canonicalJSON, sha256Hex } from '../../llm-critic/canonical-json.js';
import type { PassContext } from './passes.js';
import type { AdjudicationSide } from './prompts.js';
import { ADJUDICATION_SCHEMA, ONTOLOGY_SYSTEM, adjudicationPrompt } from './prompts.js';
import { equalUpToDecimalScale, jaccard, normName, tokens } from './text.js';
import type { AdjudicationOut, RuleOperator } from './types.js';
import { hostIndependentCompare } from '../../shared/collation.js';

export interface ClusterItem {
  readonly key: string;
  readonly kind: 'rule' | 'concept' | 'capability';
  readonly component: string;
  /** Rule statement, concept name or capability name. */
  readonly text: string;
  readonly where: string;
  readonly quotes: readonly string[];
  readonly rule?: { readonly subject: string; readonly operator: RuleOperator; readonly threshold: number | null };
  readonly fields?: readonly string[];
}

export interface CandidatePair {
  readonly a: ClusterItem;
  readonly b: ClusterItem;
  readonly score: number;
  readonly basis: string;
}

export interface AdjudicationRecord {
  readonly a: string;
  readonly b: string;
  readonly basis: string;
  readonly verdicts: readonly (boolean | null)[];
  readonly merged: boolean;
}

export interface ClusterResult {
  /** Clusters of item keys, each sorted, sorted by first key. */
  readonly clusters: readonly (readonly string[])[];
  readonly adjudications: readonly AdjudicationRecord[];
  /** Candidate pairs left unadjudicated by the cap or a stop. */
  readonly droppedPairs: number;
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(x: string): string {
    let p = this.parent.get(x) ?? x;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  }
}

function exactKey(item: ClusterItem): string {
  return `${item.kind}|${normName(item.text)}`;
}

export function candidatePairs(items: readonly ClusterItem[], decimalScaleMaxPower: number): CandidatePair[] {
  const out: CandidatePair[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a === undefined || b?.kind !== a.kind || a.component === b.component) continue;
      if (exactKey(a) === exactKey(b)) continue;
      const nameJ = jaccard(tokens(a.text), tokens(b.text));
      let score = 0;
      let basis = '';
      if (a.kind === 'rule' && a.rule !== undefined && b.rule?.operator === a.rule.operator && a.rule.operator !== 'other') {
        const subj = jaccard(tokens(a.rule.subject), tokens(b.rule.subject));
        const sameThreshold = a.rule.threshold !== null && b.rule.threshold !== null && equalUpToDecimalScale(a.rule.threshold, b.rule.threshold, decimalScaleMaxPower);
        if (sameThreshold) {
          score = 1 + subj;
          basis = `operator ${a.rule.operator} and threshold ${String(a.rule.threshold)} ~ ${String(b.rule.threshold)}`;
        } else if (subj >= 0.5) {
          score = subj;
          basis = `operator ${a.rule.operator} and subject-token Jaccard ${subj.toFixed(2)}`;
        }
      } else if (a.kind === 'concept') {
        const fieldJ = a.fields !== undefined && b.fields !== undefined ? jaccard(a.fields.map(normName), b.fields.map(normName)) : 0;
        if (nameJ >= 0.5 || fieldJ >= 0.3) {
          score = Math.max(nameJ, fieldJ);
          basis = nameJ >= 0.5 ? `name-token Jaccard ${nameJ.toFixed(2)}` : `field-name Jaccard ${fieldJ.toFixed(2)}`;
        }
      } else if (a.kind === 'capability' && nameJ >= 0.34) {
        score = nameJ;
        basis = `name-token Jaccard ${nameJ.toFixed(2)}`;
      }
      if (score > 0) out.push({ a, b, score, basis });
    }
  }
  return out.sort((x, y) => y.score - x.score || hostIndependentCompare(`${x.a.key}|${x.b.key}`, `${y.a.key}|${y.b.key}`));
}

function side(item: ClusterItem): AdjudicationSide {
  return { kind: item.kind, text: item.text, where: item.where, quotes: item.quotes };
}

export async function cluster(p: PassContext, items: readonly ClusterItem[], opts: { readonly maxPairs: number; readonly decimalScaleMaxPower: number }): Promise<ClusterResult> {
  const uf = new UnionFind();
  const firstOf = new Map<string, string>();
  for (const it of items) {
    const k = exactKey(it);
    const first = firstOf.get(k);
    if (first === undefined) firstOf.set(k, it.key);
    else uf.union(first, it.key);
  }
  const pairs = candidatePairs(items, opts.decimalScaleMaxPower);
  const adjudications: AdjudicationRecord[] = [];
  let taken = 0;
  let droppedPairs = 0;
  for (const pair of pairs) {
    if (uf.find(pair.a.key) === uf.find(pair.b.key)) continue;
    if (taken >= opts.maxPairs || p.caller.stopped !== null) {
      droppedPairs++;
      continue;
    }
    taken++;
    const [a, b] = pair.a.key < pair.b.key ? [pair.a, pair.b] : [pair.b, pair.a];
    const itemId = sha256Hex(canonicalJSON([a.key, b.key])).slice(0, 16);
    const prompt = adjudicationPrompt(side(a), side(b));
    const verdicts: (boolean | null)[] = [];
    for (let runIndex = 0; runIndex < p.runs; runIndex++) {
      const r = await p.caller.call<AdjudicationOut>({
        pass: 'adjudicate', itemId, itemName: `${a.text} ~ ${b.text}`, runIndex, system: ONTOLOGY_SYSTEM, prompt, schema: ADJUDICATION_SCHEMA,
      });
      verdicts.push(r.kind === 'ok' ? r.value.same : null);
    }
    const valid = verdicts.filter((v): v is boolean => v !== null);
    const merged = valid.length > 0 && valid.every((v) => v);
    if (valid.length >= 2) p.tallies.adjudicate.add(valid.every((v) => v === valid[0]) ? 1 : 0, valid.every((v) => v === valid[0]) ? 1 : 0, 1);
    p.accepted.adjudicate += valid.length;
    if (merged) uf.union(a.key, b.key);
    adjudications.push({ a: a.key, b: b.key, basis: pair.basis, verdicts, merged });
  }
  const groups = new Map<string, string[]>();
  for (const it of items) {
    const r = uf.find(it.key);
    groups.set(r, [...(groups.get(r) ?? []), it.key]);
  }
  const clusters = [...groups.values()].map((g) => [...g].sort()).sort((x, y) => hostIndependentCompare(x[0] ?? '', y[0] ?? ''));
  return { clusters, adjudications, droppedPairs };
}
