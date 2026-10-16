/**
 * Aggregation of a metamorphic run (`scripts/v1.3/metamorphic-run.ts`): invariance per transformation and per rule,
 * and the list of every case where invariance fails. Pure over the raw records, so `--report` regenerates it offline.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compareRuns, layerPairKey } from './metamorphic.js';
import type { Comparison, LayerModel, RunSummary } from './metamorphic.js';

export interface BaseRecord {
  readonly style: string;
  readonly variant: string;
  readonly tscOk: boolean;
  /** The untransformed cypher-interp rows equal results/v1.3-reference/after-member-facts/raw (null: not there). */
  readonly identicalToCommittedNeo4jRun: boolean | null;
  readonly summary: RunSummary;
}

export interface TransformRecord {
  readonly transform: string;
  readonly style: string;
  readonly variant: string;
  readonly candidate: string;
  readonly candidatesTried: number;
  /** The transformation changed the project (false: nothing to act on, identity). */
  readonly applied: boolean;
  /** A candidate was applied and type-checked (or was an identity). */
  readonly transformed: boolean;
  readonly note: string;
  readonly tscOk: boolean;
  readonly tscDiagnostics: readonly string[];
  readonly candidateErrors: readonly string[];
  readonly origCanon: Readonly<Record<string, string>>;
  readonly newCanon: Readonly<Record<string, string>>;
  /** Spec strings replaced so the spec follows the transformation (empty: the spec was used as is). */
  readonly specReplaced?: readonly string[];
  readonly summary?: RunSummary;
  readonly evalError?: string;
  readonly elapsedMs?: number;
}

export interface StyleInput {
  readonly style: string;
  readonly model: LayerModel;
  readonly variants: readonly { variant: string; kind: string; definingRules: readonly string[] }[];
}

export interface CaseRow extends Comparison {
  readonly transform: string;
  readonly style: string;
  readonly variant: string;
  readonly kind: string;
  readonly candidate: string;
  readonly note: string;
}

export interface TransformStats {
  readonly transform: string;
  readonly core: boolean;
  readonly variants: number;
  readonly notApplicable: number;
  readonly noCandidate: number;
  readonly evaluated: number;
  readonly invariant: number;
  readonly invariantFiles: number;
  readonly definingChanged: number;
  readonly verdictChanged: number;
  readonly advisoryChanged: number;
  readonly invariantRate: number | null;
  readonly invariantWilson: readonly [number, number] | null;
}

export interface RuleStats {
  readonly ruleId: string;
  /** transform -> [cases where the rule's verdict or (layer pair) set changed, evaluated cases] */
  readonly perTransform: Readonly<Record<string, readonly [number, number]>>;
  /** Evaluated cases where the rule had a blocking row before or after. */
  readonly involved: number;
  readonly breaks: number;
}

export interface MetamorphicReport {
  readonly base: { readonly variants: number; readonly tscOk: number; readonly identicalToCommitted: number; readonly checkedAgainstCommitted: number };
  readonly transforms: readonly TransformStats[];
  readonly rules: readonly RuleStats[];
  readonly cases: readonly CaseRow[];
  readonly noCandidate: readonly { transform: string; style: string; variant: string; errors: readonly string[] }[];
}

/** 95% Wilson interval (z = 1.959964), as in scripts/v1.3/ue-score.ts. */
export function wilson(k: number, n: number): readonly [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.959964;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}

function readJson<T>(file: string): T | undefined {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T) : undefined;
}

/** Per-rule change: the rule's violated status or its set of (layer pair) keys differs. */
function ruleChanged(model: LayerModel, rule: string, before: RunSummary, after: RunSummary): boolean {
  const keys = (s: RunSummary): string => [...new Set(s.blocking.filter((r) => r.ruleId === rule).map((r) => layerPairKey(model, r)))].sort().join(';');
  return keys(before) !== keys(after);
}

