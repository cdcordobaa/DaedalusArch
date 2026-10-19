/**
 * A2, the facts file (v1.4 U3, design `aidlc-docs/construction/v1.4/U3/functional-design/design.md` §3; NS-02 §1).
 *
 * A2 is a projection of one ontology run into facts: parser facts (layer, context, logic density, the verifier's
 * rule-equivalence check, exact-name merges) and model facts (responsibilities, concepts, rules, capabilities and the
 * pass (d) adjudications). It holds **facts only**: the run's findings are verdicts and never enter A2 (N1, BR-U3-01).
 * Verdicts come from the Sem rules over A1 + A2 (`sem-rules.ts`). A grounding-rejected assertion never becomes a fact.
 *
 * Determinism (I5, BR-U3-03): fact ids are content hashes that leave out the derived cluster ids, the file is sorted,
 * and every date comes from the cassettes (a replay gives the same bytes).
 */
import * as path from 'node:path';
import { canonicalJSON, sha256Hex } from '../../llm-critic/canonical-json.js';
import { hostIndependentCompare } from '../../shared/collation.js';
import type { APGResult } from '../../shared/types/apg.js';
import type { LayerKind } from '../../shared/types/enums.js';
import { recordedKey } from './caller.js';
import { diskReader } from './grounding.js';
import type { Kept, RuleSite } from './passes.js';
import type { ConceptMember, FactPolicy, OntologyInput, OntologyRunDetail } from './pipeline.js';
import { projectHash, semId } from './pipeline.js';
import { PROMPT_VERSION } from './prompts.js';
import { normName } from './text.js';
import type { AdjudicationRecord } from './clustering.js';
import type { Agreement, GroundedEvidence, RuleKind, RuleOperator, SemProvenance } from './types.js';
import { verifyRuleDuplication } from './verify.js';

export const FACT_PREDICATES = [
  'inLayer', 'inContext', 'logicDensity', 'hasResponsibility', 'embodiesConcept', 'enforcesRule', 'realizesCapability',
  'sameConceptAs', 'sameRuleAs', 'ruleEquivalenceVerified',
] as const;
export type FactPredicate = (typeof FACT_PREDICATES)[number];

export type FactSource = 'parser' | 'model';
export type FactBasis = 'apg' | 'spec' | 'verifier';

/** The value shapes per predicate (design §3.2). */
export interface FactValues {
  readonly inLayer: LayerKind;
  readonly inContext: { readonly context: string; readonly declared: boolean };
  readonly logicDensity: number;
  readonly hasResponsibility: { readonly name: string; readonly description: string; readonly naturalLayer: string };
  readonly embodiesConcept: { readonly concept: string; readonly relation: 'defines' | 'uses'; readonly conceptId: string | null };
  readonly enforcesRule: {
    readonly statement: string; readonly subject: string; readonly operator: RuleOperator; readonly threshold: number | null;
    readonly unit: string | null; readonly kind: RuleKind; readonly ruleId: string | null;
  };
  readonly realizesCapability: { readonly capability: string; readonly capabilityId: string | null };
  readonly sameConceptAs: { readonly other: string; readonly same: boolean };
  readonly sameRuleAs: { readonly other: string; readonly same: boolean };
  readonly ruleEquivalenceVerified: { readonly other: string; readonly verified: boolean; readonly method: string };
}

export interface Fact {
  readonly id: string;
  /** An APG node id (A1). */
  readonly subject: string;
  readonly predicate: FactPredicate;
  readonly value: FactValues[FactPredicate];
  readonly source: FactSource;
  /** Parser facts only; null for model facts. */
  readonly basis: FactBasis | null;
  /** The served model (VRD-07); null for parser facts. */
  readonly modelId: string | null;
  readonly promptHash: string | null;
  readonly date: string;
  /** The model's own figure; reported, never a gate (BR-U3-05). */
  readonly confidence: number | null;
  readonly agreement: Agreement | null;
  /** Null when agreed (and for parser facts); otherwise the primary run's index. */
  readonly runIndex: number | null;
  readonly evidence: readonly GroundedEvidence[];
}

export interface FactsFile {
  readonly schemaVersion: 1;
  readonly artifact: 'A2';
  readonly project: { readonly id: string; readonly contentHash: string; readonly commit: null };
  readonly inputs: {
    readonly a1: { readonly apgHash: string };
    readonly layerModel: { readonly path: string | null; readonly hash: string | null };
  };
  readonly producer: {
    readonly part: 'C1d';
    readonly pipeline: 'ontology-v0';
    readonly promptVersion: string;
    readonly provider: string;
    /** The requested model. */
    readonly model: string;
    readonly runs: number;
    readonly runId: string;
    /** The policy the run used (run-level, BR-U3-06). */
    readonly factPolicy: FactPolicy;
  };
  readonly facts: readonly Fact[];
}

