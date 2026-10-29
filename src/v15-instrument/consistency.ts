/**
 * v1.5 instrument (Stage 0, 2026-10-26): promoted from `experiments/detect-02/mcp/consistency.ts`; the logic is unchanged and the
 * prototype stays in place as the record of the exploratory runs.
 *
 * DETECT-02 `check_consistency` (v1.5-exp, exploratory): the two puzzle-trap rules, R-D4 (one command writes two or
 * more aggregate instances) and R-XCTX (a command writes an aggregate owned by another bounded context), turned into
 * messages an agent can act on. Symbolic only: no model call. Shared by the MCP tool (`server.ts`, pull mode) and the
 * push gate (`push-gate.ts`).
 *
 * 2026-10-29 (instrument v1.5.1, `rule-set.ts`): `rules` widens the check to any set of v1.5 Cypher rules (the delivery
 * hub passes the style's scored set from the one rule list). R-D4 and R-XCTX keep their messages and keys below; every
 * other rule's finding gets its message from `rule-messages.ts` and its key from the scorer's identity (rule | file |
 * subject). Without `rules` the check is the R-D4/R-XCTX pair, unchanged.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadRules, runTree } from './graph.js';
import type { Rule } from './graph.js';
import type { CommandFact, FootprintWrite } from './facts.js';
import { cypherMessage, labelOf, RULE_TEXT } from './rule-messages.js';

export const CONSISTENCY_RULES = ['R-D4', 'R-XCTX'] as const;

export interface ConsistencyFinding {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  /** The rule in plain words. */
  readonly ruleText: string;
  /** Why this code breaks it: the command, the aggregates, the calls. */
  readonly why: string;
  readonly fix: string;
  /** Where the writes happen (file:line and the store method), in call order. */
  readonly writes: readonly string[];
  /** Rules other than R-D4/R-XCTX: the finding's Cypher subject (its identity is rule | file | subject, as the scorer's). */
  readonly subject?: string;
}

export interface ConsistencyResult {
  readonly status: 'clean' | 'violations' | 'not-applicable';
  readonly findings: readonly ConsistencyFinding[];
  readonly summary: string;
  readonly aggregateRoots: readonly string[];
  readonly rootsFrom: 'spec' | 'inferred' | 'none';
  readonly ms: number;
}

let allRules: Rule[] | undefined;
const rulesCache = new Map<string, Rule[]>();
/** The loaded Cypher rules with these ids (an id with no rule file is skipped, as `runTree` would not run it). */
const rulesOf = (ids: readonly string[]): Rule[] => {
  const k = [...ids].sort().join(',');
  let r = rulesCache.get(k);
  if (r === undefined) { r = (allRules ??= loadRules()).filter((x) => ids.includes(x.id)); rulesCache.set(k, r); }
  return r;
};
const isConsistencyRule = (id: string): boolean => (CONSISTENCY_RULES as readonly string[]).includes(id);

/** `src/x/A.ts#Transfer.execute@12:from` → `from`; collections and spreads are named as such. */
function instanceName(w: FootprintWrite): string {
  const k = w.instance.slice(w.instance.lastIndexOf(':') + 1).replace(/^this\./, '');
  return w.many ? `${k.replace(/\[\*\]$/, '')} (several instances)` : k;
}
const short = (unit: string): string => (unit.startsWith('{}.') ? `${unit.slice(3)} (published interface)` : unit);
const callChain = (w: FootprintWrite): string => [...w.via.map(short), w.sink].join(' → ');