export function aggregate(outDir: string, styles: readonly StyleInput[], transforms: readonly string[], core: readonly string[]): MetamorphicReport {
  const bases = new Map<string, BaseRecord>();
  let tscOk = 0;
  let identical = 0;
  let checked = 0;
  for (const s of styles) {
    for (const v of s.variants) {
      const b = readJson<BaseRecord>(path.join(outDir, 'raw', 'base', s.style, `${v.variant}.json`));
      if (b === undefined) continue;
      bases.set(`${s.style}/${v.variant}`, b);
      if (b.tscOk) tscOk += 1;
      if (b.identicalToCommittedNeo4jRun !== null) {
        checked += 1;
        if (b.identicalToCommittedNeo4jRun) identical += 1;
      }
    }
  }
  const cases: CaseRow[] = [];
  const stats: TransformStats[] = [];
  const noCandidate: MetamorphicReport['noCandidate'][number][] = [];
  const ruleCounts = new Map<string, Map<string, [number, number]>>();
  const ruleInvolved = new Map<string, number>();
  for (const t of transforms) {
    let variants = 0;
    let na = 0;
    let noCand = 0;
    let evaluated = 0;
    let inv = 0;
    let invFiles = 0;
    let defCh = 0;
    let verdCh = 0;
    let advCh = 0;
    let seen = false;
    for (const s of styles) {
      for (const v of s.variants) {
        const rec = readJson<TransformRecord>(path.join(outDir, 'raw', t, s.style, `${v.variant}.json`));
        const base = bases.get(`${s.style}/${v.variant}`);
        if (rec === undefined || base === undefined) continue;
        seen = true;
        variants += 1;
        if (!rec.transformed) {
          noCand += 1;
          noCandidate.push({ transform: t, style: s.style, variant: v.variant, errors: rec.candidateErrors });
          continue;
        }
        if (!rec.applied) {
          na += 1;
          continue;
        }
        if (rec.summary === undefined) {
          noCand += 1;
          noCandidate.push({ transform: t, style: s.style, variant: v.variant, errors: [rec.evalError ?? 'no evaluation'] });
          continue;
        }
        evaluated += 1;
        const c = compareRuns(s.model, v.definingRules, base.summary, rec.summary, rec.origCanon, rec.newCanon);
        if (c.invariant) inv += 1;
        if (c.invariantFiles) invFiles += 1;
        if (c.definingBefore !== c.definingAfter) defCh += 1;
        if (c.verdictBefore !== c.verdictAfter) verdCh += 1;
        if (c.advisoryChanged) advCh += 1;
        if (!c.invariantFiles) cases.push({ ...c, transform: t, style: s.style, variant: v.variant, kind: v.kind, candidate: rec.candidate, note: rec.note });
        const rules = new Set([...base.summary.blockingRules, ...rec.summary.blockingRules]);
        for (const rule of rules) {
          const m = ruleCounts.get(rule) ?? new Map<string, [number, number]>();
          const cur = m.get(t) ?? [0, 0];
          const changed = ruleChanged(s.model, rule, base.summary, rec.summary);
          m.set(t, [cur[0] + (changed ? 1 : 0), cur[1] + 1]);
          ruleCounts.set(rule, m);
          if (base.summary.blocking.some((r) => r.ruleId === rule) || rec.summary.blocking.some((r) => r.ruleId === rule)) ruleInvolved.set(rule, (ruleInvolved.get(rule) ?? 0) + 1);
        }
      }
    }
    if (!seen) continue;
    stats.push({
      transform: t,
      core: core.includes(t),
      variants,
      notApplicable: na,
      noCandidate: noCand,
      evaluated,
      invariant: inv,
      invariantFiles: invFiles,
      definingChanged: defCh,
      verdictChanged: verdCh,
      advisoryChanged: advCh,
      invariantRate: evaluated === 0 ? null : inv / evaluated,
      invariantWilson: evaluated === 0 ? null : wilson(inv, evaluated),
    });
  }
  const rules: RuleStats[] = [...ruleCounts.entries()]
    .map(([ruleId, m]) => {
      const perTransform: Record<string, readonly [number, number]> = {};
      let breaks = 0;
      for (const [t, c] of [...m.entries()].sort()) {
        perTransform[t] = c;
        breaks += c[0];
      }
      return { ruleId, perTransform, involved: ruleInvolved.get(ruleId) ?? 0, breaks };
    })
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  return { base: { variants: bases.size, tscOk, identicalToCommitted: identical, checkedAgainstCommitted: checked }, transforms: stats, rules, cases, noCandidate };
}

