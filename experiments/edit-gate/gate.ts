/**
 * Edit gate (v1.5-exp, exploratory; never the Study 2b instrument), the pure part: finding keys, per-session
 * de-duplication, the message text, the hook replies and the work-tree path check. No I/O except `insideTree`'s
 * `realpath`. Design: `ops/notes/v15-edit-gate-design.md` §2 and §4. The checks themselves are DETECT-02's
 * `check_consistency` (R-D4, R-XCTX), imported read-only by the hub (`hub.ts`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ConsistencyFinding } from '../detect-02/mcp/consistency.js';

export const GATED_TOOLS: readonly string[] = ['Edit', 'Write', 'MultiEdit'];
export const MAX_FINDINGS_PER_MESSAGE = 3;
export const MAX_LINES_PER_FINDING = 12;

/** Note §6: mid-refactor transients. One sentence at the end of every edit message. */
export const TRANSIENT_NOTE =
  'If you are in the middle of a change, finish it; the check runs again after each edit.';

export interface KeyedFinding extends ConsistencyFinding {
  /** rule | command file | command name | sorted aggregates. No line, so a line shift keeps the key. */
  readonly key: string;
  readonly command: string;
  readonly aggregates: readonly string[];
}

export function ruleLabel(rule: string): string {
  return rule === 'R-D4' ? 'one aggregate per command' : rule === 'R-XCTX' ? 'cross-context write' : 'one aggregate per command; cross-context write';
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The key of a finding. `consistency.ts` starts every `why` with `<command> (<file>:<line>)`, so the command name is
 * read from there; the aggregates are the spec's aggregate roots named (as whole words) in `why`.
 */
export function keyOf(f: ConsistencyFinding, aggregateRoots: readonly string[]): KeyedFinding {
  const m = /^(.+?) \([^()]*:\d+\)/.exec(f.why);
  const command = m?.[1] ?? `${f.file}:${String(f.line)}`;
  const aggregates = aggregateRoots.filter((r) => new RegExp(`(^|[^A-Za-z0-9_])${escapeRe(r)}([^A-Za-z0-9_]|$)`).test(f.why)).sort();
  return { ...f, command, aggregates, key: [f.rule, f.file, command, aggregates.join(',')].join('|') };
}

export interface Delta {
  readonly fresh: readonly KeyedFinding[];
  readonly resolved: readonly KeyedFinding[];
  readonly open: readonly KeyedFinding[];
}

/**
 * Per-session de-duplication (note §2). `shown` holds the keys already shown; an update shows only keys not in it,
 * and reports once each shown key that has disappeared (it leaves `shown`, so it is new again if it comes back).
 */
export class GateState {
  private readonly shown = new Map<string, KeyedFinding>();
  private open: KeyedFinding[] = [];
  private readonly stopBlocked = new Set<string>();

  update(current: readonly KeyedFinding[]): Delta {
    const now = new Map(current.map((f) => [f.key, f]));
    const fresh = [...now.values()].filter((f) => !this.shown.has(f.key));
    const resolved = [...this.shown.values()].filter((f) => !now.has(f.key));
    for (const f of resolved) this.shown.delete(f.key);
    // New keys join `shown`; kept keys take their latest location, so a later `resolved:` line names it.
    for (const f of now.values()) this.shown.set(f.key, f);
    this.open = [...now.values()];
    return { fresh, resolved, open: this.open };
  }

  get openFindings(): readonly KeyedFinding[] {
    return this.open;
  }

  /** The Stop hook blocks at most once per turn. */
  claimStop(turn: string): boolean {
    if (this.stopBlocked.has(turn)) return false;
    this.stopBlocked.add(turn);
    return true;
  }
}

/** One finding, at most `MAX_LINES_PER_FINDING` lines (writes are cut first). */
export function formatFinding(f: ConsistencyFinding): string[] {
  const head = [`Architecture check: ${f.file}:${String(f.line)} [${ruleLabel(f.rule)}]`, `Rule: ${f.ruleText}`, `Why: ${f.why}`];
  const room = MAX_LINES_PER_FINDING - head.length - 1;
  const writes = f.writes.length <= room ? f.writes.map((w) => `Write: ${w}`) : [...f.writes.slice(0, room - 1).map((w) => `Write: ${w}`), `Write: … and ${String(f.writes.length - room + 1)} more`];
  return [...head, ...writes, `Fix: ${f.fix}`];
}

function findingsBlock(fs_: readonly ConsistencyFinding[]): string[] {
  const out: string[] = [];
  for (const f of fs_.slice(0, MAX_FINDINGS_PER_MESSAGE)) out.push(...formatFinding(f), '');
  if (fs_.length > MAX_FINDINGS_PER_MESSAGE) out.push(`… and ${String(fs_.length - MAX_FINDINGS_PER_MESSAGE)} more`, '');
  return out;
}

/** The PostToolUse text: new findings, then resolved lines; empty when there is nothing new. */
export function editMessage(d: Delta): string {
  if (d.fresh.length === 0 && d.resolved.length === 0) return '';
  const out = findingsBlock(d.fresh);
  for (const f of d.resolved) out.push(`resolved: ${f.file}:${String(f.line)} [${ruleLabel(f.rule)}]`);
  if (d.fresh.length > 0) out.push(TRANSIENT_NOTE);
  return out.join('\n').replace(/\n+$/, '');
}

/** The Stop text: every finding still open. */
export function stopMessage(open: readonly ConsistencyFinding[]): string {
  const n = open.length;
  return [`Architecture check: ${String(n)} finding${n === 1 ? '' : 's'} still open in the code you changed. Address ${n === 1 ? 'it' : 'them'} before you finish.`, '', ...findingsBlock(open)].join('\n').replace(/\n+$/, '');
}

/** Hook replies (Claude Code hooks JSON on stdout); `''` means no output. */
export function postToolUseReply(text: string): string {
  return text === '' ? '' : JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } });
}
export function stopReply(text: string): string {
  return text === '' ? '' : JSON.stringify({ decision: 'block', reason: text });
}