function describe(rule: string, c: CommandFact, ownerOf: (root: string) => string | null): { why: string; fix: string; writes: string[] } {
  // The command's own aggregate first: a root of its own context, then the one written closest to the command.
  const sorted = [...c.writes].sort((a, b) => Number(ownerOf(a.root) !== c.context) - Number(ownerOf(b.root) !== c.context) || a.via.length - b.via.length || a.line - b.line);
  const perRoot = new Map<string, FootprintWrite[]>();
  for (const w of sorted) perRoot.set(w.root, [...(perRoot.get(w.root) ?? []), w]);
  const writes = [...new Set(c.writes.map((w) => `${w.file}:${w.line} ${w.sink}(…) via ${callChain(w)}`))];
  const cmd = `${short(c.name)} (${c.file}:${c.line})`;
  if (rule === 'R-D4') {
    const parts = [...perRoot].map(([root, ws]) => `${root}: ${[...new Set(ws.map(instanceName))].join(', ')}`);
    const first = [...perRoot.keys()][0] ?? 'the aggregate';
    const others = [...perRoot.keys()].slice(1);
    const why = `${cmd} saves more than one aggregate instance in the same call: ${parts.join('; ')}.`;
    const fix = others.length > 0
      ? `Let this command change and save only the ${first}. Have that aggregate record a domain event (stored with it), and change ${others.join(', ')} in a handler of that event, so each command writes one aggregate.`
      : `Let this command change and save one ${first}. Put the change of the other ${first} in a method that records a domain event, and apply it to the other instance in a handler of that event (idempotent per event), so each command writes one instance.`;
    return { why, fix, writes };
  }
  const mine = c.context ?? '?';
  const foreign = [...perRoot].filter(([root]) => { const o = ownerOf(root); return o !== null && o !== mine; });
  const why = `${cmd}, in context ${mine}, changes ${foreign.map(([root, ws]) => `${root} (owned by ${ownerOf(root)}) through ${callChain(ws[0]!)}`).join('; ')}.`;
  const own = [...perRoot.keys()].filter((root) => ownerOf(root) === mine);
  const fix = `Do not call the other context's write operation from this command. Record a domain event in ${own.length > 0 ? own.join(', ') : `${mine}'s own aggregate`} (saved with it), and let ${[...new Set(foreign.map(([root]) => ownerOf(root)))].join(', ')} subscribe to that event through its published interface and change its own aggregate there.`;
  return { why, fix, writes: writes.filter((w) => foreign.some(([root]) => c.writes.some((x) => x.root === root && w.startsWith(`${x.file}:${x.line} `)))) };
}

export interface CheckOptions {
  readonly root: string; readonly spec?: string | undefined; readonly files?: readonly string[] | undefined; readonly scratch?: string | undefined;
  /** The v1.5 Cypher rule ids to check (default: R-D4 and R-XCTX). */
  readonly rules?: readonly string[] | undefined;
  /**
   * A baseline tree (the session's seed): rules that read a baseline (`BuildOptions.baseline`; today R-MIRROR2's
   * stoplist) count what the seed already has as the project's own. Instrument v1.5.3: the hub and the scorers pass the seed.
   */
  readonly baseline?: string | undefined;
}

