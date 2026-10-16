/**
 * Pure helpers of the v1.3 hexagonal/DDD operator run (`scripts/v1.3/operators-hexddd-run.ts`). DEVELOPMENT DATA.
 *
 * - `expectedKeys`: the keys a positive's application must produce, from its location rules, the site and the edit,
 *   with the function id each template has under the spec (a template the spec does not enable gives no key and is
 *   listed as absent; a template the site names in `detail.notExpected` gives none either, e.g. MO-D02 inside the
 *   aggregate's own module, where FF-DT01 does not apply).
 * - `violationKey` / `newViolations`: a mutant violation is new when no base violation has the same function id, file,
 *   target and discriminator (lines are left out, so line shifts above an existing row do not make it new).
 * - `matchesKey`: a new violation satisfies a key on function id, file and target; class-keyed rules also need the
 *   class in the discriminator; a cycle key (`no-cyclic-deps`) needs both files in the reported cycle.
 * - `summarise`: per operator and style, the site-feasibility, compile and detection counts with Wilson intervals.
 */
import type { LocationRule, MutationEdit, MutationOperator, MutationSite } from '../../lib/mutation/types.js';
import { wilson } from '../../lib/stats.js';

export interface Violation {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string | null;
  readonly discriminator?: readonly string[];
  readonly message?: string;
}

export interface ExpectedKey {
  readonly template: string;
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string;
  /** A value the violation's discriminator must contain (class or implementation name). */
  readonly discriminatorHas?: string;
  readonly cycle?: true;
}

/** Template name → function ids enabled under a spec. */
export type TemplateIds = ReadonlyMap<string, readonly string[]>;

export function expectedKeys(op: MutationOperator, site: MutationSite, edit: MutationEdit, ids: TemplateIds): { keys: ExpectedKey[]; absent: string[] } {
  const keys: ExpectedKey[] = [];
  const absent: string[] = [];
  const skip = new Set((site.detail.notExpected ?? '').split(',').filter((x) => x.length > 0));
  for (const rule of op.expectedTemplates) {
    if (skip.has(rule.template)) continue;
    const fns = ids.get(rule.template) ?? [];
    if (fns.length === 0) {
      absent.push(rule.template);
      continue;
    }
    for (const functionId of fns) keys.push(keyOf(rule, functionId, site, edit));
  }
  return { keys, absent };
}

function keyOf(rule: LocationRule, functionId: string, site: MutationSite, edit: MutationEdit): ExpectedKey {
  const filePath = rule.filePath === 'created' ? (edit.createdFiles[0] ?? site.filePath) : rule.filePath === 'site-target' ? (site.detail.targetFile ?? '') : site.filePath;
  const target = rule.target === 'site-target' ? site.detail.targetFile : rule.target === 'package' ? site.detail.package : undefined;
  const disc = rule.discriminator ?? [];
  const discriminatorHas = disc.includes('class') || disc.includes('implementation') ? site.detail.class : undefined;
  return {
    template: rule.template,
    functionId,
    filePath,
    ...(target !== undefined ? { target } : {}),
    ...(discriminatorHas !== undefined ? { discriminatorHas } : {}),
    ...(rule.template === 'no-cyclic-deps' ? { cycle: true as const } : {}),
  };
}

export function violationKey(v: Violation): string {
  return [v.functionId, v.filePath, v.target ?? '', ...(v.discriminator ?? [])].join('\u0001');
}

export function newViolations(base: readonly Violation[], mutant: readonly Violation[]): Violation[] {
  const seen = new Set(base.map(violationKey));
  return mutant.filter((v) => !seen.has(violationKey(v)));
}

export function matchesKey(v: Violation, k: ExpectedKey): boolean {
  if (v.functionId !== k.functionId) return false;
  if (k.cycle === true) {
    const files = new Set(v.filePath.split(','));
    if (v.target !== undefined && v.target !== null) files.add(v.target);
    return files.has(k.filePath) && (k.target === undefined || files.has(k.target));
  }
  if (v.filePath !== k.filePath) return false;
  if (k.target !== undefined && (v.target ?? '') !== k.target) return false;
  if (k.discriminatorHas !== undefined && !(v.discriminator ?? []).includes(k.discriminatorHas)) return false;
  return true;
}

export type RowStatus = 'detected' | 'missed' | 'silent' | 'false-fire' | 'apply-error' | 'typecheck' | 'evaluate-error';

