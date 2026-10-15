/**
 * Prompts of the multi-step loop (DRAFT wording; not frozen, not registered).
 *
 * - `stepPrompt`: the step's feature request wrapped in a fixed frame. Step 1 asks for a new system; steps 2..k say the
 *   cwd already holds the system from the earlier steps and ask for an extension that keeps the existing features.
 *   The arm's tool sentence is NOT added here: the agent adds it (`armPrompt`), so the frame is identical across arms.
 * - `repairPrompt` (gate arm only): the blocking findings of the firewall on the step's snapshot, listed by rule, file
 *   and line, with one instruction to fix them without removing features. At most `MAX_REPAIR_FINDINGS` are listed.
 *
 * Both templates are plain text with `{{…}}` slots and are hashed into every turn record (`promptSha256`), so a
 * change in wording shows in the data.
 */
import { createHash } from 'node:crypto';
import type { BlockingFinding, LoopTask } from './types.js';

export const MAX_REPAIR_FINDINGS = 40;

export const FIRST_STEP_TEMPLATE = [
  'You are building a new TypeScript backend service in the current directory, in several feature steps.',
  'This is step {{STEP_NUMBER}} of {{STEP_COUNT}} of "{{TASK_TITLE}}".',
  '',
  'Feature request:',
  '{{REQUEST}}',
  '',
  'Put the source under src/. Organise the code following Clean Architecture.',
  'Before you finish, type-check the project with exactly this command and fix every error it reports:',
  '{{TYPECHECK_COMMAND}}',
  '',
].join('\n');

export const NEXT_STEP_TEMPLATE = [
  'The current directory holds a TypeScript backend service built in earlier feature steps.',
  'This is step {{STEP_NUMBER}} of {{STEP_COUNT}} of "{{TASK_TITLE}}". Extend the existing service; keep every existing feature working.',
  '',
  'Feature request:',
  '{{REQUEST}}',
  '',
  'Keep the source under src/ and follow the architecture the project already uses (Clean Architecture).',
  'Before you finish, type-check the project with exactly this command and fix every error it reports:',
  '{{TYPECHECK_COMMAND}}',
  '',
].join('\n');

export const REPAIR_TEMPLATE = [
  'An architecture check of the current directory reported {{FINDING_COUNT}} blocking violation(s) after your last change:',
  '',
  '{{FINDINGS}}',
  '',
  'Fix these violations by moving or restructuring code. Do not remove features and do not delete the files that',
  'implement them. Then type-check the project with exactly this command and fix every error it reports:',
  '{{TYPECHECK_COMMAND}}',
  '',
].join('\n');

function fill(template: string, slots: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (whole, name: string) => slots[name] ?? whole);
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function stepPrompt(task: LoopTask, stepIndex: number, typecheckCommand: string): string {
  const step = task.steps[stepIndex];
  if (step === undefined) throw new RangeError(`task ${task.id} has no step ${String(stepIndex)}`);
  return fill(stepIndex === 0 ? FIRST_STEP_TEMPLATE : NEXT_STEP_TEMPLATE, {
    STEP_NUMBER: String(stepIndex + 1),
    STEP_COUNT: String(task.steps.length),
    TASK_TITLE: task.title,
    REQUEST: step.request.trim(),
    TYPECHECK_COMMAND: typecheckCommand,
  });
}

/** One line per finding: `- [<rule id> <rule name>] <file>:<line> <message>` (target appended when present). */
export function formatFinding(f: BlockingFinding): string {
  const where = f.line !== undefined ? `${f.filePath}:${String(f.line)}` : f.filePath;
  const target = f.target !== undefined ? ` (imports ${f.target})` : '';
  return `- [${f.ruleId} ${f.ruleName}] ${where}${target}: ${f.message}`;
}

export function repairPrompt(findings: readonly BlockingFinding[], blockingCount: number, typecheckCommand: string): string {
  const listed = findings.slice(0, MAX_REPAIR_FINDINGS).map(formatFinding);
  const more = blockingCount - listed.length;
  if (more > 0) listed.push(`- … and ${String(more)} more`);
  return fill(REPAIR_TEMPLATE, {
    FINDING_COUNT: String(blockingCount),
    FINDINGS: listed.join('\n'),
    TYPECHECK_COMMAND: typecheckCommand,
  });
}