export async function checkConsistency(opts: CheckOptions): Promise<ConsistencyResult> {
  const scratch = opts.scratch ?? fs.mkdtempSync(path.join(os.tmpdir(), 'detect-02-mcp-'));
  const ids = opts.rules ?? CONSISTENCY_RULES;
  const selected = rulesOf(ids);
  const onlyConsistency = ids.every(isConsistencyRule);
  const r = await runTree(opts.root, selected, { spec: opts.spec, scratch, withApg: false, ...(opts.baseline !== undefined ? { baseline: opts.baseline } : {}) });
  const rootsFrom = r.facts.rootSource === 'spec' ? 'spec' : r.facts.rootSource === 'fallback' ? 'inferred' : 'none';
  const ownerOf = (root: string): string | null => r.facts.roots.find((x) => x.name === root)?.context ?? null;
  const merged = new Map<string, ConsistencyFinding>();
  const changed = opts.files?.map((f) => f.replace(/^\.\//, '')) ?? [];
  const findings: ConsistencyFinding[] = [];
  for (const f of [...r.findings].filter((x) => isConsistencyRule(x.rule)).sort((a, b) => (a.rule === 'R-XCTX' ? 1 : 0) - (b.rule === 'R-XCTX' ? 1 : 0))) {
    if (f.status !== 'violation') continue;
    const c = r.facts.commands.find((x) => x.file === f.file && x.line === f.line && x.name === f.subject);
    if (c === undefined) continue;
    if (changed.length > 0) {
      const involved = new Set([c.file, ...c.writes.flatMap((w) => [w.file, w.sinkSite.split(':')[0]!])]);
      if (!changed.some((x) => involved.has(x))) continue;
    }
    const d = describe(f.rule, c, ownerOf);
    const key = `${c.file}:${c.line}`;
    const prev = merged.get(key);
    if (prev === undefined) { merged.set(key, { file: f.file, line: f.line ?? c.line, rule: f.rule, ruleText: RULE_TEXT[f.rule] ?? f.rule, ...d }); continue; }
    // Both rules on one command: one finding; the cross-context fix also removes the second write.
    const x = prev.rule === 'R-XCTX' ? prev : { ...d, rule: f.rule };
    const o = prev.rule === 'R-XCTX' ? { ...d, rule: f.rule } : prev;
    merged.set(key, { file: prev.file, line: prev.line, rule: 'R-D4+R-XCTX', ruleText: `${RULE_TEXT['R-D4']} ${RULE_TEXT['R-XCTX']}`, why: `${o.why} ${x.why}`, fix: x.rule === 'R-XCTX' ? x.fix : o.fix, writes: [...new Set([...prev.writes, ...d.writes])] });
  }
  findings.push(...merged.values());
  // Every other rule: one finding per Cypher row, in the files asked about (all files when none are given).
  const seen = new Set<string>();
  for (const f of r.findings) {
    if (isConsistencyRule(f.rule) || f.status !== 'violation') continue;
    if (changed.length > 0 && !changed.includes(f.file)) continue;
    const id = `${f.rule}|${f.file}|${f.subject}`;
    if (seen.has(id)) continue;
    seen.add(id);
    findings.push({ file: f.file, line: f.line ?? 0, rule: f.rule, ...cypherMessage(f, selected.find((x) => x.id === f.rule)), writes: [], subject: f.subject });
  }
  if (!onlyConsistency) {
    const status = findings.length > 0 ? 'violations' : 'clean';
    const summary = status === 'clean'
      ? `No finding: the code checked follows the ${String(selected.length)} architecture rules of this check.`
      : `${String(findings.length)} finding(s) break an architecture rule: fix each before finishing the step.`;
    return { status, findings, summary, aggregateRoots: r.facts.roots.map((x) => x.name), rootsFrom, ms: r.ms };
  }
  const status = r.facts.roots.length === 0 ? 'not-applicable' : findings.length > 0 ? 'violations' : 'clean';
  const summary = status === 'not-applicable'
    ? 'No aggregate roots found (no DDD aggregates declared in the spec and none inferred), so there is nothing to check.'
    : status === 'clean'
      ? `No command writes more than one aggregate instance or another context's aggregate (checked ${r.facts.commands.length} commands, aggregates: ${r.facts.roots.map((x) => x.name).join(', ')}).`
      : `${findings.length} command(s) break a consistency boundary: fix each before finishing the step.`;
  return { status, findings, summary, aggregateRoots: r.facts.roots.map((x) => x.name), rootsFrom, ms: r.ms };
}

/** The plain-text form (push gate, and the text block of the MCP result). */
export function formatText(res: ConsistencyResult): string {
  if (res.findings.length === 0) return `check_consistency: ${res.summary}`;
  const out = [`check_consistency: ${res.summary}`];
  res.findings.forEach((f, i) => {
    const label = labelOf(f.rule);
    out.push('', `${i + 1}. ${f.file}:${f.line} [${label}]`,
      `   Rule: ${f.ruleText}`, `   Why: ${f.why}`, ...f.writes.map((w) => `   Write: ${w}`), `   Fix: ${f.fix}`);
  });
  return out.join('\n');
}