/** The fields the hub reads from a hook's stdin JSON. Everything else (`transcript_path`, contents) is dropped. */
export interface HookEvent {
  readonly event: 'PostToolUse' | 'Stop' | 'other';
  readonly tool: string | null;
  readonly filePath: string | null;
  readonly cwd: string | null;
  readonly stopHookActive: boolean;
}

export function parseHookEvent(raw: string): HookEvent | null {
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof j !== 'object' || j === null) return null;
  const o = j as { hook_event_name?: unknown; tool_name?: unknown; tool_input?: { file_path?: unknown }; cwd?: unknown; stop_hook_active?: unknown };
  const name = o.hook_event_name === 'PostToolUse' || o.hook_event_name === 'Stop' ? o.hook_event_name : 'other';
  return {
    event: name,
    tool: typeof o.tool_name === 'string' ? o.tool_name : null,
    filePath: typeof o.tool_input?.file_path === 'string' ? o.tool_input.file_path : null,
    cwd: typeof o.cwd === 'string' ? o.cwd : null,
    stopHookActive: o.stop_hook_active === true,
  };
}

/** realpath of the longest existing prefix, plus the rest (a file the edit has just deleted, or not yet created). */
function realish(p: string): string {
  let head = path.resolve(p);
  const rest: string[] = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(head), ...rest);
    } catch {
      const up = path.dirname(head);
      if (up === head) return path.join(head, ...rest);
      rest.unshift(path.basename(head));
      head = up;
    }
  }
}

/** The tree-relative POSIX path of `file` when it is inside `tree` after resolving symlinks, else null (refused). */
export function insideTree(tree: string, file: string, cwd: string = tree): string | null {
  const root = realish(tree);
  const target = realish(path.resolve(cwd, file));
  const rel = path.relative(root, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const posix = rel.split(path.sep).join('/');
  return posix.split('/')[0] === 'node_modules' ? null : posix;
}
