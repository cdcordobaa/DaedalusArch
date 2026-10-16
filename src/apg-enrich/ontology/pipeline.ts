/**
 * Ontology v0 pipeline: (a) responsibilities and concepts per class, (b) capabilities per component and community,
 * (c) business rules at the cheap proxies' candidate sites, (d) clustering across components with model adjudication
 * of the candidate pairs; then deterministic verification, derived findings and the Sem graph.
 *
 * The APG and the cheap enrichment are inputs only. Design: `Docs/v1.3/ontology-v0-design.md`.
 */
import * as path from 'node:path';
import type { Project } from 'ts-morph';
import { canonicalJSON, sha256Hex } from '../../llm-critic/canonical-json.js';
import type { APGResult } from '../../shared/types/apg.js';
import type { LayerModel } from '../../shared/types/spec.js';
import { buildContext } from '../cheap/context.js';
import { DEFAULT_CHEAP_OPTIONS } from '../cheap/types.js';
import type { CheapEnrichment } from '../cheap/types.js';
import type { CacheMode } from './cache.js';
import { OntologyCache } from './cache.js';
import { ModelCaller } from './caller.js';
import { cluster } from './clustering.js';
import type { ClusterItem, ClusterResult } from './clustering.js';
import { diskReader, GroundingIndex } from './grounding.js';
import type { FileReader } from './grounding.js';
import { AgreementTally, capabilityPass, isLayerKind, responsibilityPass, rulePass } from './passes.js';
import type { ClassSemantics, GroupSemantics, Kept, PassContext, RuleSite } from './passes.js';
import {
  ONTOLOGY_SYSTEM, PROMPT_VERSION, RESPONSIBILITY_SCHEMA, RULE_SCHEMA, capabilityPrompt, responsibilityPrompt, rulePrompt,
} from './prompts.js';
import type { OntologyProvider } from './provider.js';
import { jaccard } from './text.js';
import type {
  Agreement, CodeSite, ConceptOut, GroundedEvidence, Hallucination, OntologyFinding, OntologyResult, PassId, SemEdge,
  SemNode, SemProvenance,
} from './types.js';
import { PASS_IDS } from './types.js';
import { buildUnits } from './units.js';
import type { ClassUnit, OntologyUnits } from './units.js';
import { verifyRuleDuplication } from './verify.js';

export interface OntologyInput {
  readonly apg: APGResult;
  readonly project: Project;
  readonly projectRoot: string;
  readonly cheap: CheapEnrichment;
  readonly layerModel?: LayerModel;
  /** Reads a project file (default: from disk under `projectRoot`). */
  readonly readFile?: FileReader;
}

export interface OntologyOptions {
  readonly provider: OntologyProvider;
  readonly cacheMode: CacheMode;
  readonly cacheDir: string | null;
  /** Provider calls allowed for this project (cache hits are free). */
  readonly budget: number;
  /** Runs per item (agreement is reported between run 0 and run 1). */
  readonly runs: number;
  /** Cheap logic density at or above which a method is a rule candidate. */
  readonly ruleMinDensity: number;
  /** Candidate pairs adjudicated by the model at most. */
  readonly maxAdjudicationPairs: number;
  /** Use only assertions both runs agree on for capabilities and findings. */
  readonly requireAgreement: boolean;
  /** Differently-named defining classes for concept fragmentation. */
  readonly minFragmentClasses: number;
  /** Components a capability must span to be scattered. */
  readonly scatterMinComponents: number;
  /** Largest power of ten two thresholds may differ by and still match (`50` and `5000` with 2). */
  readonly decimalScaleMaxPower: number;
  readonly runId?: string;
  readonly omitPrompts?: boolean;
  readonly now?: () => string;
}

