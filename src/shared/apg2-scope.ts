/**
 * Scope of the APG v2 templates (`Docs/v1.3/apg2-scope-adr-draft.md`): the file roles a generic template must not read
 * as architecture. Shared by the extractor (component membership, entry files) and the fitness compiler (template
 * parameters and in-memory mirrors).
 *
 * Every pattern is an anchored regular expression over a project-relative path that means the same in JavaScript and
 * in Cypher's `=~` (Java regex, full match): `(?:.*\/)?` is "in any directory".
 */

const TS = '(?:ts|tsx|mts|cts)';

/**
 * Test files (ADR change 3): `*.spec.*` and `*.test.*`, and any file under a `__tests__`, `__mocks__`, `test` or
 * `tests` directory.
 */
export const APG2_TEST_FILE_PATTERNS: readonly string[] = Object.freeze([
  `^(?:.*/)?[^/]*\\.(?:spec|test)\\.${TS}$`,
  '^(?:.*/)?(?:__tests__|__mocks__|test|tests)/.*$',
]);

/**
 * Test composition roots (ADR change 3): a file whose name starts with `test` or `Test` followed by an upper-case
 * letter, `-`, `_` or `.` (`testContainer.ts`, `test-module.ts`, `TestContainer.ts`), in any directory.
 */
export const APG2_TEST_COMPOSITION_ROOT_PATTERNS: readonly string[] = Object.freeze([
  '^(?:.*/)?[Tt]est[A-Z._-][^/]*$',
]);

/** Everything a template treats as test code: test files and test composition roots. */
export const APG2_TEST_PATTERNS: readonly string[] = Object.freeze([...APG2_TEST_FILE_PATTERNS, ...APG2_TEST_COMPOSITION_ROOT_PATTERNS]);

/**
 * Composition roots detected by file name (ADR change 1): `main.ts`, `*.module.ts` (ADR-026 `COMPOSITION_ROOT_GLOBS`),
 * `bootstrap.ts`, `composition-root.ts`, `compositionRoot.ts`, `container.ts`, `*.container.ts` and `di.ts`.
 */
export const APG2_COMPOSITION_ROOT_NAME_PATTERNS: readonly string[] = Object.freeze([
  `^(?:.*/)?(?:main|bootstrap|composition-root|compositionRoot|container|di)\\.${TS}$`,
  `^(?:.*/)?[^/]+\\.(?:module|container)\\.${TS}$`,
]);

/** The layer role that declares a composition root (DDD preset `composition`, hexagonal `config`). */
export const COMPOSITION_ROOT_ROLE = 'composition-root';

/** The minimum number of types (classes + interfaces) for the main-sequence distance to be read (ADR change 5). */
export const APG2_MIN_TYPES_FOR_DISTANCE = 4;

const compiled = (patterns: readonly string[]): RegExp[] => patterns.map((p) => new RegExp(p));
const TEST_RX = compiled(APG2_TEST_PATTERNS);

/** True when `filePath` is a test file or a test composition root (out of every APG v2 template's scope). */
export function isApg2TestPath(filePath: string): boolean {
  return TEST_RX.some((r) => r.test(filePath));
}

/** True when `filePath` matches any of the anchored `patterns`. */
export function matchesAny(patterns: readonly string[], filePath: string): boolean {
  return patterns.some((p) => new RegExp(p).test(filePath));
}
