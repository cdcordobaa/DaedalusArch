/**
 * Sorting two commits' findings into new, fixed and unchanged. Pure.
 *
 * Key: rule id + file + target. The line is not part of the key, so a finding whose line moved (code inserted above
 * it) is unchanged. Cycle rows (FF-S02) put the cycle path in the file column, so they are keyed by the set of files
 * in the cycle, as the reference scoring does (`scripts/v1.3/lib/compare.ts`): a cycle reported from another starting
 * file is the same cycle.
 *
 * Several rows can share a key (one rule, one file, one target, different lines). Within a key, rows on the same line
 * pair first, then the rest pair in line order; the surplus on the head side is new, on the base side fixed.
 *
 * Renames: base findings are re-keyed through `renames` (base path -> head path) first, so moving a file does not
 * report its existing findings as fixed and new.
 */
import type { GateClassification, GateFinding, UnchangedPair } from './types.js';

/** Rules whose finding is a cycle, matched on the set of files in it. */
export const CYCLE_RULE_IDS: ReadonlySet<string> = new Set(['FF-S02']);

/** The sorted, deduplicated files of a cycle row (`file` and `target`, each split on commas). */
export function cycleFileSet(f: { readonly file: string; readonly target?: string }): string {
  const parts = [...f.file.split(','), ...(f.target ?? '').split(',')].map((x) => x.trim()).filter((x) => x !== '');
  return [...new Set(parts)].sort().join(',');
}

export function findingKey(f: Pick<GateFinding, 'ruleId' | 'file' | 'target'>): string {
  if (CYCLE_RULE_IDS.has(f.ruleId)) return `${f.ruleId}|{${cycleFileSet(f)}}`;
  return `${f.ruleId}|${f.file}|${f.target ?? ''}`;
}

function renamePath(p: string, renames: Readonly<Record<string, string>>): string {
  return p
    .split(',')
    .map((part) => renames[part.trim()] ?? part)
    .join(',');
}

/** `f` with its file and target moved through `renames`. */
export function applyRenames(f: GateFinding, renames: Readonly<Record<string, string>>): GateFinding {
  if (Object.keys(renames).length === 0) return f;
  return {
    ...f,
    file: renamePath(f.file, renames),
    ...(f.target !== undefined ? { target: renamePath(f.target, renames) } : {}),
  };
}

function groupByKey(rows: readonly GateFinding[], keyOf: (f: GateFinding) => string): Map<string, GateFinding[]> {
  const out = new Map<string, GateFinding[]>();
  for (const r of rows) {
    const k = keyOf(r);
    const list = out.get(k);
    if (list === undefined) out.set(k, [r]);
    else list.push(r);
  }
  return out;
}

const byLine = (a: GateFinding, b: GateFinding): number => (a.line ?? 0) - (b.line ?? 0);

/** Order of the output lists: tier (blocking first), rule, file, target, line. */
export function compareFindings(a: GateFinding, b: GateFinding): number {
  const rank = (f: GateFinding): number => (f.tier === 'blocking' ? 0 : f.tier === 'advisory' ? 1 : 2);
  return (
    rank(a) - rank(b) ||
    a.ruleId.localeCompare(b.ruleId) ||
    a.file.localeCompare(b.file) ||
    (a.target ?? '').localeCompare(b.target ?? '') ||
    byLine(a, b)
  );
}

export function classifyFindings(
  base: readonly GateFinding[],
  head: readonly GateFinding[],
  renames: Readonly<Record<string, string>> = {},
): GateClassification {
  // The key of a base row is taken after the rename; the row itself is reported with its base path.
  const baseKey = new Map<GateFinding, string>(base.map((f) => [f, findingKey(applyRenames(f, renames))]));
  const baseGroups = groupByKey(base, (f) => baseKey.get(f) ?? findingKey(f));
  const headGroups = groupByKey(head, findingKey);

  const added: GateFinding[] = [];
  const fixed: GateFinding[] = [];
  const unchanged: UnchangedPair[] = [];

  for (const [k, headRows] of headGroups) {
    const baseRows = [...(baseGroups.get(k) ?? [])].sort(byLine);
    const rest: GateFinding[] = [];
    for (const h of [...headRows].sort(byLine)) {
      const i = baseRows.findIndex((b) => b.line === h.line);
      const [same] = i >= 0 ? baseRows.splice(i, 1) : [];
      if (same !== undefined) unchanged.push({ base: same, head: h });
      else rest.push(h);
    }
    for (const h of rest) {
      const b = baseRows.shift();
      if (b === undefined) added.push(h);
      else unchanged.push({ base: b, head: h });
    }
    fixed.push(...baseRows);
    baseGroups.delete(k);
  }
  for (const rows of baseGroups.values()) fixed.push(...rows);

  return {
    new: added.sort(compareFindings),
    fixed: fixed.sort(compareFindings),
    unchanged: unchanged.sort((a, b) => compareFindings(a.head, b.head)),
  };
}
