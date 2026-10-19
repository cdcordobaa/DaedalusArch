/**
 * Shared builders for the U4 drift tests (synthetic snapshots; no file I/O).
 */
import { fineKey } from '../../../../scripts/lib/drift/identity.js';
import type { IdFinding, Snapshot } from '../../../../scripts/lib/drift/types.js';

export const CTX = 'ctx-test';

/** An edge-shaped finding (FF-S01 by default). */
export const dep = (s: string, t: string, rule = 'FF-S01', tier: 'blocking' | 'advisory' = 'blocking'): IdFinding => ({ functionId: rule, filePath: s, target: t, tier });

/** A cycle from its node path, e.g. cyc('a.ts', 'b.ts', 'a.ts'). */
export const cyc = (...nodes: string[]): IdFinding => ({ functionId: 'FF-S02', filePath: nodes.join(','), target: nodes[1], tier: 'blocking' });

/** A file-level finding. */
export const fileLevel = (f: string, rule = 'FF-C02'): IdFinding => ({ functionId: rule, filePath: f, tier: 'advisory' });

/** The edges a set of findings rests on, plus extra ones. */
export function edgesOf(fs: readonly IdFinding[], extra: readonly string[] = []): string[] {
  const out = new Set<string>(extra);
  for (const f of fs) {
    if (f.filePath.includes(',')) {
      const p = f.filePath.split(',');
      p.slice(1).forEach((t, i) => out.add(`${at(p, i)}|${t}`));
    } else if (f.target !== undefined) out.add(`${f.filePath}|${f.target}`);
  }
  return [...out].sort();
}

/** The files a set of findings names, plus extra ones. */
export function filesOf(fs: readonly IdFinding[], extra: readonly string[] = []): string[] {
  const out = new Set<string>(extra);
  for (const f of fs) {
    for (const p of f.filePath.split(',')) out.add(p);
    if (f.target?.endsWith('.ts') === true) out.add(f.target);
  }
  return [...out].sort();
}

/**
 * A snapshot whose files and edges are those of its findings plus `extraFiles` and `extraEdges` (so causes can be
 * classified), unless `bare` (no files or edges, as the committed grid stores it).
 */
export function snap(id: string, findings: readonly IdFinding[], o: { extraFiles?: string[]; extraEdges?: string[]; ok?: boolean; bare?: boolean; date?: string; contextId?: string } = {}): Snapshot {
  return {
    id,
    contextId: o.contextId ?? CTX,
    ok: o.ok ?? true,
    findings,
    ...(o.date !== undefined && { date: o.date }),
    ...(o.bare !== true && { files: filesOf(findings, o.extraFiles), edges: edgesOf(findings, o.extraEdges) }),
  };
}

export const K = fineKey;

/** `xs[i]`, throwing when the index is out of range (instead of a non-null assertion). */
export function at<T>(xs: readonly T[], i: number): T {
  const x = xs[i];
  if (x === undefined) throw new Error(`index ${String(i)} out of range`);
  return x;
}
