/**
 * Violation identity under one instrument state and one spec (ID-1 to ID-10 of
 * `aidlc-docs/construction/v1.4/U4/functional-design/design.md`).
 *
 * - `fineKey`: K, the fix-mining key `violationKey` of `scripts/v1.3/lib/fixes-mined.ts`, imported, not re-implemented.
 * - `edgeKeys`: E, the Study 2 unit (`source|target`; a cycle by `cycleIdentity`; file-level dropped under `edgeOnly`).
 *   Each K maps to a *set* of E keys (one per directed edge under `explode-edges`, ID-8).
 * - `memoKey`: the pilot memo's `findingIdentity` (`scripts/lib/loop/pilot-metrics.ts`), reproduced for D-8 only.
 * - `mapFinding`: applies ρ to the finding, never to a key string (paths may contain `#`), ID-10.
 * - adapters from the fix-mining records, the loop's `BlockingFinding`, and the probe's `{rule, file, target}`.
 */
import { canonicalCycle, violationEdges, violationFiles, violationKey, type MinedViolation } from '../../v1.3/lib/fixes-mined.js';
import type { BlockingFinding } from '../loop/types.js';
import type { IdFinding, IdentityOptions, RenameMap, Snapshot } from './types.js';

const toMined = (f: IdFinding): MinedViolation => ({
  functionId: f.functionId,
  filePath: f.filePath,
  ...(f.target !== undefined && { target: f.target }),
  ...(f.discriminator !== undefined && { discriminator: f.discriminator }),
});

/** K (ID-3): `violationKey`, unchanged. Line, column, message, tier, layer names and template are not part of it. */
export function fineKey(f: IdFinding): string {
  return violationKey(toMined(f));
}

/** The file edges a finding rests on (`violationEdges`). */
export const findingEdges = (f: IdFinding): string[] => violationEdges(toMined(f));
/** The files a finding names (`violationFiles`). */
export const findingFiles = (f: IdFinding): string[] => violationFiles(toMined(f));

/**
 * The cycle's node path when the finding is a cycle K treats as one (same test as the private `cyclePath` of
 * `fixes-mined.ts`: FF-S02 or a comma list, members from a JSON-array discriminator or the comma list). Undefined
 * otherwise, including a degraded FF-S02 with no member list.
 */
export function cycleMembers(f: IdFinding): string[] | undefined {
  if (f.functionId !== 'FF-S02' && !f.filePath.includes(',')) return undefined;
  const d = f.discriminator?.[0];
  if (d?.startsWith('[') === true) {
    const arr = parseStringArray(d);
    if (arr !== undefined) return arr;
  }
  return f.filePath.includes(',') ? f.filePath.split(',') : undefined;
}

function parseStringArray(s: string): string[] | undefined {
  try {
    const arr = JSON.parse(s) as unknown;
    return Array.isArray(arr) && arr.every((x) => typeof x === 'string') ? (arr) : undefined;
  } catch {
    return undefined;
  }
}

/** True for a finding the loop names a cycle (rule id FF-S02, or a template or rule name saying `cycl`). */
const looksLikeCycle = (f: IdFinding): boolean => f.functionId === 'FF-S02' || /cycl/i.test(f.template ?? '') || /cycl/i.test(f.ruleName ?? '');

/** The cycle's directed edges, its closing repeat included (`[a,b,c,a]` -> a|b, b|c, c|a). */
function cycleDirectedEdges(path: readonly string[]): string[] {
  const nodes = canonicalCycle(path);
  const out: string[] = [];
  nodes.forEach((n, i) => out.push(`${n}|${nodes[(i + 1) % nodes.length] ?? n}`));
  return [...new Set(out)];
}

/**
 * E (ID-5 to ID-8). An edge-shaped finding maps to `source|target` (FF-S01 and FF-S03 on one edge share it). A cycle:
 * - `edge-set`: one key, the sorted list of its directed edges;
 * - `sorted-files`: one key, the sorted file set;
 * - `explode-edges`: one key per directed edge, shared with a plain edge finding on it.
 * A degraded cycle (members unknown, ID-4) is keyed from `{filePath, target}` as a sorted file set in every mode.
 * A file-level finding has no E under `edgeOnly`; otherwise its E is its K.
 */
export function edgeKeys(f: IdFinding, opts: Pick<IdentityOptions, 'cycleIdentity' | 'edgeOnly'>): string[] {
  const members = cycleMembers(f);
  if (members !== undefined) {
    if (opts.cycleIdentity === 'explode-edges') return cycleDirectedEdges(members);
    if (opts.cycleIdentity === 'edge-set') return [`cycle-edges#${cycleDirectedEdges(members).sort().join(';')}`];
    return [`cycle-files#${[...new Set(members)].sort().join(';')}`];
  }
  if (f.cycleMembersKnown === false || (looksLikeCycle(f) && f.functionId === 'FF-S02')) {
    const files = [...new Set([f.filePath, ...(f.target !== undefined ? [f.target] : [])])].sort();
    return [`cycle-files#${files.join(';')}`];
  }
  const edges = findingEdges(f);
  if (edges.length > 0) return edges;
  return opts.edgeOnly ? [] : [fineKey(f)];
}