export const DEFAULT_ONTOLOGY_OPTIONS = Object.freeze({
  cacheMode: 'off',
  cacheDir: null,
  budget: 200,
  runs: 2,
  ruleMinDensity: 1,
  maxAdjudicationPairs: 40,
  requireAgreement: true,
  minFragmentClasses: 3,
  scatterMinComponents: 3,
  decimalScaleMaxPower: 3,
});

export type OntologyOptionsInput = Partial<OntologyOptions> & { readonly provider: OntologyProvider };

function resolveOptions(o: OntologyOptionsInput): OntologyOptions {
  return { ...DEFAULT_ONTOLOGY_OPTIONS, ...o };
}

/** Content hash of the project's files (APG File nodes), for the default run id. */
function projectHash(apg: APGResult, read: FileReader): string {
  const files = apg.nodes.filter((n) => n.type === 'File').map((n) => n.filePath).sort();
  return sha256Hex(canonicalJSON(files.map((f) => [f, sha256Hex(read(f) ?? '')])));
}

function semId(label: string, parts: unknown): string {
  return `sem:${label}:${sha256Hex(canonicalJSON(parts)).slice(0, 16)}`;
}

function site(cls: ClassUnit, methodId?: string): CodeSite {
  const m = methodId === undefined ? undefined : cls.methods.find((x) => x.nodeId === methodId);
  return { nodeId: m?.nodeId ?? cls.nodeId, file: cls.file, className: cls.name, ...(m !== undefined ? { methodName: m.name } : {}), component: cls.component };
}

