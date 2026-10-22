/**
 * U3 (S1): the severity rubric, as an exploratory prompt variant of C4 `c4-v0.2` (`ops/notes/v15-u3-severity-note.md` §3).
 *
 * Nothing in `src/` changes. The C4 prompt is rendered by `interpretationPrompt` (read-only import), and only its
 * severity instruction (item 4) is replaced with the rubric. The schema, the system prompt, the grounding and the
 * scorer are the frozen ones. `rubricPrompt` throws if the frozen item 4 is not found, so a drift in `src/` cannot
 * silently produce a prompt without the rubric.
 */
import { interpretationPrompt } from '../../src/apg-enrich/ontology/interpretation.js';
import type { InterpretationContext } from '../../src/apg-enrich/ontology/interpretation.js';

/** The variant's version; the frozen one is `c4-v0.2`. A new revision gets a new suffix and a dated changelog line. */
export const U3_PROMPT_VERSION = 'c4-v0.2+u3-r1';

/** Item 4 of the frozen `c4-v0.2` prompt, verbatim. */
export const FROZEN_SEVERITY_LINE = '4. severityClass: rank the work inside the blocking tier (high, medium, low). It never moves the finding out of the blocking tier.';

/** The rubric (note §3). Decided in order: grant, declared rule, then what the dependency does. */
export const SEVERITY_RUBRIC = [
  '4. severityClass: rank the finding inside the blocking tier with this rubric. It never moves the finding out of the blocking tier. Go in order and stop at the first step that applies:',
  '   a. A current doc or comment line grants this case on purpose (your exceptionClaim is true): low.',
  '   b. A current doc, ADR or comment declares the rule this code breaks (your intentMatch is contradicts-declared-intent): high. The team said no and the code does it anyway; a small fix does not lower it.',
  '   c. Nothing is declared on it (no-declared-intent): rank by what the dependency does.',
  '      - high: the domain or core depends on infrastructure, a framework, an adapter or I/O; or the code changes state that another context owns.',
  '      - medium: a layer or a port is bypassed to change state or to run business logic in the wrong place.',
  '      - low: a read-only shortcut, or a dependency on a plain value type, that one file can undo.',
  '   A superseded, rejected, proposed or expired decision grants nothing and declares nothing by itself; a current decision that replaces it and forbids the code counts for step b. A TODO or a mention that states no rule declares nothing.',
].join('\n');

/** The C4 prompt with the rubric in place of the frozen item 4. */
export function rubricPrompt(ctx: InterpretationContext): string {
  const frozen = interpretationPrompt(ctx);
  if (!frozen.includes(FROZEN_SEVERITY_LINE)) throw new Error('the frozen c4-v0.2 severity line was not found; the variant would not apply');
  return frozen.replace(FROZEN_SEVERITY_LINE, SEVERITY_RUBRIC);
}

/** The control arm: the frozen prompt, unchanged. */
export function controlPrompt(ctx: InterpretationContext): string {
  return interpretationPrompt(ctx);
}
