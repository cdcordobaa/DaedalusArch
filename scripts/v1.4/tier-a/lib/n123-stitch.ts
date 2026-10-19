/**
 * The pure parts of TIER-A2 item 5 (`scripts/v1.4/tier-a/n123-rename-rescore.ts`): the G08 rename continuation over
 * committed fix-mining grid lineages, and KM S(365) with a Greenwood interval.
 */
import { fineKey, mapFinding } from '../../../lib/drift/identity.js';
import type { IdFinding, Lineage } from '../../../lib/drift/types.js';
import type { SurvivalObs } from '../../../v1.3/lib/fixes-mined.js';

/** ρ from grid point `from` to grid point `to` (consecutive valid points), old -> new. */
export interface MapTransition { from: number; to: number; rename: [string, string][]; skipped: boolean }

/** The committed key as a finding (inverse of `violationKey`); undefined when the round trip fails. */
export function findingFromKey(key: string): IdFinding | undefined {
  const parts = key.split('#');
  let f: IdFinding | undefined;
  if (parts.length === 3 && parts[1] === 'cycle') f = { functionId: parts[0] ?? '', filePath: (parts[2] ?? '').split('>').join(',') };
  else if (parts.length === 4) {
    const disc = (parts[3] ?? '') === '' ? undefined : (parts[3] ?? '').split(';');
    f = { functionId: parts[0] ?? '', filePath: parts[1] ?? '', ...((parts[2] ?? '') !== '' && { target: parts[2] }), ...(disc !== undefined && { discriminator: disc }) };
  }
  return f !== undefined && fineKey(f) === key ? f : undefined;
}

export function mapKey(l: Lineage, rho: ReadonlyMap<string, string>): string | undefined {
  if (l.kind === 'edge') {
    const [s = '', t = ''] = l.key.split('|');
    return `${rho.get(s) ?? s}|${rho.get(t) ?? t}`;
  }
  const f = findingFromKey(l.key);
  return f === undefined ? undefined : fineKey(mapFinding(f, rho));
}

export interface StitchStats { endingsSeen: number; stitched: number; unparsed: number; blockingEndings: number; blockingStitched: number; skippedTransitions: number }

/** Applies the G08 rename continuation to one repository's committed grid lineages. */
export function stitch(lineages: readonly Lineage[], maps: readonly MapTransition[]): { lineages: Lineage[]; stats: StitchStats } {
  const rhoAt = new Map<number, Map<string, string>>(maps.map((t) => [t.to, new Map(t.rename)]));
  const bornAt = new Map<string, number>();
  lineages.forEach((l, idx) => bornAt.set(`${l.kind ?? ''}@${l.born}@${l.key}`, idx));
  const order = lineages.map((_, i) => i).filter((i) => lineages[i]?.ended !== null)
    .sort((a, b) => {
      const la = lineages[a] as Lineage;
      const lb = lineages[b] as Lineage;
      return (la.ended as number) - (lb.ended as number) || la.born - lb.born || (la.key < lb.key ? -1 : la.key > lb.key ? 1 : 0);
    });
  const next = new Map<number, number>();
  const claimed = new Set<number>();
  const stats: StitchStats = { endingsSeen: 0, stitched: 0, unparsed: 0, blockingEndings: 0, blockingStitched: 0, skippedTransitions: maps.filter((t) => t.skipped).length };
  for (const i of order) {
    const l = lineages[i] as Lineage;
    const j = l.ended as number;
    stats.endingsSeen++;
    const blocking = l.kind === 'finding' && l.tier === 'blocking';
    if (blocking) stats.blockingEndings++;
    const rho = rhoAt.get(j);
    if (rho === undefined || rho.size === 0) continue;
    const mk = mapKey(l, rho);
    if (mk === undefined) { stats.unparsed++; continue; }
    if (mk === l.key) continue;
    const m = bornAt.get(`${l.kind ?? ''}@${j}@${mk}`);
    if (m === undefined || claimed.has(m)) continue;
    claimed.add(m);
    next.set(i, m);
    stats.stitched++;
    if (blocking) stats.blockingStitched++;
  }
  const out: Lineage[] = [];
  lineages.forEach((l, i) => {
    if (claimed.has(i)) return; // a continuation, not a birth
    let k = i;
    const renamedAt: number[] = [];
    while (next.has(k)) { k = next.get(k) as number; renamedAt.push((lineages[k] as Lineage).born); }
    if (renamedAt.length === 0) { out.push(l); return; }
    const last = lineages[k] as Lineage;
    out.push({ ...l, ended: last.ended, finalKey: last.key, renamedAt, ...(last.filesStay !== undefined ? { filesStay: last.filesStay } : {}) });
  });
  return { lineages: out, stats };
}

/** KM with the Greenwood variance at 365 days and a log-log 95% interval. */
export function kmGreenwood365(obs: readonly SurvivalObs[]): { s365: number; lo: number; hi: number } {
  const sorted = [...obs].sort((a, b) => a.t - b.t || Number(b.event) - Number(a.event));
  let atRisk = sorted.length;
  let s = 1;
  let g = 0;
  let s365 = 1;
  let g365 = 0;
  let i = 0;
  while (i < sorted.length) {
    const t = (sorted[i] as SurvivalObs).t;
    let d = 0;
    let c = 0;
    while (i < sorted.length && (sorted[i] as SurvivalObs).t === t) { if ((sorted[i] as SurvivalObs).event) d++; else c++; i++; }
    if (d > 0 && atRisk > 0) { s *= 1 - d / atRisk; if (atRisk > d) g += d / (atRisk * (atRisk - d)); }
    if (t <= 365) { s365 = s; g365 = g; }
    atRisk -= d + c;
  }
  if (s365 <= 0 || s365 >= 1) return { s365, lo: s365, hi: s365 };
  const se = Math.sqrt(g365) / Math.abs(Math.log(s365));
  const ll = Math.log(-Math.log(s365));
  return { s365, lo: Math.exp(-Math.exp(ll + 1.959964 * se)), hi: Math.exp(-Math.exp(ll - 1.959964 * se)) };
}
