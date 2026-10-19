/**
 * Ontology v0 model passes (a) responsibility, (b) capability and (c) rule extraction.
 *
 * Every item is asked `runs` times (default 2, run indices 0..runs-1), each answer is grounded assertion by
 * assertion, and the two runs are compared: an assertion of the primary run (run 0, else the first valid run) is
 * `agreed` when the other run has a matching one, `single-run` otherwise. Per pass, the mean per-item Jaccard of the
 * runs' accepted sets is reported.
 */
import { LAYER_KINDS } from '../../shared/types/enums.js';
import type { ModelCaller } from './caller.js';
import type { CitationRule, GroundingIndex, GroundingOutcome, ReferenceRule } from './grounding.js';
import {
  CAPABILITY_SCHEMA, ONTOLOGY_SYSTEM, RESPONSIBILITY_SCHEMA, RULE_SCHEMA, capabilityPrompt, responsibilityPrompt, rulePrompt,
} from './prompts.js';
import { jaccard, normName, tokens } from './text.js';
import type {
  Agreement, CapabilityOut, CapabilityPassOut, ConceptOut, GroundedEvidence, Hallucination, PassAgreement, PassId,
  ResponsibilityOut, ResponsibilityPassOut, RuleOut, RulePassOut, SemProvenance,
} from './types.js';
import type { ClassUnit, GroupUnit, OntologyUnits, RuleCandidateUnit } from './units.js';
import type { ProjectDoc } from './reading.js';

export interface Kept<T> {
  readonly itemId: string;
  readonly out: T;
  readonly evidence: readonly GroundedEvidence[];
  readonly provenance: SemProvenance;
  readonly agreement: Agreement;
  /** The primary run's index (run 0, else the first valid run): the run whose answer this assertion is. */
  readonly runIndex: number;
}

export class AgreementTally {
  private items = 0;
  private jaccardSum = 0;
  private agreed = 0;
  private total = 0;

  add(j: number | null, agreed: number, total: number): void {
    if (j !== null) {
      this.items++;
      this.jaccardSum += j;
    }
    this.agreed += agreed;
    this.total += total;
  }

  result(): PassAgreement {
    return { items: this.items, meanJaccard: this.items === 0 ? null : this.jaccardSum / this.items, agreedAssertions: this.agreed, totalAssertions: this.total };
  }
}

export interface PassContext {
  readonly caller: ModelCaller;
  readonly index: GroundingIndex;
  readonly runs: number;
  readonly hallucinations: Hallucination[];
  readonly accepted: Record<PassId, number>;
  readonly tallies: Record<PassId, AgreementTally>;
}

interface Run<TOut> {
  readonly value: TOut;
  readonly provenance: SemProvenance;
  readonly runIndex: number;
}

async function callRuns<TOut>(p: PassContext, pass: PassId, itemId: string, itemName: string, prompt: string, schema: Readonly<Record<string, unknown>>): Promise<(Run<TOut> | null)[]> {
  const out: (Run<TOut> | null)[] = [];
  for (let runIndex = 0; runIndex < p.runs; runIndex++) {
    const r = await p.caller.call<TOut>({ pass, itemId, itemName, runIndex, system: ONTOLOGY_SYSTEM, prompt, schema });
    out.push(r.kind === 'ok' ? { value: r.value, provenance: r.provenance, runIndex } : null);
  }
  return out;
}

interface Grounded<T> {
  readonly a: T;
  readonly evidence: readonly GroundedEvidence[];
}

function groundAll<T>(p: PassContext, pass: PassId, itemId: string, runIndex: number, kind: Hallucination['assertionKind'], list: readonly T[], ground: (a: T) => GroundingOutcome, describe: (a: T) => string): Grounded<T>[] {
  const kept: Grounded<T>[] = [];
  for (const a of list) {
    const g = ground(a);
    if (g.ok) {
      kept.push({ a, evidence: g.evidence });
      p.accepted[pass]++;
    } else {
      p.hallucinations.push({ pass, itemId, runIndex, assertionKind: kind, assertion: describe(a), reasons: g.reasons });
    }
  }
  return kept;
}

