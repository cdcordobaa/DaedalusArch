/**
 * Matching-rule loader (FR-25, FR-27; BR-U5b-01, 28, 30; U5b domain-entities §2, §5).
 *
 * `Docs/matching-rule.md` holds the human-readable rule and one fenced machine block (```yaml matching-rule).
 * This module reads that block into a `MatchingRule` and refuses (`SCORE_RULE_MISMATCH`) when the block is
 * missing, malformed, or its `version` differs from the registered version. The registered version is
 * `corpus/prereg.json` `matchingRuleVersion` once the pre-registration commit exists (Step 32); before it, the
 * draft version below stands in for it.
 *
 * It also owns the closed instrument root-cause list (`RootCauseCode`, BR-U5b-28): the union here, the
 * document's machine block and its §6 table are equal as sets (tested).
 *
 * Kept separate from `scripts/score-golden.ts` so the scorer's first commit is the scorer-logic commit
 * (BR-U5b-27 provenance).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export const MATCHING_RULE_DOC = 'Docs/matching-rule.md';
export const PREREG_FILE = 'corpus/prereg.json';
/** Version the draft document carries until `corpus/prereg.json` registers one (U5b Step 32). */
export const DRAFT_RULE_VERSION = '1.0.0';

export const SCORE_RULE_MISMATCH = 'SCORE_RULE_MISMATCH';

/** Closed instrument root-cause list (BR-U5b-28), canonical order. */
export const ROOT_CAUSE_CODES = [
  'RC-LAYER-MAP',
  'RC-EXTRACT-ALIAS',
  'RC-EXTRACT-BARREL',
  'RC-DYNAMIC-IMPORT',
  'RC-TYPE-ONLY',
  'RC-TEMPLATE-OVERAPPROX',
  'RC-STYLE-INAPPLICABLE',
  'RC-SPEC-PARAM',
  'RC-GENERATED-CODE',
  'RC-TEST-CODE',
  'RC-GENUINE-UNSEEDED',
  'RC-OTHER',
] as const;
export type RootCauseCode = (typeof ROOT_CAUSE_CODES)[number];

/** Fixed rule order of BR-U5b-12. */
export const RULE_ORDER = ['rejection', 'not-applicable', 'site-invalid', 'metric-crossing', 'twin', 'detection'] as const;
export type RuleStep = (typeof RULE_ORDER)[number];

export interface MatchingRule {
  readonly version: string;
  readonly lineTolerance: 0;
  readonly multiDetection: 'count-once';
  readonly collateralSource: 'manifest';
  readonly fpModes: readonly ['strict', 'labelled'];
  readonly ruleOrder: readonly RuleStep[];
  readonly metricKeyExclusions: readonly string[];
  readonly metricThresholdCrossing: true;
  readonly sccOverlap: true;
  readonly rootCauses: readonly RootCauseCode[];
}

export type RuleLoad =
  | { readonly ok: true; readonly rule: MatchingRule }
  | { readonly ok: false; readonly code: typeof SCORE_RULE_MISMATCH; readonly detail: string };

const BLOCK = /^```yaml matching-rule[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/m;

function refuse(detail: string): RuleLoad {
  return { ok: false, code: SCORE_RULE_MISMATCH, detail };
}

function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Extracts the machine block text, or `undefined` when the document has none (or more than one). */
export function machineBlockText(doc: string): string | undefined {
  const all = doc.match(new RegExp(BLOCK.source, 'gm'));
  if (all?.length !== 1) return undefined;
  return BLOCK.exec(doc)?.[1];
}

/**
 * Parses and validates the machine block of `doc` against `registeredVersion` (BR-U5b-01).
 * Any missing field, wrong constant, or version mismatch is `SCORE_RULE_MISMATCH`.
 */
export function parseMatchingRule(doc: string, registeredVersion: string): RuleLoad {
  const text = machineBlockText(doc);
  if (text === undefined) return refuse(`${MATCHING_RULE_DOC}: machine block (\`\`\`yaml matching-rule) missing or not unique`);
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (e) {
    return refuse(`machine block is not YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return refuse('machine block is not a mapping');
  const b = raw as Record<string, unknown>;
  const version = typeof b.version === 'string' ? b.version : typeof b.version === 'number' ? String(b.version) : undefined;
  if (version === undefined) return refuse('machine block has no version');
  if (version !== registeredVersion) return refuse(`matching-rule version ${version} != registered ${registeredVersion}`);
  if (b.lineTolerance !== 0) return refuse('lineTolerance must be 0');
  if (b.multiDetection !== 'count-once') return refuse('multiDetection must be count-once');
  if (b.collateralSource !== 'manifest') return refuse('collateralSource must be manifest');
  if (!Array.isArray(b.fpModes) || !sameList(b.fpModes, ['strict', 'labelled'])) return refuse('fpModes must be [strict, labelled]');
  if (!Array.isArray(b.ruleOrder) || !sameList(b.ruleOrder, RULE_ORDER)) return refuse(`ruleOrder must be [${RULE_ORDER.join(', ')}]`);
  if (b.metricThresholdCrossing !== true) return refuse('metricThresholdCrossing must be true');
  if (b.sccOverlap !== true) return refuse('sccOverlap must be true');
  if (!Array.isArray(b.metricKeyExclusions) || !b.metricKeyExclusions.every((x) => typeof x === 'string')) {
    return refuse('metricKeyExclusions must be a list of function ids');
  }
  if (!Array.isArray(b.rootCauses) || !sameList(b.rootCauses, ROOT_CAUSE_CODES)) {
    return refuse('rootCauses must equal the closed root-cause list (BR-U5b-28)');
  }
  return {
    ok: true,
    rule: {
      version,
      lineTolerance: 0,
      multiDetection: 'count-once',
      collateralSource: 'manifest',
      fpModes: ['strict', 'labelled'],
      ruleOrder: [...RULE_ORDER],
      metricKeyExclusions: [...b.metricKeyExclusions],
      metricThresholdCrossing: true,
      sccOverlap: true,
      rootCauses: [...ROOT_CAUSE_CODES],
    },
  };
}

/** The registered matching-rule version: `corpus/prereg.json` once it exists, else the draft version. */
export function registeredRuleVersion(repoRoot: string): string {
  const file = join(repoRoot, PREREG_FILE);
  if (!existsSync(file)) return DRAFT_RULE_VERSION;
  const prereg = JSON.parse(readFileSync(file, 'utf8')) as { readonly matchingRuleVersion?: unknown };
  if (typeof prereg.matchingRuleVersion !== 'string') {
    throw new Error(`${PREREG_FILE} has no matchingRuleVersion`);
  }
  return prereg.matchingRuleVersion;
}

/** Loads `Docs/matching-rule.md` from `repoRoot` against `registeredVersion` (default: the registered one). */
export function loadMatchingRule(repoRoot: string, registeredVersion?: string): RuleLoad {
  const file = join(repoRoot, MATCHING_RULE_DOC);
  if (!existsSync(file)) return refuse(`${MATCHING_RULE_DOC} not found`);
  let expected: string;
  try {
    expected = registeredVersion ?? registeredRuleVersion(repoRoot);
  } catch (e) {
    return refuse(e instanceof Error ? e.message : String(e));
  }
  return parseMatchingRule(readFileSync(file, 'utf8'), expected);
}

/** Root-cause codes listed in the document's §6 table (first column), in document order. */
export function documentRootCauseTable(doc: string): string[] {
  const out: string[] = [];
  for (const m of doc.matchAll(/^\| `(RC-[A-Z-]+)` \|/gm)) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}
