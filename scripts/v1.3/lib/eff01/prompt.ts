/**
 * EFF-01 prompt frame (note §5; design DR-6; A1 condition sentences DR-A1-1). Identical for every condition except the
 * condition sentence. Placeholders are replaced in one pass, so a `{{…}}` or `$` inside the spec text is kept as is.
 */
import { sha256Hex } from './inputs.js';
import type { Eff01Question } from './inputs.js';
import { CONDITION_SENTENCES } from './types.js';
import type { Eff01Condition } from './types.js';

export const FRAME_TEMPLATE = [
  'You are answering one question about the architecture of a TypeScript project. Base your answer on evidence you gather in this session.',
  '',
  '{{CONDITION_SENTENCE}}',
  '',
  "The project's architecture spec (the `architecture:` block of its spec YAML):",
  '{{ARCHITECTURE_BLOCK}}',
  '',
  'Conventions:',
  '{{CONVENTIONS}}',
  '',
  'Question: {{QUESTION}}',
  '',
  'End your reply with exactly one line:',
  'ANSWER: {{ANSWER_FORMAT}}',
  '',
].join('\n');

export const FRAME_SHA256 = sha256Hex(FRAME_TEMPLATE);

/** The calibration prompt (DR-2): no frame, no question. */
export const CALIBRATION_PROMPT = 'Reply OK';

export interface PromptInput {
  readonly condition: Eff01Condition;
  readonly archBlock: string;
  readonly conventions: readonly string[];
  readonly question: Pick<Eff01Question, 'text' | 'answerFormat'>;
}

export function buildPrompt(input: PromptInput): string {
  const values: Record<string, string> = {
    CONDITION_SENTENCE: CONDITION_SENTENCES[input.condition],
    ARCHITECTURE_BLOCK: input.archBlock,
    CONVENTIONS: input.conventions.join('\n'),
    QUESTION: input.question.text,
    ANSWER_FORMAT: JSON.stringify(input.question.answerFormat),
  };
  return FRAME_TEMPLATE.replace(/\{\{([A-Z_]+)\}\}/g, (whole, name: string) => values[name] ?? whole);
}
