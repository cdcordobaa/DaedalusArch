/**
 * Delivered = scored, recorded at study time (the first study's DEV-3 lesson: the hub delivered R-D4/R-XCTX and the
 * layer rules while the scorer counted more). Zero calls, no instrument file changed: the audit wraps the delivery
 * hub's two test seams (`DeliveryHubOptions.check`, `.checkLayers`), so the rules-frozen root stays as sealed.
 *
 * Every check the hub actually runs (a tree-digest cache hit runs none) leaves one record: the rule IDs it asked for,
 * the Cypher IDs that have a rule file (the check silently skips the others), the file scope, the tree digest in the
 * hub's own format (`treeDigest` of its push log: first 16 hex of sha256 over the sorted `file\0sha256` lines), and
 * the findings as `rule|file|line`. The driver writes the records into `session.json` (`deliveryAudit`); the scorer
 * checks each record's list against the style's scored lists and flags the block on any difference, as it does for
 * fail-open, and compares the findings with its own on the same tree (gate (a), symbolic rules only).
 */
import { createHash } from 'node:crypto';
import type { checkConsistency } from '../../../src/v15-instrument/consistency.js';
import { treeHashes } from '../../../src/v15-instrument/edit-gate/hub.js';
import type { checkLayers } from '../../../src/v15-instrument/edit-gate/layers.js';
import { loadRules } from '../../../src/v15-instrument/index.js';
import { MIRROR_SEM_RULE } from '../../../src/v15-instrument/mirror-sem.js';
import { cypherRules, frozenRules, type Style } from '../../../src/v15-instrument/rule-set.js';

export interface CheckRecord {
  readonly n: number;
  readonly turn: string | null;
  readonly kind: 'cypher' | 'frozen';
  /** The rule IDs the hub passed. */
  readonly requested: readonly string[];
  /** Cypher: the requested IDs that have a rule file (what ran). Frozen: = requested. */
  readonly ran: readonly string[];
  /** null: the whole project. */
  readonly files: readonly string[] | null;
  readonly treeDigest: string;
  /** `rule|file|line`, sorted. */
  readonly findings: readonly string[];
  readonly error?: string;
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
/** The hub's tree digest (`digestOf` in `delivery/hub.ts`), first 16 hex, as its push log writes `treeDigest`. */
export const treeDigest = (root: string): string => sha([...treeHashes(root)].sort(([a], [b]) => (a < b ? -1 : 1)).map(([f, x]) => `${f}\0${x}`).join('\n')).slice(0, 16);

let ruleFiles: Set<string> | null = null;
const withRuleFile = (ids: readonly string[]): string[] => { ruleFiles ??= new Set(loadRules().map((r) => r.id)); return ids.filter((i) => ruleFiles!.has(i)); };
const fkey = (f: { rule: string; file: string; line: number | null }): string => `${f.rule}|${f.file}|${String(f.line ?? '')}`;

export class DeliveryAudit {
  readonly records: CheckRecord[] = [];
  turn: string | null = null;

