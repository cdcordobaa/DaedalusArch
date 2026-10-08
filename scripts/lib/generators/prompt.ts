/**
 * Prompt templates and their instantiation (FR-v1.2E-28; Q17; ADR-012; BR-U5a-52; D-U5a-13).
 *
 * `scripts/generator/prompts/<specLevel>.md` holds one template per task, each in a section opened by the line
 * `<!-- task: <taskId> -->` (lines before the first marker are a file comment, not part of any template). A template
 * is the section's lines with leading and trailing blank lines removed, plus one final newline; it contains exactly
 * one `{{TYPECHECK_COMMAND}}`. `promptTemplateId` = `<specLevel>/<taskId>`, `promptTemplateSha256` = sha256 of the
 * template text (UTF-8). Instantiation replaces the placeholder with the exact allowed command of BR-U5a-41
 * (`typecheckCommand(<H>, runId)`), so re-instantiating the frozen template with the recorded `runId` and
 * `harnessRoot` reproduces `promptSha256`. Files are read with `path.resolve(repoRoot, …)` (D-U5a-13).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { typecheckCommand } from './argv.js';
import { TASK_IDS } from './schedule.js';
import type { PromptInstance, PromptProvider, SpecLevel, TaskId } from './types.js';

export const PROMPT_PLACEHOLDER = '{{TYPECHECK_COMMAND}}';
export const PROMPT_TEMPLATE_DIR = 'scripts/generator/prompts';
export const PROMPT_TEMPLATE_INVALID = 'GEN_PROMPT_TEMPLATE_INVALID';
const TASK_MARKER = /^<!-- task: ([a-z-]+) -->$/;

export function sha256Text(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function promptTemplateFile(repoRoot: string, level: SpecLevel): string {
  return path.resolve(repoRoot, PROMPT_TEMPLATE_DIR, `${level}.md`);
}

export function countPlaceholders(text: string): number {
  return text.split(PROMPT_PLACEHOLDER).length - 1;
}

function invalid<T>(message: string, context?: Record<string, unknown>): DomainResult<T> {
  return DomainResult.fail([context === undefined ? { code: PROMPT_TEMPLATE_INVALID, message } : { code: PROMPT_TEMPLATE_INVALID, message, context }]);
}

function trimBlankLines(lines: readonly string[]): string {
  let a = 0;
  let b = lines.length;
  while (a < b && (lines[a] ?? '').trim() === '') a++;
  while (b > a && (lines[b - 1] ?? '').trim() === '') b--;
  return `${lines.slice(a, b).join('\n')}\n`;
}

/** The task sections of a template file; every task present once, each with exactly one placeholder. */
export function parsePromptTemplateFile(text: string): DomainResult<Readonly<Record<TaskId, string>>> {
  const sections = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = TASK_MARKER.exec(line);
    if (m !== null) {
      const task = m[1] ?? '';
      if (sections.has(task)) return invalid('a task section appears twice', { task });
      current = [];
      sections.set(task, current);
      continue;
    }
    current?.push(line);
  }
  const out: Partial<Record<TaskId, string>> = {};
  for (const task of TASK_IDS) {
    const lines = sections.get(task);
    if (lines === undefined) return invalid('a task section is missing', { task });
    const template = trimBlankLines(lines);
    const n = countPlaceholders(template);
    if (n !== 1) return invalid(`a template must contain exactly one ${PROMPT_PLACEHOLDER}`, { task, placeholders: n });
    out[task] = template;
  }
  for (const task of sections.keys()) if (!TASK_IDS.includes(task as TaskId)) return invalid('unknown task section', { task });
  return DomainResult.ok(Object.freeze(out as Record<TaskId, string>));
}

/** BR-U5a-52: the template must hold exactly one placeholder; the command replaces it. */
export function instantiatePrompt(template: string, command: string): DomainResult<string> {
  const n = countPlaceholders(template);
  if (n !== 1) return invalid(`a template must contain exactly one ${PROMPT_PLACEHOLDER}`, { placeholders: n });
  if (command.length === 0 || command.includes(PROMPT_PLACEHOLDER)) return invalid('the type-check command is empty or holds the placeholder');
  return DomainResult.ok(template.replace(PROMPT_PLACEHOLDER, () => command));
}

export interface PromptTemplate {
  readonly promptTemplateId: string;
  readonly template: string;
  readonly promptTemplateSha256: string;
}

export function loadPromptTemplate(repoRoot: string, level: SpecLevel, taskId: TaskId): DomainResult<PromptTemplate> {
  let text: string;
  try {
    text = fs.readFileSync(promptTemplateFile(repoRoot, level), 'utf8');
  } catch {
    return invalid('prompt template file not readable', { level });
  }
  const parsed = parsePromptTemplateFile(text);
  if (!parsed.success) return DomainResult.fail(parsed.errors);
  const template = parsed.data[taskId];
  return DomainResult.ok({ promptTemplateId: `${level}/${taskId}`, template, promptTemplateSha256: sha256Text(template) });
}

/** Re-instantiation from the recorded `harnessRoot` and `runId` (the BR-U5a-52 reproduction check). */
export function instantiateForRun(template: PromptTemplate, harnessRoot: string, runId: string): DomainResult<PromptInstance> {
  const prompt = instantiatePrompt(template.template, typecheckCommand(harnessRoot, runId));
  if (!prompt.success) return DomainResult.fail(prompt.errors);
  return DomainResult.ok({
    promptTemplateId: template.promptTemplateId,
    promptTemplateSha256: template.promptTemplateSha256,
    prompt: prompt.data,
    promptSha256: sha256Text(prompt.data),
  });
}

/** The committed templates as the grid's `PromptProvider`. */
export function filePromptProvider(repoRoot: string): PromptProvider {
  return (req, command) => {
    const t = loadPromptTemplate(repoRoot, req.specLevel, req.taskId);
    if (!t.success) return DomainResult.fail(t.errors);
    if (req.promptTemplateId !== t.data.promptTemplateId) return invalid('promptTemplateId must be <specLevel>/<taskId>');
    const prompt = instantiatePrompt(t.data.template, command);
    if (!prompt.success) return DomainResult.fail(prompt.errors);
    return DomainResult.ok({
      promptTemplateId: t.data.promptTemplateId,
      promptTemplateSha256: t.data.promptTemplateSha256,
      prompt: prompt.data,
      promptSha256: sha256Text(prompt.data),
    });
  };
}
