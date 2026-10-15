/**
 * v1.3 labelling: the neutral MEANINGFUL prompt (Docs/v1.3/validation-protocol.md §3, "meaningful").
 *
 * The labeller sees four things and nothing else: the code excerpt around the finding, the style's definition from
 * Docs/v1.3/style-rule-sources.md (rule names, sources and constraints, with every rule id and template name
 * removed), the finding's claim without its rule id, and the question with three options. The options are shown
 * as letters; run 0 lists them in the canonical order, run 1 in a seeded permutation of it, and the answer letter is
 * mapped back before the runs are compared.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Finding } from './findings.js';
import { createRng } from '../../../lib/stats.js';
import { derivedSeed } from './sampler.js';
import { stripComments } from './excerpt-scrub.js';

export const MEANINGFUL_OPTIONS = ['yes', 'no', 'uncertain'] as const;
export type MeaningfulLabel = (typeof MEANINGFUL_OPTIONS)[number];

export const STYLE_SOURCES_DOC = 'Docs/v1.3/style-rule-sources.md';
/** Lines of source either side of the finding's line (the labeller window of BR-U5b-35). */
export const EXCERPT_WINDOW = 15;
export const LETTERS = ['A', 'B', 'C'] as const;

export const SYSTEM_PROMPT = [
  'You are a software architect reviewing a TypeScript code base against an architectural style.',
  'Judge only from the material in the message: the style definition, the code excerpt and the reported finding.',
  'You have no tools. Reply with one JSON object and nothing else.',
].join(' ');

export const QUESTION = 'Would an architect following this style want this changed?';

/** Spec style name -> the Style column labels of style-rule-sources.md that define it. */
export const STYLE_LABELS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'clean-architecture': ['Clean'],
  layered: ['Layered'],
  hexagonal: ['Hexagonal'],
  ddd: ['DDD'],
  nestjs: ['Clean', 'NestJS'],
});

export interface StyleRow { readonly styles: readonly string[]; readonly rule: string; readonly source: string; readonly constraint: string }

/** The rows of the style-rule-sources table, with parentheticals (rule ids, template names) cut from the rule name. */
export function parseStyleSources(doc: string): StyleRow[] {
  const rows: StyleRow[] = [];
  for (const line of doc.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line) || /^\|\s*Style\s*\|/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    const [style, rule, source, constraint] = cells as [string, string, string, string];
    rows.push({
      styles: style.split(',').map((s) => s.trim()),
      rule: rule.replace(/\s*\([^)]*\)/g, '').trim(),
      source, constraint,
    });
  }
  return rows;
}

export function styleDefinition(doc: string, style: string): string {
  const labels = STYLE_LABELS[style] ?? [];
  const rows = parseStyleSources(doc).filter((r) => r.styles.some((s) => labels.includes(s)));
  if (rows.length === 0) return `(no definition recorded for style ${style})`;
  return rows.map((r) => `- ${r.rule}: ${r.constraint} (${r.source})`).join('\n');
}

export function loadStyleSources(repoRoot: string): string {
  return fs.readFileSync(path.join(repoRoot, STYLE_SOURCES_DOC), 'utf8');
}

/**
 * Numbered source lines around `line` (the first 31 lines when the line is unknown), with every comment removed
 * (`stripComments`): fixture comments can state the answer. Line numbers are those of the original file.
 */
export function excerpt(content: string, line: number | undefined, window = EXCERPT_WINDOW): string {
  const lines = stripComments(content).split('\n');
  const from = line === undefined ? 1 : Math.max(1, line - window);
  const to = Math.min(lines.length, line === undefined ? 1 + 2 * window : line + window);
  const out: string[] = [];
  for (let n = from; n <= to; n += 1) out.push(`${String(n).padStart(5)} | ${lines[n - 1] ?? ''}`);
  return out.join('\n');
}

const RULE_ID = /\bFF-[A-Z]+\d+\b/g;