export interface RunRow {
  readonly rowId: string;
  readonly operatorId: string;
  readonly positiveId: string;
  readonly role: 'positive' | 'twin';
  readonly baseId: string;
  readonly baseKind: 'reference' | 'real';
  readonly style: string;
  readonly site: MutationSite;
  readonly status: RowStatus;
  readonly expected: readonly ExpectedKey[];
  readonly absentTemplates: readonly string[];
  /** Per expected key: was it matched by a new violation? */
  readonly hits: readonly boolean[];
  readonly newBlocking: readonly Violation[];
  readonly newAdvisory: readonly Violation[];
  readonly typecheckErrors: readonly string[];
  readonly editedFiles: readonly string[];
  readonly createdFiles: readonly string[];
  readonly stubs: readonly string[];
  readonly diff: string;
}

export interface FeasibilityCell {
  readonly baseId: string;
  readonly style: string;
  readonly operatorId: string;
  readonly candidates: number;
  readonly eligible: number;
  readonly sampled: number;
  readonly rejected: Readonly<Record<string, number>>;
}

export interface OperatorSummary {
  readonly operatorId: string;
  readonly role: 'positive' | 'twin';
  readonly style: string;
  readonly candidates: number;
  readonly eligible: number;
  readonly applied: number;
  readonly compiled: number;
  readonly evaluated: number;
  /** Positives: rows with every expected key matched. Twins: rows with a new blocking violation. */
  readonly hits: number;
  readonly rate: number | null;
  readonly low: number | null;
  readonly high: number | null;
  /** Positives only: per expected template, matched rows / evaluated rows. */
  readonly perTemplate: Readonly<Record<string, { readonly hit: number; readonly of: number }>>;
  /** Positives only: rows with a new blocking violation that no expected key accounts for. */
  readonly blockingCollateral: number;
}

const COMPILED: readonly RowStatus[] = ['detected', 'missed', 'silent', 'false-fire', 'evaluate-error'];
const EVALUATED: readonly RowStatus[] = ['detected', 'missed', 'silent', 'false-fire'];

export function summarise(rows: readonly RunRow[], cells: readonly FeasibilityCell[], ops: readonly MutationOperator[]): OperatorSummary[] {
  const out: OperatorSummary[] = [];
  const styles = [...new Set(cells.map((c) => c.style))].sort();
  for (const op of ops) {
    for (const style of styles) {
      const cs = cells.filter((c) => c.operatorId === op.id && c.style === style);
      if (cs.length === 0) continue;
      const rs = rows.filter((r) => r.operatorId === op.id && r.style === style);
      const evaluated = rs.filter((r) => EVALUATED.includes(r.status));
      const role = op.role === 'twin' ? 'twin' : 'positive';
      const hits = evaluated.filter((r) => (role === 'positive' ? r.status === 'detected' : r.status === 'false-fire')).length;
      const ci = evaluated.length > 0 ? wilson(hits, evaluated.length) : undefined;
      const perTemplate: Record<string, { hit: number; of: number }> = {};
      let blockingCollateral = 0;
      if (role === 'positive') {
        for (const r of evaluated) {
          r.expected.forEach((k, i) => {
            const e = perTemplate[k.template] ?? { hit: 0, of: 0 };
            perTemplate[k.template] = { hit: e.hit + (r.hits[i] === true ? 1 : 0), of: e.of + 1 };
          });
          if (r.newBlocking.some((v) => !r.expected.some((k) => matchesKey(v, k)))) blockingCollateral++;
        }
      }
      out.push({
        operatorId: op.id,
        role,
        style,
        candidates: cs.reduce((s, c) => s + c.candidates, 0),
        eligible: cs.reduce((s, c) => s + c.eligible, 0),
        applied: rs.filter((r) => r.status !== 'apply-error').length,
        compiled: rs.filter((r) => COMPILED.includes(r.status)).length,
        evaluated: evaluated.length,
        hits,
        rate: evaluated.length > 0 ? hits / evaluated.length : null,
        low: ci?.low ?? null,
        high: ci?.high ?? null,
        perTemplate,
        blockingCollateral,
      });
    }
  }
  return out;
}

/** Deterministic 32-bit seed of a string (FNV-1a), for per-cell site sampling. */
export function seedOf(text: string, master: number): number {
  let h = 0x811c9dc5 ^ master;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function fmtRate(rate: number | null, low: number | null, high: number | null): string {
  if (rate === null || low === null || high === null) return '—';
  return `${rate.toFixed(2)} [${low.toFixed(2)}, ${high.toFixed(2)}]`;
}
