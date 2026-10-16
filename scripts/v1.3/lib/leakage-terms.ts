/**
 * V11 (threats register V13-TV-I4): the answer-revealing comment patterns, fixed and committed BEFORE the fixture
 * leakage census computed any count (Docs/DiagnosticRuns/v1.3-fixture-leakage-2026-10-16.md §1).
 *
 * Patterns are matched against comment text only (line, block and JSDoc comments found by the TypeScript scanner,
 * as in excerpt-scrub.ts), never against code: an identifier such as `blockingVerdict` is not a leak, a comment
 * saying "blocking" is. One comment line can carry several kinds; it counts once per kind and once in the total.
 *
 * Rule and template names: the union of every `scopeRules[].ruleName` in tests/fixtures/v1.3-reference/*\/reference.json
 * and every kebab-case template name in src/fitness-compiler/*templates*.ts, read once on 2026-10-16 and frozen here
 * (two style names, `clean-architecture` and `re-exports`, are not rule names and are left out).
 */

export interface LeakagePattern {
  readonly kind: string;
  readonly re: RegExp;
}

export const RULE_AND_TEMPLATE_NAMES: readonly string[] = [
  'abstraction-ratio', 'aggregate-boundary', 'application-service-thin', 'bounded-context-modules', 'component-instability',
  'context-isolation', 'controller-no-entity', 'core-isolation', 'dependency-direction', 'dependency-direction-graph',
  'dependency-inversion', 'domain-event-placement', 'domain-purity', 'domain-stability', 'domain-state-purity',
  'inheritance-depth', 'interface-segregation-proxy', 'layer-skip-graph', 'max-fan-in', 'module-domain-imports-infrastructure',
  'module-fan-out', 'naming-controllers', 'naming-conventions', 'naming-repos', 'naming-services', 'no-cyclic-deps',
  'no-domain-outward-dep', 'no-index-logic', 'no-layer-skip', 'no-orphan-files', 'pattern-proxy', 'port-adapter-pattern',
  'port-dependency-inversion', 'repository-aggregate-root', 'repository-pattern', 'single-responsibility-proxy',
  'test-file-pairing', 'use-case-isolation', 'value-object-immutability',
];

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The frozen pattern set. Order is the report's column order. */
export const LEAKAGE_PATTERNS: readonly LeakagePattern[] = [
  { kind: 'violation', re: /\bviolat(?:ion|ions|es|ed|ing)\b/i },
  { kind: 'allowed', re: /\ballowed\b/i },
  { kind: 'rule-id', re: /\b(?:FF|AP)-[A-Z]+[0-9]*[a-z]?\b/ },
  { kind: 'rule-name', re: new RegExp(`(?<![a-z0-9-])(?:${RULE_AND_TEMPLATE_NAMES.map(escape).join('|')})(?![a-z0-9-])`, 'i') },
  { kind: 'planted', re: /\bplant(?:ed|s|ing)?\b/i },
  { kind: 'seed', re: /\bseed(?:ed|s|ing)?\b/i },
  { kind: 'anti-pattern', re: /\banti-?patterns?\b/i },
  { kind: 'blocking', re: /\bblocking\b/i },
  { kind: 'advisory', re: /\badvisory\b/i },
  { kind: 'near-miss', re: /\bnear[- ]miss(?:es)?\b/i },
  // The near-miss explanations the register quotes ("Not a repository: it stores nothing", "Not an adapter; ...").
  { kind: 'construct-denial', re: /\bnot an? (?:repository|adapter|port|use[- ]case|entity|aggregate(?: root)?|value object|controller|domain service|service|gateway)\b/i },
];

/** The kinds of `LEAKAGE_PATTERNS` a comment line matches (empty: not answer-revealing). */
export function leakageKinds(commentLine: string): string[] {
  return LEAKAGE_PATTERNS.filter((p) => p.re.test(commentLine)).map((p) => p.kind);
}
