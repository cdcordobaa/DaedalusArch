/**
 * Data model of the architect HTML report (`evaluate --html`): the evaluation report, read with the v1.3 rule tiers,
 * the spec's layers and the file-level import graph. Pure and deterministic: the same inputs give the same model.
 */
import type { EvaluationReport } from '../../shared/types/evaluation.js';
import type { ParsedSpec } from '../../shared/types/spec.js';
import type { APGResult } from '../../shared/types/apg.js';
import type { Violation } from '../../shared/taxonomy/violation-types.js';
import { isResolvedReExportEdge } from '../../shared/apg-edge-view.js';
import { CONSTRUCT_ANSWERS } from '../../shared/construct-switches.js';
import { constructTierResolver } from '../../construct-switches/pipeline.js';
import { cycleFiles, fileLayerAssigner, layerViewOf } from '../../construct-switches/layer-view.js';
import { ruleTier } from '../../scoring-engine/rule-tiers.js';
import type { RuleTier } from '../../scoring-engine/rule-tiers.js';
import { relTypeOf } from '../../scoring-engine/tiered-scoring.js';
import { formatActionableViolation } from '../actionable-formatter.js';
import { SourceReader } from './excerpt.js';
import type { CodeExcerpt } from './excerpt.js';
import { TIER_EXPLANATIONS, TIER_LABELS, plainRule, withoutRuleIds } from './rule-text.js';
import type { DisplayTier } from './rule-text.js';

/** The file-level import graph the layer diagram needs (project-relative paths). */
export interface ArchitectGraphInput {
  readonly files: readonly string[];
  /** Distinct `[from, to]` file imports. */
  readonly imports: readonly (readonly [string, string])[];
}

export interface ArchitectReportInput {
  readonly report: EvaluationReport;
  readonly spec: ParsedSpec;
  readonly graph?: ArchitectGraphInput;
  /** Root the code excerpts are read from; without it the report has no excerpts. */
  readonly projectRoot?: string;
  readonly projectName: string;
  readonly specPath: string;
}

export interface PathStep {
  readonly file: string;
  readonly layer: string | null;
  /** An imported package (e.g. `@nestjs/common`), not a project file; it belongs to no layer. */
  readonly external?: true;
}

export interface FindingModel {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleTitle: string;
  readonly ruleSays: string;
  readonly tier: DisplayTier;
  readonly tierLabel: string;
  readonly severity: string;
  readonly file: string;
  readonly line: number | null;
  readonly layers: readonly string[];
  readonly path: readonly PathStep[];
  readonly pathKind: 'import' | 'cycle' | 'file' | 'project';
  readonly message: string;
  readonly fixHint: string;
  readonly excerpt: CodeExcerpt | null;
}

export interface LayerBox {
  readonly name: string;
  readonly role: string;
  readonly directories: readonly string[];
  readonly fileCount: number;
  readonly findingCount: number;
  readonly definingCount: number;
  /** Dependency findings (an import or a cycle) whose whole path stays inside this layer. */
  readonly internalFindings: number;
}

export interface LayerEdge {
  readonly from: string;
  readonly to: string;
  readonly imports: number;
  /** Whether the spec allows `from` to depend on `to`; null when a side is not a declared layer. */
  readonly allowed: boolean | null;
  readonly findings: number;
  readonly defining: number;
}

export interface BlockerRow {
  readonly ruleId: string;
  readonly title: string;
  readonly says: string;
  readonly count: number;
}

export interface SummaryModel {
  readonly scoringMode: 'v1.3' | 'v1.2e';
  /** `incomplete` (v1.3 only): nothing broken, but a defining rule could not run, so the verdict is not a pass. */
  readonly verdict: 'pass' | 'fail' | 'incomplete';
  readonly headline: string;
  readonly explanation: readonly string[];
  readonly blockers: readonly BlockerRow[];
  readonly notExecuted: readonly { readonly ruleId: string; readonly title: string }[];
  /** Score over the defining rules only (v1.3); null when none ran or in the v1.2e mode. */
  readonly definingScore: number | null;
  /** The overall (deterministic) health score. */
  readonly overallScore: number | null;
  readonly counts: Readonly<Record<DisplayTier, number>>;
  readonly rulesChecked: number;
}

