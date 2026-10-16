/**
 * Judge v2.2 (v1.3 development, NOT frozen): selectable as `judgeVersion: 'v2.2'`. v1 (`rubric.ts`, `frozen.ts`) and
 * v2.1 (`judge-v2.ts`, `judgeVersion: 'v2'`) are untouched: their texts, hashes and prompts do not move.
 *
 * Why (`Docs/DiagnosticRuns/v1.3-judge-v2-2026-10-16.md` §8): v2.1 fails the layered style's business layer (declared
 * `kind: domain`) for calling its persistence layer. Two v2.1 FF-N02 clauses are keyed on the layer kind alone (the
 * domain I/O clause and the application-only constructor-wiring sentence), and the prompt shows neither the
 * architecture style nor the layers each layer may depend on. v2.2 changes exactly that:
 * - the layer model section renders the style and, per layer, the layers it may depend on (`context-v22.ts`), from the
 *   spec's layer model (`allowedDependencies` for graph styles; the layer order otherwise);
 * - FF-N02's domain I/O clause covers direct I/O only (a database, ORM, query, HTTP or file client the file itself
 *   creates, imports from a package or fetches globally); a call into a layer the file may depend on is not
 *   misplaced I/O; persistence or I/O reached through a layer the file may NOT depend on still is;
 * - the constructor-wiring exemption extends from application files to any file, for types of its own layer or of a
 *   layer it may depend on.
 * Kept from v2.1: the framework and ORM type, decorator and base-class ban in domain files, the delivery-type clause,
 * FF-N01, the persona, the instructions, the neighbourhood and candidate-flag sections and the verdict schema.
 *
 * Probe independence (BR-U4-RUB-01) is kept: no v2.2 text uses `PROBE_CONSTRUCTION_VOCABULARY`.
 */
import { canonicalJSON, sha256Hex } from './canonical-json.js';
import type { RubricText } from './rubric.js';
import { FF_N01_ID, FF_N02_ID, RUBRIC_OUT_OF_SCOPE } from './rubric.js';
import { VERDICT_JSON_SCHEMA } from './verdict-schema.js';
import {
  CANDIDATE_FLAGS_HEADER, FF_N01_RUBRIC_V2, FF_N02_RUBRIC_V2, JUDGE_V2_BUDGET, JUDGE_V2_FLAG_PROXIES, JUDGE_V2_MAX_FLAGS,
  JUDGE_V2_PERSONA, PROMPT_INSTRUCTIONS_V2,
} from './judge-v2.js';

/** Revision label of the v2.2 texts (the CLI value is `--judge-version v2.2`). */
export const JUDGE_V22_REVISION = 'v2.2';

/** FF-N01 is v2.1's text: the layered false fail is FF-N02's (§8). */
export const FF_N01_RUBRIC_V22: RubricText = FF_N01_RUBRIC_V2;

export const FF_N02_RUBRIC_V22: RubricText = Object.freeze({
  rule: FF_N02_RUBRIC_V2.rule,
  pass: 'Every declaration in the file belongs to the role and kind of its declared layer, including its parameter, return and field types, its decorators and base classes, and its statements, and agrees with any ADR prose given. Calls into a layer that the layer model lets this layer depend on are part of that role.',
  fail: 'The file carries something that belongs to a different layer kind. In a domain or application file: a request, response, HTTP context, status code or HTTP error, from a web or transport package or from the delivery layer, in any method or function signature (parameter or return) or thrown, even when the parameter is optional or unused. In a domain file also: any framework or ORM type, decorator or base class (dependency injection, routing, persistence mapping), even when the class logic is pure; or direct I/O, that is a database, ORM, query, HTTP or file client that the file itself creates, imports from a package or obtains from a global accessor, or persistence or I/O done through a class of a layer that the layer model does not let this layer depend on. A call to a class or interface of a layer that this layer may depend on is not misplaced I/O, whatever that layer does behind it. In an infrastructure or presentation file: a business rule, that is a domain invariant, calculation or decision that the domain or application layer should own. Constructor parameters of any file are dependency wiring when their types come from the file\'s own layer or from a layer it may depend on: an injected repository, gateway, client or service there is not by itself misplaced. A type the project declares itself is not a framework type, whatever its name.',
  evidenceRequired: FF_N02_RUBRIC_V2.evidenceRequired,
});

export const RUBRICS_V22: Readonly<Record<string, RubricText>> = Object.freeze({
  [FF_N01_ID]: FF_N01_RUBRIC_V22,
  [FF_N02_ID]: FF_N02_RUBRIC_V22,
});

/** The v2.2 rubric of a function, or `undefined` for a function v2.2 does not define (it keeps its spec rubric). */
export function rubricV22Of(functionId: string): RubricText | undefined {
  return RUBRICS_V22[functionId];
}

/** v2.2 keeps v2.1's persona and instructions (the change is in the rubric and the layer model section). */
export const JUDGE_V22_PERSONA = JUDGE_V2_PERSONA;
export const PROMPT_INSTRUCTIONS_V22 = PROMPT_INSTRUCTIONS_V2;

/**
 * The sentences that introduce the layer model, per kind of dependency rule (`context-v22.ts`). They state the
 * spec's dependency rule, not a verdict on any file.
 */
export const LAYER_MODEL_V22_TEXT = Object.freeze({
  styleLine: 'Style: {style}.',
  unspecifiedStyle: 'unspecified',
  graph: 'Allowed dependencies are declared per layer: a layer may depend only on the layers it lists.',
  closed: 'Closed layering: layers are listed bottom-up and each layer may depend only on the layer listed directly before it.',
  ordered: 'Layers are listed inner to outer: a layer may depend on the layers listed before it.',
  layerLine: '- {name} (kind: {kind}; may depend on: {allowed}): {directories}',
  noDependency: 'no other layer',
  filePatterns: '; file patterns: {patterns}',
});

/** Styles whose layer order is a closed layering (only the adjacent step down); mirrors `no-layer-skip`'s styles. */
export const CLOSED_LAYERING_STYLES: readonly string[] = Object.freeze(['layered']);

export const JUDGE_V22_VALUES = Object.freeze({
  revision: JUDGE_V22_REVISION,
  rubric: { [FF_N01_ID]: FF_N01_RUBRIC_V22, [FF_N02_ID]: FF_N02_RUBRIC_V22, outOfScope: RUBRIC_OUT_OF_SCOPE },
  persona: JUDGE_V22_PERSONA,
  instructions: PROMPT_INSTRUCTIONS_V22,
  layerModel: LAYER_MODEL_V22_TEXT,
  closedLayeringStyles: CLOSED_LAYERING_STYLES,
  budget: JUDGE_V2_BUDGET,
  flagProxies: JUDGE_V2_FLAG_PROXIES,
  maxFlags: JUDGE_V2_MAX_FLAGS,
  candidateFlagsHeader: CANDIDATE_FLAGS_HEADER,
  verdictSchema: VERDICT_JSON_SCHEMA,
});

/** Test anchor: `sha256(canonicalJSON(JUDGE_V22_VALUES))` of the current revision. */
export const JUDGE_V22_SHA256 = '1915fb117f43cb2d13d43675887a46fcb6f6546eda8f369034a1738501ce22c6';

export function computeJudgeV22Sha256(): string {
  return sha256Hex(canonicalJSON(JUDGE_V22_VALUES));
}