/** Greedy one-to-one matching of the primary run against the others; returns the primary assertions with agreement. */
function agree<T>(p: PassContext, pass: PassId, itemId: string, runs: readonly ({ readonly kept: readonly Grounded<T>[]; readonly run: Run<unknown> } | null)[], same: (a: T, b: T) => boolean): Kept<T>[] {
  const valid = runs.filter((r): r is NonNullable<typeof r> => r !== null);
  const primary = valid[0];
  if (primary === undefined) return [];
  const other = valid[1];
  const used = new Set<number>();
  const result: Kept<T>[] = primary.kept.map((g) => {
    let agreement: Agreement = 'single-run';
    if (other !== undefined) {
      const j = other.kept.findIndex((o, i) => !used.has(i) && same(g.a, o.a));
      if (j >= 0) {
        used.add(j);
        agreement = 'agreed';
      }
    }
    return { itemId, out: g.a, evidence: g.evidence, provenance: primary.run.provenance, agreement, runIndex: primary.run.runIndex };
  });
  const agreed = result.filter((k) => k.agreement === 'agreed').length;
  const j = other === undefined ? null : primary.kept.length + other.kept.length === 0 ? 1 : agreed / (primary.kept.length + other.kept.length - agreed);
  p.tallies[pass].add(j, agreed, result.length);
  return result;
}

function spansOverlap(a: readonly { readonly file: string; readonly startLine: number; readonly endLine: number }[], b: readonly { readonly file: string; readonly startLine: number; readonly endLine: number }[]): boolean {
  return a.some((x) => b.some((y) => x.file === y.file && x.startLine <= y.endLine && y.startLine <= x.endLine));
}

function idsOf(cls: ClassUnit): Set<string> {
  return new Set([cls.nodeId, ...cls.methods.map((m) => m.nodeId)]);
}

// ── (a) responsibility pass ──────────────────────────────────────────────────────────────────────────────────────

export interface ClassSemantics {
  readonly cls: ClassUnit;
  readonly responsibilities: readonly Kept<ResponsibilityOut>[];
  readonly concepts: readonly Kept<ConceptOut>[];
}

export const sameResponsibility = (a: ResponsibilityOut, b: ResponsibilityOut): boolean =>
  a.naturalLayer === b.naturalLayer && (jaccard(tokens(a.name), tokens(b.name)) >= 0.34 || spansOverlap(a.evidence, b.evidence));

export const sameConcept = (a: ConceptOut, b: ConceptOut): boolean => a.relation === b.relation && normName(a.name) === normName(b.name);

export async function responsibilityPass(p: PassContext, units: OntologyUnits): Promise<ClassSemantics[]> {
  const out: ClassSemantics[] = [];
  for (const cls of units.classes) {
    const runs = await callRuns<ResponsibilityPassOut>(p, 'responsibility', cls.nodeId, cls.name, responsibilityPrompt(cls, units.docs), RESPONSIBILITY_SCHEMA);
    const rule: CitationRule = { types: ['Class', 'Method'], within: idsOf(cls) };
    const grounded = runs.map((r) => r === null ? null : {
      run: r,
      resp: groundAll(p, 'responsibility', cls.nodeId, r.runIndex, 'responsibility', r.value.responsibilities, (a) => p.index.ground(a.evidence, rule), (a) => `${cls.name}: ${a.name} [${a.naturalLayer}]`),
      conc: groundAll(p, 'responsibility', cls.nodeId, r.runIndex, 'concept', r.value.concepts, (a) => p.index.ground(a.evidence, rule), (a) => `${cls.name} ${a.relation} ${a.name}`),
    });
    const responsibilities = agree(p, 'responsibility', cls.nodeId, grounded.map((g) => g === null ? null : { run: g.run, kept: g.resp }), sameResponsibility);
    const concepts = agree(p, 'responsibility', cls.nodeId, grounded.map((g) => g === null ? null : { run: g.run, kept: g.conc }), sameConcept);
    out.push({ cls, responsibilities, concepts });
    if (p.caller.stopped !== null) break;
  }
  return out;
}

