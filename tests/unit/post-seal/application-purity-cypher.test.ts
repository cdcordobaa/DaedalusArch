/**
 * v1.4 U2 FF-P07 template text against the in-process interpreter's subset (design BR-U2-05 and §6 test 8; plan steps
 * 1.2 and 9.6): it parses and type-checks (npx mode runs it), its predicate is a top-level conjunction (BR-U1-44), and
 * the composition-root and test patterns mean the same under JavaScript `RegExp` and the interpreter's Java regex.
 */
import { parseCypher } from '../../../src/cypher-interp/parse.js';
import { javaRegex } from '../../../src/cypher-interp/functions.js';
import { APPLICATION_PURITY_TEMPLATE } from '../../../src/fitness-compiler/post-seal-rules.js';
import { replaceExcludeMarkers } from '../../../src/fitness-compiler/exclude-injector.js';
import { applyEdgeView, edgeViewOf, POST_SEAL_EDGE_VIEWS, TEMPLATE_EDGE_VIEWS } from '../../../src/fitness-compiler/edge-views.js';
import { APG2_COMPOSITION_ROOT_NAME_PATTERNS, APG2_TEST_PATTERNS } from '../../../src/shared/apg2-scope.js';

const TEXT = APPLICATION_PURITY_TEMPLATE.template;

/** The WHERE predicate with comments removed. */
function wherePredicate(text: string): string {
  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = noComments.indexOf('WHERE');
  const end = noComments.indexOf('RETURN');
  return noComments.slice(start + 'WHERE'.length, end);
}

/** The words OR at parenthesis depth 0 (string literals skipped). */
function topLevelOrs(predicate: string): number {
  let depth = 0;
  let n = 0;
  let quote: string | undefined;
  for (let i = 0; i < predicate.length; i++) {
    const ch = predicate[i];
    if (quote !== undefined) { if (ch === quote) quote = undefined; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && /\bOR\b/.test(predicate.slice(i, i + 3)) && /\W/.test(predicate[i - 1] ?? ' ')) n++;
  }
  return n;
}

describe('FF-P07 application-purity: Cypher subset', () => {
  it.each([
    ['as written, excludes off', replaceExcludeMarkers(TEXT, false)],
    ['as written, excludes on', replaceExcludeMarkers(TEXT, true)],
    ['resolved edge view (v1.3)', applyEdgeView('application-purity', replaceExcludeMarkers(TEXT, true))],
  ])('%s: parses and type-checks in the interpreter', (_label, text) => {
    expect(() => parseCypher(text)).not.toThrow();
  });

  it('the predicate is a top-level conjunction; the only OR sits inside ANY(...)', () => {
    const p = wherePredicate(TEXT);
    expect(topLevelOrs(p)).toBe(0);
    expect(p.split(/\bOR\b/).length - 1).toBe(1);
    expect(p).toContain('ANY(fp IN $forbiddenImports WHERE p.name = fp OR');
    expect(p).not.toContain('IS NULL');
  });

  it('reads the resolved edge view, recorded apart from the 38-entry v1.3 table (a registered figure)', () => {
    expect(edgeViewOf('application-purity')).toBe('resolved');
    expect(TEMPLATE_EDGE_VIEWS.has('application-purity')).toBe(false);
    expect(TEMPLATE_EDGE_VIEWS.size).toBe(38);
    expect([...POST_SEAL_EDGE_VIEWS.keys()]).toEqual(['application-purity']);
    expect(applyEdgeView('application-purity', TEXT)).toContain('[i:IMPORTS|RE_EXPORTS WHERE NOT coalesce(i.reExportHop, false)]');
  });

  it('declares exactly the parameters it reads', () => {
    const read = [...new Set([...TEXT.matchAll(/\$([A-Za-z]+)/g)].map((m) => m[1]))].sort();
    expect(read).toEqual([...APPLICATION_PURITY_TEMPLATE.requiredParams].sort());
  });

  const SAMPLES = ['src/main.ts', 'src/app.module.ts', 'src/application/x.spec.ts', 'src/application/OrderService.ts',
    'src/config/container.ts', 'src/application/__tests__/helper.ts', 'src/ordering/ordering.module.ts', 'main.ts'];

  it.each([...APG2_COMPOSITION_ROOT_NAME_PATTERNS, ...APG2_TEST_PATTERNS])('pattern %s: JavaScript RegExp and the Java full match agree on every sample', (pattern) => {
    expect(pattern.startsWith('^') && pattern.endsWith('$')).toBe(true);
    for (const s of SAMPLES) expect({ s, java: javaRegex(pattern).test(s) }).toEqual({ s, java: new RegExp(pattern).test(s) });
  });

  it('the samples fall where the design says: roots and tests excluded, the service kept', () => {
    const excluded = (s: string): boolean => [...APG2_COMPOSITION_ROOT_NAME_PATTERNS, ...APG2_TEST_PATTERNS].some((p) => javaRegex(p).test(s));
    expect(excluded('src/main.ts')).toBe(true);
    expect(excluded('src/app.module.ts')).toBe(true);
    expect(excluded('src/application/x.spec.ts')).toBe(true);
    expect(excluded('src/application/OrderService.ts')).toBe(false);
  });
});