/** The finding's claim without its rule id, template name or violation type. */
export function claimText(f: Finding): string {
  const d = f.discriminator;
  let text: string;
  switch (f.template) {
    case 'repository-pattern':
      text = `Class ${d[0] ?? '?'} in ${f.file} is a repository class that implements no interface.`;
      break;
    case 'port-adapter-pattern':
      text = `Class ${d[0] ?? '?'} in ${f.file}, an outbound adapter, implements no port interface declared in the core or the application layer.`;
      break;
    case 'domain-state-purity':
      text = `Domain class ${d[0] ?? '?'} in ${f.file} receives ${d[1] ?? '?'} (declared in ${f.target ?? '?'}) through ${d[2] === 'FLOWS_TO' ? 'field' : 'constructor parameter'} ${d[3] ?? '?'}.`;
      break;
    case 'bounded-context-modules':
      text = `${f.file} lies in no declared bounded context.`;
      break;
    default:
      text = f.message.startsWith('Violation in ') ? `Reported at ${f.file}.` : f.message;
  }
  const extra: string[] = [];
  if (f.line !== undefined) extra.push(`line ${String(f.line)}`);
  if (f.target !== undefined && !text.includes(f.target)) extra.push(`target ${f.target}`);
  if (f.evidence.length > 0) extra.push(`measured ${f.evidence.join(', ')}`);
  const full = extra.length > 0 ? `${text} (${extra.join('; ')})` : text;
  const noId = full.replace(RULE_ID, '');
  const noTemplate = f.template === '' ? noId : noId.split(f.template).join('');
  return noTemplate.replace(/\s{2,}/g, ' ').trim();
}

/** The option order of a run: canonical for run 0, a seeded non-identity permutation for run 1. */
export function optionOrder(runIndex: 0 | 1, seed: number, itemKey: string): MeaningfulLabel[] {
  const canonical = [...MEANINGFUL_OPTIONS];
  if (runIndex === 0) return canonical;
  const perms: MeaningfulLabel[][] = [
    ['yes', 'uncertain', 'no'], ['no', 'yes', 'uncertain'], ['no', 'uncertain', 'yes'],
    ['uncertain', 'yes', 'no'], ['uncertain', 'no', 'yes'],
  ];
  return perms[createRng(derivedSeed(seed, 'options', itemKey)).int(perms.length)] ?? canonical;
}

export interface PromptInput {
  readonly finding: Finding;
  /** The file's text, or null when it is not readable under the project root. */
  readonly source: string | null;
  readonly styleDefinition: string;
  readonly order: readonly MeaningfulLabel[];
}

export function renderPrompt(p: PromptInput): string {
  const f = p.finding;
  return [
    '## Architectural style',
    p.styleDefinition,
    '',
    '## Code excerpt',
    `File: ${f.file}`,
    '```ts',
    p.source === null ? '(file not readable)' : excerpt(p.source, f.line),
    '```',
    '',
    '## Reported finding',
    claimText(f),
    '',
    '## Question',
    QUESTION,
    ...p.order.map((o, i) => `${LETTERS[i] ?? '?'}. ${o}`),
    '',
    'Reply with JSON only: {"choice": "<letter>", "reason": "<one sentence>"}',
  ].join('\n');
}

export const RESPONSE_SCHEMA_TEXT = JSON.stringify({
  type: 'object',
  properties: { choice: { type: 'string', enum: [...LETTERS] }, reason: { type: 'string' } },
  required: ['choice', 'reason'],
});

export interface ParsedAnswer { readonly label: MeaningfulLabel; readonly reason: string }

/** Reads `{"choice","reason"}` (a fenced block or surrounding text is tolerated) and maps the letter back. */
export function parseAnswer(text: string, order: readonly MeaningfulLabel[]): ParsedAnswer | { readonly invalid: string } {
  const m = /\{[\s\S]*\}/.exec(text);
  if (m === null) return { invalid: 'no JSON object' };
  let v: unknown;
  try { v = JSON.parse(m[0]); } catch { return { invalid: 'malformed JSON' }; }
  if (typeof v !== 'object' || v === null) return { invalid: 'not an object' };
  const o = v as Record<string, unknown>;
  const choice = typeof o.choice === 'string' ? o.choice.trim() : '';
  const reason = typeof o.reason === 'string' ? o.reason.trim() : '';
  const idx = LETTERS.indexOf(choice.toUpperCase() as (typeof LETTERS)[number]);
  const byWord = MEANINGFUL_OPTIONS.find((w) => w === choice.toLowerCase());
  const label = idx >= 0 ? order[idx] : byWord;
  if (label === undefined) return { invalid: `choice '${choice}' is not an option` };
  if (reason === '') return { invalid: 'empty reason' };
  return { label, reason };
}

export const REASK_SUFFIX = '\n\nYour previous reply was not valid. Reply with exactly one JSON object: {"choice": "<letter>", "reason": "<one sentence>"}.';