// ── (b) capability pass ──────────────────────────────────────────────────────────────────────────────────────────

export interface GroupSemantics {
  readonly group: GroupUnit;
  readonly capabilities: readonly Kept<CapabilityOut>[];
}

export const sameCapability = (a: CapabilityOut, b: CapabilityOut): boolean =>
  jaccard(tokens(a.name), tokens(b.name)) >= 0.5 || jaccard(a.realizedBy, b.realizedBy) === 1;

export async function capabilityPass(p: PassContext, units: OntologyUnits, classSem: readonly ClassSemantics[], requireAgreement: boolean): Promise<GroupSemantics[]> {
  const semOf = new Map(classSem.map((s) => [s.cls.nodeId, s]));
  const clsOf = new Map(units.classes.map((c) => [c.nodeId, c]));
  const out: GroupSemantics[] = [];
  for (const group of units.groups) {
    if (p.caller.stopped !== null) break;
    const members = group.classIds.flatMap((id) => {
      const cls = clsOf.get(id);
      if (cls === undefined) return [];
      const resp = (semOf.get(id)?.responsibilities ?? []).filter((r) => !requireAgreement || r.agreement === 'agreed').map((r) => r.out.name);
      return [{ cls, responsibilities: resp }];
    });
    const runs = await callRuns<CapabilityPassOut>(p, 'capability', group.id, group.id, capabilityPrompt(group, members, units.docs), CAPABILITY_SCHEMA);
    const within = new Set(members.flatMap(({ cls }) => [...idsOf(cls)]));
    const classIds: ReferenceRule = { types: ['Class'], within: new Set(group.classIds) };
    const grounded = runs.map((r) => r === null ? null : {
      run: r,
      kept: groundAll(p, 'capability', group.id, r.runIndex, 'capability', r.value.capabilities,
        (a) => p.index.ground(a.evidence, { types: ['Class', 'Method'], within }, (a.realizedBy.length > 0 ? a.realizedBy : ['']).map((id) => ({ id, rule: classIds }))),
        (a) => `${group.id}: ${a.name}`),
    });
    out.push({ group, capabilities: agree(p, 'capability', group.id, grounded, sameCapability) });
  }
  return out;
}

// ── (c) rule-extraction pass ─────────────────────────────────────────────────────────────────────────────────────

export interface RuleSite {
  readonly cls: ClassUnit;
  readonly rule: Kept<RuleOut>;
}

export const sameRule = (a: RuleOut, b: RuleOut): boolean =>
  a.enforcedBy === b.enforcedBy && a.operator === b.operator && a.threshold === b.threshold;

export async function rulePass(p: PassContext, candidates: readonly RuleCandidateUnit[], docs: readonly ProjectDoc[] = []): Promise<RuleSite[]> {
  const out: RuleSite[] = [];
  for (const { cls, methods } of candidates) {
    if (p.caller.stopped !== null) break;
    const runs = await callRuns<RulePassOut>(p, 'rules', cls.nodeId, cls.name, rulePrompt(cls, methods, docs), RULE_SCHEMA);
    const within = idsOf(cls);
    const enforcer: ReferenceRule = { types: ['Method'], within: new Set(methods.map((m) => m.nodeId)) };
    const grounded = runs.map((r) => r === null ? null : {
      run: r,
      kept: groundAll(p, 'rules', cls.nodeId, r.runIndex, 'rule', r.value.rules,
        (a) => p.index.ground(a.evidence, { types: ['Class', 'Method'], within }, [{ id: a.enforcedBy, rule: enforcer }]),
        (a) => `${cls.name}: ${a.statement}`),
    });
    for (const rule of agree(p, 'rules', cls.nodeId, grounded, sameRule)) out.push({ cls, rule });
  }
  return out;
}

/** True when `kind` is one of the four layer kinds (guards model output used as a layer). */
export function isLayerKind(kind: string): kind is (typeof LAYER_KINDS)[number] {
  return (LAYER_KINDS as readonly string[]).includes(kind);
}