export interface ArchitectReportModel {
  readonly meta: {
    readonly projectName: string;
    readonly specPath: string;
    readonly runId: string;
    readonly evaluationMode: string;
    readonly style: string | null;
  };
  readonly summary: SummaryModel;
  readonly layers: readonly LayerBox[];
  readonly edges: readonly LayerEdge[];
  readonly findings: readonly FindingModel[];
  readonly tierLabels: Readonly<Record<DisplayTier, string>>;
  readonly tierExplanations: Readonly<Record<DisplayTier, string>>;
}

const UNASSIGNED = '(no layer)';
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/** The steps of a path that are project files (imported packages left out). */
const projectSteps = (path: readonly PathStep[]): readonly PathStep[] => path.filter((p) => p.external !== true);
const TIER_ORDER: Readonly<Record<DisplayTier, number>> = { defining: 0, warning: 1, 'not-counted': 2 };

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The architect graph input of an APG: File nodes and their literal IMPORTS edges, sorted and deduplicated. */
export function graphInputFromApg(apg: APGResult): ArchitectGraphInput {
  const fileOf = new Map<string, string>();
  for (const n of apg.nodes) if (n.type === 'File') fileOf.set(n.id, n.filePath);
  const pairs = new Set<string>();
  const imports: [string, string][] = [];
  for (const e of apg.edges) {
    if (e.type !== 'IMPORTS' || isResolvedReExportEdge(e)) continue;
    const from = fileOf.get(e.sourceId);
    const to = fileOf.get(e.targetId);
    if (from === undefined || to === undefined || from === to) continue;
    const key = `${from}\n${to}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    imports.push([from, to]);
  }
  imports.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
  return { files: [...new Set(fileOf.values())].sort(cmp), imports };
}

/** The finding's path: an import edge, a cycle (closed), or the file alone. */
function pathOf(v: Violation, layerOf: (f: string) => string | null): { path: PathStep[]; kind: FindingModel['pathKind']; file: string } {
  const step = (file: string): PathStep => (SOURCE_FILE.test(file) ? { file, layer: layerOf(file) } : { file, layer: null, external: true });
  // Project-wide rows (a metric over the whole project) carry a pseudo path such as `<project>`.
  if (/^<[^>]*>$/.test(v.filePath.trim())) return { path: [], kind: 'project', file: v.filePath.trim() };
  if (v.type === 'CYCLIC_DEPENDENCY' || v.filePath.includes(',')) {
    const files = v.filePath.split(',').map((s) => s.trim()).filter((s) => s !== '');
    const ring = files.length > 1 ? files : cycleFiles(v.filePath, v.target);
    const closed = ring.length > 1 && ring[0] !== ring[ring.length - 1] ? [...ring, ring[0] ?? ''] : ring;
    return { path: closed.map(step), kind: 'cycle', file: closed[0] ?? v.filePath };
  }
  if (v.target !== undefined && v.target !== '' && v.target !== v.filePath && !v.target.includes(',')) {
    return { path: [step(v.filePath), step(v.target)], kind: 'import', file: v.filePath };
  }
  return { path: [step(v.filePath)], kind: 'file', file: v.filePath };
}

/** Tier of one violation under the v1.3 tiers the scoring used (construct switches included). */
function tierClassifier(spec: ParsedSpec): (v: Violation) => DisplayTier {
  const resolver = constructTierResolver(CONSTRUCT_ANSWERS, spec.style, spec.layerModel);
  const ruleOf = resolver?.rule ?? ruleTier;
  return (v) => {
    const id = String(v.functionId);
    const resolved = ruleOf(id, spec.style);
    const partial = resolved.entry?.partial;
    if (partial !== undefined && v.route !== 'neuronal' && partial.naRelTypes.includes(relTypeOf(v) ?? '')) return 'not-counted';
    const row: RuleTier | undefined = resolver?.row?.tierOf(id, v);
    return (row ?? resolved.tier) === 'blocking' ? 'defining' : 'warning';
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function buildArchitectModel(input: ArchitectReportInput): ArchitectReportModel {
  const { report, spec } = input;
  const layerOf = fileLayerAssigner(spec.layerModel);
  const view = layerViewOf(spec.layerModel);
  const tierOf = tierClassifier(spec);
  const reader = new SourceReader(input.projectRoot);
  const fnName = new Map(spec.fitnessFunctions.map((f) => [String(f.id), f.name]));

  // ── Findings ──
  const findings: FindingModel[] = report.violations.map((v) => {
    const id = String(v.functionId);
    const actionable = formatActionableViolation(v, spec.fitnessFunctions);
    const fallbackSays = actionable.why.replace(/\s*\([^()]*→[^()]*\)$/, '');
    const rule = plainRule(id, fnName.get(id), fallbackSays);
    const tier = tierOf(v);
    const { path, kind, file } = pathOf(v, layerOf);
    const hits = v.lines !== undefined && v.lines.length > 0 ? v.lines : v.line !== undefined ? [v.line] : [];
    const layers = [...new Set([
      ...projectSteps(path).map((p) => p.layer ?? UNASSIGNED),
      ...(v.sourceLayer !== undefined ? [v.sourceLayer] : []),
      ...(v.targetLayer !== undefined ? [v.targetLayer] : []),
    ])].sort(cmp);
    return {
      id: v.id,
      ruleId: id,
      ruleTitle: rule.title,
      ruleSays: rule.says,
      tier,
      tierLabel: TIER_LABELS[tier],
      severity: v.severity,
      file,
      line: hits[0] ?? null,
      layers,
      path,
      pathKind: kind,
      message: withoutRuleIds(v.message),
      fixHint: actionable.fix,
      excerpt: hits.length > 0 ? reader.excerpt(file, hits) : null,
    };
  });
  findings.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || cmp(a.ruleTitle, b.ruleTitle)
    || cmp(a.file, b.file) || (a.line ?? 0) - (b.line ?? 0) || cmp(a.id, b.id));

  // ── Layers and layer edges ──
  const declared = view.order;
  const fileCounts = new Map<string, number>();
  for (const f of input.graph?.files ?? []) {
    const l = layerOf(f) ?? UNASSIGNED;
    fileCounts.set(l, (fileCounts.get(l) ?? 0) + 1);
  }
  const edgeKey = (a: string, b: string): string => `${a}\n${b}`;
  const edgeAcc = new Map<string, { from: string; to: string; imports: number; findings: number; defining: number }>();
  const edgeOf = (from: string, to: string): { from: string; to: string; imports: number; findings: number; defining: number } => {
    const k = edgeKey(from, to);
    let e = edgeAcc.get(k);
    if (e === undefined) {
      e = { from, to, imports: 0, findings: 0, defining: 0 };
      edgeAcc.set(k, e);
    }
    return e;
  };
  for (const [a, b] of input.graph?.imports ?? []) {
    const la = layerOf(a) ?? UNASSIGNED;
    const lb = layerOf(b) ?? UNASSIGNED;
    if (la !== lb) edgeOf(la, lb).imports++;
  }
  const layerFindings = new Map<string, { all: number; defining: number; internal: number }>();
  const bump = (l: string, f: FindingModel, internal: boolean): void => {
    const c = layerFindings.get(l) ?? { all: 0, defining: 0, internal: 0 };
    c.all++;
    if (f.tier === 'defining') c.defining++;
    if (internal) c.internal++;
    layerFindings.set(l, c);
  };
  for (const f of findings) {
    const stepLayers = projectSteps(f.path).map((p) => p.layer ?? UNASSIGNED);
    const distinct = new Set(stepLayers);
    for (const l of distinct) bump(l, f, distinct.size === 1 && stepLayers.length > 1);
    const crossed = new Set<string>();
    for (let i = 0; i + 1 < stepLayers.length; i++) {
      const a = stepLayers[i] ?? UNASSIGNED;
      const b = stepLayers[i + 1] ?? UNASSIGNED;
      if (a === b || crossed.has(edgeKey(a, b))) continue;
      crossed.add(edgeKey(a, b));
      const e = edgeOf(a, b);
      e.findings++;
      if (f.tier === 'defining') e.defining++;
    }
  }
  const layerNames = [...declared];
  if ((fileCounts.get(UNASSIGNED) ?? 0) > 0 || layerFindings.has(UNASSIGNED)) layerNames.push(UNASSIGNED);
  const defs = new Map(spec.layerModel.layers.map((l) => [l.name, l]));
  const layers: LayerBox[] = layerNames.map((name) => {
    const def = defs.get(name);
    const c = layerFindings.get(name);
    return {
      name,
      role: def?.role ?? (name === UNASSIGNED ? 'files outside every declared layer' : ''),
      directories: def?.directories ?? [],
      fileCount: fileCounts.get(name) ?? 0,
      findingCount: c?.all ?? 0,
      definingCount: c?.defining ?? 0,
      internalFindings: c?.internal ?? 0,
    };
  });
  const isDeclared = (l: string): boolean => declared.includes(l);
  const edges: LayerEdge[] = [...edgeAcc.values()]
    .filter((e) => layerNames.includes(e.from) && layerNames.includes(e.to))
    .map((e) => ({ ...e, allowed: isDeclared(e.from) && isDeclared(e.to) ? view.allowed(e.from, e.to) : null }))
    .sort((a, b) => layerNames.indexOf(a.from) - layerNames.indexOf(b.from) || layerNames.indexOf(a.to) - layerNames.indexOf(b.to));

  // ── Summary ──
  const counts: Record<DisplayTier, number> = { defining: 0, warning: 0, 'not-counted': 0 };
  for (const f of findings) counts[f.tier]++;
  const titleOf = (id: string): string => plainRule(id, fnName.get(id), '').title;
  const saysOf = (id: string): string => plainRule(id, fnName.get(id), '').says;
  const tiers = report.tiers;
  const overallScore = report.ahsDeterministic !== undefined ? round3(Number(report.ahsDeterministic)) : null;
  let summary: SummaryModel;
  if (tiers !== undefined) {
    const blockers = tiers.blocking.rules.filter((r) => r.violated).map((r) => ({
      ruleId: String(r.functionId), title: titleOf(String(r.functionId)), says: saysOf(String(r.functionId)), count: r.violationCount,
    }));
    const notExecuted = tiers.blockingNotExecuted.map((id) => ({ ruleId: String(id), title: titleOf(String(id)) }));
    const fail = tiers.verdict === 'fail';
    const incomplete = tiers.verdict === 'incomplete';
    const n = blockers.length;
    const explanation = [
      fail
        ? `The verdict fails because ${String(n)} defining rule${n === 1 ? ' is' : 's are'} broken. Fixing every finding marked "${TIER_LABELS.defining}" turns it into a pass.`
        : incomplete
          ? 'The verdict is incomplete: no defining rule is broken, but at least one could not run, so the run cannot pass.'
          : 'The verdict passes: no defining rule is broken.',
      `Only defining rules can fail the verdict. Warnings (${String(counts.warning)} here) are listed for information and never fail it.`,
      'The scores are context: no score threshold is applied to the verdict.',
      ...(counts['not-counted'] > 0 ? [`${String(counts['not-counted'])} finding(s) belong to a part of a rule that is not applicable yet and are not counted.`] : []),
      ...(notExecuted.length > 0 ? [`${String(notExecuted.length)} defining rule(s) could not run, so they could neither pass nor fail: ${notExecuted.map((r) => r.title).join(', ')}.`] : []),
    ];
    summary = {
      scoringMode: 'v1.3',
      verdict: tiers.verdict,
      headline: fail ? 'Fails: defining rules are broken' : incomplete ? 'Incomplete: a defining rule could not run' : 'Passes: no defining rule is broken',
      explanation,
      blockers,
      notExecuted,
      definingScore: tiers.blockingAhs === null ? null : round3(tiers.blockingAhs),
      overallScore,
      counts,
      rulesChecked: tiers.blocking.rules.length + tiers.advisory.rules.length,
    };
  } else {
    const fail = report.verdict === 'soft-block' || report.verdict === 'hard-block';
    summary = {
      scoringMode: 'v1.2e',
      verdict: fail ? 'fail' : 'pass',
      headline: fail ? `Fails (${report.verdict}) on the overall score` : `Passes (${report.verdict}) on the overall score`,
      explanation: [
        'This run used the v1.2e scoring: the verdict comes from the overall score and the spec\'s thresholds, not from rule tiers.',
        'Tiers are shown for reference. Run with the default v1.3 scoring to get a verdict that only defining rules can fail.',
      ],
      blockers: [],
      notExecuted: [],
      definingScore: null,
      overallScore,
      counts,
      rulesChecked: report.functionResults.length,
    };
  }

  return {
    meta: {
      projectName: input.projectName,
      specPath: input.specPath,
      runId: String(report.runId),
      evaluationMode: report.evaluationMode,
      style: spec.style ?? null,
    },
    summary,
    layers,
    edges,
    findings,
    tierLabels: TIER_LABELS,
    tierExplanations: TIER_EXPLANATIONS,
  };
}
