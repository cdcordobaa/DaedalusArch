/**
 * Prompts of the multi-step loop (DRAFT wording; not frozen, not registered).
 *
 * - `stepPrompt`: the step's feature request wrapped in a fixed frame. Step 1 asks for a new system; steps 2..k say the
 *   cwd already holds the system from the earlier steps and ask for an extension that keeps the existing features.
 *   The arm's tool sentence is NOT added here: the agent adds it (`armPrompt`), so the frame is identical across arms.
 * - `repairPrompt` (gate arm only): the blocking findings of the firewall on the step's snapshot, listed by rule, file
 *   and line, with one instruction to fix them without removing features. At most `MAX_REPAIR_FINDINGS` are listed.
 *
 * - Style slot (`style.ts`): when the plan gives the task a target style, the styled frames replace the fixed
 *   "Clean Architecture" wording with the style sentence and the preset-derived folder-layout sentence. A task without
 *   a style keeps `FIRST_STEP_TEMPLATE` / `NEXT_STEP_TEMPLATE` byte for byte.
 * - The repair prompt says, in plain words, what each blocking rule it lists means (`RULE_PLAIN`), then lists the
 *   findings one per line as before.
 *
 * All templates are plain text with `{{…}}` slots and are hashed into every turn record (`promptSha256`), so a
 * change in wording shows in the data.
 */
import { createHash } from 'node:crypto';
import type { StyleFrame } from './style.js';
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

/** First step with a style slot (`style.ts`). */
export const STYLED_FIRST_STEP_TEMPLATE = [
  'You are building a new TypeScript backend service in the current directory, in several feature steps.',
  'This is step {{STEP_NUMBER}} of {{STEP_COUNT}} of "{{TASK_TITLE}}".',
  '',
  'Feature request:',
  '{{REQUEST}}',
  '',
  'Put the source under src/. {{STYLE_SENTENCE}}',
  '{{LAYOUT_SENTENCE}}',
  'Before you finish, type-check the project with exactly this command and fix every error it reports:',
  '{{TYPECHECK_COMMAND}}',
  '',
].join('\n');

/** Later steps with a style slot. */
export const STYLED_NEXT_STEP_TEMPLATE = [
  'The current directory holds a TypeScript backend service built in earlier feature steps.',
  'This is step {{STEP_NUMBER}} of {{STEP_COUNT}} of "{{TASK_TITLE}}". Extend the existing service; keep every existing feature working.',
  '',
  'Feature request:',
  '{{REQUEST}}',
  '',
  'Keep the source under src/ and follow the architecture the project already uses ({{STYLE_NAME}}).',
  '{{LAYOUT_SENTENCE}}',
  'Before you finish, type-check the project with exactly this command and fix every error it reports:',
  '{{TYPECHECK_COMMAND}}',
  '',
].join('\n');

export const REPAIR_TEMPLATE = [
  'An architecture check of the current directory reported {{FINDING_COUNT}} blocking violation(s) after your last change.',
  '',
  'In plain words, the check found:',
  '{{PLAIN}}',
  '',
  'The violations, one per line (rule, file and line):',
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

/** The frame template a step uses (the hash of each is recorded at the pilot freeze). */
export function stepTemplate(stepIndex: number, frame?: StyleFrame): string {
  if (frame === undefined) return stepIndex === 0 ? FIRST_STEP_TEMPLATE : NEXT_STEP_TEMPLATE;
  return stepIndex === 0 ? STYLED_FIRST_STEP_TEMPLATE : STYLED_NEXT_STEP_TEMPLATE;
}

export function stepPrompt(task: LoopTask, stepIndex: number, typecheckCommand: string, frame?: StyleFrame): string {
  const step = task.steps[stepIndex];
  if (step === undefined) throw new RangeError(`task ${task.id} has no step ${String(stepIndex)}`);
  return fill(stepTemplate(stepIndex, frame), {
    STEP_NUMBER: String(stepIndex + 1),
    STEP_COUNT: String(task.steps.length),
    TASK_TITLE: task.title,
    REQUEST: step.request.trim(),
    TYPECHECK_COMMAND: typecheckCommand,
    ...(frame !== undefined ? { STYLE_SENTENCE: frame.styleSentence, STYLE_NAME: frame.styleName, LAYOUT_SENTENCE: frame.layoutSentence } : {}),
  });
}

/**
 * Plain-language meaning of each blocking rule, keyed by the rule name of the specs (`Docs/v1.3/rule-tiers.md`; the
 * same id carries different names across presets, e.g. FF-S01 `dependency-direction` vs `dependency-direction-graph`).
 */
export const RULE_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  'dependency-direction': 'code in an inner layer imports code from an outer layer; dependencies must point inward, towards the domain',
  'dependency-direction-graph':
    'a module imports a layer it may not depend on; adapters may depend on the application and the domain, the application only on the domain, and the domain on nothing outside it',
  'no-cyclic-deps': 'some files import each other in a circle; break the cycle so that the dependencies go one way',
  'no-layer-skip': 'a layer imports a layer it must reach only through the layer in between',
  'layer-skip-graph': 'a module imports a layer it has no allowed connection to (for example one adapter importing another adapter); go through a port of the application instead',
  'no-domain-outward-dep': 'the domain imports code outside it; the domain must not depend on the application, infrastructure or framework code',
  'core-isolation': 'the core (domain or application) imports an adapter or outside code; the core must depend on nothing outside it',
  'domain-purity': 'the domain imports a framework, an HTTP library or an I/O module; keep the domain free of frameworks and I/O',
  'repository-pattern': 'a repository is not split into an interface in the domain and an implementation in infrastructure, or code uses the concrete repository class instead of its interface',
  'port-adapter-pattern': 'an outbound adapter does not implement a port (an interface) declared in the domain or the application',
  'port-dependency-inversion': 'a use case depends on a concrete adapter instead of a port interface',
  'domain-state-purity': 'a domain class receives an infrastructure or framework object through its constructor',
  'bounded-context-modules': 'some files lie outside every declared bounded context folder',
  'context-isolation':
    "one bounded context imports another context's internal files; imports across contexts must go through that context's public API (its index.ts or contracts folder) or an anti-corruption layer",
  'aggregate-boundary': 'code outside an aggregate reaches an object inside it directly; outside code may only hold and use the aggregate root',
  'repository-aggregate-root': 'a repository is provided for something that is not an aggregate root',
  'value-object-immutability': 'a value object can be changed after it is created (a field that is not readonly, or a setter)',
});

/** One line per rule among the listed findings: the plain meaning (or the first message), the count and the rule. */
export function plainSummary(findings: readonly BlockingFinding[]): string {
  const groups = new Map<string, { name: string; first: string; n: number }>();
  for (const f of findings) {
    const key = `${f.ruleId} ${f.ruleName}`;
    const g = groups.get(key);
    if (g === undefined) groups.set(key, { name: f.ruleName, first: f.message, n: 1 });
    else g.n++;
  }
  return [...groups.entries()]
    .map(([key, g]) => `- ${RULE_PLAIN[g.name] ?? g.first} (${String(g.n)} place${g.n === 1 ? '' : 's'}; rule ${key})`)
    .join('\n');
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
    PLAIN: plainSummary(findings.slice(0, MAX_REPAIR_FINDINGS)),
    FINDINGS: listed.join('\n'),
    TYPECHECK_COMMAND: typecheckCommand,
  });
}
