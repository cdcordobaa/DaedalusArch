/**
 * Judge v2 (v1.3 development, NOT frozen): rubric, persona and instructions selectable as `judgeVersion: 'v2'`.
 *
 * v1 (`rubric.ts`, `frozen.ts`) stays frozen and is the default. Nothing here is part of `FROZEN_VALUES`, so
 * `FROZEN_SHA256` does not move. v2 has its own hash (`JUDGE_V2_SHA256` is recomputed by a test) and a revision
 * label; every revision is a commit with its reason (`Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md`).
 *
 * What v2 changes, against the v1 blind spots seen in the judge catch rounds (development set):
 * - FF-N02 names, per layer kind, what is out of place even when it does no work: a web, transport or framework type
 *   in any signature of a core file (an unused optional parameter counts), framework or ORM decorators and base
 *   classes in a domain file, persistence or I/O in a domain file, and business rules in an infrastructure or
 *   presentation file.
 * - FF-N01 names the persistence bypass and the copied rule explicitly.
 * - The prompt carries the unit's APG neighbourhood (rendered) and the candidate flags of the cheap proxies
 *   (`src/apg-enrich/cheap`), labelled as unverified candidates.
 * The verdict schema is v1's (`VERDICT_JSON_SCHEMA`), so the structured output is unchanged.
 *
 * Probe independence (BR-U4-RUB-01) is kept: no v2 text uses `PROBE_CONSTRUCTION_VOCABULARY`.
 */
import { canonicalJSON, sha256Hex } from './canonical-json.js';
import type { RubricText } from './rubric.js';
import { FF_N01_ID, FF_N01_RUBRIC, FF_N02_ID, FF_N02_RUBRIC, RUBRIC_OUT_OF_SCOPE } from './rubric.js';
import { PROMPT_INSTRUCTIONS, JUDGE_PERSONA } from './frozen.js';
import { VERDICT_JSON_SCHEMA } from './verdict-schema.js';

export type JudgeVersion = 'v1' | 'v2';
export const JUDGE_VERSIONS: readonly JudgeVersion[] = ['v1', 'v2'];
export const DEFAULT_JUDGE_VERSION: JudgeVersion = 'v1';

/** Revision of the v2 texts; bumped with every committed prompt revision (at most 3 TUNE revisions). */
export const JUDGE_V2_REVISION = 'v2.0';

export const FF_N01_RUBRIC_V2: RubricText = Object.freeze({
  rule: FF_N01_RUBRIC.rule,
  pass: 'The files serve one cohesive concern, use the module\'s abstractions consistently, keep each rule or invariant in one place, and reach persistence only through the module\'s own repository or port.',
  fail: 'The files split into unrelated concerns; the same rule, invariant or validation is written out in two places (a copy, not a call to one shared definition); a class reaches persistence around the module\'s own repository or port (a database, ORM or query client used directly where the repository exists); or a file bypasses the module\'s own abstractions.',
  evidenceRequired: FF_N01_RUBRIC.evidenceRequired,
});

export const FF_N02_RUBRIC_V2: RubricText = Object.freeze({
  rule: 'The unit\'s responsibilities, signatures and annotations match the role of its declared layer.',
  pass: 'Every declaration in the file belongs to the role and kind of its declared layer, including its parameter, return and field types, its decorators and base classes, and its statements, and agrees with any ADR prose given.',
  fail: 'The file carries something that belongs to a different layer kind. In a domain or application file: a type of a web, transport or framework package in any signature (parameter, return or field), even when the parameter is optional or unused; or a request, response, status code or HTTP error of the delivery layer. In a domain file also: a framework or ORM decorator or base class (dependency injection, routing, persistence mapping), even when the class logic is pure; or persistence or I/O (queries, database or ORM clients, HTTP or file access). In an infrastructure or presentation file: a business rule, that is a domain invariant, calculation or decision that the domain or application layer should own. A type the project declares itself is not a framework type, whatever its name.',
  evidenceRequired: 'Name the file and cite the signature, decorator, declaration or statement that carries the misplaced responsibility, its package or origin, and the layer kind it belongs to.',
});

export const RUBRICS_V2: Readonly<Record<string, RubricText>> = Object.freeze({
  [FF_N01_ID]: FF_N01_RUBRIC_V2,
  [FF_N02_ID]: FF_N02_RUBRIC_V2,
});

/** v1 rubric of a function id (the frozen texts), for symmetry with `rubricV2Of`. */
export const RUBRICS_V1: Readonly<Record<string, RubricText>> = Object.freeze({
  [FF_N01_ID]: FF_N01_RUBRIC,
  [FF_N02_ID]: FF_N02_RUBRIC,
});

/** The v2 rubric of a function, or `undefined` for a function v2 does not define (it keeps its spec rubric). */
export function rubricV2Of(functionId: string): RubricText | undefined {
  return RUBRICS_V2[functionId];
}

export const JUDGE_V2_PERSONA =
  `${JUDGE_PERSONA} Some prompts list candidate flags raised by deterministic code checks: they are unverified hints, not findings. Confirm each against the source before you rely on it, and report violations that no flag names.`;

export const PROMPT_INSTRUCTIONS_V2 =
  `${PROMPT_INSTRUCTIONS} Check each candidate flag against the source: a flag the source does not support must not count against the unit, and a violation the flags miss counts as much as one they name. Judge what each declaration is, not only what it does at run time.`;

/** Budgets of the two v2 sections, in tokens (1 token = 4 characters, as in v1). */
export const JUDGE_V2_BUDGET = Object.freeze({ neighbourhood: 1500, candidateFlags: 600 });
/** Cheap proxies whose flags v2 shows (communities is a diagnostic, doc-text raises none; design note §9-10). */
export const JUDGE_V2_FLAG_PROXIES = Object.freeze([
  'clones', 'shared-literals', 'name-behaviour', 'cohesion', 'logic-density', 'repo-bypass', 'framework-in-core', 'vocabulary',
] as const);
export const JUDGE_V2_MAX_FLAGS = 12;

export const CANDIDATE_FLAGS_HEADER =
  'Candidates proposed by deterministic checks; verify, don\'t trust. Each line is a tool observation with its location, not a finding.';

export const JUDGE_V2_VALUES = Object.freeze({
  revision: JUDGE_V2_REVISION,
  rubric: { [FF_N01_ID]: FF_N01_RUBRIC_V2, [FF_N02_ID]: FF_N02_RUBRIC_V2, outOfScope: RUBRIC_OUT_OF_SCOPE },
  persona: JUDGE_V2_PERSONA,
  instructions: PROMPT_INSTRUCTIONS_V2,
  budget: JUDGE_V2_BUDGET,
  flagProxies: JUDGE_V2_FLAG_PROXIES,
  maxFlags: JUDGE_V2_MAX_FLAGS,
  candidateFlagsHeader: CANDIDATE_FLAGS_HEADER,
  verdictSchema: VERDICT_JSON_SCHEMA,
});

/** Test anchor: `sha256(canonicalJSON(JUDGE_V2_VALUES))` of the current revision. */
export const JUDGE_V2_SHA256 = 'b19f6623cec516575e343c7ea6b86e16e19777e151a67c0217be6db84d9d92ec';

export function computeJudgeV2Sha256(): string {
  return sha256Hex(canonicalJSON(JUDGE_V2_VALUES));
}
