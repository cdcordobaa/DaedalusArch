/**
 * v1.3 labelling: the per-rule SAMPLER (Docs/v1.3/validation-protocol.md §3, fixed before labelling).
 *
 * Per rule: every finding when the rule has fewer than 40; otherwise a seeded random 40, stratified by project.
 * A rule is the pair (rule id, template), because the hexagonal and DDD libraries re-use ids of the frozen registry
 * for other templates (FF-S01 is `dependency-direction` in Clean and `dependency-direction-graph` in DDD).
 *
 * Stratification: the 40 places are split over the rule's projects in proportion to their finding counts (largest
 * remainder; ties go to the project that comes first in a seeded order), and each project's findings are drawn by a
 * seeded shuffle of their keys in sorted order. Every seed derives from the plan seed and the stratum, so adding a
 * rule or a project never reshuffles another.
 */
import { createHash } from 'node:crypto';
import { ruleTier } from '../../../../src/scoring-engine/rule-tiers.js';
import { createRng, shuffle } from '../../../lib/stats.js';
import type { Finding } from './findings.js';

/** Per-rule cap, fixed by the protocol. */
export const PER_RULE_CAP = 40;

export interface SampledFinding extends Finding {
  /** `<ruleId>/<template>`. */
  readonly rule: string;
  readonly inclusionProbability: number;
}

export interface RuleSample {
  readonly rule: string;
  readonly ruleId: string;
  readonly template: string;
  readonly tier: string;
  readonly population: number;
  readonly sampled: number;
  readonly exhaustive: boolean;
  readonly perProject: Readonly<Record<string, { readonly population: number; readonly sampled: number }>>;
}

export interface SampleFile {
  readonly schemaVersion: 1;
  readonly seed: number;
  readonly cap: number;
  readonly tiers: 'blocking' | 'all';
  /** Findings left out because rule-tiers.md reports their part N/A (FF-P06 FLOWS_TO rows), per rule. */
  readonly excludedNotApplicable: Readonly<Record<string, number>>;
  readonly rules: readonly RuleSample[];
  readonly items: readonly SampledFinding[];
}

export function ruleOf(f: Pick<Finding, 'ruleId' | 'template'>): string {
  return `${f.ruleId}/${f.template === '' ? '?' : f.template}`;
}

export function derivedSeed(seed: number, ...parts: readonly string[]): number {
  return createHash('sha256').update(JSON.stringify([seed, ...parts])).digest().readUInt32BE(0);
}

/** Splits `cap` over strata in proportion to `sizes` (largest remainder; ties by `tieOrder`). */
export function allocate(sizes: ReadonlyMap<string, number>, cap: number, tieOrder: readonly string[]): Map<string, number> {
  const total = [...sizes.values()].reduce((a, b) => a + b, 0);
  const out = new Map<string, number>();
  if (total <= cap) {
    for (const [k, n] of sizes) out.set(k, n);
    return out;
  }
  const rank = new Map(tieOrder.map((k, i) => [k, i]));
  const rows = [...sizes].map(([k, n]) => {
    const exact = (cap * n) / total;
    return { k, n, base: Math.min(n, Math.floor(exact)), rem: exact - Math.floor(exact) };
  });
  let left = cap - rows.reduce((a, r) => a + r.base, 0);
  const order = [...rows].sort((a, b) => b.rem - a.rem || (rank.get(a.k) ?? 0) - (rank.get(b.k) ?? 0));
  while (left > 0) {
    let moved = false;
    for (const r of order) {
      if (left === 0) break;
      if (r.base < r.n) {
        r.base += 1;
        left -= 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const r of rows) out.set(r.k, r.base);
  return out;
}

/** True for a row of a partial rule's N/A part (rule-tiers.md: FF-P06 field rows, FLOWS_TO or HOLDS_STATE_OF). */
export function notApplicable(f: Pick<Finding, 'ruleId' | 'style' | 'discriminator'>): boolean {
  const na = ruleTier(f.ruleId, f.style).entry?.partial?.naRelTypes;
  return na?.some((t) => f.discriminator.includes(t)) === true;
}

export function sampleFindings(findings: readonly Finding[], seed: number, tiers: 'blocking' | 'all' = 'blocking', cap = PER_RULE_CAP): SampleFile {
  const excludedNotApplicable: Record<string, number> = {};
  const kept = findings.filter((f) => {
    if (tiers !== 'all' && f.tier !== 'blocking') return false;
    if (!notApplicable(f)) return true;
    excludedNotApplicable[ruleOf(f)] = (excludedNotApplicable[ruleOf(f)] ?? 0) + 1;
    return false;
  });
  const byRule = new Map<string, Finding[]>();
  for (const f of kept) {
    const r = ruleOf(f);
    const list = byRule.get(r) ?? [];
    list.push(f);
    byRule.set(r, list);
  }
  const rules: RuleSample[] = [];
  const items: SampledFinding[] = [];
  for (const rule of [...byRule.keys()].sort()) {
    const all = [...new Map((byRule.get(rule) ?? []).map((f) => [f.key, f])).values()].sort((a, b) => (a.key < b.key ? -1 : 1));
    const first = all[0];
    if (first === undefined) continue;
    const byProject = new Map<string, Finding[]>();
    for (const f of all) byProject.set(f.projectId, [...(byProject.get(f.projectId) ?? []), f]);
    const projects = [...byProject.keys()].sort();
    const tieOrder = shuffle(projects, createRng(derivedSeed(seed, rule, 'ties')));
    const quota = allocate(new Map(projects.map((p) => [p, byProject.get(p)?.length ?? 0])), cap, tieOrder);
    const exhaustive = all.length < cap;
    const p = exhaustive ? 1 : cap / all.length;
    const perProject: Record<string, { population: number; sampled: number }> = {};
    let sampled = 0;
    for (const proj of projects) {
      const list = byProject.get(proj) ?? [];
      const q = exhaustive ? list.length : quota.get(proj) ?? 0;
      const chosen = exhaustive ? list : shuffle(list, createRng(derivedSeed(seed, rule, proj))).slice(0, q).sort((a, b) => (a.key < b.key ? -1 : 1));
      for (const f of chosen) items.push({ ...f, rule, inclusionProbability: p });
      perProject[proj] = { population: list.length, sampled: chosen.length };
      sampled += chosen.length;
    }
    rules.push({ rule, ruleId: first.ruleId, template: first.template, tier: first.tier, population: all.length, sampled, exhaustive, perProject });
  }
  return { schemaVersion: 1, seed, cap, tiers, excludedNotApplicable, rules, items };
}