  wrapCheck(inner: typeof checkConsistency): typeof checkConsistency {
    return async (o) => {
      const requested = [...(o.rules ?? [])].sort();
      const base = { n: this.records.length + 1, turn: this.turn, kind: 'cypher' as const, requested, ran: withRuleFile(requested).sort(), files: o.files === undefined ? null : [...o.files].sort(), treeDigest: treeDigest(o.root) };
      try {
        const r = await inner(o);
        this.records.push({ ...base, findings: r.findings.map(fkey).sort() });
        return r;
      } catch (e) {
        this.records.push({ ...base, findings: [], error: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
        throw e;
      }
    };
  }

  wrapLayers(inner: typeof checkLayers): typeof checkLayers {
    return async (o) => {
      const requested = [...(o.rules ?? [])].sort();
      const base = { n: this.records.length + 1, turn: this.turn, kind: 'frozen' as const, requested, ran: requested, files: [...o.changed].sort(), treeDigest: treeDigest(o.root) };
      try {
        const r = await inner(o);
        this.records.push({ ...base, findings: r.findings.map(fkey).sort() });
        return r;
      } catch (e) {
        this.records.push({ ...base, findings: [], error: (e instanceof Error ? e.message : String(e)).slice(0, 200) });
        throw e;
      }
    };
  }
}

export interface AuditVerdict {
  readonly present: boolean;
  readonly checks: number;
  readonly mismatches: readonly { readonly n: number; readonly kind: 'cypher' | 'frozen'; readonly missing: readonly string[]; readonly extra: readonly string[] }[];
  /** Counted rule IDs never in any record's `ran` list (a counted rule the hub never delivered), when there were checks. */
  readonly countedNotDelivered: readonly string[];
  readonly flagged: boolean;
  readonly reasons: readonly string[];
}

const diff = (want: readonly string[], got: readonly string[]): { missing: string[]; extra: string[] } => ({ missing: want.filter((x) => !got.includes(x)), extra: got.filter((x) => !want.includes(x)) });

/**
 * The scorer's check of one `combined` session. Every Cypher record's `ran` must equal `cypherRules(style)` and every
 * frozen record's list `frozenRules(style)`; with `require`, a missing audit is flagged too (the first study's records
 * have none, so its re-scoring passes `require: false`). A session with no check (no edit) is not flagged.
 */
export function auditVerdict(records: readonly CheckRecord[] | undefined, style: Style, counted: readonly string[], opts: { readonly require: boolean }): AuditVerdict {
  if (records === undefined) return { present: false, checks: 0, mismatches: [], countedNotDelivered: [], flagged: opts.require, reasons: opts.require ? ['no delivery audit in session.json'] : [] };
  const want = { cypher: cypherRules(style).sort(), frozen: frozenRules(style).sort() };
  const mismatches = records.flatMap((r) => { const d = diff(want[r.kind], r.ran); return d.missing.length + d.extra.length === 0 ? [] : [{ n: r.n, kind: r.kind, ...d }]; });
  // A counted rule of a kind with at least one check must be in some check of that kind (a session with no frozen
  // check, because nothing changed against the seed, says nothing about the frozen rules).
  const ranOf = (k: 'cypher' | 'frozen'): Set<string> | null => { const rs = records.filter((r) => r.kind === k); return rs.length === 0 ? null : new Set(rs.flatMap((r) => r.ran)); };
  const ran = { cypher: ranOf('cypher'), frozen: ranOf('frozen') };
  const countedNotDelivered = counted.filter((c) => { const set = c.startsWith('FF-') ? ran.frozen : ran.cypher; return set !== null && !set.has(c); });
  const reasons = [...(mismatches.length > 0 ? [`${String(mismatches.length)} check(s) ran a rule list other than the scored list`] : []), ...(countedNotDelivered.length > 0 ? [`counted rules never delivered: ${countedNotDelivered.join(', ')}`] : [])];
  return { present: true, checks: records.length, mismatches, countedNotDelivered, flagged: reasons.length > 0, reasons };
}

/**
 * Gate (a), findings part, on one step snapshot: the Cypher records whose tree digest equals the snapshot's, against
 * the scorer's own v15 hits on that snapshot, within each record's file scope, symbolic rules only (R-MIRROR-SEM is
 * a model fact: live in the hub, replay in the scorer, so it is left out). `comparable: false` when no record has the
 * snapshot's digest, or when the scorer neutralised an evasion file on this step (its tree is then not the hub's).
 */
export function findingsAgreement(records: readonly CheckRecord[], snapDigest: string, scorerHits: readonly { rule: string; file: string; line: number | null }[], opts: { readonly neutralised: boolean }): { readonly comparable: boolean; readonly records: number; readonly onlyHub: readonly string[]; readonly onlyScorer: readonly string[] } {
  const rs = records.filter((r) => r.kind === 'cypher' && r.treeDigest === snapDigest && r.error === undefined);
  if (rs.length === 0 || opts.neutralised) return { comparable: false, records: rs.length, onlyHub: [], onlyScorer: [] };
  const onlyHub = new Set<string>();
  const onlyScorer = new Set<string>();
  for (const r of rs) {
    const inScope = (f: { rule: string; file: string }): boolean => f.rule !== MIRROR_SEM_RULE && r.ran.includes(f.rule) && (r.files === null || r.files.includes(f.file));
    const hub = new Set(r.findings.filter((k) => { const [rule, file] = k.split('|'); return inScope({ rule: rule!, file: file! }); }));
    const sc = new Set(scorerHits.filter(inScope).map(fkey));
    for (const k of hub) if (!sc.has(k)) onlyHub.add(k);
    for (const k of sc) if (!hub.has(k)) onlyScorer.add(k);
  }
  return { comparable: true, records: rs.length, onlyHub: [...onlyHub].sort(), onlyScorer: [...onlyScorer].sort() };
}
