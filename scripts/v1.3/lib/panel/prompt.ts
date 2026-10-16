/**
 * v1.3 model panel: the ONE prompt and schema every vendor gets (Docs/v1.3/model-panel.md §3).
 *
 * The system prompt, question, options, option permutation, answer schema and parser are the meaningful labeller's
 * (`meaningful-prompt.ts`), so the panel and the single-model labeller ask the same thing. The only difference is that
 * the panel renders an item that is already blind (`PanelItem`), whatever sheet it came from.
 *
 * Blinding (`blindingProblems`) is checked on every rendered prompt before any call; an item that fails is never
 * sent. Outside the code block: no rule id, no template name, no tool verdict wording (violation, severity, tier,
 * TP/FP), no source wording (decoy, manifest). Inside the code block: no rule id and no comment marker left by the
 * scrubber's input (`// VIOLATION`, `near-miss`), which would mean the excerpt was not scrubbed.
 */
import { BUILT_IN_TYPE_TEMPLATES } from '../labelling/findings.js';
import { LETTERS, QUESTION, RESPONSE_SCHEMA_TEXT, SYSTEM_PROMPT } from '../labelling/meaningful-prompt.js';
import type { MeaningfulLabel } from '../labelling/meaningful-prompt.js';
import { EDGE_TEMPLATES } from '../labelling/union.js';
import type { PanelItem } from './items.js';

export { SYSTEM_PROMPT as PANEL_SYSTEM_PROMPT, RESPONSE_SCHEMA_TEXT as PANEL_SCHEMA_TEXT };
export const PANEL_PROMPT_VERSION = 'panel-v1';

export function renderPanelPrompt(item: PanelItem, order: readonly MeaningfulLabel[]): string {
  return [
    '## Architectural style',
    item.styleDefinition,
    '',
    '## Code excerpt',
    `File: ${item.file}`,
    '```ts',
    item.excerpt ?? '(file not readable)',
    '```',
    '',
    '## Reported finding',
    item.claim,
    '',
    '## Question',
    QUESTION,
    ...order.map((o, i) => `${LETTERS[i] ?? '?'}. ${o}`),
    '',
    'Reply with JSON only: {"choice": "<letter>", "reason": "<one sentence>"}',
  ].join('\n');
}

const TEMPLATE_NAMES: readonly string[] = [...new Set([...Object.values(BUILT_IN_TYPE_TEMPLATES), ...EDGE_TEMPLATES])]
  .filter((t) => t.includes('-'));

const PROSE_FORBIDDEN: readonly [RegExp, string][] = [
  [/\bFF-[A-Z]+\d+\b/, 'rule id'],
  [/\bviolat(ion|es|ed)\b/i, 'verdict wording (violation)'],
  [/\b(severity|blocking|advisory|tier)\b/i, 'verdict wording (severity/tier)'],
  [/\b(TP|FP|TRUE-BENIGN|true positive|false positive)\b/, 'verdict wording (TP/FP)'],
  [/\b(decoy|manifest|planted|near-miss)\b/i, 'source wording'],
];

const CODE_FORBIDDEN: readonly [RegExp, string][] = [
  [/\bFF-[A-Z]+\d+\b/, 'rule id in the excerpt'],
  [/\/\/\s*(VIOLATION|near-miss|OK\b|expected)/i, 'unscrubbed fixture comment in the excerpt'],
  [/\/\*\s*(VIOLATION|near-miss)/i, 'unscrubbed fixture comment in the excerpt'],
];

/** Every blinding problem of a rendered prompt (empty when it may be sent). */
export function blindingProblems(prompt: string): string[] {
  const m = /```ts\n([\s\S]*?)\n```/.exec(prompt);
  const code = m?.[1] ?? '';
  const prose = m === null ? prompt : prompt.replace(m[0], '');
  const out: string[] = [];
  for (const [re, what] of PROSE_FORBIDDEN) if (re.test(prose)) out.push(what);
  for (const t of TEMPLATE_NAMES) if (new RegExp(`\\b${t}\\b`).test(prose)) out.push(`template name ${t}`);
  for (const [re, what] of CODE_FORBIDDEN) if (re.test(code)) out.push(what);
  return [...new Set(out)];
}
