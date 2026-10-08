/**
 * Frozen rubric text for FF-N01 and FF-N02 (BR-U4-RUB-01; draft until BR-U4-SEN-01
 * passes, then frozen). Single source for the five YAMLs, the template registry
 * (U4-K6, BR-U4-RUB-02) and the corpus rubric step (BR-U4-RUB-03).
 *
 * Probe independence (RUB-01): no text here names, exemplifies or paraphrases a
 * U5a judge-probe construction (MO-X02, MO-X03); the examples are layer-kind
 * categories only.
 */

export interface RubricText {
  readonly rule: string;
  readonly pass: string;
  readonly fail: string;
  readonly evidenceRequired: string;
}

/** Last line of both rubrics (BR-U4-RUB-01); rendered in the prompt's `## Rubric` section (CTX-06). */
export const RUBRIC_OUT_OF_SCOPE =
  'Out of scope: import direction and layer-dependency rules, which are checked symbolically.';

/** FF-N01 (Integrity, judged per module). */
export const FF_N01_ID = 'FF-N01';
export const FF_N01_NAME = 'architectural-integrity';
export const FF_N01_RUBRIC: RubricText = Object.freeze({
  rule: 'The module\'s files form one coherent unit with a consistent abstraction and boundary.',
  pass: 'The files serve one cohesive concern, use the module\'s abstractions consistently, and keep each rule or invariant in one place.',
  fail: 'The files split into unrelated concerns, duplicate a rule or invariant that should live in one place, or bypass the module\'s own abstractions.',
  evidenceRequired: 'Name each file involved and cite the declarations that show the split, the duplication or the bypass.',
});

/** FF-N02 (Semantic, judged per file). */
export const FF_N02_ID = 'FF-N02';
export const FF_N02_NAME = 'intent-alignment';
export const FF_N02_RUBRIC: RubricText = Object.freeze({
  rule: 'The unit\'s responsibilities match the role of its declared layer.',
  pass: 'Every responsibility in the file belongs to the role and kind of its declared layer, and agrees with any ADR prose given.',
  fail: 'The file carries a responsibility that belongs to a different layer kind, for example persistence, transport or framework logic in a domain file, or business rules in an infrastructure or presentation file.',
  evidenceRequired: 'Name the file and cite the function, method or statement that carries the misplaced responsibility, and the layer kind it belongs to.',
});

/** Names retired by U4 (FR-22); the corpus step and the registry tests assert they are gone. */
export const RETIRED_RUBRIC_NAMES = Object.freeze(['srp-semantic', 'layering-intent'] as const);

/** Words a rubric must not contain (RUB-01 probe independence; MO-X02, MO-X03 vocabulary). */
export const PROBE_CONSTRUCTION_VOCABULARY = Object.freeze(['free function', 'controller', 'handler', 'guard', 'inline'] as const);