/** Value keys that are derived cluster ids: left out of the fact id, so a fact keeps its id when clustering changes. */
const CLUSTER_ID_KEYS: ReadonlySet<string> = new Set(['conceptId', 'ruleId', 'capabilityId']);

function withoutClusterIds(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !CLUSTER_ID_KEYS.has(k)));
}

/** `fact:<16 hex>` = sha256(canonicalJSON([subject, predicate, value without cluster ids, source, runIndex])) (BR-U3-03). */
export function factId(f: Pick<Fact, 'subject' | 'predicate' | 'value' | 'source' | 'runIndex'>): string {
  return `fact:${sha256Hex(canonicalJSON([f.subject, f.predicate, withoutClusterIds(f.value), f.source, f.runIndex])).slice(0, 16)}`;
}

export class A2InvariantError extends Error {
  constructor(readonly violations: readonly string[]) {
    super(`A2 invariants violated (${String(violations.length)}): ${violations.join('; ')}`);
    this.name = 'A2InvariantError';
  }
}

/** Verdict-shaped names the vocabulary must never hold (I4; N1). */
export const VERDICT_SHAPED = ['violates', 'isDefect', 'misplaced', 'fragmented', 'duplicated'] as const;

function compareFacts(a: Fact, b: Fact): number {
  return hostIndependentCompare(a.predicate, b.predicate) || hostIndependentCompare(a.subject, b.subject) || hostIndependentCompare(a.id, b.id);
}

/** I1 to I5 (design §3.3). Throws `A2InvariantError` listing every violation. */
export function validateFacts(file: FactsFile, apg: APGResult): void {
  const ids = new Set(apg.nodes.map((n) => n.id));
  const v: string[] = [];
  const seen = new Set<string>();
  file.facts.forEach((f, i) => {
    const at = `${f.id} (${f.predicate})`;
    if (!(FACT_PREDICATES as readonly string[]).includes(f.predicate)) v.push(`I4 ${at}: predicate outside the vocabulary`);
    if (!ids.has(f.subject)) v.push(`I1 ${at}: subject ${f.subject} is not an A1 node`);
    const val: unknown = f.value;
    if (typeof val === 'object' && val !== null && 'other' in val) {
      const other = (val as { readonly other?: unknown }).other;
      if (typeof other !== 'string' || !ids.has(other)) v.push(`I1 ${at}: value.other ${String(other)} is not an A1 node`);
    }
    if (f.source === 'model') {
      if (f.modelId === null || f.promptHash === null) v.push(`I2 ${at}: model fact without modelId or promptHash`);
      if (!f.evidence.some((e) => e.grounded === true as boolean)) v.push(`I2 ${at}: model fact without grounded evidence`);
    } else if (f.modelId !== null || f.promptHash !== null || f.confidence !== null || f.agreement !== null || f.runIndex !== null || f.evidence.length > 0) {
      v.push(`I3 ${at}: parser fact carries model provenance or evidence`);
    }
    if (seen.has(f.id)) v.push(`I5 ${at}: duplicate fact id`);
    seen.add(f.id);
    if (factId(f) !== f.id) v.push(`I5 ${at}: id is not the content hash`);
    const prev = file.facts[i - 1];
    if (prev !== undefined && compareFacts(prev, f) > 0) v.push(`I5 ${at}: facts not sorted by (predicate, subject, id)`);
  });
  if (v.length > 0) throw new A2InvariantError(v);
}