/** The pilot memo's identity (`findingIdentity`), reproduced exactly (D-8). Needs `template` and `ruleName`. */
export function memoKey(f: IdFinding): string {
  const template = f.template ?? '';
  if (/cycl/i.test(template) || /cycl/i.test(f.ruleName ?? '')) {
    const files = [...new Set([f.filePath, ...(f.target !== undefined ? [f.target] : [])])].sort();
    return JSON.stringify([f.functionId, template, files]);
  }
  return JSON.stringify([f.functionId, template, f.filePath, f.target ?? '']);
}

/** The keys of a finding at the chosen grain. */
export function keysFor(f: IdFinding, opts: Pick<IdentityOptions, 'grain' | 'cycleIdentity' | 'edgeOnly'>): string[] {
  if (opts.grain === 'fine') return [fineKey(f)];
  if (opts.grain === 'memo') return [memoKey(f)];
  return edgeKeys(f, opts);
}

/**
 * ρ applied to the finding (ID-10): `filePath`, `target`, every member of a comma-list cycle and the members of a
 * JSON-array cycle discriminator. Other discriminator entries (class names, package names) are left as they are.
 * The key is computed afterwards, and `canonicalCycle` re-canonicalises a cycle there.
 */
export function mapFinding(f: IdFinding, rho: RenameMap): IdFinding {
  if (rho.size === 0) return f;
  const m = (p: string): string => rho.get(p) ?? p;
  const filePath = f.filePath.includes(',') ? f.filePath.split(',').map(m).join(',') : m(f.filePath);
  const cycle = cycleMembers(f) !== undefined;
  const discriminator = f.discriminator?.map((d, i) => {
    if (!cycle || i !== 0 || !d.startsWith('[')) return d;
    const arr = parseStringArray(d);
    return arr === undefined ? d : JSON.stringify(arr.map(m));
  });
  return {
    ...f,
    filePath,
    ...(f.target !== undefined && { target: m(f.target) }),
    ...(discriminator !== undefined && { discriminator }),
  };
}

// ── Adapters ────────────────────────────────────────────────────────────────

/** A fix-mining record (`MinedViolation`, a `pairs.json.gz` finding) as an `IdFinding`. */
export function fromMined(v: MinedViolation & { readonly tier?: 'blocking' | 'advisory' | undefined }): IdFinding {
  return {
    functionId: v.functionId,
    filePath: v.filePath,
    ...(v.target !== undefined && { target: v.target }),
    ...(v.discriminator !== undefined && { discriminator: [...v.discriminator] }),
    ...(v.tier !== undefined && { tier: v.tier }),
  };
}

/** The fields of a report violation (`EvaluationReport.violations[]`) the adapter reads. */
interface ReportViolationLike {
  readonly id?: unknown;
  readonly functionId?: unknown;
  readonly filePath?: unknown;
  readonly target?: unknown;
  readonly discriminator?: unknown;
}

/**
 * The loop's `BlockingFinding` (ID-4). A cycle's member list is not in the finding; when the report violations written
 * beside the turn are passed, the one with the finding's `violationId` supplies `filePath` and `discriminator`.
 * Otherwise a cycle is keyed from `{filePath, target}` and flagged `cycleMembersKnown: false`.
 */
export function fromBlockingFinding(b: BlockingFinding, reportViolations?: readonly unknown[]): IdFinding {
  let filePath = b.filePath;
  let discriminator: string[] | undefined;
  if (reportViolations !== undefined && b.violationId !== undefined) {
    const v = reportViolations.find((x): x is ReportViolationLike => typeof x === 'object' && x !== null && (x as ReportViolationLike).id === b.violationId);
    if (v !== undefined) {
      if (typeof v.filePath === 'string') filePath = v.filePath;
      if (Array.isArray(v.discriminator) && v.discriminator.every((d) => typeof d === 'string')) discriminator = v.discriminator;
    }
  }
  const f: IdFinding = {
    functionId: b.ruleId,
    filePath,
    ...(b.target !== undefined && { target: b.target }),
    ...(discriminator !== undefined && { discriminator }),
    tier: 'blocking',
    ...(b.template !== undefined && { template: b.template }),
    ruleName: b.ruleName,
  };
  return looksLikeCycle(f) && cycleMembers(f) === undefined ? { ...f, cycleMembersKnown: false } : f;
}

/** A probe-1 step-file finding (`results/v1.3-floor-probe/<task>/<arm>/step-NN.json` `blockingFindings[]`). */
export function fromProbeFinding(p: { readonly rule: string; readonly file: string; readonly target?: string | undefined }): IdFinding {
  const f: IdFinding = { functionId: p.rule, filePath: p.file, ...(p.target !== undefined && { target: p.target }), tier: 'blocking' };
  return f.functionId === 'FF-S02' && cycleMembers(f) === undefined ? { ...f, cycleMembersKnown: false } : f;
}

/** ID-1: an identity is defined within one instrument state and spec; mixing them is an input error. */
export function assertSameContext(snapshots: readonly Pick<Snapshot, 'id' | 'contextId'>[]): void {
  const first = snapshots[0];
  if (first === undefined) return;
  for (const s of snapshots) {
    if (s.contextId !== first.contextId) {
      throw new Error(`drift identity: snapshot ${s.id} has context ${s.contextId}, ${first.id} has ${first.contextId} (ID-1)`);
    }
  }
}
