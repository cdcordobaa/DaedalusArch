/**
 * Renderings of a gate result: human (terminal), Markdown (the pull request comment and the job summary) and JSON.
 * Pure.
 */
import type { GateFinding, GateResult } from './types.js';

/** First line of the Markdown comment; the action finds and updates its previous comment by it. */
export const COMMENT_MARKER = '<!-- daedalus-ci-gate -->';

/** Rows listed per Markdown section; the counts always cover every row. */
export const MAX_MARKDOWN_ROWS = 50;

const short = (sha: string): string => sha.slice(0, 12);

function where(f: GateFinding): string {
  const at = f.line !== undefined ? `${f.file}:${String(f.line)}` : f.file;
  return f.target !== undefined ? `${at} -> ${f.target}` : at;
}

function counts(rows: readonly GateFinding[]): string {
  const b = rows.filter((f) => f.tier === 'blocking').length;
  return `${String(rows.length)} (${String(b)} blocking)`;
}

export function formatGateJSON(result: GateResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatGateHuman(result: GateResult): string {
  const lines: string[] = [];
  lines.push(`Architecture gate: ${result.verdict.toUpperCase()} (${String(result.newBlocking)} new blocking finding(s))`);
  if (result.headBlockingNotExecuted !== undefined) {
    lines.push(`  incomplete: blocking rule(s) failed to execute on head: ${result.headBlockingNotExecuted.join(', ')}`);
  }
  lines.push(`  base ${result.base.ref} ${short(result.base.sha)}: ${String(result.base.findings)} finding(s)`);
  lines.push(`  head ${result.head.ref} ${short(result.head.sha)}: ${String(result.head.findings)} finding(s)`);
  lines.push(`  engine ${result.engine}, spec ${result.spec}, project ${result.project}`);
  lines.push(`  new ${counts(result.new)}, fixed ${counts(result.fixed)}, unchanged ${String(result.unchanged.length)}`);
  const section = (title: string, rows: readonly GateFinding[], withFix: boolean): void => {
    if (rows.length === 0) return;
    lines.push('', `${title}:`);
    for (const f of rows) {
      lines.push(`  [${f.tier}] ${f.ruleId} ${f.ruleName}  ${where(f)}`);
      lines.push(`    ${f.message}`);
      if (withFix && f.fix !== undefined) lines.push(`    Fix: ${f.fix}`);
    }
  };
  section('New', result.new, true);
  section('Fixed', result.fixed, false);
  return lines.join('\n');
}

/** A Markdown table cell: one line, pipes and backticks neutralised. */
function cell(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').replace(/`/g, "'");
}

function code(text: string): string {
  return `\`${text.replace(/`/g, "'").replace(/\|/g, '\\|')}\``;
}

function table(rows: readonly GateFinding[], withFix: boolean): string[] {
  const head = withFix
    ? ['| Tier | Rule | Where | Finding | Fix hint |', '|---|---|---|---|---|']
    : ['| Tier | Rule | Where | Finding |', '|---|---|---|---|'];
  const body = rows.slice(0, MAX_MARKDOWN_ROWS).map((f) => {
    const cols = [f.tier, `${f.ruleId} ${cell(f.ruleName)}`, code(where(f)), cell(f.message)];
    if (withFix) cols.push(cell(f.fix ?? ''));
    return `| ${cols.join(' | ')} |`;
  });
  const more = rows.length > MAX_MARKDOWN_ROWS ? [``, `_${String(rows.length - MAX_MARKDOWN_ROWS)} more not listed; see the JSON output._`] : [];
  return [...head, ...body, ...more];
}

export function formatGateMarkdown(result: GateResult): string {
  const icon = result.verdict === 'pass' ? ':white_check_mark:' : ':x:';
  const lines: string[] = [COMMENT_MARKER];
  lines.push(
    `### ${icon} Architecture gate: ${result.verdict === 'pass' ? 'pass' : 'fail'}`,
    '',
    result.verdict === 'pass'
      ? 'This change introduces no new blocking architecture finding.'
      : result.newBlocking > 0
        ? `This change introduces **${String(result.newBlocking)} new blocking** architecture finding(s).`
        : 'This change introduces no new blocking architecture finding, but the check is **incomplete**.',
    ...(result.headBlockingNotExecuted !== undefined
      ? ['', `Blocking rule(s) that failed to execute on head, so it cannot pass: ${result.headBlockingNotExecuted.map((id) => code(id)).join(', ')}.`]
      : []),
    '',
    '| | Findings |',
    '|---|---|',
    `| New in head | ${counts(result.new)} |`,
    `| Fixed | ${counts(result.fixed)} |`,
    `| Unchanged | ${String(result.unchanged.length)} |`,
    '',
    `Base \`${short(result.base.sha)}\` → head \`${short(result.head.sha)}\` · engine \`${result.engine}\` · spec \`${result.spec}\` · project \`${result.project}\``,
  );
  if (result.new.length > 0) lines.push('', '#### New findings', '', ...table(result.new, true));
  if (result.fixed.length > 0) lines.push('', '#### Fixed findings', '', ...table(result.fixed, false));
  if (result.unchanged.length > 0) {
    const byRule = new Map<string, number>();
    for (const u of result.unchanged) {
      const label = `${u.head.ruleId} ${u.head.ruleName} (${u.head.tier})`;
      byRule.set(label, (byRule.get(label) ?? 0) + 1);
    }
    lines.push('', '<details><summary>Unchanged findings by rule (already on the base)</summary>', '', '| Rule | Rows |', '|---|---|');
    for (const [rule, n] of [...byRule.entries()].sort(([a], [b]) => a.localeCompare(b))) lines.push(`| ${cell(rule)} | ${String(n)} |`);
    lines.push('', '</details>');
  }
  lines.push('', '<sub>Only new blocking findings fail this check. Matching: rule + file + target; line moves are tolerated.</sub>');
  return lines.join('\n') + '\n';
}