function dedupEvidence(list: readonly GroundedEvidence[]): GroundedEvidence[] {
  const seen = new Set<string>();
  return list.filter((e) => {
    const k = canonicalJSON(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface BuildFactsOptions {
  /** The project id written in A2 (the runner's case id). */
  readonly projectId: string;
  /** Repo-relative path of the layer model, or null when none was given. */
  readonly layerModelPath: string | null;
  /** Fallback date of parser facts when the run used no recorded answer (default: the run's `ranAt`). */
  readonly now?: () => string;
}

/** OntologyRunDetail → A2 (design §3.2). The file is validated before it is returned. */
export function buildFacts(detail: OntologyRunDetail, input: OntologyInput, opts: BuildFactsOptions): FactsFile {
  const { units, result } = detail;
  const read = input.readFile ?? diskReader(path.resolve(input.projectRoot));
  const dates = [...detail.recordedAt.values()].sort();
  const parserDate = dates[0] ?? (opts.now !== undefined ? opts.now() : detail.ranAt);
  const facts = new Map<string, Fact>();

  const add = (f: Omit<Fact, 'id'>): void => {
    const fact: Fact = { id: factId(f), ...f };
    if (!facts.has(fact.id)) facts.set(fact.id, fact);
  };
  const parser = <P extends FactPredicate>(subject: string, predicate: P, value: FactValues[P], basis: FactBasis): void => {
    add({ subject, predicate, value, source: 'parser', basis, modelId: null, promptHash: null, date: parserDate, confidence: null, agreement: null, runIndex: null, evidence: [] });
  };
  const dateOf = (prov: SemProvenance, runIndex: number): string => detail.recordedAt.get(recordedKey(prov.promptHash, runIndex)) ?? parserDate;
  const model = <P extends FactPredicate>(subject: string, predicate: P, value: FactValues[P], k: { readonly provenance: SemProvenance; readonly agreement: Agreement; readonly runIndex: number; readonly evidence: readonly GroundedEvidence[] }, confidence: number): void => {
    add({
      subject, predicate, value, source: 'model', basis: null, modelId: k.provenance.model, promptHash: k.provenance.promptHash,
      date: dateOf(k.provenance, k.runIndex), confidence, agreement: k.agreement, runIndex: k.agreement === 'agreed' ? null : k.runIndex,
      evidence: k.evidence,
    });
  };

  // Parser facts from the units.
  for (const c of units.classes) {
    if (c.layerKind !== null) parser(c.nodeId, 'inLayer', c.layerKind, 'apg');
    parser(c.nodeId, 'inContext', { context: c.component, declared: c.declaredContext !== null }, c.declaredContext !== null ? 'spec' : 'apg');
    for (const m of c.methods) if (m.logicDensity !== null) parser(m.nodeId, 'logicDensity', m.logicDensity, 'apg');
  }

  // Cluster ids, from the clusters the pipeline built (the same ids as its Sem nodes).
  const conceptKeyOf = new Map<Kept<unknown>, string>([...detail.clusterItems.concepts.entries()].map(([k, m]) => [m.c, k]));
  const conceptCluster = new Map<string, string>();
  for (const keys of detail.clusters.concepts.clusters) for (const k of keys) conceptCluster.set(k, semId('SemBusinessConcept', keys));
  const ruleKeyOf = new Map<RuleSite, string>([...detail.clusterItems.rules.entries()].map(([k, r]) => [r, k]));
  const ruleCluster = new Map<string, string>();
  for (const keys of detail.clusters.rules.clusters) {
    const id = semId('SemBusinessRule', keys.map((k) => detail.clusterItems.rules.get(k)?.rule.out.enforcedBy ?? k).sort());
    for (const k of keys) ruleCluster.set(k, id);
  }
  const capKeyOf = new Map<Kept<unknown>, string>([...detail.clusterItems.capabilities.entries()].map(([k, c]) => [c, k]));
  const capCluster = new Map<string, string>();
  for (const keys of detail.clusters.capabilities.clusters) for (const k of keys) capCluster.set(k, semId('SemCapability', keys));

  // Model facts: pass (a).
  for (const s of detail.classSemantics) {
    for (const r of s.responsibilities) {
      model(s.cls.nodeId, 'hasResponsibility', { name: r.out.name, description: r.out.description, naturalLayer: r.out.naturalLayer }, r, r.out.confidence);
    }
    for (const c of s.concepts) {
      const key = conceptKeyOf.get(c);
      model(s.cls.nodeId, 'embodiesConcept', { concept: c.out.name, relation: c.out.relation, conceptId: key === undefined ? null : conceptCluster.get(key) ?? null }, c, c.out.confidence);
    }
  }
  // Pass (c): every kept rule site; input checks carry no rule id (never clustered, BR-U3-18).
  for (const site of detail.ruleSites) {
    const r = site.rule;
    const key = ruleKeyOf.get(site);
    const ruleId = r.out.kind === 'business' && key !== undefined ? ruleCluster.get(key) ?? null : null;
    model(r.out.enforcedBy, 'enforcesRule', {
      statement: r.out.statement, subject: r.out.subject, operator: r.out.operator, threshold: r.out.threshold, unit: r.out.unit, kind: r.out.kind, ruleId,
    }, r, r.out.confidence);
  }
  // Pass (b): one fact per realizing class.
  const classIds = new Set(units.classes.map((c) => c.nodeId));
  for (const g of detail.groupSemantics) {
    for (const c of g.capabilities) {
      const key = capKeyOf.get(c);
      const capabilityId = key === undefined ? null : capCluster.get(key) ?? null;
      for (const cid of [...new Set(c.out.realizedBy)].sort()) {
        if (classIds.has(cid)) model(cid, 'realizesCapability', { capability: c.out.name, capabilityId }, c, c.out.confidence);
      }
    }
  }

  // Pass (d): adjudications (model) and exact-name merges (parser).
  const adjudicated = <M>(records: readonly AdjudicationRecord[], memberOf: (k: string) => M | undefined, subjectOf: (m: M) => string, evidenceOf: (m: M) => readonly GroundedEvidence[], predicate: 'sameConceptAs' | 'sameRuleAs'): void => {
    for (const rec of records) {
      const a = memberOf(rec.a);
      const b = memberOf(rec.b);
      const first = rec.answers[0];
      if (a === undefined || b === undefined || first === undefined) continue;
      const [sa, sb] = [subjectOf(a), subjectOf(b)];
      if (sa === sb) continue;
      const agreement: Agreement = rec.answers.length >= 2 && rec.answers.every((x) => x.same === first.same) ? 'agreed' : 'single-run';
      model(sa, predicate, { other: sb, same: rec.merged }, { provenance: first.provenance, agreement, runIndex: first.runIndex, evidence: dedupEvidence([...evidenceOf(a), ...evidenceOf(b)]) }, first.confidence);
    }
  };
  const exactMerges = <M>(clusters: readonly (readonly string[])[], memberOf: (k: string) => M | undefined, textOf: (m: M) => string, subjectOf: (m: M) => string, predicate: 'sameConceptAs' | 'sameRuleAs'): void => {
    for (const keys of clusters) {
      const byName = new Map<string, M[]>();
      for (const k of keys) {
        const m = memberOf(k);
        if (m !== undefined) byName.set(normName(textOf(m)), [...(byName.get(normName(textOf(m))) ?? []), m]);
      }
      for (const group of byName.values()) {
        const head = group[0];
        if (head === undefined) continue;
        for (const m of group.slice(1)) if (subjectOf(m) !== subjectOf(head)) parser(subjectOf(head), predicate, { other: subjectOf(m), same: true }, 'apg');
      }
    }
  };
  const concept = (k: string): ConceptMember | undefined => detail.clusterItems.concepts.get(k);
  const rule = (k: string): RuleSite | undefined => detail.clusterItems.rules.get(k);
  adjudicated(detail.clusters.concepts.adjudications, concept, (m) => m.cls.nodeId, (m) => m.c.evidence, 'sameConceptAs');
  adjudicated(detail.clusters.rules.adjudications, rule, (m) => m.rule.out.enforcedBy, (m) => m.rule.evidence, 'sameRuleAs');
  exactMerges(detail.clusters.concepts.clusters, concept, (m) => m.c.out.name, (m) => m.cls.nodeId, 'sameConceptAs');
  exactMerges(detail.clusters.rules.clusters, rule, (m) => m.rule.out.statement, (m) => m.rule.out.enforcedBy, 'sameRuleAs');

  // The verifier on every cross-context pair of one business-rule cluster (not only the adjudicated pairs).
  const methodNames = new Map<string, { className: string; methodName: string }>();
  for (const c of units.classes) for (const m of c.methods) methodNames.set(m.nodeId, { className: c.name, methodName: m.name });
  for (const keys of detail.clusters.rules.clusters) {
    const members = keys.map(rule).filter((r): r is RuleSite => r !== undefined);
    const ctxOf = new Map(members.map((m) => [m.rule.out.enforcedBy, m.cls.component]));
    const sites = [...ctxOf.keys()].sort(hostIndependentCompare);
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        const [m1, m2] = [sites[i] ?? '', sites[j] ?? ''];
        if (ctxOf.get(m1) === ctxOf.get(m2)) continue;
        const ver = verifyRuleDuplication([m1, m2], units.methodDecls, input.cheap, methodNames, detail.decimalScaleMaxPower);
        parser(m1, 'ruleEquivalenceVerified', { other: m2, verified: ver.verified, method: ver.method }, 'verifier');
      }
    }
  }

  const file: FactsFile = {
    schemaVersion: 1,
    artifact: 'A2',
    project: { id: opts.projectId, contentHash: projectHash(input.apg, read), commit: null },
    inputs: {
      a1: { apgHash: sha256Hex(canonicalJSON(input.apg)) },
      layerModel: { path: opts.layerModelPath, hash: input.layerModel === undefined ? null : sha256Hex(canonicalJSON(input.layerModel)) },
    },
    producer: {
      part: 'C1d', pipeline: 'ontology-v0', promptVersion: PROMPT_VERSION, provider: result.provider.provider, model: result.provider.model,
      runs: detail.runs, runId: result.runId, factPolicy: detail.factPolicy,
    },
    facts: [...facts.values()].sort(compareFacts),
  };
  validateFacts(file, input.apg);
  return file;
}
