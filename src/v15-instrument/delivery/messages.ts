/**
 * v1.5 combined delivery: the text both channels show (design note §1.3). The tested edit-gate format
 * (`../edit-gate/gate.ts`) is kept; the only change is ` (finding N)` at the end of each finding's first line and of
 * each `resolved:` line, so one identity is visible across channels. Pull answers carry one line per finding the
 * agent has already seen, instead of a second full block.
 */
import type { ConsistencyResult } from '../consistency.js';
import { formatFinding, MAX_FINDINGS_PER_MESSAGE, ruleLabel, TRANSIENT_NOTE, type KeyedFinding } from '../edit-gate/gate.js';
import type { PullAnnotation } from './ledger.js';

type Numbered = KeyedFinding & { readonly number: number };

export function numberedFinding(f: Numbered): string[] {
  const lines = formatFinding(f);
  lines[0] = `${lines[0]!} (finding ${String(f.number)})`;
  return lines;
}

function block(fs_: readonly Numbered[]): string[] {
  const out: string[] = [];
  for (const f of fs_.slice(0, MAX_FINDINGS_PER_MESSAGE)) out.push(...numberedFinding(f), '');
  if (fs_.length > MAX_FINDINGS_PER_MESSAGE) out.push(`… and ${String(fs_.length - MAX_FINDINGS_PER_MESSAGE)} more`, '');
  return out;
}

/** PostToolUse text: new findings, then `resolved:` lines; empty when there is nothing new. */
export function pushMessage(fresh: readonly Numbered[], resolved: readonly Numbered[]): string {
  if (fresh.length === 0 && resolved.length === 0) return '';
  const out = block(fresh);
  for (const f of resolved) out.push(`resolved: ${f.file}:${String(f.line)} [${ruleLabel(f.rule)}] (finding ${String(f.number)})`);
  if (fresh.length > 0) out.push(TRANSIENT_NOTE);
  return out.join('\n').replace(/\n+$/, '');
}

/** Stop text: every finding still open, whichever channel showed it (the tested first line). */
export function stopText(open: readonly Numbered[]): string {
  const n = open.length;
  return [`Architecture check: ${String(n)} finding${n === 1 ? '' : 's'} still open in the code you changed. Address ${n === 1 ? 'it' : 'them'} before you finish.`, '', ...block(open)].join('\n').replace(/\n+$/, '');
}

/** `check_consistency` text for a pull: the frozen `formatText` layout, numbered, with seen findings as one line. */
export function pullConsistencyText(res: ConsistencyResult, keyed: readonly KeyedFinding[], notes: readonly PullAnnotation[]): string {
  const out = [`check_consistency: ${res.summary}`];
  keyed.forEach((f, i) => {
    const a = notes[i]!;
    const head = `${String(i + 1)}. ${f.file}:${String(f.line)} [${ruleLabel(f.rule)}] (finding ${String(a.number)}${a.status === 'already reported' ? ', already reported' : ''})`;
    if (a.status === 'already reported') { out.push('', head); return; }
    out.push('', head, `   Rule: ${f.ruleText}`, `   Why: ${f.why}`, ...f.writes.map((w) => `   Write: ${w}`), `   Fix: ${f.fix}`);
  });
  return out.join('\n');
}

/** The line put before a frozen tool's JSON answer (check_file, check_diff) when it holds keyed layer findings. */
export function pullFrozenHeader(keyed: readonly KeyedFinding[], notes: readonly PullAnnotation[]): string {
  if (keyed.length === 0) return '';
  return `Findings in this answer: ${keyed.map((f, i) => `finding ${String(notes[i]!.number)} (${notes[i]!.status}) ${f.rule} ${f.file}:${String(f.line)}`).join('; ')}`;
}