function mergeAgreement(list: readonly { readonly agreement: Agreement }[]): Agreement {
  return list.every((k) => k.agreement === 'agreed') ? 'agreed' : 'single-run';
}

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function dedupEvidence(list: readonly GroundedEvidence[]): GroundedEvidence[] {
  const seen = new Set<string>();
  return list.filter((e) => {
    const k = `${e.nodeId}|${e.file}|${String(e.startLine)}|${String(e.endLine)}|${e.quote}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function newPassContext(caller: ModelCaller, index: GroundingIndex, runs: number): PassContext {
  const accepted = Object.fromEntries(PASS_IDS.map((p) => [p, 0])) as Record<PassId, number>;
  const tallies = Object.fromEntries(PASS_IDS.map((p) => [p, new AgreementTally()])) as Record<PassId, AgreementTally>;
  return { caller, index, runs, hallucinations: [] as Hallucination[], accepted, tallies };
}

interface Prepared {
  readonly units: OntologyUnits;
  readonly index: GroundingIndex;
  readonly runId: string;
  readonly caller: ModelCaller;
  readonly options: OntologyOptions;
}

function prepare(input: OntologyInput, o: OntologyOptionsInput): Prepared {
  const options = resolveOptions(o);
  const root = path.resolve(input.projectRoot);
  const ctx = buildContext({ apg: input.apg, project: input.project, projectRoot: root, ...(input.layerModel !== undefined ? { layerModel: input.layerModel } : {}) }, DEFAULT_CHEAP_OPTIONS);
  const units = buildUnits(ctx, input.cheap, { ruleMinDensity: options.ruleMinDensity });
  const read = input.readFile ?? diskReader(root);
  const index = new GroundingIndex(input.apg, units.nodeSpans, read);
  const d = options.provider.describe();
  const runId = options.runId ?? `ontology-v0-${sha256Hex(canonicalJSON({ project: projectHash(input.apg, read), provider: d.provider, model: d.model, promptVersion: PROMPT_VERSION, runs: options.runs })).slice(0, 12)}`;
  const caller = new ModelCaller({
    provider: options.provider,
    cache: new OntologyCache(options.cacheMode, options.cacheDir),
    budget: options.budget,
    runId,
    promptVersion: PROMPT_VERSION,
    ...(options.omitPrompts !== undefined ? { omitPrompts: options.omitPrompts } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  return { units, index, runId, caller, options };
}

// ── Estimate ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface OntologyEstimate {
  readonly runs: number;
  readonly classes: number;
  readonly groups: number;
  readonly ruleCandidateClasses: number;
  /** Calls per pass; capability and adjudication are upper bounds (their prompts depend on earlier answers). */
  readonly calls: Readonly<Record<PassId, number>>;
  /** Of the responsibility and rule calls, those already in the cache. */
  readonly cachedKnown: number;
  readonly totalUpperBound: number;
  /** Prompt tokens of passes (a) and (c) at 4 characters per token (input side only). */
  readonly promptTokensKnown: number;
  readonly budget: number;
  readonly withinBudget: boolean;
}

/** Counts the calls a run would make, without calling any provider. */
export function estimateOntology(input: OntologyInput, o: OntologyOptionsInput): OntologyEstimate {
  const { units, caller, options } = prepare(input, o);
  let cachedKnown = 0;
  let chars = 0;
  const known: { prompt: string; pass: PassId; schema: Readonly<Record<string, unknown>> }[] = [
    ...units.classes.map((c) => ({ prompt: responsibilityPrompt(c), pass: 'responsibility' as const, schema: RESPONSIBILITY_SCHEMA })),
    ...units.ruleCandidates.map((r) => ({ prompt: rulePrompt(r.cls, r.methods), pass: 'rules' as const, schema: RULE_SCHEMA })),
  ];
  for (const k of known) {
    chars += (k.prompt.length + ONTOLOGY_SYSTEM.length) * options.runs;
    for (let runIndex = 0; runIndex < options.runs; runIndex++) {
      if (caller.isCached({ pass: k.pass, itemId: '', runIndex, system: ONTOLOGY_SYSTEM, prompt: k.prompt, schema: k.schema })) cachedKnown++;
    }
  }
  // The capability prompt's size does not depend on the answers much: count it with empty responsibilities.
  for (const g of units.groups) {
    const members = g.classIds.flatMap((id) => units.classes.filter((c) => c.nodeId === id)).map((cls) => ({ cls, responsibilities: [] }));
    chars += (capabilityPrompt(g, members).length + ONTOLOGY_SYSTEM.length) * options.runs;
  }
  const calls: Record<PassId, number> = {
    responsibility: units.classes.length * options.runs,
    capability: units.groups.length * options.runs,
    rules: units.ruleCandidates.length * options.runs,
    adjudicate: options.maxAdjudicationPairs * options.runs,
  };
  const totalUpperBound = calls.responsibility + calls.capability + calls.rules + calls.adjudicate;
  return {
    runs: options.runs, classes: units.classes.length, groups: units.groups.length, ruleCandidateClasses: units.ruleCandidates.length,
    calls, cachedKnown, totalUpperBound, promptTokensKnown: Math.ceil(chars / 4), budget: options.budget,
    withinBudget: totalUpperBound - cachedKnown <= options.budget,
  };
}

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface OntologyRunDetail {
  readonly result: OntologyResult;
  readonly classSemantics: readonly ClassSemantics[];
  readonly groupSemantics: readonly GroupSemantics[];
  readonly ruleSites: readonly RuleSite[];
  readonly clusters: { readonly rules: ClusterResult; readonly concepts: ClusterResult; readonly capabilities: ClusterResult };
}

export async function runOntology(input: OntologyInput, o: OntologyOptionsInput): Promise<OntologyRunDetail> {
  const { units, index, runId, caller, options } = prepare(input, o);
  const p = newPassContext(caller, index, options.runs);
  const keep = (k: { readonly agreement: Agreement }): boolean => !options.requireAgreement || k.agreement === 'agreed';

  const classSemantics = await responsibilityPass(p, units);
  const groupSemantics = caller.stopped === null ? await capabilityPass(p, units, classSemantics, options.requireAgreement) : [];
  const ruleSites = caller.stopped === null ? await rulePass(p, units.ruleCandidates) : [];

  const clsById = new Map(units.classes.map((c) => [c.nodeId, c]));
  // Rules
  const ruleItems: ClusterItem[] = [];
  const ruleByKey = new Map<string, RuleSite>();
  ruleSites.filter((r) => keep(r.rule)).forEach((r, i) => {
    const key = `rule:${String(i).padStart(4, '0')}:${r.rule.out.enforcedBy}`;
    ruleByKey.set(key, r);
    ruleItems.push({
      key, kind: 'rule', component: r.cls.component, text: r.rule.out.statement,
      where: `${r.cls.file} ${site(r.cls, r.rule.out.enforcedBy).methodName ?? r.cls.name} (component ${r.cls.component})`,
      quotes: r.rule.evidence.map((e) => e.quote),
      rule: { subject: r.rule.out.subject, operator: r.rule.out.operator, threshold: r.rule.out.threshold },
    });
  });
  // Concepts
  const conceptItems: ClusterItem[] = [];
  const conceptByKey = new Map<string, { cls: ClassUnit; c: Kept<ConceptOut> }>();
  for (const s of classSemantics) {
    s.concepts.filter(keep).forEach((c, i) => {
      const key = `concept:${s.cls.nodeId}:${String(i)}`;
      conceptByKey.set(key, { cls: s.cls, c });
      conceptItems.push({
        key, kind: 'concept', component: s.cls.component, text: c.out.name, where: `${s.cls.name} (${c.out.relation}), ${s.cls.file}, component ${s.cls.component}`,
        quotes: c.evidence.map((e) => e.quote), ...(c.out.relation === 'defines' ? { fields: s.cls.fields } : {}),
      });
    });
  }
  // Capabilities
  const capItems: ClusterItem[] = [];
  const capByKey = new Map<string, GroupSemantics['capabilities'][number]>();
  for (const g of groupSemantics) {
    g.capabilities.filter(keep).forEach((c, i) => {
      const key = `capability:${g.group.id}:${String(i)}`;
      capByKey.set(key, c);
      capItems.push({ key, kind: 'capability', component: g.group.id, text: c.out.name, where: g.group.id, quotes: c.evidence.map((e) => e.quote) });
    });
  }

  const clusterOpts = { maxPairs: options.maxAdjudicationPairs, decimalScaleMaxPower: options.decimalScaleMaxPower };
  const rules = await cluster(p, ruleItems, clusterOpts);
  const concepts = await cluster(p, conceptItems, { ...clusterOpts, maxPairs: Math.max(0, options.maxAdjudicationPairs - rules.adjudications.length) });
  const capabilities = await cluster(p, capItems, { ...clusterOpts, maxPairs: Math.max(0, options.maxAdjudicationPairs - rules.adjudications.length - concepts.adjudications.length) });

  const nodes: SemNode[] = [];
  const edges: SemEdge[] = [];
  const findings: OntologyFinding[] = [];
  const edge = (type: SemEdge['type'], sourceId: string, targetId: string, src: { provenance: SemProvenance; agreement: Agreement; evidence: readonly GroundedEvidence[]; confidence: number }, properties: Record<string, unknown> = {}): void => {
    edges.push({ id: semId(type, [sourceId, targetId, properties]), type, sourceId, targetId, properties, provenance: src.provenance, confidence: src.confidence, evidence: src.evidence, agreement: src.agreement });
  };

  // Responsibilities, SemRESPONSIBLE_FOR, SemMISPLACED_IN, misplaced findings
  for (const s of classSemantics) {
    for (const r of s.responsibilities) {
      const id = semId('SemResponsibility', [s.cls.nodeId, r.out.name, r.out.naturalLayer]);
      const src = { provenance: r.provenance, agreement: r.agreement, evidence: r.evidence, confidence: r.out.confidence };
      nodes.push({ id, label: 'SemResponsibility', name: r.out.name, properties: { description: r.out.description, naturalLayer: r.out.naturalLayer, classId: s.cls.nodeId }, ...src });
      edge('SemRESPONSIBLE_FOR', s.cls.nodeId, id, src);
      const classLayer = s.cls.layerKind;
      if (classLayer === null || !isLayerKind(r.out.naturalLayer) || r.out.naturalLayer === classLayer) continue;
      edge('SemMISPLACED_IN', id, `layer:${r.out.naturalLayer}`, src, { classLayer, naturalLayer: r.out.naturalLayer });
      if (!keep(r)) continue;
      const methodIds = r.evidence.map((e) => e.nodeId).filter((nid) => s.cls.methods.some((m) => m.nodeId === nid));
      const densities = s.cls.methods.filter((m) => methodIds.includes(m.nodeId) && m.logicDensity !== null).map((m) => m.logicDensity ?? 0);
      findings.push({
        kind: 'misplaced-responsibility', responsibilityId: id, responsibility: r.out.name, site: site(s.cls, methodIds[0]),
        classLayer, naturalLayer: r.out.naturalLayer, citedLogicDensity: densities.length > 0 ? Math.max(...densities) : null, confidence: r.out.confidence,
      });
    }
  }

  // Business rules, SemENFORCES, rule duplication
  const methodNames = new Map<string, { className: string; methodName: string }>();
  for (const c of units.classes) for (const m of c.methods) methodNames.set(m.nodeId, { className: c.name, methodName: m.name });
  for (const keys of rules.clusters) {
    const members = keys.map((k) => ruleByKey.get(k)).filter((r): r is RuleSite => r !== undefined);
    const first = members[0];
    if (first === undefined) continue;
    const id = semId('SemBusinessRule', keys.map((k) => ruleByKey.get(k)?.rule.out.enforcedBy ?? k).sort());
    const conf = mean(members.map((m) => m.rule.out.confidence));
    nodes.push({
      id, label: 'SemBusinessRule', name: first.rule.out.statement,
      properties: { subject: first.rule.out.subject, operator: first.rule.out.operator, threshold: first.rule.out.threshold, unit: first.rule.out.unit, statements: members.map((m) => m.rule.out.statement) },
      provenance: first.rule.provenance, confidence: conf, evidence: dedupEvidence(members.flatMap((m) => m.rule.evidence)), agreement: mergeAgreement(members.map((m) => m.rule)),
    });
    for (const m of members) edge('SemENFORCES', m.rule.out.enforcedBy, id, { provenance: m.rule.provenance, agreement: m.rule.agreement, evidence: m.rule.evidence, confidence: m.rule.out.confidence });
    const components = [...new Set(members.map((m) => m.cls.component))].sort();
    if (components.length < 2) continue;
    const siteIds = [...new Set(members.map((m) => m.rule.out.enforcedBy))].sort();
    findings.push({
      kind: 'semantic-rule-duplication', ruleId: id, statement: first.rule.out.statement,
      sites: siteIds.map((mid) => {
        const owner = members.find((m) => m.rule.out.enforcedBy === mid);
        return owner === undefined ? { nodeId: mid, file: '', className: '', component: '' } : site(owner.cls, mid);
      }),
      components, verification: verifyRuleDuplication(siteIds, units.methodDecls, input.cheap, methodNames, options.decimalScaleMaxPower), confidence: conf,
    });
  }

  // Concepts, SemEMBODIES, fragmentation
  for (const keys of concepts.clusters) {
    const members = keys.map((k) => conceptByKey.get(k)).filter((m): m is { cls: ClassUnit; c: Kept<ConceptOut> } => m !== undefined);
    const first = members[0];
    if (first === undefined) continue;
    const id = semId('SemBusinessConcept', keys);
    const names = [...new Set(members.map((m) => m.c.out.name))].sort();
    const conf = mean(members.map((m) => m.c.out.confidence));
    nodes.push({ id, label: 'SemBusinessConcept', name: names[0] ?? first.c.out.name, properties: { names }, provenance: first.c.provenance, confidence: conf, evidence: dedupEvidence(members.flatMap((m) => m.c.evidence)), agreement: mergeAgreement(members.map((m) => m.c)) });
    for (const m of members) edge('SemEMBODIES', m.cls.nodeId, id, { provenance: m.c.provenance, agreement: m.c.agreement, evidence: m.c.evidence, confidence: m.c.out.confidence }, { relation: m.c.out.relation });
    const definers = [...new Map(members.filter((m) => m.c.out.relation === 'defines').map((m) => [m.cls.nodeId, m.cls])).values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    const distinctNames = new Set(definers.map((c) => c.name));
    const components = [...new Set(definers.map((c) => c.component))].sort();
    if (distinctNames.size < options.minFragmentClasses || components.length < 2) continue;
    const overlaps: number[] = [];
    for (let i = 0; i < definers.length; i++) for (let j = i + 1; j < definers.length; j++) overlaps.push(jaccard(definers[i]?.fields ?? [], definers[j]?.fields ?? []));
    findings.push({ kind: 'concept-fragmentation', conceptId: id, concept: names[0] ?? '', classes: definers.map((c) => site(c)), components, fieldOverlap: mean(overlaps), confidence: conf });
  }

  // Capabilities, SemREALIZES, scatter
  for (const keys of capabilities.clusters) {
    const members = keys.map((k) => capByKey.get(k)).filter((c): c is NonNullable<typeof c> => c !== undefined);
    const first = members[0];
    if (first === undefined) continue;
    const id = semId('SemCapability', keys);
    const conf = mean(members.map((m) => m.out.confidence));
    const names = [...new Set(members.map((m) => m.out.name))].sort();
    nodes.push({ id, label: 'SemCapability', name: first.out.name, properties: { description: first.out.description, names, groups: [...new Set(members.map((m) => m.itemId))].sort() }, provenance: first.provenance, confidence: conf, evidence: dedupEvidence(members.flatMap((m) => m.evidence)), agreement: mergeAgreement(members) });
    const realizers = new Map<string, ClassUnit>();
    for (const m of members) {
      for (const cid of [...new Set(m.out.realizedBy)].sort()) {
        const cls = clsById.get(cid);
        if (cls === undefined) continue;
        if (!realizers.has(cid)) edge('SemREALIZES', cid, id, { provenance: m.provenance, agreement: m.agreement, evidence: m.evidence, confidence: m.out.confidence });
        realizers.set(cid, cls);
      }
    }
    const components = [...new Set([...realizers.values()].map((c) => c.component))].sort();
    if (components.length >= options.scatterMinComponents) {
      findings.push({ kind: 'capability-scatter', capabilityId: id, capability: first.out.name, classes: [...realizers.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId)).map((c) => site(c)), components, confidence: conf });
    }
  }

  const byId = <T extends { readonly id: string }>(a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const findingKey = (f: OntologyFinding): string => `${f.kind}|${canonicalJSON(f)}`;
  const d = options.provider.describe();
  const result: OntologyResult = {
    runId,
    provider: { provider: d.provider, model: d.model },
    nodes: [...new Map(nodes.map((n) => [n.id, n])).values()].sort(byId),
    edges: [...new Map(edges.map((e) => [e.id, e])).values()].sort(byId),
    findings: findings.sort((a, b) => findingKey(a).localeCompare(findingKey(b))),
    hallucinations: p.hallucinations,
    acceptedAssertions: p.accepted,
    agreement: Object.fromEntries(PASS_IDS.map((id) => [id, p.tallies[id].result()])) as OntologyResult['agreement'],
    calls: caller.stats(),
    budget: options.budget,
    stopped: caller.stopped,
  };
  return { result, classSemantics, groupSemantics, ruleSites, clusters: { rules, concepts, capabilities } };
}