const pct = (x: number | null): string => (x === null ? 'n/a' : x.toFixed(3));

export function renderSummary(r: MetamorphicReport): string {
  const out: string[] = [];
  out.push('# v1.3 metamorphic run: summary');
  out.push('');
  out.push(`Untransformed variants: ${String(r.base.variants)}; type-check clean: ${String(r.base.tscOk)}; cypher-interp rows identical to the committed Neo4j run (after-member-facts): ${String(r.base.identicalToCommitted)}/${String(r.base.checkedAgainstCommitted)}.`);
  out.push('');
  out.push('Invariance: the defining-rule verdict and the set of blocking (rule, layer pair) keys are unchanged. "Files" is stricter: the set of blocking (rule, file, target) keys after mapping renamed, split and merged files is unchanged too.');
  out.push('');
  out.push('| transformation | variants | n/a | no candidate | evaluated | invariant | rate [95% Wilson] | files-invariant | defining verdict changed | tool verdict changed | advisory changed |');
  out.push('|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|');
  for (const t of r.transforms) {
    const w = t.invariantWilson === null ? '' : ` [${t.invariantWilson[0].toFixed(2)}, ${t.invariantWilson[1].toFixed(2)}]`;
    out.push(`| ${t.transform}${t.core ? '' : ' (probe)'} | ${String(t.variants)} | ${String(t.notApplicable)} | ${String(t.noCandidate)} | ${String(t.evaluated)} | ${String(t.invariant)} | ${pct(t.invariantRate)}${w} | ${String(t.invariantFiles)} | ${String(t.definingChanged)} | ${String(t.verdictChanged)} | ${String(t.advisoryChanged)} |`);
  }
  out.push('');
  const ts = r.transforms.map((t) => t.transform);
  out.push('## Per rule (cases where the rule changed / evaluated cases)');
  out.push('');
  out.push(`| rule | involved | ${ts.join(' | ')} |`);
  out.push(`|---|---:|${ts.map(() => '---:').join('|')}|`);
  for (const rule of r.rules) {
    out.push(`| ${rule.ruleId} | ${String(rule.involved)} | ${ts.map((t) => {
      const c = rule.perTransform[t];
      return c === undefined ? '' : c[0] === 0 ? `0/${String(c[1])}` : `**${String(c[0])}**/${String(c[1])}`;
    }).join(' | ')} |`);
  }
  out.push('');
  out.push('## Cases that are not invariant');
  out.push('');
  if (r.cases.length === 0) out.push('None.');
  for (const c of r.cases) {
    out.push(`- **${c.transform} ${c.style}/${c.variant}** (${c.kind}; ${c.candidate}) ${c.invariant ? 'layer-pair invariant, files differ' : 'NOT INVARIANT'}`);
    if (c.definingBefore !== c.definingAfter) out.push(`  - defining verdict: ${c.definingBefore} -> ${c.definingAfter}`);
    if (c.verdictBefore !== c.verdictAfter) out.push(`  - tool verdict: ${c.verdictBefore} -> ${c.verdictAfter}`);
    if (c.lostPairs.length > 0) out.push(`  - lost (rule, layer pair): ${c.lostPairs.join('; ')}`);
    if (c.gainedPairs.length > 0) out.push(`  - gained (rule, layer pair): ${c.gainedPairs.join('; ')}`);
    if (c.lostFiles.length > 0) out.push(`  - lost (rule, file, target): ${c.lostFiles.join('; ')}`);
    if (c.gainedFiles.length > 0) out.push(`  - gained (rule, file, target): ${c.gainedFiles.join('; ')}`);
  }
  out.push('');
  if (r.noCandidate.length > 0) {
    out.push('## No candidate type-checked');
    out.push('');
    for (const n of r.noCandidate) out.push(`- ${n.transform} ${n.style}/${n.variant}: ${n.errors.slice(0, 2).join(' || ')}`);
    out.push('');
  }
  return out.join('\n');
}
