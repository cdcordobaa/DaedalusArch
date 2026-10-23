/**
 * DRIFT-01 (v1.5-exp): the v1.5 rules' findings as drift identities, and their exposure count. Pure, zero calls.
 *
 * Identity (design note §5). The Study 2b unit is a distinct edge `source|target` (`scripts/lib/drift/identity.ts`,
 * edge grain). A v1.5 finding (R-D4, R-XCTX) is a command, not an import, so its edges are command → aggregate root:
 * - source: `<command file>#<command name>` (the `#` keeps these edges apart from import edges of the frozen rules,
 *   which would otherwise merge with, for example, a planted FF-DS02 import from the same file to the same root);
 * - target: the root's declaration file;
 * - R-D4: one edge per root the command writes; R-XCTX: one edge per root of another context it writes.
 * An R-D4 and an R-XCTX on the same command and root share the edge, as FF-S01 and FF-S03 share one in Study 2b.
 *
 * Exposure (secondary). An opportunity is a command (not an event handler, not a pure delegate) that writes at least
 * one aggregate root; a violation is such a command flagged by R-D4 or R-XCTX. This is the v1.5 analogue of the
 * frozen FF-S03 exposure counter, which covers Layered only.
 */
import type { CommandFact, Facts } from '../../detect-02/lib/facts.js';
import type { Finding } from '../../detect-02/lib/graph.js';
import type { IdFinding, RenameMap } from '../../../scripts/lib/drift/types.js';

export const V15_RULES: readonly string[] = ['R-D4', 'R-XCTX'];
/** The other DETECT-02 families: reported as a secondary, never in D_v15 (not yet verified, v15-plan §1). */
export const V15_OTHER_RULES: readonly string[] = ['R-D5', 'R-D9', 'R-H5', 'R-INJ', 'R-RTX'];

type FactsLike = Pick<Facts, 'roots' | 'commands'>;

const methodOf = (subject: string): string => (subject.includes('.') ? (subject.split('.').pop() as string) : subject);

/** The command a finding names: same file and method (the rules' `subject` is `Class.method`). */
export function commandOf(f: Pick<Finding, 'file' | 'subject'>, facts: FactsLike): CommandFact | undefined {
  const m = methodOf(f.subject);
  return facts.commands.find((c) => c.file === f.file && (c.name === f.subject || methodOf(c.name) === m));
}

export const sourceOf = (file: string, subject: string): string => `${file}#${subject}`;

/** The v1.5 identities of one tree: counted findings only (status `violation`), edge per (command, root). */
export function v15Identities(findings: readonly Finding[], facts: FactsLike): IdFinding[] {
  const out = new Map<string, IdFinding>();
  for (const f of findings) {
    if (f.status !== 'violation' || !V15_RULES.includes(f.rule)) continue;
    const c = commandOf(f, facts);
    const ctxOf = (root: string): string | null => facts.roots.find((r) => r.name === root)?.context ?? null;
    const roots = c === undefined ? [] : [...new Set(c.writes.map((w) => w.root))].filter((r) => f.rule === 'R-D4' || ctxOf(r) !== c.context);
    const targets = roots.map((r) => facts.roots.find((x) => x.name === r)?.file).filter((x): x is string => x !== undefined);
    // A finding whose command or roots cannot be resolved keeps one edge to a pseudo-file, so it is never dropped.
    for (const t of targets.length > 0 ? targets : [`${f.file}.unresolved.ts`]) {
      const id: IdFinding = { functionId: f.rule, filePath: sourceOf(f.file, f.subject), target: t, tier: 'blocking' };
      out.set(`${id.filePath}|${t}|${f.rule}`, id);
    }
  }
  return [...out.values()].sort((a, b) => `${a.filePath}|${a.target}|${a.functionId}`.localeCompare(`${b.filePath}|${b.target}|${b.functionId}`));
}

/**
 * ρ for v1.5 sources: every `old → new` file rename also renames `old#X → new#X` for each command source seen in
 * the earlier snapshot, so a moved command keeps its lineage, as a moved import does.
 */
export function withCommandRenames(rho: RenameMap, earlier: readonly IdFinding[]): Map<string, string> {
  const out = new Map(rho);
  for (const f of earlier) {
    const i = f.filePath.indexOf('#');
    if (i < 0) continue;
    const file = f.filePath.slice(0, i);
    const to = rho.get(file);
    if (to !== undefined) out.set(f.filePath, `${to}${f.filePath.slice(i)}`);
  }
  return out;
}

export interface Exposure { readonly opportunities: number; readonly violations: number; readonly commands: readonly string[] }

/** Exposure of R-D4/R-XCTX: writing commands, and how many of them are flagged. */
export function v15Exposure(findings: readonly Finding[], facts: Pick<Facts, 'commands'>): Exposure {
  // The rules' own delegation test (`detect-02/lib/graph.ts`): a command that delegates to a same-class command with
  // the same write sites reports at the delegate, so it is not an opportunity of its own.
  const sites = (c: CommandFact): string => [...new Set(c.writes.map((w) => `${w.file}:${String(w.line)}`))].sort().join('|');
  const byId = new Map(facts.commands.map((c) => [c.id, c] as const));
  const delegating = (c: CommandFact): boolean => c.delegatesTo.some((d) => { const t = byId.get(d); return t !== undefined && t.writes.length > 0 && sites(t) === sites(c); });
  const opp = facts.commands.filter((c) => !c.eventHandler && !delegating(c) && c.writes.length > 0);
  const flagged = new Set(findings.filter((f) => f.status === 'violation' && V15_RULES.includes(f.rule)).map((f) => `${f.file}#${methodOf(f.subject)}`));
  const hit = opp.filter((c) => flagged.has(`${c.file}#${methodOf(c.name)}`));
  return { opportunities: opp.length, violations: hit.length, commands: opp.map((c) => `${c.file}#${c.name}`).sort() };
}
